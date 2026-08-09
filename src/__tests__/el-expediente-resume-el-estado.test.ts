/**
 * EL EXPEDIENTE RESUME EL ESTADO ACTUAL — REG-262.
 *
 * ── LO QUE DECÍAN LOS PROPIOS MOTORES ───────────────────────────────────────
 *
 *     src/lib/expediente/problemas-activos.ts::resumenProblemas
 *     src/lib/expediente/ordenes-medicamento.ts::resumenVigentes
 *
 * Los dos con el mismo comentario: *«Frase corta para el encabezado de la
 * consulta»*. Y sin un solo llamador.
 *
 * ── POR QUÉ NO SE CONECTARON EN LA CONSULTA ─────────────────────────────────
 *
 * Porque ahí **ya se enseñan las dos listas ENTERAS**. Una versión corta al
 * lado de la larga no informa: duplica. El comentario pedía un sitio que
 * resultó no ser el suyo.
 *
 * Van en el **expediente**, que es donde el charter V7 §8 dice que el médico
 * llega preparado —«resumen conciso del paciente, problemas activos,
 * medicación actual»— y donde no había ningún resumen: para saber qué tiene y
 * qué toma había que leerse la lista de notas entera.
 *
 * Y cuesta **cero lecturas más**: el expediente ya tiene las notas cargadas.
 *
 * ── LA MISMA PROYECCIÓN, NO UNA PARECIDA ────────────────────────────────────
 *
 * Se arma el `{ fecha, medicamentos, diagnosticos }` **igual** que la consulta.
 * Si aquí se construyera distinto, el mismo paciente tendría dos «problemas
 * activos» según la pantalla desde la que se le mire — que es exactamente la
 * clase de segunda verdad que este loop lleva reparando.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { resumenProblemas } from '@/lib/expediente/problemas-activos'
import { resumenVigentes } from '@/lib/expediente/ordenes-medicamento'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const exp = leer('src/app/(dashboard)/expediente/[patientId]/page.tsx')
const consulta = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')

const problema = (descripcion: string, estado?: string) =>
  ({ diagnostico: { descripcion, estado }, dichoEn: '2026-08-08' }) as never
const orden = (nombre: string) => ({ medicamento: { nombre } }) as never

describe('los motores, medidos', () => {
  it('hasta tres se enseñan enteros', () => {
    expect(resumenProblemas([problema('Diabetes'), problema('Hipertensión')]))
      .toBe('Diabetes · Hipertensión')
  })

  it('de cuatro en adelante se cuentan los que faltan', () => {
    /** «y 2 más» dice cuántos quedan; cortar sin decirlo escondería datos. */
    expect(resumenProblemas([
      problema('A'), problema('B'), problema('C'), problema('D'), problema('E'),
    ])).toBe('A · B · C y 2 más')
  })

  it('vacío NO se dice «ninguno»: se dice que no hay registro', () => {
    /**
     * «Sin problemas» afirmaría que el paciente está sano. «Sin problemas
     * REGISTRADOS» dice lo que de verdad se sabe.
     */
    expect(resumenProblemas([])).toBe('Sin problemas registrados')
    expect(resumenVigentes([])).toBe('Sin medicación registrada')
  })

  it('la medicación se resume igual', () => {
    expect(resumenVigentes([orden('Metformina'), orden('Losartán')]))
      .toBe('Metformina · Losartán')
  })
})

describe('CORREN en el expediente', () => {
  it('la pantalla los importa y los usa', () => {
    expect(exp).toContain("import { problemasActivos, resumenProblemas } from '@/lib/expediente/problemas-activos'")
    expect(exp).toContain("import { medicamentosVigentes, resumenVigentes } from '@/lib/expediente/ordenes-medicamento'")
    expect(exp).toMatch(/resumenProblemas\(problemas\)/)
    expect(exp).toMatch(/resumenVigentes\(vigentes\)/)
  })

  it('sólo cuenta lo FIRMADO', () => {
    /** Un borrador no es historia clínica: la nota de hoy aún se escribe. */
    expect(exp).toMatch(/notas\.filter\(n => n\.estado === 'firmada'\)/)
  })

  it('usa la MISMA proyección que la consulta, no una parecida', () => {
    /**
     * Si aquí se armara distinto, el mismo paciente tendría dos «problemas
     * activos» según la pantalla desde la que se le mire.
     */
    const forma = /fecha: n\.fechaConsulta \?\? n\.metadata\?\.fechaCreacion \?\? ''/
    expect(exp, 'el expediente no usa la proyección canónica').toMatch(forma)
    expect(consulta, 'la consulta cambió de proyección').toMatch(forma)
  })

  it('sin nada registrado no se enseña un recuadro vacío', () => {
    expect(exp).toMatch(/if \(!problemas\.length && !vigentes\.length\) return null/)
  })

  it('dice de dónde sale, para que no parezca un diagnóstico nuevo', () => {
    expect(exp).toMatch(/De lo último que se dijo de cada uno en sus notas/)
  })
})

describe('por qué NO se conectaron donde pedía su comentario', () => {
  it('la consulta ya enseña las listas enteras', () => {
    /**
     * Una versión corta al lado de la larga no informa: duplica. El comentario
     * pedía un sitio que resultó no ser el suyo, y eso se deja escrito para
     * que nadie lo «arregle» moviéndolo allí.
     */
    expect(consulta).toMatch(/problemas\.map\(p => p\.diagnostico\.descripcion/)
    expect(exp).toMatch(/No van en la consulta: ahí las dos listas ya se enseñan ENTERAS/)
  })
})
