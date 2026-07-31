/**
 * GOLDEN — narrativa de la nota de UCI.
 *
 * La regla que se protege: **la narrativa no cambia ni una palabra ni una cifra.**
 * Cada dato que produce `nota.ts` ya es una oración completa; la narrativa sólo
 * las une en párrafo. Si alguien un día mete un modelo de lenguaje aquí, estos
 * casos se ponen rojos.
 */
import { describe, it, expect } from 'vitest'
import { aNarrativa, formatear, renglonesAhorrados } from '@/lib/uci/formato-nota'

const RESPIRATORIO = `Modo: Asistido-controlado por volumen (A/C VC).
FiO₂ 60%.
PEEP 8 cmH₂O.
Driving pressure 15 cmH₂O (Dentro de meta).
PaO₂/FiO₂ 140 — SDRA moderado por oxigenación (100–200).`

describe('La narrativa NO toca el contenido', () => {
  it('conserva todas las cifras, exactas', () => {
    const p = aNarrativa(RESPIRATORIO)
    for (const cifra of ['60%', '8 cmH₂O', '15 cmH₂O', '140', '100–200']) {
      expect(p, cifra).toContain(cifra)
    }
  })

  it('conserva el orden de los datos', () => {
    const p = aNarrativa(RESPIRATORIO)
    expect(p.indexOf('FiO₂')).toBeLessThan(p.indexOf('PEEP'))
    expect(p.indexOf('PEEP')).toBeLessThan(p.indexOf('Driving pressure'))
  })

  it('no pierde ninguna oración', () => {
    const p = aNarrativa(RESPIRATORIO)
    for (const l of RESPIRATORIO.split('\n')) expect(p).toContain(l.trim())
  })

  it('compacta de verdad: menos renglones, mismo texto', () => {
    const p = aNarrativa(RESPIRATORIO)
    expect(p.split('\n').filter(x => x.trim()).length).toBe(1)
    expect(RESPIRATORIO.split('\n').length).toBe(5)
  })
})

describe('Las advertencias NO se entierran en el párrafo', () => {
  const CON_AVISO = `RASS -4 (Sedación profunda).
Pupilas: isocoricas.
⚠ GCS 13 en paciente intubado es incoherente: el verbal NO es valorable.`

  it('el aviso queda en su propio renglón', () => {
    const p = aNarrativa(CON_AVISO)
    const lineas = p.split('\n').filter(x => x.trim())
    expect(lineas.some(l => l.startsWith('⚠'))).toBe(true)
    // Y no pegado al final de la prosa.
    expect(lineas.find(l => l.startsWith('⚠'))).toContain('GCS 13')
  })

  it('dos avisos no se funden entre sí', () => {
    const p = aNarrativa('Dato uno.\n⚠ Aviso A.\n⚠ Aviso B.')
    expect(p.split('\n').filter(l => l.startsWith('⚠'))).toHaveLength(2)
  })
})

describe('Los subtítulos del médico abren párrafo', () => {
  it('«Signos vitales» no se pega a la frase anterior', () => {
    const p = aNarrativa('Paciente estable.\nSignos vitales\nFC 128 lpm.\nPAM 57 mmHg.')
    expect(p).toContain('Signos vitales:')
    expect(p).toMatch(/Signos vitales:\s*FC 128/)
  })

  it('una viñeta pierde el bullet al entrar en prosa', () => {
    expect(aNarrativa('* FC: 128 lpm.\n* PAM: 57 mmHg.')).toBe('FC: 128 lpm. PAM: 57 mmHg.')
  })
})

describe('El formato «lista» es exactamente lo de antes', () => {
  const secciones = [{ key: 'r', label: 'Respiratorio', value: RESPIRATORIO }]

  it('no toca nada', () => {
    expect(formatear(secciones, 'lista')).toEqual(secciones)
  })

  it('narrativa sí cambia la forma, no el fondo', () => {
    const n = formatear(secciones, 'narrativa')
    expect(n[0].value).not.toBe(RESPIRATORIO)
    expect(n[0].label).toBe('Respiratorio')
    expect(n[0].value).toContain('PaO₂/FiO₂ 140')
  })

  it('se puede decir cuánto compacta, en vez de prometerlo', () => {
    expect(renglonesAhorrados(secciones)).toBe(4)
  })
})

describe('Lo que no puede romper', () => {
  it('vacío da vacío', () => {
    expect(aNarrativa('')).toBe('')
    expect(aNarrativa('   \n  \n ')).toBe('')
  })

  it('una sola línea se queda igual', () => {
    expect(aNarrativa('Glucosa 214 mg/dL.')).toBe('Glucosa 214 mg/dL.')
  })

  it('nunca lanza', () => {
    for (const t of ['⚠', '*', '\n\n\n', 'a'.repeat(500)]) {
      expect(() => aNarrativa(t), t.slice(0, 10)).not.toThrow()
    }
  })
})
