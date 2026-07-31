import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import configDelGate from '../../vitest.config'
import {
  MATRIZ_ACCESO,
  type Guarda,
} from '@/lib/authz/matriz-acceso'
import {
  casosDeAislamiento,
  esRutaDeTenant,
  generarCasos,
  instanciar,
  rutasPublicas,
} from '../../emulator/casos-tenant'

/**
 * GUARDIÁN ESTÁTICO de la suite del emulador (unidad Nexus OS E0-08).
 *
 * Corre en el GATE NORMAL: sin Java, sin emulador, sin red. Su trabajo es que la
 * suite conductual de `emulator/` no se pueda (a) colar dentro del gate compartido y
 * tumbar el lote de las demás unidades del programa, ni (b) vaciarse con el tiempo
 * hasta pasar en verde probando nada.
 *
 * Lo que este archivo NO puede demostrar, dicho sin adornos: que el motor de reglas
 * niegue de verdad un acceso cross-tenant. Eso solo lo demuestra
 * `npm run test:emulador` en una máquina con JRE (o el job `aislamiento-tenant` del
 * CI). Aquí se verifica el ANDAMIAJE, no la política.
 */

const raiz = process.cwd()
const leer = (p: string) => readFileSync(resolve(raiz, p), 'utf8')

/** Lista recursiva de ficheros bajo un directorio del repo. */
function ficheros(dir: string): string[] {
  return readdirSync(resolve(raiz, dir), { withFileTypes: true, recursive: true })
    .filter(d => d.isFile())
    .map(d => d.name)
}

describe('E0-08 · el gate compartido queda protegido de la suite del emulador', () => {
  it('vitest.config.ts excluye emulator/** y su include no los alcanza', () => {
    // Se inspecciona el OBJETO de configuración, no el texto: un comentario que
    // mencione "emulator" no debe poder hacer pasar esta prueba.
    const exclude = configDelGate.test?.exclude ?? []
    expect(exclude).toContain('emulator/**')
    // Y el include sigue apuntando SOLO a src/__tests__ (si alguien lo abre a
    // '**/*.test.ts', los .emu.test.ts entrarían y el gate se caería sin Java).
    expect(configDelGate.test?.include).toEqual(['src/__tests__/**/*.test.ts'])
  })

  it('no existe ningún *.emu.test.ts dentro de src/__tests__', () => {
    const colados = ficheros('src/__tests__').filter(n => n.endsWith('.emu.test.ts'))
    expect(colados).toEqual([])
  })

  it('los specs del emulador viven en emulator/ y llevan el sufijo .emu.test.ts', () => {
    const specs = ficheros('emulator').filter(n => n.endsWith('.test.ts'))
    expect(specs.length).toBeGreaterThan(0)
    expect(specs.every(n => n.endsWith('.emu.test.ts'))).toBe(true)
  })

  it('vitest.emulator.config.ts es una config APARTE, serializada y sin paralelismo', () => {
    const cfg = leer('vitest.emulator.config.ts')
    expect(cfg).toContain("include: ['emulator/**/*.emu.test.ts']")
    // Un solo emulador compartido: paralelizar ficheros produce carreras de siembra.
    expect(cfg).toContain('fileParallelism: false')
  })
})

describe('E0-08 · firebase.json declara el emulador SIN perder el deploy de reglas', () => {
  const firebaseJson = JSON.parse(leer('firebase.json')) as {
    firestore?: { rules?: string }
    storage?: { rules?: string }
    emulators?: { firestore?: { port?: number }; singleProjectMode?: boolean }
  }

  it('el bloque emulators existe con firestore en 8080 y singleProjectMode', () => {
    expect(firebaseJson.emulators?.firestore?.port).toBe(8080)
    expect(firebaseJson.emulators?.singleProjectMode).toBe(true)
  })

  it('REGRESIÓN: sigue declarando firestore.rules y storage.rules', () => {
    // El cambio de esta unidad es ADITIVO. Si alguien reescribe el archivo y se lleva
    // estas claves, `firebase deploy --only firestore:rules` deja de encontrar las
    // reglas — y el despliegue de seguridad se rompe en silencio.
    expect(firebaseJson.firestore?.rules).toBe('firestore.rules')
    expect(firebaseJson.storage?.rules).toBe('storage.rules')
  })
})

