/**
 * LA LLEGADA SE DECIDE EN EL SERVIDOR, NO EN LA PANTALLA QUE YA MIRO.
 *
 * EL FALLO QUE CIERRA (Golden Path 9)
 *
 * Cambiar el estado de una cita -llegada del paciente, "no asistio", cancelar-
 * se hacia asi:
 *
 *     await updateAppointment(clinicId, appt.id, { estado: nuevo })
 *     actualizarContadoresPaciente(clinicId, appt.pacienteId, appt.estado, nuevo, ...)
 *
 * `appt.estado` es lo que esta pantalla vio la ultima vez que Firestore le
 * mando una actualizacion. No es el estado del servidor: es una FOTO.
 *
 * Y `actualizarContadoresPaciente` decide con esa foto si toca sumar. Su unica
 * defensa es `estadoPrevio === estadoNuevo`, comparando dos valores que vienen
 * los dos del mismo cliente. En un doble toque -o en un reintento tras un
 * timeout aparente, o entre la asistente y el medico a la vez- las DOS
 * llamadas ven la misma foto vieja, las dos concluyen que hay transicion, y
 * `noShowCount` sube DOS veces por un solo paciente que falto una vez.
 *
 * El contador no es decorativo: el motor de riesgo de no-show lo documenta como
 * "la senal mas fuerte". Un paciente puntual acaba marcado como reincidente,
 * con una sola falta y dos clics.
 *
 * LA REPARACION
 *
 * El estado previo se LEE dentro de una transaccion, del documento, en el
 * servidor. De ahi salen las dos consecuencias:
 *
 *   1. IDEMPOTENCIA REAL. Si el estado ya es el pedido, no se escribe nada y se
 *      devuelve `aplicado: false`. El segundo toque no suma contador, no escribe
 *      bitacora y no vuelve a avisar a la lista de espera.
 *   2. CONCURRENCIA. El contador se escribe EN LA MISMA transaccion que el
 *      estado. Dos peticiones simultaneas no pueden commitear las dos: la que
 *      pierde reintenta, vuelve a leer, y ya ve el estado nuevo. Exactamente un
 *      incremento.
 *
 * AISLAMIENTO ENTRE CONSULTORIOS
 *
 * La ruta se arma con el `clinicId` de la sesion; el `citaId` solo puede ser el
 * ultimo segmento. Una cita de otro consultorio no existe bajo esta ruta, asi
 * que no se lee, no se muta y no se reutiliza: sale `cita-inexistente`. El id
 * que trae el cliente no puede llevar a ningun sitio que el tenant no cubra.
 *
 * NO SE FUERZA UN ESTADO PARA CONSEGUIR IDEMPOTENCIA
 *
 * Converger no es reescribir. Si la cita ya avanzo por otro camino, esto
 * devuelve lo que hay y dice `aplicado: false`; nunca retrocede el estado ni
 * inventa una transicion que no ocurrio.
 *
 * LO QUE CAMBIA A CAMBIO, DICHO SIN ADORNOS
 *
 * El contador antes NUNCA bloqueaba: se escribia aparte y su fallo se tragaba
 * («si falla el contador, el cambio de estado ya ocurrio y es lo que importa»).
 * Ahora va en la misma transaccion, asi que un fallo al escribirlo tumba tambien
 * el cambio de estado.
 *
 * Es deliberado. Un contador que puede divergir en silencio del estado que lo
 * origina es la misma familia de defecto que se esta cerrando, sólo que mas
 * dificil de ver. Y en la practica los dos documentos comparten guarda
 * (`isMember(clinicId)` para `appointments` y para `patients`), asi que o pasan
 * los dos o no pasa ninguno: no se esta cambiando un fallo probable por otro.
 * El unico caso que se trata aparte es el expediente AUSENTE — ahi se sigue
 * adelante sin contador, porque perder la llegada del paciente por un dato de
 * gestion si seria cambiar lo importante por lo accesorio.
 */
import { doc, runTransaction, increment } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { AppointmentStatus } from '@/types'
import { cambiosPorTransicion } from './contadores-paciente'

export interface ResultadoTransicion {
  /** `false` = la cita YA estaba en ese estado; no se escribio nada. */
  aplicado: boolean
  /** El estado real de la cita al terminar. */
  estado: AppointmentStatus
  /** El que habia en el SERVIDOR al entrar (no el de la pantalla). */
  estadoPrevio: AppointmentStatus
  /** El paciente de la cita segun el servidor, para la bitacora. */
  pacienteId: string
}

/**
 * Mueve una cita a `nuevoEstado`. Idempotente y atomica con sus contadores.
 *
 * @throws `cita-inexistente` si la cita no vive en ESTE consultorio.
 */
export async function cambiarEstadoCita(
  clinicId: string,
  citaId: string,
  nuevoEstado: AppointmentStatus,
): Promise<ResultadoTransicion> {
  if (!clinicId) throw new Error('cambiarEstadoCita: falta el consultorio.')
  if (!citaId) throw new Error('cambiarEstadoCita: falta la cita.')
  const citaRef = doc(db, 'clinics', clinicId, 'appointments', citaId)

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(citaRef)
    if (!snap.exists()) {
      // Vale tanto para una cita borrada como para una de OTRO consultorio: bajo
      // esta ruta simplemente no hay nada. No se crea: un id que trae el cliente
      // no puede fabricar una cita.
      throw Object.assign(
        new Error('Esa cita ya no existe en este consultorio.'),
        { code: 'cita-inexistente' },
      )
    }
    const cita = snap.data() as { estado?: AppointmentStatus; pacienteId?: string; fechaHora?: string }
    const estadoPrevio = (cita.estado ?? 'pendiente') as AppointmentStatus
    const pacienteId = String(cita.pacienteId ?? '')

    // EL RETORNO IDEMPOTENTE. Ya esta donde se pedia: no hay transicion que
    // registrar y no hay contador que sumar.
    if (estadoPrevio === nuevoEstado) {
      return { aplicado: false, estado: estadoPrevio, estadoPrevio, pacienteId }
    }

    // La MISMA decision pura que ya usaba la pantalla, ahora alimentada con el
    // estado del servidor. La regla de que contador toca no cambia de sitio.
    const cambios = cambiosPorTransicion(estadoPrevio, nuevoEstado, cita.fechaHora ?? '')

    // Firestore exige TODAS las lecturas antes de la primera escritura.
    let pacienteRef: ReturnType<typeof doc> | null = null
    if (pacienteId && (cambios.contador || cambios.ultimaCita)) {
      const ref = doc(db, 'clinics', clinicId, 'patients', pacienteId)
      // Si el expediente no esta, el cambio de estado sigue adelante: perder la
      // llegada del paciente por un contador seria cambiar un dato de gestion
      // por el hecho clinico.
      if ((await tx.get(ref)).exists()) pacienteRef = ref
    }

    const ahora = new Date().toISOString()
    tx.update(citaRef, { estado: nuevoEstado, updatedAt: ahora })
    if (pacienteRef) {
      tx.update(pacienteRef, {
        ...(cambios.contador ? { [cambios.contador]: increment(1) } : {}),
        ...(cambios.ultimaCita ? { ultimaCita: cambios.ultimaCita } : {}),
        updatedAt: ahora,
      })
    }
    return { aplicado: true, estado: nuevoEstado, estadoPrevio, pacienteId }
  })
}
