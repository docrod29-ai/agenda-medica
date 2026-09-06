/**
 * EL WER REAL — separando lo que falla el reconocedor de lo que falla el corpus.
 *
 * ── POR QUÉ HACÍA FALTA ESTE SCRIPT ──────────────────────────────────────────
 *
 * La primera medición de los 6 000 audios dio 38,20 % de WER crudo y 31,72 %
 * tras el pipeline. Al abrir los fallos apareció que **el 35,6 % de ellos venían
 * del propio corpus**: el generador expandió las unidades sin límite de palabra
 * y dejó 1 364 filas con palabras que no existen —«microgramos ramos»,
 * «agramosua», «Hemogramoslobina»—, y el audio se grabó diciendo eso.
 *
 * Medido así, el reconocedor sale reprobado por un defecto que no es suyo. El
 * número no era publicable, y por eso quedó pendiente.
 *
 * ── LO QUE HACE ──────────────────────────────────────────────────────────────
 *
 * Reutiliza las 5 999 transcripciones YA PAGADAS —no llama a ningún proveedor,
 * no cuesta nada y es reproducible— y publica **los dos números**:
 *
 *   · el de todo el corpus, que es el que se venía citando;
 *   · el de las filas cuyo audio es válido, que es el que mide al reconocedor.
 *
 * Se dan los dos a propósito. Publicar sólo el bueno, sin decir qué se excluyó y
 * por qué, sería elegir la cifra que conviene. Y el número de filas descartadas
 * es en sí mismo un resultado: dice cuánto del corpus hay que regenerar.
 *
 * ── LO QUE NO HACE ───────────────────────────────────────────────────────────
 *
 * No repara nada ni vuelve a sintetizar audio. La reparación del CSV vive en
 * `reparar-corpus-expansion.ts`; regenerar el audio de esas filas es un gasto
 * aparte y una decisión del dueño.
 *
 * Uso:
 *   npx tsx scripts/medir-wer-limpio.ts <carpeta-del-corpus>
 *
 * Espera dentro: `MASTER_6000_FRASES_UNICAS.csv` y
 * `TRANSCRIPCIONES/<motor>/CLIN3_XXXXX.txt`.
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { wer } from '../src/lib/uci/benchmark-voz'
import { terminoPresente, evaluable } from '../src/lib/uci/benchmark-metricas'
import { procesarTranscript } from '../src/lib/asr/pipeline'
import { leerConsulta, leerElMotor, type ConsultaMedida } from '../src/lib/asr/lo-que-pesa-de-un-error'

const RAIZ = process.argv[2]
if (!RAIZ || !existsSync(RAIZ)) {
  console.error('Uso: npx tsx scripts/medir-wer-limpio.ts <carpeta-del-corpus>')
  process.exit(1)
}

/**
 * Las unidades que el generador expandió. Si una de estas palabras aparece
 * PEGADA a otras letras, la fila está corrupta: una unidad legítima va sola.
 * Es el mismo criterio de `reparar-corpus-expansion.ts`, para que las dos
 * herramientas cuenten lo mismo.
 */
