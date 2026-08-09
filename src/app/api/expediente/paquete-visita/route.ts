/**
 * LIBERAR EL PAQUETE DE LA VISITA — V9 · `POSTVISIT-001`.
 *
 * ── QUÉ CIERRA ESTA RUTA ────────────────────────────────────────────────────
 *
 * `PATIENT-COMPANION-001` dejó montada la superficie del paciente y la compuerta
 * que la protege, y lo dijo por escrito: **hoy ningún paquete existe**. Faltaba
 * el acto del médico. Ésta es la ruta de ese acto.
 *
 * Dos acciones, y la diferencia entre ellas es todo:
 *
 *   · `previsualizar` — compone y devuelve. **No escribe nada.** Es lo que el
 *     médico lee antes de decidir.
 *   · `liberar`       — compone otra vez, sella quién y cuándo, y **escribe**.
 *
 * ── POR QUÉ COMPONE EL SERVIDOR Y NO LA PANTALLA ────────────────────────────
 *
 * Porque el contenido clínico sale de la nota **guardada**, leída aquí con el
 * Admin SDK. Si la pantalla compusiera y mandara el resultado, la lista blanca
 * de campos estaría validando la forma de algo que ya viene del cliente: quien
 * controle ese navegador escribe lo que quiera en el documento que va a leer el
 * paciente, y el paciente no puede detectar el error.
 *
 * Del cuerpo de la petición sólo se aceptan **identificadores** —clinicId,
 * patientId, notaId— y la acción. Ni una cadena de texto clínico. Ese es el
 * invariante de esta ruta, y hay un guardián que lo vigila.
 *
 * ── POR QUÉ `firmar` Y NO `clinico.escribir` ────────────────────────────────
 *
 * Liberar es un acto de aprobación con identidad profesional detrás: le dice al
 * paciente «esto es lo que quiero que leas». Es el mismo peso que sellar una
 * nota, y por eso pide la misma capacidad. Previsualizar sólo lee, y pide
 * `clinico.leer`.
 *
 * ── UN PAQUETE LIBERADO NO SE REESCRIBE ─────────────────────────────────────
 *
 * Corregir lo que se le entregó a un paciente es **liberar una versión nueva**,
 * igual que una adenda no reescribe la nota. Cada versión es un documento
 * propio (`{notaId}-v{n}`) y el paciente ve la última. Si dentro de un año hay
 * que responder «¿qué leyó este paciente el 9 de agosto?», la respuesta existe.
 *
 * ── EL RELOJ Y LA IDENTIDAD SON DEL SERVIDOR ────────────────────────────────
 *
 * `approvedBy` sale del ID-token verificado y `approvedAt` del reloj de este
 * proceso. Nunca del cuerpo. Es la misma lección de la bitácora de auditoría:
 * un registro que el registrado puede escribir a discreción no acredita nada.
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verificarMiembro } from '@/lib/auth-server'
import { exigeCapacidad } from '@/lib/authz/verificar'
import { ACCIONES_PAQUETE_VISITA } from '@/lib/authz/registro-rutas'
import { safeLog } from '@/lib/security/sanitize'
import { telefonoDelConsultorio } from '@/lib/whatsapp/avisar-consultorio'
import {
  componerPaquete, liberar, visibleParaElPaciente,
  type PaqueteDeVisita, type NotaParaComponer,
} from '@/lib/paciente/paquete-de-visita'
import type { NotaMedica } from '@/types/expediente'
import type { ClinicConfig } from '@/types'

export const runtime = 'nodejs'

/** Identificador de documento: sin barras, sin longitudes absurdas. */
const id = (v: unknown, max = 128): string =>
  typeof v === 'string' ? v.trim().slice(0, max).replace(/[/\s]/g, '') : ''

function notas(clinicId: string, patientId: string) {
  return adminDb
    .collection('clinics').doc(clinicId)
    .collection('patients').doc(patientId)
    .collection('notas')
}

function paquetes(clinicId: string, patientId: string) {
  return adminDb
    .collection('clinics').doc(clinicId)
    .collection('patients').doc(patientId)
    .collection('paquetes_visita')
}

