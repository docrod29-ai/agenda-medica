/**
 * POST /api/expediente/antibiograma-razonar
 *
 * Capa de RAZONAMIENTO con IA sobre el motor determinista del antibiograma.
 * El motor calcula los HECHOS (server-side, mismo `interpretarAntibiograma`);
 * Claude (y GPT como 2ª opinión si hay llave) los RAZONAN como infectólogo, SIN
 * contradecir categorías ni inventar. Combina «motor (rigor) + IA (juicio)».
 *
 * Body:   { organismo, resultados, sitio?, pruebas?, motor? }
 * Output: { ok, razonamiento, segundaOpinion?, modelos } | { ok:false, error }
 */
import { NextRequest, NextResponse } from 'next/server'
import { anotarLlamada, type Contexto } from '@/lib/ia/gateway'
import { claseDeFallo, quienPaga, avisoAlMedico } from '@/lib/ia/fallo-proveedor'
import { reportarFalloIA } from '@/lib/ia/incidentes-servidor'
import { esFundador } from '@/lib/authz/fundador'
import { validarRazonamiento, omiteAlertasCriticas } from '@/lib/expediente/antibiograma/validar-razonamiento'
import { verificarModuloIA } from '@/lib/auth-server'
import { limitarOResponder } from '@/lib/rate-limit'
import { gateCreditos, resolverClaveIA, registrarCreditos } from '@/lib/ai-keys'
import { COSTO_CREDITOS } from '@/lib/planes-ia'
import { safeLog } from '@/lib/security/sanitize'
import { interpretarAntibiograma, type EntradaAntibiograma } from '@/lib/expediente/antibiograma'
import { resumenDeterminista, RAZONAR_SYSTEM, buildRazonarUser } from '@/lib/expediente/antibiograma/razonar'
import { correlacionDe } from '@/lib/observabilidad/correlacion'
import { iaNoDisponible } from '@/lib/ia/fallo-proveedor'

const ENV_ANTHROPIC = process.env.ANTHROPIC_API_KEY ?? ''
const ENV_OPENAI = process.env.OPENAI_API_KEY ?? ''
const ANTHROPIC_VERSION = '2023-06-01'

const MODELOS_OPUS = ['claude-opus-4-8', 'claude-sonnet-5']
const MODELOS_SONNET = ['claude-sonnet-5', 'claude-sonnet-4-6']
const MODELOS_HAIKU = ['claude-haiku-4-5-20251001', 'claude-haiku-4-5']

async function claude(key: string, modelos: string[], system: string, user: string, ctx?: Contexto): Promise<{ texto: string; modelo: string } | { error: string }> {
  const t0 = Date.now()
  for (const model of modelos) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': ANTHROPIC_VERSION, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: 1100, system, messages: [{ role: 'user', content: user }] }),
        signal: AbortSignal.timeout(40000),
      })
      if (res.ok) {
        const d = await res.json()
        // El asiento del libro de costos: esta ruta no dejaba ninguno.
        if (ctx) anotarLlamada(ctx, 'anthropic', String(d?.model ?? model), d, Date.now() - t0)
        const t = (d.content?.[0]?.text ?? '').trim()
        if (t) return { texto: t, modelo: model }
      } else if (res.status !== 404 && res.status !== 400) {
        // Mismo criterio que el resto de la IA: quién paga la llave decide qué se
        // le dice al médico. Sin `ctx` no se sabe, y lo prudente es NO culparlo.
        const cuerpo = await res.text().catch(() => '')
        const quien = quienPaga(ctx?.fuente ?? 'ninguna')
        const clase = claseDeFallo(res.status, cuerpo)
        reportarFalloIA({ clase, quien, proveedor: 'anthropic', feature: 'antibiograma-razonar', status: res.status })
        return { error: avisoAlMedico(clase, quien, 'anthropic').texto }
      }
    } catch (e) { return { error: String(e).includes('timeout') ? 'la IA tardó demasiado' : 'error de red' } }
  }
  return { error: 'ningún modelo disponible' }
}

async function gpt(key: string, system: string, user: string, ctx?: Contexto): Promise<string | null> {
  const t1 = Date.now()
  for (const model of ['gpt-5', 'gpt-4o']) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, max_completion_tokens: 1100, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
        signal: AbortSignal.timeout(40000),
      })
      if (res.ok) {
        const d = await res.json()
        if (ctx) anotarLlamada(ctx, 'openai', String(d?.model ?? model), d, Date.now() - t1)
        const t = (d.choices?.[0]?.message?.content ?? '').trim()
        if (t) return t
      }
    } catch { /* intenta el siguiente */ }
  }
  return null
}

