/**
 * GOLDEN — la consulta larga se quedaba sin segunda opinión.
 *
 * ── LO QUE PASABA ────────────────────────────────────────────────────────────
 *
 * `verificar-nota` corta en 12 000 caracteres. Pasado ese punto **no revisaba
 * nada**: devolvía `incompleto: true` y le decía al médico que la revisara él.
 *
 * Eso era honesto —lo puso una auditoría anterior, y era una mejora clara sobre
 * responder `{"hallazgos":[]}`, que se lee como «revisado y limpio»— pero dejaba
 * sin red justo a **la consulta complicada**. Un dictado de 20 minutos ronda los
 * 20 000 caracteres: el tope no era un caso raro, era el caso de todos los días.
 *
 * ── LO QUE SE HACE AHORA ─────────────────────────────────────────────────────
 *
 * Se trocea la **transcripción**, no la nota, y la nota entera se revisa contra
 * cada tramo. Los tramos **se solapan**: una indicación a caballo de la frontera
 * partida en seco deja media dosis a cada lado, y el revisor no puede ver que
 * falta lo que no está. Es el mismo razonamiento que el solape del audio.
 *
 * ── Y LO QUE SIGUE SIENDO HONESTO ────────────────────────────────────────────
 *
 * El tope de tramos está acotado —cada tramo es una llamada de pago— y si el
 * dictado no cabe, se devuelven los hallazgos de lo revisado **junto con** el
 * aviso de qué parte quedó fuera. Ni se esconde una dosis peligrosa encontrada
 * en el tramo 2 porque el 3 no cupo, ni se presenta como revisión completa.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  segmentarParaRevision, unirHallazgos, MAX_TRAMOS, SOLAPE,
  POR_QUE_SE_SOLAPA, POR_QUE_HAY_TOPE_DE_TRAMOS,
} from '@/lib/ia/segmentar-revision'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const ruta = leer('src', 'app', 'api', 'expediente', 'verificar-nota', 'route.ts')
const page = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')

const frases = (n: number) => Array.from({ length: n }, (_, i) => `Frase número ${i} del dictado.`).join(' ')

describe('EL CAMINO CORTO NO CAMBIA', () => {
  it('un texto que cabe sale en un solo tramo, sin truncar', () => {
    const r = segmentarParaRevision('consulta breve', 12000)
    expect(r.tramos).toEqual(['consulta breve'])
    expect(r.truncado).toBe(false)
    expect(r.tramosNecesarios).toBe(1)
  })

  it('texto vacío no produce tramos', () => {
    expect(segmentarParaRevision('', 12000).tramos).toEqual([])
  })
})

describe('EL TROCEADO', () => {
  it('ningún tramo pasa del tope', () => {
    const t = frases(3000)
    for (const tr of segmentarParaRevision(t, 5000).tramos) {
      expect(tr.length).toBeLessThanOrEqual(5000)
    }
  })

  it('no corta a mitad de palabra', () => {
    /**
     * Partir «meropenem» en dos deja al revisor con dos palabras que no
     * existen, y el modelo tiene que adivinar cuál era.
     */
    const t = frases(2000)
    for (const tr of segmentarParaRevision(t, 4000).tramos) {
      expect(tr.trim()).toMatch(/[.\s]$|\.$/)
    }
  })

  it('los tramos consecutivos SE SOLAPAN', () => {
    // Sin solape, una indicación en la costura se pierde entera.
    const t = frases(2000)
    const { tramos } = segmentarParaRevision(t, 4000)
    expect(tramos.length).toBeGreaterThan(1)
    const colaDel1 = tramos[0].slice(-200)
    expect(tramos[1].includes(colaDel1.trim().split(' ').slice(-3).join(' '))).toBe(true)
  })

  it('el solape es suficiente para que quepa una indicación entera', () => {
    // fármaco + dosis + vía + intervalo + duración cabe de sobra en 600.
    expect(SOLAPE).toBeGreaterThanOrEqual(300)
  })

  it('avanza siempre: nunca se queda repitiendo el mismo tramo', () => {
    const t = frases(5000)
    const { tramos } = segmentarParaRevision(t, 3000)
    for (let i = 1; i < tramos.length; i++) expect(tramos[i]).not.toBe(tramos[i - 1])
  })
})

