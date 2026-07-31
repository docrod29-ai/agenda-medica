/**
 * BENCHMARK DE VOZ CON AUDIO REAL — la medición que el corpus existe para dar.
 *
 * La regresión de texto (`asr-regresion-texto.ts`) comprueba que el pipeline no
 * DAÑE una frase que ya es correcta. Eso es necesario y no es suficiente: no
 * dice nada de si el reconocedor OYE bien. Para eso hay que gastar audio.
 *
 * ── LO QUE MIDE ──────────────────────────────────────────────────────────────
 *
 * Las métricas que pide `PARA_CLAUDE.md`, y por separado:
 *
 *   · WER — cuánto texto se pierde en general.
 *   · Clinical Term Recall — cuántos `key_terms` sobreviven. **Es la que manda.**
 *     Un WER del 8 % con la dosis intacta es un buen resultado; un WER del 2 %
 *     con «mcg» convertido en «mg» es un desastre que el WER no ve, porque en un
 *     texto de doce palabras esa palabra pesa lo mismo que un artículo.
 *   · Errores CRÍTICOS — los pares prohibidos del documento (mg↔mcg, PEEP↔PIP,
 *     ECMO VV↔VA, CVVH↔CVVHD↔CVVHDF, negación, lateralidad). Se cuentan aparte
 *     porque no son «un error más»: son los que cambian lo que se le hace al
 *     enfermo.
 *
 * ── POR QUÉ COMPARA DOS VECES ────────────────────────────────────────────────
 *
 * Mide el reconocedor CRUDO y el pipeline COMPLETO sobre el mismo audio. Sin las
 * dos cifras no se puede saber si el pipeline ayuda: podría estar arreglando
 * diez cosas y rompiendo once, y una sola columna lo enseñaría como una mejora.
 *
 * Uso:
 *   OPENAI_API_KEY=... npx tsx scripts/asr-benchmark-audio.ts <carpeta del corpus> [muestra]
 *
 * Coste orientativo: ~6 000 audios de unos 7 s son ~700 min. Con `whisper-1`
 * (0.006 USD/min) rondan los 4 USD. Empieza con una muestra.
 */
import { readFileSync, existsSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { procesarTranscript } from '../src/lib/asr/pipeline'
import { terminoPresente, evaluable } from '../src/lib/uci/benchmark-metricas'
import { PARES_PROHIBIDOS } from '../src/lib/asr/politica-critica'

const CARPETA = process.argv[2]
const MUESTRA = Number(process.argv[3] || '0')
const MODELO = process.env.ASR_MODELO || 'whisper-1'

if (!CARPETA || !existsSync(CARPETA)) {
  console.error('Uso: npx tsx scripts/asr-benchmark-audio.ts <carpeta del corpus> [muestra]')
  process.exit(1)
}
if (!process.env.OPENAI_API_KEY) {
  console.error('Falta OPENAI_API_KEY. No la escribas en el comando: expórtala en la sesión.')
  process.exit(1)
}

interface Fila {
  phrase_id: string; category: string; canonical_text: string; tts_text: string; key_terms: string
}

/** Lee el CSV del corpus respetando las comillas. */
function leerCsv(ruta: string): Fila[] {
  const texto = readFileSync(ruta, 'utf8')
  const filas: string[][] = []
  let campo = '', fila: string[] = [], enComillas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (enComillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++ }
      else if (c === '"') enComillas = false
      else campo += c
    } else if (c === '"') enComillas = true
    else if (c === ',') { fila.push(campo); campo = '' }
    else if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = '' }
    else if (c !== '\r') campo += c
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila) }
  const cab = filas.shift()!
  return filas.filter(f => f.length === cab.length)
    .map(f => Object.fromEntries(cab.map((k, i) => [k, f[i]])) as unknown as Fila)
}

/** Distancia de edición por palabras. */
function wer(ref: string, hip: string): number {
  const a = ref.toLowerCase().replace(/[.,;:¡!¿?]/g, '').split(/\s+/).filter(Boolean)
  const b = hip.toLowerCase().replace(/[.,;:¡!¿?]/g, '').split(/\s+/).filter(Boolean)
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 0; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = a[i - 1] === b[j - 1] ? d[i - 1][j - 1]
        : 1 + Math.min(d[i - 1][j], d[i][j - 1], d[i - 1][j - 1])
  return a.length === 0 ? 0 : d[a.length][b.length] / a.length
}

/**
 * Cuenta apariciones de un término.
 *
 * Los límites de palabra sólo se ponen del lado que empieza o acaba en letra o
 * dígito: los pares del documento incluyen «/h» y «/min», y exigirles un límite
 * por delante haría que no casaran nunca — el par más peligroso de todos (un
 * factor de sesenta en la velocidad de infusión) quedaría sin vigilar.
 */
const cuenta = (texto: string, termino: string): number => {
  const crudo = termino.toLowerCase()
  const t = crudo.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
  const ini = /^[a-z0-9]/.test(crudo) ? '(?:^|[^a-z0-9])' : ''
  const fin = /[a-z0-9]$/.test(crudo) ? '(?=$|[^a-z0-9])' : ''
  return (texto.toLowerCase().match(new RegExp(`${ini}${t}${fin}`, 'g')) ?? []).length
}

/**
 * ¿La transcripción cambió un miembro de un par prohibido por el otro?
 *
 * Se compara CONTANDO, no mirando si están presentes: en «PEEP 12, PIP 30» los
 * dos aparecen antes y después, y una sustitución de PEEP por PIP dejaría los
 * dos «presentes» con el sentido cambiado.
 */
