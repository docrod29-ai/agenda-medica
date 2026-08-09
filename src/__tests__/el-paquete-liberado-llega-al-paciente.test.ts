/**
 * EL PAQUETE LIBERADO LLEGA AL PACIENTE — V9 · `POSTVISIT-001` · REG-307.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `HojaParaElPaciente` tenía exactamente dos salidas: **copiar al portapapeles**
 * e **imprimir**. Ni una línea en `/mi/[token]`, ni una acción en `/api/portal`,
 * ni una plantilla de WhatsApp. La pieza mejor pensada del lado del paciente
 * —determinista, sin modelo, incapaz de inventar una cifra— **no salía de la
 * pantalla del médico**.
 *
 * Y el compañero del paciente, montado en `PATIENT-COMPANION-001`, tenía la
 * superficie lista y **nada que enseñar**: ningún paquete existía porque no
 * había quien los creara.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Auditoría del producto real (`PATIENT-UX-TRUTH-001`), anotado como
 * `POSTVISIT-ENTREGA-001`: «escrito, probado y sin conectar» en su forma más
 * cara — la familia de defectos más grande de este repositorio.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * El contenido se resolvió antes que el camino. Nadie escribió el trozo que
 * lleva ese contenido desde la consulta hasta el teléfono del paciente, y como
 * la hoja SÍ se veía en pantalla, parecía entregada.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * **«El dato tiene que LLEGAR».** Este archivo no comprueba que la ruta diga lo
 * acordado: comprueba que el documento **quede escrito**, con qué contenido, y
 * que la pantalla del paciente vaya a buscarlo y lo pinte.
 *
 * Y una segunda, que es la que hace que la aprobación signifique algo: **el
 * contenido lo compone el SERVIDOR leyendo la nota firmada**. El navegador
 * manda tres identificadores. Si mandara el paquete armado, la compuerta sería
 * decorativa: un POST a mano entregaría la dosis que a uno le apetezca con el
 * nombre del médico encima.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **No es Firestore de verdad.** Es un doble en memoria: comprueba qué
 *   escribe la ruta y dónde, no que las reglas de seguridad la dejen. Las
 *   reglas viven en `firestore.rules` (escritura cerrada al cliente) y su
 *   prueba es la suite del emulador.
 * - **No verifica el portal en un navegador.** Que la pantalla pinte el paquete
 *   se comprueba leyendo su código: este repositorio no tiene render de React.
 *   Verlo con los ojos sigue en `NAV-NAVEGADOR-001`.
 * - **No prueba la compuerta de firma**: eso es
 *   `la-hoja-no-se-entrega-de-un-borrador.test.ts` (REG-306). Aquí sólo se
 *   comprueba que la ruta la respete y devuelva un mensaje entendible.
 * - **No manda ningún mensaje real.** Entregar deja el paquete en el enlace que
 *   el paciente ya tiene; no escribe a WhatsApp ni a nadie.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ── Doble del Admin SDK: un almacén por rutas ─────────────────────────────
type Datos = Record<string, unknown>
const almacen = new Map<string, Datos>()
const escrituras: { ruta: string; datos: Datos }[] = []
const bitacora: Datos[] = []

function hijosDirectos(ruta: string): { id: string; datos: Datos }[] {
  const prefijo = `${ruta}/`
  return [...almacen.entries()]
    .filter(([k]) => k.startsWith(prefijo) && !k.slice(prefijo.length).includes('/'))
    .map(([k, v]) => ({ id: k.slice(prefijo.length), datos: v }))
}

function snap(docs: { id: string; datos: Datos }[]) {
  return { docs: docs.map(d => ({ id: d.id, data: () => d.datos })) }
}

function coleccion(ruta: string) {
  return {
    doc: (id: string) => documento(`${ruta}/${id}`),
    where: (campo: string, _op: string, valor: unknown) => ({
      get: async () => snap(hijosDirectos(ruta).filter(d => d.datos[campo] === valor)),
    }),
    get: async () => snap(hijosDirectos(ruta)),
    add: async (datos: Datos) => { bitacora.push(datos); return { id: 'audit_1' } },
  }
}

function documento(ruta: string) {
  return {
    get: async () => ({ exists: almacen.has(ruta), id: ruta.split('/').pop(), data: () => almacen.get(ruta) }),
    collection: (nombre: string) => coleccion(`${ruta}/${nombre}`),
    set: async (datos: Datos) => { almacen.set(ruta, datos); escrituras.push({ ruta, datos }) },
  }
}

vi.mock('@/lib/firebase-admin', () => ({
  default: {},
  adminDb: { collection: (n: string) => coleccion(n) },
}))

const verificarCapacidad = vi.fn()
vi.mock('@/lib/authz/verificar', () => ({
  verificarCapacidad: (...a: unknown[]) => verificarCapacidad(...a),
}))

import { GET, POST } from '@/app/api/paciente/paquete/route'
import { visibleParaElPaciente, type PaqueteDeVisita } from '@/lib/paciente/paquete-de-visita'

const CLINICA = 'clinicaA'
const PACIENTE = 'pac1'
const NOTA = 'nota_1'
const BASE = `clinics/${CLINICA}/patients/${PACIENTE}`

/** NextRequest mínimo: a esta ruta le basta `json()` y `nextUrl.searchParams`. */
function req(body: unknown, query: Record<string, string> = {}) {
  return {
    json: async () => body,
    nextUrl: { searchParams: new URLSearchParams(query) },
    headers: new Headers(),
  } as never
}

