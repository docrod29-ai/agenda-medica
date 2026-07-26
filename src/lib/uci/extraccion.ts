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

/**
 * Campos del Panel UCI y las frases que los nombran (para extraer de la voz del
 * pase de visita). El nombre debe ir seguido del número dictado.
 */
const CAMPOS_UCI: { campo: string; alias: string[] }[] = [
  { campo: 'fio2', alias: ['fio2', 'fi o dos', 'fio dos', 'fraccion inspirada de oxigeno'] },
  // OJO: 'pip' (presión pico inspiratoria) NO es PEEP; va a su propio campo ppico.
  // Mapearlo a PEEP corrompía el driving pressure (Pplat − PEEP).
  { campo: 'peep', alias: ['peep', 'pip peep', 'peep total'] },
  { campo: 'autoPeep', alias: ['auto peep', 'autopeep', 'peep intrinseco', 'peep intrínseco'] },
  { campo: 'ppico', alias: ['presion pico', 'presión pico', 'pico inspiratoria', 'ppico', 'pip', 'presion inspiratoria pico'] },
  { campo: 'pplat', alias: ['plateau', 'presion plateau', 'presion meseta', 'pplat', 'presion plato'] },
  { campo: 'psoporte', alias: ['presion soporte', 'presión de soporte', 'presion de soporte', 'soporte de presion'] },
  { campo: 'fr', alias: ['frecuencia respiratoria', 'efe erre'] },
  { campo: 'vt', alias: ['volumen corriente', 'volumen tidal'] },
  { campo: 'pao2', alias: ['pao2', 'pao dos', 'presion arterial de oxigeno'] },
  { campo: 'paco2', alias: ['paco2', 'paco dos', 'pco2', 'pco dos'] },
  { campo: 'hco3', alias: ['bicarbonato', 'hco3', 'hache ce o tres'] },
  { campo: 'ph', alias: ['ph', 'pe hache'] },
  { campo: 'lactato', alias: ['lactato'] },
  { campo: 'pas', alias: ['presion sistolica', 'sistolica', 'tension sistolica'] },
  { campo: 'pad', alias: ['presion diastolica', 'diastolica', 'tension diastolica'] },
  { campo: 'norepi', alias: ['norepinefrina', 'noradrenalina', 'norepi'] },
  { campo: 'dopa', alias: ['dopamina'] },
  { campo: 'dobu', alias: ['dobutamina'] },
  { campo: 'epi', alias: ['epinefrina', 'adrenalina'] },
  { campo: 'glasgow', alias: ['glasgow', 'escala de coma'] },
  { campo: 'creat', alias: ['creatinina'] },
  { campo: 'k', alias: ['potasio'] },
  { campo: 'na', alias: ['sodio'] },
  { campo: 'cl', alias: ['cloro'] },
  { campo: 'alb', alias: ['albumina', 'albúmina'] },
  { campo: 'glucosa', alias: ['glucosa', 'glucemia'] },
  { campo: 'spo2', alias: ['saturacion de oxigeno', 'saturacion', 'spo2', 'sato dos'] },
  { campo: 'plaquetas', alias: ['plaquetas'] },
  { campo: 'bili', alias: ['bilirrubina'] },
  { campo: 'talla', alias: ['talla', 'estatura'] },
  // Neurocrítico
  { campo: 'pic', alias: ['presion intracraneal', 'presión intracraneana', 'presion intracraneana', 'pic'] },
  { campo: 'temp', alias: ['temperatura'] },
  { campo: 'osm', alias: ['osmolaridad', 'osmolalidad'] },
  // POCUS (numéricos)
  { campo: 'vci', alias: ['vena cava inferior', 'cava inferior', 'vci', 'vena cava'] },
  { campo: 'tapse', alias: ['tapse'] },
  { campo: 'vdvi', alias: ['relacion vd vi', 'vd vi', 've de ve i'] },
  { campo: 'lineasB', alias: ['lineas b', 'líneas b', 'lineas be'] },
  { campo: 'plrDelta', alias: ['elevacion de piernas', 'plr', 'pierna recta'] },
]

const NUM_RE = 'cero|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|diecisiete|dieciocho|diecinueve|veinti\\w+|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento'

/**
 * Extrae de la transcripción del pase de visita los valores del Panel UCI. Para
 * cada campo busca su nombre seguido de un número (dígitos o palabras, con
 * "punto"). Devuelve solo lo que reconoce con seguridad — NO inventa. La UI
 * prellena el panel y el médico confirma antes de calcular.
 */
/**
 * Extrae los campos CATEGÓRICOS (selectores) del pase dictado: modo ventilatorio,
 * tipo de muestra, soporte, pupilas, parámetro de PLR, patrones venosos de VExUS,
 * modalidad de CKRT y configuración de ECMO. Conservador: solo mapea frases claras
 * (el panel muestra lo prellenado para que el médico lo revise). No inventa.
 */
