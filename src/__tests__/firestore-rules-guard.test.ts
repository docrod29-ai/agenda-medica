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

  /**
   * E0-09 — invariantes del episodio hospitalario que YA rigen hoy y no deben
   * aflojarse. Ojo con lo que este bloque NO afirma: no exige todavía
   * `signos update: if false`. Cerrar ese `update` REVIERTE una política escrita
   * a propósito en las reglas ("enfermería corrige en el sitio", auditoría
   * maestra 2026-07) y es la pregunta Q5 al médico dueño. Cuando la responda,
   * aquí se añade la aserción de aceptación de E0-09.
   */
  it('E0-09: el doc de internamiento NO se escribe desde el cliente (todo por el gateway)', () => {
    expect(sinComentarios).toMatch(
      /match \/internamientos\/\{intId\}\s*\{[\s\S]{0,200}allow create, update, delete: if false;/,
    )
  })

  it('E0-09: un registro de signos vitales NO se borra desde el cliente', () => {
    expect(sinComentarios).toMatch(/match \/signos\/\{signoId\}\s*\{[\s\S]{0,200}allow delete: if false;/)
  })

  it('E0-09: el libro append-only `registros` no es escribible por el cliente', () => {
    // Hoy no tiene bloque propio y cae en el catch-all (deny). Si algún día se
    // declara —para poder LEER el historial de correcciones—, la escritura debe
    // seguir siendo exclusiva del Admin SDK.
    const bloque = sinComentarios.match(/match \/registros\/\{[^}]*\}\s*\{([\s\S]*?)\n\s*\}/)
    if (bloque) expect(bloque[1]).toMatch(/allow create, update, delete: if false;/)
    else expect(sinComentarios).not.toContain('match /registros/')
  })

  /**
   * E0-06 — el PHI clínico del paciente vive en su propia subcolección porque
   * Firestore NO autoriza por campo: mientras `alergias` sea un campo de
   * `patients/{docId}` (que es `isMember`), recepción lo lee y ninguna regla lo
   * impide. Aquí se fija el bloque nuevo y, sobre todo, lo que NO debe cambiar.
   */
  it('E0-06: el resumen clínico del paciente solo lo lee personal médico', () => {
    expect(sinComentarios).toMatch(
      /match \/clinico\/\{clinicoId\}\s*\{\s*allow read: if isMedico\(clinicId\);/,
    )
  })

  it('E0-06: el resumen clínico no se borra desde el cliente', () => {
    expect(sinComentarios).toMatch(
      /match \/clinico\/\{clinicoId\}\s*\{[\s\S]{0,300}allow delete: if false;/,
    )
  })

  it('E0-06 REGRESIÓN: recepción SIGUE leyendo el directorio de pacientes', () => {
    // La aceptación pide «lee cita, no lee nota ni alergias». Cerrar el documento
    // administrativo del paciente rompería agendar (nombre y teléfono) y sería una
    // regresión peor que el hueco que se cierra.
    expect(sinComentarios).toMatch(/match \/patients\/\{docId\}\s*\{\s*allow read: if isMember\(clinicId\);/)
  })

  it('E0-06 REGRESIÓN: notas, laboratorios y fotos siguen bajo isMedico', () => {
    expect(sinComentarios).toMatch(/match \/notas\/\{notaId\}\s*\{\s*allow read: if isMedico\(clinicId\);/)
    expect(sinComentarios).toMatch(/match \/laboratorios\/\{labId\}\s*\{\s*allow read: if isMedico\(clinicId\);/)
    expect(sinComentarios).toMatch(/match \/fotos\/\{fotoId\}\s*\{\s*allow read, create, update, delete: if isMedico\(clinicId\);/)
  })

  it('NINGÚN write/update/delete es públicamente abierto (if true)', () => {
    // 'create: if true' está permitido SOLO para colecciones públicas (ARCO/portal);
    // pero write/update/delete jamás deben ser 'if true'.
    expect(sinComentarios).not.toMatch(/allow[^;\n]*\b(write|update|delete)\b[^;\n]*: if true/)
    expect(sinComentarios).not.toMatch(/allow read, write: if true/)
  })
})
