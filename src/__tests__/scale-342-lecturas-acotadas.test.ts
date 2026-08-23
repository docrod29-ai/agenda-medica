/**
 * GOLDEN — DOS CAMINOS CALIENTES QUE CRECÍAN CON EL CONSULTORIO (#342 / #310).
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * 1. `getPatients()` hacía `getDocs` sobre la colección ENTERA de pacientes del
 *    consultorio y se guardaba el resultado completo en memoria. La caché de 30 s
 *    bajaba la FRECUENCIA de esa lectura, nunca su TAMAÑO: ~14 pantallas de lista
 *    pagaban N documentos de lectura, de tráfico y de RAM cada vez que expiraba
 *    el TTL. Y la búsqueda de pacientes era un filtro en memoria sobre ese N.
 *
 * 2. `findNotaByIdInClinic()` —la ruta de rescate de un enlace roto— listaba
 *    TODOS los pacientes y luego sondeaba el documento de la nota uno por uno,
 *    en serie, hasta dar con ella: N+1 lecturas y N viajes de ida y vuelta.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Auditoría de escala del expediente #342, confirmada de forma independiente
 * contra `main`. Ninguna prueba fallaba: los dos caminos son CORRECTOS con
 * fixtures pequeños. El defecto sólo existe en función del tamaño del tenant, y
 * ningún fixture lo tenía. Por eso las pruebas de abajo comparan consultorios de
 * tamaños MUY distintos: el invariante es que el número de lecturas NO cambie.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 *
 * Ningún contrato de lectura declaraba un tope. «Traer la lista» y «buscar la
 * nota» se escribieron cuando el consultorio del dueño cabía en una pantalla, y
 * nada obligaba después a revisarlo.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Las lecturas dependen del límite de página / de la ventana de búsqueda / del
 * techo de sondeo — NUNCA del número de pacientes. Y cuando el tope recorta,
 * se DECLARA (`truncada`, `no-resoluble`): la regla 4 de seguridad clínica
 * —ausencia de dato no es dato de ausencia— vale también para una lista corta.
 * Una nota de otro consultorio, o dos candidatas dentro del mismo, cierran la
 * puerta en vez de elegir una.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * · No prueba Firestore: el doble de abajo implementa `where/orderBy/limit/
 *   startAfter` con la semántica que este código usa, no el motor real. No dice
 *   nada sobre índices desplegados ni sobre reglas de seguridad — de hecho, el
 *   camino indexado de `collectionGroup` sólo se activa en producción cuando el
 *   dueño despliegue el índice compuesto y la regla de grupo; hasta entonces
 *   cae —acotado— al sondeo de compatibilidad, y eso se prueba aquí aparte.
 * · No prueba las ~14 pantallas que consumen `getPatients`: prueba que la
 *   superficie de compatibilidad ya no es ilimitada y que declara el recorte.
 * · No mide latencia ni coste real; mide CONTEO de documentos leídos.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── Doble de Firestore: cuenta documentos leídos ─────────────────────────────
const h = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  contador: { lecturas: 0, getDocs: 0, getDoc: 0 },
  fallos: { collectionGroup: false },
}))

vi.mock('@/lib/firebase', () => ({
  db: { doble: true },
  auth: { currentUser: { uid: 'medico-sintetico' } },
  storage: null,
}))
vi.mock('@/lib/expediente/audit-log', () => ({ logAudit: async () => {} }))

vi.mock('firebase/firestore', () => {
  type Fila = { ruta: string; id: string; data: Record<string, unknown> }
  type Restriccion =
    | { t: 'orderBy'; campo: string; dir: 'asc' | 'desc' }
    | { t: 'where'; campo: string; op: string; valor: unknown }
    | { t: 'limit'; n: number }
    | { t: 'startAfter'; valores: unknown[] }

  const valorDe = (f: Fila, campo: string): unknown => {
    if (campo === '__name__') return f.id
    return campo.split('.').reduce<unknown>(
      (o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined),
      f.data,
    )
  }

  const filasDe = (ref: { tipo: string; ruta?: string; id?: string }): Fila[] => {
    const out: Fila[] = []
    for (const [ruta, data] of h.docs) {
      const p = ruta.split('/')
      const fila = { ruta, id: p[p.length - 1], data }
      if (ref.tipo === 'col' && p.slice(0, -1).join('/') === ref.ruta) out.push(fila)
      if (ref.tipo === 'grupo' && p[p.length - 2] === ref.id) out.push(fila)
    }
    return out
  }

  const cumple = (v: unknown, op: string, c: unknown): boolean => {
    if (v === undefined) return false
    switch (op) {
      case '==': return v === c
      case '>=': return (v as string) >= (c as string)
      case '>': return (v as string) > (c as string)
      case '<=': return (v as string) <= (c as string)
      case '<': return (v as string) < (c as string)
      default: throw new Error(`operador no soportado en el doble: ${op}`)
    }
  }

  const envolver = (f: Fila) => ({
    id: f.id,
    ref: { path: f.ruta },
    exists: () => true,
    data: () => f.data,
  })

  return {
    collection: (_db: unknown, ...segs: string[]) => ({ tipo: 'col', ruta: segs.join('/') }),
    collectionGroup: (_db: unknown, id: string) => ({ tipo: 'grupo', id }),
    doc: (_db: unknown, ...segs: string[]) => ({
      tipo: 'doc', ruta: segs.join('/'), id: segs[segs.length - 1],
    }),
    query: (ref: unknown, ...cs: Restriccion[]) => ({ tipo: 'query', ref, cs }),
    orderBy: (campo: string, dir: 'asc' | 'desc' = 'asc') => ({ t: 'orderBy', campo, dir }),
    where: (campo: string, op: string, valor: unknown) => ({ t: 'where', campo, op, valor }),
    limit: (n: number) => ({ t: 'limit', n }),
    startAfter: (...valores: unknown[]) => ({ t: 'startAfter', valores }),
    documentId: () => '__name__',
    serverTimestamp: () => 'ts',
    Timestamp: class {},
    writeBatch: () => ({ set() {}, update() {}, delete() {}, commit: async () => {} }),
    addDoc: async () => ({ id: 'nuevo' }),
    setDoc: async () => {},
    updateDoc: async () => {},
    deleteDoc: async () => {},

    getDoc: async (ref: { ruta: string; id: string }) => {
      h.contador.getDoc++
      h.contador.lecturas++
      const data = h.docs.get(ref.ruta)
      return {
        id: ref.id,
        ref: { path: ref.ruta },
        exists: () => data !== undefined,
        data: () => data,
      }
    },

    getDocs: async (q: { tipo: string; ref?: unknown; cs?: Restriccion[] }) => {
      const ref = (q.tipo === 'query' ? q.ref : q) as { tipo: string; ruta?: string; id?: string }
      const cs = (q.tipo === 'query' ? q.cs : []) as Restriccion[]
      if (ref.tipo === 'grupo' && h.fallos.collectionGroup) {
        throw new Error('FAILED_PRECONDITION: the query requires an index')
      }
      const ordenes = cs.filter(c => c.t === 'orderBy') as Extract<Restriccion, { t: 'orderBy' }>[]
      let filas = filasDe(ref)
      for (const c of cs) {
        if (c.t === 'where') filas = filas.filter(f => cumple(valorDe(f, c.campo), c.op, c.valor))
      }
      // Firestore excluye los documentos que NO tienen el campo del orderBy.
      for (const o of ordenes) filas = filas.filter(f => valorDe(f, o.campo) !== undefined)
      filas.sort((a, b) => {
        for (const o of ordenes) {
          const va = valorDe(a, o.campo) as string
          const vb = valorDe(b, o.campo) as string
          if (va < vb) return o.dir === 'desc' ? 1 : -1
          if (va > vb) return o.dir === 'desc' ? -1 : 1
        }
        return 0
      })
      const sa = cs.find(c => c.t === 'startAfter') as Extract<Restriccion, { t: 'startAfter' }> | undefined
      if (sa) {
        filas = filas.filter(f => {
          for (let i = 0; i < ordenes.length; i++) {
            const v = valorDe(f, ordenes[i].campo) as string
            const c = sa.valores[i] as string
            if (v > c) return true
            if (v < c) return false
          }
          return false
        })
      }
      const lim = cs.find(c => c.t === 'limit') as Extract<Restriccion, { t: 'limit' }> | undefined
      if (lim) filas = filas.slice(0, lim.n)
      h.contador.getDocs++
      h.contador.lecturas += filas.length
      return { docs: filas.map(envolver), size: filas.length, empty: filas.length === 0 }
    },
  }
})

import {
  listarPacientesPagina, listarPacientesCompat, getPatients, buscarPacientes,
  invalidarCachePacientes,
  LIMITE_PAGINA_PACIENTES, LIMITE_MAX_PAGINA_PACIENTES, TECHO_COMPAT_PACIENTES,
  type CursorPacientes,
} from '@/lib/firestore'
import {
  buscarNotaEnClinica, findNotaByIdInClinic, TECHO_SONDEO_NOTA,
} from '@/lib/expediente/firestore'

// ── Fixtures sintéticos (cero PHI: nombres y teléfonos generados) ────────────
const CLINICA = 'clinica-sintetica-1'
const OTRA = 'clinica-sintetica-2'

function sembrarPacientes(clinicId: string, n: number, nombre?: (i: number) => string): string[] {
  const ids: string[] = []
  for (let i = 0; i < n; i++) {
    const id = `p${String(i).padStart(5, '0')}`
    ids.push(id)
    h.docs.set(`clinics/${clinicId}/patients/${id}`, {
      nombre: nombre ? nombre(i) : `Paciente ${String(i).padStart(5, '0')}`,
      telefono: `55${String(10000000 + i)}`,
    })
  }
  return ids
}

function sembrarNota(clinicId: string, patientId: string, notaId: string, extra: Record<string, unknown> = {}) {
  h.docs.set(`clinics/${clinicId}/patients/${patientId}/notas/${notaId}`, {
    pacienteId: patientId,
    tipo: 'consulta',
    ...extra,
  })
}

/** Nota «moderna»: trae el consultorio y la identidad sellada en el documento. */
function sembrarNotaIndexada(clinicId: string, patientId: string, notaId: string) {
  sembrarNota(clinicId, patientId, notaId, { clinicId, metadata: { id: notaId } })
}

