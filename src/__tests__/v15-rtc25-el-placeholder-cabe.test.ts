/**
 * RTC-25 — de cinco quejas de texto móvil, **una** se reproducía.
 *
 * ── LA LISTA, TAL COMO LLEGÓ ────────────────────────────────────────────────
 *
 * ORT-20 + RT-22 dejaron cinco: el rótulo del héroe envuelve · el placeholder
 * «…correo o CUI» se trunca · las píldoras-pestaña sangran · los descriptores
 * bajo los FABs envuelven · «Urgente» es un metadato gris de 12px.
 *
 * Cinco afirmaciones sobre el mismo ancho se miden juntas o no se miden: por
 * separado se arreglan tres y se olvidan dos.
 *
 * ── LO MEDIDO, A 390×844, EN CUATRO RUTAS ───────────────────────────────────
 *
 * `scripts/design/medir-rtc25-textos-moviles-v15.mjs`:
 *
 *   la página desborda                       no, en ninguna ruta
 *   elementos que no caben en su caja        0 (salvo un input de fecha de 1px)
 *   truncados con ellipsis efectiva          0
 *   placeholder de /pacientes                **327px de texto en 296px útiles**
 *
 * · **Rótulo del héroe: REFUTADO.** Ningún título ocupa más de un renglón —
 *   lo pagó RT-03 con su breakpoint.
 * · **Píldoras sangrando: REFUTADO.** Cero desbordes reales
 *   (`scrollWidth > clientWidth`), que es sangrar de verdad y no «parece
 *   apretado».
 * · **Descriptores bajo los FABs: SIN SUJETO.** Los FABs ya no flotan (RTC-05)
 *   y el de ayuda se retiró entero (RTC-32).
 * · **«Urgente» como metadato gris: NO MEDIBLE con la siembra actual.** En las
 *   cuatro rutas no se pinta ese rótulo; la siembra no crea una tarea urgente.
 *   **Declarado, no refutado**: no es lo mismo «no pasa» que «no se pudo
 *   mirar», y esa distinción es la regla 4 de seguridad clínica dicha en
 *   lenguaje de medición.
 *
 * ── LO QUE SÍ, Y CON UNA IRONÍA ÚTIL ────────────────────────────────────────
 *
 * El placeholder de `/pacientes` decía «Buscar por nombre, teléfono, correo o
 * CURP…»: **327px de texto en un campo de 296px útiles**, medidos con la
 * tipografía real del campo en un lienzo (comparar longitudes de cadena no
 * dice nada). El médico veía la frase cortada.
 *
 * Y el propio equipo rojo la transcribió como «…correo o **CUI**» — leyendo,
 * justamente, lo que le cabía en la pantalla. La errata era la prueba.
 *
 * **El arreglo quita «Buscar por», no un campo.** La lupa a la izquierda ya
 * dice que se busca; los cuatro campos por los que se puede buscar son la
 * información que sólo puede dar el placeholder, y se conservan. El
 * `aria-label` sigue diciendo la frase entera para quien la oye. Medido
 * después: **248px de 296**.
 *
 * Probado al revés: devolviendo el prefijo falla el caso 1; quitando un campo
 * falla el 2; borrando el `aria-label` falla el 3.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No mide píxeles**: eso es el arnés, con su acta fechada. Aquí se protege
 *   qué dice el campo, que es donde estaba el defecto.
 * · **No cubre «Urgente»**: declarado arriba como no medible con esta siembra.
 *   Cerrarlo pide una tarea urgente sembrada — otra rebanada, con su medición.
 * · No cubre otros anchos: 390px es el que la queja nombraba.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const PACIENTES = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/pacientes/page.tsx'), 'utf8',
)

describe('RTC-25 — el placeholder de /pacientes cabe en un teléfono', () => {
  it('1 · ya no empieza por «Buscar por»: eso lo dice la lupa', () => {
    expect(PACIENTES).toContain('placeholder="Nombre, teléfono, correo o CURP…"')
    expect(PACIENTES).not.toContain('placeholder="Buscar por nombre')
  })

  it('2 · pero NO se perdió ningún campo por el que se puede buscar', () => {
    /**
     * Acortar quitando «correo» habría sido más fácil y habría escondido una
     * capacidad real del buscador. Lo que sobraba era el marco de la frase,
     * no su contenido.
     */
    for (const campo of ['Nombre', 'teléfono', 'correo', 'CURP']) {
      expect(PACIENTES, `el placeholder perdió «${campo}»`)
        .toMatch(new RegExp(`placeholder="[^"]*${campo}`))
    }
  })

  it('3 · y quien lo oye sigue recibiendo la frase entera', () => {
    // El placeholder se acortó para el ojo; el nombre accesible no tiene ese
    // límite de ancho y no hay razón para recortarlo ahí.
    expect(PACIENTES).toContain('aria-label="Buscar un paciente por nombre, teléfono, correo o CURP"')
  })
})
