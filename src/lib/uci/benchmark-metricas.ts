/**
 * MÉTRICAS DEL BENCHMARK DE VOZ — corpus de 498 audios del Dr. (2026-07-30).
 *
 * Las seis que pidió, sobre `MANIFEST_498.csv`:
 *   WER · Clinical Term Recall · Acronym Recall · Number Accuracy ·
 *   Unit Accuracy · Critical Semantic Error Rate.
 *
 * ── EL PROBLEMA CENTRAL: EL GOLD NO ESTÁ ESCRITO COMO SE HABLA ───────────────
 *
 * El manifiesto dice `canonical_text` = «flujo de sangre **ciento cincuenta
 * mililitros por minuto**» y `key_terms` = «**150 mL/min**». Son el mismo dato
 * escrito de dos formas. Comparar literal daría 0 % de aciertos en TODOS los
 * números y unidades — un informe catastrófico y falso.
 *
 * Por eso hay una capa de equivalencia: número hablado ↔ dígito, unidad hablada
 * ↔ símbolo. **No es indulgencia**: es que «ciento cincuenta» y «150» son el
 * mismo hecho clínico, y el sistema aguas abajo extrae el número igual.
 *
 * ── LAS EQUIVALENCIAS SEMÁNTICAS SALEN DEL DOCUMENTO, NO DE MÍ ───────────────
 *
 * `PARA_CLAUDE.md` fija dos reglas explícitas y **sólo esas se aplican**:
 *
 *   · «CKRT → "terapia de reemplazo renal continua" puede contarse como
 *      equivalencia semántica si el concepto se conserva.»
 *   · «Perder o sustituir CVVHDF SÍ es error clínico.»
 *
 * No añado ninguna equivalencia por mi cuenta. Si el transcriptor cambia un
 * término por otro que a mí me parezca sinónimo, cuenta como fallo.
 *
 * ── QUÉ ES UN ERROR CRÍTICO ──────────────────────────────────────────────────
 *
 * También del documento: «Errores en cifras, dosis, signos o unidades deben
 * marcarse críticos». Un artículo perdido no lo es. La distinción es toda la
 * utilidad del informe: un WER de 8 % con la mitad de las dosis mal no es un
 * buen resultado, es un desastre bien maquillado.
 *
 * Módulo PURO.
 */

import { wer } from '@/lib/uci/benchmark-voz'

/**
 * Normalización PROPIA de este módulo: conserva la barra.
 *
 * La de `benchmark-voz` la quita —ahí sobra— pero aquí «mL/min» y «mL min» no
 * son lo mismo: los símbolos de unidad LLEVAN barra, y perderla convertía
 * «150 mL/min» en dos tokens que nunca casaban contra el texto canonizado. Se
 * detectó en el primer caso del golden, no en producción.
 */
