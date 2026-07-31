import { adminDb } from '@/lib/firebase-admin'
import type { ClinicWhatsApp } from '@/types'

/**
 * DÓNDE VIVE EL TOKEN DEL CANAL DE WHATSAPP.
 *
 * EL DEFECTO QUE CIERRA: `whatsapp.apiKey` —el token permanente de Meta o la
 * api_key de 360dialog— se guardaba EN CLARO dentro del doc raíz de la clínica,
 * que cualquier miembro puede leer (las reglas dan `read` a todo el equipo). Con
 * ese token se envían mensajes desde el número verificado de la clínica sin pasar
 * por la app: una recepcionista, o un XSS en el panel, se lo llevan. El propio
 * gestor de secretos del proyecto ya declaraba "el token nunca debe viajar en
 * claro fuera del gestor de secretos", y la implementación lo contradecía.
 *
 * El token pasa a `clinics/{id}/secretos/whatsapp`, cuya regla es
 * `read, write: if false` (solo Admin SDK). Todo lector y escritor del token es
 * server-side, así que nada de cara al cliente cambia. En el doc raíz queda solo
 * lo NO sensible (proveedor, número, estado de conexión) para que el panel siga
 * mostrando si está conectado.
 *
 * Migración PEREZOSA y sin downtime: al leer, si el secreto aún no está en
 * `secretos` pero sí en el doc raíz (clínica no migrada), se lee de ahí, se copia
 * a `secretos` y se borra del raíz. Así la primera vez que una clínica envía tras
 * el despliegue, su token deja de estar expuesto, sin un script aparte.
 */

const secretoRef = (clinicId: string) =>
  adminDb.collection('clinics').doc(clinicId).collection('secretos').doc('whatsapp')

/**
 * Devuelve la config de WhatsApp con el `apiKey` resuelto desde el gestor de
 * secretos. Recibe la config del doc raíz (sin token) y le adjunta el token.
 */
export async function conSecretoCanal(
  clinicId: string,
  waPublico: ClinicWhatsApp | undefined,
): Promise<ClinicWhatsApp | undefined> {
  if (!waPublico) return undefined
  // 1. Ruta normal: el token ya está en el gestor de secretos.
  try {
    const snap = await secretoRef(clinicId).get()
    const apiKey = snap.exists ? (snap.data()?.apiKey as string | undefined) : undefined
    if (apiKey) return { ...waPublico, apiKey }
  } catch { /* cae a la migración */ }

  // 2. Clínica NO migrada: el token sigue en el doc raíz. Se usa y se migra.
  const legado = waPublico.apiKey
  if (legado) {
    try {
      await secretoRef(clinicId).set({ apiKey: legado, migradoEn: new Date().toISOString() }, { merge: true })
      // Quita el token del doc raíz (deja el resto de la config intacta).
      await adminDb.collection('clinics').doc(clinicId).update({ 'whatsapp.apiKey': FieldValueDelete() })
    } catch { /* si la migración falla, al menos el envío de este ciclo funciona */ }
    return waPublico
  }
  return waPublico
}

/** Guarda el token en el gestor de secretos y NO en el doc raíz. */
export async function guardarSecretoCanal(clinicId: string, apiKey: string): Promise<void> {
  await secretoRef(clinicId).set({ apiKey, guardadoEn: new Date().toISOString() }, { merge: true })
}

// firebase-admin FieldValue.delete() sin importar el namespace completo arriba.
import { FieldValue } from 'firebase-admin/firestore'
function FieldValueDelete() { return FieldValue.delete() }
