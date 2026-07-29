import { describe, it, expect } from 'vitest'
import { interpretarCMI } from '@/lib/expediente/antibiograma/clsi-breakpoints'
import { validarAlergiasVsMedicamentos } from '@/lib/expediente/medical-dictionary'
import { interpretarAntibiograma } from '@/lib/expediente/antibiograma/motor'
import { resumenDeterminista } from '@/lib/expediente/antibiograma/razonar'
import { validarRazonamiento } from '@/lib/expediente/antibiograma/validar-razonamiento'
import { resumenParaNota } from '@/lib/expediente/antibiograma/resumen-nota'

/**
 * E0-15 — decisiones clínicas del médico dueño (28-jul-2026).
 * Fuente canónica: docs/clinical-decisions/DECISIONES-2026-07-28.md
 *
 * Sólo se prueba lo IMPLEMENTADO hoy: (c) CMI censurada y (d) carbapenémicos.
 * (a) propagación del effectiveAST y (b) MISSING → UNKNOWN van en su propio lote.
 */

// ══════════════════════════════════════════════════════════════════════════
// (c) CMI CENSURADA — «una CMI es un intervalo, no un número»
// ══════════════════════════════════════════════════════════════════════════
describe('E0-15c · la CMI conserva su operador', () => {
  it('neumococo penicilina «>2» NO puede ser S (el falso susceptible que había)', () => {
    // Sin operador, ">2" se leía como 2 y caía en S = "tratable con penicilina".
    const sinOperador = interpretarCMI('Streptococcus pneumoniae', 'Penicilina', 2)
    const conOperador = interpretarCMI('Streptococcus pneumoniae', 'Penicilina', 2, undefined, '>')
    expect(sinOperador?.categoria).toBe('S')          // comportamiento previo
    expect(conOperador?.categoria).not.toBe('S')      // ya no
    expect(conOperador?.desdeCmiCensurada).toBe(true) // y dice por qué
  })

  it('el criterio MENÍNGEO también respeta el operador', () => {
    const c = interpretarCMI('Streptococcus pneumoniae', 'Penicilina', 0.06, 'snc', '>')
    expect(c?.categoria).not.toBe('S')
  })

  it('«>X» por debajo del techo de S sí puede seguir siendo S', () => {
    // ceftriaxona en Enterobacterales: S ≤1. Un ">0.25" no descarta S.
    const c = interpretarCMI('Escherichia coli', 'Ceftriaxona', 0.25, undefined, '>')
    expect(c?.categoria).toBe('S')
    expect(c?.desdeCmiCensurada).toBeFalsy()
  })

  it('«<X» NO degrada: por debajo del rango sigue pudiendo ser S', () => {
    const c = interpretarCMI('Escherichia coli', 'Meropenem', 1, undefined, '<')
    expect(c?.categoria).toBe('S')
  })

  it('un «>X» que ya es R se queda en R (no se inventa nada)', () => {
    const c = interpretarCMI('Escherichia coli', 'Meropenem', 8, undefined, '>')
    expect(c?.categoria).toBe('R')
  })

  it('β-lactámicos de reserva: «>8» en CAZ-AVI no puede salir S', () => {
    // ceftazidima-avibactam en Enterobacterales: S ≤8.
    const c = interpretarCMI('Klebsiella pneumoniae', 'Ceftazidima-avibactam', 8, undefined, '>')
    expect(c?.categoria).not.toBe('S')
    expect(c?.desdeCmiCensurada).toBe(true)
  })

  it('no se sube a R por censura: el valor real podría estar en la banda intermedia', () => {
    const c = interpretarCMI('Streptococcus pneumoniae', 'Penicilina', 2, undefined, '>')
    expect(c?.categoria).not.toBe('R')
  })

  it('sin operador el comportamiento previo NO cambia (no hay regresión)', () => {
    expect(interpretarCMI('Escherichia coli', 'Meropenem', 1)?.categoria).toBe('S')
    expect(interpretarCMI('Escherichia coli', 'Meropenem', 4)?.categoria).toBe('R')
    expect(interpretarCMI('Escherichia coli', 'Cefepime', 4)?.categoria).toBe('SDD')
  })
})

