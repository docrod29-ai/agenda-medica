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
