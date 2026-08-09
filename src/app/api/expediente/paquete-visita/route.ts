/**
 * EL PAQUETE DE LA VISITA — componer y LIBERAR. V9 · `POSTVISIT-001`.
 *
 * `GET  ?clinicId&patientId&notaId` → qué se ha liberado ya de esa consulta.
 * `POST { clinicId, patientId, notaId }` → compone y libera una versión nueva.
 *
 * ── POR QUÉ EL CUERPO DE LA PETICIÓN NO TRAE CONTENIDO CLÍNICO ──────────────
 *
 * Sólo llegan tres identificadores. **Nada de lo que el paciente va a leer
 * viaja desde el navegador**: el servidor lee la nota firmada de Firestore y
 * compone él mismo, con el mismo motor determinista que pinta la vista previa.
 *
 * Si el contenido llegara en el cuerpo, esta ruta sería un «escribe lo que
 * quieras en el expediente del paciente» con una capa de buenos modales. El
 * médico aprueba **lo que la vista previa le enseñó**, y lo que la vista previa
 * enseña es lo que esta ruta vuelve a componer desde la misma fuente.
 *
 * ── Y QUIÉN APRUEBA SALE DE LA SESIÓN, NUNCA DEL CUERPO ─────────────────────
 *
 * `approvedBy` es el uid del médico verificado. Un `approvedBy` que llegara del
 * navegador convertiría el campo en decorativo: cualquiera podría liberar
 * firmando con el nombre de otro, que es justo lo que `firestore.rules` ya
 * impide al FIRMAR una nota (ahí la regla exige que el autor declarado sea
 * quien firma).
 *
 * ── LA COMPUERTA DE FIRMA ───────────────────────────────────────────────────
 *
 * `componerPaquete` se niega si la nota no está firmada, y esta ruta no la
 * atrapa para «arreglarlo»: devuelve 409 y se acabó. Es `POSTVISIT-GATE-001`.
 *
 * ── INMUTABILIDAD ───────────────────────────────────────────────────────────
 *
 * Se escribe con `create`, nunca con `set` ni `update`: un paquete liberado no
 * se toca. Corregirlo es liberar la versión siguiente, y el id lleva la versión
 * dentro (`{notaId}__v{n}`). El paciente ve sólo la última de cada consulta
 * (`ultimaVersionPorNota`); el expediente las conserva todas.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verificarCapacidad } from '@/lib/authz/verificar'
import { adminDb } from '@/lib/firebase-admin'
import { safeLog } from '@/lib/security/sanitize'
import { linkPortalPaciente } from '@/lib/patient-token'
import {
  componerPaquete, liberar, NOTA_SIN_FIRMAR,
  type PaqueteDeVisita,
} from '@/lib/paciente/paquete-de-visita'
import type { NotaMedica } from '@/types/expediente'
import type { ClinicConfig } from '@/types'

/** Días que dura el enlace con el que el paciente abre lo que se le acaba de liberar. */
const DIAS_DEL_ENLACE = 7

const paquetesRef = (clinicId: string, patientId: string) =>
  adminDb.collection('clinics').doc(clinicId)
    .collection('patients').doc(patientId)
    .collection('paquetes_visita')

/**
 * El seguimiento de ESTA consulta, no el del paciente.
 *
 * `proximoSeguimiento` vive en el expediente del paciente y lo pisa cada
 * consulta nueva: leerlo de ahí para un paquete de hace tres meses le diría al
 * paciente que vuelva en una fecha que se decidió en otra visita. La tarea
 * clínica de seguimiento sí cuelga de su `notaId`, y es lo que el médico
 * indicó ese día.
 *
 * Sin tarea, cadena vacía. Ausencia de dato no es dato de ausencia: que no haya
 * seguimiento indicado no autoriza a componer uno.
 */
async function seguimientoDeLaNota(clinicId: string, notaId: string): Promise<string> {
  try {
    const snap = await adminDb.collection('clinics').doc(clinicId)
      .collection('tareas_clinicas')
      .where('notaId', '==', notaId)
      .where('tipo', '==', 'seguimiento')
      .limit(1)
      .get()
    const t = snap.docs[0]?.data() as { venceEn?: string } | undefined
    return typeof t?.venceEn === 'string' ? t.venceEn.slice(0, 10) : ''
  } catch {
    /* El seguimiento es un extra: no puede tumbar la liberación del paquete. */
    return ''
  }
}