// ══════════════════════════════════════════════════════════════════════════
// (d) CARBAPENÉMICOS + ALERGIA A PENICILINA — precaución, no contraindicación
// ══════════════════════════════════════════════════════════════════════════
describe('E0-15d · carbapenémico con alergia a penicilina', () => {
  const conAlergia = (reaccion?: string) => [{ alergeno: 'Penicilina', reaccion }]

  it('NO bloquea: la reactividad cruzada es <1%', () => {
    const a = validarAlergiasVsMedicamentos(conAlergia('urticaria'), [{ nombre: 'Meropenem' }])
    expect(a.some(x => x.severidad === 'critica')).toBe(false)
    expect(a.some(x => x.severidad === 'advertencia')).toBe(true)
  })

  it('el aviso explica que no es contraindicación y qué verificar', () => {
    const a = validarAlergiasVsMedicamentos(conAlergia(), [{ nombre: 'Imipenem' }])
    const msg = a.find(x => x.severidad === 'advertencia')!.mensaje
    expect(msg).toMatch(/<1\s*%/)
    expect(msg).toMatch(/NO es contraindicaci[oó]n/i)
  })

  it('aplica a todos los carbapenémicos', () => {
    for (const nombre of ['Meropenem', 'Imipenem', 'Ertapenem', 'Doripenem']) {
      const a = validarAlergiasVsMedicamentos(conAlergia(), [{ nombre }])
      expect(a.some(x => x.severidad === 'critica'), nombre).toBe(false)
    }
  })

  // ── Excepciones: aquí SÍ vuelve a ser crítica ──
  it('SCAR (Stevens-Johnson, DRESS, AGEP) → crítica', () => {
    for (const r of ['Síndrome de Stevens-Johnson', 'DRESS', 'AGEP pustulosis generalizada', 'necrólisis epidérmica tóxica']) {
      const a = validarAlergiasVsMedicamentos(conAlergia(r), [{ nombre: 'Meropenem' }])
      expect(a.some(x => x.severidad === 'critica'), r).toBe(true)
    }
  })

  it('daño de órgano (nefritis, hepatitis) → crítica', () => {
    for (const r of ['nefritis intersticial', 'hepatitis por fármaco']) {
      const a = validarAlergiasVsMedicamentos(conAlergia(r), [{ nombre: 'Ertapenem' }])
      expect(a.some(x => x.severidad === 'critica'), r).toBe(true)
    }
  })

  it('alergia al PROPIO carbapenémico → crítica', () => {
    const a = validarAlergiasVsMedicamentos([{ alergeno: 'Meropenem' }], [{ nombre: 'Meropenem' }])
    expect(a.some(x => x.severidad === 'critica')).toBe(true)
  })

  // ── Sin regresión en el resto de β-lactámicos ──
  it('penicilinas y cefalosporinas SIGUEN siendo críticas', () => {
    for (const nombre of ['Amoxicilina', 'Ampicilina', 'Ceftriaxona', 'Cefalexina']) {
      const a = validarAlergiasVsMedicamentos(conAlergia(), [{ nombre }])
      expect(a.some(x => x.severidad === 'critica'), nombre).toBe(true)
    }
  })

  it('sin alergia a β-lactámicos no se alerta de nada', () => {
    const a = validarAlergiasVsMedicamentos([{ alergeno: 'Sulfas' }], [{ nombre: 'Meropenem' }])
    expect(a.filter(x => x.campos?.includes('alergias'))).toEqual([])
  })
})

// ══════════════════════════════════════════════════════════════════════════
// (a) PROPAGACIÓN DE LA EDICIÓN EUCAST — el defecto P0
// «Nunca debe existir una pantalla donde Nexus muestre R y el LLM continúe
//  razonando con S.» — decisión del médico dueño
// ══════════════════════════════════════════════════════════════════════════
describe('E0-15a · la edición experta llega a TODAS las salidas', () => {
  // E. coli cipro-R → EUCAST T13.5 edita levo/moxi de S a R.
  const entrada = {
    organismo: 'Escherichia coli',
    resultados: [
      { antibiotico: 'Ciprofloxacino', interpretacion: 'R' as const },
      { antibiotico: 'Levofloxacino', interpretacion: 'S' as const },
      { antibiotico: 'Meropenem', interpretacion: 'S' as const },
    ],
  }
  const interp = interpretarAntibiograma(entrada)

  it('el motor edita levofloxacino S→R (premisa del caso)', () => {
    expect(interp.edicionesInterpretativas.some(e => /levofloxacino/i.test(e.antibiotico))).toBe(true)
  })

  it('el panel EFECTIVO trae la R, y conserva la S del laboratorio', () => {
    const levo = interp.resultadosEfectivos.find(x => /levofloxacino/i.test(x.antibiotico))!
    expect(levo.interpretacion).toBe('R')      // interpretación canónica
    expect(levo.interpretacionLab).toBe('S')   // el dato original NO se destruye
    expect(levo.edicionRazon).toBeTruthy()     // y dice por qué
    expect(levo.edicionReferencia).toMatch(/EUCAST/i)
  })

  it('lo NO editado se queda igual', () => {
    const mero = interp.resultadosEfectivos.find(x => /meropenem/i.test(x.antibiotico))!
    expect(mero.interpretacion).toBe('S')
    expect(mero.interpretacionLab).toBeUndefined()
  })

  it('el PROMPT del LLM ve R, no la S cruda', () => {
    const prompt = resumenDeterminista(entrada, interp)
    expect(prompt).toMatch(/Levofloxacino=R/)
    expect(prompt).not.toMatch(/Levofloxacino=S/)
    expect(prompt).toMatch(/EDITADO/)          // y sabe que no viene del lab
  })

  it('el VALIDADOR marca contradicción si el texto propone el fármaco editado', () => {
    const c = validarRazonamiento('Se recomienda iniciar levofloxacino 750 mg IV cada 24 h.', interp, entrada)
    expect(c.some(x => /levofloxacino/i.test(x.agente))).toBe(true)
  })

  it('la NOTA imprime la R y declara la edición con su fuente', () => {
    const nota = resumenParaNota(entrada, interp)
    expect(nota).toMatch(/Levofloxacino R/)
    expect(nota).toMatch(/regla experta/i)
    expect(nota).toMatch(/EUCAST/i)
  })

  it('el PK/PD ya no aconseja «dosis plena» de una FQ descartada', () => {
    const fq = interp.optimizacionPKPD.filter(t => /fluoroquinolona/i.test(t))
    expect(fq).toEqual([])
  })

  it('sin ediciones, el panel efectivo es el crudo (sin regresión)', () => {
    const simple = {
      organismo: 'Escherichia coli',
      resultados: [{ antibiotico: 'Meropenem', interpretacion: 'S' as const }],
    }
    const i2 = interpretarAntibiograma(simple)
    expect(i2.edicionesInterpretativas).toEqual([])
    expect(i2.resultadosEfectivos.map(x => x.interpretacion)).toEqual(['S'])
  })
})
