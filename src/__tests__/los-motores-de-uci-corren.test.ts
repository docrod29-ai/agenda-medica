/**
 * CUATRO MOTORES DE UCI QUE NO CORRÍAN — REG-257.
 *
 * ── SEGUNDA COSECHA DEL INSTRUMENTO (REG-255) ───────────────────────────────
 *
 *     src/lib/uci/scores.ts::camIcu
 *     src/lib/uci/pocus.ts::obstruccionTSVI
 *     src/lib/uci/pocus.ts::signo6060
 *     src/lib/uci/pocus.ts::pulsatilidadPorta
 *
 * Los cuatro escritos, con su fuente y sus umbrales —Ely JAMA 2001, Soliman
 * 2026, Beaubien-Souligny 2020— y **sin un solo llamador**. Estaban en el
 * panel de UCI del médico dueño, que es intensivista de guardia, y no corrían.
 *
 * ── EL QUE CAMBIA EL TRATAMIENTO ────────────────────────────────────────────
 *
 * `obstruccionTSVI` dice, con gradiente ≥ 30 mmHg:
 *
 *     «obstrucción dinámica — NO escalar inotrópicos (los empeora)»
 *
 * Un motor que dice eso y no corre es el peor caso posible de esta familia: no
 * es que falte una función, es que la advertencia existe **escrita en el
 * repositorio** y nunca llegó a una pantalla.
 *
 * Por eso su resultado se enseña SIN el filtro de modo avanzado, a diferencia
 * de los otros: esconder tras un interruptor algo que cambia la conducta es
 * tenerlo y no enseñarlo.
 *
 * ── LO QUE NO SE INVENTÓ ────────────────────────────────────────────────────
 *
 * Ni un umbral. Los 30 mmHg, los 60 ms, el 50 % de pulsatilidad y los cuatro
 * rasgos del CAM-ICU **ya estaban en los motores, con su cita**. Conectar es
 * trabajo de software; los cortes son de los autores.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { camIcu } from '@/lib/uci/scores'
import { obstruccionTSVI, signo6060, pulsatilidadPorta } from '@/lib/uci/pocus'

const page = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/uci/page.tsx'), 'utf8')

describe('los cuatro CORREN en el panel de UCI', () => {
  it('la pantalla los importa', () => {
    expect(page).toMatch(/signo6060, obstruccionTSVI, pulsatilidadPorta/)
    expect(page).toMatch(/calcularSOFA, camIcu/)
  })

  it('y los calcula', () => {
    for (const llamada of [
      'obstruccionTSVI(n(\'tsviGrad\'))',
      'signo6060(n(\'pat\'), n(\'itGrad\'))',
      'pulsatilidadPorta(n(\'portaVmax\'), n(\'portaVmin\'))',
      'camIcu({',
    ]) expect(page, `falta ${llamada}`).toContain(llamada)
  })

  it('tienen dónde escribirse los datos', () => {
    for (const k of ['tsviGrad', 'pat', 'itGrad', 'portaVmax', 'portaVmin',
      'camAgudo', 'camInatencion', 'camPensamiento'])
      expect(page, `no hay campo para ${k}`).toContain(`k="${k}"`)
  })
})

describe('lo que cambia el tratamiento NO se esconde', () => {
  it('la obstrucción del TSVI se enseña siempre', () => {
    /**
     * Los demás resultados llevan `ocultar={!modoAvanzado}`. Éste no, y es
     * deliberado: «no escalar inotrópicos» detrás de un interruptor es tenerlo
     * y no enseñarlo.
     */
    const linea = page.split('\n').find(l => l.includes('label="Obstrucción del TSVI"'))!
    expect(linea).toBeTruthy()
    expect(linea, 'quedó tras el modo avanzado').not.toContain('ocultar')
  })

  it('y el motor dice por qué importa', () => {
    const r = obstruccionTSVI(34)
    expect(r.interpretacion).toMatch(/NO escalar inotrópicos/)
  })

  it('por debajo del corte no alarma', () => {
    expect(obstruccionTSVI(29).interpretacion).toMatch(/sin obstrucción significativa/)
  })

  it('sin gradiente medido no inventa nada', () => {
    expect(obstruccionTSVI(undefined).bloqueado).toBe(true)
  })
})

