/**
 * V15-VISUAL-SYSTEM-001 (Fase 10, sexta rebanada) — EL TRIALBANNER HABLA
 * TOKENS POR TEMA, NO HEXADECIMALES DE FONDO OSCURO.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `TrialBanner` (el aviso «Tu prueba gratuita termina en N días» del layout del
 * dashboard) pintaba su texto y su CTA con `#f59e0b`/`#f87171`: colores
 * pensados PARA fondo oscuro. En tema claro, `#f59e0b` sobre el tinte crema del
 * banner mide ~2.2:1 — la ÚNICA violación axe `color-contrast` que apareció en
 * TODAS las mediciones de superficie de la Fase 10 (rebanadas 2, 3, 4 y 5,
 * fingerprint idéntico byte a byte entre corridas).
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * No leyendo el código: la cazaron los arneses de navegador real de la fase
 * (axe en los DOS temas), cuatro corridas seguidas, siempre el mismo span.
 * Es exactamente la familia de defecto que `color-trinquete.test.ts` existe
 * para impedir — este banner era deuda anterior al trinquete.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * Un hexadecimal no cambia de tema. Y el arreglo no era «usar var(--amber)» a
 * secas: medido con la fórmula de luminancia WCAG 2.1, el ámbar COMO TEXTO
 * sobre el tinte del banner falla en claro incluso con el token (#B45309 →
 * ~4.3:1 < 4.5). Por eso el arreglo tiene tres partes:
 *
 *   1. el MENSAJE va en `var(--text)` (como ya hacía la variante de prueba
 *      vencida del mismo banner); la urgencia la dicen icono + tinte + CTA;
 *   2. el ICONO usa `var(--red)`/`var(--amber)` — es no-textual (umbral 3:1,
 *      pasa en los dos temas);
 *   3. el CTA de relleno sólido usa `--sobre-aviso`, token NUEVO definido por
 *      tema: tinta (#0B0C0E) sobre el ámbar oscuro, blanco sobre el ámbar
 *      profundo del claro. Un solo literal no podía servir a los dos.
 *
 * ── EL SEGUNDO NODO, IDENTIFICADO POR EL ARNÉS DE ESTA MISMA REBANADA ───────
 *
 * La corrida de la cuarta rebanada midió DOS nodos en /pacientes y atribuyó el
 * segundo al CTA del banner — recortaba los datos de axe y no se podía saber.
 * El arnés de ésta guarda el failureSummary completo y el segundo nodo resultó
 * ser OTRA superficie: el chip activo del directorio («Recientes (5)») con
 * `#000` sobre `var(--teal)` — 2.99:1 en claro, porque --teal es el token de
 * TRAZO (#12626E en claro) y no está pensado para ser fondo. El relleno con
 * su texto medido en los dos temas ya existía: `--nexus-solido` + blanco
 * (5.16:1 oscuro, 7.0:1 claro — el mismo par de .btn-primary). Se vigila aquí
 * abajo porque es el mismo hallazgo axe que esta rebanada paga.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * No mide el contraste computado en un navegador — eso lo hace el arnés
 * `scripts/design/capturar-trial-banner-v15.mjs` (axe real, dos temas). No
 * vigila otros banners del layout (SinTarjetaBanner ya usaba tokens), ni los
 * ~250 hexadecimales restantes del repositorio — de ésos se ocupa el techo de
 * `color-trinquete.test.ts`, que esta rebanada BAJÓ.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const layout = readFileSync(join('src', 'app', '(dashboard)', 'layout.tsx'), 'utf8')
const css = readFileSync(join('src', 'app', 'globals.css'), 'utf8')

/** El segmento de TrialBanner, sin comentarios (la explicación no es deuda). */
function segmentoTrialBanner(): string {
  const inicio = layout.indexOf('function TrialBanner()')
  expect(inicio, 'TrialBanner ya no existe en layout.tsx').toBeGreaterThan(-1)
  const resto = layout.slice(inicio + 1)
  const siguiente = resto.search(/\nfunction |\nexport (default )?function /)
  const seg = siguiente === -1 ? resto : resto.slice(0, siguiente)
  return seg.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*/g, '')
}

