/**
 * RENOVAR LO CRÓNICO SIN VOLVER A DICTARLO — N-022.
 *
 * ── DE DÓNDE SALE ────────────────────────────────────────────────────────────
 *
 * Fase 6 · RECETA del panel de negocio: «el papel está resuelto; lo que falta es
 * que la receta siga viva después de salir del consultorio». De las tres cosas
 * que propone —recordatorios de toma, adherencia y renovación de crónicos—, ésta
 * es la que vive del lado del médico y no inventa ninguna cifra: un internista
 * receta lo mismo cada tres meses y hoy vuelve a dictarlo entero.
 *
 * ── LO QUE HACE ──────────────────────────────────────────────────────────────
 *
 * Dice qué medicamentos VIGENTES del expediente no están todavía en la receta de
 * hoy, para poder añadirlos con un toque. No crea una segunda fuente de verdad:
 * lo que devuelve son renglones normales de la receta, que entran a la lista y
 * vuelven a pasar por TODAS las compuertas —unidad, mg/kg, techos, alergias,
 * duplicidad, interacciones, riñón, embarazo— antes de imprimirse.
 *
 * ── POR QUÉ ESO IMPORTA ──────────────────────────────────────────────────────
 *
 * Una renovación NO hereda la aprobación de la receta anterior. El paciente de
 * hace tres meses puede tener hoy otra creatinina, otro embarazo u otra alergia
 * registrada; y el motor puede haber aprendido una regla que entonces no tenía.
 * Renovar es volver a prescribir, y aquí se comporta exactamente como escribir
 * el renglón a mano.
 *
 * ── LO QUE NO HACE ───────────────────────────────────────────────────────────
 *
 * No decide qué es «crónico» ni cuánto dura una renovación: copia lo que la
 * orden vigente dice. Ningún umbral, ningún intervalo —los que estas funciones
 * necesitaran serían `NEEDS_CLINICAL_REVIEW`—. No renueva sola: la acción es del
 * médico, y lo renovado queda visible y editable antes de firmar.
 *
 * Módulo PURO.
 */
import type { Medicamento } from '@/types/expediente'

const clave = (s: string) =>
  String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Lo mínimo que se necesita de una orden vigente, para no atarse a su forma. */
export interface ConMedicamentoVigente { medicamento: Medicamento }

/**
 * Los vigentes que todavía no están en la receta de hoy, listos para añadirse.
 *
 * Se compara por nombre normalizado: si el médico ya escribió hoy el mismo
 * fármaco —quizá con otra dosis, que es justo lo que está cambiando— no se
 * ofrece, porque lo de hoy manda (el mismo criterio de `medicacionDelCuadro`).
 */
export function medicamentosARenovar(
  vigentes: readonly ConMedicamentoVigente[],
  deHoy: readonly Medicamento[],
): Medicamento[] {
  const yaEstan = new Set(deHoy.map(m => clave(m.nombre)).filter(Boolean))
  const out: Medicamento[] = []
  const vistos = new Set<string>()
  for (const v of vigentes) {
    const m = v?.medicamento
    const k = clave(m?.nombre ?? '')
    if (!k || yaEstan.has(k) || vistos.has(k)) continue
    vistos.add(k)
    out.push({ ...m })
  }
  return out
}

export const POR_QUE_LA_RENOVACION_NO_HEREDA_LA_APROBACION =
  'Porque el paciente de hace tres meses puede tener hoy otra creatinina, otro ' +
  'embarazo o una alergia nueva en su expediente. Renovar es volver a ' +
  'prescribir: el renglón entra a la receta y vuelve a pasar por todas las ' +
  'compuertas, igual que si se hubiera escrito a mano.'
