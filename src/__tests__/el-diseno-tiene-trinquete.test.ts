/**
 * EL DISEÑO TIENE TRINQUETE — V9 · DESIGN-SYSTEM-001.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `@theme inline` exponía **cuatro** valores a Tailwind (`globals.css:126-131`
 * antes de este cambio): fondo, texto y las dos familias tipográficas. Todo el
 * sistema —superficies, bordes, acento, semántica clínica, radios— vivía en
 * variables CSS que Tailwind no mira.
 *
 * Consecuencia medida por `PATIENT-UX-TRUTH-001`: **6 065 estilos en línea en
 * 177 de 200 archivos (88,5 %)**, 1 205 hexadecimales a mano (151 distintos),
 * ~3 000 `fontSize` en línea con ~60 valores donde la escala declaraba seis.
 *
 * Y no era un vicio del equipo: sin utilidades que ofrecer, escribir el color a
 * mano era la única forma de escribirlo. Es la mecánica lo que fallaba.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Contando. La auditoría de V9 buscaba «cara de producto generado por IA»
 * —degradados morados, tarjetas redondeadas por todas partes— y encontró lo
 * contrario: cero degradados, una `rounded-2xl` en toda la aplicación, y una
 * identidad declarada con los cocientes de contraste WCAG calculados a mano
 * dentro del propio CSS. El defecto era el simétrico: **el sistema existe y la
 * aplicación no le obedece.**
 *
 * ── LA CAUSA RAÍZ QUE SE ATACA ──────────────────────────────────────────────
 *
 * Dos actos separados, y el segundo opcional: *decidir* un valor de diseño
 * (documento) y *poder usarlo* (utilidad o token). Aquí dejan de estarlo —
 * `@theme inline` se ensancha, la escala tipográfica y la de espacio pasan de
 * prosa a token, y este guardián congela la deuda ya escrita.
 *
 * ── LO QUE ESTE GUARDIÁN **NO** GOBIERNA, PORQUE YA TIENE DUEÑO ─────────────
 *
 * El color es de `color-trinquete.test.ts` y la variedad de valores es de
 * `escala-visual-trinquete.test.ts`. Éste aporta lo que ninguno de los dos puede
 * dar: la cuenta **por archivo**, que es lo único con lo que se puede exigir que
 * un archivo NUEVO nazca limpio mientras los viejos se limpian despacio.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * La deuda **sólo baja**, y **lo nuevo nace limpio**. Es la regla del trinquete
 * de lint (`scripts/lint-trinquete.mjs`, techo 98) con la cláusula que pide la
 * directiva V9 con todas las letras: «compuerta que falla si una pantalla nueva
 * no los usa». Limpiar 1 865 valores de golpe sería un cambio que nadie puede
 * revisar; impedir el 1 866 es gratis.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Los dos contadores se prueban con el defecto metido a mano (`medirTexto`
 * sobre texto sintético), no sólo con el repositorio en verde. Un guardián que
 * únicamente se ha visto pasar no se ha probado.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **No aprueba ninguna pantalla.** Cuenta valores fuera del sistema; no ve
 *   jerarquía, ni contraste real, ni si la pantalla se entiende. Aprobar una
 *   pantalla exige abrirla en un navegador — directiva V9 §4, y no se negocia.
 * - No mide accesibilidad. Eso es `A11Y-GATE-001` y todavía no existe.
 * - No comprueba que las utilidades nuevas se usen: comprueba que existan y que
 *   nadie las vuelva a quitar. La adopción es `VISUAL-EXCELLENCE-001`.
 * - No mira `src/lib/` ni las rutas de API: ahí no se pinta.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import {
  medir,
  medirTexto,
  ESCALA_TIPO,
  ESCALA_RADIO,
  EXCEPCIONES,
} from '../../scripts/design/trinquete-de-diseno.mjs'

const CSS = join(process.cwd(), 'src', 'app', 'globals.css')
const TECHO = join(process.cwd(), 'docs', 'design', 'diseno-techo.json')

describe('el trinquete de diseño mide de verdad (probado al revés)', () => {
  it('cuenta un tamaño de letra fuera de la escala, y sólo ése', () => {
    /**
     * 12,5 es el segundo tamaño más usado de la aplicación (466 veces) y no
     * está en ninguna escala: es lo que queda al copiar un bloque y ajustarlo
     * a ojo. 13 sí está — se absorbió justamente porque la aplicación lo usa.
     */
    expect(medirTexto('style={{ fontSize: 12.5 }}').tipo).toBe(1)
    expect(medirTexto('style={{ fontSize: 13 }}').tipo).toBe(0)
    expect(medirTexto("style={{ fontSize: '11.5px' }}").tipo).toBe(1)
  })

  it('cuenta un radio fuera de la escala, incluida la píldora cruda', () => {
    /** `--r-pill` existe y tiene 131 adopciones. Escribir 9999 otra vez es
     *  reabrir la píldora de cinco formas que cerró el bloque RADIO del CSS. */
    expect(medirTexto('style={{ borderRadius: 9999 }}').radio).toBe(1)
    expect(medirTexto('style={{ borderRadius: 10 }}').radio).toBe(0)
    expect(medirTexto("style={{ borderRadius: 'var(--r-pill)' }}").radio).toBe(0)
  })

  it('no cuenta lo que hay dentro de un comentario', () => {
    /**
     * El comentario que EXPLICA un tamaño no es un tamaño. Sin esto, documentar
     * bien una decisión subiría la deuda — y el guardián enseñaría a no
     * documentar, que es el peor incentivo posible en este repositorio.
     */
    expect(medirTexto('/* antes esto era fontSize: 12.5 */').tipo).toBe(0)
    expect(medirTexto('  // antes: fontSize: 12.5\n  style={{ fontSize: 13 }}').tipo).toBe(0)
  })

  it('no mide color: eso ya tiene dueño', () => {
    /**
     * `color-trinquete.test.ts` gobierna el color con una lista curada y con
     * excepciones que una expresión regular genérica no sabe respetar —la receta
     * que se rasteriza, las paletas categóricas—. Dos guardianes con criterios
     * distintos sobre la misma entidad es la duplicación de fuente de verdad que
     * este programa persigue en lo clínico; en lo visual no iba a ser distinto.
     */
    expect(medirTexto("<div style={{ color: '#3D5AFE' }} />").total).toBe(0)
  })
})

