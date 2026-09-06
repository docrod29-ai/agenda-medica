/**
 * EL EXPEDIENTE ENSEÑA LOS INGRESOS — REG-261.
 *
 * ── EL HUECO, Y LO DECÍA EL PROPIO CÓDIGO ───────────────────────────────────
 *
 * `getInternamientosDePaciente()` llevaba escrito en su comentario, desde que
 * se escribió:
 *
 *     «Internamientos de UN paciente (para mostrarlos en su expediente).»
 *
 * Y el expediente **no los mostraba**. Sin llamador y **sin prueba** — de los
 * ocho con cuerpo real que dejó el instrumento de REG-255, era el único junto
 * con `obtenerVersion` que no tenía ni eso.
 *
 * ── POR QUÉ NO ES UN DETALLE ────────────────────────────────────────────────
 *
 * La constitución del charter V7 dice, en mayúsculas: **UN PACIENTE · UN
 * EXPEDIENTE LONGITUDINAL**. Un paciente ingresado dos veces tenía esos
 * episodios sólo en la pantalla de hospitalización, a la que se llega por el
 * censo. **Desde su expediente no había forma de saber que existieron.**
 *
 * Las NOTAS de hospital sí aparecían bajo su pestaña. Pero una nota suelta no
 * dice cuándo ingresó, cuántos días estuvo, ni cómo egresó.
 *
 * ── POR QUÉ EL NOMBRE VA SIN «Ñ» ────────────────────────────────────────────
 *
 * Se llamó `…enseña…` y el sello clínico lo dio por huérfano: macOS guarda los
 * nombres de archivo en NFD y el ledger los cita en NFC, así que **la misma
 * palabra no casaba consigo misma**. No es una curiosidad: cualquier compuerta
 * que compare un nombre de archivo con un texto escrito a mano se rompe igual.
 * Los nombres de archivo van en ASCII.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  POR_QUE_EXISTE, POR_QUE_NO_CALCULA_NADA, POR_QUE_NULL_NO_ES_VACIO,
} from '@/components/InternamientosDelPaciente'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const comp = leer('src', 'components', 'InternamientosDelPaciente.tsx')
const page = leer('src/app/(dashboard)/expediente/[patientId]/page.tsx')

describe('la función YA CORRE', () => {
  it('el expediente la importa y la usa', () => {
    expect(page).toContain("import { getInternamientosDePaciente } from '@/lib/hospital/firestore'")
    expect(page).toMatch(/cargar=\{getInternamientosDePaciente\}/)
  })

  it('el panel va ANTES de los filtros de notas', () => {
    /**
     * Saber que estuvo ingresado dos veces es contexto para leer todo lo de
     * abajo, no una pestaña más. Se comprueba por posición.
     */
    const iPanel = page.indexOf('<InternamientosDelPaciente')
    const iFiltros = page.indexOf('{/* Filters */}')
    expect(iPanel).toBeGreaterThan(-1)
    expect(iFiltros).toBeGreaterThan(-1)
    expect(iPanel, 'el panel quedó debajo de los filtros').toBeLessThan(iFiltros)
  })

  it('cada episodio lleva a su ficha', () => {
    expect(page).toMatch(/alAbrir=\{id => router\.push\(`\/hospitalizacion\/\$\{id\}`\)\}/)
  })
})

describe('lo que enseña', () => {
  it('distingue el episodio abierto del cerrado', () => {
    /** «sigue internado» y una fecha de egreso no son lo mismo. */
    expect(comp).toMatch(/const abierto = !i\.fechaEgreso/)
    expect(comp).toContain('sigue internado')
  })

  it('sin datos de ubicación lo dice, en vez de dejar el renglón vacío', () => {
    expect(comp).toMatch(/\|\| 'sin datos de ubicación'/)
  })

  it('el orden lo pone la consulta, no el componente', () => {
    /**
     * `getInternamientosDePaciente` ya ordena por fecha descendente. Reordenar
     * aquí sería una segunda regla de orden para la misma lista.
     */
    expect(comp).not.toMatch(/\.sort\(/)
  })
})

describe('lo que NO hace, y es deliberado', () => {
  it('no calcula días de estancia ni reingresos', () => {
    /**
     * Esos motores existen aparte, con sus reglas y su zona horaria.
     * Recalcularlos aquí sería una segunda verdad para el mismo dato — el
     * defecto que ya costó caro con los umbrales de POCUS (REG-257).
     */
    expect(comp).not.toMatch(/getTime\(\)|86_?400|Math\.(floor|round)\(/)
    expect(POR_QUE_NO_CALCULA_NADA).toMatch(/segunda verdad/)
  })

  it('si la lectura falla NO enseña una lista vacía', () => {
    /**
     * Una lista vacía afirmaría que el paciente nunca estuvo ingresado. `null`
     * es «no se pudo leer», y entonces no se enseña nada.
     */
    /**
     * V15-PATIENT-WORKSPACE-001 (Clinical Spine): el `.catch` ahora también
     * reporta `null` hacia arriba por `onCargadoRef` (para que el riel sepa
     * que la lectura falló, sin abrir una segunda consulta) — mismo
     * comportamiento de "null ≠ vacío", forma de código distinta.
     */
    /**
     * ── ESTA ASERCIÓN SE AMPLIÓ (Panel de Lujo ZC-005) ─────────────────────
     *
     * Antes exigía las dos líneas juntas: que el `catch` guardara `null` y que
     * el `if` de abajo tratara ese `null` como el vacío. Las dos eran ciertas y
     * las dos juntas fijaban el defecto — el componente NO enseñaba una lista
     * vacía, es verdad, pero tampoco enseñaba nada, que para quien mira es lo
     * mismo. El caso se llamaba «no enseña una lista vacía» y comprobaba que no
     * enseñara NADA.
     *
     * Ahora el fallo tiene estado propio y se pinta con `NoSePudoLeer`, antes de
     * cualquier rama de vacío. El orden lo vigila
     * `no-se-pudo-leer-no-es-no-hay-nada.test.ts`.
     */
    expect(comp).toMatch(/setFalloAlLeer\(e \?\? new Error\('lectura fallida'\)\)/)
    expect(comp).toMatch(/onCargadoRef\.current\?\.\(null\)/)
    expect(comp).toMatch(/<NoSePudoLeer[\s\S]*?que="sus ingresos hospitalarios"/)
    expect(comp).toMatch(/if \(!lista \|\| lista\.length === 0\) return null/)
    expect(POR_QUE_NULL_NO_ES_VACIO).toMatch(/nunca estuvo ingresado/)
  })

  it('el efecto depende de VALORES, no del objeto de props', () => {
    /**
     * Con `[p]` se redispara en cada render y relee Firestore sin que nada
     * haya cambiado. Ya lo marcó el compilador en la bandeja de alertas
     * (REG-256); no se repite.
     *
     * ZC-005 añadió `intento` a las dependencias — el contador del botón
     * «Reintentar» — y es una dependencia por VALOR igual que las otras tres:
     * sólo cambia cuando alguien pulsa, no en cada render.
     */
    expect(comp).toMatch(/\}, \[clinicId, patientId, cargar, intento\]\)/)
  })
})

describe('la razón queda escrita', () => {
  it('el comentario de la función pedía esto desde el principio', () => {
    const fs = leer('src', 'lib', 'hospital', 'firestore.ts')
    expect(fs).toMatch(/para mostrarlos en su expediente/)
    expect(POR_QUE_EXISTE).toMatch(/el expediente no los mostraba/)
  })
})
