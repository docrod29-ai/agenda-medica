/**
 * ¿ESTE PLAN GANA O PIERDE DINERO?
 *
 * ── PARA QUÉ SIRVE ───────────────────────────────────────────────────────────
 *
 * Un plan de cuota fija con un consumo variable dentro tiene siempre un punto en
 * el que el cliente cuesta más de lo que paga. La pregunta no es SI existe, es
 * DÓNDE está — y con cuántos usuarios de ese tipo deja de compensar.
 *
 * ── LA REGLA QUE ORDENA TODO ESTE MÓDULO ─────────────────────────────────────
 *
 * **No se inventa un solo número.**
 *
 * Es la misma regla que la tabla de tarifas, y por el mismo motivo: un simulador
 * financiero con una cifra recordada de memoria produce un margen que PARECE
 * exacto y miente. Y de ese margen sale la decisión de a cuánto vender.
 *
 * Así que:
 *
 *  · El costo de IA por nota sale del LIBRO DE COSTOS, que es medición real de
 *    lo que ya pasó. No de una estimación de tokens.
 *  · Todo lo que no se puede medir desde aquí —comisión de pago, infraestructura,
 *    soporte, WhatsApp— es un PARÁMETRO que nace vacío. Si falta, el resultado
 *    lo declara y NO presenta un margen como si estuviera completo.
 *
 * Un margen calculado sobre la mitad de los costos no es un margen: en pantalla
 * se ve exactamente igual que uno completo, y es la clase de cifra por la que se
 * baja un precio que no se podía bajar.
 *
 * Módulo PURO.
 */

/** Cuánto usa la IA un médico al mes. Los perfiles del charter. */
export type PerfilUso = 'bajo' | 'normal' | 'alto' | 'extremo'

export interface Perfil {
  clave: PerfilUso
  etiqueta: string
  /** Notas con IA al mes. */
  notasMes: number
  /** Qué proporción de esas notas usa cada motor. Suma 1. */
  mezcla: { rapida: number; estandar: number; maxima: number }
}

/**
 * Los perfiles NO son una medición: son escenarios para preguntarse «¿y si?».
 *
 * Por eso llevan nombres de escenario y no de dato, y por eso el simulador
 * enseña los cuatro a la vez en vez de uno «representativo»: el que decide es el
 * dueño mirando cuál se parece a sus clientes, no un promedio inventado aquí.
 */
export const PERFILES: readonly Perfil[] = [
  { clave: 'bajo',    etiqueta: 'Bajo · 20 notas',     notasMes: 20,  mezcla: { rapida: 0.6, estandar: 0.4, maxima: 0.0 } },
  { clave: 'normal',  etiqueta: 'Normal · 60 notas',   notasMes: 60,  mezcla: { rapida: 0.3, estandar: 0.6, maxima: 0.1 } },
  { clave: 'alto',    etiqueta: 'Alto · 120 notas',    notasMes: 120, mezcla: { rapida: 0.2, estandar: 0.5, maxima: 0.3 } },
  { clave: 'extremo', etiqueta: 'Extremo · 250 notas', notasMes: 250, mezcla: { rapida: 0.1, estandar: 0.4, maxima: 0.5 } },
] as const

/**
 * Lo que cuesta de verdad una nota de cada motor, MEDIDO.
 *
 * Sale del libro de costos: es el promedio de lo que ya se gastó, no una
 * estimación de tokens. `null` cuando todavía no hay suficientes llamadas de ese
 * motor para promediar nada — y entonces el simulador lo dice en vez de rellenar.
 */
export interface CostoMedidoPorNota {
  rapida: number | null
  estandar: number | null
  maxima: number | null
  /** Cuántas llamadas reales sostienen cada promedio. Sin esto no se puede confiar. */
  muestras: { rapida: number; estandar: number; maxima: number }
}

/**
 * Los costos que este sistema NO puede medir. Nacen vacíos a propósito.
 *
 * Cargar aquí una cifra recordada sería exactamente lo que la tabla de tarifas
 * prohíbe. Los pone el dueño, con su fuente, cuando los tenga.
 */
export interface OtrosCostosMensuales {
  /** Comisión del procesador de pagos, en % del ingreso. */
  comisionPagoPct: number | null
  /** Infraestructura por usuario y mes (MXN). */
  infraPorUsuario: number | null
  /** Soporte imputado por usuario y mes (MXN). */
  soportePorUsuario: number | null
  /** Mensajería por usuario y mes (MXN). */
  mensajeriaPorUsuario: number | null
}

export const OTROS_COSTOS_VACIOS: OtrosCostosMensuales = {
  comisionPagoPct: null,
  infraPorUsuario: null,
  soportePorUsuario: null,
  mensajeriaPorUsuario: null,
}

export interface EntradaSimulacion {
  /** Precio del plan, MXN/mes. Del catálogo vigente. */
  precioMXN: number
  usuarios: number
  perfil: Perfil
  costoNota: CostoMedidoPorNota
  /** Tipo de cambio USD→MXN. Sin él NO se puede comparar el costo con el precio. */
  usdMxn: number | null
  otros?: OtrosCostosMensuales
}

