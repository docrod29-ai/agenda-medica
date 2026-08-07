/**
 * LA MENCIÓN BIEN ESCRITA NO RESPONDE POR LAS QUE VIENEN DESPUÉS.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * Los dos motores que contrastan el dictado con la nota —negaciones
 * (`contradicciones`) y temporalidad (`desajustesTemporales`)— buscaban el
 * término con un `indexOf` y, si esa **primera** aparición venía bien escrita
 * («niega diabetes», «antecedente de neumonía»), se daban por satisfechos y no
 * miraban ninguna más.
 *
 * La nota que se contrasta no es un párrafo: `textoDeLaNota` pega el resumen,
 * después los diagnósticos y después las secciones, en ese orden. Y la regla 16
 * del prompt de la nota ordena documentar los negativos pertinentes —«niega
 * diabetes e hipertensión»—, que caen en el resumen: **al principio de la
 * cadena**.
 *
 * Así que la nota que hace las dos cosas —el negativo pertinente bien puesto
 * arriba y el diagnóstico arrastrado abajo, que es la nota real— pasaba en
 * silencio completo:
 *
 *     resumen:      «… Niega diabetes e hipertensión arterial. …»  ← correcta
 *     diagnósticos: «Hipertensión arterial sistémica I10»          ← nadie la miraba
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * 7-ago-2026, auditando el motor de temporalidad porque el backlog (EVAL-002)
 * decía que no tenía corpus. Al correrlo sobre las 6 000 frases del Dr. no se
 * disparó ni una vez —ese corpus es de órdenes y cifras, no de interrogatorio,
 * y no sirve como oro para esto—, así que se pasó a sondear el motor con notas
 * armadas como las arma la aplicación. La primera con las dos menciones salió
 * muda.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * `indexOf` sin bucle: una sola posición por forma, y `break` a la primera que
 * pasaba el filtro. Es exactamente el fallo que el comentario de la ventana de
 * 60 caracteres decía estar evitando —«una negación ajena taparía una
 * afirmación real»—: la ventana lo impedía a 60 caracteres y el `indexOf` lo
 * dejaba entrar a cualquier distancia.
 *
 * En negaciones el defecto se escapaba **por suerte** en unos casos: si alguna
 * forma más larga del vocabulario («diabetes mellitus») casaba con la segunda
 * mención, el aviso salía. Con «hipertensión», cuyas formas no tienen esa
 * suerte, la nota quedaba muda. Un guardián que depende de qué sinónimo eligió
 * el modelo no es un guardián.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * `primeraMencionSinMarca` mira **todas** las apariciones de **todas** las
 * formas, en el orden en que salen en la nota, y devuelve la primera que no
 * viene marcada. Para que el motor calle, tienen que estar bien escritas todas.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * · **No mide el vocabulario.** Lo que no está en `CRONICAS` ni en
 *   `AGUDAS_FRECUENTES` sigue sin vigilarse, y así está declarado en los dos
 *   módulos: señalar de menos, nunca de más.
 * · **La ventana de 60 caracteres sigue siendo la misma** y sigue pudiendo
 *   tapar: una marca ajena que caiga dentro de esos 60 caracteres —«sin trauma
 *   previo» delante de un diagnóstico de neumonía— sigue silenciando esa
 *   mención. Queda anotado en el backlog como hallazgo aparte; aquí sólo se
 *   repara que se mirara una sola aparición.
 * · **No juzga si la nota tiene razón.** Puede que el paciente sí tenga la
 *   diabetes que negó. El motor sólo se niega a dejar pasar la discrepancia en
 *   silencio; quien decide es el médico.
 */
import { describe, it, expect } from 'vitest'
import { condicionesNegadas, contradicciones, primeraMencionSinMarca } from '@/lib/expediente/negaciones'
import { mencionesEnPasado, desajustesTemporales } from '@/lib/expediente/temporalidad'

/** Arma la cadena igual que `textoDeLaNota` de la consulta: resumen, dx, secciones. */
const nota = (resumen: string, diagnosticos: string[], secciones: string[] = []) =>
  [resumen, ...diagnosticos, ...secciones].join('\n')

const RESUMEN_CON_NEGATIVO_PERTINENTE =
  'Femenina de 54 años que acude por tos productiva y fiebre de tres días de '
  + 'evolución. Niega diabetes e hipertensión arterial. Refiere buen apetito y '
  + 'adecuada tolerancia a la vía oral, sin pérdida de peso.'

const RESUMEN_CON_ANTECEDENTE =
  'Masculino de 61 años con antecedente de neumonía en 2023, actualmente '
  + 'asintomático respiratorio. Acude por gonalgia derecha de dos semanas de '
  + 'evolución, sin edema ni datos de inflamación articular.'

const DICTADO_NIEGA = '¿Tiene diabetes o presión alta? No, ninguna. Vengo por la tos.'
const DICTADO_PASADO = 'El paciente tuvo neumonía hace tres años. Hoy viene por dolor de rodilla.'