const reset = () => { h.contador.lecturas = 0; h.contador.getDocs = 0; h.contador.getDoc = 0 }

beforeEach(() => {
  h.docs.clear()
  h.fallos.collectionGroup = false
  invalidarCachePacientes()
  reset()
})

// ─────────────────────────────────────────────────────────────────────────────
describe('#342 · LA PÁGINA DE PACIENTES TIENE TOPE DURO Y ORDEN DETERMINISTA', () => {
  it('la primera página trae el tamaño por omisión y ni un documento más', async () => {
    sembrarPacientes(CLINICA, 400)
    const pag = await listarPacientesPagina(CLINICA)

    expect(pag.pacientes).toHaveLength(LIMITE_PAGINA_PACIENTES)
    expect(pag.limite).toBe(LIMITE_PAGINA_PACIENTES)
    expect(pag.hayMas).toBe(true)
    expect(pag.cursor).not.toBeNull()
    // limite + 1: el documento extra sólo sirve para saber que hay más.
    expect(h.contador.lecturas).toBe(LIMITE_PAGINA_PACIENTES + 1)
  })

  it('el orden es el nombre ascendente, estable entre corridas', async () => {
    sembrarPacientes(CLINICA, 120)
    const pag = await listarPacientesPagina(CLINICA, { limite: 10 })
    const nombres = pag.pacientes.map(p => p.nombre)
    expect(nombres).toEqual([...nombres].sort())
    expect(nombres[0]).toBe('Paciente 00000')
  })

  it('pedir 5 000 no trae 5 000: se acota al techo de página', async () => {
    sembrarPacientes(CLINICA, 3000)
    const pag = await listarPacientesPagina(CLINICA, { limite: 5000 })

    expect(pag.limite).toBe(LIMITE_MAX_PAGINA_PACIENTES)
    expect(pag.pacientes).toHaveLength(LIMITE_MAX_PAGINA_PACIENTES)
    expect(h.contador.lecturas).toBe(LIMITE_MAX_PAGINA_PACIENTES + 1)
  })

  it('un límite absurdo (0, negativo, NaN) cae al tamaño por omisión', async () => {
    sembrarPacientes(CLINICA, 100)
    for (const limite of [0, -5, Number.NaN]) {
      reset()
      const pag = await listarPacientesPagina(CLINICA, { limite })
      expect(pag.limite).toBe(LIMITE_PAGINA_PACIENTES)
    }
  })

  it('INVARIANTE DE ESCALA — las lecturas no dependen del tamaño del consultorio', async () => {
    sembrarPacientes(CLINICA, 100)
    await listarPacientesPagina(CLINICA)
    const chico = h.contador.lecturas

    h.docs.clear(); invalidarCachePacientes(); reset()
    sembrarPacientes(CLINICA, 8000)
    await listarPacientesPagina(CLINICA)
    const enorme = h.contador.lecturas

    expect(chico).toBe(enorme)
    expect(enorme).toBe(LIMITE_PAGINA_PACIENTES + 1)
  })

  it('la última página no ofrece cursor: no hay páginas fantasma', async () => {
    sembrarPacientes(CLINICA, 12)
    const pag = await listarPacientesPagina(CLINICA, { limite: 50 })
    expect(pag.pacientes).toHaveLength(12)
    expect(pag.hayMas).toBe(false)
    expect(pag.cursor).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('#342 · EL CURSOR RECORRE TODO SIN REPETIR NI SALTARSE A NADIE', () => {
  async function recorrer(clinicId: string, limite: number): Promise<string[]> {
    const vistos: string[] = []
    let cursor: CursorPacientes | null = null
    for (let vuelta = 0; vuelta < 500; vuelta++) {
      const pag = await listarPacientesPagina(clinicId, { limite, cursor })
      vistos.push(...pag.pacientes.map(p => p.id))
      if (!pag.cursor) break
      cursor = pag.cursor
    }
    return vistos
  }

  it('137 pacientes en páginas de 25: aparecen los 137, cada uno una sola vez', async () => {
    const ids = sembrarPacientes(CLINICA, 137)
    const vistos = await recorrer(CLINICA, 25)

    expect(vistos).toHaveLength(137)
    expect(new Set(vistos).size).toBe(137)
    expect([...vistos].sort()).toEqual([...ids].sort())
  })

  it('120 HOMÓNIMOS tampoco se duplican ni se pierden — el desempate es el id', async () => {
    /**
     * Sin `orderBy(documentId())` el cursor por valor no tendría desempate: la
     * página siguiente arrancaría «después de García García» y se comería a los
     * 95 homónimos restantes, o los repetiría enteros. En un consultorio
     * familiar esto no es un caso raro, es el martes.
     */
    const ids = sembrarPacientes(CLINICA, 120, () => 'García García')
    const vistos = await recorrer(CLINICA, 25)

    expect(vistos).toHaveLength(120)
    expect(new Set(vistos).size).toBe(120)
    expect([...vistos].sort()).toEqual([...ids].sort())
  })

  it('el cursor lleva nombre Y id — si llevara sólo el nombre, no desempata', async () => {
    sembrarPacientes(CLINICA, 40, () => 'García García')
    const pag = await listarPacientesPagina(CLINICA, { limite: 10 })
    expect(pag.cursor).toEqual({ nombre: 'García García', id: 'p00009' })
  })

  it('cada página sigue costando lo mismo, esté donde esté el cursor', async () => {
    sembrarPacientes(CLINICA, 900)
    const primera = await listarPacientesPagina(CLINICA, { limite: 30 })
    const costePrimera = h.contador.lecturas
    reset()
    await listarPacientesPagina(CLINICA, { limite: 30, cursor: primera.cursor })
    expect(h.contador.lecturas).toBe(costePrimera)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('#342 · LA SUPERFICIE DE COMPATIBILIDAD YA NO BAJA EL CONSULTORIO ENTERO', () => {
  it('consultorio por debajo del techo: la lista sale COMPLETA y sin inventar a nadie', async () => {
    const ids = sembrarPacientes(CLINICA, 30)
    const lista = await listarPacientesCompat(CLINICA)

    expect(lista.truncada).toBe(false)
    expect(lista.pacientes).toHaveLength(30)
    expect(lista.pacientes.map(p => p.id).sort()).toEqual([...ids].sort())
    // Ni un paciente inventado: todo id devuelto existe en el fixture.
    for (const p of lista.pacientes) expect(h.docs.has(`clinics/${CLINICA}/patients/${p.id}`)).toBe(true)
  })

  it('consultorio grande: se corta en el techo y lo DECLARA', async () => {
    sembrarPacientes(CLINICA, 1200)
    const lista = await listarPacientesCompat(CLINICA)

    expect(lista.pacientes).toHaveLength(TECHO_COMPAT_PACIENTES)
    expect(lista.truncada).toBe(true)
    expect(new Set(lista.pacientes.map(p => p.id)).size).toBe(TECHO_COMPAT_PACIENTES)
  })

  it('y las lecturas se acotan al techo, no al tamaño del consultorio', async () => {
    sembrarPacientes(CLINICA, 1200)
    await getPatients(CLINICA)
    const con1200 = h.contador.lecturas

    h.docs.clear(); invalidarCachePacientes(); reset()
    sembrarPacientes(CLINICA, 9000)
    await getPatients(CLINICA)
    const con9000 = h.contador.lecturas

    expect(con1200).toBe(con9000)
    expect(con9000).toBeLessThanOrEqual(TECHO_COMPAT_PACIENTES + 5)
    expect(con9000).toBeLessThan(1200)
  })

  it('getPatients conserva su forma: sigue devolviendo el arreglo de siempre', async () => {
    sembrarPacientes(CLINICA, 8)
    const pacientes = await getPatients(CLINICA)
    expect(Array.isArray(pacientes)).toBe(true)
    expect(pacientes[0].nombre).toBe('Paciente 00000')
  })

  it('la caché sigue viva, y sigue invalidándose', async () => {
    sembrarPacientes(CLINICA, 20)
    await getPatients(CLINICA)
    const primera = h.contador.lecturas
    expect(primera).toBeGreaterThan(0)

    reset()
    await getPatients(CLINICA)
    expect(h.contador.lecturas).toBe(0)

    invalidarCachePacientes(CLINICA)
    await getPatients(CLINICA)
    expect(h.contador.lecturas).toBe(primera)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('#342 · LA BÚSQUEDA NO SE BAJA EL CONSULTORIO PARA FILTRARLO EN MEMORIA', () => {
  it('encuentra por prefijo de nombre leyendo un puñado de documentos, no mil', async () => {
    sembrarPacientes(CLINICA, 1000)
    h.docs.set(`clinics/${CLINICA}/patients/pz`, { nombre: 'Zulema Ortega', telefono: '5599999999' })
    reset()

    const r = await buscarPacientes(CLINICA, 'Zulema')

    expect(r.pacientes.map(p => p.id)).toEqual(['pz'])
    expect(r.estrategias).toEqual(['prefijo-nombre'])
    expect(h.contador.lecturas).toBeLessThanOrEqual(r.ventana)
    expect(h.contador.lecturas).toBeLessThan(50)
  })

  it('teclear en minúsculas también encuentra: se prueba el prefijo capitalizado', async () => {
    sembrarPacientes(CLINICA, 200)
    h.docs.set(`clinics/${CLINICA}/patients/pz`, { nombre: 'Zulema Ortega', telefono: '5599999999' })
    reset()

    const r = await buscarPacientes(CLINICA, 'zulema')
    expect(r.pacientes.map(p => p.id)).toEqual(['pz'])
    expect(h.contador.lecturas).toBeLessThan(50)
  })

  it('busca por teléfono con su propia estrategia declarada', async () => {
    sembrarPacientes(CLINICA, 500)
    reset()

    const r = await buscarPacientes(CLINICA, '5510000005')
    expect(r.estrategias).toEqual(['prefijo-telefono'])
    expect(r.pacientes.map(p => p.id)).toEqual(['p00005'])
    expect(h.contador.lecturas).toBeLessThanOrEqual(r.ventana)
  })

  it('cuando la ventana se llena lo DICE — no enseña «no hay más» sin haber mirado', async () => {
    sembrarPacientes(CLINICA, 300, i => `Ana ${String(i).padStart(4, '0')}`)
    reset()

    const r = await buscarPacientes(CLINICA, 'Ana', { ventana: 50 })
    expect(r.pacientes).toHaveLength(50)
    expect(r.truncada).toBe(true)
    expect(h.contador.lecturas).toBe(50)
  })

  it('una búsqueda vacía no lee NADA', async () => {
    sembrarPacientes(CLINICA, 500)
    reset()

    const r = await buscarPacientes(CLINICA, '   ')
    expect(r.pacientes).toEqual([])
    expect(r.estrategias).toEqual([])
    expect(h.contador.getDocs).toBe(0)
    expect(h.contador.lecturas).toBe(0)
  })

  it('INVARIANTE DE ESCALA — el coste de buscar no cambia con el tamaño del tenant', async () => {
    sembrarPacientes(CLINICA, 100)
    h.docs.set(`clinics/${CLINICA}/patients/pz`, { nombre: 'Zulema Ortega', telefono: '5599999999' })
    reset()
    await buscarPacientes(CLINICA, 'Zulema')
    const chico = h.contador.lecturas

    h.docs.clear(); reset()
    sembrarPacientes(CLINICA, 7000)
    h.docs.set(`clinics/${CLINICA}/patients/pz`, { nombre: 'Zulema Ortega', telefono: '5599999999' })
    reset()
    await buscarPacientes(CLINICA, 'Zulema')

    expect(h.contador.lecturas).toBe(chico)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('#342 · LA NOTA SE LOCALIZA SIN RECORRER A TODOS LOS PACIENTES', () => {
  it('camino indexado: resuelve en dos lecturas aunque el consultorio tenga 800', async () => {
    sembrarPacientes(CLINICA, 800)
    sembrarNotaIndexada(CLINICA, 'p00417', 'nota-abc')
    reset()

    const r = await buscarNotaEnClinica(CLINICA, 'nota-abc')

    expect(r).toMatchObject({ estado: 'encontrada', patientId: 'p00417', notaId: 'nota-abc' })
    expect(h.contador.lecturas).toBeLessThanOrEqual(2)
    // Y sobre todo: NI UNA sonda por paciente.
    expect(h.contador.getDoc).toBe(0)
  })

  it('la nota devuelta viene normalizada — el timeline no revienta con notas viejas', async () => {
    sembrarPacientes(CLINICA, 5)
    sembrarNotaIndexada(CLINICA, 'p00002', 'nota-vieja')
    const r = await buscarNotaEnClinica(CLINICA, 'nota-vieja')

    expect(r.estado).toBe('encontrada')
    if (r.estado !== 'encontrada') return
    expect(r.nota.diagnosticos).toEqual([])
    expect(r.nota.medicamentos).toEqual([])
    expect(r.nota.alergias).toEqual([])
    expect(r.nota.secciones).toEqual([])
    expect(r.nota.id).toBe('nota-vieja')
  })

  it('una nota de OTRO consultorio no se devuelve jamás', async () => {
    sembrarPacientes(CLINICA, 3)
    sembrarPacientes(OTRA, 3)
    sembrarNotaIndexada(OTRA, 'p00001', 'nota-ajena')
    reset()

    const r = await buscarNotaEnClinica(CLINICA, 'nota-ajena')
    expect(r.estado).toBe('no-encontrada')
    expect(JSON.stringify(r)).not.toContain('p00001')
  })

  it('y tampoco si el DOCUMENTO ajeno miente y dice ser de esta clínica', async () => {
    /**
     * La pertenencia se prueba contra la RUTA, no contra el campo `clinicId`:
     * un campo lo escribe quien crea el documento, la ruta la impone la
     * estructura. Si esto se comprobara sólo por campo, una importación mal
     * etiquetada abriría la nota de otro consultorio.
     */
    sembrarPacientes(CLINICA, 3)
    sembrarNota(OTRA, 'p00001', 'nota-mentirosa', {
      clinicId: CLINICA,                 // ← mentira: vive bajo `OTRA`
      metadata: { id: 'nota-mentirosa' },
    })
    reset()

    const r = await buscarNotaEnClinica(CLINICA, 'nota-mentirosa')
    expect(r.estado).toBe('no-encontrada')
    // No se sondeó: se sabía que la única candidata era de otro tenant.
    expect(h.contador.getDoc).toBe(0)
  })

  it('dos candidatas en el MISMO consultorio fallan cerrado: ambigua, no «la primera»', async () => {
    sembrarPacientes(CLINICA, 10)
    sembrarNota(CLINICA, 'p00001', 'doc-a', { clinicId: CLINICA, metadata: { id: 'repetida' } })
    sembrarNota(CLINICA, 'p00002', 'doc-b', { clinicId: CLINICA, metadata: { id: 'repetida' } })
    reset()

    const r = await buscarNotaEnClinica(CLINICA, 'repetida')
    expect(r.estado).toBe('ambigua')
  })

  it('clinicId o notaId vacíos no disparan ninguna lectura', async () => {
    sembrarPacientes(CLINICA, 500)
    reset()
    expect((await buscarNotaEnClinica('', 'x')).estado).toBe('no-encontrada')
    expect((await buscarNotaEnClinica(CLINICA, '')).estado).toBe('no-encontrada')
    expect(h.contador.lecturas).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('#342 · EL SONDEO DE COMPATIBILIDAD ESTÁ ACOTADO Y NO ADIVINA', () => {
  it('consultorio pequeño con nota LEGACY (sin clinicId ni metadata): la encuentra', async () => {
    sembrarPacientes(CLINICA, 10)
    sembrarNota(CLINICA, 'p00007', 'nota-legacy')   // sin clinicId, sin metadata.id
    reset()

    const r = await buscarNotaEnClinica(CLINICA, 'nota-legacy')

    expect(r).toMatchObject({ estado: 'encontrada', patientId: 'p00007', notaId: 'nota-legacy' })
    expect(h.contador.getDoc).toBeLessThanOrEqual(TECHO_SONDEO_NOTA)
  })

  it('si el índice/regla de collectionGroup no existe, NO se vuelve al recorrido total', async () => {
    h.fallos.collectionGroup = true
    sembrarPacientes(CLINICA, 900)
    sembrarNotaIndexada(CLINICA, 'p00003', 'nota-abc')
    reset()

    const r = await buscarNotaEnClinica(CLINICA, 'nota-abc')

    expect(r).toMatchObject({ estado: 'encontrada', patientId: 'p00003' })
    expect(h.contador.getDoc).toBeLessThanOrEqual(TECHO_SONDEO_NOTA)
    expect(h.contador.lecturas).toBeLessThanOrEqual(TECHO_SONDEO_NOTA * 2 + 2)
    expect(h.contador.lecturas).toBeLessThan(900)
  })

  it('nota desconocida en consultorio grande: no-resoluble, y sin tormenta de lecturas', async () => {
    sembrarPacientes(CLINICA, 800)
    reset()

    const r = await buscarNotaEnClinica(CLINICA, 'nota-que-no-existe')

    expect(r).toEqual({ estado: 'no-resoluble', pacientesSondeados: TECHO_SONDEO_NOTA })
    expect(h.contador.getDoc).toBe(TECHO_SONDEO_NOTA)
    expect(h.contador.lecturas).toBeLessThanOrEqual(TECHO_SONDEO_NOTA * 2 + 2)
    expect(h.contador.lecturas).toBeLessThan(800)
  })

  it('INVARIANTE DE ESCALA — 800 o 5 000 pacientes cuestan lo mismo', async () => {
    sembrarPacientes(CLINICA, 800)
    reset()
    await buscarNotaEnClinica(CLINICA, 'nota-que-no-existe')
    const con800 = h.contador.lecturas

    h.docs.clear(); reset()
    sembrarPacientes(CLINICA, 5000)
    reset()
    await buscarNotaEnClinica(CLINICA, 'nota-que-no-existe')

    expect(h.contador.lecturas).toBe(con800)
  })

  it('consultorio pequeño y nota inexistente: eso SÍ es «no encontrada»', async () => {
    sembrarPacientes(CLINICA, 8)
    reset()
    const r = await buscarNotaEnClinica(CLINICA, 'nota-que-no-existe')
    expect(r.estado).toBe('no-encontrada')
  })

  it('«no-resoluble» NO es «no existe»: son estados distintos y la pantalla los distingue', async () => {
    sembrarPacientes(CLINICA, 800)
    const grande = await buscarNotaEnClinica(CLINICA, 'nota-x')

    h.docs.clear()
    sembrarPacientes(CLINICA, 5)
    const chico = await buscarNotaEnClinica(CLINICA, 'nota-x')

    expect(grande.estado).toBe('no-resoluble')
    expect(chico.estado).toBe('no-encontrada')
    expect(grande.estado).not.toBe(chico.estado)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('#342 · LOS LLAMADORES DE COMPATIBILIDAD CONSERVAN SU SEMÁNTICA', () => {
  it('findNotaByIdInClinic devuelve { patientId, nota } cuando la encuentra', async () => {
    sembrarPacientes(CLINICA, 10)
    sembrarNotaIndexada(CLINICA, 'p00004', 'nota-abc')

    const r = await findNotaByIdInClinic(CLINICA, 'nota-abc')
    expect(r?.patientId).toBe('p00004')
    expect(r?.nota.id).toBe('nota-abc')
  })

  it('y null —no una nota de otro paciente— cuando no se puede resolver', async () => {
    sembrarPacientes(CLINICA, 800)
    expect(await findNotaByIdInClinic(CLINICA, 'nota-x')).toBeNull()
  })

  it('null también ante ambigüedad: nunca elige por su cuenta', async () => {
    sembrarPacientes(CLINICA, 10)
    sembrarNota(CLINICA, 'p00001', 'doc-a', { clinicId: CLINICA, metadata: { id: 'repetida' } })
    sembrarNota(CLINICA, 'p00002', 'doc-b', { clinicId: CLINICA, metadata: { id: 'repetida' } })

    expect(await findNotaByIdInClinic(CLINICA, 'repetida')).toBeNull()
  })
})
