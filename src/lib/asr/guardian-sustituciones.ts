/**
 * GUARDIÁN DE SUSTITUCIONES — compara el CRUDO contra el CORREGIDO.
 *
 * ── EL AGUJERO QUE CIERRA ────────────────────────────────────────────────────
 *
 * El 30-jul-2026, midiendo el corpus de 498 audios, se descubrió que **nuestro
 * propio corrector se comía las dosis**: «Meropenem dos gramos» salía como
 * «Meropenem gramos». Pasaba en producción, en cada dictado, y **nada lo
 * detectaba** — el corrector anotaba su cambio en `cambios[]` y nadie lo miraba.
 *
 * REG-065 arregló ESA causa concreta (dos guardas dentro de `corregirNGramas`).
 * Este módulo cierra **la clase entera**: da igual qué regla del corrector
 * produzca el cambio; si el resultado pierde una cifra, cambia una unidad,
 * intercambia una sigla crítica, voltea una negación o cambia el lado del
 * paciente, **se descarta la corrección y se conserva lo que dijo el médico**.
 *
 * La diferencia importa: REG-065 es acordarse de un caso; esto es que la clase
 * no pueda volver a pasar sin que alguien lo vea.
 *
 * ── QUÉ HACE, EXACTAMENTE ────────────────────────────────────────────────────
 *
 * NO corrige, NO transcribe, NO adivina. Recibe dos textos —lo que llegó del
 * reconocedor y lo que el corrector produjo— y decide si el segundo es
 * aceptable. Si no lo es, devuelve el PRIMERO y explica por qué.
 *
 * Ante la duda se queda con el crudo: el texto del médico sin tocar vale más que
 * una mejora que no se puede verificar.
 *
 * Módulo PURO.
 */

import {
  PARES_PROHIBIDOS, type ClaseErrorCritico, type ParProhibido,
} from '@/lib/asr/politica-critica'
import {
  AUSENCIA, NIEGA_EXPLICITO, NO_MAS_VERBO, NO_SE_EXPLORA, NUNCA, SIN_SUELTO, unir,
} from '@/lib/expediente/negadores'

export interface Violacion {
  clase: ClaseErrorCritico
  /** Lo que decía el crudo. */
  antes: string
  /** Lo que el corrector puso. `—` si desapareció. */
  despues: string
  /** Frase para la pantalla. */
  mensaje: string
}

export interface Veredicto {
  /** El texto que debe usarse. Si hubo violación, es el CRUDO. */
  texto: string
  /** `true` si se descartó la corrección. */
  revertido: boolean
  violaciones: Violacion[]
  /**
   * Cifras que el corrector AÑADIÓ. No revierten —añadir no borra una dosis—
   * pero se reportan: casi siempre vienen de un nombre de laboratorio canónico
   * («CA 125», «COVID-19») y conviene poder verlo.
   */
  cifrasAgregadas: string[]
  /** Para la pantalla: hay que preguntarle al médico. */
  requiereConfirmacion: boolean
}

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/**
 * Cifras «libres» del texto: las que expresan una cantidad, no las que forman
 * parte de un nombre.
 *
 * Se excluyen los dígitos pegados a una letra o a un guion, porque ésos son
 * nombres, no cantidades: `T4`, `CD4`, `HbA1c`, `H1N1`, `PaO2`, `cmH2O`,
 * `COVID-19`, `IL-6`, `CA 19-9`, `5-FU`. El corrector introduce esos dígitos
 * legítimamente al canonizar un término, y confundirlos con una dosis haría que
 * el guardián revirtiera correcciones buenas.
 *
 * Sí se conservan `2`, `0.5`, `2 g`, `48,000` y `50%`.
 */
export function cifrasLibres(texto: string): string[] {
  const out: string[] = []
  const re = /\d+(?:[.,]\d+)*/g
  let m: RegExpExecArray | null
  while ((m = re.exec(texto)) !== null) {
    const antes = texto[m.index - 1] ?? ' '
    const despues = texto[m.index + m[0].length] ?? ' '
    if (/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\-]/.test(antes)) continue   // T4, CD4, COVID-19
    if (/[\-]/.test(despues)) continue                     // CA 19-9, 5-FU
    out.push(m[0].replace(',', '.'))
  }
  return out
}

