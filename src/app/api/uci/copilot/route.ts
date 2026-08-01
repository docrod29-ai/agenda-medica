/**
 * POST /api/uci/copilot — ICU Copilot dual-model (Anthropic + OpenAI).
 *
 * `action: 'generar'` (default): recibe los CAMPOS del Panel UCI, arma en el
 * SERVIDOR el snapshot DETERMINISTA (los motores calculan; el LLM jamás), llama a
 * Claude (Opus/Sonnet) y a GPT en PARALELO con el mismo snapshot, y fusiona: el
 * primario manda y la 2ª opinión se muestra como divergencias. Nunca da órdenes.
 *
 * `action: 'feedback'`: guarda SOLO el 👍/👎 (señal de telemetría). NO se guarda
 * ni se reinyecta ningún cuadro clínico del paciente entre sesiones (ver abajo).
 *
 * Gateado por `verificarModuloIA` (mismo entitlement que la IA de consulta).
 * Las llaves viven server-side (llave del consultorio o env). El SNAPSHOT son solo
 * números de motores (sin PHI); pero la `discusion` del pase y las `tendencias` son
 * TEXTO LIBRE que podría contener identificadores si el médico los dicta — se envían
 * al proveedor de IA. No escribir nombres/identificadores en el pase.
 */
import { NextRequest, NextResponse } from 'next/server'
import admin, { adminDb } from '@/lib/firebase-admin'
import { verificarModuloIA } from '@/lib/auth-server'
import { limitarOResponder } from '@/lib/rate-limit'
import { resolverClaveIA, registrarUso, creditosAgotados, pruebaAgotada } from '@/lib/ai-keys'
import { COPILOT_UCI_POR_MOTOR, motorPorClave, motorPorDefecto } from '@/lib/planes-ia'
import { nivelIADe } from '@/lib/ai-keys'
import { snapshotUCI, buildCopilotUser, COPILOT_SYSTEM, parseSalidaCopilot, fusionarCopilot, COPILOT_VERSION } from '@/lib/uci/copilot'
import { safeLog } from '@/lib/security/sanitize'
import { esFundador as fundador } from '@/lib/authz/fundador'
import { llamarIA, type Contexto } from '@/lib/ia/gateway'

const MODELOS_CLAUDE = ['claude-opus-4-8', 'claude-sonnet-5', 'claude-sonnet-4-5']
const MODELOS_OPENAI = ['gpt-5', 'gpt-4o']

/**
 * Por qué esto devuelve el MOTIVO y no `null`.
 *
 * El 30-jul-2026 el Dr. vio en producción «ambos modelos fallaron o no hay llaves
 * válidas» y ese mensaje mezcla TRES cosas distintas que se arreglan de tres
 * formas distintas: la llave no sirve (401), el proveedor cortó (429/5xx), o el
 * modelo contestó pero no en el JSON que esperamos. Un error que no distingue
 * entre esos tres no es un error: es un encogimiento de hombros.
 */
type FalloIA = { ok: false; motivo: string }
type ExitoIA = { ok: true; texto: string; model: string; truncado?: boolean; bruto?: unknown }
type ResultadoIA = ExitoIA | FalloIA

const MODELOS_POR_MOTOR: Record<string, string[]> = {
  rapida: ['claude-haiku-4-5-20251001', 'claude-haiku-4-5', 'claude-sonnet-5'],
  estandar: ['claude-sonnet-5', 'claude-sonnet-4-6', 'claude-sonnet-4-5'],
  maxima: MODELOS_CLAUDE,
}

/**
 * Los dos proveedores, por el gateway.
 *
 * Aquí vivían `llamarClaude`, `llamarOpenAI` y `motivoHttp`: ochenta líneas que
 * repetían —con variaciones— lo que hacían otras quince rutas. Una de esas
 * variaciones fue el fallo del 30-jul: este archivo se quedó en `max_tokens:
 * 4000` mientras la nota de consulta ya usaba 24 000, y la síntesis llegaba
 * cortada a media llave justo cuando había más datos que sintetizar.
 *
 * Lo que se queda aquí es lo que SÍ es de este módulo: qué modelos correspondan
 * a cada motor, y que la salida sea JSON.
 */
async function llamarProveedor(
  proveedor: 'anthropic' | 'openai', clave: string, user: string,
  modelos: readonly string[], ctx: Contexto,
): Promise<ResultadoIA> {
  const r = await llamarIA(
    { proveedor, clave, modelos, system: COPILOT_SYSTEM, user, maxTokens: 16000, json: true, cacheSystem: proveedor === 'anthropic' },
    ctx,
  )
  if (!r.ok) return { ok: false, motivo: r.motivo }
  return { ok: true, texto: r.texto, model: r.modelo, truncado: r.truncado, bruto: r.bruto }
}

