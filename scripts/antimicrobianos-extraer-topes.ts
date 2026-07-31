/**
 * EXTRAE los topes que YA ESTÁN ESCRITOS en el dataset verificado del Dr.
 *
 * ── LA LÍNEA QUE NO SE CRUZA ─────────────────────────────────────────────────
 *
 * Transcribir un número que está en la fuente NO es inventarlo. Inventarlo es
 * poner uno que no está. Este script sólo hace lo primero, y cada cifra que
 * emite viaja con **la frase exacta de la que salió**, para que se pueda
 * comprobar de un vistazo en vez de teclearlas todas a mano.
 *
 * Qué emite y qué no:
 *
 *   · `usualMax…`  — del régimen ESTÁNDAR declarado. «2 g IV q8h» da 2 g por
 *     dosis y 6 g al día: es aritmética sobre cifras escritas.
 *   · `absolutoMax…` — SÓLO cuando el texto dice un máximo («max 4 g/day»).
 *     Cuatro fármacos de 49 lo dicen. Para los otros 45 se deja VACÍO: un techo
 *     duro que nadie escribió no se deduce.
 *   · `contextualMax…` — NUNCA. Depende de la indicación y el dataset no la
 *     desglosa; ponerlo sería opinar.
 *
 * Lo que no se puede leer sin ambigüedad no se emite: sale en la lista de
 * pendientes. Un régimen mal leído no produce un error visible, produce un tope
 * distinto que se ve igual de fiable.
 *
 * Uso: npx tsx scripts/antimicrobianos-extraer-topes.ts
 */
import { writeFileSync } from 'node:fs'
import { FARMACOS, HUELLA_DATASET } from '../src/lib/antimicrobianos/v4/catalogo'
import { fusionadas } from '../src/lib/antimicrobianos/v4/resolver'

interface Semilla {
  farmaco: string
  indicacion: string
  usualMaxPorDosis?: number
  usualMaxPorDia?: number
  absolutoMaxPorDosis?: number
  absolutoMaxPorDia?: number
  unidad: string
  tipoMaximo: 'EXPLICIT' | 'CONTEXTUAL'
  /** La frase EXACTA del dataset de la que salió cada cifra. */
  textoFuente: string
  fuenteIds: string[]
  huellaDataset: string
}

const aMg = (valor: number, unidad: string): number =>
  /^g$/i.test(unidad) ? valor * 1000 : valor