/**
 * La medicación de la consulta ANTERIOR a ésta.
 *
 * Devuelve `undefined` —no `[]`— cuando no hay nota firmada previa, y de ahí
 * sale el `medicationChanges: null` del paquete. «No había nada antes» y «no sé
 * qué había antes» no se le pueden decir igual a un paciente.
 */
async function medicacionDeLaVisitaAnterior(
  clinicId: string, patientId: string, nota: NotaMedica,
): Promise<NotaMedica['medicamentos'] | undefined> {
  try {
    const snap = await adminDb.collection('clinics').doc(clinicId)
      .collection('patients').doc(patientId)
      .collection('notas')
      .where('estado', '==', 'firmada')
      .get()
    const previas = snap.docs
      .map(d => ({ id: d.id, ...(d.data() as Omit<NotaMedica, 'id'>) }))
      .filter(n => n.id !== nota.id && String(n.fechaConsulta ?? '') < String(nota.fechaConsulta ?? ''))
      .sort((a, b) => String(a.fechaConsulta).localeCompare(String(b.fechaConsulta)))
    const anterior = previas[previas.length - 1]
    return anterior ? (anterior.medicamentos ?? []) : undefined
  } catch {
    /* Sin poder mirar atrás no se AFIRMA que no hubo cambios: se declara `null`. */
    return undefined
  }
}

/** Teléfono del consultorio, para que el paquete diga a quién llamar. */
async function contactoDelConsultorio(clinicId: string): Promise<string> {
  try {
    const snap = await adminDb.collection('clinics').doc(clinicId).collection('config').doc('main').get()
    const c = snap.data() as ClinicConfig | undefined
    const tel = c?.whatsappConsultorio || c?.telefonoAdmin || ''
    /* Dato administrativo. NO se añade «si empeora acuda a urgencias»: eso es
       indicación médica, y la da el médico o no la da nadie. */
    return tel ? `Si tienes dudas sobre estas indicaciones, llama a tu consultorio: ${tel}` : ''
  } catch {
    return ''
  }
}

function identificadores(v: Record<string, unknown>): { clinicId: string; patientId: string; notaId: string } | null {
  const s = (k: string) => (typeof v[k] === 'string' ? (v[k] as string).trim() : '')
  const clinicId = s('clinicId'), patientId = s('patientId'), notaId = s('notaId')
  return clinicId && patientId && notaId ? { clinicId, patientId, notaId } : null
}

