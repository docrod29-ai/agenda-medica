/**
 * GOLDEN — la warfarina de marzo, otra vez, y en la pantalla donde se firma.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * REG-188 se llama «los motores veían la receta de hoy, no al paciente», y su
 * encabezado lo explica con un ejemplo concreto:
 *
 *   > Paciente con warfarina de marzo al que hoy se le receta ketorolaco. **La
 *   > regla de sangrado existe y está probada, y no dispara**, porque la
 *   > warfarina no está en la nota de hoy.
 *
 * Aquella reparación creó `cuadro-completo` y lo llevó al copiloto, a la API de
 * evidencia, a la vigencia renal y a la reconciliación de medicación. **A la
 * barra de avisos no.** Siguió llamando `detectarInteracciones(medicamentos)`
 * con la lista de HOY.
 *
 * O sea: el escenario exacto que REG-188 nombra seguía sin disparar en la única
 * superficie que el médico mira antes de firmar — la misma barra cuyo comentario
 * dice «lo que puede matar hoy no se pliega nunca».
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Siguiendo `medsDelCuadro` por la pantalla, para otra cosa. Aparecía en cuatro
 * sitios y en el quinto —la llamada a `construirAvisos`— la lista era
 * `medicamentos`. La prueba de REG-188 no lo cazaba porque **no menciona la
 * barra ni las interacciones**: comprueba que el cuadro se arma, no dónde llega.
 *
 * Es «escrito y sin conectar» sobre una reparación anterior: el arreglo alcanzó
 * a cuatro consumidores y no al quinto, que era el que enseñaba el aviso. Y no
 * fallaba nada — la barra salía en verde, que es lo caro.
 *
 * ── POR QUÉ NO BASTABA CON PASARLE LA LISTA LARGA ───────────────────────────
 *
 * Porque entonces una interacción entre dos fármacos que el paciente lleva años
 * tomando saldría en CADA consulta, para siempre, mezclada con la que se acaba
 * de crear. `farmacovigilancia.ts` ya tiene escrito lo que cuesta eso: *«las
 * alertas falsas son caras: enseñan al médico a ignorar el panel, y entonces la
 * verdadera tampoco se lee»*. Una alerta verdadera repetida hasta el cansancio
 * hace el mismo daño.
 *
 * Así que se separa lo que **introduce esta consulta** de lo que ya venía,
 * corriendo el mismo detector sobre la medicación previa sola. Sin motor nuevo y
 * sin heurística: si la interacción ya salía sin lo de hoy, no la crea hoy.
 *
 * **Ordenar no es filtrar**: ninguna desaparece.
 *
 * ── Y LA SEGUNDA MITAD: SOBRE CUÁNTO EXPEDIENTE SE COMPROBÓ ─────────────────
 *
 * `listarNotasCompat` devuelve `truncada`, y REG-405 lo llevó hasta las
 * proyecciones y hasta el cartel de la pantalla. A la barra tampoco llegaba. Y
 * ahí el silencio no es neutro: una barra que no dice nada de interacciones se
 * lee como «no hay interacciones», cuando puede querer decir «no miré el
 * expediente entero».
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No cambia ninguna compuerta.** `interaccion` sigue siendo `revisa`: habrá
 *   más avisos —es el objetivo— y ninguno impide firmar.
 * · **No toca alergias, controlados ni dosis peligrosas**, que siguen mirando la
 *   receta de hoy. Para alergias y dosis eso es correcto —se juzga lo que se
 *   prescribe—; para controlados es discutible y queda dicho aquí en vez de
 *   cambiarse de paso.
 * · **No decide qué hacer con la interacción.** Dice que existe y desde cuándo.
 * · **`introducidaHoy` no mide gravedad.** Una interacción vieja puede matar
 *   igual; lo que cambia es cuánto tiene que gritar, no si se dice.
 * · **No prueba el render.** Que la barra se VEA es del componente.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { interaccionesDelCuadro, detectarInteracciones } from '@/lib/expediente/farmacovigilancia'
import { construirAvisos, NIVEL, NO_SE_PLIEGAN } from '@/lib/expediente/avisos-consulta'
import { medicacionDelCuadro } from '@/lib/expediente/cuadro-completo'

const CONSULTA = readFileSync('src/app/(dashboard)/consulta/[patientId]/page.tsx', 'utf8')

/** El ejemplo literal del encabezado de REG-188. */
const WARFARINA_Y_KETOROLACO = [
  { nombre: 'Ketorolaco', deHoy: true },
  { nombre: 'Warfarina', deHoy: false },
]