describe('E0-08 · el comando del emulador TERMINA solo y apunta a un proyecto demo', () => {
  const pkg = JSON.parse(leer('package.json')) as {
    scripts: Record<string, string>
    devDependencies: Record<string, string>
  }

  it('test:emulador usa emulators:exec y NUNCA emulators:start', () => {
    const cmd = pkg.scripts['test:emulador']
    expect(cmd).toBeTruthy()
    expect(cmd).toContain('emulators:exec')
    // `emulators:start` deja un servidor vivo: un agente colgado ahí tumba la corrida
    // entera del programa (regla 8 de la carta operativa).
    expect(cmd).not.toContain('emulators:start')
  })

  it('test:emulador usa un projectId demo-* (no puede tocar un proyecto real)', () => {
    expect(pkg.scripts['test:emulador']).toMatch(/--project demo-[a-z0-9-]+/)
  })

  it('las dependencias del emulador están PINNEADAS (reproducibilidad)', () => {
    // Sin pin exacto, una corrida futura del CI puede probar contra otra versión del
    // motor de reglas. Reproducibilidad > rendimiento (regla 4).
    for (const dep of ['@firebase/rules-unit-testing', 'firebase-tools']) {
      const v = pkg.devDependencies[dep]
      expect(v, `falta la devDependency ${dep}`).toBeTruthy()
      expect(v, `${dep} debe ir pinneada, sin ^ ni ~`).toMatch(/^\d+\.\d+\.\d+$/)
    }
  })
})

describe('E0-08 · el CI corre el aislamiento en un job APARTE', () => {
  const ci = leer('.github/workflows/ci.yml')
  /** Trocea el yaml por cabecera de job (dos espacios de sangría + nombre + `:`). */
  const jobs = (() => {
    const m = new Map<string, string>()
    const partes = ci.split(/\n(?=  [a-z][a-z0-9-]*:\n)/)
    for (const p of partes) {
      const nombre = /^\s{2}([a-z][a-z0-9-]*):/m.exec(p)?.[1]
      if (nombre) m.set(nombre, p)
    }
    return m
  })()

  it('existe el job aislamiento-tenant y provisiona una JRE', () => {
    const job = jobs.get('aislamiento-tenant')
    expect(job, 'el job aislamiento-tenant desapareció del CI').toBeTruthy()
    expect(job).toContain('npm run test:emulador')
    // El emulador es un JAR: sin JRE el job pasaría en verde por no correr nada... o
    // caería con un error que nadie sabría leer.
    expect(job).toContain('actions/setup-java')
  })

  it('test:emulador NO se metió en clinical-safety ni en verificar', () => {
    // `clinical-safety` es el *required status check* de main. Un emulador flaky no
    // debe poder teñirlo de rojo. Y `verificar` corre los tres gates del programa,
    // que deben funcionar en máquinas sin Java.
    for (const nombre of ['clinical-safety', 'verificar']) {
      const job = jobs.get(nombre)
      expect(job, `el job ${nombre} desapareció del CI`).toBeTruthy()
      expect(job).not.toContain('test:emulador')
    }
  })
})

