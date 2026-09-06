/**
 * S-003 · Panel de Lujo (S-ciberseguridad) — el buzón de soporte guardaba SIN
 * REDACTAR la prosa que el médico escribe —donde caben nombre, teléfono y
 * motivo de consulta— en una colección de plataforma que se lee desde fuera
 * del consultorio.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * `src/app/api/soporte/route.ts` hacía `adminDb.collection('soporte').add({…
 * mensaje })` con el texto tal cual, y tomaba `clinicId` del cuerpo. La ruta
 * hermana `/api/errores` pasa mensaje y traza por `redactarString()` con el
 * comentario «esta colección es RAÍZ — se lee desde fuera del consultorio».
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor S-ciberseguridad, S-003 (P2); el equipo rojo confirmó la evidencia
 * literal y refutó sólo la mitad del `clinicId` (no concede acceso: etiqueta
 * mal el ticket). El formulario (`SoporteSection.tsx`) no advertía nada.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * Dos rutas gemelas escritas en momentos distintos, y la segunda sin el
 * redactor. La prosa libre es el único sitio donde el médico puede meter PHI
 * sin darse cuenta.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 * `documentoDeSoporte` (módulo puro) pasa mensaje, nombre y correo por
 * `redactarString` antes de que la ruta escriba, y el `clinicId` sale de la
 * membresía verificada. security-tenant: PHI nunca en un mensaje de error ni
 * en una colección que se lee fuera del consultorio.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * Que el formulario ENSEÑE `AVISO_SIN_DATOS_DEL_PACIENTE` (SoporteSection es de
 * UI-CONFIG: handoff). No prueba la ruta HTTP con Firestore. La calidad del
 * redactor es de `sanitize.test.ts`; aquí sólo que se aplica.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { documentoDeSoporte, AVISO_SIN_DATOS_DEL_PACIENTE } from '@/lib/security/soporte-redactado'

const AHORA = '2026-09-06T12:00:00.000Z'

describe('S-003 · el buzón de soporte redacta antes de guardar', () => {
  it('un teléfono y un correo sintéticos dentro de la prosa NO llegan al documento', () => {
    const doc = documentoDeSoporte({
      uid: 'u1', clinicId: 'c1', tipo: 'falla', ahoraIso: AHORA,
      mensaje: 'La receta no imprime. Es para el paciente que me escribió al 55 1234 5678 y a prueba.sintetica@ejemplo.mx',
      email: 'medico.sintetico@ejemplo.mx', nombre: 'Dra. Sintética',
    })
    const texto = String(doc.mensaje)
    expect(texto).not.toContain('1234 5678')
    expect(texto).not.toContain('prueba.sintetica@ejemplo.mx')
    // Y conserva el síntoma: la falla se sigue pudiendo describir.
    expect(texto).toContain('La receta no imprime')
    expect(String(doc.email)).not.toContain('medico.sintetico@ejemplo.mx')
  })

  it('el clinicId es el que se le pasa desde la membresía; el tipo se acota al catálogo; la forma es fija', () => {
    const doc = documentoDeSoporte({ uid: 'u1', clinicId: 'de-la-membresia', tipo: 'inventado', mensaje: 'hola', ahoraIso: AHORA })
    expect(doc.clinicId).toBe('de-la-membresia')
    expect(doc.tipo).toBe('duda')
    expect(Object.keys(doc).sort()).toEqual(['clinicId', 'email', 'estado', 'fecha', 'mensaje', 'nombre', 'tipo', 'uid'])
    expect(doc.estado).toBe('nuevo')
  })

  it('la ruta usa el módulo puro y NO toma el clinicId del cuerpo', () => {
    const ruta = readFileSync(resolve(process.cwd(), 'src/app/api/soporte/route.ts'), 'utf8')
    expect(ruta).toContain("from '@/lib/security/soporte-redactado'")
    expect(ruta).toContain('documentoDeSoporte(')
    expect(ruta).not.toMatch(/clinicId:\s*String\(body\.clinicId/)
    expect(ruta).toMatch(/clinic_members.*\.doc\(acceso\.uid\)/)
  })

  it('el aviso del formulario habla como persona y dice lo que hace falta', () => {
    expect(AVISO_SIN_DATOS_DEL_PACIENTE).toMatch(/sin nombre, teléfono ni datos del paciente/)
    expect(AVISO_SIN_DATOS_DEL_PACIENTE).toMatch(/se tacha antes de guardarse/)
  })
})
