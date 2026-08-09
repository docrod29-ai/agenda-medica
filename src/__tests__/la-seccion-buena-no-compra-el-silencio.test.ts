/**
 * GOLDEN — la sección bien escrita le compraba el silencio a la mal escrita.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Los dos motores que contrastan el dictado contra la nota —el de negaciones
 * (REG-153) y el de temporalidad (v1027-v1030)— buscaban el término con
 * `t.indexOf(forma)`: **la primera aparición y sólo ésa**. Si esa primera venía
 * escudada («niega diabetes», «antecedente de neumonía»), la condición se
 * descartaba entera y el resto de la nota no se miraba nunca.
 *
 * Que es exactamente la forma de una nota bien estructurada:
 *
 *     Antecedentes personales patológicos: neumonía en 2019, manejada de
 *     forma ambulatoria con amoxicilina durante siete días.
 *     Impresión diagnóstica: neumonía adquirida en la comunidad.
 *
 * Arriba está bien. Abajo está el defecto. Y el sistema callaba porque el bueno
 * iba primero.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Leyendo `desajustesTemporales` en la iteración del 8-ago-2026, buscando por
 * qué el motor «no tiene corpus» del backlog (EVAL-002). Reproducido antes de
 * tocar nada con los motores reales: las dos notas de abajo devolvían `[]`.
 *
 * ── POR QUÉ IMPORTA PARA UN PACIENTE ────────────────────────────────────────
 *
 * El reparto es el peor posible: **la mención que se callaba es la que manda**.
 * Un antecedente no cambia la conducta de hoy; una impresión diagnóstica sí — y
 * es la que se arrastra a la nota siguiente y la que otro médico lee dentro de
 * seis meses. El paciente que negó la diabetes salía con diabetes escrita, y el
 * único motor que podía cazarlo ya se había dado por satisfecho renglones antes.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Se recorren todas las apariciones de todas las formas y se avisa de la primera
 * que no traiga escudo delante. La ventana de 60 caracteres NO cambia: cada
 * aparición se juzga con el mismo criterio que antes, así que esto sólo puede
 * señalar **de más de lo que señalaba**, nunca marcar como afirmada una mención
 * que antes se consideraba bien escrita.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **La ventana sigue cruzando el punto.** «Niega diabetes.» al final de una
 *   oración escuda a la palabra que aparece en los primeros 60 caracteres de la
 *   siguiente. Es un escudo prestado y hoy sigue vivo; acotarlo a la oración
 *   rompería la nota con encabezado de sección («Antecedentes:\nNeumonía…»), que
 *   es igual de común. Queda medido y anotado en el backlog como TEMP-001, no
 *   reparado a ojo.
 * · **Un aviso por condición**, no uno por aparición: si la nota la afirma tres
 *   veces se avisa una vez. Es deliberado — la fatiga de alerta cuesta más que
 *   la precisión del conteo.
 * · Nada de esto amplía el vocabulario: lo que no está en `CRONICAS` ni en
 *   `AGUDAS_FRECUENTES` sigue sin vigilarse, y así está declarado allí.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { condicionesNegadas, contradicciones } from '@/lib/expediente/negaciones'
import { mencionesEnPasado, desajustesTemporales } from '@/lib/expediente/temporalidad'
import {
  primeraMencionSinEscudo, VENTANA_DEL_ESCUDO, POR_QUE_TODAS_LAS_APARICIONES,
} from '@/lib/expediente/mencion-en-la-nota'

/** La nota estructurada como la escribe el médico: antecedentes arriba, juicio abajo. */
const NOTA_TEMPORAL = [
  'Antecedentes personales patológicos: neumonía en 2019, manejada de forma ambulatoria con amoxicilina durante siete días.',
  'Impresión diagnóstica: neumonía adquirida en la comunidad. Se inicia tratamiento antibiótico.',
].join('\n')

const NOTA_NEGADA = [
  'Interrogatorio por aparatos: niega hipertensión, diabetes y tabaquismo. Refiere buen apetito y sueño conservado.',
  'Impresión diagnóstica: hipertensión arterial sistémica de reciente diagnóstico, se inicia losartán.',
].join('\n')

describe('EL CASO QUE LO MOTIVA', () => {
  it('temporalidad: el antecedente correcto ya no tapa el diagnóstico actual', () => {
    const d = desajustesTemporales(mencionesEnPasado('Tuvo neumonía hace tres años.'), NOTA_TEMPORAL)
    expect(d.map(x => x.condicion)).toEqual(['neumonía'])
    // La cita tiene que ser la de ABAJO: es la que el médico debe mirar.
    expect(d[0].enLaNota).toContain('Impresión diagnóstica')
  })

  it('negaciones: «niega hipertensión» arriba ya no tapa el diagnóstico de abajo', () => {
    const c = contradicciones(
      condicionesNegadas('¿Enfermedades crónicas como presión alta? No.'),
      NOTA_NEGADA,
    )
    expect(c.map(x => x.condicion)).toEqual(['hipertensión arterial'])
    expect(c[0].enLaNota).toContain('Impresión diagnóstica')
  })
})

