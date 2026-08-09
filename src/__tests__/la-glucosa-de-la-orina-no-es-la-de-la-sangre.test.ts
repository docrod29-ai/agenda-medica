/**
 * UN VALOR NORMAL MARCADO COMO CRÍTICO — REG-291.
 *
 * ── LO MEDIDO, CON `evaluarCriticoLab` DE VERDAD ────────────────────────────
 *
 *     «Glucosa en orina (EGO)» = 500 mg/dL  →  CRÍTICO
 *     «Calcio iónico»          = 4.8 mg/dL  →  CRÍTICO
 *
 * La primera es una **glucosuria corriente** en un diabético descompensado, y
 * disparaba la misma alerta —y el mismo WhatsApp— que una glucemia de 500, que
 * sí lo es.
 *
 * La segunda es peor: **4.8 mg/dL es un valor NORMAL de calcio iónico** (normal
 * ~4.5-5.6). Se estaba comparando contra el umbral bajo del calcio **total**,
 * que es 6. Y en terapia el iónico se mide a todas horas.
 *
 * ── POR QUÉ ES DE LOS QUE MÁS DAÑO HACEN A LARGO PLAZO ──────────────────────
 *
 * **Un valor normal marcado como crítico es peor que un umbral que falta.** El
 * que falta se nota cuando se busca; éste enseña una alarma roja sobre un
 * paciente que está bien, y eso es lo que enseña a ignorar las alarmas — la
 * lección que este repositorio ya tiene escrita para los avisos clínicos y para
 * sus propios medidores.
 *
 * ── DÓNDE SE QUEDÓ CORTA LA DEFENSA ─────────────────────────────────────────
 *
 * Este mismo módulo ya excluye el pH urinario, la fosfatasa alcalina, la
 * hemoglobina glucosilada y la creatinina en orina — cada una con su comentario
 * explicando el caso real que la motivó.
 *
 * **La clase estaba identificada y la lista se quedó corta.** El examen general
 * de orina trae varios analitos con el mismo nombre que los de sangre; se cubrió
 * el pH y no la glucosa ni la bilirrubina.
 *
 * ── LO QUE NO SE HACE: INVENTAR EL UMBRAL DEL IÓNICO ────────────────────────
 *
 * Excluirlo no es resolverlo. Mientras no tenga umbral propio, **un calcio
 * iónico realmente crítico no se marca** — y eso queda declarado en
 * `FALTA_CRITICO_CALCIO_IONICO`, que aparece solo en la lista de decisiones del
 * dueño. Poner aquí una cifra «razonable» sería firmar en su nombre.
 */
import { describe, it, expect } from 'vitest'
import {
  evaluarCriticoLab, FALTA_CRITICO_CALCIO_IONICO,
} from '@/lib/hospital/lab-criticos'

const juzga = (estudio: string, valor: number, unidad?: string) =>
  evaluarCriticoLab(estudio, valor, unidad)

describe('los dos falsos críticos que lo motivan', () => {
  it('«Glucosa en orina (EGO)» = 500 ya no es crítica', () => {
    const r = juzga('Glucosa en orina (EGO)', 500, 'mg/dL')
    expect(r.critico, 'una glucosuria corriente disparaba la alerta de glucemia').toBe(false)
  })

  it('«Calcio iónico» = 4.8 ya no es crítico — es un valor NORMAL', () => {
    const r = juzga('Calcio iónico', 4.8, 'mg/dL')
    expect(r.critico, 'un valor normal marcado como crítico').toBe(false)
  })

  it('y da igual cómo se escriba: iónico, ionizado, libre', () => {
    for (const nombre of ['Calcio ionico', 'Calcio ionizado', 'Calcio libre']) {
      expect(juzga(nombre, 4.8, 'mg/dL').critico, nombre).toBe(false)
    }
  })

  it('la bilirrubina del EGO tampoco', () => {
    expect(juzga('Bilirrubina en orina', 20, 'mg/dL').critico).toBe(false)
  })
})

describe('y lo que SÍ es crítico sigue siéndolo', () => {
  /**
   * El riesgo de una exclusión es apagar la alerta de verdad. Perder un crítico
   * real es incomparablemente peor que arrastrar uno falso.
   */
  for (const [estudio, valor, unidad] of [
    ['Glucosa', 450, 'mg/dL'],
    ['Glucosa', 40, 'mg/dL'],
    ['Calcio', 5.2, 'mg/dL'],
    ['Calcio', 14, 'mg/dL'],
    ['Bilirrubina total', 18, 'mg/dL'],
    ['Potasio', 6.8, 'mEq/L'],
    ['Sodio', 118, 'mEq/L'],
  ] as const) {
    it(`«${estudio}» ${valor} ${unidad} sigue siendo crítico`, () => {
      expect(juzga(estudio, valor, unidad).critico).toBe(true)
    })
  }

  it('y un calcio total normal no alerta', () => {
    expect(juzga('Calcio', 9.1, 'mg/dL').critico).toBe(false)
  })
})

describe('no se inventa el umbral del iónico, y se dice', () => {
  it('la decisión está declarada con lo que hace falta', () => {
    expect(FALTA_CRITICO_CALCIO_IONICO).toContain('NEEDS_CLINICAL_REVIEW')
    expect(FALTA_CRITICO_CALCIO_IONICO).toMatch(/no se marca/i)
  })

  it('y sigue la convención que la hace aparecer sola ante el dueño', () => {
    /**
     * El nombre empieza por `FALTA_` a propósito: así la recoge
     * `scripts/calidad/lo-que-espera-al-dueno.mjs` sin que nadie la añada a
     * ninguna lista. Una decisión que hay que acordarse de apuntar es una
     * decisión que se pierde.
     */
    const fuente = FALTA_CRITICO_CALCIO_IONICO
    expect(typeof fuente).toBe('string')
    expect(fuente.length).toBeGreaterThan(80)
  })
})
