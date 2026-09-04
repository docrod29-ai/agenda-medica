/**
 * GOLDEN — REG-454. `MISSING_UNIT`: la hoja que no dijo la unidad deja de decirla.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * Un renglón sin unidad se guardaba así:
 *
 *     Glucosa 92  →  valor: 92 · unidad: 'mg/dL' · unidadOriginal: 'mg/dL'
 *
 * Y la hoja **no había dicho nada**. El campo que existe precisamente para
 * conservar lo que imprimió el laboratorio (§27.1 del catálogo del dueño: «nunca
 * eliminar la unidad original») estaba diciendo lo que habíamos asumido nosotros.
 *
 * El resultado era **indistinguible** de una hoja que sí declaró mg/dL. Nadie
 * podía saber, mirando el expediente, si la unidad venía del laboratorio o de una
 * suposición del software.
 *
 * ── POR QUÉ IMPORTA MÁS DE LO QUE PARECE ────────────────────────────────────
 *
 * Es la regla 4 de seguridad clínica en su forma más pura: **ausencia de dato no
 * es dato de ausencia.** Que la hoja no dijera la unidad no significa que fuera
 * la convencional — significa que no se sabe.
 *
 * Y es la regla 3: la suposición es una edición al dato, y una edición que no se
 * puede ver es una que alguien le hizo al expediente sin decírselo al médico.
 *
 * ── LO QUE **NO** CAMBIÓ, Y ES DELIBERADO ───────────────────────────────────
 *
 * La fila **sigue graficándose**. Casi todas las hojas mudas están en la unidad
 * de siempre, y dejar de graficarlas vaciaría las series de medio consultorio por
 * una marca de cautela — el mismo error de pasarse de frenada que el médico
 * descartó al fijar el 5 % de la voz.
 *
 * Lo que se gana aquí es que **la suposición se vea**, no que se deje de suponer.
 *
 * ── LO QUE ESTA PRUEBA **NO** CUBRE ──────────────────────────────────────────
 *
 *  · **No desbloquea los rangos anchos del catálogo.** Sigue sin adoptarse la
 *    glucosa 1–3000 del dueño para los analitos que ya existían, y ahora se puede
 *    decir exactamente por qué: con la hoja muda, un rango ancho aceptaría en
 *    silencio un valor que venía en otra unidad. Lo que lo desbloquearía es dejar
 *    de graficar lo mudo, y eso es una decisión del médico, no mía.
 *  · **No adivina la unidad.** Ni por el valor, ni por el analito, ni por las
 *    otras filas de la hoja. Se asume la convencional y se dice que se asumió.
 *  · **No distingue «la hoja no lo dijo» de «la IA no lo leyó».** Las dos llegan
 *    aquí como unidad vacía. Separarlas pide un campo de confianza desde la
 *    lectura de la hoja, que es §32 y no está.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validarPanel } from '@/lib/expediente/laboratorio/extraccion'
import { analitoPorClave } from '@/lib/expediente/laboratorio/analitos'
import { dictaminar, LO_QUE_ESTA_CAPA_NO_HACE } from '@/lib/expediente/laboratorio/unidades'

const RAIZ = process.cwd()
const PANEL = () => readFileSync(join(RAIZ, 'src/components/laboratorio/PanelLaboratorios.tsx'), 'utf8')

describe('LA HOJA MUDA YA NO DICE LO QUE NO DIJO', () => {
  it('`unidadOriginal` se queda VACÍA, no se rellena con la canónica', () => {
    const d = dictaminar(analitoPorClave('glucosa')!, 92)
    expect(d.estado).toBe('MISSING_UNIT')
    expect(d.unidadOriginal, 'la hoja no dijo nada: el campo no puede decir algo').toBeUndefined()
    expect(d.unidadAsumida).toBe('mg/dL')
  })

  it('y una hoja que SÍ la dijo se distingue de una que no', () => {
    /**
     * Éste es el defecto entero en dos líneas: antes las dos daban lo mismo.
     */
    const muda = dictaminar(analitoPorClave('glucosa')!, 92)
    const explicita = dictaminar(analitoPorClave('glucosa')!, 92, 'mg/dL')
    expect(muda.unidadOriginal).toBeUndefined()
    expect(explicita.unidadOriginal).toBe('mg/dL')
    expect(muda.estado).not.toBe(explicita.estado)
  })

  it('el panel guarda la distinción, no sólo el dictamen', () => {
    const p = validarPanel({
      fecha: '2026-09-02',
      filas: [{ estudio: 'Glucosa', valor: '92' }, { estudio: 'Creatinina', valor: '0.9', unidad: 'mg/dL' }],
    })
    const glu = p.resultados.find(r => r.clave === 'glucosa')!
    const cr = p.resultados.find(r => r.clave === 'creatinina')!
    expect(glu.unidadOriginal).toBeUndefined()
    expect(glu.unidadAsumida).toBe('mg/dL')
    expect(cr.unidadOriginal).toBe('mg/dL')
    expect(cr.unidadAsumida).toBeUndefined()
  })
})

