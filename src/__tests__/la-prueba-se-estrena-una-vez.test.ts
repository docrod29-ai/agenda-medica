/**
 * N-007 · Panel de Lujo (N-negocio) — la prueba de 14 días se podía repetir
 * indefinidamente con otro correo: nada la ataba a una identidad.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * `/api/clinic/crear` concedía `trialEndsAtMs = ahora + 14 días` a toda cuenta
 * sin `clinic_members`. La defensa contra el reciclado (`decidirPrueba`) es
 * por cliente de Stripe, y el cliente de Stripe se crea por consultorio: correo
 * nuevo → uid nuevo → consultorio nuevo → cliente nuevo → prueba nueva.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor N-negocio, N-007; el equipo rojo lo ató a la decisión ABIERTA N-1
 * del dueño y anotó que su recomendación («una por cuenta, comprobada contra
 * Stripe») no cierra el camino. Briefing §3: sin recomendación que cierre, se
 * aplica el VALOR SEGURO — bloquear en vez de permitir — y se registra.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 * `pruebas_estrenadas/{sha256(correo normalizado)}`: la prueba se concede una
 * vez por identidad; la segunda vez el consultorio nace con la prueba YA
 * VENCIDA (paywall tras la gracia, lectura siempre). El alta NUNCA se bloquea
 * (decisión del dueño: nunca bloquear la app por falta de tarjeta). El correo
 * no se guarda: sólo la huella.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * Alias de dominio propio o correos desechables: eso es verificación de
 * teléfono (N-2), otra decisión. No prueba la transacción de Firestore.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { normalizarCorreo, huellaDeIdentidad, decidirFinDePrueba, DURACION_PRUEBA_MS } from '@/lib/security/prueba-por-identidad'

describe('N-007 · una identidad estrena la prueba una sola vez', () => {
  it('el correo se normaliza: mayúsculas, espacios, +etiqueta y puntos de Gmail', () => {
    expect(normalizarCorreo('  Doctor.Sintetico+prueba2@Gmail.com ')).toBe('doctorsintetico@gmail.com')
    expect(normalizarCorreo('doctor.sintetico@googlemail.com')).toBe('doctorsintetico@gmail.com')
    expect(normalizarCorreo('Dra.Sintetica+x@ejemplo.mx')).toBe('dra.sintetica@ejemplo.mx')
    expect(normalizarCorreo('sin-arroba')).toBe('')
    expect(normalizarCorreo('@ejemplo.mx')).toBe('')
  })

  it('la huella no contiene el correo, es determinista y distingue identidades', () => {
    const h = huellaDeIdentidad('Doctor.Sintetico+a@gmail.com')
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(h).toBe(huellaDeIdentidad('doctorsintetico@gmail.com'))
    expect(h).not.toBe(huellaDeIdentidad('otra@ejemplo.mx'))
    expect(h).not.toContain('sintetico')
    expect(huellaDeIdentidad('')).toBeNull()
  })

  it('identidad nueva: 14 días y se marca; identidad reciclada: nace vencida y NO se bloquea el alta', () => {
    const ahora = 1_800_000_000_000
    expect(decidirFinDePrueba({ yaEstrenada: false, ahoraMs: ahora })).toEqual({ finMs: ahora + DURACION_PRUEBA_MS, concedida: true })
    expect(decidirFinDePrueba({ yaEstrenada: true, ahoraMs: ahora })).toEqual({ finMs: ahora, concedida: false })
    expect(DURACION_PRUEBA_MS).toBe(14 * 24 * 60 * 60 * 1000)
  })

  it('la ruta de alta usa la huella dentro de la transacción y sólo marca cuando concede', () => {
    const ruta = readFileSync(resolve(process.cwd(), 'src/app/api/clinic/crear/route.ts'), 'utf8')
    expect(ruta).toContain("adminDb.collection('pruebas_estrenadas')")
    expect(ruta).toMatch(/tx\.get\(huellaRef\)/)
    expect(ruta).toMatch(/if \(huellaRef && prueba\.concedida\)[\s\S]*?tx\.set\(huellaRef, \{ estrenadaEn: ahora \}\)/)
    // El alta sigue ocurriendo aunque la prueba nazca vencida: no hay `return` de rechazo por huella.
    expect(ruta).not.toMatch(/estreno\?\.exists[\s\S]{0,80}status: 4/)
  })
})
