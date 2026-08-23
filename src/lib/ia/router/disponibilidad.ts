/**
 * QUIÉN ESTÁ EN PIE — salud de proveedores, y por qué un 401 no se reintenta
 * con otro modelo.
 *
 * #313 §I. Este módulo NO reintenta nada: el gateway ya tiene su cascada y su
 * timeout, y `protocolo.siguienteModelo()` ya decide cuándo pasar al siguiente.
 * Aquí sólo se traduce un fallo observado a «qué queda descalificado, y por
 * cuánto tiempo», para que la SIGUIENTE decisión de ruteo no repita el error.
 *
 * ── EL FALLO QUE ESTO EVITA ──────────────────────────────────────────────────
 *
 * Una llave revocada de Anthropic tiene UNA causa y CINCO modelos. Un router
 * ingenuo, al ver fallar Opus, prueba Sonnet, luego Sonnet 4.6, luego Haiku —
 * cuatro viajes de red para llegar al mismo 401, con el paciente enfrente. La
 * clase de fallo dice el ALCANCE: la llave y el saldo tumban al PROVEEDOR
 * entero; un modelo inexistente tumba sólo a ese modelo.
 *
 * Es la misma lección que `protocolo.ts` ya escribió para una llamada; aquí se
 * aplica entre llamadas.
 *
 * Módulo PURO.
 */
import type { ClaseFallo } from '@/lib/ia/fallo-proveedor'
import { seArreglaReintentando } from '@/lib/ia/fallo-proveedor'
import type { ProveedorCandidato } from '@/lib/ia/router/catalogo'

/** Estado de un proveedor de cara al ruteo. */
export type EstadoProveedor =
  /** Contesta. */
  | 'ok'
  /** Contesta a veces o lento. Se puede usar; se prefiere otro si lo hay. */
  | 'degradado'
  /** No contesta. */
  | 'caido'
  /** La llave no sirve. NO se arregla probando otro modelo suyo. */
  | 'llave_invalida'
  /** Sin saldo. NO se arregla probando otro modelo suyo. */
  | 'sin_saldo'
  /** Límite de tasa. Se arregla esperando, no cambiando de modelo. */
  | 'limitado'

/** Qué alcance tiene un fallo: ¿tumba al proveedor entero o sólo a un modelo? */
export type Alcance = 'proveedor' | 'modelo'

/**
 * De la clase de fallo que ya existe, al alcance.
 *
 * Se apoya en `fallo-proveedor.ts` en vez de inventar una segunda taxonomía:
 * ese módulo ya sabe que un 400 con «credit balance is too low» es saldo y no
 * petición mal formada, y esa clase de conocimiento no se duplica.
 */
export function alcanceDe(clase: ClaseFallo): Alcance {
  switch (clase) {
    // La llave y el saldo son de la CUENTA. Ningún modelo suyo va a funcionar.
    case 'llave_invalida':
    case 'sin_saldo':
    // El límite de tasa también es de la cuenta, y probar otro modelo lo empeora.
    case 'limite_tasa':
    case 'sobrecarga':
      return 'proveedor'
    // Un timeout puede ser de un modelo lento concreto; no condena a la cuenta.
    case 'timeout':
    default:
      return 'modelo'
  }
}

/** Estado de proveedor que corresponde a una clase de fallo. */
export function estadoDeFallo(clase: ClaseFallo): EstadoProveedor {
  switch (clase) {
    case 'llave_invalida': return 'llave_invalida'
    case 'sin_saldo':      return 'sin_saldo'
    case 'limite_tasa':    return 'limitado'
    case 'sobrecarga':     return 'caido'
    case 'timeout':        return 'degradado'
    default:               return 'degradado'
  }
}

export interface SaludProveedor {
  proveedor: ProveedorCandidato
  estado: EstadoProveedor
  /** ISO. Desde cuándo está así. Se pasa: nada de relojes escondidos. */
  desde: string
  /** Modelos concretos descartados, cuando el fallo era sólo de ellos. */
  modelosCaidos?: readonly string[]
}

export type MapaSalud = readonly SaludProveedor[]

export function saludDe(mapa: MapaSalud, proveedor: ProveedorCandidato): SaludProveedor | null {
  return mapa.find(s => s.proveedor === proveedor) ?? null
}

/**
 * ¿Se puede intentar con este proveedor ahora?
 *
 * Un proveedor sin entrada en el mapa se considera `ok`: la ausencia de un
 * incidente no es un incidente. Lo contrario dejaría la plataforma sin IA en
 * cuanto el mapa llegue vacío por un fallo de lectura.
 */
export function alcanzable(mapa: MapaSalud, proveedor: ProveedorCandidato): boolean {
  const s = saludDe(mapa, proveedor)
  if (!s) return true
  return s.estado === 'ok' || s.estado === 'degradado'
}

/** ¿Este modelo concreto está descartado, aunque su proveedor esté en pie? */
export function modeloCaido(mapa: MapaSalud, proveedor: ProveedorCandidato, modeloId: string): boolean {
  const s = saludDe(mapa, proveedor)
  return !!s?.modelosCaidos?.includes(modeloId)
}

/**
 * ¿Tiene sentido volver a intentar con este proveedor, o hay que avisar a alguien?
 *
 * Reutiliza `seArreglaReintentando` en vez de repetir la lista: llave y saldo
 * son problemas de gestión, y reintentarlos gasta el tiempo del médico para
 * llegar al mismo sitio.
 */
export function esperarSirve(estado: EstadoProveedor): boolean {
  const clase: ClaseFallo =
    estado === 'llave_invalida' ? 'llave_invalida'
    : estado === 'sin_saldo'    ? 'sin_saldo'
    : estado === 'limitado'     ? 'limite_tasa'
    : estado === 'caido'        ? 'sobrecarga'
    : 'otro'
  return seArreglaReintentando(clase)
}

/**
 * Aplica un fallo observado al mapa de salud.
 *
 * Devuelve un mapa NUEVO: el estado de salud es una entrada del router, y un
 * router que muta su propia entrada deja de ser determinista.
 */
export function registrarFallo(
  mapa: MapaSalud, proveedor: ProveedorCandidato, modeloId: string,
  clase: ClaseFallo, cuandoISO: string,
): MapaSalud {
  const alcance = alcanceDe(clase)
  const otros = mapa.filter(s => s.proveedor !== proveedor)
  const previo = saludDe(mapa, proveedor)

  if (alcance === 'proveedor') {
    return [...otros, { proveedor, estado: estadoDeFallo(clase), desde: cuandoISO }]
  }
  const caidos = new Set([...(previo?.modelosCaidos ?? []), modeloId])
  return [...otros, {
    proveedor,
    // El proveedor sigue en pie: lo que cayó fue un modelo suyo.
    estado: previo?.estado === 'ok' || previo == null ? 'ok' : previo.estado,
    desde: previo?.desde ?? cuandoISO,
    modelosCaidos: [...caidos],
  }]
}

export const POR_QUE_LA_CLASE_DE_FALLO_DECIDE_EL_ALCANCE =
  'Porque una llave revocada tiene una causa y cinco modelos. Probarlos todos ' +
  'son cuatro viajes de red para llegar al mismo 401, con el paciente ' +
  'enfrente. La clase dice si el problema es de la cuenta o del modelo, y eso ' +
  'es lo que decide a quién descartar.'
