/**
 * EL PAQUETE SE COMPONE DE LA NOTA FIRMADA, NUNCA DEL BORRADOR — POSTVISIT-001.
 *
 * ── QUÉ FALTABA ──────────────────────────────────────────────────────────────
 *
 * `componerPaquete` y `cambiosDeMedicacion` se escribieron una vez en
 * `PATIENT-COMPANION-001`, y el guardián de conexión las cazó al instante: un
 * motor con cuerpo real y sin un solo llamador. Se quitaron las dos y quedó
 * escrito, en `paquete-de-visita.ts`, que su llamador natural era la pantalla
 * donde el médico revisa y libera — `POSTVISIT-001`, esta unidad.
 *
 * `un-borrador-no-llega-al-paciente.test.ts` ya vigilaba la máquina de estados
 * y la compuerta con un paquete escrito a mano («recién compuesto, tal como lo
 * dejará `componerPaquete` cuando llegue»). Ese archivo declaraba, en su
 * cabecera, que NO probaba la composición ni el cálculo de cambios. Éste es el
 * guardián que faltaba.
 *
 * ── LA TRAMPA QUE ESTE ARCHIVO EXISTE PARA EVITAR ───────────────────────────
 *
 * `cambiosDeMedicacion` NO compara la nota de hoy contra la lista previa. Compara
 * dos listas ya VIGENTES —`medicamentosVigentes()` antes y después de esta
 * nota—, calculadas por el llamador. La razón: un fármaco crónico que hoy no se
 * repitió sigue vigente por el propio algoritmo de `medicamentosVigentes`
 * («el silencio no es dato de ausencia» — `ordenes-medicamento.ts`). Comparar
 * contra la nota cruda lo habría marcado «suspendido» por no repetirlo, que es
 * justo el dato de ausencia que la regla 4 de seguridad clínica prohíbe. El
 * caso de «no lo repitió y sigue vigente» (abajo) es la prueba que falla si
 * alguien reintroduce esa comparación más simple y más equivocada.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * - No prueba `POST /api/expediente/paquete-visita` con una petición real: eso
 *   exige el emulador de Firestore. Prueba la función pura que la ruta llama.
 * - No prueba `warningSigns` ni `educationalMaterial`: van vacíos siempre,
 *   declarado y cubierto por `un-borrador-no-llega-al-paciente.test.ts`.
 * - No prueba la máquina de estados ni la compuerta de tres condiciones: eso
 *   sigue en `un-borrador-no-llega-al-paciente.test.ts`.
 */
import { describe, it, expect } from 'vitest'
import {
  componerPaquete, cambiosDeMedicacion,
  type NotaParaComponerPaquete,
} from '@/lib/paciente/paquete-de-visita'

const notaFirmadaBase = (): NotaParaComponerPaquete => ({
  id: 'nota_1',
  estado: 'firmada',
  diagnosticos: [
    { descripcion: 'Faringitis aguda', tipo: 'definitivo' },
    { descripcion: 'Hipertensión arterial (descartada por error de captura)', tipo: 'descartado' },
  ],
  medicamentos: [
    { nombre: 'Amoxicilina', dosis: '500 mg', via: 'oral', frecuencia: 'cada 8 horas', duracion: '7 días' },
    { nombre: 'Paracetamol', dosis: '500 mg', via: 'oral', frecuencia: 'cada 8 horas', duracion: '3 días', estado: 'suspendida' },
  ],
  estudiosOrden: ['Biometría hemática'],
  secciones: [
    { key: 'subjetivo', value: 'Dolor de garganta de tres días.' },
    { key: 'plan', value: 'Control en 7 días si no mejora.' },
  ],
})

const OPTS_SIN_PREVIA = {
  medicacionVigenteAntes: null,
  medicacionVigenteDespues: [{ nombre: 'Amoxicilina' }],
  clinicianContactRules: 'Si tiene dudas, comuníquese a su consultorio: 555-000-0000.',
}

describe('componerPaquete exige una nota FIRMADA', () => {
  it('se niega a componer desde un borrador', () => {
    /** Probada al revés: sin este guard, compondría desde una nota a medio
     *  teclear — justo lo que §1 de patient-facing-ai.md prohíbe (nivel 6 de
     *  las fuentes es "nota firmada", no "nota en curso"). */
    const borrador = { ...notaFirmadaBase(), estado: 'borrador' }
    expect(() => componerPaquete(borrador, OPTS_SIN_PREVIA)).toThrow()
  })

  it('compone desde una nota firmada sin lanzar', () => {
    expect(() => componerPaquete(notaFirmadaBase(), OPTS_SIN_PREVIA)).not.toThrow()
  })
})

describe('componerPaquete nace siempre DRAFT', () => {
  const p = componerPaquete(notaFirmadaBase(), OPTS_SIN_PREVIA)

  it('estado DRAFT, sin aprobador ni fecha, versión 1', () => {
    expect(p.estado).toBe('DRAFT')
    expect(p.approvedBy).toBeNull()
    expect(p.approvedAt).toBeNull()
    expect(p.version).toBe(1)
  })

  it('guarda el notaId, nunca copia la nota', () => {
    expect(p.notaId).toBe('nota_1')
  })
})

