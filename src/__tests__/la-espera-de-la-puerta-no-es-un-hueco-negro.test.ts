/**
 * GOLDEN — las dos puertas del producto esperaban en negro.
 *
 * ── QUÉ FALLABA, Y CÓMO SE DESCUBRIÓ ────────────────────────────────────────
 *
 * Leyendo las dos puertas después de mirar `/login` servido. `/login` y
 * `/registro` tenían tres esperas y las tres eran huecos:
 *
 *     <Suspense fallback={<div style={{ minHeight: '100vh',
 *                                       background: 'var(--bg)' }} />}>
 *
 * — un `<div>` negro de alto de pantalla, en las dos — y la comprobación de
 * sesión de `/login`, un aspa girando en medio de la nada sin decir qué se
 * esperaba.
 *
 * ── POR QUÉ IMPORTA MÁS DE LO QUE PARECE ────────────────────────────────────
 *
 * Ese `fallback` es lo que ve **quien tiene mala conexión**, que es justo quien
 * menos tolera una pantalla en negro: no distingue «cargando» de «se rompió», y
 * recarga. Y para un lector de pantalla, un hueco sin `role="status"` es
 * sencillamente una página vacía: no hay nada que anunciar.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * Un hueco de espera (1) ocupa el sitio de lo que va a llegar, para que al
 * llegar no empuje nada; (2) dice qué se está esperando; (3) lo dice también
 * a quien no ve la pantalla.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Con el árbol anterior, `las dos puertas usan el mismo hueco` falla en las dos
 * (el `fallback` era el `<div>` negro), y `dice qué está esperando` no tiene
 * ni componente que renderizar.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No mide el salto de layout.** Que las alturas del esqueleto sean las del
 *   formulario real está escrito y comentado, no medido: comprobarlo de verdad
 *   pide dos capturas del navegador con la red frenada, y la comprobación de
 *   sesión de Firebase no se deja frenar desde fuera (se resuelve contra
 *   IndexedDB, no contra la red). Queda declarado como lo que es: una decisión
 *   verificada por lectura.
 * · **No pone tope de tiempo.** Si la comprobación no termina nunca, el hueco
 *   gira para siempre. Decir «esto está tardando de más» exige un umbral
 *   medido, y no lo hay.
 * · No cubre las esperas del interior de la aplicación — sólo las dos puertas.
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { EsperaDeLaPuerta } from '@/components/landing/EsperaDeLaPuerta'

const leer = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')

describe('la espera de la puerta no es un hueco negro', () => {
  it('dice qué está esperando, y lo dice distinto según qué sea', () => {
    const preparando = renderToStaticMarkup(createElement(EsperaDeLaPuerta))
    const comprobando = renderToStaticMarkup(createElement(EsperaDeLaPuerta, { comprobando: true }))
    expect(preparando).toContain('Preparando el acceso')
    expect(comprobando).toContain('Comprobando tu sesión')
    // Y no son el mismo texto: el estado que se conoce se nombra.
    expect(preparando).not.toContain('Comprobando tu sesión')
  })

  it('lo dice también a quien no ve la pantalla', () => {
    const html = renderToStaticMarkup(createElement(EsperaDeLaPuerta))
    expect(html, 'un esqueleto mudo es, para un lector, una página vacía').toContain('role="status"')
    expect(html).toContain('aria-busy="true"')
  })

  it('ocupa el sitio de lo que va a llegar, no un aspa en el vacío', () => {
    const html = renderToStaticMarkup(createElement(EsperaDeLaPuerta))
    // La misma columna y la misma tarjeta que el formulario real.
    expect(html).toContain('nx-puerta-columna')
    expect(html).toContain('nx-puerta-tarjeta')
    // Cinco huesos con alto propio: los del formulario, no un bloque genérico.
    expect((html.match(/nx-puerta-hueso/g) ?? []).length).toBe(5)
  })

  it('las dos puertas usan el mismo hueco — ninguna vuelve al div en negro', () => {
    for (const puerta of ['src/app/login/page.tsx', 'src/app/registro/page.tsx']) {
      const src = leer(puerta)
      expect(src, `${puerta} no usa el hueco compartido`).toContain('<EsperaDeLaPuerta')
      expect(
        src.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' '),
        `${puerta} volvió a esperar en negro`,
      ).not.toMatch(/fallback=\{<div/)
    }
  })

  it('el giro sale del sistema, no de un @keyframes por pantalla', () => {
    const css = leer('src/app/globals.css')
    expect(css).toContain('@keyframes nx-gira')
    expect(renderToStaticMarkup(createElement(EsperaDeLaPuerta))).toContain('nx-gira')
  })
})

describe('la puerta pertenece al mismo producto que la portada', () => {
  it('el logotipo lleva a la portada — era el enlace que todos intentan y no estaba', () => {
    const login = leer('src/app/login/page.tsx')
    expect(login).toMatch(/<Link href="\/" className="nx-puerta-volver"/)
    expect(login).toMatch(/aria-label="Ausculta — volver al inicio"/)
  })

  it('y promete lo mismo que la portada, no el posicionamiento retirado', () => {
    const login = leer('src/app/login/page.tsx')
    const heroe = leer('src/components/landing/HeroConsulta.tsx')
    // La promesa de hoy, la misma frase en las dos superficies.
    expect(login).toContain('Sal de la consulta con la nota hecha')
    expect(heroe).toContain('Sal de la consulta')
  })

  /**
   * EL POSICIONAMIENTO RETIRADO NO SOBREVIVE EN NINGUNA SUPERFICIE.
   *
   * Buscándolo se encontró que vivía en tres sitios más, y de los caros: la
   * `description` de `layout.tsx` —la que Google enseña en los resultados—, la
   * del manifiesto de la PWA —la que se ve al instalar la aplicación— y el
   * subtítulo de `/registro`. Las tres escritas a mano.
   *
   * Causa raíz: no había constante a la que apuntar. `LEMA` sí existía y sí
   * decía la verdad, pero sólo lo usaba `openGraph.description`; los otros tres
   * papeles no tenían fuente de verdad, así que copiaron del vecino. Es la
   * misma familia que el acento sin token.
   *
   * Los comentarios se saltan a propósito: documentar la frase retirada —decir
   * qué se quitó y por qué— es correcto, y es lo que impide que vuelva por
   * descuido. Sin descomentar, esta prueba se cazaría a sí misma.
   */
  it('el posicionamiento retirado no sobrevive en ninguna superficie', () => {
    const RETIRADO = 'El consultorio, conectado'
    const culpables: string[] = []
    for (const archivo of [
      'src/app/login/page.tsx',
      'src/app/registro/page.tsx',
      'src/app/page.tsx',
      'src/app/layout.tsx',
      'src/app/manifest.ts',
      'src/app/opengraph-image.tsx',
      'src/lib/marca.ts',
    ]) {
      const limpio = leer(archivo)
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/^\s*\/\/.*$/gm, ' ')
      if (limpio.includes(RETIRADO)) culpables.push(archivo)
    }
    expect(culpables, `siguen prometiendo lo retirado: ${culpables.join(', ')}`).toEqual([])
  })

  /**
   * Y la frase de hoy tiene UNA fuente. Un guardián que sólo prohibiera la
   * frase vieja dejaría escribir tres versiones distintas de la nueva, que es
   * exactamente cómo se llegó aquí.
   */
  it('la descripción del producto sale de una constante, no de tres copias', () => {
    const marca = leer('src/lib/marca.ts')
    expect(marca).toMatch(/export const DESCRIPCION\b/)
    expect(leer('src/app/layout.tsx')).toContain('description: DESCRIPCION')
    expect(leer('src/app/manifest.ts')).toContain('description: DESCRIPCION')
  })
})
