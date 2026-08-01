import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { RE_RUTAS_PRIVADAS, RE_RUTAS_PACIENTE } from '@/lib/security/rutas-privadas'

/**
 * Un paso MÁS CERCA de producción que `csp-guard.test.ts` (unidad Nexus OS E0-10).
 *
 * POR QUÉ EXISTE: `csp-guard.test.ts` llama a `nextConfig.headers()`, que es la
 * INTENCIÓN declarada en el código. Lo que Vercel consume de verdad es
 * `.next/routes-manifest.json`, el artefacto del build. Este archivo comprueba que la
 * intención sobrevivió al build: que la clave de la CSP corresponde al modo con el que
 * se construyó y que la zona autenticada conserva sus dos capas anti-clickjacking.
 *
 * OPT-IN A PROPÓSITO, Y SIN VERDE VACUO: sin `.next/routes-manifest.json` el caso se
 * declara SALTADO con el comando exacto que lo habilita. No se inventa un verde a
 * partir de un artefacto que no existe.
 *
 * NO SE SELLA en `src/lib/clinical/invariantes-clinicos.json` a propósito: puede
 * saltarse legítimamente (sin build no hay manifest) y el trinquete del gate cuenta
 * `it(` por texto, así que sellarlo contaría cobertura que a veces no corre.
 *
 * El MODO NO SE ADIVINA: se deriva de la clave presente en el bloque global y se
 * verifica la coherencia interna del manifest en el modo que sea. Así vale para el
 * build por defecto (report-only) y para `CSP_MODE=enforce npm run build`.
 *
 * Aquí no hay criterio clínico: son invariantes de configuración de software.
 */
const RUTA_MANIFEST = '.next/routes-manifest.json'
const RUTA_ABS = resolve(process.cwd(), RUTA_MANIFEST)

type Cabecera = { key: string; value: string }
type BloqueManifest = { source: string; headers: Cabecera[] }

const CLAVE_ENFORCE = 'content-security-policy'
const CLAVE_REPORTE = 'content-security-policy-report-only'

const cspDe = (b: BloqueManifest, clave: string) =>
  b.headers.filter(h => h.key.toLowerCase() === clave).map(h => h.value)

describe('E0-10 · el routes-manifest del build emite la CSP del modo con el que se construyó', () => {
  if (!existsSync(RUTA_ABS)) {
    // Saltado, no verde: la ausencia de evidencia no es evidencia de que todo esté bien.
    it.skip(`SIN EVIDENCIA — falta ${RUTA_MANIFEST}. Habilítalo con \`npm run build\` (o \`CSP_MODE=enforce npm run build\`)`, () => {})
    return
  }

  const bloques: BloqueManifest[] = JSON.parse(readFileSync(RUTA_ABS, 'utf8')).headers ?? []

  if (!bloques.some(b => b.source === RE_RUTAS_PRIVADAS)) {
    // Artefacto de un build ANTERIOR al estado actual de la lista de rutas privadas.
    // No es un defecto del código: es evidencia caducada, y se declara como tal en vez
    // de dar rojo (que culparía al código) o verde (que mentiría).
    it.skip(`EVIDENCIA CADUCADA — ${RUTA_MANIFEST} es de un build anterior a la lista de rutas privadas actual. Reconstruye con \`npm run build\``, () => {})
    return
  }

  const global = bloques.find(b => b.source === '/:path*')
  const privado = bloques.find(b => b.source === RE_RUTAS_PRIVADAS)
  const reservar = bloques.find(b => b.source === '/reservar/:path*')

  // Modo DERIVADO del artefacto, no de la variable de entorno de esta corrida.
  const modo: 'enforce' | 'report-only' =
    global && cspDe(global, CLAVE_ENFORCE).length > 0 ? 'enforce' : 'report-only'
  const claveQueBloquea = CLAVE_ENFORCE

  it('el bloque global lleva UNA sola política, en una clave coherente con el modo', () => {
    expect(global, `${RUTA_MANIFEST} no tiene el bloque global /:path*`).toBeDefined()
    const enforce = cspDe(global!, CLAVE_ENFORCE)
    const reporte = cspDe(global!, CLAVE_REPORTE)
    expect([...enforce, ...reporte].length, 'el bloque global debe emitir exactamente una CSP').toBe(1)
    if (modo === 'enforce') {
      expect(reporte, 'con CSP_MODE=enforce no debe quedar cabecera report-only').toEqual([])
      expect(enforce[0]).toContain("default-src 'self'")
    } else {
      expect(enforce, 'sin CSP_MODE nada debe viajar en la cabecera que bloquea').toEqual([])
      expect(reporte[0]).toContain("default-src 'self'")
    }
  })

  it('la zona autenticada conserva las DOS capas anti-clickjacking en el modo que sea', () => {
    expect(privado, `${RUTA_MANIFEST} no tiene el bloque de rutas privadas`).toBeDefined()
    expect(privado!.headers.find(h => h.key === 'X-Frame-Options')?.value).toBe('DENY')
    expect(
      cspDe(privado!, claveQueBloquea).some(v => v.includes("frame-ancestors 'none'")),
      `frame-ancestors 'none' debe viajar en la cabecera que BLOQUEA (modo del build: ${modo})`,
    ).toBe(true)
  })

  it('/reservar sigue embebible en el artefacto del build', () => {
    // El widget de agenda que los consultorios incrustan en su web: si el hardening lo
    // rompiera, sería una regresión visible para clientes.
    expect(reservar, `${RUTA_MANIFEST} no tiene el bloque /reservar/:path*`).toBeDefined()
    expect(reservar!.headers.map(h => h.key)).not.toContain('X-Frame-Options')
    expect(cspDe(reservar!, claveQueBloquea).some(v => v.includes('frame-ancestors *'))).toBe(true)
  })

  it('las rutas del paciente: sin referer, sin indexar y SIN DEJARSE ENCUADRAR', () => {
    /**
     * La ruta sale de la constante y no escrita a mano: tenerla a mano aquí es
     * lo que rompió esta prueba al añadir `teleconsulta` al grupo, y es el mismo
     * defecto que `rutas-privadas.ts` vino a arreglar.
     */
    const token = bloques.find(b => b.source === RE_RUTAS_PACIENTE)
    expect(token, 'el bloque de magic links desapareció del build').toBeDefined()
    expect(token!.headers.find(h => h.key === 'Referrer-Policy')?.value).toBe('no-referrer')
    expect(token!.headers.find(h => h.key === 'X-Robots-Tag')?.value).toContain('noindex')

    /**
     * Y anti-clickjacking, comprobado sobre el MANIFIESTO DEL BUILD — no sobre
     * la función de config. Estas rutas viajaban sin `X-Frame-Options` y sin
     * `frame-ancestors`: dentro de /mi están las recetas del paciente y los
     * botones de cancelar su cita.
     */
    expect(token!.headers.find(h => h.key === 'X-Frame-Options')?.value).toBe('DENY')
    expect(cspDe(token!, claveQueBloquea).some(v => v.includes("frame-ancestors 'none'"))).toBe(true)

    // Y va AL FINAL: cuando dos reglas fijan la misma cabecera, gana la última.
    expect(bloques[bloques.length - 1].source).toBe(RE_RUTAS_PACIENTE)
  })
})
