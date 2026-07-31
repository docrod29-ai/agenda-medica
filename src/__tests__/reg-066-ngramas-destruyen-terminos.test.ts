/**
 * REG-066 — el fusor de n-gramas destruía términos que ya estaban bien.
 *
 * Hermano de REG-065, encontrado el mismo día por un camino distinto: pasando el
 * corpus **V3 de 7 000 audios**, que el pipeline no había visto nunca, por la
 * regresión de texto (`scripts/asr-regresion-texto.ts`).
 *
 *     «Neuro-UCI: NIRS cerebral en monitorización.»
 *          → «Neuro-UCI: Precerebral en monitorización.»
 *
 *     «Se integra como problema activo parálisis facial periférica.»
 *          → «Se integra como problema acroparalysis facial periférica.»
 *
 *     «Se integra como problema activo anestesia general.»
 *          → «Se integra como problema acroanesthesia general.»
 *
 * El guardián de sustituciones no podía verlo: no cambió ninguna cifra, ni
 * unidad, ni negación, ni lateralidad. Y ninguno de estos tres tiene nada que
 * ver con los siete errores medidos en el corpus de 498 — por eso hacía falta un
 * corpus que el pipeline no conociera.
 *
 * Dos guardas nuevas, las dos estructurales:
 *
 *   1. Una palabra en MAYÚSCULAS es una sigla escrita a propósito, no un
 *      fragmento de fármaco partido: la ventana no se fusiona.
 *   2. Una fusión repara un ESPACIO, así que el candidato tiene que medir casi
 *      lo mismo que la unión. Dos letras menos no es reparar, es tragarse
 *      contenido. La distancia sola no separaba los casos buenos de los malos
 *      —hay de los dos a distancia 3—; la diferencia de longitud sí.
 */
import { describe, it, expect } from 'vitest'
import { corregirNGramas, corregirTranscripcion } from '@/lib/expediente/medical-vocabulary'

const ambos = (t: string) => [corregirNGramas(t).corregido, corregirTranscripcion(t).corregido]

describe('REG-066 · los tres casos medidos en el corpus V3', () => {
  it('«NIRS cerebral» no se convierte en «Precerebral»', () => {
    for (const out of ambos('Neuro-UCI: NIRS cerebral en monitorización.')) {
      expect(out).toContain('NIRS cerebral')
      expect(out).not.toContain('Precerebral')
    }
  })

  it('«activo parálisis facial» no se convierte en «acroparalysis»', () => {
    for (const out of ambos('Se integra como problema activo parálisis facial periférica.')) {
      expect(out).toContain('parálisis facial periférica')
      expect(out.toLowerCase()).not.toContain('acroparalysis')
    }
  })

  it('«activo anestesia» no se convierte en «acroanesthesia»', () => {
    for (const t of ['Se integra como problema activo anestesia general.',
      'Se integra como problema activo anestesia regional.']) {
      for (const out of ambos(t)) {
        expect(out).toContain('anestesia')
        expect(out.toLowerCase()).not.toContain('acroanesthesia')
      }
    }
  })
})

describe('REG-066 · guarda 1 — una sigla nunca se fusiona', () => {
  it('las siglas de UCI sobreviven pegadas a una palabra común', () => {
    for (const frase of [
      'PEEP cerebral no es un parámetro',
      'CVVHDF materno sin incidencias',
      'RASS profundo durante la noche',
      'ECMO periférico con buen flujo',
      'VExUS grado dos',
      'POCUS pulmonar sin líneas B',
      'TAPSE conservado',
      'MRSA nasal positivo',
    ]) {
      const sigla = frase.split(' ')[0]
      for (const out of ambos(frase)) expect(out, frase).toContain(sigla)
    }
  })
})

describe('REG-066 · guarda 2 — la fusión no puede tragarse letras', () => {
  it('un candidato dos letras más corto que la unión no se aplica', () => {
    // «activoparalisis» (15) → «acroparalysis» (13): se traga dos.
    expect(corregirNGramas('problema activo parálisis').corregido).toContain('activo parálisis')
  })
})

describe('REG-066 · el fusor NO se desactivó', () => {
  it('sigue reuniendo los fármacos que el reconocedor parte', () => {
    for (const [partido, entero] of [
      ['em pagli flozina', 'empagliflozina'],
      ['empagli flozina', 'empagliflozina'],
      ['platano pros', 'latanoprost'],
    ] as const) {
      expect(corregirNGramas(`indica ${partido} por la mañana`).corregido.toLowerCase(),
        partido).toContain(entero)
    }
  })

  it('y sigue sin comerse una dosis (REG-065 no se rompió)', () => {
    const f = 'Meropenem dos gramos cada ocho horas'
    expect(corregirTranscripcion(f).corregido).toBe(f)
  })
})
