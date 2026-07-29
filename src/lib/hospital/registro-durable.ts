/**
 * Registro clínico DURABLE del internamiento — el LIBRO APPEND-ONLY del episodio.
 *
 * Los arrays del doc de internamiento (`balanceHidrico`, `escalas`, `sbar` y
 * `indicaciones[].administraciones[]`) son solo CACHÉ DE DISPLAY: están topados
 * por el límite de 1 MB por documento Firestore. El registro clínico-legal
 * COMPLETO se persiste append-only en la subcolección `registros` (sin truncar)
 * → ningún registro se pierde en silencio (NOM-004).
 *
 * ═══ AVISO QUE NO SE PUEDE OMITIR (E0-09) ═══
 * Lo append-only *por reglas de Firestore* es la subcolección `registros`, NO el
 * array `indicaciones[].administraciones[]` del documento. Ese array lo escribe
 * el Admin SDK, que ignora las reglas por diseño. Quien necesite la garantía
 * legal debe leer `registros`, no el doc: el doc puede truncarse, el libro no.
 *
 * Esta función (PURA) devuelve el evento a persistir, o `null` si la acción no
 * necesita registro durable aparte. El autor `por` y la hora `fecha` los sella
 * SIEMPRE el servidor: se reciben como argumentos y nunca se leen del payload.
 */
import type { EventoClinico, TipoEventoClinico, ValorDetalle } from '@/types/hospital'

type Any = Record<string, unknown>

/**
 * Acciones de `/api/hospital/mutar` que SÍ producen evento durable, con el tipo
 * que emiten. `balance`/`escala`/`sbar` existen desde 2026-07 y conservan su
 * forma PLANA original (ver `EventoClinico`); el resto entró con E0-09 y usa
 * `detalle` saneado por lista blanca.
 */
export const ACCIONES_CON_EVENTO_DURABLE: Readonly<Record<string, TipoEventoClinico>> = {
  balance: 'balance',
  escala: 'escala',
  sbar: 'sbar',
  administrar: 'administracion',
  indicacion_agregar: 'indicacion_alta',
  indicacion_suspender: 'indicacion_suspension',
  verificar_farmacia: 'verificacion_farmacia',
}

/**
 * Acciones que NO emiten evento durable, cada una con su razón EXPLÍCITA.
 *
 * No es una lista de descartes cómodos: junto con el mapa de arriba forma una
 * PARTICIÓN de `GATES`. Una acción nueva que no aparezca en ninguno de los dos
 * rompe el CI a propósito (`hospital-eventos-append-only.test.ts`), para que
 * nadie añada un hecho clínico al gateway sin decidir si entra al libro legal.
 */
export const ACCIONES_SIN_EVENTO_DURABLE: Readonly<Record<string, string>> = {
  crear:
    'El ingreso crea el propio documento del episodio en otra rama de la ruta ' +
    '(no llega a este punto); el doc ES el registro del ingreso.',
  egresar:
    'El egreso queda sellado en el doc (estado/fechaEgreso/tipoEgreso) y en la ' +
    'nota de egreso, ya inmutable por las reglas de notas firmadas.',
  trasladar: 'Queda en `movimientos[]` del doc, que nunca se sobrescribe (sólo se anexa).',
  cambiar_tratante: 'Igual que el traslado: se anexa a `movimientos[]`.',
  indicacion_editar:
    'El servidor sólo la admite mientras la indicación NO se haya administrado ' +
    '(si ya hay MAR, obliga a suspender): no hay hecho clínico que corregir.',
  indicacion_borrar:
    'Mismo bloqueo que editar. PENDIENTE DECLARADO (REG-052): si el Dr. quiere ' +
    'que una orden prescrita y retirada antes de administrarse deje huella en el ' +
    'libro, es una decisión de expediente, no una derivación del código.',
  interconsulta_agregar: 'Vive en `interconsultas[]`; fuera del alcance «MAR, órdenes y UCI».',
  interconsulta_responder: 'Ídem. Una interconsulta respondida ya es inmutable en el gateway.',
  interconsulta_editar: 'Ídem; sólo admitida mientras esté `solicitada`.',
  interconsulta_borrar: 'Ídem; sólo admitida mientras esté `solicitada`.',
  conciliar:
    'Reemplaza la lista de medicamentos de casa con bloqueo optimista; es estado ' +
    'de trabajo previo a la prescripción, no un hecho administrado.',
}

