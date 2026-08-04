/**
 * GENERADOR DEL CORPUS ACTUADO DE CONSULTA — con verdad de terreno por turno.
 *
 * ── QUÉ PRODUCE Y POR QUÉ ASÍ ────────────────────────────────────────────────
 *
 * Un audio por diálogo, y un manifiesto que dice **en qué milisegundo empieza y
 * termina cada turno y quién lo dijo**.
 *
 * Esa marca de tiempo no se estima: cada turno se sintetiza **por separado**, se
 * mide con `ffprobe` el archivo ya generado, y las fronteras salen de sumar
 * duraciones reales. Un gold con tiempos inventados mediría el invento.
 *
 * ── UNA VOZ POR ROL, Y ROTANDO ───────────────────────────────────────────────
 *
 * El médico, el paciente y el acompañante llevan voces distintas — si no, no hay
 * nada que separar. Y la terna **rota por diálogo**: con una sola pareja de
 * voces se acabaría midiendo qué tan bien se distinguen ESAS dos, que es un
 * número bonito y falso.
 *
 * ── SE PAGA UNA VEZ ──────────────────────────────────────────────────────────
 *
 * Cada turno sintetizado se guarda en `TURNOS/`. Al repetir la generación se
 * reutiliza y **no se vuelve a llamar a la API**: cambiar un diálogo no obliga a
 * pagar los otros once.
 *
 * ── CERO PACIENTES REALES ────────────────────────────────────────────────────
 *
 * Todos los nombres son inventados y las voces son sintéticas. La voz es
 * biométrica: el gold nace actuado, nunca de una consulta de verdad.
 *
 * Uso:
 *   OPENAI_API_KEY=... npx tsx scripts/generar-corpus-dialogo.ts [carpeta salida]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const GUION = 'synthetic-data/dialogos-consulta/GUION.jsonl'
const SALIDA = process.argv[2] || 'synthetic-data/dialogos-consulta/salida'
const MODELO_TTS = process.env.TTS_MODELO || 'gpt-4o-mini-tts'

/**
 * Las voces del proveedor, repartidas por rol.
 *
 * Se eligen timbres separados a propósito: dos voces parecidas medirían la
 * paciencia del separador de voces, no su capacidad.
 */
const VOCES: Record<string, string[]> = {
  'Médico': ['onyx', 'echo', 'ash'],
  'Paciente': ['nova', 'shimmer', 'coral'],
  'Acompañante': ['fable', 'sage', 'alloy'],
}

/** Silencio entre turnos. Corto, como en una consulta: nadie deja dos segundos. */
const PAUSA_MS = 320

interface Turno { rol: string; texto: string }
interface Dialogo {
  id: string
  pone_a_prueba: string[]
  contexto: string
  turnos: Turno[]
  nota_esperada: Record<string, unknown>
}

if (!existsSync(GUION)) { console.error(`No encuentro ${GUION}`); process.exit(1) }
const dialogos: Dialogo[] = readFileSync(GUION, 'utf8')
  .split('\n').filter(Boolean).map(l => JSON.parse(l))

const DIR_TURNOS = join(SALIDA, 'TURNOS')
const DIR_AUDIO = join(SALIDA, 'AUDIOS')
mkdirSync(DIR_TURNOS, { recursive: true })
mkdirSync(DIR_AUDIO, { recursive: true })

const yaGenerados = new Set(existsSync(DIR_TURNOS) ? readdirSync(DIR_TURNOS) : [])
if (!process.env.OPENAI_API_KEY && yaGenerados.size === 0) {
  console.error('Falta OPENAI_API_KEY. No la escribas en el comando: expórtala en la sesión.')
  process.exit(1)
}

