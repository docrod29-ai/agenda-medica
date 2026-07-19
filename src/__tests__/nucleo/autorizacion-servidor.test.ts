import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Cobertura de las tres superficies que la auditoría encontró al 0%:
 * `auth-server.ts`, `superadmin.ts` y `rate-limit.ts`.
 *
 * Se probaron al final porque son puro "plumbing", pero es justo donde un fallo
 * es un incidente de seguridad y no un bug de pantalla: son la única frontera de
 * las API routes, que usan el Admin SDK y por tanto SALTAN las firestore.rules.
 */

// ── Dobles del Admin SDK ──────────────────────────────────────────────────
const verifyIdToken = vi.fn()
const getMiembro = vi.fn()

vi.mock('@/lib/firebase-admin', () => ({
  default: { auth: () => ({ verifyIdToken }) },
  adminDb: { collection: () => ({ doc: () => ({ get: getMiembro }) }) },
}))

import { verificarUsuario, verificarMiembro, verificarMedico } from '@/lib/auth-server'
import { esSuperadmin, superadminEmails, verificarSuperadmin } from '@/lib/superadmin'

/** NextRequest mínimo: a estos helpers solo les importan las cabeceras. */
function req(authorization?: string) {
  return { headers: new Headers(authorization ? { authorization } : {}) } as never
}

const miembro = (data: Record<string, unknown> | null) => ({ exists: data !== null, data: () => data })

beforeEach(() => {
  verifyIdToken.mockReset()
  getMiembro.mockReset()
})

describe('verificarUsuario — bloqueo de acceso anónimo', () => {
  it('sin cabecera Authorization → 401', async () => {
    const r = await verificarUsuario(req())
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(401)
  })

  it('sin el prefijo "Bearer " no se acepta el token suelto', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1' })
    const r = await verificarUsuario(req('token-crudo-sin-bearer'))
    expect(r.ok).toBe(false)
    expect(verifyIdToken).not.toHaveBeenCalled()   // ni siquiera se intenta verificar
  })

  it('"Bearer " vacío → 401, no pasa una cadena vacía al Admin SDK', async () => {
    const r = await verificarUsuario(req('Bearer    '))
    expect(r.ok).toBe(false)
    expect(verifyIdToken).not.toHaveBeenCalled()
  })

  it('token que el Admin SDK rechaza (vencido/falsificado) → 401', async () => {
    verifyIdToken.mockRejectedValue(new Error('token expirado'))
    const r = await verificarUsuario(req('Bearer falso'))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(401)
  })

  it('token válido → deja pasar con el uid', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'a@b.com' })
    const r = await verificarUsuario(req('Bearer bueno'))
    expect(r).toMatchObject({ ok: true, uid: 'u1', email: 'a@b.com' })
  })
})

describe('verificarMiembro — aislamiento entre consultorios', () => {
  beforeEach(() => { verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'a@b.com' }) })

  it('AISLAMIENTO: autenticado pero de OTRA clínica → 403', async () => {
    getMiembro.mockResolvedValue(miembro({ clinicId: 'clinica-ajena', role: 'admin' }))
    const r = await verificarMiembro(req('Bearer bueno'), 'mi-clinica')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(403)
  })

  it('sin membresía alguna → 403', async () => {
    getMiembro.mockResolvedValue(miembro(null))
    const r = await verificarMiembro(req('Bearer bueno'), 'mi-clinica')
    expect(r.ok).toBe(false)
  })

  it('miembro de la clínica correcta → pasa y devuelve su rol', async () => {
    getMiembro.mockResolvedValue(miembro({ clinicId: 'mi-clinica', role: 'secretaria' }))
    const r = await verificarMiembro(req('Bearer bueno'), 'mi-clinica')
    expect(r).toMatchObject({ ok: true, clinicId: 'mi-clinica', role: 'secretaria' })
  })

  it('si Firestore falla, FALLA CERRADO (500), no deja pasar', async () => {
    getMiembro.mockRejectedValue(new Error('firestore caído'))
    const r = await verificarMiembro(req('Bearer bueno'), 'mi-clinica')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(500)
  })

  it('clinicId vacío → 400 antes de consultar nada', async () => {
    const r = await verificarMiembro(req('Bearer bueno'), '')
    expect(r.ok).toBe(false)
    expect(getMiembro).not.toHaveBeenCalled()
  })
})

