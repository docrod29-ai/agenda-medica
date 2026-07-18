import { describe, it, expect } from 'vitest'
import {
  ASA, asaTexto, rcri, RCRI_FACTORES,
  caprini, sumarCaprini, CAPRINI_FACTORES,
  apfel, APFEL_FACTORES,
  ANTIBIOTICOS_PROFILAXIS, ESQUEMAS_POR_CIRUGIA, planProfilaxis,
  CHECKLIST_OMS,
} from '@/lib/expediente/cirugia'

const ab = (n: string) => ANTIBIOTICOS_PROFILAXIS.find(a => a.nombre === n)!

describe('ASA', () => {
  it('tiene las seis clases', () => {
    expect(ASA.map(a => a.clase)).toEqual(['I', 'II', 'III', 'IV', 'V', 'VI'])
  })
  it('la urgencia agrega el modificador E', () => {
    expect(asaTexto('III', true)).toBe('ASA IIIE')
    expect(asaTexto('III', false)).toBe('ASA III')
  })
})

describe('RCRI', () => {
  it('son los seis predictores de Lee', () => {
    expect(RCRI_FACTORES).toHaveLength(6)
    expect(RCRI_FACTORES.join(' ')).toMatch(/insulina/i)
    expect(RCRI_FACTORES.join(' ')).toMatch(/2 mg\/dL/)
  })
  it('0 o 1 factor es riesgo bajo y se va a quirófano sin más estudios', () => {
    expect(rcri(0).nivel).toBe('bajo')
    expect(rcri(1).nivel).toBe('bajo')
    expect(rcri(1).interpretacion).toMatch(/no se requieren estudios/i)
  })
  it('2 factores ya es riesgo elevado y manda valorar capacidad funcional', () => {
    const r = rcri(2)
    expect(r.nivel).toBe('medio')
    expect(r.interpretacion).toMatch(/4 MET/)
  })
  it('3 o más es riesgo alto con valoración cardiológica', () => {
    expect(rcri(3).nivel).toBe('alto')
    expect(rcri(5).interpretacion).toMatch(/cardiol[óo]gica/i)
  })
})

describe('Caprini', () => {
  it('suma los pesos correctos de los factores', () => {
    // artroplastia electiva (5) + edad 61-74 (2) + cáncer (2) = 9
    expect(sumarCaprini(['Artroplastia electiva', 'Edad 61 a 74 años', 'Cáncer'])).toBe(9)
  })
  it('ignora textos que no están en el catálogo (no inventa puntos)', () => {
    expect(sumarCaprini(['algo que no existe'])).toBe(0)
  })
  it('0 puntos: solo deambulación, sin profilaxis', () => {
    const r = caprini(0)
    expect(r.nivel).toBe('bajo')
    expect(r.profilaxis).toMatch(/no se requiere profilaxis/i)
  })
  it('1-2 puntos: profilaxis mecánica', () => {
    expect(caprini(2).profilaxis).toMatch(/mec[áa]nica/i)
    expect(caprini(2).profilaxis).not.toMatch(/heparina/i)
  })
  it('3-4 puntos: entra la profilaxis farmacológica', () => {
    expect(caprini(4).nivel).toBe('medio')
    expect(caprini(4).profilaxis).toMatch(/heparina/i)
  })
  it('≥5 puntos: farmacológica MÁS mecánica y valorar profilaxis extendida', () => {
    const r = caprini(9)
    expect(r.nivel).toBe('alto')
    expect(r.profilaxis).toMatch(/28 a 35 d[íi]as/)
  })
  it('todos los factores tienen un peso válido de Caprini', () => {
    for (const f of CAPRINI_FACTORES) expect([1, 2, 3, 5]).toContain(f.puntos)
  })
})

describe('Apfel', () => {
  it('son los cuatro factores', () => {
    expect(APFEL_FACTORES).toHaveLength(4)
  })
  it('el riesgo sube con cada factor', () => {
    expect(apfel(0).riesgo).toBe(10)
    expect(apfel(2).riesgo).toBe(39)
    expect(apfel(4).riesgo).toBe(79)
  })
  it('2 factores piden dos antieméticos de mecanismos distintos', () => {
    expect(apfel(2).conducta).toMatch(/dos antiem[ée]ticos/i)
  })
  it('3 o más pide además reducir el riesgo basal', () => {
    expect(apfel(3).conducta).toMatch(/propofol/i)
    expect(apfel(3).conducta).toMatch(/[óo]xido nitroso/i)
  })
  it('acota valores fuera de rango en vez de romperse', () => {
    expect(apfel(-2).riesgo).toBe(10)
    expect(apfel(9).riesgo).toBe(79)
  })
})

