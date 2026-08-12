/**
 * V15-A11Y-001 (1ª rebanada) — LOS AVISOS DEL SHELL VIVEN EN UN LANDMARK:
 * LA VIOLACIÓN `region` MÁS REPETIDA DE LA RAMA MUERE EN SU ORIGEN.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `TrialBanner` (las DOS variantes: cuenta regresiva y prueba vencida),
 * `ModeBanner` (el listón «Modo Asistente») y `OfflineBanner` se pintaban como
 * `<div>` pelones entre la topbar y `<main>`: contenido fuera de TODO landmark.
 * axe lo marca como `region` (moderate, WCAG best-practice) — y fue el hallazgo
 * MÁS REPETIDO de toda la rama V15: apareció en TODAS las mediciones de
 * superficie de las fases 3-11 (Hoy, /pacientes, expediente, consulta,
 * /pendientes, /resultados, /nota, /receta, /orden, /configuracion,
 * /operaciones…), siempre con el mismo fingerprint «banner de prueba gratuita».
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * No leyendo código: lo cazaron los arneses de navegador real (axe contra la
 * app de producción con emuladores) corrida tras corrida, y cada corrida lo
 * anotaba como «preexistente, candidato a V15-A11Y-001». Al abrir esa
 * iteración, el inventario del estado (`agent-state/V15_CURRENT_ITERATION.md`)
 * lo nombró primera rebanada por ser deuda de SHELL: un arreglo, todas las
 * superficies limpias.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * La regla `region` de axe-core exige que todo contenido perceptible viva
 * dentro de un landmark — o de una live region: su `isRegion()` acepta
 * `role="alert" | "log" | "status"` y `aria-live` además de los landmarks
 * clásicos (verificado en el fuente de axe-core instalado, no en docs). La
 * MITAD de los avisos del shell ya lo hablaba (`AvisoCobroPendiente`,
 * `AvisoCorreoSinVerificar`, `AvisoIncidenteIA` → `role="status"`;
 * `NotificacionesPushOptIn` → `role="region"` con nombre; `InstrumentStrip` →
 * `role="status"`); los tres que quedaron fuera eran anteriores a esa familia
 * o nunca aparecían en el camino feliz (OfflineBanner sólo sin red, ModeBanner
 * sólo en modo asistente) y nadie los alcanzó a medir hasta que el banner de
 * prueba —visible en CADA captura del demo— repitió el hallazgo 15 corridas.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Todo listón de aviso que el layout del dashboard monte entre la topbar y
 * `<main>` declara una voz de live region (`role="status"` es la casa) o un
 * landmark con nombre. `OfflineBanner` además GANA semántica de verdad: al
 * caerse la red aparece en caliente y el lector de pantalla lo anuncia sin
 * robar el foco.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * No corre axe: la medición real vive en el arnés
 * `scripts/design/capturar-avisos-landmark-v15.mjs` (navegador real, dos
 * temas, móvil, y con la red cortada para ver OfflineBanner). No vigila
 * avisos montados FUERA del layout del dashboard (los toasts tienen su propio
 * `role`), ni impide que un aviso NUEVO nazca sin voz — eso lo caza el arnés
 * la próxima vez que mida la superficie donde aparezca. Tampoco cubre el
 * resto del backlog de V15-A11Y-001 (formulario de /referencia sin etiquetas,
 * contrastes de /chat, DEBT-008 del papel de receta): esas son rebanadas
 * siguientes.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const layout = readFileSync(join('src', 'app', '(dashboard)', 'layout.tsx'), 'utf8')

/** Segmento de una función del layout, sin comentarios. */
function segmento(nombre: string): string {
  const inicio = layout.indexOf(`function ${nombre}()`)
  expect(inicio, `${nombre} ya no existe en layout.tsx`).toBeGreaterThan(-1)
  const resto = layout.slice(inicio + 1)
  const siguiente = resto.search(/\nfunction |\nexport (default )?function /)
  const seg = siguiente === -1 ? resto : resto.slice(0, siguiente)
  return seg.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*/g, '')
}

function sinComentarios(ruta: string): string {
  return readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*/g, '')
}

describe('V15-A11Y-001 — los avisos del shell viven en un landmark', () => {
  it('TrialBanner: las DOS variantes (vencida y cuenta regresiva) hablan role="status"', () => {
    const seg = segmento('TrialBanner')
    const voces = seg.match(/role="status"/g) ?? []
    expect(voces.length, 'una por variante: vencida + cuenta regresiva').toBeGreaterThanOrEqual(2)
    // Y ninguna de las dos vuelve a ser un div pelón: el primer JSX de cada
    // return es el div del listón, y debe llevar la voz pegada.
    expect(seg).not.toMatch(/return \(\s*<div style=/)
  })

  it('ModeBanner habla role="status"', () => {
    const seg = segmento('ModeBanner')
    expect(seg).toContain('role="status"')
    expect(seg).not.toMatch(/return \(\s*<div style=/)
  })

  it('OfflineBanner habla role="status" y su icono es decorativo', () => {
    const src = sinComentarios(join('src', 'components', 'OfflineBanner.tsx'))
    expect(src).toContain('role="status"')
    expect(src).toContain('aria-hidden="true"')
  })

  it('la familia que YA hablaba conserva su voz (nadie retrocede)', () => {
    expect(segmento('AvisoCobroPendiente')).toContain('role="status"')
    const correo = sinComentarios(join('src', 'components', 'AvisoCorreoSinVerificar.tsx'))
    expect(correo).toContain('role="status"')
    const incidente = sinComentarios(join('src', 'components', 'AvisoIncidenteIA.tsx'))
    expect(incidente).toContain('role="status"')
    const push = sinComentarios(join('src', 'components', 'NotificacionesPushOptIn.tsx'))
    expect(push).toContain('role="region"')
    expect(push).toMatch(/role="region" aria-label=/)
    const franja = sinComentarios(join('src', 'components', 'InstrumentStrip.tsx'))
    expect((franja.match(/role="status"/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it('congelado funcional: dar voz no cambió conducta', () => {
    // OfflineBanner: mismo gate y mismos oídos de conectividad.
    const offline = sinComentarios(join('src', 'components', 'OfflineBanner.tsx'))
    expect(offline).toContain("addEventListener('online', update)")
    expect(offline).toContain("addEventListener('offline', update)")
    expect(offline).toContain('if (!offline) return null')
    // ModeBanner: sólo asistente.
    expect(segmento('ModeBanner')).toContain("if (mode !== 'secretaria') return null")
    // TrialBanner: misma compuerta de plan, mismos destinos (el detalle de
    // color/conducta lo vigila v15-trial-banner-tokens-por-tema.test.ts).
    const trial = segmento('TrialBanner')
    expect(trial).toContain("clinic.plan !== 'trial'")
    expect((trial.match(/href="\/configuracion\?tab=suscripcion"/g) ?? []).length).toBe(2)
  })
})
