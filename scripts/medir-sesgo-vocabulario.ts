/**
 * ¿CUÁNTO RINDE SESGAR EL MOTOR CON EL EXPEDIENTE DEL PACIENTE?
 *
 * ── LA PREGUNTA QUE NUNCA SE HABÍA MEDIDO ────────────────────────────────────
 *
 * El sesgo de vocabulario está construido y conectado desde hace versiones: el
 * motor de voz recibe los fármacos, las alergias y los diagnósticos del paciente
 * que está enfrente, más lo que ESTE médico ya corrigió a mano.
 *
 * Es la pieza que se ha declarado una y otra vez como el foso del producto —
 * ninguno de los competidores lo hace— y **nadie sabía cuánto sube el acierto**.
 * El 71,48 % de término clínico que se publicó en `WER-MEDIDO.md` se midió SIN
 * sesgo, porque aquel corpus no trae paciente.
 *
 * ── POR QUÉ TRES CONDICIONES Y NO DOS ────────────────────────────────────────
 *
 * Un A/B «con sesgo vs sin sesgo» donde el sesgo contiene exactamente el término
 * que se espera oír mide el techo, no la realidad. En una consulta de verdad el
 * expediente trae lo que el paciente YA toma; el fármaco que el médico va a
 * prescribir ahora puede no estar.
 *
 * Así que se miden tres:
 *
 *   1. `sin`        — ningún sesgo. La línea base honesta.
 *   2. `catalogo`   — sólo el vocabulario médico general, igual para todos los
 *                     pacientes del mundo. Es lo que hace un producto sin
 *                     expediente: el suelo de la competencia.
 *   3. `paciente`   — el catálogo MÁS los términos de este caso, en el orden que
 *                     manda la política (primero lo del paciente). Es el techo:
 *                     lo que se obtiene cuando el expediente sí contiene el
 *                     término.
 *
 * La distancia 2→3 es **el valor del expediente**. Es el número que importa.
 *
 * ── SE PAGA UNA VEZ ──────────────────────────────────────────────────────────
 *
 * Cada transcripción se guarda en `salida/`. Repetir la medición no vuelve a
 * llamar al proveedor.
 *
 * Uso:
 *   npx tsx scripts/medir-sesgo-vocabulario.ts <carpeta-corpus> [n]
 *
 * La llave sale de `ASSEMBLYAI_API_KEY` (o de `.env.local`). Nunca se imprime.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { componerSesgo, topeDe } from '../src/lib/asr/sesgo-diarizado'
import { WORD_BOOST_MEDICO } from '../src/lib/expediente/medical-vocabulary'
import { terminoPresente, evaluable } from '../src/lib/uci/benchmark-metricas'
import { wer } from '../src/lib/uci/benchmark-voz'

const RAIZ = process.argv[2]
const N = Number(process.argv[3] ?? 150)
if (!RAIZ || !existsSync(RAIZ)) {
  console.error('Uso: npx tsx scripts/medir-sesgo-vocabulario.ts <carpeta-corpus> [n]')
  process.exit(1)
}

/** La llave, sin imprimirla nunca. */
function llave(): string {
  if (process.env.ASSEMBLYAI_API_KEY) return process.env.ASSEMBLYAI_API_KEY
  try {
    const env = readFileSync('.env.local', 'utf8')
    const m = env.match(/^ASSEMBLYAI_API_KEY\s*=\s*(.+)$/m)
    if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  } catch { /* sin .env.local */ }
  console.error('Falta ASSEMBLYAI_API_KEY. Expórtala o ponla en .env.local.')
  process.exit(1)
}

const AAI = 'https://api.assemblyai.com/v2'
const MODELOS = ['universal-3-5-pro', 'universal-2'] as const
const TOPE = Math.min(...MODELOS.map(m => topeDe(m)))
const SALIDA = join(RAIZ, 'SESGO')
mkdirSync(SALIDA, { recursive: true })

