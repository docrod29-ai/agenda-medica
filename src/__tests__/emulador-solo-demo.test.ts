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

/**
 * EL ARNÉS TIENE QUE ENCENDER EL CANDADO QUE EL CÓDIGO LEE.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `src/lib/firebase.ts` lee `NEXT_PUBLIC_FIREBASE_EMULATORS` (**plural**). El
 * guion `arnes:dev` de `package.json` exportaba
 * `NEXT_PUBLIC_FIREBASE_EMULATOR` (**singular**) — copiado del comentario de
 * cabecera de ese mismo archivo, que también decía el singular.
 *
 * Consecuencia: `npm run arnes:dev` **nunca conectó a los emuladores**. El
 * navegador salía a `identitytoolkit.googleapis.com` de verdad y el inicio de
 * sesión sintético se quedaba en «Entrando…» hasta que la red lo cortaba. O
 * sea: el arnés que existe para poder mirar las pantallas sin pacientes reales
 * no podía abrir ninguna pantalla con sesión.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Levantando los emuladores y recorriendo el alta de cita de la asistente en un
 * navegador real. El inicio de sesión se quedaba colgado; la traza de red
 * enseñaba la petición saliendo a Google en vez de a `127.0.0.1:9099`.
 *
 * Estaba **escrito** en `agent-state/V15_CURRENT_ITERATION.md` desde antes —
 * «el arnés se escribió con el singular y el candado lee el plural»— y aun así
 * el guion siguió roto: saberlo y arreglarlo no son lo mismo. Por eso esto es
 * una prueba y no una nota.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * No levanta emuladores ni comprueba que la conexión funcione: compara los dos
 * textos que tienen que decir lo mismo. Que conecte de verdad se ve en el
 * navegador, y eso vive fuera de CI.
 */
describe('el arnés y el candado dicen la misma variable', () => {
  const paquete = readFileSync(join(process.cwd(), 'package.json'), 'utf8')
  const guiones: Record<string, string> = JSON.parse(paquete).scripts

  /** El nombre que el código LEE de verdad, sacado del propio módulo. */
  const LEIDA = fuente.match(/process\.env\.(NEXT_PUBLIC_FIREBASE_EMULATORS?)/)?.[1]

  it('el módulo lee una variable, y es la plural', () => {
    expect(LEIDA).toBe('NEXT_PUBLIC_FIREBASE_EMULATORS')
  })

  it('ningún guion enciende el candado con el nombre equivocado', () => {
    const malos = Object.entries(guiones)
      .filter(([, cmd]) => /NEXT_PUBLIC_FIREBASE_EMULATOR=/.test(cmd))
      .map(([k]) => k)
    expect(
      malos,
      `estos guiones exportan el nombre SINGULAR, que el candado no lee: ${malos.join(', ')}`,
    ).toEqual([])
  })

  it('el arnés visual enciende exactamente la variable que el módulo lee', () => {
    const arnes = guiones['arnes:dev'] ?? ''
    expect(arnes, 'no existe el guion arnes:dev').not.toBe('')
    expect(arnes).toContain(`${LEIDA}=1`)
    // Y el segundo candado: el proyecto tiene que ser `demo-*`.
    expect(arnes).toMatch(/NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-/)
  })

  it('el comentario del módulo no contradice al código — así empezó esto', () => {
    // Un comentario que dice otra cosa es de donde se copió el nombre malo.
    const cabecera = fuente.slice(0, fuente.indexOf('const firebaseConfig'))
    expect(cabecera).not.toMatch(/NEXT_PUBLIC_FIREBASE_EMULATOR[^S]/)
  })
})
