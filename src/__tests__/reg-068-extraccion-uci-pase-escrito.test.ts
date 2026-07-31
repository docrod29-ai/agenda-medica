/**
 * REG-068 — el pase de UCI escrito no llegaba al panel.
 *
 * El 30-jul-2026 el Dr. metió un pase completo de un choque cardiogénico en
 * VA-ECMO —pH, PaCO₂, FiO₂, PEEP, volumen corriente, tres aminas, RASS— y la
 * pantalla le contestó:
 *
 *     «No se puede calcular índice de Kirby (P/F): falta PaO₂ y FiO₂»
 *
 * Los había dado los dos. El panel quedó casi vacío, los motores no calcularon
 * nada, el Copilot no tuvo snapshot que razonar, y todo el dictado se volcó en
 * crudo al final de la nota. Cuatro causas, ninguna clínica:
 *
 *  1. **Subíndices.** «PaO₂» lleva U+2082, no el «2» del teclado. El extractor
 *     buscaba `pao2` y no casaba NUNCA. Igual FiO₂, PaCO₂, SpO₂, HCO₃, cmH₂O.
 *  2. **Dos puntos.** El separador aceptado era el espacio. Un pase escrito usa
 *     «pH: 7.19», y eso no casaba.
 *  3. **Viñetas.** «Noradrenalina\n* 0.42 µg/kg/min» — el asterisco entre el
 *     nombre y la cifra rompía la coincidencia.
 *  4. **Modos abreviados.** «Modo: VC-AC» no estaba en la lista, así que caía al
 *     `else if` de «no invasiva» —porque el texto mencionaba una VNI en el plan
 *     de destete— y la nota afirmaba **«Ventilación no invasiva (BiPAP)» sobre un
 *     paciente intubado y en ECMO**. Ése es el peor de los cuatro.
 *
 * Medido: 2 campos → 21.
 */
import { describe, it, expect } from 'vitest'
import { extraerValoresUCIConAvisos, extraerCategoricosUCI } from '@/lib/uci/extraccion'

/** Fragmento del pase real, con su formato original. Sin datos de paciente. */
const PASE = `
5. Respiratorio
Paciente intubado.
Modo: VC-AC.
* VT: 430 mL.
* FR: 22 rpm.
* FiO₂: 60%.
* PEEP: 8 cmH₂O.
* P pico: 28 cmH₂O.
* pH: 7.19.
* HCO₃⁻: 12 mmol/L.
* PaCO₂: 32.
* Lactato: 8.7 mmol/L.
2. Cardiovascular
* FC: 128 lpm, sinusal.
Noradrenalina
* 0.42 µg/kg/min.
Adrenalina
* 0.12 µg/kg/min.
Dobutamina
* 7.5 µg/kg/min.
Actualmente
* RASS: −4.
* Glasgow: 13.
Glucosa: 214 mg/dL.
Creatinina: 2.4 mg/dL.
Temperatura: 36.1 °C.
Se plantea ventilación no invasiva al destete.
`

describe('REG-068 · el pase escrito llega entero al panel', () => {
  const { valores } = extraerValoresUCIConAvisos(PASE)

  it('los subíndices ya no esconden el dato', () => {
    expect(valores.fio2).toBe('60')     // FiO₂
    expect(valores.paco2).toBe('32')    // PaCO₂
    expect(valores.hco3).toBe('12')     // HCO₃⁻
  })

  it('los dos puntos separan igual que un espacio', () => {
    expect(valores.ph).toBe('7.19')
    expect(valores.peep).toBe('8')
    expect(valores.vt).toBe('430')
  })

  it('una viñeta entre el fármaco y su dosis no la esconde', () => {
    expect(valores.norepi).toBe('0.42')
    expect(valores.epi).toBe('0.12')
    expect(valores.dobu).toBe('7.5')
  })

  it('el menos de verdad (U+2212) se lee como negativo', () => {
    expect(valores.rass).toBe('-4')
  })

  it('el pase completo llena el panel, no dos campos', () => {
    expect(Object.keys(valores).length).toBeGreaterThanOrEqual(18)
  })
})

describe('REG-068 · el modo ventilatorio no puede salir al revés', () => {
  it('«Modo: VC-AC» en un intubado NO es ventilación no invasiva', () => {
    const c = extraerCategoricosUCI(PASE)
    expect(c.modo).toBe('AC-VC')
    expect(c.modo).not.toBe('VNI')
    expect(c.soporte).toBe('si')
  })

  it('las abreviaturas escritas se reconocen', () => {
    for (const [texto, esperado] of [
      ['Modo: VC-AC', 'AC-VC'], ['Modo VCV', 'AC-VC'], ['AC-VC', 'AC-VC'],
      ['Modo: PC-AC', 'AC-PC'], ['PCV a 20', 'AC-PC'], ['PRVC', 'AC-VC'],
    ] as const) {
      expect(extraerCategoricosUCI(texto).modo, texto).toBe(esperado)
    }
  })

  it('una VNI de verdad sigue saliendo VNI', () => {
    expect(extraerCategoricosUCI('Paciente con BiPAP nocturno').modo).toBe('VNI')
    expect(extraerCategoricosUCI('en ventilación no invasiva').modo).toBe('VNI')
  })

  it('lo específico gana a lo genérico aunque la VNI se mencione después', () => {
    // Ésta es la trampa exacta que se comió el caso real.
    const t = 'Modo: VC-AC. Se plantea ventilación no invasiva al destete.'
    expect(extraerCategoricosUCI(t).modo).toBe('AC-VC')
  })
})

describe('REG-068 · lo que NO cambió', () => {
  it('el dictado hablado de siempre sigue funcionando', () => {
    const { valores } = extraerValoresUCIConAvisos(
      'peep de ocho, fio2 de sesenta, lactato de ocho punto siete')
    expect(valores.peep).toBe('8')
    expect(valores.fio2).toBe('60')
    expect(valores.lactato).toBe('8.7')
  })

  it('un valor imposible sigue sin prellenar el panel', () => {
    const { valores, avisos } = extraerValoresUCIConAvisos('potasio: 50')
    expect(valores.k).toBeUndefined()
    expect(avisos.some(a => a.campo === 'k' && a.motivo === 'implausible')).toBe(true)
  })

  it('«pip» sigue siendo presión pico y NUNCA PEEP', () => {
    const { valores } = extraerValoresUCIConAvisos('PIP: 28. PEEP: 8.')
    expect(valores.ppico).toBe('28')
    expect(valores.peep).toBe('8')
  })
})
