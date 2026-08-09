/**
 * EL LÍMITE DE PALABRA NO ENTIENDE ACENTOS.
 *
 * ── EL MISMO DEFECTO, TRES VECES EN UNA NOCHE ────────────────────────────────
 *
 * En JavaScript `\w` es **ASCII**. La `á`, la `é` y la `ñ` **no cuentan como
 * letra**, así que un `\b` colocado justo detrás de una de ellas no encuentra
 * ningún límite de palabra y **el patrón no dispara**.
 *
 *     /\b(?:no\s+s[eé])\b/      no cazaba «no sé»        → motor de negación
 *     /\b(mamá|papá|…)\b/       no cazaba «mi mamá»      → experienciador
 *     /\b(?:quiz[aá]s?)\b/      no cazaba «quizá»        → certeza
 *
 * Las tres veces el síntoma fue el mismo y es el peor posible: **media función
 * viva y media muerta**. «no sé si» sí, «no sé» no. «mi abuela» sí, «mi mamá»
 * no. «quizas» sí, «quizá» no. Nada revienta, nada avisa, y la mitad que
 * funciona hace creer que funciona entero.
 *
 * Las tres se descubrieron **midiendo contra frases reales**, nunca leyendo el
 * código. Un comentario en cada archivo no bastó: el tercero se escribió con la
 * lección ya escrita dos veces.
 *
 * ── QUÉ HACE ESTA PRUEBA ─────────────────────────────────────────────────────
 *
 * Recorre los motores de lenguaje clínico y **falla si encuentra un `\b`
 * inmediatamente después de una letra acentuada o de una `ñ`**. No es estilo: es
 * la firma exacta de un patrón que no dispara.
 *
 * La alternativa correcta —y la que usan ya los tres— es `(?![\p{L}])`, que sí
 * entiende Unicode.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = process.cwd()

/**
 * Los motores que leen español hablado. La lista es explícita: un guardián que
 * barriera `src/lib` entero cazaría regex de rutas, de correos y de versiones,
 * donde el acento no juega y el ruido acabaría desactivándolo.
 */
const MOTORES_DE_LENGUAJE = [
  'src/lib/expediente/negaciones.ts',
  'src/lib/expediente/temporalidad.ts',
  'src/lib/expediente/experienciador.ts',
  'src/lib/expediente/certeza.ts',
  'src/lib/expediente/hueco-textual.ts',
  'src/lib/asr/normalizacion.ts',
] as const

const ACENTOS = 'áéíóúüñÁÉÍÓÚÜÑ'

/** Un literal de expresión regular, aproximado pero suficiente. */
const LITERAL = /\/(?:[^/\\\n[]|\\.|\[[^\]\n]*\])+\/[a-z]*/g

/**
 * El `\b` que cierra algo que **puede terminar en letra acentuada**: un grupo
 * `)`, una clase `]`, o un cuantificador `?*+` detrás de cualquiera de ellos.
 *
 * ── POR QUÉ SE MARCA EL LITERAL ENTERO Y NO SÓLO EL ACENTO PEGADO AL `\b` ────
 *
 * Porque el caso que más costó no tiene el acento pegado: en
 * `/\b(?:quiz[aá]s?)\b/` el acento está dentro de la clase y el `\b` cierra el
 * grupo tres caracteres después. Mirar sólo el carácter anterior lo dejaba pasar.
 *
 * La regla marca de más —un patrón con acento en una rama y `\b` cerrando otra
 * que acaba en consonante es inofensivo— y eso está aceptado a propósito: en un
 * motor de español hablado, `(?![\p{L}])` es correcto siempre, así que exigirlo
 * de forma uniforme no cuesta nada y elimina la clase entera de fallo.
 */
const CIERRE_RIESGOSO = new RegExp(`[)\\]?*+${ACENTOS}]\\\\b`, 'u')

/** ¿Este literal mezcla acentos con un `\b` de cierre? */
function esRiesgoso(literal: string): boolean {
  const tieneAcento = [...ACENTOS].some(c => literal.includes(c))
  return tieneAcento && CIERRE_RIESGOSO.test(literal)
}

/** Quita comentarios: el ejemplo de un comentario no es un patrón que corra. */
function soloCodigo(src: string): string {
  return src
    .split('\n')
    .filter(l => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
}

describe('el límite de palabra no entiende acentos', () => {
  it('la lista de motores existe de verdad', () => {
    // Sin esto, renombrar un motor apagaría el guardián en silencio — que es el
    // mismo modo de fallo que persigue.
    for (const f of MOTORES_DE_LENGUAJE) {
      expect(() => readFileSync(join(RAIZ, f), 'utf8'), `falta ${f}`).not.toThrow()
    }
  })

  it.each(MOTORES_DE_LENGUAJE)('%s no cierra con \\b detrás de un acento', archivo => {
    const codigo = soloCodigo(readFileSync(join(RAIZ, archivo), 'utf8'))
    const culpables = (codigo.match(LITERAL) ?? [])
      .filter(esRiesgoso)
      .map(r => `${archivo} → ${r.slice(0, 90)}`)

    expect(
      culpables,
      `\\b detrás de un acento (usa (?![\\p{L}]) en su lugar):\n  ${culpables.join('\n  ')}`,
    ).toEqual([])
  })

  it('el guardián sí detecta el patrón malo (si no, no probaría nada)', () => {
    /**
     * Las tres formas reales que costaron. Si la detección se afloja, esta
     * prueba se pone roja antes de que el guardián quede apagado sin que nadie
     * lo note — el fallo que ya cometió el lector de dependencias.
     */
    const malos = [
      String.raw`/\b(?:quiz[aá]s?)\b/iu`,
      String.raw`const X = /(mamá|papá)\b/iu`,
      String.raw`/\bno\s+s[eé]\b/iu`,
    ]
    for (const m of malos) {
      const cazado = (m.match(LITERAL) ?? []).some(esRiesgoso)
      expect(cazado, `dejó de cazar: ${m}`).toBe(true)
    }
  })

  it('no marca la forma correcta', () => {
    const buenos = [
      String.raw`/\b(?:quiz[aá]s?)(?![\p{L}])/iu`,
      String.raw`/(mamá|papá)(?![\p{L}])/iu`,
      String.raw`/\bpaciente\b/iu`,
    ]
    for (const b of buenos) {
      const cazado = (b.match(LITERAL) ?? []).some(esRiesgoso)
      expect(cazado, `falso positivo: ${b}`).toBe(false)
    }
  })
})
