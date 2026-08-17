'use client'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

interface EntradaDeNavegacion { index?: number }
interface NavegadorConNavigationApi { navigation?: { currentEntry?: EntradaDeNavegacion } }

/**
 * "Atrás" inteligente: si el usuario ya navegó DENTRO de la app, regresa a la
 * pantalla anterior real (router.back). Si llegó directo (deep link, recarga,
 * notificación push), va al destino lógico `fallback`.
 *
 * ── POR QUÉ NO `window.history.state.idx` ────────────────────────────────
 *
 * Ese campo no existe en Next 16.2.12 (App Router) — hallazgo de
 * V15-NOTE-PLAN-CONTINUITY-001, confirmado con dos scripts de diagnóstico
 * aparte (`node -e` y un arnés de navegador real, con `page.goto` y con
 * click SPA sobre un `<a>` real). `app-router.js` reescribe
 * `window.history.state` en CADA render (sólo `__NA` y
 * `__PRIVATE_NEXTJS_INTERNALS_TREE`), incluida la primerísima entrada de la
 * pestaña, así que cualquier `idx` leído de ahí es SIEMPRE `undefined`: el
 * chequeo `idx > 0` nunca era cierto y las diez pantallas que usan este hook
 * (`/receta`, `/orden`, `/nota`, `/expediente`, `/referencia`,
 * `/hospitalizacion/*`, `/uci/*`) navegaban SIEMPRE a `fallback`, incluso
 * viniendo de una navegación real dentro de la app.
 *
 * ── LA SOLUCIÓN: LA NAVIGATION API DEL NAVEGADOR, NO DE NEXT ─────────────
 *
 * `window.navigation.currentEntry.index` la mantiene el propio navegador,
 * fuera del control de Next: sube con cada `pushState` real, se queda igual
 * con un `replaceState` (como el que hace `firmar()` en `/consulta` para
 * reflejar `notaId` en la URL), y baja con un retroceso real — exactamente
 * lo que `idx` pretendía medir. El propio `app-router.js` ya señala esta vía
 * ("// TODO: Use Navigation API if available").
 *
 * Firefox y Safari antiguos no la implementan (`navigation` es
 * `undefined` ahí): NO se reimplementa el historial a mano con un contador
 * propio — contar push/replace/back por fuera se desincroniza del
 * historial real del navegador con su propio riesgo de error, y el
 * `fallback` YA es un destino lógico válido. El comportamiento en esos
 * navegadores queda IDÉNTICO al de antes de esta corrida (siempre
 * `fallback`) — sin regresión donde todavía no hay mejora posible.
 */
export function profundidadDeNavegacion(): number | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as unknown as NavegadorConNavigationApi).navigation?.currentEntry?.index
}

/** 0 = primera entrada de la Navigation API en esta pestaña → no hay a dónde volver. */
export function sePuedeRegresarDeVerdad(profundidad: number | undefined): boolean {
  return typeof profundidad === 'number' && profundidad > 0
}

export function useSmartBack(fallback: string) {
  const router = useRouter()
  return useCallback(() => {
    if (sePuedeRegresarDeVerdad(profundidadDeNavegacion())) router.back()
    else router.push(fallback)
  }, [router, fallback])
}
