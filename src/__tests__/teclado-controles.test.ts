/**
 * TRINQUETE DE TECLADO — lo que se puede hacer con el ratón se puede hacer sin él.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * 24 sitios tenían un `<div onClick={…}>` sin nada más. Para el ratón es un
 * botón; para el teclado **no existe**: no recibe foco, no responde a Enter, y un
 * lector de pantalla lo anuncia como un párrafo.
 *
 * La auditoría lo buscó en la propaganda —«las pantallas del comprador son las
 * peores»— y ahí **no había ninguno**. Estaban todos en las pantallas de trabajo:
 * el CALENDARIO (cinco: la cita, la franja, el día, el hueco), la lista de
 * PACIENTES, el tablero de CAMAS, el pase de UCI, la hoja de enfermería y las
 * FILAS de tabla — este último en `ui/Table.tsx`, compartido, así que arrastraba
 * a todas las tablas de la aplicación de una vez.
 *
 * Densidad de estilos no es lo mismo que daño. El daño estaba al lado.
 *
 * ── LAS TRES FAMILIAS, QUE NO SE TRATAN IGUAL ────────────────────────────────
 *
 * 1. **CONTROL** — un elemento que hace algo al pulsarlo. Necesita `role`,
 *    `tabIndex` y Enter/Espacio: `activable()` los pone los cuatro juntos,
 *    porque «acuérdate de añadir también el `onKeyDown`» es la clase de regla
 *    que se cumple en cinco pantallas y se olvida en la sexta.
 *
 * 2. **TELÓN** — `position: fixed; inset: 0` con un `onClick` que cierra. NO es
 *    un control: es una comodidad del ratón. Darle foco crearía una parada de
 *    tabulador fantasma, un rectángulo invisible que atrapa sin decir qué es. Lo
 *    que el teclado espera es que **Escape** cierre, y en cuatro sitios no
 *    cerraba nada: el modal de laboratorios, el filtro de médicos, el menú de la
 *    cita y la barra lateral móvil.
 *
 * 3. **ESCUDO** — un `onClick={e => e.stopPropagation()}` **sin acción propia**,
 *    puesto para que el clic no llegue al telón de detrás. No hace nada, así que
 *    no hay nada que activar con el teclado. Exigirle `tabIndex` sería añadir
 *    ruido y empujar a quitar el escudo, que sí hace falta.
 *
 * Un guardián que no distingue las tres acaba desactivado por ruidoso.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { POR_QUE_EL_TELON_NO_LLEVA_FOCO } from '@/lib/ui/activable'

function fuentes(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) { if (e !== '__tests__') fuentes(p, out); continue }
    if (e.endsWith('.tsx')) out.push(p)
  }
  return out
}

const ARCHIVOS = fuentes('src')

/** Apertura de un elemento NO interactivo que lleva `onClick`. */
const CLICABLE = /<(?:div|span|li|td|tr|section|article|p|h[1-6]|img|svg)\b/g

/**
 * La etiqueta ENTERA, no los primeros caracteres.
 *
 * La primera versión de esta prueba cortaba en `onClick=` y clasificaba a
 * ciegas: no veía el `style` de después —así que ningún telón se reconocía como
 * telón— ni el cuerpo del manejador —así que ningún escudo se reconocía como
 * escudo—. Un clasificador que no ve lo que clasifica marca a todo el mundo
 * culpable, y un guardián que marca a todo el mundo se apaga en una semana.
 *
 * Se avanza contando llaves para no cortar en el `>` de una flecha `=>`.
 */
function etiquetaCompleta(s: string, desde: number): string {
  let llaves = 0
  for (let i = desde; i < s.length && i < desde + 4000; i++) {
    const c = s[i]
    if (c === '{') llaves++
    else if (c === '}') llaves--
    else if (c === '>' && llaves === 0) return s.slice(desde, i + 1)
  }
  return s.slice(desde, desde + 4000)
}

/** Ya resuelto: lleva `activable()`, o role/tabIndex/onKeyDown a mano. */
const RESUELTO = /activable\(|onKeyDown|role=|tabIndex/

/** TELÓN: ocupa toda la pantalla. Su deber es que Escape cierre, no tener foco. */
const ES_TELON = /inset:\s*0/

/**
 * ESCUDO: sólo detiene la propagación. No hace nada, no se activa.
 *
 * El paréntesis es opcional a propósito: `(e) => …` y `e => …` son lo mismo, y
 * la primera versión sólo reconocía la segunda — así que el escudo del tour de
 * bienvenida salía marcado como control sin teclado.
 */
const ES_ESCUDO = /onClick=\{\s*\(?\s*e\s*\)?\s*=>\s*\{?[^}]*stopPropagation\(\)[^}]*\}?\s*\}/

