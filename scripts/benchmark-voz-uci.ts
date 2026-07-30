/**
 * EJECUTOR DEL BENCHMARK DE VOZ — corpus de 498 audios del Dr. (2026-07-30).
 *
 * Corre el STT **REAL de la aplicación** sobre cada MP3 y evalúa contra
 * `MANIFEST_498.csv` con las seis métricas que pidió.
 *
 * ── QUÉ SIGNIFICA «EL STT REAL» ──────────────────────────────────────────────
 *
 * No es una llamada cruda a OpenAI. Se reproduce exactamente lo que hace
 * `/api/expediente/transcribir`:
 *   · mismo modelo y su cascada (`gpt-4o-transcribe` → mini → whisper-1),
 *   · `language: es`, `temperature: 0`,
 *   · el MISMO `WHISPER_PROMPT_MEDICO`,
 *   · y después el corrector `corregirTranscripcion()`.
 *
 * Medir sin el corrector daría un número que no es el que ve el médico.
 *
 * ── NO TOCA NADA ─────────────────────────────────────────────────────────────
 *
 * Lee los MP3, no los modifica, no escribe en el corpus y no manda nada a
 * Firestore. El único efecto es el informe en `docs/maintenance/`.
 *
 *   npx tsx scripts/benchmark-voz-uci.ts [--limite N] [--sin-corrector]
 */
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

/**
 * La llave se lee del entorno o de `.env.local` (gitignorado).
 *
 * NO se pide por consola ni se escribe a ningún sitio: el médico la pone una vez
 * en su `.env.local` y este script sólo la lee. `vercel env pull` NO sirve —
 * Vercel devuelve `[SENSITIVE]` en las variables cifradas, que es lo correcto.
 */
