/**
 * LAS ESTANCIAS EN TERAPIA DE UN MISMO INTERNAMIENTO.
 *
 * ── LO QUE SE PERDÍA ─────────────────────────────────────────────────────────
 *
 * `ICUStay` vivía en un documento de id FIJO —`icu_stays/actual`— y un reingreso
 * a terapia lo sobreescribía. El tipo promete justo lo contrario, con estas
 * palabras: «un paciente puede entrar y salir de UCI varias veces dentro del
 * MISMO internamiento, **y cada estancia se conserva**».
 *
 * El caso real: ingresa a UCI el 1, sale a piso el 4, reingresa el 6. Los tres
 * días de la primera estancia dejaban de existir — no se podían contar, ni
 * auditar, ni saber que hubo un reingreso. El «Día UCI» de la tarjeta se
 * reiniciaba sin rastro.
 *
 * ── LA SOLUCIÓN, Y POR QUÉ ÉSTA ──────────────────────────────────────────────
 *
 * `actual` SIGUE siendo el puntero a la estancia vigente —lo usan la ruta de
 * estancia, la pantalla de UCI y las reglas—, pero antes de reabrirlo, la
 * estancia que se está cerrando se ARCHIVA en un documento propio.
 *
 * Se prefiere esto a repartir todas las estancias en ids automáticos porque no
 * obliga a migrar a ningún lector: lo que hoy lee `actual` sigue leyendo lo
 * mismo, y lo que se perdía deja de perderse.
 *
 * El id del archivo se DERIVA de la fecha de ingreso, no es aleatorio: si la
 * transacción se reintenta —que en Firestore pasa— dos escrituras del mismo
 * hecho tienen que ser el mismo documento, no dos copias.
 *
 * Módulo PURO.
 */

/**
 * Id del documento donde se archiva una estancia cerrada.
 *
 * `null` cuando no hay fecha de ingreso: sin ella no se puede identificar la
 * estancia, y un id inventado crearía duplicados en cada reintento. Preferimos
 * no archivar a archivar dos veces lo mismo con nombres distintos.
 */
export function idDeEstanciaArchivada(fechaIngresoUci?: string | null): string | null {
  const f = String(fechaIngresoUci ?? '').trim()
  if (!f) return null
  const limpio = f.replace(/[^0-9A-Za-z]/g, '').slice(0, 20)
  return limpio ? `estancia-${limpio}` : null
}

/** Lo mínimo de una estancia para decidir si hay algo que archivar. */
export interface EstanciaParaArchivar {
  fechaIngresoUci?: string | null
  estado?: string
}

/**
 * ¿Vale la pena archivar esta estancia antes de abrir otra?
 *
 * Sólo si tiene fecha de ingreso: un documento vacío o a medio escribir no es
 * una estancia, es ruido, y llenar el historial de ruido es la forma de que
 * nadie lo mire.
 */
export function hayQueArchivar(prev: EstanciaParaArchivar | null | undefined): boolean {
  return !!prev && !!String(prev.fechaIngresoUci ?? '').trim()
}

export const POR_QUE_ID_DERIVADO =
  'Porque una transacción de Firestore se reintenta, y dos escrituras del mismo ' +
  'hecho tienen que caer en el mismo documento. Con un id aleatorio, un ' +
  'reintento archivaría la misma estancia dos veces y el historial diría que ' +
  'hubo un reingreso que nunca ocurrió.'
