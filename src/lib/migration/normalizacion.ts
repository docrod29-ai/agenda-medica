/**
 * NORMALIZAR SIN INVENTAR.
 *
 * ── LA FECHA `03/04/25` ──────────────────────────────────────────────────────
 *
 * Es el caso que resume el módulo entero. Puede ser el 3 de abril o el 4 de
 * marzo, y el año puede ser 1925 o 2025. Un importador normal elige una y sigue.
 * Ese es exactamente el fallo que no se puede permitir aquí: la fecha entra al
 * expediente, sale en la receta, y nadie vuelve a mirar el archivo original.
 *
 * Aquí NO se elige. Se devuelve `ambigua` con las dos lecturas posibles, y el
 * médico dice de qué sistema salió el archivo. Una vez dicho, ya no es ambigua
 * para NINGUNA fila: el formato es del archivo, no de la celda.
 *
 * ── LA OTRA MITAD: EL VALOR QUE NO SE RECONOCE ───────────────────────────────
 *
 * `sexo` es el segundo caso. El importador anterior hacía esto:
 *
 *     sexo: fila.sexo === 'Masculino' || ... ? fila.sexo : undefined
 *
 * Un archivo que trae `M`, `F`, `Male` o `1` perdía la columna ENTERA en
 * silencio. Y peor: `undefined` no se lee como «no lo sé», se lee como «no
 * tiene» — que es la regla 4 de seguridad clínica al revés («ausencia de dato no
 * es dato de ausencia»).
 *
 * Aquí un valor no reconocido devuelve su razón CON el texto original
 * conservado. Nunca `undefined` a secas.
 *
 * Módulo PURO. Sin reloj propio: la fecha de «hoy» se inyecta, porque una
 * función que consulta el reloj no se puede probar dos veces con el mismo
 * resultado — y el determinismo del ensayo depende de esto.
 */
import type { Razon } from './contrato'

/* ═══════════════════════ EL RESULTADO DE NORMALIZAR ═══════════════════════ */

/**
 * Cuatro desenlaces, y ninguno quinto.
 *
 * `ambiguo` es el que hace distinto a este módulo: no es un error (el dato está
 * ahí y se entiende) ni un acierto (hay más de una lectura). Fundirlo con
 * cualquiera de los otros dos es lo que produce datos inventados.
 */
export type Normalizado<T> =
  | { readonly clase: 'valor'; readonly valor: T; readonly crudo: string; readonly aplicado: readonly string[] }
  | { readonly clase: 'ambiguo'; readonly crudo: string; readonly lecturas: readonly string[]; readonly razon: Razon }
  | { readonly clase: 'invalido'; readonly crudo: string; readonly razon: Razon }
  | { readonly clase: 'vacio'; readonly crudo: string }

function valor<T>(v: T, crudo: string, aplicado: string[]): Normalizado<T> {
  return { clase: 'valor', valor: v, crudo, aplicado }
}

/** ¿Este resultado aporta un dato utilizable? */
export function tieneValor<T>(n: Normalizado<T>): n is Extract<Normalizado<T>, { clase: 'valor' }> {
  return n.clase === 'valor'
}

/* ═══════════════════════ TEXTO ═══════════════════════ */

/**
 * Tope de tamaño por campo.
 *
 * No es una manía de higiene: un CSV exportado de un sistema viejo trae a veces
 * la nota entera de veinte consultas pegada en una celda, y Firestore tiene un
 * tope de 1 MiB por documento. Un solo campo desbocado tumba la escritura del
 * expediente COMPLETO, y con la escritura se pierde todo lo demás de esa fila.
 * Se rechaza el campo con su razón, que es peor que aceptarlo y mucho mejor que
 * perder la fila entera sin saber por qué.
 */
export const MAXIMO_CAMPO = 20_000

/** Caracteres que delatan un archivo leído con la codificación equivocada. */
const SINTOMA_MOJIBAKE = /\uFFFD|\u00C3[\u0080-\u00BF]|\u00E2\u0080|\u00C2[\u0080-\u00BF]/

/** Controles invisibles, menos los que un CSV usa de verdad (tab, salto, retorno). */
const CONTROL_INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\u2060]/g

/** Los acentos ya descompuestos por NFD. */
const DIACRITICOS = /[\u0300-\u036F]/g

