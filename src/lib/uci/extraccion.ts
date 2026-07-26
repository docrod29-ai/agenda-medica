/**
 * EXTRACCIÓN CLÍNICA DE UCI — normalización de unidades, sinónimos y ambigüedad
 * (iteración nexusmed-icu-004).
 *
 * Puro y testeable. Ayuda a que el dato dictado se convierta en un valor
 * normalizado SIN inventar. Regla de oro: ante ambigüedad (falta la unidad o hay
 * dos lecturas posibles) NO se asume — se marca `unidadPendiente`/`ambiguo` para
 * que la UI pida confirmación. Reutiliza el parseo de números en español.
 */
import { parsearNumeroEs } from '@/lib/voz/comandos-uci'

export const EXTRACCION_UCI_VERSION = '1.0.0'

/** Unidades canónicas de UCI y sus variantes dictadas/escritas. */
const UNIDADES: { canonica: string; variantes: string[] }[] = [
  { canonica: 'mcg/kg/min', variantes: ['mcg/kg/min', 'microgramos por kilo por minuto', 'ug/kg/min', 'gammas', 'gamma', 'microgramos/kg/min'] },
  { canonica: 'mcg/min',    variantes: ['mcg/min', 'microgramos por minuto', 'ug/min', 'microgramos/min'] },
  { canonica: 'mg/h',       variantes: ['mg/h', 'miligramos por hora', 'mg/hora'] },
  { canonica: 'U/min',      variantes: ['u/min', 'unidades por minuto', 'unidades/min'] },
  { canonica: 'U/h',        variantes: ['u/h', 'unidades por hora', 'unidades/hora'] },
  { canonica: 'mL/h',       variantes: ['ml/h', 'mililitros por hora', 'ml/hora'] },
  { canonica: 'cmH2O',      variantes: ['cmh2o', 'centimetros de agua', 'cm de agua', 'cm h2o'] },
  { canonica: 'mmHg',       variantes: ['mmhg', 'milimetros de mercurio'] },
  { canonica: 'mL/kg',      variantes: ['ml/kg', 'mililitros por kilo'] },
  { canonica: 'mmol/L',     variantes: ['mmol/l', 'milimoles por litro', 'milimolar'] },
  { canonica: 'mEq/L',      variantes: ['meq/l', 'miliequivalentes por litro'] },
  { canonica: 'mg/dL',      variantes: ['mg/dl', 'miligramos por decilitro'] },
  { canonica: 'g/dL',       variantes: ['g/dl', 'gramos por decilitro'] },
  { canonica: '%',          variantes: ['%', 'por ciento', 'porciento'] },
  { canonica: 'L/min',      variantes: ['l/min', 'litros por minuto'] },
]

const norm = (s: string): string => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

/** Devuelve la unidad canónica reconocida, o null si no la identifica. */
export function interpretarUnidad(texto?: string): string | null {
  if (!texto) return null
  const t = norm(texto)
  for (const u of UNIDADES) {
    if (u.variantes.some(v => t === norm(v) || t.includes(norm(v)))) return u.canonica
  }
  return null
}

/** Sinónimos de fármacos/términos de UCI → nombre canónico. */
const SINONIMOS: Record<string, string> = {
  norepi: 'norepinefrina', noradrenalina: 'norepinefrina', 'nor-epi': 'norepinefrina',
  epi: 'epinefrina', adrenalina: 'epinefrina',
  vaso: 'vasopresina', avp: 'vasopresina',
  dobuta: 'dobutamina', dopa: 'dopamina', fenil: 'fenilefrina',
  propo: 'propofol', midazo: 'midazolam', dexmede: 'dexmedetomidina', precede: 'dexmedetomidina',
  fenta: 'fentanilo',
}
export function canonizarFarmaco(nombre?: string): string {
  if (!nombre) return ''
  const t = norm(nombre)
  return SINONIMOS[t] ?? t
}

export interface ValorClinico {
  valor: number | null
  unidad: string | null
  unidadPendiente: boolean   // hay número pero falta unidad → confirmar
  ambiguo: boolean           // dos lecturas posibles → confirmar
  crudo: string
}

/**
 * Parsea un valor clínico de una frase. Ej.:
 *   "PEEP ocho"                → { valor:8, unidad:null, unidadPendiente:true (contexto lo pone) }
 *   "potasio cinco punto ocho" → { valor:5.8, unidad:null, unidadPendiente:true }
 *   "norepinefrina punto uno"  → { valor:0.1?, ambiguo:true }  (¿0.1 mcg/kg/min?)
 *   "FiO2 cuarenta por ciento" → { valor:40, unidad:'%' }
 *
 * NO asume la unidad: si no viene, `unidadPendiente=true`. Si el número empieza
 * por "punto" (sin entero), lo marca `ambiguo` (0.1 vs 1, hay que confirmar).
 */
export function parsearValorClinico(texto: string): ValorClinico {
  const crudo = texto
  const t = norm(texto)
  const base: ValorClinico = { valor: null, unidad: null, unidadPendiente: false, ambiguo: false, crudo }

  // "punto uno" sin entero explícito → ambiguo (0.1 vs 1)
  const empiezaPunto = /(^|\s)punto\s+\w+/.test(t) && !/\d|\b(cero|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte|treinta|cuarenta|cincuenta)\b\s+punto/.test(t)

  // Extraer el número embebido en la frase (dígitos o palabras, con "punto").
  // El dígito debe estar SUELTO: el "2" de "FiO2" no es un valor (va pegado a letra).
  const mDig = t.match(/(?<![a-z])(\d+(?:\.\d+)?)(?![a-z])/)
  let valor: number | null = null
  if (mDig) {
    valor = Number(mDig[1])
  } else {
    // Busca una secuencia de palabras-número (p.ej. "ocho", "cero punto cuatro",
    // "treinta y cinco") aunque venga precedida de la etiqueta ("peep ocho").
    const NUM = 'cero|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|diecisiete|dieciocho|diecinueve|veinti\\w+|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa'
    const m = t.match(new RegExp(`\\b(?:${NUM})(?:\\s+(?:y|punto|${NUM}))*`))
    if (m) {
      const s = parsearNumeroEs(m[0])
      if (s !== null) valor = Number(s)
    }
  }

  const unidad = interpretarUnidad(t)
  return {
    ...base,
    valor: Number.isFinite(valor as number) ? valor : null,
    unidad,
    unidadPendiente: valor !== null && unidad === null,
    ambiguo: empiezaPunto,
  }
}
