/**
 * La coreografía de continuidad de §20 existe, es interrumpible, respeta
 * §24 y no cambia A DÓNDE se navega. V15-MOTION-001 (§43 orden 14, §20 del
 * master loop), cuarta rebanada.
 *
 * QUÉ FALLABA: no existía coreografía de continuidad — el crossfade de
 * `template.tsx` comunica CAMBIO, no continuidad de objeto. Al pasar de la
 * cita de Hoy al expediente o a la consulta, el nombre del paciente
 * desaparecía en un sitio y reaparecía en otro, y el médico reconstruía
 * mentalmente que era el mismo («cognitive reconstruction», justo lo que §30
 * pide minimizar).
 *
 * CÓMO SE DESCUBRIÓ: la novena rebanada de Fase 10 midió los comportamientos
 * de motion del master loop contra el código real y encontró este hueco; lo
 * difirió a V15-MOTION-001 con razón escrita («exige diseño de movimiento
 * entre rutas, no una rebanada segura de cierre de fase»).
 *
 * CAUSA RAÍZ: nunca hubo mecanismo de movimiento ENTRE rutas — todo el
 * motion del producto era intra-pantalla, y el único inter-pantalla (el
 * crossfade del template) trata todas las navegaciones igual, tenga o no un
 * objeto compartido que preservar.
 *
 * LA REGLA QUE LO HACE SEGURO: `navegarConContinuidad()` es view transition
 * NATIVA como mejora progresiva — decide en JS ANTES de llamar al API (sin
 * API, o bajo prefers-reduced-motion, la navegación es EXACTAMENTE la de
 * siempre); el overlay no captura el puntero (interrumpible, §20); la
 * limpieza corre gane o se salte la transición; y el destino sólo tiene
 * `view-transition-name` DURANTE la coreografía (cero costo en reposo, cero
 * pares duplicados). NO se usó `experimental.viewTransition` de Next: esa
 * bandera cambia todo el runtime de React al canal experimental — un cambio
 * de motor de toda la app prohibido por el congelamiento funcional de §1.
 *
 * QUÉ NO CUBRE: el morph COMPUTADO en el navegador (lo mide el arnés
 * `scripts/design/medir-continuidad-v15.mjs` con el API real); la segunda
 * cadena de §20 (Result queue → Patient result → Source), declarada para la
 * rebanada siguiente; y los saltos hacia el expediente desde /pacientes o la
 * franja del shell — este guardián vigila la cadena Hoy→Paciente→Encuentro,
 * no exige que TODA navegación se coreografíe.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (ruta: string) => readFileSync(join(process.cwd(), ruta), 'utf8')

const modulo = leer('src/lib/ui/continuidad.ts')
const css = leer('src/app/globals.css')
const template = leer('src/app/(dashboard)/template.tsx')
const hoy = leer('src/app/(dashboard)/dashboard/page.tsx')
const continuidadPanel = leer('src/components/ContinuidadPanel.tsx')
const anchor = leer('src/components/expediente/PatientAnchor.tsx')
const expediente = leer('src/app/(dashboard)/expediente/[patientId]/page.tsx')
const consulta = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')

describe('el mecanismo decide ANTES de llamar al API (mejora progresiva)', () => {
  it('sin startViewTransition o bajo reduced-motion, navega a secas', () => {
    // La consulta a matchMedia es la MISMA política que comportamientoScroll:
    // el apagador CSS de §24 no llega al JS, así que el JS pregunta solo.
    expect(modulo).toMatch(/prefers-reduced-motion:\s*reduce/)
    expect(modulo).toMatch(/typeof document\.startViewTransition !== 'function'/)
    // El camino sin coreografía ejecuta la MISMA navegación (no una copia).
    expect(modulo).toMatch(/if \(!puedeCoreografiar\(\)\) \{\s*navegar\(\)\s*return\s*\}/)
  })

  it('la coreografía NUNCA decide el destino: navegar() viene de fuera', () => {
    // El módulo no conoce rutas: cero router, cero href — sólo ejecuta el
    // callback que le dan (los comentarios sí pueden nombrar router.push
    // para explicar; el CÓDIGO no). Si alguien le mete un push propio, falla.
    const codigo = modulo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    expect(codigo).not.toMatch(/useRouter|router\.|href|next\/navigation/)
  })

  it('un salto congelado no congela la interfaz: hay tope de espera', () => {
    expect(modulo).toMatch(/TOPE_ESPERA_MS = \d+/)
    expect(modulo).toMatch(/setTimeout/)
  })

  it('la limpieza corre gane o se salte la transición', () => {
    // `finished` rechaza cuando otra navegación interrumpe: interrumpirse es
    // comportamiento correcto (§20), pero el atributo y el nombre inline no
    // pueden quedarse puestos.
    expect(modulo).toMatch(/finished\.catch\(\(\) => \{\}\)\.then\(limpiar\)/)
    expect(modulo).toMatch(/removeAttribute\(ATRIBUTO_VT\)/)
  })

  it('ctrl/cmd/shift/alt y botón central conservan su pestaña', () => {
    expect(modulo).toMatch(/esClickDeNavegacionSimple/)
    expect(modulo).toMatch(/metaKey[\s\S]*ctrlKey[\s\S]*shiftKey[\s\S]*altKey/)
  })
})

describe('la hoja hace la coreografía interrumpible y apagable (§20 + §24)', () => {
  it('el overlay de la transición NO captura el puntero', () => {
    expect(css).toMatch(/::view-transition\s*\{\s*pointer-events:\s*none;?\s*\}/)
  })

  it('el destino sólo tiene nombre DURANTE la coreografía', () => {
    // Gateado por el atributo que pone/quita continuidad.ts — en reposo no
    // existe ningún view-transition-name en la hoja.
    expect(css).toMatch(
      /html\[data-vt-continuidad\] \.nx-vt-paciente \{ view-transition-name: nx-paciente; \}/,
    )
    const enReposo = css
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/html\[data-vt-continuidad\][^{]*\{[^}]*\}/g, '')
      .replace(/::view-transition[^{]*\{[^}]*\}/g, '')
    expect(enReposo).not.toMatch(/view-transition-name/)
  })

  it('una sola voz por navegación: el crossfade del template se calla', () => {
    expect(css).toMatch(/html\[data-vt-continuidad\] \.page-transition \{ animation: none; \}/)
  })

  it('duraciones y curva hablan los tokens: raíz normal, objeto lento', () => {
    const raiz = /::view-transition-old\(root\),\s*::view-transition-new\(root\) \{[^}]*var\(--mov-normal\)[^}]*var\(--mov-curva\)[^}]*\}/
    const grupo = /::view-transition-group\(nx-paciente\) \{[^}]*var\(--mov-lento\)[^}]*var\(--mov-curva\)[^}]*\}/
    expect(css).toMatch(raiz)
    expect(css).toMatch(grupo)
  })

  it('§24: el apagador global con * no alcanza los pseudo-elementos — se apagan aparte', () => {
    const reduce = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(reduce).toMatch(/::view-transition-group\(\*\)/)
    expect(reduce).toMatch(/::view-transition-old\(\*\)/)
    expect(reduce).toMatch(/::view-transition-new\(\*\)/)
    expect(reduce).toMatch(/animation-duration:\s*0\.01ms\s*!important/)
  })
})

describe('la señal de commit viene del template (se remonta en cada navegación)', () => {
  it('template.tsx avisa rutaComprometida() al montarse', () => {
    expect(template).toMatch(/rutaComprometida/)
    expect(template).toMatch(/useEffect\(\(\) => \{ rutaComprometida\(\) \}, \[\]\)/)
  })
})

describe('la cadena Hoy→Paciente→Encuentro está cableada', () => {
  it('Hoy: el botón Consulta de la fila y el CTA del héroe coreografían con el .nx-ident como origen', () => {
    expect(hoy).toMatch(/navegarConContinuidad/)
    // La fila: el origen es el nombre de ESA fila.
    expect(hoy).toMatch(/closest\('\.cita-fila'\)\?\.querySelector<HTMLElement>\('\.nx-ident'\)/)
    // El héroe: click simple intercepta, modificadores pasan de largo.
    expect(hoy).toMatch(/closest\('\.prox-hero'\)\?\.querySelector<HTMLElement>\('\.nx-ident'\)/)
    expect(hoy).toMatch(/esClickDeNavegacionSimple/)
  })

  it('Hoy: la fila de continuidad sólo coreografía cuando HAY paciente', () => {
    expect(continuidadPanel).toMatch(/navegarConContinuidad/)
    expect(continuidadPanel).toMatch(/if \(!tarea\.patientId \|\| !esClickDeNavegacionSimple\(e\)\) return/)
  })

  it('destinos: el h1 del Patient Anchor y el h1 de la consulta llevan .nx-vt-paciente', () => {
    expect(anchor).toMatch(/className="nx-display nx-ancla-nombre nx-vt-paciente"/)
    expect(consulta).toMatch(/<h1 className="nx-vt-paciente"/)
  })

  it('Paciente→Encuentro: continuar, nueva consulta y abrir nota coreografían (el ancla es el origen automático)', () => {
    const saltos = expediente.match(/navegarConContinuidad/g) ?? []
    expect(saltos.length).toBeGreaterThanOrEqual(4)
  })
})
