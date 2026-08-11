/**
 * V15-NOTE-PLAN-CONTINUITY-001 (Fase 8, §33 / §20 del Master Loop V15) —
 * segunda rebanada: firmar() nunca escribía el notaId en la URL.
 *
 * ── CÓMO SE DESCUBRIÓ ─────────────────────────────────────────────────────
 *
 * La rebanada anterior (`v15-cierre-recuerda-lo-hecho.test.ts`) dejó anotado
 * un hallazgo sin arreglar: `router.back()` (el que usa `useSmartBack` en
 * `/receta` y `/orden` para volver) NO conservaba el contexto de `/consulta`
 * en el caso más común. `firmar()` nunca escribía el `notaId` en la URL —
 * vivía sólo en estado de React (`notaIdRef`/`notaId`) — así que la entrada
 * de historial que quedaba atrás al hacer `router.push(destino)` hacia
 * `/receta` u `/orden` era `/consulta/[patientId]` SIN `?nota=...`.
 *
 * ── LA CAUSA RAÍZ ─────────────────────────────────────────────────────────
 *
 * Volver desde `/receta`/`/orden` con `router.back()` remontaba
 * `/consulta/[patientId]` sin `?nota=`. Sin ese parámetro:
 *
 * 1. El efecto que carga la nota existente (`?nota=` → `getNota`) nunca se
 *    disparaba — `notaIdParam` era `null`.
 * 2. `firmada` volvía a su valor inicial (`false`) — el checklist de cierre
 *    (`ComoCerrarLaConsulta`, que exige `firmada`) desaparecía ENTERO, con o
 *    sin lo que ya se marcó en `sessionStorage` (`cierre-hechos.ts`).
 *
 * Un segundo defecto hermano, mismo efecto de carga: `estudiosOrden` nunca se
 * restauraba desde Firestore al reabrir una nota — a diferencia de
 * `secciones`/`diagnosticos`/`medicamentos`, que sí se leían de vuelta. Con
 * la URL ya corregida para llevar `?nota=`, reabrir una nota firmada (o
 * volver de `/orden`) recargaba la pantalla con `estudiosOrden=[]`: el paso
 * «Imprimir la orden de estudios» desaparecía de la lista en vez de
 * enseñarse marcado.
 *
 * ── LA REGLA ──────────────────────────────────────────────────────────────
 *
 * `router.replace`, nunca `router.push`: no es una navegación nueva, es la
 * MISMA pantalla diciendo la verdad sobre qué nota tiene abierta. Un `push`
 * ensuciaría el historial con una entrada extra.
 *
 * ── QUÉ NO CUBRE ──────────────────────────────────────────────────────────
 *
 * No prueba el comportamiento en un navegador real (eso ya lo hizo el arnés
 * de `docs/design/capturas/`) — sólo que el cableado fuente existe y que no
 * vuelve a desaparecer. Tampoco decide si el autoguardado (no sólo firmar)
 * debería reflejar el `notaId` en la URL — eso quedó fuera de esta rebanada
 * a propósito: el autoguardado corre cada pocos segundos y escribir la URL
 * en cada uno sería un ruido de historial distinto, con su propio análisis.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const consulta = readFileSync(
  join(process.cwd(), 'src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx'),
  'utf8',
)

describe('firmar() refleja el notaId en la URL — está CONECTADO, no sólo escrito', () => {
  it('firmar() llama a router.replace con la ruta de consulta y el id firmado', () => {
    expect(consulta).toMatch(/router\.replace\(`\/consulta\/\$\{patientId\}\?nota=\$\{id\}`\)/)
  })

  it('el replace ocurre DESPUÉS de setFirmada(true) — el id ya es el definitivo', () => {
    const iSetFirmada = consulta.indexOf('setFirmada(true)')
    const iReplace = consulta.indexOf('router.replace(`/consulta/${patientId}?nota=${id}`)')
    expect(iSetFirmada).toBeGreaterThan(-1)
    expect(iReplace).toBeGreaterThan(iSetFirmada)
  })

  it('el replace ocurre ANTES de navegar a receta/orden — la entrada de historial que queda atrás ya lleva ?nota=', () => {
    const iReplace = consulta.indexOf('router.replace(`/consulta/${patientId}?nota=${id}`)')
    const iPushDestino = consulta.indexOf('if (destino) router.push(destino)')
    expect(iReplace).toBeGreaterThan(-1)
    expect(iPushDestino).toBeGreaterThan(iReplace)
  })

  it('es replace, no push — no debe ensuciar el historial con una entrada extra', () => {
    expect(consulta).not.toMatch(/router\.push\(`\/consulta\/\$\{patientId\}\?nota=\$\{id\}`\)/)
  })
})

describe('estudiosOrden se restaura al cargar una nota existente — está CONECTADO', () => {
  it('el efecto de carga de la nota restaura estudiosOrden desde Firestore', () => {
    expect(consulta).toMatch(/if \(Array\.isArray\(n\.estudiosOrden\)\) setEstudiosOrden\(n\.estudiosOrden\)/)
  })

  it('la restauración vive en el mismo efecto que ya restaura firmada (no una consulta aparte)', () => {
    const iEfecto = consulta.indexOf("// ── Cargar nota existente (borrador) si viene ?nota= ───────────")
    const iFirmada = consulta.indexOf("setFirmada(n.estado === 'firmada')")
    const iEstudios = consulta.indexOf('if (Array.isArray(n.estudiosOrden)) setEstudiosOrden(n.estudiosOrden)')
    const iFinEfecto = consulta.indexOf('// ── Cambiar tipo de nota → reset de secciones')
    expect(iEfecto).toBeGreaterThan(-1)
    expect(iFirmada).toBeGreaterThan(iEfecto)
    expect(iEstudios).toBeGreaterThan(iFirmada)
    expect(iEstudios).toBeLessThan(iFinEfecto)
  })
})
