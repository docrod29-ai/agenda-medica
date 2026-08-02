/**
 * GOLDEN — P-019: lo que el paciente cuenta antes de entrar.
 *
 * La regla que hace esto seguro es una sola: **lo que dice el paciente NO pisa
 * el expediente**. Si el formulario escribiera en `patient.alergias`, un
 * paciente que teclea «no» BORRARÍA una alergia a penicilina documentada — y de
 * ese campo dependen la compuerta de la receta y el cruce de la nota.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  limpiarRespuestas, tieneContenido, resumenPrevio, CAMPOS_PREVIOS, MAX_CARACTERES,
} from '@/lib/portal/formulario-previo'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

describe('limpiarRespuestas', () => {
  it('sólo deja pasar los campos conocidos', () => {
    const r = limpiarRespuestas({ motivo: 'me duele la rodilla', loQueSea: 'x', __proto__: 'y' })
    expect(r).toEqual({ motivo: 'me duele la rodilla' })
  })

  it('los campos vacíos NO se guardan', () => {
    // Guardar seis cadenas vacías haría que la consulta enseñara seis preguntas
    // sin responder, que se lee como «el paciente no tiene nada» — y no es lo
    // mismo que «el paciente no contestó eso».
    expect(limpiarRespuestas({ motivo: '   ', alergias: '' })).toEqual({})
  })

  it('recorta al tope: es un formulario, no un expediente', () => {
    const largo = 'a'.repeat(MAX_CARACTERES + 500)
    expect(limpiarRespuestas({ motivo: largo }).motivo).toHaveLength(MAX_CARACTERES)
  })

  it('un cuerpo basura no revienta', () => {
    for (const v of [null, undefined, 'texto', 42]) {
      expect(limpiarRespuestas(v)).toEqual({})
    }
  })
})

describe('tieneContenido', () => {
  it('distingue vacío de lleno', () => {
    expect(tieneContenido({})).toBe(false)
    expect(tieneContenido({ motivo: '  ' })).toBe(false)
    expect(tieneContenido({ motivo: 'algo' })).toBe(true)
  })
})

describe('resumenPrevio', () => {
  const base = { enviadoEn: '2026-08-02T10:00:00.000Z', origen: 'paciente' as const }

  it('junta el motivo con el desde cuándo', () => {
    expect(resumenPrevio({ ...base, respuestas: { motivo: 'tos', desdeCuando: 'tres semanas' } }))
      .toBe('tos · desde tres semanas')
  })

  it('sin contenido no hay resumen, así que no se pinta la tarjeta', () => {
    expect(resumenPrevio({ ...base, respuestas: {} })).toBe('')
    expect(resumenPrevio(null)).toBe('')
    expect(resumenPrevio(undefined)).toBe('')
  })
})

describe('el formulario NO toca el expediente', () => {
  it('la ruta guarda en su propia subcolección, no en el paciente', () => {
    const s = leer('src', 'app', 'api', 'portal', 'route.ts')
    expect(s).toContain("collection('formularios_previos')")
    // Lo que se guarda dice de dónde viene.
    expect(s).toContain("origen: 'paciente'")
  })

  it('las reglas cierran la escritura desde el navegador', () => {
    // El enlace del paciente no es sesión de Firebase: si pudiera escribir
    // directo, escribiría sobre el expediente de otro paciente de la clínica.
    const reglas = leer('firestore.rules')
    const i = reglas.indexOf('match /formularios_previos/')
    expect(i).toBeGreaterThan(-1)
    const bloque = reglas.slice(i, i + 400)
    expect(bloque).toContain('allow write: if false')
    // Y es secreto médico: lo lee quien lee las notas, no recepción.
    expect(bloque).toContain('allow read: if isMedico(clinicId)')
  })

  it('la consulta lo enseña SEPARADO y declarado', () => {
    const s = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
    expect(s).toContain('AVISO_NO_ES_EXPEDIENTE')
    expect(s).toContain('El paciente escribió antes de la consulta')
  })

  it('el portal del paciente lo ofrece', () => {
    const s = leer('src', 'app', 'mi', '[token]', 'page.tsx')
    expect(s).toContain('FormularioPrevio')
    expect(s).toContain('AVISO_URGENCIA')
  })
})

describe('el formulario no puntúa nada', () => {
  it('no hay escalas ni umbrales: es una declaración, no una valoración', () => {
    const s = leer('src', 'lib', 'portal', 'formulario-previo.ts')
    expect(s).not.toMatch(/score|puntaje|riesgo alto|>\s*\d+\s*(mg|puntos)/i)
    // Preguntas abiertas: encasillar sería decidir por el médico qué es relevante.
    expect(CAMPOS_PREVIOS.length).toBeGreaterThan(0)
    for (const c of CAMPOS_PREVIOS) expect(c.etiqueta).toMatch(/\?$|\?/)
  })
})
