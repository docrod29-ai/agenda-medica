/**
 * V15-A11Y-001, cuarta rebanada — contrastes de /chat por token de tema, y
 * los widgets flotantes que no tapan controles.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * 1. El arnés de la sexta rebanada de Fase 9 (v15-chat-al-pulgar) midió en
 *    /chat una familia `color-contrast` (serious, 3 nodos) — anotada para
 *    esta fase con la disciplina de v15-today-continuidad. La re-medición de
 *    esta rebanada (v15-chat-contraste) enseñó la causa: el chat escribía
 *    COLOR FIJO sobre RELLENO TEMÁTICO. `#a78bfa` sólo legible en oscuro
 *    (2.7:1 sobre blanco), `#040b12` sobre `var(--teal)` que en claro es un
 *    relleno PROFUNDO (#12626E → 2.8:1), y alfas de negro (0.7/0.55) que
 *    sobre el teal oscuro medían 3.4–4.5:1.
 *
 * 2. La colisión ya anotada por Fase 9 (toggle sobre el borde de la hoja del
 *    aviso push) resultó tener una hermana PEOR que ningún arnés había
 *    medido: el arnés de diagnóstico de esta rebanada NO PUDO pulsar Enviar
 *    en /chat — «.theme-toggle subtree intercepts pointer events» — en 1440
 *    Y en 390. El composer del lienzo ancla su acción primaria exactamente
 *    en la esquina del widget flotante. Los arneses anteriores no lo vieron
 *    porque pulsaban Enviar con el textarea AÚN ENFOCADO, y con foco el
 *    toggle ya se ocultaba (regla ≤900px): el tap del médico que escribe,
 *    revisa la lista (blur) y LUEGO pulsa Enviar se lo comía el toggle.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * · Color de rol = TOKEN por tema (--teal/--purple/--badge-gris-t), texto
 *   encima = --sobre-aviso (el token que invierte su polaridad por tema:
 *   tinta sobre los rellenos brillantes del oscuro, blanco sobre los
 *   profundos del claro — pareja ya medida por los avisos). Ningún hex ni
 *   alfa de negro fijo sobre un relleno que cambia con el tema.
 * · El toggle: ≥44×44 (§24 — era 38/34, «táctil chico» anotado), cede el
 *   paso al aviso push (misma regla :has que el FAB) y en pantallas-LIENZO
 *   sube hasta librar el composer (92px escritorio / 123px sobre el
 *   BottomNav móvil) — flota sobre contenido desplazable, nunca sobre un
 *   control.
 *
 * Probado al revés (git stash del cambio): los casos 1–5 fallan contra el
 * árbol previo; los de freeze (6a/6b) pasan antes y después — protegen el
 * contrato, no el cambio.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No mide píxeles ni computa contraste: eso lo hace el arnés real
 *   (capturar-chat-contraste-v15.mjs: axe con fg/bg/ratio en oscuro/claro ×
 *   1440/390, click en Enviar SIN foco, cesión al aviso push).
 * · No cubre otros widgets flotantes sobre otros composers futuros: si otra
 *   pantalla-lienzo ancla acciones al borde inferior, hereda las reglas de
 *   .nx-lienzo-completo — pero un composer que NO viva en un lienzo no está
 *   vigilado por esto.
 * · No cubre el alto real del composer (68px es el medido hoy): si el
 *   composer crece, el arnés real lo caza (geometría), no este análisis
 *   estático.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const RAIZ = join(__dirname, '..', '..')
const chat = readFileSync(
  join(RAIZ, 'src', 'app', '(dashboard)', 'chat', 'page.tsx'),
  'utf8',
)
const css = readFileSync(join(RAIZ, 'src', 'app', 'globals.css'), 'utf8')

describe('V15-A11Y-001 · 4ª rebanada — contrastes de /chat y widgets flotantes', () => {
  it('1. los colores de rol son tokens por tema, no hex fijos de un solo tema', () => {
    expect(chat).toMatch(/secretaria:\s*'var\(--purple\)'/)
    expect(chat).toMatch(/\?\?\s*'var\(--badge-gris-t\)'/)
    expect(chat).not.toMatch(/#a78bfa/i)
    expect(chat).not.toMatch(/#94a3b8/i)
  })

  it('2. sobre un relleno de rol escribe --sobre-aviso, nunca tinta ni alfa fijos', () => {
    // El texto de la burbuja propia, la hora, el nombre, la píldora, el
    // avatar y el botón Enviar activo — todos sobre relleno temático.
    expect(chat).toMatch(/color: mio \? 'var\(--sobre-aviso\)' : 'var\(--text\)'/)
    expect(chat).toMatch(/color: mio \? 'var\(--sobre-aviso\)' : 'var\(--text3\)'/)
    expect(chat).toMatch(/color: mio \? 'var\(--sobre-aviso\)' : rolColor/)
    expect(chat).toMatch(/color: 'var\(--sobre-aviso\)', fontWeight: 700/)
    expect(chat).toMatch(/color: texto\.trim\(\) \? 'var\(--sobre-aviso\)' : 'var\(--text3\)'/)
    // Los valores que reprobaban AA no vuelven:
    expect(chat).not.toMatch(/#040b12/i)
    expect(chat).not.toMatch(/rgba\(0,\s*0,\s*0,\s*0\.(7|55|15)\)/)
    expect(chat).not.toMatch(/color: '#000'/)
  })

  it('3. §24 — todo toggle de tema que declare tamaño mide 44×44 (era 38, y 34 en móvil)', () => {
    // Desde RTC-05 el toggle NO flota en el shell móvil (vive en Operaciones),
    // así que el bloque móvil con su 44 propio murió: queda al menos la hoja
    // de escritorio, y NINGUNA hoja puede volver por debajo de 44.
    const reglas = css.match(/\.theme-toggle\s*\{[^}]*\}/g) ?? []
    const conTamano = reglas.filter(r => /width:\s*\d+px/.test(r))
    expect(conTamano.length).toBeGreaterThanOrEqual(1)
    for (const regla of conTamano) {
      expect(regla).toMatch(/width:\s*44px/)
      expect(regla).toMatch(/height:\s*44px/)
    }
  })

  it('4. nada flotante pelea con el aviso push — RTC-32 quitó la causa, no el arbitraje', () => {
    /**
     * Este caso exigía la regla que apartaba FAB y toggle mientras el aviso de
     * push preguntaba (el FAB tapaba su X; el toggle pintaba sobre el borde de
     * la hoja a 390px). RTC-32 midió el cromo flotante y lo retiró del shell
     * entero: `.nx-push-optin` sólo existe dentro del dashboard, y ahí ya no
     * flota nada. El arbitraje se retiró con su causa — dejarlo habría sido
     * una regla de adorno.
     *
     * Lo que este caso protege ahora es el mismo trato, dicho al derecho: en
     * el shell no hay widget fijo que pueda tapar el aviso.
     */
    expect(css).not.toContain('boton-ayuda-fab')
    expect(css).toMatch(/body:has\(\.bottom-nav-wrap\)\s+\.theme-toggle\s*\{\s*display:\s*none;\s*\}/)
  })

  it('5. en pantallas-lienzo NADA se interpone entre el dedo y «Enviar»', () => {
    /**
     * El defecto original (4ª rebanada de V15-A11Y-001): en /chat el toggle
     * caía sobre el botón «Enviar» y el arnés no podía pulsarlo ni en 1440 ni
     * en 390 — «.theme-toggle subtree intercepts pointer events». Se sorteó
     * subiéndolo a 92px, un número medido a mano.
     *
     * RTC-05 mató el parche móvil y RTC-32 el de escritorio, los dos por la
     * misma vía: /chat es una pantalla del shell, y en el shell el toggle no
     * se pinta. La colisión no se negocia mejor — deja de existir.
     *
     * Por eso el caso ya no exige el 92px (exigirlo sería exigir que vuelva el
     * problema que lo justificaba) sino la condición que lo hace imposible.
     */
    expect(css).not.toContain('body:has(.nx-lienzo-completo) .theme-toggle')
    expect(css).toMatch(/body:has\(\.bottom-nav-wrap\)\s+\.theme-toggle\s*\{\s*display:\s*none;\s*\}/)
  })

  it('6a. freeze funcional — enviarMensaje conserva su contrato exacto', () => {
    expect(chat).toMatch(
      /await enviarMensaje\(clinicId, texto, \{\s*uid: user\.uid,\s*email: user\.email \?\? '',\s*nombre,\s*rol: role \?\? 'medico',\s*\}\)/,
    )
  })

  it('6b. freeze funcional — la burbuja propia se decide por senderId y el rol conserva sus etiquetas', () => {
    expect(chat).toMatch(/m\.senderId === user\?\.uid/)
    expect(chat).toMatch(/admin: 'Médico', medico: 'Médico', secretaria: 'Asistente'/)
  })
})
