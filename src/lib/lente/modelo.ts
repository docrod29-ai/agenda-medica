/**
 * LA LENTE CONTEXTUAL — Capa 4 de §5, el modelo.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 *
 * §5 del Master Loop V15 define cuatro capas de shell. Este repositorio tenía
 * tres: `InstrumentStrip` (1), `FlowRail` (2) y el lienzo de trabajo (3).
 * `V15-SHELL-GREYBOX-001` se cerró **sin la cuarta**, y desde entonces cada
 * documento que la nombraba la daba por futura: `V15-MARCO-DE-PAGINA.md` llega a
 * reservarle el sitio físico («qué vive en el ancho que queda a la derecha… es el
 * sitio de la Capa 4, que no existe todavía como pieza»).
 *
 * Peor: `/pendientes` **afirmaba en un comentario** que el tramo «→ Source» de la
 * cadena §20 era «Source Reveal (§21): revelación en el flujo». No lo era. No
 * había ninguna revelación: el comentario describía una pieza que nadie había
 * escrito. Es la familia «escrito y sin conectar», cometida sobre la propia
 * documentación.
 *
 * ── QUÉ ES, Y SOBRE TODO QUÉ NO ES ──────────────────────────────────────────
 *
 * Es un **plano de inspección transitorio**. Se abre sobre un hecho clínico
 * concreto, dice de dónde salió, y se cierra devolviendo al médico EXACTAMENTE
 * donde estaba.
 *
 *     hecho / dato
 *     → inspeccionar
 *     → fuente / evidencia / contexto
 *     → cerrar
 *     → mismo paciente · mismo encuentro · mismo sitio de la pantalla
 *
 * NO es una barra lateral permanente, ni un chat, ni un módulo, ni una segunda
 * fuente de datos. **La lente no lee nada que su llamador no tuviera ya**, salvo
 * un caso declarado y uno solo: la nota de la que cuelga un pendiente, leída con
 * `getNota` — la MISMA función con el mismo alcance de consultorio que ya usan
 * expediente, consulta, receta y orden. No hay lectura nueva con criterio propio.
 *
 * ── LA REGLA QUE LO HACE SEGURO: SE FALLA CERRADO ───────────────────────────
 *
 * Si de un hecho no consta procedencia, **se dice que no consta**. Nunca se
 * inventa una asociación de origen. Y —esto es lo que se olvida siempre— «no
 * consta» y «no se pudo leer» son estados DISTINTOS y se pintan distinto: es la
 * regla 4 de seguridad clínica (ausencia de dato no es dato de ausencia) dicha en
 * la dirección que cuesta, la misma que `sin-leer` en `estado-clinico.ts`.
 *
 * ── LÍMITES ─────────────────────────────────────────────────────────────────
 *
 * Todo hecho inspeccionable declara su `clinicId` y su `patientId`. La lente
 * nunca los deduce, nunca los reescribe y nunca los hereda del hecho anterior:
 * quien abre la lente dice de quién es lo que se va a mirar. `mismoLimite` existe
 * para que un guardián pueda comprobarlo sin confiar en la vista.
 *
 * Módulo PURO: sin React, sin Firestore, sin `Date.now()`.
 */
import type { TareaClinica } from '@/lib/tareas-clinicas/modelo'
import { ETIQUETA_TIPO } from '@/lib/tareas-clinicas/modelo'
import type { AlergiaEstructurada } from '@/types'

/** Consultorio + paciente. El límite que la lente no puede perder ni reatar. */
export interface LimiteClinico {
  clinicId: string
  patientId: string
}

/**
 * LO QUE SE PUEDE INSPECCIONAR — unión CERRADA, un caso por llamador real.
 *
 * Cerrada a propósito. Un `clase: string` abierto invita a que cada pantalla
 * invente su propio hecho y su propia forma de decir «de dónde salió», que es
 * exactamente cómo nacen cuatro verdades sobre la misma entidad. Añadir un caso
 * aquí obliga a decidir su procedencia y a escribirla en `fuenteDeclarada`.
 */
