import type { AppointmentStatus } from '@/types'

/**
 * Contadores de conducta del paciente: no-shows, cancelaciones y última cita.
 *
 * EL PROBLEMA QUE RESUELVE: `noShowCount`, `cancelacionCount` y `ultimaCita` se
 * LEÍAN en cuatro pantallas pero no existía ni una sola escritura que los
 * incrementara. Se inicializaban en 0 al crear el paciente y ahí se quedaban para
 * siempre. Marcar una cita como "no asistió" no tocaba al paciente.
 *
 * Lo que eso rompía, todo presentado como dato real:
 *  - El badge de riesgo de no-show: su propio código documenta el historial como
 *    "la señal más fuerte", y esa señal valía 0 siempre. El motor funcionaba con
 *    su predictor principal muerto.
 *  - El CRM: "en riesgo de no-show" era siempre 0, y como `ultimaCita` nunca se
 *    escribía, TODOS los pacientes contaban como inactivos.
 *  - Reactivación: un paciente atendido ayer aparecía como candidato a reactivar.
 *  - Retención NOM-004: se evaluaba con una fecha vacía, que es decidir sobre
 *    conservación de expedientes sin dato.
 *
 * No bloquea nunca: si falla el contador, el cambio de estado de la cita ya
 * ocurrió y es lo que importa.
 */

/** ¿Qué contador toca incrementar al pasar a este estado? */
export function contadorDeEstado(estado: AppointmentStatus): 'noShowCount' | 'cancelacionCount' | null {
  if (estado === 'no-asistio') return 'noShowCount'
  if (estado === 'cancelada') return 'cancelacionCount'
  return null
}

/** ¿Este estado significa que el paciente SÍ fue atendido? */
export function esAtencionEfectiva(estado: AppointmentStatus): boolean {
  return estado === 'atendida' || estado === 'finalizada' || estado === 'pagada'
}

/**
 * Decide qué escribir en el paciente ante un cambio de estado. Puro y testeable:
 * la parte difícil es no contar dos veces, y eso se prueba sin tocar Firestore.
 */
export function cambiosPorTransicion(
  estadoPrevio: AppointmentStatus,
  estadoNuevo: AppointmentStatus,
  fechaHora: string,
): { contador?: 'noShowCount' | 'cancelacionCount'; ultimaCita?: string } {
  // Ya estaba en un estado que cuenta: no se vuelve a sumar al reeditar la cita.
  if (estadoPrevio === estadoNuevo) return {}
  const cambios: { contador?: 'noShowCount' | 'cancelacionCount'; ultimaCita?: string } = {}
  const contador = contadorDeEstado(estadoNuevo)
  if (contador) cambios.contador = contador
  if (esAtencionEfectiva(estadoNuevo) && !esAtencionEfectiva(estadoPrevio)) {
    cambios.ultimaCita = fechaHora.slice(0, 10)
  }
  return cambios
}

/**
 * AQUI YA NO SE ESCRIBE. Y ES EL ARREGLO, NO UNA MUDANZA.
 *
 * Vivia aqui `actualizarContadoresPaciente(clinicId, pacienteId, estadoPrevio,
 * estadoNuevo, fechaHora)`: recibia el estado previo COMO PARAMETRO -o sea, de
 * quien llamaba- y hacia su propio `updateDoc`, en una escritura aparte de la
 * del estado de la cita.
 *
 * Las dos mitades de esa firma eran el defecto:
 *
 *   1. El unico candado contra contar dos veces era `estadoPrevio ===
 *      estadoNuevo`, y los dos valores venian del mismo cliente. Un doble toque
 *      -o un reintento tras un timeout aparente- pasaba la MISMA foto vieja dos
 *      veces, asi que las dos llamadas concluian que habia transicion y
 *      `noShowCount` subia dos veces por una sola falta.
 *   2. Al ser una escritura separada de la del estado, ni siquiera dos
 *      peticiones que si vieran estados distintos quedaban serializadas.
 *
 * Por eso el incremento se movio DENTRO de la transaccion que cambia el estado
 * (`lib/agenda/transicion-cita.ts`), que lee el estado previo del documento en
 * el servidor. Lo que queda aqui es la DECISION -pura, probada, sin Firestore-,
 * que es lo que siempre debio ser este modulo.
 *
 * No se conserva la funcion vieja "por si acaso": un segundo camino para mover
 * el mismo contador es garantizar que alguien lo vuelva a mover mal.
 */
