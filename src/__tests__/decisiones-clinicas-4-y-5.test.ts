/**
 * GOLDEN — decisiones 4 y 5 del Dr. (3-ago-2026): qué hace el motor con una
 * confirmatoria NEGATIVA.
 *
 * Fuente: `docs/maintenance/DECISIONES-CLINICAS-2026-08-03.md`.
 *
 * ── LAS DOS SON SOBRE EL MISMO ERROR, POR LOS DOS LADOS ──────────────────────
 *
 * Un negativo puede leerse de dos maneras equivocadas: **ignorarlo** —el motor
 * sigue afirmando el fenotipo con la misma confianza— o **sobreleerlo** —tomarlo
 * como prueba de lo contrario—. El Dr. cortó una por cada decisión:
 *
 *   · 4 (BLEE): NI ignorar (A) NI cancelar (C). **Degradar** a sospecha, porque
 *     las pruebas fenotípicas tienen falsos negativos descritos —p. ej. por
 *     coproducción de AmpC— y una confirmatoria negativa no excluye el fenotipo.
 *
 *   · 5 (mCIM): la interpretación textual de CLSI es «Carbapenemase **not
 *     detected**». NO es «mecanismo no enzimático demostrado», así que el motor
 *     NO reorienta hacia permeabilidad, eflujo ni porinas: son hipótesis
 *     razonables, pero M100 no da aquí un orden universal que permita declarar
 *     una como mecanismo principal.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { interpretarAntibiograma } from '@/lib/expediente/antibiograma/motor'
import { degradarPorConfirmatoriaNegativa } from '@/lib/expediente/antibiograma/confirmatorias'
import { resumenParaNota } from '@/lib/expediente/antibiograma/resumen-nota'
import type { EntradaAntibiograma, PruebasConfirmatorias, SIR } from '@/lib/expediente/antibiograma/tipos'

const entrada = (
  organismo: string, filas: [string, SIR][], pruebas?: PruebasConfirmatorias,
): EntradaAntibiograma => ({
  organismo, sitio: 'sangre', pruebas,
  resultados: filas.map(([antibiotico, interpretacion]) => ({ antibiotico, interpretacion })),
})

/* ══════════════ DECISIÓN 4 — BLEE ══════════════ */

const PATRON_BLEE: [string, SIR][] = [
  ['Ceftriaxona', 'R'], ['Ceftazidima', 'R'],
  ['Meropenem', 'S'], ['Piperacilina-tazobactam', 'S'],
]

describe('DECISIÓN 4 — la BLEE confirmatoria negativa DEGRADA', () => {
  const e = entrada('Klebsiella pneumoniae', PATRON_BLEE, { esbl: 'neg' })
  const r = interpretarAntibiograma(e)
  const blee = r.fenotipos.find(f => f.clave === 'BLEE')!

  it('el fenotipo NO se cancela — un negativo no excluye', () => {
    /**
     * La opción C sería excesiva: CLSI describe falsos negativos, por ejemplo
     * por coproducción de AmpC.
     */
    expect(blee, 'el fenotipo sigue existiendo').toBeDefined()
  })

  it('pero baja a SOSPECHA — ya no es «probable» sin cambios', () => {
    expect(blee.confianza).toBe('sospecha')
  })

  it('y el nombre lo dice, no sólo el campo de confianza', () => {
    // Quien lee la nota ve el nombre, no el enum.
    expect(blee.nombre).toMatch(/NO CONFIRMADA/)
  })

  it('la base explica por qué se degrada y no se cancela', () => {
    expect(blee.base).toMatch(/resultó NEGATIVO/)
    expect(blee.base).toMatch(/no excluye el fenotipo/)
    expect(blee.base).toMatch(/falsos negativos/)
  })

  it('y avisa de que la terapia se apoya en algo NO confirmado', () => {
    /**
     * El Dr. pidió separar el fenotipo de la terapia: la selección debe apoyarse
     * en las categorías actuales, el foco y el paciente — no sólo en la
     * etiqueta. La separación de capas va aparte; esto es lo que se puede decir
     * sin reestructurar nada.
     */
    expect(blee.base).toMatch(/terapia asociada se apoya en un fenotipo NO confirmado/)
  })
})