/** Nota firmada sintética. Datos 100 % ficticios (regla de privacidad). */
function sembrarNotaFirmada(over: Datos = {}) {
  almacen.set(`${BASE}/notas/${NOTA}`, {
    estado: 'firmada',
    fechaConsulta: '2026-08-09T10:00:00.000Z',
    resumenEjecutivo: 'Faringitis aguda.',
    medicamentos: [
      { nombre: 'Amoxicilina', dosis: '500 mg', via: 'oral', frecuencia: 'cada 8 horas', duracion: '7 días' },
    ],
    estudiosOrden: ['Biometría hemática'],
    ...over,
  })
}

const paquetesEscritos = () => escrituras.filter(e => e.ruta.includes('/paquetes_visita/'))

beforeEach(() => {
  almacen.clear()
  escrituras.length = 0
  bitacora.length = 0
  verificarCapacidad.mockReset()
  verificarCapacidad.mockResolvedValue({ ok: true, uid: 'uid_dra', email: 'dra@ejemplo.mx', clinicId: CLINICA, role: 'medico' })
  almacen.set(`clinics/${CLINICA}/config/main`, { whatsappConsultorio: '5215555555555' })
})

describe('liberar es un acto de aprobación clínica', () => {
  it('pide la capacidad `firmar`, no «ser miembro»', async () => {
    sembrarNotaFirmada()
    await POST(req({ clinicId: CLINICA, patientId: PACIENTE, notaId: NOTA }))
    expect(verificarCapacidad).toHaveBeenCalledWith(expect.anything(), CLINICA, 'firmar')
  })

  it('sin la capacidad no se escribe NADA', async () => {
    sembrarNotaFirmada()
    verificarCapacidad.mockResolvedValue({ ok: false, response: new Response('no', { status: 403 }) })
    await POST(req({ clinicId: CLINICA, patientId: PACIENTE, notaId: NOTA }))
    expect(paquetesEscritos()).toHaveLength(0)
  })

  it('`approvedBy` sale de la sesión verificada, nunca del cuerpo', async () => {
    sembrarNotaFirmada()
    await POST(req({
      clinicId: CLINICA, patientId: PACIENTE, notaId: NOTA,
      approvedBy: 'quien-yo-diga@ejemplo.mx', estado: 'RELEASED',
    }))
    const p = paquetesEscritos()[0].datos as unknown as PaqueteDeVisita
    expect(p.approvedBy).toBe('dra@ejemplo.mx')
    expect(p.approvedAt).toBeGreaterThan(0)
    expect(visibleParaElPaciente(p)).toBe(true)
  })
})

describe('sin nota firmada no se entrega nada', () => {
  it('un borrador responde 409 y no deja documento', async () => {
    sembrarNotaFirmada({ estado: 'borrador' })
    const r = await POST(req({ clinicId: CLINICA, patientId: PACIENTE, notaId: NOTA }))
    expect(r.status).toBe(409)
    expect(paquetesEscritos()).toHaveLength(0)
    /** El mensaje es para el médico, no un 500: tiene que poder saber qué hacer. */
    expect(JSON.stringify(await r.json())).toMatch(/firmada/i)
  })

  it('una nota que no existe es 404, no un paquete vacío', async () => {
    const r = await POST(req({ clinicId: CLINICA, patientId: PACIENTE, notaId: 'no_existe' }))
    expect(r.status).toBe(404)
    expect(paquetesEscritos()).toHaveLength(0)
  })

  it('la nota se busca DENTRO del paciente de la petición', async () => {
    /**
     * Aislamiento: la ruta lee `clinics/{c}/patients/{p}/notas/{n}`. Pedir la
     * nota de otro paciente con este id no encuentra nada, porque el camino
     * lleva el paciente dentro — no se compara después, no se puede olvidar.
     */
    sembrarNotaFirmada()
    const r = await POST(req({ clinicId: CLINICA, patientId: 'otroPaciente', notaId: NOTA }))
    expect(r.status).toBe(404)
    expect(paquetesEscritos()).toHaveLength(0)
  })
})

