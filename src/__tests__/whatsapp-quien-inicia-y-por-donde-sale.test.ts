/**
 * ASM-009 · ASM-011 · N-025 · Panel de Lujo (AS-mensajería, N-negocio) — tres
 * huecos del envío de WhatsApp en `whatsapp-send.ts`:
 *
 * · ASM-009: la ventana de 24 h sólo la respetaba la puerta proactiva; cinco
 *   llamadores mandaban texto libre directo y se topaban con el rechazo del
 *   proveedor sin que nadie lo viera.
 * · ASM-011: el envío tiraba el id del mensaje (wamid): el acuse de entrega no
 *   se podía atar a la cita que lo mandó.
 * · N-025: el médico no podía saber por cuál de las tres vías (su número, el
 *   de la plataforma, ninguno) salía su mensaje, porque la cascada vivía sólo
 *   dentro de `sendWhatsApp`.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 * · `iniciadoPorElNegocio: true` mira la ventana ANTES de llamar al proveedor;
 *   cerrada → no manda, registra «ventana-cerrada» en no-entregados (lo enseña
 *   Entregas) y devuelve `ventanaCerrada`. Los llamadores directos están
 *   censados: la lista sólo baja (handoff a AGENDA para pasar el flag).
 * · `messageIdDeRespuesta` lee `messages[0].id`; todo envío `ok` lo devuelve.
 * · `viaDeEnvio` ES la cascada (la usa `sendWhatsApp`); la pantalla la
 *   informa con `describirViaDeEnvio` (PL-D8 por omisión: en prueba sale por
 *   la plataforma, y se dice).
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * Que los llamadores pasen el flag (AGENDA-MENSAJERIA, handoff). Guardar el
 * wamid en la cita (AGENDA). La pantalla de Configuración (UI-CONFIG).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const { estado } = vi.hoisted(() => ({ estado: { ultimoEntrante: null as string | null, noEntregados: [] as unknown[], fetches: 0 } }))
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: { collection: () => ({ doc: () => ({ get: async () => ({ data: () => ({ whatsapp: { provider: '360dialog', connected: true } }) }) }) }) },
}))
vi.mock('@/lib/whatsapp/consent', () => ({ estaDadoDeBaja: async () => false, conPieOptout: (s: string) => s, normalizarTelefonoWa: (s: string) => s.replace(/\D/g, '') }))
vi.mock('@/lib/whatsapp/secreto-canal', () => ({ conSecretoCanal: async (_c: string, w: unknown) => ({ ...(w as object), apiKey: 'llave-sintetica' }) }))
vi.mock('@/lib/whatsapp/contacts', () => ({ ultimoEntranteAt: async () => estado.ultimoEntrante }))
vi.mock('@/lib/whatsapp/no-entregados', () => ({ registrarNoEntregado: async (...a: unknown[]) => { estado.noEntregados.push(a) } }))
vi.mock('@/lib/fetch-con-timeout', () => ({
  TIMEOUT: { whatsapp: 1000 },
  fetchConTimeout: async () => { estado.fetches++; return new Response(JSON.stringify({ messages: [{ id: 'wamid.SINTETICO.1' }] }), { status: 200 }) },
}))

import { sendWhatsApp, viaDeEnvio, describirViaDeEnvio, messageIdDeRespuesta } from '@/lib/whatsapp-send'

describe('ASM-011 · el id del mensaje del proveedor se conserva', () => {
  it('messageIdDeRespuesta lee messages[0].id y tolera lo demás', () => {
    expect(messageIdDeRespuesta({ messages: [{ id: 'wamid.X' }] })).toBe('wamid.X')
    expect(messageIdDeRespuesta({ messages: [] })).toBeUndefined()
    expect(messageIdDeRespuesta({})).toBeUndefined()
    expect(messageIdDeRespuesta(null)).toBeUndefined()
    expect(messageIdDeRespuesta({ messages: [{ id: 7 }] })).toBeUndefined()
  })

  it('un envío ok devuelve messageId', async () => {
    estado.fetches = 0
    const r = await sendWhatsApp('c1', '5215500000000', 'hola')
    expect(r.ok).toBe(true)
    expect(r.messageId).toBe('wamid.SINTETICO.1')
    expect(estado.fetches).toBe(1)
  })
})

describe('ASM-009 · lo que inicia el negocio respeta la ventana de 24 h', () => {
  beforeEach(() => { estado.noEntregados = []; estado.fetches = 0; estado.ultimoEntrante = null })

  it('ventana cerrada → no llama al proveedor, registra «ventana-cerrada» y lo dice', async () => {
    const r = await sendWhatsApp('c1', '5215500000000', 'Su cita quedó confirmada', { iniciadoPorElNegocio: true, origen: 'booking' })
    expect(r.ok).toBe(false)
    expect(r.ventanaCerrada).toBe(true)
    expect(estado.fetches).toBe(0)
    expect(estado.noEntregados).toHaveLength(1)
    expect(estado.noEntregados[0]).toEqual(['c1', '5215500000000', 'Su cita quedó confirmada', 'booking', 'ventana-cerrada'])
    expect(r.error).toMatch(/plantilla/)
  })

  it('ventana abierta → sale como siempre', async () => {
    estado.ultimoEntrante = new Date(Date.now() - 60_000).toISOString()
    const r = await sendWhatsApp('c1', '5215500000000', 'hola', { iniciadoPorElNegocio: true })
    expect(r.ok).toBe(true)
    expect(estado.fetches).toBe(1)
  })

  it('la respuesta REACTIVA del bot (sin flag) no mira la ventana', async () => {
    const r = await sendWhatsApp('c1', '5215500000000', 'hola')
    expect(r.ok).toBe(true)
    expect(estado.noEntregados).toHaveLength(0)
  })

  it('CENSO de llamadores directos que aún no declaran quién inicia — sólo puede bajar', () => {
    const raiz = process.cwd()
    const archivos = (dir: string): string[] => readdirSync(dir).flatMap(n => {
      const p = join(dir, n)
      return statSync(p).isDirectory() ? (n === '__tests__' ? [] : archivos(p)) : (/\.tsx?$/.test(n) ? [p] : [])
    })
    const directos = new Set<string>()
    for (const f of [...archivos(join(raiz, 'src/app')), ...archivos(join(raiz, 'src/lib'))]) {
      if (f.endsWith('whatsapp-send.ts')) continue
      const src = readFileSync(f, 'utf8')
      // Los dos caminos de importación. Mirar sólo el estático dejaba fuera a
      // `public/booking` y a `avisar-consultorio`, que cargan el módulo con un
      // `await import(...)` dentro de la función: dos llamadores REALES que el
      // censo daba por inexistentes. Un guardián que no los ve pasa por vacío.
      if (!/(from|import\()\s*'@\/lib\/whatsapp-send'/.test(src)) continue
      for (const l of src.split('\n')) {
        if (/^\s*(\/\/|\*)/.test(l)) continue
        if (/\bsendWhatsApp\(/.test(l) && !/proactivo: true|iniciadoPorElNegocio/.test(l)) directos.add(relative(raiz, f).split('\\').join('/'))
      }
    }
    // El `send` reactivo del bot es legítimo; los demás son el trinquete (handoff AGENDA-MENSAJERIA).
    const PERMITIDOS = new Set(['src/app/api/whatsapp/webhook/route.ts'])
    // Bajó de 4 a 3 el 2026-09-06: `cron/reminders` ya declara quién inicia
    // (AGENDA-MENSAJERIA). Esta lista sólo se vacía; nunca se rellena.
    const PENDIENTES = new Set([
      'src/app/api/public/booking/route.ts',
      'src/app/api/hospital/alerta/route.ts',
      'src/lib/whatsapp/avisar-consultorio.ts',
    ])
    const nuevos = [...directos].filter(f => !PERMITIDOS.has(f) && !PENDIENTES.has(f))
    expect(nuevos, `llamadores nuevos de sendWhatsApp sin declarar quién inicia: ${nuevos.join(', ')}`).toEqual([])
    const yaMigrados = [...PENDIENTES].filter(f => !directos.has(f))
    expect(yaMigrados, `quitar de PENDIENTES (ya declaran quién inicia): ${yaMigrados.join(', ')}`).toEqual([])
  })
})

describe('N-025 · por cuál vía sale el mensaje, con la misma cascada del envío', () => {
  const env = (o: Record<string, string | undefined>) => o as NodeJS.ProcessEnv

  it('número propio conectado gana; sin él, la plataforma; sin nada, ninguna', () => {
    expect(viaDeEnvio({ provider: '360dialog', connected: true, apiKey: 'k' } as never, env({}))).toEqual({ via: 'clinica', proveedor: '360dialog' })
    expect(viaDeEnvio({ provider: 'meta', connected: true, apiKey: 'k', phoneNumberId: '1' } as never, env({}))).toEqual({ via: 'clinica', proveedor: 'meta' })
    expect(viaDeEnvio({ provider: 'meta', connected: false } as never, env({ WHATSAPP_API_TOKEN: 't', WHATSAPP_PHONE_NUMBER_ID: '1' }))).toEqual({ via: 'plataforma', proveedor: 'meta' })
    expect(viaDeEnvio(undefined, env({ WHATSAPP_PROVIDER: 'twilio', TWILIO_ACCOUNT_SID: 's', TWILIO_AUTH_TOKEN: 'a', TWILIO_WHATSAPP_FROM: 'f' }))).toEqual({ via: 'plataforma', proveedor: 'twilio' })
    expect(viaDeEnvio(undefined, env({}))).toEqual({ via: 'ninguna', proveedor: null })
  })

  it('el texto de pantalla dice de dónde sale, sin deducirlo aparte', () => {
    expect(describirViaDeEnvio({ via: 'plataforma', proveedor: 'meta' })).toMatch(/número de Ausculta/)
    expect(describirViaDeEnvio({ via: 'clinica', proveedor: 'meta' })).toMatch(/tu propio número/)
    expect(describirViaDeEnvio({ via: 'ninguna', proveedor: null })).toMatch(/ningún número/)
  })

  it('sendWhatsApp usa viaDeEnvio (no una segunda cascada)', () => {
    const src = readFileSync(join(process.cwd(), 'src/lib/whatsapp-send.ts'), 'utf8')
    const cuerpo = src.slice(src.indexOf('export async function sendWhatsApp('), src.indexOf('// ── Plantillas HSM'))
    expect(cuerpo).toContain('const via = viaDeEnvio(waConfig)')
    expect(cuerpo).not.toMatch(/process\.env\.WHATSAPP_PROVIDER/)
  })
})
