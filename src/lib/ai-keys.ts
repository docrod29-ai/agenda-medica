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
import { NextResponse } from 'next/server'
import admin, { adminDb } from './firebase-admin'
import { planPorNivel, topeEconomicoDe, MEDICO_EXTRA } from './planes-ia'
import { uidEsFundador } from './authz/fundador-servidor'
import type { FuenteLlave } from './finanzas/cost-ledger'
import { aplicaTopeDeCortesia, type EstadoConsultorio } from './finanzas/tope-de-cortesia'

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

/**
 * GATE DE CRÉDITOS compartido (auditoría maestra 2026-07, L1 dinero). Devuelve una
 * respuesta 402 lista para `return` si el consultorio corre con la llave del DUEÑO
 * (fuente 'prueba') y ya agotó sus créditos del mes; si no, devuelve null y la ruta
 * sigue. Antes 10 rutas de IA MEDÍAN el gasto (registrarCreditos) pero no lo
 * CORTABAN: un consultorio agotado seguía quemando la API key del dueño.
 * Con llave propia del consultorio (fuente 'clinica') nunca corta: paga su API.
 */
/**
 * Decisión PURA del gate (testeable sin Firestore): solo corta con la llave del
 * dueño usada por un CLIENTE (`'prueba'`), con clinicId, y si ya está agotado.
 *
 * `'fundador'` es la misma llave física, pero la usa el dueño construyendo el
 * producto: no se corta nunca. Que la distinción viva en el NOMBRE DE LA FUENTE
 * y no en un booleano suelto es deliberado — así este gate, el de la cartera y
 * el medidor de uso deciden los tres a partir del mismo dato y no pueden
 * discrepar.
 */
export function debeCortarCreditos(fuente: ClaveResuelta['fuente'], clinicId: string | null, agotado: boolean): boolean {
  return fuente === 'prueba' && !!clinicId && agotado
}

export interface OpcionesGate {
  /**
   * La ruta sabe seguir en MODO ECONÓMICO cuando se acaban los créditos.
   *
   * ── EL FALLO QUE ESTO CIERRA ───────────────────────────────────────────────
   *
   * La página de precios promete, con estas palabras: «Al agotarlos sigue en
   * ⚡ Rápida sin costo hasta 120 notas más/mes; luego se pausa y recargas o
   * subes de plan». La nota tiene ese respaldo implementado… y NUNCA se
   * alcanzaba.
   *
   * El orden lo impedía: este portero corta con un 402 al principio de la ruta,
   * y la decisión de bajar a modo económico ocurre cincuenta líneas después. El
   * médico que agotaba sus créditos —pagando— recibía «se acabaron tus créditos»
   * con un paciente enfrente, cuando el producto tenía ciento veinte notas más
   * esperándolo.
   *
   * Con esta opción el portero deja pasar mientras quede cupo económico, y sólo
   * corta cuando de verdad no queda nada. Las rutas SIN respaldo (visión,
   * evidencia) siguen cortando igual que antes, porque ahí sí se acabó.
   */
  permiteEconomico?: boolean
}

export async function gateCreditos(
  clinicId: string | null,
  fuente: ClaveResuelta['fuente'],
  opciones: OpcionesGate = {},
): Promise<NextResponse | null> {
  // QUIÉN PAGA decide si se corta: con llave propia del consultorio NO se corta,
  // paga su propia API y cortarle sería quitarle algo que ya pagó.
  if (fuente !== 'prueba' || !clinicId) return null
  /**
   * También el tope de PRUEBA, no sólo los créditos del mes.
   *
   * Antes sólo miraba `creditosAgotados`, así que una cuenta en prueba con el
   * tope de cortesía consumido seguía llamando a la API del dueño. El Copilot de
   * UCI sí lo comprobaba (`pruebaAgotada`); estas rutas no.
   *
   * Falla ABIERTO: si la lectura revienta (red, permisos) NO se corta. Dejar al
   * médico sin la función por un fallo de infraestructura es peor que una llamada
   * de más, y el contador de uso sigue registrando.
   */
  const [agotados, prueba] = await Promise.all([
    creditosAgotados(clinicId).catch(() => false),
    pruebaAgotada(clinicId).catch(() => false),
  ])
  /**
   * El tope de la PRUEBA sí corta siempre: ahí no hay plan que respalde nada.
   */
  if (prueba) {
    return NextResponse.json(
      { ok: false, sinCreditos: true, error: 'Se acabó la IA incluida en tu prueba. Activa un plan para seguir usándola — tus expedientes no se tocan.' },
      { status: 402 },
    )
  }
  if (!debeCortarCreditos(fuente, clinicId, agotados)) return null

  // Créditos agotados, PERO la ruta sabe seguir en modo económico: se deja pasar
  // y que ella decida. El corte de verdad lo hace su propio tope.
  if (opciones.permiteEconomico) return null

  return NextResponse.json(
    { ok: false, sinCreditos: true, error: 'Se acabaron tus créditos de IA del mes. Puedes seguir dictando y escribir la nota a mano; para recuperar la IA, recarga créditos, sube de plan o usa tu propia llave en Configuración.' },
    { status: 402 },
  )
}

