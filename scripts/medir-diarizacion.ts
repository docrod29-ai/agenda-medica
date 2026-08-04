/**
 * MEDIDOR DE DIARIZACIÓN Y ATRIBUCIÓN DE ROL — lo que faltaba del charter.
 *
 * ── LO QUE MIDE, Y POR QUÉ ESTAS TRES COSAS ──────────────────────────────────
 *
 * 1. **Cuántas voces encontró** contra cuántas hay de verdad. Sobre-partir es el
 *    fallo silencioso: un mismo médico repartido en «A», «C» y «F» deja la
 *    atribución de roles irresoluble aunque la transcripción sea perfecta.
 *
 * 2. **Exactitud de turno**: para cada turno del guion, ¿el sistema le puso la
 *    misma etiqueta de hablante que a los demás turnos de esa persona? Se compara
 *    la PARTICIÓN, no el nombre: al proveedor le da igual llamarle «A» o «B», lo
 *    que no puede es mezclar a dos personas o partir a una.
 *
 * 3. **Errores que cambian la clínica**: un turno del PACIENTE atribuido al
 *    MÉDICO, o al revés. De ahí cuelgan el motor de negaciones y la procedencia:
 *    si el «No» de «¿diabetes o presión alta?» se le atribuye al médico, la
 *    defensa razona sobre una atribución falsa y responde con la misma
 *    seguridad que si fuera verdad.
 *
 * ── CÓMO SE EMPAREJA UN TURNO CON LO QUE DEVOLVIÓ EL PROVEEDOR ───────────────
 *
 * Por **solape de tiempo**. El manifiesto trae el milisegundo exacto en que
 * empieza y termina cada turno —medido, no estimado— y el proveedor devuelve sus
 * propios intervalos: se le asigna a cada turno del guion el hablante que más
 * tiempo ocupa dentro de él. Es la comparación honesta; emparejar por texto
 * escondería justo los errores de frontera.
 *
 * ── LO QUE NO MIDE ───────────────────────────────────────────────────────────
 *
 * No hay solapamiento real (los turnos se concatenan), no hay ruido de
 * consultorio y las voces son sintéticas. **Es un piso, no lo que se verá en el
 * consultorio.** Está dicho también en el GUION.md del corpus.
 *
 * Uso:
 *   ASSEMBLYAI_API_KEY=... npx tsx scripts/medir-diarizacion.ts [carpeta]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const CARPETA = process.argv[2] || 'synthetic-data/dialogos-consulta/salida'
const MANIFIESTO = join(CARPETA, 'MANIFEST_DIALOGOS.jsonl')
const CACHE_DIR = join(CARPETA, 'DIARIZACION')
const AAI = 'https://api.assemblyai.com/v2'
const MODELO = process.env.ASR_MODELO_DIARIZACION || 'universal-3.5-pro'

interface TurnoOro { i: number; rol: string; texto: string; inicioMs: number; finMs: number }
interface Dialogo { id: string; audio: string; turnos: TurnoOro[]; duracionMs: number }
interface Utterance { speaker: string; start: number; end: number; text: string }

if (!existsSync(MANIFIESTO)) {
  console.error(`No encuentro ${MANIFIESTO}. Genera el corpus primero.`)
  process.exit(1)
}
mkdirSync(CACHE_DIR, { recursive: true })

const dialogos: Dialogo[] = readFileSync(MANIFIESTO, 'utf8')
  .split('\n').filter(Boolean).map(l => JSON.parse(l))

const key = process.env.ASSEMBLYAI_API_KEY
const faltanCache = dialogos.filter(d => !existsSync(join(CACHE_DIR, `${d.id}.json`)))
if (!key && faltanCache.length > 0) {
  console.error('Falta ASSEMBLYAI_API_KEY. No la escribas en el comando: expórtala en la sesión.')
  process.exit(1)
}

const dormir = (ms: number) => new Promise(r => setTimeout(r, ms))

/** Manda el audio y espera el resultado. Se guarda: se paga una sola vez. */
async function diarizar(d: Dialogo): Promise<Utterance[]> {
  const cache = join(CACHE_DIR, `${d.id}.json`)
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, 'utf8'))

  const bytes = readFileSync(d.audio)
  const up = await fetch(`${AAI}/upload`, {
    method: 'POST', headers: { authorization: key! }, body: bytes,
  })
  if (!up.ok) throw new Error(`upload ${up.status}`)
  const { upload_url } = await up.json()

  const sub = await fetch(`${AAI}/transcript`, {
    method: 'POST',
    headers: { authorization: key!, 'content-type': 'application/json' },
    body: JSON.stringify({
      audio_url: upload_url,
      speech_model: MODELO,
      speaker_labels: true,
      // Lo mismo que manda la app en producción: sin esto el proveedor asume
      // hasta 10 voces y sobre-parte una consulta de dos.
      speaker_options: { min_speakers_expected: 1, max_speakers_expected: 4 },
      domain: 'medical-v1',
      language_code: 'es',
      punctuate: true,
      format_text: true,
    }),
  })
  if (!sub.ok) throw new Error(`submit ${sub.status}: ${(await sub.text()).slice(0, 200)}`)
  const { id } = await sub.json()

  for (let intento = 0; intento < 120; intento++) {
    await dormir(3000)
    const r = await fetch(`${AAI}/transcript/${id}`, { headers: { authorization: key! } })
    const j = await r.json()
    if (j.status === 'completed') {
      const u: Utterance[] = (j.utterances ?? []).map((x: Utterance) => ({
        speaker: x.speaker, start: x.start, end: x.end, text: x.text,
      }))
      writeFileSync(cache, JSON.stringify(u, null, 2))
      return u
    }
    if (j.status === 'error') throw new Error(`proveedor: ${j.error}`)
  }
  throw new Error('el proveedor no terminó a tiempo')
}

