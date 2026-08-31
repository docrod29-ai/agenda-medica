/**
 * GOLDEN — «lo vi» y «localicé a alguien» son cosas distintas.
 *
 * ── QUÉ PEDÍA EL CENSO, Y QUÉ RESULTÓ AL MIRARLO ────────────────────────────
 *
 * `WS-11.laboratorio` decía: «PanelLaboratorio sigue sin
 * revisado/revisadoPor/revisadoEn/criticoNotificado».
 *
 * **Tres de los cuatro campos eran un error del censo.** Existen, en el sitio
 * correcto, y ponerlos en el panel es exactamente lo que la arquitectura
 * prohíbe:
 *
 *   · `revisado`    → `estado: 'cerrada'` de la tarea, cuyo comentario dice
 *                     «alguien lo revisó y decidió. AQUÍ termina, no antes».
 *   · `revisadoPor` → `cerradaPor`
 *   · `revisadoEn`  → `cerradaEn`
 *
 * Y `laboratorio/firestore.ts` lo tiene escrito con todas las letras bajo el
 * título «DÓNDE VIVE REVISADO»: *en la tarea, y en ningún otro sitio. Añadir un
 * `revisado` al panel crearía una segunda fuente de verdad del mismo hecho.*
 *
 * Implementarlos habría sido construir el defecto que el invariante de
 * arquitectura existe para impedir — con el censo dando la orden.
 *
 * ── EL QUE SÍ FALTABA ───────────────────────────────────────────────────────
 *
 * `criticoNotificado`. En todo el árbol no había **nada** que registrara que un
 * valor crítico se comunicó: la única aparición de la palabra era la propia
 * entrada del censo.
 *
 * `CierreDeTarea` tiene `avisoAlPaciente`, y es opcional por una razón escrita y
 * buena: exigirlo en cada cierre convertiría el worklist en un formulario de
 * tres campos, «y un worklist que cuesta se abandona en una semana».
 *
 * Pero ese razonamiento se hizo para **el resultado de rutina**. Un potasio de
 * 7,1 cerrado con «repetir y tratar» y el aviso en blanco deja el expediente sin
 * poder distinguir las dos cosas que ahí importan — y esa distinción es
 * precisamente lo que hace crítico a un valor crítico.
 *
 * ── POR QUÉ PREGUNTA Y NO BLOQUEA ───────────────────────────────────────────
 *
 * Porque **si el aviso debe ser obligatorio, y en cuánto tiempo, es política
 * clínica**, y fijarla está en la lista de prohibiciones del repositorio, igual
 * que inventar una dosis. Se pregunta —regla 6— y el médico contesta.
 *
 * Bloquear el cierre sería fijar esa política de tapadillo. No preguntar dejaría
 * las dos cosas indistinguibles. Preguntar es lo único que no decide por él.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No fija el plazo.** Cuánto tiempo puede pasar entre ver un crítico y
 *   avisar es una decisión clínica y normativa que no está tomada. No se inventa
 *   un número.
 * · **No registra A QUIÉN se avisó ni por qué vía.** Hoy sólo consta que sí, que
 *   todavía no, o que no hacía falta. Un campo de destinatario y vía exige antes
 *   decidir qué destinatarios cuentan, que también es del médico.
 * · **No cubre el camino hospitalario**, que crea una tarea por estudio y tiene
 *   su propio flujo.
 * · **No prueba el render.** Que el aviso se VEA depende del componente; aquí se
 *   comprueba que la pantalla lo pide y con qué argumentos.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  preguntasAlCerrar, puedeCerrarse, avisoRegistrado,
  POR_QUE_EL_CRITICO_PREGUNTA_Y_NO_BLOQUEA,
} from '@/lib/tareas-clinicas/modelo'

const CIERRE = { decision: 'Repetir y tratar', quien: 'medico-1', cuando: '2026-08-30T12:00:00.000Z' }

describe('un valor crítico se cierra con una pregunta delante', () => {
  it('sin aviso registrado, se pregunta', () => {
    const q = preguntasAlCerrar({ prioridad: 'critica' }, CIERRE)
    expect(q).toHaveLength(1)
    expect(q[0]).toMatch(/crítico/i)
    expect(q[0]).toMatch(/no consta/)
  })

  it('con el aviso registrado —cualquiera de los tres— ya no se pregunta', () => {
    /* «Todavía no» y «no hacía falta» también son respuestas: lo que faltaba era
       el silencio, no un valor concreto. */
    for (const aviso of ['avisado', 'no_avisado', 'no_aplica'] as const) {
      expect(preguntasAlCerrar({ prioridad: 'critica' }, { ...CIERRE, avisoAlPaciente: aviso }), aviso).toEqual([])
    }
  })

  it('y en un resultado que NO es crítico no se pregunta nada', () => {
    /**
     * El caso que impide pasarse de frenada. Preguntarlo en cada cierre
     * convertiría el worklist en un formulario de tres campos — que es
     * exactamente la razón por la que `avisoAlPaciente` se dejó opcional.
     */
    expect(preguntasAlCerrar({ prioridad: 'alta' }, CIERRE)).toEqual([])
    expect(preguntasAlCerrar({ prioridad: 'normal' }, CIERRE)).toEqual([])
  })
})