/**
 * Suma consultas EXTRA al mes (lo llama el webhook de Stripe al comprar recarga).
 *
 * ── POR QUÉ YA NO SE TRAGA EL ERROR ──────────────────────────────────────────
 *
 * Tenía `catch { /* no-bloqueante *\/ }` y devolvía `void`. El webhook de Stripe
 * la llama DESPUÉS de escribir la marca de idempotencia, así que si la escritura
 * fallaba: el webhook respondía 200, Stripe no reintentaba, la marca decía
 * «procesada» y el médico había pagado su recarga por CERO créditos. Sin error
 * en ninguna parte.
 *
 * Es exactamente el fallo que la rama del anticipo ya documenta como reparado
 * —allí se retira la marca y se lanza para que Stripe reintente—; ésta se quedó
 * sin esa red. Ahora lanza, y quien la llama decide qué hacer.
 */
export async function agregarCreditosExtra(clinicId: string, n: number): Promise<void> {
  await docIA(clinicId).set({
    uso: { [mesActual()]: { extra: admin.firestore.FieldValue.increment(n) } },
  }, { merge: true })
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
  /**
   * Quién paga esta llamada.
   *
   *  · `clinica`  — el consultorio puso su propia llave. Paga su API; no se corta.
   *  · `fundador` — el DUEÑO de la plataforma sobre la llave de la plataforma.
   *                 Ni tope de prueba ni cartera: §BK, «el acceso del fundador NO
   *                 debe depender de una suscripción de pago». Antes esto era
   *                 `prueba`, así que el dueño se topaba a los 30 usos al mes
   *                 construyendo su propio producto, y la única salida era pegar
   *                 una llave a mano en Configuración — que es de donde vino el
   *                 apagón del 31-jul: esa llave pegada envejeció y ganaba sobre
   *                 la de Vercel.
   *  · `prueba`   — un consultorio sin llave propia sobre la de la plataforma.
   *                 Aquí SÍ hay tope: es cortesía, y sin tope 100 doctores
   *                 quemarían el saldo del dueño.
   *  · `ninguna`  — no hay llave. No se llama a nadie.
   */
  fuente: FuenteLlave
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

  /**
   * La llave de la PLATAFORMA. Quién la usa decide si tiene tope.
   *
   * El dueño no es un cliente en prueba: está construyendo el producto y §BK
   * prohíbe que su acceso dependa de una suscripción. La distinción se hace aquí
   * —un solo sitio— y no como parámetro de las 23 rutas que llaman a esta
   * función, porque una exención que hay que acordarse de pasar 23 veces se
   * olvida en la 24 y falla en silencio. Ver `fundador-servidor.ts`.
   */
  if (envFallback && envFallback.trim()) {
    const fuente = (await uidEsFundador(uid)) ? 'fundador' as const : 'prueba' as const
    return { key: envFallback.trim(), fuente, clinicId }
  }
  return { key: '', fuente: 'ninguna', clinicId }
}

/**
 * ¿El consultorio ya superó el tope de CORTESÍA este mes?
 *
 * ── EL FALLO QUE ESTO CIERRA ─────────────────────────────────────────────────
 *
 * Esto contaba los usos SIN MIRAR SI EL CONSULTORIO PAGA. Y `resolverClaveIA`
 * marca `fuente: 'prueba'` a cualquiera que no haya pegado su propia API key
 * —pague o no, porque nada le provisiona una llave al suscribirse—.
 *
 * Una consulta dictada gasta ~4 usos (transcribir + procesar + verificar-nota +
 * evidencia). **30 ÷ 4 ≈ 7 consultas al mes.** Un cliente de Clínica recibía en
 * la segunda semana, con un paciente enfrente: «Se acabó la IA incluida en tu
 * prueba. Activa un plan» — a alguien que ya activó un plan.
 *
 * Peor: el corte va ANTES de mirar créditos e IGNORA `permiteEconomico`, así que
 * el modo económico que promete la página de precios nunca se alcanzaba.
 *
 * Ahora el tope es lo que siempre debió ser: la cortesía para quien todavía no
 * paga. A quien paga lo gobiernan sus créditos.
 */
