/**
 * GOLDEN — la nota quirúrgica tiene dónde asentar lo que un perito busca, y
 * «hospitalaria» significa una sola cosa.
 *
 * Cuatro hallazgos del Panel de Lujo (sep-2026) sobre
 * `src/lib/expediente/templates.ts`:
 *
 *   · MC-009 (M-cirujano, PARCIAL, P2) — la nota postoperatoria no tenía campo
 *     para operación planeada vs realizada, cuenta de gasas/compresas/
 *     instrumental, equipo quirúrgico, piezas a patología ni pronóstico; la
 *     preoperatoria no tenía pronóstico ni tipo de intervención.
 *   · MC-022 (M-cirujano, CONFIRMADO, P3) — no había dónde decir en qué
 *     hospital se operó: el impreso llevaba el establecimiento del consultorio.
 *   · MC-021 (M-cirujano, CONFIRMADO, P3) — no existía la fecha del
 *     procedimiento, así que ningún motor podía calcular el día postoperatorio.
 *   · MC-020 (M-cirujano, CONFIRMADO, P3) — `esHospitalaria` decía que una nota
 *     postoperatoria es hospitalaria; la pantalla del expediente dice lo
 *     contrario con su propia copia. Dos respuestas a la misma pregunta, y la
 *     de este módulo estaba muerta.
 *   · MI-011 (M-internista, PARCIAL, P3) — las notas de consultorio no tenían
 *     sección de pronóstico y las hospitalarias sí.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Recorrido del cirujano: dictar una apendicectomía completa y buscar dónde
 * asentar «convertida a abierta», «cuenta de gasas completa», «pieza enviada a
 * patología». No había dónde: todo acababa en «Descripción de la técnica», de
 * memoria. El equipo rojo verificó además que `grep esHospitalaria` fuera de
 * templates.ts sólo devuelve la copia local del expediente y dos pruebas.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * Las plantillas quirúrgicas se escribieron con lo mínimo y nadie volvió a
 * ellas; y `esHospitalaria` se escribió pensando en el TIPO cuando lo que
 * decide es el EPISODIO.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * Un campo que no existe no se captura nunca. Y una pregunta clínica tiene UNA
 * respuesta en el repositorio, no dos que se contradicen.
 *
 * DECISIÓN APLICADA POR OMISIÓN: todas las secciones nuevas nacen OPCIONALES.
 * Que la NOM-004 exija cada una es `NEEDS_CLINICAL_REVIEW` / revisión legal —
 * lo marcó así el auditor y por eso el equipo rojo dejó MC-009 y MI-011 en
 * `parcial`. Marcarlas obligatorias bloquearía la firma por un requisito que
 * nadie ha verificado contra el texto de la norma. Queda registrado en
 * `decisiones-RECETA-DOCS.md`.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * COMPORTAMIENTO sobre las plantillas y sobre `esHospitalaria`. Se prueba al
 * revés: si alguien marcara obligatoria una de las secciones nuevas, el caso de
 * «no bloquean la firma» se pone rojo — que es justo la decisión que hay que
 * volver a tomar con el dueño delante.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No afirma qué exige la NOM-004: no hay una lista normativa citada en este
 * repositorio, y eso es en sí mismo parte del hallazgo. No cubre el prompt que
 * redacta la nota quirúrgica (`prompts.ts`, otra rebanada): mientras no le pida
 * estos apartados, los rellenará el médico a mano — está en el handoff. No crea
 * el campo estructurado `procedimiento {fecha, nombre, lateralidad}` ni la
 * tarea «retirar puntos» de MC-021: eso toca `NotaMedica` y el motor de tareas,
 * que son de otras rebanadas. No borra la copia local del expediente (su
 * pantalla es de otra rebanada; va en el handoff).
 */
import { describe, it, expect } from 'vitest'
import { SECCIONES_POR_TIPO, esHospitalaria, seccionesVacias } from '@/lib/expediente/templates'

const claves = (tipo: keyof typeof SECCIONES_POR_TIPO) => SECCIONES_POR_TIPO[tipo].map(s => s.key)