describe('qué entra al resumen del encuentro', () => {
  it('un diagnóstico descartado no cuenta como lo que pasó en la consulta', () => {
    const p = componerPaquete(notaFirmadaBase(), OPTS_SIN_PREVIA)
    expect(p.encounterSummary).toBe('Faringitis aguda')
    expect(p.encounterSummary).not.toContain('descartada')
  })
})

describe('qué entra a las instrucciones de medicamentos', () => {
  it('un medicamento suspendido no se le dice al paciente que lo tome', () => {
    const p = componerPaquete(notaFirmadaBase(), OPTS_SIN_PREVIA)
    const nombres = p.medicationInstructions.map(m => m.nombre)
    expect(nombres).toEqual(['Amoxicilina'])
    expect(nombres).not.toContain('Paracetamol')
  })

  it('la instrucción usa el mismo compositor que la hoja del paciente, en español llano', () => {
    const p = componerPaquete(notaFirmadaBase(), OPTS_SIN_PREVIA)
    expect(p.medicationInstructions[0].instruccion).toBe('Amoxicilina · 500 mg · por la boca · cada 8 horas (3 veces al día) · durante 7 días')
  })
})

describe('de dónde salen las órdenes y el seguimiento', () => {
  it('las órdenes vienen de estudiosOrden', () => {
    const p = componerPaquete(notaFirmadaBase(), OPTS_SIN_PREVIA)
    expect(p.orders).toEqual(['Biometría hemática'])
  })

  it('el seguimiento sale de la sección "plan", no de "subjetivo"', () => {
    const p = componerPaquete(notaFirmadaBase(), OPTS_SIN_PREVIA)
    expect(p.followUp).toBe('Control en 7 días si no mejora.')
  })

  it('sin sección "plan", el seguimiento va vacío — no se inventa', () => {
    const sinPlan = { ...notaFirmadaBase(), secciones: [{ key: 'subjetivo', value: 'x' }] }
    const p = componerPaquete(sinPlan, OPTS_SIN_PREVIA)
    expect(p.followUp).toBe('')
  })
})

describe('lo que nunca se compone se queda vacío y declarado', () => {
  it('warningSigns y educationalMaterial van vacíos: no hay de dónde sacarlos sin inventar', () => {
    const p = componerPaquete(notaFirmadaBase(), OPTS_SIN_PREVIA)
    expect(p.warningSigns).toEqual([])
    expect(p.educationalMaterial).toEqual([])
  })

  it('clinicianContactRules es el que trajo el llamador, no uno inventado aquí', () => {
    const p = componerPaquete(notaFirmadaBase(), OPTS_SIN_PREVIA)
    expect(p.clinicianContactRules).toBe('Si tiene dudas, comuníquese a su consultorio: 555-000-0000.')
  })
})

describe('cambiosDeMedicacion — sin lista previa no se afirma nada', () => {
  it('devuelve null cuando no hay con qué comparar', () => {
    expect(cambiosDeMedicacion([{ nombre: 'Amoxicilina' }], null)).toBeNull()
  })
})

describe('cambiosDeMedicacion — compara VIGENTES, no la nota cruda', () => {
  it('un fármaco crónico no repetido hoy sigue "sin-cambio", no "suspendido"', () => {
    /**
     * Éste es el caso que rompe si alguien "simplifica" comparando contra la
     * nota de hoy en vez de contra la lista vigente. `medicamentosVigentes`
     * ya decidió que la metformina sigue vigente porque nadie dijo lo
     * contrario; `cambiosDeMedicacion` tiene que respetar esa decisión.
     */
    const antes = [{ nombre: 'Metformina' }, { nombre: 'Losartán' }]
    const despues = [{ nombre: 'Metformina' }, { nombre: 'Losartán' }]   // la nota de hoy no mencionó ninguno
    const cambios = cambiosDeMedicacion(despues, antes)
    expect(cambios).toEqual([
      { nombre: 'Metformina', tipo: 'sin-cambio' },
      { nombre: 'Losartán', tipo: 'sin-cambio' },
    ])
  })

  it('nuevo: aparece en DESPUÉS y no en ANTES', () => {
    const cambios = cambiosDeMedicacion([{ nombre: 'Amoxicilina' }], [])
    expect(cambios).toEqual([{ nombre: 'Amoxicilina', tipo: 'nuevo' }])
  })

  it('suspendido: aparece en ANTES y no en DESPUÉS', () => {
    const cambios = cambiosDeMedicacion([], [{ nombre: 'Ibuprofeno' }])
    expect(cambios).toEqual([{ nombre: 'Ibuprofeno', tipo: 'suspendido' }])
  })

  it('la comparación no distingue mayúsculas ni espacios sobrantes', () => {
    const cambios = cambiosDeMedicacion([{ nombre: '  amoxicilina  ' }], [{ nombre: 'Amoxicilina' }])
    expect(cambios).toEqual([{ nombre: 'amoxicilina', tipo: 'sin-cambio' }])
  })
})
