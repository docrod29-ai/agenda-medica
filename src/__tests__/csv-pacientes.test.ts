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

/**
 * UNA FILA MARCADA «DUPLICADO» NO SE IMPORTA. NUNCA.
 *
 * Esa es toda la diferencia con el alta a mano, donde se pregunta. Aquí no hay a
 * quién preguntar: lo que se marca, se pierde — y el reporte final lo cuenta como
 * un acierto («3 duplicados»), así que nadie se entera.
 *
 * Por eso la mitad de estas pruebas defiende que ciertas cosas NO son duplicados.
 * Son las que impiden que la migración borre gente en silencio.
 */
describe('clasificarFilas', () => {
  it('LA FAMILIA QUE COMPARTE CELULAR SE IMPORTA ENTERA', () => {
    /**
     * Éste era el bug, y era caro. La regla vieja daba por duplicada cualquier
     * fila cuyo teléfono ya existiera, así que un médico que traía sus pacientes
     * de otro sistema —con la madre ya registrada y sus hijos compartiendo su
     * número— importaba a la madre y PERDÍA A LOS HIJOS. En México el celular es
     * de la casa: no es un caso raro, es el caso normal.
     */
    const existentes = [px({ nombre: 'Rosa Hernández Cruz', telefono: '6645551234' })]
    const filas = [
      { nombre: 'Diego Hernández Cruz', telefono: '6645551234' },
      { nombre: 'Sofía Hernández Cruz', telefono: '6645551234' },
    ]
    const r = clasificarFilas(filas, existentes)
    expect(r.map(x => x.estado)).toEqual(['nuevo', 'nuevo'])
  })

  it('IMPORTAR EL MISMO ARCHIVO DOS VECES NO DUPLICA EL CONSULTORIO', () => {
    // El accidente más común de todos. Aquí el listón es más bajo que en el alta
    // a mano a propósito: exigir certeza «segura» dejaría pasar un CSV entero de
    // nombres y teléfonos, que es exactamente lo que no puede pasar.
    const existentes = [
      px({ nombre: 'Juan Pérez López', telefono: '664-111-2233' }),
      px({ nombre: 'Ana Ruiz Peña', telefono: '6642223344' }),
    ]
    const r = clasificarFilas([
      { nombre: 'Juan Pérez López', telefono: '(664)1112233' },
      { nombre: 'Ana Ruiz Peña', telefono: '6642223344' },
    ], existentes)
    expect(r.map(x => x.estado)).toEqual(['duplicado', 'duplicado'])
  })

  it('el mismo paciente repetido DENTRO del archivo entra una vez', () => {
    // Los CSV exportados de otros sistemas traen repetidos con frecuencia.
    const r = clasificarFilas([
      { nombre: 'Fernanda Quiroz Ibarra', telefono: '6647778899' },
      { nombre: 'Quiroz Ibarra, Fernanda', telefono: '6647778899' },
    ], [])
    expect(r.map(x => x.estado)).toEqual(['nuevo', 'duplicado'])
  })

  it('el padre y el hijo homónimos se importan los dos', () => {
    // La fecha de nacimiento los separa antes de mirar el nombre.
    const existentes = [px({ nombre: 'José Martínez Soto', fechaNacimiento: '1962-08-01' })]
    const r = clasificarFilas(
      [{ nombre: 'José Martínez Soto', telefono: '', fechaNacimiento: '1990-08-01' }],
      existentes,
    )
    expect(r[0].estado).toBe('nuevo')
  })

  it('sin teléfono sigue deduplicando por nombre', () => {
    const existentes = [px({ nombre: 'María López', telefono: '' })]
    const r = clasificarFilas([{ nombre: 'maria  lopez', telefono: '' }], existentes)
    expect(r[0].estado).toBe('duplicado')
  })

  it('el orden de los apellidos ya no crea un paciente nuevo', () => {
    // Se le escapaba: eran dos cadenas distintas y sólo se comparaba el teléfono.
    const existentes = [px({ nombre: 'María López García', telefono: '6641234567' })]
    const r = clasificarFilas([{ nombre: 'López García, María', telefono: '6649999999' }], existentes)
    expect(r[0].estado).toBe('duplicado')
  })

  it('una fila sin nombre se marca aparte, no como duplicado', () => {
    const r = clasificarFilas([{ nombre: '  ', telefono: '6640000000' }], [])
    expect(r[0].estado).toBe('sin_nombre')
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
