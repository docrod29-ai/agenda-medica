/**
 * QUÉ DICE LA AGENDA CUANDO NO ENSEÑA NINGUNA FILA.
 *
 * Una lista vacía tiene tres causas que no se parecen en nada, y `/citas` las
 * decía todas igual («No hay citas para este filtro · cambia de fecha o de
 * médico»):
 *
 *   1. el día está libre de verdad,
 *   2. el día TIENE citas y un filtro las esconde,
 *   3. hay filtro puesto y además el día está libre.
 *
 * El caso 2 ya mordió a este producto por otro sitio: `useFiltroMedico` lleva
 * escrito que un filtro guardado en el navegador, apuntando a un médico dado
 * de baja, dejaba la agenda vacía todos los días sin ningún control visible
 * para quitarlo. Aquello se reparó en el origen. Esto repara lo otro: que el
 * mensaje sepa distinguir **«no hay» de «no se ven»** — la regla 4 de
 * seguridad clínica dicha en la pantalla, ausencia de filas no es ausencia de
 * citas.
 *
 * Y el gesto va con la causa. Ofrecer «Nueva cita» sobre un día que ya tiene
 * seis y las tiene escondidas invita justo al error que se quiere evitar: se
 * ofrece quitar el filtro.
 *
 * Vive aparte de la pantalla para poder probarse: la decisión es lo que hay
 * que comprobar, no el JSX que la pinta.
 */

export type ClaseDeVacio =
  /** Hay citas ese día y un filtro las esconde. El día NO está vacío. */
  | 'ocultas-por-filtro'
  /** Ese día no tiene ninguna cita agendada, con filtro o sin él. */
  | 'dia-libre'

export interface VacioDeAgenda {
  clase: ClaseDeVacio
  titulo: string
  descripcion: string
  /** El gesto que corresponde a la causa. */
  gesto: {
    quitarFiltro: boolean
    nuevaCita: boolean
    /** Continuidad: el riel no muere en el vacío (§20). */
    diaSiguiente: boolean
  }
}

export interface EstadoDeLaAgenda {
  /** Citas de ese día SIN aplicar ningún filtro. */
  citasDelDia: number
  /** Los filtros puestos, ya con nombre legible. Vacío = ninguno. */
  filtrosActivos: string[]
  /** Citas del día POSTERIOR al seleccionado (no necesariamente «mañana»). */
  citasDelDiaSiguiente: number
  /** «Hoy», «Mañana» o «jueves 14 de agosto». */
  etiquetaDelDia: string
}

/** «a», «a y b», «a, b y c» — para nombrar los filtros sin sonar a máquina. */
export function enumerarEsMx(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? ''
  return `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`
}

export function describirAgendaVacia(e: EstadoDeLaAgenda): VacioDeAgenda {
  const hayFiltro = e.filtrosActivos.length > 0

  if (hayFiltro && e.citasDelDia > 0) {
    return {
      clase: 'ocultas-por-filtro',
      titulo: e.citasDelDia === 1
        ? 'Hay 1 cita este día, y el filtro la esconde.'
        : `Hay ${e.citasDelDia} citas este día, y el filtro las esconde.`,
      descripcion: `Filtrando por ${enumerarEsMx(e.filtrosActivos)}.`,
      // NO se ofrece agendar: el día ya tiene citas que el médico no está
      // viendo, y agendar encima es el error que este mensaje existe para
      // evitar. Tampoco se apunta al día siguiente: lo que hay que mirar
      // está en ÉSTE.
      gesto: { quitarFiltro: true, nuevaCita: false, diaSiguiente: false },
    }
  }

  return {
    clase: 'dia-libre',
    /*
      EL DÍA NO SE DICE AQUÍ, PORQUE YA ESTÁ DICHO DOS VECES.

      La primera versión titulaba «Jueves 13 de agosto: sin citas agendadas.»
      Se vio en la captura: la cabecera ya lleva el día en el título («Jueves
      13 de agosto») y otra vez completo debajo («Jueves 13 de agosto de
      2026»), así que el vacío lo decía por TERCERA vez y la noticia —que el
      día está libre y qué trae el siguiente— quedaba de acompañante. Es la
      misma corrección que RTC-22 le hizo a la marca: lo que ya está dicho no
      se repite, se aprovecha el sitio para decir lo que falta.

      `etiquetaDelDia` se conserva en la entrada a propósito: la decide la
      pantalla y puede volver a hacer falta el día que este bloque se use
      donde la cabecera NO nombre la fecha.
    */
    titulo: 'Sin citas agendadas.',
    // Con filtro puesto y día libre se dice explícitamente que el filtro no
    // está escondiendo nada: si no, el médico se queda con la duda de si lo
    // que ve es el día o su propio filtro.
    descripcion:
      (hayFiltro ? 'El filtro no esconde ninguna. ' : '') +
      (e.citasDelDiaSiguiente > 0
        ? `El día siguiente tiene ${e.citasDelDiaSiguiente}.`
        : 'El día siguiente tampoco tiene.'),
    gesto: {
      quitarFiltro: false,
      nuevaCita: true,
      diaSiguiente: e.citasDelDiaSiguiente > 0,
    },
  }
}
