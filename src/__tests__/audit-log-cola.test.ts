/**
 * GUARDIÁN: la bitácora no se queda con huecos silenciosos.
 *
 * `logAudit` se tragaba el error por diseño —«nunca debe romper la operación
 * clínica», que es correcto— pero eso convertía un 4xx o una red caída en una
 * bitácora incompleta que nadie detecta. Ya pasó: `cobro_exento` se registraba
 * desde la pantalla, el servidor lo rechazaba, y en la base no había ni una
 * cortesía.
 *
 * Lo que se protege aquí es la distinción que hace útil la cola: un fallo
 * TRANSITORIO se reintenta; uno PERMANENTE se descarta y se grita. Encolar un
 * asiento que nunca va a entrar sería llenar el disco para siempre.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const almacen = new Map<string, string>()

vi.mock('@/lib/auth-client', () => ({
  fetchAutenticado: vi.fn(),
}))

beforeEach(() => {
  almacen.clear()
  ;(globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => almacen.get(k) ?? null,
    setItem: (k: string, v: string) => { almacen.set(k, v) },
    removeItem: (k: string) => { almacen.delete(k) },
    clear: () => almacen.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage
  vi.resetModules()
})
afterEach(() => { vi.clearAllMocks() })

async function cargar(respuestas: { ok: boolean; status: number }[]) {
  const { fetchAutenticado } = await import('@/lib/auth-client')
  const mock = fetchAutenticado as unknown as ReturnType<typeof vi.fn>
  mock.mockReset()
  for (const r of respuestas) mock.mockResolvedValueOnce(r)
  mock.mockResolvedValue({ ok: true, status: 200 })   // por defecto, éxito
  return import('@/lib/expediente/audit-log')
}

const asiento = { evento: 'nota_firmada' as const, clinicId: 'c1', patientId: 'p1' }

describe('logAudit · cola de reintento', () => {
  it('un 5xx se ENCOLA para reintentarlo', async () => {
    const { logAudit, asientosPendientes } = await cargar([{ ok: false, status: 503 }, { ok: false, status: 503 }])
    await logAudit(asiento)
    expect(asientosPendientes()).toBe(1)
  })

  it('un 4xx NO se encola: reintentarlo no lo arregla', async () => {
    // Es el caso de `cobro_exento`: el evento no estaba en la lista blanca del
    // servidor. Encolarlo habría llenado el disco con algo que nunca entra.
    const { logAudit, asientosPendientes } = await cargar([{ ok: false, status: 400 }])
    await logAudit(asiento)
    expect(asientosPendientes()).toBe(0)
  })

  it('un envío correcto no deja nada pendiente', async () => {
    const { logAudit, asientosPendientes } = await cargar([{ ok: true, status: 200 }])
    await logAudit(asiento)
    expect(asientosPendientes()).toBe(0)
  })

  it('lo encolado se vacía en la SIGUIENTE escritura, cuando la red vuelve', async () => {
    const mod = await cargar([{ ok: false, status: 503 }, { ok: false, status: 503 }])
    await mod.logAudit(asiento)
    expect(mod.asientosPendientes()).toBe(1)

    // Segunda llamada: ahora todo responde 200 (el mock por defecto).
    await mod.logAudit(asiento)
    await new Promise(r => setTimeout(r, 0))   // el drenado va sin esperar
    expect(mod.asientosPendientes()).toBe(0)
  })

  it('sin clinicId no se intenta nada — no hay bitácora sin consultorio', async () => {
    const { logAudit, asientosPendientes } = await cargar([])
    await logAudit({ evento: 'nota_firmada', clinicId: '' })
    expect(asientosPendientes()).toBe(0)
  })
})
