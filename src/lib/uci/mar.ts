/**
 * MAR de UCI — charter §37, sobre la farmacia que YA EXISTE.
 *
 * El backlog lo dice con la restricción incluida: «Vista MAR de UCI sobre la
 * farmacia existente, **sin duplicar inventario**».
 *
 * ── QUÉ ES Y QUÉ NO ES ───────────────────────────────────────────────────────
 *
 * Esto es una **lectura** de `Indicacion[]` (`src/types/hospital.ts`), que es el
 * registro que ya usa el piso. No define medicamentos, no lleva existencias, no
 * descuenta stock y no crea un segundo catálogo. Si aquí apareciera un tipo
 * `Medicamento` o un campo `existencias`, el módulo estaría duplicando lo que
 * la farmacia ya hace, y los dos registros divergirían.
 *
 * ── POR QUÉ EL RIESGO AQUÍ ES LA ALARMA FALSA ────────────────────────────────
 *
 * Un MAR de UCI que marque «ATRASADO» donde no lo hay es peor que uno mudo: si
 * la norepinefrina en infusión y el paracetamol PRN aparecen en rojo cada hora,
 * el rojo deja de significar algo y la dosis que sí se pasó se pierde en el
 * ruido. Por eso el módulo distingue explícitamente:
 *
 *  · **infusión continua** — se titula, no se «pasa». NUNCA se atrasa.
 *  · **por razón necesaria (PRN)** — se da si hace falta. NUNCA se atrasa.
 *  · **dosis única** — una vez dada, se acabó. NUNCA se atrasa.
 *  · **horario no interpretable** — se dice que no se entendió, y punto.
 *
 * ── POR QUÉ NO REUSA `extraerTomasDia` ───────────────────────────────────────
 *
 * `src/lib/seguridad/dosis.ts` ya interpreta frecuencias, pero para **techos
 * diarios**: ante «cada 4 a 6 horas» toma deliberadamente el intervalo MÁS
 * CORTO, porque para un techo el peor caso es el que más veces se toma.
 *
 * Para un MAR ese mismo sesgo marcaría atrasada una dosis que va a tiempo. Aquí
 * el rango se conserva **como rango**: la dosis toca a las 4 h y no se atrasa
 * hasta las 6 h. Es la lectura literal de la orden, no una elección del módulo.
 *
 * ── LO QUE NO SE ASUME ───────────────────────────────────────────────────────
 *
 * La **gracia** (cuántos minutos de margen antes de llamar atrasada a una dosis)
 * es una decisión operativa de la unidad, no un número que este módulo pueda
 * inventar: es obligatoria en la firma. Ver `FALTA_GRACIA`.
 *
 * Módulo PURO: sin reloj propio (el instante entra como parámetro), sin red,
 * sin LLM.
 */

import type { Indicacion, Administracion } from '@/types/hospital'

// ═══════════════════════════════════════════════════════════════════════
// Frecuencia — leer la orden, nunca completarla
// ═══════════════════════════════════════════════════════════════════════

export type Frecuencia =
  /** «cada 8 h» ⇒ min = max = 8. «cada 4 a 6 h» ⇒ min 4, max 6. */
  | { tipo: 'intervalo'; minHoras: number; maxHoras: number }
  /** Infusión continua: se titula, no se administra por dosis. */
  | { tipo: 'continua' }
  /** Por razón necesaria. */
  | { tipo: 'prn' }
  /** Dosis única / DU / STAT. */
  | { tipo: 'unica' }
  /** No se entendió. **No se adivina.** */
  | { tipo: 'no_interpretable'; texto: string }

const NUM_PALABRA: Record<string, number> = {
  una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  ocho: 8, doce: 12, veinticuatro: 24,
}

const normaliza = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

/**
 * Interpreta la frecuencia escrita en la orden.
 *
 * Sólo reconoce formas inequívocas. **Todo lo demás es `no_interpretable`**: un
 * horario adivinado produce un «atrasado» inventado, y ese es exactamente el
 * fallo que hace que se ignore el color rojo.
 */
