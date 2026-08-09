/**
 * V10 · B-V10-2 — el arnés de capturas conecta la app a emuladores… y SOLO ahí.
 *
 * QUÉ FALLABA: nada todavía — este guardián nace CON el arnés, antes del
 * defecto, porque el defecto posible aquí es catastrófico y silencioso: si la
 * conexión a emuladores se activara en un build de producción (una bandera
 * `NEXT_PUBLIC_FIREBASE_EMULATORS=1` olvidada en Vercel), la app del médico
 * apuntaría a `localhost` — sin datos, sin sesión, sin expedientes — y el
 * error del navegador ni siquiera diría por qué.
 *
 * CÓMO SE DESCUBRIÓ EL RIESGO: al construir el arnés de capturas del golden
 * flow (V10-TRUTH-001, salida 2). La regla hermana es la del sesgo de
 * vocabulario: lo único que cambia a qué apunta la app entera debe estar
 * detrás de una compuerta probada al derecho y al revés.
 *
 * LA REGLA QUE LO HACE SEGURO: doble cerrojo en `emuladoresActivos()` —
 * bandera explícita Y NODE_ENV distinto de production. Ninguno de los dos
 * basta solo.
 *
 * QUÉ NO CUBRE: que los puertos declarados aquí coincidan con los que el
 * emulador de verdad abre en una corrida (eso lo comprueba el arnés al correr,
 * porque si no coinciden no hay captura); ni que `connectAuthEmulator` /
 * `connectFirestoreEmulator` funcionen — eso es del SDK de Firebase.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  emuladoresActivos,
  EMULADOR_AUTH_URL,
  EMULADOR_FIRESTORE_PORT,
} from '../lib/firebase-emuladores'

describe('V10 · la compuerta de emuladores tiene doble cerrojo', () => {
  it('se activa SOLO con bandera=1 y NODE_ENV≠production', () => {
    expect(emuladoresActivos('1', 'development')).toBe(true)
    expect(emuladoresActivos('1', 'test')).toBe(true)
  })

  it('AL REVÉS: en producción NUNCA, aunque la bandera esté puesta', () => {
    // El caso que este guardián existe para atrapar: la bandera se cuela en
    // Vercel. La compuerta debe ignorarla.
    expect(emuladoresActivos('1', 'production')).toBe(false)
  })

  it('AL REVÉS: sin bandera explícita NUNCA, esté como esté NODE_ENV', () => {
    expect(emuladoresActivos(undefined, 'development')).toBe(false)
    expect(emuladoresActivos('', 'development')).toBe(false)
    expect(emuladoresActivos('true', 'development')).toBe(false) // solo '1' — opt-in literal
    expect(emuladoresActivos('0', 'development')).toBe(false)
  })
})

describe('V10 · firebase.ts consume la compuerta (no un if propio)', () => {
  const fuente = readFileSync(join(process.cwd(), 'src/lib/firebase.ts'), 'utf8')

  it('la conexión a emuladores pasa por emuladoresActivos()', () => {
    // Si alguien reescribe el cableado con su propia condición inline, este
    // guardián lo trae de vuelta a la función probada.
    expect(fuente).toContain('emuladoresActivos()')
    expect(fuente).toContain('connectAuthEmulator')
    expect(fuente).toContain('connectFirestoreEmulator')
  })

  it('no hay conexión a emulador fuera de la compuerta', () => {
    // Las llamadas connect* deben aparecer DESPUÉS del if con la compuerta.
    const posCompuerta = fuente.indexOf('emuladoresActivos()')
    expect(posCompuerta).toBeGreaterThan(-1)
    expect(fuente.indexOf('connectAuthEmulator(auth')).toBeGreaterThan(posCompuerta)
    expect(fuente.indexOf('connectFirestoreEmulator(db')).toBeGreaterThan(posCompuerta)
  })

  it('los puertos del arnés son los que firebase.json declara', () => {
    const fb = JSON.parse(readFileSync(join(process.cwd(), 'firebase.json'), 'utf8')) as {
      emulators?: { firestore?: { port?: number }; auth?: { port?: number } }
    }
    expect(fb.emulators?.firestore?.port).toBe(EMULADOR_FIRESTORE_PORT)
    expect(String(fb.emulators?.auth?.port)).toBe(EMULADOR_AUTH_URL.split(':').pop())
  })
})
