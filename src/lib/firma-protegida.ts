'use client'
/**
 * FIRMA MÉDICA AISLADA — REG-014.
 *
 * ═══ El problema ═══
 * La imagen de la firma (y el sello) vivía en `clinics/{id}/config/main`, cuyo
 * `read` es `isMember`. Cualquier miembro del consultorio —recepción, farmacia,
 * enfermería— podía leerla con el SDK desde la consola del navegador y
 * llevársela. Con esa imagen se estampa una receta.
 *
 * ═══ La decisión del médico dueño (2026-07-28) ═══
 * «La firma no debe ser un asset legible por cualquier miembro del consultorio.
 *  Fichero de firma privado · permisos por rol · auditoría de cada acceso ·
 *  jamás enviarla al SDK general.»
 *
 * ═══ Lo que hace este módulo ═══
 * Mueve la firma a un subdocumento propio, `clinics/{id}/config/firma`, con una
 * regla de lectura EXCLUSIVA para médicos. El documento general de configuración
 * deja de contenerla.
 *
 * ═══ Lo que este módulo NO hace, y hay que decirlo ═══
 * El ideal del Dr. es que «el frontend no necesita recibir nunca el archivo
 * original de firma». Eso exige renderizar el documento firmado en el SERVIDOR,
 * y hoy la impresión es toda del lado del cliente. Esta capa cierra el robo por
 * SDK entre roles —que es el riesgo concreto y presente— pero un médico
 * autenticado sigue recibiendo la imagen en su navegador, porque es él quien la
 * imprime. El servicio de firmado server-side es una unidad aparte.
 */
import { doc, getDoc, setDoc, updateDoc, deleteField } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface FirmaProtegida {
  /** Firma general del consultorio (compat: consultorios de un solo médico). */
  firmaImagenDataUrl?: string
  /** Firma POR MÉDICO — cada quien la suya. */
  firmaPorMedico?: Record<string, string>
}

const refFirma = (clinicId: string) => doc(db, 'clinics', clinicId, 'config', 'firma')
const refMain = (clinicId: string) => doc(db, 'clinics', clinicId, 'config', 'main')

/**
 * Lee la firma del subdocumento protegido.
 *
 * `legado` es lo que traiga el `config/main` de un consultorio que todavía no
 * migró: durante la transición se usa como respaldo para que a NADIE se le caiga
 * la firma de sus recetas por el cambio. En cuanto migra, `config/main` deja de
 * tenerla y el respaldo queda en nada.
 */
export async function leerFirma(clinicId: string, legado?: FirmaProtegida): Promise<FirmaProtegida> {
  try {
    const snap = await getDoc(refFirma(clinicId))
    if (snap.exists()) return snap.data() as FirmaProtegida
  } catch {
    /* Sin permiso (no es médico) o sin red → se cae al legado; nunca se rompe la impresión. */
  }
  return legado ?? {}
}

/** Guarda la firma SOLO en el subdocumento protegido. */
export async function guardarFirma(clinicId: string, patch: FirmaProtegida): Promise<void> {
  const actual = await leerFirma(clinicId)
  await setDoc(refFirma(clinicId), {
    ...actual,
    ...patch,
    ...(patch.firmaPorMedico
      ? { firmaPorMedico: { ...(actual.firmaPorMedico ?? {}), ...patch.firmaPorMedico } }
      : {}),
    actualizadoEn: new Date().toISOString(),
  }, { merge: true })
}

/**
 * MIGRACIÓN. Copia la firma de `config/main` al subdocumento protegido y la
 * BORRA del general — que es lo único que cierra el agujero de verdad: mientras
 * el dato siga en `config/main`, cualquier miembro puede leerlo.
 *
 * Es idempotente y silenciosa: si no hay nada que migrar, no escribe. Solo la
 * puede ejecutar un médico (las reglas lo exigen), así que se dispara al abrir
 * la configuración.
 *
 * Devuelve true si migró algo (útil para el registro de auditoría).
 */
export async function migrarFirmaSiHaceFalta(clinicId: string, legado?: FirmaProtegida): Promise<boolean> {
  const tieneLegado = !!legado?.firmaImagenDataUrl
    || !!(legado?.firmaPorMedico && Object.keys(legado.firmaPorMedico).length)
  if (!tieneLegado) return false
  try {
    await guardarFirma(clinicId, {
      firmaImagenDataUrl: legado?.firmaImagenDataUrl,
      firmaPorMedico: legado?.firmaPorMedico,
    })
    // Se borra del documento general: el subdocumento ya es la fuente.
    await updateDoc(refMain(clinicId), {
      firmaImagenDataUrl: deleteField(),
      firmaPorMedico: deleteField(),
    })
    return true
  } catch {
    // Si la migración falla, NO se pierde nada: el legado sigue en su sitio y la
    // firma se sigue resolviendo por el respaldo de `leerFirma`.
    return false
  }
}
