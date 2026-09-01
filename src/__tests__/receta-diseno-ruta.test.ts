/**
 * R-06 / issue #350 — el proxy del diseño de receta NO llega al Admin SDK sin
 * una capacidad ligada, y la capacidad sólo nace autenticada.
 *
 * QUÉ FALLABA: `GET /api/receta/diseno?path=receta-diseno/<uid>/membrete.png`
 * descargaba de Firebase Storage con **Admin SDK** —que ignora las reglas de
 * Storage— después de comprobar únicamente la forma del path. La firma opcional
 * ligaba `path|exp`, nunca al dueño ni al consultorio, y sin firma se pasaba
 * igual. Cualquiera con la URL (un PDF reenviado, el historial, una caché) leía
 * el membrete, la FIRMA y el SELLO del médico.
 *
 * CÓMO SE DESCUBRIÓ: auditoría del tablero de producto #296, lane R-06;
 * residual ya anotado en REG-021 del ledger.
 *
 * CAUSA RAÍZ: se tomó «ruta no enumerable» por «ruta autorizada».
 *
 * REGLA QUE LO HACE SEGURO: sólo la ruta AUTENTICADA `POST
 * /api/receta/diseno-url` acuña, y sólo tras resolver el consultorio canónico en
 * `clinic_members`; el proxy exige esa capacidad antes de tocar el Admin SDK.
 *
 * QUÉ NO CUBRE: no prueba Firebase de verdad (el Admin SDK va con dobles), no
 * prueba las reglas de Storage, no toca el espacio de fotos clínicas (R-05 /
 * #353) ni el membrete embebido en el .doc de Word. Datos 100 % ficticios.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Dobles del Admin SDK ──────────────────────────────────────────────────
/** Todo path que llegó a `bucket().file()`: el testigo de «tocó el Admin SDK». */
const descargados: string[] = []
/** `clinic_members/{uid}` sintético. */
let miembros: Record<string, { clinicId?: string } | undefined> = {}
/** Si es true, la lectura de membresía revienta (Firestore caído). */
let firestoreCaido = false

vi.mock('@/lib/firebase-admin', () => ({
  default: {
    storage: () => ({
      bucket: () => ({
        file: (p: string) => {
          descargados.push(p)
          return {
            download: async () => [Buffer.from('bytes-de-imagen')],
            getMetadata: async () => [{ contentType: 'image/png' }],
          }
        },
      }),
    }),
  },
  adminDb: {
    collection: (c: string) => ({
      doc: (id: string) => ({
        get: async () => {
          if (firestoreCaido) throw new Error('firestore caído')
          if (c !== 'clinic_members') return { exists: false, data: () => undefined }
          const m = miembros[id]
          return { exists: m !== undefined, data: () => m }
        },
      }),
    }),
  },
}))

// ── Doble de la frontera de autenticación ─────────────────────────────────
const verificarUsuario = vi.fn()
vi.mock('@/lib/auth-server', () => ({
  verificarUsuario: (...a: unknown[]) => verificarUsuario(...a),
}))

import { GET } from '@/app/api/receta/diseno/route'
import { POST } from '@/app/api/receta/diseno-url/route'
import { acunarCapacidadDiseno, urlDeCapacidad } from '@/lib/receta-diseno-token'

const OWNER_A = 'uidAAAAAAAAAAAAAAAAAAAAAAAAA'
const OWNER_B = 'uidBBBBBBBBBBBBBBBBBBBBBBBBB'
const ASISTENTE_A = 'uidASISTENTEAAAAAAAAAAAAAAAA'
const CLINICA_A = 'clinicA'
const CLINICA_B = 'clinicB'
const PATH_A = `receta-diseno/${OWNER_A}/membrete.png`
const PATH_B = `receta-diseno/${OWNER_B}/membrete.png`

const env = process.env as Record<string, string | undefined>
const previo: Record<string, string | undefined> = {}
const CLAVES = ['RECETA_DISENO_SECRET', 'PORTAL_PACIENTE_SECRET', 'RECETA_DISENO_COMPAT_SIN_FIRMA', 'VERCEL_ENV', 'NODE_ENV']

/** GET al proxy con la query dada (el resto de NextRequest no se usa). */
const proxy = (query: string) =>
  GET({ nextUrl: new URL(`https://app.ejemplo.mx/api/receta/diseno?${query}`) } as never)

/** GET al proxy con una URL relativa ya acuñada. */
const proxyUrl = (url: string) => proxy(url.split('?')[1] ?? '')

/** POST al acuñador. */
const acunar = (body: unknown) => POST({ json: async () => body } as never)

