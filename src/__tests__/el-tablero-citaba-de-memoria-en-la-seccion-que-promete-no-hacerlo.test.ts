/**
 * GOLDEN — la sección titulada «no citadas de memoria» citaba de memoria.
 *
 * ── QUÉ FALLABA (WS-01.tablero) ─────────────────────────────────────────────
 *
 * REG-564 derivó el estado por requisito. REG-574 añadió el conteo de los tres
 * programas en vuelo. El censo dejó apuntado lo que quedaba: *«la prosa de cada
 * WS sigue a mano y puede envejecer»*.
 *
 * Al medirlo contra el árbol, la prosa que había envejecido era **justo la que
 * promete no envejecer**. La sección se titula, literal:
 *
 *     ## Compuertas medidas en este SHA — no citadas de memoria
 *
 * y citaba, escritos a mano:
 *
 *   · un trinquete de lint de **96** cuando el techo llevaba días en **95**
 *   · **10 844** casos cuando el árbol tenía **12 019**
 *   · «medido el 29-ago … tras REG-348…REG-362», con el ledger en REG-588
 *
 * ── LA CAUSA RAÍZ, POR CUARTA VEZ ESTE MES ──────────────────────────────────
 *
 * Con REG-572, REG-576 y REG-586 son cuatro: **cuanto mejor explicada está una
 * garantía, menos probable es que alguien vaya a comprobar si el código la
 * cumple.** Un título que promete no citar de memoria no impide citar de
 * memoria. Un guardián sí.
 *
 * ── LO QUE SE DERIVA Y LO QUE NO — Y LA LÍNEA ESTÁ RAZONADA ─────────────────
 *
 * Se derivan los **techos** y los conteos que se leen de un archivo:
 * `lint-techo.json`, `techos-de-diseno.json`, `MASTER_STATE.json`,
 * `invariantes-clinicos.json`. Todos existen ya y todos tienen su propio
 * guardián; lo único que faltaba era que el tablero los LEYERA en vez de
 * repetirlos.
 *
 * **No se deriva el resultado de correr la suite.** Eso exige correrla, y meter
 * una corrida de tres minutos dentro de un generador de documentación lo
 * convierte en algo que nadie ejecuta — y un generador que nadie ejecuta deja el
 * documento exactamente igual de viejo, con la ceremonia añadida.
 *
 * Así que ese número sigue siendo una **foto**, y ahora se llama así, lleva
 * fecha, y dice que si no cuadra con lo de hoy gana lo de hoy.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **La prosa de cada WS sigue a mano**, y debe: es criterio, no un `grep`.
 *   Lo que ya no puede envejecer son las cifras.
 * · **No comprueba que la foto sea reciente.** Comprobar eso exigiría correr la
 *   suite desde el guardián, que es lo que se decidió no hacer.
 * · **No vigila los otros tableros** (#296, #310, #314), que son de GitHub.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  compuertas, generarCompuertas, aplicarCompuertas,
  INICIO_COMPUERTAS, FIN_COMPUERTAS,
} from '../../scripts/programa/tablero-derivado.mjs'

const TABLERO = readFileSync('docs/product/AUSCULTA-MASTER-BOARD.md', 'utf8')
const techoLint = JSON.parse(readFileSync('docs/audit/lint-techo.json', 'utf8'))
const sello = JSON.parse(readFileSync('src/lib/clinical/invariantes-clinicos.json', 'utf8'))

describe('las cifras del tablero salen de los archivos, no de la memoria', () => {
  it('el techo de lint que enseña es el que compara el trinquete', () => {
    /* Éste era el defecto exacto: decía 96 con el techo en 95. */
    expect(compuertas().techoLint).toBe(techoLint.errores)
    expect(TABLERO).toContain(`| Trinquete de lint | **${techoLint.errores}** — sólo puede bajar |`)
  })

  it('y el sellado clínico, igual', () => {
    expect(TABLERO).toContain(`**${sello.archivos.length} archivos · ${sello.totalCasos} casos**`)
  })

  it('el bloque del tablero coincide byte a byte con lo que produce el generador', () => {
    /**
     * El guardián entero. Sin esto, alguien podría editar el bloque a mano y las
     * cifras volverían a envejecer con el generador en verde.
     */
    expect(aplicarCompuertas(TABLERO)).toBe(TABLERO)
  })

  it('el bloque está delimitado, para no pisar la prosa que SÍ se escribe a mano', () => {
    const i = TABLERO.indexOf(INICIO_COMPUERTAS)
    const j = TABLERO.indexOf(FIN_COMPUERTAS)
    expect(i, 'sin marcadores, el generador reescribiría la sección entera').toBeGreaterThan(0)
    expect(j).toBeGreaterThan(i)
  })
})

describe('lo viejo ya no está', () => {
  it('no queda la tabla que citaba 10 844 casos y un trinquete de 96', () => {
    expect(TABLERO).not.toContain('**10 844 pasan')
    expect(TABLERO).not.toMatch(/lint-trinquete\.mjs` \| \*\*96\*\*/)
  })

  it('y el resultado de la corrida se llama FOTO, con su fecha', () => {
    /* Llamarlo «medido en este SHA» cuando no se vuelve a medir es la mentira
       que abrió este defecto. */
    expect(TABLERO).toMatch(/La foto de la última corrida/)
    expect(TABLERO).toMatch(/gana lo que sale hoy/)
    expect(TABLERO).toMatch(/Fecha de la foto/)
  })
})

describe('la línea entre lo derivado y lo escrito a mano está declarada', () => {
  it('el generador dice qué NO deriva, y por qué', () => {
    const g = generarCompuertas()
    expect(g).toMatch(/El RESULTADO de correr la suite no se deriva/)
    expect(g).toMatch(/algo que nadie ejecuta/)
  })

  it('el bloque derivado avisa de que no se edita a mano', () => {
    expect(generarCompuertas()).toMatch(/se DERIVAN/)
  })

  it('y deja constancia del defecto que lo originó, para que no vuelva a parecer trivial', () => {
    expect(generarCompuertas()).toMatch(/citaba un trinquete de 96 cuando llevaba días en 95/)
  })
})
