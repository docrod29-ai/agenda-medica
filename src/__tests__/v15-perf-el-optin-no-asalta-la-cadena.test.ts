/**
 * V15-PERF-001 (§43 orden 15, §8/§15/§19) — el aviso de push sólo se pinta
 * en HOY, nunca sobre la cadena clínica.
 *
 * ── CÓMO SE DESCUBRIÓ EL DEFECTO ────────────────────────────────────────────
 *
 * No lo encontró una queja: lo encontró el BASELINE de percepción de esta
 * iteración (scripts/design/medir-perf-v15.mjs). En las DIEZ mediciones de la
 * cadena clínica (Hoy, /pacientes, expediente, consulta, /pendientes ×
 * escritorio 1×/móvil 4×) el elemento LCP era EL MISMO: el texto «Activa
 * notificaciones del navegador para…». El contenido real pintaba a los
 * 300–600 ms (escritorio) — y a los ~3.3 s una tarjeta con cronómetro fijo de
 * 3 s (`setTimeout(..., 3000)` armado en el layout) se montaba encima de
 * CUALQUIER pantalla de la primera sesión. Incluida la consulta: §8 manda que
 * durante el encuentro lo administrativo no esencial DESAPAREZCA, y la
 * primera sesión del médico es exactamente la prueba de 14 días que el dueño
 * declaró prioridad comercial.
 *
 * La evidencia queda congelada en
 * `docs/design/capturas/v15-perf/antes-del-optin.json` (inmutable, es el
 * ANTES; el baseline vivo se re-mide y cambia).
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. §15: una capacidad se ofrece EN SU CONTEXTO. El único contexto donde un
 *    aviso de recordatorios de citas es contextual es HOY (/dashboard), la
 *    pantalla operativa del día — no el expediente ni la consulta.
 * 2. La ruta se evalúa AL RENDER (usePathname), no al armar el temporizador:
 *    el componente vive en el layout y sobrevive a la navegación; mirar la
 *    ruta sólo al armar pintaría la tarjeta en la pantalla SIGUIENTE si el
 *    médico salió de Hoy con el temporizador pendiente.
 * 3. El programador de avisos (`ProgramadorNotificaciones`) conserva su
 *    semántica EXACTA: se monta en cuanto hay permiso, en cualquier ruta —
 *    la restricción es de la TARJETA, no de los recordatorios (equivalencia
 *    funcional §42: quien ya concedió permiso sigue recibiendo avisos igual).
 * 4. El cronómetro de 3 s se queda («no molestar al cargar»): en Hoy sigue
 *    esperando a que la pantalla se asiente antes de preguntar.
 *
 * Probado al revés (git stash del componente): los casos 1–3 fallan contra el
 * árbol previo — no había usePathname, ni gate de ruta en el return temprano.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · Es análisis estático de fuente (patrón de los guardianes v15-*): no
 *   renderiza React. Que la tarjeta de verdad aparezca en Hoy y NO aparezca
 *   en la consulta se mide en navegador real con
 *   `scripts/design/medir-perf-v15.mjs` (el LCP deja de ser la tarjeta en
 *   las rutas clínicas) y `scripts/design/capturar-push-optin-v15.mjs`
 *   (la tarjeta sigue viva y usable en su pantalla).
 * · No cubre la lógica de permisos de Notification API ni el contenido del
 *   aviso — esta rebanada no los tocó.
 * · No cubre pantallas fuera del layout del panel (login, portal): ahí el
 *   componente no se monta y nunca se montó.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const BANNER = readFileSync(
  join(process.cwd(), 'src/components/NotificacionesPushOptIn.tsx'),
  'utf8',
)

describe('V15-PERF — el opt-in de push no asalta la cadena clínica', () => {
  it('1. la ruta se lee al RENDER con usePathname, no al armar el temporizador', () => {
    expect(BANNER).toContain("import { usePathname } from 'next/navigation'")
    expect(BANNER).toContain('const pathname = usePathname()')
    // El gate NO puede vivir dentro del useEffect que arma el temporizador:
    // ahí se congelaría la ruta del momento de armado.
    const efecto = BANNER.slice(
      BANNER.indexOf('useEffect(() => {'),
      BANNER.indexOf('}, [])'),
    )
    expect(efecto).not.toContain('pathname')
  })

  it('2. el return temprano exige HOY: sin /dashboard no hay tarjeta', () => {
    expect(BANNER).toContain("const enHoy = pathname === '/dashboard'")
    expect(BANNER).toMatch(/if \(!visible \|\| !enHoy\)/)
  })

  it('3. el programador conserva su semántica: se monta con permiso en CUALQUIER ruta', () => {
    // El return temprano —la rama que corre fuera de Hoy— sigue montando el
    // programador si hay permiso: los recordatorios no dependen de la ruta.
    expect(BANNER).toMatch(
      /if \(!visible \|\| !enHoy\) return concedido \? <ProgramadorNotificaciones \/> : null/,
    )
  })

  it('4. el cronómetro de cortesía sigue: 3 s antes de preguntar', () => {
    expect(BANNER).toMatch(/setTimeout\(\(\) => setVisible\(true\), 3000\)/)
  })

  it('5. la evidencia del ANTES está congelada: las 10 mediciones tenían la tarjeta de LCP', () => {
    const antes = JSON.parse(
      readFileSync(
        join(process.cwd(), 'docs/design/capturas/v15-perf/antes-del-optin.json'),
        'utf8',
      ),
    )
    expect(antes.corridas).toHaveLength(10)
    for (const c of antes.corridas) {
      expect(c.lcpElemento, `${c.corrida}/${c.pantalla}`).toContain('Activa notificaciones')
    }
  })
})