export async function POST(req: NextRequest) {
  const acceso = await verificarModuloIA(req, 'uci')
  if (!acceso.ok) return acceso.response

  const limite = await limitarOResponder(`uci-copilot:${acceso.uid}`, 20, 60, 'Demasiadas solicitudes al Copilot; espera un momento.')
  if (limite) return limite

  const body = await req.json().catch(() => ({})) as {
    action?: 'generar' | 'feedback'
    campos?: Record<string, string>
    discusion?: string
    tendencias?: string
    /** ⚡ rapida · ⭐ estandar · 💎 maxima. Igual que en la nota de consulta. */
    motor?: string
    internamientoId?: string
    feedback?: { rating?: 'up' | 'down'; preferencia?: string; snapshotHash?: string }
  }

  // ── FEEDBACK: solo señal (rating) para telemetría ──
  // SEGURIDAD/PHI: NO se guarda ningún resumen clínico del paciente. Antes se
  // almacenaba el cuadro del paciente como 'preferencia' y se REINYECTABA en el
  // razonamiento de OTROS pacientes (mezcla de PHI + aprender medicina de casos
  // individuales, prohibido). El Copilot NO aprende medicina; a lo sumo, más
  // adelante, estilo/formato bajo un pipeline supervisado y anonimizado.
  if (body.action === 'feedback') {
    if (!acceso.clinicId) return NextResponse.json({ error: 'Sin consultorio' }, { status: 403 })
    try {
      await adminDb.collection('clinics').doc(acceso.clinicId).collection('uci_copilot_feedback').add({
        rating: body.feedback?.rating === 'down' ? 'down' : 'up',
        internamientoId: body.internamientoId ?? '',
        medicoUid: acceso.uid, medicoEmail: acceso.email ?? '',
        ts: admin.firestore.FieldValue.serverTimestamp(),
      })
      return NextResponse.json({ ok: true })
    } catch (e) {
      safeLog.error('[uci-copilot] feedback', e)
      return NextResponse.json({ error: 'No se pudo guardar el feedback' }, { status: 500 })
    }
  }

  // ── GENERAR ──
  // NO se reinyecta ninguna "preferencia" clínica de feedback previo (evita cruzar
  // el cuadro de un paciente al razonamiento de otro). El prompt lleva solo el
  // snapshot determinista de ESTE paciente + su discusión/tendencias.
  const campos = body.campos ?? {}
  const snapshot = snapshotUCI(campos)
  const user = buildCopilotUser(snapshot, { discusion: body.discusion, tendencias: body.tendencias })

  const anthropic = await resolverClaveIA(acceso.uid, 'anthropic', process.env.ANTHROPIC_API_KEY ?? '').catch(() => ({ key: '', fuente: 'ninguna' as const, clinicId: acceso.clinicId ?? null }))
  const openai = await resolverClaveIA(acceso.uid, 'openai', process.env.OPENAI_API_KEY ?? '').catch(() => ({ key: '', fuente: 'ninguna' as const }))
  if (!anthropic.key && !openai.key) {
    return NextResponse.json({ error: 'No hay llave de IA configurada. Agrega tu llave de Anthropic u OpenAI en Configuración.' }, { status: 400 })
  }

  // RED DE SEGURIDAD DE COSTO (anti-fuga): si el Copilot corre sobre la LLAVE DEL
  // DUEÑO (fuente 'prueba' — el consultorio no configuró la suya), NO se permite
  // quemar el dual-model premium (~$10/turno) sin límite. Se corta si ya se
  // agotaron los créditos o el tope de prueba, igual que la nota. Con llave propia
  // del consultorio ('clinica') no aplica: paga su propia API.
  const sobreLlaveDelDueno = anthropic.fuente === 'prueba' || openai.fuente === 'prueba'
  if (sobreLlaveDelDueno && acceso.clinicId) {
    const [agotados, prueba] = await Promise.all([
      creditosAgotados(acceso.clinicId).catch(() => false),
      pruebaAgotada(acceso.clinicId).catch(() => false),
    ])
    if (agotados || prueba) {
      return NextResponse.json({ error: 'Créditos de IA agotados este mes. Recarga créditos o configura tu propia llave de IA en Configuración para seguir usando el Copilot de UCI.' }, { status: 402 })
    }
  }

  /**
   * EL MÉDICO ELIGE EL MOTOR, igual que en la nota de consulta.
   *
   * Antes el Copilot tenía UN solo precio: Opus y GPT-5 en paralelo, siempre, 7
   * créditos. Eso hacía que un pase de rutina pagara lo mismo que el caso
   * difícil, y con 500 créditos daba para 59 pases si se usaba en todos.
   *
   * Lo que se paga de más NO es «un modelo mejor»: es un SEGUNDO CEREBRO. Pedirle
   * a dos modelos distintos que razonen el mismo caso y enseñar sus desacuerdos
   * vale para el paciente complicado y sobra para confirmar que un
   * postoperatorio va bien. Ahora eso se elige.
   */
  const nivel = await nivelIADe(acceso.clinicId ?? null).catch(() => 'pro' as const)
  const motor = body.motor ? motorPorClave(body.motor) : motorPorDefecto(nivel)
  const cfg = COPILOT_UCI_POR_MOTOR[motor.clave]

  /**
   * COST LEDGER — el asiento ya no se escribe aquí.
   *
   * Lo hace el gateway al volver de cada `fetch`, con los tokens que el
   * proveedor acaba de devolver. La diferencia no es de estilo: cablearlo ruta
   * por ruta son dieciséis oportunidades de olvidarlo, y una llamada sin asiento
   * no se ve como un error sino como una plataforma que gasta menos de lo que
   * gasta. Aquí quedan las llamadas fallidas registradas también, porque un
   * rechazo tras generar tokens se cobra igual.
   */
  const ctx: Contexto = {
    feature: `copilot-uci:${motor.clave}`,
    requestId: req.headers.get('x-vercel-id') || `uci-${acceso.uid}-${Date.now()}`,
    clinicId: acceso.clinicId ?? null,
    uid: acceso.uid,
    creditos: cfg.creditos,
    fuente: 'ninguna',
    // Una sola definición de «fundador» para toda la plataforma: aquí vivía una
    // copia suelta de la lista de correos, y dos listas se desincronizan el día
    // que se agregue un socio.
    esFundador: fundador(acceso.email, process.env.SUPERADMIN_EMAILS),
  }

  const [rc, ro] = await Promise.all([
    (cfg.anthropic && anthropic.key)
      ? llamarProveedor('anthropic', anthropic.key, user, MODELOS_POR_MOTOR[motor.clave] ?? MODELOS_CLAUDE, { ...ctx, fuente: anthropic.fuente })
      : Promise.resolve<ResultadoIA>({ ok: false, motivo: cfg.anthropic ? 'Anthropic: sin llave configurada.' : 'Anthropic: no se pidió en este motor.' }),
    (cfg.openai && openai.key)
      ? llamarProveedor('openai', openai.key, user, MODELOS_OPENAI, { ...ctx, fuente: openai.fuente })
      : Promise.resolve<ResultadoIA>({ ok: false, motivo: cfg.openai ? 'OpenAI: sin llave configurada.' : 'Segunda opinión: no se pidió en este motor (sólo en 💎 Máxima).' }),
  ])

  const primario = rc.ok ? parseSalidaCopilot(rc.texto) : null
  const segunda = ro.ok ? parseSalidaCopilot(ro.texto) : null

  if (!primario && !segunda) {
    /**
     * Se dice QUÉ pasó, por proveedor.
     *
     * «Ambos modelos fallaron o no hay llaves válidas» era un encogimiento de
     * hombros: mezclaba llave inválida, proveedor caído y respuesta que no se
     * pudo leer — tres cosas que se arreglan de tres formas distintas. Ahora cada
     * proveedor dice lo suyo, y si contestó pero su salida no era el JSON
     * esperado, se dice ESO, que es un fallo nuestro y no suyo.
     */
    const ilegible = (p: string, r: ExitoIA) => r.truncado
      ? `${p}: la respuesta se cortó por longitud antes de cerrar.`
      : `${p}: respondió, pero su salida no se pudo leer como JSON.`
    const motivos = [
      rc.ok ? ilegible('Anthropic', rc) : rc.motivo,
      ro.ok ? ilegible('OpenAI', ro) : ro.motivo,
    ]
    return NextResponse.json({
      error: `El Copilot no pudo generar la síntesis. ${motivos.join(' ')}`,
      detalle: motivos,
    }, { status: 502 })
  }

  // MEDIDOR DE CRÉDITOS: el Copilot UCI es la acción MÁS CARA (Opus + GPT en
  // paralelo, ~$10/turno). Se cobra su costo real en créditos (antes valía 0 = la
  // mayor fuga de dinero). Se cobra una vez por turno cuando respondió ≥1 modelo.
  if (acceso.clinicId && (rc || ro)) {
    // Los créditos ya los cobró la cartera al confirmar la reserva (§AA–AF).
    // Dejar aquí el incremento de antes cobraría DOS VECES la misma nota.
    // Atribuir el uso a la fuente del modelo que REALMENTE respondió (si Anthropic
    // no tenía llave pero OpenAI sí consumió la env del dueño, no marcarlo 'ninguna').
    registrarUso(acceso.clinicId, rc ? anthropic.fuente : openai.fuente).catch(() => {})
  }

  // Si el primario (Anthropic) falló pero GPT respondió, GPT pasa a ser el primario.
  const fusion = primario
    ? fusionarCopilot(primario, segunda, { primario: rc.ok ? rc.model : null, segunda: ro.ok ? ro.model : null })
    : fusionarCopilot(segunda, null, { primario: ro.ok ? ro.model : null, segunda: null })

  return NextResponse.json({ ok: true, version: COPILOT_VERSION, ...fusion })
}
