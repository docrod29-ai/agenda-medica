/**
 * GOLDEN — la lista de espera deja de perder pacientes en silencio, por dos vías.
 *
 * ── 1. «RANGO HORARIO PREFERIDO»: capturado, ENSEÑADO, y nunca leído ─────────
 *
 * El formulario lo pide (`Ej. Mañana, 9-12`), se guarda en
 * `WaitlistEntry.rangoHorario` y la ficha del paciente **lo muestra**. El
 * emparejamiento del hueco liberado sólo miraba `tipo` y `fechaDeseada`.
 *
 * Quien pidió por la mañana recibía el ofrecimiento de las 18:00 y, si contestaba
 * **SÍ**, la cita se creaba a las 18:00. La recepción vio el dato en pantalla, el
 * paciente lo dijo, y el sistema hizo como si no existiera.
 *
 * Es el patrón caro de siempre —un campo escrito que nadie lee—, y aquí ni
 * siquiera estaba escondido: se enseña en la lista, así que desde dentro parece
 * que se está usando.
 *
 * ── 2. EL TOPE QUE RECORTABA SIN DECIRLO ─────────────────────────────────────
 *
 * `.limit(60)` **sin `orderBy`**: Firestore devolvía sesenta entradas
 * cualesquiera —en orden de identificador— y la prioridad se ordenaba DESPUÉS,
 * en memoria. Con más de sesenta en lista, el paciente de prioridad 1 podía no
 * estar entre las que llegaron, y el hueco se le ofrecía a otro sin que nada lo
 * indicara.
 *
 * ── LA REGLA QUE ORDENA LA REPARACIÓN ────────────────────────────────────────
 *
 * El rango es TEXTO LIBRE. Interpretarlo mal deja fuera de la rueda a un paciente
 * que sí podía venir, **y eso no se detecta nunca**: el que no recibe un mensaje
 * no se queja de no haberlo recibido. Por eso «no sé» no filtra.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  leerRangoHorario, huecoSirve, POR_QUE_LA_DUDA_NO_EXCLUYE,
} from '@/lib/whatsapp/rango-horario'

describe('lo que se entiende', () => {
  it('las palabras del día', () => {
    expect(leerRangoHorario('Mañana').franjas).toEqual([{ desde: 360, hasta: 720 }])
    expect(leerRangoHorario('por la tarde').franjas).toEqual([{ desde: 720, hasta: 1140 }])
    expect(leerRangoHorario('NOCHE').entendido).toBe(true)
  })

  it('sin acentos y en mayúsculas, que es como se captura de verdad', () => {
    expect(leerRangoHorario('MANANA').entendido).toBe(true)
    expect(leerRangoHorario('mañana').comoSeLeyo).toBe('mañana')
  })

  it('los rangos numéricos, con y sin minutos', () => {
    expect(leerRangoHorario('9-12').franjas).toEqual([{ desde: 540, hasta: 720 }])
    expect(leerRangoHorario('de 9 a 12').franjas).toEqual([{ desde: 540, hasta: 720 }])
    expect(leerRangoHorario('09:30-12:00').franjas).toEqual([{ desde: 570, hasta: 720 }])
  })

  it('«de 4 a 7 pm» son las 16:00-19:00, no la madrugada', () => {
    // Sin esto, quien puede por la tarde quedaba con una franja de madrugada y
    // no le servía NINGÚN hueco: peor que no filtrar.
    expect(leerRangoHorario('de 4 a 7 pm').franjas).toEqual([{ desde: 960, hasta: 1140 }])
  })

  it('y un 14 no se toca aunque diga tarde', () => {
    expect(leerRangoHorario('tarde, 14-18').franjas).toEqual([{ desde: 840, hasta: 1080 }])
  })
})

describe('lo que NO se entiende no filtra', () => {
  it('vacío, nulo o indefinido', () => {
    for (const v of ['', '   ', null, undefined]) {
      expect(leerRangoHorario(v).entendido, String(v)).toBe(false)
      expect(huecoSirve(v, '18:00'), String(v)).toBe(true)
    }
  })

  it('texto que no dice ninguna hora', () => {
    expect(leerRangoHorario('cuando se pueda').entendido).toBe(false)
    expect(huecoSirve('cuando se pueda', '07:00')).toBe(true)
  })

  it('un rango al revés es un dedazo, y no se adivina', () => {
    // «12-9»: no se sabe si quiso 12-21 o 9-12. Mejor no filtrar.
    expect(leerRangoHorario('12-9').entendido).toBe(false)
    expect(huecoSirve('12-9', '20:00')).toBe(true)
  })

  it('una hora imposible tampoco se interpreta', () => {
    expect(leerRangoHorario('9:99-12:00').entendido).toBe(false)
    expect(leerRangoHorario('35-40').entendido).toBe(false)
  })

  it('está escrito POR QUÉ la duda no excluye', () => {
    expect(POR_QUE_LA_DUDA_NO_EXCLUYE).toMatch(/no se queja de no haberlo recibido/i)
  })
})

describe('EL CASO QUE SE ROMPÍA', () => {
  it('quien pidió «Mañana, 9-12» ya no recibe el hueco de las 18:00', () => {
    expect(huecoSirve('Mañana, 9-12', '18:00')).toBe(false)
  })

  it('pero sí el de las 10:00', () => {
    expect(huecoSirve('Mañana, 9-12', '10:00')).toBe(true)
  })

  it('el hueco tiene que CABER entero, no sólo empezar dentro', () => {
    // 11:45 + 45 min = 12:30. A quien pidió «9-12» le rompe la mañana igual.
    expect(huecoSirve('9-12', '11:45', 45)).toBe(false)
    expect(huecoSirve('9-12', '11:00', 45)).toBe(true)
  })

  it('sin hora legible tampoco se excluye a nadie', () => {
    expect(huecoSirve('mañana', 'a las diez')).toBe(true)
  })
})

describe('el emparejamiento lo usa de verdad', () => {
  const s = readFileSync(
    join(process.cwd(), 'src', 'lib', 'whatsapp', 'ofrecer-hueco.ts'), 'utf8')

  it('el rango entra en el filtro, junto a tipo y fechaDeseada', () => {
    expect(s).toContain('huecoSirve(entry.rangoHorario, hora, slotDuracion)')
  })

  it('con la duración del hueco, no una supuesta', () => {
    expect(s).toContain('const slotDuracion = slot.duracion ?? 30')
  })

  it('y los tres llamadores la pasan cuando la saben', () => {
    const portal = readFileSync(join(process.cwd(), 'src', 'app', 'api', 'portal', 'route.ts'), 'utf8')
    const bot = readFileSync(join(process.cwd(), 'src', 'app', 'api', 'whatsapp', 'webhook', 'route.ts'), 'utf8')
    expect(portal.match(/duracion: cita\.duracion/g)?.length).toBe(2)
    expect(bot).toContain('duracion: Number(cita.duracion) || undefined')
  })
})

describe('el tope ya no recorta en silencio', () => {
  const s = readFileSync(
    join(process.cwd(), 'src', 'lib', 'whatsapp', 'ofrecer-hueco.ts'), 'utf8')

  it('ya no son 60 sin más', () => {
    /**
     * Sobre el CÓDIGO, no sobre su explicación: el comentario de arriba cita el
     * `.limit(60)` viejo a propósito, y una prueba que no distingue el código de
     * su explicación acaba obligando a no explicar nada.
     */
    const codigo = s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '')
    expect(codigo).not.toContain('.limit(60)')
    expect(codigo).toContain('.limit(TOPE_LISTA)')
    expect(codigo).toContain('const TOPE_LISTA = 200')
  })

  it('y cuando se alcanza, se DICE', () => {
    // Un recorte que nadie ve se lee como «ya estaban todos».
    expect(s).toContain('if (waitlistSnap.size >= TOPE_LISTA)')
    expect(s).toContain('puede haber pacientes MÁS prioritarios fuera de la lectura')
  })

  it('el aviso explica qué haría falta para arreglarlo del todo', () => {
    // El índice compuesto se crea a mano en la consola, y mientras no exista la
    // lectura fallaría ENTERA: por eso no se pide desde el código.
    expect(s).toContain('índice compuesto')
  })
})
