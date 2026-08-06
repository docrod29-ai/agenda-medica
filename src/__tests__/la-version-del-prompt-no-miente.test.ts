/**
 * LA VERSIÓN DEL PROMPT NO PUEDE QUEDARSE ATRÁS — REG-191.
 *
 * ── EL DEFECTO ───────────────────────────────────────────────────────────────
 *
 * `PROMPT_VERSION` se sella en cada nota y es lo único que permite responder a
 * la pregunta que importa cuando algo sale mal: **«¿qué notas se generaron con
 * el prompt que tenía el fallo?»**
 *
 * En la noche del 5 al 6 de agosto el prompt cambió **siete veces** y la versión
 * siguió diciendo `nota-2026-08`. Dos notas con la misma etiqueta podían venir
 * de prompts distintos, así que el lote afectado no se podía acotar.
 *
 * Y el único test que la miraba la **pineaba al literal**: subirla rompía la
 * suite. El candado estaba puesto justo del lado que impedía hacerlo bien.
 *
 * ── LO QUE HACE ESTA PRUEBA ──────────────────────────────────────────────────
 *
 * Calcula la huella de los archivos que le llegan al modelo y la compara con la
 * declarada. Si cambia el prompt y no la versión, se pone roja **con la huella
 * nueva en el mensaje**, para que subirla sea copiar y pegar.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import {
  PROMPT_VERSION, HUELLA_DEL_PROMPT, ARCHIVOS_DEL_PROMPT,
} from '@/lib/expediente/prompt-version'

/** La huella real de lo que hoy le llega al modelo. */
function huellaReal(): string {
  const h = createHash('sha256')
  for (const rel of ARCHIVOS_DEL_PROMPT) {
    h.update(rel)
    h.update(readFileSync(join(process.cwd(), rel), 'utf8'))
  }
  return h.digest('hex').slice(0, 16)
}

describe('el candado', () => {
  it('la huella declarada coincide con el prompt real', () => {
    const real = huellaReal()
    expect(
      HUELLA_DEL_PROMPT,
      `\n\n  El prompt cambió y la versión no.\n\n` +
      `  Versión actual: ${PROMPT_VERSION}\n` +
      `  Huella nueva:   ${real}\n\n` +
      `  Sube AMBAS en src/lib/expediente/prompt-version.ts.\n` +
      `  Copiar sólo la huella deja notas distintas con la misma etiqueta,\n` +
      `  que es exactamente el defecto que este candado existe para impedir.\n`,
    ).toBe(real)
  })

  it('vigila LAS DOS rutas por las que llegan instrucciones', () => {
    // `confianza-audio.ts` es por donde se coló REG-180: arreglar sólo el
    // prompt principal dejó viva la orden vieja por el otro lado.
    expect(ARCHIVOS_DEL_PROMPT).toContain('src/lib/expediente/prompts.ts')
    expect(ARCHIVOS_DEL_PROMPT).toContain('src/lib/expediente/confianza-audio.ts')
  })
})

describe('la versión dice algo útil', () => {
  it('lleva la fecha del cambio y un contador del día', () => {
    // En una noche de trabajo el prompt puede cambiar varias veces, y
    // `nota-2026-08` no distinguía entre la primera y la séptima.
    expect(PROMPT_VERSION).toMatch(/^nota-\d{4}-\d{2}-\d{2}-\d+$/)
  })

  it('ya no es la etiqueta de mes que duró siete cambios', () => {
    expect(PROMPT_VERSION).not.toBe('nota-2026-08')
  })
})

describe('la ruta la usa de verdad, no la declara y la ignora', () => {
  const ruta = readFileSync(
    join(process.cwd(), 'src/app/api/expediente/procesar/route.ts'), 'utf8',
  )

  it('la importa del módulo, no la redeclara', () => {
    // Redeclararla es cómo se desincronizó: el módulo y la ruta pueden decir
    // cosas distintas y nadie lo nota.
    expect(ruta).toContain("from '@/lib/expediente/prompt-version'")
    expect(ruta).not.toMatch(/^const PROMPT_VERSION = /m)
  })

  it('y la sella en la respuesta', () => {
    expect(ruta).toContain('_promptVersion: PROMPT_VERSION')
  })
})
