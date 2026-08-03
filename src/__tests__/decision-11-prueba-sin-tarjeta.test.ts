/**
 * GOLDEN — decisión 11 del Dr. (3-ago-2026): la prueba es de 14 días SIN
 * TARJETA, y el producto tiene que decir lo mismo en todas partes.
 *
 * Fuente: `docs/maintenance/DECISIONES-CLINICAS-2026-08-03.md`.
 *
 * ── EL MURO ──────────────────────────────────────────────────────────────────
 *
 * `estadoAcceso` devolvía `'sin_tarjeta'` para todo lo que no fuera `active` —
 * también para `status: 'trial'`, que es el estado con el que nace **cada cuenta
 * nueva**. Y corre antes que cualquier otra cosa. El médico que acababa de leer
 * «14 días gratis, sin tarjeta» chocaba contra una pared pidiéndole la tarjeta.
 *
 * ── LO QUE HACE ESTE CASO TAN CARO ───────────────────────────────────────────
 *
 * **El modelo A completo ya estaba construido.** `paywall-prueba.ts` decide qué
 * se conserva al vencer, `firestore.rules` lo espeja, `pruebaAgotada` limita la
 * IA de la prueba y `gateCreditos` la corta sin overage. Todo escrito, probado,
 * espejado… e **inalcanzable**, porque tres líneas devolvían antes.
 *
 * Y 5 634 pruebas pasaban: ninguna afirmaba que un médico en prueba tuviera que
 * chocar contra el muro. Nadie lo quiso nunca; simplemente quedó ahí.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  estadoPaywall, puedeEscribir, puedeUsarIA, GRACIA_MS,
} from '@/lib/finanzas/paywall-prueba'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const sinComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '')

const AHORA = Date.parse('2026-08-03T12:00:00.000Z')
const EN_CURSO = { status: 'trial', trialEndsAtMs: AHORA + 5 * 86_400_000 }
const VENCIDA = { status: 'trial', trialEndsAtMs: AHORA - 3 * 86_400_000 }

describe('EL MURO: `estadoAcceso` ya no manda la prueba al paywall', () => {
  const layout = sinComentarios(leer('src', 'app', '(dashboard)', 'layout.tsx'))

  it('no queda ninguna rama que devuelva «sin_tarjeta»', () => {
    /**
     * El muro era un `return 'sin_tarjeta'` al final, que se comía todo lo que
     * no fuera `active`. Si vuelve a aparecer, vuelve el muro.
     */
    expect(layout).not.toMatch(/return 'sin_tarjeta'/)
  })

  it('sólo se bloquea lo que de verdad murió', () => {
    expect(layout).toMatch(/suspended.*cancelled.*canceled.*past_due/s)
    expect(layout).toMatch(/return 'vencido'/)
  })

  it('y el camino por omisión es entrar', () => {
    // Bajo el modelo A una cuenta nueva ES una prueba: tratar la ausencia del
    // campo como «no ha pagado» sería el mismo muro por la puerta de atrás.
    expect(layout).toMatch(/return 'ok'\s*\n\}/)
  })

  it('el código cita la decisión', () => {
    expect(leer('src', 'app', '(dashboard)', 'layout.tsx'))
      .toContain('DECISIONES-CLINICAS-2026-08-03.md')
  })
})

describe('LO QUE YA ESTABA CONSTRUIDO y ahora se alcanza', () => {
  it('durante la prueba se escribe y se usa la IA con normalidad', () => {
    expect(puedeEscribir(EN_CURSO, AHORA)).toBe(true)
    expect(puedeUsarIA(EN_CURSO, AHORA)).toBe(true)
    expect(estadoPaywall(EN_CURSO, AHORA).vencida).toBe(false)
  })

  it('al vencer: PAUSED, no cuenta cerrada', () => {
    /**
     * «Al terminar el trial sin método de pago: subscription = PAUSED, preservar
     * datos, permitir lectura/exportación, bloquear nuevas acciones premium.»
     */
    const e = estadoPaywall(VENCIDA, AHORA)
    expect(e.vencida).toBe(true)
    expect(e.puedeEscribir).toBe(false)
    expect(e.puedeUsarIA).toBe(false)
    expect(e.loQueSigueFuncionando.join(' ')).toMatch(/Ver y consultar todos tus expedientes/)
    expect(e.loQueSigueFuncionando.join(' ')).toMatch(/Exportar tu información completa/)
  })

  it('y el mensaje dice PRIMERO lo que conserva', () => {
    // Al revés suena a amenaza, y quien lo lee está con un paciente enfrente.
    const m = estadoPaywall(VENCIDA, AHORA).mensaje
    expect(m.indexOf('Conservas TODO')).toBeLessThan(m.indexOf('se detuvo'))
    expect(m).toMatch(/no se pierde nada/)
  })

  it('hay un día de gracia, y no es generosidad', () => {
    // La fecha de corte y el momento de pagar rara vez coinciden.
    const justoDespues = { status: 'trial', trialEndsAtMs: AHORA - 1000 }
    expect(estadoPaywall(justoDespues, AHORA).vencida).toBe(false)
    expect(GRACIA_MS).toBe(86_400_000)
  })

  it('sin fecha de fin NO se bloquea: falla abierto', () => {
    /**
     * Dejar fuera a un consultorio legítimo por un campo ausente es peor que
     * dejar pasar a uno vencido: el primero se queda sin poder atender.
     */
    expect(estadoPaywall({ status: 'trial' }, AHORA).vencida).toBe(false)
  })
})