export interface Simulacion {
  ingresoMXN: number
  /** Costo de IA imputable a los clientes. `null` si falta algo para calcularlo. */
  costoIaMXN: number | null
  otrosCostosMXN: number | null
  /** Ingreso − costos. `null` mientras falte cualquier pieza. */
  margenMXN: number | null
  margenPct: number | null
  /** Notas al mes a partir de las cuales ESE cliente cuesta más de lo que paga. */
  puntoDePerdidaNotas: number | null
  /**
   * Qué falta para que el resultado sea completo. Vacío = se puede decidir con
   * esto. NO vacío = lo de arriba es parcial y no debe usarse para fijar precio.
   */
  faltan: string[]
}

const redondea = (n: number) => Math.round(n * 100) / 100

/** El costo de IA de UNA nota según la mezcla de motores del perfil. */
function costoNotaMezcla(perfil: Perfil, c: CostoMedidoPorNota): { usd: number | null; faltan: string[] } {
  const faltan: string[] = []
  let usd = 0
  for (const [motor, proporcion] of Object.entries(perfil.mezcla) as [keyof Perfil['mezcla'], number][]) {
    if (proporcion <= 0) continue                       // un motor que no se usa no hace falta medirlo
    const medido = c[motor]
    if (medido == null) { faltan.push(`costo medido de una nota ${motor}`); continue }
    usd += medido * proporcion
  }
  return { usd: faltan.length ? null : usd, faltan }
}

/**
 * Simula UN plan con UN perfil de uso.
 *
 * Devuelve `null` en cada cifra que no se pueda calcular con datos reales, y la
 * lista de lo que falta. Nunca completa un hueco con una suposición.
 */
export function simular(e: EntradaSimulacion): Simulacion {
  const usuarios = Math.max(0, Math.floor(e.usuarios))
  const ingresoMXN = redondea(e.precioMXN * usuarios)

  const faltan: string[] = []
  const { usd: usdPorNota, faltan: faltanMotores } = costoNotaMezcla(e.perfil, e.costoNota)
  faltan.push(...faltanMotores)
  if (e.usdMxn == null || !(e.usdMxn > 0)) faltan.push('tipo de cambio USD→MXN')

  const costoIaMXN = usdPorNota != null && e.usdMxn != null && e.usdMxn > 0
    ? redondea(usdPorNota * e.perfil.notasMes * usuarios * e.usdMxn)
    : null

  const o = e.otros ?? OTROS_COSTOS_VACIOS
  const nombres: Record<keyof OtrosCostosMensuales, string> = {
    comisionPagoPct: 'comisión del procesador de pagos',
    infraPorUsuario: 'infraestructura por usuario',
    soportePorUsuario: 'soporte por usuario',
    mensajeriaPorUsuario: 'mensajería por usuario',
  }
  for (const k of Object.keys(nombres) as (keyof OtrosCostosMensuales)[]) {
    if (o[k] == null) faltan.push(nombres[k])
  }
  const otrosCostosMXN = faltan.some(f => Object.values(nombres).includes(f))
    ? null
    : redondea(
        ingresoMXN * ((o.comisionPagoPct ?? 0) / 100) +
        usuarios * ((o.infraPorUsuario ?? 0) + (o.soportePorUsuario ?? 0) + (o.mensajeriaPorUsuario ?? 0)),
      )

  const completo = costoIaMXN != null && otrosCostosMXN != null
  const margenMXN = completo ? redondea(ingresoMXN - costoIaMXN! - otrosCostosMXN!) : null
  const margenPct = margenMXN != null && ingresoMXN > 0 ? redondea((margenMXN / ingresoMXN) * 100) : null

  /**
   * EL NÚMERO QUE DE VERDAD SE BUSCA: a partir de cuántas notas ese cliente
   * cuesta más de lo que paga.
   *
   * Se calcula sólo con el costo de IA aunque falten los demás, y se dice: es un
   * techo optimista —el punto real llega ANTES— y saberlo aproximado vale más
   * que no saberlo. Lo que no se hace es meterlo en el margen como si fuera
   * completo.
   */
  const costoPorNotaMXN = usdPorNota != null && e.usdMxn != null && e.usdMxn > 0 ? usdPorNota * e.usdMxn : null
  const puntoDePerdidaNotas = costoPorNotaMXN != null && costoPorNotaMXN > 0
    ? Math.floor(e.precioMXN / costoPorNotaMXN)
    : null

  return { ingresoMXN, costoIaMXN, otrosCostosMXN, margenMXN, margenPct, puntoDePerdidaNotas, faltan: [...new Set(faltan)] }
}

/** ¿Este perfil pierde dinero con este plan? `null` cuando no se puede afirmar. */
export function pierdeDinero(s: Simulacion): boolean | null {
  if (s.margenMXN == null) return null
  return s.margenMXN < 0
}

export const POR_QUE_NACE_INCOMPLETO =
  'Porque un simulador financiero con una cifra recordada de memoria produce un ' +
  'margen que PARECE exacto y miente — y en pantalla se ve exactamente igual que ' +
  'uno completo. De ese margen sale la decisión de a cuánto vender, así que ' +
  'mientras falte un costo el resultado lo dice en vez de rellenarlo.'
