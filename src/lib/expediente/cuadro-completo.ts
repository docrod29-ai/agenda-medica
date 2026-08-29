/**
 * EL PACIENTE COMPLETO, NO SÓLO LO DE HOY.
 *
 * ── EL DEFECTO (6-ago-2026, REG-188) ─────────────────────────────────────────
 *
 * La consulta YA calcula la medicación vigente del paciente y sus problemas
 * activos —`medicamentosVigentes()` y `problemasActivos()` sobre las notas
 * firmadas— y los pinta en pantalla. Pero a los motores clínicos les pasaba
 * **sólo la receta de hoy**:
 *
 *     medicamentos: medicamentos.map(m => ({ nombre: m.nombre, dosis: m.dosis }))
 *                   ↑ los de esta consulta, y nada más
 *
 * Consecuencia concreta: paciente con warfarina de marzo al que hoy se le receta
 * ketorolaco. **La regla de sangrado existe y está probada, y no dispara**,
 * porque la warfarina no está en la nota de hoy. Igual el ajuste renal de la
 * metformina crónica, o la meta de LDL del diabético que hoy vino por faringitis.
 *
 * Es el patrón «escrito y sin conectar» — el fallo más caro de este repositorio,
 * y ya van varias veces.
 *
 * ── POR QUÉ IMPORTA MÁS DE LO QUE PARECE ─────────────────────────────────────
 *
 * En una consulta de **seguimiento** —la mayoría de las suyas— lo de hoy es la
 * punta del iceberg: dos renglones nuevos sobre un paciente que toma cinco cosas
 * desde hace años. Un motor que sólo ve los dos renglones no está razonando
 * sobre un paciente: está razonando sobre una receta.
 *
 * ── LO QUE NO HACE ───────────────────────────────────────────────────────────
 *
 * **No cambia ninguna compuerta.** Lo que entra son datos, y los motores que los
 * consumen (alergias, interacciones) son de nivel `revisa`, nunca `bloquea`.
 * Habrá más avisos —es el objetivo— pero ninguno impedirá firmar.
 *
 * **No inventa nada.** Sólo une dos listas que ya existían y estaban calculadas.
 *
 * Módulo PURO.
 */
import type { Medicamento, Diagnostico } from '@/types/expediente'
import { estaVigente, nombreConCerteza } from './problemas-activos'

/** Lo mínimo que necesitamos de una orden vigente, para no atarnos a su forma. */
export interface ConMedicamento { medicamento: Medicamento }
export interface ConDiagnostico { diagnostico: Diagnostico }

export interface MedicamentoDelCuadro {
  nombre: string
  dosis?: string
  via?: string
  /**
   * ¿Viene de la consulta de hoy o del expediente?
   *
   * Los motores lo necesitan para redactar el aviso: «el ketorolaco que receta
   * hoy con la warfarina que ya toma» dice mucho más que «ketorolaco +
   * warfarina», y le dice al médico dónde mirar.
   */
  deHoy: boolean
}

const clave = (s: string) =>
  s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * La medicación que los motores tienen que ver: la de hoy **más** la vigente.
 *
 * Lo de hoy manda cuando el mismo fármaco aparece en las dos: si el médico está
 * cambiando la dosis en esta consulta, la que vale es la nueva.
 */
export function medicacionDelCuadro(
  deHoy: readonly Medicamento[],
  vigentes: readonly ConMedicamento[],
): MedicamentoDelCuadro[] {
  const out: MedicamentoDelCuadro[] = []
  const vistos = new Set<string>()
  for (const m of deHoy) {
    const n = m.nombre?.trim()
    if (!n || vistos.has(clave(n))) continue
    vistos.add(clave(n))
    out.push({ nombre: n, dosis: m.dosis, via: m.via, deHoy: true })
  }
  for (const v of vigentes) {
    const n = v.medicamento?.nombre?.trim()
    if (!n || vistos.has(clave(n))) continue
    vistos.add(clave(n))
    out.push({ nombre: n, dosis: v.medicamento.dosis, via: v.medicamento.via, deHoy: false })
  }
  return out
}

