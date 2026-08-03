/**
 * LA EXPORTACIÓN QUE UN COMPRADOR ABRE — clínica, no una agenda de contactos.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * La pantalla se llama **Migración** y su exportación son once columnas de
 * demografía: nombre, teléfono, WhatsApp, correo, fecha de nacimiento, sexo,
 * CURP, seguro, alergias, notas y última cita.
 *
 * **Cero contenido clínico.** Ni una consulta, ni un diagnóstico, ni un
 * medicamento, ni un cobro.
 *
 * Y el argumento de venta que sostiene esa pantalla es «no te secuestro tus
 * datos». Un competidor abre ese CSV en una demo y gana la reunión sin decir una
 * palabra.
 *
 * ── POR QUÉ CSV POR DOMINIO Y NO UN SOLO ARCHIVO ─────────────────────────────
 *
 * El respaldo completo ya existe y es NDJSON (`clinic/exportar`): sirve para
 * reconstruir, no para leer. Esto es lo otro — lo que se abre en una hoja de
 * cálculo para mirarlo, contarlo o dárselo al contador. Una pestaña por dominio
 * es como se piensa esa información, y un CSV por dominio es la versión sin
 * dependencias nuevas de esa idea.
 *
 * ── LA COLUMNA QUE SE APLANA ES LA QUE SE PIERDE ─────────────────────────────
 *
 * Un diagnóstico o un medicamento viven DENTRO de la nota, en arreglos. Volcarlos
 * como `[object Object]` en una celda es entregar el dato y perderlo a la vez —
 * por eso cada uno tiene su propio dominio, con una fila por elemento y la
 * referencia a su nota.
 *
 * Módulo PURO.
 */
import { celdaSegura } from '@/lib/csv-seguro'

export type Dominio =
  | 'consultas' | 'diagnosticos' | 'medicamentos' | 'citas' | 'cobros' | 'laboratorios'

export interface DefinicionDominio {
  /** Qué se lee: colección de la clínica, o subcolección del paciente. */
  origen: 'clinica' | 'paciente'
  /** Nombre de la colección. */
  coleccion: string
  /** Cabeceras, en el orden en que se leen. */
  columnas: string[]
  /** Qué es, para la pantalla. */
  descripcion: string
  /**
   * `true` si de cada documento salen VARIAS filas (los arreglos de la nota).
   * Sin esto, un diagnóstico o un medicamento se aplanaría a `[object Object]`.
   */
  desglosa?: boolean
}

export const DOMINIOS: Record<Dominio, DefinicionDominio> = {
  consultas: {
    origen: 'paciente', coleccion: 'notas',
    descripcion: 'Una fila por nota médica: fecha, tipo, estado, médico y paciente.',
    columnas: ['fecha', 'paciente', 'paciente_id', 'nota_id', 'tipo', 'estado', 'medico', 'resumen'],
  },
  diagnosticos: {
    origen: 'paciente', coleccion: 'notas', desglosa: true,
    descripcion: 'Una fila por diagnóstico, con la nota de la que salió.',
    columnas: ['fecha', 'paciente', 'paciente_id', 'nota_id', 'diagnostico', 'cie10', 'tipo'],
  },
  medicamentos: {
    origen: 'paciente', coleccion: 'notas', desglosa: true,
    descripcion: 'Una fila por medicamento prescrito, con su nota.',
    columnas: ['fecha', 'paciente', 'paciente_id', 'nota_id', 'medicamento', 'dosis', 'via', 'frecuencia', 'duracion'],
  },
  laboratorios: {
    origen: 'paciente', coleccion: 'laboratorios', desglosa: true,
    descripcion: 'Una fila por analito de laboratorio.',
    columnas: ['fecha', 'paciente', 'paciente_id', 'panel_id', 'analito', 'valor', 'unidad', 'referencia'],
  },
  citas: {
    origen: 'clinica', coleccion: 'appointments',
    descripcion: 'Una fila por cita: cuándo, con quién, en qué estado.',
    columnas: ['fecha_hora', 'paciente', 'paciente_id', 'cita_id', 'tipo', 'estado', 'duracion_min', 'medico'],
  },
  cobros: {
    origen: 'clinica', coleccion: 'cobros',
    descripcion: 'Una fila por cobro: cuánto, cómo y por qué concepto.',
    columnas: ['fecha', 'paciente', 'paciente_id', 'cobro_id', 'concepto', 'monto', 'metodo', 'estado'],
  },
}

