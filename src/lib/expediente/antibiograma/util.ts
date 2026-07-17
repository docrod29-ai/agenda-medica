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

/** Estado S/I/R del primer antibiótico que coincida con algún sinónimo (o null). */
export function estado(resultados: ResultadoAntibiograma[], sinonimos: string[]): SIR | null {
  for (const r of resultados) {
    const a = norm(r.antibiotico)
    if (sinonimos.some(s => a.includes(norm(s)))) return r.interpretacion
  }
  return null
}

/** CMI (mg/L) del primer antibiótico que coincida con algún sinónimo y traiga CMI numérica. */
export function cmiDe(resultados: ResultadoAntibiograma[], sinonimos: string[]): number | null {
  for (const r of resultados) {
    const a = norm(r.antibiotico)
    if (sinonimos.some(s => a.includes(norm(s))) && typeof r.cmi === 'number') return r.cmi
  }
  return null
}

/** ¿Está el antibiótico presente en el panel (independiente de su S/I/R)? */
export function presente(resultados: ResultadoAntibiograma[], sinonimos: string[]): boolean {
  return resultados.some(r => sinonimos.some(s => norm(r.antibiotico).includes(norm(s))))
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
export const IMIPENEM = ['imipenem']
export const MEROPENEM = ['meropenem']
export const ERTAPENEM = ['ertapenem']
export const PIP_TAZO = ['piperacilina-tazobactam', 'piperacilina/tazobactam', 'piperacilina', 'tazobactam']
export const FLUOROQUINOLONA = ['ciprofloxacino', 'levofloxacino', 'moxifloxacino', 'ofloxacino', 'norfloxacino']
export const CIPROFLOXACINO = ['ciprofloxacino', 'ofloxacino']
export const LEVOFLOXACINO = ['levofloxacino']
export const MOXIFLOXACINO = ['moxifloxacino']
export const COLISTINA = ['colistina', 'colistimetato', 'polimixina']
export const AMINOGLUCOSIDO = ['gentamicina', 'amikacina', 'tobramicina', 'netilmicina']
export const GENTAMICINA = ['gentamicina']
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
export const CEFTAZIDIMA_AVIBACTAM = ['ceftazidima-avibactam', 'ceftazidima/avibactam', 'ceftazidima avibactam', 'cef-avi', 'avibactam']
export const CEFIDEROCOL = ['cefiderocol']

/** Alguna(s) coincidencia(s) con estado R entre una lista de sinónimos-clase. */
export function algunoR(resultados: ResultadoAntibiograma[], grupos: string[]): boolean {
  return grupos.some(g => ES_R(estado(resultados, [g])))
}
/** Alguna(s) coincidencia(s) con estado S. */
export function algunoS(resultados: ResultadoAntibiograma[], grupos: string[]): boolean {
  return grupos.some(g => ES_S(estado(resultados, [g])))
}
