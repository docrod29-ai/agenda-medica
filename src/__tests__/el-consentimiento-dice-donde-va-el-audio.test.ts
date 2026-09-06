/**
 * EL CONSENTIMIENTO DE GRABACIÓN DICE LO QUE EL PIPELINE HACE.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * El modal decía que el audio «se conserva temporalmente en este dispositivo por
 * si la transcripción falla». Las dos mitades de esa frase eran imprecisas:
 *
 *   · el LUGAR — `guardarAudioDeLaConsulta` (src/hooks/useGrabacionAudio.ts)
 *     sube el audio a Firebase Storage (`consultas-audio/<uid>/…`) por los dos
 *     caminos, y ahí vive hasta que el barrido lo borra (`HORAS_DE_VIDA`, 24 h);
 *   · el MOTIVO — no es «por si falla»: se conserva A PROPÓSITO para poder
 *     reproducir de dónde salió cada frase de la nota (REG-249), y eso lo
 *     autorizó el dueño.
 *
 * Lo que el texto ya decía bien y NO se tocó: que el audio se envía a un
 * servicio de transcripción, y que el expediente guarda únicamente la
 * transcripción de texto (`audioPath` vive en estado de React y no se escribe en
 * Firestore). REG-032 no ha reaparecido: lo que aquélla cerró era la frase «el
 * audio no se guarda».
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Panel de Lujo 2026-09. Cuatro auditores sobre el mismo párrafo: PG-003
 * (gineco), PI-003 (paciente), PO-016 (ortopedia) — P2 confirmados — y, sobre el
 * mismo modal, PP-009 (quién consiente por un menor), PC-012 y PI-008
 * (constancia de qué texto se leyó).
 *
 * ── CAUSA RAÍZ ──────────────────────────────────────────────────────────────
 *
 * El texto vivía dentro del JSX de una pantalla de 7 000 líneas y el plazo era
 * una cifra copiada a mano. Nada podía comparar lo que la pantalla AFIRMA con lo
 * que el código HACE: es «el dato tiene que llegar» aplicado a una promesa.
 *
 * ── REGLA ───────────────────────────────────────────────────────────────────
 *
 * `data-privacy.md` (la voz es biométrica: el paciente tiene que saber a dónde
 * va) y seguridad clínica §3 (nada pasa en silencio). El plazo se LEE de
 * `audio-caduco.ts` para que no puedan divergir.
 *
 * ── TIPO DE PRUEBA ──────────────────────────────────────────────────────────
 *
 * CONTRATO entre dos módulos: si el hook sube audio a Storage, el texto debe
 * nombrar la nube y el plazo real. Probada al revés: se comprueba que el hook
 * efectivamente sube (si dejara de hacerlo, esta prueba habría que reescribirla,
 * no forzarla) y que el texto no vuelve a decir «en este dispositivo».
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * No cubre la retención en IndexedDB del propio dispositivo ni el audio de
 * teleconsulta. No cubre que el consentimiento quede GUARDADO con su versión:
 * eso necesita un campo en `Patient.consentimientoGrabacion` y su regla de
 * Firestore, que son de otra rebanada (handoff PC-012 · PI-008). La redacción
 * legal del consentimiento por representante es NEEDS_LEGAL_REVIEW (PP-009).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { HORAS_DE_VIDA } from '@/lib/expediente/audio-caduco'
import {
  textoDelConsentimiento, puntosDelConsentimiento, VERSION_DEL_CONSENTIMIENTO,
} from '../app/(dashboard)/consulta/[patientId]/consentimiento-de-grabacion'

const raiz = process.cwd()
const hook = readFileSync(join(raiz, 'src/hooks/useGrabacionAudio.ts'), 'utf8')
const pantalla = readFileSync(join(raiz, 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8')

describe('el texto del consentimiento y el pipeline dicen lo mismo', () => {
  it('control: el hook SÍ sube el audio a Storage (si dejara de hacerlo, hay que reescribir esto)', () => {
    expect(hook).toMatch(/uploadBytes\(/)
    expect(hook).toContain('consultas-audio/')
  })

  it('el texto nombra la nube y el plazo real, leído del módulo que lo aplica', () => {
    const t = textoDelConsentimiento(false)
    expect(t).toMatch(/nube/)
    expect(t).toContain(String(HORAS_DE_VIDA))
    expect(t).not.toMatch(/en este dispositivo/)
  })

  it('dice para qué se conserva: comprobar de dónde salió cada frase (REG-249)', () => {
    expect(textoDelConsentimiento(false)).toMatch(/de dónde salió cada frase/)
  })

  it('conserva lo que ya era cierto: el envío al transcriptor y que el expediente sólo guarda texto', () => {
    const t = textoDelConsentimiento(false)
    expect(t).toMatch(/servicio de transcripción/)
    expect(t).toMatch(/únicamente la transcripción de texto/)
  })

  it('en pediatría el consentimiento se le pide a quien puede darlo (PP-009)', () => {
    expect(textoDelConsentimiento(true)).toMatch(/padre, la madre o el tutor/)
    expect(puntosDelConsentimiento(true)[0]).toMatch(/tutor/)
    expect(puntosDelConsentimiento(false)[0]).not.toMatch(/tutor/)
  })

  it('el texto lleva versión, para poder volver a pedirlo cuando cambie (PC-012 · PI-008)', () => {
    expect(VERSION_DEL_CONSENTIMIENTO).toBeGreaterThan(1)
  })

  it('la pantalla usa ese texto y no una copia suelta', () => {
    expect(pantalla).toMatch(/textoDelConsentimiento\(esPediatrico\)/)
    expect(pantalla).not.toMatch(/se conserva temporalmente en este dispositivo/)
  })
})
