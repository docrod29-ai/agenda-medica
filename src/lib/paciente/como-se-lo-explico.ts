/**
 * INSTRUCCIONES PARA EL PACIENTE, EN ESPAÑOL LLANO — REG-242.
 *
 * ── EL HUECO ────────────────────────────────────────────────────────────────
 *
 * Suki las tiene («patient instructions a nivel de lectura de quinto grado, en
 * 80 idiomas»). Nabla las tiene —de hecho es lo ÚNICO que traduce al idioma del
 * paciente, porque la nota clínica la deja en inglés «per U.S. regulations»—.
 *
 * NexusMED no las tenía. El paciente salía del consultorio con una receta y con
 * lo que hubiera retenido de la conversación.
 *
 * ── LA DIFERENCIA DE FONDO CON ELLOS ────────────────────────────────────────
 *
 * Ellos las **generan** con un modelo. Un modelo que redacta instrucciones para
 * un paciente puede añadir un consejo que el médico no dio — «tome mucha agua»,
 * «si empeora acuda a urgencias»— y eso, en un papel que sale del consultorio
 * con el membrete del médico, es una indicación médica que nadie firmó.
 *
 * Aquí se **componen**. Cada línea sale de un campo que el médico ya revisó y
 * firmó: el fármaco, la dosis, la vía, la frecuencia, la duración, el estudio,
 * la próxima cita. **Nada que no esté en la nota puede aparecer aquí.**
 *
 * Y hay una compuerta que lo comprueba: `cifrasClinicas` sobre el resultado no
 * puede contener ninguna cifra que no esté en la nota (ver el guardián).
 *
 * ── LO QUE SE PERMITE, Y POR QUÉ ES SEGURO ──────────────────────────────────
 *
 * Traducir «vía oral» a «por la boca» no es una decisión clínica: es la misma
 * indicación en las palabras del paciente.
 *
 * Convertir «cada 8 horas» en «cada 8 horas — 3 veces al día» tampoco: es
 * 24 ÷ 8, aritmética exacta sobre lo que el médico dictó. Se hace SÓLO cuando
 * el resultado es exacto (8, 12, 24 sí; 5 no), porque «cada 5 horas» no son
 * «4,8 veces al día» y redondearlo sí sería inventar una pauta.
 *
 * ── LO QUE NO SE HACE, NUNCA ────────────────────────────────────────────────
 *
 * No se añaden consejos generales. No se dice cuándo acudir a urgencias. No se
 * explica para qué sirve el fármaco. Todo eso son indicaciones médicas, y las
 * da el médico o no las da nadie.
 *
 * Módulo PURO.
 */

export interface MedicamentoParaExplicar {
  nombre?: unknown
  dosis?: unknown
  via?: unknown
  frecuencia?: unknown
  duracion?: unknown
}

export interface EntradaInstrucciones {
  medicamentos?: readonly MedicamentoParaExplicar[]
  /** Estudios pedidos, tal como quedaron en la orden. */
  estudios?: readonly unknown[]
  /** Lo que el médico escribió como indicaciones, si escribió algo. */
  indicacionesDelMedico?: unknown
  /**
   * CUÁNDO VOLVER — la fecha de seguimiento que el médico fijó.
   *
   * No es lo mismo que `proximaCita` y por eso son dos campos. «Vuelve el 1 de
   * septiembre» es una **indicación del médico**; «su próxima cita es el 1 de
   * septiembre a las 10:00» es una **cita agendada**. Meter la primera bajo el
   * título de la segunda le dice al paciente que tiene una cita que nadie ha
   * apartado — y se presentará ese día esperando que lo esperen.
   */
  cuandoVolver?: unknown
  /** Fecha o texto de la próxima cita YA agendada, si la hay. */
  proximaCita?: unknown
}

export interface BloqueInstrucciones {
  titulo: string
  lineas: readonly string[]
}

const txt = (v: unknown) => String(v ?? '').trim()

/**
 * «vía oral» → «por la boca».
 *
 * No es interpretación: es la misma vía dicha como la entiende el paciente. Lo
 * que NO se traduce se deja tal cual — es preferible que el paciente lea
 * «subcutánea» a que se le diga algo que el médico no dijo.
 */
const COMO_SE_TOMA: readonly (readonly [RegExp, string])[] = [
  [/\b(v[íi]a\s+)?oral\b|\bv\.?o\.?\b/i, 'por la boca'],
  [/\bsublingual\b/i, 'debajo de la lengua'],
  [/\bt[óo]pic[ao]\b|\bcut[áa]ne[ao]\b/i, 'sobre la piel'],
  [/\boft[áa]lmic[ao]\b|\bocular\b/i, 'en los ojos'],
  [/\b[óo]tic[ao]\b/i, 'en los oídos'],
  [/\bnasal\b/i, 'en la nariz'],
  [/\binhalad[ao]\b|\binhalatoria\b/i, 'inhalado'],
  [/\brectal\b/i, 'por el recto'],
  [/\bvaginal\b/i, 'por la vagina'],
  [/\bsubcut[áa]nea?\b|\bs\.?c\.?\b/i, 'inyectado bajo la piel'],
  [/\bintramuscular\b|\bi\.?m\.?\b/i, 'inyectado en el músculo'],
  [/\bintravenosa?\b|\bi\.?v\.?\b/i, 'por la vena'],
]

