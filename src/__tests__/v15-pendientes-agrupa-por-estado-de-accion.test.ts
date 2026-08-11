/**
 * `/pendientes` agrupa `resto` por `estadoDeAccion`, no por una única
 * sección «Abiertos» — V15-FOLLOWUP-WORK-001 (Fase 7, §10).
 *
 * QUÉ FALLABA: antes de esta corrida, todo lo que no escalaba (crítico sin
 * dueño / vencido) caía en una sola lista plana etiquetada «Abiertos (n)» —
 * el médico tenía que leerla entera para saber qué está esperando qué.
 *
 * CÓMO SE DESCUBRIÓ: releyendo §10 contra el código real de
 * `pendientes/page.tsx` al cerrar `V15-RESULTS-CLOSURE-001` (Fase 6) y
 * decidir la siguiente tarea exacta.
 *
 * CAUSA RAÍZ: la pantalla nunca tuvo una función que tradujera `tipo`/
 * `estado`/`venceEn` a una categoría de acción — sólo el binario
 * escalar/no-escalar de `debeEscalar`.
 *
 * LA REGLA QUE LO HACE SEGURO: la página importa `estadoDeAccion` (no
 * reimplementa su propio criterio de agrupación) y no vuelve a pintar
 * «Abiertos» como sección única.
 *
 * QUÉ NO CUBRE: no verifica el resultado visual (colores, espaciado) — eso
 * se comprueba en navegador real, con capturas, en la verificación de esta
 * misma corrida. Tampoco prueba «cerrada_reciente»: esa categoría no puede
 * aparecer aquí porque `tareasVivas()` nunca trae tareas cerradas (ver
 * cabecera de `estado-de-accion.ts`).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const RUTA = join(process.cwd(), 'src/app/(dashboard)/pendientes/page.tsx')
const FUENTE = readFileSync(RUTA, 'utf8')

describe('pendientes/page.tsx agrupa por estado de acción', () => {
  it('importa estadoDeAccion, ORDEN_ESTADO_DE_ACCION y ETIQUETA_ESTADO_DE_ACCION del módulo puro', () => {
    // Falla contra el árbol previo a este cambio: esos tres símbolos no existían.
    expect(FUENTE).toContain("from '@/lib/tareas-clinicas/estado-de-accion'")
    expect(FUENTE).toMatch(/estadoDeAccion/)
    expect(FUENTE).toMatch(/ORDEN_ESTADO_DE_ACCION/)
    expect(FUENTE).toMatch(/ETIQUETA_ESTADO_DE_ACCION/)
  })

  it('ya NO pinta "Abiertos (" como sección única de todo lo no urgente', () => {
    // Falla contra el árbol previo a este cambio: esa cadena literal existía.
    expect(FUENTE).not.toContain('Abiertos (')
  })

  it('la sección de "vencida" se filtra al agrupar resto — esa categoría ya la cubre "urgentes" arriba', () => {
    expect(FUENTE).toMatch(/ORDEN_ESTADO_DE_ACCION\.filter\(cat => cat !== 'vencida'\)/)
  })

  it('no reimplementa el criterio de agrupación con un switch/if propio — delega en el módulo puro', () => {
    // Un `estadoDeAccion(t, ahora)` propio de la página duplicaría la fuente
    // de verdad (invariante de la carta operativa: una entidad, un criterio).
    const llamadas = FUENTE.match(/estadoDeAccion\(/g) ?? []
    expect(llamadas.length).toBeGreaterThan(0)
    expect(FUENTE).not.toMatch(/function estadoDeAccion/)
  })

  it('urgentes sigue calculándose con debeEscalar — esta rebanada no toca esa lógica ya probada', () => {
    expect(FUENTE).toContain("visibles.filter(t => debeEscalar(t, ahora).escalar)")
  })
})
