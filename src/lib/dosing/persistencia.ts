/**
 * Persistencia de las firmas de validación del dataset de dosis.
 *
 * Una firma dice «el Dr. comprobó esta regla contra su fuente, en esta versión
 * del dataset». Vive en `clinics/{clinicId}/dosing_validations/{farmaco}` y es
 * un registro con valor de auditoría: quién, cuándo y sobre qué versión.
 *
 * Se guarda por consultorio, no global: quien valida es el médico responsable de
 * ESE consultorio, y su firma no vale por el de al lado.
 */

import { doc, getDocs, setDoc, deleteDoc, collection } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { FirmaValidacion } from '@/lib/dosing/validacion'

const col = (clinicId: string) => collection(db, 'clinics', clinicId, 'dosing_validations')

/**
 * El id del documento es el nombre del fármaco, y por eso hay que limpiarlo:
 * `TMP/SMX` y `Posaconazole IV/DR tablet` llevan barras, y una barra en un id de
 * Firestore crea una subcolección en vez de un documento.
 */
export const idDe = (farmaco: string) => farmaco.replace(/\//g, '__').trim()

/** Todas las firmas del consultorio, indexadas por nombre de fármaco. */
export async function getFirmas(clinicId: string): Promise<Record<string, FirmaValidacion>> {
  if (!clinicId) return {}
  const snap = await getDocs(col(clinicId))
  const out: Record<string, FirmaValidacion> = {}
  for (const d of snap.docs) {
    const f = d.data() as FirmaValidacion
    if (f?.farmaco) out[f.farmaco] = f
  }
  return out
}

/** Guarda (o reemplaza) la firma de un fármaco. */
export async function guardarFirma(clinicId: string, firma: FirmaValidacion): Promise<void> {
  await setDoc(doc(col(clinicId), idDe(firma.farmaco)), firma)
}

/**
 * Retira la validación de un fármaco.
 *
 * Existe porque un médico tiene que poder decir «me equivoqué al validar esto».
 * Dejarlo marcado como validado por no poder deshacerlo sería peor.
 */
export async function retirarFirma(clinicId: string, farmaco: string): Promise<void> {
  await deleteDoc(doc(col(clinicId), idDe(farmaco)))
}