export type HechoInspeccionable =
  /** Un pendiente del worklist: ¿de qué consulta salió? */
  | {
      clase: 'tarea'
      clinicId: string
      patientId: string
      pacienteNombre?: string
      tarea: TareaClinica
    }
  /**
   * El estado clínico que pinta una fila de `/pacientes`: ¿por qué dice eso?
   *
   * Las tareas viajan DENTRO del hecho porque el llamador ya las tiene leídas
   * (`tareasVivas()` de RTC-15). La lente no vuelve a preguntar por ellas: una
   * segunda lectura podría discrepar de lo que la fila está enseñando, y una
   * explicación que no coincide con lo explicado es peor que no explicar.
   */
  | {
      clase: 'estado-clinico'
      clinicId: string
      patientId: string
      pacienteNombre: string
      tareas: readonly TareaClinica[]
    }
  /**
   * La banda de alergias del ancla: ¿de dónde sale «sulfas»?
   *
   * La banda pinta una LECTURA (`alergenosDe`, semántica sellada de REG-311) de
   * un texto que escribió alguien. Inspeccionar es ver el texto de origen al
   * lado de lo que la lectura entendió — que es la única forma de que el médico
   * pueda cazar una lectura equivocada antes de que llegue a una receta.
   */
  | {
      clase: 'alergias'
      clinicId: string
      patientId: string
      pacienteNombre: string
      /** Lo que la lectura sellada entendió. */
      alergenos: readonly string[]
      /** El texto libre tal como está escrito en el expediente, sin tocar. */
      textoLibre?: string
      /** Las estructuradas, si alguna vía las llenó. */
      estructuradas?: readonly AlergiaEstructurada[]
    }

export type ClaseDeHecho = HechoInspeccionable['clase']

/** El límite del hecho. Nunca se deduce de la ruta ni del hecho anterior. */
export function limiteDelHecho(h: HechoInspeccionable): LimiteClinico {
  return { clinicId: h.clinicId, patientId: h.patientId }
}

/**
 * ¿Son el mismo consultorio y el mismo paciente?
 *
 * Existe para que el guardián pueda comprobar que la lente no se reata en
 * silencio: si el hecho abierto cambia de límite sin pasar por un `abrir`
 * explícito, algo lo reatóy eso es la familia «paciente equivocado».
 */
export function mismoLimite(a: LimiteClinico, b: LimiteClinico): boolean {
  return a.clinicId === b.clinicId && a.patientId === b.patientId
}

/**
 * Identidad estable de un hecho.
 *
 * Dos usos, los dos necesarios:
 *
 *  · **Idempotencia** — volver a inspeccionar lo mismo no reabre ni reinicia
 *    nada.
 *  · **Resoluciones rancias** — una lectura asíncrona que vuelve tarde sólo se
 *    pinta si su clave sigue siendo la del hecho abierto. Sin esto, inspeccionar
 *    dos pendientes seguidos puede acabar pintando la nota del PRIMERO bajo el
 *    título del segundo, que es la misma trampa que `usePacienteActual` resuelve
 *    en la franja.
 */
export function claveDelHecho(h: HechoInspeccionable): string {
  switch (h.clase) {
    case 'tarea':
      return `tarea:${h.clinicId}:${h.patientId}:${h.tarea.id ?? h.tarea.creadaEn}`
    case 'estado-clinico':
      return `estado:${h.clinicId}:${h.patientId}`
    case 'alergias':
      return `alergias:${h.clinicId}:${h.patientId}`
  }
}

/**
 * EL TÍTULO DEL PLANO — dice qué se está mirando, no cómo se llama la pieza.
 *
 * «Detalle» o «Información» serían el rótulo de cualquier panel. Aquí el
 * encabezado nombra el hecho concreto, porque el plano existe para UN hecho.
 */
export function tituloDelHecho(h: HechoInspeccionable): string {
  switch (h.clase) {
    case 'tarea':
      return h.tarea.titulo
    case 'estado-clinico':
      return `Lo que queda abierto de ${h.pacienteNombre}`
    case 'alergias':
      return `Alergias de ${h.pacienteNombre}`
  }
}