const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

/** La cabecera de un dominio. */
export function cabeceraDe(d: Dominio): string {
  return DOMINIOS[d].columnas.map(celdaSegura).join(',')
}

type Doc = Record<string, unknown>
const arr = (v: unknown): Doc[] => (Array.isArray(v) ? (v as Doc[]) : [])

/**
 * Las CELDAS que salen de UN documento — una fila por elemento.
 *
 * Devuelve varias filas cuando el dominio desglosa un arreglo de la nota, y
 * **ninguna** cuando ese arreglo viene vacío: una fila con el paciente y todo lo
 * demás en blanco se cuenta como un diagnóstico que no existe.
 *
 * ── POR QUÉ CELDAS Y NO TEXTO YA UNIDO ───────────────────────────────────────
 *
 * Antes devolvía las filas ya convertidas en una cadena CSV. Cuando llegó el
 * libro de Excel hubo que elegir entre volver a describir aquí las mismas
 * columnas —dos definiciones de la misma fila, que acaban divergiendo sin que
 * nadie lo note— o partir en celdas. Se parte en celdas: el CSV es una de las
 * dos formas de escribirlas, no la fuente.
 */
export function celdasDe(
  d: Dominio, doc: Doc, ctx: { pacienteNombre?: string; pacienteId?: string },
): unknown[][] {
  const paciente = s(ctx.pacienteNombre ?? doc.pacienteNombre)
  const pacienteId = s(ctx.pacienteId ?? doc.pacienteId)
  const id = s(doc.id)
  const fecha = s(doc.fechaConsulta ?? doc.fecha ?? (doc.metadata as Doc | undefined)?.fechaCreacion)

  switch (d) {
    case 'consultas':
      return [[fecha, paciente, pacienteId, id, doc.tipo, doc.estado,
        (doc.firma as Doc | undefined)?.nombreMedico ?? (doc.metadata as Doc | undefined)?.medicoNombre,
        doc.resumenEjecutivo]]

    case 'diagnosticos':
      return arr(doc.diagnosticos).map(dx =>
        [fecha, paciente, pacienteId, id, dx.descripcion ?? dx.nombre, dx.cie10, dx.tipo])

    case 'medicamentos':
      return arr(doc.medicamentos).map(m =>
        [fecha, paciente, pacienteId, id, m.nombre, m.dosis, m.via, m.frecuencia, m.duracion])

    case 'laboratorios':
      return arr(doc.analitos).map(a =>
        [fecha, paciente, pacienteId, id, a.clave ?? a.nombre, a.valor, a.unidad, a.referencia])

    case 'citas':
      return [[s(doc.fechaHora), paciente, pacienteId, id, doc.tipo, doc.estado,
        doc.duracion, doc.medicoNombre]]

    case 'cobros':
      return [[fecha, paciente, pacienteId, id, doc.concepto, doc.monto, doc.metodo, doc.estado]]
  }
}

/**
 * Las mismas filas, escritas como CSV.
 *
 * `celdaSegura` sigue haciendo falta AQUÍ y sólo aquí: en un CSV, una celda que
 * empieza por `=` la evalúa Excel al abrirla. En el libro `.xlsx` no hace falta
 * y no se aplica, porque las celdas de texto se escriben como `inlineStr`, que
 * Excel nunca evalúa. Misma fila, dos escrituras, una sola definición.
 */
export function filasDe(
  d: Dominio, doc: Doc, ctx: { pacienteNombre?: string; pacienteId?: string },
): string[] {
  return celdasDe(d, doc, ctx).map(f => f.map(celdaSegura).join(','))
}

export const POR_QUE_UNA_FILA_POR_ELEMENTO =
  'Un diagnóstico o un medicamento viven DENTRO de la nota, en un arreglo. ' +
  'Volcarlos en una celda los entrega y los pierde a la vez: nadie puede ' +
  'contar, filtrar ni sumar sobre «[object Object]». Una fila por elemento, con ' +
  'la referencia a su nota, es la única forma en que ese dato sirve para algo.'

export const POR_QUE_NO_ES_EL_RESPALDO =
  'El respaldo completo ya existe y es NDJSON: sirve para RECONSTRUIR. Esto es ' +
  'lo otro — lo que se abre en una hoja de cálculo para mirarlo, contarlo o ' +
  'dárselo al contador. Los dos hacen falta y ninguno sustituye al otro.'
