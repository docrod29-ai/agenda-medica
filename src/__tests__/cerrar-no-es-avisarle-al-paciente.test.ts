/**
 * GOLDEN — «CERRAR» ERA UN SOLO ACTO QUE ABARCABA TRES (WS-11 · §9).
 *
 * ── QUÉ FALTABA ──────────────────────────────────────────────────────────────
 *
 * El §9 del master loop pide ocho etapas para un resultado: RESULT →
 * SIGNIFICANCE → OWNER → REVIEW → **DECISION → ACTION → PATIENT COMMUNICATION**
 * → CLOSED. `TareaClinica` tenía dato real para cinco. Las tres del cierre no
 * tenían campo propio: **«cerrar» era el único acto y las abarcaba las tres de
 * golpe**.
 *
 * Consecuencia concreta: un resultado crítico revisado y cerrado **sin que nadie
 * llamara al paciente** se veía exactamente igual que uno donde sí se llamó.
 *
 * ── LO QUE EL CÓDIGO YA HACÍA BIEN, Y HAY QUE CONSERVAR ─────────────────────
 *
 * `progreso-resultado.ts` **se negaba a inventarlo**: devolvía las tres
 * `sin_dato` siempre, cerrada o no, y lo declaraba como hallazgo estructural en
 * su encabezado. Ese es el comportamiento que este golden protege — el arreglo
 * NO puede consistir en darlas por hechas al cerrar.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Las tres etapas tienen dónde vivir (`TareaClinica.cierre`), y **nada se deduce
 * del estado**. Cerrada sin registrar el aviso sigue diciendo `sin_dato`.
 *
 * Es la regla 5 de seguridad clínica con una consecuencia muy concreta: si el
 * sistema afirmara que se avisó, nadie volvería a mirar; si afirmara que no,
 * alguien lo arreglaría. **La única respuesta honesta a «no lo sé» es no lo sé.**
 *
 * ── LAS DOS ASIMETRÍAS, Y POR QUÉ NO SON CAPRICHO ───────────────────────────
 *
 * · **La decisión es obligatoria; el aviso no.** Cerrar sin decir qué se decidió
 *   es cerrar sin cerrar. Pero exigir además el aviso convertiría cada cierre en
 *   un formulario de tres campos, y un worklist que cuesta se abandona en una
 *   semana — y entonces deja de verse el resultado que sí importaba, que es peor
 *   que no tener el campo. El propio `modelo.ts` ya razonaba así al negarse a
 *   crear tareas de `indicacion_paciente`.
 * · **`no_aplica` cuenta como registrado.** Alguien miró y decidió que no había
 *   que avisar: eso es un dato. Tratarlo como hueco castigaría la respuesta
 *   honesta y empujaría a marcar «avisado» por comodidad.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · **Ninguna pantalla lo llena todavía.** Esto abre el modelo y el cálculo de
 *   etapas; el formulario de cierre que pida decisión, acción y aviso es la
 *   siguiente unidad. Hasta entonces las tres seguirán saliendo `sin_dato` en
 *   producción — que es la verdad, no un defecto de esto.
 * · **No cubre interconsultas, referencias ni imagen.** Siguen fuera del ciclo:
 *   `Interconsulta` es un array embebido con dos estados y sin dueño; la
 *   referencia es sólo un impreso; imagen no tiene entidad. WS-11 sigue abierto.
 * · **El registro de transiciones tiene tope.** Se conservan las últimas 50: una
 *   tarea reabierta muchas veces no puede hacer crecer su documento sin techo
 *   (el patrón que REG-350 cerró en las notas). Lo antiguo se pierde, y se dice.
 */
import { describe, it, expect } from 'vitest'
import {
  puedeCerrarse, avisoRegistrado, conTransicion, TOPE_TRANSICIONES,
  type Transicion,
} from '@/lib/tareas-clinicas/modelo'

const CUANDO = '2026-08-29T10:00:00.000Z'

