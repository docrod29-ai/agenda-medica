import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * REG-337 — UN RESULTADO DE CONSULTORIO QUE NADIE REVISA.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `guardarPanelLab` archivaba la hoja de laboratorio en el expediente y ahí se
 * acababa: no nacía ningún pendiente, nadie quedaba como dueño, no había fecha
 * de vencimiento y el panel no llevaba forma de saber si alguien lo había
 * mirado. En la práctica, **que el resultado existiera contaba como que alguien
 * lo había leído**.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Auditando WS-11 del Master Loop: `tareaDeResultado()` aparecía llamada sólo
 * desde `lib/hospital/firestore.ts`. REG-252 había encontrado exactamente esta
 * fuga —la función escrita, probada y sin llamar— y la cerró **en el camino
 * hospitalario**, creyendo que ése era el cuello de botella de los dos caminos
 * de entrada. Lo era del módulo de hospital, no del producto: el camino
 * ambulatorio, que es la prioridad comercial, se quedó fuera.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * No fue un olvido de la pantalla: fue arreglar el bucle en UN escritor y dar
 * por hecho que era el único. Por eso este golden mide el ESCRITOR ambulatorio
 * y no el componente — si mañana entra un resultado por una importación o por
 * un webhook del laboratorio, pasa por aquí y hereda el bucle.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Guardar un resultado ABRE un pendiente de revisión. Si el pendiente no se
 * puede abrir, la cuenta lo dice y quien llama avisa: un pendiente que no nació
 * no se calla, porque el silencio se lee como éxito.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · No prueba que el médico VEA la tarea: eso es el worklist, y hoy
 *   `tareasVivas()` usa `limit(200)` SIN `orderBy` (P1-4 del tablero), así que
 *   por encima de 200 tareas vivas ésta puede no aparecer. Esta prueba no lo
 *   cubre y el defecto queda abierto en su ficha.
 * · No prueba `firestore.rules`.
 * · No cubre `acted_on` ni `patient_notified`: esos estados NO EXISTEN todavía
 *   en el modelo (`progreso-resultado.ts` los declara `sin_dato`). Aquí se mide
 *   que el resultado deja de contarse como revisado por el mero hecho de estar.
 * · Datos SINTÉTICOS: cero pacientes reales.
 */

const almacen = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  /** Cuando es true, toda escritura de tarea revienta: el fallo tiene que verse. */
  romperTareas: { valor: false },
}))

vi.mock('firebase/firestore', () => {
  const ruta = (partes: unknown[]) => partes.filter(p => typeof p === 'string').join('/')
  const esTarea = (r: string) => r.includes('/tareas_clinicas')
  return {
    collection: (_db: unknown, ...partes: string[]) => ({ __ruta: ruta(partes) }),
    doc: (padre: { __ruta: string }, id: string) => ({ __ruta: `${padre.__ruta}/${id}`, id }),
    getDoc: async (ref: { __ruta: string }) => ({
      exists: () => almacen.docs.has(ref.__ruta),
      data: () => almacen.docs.get(ref.__ruta),
    }),
    setDoc: async (ref: { __ruta: string }, data: Record<string, unknown>) => {
      if (almacen.romperTareas.valor && esTarea(ref.__ruta)) throw new Error('firestore caído')
      almacen.docs.set(ref.__ruta, data)
    },
    addDoc: async (c: { __ruta: string }, data: Record<string, unknown>) => {
      if (almacen.romperTareas.valor && esTarea(c.__ruta)) throw new Error('firestore caído')
      const id = `auto-${almacen.docs.size}`
      almacen.docs.set(`${c.__ruta}/${id}`, data)
      return { __ruta: `${c.__ruta}/${id}`, id }
    },
    getDocs: async () => ({ docs: [] }),
    deleteDoc: async () => {},
    query: (c: unknown) => c,
    orderBy: () => ({}),
    where: () => ({}),
    limit: () => ({}),
  }
})

vi.mock('@/lib/firebase', () => ({ db: {}, auth: { currentUser: { uid: 'medico-sintetico' } } }))
vi.mock('@/lib/expediente/audit-log', () => ({ logAudit: async () => {} }))

const { guardarPanelLab } = await import('@/lib/expediente/laboratorio/firestore')
const { dictaminarSujeto, vinculoDeSujeto } = await import('@/lib/expediente/laboratorio/sujeto')

const CLINICA = 'clinica-sintetica-1'
const A = { clinicId: CLINICA, patientId: 'pac-A', nombre: 'María Fernanda López García' }
const AHORA = '2026-08-26T10:00:00.000Z'

const analito = (clave: string, etiqueta: string, valor: number, critico = false) =>
  ({ clave, etiqueta, valor, unidad: 'mg/dL', critico, graficable: true })

const PANEL_NORMAL = {
  fecha: '2026-08-20',
  resultados: [analito('glucosa', 'Glucosa', 92)],
  fuente: 'pdf' as const,
}

