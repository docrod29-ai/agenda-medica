/**
 * ASE-013 · ASE-014 · Panel de Lujo (AS-expedientes, REP-040) — cerrar sesión
 * desde Pacientes, Agenda u Operaciones —cualquier pantalla sin una consulta
 * abierta— NO limpiaba la caché IndexedDB de Firestore con los expedientes,
 * aunque Operaciones prometa «nada del consultorio se queda guardado aquí».
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * `src/lib/salir-seguro.ts`: si NADIE escucha el evento (`promesas.length ===
 * 0`) `guardarTodoYEsperar` devolvía `todoGuardado: false`, y `salirSeguro`
 * sólo llamaba a `limpiarCacheFirestore()` en la rama `todoGuardado`; la otra
 * cerraba sesión y navegaba a `/login?pendiente=sin_confirmar` sin purgar.
 * `firebase.ts` activa `persistentLocalCache` en producción; el único llamador
 * de `limpiarCacheFirestore` en todo `src/` es este archivo.
 *
 * Y el segundo defecto (ASE-014): el aviso `?pendiente=…` con el que salía la
 * sesión no lo leía nadie — /login sólo mira `invite`.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor AS-expedientes, hallazgos ASE-013 (P1) y ASE-014, reproducidos en la
 * app: /pacientes → «Cerrar sesión» → URL final `/login?pendiente=sin_confirmar`
 * (la rama sin purga). El equipo rojo leyó el archivo entero, confirmó que no
 * hay otro purgador y que AutoLogout, Sidebar, FlowRail, layout y
 * `operaciones/page.tsx` pasan todos por aquí. `salir-seguro.test.ts` tenía 6
 * casos, todos de `guardarTodoYEsperar`, ninguno de `salirSeguro`.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * «Nadie tenía nada que guardar» se codificó igual que «se intentó guardar y
 * falló»: `todoGuardado:false` en los dos. La prudencia pensada para la
 * consulta dictada se aplicó al cierre más frecuente, el de recepción, donde
 * no hay nada que conservar.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 * Se purga cuando el trabajo está a salvo O cuando no hubo acuse (nadie tenía
 * nada que guardar). La caché se conserva sólo si alguien SÍ intentó guardar
 * y no se pudo confirmar (REG-297 sigue). data-privacy: «Al cerrar sesión se
 * limpia IndexedDB». Y el aviso tiene catálogo (`MENSAJE_PENDIENTE`) y lector
 * (`avisoPendienteDe`) para que /login lo pinte.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * COMPORTAMIENTO sobre `salirSeguro` real con sus importaciones dinámicas
 * dobladas (`@/lib/firebase`, `local-drafts`, `timezone`, `audit-log`) y un
 * `window` mínimo (EventTarget + `location`).
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * La caché del Service Worker y las capturas del sistema operativo. No ejecuta
 * IndexedDB real. Que /login PINTE el aviso es de la pantalla de entrada
 * (handoff a UI-CONFIG); aquí se fija el contrato que tiene que leer.
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

import {
  salirSeguro, EVENTO_GUARDAR_TODO, avisoPendienteDe, MENSAJE_PENDIENTE, PARAMETRO_PENDIENTE,
  type DetalleGuardarTodo,
} from '@/lib/salir-seguro'

/** `window` mínimo: un EventTarget real de Node + `location.href` escribible. */
const target = new EventTarget()
const ventana = {
  dispatchEvent: (e: Event) => target.dispatchEvent(e),
  addEventListener: (t: string, l: EventListener) => target.addEventListener(t, l),
  removeEventListener: (t: string, l: EventListener) => target.removeEventListener(t, l),
  location: { href: '' },
}
;(globalThis as unknown as { window: unknown }).window = ventana

describe('ASE-013 · cerrar sesión sin nadie que guardar purga la caché de Firestore', () => {
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
    expect(llamadas).not.toContain('limpiarBorradoresLocales')
    expect(ventana.location.href).toContain(`${PARAMETRO_PENDIENTE}=guardado_fallido`)
  })

  it('sin ningún oyente (Pacientes, Agenda, Operaciones), cerrar sesión purga la caché de Firestore y los borradores', async () => {
    await salirSeguro('/login')
    expect(llamadas).toContain('signOut')
    expect(
      llamadas,
      `se cerró sesión y se navegó a «${ventana.location.href}» sin purgar; llamadas: ${llamadas.join(', ')}`,
    ).toContain('limpiarCacheFirestore')
    expect(llamadas).toContain('limpiarBorradoresLocales')
    // Y no sale con un aviso: no quedó nada pendiente.
    expect(ventana.location.href).toBe('/login')
  })

  it('el audio sin transcribir se respeta también en la rama sin oyentes que confirmen', async () => {
    oyente = (e: Event) => { (e as CustomEvent<DetalleGuardarTodo>).detail.marcarAudioSinTranscribir?.() }
    target.addEventListener(EVENTO_GUARDAR_TODO, oyente)
    await salirSeguro('/login')
    expect(llamadas).toContain('limpiarCacheFirestore')
    expect(llamadas).not.toContain('limpiarAudioLocal')
  })
})

describe('ASE-014 · el aviso con el que sale la sesión tiene lector', () => {
  it('cada valor emitido tiene un texto en lenguaje de persona', () => {
    for (const [clave, texto] of Object.entries(MENSAJE_PENDIENTE)) {
      expect(texto.length, clave).toBeGreaterThan(40)
      expect(texto).not.toMatch(/undefined|null|\{|\}/)
    }
  })

  it('avisoPendienteDe lee la URL de entrada y rechaza lo que no es nuestro', () => {
    expect(avisoPendienteDe('?pendiente=guardado_fallido')).toBe('guardado_fallido')
    expect(avisoPendienteDe('pendiente=guardado_lento&invite=ABC')).toBe('guardado_lento')
    expect(avisoPendienteDe('?invite=ABC')).toBeNull()
    expect(avisoPendienteDe('?pendiente=<script>')).toBeNull()
    expect(avisoPendienteDe('')).toBeNull()
  })
})