describe('CERRAR EXIGE DECIR QUÉ SE DECIDIÓ', () => {
  it('un cierre con decisión y autor se admite', () => {
    expect(puedeCerrarse({ decision: 'Se repite en 3 meses', quien: 'uid-1', cuando: CUANDO }).permitido).toBe(true)
  })

  it('EL CASO: sin decisión NO se cierra — cerrar sin decisión es cerrar sin cerrar', () => {
    const v = puedeCerrarse({ quien: 'uid-1', cuando: CUANDO })
    expect(v.permitido).toBe(false)
    expect(v.motivo).toMatch(/qué se decidió/i)
  })

  it('una decisión en blanco tampoco cuela', () => {
    expect(puedeCerrarse({ decision: '   ', quien: 'uid-1', cuando: CUANDO }).permitido).toBe(false)
  })

  it('sin autor tampoco: un cierre que no se puede auditar no es un cierre', () => {
    expect(puedeCerrarse({ decision: 'Algo', quien: '', cuando: CUANDO }).permitido).toBe(false)
  })

  it('pero el AVISO al paciente no se exige, y es a propósito', () => {
    /**
     * Exigirlo convertiría cada cierre en un formulario de tres campos, y un
     * worklist que cuesta se abandona. Lo que no se admite es inventarlo.
     */
    expect(puedeCerrarse({ decision: 'Control normal', quien: 'uid-1', cuando: CUANDO }).permitido).toBe(true)
  })
})

describe('«NO LO SÉ» NO SE CONVIERTE EN UN HECHO CLÍNICO', () => {
  it('sin cierre registrado, el aviso es null — NO «no_avisado»', () => {
    expect(avisoRegistrado({})).toBeNull()
  })

  it('cerrada sin registrar el aviso sigue siendo null', () => {
    expect(avisoRegistrado({ cierre: { decision: 'Se repite', quien: 'uid-1', cuando: CUANDO } })).toBeNull()
  })

  it('«no_avisado» registrado SÍ es un dato, y se distingue de no saberlo', () => {
    const t = { cierre: { decision: 'Pendiente', avisoAlPaciente: 'no_avisado' as const, quien: 'uid-1', cuando: CUANDO } }
    expect(avisoRegistrado(t)).toBe('no_avisado')
    expect(avisoRegistrado(t)).not.toBeNull()
  })

  it('y «no_aplica» también: alguien miró y decidió', () => {
    expect(avisoRegistrado({ cierre: { decision: 'Control normal', avisoAlPaciente: 'no_aplica', quien: 'uid-1', cuando: CUANDO } }))
      .toBe('no_aplica')
  })
})

describe('EL REGISTRO DE TRANSICIONES', () => {
  const t = (de: Transicion['de'], a: Transicion['a']): Transicion =>
    ({ de, a, quien: 'uid-1', cuando: CUANDO })

  it('acumula sin mutar la lista anterior', () => {
    const previas = [t('solicitada', 'aceptada')]
    const siguientes = conTransicion(previas, t('aceptada', 'en_curso'))
    expect(siguientes.length).toBe(2)
    expect(previas.length, 'no puede mutar lo que le pasaron').toBe(1)
  })

  it('desde vacío también', () => {
    expect(conTransicion(undefined, t('solicitada', 'aceptada')).length).toBe(1)
  })

  it('tiene TOPE: un documento no puede crecer sin techo', () => {
    // El patrón que REG-350 cerró en las notas, aplicado antes de que duela.
    let l: readonly Transicion[] = []
    for (let i = 0; i < TOPE_TRANSICIONES + 25; i++) l = conTransicion(l, t('completada', 'en_curso'))
    expect(l.length).toBe(TOPE_TRANSICIONES)
  })

  it('y conserva las ÚLTIMAS: lo reciente es lo que se audita', () => {
    let l: readonly Transicion[] = []
    for (let i = 0; i < TOPE_TRANSICIONES; i++) l = conTransicion(l, t('completada', 'en_curso'))
    l = conTransicion(l, { de: 'completada', a: 'cerrada', quien: 'ultimo', cuando: CUANDO })
    expect(l[l.length - 1].quien).toBe('ultimo')
    expect(l.length).toBe(TOPE_TRANSICIONES)
  })
})
