'use client'
/**
 * Persistencia de los límites de dosis cargados por el médico.
 *
 * Viven en `clinics/{clinicId}/antimicrobial_limits/{id}` y son un registro con
 * valor de auditoría: qué tope, para qué indicación, de qué fuente, quién lo
 * cargó y contra qué versión del dataset.
 *
 * Por consultorio y no global, igual que las validaciones de dosis: quien carga
 * un tope es el médico responsable de ESE consultorio, y su criterio no vale por
 * el de al lado.
 */
import { doc, getDocs, setDoc, deleteDoc, collection } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { LimiteCargado } from '@/lib/antimicrobianos/v4/limites'

const col = (clinicId: string) => collection(db, 'clinics', clinicId, 'antimicrobial_limits')

/**
 * El id lleva fármaco e indicación, y las barras se sustituyen: `TMP/SMX` con
 * una barra dentro crearía una subcolección en vez de un documento.
 */
export const idDe = (farmaco: string, indicacion: string): string =>
  `${farmaco}__${indicacion}`.replace(/\//g, '_').replace(/\s+/g, '-').trim().toLowerCase()

export async function getLimites(clinicId: string): Promise<LimiteCargado[]> {
  if (!clinicId) return []
  const snap = await getDocs(col(clinicId))
  return snap.docs.map(d => d.data() as LimiteCargado).filter(l => l?.farmaco)
}

/**
 * Quita las llaves con valor `undefined`, en profundidad.
 *
 * **Firestore RECHAZA `undefined`** y esta aplicación no lo tiene configurado
 * para ignorarlo (`ignoreUndefinedProperties` no está puesto, a propósito: que
 * salte avisa de datos mal formados en vez de guardarlos a medias).
 *
 * Y casi todos los topes traen máximos vacíos —un fármaco con techo absoluto
 * pero sin contextual, por ejemplo—, así que TODOS los botones de confirmar
 * lanzaban `Unsupported field value: undefined` y no guardaban nada. Como la
 * llamada iba con `void`, el error se perdía y el botón parecía muerto: el
 * médico se quedaba picándole sin saber que el problema no era el clic.
 *
 * Se limpia aquí, en la única puerta de escritura, y no en cada llamador: un
 * saneamiento que hay que acordarse de aplicar se olvida.
 */
function sinIndefinidos<T>(v: T): T {
  if (Array.isArray(v)) return v.map(sinIndefinidos) as unknown as T
  if (v !== null && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (x !== undefined) out[k] = sinIndefinidos(x)
    }
    return out as T
  }
  return v
}

export async function guardarLimite(clinicId: string, l: LimiteCargado): Promise<void> {
  await setDoc(doc(col(clinicId), idDe(l.farmaco, l.indicacion)), sinIndefinidos(l))
}

export { sinIndefinidos }

/**
 * Retira un límite.
 *
 * Existe porque un médico tiene que poder decir «me equivoqué». Sin esto, un
 * tope mal cargado sólo se puede tapar con otro, y el registro de auditoría
 * acabaría contando una historia que no pasó.
 */
export async function borrarLimite(clinicId: string, farmaco: string, indicacion: string): Promise<void> {
  await deleteDoc(doc(col(clinicId), idDe(farmaco, indicacion)))
}
