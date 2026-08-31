/**
 * GOLDEN — QUIÉN PUEDE ACUÑAR UNA URL FIRMADA DEL MEMBRETE, LA FIRMA Y EL SELLO
 * DE UN MÉDICO.
 *
 * ── QUÉ PROTEGE ─────────────────────────────────────────────────────────────
 *
 * `POST /api/receta/diseno-url` acuña URLs firmadas para el proxy
 * `GET /api/receta/diseno`, que descarga de Firebase Storage con el **Admin
 * SDK** — que se salta las reglas de Storage. Lo que hay detrás de esos paths no
 * es una imagen cualquiera: es el **membrete, la firma autógrafa y el sello** del
 * médico, lo que va impreso en una receta con cédula profesional.
 *
 * La ruta tiene la comprobación que lo impide («IDOR (auditoría P1)»): sólo se
 * acuña el diseño propio o el de un miembro de la MISMA clínica —la asistente
 * imprime por su médico—, y el cruce a otra clínica se corta.
 *
 * ── CÓMO SE DESCUBRIÓ QUE FALTABA ESTE GOLDEN ───────────────────────────────
 *
 * Revisando el PR #355 el 31-ago-2026. `docs/maintenance/PRS-SIN-ABSORBER-2026-08-30.md`
 * lo daba por cubierto —«la ruta y el token SÍ están en main… lo que falta son
 * dos guardianes»—, y al medirlo resultó cierto a medias: la comprobación
 * existe en el árbol y **ninguna prueba la mencionaba**. `grep -rl diseno-url
 * src/__tests__/` no devolvía nada.
 *
 * Una protección de aislamiento entre consultorios sin guardián es una
 * protección que el siguiente refactor se lleva por delante sin que nada se
 * ponga rojo. Es el modo de fallo de `security-tenant.md`: «esconder un botón no
 * cierra una ruta HTTP».
 *
 * ── QUÉ NO CUBRE, Y ES IMPORTANTE ───────────────────────────────────────────
 *
 * Esto congela lo que la ruta hace HOY. Hay tres sitios donde el árbol de hoy es
 * MÁS LAXO que lo que propone el PR #355, y este golden los deja **declarados,
 * no arreglados** — cambiarlos es decisión del dueño porque toca la papelería en
 * uso:
 *
 * 1. **Sin secreto configurado la ruta falla ABIERTA**: devuelve la URL pelada
 *    (sin firma) en vez de negarse. #355 la haría fallar cerrada con 503. Aquí
 *    se prueba el comportamiento real, y se nombra.
 * 2. **El token liga `path|exp`, no al dueño ni al consultorio.** Una URL ya
 *    firmada que se filtre (un PDF reenviado, el historial, una caché) sirve
 *    durante su vida entera, y esa vida son **24 h** (#355 la baja a 15 min y
 *    mete `ownerUid` y `clinicId` dentro del HMAC).
 * 3. **Una URL SIN firma sigue pasando** por el proxy mientras
 *    `RECETA_DISENO_FIRMA` no valga `obligatoria` en Vercel. Eso es una variable
 *    de entorno de producción, no código, y este golden no puede verla.
 *
 * Tampoco prueba Firebase de verdad (el Admin SDK va con dobles), ni las reglas
 * de Storage, ni el proxy `GET`. Datos 100 % ficticios.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/** `clinic_members/{uid}` sintético. */
let miembros: Record<string, { clinicId?: string } | undefined> = {}
/** Cuando es true, la lectura de membresía revienta (Firestore caído). */
let firestoreCaido = false
/** Cada `clinic_members/{uid}` que se llegó a leer: el testigo del coste. */
const leidos: string[] = []

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: (c: string) => ({
      doc: (id: string) => ({
        get: async () => {
          if (firestoreCaido) throw new Error('firestore caído')
          leidos.push(id)
          if (c !== 'clinic_members') return { exists: false, data: () => undefined }
          const m = miembros[id]
          return { exists: m !== undefined, data: () => m }
        },
      }),
    }),
  },
  default: {},
}))

const verificarUsuario = vi.fn()
vi.mock('@/lib/auth-server', () => ({
  verificarUsuario: (...a: unknown[]) => verificarUsuario(...a),
}))

import { POST } from '@/app/api/receta/diseno-url/route'

const MEDICO_A = 'uidAAAAAAAAAAAAAAAAAAAAAAAAA'
const MEDICO_B = 'uidBBBBBBBBBBBBBBBBBBBBBBBBB'
const ASISTENTE_A = 'uidASISTENTEAAAAAAAAAAAAAAAA'
const SUELTO = 'uidSINCONSULTORIOAAAAAAAAAAA'
const CLINICA_A = 'clinicA'
const CLINICA_B = 'clinicB'
const FIRMA_DE_A = `receta-diseno/${MEDICO_A}/firma.png`
const FIRMA_DE_B = `receta-diseno/${MEDICO_B}/firma.png`

const env = process.env as Record<string, string | undefined>
const previo: Record<string, string | undefined> = {}
const CLAVES = ['RECETA_DISENO_SECRET', 'PORTAL_PACIENTE_SECRET']

const acunar = (body: unknown) => POST({ json: async () => body } as never)
const urlsDe = async (res: { json: () => Promise<unknown> }) =>
  ((await res.json()) as { urls?: Record<string, string> }).urls ?? {}

