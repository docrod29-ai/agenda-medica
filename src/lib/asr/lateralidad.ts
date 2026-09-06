/**
 * LATERALIDAD — el lado del paciente, cotejado de forma DETERMINISTA.
 *
 * ── EL HUECO (Panel de Lujo, MO-001 y MO-002, ortopedista; P2 confirmados) ───
 *
 * «Esguince de tobillo izquierdo… solicito radiografía de tobillo derecho…
 * perdón, izquierdo.» El pipeline ASR no toca esas palabras (están en la lista
 * protegida del corrector) y el guardián sólo compara crudo contra corregido:
 * una contradicción DENTRO del propio dictado nunca disparaba
 * `lateralidad_incierta`, porque su único emisor era el corrector, y el
 * corrector no cambia esas palabras. El motivo estaba prácticamente muerto.
 *
 * Y de la nota tampoco nadie cotejaba el lado contra el dictado: lo decidía el
 * modelo de lenguaje, y la única defensa era que el médico abriera «¿de dónde
 * salió esto?» y oyera el segundo.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * clinical-safety §6: ante ambigüedad crítica —y la lateralidad lo es— la
 * interfaz PREGUNTA. Este módulo no decide cuál lado es el correcto: detecta
 * que hay dos, o que hubo una retractación, y lo dice. Y respeta la decisión
 * del Dr. de que la compuerta no bloquee la firma (PL-C13: «un detector barato
 * que pregunta, no bloquea»).
 *
 * ── QUÉ HACE ─────────────────────────────────────────────────────────────────
 *
 * 1. `contradiccionesDeLateralidad(dictado)`: por frase y por región
 *    anatómica, encuentra (a) la misma región con los dos lados, (b) dos lados
 *    en una misma frase sin regiones distintas, (c) una retractación («perdón»,
 *    «digo», «corrijo», «mejor dicho») pegada a un lado.
 * 2. `verificarLateralidad(dictado, nota)`: para cada región con lado en la
 *    NOTA, compara contra la ÚLTIMA lateralidad dictada para esa región. Si
 *    difieren, o si la nota afirma un lado que el dictado nunca dio, lo
 *    reporta. Es lo que CONSULTA corre antes de firmar.
 *
 * ── LO QUE NO CUBRE (regla 5: señalar de menos, nunca de más) ────────────────
 *
 * `REGIONES` es VOCABULARIO, no criterio: una región que no esté ahí no se
 * vigila — no se da por buena. No cubre lateralidad dicha sólo con gestos o por
 * el paciente («me duele éste»), ni regiones sin lado (columna). Y no decide
 * cuál lado es el correcto: eso es del médico.
 *
 * Módulo PURO.
 */

export type Lado = 'derecho' | 'izquierdo' | 'bilateral'

const norm = (s: string) => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * Regiones anatómicas con lado. Cada entrada: nombre canónico y la raíz con
 * la que se reconoce (singular y plural, con o sin acento, ya normalizado).
 *
 * Es una lista de VOCABULARIO. Que falte una región significa que ese caso NO
 * se vigila; se declara aquí para que nadie crea lo contrario.
 */
export const REGIONES: readonly { canonica: string; patron: RegExp }[] = [
  { canonica: 'ojo', patron: /\bojos?\b/ },
  { canonica: 'oído', patron: /\boidos?\b|\borejas?\b/ },
  { canonica: 'hombro', patron: /\bhombros?\b/ },
  { canonica: 'clavícula', patron: /\bclaviculas?\b/ },
  { canonica: 'brazo', patron: /\bbrazos?\b|\bhumeros?\b/ },
  { canonica: 'codo', patron: /\bcodos?\b/ },
  { canonica: 'antebrazo', patron: /\bantebrazos?\b|\bradios?\b|\bcubitos?\b/ },
  { canonica: 'muñeca', patron: /\bmunecas?\b/ },
  { canonica: 'mano', patron: /\bmanos?\b/ },
  { canonica: 'dedo', patron: /\bdedos?\b|\bpulgar(es)?\b/ },
  { canonica: 'mama', patron: /\bmamas?\b|\bsenos?\b/ },
  { canonica: 'hemitórax', patron: /\bhemitorax\b|\bpulmon(es)?\b|\bpleural?\b/ },
  { canonica: 'riñón', patron: /\brinon(es)?\b|\brenal\b/ },
  { canonica: 'flanco', patron: /\bflancos?\b|\bfosa iliaca\b|\bhipocondrios?\b/ },
  { canonica: 'ingle', patron: /\bingles?\b|\binguinal(es)?\b/ },
  { canonica: 'cadera', patron: /\bcaderas?\b/ },
  { canonica: 'muslo', patron: /\bmuslos?\b|\bfemur(es)?\b|\bfemoral(es)?\b/ },
  { canonica: 'rodilla', patron: /\brodillas?\b/ },
  { canonica: 'pierna', patron: /\bpiernas?\b|\bpantorrillas?\b|\btibias?\b|\bperones?\b/ },
  { canonica: 'tobillo', patron: /\btobillos?\b|\bmaleolos?\b/ },
  { canonica: 'pie', patron: /\bpies?\b|\btalon(es)?\b/ },
  { canonica: 'miembro superior', patron: /\bmiembros? superior(es)?\b|\bextremidad(es)? superior(es)?\b/ },
  { canonica: 'miembro inferior', patron: /\bmiembros? inferior(es)?\b|\bextremidad(es)? inferior(es)?\b/ },
  { canonica: 'hemicuerpo', patron: /\bhemicuerpo\b|\bhemicara\b/ },
  { canonica: 'testículo', patron: /\btesticulos?\b/ },
  { canonica: 'ovario', patron: /\bovarios?\b|\banexos?\b/ },
]

