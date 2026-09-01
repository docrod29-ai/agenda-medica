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
/**
 * REG-384: la consola del dueño pregunta si hay segundo factor enrolado cuando
 * la sesión no lo usó. Por omisión, sin factores — el caso «el dueño entra» no
 * es el caso del segundo factor, y mezclarlos haría ilegible el rojo del día que
 * uno de los dos se rompa.
 */
const getUser = vi.fn(async () => ({ multiFactor: { enrolledFactors: [] } }))
const getMiembro = vi.fn()

/**
 * `getClinica` es el SEGUNDO doc que lee `verificarModuloIA` (clinics/{id}); se
 * separa de `getMiembro` para poder simular por un lado el entitlement de plan y por
 * otro el fallo de Firestore, que tienen semánticas de error distintas.
 */
const getClinica = vi.fn()

vi.mock('@/lib/firebase-admin', () => ({
  default: { auth: () => ({ verifyIdToken, getUser }) },
  adminDb: {
    collection: (nombre: string) => ({
      doc: () => ({ get: nombre === 'clinics' ? getClinica : getMiembro }),
    }),
  },
}))

import { verificarUsuario, verificarMiembro, verificarMedico } from '@/lib/auth-server'
import { verificarCapacidad, verificarModuloYCapacidad, exigeCapacidad } from '@/lib/authz/verificar'
import { esSuperadmin, superadminEmails, verificarSuperadmin } from '@/lib/superadmin'

/** NextRequest mínimo: a estos helpers solo les importan las cabeceras. */
function req(authorization?: string) {
  return { headers: new Headers(authorization ? { authorization } : {}) } as never
}

const miembro = (data: Record<string, unknown> | null) => ({ exists: data !== null, data: () => data })

beforeEach(() => {
  verifyIdToken.mockReset()
  getUser.mockReset()
  getUser.mockResolvedValue({ multiFactor: { enrolledFactors: [] } })
  getMiembro.mockReset()
  getClinica.mockReset()
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

describe('permisosPorRol — mínimo privilegio ante datos ausentes', () => {
  it('REGRESIÓN: rol nulo NO concede permisos de admin', async () => {
    const { permisosPorRol } = await import('@/lib/permissions')
    // Es el valor que tiene `role` mientras ClinicContext carga, o si falla.
    expect(permisosPorRol(null).verExpediente).toBe(false)
    expect(permisosPorRol(undefined).verExpediente).toBe(false)
  })

  it('un rol desconocido tampoco escala', async () => {
    const { permisosPorRol } = await import('@/lib/permissions')
    expect(permisosPorRol('director-general').verExpediente).toBe(false)
  })

  it('el médico sí ve el expediente', async () => {
    const { permisosPorRol } = await import('@/lib/permissions')
    expect(permisosPorRol('medico').verExpediente).toBe(true)
  })
})

/**
 * ── E0-07 · autorización por CAPACIDAD ───────────────────────────────────────
 *
 * `verificarCapacidad` sustituye a `verificarMedico`/`verificarMiembro` en las
 * rutas. Lo que se prueba aquí es que la migración NO cambió un solo código de
 * estado (401/400/403/500 en los mismos casos que antes) y que el paso nuevo —la
 * capacidad— falla CERRADO.
 */
describe('E0-07 · verificarCapacidad', () => {
  it('sin cabecera Authorization → 401, sin tocar Firestore', async () => {
    const r = await verificarCapacidad(req(), 'c1', 'administrar')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(401)
    expect(getMiembro).not.toHaveBeenCalled()
  })

  it('clinicId vacío → 400 antes de consultar nada', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1' })
    const r = await verificarCapacidad(req('Bearer bueno'), '', 'administrar')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(400)
    expect(getMiembro).not.toHaveBeenCalled()
  })

  it('AISLAMIENTO: rol `admin` pero de OTRA clínica → 403 (el caso que más engaña)', async () => {
    // Tiene la capacidad de sobra; lo que NO tiene es pertenencia a esta clínica.
    verifyIdToken.mockResolvedValue({ uid: 'u1' })
    getMiembro.mockResolvedValue(miembro({ clinicId: 'clinica-ajena', role: 'admin' }))
    const r = await verificarCapacidad(req('Bearer bueno'), 'mi-clinica', 'administrar')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(403)
  })

  it('miembro legítimo SIN la capacidad → 403 y el mensaje NOMBRA la capacidad', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1' })
    getMiembro.mockResolvedValue(miembro({ clinicId: 'c1', role: 'secretaria' }))
    const r = await verificarCapacidad(req('Bearer bueno'), 'c1', 'clinico.escribir')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.response.status).toBe(403)
      const cuerpo = await r.response.json()
      expect(cuerpo.error).toContain('clinico.escribir')
      // El ROL no se filtra en la respuesta: decir «tu rol (laboratorio) no puede»
      // revela la composición del equipo a quien sondee la API.
      expect(cuerpo.error).not.toContain('secretaria')
    }
  })

  it('documento de membresía SIN campo `role` → 403 (mínimo privilegio)', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1' })
    getMiembro.mockResolvedValue(miembro({ clinicId: 'c1' }))
    const r = await verificarCapacidad(req('Bearer bueno'), 'c1', 'auditoria.registrar')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(403)
  })

  it('rol desconocido tampoco pasa (lista blanca, no lista negra)', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1' })
    getMiembro.mockResolvedValue(miembro({ clinicId: 'c1', role: 'director-general' }))
    expect((await verificarCapacidad(req('Bearer bueno'), 'c1', 'auditoria.registrar')).ok).toBe(false)
  })

  it('si Firestore revienta, FALLA CERRADO (500), no deja pasar', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1' })
    getMiembro.mockRejectedValue(new Error('firestore caído'))
    const r = await verificarCapacidad(req('Bearer bueno'), 'c1', 'auditoria.registrar')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(500)
  })

  it('rol que SÍ tiene la capacidad pasa y conserva uid/clinicId/role', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'a@b.com' })
    getMiembro.mockResolvedValue(miembro({ clinicId: 'c1', role: 'enfermeria' }))
    const r = await verificarCapacidad(req('Bearer bueno'), 'c1', 'medicamento.administrar')
    expect(r).toMatchObject({ ok: true, uid: 'u1', clinicId: 'c1', role: 'enfermeria' })
  })

  it('EQUIVALENCIA con el gate viejo: `clinico.escribir` pasa a los mismos roles que verificarMedico', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1' })
    for (const role of ['admin', 'medico', 'secretaria', 'enfermeria', 'farmacia', 'laboratorio']) {
      getMiembro.mockResolvedValue(miembro({ clinicId: 'c1', role }))
      const viejo = (await verificarMedico(req('Bearer bueno'), 'c1')).ok
      getMiembro.mockResolvedValue(miembro({ clinicId: 'c1', role }))
      const nuevo = (await verificarCapacidad(req('Bearer bueno'), 'c1', 'clinico.escribir')).ok
      expect(nuevo, `rol ${role}`).toBe(viejo)
    }
  })
})