/**
 * LA MEDICACIÓN DE LA VISITA ANTERIOR, O `null` SI NO SE SABE.
 *
 * `null` y `[]` significan cosas distintas y la diferencia le llega al paciente:
 * con `[]`, `cambiosDeMedicacion` marcaría **todo como nuevo**, incluido el
 * fármaco crónico que lleva tomando dos años. Sin nota anterior se devuelve
 * `null`, y el paquete sale con `medicationChanges: null` — «no se pudo
 * determinar», que es la verdad.
 *
 * Se busca la última nota FIRMADA anterior a ésta, ambulatoria: una nota de
 * internamiento lleva fármacos intravenosos que no son la medicación de casa.
 */
async function medicacionPrevia(
  clinicId: string, patientId: string, notaActual: NotaMedica,
): Promise<{ nombre?: unknown }[] | null> {
  const snap = await notas(clinicId, patientId)
    .where('estado', '==', 'firmada')
    .get()

  const fechaActual = String(notaActual.fechaConsulta ?? '')
  const anteriores = snap.docs
    /* El id del DOCUMENTO manda, y por eso va después del spread: una nota
       guardada lleva su propio campo `id`, y si gana el del contenido, dos
       notas distintas pueden decir que son la misma. Lo cazó `tsc`. */
    .map(d => ({ ...(d.data() as NotaMedica), id: d.id }))
    .filter(n => n.id !== notaActual.id && !n.internamientoId)
    .filter(n => String(n.fechaConsulta ?? '') < fechaActual)
    .sort((a, b) => String(b.fechaConsulta ?? '').localeCompare(String(a.fechaConsulta ?? '')))

  const previa = anteriores[0]
  if (!previa) return null
  return Array.isArray(previa.medicamentos) ? previa.medicamentos : []
}

/**
 * CÓMO CONTACTAR AL CONSULTORIO — dato administrativo, no clínico.
 *
 * El teléfono sale de `telefonoDelConsultorio`, que ya existía y que es de donde
 * lo leen los avisos de WhatsApp. **No se vuelve a leer el campo a mano**: dos
 * lecturas del mismo dato es el defecto que este repositorio lleva persiguiendo
 * desde ADR-001, y el día que discrepen el paciente llama al número viejo.
 *
 * Si no hay teléfono queda vacío: inventarle al paciente una vía de contacto que
 * no existe es peor que no darle ninguna, porque la va a usar cuando le urja.
 */
function comoContactar(config: ClinicConfig | null): string {
  const tel = telefonoDelConsultorio(config)
  if (!tel) return ''
  return `Si tienes dudas sobre tu tratamiento, llama a tu consultorio: ${tel}.`
}

