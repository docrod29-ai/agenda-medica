/**
 * GUARDIÁN — una cita literal que dice LO CONTRARIO de lo que respalda.
 *
 * ── EL DEFECTO ──────────────────────────────────────────────────────────────
 *
 * El modelo escribe «reduce la mortalidad» y ancla la frase en un pasaje que
 * dice *«did not reduce mortality»*. La cita EXISTE, es LITERAL y sale de los
 * HALLAZGOS: pasa las tres compuertas que este producto ya tenía —REG-359 la
 * ancla carácter a carácter, REG-400 comprueba de qué parte del artículo sale—
 * y dice exactamente lo opuesto.
 *
 * Es el peor de los tres defectos de cita, porque es el único que se ve MÁS
 * respaldado cuanto más se comprueba.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * No hizo falta buscarlo: el censo del programa lo traía escrito como lo
 * siguiente de WS-12 tras REG-400 — «faltan las dos comprobaciones deterministas
 * siguientes: POLARIDAD y MATIZ». Ésta cierra la primera.
 *
 * ── LO QUE NO ES ────────────────────────────────────────────────────────────
 *
 * **No es un evaluador de entailment**, y no se declara como tal. Juzgar si un
 * pasaje SIGNIFICA lo que la afirmación dice exige un modelo, su conjunto de
 * referencia y un umbral que fija un médico. Esto compara POLARIDAD, que es la
 * mitad que se puede decidir sin modelo. El MATIZ («podría reducir» citado como
 * «reduce») sigue abierto.
 *
 * **No dice quién tiene razón.** Puede que el modelo citara mal, que citara el
 * artículo equivocado, o que la frase sea buen razonamiento sin ese respaldo.
 * Las tres las decide el médico.
 *
 * ── LA REGLA QUE LO HACE SEGURO: SEÑALAR DE MENOS ───────────────────────────
 *
 * Un aviso que salta cuando no debe se deja de leer, y entonces no sirve el día
 * que acierta. Estos casos vigilan sobre todo cuándo el motor SE CALLA:
 *
 *   · lectura mixta del pasaje → no se dice nada;
 *   · el concepto no aparece en uno de los dos → no se dice nada;
 *   · las tres raíces que se descartaron al releer el módulo contra sí mismo —
 *     «lower» (que es «lower extremity»), «superior» (que es «vena cava
 *     superior») y un «no» suelto— tienen su caso, para que nadie las devuelva.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **El vocabulario es vocabulario.** `EFECTOS` es la lista de los efectos que
 *   este motor sabe leer, no la de los que importan. Un verbo que falte
 *   significa que ese caso NO SE VIGILA, no que esté bien.
 * · **No lee el artículo entero.** Compara la afirmación con el PASAJE que el
 *   modelo devolvió. Si el modelo eligió mal el pasaje, esto no lo sabe.
 * · **La conexión con la ruta es de SUBSTRING**, con la misma advertencia de
 *   siempre: comprueba que el llamador lo nombre, no que la respuesta HTTP real
 *   lo lleve.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  polaridadDe, contradiccionesEntre, comoSeDice, EFECTOS,
  POR_QUE_NO_ES_UN_EVALUADOR_DE_ENTAILMENT, POR_QUE_SOLO_SI_TODAS_ESTAN_NEGADAS,
  POR_QUE_NO_SE_REUSA_EL_MOTOR_DE_NEGACIONES, RAICES_QUE_SE_DESCARTARON,
} from '@/lib/evidencia/la-cita-dice-lo-contrario'
import { citasQueDicenLoContrario, verificarAfirmaciones } from '@/lib/evidencia/verificar-la-cita'

/* Derivadas del módulo, no copiadas: una lista a mano aquí se desincroniza del
   vocabulario real y la prueba deja de probar lo que cree. */
const REDUC = EFECTOS.find(e => e.concepto === 'reducción')!.raices

describe('el defecto: el pasaje niega lo que la afirmación asevera', () => {
  it('«reduce la mortalidad» anclado en «did not reduce mortality» se marca', () => {
    const c = contradiccionesEntre('El tratamiento reduce la mortalidad', 'the drug did not reduce mortality')
    expect(c).toHaveLength(1)
    expect(c[0]).toMatchObject({ concepto: 'reducción', enLaAfirmacion: 'afirma', enElPasaje: 'niega' })
    expect(comoSeDice(c[0])).toMatch(/sostiene que hubo reducción y el pasaje citado la niega/)
  })

  it('y al revés: la afirmación niega y el pasaje afirma', () => {
    const c = contradiccionesEntre('No reduce la mortalidad', 'significantly reduced mortality at 30 days')
    expect(c).toHaveLength(1)
    expect(comoSeDice(c[0])).toMatch(/niega reducción y el pasaje citado la afirma/)
  })

  it('«failed to» y «no significant» también son negaciones', () => {
    expect(polaridadDe('the intervention failed to improve survival', ['improv'])).toBe('niega')
    expect(polaridadDe('there was no significant increase in events', ['increas'])).toBe('niega')
  })

  it('marca TODOS los conceptos en los que chocan, no el primero', () => {
    const c = contradiccionesEntre(
      'reduce la mortalidad y mejora la función',
      'did not reduce mortality; did not improve function',
    )
    expect(c.map(x => x.concepto).sort()).toEqual(['mejoría', 'reducción'])
  })
})

