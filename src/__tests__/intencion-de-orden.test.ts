/**
 * GOLDEN — lo que el médico CONSIDERÓ podía salir impreso como lo que INDICÓ.
 *
 * ── EL HUECO (criterio del charter, tolerancia CERO) ─────────────────────────
 *
 * «Órdenes activas sin confirmar = 0 · `ORDER_INTENT ≠ ORDER`.»
 *
 * En una consulta el médico piensa en voz alta: «**si no mejora en 48 horas** le
 * agregamos amoxicilina», «**podríamos** usar un IECA», «queda **pendiente de**
 * la biometría». Nada de eso es una indicación.
 *
 * El extractor ve el nombre del fármaco y lo pone en `medicamentos` — y
 * `medicamentos` **alimenta la receta**. Así que una hipótesis dicha en voz alta
 * podía salir impresa, firmada y con cédula, y el paciente comprarla.
 *
 * No había **nada** que lo mirara: ni regla determinista ni línea en el prompt.
 * Se buscó en todo el repositorio antes de escribir esto.
 *
 * ── LO QUE NO HACE ───────────────────────────────────────────────────────────
 *
 * No borra. «Si tiene dolor, paracetamol» es una indicación PRN válida y muy
 * común: borrar por condicional perdería medicación real, que es peor que
 * dejarla y preguntar. Va por el canal de confirmación que ya existía.
 *
 * Y no juzga clínica: no mira si el fármaco es correcto, ni su dosis, ni si
 * procede. Mira **cómo se dijo**. Es gramática, no medicina.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  soloPropuesto, mencionesDe, medicamentosSoloPropuestos, estudiosSoloPropuestos, frases,
  POR_QUE_TAMBIEN_LOS_ESTUDIOS,
  POR_QUE_NO_SE_BORRA, POR_QUE_NO_ES_UNA_DECISION_CLINICA, POR_QUE_UNA_MENCION_FIRME_MANDA,
} from '@/lib/asr/intencion-de-orden'
import { MOTIVOS_CONFIRMACION } from '@/lib/asr/politica-critica'
import { TEXTO_MOTIVO } from '@/lib/expediente/motivos-confirmacion-texto'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

describe('LA ORDEN DE VERDAD NO SE TOCA', () => {
  it('una indicación firme no es una propuesta', () => {
    expect(soloPropuesto('Le doy amoxicilina 500 mg cada 8 horas por 7 días.', 'amoxicilina')).toBe(false)
  })

  it('una PRN es una orden, aunque lleve «si»', () => {
    /**
     * Es el falso positivo que habría hecho inútil todo esto: «si tiene dolor,
     * paracetamol» se dicta cien veces al día y es una indicación real.
     */
    for (const t of [
      'Si tiene dolor, paracetamol un gramo.',
      'Paracetamol un gramo en caso de fiebre.',
      'Ondansetrón por razón necesaria si lo requiere.',
    ]) {
      const f = t.toLowerCase().includes('paracetamol') ? 'paracetamol' : 'ondansetrón'
      expect(soloPropuesto(t, f), t).toBe(false)
    }
  })

  it('un fármaco que no se mencionó no lo juzga este módulo', () => {
    // Si no está en el dictado, el problema es otro y lo mira la procedencia.
    expect(soloPropuesto('Le doy paracetamol.', 'amoxicilina')).toBe(false)
  })
})

describe('LA PROPUESTA SE DETECTA', () => {
  const casos: [string, string][] = [
    ['Si no mejora en 48 horas le agregamos amoxicilina.', 'amoxicilina'],
    ['Si persiste la fiebre, valoramos ceftriaxona.', 'ceftriaxona'],
    ['Podríamos usar un IECA más adelante.', 'ieca'],
    ['Queda pendiente de la biometría el metronidazol.', 'metronidazol'],
    ['Tal vez azitromicina, pero por ahora no.', 'azitromicina'],
    ['Hay que valorar prednisona en la próxima consulta.', 'prednisona'],
  ]
  for (const [texto, farmaco] of casos) {
    it(`«${texto.slice(0, 42)}…»`, () => {
      expect(soloPropuesto(texto, farmaco)).toBe(true)
    })
  }
})

describe('UNA MENCIÓN FIRME MANDA SOBRE LA DUDA PREVIA', () => {
  it('dudar en voz alta y luego decidirse es una orden', () => {
    /**
     * El médico se decidió. Seguir preguntando por algo que ya resolvió es la
     * definición de fatiga de alertas — y un aviso que sale siempre se apaga.
     */
    const t = 'Estaba pensando en enalapril. Sí, le doy enalapril 5 mg al día.'
    expect(soloPropuesto(t, 'enalapril')).toBe(false)
  })

  it('la condición se juzga en SU frase, no en toda la consulta', () => {
    // «Si no mejora» a los tres minutos no condiciona lo que se indicó a los
    // quince: eso convertiría media consulta en propuestas.
    const t = 'Si no mejora la tos, valoramos radiografía. Le doy loratadina 10 mg cada 24 horas.'
    expect(soloPropuesto(t, 'loratadina')).toBe(false)
  })

  it('las menciones se devuelven con su encuadre, no como un booleano suelto', () => {
    const m = mencionesDe('Si no mejora le agregamos amoxicilina. Le doy paracetamol.', 'amoxicilina')
    expect(m).toHaveLength(1)
    expect(m[0].condicional).toBe(true)
    expect(m[0].prn).toBe(false)
  })
})

