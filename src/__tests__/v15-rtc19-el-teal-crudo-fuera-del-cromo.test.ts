/**
 * RTC-19 — el teal escrito a mano no vive en el cromo que se ve siempre.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `#14b8a6` / `rgba(20,184,166,…)` es teal-500 escrito a mano: **no cambia con
 * el tema, no lo ve ningún token y no lo mide nadie**. El equipo rojo contó 67
 * literales por el árbol, y señaló dos como los que de verdad importan porque
 * viven en el **cromo persistente** —lo que está en pantalla en todas las
 * rutas, todo el día—:
 *
 *   · el halo del botón central del pulgar (`BottomNav`), con un teal distinto
 *     del que usa el propio círculo: dos teales que el médico no puede aprender;
 *   · el tinte de la cabecera del panel de ayuda (`BotonAyuda`).
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Panel de equipo rojo (RT-14). RTC-05 ya había matado el halo teal del FAB de
 * ayuda por esta misma razón; estos dos sobrevivieron porque viven en otros
 * archivos — la forma clásica de este repositorio: se arregla lo que se está
 * mirando y la copia de al lado se queda.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. **En el cromo persistente, cero teal crudo.** El color de acento sale de
 *    `var(--nexus)` / `var(--nexus-solido)`, o de un `color-mix` sobre ellos.
 * 2. **La elevación la da la sombra del sistema** (`var(--elev-2)`), medida en
 *    los dos temas. El color de la acción ya lo pone el fondo del círculo: no
 *    hace falta repetirlo en el halo.
 * 3. El trinquete de diseño cuenta los halos de color y **bajó al hacerlo**
 *    (8 → 7): la deuda no se declara, se retira.
 *
 * Probado al revés: devolviendo `rgba(20,184,166,0.45)` al halo falla el caso
 * 1; devolviendo el tinte crudo a la cabecera de ayuda falla el 2.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **Los ~74 literales restantes del árbol.** Están fuera del cromo —
 *   documentos de receta, pantallas de negocio, ilustraciones— y muchos son
 *   colores de impresión, donde un token puede no resolverse. Barrerlos es
 *   otra rebanada, y hacerlo a ciegas rompería justo esos casos. Este guardián
 *   protege el cromo, que es donde el defecto se ve todo el día.
 * · No comprueba contraste: `--nexus-solido` documenta el suyo en globals.css.
 * · No cubre el tema claro en navegador — eso es el arnés.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

/** Sin comentarios: esta cabecera CITA el literal para explicarlo. */
const sinComentarios = (s: string) => s
  .split('\n').filter(l => !l.trimStart().startsWith('//')).join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')

/** El cromo que está en pantalla en TODAS las rutas. */
const CROMO = [
  'src/components/FlowRail.tsx',
  'src/components/BottomNav.tsx',
  'src/components/BotonAyuda.tsx',
  'src/components/InstrumentStrip.tsx',
] as const

const TEAL_CRUDO = /#14b8a6|rgba?\(\s*20\s*,\s*184\s*,\s*166/i

describe('RTC-19 — cero teal escrito a mano en el cromo persistente', () => {
  it.each(CROMO)('1 · %s no pinta teal-500 crudo', (ruta) => {
    expect(sinComentarios(leer(ruta))).not.toMatch(TEAL_CRUDO)
  })

  it('2 · el tinte del panel de ayuda habla color-mix sobre el token', () => {
    expect(leer('src/components/BotonAyuda.tsx'))
      .toContain('color-mix(in srgb, var(--nexus) 6%, transparent)')
  })

  it('3 · el halo del pulgar usa la sombra del sistema, no un color', () => {
    // La elevación está medida en los dos temas; el color de la acción ya lo
    // pone el fondo del círculo (`--nexus-solido`).
    const nav = leer('src/components/BottomNav.tsx')
    expect(nav).toMatch(/boxShadow: 'var\(--elev-2\)', border: '3px solid var\(--s1\)'/)
    expect(nav).toContain("background: 'var(--nexus-solido)'")
  })
})
