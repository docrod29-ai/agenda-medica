import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CAMPOS_CLINICOS_PACIENTE } from '@/types'
import { alergiasDe, alergiasParaImpreso } from '@/lib/seguridad/alergias'
import { MATRIZ_ACCESO, normalizarRuta } from '@/lib/authz/matriz-acceso'

/**
 * Unidad Nexus OS E0-06 — contrato de la separación PHI administrativo / clínico.
 *
 * `CAMPOS_CLINICOS_PACIENTE` es la lista de campos que HOY viajan dentro de
 * `patients/{id}` —documento que recepción lee para agendar— y que tienen que
 * mudarse a la subcolección `clinico`. Esa lista es la que van a consumir el
 * splitter de escritura (Fase B) y el script de migración (Fase C): si se
 * desincroniza del tipo `Patient`, el splitter copia un campo que no existe y el
 * dato clínico se pierde en silencio. Aquí se ancla.
 *
 * Y se fija la invariante que hace peligroso el cambio: la AUSENCIA de dato clínico
 * nunca puede convertirse en una negación afirmativa («Negadas», «no referidas»).
 * El repo ya pagó ese incidente una vez en los impresos.
 */

const TIPOS = readFileSync(resolve(process.cwd(), 'src/types/index.ts'), 'utf8')

/** Cuerpo de una interfaz declarada en src/types/index.ts. */
function cuerpoInterfaz(nombre: string): string {
  const i = TIPOS.indexOf(`export interface ${nombre} {`)
  expect(i, `no se encontró la interfaz ${nombre}`).toBeGreaterThan(-1)
  return TIPOS.slice(i, TIPOS.indexOf('\n}', i))
}

describe('E0-06 · el inventario de campos clínicos del paciente', () => {
  it('nombra exactamente los cuatro grupos que el diseño identificó', () => {
    expect([...CAMPOS_CLINICOS_PACIENTE]).toEqual([
      'alergias',
      'alergiasEstructuradas',
      'notas',
      'txValoracion',
      'txValoracionAt',
      'txValoracionHist',
    ])
  })

  it('no tiene duplicados', () => {
    expect(new Set(CAMPOS_CLINICOS_PACIENTE).size).toBe(CAMPOS_CLINICOS_PACIENTE.length)
  })

  it('cada campo existe DE VERDAD en la interfaz Patient', () => {
    // `tsc` ya lo garantiza con la comprobación de tipo en src/types/index.ts; esto
    // lo repite en runtime para que el fallo sea legible y no un error de tipos.
    const cuerpo = cuerpoInterfaz('Patient')
    for (const campo of CAMPOS_CLINICOS_PACIENTE) {
      expect(cuerpo, `Patient ya no declara ${campo}`).toMatch(new RegExp(`\\n\\s+${campo}\\??:`))
    }
  })

  it('cada campo tiene destino declarado en ResumenClinicoPaciente', () => {
    // `notas` es el único renombre: en el subdocumento se llama `notasClinicas`
    // porque «notas» ya significa otra cosa en el expediente (la subcolección).
    const destino: Record<string, string> = { notas: 'notasClinicas' }
    const cuerpo = cuerpoInterfaz('ResumenClinicoPaciente')
    for (const campo of CAMPOS_CLINICOS_PACIENTE) {
      const esperado = destino[campo] ?? campo
      expect(cuerpo, `ResumenClinicoPaciente no tiene sitio para ${campo}`)
        .toMatch(new RegExp(`\\n\\s+${esperado}\\??:`))
    }
  })

  it('el subdocumento clínico está clasificado como clínico en la matriz de acceso', () => {
    const r = MATRIZ_ACCESO.find(
      x => normalizarRuta(x.ruta) === normalizarRuta('clinics/{clinicId}/patients/{docId}/clinico/{docId}'),
    )
    expect(r, 'la subcolección `clinico` no está en la matriz de acceso').toBeTruthy()
    expect(r!.clase).toBe('clinico')
    expect(r!.guardaLectura).toBe('isMedico')
  })
})

describe('E0-06 · la ausencia de dato clínico NUNCA es una negación', () => {
  it('sin alergias en el objeto, el impreso no afirma nada', () => {
    // Escenario de la migración: la lectura del subdocumento falla o aún no existe.
    // Lo que NO puede pasar es que el papel diga «Negadas» — no es lo mismo «el
    // paciente negó alergias» que «nadie preguntó» o «no se pudo leer».
    expect(alergiasParaImpreso({})).toBe('')
    expect(alergiasParaImpreso(null)).toBe('')
    expect(alergiasParaImpreso(undefined)).toBe('')
    for (const v of [alergiasParaImpreso({}), alergiasParaImpreso(null)]) {
      expect(v.toLowerCase()).not.toContain('negad')
      expect(v.toLowerCase()).not.toContain('no referid')
    }
  })

  it('sin alergias, el cruce de seguridad recibe una lista vacía, no un texto', () => {
    expect(alergiasDe({})).toEqual([])
    expect(alergiasDe({ alergias: '' })).toEqual([])
  })

  it('«existe y está vacío» y «no se pudo leer» producen lo mismo hoy: por eso hace falta un ESTADO', () => {
    // Documenta por qué la Fase B del diseño no puede limitarse a fusionar objetos:
    // desde el objeto fusionado ambos casos son indistinguibles. El estado de la
    // lectura clínica tiene que viajar aparte y bloquear el guardado, como ya hace
    // `pacienteError` en la pantalla de consulta.
    const vacio = alergiasParaImpreso({ alergias: '' })
    const ausente = alergiasParaImpreso({})
    expect(vacio).toBe(ausente)
  })

  it('con alergias sí las reporta (control positivo)', () => {
    expect(alergiasParaImpreso({ alergias: 'Sustancia ficticia A, Sustancia ficticia B' }))
      .toBe('Sustancia ficticia A, Sustancia ficticia B')
    expect(alergiasDe({ alergiasEstructuradas: [{ alergeno: 'Sustancia ficticia A' }] }))
      .toEqual([{ alergeno: 'Sustancia ficticia A' }])
  })
})
