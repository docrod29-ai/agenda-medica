import { describe, it, expect } from 'vitest'
import { detectarComando, normalizarTexto } from '@/lib/voz/comandos'

describe('Comandos de voz — manos libres', () => {
  it('detecta variantes de INICIAR', () => {
    for (const s of [
      'iniciar consulta', 'Iniciar consulta', 'inicia consulta', 'inicie la consulta',
      'vamos a empezar consulta', 'comenzar consulta', 'comienza la consulta',
      'abrir consulta', 'nueva consulta', 'INICIAR CONSULTA por favor',
    ]) {
      expect(detectarComando(s), `debía iniciar: "${s}"`).toBe('iniciar')
    }
  })

  it('detecta variantes de CERRAR', () => {
    for (const s of [
      'cerrar consulta', 'cierra la consulta', 'terminar consulta', 'finalizar la consulta',
      'ya cerrar consulta', 'guardar consulta', 'detener consulta', 'termina la consulta',
    ]) {
      expect(detectarComando(s), `debía cerrar: "${s}"`).toBe('cerrar')
    }
  })

  it('ignora frases normales de la conversación', () => {
    for (const s of [
      'el paciente refiere dolor', 'vamos a revisar la herida', 'consulta de control',
      'la consulta anterior fue en marzo', '', 'iniciar tratamiento', 'cerrar la puerta',
    ]) {
      expect(detectarComando(s), `no debía disparar: "${s}"`).toBe(null)
    }
  })

  it('normaliza acentos y mayúsculas', () => {
    expect(normalizarTexto('  INICIÁR   Consúlta ')).toBe('iniciar consulta')
  })
})
