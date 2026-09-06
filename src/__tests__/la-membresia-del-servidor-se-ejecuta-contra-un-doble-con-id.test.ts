import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * LA MEMBRESÍA DEL SERVIDOR SE EJECUTA CONTRA UN DOBLE QUE DISTINGUE IDS — REG-527.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `verificarMiembro` (`auth-server.ts`) es la frontera: decodifica el token,
 * lee `clinic_members/{uid}` y compara `clinicId`. `verificarCapacidad`
 * (`authz/verificar.ts`) le añade el rol. Las 99 rutas cuelgan de ahí.
 *
 * Y **ninguna prueba las ejecutaba**. Las pruebas de rutas SUSTITUYEN
 * `verificarCapacidad` por un doble que siempre dice «ok», y los dobles de
 * Firestore de esas mismas pruebas devuelven el documento sin mirar qué id se
 * pidió (`doc: () => …`). El guardián estático (`authz-analisis-estatico`)
 * comprueba que la ruta LLAME a la guardia; nadie comprobaba que la guardia
 * hiciera lo que dice. Un `.doc(clinicId)` donde va `.doc(uid)`, o una
 * comparación de `clinicId` que desapareciera, habrían pasado la suite entera.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Auditoría test-the-test del 5-sep-2026 («el doble ignora el id del
 * documento»). El archivo que nombraba no existe; verificado hoy que lo que
 * existe es peor: no hay prueba que ejecute la membresía. Ésta es la primera.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * El doble de Firestore de esta prueba es un MAPA por id: `clinic_members`
 * tiene tres documentos y `doc(id)` devuelve exactamente el que se pidió, o
 * `exists: false`. Así, leer el documento equivocado no puede pasar por
 * verde. El token se resuelve por un mapa igual (token → uid).
 *
 * ── PROBADO AL REVÉS ─────────────────────────────────────────────────────────
 *
 * Tres mutantes sobre `auth-server.ts`, cada uno pone rojo al menos un caso:
 * leer `.doc(clinicId)` en vez de `.doc(u.uid)` (casos 3 y 4); quitar la
 * comparación `data?.clinicId !== clinicId` (caso 4); devolver `ok` sin mirar
 * `snap.exists` (caso 3). Se hicieron con `sed` sobre una copia y se
 * revirtieron.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * - No ejecuta `verificarModuloIA` ni el paywall: tienen su propia lógica de
 *   plan y su asimetría fail-open, y merecen su prueba aparte.
 * - No cubre las 99 rutas: sigue siendo trabajo del guardián estático que
 *   cada una llame a la guardia. Aquí se prueba la guardia.
 * - No prueba Firebase Auth: `verifyIdToken` es un doble. Que un token
 *   falsificado no pase lo garantiza Firebase, no este archivo.
 */

/** Un mapa por id: la diferencia entre este doble y los de las pruebas de rutas. */
const MIEMBROS: Record<string, { clinicId: string; role: string }> = {
  'uid-medico': { clinicId: 'clinica-A', role: 'medico' },
  'uid-recepcion': { clinicId: 'clinica-A', role: 'secretaria' },
  'uid-otra': { clinicId: 'clinica-B', role: 'admin' },
}
const TOKENS: Record<string, { uid: string; email: string; segundo?: boolean }> = {
  'tok-medico': { uid: 'uid-medico', email: 'dr@ejemplo.test' },
  'tok-recepcion': { uid: 'uid-recepcion', email: 'rec@ejemplo.test' },
  'tok-otra': { uid: 'uid-otra', email: 'otra@ejemplo.test', segundo: true },
  'tok-sin-membresia': { uid: 'uid-nadie', email: 'nadie@ejemplo.test' },
}

const idsPedidos: string[] = []

