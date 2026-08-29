/**
 * LO QUE EL SISTEMA AVISÓ, Y QUE EL MÉDICO DIJO HABER MIRADO.
 *
 * ── EL DEFECTO ───────────────────────────────────────────────────────────────
 *
 * Antes de firmar, la consulta enseña una lista de avisos y pide confirmar
 * («Los revisé, firmar»). Están todos calculados por motores con pruebas: la
 * contradicción con una negación, el antecedente que era del familiar, el dato
 * que el paciente ofreció como duda, el desajuste temporal, la afirmación sin
 * respaldo en el dictado.
 *
 * Y al firmar **se descartaban todos**. La nota firmada guarda con qué modelo se
 * generó, qué versión del prompt, cuántos campos vinieron del dictado y cuáles
 * aprobó el médico — y **no guardaba nada de lo que el sistema le señaló**.
 *
 * ── LAS DOS CONSECUENCIAS ────────────────────────────────────────────────────
 *
 * **Clínica.** Es la que el propio módulo de certeza tiene escrita: «lo que el
 * paciente ofreció como duda queda en el expediente como diagnóstico; a partir
 * de la segunda consulta ya nadie sabe que era una duda». La duda se veía una
 * vez, en una pantalla, y desaparecía. `SUGERIDO ≠ CONFIRMADO` dura lo que dura
 * la sesión del navegador.
 *
 * **Medicolegal.** Un aviso que se mostró y se aceptó es parte de cómo se tomó
 * la decisión. Sin registro no se puede decir ni que se avisó ni que no: los dos
 * casos se ven exactamente igual seis meses después.
 *
 * ── LO QUE SE SELLA, EXACTAMENTE ─────────────────────────────────────────────
 *
 * Los avisos **que estaban en pantalla en el momento de firmar** — los mismos
 * que enumeró el diálogo y a los que se refiere «Los revisé». Ni más ni menos:
 * sellar también los que el médico había cerrado antes convertiría el registro
 * en un historial de la sesión, que es otra cosa y no es lo que él confirmó.
 *
 * ── LO QUE ESTE MÓDULO NO HACE ───────────────────────────────────────────────
 *
 * No bloquea nada, no cambia ningún nivel y no vuelve a juzgar el aviso: copia
 * lo que el motor ya dijo. Y **no resuelve la duda**: un dato incierto sellado
 * sigue siendo un dato incierto, sólo que ahora se puede volver a leer.
 *
 * Módulo PURO.
 */
import type { AvisoConsulta, NivelAviso, OrigenAviso } from './avisos-consulta'
import type { NotaMedica } from '@/types/expediente'

/**
 * Cuántos caben. La nota ya es un documento grande —lleva el dictado entero— y
 * una lista sin tope es la forma de que un día no quepa: el mismo supuesto de
 * tamaño que costó REG-341 y REG-350. Lo que no cabe **se cuenta**, no se
 * calla.
 */
export const TOPE_AVISOS_SELLADOS = 40

export interface AvisoSellado {
  /** `${origen}:${clave}` — la misma clave con la que se marcó revisado. */
  id: string
  origen: OrigenAviso
  nivel: NivelAviso
  /** La frase que el médico leyó, tal cual la leyó. No se reescribe. */
  texto: string
}

export interface AvisosAlFirmar {
  avisos: AvisoSellado[]
  /** Cuántos había en total. Si es mayor que `avisos.length`, la lista está recortada. */
  total: number
}

/** Los avisos de la pantalla, reducidos a lo que tiene sentido conservar. */
export function sellarAvisos(avisos: readonly AvisoConsulta[]): AvisosAlFirmar {
  const lista = (avisos ?? []).filter(a => a?.id && a?.texto)
  return {
    avisos: lista.slice(0, TOPE_AVISOS_SELLADOS)
      .map(a => ({ id: a.id, origen: a.origen, nivel: a.nivel, texto: a.texto })),
    total: lista.length,
  }
}

/**
 * Mete el sello en la nota ANTES de que se calcule el hash de integridad.
 *
 * El orden no es un detalle: `iaAuditoria` está dentro de `OPCIONALES_SELLADOS_V3`,
 * así que añadir este campo después de `normalizarParaSello` haría que el hash
 * se calculara sobre un objeto distinto del que se escribe — y la nota se
 * reabriría marcada como **«alterada»**. Es exactamente el modo de fallo de
 * REG-060, y la razón por la que esta función existe en vez de un objeto suelto
 * en la pantalla.
 *
 * No muta la entrada. Con la lista vacía **no añade la llave**: una nota sin
 * avisos no tiene por qué llevar un objeto vacío diciendo que no los hubo, y
 * distinguir «no hubo avisos» de «esta nota es anterior a que esto existiera»
 * es justo lo que un `{ total: 0 }` en todas partes haría imposible.
 */
export function conAvisosSellados(
  nota: NotaMedica,
  avisos: readonly AvisoConsulta[],
): NotaMedica {
  const sello = sellarAvisos(avisos)
  if (!sello.avisos.length) return nota
  return { ...nota, iaAuditoria: { ...(nota.iaAuditoria ?? {}), avisosAlFirmar: sello } }
}

/**
 * Lo que se lee de una nota ya guardada.
 *
 * `origen` y `nivel` vienen ANCHOS a propósito: el documento es de Firestore y
 * puede llevar un origen que esta versión del código ya no conozca —una nota de
 * hace un año con un motor que se renombró—. Estrecharlo aquí obligaría a
 * mentir con un `as` o a tirar el aviso, y tirar un aviso sellado por no
 * reconocer su etiqueta es perder el dato para proteger un tipo.
 */
export type AvisosLeidos = NonNullable<NonNullable<NotaMedica['iaAuditoria']>['avisosAlFirmar']>

/** Lo sellado, para quien tenga que volver a leerlo. `null` si la nota no lo lleva. */
export function avisosSelladosDe(nota: Pick<NotaMedica, 'iaAuditoria'> | null | undefined): AvisosLeidos | null {
  const a = nota?.iaAuditoria?.avisosAlFirmar
  if (!a || !Array.isArray(a.avisos) || !a.avisos.length) return null
  return a
}

export const POR_QUE_SE_SELLA =
  'Porque un aviso que se mostró y se aceptó es parte de cómo se tomó la ' +
  'decisión. Sin registro no se puede decir ni que se avisó ni que no: los dos ' +
  'casos se ven exactamente igual seis meses después. Y porque la duda que el ' +
  'paciente expresó —«creo que me dijeron que tenía anemia»— duraba lo que ' +
  'duraba la sesión del navegador.'