export function extraerCategoricosUCI(texto: string): Record<string, string> {
  const t = norm(texto)
  const out: Record<string, string> = {}
  const tiene = (re: RegExp) => re.test(t)

  // Muestra gasométrica (exigir "arterial/venosa/capilar" junto a gaso/muestra)
  if (tiene(/\bgaso\w*\s+arterial\b/) || tiene(/\bmuestra\s+arterial\b/)) out.muestra = 'arterial'
  else if (tiene(/\bgaso\w*\s+venosa\b/) || tiene(/\bmuestra\s+venosa\b/)) out.muestra = 'venosa'
  else if (tiene(/\bgaso\w*\s+capilar\b/) || tiene(/\bmuestra\s+capilar\b/)) out.muestra = 'capilar'

  // Modo ventilatorio + soporte
  if (tiene(/\baprv\b|bivent/)) out.modo = 'APRV'
  else if (tiene(/\bsimv\b/)) out.modo = 'SIMV'
  else if (tiene(/presion control|control por presion|a\/?c\s+presion|asistido controlado por presion/)) out.modo = 'AC-PC'
  else if (tiene(/volumen control|control por volumen|a\/?c\s+volumen|asistido controlado por volumen/)) out.modo = 'AC-VC'
  else if (tiene(/presion soporte|ventilacion espontanea|\bpsv\b|\bp's\b/)) out.modo = 'PSV'
  else if (tiene(/\bcpap\b/)) out.modo = 'CPAP'
  else if (tiene(/no invasiva|\bvni\b|\bbipap\b/)) out.modo = 'VNI'
  else if (tiene(/alto flujo|canula nasal de alto flujo|\bafnc\b/)) out.modo = 'AFNC'
  else if (tiene(/aire ambiente|puntas nasales|mascarilla|oxigeno suplementario/)) out.modo = 'aire'
  if (tiene(/ventilacion mecanica|ventilad[oa]|intubad[oa]|en ventilador|asistido controlado|volumen control|presion control|\bsimv\b|\bcpap\b|\baprv\b/)) out.soporte = 'si'

  // Pupilas
  if (tiene(/pupilas?\s+fijas|midriasis fija|pupilas? arreactivas/)) out.pupilas = 'fijas'
  else if (tiene(/anisocor/)) out.pupilas = 'anisocoria'
  else if (tiene(/isocor|pupilas iguales|pupilas normales/)) out.pupilas = 'isocoricas'

  // Parámetro de PLR
  if (tiene(/lvot|\bvti\b|integral velocidad tiempo/)) out.plrParam = 'LVOT_VTI'
  else if (tiene(/volumen sistolico/)) out.plrParam = 'SV'
  else if (tiene(/gasto cardiaco|\bgasto\b/)) out.plrParam = 'CO'

  // VExUS: vena hepática / porta / renal → grave|leve|normal
  const sev = (m: string): string | null => /grav|sever/.test(m) ? 'grave' : /lev|moderad/.test(m) ? 'leve' : /normal/.test(m) ? 'normal' : null
  for (const [campo, nombre] of [['vHep', 'hepatic'], ['vPor', 'port'], ['vRen', 'renal']] as const) {
    const m = t.match(new RegExp(`${nombre}\\w*[^.]{0,30}?(grav\\w*|sever\\w*|lev\\w*|moderad\\w*|normal)`))
    if (m) { const s = sev(m[1]); if (s) out[campo] = s }
  }

  // Modalidad de CKRT
  if (tiene(/cvvhdf/)) out.ckrtMod = 'CVVHDF'
  else if (tiene(/cvvhd/)) out.ckrtMod = 'CVVHD'
  else if (tiene(/cvvh/)) out.ckrtMod = 'CVVH'
  else if (tiene(/\bscuf\b/)) out.ckrtMod = 'SCUF'

  // Configuración de ECMO
  if (tiene(/veno[\s-]?arterial|\becmo v\s?a\b|\bv\s?a\s?v\b/)) out.ecmoConf = tiene(/\bv\s?a\s?v\b/) ? 'VAV' : 'VA'
  else if (tiene(/veno[\s-]?venos|\becmo v\s?v\b/)) out.ecmoConf = 'VV'

  return out
}

export function extraerValoresUCI(texto: string): Record<string, string> {
  const t = norm(texto)
  const out: Record<string, string> = { ...extraerCategoricosUCI(texto) }
  for (const { campo, alias } of CAMPOS_UCI) {
    for (const a of alias) {
      const an = norm(a).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      // <alias> [de|a|en] <numero>  → primera coincidencia
      const re = new RegExp(`\\b${an}\\b(?:\\s+(?:de|a|en|es|fue|esta en))?\\s+((?:\\d+(?:\\.\\d+)?)|(?:${NUM_RE})(?:\\s+(?:y|punto|${NUM_RE}))*)`, 'i')
      const m = t.match(re)
      if (m) {
        const crudo = m[1]
        const val = /^\d/.test(crudo) ? crudo : parsearNumeroEs(crudo)
        if (val !== null && val !== '') { out[campo] = String(val); break }
      }
    }
  }
  return out
}
