import { describe, it, expect } from 'vitest'
import {
  normalizarTel, normalizarNombre, pacientesACsv, parseCsv,
  mapearEncabezados, construirFilas, clasificarFilas,
} from '@/lib/csv-pacientes'
import type { Patient } from '@/types'

const px = (o: Partial<Patient>): Patient => ({
  id: o.id ?? 'x', nombre: o.nombre ?? 'N', telefono: o.telefono ?? '',
  noShowCount: 0, cancelacionCount: 0, createdAt: '', updatedAt: '', creadoPor: '', ...o,
})

describe('normalizarTel', () => {
  it('deja solo dígitos', () => {
    expect(normalizarTel('(664) 123-4567')).toBe('6641234567')
    expect(normalizarTel(undefined)).toBe('')
  })
})

describe('normalizarNombre', () => {
  it('quita acentos, mayúsculas y espacios extra', () => {
    expect(normalizarNombre('  José  RÍOS ')).toBe('jose rios')
  })
})

describe('parseCsv', () => {
  it('respeta comillas, comas internas y saltos', () => {
    const t = 'Nombre,Notas\r\n"Pérez, Juan","dice ""hola"""\nAna,ok'
    const r = parseCsv(t)
    expect(r).toEqual([['Nombre', 'Notas'], ['Pérez, Juan', 'dice "hola"'], ['Ana', 'ok']])
  })
  it('descarta filas vacías', () => {
    expect(parseCsv('a\n\n\nb')).toEqual([['a'], ['b']])
  })
})

describe('mapearEncabezados', () => {
  it('auto-mapea sinónimos comunes', () => {
    expect(mapearEncabezados(['Nombre completo', 'Celular', 'Correo', 'Basura']))
      .toEqual(['nombre', 'telefono', 'email', null])
  })
})

describe('construirFilas', () => {
  it('usa el mapeo y exige nombre', () => {
    const csv = [['Nombre', 'Tel'], ['Ana', '6641112233'], ['', '999']]
    const filas = construirFilas(csv, mapearEncabezados(['Nombre', 'Tel']))
    expect(filas).toHaveLength(1)
    expect(filas[0]).toMatchObject({ nombre: 'Ana', telefono: '6641112233' })
  })
})

describe('clasificarFilas', () => {
  it('marca duplicados por teléfono contra existentes y dentro del archivo', () => {
    const existentes = [px({ nombre: 'Juan', telefono: '664-111-2233' })]
    const filas = [
      { nombre: 'Juan Copia', telefono: '(664)1112233' }, // dup por tel existente
      { nombre: 'Nuevo', telefono: '6640000000' },        // nuevo
      { nombre: 'Otro', telefono: '6640000000' },         // dup dentro del archivo
      { nombre: 'Sin tel', telefono: '' },                // nuevo (sin tel, nombre no existe)
    ]
    const r = clasificarFilas(filas, existentes)
    expect(r.map(x => x.estado)).toEqual(['duplicado', 'nuevo', 'duplicado', 'nuevo'])
  })
  it('sin teléfono deduplica por nombre', () => {
    const existentes = [px({ nombre: 'María López', telefono: '' })]
    const r = clasificarFilas([{ nombre: 'maria  lopez', telefono: '' }], existentes)
    expect(r[0].estado).toBe('duplicado')
  })
})

describe('pacientesACsv', () => {
  it('incluye encabezado, BOM y escapa comas', () => {
    const csv = pacientesACsv([px({ nombre: 'Pérez, Juan', telefono: '664' })])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('"Pérez, Juan"')
    expect(csv.split('\r\n')[0]).toContain('Nombre')
  })
})
