/**
 * LOS MOTORES VEN AL PACIENTE, NO SÓLO LA RECETA DE HOY — REG-188.
 *
 * ── EL DEFECTO ───────────────────────────────────────────────────────────────
 *
 * La consulta ya calculaba la medicación vigente y los problemas activos del
 * paciente —`medicamentosVigentes()`, `problemasActivos()` sobre las notas
 * firmadas— y los pintaba en pantalla. A los motores les pasaba **sólo lo de
 * hoy**.
 *
 * El caso que lo motiva: **warfarina de marzo, ketorolaco hoy**. La regla de
 * sangrado existe y está probada. No disparaba, porque la warfarina no estaba en
 * la nota de hoy.
 *
 * Es el patrón «escrito y sin conectar», el más caro de este repositorio.
 *
 * ── POR QUÉ IMPORTA MÁS DE LO QUE PARECE ─────────────────────────────────────
 *
 * En una consulta de seguimiento —la mayoría— lo de hoy son dos renglones sobre
 * alguien que toma cinco cosas desde hace años. Un motor que sólo ve los dos
 * renglones no razona sobre un paciente: razona sobre una receta.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  medicacionDelCuadro, problemasDelCuadro, resumenDelCuadro,
} from '@/lib/expediente/cuadro-completo'
import type { Medicamento, Diagnostico } from '@/types/expediente'

const med = (nombre: string, dosis = '') => ({ nombre, dosis, via: 'oral', frecuencia: '', duracion: '' }) as Medicamento
const dx = (descripcion: string, codigoCIE10?: string) =>
  ({ descripcion, codigoCIE10, tipo: 'definitivo', estado: 'activo' }) as Diagnostico

describe('el caso que lo motiva', () => {
  it('la warfarina de marzo llega junto al ketorolaco de hoy', () => {
    const cuadro = medicacionDelCuadro(
      [med('ketorolaco', '30 mg')],
      [{ medicamento: med('warfarina', '5 mg') }],
    )
    expect(cuadro.map(m => m.nombre)).toEqual(['ketorolaco', 'warfarina'])
  })

  it('y se sabe cuál es de hoy y cuál del expediente', () => {
    const cuadro = medicacionDelCuadro(
      [med('ketorolaco')],
      [{ medicamento: med('warfarina') }],
    )
    expect(cuadro.find(m => m.nombre === 'ketorolaco')?.deHoy).toBe(true)
    expect(cuadro.find(m => m.nombre === 'warfarina')?.deHoy).toBe(false)
  })

  it('el diabético que hoy viene por faringitis sigue siendo diabético', () => {
    const cuadro = problemasDelCuadro(
      [dx('Faringitis aguda')],
      [{ diagnostico: dx('Diabetes mellitus tipo 2', 'E11') }],
    )
    expect(cuadro.map(d => d.descripcion)).toContain('Diabetes mellitus tipo 2')
  })
})

describe('lo de hoy manda cuando el fármaco está en las dos listas', () => {
  it('la dosis nueva sustituye a la vigente', () => {
    // Si el médico está cambiando la dosis en esta consulta, la buena es la
    // nueva: la vigente es la última palabra ANTERIOR.
    const cuadro = medicacionDelCuadro(
      [med('levotiroxina', '100 mcg')],
      [{ medicamento: med('levotiroxina', '75 mcg') }],
    )
    expect(cuadro).toHaveLength(1)
    expect(cuadro[0].dosis).toBe('100 mcg')
    expect(cuadro[0].deHoy).toBe(true)
  })

  it('sin importar mayúsculas ni tildes', () => {
    const cuadro = medicacionDelCuadro(
      [med('Metformina')],
      [{ medicamento: med('metformina') }],
    )
    expect(cuadro).toHaveLength(1)
  })

  it('el mismo diagnóstico por código no se duplica', () => {
    // «DM2» y «Diabetes mellitus tipo 2» son uno solo si comparten CIE-10.
    const cuadro = problemasDelCuadro(
      [dx('DM2', 'E11')],
      [{ diagnostico: dx('Diabetes mellitus tipo 2', 'E11') }],
    )
    expect(cuadro).toHaveLength(1)
    expect(cuadro[0].descripcion).toBe('DM2')
  })
})

describe('no inventa ni pierde nada', () => {
  it('sin expediente previo, sólo lo de hoy', () => {
    expect(medicacionDelCuadro([med('amoxicilina')], [])).toHaveLength(1)
  })
  it('sin consulta de hoy, sólo lo vigente', () => {
    const c = medicacionDelCuadro([], [{ medicamento: med('losartán') }])
    expect(c).toHaveLength(1)
    expect(c[0].deHoy).toBe(false)
  })
  it('con las dos vacías, nada', () => {
    expect(medicacionDelCuadro([], [])).toEqual([])
    expect(problemasDelCuadro([], [])).toEqual([])
  })
  it('los renglones sin nombre no entran', () => {
    expect(medicacionDelCuadro([med('  ')], [])).toEqual([])
  })
  it('el resumen cuenta bien las dos procedencias', () => {
    const c = medicacionDelCuadro(
      [med('a'), med('b')],
      [{ medicamento: med('c') }],
    )
    expect(resumenDelCuadro(c)).toEqual({ deHoy: 2, delExpediente: 1, total: 3 })
  })
})

describe('está conectado de verdad, no sólo escrito', () => {
  const page = readFileSync(
    join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8',
  )

  it('el cuadro completo se calcula una vez', () => {
    /**
     * Fuera del `useMemo` a propósito: llamar a una función importada dentro de
     * una memoización manual impide al React Compiler preservarla, y el
     * trinquete de lint lo caza. En el cuerpo se memoiza solo.
     */
    expect(page).toContain('const medsDelCuadro = medicacionDelCuadro(medicamentos, vigentes)')
    expect(page).toContain('const dxDelCuadro = problemasDelCuadro(diagnosticos, problemas)')
  })

  it('y llega a los DOS motores, no a uno', () => {
    // El defecto original estaba en los dos sitios: el copiloto y la evidencia.
    expect(page.split('medicamentos: medsDelCuadro').length - 1).toBe(2)
    expect(page.split('diagnosticos: dxDelCuadro').length - 1).toBe(2)
  })

  it('a los MOTORES ya no se les pasa la lista pelada de hoy', () => {
    expect(page).not.toContain('medicamentos: medicamentos.map(m => ({ nombre: m.nombre, dosis: m.dosis }))')
  })

  it('pero el worklist de tareas SÍ se queda con lo de hoy — y es correcto', () => {
    /**
     * ── DÓNDE NO SE APLICA ESTO, Y POR QUÉ ────────────────────────────────
     *
     * `tareasDeNota` deriva los pendientes de la consulta que se está firmando:
     * el estudio que se pidió, el seguimiento que se agendó. Ahí la medicación
     * crónica NO pinta nada — meterla generaría, en cada firma, tareas sobre
     * fármacos que el paciente lleva años tomando y que nadie pidió revisar hoy.
     *
     * El cuadro completo es para RAZONAR sobre el paciente. El worklist es para
     * ACORDARSE de lo que se pidió. No es la misma pregunta.
     */
    expect(page).toContain('medicamentos: medicamentos.map(m => ({ nombre: m.nombre })),')
    const i = page.indexOf('medicamentos: medicamentos.map(m => ({ nombre: m.nombre })),')
    expect(page.slice(Math.max(0, i - 900), i)).toContain('tareasDeNota(')
  })
})
