/**
 * GOLDEN — «el paciente no sabe la dosis» es una respuesta, no un hueco.
 *
 * ── POR QUÉ EXISTE ESTA SALIDA ───────────────────────────────────────────────
 *
 * El médico dueño pidió que sin dosis no se firme (REG-174) y que sin unidad
 * tampoco (REG-175). Al medir el impacto sobre sus notas reales con el motor de
 * verdad, **la mitad no se habrían podido firmar** — y lo que las bloqueaba no
 * eran descuidos:
 *
 *     Pregabalina .................... «No especificada»
 *     Antibiótico no especificado .... «No especificada»
 *     Antihipertensivo no especificado «No especificada»
 *     Telmisartán .................... (vacío)
 *
 * Medicación previa que el paciente refiere y cuya dosis no conoce. «Toma algo
 * para la presión» es un hecho clínico legítimo. Con la compuerta cerrada habría
 * que **inventarse una dosis que el paciente no dijo**.
 *
 * Se le plantearon tres caminos y eligió éste (5-ago-2026): permitir la
 * declaración explícita.
 *
 * ── LO QUE HACE QUE NO SEA UN PARCHE ─────────────────────────────────────────
 *
 * La declaración es **un acto del médico**. Si se aceptara «No especificada» —lo
 * que escribe la IA cuando no captó la dosis— la compuerta quedaría desactivada
 * de vuelta y no se habría arreglado nada.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DOSIS_DESCONOCIDA, esDosisDeclaradaDesconocida } from '@/lib/seguridad/dosis-desconocida'

const consulta = readFileSync(join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8')

describe('LA DECLARACIÓN SE RECONOCE', () => {
  it('la frase canónica que pone el botón', () => {
    expect(esDosisDeclaradaDesconocida(DOSIS_DESCONOCIDA)).toBe(true)
  })

  it('sin importar mayúsculas ni espacios de sobra', () => {
    expect(esDosisDeclaradaDesconocida(`  ${DOSIS_DESCONOCIDA.toUpperCase()}  `)).toBe(true)
  })

  it('y dice QUIÉN no la sabe', () => {
    /**
     * «Desconocida» a secas se leería como un fallo del sistema. El hecho
     * clínico es que el paciente no la conoce, y así se imprime.
     */
    expect(DOSIS_DESCONOCIDA).toMatch(/paciente/)
  })
})

describe('LO QUE ESCRIBE LA IA NO CUENTA COMO DECLARACIÓN', () => {
  it('«No especificada» sigue siendo un hueco', () => {
    /**
     * Es EL punto de todo esto. Aceptarlo desactivaría la compuerta de vuelta:
     * el modelo lo pone solo, sin que nadie decida nada.
     */
    expect(esDosisDeclaradaDesconocida('No especificada')).toBe(false)
    expect(esDosisDeclaradaDesconocida('no especificada')).toBe(false)
  })

  it('ni ninguna variante parecida', () => {
    for (const v of ['desconocida', 'no la sabe', 'se desconoce', 'n/a', '?', '']) {
      expect(esDosisDeclaradaDesconocida(v)).toBe(false)
    }
  })

  it('ni una dosis de verdad, claro', () => {
    expect(esDosisDeclaradaDesconocida('500 mg')).toBe(false)
  })
})

describe('LA COMPUERTA DE FIRMA LA RESPETA', () => {
  it('lo declarado desconocido no bloquea', () => {
    const i = consulta.indexOf('const dosisMal = medicamentos')
    expect(consulta.slice(i, i + 700)).toContain('!esDosisDeclaradaDesconocida(m.dosis)')
  })

  it('y tampoco aparece como aviso pendiente', () => {
    // Una respuesta no es algo por revisar.
    const i = consulta.indexOf('const dosisIncompletas')
    expect(consulta.slice(i, i + 900)).toContain('!esDosisDeclaradaDesconocida(m.dosis)')
  })

  it('pero la compuerta sigue en pie para los huecos de verdad', () => {
    expect(consulta).toContain("x.aviso?.codigo === 'dosis_sin_cifra'")
    expect(consulta).toContain("x.aviso?.codigo === 'dosis_sin_unidad'")
  })
})

describe('EL BOTÓN ESTÁ, Y SÓLO DONDE HACE FALTA', () => {
  it('escribe la frase canónica en el renglón', () => {
    expect(consulta).toContain('dosis: DOSIS_DESCONOCIDA')
  })

  it('sólo si el renglón tiene nombre y le falta la dosis', () => {
    /**
     * En el caso normal —teclear la cantidad— no estorba. Y sin nombre no hay
     * medicamento que declarar.
     */
    expect(consulta).toContain("!firmada && m.nombre?.trim() && !m.dosis?.trim() && (")
  })

  it('y no aparece en una nota ya firmada', () => {
    const i = consulta.indexOf('dosis: DOSIS_DESCONOCIDA')
    expect(consulta.slice(Math.max(0, i - 400), i)).toContain('!firmada')
  })
})
