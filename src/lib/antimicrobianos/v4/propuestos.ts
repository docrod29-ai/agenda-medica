/**
 * TOPES PROPUESTOS — transcritos del dataset, pendientes de tu visto bueno.
 *
 * ── QUÉ SON Y QUÉ NO SON ─────────────────────────────────────────────────────
 *
 * No son una opinión clínica: son la pauta que **ya está escrita** en el dataset
 * verificado, pasada a números. «2 g IV q8h» da 2 000 mg por dosis y 6 000 al
 * día: es aritmética sobre cifras que alguien más ya comprobó.
 *
 * Cada uno viaja con **la frase exacta de la que salió**, para que confirmarlo
 * sea leer una línea en vez de teclear seis campos.
 *
 * ── POR QUÉ SÓLO NUEVE DE CUARENTA Y NUEVE ───────────────────────────────────
 *
 * Porque el resto del dataset no dice UNA pauta, dice varias, y las cuatro
 * lecturas que fallaron en la primera versión fallaron todas hacia un tope
 * DEMASIADO BAJO — la peor dirección posible:
 *
 *   · nafcilina «500 mg q4h usual; 1 g q4h para infección grave» → leía 500;
 *   · ceftriaxona «1-2 g q24h o dividido q12h; máx 4 g/día» → leía 2 g/día,
 *     y la meningitis usa 4;
 *   · ampicilina/sulbactam → tomaba la pauta de CRAB invasivo como habitual;
 *   · ceftolozano/tazobactam «cUTI 1.5 g q8h · HABP/VABP 3 g q8h» → leía la
 *     mitad, y habría avisado en cada neumonía nosocomial.
 *
 * Una alerta que salta en lo que se hace todos los días enseña a ignorarla. Por
 * eso los cuarenta restantes se quedan fuera y se cargan a mano: es más lento y
 * es lo correcto.
 */
import datos from '@/lib/antimicrobianos/v4/data/topes-extraidos.json'
import type { TipoMaximo } from '@/lib/antimicrobianos/v4/tipos'

export interface TopePropuesto {
  farmaco: string
  indicacion: string
  usualMaxPorDosis?: number
  usualMaxPorDia?: number
  absolutoMaxPorDosis?: number
  absolutoMaxPorDia?: number
  unidad: string
  tipoMaximo: TipoMaximo
  /** La frase del dataset. Es la que se enseña para confirmar. */
  textoFuente: string
  fuenteIds: string[]
  huellaDataset: string
}

export interface Pendiente {
  farmaco: string
  /** Por qué no se propuso nada. Se enseña: un hueco explicado se llena. */
  porQue: string
  texto: string
}

const D = datos as unknown as {
  semillas: TopePropuesto[]
  pendientes: Pendiente[]
  huellaDataset: string
}

export const PROPUESTOS: readonly TopePropuesto[] = D.semillas
export const SIN_PROPONER: readonly Pendiente[] = D.pendientes
export const HUELLA_EXTRACCION = D.huellaDataset

/** Los que todavía no ha confirmado nadie. */
export function porConfirmar(
  propuestos: readonly TopePropuesto[],
  yaCargados: readonly { farmaco: string; indicacion: string }[],
): TopePropuesto[] {
  const tengo = new Set(yaCargados.map(l => `${l.farmaco.toLowerCase()}|${l.indicacion}`))
  return propuestos.filter(p => !tengo.has(`${p.farmaco.toLowerCase()}|${p.indicacion}`))
}

export const POR_QUE_NO_SE_CARGAN_SOLOS =
  'Un tope guardado dice «un médico comprobó esto». Si lo escribiera el programa ' +
  'sin que nadie lo mirara, la firma dejaría de significar algo — y el día que ' +
  'una lectura saliera mal, nadie tendría por qué haberla visto. Se transcribe ' +
  'todo para que confirmarlo sea un clic, no seis campos.'
