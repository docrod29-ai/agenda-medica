/**
 * GOLDEN — LA BAJA DE UN PACIENTE LEÍA LA AGENDA ENTERA, Y SE TRAGABA EL FALLO.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `deletePatientExpediente` busca las citas HUÉRFANAS del paciente —las que se
 * agendaron sin `pacienteId` y sólo llevan su nombre y su teléfono— y para eso
 * hacía `getDocs` sobre la colección **entera** de citas del consultorio. Con
 * años de agenda son decenas de miles de documentos leídos en el navegador para
 * dar de baja a una persona.
 *
 * Y el `catch` lo tragaba: `catch { /* ignore *\/ }`.
 *
 * ── POR QUÉ ESE `catch` ERA LO GRAVE ────────────────────────────────────────
 *
 * Una cita huérfana lleva `pacienteNombre` y `pacienteTelefono` **dentro**. Si
 * el barrido falla y nadie se entera, el expediente se borra, la pantalla dice
 * que se borró… y **los datos personales del paciente siguen en la base**, en
 * documentos que ya no cuelgan de nadie.
 *
 * Esta función es la que usa la **cancelación ARCO**. Es decir: el camino por el
 * que un paciente ejerce su derecho a que le borren sus datos podía dejarlos
 * puestos y devolver «hecho».
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Inventario de escala del tablero de Ausculta (WS-03), al cerrar las lecturas
 * sin cota. La lectura se buscaba por cara; el `catch` apareció al leerla.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * El emparejamiento es **normalizado** (minúsculas, teléfono sin formato) y
 * Firestore no puede filtrar por eso, así que alguien concluyó «hay que leerlo
 * todo» y, al ver que eso podía fallar, lo envolvió en un `try` para que no
 * tumbara el borrado. Las dos decisiones son razonables por separado y juntas
 * producen un borrado que miente.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * El barrido se pagina y tiene techo — y cuando **no se pudo revisar entero, no
 * se borra nada**. Un borrado incompleto que se cree completo es peor que uno
 * que se niega: el que se niega se reintenta, el que miente se archiva.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · **El emparejamiento sigue siendo por barrido, no por índice.** Un índice
 *   sobre el nombre normalizado lo haría exacto y barato; no existe y no se
 *   puede crear desde este repositorio (`docs/ops/INDICES-DE-FIRESTORE.md`).
 * · **No prueba Firestore ni sus reglas.**
 * · **No cubre otras colecciones que puedan llevar PHI del paciente.** Aquí se
 *   miran notas y citas, que es lo que esta función borraba; si mañana otra
 *   colección guarda el nombre del paciente, este golden no la ve.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'

const h = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  contador: { lecturas: 0, getDocs: 0, getDoc: 0 },
  fallos: { collectionGroup: false, lectura: false, lecturaEn: '' },
}))

vi.mock('@/lib/firebase', () => ({
  db: { doble: true },
  auth: { currentUser: { uid: 'medico-sintetico' } },
  storage: null,
}))
vi.mock('@/lib/expediente/audit-log', () => ({ logAudit: async () => {} }))
vi.mock('firebase/firestore', async () => {
  const { firestoreClienteSobre } = await import('./_harness/firestore-cliente-en-memoria')
  return firestoreClienteSobre(h)
})

import {
  deletePatientExpediente, PAGINA_BARRIDO_CITAS, TECHO_BARRIDO_CITAS,
} from '@/lib/expediente/firestore'

const CLINICA = 'clinica-sintetica-1'
const PACIENTE = 'pac-sintetico-1'
const QUIEN = { nombre: 'Rosalía Sintética Prueba', telefono: '55 1234 5678' }

/** Citas de relleno, de otras personas. */
function sembrarAgenda(n: number) {
  for (let i = 0; i < n; i++) {
    h.docs.set(`clinics/${CLINICA}/appointments/a${String(i).padStart(6, '0')}`, {
      pacienteId: `otro-${i}`, pacienteNombre: `Otra Persona ${i}`,
      pacienteTelefono: `55${String(90000000 + i)}`, fechaHora: '2026-01-01 09:00',
    })
  }
}

