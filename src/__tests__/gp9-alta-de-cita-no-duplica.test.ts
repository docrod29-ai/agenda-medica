/**
 * GOLDEN PATH 9 — la ruta de alta de cita, ejercitada de verdad.
 *
 * ── QUÉ FALLABA Y CÓMO SE DESCUBRIÓ ──────────────────────────────────────────
 *
 * `POST /api/appointments` acepta un `reagendarId` que pone el CLIENTE y hace
 * `tx.set(ref, {...}, { merge: true })` sobre él. En Firestore, un `set` con
 * merge sobre un documento que NO EXISTE lo CREA. Así que «mover» una cita que
 * ya se había borrado no devolvía un error: FABRICABA una cita nueva con la
 * identidad que eligiera quien llamaba.
 *
 * Se encontró recorriendo las fronteras de escritura de GP9 preguntando por cada
 * una «¿qué pasa si esto llega dos veces?». Aquí la respuesta era peor que un
 * duplicado: dos reintentos de la misma edición, con el documento borrado en
 * medio, dejaban dos citas — y la segunda con un id inventado por el cliente.
 *
 * ── POR QUÉ ESTE ARCHIVO NO LEE EL FUENTE ────────────────────────────────────
 *
 * `cita-reintento-no-duplica.test.ts` (el golden hermano) afirma sobre el TEXTO
 * de la ruta: fija la arquitectura de la reparación y el ORDEN de sus ramas, que
 * es lo que un refactor rompe sin darse cuenta. Lo que no puede decir es cuántos
 * documentos quedaron. Éste ejecuta el handler real contra una tienda con la
 * semántica transaccional de Firestore —lectura que fija versión, reejecución
 * del perdedor— y CUENTA.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * Las reglas de seguridad de Firestore (van contra el emulador), la resolución
 * de horarios reales (aquí el consultorio no tiene `config`, así que esa rama se
 * salta a propósito: lo que se prueba es la identidad del recurso, no la agenda)
 * y la vía del portal público, que es otro handler.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TiendaEnMemoria, adminDbSobre } from './_harness/firestore-admin-en-memoria'

const CLINICA = 'clinica-alfa'
const VECINO = 'clinica-beta'

const tienda = vi.hoisted(() => ({ actual: null as unknown }))

vi.mock('@/lib/firebase-admin', () => ({
  get adminDb() { return (tienda.actual as { db: unknown }).db },
}))

/** Miembro verificado: la autorización tiene su propia suite; aquí no es el sujeto. */
vi.mock('@/lib/auth-server', () => ({
  verificarMiembro: async (_req: unknown, clinicId: string) => ({
    ok: true, uid: `u-${clinicId}-medico`, email: 'medico@sintetico.test', role: 'medico',
  }),
}))

let store: TiendaEnMemoria

