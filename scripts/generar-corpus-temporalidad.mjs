/**
 * Genera `fixtures/temporalidad/corpus-oro.csv` — la vara para el motor que
 * decide si el dictado puso un padecimiento en PASADO o en PRESENTE.
 *
 * ── POR QUÉ EXISTE (EVAL-002) ────────────────────────────────────────────────
 *
 * El motor de temporalidad se construyó en v1027-v1030 y salió **sin corpus**:
 * sus únicos casos eran los que escribió quien lo escribió. Una defensa sin
 * medición no se sabe si protege o estorba — y ésta puede degradar un
 * diagnóstico activo a antecedente si se equivoca, o gastar el aviso en la forma
 * más común de contar un padecimiento crónico si se pasa de celosa.
 *
 * ── POR QUÉ SE GENERA Y NO SE ESCRIBE A MANO ─────────────────────────────────
 *
 * Ésta es la trampa que EVAL-002 denuncia, y escribir 400 frases a mano la
 * repetiría más grande: uno elige, sin querer, los ejemplos que ya pasan. Aquí
 * el corpus es el **producto cruzado** de dos listas declaradas —marcos
 * temporales × padecimientos—, así que ninguna combinación se cae por gusto.
 *
 * Y la etiqueta la pone el MARCO, por gramática española, **antes** de que el
 * motor conteste nada. El corpus no puede estar de acuerdo con el motor por
 * construcción: si no coinciden, el que se corrige es el motor o la etiqueta,
 * y esa discusión queda escrita.
 *
 * ── DATOS ────────────────────────────────────────────────────────────────────
 *
 * Cien por ciento SINTÉTICO. Ningún paciente, ninguna consulta, ninguna
 * transcripción real: son plantillas y nombres de padecimiento. Por eso puede
 * vivir en el repositorio y correr en CI, que es justo lo que le faltaba al
 * corpus de voz hasta REG-145.
 *
 * ── EL VOCABULARIO SE LEE DEL MOTOR, NO SE REDECLARA ──────────────────────────
 *
 * Redeclararlo era cómo se desincronizaba (REG-191). Se lee el TEXTO de
 * `temporalidad.ts` y se extraen las formas canónicas, igual que hace
 * `generar-sellos-motores.mjs` con el registro: importar un `.ts` desde Node
 * ataría la generación a la cadena de build.
 *
 * Uso:  node scripts/generar-corpus-temporalidad.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const RAIZ = process.cwd()
const MOTOR = resolve(RAIZ, 'src/lib/expediente/temporalidad.ts')
const DESTINO = resolve(RAIZ, 'fixtures/temporalidad/corpus-oro.csv')

/**
 * Padecimientos AGUDOS, leídos del motor. Son los que más se cuentan en pasado
 * —una neumonía, una fractura, una cirugía— y por eso son el caso difícil.
 */
const texto = readFileSync(MOTOR, 'utf8')
const bloque = texto.match(/AGUDAS_FRECUENTES[^=]*=\s*\[([\s\S]*?)\n\]/)
if (!bloque) {
  // Fallar aquí es correcto: un corpus vacío mediría cero y pasaría en verde.
  console.error('[corpus-temporalidad] no se encontró AGUDAS_FRECUENTES en el motor')
  process.exit(1)
}
const AGUDAS = [...bloque[1].matchAll(/canonica:\s*'((?:[^'\\]|\\.)*)'/g)].map(m => m[1])

/**
 * Padecimientos CRÓNICOS. Se nombran aquí y no se leen de `negaciones.ts`
 * porque de esa lista sólo hacen falta cuatro como relleno del marco: lo que
 * este corpus mide es el MARCO, no la cobertura del vocabulario — eso lo
 * comprueba el trinquete aparte.
 *
 * Los cuatro se eligen de los que el motor SÍ vigila, comprobado con el propio
 * trinquete: al probar con «artritis» —que no está en `CRONICAS`— las 31 filas
 * salieron ciegas. No es un fallo de temporalidad y no debe contaminar la
 * medición del marco; que «artritis» no se vigile es un hueco de vocabulario y
 * se declara en el ledger, no se tapa metiéndolo aquí.
 */
