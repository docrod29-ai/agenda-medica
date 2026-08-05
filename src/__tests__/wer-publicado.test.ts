/**
 * GUARDIÁN — el WER que se publica no puede desviarse de lo que se midió.
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────
 *
 * La primera medición de los 6 000 audios dio 38,20 % y no se pudo publicar: el
 * 35,6 % de los fallos venían del propio corpus, cuyo generador expandió las
 * unidades sin límite de palabra y grabó frases que no existen («microgramos
 * ramos»). Medido así, el reconocedor salía reprobado por un defecto ajeno.
 *
 * Ya está medido separando las dos cosas. Este guardián no vuelve a medir —eso
 * exige el corpus, que vive en el disco del dueño y no está en CI— sino que
 * vigila lo único que puede desviarse en silencio: **que el documento público y
 * los datos crudos digan lo mismo, y que los límites no se caigan del texto**.
 *
 * Un número de laboratorio sin sus límites al lado se convierte en una promesa
 * comercial en cuanto alguien lo copia a una diapositiva.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const RUTA_JSON = 'docs/voice/WER-MEDIDO.json'
const RUTA_MD = 'docs/voice/WER-MEDIDO.md'

const json = JSON.parse(readFileSync(join(process.cwd(), RUTA_JSON), 'utf8'))
const md = readFileSync(join(process.cwd(), RUTA_MD), 'utf8')

describe('LA MEDICIÓN EXISTE Y ES REPRODUCIBLE', () => {
  it('el script que la produce está en el repositorio', () => {
    // Un número sin la herramienta que lo genera no se puede volver a comprobar.
    expect(existsSync(join(process.cwd(), 'scripts/medir-wer-limpio.ts'))).toBe(true)
    expect(md).toContain('npx tsx scripts/medir-wer-limpio.ts')
  })

  it('y no cuesta nada repetirla: reutiliza transcripciones ya pagadas', () => {
    expect(md).toMatch(/no llama a ningún proveedor/i)
  })
})

describe('SE PUBLICAN LOS DOS NÚMEROS, NO EL QUE CONVIENE', () => {
  it('el del corpus entero y el del audio válido', () => {
    expect(json.todoElCorpus.werCrudo).toBeGreaterThan(0)
    expect(json.soloAudioValido.werCrudo).toBeGreaterThan(0)
    expect(md).toContain('Todo el corpus')
    expect(md).toContain('Sólo audio válido')
  })

  it('y se dice cuántas filas se excluyeron y por qué', () => {
    /**
     * Excluir sin declarar el tamaño de lo excluido es lo que convierte una
     * medición honesta en una cifra elegida.
     */
    expect(json.filasAudioCorrupto).toBeGreaterThan(0)
    /**
     * El documento escribe los miles con separador («1 364»), como el resto de
     * la prosa en español. Se comparan los dígitos, no la tipografía.
     */
    const soloDigitos = md.replace(/(\d)[\s\u00a0\u202f](\d)/g, '$1$2')
    expect(soloDigitos).toContain(String(json.filasAudioCorrupto))
    expect(md).toMatch(/microgramos ramos/)
  })

  it('las cifras del documento coinciden con los datos crudos', () => {
    const comoTexto = (x: number) => (x * 100).toFixed(2).replace('.', ',')
    expect(md).toContain(comoTexto(json.soloAudioValido.werCrudo))
    expect(md).toContain(comoTexto(json.soloAudioValido.werPipeline))
    expect(md).toContain(comoTexto(json.todoElCorpus.werCrudo))
  })
})

describe('LOS LÍMITES VIAJAN CON EL NÚMERO', () => {
  it('una sola voz sintética, sin ruido ni solapamiento', () => {
    expect(json.limites.length).toBeGreaterThanOrEqual(3)
    expect(md).toMatch(/una sola voz sintética/i)
    expect(md).toMatch(/sin ruido/i)
  })

  it('y se declara que es un PISO, no lo que se verá en consulta', () => {
    /**
     * Es la línea que impide que esto se cite como «precisión de NexusMED».
     */
    expect(md).toMatch(/piso de laboratorio/i)
    expect(md).toMatch(/en consulta real será peor/i)
  })
})

describe('EL HALLAZGO QUE MÁS IMPORTA QUEDA DICHO', () => {
  it('el pipeline casi no mueve el recall de términos clínicos', () => {
    /**
     * +0,13 pp. Es el dato que señala dónde está la palanca real —el sesgo de
     * vocabulario, que cambia lo que el motor OYE— y no en más post-proceso.
     * Si alguien sube estos números, esta conclusión hay que revisarla, no
     * borrarla.
     */
    const delta = json.soloAudioValido.recallPipeline - json.soloAudioValido.recallCrudo
    expect(delta).toBeLessThan(0.02)
    expect(md).toMatch(/no recupera el\s*\n?\s*término clínico que el motor no oyó/)
  })
})