beforeEach(() => {
  for (const k of CLAVES) previo[k] = env[k]
  env.RECETA_DISENO_SECRET = 'secreto-de-prueba'
  delete env.PORTAL_PACIENTE_SECRET
  delete env.RECETA_DISENO_COMPAT_SIN_FIRMA
  delete env.VERCEL_ENV
  env.NODE_ENV = 'test'   // explícito: la compatibilidad depende de NO ser producción
  descargados.length = 0
  firestoreCaido = false
  miembros = {
    [OWNER_A]: { clinicId: CLINICA_A },
    [ASISTENTE_A]: { clinicId: CLINICA_A },
    [OWNER_B]: { clinicId: CLINICA_B },
  }
  verificarUsuario.mockReset()
  verificarUsuario.mockResolvedValue({ ok: true, uid: OWNER_A })
})
afterEach(() => {
  for (const k of CLAVES) { if (previo[k] === undefined) delete env[k]; else env[k] = previo[k] }
})

// ─────────────────────────────────────────────────────────────────────────
describe('POST /api/receta/diseno-url — la capacidad sólo nace autenticada y ligada', () => {
  it('el dueño autenticado obtiene una capacidad con SU uid y SU consultorio', async () => {
    const res = await acunar({ paths: [PATH_A] })
    expect(res.status).toBe(200)
    const { urls } = await res.json()
    const sp = new URL(urls[PATH_A], 'https://app.ejemplo.mx').searchParams
    expect(sp.get('own')).toBe(OWNER_A)
    expect(sp.get('cid')).toBe(CLINICA_A)
    expect(sp.get('v')).toBe('v2')
    expect(sp.get('sig')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('SIN SESIÓN no se acuña nada: se corta antes de leer membresías', async () => {
    const { NextResponse } = await import('next/server')
    verificarUsuario.mockResolvedValue({ ok: false, response: NextResponse.json({ ok: false }, { status: 401 }) })
    const res = await acunar({ paths: [PATH_A] })
    expect(res.status).toBe(401)
  })

  it('CRUCE DE CLÍNICA: el médico de la clínica B no acuña el diseño del médico de la clínica A', async () => {
    verificarUsuario.mockResolvedValue({ ok: true, uid: OWNER_B })
    const res = await acunar({ paths: [PATH_A] })
    expect(res.status).toBe(200)
    const { urls } = await res.json()
    expect(urls[PATH_A]).toBeUndefined()   // no se acuña; no hay URL que filtrar
  })

  it('la asistente de la MISMA clínica sí acuña el diseño de su médico (imprime por él)', async () => {
    verificarUsuario.mockResolvedValue({ ok: true, uid: ASISTENTE_A })
    const { urls } = await (await acunar({ paths: [PATH_A] })).json()
    const sp = new URL(urls[PATH_A], 'https://app.ejemplo.mx').searchParams
    expect(sp.get('own')).toBe(OWNER_A)      // el dueño del path…
    expect(sp.get('cid')).toBe(CLINICA_A)    // …y la clínica verificada de quien llama
  })

  it('sin consultorio verificado NO se acuña ni el propio diseño (falla cerrado)', async () => {
    miembros = {}
    const res = await acunar({ paths: [PATH_A] })
    expect(res.status).toBe(403)
    expect((await res.json()).urls).toBeUndefined()
  })

  it('fallo de lectura de membresía → 503, nunca una capacidad', async () => {
    firestoreCaido = true
    const res = await acunar({ paths: [PATH_A] })
    expect(res.status).toBe(503)
    expect((await res.json()).urls).toBeUndefined()
  })

  it('SIN SECRETO falla cerrado con 503 — jamás devuelve la URL pelada', async () => {
    delete env.RECETA_DISENO_SECRET
    delete env.PORTAL_PACIENTE_SECRET
    const res = await acunar({ paths: [PATH_A] })
    expect(res.status).toBe(503)
    const j = await res.json()
    expect(j.urls).toBeUndefined()
  })

  it('paths con traversal, fuera de carpeta o sin dueño derivable no se acuñan', async () => {
    const malos = ['receta-diseno/../secreto.png', 'otra-carpeta/x/y.png', `receta-diseno/${OWNER_A}`, 'receta-diseno//y.png']
    const { urls } = await (await acunar({ paths: malos })).json()
    expect(Object.keys(urls)).toEqual([])
  })

  it('body sin paths → 400', async () => {
    expect((await acunar({})).status).toBe(400)
    expect((await acunar({ paths: [] })).status).toBe(400)
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('GET /api/receta/diseno — sin capacidad ligada no se toca el Admin SDK', () => {
  it('CAMINO FELIZ: la URL recién acuñada sirve la imagen (la papelería no se rompe)', async () => {
    const { urls } = await (await acunar({ paths: [PATH_A] })).json()
    const res = await proxyUrl(urls[PATH_A])
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('cache-control')).toContain('private')
    expect(descargados).toEqual([PATH_A])
  })

  it('ACEPTACIÓN: `?path=` PELADO no llega al Admin SDK (403 y cero descargas)', async () => {
    const res = await proxy(`path=${encodeURIComponent(PATH_A)}`)
    expect(res.status).toBe(403)
    expect(descargados).toEqual([])
  })

  it('el `?path=` pelado sigue cerrado en modo equivalente a producción, se pida lo que se pida', async () => {
    env.RECETA_DISENO_COMPAT_SIN_FIRMA = '1'
    env.VERCEL_ENV = 'production'
    const res = await proxy(`path=${encodeURIComponent(PATH_A)}`)
    expect(res.status).toBe(403)
    expect(descargados).toEqual([])
  })

  it('la compatibilidad sin capacidad es explícita y acotada: sólo fuera de producción y sólo pedida', async () => {
    env.RECETA_DISENO_COMPAT_SIN_FIRMA = '1'
    expect((await proxy(`path=${encodeURIComponent(PATH_A)}`)).status).toBe(200)
    delete env.RECETA_DISENO_COMPAT_SIN_FIRMA
    expect((await proxy(`path=${encodeURIComponent(PATH_A)}`)).status).toBe(403)
  })

  it('SIN SECRETO en el servidor, una capacidad presentada se rechaza (no se abre el gate)', async () => {
    const { urls } = await (await acunar({ paths: [PATH_A] })).json()
    delete env.RECETA_DISENO_SECRET
    delete env.PORTAL_PACIENTE_SECRET
    const res = await proxyUrl(urls[PATH_A])
    expect(res.status).toBe(403)
    expect(descargados).toEqual([])
  })

  it('CRUCE DE DUEÑO: la capacidad de A no abre el path legado de B', async () => {
    const { urls } = await (await acunar({ paths: [PATH_A] })).json()
    const sp = new URL(urls[PATH_A], 'https://app.ejemplo.mx').searchParams
    sp.set('path', PATH_B)                                  // sólo se cambia el path
    expect((await proxy(sp.toString())).status).toBe(403)
    sp.set('own', OWNER_B)                                  // y ahora también el dueño
    expect((await proxy(sp.toString())).status).toBe(403)
    expect(descargados).toEqual([])
  })

  it('CRUCE DE CLÍNICA: reetiquetar el cid de la capacidad la rompe', async () => {
    const { urls } = await (await acunar({ paths: [PATH_A] })).json()
    const sp = new URL(urls[PATH_A], 'https://app.ejemplo.mx').searchParams
    sp.set('cid', CLINICA_B)
    expect((await proxy(sp.toString())).status).toBe(403)
    expect(descargados).toEqual([])
  })

  it('manipular exp, sig o v falla cerrado, incluso con la compatibilidad encendida', async () => {
    env.RECETA_DISENO_COMPAT_SIN_FIRMA = '1'   // nunca degrada a "sin capacidad"
    const { urls } = await (await acunar({ paths: [PATH_A] })).json()
    for (const [k, val] of [['exp', '9999999999'], ['sig', 'f'.repeat(64)], ['v', 'v1']] as const) {
      const sp = new URL(urls[PATH_A], 'https://app.ejemplo.mx').searchParams
      sp.set(k, val)
      expect((await proxy(sp.toString())).status, k).toBe(403)
    }
    expect(descargados).toEqual([])
  })

  it('una capacidad VENCIDA se rechaza con un mensaje accionable', async () => {
    const c = acunarCapacidadDiseno({ path: PATH_A, ownerUid: OWNER_A, clinicId: CLINICA_A, ahoraMs: Date.now(), ttlS: -10 })!
    const res = await proxyUrl(urlDeCapacidad(c))
    expect(res.status).toBe(403)
    expect(await res.text()).toContain('vencido')
    expect(descargados).toEqual([])
  })

  it('la rama legada `?u=` queda cerrada por defecto (no puede ligarse a dueño ni clínica)', async () => {
    const u = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/receta-diseno%2Fx%2Fy.png?alt=media'
    expect((await proxy(`u=${encodeURIComponent(u)}`)).status).toBe(403)
  })

  it('sin path ni u → 400', async () => {
    expect((await proxy('')).status).toBe(400)
  })

  it('anti-traversal: el path fuera de la carpeta se corta antes que nada', async () => {
    const c = acunarCapacidadDiseno({ path: 'receta-diseno/../etc.png', ownerUid: OWNER_A, clinicId: CLINICA_A, ahoraMs: Date.now() })!
    const res = await proxyUrl(urlDeCapacidad(c))
    expect(res.status).toBe(403)
    expect(await res.text()).toBe('Ruta no permitida')
    expect(descargados).toEqual([])
  })
})
