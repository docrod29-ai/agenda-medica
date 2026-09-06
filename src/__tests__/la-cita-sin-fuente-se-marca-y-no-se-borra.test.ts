/**
 * UNA CITA SIN FUENTE SE MARCA — NO SE BORRA, NI SE DEJA PARECIENDO RESPALDADA.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * «Análisis basado en evidencia» de la consulta pegaba el texto del modelo en la
 * nota con un bloque «Referencias:» de PMIDs reales debajo, sin comprobar los
 * `[n]`. El equipo rojo lo reprodujo con la salida literal: una frase con «[4]»
 * y dos artículos entraba tal cual a una nota que se firma y es inmutable.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Panel de Lujo 2026-09, RT-004 (ataque propio del equipo rojo, P1),
 * reproducción REP-082.
 *
 * ── CAUSA RAÍZ ──────────────────────────────────────────────────────────────
 *
 * La comprobación de rango vivía como función local de la pantalla del
 * consultor; el otro consumidor de la misma ruta —el que escribe en el
 * expediente— se construyó sin ella. El único control era una frase del prompt
 * dirigida al mismo modelo que produce el texto.
 *
 * ── REGLA ───────────────────────────────────────────────────────────────────
 *
 * clinical-safety §2 (lo verificable se verifica en determinista) y
 * `verificar-la-cita.ts:293`: lo no respaldado NO se borra —puede ser buen
 * razonamiento clínico— pero deja de parecer respaldado.
 *
 * ── TIPO DE PRUEBA ──────────────────────────────────────────────────────────
 *
 * UNITARIA sobre el módulo puro, con la escena literal del equipo rojo. Probada
 * al revés: con todas las citas dentro de rango el texto sale intacto, sin una
 * sola marca ni encabezado (una compuerta que marca siempre no marca nada).
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * No cubre la afirmación con un `[n]` DENTRO de rango que el artículo no
 * sostiene: eso exige el PASAJE literal y `verificarAfirmaciones`, y la ruta que
 * alimenta esta pantalla no devuelve pasajes (parte (c) de RT-004, declarada).
 * No cubre el DOM ni el guardado de la sección: eso lo mide la prueba de
 * contrato hermana sobre `agregarAnalisisANota`.
 */
import { describe, it, expect } from 'vitest'
import {
  citasEnTexto, comprobarCitasDelAnalisis,
} from '../app/(dashboard)/consulta/[patientId]/citas-del-analisis'

/* La escena literal de REP-082: un ensayo inventado con «[4]» y dos fuentes. */
const TEXTO_DEL_MODELO =
  'La anticoagulación con apixabán reduce el ictus [1]. El ensayo ARISTOTLE-II '
  + 'mostró un NNT de 42 a 24 meses [4]. La seguridad renal está descrita [2].'

describe('la cita fuera de rango se marca', () => {
  it('lee los [n] del texto sin repetirlos y en orden', () => {
    expect(citasEnTexto(TEXTO_DEL_MODELO)).toEqual([1, 2, 4])
  })

  it('con dos referencias, «[4]» queda marcado y el texto NO se borra', () => {
    const r = comprobarCitasDelAnalisis(TEXTO_DEL_MODELO, 2)
    expect(r.fueraDeRango).toEqual([4])
    expect(r.texto).toContain('[4 — sin fuente]')
    expect(r.texto).not.toContain('mostró un NNT de 42 a 24 meses [4].')
    expect(r.texto).toContain('ARISTOTLE-II')          // la frase sigue ahí
    expect(r.texto).toContain('[1]')                    // las buenas no se tocan
    expect(r.texto).toContain('[2]')
  })

  it('la sección empieza diciendo cuántas citas hay que revisar', () => {
    expect(comprobarCitasDelAnalisis(TEXTO_DEL_MODELO, 2).texto.split('\n')[0])
      .toMatch(/^Revisar antes de firmar: 1 cita \(\[4\]\)/)
  })

  it('probada al revés: con todo dentro de rango el texto sale intacto y sin encabezado', () => {
    const r = comprobarCitasDelAnalisis('Todo respaldado [1] y [2].', 2)
    expect(r.fueraDeRango).toEqual([])
    expect(r.sinFuentes).toBe(false)
    expect(r.texto).toBe('Todo respaldado [1] y [2].')
  })

  it('un análisis sin ninguna cita tampoco produce ruido', () => {
    const r = comprobarCitasDelAnalisis('Sin citas, sólo razonamiento.', 0)
    expect(r.texto).toBe('Sin citas, sólo razonamiento.')
    expect(r.sinFuentes).toBe(false)
  })
})

describe('cuando PubMed no contestó', () => {
  it('con cero referencias y citas en el texto, la primera línea lo declara', () => {
    const r = comprobarCitasDelAnalisis('Esto está respaldado [1].', 0)
    expect(r.sinFuentes).toBe(true)
    expect(r.texto.split('\n')[0]).toMatch(/No se pudo consultar PubMed/)
    expect(r.texto).toContain('[1 — sin fuente]')
  })
})
