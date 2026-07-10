/**
 * Llaves de IA por consultorio (multi-tenant) + medidor de uso.
 *
 * Cada consultorio puede tener SUS propias API keys (Anthropic, AssemblyAI,
 * OpenAI). Si no tiene, se usa la llave del dueño (env) en "modo prueba" con un
 * tope mensual, para que probar con doctores no queme el saldo del dueño.
 *
 * SEGURIDAD: las llaves viven en `clinics/{clinicId}/secretos/ia`, que SOLO lee
 * el servidor vía Admin SDK. El cliente nunca las recibe (solo un estado
 * enmascarado "····1234"). Firestore niega ese path al cliente por defecto.
 */
import admin, { adminDb } from './firebase-admin'

export type ProveedorIA = 'anthropic' | 'assemblyai' | 'openai'

/** Usos gratis al mes con la llave del dueño antes de pedir la propia. */
export const LIMITE_PRUEBA = Number(process.env.LIMITE_PRUEBA_IA ?? '30')

const docIA = (clinicId: string) => adminDb.doc(`clinics/${clinicId}/secretos/ia`)
const mesActual = () => new Date().toISOString().slice(0, 7)

export type PlanIA = 'pro' | 'premium'

/**
 * Plan del consultorio: 'pro' (económico — Sonnet 5, sin verificación automática)
 * o 'premium' (Opus 4.8 + thinking + segunda opinión GPT-5). Default 'pro' para
 * que el costo por consultorio sea sostenible al precio base. Se guarda en el
 * mismo doc de secretos (solo servidor).
 */
export async function planDe(clinicId: string | null): Promise<PlanIA> {
  if (!clinicId) return 'pro'
  try {
    const p = (await docIA(clinicId).get()).data()?.plan
    return p === 'premium' ? 'premium' : 'pro'
  } catch {
    return 'pro'
  }
}

/** Fija el plan del consultorio (lo usa la consola del dueño / selector de plan). */
export async function guardarPlan(clinicId: string, plan: PlanIA): Promise<void> {
  await docIA(clinicId).set({ plan }, { merge: true })
}

async function clinicIdDe(uid: string): Promise<string | null> {
  try {
    const snap = await adminDb.collection('clinic_members').doc(uid).get()
    return (snap.data()?.clinicId as string) ?? null
  } catch {
    return null
  }
}

export interface ClaveResuelta {
  key: string
  fuente: 'clinica' | 'prueba' | 'ninguna'
  clinicId: string | null
}

/**
 * Resuelve la API key efectiva para un usuario: la de SU consultorio si la tiene,
 * o la del dueño (env) en modo prueba. '' si no hay ninguna.
 */
export async function resolverClaveIA(
  uid: string, proveedor: ProveedorIA, envFallback?: string,
): Promise<ClaveResuelta> {
  const clinicId = await clinicIdDe(uid)
  if (clinicId) {
    try {
      const k = (await docIA(clinicId).get()).data()?.[proveedor]
      if (typeof k === 'string' && k.trim()) return { key: k.trim(), fuente: 'clinica', clinicId }
    } catch { /* cae al env */ }
  }
  if (envFallback && envFallback.trim()) return { key: envFallback.trim(), fuente: 'prueba', clinicId }
  return { key: '', fuente: 'ninguna', clinicId }
}

/** ¿El consultorio ya superó el tope de prueba este mes? (solo aplica a llave de prueba) */
export async function pruebaAgotada(clinicId: string | null): Promise<boolean> {
  if (!clinicId) return false
  try {
    const usados = (await docIA(clinicId).get()).data()?.uso?.[mesActual()]?.prueba ?? 0
    return usados >= LIMITE_PRUEBA
  } catch {
    return false
  }
}

/** Cuenta un uso de IA del consultorio (para el medidor). No bloquea si falla. */
export async function registrarUso(clinicId: string | null, fuente: ClaveResuelta['fuente']): Promise<void> {
  if (!clinicId || fuente === 'ninguna') return
  const mes = mesActual()
  try {
    await docIA(clinicId).set({
      uso: {
        [mes]: {
          total: admin.firestore.FieldValue.increment(1),
          ...(fuente === 'prueba' ? { prueba: admin.firestore.FieldValue.increment(1) } : {}),
        },
      },
    }, { merge: true })
  } catch { /* no-bloqueante */ }
}

/** Guarda (o borra con '') la llave de un proveedor para el consultorio. */
export async function guardarClaveIA(clinicId: string, proveedor: ProveedorIA, key: string): Promise<void> {
  await docIA(clinicId).set({ [proveedor]: key.trim() }, { merge: true })
}

export interface EstadoClaves {
  claves: Record<ProveedorIA, { configurada: boolean; hint: string }>
  uso: { total: number; prueba: number; limitePrueba: number }
}

/** Estado ENMASCARADO de las llaves + uso del mes (lo que sí puede ver el cliente). */
export async function estadoClavesIA(clinicId: string): Promise<EstadoClaves> {
  const d = (await docIA(clinicId).get()).data() ?? {}
  const mk = (k?: string) => (k && k.trim())
    ? { configurada: true, hint: '····' + k.trim().slice(-4) }
    : { configurada: false, hint: '' }
  const u = d.uso?.[mesActual()] ?? {}
  return {
    claves: {
      anthropic: mk(d.anthropic), assemblyai: mk(d.assemblyai), openai: mk(d.openai),
    },
    uso: { total: u.total ?? 0, prueba: u.prueba ?? 0, limitePrueba: LIMITE_PRUEBA },
  }
}
