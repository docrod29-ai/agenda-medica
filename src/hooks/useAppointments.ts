'use client'
import { useState, useEffect } from 'react'
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Appointment } from '@/types'
import { useClinic } from '@/context/ClinicContext'

/**
 * Citas de la clínica, ACOTADAS A UNA VENTANA DE FECHAS.
 *
 * Antes esto era `query(collection(...))` a secas: sin `where`, sin `limit`. Se
 * suscribía al histórico COMPLETO de citas y, como el hook se monta en todas las
 * pantallas del panel (incluida /pacientes, que no muestra citas), cada sesión
 * fría descargaba y parseaba años de agenda en el hilo principal. Con ~15 000
 * citas son varios MB de JSON antes de pintar nada: esa era la causa principal
 * de "la aplicación está muy lenta", y empeoraba sola conforme crecía el
 * historial.
 *
 * NO se pierde acceso a nada: la ventana se AMPLÍA sola. El calendario pasa el
 * `desde` del mes que estás viendo, así que navegar hacia atrás trae esas citas
 * en cuanto haces clic. Lo único que cambia es que ya no se descarga todo por
 * adelantado "por si acaso".
 *
 * `fechaHora` es 'YYYY-MM-DD HH:mm', que ordena igual como texto que como fecha,
 * así que la comparación funciona directa y solo usa el índice de campo único
 * que Firestore crea solo (no hace falta índice compuesto).
 */

const DIAS_ATRAS_POR_DEFECTO = 120

function isoDiasAtras(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  return `${d.toISOString().slice(0, 10)} 00:00`
}

export function useAppointments(desdeISO?: string) {
  const { clinicId } = useClinic()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [desde, setDesde] = useState(() => isoDiasAtras(DIAS_ATRAS_POR_DEFECTO))

  // La ventana solo crece, nunca se encoge: si el calendario navega a marzo del
  // año pasado, se amplía y ya no se vuelve a estrechar al regresar a hoy. Así
  // no se re-suscribe una y otra vez mientras el usuario pasea por los meses.
  useEffect(() => {
    if (desdeISO && desdeISO < desde) setDesde(desdeISO)
  }, [desdeISO, desde])

  useEffect(() => {
    if (!clinicId) { setLoading(false); return }
    /**
     * Al AMPLIAR la ventana hay que volver a "cargando".
     *
     * Sin esto, al saltar a una fecha vieja se creaba la suscripción nueva pero
     * `loading` seguía en false y `appointments` conservaba el array anterior: la
     * pantalla pintaba "No hay citas para este filtro" y "0 citas" hasta que
     * respondiera Firestore. Para este consultorio en particular, esa pantalla es
     * indistinguible de una pérdida de datos.
     */
    setLoading(true)

    const q = query(collection(db, 'clinics', clinicId, 'appointments'), where('fechaHora', '>=', desde))
    const unsub = onSnapshot(q,
      (snap) => {
        setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)))
        setLoading(false)
      },
      (err) => { setError(err.message); setLoading(false) }
    )
    return () => unsub()
  }, [clinicId, desde])

  return { appointments, loading, error }
}

/**
 * Citas de UN paciente. Consulta propia por `pacienteId` — antes montaba el
 * listener de la clínica entera y filtraba en el cliente, que es exactamente el
 * gasto que se quería evitar.
 *
 * ── EL TECHO QUE FALTABA, YA PUESTO (REG-352 → REG-421) ─────────────────────
 *
 * Esto era un listener SIN cota: se quedaba abierto pagando el historial entero
 * del paciente cada vez que cambiaba una cita. En el paciente de años —el que
 * más importa— eso es exactamente donde duele.
 *
 * La reparación no se podía desplegar mientras el índice `appointments
 * (pacienteId, fechaHora)` no existiera: Firestore no degrada una consulta así,
 * la RECHAZA con `FAILED_PRECONDITION`, y habría roto la pantalla de consulta en
 * producción. Ya está desplegado, así que la consulta pide orden y cota.
 *
 * ── POR QUÉ `desc` Y NO `asc` ───────────────────────────────────────────────
 *
 * El único llamador busca **la cita de HOY**: sin ella el cobro no se liga al
 * encuentro, que es el defecto que este hook existe para evitar. `desc` trae las
 * más recientes —y las futuras ya agendadas— así que la de hoy entra en la
 * ventana salvo que el paciente tuviera más de `TOPE_CITAS_PACIENTE` citas
 * FUTURAS, que no es una consulta real. `asc` traería las más viejas y la
 * perdería siempre.
 *
 * ── Y EL RECORTE SE DECLARA ─────────────────────────────────────────────────
 *
 * `truncada` sale del hook porque un recorte que nadie ve se lee como «ésas eran
 * todas». Hoy no lo pinta nadie —el llamador sólo quiere la de hoy— y por eso
 * está: el día que alguien liste el historial desde aquí, el dato ya está y no
 * hay que acordarse de nada.
 *
 * ── LO QUE DA POR SUPUESTO ──────────────────────────────────────────────────
 *
 * Que toda cita tiene `fechaHora`. Un `orderBy` **excluye** los documentos a los
 * que les falta el campo, no los pone al final. Aquí se sostiene: `fechaHora` es
 * obligatorio en `Appointment` y el llamador ya hacía `c.fechaHora.slice(…)` sin
 * guarda, o sea que una cita sin fecha ya reventaba antes de este cambio.
 */

/**
 * Cuántas citas del paciente se traen. Cincuenta cubre cualquier historial real
 * de consulta y deja la ventana muy por encima de las citas futuras que un
 * paciente puede tener a la vez.
 */
export const TOPE_CITAS_PACIENTE = 50

export function usePatientAppointments(patientId: string) {
  const { clinicId } = useClinic()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [truncada, setTruncada] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!clinicId || !patientId) { setLoading(false); return }

    const q = query(
      collection(db, 'clinics', clinicId, 'appointments'),
      where('pacienteId', '==', patientId),
      /* El orden de los campos ES el del índice declarado. Cambiarlo aquí sin
         cambiarlo allí devuelve `FAILED_PRECONDITION`, no una lista peor. */
      orderBy('fechaHora', 'desc'),
      limit(TOPE_CITAS_PACIENTE),
    )
    const unsub = onSnapshot(q,
      (snap) => {
        setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)))
        setTruncada(snap.size >= TOPE_CITAS_PACIENTE)
        setLoading(false)
      },
      (err) => { setError(err.message); setLoading(false) }
    )
    return () => unsub()
  }, [clinicId, patientId])

  return { appointments, truncada, loading, error }
}