/**
 * QUÉ HAY QUE IR A BUSCAR PARA ESTE HECHO — y si no hay nada, por qué.
 *
 * Se decide ANTES de tocar la red. Un hecho cuya procedencia ya viaja dentro de
 * él (`en-memoria`) no dispara ninguna lectura: la lente no vuelve a preguntar
 * por lo que su llamador acaba de enseñar.
 */
export type FuenteDeclarada =
  /** Hay una nota que leer, y este es su id. */
  | { tipo: 'nota'; notaId: string }
  /** La procedencia viaja dentro del hecho: no hay nada que ir a buscar. */
  | { tipo: 'en-memoria' }
  /** No consta procedencia. `porQue` se PINTA: es la respuesta, no un hueco. */
  | { tipo: 'ninguna'; porQue: string }

export function fuenteDeclarada(h: HechoInspeccionable): FuenteDeclarada {
  if (h.clase !== 'tarea') return { tipo: 'en-memoria' }

  const { tarea } = h
  const notaId = String(tarea.notaId ?? '').trim()
  if (notaId) return { tipo: 'nota', notaId }

  /*
    SIN `notaId` NO HAY NOTA, Y SE DICE POR QUÉ — no «sin datos».
    Los dos productores que nacen sin nota son casos legítimos y distintos, y el
    médico merece saber cuál de los dos está mirando. Cualquier otro origen se
    responde con la verdad literal, que es que no quedó anotado de dónde salió.
  */
  if (tarea.origen === 'laboratorio') {
    return {
      tipo: 'ninguna',
      porQue: 'Este pendiente nació al llegar el resultado, no de una nota firmada.',
    }
  }
  if (tarea.origen === 'manual') {
    return {
      tipo: 'ninguna',
      porQue: 'Este pendiente se creó a mano; no cuelga de ninguna nota.',
    }
  }
  return {
    tipo: 'ninguna',
    porQue: 'No quedó registrada la nota de la que salió este pendiente.',
  }
}

/**
 * LO MÍNIMO DE UNA NOTA PARA PODER CITARLA.
 *
 * Deliberadamente NO es `NotaMedica`: este módulo es puro y no debe arrastrar el
 * tipo entero del expediente para leer cuatro campos. Quien llame pasa la nota
 * real; la forma estructural comprueba que trae lo que hace falta.
 */
export interface NotaParaCitar {
  id?: string
  estado?: string
  tipo?: string
  fechaConsulta?: string
  createdAt?: string
  estudiosOrden?: string[]
  medicamentos?: { nombre?: string }[]
  proximoSeguimiento?: string
}

/**
 * LA LÍNEA DE LA NOTA DE LA QUE SALE ESTE PENDIENTE — o por qué no la hay.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * **Se cita lo que la nota DICE, no lo que el pendiente dice de sí mismo.** El
 * título de una tarea es texto que alguien pudo editar después; la nota firmada
 * es el documento. Si el estudio ya no aparece en la orden de esa nota, la lente
 * NO lo da por citado: lo declara. Esa discrepancia es información clínica real
 * —alguien cambió el pendiente, o la tarea cuelga de la nota equivocada— y
 * taparla con el título de la tarea la volvería invisible para siempre.
 *
 * Éste es el sitio exacto donde una lente mal escrita fabricaría procedencia:
 * basta con devolver `t.titulo` y todo «tiene fuente». Por eso el caso de la
 * discrepancia tiene guardián propio.
 */
export interface CitaDeOrigen {
  /** La línea literal de la nota. `null` cuando no se puede citar. */
  literal: string | null
  /** Bajo qué rótulo de la nota estaba. */
  campo: string | null
  /** Por qué no hay literal, cuando no lo hay. Se PINTA. */
  porQue: string | null
}

const nada = (porQue: string): CitaDeOrigen => ({ literal: null, campo: null, porQue })