describe('V15 — TrialBanner habla tokens por tema', () => {
  const seg = segmentoTrialBanner()

  it('los hexadecimales de fondo oscuro no vuelven al banner', () => {
    // Los dos que medía axe, y de paso toda la familia con token equivalente.
    expect(seg).not.toMatch(/#f59e0b/i)
    expect(seg).not.toMatch(/#f87171/i)
    expect(seg).not.toMatch(/#(d97706|b45309|fbbf24|ef4444|dc2626|b91c1c)\b/i)
  })

  it('el texto del CTA tampoco es un negro pegado', () => {
    // color: '#000' sobre var(--amber) se hunde a ~3.5:1 en el ámbar del claro.
    expect(seg).not.toContain("'#000'")
  })

  it('el icono habla var(--red)/var(--amber) según la urgencia', () => {
    expect(seg).toContain("color={daysLeft <= 3 ? 'var(--red)' : 'var(--amber)'}")
  })

  it('el mensaje va en var(--text): el ámbar como texto no pasa AA en claro', () => {
    expect(seg).toContain("fontSize: 13, color: 'var(--text)'")
    // Y no queda NINGÚN color que dependa del tema mal puesto en el span.
    expect(seg).not.toMatch(/color:\s*daysLeft[^}]*['"]#/)
  })

  it('los dos CTA usan el token --sobre-aviso encima de su relleno sólido', () => {
    const usos = seg.match(/color: 'var\(--sobre-aviso\)'/g) ?? []
    expect(usos.length, 'el CTA de la variante vencida Y el de la cuenta regresiva').toBe(2)
    expect(seg).toContain("background: daysLeft <= 3 ? 'var(--red)' : 'var(--amber)'")
    expect(seg).toContain("background: 'var(--amber)'")
  })

  it('--sobre-aviso está definido en los dos temas (y en papel)', () => {
    const defs = (css.match(/--sobre-aviso:\s*#[0-9A-Fa-f]{6}/g) ?? [])
      .map(d => d.replace(/\s+/g, ' '))
    // :root oscuro + [data-theme="light"] + prefers-color-scheme light + print.
    expect(defs.length).toBeGreaterThanOrEqual(4)
    expect(defs).toContain('--sobre-aviso: #0B0C0E')
    expect(defs.filter(d => d.toUpperCase().endsWith('#FFFFFF')).length).toBeGreaterThanOrEqual(3)
  })

  it('el chip activo de /pacientes es relleno sólido, no trazo con negro', () => {
    // El segundo nodo del hallazgo axe (ver cabecera): --teal + #000 medía
    // 2.99:1 en claro. Relleno --nexus-solido con blanco, como .btn-primary.
    const pacientes = readFileSync(join('src', 'app', '(dashboard)', 'pacientes', 'page.tsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*/g, '')
    expect(pacientes).toContain("background: activo ? 'var(--nexus-solido)' : 'var(--s2)'")
    expect(pacientes).toContain("color: activo ? '#fff' : 'var(--text2)'")
    expect(pacientes).not.toContain("activo ? 'var(--teal)'")
    expect(pacientes).not.toContain("activo ? '#000'")
  })

  it('congelado funcional: el banner sigue diciendo y enlazando lo mismo', () => {
    // Mismos destinos, mismos textos, misma compuerta de plan y mismo cómputo
    // de días: esta rebanada era de color, no de conducta.
    const enlaces = seg.match(/href="\/configuracion\?tab=suscripcion"/g) ?? []
    expect(enlaces.length).toBe(2)
    expect(seg).toContain('Activar mi plan')
    expect(seg).toContain('Activar plan →')
    expect(seg).toContain("clinic.plan !== 'trial'")
    expect(seg).toContain('estadoPaywall(')
    expect(seg).toContain('Math.max(0, Math.ceil(')
  })
})