/** «2 g IV q8h» · «1-2 g IV q24h» · «600 mg IV q12h». */
const RX_PAUTA = /(?:^|[\s(])(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\s*(g|mg)\b[^.;]{0,40}?q(\d+)h/i
/** «max 4 g/day» · «up to 12 g/day». */
const RX_MAX_DIA = /(?:max(?:imum)?|not to exceed|up to)\s*(\d+(?:\.\d+)?)\s*(g|mg)\s*\/\s*day/i

const semillas: Semilla[] = []
const pendientes: { farmaco: string; porQue: string; texto: string }[] = []

/**
 * Señales de que el texto lleva MÁS DE UNA pauta.
 *
 * Éstas son las que hicieron fallar la primera versión, y las cuatro fallaban en
 * la misma dirección —hacia un tope DEMASIADO BAJO—, que es la peor:
 *
 *   · nafcilina «500 mg q4h usual; 1 g q4h para infección grave» → leía 500 y
 *     habría avisado en cada infección grave;
 *   · ceftriaxona «1-2 g q24h o dividido q12h» → leía 2 g/día y habría avisado
 *     en la meningitis, que usa 4;
 *   · ampicilina/sulbactam → cogía la pauta de CRAB invasivo (9 g) como si fuera
 *     la habitual;
 *   · tigeciclina → mezclaba la dosis de CARGA con la de mantenimiento.
 *
 * Una alerta que salta en lo que el médico hace todos los días es peor que no
 * tener alerta: enseña a ignorarla.
 */
const AMBIGUO = [
  /\bsevere\b/i, /\blife-threatening\b/i, /\bhigh-dose\b/i, /\bload\b/i,
  /\bor\b[^.;]{0,30}q\d+h/i, /\bdivided\b/i, /\bvary\b/i,
  /indication-dependent/i, /\bpathway\b/i, /\bPLUS\b/, /\brecurr/i,
]

for (const f of FARMACOS) {
  const texto = (f.core_regimen || f.label_regimen || '').trim()
  if (!texto) { pendientes.push({ farmaco: f.drug, porQue: 'sin régimen declarado', texto: '' }); continue }

  // Un fármaco que el propio dataset no da por listo no propone tope.
  if (f.auto_dose_status !== 'READY') {
    pendientes.push({ farmaco: f.drug, porQue: `el dataset lo marca «${f.auto_dose_status}»`, texto })
    continue
  }
  // Los 11 con la ficha y la guía fusionadas: dos pautas en una cadena.
  if (fusionadas(f)) {
    pendientes.push({ farmaco: f.drug, porQue: 'ficha y guía fusionadas en el mismo texto: hay dos pautas', texto })
    continue
  }
  const amb = AMBIGUO.find(rx => rx.test(texto))
  if (amb) {
    pendientes.push({ farmaco: f.drug, porQue: `el texto describe más de una pauta (${String(amb)})`, texto })
    continue
  }

  // Las dosis por kilo no se convierten a una cifra fija: dependen del peso.
  if (/mg\s*\/\s*kg/i.test(texto)) {
    pendientes.push({ farmaco: f.drug, porQue: 'se dosifica por kg: el tope depende del peso', texto })
    continue
  }

  /**
   * DOS pautas en el texto = ninguna se propone.
   *
   * `AMBIGUO` va por palabras clave y se le escapó ceftolozano/tazobactam:
   * «cUTI/cIAI: 1.5 g q8h. HABP/VABP: 3 g q8h» no dice «severe» ni «or», y aun
   * así son dos pautas — la de neumonía es el DOBLE. Se habría propuesto 1.5 g
   * como tope habitual y habría avisado en cada neumonía nosocomial.
   *
   * Contar las coincidencias no depende de acertar con el vocabulario: si hay
   * más de una cifra con su intervalo, hay más de una pauta y punto.
   */
  const todas = texto.match(new RegExp(RX_PAUTA.source, 'gi')) ?? []
  if (todas.length > 1) {
    pendientes.push({ farmaco: f.drug, porQue: `el texto trae ${todas.length} pautas distintas`, texto })
    continue
  }

  const p = texto.match(RX_PAUTA)
  if (!p) { pendientes.push({ farmaco: f.drug, porQue: 'no se pudo leer la pauta sin ambigüedad', texto }); continue }

  const bajo = Number(p[1])
  const alto = p[2] !== undefined ? Number(p[2]) : bajo
  const unidadPauta = p[3]
  const cadaHoras = Number(p[4])
  if (!(alto > 0) || !(cadaHoras > 0) || 24 % cadaHoras !== 0) {
    pendientes.push({ farmaco: f.drug, porQue: `intervalo q${cadaHoras}h no divide el día`, texto })
    continue
  }

  const porDosis = aMg(alto, unidadPauta)
  const porDia = porDosis * (24 / cadaHoras)

  const mx = texto.match(RX_MAX_DIA)
  const absDia = mx ? aMg(Number(mx[1]), mx[2]) : undefined
  // Un máximo escrito por debajo del régimen leído es señal de que la lectura
  // está mal: no se emite nada, se manda a revisar.
  if (absDia !== undefined && absDia < porDia) {
    pendientes.push({ farmaco: f.drug, porQue: `el máximo escrito (${absDia} mg/día) queda por debajo del régimen leído (${porDia} mg/día): revisar a mano`, texto })
    continue
  }

  semillas.push({
    farmaco: f.drug,
    indicacion: '*',
    usualMaxPorDosis: porDosis,
    usualMaxPorDia: porDia,
    ...(absDia !== undefined ? { absolutoMaxPorDia: absDia } : {}),
    unidad: 'mg',
    tipoMaximo: absDia !== undefined ? 'EXPLICIT' : 'CONTEXTUAL',
    textoFuente: texto,
    fuenteIds: f.source_ids,
    huellaDataset: HUELLA_DATASET,
  })
}

writeFileSync(
  'src/lib/antimicrobianos/v4/data/topes-extraidos.json',
  JSON.stringify({ semillas, pendientes, huellaDataset: HUELLA_DATASET }, null, 2) + '\n',
)

console.log(`\n  extraídos: ${semillas.length} · pendientes de mano: ${pendientes.length} · total ${FARMACOS.length}\n`)
for (const s of semillas) {
  console.log(`  ${s.farmaco.padEnd(34)} ${String(s.usualMaxPorDosis).padStart(6)} mg/dosis · ${String(s.usualMaxPorDia).padStart(6)} mg/día${s.absolutoMaxPorDia ? `  · tope ${s.absolutoMaxPorDia}` : ''}`)
  console.log(`  ${' '.repeat(34)} «${s.textoFuente.slice(0, 96)}»`)
}
console.log('\n  ── PENDIENTES (no se dedujo nada) ──')
for (const p of pendientes) console.log(`  ${p.farmaco.padEnd(34)} ${p.porQue}`)
