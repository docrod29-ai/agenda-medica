/**
 * QUÉ PUEDE ENSEÑAR UNA NOTA ARCHIVADA SOBRE DE DÓNDE SALIÓ.
 *
 * ── EL HUECO ────────────────────────────────────────────────────────────────
 *
 * §21 del Master Loop V15 llama a la inspección de la fuente «signature
 * interaction» del producto. Existía en UNA superficie: `/consulta`, o sea
 * **mientras la consulta está abierta**.
 *
 * Pero la pregunta «¿de dónde salió esto?» casi nunca se hace ese día. Se hace
 * semanas después, cuando alguien discute una nota firmada — y ese día el
 * médico entra por `/expediente`, que no enseñaba nada de esto.
 *
 * Y el material para contestar **ya estaba guardado en el documento de la
 * nota**: `transcripcionMotor` desde la v996, `transcripcionCruda` desde antes,
 * `iaAuditoria.extraction` desde la Fase B. Los lectores de esos campos hoy son
 * el bucle de aprendizaje del ASR y la restauración de borradores de la propia
 * `/consulta`. **Ninguna pantalla los enseña.**
 *
 * Es «el dato tiene que LLEGAR» otra vez, y de la variedad más cara: el campo
 * que se escribió para una discusión medicolegal no tenía quién lo leyera el
 * día de la discusión.
 *
 * ── DECISIÓN 1: CONTRA QUÉ SE CONTRASTA (y por qué NO es lo que usa /consulta)
 *
 * La nota guarda DOS transcripciones y la regla `voice-asr.md` las distingue:
 *
 *   · `transcripcionMotor` — lo que oyó el reconocedor. **Material de origen.**
 *   · `transcripcionCruda` — el texto de trabajo, que el médico pudo editar.
 *
 * `/consulta` contrasta contra el texto de trabajo porque en la consulta viva
 * es el único que tiene en la mano. En el archivo hay que elegir, y aquí se
 * elige **el motor**, por una razón que no es de estilo:
 *
 *   Si el médico editó el texto de trabajo para que dijera lo que la nota dice,
 *   contrastar la nota contra ese texto **fabrica el respaldo**. La frase sale
 *   en verde porque alguien la escribió en los dos sitios. El material de
 *   origen no se puede editar, así que es el único contra el que el respaldo
 *   significa algo el día que se discute.
 *
 * Cuando sólo existe el texto de trabajo se usa ése —es mejor que nada—, pero
 * **se dice cuál se está usando**. Un panel que no dice contra qué contrasta
 * deja creer que contrasta contra el original.
 *
 * ── DECISIÓN 2: SIN BLOQUE DE EXTRACCIÓN NO HAY SELLO ───────────────────────
 *
 * `construirManifiesto` clasifica en cinco orígenes —dictado · IA · a mano ·
 * calculado · importado— y **no tiene «no consta»**. Lo que no casa con ninguna
 * extracción cae en el que se le indique, y por omisión es `manual`.
 *
 * En una nota archivada sin `iaAuditoria.extraction` eso imprimiría **«a mano»
 * sobre datos que quizá salieron del dictado**: una afirmación de autoría
 * humana, falsa, en la superficie donde se discute la autoría. Regla 4 de
 * seguridad clínica: ausencia de dato no es dato de ausencia.
 *
 * Así que sin bloque de extracción **no se pinta el sello**. La otra pieza
 * —«¿de dónde salió esto?»— sí se pinta, porque es honesta por construcción:
 * dice «no aparece en el dictado», que es un hecho comprobable, y no dice quién
 * lo escribió.
 *
 * ── DECISIÓN 3: EN EL ARCHIVO NO HAY BOTÓN DE ESCUCHAR ──────────────────────
 *
 * `EscucharElMomento` necesita el `inicioMs` de cada palabra. La nota archiva
 * `dialogoDiarizado` **sin tiempos** a propósito (una consulta de 20 minutos
 * reventaba el tope de 1 MB de Firestore y bloqueaba todo guardado posterior).
 * No hay de dónde sacar el segundo, así que no hay botón: una prueba en el
 * segundo equivocado es peor que ninguna prueba (REG-250).
 *
 * ── LO QUE ESTE MÓDULO NO HACE ──────────────────────────────────────────────
 *
 * No lee, no escribe, no calcula nada clínico y no tiene reloj. Traduce campos
 * ya guardados a «qué se puede afirmar con esto» — un selector de presentación,
 * de los que §1 del Master Loop V15 permite por su nombre.
 */
import type { NotaMedica } from '@/types/expediente'
import { textoDeLaNota } from '@/lib/expediente/texto-de-la-nota'

/** Cuál de las dos transcripciones se está usando como fuente. */
export type FuenteDelContraste = 'motor' | 'trabajo'