function erroresCriticos(ref: string, hip: string): string[] {
  const malos: string[] = []
  for (const par of PARES_PROHIBIDOS) {
    const ra = cuenta(ref, par.a), rb = cuenta(ref, par.b)
    const ha = cuenta(hip, par.a), hb = cuenta(hip, par.b)
    if ((ra > 0 || rb > 0) && (ra !== ha || rb !== hb)) malos.push(`${par.a}↔${par.b}`)
  }
  return malos
}

async function transcribir(ruta: string): Promise<string> {
  const datos = new FormData()
  datos.append('file', new Blob([readFileSync(ruta)]), ruta.split('/').pop()!)
  datos.append('model', MODELO)
  datos.append('language', 'es')
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: datos,
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return ((await r.json()) as { text?: string }).text ?? ''
}

/** Busca el mp3 del corpus por su phrase_id, sin depender de la categoría. */
function indiceAudios(raiz: string): Map<string, string> {
  const m = new Map<string, string>()
  const base = join(raiz, 'AUDIOS')
  if (!existsSync(base)) return m
  for (const cat of readdirSync(base)) {
    const dir = join(base, cat)
    let hijos: string[] = []
    try { hijos = readdirSync(dir) } catch { continue }
    for (const f of hijos) if (f.endsWith('.mp3')) m.set(f.split('__')[0], join(dir, f))
  }
  return m
}

async function main() {
  const filas = leerCsv(join(CARPETA, 'MASTER_6000_FRASES_UNICAS.csv'))
  const audios = indiceAudios(CARPETA)
  let lista = filas.filter(f => audios.has(f.phrase_id))
  if (MUESTRA > 0) {
    // Muestreo REGULAR, no los primeros N: el CSV va agrupado por categoría y
    // los primeros mil son todos aminas — una muestra así mediría una sola cosa.
    const paso = Math.max(1, Math.floor(lista.length / MUESTRA))
    lista = lista.filter((_, i) => i % paso === 0).slice(0, MUESTRA)
  }
  console.log(`\n  ${lista.length} audios · modelo ${MODELO}\n`)

  let nCrudo = 0, nPipe = 0, sumaWerCrudo = 0, sumaWerPipe = 0
  let termsTotal = 0, termsCrudo = 0, termsPipe = 0
  const criticosCrudo: string[] = [], criticosPipe: string[] = []
  const fallos: { id: string; ref: string; crudo: string; pipe: string; motivo: string }[] = []
  let errores = 0

  for (let i = 0; i < lista.length; i++) {
    const f = lista[i]
    let crudo: string
    try { crudo = await transcribir(audios.get(f.phrase_id)!) }
    catch (e) { errores++; console.log(`  [${i + 1}/${lista.length}] ERROR ${f.phrase_id}: ${String(e).slice(0, 90)}`); continue }

    const pipe = procesarTranscript(crudo).texto
    const ref = f.canonical_text

    sumaWerCrudo += wer(ref, crudo); nCrudo++
    sumaWerPipe += wer(ref, pipe); nPipe++

    for (const t of (f.key_terms || '').split('|').filter(Boolean)) {
      if (!evaluable(t, ref)) continue
      termsTotal++
      if (terminoPresente(t, crudo).ok) termsCrudo++
      if (terminoPresente(t, pipe).ok) termsPipe++
      else fallos.push({ id: f.phrase_id, ref, crudo, pipe, motivo: `término perdido: ${t}` })
    }
    for (const c of erroresCriticos(ref, crudo)) criticosCrudo.push(`${f.phrase_id}:${c}`)
    for (const c of erroresCriticos(ref, pipe)) {
      criticosPipe.push(`${f.phrase_id}:${c}`)
      fallos.push({ id: f.phrase_id, ref, crudo, pipe, motivo: `ERROR CRÍTICO ${c}` })
    }
    if ((i + 1) % 25 === 0) console.log(`  [${i + 1}/${lista.length}]`)
  }

  const pct = (x: number) => `${(x * 100).toFixed(2)} %`
  console.log(`
  ── WER (menos es mejor) ──
     reconocedor crudo ....... ${pct(sumaWerCrudo / Math.max(1, nCrudo))}
     pipeline completo ....... ${pct(sumaWerPipe / Math.max(1, nPipe))}

  ── Clinical Term Recall (la que manda) ──
     reconocedor crudo ....... ${pct(termsCrudo / Math.max(1, termsTotal))}  (${termsCrudo}/${termsTotal})
     pipeline completo ....... ${pct(termsPipe / Math.max(1, termsTotal))}  (${termsPipe}/${termsTotal})

  ── ERRORES CRÍTICOS (el criterio de aceptación es CERO) ──
     reconocedor crudo ....... ${criticosCrudo.length}
     pipeline completo ....... ${criticosPipe.length}
${criticosPipe.slice(0, 12).map(c => `       ${c}`).join('\n')}

     audios que fallaron al transcribir: ${errores}
`)
  // El detalle se escribe SIEMPRE: un resumen sin los casos no se puede depurar.
  writeFileSync('benchmark-audio-fallos.jsonl', fallos.map(f => JSON.stringify(f)).join('\n') + '\n')
  console.log(`  Detalle de ${fallos.length} fallos en benchmark-audio-fallos.jsonl\n`)
  if (criticosPipe.length > 0) process.exitCode = 1
}

void main()
