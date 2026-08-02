/**
 * LIGAR EL CALENDARIO DE GOOGLE A LA FICHA DEL MÉDICO — el lado con Firestore.
 *
 * La decisión de a QUIÉN se liga vive en `vinculo-medico.ts`, que es puro y no
 * sabe de bases de datos. Aquí sólo está lo que hay que leer y escribir, en un
 * único sitio, para que el momento de conectar y el relleno posterior no puedan
 * divergir: si un día se afinan las reglas, se afinan para los dos.
 *
 * ── POR QUÉ EXISTE EL RELLENO ────────────────────────────────────────────────
 *
 * El vínculo se escribe al conectar el calendario. Quien lo conectó ANTES no
 * tiene ninguno: su pantalla dice «conectado», y sin embargo la agenda pública
 * sigue sin poder descontar sus eventos de Google. Nadie va a reconectar por su
 * cuenta algo que no sabe que le falta, así que se rellena solo la próxima vez
 * que abra su configuración.
 *
 * Con dos cuidados:
 *  · un vínculo que YA existe no se recalcula —moverlo sería reasignar horas de
 *    un médico a otro sin que nadie lo pidiera—; y
 *  · si no se puede ligar de forma inequívoca, NO se adivina: se guarda el
 *    motivo y se le enseña al médico.
 */
import { adminDb } from '@/lib/firebase-admin'
import {
  vincularMedico, estadoDelVinculo,
  type Vinculo, type MedicoVinculable, type TokenDeCalendario, type EstadoVinculo,
} from '@/lib/calendario/vinculo-medico'

/** A qué consultorio pertenece este uid. Cadena vacía si no se puede saber. */
export async function consultorioDe(uid: string): Promise<string> {
  const miembro = await adminDb.collection('clinic_members').doc(uid).get().catch(() => null)
  return (miembro?.data() as { clinicId?: string } | undefined)?.clinicId ?? ''
}

/**
 * Resuelve el vínculo y, si es inequívoco, lo escribe en la ficha del médico.
 *
 * No escribe el token: eso lo hace quien llama, porque al conectar se escribe
 * entero y al rellenar sólo se parchea.
 */
export async function resolverYLigar(
  uid: string,
  email: string | undefined,
  clinicId: string,
): Promise<Vinculo> {
  if (!clinicId) {
    return { como: 'sin-vinculo', motivo: 'No se pudo leer a qué consultorio perteneces.' }
  }
  try {
    const doctores = adminDb.collection('clinics').doc(clinicId).collection('doctors')
    const snap = await doctores.get()
    const lista = snap.docs.map(d => ({ id: d.id, ...(d.data() as object) })) as MedicoVinculable[]
    const vinculo = vincularMedico(uid, email, lista)
    if (vinculo.medicoId && vinculo.como === 'por-correo') {
      await doctores.doc(vinculo.medicoId).set({ uid }, { merge: true })
    }
    return vinculo
  } catch {
    // Conectar el calendario no se cae por no poder ligarlo.
    return { como: 'sin-vinculo', motivo: 'No se pudo leer la lista de médicos del consultorio.' }
  }
}

export interface ResultadoRelleno {
  estado: EstadoVinculo
  /** Vacío mientras no haya nada que enseñar. */
  motivo: string
  /** Verdadero sólo cuando la agenda pública ya puede descontar sus eventos. */
  ligado: boolean
}

/**
 * Rellena el vínculo de un calendario ya conectado, si le falta.
 *
 * Se llama desde un camino CON sesión (el uid y el correo salen del token
 * verificado, nunca del navegador). Nunca crea el documento del token: si no
 * hay calendario conectado, no hay nada que ligar.
 */
export async function rellenarVinculoSiFalta(
  uid: string,
  email: string | undefined,
): Promise<ResultadoRelleno> {
  const ref = adminDb.collection('googleTokens').doc(uid)
  const snap = await ref.get()
  const token = (snap.exists ? snap.data() : null) as TokenDeCalendario | null

  const estado = estadoDelVinculo(token)
  if (estado === 'sin-calendario') return { estado, motivo: '', ligado: false }
  if (estado === 'ya-ligado') return { estado, motivo: '', ligado: true }

  const clinicId = String(token?.clinicId ?? '').trim() || await consultorioDe(uid)
  const vinculo = await resolverYLigar(uid, email, clinicId)

  await ref.set({
    clinicId,
    medicoId: vinculo.medicoId ?? '',
    vinculoMedico: vinculo.como,
    vinculoMotivo: vinculo.motivo,
    // Que se pueda distinguir de un vínculo hecho al conectar.
    vinculoRellenadoEn: new Date().toISOString(),
  }, { merge: true })

  return {
    estado: vinculo.medicoId ? 'ya-ligado' : 'falta',
    motivo: vinculo.motivo,
    ligado: !!vinculo.medicoId,
  }
}
