/**
 * Intercepciones del navegador para grabar la consulta sin proveedores externos.
 *
 * Se interceptan SÓLO tres fronteras que en esta máquina no existen:
 *   1. AssemblyAI (voz a texto con separación de voces) → utterances sintéticas del diálogo.
 *   2. Anthropic / OpenAI (nota, roles, verificación, entidades) → `nota-sintetica.mjs`.
 *   3. Firebase Storage (el audio de la consulta se guarda ahí para «escuchar el
 *      momento») → se acepta la subida y se sirve el mismo audio del diálogo.
 *      El arnés conecta Auth y Firestore al emulador, pero no Storage: sin esto,
 *      la subida al bucket real reintenta durante minutos y la nota nunca llega.
 *
 * Todo lo demás pasa de verdad por `next dev` y los emuladores.
 */
import fs from 'node:fs'
import { utterancesDesde, textoDesde, textoDelTrozo, ROLES, NOTA, VERIFICACION, ENTIDADES } from './nota-sintetica.mjs'

const dormir = ms => new Promise(r => setTimeout(r, ms))

export function mocksConsulta({ turnos, micWav, registro = () => {} }) {
  const utterances = utterancesDesde(turnos)
  const texto = textoDesde(turnos)
  let polls = 0
  let trozos = 0
  return async ctx => {
    await ctx.route('**/api/expediente/transcribir-chunk', async route => {
      const idx = trozos++
      registro('transcribir-chunk', idx)
      await dormir(900)
      await route.fulfill({ json: { ok: true, text: textoDelTrozo(turnos, idx), chunkIdx: idx } })
    })
    await ctx.route('**/api/expediente/transcribir-diarizado*', async route => {
      if (route.request().method() === 'POST') { registro('diarizado POST'); await dormir(700); return route.fulfill({ json: { ok: true, id: 'demo-video-transcript' } }) }
      polls++
      registro('diarizado GET', polls)
      if (polls <= 1) return route.fulfill({ json: { ok: true, status: 'processing' } })
      return route.fulfill({ json: { ok: true, status: 'completed', text: texto, utterances } })
    })
    await ctx.route('**/api/expediente/transcribir', route => route.fulfill({ json: { ok: true, text: texto, language: 'es', model: 'demo' } }))
    await ctx.route('**/api/expediente/atribuir-roles', async route => { registro('atribuir-roles'); await dormir(1200); await route.fulfill({ json: ROLES }) })
    await ctx.route('**/api/expediente/procesar', async route => {
      let rapido = false
      try { rapido = !!JSON.parse(route.request().postData() ?? '{}').rapido } catch { /* sin cuerpo */ }
      registro('procesar', rapido ? 'rapido' : 'completo')
      if (rapido) {
        // Borrador en vivo / preliminar (modelo rápido): sólo lo subjetivo, como haría un primer pase.
        await dormir(1800)
        return route.fulfill({ json: { ...NOTA, secciones: { subjetivo: NOTA.secciones.subjetivo, objetivo: '', evaluacion: '', plan: '' }, diagnosticos: [], medicamentos: [], alergias: [], extraction: {}, _motor: 'rapido', _modelo: 'claude-haiku-4-5', _modelosNota: undefined, _citasFusion: undefined } })
      }
      await dormir(4200)
      await route.fulfill({ json: NOTA })
    })
    await ctx.route('**/api/expediente/verificar-nota', async route => { registro('verificar-nota'); await dormir(2500); await route.fulfill({ json: VERIFICACION }) })
    await ctx.route('**/api/expediente/extraer-entidades', route => route.fulfill({ json: ENTIDADES }))

    // Firebase Storage: subida del audio y su descarga para «escuchar el momento».
    const wav = fs.readFileSync(micWav)
    await ctx.route('**/firebasestorage.googleapis.com/**', async route => {
      const url = new URL(route.request().url())
      const metodo = route.request().method()
      registro('storage', metodo, url.pathname.slice(0, 60))
      if (metodo === 'OPTIONS') return route.fulfill({ status: 204, headers: cors() })
      const nombre = url.searchParams.get('name') || decodeURIComponent(url.pathname.split('/o/')[1] ?? 'consultas-audio/demo.webm')
      if (url.searchParams.get('alt') === 'media') {
        return route.fulfill({ status: 200, headers: { ...cors(), 'content-type': 'audio/wav', 'accept-ranges': 'bytes' }, body: wav })
      }
      const meta = {
        name: nombre, bucket: url.pathname.split('/b/')[1]?.split('/')[0] ?? 'demo', generation: '1', metageneration: '1',
        contentType: metodo === 'POST' ? 'audio/webm' : 'audio/wav', size: String(wav.length),
        timeCreated: new Date().toISOString(), updated: new Date().toISOString(), downloadTokens: 'demo-video-token',
      }
      return route.fulfill({ status: 200, headers: { ...cors(), 'content-type': 'application/json' }, json: meta })
    })
  }
}

function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'access-control-allow-headers': '*',
    'access-control-expose-headers': '*',
  }
}
