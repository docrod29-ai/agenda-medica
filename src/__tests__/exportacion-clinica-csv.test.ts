/**
 * GOLDEN — la «migración de salida» deja de ser una agenda de contactos.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * La pantalla se llama **Migración** y su exportación son **once columnas de
 * demografía**: nombre, teléfono, WhatsApp, correo, fecha de nacimiento, sexo,
 * CURP, seguro, alergias, notas y última cita.
 *
 * **Cero contenido clínico.** Ni una consulta, ni un diagnóstico, ni un
 * medicamento, ni un cobro.
 *
 * Y el argumento de venta que sostiene esa pantalla es «no te secuestro tus
 * datos». Un competidor abre ese CSV en una demo y gana la reunión sin decir una
 * palabra.
 *
 * ── LA COLUMNA QUE SE APLANA ES LA QUE SE PIERDE ─────────────────────────────
 *
 * Un diagnóstico o un medicamento viven DENTRO de la nota, en arreglos. Volcarlos
 * en una celda los entrega y los pierde a la vez: nadie puede contar, filtrar ni
 * sumar sobre `[object Object]`.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  DOMINIOS, cabeceraDe, filasDe,
  POR_QUE_UNA_FILA_POR_ELEMENTO, POR_QUE_NO_ES_EL_RESPALDO,
} from '@/lib/clinica/csv-clinico'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const ruta = leer('src', 'app', 'api', 'clinic', 'exportar-csv', 'route.ts')
const pagina = leer('src', 'app', '(dashboard)', 'migracion', 'page.tsx')

const CTX = { pacienteNombre: 'Paciente Sintético', pacienteId: 'p1' }

describe('lo clínico sale, y desglosado', () => {
  it('un diagnóstico por fila, con su nota', () => {
    const filas = filasDe('diagnosticos', {
      id: 'n1', fechaConsulta: '2026-08-01',
      diagnosticos: [
        { descripcion: 'Dx sintético A', cie10: 'X00', tipo: 'principal' },
        { descripcion: 'Dx sintético B', cie10: 'X01', tipo: 'secundario' },
      ],
    }, CTX)
    expect(filas.length).toBe(2)
    expect(filas[0]).toContain('Dx sintético A')
    expect(filas[0]).toContain('n1')
    expect(filas[1]).toContain('Dx sintético B')
  })

  it('un medicamento por fila, con dosis y vía', () => {
    const filas = filasDe('medicamentos', {
      id: 'n1', medicamentos: [{ nombre: 'Fármaco sintético', dosis: '1 tab', via: 'oral', frecuencia: 'c/12 h' }],
    }, CTX)
    expect(filas.length).toBe(1)
    expect(filas[0]).toContain('Fármaco sintético')
    expect(filas[0]).toContain('oral')
  })

  it('un analito por fila', () => {
    const filas = filasDe('laboratorios', {
      id: 'l1', fecha: '2026-08-01', analitos: [{ clave: 'hb', valor: 14, unidad: 'g/dL' }],
    }, CTX)
    expect(filas[0]).toContain('hb')
    expect(filas[0]).toContain('g/dL')
  })

  it('NUNCA sale [object Object]', () => {
    // Es el fallo que este módulo existe para no cometer.
    const todas = [
      ...filasDe('diagnosticos', { id: 'n', diagnosticos: [{ descripcion: 'x' }] }, CTX),
      ...filasDe('medicamentos', { id: 'n', medicamentos: [{ nombre: 'y' }] }, CTX),
      ...filasDe('consultas', { id: 'n', firma: { nombreMedico: 'Dra. Z' } }, CTX),
    ]
    for (const f of todas) expect(f).not.toContain('[object Object]')
  })

  it('una nota SIN diagnósticos no produce una fila vacía', () => {
    /**
     * Una fila con el paciente y todo lo demás en blanco se cuenta como un
     * diagnóstico que no existe: al sumar, el consultorio tendría más
     * diagnósticos de los que hay.
     */
    expect(filasDe('diagnosticos', { id: 'n1' }, CTX)).toEqual([])
    expect(filasDe('medicamentos', { id: 'n1', medicamentos: [] }, CTX)).toEqual([])
  })

  it('está escrito por qué se desglosa', () => {
    expect(POR_QUE_UNA_FILA_POR_ELEMENTO).toMatch(/\[object Object\]/)
  })
})