const LADO = /\b(derech[oa]s?|izquierd[oa]s?|bilateral(es)?)\b/g

/** Marcas de que el médico se está corrigiendo a sí mismo. */
export const RETRACTACION = /\b(perdon|corrijo|rectifico|mejor dicho|quise decir)\b|(?:^|,)\s*digo\b|\bdigo,|\bno,\s*(?:el|la|los|las)?\s*(?:derech|izquierd)/

function ladoDe(palabra: string): Lado {
  const p = norm(palabra)
  if (p.startsWith('derech')) return 'derecho'
  if (p.startsWith('izquierd')) return 'izquierdo'
  return 'bilateral'
}

/** Partición por frases: punto, coma fuerte, punto y coma, salto de línea. */
export function frasesDe(texto: string): string[] {
  return norm(texto).split(/[.;\n!?]+/).map(f => f.trim()).filter(Boolean)
}

export interface MencionDeLado {
  lado: Lado
  /** Región canónica más cercana dentro de la misma frase; `null` si no hay. */
  region: string | null
  frase: string
  /** Índice de la frase en el texto, para saber qué se dijo después. */
  indiceFrase: number
  /** La frase trae una marca de retractación. */
  conRetractacion: boolean
}

/**
 * Las menciones de lado del texto, con la región a la que van pegadas.
 *
 * La región es la que está MÁS CERCA de la palabra de lado dentro de la frase
 * (antes o después): en «radiografía de tobillo derecho» el tobillo va antes;
 * en «derecho el tobillo» va después. Si una frase tiene varias regiones, cada
 * lado se asigna a la suya.
 */
export function mencionesDeLado(texto: string): MencionDeLado[] {
  const out: MencionDeLado[] = []
  frasesDe(texto).forEach((frase, indiceFrase) => {
    const regiones: { canonica: string; pos: number }[] = []
    for (const r of REGIONES) {
      const re = new RegExp(r.patron.source, 'g')
      let m: RegExpExecArray | null
      while ((m = re.exec(frase)) !== null) regiones.push({ canonica: r.canonica, pos: m.index })
    }
    const conRetractacion = RETRACTACION.test(frase)
    let l: RegExpExecArray | null
    const re = new RegExp(LADO.source, 'g')
    while ((l = re.exec(frase)) !== null) {
      const pos = l.index
      let mejor: { canonica: string; pos: number } | null = null
      for (const r of regiones) {
        if (!mejor || Math.abs(r.pos - pos) < Math.abs(mejor.pos - pos)) mejor = r
      }
      out.push({ lado: ladoDe(l[0]), region: mejor?.canonica ?? null, frase, indiceFrase, conRetractacion })
    }
  })
  return out
}

export interface ContradiccionDeLado {
  region: string | null
  lados: Lado[]
  /** Hubo «perdón / corrijo / digo» junto al lado: el médico se retractó. */
  retractacion: boolean
  /** La ÚLTIMA lateralidad dictada para esa región: lo que manda si hubo retractación. */
  ultima: Lado
  frase: string
}

/**
 * Contradicciones de lado dentro del dictado.
 *
 * Tres formas, y las tres preguntan:
 *  (a) la misma región lleva dos lados en el dictado;
 *  (b) una frase lleva dos lados distintos sin dos regiones que los separen;
 *  (c) una retractación pegada a un lado, aunque la región no se repita.
 */
