/**
 * REP-040 · ASE-013 (AS-expedientes) — cerrar sesión desde Pacientes, Agenda u
 * Operaciones —cualquier pantalla sin una consulta abierta— NO limpia la caché
 * IndexedDB de Firestore con los expedientes, aunque Operaciones prometa «nada
 * del consultorio se queda guardado aquí».
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 * `src/lib/salir-seguro.ts:101-104`: si NADIE escucha el evento
 * (`promesas.length === 0`) `guardarTodoYEsperar` devuelve `todoGuardado:
 * false`. `salirSeguro` (:192-199) sólo llama a `limpiarCacheFirestore()` en la
 * rama `todoGuardado`; la otra (:202-210) cierra sesión y navega a
 * `/login?pendiente=sin_confirmar` sin purgar. `firebase.ts:106-108` activa
 * `persistentLocalCache` en producción; el único llamador de
 * `limpiarCacheFirestore` en todo `src/` es `salir-seguro.ts:196`.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor AS-expedientes, hallazgo ASE-013 (`crudos/AS-expedientes.json`),
 * reproducido en la app: /pacientes → «Cerrar sesión» → URL final
 * `/login?pendiente=sin_confirmar` (la rama sin purga). El equipo rojo
 * (`crudos/R-AS-expedientes.json`) leyó el archivo entero, confirmó que no hay
 * otro purgador, y que AutoLogout, Sidebar, FlowRail, layout y
 * `operaciones/page.tsx:335` pasan todos por aquí. `salir-seguro.test.ts`
 * tiene 6 casos, todos de `guardarTodoYEsperar`, ninguno de `salirSeguro`.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * La purga condicional se diseñó para NO perder una nota a medio guardar (la
 * cola de Firestore es la única copia). Pero «nadie tenía nada que guardar»
 * se codificó igual que «se intentó guardar y falló»: `todoGuardado:false` en
 * los dos. La prudencia pensada para la consulta dictada se aplicó al cierre
 * más frecuente, el de recepción, donde no hay nada que conservar.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * data-privacy: «Al cerrar sesión se limpia IndexedDB». security-tenant: PHI en
 * un equipo compartido. testing-gates: el guardián se prueba al revés.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * COMPORTAMIENTO sobre `salirSeguro` real con sus importaciones dinámicas
 * dobladas (`@/lib/firebase`, `local-drafts`, `timezone`, `audit-log`) y un
 * `window` mínimo (EventTarget + `location`). Caso: cero oyentes del evento →
 * `limpiarCacheFirestore` debe llamarse. El control con un oyente que confirma
 * el guardado demuestra que el doble y la rama que purga funcionan; el segundo
 * control (oyente cuya promesa FALLA) fija que la prudencia de REG-297 sigue.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * La caché del Service Worker y las capturas del sistema operativo. Qué debe
 * pasar con `limpiarBorradoresLocales` en la rama sin oyentes (el hallazgo
 * propone purgar también; aquí sólo se exige la caché de Firestore, que es la
 * fracción mayor de PHI). No ejecuta IndexedDB real.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { llamadas } = vi.hoisted(() => ({ llamadas: [] as string[] }))

vi.mock('@/lib/firebase', () => ({
  auth: { signOut: async () => { llamadas.push('signOut') } },
  limpiarCacheFirestore: async () => { llamadas.push('limpiarCacheFirestore') },
  db: {},
}))
vi.mock('@/lib/mobile/local-drafts', () => ({
  limpiarBorradoresLocales: () => { llamadas.push('limpiarBorradoresLocales'); return 0 },
  limpiarAudioLocal: () => { llamadas.push('limpiarAudioLocal') },
}))
vi.mock('@/lib/timezone', () => ({ limpiarZonaConsultorio: () => { llamadas.push('limpiarZonaConsultorio') } }))
vi.mock('@/lib/expediente/audit-log', () => ({ drenarCola: async () => { llamadas.push('drenarCola') } }))

import { salirSeguro, EVENTO_GUARDAR_TODO, type DetalleGuardarTodo } from '@/lib/salir-seguro'

/** `window` mínimo: un EventTarget real de Node + `location.href` escribible. */
const target = new EventTarget()
const ventana = {
  dispatchEvent: (e: Event) => target.dispatchEvent(e),
  addEventListener: (t: string, l: EventListener) => target.addEventListener(t, l),
  removeEventListener: (t: string, l: EventListener) => target.removeEventListener(t, l),
  location: { href: '' },
}
;(globalThis as unknown as { window: unknown }).window = ventana

describe('REP-040 · cerrar sesión sin nadie que guardar purga la caché de Firestore', () => {
  let oyente: EventListener | null = null
  beforeEach(() => {
    llamadas.length = 0
    ventana.location.href = ''
    if (oyente) { target.removeEventListener(EVENTO_GUARDAR_TODO, oyente); oyente = null }
  })

  it('control: con una consulta abierta que confirma el guardado, se purga (la rama existe y el doble funciona)', async () => {
    oyente = (e: Event) => { (e as CustomEvent<DetalleGuardarTodo>).detail.esperar(Promise.resolve('guardado')) }
    target.addEventListener(EVENTO_GUARDAR_TODO, oyente)
    await salirSeguro('/login')
    expect(llamadas).toContain('signOut')
    expect(llamadas).toContain('limpiarCacheFirestore')
    expect(ventana.location.href).toBe('/login')
  })

  it('control (REG-297): si el guardado FALLA, la caché se conserva — la prudencia sigue', async () => {
    oyente = (e: Event) => { (e as CustomEvent<DetalleGuardarTodo>).detail.esperar(Promise.reject(new Error('sin red'))) }
    target.addEventListener(EVENTO_GUARDAR_TODO, oyente)
    await salirSeguro('/login')
    expect(llamadas).toContain('signOut')
    expect(llamadas).not.toContain('limpiarCacheFirestore')
    expect(ventana.location.href).toContain('pendiente=guardado_fallido')
  })

  it('HOY FALLA: sin ningún oyente (Pacientes, Agenda, Operaciones), cerrar sesión purga la caché de Firestore', async () => {
    await salirSeguro('/login')
    expect(llamadas).toContain('signOut')
    expect(
      llamadas,
      `se cerró sesión y se navegó a «${ventana.location.href}» sin purgar; llamadas: ${llamadas.join(', ')}`,
    ).toContain('limpiarCacheFirestore')
  })
})
