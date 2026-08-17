/**
 * QUÉ DICE LA LISTA DE PACIENTES CUANDO NO ENSEÑA NINGUNA FILA.
 *
 * Hermana de `@/lib/agenda/vacio-de-la-agenda` (REG-314). Allí eran tres
 * causas dichas con una sola frase; aquí son tres causas dichas con tres
 * párrafos grises distintos, ninguno de ellos un componente y ninguno con un
 * gesto:
 *
 *   «Sin resultados para “x”.»
 *   «Aún no hay pacientes con citas recientes. Usa **Todos A-Z** o busca…»
 *   «Ningún paciente con inasistencias o cancelaciones.»
 *
 * Los tres comparten el mismo defecto y no es de estilo: **ninguno dice que la
 * lista NO está vacía.** Con 128 expedientes dentro, el bloque de «Con alerta»
 * pinta una pantalla en blanco; el de «Recientes» —que es la vista POR
 * DEFECTO— manda a buscar un control en negrita en vez de ofrecerlo; y el de
 * la búsqueda es un callejón sin salida en la pantalla más visitada del
 * producto.
 *
 * ── POR QUÉ IMPORTA MÁS QUE UN ESTADO VACÍO FEO ─────────────────────────────
 *
 * Buscar y no encontrar es el momento exacto en que nace un expediente
 * repetido. Este repositorio ya sabe lo que eso cuesta —lo dice el propio
 * aviso de duplicados de la pantalla: «su historial queda partido: las
 * alergias en uno y las notas en el otro»— y tiene el módulo que lo detecta
 * (`buscarPosiblesDuplicados`). Pero ese módulo sólo se consultaba DESPUÉS,
 * dentro del formulario de alta, cuando el médico ya decidió crear. En el
 * único momento anterior en que se hace la misma pregunta —la búsqueda— la
 * pantalla contestaba «Sin resultados» y no preguntaba nada a nadie.
 *
 * Es «el dato tiene que LLEGAR» dicho al revés: la capacidad existía, el
 * lector existía, y no se llamaban en el sitio donde hacía falta.
 *
 * ── LO QUE ESTE MÓDULO DECIDE, Y LO QUE NO ──────────────────────────────────
 *
 * Decide la CLASE del vacío, su peso (§ RTC-30: un bloque sin contenido no
 * pesa más que uno con trabajo dentro), lo que dice y el gesto que
 * corresponde a la causa. No decide a quién se parece el término buscado: eso
 * ya lo sabe `duplicados.ts` con su umbral declarado, y aquí sólo entra el
 * RECUENTO de lo que encontró.
 *
 * Módulo PURO: sin red, sin reloj, sin Firestore. La decisión es lo que hay
 * que poder probar, no el JSX que la pinta.
 */

export type ClaseDeListaVacia =
  /** No hay ningún expediente. El vacío ES la pantalla. */
  | 'sin-expedientes'
  /** Hay expedientes y el término buscado no casa con ninguno. */
  | 'busqueda-sin-coincidencias'
  /** Hay expedientes y el chip activo los deja todos fuera. */
  | 'ocultos-por-el-chip'

/** Los tres chips de organización de la lista. */
export type ChipDeLista = 'recientes' | 'todos' | 'alerta'

export interface VacioDeLaLista {
  clase: ClaseDeListaVacia
  /**
   * RTC-30. `hero` sólo cuando el vacío ES la pantalla: ahí lo único que hay
   * que hacer es lo que dice el botón. En los otros dos casos la pantalla
   * tiene arriba un buscador, tres chips y una cabecera que ya funcionan.
   */
  variante: 'hero' | 'linea'
  titulo: string
  descripcion: string
  gesto: {
    limpiarBusqueda: boolean
    verTodos: boolean
    nuevoPaciente: boolean
  }
  /**
   * Si se enseñan los parecidos debajo. Sólo cuando los hay: una cabecera de
   * «se le parecen» sobre cero filas es peor que no ponerla.
   */
  enseñarParecidos: boolean
}

export interface EstadoDeLaLista {
  /** Expedientes cargados, SIN aplicar búsqueda ni chip. */
  totalExpedientes: number
  /** El término tal como lo escribió el médico. Vacío = sin búsqueda. */
  busqueda: string
  chip: ChipDeLista
  /**
   * Cuántos posibles duplicados devolvió `buscarPosiblesDuplicados` para el
   * término buscado. Cero cuando no hay búsqueda.
   */
  parecidos: number
}