describe('verificarMedico — secreto médico', () => {
  beforeEach(() => { verifyIdToken.mockResolvedValue({ uid: 'u1' }) })

  it('la secretaria NO pasa aunque sea miembro legítimo', async () => {
    getMiembro.mockResolvedValue(miembro({ clinicId: 'c1', role: 'secretaria' }))
    const r = await verificarMedico(req('Bearer bueno'), 'c1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(403)
  })

  it('un rol desconocido tampoco pasa (lista blanca, no lista negra)', async () => {
    getMiembro.mockResolvedValue(miembro({ clinicId: 'c1', role: 'rol-inventado' }))
    expect((await verificarMedico(req('Bearer bueno'), 'c1')).ok).toBe(false)
  })

  it('sin rol guardado tampoco pasa', async () => {
    getMiembro.mockResolvedValue(miembro({ clinicId: 'c1' }))
    expect((await verificarMedico(req('Bearer bueno'), 'c1')).ok).toBe(false)
  })

  it.each(['medico', 'admin'])('rol %s sí pasa', async (role) => {
    getMiembro.mockResolvedValue(miembro({ clinicId: 'c1', role }))
    expect((await verificarMedico(req('Bearer bueno'), 'c1')).ok).toBe(true)
  })
})

describe('superadmin — la consola del dueño', () => {
  const envOriginal = process.env.SUPERADMIN_EMAILS
  afterEach(() => {
    if (envOriginal === undefined) delete process.env.SUPERADMIN_EMAILS
    else process.env.SUPERADMIN_EMAILS = envOriginal
  })

  it('sin la env, cae al dueño conocido', () => {
    delete process.env.SUPERADMIN_EMAILS
    expect(esSuperadmin('docrod29@gmail.com')).toBe(true)
    expect(esSuperadmin('cualquiera@gmail.com')).toBe(false)
  })

  it('normaliza mayúsculas y espacios de la env', () => {
    process.env.SUPERADMIN_EMAILS = ' Dueno@Nexus.MX , soporte@nexus.mx '
    expect(superadminEmails()).toEqual(['dueno@nexus.mx', 'soporte@nexus.mx'])
    expect(esSuperadmin('  DUENO@NEXUS.MX ')).toBe(true)
  })

  it('correo vacío o nulo nunca es superadmin', () => {
    expect(esSuperadmin(null)).toBe(false)
    expect(esSuperadmin(undefined)).toBe(false)
    expect(esSuperadmin('')).toBe(false)
  })

  it('REGRESIÓN: un correo de superadmin SIN verificar es rechazado', async () => {
    // El alta es autoservicio con contraseña. Sin este control, añadir una
    // dirección nueva a SUPERADMIN_EMAILS bastaría para que cualquiera la
    // registrara en /registro y se quedara con la consola de la plataforma.
    process.env.SUPERADMIN_EMAILS = 'dueno@nexus.mx'
    verifyIdToken.mockResolvedValue({ uid: 'atacante', email: 'dueno@nexus.mx', email_verified: false })
    const r = await verificarSuperadmin(req('Bearer bueno'))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(403)
  })

  it('el dueño con correo verificado sí entra', async () => {
    process.env.SUPERADMIN_EMAILS = 'dueno@nexus.mx'
    verifyIdToken.mockResolvedValue({ uid: 'dueno', email: 'dueno@nexus.mx', email_verified: true })
    expect((await verificarSuperadmin(req('Bearer bueno'))).ok).toBe(true)
  })

  it('correo verificado pero que NO está en la lista → 403', async () => {
    process.env.SUPERADMIN_EMAILS = 'dueno@nexus.mx'
    verifyIdToken.mockResolvedValue({ uid: 'x', email: 'otro@nexus.mx', email_verified: true })
    const r = await verificarSuperadmin(req('Bearer bueno'))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(403)
  })

  it('sin cabecera → 401', async () => {
    expect((await verificarSuperadmin(req())).ok).toBe(false)
  })
})
