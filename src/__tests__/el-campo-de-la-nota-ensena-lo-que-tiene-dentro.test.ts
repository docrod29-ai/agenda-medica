/**
 * GOLDEN — el campo donde se escribe la nota no es una rendija.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Escribiendo un padecimiento actual de tamaño normal para una primera vez, el
 * campo se quedaba en **70 px enseñando 602 px de texto** en escritorio, y en
 * **73 px de 2 887 px** a 390. El médico relee lo que escribió —o lo que le
 * dictó a la IA— por una ventana de tres renglones.
 *
 * Y el peor momento es el que más importa: **justo antes de firmar**, cuando lo
 * que toca es leer la nota entera.
 *
 * `resize: vertical` no lo salvaba. En un teléfono no hay tirador que arrastrar.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Yendo a por la columna «long content» de la matriz del encargo, que estaba
 * NOT_PROVEN. Se llenó una sección narrativa con catorce párrafos y una palabra
 * impronunciable de 96 letras, y se midió alto contra contenido a 1440 y a 390.
 * De paso quedó dicho lo que **ya estaba bien**: nada se sale de lado, ni con la
 * palabra sin cortes ni con el nombre compuesto más largo que admite un registro
 * civil mexicano, que el arnés siembra a propósito.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * El campo crece con lo que tiene dentro, hasta un tope, y a partir de ahí hace
 * su propio scroll. El tope existe para que una nota larga no empuje los botones
 * de firmar fuera de la pantalla.
 *
 * Y el alto se recalcula **con el valor**, no sólo al teclear: estas secciones
 * las rellena la IA al estructurar la nota, sin que nadie pulse una tecla. Si
 * sólo creciera al escribir, el caso que trajo el defecto —una nota dictada,
 * larga, que aparece de golpe— seguiría igual. Ése es el detalle que este caso
 * vigila y el que es fácil perder en una refactorización.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Quitando el ajuste de alto, `npm run arnes:texto-largo` marca RENDIJA en los
 * dos anchos (70 px de 478 px, y 73 px de 2 272 px). Aquí abajo caen los casos
 * que piden el recálculo.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No mide píxeles**: eso es del arnés, con navegador. Esto vigila que la
 *   pieza siga existiendo y siga dependiendo del valor.
 * · No cubre los demás campos de la consulta —diagnósticos, medicamentos— que
 *   son de una línea y no tienen este problema.
 * · No dice nada de otras pantallas con texto libre (adendas, comentarios).
 * · No juzga si el 60 % de la ventana es el tope correcto.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Sin comentarios: un caso que se satisface con su propia prosa no prueba nada. */
const sinComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*/g, '')

const UI = sinComentarios(readFileSync(join('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'consulta-ui.tsx'), 'utf8'))
const PAGE = sinComentarios(readFileSync(join('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx'), 'utf8'))

describe('el campo de la nota enseña lo que tiene dentro', () => {
  it('las secciones narrativas usan el campo que crece, no un textarea a pelo', () => {
    expect(PAGE, 'las secciones narrativas volvieron a un textarea de alto fijo')
      .toContain('<CampoNarrativo')
  })

  it('el alto se recalcula, y `auto` va primero para que sepa ENCOGER', () => {
    const i = UI.indexOf('export function CampoNarrativo')
    expect(i, 'CampoNarrativo desapareció').toBeGreaterThan(-1)
    const cuerpo = UI.slice(i, i + 900)
    expect(cuerpo, 'sin `height = auto` el campo sólo sabría crecer').toMatch(/style\.height = 'auto'/)
    expect(cuerpo, 'el alto tiene que salir del contenido').toContain('scrollHeight')
  })

  it('EL DETALLE QUE SE PIERDE AL REFACTORIZAR: depende del VALOR, no del tecleo', () => {
    // La IA rellena estas secciones sin que nadie pulse una tecla. Si el
    // recálculo colgara de `onChange`, ese caso —el que trajo el defecto—
    // volvería intacto.
    const i = UI.indexOf('export function CampoNarrativo')
    const cuerpo = UI.slice(i, i + 900)
    expect(cuerpo, 'el recálculo dejó de depender del valor').toMatch(/\[props\.valor\]|\[valor\]/)
  })

  it('hay un tope, para que una nota larga no eche los botones de firmar de la pantalla', () => {
    const i = UI.indexOf('export function CampoNarrativo')
    const cuerpo = UI.slice(i, i + 900)
    expect(cuerpo).toMatch(/Math\.min\(/)
    expect(cuerpo).toMatch(/innerHeight/)
  })
})