describe('el barrido encuentra código de verdad', () => {
  it('si esto se rompe, todo lo de abajo pasaría vacío', () => {
    expect(ARCHIVOS.length).toBeGreaterThan(150)
  })

  it('y el patrón casa contra un caso conocido', () => {
    expect('<div onClick={abrir}>').toMatch(/<div\b[^>]*?onClick=/)
  })
})

describe('todo CONTROL se puede activar con el teclado', () => {
  it('no queda ninguno sin foco ni tecla', () => {
    const culpables: string[] = []
    for (const p of ARCHIVOS) {
      const s = readFileSync(p, 'utf8')
      for (const m of s.matchAll(CLICABLE)) {
        const tag = etiquetaCompleta(s, m.index!)
        if (!/onClick=/.test(tag)) continue
        if (RESUELTO.test(tag) || ES_TELON.test(tag) || ES_ESCUDO.test(tag)) continue
        const linea = s.slice(0, m.index).split('\n').length
        culpables.push(`${p}:${linea}`)
      }
    }
    expect(culpables, `sin teclado:\n${culpables.join('\n')}`).toEqual([])
  })
})

describe('la fila de tabla, que es compartida', () => {
  const tabla = readFileSync(join('src', 'components', 'ui', 'Table.tsx'), 'utf8')

  it('usa el helper y no una copia a mano', () => {
    /**
     * Es el componente del que cuelgan todas las tablas: arreglarlo aquí las
     * arregla todas, y olvidarlo aquí las rompe todas.
     */
    expect(tabla).toContain("import { activable } from '@/lib/ui/activable'")
    expect(tabla).toContain('activable(() => onRowClick(row))')
  })

  it('y sólo cuando la fila hace algo', () => {
    // Una fila que no abre nada no debe ser una parada de tabulador.
    expect(tabla).toContain('onRowClick ? activable(')
  })
})

describe('todo PANEL abierto cierra con Escape', () => {
  const CON_ESCAPE = [
    ['src/components/laboratorio/PanelLaboratorios.tsx', 'revision'],
    ['src/components/DoctorFilter.tsx', 'open'],
    ['src/app/(dashboard)/citas/page.tsx', 'menuId'],
    ['src/app/(dashboard)/layout.tsx', 'sidebarOpen'],
  ] as const

  for (const [ruta, estado] of CON_ESCAPE) {
    it(`${ruta.split('/').pop()} (${estado})`, () => {
      const s = readFileSync(join(...ruta.split('/')), 'utf8')
      expect(s).toContain("useCerrarConEscape")
      expect(s).toMatch(new RegExp(`useCerrarConEscape\\(\\s*!*${estado}`))
    })
  }

  it('está escrito por qué el telón NO lleva foco', () => {
    expect(POR_QUE_EL_TELON_NO_LLEVA_FOCO).toMatch(/tabulador fantasma/)
  })
})

describe('el helper hace las cuatro cosas juntas', () => {
  it('Enter y ESPACIO, no sólo Enter', async () => {
    /**
     * Son las dos teclas que activan un botón nativo. Quedarse con una deja a
     * medias justo a quien esto viene a ayudar. Y la barra se `preventDefault`
     * porque si no la página baja una pantalla entera bajo los dedos.
     */
    const src = readFileSync(join('src', 'lib', 'ui', 'activable.ts'), 'utf8')
    expect(src).toContain("e.key === 'Enter' || e.key === ' '")
    expect(src).toContain('e.preventDefault()')
    expect(src).toContain("role: 'button'")
    expect(src).toContain('tabIndex: 0')
  })

  it('y de verdad devuelve las cuatro', async () => {
    const { activable } = await import('@/lib/ui/activable')
    let veces = 0
    const a = activable(() => { veces++ }, { etiqueta: 'Abrir' })
    expect(a.role).toBe('button')
    expect(a.tabIndex).toBe(0)
    expect((a as { 'aria-label'?: string })['aria-label']).toBe('Abrir')

    const tecla = (key: string) => {
      let prevenido = false
      a.onKeyDown({ key, preventDefault: () => { prevenido = true } } as never)
      return prevenido
    }
    expect(tecla('Enter')).toBe(true)
    expect(tecla(' ')).toBe(true)
    expect(veces).toBe(2)

    // Una tecla cualquiera NO activa: si no, escribir en un campo dispararía todo.
    expect(tecla('a')).toBe(false)
    expect(veces).toBe(2)
  })
})