describe('LO QUE NO SE PROMETE', () => {
  it('el número de tramos está acotado', () => {
    const t = frases(20000)
    const r = segmentarParaRevision(t, 3000)
    expect(r.tramos.length).toBeLessThanOrEqual(MAX_TRAMOS)
    expect(r.truncado).toBe(true)
    expect(r.tramosNecesarios).toBeGreaterThan(MAX_TRAMOS)
  })

  it('y se sabe cuánto se cubrió de cuánto', () => {
    const t = frases(20000)
    const r = segmentarParaRevision(t, 3000)
    expect(r.total).toBe(t.length)
    expect(r.cubiertos).toBeGreaterThan(0)
    expect(r.cubiertos).toBeLessThan(r.total)
  })

  it('está escrito por qué hay tope', () => {
    expect(POR_QUE_HAY_TOPE_DE_TRAMOS).toMatch(/gastando en silencio/)
    expect(POR_QUE_SE_SOLAPA).toMatch(/media dosis/)
  })
})

describe('LOS HALLAZGOS SE JUNTAN SIN REPETIR', () => {
  it('el mismo hallazgo en dos tramos sale una vez', () => {
    // Es lo que provoca el solape: un problema en la costura lo ve el tramo de
    // antes y el de después. Repetido, haría dudar de la lista entera.
    const h = { severidad: 'alta', tema: 'Dosis', problema: 'Meropenem 2 g cada 8 h en falla renal', sugerencia: 'Ajustar' }
    expect(unirHallazgos([[h], [{ ...h }]])).toHaveLength(1)
  })

  it('compara sin acentos, mayúsculas ni espacios de más', () => {
    const a = { severidad: 'alta', tema: 'Interacción', problema: 'Riesgo  de sangrado' }
    const b = { severidad: 'alta', tema: 'INTERACCION', problema: 'riesgo de sangrado' }
    expect(unirHallazgos([[a], [b]])).toHaveLength(1)
  })

  it('dos problemas distintos NO se colapsan', () => {
    const a = { severidad: 'alta', tema: 'Dosis', problema: 'Uno' }
    const b = { severidad: 'alta', tema: 'Dosis', problema: 'Otro' }
    expect(unirHallazgos([[a], [b]])).toHaveLength(2)
  })

  it('una lista vacía no rompe nada', () => {
    expect(unirHallazgos([])).toEqual([])
  })
})

describe('LA RUTA LO USA, Y SIGUE DICIENDO LA VERDAD', () => {
  it('trocea la transcripción, NO la nota', () => {
    /**
     * Revisar media nota contra el dictado entero daría por buenas las dosis de
     * la mitad que no se leyó.
     */
    expect(ruta).toContain('const seg = segmentarParaRevision(transcripcionCompleta, TOPE)')
    expect(ruta).toContain('if (notaTexto.length > TOPE)')
  })

  it('le dice al modelo qué tramo está viendo', () => {
    expect(ruta).toContain('TRAMO ${i + 1} DE ${tramos.length}')
  })

  it('un tramo ilegible NO se convierte en «revisado sin hallazgos»', () => {
    expect(ruta).toContain('ilegibles++')
    expect(ruta).toContain('if (porTramo.length === 0)')
  })

  it('si no se cubrió todo, van los hallazgos Y el aviso', () => {
    expect(ruta).toContain('if (seg.truncado || ilegibles > 0)')
    expect(ruta).toContain('ok: false, incompleto: true, modelo: usado, hallazgos, tramos: tramos.length')
    expect(ruta).toMatch(/Sólo se revisaron los primeros/)
  })

  it('y la pantalla ya no tira esos hallazgos', () => {
    expect(page).toContain('const parciales = Array.isArray(data.hallazgos) ? data.hallazgos : []')
    expect(page).toContain('revisión parcial')
  })
})
