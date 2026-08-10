/**
 * GOLDEN — el simulacro de restauración no se había corrido nunca.
 *
 * ── LO QUE PASABA (D8) ───────────────────────────────────────────────────────
 *
 * `docs/SIMULACRO_RESTAURACION.md` tiene el procedimiento entero, y su historial
 * decía literalmente **«todavía ninguno»**. La frase del auditor es la correcta:
 * sin un tiempo medido no hay respuesta para un hospital que pregunte cuánto
 * tarda Ausculta en volver.
 *
 * ── LO QUE SE PUEDE ENSAYAR SIN CONSOLA, Y LO QUE NO ─────────────────────────
 *
 * Nuestra mitad —que el archivo vuelve a leerse entero, y cuánto tarda— se puede
 * correr cuantas veces haga falta. El `gcloud firestore databases restore` es de
 * Google, hay que cronometrarlo a mano y sigue siendo del ensayo con consola.
 *
 * Decirlo importa: un número presentado como «el RTO» cubriendo sólo un tramo es
 * **peor** que no tener número, porque nadie lo vuelve a comprobar.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  simularRestauracion, ensayoLimpio, actaDeSimulacro, POR_QUE_ESTE_ENSAYO_NO_ES_EL_RTO,
} from '@/lib/clinica/simulacro'

const linea = (o: Record<string, unknown>) => JSON.stringify(o)
const CABECERA = linea({ _tipo: 'cabecera', version: 1, clinicId: 'origen' })
const PIE = linea({ _tipo: 'pie', documentos: 2, completo: true })
const DOC = linea({ _ruta: 'clinics/origen/patients/p1', _coleccion: 'patients', nombre: 'Sintético' })

describe('EL ENSAYO CORRE EL CAMINO DE VUELTA ENTERO', () => {
  it('un respaldo bien formado vuelve limpio', () => {
    const r = simularRestauracion([CABECERA, DOC, PIE].join('\n'), 'destino')
    expect(r.cabecera).toBe(true)
    expect(r.pie).toBe(true)
    expect(r.restaurables).toBe(1)
    expect(ensayoLimpio(r)).toBe(true)
  })

  it('un archivo SIN PIE no está limpio, aunque todo lo demás lo esté', () => {
    /**
     * Es el corte a medias: el archivo se truncó y lo que falta no se puede
     * saber cuál era. Dar eso por bueno es la forma de descubrir el hueco el
     * día que hace falta.
     */
    const r = simularRestauracion([CABECERA, DOC].join('\n'), 'destino')
    expect(r.restaurables).toBe(1)
    expect(ensayoLimpio(r)).toBe(false)
  })

  it('una línea rota se rechaza CON su razón y no aborta el resto', () => {
    const r = simularRestauracion([CABECERA, '{esto no es json', DOC, PIE].join('\n'), 'destino')
    expect(r.rechazadas).toHaveLength(1)
    expect(r.rechazadas[0].porQue).toMatch(/no es JSON/)
    expect(r.restaurables).toBe(1)      // el documento bueno sigue entrando
    expect(ensayoLimpio(r)).toBe(false) // pero el ensayo no pasa
  })

  it('las líneas vacías no cuentan', () => {
    const r = simularRestauracion([CABECERA, '', '   ', DOC, PIE].join('\n'), 'destino')
    expect(r.lineas).toBe(3)
  })
})

describe('LAS LLAVES DE API NO VUELVEN NI AUNQUE EL ARCHIVO LAS TRAIGA', () => {
  it('se cuentan como excluidas, no como restaurables', () => {
    /**
     * El respaldo no las lleva, pero un archivo editado a mano podría: escribir
     * credenciales desde un archivo subido es la puerta que no se deja abierta.
     */
    const secreto = linea({ _ruta: 'clinics/origen/secretos/ia', _coleccion: 'secretos', apiKey: 'x' })
    const r = simularRestauracion([CABECERA, secreto, DOC, PIE].join('\n'), 'destino')
    expect(r.excluidos).toBe(1)
    expect(r.restaurables).toBe(1)
    expect(r.porColeccion.secretos).toBeUndefined()
  })
})

describe('EL RE-ENRAIZADO SE ENSAYA, QUE ES EL PASO QUE PUEDE FALLAR', () => {
  it('todo termina bajo el consultorio destino', () => {
    // Escribirlo tal cual metería los pacientes de un consultorio en otro.
    const r = simularRestauracion([CABECERA, DOC, PIE].join('\n'), 'destino')
    expect(r.rechazadas).toHaveLength(0)
    expect(r.restaurables).toBe(1)
  })

  it('una ruta con forma inesperada se rechaza', () => {
    const malo = linea({ _ruta: 'otracosa/x/y/z', _coleccion: 'patients' })
    const r = simularRestauracion([CABECERA, malo, PIE].join('\n'), 'destino')
    expect(r.rechazadas).toHaveLength(1)
    expect(r.restaurables).toBe(0)
  })
})

describe('EL ACTA DICE LO QUE MIDIÓ — Y LO QUE NO', () => {
  const r = simularRestauracion([CABECERA, DOC, PIE].join('\n'), 'destino')

  it('lleva el tiempo que le pasaron, no uno estimado', () => {
    // Un tiempo inventado en un documento de continuidad es peor que ninguno.
    expect(actaDeSimulacro(r, 1500, '2026-08-04T00:00:00.000Z')).toContain('1.50 s')
    expect(actaDeSimulacro(r, 162, '2026-08-04T00:00:00.000Z')).toContain('162 ms')
  })

  it('declara SIEMPRE que no mide el restore de Firestore', () => {
    expect(actaDeSimulacro(r, 100, '2026-08-04T00:00:00.000Z')).toMatch(/Qué NO mide esto/)
    expect(POR_QUE_ESTE_ENSAYO_NO_ES_EL_RTO).toMatch(/peor que no tener/)
  })

  it('un ensayo sucio NO se firma como bueno', () => {
    const malo = simularRestauracion([CABECERA, '{roto'].join('\n'), 'destino')
    expect(actaDeSimulacro(malo, 10, '2026-08-04T00:00:00.000Z')).toContain('❌')
  })
})

describe('Y HAY UNA FORMA DE CORRERLO', () => {
  it('el script existe y está declarado en package.json', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as { scripts: Record<string, string> }
    expect(pkg.scripts['simulacro:respaldo']).toContain('simulacro-respaldo.mjs')
  })

  it('el script trabaja con datos sintéticos por defecto', () => {
    // Un ensayo que necesita un expediente real no se corre nunca.
    const s = readFileSync(join(process.cwd(), 'scripts', 'simulacro-respaldo.mjs'), 'utf8')
    expect(s).toContain('function consultorioSintetico')
    expect(s).toMatch(/DATOS SINTÉTICOS SIEMPRE/)
  })

  it('y sale con código distinto de cero si el ensayo no está limpio', () => {
    // Para que pueda vigilarlo algo automático, no sólo una persona leyendo.
    const s = readFileSync(join(process.cwd(), 'scripts', 'simulacro-respaldo.mjs'), 'utf8')
    expect(s).toContain('process.exit(ensayoLimpio(r) ? 0 : 1)')
  })
})
