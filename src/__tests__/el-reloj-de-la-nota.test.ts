/**
 * GOLDEN — la nota se rendía por aritmética, no porque el proveedor fallara.
 *
 * ── LO QUE PASABA ────────────────────────────────────────────────────────────
 *
 * Cada intento esperaba **90 s fijos**, y se hacían hasta tres. 270 s más las
 * esperas entre ellos **no caben** en los 300 s de la función: el último intento
 * lo cortaba Vercel en seco y el médico acababa en el parser local.
 *
 * O sea que la nota se perdía por una suma mal hecha, no porque Anthropic
 * estuviera caído.
 *
 * Y 90 s es poco para lo que de verdad importa: una consulta larga con
 * razonamiento extendido tarda. Rendirse a los 90 s teniendo presupuesto de
 * sobra es tirar la nota por impaciencia.
 *
 * ── LA REPARACIÓN ────────────────────────────────────────────────────────────
 *
 * Cada intento recibe **lo que queda** del presupuesto, menos una reserva para
 * responder. Un solo intento puede usar más de cuatro minutos si hace falta. Y
 * no se empieza un intento que no puede terminar: se devuelve el aviso al médico
 * en vez de dejar que Vercel corte y no le llegue nada.
 *
 * **No se baja ni un ápice de calidad**: mismo modelo, mismo razonamiento
 * extendido, misma cascada. Lo único que cambia es que se deja de rendir antes
 * de tiempo.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ruta = readFileSync(join(process.cwd(), 'src/app/api/expediente/procesar/route.ts'), 'utf8')

describe('EL RELOJ SALE DEL PRESUPUESTO, NO DE UN NÚMERO FIJO', () => {
  it('ya no hay 90 s clavados en la llamada', () => {
    expect(ruta).not.toContain('AbortSignal.timeout(90_000)')
    expect(ruta).toContain('signal: AbortSignal.timeout(msDisponibles)')
  })

  it('el presupuesto es el de la función, con reserva para responder', () => {
    /**
     * Si la reserva no existiera, el trabajo podría estar hecho y perderse al
     * cortar Vercel — la peor forma de fallar.
     */
    expect(ruta).toContain('const RESERVA_RESPUESTA_MS = 25_000')
    /**
     * EL MISMO número en los dos sitios. Next exige que `maxDuration` sea un
     * literal, así que no se puede compartir una constante — y si se separan, o
     * se desperdicia tiempo pagado o Vercel corta con el trabajo ya hecho.
     */
    const pres = Number(ruta.match(/const PRESUPUESTO_MS = ([\d_]+)/)?.[1].replace(/_/g, '') ?? 0)
    const maxd = Number(ruta.match(/export const maxDuration = (\d+)/)?.[1] ?? 0)
    expect(pres, 'PRESUPUESTO_MS').toBeGreaterThan(0)
    expect(maxd * 1000, 'maxDuration en ms').toBe(pres)
  })

  it('no se empieza un intento que no puede terminar', () => {
    expect(ruta).toContain('const MINIMO_PARA_INTENTAR_MS = 20_000')
    expect(ruta).toContain('if (ms < MINIMO_PARA_INTENTAR_MS)')
  })

  it('y se reintenta MIENTRAS QUEDE TIEMPO, no un número fijo de veces', () => {
    expect(ruta).toContain('if (restante() < MINIMO_PARA_INTENTAR_MS) break')
  })
})

describe('NO SE BAJA LA CALIDAD — eso era la mitad del encargo', () => {
  it('el razonamiento extendido sigue encendido', () => {
    expect(ruta).toContain("body.thinking = { type: 'enabled', budget_tokens: 6000 }")
  })

  it('y la cascada de modelos sigue intacta', () => {
    expect(ruta).toContain('const CANDIDATOS: Record<Perfil, string[]>')
  })

  it('un intento puede durar MÁS que los 90 s de antes', () => {
    // 800 − 25 = 775 s para el primer intento si hace falta. Antes: 90.
    // «Dale el tiempo que necesite, no nomás 4.5 minutos» — instrucción del Dr.
    const presupuesto = Number(ruta.match(/const PRESUPUESTO_MS = ([\d_]+)/)?.[1].replace(/_/g, '') ?? 0) - 25_000
    expect(presupuesto).toBeGreaterThan(600_000)
  })
})
