/**
 * GUARDIÁN — el tablero que se LEE no puede omitir las metas que el §1 manda conservar.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * El §1 del pliego del dueño (`docs/ai/AUSCULTA-MASTER-COMPLETION-LOOP.md`)
 * ordena «conservar los objetivos: 15k / 20k / 30k / 50k / 100k usuarios» y
 * «10k / 20k / 30k / 50k pacientes por médico», y da la razón: *ningún
 * requisito puede desaparecer simplemente porque cambió el documento*.
 *
 * El censo (`src/lib/programa/requisitos.ts`) los tenía todos, con estado y
 * evidencia, vigilados por `el-programa-no-pierde-requisitos.test.ts`.
 * `docs/product/AUSCULTA-MASTER-BOARD.md` —el tablero que lee una persona, del
 * que salen las notas de PR y el `FINAL-READINESS`— nombraba **dos de los
 * once**: `100 k` y `50 000`, una vez cada uno. 15k, 20k y 30k no aparecían.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * El 30-ago-2026, contando menciones en el tablero al medir los carriles contra
 * los pliegos recién guardados en `docs/ai/`.
 *
 * Y la primera conclusión fue **falsa**: se dijo que el programa había perdido
 * los requisitos. No los había perdido. Los tenía donde una persona no los ve.
 * Queda escrito en `docs/audit/carriles-contra-su-pliego-2026-08-30.md` porque
 * una acusación equivocada que se borra en silencio se vuelve a hacer.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Dos representaciones del mismo programa —una que lee la máquina y otra que
 * lee la persona— **sin nada que las ate**, y la incompleta era la que se lee
 * en voz alta. Mantenerlas iguales dependía de que alguien se acordara de
 * copiar: el patrón `depende_de_recordar`, el mismo de REG-241.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Lo derivable se deriva. El bloque marcado del tablero se construye desde el
 * censo (el propio censo), lo escribe
 * `scripts/product/censo-al-tablero.mjs`, y este guardián falla si el tablero
 * se queda atrás. El censo sigue siendo la ÚNICA fuente de verdad; el tablero
 * es su sombra impresa, no una segunda copia que mantener.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No comprueba que un estado sea verdad.** Que `WS-02.registrados-100000`
 *   diga `BLOCKED_EXTERNAL` lo vigila el guardián del censo, no éste.
 * · **No vigila la prosa escrita a mano.** Si alguien borra la tabla de P0 que
 *   está fuera de las marcas, esto pasa en verde. Sólo ata el bloque derivado.
 * · **No demuestra que alguien lo lea.** Que la meta esté impresa no significa
 *   que se haya mirado; significa que no se puede decir que no estaba.
 * · **No cubre el otro pliego.** Product Excellence tiene su propio tablero y
 *   su propio carril (§20 del pliego, §33 del otro): aquí no se toca.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  bloqueDelCenso, MARCA_INICIO, MARCA_FIN,
  USUARIOS_REGISTRADOS, PACIENTES_POR_MEDICO, DOMINIOS_CANONICOS,
} from '@/lib/programa/requisitos'

const TABLERO = 'docs/product/AUSCULTA-MASTER-BOARD.md'
const tablero = readFileSync(TABLERO, 'utf8')

describe('el tablero enseña las metas del §1', () => {
  it('el bloque derivado existe y está al día', () => {
    const i = tablero.indexOf(MARCA_INICIO)
    const f = tablero.indexOf(MARCA_FIN)
    expect(i, `${TABLERO} perdió la marca de inicio del bloque derivado`).toBeGreaterThan(-1)
    expect(f, `${TABLERO} perdió la marca de fin del bloque derivado`).toBeGreaterThan(i)

    const enElTablero = tablero.slice(i, f + MARCA_FIN.length)
    expect(
      enElTablero,
      'el tablero se quedó atrás respecto del censo — corre: npx tsx scripts/product/censo-al-tablero.mjs',
    ).toBe(bloqueDelCenso())
  })

  it('cada escalón de usuarios registrados está IMPRESO, no sólo en el código', () => {
    /**
     * Éste es el caso que habría cazado el defecto. No mira el bloque: mira el
     * documento entero, para que siga valiendo si mañana el bloque se sustituye
     * por prosa escrita a mano.
     */
    const ausentes = USUARIOS_REGISTRADOS.filter(n => !tablero.includes(`WS-02.registrados-${n}`))
    expect(
      ausentes,
      'metas de usuarios registrados que el §1 manda conservar y el tablero no nombra',
    ).toEqual([])
  })

  it('cada escalón de pacientes por médico está IMPRESO', () => {
    const ausentes = PACIENTES_POR_MEDICO.filter(n => !tablero.includes(`WS-03.pacientes-${n}`))
    expect(ausentes, 'metas de pacientes por médico que el tablero no nombra').toEqual([])
  })

  it('los 21 dominios canónicos se nombran en el tablero', () => {
    const ausentes = DOMINIOS_CANONICOS.filter(d => !tablero.includes(d))
    expect(ausentes, 'dominios del §1 que el tablero no nombra').toEqual([])
  })

  it('las once metas son once, y no se pueden vaciar renombrándolas', () => {
    /* Un guardián de listas falla quedándose sin lista. */
    expect(USUARIOS_REGISTRADOS.length).toBe(7)
    expect(PACIENTES_POR_MEDICO.length).toBe(4)
    for (const n of [15_000, 20_000, 30_000]) {
      expect(USUARIOS_REGISTRADOS, `${n} es una meta del §1 y desapareció del censo`).toContain(n)
    }
  })
})