export function viaEnLlano(via: unknown): string {
  const v = txt(via)
  if (!v) return ''
  for (const [re, llano] of COMO_SE_TOMA) if (re.test(v)) return llano
  return v
}

/**
 * «cada 8 horas» → «cada 8 horas — 3 veces al día».
 *
 * SÓLO cuando 24 ÷ n es exacto. «Cada 5 horas» no son «4,8 veces al día», y
 * redondearlo sería inventarle una pauta al médico.
 */
export function vecesAlDia(frecuencia: unknown): string | null {
  const m = txt(frecuencia).match(/c(?:ada|\/)\s*(\d+)\s*(?:h|hr|hrs|horas?)\b/i)
  if (!m) return null
  const horas = Number(m[1])
  if (!horas || horas > 24 || 24 % horas !== 0) return null
  const n = 24 / horas
  return n === 1 ? 'una vez al día' : `${n} veces al día`
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
] as const

/**
 * `2026-09-01` → «1 de septiembre de 2026». Lo que no sea una fecha ISO se
 * devuelve TAL CUAL: si el médico escribió «en tres semanas», eso es lo que el
 * paciente tiene que leer.
 *
 * ── POR QUÉ SE PARTE LA CADENA A MANO Y NO SE USA `new Date()` ──────────────
 *
 * `new Date('2026-09-01')` es medianoche **UTC**, y en México eso son las 18:00
 * del 31 de agosto. Formatearlo con la zona local le adelanta un día a la fecha
 * de seguimiento. Es el mismo defecto que REG-293 acabó de cerrar del lado de
 * los cobros, y aquí sale impreso en la hoja del paciente.
 */
export function fechaEnLlano(v: unknown): string {
  const s = txt(v)
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (!m) return s
  const mes = MESES[Number(m[2]) - 1]
  if (!mes) return s
  return `${Number(m[3])} de ${mes} de ${m[1]}`
}

/** Una línea por medicamento, con lo que el médico puso y nada más. */
export function comoTomarlo(m: MedicamentoParaExplicar): string {
  const partes: string[] = []
  const nombre = txt(m.nombre)
  if (!nombre) return ''
  partes.push(nombre)
  if (txt(m.dosis)) partes.push(txt(m.dosis))

  const via = viaEnLlano(m.via)
  if (via) partes.push(via)

  const frec = txt(m.frecuencia)
  if (frec) {
    const cuantas = vecesAlDia(frec)
    partes.push(cuantas ? `${frec} (${cuantas})` : frec)
  }

  const dur = txt(m.duracion)
  if (dur) partes.push(`durante ${dur}`)

  return partes.join(' · ')
}

/**
 * La hoja completa.
 *
 * Un bloque vacío NO se incluye: una hoja que dice «Estudios: —» le hace leer
 * al paciente una línea que no le dice nada.
 */
export function comoSeLoExplico(e: EntradaInstrucciones): BloqueInstrucciones[] {
  const out: BloqueInstrucciones[] = []

  const meds = (e.medicamentos ?? []).map(comoTomarlo).filter(Boolean)
  if (meds.length) out.push({ titulo: 'Sus medicamentos', lineas: meds })

  const estudios = (e.estudios ?? []).map(txt).filter(Boolean)
  if (estudios.length) out.push({ titulo: 'Estudios que le pidió el médico', lineas: estudios })

  /* Las indicaciones del médico van LITERALES. Reescribirlas «para que se
     entiendan mejor» es exactamente donde se colaría un consejo que no dio. */
  const ind = txt(e.indicacionesDelMedico)
  if (ind) out.push({ titulo: 'Indicaciones de su médico', lineas: ind.split('\n').map(l => l.trim()).filter(Boolean) })

  const volver = fechaEnLlano(e.cuandoVolver)
  if (volver) out.push({ titulo: 'Cuándo volver', lineas: [volver] })

  const cita = fechaEnLlano(e.proximaCita)
  if (cita) out.push({ titulo: 'Su próxima cita', lineas: [cita] })

  return out
}

/** La hoja como texto plano — para imprimir, copiar o mandar por WhatsApp. */
export function comoTexto(bloques: readonly BloqueInstrucciones[]): string {
  return bloques
    .map(b => `${b.titulo.toUpperCase()}\n${b.lineas.map(l => `• ${l}`).join('\n')}`)
    .join('\n\n')
}

export const POR_QUE_SE_COMPONE_Y_NO_SE_GENERA =
  'Un modelo que redacta instrucciones puede añadir un consejo que el médico no ' +
  'dio. En un papel con su membrete, eso es una indicación médica que nadie ' +
  'firmó. Aquí cada línea sale de un campo que él ya revisó.'

export const POR_QUE_24_ENTRE_N_ES_SEGURO =
  '24 ÷ 8 = 3 es aritmética exacta sobre lo que el médico dictó, no una ' +
  'decisión. Por eso sólo se hace cuando el resultado es exacto: «cada 5 horas» ' +
  'no son «4,8 veces al día», y redondearlo sí sería inventar una pauta.'

export const LO_QUE_HACEN_ELLOS =
  'Suki y Nabla las generan con un modelo. Nabla, además, es lo único que ' +
  'traduce al idioma del paciente: la nota clínica la deja en inglés.'
