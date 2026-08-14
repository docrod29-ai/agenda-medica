/**
 * `/pendientes` gana «closed recently» — V15-FOLLOWUP-WORK-001 (Fase 7, §10),
 * segunda rebanada.
 *
 * QUÉ FALLABA: de las ocho categorías de §10, «closed recently» era la única
 * que ni siquiera tenía función pura ni lectura propia — `tareasVivas()`
 * excluye `cerrada` a propósito (es el worklist de lo VIVO), así que no había
 * forma de ver, desde `/pendientes`, qué se cerró hace poco.
 *
 * CÓMO SE DESCUBRIÓ: era la «siguiente tarea exacta» dejada por la corrida
 * anterior en `agent-state/V15_CURRENT_ITERATION.md` — la primera rebanada de
 * esta fase ya había resuelto cinco de las ocho categorías y documentado ésta
 * como pendiente, no como olvido.
 *
 * CAUSA RAÍZ: `tareasVivas()` es, por diseño, la ÚNICA fuente que
 * `/pendientes` leía. «Closed recently» necesita una consulta APARTE —igual
 * de real que `tareasDePaciente`— que nadie había escrito.
 *
 * LA REGLA QUE LO HACE SEGURO:
 *  1. `tareasCerradasRecientes()` filtra por `estado === 'cerrada'` —nunca
 *     `cancelada`, que es un cierre semánticamente distinto («ya no aplica»)—
 *     y vive en el mismo módulo que `tareasVivas()`, no una consulta inline.
 *  2. `/pendientes` la llama SÓLO dentro de un callback (`verCerradas`), no
 *     dentro del `useEffect` que carga `tareasVivas()` al montar: la pantalla
 *     más visitada del médico no paga esa lectura hasta que la pide.
 *  3. Las tareas cerradas se pintan con un componente de SOLO LECTURA
 *     (`TarjetaCerrada`), no con `Tarjeta` — una tarea `cerrada` no tiene
 *     transición legal a ningún otro estado (`TRANSICIONES.cerrada = []` en
 *     `modelo.ts`), así que ofrecerle a Tarjeta/«Ya no aplica» sería un botón
 *     que `cambiarEstado` va a rechazar.
 *
 * QUÉ NO CUBRE: no verifica el resultado visual (colapsado, orden por fecha)
 * — eso se comprueba en navegador real, con capturas, en la verificación de
 * esta corrida. Tampoco reemplaza `tareas-clinicas-modelo.test.ts`, que ya
 * prueba que `cerrada` no admite transiciones.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const FIRESTORE = leer('src/lib/tareas-clinicas/firestore.ts')
const PAGINA = leer('src/app/(dashboard)/pendientes/page.tsx')

describe('tareasCerradasRecientes() — módulo, no consulta inline', () => {
  it('existe y filtra por estado === cerrada, nunca por cancelada', () => {
    expect(FIRESTORE).toMatch(/export async function tareasCerradasRecientes/)
    const cuerpo = FIRESTORE.slice(FIRESTORE.indexOf('export async function tareasCerradasRecientes'))
    const finCuerpo = cuerpo.indexOf('\nexport ', 1)
    const fn = finCuerpo === -1 ? cuerpo : cuerpo.slice(0, finCuerpo)
    expect(fn).toMatch(/where\(\s*['"]estado['"]\s*,\s*['"]==['"]\s*,\s*['"]cerrada['"]\s*\)/)
    expect(fn).not.toMatch(/cancelada/)
  })
})

describe('/pendientes — closed recently conectado, no huérfano', () => {
  it('importa tareasCerradasRecientes del mismo módulo que tareasVivas', () => {
    expect(PAGINA).toContain(
      "import { tareasVivas, tareasCerradasRecientes, cambiarEstado } from '@/lib/tareas-clinicas/firestore'",
    )
  })

  it('NO se llama dentro del useEffect que carga tareasVivas al montar', () => {
    const inicioEffect = PAGINA.indexOf('useEffect(() => {')
    const finEffect = PAGINA.indexOf('}, [clinicId, recarga])')
    expect(inicioEffect).toBeGreaterThan(-1)
    expect(finEffect).toBeGreaterThan(inicioEffect)
    const cuerpoEffect = PAGINA.slice(inicioEffect, finEffect)
    expect(cuerpoEffect).not.toContain('tareasCerradasRecientes')
  })

  it('se llama dentro de un callback aparte (bajo demanda)', () => {
    expect(PAGINA).toMatch(/const verCerradas = useCallback\(async \(\) => \{[\s\S]*?tareasCerradasRecientes\(clinicId\)/)
  })

  it('las tareas cerradas se pintan con un componente de sólo lectura, no con Tarjeta', () => {
    /**
     * AJUSTADO A LA FORMA NUEVA, NO RELAJADO. `TarjetaCerrada` pasó de ser una
     * arrow declarada DENTRO de `PendientesPage` a una función de módulo,
     * porque la medición en navegador real demostró que declararla en el render
     * remontaba la lista entera en cada `setState` — y con ella se perdían el
     * `aria-expanded` y la vuelta del foco de §21. La vara sigue midiendo lo
     * mismo (una cerrada NO se pinta con `Tarjeta`, y no ofrece acciones que
     * `cambiarEstado` va a rechazar); lo que cambia es cómo se declara.
     */
    expect(PAGINA).toMatch(/^function TarjetaCerrada\(/m)
    expect(PAGINA).toMatch(/cerradas\.map\(t => <TarjetaCerrada key=\{t\.id\}/)
    const inicio = PAGINA.indexOf('function TarjetaCerrada(')
    const fin = PAGINA.indexOf('export default function PendientesPage', inicio)
    const cuerpo = PAGINA.slice(inicio, fin)
    expect(cuerpo.length).toBeGreaterThan(200)
    expect(cuerpo).not.toContain('Ya no aplica')
    expect(cuerpo).not.toContain('siguientePaso')
  })
})
