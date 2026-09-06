/**
 * S-002 · Panel de Lujo (S-ciberseguridad, REP-014) — recepción leía y ESCRIBÍA
 * las alergias del paciente, de las que dependen la compuerta de la receta y el
 * cruce de la nota.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * `firestore.rules`: `patients/{docId}` tenía `allow update: if isMember`.
 * `src/types/index.ts` declara que `alergias` y `alergiasEstructuradas`
 * TODAVÍA viven en ese documento (`CAMPOS_CLINICOS_PACIENTE`) y que «mientras
 * esta lista no esté vacía… la aceptación de E0-06 NO se cumple». Un rol
 * `secretaria` podía hacer `updateDoc(patients/PID, {alergias:''})` y la
 * receta siguiente imprimía sin la alergia.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor S-ciberseguridad, S-002; equipo rojo confirmado P1 en el emulador
 * con rol `secretaria`: get de patients/p1 (con alergias) → PERMITIDO; update
 * {alergias:''} → PERMITIDO. No existe ningún escritor de `clinico/resumen` en
 * producción. La matriz lo declaraba «PENDIENTE Fase B/C».
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * Firestore no autoriza por campo en LECTURA, pero sí en ESCRITURA, y nadie
 * había cerrado la mitad que sí se puede cerrar hoy. La migración a la
 * subcolección `clinico` (guarda isMedico) está diseñada y no ejecutada.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 * `firestore.rules` repite la lista en `camposClinicosDelPaciente()` y el
 * update/create de `patients` sólo deja tocarla a `isMedico`
 * (`diff().affectedKeys().hasAny(...)`). Decisión PL-S1 por omisión: «cerrar la
 * escritura por rol mientras se migra la lectura». security-tenant: la regla es
 * el borde; REG-323 sólo impedía el borrado ACCIDENTAL desde la interfaz.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * CONTRATO TEXTUAL sobre `firestore.rules` + la matriz importada. Las dos
 * listas (tipo y regla) se comparan campo por campo: cambiar una sin la otra se
 * pone rojo. La EJECUCIÓN contra el emulador (secretaria denegada, médico
 * permitido, teléfono permitido a recepción) vive en
 * `emulator/panel-de-lujo-seguridad.emu.test.ts`.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * La LECTURA por rol no clínico (Fase B/C: cambio de modelo de datos, pendiente
 * de que el dueño diga cuándo). No resuelve `appointments.motivo` (residual
 * aceptado D4). No decide D1 (¿la asistente captura alergias en el alta?).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { CAMPOS_CLINICOS_PACIENTE } from '@/types'
import { MATRIZ_ACCESO } from '@/lib/authz/matriz-acceso'

const rules = readFileSync(path.join(process.cwd(), 'firestore.rules'), 'utf8')
const sinComentarios = rules.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

/** El bloque `match /patients/{docId} {` hasta el primer `match` anidado. */
function bloquePatients(): string {
  const ini = sinComentarios.indexOf('match /patients/{docId} {')
  expect(ini, 'no encuentro el match de patients en firestore.rules').toBeGreaterThan(-1)
  const resto = sinComentarios.slice(ini + 'match /patients/{docId} {'.length)
  const fin = resto.search(/\n\s*match /)
  return fin === -1 ? resto : resto.slice(0, fin)
}

describe('S-002 · un rol no clínico no puede escribir alergias', () => {
  const campos = [...CAMPOS_CLINICOS_PACIENTE]
  const migracionTerminada = campos.length === 0

  it('la regla repite EXACTAMENTE la lista del tipo (una sola fuente, dos sitios que se comparan)', () => {
    if (migracionTerminada) return
    const fn = sinComentarios.match(/function camposClinicosDelPaciente\(\)\s*\{\s*return \[([^\]]*)\]/)
    expect(fn, 'falta camposClinicosDelPaciente() en firestore.rules').not.toBeNull()
    const enReglas = [...fn![1].matchAll(/'([^']+)'/g)].map(m => m[1]).sort()
    expect(enReglas).toEqual([...campos].sort())
  })

  it('el update de patients/{id} no puede tocar los campos clínicos bajo isMember mientras sigan ahí', () => {
    if (migracionTerminada) return
    const bloque = bloquePatients()
    const update = bloque.match(/allow (?:[a-z, ]*update[a-z, ]*):[^;]*;/)?.[0] ?? ''
    expect(update, 'no hay regla de update para patients').not.toBe('')
    expect(update).toMatch(/isMedico\(clinicId\)\s*\|\|\s*!request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\.hasAny\(camposClinicosDelPaciente\(\)\)/)
  })

  it('y tampoco al CREAR: recepción no le pone alergias al paciente al darlo de alta', () => {
    if (migracionTerminada) return
    const bloque = bloquePatients()
    const create = bloque.match(/allow create:[^;]*;/)?.[0] ?? ''
    expect(create).toMatch(/isMedico\(clinicId\)\s*\|\|\s*!request\.resource\.data\.keys\(\)\.hasAny\(camposClinicosDelPaciente\(\)\)/)
  })

  it('la matriz no puede declarar `patients` administrativo y escribible por isMember con alergias dentro', () => {
    if (migracionTerminada) return
    const patients = MATRIZ_ACCESO.find(r => r.ruta === 'clinics/{clinicId}/patients/{docId}')
    expect(patients).toBeDefined()
    const escribeCualquierMiembro = patients!.guardaEscritura === 'isMember'
    expect(
      escribeCualquierMiembro,
      `CAMPOS_CLINICOS_PACIENTE=${JSON.stringify(campos)} y patients es guardaEscritura=${patients!.guardaEscritura}`,
    ).toBe(false)
    // Y dice la verdad completa: recepción sigue editando el directorio.
    expect(patients!.porQue).toMatch(/recepci[oó]n .*edita/i)
  })

  it('control: la subcolección `clinico` sí está cerrada a isMedico (el destino de la migración existe)', () => {
    expect(sinComentarios).toMatch(/match \/clinico\/\{clinicoId\} \{\s*allow read: if isMedico\(clinicId\);/)
  })

  it('al revés: una regla que abriera el update a isMember a secas se detecta', () => {
    const rota = bloquePatients().replace(/allow update:[^;]*;/, 'allow update: if isMember(clinicId);')
    const update = rota.match(/allow update:[^;]*;/)?.[0] ?? ''
    expect(/affectedKeys\(\)\.hasAny\(camposClinicosDelPaciente\(\)\)/.test(update)).toBe(false)
  })
})