describe('CAM-ICU: el rasgo 3 sale del RASS, no se pregunta dos veces', () => {
  it('la pantalla lo deriva del RASS que ya está capturado', () => {
    /** Pedir dos veces el mismo dato es como se consigue que no se llene ninguna. */
    expect(page).toMatch(/nivelConcienciaAlterado: n\('rass'\) !== null \? Number\(n\('rass'\)\) !== 0 : undefined/)
  })

  it('sólo se piden los rasgos 1, 2 y 4', () => {
    expect(page).toContain('CAM-ICU 1 · inicio agudo/fluctuante')
    expect(page).toContain('CAM-ICU 2 · inatención')
    expect(page).toContain('CAM-ICU 4 · pensamiento desorganizado')
    expect(page).not.toContain('CAM-ICU 3')
  })

  it('se enseña también cuando NO es evaluable, diciendo qué falta', () => {
    /**
     * Un cribado en blanco que desaparece de la pantalla no se llena nunca.
     * «No se sabe» es información.
     */
    expect(page).toMatch(/\{\(cam\.evaluable \|\| cam\.faltan\.length > 0\)/)
    expect(page).toMatch(/falta \{cam\.faltan\.join\(', '\)\}/)
  })

  it('lo que falta NO se da por negativo', () => {
    /**
     * Con rasgos 1 y 2 positivos y el 4 sin evaluar, el motor devuelve «no
     * evaluable» en vez de «negativo». Tratar la ausencia como falso era un
     * falso negativo de delirium.
     */
    const r = camIcu({ inicioAgudoOFluctuante: true, inatencion: true })
    expect(r.evaluable).toBe(false)
    expect(r.positivo).toBeNull()
  })

  it('positivo cuando corresponde, con su fuente', () => {
    const r = camIcu({ inicioAgudoOFluctuante: true, inatencion: true, nivelConcienciaAlterado: true })
    expect(r.positivo).toBe(true)
    expect(r.fuente).toMatch(/Ely/)
  })
})

describe('los otros dos motores, medidos', () => {
  it('el signo 60/60 separa HTP aguda de crónica', () => {
    expect(signo6060(45, 40).hallazgo).toMatch(/aguda/)
    expect(signo6060(45, 70).hallazgo).toMatch(/crónica/)
    expect(signo6060(80, 40).hallazgo).toMatch(/normal/)
  })

  it('la pulsatilidad portal se CALCULA, no se clasifica a ojo', () => {
    /** Antes había que elegir el patrón en un desplegable. */
    expect(pulsatilidadPorta(50, 20).pf).toBe(60)
    expect(pulsatilidadPorta(50, 20).patron).toBe('grave')
    expect(pulsatilidadPorta(50, 40).patron).toBe('normal')
  })

  it('sin las dos velocidades no dice nada', () => {
    expect(pulsatilidadPorta(50, undefined).pf).toBeNull()
    expect(pulsatilidadPorta(50, undefined).patron).toBeNull()
  })
})

describe('no se inventó ningún umbral', () => {
  it('los cortes viven en los motores, con su cita', () => {
    const pocus = readFileSync(join(process.cwd(), 'src/lib/uci/pocus.ts'), 'utf8')
    const scores = readFileSync(join(process.cwd(), 'src/lib/uci/scores.ts'), 'utf8')
    expect(pocus).toMatch(/g >= 30/)
    expect(pocus).toMatch(/pf >= 50/)
    expect(scores).toMatch(/Ely EW et al\. CAM-ICU\. JAMA 2001/)
  })

  it('y la pantalla no define ninguno propio', () => {
    /**
     * Si la pantalla comparara por su cuenta, habría dos verdades para el
     * mismo corte y la primera vez que se separaran nadie sabría cuál creer.
     */
    const bloque = page.slice(page.indexOf('TRES MOTORES POCUS QUE NO CORRÍAN'),
      page.indexOf('const cam = useMemo'))
    expect(bloque).not.toMatch(/>= 30|>= 50|< 60/)
  })
})
