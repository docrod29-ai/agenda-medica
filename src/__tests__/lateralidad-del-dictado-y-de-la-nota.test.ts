/**
 * LA LATERALIDAD SE COTEJA CON UN MOTOR, NO SE LE DEJA AL MODELO.
 *
 * Panel de Lujo (sep-2026), ortopedista: MO-001 (P2) y MO-002 (P2), los dos
 * confirmados por el equipo rojo como UN solo defecto con dos caras.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * «Esguince de tobillo izquierdo… solicito radiografía de tobillo derecho…
 * perdón, izquierdo.»
 * · El pipeline no tocaba esas palabras (lista protegida del corrector) y el
 *   único emisor de `lateralidad_incierta` era el corrector: una contradicción
 *   DENTRO del dictado nunca preguntaba. `procesarTranscript` devolvía
 *   `motivos: []`.
 * · La nota la decidía el modelo y ningún motor cotejaba nota↔dictado. El
 *   prompt no tenía regla de autocorrección del médico ni de lateralidad, y la
 *   regla G autorizaba corregir «sin mostrar el error».
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Grep de `lateral|lado|derech|izquierd` sobre las 884 líneas del prompt: cero
 * reglas. Grep de `lateralidad` en src/lib/expediente: sólo el NER, REG-370 y
 * el texto del aviso. El equipo rojo confirmó que el único control era
 * `safety.conflicts_detected` — probabilístico, del mismo modelo.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * El motivo de lateralidad estaba cableado a una etapa que jamás lo producía,
 * y el cotejo dictado↔nota no existía para nadie.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 * clinical-safety §6 (se pregunta, no se adivina) y §3 (nada en silencio).
 * `lateralidad.ts` detecta contradicciones en el dictado y coteja la nota
 * región por región; el pipeline emite `lateralidad_contradictoria`; el prompt
 * exige conservar la ÚLTIMA lateralidad dictada con source_quote y declarar
 * toda corrección de audio en `safety.correcciones_de_audio`. Respeta PL-C13:
 * pregunta, no bloquea.
 *
 * ── PROBADO AL REVÉS ─────────────────────────────────────────────────────────
 * Un dictado limpio (un lado por región) no dispara nada; el de la retractación
 * sí. Y la nota con el lado equivocado se delata contra el mismo dictado.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * `REGIONES` es vocabulario: una región que no esté no se vigila. No cubre
 * lateralidad dicha con gestos ni por el paciente («me duele éste»), ni
 * regiones sin lado (columna). No decide cuál lado es el correcto. Y que la
 * consulta LLAME a `verificarLateralidad` antes de firmar y pinte
 * `correcciones_de_audio` es handoff a CONSULTA; que el motor entre al registro
 * es handoff a MOTORES.
 */
import { describe, it, expect } from 'vitest'
import {
  contradiccionesDeLateralidad, verificarLateralidad, mencionesDeLado,
  ultimaLateralidadPorRegion, describirDiscrepancia, REGIONES,
} from '@/lib/asr/lateralidad'
import { procesarTranscript } from '@/lib/asr/pipeline'
import { MOTIVOS_CONFIRMACION } from '@/lib/asr/politica-critica'
import { TEXTO_MOTIVO, MOTIVOS_CLINICAMENTE_MATERIALES, textosDeMotivos } from '@/lib/expediente/motivos-confirmacion-texto'
import { buildSystemPrompt } from '@/lib/expediente/prompts'
import { SafetyBlock } from '@/lib/expediente/extraction-schema'

const RETRACTACION = 'Esguince de tobillo izquierdo grado dos. Solicito radiografía AP y lateral de tobillo derecho, perdón, izquierdo.'
const LIMPIO = 'Esguince de tobillo izquierdo grado dos. Dolor en hombro derecho de dos semanas. Solicito radiografía de tobillo izquierdo.'

describe('MO-002 · el detector de contradicciones en el dictado', () => {
  it('EL CASO: «tobillo derecho, perdón, izquierdo» es una contradicción con retractación', () => {
    const c = contradiccionesDeLateralidad(RETRACTACION)
    expect(c.length).toBeGreaterThan(0)
    const tobillo = c.find(x => x.region === 'tobillo')
    expect(tobillo).toBeTruthy()
    expect(tobillo!.lados.sort()).toEqual(['derecho', 'izquierdo'])
    expect(tobillo!.retractacion).toBe(true)
    // Lo que manda es lo ÚLTIMO dicho.
    expect(tobillo!.ultima).toBe('izquierdo')
  })

  it('dos lados para la misma región SIN retractación también preguntan', () => {
    const c = contradiccionesDeLateralidad('Dolor de rodilla derecha. Se explora la rodilla izquierda con derrame.')
    expect(c.find(x => x.region === 'rodilla')?.lados.sort()).toEqual(['derecho', 'izquierdo'])
  })

  it('probado al revés: regiones distintas con lados distintos NO son contradicción', () => {
    expect(contradiccionesDeLateralidad(LIMPIO)).toEqual([])
    expect(contradiccionesDeLateralidad('hombro derecho y pie izquierdo')).toEqual([])
  })

  it('«le digo al paciente» no es una retractación', () => {
    expect(contradiccionesDeLateralidad('le digo al paciente que el tobillo derecho necesita reposo')).toEqual([])
  })

  it('cada lado se pega a la región más cercana de su frase', () => {
    const m = mencionesDeLado('hombro derecho y pie izquierdo')
    expect(m.map(x => [x.region, x.lado])).toEqual([['hombro', 'derecho'], ['pie', 'izquierdo']])
  })

  it('la última lateralidad por región es la que manda', () => {
    expect(ultimaLateralidadPorRegion(RETRACTACION).get('tobillo')).toBe('izquierdo')
  })
})

