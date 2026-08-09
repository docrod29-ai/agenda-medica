/**
 * «QUITAR DE LA NOTA» TIENE QUE QUITARLO DE LA NOTA — REG-198.
 *
 * ── EL DEFECTO ───────────────────────────────────────────────────────────────
 *
 * El panel de revisión pinta cada dato extraído con un botón rojo «Quitar», bajo
 * un título que promete «Todo esto ya está en la nota… solo quita lo que no
 * corresponda». El botón sacaba el id de `aprobados` — y `aprobados` **sólo se
 * guarda como metadato de auditoría**. Ni una línea de la nota cambiaba.
 *
 * El médico veía un diagnóstico mal extraído, pulsaba «Quitar de la nota», el
 * renglón se tachaba en pantalla… y el diagnóstico **seguía en la nota que
 * firmaba**.
 *
 * ── POR QUÉ ESTO ES DE LOS PEORES ────────────────────────────────────────────
 *
 * Un control que miente sobre lo que hizo es **peor que no tenerlo**. Sin botón,
 * el médico habría borrado el renglón a mano. Con él se quedó tranquilo, y el
 * dato equivocado viajó a la nota, a la receta y al expediente con su cédula.
 *
 * Mismo patrón que REG-195 («Quitarlas y firmar» no firmaba), encontrado el
 * mismo día en la misma pantalla.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  quitarDeLaNota, sePuedeQuitar, PREFIJOS,
  type EstadoDeLaNota,
} from '@/lib/expediente/quitar-de-la-nota'
import type { Diagnostico, Medicamento } from '@/types/expediente'

const page = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8',
)

const estado = (): EstadoDeLaNota => ({
  resumen: 'F 73a con TB pulmonar.',
  secciones: [
    { key: 'padecimientoActual', label: 'Padecimiento actual', value: 'Tres meses de evolución.' },
    { key: 'exploracionFisica', label: 'Exploración física', value: 'No explorada.' },
  ],
  diagnosticos: [
    { descripcion: 'Tuberculosis pulmonar' } as Diagnostico,
    { descripcion: 'Diabetes mellitus tipo 2' } as Diagnostico,
  ],
  medicamentos: [
    { nombre: 'rifampicina' } as Medicamento,
    { nombre: 'levotiroxina' } as Medicamento,
  ],
  signos: { fc: 82, ta: '120/80' },
})

describe('quita lo que dice que quita', () => {
  it('un diagnóstico mal extraído desaparece de verdad', () => {
    const r = quitarDeLaNota(estado(), `${PREFIJOS.diagnostico}1`)
    expect(r.diagnosticos.map(d => d.descripcion)).toEqual(['Tuberculosis pulmonar'])
  })

  it('un medicamento también', () => {
    const r = quitarDeLaNota(estado(), `${PREFIJOS.medicamento}0`)
    expect(r.medicamentos.map(m => m.nombre)).toEqual(['levotiroxina'])
  })

  it('el resumen se vacía', () => {
    expect(quitarDeLaNota(estado(), PREFIJOS.resumen).resumen).toBe('')
  })

  it('un signo vital se borra sin tocar los demás', () => {
    const r = quitarDeLaNota(estado(), `${PREFIJOS.signoVital}fc`)
    expect(r.signos.fc).toBeUndefined()
    expect(r.signos.ta).toBe('120/80')
  })

  it('una sección se VACÍA, no desaparece de la lista', () => {
    /**
     * Una sección obligatoria que desaparece rompe la validación NOM-004 de
     * otra manera. El médico quiere quitar un texto, no un apartado.
     */
    const r = quitarDeLaNota(estado(), `${PREFIJOS.seccion}exploracionFisica`)
    expect(r.secciones).toHaveLength(2)
    expect(r.secciones.find(s => s.key === 'exploracionFisica')?.value).toBe('')
    expect(r.secciones.find(s => s.key === 'padecimientoActual')?.value).toBe('Tres meses de evolución.')
  })
})

describe('nunca inventa una eliminación', () => {
  it('un índice fuera de rango no borra nada', () => {
    expect(quitarDeLaNota(estado(), `${PREFIJOS.diagnostico}9`).diagnosticos).toHaveLength(2)
    expect(quitarDeLaNota(estado(), `${PREFIJOS.medicamento}-1`).medicamentos).toHaveLength(2)
  })

  it('un id que no se reconoce devuelve el estado igual', () => {
    const e = estado()
    expect(quitarDeLaNota(e, 'loquesea')).toEqual(e)
    expect(quitarDeLaNota(e, '')).toEqual(e)
  })

  it('una sección que no existe no altera las demás', () => {
    expect(quitarDeLaNota(estado(), `${PREFIJOS.seccion}noExiste`).secciones)
      .toEqual(estado().secciones)
  })

  it('un signo vital que no está no crea la clave', () => {
    const r = quitarDeLaNota(estado(), `${PREFIJOS.signoVital}spo2`)
    expect(r.signos).toEqual(estado().signos)
  })

  it('no muta el estado que recibe', () => {
    const e = estado()
    quitarDeLaNota(e, `${PREFIJOS.diagnostico}0`)
    expect(e.diagnosticos).toHaveLength(2)
  })
})

describe('las alergias NO se quitan desde aquí', () => {
  it('el id de alergia no se considera quitable', () => {
    /**
     * Viven en el expediente del paciente, no en la nota. Borrarlas desde el
     * panel de una consulta las quitaría de TODAS las futuras, y el cruce
     * alergia ↔ fármaco dejaría de saltar para siempre.
     */
    expect(sePuedeQuitar(`${PREFIJOS.alergia}0`)).toBe(false)
  })

  it('y si llegara, no cambia nada', () => {
    const e = estado()
    expect(quitarDeLaNota(e, `${PREFIJOS.alergia}0`)).toEqual(e)
  })

  it('lo demás sí es quitable', () => {
    expect(sePuedeQuitar(`${PREFIJOS.diagnostico}0`)).toBe(true)
    expect(sePuedeQuitar(`${PREFIJOS.medicamento}0`)).toBe(true)
    expect(sePuedeQuitar(`${PREFIJOS.seccion}x`)).toBe(true)
    expect(sePuedeQuitar(PREFIJOS.resumen)).toBe(true)
  })
})

describe('está conectado, y es reversible', () => {
  it('la consulta llama a quitarDeLaNota', () => {
    expect(page).toContain('quitarDeLaNota({ resumen, secciones, diagnosticos, medicamentos, signos }, id)')
  })

  it('guarda un punto de deshacer antes de quitar', () => {
    // Quitar un dato clínico no puede ser irreversible por un clic (REG-195).
    const i = page.indexOf('const nuevo = quitarDeLaNota(')
    expect(page.slice(Math.max(0, i - 300), i)).toContain('setSnapshotUndo(')
  })

  it('y se lo dice al médico', () => {
    expect(page).toContain('Quitado de la nota. Puedes deshacerlo')
  })
})
