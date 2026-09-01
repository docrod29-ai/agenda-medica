/**
 * LA COMPUERTA DE ACCESIBILIDAD DEL PACIENTE — A11Y-GATE-001 · REG-331.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Las diez superficies que ve un paciente traían **23 defectos de
 * accesibilidad** que ninguna herramienta del repositorio podía ver. La lista
 * completa, con su causa y su arreglo, está en el ledger (REG-331). En corto:
 *
 *   · 8 campos de formulario sin etiqueta —incluido el de la reserva pública,
 *     donde el paciente escribe su nombre y su teléfono— apoyados sólo en el
 *     `placeholder`, que desaparece en cuanto se escribe la primera letra.
 *   · 7 botones que se deshabilitan y pintan una ruedecita mientras trabajan
 *     sin declarar `aria-busy`: quien ve entiende «espera», quien no ve oye
 *     «no disponible» y vuelve a pulsar.
 *   · 5 pantallas con estado asíncrono y **ni un solo** `aria-live`. El aviso
 *     «este enlace ha expirado» aparecía en pantalla sin que el lector de
 *     pantalla dijera nada.
 *   · 2 sin `<h1>`.
 *   · Las 5 estrellas de la reseña: cinco botones idénticos, todos anunciados
 *     como «botón».
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Construyendo el medidor ANTES de tocar una sola pantalla, y corriéndolo.
 * Ninguno de los 23 se encontró leyendo código.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Familia: **`sin_medir`**. `tsc` no sabe de nombres accesibles;
 * `eslint.config.mjs` son 18 líneas sin `jsx-a11y`; el trinquete de diseño
 * declara en su propia cabecera que «no vigila accesibilidad ni contraste».
 * Los arneses de axe con Chromium sí miden de verdad, pero necesitan servidor y
 * emulador: corren cuando alguien se acuerda, y no hay techo sellado de ninguna
 * de sus salidas.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * **En la superficie del paciente el número es 0, y es prohibición, no techo.**
 *
 * No es el trinquete de diseño, que cuenta deuda y la deja bajar. Aquí son diez
 * archivos —caben en una tarde— y es la superficie donde el lector **no puede
 * detectar el error**: un médico con cédula ve que falta una etiqueta, un
 * paciente de 70 años con el texto al 200 % sólo ve que no puede reservar. Es
 * la misma asimetría que gobierna `patient-facing-ai.md`, dicha en interfaz.
 *
 * En el resto de la aplicación esta unidad **no toca nada**. Poner hoy en rojo
 * 200 pantallas es la manera segura de que alguien borre el guardián el martes
 * (REG-245).
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **No abre un navegador.** No mide contraste PINTADO (texto sobre imagen o
 *   sobre degradado), ni el orden real del foco, ni si una trampa de foco
 *   funciona de verdad. Eso sigue siendo `scripts/design/axe-*.mjs` con
 *   Chromium — y mirar la pantalla, que la regla de diseño exige aparte.
 * - **No cruza el límite del componente.** Un `<button>` que vive dentro de
 *   `components/ui/` no lo juzga la superficie que lo usa. Cubrir los
 *   primitivos es trabajo aparte.
 * - **No mide el contraste de los bordes** (WCAG 1.4.11, 3:1). `--border` está
 *   en 1,18:1 en oscuro a propósito: es un separador decorativo, no el límite
 *   que identifica un control. Cambiarlo es rediseño, y esta unidad no rediseña.
 * - **La regla de la región viva cuenta por ARCHIVO, no por estado.** Una sola
 *   `aria-live` apaga la regla en toda la pantalla. Se descubrió reparando
 *   `/mi/[token]`: la regla se puso en verde con el formulario previo a la
 *   consulta arreglado, mientras el cartel de «tu enlace ya no vale» seguía
 *   mudo. Se encontró **mirando**, no midiendo. Es un suelo —«esta pantalla no
 *   tiene ninguna»— y el reparto correcto entre estados se comprueba a mano.
 * - **No cubre el resto de la aplicación**, que sigue sin medir.
 * - **No dice que estas pantallas sean accesibles.** Dice que estas 15
 *   regresiones concretas ya no pueden volver a entrar calladas.
 *
 * El guardián del guardián —cada regla probada al revés— está en
 * `a11y-el-detector-si-puede-fallar.test.ts`. Sin él, este archivo entero se
 * quedaría en verde para siempre el día que el detector dejara de detectar.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  medir as medirSinTipar,
  SUPERFICIES,
  FUERA_DE_ALCANCE,
  rutasPublicas as rutasPublicasSinTipar,
} from '../../scripts/design/medir-a11y-superficies-paciente.mjs'

type Hallazgo = { regla: string; linea: number; detalle: string }
type Medida = {
  porSuperficie: { ruta: string; nombre: string; hallazgos: Hallazgo[] }[]
  conteo: Record<string, number>
  totalEstructura: number
  contrastes: { tema: string; frente: string; fondo: string; razon: number | null; cumple: boolean }[]
  contrastesEnRojo: { tema: string; frente: string; fondo: string; razon: number | null }[]
  MINIMO_AA: number
}
const medir = medirSinTipar as () => Medida
const rutasPublicas = rutasPublicasSinTipar as () => string[]
const superficies = SUPERFICIES as { ruta: string; nombre: string }[]
const fueraDeAlcance = FUERA_DE_ALCANCE as Record<string, string>

const medida = medir()

/** Un hallazgo, escrito para que quien lea el fallo sepa qué archivo abrir. */
function informe(hallazgos: { ruta: string; hallazgos: Hallazgo[] }[]): string {
  return hallazgos
    .filter(s => s.hallazgos.length)
    .map(s => `\n  ${s.ruta}\n` + s.hallazgos.map(h => `    ${h.linea}: ${h.regla} — ${h.detalle}`).join('\n'))
    .join('')
}

