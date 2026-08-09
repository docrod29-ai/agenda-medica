/**
 * «QUITAR DE LA NOTA» TIENE QUE QUITARLO DE LA NOTA.
 *
 * ── EL DEFECTO (6-ago-2026, REG-198 · UX-001 del backlog, score 70) ──────────
 *
 * El panel de revisión pinta cada dato extraído con un botón rojo que dice
 * **«Quitar»**, y el título de la sección promete «Todo esto ya está en la nota…
 * solo quita lo que no corresponda».
 *
 * El botón sacaba el id del conjunto `aprobados` — y `aprobados` **sólo se
 * guarda como metadato de auditoría**: `aprobadosPorMedico`, `camposAprobados`.
 * Ni una línea de la nota cambiaba.
 *
 * Es decir: el médico veía un diagnóstico mal extraído, pulsaba «Quitar de la
 * nota», el renglón se tachaba en pantalla… y el diagnóstico **seguía en la nota
 * que firmaba**.
 *
 * ── POR QUÉ ESTO ES DE LOS PEORES ────────────────────────────────────────────
 *
 * Un control que miente sobre lo que hizo es peor que no tenerlo. Sin botón, el
 * médico habría borrado el renglón a mano. Con él, se quedó tranquilo — y el
 * dato equivocado viajó a la nota, a la receta y al expediente con su cédula.
 *
 * Es el mismo patrón que REG-195 («Quitarlas y firmar» no firmaba) encontrado el
 * mismo día en la misma pantalla: **botones que prometen dos cosas y hacen una,
 * o ninguna**.
 *
 * ── LO QUE HACE ──────────────────────────────────────────────────────────────
 *
 * Traduce el id del panel en la eliminación real que le corresponde. Es una
 * función PURA: recibe el estado y devuelve el estado nuevo, para que se pueda
 * probar sin pantalla y para que quien la llame decida si la aplica.
 */
import type { Diagnostico, Medicamento, NotaSeccion, SignosVitales } from '@/types/expediente'

export interface EstadoDeLaNota {
  resumen: string
  secciones: NotaSeccion[]
  diagnosticos: Diagnostico[]
  medicamentos: Medicamento[]
  signos: SignosVitales
}

/**
 * Los prefijos que usa `RevisionPanel` al construir los ids.
 *
 * Están aquí y no en el componente porque son un **contrato entre dos módulos**:
 * si el panel cambia un prefijo y esto no se entera, el botón vuelve a no hacer
 * nada — y en silencio, que es como empezó.
 */
export const PREFIJOS = {
  resumen: 'resumen',
  seccion: 'sec:',
  signoVital: 'sv:',
  diagnostico: 'dx:',
  medicamento: 'med:',
  alergia: 'alg:',
} as const

/** ¿Este id corresponde a algo que se puede quitar de la nota? */
export function sePuedeQuitar(id: string): boolean {
  const s = String(id ?? '')
  return s === PREFIJOS.resumen
    || s.startsWith(PREFIJOS.seccion)
    || s.startsWith(PREFIJOS.signoVital)
    || s.startsWith(PREFIJOS.diagnostico)
    || s.startsWith(PREFIJOS.medicamento)
}

/**
 * Quita de verdad lo que el id señala.
 *
 * ── LO QUE NO TOCA, Y POR QUÉ ────────────────────────────────────────────────
 *
 * **Las alergias (`alg:`) no se quitan desde aquí.** Viven en el expediente del
 * paciente, no en la nota: borrarlas desde el panel de una consulta las quitaría
 * de todas las consultas futuras, y el cruce alergia ↔ fármaco dejaría de saltar
 * para siempre. Quitar una alergia mal registrada es un acto sobre el expediente
 * y se hace donde se administra el expediente.
 *
 * Devuelve el estado **sin cambios** si el id no corresponde a nada: nunca
 * inventa una eliminación.
 */
export function quitarDeLaNota(estado: EstadoDeLaNota, id: string): EstadoDeLaNota {
  const s = String(id ?? '')

  if (s === PREFIJOS.resumen) return { ...estado, resumen: '' }

  if (s.startsWith(PREFIJOS.seccion)) {
    const clave = s.slice(PREFIJOS.seccion.length)
    /**
     * Se vacía el valor, NO se borra la sección. Una sección obligatoria que
     * desaparece de la lista rompe la validación NOM-004 de otra manera: el
     * médico querría quitar un texto, no un apartado del documento.
     */
    return {
      ...estado,
      secciones: estado.secciones.map(x => (x.key === clave ? { ...x, value: '' } : x)),
    }
  }

  if (s.startsWith(PREFIJOS.signoVital)) {
    const clave = s.slice(PREFIJOS.signoVital.length) as keyof SignosVitales
    if (!(clave in estado.signos)) return estado
    return { ...estado, signos: { ...estado.signos, [clave]: undefined } }
  }

  if (s.startsWith(PREFIJOS.diagnostico)) {
    const i = Number(s.slice(PREFIJOS.diagnostico.length))
    if (!Number.isInteger(i) || i < 0 || i >= estado.diagnosticos.length) return estado
    return { ...estado, diagnosticos: estado.diagnosticos.filter((_, j) => j !== i) }
  }

  if (s.startsWith(PREFIJOS.medicamento)) {
    const i = Number(s.slice(PREFIJOS.medicamento.length))
    if (!Number.isInteger(i) || i < 0 || i >= estado.medicamentos.length) return estado
    return { ...estado, medicamentos: estado.medicamentos.filter((_, j) => j !== i) }
  }

  return estado
}

export const POR_QUE_IMPORTA =
  'Un control que miente sobre lo que hizo es peor que no tenerlo. Sin el botón, ' +
  'el médico habría borrado el renglón a mano; con él se quedó tranquilo y el ' +
  'dato equivocado viajó a la nota, a la receta y al expediente con su cédula.'

export const POR_QUE_LAS_ALERGIAS_NO =
  'Viven en el expediente del paciente, no en la nota. Borrarlas desde el panel ' +
  'de una consulta las quitaría de todas las futuras, y el cruce alergia ↔ ' +
  'fármaco dejaría de saltar para siempre.'

export const POR_QUE_LA_SECCION_SE_VACIA_Y_NO_SE_BORRA =
  'Una sección obligatoria que desaparece de la lista rompe la validación ' +
  'NOM-004 de otra manera. El médico quiere quitar un texto, no un apartado del ' +
  'documento.'