describe('MC-009 · MC-021 · MC-022 — la nota postoperatoria', () => {
  it('tiene dónde asentar lo planeado frente a lo realizado', () => {
    expect(claves('nota_postoperatoria')).toContain('operacionPlaneada')
  })

  it('tiene la cuenta de gasas, compresas e instrumental', () => {
    expect(claves('nota_postoperatoria')).toContain('cuentaMaterial')
  })

  it('tiene equipo quirúrgico, estudios transoperatorios y piezas a patología', () => {
    for (const k of ['equipoQuirurgico', 'estudiosTransop', 'piezasPatologia']) {
      expect(claves('nota_postoperatoria'), `falta ${k}`).toContain(k)
    }
  })

  it('tiene pronóstico, como las notas hospitalarias', () => {
    expect(claves('nota_postoperatoria')).toContain('pronostico')
  })

  it('MC-022: tiene dónde decir en qué hospital se operó', () => {
    expect(claves('nota_postoperatoria')).toContain('lugarProcedimiento')
    expect(claves('nota_anestesia')).toContain('lugarProcedimiento')
  })

  it('MC-021: tiene la fecha del procedimiento', () => {
    expect(claves('nota_postoperatoria')).toContain('fechaProcedimiento')
  })

  it('lo que ya bloqueaba la firma sigue bloqueándola, y lo nuevo NO', () => {
    const obligatorias = SECCIONES_POR_TIPO.nota_postoperatoria.filter(s => s.obligatorio).map(s => s.key)
    expect(obligatorias).toEqual([
      'diagnosticoPreop', 'diagnosticoPostop', 'cirugiaRealizada',
      'hallazgos', 'estadoEgreso', 'planPostop',
    ])
  })
})

describe('MC-009 · MI-011 — pronóstico donde no lo había', () => {
  it('la valoración preoperatoria tiene pronóstico y tipo de intervención', () => {
    expect(claves('valoracion_preoperatoria')).toContain('pronostico')
    expect(claves('valoracion_preoperatoria')).toContain('tipoIntervencion')
  })

  it('las tres notas de consultorio tienen pronóstico', () => {
    for (const t of ['historia_clinica', 'primera_vez', 'seguimiento'] as const) {
      expect(claves(t), `${t} sin pronóstico`).toContain('pronostico')
    }
  })

  it('y NO bloquea la firma: la norma no está citada, así que no se exige', () => {
    for (const t of ['historia_clinica', 'primera_vez', 'seguimiento', 'valoracion_preoperatoria'] as const) {
      const pron = SECCIONES_POR_TIPO[t].find(s => s.key === 'pronostico')
      expect(pron?.obligatorio, `${t} exige pronóstico sin norma citada`).toBeFalsy()
    }
    // En las hospitalarias sí era obligatorio y se queda como estaba.
    expect(SECCIONES_POR_TIPO.ingreso.find(s => s.key === 'pronostico')?.obligatorio).toBe(true)
    expect(SECCIONES_POR_TIPO.egreso.find(s => s.key === 'pronostico')?.obligatorio).toBe(true)
  })

  it('control: las secciones nuevas nacen vacías como todas las demás', () => {
    const v = seccionesVacias('nota_postoperatoria')
    expect(v.every(s => s.value === '')).toBe(true)
    expect(v.find(s => s.key === 'piezasPatologia')).toBeTruthy()
  })
})

describe('MC-020 · «hospitalaria» quiere decir una sola cosa', () => {
  it('la nota postoperatoria de un cirujano privado NO es hospitalaria', () => {
    // Es el caso que contradecía a la pantalla del expediente.
    expect(esHospitalaria('nota_postoperatoria')).toBe(false)
    expect(esHospitalaria({ tipo: 'nota_postoperatoria' })).toBe(false)
  })

  it('pero la misma nota DENTRO de un internamiento sí lo es', () => {
    expect(esHospitalaria({ tipo: 'nota_postoperatoria', internamientoId: 'int-sintetico' })).toBe(true)
  })

  it('los tipos que sólo existen internados siguen siendo hospitalarios', () => {
    for (const t of ['ingreso', 'evolucion', 'evolucion_uci', 'egreso'] as const) {
      expect(esHospitalaria(t), t).toBe(true)
    }
  })

  it('y una consulta de consultorio no lo es, con episodio o sin él', () => {
    expect(esHospitalaria('seguimiento')).toBe(false)
    expect(esHospitalaria({ tipo: 'seguimiento' })).toBe(false)
  })
})