export async function GET(req: NextRequest) {
  const q = Object.fromEntries(req.nextUrl.searchParams.entries())
  const ids = identificadores(q)
  if (!ids) return NextResponse.json({ error: 'clinicId, patientId y notaId requeridos' }, { status: 400 })

  const acc = await verificarCapacidad(req, ids.clinicId, 'clinico.leer')
  if (!acc.ok) return acc.response

  try {
    const snap = await paquetesRef(ids.clinicId, ids.patientId).where('notaId', '==', ids.notaId).get()
    const paquetes = snap.docs
      .map(d => d.data() as PaqueteDeVisita)
      .sort((a, b) => (b.version ?? 0) - (a.version ?? 0))
      .map(p => ({ version: p.version, estado: p.estado, approvedAt: p.approvedAt, approvedBy: p.approvedBy }))
    return NextResponse.json({ paquetes })
  } catch (e) {
    safeLog.error('[paquete-visita] GET', e)
    return NextResponse.json({ error: 'No se pudo leer lo liberado de esta consulta' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const ids = identificadores(body)
  if (!ids) return NextResponse.json({ error: 'clinicId, patientId y notaId requeridos' }, { status: 400 })
  const { clinicId, patientId, notaId } = ids

  const acc = await verificarCapacidad(req, clinicId, 'clinico.escribir')
  if (!acc.ok) return acc.response

  /* Quién aprueba: la sesión verificada. Nunca el cuerpo de la petición. */
  const aprobadoPor = acc.uid
  if (!aprobadoPor) return NextResponse.json({ error: 'Sesión sin identidad' }, { status: 401 })

  try {
    const notaSnap = await adminDb.collection('clinics').doc(clinicId)
      .collection('patients').doc(patientId)
      .collection('notas').doc(notaId).get()
    if (!notaSnap.exists) return NextResponse.json({ error: 'Esa nota no existe en este expediente' }, { status: 404 })
    const nota = { id: notaSnap.id, ...(notaSnap.data() as Omit<NotaMedica, 'id'>) }

    const [seguimiento, medicacionPrevia, contacto] = await Promise.all([
      seguimientoDeLaNota(clinicId, notaId),
      medicacionDeLaVisitaAnterior(clinicId, patientId, nota),
      contactoDelConsultorio(clinicId),
    ])

    let paquete: PaqueteDeVisita
    try {
      paquete = componerPaquete(nota, {
        medicacionPrevia,
        seguimiento,
        contactoDelConsultorio: contacto,
      })
    } catch (e) {
      /* La compuerta de firma no se rescata: se devuelve tal cual. */
      const msg = e instanceof Error ? e.message : ''
      if (msg === NOTA_SIN_FIRMAR) {
        return NextResponse.json({ error: 'Firma la nota antes de liberársela al paciente.' }, { status: 409 })
      }
      throw e
    }

    /* La versión siguiente sale de lo que ya existe, y el `create` es quien
       decide de verdad: si dos pestañas liberan a la vez, la segunda choca
       contra el id ocupado en vez de pisar el documento de la primera. */
    const yaHay = await paquetesRef(clinicId, patientId).where('notaId', '==', notaId).get()
    const version = yaHay.docs.reduce((max, d) => Math.max(max, (d.data() as PaqueteDeVisita).version ?? 0), 0) + 1

    const liberado = liberar({ ...paquete, version }, aprobadoPor, Date.now())
    try {
      await paquetesRef(clinicId, patientId).doc(`${notaId}__v${version}`).create(liberado)
    } catch {
      return NextResponse.json(
        { error: 'Alguien liberó esta consulta al mismo tiempo. Recarga para ver la versión vigente.' },
        { status: 409 },
      )
    }

    void adminDb.collection('clinics').doc(clinicId).collection('audit_log').add({
      evento: 'paquete_visita_liberado',
      clinicId, patientId, notaId,
      timestamp: new Date().toISOString(),
      /* Sin contenido clínico: la bitácora dice QUÉ pasó, no qué decía. */
      meta: { version, aprobadoPor, origen: 'consulta' },
    }).catch(() => { /* la bitácora no puede tumbar lo ya liberado */ })

    /**
     * EL ENLACE CON EL QUE EL PACIENTE LO ABRE — `POSTVISIT-ENTREGA-001`.
     *
     * Liberar sin dar por dónde entrar deja el paquete escrito y sin llegar.
     * Alcance `clinico` porque aquí hay diagnóstico y medicación, y lo emite un
     * médico verificado — el mismo criterio que `/api/telesalud/token`.
     *
     * **No se manda nada.** El servidor devuelve el enlace y el médico decide
     * por dónde se lo hace llegar: mandar mensajes reales no es una decisión de
     * esta ruta.
     */
    /* Con la VERSIÓN vigente del paciente: si alguien revocó sus enlaces, el que
       se emite aquí tiene que morir con los demás, no resucitarlos. */
    let versionEnlace = 0
    try {
      const pac = await adminDb.collection('clinics').doc(clinicId).collection('patients').doc(patientId).get()
      versionEnlace = Number((pac.data() as { portalTokenVersion?: number } | undefined)?.portalTokenVersion ?? 0)
    } catch { /* sin versión conocida se emite la 0, como el resto de los enlaces */ }
    const origen = req.headers.get('origin') || req.nextUrl.origin
    const enlace = linkPortalPaciente(origen, clinicId, patientId, DIAS_DEL_ENLACE, 'clinico', versionEnlace)

    return NextResponse.json({
      ok: true,
      version,
      approvedAt: liberado.approvedAt,
      approvedBy: liberado.approvedBy,
      enlace,
    })
  } catch (e) {
    safeLog.error('[paquete-visita] POST', e)
    return NextResponse.json({ error: 'No se pudo liberar el paquete' }, { status: 500 })
  }
}