/**
 * Campos que cada acción puede aportar al `detalle` del evento.
 *
 * Lista blanca ANTI MASS-ASSIGNMENT: el payload del cliente no mete campos
 * arbitrarios en un registro legal permanente. Todos los campos declarados son
 * escalares en sus tipos (`Administracion`, `Indicacion`), así que un valor no
 * escalar es un cliente roto o malicioso y se descarta.
 */
const CAMPOS_DETALLE: Readonly<Record<string, readonly string[]>> = {
  administrar: ['estado', 'nota', 'cincoCorrectos', 'identidadVerificada'],
  indicacion_agregar: ['tipo', 'descripcion', 'frecuencia', 'creadaPor'],
  indicacion_suspender: ['activa'],
  verificar_farmacia: [],
}

/** Sólo escalares serializables. Un objeto/arreglo/NaN en un campo escalar se descarta. */
export function saneaDetalle(fuente: unknown, campos: readonly string[]): Record<string, ValorDetalle> {
  const out: Record<string, ValorDetalle> = {}
  if (typeof fuente !== 'object' || fuente === null) return out
  const src = fuente as Any
  for (const k of campos) {
    const v = src[k]
    if (v === null) { out[k] = null; continue }
    if (typeof v === 'string' || typeof v === 'boolean') { out[k] = v; continue }
    if (typeof v === 'number' && Number.isFinite(v)) { out[k] = v; continue }
    // `undefined` y no-escalares se omiten: el libro no guarda basura, y además
    // Firestore rechaza `undefined` si algún día se apaga ignoreUndefinedProperties.
  }
  return out
}

export function registroDurable(accion: string, p: Any, now: string, por: string): EventoClinico | null {
  // `por` = AUTOR REAL sellado por el servidor (usuario en sesión), NO `p.por` del
  // cliente (auditoría P1): este registro es append-only NOM-004; atribuirlo a otro
  // médico falsearía el expediente legal permanente. Igual con `now`: el reloj de
  // la tablet es manipulable y la hora de administración es dato clínico duro.
  switch (accion) {
    // ── Forma PLANA original (documentos ya escritos en producción). No migrar. ──
    case 'balance': return { tipo: 'balance', fecha: now, ingresos: p.ingresos, egresos: p.egresos, por }
    case 'escala':  return { tipo: 'escala', fecha: now, escala: p.tipo, score: p.score, riesgo: p.riesgo, por }
    case 'sbar':    return { tipo: 'sbar', fecha: now, texto: p.texto, por }

    // ── MAR y órdenes (E0-09): el hecho entra al libro legal, no sólo al caché ──
    case 'administrar':
      // `p.adm` trae `por`/`fecha` del cliente: NO se copian (no están en la lista
      // blanca). El evento se atribuye a quien ejecutó de verdad.
      return evento('administracion', now, por, saneaDetalle(p.adm, CAMPOS_DETALLE.administrar), textoId(p.indId))
    case 'indicacion_agregar':
      // Sin `indicacionId`: el id de la indicación lo acuña `patch()` con randomUUID
      // en el mismo instante y enlazarlos exigiría tocar la ruta. La orden queda
      // identificada por descripción + fecha. Residual declarado en REG-052.
      return evento('indicacion_alta', now, por, saneaDetalle(p, CAMPOS_DETALLE.indicacion_agregar))
    case 'indicacion_suspender':
      return evento('indicacion_suspension', now, por, saneaDetalle(p, CAMPOS_DETALLE.indicacion_suspender), textoId(p.indId))
    case 'verificar_farmacia':
      return evento('verificacion_farmacia', now, por, {}, textoId(p.indId))

    default:        return null
  }
}

function textoId(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

function evento(
  tipo: TipoEventoClinico,
  fecha: string,
  por: string,
  detalle: Record<string, ValorDetalle>,
  indicacionId?: string,
): EventoClinico {
  const ev: EventoClinico = { tipo, fecha, por }
  if (indicacionId !== undefined) ev.indicacionId = indicacionId
  if (Object.keys(detalle).length > 0) ev.detalle = detalle
  return ev
}
