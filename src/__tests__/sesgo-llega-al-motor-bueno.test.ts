/**
 * GOLDEN — el sesgo degradaba el motor al modelo viejo, en silencio.
 *
 * ── CÓMO APARECIÓ ────────────────────────────────────────────────────────────
 *
 * Midiendo por primera vez cuánto aporta sesgar el motor con el expediente del
 * paciente (petición del médico dueño, 5-ago-2026). Salió **0,00 pp**, y eso no
 * cuadraba con que el sesgo sea lo único que cambia lo que el motor OYE.
 *
 * ── LA CAUSA, EN PALABRAS DEL PROVEEDOR ──────────────────────────────────────
 *
 *     «"word_boost" is not compatible with universal-3-5-pro.
 *      Use "prompt" or "keyterms_prompt"»
 *
 * La ruta mandaba `word_boost` **y la lista de modelos**. Con la lista **no
 * falla**: el proveedor descarta el modelo incompatible y corre con
 * `universal-2`.
 *
 * O sea que el parámetro puesto para MEJORAR la precisión estaba **degradando el
 * motor al modelo viejo en cada consulta**, sin error, sin aviso y sin forma de
 * notarlo — la respuesta llegaba normal.
 *
 * Y explicaba el 0,00: la condición «sin sesgo» corría en el modelo nuevo y las
 * de «con sesgo» en el viejo. No se comparaban sesgos: se comparaban modelos.
 *
 * ── Y DOS LÍMITES MÁS, CADA UNO DESCUBIERTO AL SER RECHAZADO ─────────────────
 *
 *   · «must contain no more than 1000 WORDS»  → no son entradas, son palabras.
 *   · «has 4563 text tokens, maximum 2672»    → y no son palabras: son tokens.
 *
 * Pasarse aquí **no recorta: tumba la petición entera** y deja al médico sin
 * dictado en mitad de la consulta.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { componerSesgo, TOPE_CARACTERES } from '@/lib/asr/sesgo-diarizado'
import { WORD_BOOST_MEDICO } from '@/lib/expediente/medical-vocabulary'

const ruta = readFileSync(join(process.cwd(), 'src/app/api/expediente/transcribir-diarizado/route.ts'), 'utf8')

describe('EL SESGO VIAJA POR EL CANAL QUE EL MODELO ACEPTA', () => {
  it('`keyterms_prompt`, no `word_boost`', () => {
    expect(ruta).toContain('keyterms_prompt: sesgo.terminos')
    expect(ruta).not.toContain('word_boost:')
  })

  it('y `boost_param` se fue con él', () => {
    // Era parte del canal viejo; dejarlo sería mandar un parámetro huérfano.
    expect(ruta).not.toContain('boost_param')
  })
})

describe('SE PIDE UN MODELO, NO UNA LISTA QUE EL PROVEEDOR RESUELVA', () => {
  it('un solo modelo explícito', () => {
    /**
     * La lista era lo que convertía un error en una degradación silenciosa: el
     * proveedor descartaba el incompatible y seguía. Sin lista, si el modelo no
     * está disponible **falla y se ve**.
     */
    expect(ruta).toContain('speech_models: [MODELO_DIARIZACION],')
    expect(ruta).not.toContain('speech_models: [...MODELOS_DIARIZACION],')
  })

  it('y es el que admite el sesgo grande', () => {
    expect(ruta).toContain("const MODELO_DIARIZACION = 'universal-3-5-pro'")
  })
})

describe('EL PRESUPUESTO ES DE TOKENS, Y SE MIDE EN CARACTERES', () => {
  it('hay un techo en caracteres, no sólo en entradas', () => {
    /**
     * Los tokens no se pueden contar de este lado sin el tokenizador del
     * proveedor. Los caracteres sí.
     */
    expect(TOPE_CARACTERES).toBeGreaterThan(0)
    expect(TOPE_CARACTERES).toBeLessThan(6280)   // 2 672 tokens × 2,35 car/token
  })

  it('el sesgo compuesto cabe con margen', () => {
    const r = componerSesgo({ medicamentos: ['amikacina', 'meropenem'] }, WORD_BOOST_MEDICO, 1000)
    const chars = r.terminos.join(' ').length
    expect(chars).toBeLessThanOrEqual(TOPE_CARACTERES)
    // Y con el ratio medido, por debajo del límite real del proveedor.
    expect(Math.round(chars / 2.35)).toBeLessThan(2672)
  })

  it('y aun así entran MUCHOS más términos que antes', () => {
    /**
     * Antes se mandaban 200, presupuestados para el modelo pequeño de una lista
     * que ya no se manda. El techo real da para bastante más.
     */
    const r = componerSesgo({ medicamentos: ['amikacina'] }, WORD_BOOST_MEDICO, 1000)
    expect(r.terminos.length).toBeGreaterThan(400)
  })

  it('sin perder la política: el paciente va primero', () => {
    // Si el recorte se llevara los fármacos de este paciente, el sesgo no serviría.
    const r = componerSesgo({ medicamentos: ['amikacina'] }, WORD_BOOST_MEDICO, 1000)
    expect(r.terminos[0].toLowerCase()).toContain('amikacina')
    expect(r.delPaciente).toBeGreaterThanOrEqual(1)
  })

  it('un tope diminuto recorta sin reventar', () => {
    // El recorte tiene que ser nuestro y ordenado, no del proveedor y a ciegas.
    const r = componerSesgo({ medicamentos: ['amikacina'] }, WORD_BOOST_MEDICO, 3)
    expect(r.terminos.length).toBe(3)
    expect(r.descartados).toBeGreaterThan(0)
  })
})

describe('LA LECCIÓN, QUE YA ESTABA ESCRITA EN ESTE MISMO ARCHIVO', () => {
  it('el código dice que se comprobó contra la API real', () => {
    /**
     * La vez anterior el comentario decía: «estas pruebas pasaban en verde
     * mientras la diarización estaba caída, porque comprobaban que el código
     * dijera lo acordado — no que el proveedor lo aceptara».
     *
     * Volvió a pasar. Un test de contrato no sustituye una llamada real, y el
     * código tiene que decir cuál de las dos cosas respalda cada número.
     */
    expect(ruta).toMatch(/comprobado contra la API real|no contra la documentación/)
  })
})
