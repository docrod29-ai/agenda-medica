/**
 * EL PAQUETE DE LA VISITA — componer y liberar. V9 · `POSTVISIT-001`.
 *
 * ── QUÉ CIERRA ESTA RUTA ─────────────────────────────────────────────────────
 *
 * `PATIENT-COMPANION-001` dejó montada la superficie del paciente y la compuerta
 * que impide que un borrador la cruce. Lo que faltaba era **el acto**: alguien
 * con cédula que mire lo compuesto y diga «esto es lo que quiero que lea mi
 * paciente». Eso pasa aquí.
 *
 * ── POR QUÉ EL CONTENIDO NO VIENE DEL NAVEGADOR ──────────────────────────────
 *
 * El cuerpo de la petición trae **identificadores, no contenido clínico**:
 * `clinicId`, `patientId`, `notaId`. El resumen, los medicamentos, las
 * instrucciones y los estudios los lee el servidor de la nota firmada en
 * Firestore y los compone con `componerPaquete`.
 *
 * Aceptar el paquete ya armado desde el cliente sería dejar que cualquiera con
 * una sesión de médico —o con las herramientas del navegador abiertas en la
 * sesión de otro— le mandara al paciente una dosis que nadie firmó. La lista
 * blanca de campos que exige la regla de aislamiento aquí es casi vacía **a
 * propósito**: el único texto que el cliente puede aportar son los signos de
 * alarma, que son del médico y se recortan.
 *
 * ── LAS DOS COMPUERTAS, Y SON DISTINTAS ──────────────────────────────────────
 *
 * 1. **Firma** (`puedeComponerse`): sin nota firmada no hay paquete. Es
 *    `POSTVISIT-GATE-001`, y hasta hoy no existía: la hoja del paciente se
 *    componía del borrador en curso.
 * 2. **Aprobación** (`liberar`): `approvedBy` sale de la SESIÓN, nunca del
 *    cuerpo. Un `approvedBy` que viaja por la red es un campo que se puede
 *    escribir, y entonces «lo aprobó su médico» deja de significar nada.
 *
 * ── LO QUE ESTA RUTA NO HACE (declarado, no olvidado) ────────────────────────
 *
 * **No sabe corregir un paquete ya liberado.** Recomponer sobre un `RELEASED`
 * responde 409. Corregir lo entregado es liberar una versión nueva —la misma
 * forma que una adenda sobre una nota firmada—, y eso necesita decidir qué ve
 * el paciente mientras tanto y cómo se le avisa de que cambió. No se improvisa
 * en la misma vuelta: queda como `POSTVISIT-VERSION-002` en el backlog, con el
 * campo `version` ya en el modelo esperándolo.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verificarCapacidad } from '@/lib/authz/verificar'
import { adminDb } from '@/lib/firebase-admin'
import { safeLog } from '@/lib/security/sanitize'
import {
  componerPaquete, liberar, puedeComponerse,
  type NotaParaComponer, type PaqueteDeVisita,
} from '@/lib/paciente/paquete-de-visita'
import type { MedicamentoParaExplicar } from '@/lib/paciente/como-se-lo-explico'

/** Tope de los signos de alarma que escribe el médico: 6 líneas de 200. */
const MAX_SIGNOS = 6
const MAX_LARGO_SIGNO = 200

const paquetesDe = (clinicId: string, patientId: string) =>
  adminDb.collection('clinics').doc(clinicId)
    .collection('patients').doc(patientId)
    .collection('paquetes_visita')

const notasDe = (clinicId: string, patientId: string) =>
  adminDb.collection('clinics').doc(clinicId)
    .collection('patients').doc(patientId)
    .collection('notas')

interface NotaEnDisco extends NotaParaComponer {
  fechaConsulta?: string
}

async function leerNota(clinicId: string, patientId: string, notaId: string): Promise<NotaEnDisco | null> {
  const snap = await notasDe(clinicId, patientId).doc(notaId).get()
  if (!snap.exists) return null
  return { id: snap.id, ...(snap.data() as Record<string, unknown>) } as NotaEnDisco
}

/**
 * LA MEDICACIÓN DE LA VISITA ANTERIOR — o el reconocimiento de que no se sabe.
 *
 * Devuelve `null` cuando no hay ninguna nota firmada previa, y `[]` cuando la
 * hay y no traía medicamentos. **No son lo mismo**, y por eso no se colapsan:
 * `null` hace que el paquete diga «no se pudo determinar» en vez de afirmarle al
 * paciente que su tratamiento no cambió. Regla 4 de seguridad clínica.
 *
 * Se ordena en memoria y no con `orderBy` a propósito: `where(estado) +
 * orderBy(fechaConsulta)` exige un índice compuesto en Firestore, y un índice
 * que falte convierte esto en un 500 en el momento más inoportuno. Es el mismo
 * patrón que ya usa `/api/portal` para las recetas.
 */