/** Una cita huérfana: sin `pacienteId`, sólo con el nombre escrito distinto. */
function sembrarHuerfana(id: string) {
  h.docs.set(`clinics/${CLINICA}/appointments/${id}`, {
    pacienteId: '',
    pacienteNombre: '  ROSALÍA SINTÉTICA PRUEBA ',
    pacienteTelefono: '(55) 1234-5678',
    fechaHora: '2026-02-02 10:00',
  })
}

const reset = () => { h.contador.lecturas = 0; h.contador.getDocs = 0; h.contador.getDoc = 0 }

beforeEach(() => {
  h.docs.clear()
  h.fallos.lectura = false
  h.fallos.lecturaEn = ''
  reset()
  h.docs.set(`clinics/${CLINICA}/patients/${PACIENTE}`, { nombre: QUIEN.nombre, telefono: QUIEN.telefono })
})

describe('LA CITA HUÉRFANA SE ENCUENTRA Y SE BORRA', () => {
  it('aunque el nombre esté escrito con otras mayúsculas y el teléfono con otro formato', async () => {
    sembrarAgenda(20)
    sembrarHuerfana('huerfana-1')
    const r = await deletePatientExpediente(CLINICA, PACIENTE, QUIEN)
    expect(r.ok).toBe(true)
    expect(r.borradas?.citas).toBe(1)
    expect(
      h.docs.has(`clinics/${CLINICA}/appointments/huerfana-1`),
      'una cita con el nombre y el teléfono del paciente que sobrevive a su baja es PHI que nadie borró',
    ).toBe(false)
  })

  it('y no se lleva por delante las citas de otras personas', async () => {
    sembrarAgenda(20)
    sembrarHuerfana('huerfana-1')
    await deletePatientExpediente(CLINICA, PACIENTE, QUIEN)
    expect(h.docs.has(`clinics/${CLINICA}/appointments/a000005`)).toBe(true)
  })

  it('la encuentra aunque esté MUY al fondo de la agenda: el barrido pagina', async () => {
    // Más allá de una sola página: sin paginación real, esta cita se quedaba.
    sembrarAgenda(PAGINA_BARRIDO_CITAS * 2 + 40)
    sembrarHuerfana('zzz-al-fondo')
    const r = await deletePatientExpediente(CLINICA, PACIENTE, QUIEN)
    expect(r.ok).toBe(true)
    expect(h.docs.has(`clinics/${CLINICA}/appointments/zzz-al-fondo`)).toBe(false)
  })

  it('la cita ligada por `pacienteId` se borra sin depender del barrido', async () => {
    h.docs.set(`clinics/${CLINICA}/appointments/ligada`, {
      pacienteId: PACIENTE, pacienteNombre: QUIEN.nombre, fechaHora: '2026-03-03 11:00',
    })
    const r = await deletePatientExpediente(CLINICA, PACIENTE)
    expect(r.ok).toBe(true)
    expect(h.docs.has(`clinics/${CLINICA}/appointments/ligada`)).toBe(false)
  })
})

describe('SI NO SE PUDO REVISAR LA AGENDA, NO SE BORRA NADA', () => {
  it('y si tampoco se pudo comprobar la firma, tampoco: la guarda NOM-004 falla cerrada', async () => {
    // No saber si hay una nota firmada NO es saber que no la hay, y del lado
    // equivocado se borra un registro legal que no puede eliminarse.
    h.fallos.lecturaEn = 'notas'
    const r = await deletePatientExpediente(CLINICA, PACIENTE, QUIEN)
    expect(r.ok).toBe(false)
    expect(String(r.motivo)).toContain('NOM-004')
    expect(h.docs.has(`clinics/${CLINICA}/patients/${PACIENTE}`)).toBe(true)
  })

  it('EL CASO: un fallo de lectura detiene el borrado en vez de dejar PHI puesta', async () => {
    sembrarAgenda(10)
    sembrarHuerfana('huerfana-1')
    // Se cae SÓLO la agenda: si se cayera todo, la prueba mediría la guarda
    // NOM-004 de más arriba y no el barrido, que es lo que se quiere ver.
    h.fallos.lecturaEn = 'appointments'
    const r = await deletePatientExpediente(CLINICA, PACIENTE, QUIEN)
    expect(r.ok).toBe(false)
    expect(String(r.motivo)).toContain('No se borró nada')
    expect(
      h.docs.has(`clinics/${CLINICA}/patients/${PACIENTE}`),
      'con el barrido caído, borrar el expediente dejaría citas con su nombre y su teléfono',
    ).toBe(true)
  })

  it('y el motivo dice qué pasó, no un «error» genérico', async () => {
    h.fallos.lecturaEn = 'appointments'
    const r = await deletePatientExpediente(CLINICA, PACIENTE, QUIEN)
    expect(String(r.motivo)).toContain('agenda completa')
    expect(String(r.motivo)).toContain('su nombre y su teléfono')
  })
})

