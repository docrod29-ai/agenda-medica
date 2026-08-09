/**
 * UN NEGADOR SIN SU AFIRMADOR GEMELO BORRA UN ANTECEDENTE — REG-282.
 *
 * ── LA REGLA, Y LO QUE COSTÓ APRENDERLA ─────────────────────────────────────
 *
 * Un verbo puede entrar en una negación —«no **padece** diabetes»— y también
 * **cerrar** una anterior —«niega tabaquismo, **padece** diabetes»—.
 *
 * Si entra en `NEGADORES` y no en `AFIRMADORES`, el arreglo **no repara la
 * mitad: la mueve al lado que no se ve**. Porque nadie echa de menos un
 * antecedente que no está.
 *
 * Pasó **dos veces**, y las dos medidas:
 *
 *     REG-192 añadió `padece`/`padezco` sólo a NEGADORES
 *       → «Niega tabaquismo, padece diabetes»  ·  diabetes NEGADA
 *
 *     REG-280 —el mío, el mismo día— añadió `es`/`soy`/`son` sólo a NEGADORES
 *       → «Niega diabetes, es fumador»         ·  tabaquismo NEGADO
 *
 * Las dos **borran un antecedente real**, y eso es peor que inventarlo: el
 * inventado estorba y se ve; el borrado no se echa de menos.
 *
 * ── EL ARREGLO ES ESTRUCTURAL, NO UNA LISTA MÁS LARGA ───────────────────────
 *
 * Los dos lados salen de **`VERBOS_DE_TENENCIA`**, una sola lista. Añadir un
 * verbo lo añade a las dos caras a la vez, y la desalineación deja de ser
 * posible — que es distinto de ser improbable.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { extraerComorbilidades } from '@/lib/expediente/parser-clinico'

const c = (t: string) => extraerComorbilidades(t)

describe('los dos casos que enseñaron la regla', () => {
  it('«Niega tabaquismo, padece diabetes» conserva la diabetes', () => {
    const r = c('Niega tabaquismo, padece diabetes mellitus.')
    expect(r.positivas, 'se borró un antecedente real').toEqual(['Diabetes mellitus tipo 2'])
    expect(r.negadas).toEqual(['Tabaquismo'])
  })

  it('«Niega diabetes, es fumador» conserva el tabaquismo', () => {
    /** Éste lo introduje yo el mismo día, añadiendo `es` sólo a un lado. */
    const r = c('Niega diabetes, es fumador')
    expect(r.positivas, 'se borró un antecedente real').toEqual(['Tabaquismo'])
    expect(r.negadas).toEqual(['Diabetes mellitus tipo 2'])
  })
})

describe('las ocho formas que caían del lado afirmativo', () => {
  for (const frase of [
    'No he tenido diabetes',
    'Nunca he tenido diabetes',
    'Jamás ha tenido diabetes',
    'Tampoco tiene diabetes',
    'No sufre de diabetes',
    'No cuenta con diabetes',
  ]) {
    it(`«${frase}» niega`, () => {
      expect(c(frase).positivas, 'antecedente fabricado').toEqual([])
      expect(c(frase).negadas).toContain('Diabetes mellitus tipo 2')
    })
  }

  for (const frase of ['No fuma', 'No es fumador']) {
    it(`«${frase}» niega — aquí el término clínico ES el verbo`, () => {
      /**
       * Entre el negador y el término no queda nada que reconocer: `NEGADORES`
       * busca «no + verbo de tenencia», y «fuma» no es uno de ellos. Se exige
       * que el negador esté INMEDIATAMENTE antes.
       */
      expect(c(frase).positivas, 'antecedente fabricado').toEqual([])
      expect(c(frase).negadas).toContain('Tabaquismo')
    })
  }
})

describe('y no se niega de más, que es el error caro en la otra dirección', () => {
  it('«No acude por diabetes, tiene hipertensión» afirma las DOS', () => {
    /**
     * La ventana acaba en «por », no en «no », así que el negador pegado no
     * dispara. Si disparara, se perdería una diabetes real.
     */
    const r = c('No acude por diabetes, tiene hipertensión')
    expect(r.positivas.sort()).toEqual(['Diabetes mellitus tipo 2', 'Hipertensión arterial'])
    expect(r.negadas).toEqual([])
  })

  it('lo afirmado sin ambigüedad sigue afirmado', () => {
    for (const frase of [
      'Diabetes mellitus tipo 2',
      'Acude por diabetes descompensada',
      'En tratamiento para diabetes',
      'Fumador de 20 cigarros',
    ]) {
      expect(c(frase).positivas.length, frase).toBeGreaterThan(0)
    }
  })

  it('«pero» sigue cerrando la negación', () => {
    const r = c('Niega diabetes pero tiene hipertensión')
    expect(r.positivas).toEqual(['Hipertensión arterial'])
    expect(r.negadas).toEqual(['Diabetes mellitus tipo 2'])
  })
})

describe('la desalineación deja de ser POSIBLE, no sólo improbable', () => {
  const fuente = readFileSync(
    join(process.cwd(), 'src/lib/expediente/parser-clinico.ts'), 'utf8')

  it('existe una sola lista de verbos de tenencia', () => {
    expect(fuente).toMatch(/const VERBOS_DE_TENENCIA = \[/)
  })

  it('y los DOS lados la usan', () => {
    /**
     * Ésta es la prueba que importa. Mientras las dos expresiones se tecleen
     * por separado, alguien volverá a añadir un verbo a una sola — ya pasó dos
     * veces en el mismo día.
     */
    const neg = /const NEGADORES = new RegExp\(([\s\S]{0,600}?)\)\n/.exec(fuente)?.[1] ?? ''
    const afi = /const AFIRMADORES = new RegExp\(([\s\S]{0,400}?)\)\n/.exec(fuente)?.[1] ?? ''
    expect(neg, 'NEGADORES no deriva de la lista común').toContain('VERBOS_DE_TENENCIA')
    expect(afi, 'AFIRMADORES no deriva de la lista común').toContain('VERBOS_DE_TENENCIA')
  })

  it('y `tampoco`/`jamás` abren negación como `no`/`nunca`/`sin`', () => {
    /**
     * Con `tampoco` suelto, el `tiene` de «tampoco tiene diabetes» cerraba la
     * negación que el `tampoco` acababa de abrir.
     */
    expect(fuente).toMatch(/no\|nunca\|sin\|tampoco\|jam\[a/)
  })
})