const EXPANDIDAS = [
  'microgramos', 'miligramos', 'picogramos', 'nanogramos', 'kilogramos',
  'miliequivalentes', 'milimoles', 'mililitros', 'milisegundos', 'gramos', 'litros',
]

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** ¿El audio de esta fila dice palabras que no existen? */
function audioCorrupto(ttsText: string): boolean {
  for (const palabra of ttsText.split(/\s+/)) {
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

interface Acumulado {
  filas: number
  /** Cada consulta medida, para la lectura a nivel de MOTOR (una sola función). */
  medidas: ConsultaMedida[]
  werCrudo: number
  werPipeline: number
  terminos: number
  vivosCrudo: number
  vivosPipeline: number
  /**
   * ── LO QUE UN WER NO PUEDE DECIR ────────────────────────────────────────
   *
   * Un WER medio de 3 % puede llevar dentro un «mg» por «mcg». Se cuenta
   * aparte y NO se promedia con nada: la política del Dr. dice que estos
   * errores están prohibidos, no penalizados, y un promedio los deja
   * compensarse con las frases buenas.
   */
  criticos: number
  sinClasificar: number
  frasesConCritico: number
  porClase: Record<string, number>
}

const vacio = (): Acumulado => ({
  filas: 0, werCrudo: 0, werPipeline: 0, terminos: 0, vivosCrudo: 0, vivosPipeline: 0,
  criticos: 0, sinClasificar: 0, frasesConCritico: 0, porClase: {}, medidas: [],
})

function acumular(a: Acumulado, fila: Record<string, string>, transcripcion: string) {
  const ref = fila.canonical_text ?? ''
  const tras = procesarTranscript(transcripcion).texto
  a.filas++
  a.werCrudo += wer(ref, transcripcion)
  a.werPipeline += wer(ref, tras)
  /* La lectura se hace sobre el texto TRAS el pipeline: es el que llega a la
     nota, y por tanto el que puede hacer daño. */
  const lectura = leerConsulta(ref, tras)
  a.medidas.push({ gold: ref, oido: tras })
  a.criticos += lectura.criticos.length
  a.sinClasificar += lectura.sinClasificar.length
  if (lectura.criticos.length > 0) a.frasesConCritico++
  for (const c of lectura.criticos) {
    if (c.clase) a.porClase[c.clase] = (a.porClase[c.clase] ?? 0) + 1
  }

  for (const t of (fila.key_terms ?? '').split('|').filter(Boolean)) {
    if (!evaluable(t, ref)) continue
    a.terminos++
    if (terminoPresente(t, transcripcion).ok) a.vivosCrudo++
    if (terminoPresente(t, tras).ok) a.vivosPipeline++
  }
}

const pct = (n: number, d: number) => d === 0 ? '—' : `${((n / d) * 100).toFixed(2)} %`

function informar(nombre: string, a: Acumulado) {
  console.log(`\n  ── ${nombre} ──`)
  console.log(`  frases medidas .................. ${a.filas}`)
  console.log(`  WER crudo ....................... ${pct(a.werCrudo, a.filas)}`)
  console.log(`  WER tras el pipeline ............ ${pct(a.werPipeline, a.filas)}`)
  console.log(`  términos clínicos evaluados ..... ${a.terminos}`)
  console.log(`  · sobreviven crudos ............. ${pct(a.vivosCrudo, a.terminos)}`)
  console.log(`  · sobreviven tras el pipeline ... ${pct(a.vivosPipeline, a.terminos)}`)
  console.log(`  ERRORES CLÍNICAMENTE PESADOS .... ${a.criticos} en ${a.frasesConCritico} frases`)
  for (const [clase, n] of Object.entries(a.porClase).sort((x, y) => y[1] - x[1])) {
    console.log(`    · ${clase} .................... ${n}`)
  }
  console.log(`  sin clasificar (cuentan igual) .. ${a.sinClasificar}`)
  if (a.criticos > 0) {
    console.log('  ↑ Estos NO se promedian con el WER: están prohibidos, no penalizados.')
  }

  /*
   * LA LECTURA A NIVEL DE MOTOR, por la MISMA función que usa la compuerta.
   *
   * Este guion producía su propio recuento y la compuerta de D-039 el suyo, con
   * el mismo corpus. Dos medidores del mismo número es exactamente el defecto
   * que REG-553 y REG-558 cazaron en el laboratorio, dos veces: el informe podía
   * decir una cosa y la compuerta otra, y nadie lo sabría hasta que divergieran.
   */
  const motor = leerElMotor(a.medidas)
  console.log(`  ── a nivel de MOTOR (lo que mide la compuerta de D-039) ──`)
  console.log(`  error ordinario ................. ${(motor.tasaOrdinaria * 100).toFixed(2)} %`)
  console.log(`  consultas con CRÍTICO ........... ${motor.conCriticos} de ${motor.consultas}`)
  console.log(`  consultas con SIN CLASIFICAR .... ${motor.conSinClasificar} de ${motor.consultas}`)
}

function main() {
  const csv = join(RAIZ, 'MASTER_6000_FRASES_UNICAS.csv')
  if (!existsSync(csv)) { console.error(`No encuentro ${csv}`); process.exit(1) }
  const filas = leerCsv(readFileSync(csv, 'utf8'))

  const dirT = join(RAIZ, 'TRANSCRIPCIONES')
  const motores = existsSync(dirT) ? readdirSync(dirT).filter(d => !d.startsWith('.')) : []
  if (motores.length === 0) { console.error(`No hay transcripciones en ${dirT}`); process.exit(1) }
  const motor = motores[0]
  const dir = join(dirT, motor)

  const todo = vacio(), limpio = vacio()
  let sinTranscripcion = 0, corruptas = 0

  for (const f of filas) {
    const id = f.phrase_id ?? ''
    const ruta = join(dir, `${id}.txt`)
    if (!existsSync(ruta)) { sinTranscripcion++; continue }
    const transcripcion = readFileSync(ruta, 'utf8').trim()

    acumular(todo, f, transcripcion)
    if (audioCorrupto(f.tts_text ?? '')) corruptas++
    else acumular(limpio, f, transcripcion)
  }

  console.log(`\n  MOTOR: ${motor}`)
  console.log(`  filas del corpus: ${filas.length}   ·   sin transcripción: ${sinTranscripcion}`)
  console.log(`  filas con AUDIO CORRUPTO (expansión de unidades): ${corruptas}`)

  informar('TODO EL CORPUS — el número que se venía citando', todo)
  informar('SÓLO AUDIO VÁLIDO — lo que de verdad mide al reconocedor', limpio)

  console.log(`\n  Las ${corruptas} filas excluidas no miden al reconocedor: su audio dice`)
  console.log('  palabras que no existen («microgramos ramos»). Para recuperarlas hay que')
  console.log('  reparar el CSV (scripts/reparar-corpus-expansion.ts) y volver a sintetizar.\n')

  const salida = 'docs/voice/WER-MEDIDO.json'
  writeFileSync(salida, JSON.stringify({
    motor,
    filasCorpus: filas.length,
    sinTranscripcion,
    filasAudioCorrupto: corruptas,
    todoElCorpus: {
      frases: todo.filas,
      werCrudo: todo.werCrudo / todo.filas,
      werPipeline: todo.werPipeline / todo.filas,
      terminos: todo.terminos,
      recallCrudo: todo.vivosCrudo / todo.terminos,
      recallPipeline: todo.vivosPipeline / todo.terminos,
      erroresClinicamentePesados: {
        criticos: todo.criticos, frasesConCritico: todo.frasesConCritico,
        sinClasificar: todo.sinClasificar, porClase: todo.porClase,
      },
    },
    soloAudioValido: {
      frases: limpio.filas,
      werCrudo: limpio.werCrudo / limpio.filas,
      werPipeline: limpio.werPipeline / limpio.filas,
      terminos: limpio.terminos,
      recallCrudo: limpio.vivosCrudo / limpio.terminos,
      recallPipeline: limpio.vivosPipeline / limpio.terminos,
      erroresClinicamentePesados: {
        criticos: limpio.criticos, frasesConCritico: limpio.frasesConCritico,
        sinClasificar: limpio.sinClasificar, porClase: limpio.porClase,
      },
    },
    limites: [
      'Una sola voz sintética (coral): no es una muestra de hablantes reales.',
      'Sin ruido de consultorio, sin solapamiento y sin distancia al micrófono.',
      'Es un PISO de laboratorio, no lo que se verá en una consulta real.',
      'El WER es una media y los errores clínicamente pesados NO entran en ella: van aparte, contados, porque un promedio los deja compensarse con las frases buenas.',
    ],
  }, null, 2) + '\n')
  console.log(`  Escrito: ${salida}\n`)
}

main()