export function interpretarFrecuencia(texto: string | undefined): Frecuencia {
  const t = normaliza(texto ?? '')
  if (t === '') return { tipo: 'no_interpretable', texto: texto ?? '' }

  // Continua PRIMERO: «infusión continua a 5 mL/h» lleva número y unidad de
  // tiempo, y sin este orden se leería como un intervalo.
  if (/\b(infusion\s+continua|en\s+infusion|continua|continuo|bic\b|perfusion\s+continua)\b/.test(t)) {
    return { tipo: 'continua' }
  }

  if (/\b(prn|s\.?o\.?s\.?|por\s+razon\s+necesaria|razon\s+necesaria|si\s+(?:lo\s+)?(?:requiere|precisa|necesita)|en\s+caso\s+de)\b/.test(t)) {
    return { tipo: 'prn' }
  }

  if (/\b(d\.?u\.?|dosis\s+unica|unica\s+dosis|stat|ahora\s+y\s+suspender)\b/.test(t)) {
    return { tipo: 'unica' }
  }

  // Rango: «cada 4 a 6 h», «cada 6-8 horas». Se conserva COMO RANGO.
  let m = t.match(/cada\s*(\d+)\s*(?:a|hasta|o|u|y|-|–)\s*(\d+)\s*(?:h|hr|hrs|hora|horas)\b/)
  if (m) {
    const a = parseInt(m[1], 10), b = parseInt(m[2], 10)
    if (a > 0 && b > 0) return { tipo: 'intervalo', minHoras: Math.min(a, b), maxHoras: Math.max(a, b) }
  }

  m = t.match(/cada\s*(\d+)\s*(?:h|hr|hrs|hora|horas)\b/) || t.match(/\bc\/\s*(\d+)\s*h/)
  if (m) {
    const h = parseInt(m[1], 10)
    if (h > 0) return { tipo: 'intervalo', minHoras: h, maxHoras: h }
  }

  m = t.match(/cada\s*(una?|dos|tres|cuatro|seis|ocho|doce|veinticuatro)\s*(?:h|hr|hrs|hora|horas)\b/)
  if (m && NUM_PALABRA[m[1]]) {
    const h = NUM_PALABRA[m[1]]
    return { tipo: 'intervalo', minHoras: h, maxHoras: h }
  }

  if (/\b(cada\s*24|cada\s*veinticuatro|una\s+vez\s+al\s+dia|1\s+vez\s+al\s+dia|diaria|diario)\b/.test(t)) {
    return { tipo: 'intervalo', minHoras: 24, maxHoras: 24 }
  }

  // «3 veces al día» ⇒ 24/3. Sólo con divisores exactos: «5 veces al día» no es
  // «cada 4.8 h», es un horario fijo que este módulo no conoce.
  m = t.match(/(\d+)\s*(?:veces|vez)\s*(?:al|por)\s*dia\b/)
  if (m) {
    const n = parseInt(m[1], 10)
    if (n > 0 && 24 % n === 0) { const h = 24 / n; return { tipo: 'intervalo', minHoras: h, maxHoras: h } }
  }

  return { tipo: 'no_interpretable', texto: texto ?? '' }
}

// ═══════════════════════════════════════════════════════════════════════
// La línea del MAR
// ═══════════════════════════════════════════════════════════════════════

export type EstadoMar =
  /** Se dio y todavía no toca la siguiente. */
  | 'al_dia'
  /** Ya entró en la ventana de la siguiente dosis, aún sin atrasarse. */
  | 'toca'
  /** Pasó el intervalo máximo + la gracia. */
  | 'atrasado'
  /** La orden está activa y no consta ninguna administración. */
  | 'nunca_administrado'
  /** Se titula; no se administra por dosis. */
  | 'infusion_continua'
  /** Se da si hace falta. */
  | 'prn'
  /** Dosis única ya dada. */
  | 'completado'
  /** No se entendió el horario. **No se adivina.** */
  | 'horario_no_interpretable'
  /** La orden ya no está activa. */
  | 'suspendido'

