/**
 * GOLDEN — HOSPITAL Y UCI EN PAUSA (4-sep-2026)
 *
 * QUÉ PASABA: el índice de `/operaciones` abría con un grupo «Hospital y UCI —
 * cuando hay pacientes internados» y el `Sidebar` listaba las dos entradas. Dos
 * productos en ALPHA («se usan, no se venden», CLAUDE.md) compitiendo por la
 * atención del médico con lo único que hoy se vende: la consulta y su agenda.
 *
 * CÓMO SE DESCUBRIÓ: el dueño lo vio en pantalla y pidió quitarlo «y dejarlo
 * guardado para cuando lo vayamos a meter».
 *
 * CAUSA RAÍZ: no había ningún lugar donde decir «esto existe pero no se
 * ofrece». El entitlement (`rutaPermitida`) responde a otra pregunta —qué
 * compró la clínica— y con `paseLibre` el dueño ve TODOS los módulos, así que
 * por ahí no se podía esconder nada sin mentir sobre lo contratado.
 *
 * LA REGLA QUE LO HACE SEGURO: la pausa vive en UNA lista
 * (`MODULOS_EN_PAUSA`), se calcula sobre el catálogo real de módulos, y no
 * borra nada — ni la ruta, ni la página, ni la fila declarada en el menú. Por
 * eso este guardián se prueba AL REVÉS: con la lista vacía, los destinos
 * vuelven. Si alguien «apaga» Hospital borrando las filas en vez de pausarlas,
 * el caso 5 lo caza.
 *
 * QUÉ NO CUBRE:
 * - No es una defensa de seguridad. `/uci` sigue contestando si se escribe la
 *   URL; quien no tenga el módulo sigue rebotando por `rutaPermitida`, ni más
 *   ni menos que antes. Esconder un botón nunca cerró una ruta.
 * - No comprueba que las pantallas de Hospitalización/UCI funcionen: eso lo
 *   cubren sus propias pruebas, que no se tocaron.
 * - No mira el navegador. Que el grupo no se pinte se deduce de que sus dos
 *   destinos se filtran y de que `/operaciones` descarta los grupos vacíos
 *   (`.filter(g => g.items.length > 0)`, verificado en el caso 4).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { MODULOS_EN_PAUSA, RUTAS_EN_PAUSA, rutasEnPausa, enPausa } from '@/lib/navegacion/modulos-en-pausa'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const OPS = leer('src/app/(dashboard)/operaciones/page.tsx')
const SIDEBAR = leer('src/components/Sidebar.tsx')

describe('Hospital y UCI en pausa — hoy no se ofrecen', () => {
  it('1 · la pausa cubre las DOS rutas, y sólo ésas', () => {
    expect([...MODULOS_EN_PAUSA].sort()).toEqual(['hospitalizacion', 'uci'])
    expect([...RUTAS_EN_PAUSA].sort()).toEqual(['/hospitalizacion', '/uci'])
    // Nada del consultorio se coló en la pausa: la agenda y la consulta son la
    // prioridad, no se pausan por descuido.
    for (const viva of ['/citas', '/calendario', '/asistente', '/lista-espera',
      '/pacientes', '/consulta', '/farmacia', '/finanzas', '/crm']) {
      expect(enPausa(viva), `${viva} quedó en pausa y no debía`).toBe(false)
    }
  })

  it('2 · la familia entera queda fuera, no sólo la raíz', () => {
    expect(enPausa('/uci/cama-3')).toBe(true)
    expect(enPausa('/hospitalizacion/episodio/abc')).toBe(true)
    // …sin morder rutas que sólo COMPARTEN prefijo de texto.
    expect(enPausa('/ucixyz')).toBe(false)
  })

  it('3 · AL REVÉS: con la lista vacía los dos destinos vuelven a ofrecerse', () => {
    // Si esto pasara con la lista vacía, la pausa no sería la que esconde nada
    // y el guardián estaría midiendo humo.
    expect(rutasEnPausa([])).toEqual([])
    expect(enPausa('/uci', rutasEnPausa([]))).toBe(false)
    // Y pausar SÓLO hospitalización no basta: el UCI OS reclama `/hospitalizacion`
    // con su propio censo, así que la ruta seguiría ofrecida por él.
    expect(rutasEnPausa(['hospitalizacion'])).toEqual([])
  })

  it('4 · las dos superficies de navegación CONSUMEN la pausa', () => {
    // «Escrito y sin conectar» es la familia de defecto más cara del ledger:
    // una lista de pausa que nadie filtra deja el menú igual que estaba.
    expect(OPS).toContain("from '@/lib/navegacion/modulos-en-pausa'")
    expect(OPS).toMatch(/!enPausa\(it\.href\)/)
    // Un grupo sin destinos no se pinta: así desaparece la cabecera «Hospital y
    // UCI» además de sus dos filas.
    expect(OPS).toMatch(/\.filter\(g => g\.items\.length > 0\)/)

    expect(SIDEBAR).toContain("from '@/lib/navegacion/modulos-en-pausa'")
    expect(SIDEBAR).toMatch(/!enPausa\(item\.href\)/)
  })

  it('5 · pausar no es borrar: las filas siguen declaradas, listas para volver', () => {
    for (const fuente of [OPS, SIDEBAR]) {
      expect(fuente).toMatch(/href: '\/hospitalizacion'/)
      expect(fuente).toMatch(/href: '\/uci'/)
    }
    // Con su etiqueta y su «para qué» intactos — es el trabajo que costaría
    // rehacer el día que el dueño diga que se enciende.
    expect(OPS).toContain("Pacientes internados: censo, evolución y pase de visita")
    expect(OPS).toContain("Cuidados intensivos: ventilación, sedación, escalas")
  })

  it('6 · el índice ya no promete módulos de hospital en su subtítulo', () => {
    // Una pantalla que se describe mal es la misma familia de defecto que un
    // grupo mal llamado (RTC-09): el copy y lo que se pinta van juntos.
    const subtitulo = OPS.match(/subtitle="([^"]+)"/)?.[1] ?? ''
    expect(subtitulo).not.toMatch(/hospital/i)
    expect(subtitulo).toMatch(/administración del consultorio/i)
  })
})