describe('la fila se puede leer sin cruzar identificadores a mano', () => {
  it('cada fila trae el NOMBRE del paciente, no sólo su id', () => {
    const f = filasDe('citas', { id: 'c1', fechaHora: '2026-08-10 09:00', tipo: 'consulta' }, CTX)[0]
    expect(f).toContain('Paciente Sintético')
    expect(f).toContain('p1')
  })

  it('y la referencia a su nota, para poder volver a ella', () => {
    const f = filasDe('diagnosticos', { id: 'nota-42', diagnosticos: [{ descripcion: 'x' }] }, CTX)[0]
    expect(f).toContain('nota-42')
  })
})

describe('la inyección de fórmulas tampoco entra por aquí', () => {
  it('un nombre que empieza por `=` se neutraliza', () => {
    /**
     * El nombre del paciente lo teclea la recepción: es texto de otra persona
     * que acaba en una celda que Excel ejecuta.
     */
    const f = filasDe('citas', { id: 'c1' }, { pacienteNombre: '=cmd|calc', pacienteId: 'p1' })[0]
    expect(f).toContain("'=cmd|calc")
  })
})

describe('los seis dominios están declarados', () => {
  it('cada uno dice qué es y con qué columnas', () => {
    for (const [clave, def] of Object.entries(DOMINIOS)) {
      expect(def.descripcion.length, clave).toBeGreaterThan(25)
      expect(def.columnas.length, clave).toBeGreaterThan(4)
    }
  })

  it('la cabecera sale del mismo sitio que las filas', () => {
    // Dos listas de columnas se desincronizan y el archivo queda corrido.
    expect(cabeceraDe('diagnosticos').split(',').length)
      .toBe(DOMINIOS.diagnosticos.columnas.length)
  })

  it('todos empiezan por la fecha y el paciente', () => {
    for (const [clave, def] of Object.entries(DOMINIOS)) {
      expect(def.columnas[0], clave).toMatch(/^fecha/)
      expect(def.columnas[1], clave).toBe('paciente')
    }
  })
})

describe('la ruta', () => {
  it('rechaza un dominio que no existe, y dice cuáles hay', () => {
    expect(ruta).toContain('dominio inválido. Los que hay:')
  })

  it('exige el permiso del MÉDICO', () => {
    // Vuelca diagnósticos y medicamentos de todos los pacientes: el permiso de
    // mostrador no alcanza ni para «sólo exportar».
    expect(ruta).toContain("verificarCapacidad(req, clinicId, 'clinico.escribir')")
  })

  it('escribe el BOM, o Excel destroza los acentos', () => {
    // Sin él, «Rodríguez» sale «RodrÃ­guez» en la primera columna que se ve.
    expect(ruta).toContain("'\\ufeff'".replace('\\ufeff', '﻿'))
    expect(ruta).toContain('Excel abre el archivo en Latin-1')
  })

  it('pagina con cursor, no lee la colección de golpe', () => {
    expect(ruta).toContain("orderBy('__name__').limit(PAGINA)")
    expect(ruta).toContain('startAfter(cursor)')
  })

  it('la última fila declara el alcance, y grita si recortó', () => {
    expect(ruta).toContain('_RESUMEN')
    expect(ruta).toContain('SE ALCANZÓ EL TOPE DE ${TOPE_PACIENTES} PACIENTES')
  })

  it('y una lectura interrumpida se dice DENTRO del archivo', () => {
    expect(ruta).toContain('ERROR_DE_LECTURA')
  })
})

describe('la pantalla lo ofrece, sin confundirlo con el respaldo', () => {
  it('los seis botones están', () => {
    for (const d of Object.keys(DOMINIOS)) expect(pagina).toContain(`'${d}'`)
  })

  it('y explica que NO es el respaldo completo', () => {
    /**
     * El respaldo (NDJSON) sirve para RECONSTRUIR; esto para leer. Confundirlos
     * llevaría a que alguien crea que exportando «Consultas» tiene su
     * consultorio a salvo.
     */
    expect(pagina).toContain('respaldo')
    expect(POR_QUE_NO_ES_EL_RESPALDO).toMatch(/RECONSTRUIR/)
  })
})
