/**
 * GOLDEN — un diálogo sin teclado no es un diálogo, es una trampa.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `BotonAyuda` —el panel del asistente— se pintaba con `role="dialog"` y **sin
 * una sola línea de teclado**: ni Escape, ni foco inicial, ni foco devuelto.
 *
 * Medido en el navegador el 30-ago, en `/citas`:
 *
 *     foco entra: false · sigue abierto tras Escape: sí
 *
 * Quien usa teclado o lector de pantalla pulsaba «Ayuda» y el panel se abría
 * **sin que el foco se moviera**: para él la ayuda no había ocurrido. Y para
 * quitársela de encima tenía que tabular a ciegas hasta la aspa, porque Escape
 * no hacía nada.
 *
 * La regla de diseño de este repositorio lo nombra literalmente entre los
 * mínimos que fallan la compuerta: «modal que no atrapa el foco ni cierra con
 * Escape».
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Buscando qué requisito del encargo no medía nadie. El arnés de foco mira los
 * campos de formulario; los diálogos no los miraba ninguno. Se listaron los
 * ocho `role="dialog"` del producto y se preguntó cuáles usaban
 * `useDialogoDeTeclado`. Siete sí. Éste no.
 *
 * No era una decisión: el panel se escribió **antes** de que el gancho
 * existiera, y cuando las cinco conductas se sacaron de `ui/Modal` a un sitio
 * común, éste se quedó atrás. La familia de siempre — la lección aprendida en un
 * componente y no en el de al lado.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Todo lo que se pinte con `role="dialog"` gobierna su teclado, y lo hace con
 * `useDialogoDeTeclado` — que es donde viven las cinco conductas y sus dos
 * excepciones legítimas. Escribirlas otra vez a mano es cómo apareció esto.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Devolviendo `BotonAyuda` a su versión anterior y recompilando,
 * `npm run arnes:dialogos-teclado` marca FALLA en el panel de ayuda —«el foco NO
 * entra · Escape NO lo cierra»— y deja la paleta en verde, así que discrimina.
 * El caso de aquí abajo cae con el mismo cambio.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No comprueba comportamiento**: que el gancho esté llamado no prueba que
 *   el `ref` llegue al elemento. Eso lo mide el arnés, abriendo el diálogo — y
 *   sólo para los dos que sabe abrir.
 * · **No mide la trampa de foco** (que Tab no se escape): pide contar
 *   tabulaciones y es otra medición.
 * · Un diálogo escrito con `role={'dialog'}` o con la cadena partida se le
 *   escapa. Se acepta: la forma literal es la que usa todo el producto hoy.
 * · No sabe de diálogos nativos (`<dialog>`), que el producto no usa.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const sinComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*/g, '')

function tsx(dir: string, salida: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) tsx(p, salida)
    else if (e.endsWith('.tsx')) salida.push(p)
  }
  return salida
}

/**
 * `ui/Modal` es la primitiva: ella misma llama al gancho, así que quien la use
 * ya lo tiene. Se la excluye por nombre y no por heurística.
 */
const LA_PRIMITIVA = join('src', 'components', 'ui', 'Modal.tsx')

describe('todo diálogo tiene teclado', () => {
  const archivos = [...tsx(join('src', 'components')), ...tsx(join('src', 'app'))]

  it('hay diálogos que mirar — si no, este caso no vigila nada', () => {
    const conDialogo = archivos.filter(f => sinComentarios(readFileSync(f, 'utf8')).includes('role="dialog"'))
    expect(conDialogo.length, 'ya no hay ningún `role="dialog"`: este guardián dejó de aplicar').toBeGreaterThan(2)
  })

  it('EL DEFECTO: ningún `role="dialog"` se queda sin gobernar su teclado', () => {
    const mudos: string[] = []
    for (const f of archivos) {
      const src = sinComentarios(readFileSync(f, 'utf8'))
      if (!src.includes('role="dialog"')) continue
      if (f === LA_PRIMITIVA) continue
      if (src.includes('useDialogoDeTeclado')) continue
      mudos.push(f)
    }
    expect(
      mudos,
      'estos diálogos se pintan con `role="dialog"` y no gobiernan su teclado: '
        + 'se abren sin llevarse el foco y Escape no los cierra\n' + mudos.join('\n'),
    ).toEqual([])
  })
})