/** Resta de multiconjuntos: qué hay en `a` que no esté en `b`. */
function faltantes(a: string[], b: string[]): string[] {
  const resto = [...b]
  const out: string[] = []
  for (const x of a) {
    const i = resto.indexOf(x)
    if (i === -1) out.push(x)
    else resto.splice(i, 1)
  }
  return out
}

/**
 * Cuántas veces aparece el término, como término completo.
 *
 * Se cuenta, no se pregunta si está. Con presencia sola, «PEEP 12, PIP 30» →
 * «PIP 12, PIP 30» pasaba desapercibido: PIP ya estaba antes y PEEP simplemente
 * dejaba de estar en una frase donde ambos convivían. Contar lo ve.
 *
 * El borde no puede ser `\b`: las unidades llevan barra («/h», «mL/min») y las
 * siglas llevan dígitos. Y sólo se exige del lado donde el término empieza o
 * acaba en letra o dígito — si no, «/h» nunca se encontraría dentro de «mL/h»,
 * que es justo donde vive. El borde también evita que «CVVH» se cuente dentro
 * de «CVVHDF».
 */
function contar(texto: string, termino: string): number {
  const crudo = norm(termino)
  const t = crudo.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
  const ini = /^[a-z0-9]/.test(crudo) ? '(?:^|[^a-z0-9])' : ''
  const fin = /[a-z0-9]$/.test(crudo) ? '(?=$|[^a-z0-9])' : ''
  // El borde final es lookahead para no comerse el separador entre dos
  // apariciones seguidas («mg mg»).
  return (norm(texto).match(new RegExp(`${ini}${t}${fin}`, 'g')) ?? []).length
}

/**
 * El vocabulario se comparte con los otros tres sitios que leen negaciones (ver
 * `negadores.ts`); aquí sólo se compone. Este guardián es el único que necesita
 * `NO_SE_EXPLORA`: vigila texto de exploración, donde «no se palpa» es la forma
 * habitual de negar.
 *
 * **Los bordes se quedan aquí**: `(^|\s)…(\s|$)` en vez de `\b`, porque el
 * guardián trabaja sobre texto ya normalizado y le importa la palabra entera.
 */
const NEGADORES = new RegExp(
  `(^|\\s)(?:${unir(NIEGA_EXPLICITO, NO_MAS_VERBO, NO_SE_EXPLORA, NUNCA, AUSENCIA, SIN_SUELTO)})(\\s|$)`,
)
const DERECHA = /(^|\s)(derecho|derecha)(\s|[.,;:]|$)/
const IZQUIERDA = /(^|\s)(izquierdo|izquierda)(\s|[.,;:]|$)/
const BILATERAL = /(^|\s)bilateral(es)?(\s|[.,;:]|$)/

/**
 * ¿La corrección cambió algo que NUNCA debe cambiar?
 *
 * @param crudo lo que devolvió el reconocedor, sin tocar.
 * @param corregido lo que produjo el corrector léxico.
 */
export function verificar(crudo: string, corregido: string): Veredicto {
  const violaciones: Violacion[] = []

  // ── 1. CIFRAS ──────────────────────────────────────────────────────────
  // Perder una cifra es el fallo de REG-065. Un corrector léxico no tiene
  // ninguna razón legítima para hacer desaparecer una cantidad.
  const nCrudo = cifrasLibres(crudo), nCorr = cifrasLibres(corregido)
  const perdidas = faltantes(nCrudo, nCorr)
  const cifrasAgregadas = faltantes(nCorr, nCrudo)
  if (perdidas.length > 0) {
    violaciones.push({
      clase: 'cambio_dosis',
      antes: perdidas.join(' '), despues: '—',
      mensaje: `La corrección hizo desaparecer ${perdidas.length === 1 ? 'la cifra' : 'las cifras'} `
        + `«${perdidas.join('», «')}». Una cantidad perdida es una orden rota.`,
    })
  }

  // ── 2. PARES PROHIBIDOS ────────────────────────────────────────────────
  violaciones.push(...terminosCriticosPerdidos(crudo, corregido))

  // ── 3. NEGACIÓN ────────────────────────────────────────────────────────
  const negCrudo = NEGADORES.test(norm(crudo)), negCorr = NEGADORES.test(norm(corregido))
  if (negCrudo !== negCorr) {
    violaciones.push({
      clase: 'volteo_negacion',
      antes: negCrudo ? 'negado' : 'afirmado',
      despues: negCorr ? 'negado' : 'afirmado',
      mensaje: 'La negación cambió de sentido. «Niega dolor torácico» y «dolor '
        + 'torácico» dicen cosas opuestas del paciente.',
    })
  }

  // ── 4. LATERALIDAD ─────────────────────────────────────────────────────
  const lado = (t: string) => {
    const n = norm(t)
    return { d: DERECHA.test(n), i: IZQUIERDA.test(n), b: BILATERAL.test(n) }
  }
  const lc = lado(crudo), lk = lado(corregido)
  if (lc.d !== lk.d || lc.i !== lk.i || lc.b !== lk.b) {
    const desc = (l: { d: boolean; i: boolean; b: boolean }) =>
      [l.d && 'derecho', l.i && 'izquierdo', l.b && 'bilateral'].filter(Boolean).join(' + ') || '—'
    violaciones.push({
      clase: 'cambio_lateralidad',
      antes: desc(lc), despues: desc(lk),
      mensaje: 'La lateralidad cambió. Es el lado del paciente.',
    })
  }

  const unicas = dedup(violaciones)
  return {
    // Ante la duda, el crudo.
    texto: unicas.length > 0 ? crudo : corregido,
    revertido: unicas.length > 0,
    violaciones: unicas,
    cifrasAgregadas,
    requiereConfirmacion: unicas.length > 0,
  }
}

