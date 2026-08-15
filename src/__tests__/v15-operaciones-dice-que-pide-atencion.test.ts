/**
 * GOLDEN — `/operaciones` tiene que decir QUÉ PIDE ATENCIÓN, no sólo a dónde ir.
 *
 * ── QUÉ FALLABA ────────────────────────────────────────────────────────────
 *
 * `/operaciones` era un índice: ocho grupos de enlaces con su `para`. Honesto y
 * útil para navegar, pero **idéntico en todos los consultorios**: el que tiene
 * cinco citas sin responder desde el jueves y el que está al día veían la misma
 * pantalla, píxel por píxel. La re-puntuación §29 del 14-ago lo dejó en 2.0 con
 * ese diagnóstico dicho por su nombre («dejó de ser un lanzador» — pero seguía
 * sin decir nada del consultorio que lo abre).
 *
 * ── CÓMO SE DESCUBRIÓ ──────────────────────────────────────────────────────
 *
 * Midiendo el esqueleto de la pantalla en navegador real
 * (`scripts/design/medir-encuentro-v29.mjs`, 15-ago, 1440×900 y 390×844): ocho
 * bloques, todos con encabezado de grupo, todos con enlaces, **cero controles
 * que reaccionen a un dato**. El acta vive en
 * `docs/design/capturas/v15-encuentro-v29/acta-antes.json`.
 *
 * ── LA CAUSA RAÍZ ──────────────────────────────────────────────────────────
 *
 * No faltaba diseño: faltaba **estado**. Los datos con los que se contesta «qué
 * pide atención» ya estaban guardados —citas sin responder, lista de espera,
 * existencias— y ninguna pantalla los miraba juntos.
 *
 * ── LA REGLA QUE LO HACE SEGURO ────────────────────────────────────────────
 *
 * Tres, y las tres se prueban aquí:
 *
 *  1. **No se inventa nada.** Toda línea sale de contar documentos existentes.
 *     Sin documentos, la pantalla dice que no hay nada — no rellena.
 *  2. **No poder leer NO es estar sano** (regla 4 de seguridad clínica llevada a
 *     lo operativo). `null` ≠ `[]`, y el caso 4 comprueba que jamás se mezclan.
 *  3. **Aquí no se cierra nada**: cada excepción manda a la pantalla con
 *     autoridad, con su detalle delante.
 *
 * ── QUÉ NO CUBRE ───────────────────────────────────────────────────────────
 *
 *  · No prueba el pintado. Que la franja se renderice, que salga ANTES del
 *    índice y que los destinos sean enlaces reales lo prueba
 *    `v15-operaciones-franja-antes-del-indice.test.tsx`.
 *  · No cubre nada clínico: los pendientes del paciente son de `/pendientes` y
 *    de `tareas-clinicas/`. Duplicarlos aquí sería una segunda fuente de verdad.
 *  · No juzga §29. El score lo pone el revisor independiente.
 */
import { describe, it, expect } from 'vitest'
import {
  estadoDeOperaciones,
  DIAS_CADUCIDAD_PROXIMA,
  type EntradaOperaciones,
} from '@/lib/operaciones/estado-de-operaciones'

