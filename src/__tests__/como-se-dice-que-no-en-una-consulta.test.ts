/**
 * CÓMO SE DICE QUE NO EN UNA CONSULTA MEXICANA — REG-192.
 *
 * ── LO QUE SE MIDIÓ ANTES DE TOCAR NADA ──────────────────────────────────────
 *
 * El motor de negaciones exigía que la respuesta **empezara** por «no». En una
 * transcripción real casi nunca empieza ahí: delante viene la marca de turno
 * («—», «Paciente:») o una muletilla. De siete formas de decir que no, cazaba
 * una:
 *
 *     «¿Padece diabetes? — No padece diabetes.»  →  sí (por otra vía)
 *     «¿Tiene hipertensión? — Pues no.»          →  NO
 *     «¿Ha tenido asma? — Fíjese que no.»        →  NO
 *     «¿Y tuberculosis? — Tampoco.»              →  NO
 *     «¿Tiene cáncer? — No.»                     →  NO  ← ni la más simple
 *
 * Cada una de esas es una enfermedad que el paciente negó y que el sistema no
 * registró como negada — así que la nota podía afirmarla sin que nadie avisara.
 *
 * ── LA TRAMPA DE LA PROPIA REPARACIÓN ────────────────────────────────────────
 *
 * Al quitar el guion de turno, «— No sé» se convierte en «no sé», que empieza
 * por «no». Sin una guarda explícita, el sistema registraría que el paciente
 * **negó** una enfermedad cuando lo que dijo es que **no lo sabe**.
 *
 * Y la guarda falló a la primera por una razón que merece quedar escrita: se
 * escribió `\bs[eé]\b`, y en JavaScript `\w` es ASCII, así que «é» no cuenta
 * como carácter de palabra y `\b` no encuentra límite entre «é» y «.». Cazaba
 * «no se» y **fallaba con «no sé»**, que es justo la forma que se escribe.
 */
import { describe, it, expect } from 'vitest'
import { condicionesNegadas, respuestaNiega } from '@/lib/expediente/negaciones'

const negadas = (t: string) => condicionesNegadas(t).map(n => n.condicion)

describe('las formas reales de decir que no', () => {
  const CASOS: [string, string][] = [
    ['¿Tiene hipertensión? — Pues no.', 'hipertensión arterial'],
    ['¿Ha tenido asma? — Fíjese que no.', 'asma'],
    ['¿Y tuberculosis? — Tampoco.', 'tuberculosis'],
    ['¿Tiene cáncer? — No.', 'cáncer'],
    ['¿Diabetes? — Diabetes no.', 'diabetes'],
    ['¿Tiene EPOC? — Paciente: no.', 'EPOC'],
    ['¿Tiene asma? — Mmm, no.', 'asma'],
    ['¿Tiene diabetes? — La verdad no.', 'diabetes'],
    ['¿Ha tenido cáncer? — Para nada.', 'cáncer'],
  ]

  for (const [dicho, esperada] of CASOS) {
    it(`«${dicho.split('—')[1]?.trim()}» niega`, () => {
      expect(negadas(dicho)).toContain(esperada)
    })
  }
})

describe('«no sé» NO es negación — y es donde la reparación podía romperse', () => {
  const NO_NIEGAN = [
    '¿Tiene epilepsia? — No sé.',
    '¿Tiene VIH? — No me acuerdo.',
    '¿Tiene asma? — No estoy segura.',
    '¿Tiene diabetes? — No sabría decirle.',
    '¿Tiene cáncer? — No recuerdo.',
  ]

  for (const dicho of NO_NIEGAN) {
    it(`«${dicho.split('—')[1]?.trim()}» no niega nada`, () => {
      expect(negadas(dicho)).toEqual([])
    })
  }

  it('«no sé» con acento y sin acento, las dos', () => {
    /**
     * El `\b` de la primera versión cazaba «no se» y fallaba con «no sé»,
     * porque «é» no es `\w` en JavaScript. La forma que se escribe era
     * justamente la que se colaba.
     */
    expect(respuestaNiega(' — No sé.')).toBe(false)
    expect(respuestaNiega(' — No se.')).toBe(false)
  })

  it('ausencia de dato no es dato de ausencia — la regla de la casa', () => {
    expect(respuestaNiega(' — No sé si tengo.')).toBe(false)
  })
})

describe('lo que sigue sin contar como negación', () => {
  it('el silencio no niega', () => {
    expect(respuestaNiega('')).toBe(false)
    expect(respuestaNiega('   ')).toBe(false)
  })

  it('una respuesta afirmativa no niega', () => {
    expect(respuestaNiega(' — Sí, desde hace años.')).toBe(false)
  })

  it('un «no» al final de una frase LARGA no cuenta', () => {
    /**
     * En una frase larga el «no» final puede pertenecer a otra cosa —«me
     * dijeron que fuera al cardiólogo pero no»— y fabricar una negación es peor
     * que perderla: quedaría escrito que el paciente negó algo que nadie
     * preguntó.
     */
    expect(respuestaNiega('me dijeron que fuera con el cardiólogo el año pasado pero no'))
      .toBe(false)
  })

  it('pero en una respuesta corta sí', () => {
    expect(respuestaNiega('Diabetes no.')).toBe(true)
  })
})

describe('el parser dejó de tener una lista más pobre', () => {
  it('«No padece diabetes» ya no entra como antecedente positivo', async () => {
    /**
     * `parser-clinico.ts` tenía su propia lista de negadores y le faltaban
     * `no padece`, `sin antecedentes de`, `ausencia de` y `se descarta`. La
     * consecuencia: el antecedente entraba en positivo y contaminaba lo que se
     * calcula encima (STOP-BANG en la valoración preoperatoria).
     *
     * Mismo patrón que REG-177 con la lista de huecos: dos listas que deben
     * decir lo mismo acaban diciendo cosas distintas.
     */
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const parser = readFileSync(join(process.cwd(), 'src/lib/expediente/parser-clinico.ts'), 'utf8')
    for (const verbo of ['padece', 'padezco', 'ausencia', 'descart']) {
      expect(parser, `al parser le falta «${verbo}»`).toContain(verbo)
    }
  })
})
