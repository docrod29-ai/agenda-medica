/**
 * REP-013 · MI-014 (M-internista) — dos catálogos renales: el AINE con TFG<30
 * avisa en la consulta (`prescripcion-segura.ts:122`) y NO en la receta
 * (`funcion-renal.ts:222`).
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 * `REGLAS_RENALES` (funcion-renal.ts, motor de la receta) no tiene entrada de
 * AINE, digoxina, litio, colchicina ni alopurinol; `AJUSTE_RENAL`
 * (prescripcion-segura.ts, motor del copiloto de la consulta) sí. El mismo
 * paciente con ketorolaco recibe aviso al dictar y ninguno al imprimir.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor M-internista, MI-014; equipo rojo confirmado P1 con jiti sobre el
 * mismo paciente sintético (creatinina 1.9, 78 años, 62 kg → CrCl 28.1):
 * RECETA `ajusteRenalFarmacos([Ketorolaco, Metformina, Gabapentina])` →
 * [Metformina, Gabapentina]; CONSULTA `revisarListaRenal(...)` →
 * [AINE, Metformina, Gabapentina].
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * Dos fuentes de verdad para la misma entidad clínica («el ajuste renal de un
 * fármaco»), con umbrales, unidades y listas distintas.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * CLAUDE.md invariantes: nunca duplicar la fuente de verdad de una entidad
 * clínica. clinical-safety §5: un fármaco ausente del catálogo es un fármaco
 * que NO se vigila.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * COMPORTAMIENTO: importa los DOS motores reales y les da el MISMO fármaco y la
 * MISMA depuración numérica. Se pasa el mismo número a ambos a propósito, para
 * aislar la diferencia de CATÁLOGO de la diferencia de ESCALA.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No decide qué catálogo manda ni qué depuración (Cockcroft vs CKD-EPI
 * indexada) se usa para dosificar: NEEDS_CLINICAL_REVIEW, pregunta abierta en
 * registry.ts:1729 y en el comentario Q2 de funcion-renal.ts. No añade ninguna
 * cifra ni umbral. No compara el texto de los avisos, sólo su existencia.
 */
import { describe, it, expect } from 'vitest'
import { evaluarFuncionRenal, ajusteRenalFarmacos } from '@/lib/expediente/funcion-renal'
import { revisarListaRenal } from '@/lib/expediente/prescripcion-segura'
import { mgPorDl, kg, valorEn } from '@/types/clinical-quantity'

const renal = evaluarFuncionRenal(mgPorDl(1.9), 78, 'Masculino', kg(62))
const dep = renal.depuracionParaDosis!
const depuracion = valorEn(dep.q, 'mL/min')

const avisaReceta = (nombre: string) => ajusteRenalFarmacos([{ nombre }], dep).length > 0
const avisaConsulta = (nombre: string) => revisarListaRenal([nombre], depuracion).length > 0

describe('REP-013 · receta y consulta coinciden en qué fármaco lleva aviso renal', () => {
  it('el paciente sintético sí tiene depuración < 30', () => {
    expect(dep.base).toBe('cockcroft-gault')
    expect(depuracion).toBeLessThan(30)
  })

  it('ketorolaco con depuración < 30: la consulta avisa (contraindicado) y la receta también debe avisar', () => {
    expect(avisaConsulta('Ketorolaco 30 mg')).toBe(true)
    expect(avisaReceta('Ketorolaco 30 mg'), 'la receta no tiene AINE en su catálogo').toBe(true)
  })

  it('para cada fármaco del caso, los dos motores dan la misma respuesta (hay aviso / no hay aviso)', () => {
    const caso = ['Ketorolaco 30 mg', 'Metformina 850 mg', 'Gabapentina 300 mg']
    const receta = caso.filter(avisaReceta)
    const consulta = caso.filter(avisaConsulta)
    expect(receta, `receta=${receta} · consulta=${consulta}`).toEqual(consulta)
  })

  it('control: metformina avisa en los dos (la prueba no falla por un import roto ni por la depuración)', () => {
    expect(avisaReceta('Metformina 850 mg')).toBe(true)
    expect(avisaConsulta('Metformina 850 mg')).toBe(true)
  })
})