describe('la superficie del paciente está en cero, y cero es prohibición', () => {
  it('ninguna de las superficies del paciente tiene un solo hallazgo de accesibilidad', () => {
    /**
     * Ésta es la que muerde. Probada al revés de verdad: quitando el
     * `aria-label` de una estrella de la reseña, o el `htmlFor` de un campo de
     * la reserva, falla nombrando el archivo y la línea.
     */
    expect(medida.totalEstructura, `hallazgos de accesibilidad:${informe(medida.porSuperficie)}\n`).toBe(0)
  })

  for (const s of superficies) {
    it(`${s.ruta} — ${s.nombre}`, () => {
      const encontrada = medida.porSuperficie.find(x => x.ruta === s.ruta)!
      expect(
        encontrada.hallazgos,
        `${s.ruta}:\n` + encontrada.hallazgos.map(h => `    ${h.linea}: ${h.regla} — ${h.detalle}`).join('\n'),
      ).toEqual([])
    })
  }
})

describe('los tokens críticos cumplen WCAG 2.2 AA en los DOS temas', () => {
  it('ningún par crítico baja de 4,5:1', () => {
    /**
     * Hoy los 34 pares pasan. **Ése es justo el motivo de sellarlo**: el valor
     * de un guardián que arranca en verde es que la próxima vez que alguien
     * retoque `--text3` para «suavizarlo» se entere el mismo día, y no el día
     * que un paciente no pueda leer la hora de su cita.
     *
     * Probado al revés: bajando `--text3` claro de `#6B6F75` a `#8A8F94` —un
     * retoque que a ojo parece inocente— caen tres pares y esto falla.
     */
    const rojos = medida.contrastesEnRojo
      .map(c => `    ${c.tema} ${c.frente} sobre ${c.fondo} = ${c.razon ?? 'no medible'}`)
      .join('\n')
    expect(rojos, `pares por debajo de ${medida.MINIMO_AA}:1:\n${rojos}\n`).toBe('')
  })

  it('los 34 pares se midieron de verdad — ninguno salió «no medible»', () => {
    /**
     * Un par que no se puede leer devuelve `null`, y `null` NO cumple, así que
     * la prueba de arriba ya lo cazaría. Pero lo diría como si fuera un fallo
     * de contraste, y no lo es: es que el token cambió de forma (a
     * `color-mix()`, por ejemplo) y **dejó de vigilarse**. Ausencia de dato no
     * es dato de ausencia: se dice aparte.
     */
    const noMedibles = medida.contrastes.filter(c => c.razon === null)
    expect(noMedibles.map(c => `${c.tema} ${c.frente}/${c.fondo}`)).toEqual([])
    expect(medida.contrastes.length).toBeGreaterThanOrEqual(34)
  })
})