describe('Profilaxis antibiótica: re-dosificación intraoperatoria', () => {
  it('cefazolina en una cirugía de 9 h se re-dosifica a las 4 y a las 8 h', () => {
    const p = planProfilaxis(ab('Cefazolina'), 9)
    expect(p.momentosRedosis).toEqual([4, 8])
    expect(p.redosis).toMatch(/a las 4 h, a las 8 h/)
  })

  it('cefoxitina se re-dosifica cada 2 h (vida media más corta)', () => {
    expect(planProfilaxis(ab('Cefoxitina'), 7).momentosRedosis).toEqual([2, 4, 6])
  })

  it('una cirugía corta no alcanza el primer intervalo', () => {
    const p = planProfilaxis(ab('Cefazolina'), 2)
    expect(p.momentosRedosis).toEqual([])
    expect(p.redosis).toMatch(/no se alcanza el primer intervalo/i)
  })

  it('exactamente en el intervalo todavía no toca re-dosis', () => {
    expect(planProfilaxis(ab('Cefazolina'), 4).momentosRedosis).toEqual([])
  })

  it('los que no se re-dosifican lo dicen explícitamente', () => {
    expect(planProfilaxis(ab('Vancomicina'), 10).redosis).toMatch(/verificar el protocolo institucional/i)
    expect(planProfilaxis(ab('Gentamicina'), 10).momentosRedosis).toEqual([])
    expect(planProfilaxis(ab('Metronidazol'), 10).momentosRedosis).toEqual([])
  })

  it('vancomicina y ciprofloxacino se inician 120 min antes, no 60', () => {
    expect(planProfilaxis(ab('Vancomicina'), 3).inicio).toMatch(/120 minutos/)
    expect(planProfilaxis(ab('Ciprofloxacino'), 3).inicio).toMatch(/120 minutos/)
    expect(planProfilaxis(ab('Cefazolina'), 3).inicio).toMatch(/60 minutos/)
  })

  it('recuerda re-dosificar por sangrado mayor de 1500 mL', () => {
    expect(planProfilaxis(ab('Cefazolina'), 9).redosis).toMatch(/1 500 mL/)
  })

  it('siempre advierte NO prolongar más de 24 h', () => {
    const p = planProfilaxis(ab('Cefazolina'), 3)
    expect(p.duracion).toMatch(/24 horas/)
    expect(p.duracion).toMatch(/difficile/i)
  })

  it('cefazolina sube a 3 g en pacientes de 120 kg o más', () => {
    expect(ab('Cefazolina').dosis).toMatch(/3 g/)
  })
})

describe('Esquemas por tipo de cirugía', () => {
  it('todos traen alternativa para alergia a betalactámicos', () => {
    for (const e of ESQUEMAS_POR_CIRUGIA) expect(e.alergia.length).toBeGreaterThan(3)
  })
  it('la cesárea especifica ANTES de la incisión', () => {
    const c = ESQUEMAS_POR_CIRUGIA.find(e => /Ces[áa]rea/.test(e.cirugia))!
    expect(c.esquema).toMatch(/antes de la incisi[óo]n/i)
  })
  it('colorrectal cubre anaerobios', () => {
    const c = ESQUEMAS_POR_CIRUGIA.find(e => /Colorrectal/.test(e.cirugia))!
    expect(c.esquema).toMatch(/metronidazol|cefoxitina|sulbactam/i)
  })
})

describe('Lista de verificación de la OMS', () => {
  it('tiene las tres fases en orden', () => {
    expect(CHECKLIST_OMS.map(f => f.fase)).toEqual(['Entrada', 'Pausa quirúrgica', 'Salida'])
  })
  it('cada fase indica su momento y trae puntos', () => {
    for (const f of CHECKLIST_OMS) {
      expect(f.momento.length).toBeGreaterThan(5)
      expect(f.puntos.length).toBeGreaterThan(3)
    }
  })
  it('la pausa quirúrgica verifica la profilaxis antibiótica de los últimos 60 min', () => {
    const pausa = CHECKLIST_OMS.find(f => f.fase === 'Pausa quirúrgica')!
    expect(pausa.puntos.join(' ')).toMatch(/profilaxis antibi[óo]tica en los [úu]ltimos 60 minutos/i)
  })
  it('la salida incluye el conteo de gasas e instrumental', () => {
    const salida = CHECKLIST_OMS.find(f => f.fase === 'Salida')!
    expect(salida.puntos.join(' ')).toMatch(/conteo de gasas/i)
  })
})