describe('MO-001 · el cotejo determinista nota↔dictado', () => {
  it('EL CASO: la nota dice «derecho» y lo último dictado fue «izquierdo»', () => {
    const nota = 'Diagnóstico: esguince de tobillo derecho grado II. Plan: radiografía de tobillo derecho.'
    const v = verificarLateralidad(RETRACTACION, nota)
    expect(v.ok).toBe(false)
    expect(v.discrepancias).toContainEqual({ region: 'tobillo', enDictado: 'izquierdo', enNota: 'derecho', motivo: 'lado_distinto' })
    expect(describirDiscrepancia(v.discrepancias[0])).toMatch(/lo último que se dictó fue «tobillo izquierdo»/)
  })

  it('la nota con el lado correcto pasa el cotejo pero conserva la contradicción del dictado para preguntar', () => {
    const v = verificarLateralidad(RETRACTACION, 'Esguince de tobillo izquierdo grado II.')
    expect(v.discrepancias).toEqual([])
    expect(v.contradiccionesDelDictado.length).toBeGreaterThan(0)
    expect(v.ok).toBe(false)
  })

  it('un lado en la nota que el dictado nunca dio se marca como sin respaldo', () => {
    const v = verificarLateralidad('dolor de rodilla de dos semanas', 'Gonalgia de rodilla derecha.')
    expect(v.discrepancias[0]).toMatchObject({ region: 'rodilla', enDictado: null, enNota: 'derecho', motivo: 'lado_sin_respaldo' })
  })

  it('probado al revés: dictado y nota concordantes → ok', () => {
    const v = verificarLateralidad(LIMPIO, 'Esguince de tobillo izquierdo. Omalgia derecha en hombro derecho.')
    expect(v.ok).toBe(true)
    expect(v.regionesCotejadas.sort()).toEqual(['hombro', 'tobillo'])
  })

  it('el vocabulario de regiones está declarado y no es trivial', () => {
    expect(REGIONES.length).toBeGreaterThanOrEqual(20)
    expect(REGIONES.map(r => r.canonica)).toContain('tobillo')
  })
})

describe('MO-002 · el pipeline emite el motivo y la alerta', () => {
  it('el dictado con retractación produce `lateralidad_contradictoria` y una alerta que dice el último lado', () => {
    const r = procesarTranscript(RETRACTACION)
    expect(r.motivos).toContain('lateralidad_contradictoria')
    expect(r.requiereConfirmacion).toBe(true)
    expect(r.contradiccionesDeLado.length).toBeGreaterThan(0)
    const a = r.alertas.find(x => x.tipo === 'lateralidad')
    expect(a).toBeTruthy()
    expect(a!.detalle).toMatch(/último dictado \(izquierdo\)/)
  })

  it('probado al revés: el dictado limpio no pide nada', () => {
    const r = procesarTranscript(LIMPIO)
    expect(r.motivos).toEqual([])
    expect(r.contradiccionesDeLado).toEqual([])
  })

  it('el motivo está declarado en la política y tiene texto clínicamente material', () => {
    expect(MOTIVOS_CONFIRMACION).toContain('lateralidad_contradictoria')
    expect(MOTIVOS_CLINICAMENTE_MATERIALES.has('lateralidad_contradictoria' as never)).toBe(true)
    expect(TEXTO_MOTIVO.lateralidad_contradictoria).toMatch(/último que se dictó/)
    expect(textosDeMotivos(['lateralidad_contradictoria'])).toHaveLength(1)
  })
})

describe('MO-001 · el prompt deja de corregir en silencio y conserva la última lateralidad', () => {
  const p = buildSystemPrompt('primera_vez')

  it('tiene la regla de autocorrección del médico: manda lo último dicho', () => {
    expect(p).toMatch(/4-bis\. SI EL MÉDICO SE CORRIGE A SÍ MISMO, MANDA LO ÚLTIMO QUE DIJO/)
    expect(p).toMatch(/LA LATERALIDAD SE COPIA LITERAL DEL DICTADO/)
    expect(p).toMatch(/source_quote OBLIGATORIO/)
  })

  it('ya no autoriza «sin mostrar el error»: toda corrección de audio se declara', () => {
    expect(p).not.toMatch(/sin mostrar el error/)
    expect(p).toMatch(/NUNCA EN SILENCIO/)
    expect(p).toMatch(/safety\.correcciones_de_audio/)
  })

  it('la lateralidad y la negación no se corrigen ni declarándolas', () => {
    expect(p).toMatch(/DOS cosas que NUNCA\s+corriges por tu cuenta/)
  })

  it('el esquema acepta y conserva las correcciones declaradas', () => {
    const s = SafetyBlock.parse({ correcciones_de_audio: [{ oido: 'septriasona', escrito: 'ceftriaxona', ubicacion: 'plan' }] })
    expect(s.correcciones_de_audio).toEqual([{ oido: 'septriasona', escrito: 'ceftriaxona', ubicacion: 'plan' }])
    expect(SafetyBlock.parse({}).correcciones_de_audio).toEqual([])
  })
})