describe('la lista de superficies no se puede quedar corta en silencio', () => {
  it('toda `page.tsx` pública está clasificada: o se vigila, o se declara por qué no', () => {
    /**
     * La forma en que se pierde una compuerta no es que alguien la borre: es
     * que deje de cubrir lo que se añadió después. Una pantalla nueva de cara
     * al paciente que nadie declare no queda «sin vigilar» — queda en rojo
     * hasta que alguien decida a cuál de las dos listas pertenece.
     */
    const declaradas = new Set([...superficies.map(s => s.ruta), ...Object.keys(fueraDeAlcance)])
    const sinClasificar = rutasPublicas().filter(r => !declaradas.has(r))
    expect(
      sinClasificar,
      'rutas públicas nuevas sin clasificar — añádelas a SUPERFICIES (si las ve un paciente) ' +
      'o a FUERA_DE_ALCANCE con su motivo:\n' + sinClasificar.map(r => `    ${r}`).join('\n'),
    ).toEqual([])
  })

  it('las siete superficies que V9 nombra están todas dentro', () => {
    /**
     * La especificación las nombra una por una. Que la lista exista no prueba
     * que estén las que deben: se comprueban por ruta.
     */
    const rutas = superficies.map(s => s.ruta)
    for (const obligatoria of [
      'src/app/mi/[token]/page.tsx',
      'src/app/reservar/[clinicId]/page.tsx',
      'src/app/verificar/[token]/page.tsx',
      'src/app/privacidad/[clinicId]/page.tsx',
      'src/app/teleconsulta/[citaId]/page.tsx',
      'src/app/resena/[token]/page.tsx',
      'src/app/pago/exito/page.tsx',
    ]) {
      expect(rutas, `falta la superficie ${obligatoria}`).toContain(obligatoria)
    }
  })

  it('cada motivo de exclusión dice algo — no vale la cadena vacía', () => {
    for (const [ruta, motivo] of Object.entries(fueraDeAlcance)) {
      expect(motivo.trim().length, `${ruta} está fuera de alcance sin motivo escrito`).toBeGreaterThan(10)
    }
  })
})

describe('el zoom sigue sin bloquearse en la superficie del paciente', () => {
  /**
   * `a11y-zoom-guard.test.ts` ya vigila `layout.tsx`. Aquí se comprueba lo
   * complementario: que ninguna superficie del paciente se traiga su propio
   * `viewport` que anule aquél. Un `export const viewport` en una página gana
   * al del layout, así que el guardián de arriba no lo vería.
   */
  for (const s of superficies) {
    it(`${s.ruta} no declara un viewport que bloquee el zoom`, () => {
      const codigo = readFileSync(join(process.cwd(), s.ruta), 'utf8')
      expect(codigo).not.toMatch(/userScalable\s*:\s*false/)
      expect(codigo).not.toMatch(/user-scalable\s*=\s*no/)
      const m = codigo.match(/maximumScale\s*:\s*([\d.]+)/)
      if (m) expect(Number(m[1]), `${s.ruta} limita el zoom a ${m[1]}×`).toBeGreaterThanOrEqual(5)
    })
  }
})
