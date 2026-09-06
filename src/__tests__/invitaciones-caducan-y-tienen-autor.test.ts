/**
 * ZL-011 · Panel de Lujo (Z-legal) — una invitación de equipo se creaba desde
 * el navegador sin forma congelada: sin `expiresAt` no caducaba nunca,
 * `creadoPor` no se ataba al uid, y el código salía de `Math.random`.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * `invitations.ts`: `Math.random()` para el código; `setDoc` con la forma que
 * quisiera el cliente. `firestore.rules` (clinic_invitations create): sólo
 * `isMedico` y `role != 'admin'` salvo admin — sin hasOnly, sin exigir
 * expiresAt/used/creadoPor. `api/clinic/unirse`: `if (inv.expiresAt && …)`
 * → sin `expiresAt` nunca expira.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor Z-legal, ZL-011 (P3); el equipo rojo contuvo el impacto (un solo
 * uso, rol no escalable, revocable) y dejó el hueco: «un enlace que no caduca».
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 * · `documentoDeInvitacion` (puro) fija la forma: autor == uid, `used:false`,
 *   `expiresAt` (ISO) y `expiresAtMs` (epoch, lo compara la regla);
 * · la regla exige esa forma con `hasOnly` y acota la caducidad a 8 días;
 * · `invitacionVigente` (compartido por cliente y servidor) rechaza la
 *   invitación SIN caducidad, ilegible o vencida;
 * · el código sale de `crypto.getRandomValues` (32 símbolos dividen 256: sin sesgo).
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * La ejecución de la regla (emulator/panel-de-lujo-seguridad.emu.test.ts). No
 * mide la entropía del generador; fija que no use Math.random.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { documentoDeInvitacion, generarCodigo, esValida, DURACION_MS } from '@/lib/invitations'
import { invitacionVigente } from '@/lib/security/invitacion-vigente'

const AHORA = Date.parse('2026-09-06T12:00:00.000Z')

describe('ZL-011 · la invitación nace con autor, sin usar y con caducidad doble', () => {
  it('la forma es exactamente la que congela la regla', () => {
    const d = documentoDeInvitacion({
      code: 'ABCDEFGHJK', clinicId: 'c1', clinicNombre: 'Consultorio Sintético', role: 'secretaria',
      creador: { uid: 'u-medico', email: 'medico@ejemplo.mx' }, ahoraMs: AHORA,
    })
    expect(d.creadoPor).toBe('u-medico')
    expect(d.used).toBe(false)
    expect(d.expiresAtMs).toBe(AHORA + DURACION_MS)
    expect(Date.parse(d.expiresAt)).toBe(d.expiresAtMs)
    // Sin undefined: Firestore los rechaza y la regla congela las claves.
    expect(Object.values(d).some(v => v === undefined)).toBe(false)
    expect('nombreInvitado' in d).toBe(false)
    const permitidas = ['code', 'clinicId', 'clinicNombre', 'role', 'nombreInvitado', 'especialidad',
      'creadoPor', 'creadoPorEmail', 'createdAt', 'expiresAt', 'expiresAtMs', 'used']
    for (const k of Object.keys(d)) expect(permitidas, k).toContain(k)
  })

  it('la lista de claves de la regla y la del documento coinciden', () => {
    const reglas = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8')
    const m = reglas.match(/match \/clinic_invitations\/\{code\}[\s\S]*?keys\(\)\.hasOnly\(\[([^\]]*)\]\)/)
    expect(m).not.toBeNull()
    const enRegla = [...m![1].matchAll(/'([^']+)'/g)].map(x => x[1]).sort()
    const d = documentoDeInvitacion({
      code: 'X', clinicId: 'c', clinicNombre: 'n', role: 'medico', creador: { uid: 'u', email: 'e' },
      nombreInvitado: 'Invitada', especialidad: 'Medicina interna', ahoraMs: AHORA,
    })
    for (const k of Object.keys(d)) expect(enRegla, `la regla no admite «${k}»`).toContain(k)
  })

  it('el código no sale de Math.random y usa el alfabeto sin I/O/0/1', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/lib/invitations.ts'), 'utf8')
    // Sobre el CÓDIGO, no sobre la prosa: el comentario del módulo nombra
    // `Math.random` justamente para explicar por qué no se usa, y un guardián
    // que mira el fichero entero castigaría esa explicación y empujaría a
    // borrarla. Se quitan comentarios de bloque y de línea antes de mirar.
    const codigo = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(codigo).not.toContain('Math.random')
    expect(src).toContain('getRandomValues')
    const fijo = generarCodigo(n => new Uint8Array(n).map((_, i) => (i * 37) % 256))
    expect(fijo).toHaveLength(10)
    expect(fijo).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/)
    expect(generarCodigo()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/)
  })

  it('sin expiresAt la invitación NO es válida — ni en el cliente ni en el servidor', () => {
    const sinCaducidad = { used: false } as Parameters<typeof invitacionVigente>[0]
    expect(invitacionVigente(sinCaducidad, AHORA).ok).toBe(false)
    expect(invitacionVigente({ used: false, expiresAt: 'ayer' }, AHORA).ok).toBe(false)
    expect(invitacionVigente({ used: false, expiresAt: new Date(AHORA - 1).toISOString() }, AHORA).ok).toBe(false)
    expect(invitacionVigente({ used: true, expiresAt: new Date(AHORA + 1000).toISOString() }, AHORA).ok).toBe(false)
    expect(invitacionVigente({ used: false, expiresAt: new Date(AHORA + 1000).toISOString() }, AHORA).ok).toBe(true)
    const d = documentoDeInvitacion({ code: 'X', clinicId: 'c', clinicNombre: 'n', role: 'medico', creador: { uid: 'u', email: 'e' }, ahoraMs: AHORA })
    expect(esValida(d, AHORA).ok).toBe(true)
    expect(esValida({ ...d, expiresAt: '' }, AHORA).ok).toBe(false)
  })

  it('la ruta de unirse usa el mismo juez que el cliente', () => {
    const ruta = readFileSync(resolve(process.cwd(), 'src/app/api/clinic/unirse/route.ts'), 'utf8')
    expect(ruta).toContain("from '@/lib/security/invitacion-vigente'")
    expect(ruta).not.toMatch(/if \(inv\.expiresAt && /)
  })
})
