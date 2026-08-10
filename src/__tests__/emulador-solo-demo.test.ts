/**
 * EL CLIENTE SÓLO PUEDE CONECTARSE A UN EMULADOR SI EL PROYECTO ES demo-*.
 *
 * QUÉ FALLABA: nada todavía — este guardián nace CON el arnés de capturas V10
 * (9-ago-2026), que añadió a `src/lib/firebase.ts` la conexión opcional a los
 * emuladores de Auth y Firestore para poder fotografiar el golden flow con
 * datos sintéticos (V10 §33: no se aprueba una pantalla leyendo JSX).
 *
 * CÓMO SE DESCUBRIÓ EL RIESGO: al escribir esa conexión quedó claro el peor
 * caso — si `NEXT_PUBLIC_FIREBASE_EMULATORS=1` se filtrara a un despliegue
 * real (un copy-paste de .env, un env var de Vercel), la app de producción
 * apuntaría su Auth y su Firestore a 127.0.0.1: sesión rota y, peor, escrituras
 * clínicas contra un emulador inexistente. La variable sola NO basta como
 * candado.
 *
 * CAUSA RAÍZ CUBIERTA: `connectAuthEmulator`/`connectFirestoreEmulator` no
 * validan nada por sí mismos; la política vive sólo en el `if` que los rodea.
 * Si alguien relaja ese `if`, ningún tipo ni prueba de contrato lo nota.
 *
 * LA REGLA QUE LO HACE SEGURO: la conexión exige DOS candados a la vez:
 *   1. `NEXT_PUBLIC_FIREBASE_EMULATORS === '1'` (intención explícita), y
 *   2. `projectId` con prefijo `demo-` — el prefijo que Firebase reserva para
 *      proyectos que sólo existen en el emulador. Producción usa
 *      `nexomed-agenda`, que jamás cumple el candado 2.
 *
 * PROBADO AL REVÉS (testing-gates.md): quitando `startsWith('demo-')` del
 * código, el caso 2 de esta prueba falla. Quitando la comprobación de la
 * variable, falla el caso 3.
 *
 * QUÉ NO CUBRE: no ejecuta la conexión real (eso vive en el arnés de capturas,
 * fuera de CI); es un guardián estático sobre el texto del módulo, como el que
 * protege `layout.tsx`. Tampoco cubre a `firebase-admin` (servidor), cuyo
 * candado equivalente es que sus emulator hosts sólo se exportan dentro de
 * `scripts/design/arnes-capturas-v10.sh`.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const fuente = readFileSync(join(process.cwd(), 'src/lib/firebase.ts'), 'utf8')

describe('emulador sólo con proyecto demo-*', () => {
  it('1. el módulo conecta a emuladores (el arnés V10 depende de esto)', () => {
    expect(fuente).toContain('connectAuthEmulator')
    expect(fuente).toContain('connectFirestoreEmulator')
  })

  // El bloque de interés va de la comprobación de la variable a la LLAMADA
  // (no el import, que aparece antes en el archivo: por eso `indexOf` con
  // punto de partida — la primera versión de esta prueba cortaba en el import
  // y validaba una cadena vacía, o sea, nada).
  const inicio = fuente.indexOf('NEXT_PUBLIC_FIREBASE_EMULATORS')
  const fin = fuente.indexOf('connectFirestoreEmulator(', inicio)
  const bloque = inicio >= 0 && fin > inicio ? fuente.slice(inicio, fin) : ''

  it('2. la conexión está detrás del candado de prefijo demo-', () => {
    expect(bloque.length).toBeGreaterThan(0)
    expect(bloque).toContain(".startsWith('demo-')")
  })

  it('3. la conexión exige la variable explícita, no sólo el projectId', () => {
    expect(bloque).toContain("=== '1'")
  })

  it('4. ninguna conexión a emulador vive FUERA de ese bloque único', () => {
    // Una sola aparición de cada connect*: si alguien añade otra llamada en
    // otro sitio (sin candado), esto la caza.
    expect(fuente.split('connectAuthEmulator(').length - 1).toBe(1)
    expect(fuente.split('connectFirestoreEmulator(').length - 1).toBe(1)
  })
})
