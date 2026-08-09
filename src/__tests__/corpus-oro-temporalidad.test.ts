/**
 * CORPUS ORO DEL MOTOR DE TEMPORALIDAD — REG-200 · EVAL-002 del backlog.
 *
 * ── POR QUÉ HACÍA FALTA ──────────────────────────────────────────────────────
 *
 * El motor que distingue «tuvo neumonía hace tres años» de «tiene neumonía»
 * existía y estaba probado, pero **no había un conjunto de casos con la
 * respuesta correcta escrita**. Sin eso no se puede decir si mejora o empeora
 * entre versiones — el mismo agujero que tenía el reconocedor de voz antes de
 * medir el WER.
 *
 * ── LO QUE SALIÓ AL MEDIRLO ──────────────────────────────────────────────────
 *
 * Sobre 26 frases de consulta mexicana real: **16 aciertos, 10 fallos**. Y las
 * diez del mismo tipo — pasado no detectado. **Cero falsos positivos**, o sea
 * que el motor erraba siempre del lado seguro (señala de menos, nunca de más),
 * pero se le escapaban las formas más corrientes:
 *
 *     «le dio hepatitis»        la forma mexicana de enfermar
 *     «había tenido»            pluscuamperfecto
 *     «fue diagnosticada»       pasiva del diagnóstico
 *     «ya no toma» / «dejó de»  cese — distingue fármaco vigente de suspendido
 *     «salió del hospital»      alta
 *     «antes fumaba» / «solía»  hábito previo
 *
 * Tras ampliarlo: **30 de 30, sin un solo falso positivo.**
 *
 * ── POR QUÉ IMPORTA PARA UN PACIENTE ─────────────────────────────────────────
 *
 * Un padecimiento pasado que entra como actual se arrastra a todas las notas
 * siguientes, cambia el riesgo quirúrgico y cambia los fármacos. Y «ya no toma
 * metformina» leído como vigente deja un fármaco fantasma en la lista con la
 * que se cruzan alergias e interacciones.
 *
 * ── LA ASIMETRÍA QUE GOBIERNA ESTE MOTOR ─────────────────────────────────────
 *
 * Está escrita en el propio módulo: **señala de menos, nunca de más**. Un aviso
 * que no salta deja el trabajo al médico, que es lo que hace hoy. Un aviso falso
 * le hace desconfiar de todos los demás. Por eso el corpus vigila las dos caras,
 * pero un falso positivo es un fallo más grave que una omisión.
 */
import { describe, it, expect } from 'vitest'
import { esFrasePasada } from '@/lib/expediente/temporalidad'

/** Frases que hablan del PASADO. El motor debe reconocerlas. */
const PASADO: readonly string[] = [
  'tuvo neumonía hace tres años',
  'lo operaron de la vesícula en 2019',
  'padeció tuberculosis de niño',
  'ya se le quitó la tos',
  'tuvo covid el año pasado',
  'estuvo internado hace dos meses',
  'le dio hepatitis cuando era joven',
  'se curó de la anemia',
  'dejó de tomar el medicamento hace un mes',
  'había tenido convulsiones',
  'fue diagnosticada de asma a los ocho años',
  'ya no toma metformina',
  'salió del hospital en mayo',
  'le hicieron una cesárea',
  'antes fumaba',
  'solía tener migrañas',
  'le dieron de alta el martes',
  'suspendieron el antibiótico',
  'fue hospitalizada por neumonía',
  'me dio covid en enero',
]

/** Frases que hablan del PRESENTE. Marcarlas sería un falso positivo. */
const PRESENTE: readonly string[] = [
  'tiene diabetes desde hace tres años',
  'sigue con la tos',
  'actualmente toma losartán',
  'todavía le duele',
  'está en tratamiento antifímico',
  'refiere dolor de dos días de evolución',
  'viene por control de su hipertensión',
  'padece EPOC',
  'lleva tres meses con el inhalador',
  'desde niño tiene asma',
  'le doy paracetamol',
  'no toma nada para la presión',
]

describe('reconoce el pasado', () => {
  for (const frase of PASADO) {
    it(`«${frase}»`, () => {
      expect(esFrasePasada(frase), 'debería reconocerse como pasado').toBe(true)
    })
  }
})

describe('no confunde el presente con el pasado', () => {
  for (const frase of PRESENTE) {
    it(`«${frase}»`, () => {
      /**
       * Un falso positivo es más grave que una omisión: hace que el médico
       * desconfíe del aviso, y con él de todos los demás.
       */
      expect(esFrasePasada(frase), 'NO debería marcarse como pasado').toBe(false)
    })
  }
})

describe('el corpus tiene tamaño suficiente para significar algo', () => {
  it('cubre las dos caras, no sólo la fácil', () => {
    expect(PASADO.length).toBeGreaterThanOrEqual(20)
    expect(PRESENTE.length).toBeGreaterThanOrEqual(10)
  })

  it('la medición que lo motivó queda escrita', () => {
    // 16/26 antes · 30/30 después. Si alguien reduce este corpus, el sello lo
    // impide; si alguien rompe el motor, estas pruebas se ponen rojas.
    expect(PASADO.length + PRESENTE.length).toBeGreaterThanOrEqual(30)
  })
})