describe('el escenario que REG-188 nombra, por fin dispara', () => {
  it('AL REVÉS: con la receta de hoy sola, NO hay ninguna alerta', () => {
    /**
     * Éste es el defecto, escrito como lo que la barra hacía. Un solo fármaco no
     * interacciona con nada, así que la barra salía limpia sobre un paciente
     * anticoagulado al que se le acaba de dar un AINE.
     */
    expect(detectarInteracciones([{ nombre: 'Ketorolaco' }])).toEqual([])
  })

  it('y con el cuadro del paciente sale, y sale como MAYOR', () => {
    const r = interaccionesDelCuadro(WARFARINA_Y_KETOROLACO)
    expect(r).toHaveLength(1)
    expect(r[0].severidad).toBe('mayor')
    expect(r[0].titulo).toMatch(/AINE/)
    expect(r[0].detalle).toMatch(/sangrado/i)
  })

  it('marcada como introducida HOY, que es lo que la hace urgente', () => {
    /* La warfarina venía de marzo; el ketorolaco lo escribe él ahora mismo. */
    expect(interaccionesDelCuadro(WARFARINA_Y_KETOROLACO)[0].introducidaHoy).toBe(true)
  })
})

describe('lo que ya venía se dice, pero no encabeza', () => {
  const MIXTO = [
    { nombre: 'Losartan', deHoy: false },
    { nombre: 'Espironolactona', deHoy: false },
    { nombre: 'Ketorolaco', deHoy: true },
    { nombre: 'Warfarina', deHoy: false },
  ]

  it('las dos salen: ordenar no es filtrar', () => {
    /**
     * El caso que impide que esto se convierta en un filtro. Una interacción
     * vieja puede matar igual; lo único que cambia es el orden de lectura.
     */
    const r = interaccionesDelCuadro(MIXTO)
    expect(r).toHaveLength(2)
    expect(r.map(x => x.introducidaHoy).sort()).toEqual([false, true])
  })

  it('la que ya existía sin lo de hoy se marca como tal', () => {
    /* Losartán + espironolactona son las dos previas: esta consulta no la crea. */
    const vieja = interaccionesDelCuadro(MIXTO).find(x => /potasio/i.test(x.titulo))
    expect(vieja, 'no se localizó la interacción previa').toBeTruthy()
    expect(vieja!.introducidaHoy).toBe(false)
  })

  it('y en la barra, la nueva va antes que la vieja', () => {
    const avisos = construirAvisos({ interacciones: interaccionesDelCuadro(MIXTO) })
    const soloInteracciones = avisos.filter(a => a.origen === 'interaccion')
    expect(soloInteracciones).toHaveLength(2)
    expect(soloInteracciones[0].texto).toMatch(/AINE/)
    expect(soloInteracciones[1].texto).toMatch(/ya la tenía antes de esta consulta/)
  })

  it('quien no distinga NO pierde el aviso', () => {
    /**
     * `introducidaHoy: undefined` cuenta como de hoy. Un llamador que todavía
     * pase la forma antigua tiene que seguir viendo la alerta arriba, no
     * degradada por omisión — degradar por defecto convierte una firma vieja en
     * un aviso silenciado.
     */
    const avisos = construirAvisos({
      interacciones: [{ titulo: 'X', detalle: 'Y', severidad: 'mayor' }],
    })
    expect(avisos[0].texto).not.toMatch(/ya la tenía/)
  })

  it('sigue siendo `revisa`: esto no bloquea la firma', () => {
    /* Más avisos es el objetivo; convertirlos en bloqueo sería decidir por el
       médico dueño, que ya decidió qué bloquea. */
    expect(NIVEL.interaccion).toBe('revisa')
  })
})

