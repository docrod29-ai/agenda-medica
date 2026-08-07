/**
 * GOLDEN — el motor de temporalidad marcaba el padecimiento de HOY como pasado,
 * y callaba cuando la nota lo afirmaba de verdad.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * `EVAL-002` del backlog decía la verdad incómoda sobre este motor: se construyó
 * en la v1027-v1030 y **sus únicos casos eran los que escribió quien lo hizo**.
 * Un motor probado sólo contra las frases que su autor imaginó no está medido,
 * está confirmado.
 *
 * Así que se le pasó un corpus escrito **sin mirar el código**, con la forma en
 * que se dicta una consulta de agudos en México: el padecimiento actual empieza
 * por cuándo empezó. Cuatro de cinco frases salieron marcadas como pasado.
 *
 * ── LOS DOS DEFECTOS ─────────────────────────────────────────────────────────
 *
 * **1 · «Hace tres días» pesaba lo mismo que «hace tres años».** La marca de
 * tiempo bastaba por sí sola para encuadrar la frase en el pasado, y el rango
 * incluía días, semanas y meses. Resultado: «inicia hace tres días con fiebre y
 * tos, se integra neumonía adquirida en la comunidad» se leía como una neumonía
 * pasada, y la nota que escribía esa neumonía —la de hoy, correctamente— recibía
 * el aviso de desajuste.
 *
 * Ese aviso salta en **casi toda consulta de agudos**, que es la consulta que
 * este médico tiene todo el día. El propio módulo tenía escrito que un aviso que
 * salta donde no debe se acaba ignorando, y con él se ignoran los que sí
 * importan: aquí el motor se estaba gastando a sí mismo.
 *
 * **2 · La ventana de la nota cruzaba la oración.** El comentario del código
 * decía que la ventana era de 60 caracteres justo para NO leer la oración
 * anterior, «porque un “antecedente” ajeno taparía una afirmación en presente,
 * que es el fallo que importa». Sesenta caracteres cruzan el punto: «Sin
 * antecedentes de importancia. Neumonía adquirida en la comunidad» son 33 antes
 * de la palabra, y ese «antecedentes» —de una frase que ni siquiera habla de
 * neumonía— callaba el aviso. La intención estaba escrita y el código no la
 * cumplía.
 *
 * ── POR QUÉ IMPORTA PARA UN PACIENTE ─────────────────────────────────────────
 *
 * El primero desgasta la única defensa que hay contra el antecedente inventado;
 * el segundo la apaga precisamente en la nota que empieza por «sin antecedentes»
 * — la nota de un paciente nuevo, que es donde el expediente longitudinal nace y
 * donde un diagnóstico mal situado en el tiempo se arrastra más lejos.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * La marca de tiempo, **sola**, sólo encuadra en pasado cuando es remota. En el
 * rango corto hace falta el verbo — y el verbo ya bastaba por su cuenta, porque
 * las dos familias se suman. Recortar el rango no quita ninguna vigilancia que
 * el verbo no devuelva.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * · **El pasado cercano sin verbo y sin «antecedente»**: «neumonía hace tres
 *   meses», suelta, ya no se marca. Es el precio declarado del arreglo 1.
 * · **La nota sigue mirándose sólo en su PRIMERA aparición.** Si la escribe como
 *   antecedente y más abajo la afirma como actual, no avisa. Confirmado y NO
 *   reparado a propósito: ahí la nota puede tener razón —un antecedente y un
 *   cuadro nuevo del mismo padecimiento conviven— y avisar sería señalar de más.
 *   Queda como `EVAL-004` en el backlog.
 * · **Una frase que mezcla pasado y presente de padecimientos distintos**
 *   («tuvo neumonía hace tres años y sigue con diabetes») se lee entera como
 *   presente y la neumonía se pierde. `esFrasePasada` juzga la frase, no cada
 *   padecimiento. Queda como `EVAL-005`.
 * · Nada de esto decide si una enfermedad sigue activa. Sigue siendo gramática.
 */
import { describe, it, expect } from 'vitest'
import {
  esFrasePasada, mencionesEnPasado, desajustesTemporales,
} from '@/lib/expediente/temporalidad'

/**
 * EL CORPUS. Escrito antes de abrir el motor, con la forma en que se dicta el
 * padecimiento actual: primero cuándo empezó, después qué se integra.
 *
 * Son pacientes sintéticos: ni uno solo sale de una consulta real.
 */
const PADECIMIENTO_ACTUAL: readonly string[] = [
  'Inicia hace tres días con fiebre y tos, se integra neumonía adquirida en la comunidad.',
  'Cuadro de cuatro días de evolución, inició hace cuatro días con disuria y polaquiuria, compatible con infección urinaria.',
  'Refiere que hace dos días comenzó con fiebre y mialgias, probable dengue.',
  'Hace cinco días con dolor abdominal en hemicinturón, se sospecha pancreatitis.',
  'Hace una semana con ictericia y coluria, se solicita perfil de hepatitis.',
  'Hace dos meses con tos productiva y pérdida de peso, se sospecha tuberculosis.',
  'Desde hace tres días con tos, neumonía.',
]

