/**
 * LA NOTA BIEN ESCRITA NO PUEDE CEGAR AL GUARDIÁN — REG-192.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * Los dos guardianes que contrastan el dictado contra la nota —`contradicciones`
 * (lo que el paciente negó) y `desajustesTemporales` (lo que se dijo en pasado)—
 * buscaban el término con un solo `indexOf`: la PRIMERA aparición y ninguna más.
 * Si esa primera venía bien encuadrada, se callaban para toda la nota.
 *
 * El caso, con receta incluida:
 *
 *     dictado: «¿Es usted diabético? No, nunca me han dicho nada de azúcar.»
 *     nota:    «Interrogatorio: niega diabetes mellitus.
 *               Impresión diagnóstica: diabetes mellitus tipo 2 descontrolada.
 *               Se inicia metformina 850 mg cada 12 horas.»
 *
 * Cero avisos. El paciente negó la diabetes, la nota la registró bien y después
 * la afirmó y recetó por ella.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Iteración EVAL-002 del bucle autónomo (7-ago-2026): al construir el corpus oro
 * del motor de temporalidad —que no tenía ninguno— se escribieron notas con la
 * forma que tienen las notas de verdad, con su sección de antecedentes ARRIBA y
 * su impresión diagnóstica ABAJO. El motor se quedó mudo en todas. Los casos que
 * ya existían usaban notas de una sola línea y por eso nunca lo tocaron.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * `t.indexOf(forma)` sin desplazamiento. Y el `continue` al encontrar el
 * encuadre pasaba a la forma SIGUIENTE, no a la aparición siguiente — con lo que
 * «neumonía» y «neumonia» caían en el mismo índice y el bucle se agotaba sin
 * mirar nada más.
 *
 * Estaba dos veces porque el bucle estaba copiado dos veces. Por eso la
 * reparación es un módulo compartido, `buscar-en-la-nota.ts`, y no dos parches.
 *
 * ── POR QUÉ IMPORTA PARA UN PACIENTE ─────────────────────────────────────────
 *
 * La dirección del incentivo estaba invertida: cuanto MEJOR redactada la nota,
 * más ciego el guardián. Sólo saltaba en la nota descuidada que jamás registró
 * la negación ni el antecedente. La forma en que se escribe de verdad —y la que
 * el propio sistema produce— era la que quedaba sin vigilancia.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Cada aparición se juzga sola. Que una mención esté bien escrita no dice nada
 * sobre las demás. Se avisa de la primera que aparece SIN su encuadre, y se cita
 * ésa —no la correcta—, para que el médico vea el fragmento que hay que revisar.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * · **No amplía el vocabulario ni el encuadre.** Cada motor conserva sus marcas
 *   («niega …», «antecedente de …»), que son las que el dueño ya revisó. Lo que
 *   no está en ellas se sigue sin vigilar.
 * · **No mira la negación en el lado temporal.** `YA_ES_ANTECEDENTE` no conoce
 *   «sin datos de neumonía», así que una radiografía que descarta el padecimiento
 *   cuenta como mención. Antes esa mención sólo se alcanzaba si era la primera de
 *   la nota; ahora se alcanza siempre. Es ruido conocido, y es el precio de no
 *   perder el arrastre — que es lo que llega al expediente. Anotado para el
 *   dueño en OWNER_DECISIONS_REQUIRED (C-6).
 * · **Un aviso por condición, como siempre.** Si la nota afirma la misma
 *   condición cinco veces, se cita una. No se cuenta cuántas.
 * · **No decide nada clínico.** Sigue sin resolver si la nota o el dictado tiene
 *   razón: sólo se niega a dejar pasar la discrepancia en silencio.
 */
import { describe, it, expect } from 'vitest'
import { condicionesNegadas, contradicciones } from '@/lib/expediente/negaciones'
import { mencionesEnPasado, desajustesTemporales, avisoDeDesajuste } from '@/lib/expediente/temporalidad'
import { primeraMencionSinEncuadre } from '@/lib/expediente/buscar-en-la-nota'

describe('REG-192 · negaciones: la mención correcta no absuelve a la incorrecta', () => {
  const dictado = '¿Es usted diabético? No, nunca me han dicho nada de azúcar.'

  it('avisa cuando la nota niega arriba y afirma abajo — el caso que fallaba', () => {
    const nota = 'Interrogatorio: niega diabetes mellitus.\n\n'
      + 'Impresión diagnóstica: diabetes mellitus tipo 2 descontrolada.\n'
      + 'Se inicia metformina 850 mg cada 12 horas.'
    const avisos = contradicciones(condicionesNegadas(dictado), nota)
    expect(avisos.map(a => a.condicion)).toEqual(['diabetes'])
  })

  it('cita la mención MALA, no la que estaba bien escrita', () => {
    const nota = 'Interrogatorio: niega diabetes mellitus.\n\n'
      + 'Impresión diagnóstica: diabetes mellitus tipo 2 descontrolada.'
    const [aviso] = contradicciones(condicionesNegadas(dictado), nota)
    expect(aviso.enLaNota).toContain('tipo 2 descontrolada')
    expect(aviso.enLaNota).not.toContain('niega')
  })

  it('calla si TODAS las menciones vienen negadas', () => {
    const nota = 'Interrogatorio por aparatos: niega diabetes mellitus.\n\n'
      + 'Antecedentes familiares: madre con diabetes.\n'
      + 'Comentario: se descarta diabetes en este momento.'
    expect(contradicciones(condicionesNegadas(dictado), nota)).toEqual([])
  })

  it('sigue avisando con una sola mención afirmada — no se rompe lo que ya andaba', () => {
    const nota = 'Impresión diagnóstica: diabetes mellitus tipo 2 descontrolada.'
    expect(contradicciones(condicionesNegadas(dictado), nota)).toHaveLength(1)
  })

  it('dos condiciones negadas y las dos afirmadas más abajo', () => {
    const d = '¿Enfermedades crónicas como diabetes o presión alta? No, ninguna.'
    const nota = 'Interrogatorio: niega diabetes, niega hipertensión.\n\n'
      + 'Impresión: diabetes mellitus tipo 2 e hipertensión arterial sistémica.'
    const avisos = contradicciones(condicionesNegadas(d), nota)
    expect(avisos.map(a => a.condicion).sort())
      .toEqual(['diabetes', 'hipertensión arterial'])
  })
})

