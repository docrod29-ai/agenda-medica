/**
 * GUARDIÁN — la función renal LLEGA al motor de aplicabilidad de la evidencia.
 *
 * ── QUÉ FALLABA, Y CÓMO SE DESCUBRIÓ ────────────────────────────────────────
 *
 * REG-387 construyó el motor de aplicabilidad (WS-09) con cuatro dimensiones:
 * edad, embarazo, función renal y alergia. Su único llamador en producción
 * —`/api/expediente/evidencia`— armaba el estado del paciente con **edad y
 * alergias, y nada más**.
 *
 * Así que el evaluador renal, escrito y probado, no podía dar en producción otro
 * veredicto que `datos_insuficientes`. Medido: un estudio que dice «se excluyeron
 * pacientes con TFG < 30» frente a un paciente con TFG de ~27 **medida hoy**
 * salía como «faltan datos» en vez de «este paciente no cabe en la población del
 * estudio».
 *
 * Se descubrió leyendo WS-09 para añadir una QUINTA dimensión. El §22 del pliego
 * del dueño obliga a mirar qué hay antes de escribir; al mirar el llamador
 * apareció que dos de las cuatro que ya existían no recibían su dato.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * `.claude/rules/el-dato-tiene-que-llegar.md`, en su forma exacta: «conectado,
 * pero el dato no llega». El motor tenía su prueba. El llamador tenía la suya.
 * Ninguna de las dos miraba del otro lado.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Un solo traductor (`estadoParaAplicabilidad`) entre lo que sabe el expediente
 * y lo que el motor sabe leer, con la TFG calculada por la calculadora canónica
 * —CKD-EPI 2021, fuente de verdad única— y con tres negativas explícitas: sin
 * edad adulta, sin sexo o sin vigencia **no hay cifra**.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **El embarazo sigue sin llegar, a propósito.** No hay fuente estructurada y
 *   deducirlo del texto es lo que REG-364/365 midieron fallando. Hay un caso que
 *   exige que el motivo siga escrito, para que el hueco declarado no se vuelva un
 *   hueco olvidado.
 * · **Los dos casos de conexión son de SUBSTRING.** Comprueban que el llamador
 *   nombre lo que debe nombrar, no que la petición HTTP real lo lleve. Eso
 *   necesita la ruta corriendo con PubMed y el gateway de IA simulados, y no
 *   está hecho. Es exactamente la clase de prueba de la que esta regla desconfía:
 *   se pone aquí porque es más que nada, y se declara para que nadie la lea como
 *   una medición de punta a punta.
 * · **No prueba que la creatinina de la pantalla sea la correcta.** De eso
 *   responden `labsDelCuadro` (REG-368) y la vigencia (REG-375).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { aplicabilidad } from '@/lib/evidencia/aplicabilidad'
import {
  estadoParaAplicabilidad, sePuedeEstimarLaTfg,
  EDAD_MINIMA_CKD_EPI, POR_QUE_EL_EMBARAZO_NO_SE_DEDUCE,
} from '@/lib/evidencia/estado-del-paciente'

/** Varón de 70 años con creatinina 2.5 mg/dL → CKD-EPI 2021 ≈ 27 mL/min/1.73 m². */
const RENAL_BAJO = { edad: 70, sexo: 'Masculino', creatinina: 2.5, funcionRenalVigente: true }
const EXCLUYE_RENAL = [{ texto: 'Se excluyeron pacientes con TFG < 30 mL/min/1.73 m²', clase: 'exclusion' as const }]

describe('el dato llega: la función renal decide de verdad', () => {
  it('un paciente con TFG por debajo del corte NO cabe en la población del estudio', () => {
    const veredicto = aplicabilidad(EXCLUYE_RENAL, estadoParaAplicabilidad(RENAL_BAJO))
    expect(veredicto.veredicto).toBe('no_aplica')
  })

  it('PROBADO AL REVÉS: sin la creatinina —como estaba hasta hoy— el mismo caso decía «faltan datos»', () => {
    /**
     * Éste es el defecto, reproducido. `contexto` llevaba edad y alergias, así
     * que el estado que llegaba al motor era exactamente éste.
     */
    const comoEstaba = estadoParaAplicabilidad({ edad: 70, sexo: 'Masculino' })
    expect(comoEstaba.tfg).toBeUndefined()
    expect(aplicabilidad(EXCLUYE_RENAL, comoEstaba).veredicto).toBe('datos_insuficientes')
  })

  it('la cifra sale de la calculadora canónica, no de aquí', () => {
    const tfg = estadoParaAplicabilidad(RENAL_BAJO).tfg
    expect(tfg?.vigente).toBe(true)
    /* Rango, no igualdad: se comprueba que CKD-EPI corrió de verdad, sin fijar
       un decimal que ataría la prueba a la precisión interna de la fórmula. */
    expect(tfg?.valor).toBeGreaterThan(25)
    expect(tfg?.valor).toBeLessThan(29)
  })

  it('una TFG por encima del corte no excluye, y el veredicto máximo sigue siendo «nada lo excluye»', () => {
    const sano = aplicabilidad(EXCLUYE_RENAL, estadoParaAplicabilidad({ ...RENAL_BAJO, creatinina: 1.0 }))
    expect(sano.veredicto).toBe('nada_lo_excluye')
  })
})

