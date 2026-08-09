/**
 * EL PASE DICTADO SE REPARTE POR APARATOS — REG-264 · hueco 2.
 *
 * ── EL HUECO QUE NINGÚN PRODUCTO DEL MERCADO CUBRE ──────────────────────────
 *
 * De la investigación (I-12): Suki, Nabla, Abridge y DAX asumen todos una
 * **conversación ambulatoria de dos partes** como fuente de verdad. En UCI no
 * hay conversación con el paciente: el pase es un **monólogo por aparatos y
 * sistemas**. Por eso el *Linked Evidence* de Abridge —enlazar cada afirmación
 * a un enunciado— no aplica ahí.
 *
 * Y en los 2,5 millones de usos de Kaiser, **infectología fue de las
 * especialidades que MENOS lo usó**.
 *
 * ── EL DEFECTO, CON SU CAUSA EXACTA ─────────────────────────────────────────
 *
 * `repartirPorSistemas()` —el corazón de la nota de UCI— partía el texto por
 * `\n`. Correcto para un pase **escrito o pegado**.
 *
 * Pero un pase **dictado** llega como un párrafo corrido, sin un solo salto de
 * línea. Resultado: **no encontraba ni un encabezado** y el pase caía ENTERO en
 * el plan. La nota por aparatos —justo lo que nadie más hace— **no corría sobre
 * voz**.
 *
 * ── LA REGLA, DELIBERADAMENTE ESTRECHA ──────────────────────────────────────
 *
 * Se parte **sólo** cuando el nombre del aparato aparece al principio o tras un
 * punto, **y** lleva `,` o `:` inmediatamente detrás.
 *
 * Partir de más sería peor que no partir: metería medio párrafo del aparato
 * anterior en el siguiente, y eso es **un dato clínico en la sección
 * equivocada**.
 *
 * ── LO QUE COSTÓ ENCONTRAR ──────────────────────────────────────────────────
 *
 * Con el salto sólo DELANTE, la línea quedaba «Neurológico, RASS menos dos,
 * pupilas isocóricas.» — el detector la reconocía **entera como rótulo** y
 * descartaba el contenido, porque el encabezado no se copia. Sobrevivía sólo el
 * primer aparato. El salto tiene que ir delante **y detrás**.
 */
import { describe, it, expect } from 'vitest'
import { repartirPorSistemas, conSaltosAntesDeCadaAparato, tuvoEstructura } from '@/lib/uci/reparto-sistemas'
import {
  comoVinoElPaseDeTexto, aparatosSinTexto,
  POR_QUE_NO_SE_REPARTE_SOLO, POR_QUE_NO_ES_UN_REGAÑO, POR_QUE_CALLA_CUANDO_TODO_VA_BIEN,
  EL_HUECO_DE_MERCADO,
} from '@/lib/uci/como-vino-el-pase'

/** Un pase de UCI tal como sale del reconocedor: un párrafo, sin saltos. */
const DICTADO =
  'Neurológico, RASS menos dos, pupilas isocóricas. ' +
  'Respiratorio, asistido controlado por volumen, PEEP 10, FiO2 60. ' +
  'Hemodinámico, norepinefrina 0.1 mcg/kg/min, lactato 2.1. ' +
  'Renal, uresis 0.6 mL/kg/h.'

describe('EL CASO QUE NO FUNCIONABA: un pase dictado de corrido', () => {
  const r = repartirPorSistemas(DICTADO)

  it('cada aparato se lleva SU texto', () => {
    expect(r.neurologico).toBe('RASS menos dos, pupilas isocóricas.')
    expect(r.respiratorio).toBe('asistido controlado por volumen, PEEP 10, FiO2 60.')
    expect(r.hemodinamico).toBe('norepinefrina 0.1 mcg/kg/min, lactato 2.1.')
    expect(r.hidrometabolico).toBe('uresis 0.6 mL/kg/h.')
  })

  it('y NO queda nada en el plan', () => {
    /** Antes caía ahí el pase entero. */
    expect(r.plan).toBe('')
  })

  it('el motor lo reconoce como estructurado', () => {
    expect(tuvoEstructura(r)).toBe(true)
    expect(comoVinoElPaseDeTexto(DICTADO).forma).toBe('por_aparatos')
  })

  it('ningún aparato pierde su contenido — el fallo del primer intento', () => {
    /**
     * Con el salto sólo delante, sólo sobrevivía `neurologico`. Este caso es el
     * que impide volver a esa versión.
     */
    const conTexto = comoVinoElPaseDeTexto(DICTADO).conTexto
    expect(conTexto).toEqual(['neurologico', 'respiratorio', 'hemodinamico', 'hidrometabolico'])
  })
})