const HOY = '2026-08-15'
const dia = (n: number) =>
  new Date(Date.parse(HOY + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)

const VACIO: EntradaOperaciones = { citas: [], listaEspera: [], farmacia: [], hoyISO: HOY }

describe('§29 · /operaciones contesta con el estado real del consultorio', () => {
  it('1 · una cita pedida y sin responder es una excepción, con su cuenta y su destino', () => {
    const r = estadoDeOperaciones({
      ...VACIO,
      citas: [
        { estado: 'solicitada', fechaHora: `${dia(1)} 10:00` },
        { estado: 'pendiente-confirmar', fechaHora: `${dia(2)} 11:00` },
        { estado: 'confirmada', fechaHora: `${dia(3)} 12:00` },
      ],
    })
    const citas = r.comprobaciones.find(c => c.id === 'citas')!
    expect(citas.estado).toBe('excepcion')
    expect(citas.cuantos).toBe(2)
    expect(citas.detalle).toContain('1 pedida')
    expect(citas.detalle).toContain('1 sin confirmar')
    // Dónde se actúa: la pantalla que manda, no ésta.
    expect(citas.destino).toBe('/citas')
    expect(r.excepciones.map(c => c.id)).toContain('citas')
  })

  it('2 · una cita vieja sin responder NO revive: el aviso no crece solo con los años', () => {
    const r = estadoDeOperaciones({
      ...VACIO,
      citas: [{ estado: 'solicitada', fechaHora: `${dia(-40)} 10:00` }],
    })
    const citas = r.comprobaciones.find(c => c.id === 'citas')!
    expect(citas.estado).toBe('sin-novedad')
    expect(r.excepciones).toHaveLength(0)
  })

  it('3 · consultorio al día: NADA pide atención, y se dice qué se miró', () => {
    const r = estadoDeOperaciones({
      ...VACIO,
      citas: [{ estado: 'confirmada', fechaHora: `${dia(1)} 09:00` }],
      farmacia: [{ nombre: 'Gasas', cantidad: 30, cantidadMinima: 8, caducidad: dia(700) }],
    })
    expect(r.excepciones).toHaveLength(0)
    expect(r.ciegas).toHaveLength(0)
    // Las tres comprobaciones se hicieron y las tres contestaron.
    expect(r.sanas.map(c => c.id).sort()).toEqual(['citas', 'farmacia', 'lista-espera'])
  })

  it('4 · NO PODER LEER no es estar sano — `null` nunca cae en `sanas`', () => {
    const r = estadoDeOperaciones({ ...VACIO, farmacia: null })
    const far = r.comprobaciones.find(c => c.id === 'farmacia')!
    expect(far.estado).toBe('no-se-pudo-leer')
    expect(r.sanas.map(c => c.id)).not.toContain('farmacia')
    expect(r.ciegas.map(c => c.id)).toEqual(['farmacia'])
    // Y lo dice en voz alta: el silencio de una lectura rota no puede leerse
    // como consultorio en orden.
    expect(far.detalle).toMatch(/no se sabe/i)
  })

  it('5 · una lectura rota no calla a las demás', () => {
    const r = estadoDeOperaciones({
      ...VACIO,
      citas: null,
      listaEspera: [{ id: 'w1' }, { id: 'w2' }],
    })
    expect(r.ciegas.map(c => c.id)).toEqual(['citas'])
    const espera = r.comprobaciones.find(c => c.id === 'lista-espera')!
    expect(espera.estado).toBe('excepcion')
    expect(espera.cuantos).toBe(2)
    expect(espera.detalle).toMatch(/2 personas esperan/)
  })

  it('6 · farmacia: caducado, por caducar y bajo mínimo se cuentan y se NOMBRAN', () => {
    const r = estadoDeOperaciones({
      ...VACIO,
      farmacia: [
        { nombre: 'Amoxicilina 500 mg', cantidad: 24, cantidadMinima: 6, caducidad: dia(-3) },
        { nombre: 'Lidocaína 2%', cantidad: 10, cantidadMinima: 2, caducidad: dia(DIAS_CADUCIDAD_PROXIMA - 1) },
        { nombre: 'Jeringas 5 mL', cantidad: 12, cantidadMinima: 20, caducidad: dia(600) },
        { nombre: 'Gasas', cantidad: 30, cantidadMinima: 8, caducidad: dia(700) },
      ],
    })
    const far = r.comprobaciones.find(c => c.id === 'farmacia')!
    expect(far.estado).toBe('excepcion')
    expect(far.cuantos).toBe(3)
    expect(far.detalle).toContain('1 caducado')
    expect(far.detalle).toContain('1 bajo mínimo')
    // Un aviso que no dice CUÁL obliga a abrir la pantalla para saber si importa.
    expect(far.detalle).toContain('Amoxicilina 500 mg')
    expect(far.destino).toBe('/farmacia')
  })

  it('7 · un ítem justo en el umbral de caducidad ya cuenta; uno más allá, no', () => {
    const dentro = estadoDeOperaciones({
      ...VACIO,
      farmacia: [{ nombre: 'X', cantidad: 9, cantidadMinima: 1, caducidad: dia(DIAS_CADUCIDAD_PROXIMA) }],
    })
    expect(dentro.comprobaciones.find(c => c.id === 'farmacia')!.estado).toBe('excepcion')

    const fuera = estadoDeOperaciones({
      ...VACIO,
      farmacia: [{ nombre: 'X', cantidad: 9, cantidadMinima: 1, caducidad: dia(DIAS_CADUCIDAD_PROXIMA + 1) }],
    })
    expect(fuera.comprobaciones.find(c => c.id === 'farmacia')!.estado).toBe('sin-novedad')
  })

  it('8 · cantidad IGUAL al mínimo ya es bajo mínimo — el borde se prueba, no se supone', () => {
    const r = estadoDeOperaciones({
      ...VACIO,
      farmacia: [{ nombre: 'Jeringas', cantidad: 20, cantidadMinima: 20 }],
    })
    expect(r.comprobaciones.find(c => c.id === 'farmacia')!.estado).toBe('excepcion')
  })

  it('9 · inventario vacío NO se declara sano: se declara «no aplica»', () => {
    const r = estadoDeOperaciones(VACIO)
    const far = r.comprobaciones.find(c => c.id === 'farmacia')!
    expect(far.estado).toBe('no-aplica')
    expect(r.sanas.map(c => c.id)).not.toContain('farmacia')
    expect(r.noAplican.map(c => c.id)).toEqual(['farmacia'])
  })

  it('10 · TODA comprobación dice dónde se actúa, y ninguna acción vive aquí', () => {
    const r = estadoDeOperaciones({
      ...VACIO,
      citas: [{ estado: 'solicitada', fechaHora: `${dia(1)} 10:00` }],
      listaEspera: [{ id: 'w1' }],
      farmacia: null,
    })
    for (const c of r.comprobaciones) {
      expect(c.destino.startsWith('/')).toBe(true)
      expect(c.destinoLabel.length).toBeGreaterThan(2)
      expect(c.detalle.length).toBeGreaterThan(10)
    }
    // Las rutas son las que YA existen y tienen la autoridad. Si alguien
    // inventara aquí una ruta nueva de acción, este caso lo caza.
    expect(r.comprobaciones.map(c => c.destino).sort())
      .toEqual(['/citas', '/farmacia', '/lista-espera'])
  })

  it('11 · el orden de las excepciones pone primero a quien tiene gente esperando', () => {
    const r = estadoDeOperaciones({
      ...VACIO,
      citas: [{ estado: 'solicitada', fechaHora: `${dia(1)} 10:00` }],
      listaEspera: [{ id: 'w1' }],
      farmacia: [{ nombre: 'X', cantidad: 1, cantidadMinima: 5 }],
    })
    expect(r.excepciones.map(c => c.id)).toEqual(['citas', 'lista-espera', 'farmacia'])
  })
})
