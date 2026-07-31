import { describe, it, expect } from 'vitest'
import {
  resolverUnidad,
  esCritica,
  sinTipoConfigurado,
  unidadesDelCatalogo,
  TIPO_SUGERIDO,
  TIPOS_UNIDAD,
  TIPO_UNIDAD_LABEL,
  AVISO_SIN_TIPO,
  type Unidad,
} from '@/lib/hospital/unidades'
import { SERVICIOS_HOSPITAL } from '@/types/hospital'

/**
 * El nombre lo pone el hospital, el TIPO lo entiende el software.
 *
 * El defecto que estos casos cierran: el listado de UCI decidía quién era
 * paciente crítico con una expresión sobre el TEXTO del servicio (`/uci|intensiv/`).
 * Un hospital que llame a su unidad «UTI», «5º Norte» o «Torre B» perdía a sus
 * pacientes de la pantalla, sin error y sin aviso. Y «Terapia Física» habría
 * entrado como terapia intensiva.
 *
 * Datos 100 % sintéticos.
 */

const u = (nombre: string, tipo: Unidad['tipo'], activa = true): Unidad =>
  ({ id: nombre, nombre, tipo, activa })

describe('NUNCA se razona sobre el nombre', () => {
  it('«5º Norte» configurada como crítica ES crítica', () => {
    // El caso que hoy fallaba: ningún texto de ese nombre dice «UCI».
    expect(esCritica('5º Norte', [u('5º Norte', 'critica')])).toBe(true)
  })

  it('«UTI Adultos» y «Torre B piso 3» también, si así se configuraron', () => {
    const unidades = [u('UTI Adultos', 'critica'), u('Torre B piso 3', 'critica')]
    expect(esCritica('UTI Adultos', unidades)).toBe(true)
    expect(esCritica('Torre B piso 3', unidades)).toBe(true)
  })

  it('«Terapia Física» configurada como piso NO es crítica ← el falso positivo', () => {
    expect(esCritica('Terapia Física', [u('Terapia Física', 'piso')])).toBe(false)
  })

  it('el nombre casa COMPLETO, nunca por subcadena', () => {
    // Con `includes` o una regex, «Terapia Física» casaría con «Terapia Intensiva».
    const unidades = [u('Terapia Intensiva', 'critica')]
    expect(esCritica('Terapia Física', unidades)).toBe(false)
    expect(resolverUnidad('Terapia Física', unidades).fuente).toBe('desconocida')
  })

  it('mayúsculas y espacios no cambian la respuesta', () => {
    const unidades = [u('UTI Adultos', 'critica')]
    expect(esCritica('  uti adultos  ', unidades)).toBe(true)
  })

  it('renombrar una unidad no cambia el comportamiento clínico', () => {
    // Se llama distinto, sigue siendo crítica porque su TIPO lo dice.
    expect(esCritica('Unidad Coronaria', [u('Unidad Coronaria', 'critica')])).toBe(true)
    expect(esCritica('Cuidados Intensivos Neuro', [u('Cuidados Intensivos Neuro', 'critica')])).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('la unidad configurada por el hospital SIEMPRE gana', () => {
  it('gana sobre el catálogo de fábrica', () => {
    // El catálogo dice que «Medicina Interna» es piso; este hospital la usa como
    // unidad de cuidados intermedios y eso manda.
    const r = resolverUnidad('Medicina Interna', [u('Medicina Interna', 'intermedia')])
    expect(r.tipo).toBe('intermedia')
    expect(r.fuente).toBe('configurada')
  })

  it('una unidad INACTIVA no manda: se cae al catálogo', () => {
    const r = resolverUnidad('Urgencias', [u('Urgencias', 'critica', false)])
    expect(r.tipo).toBe('urgencias')
    expect(r.fuente).toBe('catalogo')
  })

  it('sin unidades configuradas, el catálogo mantiene todo funcionando', () => {
    // El día del cambio nada deja de servir.
    expect(resolverUnidad('UCI / Terapia Intensiva').tipo).toBe('critica')
    expect(resolverUnidad('UCI / Terapia Intensiva').fuente).toBe('catalogo')
  })

  it('el catálogo cubre los 17 servicios de fábrica, sin huecos', () => {
    for (const s of SERVICIOS_HOSPITAL) expect(TIPO_SUGERIDO[s]).toBeDefined()
    expect(Object.keys(TIPO_SUGERIDO)).toHaveLength(SERVICIOS_HOSPITAL.length)
  })

  it('en el catálogo, la única crítica es la que se llama así de fábrica', () => {
    const criticas = Object.entries(TIPO_SUGERIDO).filter(([, t]) => t === 'critica').map(([k]) => k)
    expect(criticas).toEqual(['UCI / Terapia Intensiva'])
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('un servicio sin tipo NO desaparece: se declara', () => {
  it('desconocida NO es lo mismo que «no es crítica»', () => {
    // Tratarlo como no-crítico haría desaparecer pacientes en silencio, que es
    // justo el defecto que este módulo cierra.
    const r = resolverUnidad('Pabellón 7')
    expect(r.fuente).toBe('desconocida')
    expect(r.tipo).toBeNull()
  })

  it('la pantalla puede listar los servicios sin configurar', () => {
    const censo = ['UCI / Terapia Intensiva', 'Pabellón 7', 'Torre B', 'Pabellón 7']
    expect(sinTipoConfigurado(censo)).toEqual(['Pabellón 7', 'Torre B'])
  })

  it('lo ya configurado NO entra en esa lista', () => {
    expect(sinTipoConfigurado(['Torre B'], [u('Torre B', 'critica')])).toEqual([])
  })

  it('vacío y nulo no ensucian la lista', () => {
    expect(sinTipoConfigurado(['', '   ', null, undefined])).toEqual([])
  })

  it('el aviso dice POR QUÉ no se adivina', () => {
    expect(AVISO_SIN_TIPO).toMatch(/NO adivina por el nombre/)
    expect(AVISO_SIN_TIPO).toMatch(/«Terapia» puede ser intensiva o física/)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('sembrar la configuración sin aplicar nada solo', () => {
  it('propone una unidad por cada servicio de fábrica', () => {
    const us = unidadesDelCatalogo()
    expect(us).toHaveLength(SERVICIOS_HOSPITAL.length)
    expect(us.find(x => x.nombre === 'UCI / Terapia Intensiva')?.tipo).toBe('critica')
  })

  it('son una PROPUESTA: no se guardan ni se aplican por su cuenta', () => {
    // La función es pura y devuelve objetos nuevos; quien la llama decide.
    const a = unidadesDelCatalogo(), b = unidadesDelCatalogo()
    expect(a).not.toBe(b)
    expect(a).toEqual(b)
  })

  it('todo tipo tiene etiqueta', () => {
    for (const t of TIPOS_UNIDAD) expect(TIPO_UNIDAD_LABEL[t]).toBeTruthy()
  })

  it('los tipos del modelo, en su orden', () => {
    expect([...TIPOS_UNIDAD]).toEqual([
      'critica', 'intermedia', 'piso', 'urgencias', 'quirofano', 'recuperacion', 'otro',
    ])
  })
})