describe('negaciones — el negativo pertinente no tapa al diagnóstico arrastrado', () => {
  it('avisa cuando la nota niega arriba y afirma abajo', () => {
    const negadas = condicionesNegadas(DICTADO_NIEGA)
    const texto = nota(RESUMEN_CON_NEGATIVO_PERTINENTE, [
      'Hipertensión arterial sistémica I10',
      'Bronquitis aguda J20.9',
    ])
    expect(contradicciones(negadas, texto).map(c => c.condicion)).toContain('hipertensión arterial')
  })

  it('cita el fragmento de la nota donde está la afirmación, no el negativo', () => {
    const negadas = condicionesNegadas(DICTADO_NIEGA)
    const texto = nota(RESUMEN_CON_NEGATIVO_PERTINENTE, ['Hipertensión arterial sistémica I10'])
    const c = contradicciones(negadas, texto).find(x => x.condicion === 'hipertensión arterial')
    expect(c?.enLaNota).toContain('Hipertensión arterial sistémica')
    expect(c?.enLaNota).not.toContain('Niega')
  })

  it('calla cuando la nota sólo trae el negativo pertinente, bien escrito', () => {
    const negadas = condicionesNegadas(DICTADO_NIEGA)
    const texto = nota(RESUMEN_CON_NEGATIVO_PERTINENTE, ['Bronquitis aguda J20.9'])
    expect(contradicciones(negadas, texto)).toEqual([])
  })

  it('sigue avisando cuando la nota sólo afirma — lo que ya funcionaba', () => {
    const negadas = condicionesNegadas(DICTADO_NIEGA)
    const texto = nota('Femenina de 54 años que acude por tos productiva.', [
      'Hipertensión arterial sistémica I10',
    ])
    expect(contradicciones(negadas, texto).map(c => c.condicion)).toContain('hipertensión arterial')
  })
})

describe('temporalidad — el antecedente bien escrito no tapa al diagnóstico arrastrado', () => {
  it('avisa cuando la nota lo pone como antecedente arriba y como diagnóstico abajo', () => {
    const pasadas = mencionesEnPasado(DICTADO_PASADO)
    const texto = nota(RESUMEN_CON_ANTECEDENTE, [
      'Neumonía adquirida en la comunidad J18.9',
      'Gonartrosis M17.1',
    ])
    expect(desajustesTemporales(pasadas, texto).map(d => d.condicion)).toEqual(['neumonía'])
  })

  it('calla cuando la nota sólo lo escribe como antecedente', () => {
    const pasadas = mencionesEnPasado(DICTADO_PASADO)
    const texto = nota(RESUMEN_CON_ANTECEDENTE, ['Gonartrosis M17.1'])
    expect(desajustesTemporales(pasadas, texto)).toEqual([])
  })

  it('sigue avisando cuando la nota sólo lo afirma en presente', () => {
    const pasadas = mencionesEnPasado(DICTADO_PASADO)
    const texto = nota('Masculino de 61 años que acude por gonalgia derecha.', [
      'Neumonía adquirida en la comunidad J18.9',
    ])
    expect(desajustesTemporales(pasadas, texto).map(d => d.condicion)).toEqual(['neumonía'])
  })
})

describe('primeraMencionSinMarca — el escáner compartido', () => {
  const NIEGA = /\bniega\b/i

  it('devuelve -1 cuando todas las menciones vienen marcadas', () => {
    expect(primeraMencionSinMarca('Niega diabetes.', ['diabetes'], NIEGA)).toBe(-1)
  })

  it('devuelve la posición de la mención sin marca, aunque sea la tercera', () => {
    // Las dos primeras vienen marcadas; la tercera está lejos de toda marca —
    // más de 60 caracteres, que es hasta donde alcanza la ventana hacia atrás.
    const t = 'Niega diabetes. Niega diabetes de nuevo. Acude por tos productiva y '
      + 'fiebre de tres días de evolución, con adecuada tolerancia a la vía oral. '
      + 'Diabetes mellitus tipo 2.'
    expect(primeraMencionSinMarca(t, ['diabetes'], NIEGA)).toBe(t.indexOf('Diabetes mellitus'))
  })

  it('recorre las formas en el orden en que salen en la nota, no en el del vocabulario', () => {
    // «dm2» aparece ANTES que «diabetes», y es la que no viene marcada: gana la
    // posición, no el orden de la lista de sinónimos.
    const t = 'Impresión: DM2 descontrolada. Se comentó que niega diabetes en el interrogatorio.'
    expect(primeraMencionSinMarca(t, ['diabetes', 'dm2'], NIEGA)).toBe(t.toLowerCase().indexOf('dm2'))
  })

  it('ignora las formas vacías sin colgarse', () => {
    expect(primeraMencionSinMarca('Diabetes.', ['', 'diabetes'], NIEGA)).toBe(0)
  })

  it('no encuentra nada cuando el término no está en la nota', () => {
    expect(primeraMencionSinMarca('Bronquitis aguda.', ['diabetes'], NIEGA)).toBe(-1)
  })

  it('la ventana de 60 caracteres sigue viva: la marca pegada al término sigue callando', () => {
    expect(primeraMencionSinMarca('El paciente niega diabetes mellitus.', ['diabetes'], NIEGA)).toBe(-1)
  })
})
