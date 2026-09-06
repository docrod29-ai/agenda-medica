/**
 * REP-034 · ASM-002 (AS-mensajeria) — un teléfono con código de país explícito
 * («+1 619 555 1234», «+34 600 000 000») se convierte en silencio en un número
 * mexicano: el recordatorio con nombre, médico, fecha y consultorio sale a un
 * abonado que no es el paciente, y el envío se reporta «ok».
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 * `src/lib/whatsapp/telefono.ts:19-23`:
 *   `if (!d.startsWith('52')) d = `52${d}``
 *   `if (d.length === 13 && d[2] === '1') d = `52${d.slice(3)}``
 * «+1 619 555 1234» → 16195551234 → 5216195551234 (13, tercer dígito «1») →
 * 526195551234. «+34 600 000 000» → 5234600000000. Esta función es la clave de
 * opt-out, ventana de 24 h, sesión del bot y destinatario de todo envío
 * (`whatsapp-send.ts:50-52`, `normalisePhone`), y no hay validación de país ni
 * de longitud en ningún punto posterior.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor AS-mensajeria, hallazgo ASM-002 (`crudos/AS-mensajeria.json`),
 * ejecutando la lógica en node. El equipo rojo (`crudos/R-AS-mensajeria.json`)
 * repitió la ejecución (salida literal en su veredicto), buscó la capa que
 * validara el país antes de enviar y no existe; matizó que 619 no es LADA
 * mexicana (ese caso concreto acaba en rechazo del proveedor) y que la mutación
 * silenciosa y la ausencia de validación quedan confirmadas.
 * `whatsapp-telefono.test.ts` sólo cubre números mexicanos.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * La función nació para unificar DOS formas del mismo número mexicano (`521…` y
 * `52…`) y trata cualquier cosa que no empiece por 52 como «le falta la lada»,
 * en vez de como «no es mexicano».
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * data-privacy / security-tenant: PHI a un tercero es fuga atribuible al
 * consultorio. clinical-safety §6 en clave de mensajería: ante la duda se
 * rechaza, no se adivina.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * COMPORTAMIENTO, función pura real. Se acepta cualquiera de las dos salidas
 * seguras que propone el hallazgo: respetar el país (E.164 sin «+») o rechazar
 * (cadena vacía / lanzar). Lo que NO se acepta es un número mexicano fabricado.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No cubre la captura en E.164 desde el formulario (ASM-001) ni el rechazo del
 * proveedor. No cubre números sin «+» de longitud extraña («12345»), que
 * también se mutilan pero cuya salida correcta es una decisión del dueño.
 */
import { describe, it, expect } from 'vitest'
import { normalizarTelefonoWa } from '@/lib/whatsapp/telefono'

function salidaSegura(raw: string, mexicanoFabricado: string, e164: string): void {
  let r: string
  try { r = normalizarTelefonoWa(raw) } catch { return }   // rechazar lanzando es una salida válida
  if (r === '') return                                     // rechazar con vacío también
  expect(r, `«${raw}» se convirtió en el número mexicano ${r}`).not.toBe(mexicanoFabricado)
  expect(r.startsWith('52'), `«${raw}» no es mexicano y salió como ${r}`).toBe(false)
  expect(r).toBe(e164)
}

describe('REP-034 · un país explícito no se convierte en México', () => {
  it('control: los mexicanos siguen normalizando a 52 + 10 dígitos', () => {
    expect(normalizarTelefonoWa('55 5010 1010')).toBe('525550101010')
    expect(normalizarTelefonoWa('5215550101010')).toBe('525550101010')
    expect(normalizarTelefonoWa('+52 55 5010 1010')).toBe('525550101010')
  })

  it('HOY FALLA: «+1 619 555 1234» (EE.UU.) no puede salir como 526195551234', () => {
    salidaSegura('+1 619 555 1234', '526195551234', '16195551234')
  })

  it('HOY FALLA: «+34 600 000 000» (España) no puede salir como 5234600000000', () => {
    salidaSegura('+34 600 000 000', '5234600000000', '34600000000')
  })
})
