/**
 * GOLDEN — la nota de hospital ya dice en qué cama estaba el paciente.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * `NotaMedica.hospital` existe en el modelo desde que existe el módulo de
 * hospitalización, y **entra en el hash de integridad**: `integrity.ts` lo
 * incluye entre los campos sellados y lo nombra en la lista de campos
 * protegidos. La nota firmada se sellaba prometiendo que ese bloque es
 * inmutable.
 *
 * Pero **nadie lo escribía**. Ni una pantalla, ni una ruta, ni el ensamblado.
 * Se sellaba un hueco.
 *
 * Y el impreso tampoco lo enseñaba: una nota de hospital que no dice en qué
 * servicio ni en qué cama estaba el paciente, ni qué día de internamiento era —
 * datos que la propia aplicación ya tiene en el episodio, a un identificador de
 * distancia (`nota.internamientoId`).
 *
 * Es el patrón que ya salió con el motor de dosis y con «rango horario
 * preferido», en su forma de dato: **un campo que el sistema promete y nunca
 * llena**.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  bloqueHospitalDe, diaDeHospitalizacion, encabezadoHospital,
  POR_QUE_NO_SE_INFIERE_LA_CONDICION,
} from '@/lib/hospital/bloque-nota'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

describe('el día de hospitalización se cuenta como en el pase de visita', () => {
  it('el día del ingreso es el día 1', () => {
    expect(diaDeHospitalizacion('2026-08-03T09:00:00Z', '2026-08-03T18:00:00Z')).toBe(1)
  })

  it('quien ingresó anoche a las 23:00 está HOY en su día 2', () => {
    /**
     * Contar por horas transcurridas daría 0 y contradiría al pizarrón del
     * servicio: lo que cuenta es cuántas veces cambió el día.
     */
    expect(diaDeHospitalizacion('2026-08-02T23:00:00', '2026-08-03T08:00:00')).toBe(2)
  })

  it('sin fecha de ingreso legible no hay día', () => {
    expect(diaDeHospitalizacion(undefined, '2026-08-03T08:00:00Z')).toBeUndefined()
    expect(diaDeHospitalizacion('ayer', '2026-08-03T08:00:00Z')).toBeUndefined()
  })

  it('una nota fechada ANTES del ingreso no tiene día', () => {
    // Poner «día 1» sería inventar una coherencia que el dato no tiene.
    expect(diaDeHospitalizacion('2026-08-10T09:00:00Z', '2026-08-03T09:00:00Z')).toBeUndefined()
  })
})

describe('lo que no se sabe queda AUSENTE, no en blanco', () => {
  it('un episodio completo llena el bloque', () => {
    const b = bloqueHospitalDe(
      { servicio: 'Medicina Interna', cama: '304-A', fechaIngreso: '2026-08-01T10:00:00Z' },
      '2026-08-03T10:00:00Z')
    expect(b).toEqual({
      servicio: 'Medicina Interna', cama: '304-A',
      fechaIngreso: '2026-08-01T10:00:00Z', diaHospitalizacion: 3,
    })
  })

  it('los campos vacíos no viajan como cadena vacía', () => {
    /**
     * Un `servicio: ''` dentro de un documento firmado afirma «no tiene
     * servicio», y lo cierto es «no se sabe».
     */
    const b = bloqueHospitalDe({ servicio: '   ', cama: '', fechaIngreso: '2026-08-01T10:00:00Z' }, '2026-08-01T12:00:00Z')
    expect(b).not.toHaveProperty('servicio')
    expect(b).not.toHaveProperty('cama')
  })

  it('sin episodio, o con uno vacío, NO se mete un objeto vacío en la nota', () => {
    // Un `hospital: {}` sellado es exactamente el hueco que se está reparando.
    expect(bloqueHospitalDe(null, '2026-08-03T10:00:00Z')).toBeUndefined()
    expect(bloqueHospitalDe({}, '2026-08-03T10:00:00Z')).toBeUndefined()
  })

  it('el egreso se copia cuando lo hay', () => {
    const b = bloqueHospitalDe(
      { servicio: 'MI', fechaIngreso: '2026-08-01T10:00:00Z', fechaEgreso: '2026-08-05T10:00:00Z' },
      '2026-08-05T11:00:00Z')
    expect(b?.fechaEgreso).toBe('2026-08-05T10:00:00Z')
  })
})

describe('lo que este módulo NO hace', () => {
  it('nunca rellena `condicion`', () => {
    /**
     * «Estable / grave / crítico» es un juicio del médico que escribe la nota.
     * Un campo vacío es honesto; un «estable» puesto por un programa es una
     * afirmación médica que nadie hizo, dentro de un documento que se firma.
     */
    const b = bloqueHospitalDe(
      { servicio: 'UCI', cama: '1', fechaIngreso: '2026-08-01T10:00:00Z', estado: 'activo' },
      '2026-08-03T10:00:00Z')
    expect(b).not.toHaveProperty('condicion')
    expect(POR_QUE_NO_SE_INFIERE_LA_CONDICION).toMatch(/juicio del médico/i)
  })

  it('ni el balance hídrico, que registra enfermería', () => {
    const b = bloqueHospitalDe({ servicio: 'UCI', fechaIngreso: '2026-08-01T10:00:00Z' }, '2026-08-02T10:00:00Z')
    expect(b).not.toHaveProperty('balanceHidrico')
  })
})

describe('el encabezado del impreso', () => {
  it('junta lo que hay', () => {
    expect(encabezadoHospital({ servicio: 'MI', cama: '304-A', diaHospitalizacion: 3 }))
      .toBe('Servicio: MI · Cama: 304-A · Día de hospitalización: 3')
  })

  it('y desaparece cuando no hay nada que poner', () => {
    expect(encabezadoHospital(undefined)).toBe('')
    expect(encabezadoHospital({})).toBe('')
  })
})

describe('está conectado en los dos extremos', () => {
  it('la consulta lo escribe al armar la nota', () => {
    const s = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
    expect(s).toContain('hospital: bloqueHospitalDe(episodio, now)')
    expect(s).toContain('getInternamiento(clinicId, internamientoActivo)')
  })

  it('y no bloquea el guardado si el episodio no se puede leer', () => {
    // Bloquear el guardado de una nota clínica por un dato administrativo sería
    // peor que guardarla sin él.
    const s = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
    const i = s.indexOf('getInternamiento(clinicId, internamientoActivo)')
    expect(s.slice(i, i + 500)).toContain('.catch(')
  })

  it('el impreso de la nota lo enseña', () => {
    const s = leer('src', 'app', '(dashboard)', 'nota', '[patientId]', '[notaId]', 'page.tsx')
    expect(s).toContain('encabezadoHospital(nota.hospital)')
  })

  it('el impreso NO lo deduce por su cuenta', () => {
    // Sale sólo si la nota lo trae: el papel no calcula nada.
    const s = leer('src', 'app', '(dashboard)', 'nota', '[patientId]', '[notaId]', 'page.tsx')
    expect(s).not.toContain('bloqueHospitalDe(')
  })
})

describe('el sello sigue cubriendo el bloque', () => {
  it('`hospital` continúa entre los campos sellados', () => {
    // Llenarlo no puede sacarlo del hash: es justo ahora cuando hay algo que
    // proteger.
    const s = leer('src', 'lib', 'expediente', 'integrity.ts')
    expect(s).toContain('infectologia: nota.infectologia ?? null')
    expect(s).toContain("'signosVitales', 'preop', 'hospital', 'infectologia', 'estudiosOrden',")
  })
})