describe('EL PADECIMIENTO DE HOY NO ES UN ANTECEDENTE', () => {
  it('ninguna frase del padecimiento actual se encuadra en el pasado', () => {
    /**
     * Antes del arreglo, seis de las siete salían `true` — todas las que traen
     * «hace N días/semanas/meses». La séptima ya pasaba por «desde hace».
     */
    for (const f of PADECIMIENTO_ACTUAL) {
      expect(esFrasePasada(f), f).toBe(false)
    }
  })

  it('y por tanto no cosecha ningún padecimiento pasado de ellas', () => {
    for (const f of PADECIMIENTO_ACTUAL) {
      expect(mencionesEnPasado(f), f).toEqual([])
    }
  })

  it('la consulta de agudos completa no genera un solo aviso', () => {
    /**
     * El caso que motiva todo: el dictado cuenta la neumonía de hoy, la nota la
     * escribe como diagnóstico de hoy — que es lo correcto— y el motor avisaba
     * de un desajuste inexistente.
     */
    const dictado = 'Inicia hace tres días con fiebre y tos productiva, se integra neumonía adquirida en la comunidad.'
    const nota = 'Padecimiento actual: fiebre y tos de tres días. Impresión diagnóstica: neumonía adquirida en la comunidad. Se inicia amoxicilina.'
    expect(desajustesTemporales(mencionesEnPasado(dictado), nota)).toEqual([])
  })
})

describe('LO QUE EL RECORTE NO SE LLEVÓ: EL VERBO SIGUE BASTANDO', () => {
  it('con verbo en pretérito, el rango corto se sigue vigilando', () => {
    /**
     * Esto es la mitad del arreglo: si el verbo no bastara por su cuenta,
     * recortar el rango habría abierto un hueco de verdad en lugar de cerrar
     * uno falso.
     */
    for (const f of [
      'Tuvo neumonía hace dos semanas.',
      'Presentó una crisis convulsiva hace tres días.',
      'Padeció dengue hace un mes.',
      'Le operaron de apendicectomía hace diez días.',
    ]) {
      expect(esFrasePasada(f), f).toBe(true)
    }
  })

  it('y el rango remoto sin verbo también, que es para lo que se hizo el motor', () => {
    for (const f of [
      'Cáncer hace cinco años.',
      'Tuberculosis en 2018.',
      'Epilepsia años atrás.',
      'Asma de niño.',
    ]) {
      expect(esFrasePasada(f), f).toBe(true)
    }
  })

  it('el caso que bautizó el motor sigue avisando de punta a punta', () => {
    const d = desajustesTemporales(
      mencionesEnPasado('El paciente tuvo neumonía hace tres años. Hoy viene por dolor de garganta.'),
      'Paciente con neumonía. Refiere odinofagia.',
    )
    expect(d).toHaveLength(1)
    expect(d[0].condicion).toBe('neumonía')
  })
})

describe('LA VENTANA DE LA NOTA NO SE SALE DE LA ORACIÓN', () => {
  const dictado = 'Tuvo neumonía hace tres años.'

  it('un «antecedentes» de la oración anterior ya no calla el aviso', () => {
    /**
     * La apertura más común de una nota de paciente nuevo. Antes del arreglo
     * devolvía `[]`: la palabra «antecedentes» estaba dentro de los 60
     * caracteres, aunque perteneciera a otra frase y a otro tema.
     */
    const d = desajustesTemporales(mencionesEnPasado(dictado), 'Sin antecedentes de importancia. Neumonía adquirida en la comunidad.')
    expect(d).toHaveLength(1)
    expect(d[0].enLaNota).toContain('Neumonía')
  })

  it('y otras aperturas del mismo tipo tampoco', () => {
    for (const nota of [
      'Niega antecedentes patológicos. Neumonía adquirida en la comunidad.',
      'Antecedentes: interrogados y negados. Neumonía basal derecha.',
      'Tuvo varicela en la infancia. Neumonía adquirida en la comunidad.',
    ]) {
      expect(desajustesTemporales(mencionesEnPasado(dictado), nota), nota).toHaveLength(1)
    }
  })

  it('pero el «antecedente de» de la MISMA oración sigue callando, que es su trabajo', () => {
    /**
     * El otro lado del guardián: si el arreglo hubiera quitado la ventana en vez
     * de acortarla, la nota bien escrita empezaría a recibir avisos y el motor
     * pasaría de callar de más a hablar de más.
     */
    for (const nota of [
      'Antecedente de neumonía tratada.',
      'Historia de neumonía en 2023.',
      'Tuvo neumonía, resuelta.',
      'Exploración sin datos de dificultad respiratoria. Antecedente de neumonía tratada.',
    ]) {
      expect(desajustesTemporales(mencionesEnPasado(dictado), nota), nota).toEqual([])
    }
  })
})

describe('LO QUE QUEDA DECLARADO Y SIN VIGILAR', () => {
  it('el pasado cercano sin verbo ya no se marca — el precio del arreglo', () => {
    /**
     * Se escribe como prueba, y no sólo como comentario, para que el día que
     * alguien decida cubrirlo tenga que venir aquí a borrar esta línea y se
     * entere de por qué estaba.
     */
    expect(esFrasePasada('Neumonía hace tres meses.')).toBe(false)
  })

  it('y una frase que mezcla pasado y presente se lee entera como presente', () => {
    // EVAL-005. El motor juzga la frase, no cada padecimiento de la frase.
    expect(mencionesEnPasado('Tuvo neumonía hace tres años y sigue con diabetes.')).toEqual([])
  })
})
