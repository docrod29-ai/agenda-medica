/**
 * REP-059 · PG-005 (P-gineco) — el aviso de privacidad publicado dice que
 * Meta/WhatsApp «no trata datos de salud» mientras el portal manda por WhatsApp
 * del consultorio el nombre de la paciente y su pregunta íntegra.
 *
 * NEEDS_LEGAL_REVIEW — la redacción final del aviso y la calificación jurídica
 * de cada subencargado las decide un abogado; esta prueba sólo exige que la
 * declaración y el flujo real digan lo mismo.
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 * `src/lib/legal/subencargados.ts:147-150`:
 *   // Los mensajes llevan fecha, hora y nombre; el contenido clínico no viaja
 *   // por aquí — es una decisión de diseño que las pruebas del portal fijan.
 *   tocaDatosDeSalud: false,
 * contra `src/lib/paciente/pregunta-del-paciente.ts:466-483`
 * (`avisoDePreguntaAlConsultorio`, D-034: «la pregunta viaja COMPLETA … con el
 * nombre del paciente») y `portal/route.ts:930-934` que lo envía. `listaEnTexto()`
 * (:200) imprime « No trata datos de salud.» y lo consume
 * `src/lib/aviso-privacidad.ts:38`, que es lo que publica /privacidad/[clinicId].
 * 360dialog (:133-141), por el que pasan esos mismos mensajes, también dice
 * `false`.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Recorrido de la paciente P-gineco en /privacidad/consultorio-demo-v10 («Meta /
 * WhatsApp (Estados Unidos) — … No trata datos de salud.») y equipo rojo
 * confirmado P1 verificando la cadena entera: decisión (D-034, ACCEPTED
 * 5-sep-2026, docs/product/DECISION_REGISTER.md:39) → emisor → ruta → documento.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * D-034 cambió el flujo y el aviso no se actualizó. El comentario del archivo
 * afirma lo contrario de lo que el código hace desde el 5-sep.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * data-privacy / security-tenant (PHI: un enlace de paciente acaba en sitios
 * que nadie controla; el aviso integral es lo que un regulador lee primero).
 * LFPDPPP art. 15-16: el aviso describe el tratamiento real.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * CRUCE declarado: COMPORTAMIENTO del emisor real (`avisoDePreguntaAlConsultorio`
 * incluye el texto libre) contra el CONTRATO de la lista de subencargados y del
 * texto que genera `generarAvisoPrivacidad`. Es la prueba que el hallazgo pide.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No cubre Twilio (SMS de respaldo), que hereda la misma pregunta y el hallazgo
 * deja fuera. No cubre `avisoDeUrgenciaAlConsultorio` (urgencia.ts) —misma
 * cadena, mismo arreglo—. No discute D-034: sólo que el aviso la diga.
 */
import { describe, it, expect } from 'vitest'
import { avisoDePreguntaAlConsultorio } from '@/lib/paciente/pregunta-del-paciente'
import { SUBENCARGADOS, listaEnTexto } from '@/lib/legal/subencargados'
import { generarAvisoPrivacidad } from '@/lib/aviso-privacidad'

const TEXTO_PACIENTE = 'tengo sangrado desde ayer y me duele, ¿es normal con la pastilla?'
const meta = SUBENCARGADOS.find(s => /meta|whatsapp/i.test(s.nombre))!
const dialog = SUBENCARGADOS.find(s => /360dialog/i.test(s.nombre))!

describe('REP-059 · lo que se declara de WhatsApp coincide con lo que se manda por WhatsApp', () => {
  it('premisa (pasa hoy): el aviso al consultorio lleva el nombre y el texto libre de la paciente', () => {
    const msg = avisoDePreguntaAlConsultorio('Paciente Sintética', 'no_esta_en_el_plan_liberado', TEXTO_PACIENTE)
    expect(msg).toContain('Paciente Sintética')
    expect(msg).toContain('tengo sangrado')
  })

  it('Meta / WhatsApp declara tocaDatosDeSalud: true (hoy: false, con un comentario que ya no es verdad)', () => {
    expect(meta.tocaDatosDeSalud, `${meta.nombre}: ${meta.uso}`).toBe(true)
  })

  it('360dialog, por el que pasan esos mismos mensajes, también (hoy: false)', () => {
    expect(dialog.tocaDatosDeSalud).toBe(true)
  })

  it('la lista en texto no dice «No trata datos de salud» junto a Meta / WhatsApp', () => {
    const renglon = listaEnTexto().split('\n').find(l => l.includes(meta.nombre)) ?? ''
    expect(renglon).not.toMatch(/No trata datos de salud/)
  })

  it('el aviso de privacidad publicado (generarAvisoPrivacidad) tampoco lo afirma', () => {
    const aviso = generarAvisoPrivacidad(null)
    const renglon = aviso.split('\n').find(l => l.includes(meta.nombre)) ?? ''
    expect(renglon, 'el regulador lee esto primero').not.toMatch(/No trata datos de salud/)
  })

  it('control: un subencargado que de verdad no ve salud (Stripe) sigue declarando false', () => {
    expect(SUBENCARGADOS.find(s => s.nombre === 'Stripe')?.tocaDatosDeSalud).toBe(false)
  })
})
