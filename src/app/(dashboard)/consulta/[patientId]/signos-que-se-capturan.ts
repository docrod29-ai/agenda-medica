/**
 * LO QUE SE TECLEA EN SIGNOS VITALES — lectura, unidad y plausibilidad.
 *
 * ── QUÉ FALLABA (Panel de Lujo 2026-09) ─────────────────────────────────────
 *
 * · ASN-005 — el campo se tragaba la unidad tecla a tecla: «154 lb» quedaba
 *   «154» y viajaba como kilos a la verificación mg/kg. La única validación era
 *   sintáctica (`/^\d*\.?\d*$/`) y lo que no casaba se descartaba EN SILENCIO,
 *   que es justo lo que prohíbe seguridad clínica §3.
 * · ASN-002 — TA 400/300, T 45 °C y SpO₂ 9 % se aceptaban, se guardaban y el
 *   copiloto los trataba como hipotensión e hipoxemia REALES. Nadie preguntaba
 *   «¿lo capturaste bien?».
 *
 * ── DE DÓNDE SALEN LOS NÚMEROS (y de dónde NO) ──────────────────────────────
 *
 * Ninguna cifra se inventa aquí. Cada rango se copia de donde YA vivía en este
 * repositorio, con su procedencia al lado:
 *
 *   · pas, pad, fr, spo2, temperatura → `RANGOS_UCI` (src/lib/uci/extraccion.ts),
 *     los topes fisiológicos duros con los que la voz de UCI decide no prellenar
 *     un valor (REG-031/REG-036). No se importan porque esa constante no se
 *     exporta y ese archivo es de otra rebanada; se copian con su origen escrito.
 *   · peso, talla → `pesoAKg` y `tallaACm` (src/lib/expediente/parser-clinico.ts),
 *     que son los que ya usa el extractor de signos del dictado. Los de UCI NO
 *     sirven aquí: su banda de peso empieza en 20 kg y en el consultorio hay
 *     lactantes.
 *   · frecuencia cardiaca → **NO HAY**. `NEEDS_CLINICAL_REVIEW`: el rango de FC
 *     por edad lo fija el dueño (la pregunta ya está abierta en
 *     `registry.ts:1293`). Mientras no exista, la FC **no se vigila** y esto lo
 *     dice en voz alta (`SIN_RANGO_DECLARADO`), porque que falte un rango
 *     significa que ese caso no se mira — no que se dé por bueno
 *     (clinical-safety §5).
 *
 * ── QUÉ HACE Y QUÉ NO ───────────────────────────────────────────────────────
 *
 * Pregunta, no corrige, no bloquea: devuelve un aviso para que la pantalla lo
 * enseñe y el médico confirme o rectifique. El valor tecleado se conserva tal
 * cual — nada cambia en silencio, y ninguna de estas bandas es criterio clínico.
 *
 * Módulo PURO: sin React, sin red, sin estado.
 */

/** Clave de cada signo, tal como la guarda `SignosVitales`. */
export type ClaveSigno = 'ta' | 'fc' | 'fr' | 'temperatura' | 'spo2' | 'peso' | 'talla'

/** Unidad con la que el médico decide TECLEAR el peso. Se guarda siempre en kg. */
export type UnidadDePeso = 'kg' | 'lb'

/**
 * Bandas de lo POSIBLE (no de lo normal). Fuera de ellas se pregunta; dentro no
 * se afirma nada. Cada una con el sitio del repositorio de donde se copió.
 */
export const RANGOS_PLAUSIBLES: Readonly<Record<string, readonly [number, number, string]>> = Object.freeze({
  pas: [30, 300, 'RANGOS_UCI (src/lib/uci/extraccion.ts)'],
  pad: [10, 200, 'RANGOS_UCI (src/lib/uci/extraccion.ts)'],
  fr: [0, 80, 'RANGOS_UCI (src/lib/uci/extraccion.ts)'],
  spo2: [40, 100, 'RANGOS_UCI (src/lib/uci/extraccion.ts)'],
  temperatura: [24, 43, 'RANGOS_UCI (src/lib/uci/extraccion.ts)'],
  peso: [0.3, 400, 'pesoAKg (src/lib/expediente/parser-clinico.ts)'],
  talla: [20, 250, 'tallaACm (src/lib/expediente/parser-clinico.ts)'],
})

/**
 * Signos que HOY NO SE VIGILAN porque no existe una banda con procedencia.
 * Se declara para que la pantalla pueda decirlo (clinical-safety §5).
 */
export const SIN_RANGO_DECLARADO: readonly ClaveSigno[] = Object.freeze(['fc'] as ClaveSigno[])

export const POR_QUE_LA_FC_NO_SE_VIGILA =
  'La frecuencia cardiaca no se revisa: el rango por edad todavía no lo ha fijado ' +
  'el médico responsable (NEEDS_CLINICAL_REVIEW). Que no aparezca un aviso aquí no ' +
  'quiere decir que el número esté bien.'

