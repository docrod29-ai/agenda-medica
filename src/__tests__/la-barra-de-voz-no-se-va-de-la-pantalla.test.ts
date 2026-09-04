/**
 * LA BARRA DE VOZ NO SE VA DE LA PANTALLA — y ya no hace falta una píldora
 * que la supla.
 *
 * ── QUÉ FALLABA Y CÓMO SE DESCUBRIÓ ─────────────────────────────────────────
 *
 * Recorriendo el día de un médico en un navegador de verdad (unidad 102):
 * entrar, ver la agenda, abrir la consulta, dar consentimiento, grabar.
 *
 * `MientrasHablas` es la barra que —según su propia cabecera— «no se va de la
 * pantalla»: lleva el nivel de voz, el tiempo, las últimas palabras oídas y el
 * detener. Estaba escrita con `position: sticky; bottom: 0`.
 *
 * **`sticky` con `bottom` no hace eso.** Sólo sujeta al elemento al que uno se
 * ACERCA desde arriba: lo pega al borde inferior mientras baja hacia él, y en
 * cuanto se pasa de largo lo suelta. Medido con la consulta grabando: al bajar
 * 1621 px la barra quedaba en `top: -1155` —fuera de la pantalla— y a 390 px en
 * `-1718`.
 *
 * Es decir: **desaparecía justo en la consulta larga, que es para lo que
 * existe.** Y una consulta dura veinte minutos.
 *
 * ── LO QUE HABÍA TAPANDO EL AGUJERO ─────────────────────────────────────────
 *
 * Una píldora flotante con un punto rojo, un reloj y «Detener y generar nota».
 * Con ella, en la consulta grabando se decía **«Grabando · 00:09» cuatro veces
 * a la vez** —barra superior, barra de voz, instrumento y píldora— con **tres
 * controles de parada** y dos de pausa. Una acción, tres botones; un hecho,
 * cuatro rótulos.
 *
 * Y lo que ofrecía era la más pobre de las cuatro señales: un reloj. La
 * cabecera de `MientrasHablas` explica por qué eso es lo de menos — «un
 * contador de tiempo sigue corriendo aunque el micrófono esté silenciado; una
 * barra que se mueve, no». Al bajar por la nota, el médico se quedaba
 * exactamente con la señal que miente.
 *
 * ── LO QUE **NO** ERA, Y SE DIJO AL MEDIRLO ─────────────────────────────────
 *
 * Al medir a mano parecía que la píldora **tapaba tres controles** a 390 px.
 * El arnés `nada-flotante-tapa-un-control`, que aplica la regla de los
 * extremos, dijo que no: los tapaba en reposo y se liberaban al desplazarse, y
 * «una fila que pasa por debajo de una capa fija mientras uno baja se arregla
 * sola bajando más». No era una trampa. El motivo para quitarla es la
 * duplicación, no un control atrapado.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. La barra es `fixed`: hace lo que su comentario decía.
 * 2. **Lo que ocupa se le devuelve al contenido** como relleno inferior
 *    mientras hay barra. Esta regla es de carga, no de adorno: probado al revés
 *    con una barra alta y sin el relleno, el arnés cazó **«Firmar y cerrar
 *    nota», «Guardar borrador», «Leer resumen» y «Descartar»** atrapados abajo
 *    del todo, a 1440 y a 390. Taparle al médico el botón de firmar sería
 *    cambiar un defecto por otro peor.
 * 3. La píldora se retira: lo que acompaña al médico es la barra entera.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No mide la pantalla.** Que la barra siga visible al final del scroll lo
 *   dicen los arneses (`nada-flotante-tapa-un-control` con el escenario
 *   `· grabando`, y la medición del recorrido). Un `fixed` en el código no es
 *   una barra en pantalla.
 * · Sólo Chromium: no prueba iPhone, donde `env(safe-area-inset-bottom)` y la
 *   barra del navegador cambian el borde inferior de verdad.
 * · **No reduce a uno los rótulos**: quedan la barra y el panel del
 *   instrumento, que dicen los dos «Grabando». El panel es el instrumento y sus
 *   controles son suyos; que su rótulo de estado sobre está declarado y no
 *   arreglado aquí.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = join(__dirname, '..', '..')
const BARRA = readFileSync(join(RAIZ, 'src/components/MientrasHablas.tsx'), 'utf8')
const CSS = readFileSync(join(RAIZ, 'src/app/globals.css'), 'utf8')
const CONSULTA = readFileSync(join(RAIZ, 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8')

describe('la barra de voz no se va de la pantalla', () => {
  it('1 · la barra es fixed, no sticky-bottom', () => {
    // `sticky` con `bottom` suelta el elemento en cuanto uno se pasa de largo:
    // medido, quedaba en top -1155 al bajar por la nota.
    expect(BARRA).toContain("position: 'fixed'")
    expect(BARRA).not.toMatch(/position: 'sticky', bottom: 0/)
  })

  it('2 · lo que la barra ocupa se le devuelve al contenido', () => {
    // Regla DE CARGA: sin ella el arnés caza «Firmar y cerrar nota» atrapado.
    //
    // Y se exige la regla BASE, la que rige en escritorio, no cualquiera con
    // ese selector: hay otra dentro del @media de teléfono, y al probarlo al
    // revés quitando la base el caso seguía verde por culpa de la otra.
    const sinMedias = CSS.replace(/@media[^{]*\{[\s\S]*?\n\}/g, '')
    const i = sinMedias.indexOf('main:has(.nx-mientras-hablas)')
    expect(i, 'falta la regla base de relleno para la barra de voz').toBeGreaterThan(-1)
    expect(sinMedias.slice(i, i + 200)).toContain('padding-bottom')
  })

  it('3 · en el teléfono se apoya ENCIMA de la navegación inferior', () => {
    // Sobre ella taparía los cinco destinos primarios del pulgar.
    const re = /@media \(max-width: 768px\) \{([\s\S]*?)\n\}/g
    let cuerpo = ''
    for (const m of CSS.matchAll(re)) if (m[1].includes('.nx-mientras-hablas')) cuerpo = m[1]
    expect(cuerpo, 'no hay regla de teléfono para la barra de voz').not.toBe('')
    expect(cuerpo).toContain('safe-area-inset-bottom')
  })

  it('4 · ya no hay una píldora flotante que duplique el detener', () => {
    // Con ella, «Grabando · 00:09» salía cuatro veces y había tres paradas.
    expect(CONSULTA).not.toContain('Detener y generar nota')
  })

  it('5 · y queda dicho por qué se quitó, no sólo que se quitó', () => {
    // Un hueco sin explicación se vuelve a llenar con lo mismo en seis meses.
    expect(CONSULTA).toContain('AQUÍ HABÍA UNA PÍLDORA FLOTANTE')
  })

  it('6 · la barra sigue llevando la señal que un reloj no da', () => {
    // El nivel de voz es la única prueba en vivo de que el micrófono capta:
    // un contador sigue corriendo con el micrófono silenciado.
    expect(BARRA).toContain('nivelAudio')
    expect(BARRA).toContain('ultimasPalabras')
  })

  it('7 · el arnés mide la consulta GRABANDO, no sólo en reposo', () => {
    // La consulta en reposo no tiene capa flotante ninguna: aparecen al grabar.
    // Medirla en reposo era medir un estado en el que nadie trabaja.
    const arnes = readFileSync(join(RAIZ, 'scripts/carril-excelencia/nada-flotante-tapa-un-control.mjs'), 'utf8')
    expect(arnes).toContain('/consulta/pac-001 · grabando')
    expect(arnes).toContain('use-fake-device-for-media-stream')
    // Y si no llegó a grabar, se para en vez de dar un verde sobre el reposo.
    expect(arnes).toContain('pidió grabar y no está grabando')
  })
})
