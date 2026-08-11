/**
 * V15-ENCOUNTER-MODE-001 (Fase 5, §8.5 «nonessential admin disappears») —
 * el menú de motor de IA y los tres avisos de créditos/plan dejan de tener
 * el mismo peso visual DURANTE la grabación real.
 *
 * ── QUÉ PROTEGE ─────────────────────────────────────────────────────────────
 *
 * La medición de baseline de esta fase (`agent-state/V15_CURRENT_ITERATION.md`,
 * hallazgo #5) dejó anotado que el admin DENTRO de `/consulta/[patientId]`
 * (menú de motor de IA, banner de créditos/plan, enlaces a `/precios`)
 * seguía con su peso completo durante la grabación — la primera rebanada de
 * esta fase (§8.1) sólo cubrió el shell persistente (FlowRail/InstrumentStrip).
 *
 * Al medir esta rebanada apareció algo más grave que "peso visual": el
 * MENÚ DE IA (selector de motor + medidor de créditos) usaba
 * `!voz.grabando` como compuerta — que sólo cubre la ruta de Web Speech.
 * Con el grabador real (diarización/Whisper, la ruta primaria de
 * `voice-asr.md`), `voz.transcripcion` se llena EN VIVO desde
 * `audio.transcripcionParcial` (efecto en `page.tsx`, línea ~530) mientras
 * `voz.grabando` se queda en `false` — así que el menú de motor de IA SÍ se
 * mostraba con su peso íntegro durante una grabación de audio real, no sólo
 * durante la grabación por voz del navegador.
 *
 * Este guardián protege la forma corregida:
 *
 * 1. El menú de motor de IA usa `!grabandoAhora()` — el MISMO criterio de
 *    "activo" que ya usa el resto de la página (`audio.estado === 'grabando'
 *    || audio.estado === 'pausado' || voz.grabando`; pausado cuenta como
 *    activo, igual que en `estoy-grabando.ts`) — no un criterio nuevo.
 * 2. Los tres avisos de créditos/plan (tope duro agotado, modo económico,
 *    candado de gasto suave) — que antes no tenían NINGUNA compuerta de
 *    grabación y quedaban visibles sin condición — ahora comparten el mismo
 *    `!grabandoAhora()`. Esto también apaga sus dos enlaces a `/precios` y
 *    el botón "Comprar más créditos": administrativo, no clínico, y
 *    ninguno de los dos recibe foco durante el dictado activo.
 * 3. `grabandoAhora` en sí NO cambió — sigue siendo la misma función
 *    (freeze funcional): este guardián es sólo la compuerta que la usa en
 *    cuatro sitios más.
 *
 * Probado al revés: contra `git show HEAD:` previo a este cambio, el menú
 * de IA usaba `!voz.grabando` (no `!grabandoAhora()`) y los tres avisos no
 * llevaban ninguna compuerta de grabación — los cuatro casos de la primera
 * suite fallan contra esa versión.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * · No renderiza React ni dispara el evento en jsdom: análisis estático de
 *   fuente, mismo patrón que el resto de guardianes `v15-*` de esta fase (el
 *   repo no usa @testing-library/react).
 * · No cubre `BottomNav.tsx` (móvil) — deuda ya anotada para
 *   `V15-MOBILE-001` (Fase 9).
 * · No cubre las dos familias de violaciones axe preexistentes
 *   (`landmark-unique`, `region`) — candidatas a `V15-A11Y-001`.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const PAGE = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'),
  'utf8',
)

describe('V15 — admin no esencial de /consulta se calla mientras graba', () => {
  it('el menú de motor de IA usa grabandoAhora(), no sólo voz.grabando (cubre la ruta de audio real)', () => {
    expect(PAGE).toContain("{voz.transcripcion.trim() && !grabandoAhora() && (")
    // El criterio viejo, que sólo cubría Web Speech, no debe quedar como
    // compuerta activa de este bloque.
    expect(PAGE).not.toContain('{voz.transcripcion.trim() && !voz.grabando && (')
  })

  it('el aviso de créditos AGOTADOS (tope duro) se calla mientras graba/pausa', () => {
    expect(PAGE).toContain('{sinCreditos && !grabandoAhora() && (')
  })

  it('el aviso de modo económico se calla mientras graba/pausa', () => {
    expect(PAGE).toContain("{modoEco && !sinCreditos && !grabandoAhora() && (")
  })

  it('el candado de gasto suave (límite del plan) se calla mientras graba/pausa', () => {
    expect(PAGE).toContain("{usoIA && usoIA.alerta !== 'ok' && !grabandoAhora() && (")
  })

  it('grabandoAhora sigue siendo la MISMA función — ningún criterio nuevo de "estoy grabando"', () => {
    expect(PAGE).toContain(
      "const grabandoAhora = () => audio.estado === 'grabando' || audio.estado === 'pausado' || voz.grabando",
    )
  })
})

describe('V15 — freeze funcional: nada de lo que hacen estos bloques cambió', () => {
  it('el menú de motor de IA sigue leyendo motorEfectivo/MOTORES_UI/setMotorSel, sin lógica nueva', () => {
    const inicio = PAGE.indexOf('MENÚ DE IA: motor por nota')
    expect(inicio).toBeGreaterThan(0)
    const bloque = PAGE.slice(inicio, inicio + 2200)
    expect(bloque).toContain('MOTORES_UI.map(m =>')
    expect(bloque).toContain('onClick={() => setMotorSel(m.clave)}')
    expect(bloque).toContain('motorEfectivo === m.clave')
  })

  it('el botón "Comprar más créditos" y el enlace "Ver planes" conservan su onClick/href de siempre', () => {
    expect(PAGE).toContain('onClick={comprarRecarga} disabled={comprandoRecarga}')
    expect(PAGE).toContain('<a href="/precios" target="_blank" rel="noopener noreferrer"')
  })

  it('el texto de los tres avisos no cambió', () => {
    expect(PAGE).toContain('Se acabaron tus consultas con IA del mes')
    expect(PAGE).toContain('Nota generada en modo económico')
    expect(PAGE).toContain('consultas de tu plan este mes')
  })
})