/** Qué hablante del proveedor ocupa más tiempo dentro del turno del guion. */
function hablanteDe(turno: TurnoOro, us: readonly Utterance[]): string | null {
  let mejor: string | null = null, masMs = 0
  for (const u of us) {
    const solape = Math.min(turno.finMs, u.end) - Math.max(turno.inicioMs, u.start)
    if (solape > masMs) { masMs = solape; mejor = u.speaker }
  }
  return masMs > 0 ? mejor : null
}

async function main() {
  console.log(`\n  ${dialogos.length} diálogos · modelo ${MODELO}\n`)

  let turnosTotal = 0, turnosConHablante = 0, turnosCorrectos = 0
  let vocesExactas = 0
  const confusionesClinicas: string[] = []
  const detalle: unknown[] = []

  for (const d of dialogos) {
    let us: Utterance[]
    try { us = await diarizar(d) }
    catch (e) { console.log(`  ${d.id}: ERROR ${String(e).slice(0, 100)}`); continue }

    const rolesReales = new Set(d.turnos.map(t => t.rol))
    const vocesDetectadas = new Set(us.map(u => u.speaker))
    if (vocesDetectadas.size === rolesReales.size) vocesExactas++

    /**
     * La partición se compara con el rol, no con el nombre del hablante: se
     * elige, para cada rol, la etiqueta del proveedor con la que más turnos
     * coincide, y se cuenta cuántos turnos caen en la etiqueta de su rol.
     */
    const votos = new Map<string, Map<string, number>>()
    const asignados: (string | null)[] = []
    for (const t of d.turnos) {
      const h = hablanteDe(t, us)
      asignados.push(h)
      if (!h) continue
      const m = votos.get(t.rol) ?? new Map<string, number>()
      m.set(h, (m.get(h) ?? 0) + 1)
      votos.set(t.rol, m)
    }
    const etiquetaDe = new Map<string, string>()
    const usadas = new Set<string>()
    // El rol con la mayoría más clara se queda su etiqueta primero: si no, dos
    // roles podrían reclamar la misma y el conteo saldría inflado.
    const porFuerza = [...votos.entries()].sort((a, b) =>
      Math.max(...b[1].values()) - Math.max(...a[1].values()))
    for (const [rol, m] of porFuerza) {
      const libre = [...m.entries()].filter(([h]) => !usadas.has(h)).sort((a, b) => b[1] - a[1])[0]
      if (libre) { etiquetaDe.set(rol, libre[0]); usadas.add(libre[0]) }
    }

    const fallos: string[] = []
    d.turnos.forEach((t, i) => {
      turnosTotal++
      const h = asignados[i]
      if (h === null) return
      turnosConHablante++
      if (etiquetaDe.get(t.rol) === h) { turnosCorrectos++; return }
      const rolAtribuido = [...etiquetaDe.entries()].find(([, e]) => e === h)?.[0] ?? '?'
      fallos.push(`turno ${i} (${t.rol} → ${rolAtribuido}): «${t.texto.slice(0, 55)}…»`)
      // Confundir médico con paciente es el error que rompe la negación.
      if ((t.rol === 'Médico' && rolAtribuido === 'Paciente')
        || (t.rol === 'Paciente' && rolAtribuido === 'Médico')) {
        confusionesClinicas.push(`${d.id} turno ${i}: ${t.rol} → ${rolAtribuido}`)
      }
    })

    console.log(`  ${d.id}  voces ${vocesDetectadas.size}/${rolesReales.size}  turnos ok ${d.turnos.length - fallos.length}/${d.turnos.length}`)
    for (const f of fallos) console.log(`      ${f}`)
    detalle.push({ id: d.id, vocesDetectadas: vocesDetectadas.size, vocesReales: rolesReales.size, fallos })
  }

  const pct = (n: number, de: number) => de === 0 ? '—' : `${((n / de) * 100).toFixed(2)} %`
  console.log('\n  ── RESULTADO ──')
  console.log(`  diálogos con el número de voces correcto ... ${vocesExactas}/${dialogos.length}`)
  console.log(`  turnos con hablante asignado .............. ${turnosConHablante}/${turnosTotal}`)
  console.log(`  exactitud de atribución de turno .......... ${pct(turnosCorrectos, turnosConHablante)}`)
  console.log(`  confusiones médico↔paciente ............... ${confusionesClinicas.length}`)
  for (const c of confusionesClinicas) console.log(`      ${c}`)

  const informe = {
    fecha: new Date().toISOString().slice(0, 10),
    modelo: MODELO,
    corpus: 'dialogos-consulta actuado (TTS, sin ruido ni solapamiento real)',
    dialogos: dialogos.length,
    vocesExactas,
    turnosTotal,
    turnosConHablante,
    turnosCorrectos,
    exactitudTurno: turnosConHablante ? turnosCorrectos / turnosConHablante : null,
    confusionesMedicoPaciente: confusionesClinicas,
    limites: [
      'Voces sintéticas: no es una muestra de hablantes reales.',
      'Sin solapamiento: los turnos se concatenan.',
      'Sin ruido de consultorio ni distancia al micrófono.',
      'Es un PISO, no lo que se verá en producción.',
    ],
    detalle,
  }
  const ruta = join(CARPETA, 'INFORME_DIARIZACION.json')
  writeFileSync(ruta, JSON.stringify(informe, null, 2))
  console.log(`\n  Informe: ${ruta}\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