function cargarEnvLocal() {
  const p = join(process.cwd(), '.env.local')
  if (!existsSync(p)) return
  for (const linea of readFileSync(p, 'utf8').split('\n')) {
    const m = linea.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}
cargarEnvLocal()
import { WHISPER_PROMPT_MEDICO, corregirTranscripcion } from '../src/lib/expediente/medical-vocabulary'
import { evaluarAudio, metricas, porCorte, rankingRiesgo, type ResultadoAudio } from '../src/lib/uci/benchmark-metricas'

const CORPUS = '/Users/davidrdz/Desktop/AUDIO/NexusMED_UCI_498_AUDIOS_GENERADOR_MAC'
const MODELOS = ['gpt-4o-transcribe', 'gpt-4o-mini-transcribe', 'whisper-1']
const CONCURRENCIA = 6

const args = process.argv.slice(2)
const LIMITE = args.includes('--limite') ? Number(args[args.indexOf('--limite') + 1]) : Infinity
const SIN_CORRECTOR = args.includes('--sin-corrector')
/**
 * `--simular` evalúa usando el propio `canonical_text` como transcripción.
 *
 * No mide nada del reconocedor: comprueba que la TUBERÍA de evaluación funciona
 * —lectura del CSV, canonización, métricas— antes de gastar 498 llamadas. Si en
 * modo simulado el recall no sale ~100 %, el fallo es mío, no del transcriptor.
 */
const SIMULAR = args.includes('--simular')

interface Fila {
  id: string; category: string; canonical_text: string
  key_terms: string; voice: string; style: string; output_file: string
}

/** CSV con comillas: el `canonical_text` lleva comas dentro. */
function leerCsv(ruta: string): Fila[] {
  const texto = readFileSync(ruta, 'utf8').trim()
  const lineas = texto.split('\n')
  const cabecera = lineas[0].split(',')
  return lineas.slice(1).map(l => {
    const campos: string[] = []
    let actual = '', enComillas = false
    for (let i = 0; i < l.length; i++) {
      const c = l[i]
      if (c === '"') { enComillas = !enComillas; continue }
      if (c === ',' && !enComillas) { campos.push(actual); actual = ''; continue }
      actual += c
    }
    campos.push(actual)
    const o: Record<string, string> = {}
    cabecera.forEach((k, i) => { o[k.trim()] = (campos[i] ?? '').trim() })
    return o as unknown as Fila
  })
}

async function transcribir(ruta: string, apiKey: string): Promise<string> {
  const audio = readFileSync(ruta)
  let ultimoError = ''
  for (const model of MODELOS) {
    for (let intento = 0; intento < 3; intento++) {
      try {
        const fd = new FormData()
        fd.append('file', new Blob([audio], { type: 'audio/mpeg' }), 'audio.mp3')
        fd.append('model', model)
        fd.append('language', 'es')
        fd.append('temperature', '0')
        fd.append('prompt', WHISPER_PROMPT_MEDICO)
        const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: fd,
        })
        if (res.ok) {
          const j = await res.json() as { text?: string }
          const crudo = (j.text ?? '').trim()
          /**
           * El corrector devuelve `{ corregido, cambios }`, NO `{ texto }`.
           *
           * Leí mal el nombre del campo y el runner devolvía `undefined` en las
           * 498: el informe decía «audios sin transcripción» cuando el STT había
           * respondido HTTP 200 con el texto correcto. Un fallo mío disfrazado
           * de fallo del transcriptor — exactamente lo que este arnés existe
           * para no hacer.
           */
          return SIN_CORRECTOR ? crudo : corregirTranscripcion(crudo).corregido
        }
        if (res.status === 401) throw new Error('LLAVE_INVALIDA')
        if (res.status === 429 || res.status >= 500) {
          await new Promise(r => setTimeout(r, 1500 * (intento + 1)))
          continue
        }
        ultimoError = `${model} ${res.status}`
        break
      } catch (e) {
        if (e instanceof Error && e.message === 'LLAVE_INVALIDA') throw e
        ultimoError = String(e)
        await new Promise(r => setTimeout(r, 1000))
      }
    }
  }
  throw new Error(`Sin transcripción: ${ultimoError}`)
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY ?? ''
  if (!apiKey && !SIMULAR) {
    console.error('Falta OPENAI_API_KEY. Ponla en .env.local o expórtala en la terminal.')
    process.exit(1)
  }

  const filas = leerCsv(join(CORPUS, 'MANIFEST_498.csv'))
    .filter(f => existsSync(join(CORPUS, f.output_file)))
    .slice(0, LIMITE)

  console.log(`Corpus: ${filas.length} audios · corrector: ${SIN_CORRECTOR ? 'NO' : 'sí'}`)

  const resultados: ResultadoAudio[] = []
  const fallos: { id: string; error: string }[] = []
  let hechos = 0

  const cola = [...filas]
  await Promise.all(Array.from({ length: CONCURRENCIA }, async () => {
    for (;;) {
      const f = cola.shift()
      if (!f) return
      try {
        const t = SIMULAR ? f.canonical_text : await transcribir(join(CORPUS, f.output_file), apiKey)
        resultados.push(evaluarAudio(f, t))
      } catch (e) {
        fallos.push({ id: f.id, error: String(e) })
      }
      if (++hechos % 25 === 0) console.log(`  ${hechos}/${filas.length}`)
    }
  }))

  const m = metricas(resultados)
  const pct = (x: number | null) => (x === null ? '—' : `${(x * 100).toFixed(1)} %`)

  const salida = {
    fecha: new Date().toISOString(),
    corpus: 'NexusMED_UCI_498',
    audiosEvaluados: resultados.length,
    fallosDeTranscripcion: fallos,
    corrector: !SIN_CORRECTOR,
    modelos: MODELOS,
    global: m,
    porCategoria: porCorte(resultados, 'category'),
    porVoz: porCorte(resultados, 'voice'),
    porEstilo: porCorte(resultados, 'style'),
    rankingRiesgo: rankingRiesgo(resultados),
    // Los 40 peores audios, para poder oírlos.
    peores: [...resultados].sort((a, b) => b.erroresCriticos.length - a.erroresCriticos.length || b.wer - a.wer)
      .slice(0, 40)
      .map(r => ({ id: r.id, wer: Number(r.wer.toFixed(3)), criticos: r.erroresCriticos,
        esperado: r.canonical, obtenido: r.transcripcion })),
  }

  const destino = join(process.cwd(), 'docs/maintenance',
    `benchmark-voz-uci-498${SIMULAR ? '-SIMULADO' : ''}${SIN_CORRECTOR ? '-sin-corrector' : ''}.json`)
  writeFileSync(destino, JSON.stringify(salida, null, 2))

  console.log(`\n══ GLOBAL (${resultados.length} audios) ══`)
  console.log(`  WER                            ${pct(m.wer)}`)
  console.log(`  Clinical Term Recall           ${pct(m.clinicalTermRecall)}`)
  console.log(`  Acronym Recall                 ${pct(m.acronymRecall)}`)
  console.log(`  Number Accuracy                ${pct(m.numberAccuracy)}`)
  console.log(`  Unit Accuracy                  ${pct(m.unitAccuracy)}`)
  console.log(`  Critical Semantic Error Rate   ${pct(m.criticalSemanticErrorRate)}`)
  if (fallos.length) console.log(`  (${fallos.length} audios sin transcripción)`)
  console.log(`\nInforme: ${destino}`)
}

main().catch(e => { console.error(e); process.exit(1) })
