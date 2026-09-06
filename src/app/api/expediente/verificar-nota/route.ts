/**
 * POST /api/expediente/verificar-nota  —  SEGUNDA OPINIÓN (verificación cruzada)
 *
 * La nota la redacta Claude Opus 4.8 (razonamiento máximo). Aquí un SEGUNDO
 * modelo de primer nivel (OpenAI GPT-5) la REVISA por seguridad clínica: dosis
 * peligrosas, interacciones, alergias del paciente vs fármacos, contradicciones
 * con lo dicho en la consulta, diagnósticos sin sustento, datos críticos que
 * faltan. NO reescribe la nota — solo señala hallazgos para que el médico decida
 * (mantiene al médico en control, respeta la inmutabilidad NOM-004).
 *
 * Reusa OPENAI_API_KEY (la misma de la transcripción) → normalmente sin llave
 * nueva. Es no-bloqueante: si falla, la nota sigue igual.
 *
 * Body: { nota: {resumen, secciones, diagnosticos, medicamentos, signos}, transcripcion, contexto }
 * Resp: { ok, modelo, hallazgos: [{ severidad, tema, problema, sugerencia }] }
 */
import { segmentarParaRevision, unirHallazgos } from '@/lib/ia/segmentar-revision'
import { NextRequest, NextResponse } from 'next/server'
import { errorAlCliente } from '@/lib/security/error-al-cliente'
import { GUARDA_INYECCION, delimitar } from '@/lib/expediente/prompts'
import { verificarModuloIA } from '@/lib/auth-server'
import { limitarOResponder } from '@/lib/rate-limit'
import { gateCreditos, resolverClaveIA, registrarUso } from '@/lib/ai-keys'
import { COSTO_CREDITOS } from '@/lib/planes-ia'
import { llamarIA } from '@/lib/ia/gateway'
import { esFundador } from '@/lib/authz/fundador'
import { correlacionDe } from '@/lib/observabilidad/correlacion'

export const runtime = 'nodejs'
export const maxDuration = 45

// Mejor razonamiento de OpenAI primero; respaldo a gpt-4o si la cuenta no tiene gpt-5.
const MODELOS_OPENAI = ['gpt-5', 'gpt-4o']

interface NotaEntrada {
  resumen?: string
  secciones?: { titulo?: string; contenido?: string }[]
  diagnosticos?: { descripcion?: string; cie10?: string }[]
  medicamentos?: { nombre?: string; dosis?: string; via?: string; frecuencia?: string; duracion?: string }[]
  signos?: Record<string, unknown>
}

