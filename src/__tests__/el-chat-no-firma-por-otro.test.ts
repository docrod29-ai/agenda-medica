/**
 * ZL-012 · Panel de Lujo (Z-legal) — en el chat del equipo cualquier miembro
 * podía firmar sus mensajes con el nombre y el rol de otro («Dra. X · medico»):
 * la regla sólo fijaba `senderId`.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * `chat.ts` escribía `senderName` y `senderRol` en el documento y la pantalla
 * los pintaba tal cual. `firestore.rules` (chat create) sólo comprobaba
 * `request.auth.uid == senderId`. El equipo rojo fue más lejos: el NOMBRE ni
 * siquiera necesitaba consola — `members/{uid}.displayName` es texto libre.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 * El mensaje lleva SÓLO texto, autor y hora (`documentoDeMensaje`, y la regla
 * lo congela con hasOnly). Nombre y rol se RESUELVEN al leer desde
 * `clinic_members/{uid}` (rol real, sólo lo escribe el admin) y `members/{uid}`
 * (apodo); lo que el documento diga de sí mismo no se usa. Puro donde se puede.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * La ejecución de la regla (emulador). Que el apodo pueda parecerse al nombre
 * del médico: el rol que se pinta al lado sale de la membresía, y eso es lo que
 * distingue.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

vi.mock('@/lib/firebase', () => ({ db: {} }))

/**
 * `firebase/firestore` es ESM y su espacio de nombres NO es configurable: un
 * `vi.spyOn` sobre `onSnapshot` lanza «Cannot redefine property». El doble se
 * declara con `vi.mock`, que es lo que hace el resto de la suite.
 *
 * `entregar` es la palanca: cada caso decide qué snapshot recibe el suscriptor.
 */
let entregar: (cb: (s: unknown) => void) => void = () => {}
vi.mock('firebase/firestore', () => ({
  collection: () => ({}),
  query: () => ({}),
  orderBy: () => ({}),
  limit: () => ({}),
  addDoc: async () => ({ id: 'nuevo' }),
  serverTimestamp: () => ({ __ts: true }),
  onSnapshot: (_q: unknown, cb: (s: unknown) => void) => { entregar(cb); return () => {} },
}))

import { documentoDeMensaje, suscribirMensajes, type IdentidadDeRemitente } from '@/lib/chat'

describe('ZL-012 · el mensaje sólo lleva texto, autor y hora', () => {
  it('documentoDeMensaje no admite nombre ni rol y recorta/valida el texto', () => {
    expect(documentoDeMensaje('  hola  ', 'u1')).toEqual({ text: 'hola', senderId: 'u1' })
    expect(() => documentoDeMensaje('   ', 'u1')).toThrow(/vacío/)
    expect(() => documentoDeMensaje('x'.repeat(2001), 'u1')).toThrow(/2000/)
  })

  it('enviarMensaje no escribe senderName/senderRol/senderEmail aunque se los pasen', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/lib/chat.ts'), 'utf8')
    const envia = src.slice(src.indexOf('export async function enviarMensaje'), src.indexOf('export interface IdentidadDeRemitente'))
    expect(envia).not.toMatch(/senderName:|senderRol:|senderEmail:/)
    expect(envia).toContain('documentoDeMensaje(texto, sender.uid)')
  })

  it('la regla congela la forma: text, senderId, createdAtTs', () => {
    const reglas = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8')
    const bloque = reglas.match(/match \/chat\/\{msgId\}\s*\{([\s\S]*?)\n\s{6}\}/)
    expect(bloque).not.toBeNull()
    expect(bloque![1]).toMatch(/keys\(\)\.hasOnly\(\['text', 'senderId', 'createdAtTs'\]\)/)
    expect(bloque![1]).toContain('request.auth.uid == request.resource.data.senderId')
  })
})

describe('ZL-012 · al leer, nombre y rol salen de la membresía, no del documento', () => {
  it('suscribirMensajes resuelve por uid con el resolvedor y descarta lo que el doc dice de sí mismo', async () => {
    // El snapshot entrega un mensaje que MIENTE sobre su remitente: dice llamarse
    // «Dra. X» y ser médico cuando su uid es el de la secretaria.
    entregar = cb => cb({
      forEach: (f: (d: { id: string; data: () => Record<string, unknown> }) => void) => {
        f({ id: 'm1', data: () => ({ text: 'hola', senderId: 'u-secretaria', senderName: 'Dra. X', senderRol: 'medico' }) })
      },
    })

    const resolver = vi.fn(async (_c: string, uid: string): Promise<IdentidadDeRemitente> =>
      uid === 'u-secretaria' ? { nombre: 'Asistente Sintética', rol: 'secretaria', email: 'a@ejemplo.mx' } : { nombre: '?', rol: '', email: '' })

    const recibido = await new Promise<{ senderName: string; senderRol: string }[]>(res => {
      suscribirMensajes('c1', msgs => res(msgs), 200, resolver)
    })
    expect(recibido).toHaveLength(1)
    expect(recibido[0].senderName).toBe('Asistente Sintética')
    expect(recibido[0].senderRol).toBe('secretaria')
    expect(resolver).toHaveBeenCalledWith('c1', 'u-secretaria')
  })
})