/** Estados que NO admiten atraso por definición. Ninguno debe pintarse en rojo. */
export const ESTADOS_SIN_ATRASO: readonly EstadoMar[] = [
  'infusion_continua', 'prn', 'completado', 'suspendido', 'horario_no_interpretable',
]

export interface LineaMar {
  indicacionId: string
  descripcion: string
  frecuencia: Frecuencia
  estado: EstadoMar
  /** Última administración NO omitida, si la hay. */
  ultima: Administracion | null
  /** Horas desde la última administración (o desde la orden si nunca se dio). */
  horasDesde: number | null
  /** Desde cuándo toca la siguiente, en ISO. `null` si el estado no lo admite. */
  tocaDesde: string | null
  /** A partir de cuándo se considera atrasada (máximo + gracia). */
  atrasadaDesde: string | null
  /** Omisiones registradas: nunca se pierden de vista. */
  omisiones: Administracion[]
  /** Frase lista para la pantalla. */
  mensaje: string
}

export const FALTA_GRACIA =
  'NEEDS_CLINICAL_REVIEW: los minutos de gracia antes de marcar una dosis como ' +
  'atrasada son una decisión operativa de la unidad (turnos, ronda de enfermería, ' +
  'tipo de fármaco). El módulo no asume un valor por defecto: una gracia inventada ' +
  'produce rojos falsos, y un MAR que grita deja de leerse.'

const H = 3_600_000

/**
 * Construye la línea del MAR de UNA indicación.
 *
 * @param graciaMin minutos de margen antes de llamar atrasada a una dosis.
 *   **Obligatorio a propósito** — ver `FALTA_GRACIA`.
 */