/** Sintetiza un turno. Devuelve la ruta del mp3. Reutiliza si ya existe. */
async function sintetizar(archivo: string, texto: string, voz: string): Promise<string> {
  const ruta = join(DIR_TURNOS, archivo)
  if (existsSync(ruta)) return ruta
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODELO_TTS, voice: voz, input: texto, response_format: 'mp3' }),
  })
  if (!res.ok) throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 200)}`)
  writeFileSync(ruta, Buffer.from(await res.arrayBuffer()))
  return ruta
}

/** Duración real del archivo, en milisegundos. Medida, no supuesta. */
function duracionMs(ruta: string): number {
  const out = execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', ruta,
  ], { encoding: 'utf8' })
  return Math.round(parseFloat(out.trim()) * 1000)
}

async function main() {
  const manifiesto: unknown[] = []
  let pagados = 0, reutilizados = 0

  for (const d of dialogos) {
    const partes: string[] = []
    const turnos: { i: number; rol: string; texto: string; inicioMs: number; finMs: number }[] = []
    let cursor = 0

    for (let i = 0; i < d.turnos.length; i++) {
      const t = d.turnos[i]
      const opciones = VOCES[t.rol] ?? VOCES['Paciente']
      // La terna rota con el diálogo, no con el turno: dentro de una consulta,
      // el mismo rol tiene que sonar igual de principio a fin.
      const voz = opciones[dialogos.indexOf(d) % opciones.length]
      const archivo = `${d.id}_${String(i).padStart(2, '0')}_${voz}.mp3`
      const antes = existsSync(join(DIR_TURNOS, archivo))
      const ruta = await sintetizar(archivo, t.texto, voz)
      antes ? reutilizados++ : pagados++

      const dur = duracionMs(ruta)
      turnos.push({ i, rol: t.rol, texto: t.texto, inicioMs: cursor, finMs: cursor + dur })
      cursor += dur + PAUSA_MS
      partes.push(ruta)
    }

    // Concatenar con el silencio en medio. `-f concat` no re-codifica: las
    // duraciones medidas siguen siendo válidas en el archivo final.
    const lista = join(SALIDA, `${d.id}.txt`)
    const silencio = join(SALIDA, 'silencio.mp3')
    if (!existsSync(silencio)) {
      /**
       * El silencio se genera con LOS MISMOS parámetros que el TTS (24 kHz,
       * mono, 128 kbps). Con otra tasa, `-c copy` se niega a pegar los trozos —
       * y re-codificar movería las duraciones que acabamos de medir, que son
       * justo la verdad de terreno que este corpus existe para dar.
       */
      execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono',
        '-t', String(PAUSA_MS / 1000), '-c:a', 'libmp3lame', '-b:a', '128k', '-ar', '24000', '-ac', '1',
        silencio], { stdio: 'ignore' })
    }
    /**
     * Rutas ABSOLUTAS en la lista: `-f concat` las resuelve relativas al propio
     * archivo de lista, no al directorio de trabajo, y una ruta relativa acaba
     * duplicando la carpeta.
     */
    writeFileSync(lista, partes
      .flatMap(p => [`file '${resolve(p)}'`, `file '${resolve(silencio)}'`])
      .slice(0, -1).join('\n'))
    const salidaMp3 = join(DIR_AUDIO, `${d.id}.mp3`)
    execFileSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', lista, '-c', 'copy', salidaMp3], { stdio: 'ignore' })

    manifiesto.push({
      id: d.id,
      audio: salidaMp3,
      poneAPrueba: d.pone_a_prueba,
      contexto: d.contexto,
      duracionMs: duracionMs(salidaMp3),
      vocesPorRol: Object.fromEntries([...new Set(d.turnos.map(t => t.rol))]
        .map(r => [r, (VOCES[r] ?? VOCES['Paciente'])[dialogos.indexOf(d) % 3]])),
      turnos,
      notaEsperada: d.nota_esperada,
    })
    console.log(`  ${d.id} · ${d.turnos.length} turnos · ${(duracionMs(salidaMp3) / 1000).toFixed(1)} s`)
  }

  const ruta = join(SALIDA, 'MANIFEST_DIALOGOS.jsonl')
  writeFileSync(ruta, manifiesto.map(m => JSON.stringify(m)).join('\n') + '\n')

  console.log(`\n  ${dialogos.length} diálogos · ${pagados} turnos sintetizados · ${reutilizados} reutilizados`)
  console.log(`  Manifiesto: ${ruta}\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