/**
 * Una misma sustitución la ven varias reglas a la vez (derecha↔izquierda está en
 * los pares Y en el bloque de lateralidad). El médico no necesita leerlo dos veces.
 */
function dedup(vs: Violacion[]): Violacion[] {
  const vistas = new Set<string>()
  const out: Violacion[] = []
  for (const v of vs) {
    const k = v.clase === 'cambio_lateralidad' ? 'lateralidad' : `${v.clase}|${v.antes}|${v.despues}`
    if (vistas.has(k)) continue
    vistas.add(k)
    out.push(v)
  }
  return out
}

/**
 * Términos críticos que el corrector hizo desaparecer.
 *
 * Aparecer NO es violación: que el corrector escriba «CVVHDF» donde el
 * reconocedor puso «cbvhdf» es exactamente su trabajo. Lo que se vigila es la
 * dirección contraria — que un término crítico presente en el crudo **salga
 * menos veces** de las que entró.
 *
 * Se cuenta por término y no por par porque un mismo término puede estar en
 * varios pares (`cvvhd` está en dos) y porque el caso real que se escapó
 * —«PEEP 12, PIP 30» → «PIP 12, PIP 30»— tiene los dos miembros presentes antes
 * y después: sólo la cuenta lo delata.
 */
function terminosCriticosPerdidos(crudo: string, corregido: string): Violacion[] {
  const out: Violacion[] = []
  const delta = new Map<string, number>()   // término → cuánto cambió su cuenta
  const parDe = new Map<string, ParProhibido>()

  for (const p of PARES_PROHIBIDOS) {
    for (const t of [p.a, p.b]) {
      if (!delta.has(t)) delta.set(t, contar(corregido, t) - contar(crudo, t))
      if (!parDe.has(t)) parDe.set(t, p)
    }
  }

  for (const [termino, d] of delta) {
    if (d >= 0) continue                    // no se perdió ninguna aparición
    const p = parDe.get(termino)!
    // ¿A quién se convirtió? Al compañero de par que ganó apariciones.
    const socios = PARES_PROHIBIDOS
      .filter(q => q.a === termino || q.b === termino)
      .map(q => (q.a === termino ? q.b : q.a))
    const culpable = socios.find(s => (delta.get(s) ?? 0) > 0)

    out.push(culpable
      ? { clase: (PARES_PROHIBIDOS.find(q =>
            (q.a === termino && q.b === culpable) || (q.b === termino && q.a === culpable))
          ?? p).clase,
          antes: termino, despues: culpable,
          mensaje: `«${termino}» se convirtió en «${culpable}». ${p.consecuencia}` }
      : { clase: p.clase, antes: termino, despues: '—',
          mensaje: `Se perdió «${termino}». ${p.consecuencia}` })
  }
  return out
}

export const POR_QUE_SE_REVIERTE =
  'Cuando una corrección toca una cifra, una unidad, una sigla crítica, una ' +
  'negación o la lateralidad, se descarta la corrección y se conserva lo que dijo ' +
  'el médico. Una mejora que no se puede verificar vale menos que el texto original.'