const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios)

/** «6 expedientes» / «1 expediente». */
function expedientes(n: number): string {
  return `${n} ${plural(n, 'expediente', 'expedientes')}`
}

export function describirListaVacia(e: EstadoDeLaLista): VacioDeLaLista {
  /*
    EL ORDEN NO ES ARBITRARIO: se pregunta primero por el registro entero.

    Con cero expedientes, buscar y filtrar son gestos sobre nada, y el mensaje
    correcto es el de un consultorio que empieza — no «tu búsqueda no
    coincide». La pantalla ya lo hacía así (`patients.length === 0` se
    comprobaba antes que todo lo demás) y se conserva: mover esta condición
    cambiaría lo que ve un consultorio recién abierto.
  */
  if (e.totalExpedientes === 0) {
    return {
      clase: 'sin-expedientes',
      variante: 'hero',
      titulo: 'No hay pacientes registrados',
      descripcion: 'Registra tu primer paciente o agéndalo directamente desde el asistente.',
      gesto: { limpiarBusqueda: false, verTodos: false, nuevoPaciente: true },
      enseñarParecidos: false,
    }
  }

  if (e.busqueda.trim()) {
    const hayParecidos = e.parecidos > 0
    return {
      clase: 'busqueda-sin-coincidencias',
      variante: 'linea',
      /*
        SE DICE CUÁNTOS HAY FUERA. Ésa es la mitad que faltaba: «Sin
        resultados» describe la consulta, no el registro, y deja al médico sin
        saber si está mirando un consultorio vacío o uno con trescientos
        expedientes donde su término no casó.
      */
      titulo: `Ninguno de los ${expedientes(e.totalExpedientes)} coincide con «${e.busqueda.trim()}».`,
      descripcion: hayParecidos
        /*
          NO SE DICE «ES ÉSTE». Se dice que se PARECEN, y decidir que dos
          nombres son la misma persona sigue siendo del médico — la misma
          frontera que respeta el modal de duplicados de esta pantalla
          («Nada se junta ni se borra solo»). Lo que cambia es que la
          pregunta se hace ANTES de crear, no después.
        */
        ? `${e.parecidos === 1 ? 'Hay uno' : `Hay ${e.parecidos}`} con un nombre parecido. Si es la misma persona, abre el suyo: un segundo expediente parte su historial.`
        : 'Puede estar capturado con otro nombre: búscalo también por teléfono, correo o CURP.',
      gesto: { limpiarBusqueda: true, verTodos: false, nuevoPaciente: false },
      enseñarParecidos: hayParecidos,
    }
  }

  /*
    QUEDA EL CHIP. `todos` no puede llegar aquí con expedientes dentro —los
    agrupa TODOS por inicial—, así que si llegara sería un defecto de quien
    llama y no se disimula con una frase amable: se dice lo que se sabe.
  */
  if (e.chip === 'alerta') {
    return {
      clase: 'ocultos-por-el-chip',
      variante: 'linea',
      titulo: 'Ninguno tiene inasistencias ni cancelaciones.',
      descripcion: `Se miraron los ${expedientes(e.totalExpedientes)}.`,
      gesto: { limpiarBusqueda: false, verTodos: true, nuevoPaciente: false },
      enseñarParecidos: false,
    }
  }

  return {
    clase: 'ocultos-por-el-chip',
    variante: 'linea',
    /*
      «Recientes» es la vista POR DEFECTO, así que este vacío es el primero
      que ve un consultorio que acaba de capturar a sus pacientes y todavía no
      les ha dado cita. Decirle «no hay pacientes con citas recientes» a quien
      tiene seis expedientes recién creados es cierto y es inútil: lo que hace
      falta es que sepa que están ahí y cómo verlos.
    */
    titulo: 'Ninguno tiene citas recientes.',
    descripcion: `Hay ${expedientes(e.totalExpedientes)} en total.`,
    gesto: { limpiarBusqueda: false, verTodos: true, nuevoPaciente: false },
    enseñarParecidos: false,
  }
}