function norm(s: string): string {
  return s
    .toLowerCase()
    // Separador de MILLAR en el término («48,000/uL»): se quita para poder
    // compararlo con el 48000 que produce «cuarenta y ocho mil». Sin esto era el
    // único término que mi evaluador no sabía comprobar.
    .replace(/(?<=\d),(?=\d{3}\b)/g, '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/(?<=\d)[.,](?=\d)/g, '\u0001')
    .replace(/[^\p{L}\p{N}\s/\u0001]/gu, ' ')
    .replace(/\u0001/g, '.')
    .replace(/\s+/g, ' ')
    .trim()
}

// ═══════════════════════════════════════════════════════════════════════
// Números hablados ↔ dígitos
// ═══════════════════════════════════════════════════════════════════════

const UNIDADES: Record<string, number> = {
  cero: 0, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13,
  catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18,
  diecinueve: 19, veinte: 20, veintiuno: 21, veintidos: 22, veintitres: 23,
  veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27,
  veintiocho: 28, veintinueve: 29,
}
const DECENAS: Record<string, number> = {
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60,
  setenta: 70, ochenta: 80, noventa: 90,
}
const CENTENAS: Record<string, number> = {
  cien: 100, ciento: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400,
  quinientos: 500, seiscientos: 600, setecientos: 700, ochocientos: 800,
  novecientos: 900,
  // Formas FEMENINAS: el corpus dice «tres mil doscientas revoluciones». Sin
  // ellas, «3200 rpm» no se formaba nunca.
  doscientas: 200, trescientas: 300, cuatrocientas: 400, quinientas: 500,
  seiscientas: 600, setecientas: 700, ochocientas: 800, novecientas: 900,
}

/**
 * Convierte los números escritos con letra de un texto a dígitos.
 *
 * Acumula «ciento cincuenta» → 150 y «uno punto ocho» → 1.8. Lo que no encaja
 * se deja tal cual: **no se inventa un número donde no lo había**.
 */
export function numerosADigitos(texto: string): string {
  // Se tokeniza con la normalización de ESTE módulo: la de `benchmark-voz`
  // quita la barra y «150 mL/min» perdía su unidad antes de compararse.
  const ws = norm(texto).split(' ').filter(w => w !== '')
  const out: string[] = []
  let acc: number | null = null

  const cerrar = () => { if (acc !== null) { out.push(String(acc)); acc = null } }

  for (let i = 0; i < ws.length; i++) {
    const w = ws[i]
    if (w === 'y' && acc !== null && i + 1 < ws.length && (DECENAS[ws[i + 1]] || UNIDADES[ws[i + 1]] !== undefined)) continue
    if (w === 'punto' && acc !== null && (UNIDADES[ws[i + 1]] !== undefined || DECENAS[ws[i + 1]] !== undefined)) {
      /**
       * «uno punto ocho» → 1.8 y «cero punto treinta» → 0.30.
       *
       * La primera versión sólo aceptaba UNIDADES tras el punto, así que «cero
       * punto treinta milimoles» nunca formaba el 0.30 y el término se contaba
       * como perdido. Lo encontró el modo simulado, con transcripción perfecta.
       */
      const dec: string[] = []
      let j = i + 1
      while (j < ws.length && (UNIDADES[ws[j]] !== undefined || DECENAS[ws[j]] !== undefined)) {
        dec.push(String(UNIDADES[ws[j]] ?? DECENAS[ws[j]])); j++
      }
      out.push(`${acc}.${dec.join('')}`)
      acc = null; i = j - 1
      continue
    }
    if (CENTENAS[w] !== undefined) { acc = (acc ?? 0) + CENTENAS[w]; continue }
    if (DECENAS[w] !== undefined) { acc = (acc ?? 0) + DECENAS[w]; continue }
    if (UNIDADES[w] !== undefined) { acc = (acc ?? 0) + UNIDADES[w]; continue }
    if (w === 'mil') {
      // «cuarenta y ocho mil» → 48000; «mil» solo → 1000.
      acc = (acc ?? 1) * 1000
      // Lo que venga después se SUMA: «tres mil doscientas» → 3200.
      continue
    }
    cerrar()
    out.push(w)
  }
  cerrar()
  return out.join(' ')
}

// ═══════════════════════════════════════════════════════════════════════
// Unidades habladas ↔ símbolo
// ═══════════════════════════════════════════════════════════════════════

/**
 * Formas habladas de cada unidad. La clave es como aparece en `key_terms`.
 * Sólo se listan las que este corpus usa.
 */
export const UNIDADES_HABLADAS: Readonly<Record<string, readonly string[]>> = {
  'ml/min': ['mililitros por minuto', 'mililitro por minuto', 'ml por minuto'],
  'ml/h': ['mililitros por hora', 'mililitro por hora', 'ml por hora'],
  'ml/kg': ['mililitros por kilo', 'mililitros por kilogramo'],
  'ml/kg/h': ['mililitros por kilo por hora', 'mililitros kilo hora'],
  'l/min': ['litros por minuto', 'litro por minuto'],
  'mcg/kg/min': ['microgramos por kilo por minuto', 'microgramos kilo minuto',
    'microgramo por kilo por minuto', 'mcg por kilo por minuto'],
  'mg/dl': ['miligramos por decilitro', 'miligramos sobre decilitro'],
  'mmol/l': ['milimoles por litro', 'milimol por litro'],
  'meq/l': ['miliequivalentes por litro'],
  'mmhg': ['milimetros de mercurio'],
  'cmh2o': ['centimetros de agua'],
  'kg': ['kilos', 'kilogramos', 'kilo', 'kilogramo'],
  'g/dl': ['gramos por decilitro'],
  'lpm': ['latidos por minuto'],
  'rpm': ['respiraciones por minuto', 'revoluciones por minuto'],
  '%': ['por ciento'],
  // Vistas en el corpus de 498 al comprobar la tubería en modo simulado.
  'ml': ['mililitros', 'mililitro'],
  'mm': ['milimetros', 'milimetro'],
  'g': ['gramos', 'gramo'],
  'mg': ['miligramos', 'miligramo'],
  'mcg': ['microgramos', 'microgramo'],
  'ml/cmh2o': ['mililitros por centimetro de agua'],
  'u/min': ['unidades por minuto'],
  'l/min/m2': ['litros por minuto por metro cuadrado'],
  'mcg/kg/h': ['microgramos por kilo por hora'],
  'mcg/h': ['microgramos por hora'],
  'ng/ml': ['nanogramos por mililitro'],
  '/ul': ['por microlitro'],
  'c': ['grados celsius'],
}

/** Normaliza las unidades habladas a su símbolo, para poder compararlas. */
export function unidadesASimbolo(texto: string): string {
  let t = ' ' + norm(texto) + ' '
  // De las formas más largas a las más cortas: «mililitros por kilo por hora»
  // antes que «mililitros por kilo», o la primera se comería a la segunda.
  const pares: [string, string][] = []
  for (const [simbolo, formas] of Object.entries(UNIDADES_HABLADAS)) {
    for (const f of formas) pares.push([norm(f), simbolo])
  }
  pares.sort((a, b) => b[0].length - a[0].length)
  for (const [forma, simbolo] of pares) {
    t = t.split(' ' + forma + ' ').join(' ' + simbolo + ' ')
  }
  return t.trim()
}

/** Texto listo para comparar contra `key_terms`: números en dígitos y unidades en símbolo. */
export function canonizar(texto: string): string {
  return norm(unidadesASimbolo(numerosADigitos(texto)))
    // Una unidad que EMPIEZA por barra («/uL») se pega a su cifra: «48000 /ul»
    // y «48000/ul» son el mismo dato, y el espacio los hacía distintos.
    .replace(/(\d)\s+\//g, '$1/')
}

// ═══════════════════════════════════════════════════════════════════════
// Acrónimos y equivalencias declaradas
// ═══════════════════════════════════════════════════════════════════════

/** Un `key_term` es acrónimo si es una sigla: mayúsculas y sin espacios. */
export function esAcronimo(termino: string): boolean {
  const t = termino.trim()
  return /^[A-Z][A-Z0-9]{1,9}$/.test(t) || /^[A-Z][a-z]?O\d$/.test(t)
}

/** ¿Trae número el término? (`150 mL/min`, `PEEP 8`) */
export function tieneNumero(termino: string): boolean {
  return /\d/.test(termino)
}

/** ¿Trae unidad el término? */
export function tieneUnidad(termino: string): boolean {
  /**
   * Por TOKEN, no por subcadena.
   *
   * Con `includes`, la unidad «g» casaba dentro de «san**g**re» y «flujo de
   * sangre» se clasificaba como término con unidad — y por tanto como error
   * CRÍTICO al perderse. Lo encontró un caso del golden, no producción.
   */
  const tokens = new Set(canonizar(termino).split(/[\s]+/).filter(Boolean))
  return Object.keys(UNIDADES_HABLADAS).some(u => tokens.has(u))
}

/**
 * Equivalencias semánticas **declaradas en PARA_CLAUDE.md**. Nada más.
 *
 * El documento permite una sola: CKRT ≡ «terapia de reemplazo renal continua».
 * Y prohíbe expresamente tratar CVVHDF como intercambiable.
 */
export const EQUIVALENCIAS: Readonly<Record<string, readonly string[]>> = {
  ckrt: ['terapia de reemplazo renal continua', 'terapia de reemplazo renal'],
}

/** Términos cuya pérdida o sustitución es error clínico por regla del documento. */
export const NO_SUSTITUIBLES: readonly string[] = ['cvvhdf']


// ═══════════════════════════════════════════════════════════════════════
// Formas habladas de los conceptos
// ═══════════════════════════════════════════════════════════════════════

/**
 * Muchos `key_terms` son el CONCEPTO en taquigrafía, no lo que se pronuncia:
 * `HCO3` se dice «bicarbonato», `PAM` se dice «presión arterial media», `MRSA`
 * se dice «Staphylococcus aureus resistente a meticilina».
 *
 * Cada entrada de este mapa está **leída del propio manifiesto**: es la
 * correspondencia que el corpus del Dr. establece entre el término y la frase
 * que lo expresa. No invento ninguna.
 *
 * Lo que mide entonces la métrica es lo correcto: **si el CONCEPTO sobrevivió a
 * la transcripción**, no si el transcriptor escribió la sigla — que nadie
 * pronunció.
 */
export const FORMAS_HABLADAS: Readonly<Record<string, readonly string[]>> = {
  // ── Gasometría y laboratorio ──
  'hco3': ['bicarbonato'],
  'base excess': ['exceso de base'],
  'anion gap': ['brecha anionica'],
  'sao2': ['saturacion arterial de oxigeno'],
  'spo2': ['saturacion periferica de oxigeno'],
  'fio2': ['fraccion inspirada de oxigeno'],
  'pao2/fio2': ['pafi'],
  'pco2 gap': ['delta de dioxido de carbono'],
  'k': ['potasio'],
  'na': ['sodio'],
  'auc/mic': ['auc sobre mic'],
  'mrsa': ['staphylococcus aureus resistente a meticilina'],
  // ── Ventilación ──
  'vcv': ['ventilacion controlada por volumen'],
  'vt': ['volumen corriente'],
  'i:e': ['relacion inspiracion espiracion'],
  '1:2': ['uno a dos'],
  'sbt': ['prueba de ventilacion espontanea'],
  '6 ml/kg pbw': ['6 ml/kg de peso predicho', '6 mililitros por kilo de peso predicho'],
  // ── Hemodinámica ──
  'pam': ['presion arterial media'],
  'ppv': ['variacion de presion de pulso'],
  'plr': ['elevacion pasiva de piernas'],
  // ── Ultrasonido ──
  'vci': ['vena cava inferior'],
  'lus': ['lung ultrasound score'],
  'lung sliding': ['deslizamiento pleural'],
  'doppler hepatico': ['doppler de vena hepatica'],
  // ── ECMO ──
  'ecmo vv': ['ecmo veno venoso'],
  'ecmo va': ['ecmo veno arterial'],
  'rpm': ['revoluciones por minuto'],
  'saturacion preoxigenador': ['saturacion venosa preoxigenador'],
  // ── Neuro ──
  'gcs 9': ['escala de glasgow de nueve', 'glasgow de nueve'],
  // ── Pauta de antibiótico ──
  'q8h': ['cada ocho horas', 'cada 8 horas'],
  'q12h': ['cada doce horas', 'cada 12 horas'],
}

// ═══════════════════════════════════════════════════════════════════════
// Evaluación de un audio
// ═══════════════════════════════════════════════════════════════════════

export interface TerminoResultado {
  termino: string
  acertado: boolean
  /** `false` = mi evaluador no sabe comprobarlo; NO cuenta como fallo del STT. */
  evaluable: boolean
  /** Se aceptó por equivalencia semántica declarada, no literal. */
  porEquivalencia: boolean
  esAcronimo: boolean
  tieneNumero: boolean
  tieneUnidad: boolean
  /** Su pérdida es error clínico por regla del documento. */
  noSustituible: boolean
}

export interface ResultadoAudio {
  id: string
  category: string
  voice: string
  style: string
  canonical: string
  transcripcion: string
  wer: number
  terminos: TerminoResultado[]
  /** Términos perdidos que cuentan como error CRÍTICO. */
  erroresCriticos: string[]
}

/** ¿Aparece el término en la transcripción, con las equivalencias permitidas? */
export function terminoPresente(termino: string, transcripcion: string): { ok: boolean; porEquivalencia: boolean } {
  const hip = ' ' + canonizar(transcripcion) + ' '
  const t = canonizar(termino)
  if (t === '') return { ok: false, porEquivalencia: false }
  // Literal (ya con números en dígitos y unidades en símbolo).
  if (hip.includes(t)) return { ok: true, porEquivalencia: false }
  // Como se PRONUNCIA el concepto, leído del manifiesto.
  for (const forma of FORMAS_HABLADAS[t] ?? []) {
    if (hip.includes(canonizar(forma))) return { ok: true, porEquivalencia: true }
  }
  // Equivalencia semántica declarada en PARA_CLAUDE.md.
  for (const alt of EQUIVALENCIAS[t] ?? []) {
    if (hip.includes(canonizar(alt))) return { ok: true, porEquivalencia: true }
  }
  /**
   * Término COMPUESTO con pauta: «2 g q8h» se dice «dos gramos cada ocho horas».
   * Se comprueban sus partes: la cifra con su unidad, y la pauta por separado.
   */
  const partes = t.split(' ').filter(Boolean)
  if (partes.length > 1) {
    const todas = partes.every(parte => {
      if (hip.includes(' ' + parte + ' ') || hip.includes(parte)) return true
      return (FORMAS_HABLADAS[parte] ?? []).some(f => hip.includes(canonizar(f)))
    })
    if (todas) return { ok: true, porEquivalencia: true }
  }
  return { ok: false, porEquivalencia: false }
}

/**
 * ¿Puede este evaluador comprobar el término, o es un hueco MÍO?
 *
 * Si el término no aparece —ni literal, ni por forma hablada, ni por
 * equivalencia— en su PROPIO `canonical_text`, entonces mi capa de equivalencia
 * no sabe expresarlo, y contarlo como fallo del transcriptor sería culparlo de
 * mi limitación.
 *
 * Esos términos salen del cálculo y se declaran aparte. **Nunca se cuentan como
 * error de reconocimiento.**
 */
export function evaluable(termino: string, canonical: string): boolean {
  return terminoPresente(termino, canonical).ok
}

export function evaluarAudio(
  fila: { id: string; category: string; voice: string; style: string; canonical_text: string; key_terms: string },
  transcripcion: string,
): ResultadoAudio {
  const claves = fila.key_terms.split('|').map(s => s.trim()).filter(Boolean)

  const terminos: TerminoResultado[] = claves.map(termino => {
    const { ok, porEquivalencia } = terminoPresente(termino, transcripcion)
    return {
      termino, acertado: ok, porEquivalencia,
      evaluable: evaluable(termino, fila.canonical_text),
      esAcronimo: esAcronimo(termino),
      tieneNumero: tieneNumero(termino),
      tieneUnidad: tieneUnidad(termino),
      noSustituible: NO_SUSTITUIBLES.includes(canonizar(termino)),
    }
  })

  // «Errores en cifras, dosis, signos o unidades deben marcarse críticos», y la
  // pérdida de un término no sustituible (CVVHDF) también.
  const erroresCriticos = terminos
    .filter(t => t.evaluable && !t.acertado && (t.tieneNumero || t.tieneUnidad || t.noSustituible))
    .map(t => t.termino)

  return {
    id: fila.id, category: fila.category, voice: fila.voice, style: fila.style,
    canonical: fila.canonical_text, transcripcion,
    wer: wer(fila.canonical_text, transcripcion),
    terminos, erroresCriticos,
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Agregación
// ═══════════════════════════════════════════════════════════════════════

export interface Metricas {
  audios: number
  wer: number
  clinicalTermRecall: number | null
  acronymRecall: number | null
  numberAccuracy: number | null
  unitAccuracy: number | null
  /** Proporción de audios con al menos un error crítico. */
  criticalSemanticErrorRate: number
  /** Términos que MI evaluador no sabe comprobar. NO son fallos del STT. */
  terminosNoEvaluables: string[]
}

const tasa = (ac: number, tot: number) => (tot === 0 ? null : ac / tot)

export function metricas(rs: readonly ResultadoAudio[]): Metricas {
  let tTot = 0, tAc = 0, aTot = 0, aAc = 0, nTot = 0, nAc = 0, uTot = 0, uAc = 0
  let sumaWer = 0, conCritico = 0
  const noEvaluables = new Set<string>()

  for (const r of rs) {
    sumaWer += r.wer
    if (r.erroresCriticos.length > 0) conCritico++
    for (const t of r.terminos) {
      if (!t.evaluable) { noEvaluables.add(t.termino); continue }
      tTot++; if (t.acertado) tAc++
      if (t.esAcronimo) { aTot++; if (t.acertado) aAc++ }
      if (t.tieneNumero) { nTot++; if (t.acertado) nAc++ }
      if (t.tieneUnidad) { uTot++; if (t.acertado) uAc++ }
    }
  }

  return {
    audios: rs.length,
    wer: rs.length === 0 ? 0 : sumaWer / rs.length,
    clinicalTermRecall: tasa(tAc, tTot),
    acronymRecall: tasa(aAc, aTot),
    numberAccuracy: tasa(nAc, nTot),
    unitAccuracy: tasa(uAc, uTot),
    criticalSemanticErrorRate: rs.length === 0 ? 0 : conCritico / rs.length,
    terminosNoEvaluables: [...noEvaluables].sort(),
  }
}

/** Métricas por corte (categoría, voz o estilo). */
export function porCorte(
  rs: readonly ResultadoAudio[], campo: 'category' | 'voice' | 'style',
): { corte: string; m: Metricas }[] {
  const grupos = new Map<string, ResultadoAudio[]>()
  for (const r of rs) (grupos.get(r[campo]) ?? grupos.set(r[campo], []).get(r[campo])!).push(r)
  return [...grupos.entries()]
    .map(([corte, lista]) => ({ corte, m: metricas(lista) }))
    .sort((a, b) => (a.m.clinicalTermRecall ?? 1) - (b.m.clinicalTermRecall ?? 1))
}

/**
 * Ranking de términos por riesgo clínico: primero lo que más se pierde entre lo
 * que es crítico perder.
 */
export function rankingRiesgo(rs: readonly ResultadoAudio[]): {
  termino: string; veces: number; perdidas: number; recall: number; critico: boolean
}[] {
  const m = new Map<string, { veces: number; perdidas: number; critico: boolean }>()
  for (const r of rs) {
    for (const t of r.terminos) {
      if (!t.evaluable) continue
      const e = m.get(t.termino) ?? { veces: 0, perdidas: 0, critico: false }
      e.veces++
      if (!t.acertado) e.perdidas++
      if (!t.evaluable) continue
      if (t.tieneNumero || t.tieneUnidad || t.noSustituible) e.critico = true
      m.set(t.termino, e)
    }
  }
  return [...m.entries()]
    .map(([termino, e]) => ({ termino, ...e, recall: (e.veces - e.perdidas) / e.veces }))
    .filter(x => x.perdidas > 0)
    .sort((a, b) =>
      Number(b.critico) - Number(a.critico) || a.recall - b.recall || b.veces - a.veces)
}
