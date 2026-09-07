/**
 * LA RECETA SE ARMA DEL PLAN, NO DE LOS ANTECEDENTES — 7-sep-2026.
 *
 * ── LO QUE FALLABA, POR TERCERA VEZ ─────────────────────────────────────────
 *
 * «Si yo te digo los antecedentes —paciente hipertenso, toma sartán— me lo
 * pones en la pinche receta, y te dije que no: tú vas a poner ahí el plan de lo
 * que te diga el doctor.»
 *
 * En el minuto dos de la consulta se recaban antecedentes; en el minuto veinte
 * se dicta el plan. El losartán del minuto dos salía impreso, con cédula.
 *
 * ── CÓMO SE DESCUBRIÓ QUE LAS DOS DEFENSAS ANTERIORES NO BASTABAN ───────────
 *
 * Ya estaba reparado dos veces —REG-183 declaró `procedenciaClinica` en el
 * esquema plano; REG-515 añadió `speaker`— y el dueño volvió a verlo. Al
 * reproducirlo se ve por qué: las dos fallan JUNTAS en el caso más común de
 * este consultorio.
 *
 *   1. `procedenciaClinica` es **la opinión del modelo**. Cuando etiqueta el
 *      antecedente como `se_prescribe_hoy`, se acabó la defensa.
 *   2. `speaker` sólo existe **si hubo diarización**. Sin ella el campo viene
 *      ausente, y la ausencia no se castiga a propósito —castigarla borraría
 *      del papel los renglones que el médico escribió a mano—.
 *
 * Modelo equivocado + sin voces separadas = nada en pie. El primer `it` de
 * abajo es exactamente ese estado, y **pasa por las dos defensas viejas**.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * La tercera defensa no es una heurística nueva: es la frase del médico
 * ejecutada. La receta se arma del apartado del PLAN, que es texto que el
 * propio modelo acaba de redactar leyendo el dictado entero. Dónde quedó
 * escrito el fármaco es un hecho de la nota, no una opinión sobre ella, y no
 * depende de que la diarización llegue.
 *
 * ── LO QUE ESTA PRUEBA NO CUBRE ─────────────────────────────────────────────
 *
 * · Que el modelo escriba el plan EN el apartado del plan. Si redacta el
 *   tratamiento dentro del padecimiento actual, esto lo lee como historia.
 * · Los fármacos que el médico teclea a mano: no pasan por la nota y siguen
 *   imprimiéndose como siempre, que es lo correcto.
 * · La renovación («sigue con su losartán»), donde el fármaco aparece en los
 *   dos sitios: ahí manda la etiqueta del modelo, y esta prueba lo fija.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  laRecetaSeArmaDelPlan, dondeQuedoEscrito, hayPlanEscrito, loNombra,
} from '@/lib/expediente/el-plan-manda-en-la-receta'
import { medicamentosDeLaReceta } from '@/lib/expediente/que-va-en-la-receta'

const ruta = readFileSync(
  join(process.cwd(), 'src/app/api/expediente/procesar/route.ts'), 'utf8',
)

/** La consulta del dueño, tal como la contó. Antecedentes arriba, plan abajo. */
const SECCIONES = {
  motivoConsulta: 'Odinofagia de tres días.',
  antecedentesRelevantes: 'Hipertensión arterial de larga evolución, en tratamiento con losartán.',
  padecimientoActual: 'Inicia hace tres días con dolor faríngeo y fiebre.',
  exploracionFisica: 'Faringe hiperémica con exudado.',
  planTratamiento: 'Amoxicilina 500 mg VO cada 8 horas por 7 días. Paracetamol si fiebre.',
}

/**
 * El estado exacto que se le escapaba al producto: el modelo etiquetó MAL el
 * antecedente y no hubo diarización, así que `speaker` viene ausente en los dos.
 */
const COMO_LLEGABA = [
  { nombre: 'Losartán',    dosis: '50 mg',  procedenciaClinica: 'se_prescribe_hoy' as const },
  { nombre: 'Amoxicilina', dosis: '500 mg', procedenciaClinica: 'se_prescribe_hoy' as const },
]