describe('E0-08 · ANTI-ENCOGIMIENTO: los casos se derivan de la matriz, no de una lista', () => {
  const casos = generarCasos()
  const plantillasCubiertas = new Set(casos.map(c => c.plantilla))

  it('cubre el 100% de los recursos con clinicId POSICIONAL', () => {
    const esperadas = MATRIZ_ACCESO.filter(r => esRutaDeTenant(r.ruta)).map(r => r.ruta)
    expect(esperadas.length).toBeGreaterThan(30)
    const sinCubrir = esperadas.filter(r => !plantillasCubiertas.has(r))
    expect(
      sinCubrir,
      'hay colecciones bajo clinics/{clinicId} que la suite de aislamiento NO prueba',
    ).toEqual([])
  })

  it('no inventa rutas: toda plantilla cubierta existe en MATRIZ_ACCESO', () => {
    const enLaMatriz = new Set(MATRIZ_ACCESO.map(r => r.ruta))
    expect([...plantillasCubiertas].filter(r => !enLaMatriz.has(r))).toEqual([])
  })

  it('rutasPublicas() es EXACTAMENTE el conjunto con guarda publico en la matriz', () => {
    // Si alguien mete una excepción "pública" a mano en el generador, la suite
    // dejaría de exigir denegación cross-tenant en esa ruta sin que nadie lo note.
    const PUBLICO: Guarda = 'publico'
    for (const op of ['read', 'write'] as const) {
      const enLaMatriz = MATRIZ_ACCESO
        .filter(r => (op === 'read' ? r.guardaLectura : r.guardaEscritura) === PUBLICO)
        .map(r => r.ruta)
        .sort()
      expect([...rutasPublicas(op)].sort(), `rutas publico para ${op}`).toEqual(enLaMatriz)
    }
    // Y que de verdad hay alguna: si la matriz dejara de tener entradas `publico`,
    // esta prueba pasaría comparando dos listas vacías.
    expect(rutasPublicas('read').length + rutasPublicas('write').length).toBeGreaterThan(0)
  })

  it('TODO caso cross-tenant no público espera DENEGADO (es la aceptación)', () => {
    const aislamiento = casosDeAislamiento()
    expect(aislamiento.length).toBeGreaterThan(500)
    expect(aislamiento.every(c => c.esperado === 'denegado')).toBe(true)
    expect(aislamiento.every(c => c.esCrossTenant)).toBe(true)
    // Y prueba las dos direcciones: A→B y B→A. Probar una sola dejaría media
    // afirmación sin evidencia.
    const direcciones = new Set(aislamiento.map(c => `${c.tenantDelUsuario}->${c.tenantDelRecurso}`))
    expect(direcciones.size).toBe(2)
  })

  it('los 8 roles y las 2 operaciones entran en los casos de aislamiento', () => {
    const aislamiento = casosDeAislamiento()
    expect(new Set(aislamiento.map(c => c.rol)).size).toBe(8)
    expect(new Set(aislamiento.map(c => c.operacion))).toEqual(new Set(['read', 'write']))
  })

  it('instanciar() sustituye TODOS los comodines (ninguna ruta llega con llaves)', () => {
    // Una ruta con `{docId}` sin sustituir apuntaría a un documento cuyo id es
    // literalmente "{docId}": la operación pasaría o fallaría por el motivo
    // equivocado y el aislamiento quedaría sin probar.
    expect(casos.every(c => !c.ruta.includes('{') && !c.ruta.includes('}'))).toBe(true)
    // Y la ruta instanciada tiene el MISMO número de segmentos que la plantilla:
    // Firestore exige alternancia colección/documento.
    expect(casos.every(c => c.ruta.split('/').length === c.plantilla.split('/').length)).toBe(true)
    // Segmentos pares → documento: todas las plantillas de la matriz son documentos.
    expect(casos.every(c => c.ruta.split('/').length % 2 === 0)).toBe(true)
  })

  it('la ruta lleva el tenant del RECURSO y el uid del ACTOR', () => {
    // Es la decisión que hace fuerte a la Afirmación A: en `learning/{uid}` y
    // `chat_reads/{uid}` la regla exige `request.auth.uid == uid`, así que se
    // instancia con el uid del atacante — el caso MÁS permisivo posible. Si se
    // deniega, solo puede ser por el aislamiento de clínica.
    const conUid = casos.filter(c => c.plantilla.includes('{uid}'))
    expect(conUid.length).toBeGreaterThan(0)
    for (const c of conUid) {
      expect(c.ruta).toContain(`clinics/${c.tenantDelRecurso}/`)
      expect(c.ruta.endsWith(`u-${c.tenantDelUsuario}-${c.rol}`)).toBe(true)
    }
    expect(instanciar('clinics/{clinicId}/learning/{uid}', 'c-1', 'u-1')).toBe(
      'clinics/c-1/learning/u-1',
    )
  })
})