describe('las tres negativas: dónde este módulo se niega a dar una cifra', () => {
  it('REG-375 — una creatinina fuera de su ventana no decide', () => {
    const caduca = estadoParaAplicabilidad({ ...RENAL_BAJO, funcionRenalVigente: false })
    expect(caduca.tfg?.vigente).toBe(false)
    expect(aplicabilidad(EXCLUYE_RENAL, caduca).veredicto).toBe('datos_insuficientes')
  })

  it('guarda pediátrica — CKD-EPI 2021 no está validada en menores, así que no hay número', () => {
    const nino = { ...RENAL_BAJO, edad: EDAD_MINIMA_CKD_EPI - 1 }
    expect(sePuedeEstimarLaTfg(nino)).toBe(false)
    expect(estadoParaAplicabilidad(nino).tfg).toBeUndefined()
    /* Y en el límite exacto sí se puede: la guarda no se pasa de estricta. */
    expect(sePuedeEstimarLaTfg({ ...RENAL_BAJO, edad: EDAD_MINIMA_CKD_EPI })).toBe(true)
  })

  it('sin sexo no hay cifra: el coeficiente cambia el resultado y no se elige uno por defecto', () => {
    expect(estadoParaAplicabilidad({ ...RENAL_BAJO, sexo: undefined }).tfg).toBeUndefined()
  })

  it('sin vigencia declarada no se manda TFG: un número sin fecha no es un número', () => {
    expect(estadoParaAplicabilidad({ ...RENAL_BAJO, funcionRenalVigente: undefined }).tfg).toBeUndefined()
  })

  it('una creatinina implausible no se convierte en una TFG plausible', () => {
    expect(estadoParaAplicabilidad({ ...RENAL_BAJO, creatinina: 0 }).tfg).toBeUndefined()
    expect(estadoParaAplicabilidad({ ...RENAL_BAJO, creatinina: 900 }).tfg).toBeUndefined()
  })
})

describe('lo que sigue sin llegar, dicho en voz alta', () => {
  it('el embarazo SIGUE sin deducirse del texto — pero ya llega de la fuente estructurada', () => {
    /**
     * PREMISA CAMBIADA EN REG-560, y a mejor.
     *
     * Este caso decía «el embarazo NO se deduce, y el motivo sigue escrito».
     * El motivo pedía, con esas palabras, «una fuente estructurada, no un
     * includes('embarazo')». Esa fuente existía en la otra rama y las dos se
     * encontraron al fusionar: `lo-que-el-expediente-dice-del-embarazo` lee el
     * `tipo` del diagnóstico.
     *
     * Lo que NO cambió —y es lo que este caso sigue defendiendo— es que del
     * TEXTO no se deduce nada. Sin diagnósticos estructurados, ausencia.
     */
    expect(estadoParaAplicabilidad({ ...RENAL_BAJO }).embarazo).toBeUndefined()
    expect(POR_QUE_EL_EMBARAZO_NO_SE_DEDUCE).toMatch(/REG-364/)
    expect(POR_QUE_EL_EMBARAZO_NO_SE_DEDUCE).toMatch(/estructurad/i)

    // Confirmado sí llega; el diferencial NO afirma: llega como ausencia.
    const conf = estadoParaAplicabilidad({ ...RENAL_BAJO, diagnosticos: [{ descripcion: 'Embarazo de 12 SDG', tipo: 'definitivo' }] })
    expect(conf.embarazo).toBe(true)
    const dif = estadoParaAplicabilidad({ ...RENAL_BAJO, diagnosticos: [{ descripcion: 'Embarazo', tipo: 'diferencial' }] })
    expect(dif.embarazo).toBeUndefined()
  })

  it('un estudio que excluye embarazadas sigue saliendo «faltan datos», que es lo conservador', () => {
    const r = aplicabilidad(
      [{ texto: 'Se excluyeron mujeres embarazadas', clase: 'exclusion' }],
      estadoParaAplicabilidad({ edad: 30, sexo: 'Femenino' }),
    )
    expect(r.veredicto).toBe('datos_insuficientes')
  })
})

describe('conexión — comprobación de SUBSTRING, no de punta a punta (ver cabecera)', () => {
  it('la ruta de evidencia arma el estado con el traductor, no a mano', () => {
    const ruta = readFileSync('src/app/api/expediente/evidencia/route.ts', 'utf8')
    expect(ruta).toContain('estadoParaAplicabilidad(ctx)')
    expect(ruta, 'volvió el estado armado a mano: el dato dejaría de llegar otra vez')
      .not.toContain('{ edadEnAnios: ctx.edad }')
  })

  it('la consulta manda la creatinina Y su vigencia', () => {
    const pagina = readFileSync('src/app/(dashboard)/consulta/[patientId]/page.tsx', 'utf8')
    expect(pagina).toContain('creatinina: labsDeLaConsulta.labs.creatinina')
    expect(pagina).toContain('funcionRenalVigente: vigenciaRenal.vigente')
  })
})
