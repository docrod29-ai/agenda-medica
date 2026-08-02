/**
 * GOLDEN — el NEWS2 que se enseña, y con qué nombre (decisión ICU-Q4.1).
 *
 * `lib/clinical/news2-set.ts` implementa la decisión del Dr —score sobre un
 * conjunto CONTEMPORÁNEO, nunca rellenar una variable ausente con el último dato
 * histórico— y estaba **escrito, probado y sin conectar**: la lista de huérfanos
 * aceptados lo decía con todas sus letras.
 *
 * Mientras tanto la ficha del episodio tomaba el último registro, lo puntuaba y
 * enseñaba el número. Si esa toma estaba a medias, la cabecera decía «NEWS2 2»
 * en verde y el aviso viajaba sólo en el `title`, que en un teléfono nadie ve.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { encuadrarNews2, POR_QUE_NO_SE_ESCONDE_EL_PARCIAL } from '@/lib/hospital/news2-encuadre'
import type { RegistroSignos } from '@/types/hospital'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

const completo = (id: string, fecha: string, extra: Partial<RegistroSignos> = {}): RegistroSignos => ({
  id, fecha, fr: 18, spo2: 97, ta: '120/80', fc: 72, temp: 36.5, conciencia: 'A', oxigeno: false, ...extra,
})

const AHORA = '2026-08-02T12:00:00.000Z'

describe('toma completa', () => {
  it('se llama NEWS2 a secas y no lleva aviso', () => {
    const r = encuadrarNews2([completo('s1', '2026-08-02T11:00:00.000Z')], AHORA)
    expect(r.encuadre).toBe('actual')
    expect(r.etiqueta).toBe('NEWS2')
    expect(r.aviso).toBe('')
    expect(r.registro?.id).toBe('s1')
  })
})

describe('la toma de ahora está incompleta', () => {
  const signos: RegistroSignos[] = [
    completo('s1', '2026-08-02T08:00:00.000Z'),
    // A las 11:00 sólo tomaron FC y temperatura.
    { id: 's2', fecha: '2026-08-02T11:00:00.000Z', fc: 88, temp: 37.1 },
  ]

  it('NO se fabrica un NEWS2 «de ahora» con datos de otra hora', () => {
    const r = encuadrarNews2(signos, AHORA)
    expect(r.encuadre).toBe('ultimo_valido')
    // El registro puntuado es el COMPLETO de las 08:00, no una mezcla.
    expect(r.registro?.id).toBe('s1')
  })

  it('y se llama por su nombre, con su hora — el ejemplo literal de la decisión', () => {
    const r = encuadrarNews2(signos, AHORA)
    expect(r.etiqueta).toBe('Último NEWS2 válido · 08:00')
    expect(r.aviso).toMatch(/11:00 está incompleta/)
    // Dice QUÉ falta, no «faltan datos».
    expect(r.aviso).toMatch(/fr/)
    expect(r.aviso).toMatch(/spo2/)
  })
})

describe('incompleta y sin ninguna completa antes', () => {
  it('el parcial se enseña DECLARADO, no se esconde', () => {
    /**
     * Ocultarlo sería peor: un score parcial con una SpO₂ de 88 sigue diciendo
     * algo que el médico necesita ver. Lo que la decisión prohíbe es presentarlo
     * como si fuera el NEWS2 de ahora.
     */
    const r = encuadrarNews2([{ id: 's1', fecha: '2026-08-02T11:00:00.000Z', spo2: 88, fc: 120 }], AHORA)
    expect(r.encuadre).toBe('incompleto')
    expect(r.registro?.id).toBe('s1')
    expect(r.etiqueta).toBe('NEWS2 incompleto')
    expect(r.aviso).toMatch(/SUBESTIMA el riesgo/)
    expect(POR_QUE_NO_SE_ESCONDE_EL_PARCIAL).toMatch(/SpO₂ de 88/)
  })
})

describe('sin signos', () => {
  it('no hay número ni etiqueta inventada', () => {
    const r = encuadrarNews2([], AHORA)
    expect(r.encuadre).toBe('sin_datos')
    expect(r.registro).toBeNull()
  })
})

describe('las correcciones no parten la toma en dos', () => {
  it('una corrección pertenece a la MISMA toma que corrige', () => {
    // Si contaran como tomas distintas, ninguna de las dos quedaría completa y
    // un episodio bien registrado se vería siempre «incompleto».
    const signos: RegistroSignos[] = [
      completo('s1', '2026-08-02T08:00:00.000Z', { spo2: 99 }),
      { id: 's2', fecha: '2026-08-02T08:03:00.000Z', fechaEfectiva: '2026-08-02T08:00:00.000Z', spo2: 92, corrigeA: 's1' },
    ]
    const r = encuadrarNews2(signos, AHORA)
    expect(r.encuadre).toBe('actual')
    // Y manda el valor CORREGIDO: la decisión lo dice literal («debe usar 92»).
    expect(r.registro?.spo2).toBe(92)
  })
})

describe('el futuro no cuenta', () => {
  it('una toma posterior al instante no se usa', () => {
    const r = encuadrarNews2([
      completo('s1', '2026-08-02T11:00:00.000Z'),
      completo('s2', '2026-08-02T23:00:00.000Z', { fc: 150 }),
    ], AHORA)
    expect(r.registro?.id).toBe('s1')
  })
})

describe('la ficha del episodio lo usa de verdad', () => {
  const s = leer('src', 'app', '(dashboard)', 'hospitalizacion', '[internamientoId]', 'page.tsx')

  it('puntúa el registro que decide el encuadre, no «el último» a secas', () => {
    expect(s).toContain('encuadrarNews2(signos')
    expect(s).toContain('const r = encuadre.registro')
  })

  it('la insignia de la cabecera dice el encuadre, no un número pelado', () => {
    // El aviso viajaba sólo en el `title`: en un teléfono, invisible.
    expect(s).toContain('{encuadre.etiqueta} {news2.total}')
    expect(s).toContain("encuadre.encuadre !== 'actual' &&")
  })

  it('y ya no afirma en falso qué parámetro falta', () => {
    /**
     * Decía siempre «(parcial: sin conciencia/O₂)», también cuando lo ausente
     * era la FR y la SpO₂. `calcularNews2` devuelve `faltantes` «para poder
     * decirlo en pantalla» y la pantalla decía otra cosa.
     */
    expect(s).not.toContain("news2.parcial ? ' (parcial")
    expect(s).toContain('{encuadre.aviso}')
  })
})