const CRONICOS = ['diabetes', 'hipertensión', 'asma', 'epilepsia']

const PADECIMIENTOS = [...AGUDAS, ...CRONICOS]

/**
 * MARCOS EN PASADO — el verbo que gobierna al padecimiento está en pretérito o
 * copretérito, o la frase declara que el cuadro terminó.
 *
 * `{P}` es el hueco del padecimiento.
 */
const MARCOS_PASADO = [
  ['tuvo {P} hace tres años', 'pretérito + marca de cuándo'],
  ['tuvo {P} hace años', 'pretérito + marca sin cuantificador'],
  ['tenía {P} cuando era joven', 'copretérito'],
  ['padeció {P} en 2019', 'pretérito + año'],
  ['sufrió {P} hace dos meses', 'pretérito + meses'],
  ['presentó {P} en 2020', 'pretérito + año'],
  ['anteriormente tuvo {P}', 'adverbio de anterioridad'],
  ['en el pasado tuvo {P}', 'locución de pasado'],
  ['tuvo {P} de niño', 'marca de etapa'],
  ['el año pasado tuvo {P}', 'pretérito + año pasado'],
  ['presentó {P} meses atrás', 'pretérito + atrás'],
  ['hace tres años que tuvo {P}', 'hace…que + PRETÉRITO — el verbo manda'],
  ['ya se curó de {P}', 'resolución sin «le»'],
  ['se recuperó de {P}', 'resolución'],
  ['ya se le quitó {P}', 'resolución con «le»'],
]

/**
 * MARCOS EN PRESENTE — el padecimiento sigue activo. Varios traen una marca de
 * tiempo («hace tres años») que NO lo vuelve pasado: es la trampa que este
 * motor tiene declarada desde que se escribió, y la mitad de estos marcos
 * existen para vigilarla.
 */
const MARCOS_PRESENTE = [
  ['desde hace tres años tiene {P}', 'desde hace + presente'],
  ['tiene {P} desde 2019', 'desde + año'],
  ['sigue con {P}', 'continuidad explícita'],
  ['continúa con {P}', 'continuidad explícita'],
  ['todavía tiene {P}', 'adverbio de continuidad'],
  ['actualmente cursa con {P}', 'adverbio de actualidad'],
  ['está en tratamiento por {P}', 'tratamiento en curso'],
  ['está en control por {P}', 'control en curso'],
  ['tiene {P}', 'presente pelado, sin marca'],
  ['persiste {P}', 'persistencia'],
  ['aún presenta {P}', 'adverbio de continuidad'],
  ['hace tres años que tiene {P}', 'hace…que + PRESENTE — la trampa'],
  ['hace tres años que padece {P}', 'hace…que + PRESENTE'],
  ['tiene {P} hace tres años', 'presente + marca detrás — la trampa'],
  ['padece {P} hace diez años', 'presente + marca detrás'],
  ['hace años que vive con {P}', 'hace…que + presente sin cuantificador'],
]

const filas = [['id', 'frase', 'etiqueta', 'familia', 'padecimiento'].join(',')]
let n = 0
for (const [etiqueta, marcos] of [['pasado', MARCOS_PASADO], ['presente', MARCOS_PRESENTE]]) {
  for (const [marco, familia] of marcos) {
    for (const p of PADECIMIENTOS) {
      const frase = marco.replace('{P}', p)
      // Comillas por si un padecimiento trae coma («COVID-19» no, pero la lista crece).
      filas.push([`T${String(++n).padStart(4, '0')}`, `"${frase}"`, etiqueta, `"${familia}"`, `"${p}"`].join(','))
    }
  }
}

mkdirSync(resolve(RAIZ, 'fixtures/temporalidad'), { recursive: true })
writeFileSync(DESTINO, filas.join('\n') + '\n', 'utf8')
console.log(`[corpus-temporalidad] ${n} frases → fixtures/temporalidad/corpus-oro.csv`)
console.log(`  ${MARCOS_PASADO.length} marcos en pasado · ${MARCOS_PRESENTE.length} en presente · ${PADECIMIENTOS.length} padecimientos`)