/** Un aviso de captura: se enseña, no bloquea, y nunca cambia el valor. */
export interface AvisoDeCaptura {
  campo: ClaveSigno
  /** Lo que se leyó, tal como quedó en el campo. */
  valor: string
  texto: string
  /** `true` si además hay una acción obvia que ofrecer (cambiar la unidad). */
  sugiereLibras?: boolean
  sugiereMetros?: boolean
}

/**
 * Un número, o `null`. Vacío es `null` y NO cero: `Number('')` vale 0, y con eso
 * un campo sin capturar caía fuera de toda banda y producía un aviso fantasma —
 * señalar de más apaga la compuerta igual de rápido que no señalar.
 */
const NUM = (v: unknown): number | null => {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const t = String(v).trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/**
 * ¿El número cae fuera de lo posible? `null` = no hay nada que decir (sin valor,
 * dentro de banda, o sin banda con procedencia).
 */
export function fueraDeLoPosible(campo: string, valor: unknown): string | null {
  const r = RANGOS_PLAUSIBLES[campo]
  const n = NUM(valor)
  if (!r || n === null) return null
  const [min, max] = r
  if (n >= min && n <= max) return null
  return `${n}: fuera de lo habitual (lo posible va de ${min} a ${max}). Confírmalo o corrígelo — se guarda tal como lo tecleaste.`
}

/** La TA se teclea como texto «120/80»: se parte y se revisan las dos cifras. */
export function avisosDeTensionArterial(ta: unknown): string[] {
  const t = String(ta ?? '').trim()
  if (!t) return []
  const m = t.match(/^(\d{1,3})\s*\/\s*(\d{1,3})$/)
  if (!m) return []
  const out: string[] = []
  const sis = fueraDeLoPosible('pas', m[1])
  const dia = fueraDeLoPosible('pad', m[2])
  if (sis) out.push(`Sistólica ${sis}`)
  if (dia) out.push(`Diastólica ${dia}`)
  if (!sis && !dia && Number(m[1]) <= Number(m[2])) {
    out.push(`Sistólica ${m[1]} y diastólica ${m[2]}: la sistólica no puede ser menor que la diastólica. Confírmalo.`)
  }
  return out
}

/**
 * LO QUE SE TECLEÓ, Y LO QUE SE DESCARTÓ AL LEERLO.
 *
 * Devuelve el número en construcción (se conserva el punto decimal a medio
 * teclear) y, si hubo que quitar algo, QUÉ se quitó — para poder decirlo.
 * `null` en `valor` significa «esta tecla no se acepta»: el campo se queda como
 * estaba, igual que antes, pero ahora con motivo.
 */
export function leerCifraTecleada(bruto: string): { valor: string | null; descartado: string } {
  const v = bruto.replace(',', '.')
  if (v === '') return { valor: '', descartado: '' }
  if (/^\d*\.?\d*$/.test(v)) return { valor: v, descartado: '' }
  const limpio = v.replace(/[^\d.]/g, '')
  const sobra = v.replace(/[\d.]/g, '').trim()
  // Más de un punto, o nada numérico: la tecla no entra y no se inventa nada.
  if (!/^\d*\.?\d*$/.test(limpio) || limpio === '') return { valor: null, descartado: sobra }
  return { valor: limpio, descartado: sobra }
}

/** ¿Lo descartado era una unidad de peso en libras? («154 lb», «154 libras»). */
export function pareceLibras(descartado: string): boolean {
  return /^(lb|lbs|libras?)$/i.test(descartado.trim())
}

/** ¿Lo descartado era una unidad de kilos? («70 kg»). */
export function pareceKilos(descartado: string): boolean {
  return /^(kg|kgs|kilos?|kilogramos?)$/i.test(descartado.trim())
}

/**
 * Talla tecleada en METROS: el mismo criterio que ya usa `tallaACm` del parser
 * («sin unidad y ≤ 3 son metros»). Aquí no se convierte: se pregunta.
 */
export function tallaPareceEnMetros(valor: unknown): boolean {
  const n = NUM(valor)
  return n !== null && n > 0 && n <= 3
}

/**
 * Todos los avisos de captura de una hoja de signos. Orden estable: el de la TA
 * primero, luego los numéricos en el orden en que se pintan.
 */
export function avisosDeCaptura(signos: Record<string, unknown>): AvisoDeCaptura[] {
  const out: AvisoDeCaptura[] = []
  for (const t of avisosDeTensionArterial(signos.ta)) {
    out.push({ campo: 'ta', valor: String(signos.ta ?? ''), texto: t })
  }
  for (const k of ['fr', 'temperatura', 'spo2', 'peso', 'talla'] as ClaveSigno[]) {
    const aviso = fueraDeLoPosible(k, signos[k])
    if (aviso) out.push({ campo: k, valor: String(signos[k] ?? ''), texto: aviso })
  }
  if (tallaPareceEnMetros(signos.talla)) {
    out.push({
      campo: 'talla',
      valor: String(signos.talla ?? ''),
      texto: `Talla ${signos.talla}: el campo está en centímetros. ¿Querías decir metros?`,
      sugiereMetros: true,
    })
  }
  return out
}
