/**
 * Utilidades compartidas: normalización, búsqueda de S/I/R y CMI por sinónimos,
 * catálogos de antibióticos y reconocimiento de organismo.
 */
import type { ResultadoAntibiograma, SIR } from './tipos'

export function norm(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

export function organismoEs(org: string, claves: string[]): boolean {
  const o = norm(org)
  return claves.some(k => o.includes(norm(k)))
}


/**
 * ¿Este nombre de antibiótico corresponde a este sinónimo?
 *
 * ANTES ERA `a.includes(sinonimo)`, Y ESO ROMPÍA CUATRO COSAS A LA VEZ. La causa
 * es que los β-lactámicos nuevos son combinaciones cuyo nombre CONTIENE el del
 * agente suelto:
 *
 *  1. "Meropenem-vaborbactam S" hacía que `CARBAPENEM` viera una S y la rama de
 *     CARBAPENEMASA nunca entrara: se perdía la alerta crítica, la notificación
 *     obligatoria y el aislamiento de contacto. Con meropenem R al lado.
 *  2. El alias suelto 'avibactam' casaba "Aztreonam-avibactam", y el motor
 *     concluía "carbapenemasa de SERINA" — justo al revés, porque
 *     aztreonam-avibactam es el fármaco de las metalo-β-lactamasas.
 *  3. `AMPICILINA` casaba "Amoxicilina-clavulanato", así que una Klebsiella S a
 *     amox-clav —lo NORMAL— disparaba la alarma de resistencia intrínseca y le
 *     pedía al laboratorio reconfirmar la especie.
 *  4. 'ofloxacino' es subcadena de "levofloxacino": la edición interpretativa de
 *     fluoroquinolonas aparecía o no según el ORDEN de las filas del panel.
 *
 * Dos reglas:
 *
 *  a) Frontera de token: el sinónimo tiene que empezar y terminar en un límite de
 *     palabra, no en mitad de otra. Eso resuelve (4).
 *  b) Un agente SUELTO no casa una combinación con inhibidor. Si el sinónimo que
 *     se busca no menciona inhibidor, el nombre del antibiótico tampoco puede
 *     mencionarlo. Eso resuelve (1), (2) y (3). Cuando el sinónimo SÍ es la
 *     combinación (p. ej. 'piperacilina-tazobactam'), la regla no aplica.
 */
const INHIBIDORES = /(avibactam|vaborbactam|relebactam|durlobactam|taniborbactam|enmetazobactam|tazobactam|clavulan|sulbactam)/

export function coincideAntibiotico(antibiotico: string, sinonimo: string): boolean {
  const a = norm(antibiotico)
  const s = norm(sinonimo)
  if (!a || !s) return false

  // (b) agente suelto vs combinación con inhibidor
  if (!INHIBIDORES.test(s) && INHIBIDORES.test(a)) return false

  // (a) frontera de token — el separador puede ser espacio, guion, barra o punto
  const esc = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(a)
}

/** ¿Alguno de los sinónimos corresponde a este antibiótico? */
export function casaAlguno(antibiotico: string, sinonimos: string[]): boolean {
  return sinonimos.some(s => coincideAntibiotico(antibiotico, s))
}

/**
 * TODAS las filas del panel que correspondan a estos sinónimos.
 *
 * `estado()` devuelve solo la PRIMERA, y eso ocultaba los conflictos que el módulo
 * promete detectar: con "Meropenem R, Imipenem S" en Stenotrophomonas, o
 * "Ceftriaxona R, Ceftazidima S" en Enterococcus faecium, la segunda fila —la
 * biológicamente imposible, que es la señal de un error de identificación— ni
 * siquiera se miraba.
 */
export function todosLosEstados(resultados: ResultadoAntibiograma[], sinonimos: string[]): ResultadoAntibiograma[] {
  return resultados.filter(r => casaAlguno(r.antibiotico, sinonimos))
}

/** Estado S/I/R del primer antibiótico que coincida con algún sinónimo (o null). */
export function estado(resultados: ResultadoAntibiograma[], sinonimos: string[]): SIR | null {
  for (const r of resultados) {
    if (casaAlguno(r.antibiotico, sinonimos)) return r.interpretacion
  }
  return null
}

/** CMI (mg/L) del primer antibiótico que coincida con algún sinónimo y traiga CMI numérica. */
export function cmiDe(resultados: ResultadoAntibiograma[], sinonimos: string[]): number | null {
  for (const r of resultados) {
    if (casaAlguno(r.antibiotico, sinonimos) && typeof r.cmi === 'number') return r.cmi
  }
  return null
}

/** ¿Está el antibiótico presente en el panel (independiente de su S/I/R)? */
export function presente(resultados: ResultadoAntibiograma[], sinonimos: string[]): boolean {
  return resultados.some(r => casaAlguno(r.antibiotico, sinonimos))
}

export const ES_R = (v: SIR | null) => v === 'R'
export const ES_S = (v: SIR | null) => v === 'S'
export const ES_I = (v: SIR | null) => v === 'I'
export const NO_S = (v: SIR | null) => v === 'R' || v === 'I' // no-sensible

// ── Sinónimos por antibiótico / clase (compartidos por todos los módulos) ──
export const PENICILINA = ['penicilina', 'bencilpenicilina']
export const AMPICILINA = ['ampicilina', 'amoxicilina']
export const AMOXI_CLAV = ['amoxicilina-clavulanico', 'amoxicilina/clavulanico', 'amoxicilina-ac', 'co-amoxiclav']
export const OXACILINA = ['oxacilina', 'meticilina', 'dicloxacilina']
export const CEFOXITINA = ['cefoxitina', 'fox']
export const CEF1G = ['cefalotina', 'cefazolina', 'cefalexina']
export const CEF3G = ['ceftriaxona', 'cefotaxima', 'ceftazidima', 'cefixima', 'ceftibuteno']
export const CEFTAZIDIMA = ['ceftazidima']
export const CEFEPIME = ['cefepime', 'cefepima']
export const AZTREONAM = ['aztreonam']
export const CARBAPENEM = ['meropenem', 'imipenem', 'ertapenem', 'doripenem']
/**
 * Carbapenémicos con actividad ANTIPSEUDOMONAS (sin ertapenem). Auditoría 2026-07
 * (P0): en Pseudomonas y Acinetobacter el ertapenem es intrínsecamente R, así que un
 * ertapenem R en la placa NO indica carbapenemasa. Usar este set —no CARBAPENEM— para
 * detectar resistencia a carbapenémicos en no-fermentadores evita la falsa
 * carbapenemasa, la falsa notificación NOM-045 y el falso aislamiento.
 */
export const CARBAPENEM_ANTIPSEUDOMONAS = ['meropenem', 'imipenem', 'doripenem']
export const IMIPENEM = ['imipenem']
export const MEROPENEM = ['meropenem']
export const ERTAPENEM = ['ertapenem']
// OJO: sin el alias suelto 'tazobactam' — como es "inhibidor", el matcher lo casaba
// por frontera de token dentro de 'ceftolozano-tazobactam', leyendo esa fila como si
// fuera pip-tazo (contaminaba DTR/MDR y la advertencia AmpC citaba el fármaco equivocado).
export const PIP_TAZO = ['piperacilina-tazobactam', 'piperacilina/tazobactam', 'piperacilina']
export const FLUOROQUINOLONA = ['ciprofloxacino', 'levofloxacino', 'moxifloxacino', 'ofloxacino', 'norfloxacino']
export const CIPROFLOXACINO = ['ciprofloxacino', 'ofloxacino']
export const LEVOFLOXACINO = ['levofloxacino']
export const MOXIFLOXACINO = ['moxifloxacino']
export const COLISTINA = ['colistina', 'colistimetato', 'polimixina']
export const AMINOGLUCOSIDO = ['gentamicina', 'amikacina', 'tobramicina', 'netilmicina']
export const GENTAMICINA = ['gentamicina']
/**
 * Tamiz de gentamicina de ALTO NIVEL (sinergia en enterococo).
 *
 * Es una prueba DISTINTA de la gentamicina del panel rutinario, y hay que
 * distinguirlas: el enterococo es intrínsecamente resistente de bajo nivel a
 * aminoglucósidos, así que una gentamicina "R" de rutina es lo ESPERADO y no
 * establece HLAR. Solo el tamiz de alto nivel (500 µg/mL) lo hace.
 */
export const GENTAMICINA_ALTO_NIVEL = [
  'gentamicina alto nivel', 'gentamicina-alto-nivel', 'gentamicina 500',
  'gentamicina sinergia', 'sinergia gentamicina', 'high level gentamicin',
  'gentamicina hln', 'hlar',
]
export const AMIKACINA = ['amikacina']
export const VANCOMICINA = ['vancomicina']
export const TEICOPLANINA = ['teicoplanina']
export const LINEZOLID = ['linezolid', 'oxazolidinona']
export const DAPTOMICINA = ['daptomicina']
export const ERITROMICINA = ['eritromicina', 'macrolido', 'azitromicina', 'claritromicina']
export const CLINDAMICINA = ['clindamicina', 'lincosamida']
export const COTRIMOXAZOL = ['trimetoprim', 'sulfametoxazol', 'cotrimoxazol', 'tmp-smx', 'tmp/smx']
export const TETRACICLINA = ['tetraciclina', 'doxiciclina', 'minociclina']
export const TIGECICLINA = ['tigeciclina']
export const NITROFURANTOINA = ['nitrofurantoina']
/**
 * Auditoría 2026-07 (P0, hallado por muchos auditores): el alias suelto 'avibactam'
 * casaba «Aztreonam-avibactam» (avibactam es un TOKEN completo ahí, así que ni el
 * límite de token ni la regla de inhibidores lo frenaban) y una metalo-β-lactamasa
 * (NDM) —cuyo único fármaco ES aztreonam-avibactam— se interpretaba con los puntos
 * de corte de ceftazidima-avibactam. Se quita el alias suelto y aztreonam-avibactam
 * pasa a ser su propio fármaco.
 */
export const CEFTAZIDIMA_AVIBACTAM = ['ceftazidima-avibactam', 'ceftazidima/avibactam', 'ceftazidima avibactam', 'cef-avi', 'caz-avi']
export const AZTREONAM_AVIBACTAM = ['aztreonam-avibactam', 'aztreonam/avibactam', 'aztreonam avibactam', 'azt-avi']
export const CEFIDEROCOL = ['cefiderocol']

/** Alguna(s) coincidencia(s) con estado R entre una lista de sinónimos-clase. */
export function algunoR(resultados: ResultadoAntibiograma[], grupos: string[]): boolean {
  return grupos.some(g => ES_R(estado(resultados, [g])))
}
/** Alguna(s) coincidencia(s) con estado S. */
export function algunoS(resultados: ResultadoAntibiograma[], grupos: string[]): boolean {
  return grupos.some(g => ES_S(estado(resultados, [g])))
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * INTERPRETACIÓN EFECTIVA — fuente única para TODAS las salidas (E0-15a)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El motor edita categorías por regla experta EUCAST (fluoroquinolonas S→R por
 * resistencia cruzada inferida), pero esa edición NO llegaba a la nota, al
 * prompt del LLM, al validador ni al PK/PD: cada salida mostraba la «S» cruda
 * que el propio motor ya había declarado R. Contradicción en la misma hoja.
 *
 * Decisión del médico dueño (2026-07-28): la interpretación editada es la
 * **canónica** para UI, nota, prompt, validador, PK/PD, recomendaciones,
 * exportación, alertas y auditoría — **pero el resultado original no se
 * destruye**. Se conserva en `interpretacionLab` para poder mostrar:
 *
 *   Resultado de laboratorio: S
 *   Interpretación Nexus: R por regla experta EUCAST [regla/versión]
 *
 * Función PURA: devuelve un arreglo nuevo, no muta el de entrada.
 */
export function aplicarEdicionesInterpretativas(
  resultados: ResultadoAntibiograma[],
  ediciones: { antibiotico: string; de: 'S'; a: 'R'; razon: string; referencia: string }[],
): ResultadoAntibiograma[] {
  if (!ediciones.length) return resultados
  return resultados.map(r => {
    const ed = ediciones.find(e => coincideAntibiotico(r.antibiotico, e.antibiotico))
    // Solo se edita lo que la regla declara editar, y solo desde su categoría de
    // origen: si el laboratorio ya reportó R, no hay nada que editar.
    if (!ed || r.interpretacion !== ed.de) return r
    return {
      ...r,
      interpretacion: ed.a,
      interpretacionLab: r.interpretacion,
      edicionRazon: ed.razon,
      edicionReferencia: ed.referencia,
    }
  })
}

/** ¿Esta categoría viene de una edición interpretativa (y no del laboratorio)? */
export function fueEditado(r: ResultadoAntibiograma): boolean {
  return r.interpretacionLab != null && r.interpretacionLab !== r.interpretacion
}
