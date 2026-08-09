/**
 * QUÉ FALTA PARA CERRAR LA CONSULTA — REG-244.
 *
 * ── EL DEFECTO, Y ES DE LOS QUE NO SE VEN ───────────────────────────────────
 *
 * Al firmar, la consulta elegía **un** destino:
 *
 *     con medicamentos            → la receta
 *     sin medicamentos, con estudios → la orden
 *     ninguno                     → el expediente
 *
 * Con medicamentos **y** estudios —que es media consulta de medicina interna—
 * iba a la receta y **la orden se quedaba en el tintero**. El paciente salía con
 * su receta y sin su solicitud de estudios, y nadie se enteraba: la nota estaba
 * firmada, la cita marcada como atendida, todo verde.
 *
 * El comentario del código ya avisaba de la mitad del problema —«antes solo
 * ramificaba a receta y la orden se quedaba en el tintero»— y lo arregló para el
 * caso «sin medicamentos». El caso «con los dos» siguió igual.
 *
 * ── POR QUÉ UNA PANTALLA Y NO OTRO `if` ─────────────────────────────────────
 *
 * Porque el problema no es a cuál de los dos ir: es que **son dos**. Cualquier
 * regla que elija uno deja el otro sin hacer. Lo que hace falta es enseñar lo
 * que queda y dejar que se haga en cualquier orden.
 *
 * ── LO QUE NO CAMBIA, Y ES DELIBERADO ───────────────────────────────────────
 *
 * Cuando sólo hay UN destino, se sigue yendo directo. Ese caso nunca estuvo
 * roto, y meterle una pantalla de por medio sería añadir un clic a la consulta
 * más común para arreglar un problema que esa consulta no tiene.
 *
 * Módulo PURO.
 */

export type QueFalta = 'receta' | 'orden' | 'hoja_del_paciente' | 'cobro' | 'expediente'

export interface PasoDeCierre {
  que: QueFalta
  /** Cómo se llama en la pantalla. */
  titulo: string
  /** Qué pasa si no se hace. Es lo que decide si vale la pena el clic. */
  siNoSeHace: string
  /** A dónde lleva. `null` = se resuelve sin salir de aquí. */
  ruta: string | null
}

export interface EstadoAlCerrar {
  patientId: string
  notaId?: string | null
  hayMedicamentos?: boolean
  hayEstudios?: boolean
  /** La clínica pide el cobro al médico al cerrar. */
  pideCobro?: boolean
  /** Si está internado, el cierre es otro: vuelve al episodio. */
  internamientoActivo?: string | null
}

/**
 * Lo que queda por hacer, en el orden en que conviene hacerlo.
 *
 * La receta va primero porque es lo que el paciente espera con la mano
 * extendida; el expediente va al final porque no es una tarea, es a dónde se
 * vuelve cuando ya no queda nada.
 */
export function queFaltaParaCerrar(e: EstadoAlCerrar): PasoDeCierre[] {
  const nid = e.notaId ?? null
  const out: PasoDeCierre[] = []

  if (e.hayMedicamentos && nid) out.push({
    que: 'receta',
    titulo: 'Imprimir la receta',
    siNoSeHace: 'El paciente se va sin sus medicamentos por escrito.',
    ruta: `/receta/${e.patientId}/${nid}`,
  })

  if (e.hayEstudios && nid) out.push({
    que: 'orden',
    titulo: 'Imprimir la orden de estudios',
    siNoSeHace: 'El laboratorio no le va a tomar la muestra sin la solicitud.',
    ruta: `/orden/${e.patientId}/${nid}`,
  })

  if (e.hayMedicamentos || e.hayEstudios) out.push({
    que: 'hoja_del_paciente',
    titulo: 'Darle sus instrucciones',
    siNoSeHace: 'Se lleva la receta, pero no cómo tomarla en sus palabras.',
    /* Vive en la propia consulta: no hay a dónde ir. */
    ruta: null,
  })

  if (e.pideCobro) out.push({
    que: 'cobro',
    titulo: 'Registrar el cobro',
    siNoSeHace: 'La consulta no aparece en el corte del día.',
    ruta: null,
  })

  out.push({
    que: 'expediente',
    titulo: 'Volver al expediente',
    siNoSeHace: '',
    ruta: `/expediente/${e.patientId}`,
  })

  return out
}

/**
 * A dónde ir directo, o `null` si hay que enseñar la pantalla.
 *
 * «Directo» significa: hay como mucho **una** cosa que hacer además de volver
 * al expediente. Con dos o más, elegir una deja la otra sin hacer — que es
 * exactamente el defecto.
 */
export function aDondeIrDirecto(e: EstadoAlCerrar): string | null {
  /* Internado: el cierre es volver al episodio, y eso no admite alternativa. */
  if (e.internamientoActivo) return `/hospitalizacion/${e.internamientoActivo}`

  const pasos = queFaltaParaCerrar(e).filter(p => p.que !== 'expediente' && p.que !== 'hoja_del_paciente')
  if (pasos.length === 0) return `/expediente/${e.patientId}`
  if (pasos.length === 1 && !e.pideCobro) return pasos[0].ruta
  return null
}

export const EL_CASO_QUE_SE_PERDIA =
  'Con medicamentos Y estudios —media consulta de medicina interna— firmar ' +
  'llevaba a la receta y la orden se quedaba sin imprimir. El paciente salía ' +
  'sin su solicitud de estudios y todo se veía correcto: nota firmada, cita ' +
  'atendida.'

export const POR_QUE_NO_OTRO_IF =
  'El problema no es a cuál de los dos ir: es que son dos. Cualquier regla que ' +
  'elija uno deja el otro sin hacer.'

export const POR_QUE_EL_CASO_SIMPLE_NO_CAMBIA =
  'Con un solo destino nunca estuvo roto. Meterle una pantalla de por medio ' +
  'sería añadir un clic a la consulta más común para arreglar un problema que ' +
  'esa consulta no tiene.'
