/**
 * GUARDIÁN — la conexión a emuladores no puede llegar a producción.
 *
 * Qué fallaba: nada todavía — nace CON la capacidad (V10-TRUTH-001, 9-ago-2026),
 * el día que `src/lib/firebase.ts` aprendió a hablar con los emuladores de
 * Auth/Firestore para poder abrir el producto en un navegador sin credenciales.
 *
 * Cómo se descubrió el riesgo: revisando el cambio antes de escribirlo. Una
 * conexión a `127.0.0.1` que se colara a producción no rompería ruidosamente:
 * dejaría al médico ante spinners eternos (Firestore esperando un emulador que
 * no existe), que es exactamente la clase de fallo silencioso que la regla
 * «el dato tiene que llegar» persigue.
 *
 * La regla que lo hace seguro: la conexión vive detrás de DOS condiciones
 * simultáneas — la bandera explícita `NEXT_PUBLIC_FIREBASE_EMULATORS === '1'`
 * (que no existe en Vercel) y `NODE_ENV !== 'production'` (que en Vercel es
 * siempre falsa). Además, la semilla sintética aborta si el projectId no
 * empieza por `demo-` o si no hay emulador declarado.
 *
 * Probado al revés (y MIRADO, lección de REG-299): quitando `NODE_ENV` de la
 * condición, el caso 2 falla; quitando la bandera, el caso 1; quitando el
 * candado `demo-` de la semilla, el caso 4.
 *
 * Qué NO cubre: no ejecuta el navegador ni levanta emuladores; verifica que
 * las decisiones sigan escritas donde deben (guardián de fuente, como los de
 * REG-294..297). Tampoco vigila que alguien conecte emuladores desde OTRO
 * archivo — el caso 3 acota eso al único módulo autorizado.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const firebase = readFileSync('src/lib/firebase.ts', 'utf8')
const semilla = readFileSync('scripts/emulador/sembrar-consultorio-sintetico.mjs', 'utf8')

describe('los emuladores sólo existen en desarrollo', () => {
  it('1) la conexión exige la bandera explícita NEXT_PUBLIC_FIREBASE_EMULATORS', () => {
    const condicion = firebase.match(/if\s*\(([^)]*)\)\s*\{[^}]*connectAuthEmulator/s)?.[1]
    expect(condicion, 'connectAuthEmulator debe estar dentro de un if').toBeTruthy()
    expect(condicion).toContain("process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === '1'")
  })

  it('2) …y además exige NODE_ENV !== production (doble candado)', () => {
    const condicion = firebase.match(/if\s*\(([^)]*)\)\s*\{[^}]*connectAuthEmulator/s)?.[1]
    expect(condicion).toContain("process.env.NODE_ENV !== 'production'")
    // Las dos condiciones van unidas por &&: cualquiera de las dos veta.
    expect(condicion).toContain('&&')
  })

  it('3) ningún otro módulo de src/ conecta emuladores', () => {
    const otros = execSync(
      "grep -rl 'connectAuthEmulator\\|connectFirestoreEmulator' src/ --include='*.ts' --include='*.tsx' || true",
      { encoding: 'utf8' },
    ).trim().split('\n').filter(Boolean)
      .filter(f => f !== 'src/lib/firebase.ts' && !f.includes('__tests__'))
    expect(otros, `módulos no autorizados conectando emuladores: ${otros.join(', ')}`).toEqual([])
  })

  it('4) la semilla sintética aborta fuera del mundo demo-', () => {
    expect(semilla).toContain("PROJECT_ID.startsWith('demo-')")
    expect(semilla).toContain('process.env.FIRESTORE_EMULATOR_HOST')
    // Y el abandono es real (process.exit), no un console.log decorativo.
    expect(semilla).toMatch(/startsWith\('demo-'\)[\s\S]{0,200}process\.exit\(1\)/)
  })
})