describe('la deuda de diseño está congelada y sólo puede bajar', () => {
  it('el techo existe', () => {
    expect(existsSync(TECHO)).toBe(true)
  })

  it('no hay más deuda que el techo, y ningún archivo nuevo nace con deuda', () => {
    const techo = JSON.parse(readFileSync(TECHO, 'utf8'))
    const { total, porArchivo } = medir()

    /**
     * La cláusula de la pantalla nueva. Es la que pide la directiva V9 y la que
     * el trinquete de lint no necesita: allí el archivo nuevo ya lo caza el
     * total, aquí no —1 865 es un número grande y un archivo nuevo con doce
     * tamaños inventados cabría dentro del margen de cualquier limpieza en curso.
     */
    const nuevosConDeuda = Object.keys(porArchivo).filter(f => !(f in techo.porArchivo))
    expect(nuevosConDeuda).toEqual([])

    expect(total).toBeLessThanOrEqual(techo.total)
  })

  it('si la deuda bajó, el techo tiene que bajar con ella', () => {
    /**
     * Un trinquete que no se aprieta es un tope: el margen ganado se lo come el
     * siguiente descuido sin que nadie se entere. Misma regla que en lint.
     */
    const techo = JSON.parse(readFileSync(TECHO, 'utf8'))
    expect(medir().total).toBe(techo.total)
  })
})

describe('el sistema y su guardián no pueden separarse', () => {
  it('cada paso de la escala del guardián está declarado como token en el CSS', () => {
    /**
     * «El dato tiene que LLEGAR»: que el script conozca la escala no significa
     * que el CSS la ofrezca. Si alguien borra `--fs-dense` del CSS, el guardián
     * seguiría aceptando 13 y nadie tendría un token que escribir.
     */
    const css = readFileSync(CSS, 'utf8')
    const declarados = [...css.matchAll(/--fs-[a-z0-9-]+:\s*([0-9.]+)px/g)].map(m => Number(m[1]))
    for (const paso of ESCALA_TIPO) expect(declarados).toContain(paso)
    expect(declarados.sort((a, b) => b - a)).toEqual([...ESCALA_TIPO].sort((a, b) => b - a))
  })

  it('los tres radios del documento están declarados como token', () => {
    const css = readFileSync(CSS, 'utf8')
    const declarados = [...css.matchAll(/--r-(?:control|card|modal):\s*([0-9]+)px/g)].map(m => Number(m[1]))
    expect(declarados.sort((a, b) => a - b)).toEqual([...ESCALA_RADIO].sort((a, b) => a - b))
  })

  it('Tailwind ve el sistema, no cuatro valores', () => {
    /**
     * Ésta es la prueba que hace irreversible el arreglo de `DESIGN-THEME-001`.
     * Si alguien recorta `@theme inline` a lo que había, el código vuelve a
     * quedarse sin utilidades que usar y la deuda vuelve a ser la única opción.
     *
     * El umbral es 20, no el número exacto: fijar el número exacto convertiría
     * cada token nuevo en una prueba roja, y eso enseña a no añadir tokens.
     */
    const css = readFileSync(CSS, 'utf8')
    const bloque = /@theme inline \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? ''
    const tokens = [...bloque.matchAll(/^\s*--[a-z0-9-]+:/gm)].length
    expect(tokens).toBeGreaterThanOrEqual(20)

    // Y las cuatro familias que el sistema necesita, por nombre.
    expect(bloque).toContain('--color-nx-s2:')
    expect(bloque).toContain('--radius-nx-card:')
    expect(bloque).toContain('--text-nx-body:')
    expect(bloque).toContain('--shadow-nx-modal:')
  })

  it('las utilidades siguen al tema en vez de congelarse en oscuro', () => {
    /**
     * `@theme inline` con `var(--…)` es lo que hace que `bg-nx-s2` cambie al
     * pasar a claro. Un token con el hexadecimal escrito dentro del bloque se
     * quedaría en modo oscuro para siempre — y sería invisible hasta que
     * alguien usara el tema claro, que es el que sale por defecto con luz de
     * consultorio.
     */
    const css = readFileSync(CSS, 'utf8')
    const bloque = /@theme inline \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? ''
    const conHexadecimal = [...bloque.matchAll(/^\s*(--[a-z0-9-]+):\s*(#[0-9a-fA-F]+)/gm)]
    expect(conHexadecimal.map(m => `${m[1]} = ${m[2]}`)).toEqual([])
  })

  it('cada excepción del guardián trae su motivo escrito', () => {
    /**
     * Una lista de excepciones sin motivo es una lista de archivos que alguien
     * fue añadiendo para poner la prueba en verde.
     */
    for (const [archivo, motivo] of Object.entries(EXCEPCIONES)) {
      expect(existsSync(join(process.cwd(), archivo))).toBe(true)
      expect(motivo.length).toBeGreaterThan(60)
    }
  })
})
