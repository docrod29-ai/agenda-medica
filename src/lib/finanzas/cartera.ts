/**
 * CARTERA DE CRÉDITOS — reservar, confirmar, devolver.
 *
 * Master Loop V3 §AA–AF. P1-2 de la auditoría.
 *
 * ── LO QUE HAY HOY Y POR QUÉ NO ALCANZA ──────────────────────────────────────
 *
 * Hoy es leer-y-luego-escribir: la ruta pregunta «¿le quedan créditos?», hace la
 * llamada, y al final incrementa el contador. Entre la pregunta y el incremento
 * pasan de tres a treinta segundos, y en ese hueco caben dos cosas:
 *
 *   1. **Dos peticiones a la vez leen el mismo saldo.** Con un médico solo es
 *      raro; en un consultorio de cuatro que comparten la bolsa del plan, dos
 *      notas simultáneas al final del mes pasan las dos con el saldo de una.
 *      Nada lo impide: `increment` es atómico, pero la DECISIÓN de gastar no.
 *   2. **La llamada termina y el incremento no ocurre.** Si la función se cae
 *      después de responder al proveedor, el gasto existió y el contador no se
 *      enteró. La IA salió gratis y el costo lo pagó la plataforma.
 *
 * ── LO QUE CAMBIA ────────────────────────────────────────────────────────────
 *
 * Se reserva ANTES de llamar, dentro de una transacción que lee el saldo y
 * descuenta en el mismo paso: si dos peticiones compiten, una de las dos pierde
 * y lo sabe. Al terminar se CONFIRMA lo que de verdad se gastó, o se DEVUELVE si
 * la llamada falló.
 *
 * ── LA DECISIÓN QUE MÁS IMPORTA: QUÉ PASA CUANDO ALGO SALE MAL ───────────────
 *
 * Se falla ABIERTO, igual que el gate que ya existe. Si la reserva no se puede
 * leer o escribir por un problema de infraestructura, la llamada procede. Dejar
 * a un intensivista sin su nota a las tres de la mañana porque Firestore tuvo un
 * mal minuto es peor que regalar unos créditos, y el error queda anotado.
 *
 * Lo que NO se hace nunca es lo contrario: cobrar por una llamada que falló.
 *
 * Módulo PURO. La transacción vive en `cartera-server.ts`.
 */

/** Estado de una reserva. */
export type EstadoReserva =
  /** Apartados, la llamada está en curso. */
  | 'reservado'
  /** La llamada terminó y se cobró lo que se gastó. */
  | 'confirmado'
  /** La llamada falló: se regresaron a la bolsa. */
  | 'devuelto'

export interface Saldo {
  /** Créditos del plan este mes, ya escalados por asientos pagados. */
  limite: number
  /** Recargas compradas. */
  extra: number
  /** Ya consumidos y confirmados. */
  usados: number
  /** Apartados por llamadas en curso. */
  reservados: number
}

/** Lo que queda de verdad: el límite menos lo gastado Y lo que está en vuelo. */
export function disponible(s: Saldo): number {
  return Math.max(0, s.limite + s.extra - s.usados - s.reservados)
}

export interface Veredicto {
  ok: boolean
  /** Cuántos se apartan. */
  reservar: number
  motivo?: string
}

/**
 * ¿Alcanza para esta operación?
 *
 * Los reservados cuentan como gastados. Ignorarlos sería volver al problema
 * original: dos llamadas simultáneas verían las dos el mismo saldo libre.
 */
export function cabe(s: Saldo, costo: number): Veredicto {
  if (!(costo > 0)) return { ok: true, reservar: 0 }
  const libre = disponible(s)
  if (libre >= costo) return { ok: true, reservar: costo }
  return {
    ok: false, reservar: 0,
    motivo: `Se acabaron tus créditos de IA del mes (quedan ${libre} y esta operación cuesta ${costo}). ` +
      'Recarga créditos o configura tu propia llave de IA en Configuración para seguir.',
  }
}

/**
 * Cuánto ajustar al confirmar.
 *
 * Se reserva una ESTIMACIÓN y se confirma lo REAL. El ajuste puede ser negativo
 * (salió más barato) y eso está bien; lo que no puede es cobrar más de lo
 * reservado sin que nadie se entere, porque entonces la reserva no habría
 * servido de nada.
 */
export function ajusteAlConfirmar(reservado: number, real: number): { cobrar: number; excedente: number } {
  const r = Math.max(0, real)
  return { cobrar: Math.min(r, reservado), excedente: Math.max(0, r - reservado) }
}

/**
 * ¿Aplica la cartera a esta llamada?
 *
 * Sólo cuando corre sobre la llave del DUEÑO. Con llave propia del consultorio
 * el gasto es suyo: descontarle créditos de nuestra bolsa sería cobrarle dos
 * veces. Es la misma regla que ya usa `debeCortarCreditos`, y tiene que seguir
 * siendo la misma: dos criterios distintos para «¿quién paga esto?» acabarían
 * discrepando.
 */
export function aplicaCartera(fuente: string, clinicId: string | null, esFundador?: boolean): boolean {
  // El fundador NO tiene bolsa que agotar.
  //
  // §BK: «el acceso del fundador NO debe depender de una suscripción de pago».
  // Su cuenta corre sobre la llave del dueño —o sea `fuente: 'prueba'`— así que
  // sin esta línea el tope del plan Clínica lo dejaría sin IA a mitad de mes
  // mientras construye el producto. Su gasto se sigue registrando en el libro,
  // marcado como I+D: no se esconde, se clasifica.
  if (esFundador) return false
  return fuente === 'prueba' && !!clinicId
}

export const POR_QUE_SE_RESERVA_ANTES =
  'Porque entre preguntar «¿le quedan créditos?» y anotar el gasto pasan hasta ' +
  'treinta segundos, y en ese hueco dos notas simultáneas del mismo consultorio ' +
  'pasan las dos con el saldo de una. `increment` es atómico; la decisión de ' +
  'gastar no lo era.'

export const POR_QUE_FALLA_ABIERTO =
  'Si la reserva no se puede leer o escribir, la llamada procede. Dejar a un ' +
  'intensivista sin su nota a las tres de la mañana porque Firestore tuvo un mal ' +
  'minuto es peor que regalar unos créditos. Lo contrario —cobrar por una ' +
  'llamada que falló— no se hace nunca.'
