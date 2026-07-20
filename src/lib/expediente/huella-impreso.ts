import type { Medicamento } from '@/types/expediente'

/**
 * Huella de lo que REALMENTE se imprimió.
 *
 * EL HUECO QUE CIERRA: en la pantalla de receta el médico puede editar una dosis,
 * agregar un fármaco o borrarlo, y nada de eso se guardaba. El único registro era
 * un evento de bitácora `receta_generada` sin contenido. Es decir: el papel que se
 * llevó el paciente podía diferir de la nota firmada, y no había forma de saberlo
 * ni de reconstruirlo.
 *
 * El QR tampoco cubría esto: firma el folio, el consultorio y el prescriptor, pero
 * NO el contenido. Verificarlo acreditaba que alguien emitió un token, no que el
 * papel dijera lo que dice.
 *
 * Esto no sustituye a guardar el documento completo —esa es una decisión de
 * producto mayor— pero deja en la bitácora lo suficiente para responder "¿qué
 * decía la receta que se imprimió el día X?": la lista de fármacos con su dosis y
 * un hash del contenido para detectar cualquier diferencia.
 *
 * Puro y determinista → testeable.
 */

/** Una línea por fármaco, en el mismo orden en que se imprime. */
export function resumirMedicamentos(medicamentos: readonly Medicamento[]): string[] {
  return medicamentos
    .filter(m => m.nombre?.trim())
    .map(m => [m.nombre, m.dosis, m.via, m.frecuencia, m.duracion]
      .map(x => (x ?? '').trim())
      .filter(Boolean)
      .join(' · '))
}

/**
 * Hash estable del contenido impreso.
 *
 * FNV-1a de 32 bits: no es criptográfico y no pretende serlo — aquí solo hace
 * falta detectar que dos impresiones difieren, no resistir a un adversario. Lo
 * importante es que sea DETERMINISTA y que no dependa del orden de las llaves de
 * un objeto, que fue justo lo que produjo un falso "integridad no verificada" en
 * el sello de las notas.
 */
export function huellaContenido(lineas: readonly string[], extra = ''): string {
  const texto = [...lineas, extra].join('\n')
  let h = 0x811c9dc5
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

/** Metadatos para la bitácora. Sin nombre del paciente: ya va el patientId. */
export function huellaImpreso(
  medicamentos: readonly Medicamento[],
  opts?: { folio?: string; indicaciones?: string; diagnostico?: string },
): { folio?: string; farmacos: string[]; total: number; hash: string } {
  const farmacos = resumirMedicamentos(medicamentos)
  return {
    folio: opts?.folio,
    farmacos,
    total: farmacos.length,
    hash: huellaContenido(farmacos, `${opts?.diagnostico ?? ''}|${opts?.indicaciones ?? ''}`),
  }
}