async function medicacionPrevia(
  clinicId: string, patientId: string, nota: NotaEnDisco,
): Promise<readonly MedicamentoParaExplicar[] | null> {
  const snap = await notasDe(clinicId, patientId).where('estado', '==', 'firmada').get()
  const anteriores = snap.docs
    .filter(d => d.id !== nota.id)
    .map(d => d.data() as { fechaConsulta?: string; medicamentos?: MedicamentoParaExplicar[] })
    .filter(n => String(n.fechaConsulta ?? '') < String(nota.fechaConsulta ?? ''))
    .sort((a, b) => String(b.fechaConsulta ?? '').localeCompare(String(a.fechaConsulta ?? '')))
  if (!anteriores.length) return null
  return anteriores[0].medicamentos ?? []
}

/**
 * La próxima cita del paciente, en texto.
 *
 * `HojaParaElPaciente` llevaba `proximaCita={undefined}` fijo desde que se
 * escribió, así que su cuarto bloque no podía renderizarse jamás. Aquí se
 * resuelve de verdad: la primera cita futura que no esté cancelada.
 *
 * Si no hay, va cadena vacía y el bloque no aparece — no se inventa un «acuda en
 * un mes», que sería una indicación médica que nadie dio.
 */
async function proximaCita(clinicId: string, patientId: string): Promise<string> {
  try {
    const snap = await adminDb.collection('clinics').doc(clinicId)
      .collection('appointments').where('pacienteId', '==', patientId).get()
    const ahora = new Date().toISOString().slice(0, 16).replace('T', ' ')
    const futuras = snap.docs
      .map(d => d.data() as { fechaHora?: string; estado?: string })
      .filter(c => !['cancelada', 'no-asistio', 'reagendada'].includes(String(c.estado ?? '')))
      .map(c => String(c.fechaHora ?? ''))
      .filter(f => f && f.replace('T', ' ') >= ahora)
      .sort()
    if (!futuras.length) return ''
    const f = futuras[0]
    const d = new Date(f.replace(' ', 'T'))
    if (Number.isNaN(d.getTime())) return ''
    return `${d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })} a las ${f.slice(11, 16)}`
  } catch {
    /* Sin cita resoluble, el bloque no aparece. Mejor callar que adivinar. */
    return ''
  }
}

/** Cómo contactar al consultorio. Dato administrativo del consultorio, no clínico. */
async function comoContactar(clinicId: string): Promise<string> {
  try {
    const snap = await adminDb.collection('clinics').doc(clinicId).collection('config').doc('main').get()
    const d = snap.exists ? (snap.data() as Record<string, unknown>) : {}
    const tel = String(d.telefono ?? d.whatsapp ?? d.telefonoClinica ?? '').trim()
    return tel ? `Si tienes dudas sobre tu tratamiento, llama al consultorio: ${tel}.` : ''
  } catch {
    return ''
  }
}

/** Los signos de alarma que escribió el médico, recortados. Nada más se acepta. */
function signosDelMedico(v: unknown): string[] {
  const crudo = typeof v === 'string' ? v.split('\n') : Array.isArray(v) ? v : []
  return crudo
    .map(x => String(x ?? '').trim().slice(0, MAX_LARGO_SIGNO))
    .filter(Boolean)
    .slice(0, MAX_SIGNOS)
}

