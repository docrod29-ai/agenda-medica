/**
 * GOLDEN — REG-600. El decimal corrido se SUGIERE. Nunca se corrige.
 *
 * ── QUÉ FALTABA ──────────────────────────────────────────────────────────────
 *
 * REG-599 dejó el valor imposible dentro del panel, marcado y sin gráfica. Eso
 * evita el daño, pero no ayuda: el médico ve «1400 mEq/L de sodio · verificar» y
 * tiene que ir a la hoja a averiguar qué pasó.
 *
 * El §29 del catálogo del dueño dice qué hacer, y también qué NO hacer:
 *
 *     «Antes de marcar un valor como imposible, evaluar candidatos: ×10 ÷10 ×100
 *      ÷100 ×1000 ÷1000. Ejemplo: Na = 1400 mmol/L podría ser 140 mmol/L. Pero el
 *      sistema debe **sugerir revisión, no corregir automáticamente**.»
 *
 * ── LA TRAMPA, Y ES LA MITAD DEL TRABAJO ────────────────────────────────────
 *
 * La sugerencia sólo se ofrece **cuando la unidad ya es la canónica**. No es un
 * detalle de implementación: es la diferencia entre ayudar y mentir.
 *
 *     Glucosa 7,2 mmol/L × 10 = 72, que es una glucosa perfectamente plausible
 *     en mg/dL. La sugerencia sería «¿quizá 72 mg/dL?» y estaría MAL:
 *     7,2 mmol/L son 130 mg/dL.
 *
 * El decimal no se había corrido — lo que pasaba es que la unidad era otra.
 * Cuando la unidad no cuadra, la explicación es la unidad. Ofrecer un decimal
 * ahí es dar una respuesta **verosímil** a la pregunta equivocada, que es la peor
 * clase de ayuda que puede dar un sistema clínico: se acepta sin mirar.
 *
 * ── Y CUANDO ENCAJAN VARIOS, SE DICEN TODOS ─────────────────────────────────
 *
 * Una creatinina de 120 cabe dividida entre 10, entre 100 y entre 1000. Elegir
 * uno sería adivinar, y encima el más «bonito» —1,2— es justo el equivocado si
 * lo que pasaba era que venía en µmol/L (120 µmol/L son 1,36 mg/dL). Se enseñan
 * los tres y se dice que son varios.
 *
 * ── LO QUE ESTA PRUEBA **NO** CUBRE ──────────────────────────────────────────
 *
 *  · **No hay botón que aplique la sugerencia.** El campo de al lado ya es
 *    editable y la decisión es del médico. Un botón sería reversible y quizá
 *    útil, pero «sugerir revisión» es lo que dice el §29 y no se estira.
 *  · **No sabe si acertó.** Que un candidato quepa en el rango no lo hace
 *    cierto: cabe, nada más. Por eso se redacta como pregunta.
 *  · **No cubre el error de captura que sigue siendo plausible.** Un sodio de
 *    140 tecleado como 145 no lo caza nada de esto, y no lo cazará: está dentro
 *    de todo rango razonable.
 *  · **No mira la serie histórica del paciente.** Un salto imposible respecto de
 *    su valor anterior sería otra señal, y más fuerte. No está.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { analitoPorClave } from '@/lib/expediente/laboratorio/analitos'
import { validarPanel } from '@/lib/expediente/laboratorio/extraccion'
import {
  decimalCorrido, dictaminar, FACTORES_DE_DECIMAL,
  POR_QUE_EL_DECIMAL_NO_SE_OFRECE_EN_OTRA_UNIDAD,
} from '@/lib/expediente/laboratorio/unidades'

const RAIZ = process.cwd()

describe('EL EJEMPLO DEL PROPIO §29', () => {
  it('Na = 1400 sugiere 140, y sólo 140', () => {
    const d = decimalCorrido(analitoPorClave('sodio')!, 1400)
    expect(d).not.toBeNull()
    expect(d!.unico).toBe(true)
    expect(d!.candidatos.map(c => c.valor)).toEqual([140])
  })

  it('y el valor NO se toca: sigue siendo 1400', () => {
    /**
     * La mitad que importa del §29. Un sistema que corrige solo es un sistema
     * que edita el dato del laboratorio sin decírselo a nadie.
     */
    const dic = dictaminar(analitoPorClave('sodio')!, 1400, 'mEq/L')
    expect(dic.valor).toBe(1400)
    expect(dic.valorOriginal).toBe(1400)
    expect(dic.estado).toBe('VERIFY_VALUE_OR_UNIT')
    expect(dic.graficable).toBe(false)
    expect(dic.decimalCorrido?.candidatos[0].valor).toBe(140)
  })

  it('los seis factores son los seis del documento, en su orden', () => {
    expect([...FACTORES_DE_DECIMAL]).toEqual([10, 0.1, 100, 0.01, 1000, 0.001])
    const doc = readFileSync(join(RAIZ, 'docs/clinical/CATALOGO-PLAUSIBILIDAD-LABORATORIO.md'), 'utf8')
    expect(doc).toMatch(/×10[\s\S]*÷10[\s\S]*×100[\s\S]*÷100[\s\S]*×1000[\s\S]*÷1000/)
  })
})

