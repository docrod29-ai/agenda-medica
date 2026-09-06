/**
 * REP-051 · MI-006 (M-internista) — en un producto combinado el motor de dosis
 * lee el número equivocado: «Paracetamol/tramadol 325/37.5 mg» se revisa como
 * 37.5 mg de paracetamol, y así se lo dice al médico.
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 * `src/lib/seguridad/dosis.ts:293`
 *   `const masa = t.match(/(\d+(?:[.,]\d+)?)\s*(mcg|…|mg|gramos?|gr|g)\b/)`
 * En «325/37.5 mg» la unidad sólo está pegada al SEGUNDO componente, así que
 * `extraerMg` devuelve 37.5. `buscarFarmaco('Paracetamol/tramadol')` casa con
 * Paracetamol (subcadena bidireccional, dosis.ts:118), y
 * `terapiaDuplicadaDeLaLista` imprime al médico:
 *   «Paracetamol: 4000 mg + 112.5 mg = 4112.5 mg/día … supera el máximo diario»
 * cuando el paracetamol real de ese renglón son 975 mg/día.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor M-internista, MI-006; equipo rojo confirmado P1 con jiti sobre los
 * motores reales: `extraerMg('325/37.5 mg')` → 37.5; `'500/5 mg'` → 5;
 * `'100/25 mg'` → 25; y la cadena «4112.5 mg/día» reproducida literal.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * El parser de masa no distingue «n/m unidad» (dos componentes) de «n unidad».
 * `terapia-duplicada.ts:163` declara QUE_NO_CUBRE y esta limitación no está.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * clinical-safety §1 (una cifra plausible con dos decimales es el fallo más
 * caro) y §4/§5: cuando el motor no puede saber, lo dice — como ya hace para
 * mL y para UI en este mismo archivo — y no opina.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * COMPORTAMIENTO: motores reales. Los valores (325/37.5, 1 g c/6 h, 4000 mg de
 * techo) son los que ya cita el auditor; no se introduce ninguna cifra nueva.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No resuelve el reparto correcto de un combinado (exige una tabla de
 * formulaciones que no existe: NEEDS_CLINICAL_REVIEW). No vigila el segundo
 * componente (tramadol). Se exige `null` porque es la respuesta honesta que
 * propone el hallazgo; si el arreglo prefiere un código `combinado_no_evaluable`
 * en la alerta, el segundo caso lo acepta y el primero debe reescribirse.
 */
import { describe, it, expect } from 'vitest'
import { extraerMg } from '@/lib/seguridad/dosis'
import { terapiaDuplicadaDeLaLista } from '@/lib/seguridad/terapia-duplicada'

const SUMAS = new Set(['sobre_maximo_diario', 'dosis_alta_verificar'])

describe('REP-051 · «n/m unidad» es un combinado y el motor no puede repartirlo', () => {
  it.each(['325/37.5 mg', '500/5 mg', '100/25 mg'])('extraerMg(%s) no opina (hoy devuelve el segundo componente)', (txt) => {
    expect(extraerMg(txt), `devolvió ${extraerMg(txt)}`).toBeNull()
  })

  it('Paracetamol 1 g c/6 h + Paracetamol/tramadol 325/37.5 mg c/8 h: no se imprime una suma (hoy «4112.5 mg/día»)', () => {
    const r = terapiaDuplicadaDeLaLista([
      { nombre: 'Paracetamol 500 mg', dosis: '1 g', frecuencia: 'c/6h', via: 'oral' },
      { nombre: 'Paracetamol/tramadol', dosis: '325/37.5 mg', frecuencia: 'c/8h', via: 'oral' },
    ], [])
    const conSuma = r.flatMap(g => g.alertas).filter(a => SUMAS.has(a.codigo))
    expect(conSuma.map(a => a.mensaje), 'el médico ve una cifra que no es la suya').toHaveLength(0)
    // El aviso de duplicado en sí puede (y debe) seguir saliendo: es la misma sustancia.
    expect(r.flatMap(g => g.alertas).some(a => a.codigo === 'terapia_duplicada')).toBe(true)
  })

  it('control: dos renglones simples de paracetamol SÍ se suman contra el techo del catálogo', () => {
    const r = terapiaDuplicadaDeLaLista([
      { nombre: 'Paracetamol', dosis: '1 g', frecuencia: 'c/6h', via: 'oral' },
      { nombre: 'Tempra', dosis: '500 mg', frecuencia: 'c/8h', via: 'oral' },
    ], [])
    expect(r.flatMap(g => g.alertas).some(a => SUMAS.has(a.codigo))).toBe(true)
  })

  it('control: una dosis simple con decimal sigue leyéndose («37.5 mg» → 37.5)', () => {
    expect(extraerMg('37.5 mg')).toBe(37.5)
  })
})
