/**
 * POST /api/expediente/atribuir-roles
 *
 * Toma los turnos de habla diarizados (Hablante A/B/C… de AssemblyAI, que son
 * anónimos) y decide con Claude QUIÉN es cada quién: Médico, Paciente o
 * Acompañante — usando el contenido clínico (quién pregunta/explora/indica vs
 * quién describe síntomas). Esto es lo que ningún diarizador acústico hace solo
 * y lo que vuelve la separación médico-paciente automática ("perfecta"), sin que
 * el médico tenga que etiquetar a mano.
 *
 * Body: { utterances: [{ speaker, text }] }
 * Resp: { ok, roles: { "A": "Médico", "B": "Paciente", ... } }
 *
 * Si algo falla devuelve { ok:false } y el cliente deja el etiquetado manual —
 * nunca rompe el flujo.
 */
import { NextRequest, NextResponse } from 'next/server'
import { errorAlCliente } from '@/lib/security/error-al-cliente'
import { rolesDe, esRolAtribuible, catalogoParaPrompt, NO_IDENTIFICADO } from '@/lib/asr/roles-hablante'
import { diagnosticarSeparacion } from '@/lib/asr/separacion-fallida'
import { verificarModuloIA } from '@/lib/auth-server'
import { limitarOResponder } from '@/lib/rate-limit'
import { llamarIA } from '@/lib/ia/gateway'
import { esFundador } from '@/lib/authz/fundador'
import { gateCreditos, resolverClaveIA } from '@/lib/ai-keys'
import { COSTO_CREDITOS } from '@/lib/planes-ia'
import { correlacionDe } from '@/lib/observabilidad/correlacion'

export const runtime = 'nodejs'
export const maxDuration = 30

const MODELOS = ['claude-sonnet-5', 'claude-sonnet-4-6', 'claude-sonnet-4-5']

