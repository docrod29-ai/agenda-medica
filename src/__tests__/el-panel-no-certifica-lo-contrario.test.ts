/**
 * EL PANEL NO PUEDE CERTIFICAR LO CONTRARIO DE LO QUE SE DIJO — REG-251 · P0.
 *
 * ── CÓMO SE ENCONTRÓ ────────────────────────────────────────────────────────
 *
 * No leyendo el código. Un equipo rojo independiente, lanzado a **refutar** los
 * planes de métricas en vez de aprobarlos, le pasó al comparador pares que un
 * médico reconocería al instante como opuestos. Dos agentes distintos
 * reprodujeron lo mismo. Después se reprodujo aquí, en esta máquina.
 *
 * ── LO QUE EL PANEL DECÍA, EN VERDE Y CON COBERTURA 1,00 ────────────────────
 *
 *     nota:    «Paciente NIEGA alergia a penicilina.»
 *     dictado: «Doctor, soy ALÉRGICO a la penicilina.»      → respaldada, 1,00
 *
 *     nota:    «Warfarina 10 mg al día.»
 *     dictado: «Le doy warfarina 2 mg al día.»              → respaldada, 1,00
 *
 * Una inversión de negación y una dosis de anticoagulante multiplicada por
 * cinco, las dos selladas como «se dijo en la consulta».
 *
 * ── POR QUÉ ES PEOR QUE UN FALLO NORMAL ─────────────────────────────────────
 *
 * Este panel no es informativo: **tranquiliza**. Le dice al médico «esto se
 * dijo» en verde. Un motor de verificación que certifica lo contrario de lo que
 * ocurrió es más peligroso que no tener motor, porque sustituye la duda del
 * médico por una falsa certeza.
 *
 * Y en v1132 se le puso encima un botón para escuchar el audio, que lo vuelve
 * todavía más creíble.
 *
 * ── LAS DOS CAUSAS, Y LAS TRES REPARACIONES ─────────────────────────────────
 *
 * 1. `'niega'` estaba en la lista de palabras VACÍAS. Al ignorarla, «niega
 *    alergia a penicilina» y «alérgico a la penicilina» eran la misma frase
 *    para el comparador. → Los negadores son contenido, y además el SIGNO se
 *    compara aparte y manda sobre la cobertura.
 *
 * 2. `contenido()` filtraba `w.length > 3`, lo que tira «10», «mg», «850», «2»
 *    — es decir, **todas las dosis**. → Las cifras y unidades entran siempre.
 *
 * 3. Con las dos anteriores, una frase LARGA aún diluía una cifra equivocada
 *    por encima del umbral. → Una cifra huérfana **nunca** puede ser verde.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { rastrearNota, COBERTURA_RESPALDADA } from '@/lib/expediente/trazabilidad'

const uno = (nota: string, dictado: string) => rastrearNota(nota, dictado)[0]

describe('LO QUE NUNCA PUEDE VOLVER A SALIR EN VERDE', () => {
  it('«niega alergia a penicilina» contra «soy alérgico a la penicilina»', () => {
    /** El caso que abrió el hallazgo. Antes: respaldada, cobertura 1,00. */
    const r = uno('Paciente niega alergia a penicilina.', 'Doctor, soy alérgico a la penicilina.')
    expect(r.estado).toBe('sin_respaldo')
    expect(r.cobertura).toBe(0)
  })

  it('«no refiere dolor torácico» contra «me duele mucho el pecho»', () => {
    expect(uno('No refiere dolor torácico.', 'Me duele mucho el pecho.').estado)
      .toBe('sin_respaldo')
  })

  it('warfarina 10 mg contra un dictado de 2 mg', () => {
    /** Cinco veces la dosis de un anticoagulante. Antes: respaldada, 1,00. */
    const r = uno('Warfarina 10 mg al día.', 'Le doy warfarina 2 mg al día.')
    expect(r.estado).not.toBe('respaldada')
    expect(r.huerfanas).toContain('10')
  })

  it('y tampoco diluida en una frase LARGA', () => {
    /**
     * Ésta es la tercera reparación. Con el signo arreglado y las cifras
     * devueltas al comparador, una frase larga **todavía** dejaba pasar la
     * dosis equivocada: 0,78 de cobertura, por encima del umbral de 0,7.
     */
    const r = uno(
      'Warfarina 10 mg vía oral cada 24 horas por tiempo indefinido.',
      'Le doy warfarina 2 mg vía oral cada 24 horas indefinidamente.',
    )
    expect(r.cobertura).toBeGreaterThan(COBERTURA_RESPALDADA)
    expect(r.estado, 'una cifra huérfana no puede ser verde ni con 0,78').toBe('parcial')
    expect(r.huerfanas).toContain('10')
  })

  it('metformina 850 contra 500', () => {
    const r = uno('Metformina 850 mg dos veces al día.', 'Metformina 500 mg una vez al día.')
    expect(r.estado).not.toBe('respaldada')
  })
})

describe('lo que SÍ tiene que seguir en verde', () => {
  /**
   * Endurecer un verificador es donde se fabrica el ruido. Un panel que marca
   * en ámbar la mitad de una nota correcta se aprende a ignorar, y entonces
   * tampoco frena lo que sí importa.
   */
  it('la misma negación en los dos sitios', () => {
    expect(uno('Paciente niega alergias a medicamentos.',
      'El paciente niega alergias a medicamentos conocidas.').estado).toBe('respaldada')
  })

  it('la misma dosis en los dos sitios', () => {
    expect(uno('Warfarina 10 mg al día.', 'Le doy warfarina 10 mg al día.').estado)
      .toBe('respaldada')
  })

  it('la misma dosis en una frase larga', () => {
    expect(uno(
      'Warfarina 10 mg vía oral cada 24 horas por tiempo indefinido.',
      'Le doy warfarina 10 mg vía oral cada 24 horas indefinidamente.',
    ).estado).toBe('respaldada')
  })

  it('el sinónimo del paciente sigue contando', () => {
    /** «cefalea» ← «dolor de cabeza»: el falso positivo que ya se reparó. */
    expect(uno('Refiere cefalea de tres días.', 'Me duele la cabeza desde hace tres días.').estado)
      .toBe('respaldada')
  })
})

describe('las causas quedan cerradas en el código', () => {
  it('«niega» ya NO es una palabra vacía', () => {
    const mod = readFileSync(join(process.cwd(), 'src/lib/expediente/trazabilidad.ts'), 'utf8')
    const vacias = mod.slice(mod.indexOf('const VACIAS'), mod.indexOf('const NEGADORES'))
    expect(vacias).not.toMatch(/'niega'/)
  })

  it('las cifras entran al comparador sea cual sea su longitud', () => {
    const mod = readFileSync(join(process.cwd(), 'src/lib/expediente/trazabilidad.ts'), 'utf8')
    expect(mod).toMatch(/\/\\d\/\.test\(w\) \|\| UNIDAD_PEGADA\.test\(w\) \|\| w\.length > 3/)
  })

  it('el signo se compara aparte y manda sobre la cobertura', () => {
    const mod = readFileSync(join(process.cwd(), 'src/lib/expediente/trazabilidad.ts'), 'utf8')
    expect(mod).toContain('function negacionCoincide')
    expect(mod).toMatch(/negacionCoincide\(afirmacion, seg\.texto\) \? hallada \/ palabras\.length : 0/)
  })
})