vi.mock('@/lib/firebase-admin', () => ({
  default: {
    auth: () => ({
      verifyIdToken: async (token: string) => {
        const t = TOKENS[token]
        if (!t) throw new Error('token inválido')
        return { uid: t.uid, email: t.email, firebase: t.segundo ? { sign_in_second_factor: 'totp' } : {} }
      },
    }),
  },
  adminDb: {
    collection: (nombre: string) => {
      if (nombre !== 'clinic_members') throw new Error(`colección inesperada: ${nombre}`)
      return {
        doc: (id: string) => ({
          get: async () => {
            idsPedidos.push(id)
            const m = MIEMBROS[id]
            return { exists: !!m, data: () => m }
          },
        }),
      }
    },
  },
}))

import { verificarMiembro, verificarUsuario } from '@/lib/auth-server'
import { verificarCapacidad } from '@/lib/authz/verificar'

const req = (token?: string) =>
  new NextRequest('https://ejemplo.test/api/x', { headers: token ? { authorization: `Bearer ${token}` } : {} })

const statusDe = (a: { ok: boolean; response?: Response }) => (a.ok ? 200 : a.response!.status)

beforeEach(() => { idsPedidos.length = 0 })

describe('REG-527 · verificarMiembro, ejecutado', () => {
  it('1 · sin cabecera o con token que Firebase rechaza → 401, y no se lee Firestore', async () => {
    expect(statusDe(await verificarMiembro(req(), 'clinica-A'))).toBe(401)
    expect(statusDe(await verificarMiembro(req('tok-falso'), 'clinica-A'))).toBe(401)
    expect(idsPedidos).toEqual([])
  })

  it('2 · sin clinicId → 400 antes de tocar la base', async () => {
    expect(statusDe(await verificarMiembro(req('tok-medico'), ''))).toBe(400)
    expect(idsPedidos).toEqual([])
  })

  it('3 · EL CASO: se lee clinic_members/{uid del token}, y sin documento → 403', async () => {
    const a = await verificarMiembro(req('tok-sin-membresia'), 'clinica-A')
    expect(statusDe(a)).toBe(403)
    // El id que se pidió es el uid, no la clínica: esto es lo que un doble sin id no puede ver.
    expect(idsPedidos).toEqual(['uid-nadie'])
  })

  it('4 · EL CASO: miembro de OTRA clínica → 403 aunque el documento exista', async () => {
    const a = await verificarMiembro(req('tok-otra'), 'clinica-A')
    expect(statusDe(a)).toBe(403)
    expect(idsPedidos).toEqual(['uid-otra'])
  })

  it('5 · miembro de la clínica → ok con uid, clinicId, rol y segundo factor del token', async () => {
    const a = await verificarMiembro(req('tok-otra'), 'clinica-B')
    expect(a).toMatchObject({ ok: true, uid: 'uid-otra', clinicId: 'clinica-B', role: 'admin', segundoFactor: true })
    const b = await verificarMiembro(req('tok-medico'), 'clinica-A')
    expect(b).toMatchObject({ ok: true, uid: 'uid-medico', role: 'medico', segundoFactor: false })
  })

  it('6 · verificarUsuario sólo pide sesión: no lee membresía', async () => {
    expect(statusDe(await verificarUsuario(req('tok-sin-membresia')))).toBe(200)
    expect(statusDe(await verificarUsuario(req()))).toBe(401)
    expect(idsPedidos).toEqual([])
  })
})

describe('REG-527 · verificarCapacidad, ejecutado sobre la misma membresía', () => {
  it('7 · el rol decide: secretaria no escribe clínica, médico sí', async () => {
    expect(statusDe(await verificarCapacidad(req('tok-recepcion'), 'clinica-A', 'clinico.escribir'))).toBe(403)
    expect(statusDe(await verificarCapacidad(req('tok-medico'), 'clinica-A', 'clinico.escribir'))).toBe(200)
  })

  it('8 · la membresía va ANTES que la capacidad: un admin de otra clínica no entra por ser admin', async () => {
    expect(statusDe(await verificarCapacidad(req('tok-otra'), 'clinica-A', 'administrar'))).toBe(403)
    expect(statusDe(await verificarCapacidad(req(), 'clinica-A', 'clinico.leer'))).toBe(401)
  })
})