describe('EL TROCEADO EN FRASES', () => {
  it('parte por puntuación y por salto de línea', () => {
    expect(frases('Uno. Dos!\n¿Tres?')).toHaveLength(3)
  })

  it('un texto vacío no produce frases', () => {
    expect(frases('')).toEqual([])
    expect(frases('   ')).toEqual([])
  })
})

describe('SOBRE LA LISTA QUE VA A LA RECETA', () => {
  it('devuelve los nombres, no los índices', () => {
    /**
     * La lista de la nota y la de la extracción se desfasan en cuanto el médico
     * borra uno, y un índice desfasado señalaría el fármaco equivocado — el
     * mismo defecto que ya obligó a identificar por nombre en la procedencia.
     */
    const r = medicamentosSoloPropuestos(
      'Si no mejora le agregamos amoxicilina. Le doy paracetamol un gramo.',
      [{ nombre: 'Amoxicilina' }, { nombre: 'Paracetamol' }],
    )
    expect(r).toEqual(['Amoxicilina'])
  })

  it('sin dictado no señala nada', () => {
    // Una nota escrita a mano no tiene encuadre que juzgar.
    expect(medicamentosSoloPropuestos('', [{ nombre: 'Amoxicilina' }])).toEqual([])
  })

  it('sin medicamentos tampoco', () => {
    expect(medicamentosSoloPropuestos('Si no mejora le agregamos amoxicilina.', [])).toEqual([])
  })

  it('no repite un fármaco que aparece dos veces en la lista', () => {
    const r = medicamentosSoloPropuestos(
      'Si no mejora le agregamos amoxicilina.',
      [{ nombre: 'Amoxicilina' }, { nombre: 'Amoxicilina' }],
    )
    expect(r).toEqual(['Amoxicilina'])
  })
})

describe('ESTÁ CONECTADO — Y POR EL CANAL QUE YA EXISTÍA', () => {
  it('el motivo está declarado en la política', () => {
    expect(MOTIVOS_CONFIRMACION).toContain('farmaco_solo_propuesto')
  })

  it('y tiene texto para el médico, como los otros seis', () => {
    // Un motivo sin texto se ignora en pantalla: sería una alerta que no sale.
    expect(TEXTO_MOTIVO.farmaco_solo_propuesto?.length).toBeGreaterThan(40)
  })

  it('la consulta lo calcula y lo mete en el aviso', () => {
    const page = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
    expect(page).toContain('medicamentosSoloPropuestos(voz.transcripcion, medicamentos)')
    expect(page).toContain("...(soloPropuestos.length ? ['farmaco_solo_propuesto'] : [])")
  })

  it('y dice CUÁLES fueron', () => {
    /**
     * «Un fármaco se mencionó como algo a valorar» sin decir cuál obliga a
     * releer la consulta entera, y un aviso que cuesta trabajo se cierra sin
     * leer.
     */
    const page = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
    expect(page).toContain('Fármacos mencionados así:')
  })
})

/**
 * ── LOS ESTUDIOS TIENEN EL MISMO PROBLEMA, Y OTRO PAPEL ─────────────────────
 *
 * `estudiosOrden` alimenta la **orden médica impresa**: el papel que el paciente
 * se lleva al laboratorio o al centro de imagen. Un «si no mejora, le pido una
 * tomografía» convertido en orden activa manda al paciente a hacerse —y a
 * pagar— un estudio que sólo se estaba considerando.
 */
describe('Y LOS ESTUDIOS, QUE VAN A LA ORDEN IMPRESA', () => {
  it('un estudio propuesto se detecta', () => {
    expect(estudiosSoloPropuestos(
      'Si no mejora en una semana, le pido una tomografía de abdomen.',
      ['Tomografía de abdomen'],
    )).toEqual(['Tomografía de abdomen'])
  })

  it('uno solicitado de verdad no se toca', () => {
    expect(estudiosSoloPropuestos(
      'Le pido biometría hemática y química sanguínea hoy.',
      ['Biometría hemática'],
    )).toEqual([])
  })

  it('va por un motivo APARTE del de fármacos', () => {
    // El documento y la corrección son distintos: uno se arregla en la receta
    // y el otro en la orden que el paciente lleva al laboratorio.
    expect(MOTIVOS_CONFIRMACION).toContain('estudio_solo_propuesto')
    expect(TEXTO_MOTIVO.estudio_solo_propuesto?.length).toBeGreaterThan(40)
    expect(TEXTO_MOTIVO.estudio_solo_propuesto).not.toBe(TEXTO_MOTIVO.farmaco_solo_propuesto)
  })

  it('la consulta lo calcula y lo nombra', () => {
    const page = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
    expect(page).toContain('estudiosSoloPropuestos(voz.transcripcion, estudiosOrden)')
    expect(page).toContain("...(estudiosPropuestos.length ? ['estudio_solo_propuesto'] : [])")
    expect(page).toContain('Estudios mencionados así:')
  })

  it('está escrito por qué importa igual que un fármaco', () => {
    expect(POR_QUE_TAMBIEN_LOS_ESTUDIOS).toMatch(/y a\s*\n?\s*pagar|pagar/)
  })
})

describe('LO QUE ESTE MÓDULO DECLARA DE SÍ MISMO', () => {
  it('que no borra, y por qué', () => {
    expect(POR_QUE_NO_SE_BORRA).toMatch(/perdería medicación real/)
  })

  it('que no es una decisión clínica', () => {
    expect(POR_QUE_NO_ES_UNA_DECISION_CLINICA).toMatch(/gramática, no medicina/)
  })

  it('y por qué una mención firme cierra el asunto', () => {
    expect(POR_QUE_UNA_MENCION_FIRME_MANDA).toMatch(/fatiga de alertas/)
  })
})
