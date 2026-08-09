/**
 * LA ALERGIA ESTRUCTURADA LLEGA A LA COMPUERTA QUE BLOQUEA LA FIRMA.
 *
 * ── EL DEFECTO (7-ago-2026, REG-214) ─────────────────────────────────────────
 *
 * La pantalla de consulta sellaba en la nota
 * `parsearAlergiasTexto(patient?.alergias)`, que **sólo mira el texto libre**.
 * Un paciente cuya alergia vive en `alergiasEstructuradas` —que es donde la deja
 * el registro estructurado— sellaba `alergias: []`.
 *
 * Y de `nota.alergias` cuelga la compuerta de `nom004.ts`: el cruce por
 * subcadena y el de **reactividad cruzada por familias**.
 *
 * Reproducido con los motores reales, sin simular nada:
 *
 *     paciente con «Penicilina» sólo en el campo estructurado
 *     + prescripción de cefalexina
 *
 *     lo que se sellaba HOY  →  0 alergias  →  la compuerta da 0 errores
 *     con `alergiasDe`       →  1 alergia   →  «[Contraindicado] beta-lactámicos»
 *
 * **El betalactámico se firmaba sobre un alérgico, con el aviso a la vista en la
 * pantalla.** Porque la pantalla lee `alergiasDe` y lo que se sella leía otra
 * cosa.
 *
 * ── DE QUÉ FAMILIA ES ────────────────────────────────────────────────────────
 *
 * **Dos lecturas del mismo campo** — la familia de REG-034, REG-035 y REG-171, y
 * exactamente lo que el [ADR-001] existe para impedir: una fuente de verdad por
 * entidad clínica. Aquí había dos, y la que gobernaba la seguridad era la ciega.
 *
 * ── QUIÉN LO ENCONTRÓ ────────────────────────────────────────────────────────
 *
 * La rutina autónoma del Master Loop, trabajando en su propia rama. Su
 * diagnóstico era correcto; **su reparación no**: usaba `alergenosDe`, que
 * devuelve `string[]`, cuando la compuerta espera `AlergiaEstructurada[]`. Con
 * su versión la compuerta habría seguido ciega por otra puerta.
 *
 * Se verificó antes de traerla. Es la razón por la que el trabajo de una sesión
 * autónoma se revisa y no se fusiona a ojo.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { alergiasDe, parsearAlergiasTexto } from '@/lib/seguridad/alergias'
import { validarNOM004 } from '@/lib/expediente/nom004'

/** Paciente real: la alergia SÓLO en el campo estructurado, el texto vacío. */
const PACIENTE = {
  alergias: '',
  alergiasEstructuradas: [{ alergeno: 'Penicilina', severidad: 'grave' as const }],
}

const NOTA_BASE = {
  metadata: { medicoId: 'm1', cedulaProfesional: '123' },
  fechaConsulta: '2026-08-07T10:00:00Z',
  tipo: 'consulta',
  resumen: 'Faringitis',
  diagnosticos: [{ descripcion: 'Faringitis' }],
  secciones: [],
  signosVitales: { fc: 80 },
  medicamentos: [
    { nombre: 'Cefalexina', dosis: '500', unidad: 'mg', via: 'oral', frecuencia: 'cada 8 horas' },
  ],
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const validar = (alergias: unknown) => validarNOM004({ ...NOTA_BASE, alergias } as any)

describe('la alergia estructurada llega a la compuerta', () => {
  it('el lector que se usaba antes se quedaba ciego — así se veía el defecto', () => {
    /**
     * No es nostalgia: si esta aserción deja de valer, el defecto ya no se puede
     * reproducir y la prueba de abajo estaría certificando algo distinto.
     */
    expect(parsearAlergiasTexto(PACIENTE.alergias)).toHaveLength(0)
    expect(validar(parsearAlergiasTexto(PACIENTE.alergias)).errores).toHaveLength(0)
  })

  it('con el lector correcto, la compuerta SÍ ve la alergia', () => {
    const alergias = alergiasDe(PACIENTE)
    expect(alergias).toHaveLength(1)
    expect(alergias[0].alergeno).toBe('Penicilina')
  })

  it('penicilina + cefalexina: la compuerta devuelve el error de reactividad cruzada', () => {
    const errores = validar(alergiasDe(PACIENTE)).errores
    expect(errores.length).toBeGreaterThan(0)
    expect(errores.join(' ')).toMatch(/beta[\s-]*lact[aá]mic/i)
  })

  it('el tipo que devuelve el lector es el que la compuerta espera', () => {
    /**
     * La reparación de la sesión autónoma usaba `alergenosDe`, que devuelve
     * `string[]`. La compuerta hace `al.alergeno.toLowerCase()`: con cadenas
     * sueltas revienta o queda ciega. El tipo ES parte del arreglo.
     */
    for (const a of alergiasDe(PACIENTE)) {
      expect(typeof a).toBe('object')
      expect(typeof a.alergeno).toBe('string')
    }
  })

  it('lo que el campo NIEGA sigue sin contar como alergia', () => {
    // La razón por la que existía el filtro del texto libre no se pierde:
    // «niega alergia a penicilina» no es una alergia a penicilina.
    const niega = alergiasDe({ alergias: 'niega alergia a penicilina' })
    expect(niega).toHaveLength(0)
    expect(validar(niega).errores).toHaveLength(0)
  })

  it('sin alergias registradas no se inventa ninguna', () => {
    expect(alergiasDe({})).toHaveLength(0)
    expect(validar([]).errores).toHaveLength(0)
  })

  it('ESTÁ CABLEADO: la pantalla sella con el lector que ve las dos fuentes', () => {
    /**
     * El módulo puede estar perfecto y no correr — es la familia de defecto más
     * grande del ledger (9 de 61). Esto comprueba el cable, no la función.
     */
    const page = readFileSync(
      join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'),
      'utf8',
    )
    expect(page).toContain('alergias: alergiasDe(patient ?? {})')
    expect(page).not.toContain('alergias: parsearAlergiasTexto(patient?.alergias)')
  })
})