export function normalizarTexto(crudo: string): Normalizado<string> {
  const aplicado: string[] = []
  let s = crudo

  // El BOM viaja pegado a la primera celda de la primera fila y convierte
  // «Nombre» en «﻿Nombre», que no empareja con ningún sinónimo.
  if (s.charCodeAt(0) === 0xfeff) { s = s.slice(1); aplicado.push('quitar-bom') }

  /**
   * El apóstrofo de `csv-seguro.ts` vuelve a casa.
   *
   * Al exportar, una celda que empieza por `=` se escribe como `'=`. Si ese CSV
   * se vuelve a importar —el caso más común de todos, porque es cómo un médico
   * mueve datos entre dos consultorios suyos— el apóstrofo es NUESTRO, no del
   * dato. Sin esto, cada ida y vuelta le añade uno.
   */
  if (/^'[=+\-@\t\r]/.test(s)) { s = s.slice(1); aplicado.push('quitar-escape-formula') }

  const antes = s
  // Los controles invisibles rompen las comparaciones de nombre sin que nadie
  // vea por qué: dos nombres «iguales» que no empatan.
  s = s.replace(CONTROL_INVISIBLE, '')
  if (s !== antes) aplicado.push('quitar-control')

  const conEspacios = s
  s = s.replace(/\s+/g, ' ').trim()
  if (s !== conEspacios) aplicado.push('colapsar-espacios')

  if (SINTOMA_MOJIBAKE.test(s)) return { clase: 'invalido', crudo, razon: 'INVALID_ENCODING' }
  if (s === '') return { clase: 'vacio', crudo }
  if (s.length > MAXIMO_CAMPO) return { clase: 'invalido', crudo, razon: 'FIELD_TOO_LONG' }

  return valor(s, crudo, aplicado)
}

/* ═══════════════════════ FECHAS ═══════════════════════ */

/** Cómo lee las fechas el sistema del que salió el archivo. */
export type FormatoFecha = 'dmy' | 'mdy' | 'ymd' | 'desconocido'

const DIAS_DE_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function fechaReal(a: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false
  if (m === 2 && d === 29) return (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0
  return d <= DIAS_DE_MES[m - 1]
}

const iso = (a: number, m: number, d: number): string =>
  `${String(a).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

/**
 * El año de dos dígitos.
 *
 * `25` es 2025 o 1925, y en fechas de nacimiento las dos son perfectamente
 * posibles: un paciente de 1 año y uno de 101. La regla del pivote (00-30 →
 * 2000s) es la convención de la industria y **también es una suposición**, así
 * que se aplica y se DECLARA en `aplicado`, no se esconde. Quien lea el informe
 * ve `ano-2-digitos-pivote-30` y sabe que ahí hubo una decisión, no una lectura.
 */
const PIVOTE = 30
function expandirAnio(aa: number): number {
  return aa <= PIVOTE ? 2000 + aa : 1900 + aa
}

/** Edad máxima antes de considerar la fecha un error de captura, no un decano. */
export const EDAD_IMPLAUSIBLE = 130

export interface OpcionesFecha {
  /** El formato declarado del archivo. `desconocido` es lo que produce ambigüedad. */
  readonly formato?: FormatoFecha
  /** «Hoy» en ISO (`YYYY-MM-DD`). Inyectado: el determinismo depende de ello. */
  readonly hoy: string
}

/**
 * Una fecha del archivo → ISO `YYYY-MM-DD`, o la constancia de que no se sabe.
 *
 * El orden de las comprobaciones importa: primero lo que se lee sin duda posible
 * (ISO, y los días > 12 que se delatan solos), y sólo al final lo genuinamente
 * ambiguo. Descartar la ambigüedad cuando NO la hay es lo que evita mandar a
 * revisión medio archivo por nada — y un archivo donde todo va a revisión se
 * revisa como se revisa todo lo que es demasiado: en bloque y sin mirar.
 */
export function normalizarFecha(crudo: string, opciones: OpcionesFecha): Normalizado<string> {
  const t = normalizarTexto(crudo)
  if (t.clase !== 'valor') return t as Normalizado<string>
  const s = t.valor
  const aplicado = [...t.aplicado]

  // 1. ISO / año-primero. Sin ambigüedad posible: el año de 4 dígitos ancla todo.
  const mIso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ].*)?$/.exec(s)
  if (mIso) {
    const [a, m, d] = [Number(mIso[1]), Number(mIso[2]), Number(mIso[3])]
    if (!fechaReal(a, m, d)) return { clase: 'invalido', crudo, razon: 'INVALID_DATE' }
    return plausible(iso(a, m, d), crudo, [...aplicado, 'iso'], opciones)
  }

  const mNum = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(s)
  if (!mNum) return { clase: 'invalido', crudo, razon: 'INVALID_DATE' }

  const p1 = Number(mNum[1])
  const p2 = Number(mNum[2])
  const anioCrudo = mNum[3]
  const a = anioCrudo.length === 2 ? expandirAnio(Number(anioCrudo)) : Number(anioCrudo)
  if (anioCrudo.length === 2) aplicado.push(`ano-2-digitos-pivote-${PIVOTE}`)

  const comoDmy = fechaReal(a, p2, p1)
  const comoMdy = fechaReal(a, p1, p2)

  // 2. El formato declarado manda. Es un dato del médico, no una suposición.
  //    `ymd` cae aquí como dmy porque un archivo año-primero con partes de 1-2
  //    dígitos ya se leyó arriba; lo que llega aquí es día-primero.
  if (opciones.formato === 'dmy' || opciones.formato === 'ymd') {
    if (!comoDmy) return { clase: 'invalido', crudo, razon: 'INVALID_DATE' }
    return plausible(iso(a, p2, p1), crudo, [...aplicado, 'formato-declarado-dmy'], opciones)
  }
  if (opciones.formato === 'mdy') {
    if (!comoMdy) return { clase: 'invalido', crudo, razon: 'INVALID_DATE' }
    return plausible(iso(a, p1, p2), crudo, [...aplicado, 'formato-declarado-mdy'], opciones)
  }

  // 3. Sin formato declarado: sólo se acepta lo que se delata solo.
  if (comoDmy && !comoMdy) return plausible(iso(a, p2, p1), crudo, [...aplicado, 'desambiguada-dia-mayor-12'], opciones)
  if (comoMdy && !comoDmy) return plausible(iso(a, p1, p2), crudo, [...aplicado, 'desambiguada-mes-mayor-12'], opciones)
  if (!comoDmy && !comoMdy) return { clase: 'invalido', crudo, razon: 'INVALID_DATE' }

  /**
   * LAS DOS LECTURAS VALEN. Aquí es donde un importador normal adivina.
   *
   * Se devuelven las dos, ordenadas, para que la pantalla pueda enseñar
   * literalmente «¿3 de abril o 4 de marzo?» en vez de pedirle al médico que
   * imagine el problema. Ordenadas y no en orden de preferencia: no hay
   * preferencia, y sugerir una es adivinar con otro nombre.
   */
  return {
    clase: 'ambiguo',
    crudo,
    lecturas: [iso(a, p2, p1), iso(a, p1, p2)].sort(),
    razon: 'AMBIGUOUS_DATE',
  }
}

/**
 * Una fecha bien leída todavía puede ser imposible.
 *
 * Nacer mañana no pasa, y 130 años tampoco. Los dos casos son errores de captura
 * frecuentísimos (el año de la cita en la columna del nacimiento), y los dos
 * envenenan cualquier cálculo pediátrico o geriátrico que venga después.
 */
function plausible(fecha: string, crudo: string, aplicado: string[], o: OpcionesFecha): Normalizado<string> {
  if (fecha > o.hoy) return { clase: 'invalido', crudo, razon: 'DATE_IN_FUTURE' }
  const anios = (Date.parse(o.hoy) - Date.parse(fecha)) / (365.2425 * 24 * 3600 * 1000)
  if (anios > EDAD_IMPLAUSIBLE) return { clase: 'invalido', crudo, razon: 'DATE_IMPLAUSIBLE' }
  return valor(fecha, crudo, aplicado)
}

/* ═══════════════════════ TELÉFONO, CORREO, CURP ═══════════════════════ */

/** Por debajo de esto no es un teléfono: es una extensión o un resto de captura. */
export const MINIMO_DIGITOS_TELEFONO = 7

/**
 * Teléfono a dígitos. NO se le antepone lada de país.
 *
 * Suponer `+52` porque el consultorio está en México le cambia el número a un
 * paciente que vive en la frontera y tiene celular de San Diego. Los dígitos que
 * vinieron son los dígitos que hay; `duplicados.ts` ya compara por los 10
 * finales, así que la comparación aguanta el prefijo sin necesidad de inventarlo.
 */
export function normalizarTelefono(crudo: string): Normalizado<string> {
  const t = normalizarTexto(crudo)
  if (t.clase !== 'valor') return t as Normalizado<string>
  const d = t.valor.replace(/\D/g, '')
  if (d === '') return { clase: 'vacio', crudo }
  if (d.length < MINIMO_DIGITOS_TELEFONO) return { clase: 'invalido', crudo, razon: 'INVALID_PHONE' }
  return valor(d, crudo, [...t.aplicado, 'solo-digitos'])
}

const FORMA_CORREO = /^[^\s@,;]+@[^\s@,;.]+(\.[^\s@,;.]+)+$/

export function normalizarEmail(crudo: string): Normalizado<string> {
  const t = normalizarTexto(crudo)
  if (t.clase !== 'valor') return t as Normalizado<string>
  const s = t.valor.toLowerCase()
  if (!FORMA_CORREO.test(s)) return { clase: 'invalido', crudo, razon: 'INVALID_EMAIL' }
  return valor(s, crudo, [...t.aplicado, 'minusculas'])
}

/**
 * Forma oficial del CURP. NO valida el dígito verificador.
 *
 * Deliberado: el algoritmo del verificador cambió con los años y hay CURP
 * legítimos en circulación que no lo cumplen. Rechazar por eso le borraría a un
 * paciente real el único identificador que tiene — y el CURP es la señal más
 * fuerte de `duplicados.ts`, la única que decide por sí sola.
 */
const FORMA_CURP = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[0-9A-Z]\d$/

export function normalizarCurp(crudo: string): Normalizado<string> {
  const t = normalizarTexto(crudo)
  if (t.clase !== 'valor') return t as Normalizado<string>
  const s = t.valor.toUpperCase().replace(/\s/g, '')
  if (!FORMA_CURP.test(s)) return { clase: 'invalido', crudo, razon: 'INVALID_CURP' }
  return valor(s, crudo, [...t.aplicado, 'mayusculas'])
}

/* ═══════════════════════ SEXO ═══════════════════════ */

export type Sexo = 'Masculino' | 'Femenino' | 'Otro'

/**
 * Lo que un archivo real trae en la columna de sexo.
 *
 * La lista es VOCABULARIO, no criterio (regla 5 de seguridad clínica): que falte
 * un término significa que ese valor NO se traduce — no que se dé por bueno
 * ninguno. Por eso lo desconocido devuelve `UNRECOGNIZED_ENUM` con el crudo
 * intacto, y no `undefined`.
 *
 * `1`/`2` NO están, y es deliberado: hay sistemas donde 1 es hombre y otros
 * donde 1 es mujer. Traducirlo sería jugárselo a cara o cruz en el 50 % de los
 * expedientes, y el sexo entra en el ajuste de dosis y en los tamices por edad.
 */
const SEXO_CONOCIDO: Readonly<Record<string, Sexo>> = {
  m: 'Masculino', h: 'Masculino', masculino: 'Masculino', hombre: 'Masculino',
  male: 'Masculino', man: 'Masculino', varon: 'Masculino',
  f: 'Femenino', femenino: 'Femenino', mujer: 'Femenino',
  female: 'Femenino', woman: 'Femenino',
  o: 'Otro', otro: 'Otro', other: 'Otro', x: 'Otro',
  'no binario': 'Otro', 'non binary': 'Otro', 'non-binary': 'Otro',
}

export function normalizarSexo(crudo: string): Normalizado<Sexo> {
  const t = normalizarTexto(crudo)
  if (t.clase !== 'valor') return t as Normalizado<Sexo>
  const clave = t.valor.normalize('NFD').replace(DIACRITICOS, '').toLowerCase()
  const s = SEXO_CONOCIDO[clave]
  if (!s) return { clase: 'invalido', crudo, razon: 'UNRECOGNIZED_ENUM' }
  return valor(s, crudo, [...t.aplicado, 'vocabulario-sexo'])
}

/* ═══════════════════════ CANTIDADES ═══════════════════════ */

/**
 * Una cantidad clínica del archivo: número + unidad, o nada.
 *
 * **No se supone la unidad.** Un `500` en una columna de dosis puede ser mg o
 * mcg, y el par mg↔mcg es de los prohibidos en todo este repositorio: el factor
 * es mil. Sin unidad, el número se conserva como TEXTO de origen con
 * `MISSING_UNIT` — nunca se convierte en una dosis.
 */
export interface Cantidad {
  readonly numero: number
  readonly unidad: string
}

export function normalizarCantidad(crudo: string): Normalizado<Cantidad> {
  const t = normalizarTexto(crudo)
  if (t.clase !== 'valor') return t as Normalizado<Cantidad>
  const m = /^([\d.,]+)\s*([a-zA-Zµμ/%]+)?$/.exec(t.valor)
  if (!m) return { clase: 'invalido', crudo, razon: 'MISSING_UNIT' }
  if (!m[2]) return { clase: 'invalido', crudo, razon: 'MISSING_UNIT' }
  const numero = Number(m[1].replace(/,/g, ''))
  if (!Number.isFinite(numero)) return { clase: 'invalido', crudo, razon: 'MISSING_UNIT' }
  return valor({ numero, unidad: m[2] }, crudo, [...t.aplicado, 'cantidad'])
}
