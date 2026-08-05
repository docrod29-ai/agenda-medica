/**
 * REPARA LA EXPANSIÓN DE UNIDADES DEL CORPUS — la mitad que quedó viva.
 *
 * ── LO QUE YA SE SABÍA, Y LO QUE SE NOS PASÓ ─────────────────────────────────
 *
 * El propio corpus trae un script (`2_REGENERAR_391_CORREGIDOS.command`) que
 * diagnosticó esto **correctamente**:
 *
 *     «La expansión g → gramos corrió DESPUÉS de que mg y mcg ya se habían
 *      expandido, y SIN LÍMITE DE PALABRA: pegó en la g que quedó dentro de la
 *      palabra ya expandida.»
 *
 * Y reparó **391 filas**: las que decían «microgramosramos», «miligramosramos».
 *
 * El diagnóstico era bueno y la reparación se quedó corta. Porque una expansión
 * sin límite de palabra no sólo pega en las unidades ya expandidas: **pega en
 * cualquier palabra que lleve una “g” dentro**.
 *
 *     guiada    → gramosuiada          agua      → agramosua
 *     Ingresos  → Ingramosresos        segundo   → segramosundo
 *     magnesio  → magramosnesio        higiene   → higramosiene
 *     Hemoglobina → Hemogramoslobina   fibrinógeno → fibrinógramoseno
 *
 * **1 380 filas de 6 000 — el 23 %.** Se buscó donde dolía la métrica de
 * unidades, no donde estaba el defecto.
 *
 * ── POR QUÉ IMPORTA ──────────────────────────────────────────────────────────
 *
 * El audio dice una palabra que no existe y el texto de referencia espera la
 * correcta. Medido así, el reconocedor sale reprobado **por un defecto del
 * corpus, no suyo** — y con él, cualquier decisión que se tome mirando ese
 * número.
 *
 * ── CÓMO REPARA, Y POR QUÉ NO A CIEGAS ───────────────────────────────────────
 *
 * La corrupción es determinista: donde había una letra, quedó la palabra de la
 * unidad. Así que se deshace al revés — pero **cada reparación se verifica
 * contra el `canonical_text`**, que sí está bien: si la palabra reparada no
 * aparece en la referencia (o su raíz), no se aplica y se lista aparte.
 *
 * Reparar a ciegas un corpus de evaluación es cambiar la vara de medir sin
 * mirar. Lo que no se puede verificar, no se toca.
 *
 * Uso:
 *   npx tsx scripts/reparar-corpus-expansion.ts <corpus.csv> [--escribir]
 *
 * Sin `--escribir` sólo informa. Nada se sobrescribe: la salida va a un archivo
 * nuevo, `*_REPARADO.csv`.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const RUTA = process.argv[2]
const ESCRIBIR = process.argv.includes('--escribir')

if (!RUTA || !existsSync(RUTA)) {
  console.error('Uso: npx tsx scripts/reparar-corpus-expansion.ts <corpus.csv> [--escribir]')
  process.exit(1)
}

/**
 * Qué palabra de unidad sustituyó a qué letra o letras.
 *
 * El orden importa y es el inverso al del daño: primero las expansiones largas
 * («microgramos») y luego las cortas («gramos»), porque «microgramos» contiene
 * «gramos» y deshacerlo al revés dejaría basura.
 */
const EXPANSIONES: { palabra: string; original: string }[] = [
  { palabra: 'microgramos', original: 'mcg' },
  { palabra: 'miligramos', original: 'mg' },
  { palabra: 'picogramos', original: 'pg' },
  { palabra: 'nanogramos', original: 'ng' },
  { palabra: 'kilogramos', original: 'kg' },
  { palabra: 'miliequivalentes', original: 'mEq' },
  { palabra: 'milimoles', original: 'mmol' },
  { palabra: 'mililitros', original: 'mL' },
  { palabra: 'milisegundos', original: 'ms' },
  { palabra: 'gramos', original: 'g' },
  { palabra: 'litros', original: 'L' },
]

const sinAcentos = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * PALABRAS QUE SÓLO EXISTEN EN EL HABLA, con el símbolo que las produce.
 *
 * Al leer en voz alta aparecen palabras que **nunca** están en el texto escrito:
 * «cmH2O» se dice «centímetros de agua», y por eso «agua» no se puede verificar
 * contra la referencia aunque la reparación sea obviamente correcta.
 *
 * En vez de aflojar la verificación —que es lo que la hace valer— se declara la
 * pareja: la palabra se acepta **sólo si el símbolo que la produce está en la
 * referencia**. Cada fila es una regla que se puede discutir; una verificación
 * relajada, no.
 */
const SOLO_EN_EL_HABLA: { palabra: string; exigeEnLaReferencia: RegExp }[] = [
  { palabra: 'agua', exigeEnLaReferencia: /h2o/i },
  { palabra: 'grado', exigeEnLaReferencia: /°|grado/i },
  { palabra: 'grados', exigeEnLaReferencia: /°|grado/i },
]

/** Lee el CSV respetando comillas. */
function leerCsv(texto: string): { cab: string[]; filas: string[][] } {
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
  return { cab: filas.shift()!, filas }
}

const escapar = (s: string) => /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s

/**
 * ¿Esta palabra trae una unidad expandida DENTRO, o sea pegada a más letras?
 *
 * Una unidad legítima va sola («cada ocho horas, dos gramos»). Una unidad con
 * letras pegadas antes o después es siempre daño.
 */
function estaRota(palabra: string): boolean {
  const p = sinAcentos(palabra)
  return EXPANSIONES.some(e => {
    const u = sinAcentos(e.palabra)
    const i = p.indexOf(u)
    if (i < 0) return false
    const antes = i > 0
    const despues = i + u.length < p.length
    return antes || despues
  })
}

