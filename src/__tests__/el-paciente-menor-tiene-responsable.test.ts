/**
 * MP-014 · Panel de Lujo (M-pediatra) — el menor no tenía tutor en ningún
 * sitio: el expediente no guardaba quién es el responsable, y el consentimiento
 * de grabación no decía quién lo otorgó.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * `Patient` (src/types/index.ts) no tenía `tutor`, `responsable` ni
 * `representanteLegal`; `consentimientoGrabacion` sólo `fecha` y `medicoId`.
 * El único `responsable` del archivo era el del aviso de privacidad.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor M-pediatra, MP-014 (P2); el equipo rojo verificó las cuatro piezas.
 * Decisión PL-P1/PL-L3b: «campo de representante con parentesco» no espera.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 * El TIPO tiene el sitio (`responsable`, `consentimientoGrabacion.otorgadoPor`
 * y `representante`), como dato ADMINISTRATIVO que recepción captura; las
 * reglas no lo bloquean (no es campo clínico). La obligación «obligatorio si
 * menor» la aplica la pantalla de alta (EXPEDIENTES, handoff); la plantilla de
 * consentimiento (RECETA-DOCS) y el portal (PORTAL) van por handoff.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * Desde qué edad el adolescente y no el tutor (decisión del dueño, PL-P1).
 * La pantalla. El portal.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Patient } from '@/types'
import { CAMPOS_CLINICOS_PACIENTE } from '@/types'

describe('MP-014 · el expediente tiene dónde guardar al responsable de un menor', () => {
  it('un paciente menor con responsable y consentimiento por representante TIPA', () => {
    const p: Patient = {
      id: 'p1', nombre: 'Niño Sintético', telefono: '5500000000', fechaNacimiento: '2022-01-01',
      noShowCount: 0, cancelacionCount: 0, createdAt: '2026-01-01', updatedAt: '2026-01-01', creadoPor: 'u',
      responsable: { nombre: 'Madre Sintética', parentesco: 'madre', telefono: '5500000001', identificacion: 'INE folio sintético' },
      consentimientoGrabacion: {
        fecha: '2026-09-06T12:00:00.000Z', medicoId: 'u-medico',
        otorgadoPor: 'representante', representante: { nombre: 'Madre Sintética', parentesco: 'madre' },
      },
    }
    expect(p.responsable?.parentesco).toBe('madre')
    expect(p.consentimientoGrabacion?.otorgadoPor).toBe('representante')
  })

  it('`responsable` es administrativo: NO está en la lista de campos clínicos que bloquea la regla', () => {
    expect([...CAMPOS_CLINICOS_PACIENTE] as string[]).not.toContain('responsable')
    const reglas = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8')
    const fn = reglas.match(/function camposClinicosDelPaciente\(\)\s*\{\s*return \[([^\]]*)\]/)
    expect(fn![1]).not.toContain('responsable')
  })
})
