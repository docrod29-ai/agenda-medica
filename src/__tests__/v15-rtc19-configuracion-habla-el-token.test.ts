/**
 * RTC-19 (2ª tanda) — `/configuracion` habla el token… salvo donde el literal
 * ES el trabajo.
 *
 * ── DE DÓNDE VIENE ──────────────────────────────────────────────────────────
 *
 * RTC-19 pagó los dos literales teal del cromo persistente y dejó declarado el
 * resto: «~74 literales fuera del cromo —documentos de receta, pantallas de
 * negocio, ilustraciones— y muchos son colores de impresión, donde un token
 * puede no resolverse: barrerlos a ciegas rompería justo esos casos».
 *
 * Contados de nuevo antes de tocar nada, sin comentarios y sin pruebas: **83
 * literales vivos en 28 archivos**, y un tercio de ellos —31— concentrados en
 * una sola superficie: `/configuracion`. Ésa es esta rebanada.
 *
 * ── EL DEFECTO NO ERA «UN HEX EN LÍNEA» ─────────────────────────────────────
 *
 * `#14b8a6` es teal-500 de una paleta genérica. El acento de este producto es
 * `--nexus` **#2AA5B5**. No son el mismo color: la pantalla de configuración
 * llevaba un teal ligeramente distinto del de todo lo demás, que además no
 * cambia con el tema y que ningún trinquete miraba. Es el mismo hallazgo que
 * el halo del pulgar en la 1ª tanda —dos teales que el médico no puede
 * aprender—, repetido en la superficie que más se abre después de las
 * clínicas.
 *
 * ── LO QUE SE PAGÓ ──────────────────────────────────────────────────────────
 *
 * 18 literales de cromo de pantalla —zonas de arrastre, tintes de cabecera,
 * bordes de la caja del miembro, el overlay que edita los márgenes de la
 * receta— pasan a `var(--nexus)` o a un `color-mix` sobre él.
 *
 * Y dos degradados de dos paradas casi idénticas
 * (`rgba(20,184,166,0.06) → 0.02`) se vuelven un tinte plano: era un degradado
 * que nadie percibía como degradado y que el trinquete sí contaba. Techos
 * bajados y re-sellados: **hexEnLinea 493 → 489, gradientes 16 → 14**. La
 * deuda no se declara, se retira.
 *
 * ── LO QUE **NO** SE TOCA, Y POR QUÉ (LA PARTE QUE IMPORTA) ─────────────────
 *
 * Once literales se quedan, y barrerlos «para terminar el trabajo» rompería
 * cosas sin que ninguna prueba de esta aplicación se pusiera roja:
 *
 * 1. **Los fragmentos para incrustar (`snippetBoton`, `snippetFlotante`) y sus
 *    vistas previas.** Ese HTML se copia y se pega en el SITIO WEB DEL
 *    CONSULTORIO, donde no existe `globals.css`: un `var(--nexus)` no
 *    resolvería y el médico pegaría un botón sin color en su propia página.
 *    Las previsualizaciones llevan el mismo hex a propósito — una vista previa
 *    pintada con el token enseñaría un botón distinto del que se va a pegar.
 * 2. **`colorAccento` de la receta.** No es cromo: es un DATO del consultorio.
 *    Se guarda en Firestore, se edita en un `<input type="color">` —que sólo
 *    acepta un hex de 7 caracteres— y acaba IMPRESO, donde no hay hoja de
 *    estilos que resuelva una variable.
 *
 * Este guardián existe sobre todo para **eso**: para que la próxima pasada de
 * limpieza encuentre la razón escrita y no descubra el contrato externo
 * rompiéndolo.
 *
 * ── VERIFICADO EN NAVEGADOR, Y NO POR TRÁMITE ───────────────────────────────
 *
 * `color-mix()` es una función que el navegador puede no soportar: si no
 * resuelve, la declaración es inválida y el elemento se queda **sin fondo** —
 * un cambio que en el `git diff` se ve perfecto y en la pantalla borra el
 * tinte. Medido con `scripts/design/medir-rtc19-configuracion-v15.mjs`:
 *
 *   soporta color-mix                        true
 *   elementos que perdieron su fondo         0
 *   tono calculado de los tintes             rgb(42, 165, 181)  ← --nexus
 *
 * Y la medición encontró lo que el `grep` no podía: después de limpiar los dos
 * ficheros de la sección, «Recetas, órdenes y notas» **seguía pintando
 * teal-500**. El tinte venía de `GuiaConfigurarReceta`, un componente de otra
 * carpeta que se pinta ahí dentro. Por fichero la superficie estaba limpia; en
 * pantalla, no.
 *
 * Probado al revés: devolviendo un `rgba(20,184,166,…)` al cromo falla el caso
 * 1; tokenizando el snippet falla el 2; tokenizando `colorAccento` falla el 3.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **Los otros ~52 literales del árbol.** Siguen fuera: documentos de receta,
 *   superadmin, landing, ilustraciones. Cada familia necesita la misma
 *   pregunta que se hizo aquí —¿resuelve el token donde ese color acaba?— y
 *   ninguna se barre a ciegas.
 * · **No mide contraste.** `--nexus` trae el suyo documentado en globals.css;
 *   que un `color-mix` al 4 % sobre el fondo sea legible no lo comprueba esto.
 * · **No mira la pantalla.** Que el tinte plano se vea como el degradado que
 *   sustituye es el arnés, no una prueba de fuente.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

/** Sin comentarios: las cabeceras CITAN el literal para explicar por qué está. */
const sinComentarios = (s: string) => s
  .split('\n').filter(l => !l.trimStart().startsWith('//')).join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

