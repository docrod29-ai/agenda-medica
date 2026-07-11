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

export type NivelIA = 'pro' | 'premium'

/**
 * NIVEL DE IA del consultorio (distinto del `plan` de suscripción trial/básico/
 * clínica que vive en el doc clinics/{id}): 'pro' (económico — Sonnet 5, 2ª
 * opinión a demanda) o 'premium' (Opus 4.8 + thinking + 2ª opinión GPT-5
 * automática). Default 'pro' para que el costo sea sostenible al precio base.
 * Se guarda en el doc de secretos (solo servidor).
 */
export async function nivelIADe(clinicId: string | null): Promise<NivelIA> {
  if (!clinicId) return 'pro'
  try {
    const n = (await docIA(clinicId).get()).data()?.nivelIA
    return n === 'premium' ? 'premium' : 'pro'
  } catch {
    return 'pro'
  }
}

/** Fija el nivel de IA del consultorio (lo usa el selector de la consola del dueño). */
export async function guardarNivelIA(clinicId: string, nivel: NivelIA): Promise<void> {
  await docIA(clinicId).set({ nivelIA: nivel }, { merge: true })
}

/**
 * Cuenta UNA consulta (nota FINAL de IA) del mes para el candado de gasto. El
 * borrador en vivo NO cuenta (se llama solo con la nota final). No bloquea.
 */
export async function registrarConsulta(clinicId: string | null): Promise<void> {
  if (!clinicId) return
  try {
    await docIA(clinicId).set({
      uso: { [mesActual()]: { consultas: admin.firestore.FieldValue.increment(1) } },
    }, { merge: true })
  } catch { /* no-bloqueante */ }
}

/** Consultas (notas finales) usadas este mes por el consultorio. */
export async function consultasDelMes(clinicId: string | null): Promise<number> {
  if (!clinicId) return 0
  try {
    return (await docIA(clinicId).get()).data()?.uso?.[mesActual()]?.consultas ?? 0
  } catch {
    return 0
  }
}

/** Consultas EXTRA compradas (recarga/top-up) disponibles este mes. */
export async function creditosExtraDelMes(clinicId: string | null): Promise<number> {
  if (!clinicId) return 0
  try {
    return (await docIA(clinicId).get()).data()?.uso?.[mesActual()]?.extra ?? 0
  } catch {
    return 0
  }
}

/** Suma consultas EXTRA al mes (lo llama el webhook de Stripe al comprar recarga). */
export async function agregarCreditosExtra(clinicId: string, n: number): Promise<void> {
  try {
    await docIA(clinicId).set({
      uso: { [mesActual()]: { extra: admin.firestore.FieldValue.increment(n) } },
    }, { merge: true })
  } catch { /* no-bloqueante */ }
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
