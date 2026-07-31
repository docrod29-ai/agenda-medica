/**
 * GOLDEN — el plan de la nota, desde el Copilot.
 *
 * El Dr.: «que funcione el copiloto CON la nota… y genere la mejor nota con las
 * mejores recomendaciones y plan incluido, ya para cuando pasa a revisar y
 * firmar». Antes el Copilot razonaba en su recuadro y ahí se quedaba: el médico
 * lo leía y escribía el plan a mano, otra vez.
 *
 * Lo que se protege aquí es lo que NO hace:
 *  · No entra en la nota sin que el médico lo pida.
 *  · Llega marcado como PROPUESTA, para que se distinga de lo que él escribió.
 *  · Si él ya escribió un plan, el propuesto va DEBAJO. Nunca lo pisa.
 *  · Conserva la redacción del Copilot: reescribirla sería interpretar un
 *    razonamiento clínico.
 */
import { describe, it, expect } from 'vitest'
import { planDesdeCopilot, combinarPlan, ENCABEZADO_PROPUESTA } from '@/lib/uci/plan-desde-copilot'
import type { FusionCopilot, ProblemaCopilot } from '@/lib/uci/copilot'

const p = (o: Partial<ProblemaCopilot>): ProblemaCopilot => ({
  sistema: 'respiratorio', titulo: 'SDRA moderado', cambio: '', porque: 'P/F 140',
  soporte: '', faltante: 'PBW por falta de talla', prioridad: 'alta', ...o,
})
const fusion = (over: Partial<FusionCopilot> = {}): FusionCopilot => ({
  primario: { resumen: 'r', problemas: [p({})], faltantesClave: [], seguridad: [] },
  segunda: null, divergencias: [], modelos: { primario: 'x', segunda: null }, ...over,
})

describe('El razonamiento del Copilot llega al plan', () => {
  const r = planDesdeCopilot(fusion())

  it('trae el problema con SU redacción, no reescrita', () => {
    expect(r.texto).toContain('SDRA moderado')
    expect(r.texto).toContain('P/F 140')
    expect(r.texto).toContain('Falta para decidir: PBW por falta de talla')
  })

  it('agrupa por sistema', () => {
    expect(r.texto).toContain('Respiratorio')
  })

  it('lo ALTO va antes que lo bajo dentro de un sistema', () => {
    const r2 = planDesdeCopilot(fusion({
      primario: {
        resumen: '', faltantesClave: [], seguridad: [],
        problemas: [p({ titulo: 'Menor', prioridad: 'baja' }), p({ titulo: 'Urgente', prioridad: 'alta' })],
      },
    }))
    expect(r2.texto.indexOf('Urgente')).toBeLessThan(r2.texto.indexOf('Menor'))
  })
})

describe('Se distingue de lo que escribió el médico', () => {
  it('va encabezado como PROPUESTA y dice que no es una indicación', () => {
    expect(planDesdeCopilot(fusion()).texto).toContain(ENCABEZADO_PROPUESTA)
    expect(ENCABEZADO_PROPUESTA).toMatch(/no es una indicaci[oó]n/i)
    expect(ENCABEZADO_PROPUESTA).toMatch(/firmar/i)
  })

  it('las divergencias van APARTE y se dicen como tales', () => {
    const r = planDesdeCopilot(fusion({ divergencias: [p({ titulo: 'Otra cosa' })] }))
    expect(r.texto).toMatch(/segunda opini[oó]n a[ñn]ade/i)
    expect(r.texto).toContain('Otra cosa')
    expect(r.divergencias).toBe(1)
  })
})

describe('NUNCA pisa lo que escribió el médico', () => {
  const prop = planDesdeCopilot(fusion())

  it('si él ya escribió, lo propuesto va DEBAJO', () => {
    const r = combinarPlan('Continuar VA-ECMO. Destete de aminas.', prop)
    expect(r.indexOf('Continuar VA-ECMO')).toBeLessThan(r.indexOf(ENCABEZADO_PROPUESTA))
  })

  it('si él no escribió nada, queda sólo la propuesta', () => {
    expect(combinarPlan('', prop)).toBe(prop.texto)
  })

  it('sin propuesta, el plan del médico no se toca', () => {
    const mio = 'Mi plan.'
    expect(combinarPlan(mio, planDesdeCopilot(null))).toBe(mio)
  })
})

describe('Sin nada que proponer, no se inventa relleno', () => {
  it('un Copilot sin problemas da texto vacío', () => {
    const r = planDesdeCopilot(fusion({
      primario: { resumen: '', problemas: [], faltantesClave: [], seguridad: [] },
    }))
    expect(r.texto).toBe('')
    expect(r.problemas).toBe(0)
  })

  it('sin Copilot, vacío', () => {
    expect(planDesdeCopilot(null).texto).toBe('')
  })
})