const TEAL_CRUDO = /#14b8a6|rgba?\(\s*20\s*,\s*184\s*,\s*166/gi

const CUENTA = sinComentarios(leer('src/app/(dashboard)/configuracion/secciones-cuenta.tsx'))
const RECETAS = sinComentarios(leer('src/app/(dashboard)/configuracion/secciones-recetas.tsx'))
const CONFIG = leer('src/app/(dashboard)/configuracion/page.tsx')

describe('RTC-19 · configuración — el cromo habla el token', () => {
  it('1 · el cromo de las dos secciones no pinta teal-500 crudo', () => {
    expect(CUENTA.match(TEAL_CRUDO) ?? []).toEqual([])
    /**
     * En recetas quedan exactamente TRES, y los tres son el mismo dato:
     * `colorAccento` (su valor por defecto y los dos campos que lo editan).
     * Si aparece un cuarto, o es cromo sin pagar o alguien duplicó el dato.
     */
    expect(RECETAS.match(TEAL_CRUDO) ?? []).toHaveLength(3)
    expect([...RECETAS.matchAll(/colorAccento \?\? '#14b8a6'/g)]).toHaveLength(2)
  })

  it('2 · el fragmento que se pega en OTRO sitio conserva su hex', () => {
    /**
     * Es el caso que convierte esta prueba en un guardián y no en una
     * comprobación de estilo: el HTML viaja fuera de la aplicación, donde
     * `var(--nexus)` no existe. Y la vista previa lleva el mismo hex, o
     * enseñaría un botón distinto del que se va a pegar.
     */
    expect(CONFIG).toContain('const snippetBoton =')
    expect(CONFIG).toMatch(/snippetBoton[\s\S]{0,400}background:#14b8a6/)
    expect(CONFIG).toMatch(/snippetFlotante[\s\S]{0,400}background:#14b8a6/)
    // La razón, escrita donde la va a leer quien pase a limpiar.
    expect(CONFIG).toContain('SITIO WEB DEL CONSULTORIO')
  })

  it('3 · el color de acento de la receta sigue siendo un hex de verdad', () => {
    /**
     * `<input type="color">` sólo acepta `#rrggbb`. Un token aquí rompería el
     * selector, se guardaría en Firestore como texto inservible y saldría
     * impreso — o no saldría.
     */
    expect(RECETAS).toContain("colorAccento: '#14b8a6'")
    expect(RECETAS).toMatch(/type="color"[\s\S]{0,120}colorAccento \?\? '#14b8a6'/)
  })

  it('4 · los degradados de dos paradas casi iguales se fueron, y el techo bajó', () => {
    /**
     * `rgba(20,184,166,0.06) → 0.02` no se percibía como degradado; sólo
     * contaba como uno. Sustituirlo por un tinte plano retira deuda en vez de
     * declararla — como hizo la 1ª tanda con el halo del pulgar.
     */
    const { techos } = JSON.parse(leer('scripts/design/techos-de-diseno.json'))
    expect(techos.gradientes, 'el techo de gradientes subió o no se re-selló').toBeLessThanOrEqual(14)
    expect(techos.hexEnLinea).toBeLessThanOrEqual(489)
    expect(CUENTA).not.toContain('linear-gradient(135deg, rgba(20,184,166')
  })

  it('5 · la tarjeta de guía que se pinta DENTRO de la sección también', () => {
    /**
     * La encontró el navegador, no el `grep`: la primera medición seguía
     * viendo `rgba(20,184,166,0.06)` en «Recetas, órdenes y notas» después de
     * haber limpiado los dos ficheros de la sección. El tinte venía de
     * `GuiaConfigurarReceta`, un componente de otra carpeta que se pinta ahí
     * dentro.
     *
     * Es la forma clásica de este repositorio —se arregla lo que se está
     * mirando y la copia de al lado se queda—, y la razón de que la regla diga
     * que una interfaz no se aprueba leyendo el código: por fichero, la
     * superficie estaba limpia; en pantalla, no.
     */
    expect(sinComentarios(leer('src/components/GuiaConfigurarReceta.tsx')).match(TEAL_CRUDO) ?? []).toEqual([])
  })

  it('6 · y el acento del producto es el token, no teal-500', () => {
    /**
     * La razón de fondo: `#14b8a6` (teal-500) NO es `--nexus` (#2AA5B5). No
     * era «un hex en línea»: era un teal distinto del de todo lo demás, en la
     * pantalla que más se abre después de las clínicas.
     */
    expect(leer('src/app/globals.css')).toMatch(/--nexus:\s*#2AA5B5/i)
    expect(CUENTA).toContain('color-mix(in srgb, var(--nexus)')
  })
})