/** Las versiones ya liberadas de esta nota, de la más nueva a la más vieja. */
async function versionesDe(
  clinicId: string, patientId: string, notaId: string,
): Promise<(PaqueteDeVisita & { id: string })[]> {
  const snap = await paquetes(clinicId, patientId).where('notaId', '==', notaId).get()
  return snap.docs
    .map(d => ({ ...(d.data() as Record<string, unknown>), id: d.id }) as unknown as PaqueteDeVisita & { id: string })
    .sort((a, b) => (b.version ?? 0) - (a.version ?? 0))
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }

  const clinicId = id(body.clinicId)
  const patientId = id(body.patientId)
  const notaId = id(body.notaId)
  const accion = typeof body.accion === 'string' ? body.accion : ''

  if (!clinicId || !patientId || !notaId) {
    return NextResponse.json({ ok: false, error: 'Faltan identificadores' }, { status: 400 })
  }
  /**
   * MEMBRESÍA PRIMERO, CAPACIDAD DESPUÉS — igual que `hospital/mutar`, y por la
   * misma razón: así una acción inventada sólo devuelve 400 a quien YA es
   * miembro del consultorio; a un extraño se le responde 401/403 y no se le
   * confirma qué acciones existen.
   *
   * El mapa acción→capacidad NO vive aquí: vive en el registro de rutas, que es
   * donde se audita la política. Un ternario en este archivo sería una copia
   * más de la política de acceso, y de eso este repositorio ya tuvo seis.
   */
  const acceso = await verificarMiembro(req, clinicId)
  if (!acceso.ok) return acceso.response

  const capacidad = ACCIONES_PAQUETE_VISITA[accion]
  if (!capacidad) return NextResponse.json({ ok: false, error: 'Acción no reconocida' }, { status: 400 })
  const denegado = exigeCapacidad(acceso, capacidad)
  if (denegado) return denegado

  try {
    const snap = await notas(clinicId, patientId).doc(notaId).get()
    if (!snap.exists) {
      return NextResponse.json({ ok: false, error: 'La nota no existe' }, { status: 404 })
    }
    /* Igual que arriba: el id del documento después del spread. Aquí importa
       más — de este `id` sale el `notaId` del paquete, que es el puntero a la
       única fuente de verdad. Un campo `id` viejo dentro del contenido dejaría
       el paquete apuntando a otra nota. */
    const nota = { ...(snap.data() as NotaMedica), id: notaId }

    /**
     * LA COMPUERTA DE FIRMA — `POSTVISIT-GATE-001`.
     *
     * `componerPaquete` también la aplica y también lanza; se comprueba aquí
     * antes para devolverle al médico un 409 con un motivo que se entiende, en
     * vez de un 500 con el texto de una excepción.
     *
     * Las dos comprobaciones se quedan. La del motor protege a cualquier
     * llamador futuro; ésta protege la conversación con esta pantalla.
     */
    if (String(nota.estado) !== 'firmada') {
      return NextResponse.json(
        { ok: false, error: 'Primero firma la nota. Liberar es un segundo acto, y sólo sobre lo firmado.' },
        { status: 409 },
      )
    }

    const configSnap = await adminDb
      .collection('clinics').doc(clinicId).collection('config').doc('main').get()
    const config = configSnap.exists ? (configSnap.data() as ClinicConfig) : null

    const paquete = componerPaquete({
      nota: nota as unknown as NotaParaComponer,
      medicacionPrevia: await medicacionPrevia(clinicId, patientId, nota),
      comoContactar: comoContactar(config),
    })

    const yaLiberadas = await versionesDe(clinicId, patientId, notaId)
    const ultima = yaLiberadas[0] ?? null

    if (accion === 'previsualizar') {
      return NextResponse.json({
        ok: true,
        paquete,
        /* Lo que el paciente ya tiene, si es que tiene algo. La pantalla lo
           necesita para no ofrecer «liberar» como si fuera la primera vez. */
        liberado: ultima && visibleParaElPaciente(ultima)
          ? { version: ultima.version, approvedAt: ultima.approvedAt, approvedBy: ultima.approvedBy }
          : null,
      })
    }

    /**
     * Quién y cuándo: del token verificado y del reloj de este proceso.
     *
     * Se prefiere el correo al uid porque es lo que un auditor puede leer sin
     * cruzar tablas, y es lo que ya usa la bitácora. Si no hubiera correo, el
     * uid: `liberar()` se niega a aceptar una cadena vacía.
     */
    const quien = acceso.email ?? acceso.uid
    const version = (ultima?.version ?? 0) + 1
    const liberado = liberar({ ...paquete, version }, quien, Date.now())

    /**
     * `create`, no `set`. Un identificador que ya exista tiene que **fallar**,
     * no sobrescribir: si dos pestañas liberan a la vez, la segunda se entera en
     * vez de pisar en silencio lo que ya leyó el paciente.
     */
    await paquetes(clinicId, patientId).doc(`${notaId}-v${version}`).create({
      ...liberado,
      /* Para auditoría. `approvedBy` es el correo, que es lo que se lee; el uid
         es lo que identifica de verdad a la cuenta. */
      approvedByUid: acceso.uid,
      creadoEn: Date.now(),
    })

    safeLog.info('[paquete-visita] liberado', `v${version}`)
    return NextResponse.json({ ok: true, paquete: liberado, version })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    /* Los errores del motor son de precondición, no del servidor: el llamador
       pidió algo que no se puede componer. 409 y el motivo tal cual, que está
       escrito para leerse. */
    if (/no se compone|no se puede componer|internamiento/i.test(msg)) {
      return NextResponse.json({ ok: false, error: msg }, { status: 409 })
    }
    safeLog.error('[paquete-visita] fallo', msg.slice(0, 160))
    return NextResponse.json({ ok: false, error: 'No se pudo liberar el paquete' }, { status: 502 })
  }
}
