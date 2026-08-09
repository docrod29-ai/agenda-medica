/**
 * POST /api/paciente/paquete — el médico revisa y LIBERA lo que leerá el paciente.
 *
 * V9 · `POSTVISIT-001`. Es el camino que faltaba: el contenido estaba resuelto
 * desde REG-242 (`como-se-lo-explico`, determinista, se niega a inventar) y la
 * superficie del paciente desde REG-304 (`/mi/[token]`), pero **entre las dos no
 * había nada**. La hoja se podía copiar o imprimir y ahí se acababa el producto.
 *
 * Body: { clinicId, patientId, notaId, accion: 'previsualizar' | 'liberar' }
 * Resp: { ok, paquete, liberado } | { ok:false, error }
 *
 * ── EL CLIENTE NO APORTA CONTENIDO. NI UNA LÍNEA ────────────────────────────
 *
 * Ésta es la decisión de diseño de la ruta, y por eso el cuerpo tiene cuatro
 * campos y ninguno es texto clínico. Todo lo que acaba en el paquete lo lee el
 * servidor de la nota FIRMADA, del expediente y de la configuración.
 *
 * La alternativa —que la pantalla mandara el paquete ya compuesto— parece
 * cómoda y abre justo el agujero que el módulo del paquete describe: un
 * `estado: 'RELEASED'` puesto a mano, o un `approvedBy` que no es quien firma.
 * `firestore.rules` ya prohíbe la escritura directa desde el navegador
 * (`allow write: if false`); esta ruta es la otra mitad de esa decisión.
 *
 * Y hay una comprobación explícita —`campoProhibido`— que rechaza el cuerpo si
 * trae contenido, en vez de ignorarlo en silencio: un cliente que manda
 * `medicationInstructions` está intentando algo, y quiero que se entere y que
 * quede en el log.
 *
 * ── FIRMAR Y LIBERAR SIGUEN SIENDO DOS ACTOS ────────────────────────────────
 *
 * Esta ruta NO firma. Exige que la nota ya lo esté, y falla con 409 si no lo
 * está. Que el médico haya firmado no libera nada por sí solo: hace falta este
 * segundo gesto, y queda registrado con su nombre y la hora del servidor.
 */
import { NextRequest, NextResponse } from 'next/server'
import admin, { adminDb } from '@/lib/firebase-admin'
import { verificarCapacidad } from '@/lib/authz/verificar'
import {
  componerPaquete, liberar, tieneAlgoQueDecir, PaqueteNoComponible,
  type NotaParaElPaquete, type PaqueteDeVisita,
} from '@/lib/paciente/paquete-de-visita'
import type { MedicamentoParaExplicar } from '@/lib/paciente/como-se-lo-explico'
import {
  siguienteVersion, idDelPaquete, comoContactarAlConsultorio,
} from '@/lib/paciente/liberacion'
import { safeLog } from '@/lib/security/sanitize'

export const runtime = 'nodejs'

/** Lo ÚNICO que el cliente puede decir. Ni un campo más. */
const CAMPOS_ACEPTADOS = ['clinicId', 'patientId', 'notaId', 'accion'] as const

/**
 * Campos que un cliente honesto nunca manda. Se rechaza el cuerpo entero.
 *
 * No es paranoia decorativa: son exactamente los campos con los que se falsifica
 * una aprobación. Ignorarlos en silencio también sería seguro, pero entonces el
 * intento no deja rastro y nadie se entera de que alguien lo probó.
 */
const CAMPOS_PROHIBIDOS = [
  'estado', 'approvedBy', 'approvedAt', 'version',
  'medicationInstructions', 'medicationChanges', 'orders', 'followUp',
  'encounterSummary', 'warningSigns', 'educationalMaterial', 'clinicianContactRules',
]