describe('LA TRAMPA — no se sugiere en otra unidad', () => {
  it('una unidad SIN conversión no recibe sugerencia de decimal', () => {
    /**
     * ── EL EJEMPLO CAMBIÓ, LA TRAMPA NO ────────────────────────────────────
     *
     * Este caso era la glucosa en mmol/L. REG-603 la convierte (desde la masa
     * molar de C₆H₁₂O₆), así que ya no llega aquí — y eso es una mejora, no una
     * pérdida: el peligro era que el sistema NO supiera convertir.
     *
     * El caso vivo son ahora los triglicéridos. No se convierten a propósito: no
     * son una molécula sola y el laboratorio usa una masa molar CONVENCIONAL. Y
     * 2,4 mmol/L × 10 da 24, que es un triglicérido plausible en mg/dL — creíble
     * y falso, exactamente la misma trampa.
     */
    const dic = dictaminar(analitoPorClave('trigliceridos')!, 2.4, 'mmol/L')
    expect(dic.estado).toBe('VERIFY_UNIT')
    expect(dic.decimalCorrido, 'la explicación es la unidad, no el decimal').toBeUndefined()
  })

  it('pero ese mismo 24 SÍ sería plausible: por eso la trampa es peligrosa', () => {
    // Se comprueba que el candidato equivocado existiría, para que nadie lea la
    // prueba de arriba como una casualidad.
    const tg = analitoPorClave('trigliceridos')!
    expect(24 >= tg.min && 24 <= tg.max).toBe(true)
  })

  it('y la razón está escrita, no sólo implementada', () => {
    expect(POR_QUE_EL_DECIMAL_NO_SE_OFRECE_EN_OTRA_UNIDAD).toMatch(/130 mg\/dL/)
    expect(POR_QUE_EL_DECIMAL_NO_SE_OFRECE_EN_OTRA_UNIDAD).toMatch(/pregunta equivocada/)
  })
})

describe('CUANDO ENCAJAN VARIOS, NO SE ELIGE', () => {
  it('creatinina 120 ofrece los tres, marcados como varios', () => {
    const d = decimalCorrido(analitoPorClave('creatinina')!, 120)!
    expect(d.unico).toBe(false)
    expect(d.candidatos.map(c => c.valor)).toEqual([12, 1.2, 0.12])
  })

  it('y el «bonito» es justo el que podría estar mal', () => {
    /**
     * 1,2 mg/dL es una creatinina normal y es lo que un humano elegiría. Pero si
     * lo que pasaba es que venía en µmol/L, 120 µmol/L son 1,36 mg/dL — no 1,2.
     * Elegir por verosimilitud es exactamente cómo se cuela un dato falso.
     */
    const cr = analitoPorClave('creatinina')!
    expect(dictaminar(cr, 120, 'umol/L').valor).toBeCloseTo(1.357, 3)
    expect(dictaminar(cr, 120, 'umol/L').valor).not.toBe(1.2)
  })

  it('la ferritina de HLH ofrece tres y ninguno se aplica (§30)', () => {
    // Un resultado clínicamente extraordinario NO es un error.
    const d = decimalCorrido(analitoPorClave('ferritina')!, 2000000)!
    expect(d.candidatos.map(c => c.valor)).toEqual([200000, 20000, 2000])
    expect(d.unico).toBe(false)
    expect(dictaminar(analitoPorClave('ferritina')!, 2000000).valor).toBe(2000000)
  })
})

describe('AL REVÉS POR EL OTRO LADO — no se pasa de frenada', () => {
  it('un valor plausible NO recibe sugerencia', () => {
    /**
     * Si la recibiera, cada glucosa normal traería un «¿quizá 920?» y el médico
     * aprendería a cerrar el aviso sin leerlo. Ahí se pierde la defensa entera.
     */
    expect(decimalCorrido(analitoPorClave('glucosa')!, 92)).toBeNull()
    expect(decimalCorrido(analitoPorClave('sodio')!, 140)).toBeNull()
  })

  it('un imposible que NINGÚN desplazamiento explica no se inventa una razón', () => {
    /**
     * Un hematocrito de 7 000 no cabe ni ×10 ni ÷10 ni nada: 700, 70, 7, 0,7…
     * Se comprueba con un caso donde de verdad no hay candidato, para que la
     * ausencia signifique algo.
     */
    const tsh = analitoPorClave('tsh')!
    expect(decimalCorrido(tsh, 1e12)).toBeNull()
  })

  it('una hoja entera correcta no sugiere NADA', () => {
    const panel = validarPanel({
      fecha: '2026-09-02',
      filas: [
        { estudio: 'Sodio', valor: '139', unidad: 'mEq/L' },
        { estudio: 'Potasio', valor: '4.1', unidad: 'mEq/L' },
        { estudio: 'Creatinina', valor: '0.9', unidad: 'mg/dL' },
      ],
    })
    expect(panel.resultados.every(r => !r.decimalCorrido)).toBe(true)
    expect(panel.resultados.every(r => r.graficable)).toBe(true)
  })
})

describe('EL DATO TIENE QUE LLEGAR — la pantalla lo pregunta', () => {
  const PANEL = () => readFileSync(join(RAIZ, 'src/components/laboratorio/PanelLaboratorios.tsx'), 'utf8')

  it('la sugerencia se pinta, y como PREGUNTA', () => {
    /**
     * «¿Se corrió un decimal?» y no «El valor correcto es 140». Lo primero
     * invita a mirar la hoja; lo segundo afirma algo que este código no sabe.
     */
    const panel = PANEL()
    expect(panel).toMatch(/¿Se corrió un decimal\?/)
    expect(panel).toMatch(/r\.decimalCorrido/)
  })

  it('con varios candidatos los enseña todos', () => {
    expect(PANEL()).toMatch(/r\.decimalCorrido\.candidatos\.map\(c => c\.valor\)\.join\(', '\)/)
  })

  it('y NO hay botón que lo aplique', () => {
    /**
     * §29: sugerir revisión, no corregir automáticamente. El campo de al lado ya
     * es editable — la corrección la hace el médico, a mano y a la vista.
     */
    const panel = PANEL()
    const bloque = panel.slice(panel.indexOf('r.decimalCorrido'), panel.indexOf('r.convertidoCon'))
    expect(bloque).not.toMatch(/onClick/)
  })
})
