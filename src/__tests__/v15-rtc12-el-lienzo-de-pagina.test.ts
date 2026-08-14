/**
 * RTC-12(a) / RTC-16 — UN LIENZO DE PÁGINA, UN SOLO BORDE IZQUIERDO.
 *
 * ── QUÉ FALLABA, Y CÓMO SE DESCUBRIÓ ────────────────────────────────────────
 *
 * El registro canónico dejó abierta la mitad (a) de RTC-12 con este enunciado:
 * «ninguna superficie usa el lienzo de escritorio: columna única 880–1100px en
 * todas». Estaba dimensionado (900 · 1100 · 880 · 980 de 1440) y aparcado como
 * deuda del monolito.
 *
 * El enunciado **da por hecho que el defecto es el ancho sobrante**, y eso no
 * se sostuvo al medirlo: 880px de historia clínica son 74 caracteres —dentro
 * del rango legible— y estirarlos para llenar 1440 sería el error contrario.
 *
 * Midiendo la CONSECUENCIA en navegador real en vez del ancho
 * (`scripts/design/medir-canvas-de-pagina-v15.mjs`, 14-ago-2026, 1440×900,
 * acta en `docs/design/capturas/v15-canvas-antes/acta-canvas.json`) apareció el
 * defecto de verdad — el borde izquierdo del contenido, o sea el píxel por el
 * que se empieza a leer, **se movía en CADA paso de navegación**:
 *
 *     hoy → pendientes        182px de salto lateral
 *     pendientes → pacientes   82px
 *     pacientes → expediente  142px
 *     expediente → consulta   106px
 *     consulta → operaciones   70px
 *
 * Cuatro anchos declarados distintos en seis pantallas, y `/pendientes` sin
 * ninguno. §20 pide que navegar se sienta como el mismo objeto haciéndose más
 * detallado; con cada pantalla centrada en su propio número, quien rompe la
 * continuidad es el marco, no el contenido.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * No había UN contenedor de página: había uno por pantalla, escrito a mano en
 * el JSX por quien la hizo. El barrido estático del mismo día contó **41
 * páginas del dashboard con `maxWidth` propio en TRECE valores distintos**
 * (480 · 520 · 720 · 800 · 820 · 860 · 880 · 900 · 920 · 980 · 1000 · 1100 ·
 * 1180). Eso no es una decisión de diseño tomada trece veces: es la ausencia de
 * una decisión, repetida.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * `.nx-canvas` en `globals.css` — un bloque compartido, `--nx-lienzo`, y el
 * mismo borde izquierdo en todas. Lo que cambia según el trabajo es la MEDIDA
 * del contenido dentro (`.nx-medida-lectura`), que acorta por la DERECHA sin
 * mover el borde por el que se entra.
 *
 * Y vive en la HOJA, no en el JSX: es la lección `nx-stat-grid` —un `maxWidth`
 * en línea vence a la hoja en silencio—, así que al convertir una pantalla el
 * número escrito a mano **se borra**, no se acompaña. El caso 3 es exactamente
 * ese candado.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * · Devolviendo `max-width: 900px` a `.hoy` → falla el caso 3 (dos fuentes del
 *   ancho para la misma pantalla, que es el defecto original con otra ropa).
 * · Quitando `.nx-canvas` de `/pendientes` → falla el caso 2.
 * · Borrando `--nx-lienzo` de la hoja → falla el caso 1.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No cubre las 41 páginas.** Esta rebanada convierte las SEIS que puntúa
 *   §29 y deja el resto declarado; el trinquete `lienzosAMano` cuenta las que
 *   quedan y sólo puede bajar. Convertirlas todas de golpe sin volver a mirar
 *   ninguna sería repintar.
 * · **No mide píxeles.** Que el salto sea de verdad 0px lo dice el arnés en
 *   navegador, no una aserción sobre el texto del CSS: un guardián de fuente no
 *   puede ver un `margin` heredado de tres reglas más arriba.
 * · **No juzga si 1100px es el ancho correcto.** Es el valor que el propio
 *   producto ya usaba más veces (15 páginas); la opinión está sellada en la
 *   hoja, no aquí.
 * · No dice nada de móvil: a 390px no hay lienzo que repartir — todas las
 *   medidas colapsan al ancho del teléfono, y por eso este defecto es de
 *   escritorio.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const CSS = leer('src/app/globals.css')

/** Las seis que puntúa §29 — las que esta rebanada convierte. */
const CONVERTIDAS = [
  'src/app/(dashboard)/dashboard/page.tsx',
  'src/app/(dashboard)/pendientes/page.tsx',
  'src/app/(dashboard)/pacientes/page.tsx',
  'src/app/(dashboard)/expediente/[patientId]/page.tsx',
  'src/app/(dashboard)/consulta/[patientId]/page.tsx',
  'src/app/(dashboard)/operaciones/page.tsx',
]

describe('RTC-12(a) — el lienzo de página', () => {
  it('1. la hoja declara UN lienzo compartido, con su medida de lectura', () => {
    expect(CSS).toMatch(/\.nx-canvas\s*\{/)
    // El ancho es un token del bloque, no un número suelto repetido: si mañana
    // se decide otro, se cambia en un sitio.
    expect(CSS).toMatch(/--nx-lienzo:\s*\d+px/)
    expect(CSS).toMatch(/\.nx-canvas\s*\{[^}]*max-width:\s*var\(--nx-lienzo\)/)
    // La medida de lectura acorta por la derecha; existe para que una pantalla
    // de prosa no tenga que inventarse otro contenedor para caber.
    expect(CSS).toMatch(/\.nx-medida-lectura\s*\{[^}]*max-width:/)
  })

  it('2. las seis superficies de §29 entran por el lienzo compartido', () => {
    for (const p of CONVERTIDAS) {
      expect(leer(p), `${p} no usa .nx-canvas`).toMatch(/className="nx-canvas/)
    }
  })

  it('3. ninguna de las seis vuelve a escribir su ancho a mano (lección nx-stat-grid)', () => {
    // Un `maxWidth` en línea vence a la hoja EN SILENCIO: la pantalla seguiría
    // teniendo `.nx-canvas` puesta y el lienzo no serviría de nada. Por eso el
    // número se borra, no se acompaña.
    for (const p of CONVERTIDAS) {
      const src = leer(p)
      const contenedor = src.slice(src.indexOf('className="nx-canvas'))
      const primerCierre = contenedor.indexOf('>')
      expect(
        contenedor.slice(0, primerCierre),
        `${p} pisa el lienzo con un maxWidth en línea`,
      ).not.toMatch(/maxWidth/)
    }
    // Y la propia hoja: `.hoy` componía en columna Y decidía su ancho. Ahora
    // sólo lo primero.
    const hoy = CSS.slice(CSS.indexOf('\n.hoy {'), CSS.indexOf('}', CSS.indexOf('\n.hoy {')))
    expect(hoy, '.hoy vuelve a decidir su propio ancho').not.toMatch(/max-width/)
  })

  it('4. el lienzo se recorta en teléfonos pequeños igual que .page-pad', () => {
    // Sin esto, las pantallas convertidas PERDERÍAN el recorte de 16px que
    // `.page-pad` les daba a 480px, y el defecto se vería sólo en el teléfono
    // de alguien — que es donde nadie mira dos veces.
    const bloque = CSS.slice(CSS.indexOf('@media (max-width: 480px) { .nx-canvas'))
    expect(bloque.slice(0, 120)).toMatch(/padding:\s*16px/)
  })
})