describe('EL COSTE DEPENDE DE LA PÁGINA, NO DEL TAMAÑO DE LA AGENDA', () => {
  it('el barrido se hace por páginas del tamaño declarado', async () => {
    sembrarAgenda(PAGINA_BARRIDO_CITAS * 3)
    reset()
    await deletePatientExpediente(CLINICA, PACIENTE, QUIEN)
    // 1 consulta por pacienteId + las páginas del barrido. Ni una sola lectura
    // de la colección completa de una vez.
    expect(h.contador.getDocs).toBeGreaterThanOrEqual(3)
    expect(TECHO_BARRIDO_CITAS).toBeGreaterThan(PAGINA_BARRIDO_CITAS)
  })

  it('el techo existe y es un número, no una idea', () => {
    expect(Number.isFinite(TECHO_BARRIDO_CITAS)).toBe(true)
    expect(TECHO_BARRIDO_CITAS).toBeGreaterThan(0)
  })
})

describe('LO QUE FALTA POR UN ÍNDICE DEJA DE VIVIR EN COMENTARIOS SUELTOS', () => {
  const indices = JSON.parse(readFileSync('firestore.indexes.json', 'utf8')) as {
    indexes: { collectionGroup: string; fields: { fieldPath: string }[] }[]
  }

  it('el archivo de índices existe y declara los que el código está esperando', () => {
    const grupos = indices.indexes.map(i => i.collectionGroup)
    // Cada uno tiene un módulo que hoy está peor por no tenerlo.
    expect(grupos).toContain('tareas_clinicas')   // worklist: 200 arbitrarias (P1-14)
    expect(grupos).toContain('waitlist')          // el hueco al menos prioritario
    expect(grupos).toContain('appointments')      // listener de citas sin cota
  })

  it('cada índice declara al menos dos campos: uno solo no es un índice compuesto', () => {
    for (const i of indices.indexes) {
      expect(i.fields.length, `${i.collectionGroup} declara un índice de un solo campo`).toBeGreaterThanOrEqual(2)
    }
  })

  it('el documento dice que NO se despliegan con `vercel --prod`', () => {
    const doc = readFileSync('docs/ops/INDICES-DE-FIRESTORE.md', 'utf8')
    expect(doc).toContain('firebase deploy --only firestore:indexes')
    // Y la regla que hace peligroso improvisar: una consulta sin su índice no
    // devuelve vacío, falla entera.
    expect(doc).toContain('FAILED_PRECONDITION')
  })

  it('y el hook de citas YA acota, con el orden que el índice sirve (REG-417)', () => {
    /**
     * Este caso decía lo contrario hasta REG-417: comprobaba que el hook
     * EXPLICARA por qué no acotaba. Ahora el índice está desplegado y lo que hay
     * que vigilar es que la consulta pida las dos cosas —orden y cota— y en el
     * sentido correcto: `desc`, porque el llamador busca la cita de HOY y `asc`
     * traería las más viejas y la perdería siempre.
     */
    const src = readFileSync('src/hooks/useAppointments.ts', 'utf8')
    const codigo = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '')
    expect(codigo).toContain("orderBy('fechaHora', 'desc')")
    expect(codigo).toContain('limit(TOPE_CITAS_PACIENTE)')
    // Y el recorte se declara: un tope que nadie ve se lee como «ésas eran todas».
    expect(codigo).toContain('truncada')
  })
})
