/**
 * POST /api/expediente/laboratorio-vision
 *
 * PDF o foto de un reporte de laboratorio → valores estructurados y validados,
 * listos para graficar en el tiempo. La IA solo TRANSCRIBE (foso del antibiograma);
 * el motor determinista valida, agrupa por analito y marca criticidad.
 *
 * PRIVACIDAD: el prompt prohíbe devolver identificadores del paciente SALVO su
 * nombre, y `validarPanel` descarta todo lo demás. El nombre viaja en
 * `panel.sujetos` porque sin él no hay forma de verificar de QUIÉN es la hoja, y
 * el panel acababa archivado bajo el paciente que estuviera abierto en la
 * pantalla (REG-323). Es TRANSITORIO: el cliente lo compara contra el paciente
 * de destino y no lo persiste. Esta ruta no escribe nada, ni siquiera un log:
 * `safeLog` nunca ve el nombre.
 *
 * Body:   { archivo: dataURL (image/* o application/pdf) }
 * Output: { ok, panel: PanelValidado, model } | { ok:false, error }
 */
import { anotarLlamada } from '@/lib/ia/gateway'
import { esFundador } from '@/lib/authz/fundador'
import { NextRequest, NextResponse } from 'next/server'
import { errorAlCliente } from '@/lib/security/error-al-cliente'
import { verificarModuloIA } from '@/lib/auth-server'
import { limitarOResponder } from '@/lib/rate-limit'
import { gateCreditos, resolverClaveIA, registrarCreditos } from '@/lib/ai-keys'
import { COSTO_CREDITOS } from '@/lib/planes-ia'
import { safeLog } from '@/lib/security/sanitize'
import { claseDeFallo, quienPaga, avisoAlMedico } from '@/lib/ia/fallo-proveedor'
import { reportarFalloIA } from '@/lib/ia/incidentes-servidor'
import { LAB_VISION_SYSTEM, buildLabVisionPrompt } from '@/lib/expediente/laboratorio/vision'
import { validarPanel, type FilaCruda } from '@/lib/expediente/laboratorio/extraccion'
import { correlacionDe } from '@/lib/observabilidad/correlacion'

const ENV_ANTHROPIC = process.env.ANTHROPIC_API_KEY ?? ''
const ANTHROPIC_VERSION = '2023-06-01'
const MODELOS_VISION = ['claude-sonnet-4-5', 'claude-sonnet-4-5-20250929']
let modeloCache = ''

async function resolverModelo(key: string): Promise<string> {
  if (process.env.ANTHROPIC_MODEL_VISION) return process.env.ANTHROPIC_MODEL_VISION
  if (modeloCache) return modeloCache
  try {
    const res = await fetch('https://api.anthropic.com/v1/models?limit=100', {
      headers: { 'x-api-key': key, 'anthropic-version': ANTHROPIC_VERSION }, signal: AbortSignal.timeout(8000),
    })
    if (res.ok) {
      const data = await res.json()
      const ids: string[] = (data.data ?? []).map((m: { id: string }) => m.id)
      const elegido = MODELOS_VISION.find(c => ids.includes(c)) ?? ids.find(id => id.includes('sonnet')) ?? ids[0]
      if (elegido) { modeloCache = elegido; return elegido }
    }
  } catch { /* fallback */ }
  return MODELOS_VISION[0]
}

/** Separa un data URL. Distingue imagen de PDF (Claude los recibe distinto). */
function parseArchivo(s: string): { tipo: 'image' | 'pdf'; media_type: string; data: string } | null {
  if (!s) return null
  const img = s.match(/^data:(image\/(?:png|jpe?g|webp|gif));base64,(.+)$/i)
  if (img) return { tipo: 'image', media_type: img[1].toLowerCase().replace('image/jpg', 'image/jpeg'), data: img[2] }
  const pdf = s.match(/^data:application\/pdf;base64,(.+)$/i)
  if (pdf) return { tipo: 'pdf', media_type: 'application/pdf', data: pdf[1] }
  return null
}

function parseJSON(text: string): Record<string, unknown> | null {
  let t = text.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) t = fence[1].trim()
  const first = t.indexOf('{'); const last = t.lastIndexOf('}')
  if (first === -1 || last === -1) return null
  const slice = t.slice(first, last + 1)
  try { return JSON.parse(slice) } catch { /* */ }
  try { return JSON.parse(slice.replace(/,(\s*[}\]])/g, '$1')) } catch { return null }
}

