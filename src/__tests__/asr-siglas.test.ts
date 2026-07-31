/**
 * GOLDEN — siglas (etapa 5 del pipeline de dictado).
 *
 * La regla que se protege: **un alias que es el significado de la sigla no se
 * sustituye.** Si el médico dictó «presión positiva al final de la espiración»,
 * la nota dice eso; no le corresponde al pipeline decidir cómo redacta.
 */
import { describe, it, expect } from 'vitest'
import { SIGLAS, normalizarSiglas, formasDeLectura } from '@/lib/asr/siglas'
import aliases from '@/lib/asr/data/aliases.json'

const n = (t: string) => normalizarSiglas(t).texto

describe('Ortografía — sí se corrige', () => {
  it('la caja de la sigla', () => {
    expect(n('paciente en cvvhdf')).toBe('paciente en CVVHDF')
    expect(n('pao2 60 y paco2 50')).toBe('PaO2 60 y PaCO2 50')
    expect(n('vexus grado 2')).toBe('VExUS grado 2')
    expect(n('tapse de 14')).toBe('TAPSE de 14')
  })

  it('la forma hablada del acrónimo', () => {
    expect(n('ECMO veno venoso')).toBe('ECMO VV')
    expect(n('ECMO venoarterial')).toBe('ECMO VA')
    expect(n('maldi tof positivo')).toBe('MALDI-TOF positivo')
    expect(n('CRRT desde ayer')).toBe('CKRT desde ayer')
  })

  it('una sigla no se come el principio de otra más larga', () => {
    expect(n('cvvh sin diálisis')).toBe('CVVH sin diálisis')
    expect(n('cvvhd desde ayer')).toBe('CVVHD desde ayer')
    expect(n('cvvhdf a 25 mL/kg/h')).toBe('CVVHDF a 25 mL/kg/h')
  })
})

describe('Significado — NO se sustituye', () => {
  it('la frase completa se queda como el médico la dictó', () => {
    for (const t of [
      'presión positiva al final de la espiración de 8',
      'ventilación no invasiva por la noche',
      'concentración mínima inhibitoria de 2',
      'escala de Glasgow de 15',
      'hemoglobina glucosilada de 8.2',
    ]) {
      expect(n(t), t).toBe(t)
    }
  })

  it('«PaFi» no se reescribe: es como el Dr. la dice', () => {
    expect(n('PaFi de 120')).toBe('PaFi de 120')
  })

  it('«ESBL» es la sigla inglesa, no otra grafía de BLEE', () => {
    expect(n('ESBL positivo')).toBe('ESBL positivo')
  })
})

describe('Fidelidad al paquete del Dr.', () => {
  it('están las 35 siglas de aliases.json, ni una más ni una menos', () => {
    const suyas = Object.keys(aliases as Record<string, string[]>).sort()
    expect(SIGLAS.map(s => s.canonica).sort()).toEqual(suyas)
  })

  it('cada alias suyo está clasificado, en ortográfico o en lectura', () => {
    const mapa = aliases as Record<string, string[]>
    for (const s of SIGLAS) {
      const declarados = new Set([...s.ortograficos, ...s.lectura].map(x => x.toLowerCase()))
      for (const a of mapa[s.canonica]) {
        expect(declarados.has(a.toLowerCase()), `${s.canonica} · «${a}» sin clasificar`).toBe(true)
      }
    }
  })

  it('las formas añadidas por encima de su lista están declaradas aquí', () => {
    // Lo único que se añade es «oxa 48»: cuando la normalización de cifras corre
    // antes, «oxa cuarenta y ocho» ya llegó a esta etapa convertido.
    const mapa = aliases as Record<string, string[]>
    const suyas = new Set(Object.values(mapa).flat().map(x => x.toLowerCase()))
    const extra = SIGLAS
      .flatMap(s => [...s.ortograficos, ...s.lectura])
      .filter(f => !suyas.has(f.toLowerCase()))
    expect(extra).toEqual(['oxa 48'])
  })

  it('ninguna forma de lectura se cuela en las reescrituras', () => {
    for (const s of SIGLAS) {
      for (const l of s.lectura) {
        expect(s.ortograficos, `${s.canonica} · ${l}`).not.toContain(l)
      }
    }
  })

  it('las formas de lectura sirven para reconocer', () => {
    const m = formasDeLectura()
    expect(m.get('presion positiva al final de la espiracion')).toBe('PEEP')
    expect(m.get('esbl')).toBe('BLEE')
    expect(m.get('pafi')).toBe('P/F')
  })
})

describe('Lo que no se toca', () => {
  it('el texto sin siglas sale idéntico', () => {
    const t = 'Paciente estable, afebril, sin datos de sangrado.'
    expect(n(t)).toBe(t)
  })

  it('no casa dentro de otra palabra', () => {
    expect(n('mica y micosis')).toBe('mica y micosis')
  })

  it('cada cambio queda declarado', () => {
    expect(normalizarSiglas('cvvhdf').cambios).toEqual([{ antes: 'cvvhdf', despues: 'CVVHDF' }])
    expect(normalizarSiglas('CVVHDF').cambios).toEqual([])
  })
})
