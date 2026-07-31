/**
 * nexusmed-icu-003 · VOICE_CAPTURE
 * Comandos de voz manos-libres para UCI (parser puro string → intención).
 */
import { describe, it, expect } from 'vitest'
import { interpretarComandoUCI, parsearNumeroEs } from '@/lib/voz/comandos-uci'

describe('parsearNumeroEs', () => {
  it('enteros en palabra o dígito', () => {
    expect(parsearNumeroEs('ocho')).toBe('8')
    expect(parsearNumeroEs('40')).toBe('40')
    expect(parsearNumeroEs('cuarenta')).toBe('40')
    expect(parsearNumeroEs('treinta y cinco')).toBe('35')
  })
  it('decimales por "punto"', () => {
    expect(parsearNumeroEs('cero punto cuatro')).toBe('0.4')
    expect(parsearNumeroEs('cinco punto ocho')).toBe('5.8')
    expect(parsearNumeroEs('siete punto tres dos')).toBe('7.32')
  })
  it('null si no reconoce', () => {
    expect(parsearNumeroEs('hola')).toBeNull()
  })
})

describe('interpretarComandoUCI — navegación por sistema', () => {
  it('reconoce cada aparato/sistema', () => {
    expect(interpretarComandoUCI('iniciar neurológico')).toEqual({ tipo: 'navegar', sistema: 'neurologic' })
    expect(interpretarComandoUCI('pasar a respiratorio')).toEqual({ tipo: 'navegar', sistema: 'respiratory' })
    expect(interpretarComandoUCI('ir a hemodinamia')).toEqual({ tipo: 'navegar', sistema: 'hemodynamic' })
    expect(interpretarComandoUCI('vamos a ultrasonido')).toEqual({ tipo: 'navegar', sistema: 'ultrasound' })
  })
})

describe('interpretarComandoUCI — corregir, plan, pendiente, control', () => {
  it('corregir <campo> a <valor>', () => {
    expect(interpretarComandoUCI('corregir PEEP a ocho')).toEqual({ tipo: 'corregir', campo: 'peep', valor: '8' })
    expect(interpretarComandoUCI('corrige FiO2 a cero punto cuatro')).toEqual({ tipo: 'corregir', campo: 'fio2', valor: '0.4' })
  })
  it('agregar al plan captura el texto', () => {
    expect(interpretarComandoUCI('agregar al plan destetar ventilador')).toEqual({ tipo: 'agregar_plan', texto: 'destetar ventilador' })
  })
  it('marcar pendiente', () => {
    expect(interpretarComandoUCI('marcar como pendiente solicitar cultivo')).toEqual({ tipo: 'marcar_pendiente', texto: 'solicitar cultivo' })
  })
  it('eliminar / repetir / finalizar / cancelar', () => {
    expect(interpretarComandoUCI('eliminar la última frase')).toEqual({ tipo: 'eliminar_ultimo' })
    expect(interpretarComandoUCI('repetir el último dato')).toEqual({ tipo: 'repetir_ultimo' })
    expect(interpretarComandoUCI('finalizar nota')).toEqual({ tipo: 'finalizar' })
    expect(interpretarComandoUCI('cancelar')).toEqual({ tipo: 'cancelar' })
  })
})

describe('interpretarComandoUCI — contenido clínico normal', () => {
  it('devuelve null cuando NO es un comando (es dictado clínico)', () => {
    expect(interpretarComandoUCI('paciente bajo sedación con propofol, RASS menos cuatro')).toBeNull()
    expect(interpretarComandoUCI('norepinefrina cero punto doce microgramos por kilo por minuto')).toBeNull()
    expect(interpretarComandoUCI('')).toBeNull()
  })
})