export async function POST(req: NextRequest) {
  const acceso = await verificarModuloIA(req, 'expediente')
  if (!acceso.ok) return acceso.response
  const _rl = await limitarOResponder(`laboratorio-vision:${acceso.uid}`, 20, 60)
  if (_rl) return _rl

  const { key: API_KEY, clinicId, fuente } = await resolverClaveIA(acceso.uid, 'anthropic', ENV_ANTHROPIC)
  const _corte = await gateCreditos(clinicId, fuente); if (_corte) return _corte
  if (!API_KEY) return NextResponse.json({ ok: false, error: 'No hay API key de Claude configurada. Agrégala en Configuración → Llaves de IA.' }, { status: 503 })

  let body: { archivo?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }

  const arch = parseArchivo(body.archivo ?? '')
  if (!arch) return NextResponse.json({ ok: false, error: 'Falta un archivo válido: imagen (PNG/JPEG/WebP) o PDF en base64.' }, { status: 400 })
  if (arch.data.length > 10_000_000) return NextResponse.json({ ok: false, error: 'Archivo demasiado grande (>7.5MB). Reduce la resolución o divide el PDF.' }, { status: 400 })

  /**
   * Contexto del libro de costos. Esta ruta todavía no pasa por el gateway; se
   * anota el gasto igual, porque una llamada sin asiento no se ve como un error
   * sino como una plataforma que gasta menos de lo que gasta.
   */
  const ctxCosto = {
    feature: 'laboratorio-vision',
    requestId: req.headers.get('x-vercel-id') || `lv-${acceso.uid}-${Date.now()}`,
        correlacion: correlacionDe(req),
    clinicId: clinicId ?? null, uid: acceso.uid, creditos: 0, fuente,
    esFundador: esFundador(acceso.email, process.env.SUPERADMIN_EMAILS),
  }
  const t0Costo = Date.now()

  try {
    const model = await resolverModelo(API_KEY)
    const contenido = arch.tipo === 'pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: arch.data } }
      : { type: 'image', source: { type: 'base64', media_type: arch.media_type, data: arch.data } }
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': API_KEY, 'anthropic-version': ANTHROPIC_VERSION, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, max_tokens: 4000, system: LAB_VISION_SYSTEM,
        messages: [{ role: 'user', content: [contenido, { type: 'text', text: buildLabVisionPrompt() }] }],
      }),
      signal: AbortSignal.timeout(60000),
    })
    if (!res.ok) {
      const err = await res.text()
      safeLog.error('[laboratorio-vision] Claude error:', res.status, err.slice(0, 300))
      const quien = quienPaga(fuente)
      const clase = claseDeFallo(res.status, err)
      reportarFalloIA({ clase, quien, proveedor: 'anthropic', feature: 'laboratorio-vision', status: res.status })
      return NextResponse.json({ ok: false, error: avisoAlMedico(clase, quien, 'anthropic').texto }, { status: 502 })
    }
    const data = await res.json()
    anotarLlamada(ctxCosto, 'anthropic', String(data?.model ?? ''), data, Date.now() - t0Costo)
    const text: string = data.content?.[0]?.text ?? ''
    const parsed = parseJSON(text)
    if (!parsed) return NextResponse.json({ ok: false, error: 'La IA no devolvió resultados legibles. Reintenta con un archivo más nítido.' }, { status: 502 })

    // Validación DETERMINISTA: aquí se descarta cualquier identificador y se
    // marca criticidad con el motor, sin confiar en la IA.
    const panel = validarPanel({
      fecha: String(parsed.fecha ?? ''),
      filas: (parsed.filas ?? []) as FilaCruda[],
      // A quién dice pertenecer la hoja. Se sanea en `sujetosLeidos`; aquí se
      // pasa crudo a propósito para no duplicar ese criterio en dos sitios.
      pacientes: parsed.pacientes,
    })
    if (panel.resultados.length === 0 && panel.noReconocidas.length === 0) {
      return NextResponse.json({ ok: false, error: 'No se reconocieron valores de laboratorio en el documento.' }, { status: 422 })
    }
    void registrarCreditos(clinicId, COSTO_CREDITOS.laboratorioVision)
    return NextResponse.json({ ok: true, panel, model })
  } catch (err) {
    safeLog.error('[laboratorio-vision] Exception:', err)
    return errorAlCliente('No se pudo procesar el archivo. Intenta con otra foto o un PDF.')
  }
}
