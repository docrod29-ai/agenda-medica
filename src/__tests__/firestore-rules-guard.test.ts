import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Guardián ESTÁTICO de firestore.rules (sin emulador). Fija las invariantes de
 * seguridad que un cambio accidental no debe romper: aislamiento por tenant,
 * inmutabilidad de notas firmadas (NOM-024), append-only del audit_log, secretos
 * solo Admin SDK, y default-deny. Hallazgo del panel (Ingeniería): "suite de reglas
 * cubriendo aislamiento de tenant e inmutabilidad".
 */
const reglas = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8')
const sinComentarios = reglas.replace(/\/\/[^\n]*/g, '')

describe('firestore.rules — invariantes de seguridad', () => {
  it('default-deny: el catch-all niega todo', () => {
    expect(reglas).toContain('match /{document=**}')
    expect(sinComentarios).toMatch(/match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;/)
  })

  it('aislamiento por tenant: isMember compara la clínica del miembro', () => {
    expect(sinComentarios).toContain('function isMember(clinicId)')
    expect(sinComentarios).toMatch(/memberClinicId\(\)\s*==\s*clinicId/)
  })

  it('notas firmadas son INMUTABLES (update y delete lo exigen)', () => {
    const ocurrencias = (sinComentarios.match(/estado != 'firmada'/g) || []).length
    expect(ocurrencias).toBeGreaterThanOrEqual(2) // al menos en update y delete
  })

  it('audit_log NO se escribe desde el cliente (solo Admin SDK) y es inmutable', () => {
    // Antes bastaba con que update y delete estuvieran cerrados. Ahora también el
    // create: la bitácora se escribe por /api/auditoria/registrar, que pone la
    // identidad desde el ID-token y la hora del servidor. Con `create: if isMember`
    // cualquier miembro podía fabricar entradas a nombre de otro médico.
    expect(sinComentarios).toMatch(/audit_log\/\{docId\}\s*\{[\s\S]{0,160}allow create, update, delete: if false;/)
  })

  it('audit_log solo lo lee personal clínico', () => {
    // No contiene notas, pero sí patientId/notaId: revela a quién se atendió.
    expect(sinComentarios).toMatch(/audit_log\/\{docId\}\s*\{\s*allow read: if isMedico\(clinicId\);/)
  })

  it('REGRESIÓN: la excepción por campo de config exige pertenecer a la clínica', () => {
    // Al bloquear la firma por campo, la segunda rama del || quedó sin isMember y
    // CUALQUIER usuario autenticado podía sobrescribir la config de cualquier
    // consultorio. El paréntesis importa.
    expect(sinComentarios).toMatch(/allow update: if isMedico\(clinicId\)\s*\|\|\s*\(isMember\(clinicId\)/)
  })

  it('secretos solo Admin SDK (nada del cliente)', () => {
    expect(sinComentarios).toMatch(/secretos\/\{docId\}\s*\{\s*allow read, write: if false;/)
  })

  it('NINGÚN write/update/delete es públicamente abierto (if true)', () => {
    // 'create: if true' está permitido SOLO para colecciones públicas (ARCO/portal);
    // pero write/update/delete jamás deben ser 'if true'.
    expect(sinComentarios).not.toMatch(/allow[^;\n]*\b(write|update|delete)\b[^;\n]*: if true/)
    expect(sinComentarios).not.toMatch(/allow read, write: if true/)
  })
})