/**
 * GET — lo que el médico ve antes de decidir.
 *
 * Devuelve el paquete guardado si existe, y si no, la **vista previa compuesta
 * al vuelo**, marcada como tal. No escribe nada: mirar no es un acto.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const clinicId = (url.searchParams.get('clinicId') ?? '').trim()
  const patientId = (url.searchParams.get('patientId') ?? '').trim()
  const notaId = (url.searchParams.get('notaId') ?? '').trim()
  if (!clinicId || !patientId || !notaId) {
    return NextResponse.json({ ok: false, error: 'Faltan clinicId, patientId o notaId' }, { status: 400 })
  }

  const acc = await verificarCapacidad(req, clinicId, 'clinico.leer')
  if (!acc.ok) return acc.response

  try {
    const guardado = await paquetesDe(clinicId, patientId).doc(notaId).get()
    if (guardado.exists) {
      return NextResponse.json({ ok: true, paquete: guardado.data() as PaqueteDeVisita, guardado: true })
    }

    const nota = await leerNota(clinicId, patientId, notaId)
    if (!nota) return NextResponse.json({ ok: false, error: 'La nota no existe' }, { status: 404 })
    if (!puedeComponerse(nota)) {
      return NextResponse.json({ ok: true, paquete: null, guardado: false, firmada: false })
    }

    const paquete = componerPaquete({
      nota,
      medicacionPrevia: await medicacionPrevia(clinicId, patientId, nota),
      proximaCita: await proximaCita(clinicId, patientId),
      comoContactar: await comoContactar(clinicId),
    })
    return NextResponse.json({ ok: true, paquete, guardado: false, firmada: true })
  } catch (e) {
    safeLog.error('[paquete] GET', e)
    return NextResponse.json({ ok: false, error: 'Error del servidor' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let body: {
    clinicId?: string; patientId?: string; notaId?: string
    accion?: string; signosDeAlarma?: unknown
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  const clinicId = String(body.clinicId ?? '').trim()
  const patientId = String(body.patientId ?? '').trim()
  const notaId = String(body.notaId ?? '').trim()
  const accion = String(body.accion ?? '').trim()
  if (!clinicId || !patientId || !notaId) {
    return NextResponse.json({ ok: false, error: 'Faltan clinicId, patientId o notaId' }, { status: 400 })
  }
  if (accion !== 'componer' && accion !== 'liberar') {
    return NextResponse.json({ ok: false, error: 'Acción no soportada' }, { status: 400 })
  }

  /**
   * `firmar` y no `clinico.escribir`: liberar es un acto de aprobación clínica
   * hacia el paciente, del mismo peso que firmar la nota. La enfermera que puede
   * registrar un pase de visita no decide qué lee el paciente en su casa.
   */
  const acc = await verificarCapacidad(req, clinicId, 'firmar')
  if (!acc.ok) return acc.response

  try {
    const ref = paquetesDe(clinicId, patientId).doc(notaId)
    const nota = await leerNota(clinicId, patientId, notaId)
    if (!nota) return NextResponse.json({ ok: false, error: 'La nota no existe' }, { status: 404 })

    /**
     * La compuerta de firma se comprueba en las DOS acciones, no sólo al
     * componer. Entre componer y liberar puede pasar cualquier cosa —una nota
     * cancelada, por ejemplo— y liberar sin volver a mirar entregaría un
     * paquete cuya nota ya no sostiene nada.
     */
    if (!puedeComponerse(nota)) {
      return NextResponse.json(
        { ok: false, error: 'La nota todavía no está firmada. Firma primero: lo que se libera es lo firmado.' },
        { status: 409 },
      )
    }

    const previo = await ref.get()
    const enDisco = previo.exists ? (previo.data() as PaqueteDeVisita) : null
    if (enDisco?.estado === 'RELEASED') {
      return NextResponse.json(
        {
          ok: false,
          error: 'Este resumen ya se liberó. Un paquete entregado no se reescribe: para corregirlo hará falta liberar una versión nueva.',
          paquete: enDisco,
        },
        { status: 409 },
      )
    }

    const quien = acc.email || acc.uid

    if (accion === 'componer') {
      const paquete = componerPaquete({
        nota,
        medicacionPrevia: await medicacionPrevia(clinicId, patientId, nota),
        proximaCita: await proximaCita(clinicId, patientId),
        comoContactar: await comoContactar(clinicId),
        signosDeAlarma: signosDelMedico(body.signosDeAlarma),
      })
      await ref.set({ ...paquete, compuestoEn: Date.now(), compuestoPor: quien })
      return NextResponse.json({ ok: true, paquete })
    }

    /**
     * LIBERAR. Se recompone antes de liberar, con los signos de alarma que trae
     * la petición: lo que se entrega es lo que el médico está viendo en el
     * momento de pulsar, no lo que se compuso hace diez minutos con otra nota.
     */
    const paquete = componerPaquete({
      nota,
      medicacionPrevia: await medicacionPrevia(clinicId, patientId, nota),
      proximaCita: await proximaCita(clinicId, patientId),
      comoContactar: await comoContactar(clinicId),
      signosDeAlarma: signosDelMedico(body.signosDeAlarma),
    })
    /* `quien` sale del token verificado. Nunca del cuerpo. */
    const liberado = liberar(paquete, quien, Date.now())
    await ref.set({ ...liberado, compuestoEn: Date.now(), compuestoPor: quien })

    /* Liberar hacia el paciente deja rastro: es un acto, no una lectura. */
    void adminDb.collection('clinics').doc(clinicId).collection('audit_log').add({
      evento: 'paquete_visita_liberado',
      notaId, patientId, por: quien,
      createdAt: new Date().toISOString(),
    }).catch(() => {})

    return NextResponse.json({ ok: true, paquete: liberado })
  } catch (e) {
    safeLog.error('[paquete] POST', e)
    return NextResponse.json({ ok: false, error: 'Error del servidor' }, { status: 500 })
  }
}