describe('preguntar no es bloquear', () => {
  it('AL REVÉS: el cierre de un crítico sin aviso SIGUE siendo válido', () => {
    /**
     * Si esto devolviera `permitido: false`, el código estaría fijando política
     * clínica —que el aviso es obligatorio— sin que ningún médico lo haya
     * decidido. Está prohibido igual que inventar una dosis.
     */
    expect(puedeCerrarse(CIERRE).permitido).toBe(true)
  })

  it('lo que sigue siendo obligatorio es la decisión, como antes', () => {
    expect(puedeCerrarse({ quien: 'medico-1', cuando: 'x' }).permitido).toBe(false)
    expect(puedeCerrarse({ decision: 'algo', cuando: 'x' }).permitido).toBe(false)
  })

  it('y sin registrar sigue siendo `null`, que no es «no se avisó»', () => {
    /* Confundirlos convierte «no lo sé» en un hecho clínico, y del lado que hace
       que nadie llame. */
    expect(avisoRegistrado({ cierre: CIERRE })).toBeNull()
    expect(avisoRegistrado({ cierre: { ...CIERRE, avisoAlPaciente: 'no_avisado' } })).toBe('no_avisado')
  })

  it('la razón de preguntar en vez de bloquear está escrita', () => {
    expect(POR_QUE_EL_CRITICO_PREGUNTA_Y_NO_BLOQUEA).toMatch(/POLÍTICA CLÍNICA/)
    expect(POR_QUE_EL_CRITICO_PREGUNTA_Y_NO_BLOQUEA).toMatch(/de tapadillo/)
  })
})

describe('la pregunta llega a la pantalla donde se cierra', () => {
  const PENDIENTES = readFileSync('src/app/(dashboard)/pendientes/page.tsx', 'utf8')

  it('la pantalla la pide, con la tarea y el aviso que lleve puesto', () => {
    /* «El dato tiene que LLEGAR»: una regla que sólo existe en el módulo no
       pregunta nada a nadie. */
    expect(PENDIENTES).toContain('preguntasAlCerrar')
    expect(PENDIENTES).toMatch(/preguntasAlCerrar\(cerrando, \{ avisoAlPaciente: aviso \|\| undefined \}\)/)
  })

  it('y el botón de cerrar NO se deshabilita por ella', () => {
    /* Sigue dependiendo sólo de la decisión, que es lo obligatorio. */
    expect(PENDIENTES).toMatch(/disabled=\{!decision\.trim\(\)\}/)
  })
})

describe('lo que el censo pedía y NO había que construir', () => {
  const LAB = readFileSync('src/lib/expediente/laboratorio/firestore.ts', 'utf8')
  const MODELO = readFileSync('src/lib/tareas-clinicas/modelo.ts', 'utf8')

  it('«revisado» vive en la tarea, y el módulo de laboratorio lo dice', () => {
    /**
     * Este caso existe para que nadie vuelva a implementar lo que el censo
     * pedía. Añadir `revisado` al panel crearía la segunda fuente de verdad que
     * el invariante de arquitectura prohíbe — con el censo dando la orden.
     */
    expect(LAB).toMatch(/DÓNDE VIVE «REVISADO»/)
    expect(LAB).toMatch(/segunda fuente de verdad del mismo hecho/)
    expect(LAB).not.toMatch(/^\s*revisado\??:/m)
    expect(LAB).not.toMatch(/^\s*revisadoPor\??:/m)
  })

  it('y sus tres campos ya existen ahí, con otro nombre', () => {
    expect(MODELO).toMatch(/\| 'cerrada'\s+\/\/ alguien lo revisó y decidió/)
    expect(MODELO).toMatch(/cerradaEn\?: string/)
    expect(MODELO).toMatch(/cerradaPor\?: string/)
  })
})