export async function POST(req: NextRequest) {
  const acceso = await verificarModuloIA(req, 'expediente')
  if (!acceso.ok) return acceso.response
  const _rl = await limitarOResponder(`atribuir-roles:${acceso.uid}`, 40, 60)
  if (_rl) return _rl

  const { key, clinicId, fuente } = await resolverClaveIA(acceso.uid, 'anthropic', process.env.ANTHROPIC_API_KEY ?? '')
  const _corte = await gateCreditos(clinicId, fuente); if (_corte) return _corte
  if (!key) return NextResponse.json({ ok: false, error: 'sin llave' }, { status: 503 })

  let body: { utterances?: { speaker?: string; text?: string }[]; contexto?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }

  const utts = (body.utterances ?? []).filter(u => u && typeof u.text === 'string')
  if (utts.length === 0) return NextResponse.json({ ok: false, error: 'sin turnos' }, { status: 400 })

  // Hablantes presentes (para acotar la respuesta y validar).
  const hablantes = Array.from(new Set(utts.map(u => String(u.speaker ?? '?'))))

  /**
   * ── ANTES DE REPARTIR ROLES: ¿HUBO ALGO QUE REPARTIR? ──────────────────────
   *
   * Medido sobre el corpus actuado: de las 9 confusiones de rol, **6 venían de
   * los dos diálogos en los que el proveedor devolvió UNA sola voz**. Y no eran
   * confusiones: el diálogo entero llegaba como un solo turno —las preguntas del
   * médico y las respuestas del paciente juntas— y este endpoint contestaba
   * «Médico» con toda naturalidad, porque el texto está lleno de preguntas
   * clínicas.
   *
   * Resultado: **todo lo que dijo el paciente quedaba archivado como dicho por
   * el médico**. De ahí cuelgan el motor de negaciones y la procedencia, así que
   * las dos defensas razonaban sobre una atribución falsa.
   *
   * Un solo hablante puede ser legítimo —el médico dictando solo—, así que no se
   * desconfía de todos: se comprueba la marca gramatical que distingue los dos
   * casos (`diagnosticarSeparacion`). Cuando hay mezcla, ningún rol se asigna:
   * la pantalla enseña «Hablante A» y el médico decide, que es la verdad.
   */
  const separacion = diagnosticarSeparacion({
    hablantes,
    texto: utts.map(u => String(u.text ?? '')).join(' '),
  })
  if (separacion.veredicto === 'mezcla_sin_separar') {
    return NextResponse.json({
      ok: true,
      roles: {},
      sinIdentificar: hablantes.length,
      hablantes: hablantes.length,
      separacionFallida: true,
      aviso: `${separacion.motivo} No se atribuyó ningún rol: revisa quién dijo cada cosa antes de firmar.`,
    })
  }

  /**
   * EL CATÁLOGO DEPENDE DEL MÓDULO — Y DEJA DECIR «NO LO SÉ».
   *
   * Antes eran tres roles fijos y el modelo tenía que elegir uno. En un pase de
   * hospital eso convierte a enfermería en «Paciente», y desde que el rol se
   * archiva, esa suposición se queda en el expediente.
   */
  const modulo = String(body.contexto ?? 'consulta')
  const validos = new Set(rolesDe(modulo))

  // Muestra acotada: primeros ~40 turnos / ~4000 chars bastan para inferir roles
  // (no hace falta mandar toda la consulta → más rápido y barato).
  let muestra = ''
  for (const u of utts) {
    const linea = `Hablante ${u.speaker}: ${u.text}\n`
    if (muestra.length + linea.length > 4000) break
    muestra += linea
  }

  const system = 'Eres un asistente clínico. Recibes el diálogo de una grabación clínica transcrito con hablantes anónimos (Hablante A, B, C…). Determina el ROL de cada hablante ÚNICAMENTE entre estos valores: ' + catalogoParaPrompt(modulo) + '. Guíate por el contenido: quién pregunta, explora, explica o indica tratamiento; quién describe síntomas propios; quién reporta signos, balances o administración de medicamentos; quién presenta el caso. Si no puedes decidirlo con lo que dice el hablante, responde "' + NO_IDENTIFICADO + '" — es preferible a adivinar, porque de esta atribución dependen decisiones clínicas posteriores. Responde ÚNICAMENTE un objeto JSON que mapee cada letra de hablante a su rol, sin texto extra. Ejemplo: {"A":"Médico","B":"Paciente"}.'
  const userMsg = `Hablantes: ${hablantes.join(', ')}\n\nDiálogo:\n${muestra}\n\nResponde solo el JSON.`

  // Por el gateway (§P–T): misma cascada, mismo manejo de errores, y ahora
  // también asiento en el libro de costos — esta llamada no dejaba ninguno.
  try {
    const r = await llamarIA(
      { proveedor: 'anthropic', clave: key as string, modelos: MODELOS, system, user: userMsg, maxTokens: 300 },
      {
        feature: 'atribuir-roles',
        requestId: req.headers.get('x-vercel-id') || `ar-${acceso.uid}-${Date.now()}`,
        correlacion: correlacionDe(req),
        clinicId: clinicId ?? null, uid: acceso.uid, creditos: COSTO_CREDITOS.atribuirRoles, fuente,
        esFundador: esFundador(acceso.email, process.env.SUPERADMIN_EMAILS),
      },
    )
    if (!r.ok) return NextResponse.json({ ok: false, error: r.motivo }, { status: 502 })
    const text = r.texto
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) return NextResponse.json({ ok: false, error: 'sin JSON' }, { status: 502 })

    const crudo = JSON.parse(m[0]) as Record<string, unknown>
    // Sanea: solo hablantes conocidos y roles válidos.
    const roles: Record<string, string> = {}
    let sinIdentificar = 0
    for (const h of hablantes) {
      const r = String(crudo[h] ?? '').trim()
      if (!validos.has(r)) continue
      /**
       * «No identificado» NO se archiva: es la forma de decir que no se sabe, y
       * guardarlo lo convertiría en un dato. Se cuenta y se devuelve el número,
       * para que la pantalla pueda decir cuántas voces quedaron sin nombre en
       * vez de enseñar una lista que parece completa.
       */
      if (!esRolAtribuible(r, modulo)) { sinIdentificar++; continue }
      roles[h] = r
    }
    // Los créditos ya los cobró la cartera al confirmar la reserva (§AA–AF).
    // Dejar aquí el incremento de antes cobraría DOS VECES la misma nota.
    return NextResponse.json({ ok: true, roles, sinIdentificar, hablantes: hablantes.length, separacionFallida: false })
  } catch (e) {
    return errorAlCliente()
  }
}