export async function POST(req: NextRequest) {
  const acceso = await verificarModuloIA(req, 'expediente')
  if (!acceso.ok) return acceso.response
  const _rl = await limitarOResponder(`verificar-nota:${acceso.uid}`, 20, 60)
  if (_rl) return _rl

  const { key, fuente, clinicId } = await resolverClaveIA(acceso.uid, 'openai', process.env.OPENAI_API_KEY)
  const _corte = await gateCreditos(clinicId, fuente); if (_corte) return _corte
  if (!key) return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY no configurada' }, { status: 503 })

  let body: { nota?: NotaEntrada; transcripcion?: string; contexto?: Record<string, unknown> }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }

  const nota = body.nota
  if (!nota) return NextResponse.json({ ok: false, error: 'Falta nota' }, { status: 400 })

  // Serializa la nota a texto legible para el revisor.
  const notaTexto = [
    nota.resumen ? `RESUMEN: ${nota.resumen}` : '',
    (nota.secciones ?? []).map(s => `${s.titulo ?? ''}: ${s.contenido ?? ''}`).join('\n'),
    (nota.diagnosticos ?? []).length ? 'DIAGNÓSTICOS:\n' + nota.diagnosticos!.map(d => `- ${d.descripcion ?? ''}${d.cie10 ? ` (${d.cie10})` : ''}`).join('\n') : '',
    (nota.medicamentos ?? []).length ? 'MEDICAMENTOS:\n' + nota.medicamentos!.map(m => `- ${m.nombre ?? ''} ${m.dosis ?? ''} ${m.via ?? ''} ${m.frecuencia ?? ''} ${m.duracion ?? ''}`.trim()).join('\n') : '',
    nota.signos && Object.keys(nota.signos).length ? 'SIGNOS: ' + JSON.stringify(nota.signos) : '',
  ].filter(Boolean).join('\n\n')

  const ctx = body.contexto ?? {}
  const alergias = Array.isArray(ctx.alergias) ? (ctx.alergias as string[]).join(', ') : (ctx.alergias ?? 'no referidas')

  const system = GUARDA_INYECCION + '\n\n' + 'Eres un médico revisor experto en seguridad del paciente. Revisas una nota clínica ya redactada contra la transcripción de la consulta y los datos del paciente. Señala SOLO problemas de seguridad o congruencia REALES: dosis peligrosas o fuera de rango, interacciones farmacológicas, fármaco recetado contra una alergia del paciente, contradicciones entre la nota y lo dicho, diagnósticos sin sustento en la transcripción, o datos críticos faltantes. NO reescribas la nota. NO inventes problemas si no los hay. Responde SOLO un objeto JSON: {"hallazgos":[{"severidad":"alta|media|baja","tema":"...","problema":"...","sugerencia":"..."}]}. Si todo está correcto, devuelve {"hallazgos":[]}.'
  /**
   * EL RECORTE NO PUEDE SER SILENCIOSO.
   *
   * La transcripción y la nota se recortaban a 12 000 caracteres cada una sin
   * ninguna marca. Pasado ese punto la revisora de seguridad no ve la cola de la
   * consulta —donde suele estar el plan y la receta— y puede responder
   * `{"hallazgos":[]}`, que el cliente pinta como «revisado y limpio».
   *
   * Esta ruta YA tiene un canal honesto para «no se pudo revisar»
   * (`incompleto: true`), puesto por una auditoría anterior para el caso del
   * JSON ilegible. El truncamiento no lo usaba.
   */
  const TOPE = 12000
  const transcripcionCompleta = body.transcripcion ?? ''

  /**
   * LA NOTA SÍ ES UN TOPE DURO.
   *
   * Se trocea la TRANSCRIPCIÓN, no la nota: revisar media nota contra el
   * dictado entero daría por buenas las dosis de la mitad que no se leyó.
   */
  if (notaTexto.length > TOPE) {
    return NextResponse.json({
      ok: false, incompleto: true, hallazgos: [],
      error: `La nota es más larga de lo que la segunda opinión puede revisar (${notaTexto.length.toLocaleString('es-MX')} caracteres, tope ${TOPE.toLocaleString('es-MX')}). La nota NO fue verificada — revísala tú.`,
    }, { status: 200 })
  }

  /**
   * ── LA CONSULTA LARGA YA NO SE QUEDA SIN SEGUNDA OPINIÓN ──────────────────
   *
   * Antes, pasado el tope, no se revisaba NADA. Era honesto —lo decía— pero
   * dejaba sin red justo a la consulta complicada: un dictado de 20 minutos
   * ronda los 20 000 caracteres, así que el tope no era un caso raro.
   *
   * Ahora la transcripción se parte en tramos SOLAPADOS y la nota entera se
   * revisa contra cada uno. El solape es por lo mismo que en el audio: una
   * indicación partida en seco deja media dosis a cada lado.
   */
  const seg = segmentarParaRevision(transcripcionCompleta, TOPE)
  const tramos = seg.tramos.length ? seg.tramos : ['']
  const mensajeDe = (tramo: string, i: number) =>
    `PACIENTE: edad ${ctx.edad ?? '?'}, sexo ${ctx.sexo ?? '?'}, alergias: ${alergias}.\n\n` +
    (tramos.length > 1 ? `TRAMO ${i + 1} DE ${tramos.length} DE LA CONSULTA (la nota va completa; señala sólo lo que puedas juzgar con este tramo):\n` : 'TRANSCRIPCIÓN DE LA CONSULTA:\n') +
    `${delimitar(tramo)}\n\nNOTA GENERADA A REVISAR:\n${notaTexto}\n\nDevuelve solo el JSON de hallazgos.`

  /**
   * Por el gateway (§P–T): aquí vivía la misma cascada de modelos y el mismo
   * manejo de errores que repetían otras quince rutas — y, sobre todo, esta
   * llamada NO dejaba asiento en el libro de costos. Cablearlo ruta por ruta son
   * dieciséis oportunidades de olvidarlo; ahora el asiento es lo que pasa al
   * volver del `fetch`.
   */
  try {
    const porTramo: { severidad: string; tema: string; problema: string; sugerencia: string }[][] = []
    let usado = ''
    let ilegibles = 0

    for (let i = 0; i < tramos.length; i++) {
      const r = await llamarIA(
        { proveedor: 'openai', clave: key, modelos: MODELOS_OPENAI, system, user: mensajeDe(tramos[i], i), maxTokens: 2000, json: true },
        {
          feature: 'verificar-nota',
          requestId: req.headers.get('x-vercel-id') || `vn-${acceso.uid}-${Date.now()}-${i}`,
        correlacion: correlacionDe(req),
          clinicId: clinicId ?? null, uid: acceso.uid,
          creditos: COSTO_CREDITOS.verificarNota, fuente,
          esFundador: esFundador(acceso.email, process.env.SUPERADMIN_EMAILS),
        },
      )
      // Un tramo que no sale NO puede convertirse en «revisado sin hallazgos»:
      // se cuenta, y al final la respuesta lo dice.
      if (!r.ok) {
        if (i === 0) return NextResponse.json({ ok: false, error: r.motivo }, { status: 502 })
        ilegibles++
        continue
      }
      usado = r.modelo
      porTramo.push(hallazgosDe(r.texto, () => { ilegibles++ }))
    }

    if (porTramo.length === 0) {
      return NextResponse.json({ ok: false, incompleto: true, modelo: usado, hallazgos: [], error: 'La segunda opinión no devolvió un resultado analizable. La nota NO fue verificada; reintenta.' }, { status: 200 })
    }

    const hallazgos = unirHallazgos(porTramo)
    void registrarUso(clinicId, fuente)
    // Los créditos ya los cobró la cartera al confirmar la reserva (§AA–AF).
    // Dejar aquí el incremento de antes cobraría DOS VECES la misma nota.

    /**
     * SI NO SE CUBRIÓ TODO, SE DICE — con hallazgos y con el aviso.
     *
     * Enseñar los hallazgos de lo revisado es útil; presentarlos como una
     * revisión completa, no. Van los dos: la lista Y qué parte quedó fuera.
     */
    if (seg.truncado || ilegibles > 0) {
      const falta = seg.truncado
        ? `Sólo se revisaron los primeros ${seg.cubiertos.toLocaleString('es-MX')} de ${seg.total.toLocaleString('es-MX')} caracteres del dictado (${tramos.length} de ${seg.tramosNecesarios} tramos).`
        : `${ilegibles} ${ilegibles === 1 ? 'tramo no se pudo revisar' : 'tramos no se pudieron revisar'}.`
      return NextResponse.json({
        ok: false, incompleto: true, modelo: usado, hallazgos, tramos: tramos.length,
        error: `${falta} La nota NO quedó verificada del todo — revisa tú el resto.`,
      }, { status: 200 })
    }

    return NextResponse.json({ ok: true, modelo: usado, hallazgos, tramos: tramos.length })
  } catch (e) {
    return errorAlCliente()
  }
}

