/**
 * REP-036 · ASM-006 (AS-mensajeria) — el «SÍ» del paciente al recordatorio se
 * pierde si contesta más de 2 h después: el bot borra la sesión y le manda el
 * menú de bienvenida; la cita sigue sin confirmar.
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 * `src/app/api/whatsapp/webhook/route.ts:574-583`: si `session.lastMessageAt`
 * tiene más de 2 h → `clearSession` + `send(buildMenu)` + `saveSession(menu)` +
 * `return`. Ese bloque va 44 líneas ANTES del que atiende SÍ/NO (:618 `if
 * (estado === 'confirmando_cita' || …)`). El cron deja la sesión
 * `confirmando_cita` con `lastMessageAt: now` al mandar el recordatorio
 * (`cron/reminders/route.ts:334-350`), 23-26 h antes de la cita, y el texto dice
 * «Responde SÍ» sin plazo. Ventana útil real: 2 h.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor AS-mensajeria, hallazgo ASM-006 (`crudos/AS-mensajeria.json`). El
 * equipo rojo (`crudos/R-AS-mensajeria.json`) leyó el archivo alrededor de la
 * 574: sólo la baja (:521) y la urgencia (:550-567) van por encima de la
 * caducidad, y ésta hace `return`, así que no hay camino que salve la
 * respuesta. `bot-si-no-cancela.test.ts` sólo comprueba cadenas del código.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * La caducidad de 2 h se diseñó para conversaciones INICIADAS por el paciente
 * (agendar, cancelar). Los estados que esperan respuesta a un mensaje
 * PROACTIVO del consultorio (`confirmando_cita`, `confirmando_cancelacion`,
 * `esperando_lista`) heredaron el mismo reloj sin que nadie lo decidiera.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * el-dato-tiene-que-llegar: el «SÍ» se manda y no llega. patient-facing-ai §6
 * al revés: un aviso que se contesta y no surte efecto es peor que no avisar.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * COMPORTAMIENTO sobre `handleMessage` real (exportada) con el Admin SDK
 * doblado en memoria (`@/lib/firebase-admin`: get/set/update/delete/where/
 * limit), `sendWhatsApp` doblado (graba mensajes) y `registrarEntrante`
 * doblado. Sesión sintética `confirmando_cita` de hace 5 h, texto «Sí»: la
 * cita debe quedar `confirmada`. El control con sesión de hace 10 min prueba
 * que el doble y el camino funcionan.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * La respuesta que llega al teléfono personal de la asistente (flujo wa.me).
 * El «NO» tardío (misma rama, mismo defecto: no se cancela ni se ofrece el
 * hueco). Qué vigencia exacta deben tener esos estados: decisión del dueño.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { store, mensajes } = vi.hoisted(() => ({
  store: {} as Record<string, Record<string, unknown>>,
  mensajes: [] as { to: string; msg: string }[],
}))

vi.mock('@/lib/firebase-admin', () => {
  type Filtro = [string, string, unknown]
  let n = 0
  const snapshot = (p: string) => ({ id: p.split('/').pop(), exists: p in store, data: () => store[p], ref: docRef(p) })
  const docRef = (p: string): Record<string, unknown> => ({
    id: p.split('/').pop(), path: p,
    get: async () => snapshot(p),
    set: async (d: Record<string, unknown>, o?: { merge?: boolean }) => { store[p] = o?.merge ? { ...(store[p] ?? {}), ...d } : { ...d } },
    update: async (d: Record<string, unknown>) => { if (!(p in store)) throw new Error('NOT_FOUND'); store[p] = { ...store[p], ...d } },
    delete: async () => { delete store[p] },
    collection: (sub: string) => colRef(`${p}/${sub}`),
  })
  const colRef = (p: string, filtros: Filtro[] = [], lim?: number): Record<string, unknown> => ({
    path: p,
    doc: (id?: string) => docRef(`${p}/${id ?? `auto_${++n}`}`),
    add: async (d: Record<string, unknown>) => { const id = `auto_${++n}`; store[`${p}/${id}`] = { ...d }; return docRef(`${p}/${id}`) },
    where: (f: string, op: string, v: unknown) => colRef(p, [...filtros, [f, op, v]], lim),
    limit: (k: number) => colRef(p, filtros, k),
    orderBy: () => colRef(p, filtros, lim),
    get: async () => {
      let hijos = Object.keys(store)
        .filter(x => x.startsWith(`${p}/`) && !x.slice(p.length + 1).includes('/'))
        .filter(x => filtros.every(([f, op, v]) => {
          const val = store[x][f]
          if (op === '==') return val === v
          if (op === 'in') return (v as unknown[]).includes(val)
          if (op === '>=') return String(val) >= String(v)
          if (op === '<=') return String(val) <= String(v)
          if (op === '<') return String(val) < String(v)
          if (op === '>') return String(val) > String(v)
          return true
        }))
      if (lim != null) hijos = hijos.slice(0, lim)
      const docs = hijos.map(snapshot)
      return { empty: docs.length === 0, size: docs.length, docs, forEach: (fn: (s: unknown) => void) => docs.forEach(fn) }
    },
  })
  return {
    default: { firestore: { FieldValue: { increment: (k: number) => k, serverTimestamp: () => new Date().toISOString() } } },
    adminDb: { collection: (top: string) => colRef(top), runTransaction: async (fn: (t: unknown) => Promise<unknown>) => fn({}) },
    adminAuth: {},
  }
})
vi.mock('@/lib/whatsapp-send', () => ({
  sendWhatsApp: async (_c: string, to: string, msg: string) => { mensajes.push({ to, msg }); return { ok: true } },
}))
vi.mock('@/lib/whatsapp/contacts', () => ({ registrarEntrante: async () => undefined }))

import { handleMessage } from '@/app/api/whatsapp/webhook/route'

const FROM = '5215550101010'           // como lo manda Meta (52 1 + 10)
const CLAVE = '525550101010'           // claveSesion → normalizarTelefonoWa
const haceHoras = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()

function sembrar(lastMessageAt: string): void {
  for (const k of Object.keys(store)) delete store[k]
  mensajes.length = 0
  store['clinics/C/config/main'] = { nombreClinica: 'Consultorio Sintético', telefonoAdmin: '5550000000', nombreMedico: 'Dra. Prueba' }
  store['clinics/C/doctors/d1'] = { activo: true, nombre: 'Dra. Prueba' }
  store['clinics/C/appointments/A1'] = {
    estado: 'agendada', pacienteNombre: 'Paciente Sintético', pacienteTelefono: '5550101010',
    fechaHora: '2026-09-07T10:00', tipo: 'seguimiento',
  }
  store[`clinics/C/bot_sessions/${CLAVE}`] = {
    telefono: CLAVE, estado: 'confirmando_cita', datos: { citaId: 'A1' },
    createdAt: lastMessageAt, lastMessageAt,
  }
}

describe('REP-036 · el SÍ al recordatorio confirma la cita aunque llegue horas después', () => {
  beforeEach(() => { sembrar(haceHoras(5)) })

  it('control: con la sesión de hace 10 minutos, «Sí» confirma la cita (el doble y la rama funcionan)', async () => {
    sembrar(new Date(Date.now() - 10 * 60_000).toISOString())
    await handleMessage(FROM, 'Sí', 'C')
    expect(store['clinics/C/appointments/A1'].estado).toBe('confirmada')
    expect(mensajes.map(m => m.msg).join('\n')).toMatch(/confirmada/i)
  })

  it('HOY FALLA: con la sesión de hace 5 horas (recordatorio de la mañana), «Sí» debe confirmar la cita', async () => {
    await handleMessage(FROM, 'Sí', 'C')
    const cita = store['clinics/C/appointments/A1']
    expect(
      cita.estado,
      `la cita sigue «${cita.estado}»; el bot contestó: ${JSON.stringify(mensajes.map(m => m.msg.slice(0, 60)))}`,
    ).toBe('confirmada')
  })

  it('HOY FALLA: al SÍ tardío no se le contesta con el menú de bienvenida', async () => {
    await handleMessage(FROM, 'Sí', 'C')
    const respuestas = mensajes.filter(m => m.to === FROM).map(m => m.msg)
    expect(respuestas.some(m => /1️⃣|Agendar cita/i.test(m)), `se contestó el menú: ${JSON.stringify(respuestas)}`).toBe(false)
  })
})
