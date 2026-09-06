/**
 * Panel de Lujo · SEGURIDAD — guardián ESTÁTICO de las reglas reparadas.
 *
 * Complementa a `emulator/panel-de-lujo-seguridad.emu.test.ts`, que EJECUTA
 * cada regla contra el emulador (y que no corre en el gate compartido porque
 * exige Java). Esto fija en texto que ninguna de las reglas vuelva atrás con
 * un cambio distraído — es lo que `firestore-rules-guard.test.ts` hace para
 * las reparaciones anteriores.
 *
 * Hallazgos: S-001 (arcoBloqueo/portalTokenVersion), S-007 (campos de
 * servidor de la cita), ASC-002 (anular cobro suelto), ASC-003 (cobroId con
 * cobro real), S-008 (reseñas), S-009 (membresías), ZL-015 (dueño protegido),
 * ZL-011 (invitación con caducidad), S-012 (notification_logs cerrado).
 *
 * QUÉ NO CUBRE: que la regla se comporte como dice (emulador); las listas de
 * campos de las formas congeladas (cada hallazgo y el emulador).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const crudo = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8')
const reglas = crudo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

function bloque(nombre: RegExp): string {
  const m = reglas.match(nombre)
  expect(m, `no se encontró ${nombre}`).not.toBeNull()
  return m![1]
}

describe('S-001 · el bloqueo ARCO y la revocación del portal no se deshacen desde el navegador', () => {
  const patients = bloque(/match \/patients\/\{docId\}\s*\{([\s\S]*?)\n\s*match \/notas/)
  it('arcoBloqueo congelado en update y prohibido en create', () => {
    expect(patients).toContain("request.resource.data.get('arcoBloqueo', null) == resource.data.get('arcoBloqueo', null)")
    expect(patients).toContain("!request.resource.data.keys().hasAny(['arcoBloqueo'])")
  })
  it('portalTokenVersion sólo sube, y sólo por el médico', () => {
    expect(patients).toMatch(/portalTokenVersion', 0\) == resource\.data\.get\('portalTokenVersion', 0\)\s*\|\|\s*\(isMedico\(clinicId\)\s*&&\s*request\.resource\.data\.get\('portalTokenVersion', 0\) > resource\.data\.get\('portalTokenVersion', 0\)\)/)
    expect(patients).toContain("request.resource.data.get('portalTokenVersion', 0) == 0")
  })
})

describe('S-007 · ASC-003 · la cita no se marca sobreagendada ni pagada desde el navegador', () => {
  const citas = bloque(/match \/appointments\/\{docId\}\s*\{([\s\S]*?)\n\s{6}\}/)
  it('los campos de servidor están enumerados y congelados en update y create', () => {
    for (const c of ['sobreagendada', 'sobreagendadaPor', 'telesaludUrl', 'googleCalendarEventId', 'googleCalendarSyncStatus']) {
      expect(reglas).toMatch(new RegExp(`function camposDeServidorDeLaCita\\(\\)[\\s\\S]*?'${c}'`))
    }
    expect(citas).toContain('camposDeServidorIntactos()')
    expect(citas).toContain('!request.resource.data.keys().hasAny(camposDeServidorDeLaCita())')
  })
  it('cobroId exige un cobro real DESPUÉS de la escritura, de esta cita y no anulado; limpiarlo exige la anulación', () => {
    expect(citas).toContain('citaCoherenteConSuCobro()')
    // La ruta se escribe entera. `[^)]*` NO servía: no puede cruzar el paréntesis
    // de `$(database)` ni el de `$(clinicId)`, así que la regla podía estar bien
    // escrita y el guardián no la veía nunca.
    const cobro = (id: string) => `/databases/$(database)/documents/clinics/$(clinicId)/cobros/$(${id})`
    expect(citas).toContain(`existsAfter(${cobro('despues')})`)
    expect(citas).toContain(`getAfter(${cobro('despues')}).data.get('citaId', '') == docId`)
    expect(citas).toContain(`getAfter(${cobro('despues')}).data.get('cancelado', false) == false`)
    expect(citas).toMatch(new RegExp(`despues == '' && antes != ''[\\s\\S]*?${
      `getAfter(${cobro('antes')}).data.get('cancelado', false) == true`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
    expect(citas).toContain("request.resource.data.get('cobroId', '') == ''")
  })
})

describe('ASC-002 · anular un cobro suelto no revienta por un campo ausente', () => {
  const cobros = bloque(/match \/cobros\/\{cobroId\}\s*\{([\s\S]*?)\n\s{6}\}/)
  it('citaId y patientId se comparan con get(campo, "")', () => {
    expect(cobros).toContain("request.resource.data.get('citaId', '') == resource.data.get('citaId', '')")
    expect(cobros).toContain("request.resource.data.get('patientId', '') == resource.data.get('patientId', '')")
    expect(cobros).not.toContain('request.resource.data.citaId == resource.data.citaId')
  })
})

describe('S-008 · la reseña del paciente no se reescribe ni se borra', () => {
  const reviews = bloque(/match \/reviews\/\{reviewId\}\s*\{([\s\S]*?)\n\s{6}\}/)
  it('el update sólo toca la moderación y delete está cerrado', () => {
    expect(reviews).toMatch(/affectedKeys\(\)\s*\.hasOnly\(\['estado', 'publicadaEn', 'moderadoPor', 'moderadoEn'\]\)/)
    expect(reviews).toContain('allow delete: if false;')
    expect(reviews).not.toMatch(/allow update, delete: if isMember\(clinicId\);/)
  })
})

describe('S-009 · membresías y planes con forma, autor y sin borrado', () => {
  const memb = bloque(/match \/memberships\/\{membershipId\}\s*\{([\s\S]*?)\n\s{6}\}/)
  const planes = bloque(/match \/membership_plans\/\{planId\}\s*\{([\s\S]*?)\n\s{6}\}/)
  it('la membresía nace con creadoPor == uid y sólo cambian estado y ciclo de cobro', () => {
    expect(memb).toContain('request.resource.data.creadoPor == request.auth.uid')
    expect(memb).toMatch(/hasOnly\(\['estado', 'proximoCobro', 'ultimoCobroEn'\]\)/)
    expect(memb).toContain('allow delete: if false;')
  })
  it('el plan lleva precio numérico ≥ 0 y no se borra', () => {
    expect(planes).toContain('request.resource.data.precio is number')
    expect(planes).toContain('request.resource.data.precio >= 0')
    expect(planes).toContain('allow delete: if false;')
  })
})

describe('ZL-015 · ZL-011 · equipo: el dueño no se borra ni se degrada; la invitación caduca', () => {
  it('clinic_members: update sólo role, ownerId protegido; delete nunca al dueño', () => {
    const cm = bloque(/match \/clinic_members\/\{uid\}\s*\{([\s\S]*?)\n\s{4}\}/)
    expect(cm).toContain('function esDuenoDelConsultorio(clinicId, uid)')
    expect(cm).toMatch(/affectedKeys\(\)\.hasOnly\(\['role'\]\)/)
    expect(cm).toContain("(!esDuenoDelConsultorio(resource.data.clinicId, uid) || request.resource.data.role == 'admin')")
    expect(cm).toMatch(/allow delete: if isAdmin\(resource\.data\.clinicId\)\s*&&\s*request\.auth\.uid != uid\s*&&\s*!esDuenoDelConsultorio\(resource\.data\.clinicId, uid\)/)
  })
  it('clinic_invitations: autor == uid, sin usar, caducidad numérica ≤ 8 días', () => {
    const inv = bloque(/match \/clinic_invitations\/\{code\}\s*\{([\s\S]*?)\n\s{4}\}/)
    expect(inv).toContain('request.resource.data.creadoPor == request.auth.uid')
    expect(inv).toContain('request.resource.data.used == false')
    expect(inv).toContain('request.resource.data.expiresAtMs > request.time.toMillis()')
    expect(inv).toContain('request.resource.data.expiresAtMs <= request.time.toMillis() + 8 * 86400000')
  })
})

describe('S-012 · notification_logs ya no se fabrica desde el navegador', () => {
  it('create, update y delete cerrados', () => {
    const nl = bloque(/match \/notification_logs\/\{docId\}\s*\{([\s\S]*?)\n\s{6}\}/)
    expect(nl).toContain('allow create, update, delete: if false;')
  })
})
