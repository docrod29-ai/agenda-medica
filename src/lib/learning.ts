/**
 * LEARNING ENGINE (v1) — aprende de lo que el médico ACEPTA del copiloto.
 *
 * Señal: cada vez que el médico agrega una sugerencia a la nota, se cuenta su
 * CATEGORÍA (el prefijo del id: 'renal', 'calc', 'meta', 'gesta'…). Con esas
 * frecuencias, las sugerencias NO críticas se reordenan para poner arriba las que
 * ese médico suele usar. Las CRÍTICAS nunca se mueven (seguridad primero).
 *
 * Arranque en frío honesto: sin datos no cambia nada; mejora con el uso. La
 * personalización es POR MÉDICO (clinics/{id}/learning/{uid}), no global.
 *
 * Parte determinista (reordenar/categoría) es pura y testeable; la persistencia es
 * una capa delgada y a prueba de fallos (nunca rompe la consulta).
 */
import { doc, getDoc, setDoc, increment } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Sugerencia } from '@/lib/expediente/copiloto'
import type { Medicamento } from '@/types/expediente'

/** Categoría de una sugerencia = prefijo del id antes de ':'. */
export function categoriaDe(idSugerencia: string): string {
  const i = idSugerencia.indexOf(':')
  return (i > 0 ? idSugerencia.slice(0, i) : idSugerencia).toLowerCase()
}

export type Preferencias = Record<string, number>

const ref = (clinicId: string, uid: string) => doc(db, 'clinics', clinicId, 'learning', uid)

/** Registra que el médico aceptó una sugerencia de esta categoría (fail-safe). */
export async function registrarAceptacion(clinicId: string, uid: string, categoria: string): Promise<void> {
  if (!clinicId || !uid || !categoria) return
  try {
    await setDoc(ref(clinicId, uid), { cat: { [categoria]: increment(1) }, updatedAt: new Date().toISOString() }, { merge: true })
  } catch { /* aprender nunca debe romper la consulta */ }
}

/** Carga las preferencias del médico (frecuencias por categoría). */
export async function cargarPreferencias(clinicId: string, uid: string): Promise<Preferencias> {
  if (!clinicId || !uid) return {}
  try {
    const snap = await getDoc(ref(clinicId, uid))
    const cat = (snap.data()?.cat ?? {}) as Preferencias
    return cat
  } catch { return {} }
}

/**
 * Reordena las sugerencias por preferencia del médico SIN alterar la seguridad:
 * primero SIEMPRE las críticas (en su orden), luego el resto ordenado por cuánto
 * suele usar cada categoría ese médico (desc), y a igualdad, se conserva el orden
 * original (estable). Puro y testeable.
 */
export function ordenarPorPreferencia(sugerencias: Sugerencia[], prefs: Preferencias): Sugerencia[] {
  const idx = new Map(sugerencias.map((s, i) => [s, i]))
  const peso = (s: Sugerencia) => prefs[categoriaDe(s.id)] ?? 0
  const criticas = sugerencias.filter(s => s.nivel === 'critico')
  const resto = sugerencias.filter(s => s.nivel !== 'critico')
    .sort((a, b) => (peso(b) - peso(a)) || (idx.get(a)! - idx.get(b)!))
  return [...criticas, ...resto]
}

/** Las N categorías que más usa el médico (para un “tus más usadas”). */
export function topCategorias(prefs: Preferencias, n = 3): { categoria: string; usos: number }[] {
  return Object.entries(prefs)
    .map(([categoria, usos]) => ({ categoria, usos }))
    .filter(x => x.usos > 0)
    .sort((a, b) => b.usos - a.usos)
    .slice(0, n)
}

/* ─── Recetas frecuentes: aprende lo que ESE médico realmente receta ─────────── */

/** Una receta aprendida = la fila COMPLETA más reciente de ese fármaco + su frecuencia de uso. */
export interface MedRecetado {
  nombre: string
  dosis: string
  via: string
  frecuencia: string
  duracion: string
  count: number
  updatedAt: string
}

/**
 * Llave estable de un fármaco: minúsculas, sin acentos, solo alfanumérico (para
 * que sea una llave de mapa válida en Firestore y agrupe variantes de escritura).
 * "Amoxicilina/Clavulanato" y "amoxicilina clavulanato" → "amoxicilina_clavulanato".
 */
export function normalizarNombreMed(nombre: string): string {
  return (nombre || '')
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

/**
 * Registra las recetas que el médico ACABA de emitir (al imprimir/descargar).
 * Por cada fármaco: +1 a su contador y guarda su fila COMPLETA más reciente
 * (dosis/vía/frecuencia/duración) — así "tus más recetados" ofrece la posología
 * que ESE médico suele poner, no una genérica. Fail-safe: nunca rompe la receta.
 */
export async function registrarRecetados(clinicId: string, uid: string, meds: Medicamento[]): Promise<void> {
  if (!clinicId || !uid || !Array.isArray(meds) || meds.length === 0) return
  try {
    const payload: Record<string, unknown> = {}
    for (const m of meds) {
      const key = normalizarNombreMed(m?.nombre ?? '')
      if (!key) continue
      payload[key] = {
        nombre: (m.nombre ?? '').trim(),
        dosis: m.dosis ?? '', via: m.via ?? 'oral',
        frecuencia: m.frecuencia ?? '', duracion: m.duracion ?? '',
        count: increment(1), updatedAt: new Date().toISOString(),
      }
    }
    if (Object.keys(payload).length === 0) return
    await setDoc(ref(clinicId, uid), { meds: payload }, { merge: true })
  } catch { /* aprender nunca debe romper la receta */ }
}

/** Los N fármacos más recetados por el médico (desc por uso, luego más reciente). Puro. */
export function topRecetados(meds: Record<string, MedRecetado>, n = 8): MedRecetado[] {
  return Object.values(meds || {})
    .filter(m => m && m.nombre && (m.count ?? 0) > 0)
    .sort((a, b) => (b.count - a.count) || (a.updatedAt < b.updatedAt ? 1 : -1))
    .slice(0, n)
}

/** Carga "tus más recetados" del médico (fail-safe). */
export async function cargarRecetasFrecuentes(clinicId: string, uid: string, n = 8): Promise<MedRecetado[]> {
  if (!clinicId || !uid) return []
  try {
    const snap = await getDoc(ref(clinicId, uid))
    const meds = (snap.data()?.meds ?? {}) as Record<string, MedRecetado>
    return topRecetados(meds, n)
  } catch { return [] }
}