describe('cuándo se calla, que es lo que más importa', () => {
  it('LECTURA MIXTA — un pasaje con el concepto afirmado por algún lado no se marca', () => {
    /**
     * `did not increase adverse events **and** reduced mortality`: el «did not»
     * es de *increase*, no de *reduce*. Una ventana de caracteres a secas lo
     * habría atribuido a los dos — fue el peor falso positivo del módulo y lo
     * arregla el corte del alcance en la conjunción.
     */
    expect(polaridadDe('did not increase adverse events and reduced mortality', REDUC)).toBe('afirma')
    expect(contradiccionesEntre('reduce la mortalidad', 'did not increase adverse events and reduced mortality')).toEqual([])
  })

  it('el concepto no aparece en uno de los dos → no se dice nada', () => {
    expect(contradiccionesEntre('reduce la mortalidad', 'the study enrolled 400 patients')).toEqual([])
    expect(contradiccionesEntre('el estudio incluyó 400 pacientes', 'did not reduce mortality')).toEqual([])
  })

  it('coinciden → no hay nada que decir', () => {
    expect(contradiccionesEntre('reduce la mortalidad', 'reduced mortality significantly')).toEqual([])
    expect(contradiccionesEntre('no reduce la mortalidad', 'did not reduce mortality')).toEqual([])
  })
})

describe('las tres raíces que se descartaron, con su caso para que no vuelvan', () => {
  it('«lower» es «lower extremity», no una reducción', () => {
    expect(contradiccionesEntre('reduce la mortalidad', 'did not affect lower extremity function')).toEqual([])
    expect(RAICES_QUE_SE_DESCARTARON).toMatch(/lower extremity/)
  })

  it('«superior» es «vena cava superior», no superioridad', () => {
    expect(contradiccionesEntre('fue superior al comparador', 'catheter in the superior vena cava')).toEqual([])
  })

  it('un «no» suelto no puede negar un verbo que está afirmado', () => {
    /* «there was no change in weight but reduced mortality»: la reducción está
       afirmada, y el «no» es de otra cosa y al otro lado de la conjunción. */
    expect(polaridadDe('there was no change in weight but reduced mortality', REDUC)).toBe('afirma')
  })

  it('pero «no reduce», pegado, sí es una negación en español', () => {
    expect(polaridadDe('no reduce la mortalidad', REDUC)).toBe('niega')
    /* Y con un sustantivo en medio ya no es este verbo el que se niega. */
    expect(polaridadDe('pacientes con no diabetes redujeron la dosis', REDUC)).toBe('afirma')
  })
})

describe('el barrido sobre afirmaciones y artículos', () => {
  const ARTICULOS = [{ pmid: '111', titulo: 'T', resumen: 'the drug did not reduce mortality in the trial' }]

  it('resuelve el artículo por el índice que devolvió el modelo', () => {
    const r = citasQueDicenLoContrario(
      [{ texto: 'reduce la mortalidad', citas: [1], pasajes: ['did not reduce mortality'] }],
      ARTICULOS,
    )
    expect(r).toHaveLength(1)
    expect(r[0].pmid).toBe('111')
    expect(r[0].frase).toMatch(/reducción/)
  })

  it('NO necesita que el resumen venga estructurado — a diferencia de REG-400', () => {
    /* Ésos son justo los artículos que la comprobación de la sección no puede
       mirar: sin `secciones`, aquélla se calla y ésta sigue protegiendo. */
    expect(ARTICULOS[0]).not.toHaveProperty('secciones')
    expect(citasQueDicenLoContrario(
      [{ texto: 'reduce la mortalidad', citas: [1], pasajes: ['did not reduce mortality'] }], ARTICULOS,
    )).toHaveLength(1)
  })

  it('viaja en la verificación, y la rama sin fuentes también declara el campo', () => {
    const v = verificarAfirmaciones(
      [{ texto: 'reduce la mortalidad', citas: [1], pasajes: ['did not reduce mortality'] }],
      ARTICULOS, '2026-08-30T00:00:00.000Z',
    )
    expect(v.contradichasPorSuPasaje).toHaveLength(1)
    expect(verificarAfirmaciones([], [], '2026-08-30T00:00:00.000Z').contradichasPorSuPasaje).toEqual([])
  })
})

describe('lo que el módulo declara de sí mismo', () => {
  it('no se presenta como entailment, y dice por qué no reusa el motor de negaciones', () => {
    expect(POR_QUE_NO_ES_UN_EVALUADOR_DE_ENTAILMENT).toMatch(/exige un modelo/)
    expect(POR_QUE_SOLO_SI_TODAS_ESTAN_NEGADAS).toMatch(/se deja de leer/)
    expect(POR_QUE_NO_SE_REUSA_EL_MOTOR_DE_NEGACIONES).toMatch(/EL PACIENTE niega/)
  })

  it('el vocabulario tiene tamaño de vocabulario y no está vacío', () => {
    expect(EFECTOS.length).toBeGreaterThanOrEqual(6)
    for (const e of EFECTOS) expect(e.raices.length).toBeGreaterThan(0)
  })
})

describe('conexión — SUBSTRING, no punta a punta (ver cabecera)', () => {
  it('la ruta de evidencia avisa de las contradichas, aparte de los otros dos defectos', () => {
    const ruta = readFileSync('src/app/api/expediente/evidencia/route.ts', 'utf8')
    expect(ruta).toContain('verificacion.contradichasPorSuPasaje.length > 0')
    expect(ruta).toContain('LO CONTRARIO')
  })
})