function peticion(cuerpo: unknown): Request {
  return new Request('http://localhost/api/appointments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  })
}

const CITA = {
  pacienteId: 'pac-1',
  pacienteNombre: 'Paciente Sintetico',
  pacienteTelefono: '5550000000',
  fechaHora: '2026-08-24 10:00',
  duracion: 30,
  tipo: 'consulta',
  estado: 'confirmada',
  origen: 'consultorio',
  medicoNombre: 'Dr. Sintetico',
  medicoId: 'doc-1',
}

async function postear(cuerpo: unknown) {
  const { POST } = await import('@/app/api/appointments/route')
  return POST(peticion(cuerpo) as never)
}

const citasDe = (clinicId: string) => store.listar(`clinics/${clinicId}/appointments`)

beforeEach(() => {
  store = new TiendaEnMemoria()
  tienda.actual = { db: adminDbSobre(store) }
})

describe('GP9 · alta de cita — dos solicitudes idénticas, una sola cita', () => {
  it('el reintento devuelve el mismo id y NO crea un segundo documento', async () => {
    const cuerpo = { clinicId: CLINICA, appointment: CITA }
    const a = await (await postear(cuerpo)).json()
    const b = await (await postear(cuerpo)).json()

    expect(a.id).toBeTruthy()
    // El segundo NO es un 409 («ese horario ya está ocupado») contra su propia
    // cita, y tampoco es una cita nueva: es la misma.
    expect(b.id).toBe(a.id)
    expect(b.idempotent).toBe(true)
    expect(citasDe(CLINICA)).toHaveLength(1)
  })

  it('el reintento tampoco duplica la entrada de bitácora', async () => {
    const cuerpo = { clinicId: CLINICA, appointment: CITA }
    await postear(cuerpo)
    await postear(cuerpo)
    // Una acción lógica deja UN asiento. Dos dirían que la agenda se tocó dos
    // veces, y en una discusión sobre quién movió qué eso es ruido que confunde.
    expect(store.cuantos(`clinics/${CLINICA}/audit_log`)).toBe(1)
  })

  it('dos peticiones CONCURRENTES sobre el mismo hueco dejan exactamente una cita', async () => {
    const cuerpo = { clinicId: CLINICA, appointment: CITA }
    const [r1, r2] = await Promise.all([postear(cuerpo), postear(cuerpo)])
    const [a, b] = [await r1.json(), await r2.json()]

    expect(citasDe(CLINICA)).toHaveLength(1)
    // La que pierde la carrera reejecuta, ve la cita de la ganadora y converge a
    // su id — ni 409 contra sí misma, ni un segundo documento.
    expect(a.id).toBe(b.id)
    // Y hubo carrera de verdad: sin reejecución esto no habría probado nada.
    expect(store.vecesReejecutada).toBeGreaterThan(0)
  })

  it('una cita DISTINTA en el mismo hueco sigue chocando (el conflicto no se debilitó)', async () => {
    await postear({ clinicId: CLINICA, appointment: CITA })
    const otra = await postear({
      clinicId: CLINICA,
      appointment: { ...CITA, pacienteId: 'pac-2', pacienteNombre: 'Otro Paciente' },
    })
    expect(otra.status).toBe(409)
    expect(citasDe(CLINICA)).toHaveLength(1)
  })

  it('una cita cancelada NO se resucita como si fuera el mismo intento', async () => {
    const { id } = await (await postear({ clinicId: CLINICA, appointment: CITA })).json()
    store.poner(`clinics/${CLINICA}/appointments/${id}`, { estado: 'cancelada' })
    // Volver a agendar lo mismo tras cancelar es una intención NUEVA: tiene que
    // nacer una cita, no revivir la muerta.
    const otra = await (await postear({ clinicId: CLINICA, appointment: CITA })).json()
    expect(otra.id).not.toBe(id)
    expect(otra.idempotent).toBe(false)
    expect(citasDe(CLINICA)).toHaveLength(2)
  })
})

describe('GP9 · reagendar — el id del cliente no puede FABRICAR una cita', () => {
  it('mover una cita que ya no existe devuelve 404 y no escribe nada', async () => {
    const respuesta = await postear({
      clinicId: CLINICA,
      appointment: { ...CITA, fechaHora: '2026-08-24 11:00' },
      reagendarId: 'id-inventado-por-el-cliente',
    })
    expect(respuesta.status).toBe(404)
    // Antes, `tx.set(..., {merge:true})` sobre un documento ausente lo CREABA:
    // el cliente elegía el id de una cita nueva llamándola «reagendar».
    expect(citasDe(CLINICA)).toHaveLength(0)
    expect(store.obtener(`clinics/${CLINICA}/appointments/id-inventado-por-el-cliente`)).toBeUndefined()
  })

  it('dos reintentos de la misma edición dejan UNA cita movida, no dos', async () => {
    const { id } = await (await postear({ clinicId: CLINICA, appointment: CITA })).json()
    const edicion = {
      clinicId: CLINICA,
      appointment: { ...CITA, fechaHora: '2026-08-24 12:00' },
      reagendarId: id,
    }
    const a = await (await postear(edicion)).json()
    const b = await (await postear(edicion)).json()

    expect(a.id).toBe(id)
    expect(b.id).toBe(id)
    expect(b.idempotent).toBe(true)   // el segundo no vuelve a escribir
    expect(citasDe(CLINICA)).toHaveLength(1)
    expect(store.obtener(`clinics/${CLINICA}/appointments/${id}`)?.fechaHora).toBe('2026-08-24 12:00')
    // Un solo asiento de `cita_reagendada` además del alta.
    const eventos = store.listar(`clinics/${CLINICA}/audit_log`).map(d => d.datos.evento)
    expect(eventos.filter(e => e === 'cita_reagendada')).toHaveLength(1)
  })

  it('NEGATIVO ENTRE CONSULTORIOS: un id del vecino ni se lee, ni se mueve, ni se copia', async () => {
    // La cita vive en el consultorio de al lado, con un id perfectamente válido.
    store.poner(`clinics/${VECINO}/appointments/cita-del-vecino`, {
      ...CITA, clinicId: VECINO, estado: 'confirmada',
    })

    const respuesta = await postear({
      clinicId: CLINICA,                       // la sesión es de ESTE consultorio
      appointment: { ...CITA, fechaHora: '2026-08-24 13:00' },
      reagendarId: 'cita-del-vecino',          // …y el id, del otro
    })

    // Bajo la ruta de este consultorio ese id no existe: no hay nada que mover.
    expect(respuesta.status).toBe(404)
    // La cita del vecino sigue intacta, en su sitio y en su hora.
    expect(store.obtener(`clinics/${VECINO}/appointments/cita-del-vecino`)?.fechaHora).toBe('2026-08-24 10:00')
    // Y no se creó una copia con ese id aquí: una clave ajena no puede traerse
    // una entidad de otro inquilino ni siquiera vacía.
    expect(citasDe(CLINICA)).toHaveLength(0)
  })
})
