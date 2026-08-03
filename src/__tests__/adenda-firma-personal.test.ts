/**
 * GOLDEN — la adenda la firma quien la escribe, no el consultorio.
 *
 * ── EL FALLO, DE LA AUDITORÍA MAYOR ──────────────────────────────────────────
 *
 * `guardarAdenda` mandaba `config.nombreMedico` y `config.cedulaProfesional`, que
 * son campos de **nivel clínica** —un valor por consultorio—. En un consultorio
 * con dos médicos, la adenda de la Dra. se imprimía con el nombre y la cédula
 * **del dueño**.
 *
 * Un documento medicolegal con un firmante falso impreso. Y una adenda no es
 * cualquier documento: es la enmienda a una nota ya firmada.
 *
 * Lo más incómodo: el servidor **ya sellaba el `autorUid` correcto** desde el
 * token. La bitácora decía la verdad y el papel decía otra cosa.
 *
 * Y `firestore.rules` lo tenía escrito desde antes: «FIRMAR ES UN ACTO PERSONAL
 * — nadie firma con la cédula de otro». Faltaba **el campo donde guardar la de
 * cada médico**.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const nota = leer('src', 'app', '(dashboard)', 'nota', '[patientId]', '[notaId]', 'page.tsx')
const tipos = leer('src', 'types', 'index.ts')
const config = leer('src', 'app', '(dashboard)', 'configuracion', 'page.tsx')

describe('el médico tiene su propia cédula', () => {
  it('el modelo la declara', () => {
    const i = tipos.indexOf('export interface Doctor {')
    const bloque = tipos.slice(i, i + 2200)
    expect(bloque).toContain('cedulaProfesional?: string')
  })

  it('y el `uid`, que es el puente con quien firma', () => {
    const i = tipos.indexOf('export interface Doctor {')
    expect(tipos.slice(i, i + 2200)).toContain('uid?: string')
  })

  it('se puede capturar al dar de alta al médico', () => {
    expect(config).toContain("{ key: 'cedulaProfesional', label: 'Cédula profesional'")
    // Y el formulario arranca con el campo, para no dejarlo `undefined`.
    expect(config).toContain("cedulaProfesional: ''")
  })
})

describe('la adenda firma con quien la escribe', () => {
  it('el nombre sale del médico en sesión', () => {
    expect(nota).toContain('autorNombre: medicoEnSesion?.nombre || config?.nombreMedico')
  })

  it('la cédula NO cae a la de la clínica cuando hay médico resuelto', () => {
    /**
     * Es la misma regla que la firma gráfica: poner la cédula de otro es peor
     * que no poner ninguna. Con un solo médico —donde la de la clínica ES la
     * suya— se conserva el comportamiento de antes.
     */
    expect(nota).toContain('autorCedula: medicoEnSesion')
    expect(nota).toContain('? (medicoEnSesion.cedulaProfesional || undefined)')
    expect(nota).toContain(': (config?.cedulaProfesional || undefined)')
  })

  it('el médico se resuelve por uid y, si no, por correo', () => {
    expect(nota).toContain('activeDoctors.filter(d => d.uid === uid)')
    expect(nota).toContain("(d.email ?? '').trim().toLowerCase() === correo")
  })

  it('y NO adivina cuando hay empate', () => {
    // Dos médicos con el mismo correo, o con el mismo uid por un dato corrupto:
    // mejor sin resolver que resolviendo mal.
    expect(nota).toContain('if (porUid.length === 1) return porUid[0]')
    expect(nota).toContain('porCorreo.length === 1 ? porCorreo[0] : undefined')
  })
})

describe('lo que ya estaba bien y se conserva', () => {
  it('el servidor sigue sellando el autor desde el token', () => {
    // El cliente propone el nombre para el impreso; la autoría de verdad la
    // sella el servidor y no se toca.
    const firestore = leer('src', 'lib', 'expediente', 'firestore.ts')
    expect(firestore).toContain('autorUid')
  })
})