export interface DiagnosticoDelCuadro {
  descripcion: string
  codigoCIE10?: string
  deHoy: boolean
  /**
   * SUGERIDO ≠ CONFIRMADO, también cuando el dato sale de esta puerta.
   *
   * Se llevaba sólo la descripción, así que un diagnóstico **presuntivo**
   * llegaba a los motores y al modelo indistinguible de uno confirmado. Quien
   * lea esto tiene que poder decir si el médico lo dio por cierto.
   */
  tipo: Diagnostico['tipo']
}

/**
 * Los problemas que los motores tienen que ver.
 *
 * El mismo criterio: lo de hoy manda, lo del expediente completa. Un diabético
 * que hoy viene por faringitis sigue siendo diabético, y el motor tiene que
 * saberlo aunque la nota de hoy no lo mencione.
 */
export function problemasDelCuadro(
  deHoy: readonly Diagnostico[],
  activos: readonly ConDiagnostico[],
): DiagnosticoDelCuadro[] {
  const out: DiagnosticoDelCuadro[] = []
  const vistos = new Set<string>()
  const meter = (d: Diagnostico, deHoy: boolean) => {
    const t = d.descripcion?.trim()
    if (!t) return
    /**
     * ── LO QUE EL MÉDICO DESCARTÓ NO ES UN DIAGNÓSTICO SUYO (REG-364) ───────
     *
     * Esta función recibía la lista de HOY sin filtrar, así que un
     * `tipo:'descartado'` o un `tipo:'diferencial'` —los dos los produce el
     * extractor, y están en el esquema— entraban al cuadro como diagnósticos
     * del paciente. Y de aquí salen el copiloto clínico y el prompt de la ruta
     * de evidencia.
     *
     * El criterio no se inventa aquí: `estaVigente` es el mismo que ya usan la
     * proyección longitudinal y el resumen del expediente. Tres lectores lo
     * aplicaban y éste —el que alimenta a los motores— no.
     */
    if (!estaVigente(d)) return
    // El código manda sobre el texto: «DM2» y «Diabetes mellitus tipo 2» son uno.
    const k = d.codigoCIE10?.trim() ? `c:${clave(d.codigoCIE10)}` : `t:${clave(t)}`
    if (vistos.has(k)) return
    vistos.add(k)
    out.push({ descripcion: t, codigoCIE10: d.codigoCIE10, deHoy, tipo: d.tipo })
  }
  for (const d of deHoy) meter(d, true)
  for (const a of activos) meter(a.diagnostico, false)
  return out
}

/**
 * Cómo se le nombra a un diagnóstico del cuadro cuando lo va a leer otro.
 * El criterio NO se define aquí: es el de `problemas-activos`, que es el módulo
 * que sabe qué es un problema del paciente. Un cuarto criterio para lo mismo es
 * cómo se cuela una tercera verdad.
 */
export const comoSeNombra = nombreConCerteza

/** Cuántos de cada procedencia. Para poder decirlo en pantalla sin recontar. */
export function resumenDelCuadro(meds: readonly MedicamentoDelCuadro[]) {
  const deHoy = meds.filter(m => m.deHoy).length
  return { deHoy, delExpediente: meds.length - deHoy, total: meds.length }
}

export const POR_QUE_LO_DE_HOY_MANDA =
  'Cuando el mismo fármaco está en las dos listas, vale el de hoy: si el médico ' +
  'está cambiando la dosis en esta consulta, la nueva es la buena. La vigente es ' +
  'la última palabra ANTERIOR, y hoy se está diciendo otra.'

export const POR_QUE_NO_CAMBIA_NINGUNA_COMPUERTA =
  'Lo que entra son datos. Los motores que los consumen —alergias cruzadas, ' +
  'interacciones— son de nivel `revisa`, nunca `bloquea`. Habrá más avisos, que ' +
  'es el objetivo, pero ninguno impedirá firmar.'

export const EL_CASO_QUE_LO_MOTIVA =
  'Warfarina de marzo, ketorolaco hoy. La regla de sangrado existe y está ' +
  'probada — y no disparaba, porque la warfarina no estaba en la nota de hoy.'
