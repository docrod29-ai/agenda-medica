/**
 * GOLDEN — UN CONSULTORIO SIN HORARIO NO TUMBA LA AGENDA.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `getDaySchedule` leía `config.horario[dia]` sin comprobar que `horario`
 * existiera. Un documento de configuración sin ese campo —un consultorio recién
 * abierto que aún no ha declarado su horario— hacía lanzar
 * `TypeError: Cannot read properties of undefined (reading 'miercoles')`.
 *
 * Y esa llamada vive en `POST /api/appointments` **fuera de todo `try`**: la
 * excepción salía como **500 con el cuerpo VACÍO**. Ese vacío es lo peor del
 * defecto: la pantalla enseña el mensaje del servidor y, al no haber ninguno,
 * cae en su frase de reserva —«No se pudo mover la cita»—, un no sin motivo.
 *
 * El alcance no era el arrastre: era TODA alta y TODA reprogramación por el
 * panel. Un consultorio sin horario no podía crear ni mover una sola cita, y lo
 * único que veía era un error sin causa.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Arrastrando una cita en el arnés visual con emulador, y mirando la RESPUESTA
 * de la petición en vez del código: 500, cuerpo vacío. El consultorio sintético
 * del arnés no siembra `horario`, que es justo el caso que nadie prueba.
 *
 * La regla de la que sale: «el dato tiene que LLEGAR» — mirar del otro lado de
 * la frontera, hoy, y no dar por entregado lo que sólo se ha leído.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. Un dato que falta devuelve `null`; no lanza. Sin horario declarado no hay
 *    día de servicio que afirmar, y `null` ya tiene camino en cada llamador.
 * 2. Un no SIEMPRE trae su motivo. «No hay horario configurado» y «ese día no
 *    se da servicio» son cosas distintas y se dicen distinto: la primera manda
 *    a la pantalla que lo arregla; la segunda, a otro día.
 *
 * ── LA SEGUNDA VUELTA: EL TRAMO ENTERO, NO SÓLO ESTA EXCEPCIÓN ──────────────
 *
 * Arreglar `getDaySchedule` cierra la excepción que se midió. No cierra la
 * FORMA del defecto: el tramo que valida día, horario, descansos y bloqueos
 * seguía fuera de todo `try`, así que la siguiente excepción desconocida
 * volvería a salir como 500 sin cuerpo. Ahora va dentro de un `try` que
 * responde 500 **con motivo** y deja rastro con `safeLog`.
 *
 * El `catch` no responde 409 a propósito: un 409 afirmaría que se comprobó el
 * horario y la cita no cabía, y eso sería mentira — no se pudo comprobar.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · La pantalla: que el mensaje del servidor se pinte lo comprueba el arnés
 *   `arrastrar-no-abre-la-cita`, en un navegador.
 * · No opina sobre qué horario debería tener un consultorio nuevo. Ausencia de
 *   dato no es dato de ausencia: aquí sólo se dice que falta, no se rellena.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TiendaEnMemoria, adminDbSobre } from './_harness/firestore-admin-en-memoria'
import { getDaySchedule } from '@/lib/availability'
import type { ClinicConfig } from '@/types'

const CLINICA = 'clinica-sin-horario'
// 2026-09-16 es MIÉRCOLES — el día del error medido.
const MIERCOLES = '2026-09-16'

const tienda = vi.hoisted(() => ({ actual: null as unknown }))
vi.mock('@/lib/firebase-admin', () => ({
  get adminDb() { return (tienda.actual as { db: unknown }).db },
}))
vi.mock('@/lib/auth-server', () => ({
  verificarMiembro: async (_req: unknown, clinicId: string) => ({
    ok: true, uid: `u-${clinicId}-medico`, email: 'medico@sintetico.test', role: 'medico',
  }),
}))
vi.mock('@/lib/calendario/ocupado-servidor', () => ({
  ocupadoEnGoogle: async () => ({ bloqueos: [], consultado: false, fallo: false }),
}))
vi.mock('@/lib/whatsapp-send', () => ({ sendWhatsApp: async () => ({ ok: true }) }))
vi.mock('@/lib/whatsapp/avisar-consultorio', () => ({
  avisarAlConsultorio: async () => undefined,
  telefonoDelConsultorio: () => '',
}))
vi.mock('@/lib/rate-limit', () => ({ limitarOResponder: async () => null }))

let store: TiendaEnMemoria

async function altaPanel(cuerpo: Record<string, unknown>) {
  const { POST } = await import('@/app/api/appointments/route')
  return POST(new Request('http://localhost/api/appointments', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
  }) as never)
}

const cita = (hora: string) => ({
  pacienteId: 'pac-1',
  pacienteNombre: 'Paciente Sintetico',
  pacienteTelefono: '5550000000',
  fechaHora: `${MIERCOLES} ${hora}`,
  duracion: 30,
  tipo: 'seguimiento',
  estado: 'confirmada',
  origen: 'consultorio',
  medicoNombre: 'Dr. Sintetico',
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-10T15:00:00Z'))
  store = new TiendaEnMemoria()
  tienda.actual = { db: adminDbSobre(store) }
  store.poner(`clinics/${CLINICA}`, { status: 'active' })
})

describe('El motor no lanza cuando falta el horario', () => {
  it('una configuración SIN `horario` devuelve null en vez de reventar', () => {
    const sinHorario = { zonaHoraria: 'America/Mexico_City', diasFestivos: [] } as unknown as ClinicConfig
    expect(() => getDaySchedule(MIERCOLES, sinHorario)).not.toThrow()
    expect(getDaySchedule(MIERCOLES, sinHorario)).toBeNull()
  })

  it('ni con `horario` vacío, ni sin configuración ninguna', () => {
    const vacio = { horario: {}, diasFestivos: [] } as unknown as ClinicConfig
    expect(getDaySchedule(MIERCOLES, vacio)).toBeNull()
    expect(getDaySchedule(MIERCOLES, undefined as unknown as ClinicConfig)).toBeNull()
  })

  it('y con horario SÍ sigue devolviendo el día — el arreglo no apaga la función', () => {
    // Sin este caso, `return null` siempre pasaría los dos anteriores.
    const conHorario = {
      diasFestivos: [],
      horario: { miercoles: { activo: true, inicio: '10:00', fin: '19:00' } },
    } as unknown as ClinicConfig
    expect(getDaySchedule(MIERCOLES, conHorario)).toMatchObject({ inicio: '10:00', fin: '19:00' })
  })
})

describe('Una excepción desconocida tampoco sale muda', () => {
  it('si falla la lectura de los bloqueos, la respuesta trae motivo y NO se escribe la cita', async () => {
    // Se rompe una lectura que está DENTRO del tramo validador y que nada tiene
    // que ver con el horario: es el caso «la próxima excepción, la que no
    // conocemos». Sin el `try` esto sale como 500 con el cuerpo vacío.
    store.poner(`clinics/${CLINICA}/config/main`, {
      zonaHoraria: 'America/Mexico_City', diasFestivos: [], duraciones: {},
      horario: { miercoles: { activo: true, inicio: '10:00', fin: '19:00' } },
    })
    const db = (tienda.actual as { db: { collection: (r: string) => unknown } }).db
    const original = db.collection
    db.collection = (ruta: string) => {
      const col = original.call(db, ruta) as { get?: () => unknown }
      if (ruta === 'clinics') {
        const doc = (col as unknown as { doc: (id: string) => unknown }).doc.bind(col)
        ;(col as unknown as { doc: (id: string) => unknown }).doc = (id: string) => {
          const d = doc(id) as { collection: (n: string) => unknown }
          const sub = d.collection.bind(d)
          d.collection = (n: string) => {
            const c = sub(n) as { get: () => Promise<unknown> }
            if (n === 'time_blocks') return { ...c, get: async () => { throw new Error('lectura caída') } }
            return c
          }
          return d
        }
      }
      return col
    }
    try {
      const res = await altaPanel({ clinicId: CLINICA, appointment: cita('11:00') })
      expect(res.status).toBe(500)
      const j = await res.json() as { error?: string }
      // Lo que fallaba: `j` era `{}` y la pantalla caía en su frase de reserva.
      expect(j.error).toBeTruthy()
      expect(j.error).toMatch(/horario/i)
      // Y no se agenda a ciegas: no haber podido validar no es haber validado.
      expect(store.cuantos(`clinics/${CLINICA}/appointments`)).toBe(0)
    } finally {
      db.collection = original
    }
  })
})

describe('La ruta contesta con un motivo, no con un 500 vacío', () => {
  it('sin horario configurado: 409 y una frase que dice qué arreglar', async () => {
    store.poner(`clinics/${CLINICA}/config/main`, {
      zonaHoraria: 'America/Mexico_City', diasFestivos: [], duraciones: {},
    })
    const res = await altaPanel({ clinicId: CLINICA, appointment: cita('11:00') })
    // Lo que fallaba: esto era 500, y `res.json()` un cuerpo vacío.
    expect(res.status).toBe(409)
    const j = await res.json() as { error?: string }
    expect(j.error).toMatch(/horario/i)
    expect(j.error).toMatch(/Configuración/i)
    expect(store.cuantos(`clinics/${CLINICA}/appointments`)).toBe(0)
  })

  it('AL REVÉS — con horario declarado y el día cerrado, el motivo es OTRO', async () => {
    // Si las dos situaciones dieran la misma frase, el mensaje no informaría de
    // nada: el consultorio nuevo seguiría probando días uno por uno.
    store.poner(`clinics/${CLINICA}/config/main`, {
      zonaHoraria: 'America/Mexico_City', diasFestivos: [], duraciones: {},
      horario: { miercoles: { activo: false, inicio: '10:00', fin: '19:00' } },
    })
    const res = await altaPanel({ clinicId: CLINICA, appointment: cita('11:00') })
    expect(res.status).toBe(409)
    const j = await res.json() as { error?: string }
    expect(j.error).toMatch(/no da servicio/i)
    expect(j.error).not.toMatch(/Configuración/i)
  })

  it('y con el día abierto la cita entra: el guardián no cierra la puerta buena', async () => {
    store.poner(`clinics/${CLINICA}/config/main`, {
      zonaHoraria: 'America/Mexico_City', diasFestivos: [], duraciones: {},
      horario: { miercoles: { activo: true, inicio: '10:00', fin: '19:00' } },
    })
    const res = await altaPanel({ clinicId: CLINICA, appointment: cita('11:00') })
    expect(res.status).toBeLessThan(300)
    expect(store.cuantos(`clinics/${CLINICA}/appointments`)).toBe(1)
  })
})
