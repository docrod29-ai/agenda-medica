/**
 * RTC-04 (V15-ORIGINALITY-REDTEAM-001, registro canónico) — la pila de avisos
 * administrativos del layout se AQUIETA mientras el médico graba (§8.5
 * «nonessential admin disappears»), y la suscripción a `EVENTO_GRABANDO`
 * vive en UNA compuerta compartida, no en copias por componente.
 *
 * ── QUÉ FALLABA Y CÓMO SE DESCUBRIÓ ─────────────────────────────────────────
 *
 * El equipo rojo de §41 (dos paneles concurrentes, 13-ago-2026) encontró el
 * mismo defecto por dos caminos (ORT-06): el banner de cobro de la prueba
 * («Tu prueba gratuita termina en N días» + «Activar plan →») se pintaba a
 * peso ÍNTEGRO dentro del modo encuentro, empujando la franja de alergia
 * hacia abajo, y NINGÚN aviso del layout —correo sin verificar, cobro
 * pendiente, prueba, opt-in de push— reaccionaba a `EVENTO_GRABANDO`,
 * mientras el FlowRail de al lado sí se aquietaba. La decisión v972 del dueño
 * pide que la prueba sea VISIBLE — no que corone la superficie clínica
 * durante el dictado.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Cada pieza del shell que quería reaccionar a la grabación copiaba su propio
 * `useGrabando` privado (FlowRail y BottomNav ya tenían DOS copias idénticas)
 * — la familia `depende_de_recordar`: la siguiente superficie tenía que
 * acordarse de copiarlo, y la pila de avisos no se acordó. RTC-05 nombra la
 * misma causa para los FAB («compuerta compartida, una, no parches»).
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. `useGrabando` vive UNA vez en `@/hooks/useGrabando` y es quien escucha
 *    (add/removeEventListener) el `EVENTO_GRABANDO` del módulo sellado.
 * 2. FlowRail y BottomNav consumen ESA compuerta — sus copias privadas
 *    mueren; ningún componente vuelve a declarar el listener por su cuenta.
 * 3. Los avisos ADMINISTRATIVOS del layout (ModeBanner, correo sin verificar,
 *    cobro pendiente, prueba, opt-in de push) se rinden dentro de una pila
 *    que devuelve null mientras se graba — desaparecen de verdad (§8.5) y
 *    vuelven al detenerse (reversible, regla 3 de seguridad clínica dicha en
 *    interfaz).
 * 4. Los avisos de DEGRADACIÓN (OfflineBanner, AvisoIncidenteIA) quedan
 *    FUERA de la pila a propósito: sin conexión o con la IA caída es
 *    exactamente cuando el médico que está grabando necesita saberlo — son
 *    «lightweight safety state» (§5 capa 1), no admin.
 *
 * Probado al revés: contra el árbol previo a este cambio (avisos sueltos en
 * el layout, dos copias privadas del hook) la suite ni carga sin el hook
 * compartido, y con SÓLO el hook creado —refactor sin aplicar— fallan 6 de
 * los 9 casos. Verificado en esta corrida ANTES de aplicar el arreglo.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · Análisis estático de fuente, como sus guardianes hermanos (el repo no usa
 *   @testing-library/react): que los avisos desaparecen y REAPARECEN de
 *   verdad en el DOM lo verifica el arnés de navegador real
 *   (`scripts/design/capturar-avisos-quietos-v15.mjs`).
 * · No cubre los FAB (BotonAyuda / tema): eso es RTC-05, la siguiente deuda
 *   del registro, que consumirá esta misma compuerta.
 * · No cubre el aviso de módulo bloqueado (`AvisoModuloBloqueado`): es un
 *   diálogo transitorio disparado por una acción del propio médico, no un
 *   listón permanente sobre la superficie clínica.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const HOOK = leer('src/hooks/useGrabando.ts')
const LAYOUT = leer('src/app/(dashboard)/layout.tsx')
const FLOW_RAIL = leer('src/components/FlowRail.tsx')
const BOTTOM_NAV = leer('src/components/BottomNav.tsx')

describe('RTC-04 — la compuerta compartida existe y es la ÚNICA que escucha', () => {
  it('el hook importa EVENTO_GRABANDO del módulo sellado, no un string propio', () => {
    expect(HOOK).toContain(
      "import { EVENTO_GRABANDO, type DetalleDeEscucha } from '@/lib/seguridad/estoy-grabando'"
    )
    expect(HOOK).not.toMatch(/addEventListener\(['"]/)
  })

  it('el hook escucha y limpia el listener (add + remove del mismo evento)', () => {
    expect(HOOK).toMatch(/window\.addEventListener\(EVENTO_GRABANDO, alSonar\)/)
    expect(HOOK).toMatch(/window\.removeEventListener\(EVENTO_GRABANDO, alSonar\)/)
  })

  it('FlowRail consume la compuerta compartida y ya no declara la suya', () => {
    expect(FLOW_RAIL).toContain("import { useGrabando } from '@/hooks/useGrabando'")
    expect(FLOW_RAIL).not.toMatch(/function useGrabando/)
    expect(FLOW_RAIL).not.toMatch(/addEventListener\(EVENTO_GRABANDO/)
  })

  it('BottomNav consume la compuerta compartida y ya no declara la suya', () => {
    expect(BOTTOM_NAV).toContain("import { useGrabando } from '@/hooks/useGrabando'")
    expect(BOTTOM_NAV).not.toMatch(/function useGrabando/)
    expect(BOTTOM_NAV).not.toMatch(/addEventListener\(EVENTO_GRABANDO/)
  })
})

describe('RTC-04 — la pila de avisos administrativos se aquieta al grabar', () => {
  const inicioPila = LAYOUT.indexOf('function PilaDeAvisosAdmin')
  const finPila = LAYOUT.indexOf('\n}', inicioPila)
  const pila = inicioPila >= 0 ? LAYOUT.slice(inicioPila, finPila) : ''

  it('la pila existe y devuelve null mientras se graba', () => {
    expect(inicioPila).toBeGreaterThanOrEqual(0)
    expect(pila).toMatch(/useGrabando\(\)/)
    expect(pila).toMatch(/if \(grabando\) return null/)
  })

  it('los cinco avisos administrativos viven DENTRO de la pila', () => {
    for (const aviso of [
      '<ModeBanner />',
      '<AvisoCorreoSinVerificar />',
      '<AvisoCobroPendiente />',
      '<TrialBanner />',
      '<NotificacionesPushOptIn />',
    ]) {
      expect(pila).toContain(aviso)
    }
  })

  it('ningún aviso administrativo queda suelto fuera de la pila', () => {
    const fueraDePila = LAYOUT.slice(0, inicioPila) + LAYOUT.slice(finPila)
    for (const aviso of [
      '<ModeBanner />',
      '<AvisoCorreoSinVerificar />',
      '<AvisoCobroPendiente />',
      '<TrialBanner />',
      '<NotificacionesPushOptIn />',
    ]) {
      expect(fueraDePila).not.toContain(aviso)
    }
  })

  it('los avisos de DEGRADACIÓN (offline, IA caída) quedan FUERA de la pila — el que graba los necesita', () => {
    expect(pila).not.toContain('OfflineBanner')
    expect(pila).not.toContain('AvisoIncidenteIA')
    const fueraDePila = LAYOUT.slice(0, inicioPila) + LAYOUT.slice(finPila)
    expect(fueraDePila).toContain('<OfflineBanner />')
    expect(fueraDePila).toContain('<AvisoIncidenteIA')
  })

  it('el layout consume la MISMA compuerta compartida, no un listener propio', () => {
    expect(LAYOUT).toContain("import { useGrabando } from '@/hooks/useGrabando'")
    expect(LAYOUT).not.toMatch(/addEventListener\(EVENTO_GRABANDO/)
  })
})
