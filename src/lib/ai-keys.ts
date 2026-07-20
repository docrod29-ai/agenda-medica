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
import { planPorNivel, topeEconomicoDe, MEDICO_EXTRA } from './planes-ia'

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
 * MENÚ DE IA: quema `n` créditos del mes (una nota Estándar = 3, Máxima = 10, una
 * pregunta al Consultor = fracción). Es el ÚNICO contador de gasto: notas y
 * Consultor caen todos en `uso.{mes}.creditos`. No bloquea.
 */
export async function registrarCreditos(clinicId: string | null, n: number): Promise<void> {
  if (!clinicId || !(n > 0)) return
  try {
    await docIA(clinicId).set({
      uso: { [mesActual()]: { creditos: admin.firestore.FieldValue.increment(n) } },
    }, { merge: true })
  } catch { /* no-bloqueante */ }
}

/** El Consultor de evidencia quema créditos del MISMO bote (alias legible). */
export async function registrarConsultor(clinicId: string | null, creditos: number): Promise<void> {
  return registrarCreditos(clinicId, creditos)
}

/** Créditos TOTALES usados este mes (notas + Consultor). Contra esto se compara el límite del plan. */
export async function creditosUsadosDelMes(clinicId: string | null): Promise<number> {
  if (!clinicId) return 0
  try {
    return (await docIA(clinicId).get()).data()?.uso?.[mesActual()]?.creditos ?? 0
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

/**
 * TOPE DURO compartido: ¿el consultorio ya gastó TODOS sus créditos del mes
 * (notas + Consultor) según su plan? Es el único candado de gasto ahora que todos
 * corren con la llave del dueño. Ante un error de lectura devuelve false (NO
 * bloquear al médico por un fallo de Firestore). El límite sale de planes-ia.
 */
export async function creditosAgotados(clinicId: string | null): Promise<boolean> {
  if (!clinicId) return false
  try {
    const nivel = await nivelIADe(clinicId)
    // Mismo cálculo que expediente/procesar: entitlementsDe ya escala el límite por
    // # de médicos (asientos pagados). Antes usaba planPorNivel (bolsa de UN solo
    // médico) y cortaba con 402 a consultorios multi-médico que YA pagaron asientos.
    const [usados, extraRecarga, ent] = await Promise.all([
      creditosUsadosDelMes(clinicId),
      creditosExtraDelMes(clinicId),
      entitlementsDe(clinicId, nivel),
    ])
    const limite = ent.limiteCreditos + extraRecarga
    return usados >= limite
  } catch {
    return false
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

/**
 * Cuenta una nota generada en MODO ECONÓMICO (excedente tras agotar los créditos
 * premium): corre en Sonnet 5, casi no cuesta y NO topa. Se guarda aparte para
 * estadística/facturación; no cuenta contra el cupo premium del plan.
 */
export async function economicasDelMes(clinicId: string | null): Promise<number> {
  if (!clinicId) return 0
  try {
    return (await docIA(clinicId).get()).data()?.uso?.[mesActual()]?.economicas ?? 0
  } catch {
    return 0
  }
}

export async function registrarConsultaEconomica(clinicId: string | null): Promise<void> {
  if (!clinicId) return
  try {
    await docIA(clinicId).set({
      uso: { [mesActual()]: { economicas: admin.firestore.FieldValue.increment(1) } },
    }, { merge: true })
  } catch { /* no-bloqueante */ }
}

/**
 * Cuenta los MÉDICOS (asientos) del consultorio en clinic_members (rol medico o
 * admin; la secretaria NO cuenta). Mínimo 1. Es la base del cobro por asiento y
 * del cupo de créditos (cada médico trae su propia bolsa).
 */
export async function contarMedicos(clinicId: string | null): Promise<number> {
  if (!clinicId) return 1
  try {
    const snap = await adminDb.collection('clinic_members').where('clinicId', '==', clinicId).get()
    const n = snap.docs.filter(d => { const r = d.data()?.role; return r === 'medico' || r === 'admin' }).length
    return Math.max(1, n)
  } catch {
    return 1
  }
}

export interface Entitlements { medicos: number; limiteCreditos: number; topeEconomico: number }

/**
 * Cupo EFECTIVO del consultorio, que ESCALA con el número de médicos: el plan
 * incluye 1 médico; cada médico adicional suma su bolsa de créditos + tope
 * económico. Así el gasto sigue al ingreso (cobro por asiento).
 */
export async function entitlementsDe(clinicId: string | null, nivel: NivelIA): Promise<Entitlements> {
  const medicos = await contarMedicos(clinicId)
  const extras = Math.max(0, medicos - 1)
  const me = MEDICO_EXTRA[nivel] ?? MEDICO_EXTRA.pro
  return {
    medicos,
    limiteCreditos: planPorNivel(nivel).creditos + extras * me.creditos,
    topeEconomico: topeEconomicoDe(nivel) + extras * me.economico,
  }
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

  /**
   * SIN CONSULTORIO NO HAY LLAVE. Ni siquiera la de prueba.
   *
   * `/registro` es autoservicio y público. Una cuenta recién creada todavía no
   * tiene documento en `clinic_members`, así que `clinicId` es null — y con null
   * TODA la contabilidad se caía sola, cada pieza por su cuenta:
   *
   *   registrarCreditos(null, n)   → return, nunca incrementa
   *   creditosUsadosDelMes(null)   → 0, siempre (el contador no sube porque nadie escribe)
   *   pruebaAgotada(null)          → false, siempre
   *   registrarUso(null, …)        → return, cero telemetría
   *
   * Es decir: registrarse bastaba para tener Opus 4.8 con extended thinking,
   * ilimitado, contra la API key del dueño y sin aparecer en ningún medidor. Lo
   * único que se interponía era el rate-limit POR UID —que con N cuentas es N×40
   * por minuto— y que además es fail-open por diseño.
   *
   * Un usuario sin consultorio no tiene ninguna razón legítima para generar notas:
   * todavía está en /setup. Se corta aquí.
   */
  if (!clinicId) return { key: '', fuente: 'ninguna', clinicId: null }

  try {
    const k = (await docIA(clinicId).get()).data()?.[proveedor]
    if (typeof k === 'string' && k.trim()) return { key: k.trim(), fuente: 'clinica', clinicId }
  } catch { /* cae al env */ }

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
