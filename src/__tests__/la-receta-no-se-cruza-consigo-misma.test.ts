import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { limpiarComentarios } from '@/lib/authz/analisis-estatico'
import { estadoDeMedicamentos } from '@/lib/expediente/ordenes-medicamento'
import { terapiaDuplicadaDeLaLista } from '@/lib/seguridad/terapia-duplicada'

/**
 * LA RECETA NO SE CRUZA CONSIGO MISMA — REG-531.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * REG-523 hizo que la receta cargara las notas FIRMADAS del paciente para
 * cruzar lo de hoy con lo que ya toma. Pero la receta se abre desde una nota
 * ya firmada — la que se está imprimiendo — y esa nota entraba en «lo
 * vigente». Resultado, en pantalla: «Ketorolaco ya figura como vigente en el
 * expediente («Ketorolaco 10 mg cada 8 horas») y hoy se receta «Ketorolaco 10
 * mg cada 8 horas»». La receta se avisaba a sí misma, en rojo, en cada
 * renglón.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * **Mirando la pantalla**, no leyendo el código: la sonda
 * `mirar-la-receta-con-expediente.mjs` sobre el arnés de emuladores, 5-sep-2026,
 * con el paciente sintético `pac-006`. Las 33 pruebas de REG-523 y REG-524
 * estaban en verde: ninguna ejercitaba «la nota que se imprime también está
 * firmada». `design-system.md`: «No se aprueba una interfaz leyendo el código».
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Al construir «lo vigente» en la receta se excluye la nota que se está
 * imprimiendo (`n.id !== notaId`). Lo que ella receta es «lo de hoy»; el resto
 * de notas firmadas es «lo que ya toma». En la consulta también: una nota
 * firmada se puede reabrir (adenda), y entraba igual.
 *
 * ── PROBADO AL REVÉS ─────────────────────────────────────────────────────────
 *
 * Con la receta como estaba, el caso 1 (fuente) es rojo, y el caso 2 enseña el
 * falso positivo que salía.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * - Una nota firmada DUPLICADA (misma consulta guardada dos veces con ids
 *   distintos) seguiría cruzándose: no hay forma de saber que es la misma.
 * - No renderiza la receta; la sonda del arnés es la que la mira.
 */

describe('REG-531 · la nota que se imprime no cuenta como «ya lo toma»', () => {
  const receta = limpiarComentarios(readFileSync(join(process.cwd(), 'src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx'), 'utf8'))

  it('1 · EL CASO: la receta excluye su propia nota al construir lo vigente', () => {
    expect(receta).toContain("ns.filter(n => n.estado === 'firmada' && n.id !== notaId)")
    // Y el efecto se rehace si cambia la nota abierta.
    expect(receta).toMatch(/\}, \[clinicId, patientId, notaId\]\)/)
  })

  it('1b · y la consulta, donde una nota firmada se puede reabrir, excluye la abierta', () => {
    const consulta = limpiarComentarios(readFileSync(join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8'))
    expect(consulta).toContain("ns.filter(n => n.estado === 'firmada' && n.id !== notaIdRef.current)")
  })

  it('2 · lo que pasaba: con la propia nota entre las firmadas, cada renglón se cruzaba consigo mismo', () => {
    const hoyISO = '2026-09-05'
    const notaHoy = { id: 'nota-hoy', fecha: hoyISO, medicamentos: [{ nombre: 'Ketorolaco', dosis: '10 mg', via: 'oral' as const, frecuencia: 'cada 8 horas', duracion: '3 días' }] }
    const notaPrevia = { id: 'nota-previa', fecha: '2026-07-07', medicamentos: [{ nombre: 'Warfarina', dosis: '5 mg', via: 'oral' as const, frecuencia: 'cada 24 horas', duracion: 'crónico' }] }
    const hoy = notaHoy.medicamentos

    // Como estaba: las dos notas entran → Ketorolaco «ya figura como vigente».
    const conElla = [...estadoDeMedicamentos([notaPrevia, notaHoy], `${hoyISO}T18:00:00.000Z`).vigentes].map(v => v.medicamento)
    expect(terapiaDuplicadaDeLaLista(hoy, conElla).map(d => d.med)).toEqual(['Ketorolaco'])

    // Como debe ser: sin la nota que se imprime, nada se cruza consigo mismo.
    const sinElla = [...estadoDeMedicamentos([notaPrevia], `${hoyISO}T18:00:00.000Z`).vigentes].map(v => v.medicamento)
    expect(terapiaDuplicadaDeLaLista(hoy, sinElla)).toEqual([])
  })
})