describe('el contenido lo compone el servidor, no el navegador', () => {
  it('ignora el contenido que venga en el cuerpo y usa la nota firmada', async () => {
    /**
     * La que muerde. Si la ruta aceptara contenido del cliente, esta dosis
     * inventada llegaría al paciente aprobada por su médica.
     */
    sembrarNotaFirmada()
    await POST(req({
      clinicId: CLINICA, patientId: PACIENTE, notaId: NOTA,
      encounterSummary: 'Tómese el doble',
      medicationInstructions: [{ nombre: 'Amoxicilina', instruccion: 'Amoxicilina 5 g cada hora' }],
    }))
    const p = paquetesEscritos()[0].datos as unknown as PaqueteDeVisita
    expect(p.encounterSummary).toBe('Faringitis aguda.')
    expect(p.medicationInstructions).toEqual([
      { nombre: 'Amoxicilina', instruccion: 'Amoxicilina · 500 mg · por la boca · cada 8 horas (3 veces al día) · durante 7 días' },
    ])
    expect(JSON.stringify(p)).not.toContain('5 g')
  })

  it('el paquete queda escrito DONDE el paciente lo lee', async () => {
    /**
     * REG-160 otra vez, de memoria: el importador validaba una colección y
     * escribía en otra. La ruta que compone y la acción `paquetes` de
     * `/api/portal` tienen que hablar del mismo sitio.
     */
    sembrarNotaFirmada()
    await POST(req({ clinicId: CLINICA, patientId: PACIENTE, notaId: NOTA }))
    expect(paquetesEscritos()[0].ruta).toBe(`${BASE}/paquetes_visita/${NOTA}__v1`)
    const PORTAL = readFileSync(join(process.cwd(), 'src', 'app', 'api', 'portal', 'route.ts'), 'utf8')
    expect(PORTAL).toContain(".collection('paquetes_visita')")
  })

  it('sin notas anteriores, «qué cambió» es `null` y no «sin cambios»', async () => {
    sembrarNotaFirmada()
    await POST(req({ clinicId: CLINICA, patientId: PACIENTE, notaId: NOTA }))
    const p = paquetesEscritos()[0].datos as unknown as PaqueteDeVisita
    expect(p.medicationChanges).toBeNull()
  })

  it('con una nota firmada anterior, lo de hoy que no estaba sale como nuevo', async () => {
    almacen.set(`${BASE}/notas/nota_0`, {
      estado: 'firmada', fechaConsulta: '2026-01-10T10:00:00.000Z',
      medicamentos: [{ nombre: 'Metformina', dosis: '850 mg', via: 'oral', frecuencia: 'cada 12 horas', duracion: 'indefinido' }],
    })
    sembrarNotaFirmada()
    await POST(req({ clinicId: CLINICA, patientId: PACIENTE, notaId: NOTA }))
    const p = paquetesEscritos()[0].datos as unknown as PaqueteDeVisita
    expect(p.medicationChanges).toEqual([{ nombre: 'Amoxicilina', tipo: 'nuevo' }])
    /** Y la metformina, de la que hoy no se habló, NO sale como suspendida. */
    expect(JSON.stringify(p.medicationChanges)).not.toContain('Metformina')
  })

  it('un borrador anterior no cuenta como «lo que ya tomaba»', async () => {
    /** Una nota sin firmar es lo que el médico está escribiendo, no un hecho
     *  del expediente: si contara, «qué cambió» dependería de un texto vivo. */
    almacen.set(`${BASE}/notas/nota_0`, {
      estado: 'borrador', fechaConsulta: '2026-01-10T10:00:00.000Z',
      medicamentos: [{ nombre: 'Amoxicilina' }],
    })
    sembrarNotaFirmada()
    await POST(req({ clinicId: CLINICA, patientId: PACIENTE, notaId: NOTA }))
    expect((paquetesEscritos()[0].datos as unknown as PaqueteDeVisita).medicationChanges).toBeNull()
  })
})

describe('entregar dos veces no le duplica la visita al paciente', () => {
  it('el segundo intento con el mismo contenido no escribe nada', async () => {
    sembrarNotaFirmada()
    await POST(req({ clinicId: CLINICA, patientId: PACIENTE, notaId: NOTA }))
    const r = await POST(req({ clinicId: CLINICA, patientId: PACIENTE, notaId: NOTA }))
    expect(paquetesEscritos()).toHaveLength(1)
    expect((await r.json()).yaEstaba).toBe(true)
  })

  it('si el contenido cambió, se libera una VERSIÓN nueva y la vieja se queda', async () => {
    /**
     * Un paquete liberado es inmutable: lo que se entregó, se entregó. Corregir
     * es liberar otra versión, igual que una adenda no reescribe la nota.
     */
    sembrarNotaFirmada()
    await POST(req({ clinicId: CLINICA, patientId: PACIENTE, notaId: NOTA }))
    sembrarNotaFirmada({ estudiosOrden: ['Biometría hemática', 'Perfil tiroideo'] })
    await POST(req({ clinicId: CLINICA, patientId: PACIENTE, notaId: NOTA }))
    const rutas = paquetesEscritos().map(e => e.ruta)
    expect(rutas).toEqual([`${BASE}/paquetes_visita/${NOTA}__v1`, `${BASE}/paquetes_visita/${NOTA}__v2`])
    expect(almacen.has(`${BASE}/paquetes_visita/${NOTA}__v1`)).toBe(true)
  })
})

