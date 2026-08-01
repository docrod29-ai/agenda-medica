/**
 * UN PRECIO QUE DEPENDE DE QUÉ PANTALLA MIRES NO ES UN PRECIO.
 *
 * Esto ya había pasado —un segundo catálogo en `superadmin` que discrepaba de
 * `PLANES` en sus cuatro renglones— y la reparación de entonces dejó un
 * comentario que decía «fuente única: PLANES»… con los tres precios escritos a
 * mano justo debajo. Coincidían por casualidad: nada los ataba.
 *
 * Un comentario no es un mecanismo. Esta prueba sí: recorre las pantallas donde
 * se decide pagar y falla si alguna vuelve a llevar una cifra tecleada.
 *
 * Y además había una mentira viva: el plan Hospital anunciaba «400 créditos/mes»
 * cuando son 500. No lo cazó nadie porque no rompía nada — sólo prometía de
 * menos en la pantalla donde el médico decide si compra.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PLANES, PLANES_ORDEN, precioTexto } from '@/lib/planes-ia'

const leer = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

/** Las pantallas donde se ve o se decide el precio. */
const PANTALLAS_DE_DINERO = [
  'src/app/(dashboard)/layout.tsx',            // el gate: se ve justo antes de pagar
  'src/app/(dashboard)/configuracion/page.tsx', // «qué estoy pagando»
]

describe('precioTexto', () => {
  it('pone el separador de miles y no inventa centavos', () => {
    expect(precioTexto(PLANES.premium)).toBe('$1,590')
    expect(precioTexto(PLANES.agenda)).toBe('$349')
  })

  it('cambia solo si cambia PLANES', () => {
    // El contrato entero en una línea: la pantalla no tiene voto sobre el precio.
    for (const c of PLANES_ORDEN) {
      // Quitado el formato, tiene que quedar exactamente el importe del plan.
      expect(Number(precioTexto(PLANES[c]).replace(/\D/g, ''))).toBe(PLANES[c].precioMXN)
    }
  })
})

describe('ninguna pantalla vuelve a teclear un precio', () => {
  for (const archivo of PANTALLAS_DE_DINERO) {
    it(`${archivo} lee los precios de PLANES`, () => {
      const src = leer(archivo)
      expect(src).toMatch(/from '@\/lib\/planes-ia'/)
    })

    it(`${archivo} no lleva ninguna cifra de plan escrita a mano`, () => {
      /**
       * Se buscan los importes REALES —349, 899, 1590/1,590, 3499/3,499— en
       * cualquier sitio que no sea un comentario. Si mañana se sube una tarifa,
       * el número viejo deja de estar en esta lista y la prueba deja de
       * protegerlo… pero el número viejo tampoco estaría ya en `PLANES`, que es
       * lo único que se pinta.
       */
      const codigo = leer(archivo)
        .split('\n')
        .filter(l => !/^\s*(\*|\/\/|\/\*)/.test(l))   // fuera comentarios
        .join('\n')
      for (const c of PLANES_ORDEN) {
        const n = PLANES[c].precioMXN
        const conComa = n.toLocaleString('es-MX')
        const patron = new RegExp(`\\$\\s?(${n}|${conComa.replace(',', ',')})\\b`)
        expect(patron.test(codigo), `${archivo} lleva «$${conComa}» escrito a mano (plan ${c})`).toBe(false)
      }
    })
  }
})

describe('los créditos anunciados son los que se entregan', () => {
  it('EL PLAN HOSPITAL PROMETÍA 400 Y SON 500', () => {
    // La cifra se quedó de una versión anterior de la oferta. Prometer de menos
    // en la pantalla donde se decide pagar es tan malo como prometer de más.
    expect(PLANES.hospital.creditos).toBe(500)
    const cfg = leer('src/app/(dashboard)/configuracion/page.tsx')
    expect(cfg).not.toMatch(/'400 créditos\/mes'/)
  })

  it('ninguna pantalla de dinero lleva una cuenta de créditos a mano', () => {
    for (const archivo of PANTALLAS_DE_DINERO) {
      const codigo = leer(archivo).split('\n').filter(l => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n')
      for (const c of PLANES_ORDEN) {
        const cr = PLANES[c].creditos
        if (cr === 0) continue
        expect(
          new RegExp(`['"\`]${cr} créditos`).test(codigo),
          `${archivo} lleva «${cr} créditos» escrito a mano (plan ${c})`,
        ).toBe(false)
      }
    }
  })
})