export async function pruebaAgotada(clinicId: string | null): Promise<boolean> {
  if (!clinicId) return false
  try {
    const [secretos, clinica] = await Promise.all([
      docIA(clinicId).get(),
      adminDb.doc(`clinics/${clinicId}`).get(),
    ])
    if (!aplicaTopeDeCortesia(clinica.data() as EstadoConsultorio | undefined)) return false
    const usados = secretos.data()?.uso?.[mesActual()]?.prueba ?? 0
    return usados >= LIMITE_PRUEBA
  } catch {
    /**
     * Falla ABIERTO, como antes: si no se puede leer, no se corta.
     *
     * Es coherente con `gateCreditos`, que ya dice que dejar al médico sin la
     * función por un fallo de infraestructura es peor que una llamada de más —y
     * el contador de uso sigue registrando, así que el gasto no se pierde de
     * vista.
     */
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
  /** Medidor de CRÉDITOS del mes (L1 auditoría maestra): antes el cliente solo veía
   *  'total'/'prueba' (telemetría), nunca cuánto llevaba del BOTE de créditos. */
  creditos: { usados: number; extra: number; limite: number }
  /**
   * QUÉ LLAVE SE ESTÁ USANDO DE VERDAD.
   *
   * Sin esto, la pantalla decía «configurada ····igAA» y nada más — nunca decía
   * si esa llave era la que efectivamente se llamaba. El 31-jul-2026 esa
   * ambigüedad costó una tarde: la de Vercel estaba rotada y al día, la del
   * consultorio estaba muerta y ganaba, y desde la pantalla no había forma de
   * saberlo. Y para el dueño el estado «○ modo prueba» era directamente falso:
   * corre sobre la llave de la plataforma SIN tope, que es otra cosa.
   */
  fuenteEfectiva: Record<ProveedorIA, FuenteLlave>
}

/** Estado ENMASCARADO de las llaves + uso del mes (lo que sí puede ver el cliente). */
export async function estadoClavesIA(clinicId: string, uid?: string): Promise<EstadoClaves> {
  const d = (await docIA(clinicId).get()).data() ?? {}
  const mk = (k?: string) => (k && k.trim())
    ? { configurada: true, hint: '····' + k.trim().slice(-4) }
    : { configurada: false, hint: '' }
  const u = d.uso?.[mesActual()] ?? {}
  // Créditos del mes: usados + recarga extra + límite efectivo (ya escalado por asientos).
  let creditos = { usados: 0, extra: 0, limite: 0 }
  try {
    const nivel = await nivelIADe(clinicId)
    const [usados, extra, ent] = await Promise.all([
      creditosUsadosDelMes(clinicId), creditosExtraDelMes(clinicId), entitlementsDe(clinicId, nivel),
    ])
    creditos = { usados: Math.round(usados * 10) / 10, extra, limite: ent.limiteCreditos }
  } catch { /* si falla la lectura, medidor en 0 (no bloquea la config) */ }
  /**
   * La MISMA cascada que `resolverClaveIA`, no una copia con buena intención.
   * Si la pantalla dedujera la fuente por su cuenta, acabaría diciendo una cosa
   * mientras el servidor hace otra — que es exactamente el fallo que se está
   * arreglando aquí, sólo que un nivel más arriba.
   */
  const fundador = await uidEsFundador(uid)
  const deLaPlataforma: FuenteLlave = fundador ? 'fundador' : 'prueba'
  const efectiva = (propia: unknown, env?: string): FuenteLlave =>
    (typeof propia === 'string' && propia.trim()) ? 'clinica'
      : (env && env.trim()) ? deLaPlataforma
        : 'ninguna'

  return {
    claves: {
      anthropic: mk(d.anthropic), assemblyai: mk(d.assemblyai), openai: mk(d.openai),
    },
    fuenteEfectiva: {
      anthropic: efectiva(d.anthropic, process.env.ANTHROPIC_API_KEY),
      assemblyai: efectiva(d.assemblyai, process.env.ASSEMBLYAI_API_KEY),
      openai: efectiva(d.openai, process.env.OPENAI_API_KEY),
    },
    uso: { total: u.total ?? 0, prueba: u.prueba ?? 0, limitePrueba: LIMITE_PRUEBA },
    creditos,
  }
}
