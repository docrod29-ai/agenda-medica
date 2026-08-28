/**
 * GOLDEN — P1-12 · `getNotas()` BAJABA LA VIDA ENTERA DE UN PACIENTE.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `getNotas(clinicId, patientId)` hacía un `getDocs` sobre la subcolección
 * ENTERA de notas del paciente, sin `limit()`. Y una nota de este producto no es
 * una fila: lleva dentro `transcripcionMotor`, `transcripcionCruda`,
 * `dialogoDiarizado` y el bloque `extraction` —el dictado completo de la
 * consulta—. El propio `updateNota` documenta que UNA sola nota se acerca al
 * tope de 1 MB por documento de Firestore.
 *
 * Cinco llamadores pedían esa historia completa y ninguno la necesitaba entera:
 *
 *   · `/hospitalizacion/[id]` — se la bajaba para quedarse, con un `.filter()`
 *     en memoria, con las notas de UN episodio;
 *   · `/referencia/[id]` — para prellenar UNA carta con UNA nota;
 *   · `/cumplimiento/retencion` — para leer UNA fecha, multiplicado por hasta
 *     500 pacientes del recorrido;
 *   · `/consulta/[id]` y `/expediente/[id]` — para derivar medicación vigente,
 *     problemas activos y la línea de tiempo;
 *   · `deletePatientExpediente` — para saber si existía alguna nota FIRMADA.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Inventario de escala del tablero Ausculta (WS-03): 51 `getDocs`, 44 sin
 * `limit()`. `getNotas` quedó anotado como «la siguiente amplificación» después
 * de que REG-341 acotara el directorio de pacientes. Ninguna prueba fallaba: el
 * defecto sólo existe en función del tamaño de la historia, y ningún fixture la
 * tenía larga. Por eso las pruebas de abajo comparan pacientes de historias MUY
 * distintas: el invariante es que el número de lecturas NO cambie.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 *
 * El contrato de lectura de la historia clínica no declaraba ningún tope. Se
 * escribió cuando un paciente cabía en una pantalla, y nada obligó después a
 * revisarlo: las cinco pantallas heredaron «traer las notas» sin preguntar
 * cuántas eran ni cuáles necesitaban.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Las lecturas dependen del límite de página, del techo o del episodio pedido —
 * NUNCA del número de notas del paciente. Y cuando el tope recorta, se DECLARA
 * (`truncada`, `hayMas`, `alMenos`): la regla 4 de seguridad clínica —ausencia
 * de dato no es dato de ausencia— vale también para una historia corta. Un fallo
 * de lectura no es un expediente vacío, y una historia a medio cargar no es un
 * expediente completo.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · No prueba Firestore: el doble de abajo implementa `where/orderBy/limit/
 *   startAfter` con la semántica que este código usa, no el motor real. No dice
 *   nada sobre índices desplegados. Sí se comprueba lo que de eso depende: que
 *   ninguna consulta nueva combine `where` con `orderBy` sobre otro campo, que
 *   es lo único que exigiría un índice compuesto — y este repositorio no
 *   despliega ninguno (no existe `firestore.indexes.json`).
 * · No renderiza: que el aviso de recorte EXISTA en la fuente no prueba que se
 *   vea. Eso es navegador y no se ha ejecutado aquí.
 * · No mide latencia ni coste real; mide CONTEO de documentos leídos.
 * · No recupera las notas SIN campo `fechaConsulta`: Firestore las omite de una
 *   consulta ordenada por ese campo. Es un límite que YA existía —el `getNotas`
 *   anterior ordenaba igual— y está probado abajo, con las dos vías que sí las
 *   alcanzan: el conteo de firmadas (salvaguarda NOM-004) y el barrido por id
 *   de la cascada de borrado.
 * · No prueba las reglas de Firestore: el aislamiento entre consultorios se
 *   comprueba aquí por RUTA de la consulta, que es lo que este módulo controla.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── Doble de Firestore: cuenta documentos leídos ─────────────────────────────
const h = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  contador: { lecturas: 0, getDocs: 0, getDoc: 0 },
  /** Las consultas tal y como llegaron: para auditar orden, filtros y topes. */
  consultas: [] as { ruta: string; cs: unknown[] }[],
  fallar: false,
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

  const filasDe = (ref: { tipo: string; ruta?: string }): Fila[] => {
    const out: Fila[] = []
    for (const [ruta, data] of h.docs) {
      const p = ruta.split('/')
      if (ref.tipo === 'col' && p.slice(0, -1).join('/') === ref.ruta) {
        out.push({ ruta, id: p[p.length - 1], data })
      }
    }
    return out
  }

  const cumple = (v: unknown, op: string, c: unknown): boolean => {
    if (v === undefined) return false
    switch (op) {
      case '==': return v === c
      case '>=': return (v as string) >= (c as string)
      case '<': return (v as string) < (c as string)
      default: throw new Error(`operador no soportado en el doble: ${op}`)
    }
  }

  const envolver = (f: Fila) => ({
    id: f.id, ref: { path: f.ruta }, exists: () => true, data: () => f.data,
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
    runTransaction: async () => undefined,
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
        id: ref.id, ref: { path: ref.ruta },
        exists: () => data !== undefined, data: () => data,
      }
    },

    getDocs: async (q: { tipo: string; ref?: unknown; cs?: Restriccion[] }) => {
      if (h.fallar) throw new Error('PERMISSION_DENIED (doble)')
      const ref = (q.tipo === 'query' ? q.ref : q) as { tipo: string; ruta?: string }
      const cs = (q.tipo === 'query' ? q.cs : []) as Restriccion[]
      h.consultas.push({ ruta: ref.ruta ?? '', cs })

      const ordenes = cs.filter(c => c.t === 'orderBy') as Extract<Restriccion, { t: 'orderBy' }>[]
      let filas = filasDe(ref)
      for (const c of cs) {
        if (c.t === 'where') filas = filas.filter(f => cumple(valorDe(f, c.campo), c.op, c.valor))
      }
      // Firestore EXCLUYE los documentos que no tienen el campo del orderBy.
      for (const o of ordenes) filas = filas.filter(f => valorDe(f, o.campo) !== undefined)
      // Sin orderBy, Firestore devuelve por __name__ ascendente.
      const criterios = ordenes.length ? ordenes : [{ t: 'orderBy' as const, campo: '__name__', dir: 'asc' as const }]
      filas.sort((a, b) => {
        for (const o of criterios) {
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
          for (let i = 0; i < criterios.length; i++) {
            const v = valorDe(f, criterios[i].campo) as string
            const c = sa.valores[i] as string
            const mayor = criterios[i].dir === 'desc' ? v < c : v > c
            const menor = criterios[i].dir === 'desc' ? v > c : v < c
            if (mayor) return true
            if (menor) return false
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

import { readFileSync } from 'node:fs'
import {
  getNotas, listarNotasPagina, listarNotasCompat, listarNotasDeInternamiento,
  contarNotasFirmadas, listarIdsDeNotas, deletePatientExpediente,
  getUltimasNotasResumen,
  LIMITE_PAGINA_NOTAS, LIMITE_MAX_PAGINA_NOTAS, TECHO_COMPAT_NOTAS,
  TECHO_NOTAS_INTERNAMIENTO, TECHO_CONTEO_FIRMADAS,
  type CursorNotas,
} from '@/lib/expediente/firestore'

// ── Fixtures sintéticos (cero PHI) ──────────────────────────────────────────
const CLINICA = 'clinica-sintetica-1'
const OTRA = 'clinica-sintetica-2'
const PACIENTE = 'p-sintetico-1'

/** Siembra `n` notas con fechas descendentes y peso realista (dictado dentro). */
function sembrarHistoria(
  clinicId: string,
  patientId: string,
  n: number,
  extra?: (i: number) => Record<string, unknown>,
): string[] {
  const ids: string[] = []
  for (let i = 0; i < n; i++) {
    const id = `n${String(i).padStart(5, '0')}`
    ids.push(id)
    h.docs.set(`clinics/${clinicId}/patients/${patientId}/notas/${id}`, {
      pacienteId: patientId,
      tipo: 'consulta',
      estado: i % 2 === 0 ? 'firmada' : 'borrador',
      // Fechas descendentes: la nota 0 es la MÁS reciente.
      fechaConsulta: `2026-01-01T00:00:${String(99 - (i % 100)).padStart(2, '0')}.000Z`,
      transcripcionCruda: 'x'.repeat(200),
      transcripcionMotor: 'x'.repeat(200),
      ...(extra ? extra(i) : {}),
    })
  }
  return ids
}

beforeEach(() => {
  h.docs.clear()
  h.consultas.length = 0
  h.contador.lecturas = 0
  h.contador.getDocs = 0
  h.contador.getDoc = 0
  h.fallar = false
})

// ─────────────────────────────────────────────────────────────────────────────
describe('P1-12 · las lecturas no crecen con la historia del paciente', () => {
  it('un paciente con POCAS notas se lee entero, en una sola consulta', async () => {
    sembrarHistoria(CLINICA, PACIENTE, 7)
    const pagina = await listarNotasPagina(CLINICA, PACIENTE)
    expect(pagina.notas).toHaveLength(7)
    expect(pagina.hayMas).toBe(false)
    expect(pagina.cursor).toBeNull()
    expect(h.contador.getDocs).toBe(1)
  })

  it('un paciente con MÁS notas que el límite lee el límite, no la historia', async () => {
    sembrarHistoria(CLINICA, PACIENTE, 400)
    h.contador.lecturas = 0
    const pagina = await listarNotasPagina(CLINICA, PACIENTE)
    expect(pagina.notas).toHaveLength(LIMITE_PAGINA_NOTAS)
    // Una lectura extra, y sólo una: el centinela de «hay más».
    expect(h.contador.lecturas).toBe(LIMITE_PAGINA_NOTAS + 1)
  })

  it('el mismo número de lecturas con 40 notas que con 4 000', async () => {
    sembrarHistoria(CLINICA, PACIENTE, 40)
    h.contador.lecturas = 0
    await listarNotasPagina(CLINICA, PACIENTE)
    const conPocas = h.contador.lecturas

    h.docs.clear()
    sembrarHistoria(CLINICA, PACIENTE, 4000)
    h.contador.lecturas = 0
    await listarNotasPagina(CLINICA, PACIENTE)
    expect(h.contador.lecturas).toBe(conPocas)
  })

  it('nadie puede pedir una página por encima del techo duro', async () => {
    sembrarHistoria(CLINICA, PACIENTE, 1000)
    const pagina = await listarNotasPagina(CLINICA, PACIENTE, { limite: 999 })
    expect(pagina.limite).toBe(LIMITE_MAX_PAGINA_NOTAS)
    expect(pagina.notas).toHaveLength(LIMITE_MAX_PAGINA_NOTAS)
  })

  it('`getNotas` —la superficie vieja— dejó de ser ilimitada', async () => {
    sembrarHistoria(CLINICA, PACIENTE, 10_000)
    h.contador.lecturas = 0
    const notas = await getNotas(CLINICA, PACIENTE)
    expect(notas.length).toBe(TECHO_COMPAT_NOTAS)
    // 10 000 notas seguían siendo 10 000 lecturas antes de esta rebanada.
    expect(h.contador.lecturas).toBeLessThanOrEqual(TECHO_COMPAT_NOTAS + LIMITE_MAX_PAGINA_NOTAS)
  })

  it('con 10 000 notas el recorte se DECLARA, no se calla', async () => {
    sembrarHistoria(CLINICA, PACIENTE, 10_000)
    const r = await listarNotasCompat(CLINICA, PACIENTE)
    expect(r.truncada).toBe(true)
    expect(r.techo).toBe(TECHO_COMPAT_NOTAS)
  })

  it('cuando la historia CABE, no se declara un recorte que no hubo', async () => {
    sembrarHistoria(CLINICA, PACIENTE, 12)
    const r = await listarNotasCompat(CLINICA, PACIENTE)
    expect(r.truncada).toBe(false)
    expect(r.notas).toHaveLength(12)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('P1-12 · la paginación no repite ni se salta una nota', () => {
  it('primera página, página siguiente, y el cursor continúa donde quedó', async () => {
    sembrarHistoria(CLINICA, PACIENTE, 60)
    const p1 = await listarNotasPagina(CLINICA, PACIENTE, { limite: 10 })
    expect(p1.notas).toHaveLength(10)
    expect(p1.hayMas).toBe(true)
    expect(p1.cursor).not.toBeNull()

    const p2 = await listarNotasPagina(CLINICA, PACIENTE, { limite: 10, cursor: p1.cursor })
    expect(p2.notas).toHaveLength(10)
    const ids1 = p1.notas.map(n => n.id)
    const ids2 = p2.notas.map(n => n.id)
    expect(ids1.some(id => ids2.includes(id))).toBe(false)
  })

  it('recorrer TODAS las páginas devuelve cada nota UNA vez y ninguna de menos', async () => {
    const ids = sembrarHistoria(CLINICA, PACIENTE, 137)
    const vistos: string[] = []
    let cursor: CursorNotas | null = null
    for (let i = 0; i < 100; i++) {
      const pagina: Awaited<ReturnType<typeof listarNotasPagina>> =
        await listarNotasPagina(CLINICA, PACIENTE, { limite: 13, cursor })
      vistos.push(...pagina.notas.map(n => n.id))
      cursor = pagina.cursor
      if (!pagina.hayMas) break
    }
    expect(vistos).toHaveLength(137)
    expect(new Set(vistos).size).toBe(137)
    expect([...vistos].sort()).toEqual([...ids].sort())
  })

  it('el MISMO cursor pedido dos veces devuelve lo MISMO (es estable)', async () => {
    sembrarHistoria(CLINICA, PACIENTE, 80)
    const p1 = await listarNotasPagina(CLINICA, PACIENTE, { limite: 20 })
    const a = await listarNotasPagina(CLINICA, PACIENTE, { limite: 20, cursor: p1.cursor })
    const b = await listarNotasPagina(CLINICA, PACIENTE, { limite: 20, cursor: p1.cursor })
    expect(a.notas.map(n => n.id)).toEqual(b.notas.map(n => n.id))
  })

  it('el orden es determinista: la misma consulta, el mismo orden', async () => {
    sembrarHistoria(CLINICA, PACIENTE, 30)
    const a = await listarNotasPagina(CLINICA, PACIENTE, { limite: 30 })
    const b = await listarNotasPagina(CLINICA, PACIENTE, { limite: 30 })
    expect(a.notas.map(n => n.id)).toEqual(b.notas.map(n => n.id))
  })

  it('EL CASO QUE ROMPÍA: notas con el MISMO instante desempatan por id', async () => {
    /**
     * Dos notas del mismo día no son el caso raro: un ingreso y su evolución,
     * una consulta y su nota de procedimiento. Sin desempate, el cursor queda
     * indefinido entre ellas y la página siguiente repite o se salta un acto
     * médico. Aquí TODAS comparten `fechaConsulta` a propósito.
     */
    for (let i = 0; i < 40; i++) {
      h.docs.set(`clinics/${CLINICA}/patients/${PACIENTE}/notas/n${String(i).padStart(3, '0')}`, {
        pacienteId: PACIENTE, tipo: 'consulta', estado: 'firmada',
        fechaConsulta: '2026-03-01T10:00:00.000Z',
      })
    }
    const vistos: string[] = []
    let cursor: CursorNotas | null = null
    for (let i = 0; i < 20; i++) {
      const pagina: Awaited<ReturnType<typeof listarNotasPagina>> =
        await listarNotasPagina(CLINICA, PACIENTE, { limite: 7, cursor })
      vistos.push(...pagina.notas.map(n => n.id))
      cursor = pagina.cursor
      if (!pagina.hayMas) break
    }
    expect(vistos).toHaveLength(40)
    expect(new Set(vistos).size).toBe(40)
  })

  it('el desempate viaja en el cursor, y por eso el orden lo lleva', async () => {
    sembrarHistoria(CLINICA, PACIENTE, 5)
    await listarNotasPagina(CLINICA, PACIENTE, { limite: 2 })
    const cs = h.consultas.at(-1)!.cs as { t: string; campo?: string; dir?: string }[]
    const ordenes = cs.filter(c => c.t === 'orderBy')
    expect(ordenes.map(o => o.campo)).toEqual(['fechaConsulta', '__name__'])
    // Las direcciones coinciden: es lo que permite que Firestore lo sirva con
    // el índice AUTOMÁTICO de un solo campo, sin índice compuesto.
    expect(new Set(ordenes.map(o => o.dir))).toEqual(new Set(['desc']))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('P1-12 · quien necesita un episodio lee UN episodio', () => {
  it('la hospitalización ya no paga la historia entera para pintar una estancia', async () => {
    sembrarHistoria(CLINICA, PACIENTE, 3000)
    // Cinco notas del episodio, dentro de esas 3 000.
    for (let i = 0; i < 5; i++) {
      h.docs.set(`clinics/${CLINICA}/patients/${PACIENTE}/notas/epi-${i}`, {
        pacienteId: PACIENTE, tipo: 'evolucion', estado: 'firmada',
        internamientoId: 'ing-1',
        fechaConsulta: `2026-05-0${i + 1}T08:00:00.000Z`,
      })
    }
    h.contador.lecturas = 0
    const r = await listarNotasDeInternamiento(CLINICA, PACIENTE, 'ing-1')
    expect(r.notas.map(n => n.id)).toEqual(['epi-4', 'epi-3', 'epi-2', 'epi-1', 'epi-0'])
    expect(r.truncada).toBe(false)
    // Cinco documentos leídos de una historia de 3 005.
    expect(h.contador.lecturas).toBe(5)
  })

  it('un episodio por encima del techo lo declara', async () => {
    for (let i = 0; i < TECHO_NOTAS_INTERNAMIENTO + 10; i++) {
      h.docs.set(`clinics/${CLINICA}/patients/${PACIENTE}/notas/e${String(i).padStart(4, '0')}`, {
        pacienteId: PACIENTE, tipo: 'evolucion', estado: 'firmada',
        internamientoId: 'ing-1', fechaConsulta: '2026-05-01T08:00:00.000Z',
      })
    }
    const r = await listarNotasDeInternamiento(CLINICA, PACIENTE, 'ing-1')
    expect(r.notas).toHaveLength(TECHO_NOTAS_INTERNAMIENTO)
    expect(r.truncada).toBe(true)
  })

  it('la consulta del episodio NO mezcla `where` con `orderBy` (no exige índice compuesto)', async () => {
    sembrarHistoria(CLINICA, PACIENTE, 3)
    await listarNotasDeInternamiento(CLINICA, PACIENTE, 'ing-1')
    const cs = h.consultas.at(-1)!.cs as { t: string }[]
    expect(cs.some(c => c.t === 'where')).toBe(true)
    expect(cs.some(c => c.t === 'orderBy')).toBe(false)
    expect(cs.some(c => c.t === 'limit')).toBe(true)
  })

  it('un episodio vacío es un episodio vacío, no un error', async () => {
    sembrarHistoria(CLINICA, PACIENTE, 20)
    const r = await listarNotasDeInternamiento(CLINICA, PACIENTE, 'ing-inexistente')
    expect(r.notas).toEqual([])
    expect(r.truncada).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('P1-12 · la salvaguarda NOM-004 dejó de depender de un campo que puede faltar', () => {
  it('cuenta las firmadas sin bajarse la historia', async () => {
    sembrarHistoria(CLINICA, PACIENTE, 2000)   // la mitad firmadas
    h.contador.lecturas = 0
    const r = await contarNotasFirmadas(CLINICA, PACIENTE)
    expect(r.conteo).toBe(TECHO_CONTEO_FIRMADAS)
    expect(r.alMenos).toBe(true)
    expect(h.contador.lecturas).toBe(TECHO_CONTEO_FIRMADAS + 1)
  })

  it('por debajo del techo el conteo es EXACTO y no dice «al menos»', async () => {
    sembrarHistoria(CLINICA, PACIENTE, 6)  // 3 firmadas
    const r = await contarNotasFirmadas(CLINICA, PACIENTE)
    expect(r.conteo).toBe(3)
    expect(r.alMenos).toBe(false)
  })

  it('EL AGUJERO QUE ESTO CIERRA: una nota firmada SIN `fechaConsulta` sí bloquea el borrado', async () => {
    /**
     * Probado al revés. La salvaguarda se apoyaba en `getNotas`, que ordena por
     * `fechaConsulta`; Firestore OMITE de una consulta ordenada los documentos
     * que no tienen ese campo. Una nota firmada sin fecha —las hay: hay caminos
     * de escritura que no pasan por `createNota`— no llegaba a la salvaguarda y
     * el registro legal quedaba borrable.
     */
    h.docs.set(`clinics/${CLINICA}/patients/${PACIENTE}/notas/sin-fecha`, {
      pacienteId: PACIENTE, tipo: 'consulta', estado: 'firmada',
    })
    // El listado ordenado NO la ve — así es Firestore, y así era la salvaguarda.
    expect(await getNotas(CLINICA, PACIENTE)).toHaveLength(0)
    // La salvaguarda de ahora SÍ.
    expect((await contarNotasFirmadas(CLINICA, PACIENTE)).conteo).toBe(1)
    const r = await deletePatientExpediente(CLINICA, PACIENTE)
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/NOM-004/)
  })

  it('un paciente con sólo borradores sí se puede borrar, y se borran TODOS', async () => {
    for (let i = 0; i < 4; i++) {
      h.docs.set(`clinics/${CLINICA}/patients/${PACIENTE}/notas/b${i}`, {
        pacienteId: PACIENTE, tipo: 'consulta', estado: 'borrador',
        ...(i === 3 ? {} : { fechaConsulta: `2026-02-0${i + 1}T08:00:00.000Z` }),
      })
    }
    const r = await deletePatientExpediente(CLINICA, PACIENTE)
    expect(r.ok).toBe(true)
    // La cuarta no tiene `fechaConsulta`: con el barrido por fecha se habría
    // quedado huérfana bajo un paciente ya borrado.
    expect(r.borradas?.notas).toBe(4)
  })

  it('el barrido de la cascada va por id, que ningún documento puede no tener', async () => {
    sembrarHistoria(CLINICA, PACIENTE, 250, () => ({ estado: 'borrador' }))
    const r = await listarIdsDeNotas(CLINICA, PACIENTE)
    expect(r.ids).toHaveLength(250)
    expect(new Set(r.ids).size).toBe(250)
    expect(r.truncada).toBe(false)
  })

  it('si la cascada no cabe entera, NO se borra a medias', async () => {
    sembrarHistoria(CLINICA, PACIENTE, 60, () => ({ estado: 'borrador' }))
    const r = await listarIdsDeNotas(CLINICA, PACIENTE, { techo: 20 })
    expect(r.truncada).toBe(true)
    expect(r.ids).toHaveLength(20)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('P1-12 · el contexto de visitas previas ya no lee la historia entera', () => {
  it('con 5 000 notas firmadas se leen unas pocas, no 5 000', async () => {
    sembrarHistoria(CLINICA, PACIENTE, 5000, () => ({ estado: 'firmada', resumenEjecutivo: 'r' }))
    h.contador.lecturas = 0
    const r = await getUltimasNotasResumen(CLINICA, PACIENTE)
    expect(r).not.toBe('')
    expect(h.contador.lecturas).toBeLessThanOrEqual(LIMITE_PAGINA_NOTAS + 1)
  })

  it('y las que devuelve son las MÁS RECIENTES, en orden', async () => {
    for (let i = 0; i < 6; i++) {
      h.docs.set(`clinics/${CLINICA}/patients/${PACIENTE}/notas/v${i}`, {
        pacienteId: PACIENTE, tipo: 'consulta', estado: 'firmada',
        fechaConsulta: `2026-0${i + 1}-15T09:00:00.000Z`,
        resumenEjecutivo: `visita-${i}`,
      })
    }
    const r = await getUltimasNotasResumen(CLINICA, PACIENTE)
    expect(r).toMatch(/visita-5.*visita-4.*visita-3/)
    expect(r).not.toMatch(/visita-0/)
  })

  it('un borrador reciente no desplaza a una firmada: sólo cuentan las firmadas', async () => {
    h.docs.set(`clinics/${CLINICA}/patients/${PACIENTE}/notas/borrador-hoy`, {
      pacienteId: PACIENTE, tipo: 'consulta', estado: 'borrador',
      fechaConsulta: '2026-09-01T09:00:00.000Z', resumenEjecutivo: 'sin-firmar',
    })
    h.docs.set(`clinics/${CLINICA}/patients/${PACIENTE}/notas/firmada-vieja`, {
      pacienteId: PACIENTE, tipo: 'consulta', estado: 'firmada',
      fechaConsulta: '2026-01-01T09:00:00.000Z', resumenEjecutivo: 'si-firmada',
    })
    const r = await getUltimasNotasResumen(CLINICA, PACIENTE)
    expect(r).toMatch(/si-firmada/)
    expect(r).not.toMatch(/sin-firmar/)
  })

  it('sin notas firmadas devuelve vacío — y eso NO es una historia inventada', async () => {
    sembrarHistoria(CLINICA, PACIENTE, 8, () => ({ estado: 'borrador' }))
    expect(await getUltimasNotasResumen(CLINICA, PACIENTE)).toBe('')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('P1-12 · un fallo de lectura NO es un expediente vacío', () => {
  it('`listarNotasPagina` propaga el fallo en vez de devolver cero notas', async () => {
    sembrarHistoria(CLINICA, PACIENTE, 30)
    h.fallar = true
    await expect(listarNotasPagina(CLINICA, PACIENTE)).rejects.toThrow(/PERMISSION_DENIED/)
  })

  it('`listarNotasCompat` tampoco convierte un fallo en «no hay historia»', async () => {
    sembrarHistoria(CLINICA, PACIENTE, 30)
    h.fallar = true
    await expect(listarNotasCompat(CLINICA, PACIENTE)).rejects.toThrow(/PERMISSION_DENIED/)
  })

  it('el borrado NO se ejecuta si no se pudo comprobar que no hay firmadas', async () => {
    sembrarHistoria(CLINICA, PACIENTE, 5)
    h.fallar = true
    await expect(deletePatientExpediente(CLINICA, PACIENTE)).rejects.toThrow(/PERMISSION_DENIED/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('P1-12 · el aislamiento entre consultorios sigue intacto', () => {
  beforeEach(() => {
    sembrarHistoria(CLINICA, PACIENTE, 30)
    sembrarHistoria(OTRA, PACIENTE, 30, () => ({ marca: 'ajena' }))
  })

  it('la página de un consultorio no trae ni una nota del otro', async () => {
    const pagina = await listarNotasPagina(CLINICA, PACIENTE, { limite: 100 })
    expect(pagina.notas).toHaveLength(30)
    expect(pagina.notas.some(n => (n as unknown as { marca?: string }).marca === 'ajena')).toBe(false)
    expect(h.consultas.every(c => c.ruta.startsWith(`clinics/${CLINICA}/`))).toBe(true)
  })

  it('el cursor de un consultorio no abre la historia del otro', async () => {
    const p1 = await listarNotasPagina(CLINICA, PACIENTE, { limite: 10 })
    const p2 = await listarNotasPagina(OTRA, PACIENTE, { limite: 100, cursor: p1.cursor })
    expect(p2.notas.every(n => (n as unknown as { marca?: string }).marca === 'ajena')).toBe(true)
  })

  it('el conteo de firmadas se hace dentro del consultorio pedido', async () => {
    h.consultas.length = 0
    await contarNotasFirmadas(OTRA, PACIENTE)
    expect(h.consultas.every(c => c.ruta === `clinics/${OTRA}/patients/${PACIENTE}/notas`)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('P1-12 · ninguna nota ni transcripción se pierde por el camino', () => {
  it('lo que se lee llega ENTERO: las dos transcripciones incluidas', async () => {
    h.docs.set(`clinics/${CLINICA}/patients/${PACIENTE}/notas/n1`, {
      pacienteId: PACIENTE, tipo: 'consulta', estado: 'firmada',
      fechaConsulta: '2026-04-01T09:00:00.000Z',
      transcripcionMotor: 'lo que oyó el reconocedor',
      transcripcionCruda: 'el texto de trabajo del médico',
    })
    const [nota] = (await listarNotasPagina(CLINICA, PACIENTE)).notas
    expect(nota.transcripcionMotor).toBe('lo que oyó el reconocedor')
    expect(nota.transcripcionCruda).toBe('el texto de trabajo del médico')
  })

  it('leer la historia no ESCRIBE nada: ninguna nota desaparece de la base', async () => {
    sembrarHistoria(CLINICA, PACIENTE, 200)
    const antes = h.docs.size
    await listarNotasCompat(CLINICA, PACIENTE)
    await listarNotasDeInternamiento(CLINICA, PACIENTE, 'ing-1')
    await contarNotasFirmadas(CLINICA, PACIENTE)
    expect(h.docs.size).toBe(antes)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('P1-12 · «cargar más» acumula sin duplicar y sin perder', () => {
  /** Lo que hace el hook al pulsar «cargar más»: unión por id sobre el cursor. */
  async function acumular(paginas: number, limite: number) {
    const acumuladas: string[] = []
    const vistos = new Set<string>()
    let cursor: CursorNotas | null = null
    let hayMas = true
    for (let i = 0; i < paginas && hayMas; i++) {
      const pagina: Awaited<ReturnType<typeof listarNotasPagina>> =
        await listarNotasPagina(CLINICA, PACIENTE, { limite, cursor })
      for (const n of pagina.notas) if (!vistos.has(n.id)) { vistos.add(n.id); acumuladas.push(n.id) }
      cursor = pagina.cursor
      hayMas = pagina.hayMas
    }
    return { acumuladas, hayMas }
  }

  it('cinco páginas seguidas: ni una repetida, ni una perdida', async () => {
    sembrarHistoria(CLINICA, PACIENTE, 50)
    const { acumuladas } = await acumular(5, 10)
    expect(acumuladas).toHaveLength(50)
    expect(new Set(acumuladas).size).toBe(50)
  })

  it('EL CASO DEL BORDE: una nota creada ENTRE dos páginas no se duplica', async () => {
    /**
     * El médico firma una nota mientras el expediente está abierto. La nota
     * nueva es la más reciente, así que entra por la primera página del orden
     * descendente — y podría volver a aparecer en la página siguiente si la
     * acumulación fuera un `concat` a secas. La unión por id lo impide.
     */
    sembrarHistoria(CLINICA, PACIENTE, 30)
    const p1 = await listarNotasPagina(CLINICA, PACIENTE, { limite: 10 })
    h.docs.set(`clinics/${CLINICA}/patients/${PACIENTE}/notas/${p1.notas[3].id}`, {
      ...(h.docs.get(`clinics/${CLINICA}/patients/${PACIENTE}/notas/${p1.notas[3].id}`)!),
      resumenEjecutivo: 'editada mientras se leía',
    })
    const p2 = await listarNotasPagina(CLINICA, PACIENTE, { limite: 10, cursor: p1.cursor })
    const union = [...p1.notas.map(n => n.id), ...p2.notas.map(n => n.id).filter(id => !p1.notas.some(n => n.id === id))]
    expect(new Set(union).size).toBe(union.length)
  })

  it('el hook une por id y NO borra lo cargado cuando falla pedir más', () => {
    const src = readFileSync('src/hooks/useExpediente.ts', 'utf8')
    // Unión por id, no `concat` a secas.
    expect(src).toMatch(/const vistos = new Set\(prev\.map\(n => n\.id\)\)/)
    // El cursor vive en una ref: dos pulsaciones seguidas no piden la misma página.
    expect(src).toMatch(/cursorRef/)
    expect(src).toMatch(/enVueloRef/)
    // Y el `catch` de `cargarMas` no toca `notas` ni `hayMas`.
    const cargarMas = src.slice(src.indexOf('const cargarMas'), src.indexOf('asegurarHistoriaCompleta'))
    const catchMas = cargarMas.slice(cargarMas.indexOf('} catch'))
    expect(catchMas).not.toMatch(/setNotas\(/)
    expect(catchMas).not.toMatch(/setHayMas\(/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('P1-12 · el guardián sabe fallar (probado al revés)', () => {
  it('el criterio de «acotada» rechaza la implementación ANTERIOR', () => {
    /**
     * Se le da el criterio a la fuente que se acaba de retirar. Si esto no
     * fallara, las aserciones de arriba no probarían nada.
     */
    const antes = `export async function getNotas(clinicId: string, patientId: string) {
      const snap = await getDocs(query(notasCol(clinicId, patientId), orderBy('fechaConsulta', 'desc')))
      return snap.docs.map(d => normNota(d.data(), d.id))
    }`
    expect(/limitarA\(/.test(antes)).toBe(false)
    expect(/startAfter\(/.test(antes)).toBe(false)
    expect(/documentId\(\)/.test(antes)).toBe(false)
  })

  it('la fuente de HOY sí cumple ese criterio, y no queda ningún `getDocs` sin tope', () => {
    const src = readFileSync('src/lib/expediente/firestore.ts', 'utf8')
    /**
     * Toda consulta a la subcolección de notas lleva su tope: o `limitarA(` en
     * la misma expresión, o la lista `restricciones` que se arma justo encima.
     */
    const consultas = [...src.matchAll(/getDocs\(query\(\s*notasCol\([^)]*\),([\s\S]*?)\)\)/g)]
    expect(consultas.length).toBeGreaterThanOrEqual(3)
    for (const m of consultas) {
      expect(m[1]).toMatch(/limitarA\(|\.\.\.restricciones/)
    }
    // Y toda lista `restricciones` que se arme aquí termina empujando un tope:
    // si alguien añadiera una sin él, este conteo dejaría de cuadrar.
    const listas = [...src.matchAll(/const restricciones: QueryConstraint\[\]/g)].length
    const topes = [...src.matchAll(/restricciones\.push\(limitarA\(/g)].length
    expect(topes).toBe(listas)
  })

  it('las cinco pantallas dejaron de pedir la historia completa', () => {
    const fuentes: [string, RegExp][] = [
      ['src/app/(dashboard)/hospitalizacion/[internamientoId]/page.tsx', /listarNotasDeInternamiento\(/],
      ['src/app/(dashboard)/referencia/[patientId]/page.tsx', /listarNotasCompat\(/],
      ['src/app/(dashboard)/cumplimiento/retencion/page.tsx', /listarNotasPagina\(/],
      ['src/app/(dashboard)/consulta/[patientId]/page.tsx', /listarNotasCompat\(/],
      ['src/hooks/useExpediente.ts', /listarNotasPagina\(/],
    ]
    for (const [ruta, esperado] of fuentes) {
      const src = readFileSync(ruta, 'utf8')
      expect(src, ruta).toMatch(esperado)
      // La llamada, no la mención: los comentarios que cuentan la historia del
      // defecto siguen nombrando a `getNotas()` a propósito.
      expect(src, ruta).not.toMatch(/getNotas\(clinicId/)
    }
  })

  it('y cada una DECLARA el recorte donde el médico lo lee', () => {
    const dice: [string, RegExp][] = [
      ['src/app/(dashboard)/hospitalizacion/[internamientoId]/page.tsx', /ésta no es la lista completa/],
      ['src/app/(dashboard)/referencia/[patientId]/page.tsx', /hay notas anteriores que no se han mirado/],
      // Y la nota pedida que no existe NO se sustituye por otra en silencio.
      ['src/app/(dashboard)/referencia/[patientId]/page.tsx', /no se encontró en este paciente/],
      ['src/app/(dashboard)/cumplimiento/retencion/page.tsx', /al menos /],
      ['src/app/(dashboard)/consulta/[patientId]/page.tsx', /puede haber fármacos de notas anteriores que no aparecen aquí/],
      ['src/app/(dashboard)/expediente/[patientId]/page.tsx', /todavía no se ha cargado/],
    ]
    for (const [ruta, frase] of dice) {
      expect(readFileSync(ruta, 'utf8'), ruta).toMatch(frase)
    }
  })

  it('la exportación FHIR pide la historia completa EXPLÍCITAMENTE', () => {
    const src = readFileSync('src/app/(dashboard)/expediente/[patientId]/page.tsx', 'utf8')
    expect(src).toMatch(/asegurarHistoriaCompleta\(\)/)
    // Y el bundle se arma con esa historia, no con la página visible.
    expect(src).toMatch(/exportarPacienteAFhir\(\{ paciente: patient, notas: notasExportadas, config \}\)/)
  })
})