describe('LO QUE NO CAMBIÓ — y no cambió a propósito', () => {
  it('la fila muda SIGUE entrando a la gráfica', () => {
    /**
     * Dejar de graficarla vaciaría las series de medio consultorio por una marca
     * de cautela. Es el mismo pasarse de frenada que el médico descartó al fijar
     * el 5 % de la voz: una compuerta que avisa de todo se cierra sin leer.
     */
    const d = dictaminar(analitoPorClave('glucosa')!, 92)
    expect(d.graficable).toBe(true)
    expect(d.valor).toBe(92)
    expect(d.unidad).toBe('mg/dL')
  })

  it('y un valor de pánico sin unidad SIGUE marcando crítico', () => {
    // Regresión de la auditoría 2026-07: el potasio de 7,0 sin unidad usa la
    // convencional y se marca. Añadir `MISSING_UNIT` no podía apagar eso.
    const p = validarPanel({ fecha: '2026-09-02', filas: [{ estudio: 'Potasio', valor: '7.0' }] })
    const k = p.resultados[0]
    expect(k.estado).toBe('MISSING_UNIT')
    expect(k.critico).toBe(true)
    expect(k.graficable).toBe(true)
  })

  it('el ámbar «verificar» NO se enciende por una hoja muda', () => {
    /**
     * `MISSING_UNIT` es cautela declarada, no un defecto que revisar. Si pintara
     * ámbar, media hoja saldría en ámbar y el aviso dejaría de significar nada —
     * justo lo que REG-451 vino a conseguir que significara algo.
     */
    expect(PANEL()).toMatch(/r\.estado !== 'ACCEPTED' && r\.estado !== 'MISSING_UNIT'/)
  })
})

describe('PERO SE VE — el dato tiene que LLEGAR', () => {
  it('la pantalla dice que la unidad se asumió, y cuál', () => {
    const panel = PANEL()
    expect(panel).toMatch(/La hoja no traía unidad/)
    expect(panel).toMatch(/\{r\.unidadAsumida\}/)
    expect(panel).toMatch(/significa otra cosa/)
  })

  it('y ese texto NO dice «no entra a la gráfica», porque sí entra', () => {
    /**
     * Un aviso que describe mal lo que pasó enseña a desconfiar de los avisos.
     * El texto de la hoja muda es suyo y sólo suyo.
     */
    const panel = PANEL()
    const bloque = panel.slice(panel.indexOf("r.estado === 'MISSING_UNIT'"), panel.indexOf("r.estado !== 'MISSING_UNIT' && ("))
    expect(bloque).not.toMatch(/No entra a la gráfica/)
  })
})

describe('CON LAS DOS COSAS EN DUDA, SE DICEN LAS DOS', () => {
  it('sin unidad y fuera de rango: el decimal es SÓLO una de las explicaciones', () => {
    /**
     * Un sodio de 1400 sin unidad podría ser un decimal corrido (140) o una
     * unidad distinta. Ofrecer sólo el decimal sería dar por resuelto lo que no
     * se sabe — el mismo error que REG-452 evitó con la glucosa en mmol/L, aquí
     * en su forma más ambigua.
     */
    const d = dictaminar(analitoPorClave('sodio')!, 1400)
    expect(d.estado).toBe('VERIFY_VALUE_OR_UNIT')
    expect(d.graficable).toBe(false)
    expect(d.decimalCorrido?.candidatos.map(c => c.valor)).toEqual([140])
    expect(d.porQue).toMatch(/la hoja NO dijo la unidad/)
    expect(d.porQue).toMatch(/otra unidad/)
  })

  it('y con la unidad declarada, el texto NO habla de la unidad', () => {
    // Contraprueba: el aviso se adapta a lo que de verdad está en duda.
    const d = dictaminar(analitoPorClave('sodio')!, 1400, 'mEq/L')
    expect(d.porQue).not.toMatch(/NO dijo la unidad/)
    expect(d.porQue).toMatch(/decimal corrido/)
  })
})

describe('LO QUE ESTO NO DESBLOQUEA, dicho a tiempo', () => {
  it('los rangos anchos del catálogo SIGUEN sin adoptarse, y ahora se dice por qué', () => {
    /**
     * Con la hoja muda, un rango ancho acepta en silencio un valor que venía en
     * otra unidad: la glucosa de 7,2 mmol/L pasaría como 7,2 mg/dL si el rango
     * empezara en 1. Lo que lo desbloquearía es dejar de graficar lo mudo, y esa
     * es una decisión del médico dueño.
     */
    expect(analitoPorClave('glucosa')!.min).toBe(20)
    const texto = LO_QUE_ESTA_CAPA_NO_HACE.join(' ')
    expect(texto).toMatch(/NO se adoptan los rangos anchos/)
    expect(texto).toMatch(/decisión del médico dueño/)
  })

  it('y no se adivina la unidad por ningún camino', () => {
    /**
     * Ni por el valor, ni por el analito, ni mirando las otras filas de la hoja.
     * Un 7,2 de glucosa sin unidad NO se lee como mmol/L por ser bajo: se asume
     * la convencional, sale fuera de rango, y se pregunta.
     */
    const d = dictaminar(analitoPorClave('glucosa')!, 7.2)
    expect(d.unidad).toBe('mg/dL')
    expect(d.estado).toBe('VERIFY_VALUE_OR_UNIT')
    expect(d.conversion).toBeUndefined()
  })
})
