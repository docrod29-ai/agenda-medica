/**
 * LA HOJA DE ESTILOS TIENE QUE LLEGAR ENTERA — y no llegaba.
 *
 * ── QUÉ FALLABA, Y CÓMO SE DESCUBRIÓ ────────────────────────────────────────
 *
 * No se descubrió leyendo el CSS: se descubrió porque `npm run build` lo dijo
 * y nadie estaba mirando la salida.
 *
 *     Found 1 warning while optimizing generated CSS:
 *     │ RTC-32: la mitad del FAB de ayuda murió con el FAB. Esta regla sobrevive
 *     ┆         ^-- Invalid token in pseudo element: WhiteSpace(" ")
 *
 * En `globals.css`, RTC-32 añadió un párrafo a un comentario que ya estaba
 * cerrado: cuatro líneas de prosa en español quedaron FUERA del `/* … *​/`,
 * seguidas de un segundo `*​/` suelto.
 *
 * ── POR QUÉ ESO NO ES UN AVISO COSMÉTICO ────────────────────────────────────
 *
 * Un analizador de CSS que encuentra basura en el nivel superior no la salta:
 * abre una regla y consume hasta la PRIMERA llave. La primera llave después de
 * la prosa era la del `@media` siguiente, así que la regla entera se tragó
 * dentro de un selector inválido y se descartó con él. Comprobado en el CSS
 * construido de verdad (`.next/static/chunks/*.css`): `theme-toggle` aparecía
 * ocho veces y `html:has(input:focus, …) .theme-toggle` **ninguna**.
 *
 * O sea: la regla que aparta el botón de tema mientras el médico escribe en un
 * campo —la que nació de tres capturas del iPhone del dueño con el botón
 * encima de **Peso** y de **Exploración física**— llevaba desde RTC-32 sin
 * existir en el navegador. En el fuente se leía perfecta.
 *
 * ── LA FAMILIA ──────────────────────────────────────────────────────────────
 *
 * Es `nx-stat-grid` otra vez, con otra ropa: allí un estilo en línea vencía a
 * la hoja **en silencio**; aquí un comentario mal cerrado se come la regla
 * siguiente **en silencio**. Las dos veces el fuente parecía correcto, las dos
 * veces la prueba estaba en verde, y las dos veces sólo se vio mirando del otro
 * lado — «el dato tiene que LLEGAR» aplicado a una hoja de estilos.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * No se vigila ESTE defecto: se vigila el analizador. `globals.css` se pasa por
 * el mismo motor que usa la construcción (lightningcss) y sólo se toleran los
 * avisos declarados aquí por su nombre. Cualquier aviso nuevo —de este defecto
 * o del que se invente la próxima rebanada— pone el caso en rojo con el número
 * de línea, que es lo que faltaba: el aviso existía, sólo que en una salida que
 * nadie lee.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * El caso 3 es el control positivo: mete el defecto en una COPIA en memoria y
 * comprueba que el instrumento lo caza. Sin él, esta prueba pasaría igual el
 * día que el analizador dejara de avisar de nada — que es exactamente la
 * tautología que la regla de pruebas prohíbe.
 *
 * Con la prosa suelta devuelta a `globals.css` caen los casos 1 y 2.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · Sólo mira `globals.css`. El CSS que viaja en `style=` del JSX no pasa por
 *   aquí — ése lo vigila el trinquete de diseño.
 * · No comprueba que la regla se APLIQUE en un navegador (que el selector case
 *   con algo real): comprueba que sobreviva al analizador. Lo primero es del
 *   arnés de navegador.
 * · No valida propiedades desconocidas ni compatibilidad entre navegadores:
 *   sólo lo que el analizador considera un aviso.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { transform } from 'lightningcss'

const RUTA = join(process.cwd(), 'src/app/globals.css')

/**
 * Los avisos que este repositorio acepta a sabiendas, cada uno con su motivo.
 * La lista sólo puede encoger: si algo nuevo aparece, se arregla o se declara
 * aquí con su razón — no se amplía el filtro para que calle.
 */
const AVISOS_DECLARADOS = [
  // Tailwind v4 declara su tema con una at-rule propia que lightningcss no
  // conoce. No rompe nada: la procesa Tailwind antes de llegar al navegador.
  'Unknown at rule: @theme',
]

function analizar(css: Buffer | string) {
  const r = transform({
    filename: 'globals.css',
    code: Buffer.isBuffer(css) ? css : Buffer.from(css),
    errorRecovery: true,
  })
  return {
    avisos: (r.warnings ?? []).map(w => ({ mensaje: w.message, linea: w.loc?.line })),
    salida: r.code.toString(),
  }
}

describe('globals.css llega entera al navegador', () => {
  it('1. el analizador de la construcción no tiene nada nuevo que decir', () => {
    const { avisos } = analizar(readFileSync(RUTA))
    const nuevos = avisos.filter(a => !AVISOS_DECLARADOS.some(d => a.mensaje.startsWith(d)))
    expect(
      nuevos,
      `Avisos NUEVOS de lightningcss sobre globals.css:\n${nuevos.map(a => `  línea ${a.linea}: ${a.mensaje}`).join('\n')}\n\n` +
      'Un aviso aquí NO es cosmético: el analizador consume hasta la primera ' +
      'llave, así que la regla siguiente se descarta entera y en silencio.',
    ).toEqual([])
  })

  it('2. la regla que se había tragado el comentario existe en la salida', () => {
    const { salida } = analizar(readFileSync(RUTA))
    /*
      Los botones flotantes se apartan mientras hay un campo con el foco.
      Estuvo escrita y ausente del CSS construido desde RTC-32.

      Se busca el `:has(` — no `input:focus` a secas: la hoja tiene otras tres
      reglas con `.input:focus` que sobreviven aunque ésta muera, y una prueba
      que pasa con la regla borrada no prueba nada.
    */
    expect(salida).toMatch(/:has\(\s*input:focus/)
  })

  it('3. CONTROL POSITIVO: el instrumento caza el defecto que se le mete', () => {
    const bueno = readFileSync(RUTA, 'utf8')
    // El defecto exacto de RTC-32: un comentario que se cierra, prosa suelta y
    // un segundo cierre huérfano justo antes de una regla.
    const roto = bueno.replace(
      '@media (max-width: 900px) {\n  html:has(input:focus',
      'prosa que se quedó fuera del comentario */\n@media (max-width: 900px) {\n  html:has(input:focus',
    )
    expect(roto, 'la inyección no encontró su sitio: revisar el ancla').not.toBe(bueno)

    const { avisos, salida } = analizar(roto)
    const nuevos = avisos.filter(a => !AVISOS_DECLARADOS.some(d => a.mensaje.startsWith(d)))
    expect(nuevos.length).toBeGreaterThan(0)
    // Y se comprueba la CONSECUENCIA, no sólo el aviso: la regla desaparece.
    expect(salida).not.toMatch(/:has\(\s*input:focus/)
  })
})
