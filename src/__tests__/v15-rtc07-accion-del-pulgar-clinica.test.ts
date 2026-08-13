/**
 * RTC-07 (V15-ORIGINALITY-REDTEAM-001, registro canónico; ORT-04 + RT-11) —
 * la acción del pulgar respeta el contexto clínico, y el header de Hoy no la
 * duplica en móvil.
 *
 * ── QUÉ FALLABA Y CÓMO SE DESCUBRIÓ ─────────────────────────────────────────
 *
 * El equipo rojo (13-ago-2026, hoy-movil.png) midió el shell móvil al revés:
 *
 * · La acción central del BottomNav —el círculo relleno ELEVADO de la zona del
 *   pulgar, la corona que §8.6 reserva para la entrada al encuentro— pintaba
 *   «Nueva cita» (ADMIN → /asistente) en Hoy, Pendientes y Operaciones. La
 *   corona clínica coronaba una acción administrativa en 4 de 6 superficies.
 * · En Hoy, «Nueva cita» aparecía DOS veces en el primer viewport móvil: el
 *   CTA del header y el FAB central — la acción admin con la emisión máxima
 *   2×, destronando a «Iniciar consulta» (la clínica).
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. La CORONA (círculo relleno elevado) sólo se pinta cuando la acción
 *    central ES clínica: `centralCoronada(kind)` — true sólo para
 *    `'consulta'` (en un expediente/consulta, la consulta de ESE paciente).
 * 2. Fuera de contexto clínico, «Nueva cita» SIGUE en el centro (misma
 *    posición, mismo href, mismo táctil ≥44px — equivalencia funcional),
 *    pero con el peso de un destino normal: el énfasis codifica el
 *    significado (clínico vs admin), no la posición.
 * 3. Sin corona, la acción central es admin: se aquieta al GRABAR como los
 *    demás íconos (`iconoAtenuado(quieto, coronada)`). La coronada nunca se
 *    atenúa: es la entrada al encuentro (§8.6).
 * 4. El CTA «Nueva cita» del header de Hoy se suprime en móvil (≤768px): la
 *    misma acción ya vive en la barra del pulgar. En escritorio (sin
 *    BottomNav) el header la conserva.
 * 5. Alcance: el shell V15 del MÉDICO (`navPrimaria`). En la barra heredada
 *    de Secretaria «Nueva cita» ES su trabajo primario — su barra conserva
 *    la conducta anterior completa, el mismo alcance que ya tiene `quieto`.
 *
 * Probado al revés: contra el árbol previo a este cambio fallan los casos
 * 1, 2, 3 y 5 (verificado en esta corrida antes de aplicar el arreglo; el 4
 * pasa solo porque `accionContextual` no cambió — eso es la equivalencia).
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · El peso PINTADO y la supresión real del header los mide el arnés de
 *   navegador (`capturar-pulgar-y-fabs-v15.mjs`) con getComputedStyle.
 * · No cubre los FAB flotantes de ayuda/tema (RTC-05, guardián hermano).
 * · No decide si «Nueva cita» merece el centro en absoluto (esa pregunta es
 *   de IA de navegación, no de énfasis; quedaría para el registro si el
 *   equipo rojo la levanta).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { accionContextual, centralCoronada, iconoAtenuado } from '@/components/BottomNav'

const BOTTOM_NAV = readFileSync(join(process.cwd(), 'src/components/BottomNav.tsx'), 'utf8')
const CSS = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')

describe('RTC-07 — la corona del pulgar es clínica, no admin', () => {
  it('1 · centralCoronada: sólo la consulta de un paciente lleva la corona', () => {
    expect(centralCoronada('consulta')).toBe(true)
    expect(centralCoronada('cita')).toBe(false)
  })

  it('2 · el JSX decide la corona con centralCoronada — sólo en el shell V15 del médico', () => {
    // Para Secretaria «Nueva cita» ES su trabajo primario: su barra conserva
    // la corona (la conducta heredada completa, mismo alcance que `quieto`).
    expect(BOTTOM_NAV).toMatch(/const coronada = navPrimaria \? centralCoronada\(accion\.kind\) : true/)
    // El círculo relleno elevado (marginTop negativo + fondo sólido) vive
    // dentro del render condicional de la corona…
    const central = BOTTOM_NAV.slice(BOTTOM_NAV.indexOf('coronada ?'), BOTTOM_NAV.indexOf('{der.map'))
    expect(central).toContain('marginTop: -18')
    expect(central).toContain('var(--nexus-solido)')
    // …y la variante sin corona no pinta fondo sólido ni elevación.
    const sinCorona = central.slice(central.indexOf(') : ('))
    expect(sinCorona).not.toContain('var(--nexus-solido)')
    expect(sinCorona).not.toContain('marginTop: -18')
  })

  it('3 · sin corona la acción es admin y se aquieta al grabar; coronada, nunca', () => {
    // La misma compuerta que los destinos: iconoAtenuado(quieto, coronada).
    expect(BOTTOM_NAV).toMatch(/iconoAtenuado\(quieto, coronada\)/)
    // grabando + admin (sin corona) → se atenúa; grabando + corona → no.
    expect(iconoAtenuado(true, false)).toBe(true)
    expect(iconoAtenuado(true, true)).toBe(false)
  })

  it('4 · equivalencia funcional: los destinos de accionContextual no cambiaron', () => {
    expect(accionContextual('/expediente/abc')).toEqual({ label: 'Consulta', href: '/consulta/abc', kind: 'consulta' })
    expect(accionContextual('/consulta/xyz')).toEqual({ label: 'Consulta', href: '/consulta/xyz', kind: 'consulta' })
    expect(accionContextual('/dashboard')).toEqual({ label: 'Nueva cita', href: '/asistente', kind: 'cita' })
    expect(accionContextual('/pendientes')).toEqual({ label: 'Nueva cita', href: '/asistente', kind: 'cita' })
  })

  it('5 · el header de Hoy suprime «Nueva cita» en móvil — la acción ya vive en el pulgar', () => {
    // La regla vive en el bloque móvil del shell (≤768px), sobre .hoy-accion.
    const idx = CSS.indexOf('.hoy-accion')
    expect(idx).toBeGreaterThan(-1)
    // Busca hacia atrás la media query que la envuelve.
    const antes = CSS.slice(Math.max(0, idx - 600), idx)
    expect(antes).toMatch(/@media \(max-width: 768px\)/)
    const bloque = CSS.slice(idx, CSS.indexOf('}', idx))
    expect(bloque).toContain('display: none')
  })
})
