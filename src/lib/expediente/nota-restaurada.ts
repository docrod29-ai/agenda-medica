/**
 * LO QUE SE RESTAURA PUEDE VENIR DE OTRA ÉPOCA.
 *
 * ── EL DEFECTO (7-ago-2026, REG-218 · «Algo se atoró en esta pantalla») ─────
 *
 * La consulta restaura estado de tres sitios: la nota de Firestore, el respaldo
 * local del navegador y la sesión de audio guardada. Los tres guardan lo que
 * había **el día que se escribieron**, y el código que los lee da por hecho la
 * forma de hoy:
 *
 *     setSignos(n.signosVitales ?? {})   ← con guarda
 *     setSecciones(n.secciones)          ← SIN guarda
 *     setDiagnosticos(n.diagnosticos)    ← SIN guarda
 *     setMedicamentos(n.medicamentos)    ← SIN guarda
 *
 * Alguien puso la guarda en uno y no en los otros tres. Si el documento no trae
 * el campo —una nota vieja, una escrita por otro módulo, un respaldo de una
 * versión anterior— el estado queda `undefined` y **el siguiente render revienta**
 * en `diagnosticos.map`, `medicamentos.filter` o `secciones.map`.
 *
 * El médico ve «Algo se atoró en esta pantalla». Su audio no se pierde —eso está
 * bien resuelto— pero la consulta se interrumpe con el paciente delante.
 *
 * ── POR QUÉ NO BASTA CON `Array.isArray` ────────────────────────────────────
 *
 * Los sitios que sí comprueban lo hacen así:
 *
 *     if (Array.isArray(b.medicamentos)) setMedicamentos(b.medicamentos as Medicamento[])
 *
 * Eso valida **el contenedor, no los elementos**. Un `null` dentro del arreglo, o
 * un elemento de un esquema anterior, pasa entero y truena igual en
 * `m.nombre?.trim()` o `s.label`. La lista es un arreglo; el problema está dentro.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * **Restaurar nunca debe poder tumbar la pantalla.** Ante un dato con forma
 * inesperada se descarta ESE elemento y se conserva el resto: perder un renglón
 * dudoso es infinitamente mejor que perder la consulta entera.
 *
 * Módulo PURO, sin dependencias.
 */
import type { Diagnostico, Medicamento, NotaSeccion } from '@/types/expediente'

const texto = (v: unknown): string => (typeof v === 'string' ? v : '')

/**
 * Las secciones que se pueden pintar sin reventar.
 *
 * Se exige `key` y `label`: sin ellos no hay nada que dibujar ni con qué
 * emparejar la plantilla, y un elemento así sólo puede venir de un esquema que
 * ya no existe.
 */
export function seccionesSanas(v: unknown): NotaSeccion[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
    .filter(s => texto(s.key).trim() && texto(s.label).trim())
    .map(s => ({
      key: texto(s.key),
      label: texto(s.label),
      value: texto(s.value),
      obligatorio: s.obligatorio === true,
    } as NotaSeccion))
}

/** Los diagnósticos que se pueden pintar. Sin descripción no hay diagnóstico. */
export function diagnosticosSanos(v: unknown): Diagnostico[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((d): d is Record<string, unknown> => !!d && typeof d === 'object')
    .filter(d => texto(d.descripcion).trim())
    .map(d => ({ ...d, descripcion: texto(d.descripcion) } as unknown as Diagnostico))
}

/** Los medicamentos que se pueden pintar. Sin nombre no hay medicamento. */
export function medicamentosSanos(v: unknown): Medicamento[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
    .filter(m => texto(m.nombre).trim())
    .map(m => ({ ...m, nombre: texto(m.nombre) } as unknown as Medicamento))
}

export const POR_QUE_NO_BASTA_ARRAY_IS_ARRAY =
  'Valida el contenedor, no los elementos. Un null dentro del arreglo, o un ' +
  'elemento de un esquema anterior, pasa entero y truena igual en m.nombre.trim() ' +
  'o s.label. La lista es un arreglo; el problema está dentro.'

export const POR_QUE_SE_DESCARTA_EL_ELEMENTO_Y_NO_LA_LISTA =
  'Perder un renglón con forma dudosa es infinitamente mejor que perder la ' +
  'consulta entera con el paciente delante. Restaurar nunca debe poder tumbar ' +
  'la pantalla.'