export function contradiccionesDeLateralidad(dictado: string): ContradiccionDeLado[] {
  const menciones = mencionesDeLado(dictado)
  const out: ContradiccionDeLado[] = []
  const vistas = new Set<string>()
  const emitir = (c: ContradiccionDeLado) => {
    const k = `${c.region ?? '?'}|${c.lados.join(',')}|${c.retractacion}`
    if (vistas.has(k)) return
    vistas.add(k); out.push(c)
  }

  // (a) por región
  const porRegion = new Map<string, MencionDeLado[]>()
  for (const m of menciones) {
    if (!m.region) continue
    const l = porRegion.get(m.region) ?? []
    l.push(m); porRegion.set(m.region, l)
  }
  for (const [region, ms] of porRegion) {
    const lados = [...new Set(ms.map(m => m.lado))]
    if (lados.length > 1) {
      emitir({
        region, lados, retractacion: ms.some(m => m.conRetractacion),
        ultima: ms[ms.length - 1].lado, frase: ms[ms.length - 1].frase,
      })
    }
  }

  // (b) y (c) por frase
  const porFrase = new Map<number, MencionDeLado[]>()
  for (const m of menciones) {
    const l = porFrase.get(m.indiceFrase) ?? []
    l.push(m); porFrase.set(m.indiceFrase, l)
  }
  for (const ms of porFrase.values()) {
    const lados = [...new Set(ms.map(m => m.lado))]
    const regiones = new Set(ms.map(m => m.region).filter(Boolean))
    const sinRegionesDistintas = regiones.size <= 1
    const retractacion = ms.some(m => m.conRetractacion)
    if ((lados.length > 1 && sinRegionesDistintas) || retractacion) {
      emitir({
        region: ms[0].region, lados, retractacion,
        ultima: ms[ms.length - 1].lado, frase: ms[0].frase,
      })
    }
  }
  return out
}

/** La última lateralidad dictada por región (lo que manda tras una retractación). */
export function ultimaLateralidadPorRegion(dictado: string): Map<string, Lado> {
  const m = new Map<string, Lado>()
  for (const x of mencionesDeLado(dictado)) if (x.region) m.set(x.region, x.lado)
  return m
}

export interface DiscrepanciaDeLado {
  region: string
  /** Lo último que se dictó para esa región; `null` si el dictado no le dio lado. */
  enDictado: Lado | null
  enNota: Lado
  motivo: 'lado_distinto' | 'lado_sin_respaldo'
}

export interface VerificacionDeLateralidad {
  discrepancias: DiscrepanciaDeLado[]
  contradiccionesDelDictado: ContradiccionDeLado[]
  /** Regiones de la nota que SÍ se cotejaron (vocabulario: lo demás no se vigila). */
  regionesCotejadas: string[]
  ok: boolean
}

/**
 * Coteja la lateralidad de la NOTA contra la del DICTADO, región por región.
 *
 * No decide cuál es el lado correcto: dice dónde no coinciden. Lo que manda
 * en el dictado es la ÚLTIMA mención para esa región, porque «perdón,
 * izquierdo» se dice después de «derecho».
 */
export function verificarLateralidad(dictado: string, nota: string): VerificacionDeLateralidad {
  const ultima = ultimaLateralidadPorRegion(dictado)
  const discrepancias: DiscrepanciaDeLado[] = []
  const regionesCotejadas = new Set<string>()
  const vistas = new Set<string>()
  for (const m of mencionesDeLado(nota)) {
    if (!m.region) continue
    regionesCotejadas.add(m.region)
    const k = `${m.region}|${m.lado}`
    if (vistas.has(k)) continue
    vistas.add(k)
    const dictada = ultima.get(m.region) ?? null
    if (dictada === null) {
      discrepancias.push({ region: m.region, enDictado: null, enNota: m.lado, motivo: 'lado_sin_respaldo' })
    } else if (dictada !== m.lado) {
      discrepancias.push({ region: m.region, enDictado: dictada, enNota: m.lado, motivo: 'lado_distinto' })
    }
  }
  const contradiccionesDelDictado = contradiccionesDeLateralidad(dictado)
  return {
    discrepancias,
    contradiccionesDelDictado,
    regionesCotejadas: [...regionesCotejadas],
    ok: discrepancias.length === 0 && contradiccionesDelDictado.length === 0,
  }
}

/** Texto para la pantalla: qué se dictó y qué quedó escrito. */
export function describirDiscrepancia(d: DiscrepanciaDeLado): string {
  return d.motivo === 'lado_sin_respaldo'
    ? `La nota dice «${d.region} ${d.enNota}» y en el dictado no se oyó el lado de ${d.region}.`
    : `La nota dice «${d.region} ${d.enNota}» y lo último que se dictó fue «${d.region} ${d.enDictado}».`
}

export const POR_QUE_NO_DECIDE_EL_LADO =
  'El detector no sabe cuál lado es el correcto: sabe que hubo dos, o que el ' +
  'médico se corrigió. Elegir uno sería tomar una decisión clínica con una ' +
  'regla de texto. Se pregunta, no se adivina; y por decisión del Dr. no bloquea la firma.'
