/**
 * LA FRANJA DEL PISO AFIRMABA LA AUSENCIA DE UNA ALERGIA QUE SÍ ESTABA — REG-279.
 *
 * ── LA SEXTA COPIA ─────────────────────────────────────────────────────────
 *
 * La franja de alergias del internamiento —la que se ve en **todo momento** del
 * ingreso, y que existe precisamente para quien NO pasa por el punto de orden:
 * enfermería que administra, quien prescribe a mano— tenía su propia lógica:
 *
 *     split(/[,;\n]+/)                          ← sin el punto, sin la barra
 *     negadas = lista.length === 1 && /^(no|niega|ninguna|sin)\b/i.test(...)
 *
 * Reproducido: **«Niega penicilina. Alérgico a sulfas»** quedaba como UN
 * fragmento, empezaba por «niega», y la franja anunciaba en gris:
 *
 *     «Alergias negadas por el paciente.»
 *
 * Sobre un paciente alérgico a sulfas.
 *
 * ── POR QUÉ ES LO PEOR DE LA SERIE ──────────────────────────────────────────
 *
 * No es un aviso que falte. Es el sistema **afirmando la ausencia** de una
 * alergia que el expediente sí registra, en la **única señal que ve el equipo
 * del piso**. Un hueco calla; esto miente.
 *
 * Y descartar primero lo frecuente y apuntar después lo que sí hay es la forma
 * NORMAL de escribir el campo: ya costó REG-171 y REG-201.
 *
 * Además ignoraba `alergiasEstructuradas` por completo.
 *
 * ── LA SEGUNDA CONDICIÓN, QUE ES LA QUE IMPORTA ─────────────────────────────
 *
 * «Negadas» ahora exige **las dos cosas**: que el campo tenga una negación
 * explícita **y** que no quede ningún alérgeno. Con sólo la primera se vuelve a
 * poder decir «negadas» habiendo alergia — que es exactamente el defecto.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { alergiasDe, negacionesEnTexto } from '@/lib/seguridad/alergias'

/** La decisión de la franja, tal cual la toma la pantalla. */
function loQueDiceLaFranja(alergias?: string) {
  const lista = alergiasDe({ alergias }).map(a => a.alergeno)
  const negadas = lista.length === 0 && negacionesEnTexto(alergias).length > 0
  if (lista.length) return `ROJO: ${lista.join(' · ')}`
  return negadas ? 'GRIS: alergias negadas' : 'ÁMBAR: sin registro'
}

describe('el caso que lo motiva', () => {
  it('«Niega penicilina. Alérgico a sulfas» pinta ROJO con las sulfas', () => {
    expect(loQueDiceLaFranja('Niega penicilina. Alérgico a sulfas')).toBe('ROJO: sulfas')
  })

  it('y no dice en ningún caso «negadas» cuando queda un alérgeno', () => {
    /**
     * La invariante entera del arreglo, en una línea: si hay algo que enseñar,
     * no se puede afirmar que no hay nada.
     */
    for (const campo of [
      'Niega penicilina. Alérgico a sulfas',
      'Niega alergia a penicilina, alérgico a sulfas',
      'Niega penicilina; alérgico a mariscos',
      'Sin alergias conocidas. Alérgico a AINEs',
    ]) {
      expect(loQueDiceLaFranja(campo), campo).toMatch(/^ROJO/)
    }
  })
})

describe('los tres estados siguen distinguiéndose', () => {
  it('ROJO cuando hay alergia', () => {
    expect(loQueDiceLaFranja('Penicilina')).toBe('ROJO: Penicilina')
  })

  it('GRIS cuando el campo NIEGA de verdad', () => {
    /**
     * «Negadas» tiene que seguir existiendo: un campo negado y un campo vacío
     * son cosas distintas, y confundirlos haría que la franja gritara ámbar en
     * todos los ingresos hasta que nadie la mirara.
     */
    for (const campo of ['Niega alergias', 'NKDA', 'Alergias: negadas', 'Ninguna']) {
      expect(loQueDiceLaFranja(campo), campo).toBe('GRIS: alergias negadas')
    }
  })

  it('ÁMBAR cuando no hay registro — que NO es lo mismo que negadas', () => {
    /** Ausencia de dato no es dato de ausencia. */
    expect(loQueDiceLaFranja('')).toBe('ÁMBAR: sin registro')
    expect(loQueDiceLaFranja(undefined)).toBe('ÁMBAR: sin registro')
  })
})

describe('y la franja lee de la fuente común', () => {
  const pagina = readFileSync(
    join(process.cwd(), 'src/app/(dashboard)/hospitalizacion/[internamientoId]/page.tsx'), 'utf8')

  it('ya no parte el campo por su cuenta', () => {
    expect(pagina).not.toMatch(/String\(raw\)\.split\(\/\[,;\\n\]\+\//)
  })

  it('usa `alergiasDe`, que ve también el campo estructurado', () => {
    expect(pagina).toContain("from '@/lib/seguridad/alergias'")
    expect(pagina).toMatch(/const lista = alergiasDe\(patient \?\? \{\}\)/)
  })

  it('y «negadas» exige las DOS condiciones', () => {
    /**
     * Con sólo «hay una negación» se vuelve a poder decir «negadas» habiendo
     * alergia. La condición de que la lista esté vacía es el arreglo.
     */
    expect(pagina).toMatch(/const negadas = lista\.length === 0 && negacionesEnTexto/)
  })
})