describe('E0-07 · verificarModuloYCapacidad — entitlement de plan Y rol', () => {
  const clinica = (data: Record<string, unknown>) => ({ exists: true, data: () => data })

  beforeEach(() => { verifyIdToken.mockResolvedValue({ uid: 'u1' }) })

  it('sin consultorio configurado → 403', async () => {
    getMiembro.mockResolvedValue(miembro({}))
    const r = await verificarModuloYCapacidad(req('Bearer bueno'), 'expediente', 'clinico.escribir')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(403)
  })

  it('plan sin el módulo → 403 (el rol no se llega a mirar)', async () => {
    getMiembro.mockResolvedValue(miembro({ clinicId: 'c1', role: 'medico' }))
    getClinica.mockResolvedValue(clinica({ plan: 'agenda', modulos: [] }))
    const r = await verificarModuloYCapacidad(req('Bearer bueno'), 'expediente', 'clinico.escribir')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(403)
  })

  it('EL HUECO QUE CIERRA: plan correcto pero rol sin la capacidad → 403', async () => {
    // Antes, `verificarModuloIA` solo miraba el PLAN: un rol `laboratorio` podía
    // hacer POST a /api/expediente/transcribir y recibir una nota clínica redactada,
    // PHI que firestore.rules le niega, por la puerta del Admin SDK.
    getMiembro.mockResolvedValue(miembro({ clinicId: 'c1', role: 'laboratorio' }))
    getClinica.mockResolvedValue(clinica({ plan: 'premium', paseLibre: true }))
    const r = await verificarModuloYCapacidad(req('Bearer bueno'), 'expediente', 'clinico.escribir')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(403)
  })

  it('plan correcto y rol con la capacidad → pasa', async () => {
    getMiembro.mockResolvedValue(miembro({ clinicId: 'c1', role: 'medico' }))
    getClinica.mockResolvedValue(clinica({ plan: 'premium', paseLibre: true }))
    expect((await verificarModuloYCapacidad(req('Bearer bueno'), 'expediente', 'clinico.escribir')).ok).toBe(true)
  })

  it('REGRESIÓN: módulo OPT-IN con Firestore caído → 503 fail-CLOSED, nunca 403 por rol', async () => {
    getMiembro.mockRejectedValue(new Error('firestore caído'))
    const r = await verificarModuloYCapacidad(req('Bearer bueno'), 'uci', 'clinico.escribir')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(503)
  })

  it('REGRESIÓN CRÍTICA: módulo de consulta con Firestore caído sigue siendo fail-OPEN', async () => {
    // Evaluar la capacidad en el camino fail-OPEN convertiría un fallo transitorio
    // de lectura en un 403 para TODOS (ahí no hay `role` que leer): la IA se caería
    // para el consultorio entero. Es el modo de fallo más fácil de introducir sin
    // notarlo, así que se fija por test.
    getMiembro.mockRejectedValue(new Error('firestore caído'))
    const r = await verificarModuloYCapacidad(req('Bearer bueno'), 'expediente', 'clinico.escribir')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.clinicId).toBeUndefined()
  })
})

describe('E0-07 · exigeCapacidad — capacidad sobre un acceso ya verificado', () => {
  it('devuelve null cuando el rol la tiene', () => {
    const acc = { ok: true as const, uid: 'u1', clinicId: 'c1', role: 'enfermeria' }
    expect(exigeCapacidad(acc, 'medicamento.administrar')).toBeNull()
  })

  it('devuelve un 403 cuando no la tiene', () => {
    const acc = { ok: true as const, uid: 'u1', clinicId: 'c1', role: 'enfermeria' }
    expect(exigeCapacidad(acc, 'prescribir')?.status).toBe(403)
  })

  it('rol ausente en el acceso → 403 (no se asume nada)', () => {
    const acc = { ok: true as const, uid: 'u1', clinicId: 'c1' }
    expect(exigeCapacidad(acc, 'auditoria.registrar')?.status).toBe(403)
  })
})