export async function POST(req: NextRequest) {
  const acceso = await verificarModuloIA(req, 'expediente')
  if (!acceso.ok) return acceso.response
  const _rl = await limitarOResponder(`antibiograma-razonar:${acceso.uid}`, 30, 60)
  if (_rl) return _rl

  const { key: API_KEY, clinicId, fuente } = await resolverClaveIA(acceso.uid, 'anthropic', ENV_ANTHROPIC)
  const _corte = await gateCreditos(clinicId, fuente); if (_corte) return _corte

  /**
   * Contexto del libro de costos. La ruta conserva su propia cascada —migrarla
   * entera es otro trabajo— pero el gasto ya no es invisible: una llamada sin
   * asiento no se ve como un error, se ve como una plataforma que gasta menos
   * de lo que gasta.
   */
  const ctxCosto: Contexto = {
    feature: 'antibiograma-razonar',
    requestId: req.headers.get('x-vercel-id') || `ar-${acceso.uid}-${Date.now()}`,
        correlacion: correlacionDe(req),
    clinicId: clinicId ?? null, uid: acceso.uid, creditos: 0, fuente,
    esFundador: esFundador(acceso.email, process.env.SUPERADMIN_EMAILS),
  }
  if (!API_KEY) return NextResponse.json({ ok: false, error: iaNoDisponible('razonamiento').mensaje }, { status: 503 })

  let body: { organismo?: string; resultados?: EntradaAntibiograma['resultados']; sitio?: EntradaAntibiograma['sitio']; pruebas?: EntradaAntibiograma['pruebas']; motor?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }

  const entrada: EntradaAntibiograma = {
    organismo: (body.organismo ?? '').trim(),
    resultados: Array.isArray(body.resultados) ? body.resultados : [],
    sitio: body.sitio,
    pruebas: body.pruebas,
  }
  if (!entrada.organismo && entrada.resultados.length === 0) {
    return NextResponse.json({ ok: false, error: 'Captura al menos el organismo o el panel para razonar.' }, { status: 400 })
  }

  try {
    // 1) HECHOS deterministas (server-side, misma función que la UI).
    const interp = interpretarAntibiograma(entrada)
    const resumen = resumenDeterminista(entrada, interp)
    const user = buildRazonarUser(resumen)

    // 2) Modelo de Claude según el motor elegido.
    const modelos = body.motor === 'maxima' ? MODELOS_OPUS : body.motor === 'rapida' ? MODELOS_HAIKU : MODELOS_SONNET

    // 3) Claude razona; si hay llave OpenAI y el motor es Máxima, GPT da 2ª opinión EN PARALELO.
    const { key: OPENAI_KEY } = await resolverClaveIA(acceso.uid, 'openai', ENV_OPENAI)
    const quiereGPT = !!OPENAI_KEY && body.motor === 'maxima'
    const [rc, gptTexto] = await Promise.all([
      claude(API_KEY, modelos, RAZONAR_SYSTEM, user, ctxCosto),
      quiereGPT ? gpt(OPENAI_KEY as string, RAZONAR_SYSTEM, user, ctxCosto) : Promise.resolve(null),
    ])

    if ('error' in rc) {
      // `rc.error` YA viene redactado según quién paga la llave. Añadirle aquí un
      // «revisa tu llave/créditos» volvía a culpar al médico por la llave de la
      // plataforma — justo lo que el clasificador acaba de decidir no hacer.
      return NextResponse.json({ ok: false, error: rc.error }, { status: 502 })
    }
    /**
     * VALIDACIÓN POSTERIOR: la regla anti-contradicción deja de ser solo prompt.
     *
     * El texto del modelo se devolvía tal cual. "NO contradigas al motor" era una
     * instrucción, no una comprobación: nada impedía que recomendara un fármaco
     * que el panel reporta R, que el motor marcó como "evitar" o al que la especie
     * es intrínsecamente resistente.
     *
     * No se censura ni se reescribe el texto —eso sería poner al validador a hacer
     * clínica, y el médico perdería un razonamiento entero por una frase—: se
     * ANOTAN las contradicciones para mostrarlas junto al razonamiento. El motor es
     * la autoridad sobre los hechos; el modelo aporta juicio; el médico decide con
     * ambos a la vista.
     */
    const contradicciones = validarRazonamiento(rc.texto, interp, entrada)
    const contradiccionesGPT = gptTexto ? validarRazonamiento(gptTexto, interp, entrada) : []

    /**
     * ── LO QUE EL TEXTO SE CALLÓ (REG-259) ──────────────────────────────────
     *
     * `validarRazonamiento` caza lo que el modelo dice y CONTRADICE al motor.
     * No cazaba lo que el modelo **omite**, que es el otro modo de fallo y el
     * más silencioso: el motor detecta una carbapenemasa, el texto no la
     * menciona, y el médico lee un razonamiento que se lee bien y no dice lo
     * único que había que decir.
     *
     * `omiteAlertasCriticas` existía para esto exactamente, con su prueba, y
     * no la llamaba nadie.
     *
     * No se reescribe el texto ni se le añade nada: se AVISA de que faltan, y
     * las alertas del motor ya viajan aparte en la respuesta. Completar el
     * razonamiento del modelo por mi cuenta sería inventar juicio clínico.
     */
    const omitidas = omiteAlertasCriticas(rc.texto, interp)
    const omitidasGPT = gptTexto ? omiteAlertasCriticas(gptTexto, interp) : false

    void registrarCreditos(clinicId, COSTO_CREDITOS.antibiogramaRazonar)
    return NextResponse.json({
      ok: true,
      razonamiento: rc.texto,
      segundaOpinion: gptTexto ?? undefined,
      modelos: [rc.modelo, ...(gptTexto ? ['gpt'] : [])],
      ...(contradicciones.length ? { contradicciones } : {}),
      ...(contradiccionesGPT.length ? { contradiccionesSegundaOpinion: contradiccionesGPT } : {}),
      ...(omitidas ? { omiteAlertasCriticas: true } : {}),
      ...(omitidasGPT ? { omiteAlertasCriticasSegundaOpinion: true } : {}),
    })
  } catch (err) {
    safeLog.error('[antibiograma-razonar] Exception:', err)
    return NextResponse.json({ ok: false, error: `Error al razonar: ${String(err).slice(0, 120)}` }, { status: 500 })
  }
}
