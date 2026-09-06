/**
 * «PROGRAMADO PARA CIRUGÍA» + ANTICOAGULANTE: EL CRUCE QUE NADIE HACÍA.
 *
 * ── QUÉ FALTABA ─────────────────────────────────────────────────────────────
 *
 * Nada avisaba cuando una nota decía que hay cirugía por delante y la lista de
 * fármacos del paciente traía un anticoagulante o un antiagregante. La
 * valoración preoperatoria sí sabe qué hacer —los intervalos viven en
 * `src/lib/expediente/preop.ts` con su fuente— pero sólo se enteraba si el
 * médico marcaba la casilla `tomaAnticoagulante` a mano.
 *
 * Fuera de ese tipo de nota no había vigilancia de ninguna clase: en
 * `avisos-consulta.ts` «warfarina» aparece sólo en comentarios de otros avisos,
 * y en `src/lib/seguridad/` no hay nada quirúrgico.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Panel de Lujo 2026-09, auditor M-cirujano, hallazgo MC-015 (mejora, P2,
 * confirmado por el equipo rojo con el grep de `avisos-consulta.ts`).
 *
 * ── CAUSA RAÍZ ──────────────────────────────────────────────────────────────
 *
 * El sistema tenía los DOS datos en la misma pantalla —la lista vigente y el
 * texto de la nota— y no los cruzaba. «Escrito y sin conectar», en su versión
 * más cara: dos hechos que sólo significan algo juntos.
 *
 * ── REGLA ───────────────────────────────────────────────────────────────────
 *
 * clinical-safety §1: aquí NO se propone ninguna conducta ni ningún intervalo —
 * eso lo dice el motor de la valoración, con su fuente citada. Y §5: las listas
 * son VOCABULARIO; lo que no está en ellas no se vigila, y se dice.
 *
 * ── TIPO DE PRUEBA ──────────────────────────────────────────────────────────
 *
 * UNITARIA sobre el módulo puro. Probada al revés en tres direcciones: sin
 * cirugía no avisa, sin fármaco no avisa, y el texto del aviso NO puede contener
 * un número de días (que sería inventar una cifra clínica).
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * No cubre el ayuno preoperatorio (no existe motor ni texto: mejora aparte, con
 * cifras NEEDS_CLINICAL_REVIEW). No cubre fármacos fuera del vocabulario
 * declarado — ausencia en la lista NO es seguridad. No decide la conducta
 * (suspender, puente): la propone el motor y la firma el médico.
 */
import { describe, it, expect } from 'vitest'
import {
  avisoDeCirugiaYAnticoagulante, detectarAnticoagulacion, mencionaCirugiaProgramada,
  prellenadoPreoperatorio,
} from '../app/(dashboard)/consulta/[patientId]/anticoagulantes-y-cirugia'

const NOTA_CON_CIRUGIA = 'Paciente programado para cirugía de hernia inguinal la próxima semana.'

describe('el aviso salta cuando los dos hechos coinciden', () => {
  it('warfarina + cirugía programada ⇒ avisa y nombra el fármaco', () => {
    const a = avisoDeCirugiaYAnticoagulante([{ nombre: 'Warfarina 5 mg' }], NOTA_CON_CIRUGIA)
    expect(a).toBeTruthy()
    expect(a).toContain('Warfarina 5 mg')
    expect(a).toMatch(/valoración preoperatoria/i)
  })

  it('un DOAC se reconoce por nombre comercial y por genérico', () => {
    expect(detectarAnticoagulacion([{ nombre: 'Eliquis' }]).tipo).toBe('DOAC')
    expect(detectarAnticoagulacion([{ nombre: 'apixabán 5 mg' }]).tipo).toBe('DOAC')
    expect(detectarAnticoagulacion([{ nombre: 'Acenocumarol' }]).tipo).toBe('warfarina')
  })

  it('la aspirina y el clopidogrel también encienden la luz', () => {
    expect(avisoDeCirugiaYAnticoagulante([{ nombre: 'Aspirina 100 mg' }], NOTA_CON_CIRUGIA)).toBeTruthy()
    expect(avisoDeCirugiaYAnticoagulante([{ nombre: 'Clopidogrel 75 mg' }], NOTA_CON_CIRUGIA)).toBeTruthy()
  })

  it('reconoce las formas de decir que hay cirugía, con y sin acentos', () => {
    expect(mencionaCirugiaProgramada('cirugia programada para el jueves')).toBe(true)
    expect(mencionaCirugiaProgramada('Valoración prequirúrgica')).toBe(true)
    expect(mencionaCirugiaProgramada('acude a control de su diabetes')).toBe(false)
  })
})

describe('probada al revés: no señala de más', () => {
  it('sin cirugía en el texto no hay aviso, aunque tome warfarina', () => {
    expect(avisoDeCirugiaYAnticoagulante([{ nombre: 'Warfarina' }], 'Control de hipertensión.')).toBeNull()
  })

  it('con cirugía pero sin fármaco que sangre no hay aviso', () => {
    expect(avisoDeCirugiaYAnticoagulante([{ nombre: 'Paracetamol 500 mg' }], NOTA_CON_CIRUGIA)).toBeNull()
  })

  it('el aviso NO propone ningún intervalo: aquí no se inventa una cifra clínica', () => {
    const a = avisoDeCirugiaYAnticoagulante([{ nombre: 'Xarelto' }], NOTA_CON_CIRUGIA) ?? ''
    expect(a).not.toMatch(/\d+\s*(d[ií]as?|horas?)/i)
  })
})

describe('lo que la valoración preoperatoria recibe prellenado', () => {
  it('marca el anticoagulante y su tipo desde la lista de fármacos', () => {
    expect(prellenadoPreoperatorio([{ nombre: 'Rivaroxabán 20 mg' }]))
      .toEqual({ tomaAnticoagulante: true, tipoAnticoagulante: 'DOAC' })
  })

  it('sin fármacos que sangren no prellena nada (no marca casillas por su cuenta)', () => {
    expect(prellenadoPreoperatorio([{ nombre: 'Metformina' }])).toEqual({})
  })
})
