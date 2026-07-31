/**
 * REG-074 — una especificación de software dentro del expediente de un paciente.
 *
 * En el pase real del Dr. apareció, en la nota de un enfermo en VA-ECMO:
 *
 *   «Debe permitirse que los objetivos sean configurables por protocolo
 *    institucional, no hardcodearlos como un único rango universal.»
 *
 * Eso es un requisito que él me estaba dictando A MÍ mientras probaba la app, y
 * el pase lo arrastró al documento clínico. Una nota no habla de la aplicación.
 *
 * El filtro es DELIBERADAMENTE estrecho: sacar una frase clínica de la nota sería
 * mucho peor que dejar una de software, así que se exige un verbo de requisito y
 * al sistema como sujeto.
 */
import { describe, it, expect } from 'vitest'
import { esInstruccionAlSistema, repartirPorSistemas } from '@/lib/uci/reparto-sistemas'

describe('REG-074 · saca lo que le habla al software', () => {
  it('las frases que aparecieron de verdad en su pase', () => {
    for (const l of [
      'Debe permitirse que los objetivos sean configurables por protocolo institucional, no hardcodearlos como un único rango universal.',
      'El sistema debe mostrar individualmente los accesos.',
      'La depuración de lactato debe mostrarse como tendencia y no simplemente el valor aislado.',
    ]) expect(esInstruccionAlSistema(l), l.slice(0, 40)).toBe(true)
  })

  it('desaparece de la sección, no queda a medias', () => {
    const r = repartirPorSistemas(`13. Anticoagulación ECMO
* Anti-Xa: 0.31 IU/mL.
Debe permitirse que los objetivos sean configurables por protocolo institucional.`)
    expect(r.hematoinfeccioso).toContain('Anti-Xa')
    expect(r.hematoinfeccioso).not.toMatch(/configurables|protocolo institucional/i)
  })
})

describe('REG-074 · NO toca lo clínico — eso sería mucho peor', () => {
  it('«el sistema respiratorio» no es el sistema informático', () => {
    expect(esInstruccionAlSistema('El sistema respiratorio muestra edema intersticial bilateral.')).toBe(false)
    expect(esInstruccionAlSistema('Exploración por aparatos y sistemas sin cambios.')).toBe(false)
  })

  it('una indicación clínica con «debe» se queda', () => {
    for (const l of [
      'Debe vigilarse la apertura valvular aórtica.',
      'Se debe considerar descarga de VI.',
      'Debe mantenerse PAM mayor de 65 mmHg.',
      'Hay que repetir la gasometría en 2 horas.',
    ]) expect(esInstruccionAlSistema(l), l).toBe(false)
  })

  it('el texto clínico normal jamás cae', () => {
    for (const l of [
      'Paciente intubado en modo VC-AC.', 'Lactato 8.7 mmol/L en descenso.',
      'Sin evidencia importante de hemólisis en este momento.',
    ]) expect(esInstruccionAlSistema(l), l).toBe(false)
  })
})