describe('DECISIÓN 4 — EL CONTROL', () => {
  it('sin la prueba capturada, el fenotipo conserva su confianza', () => {
    const r = interpretarAntibiograma(entrada('Klebsiella pneumoniae', PATRON_BLEE))
    expect(r.fenotipos.find(f => f.clave === 'BLEE')!.confianza).toBe('probable')
  })

  it('con la prueba POSITIVA no se degrada nada', () => {
    const r = interpretarAntibiograma(entrada('Klebsiella pneumoniae', PATRON_BLEE, { esbl: 'pos' }))
    const blee = r.fenotipos.find(f => f.clave === 'BLEE')!
    expect(blee.confianza).toBe('confirmado')
    expect(blee.nombre).not.toMatch(/NO CONFIRMADA/)
  })

  it('un fenotipo que la PROPIA prueba declaró positivo no se degrada a sí mismo', () => {
    /**
     * Sería degradar la prueba con la prueba. El caso no puede darse hoy
     * —`pruebas.esbl` es un solo valor— pero la función es pública y alguien
     * podría pasarle las dos cosas.
     */
    const { fenotipos, degradados } = degradarPorConfirmatoriaNegativa(
      [{ clave: 'BLEE', nombre: 'BLEE CONFIRMADA (sinergia con clavulanato positiva)', confianza: 'confirmado', base: 'x' }],
      { esbl: 'neg' },
    )
    expect(degradados).toEqual([])
    expect(fenotipos[0].confianza).toBe('confirmado')
  })

  it('y sin pruebas capturadas la función es la identidad', () => {
    const fen = [{ clave: 'BLEE' as const, nombre: 'x', confianza: 'probable' as const, base: 'y' }]
    expect(degradarPorConfirmatoriaNegativa(fen, undefined).fenotipos).toBe(fen)
  })
})

/* ══════════════ DECISIÓN 5 — mCIM ══════════════ */

describe('DECISIÓN 5 — mCIM negativo: «no detectada», no «no la hay»', () => {
  const e = entrada('Klebsiella pneumoniae', [['Meropenem', 'R'], ['Ceftriaxona', 'R']], { carbapenemasa: 'neg' })
  const r = interpretarAntibiograma(e)
  const d = r.didactica.find(x => x.titulo.includes('Carbapenemasa NO DETECTADA'))!

  it('se dice exactamente lo que dice CLSI', () => {
    expect(d, 'el negativo tiene que aparecer en alguna parte').toBeDefined()
    expect(d.texto).toMatch(/carbapenemasa no detectada/i)
  })

  it('y se dice explícitamente lo que NO significa', () => {
    /**
     * Es la mitad que se pierde siempre. «No detectada» se lee como «no la hay»,
     * y de ahí a «el mecanismo es otro» hay un paso que el motor no puede dar.
     */
    expect(d.texto).toMatch(/NO significa que el mecanismo sea no enzimático/)
  })

  it('la resistencia sigue confirmada por el antibiograma', () => {
    expect(d.texto).toMatch(/resistencia está CONFIRMADA por AST/)
    expect(d.texto).toMatch(/mecanismo queda INDETERMINADO/)
  })

  it('se pide un método adicional, no una hipótesis', () => {
    expect(d.texto).toMatch(/método adicional/)
    expect(d.texto).toMatch(/molecular o inmunocromatográfico/)
  })

  it('el motor NO reorienta a permeabilidad, eflujo ni porinas', () => {
    /**
     * Son hipótesis razonables, pero M100 no da en este contexto un orden
     * universal que permita al motor declarar una como mecanismo principal.
     * Ésa fue la opción B, descartada.
     */
    const texto = r.mecanismos.map(m => `${m.nombre} ${m.explicacion}`).join(' ')
    expect(texto).not.toMatch(/bomba de eflujo como mecanismo principal/i)
    expect(r.mecanismos.filter(m => m.confianza === 'confirmado')).toEqual([])
  })

  it('llega a la NOTA, que es lo que queda en el expediente', () => {
    expect(resumenParaNota(e, r)).toMatch(/Carbapenemasa NO DETECTADA por mCIM/)
  })
})

