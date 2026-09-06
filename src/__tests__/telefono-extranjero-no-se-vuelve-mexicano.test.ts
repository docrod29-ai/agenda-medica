/**
 * UN PAÍS EXPLÍCITO NO SE CONVIERTE EN MÉXICO — Panel de Lujo ASM-002 (REP-034).
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * `normalizarTelefonoWa` unificaba las dos formas del mismo número mexicano
 * (`521…` y `52…`) con la regla «si no empieza por 52, le falta la lada».
 * «+1 619 555 1234» → 16195551234 → 5216195551234 (13 dígitos, tercer dígito
 * «1») → 526195551234: un número mexicano de OTRA persona, al que salía el
 * recordatorio con nombre, médico, fecha y consultorio — y el envío se
 * reportaba «ok». «+34 600 000 000» → 5234600000000. Esta función es la clave
 * de opt-out, ventana de 24 h, sesión del bot y destino de todo envío, y no
 * había validación de país en ningún punto posterior.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor AS-mensajeria, hallazgo ASM-002; el equipo rojo repitió la ejecución
 * en node, buscó la capa que validara el país antes de enviar y no existe.
 * `whatsapp-telefono.test.ts` sólo cubría números mexicanos.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * La función trataba «no empieza por 52» como «le falta la lada» en vez de
 * como «no es mexicano»: normalizaba lo que no entendía.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * Sólo se normaliza lo que se entiende. Un «+» declara el país y se respeta;
 * 10 dígitos son México; `52`/`521` + 10 convergen. Todo lo demás devuelve
 * vacío (`analizarTelefonoWa` dice por qué) y vacío no se manda a nadie.
 * data-privacy / security-tenant: PHI a un tercero es fuga atribuible al
 * consultorio. clinical-safety §6 en clave de mensajería: se rechaza, no se
 * adivina.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No cubre el rechazo del proveedor ni la captura en la pantalla de pacientes
 * (ASM-001, en `handoff-AGENDA-MENSAJERIA.md`). Los números sin «+» de
 * longitud extraña («12345», «55A5010101») se rechazan por el valor seguro del
 * briefing —bloquear en vez de permitir—, no por decisión del dueño; está
 * registrado en `decisiones-AGENDA-MENSAJERIA.md`.
 */
import { describe, it, expect } from 'vitest'
import {
  normalizarTelefonoWa, analizarTelefonoWa, normalizarWaId, claveTelefonoWa,
  telefonoValidoParaWa, formatoLegibleWa,
} from '@/lib/whatsapp/telefono'

function salidaSegura(raw: string, mexicanoFabricado: string, e164: string): void {
  const r = normalizarTelefonoWa(raw)
  if (r === '') return                                     // rechazar con vacío es una salida válida
  expect(r, `«${raw}» se convirtió en el número mexicano ${r}`).not.toBe(mexicanoFabricado)
  expect(r.startsWith('52'), `«${raw}» no es mexicano y salió como ${r}`).toBe(false)
  expect(r).toBe(e164)
}

describe('ASM-002 · un país explícito no se convierte en México', () => {
  it('control: los mexicanos siguen normalizando a 52 + 10 dígitos', () => {
    expect(normalizarTelefonoWa('55 5010 1010')).toBe('525550101010')
    expect(normalizarTelefonoWa('5215550101010')).toBe('525550101010')
    expect(normalizarTelefonoWa('+52 55 5010 1010')).toBe('525550101010')
    expect(normalizarTelefonoWa('+52 1 55 5010 1010')).toBe('525550101010')
    expect(normalizarTelefonoWa('525550101010')).toBe('525550101010')
  })

  it('«+1 619 555 1234» (EE.UU.) no puede salir como 526195551234', () => {
    salidaSegura('+1 619 555 1234', '526195551234', '16195551234')
    expect(normalizarTelefonoWa('+1 619 555 1234')).toBe('16195551234')
  })

  it('«+34 600 000 000» (España) no puede salir como 5234600000000', () => {
    salidaSegura('+34 600 000 000', '5234600000000', '34600000000')
    expect(normalizarTelefonoWa('+34 600 000 000')).toBe('34600000000')
  })

  it('«00» también declara el país (marcación internacional desde fijo)', () => {
    expect(normalizarTelefonoWa('0034600000000')).toBe('34600000000')
  })

  it('lo que no se entiende se rechaza con motivo, no se adivina', () => {
    for (const raw of ['12345', '55A5010101', '5551234', '16195551234']) {
      const r = analizarTelefonoWa(raw)
      expect(r.ok, `«${raw}» debía rechazarse`).toBe(false)
      if (!r.ok) expect(r.mensaje.length).toBeGreaterThan(10)
      expect(normalizarTelefonoWa(raw)).toBe('')
      expect(telefonoValidoParaWa(raw)).toBe(false)
    }
    expect(analizarTelefonoWa('')).toMatchObject({ ok: false, motivo: 'vacio' })
    expect(analizarTelefonoWa('+52 55 5010')).toMatchObject({ ok: false, motivo: 'mexicano-incompleto' })
  })

  it('el wa_id del proveedor se lee como internacional: un remitente de EE.UU. no se vuelve mexicano', () => {
    expect(normalizarWaId('5215550101010')).toBe('525550101010')
    expect(normalizarWaId('16195551234')).toBe('16195551234')
    expect(normalizarWaId('12345')).toBe('')
  })

  it('la clave de contacto acepta el wa_id y nunca fabrica un 52', () => {
    expect(claveTelefonoWa('5550101010')).toBe('525550101010')
    expect(claveTelefonoWa('16195551234')).toBe('16195551234')
    expect(claveTelefonoWa('+1 619 555 1234')).toBe('16195551234')
    expect(claveTelefonoWa('12345')).toBe('')
  })

  it('enseña el número como lo verá WhatsApp antes de guardarlo', () => {
    expect(formatoLegibleWa('5550101010')).toBe('+52 55 5010 1010')
    expect(formatoLegibleWa('+1 619 555 1234')).toBe('+1 619 555 1234')
    expect(formatoLegibleWa('+34 600 000 000')).toBe('+34600000000')
    expect(formatoLegibleWa('12345')).toBe('')
  })
})
