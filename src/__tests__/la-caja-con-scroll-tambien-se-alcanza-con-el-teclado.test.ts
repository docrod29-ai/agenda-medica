/**
 * GOLDEN — una caja que hace scroll y no recibe foco deja fuera al teclado.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * axe (`scrollable-region-focusable`, impacto **serio**) marcó en los tres
 * anchos la conversación de ejemplo de WhatsApp de la portada:
 *
 *     <div style="max-height: 360px; overflow-y: auto"> … </div>
 *
 * Es una caja con scroll propio y **ningún control dentro**, así que no había
 * nada que pudiera recibir el foco: con ratón o con dedo se lee la conversación
 * entera, y con teclado sólo se ve el primer trozo. No hay forma de llegar al
 * resto. Es WCAG 2.1.1 (Teclado).
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Pasando axe-core sobre los recorridos de este carril a 390 / 768 / 1440. Era
 * la ÚNICA violación de las cuatro superficies públicas, y salía en las tres
 * anchuras.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * Un contenedor con scroll propio necesita `tabIndex={0}` para poder recorrerse
 * con las flechas, y un nombre para que el lector diga qué es lo que se está
 * recorriendo. Sin el nombre, el teclado llega a una caja anónima.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - Es un guardián de fuente sobre la portada. Otras cajas con scroll de la
 *   aplicación no están en esta lista; la barrida de axe del carril
 *   (`scripts/carril-excelencia/axe-recorridos.mjs`) es la que las vería.
 * - No comprueba que las flechas desplacen de verdad: eso lo hace el navegador
 *   por el hecho de tener foco, y se vio en la corrida.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const PORTADA = readFileSync(join(process.cwd(), 'src/app/page.tsx'), 'utf8')

describe('la conversación de ejemplo se puede recorrer con el teclado', () => {
  /**
   * El bloque que abre el `div` de los mensajes, SIN COMENTARIOS.
   *
   * Escrita sin ese descomentado, esta prueba pasaba en verde con el
   * `tabIndex` borrado: el comentario que explica el arreglo también contiene
   * la cadena `tabIndex={0}`, y `toContain` no distingue código de prosa. Es
   * el mismo tropiezo que ya cazó el guardián de las mayúsculas, y por eso se
   * deja escrito aquí.
   */
  const etiqueta = (() => {
    const limpio = PORTADA
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
    const k = limpio.indexOf('maxHeight: 360')
    expect(k, 'no se encontró la caja de mensajes').toBeGreaterThan(-1)
    const i = limpio.lastIndexOf('<div', k)
    const j = limpio.indexOf('>', k)
    return limpio.slice(i, j)
  })()

  it('recibe el foco', () => {
    expect(etiqueta, 'la caja con scroll no es alcanzable con Tab').toContain('tabIndex={0}')
  })

  it('y dice qué es — si no, el teclado llega a una caja anónima', () => {
    expect(etiqueta).toContain('role="region"')
    expect(etiqueta).toMatch(/aria-label="[^"]{10,}"/)
  })

  it('sigue teniendo scroll propio: el arreglo no fue quitarle el scroll', () => {
    // Prueba al revés por el otro lado: si alguien «arregla» esto quitando el
    // `overflow`, la conversación se corta y el defecto se cambia por otro.
    expect(etiqueta).toContain('maxHeight: 360')
    expect(etiqueta).toContain("overflowY: 'auto'")
  })
})