describe('DECISIÓN 5 — el límite del método se dice donde importa', () => {
  it('en Acinetobacter se advierte que CLSI NO respalda el mCIM', () => {
    /**
     * Es donde un negativo engaña más: CLSI no lo respalda ahí por especificidad
     * y reproducibilidad, así que el resultado no es concluyente.
     */
    const e = entrada('Acinetobacter baumannii', [['Meropenem', 'R']], { carbapenemasa: 'neg' })
    const d = interpretarAntibiograma(e).didactica.find(x => x.titulo.includes('NO DETECTADA'))!
    expect(d.texto).toMatch(/en Acinetobacter, CLSI NO respalda el mCIM/)
    expect(d.texto).toMatch(/no es concluyente/)
  })

  it('en Enterobacterales se nombra el alcance real del método', () => {
    const e = entrada('Escherichia coli', [['Meropenem', 'R']], { carbapenemasa: 'neg' })
    const d = interpretarAntibiograma(e).didactica.find(x => x.titulo.includes('NO DETECTADA'))!
    expect(d.texto).toMatch(/Enterobacterales y P\. aeruginosa/)
    expect(d.texto).toMatch(/falsos negativos descritos/)
  })

  it('EL CONTROL: sin prueba capturada no se inventa el aviso', () => {
    const e = entrada('Klebsiella pneumoniae', [['Meropenem', 'R']])
    expect(interpretarAntibiograma(e).didactica.some(x => x.titulo.includes('NO DETECTADA'))).toBe(false)
  })
})

describe('la decisión 4 NO invade la 6, que es más específica', () => {
  it('el MRSA con cefoxitina negativa NO se degrada por la regla genérica', () => {
    /**
     * ESTO LO DESTAPÓ EL GOLDEN DE v959, y es el error que más importa evitar en
     * este archivo: **extender una decisión clínica más allá de donde el Dr. la
     * tomó**.
     *
     * La decisión 4 es sobre la BLEE. El caso «cefoxitina S/negativa con
     * oxacilina R» lo resolvió por separado en la decisión 6 y dice algo
     * distinto: CLSI manda reportar la resistencia a meticilina si CUALQUIERA de
     * las dos pruebas resulta resistente, así que el fenotipo se sostiene.
     *
     * La primera versión de `degradarPorConfirmatoriaNegativa` lo bajaba a
     * `sospecha` y pisaba la decisión más específica.
     */
    const { fenotipos, degradados } = degradarPorConfirmatoriaNegativa(
      [{ clave: 'MRSA', nombre: 'S. aureus resistente a meticilina (MRSA)', confianza: 'confirmado', base: 'x' }],
      { cefoxitinaScreen: 'neg' },
    )
    expect(degradados).toEqual([])
    expect(fenotipos[0].confianza).toBe('confirmado')
  })

  it('y el motor entero lo respeta', () => {
    const r = interpretarAntibiograma(entrada('Staphylococcus aureus',
      [['Oxacilina', 'R'], ['Cefoxitina', 'S'], ['Vancomicina', 'S']]))
    // Decisión 6: `probable` con la discordancia nombrada, NO `sospecha`.
    const mrsa = r.fenotipos.find(f => f.clave === 'MRSA')!
    expect(mrsa.confianza).toBe('probable')
    expect(mrsa.nombre).toMatch(/DISCORDANTE/)
  })
})

describe('las dos decisiones citan su fuente', () => {
  it('el código señala al documento', () => {
    const s = readFileSync(join(process.cwd(), 'src', 'lib', 'expediente', 'antibiograma', 'confirmatorias.ts'), 'utf8')
    expect(s).toContain('DECISIONES-CLINICAS-2026-08-03.md')
    expect(s).toContain('DECISIÓN 5 DEL DR')
    expect(s).toContain('decisión 4 del Dr')
  })
})
