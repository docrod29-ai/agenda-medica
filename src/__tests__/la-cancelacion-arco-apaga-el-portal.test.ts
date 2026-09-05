import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { decidirVigencia } from '@/lib/portal/vigencia-del-enlace'

/**
 * LA CANCELACIÓN ARCO APAGA EL PORTAL DEL PACIENTE — REG-519 · D-034.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `arco/cancelar`, por el camino de BLOQUEO (hay notas firmadas: conservación
 * mínima obligatoria), escribía `arcoBloqueo` en el expediente y daba de baja
 * el WhatsApp. Los únicos lectores de `arcoBloqueo` son la reactivación y las
 * campañas. El magic-link del portal **no lo miraba**: el paciente que ejerció
 * su derecho de cancelación conservaba un enlace vivo que seguía leyendo su
 * agenda, sus documentos y sus recetas hasta caducar — y ese enlace viaja por
 * WhatsApp y se reenvía.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Sospecha S2 del equipo rojo de API del 5-sep-2026, verificada en la ruta. Se
 * llevó al dueño como decisión (D-C del readiness) porque revocar el portal es
 * un acto sobre el paciente, no un arreglo técnico. Decidió que sí.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * El bloqueo sube `portalTokenVersion` en el MISMO `set` que escribe
 * `arcoBloqueo`: no hay ventana en la que el expediente esté bloqueado y el
 * enlace siga sirviendo. `decidirVigencia` (REG-331) hace el resto: un token
 * con versión menor que la del expediente es `revocado`, 401 definitivo.
 * En la supresión no hace falta: el expediente deja de existir, y eso ya
 * cuenta como revocado.
 *
 * ── PROBADO AL REVÉS ─────────────────────────────────────────────────────────
 *
 * Con la ruta como estaba, el `set` no llevaba `portalTokenVersion` y el token
 * acuñado antes de la cancelación seguía `vigente`. Caso 1 rojo.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * - No ejecuta el portal después: comprueba que la versión sube y que la
 *   decisión pura de vigencia la lee como revocación. El portal ya está
 *   probado contra esa decisión (REG-331, REG-512).
 * - No cubre el bloqueo ARCO escrito por otro camino (hoy no hay otro).
 */

vi.mock('@/lib/authz/verificar', () => ({
  verificarCapacidad: async (_req: unknown, clinicId: string) =>
    ({ ok: true, uid: 'uid-admin', email: 'admin@ejemplo.test', role: 'admin', clinicId }),
}))
vi.mock('@/lib/whatsapp/consent', () => ({ registrarBaja: vi.fn(async () => undefined) }))

/** Expediente ficticio con versión de portal previa. */
let paciente: Record<string, unknown> = {}
const escrituras: Array<{ datos: Record<string, unknown>; opciones: unknown }> = []
const notas: Record<string, unknown>[] = [{ estado: 'firmada' }]

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: (top: string) => {
      if (top !== 'clinics') throw new Error(`colección superior inesperada: ${top}`)
      return {
        doc: () => ({
          collection: (sub: string) => {
            if (sub === 'patients') {
              return {
                doc: () => ({
                  get: async () => ({ exists: true, data: () => paciente }),
                  set: async (datos: Record<string, unknown>, opciones: unknown) => {
                    escrituras.push({ datos, opciones })
                    paciente = { ...paciente, ...datos }
                  },
                  collection: (s2: string) => {
                    if (s2 === 'notas') return { get: async () => ({ docs: notas.map(n => ({ data: () => n })), size: notas.length }) }
                    throw new Error(`subcolección de paciente inesperada: ${s2}`)
                  },
                }),
              }
            }
            if (sub === 'arco_requests') return { doc: () => ({ set: async () => undefined }) }
            if (sub === 'audit_log') return { add: async () => ({ id: 'a1' }) }
            throw new Error(`subcolección inesperada: ${sub}`)
          },
        }),
      }
    },
  },
}))

import { POST } from '@/app/api/arco/cancelar/route'

function cancelar(extra: Record<string, unknown> = {}) {
  return POST(new NextRequest('https://ejemplo.test/api/arco/cancelar', {
    method: 'POST',
    body: JSON.stringify({ clinicId: 'clinica-ficticia', patientId: 'pac-1', solicitudId: 'sol-1', motivo: 'lo pidió', identidadVerificada: true, ...extra }),
    headers: { 'content-type': 'application/json' },
  }))
}

beforeEach(() => {
  paciente = { nombre: 'Paciente Ficticio', telefono: '5215550000000', portalTokenVersion: 2 }
  escrituras.length = 0
})

describe('REG-519 · el bloqueo ARCO revoca el portal en el mismo acto', () => {
  it('1 · EL CASO: el `set` del bloqueo sube portalTokenVersion, y el token de antes queda revocado', async () => {
    const r = await cancelar()
    expect(r.status).toBe(200)
    expect((await r.json()).camino).toBe('bloqueo')
    const bloqueo = escrituras.find(e => 'arcoBloqueo' in e.datos)
    expect(bloqueo, 'no se escribió el bloqueo').toBeDefined()
    // Antes del arreglo: `portalTokenVersion` no estaba en este `set`.
    expect(bloqueo!.datos.portalTokenVersion).toBe(3)
    expect(bloqueo!.opciones).toEqual({ merge: true })
    // El token acuñado con la versión 2, contra el expediente que ahora dice 3:
    expect(decidirVigencia(2, { ok: true, existe: true, version: 3 })).toBe('revocado')
  })

  it('2 · en el mismo `set`, no en otro: no hay ventana con bloqueo y enlace vivo', async () => {
    await cancelar()
    const conBloqueo = escrituras.filter(e => 'arcoBloqueo' in e.datos)
    expect(conBloqueo).toHaveLength(1)
    expect(Object.keys(conBloqueo[0].datos).sort()).toEqual(['arcoBloqueo', 'portalTokenVersion'])
  })

  it('3 · un expediente sin versión previa arranca en 1: un token viejo con versión 0 cae', async () => {
    delete paciente.portalTokenVersion
    await cancelar()
    const bloqueo = escrituras.find(e => 'arcoBloqueo' in e.datos)!
    expect(bloqueo.datos.portalTokenVersion).toBe(1)
    expect(decidirVigencia(0, { ok: true, existe: true, version: 1 })).toBe('revocado')
  })

  it('4 · el ensayo (`simular`) no escribe nada, tampoco la versión', async () => {
    const r = await cancelar({ simular: true })
    expect((await r.json()).simulado).toBe(true)
    expect(escrituras).toHaveLength(0)
  })

  it('5 · sin acreditar al titular no se ejecuta, y la versión no se toca', async () => {
    const r = await cancelar({ identidadVerificada: false })
    expect(r.status).toBe(400)
    expect(escrituras).toHaveLength(0)
    expect(paciente.portalTokenVersion).toBe(2)
  })
})
