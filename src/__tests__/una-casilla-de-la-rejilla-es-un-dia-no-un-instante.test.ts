/**
 * GOLDEN — la columna rotulada «31» contenía las citas del 30.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * El calendario mezclaba DOS husos en la misma casilla:
 *
 *  · el número de la cabecera salía de `d.getDate()` — el calendario **del
 *    aparato**;
 *  · la llave con la que se buscan las citas de esa casilla salía de
 *    `fechaISOLocal(d)`, que convierte el instante a la zona **del
 *    consultorio**.
 *
 * `getWeekDates` fabrica sus siete fechas como POSICIONES DE CALENDARIO —a
 * mediodía, con aritmética local—, no como instantes. Convertirlas de huso las
 * corre de día en cuanto el aparato y el consultorio no coinciden.
 *
 * Y encima la semana que se abría salía de `new Date()` —el reloj del aparato—
 * mientras el resaltado de «hoy» salía de `hoyISO()` —la zona del consultorio—.
 *
 * ── CÓMO SE DESCUBRIÓ, Y LO QUE SE MIDIÓ ────────────────────────────────────
 *
 * Por accidente: el arnés de las citas fuera de hora empezó a fallar **sólo en
 * la vista de semana** después de que el contenedor cruzara la medianoche UTC.
 * La primera reacción fue sospechar del arreglo anterior; mirar la captura dijo
 * otra cosa.
 *
 * Medido con el navegador en `Pacific/Kiritimati` (UTC+14) y el consultorio en
 * México (UTC−6), el 31-ago-2026:
 *
 *     días en la cabecera: 31, 1, 2, 3, 4, 5, 6
 *     marcados como hoy:  31        ← y hoy, en el consultorio, era el 30
 *
 * Es decir: **la columna rotulada «31» estaba marcada como hoy y contenía las
 * citas del 30**. No es sólo que abriera en la semana equivocada —eso se ve—:
 * es que ponía las citas de un día bajo el rótulo de otro, que no se ve.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Una casilla de rejilla es un **día del calendario**, no un momento en la línea
 * del tiempo: se lee por las mismas partes con las que se construyó y se
 * rotula, sin convertir de huso. Y el ancla de la rejilla se pone en el día del
 * CONSULTORIO, que es el que usa todo lo demás de la pantalla.
 *
 * Para quien tiene el aparato en la zona de su consultorio —el caso normal— no
 * cambia nada en absoluto.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Devolviendo `new Date()` y `fechaISOLocal` y recompilando,
 * `npm run arnes:hoy-del-consultorio` marca las dos faltas: «la semana abierta
 * no contiene el 30» y «el 30 no está marcado como hoy».
 *
 * **Y ojo con probar esto al revés aquí**: la suite fija la zona
 * (`vitest.config.ts` pone `TZ = America/Mexico_City`), así que en una corrida
 * normal el aparato y el consultorio SIEMPRE coinciden — que es justo el caso en
 * el que este defecto no se manifiesta. La primera versión de este archivo
 * «pasó» con el defecto puesto por eso, y habría sido una tautología.
 *
 * El interruptor existe: con
 *
 *     TZ_TESTS=Pacific/Kiritimati npx vitest run src/__tests__/una-casilla-...
 *
 * y la conversión de huso devuelta, caen tres casos —«el rótulo y la llave se
 * separaron en 2026-01-01: expected '2025-12-31'» y «la semana de 2026-08-30 no
 * contiene 2026-08-30»—. Con el arreglo pasan los cuatro en las DOS zonas.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No prueba la pantalla**: eso es del arnés, con navegador y con dos husos
 *   de verdad.
 * · No cubre el cambio de día con la pantalla ABIERTA (medianoche en vivo).
 * · No cubre la vista de MES.
 * · No dice nada de la hora de las citas, que sí es un instante y sí se lee en
 *   la zona del consultorio: esto es sólo el DÍA de la casilla.
 */
import { describe, it, expect } from 'vitest'
import { anclaDeRejilla, diaDeRejilla } from '@/lib/agenda/dia-de-rejilla'
import { getWeekDates } from '@/lib/availability'

describe('una casilla de la rejilla es un día, no un instante', () => {
  it('el ancla cae en el día que se le pide, no en el de al lado', () => {
    const d = anclaDeRejilla('2026-08-30')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(7)      // agosto
    expect(d.getDate()).toBe(30)
  })

  it('EL DEFECTO: el rótulo y la llave dicen el MISMO día', () => {
    // Es la invariante entera: `d.getDate()` rotula y `diaDeRejilla` indexa.
    for (const iso of ['2026-01-01', '2026-08-30', '2026-12-31', '2026-03-08']) {
      const d = anclaDeRejilla(iso)
      expect(diaDeRejilla(d), `el rótulo y la llave se separaron en ${iso}`).toBe(iso)
      expect(String(d.getDate()), `el número de la cabecera no cuadra en ${iso}`)
        .toBe(String(Number(iso.slice(8, 10))))
    }
  })

  it('la semana del ancla CONTIENE al ancla — si no, no hay dónde marcar hoy', () => {
    for (const iso of ['2026-08-30', '2026-08-31', '2026-01-01', '2026-12-31']) {
      const dias = getWeekDates(anclaDeRejilla(iso)).map(diaDeRejilla)
      expect(dias, `la semana de ${iso} no contiene ${iso}`).toContain(iso)
      expect(dias).toHaveLength(7)
    }
  })

  it('un domingo sigue siendo el ÚLTIMO día de su semana, no el primero', () => {
    // 30-ago-2026 es domingo: la semana empieza en lunes en este producto.
    const dias = getWeekDates(anclaDeRejilla('2026-08-30')).map(diaDeRejilla)
    expect(dias[0]).toBe('2026-08-24')
    expect(dias[6]).toBe('2026-08-30')
  })
})
