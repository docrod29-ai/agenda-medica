/**
 * GOLDEN — el riel de contextos sabe dónde está el médico.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * En `/citas`, `/calendario`, `/asistente` y `/lista-espera` la navegación se
 * apagaba ENTERA: ningún ítem activo y ningún `aria-current` en toda la
 * pantalla, ni en el riel de escritorio ni en la barra inferior del móvil. La
 * agenda —lo que más se usa en un consultorio— era la única familia que no
 * podía contestar «¿dónde estoy?».
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * No leyendo código: con una sonda de Playwright sobre el arnés con sesión,
 * contando `[aria-current="page"]` ruta por ruta a 390 y 1440 px. `/pacientes`
 * y `/pendientes` daban 2; `/citas`, `/calendario`, `/asistente`,
 * `/lista-espera` y `/finanzas` daban 0.
 *
 * ── CAUSA RAÍZ ──────────────────────────────────────────────────────────────
 *
 * No era «faltaba una ruta». La lista de destinos de Operaciones estaba escrita
 * dos veces: completa en `operaciones/page.tsx` (`GRUPOS`, veinte destinos) y
 * recortada a tres en los rieles. Las dos copias habían divergido en diecisiete
 * rutas. `CLAUDE.md`: «Nunca duplicar la fuente de verdad».
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Todo destino que el índice de Operaciones DECLARA tiene que caer en algún
 * contexto de `@/lib/navegacion/contextos`. Si alguien añade una entrada al
 * índice y no la mapea, esto falla — en vez de apagarse la navegación en
 * silencio, que es como estuvo.
 *
 * Es la regla «el dato tiene que LLEGAR» aplicada a la navegación: que el
 * índice ofrezca un destino no basta; el riel tiene que poder encenderse en él.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Con `/citas` fuera de las bases de `hoy`, el primer caso falla; devolviendo
 * `contextoDeRuta` a `pathname === '/dashboard'`, falla el caso de la agenda.
 * Comprobado antes de dar la unidad por hecha.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No comprueba que el contexto elegido sea el CORRECTO para el médico —que
 *   `/finanzas` sea «Operaciones» y no un contexto propio es una decisión de
 *   producto, no un teorema. Sólo exige que alguno lo reclame.
 * · No mira el DOM: que `activo` sea `true` no prueba que se pinte la barra ni
 *   que se emita `aria-current`. Eso se comprobó en navegador y vive en el acta.
 * · `/consultor` y `/antibiograma` salieron del índice en RTC-09 y siguen sin
 *   contexto a propósito; esto no los exige porque el índice no los declara.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { contextoDeRuta, basesDelContexto } from '@/lib/navegacion/contextos'

/** Los destinos que el índice de Operaciones declara, leídos de su fuente. */
function destinosDelIndice(): string[] {
  const src = readFileSync('src/app/(dashboard)/operaciones/page.tsx', 'utf8')
  const grupos = src.slice(src.indexOf('const GRUPOS'), src.indexOf('\n]\n', src.indexOf('const GRUPOS')))
  return [...grupos.matchAll(/href:\s*'([^']+)'/g)].map(m => m[1])
}

describe('el riel sabe dónde estás', () => {
  it('la familia de la agenda pertenece al contexto del día', () => {
    for (const ruta of ['/dashboard', '/citas', '/calendario', '/asistente', '/lista-espera']) {
      expect(contextoDeRuta(ruta), ruta).toBe('hoy')
    }
  })

  it('cada destino declarado por el índice de Operaciones cae en un contexto', () => {
    const destinos = destinosDelIndice()
    // Si el índice deja de leerse, esto pasaría por vacío y no probaría nada.
    expect(destinos.length).toBeGreaterThanOrEqual(15)
    const huerfanos = destinos.filter(d => contextoDeRuta(d) === null)
    expect(huerfanos, `destinos del índice sin contexto: ${huerfanos.join(', ')}`).toEqual([])
  })

  it('la pertenencia es por segmento, no por prefijo de texto', () => {
    // `/citas` no debe tragarse una pantalla futura que sólo comparta letras.
    expect(contextoDeRuta('/citaciones')).not.toBe('hoy')
    expect(contextoDeRuta('/citas/abc')).toBe('hoy')
  })

  it('un encuentro gana al paciente aunque hable de un paciente', () => {
    expect(contextoDeRuta('/consulta/pac-001')).toBe('encuentro')
    expect(contextoDeRuta('/pacientes')).toBe('paciente')
  })

  it('una ruta que nadie reclama lo dice, en vez de fingir un contexto', () => {
    expect(contextoDeRuta('/ruta-que-no-existe')).toBeNull()
  })

  it('los dos rieles preguntan a esta tabla y no reconstruyen la suya', () => {
    for (const archivo of ['src/components/FlowRail.tsx', 'src/components/BottomNav.tsx']) {
      const src = readFileSync(archivo, 'utf8')
      // Sin la línea de import: `toContain` se cumpliría con sólo importarlo,
      // que es exactamente el defecto de «escrito y sin conectar».
      const cuerpo = src.split('\n').filter(l => !l.trimStart().startsWith('import ')).join('\n')
      expect(cuerpo, archivo).toContain('contextoDeRuta(')
      // Y no vuelve a decidir «Operaciones» por su cuenta.
      expect(cuerpo, archivo).not.toContain("startsWith('/configuracion')")
    }
  })

  it('el contexto del día declara la familia completa, no sólo el tablero', () => {
    expect(basesDelContexto('hoy')).toEqual(
      expect.arrayContaining(['/dashboard', '/citas', '/calendario', '/asistente', '/lista-espera']),
    )
  })
})
