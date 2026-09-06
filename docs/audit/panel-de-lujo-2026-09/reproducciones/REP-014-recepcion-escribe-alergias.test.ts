/**
 * REP-014 · S-002 (S-ciberseguridad) — recepción lee y ESCRIBE las alergias
 * del paciente, de las que dependen la compuerta de la receta y el cruce de la
 * nota.
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 * `firestore.rules:172-174`: `patients/{docId}` tiene `allow read: if
 * isMember` y `allow update: if isMember`. `src/types/index.ts:371` declara que
 * `alergias` y `alergiasEstructuradas` TODAVÍA viven en ese documento
 * (`CAMPOS_CLINICOS_PACIENTE`) y que «mientras esta lista no esté vacía… la
 * aceptación de E0-06 NO se cumple». Un rol `secretaria` puede hacer
 * `updateDoc(patients/PID, {alergias:''})` y la receta siguiente imprime sin la
 * alergia.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor S-ciberseguridad, S-002; equipo rojo confirmado P1 en el emulador con
 * rol `secretaria`: get de patients/p1 (con alergias) → PERMITIDO; update
 * {alergias:''} → PERMITIDO. No existe ningún escritor de `clinico/resumen` en
 * producción. La matriz (`matriz-acceso.ts:120`) lo declara «PENDIENTE Fase B/C».
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * Firestore no autoriza por campo: mientras los campos clínicos sigan en el
 * documento-directorio, ninguna regla los protege. La migración a la
 * subcolección `clinico` (guarda isMedico) está diseñada y no ejecutada.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * security-tenant: autorización en el servidor, no en la pantalla; lista blanca
 * de campos. REG-323 sólo impide el borrado ACCIDENTAL desde la interfaz.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * CONTRATO TEXTUAL sobre `firestore.rules` + la matriz importada, declarado: el
 * emulador de Firestore no está disponible en esta configuración. La prueba
 * acepta cualquiera de las dos salidas que el propio repositorio diseñó: (1) la
 * lista `CAMPOS_CLINICOS_PACIENTE` vacía (migración terminada), o (2) mientras
 * dure la convivencia, la regla `update` de `patients` niega tocar esos campos
 * salvo a `isMedico` (`affectedKeys().hasAny(...)` o guarda isMedico).
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No ejecuta las reglas contra el emulador (eso es
 * `scripts/verificar-invariantes-de-datos.md` y la prueba de recuentos). No
 * resuelve `appointments.motivo` (residual aceptado D4). No decide D1 (¿la
 * asistente captura alergias en el alta?): es del dueño.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { CAMPOS_CLINICOS_PACIENTE } from '@/types'
import { MATRIZ_ACCESO } from '@/lib/authz/matriz-acceso'

const raiz = path.resolve(__dirname, '../../../..')
const rules = readFileSync(path.join(raiz, 'firestore.rules'), 'utf8')

/** El bloque `match /patients/{docId} {` hasta el primer `match` anidado. */
function bloquePatients(): string {
  const ini = rules.indexOf('match /patients/{docId} {')
  expect(ini, 'no encuentro el match de patients en firestore.rules').toBeGreaterThan(-1)
  const resto = rules.slice(ini + 'match /patients/{docId} {'.length)
  const fin = resto.search(/\n\s*match /)
  return fin === -1 ? resto : resto.slice(0, fin)
}

describe('REP-014 · un rol no clínico no puede escribir alergias', () => {
  const campos = [...CAMPOS_CLINICOS_PACIENTE]
  const migracionTerminada = campos.length === 0

  it('el update de patients/{id} no puede tocar los campos clínicos bajo isMember mientras sigan ahí', () => {
    if (migracionTerminada) return // salida (1): ya no hay nada que proteger en `patients`
    const bloque = bloquePatients()
    const update = bloque.match(/allow (?:[a-z, ]*update[a-z, ]*):[^;]*;/)?.[0] ?? ''
    expect(update, 'no hay regla de update para patients').not.toBe('')
    const protegido = /isMedico\(/.test(update) || /affectedKeys\(\)\s*\.hasAny\(/.test(update)
    expect(protegido, `alergias sigue en patients y la regla es: ${update.replace(/\s+/g, ' ')}`).toBe(true)
    if (/affectedKeys\(\)\s*\.hasAny\(/.test(update)) {
      for (const c of ['alergias', 'alergiasEstructuradas']) {
        expect(update, `la guarda de campos no nombra «${c}»`).toContain(`'${c}'`)
      }
    }
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
  })

  it('control: la subcolección `clinico` sí está cerrada a isMedico (el destino de la migración existe)', () => {
    expect(rules).toMatch(/match \/clinico\/\{clinicoId\} \{\s*allow read: if isMedico\(clinicId\);/)
  })
})
