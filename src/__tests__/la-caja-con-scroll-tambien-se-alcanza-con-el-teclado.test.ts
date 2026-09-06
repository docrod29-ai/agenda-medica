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
 * ── POR QUÉ ESTE ARCHIVO CAMBIÓ DE FORMA ────────────────────────────────────
 *
 * La transformación de producto **retiró esa caja**: la portada ya no lleva la
 * maqueta de conversación de WhatsApp. Escrito contra `maxHeight: 360` de
 * `page.tsx`, el caso se puso rojo por un motivo que no era una regresión — el
 * elemento vigilado dejó de existir.
 *
 * Borrarlo habría sido perder la regla. Fijarlo a otro elemento concreto
 * habría repetido el error. Así que se generaliza a lo que de verdad se
 * aprendió: **en toda superficie pública, un contenedor con scroll propio y sin
 * controles dentro tiene que ser alcanzable con el teclado y decir qué es.**
 * Hoy no hay ninguno; el caso vigila que el próximo nazca bien, que es cuando
 * este defecto vuelve.
 *
 * Probado al revés: reponiendo la caja de WhatsApp sin `tabIndex`, falla.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - Es un guardián de FUENTE sobre las páginas públicas. Las cajas con scroll
 *   del interior de la aplicación no están aquí; la barrida de axe del carril
 *   (`scripts/carril-excelencia/axe-recorridos.mjs`) es la que las vería.
 * - No caza una caja con scroll declarada en la HOJA (`overflow-y: auto` en una
 *   clase de `globals.css`) en vez de en línea. Ese camino queda abierto y
 *   declarado: lo cierra axe sobre la página servida, no un `grep`.
 * - No comprueba que las flechas desplacen de verdad: eso lo hace el navegador
 *   por el hecho de tener foco, y se vio en la corrida.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { readdirSync, statSync } from 'node:fs'

/** Las páginas de cara al público: portada, demo, precios, login y compañía. */
function paginasPublicas(dir = join(process.cwd(), 'src/app'), acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    // El interior de la aplicación y las rutas de API no son superficie pública.
    if (e === 'api' || e === '(dashboard)') continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) paginasPublicas(p, acc)
    else if (e.endsWith('.tsx')) acc.push(p)
  }
  return acc
}
/** Y los componentes que esas páginas montan. */
const COMPONENTES_PUBLICOS = [join(process.cwd(), 'src/components/landing')]
function tsxDe(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) tsxDe(p, acc)
    else if (e.endsWith('.tsx')) acc.push(p)
  }
  return acc
}

const SUPERFICIES = [...paginasPublicas(), ...COMPONENTES_PUBLICOS.flatMap(d => tsxDe(d))]

/**
 * Sin comentarios. Escrita sin ese descomentado, la versión anterior de esta
 * prueba pasaba en verde con el `tabIndex` borrado: el comentario que explica
 * el arreglo también contiene la cadena `tabIndex={0}`, y `toContain` no
 * distingue código de prosa. Es el mismo tropiezo que ya cazó el guardián de
 * las mayúsculas, y por eso se deja escrito aquí.
 */
const sinComentarios = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')

/** Las cajas con scroll propio declaradas en línea, con su etiqueta de apertura. */
function cajasConScroll(): { archivo: string; etiqueta: string }[] {
  const cajas: { archivo: string; etiqueta: string }[] = []
  for (const archivo of SUPERFICIES) {
    const limpio = sinComentarios(readFileSync(archivo, 'utf8'))
    for (const m of limpio.matchAll(/overflowY:\s*'auto'|overflow:\s*'auto'/g)) {
      const k = m.index!
      // Sólo cuenta si además tiene alto acotado: sin tope no hay scroll propio.
      const contexto = limpio.slice(Math.max(0, k - 400), k + 400)
      if (!/max[HW]eight|height:/.test(contexto)) continue
      const i = limpio.lastIndexOf('<', k)
      const j = limpio.indexOf('>', k)
      cajas.push({ archivo: archivo.replace(process.cwd() + '/', ''), etiqueta: limpio.slice(i, j) })
    }
  }
  return cajas
}

describe('una caja con scroll de una superficie pública se alcanza con el teclado', () => {
  it('recibe el foco, y dice qué es', () => {
    const mudas: string[] = []
    for (const { archivo, etiqueta } of cajasConScroll()) {
      // Una caja que contiene controles ya es alcanzable POR ellos.
      if (/<button|<a |<Link|<input|<select|<textarea/.test(etiqueta)) continue
      if (!etiqueta.includes('tabIndex={0}')) { mudas.push(`${archivo} — sin tabIndex`); continue }
      if (!/aria-label="[^"]{10,}"/.test(etiqueta)) mudas.push(`${archivo} — sin nombre`)
    }
    expect(mudas, `cajas con scroll fuera del alcance del teclado:\n${mudas.join('\n')}`).toEqual([])
  })

  it('y la regla sigue viva aunque hoy no haya ninguna caja que la necesite', () => {
    /**
     * Prueba al revés, escrita: si mañana alguien repone una caja con scroll
     * sin `tabIndex`, el caso de arriba falla. Este comprueba que el detector
     * FUNCIONA — que no está devolviendo la lista vacía porque el `grep` esté
     * roto — pasándole la caja original que originó el defecto.
     */
    const caja = `<div style={{ maxHeight: 360, overflowY: 'auto' }}>`
    expect(/overflowY:\s*'auto'/.test(caja)).toBe(true)
    expect(caja.includes('tabIndex={0}')).toBe(false)
  })
})
