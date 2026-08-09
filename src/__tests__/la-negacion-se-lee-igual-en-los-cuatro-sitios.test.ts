/**
 * EL VERBO CON EL QUE EL PACIENTE NIEGA — REG-206.
 *
 * ── EL DEFECTO ───────────────────────────────────────────────────────────────
 *
 * «No padece alergia a penicilina», escrito en el campo de alergias, quedaba
 * registrado como un alérgeno **llamado literalmente así**. El cruce
 * alergia↔fármaco busca el nombre del fármaco DENTRO del texto del alérgeno, y
 * esa cadena contiene «penicilina»: al prescribirla saltaba la alerta crítica
 * que apaga el botón de Firmar, en el paciente que acababa de negar la alergia.
 * La única salida del médico era borrar el texto del expediente — el desenlace
 * que `alergias.ts` se escribió para evitar, entrando por la puerta de al lado.
 *
 * En el mismo dictado, «No padece diabetes» salía como **antecedente positivo**,
 * y los antecedentes se arrastran a todas las notas siguientes.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Auditoría de nueve dimensiones del 6-ago (hallazgos C2 y C3), reproducido el
 * 7-ago contra los motores reales antes de tocar nada: `extraerComorbilidades`,
 * `extraerAlergias`, `alergenosDe` y `condicionesNegadas`, cada uno con su
 * entrada, imprimiendo lo que devolvían.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * Había **cuatro** listas de negadores, una por archivo, y ninguna sabía de las
 * otras. Cada una creció el día que un defecto la tocó a ella, y el verbo que se
 * añadía no llegaba a los otros tres sitios. «Padece» —el verbo con el que se
 * contesta el interrogatorio en México— sólo lo conocía `negaciones.ts`;
 * `presenta` sólo lo conocían los otros tres.
 *
 * La misma deriva iba en sentido contrario en los afirmadores: «niega
 * tabaquismo, **padece diabetes**» borraba una diabetes REAL, mientras «niega
 * tabaquismo, **tiene diabetes**» funcionaba.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * El vocabulario vive una sola vez, en `negadores.ts`. El **anclaje no**: es
 * política de cada sitio (`^` en el campo de alergias, ventana hacia atrás en el
 * parser) y se compone a la vista en cada archivo.
 *
 * ── LO QUE ESTA PRUEBA **NO** CUBRE ──────────────────────────────────────────
 *
 * 1. **No mide el habla real.** Las frases son sintéticas, escritas por mí. El
 *    número de cuántas negaciones reales se pierden sale del corpus, no de aquí.
 * 2. **No cubre `sin` suelto.** «Sin control de la diabetes» sigue contando como
 *    diabetes negada en `parser-clinico`; es un defecto anterior, distinto, y
 *    repararlo exige tocar la ventana, no el vocabulario.
 * 3. **No cubre «nunca me la han medido».** `nunca` cuenta como negación, y
 *    «nunca me la han medido» es ausencia de dato, no negación del antecedente.
 *    Es la frontera de este motor y queda declarada, no cerrada.
 * 4. **No decide nada clínico.** Que el paciente niegue no significa que no lo
 *    tenga; sólo cambia dónde entra el dato y quién lo revisa.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { extraerComorbilidades, extraerAlergias } from '@/lib/expediente/parser-clinico'
import { alergenosDe } from '@/lib/seguridad/alergias'
import { condicionesNegadas } from '@/lib/expediente/negaciones'
import { verificar } from '@/lib/asr/guardian-sustituciones'

describe('el alérgeno que no era un alérgeno', () => {
  it('«No padece alergia a penicilina» no registra ningún alérgeno', () => {
    expect(alergenosDe({ alergias: 'No padece alergia a penicilina' })).toEqual([])
  })

  it('y por tanto no puede contener el nombre del fármaco que dispara el cruce', () => {
    // El cruce hace alergeno.includes(farmaco): mientras la frase entera viajaba
    // como alérgeno, «penicilina» estaba dentro y la alerta crítica saltaba.
    const alergenos = alergenosDe({ alergias: 'No padece alergia a penicilina' })
    expect(alergenos.some(a => a.toLowerCase().includes('penicilina'))).toBe(false)
  })

  it('«No sufre alergias» y «Nunca ha tenido alergias» tampoco', () => {
    expect(alergenosDe({ alergias: 'No sufre alergias' })).toEqual([])
    expect(alergenosDe({ alergias: 'Nunca ha tenido alergias' })).toEqual([])
  })

  it('la alergia REAL sigue registrándose — el filtro no se pasó de largo', () => {
    expect(alergenosDe({ alergias: 'Penicilina' })).toEqual(['Penicilina'])
    expect(alergenosDe({ alergias: 'Penicilina / Sulfas' })).toEqual(['Penicilina', 'Sulfas'])
  })

  it('una alergia real DESPUÉS de una negada sobrevive (REG del 4-ago, no se rompe)', () => {
    expect(alergenosDe({ alergias: 'Niega penicilina. Alérgico a sulfas' }))
      .toEqual(['Alérgico a sulfas'])
  })

  it('«sin datos de reacción» detrás del alérgeno NO lo filtra: la negación debe ABRIR', () => {
    // El ancla `^` es lo que sostiene esto. Sin ella, un `sin` en mitad del
    // fragmento borraría la alergia entera.
    expect(alergenosDe({ alergias: 'Penicilina sin datos de reacción' }))
      .toEqual(['Penicilina sin datos de reacción'])
  })

  it('el extractor de texto libre tampoco cosecha la alergia negada', () => {
    expect(extraerAlergias('No padece alergia a penicilina.')).toEqual([])
    expect(extraerAlergias('Alergia a penicilina.')).toEqual(['penicilina'])
  })
})

describe('el antecedente que nadie tenía', () => {
  it('«No padece diabetes» NO es un antecedente positivo', () => {
    const r = extraerComorbilidades('No padece diabetes.')
    expect(r.positivas).toEqual([])
    expect(r.negadas).toContain('Diabetes mellitus tipo 2')
  })

  it('«no sufre», «no padezco» y «no cuenta con» se leen igual que «no tiene»', () => {
    for (const frase of [
      'No sufre de diabetes.',
      'No padezco diabetes.',
      'No cuenta con diabetes.',
      'No tiene diabetes.',
    ]) {
      expect(extraerComorbilidades(frase).positivas, frase).toEqual([])
    }
  })

  it('la diabetes REAL sigue saliendo positiva', () => {
    expect(extraerComorbilidades('Diabetes mellitus tipo 2 en tratamiento.').positivas)
      .toContain('Diabetes mellitus tipo 2')
  })

  it('«niega tabaquismo, padece diabetes» NO borra la diabetes', () => {
    // La otra cara de la deriva: `padece` faltaba en los afirmadores, así que la
    // negación del tabaquismo se derramaba sobre la enfermedad siguiente.
    const r = extraerComorbilidades('Niega tabaquismo, padece diabetes.')
    expect(r.positivas).toContain('Diabetes mellitus tipo 2')
    expect(r.negadas).toContain('Tabaquismo')
  })
})

describe('cómo se contesta de verdad en el consultorio', () => {
  it('«Pues no» y «Fíjese que no» son negaciones', () => {
    for (const frase of [
      '¿Padece diabetes? Pues no, doctor.',
      '¿Es usted diabético? Fíjese que no.',
      '¿Tiene diabetes? Bueno, no.',
      '¿Tiene diabetes? Mire, no.',
    ]) {
      expect(condicionesNegadas(frase).map(x => x.condicion), frase).toEqual(['diabetes'])
    }
  })

  it('«Para nada» y «Tampoco» también', () => {
    expect(condicionesNegadas('¿Enfermedades crónicas como diabetes? Para nada.')
      .map(x => x.condicion)).toEqual(['diabetes'])
    expect(condicionesNegadas('¿Y asma? Tampoco.')
      .map(x => x.condicion)).toEqual(['asma'])
  })

  it('la muletilla SOLA no niega: «Pues sí» sigue siendo una afirmación', () => {
    // Es lo que separa esto de tragarse un positivo. Si «pues» negara por su
    // cuenta, una diabetes confirmada desaparecería del expediente.
    expect(condicionesNegadas('¿Tiene diabetes? Pues sí, desde hace diez años.'))
      .toEqual([])
    expect(condicionesNegadas('¿Tiene diabetes? Bueno, sí.')).toEqual([])
  })

  it('«No presenta diabetes» —la forma escrita— la ve el guardián de contradicción', () => {
    // Este verbo lo conocían los otros tres archivos y éste no.
    expect(condicionesNegadas('No presenta diabetes.').map(x => x.condicion))
      .toEqual(['diabetes'])
  })

  it('el silencio NO es negación', () => {
    expect(condicionesNegadas('¿Padece diabetes?')).toEqual([])
    expect(condicionesNegadas('¿Padece diabetes? Desde los cuarenta.')).toEqual([])
  })
})

describe('el guardián de voz lee el mismo vocabulario', () => {
  it('detecta el volteo cuando la corrección borra un «no padece»', () => {
    const v = verificar('no padece disnea', 'padece disnea')
    expect(v.violaciones.some(x => x.clase === 'volteo_negacion')).toBe(true)
  })

  it('no inventa un volteo donde la negación se conserva', () => {
    const v = verificar('no padece disnea', 'no padece disnea de esfuerzo')
    expect(v.violaciones.some(x => x.clase === 'volteo_negacion')).toBe(false)
  })
})

describe('el vocabulario está en un solo sitio', () => {
  /**
   * El guardián de la deriva. Cuatro archivos escribieron su propia lista de
   * negadores y el defecto vivió meses en tres de ellos. Si alguien vuelve a
   * teclear los verbos en su archivo en vez de importarlos, esto se pone rojo.
   */
  const CONSUMIDORES = [
    'src/lib/expediente/negaciones.ts',
    'src/lib/expediente/parser-clinico.ts',
    'src/lib/seguridad/alergias.ts',
    'src/lib/asr/guardian-sustituciones.ts',
  ]

  it('los cuatro consumidores importan de negadores.ts', () => {
    for (const rel of CONSUMIDORES) {
      expect(readFileSync(rel, 'utf8'), rel).toContain("from '@/lib/expediente/negadores'")
    }
  })

  it('ninguno vuelve a teclear la lista de verbos por su cuenta', () => {
    // La huella de la lista tecleada a mano: «no» + alternancia de verbos dentro
    // de un grupo. Es exactamente lo que tenían los cuatro.
    const aMano = /no\\s\+\(\?:\w+\|/
    for (const rel of CONSUMIDORES) {
      expect(aMano.test(readFileSync(rel, 'utf8')), rel).toBe(false)
    }
  })
})