const texto = (v: unknown, max = 200): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** El motivo de no-composición, traducido a HTTP. Por tipo, nunca por el mensaje. */
const ESTADO_HTTP: Record<string, number> = {
  'sin-firma': 409,
  'paciente-internado': 409,
  'sin-nota': 400,
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }

  const intruso = CAMPOS_PROHIBIDOS.find(c => c in body)
  if (intruso) {
    safeLog.warn('[paquete] el cuerpo traía contenido del cliente:', intruso)
    return NextResponse.json(
      { ok: false, error: 'El contenido del paquete lo compone el servidor desde la nota firmada; el cliente no lo aporta.' },
      { status: 400 },
    )
  }
  /* La lista blanca, después del mensaje específico: cualquier otra llave
     sobrante también se rechaza, porque mañana el campo con el que se intente
     colar algo tendrá un nombre que hoy no está en la lista de prohibidos. */
  const sobrante = Object.keys(body).find(k => !(CAMPOS_ACEPTADOS as readonly string[]).includes(k))
  if (sobrante) {
    safeLog.warn('[paquete] campo no reconocido en el cuerpo:', sobrante)
    return NextResponse.json({ ok: false, error: 'Cuerpo con campos no reconocidos' }, { status: 400 })
  }

  const clinicId = texto(body.clinicId, 128)
  const patientId = texto(body.patientId, 128)
  const notaId = texto(body.notaId, 128)
  const accion = texto(body.accion, 32)
  if (!clinicId || !patientId || !notaId) {
    return NextResponse.json({ ok: false, error: 'Faltan clinicId, patientId o notaId' }, { status: 400 })
  }
  if (accion !== 'previsualizar' && accion !== 'liberar') {
    return NextResponse.json({ ok: false, error: 'Acción no reconocida' }, { status: 400 })
  }

  /**
   * `clinico.escribir`: liberar es un acto clínico de comunicación, no una tarea
   * de mostrador. Es la misma capacidad con la que se escribe el expediente, y
   * excluye a los roles no clínicos — que es lo que comprueba el guardián de
   * rutas, porque aquí se leen diagnósticos y medicamentos.
   */
  const acceso = await verificarCapacidad(req, clinicId, 'clinico.escribir')
  if (!acceso.ok) return acceso.response

  const refPaciente = adminDb.collection('clinics').doc(clinicId).collection('patients').doc(patientId)

  let notaSnap
  try {
    notaSnap = await refPaciente.collection('notas').doc(notaId).get()
  } catch (e) {
    safeLog.error('[paquete] no se pudo leer la nota', e)
    return NextResponse.json({ ok: false, error: 'No se pudo leer la nota' }, { status: 502 })
  }
  if (!notaSnap.exists) return NextResponse.json({ ok: false, error: 'La nota no existe' }, { status: 404 })
  const nota = notaSnap.data() as Record<string, unknown>

  /**
   * LA MEDICACIÓN DE LA VISITA ANTERIOR, Y POR QUÉ SE LEE DE LA NOTA PREVIA.
   *
   * Podría salir de la lista vigente del expediente, que es más fácil de
   * consultar. Pero esa lista se reconcilia por otros caminos —el paciente dice
   * en el bot que dejó algo, la conciliación de ingreso la toca— y entonces
   * «qué cambió» compararía contra algo que el paciente nunca leyó.
   *
   * Lo que responde a «qué cambió desde la última vez que le dije algo» es la
   * nota firmada anterior. Si no hay ninguna, `medicacionPrevia` se queda en
   * `undefined` y el paquete sale con `medicationChanges: null` — que es
   * «no lo sé», no «no hubo cambios».
   */
  let medicacionPrevia: readonly MedicamentoParaExplicar[] | undefined
  try {
    const previas = await refPaciente.collection('notas')
      .where('estado', '==', 'firmada')
      .get()
    const anterior = previas.docs
      .filter(d => d.id !== notaId)
      .map(d => d.data() as Record<string, unknown>)
      .filter(n => typeof n.fechaConsulta === 'string')
      .sort((a, b) => String(b.fechaConsulta).localeCompare(String(a.fechaConsulta)))[0]
    if (anterior && Array.isArray(anterior.medicamentos)) {
      medicacionPrevia = anterior.medicamentos as MedicamentoParaExplicar[]
    }
  } catch (e) {
    /* Sin la nota previa NO se afirma que no hubo cambios: se deja en `null`. */
    safeLog.warn('[paquete] no se pudo leer la nota anterior; medicationChanges quedará en null', e)
  }

  const [pacienteSnap, configSnap] = await Promise.all([
    refPaciente.get().catch(() => null),
    adminDb.collection('clinics').doc(clinicId).collection('config').doc('main').get().catch(() => null),
  ])
  const paciente = (pacienteSnap?.data() ?? {}) as Record<string, unknown>
  const config = (configSnap?.data() ?? {}) as Record<string, unknown>

  /**
   * Lo que se lee de la nota, campo por campo y a la vista.
   *
   * No se le pasa el documento entero con un `...nota`: además de arrastrar
   * transcripciones y diálogo diarizado a un objeto que va a viajar al
   * navegador, esconde qué se está usando. Aquí se ve, y una lectura nueva
   * obliga a escribirla.
   */
  const notaParaElPaquete: NotaParaElPaquete = {
    id: notaId,
    estado: typeof nota.estado === 'string' ? nota.estado : '',
    resumenEjecutivo: nota.resumenEjecutivo,
    medicamentos: Array.isArray(nota.medicamentos) ? (nota.medicamentos as MedicamentoParaExplicar[]) : [],
    estudiosOrden: Array.isArray(nota.estudiosOrden) ? (nota.estudiosOrden as unknown[]) : [],
    internamientoId: nota.internamientoId,
  }

  let paquete: PaqueteDeVisita
  try {
    paquete = componerPaquete(notaParaElPaquete, {
      proximoSeguimiento: paciente.proximoSeguimiento,
      comoContactar: comoContactarAlConsultorio(config),
      medicacionPrevia,
    })
  } catch (e) {
    if (e instanceof PaqueteNoComponible) {
      return NextResponse.json({ ok: false, error: e.message, motivo: e.motivo }, { status: ESTADO_HTTP[e.motivo] ?? 409 })
    }
    throw e
  }

  /* Las liberaciones que ya existen de ESTA nota: para la versión y para decirle
     a la pantalla si ya se liberó. */
  let existentes: { version: number; approvedAt: number | null }[] = []
  try {
    const snap = await refPaciente.collection('paquetes_visita').where('notaId', '==', notaId).get()
    existentes = snap.docs
      .map(d => d.data() as Record<string, unknown>)
      .filter(p => p.estado === 'RELEASED')
      .map(p => ({ version: Number(p.version) || 0, approvedAt: (p.approvedAt as number) ?? null }))
  } catch (e) {
    safeLog.error('[paquete] no se pudieron leer las liberaciones previas', e)
    return NextResponse.json({ ok: false, error: 'No se pudo leer el estado del paquete' }, { status: 502 })
  }
  const ultima = existentes.sort((a, b) => b.version - a.version)[0] ?? null

  if (accion === 'previsualizar') {
    return NextResponse.json({ ok: true, paquete, liberado: ultima, hayContenido: tieneAlgoQueDecir(paquete) })
  }

  /* ── LIBERAR ──────────────────────────────────────────────────────────── */

  if (!tieneAlgoQueDecir(paquete)) {
    return NextResponse.json(
      { ok: false, error: 'Esta consulta no dejó nada que el paciente pueda leer: sin medicamentos, sin estudios y sin seguimiento.' },
      { status: 409 },
    )
  }

  /**
   * QUIÉN APRUEBA SALE DEL TOKEN, NUNCA DEL CUERPO. Y CUÁNDO, DEL RELOJ DEL
   * SERVIDOR.
   *
   * Es la misma lección que la bitácora aprendió a base de golpes: una
   * aprobación que el aprobado puede escribir a discreción no acredita nada.
   */
  const quien = acceso.email ?? acceso.uid
  const cuando = Date.now()

  /* Dos pestañas pulsando a la vez no pueden escribir la misma versión: el id la
     lleva dentro y `create()` choca. Un reintento basta para la carrera real. */
  let escrito: PaqueteDeVisita | null = null
  let version = siguienteVersion(existentes)
  for (let intento = 0; intento < 2 && !escrito; intento++, version++) {
    const candidato: PaqueteDeVisita = liberar({ ...paquete, version }, quien, cuando)
    try {
      await refPaciente.collection('paquetes_visita').doc(idDelPaquete(notaId, version)).create({
        ...candidato,
        /* Metadatos del documento, fuera del modelo: quién lo escribió de verdad. */
        liberadoPorUid: acceso.uid,
        creadoEn: admin.firestore.FieldValue.serverTimestamp(),
      })
      escrito = candidato
    } catch (e) {
      const codigo = (e as { code?: number | string })?.code
      /* 6 / ALREADY_EXISTS: otra pestaña ganó esta versión. Se reintenta con la
         siguiente. Cualquier otro fallo NO se reintenta: se dice. */
      if (codigo !== 6 && codigo !== 'already-exists') {
        safeLog.error('[paquete] no se pudo escribir la liberación', e)
        return NextResponse.json({ ok: false, error: 'No se pudo liberar el paquete' }, { status: 502 })
      }
    }
  }
  if (!escrito) {
    return NextResponse.json(
      { ok: false, error: 'Otra sesión liberó este paquete al mismo tiempo. Recarga para ver la versión vigente.' },
      { status: 409 },
    )
  }

  /**
   * La bitácora. Se escribe DESPUÉS y sin poder tumbar la liberación: si falla
   * el asiento, el paquete ya está liberado y el documento mismo lleva
   * `approvedBy` y `approvedAt`. Perder el asiento es malo; perder la
   * liberación por el asiento sería peor.
   */
  try {
    await adminDb.collection('clinics').doc(clinicId).collection('audit_log').add({
      evento: 'paquete_liberado',
      clinicId,
      patientId,
      notaId,
      medicoUid: acceso.uid,
      medicoEmail: acceso.email ?? null,
      rol: acceso.role ?? null,
      meta: { version: escrito.version },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    })
  } catch (e) {
    safeLog.warn('[paquete] liberado, pero el asiento de bitácora falló', e)
  }

  return NextResponse.json({
    ok: true,
    paquete: escrito,
    liberado: { version: escrito.version, approvedAt: escrito.approvedAt },
  })
}