describe('queda rastro de quién aprobó, y sin PHI', () => {
  it('la bitácora registra la liberación con conteos, no con contenido', async () => {
    sembrarNotaFirmada()
    await POST(req({ clinicId: CLINICA, patientId: PACIENTE, notaId: NOTA }))
    const asiento = bitacora.find(b => b.evento === 'paquete_visita_liberado')
    expect(asiento).toBeTruthy()
    expect(asiento?.medicoEmail).toBe('dra@ejemplo.mx')
    /** Ni un nombre de fármaco: la bitácora dice que hubo aprobación, no qué
     *  se recetó. El contenido vive en el paquete, que sí está protegido. */
    expect(JSON.stringify(asiento)).not.toMatch(/Amoxicilina|Biometría/i)
  })
})

describe('la pantalla del médico puede saber si ya entregó', () => {
  it('GET dice que no hay nada entregado cuando no lo hay', async () => {
    sembrarNotaFirmada()
    const r = await GET(req({}, { clinicId: CLINICA, patientId: PACIENTE, notaId: NOTA }))
    expect((await r.json()).entregado).toBeNull()
  })

  it('GET devuelve la versión entregada, con quién y cuándo', async () => {
    sembrarNotaFirmada()
    await POST(req({ clinicId: CLINICA, patientId: PACIENTE, notaId: NOTA }))
    const r = await GET(req({}, { clinicId: CLINICA, patientId: PACIENTE, notaId: NOTA }))
    const d = await r.json()
    expect(d.entregado.version).toBe(1)
    expect(d.entregado.approvedBy).toBe('dra@ejemplo.mx')
  })

  it('leer pide `clinico.leer`, que es menos que liberar', async () => {
    sembrarNotaFirmada()
    await GET(req({}, { clinicId: CLINICA, patientId: PACIENTE, notaId: NOTA }))
    expect(verificarCapacidad).toHaveBeenCalledWith(expect.anything(), CLINICA, 'clinico.leer')
  })
})

describe('y el dato LLEGA hasta la pantalla del paciente', () => {
  const PORTAL_PAGE = readFileSync(join(process.cwd(), 'src', 'app', 'mi', '[token]', 'page.tsx'), 'utf8')
  const CONSULTA = readFileSync(join(process.cwd(), 'src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx'), 'utf8')

  it('el portal PIDE los paquetes', () => {
    /** Sin esta petición, el servidor puede filtrar perfectamente y la pantalla
     *  seguir enseñando el estado vacío para siempre. */
    expect(PORTAL_PAGE).toContain("action: 'paquetes'")
    expect(PORTAL_PAGE).toContain('setPaquetes(')
  })

  it('y los PINTA: instrucciones, cambios, estudios y seguimiento', () => {
    expect(PORTAL_PAGE).toContain('paq.medicationInstructions')
    expect(PORTAL_PAGE).toContain('paq.orders')
    expect(PORTAL_PAGE).toContain('paq.followUp')
    expect(PORTAL_PAGE).toContain('medicationChanges')
  })

  it('«no se pudo determinar» no se pinta como «sin cambios»', () => {
    /**
     * `medicationChanges === null` no puede convertirse en un bloque vacío que
     * el paciente lea como «no cambió nada»: se cae el bloque entero. La
     * comprobación es sobre `cambios &&`, no sobre la longitud.
     */
    expect(PORTAL_PAGE).toContain('cambios && cambios.some(c => c.tipo !== \'sin-cambio\')')
  })

  it('la consulta tiene el botón que dispara la entrega', () => {
    expect(CONSULTA).toContain("fetchAutenticado('/api/paciente/paquete'")
    expect(CONSULTA).toContain('const entregarAlPaciente')
  })

  it('la ruta está declarada en el registro de autorización', () => {
    const REGISTRO = readFileSync(join(process.cwd(), 'src', 'lib', 'authz', 'registro-rutas.ts'), 'utf8')
    expect(REGISTRO).toContain("'paciente/paquete'")
    expect(REGISTRO).toContain("metodos: { GET: 'clinico.leer', POST: 'firmar' }")
  })
})