beforeEach(() => {
  for (const k of CLAVES) previo[k] = env[k]
  env.RECETA_DISENO_SECRET = 'secreto-de-prueba'
  delete env.PORTAL_PACIENTE_SECRET
  leidos.length = 0
  firestoreCaido = false
  miembros = {
    [MEDICO_A]: { clinicId: CLINICA_A },
    [ASISTENTE_A]: { clinicId: CLINICA_A },
    [MEDICO_B]: { clinicId: CLINICA_B },
  }
  verificarUsuario.mockReset()
  verificarUsuario.mockResolvedValue({ ok: true, uid: MEDICO_A })
})
afterEach(() => {
  for (const k of CLAVES) { if (previo[k] === undefined) delete env[k]; else env[k] = previo[k] }
})

describe('la firma de un médico no se acuña para otro consultorio', () => {
  it('EL CRUCE DE CLÍNICA SE CORTA: el médico B no obtiene la firma del médico A', async () => {
    verificarUsuario.mockResolvedValue({ ok: true, uid: MEDICO_B })
    const urls = await urlsDe(await acunar({ paths: [FIRMA_DE_A] }))
    expect(urls[FIRMA_DE_A]).toBeUndefined()
    expect(Object.keys(urls)).toEqual([])
  })

  it('pedir la propia Y la ajena en la misma petición sólo devuelve la propia', async () => {
    verificarUsuario.mockResolvedValue({ ok: true, uid: MEDICO_B })
    const urls = await urlsDe(await acunar({ paths: [FIRMA_DE_A, FIRMA_DE_B] }))
    expect(Object.keys(urls)).toEqual([FIRMA_DE_B])
  })

  /* AL REVÉS: sin estos dos, un guardián que sólo comprobara el cruce pasaría
     con una ruta que no acuña NADA para nadie — y la papelería no imprimiría. */
  it('el dueño sí obtiene la suya, firmada', async () => {
    const urls = await urlsDe(await acunar({ paths: [FIRMA_DE_A] }))
    expect(urls[FIRMA_DE_A]).toMatch(/^\/api\/receta\/diseno\?path=/)
    expect(urls[FIRMA_DE_A]).toMatch(/&exp=\d+&sig=[0-9a-f]+$/)
  })

  it('la asistente de la MISMA clínica sí acuña la de su médico — imprime por él', async () => {
    verificarUsuario.mockResolvedValue({ ok: true, uid: ASISTENTE_A })
    const urls = await urlsDe(await acunar({ paths: [FIRMA_DE_A] }))
    expect(urls[FIRMA_DE_A]).toMatch(/&sig=[0-9a-f]+$/)
  })

  it('SIN SESIÓN no se acuña nada, y se corta ANTES de leer ninguna membresía', async () => {
    verificarUsuario.mockResolvedValue({ ok: false, response: new Response('no', { status: 401 }) })
    const res = await acunar({ paths: [FIRMA_DE_A] })
    expect((res as Response).status).toBe(401)
    expect(leidos).toEqual([])
  })

  it('pedir la propia no cuesta ninguna lectura de la membresía ajena', async () => {
    await acunar({ paths: [FIRMA_DE_A] })
    expect(leidos).not.toContain(MEDICO_B)
  })

  it('quien no tiene consultorio verificado no acuña el de nadie más', async () => {
    verificarUsuario.mockResolvedValue({ ok: true, uid: SUELTO })
    const urls = await urlsDe(await acunar({ paths: [FIRMA_DE_A] }))
    expect(urls[FIRMA_DE_A]).toBeUndefined()
  })

  it('si la membresía no se puede leer, el ajeno NO se acuña (falla cerrado)', async () => {
    verificarUsuario.mockResolvedValue({ ok: true, uid: MEDICO_B })
    firestoreCaido = true
    const urls = await urlsDe(await acunar({ paths: [FIRMA_DE_A] }))
    expect(urls[FIRMA_DE_A]).toBeUndefined()
  })

  it.each([
    ['traversal', 'receta-diseno/../../etc/passwd'],
    ['fuera de la carpeta', 'otra-carpeta/uid/firma.png'],
    ['sin dueño derivable', 'receta-diseno/firma.png'],
    ['con esquema dentro', 'receta-diseno/uid/http://malo/x.png'],
  ])('un path %s no se acuña', async (_caso, path) => {
    const urls = await urlsDe(await acunar({ paths: [path] }))
    expect(urls[path]).toBeUndefined()
  })

  it('body sin paths → 400', async () => {
    const res = await acunar({}) as Response
    expect(res.status).toBe(400)
  })
})

/**
 * Lo laxo, congelado a propósito: si alguien lo endurece (que es lo que propone
 * el PR #355), estas dos se ponen rojas y le obligan a venir aquí a leer por qué
 * estaban así. Un golden también sirve para que un cambio deseable no pase
 * inadvertido.
 */
describe('lo que hoy es MÁS LAXO de lo que el #355 propone — declarado, no arreglado', () => {
  it('SIN SECRETO la ruta falla ABIERTA: devuelve la URL pelada, sin firma', async () => {
    delete env.RECETA_DISENO_SECRET
    delete env.PORTAL_PACIENTE_SECRET
    const urls = await urlsDe(await acunar({ paths: [FIRMA_DE_A] }))
    expect(urls[FIRMA_DE_A]).toBe(`/api/receta/diseno?path=${encodeURIComponent(FIRMA_DE_A)}`)
    expect(urls[FIRMA_DE_A]).not.toMatch(/sig=/)
  })

  it('la firma acuñada dura 24 h, y no lleva dentro ni el dueño ni el consultorio', async () => {
    const urls = await urlsDe(await acunar({ paths: [FIRMA_DE_A] }))
    const exp = Number(new URL(urls[FIRMA_DE_A], 'https://x.mx').searchParams.get('exp'))
    const vidaH = (exp - Math.floor(Date.now() / 1000)) / 3600
    expect(vidaH).toBeGreaterThan(23)
    expect(urls[FIRMA_DE_A]).not.toMatch(/[?&](own|cid)=/)
  })
})
