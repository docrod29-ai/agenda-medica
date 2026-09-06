import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TiendaEnMemoria, adminDbSobre } from './_harness/firestore-admin-en-memoria'

/**
 * DOS CONSULTORIOS NO RECLAMAN EL MISMO CANAL A LA VEZ — REG-533.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `reclamarCanal` (REG-3xx, «un canal de WhatsApp no se le puede quitar a otro
 * consultorio») leía el índice, decidía y escribía en tres pasos sueltos:
 *
 *     const previo = await ref.get()
 *     if (previo.exists && dueño !== clinicId) return rechazo
 *     await ref.set({ ...datos, clinicId }, { merge: true })
 *
 * Dos consultorios reclamando el mismo identificador en la misma ventana
 * leían los dos «libre» y el último `set` ganaba. Es el mismo secuestro que
 * el módulo existe para impedir —los mensajes de los pacientes de A acaban en
 * la bandeja de B—, sólo que ahora hace falta una carrera para provocarlo.
 * La prueba de entonces era de fuente y no podía ver una carrera.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Auditoría de seguridad del 5-sep-2026 («check-then-write sin transacción»).
 * Verificado por el orquestador leyendo el módulo.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Leer y escribir dentro de `runTransaction`: la lectura queda fijada y
 * Firestore reejecuta al que llegó tarde, que entonces ve al dueño. El arnés
 * en memoria reproduce exactamente eso (versión por documento, reintento por
 * conflicto), y por eso aquí la carrera se puede PROVOCAR: entre la lectura y
 * el commit del primero, otro consultorio se lleva el canal.
 *
 * Un documento sin `clinicId` sigue contando como libre a propósito: lo deja
 * el alta de 360dialog antes de que el callback diga de quién es.
 *
 * ── PROBADO AL REVÉS ─────────────────────────────────────────────────────────
 *
 * Con el módulo como estaba (tres pasos sueltos), el caso 3 es rojo: el
 * segundo consultorio gana la carrera y el índice cambia de dueño.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * - No ejecuta las tres rutas que llaman a `reclamarCanal`: eso lo vigila
 *   `canal-whatsapp-no-se-secuestra` por fuente. Aquí se prueba el módulo.
 * - No es Firestore de verdad: el arnés imita su contrato de transacciones
 *   (lectura fijada, reintento por conflicto), no su motor.
 */

let tienda: TiendaEnMemoria
/** Cuando está puesto, sustituye al arnés: para simular que Firestore no responde. */
let dbRota: ReturnType<typeof adminDbSobre> | null = null
vi.mock('@/lib/firebase-admin', () => ({
  get adminDb() { return dbRota ?? adminDbSobre(tienda) },
}))

import { reclamarCanal } from '@/lib/whatsapp/reclamar-canal'

const RUTA = 'whatsapp_channels/canal-1'

beforeEach(() => { tienda = new TiendaEnMemoria(); dbRota = null })

describe('REG-533 · reclamarCanal, en transacción', () => {
  it('1 · un canal libre se reclama y queda a nombre del consultorio', async () => {
    expect(await reclamarCanal('canal-1', 'clinica-A', { provider: 'meta' })).toEqual({ ok: true })
    expect(tienda.obtener(RUTA)).toMatchObject({ clinicId: 'clinica-A', provider: 'meta' })
  })

  it('2 · ocupado por OTRO consultorio se rechaza y dice de quién es; el mismo consultorio reconecta y conserva lo previo', async () => {
    tienda.poner(RUTA, { clinicId: 'clinica-A', channelId: 'ch-360' })
    const r = await reclamarCanal('canal-1', 'clinica-B', { provider: 'meta' })
    expect(r.ok).toBe(false)
    expect(r.dueñoPrevio).toBe('clinica-A')
    expect(tienda.obtener(RUTA)).toMatchObject({ clinicId: 'clinica-A' })
    expect(await reclamarCanal('canal-1', 'clinica-A', { provider: 'meta' })).toEqual({ ok: true })
    expect(tienda.obtener(RUTA)).toMatchObject({ clinicId: 'clinica-A', channelId: 'ch-360', provider: 'meta' })
  })

  it('3 · EL CASO: la carrera. Entre la lectura de A y su commit, B se lleva el canal → A NO lo sobrescribe', async () => {
    tienda.intercepcion.alCommitear = async (intento) => {
      // Sólo en el primer intento de A: B escribe fuera de la transacción, como
      // haría otra instancia de la API que ganó la carrera.
      if (intento === 0 && !tienda.obtener(RUTA)) tienda.poner(RUTA, { clinicId: 'clinica-B' })
    }
    const r = await reclamarCanal('canal-1', 'clinica-A', { provider: 'meta' })
    // Antes del arreglo: `ok: true` y el índice a nombre de A.
    expect(r.ok).toBe(false)
    expect(r.dueñoPrevio).toBe('clinica-B')
    expect(tienda.obtener(RUTA)).toMatchObject({ clinicId: 'clinica-B' })
    expect(tienda.vecesReejecutada, 'la transacción tuvo que reejecutarse al ver el conflicto').toBe(1)
  })

  it('4 · un documento sin clinicId cuenta como libre (el alta de 360dialog lo deja así)', async () => {
    tienda.poner(RUTA, { channelId: 'ch-360' })
    expect(await reclamarCanal('canal-1', 'clinica-A', { clientId: 'cli' })).toEqual({ ok: true })
    expect(tienda.obtener(RUTA)).toMatchObject({ clinicId: 'clinica-A', channelId: 'ch-360', clientId: 'cli' })
  })

  it('5 · si la transacción no puede correr, NO se reclama (fail-closed) y no se escribe nada', async () => {
    dbRota = { ...adminDbSobre(tienda), runTransaction: async () => { throw new Error('sin red') } }
    const r = await reclamarCanal('canal-1', 'clinica-A', { provider: 'meta' })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/No se pudo comprobar/)
    expect(tienda.obtener(RUTA)).toBeUndefined()
  })

  it('6 · sin identificador o sin consultorio no toca la base', async () => {
    expect((await reclamarCanal('', 'clinica-A', {})).ok).toBe(false)
    expect((await reclamarCanal('canal-1', '', {})).ok).toBe(false)
    expect(tienda.cuantos('whatsapp_channels')).toBe(0)
  })
})