describe('el defecto, reproducido con las defensas viejas', () => {
  it('sin la tercera defensa, el losartán de los antecedentes BAJA al papel', () => {
    const papel = medicamentosDeLaReceta(COMO_LLEGABA).map(m => m.nombre)
    expect(papel).toContain('Losartán')   // ← esto es lo que el dueño veía impreso
  })
})

describe('con el plan mandando, el papel lleva sólo lo de hoy', () => {
  const corregidos = laRecetaSeArmaDelPlan(COMO_LLEGABA, SECCIONES)

  it('el antecedente deja de ser una prescripción', () => {
    expect(corregidos.find(m => m.nombre === 'Losartán')?.procedenciaClinica).toBe('ya_lo_toma')
  })

  it('lo que sí se dictó en el plan sigue siendo de hoy', () => {
    expect(corregidos.find(m => m.nombre === 'Amoxicilina')?.procedenciaClinica).toBe('se_prescribe_hoy')
  })

  it('y en el papel queda exactamente uno', () => {
    expect(medicamentosDeLaReceta(corregidos).map(m => m.nombre)).toEqual(['Amoxicilina'])
  })

  it('NINGÚN renglón se borra: los motores de alergias e interacciones los siguen viendo todos', () => {
    expect(corregidos).toHaveLength(COMO_LLEGABA.length)
    expect(corregidos.map(m => m.nombre).sort()).toEqual(['Amoxicilina', 'Losartán'])
  })
})

describe('las fronteras del módulo, que son la mitad de su valor', () => {
  it('sin plan escrito NO opina: el pase en vivo devuelve la lista intacta', () => {
    const enVivo = { motivoConsulta: 'Odinofagia.', antecedentesRelevantes: 'Toma losartán.' }
    expect(hayPlanEscrito(enVivo)).toBe(false)
    expect(laRecetaSeArmaDelPlan(COMO_LLEGABA, enVivo)).toEqual(COMO_LLEGABA)
  })

  it('la renovación aparece en los dos sitios y ahí manda la etiqueta del modelo', () => {
    const renueva = { ...SECCIONES, planTratamiento: 'Continúa losartán 50 mg al día. Amoxicilina 500 mg cada 8 h.' }
    const d = dondeQuedoEscrito('Losartán', renueva)
    expect(d.enElPlan && d.enLaHistoria).toBe(true)
    const [losartan] = laRecetaSeArmaDelPlan(COMO_LLEGABA, renueva)
    expect(losartan.procedenciaClinica).toBe('se_prescribe_hoy')
  })

  it('un fármaco que no aparece en ningún apartado no se toca (regla 4)', () => {
    const suelto = [{ nombre: 'Metformina', procedenciaClinica: 'se_prescribe_hoy' as const }]
    expect(laRecetaSeArmaDelPlan(suelto, SECCIONES)[0].procedenciaClinica).toBe('se_prescribe_hoy')
  })

  it('no casa subcadenas: «sartán» dentro de «losartán» no cuenta como otro fármaco', () => {
    expect(loNombra('Toma losartán.', 'Valsartán')).toBe(false)
    expect(loNombra('Toma losartán.', 'Losartán')).toBe(true)
  })

  it('un nombre compuesto se encuentra por su parte larga', () => {
    expect(loNombra('Se indica amoxicilina con ácido clavulánico.', 'Amoxicilina/clavulanato')).toBe(true)
  })
})

describe('el dato tiene que LLEGAR: la corrección corre en el SERVIDOR', () => {
  /**
   * Que viva en la pantalla protegería sólo a la pantalla que la escribió — la
   * familia de defecto que ya costó caro (`LA_AUTORIDAD_DE_PRESCRIPCION_ES_UNA_SOLA`).
   * De esta respuesta cuelgan además el PDF, el expediente y el portal.
   */
  it('/api/expediente/procesar corrige la procedencia antes de contestar', () => {
    expect(ruta).toContain('laRecetaSeArmaDelPlan')
  })
})