describe('REG-192 · temporalidad: el antecedente listado no absuelve al diagnóstico', () => {
  it('avisa cuando la nota lista el antecedente y luego lo diagnostica hoy', () => {
    const pasadas = mencionesEnPasado('El paciente tuvo neumonía hace tres años.')
    const nota = 'Antecedentes personales patológicos: neumonía en 2023, resuelta.\n\n'
      + 'Impresión diagnóstica: neumonía adquirida en la comunidad. Se inicia amoxicilina.'
    expect(desajustesTemporales(pasadas, nota).map(d => d.condicion)).toEqual(['neumonía'])
  })

  it('cruza formas distintas del mismo padecimiento — antecedente de colecistectomía, cirugía hoy', () => {
    const pasadas = mencionesEnPasado('Le operaron de la vesícula hace cinco años.')
    const nota = 'Antecedente de colecistectomía en 2021.\n\n'
      + 'Plan: se programa colecistectomía laparoscópica.'
    expect(desajustesTemporales(pasadas, nota)).toHaveLength(1)
  })

  it('calla si la nota sólo lo escribe como antecedente', () => {
    const pasadas = mencionesEnPasado('El paciente tuvo neumonía hace tres años.')
    const nota = 'Antecedentes: neumonía en 2023, resuelta.\n'
      + 'Historia de neumonía tratada de forma ambulatoria.'
    expect(desajustesTemporales(pasadas, nota)).toEqual([])
  })

  it('sigue avisando con una sola mención en presente — no se rompe lo que ya andaba', () => {
    const pasadas = mencionesEnPasado('Tuvo una trombosis hace dos años.')
    const nota = 'Impresión diagnóstica: trombosis venosa profunda de miembro pélvico izquierdo.'
    expect(desajustesTemporales(pasadas, nota)).toHaveLength(1)
  })

  it('el aviso al médico trae el fragmento que hay que revisar', () => {
    const pasadas = mencionesEnPasado('El paciente tuvo neumonía hace tres años.')
    const nota = 'Antecedentes: neumonía en 2023.\n\nDiagnóstico: neumonía basal derecha.'
    const [d] = desajustesTemporales(pasadas, nota)
    expect(avisoDeDesajuste(d)).toContain('basal derecha')
  })

  it('«desde hace tres años tiene diabetes» sigue siendo presente y no genera aviso', () => {
    const pasadas = mencionesEnPasado('Desde hace tres años tiene diabetes, en control con metformina.')
    const nota = 'Antecedentes: diabetes mellitus tipo 2.\n\nImpresión: diabetes mellitus tipo 2.'
    expect(pasadas).toEqual([])
    expect(desajustesTemporales(pasadas, nota)).toEqual([])
  })
})

describe('REG-192 · el recorrido compartido', () => {
  const ANTECEDENTE = /\bantecedente[s]?\b/i

  it('devuelve null cuando todas las apariciones vienen encuadradas', () => {
    const nota = 'Antecedente de dengue. Otro antecedente de dengue en 2019.'
    expect(primeraMencionSinEncuadre(nota, ['dengue'], ANTECEDENTE)).toBeNull()
  })

  it('encuentra la mención desnuda aunque esté en medio de dos encuadradas', () => {
    const nota = 'Antecedente de dengue.\nCuadro actual de dengue con datos de alarma.\n'
      + 'Antecedente de dengue en 2019.'
    expect(primeraMencionSinEncuadre(nota, ['dengue'], ANTECEDENTE))
      .toContain('con datos de alarma')
  })

  it('devuelve la aparición más temprana, no la de la primera forma de la lista', () => {
    const nota = 'Se documenta TVP en la pierna. Más abajo se comenta la trombosis.'
    expect(primeraMencionSinEncuadre(nota, ['trombosis', 'tvp'], ANTECEDENTE))
      .toContain('TVP en la pierna')
  })

  it('la ventana se corta en el fin de oración: el encuadre del renglón anterior no cuenta', () => {
    const nota = 'Antecedente de dengue.\nCuadro actual de dengue con datos de alarma.'
    expect(primeraMencionSinEncuadre(nota, ['dengue'], ANTECEDENTE))
      .toContain('con datos de alarma')
  })

  it('lo heredofamiliar no es del paciente y no genera aviso', () => {
    const nota = 'Antecedentes heredofamiliares: madre con diabetes e hipertensión.'
    expect(primeraMencionSinEncuadre(nota, ['diabetes'], ANTECEDENTE)).toBeNull()
  })

  it('null cuando la nota no nombra el término', () => {
    expect(primeraMencionSinEncuadre('Nota sin nada de eso.', ['dengue'], ANTECEDENTE)).toBeNull()
  })

  it('una forma vacía no hace que se marque toda la nota', () => {
    expect(primeraMencionSinEncuadre('Nota cualquiera.', ['', 'dengue'], ANTECEDENTE)).toBeNull()
  })
})