export function citaDeOrigen(tarea: TareaClinica, nota: NotaParaCitar): CitaDeOrigen {
  const igual = (a: string, b: string) =>
    a.trim().toLocaleLowerCase('es') === b.trim().toLocaleLowerCase('es')

  switch (tarea.tipo) {
    case 'estudio_pendiente': {
      const estudios = (nota.estudiosOrden ?? []).map(e => String(e ?? '').trim()).filter(Boolean)
      const encontrado = estudios.find(e => igual(e, tarea.titulo))
      if (encontrado) return { literal: encontrado, campo: 'Estudios solicitados', porQue: null }
      if (!estudios.length) {
        return nada('La nota de origen no tiene ningún estudio en su orden.')
      }
      return nada('Este estudio ya no aparece en la orden de la nota de origen.')
    }

    case 'receta_por_entregar': {
      const meds = (nota.medicamentos ?? [])
        .map(m => String(m?.nombre ?? '').trim())
        .filter(Boolean)
      if (!meds.length) return nada('La nota de origen no tiene medicamentos prescritos.')
      return { literal: meds.join(' · '), campo: 'Medicamentos prescritos', porQue: null }
    }

    case 'seguimiento': {
      const seg = String(nota.proximoSeguimiento ?? '').trim()
      if (!seg) return nada('La nota de origen no tiene fecha de seguimiento.')
      return { literal: seg, campo: 'Próximo seguimiento', porQue: null }
    }

    /*
      Los demás tipos NO salen de una línea de la nota, y decirlo es la
      respuesta correcta. La reconciliación, por ejemplo, sale de algo que el
      paciente DIJO en esa consulta: la frase vive en el detalle del pendiente
      —que la fila ya enseña— y no en un campo de la nota. Citar el detalle
      aquí sería presentar el pendiente como su propia fuente.
    */
    default:
      return nada(
        `Un pendiente de tipo «${ETIQUETA_TIPO[tarea.tipo] ?? tarea.tipo}» no sale de una línea concreta de la nota.`,
      )
  }
}

/**
 * ¿La nota que se leyó es la que se pidió, y es del paciente que se pidió?
 *
 * Parece redundante —se pidió por id— y no lo es: `getNota` recibe `patientId` y
 * `notaId` por separado, y una nota mal escrita puede traer dentro un
 * `pacienteId` distinto (hay precedente en este repositorio: el `id` guardado
 * DENTRO del documento que pisaba al del documento). Enseñar como fuente de este
 * paciente un documento que dice pertenecer a otro es la familia
 * «paciente equivocado», y aquí se corta antes de pintar.
 */
export function laNotaEsDeEstePaciente(
  nota: { pacienteId?: string } | null | undefined,
  limite: LimiteClinico,
): boolean {
  if (!nota) return false
  const suyo = String(nota.pacienteId ?? '').trim()
  // Una nota que no declara paciente se acepta: la RUTA por la que se leyó ya
  // está dentro del expediente de este paciente. Lo que no se acepta es que
  // declare OTRO.
  return suyo === '' || suyo === limite.patientId
}

/**
 * EL ESTADO DE UNA RESOLUCIÓN — cuatro, y los cuatro se pintan distinto.
 *
 * `sin-fuente` y `no-se-pudo-leer` son la misma distinción que `sin-pendientes`
 * y `sin-leer` en `estado-clinico.ts`, y por el mismo motivo: fundirlas convierte
 * un fallo de lectura en la afirmación «no consta procedencia», que es una
 * afirmación clínica que nadie hizo.
 */
export type Resolucion<T> =
  | { estado: 'resolviendo' }
  | { estado: 'resuelta'; valor: T }
  | { estado: 'sin-fuente'; porQue: string }
  | { estado: 'no-se-pudo-leer'; porQue: string }

export const POR_QUE_LA_LENTE_NO_NAVEGA =
  'Porque volver tiene que devolver al médico al píxel donde estaba. Una lente ' +
  'que cambia de ruta obliga a reconstruir la pantalla al cerrarse —scroll, ' +
  'foco, filtros, el borrador a medio escribir— y entonces inspeccionar cuesta ' +
  'más que no inspeccionar, que es como muere una función de trazabilidad.'