/** Deshace la expansión y devuelve los candidatos, del más largo al más corto. */
function candidatos(palabra: string): string[] {
  const out: string[] = []
  for (const e of EXPANSIONES) {
    const re = new RegExp(e.palabra, 'gi')
    if (!re.test(palabra)) continue
    out.push(palabra.replace(new RegExp(e.palabra, 'gi'), e.original))
  }
  return [...new Set(out)]
}

function main() {
  const { cab, filas } = leerCsv(readFileSync(RUTA, 'utf8'))
  const iCanon = cab.indexOf('canonical_text')
  const iTts = cab.indexOf('tts_text')
  const iId = cab.indexOf('phrase_id')
  if (iCanon < 0 || iTts < 0) {
    console.error('El CSV no trae canonical_text y tts_text.')
    process.exit(1)
  }

  let afectadas = 0, reparadas = 0
  const sinVerificar: string[] = []
  const muestra: string[] = []

  for (const f of filas) {
    const tts = f[iTts] ?? ''
    const canon = sinAcentos(f[iCanon] ?? '')
    if (!tts) continue

    const palabras = tts.split(/(\s+)/)
    let tocada = false, algoSinVerificar = false

    for (let i = 0; i < palabras.length; i++) {
      const w = palabras[i]
      if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(w) || !estaRota(w)) continue

      const limpia = w.replace(/[.,;:()¿?¡!]/g, '')
      let elegido: string | null = null
      for (const c of candidatos(limpia)) {
        /**
         * LA VERIFICACIÓN. La palabra reparada tiene que existir en el texto de
         * referencia — o su raíz, porque la forma hablada conjuga distinto
         * («0.03» en la referencia, «cero punto cero tres» en el habla).
         */
        const cn = sinAcentos(c)
        if (canon.includes(cn) || (cn.length >= 5 && canon.includes(cn.slice(0, -1)))) { elegido = c; break }
        // Segunda fuente: las palabras que sólo existen al leer en voz alta.
        const habla = SOLO_EN_EL_HABLA.find(h => sinAcentos(h.palabra) === cn)
        if (habla && habla.exigeEnLaReferencia.test(f[iCanon] ?? '')) { elegido = c; break }
      }

      if (elegido) {
        if (muestra.length < 12) muestra.push(`  ${f[iId]}  ${limpia} → ${elegido}`)
        palabras[i] = w.replace(limpia, elegido)
        tocada = true
      } else {
        algoSinVerificar = true
        if (sinVerificar.length < 40) sinVerificar.push(`  ${f[iId]}  «${limpia}»  ref: ${(f[iCanon] ?? '').slice(0, 60)}`)
      }
    }

    if (tocada || algoSinVerificar) afectadas++
    if (tocada) { f[iTts] = palabras.join(''); reparadas++ }
  }

  console.log(`\n  filas con expansión rota .......... ${afectadas}`)
  console.log(`  filas reparadas y VERIFICADAS ..... ${reparadas}`)
  console.log(`  palabras que no se pudieron verificar (NO se tocaron): ${sinVerificar.length >= 40 ? '40+' : sinVerificar.length}`)
  if (muestra.length) { console.log('\n  ── muestra de lo reparado ──'); console.log(muestra.join('\n')) }
  if (sinVerificar.length) { console.log('\n  ── sin verificar, para revisión a mano ──'); console.log(sinVerificar.slice(0, 12).join('\n')) }

  if (ESCRIBIR) {
    const destino = RUTA.replace(/\.csv$/, '_REPARADO.csv')
    writeFileSync(destino, [cab, ...filas].map(f => f.map(escapar).join(',')).join('\n') + '\n')
    console.log(`\n  Escrito: ${destino}`)
    console.log('  El original NO se tocó. Compara antes de regenerar audio.\n')
  } else {
    console.log('\n  (informe solamente — añade --escribir para generar el CSV reparado)\n')
  }
}

main()

/**
 * ── EL PARCHE DEL GENERADOR ──────────────────────────────────────────────────
 *
 * Reparar el CSV arregla lo de ayer. Para que no vuelva a pasar, la expansión
 * del generador tiene que cumplir dos reglas:
 *
 * 1. **Con límite de palabra.** `\bg\b` y no `g`. Es la causa raíz literal.
 * 2. **De la más larga a la más corta, y en UNA sola pasada.** Si «mcg» se
 *    expande primero y luego se corre «g» sobre el resultado, la «g» de
 *    «microgramos» vuelve a caer. Se reemplaza con una única expresión
 *    alternada, que consume cada unidad una vez y no revisita lo ya escrito.
 * 3. **Sólo junto a una cifra.** Una «g» suelta en medio de una frase no es una
 *    unidad. `(?<=\d\s?)` evita expandir lo que no es dosis.
 *
 * En JavaScript:
 *
 *     const UNIDADES = [
 *       ['mcg', 'microgramos'], ['mg', 'miligramos'], ['pg', 'picogramos'],
 *       ['ng', 'nanogramos'], ['kg', 'kilogramos'], ['mEq', 'miliequivalentes'],
 *       ['mmol', 'milimoles'], ['mL', 'mililitros'], ['ms', 'milisegundos'],
 *       ['g', 'gramos'], ['L', 'litros'],
 *     ]  // ← ordenadas de la más larga a la más corta
 *
 *     const RE = new RegExp(`(?<=\\d\\s?)\\b(${UNIDADES.map(u => u[0]).join('|')})\\b`, 'g')
 *     const hablado = escrito.replace(RE, m => tabla.get(m) ?? m)
 *
 * Una sola pasada, con frontera de palabra y sólo detrás de una cifra. Las tres
 * reglas juntas: quitar cualquiera de ellas reproduce el defecto.
 */
