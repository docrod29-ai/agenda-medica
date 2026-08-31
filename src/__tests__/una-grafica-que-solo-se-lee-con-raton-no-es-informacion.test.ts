/**
 * GOLDEN — la gráfica de ingresos se lee sin ratón.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * «Ingresos por día» pintaba una barra por día del periodo y las cifras vivían
 * **únicamente en `title=`**. Eso significa que no existían:
 *
 *   · en una tableta, donde no hay hover;
 *   · para un lector de pantalla (sin `role`, sin `aria-label`, sin tabla
 *     alternativa);
 *   · para quien mira la pantalla desde un metro.
 *
 * El médico veía nueve barras y no podía saber cuánto vale ninguna. Nueve
 * barras sin escala son una textura, no un dato.
 *
 * ── CÓMO SE DESCUBRIÓ, Y POR QUÉ NO ANTES ───────────────────────────────────
 *
 * Sondeando el DOM de la gráfica en el build de producción. No había salido
 * antes porque la siembra **no tenía cobros**: `/finanzas` salía entera a
 * `$0.00`, con la gráfica vacía. Una pantalla sin datos esconde justo los
 * defectos que sólo aparecen con datos. Es la misma trampa que el día sin citas
 * de la unidad 23 — por eso la siembra ahora trae doce cobros con forma real:
 * varios métodos, un reembolso, un importe de cinco cifras junto a otros de
 * tres, y días vacíos entre medias para que la gráfica tenga relieve.
 *
 * ── CAUSA RAÍZ ──────────────────────────────────────────────────────────────
 *
 * Misma familia que el estado de la cita (unidad 18): el dato **existía** y
 * llegaba por un canal que no alcanza a todos. `title` es un canal de puntero.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * Una gráfica declara su ESCALA a la vista, y cada dato entra en el árbol
 * accesible. Si sólo se puede leer posando el ratón, no es información: es
 * decoración con números dentro.
 *
 * ── LO QUE SE DECIDIÓ NO HACER ──────────────────────────────────────────────
 *
 * No se pinta el importe encima de cada barra. Con 31 días eso es un muro de
 * cifras de 8 px: cambiar ilegible por ilegible. El techo arriba deja leer
 * cualquier barra por proporción, y el detalle sigue al posarse.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Quitando el `aria-label` de la barra cae el primero; quitando la línea del
 * máximo, el segundo; devolviendo la siembra a cero cobros, el de la siembra.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · Escáner de fuente: no prueba que un lector real lo recorra en orden útil.
 * · No cubre las otras gráficas de la aplicación (laboratorio, CRM). Que ésta
 *   esté bien no dice nada de ellas.
 * · No juzga si una gráfica de barras es la representación correcta.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const SRC = readFileSync('src/app/(dashboard)/finanzas/page.tsx', 'utf8')
const cuerpo = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')

describe('una gráfica que sólo se lee con ratón no es información', () => {
  it('cada barra entra en el árbol accesible, no sólo en el title', () => {
    const i = cuerpo.indexOf('serieDias.map')
    expect(i).toBeGreaterThan(-1)
    const barra = cuerpo.slice(i, i + 1400)
    expect(barra).toContain('aria-label={dicho}')
    expect(barra).toContain('role="listitem"')
    // Y el contenedor dice qué es la lista.
    expect(cuerpo.slice(Math.max(0, i - 600), i)).toContain('role="list"')
  })

  it('la escala se declara a la vista', () => {
    // Sin el techo, ninguna barra se puede leer por proporción.
    expect(cuerpo).toMatch(/máx\. \{fmtMXN\(maxDia\)\}/)
  })

  it('un día sin cobros lo dice, en vez de sonar como cero pesos ambiguo', () => {
    expect(cuerpo).toContain('sin cobros')
  })

  it('«1 cobro» no se dice en plural', () => {
    const i = cuerpo.indexOf('serieDias.map')
    expect(cuerpo.slice(i, i + 1400)).toMatch(/d\.n === 1 \? 'cobro' : 'cobros'/)
  })

  it('la siembra trae cobros: sin ellos esta pantalla no se puede auditar', () => {
    const semilla = readFileSync('scripts/design/sembrar-emulador.mjs', 'utf8')
    const bloque = semilla.slice(semilla.indexOf('const COBROS = ['), semilla.indexOf(']\n', semilla.indexOf('const COBROS = [')))
    const montos = [...bloque.matchAll(/monto:\s*(-?\d+)/g)].map(m => Number(m[1]))
    expect(montos.length, 'la siembra declara cobros').toBeGreaterThanOrEqual(10)
    // Con forma real, no un relleno plano:
    expect(montos.some(m => m < 0), 'hay un reembolso').toBe(true)
    expect(Math.max(...montos) / Math.min(...montos.filter(m => m > 0)), 'hay rango de magnitudes').toBeGreaterThan(5)
  })

  it('el periodo se elige y se recorre en UNA fila, no en dos regiones', () => {
    // Era un segmentado y, debajo, una tarjeta a todo lo ancho cuyo contenido
    // entero era una etiqueta y dos flechas.
    expect(cuerpo).not.toMatch(/Navegación dentro del periodo/)
    const i = cuerpo.indexOf('PERIODO_LABEL[p]')
    const j = cuerpo.indexOf('etiquetaPeriodo(periodo, ancla)')
    expect(i).toBeGreaterThan(-1)
    expect(j).toBeGreaterThan(i)
    // Y están en el mismo contenedor: entre uno y otro no se abre una tarjeta.
    expect(cuerpo.slice(i, j)).not.toMatch(/border: '1px solid var\(--border\)', borderRadius: 10/)
  })
})
