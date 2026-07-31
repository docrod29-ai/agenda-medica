/**
 * REG-069 — la nota de UCI decía cada aparato dos veces.
 *
 * El Dr., el 30-jul-2026: «¿por qué repites 2 veces los aparatos y sistemas?».
 *
 * `nota.ts:200` metía el pase ENTERO dentro de «Plan por sistema»:
 *
 *     { key: 'plan', value: `Discusión del pase:\n${opts.discusion}` }
 *
 * Y el pase de un intensivista ya viene ordenado por aparatos —«1. Neurológico»,
 * «2. Cardiovascular», «5. Respiratorio»—, así que la nota decía cada sistema dos
 * veces: una con los valores del panel y sus cálculos, y otra con el texto crudo
 * repetido al final.
 *
 * Encima, «Plan por sistema» decía otra cosa de la que hacía: un plan es lo que
 * se va a HACER, no la lista de lo que se encontró.
 *
 * Se reparte por los encabezados que el propio médico escribió. Sin modelo de
 * lenguaje y sin interpretación: si él no dijo a qué aparato pertenece algo, se
 * queda en el plan y no se adivina.
 */
import { describe, it, expect } from 'vitest'
import {
  repartirPorSistemas, claveDeEncabezado, tuvoEstructura,
} from '@/lib/uci/reparto-sistemas'

const PASE = `Discusión del pase:
Ingreso por miocarditis fulminante con choque cardiogénico SCAI E.
Día 1 de UCI, 6 horas posterior al ingreso.

1. Neurológico
Paciente bajo sedoanalgesia.
* RASS: -4.
Sedoanalgesia
* Propofol: 25 µg/kg/min.

2. Cardiovascular / hemodinámico
* FC: 128 lpm, sinusal.
* PAM: 57 mmHg.

5. Respiratorio
Paciente intubado.
Modo: VC-AC.

12. Hematológico
* Plaquetas: 118,000/µL.

13. Anticoagulación ECMO
* Anti-Xa: 0.31 IU/mL.

16. Metabólico/endocrino
Glucosa: 214 mg/dL.

18. Piel y vascular
* Extremidades frías.
`

describe('REG-069 · cada cosa bajo su aparato', () => {
  const r = repartirPorSistemas(PASE)

  it('lo neurológico va a neurológico', () => {
    expect(r.neurologico).toContain('RASS: -4')
    expect(r.neurologico).toContain('Propofol')
  })

  it('lo respiratorio va a respiratorio', () => {
    expect(r.respiratorio).toContain('intubado')
    expect(r.respiratorio).toContain('VC-AC')
  })

  it('lo hemodinámico va a hemodinámico', () => {
    expect(r.hemodinamico).toContain('FC: 128')
    expect(r.hemodinamico).toContain('PAM: 57')
  })

  it('hematología Y anticoagulación caen juntas en hematoinfeccioso', () => {
    expect(r.hematoinfeccioso).toContain('Plaquetas')
    expect(r.hematoinfeccioso).toContain('Anti-Xa')
  })

  it('lo metabólico va a hidrometabólico', () => {
    expect(r.hidrometabolico).toContain('Glucosa')
  })

  it('lo que NO tiene encabezado se queda en el plan', () => {
    expect(r.plan).toContain('miocarditis fulminante')
    expect(r.plan).toContain('Día 1 de UCI')
  })

  it('NADA aparece en dos sistemas a la vez — ése era el bug', () => {
    const claves = ['neurologico', 'respiratorio', 'hemodinamico', 'hidrometabolico',
      'hematoinfeccioso', 'musculoesqueletico', 'plan'] as const
    for (const marca of ['RASS: -4', 'VC-AC', 'PAM: 57', 'Anti-Xa', 'Glucosa: 214']) {
      const donde = claves.filter(k => r[k].includes(marca))
      expect(donde, `«${marca}» aparece en ${donde.join(' y ')}`).toHaveLength(1)
    }
  })

  it('el encabezado no se copia: la nota ya rotula la sección', () => {
    expect(r.neurologico).not.toMatch(/^1\.\s*Neurol/m)
    expect(r.respiratorio).not.toMatch(/^5\.\s*Respiratori/m)
  })
})

describe('REG-069 · qué es un encabezado y qué no', () => {
  it('reconoce los rótulos con y sin numeración', () => {
    expect(claveDeEncabezado('1. Neurológico')).toBe('neurologico')
    expect(claveDeEncabezado('Neurológico')).toBe('neurologico')
    expect(claveDeEncabezado('5. Respiratorio')).toBe('respiratorio')
    expect(claveDeEncabezado('Cardiovascular / hemodinámico')).toBe('hemodinamico')
    expect(claveDeEncabezado('13. Anticoagulación ECMO')).toBe('hematoinfeccioso')
  })

  it('una línea de DATOS no es un encabezado aunque empiece igual', () => {
    // «Respiratorio: FiO₂ 60%, PEEP 8» es un dato, no un rótulo. Si se tomara por
    // encabezado, el dato se perdería (los encabezados no se copian).
    expect(claveDeEncabezado('Respiratorio: FiO2 60%, PEEP 8, VT 430')).toBeNull()
    expect(claveDeEncabezado('Glucosa: 214 mg/dL.')).toBeNull()
    expect(claveDeEncabezado('* RASS: -4.')).toBeNull()
  })

  it('una frase larga tampoco es un encabezado', () => {
    expect(claveDeEncabezado(
      'Respiratorio con evolución favorable tras la pronación y buena tolerancia',
    )).toBeNull()
  })

  it('lo más específico gana a lo más general', () => {
    // Sin el orden, «Gasometrías ECMO» caería en hemodinámica por «ECMO».
    expect(claveDeEncabezado('7. Gasometrías ECMO')).toBe('respiratorio')
    expect(claveDeEncabezado('6. ECMO')).toBe('hemodinamico')
    expect(claveDeEncabezado('14. Hemólisis / circuito')).toBe('hematoinfeccioso')
  })
})

describe('REG-069 · lo que NO puede romper', () => {
  it('un pase SIN encabezados se queda entero en el plan, no se trocea', () => {
    const t = 'Paciente estable. Se continúa el mismo esquema. Pendiente cultivo.'
    const r = repartirPorSistemas(t)
    expect(r.plan).toBe(t)
    expect(tuvoEstructura(r)).toBe(false)
  })

  it('un pase vacío no rompe nada', () => {
    const r = repartirPorSistemas('')
    expect(tuvoEstructura(r)).toBe(false)
    expect(r.plan).toBe('')
  })

  it('no se pierde ni una línea con contenido', () => {
    const r = repartirPorSistemas(PASE)
    const juntas = Object.values(r).join('\n')
    for (const linea of PASE.split('\n')) {
      const l = linea.trim()
      if (!l || claveDeEncabezado(l)) continue   // los rótulos sí se quitan
      expect(juntas, `se perdió: «${l}»`).toContain(l)
    }
  })
})
