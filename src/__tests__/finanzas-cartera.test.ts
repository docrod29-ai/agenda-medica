/**
 * GOLDEN — cartera de créditos (P1-2 · Master Loop V3 §AA–AF).
 *
 * Lo que hay hoy es leer-y-luego-escribir: se pregunta «¿le quedan créditos?»,
 * se llama al modelo, y al final se incrementa el contador. Entre la pregunta y
 * el incremento pasan hasta treinta segundos.
 */
import { describe, it, expect } from 'vitest'
import {
  disponible, cabe, ajusteAlConfirmar, aplicaCartera, type Saldo,
} from '@/lib/finanzas/cartera'
import { debeCortarCreditos } from '@/lib/ai-keys'

const saldo = (p: Partial<Saldo> = {}): Saldo =>
  ({ limite: 200, extra: 0, usados: 0, reservados: 0, ...p })

describe('Lo que queda cuenta lo que está EN VUELO', () => {
  it('el disponible descuenta usados y reservados', () => {
    expect(disponible(saldo({ usados: 50, reservados: 10 }))).toBe(140)
  })

  it('las recargas suman', () => {
    expect(disponible(saldo({ extra: 100, usados: 250 }))).toBe(50)
  })

  it('nunca es negativo', () => {
    expect(disponible(saldo({ usados: 500 }))).toBe(0)
  })

  it('DOS llamadas simultáneas no pasan las dos con el saldo de una', () => {
    /**
     * Éste es el defecto. Quedan 3 créditos y entran dos notas de 3. Si los
     * reservados no contaran, la segunda vería los mismos 3 libres y pasaría.
     */
    const tras_la_primera = saldo({ usados: 197, reservados: 3 })
    expect(cabe(tras_la_primera, 3).ok).toBe(false)

    // Y sin contar lo reservado, habría pasado:
    expect(cabe({ ...tras_la_primera, reservados: 0 }, 3).ok).toBe(true)
  })
})

describe('Alcanza o no alcanza, y se dice cuánto queda', () => {
  it('cuando alcanza, se aparta exactamente el costo', () => {
    expect(cabe(saldo({ usados: 190 }), 7)).toEqual({ ok: true, reservar: 7 })
  })

  it('justo en el límite alcanza', () => {
    expect(cabe(saldo({ usados: 193 }), 7).ok).toBe(true)
  })

  it('uno más ya no', () => {
    expect(cabe(saldo({ usados: 194 }), 7).ok).toBe(false)
  })

  it('el motivo dice cuánto queda y cuánto cuesta: sirve para decidir', () => {
    const v = cabe(saldo({ usados: 198 }), 7)
    expect(v.motivo).toMatch(/quedan 2/)
    expect(v.motivo).toMatch(/cuesta 7/)
    expect(v.motivo).toMatch(/Recarga|llave/)
  })

  it('una operación sin costo siempre pasa y no aparta nada', () => {
    expect(cabe(saldo({ usados: 999 }), 0)).toEqual({ ok: true, reservar: 0 })
  })
})

describe('Confirmar: se reserva una estimación, se cobra lo real', () => {
  it('si salió más barato, se cobra lo real', () => {
    expect(ajusteAlConfirmar(7, 3)).toEqual({ cobrar: 3, excedente: 0 })
  })

  it('si costó lo mismo, se cobra lo mismo', () => {
    expect(ajusteAlConfirmar(7, 7)).toEqual({ cobrar: 7, excedente: 0 })
  })

  it('si costó MÁS, el excedente se separa para que se pueda ver', () => {
    // Se cobra igual, pero una estimación que se queda corta es una señal de
    // que hay que corregirla, no algo que se traga en silencio.
    expect(ajusteAlConfirmar(3, 10)).toEqual({ cobrar: 3, excedente: 7 })
  })

  it('un real negativo no devuelve créditos de la nada', () => {
    expect(ajusteAlConfirmar(7, -5)).toEqual({ cobrar: 0, excedente: 0 })
  })
})

describe('A quién se le descuenta', () => {
  it('sólo cuando corre sobre la llave del dueño', () => {
    expect(aplicaCartera('prueba', 'c1')).toBe(true)
  })

  it('con llave propia del consultorio NO: sería cobrarle dos veces', () => {
    expect(aplicaCartera('clinica', 'c1')).toBe(false)
  })

  it('sin consultorio no hay bolsa que descontar', () => {
    expect(aplicaCartera('prueba', null)).toBe(false)
    expect(aplicaCartera('ninguna', 'c1')).toBe(false)
  })

  it('al FUNDADOR no se le descuenta: no tiene bolsa que agotar', () => {
    /**
     * Su cuenta corre sobre la llave del dueño (`prueba`), así que sin esta
     * regla el tope del plan lo dejaría sin IA a mitad de mes mientras
     * construye el producto — justo lo que §BK prohíbe. Su gasto sí se
     * registra, marcado como I+D: no se esconde, se clasifica.
     */
    expect(aplicaCartera('prueba', 'c1', true)).toBe(false)
    expect(aplicaCartera('prueba', 'c1', false)).toBe(true)
  })

  it('es EL MISMO criterio que el gate que ya existía', () => {
    /**
     * Dos respuestas distintas a «¿quién paga esto?» acabarían discrepando, y la
     * discrepancia se vería como créditos que desaparecen sin explicación.
     */
    for (const fuente of ['prueba', 'clinica', 'ninguna'] as const) {
      for (const cid of ['c1', null]) {
        expect(aplicaCartera(fuente, cid), `${fuente}/${cid}`)
          .toBe(debeCortarCreditos(fuente, cid, true))
      }
    }
  })
})