/**
 * ── LA CUARTA CONDICIÓN: EL TOPE COMPLETO ──────────────────────────────────
 *
 * En producción el sesgo se presupuesta para el modelo MÁS PEQUEÑO de la lista
 * de respaldo — 200 términos, no 1 000— porque `speech_models` deja que el
 * proveedor elija, y si mandáramos mil y él usara `universal-2`, tiraría
 * ochocientos por el criterio que quisiera. Podría llevarse justo los fármacos
 * del paciente, que van primero a propósito.
 *
 * Esa prudencia cuesta cuatro quintas partes del cupo. `paciente1000` mide lo
 * que se está dejando sobre la mesa, y para que la comparación sea limpia pide
 * **sólo `universal-3-5-pro`**, que es el que admite mil: así el recorte no lo
 * decide el proveedor y se sabe exactamente qué términos llegaron.
 *
 * Si rinde, la decisión es fijar ese modelo. Si no, el tope de 200 se queda y
 * deja de ser una duda.
 */
type Condicion = 'sin' | 'catalogo' | 'paciente' | 'paciente1000'
const CONDICIONES: Condicion[] = ['sin', 'catalogo', 'paciente', 'paciente1000']
const TOPE_GRANDE = 1000

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Las mismas unidades rotas que se excluyen en `medir-wer-limpio.ts`. */
const EXPANDIDAS = ['microgramos', 'miligramos', 'picogramos', 'nanogramos', 'kilogramos',
  'miliequivalentes', 'milimoles', 'mililitros', 'milisegundos', 'gramos', 'litros']

function audioCorrupto(tts: string): boolean {
  for (const palabra of String(tts ?? '').split(/\s+/)) {
    const p = sinAcentos(palabra.replace(/[.,;:()¿?¡!]/g, ''))
    for (const u of EXPANDIDAS) {
      const i = p.indexOf(u)
      if (i >= 0 && (i > 0 || i + u.length < p.length)) return true
    }
  }
  return false
}

function leerCsv(texto: string): Record<string, string>[] {
  const filas: string[][] = []
  let campo = '', fila: string[] = [], q = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (q) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++ }
      else if (c === '"') q = false
      else campo += c
    } else if (c === '"') q = true
    else if (c === ',') { fila.push(campo); campo = '' }
    else if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = '' }
    else if (c !== '\r') campo += c
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila) }
  const cab = filas.shift()!
  return filas.filter(f => f.length === cab.length)
    .map(f => Object.fromEntries(cab.map((k, i) => [k, f[i]])))
}

/** Índice de audios por phrase_id (viven en subcarpetas por especialidad). */
function indiceDeAudios(dir: string): Map<string, string> {
  const idx = new Map<string, string>()
  const anda = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isDirectory()) anda(p)
      else if (e.name.endsWith('.mp3')) idx.set(e.name.split('__')[0], p)
    }
  }
  anda(dir)
  return idx
}

/**
 * MUESTREO REPRODUCIBLE.
 *
 * Sin aleatoriedad de reloj: la misma semilla da la misma muestra, así que el
 * resultado se puede volver a comprobar. Un experimento que no se puede repetir
 * no es una medición.
 */
