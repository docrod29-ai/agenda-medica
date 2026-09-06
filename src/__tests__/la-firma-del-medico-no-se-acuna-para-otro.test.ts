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
 * ── LO QUE ERA LAXO, Y DEJÓ DE SERLO — #355, 1-sep-2026 ──────────────────────
 *
 * Este bloque nació congelando tres laxitudes A PROPÓSITO, con esta nota:
 *
 *   «si alguien lo endurece (que es lo que propone el PR #355), estas dos se
 *    ponen rojas y le obligan a venir aquí a leer por qué estaban así»
 *
 * Funcionó: al fusionar el #355 se pusieron rojas las dos, y esto es la lectura
 * que exigían. Las afirmaciones se INVIERTEN —no se borran— porque el valor del
 * golden no era el número, era el registro de que alguien miró y decidió.
 *
 * Lo que cambió, medido contra el código, no contra el PR:
 *
 *   | | Antes | Ahora |
 *   |---|---|---|
 *   | Qué liga la firma | `path\|exp` | `version\|path\|ownerUid\|clinicId\|exp` |
 *   | Cuánto dura | 24 h | 15 min |
 *   | Sin secreto en el servidor | devolvía la URL PELADA (falla abierta) | **503** |
 *   | URL sin firma en el proxy | pasaba salvo `RECETA_DISENO_FIRMA=obligatoria` | se rechaza, y la compatibilidad **no existe en producción** |
 *
 * El cambio que más pesa no es el de los 15 minutos: es el de la ÚLTIMA fila.
 * Antes la puerta estaba abierta y se cerraba poniendo una variable de entorno;
 * ahora está cerrada y sólo se abre poniendo otra —y ni así en producción—. Una
 * defensa que depende de que alguien se acuerde de encenderla ya falló una vez
 * en este repositorio, y es una familia de defecto con nombre propio.
 *
 * QUÉ NO CUBRE: que la capacidad no se pueda REENVIAR. Quince minutos y el
 * ligado al dueño acotan el daño de una fuga, no la impiden: quien tenga la URL
 * dentro de su ventana baja ese objeto. Cerrarlo del todo exige una sesión en el
 * proxy, y el proxy lo consume un `<img>` que no manda cabeceras.
 */
describe('lo que era laxo y el #355 cerró — probado al revés en su día', () => {
  it('SIN SECRETO la ruta falla CERRADA: 503, y ninguna URL sale', async () => {
    /**
     * Antes devolvía `/api/receta/diseno?path=…` sin firma, y el proxy la
     * aceptaba: una variable que faltara en el servidor abría la puerta entera.
     * Un fallo de configuración no puede ser un permiso.
     */
    delete env.RECETA_DISENO_SECRET
    delete env.PORTAL_PACIENTE_SECRET
    const res = await acunar({ paths: [FIRMA_DE_A] }) as Response
    expect(res.status).toBe(503)
    const cuerpo = await res.json()
    expect(cuerpo.ok).toBe(false)
    expect(cuerpo.urls, 'un 503 que además devuelve urls no es un 503').toBeUndefined()
  })

  it('la capacidad dura 15 minutos y lleva dentro el dueño y el consultorio', async () => {
    const urls = await urlsDe(await acunar({ paths: [FIRMA_DE_A] }))
    const u = new URL(urls[FIRMA_DE_A], 'https://x.mx')
    const vidaMin = (Number(u.searchParams.get('exp')) - Math.floor(Date.now() / 1000)) / 60

    // Techo Y suelo. Sin el suelo, una capacidad que caducara al instante
    // pasaría esta prueba y rompería el producto; sin el techo, volver a las
    // 24 h no la despertaría.
    expect(vidaMin).toBeLessThanOrEqual(15)
    expect(vidaMin).toBeGreaterThan(10)

    // Lo que de verdad cambia el modelo de amenaza: la firma deja de ser
    // transferible entre consultorios porque el dueño y la clínica van DENTRO
    // del mensaje que se firma, no al lado.
    expect(u.searchParams.get('own')).toBe(MEDICO_A)
    expect(u.searchParams.get('cid')).toBe(CLINICA_A)
    expect(u.searchParams.get('v')).toBe('v2')
    expect(u.searchParams.get('sig')).toMatch(/^[0-9a-f]{64}$/)
  })
})