/**
 * Saca los hallazgos del texto del modelo. Sin JSON legible, avisa y devuelve
 * vacío — nunca «sin observaciones», que se lee como «revisado y limpio».
 */
function hallazgosDe(text: string, alFallar: () => void) {
  const m = text.match(/\{[\s\S]*\}/)
    /**
     * Auditoría 2026-07 (P1): si el modelo NO devolvió un JSON, antes se respondía
     * `hallazgos: []` = «sin observaciones», que el médico lee como «la nota está
     * revisada y limpia». Pero la revisión FALLÓ: no es lo mismo «revisado sin
     * hallazgos» que «no se pudo revisar». Se devuelve un estado incompleto.
     */
  if (!m) { alFallar(); return [] }
  try {
    const parsed = JSON.parse(m[0]) as { hallazgos?: unknown }
    const SEV = new Set(['alta', 'media', 'baja'])
    return (Array.isArray(parsed.hallazgos) ? parsed.hallazgos : [])
      .filter((h): h is Record<string, string> => !!h && typeof h === 'object')
      .map(h => ({
        severidad: SEV.has(String(h.severidad)) ? String(h.severidad) : 'media',
        tema: String(h.tema ?? '').slice(0, 120),
        problema: String(h.problema ?? '').slice(0, 400),
        sugerencia: String(h.sugerencia ?? '').slice(0, 400),
      }))
      .filter(h => h.problema)
  } catch { alFallar(); return [] }
}