export interface ProcedenciaArchivada {
  /** El texto de la nota tal como lo lee el motor de trazabilidad. */
  nota: string
  /** El dictado contra el que se contrasta. Cadena vacía = no hay contra qué. */
  dictado: string
  /** Cuál de las dos es. `null` cuando no hay ninguna. */
  fuente: FuenteDelContraste | null
  /**
   * Sólo cuando existen LAS DOS y difieren: el texto de trabajo se editó
   * después de transcribir. No es un defecto —editar el dictado es normal—,
   * pero explica por qué el contraste usa el material de origen.
   */
  trabajoEditado: boolean
  /**
   * `true` sólo si la nota trae `iaAuditoria.extraction`. Sin él, el sello
   * afirmaría autoría humana sobre datos de máquina (decisión 2).
   */
  puedeSellar: boolean
  /** Lo que el sello necesita, tomado de la nota y de nada más. */
  final: {
    diagnosticos: { descripcion?: string }[]
    medicamentos: { nombre?: string; dosis?: string }[]
    alergias: string[]
    signosVitales: Record<string, unknown>
  }
  /** El bloque de extracción archivado, si lo hay. */
  extraction?: Record<string, unknown>
  /** Los campos que el médico aceptó explícitamente antes de firmar. */
  aprobados: ReadonlySet<string>
}

/** Cómo se nombra en pantalla cada fuente. Se dice, no se supone. */
export const NOMBRE_DE_LA_FUENTE: Record<FuenteDelContraste, string> = {
  motor: 'lo que oyó el reconocedor, antes de cualquier edición',
  trabajo: 'el dictado de trabajo, que pudo editarse',
}

/**
 * Las alergias archivadas de la nota. Deliberadamente NO se llama a
 * `alergiasDe(paciente)`: el sello de una nota firmada tiene que decir qué
 * alergias constaban **cuando se firmó**, no las que el paciente tenga hoy.
 * Mezclarlas haría que una nota de hace un año pareciera haber conocido una
 * alergia registrada anteayer.
 */
function alergiasArchivadas(nota: NotaMedica): string[] {
  /* El tipo dice `Alergia[]`, pero los documentos anteriores al tipo guardaban
     cadenas sueltas. Un `.alergeno` sobre una cadena da `undefined` y la
     alergia desaparecería del sello sin que nadie se entere. */
  return (nota.alergias ?? [])
    .map(a => (typeof a === 'string' ? a : a?.alergeno ?? ''))
    .map(s => s.trim())
    .filter(Boolean)
}

export function procedenciaDeLaNotaArchivada(nota: NotaMedica): ProcedenciaArchivada {
  const motor = (nota.transcripcionMotor ?? '').trim()
  const trabajo = (nota.transcripcionCruda ?? '').trim()

  const fuente: FuenteDelContraste | null = motor ? 'motor' : trabajo ? 'trabajo' : null
  const dictado = fuente === 'motor' ? motor : fuente === 'trabajo' ? trabajo : ''

  const extraction = nota.iaAuditoria?.extraction
  const aprobadosLista = nota.iaAuditoria?.aprobadosPorMedico
  const aprobados = new Set(Array.isArray(aprobadosLista) ? aprobadosLista : [])

  return {
    nota: textoDeLaNota(nota.resumenEjecutivo ?? '', nota.diagnosticos ?? [], nota.secciones ?? []),
    dictado,
    fuente,
    trabajoEditado: !!motor && !!trabajo && motor !== trabajo,
    puedeSellar: !!extraction,
    final: {
      diagnosticos: (nota.diagnosticos ?? []).map(d => ({ descripcion: d?.descripcion })),
      medicamentos: (nota.medicamentos ?? []).map(m => ({ nombre: m?.nombre, dosis: m?.dosis })),
      alergias: alergiasArchivadas(nota),
      signosVitales: (nota.signosVitales ?? {}) as unknown as Record<string, unknown>,
    },
    extraction,
    aprobados,
  }
}

export const POR_QUE_EL_MOTOR_Y_NO_EL_DE_TRABAJO =
  'Si el médico editó el texto de trabajo para que dijera lo que la nota dice, ' +
  'contrastar la nota contra ese texto fabrica el respaldo. El material de ' +
  'origen no se puede editar: es el único contra el que el verde significa algo.'

export const POR_QUE_SIN_EXTRACCION_NO_HAY_SELLO =
  'El manifiesto clasifica en cinco orígenes y no tiene «no consta». Lo que no ' +
  'casa cae en «a mano», así que una nota sin bloque de extracción imprimiría ' +
  'autoría humana sobre datos que quizá salieron del dictado.'

export const POR_QUE_NO_HAY_BOTON_DE_ESCUCHAR =
  'La nota archiva el diálogo SIN tiempos por palabra —guardarlos reventaba el ' +
  'tope de 1 MB de Firestore y bloqueaba todo guardado posterior—. Sin el ' +
  'segundo exacto no hay botón: una prueba en el segundo equivocado es peor ' +
  'que ninguna prueba.'