describe('LO QUE NO PUEDE ROMPERSE — la nota bien escrita sigue en silencio', () => {
  it('si TODAS las apariciones vienen escudadas, no hay aviso', () => {
    const nota = [
      'Antecedentes personales patológicos: neumonía en 2019, resuelta sin secuelas.',
      'Se comenta con el paciente su antecedente de neumonía y la vacunación antineumocócica.',
    ].join('\n')
    expect(desajustesTemporales(mencionesEnPasado('Tuvo neumonía hace tres años.'), nota)).toEqual([])
  })

  it('una negación bien escrita en toda la nota tampoco avisa', () => {
    const nota = 'Interrogatorio: niega diabetes. Se insiste: el paciente no tiene diabetes conocida.'
    expect(contradicciones(condicionesNegadas('¿Tiene diabetes? No.'), nota)).toEqual([])
  })

  it('un aviso por condición aunque la nota la afirme tres veces', () => {
    const nota = 'Diabetes descompensada. Ajuste por diabetes. Educación en diabetes.'
    const c = contradicciones(condicionesNegadas('¿Tiene diabetes? No.'), nota)
    expect(c.length).toBe(1)
  })
})

describe('EL AYUDANTE, DIRECTO', () => {
  const ESCUDO = /\bniega\b/i

  it('devuelve la primera aparición sin escudo, no la primera aparición', () => {
    /**
     * El relleno del medio no es adorno: la ventana de 60 caracteres cruza el
     * punto, así que un «niega» pegado a la oración anterior todavía escuda. Es
     * el límite declarado en la cabecera (TEMP-001) y esta prueba lo respeta en
     * vez de fingir que no existe.
     */
    const texto = 'niega asma. Refiere buen apetito, sueño conservado y actividad '
      + 'física habitual diaria. El asma está descompensada hoy.'
    const m = primeraMencionSinEscudo(texto, ['asma'], ESCUDO)
    expect(m?.idx).toBe(texto.lastIndexOf('asma'))
  })

  it('null cuando el término no aparece', () => {
    expect(primeraMencionSinEscudo('Nada que ver aquí.', ['asma'], ESCUDO)).toBeNull()
  })

  it('null cuando todas las apariciones vienen escudadas', () => {
    expect(primeraMencionSinEscudo('niega asma, niega asma otra vez.', ['asma'], ESCUDO)).toBeNull()
  })

  it('las formas con y sin acento no cuentan como dos apariciones distintas', () => {
    // «hipertensión» y «hipertension» caen en el MISMO índice del texto
    // normalizado: si se contaran dos veces, el aviso saldría duplicado.
    const m = primeraMencionSinEscudo('Hipertensión arterial.', ['hipertensión', 'hipertension'], ESCUDO)
    expect(m?.idx).toBe(0)
  })

  it('la cita se devuelve CON acentos, no normalizada', () => {
    const m = primeraMencionSinEscudo('Impresión: neumonía adquirida.', ['neumonia'], ESCUDO)
    expect(m?.cita).toContain('neumonía')
  })

  it('formas vacías no hacen que todo el texto sea una aparición', () => {
    // `''` está en todos los índices: sin la guarda, cualquier condición con una
    // forma vacía avisaría siempre, en el carácter 0.
    expect(primeraMencionSinEscudo('Texto cualquiera.', [''], ESCUDO)).toBeNull()
  })

  it('la ventana del escudo se declara UNA vez y sigue siendo la de las negaciones', () => {
    expect(VENTANA_DEL_ESCUDO).toBe(60)
  })
})

describe('LOS DOS MOTORES COMPARTEN EL CRITERIO', () => {
  it('ninguno de los dos vuelve a tener su propio indexOf sobre la nota', () => {
    // Era literalmente la misma línea copiada, y por eso se reparaba una sola.
    for (const f of ['negaciones', 'temporalidad']) {
      const src = readFileSync(join(process.cwd(), 'src/lib/expediente', `${f}.ts`), 'utf8')
      expect(src, f).toContain('primeraMencionSinEscudo')
      expect(src, f).not.toContain('t.indexOf(sinAcentos(forma))')
    }
  })

  it('el porqué está escrito donde se lee', () => {
    expect(POR_QUE_TODAS_LAS_APARICIONES).toContain('impresión diagnóstica')
  })
})
