/**
 * GOLDEN — la puerta de entrada dice la verdad cuando no hay red.
 *
 * ── QUÉ FALLABA, MEDIDO EN NAVEGADOR ────────────────────────────────────────
 *
 * Cortando la llamada de identidad —lo que hace una red de consultorio con mala
 * señal— y pulsando el botón:
 *
 *   /login     → «Error al iniciar sesión. Intenta de nuevo.»
 *   /registro  → (ningún mensaje)
 *
 * El de `/login` culpa al inicio de sesión; lo que pasó fue que no había red. Y
 * lo que hace el médico con ese mensaje es exactamente lo contrario de lo que
 * le conviene: vuelve a teclear la contraseña, la cambia, pide recuperarla
 * —otra llamada que tampoco va a salir— y acaba llamando a soporte con una
 * cuenta que nunca estuvo mal.
 *
 * El de `/registro` es peor: no decía nada. Pulsar y que no pase nada es la
 * única cosa que un formulario no puede hacer.
 *
 * Y el recuadro de error no era una región viva, así que quien no mira la
 * pantalla —o usa lector— no se enteraba de que había fallado nada.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Probando a propósito el fallo de red con el navegador del arnés, que es lo
 * que la especificación de este carril pide para todo recorrido: fallo,
 * reintento, envío duplicado y resultado desconocido.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Familia «el mensaje mentía sobre la causa». El `else` final de cada `catch`
 * recogía TODO lo que no fuera un código conocido de credenciales, y un fallo
 * de red cae ahí.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - No reintenta solo, y es a propósito: sobre una red caída, reintentar añade
 *   espera sin añadir información.
 * - No distingue «no hay wifi» de «el proveedor no contesta». Desde el
 *   navegador no se puede, y prometerlo sería el mismo error otra vez.
 * - No cubre el resto de la aplicación: aquí sólo están las cinco puertas de
 *   identidad. Lo demás queda declarado, no resuelto.
 */
import { describe, it, expect } from 'vitest'
import { esFalloDeRed, MENSAJE_SIN_RED } from '@/lib/auth/fallo-de-red'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')
const LOGIN = leer('src/app/login/page.tsx')
const REGISTRO = leer('src/app/registro/page.tsx')

describe('reconocer un fallo de red', () => {
  it('por el código de Firebase', () => {
    expect(esFalloDeRed({ code: 'auth/network-request-failed' })).toBe(true)
    expect(esFalloDeRed({ code: 'auth/timeout' })).toBe(true)
  })

  it('por el mensaje, cuando no hay código', () => {
    expect(esFalloDeRed(new TypeError('Failed to fetch'))).toBe(true)
    expect(esFalloDeRed({ message: 'NetworkError when attempting to fetch resource.' })).toBe(true)
  })

  it('NO confunde un problema de credenciales con uno de red', () => {
    // Es la mitad que importa: si esto fallara, una contraseña mal escrita
    // diría «revisa tu conexión» y el médico no encontraría nunca su error.
    for (const code of ['auth/wrong-password', 'auth/user-not-found', 'auth/invalid-credential',
                        'auth/too-many-requests', 'auth/email-already-in-use', 'auth/weak-password']) {
      expect(esFalloDeRed({ code }), code).toBe(false)
    }
  })

  it('aguanta lo que no es un error', () => {
    for (const v of [null, undefined, '', 0, {}]) expect(esFalloDeRed(v)).toBe(false)
  })

  it('el mensaje nombra la causa y no culpa a los datos del médico', () => {
    expect(MENSAJE_SIN_RED).toMatch(/conexión/i)
    expect(MENSAJE_SIN_RED).toMatch(/tus datos están bien/i)
  })
})

describe('las puertas de identidad lo usan, y anuncian el fallo', () => {
  const sinImports = (s: string) => s.replace(/^\s*import[^\n]*$/gm, '')

  it('login y registro llaman al detector, no lo reimplementan', () => {
    for (const [nombre, src] of [['login', LOGIN], ['registro', REGISTRO]] as const) {
      expect(src, `${nombre} no importa el detector`).toContain('@/lib/auth/fallo-de-red')
      expect(sinImports(src), `${nombre} importa pero no llama`).toContain('esFalloDeRed(')
    }
  })

  it('la red se comprueba ANTES que los códigos de credenciales', () => {
    /**
     * El orden es el arreglo: si el `if` de la red fuera después, el código de
     * credenciales ganaría y volvería el mensaje que culpa a la contraseña.
     */
    const iRed = LOGIN.indexOf('esFalloDeRed(err)')
    const iCred = LOGIN.indexOf("code === 'auth/user-not-found'")
    expect(iRed).toBeGreaterThan(-1)
    expect(iRed, 'la red se comprueba después de las credenciales').toBeLessThan(iCred)
  })

  it('cubre las CINCO puertas, no sólo la primera', () => {
    // correo + Google + 2FA en login; correo + Google en registro.
    expect((LOGIN.match(/esFalloDeRed\(/g) ?? []).length).toBeGreaterThanOrEqual(3)
    expect((REGISTRO.match(/esFalloDeRed\(/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it('el recuadro de error es una región viva — si no, nadie se entera', () => {
    for (const [nombre, src] of [['login', LOGIN], ['registro', REGISTRO]] as const) {
      const i = src.indexOf('{error && (')
      expect(i, `${nombre} no pinta el error`).toBeGreaterThan(-1)
      expect(src.slice(i, i + 260), `${nombre}: el error no se anuncia`).toContain('role="alert"')
    }
  })
})
