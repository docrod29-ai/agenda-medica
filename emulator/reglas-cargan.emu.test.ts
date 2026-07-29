/**
 * HUMO: las reglas REALES compilan en el motor de Firestore (unidad Nexus OS E0-08).
 *
 * Por qué es un spec aparte y no un `beforeAll` del otro: si `firestore.rules` tiene
 * un error de sintaxis, `initializeTestEnvironment` revienta y TODAS las pruebas del
 * otro archivo caen a la vez con un fallo de setup — ruido que se confunde con
 * flakiness del emulador. Aquí el mensaje es inequívoco: «las reglas no compilan».
 *
 * También fija que el proyecto sea `demo-*`. Sin ese prefijo el SDK podría intentar
 * hablar con un proyecto REAL de Firebase; el candado es que las pruebas no puedan
 * tocar datos del médico ni por accidente.
 */

import { afterAll, expect, it } from 'vitest'
import { assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { PROJECT_ID, abrirEntorno } from './entorno'

let env: RulesTestEnvironment | undefined

afterAll(async () => {
  if (env) await env.cleanup()
})

it('firestore.rules compila en el motor real y el proyecto es demo-*', async () => {
  env = await abrirEntorno()
  expect(env.projectId).toBe(PROJECT_ID)
  expect(PROJECT_ID.startsWith('demo-')).toBe(true)
  // Si el ruleset no se hubiera cargado, el emulador aplica su default (permitir
  // todo en modo test) y esta lectura anónima PASARÍA. Que falle es la prueba de
  // que las reglas del repo están en vigor.
  await assertFails(
    env.unauthenticatedContext().firestore().doc('coleccion_inventada/doc').get(),
  )
}, 120_000)