const PANEL_CRITICO = {
  fecha: '2026-08-21',
  resultados: [analito('glucosa', 'Glucosa', 92), analito('potasio', 'Potasio', 7.4, true)],
  fuente: 'pdf' as const,
}

const vinculo = () => vinculoDeSujeto(
  dictaminarSujeto([{ nombre: A.nombre }], A), A, false, AHORA,
)

const tareas = () => [...almacen.docs.entries()]
  .filter(([k]) => k.includes('/tareas_clinicas/'))
  .map(([, v]) => v as Record<string, unknown>)

beforeEach(() => { almacen.docs.clear(); almacen.romperTareas.valor = false })

describe('REG-337 · guardar un resultado abre su pendiente de revisión', () => {
  it('EL DEFECTO: archivar la hoja dejaba CERO pendientes', async () => {
    const r = await guardarPanelLab(CLINICA, 'pac-A', PANEL_NORMAL, vinculo(), 'k1')
    // Sin el arreglo esto valía 0 y la prueba falla: es la aserción que lo prueba al revés.
    expect(r.tareasEsperadas).toBe(1)
    expect(r.tareasCreadas).toBe(1)
    expect(tareas()).toHaveLength(1)
  })

  it('la tarea nace SIN revisar, con dueño y con vencimiento', async () => {
    await guardarPanelLab(CLINICA, 'pac-A', PANEL_NORMAL, vinculo(), 'k1')
    const t = tareas()[0]
    expect(t.tipo).toBe('resultado_por_revisar')
    expect(t.estado).toBe('solicitada')
    expect(t.patientId).toBe('pac-A')
    expect(t.ownerUid).toBe('medico-sintetico')
    expect(typeof t.venceEn).toBe('string')
  })

  it('un valor crítico sube la prioridad y NOMBRA el analito', async () => {
    await guardarPanelLab(CLINICA, 'pac-A', PANEL_CRITICO, vinculo(), 'k1')
    const t = tareas()[0]
    expect(t.prioridad).toBe('critica')
    expect(String(t.detalle)).toContain('Potasio')
    // No nombra lo que no es crítico: el detalle sirve para triar, no para repetir la hoja.
    expect(String(t.detalle)).not.toContain('Glucosa')
  })

  it('sin ningún valor crítico la prioridad NO se infla', async () => {
    await guardarPanelLab(CLINICA, 'pac-A', PANEL_NORMAL, vinculo(), 'k1')
    expect(tareas()[0].prioridad).toBe('alta')
  })

  it('UNA hoja de veinte analitos deja UNA tarea, no veinte', async () => {
    const panel = {
      fecha: '2026-08-22',
      resultados: Array.from({ length: 20 }, (_, i) => analito(`a${i}`, `Analito ${i}`, i)),
      fuente: 'pdf' as const,
    }
    const r = await guardarPanelLab(CLINICA, 'pac-A', panel, vinculo(), 'k1')
    expect(r.tareasCreadas).toBe(1)
    expect(tareas()).toHaveLength(1)
  })

  it('el nombre leído de la hoja NO viaja a la tarea', async () => {
    await guardarPanelLab(CLINICA, 'pac-A', PANEL_NORMAL, vinculo(), 'k1')
    expect(JSON.stringify(tareas())).not.toMatch(/LOPEZ|López|Maria|María/)
  })

  it('el reintento de la misma intención NO abre un segundo pendiente', async () => {
    await guardarPanelLab(CLINICA, 'pac-A', PANEL_NORMAL, vinculo(), 'intento-1')
    const segundo = await guardarPanelLab(CLINICA, 'pac-A', PANEL_NORMAL, vinculo(), 'intento-1')
    expect(segundo.tareasEsperadas).toBe(0)
    expect(tareas()).toHaveLength(1)
  })

  it('una hoja sin resultados legibles no fabrica un pendiente vacío', async () => {
    const r = await guardarPanelLab(
      CLINICA, 'pac-A', { ...PANEL_NORMAL, resultados: [] }, vinculo(), 'k1',
    )
    expect(r.tareasEsperadas).toBe(0)
    expect(tareas()).toHaveLength(0)
  })
})

describe('REG-337 · un pendiente que no nació NO se calla', () => {
  it('si la tarea no se puede escribir, el laboratorio se guarda y la cuenta lo delata', async () => {
    almacen.romperTareas.valor = true
    const r = await guardarPanelLab(CLINICA, 'pac-A', PANEL_NORMAL, vinculo(), 'k1')
    // El resultado NO se pierde: perderlo sería peor que el defecto que se repara.
    expect([...almacen.docs.keys()].some(k => k.includes('/laboratorios/'))).toBe(true)
    // Y el fallo es VISIBLE, que es lo que REG-252 enseñó a no dar por hecho.
    expect(r.tareasEsperadas).toBe(1)
    expect(r.tareasCreadas).toBe(0)
    expect(r.tareasCreadas).toBeLessThan(r.tareasEsperadas)
  })
})