describe('las trampas: lo que NO se puede partir', () => {
  it.each([
    'El paciente está hemodinámicamente estable.',
    'El sistema respiratorio no está comprometido.',
    'Sigue neurológicamente íntegro y sin datos de focalización.',
    'Se comentó el caso con el servicio de infectología por la mañana.',
  ])('«%s» no crea una sección', (t) => {
    expect(comoVinoElPaseDeTexto(t).forma).toBe('de_corrido')
  })

  it('el nombre a mitad de frase no parte nada', () => {
    /** Hace falta principio de frase Y separador detrás. */
    const t = 'Se ajustó el soporte respiratorio, y luego el hemodinámico también.'
    expect(comoVinoElPaseDeTexto(t).forma).toBe('de_corrido')
  })
})

describe('lo escrito sigue funcionando igual', () => {
  it('los saltos que ya venían no se tocan', () => {
    const escrito = 'Neurológico:\nRASS menos 2.\nRespiratorio:\nPEEP 10.'
    const r = repartirPorSistemas(escrito)
    expect(r.neurologico).toBe('RASS menos 2.')
    expect(r.respiratorio).toBe('PEEP 10.')
  })

  it('la inserción es idempotente', () => {
    /**
     * Si no lo fuera, un pase guardado y vuelto a procesar acumularía saltos
     * hasta partir el texto en pedazos.
     */
    const una = conSaltosAntesDeCadaAparato(DICTADO)
    expect(conSaltosAntesDeCadaAparato(una)).toBe(una)
  })

  it('sin texto no inventa estructura', () => {
    expect(comoVinoElPaseDeTexto('').forma).toBe('sin_dictado')
    expect(comoVinoElPaseDeTexto('   ').mensaje).toBeNull()
  })
})

describe('el aviso: cuándo habla y cuándo se calla', () => {
  it('con el pase bien estructurado NO dice nada', () => {
    /**
     * Un aviso que sale también cuando todo va bien es ruido, y el ruido se
     * aprende a ignorar — incluido el que sí importa (REG-245).
     */
    expect(comoVinoElPaseDeTexto(DICTADO).mensaje).toBeNull()
    expect(POR_QUE_CALLA_CUANDO_TODO_VA_BIEN).toMatch(/se aprende a ignorar/)
  })

  it('con el pase de corrido explica QUÉ pasó y CÓMO evitarlo', () => {
    const m = comoVinoElPaseDeTexto(
      'El paciente sigue sedado, con soporte ventilatorio y aminas a dosis bajas.',
    ).mensaje!
    expect(m).toMatch(/todo lo dictado quedó en el plan/)
    expect(m).toMatch(/«neurológico…», «respiratorio…»/)
  })

  it('no reparte por su cuenta, y lo dice', () => {
    expect(POR_QUE_NO_SE_REPARTE_SOLO).toMatch(/criterio clínico/)
    expect(POR_QUE_NO_ES_UN_REGAÑO).toMatch(/Dictar de corrido es legítimo/)
  })

  it('nombra los aparatos que quedaron sin texto propio', () => {
    const r = comoVinoElPaseDeTexto(DICTADO)
    const faltan = aparatosSinTexto(r)
    expect(faltan).toContain('abdominodigestivo')
    expect(faltan).not.toContain('neurológico')
  })
})

describe('el porqué de mercado queda escrito', () => {
  it('nombra por qué Linked Evidence no aplica en UCI', () => {
    expect(EL_HUECO_DE_MERCADO).toMatch(/no hay conversación con el paciente/)
    expect(EL_HUECO_DE_MERCADO).toMatch(/Kaiser/)
  })
})