describe('el dato LLEGA a la barra, que era la mitad que faltaba', () => {
  it('la pantalla le pasa el cuadro completo, no la receta de hoy', () => {
    /**
     * «El dato tiene que LLEGAR». Un motor arreglado al que la pantalla sigue
     * pasándole la lista corta es un motor arreglado que no arregla nada.
     */
    expect(CONSULTA).toMatch(/interacciones: interaccionesDelCuadro\(medsDelCuadro\)/)
  })

  it('y ya no queda la llamada vieja en la barra', () => {
    /* El que evita la recaída: volver a `detectarInteracciones(medicamentos)`
       aquí reabre el agujero exacto y la barra vuelve a salir en verde. */
    expect(CONSULTA).not.toMatch(/interacciones: detectarInteracciones\(medicamentos\)/)
  })

  it('el cuadro marca de dónde viene cada fármaco', () => {
    /* Sin `deHoy` no se puede distinguir lo nuevo de lo viejo, y toda la
       separación de arriba se cae. */
    const cuadro = medicacionDelCuadro(
      [{ nombre: 'Ketorolaco' } as never],
      [{ medicamento: { nombre: 'Warfarina' } } as never],
    )
    expect(cuadro.find(m => m.nombre === 'Ketorolaco')?.deHoy).toBe(true)
    expect(cuadro.find(m => m.nombre === 'Warfarina')?.deHoy).toBe(false)
  })
})

describe('la barra dice sobre cuánto expediente comprobó', () => {
  const COMPROBADO = { farmacos: 4, problemas: 2 }

  it('con historial recortado lo dice, una vez', () => {
    const avisos = construirAvisos({ historialRecortado: true, cuantoSeComprobo: COMPROBADO })
    const recorte = avisos.filter(a => a.origen === 'historial_recortado')
    expect(recorte).toHaveLength(1)
    expect(recorte[0].texto).toMatch(/no cabe entero/)
    expect(recorte[0].texto).toMatch(/4 fármacos y 2 problemas/)
  })

  it('AL REVÉS: con el historial entero NO dice nada', () => {
    /* Un aviso que sale siempre no informa de nada y ocupa la barra. */
    const avisos = construirAvisos({ historialRecortado: false, cuantoSeComprobo: COMPROBADO })
    expect(avisos.filter(a => a.origen === 'historial_recortado')).toEqual([])
  })

  it('ni cuando no había nada que comprobar', () => {
    /**
     * En una nota sin fármacos ni problemas no hay comprobación que matizar. El
     * aviso sería ruido puro, y el ruido en esta barra es exactamente lo que
     * REG-181 vino a quitar.
     */
    const avisos = construirAvisos({
      historialRecortado: true, cuantoSeComprobo: { farmacos: 0, problemas: 0 },
    })
    expect(avisos.filter(a => a.origen === 'historial_recortado')).toEqual([])
  })

  it('es `contexto` y NO se pliega', () => {
    /**
     * `contexto` y no `revisa`: en un paciente con historial largo esto sale
     * siempre, y un aviso que sale siempre en nivel `revisa` enseña a saltarse
     * el nivel `revisa` — que es donde viven la alergia y la interacción.
     *
     * Pero no se pliega: un aviso plegado que dice «esto se comprobó a medias»
     * es un aviso que nadie lee justo cuando importa.
     */
    expect(NIVEL.historial_recortado).toBe('contexto')
    expect(NO_SE_PLIEGAN).toContain('historial_recortado')
  })

  it('no afirma un hallazgo que no tiene', () => {
    /**
     * Dice sobre qué se miró. NO dice «puede haber interacciones ocultas» —eso
     * sería inventar un hallazgo— ni «revise el expediente completo», que sería
     * una orden que un archivo de software no puede dar.
     */
    const t = construirAvisos({ historialRecortado: true, cuantoSeComprobo: COMPROBADO })
      .find(a => a.origen === 'historial_recortado')!.texto
    expect(t).not.toMatch(/puede haber|podría|revise|revisa el expediente/i)
  })

  it('y la pantalla se lo pasa desde donde ya lo tenía', () => {
    expect(CONSULTA).toMatch(/historialRecortado: historialTruncado/)
    expect(CONSULTA).toMatch(/cuantoSeComprobo: \{ farmacos: medsDelCuadro\.length, problemas: dxDelCuadro\.length \}/)
  })
})
