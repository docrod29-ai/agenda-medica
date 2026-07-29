import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * REG-015 y REG-017 — decisiones del médico dueño (bloque 1.3, 2026-07-28).
 *
 * Las reglas de Firestore son el control REAL: el cliente puede mentir, la regla
 * no. Se leen como texto porque no hay emulador en esta suite (el emulador con
 * matriz multi-tenant es la unidad E0-08); esto es un gate de forma que impide
 * que la regla se afloje sin que nadie se dé cuenta.
 */
const RULES = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8')

/** Extrae el bloque `match /<col>/{...} { ... }` para no buscar en todo el archivo. */
function bloque(coleccion: string): string {
  const i = RULES.indexOf(`match /${coleccion}/{`)
  if (i < 0) throw new Error(`No existe el bloque de ${coleccion} en firestore.rules`)
  // Hasta el siguiente `match /` de igual o menor anidación (aproximación suficiente).
  const resto = RULES.slice(i + 10)
  const j = resto.indexOf('\n      match /')
  return resto.slice(0, j < 0 ? 4000 : j)
}

describe('REG-017 · toda nota nace en BORRADOR', () => {
  const notas = bloque('notas')

  it('la regla de create exige estado == borrador', () => {
    expect(notas).toMatch(/allow create[\s\S]{0,300}?estado\s*==\s*'borrador'/)
  })

  it('una nota firmada sigue siendo inmutable', () => {
    expect(notas).toMatch(/allow update[\s\S]{0,120}?estado\s*!=\s*'firmada'/)
    expect(notas).toMatch(/allow delete[\s\S]{0,120}?estado\s*!=\s*'firmada'/)
  })

  it('el cliente ya no crea la nota directamente como firmada', () => {
    const consulta = readFileSync(
      resolve(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8',
    )
    // La única creación al firmar debe ser explícitamente 'borrador'.
    expect(consulta).toMatch(/createNota\([^)]*estado: 'borrador'/)
    expect(consulta).not.toMatch(/createNota\(clinicId, patientId, notaFirmada\)/)
  })
})

describe('REG-015 · el cobro sella autor e importe', () => {
  const cobros = bloque('cobros')

  it('la regla exige que el autor sea el uid autenticado', () => {
    expect(cobros).toMatch(/creadoPor\s*==\s*request\.auth\.uid/)
  })

  it('la regla exige monto numérico ≥ 0', () => {
    expect(cobros).toMatch(/monto is number/)
    expect(cobros).toMatch(/monto\s*>=\s*0/)
  })

  it('create ya no es un `read, create` abierto a cualquier miembro', () => {
    expect(cobros).not.toMatch(/allow read,\s*create:\s*if isMember/)
  })

  it('registrarCobro sella el uid y NO confía en lo que manda el llamador', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/lib/cobros.ts'), 'utf8')
    expect(src).toMatch(/creadoPor:\s*uid/)
    expect(src).toMatch(/auth\.currentUser\?\.uid/)
    // Sin sesión no se registra nada.
    expect(src).toMatch(/no puede registrarse sin autor autenticado/i)
  })

  it('un monto negativo se rechaza con un mensaje que explica la alternativa', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/lib/cobros.ts'), 'utf8')
    expect(src).toMatch(/monto\s*<\s*0/)
    expect(src).toMatch(/reembolso, no un monto negativo/i)
  })

  it('el tipo de transacción existe y arranca en PAYMENT', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/lib/cobros.ts'), 'utf8')
    expect(src).toMatch(/'PAYMENT'\s*\|\s*'REFUND'\s*\|\s*'CREDIT'\s*\|\s*'ADJUSTMENT'/)
    expect(src).toMatch(/tipo:\s*'PAYMENT'/)
  })
})