export function lineaMar(ind: Indicacion, ahoraIso: string, graciaMin: number): LineaMar {
  const ahora = Date.parse(ahoraIso)
  if (Number.isNaN(ahora)) throw new Error(`lineaMar: fecha inválida «${ahoraIso}»`)
  if (!Number.isFinite(graciaMin) || graciaMin < 0) {
    throw new Error(`lineaMar: gracia inválida «${graciaMin}». ${FALTA_GRACIA}`)
  }

  const frecuencia = interpretarFrecuencia(ind.frecuencia)
  const admins = [...(ind.administraciones ?? [])]
    .filter(a => !Number.isNaN(Date.parse(a.fecha)))
    .sort((x, y) => Date.parse(x.fecha) - Date.parse(y.fecha))

  const dadas = admins.filter(a => a.estado === 'administrado')
  const omisiones = admins.filter(a => a.estado === 'omitido')
  const ultima = dadas.length > 0 ? dadas[dadas.length - 1] : null

  // El ancla para «cuánto hace» es la última dosis dada; si nunca se dio, la
  // hora de la ORDEN. Una omisión no cuenta como dosis dada: alguien decidió no
  // pasarla, y eso no equivale a que el fármaco entrara.
  const anclaIso = ultima?.fecha ?? ind.fecha
  const ancla = Date.parse(anclaIso)
  const horasDesde = Number.isNaN(ancla) ? null : (ahora - ancla) / H

  const base = {
    indicacionId: ind.id, descripcion: ind.descripcion, frecuencia,
    ultima, horasDesde, omisiones,
  }
  const cierra = (estado: EstadoMar, mensaje: string): LineaMar =>
    ({ ...base, estado, tocaDesde: null, atrasadaDesde: null, mensaje })

  if (!ind.activa) return cierra('suspendido', 'Indicación suspendida.')
  if (frecuencia.tipo === 'continua') {
    return cierra('infusion_continua', 'En infusión continua: se titula, no se administra por dosis.')
  }
  if (frecuencia.tipo === 'prn') {
    return cierra('prn', ultima
      ? `Por razón necesaria. Última: ${ultima.fecha}.`
      : 'Por razón necesaria. Sin administraciones.')
  }
  if (frecuencia.tipo === 'unica') {
    return ultima
      ? cierra('completado', `Dosis única administrada el ${ultima.fecha}.`)
      : cierra('nunca_administrado', 'Dosis única pendiente de administrar.')
  }
  if (frecuencia.tipo === 'no_interpretable') {
    return cierra('horario_no_interpretable',
      `No se pudo interpretar el horario «${frecuencia.texto}». No se calcula atraso: ` +
      'un horario adivinado produce un atraso inventado.')
  }

  if (Number.isNaN(ancla)) {
    return cierra('horario_no_interpretable',
      'No consta cuándo empezó la indicación ni ninguna administración: no hay desde dónde contar.')
  }

  const tocaDesde = new Date(ancla + frecuencia.minHoras * H).toISOString()
  const atrasadaDesde = new Date(ancla + frecuencia.maxHoras * H + graciaMin * 60_000).toISOString()

  const cada = frecuencia.minHoras === frecuencia.maxHoras
    ? `cada ${frecuencia.minHoras} h`
    : `cada ${frecuencia.minHoras}–${frecuencia.maxHoras} h`

  let estado: EstadoMar
  let mensaje: string
  if (ahora >= Date.parse(atrasadaDesde)) {
    estado = 'atrasado'
    mensaje = `Atrasada: ${cada}, ${horasDesde!.toFixed(1)} h desde la última.`
  } else if (ahora >= Date.parse(tocaDesde)) {
    estado = 'toca'
    mensaje = `Toca: ${cada}, ${horasDesde!.toFixed(1)} h desde la última.`
  } else if (!ultima) {
    estado = 'nunca_administrado'
    mensaje = `Sin administraciones registradas. Indicada ${cada} desde ${ind.fecha}.`
  } else {
    estado = 'al_dia'
    mensaje = `Al día: ${cada}, última hace ${horasDesde!.toFixed(1)} h.`
  }

  // Sin ninguna dosis dada, el estado nunca es «al día»: no hay nada que lo esté.
  if (!ultima && estado === 'al_dia') estado = 'nunca_administrado'

  return { ...base, estado, tocaDesde, atrasadaDesde, mensaje }
}

export interface VistaMar {
  lineas: LineaMar[]
  /** Lo que exige acción ahora. */
  atrasadas: LineaMar[]
  /** Órdenes activas cuyo horario no se entendió: hay que arreglarlas, no ignorarlas. */
  noInterpretables: LineaMar[]
  /** Omisiones de todas las órdenes: nunca desaparecen en silencio. */
  omisiones: { indicacionId: string; descripcion: string; omision: Administracion }[]
}

/**
 * MAR completo del internamiento.
 *
 * Ordena por urgencia —atrasadas primero, luego lo que toca— porque en UCI la
 * lista es larga y lo que se ve primero es lo que se atiende.
 */
export function vistaMar(
  indicaciones: readonly Indicacion[],
  ahoraIso: string,
  graciaMin: number,
): VistaMar {
  const lineas = indicaciones.map(i => lineaMar(i, ahoraIso, graciaMin))
  const ORDEN: EstadoMar[] = [
    'atrasado', 'toca', 'nunca_administrado', 'horario_no_interpretable',
    'infusion_continua', 'prn', 'al_dia', 'completado', 'suspendido',
  ]
  lineas.sort((a, b) => ORDEN.indexOf(a.estado) - ORDEN.indexOf(b.estado))

  return {
    lineas,
    atrasadas: lineas.filter(l => l.estado === 'atrasado'),
    noInterpretables: lineas.filter(l => l.estado === 'horario_no_interpretable'),
    omisiones: lineas.flatMap(l =>
      l.omisiones.map(o => ({ indicacionId: l.indicacionId, descripcion: l.descripcion, omision: o }))),
  }
}