function barajaEstable<T>(xs: T[], semilla = 20260805): T[] {
  let s = semilla
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const j = s % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const KEY = llave()
const H = { authorization: KEY }

async function subir(ruta: string): Promise<string> {
  const r = await fetch(`${AAI}/upload`, {
    method: 'POST', headers: { ...H, 'content-type': 'application/octet-stream' },
    body: new Uint8Array(readFileSync(ruta)),
  })
  if (!r.ok) throw new Error(`upload ${r.status}: ${(await r.text()).slice(0, 120)}`)
  return (await r.json()).upload_url as string
}

async function transcribir(url: string, boost: string[], modelos: readonly string[] = MODELOS): Promise<string> {
  const cuerpo: Record<string, unknown> = {
    audio_url: url, language_code: 'es', speech_models: [...modelos],
  }
  /**
   * `keyterms_prompt`, no `word_boost`.
   *
   * La primera corrida de este mismo script destapó por qué importa: con
   * `word_boost` el proveedor descarta `universal-3-5-pro` y corre con
   * `universal-2`. Las condiciones «con sesgo» acababan midiendo OTRO MODELO
   * que la condición «sin sesgo», y el resultado salía 0,00 pp.
   */
  if (boost.length) cuerpo.keyterms_prompt = boost
  const r = await fetch(`${AAI}/transcript`, {
    method: 'POST', headers: { ...H, 'content-type': 'application/json' },
    body: JSON.stringify(cuerpo),
  })
  if (!r.ok) throw new Error(`transcript ${r.status}: ${(await r.text()).slice(0, 160)}`)
  const id = (await r.json()).id as string

  for (let i = 0; i < 90; i++) {
    await new Promise(res => setTimeout(res, 2000))
    const p = await fetch(`${AAI}/transcript/${id}`, { headers: H })
    const d = await p.json()
    if (d.status === 'completed') return String(d.text ?? '')
    if (d.status === 'error') throw new Error(String(d.error ?? 'error'))
  }
  throw new Error('timeout esperando la transcripción')
}

/** El sesgo de cada condición. El orden ES la política: paciente primero. */
function boostDe(cond: Condicion, keyTerms: string[]): string[] {
  if (cond === 'sin') return []
  if (cond === 'catalogo') return componerSesgo({}, WORD_BOOST_MEDICO, TOPE).terminos
  const tope = cond === 'paciente1000' ? TOPE_GRANDE : TOPE
  return componerSesgo({ medicamentos: keyTerms }, WORD_BOOST_MEDICO, tope).terminos
}

/** Sólo el modelo que admite mil términos, para que el recorte no lo haga el proveedor. */
function modelosDe(_cond: Condicion): readonly string[] {
  /**
   * EL MISMO MODELO EN LAS CUATRO CONDICIONES.
   *
   * Es lo único que hace comparable el experimento. La primera corrida mandaba
   * la lista y el proveedor elegía distinto según el parámetro de sesgo, así que
   * no se medía el sesgo: se medía la diferencia entre dos modelos.
   */
  void _cond
  return ['universal-3-5-pro']
}

interface Resultado { terminos: number; vivos: number; wer: number; frases: number }

async function main() {
  const filas = leerCsv(readFileSync(join(RAIZ, 'MASTER_6000_FRASES_UNICAS.csv'), 'utf8'))
  const audios = indiceDeAudios(join(RAIZ, 'AUDIOS'))

  const elegibles = filas.filter(f =>
    audios.has(f.phrase_id ?? '') &&
    !audioCorrupto(f.tts_text ?? '') &&
    (f.key_terms ?? '').split('|').filter(Boolean).some(t => evaluable(t, f.canonical_text ?? '')))

  const muestra = barajaEstable(elegibles).slice(0, N)
  console.log(`\n  elegibles: ${elegibles.length}   ·   muestra: ${muestra.length}   ·   tope de sesgo: ${TOPE} términos\n`)

  const acc: Record<Condicion, Resultado> = {
    sin: { terminos: 0, vivos: 0, wer: 0, frases: 0 },
    catalogo: { terminos: 0, vivos: 0, wer: 0, frases: 0 },
    paciente: { terminos: 0, vivos: 0, wer: 0, frases: 0 },
    paciente1000: { terminos: 0, vivos: 0, wer: 0, frases: 0 },
  }
  const rescatados: string[] = []
  let hechos = 0

  for (const f of muestra) {
    const id = f.phrase_id
    const ref = f.canonical_text ?? ''
    const terms = (f.key_terms ?? '').split('|').filter(Boolean).filter(t => evaluable(t, ref))
    const ruta = audios.get(id)!

    let url: string | null = null
    const textos: Partial<Record<Condicion, string>> = {}

    for (const cond of CONDICIONES) {
      const cache = join(SALIDA, `${id}__${cond}.txt`)
      if (existsSync(cache)) { textos[cond] = readFileSync(cache, 'utf8'); continue }
      try {
        url ??= await subir(ruta)
        const t = await transcribir(url, boostDe(cond, terms), modelosDe(cond))
        writeFileSync(cache, t)
        textos[cond] = t
      } catch (e) {
        console.error(`  ${id} [${cond}] falló: ${e instanceof Error ? e.message : e}`)
      }
    }

    if (CONDICIONES.some(c => textos[c] === undefined)) continue

    for (const cond of CONDICIONES) {
      const t = textos[cond]!
      acc[cond].frases++
      acc[cond].wer += wer(ref, t)
      for (const term of terms) {
        acc[cond].terminos++
        if (terminoPresente(term, t).ok) acc[cond].vivos++
      }
    }

    // Lo que el sesgo del paciente RESCATA y el catálogo solo no.
    for (const term of terms) {
      const conCatalogo = terminoPresente(term, textos.catalogo!).ok
      const conPaciente = terminoPresente(term, textos.paciente!).ok
      if (!conCatalogo && conPaciente && rescatados.length < 25) {
        rescatados.push(`${id}: «${term}»`)
      }
    }

    if (++hechos % 10 === 0) console.log(`  ${hechos}/${muestra.length}…`)
  }

  const pct = (n: number, d: number) => d === 0 ? 0 : (n / d) * 100
  console.log('\n  ─────────────────────────────────────────────────────────')
  for (const cond of CONDICIONES) {
    const a = acc[cond]
    console.log(`  ${cond.padEnd(9)}  recall ${pct(a.vivos, a.terminos).toFixed(2).padStart(6)} %   WER ${pct(a.wer, a.frases).toFixed(2).padStart(6)} %   (${a.terminos} términos, ${a.frases} frases)`)
  }
  const base = pct(acc.catalogo.vivos, acc.catalogo.terminos)
  const conPac = pct(acc.paciente.vivos, acc.paciente.terminos)
  const sinNada = pct(acc.sin.vivos, acc.sin.terminos)
  console.log('  ─────────────────────────────────────────────────────────')
  console.log(`  catálogo genérico aporta ....... ${(base - sinNada).toFixed(2)} pp`)
  const conMil = pct(acc.paciente1000.vivos, acc.paciente1000.terminos)
  console.log(`  EL EXPEDIENTE DEL PACIENTE ..... ${(conPac - base).toFixed(2)} pp  ← el foso`)
  console.log(`  subir el tope 200 → 1000 ....... ${(conMil - conPac).toFixed(2)} pp  (sólo universal-3-5-pro)`)
  if (rescatados.length) {
    console.log('\n  ── términos que SÓLO rescata el expediente ──')
    console.log(rescatados.slice(0, 12).map(r => `  ${r}`).join('\n'))
  }

  writeFileSync('docs/voice/SESGO-MEDIDO.json', JSON.stringify({
    muestra: acc.sin.frases, tope: TOPE, modelos: MODELOS,
    recall: {
      sin: sinNada / 100, catalogo: base / 100, paciente: conPac / 100,
      paciente1000: conMil / 100,
    },
    werMedio: Object.fromEntries(CONDICIONES.map(c => [c, acc[c].wer / Math.max(1, acc[c].frases)])),
    aporte: {
      catalogoGenerico: (base - sinNada) / 100,
      expedienteDelPaciente: (conPac - base) / 100,
      subirElTopeA1000: (conMil - conPac) / 100,
    },
    rescatadosPorElExpediente: rescatados,
    limites: [
      'Una sola voz sintética: no mide acentos, edad ni prosodia reales.',
      'Sin ruido de consultorio ni solapamiento.',
      'La condición «paciente» asume que el término YA está en el expediente; en una consulta real un fármaco nuevo puede no estarlo. Es el techo, no el caso medio.',
    ],
  }, null, 2) + '\n')
  console.log('\n  Escrito: docs/voice/SESGO-MEDIDO.json\n')
}

main().catch(e => { console.error(e); process.exit(1) })