describe('LA BOLSA DE IA: limitada, y sin overage', () => {
  const aiKeys = leer('src', 'lib', 'ai-keys.ts')

  it('la prueba tiene un tope de IA propio', () => {
    expect(aiKeys).toMatch(/export const LIMITE_PRUEBA/)
    expect(aiKeys).toContain('usados >= LIMITE_PRUEBA')
  })

  it('y el gate lo aplica: se corta, no se cobra de más', () => {
    // «No permitir overage durante trial.»
    expect(aiKeys).toContain('pruebaAgotada(clinicId)')
    expect(aiKeys).toMatch(/Se acabó la IA incluida en tu prueba/)
  })

  it('el mensaje deja claro que el expediente NO se toca', () => {
    expect(aiKeys).toMatch(/tus expedientes no se tocan/)
  })

  it('el tope falla ABIERTO si no se puede leer', () => {
    // Dejar al médico sin la función por un fallo de infraestructura es peor
    // que una llamada de más.
    expect(aiKeys).toMatch(/Falla ABIERTO/)
  })

  it('NEEDS_CLINICAL_REVIEW — la CIFRA la fija el Dr., no yo', () => {
    /**
     * El Dr. fue explícito: «la cifra final debe salir del Cost Engine, no
     * elegirse arbitrariamente», y el Cost Engine depende de la decisión 12
     * (las tarifas de los modelos), que sigue pendiente.
     *
     * Así que el MECANISMO está y la cifra sigue siendo configurable por
     * variable de entorno. Esta prueba fija que se pueda mover sin tocar código
     * — no fija cuánto vale.
     */
    expect(aiKeys).toMatch(/process\.env\.LIMITE_PRUEBA_IA/)
  })
})

describe('LAS SEIS PANTALLAS dicen lo mismo que hace el código', () => {
  const PROMESAS: [string, string[]][] = [
    ['landing', ['src', 'app', 'page.tsx']],
    ['demo', ['src', 'app', 'demo', 'page.tsx']],
    ['demo interactivo', ['src', 'app', 'demo', 'interactivo', 'page.tsx']],
  ]

  for (const [nombre, ruta] of PROMESAS) {
    it(`${nombre} promete «sin tarjeta» — y ahora es verdad`, () => {
      expect(leer(...ruta)).toMatch(/sin tarjeta/i)
    })
  }

  it('la página de precios ofrece la prueba sin pedir tarjeta', () => {
    expect(leer('src', 'app', 'precios', 'page.tsx')).toMatch(/Prueba gratis 14 días/)
  })

  it('y la cuenta nueva NACE en prueba, con su fecha de fin', () => {
    /**
     * Si `crear` no escribiera `trialEndsAtMs`, el paywall fallaría abierto para
     * siempre y la prueba no terminaría nunca: la promesa sería falsa por el
     * otro lado.
     */
    const crear = leer('src', 'app', 'api', 'clinic', 'crear', 'route.ts')
    expect(crear).toMatch(/status: 'trial'/)
    expect(crear).toMatch(/trialEndsAtMs/)
  })
})

describe('el espejo con las reglas sigue en pie', () => {
  it('firestore.rules corta la escritura pero NUNCA la lectura', () => {
    /**
     * Cortar la lectura sería ilegal además de hostil: el paciente tiene derecho
     * a su expediente (NOM-004). Con el muro fuera, esta regla pasa a ser la que
     * de verdad gobierna la prueba vencida.
     */
    const rules = leer('firestore.rules')
    expect(rules).toContain('clinicaPuedeEscribir')
  })
})
