/**
 * GOLDEN — el médico veía las correcciones de fármacos y NO las de dosis.
 *
 * ── LO QUE PASABA ────────────────────────────────────────────────────────────
 *
 * `ResultadoPipeline` trae tres listas de cambios aplicados al dictado:
 *
 * · `cambiosLexicos` — fármacos mal transcritos. Con panel, y con «deshacer».
 * · `cambiosNormalizacion` — cifras y unidades: «dos gramos» → «2 g».
 * · `cambiosSiglas` — siglas escritas como toca.
 *
 * Las dos últimas se calculaban en **cada dictado** y no salían del pipeline: el
 * hook no las devolvía y ninguna pantalla las pedía.
 *
 * ── POR QUÉ IMPORTA ──────────────────────────────────────────────────────────
 *
 * La regla estaba escrita —en el propio `pipeline.ts`, sobre `cambiosLexicos`—:
 * «una corrección que el médico no puede ver ni revertir es una edición que
 * alguien le hizo a su dictado sin decírselo».
 *
 * Y la lista invisible era justo **la que toca las cifras**. El guardián impide
 * que una cifra desaparezca o cambie de unidad; lo que no puede hacer es decidir
 * por el médico si «dos» quería decir «2» en esa frase.
 *
 * En UCI es peor: ahí las cifras son PEEP, FiO₂ y dosis de aminas.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  cambiosVisibles, cuantosTocanCifra, POR_QUE_NO_BASTA_EL_GUARDIAN,
} from '@/lib/asr/cambios-visibles'
import { procesarTranscript } from '@/lib/asr/pipeline'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const hook = leer('src', 'hooks', 'useGrabacionAudio.ts')

describe('LA UNIÓN DE LAS DOS LISTAS', () => {
  it('etiqueta cada cambio por lo que es', () => {
    const r = cambiosVisibles(
      [{ antes: 'dos', despues: '2', tipo: 'cifra' }, { antes: 'gramos', despues: 'g', tipo: 'unidad' }],
      [{ antes: 'epoc', despues: 'EPOC' }],
    )
    expect(r.map(c => c.etiqueta)).toEqual(['Cifra', 'Unidad', 'Sigla'])
  })

  it('descarta los que no cambiaron nada', () => {
    /**
     * Un «cambio» que deja el texto igual llenaría la lista de líneas que no
     * dicen nada, y el médico dejaría de leerla. Ese es el modo de fallo de
     * verdad: no una alerta que falta, una que se ignora.
     */
    const r = cambiosVisibles([{ antes: 'mg', despues: 'mg', tipo: 'unidad' }], [{ antes: '', despues: 'X' }])
    expect(r).toEqual([])
  })

  it('no repite el mismo cambio dos veces', () => {
    const r = cambiosVisibles(
      [{ antes: 'dos', despues: '2', tipo: 'cifra' }, { antes: 'dos', despues: '2', tipo: 'cifra' }],
      [],
    )
    expect(r).toHaveLength(1)
  })

  it('cuenta aparte los que tocan una cifra o una unidad', () => {
    // Una sigla mal expandida se lee y se corrige; una cifra es una dosis.
    const r = cambiosVisibles(
      [{ antes: 'dos', despues: '2', tipo: 'cifra' }],
      [{ antes: 'peep', despues: 'PEEP' }],
    )
    expect(cuantosTocanCifra(r)).toBe(1)
  })

  it('sin cambios, lista vacía', () => {
    expect(cambiosVisibles([], [])).toEqual([])
  })
})

describe('SOBRE UN DICTADO DE VERDAD', () => {
  it('«dos gramos… cada ocho horas» sale entero en la lista', () => {
    /**
     * Es una dosis dictada como se dicta de verdad. El texto acaba siendo
     * «le doy 2 g de meropenem cada 8 horas»: tres reescrituras que hasta ahora
     * el médico no veía por ninguna parte.
     */
    const r = procesarTranscript('le doy dos gramos de meropenem cada ocho horas')
    const vistos = cambiosVisibles(r.cambiosNormalizacion, r.cambiosSiglas)
    expect(vistos).toContainEqual({ antes: 'dos', despues: '2', etiqueta: 'Cifra' })
    expect(vistos).toContainEqual({ antes: 'ocho', despues: '8', etiqueta: 'Cifra' })
    expect(vistos).toContainEqual({ antes: 'gramos', despues: 'g', etiqueta: 'Unidad' })
    expect(cuantosTocanCifra(vistos)).toBe(3)
  })

  it('un dictado sin cifras no inventa una lista', () => {
    const r = procesarTranscript('el paciente refiere dolor en la espalda desde ayer')
    for (const c of cambiosVisibles(r.cambiosNormalizacion, r.cambiosSiglas)) {
      expect(c.antes).not.toBe(c.despues)
    }
  })
})

describe('Y AHORA SALEN DEL PIPELINE', () => {
  it('el hook los expone', () => {
    expect(hook).toContain('cambiosCifras: CambioVisible[]')
    expect(hook).toContain('setCambiosCifras(cambiosVisibles(r.cambiosNormalizacion, r.cambiosSiglas))')
  })

  it('en los DOS caminos: transcribir y recuperar', () => {
    const veces = hook.split('setCambiosCifras(cambiosVisibles(').length - 1
    expect(veces).toBe(2)
  })

  it('y se limpian al empezar otro dictado', () => {
    // Arrastrar los cambios del dictado anterior enseñaría ediciones que no se
    // hicieron sobre este texto.
    expect(hook).toContain('setCambiosCifras([])')
  })
})

describe('LAS PANTALLAS LOS ENSEÑAN, Y DEJAN DESHACER', () => {
  it('la consulta', () => {
    const page = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
    expect(page).toContain('cambios={audio.cambiosCifras}')
    expect(page).toContain('voz.setTranscripcion(voz.transcripcion.replace(re, c.antes))')
  })

  it('y UCI, donde las cifras son parámetros del ventilador', () => {
    const uci = leer('src', 'app', '(dashboard)', 'uci', 'page.tsx')
    expect(uci).toContain('cambios={audio.cambiosCifras}')
    expect(uci).toContain('setPaseTexto(t => t.replace(re, c.antes))')
  })

  it('está escrito por qué el guardián no basta', () => {
    expect(POR_QUE_NO_BASTA_EL_GUARDIAN).toMatch(/decide él/)
  })
})
