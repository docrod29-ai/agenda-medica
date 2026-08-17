/**
 * V15-NOTE-PLAN-CONTINUITY-001 (Fase 8, §33 / §20 del Master Loop V15) —
 * `useSmartBack` nunca hacía `router.back()` de verdad en esta versión de
 * Next.
 *
 * ── CÓMO SE DESCUBRIÓ ─────────────────────────────────────────────────────
 *
 * Verificando en navegador real el arreglo de «`firmar()` refleja el
 * `notaId` en la URL» (la corrida anterior de esta misma fase): pulsar el
 * botón "Atrás" QUE PINTA LA APP en `/orden` — no `page.goBack()` del
 * navegador — llevaba a `/expediente/[patientId]` (el `fallback` fijo de esa
 * pantalla), nunca de vuelta a `/consulta/[patientId]?nota=...`, aunque el
 * médico sí viniera de una navegación real dentro de la app.
 *
 * La causa: `useSmartBack` decidía leyendo `window.history.state.idx`, y ese
 * campo no existe en Next 16.2.12 (App Router). `app-router.js` reescribe
 * `history.state` en CADA render (`__NA` + `__PRIVATE_NEXTJS_INTERNALS_TREE`
 * — grep sobre el propio paquete instalado, cero apariciones de `idx`),
 * incluida la primerísima entrada de la pestaña. `idx` era siempre
 * `undefined`, `idx > 0` era siempre falso, y las diez pantallas que usan
 * este hook (`/receta`, `/orden`, `/nota`, `/expediente`, `/referencia`,
 * `/hospitalizacion/*`, `/uci/*`) navegaban SIEMPRE a `fallback`.
 *
 * ── LA CAUSA RAÍZ, VERIFICADA EN EL PAQUETE INSTALADO ────────────────────
 *
 * `grep -n "idx" node_modules/next/dist/client/components/app-router.js` no
 * encuentra nada: el historial que el App Router escribe sólo lleva `__NA` y
 * `__PRIVATE_NEXTJS_INTERNALS_TREE`. El propio archivo, sin embargo, deja un
 * comentario que apunta a la vía correcta: `// TODO: Use Navigation API if
 * available` — la Navigation API del NAVEGADOR (`window.navigation`), no de
 * Next, mantiene su propio `currentEntry.index` sin que Next lo pise.
 *
 * ── QUÉ NO CUBRE ──────────────────────────────────────────────────────────
 *
 * No arregla el caso Firefox/Safari sin Navigation API: ahí el
 * comportamiento queda IDÉNTICO al de antes de este cambio (siempre
 * `fallback`) — es una mejora estricta donde la API existe, sin regresión
 * donde no. No prueba con un navegador real dentro de este archivo (eso
 * vive en el arnés de captura de la corrida, fuera de esta suite): esta
 * prueba comprueba la función pura de decisión y que el código roto
 * (`history.state`/`idx`) ya no está.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const { profundidadDeNavegacion, sePuedeRegresarDeVerdad } = await import('@/hooks/useSmartBack')

const HOOK = readFileSync(join(process.cwd(), 'src', 'hooks', 'useSmartBack.ts'), 'utf8')
// Sólo código: el propio comentario que explica esta prueba menciona
// `history.state`/`idx` al contar qué se quitó, y contarlo daría un falso rojo.
const HOOK_CODIGO = HOOK.split('\n').filter(l => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n')

describe('el `idx` roto de history.state ya no decide nada', () => {
  it('no queda ni un solo `history.state` en el código del hook', () => {
    /**
     * Probada al revés: el código previo a este cambio tenía exactamente
     * `(window.history.state as { idx?: number } | null)?.idx`. Si alguien
     * lo reintrodujera —por ejemplo "arreglando" un lint sin leer este
     * archivo— esta prueba lo cazaría.
     */
    expect(HOOK_CODIGO).not.toContain('history.state')
    expect(HOOK_CODIGO).not.toMatch(/\bidx\b/)
  })

  it('decide con `window.navigation.currentEntry`, no con Next', () => {
    expect(HOOK_CODIGO).toContain('.navigation?.currentEntry?.index')
  })
})

describe('sePuedeRegresarDeVerdad — función pura', () => {
  it('sin Navigation API (undefined), no se puede regresar', () => {
    expect(sePuedeRegresarDeVerdad(undefined)).toBe(false)
  })

  it('índice 0 — primera entrada de la pestaña, no hay a dónde volver', () => {
    expect(sePuedeRegresarDeVerdad(0)).toBe(false)
  })

  it('índice 1 o más — sí navegó dentro de la app, se puede regresar', () => {
    expect(sePuedeRegresarDeVerdad(1)).toBe(true)
    expect(sePuedeRegresarDeVerdad(4)).toBe(true)
  })

  it('valores fuera de rango no revientan la decisión', () => {
    expect(sePuedeRegresarDeVerdad(-1)).toBe(false)
    expect(sePuedeRegresarDeVerdad(NaN)).toBe(false)
  })
})

describe('profundidadDeNavegacion — lee window.navigation, no window.history', () => {
  const original = globalThis.window

  function restaurar() {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: original })
  }

  it('sin `window` (SSR), no revienta: undefined', () => {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: undefined })
    try {
      expect(profundidadDeNavegacion()).toBeUndefined()
    } finally {
      restaurar()
    }
  })

  it('navegador SIN Navigation API (Firefox/Safari): undefined, igual que antes de este cambio', () => {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {} })
    try {
      expect(profundidadDeNavegacion()).toBeUndefined()
    } finally {
      restaurar()
    }
  })

  it('navegador CON Navigation API: lee el índice real de currentEntry', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { navigation: { currentEntry: { index: 3 } } },
    })
    try {
      expect(profundidadDeNavegacion()).toBe(3)
    } finally {
      restaurar()
    }
  })

  it('recién llegado por la Navigation API (index 0): igual que sin API, no se regresa', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { navigation: { currentEntry: { index: 0 } } },
    })
    try {
      expect(sePuedeRegresarDeVerdad(profundidadDeNavegacion())).toBe(false)
    } finally {
      restaurar()
    }
  })
})
