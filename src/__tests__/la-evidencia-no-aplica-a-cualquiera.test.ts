/**
 * GOLDEN — «¿esta evidencia aplica a ESTE paciente?» no la contestaba nadie.
 *
 * ── QUÉ FALTABA ─────────────────────────────────────────────────────────────
 *
 * WS-09 estaba `NOT_STARTED`, y no era «parcial»: `grep aplicabilidad` sobre
 * `src/` no devolvía **nada**. La adaptación al paciente era **sólo por prompt**
 * —«personaliza por edad, comorbilidades y alergias»— sin compuerta determinista,
 * sin cruce, y sin forma de decir «este paciente no cumple la población del
 * estudio».
 *
 * Un ensayo hecho en adultos de 18 a 65 años sin insuficiencia renal se le
 * enseñaba igual al médico con un paciente de 82 con TFG de 22 delante.
 *
 * ── LA DECISIÓN QUE ESTE GOLDEN PROTEGE ─────────────────────────────────────
 *
 * **No existe el veredicto «aplica».** El máximo es `nada_lo_excluye`.
 *
 * Decir «aplica» afirmaría haber leído y comprobado **todos** los criterios, y el
 * motor sólo entiende con certeza unos pocos patrones. Un motor que redondea su
 * ignorancia hacia arriba es peor que no tenerlo: le da al médico una
 * tranquilidad que nadie comprobó. Hay un caso que falla si alguien añade ese
 * veredicto.
 *
 * ── LAS DOS REGLAS DURAS ────────────────────────────────────────────────────
 *
 * 1. **Las cifras salen del criterio.** El módulo no define ni un umbral. Se
 *    prueba cambiando el número del criterio y viendo cambiar el veredicto —una
 *    prueba de comportamiento, no un `grep` de literales.
 * 2. **Ausencia de dato no es dato de ausencia.** El caso que justifica el
 *    módulo entero: estudio que excluye embarazadas, paciente cuyo embarazo no
 *    consta → `datos_insuficientes`, jamás «nada lo excluye».
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **Cuatro dimensiones, no dieciocho.** Edad, embarazo, función renal y
 *   alergia. Organismo, susceptibilidad, sitio de infección, dispositivo,
 *   severidad, entorno de atención, terapia previa y jurisdicción **no se leen**,
 *   y por eso caen en `no_evaluable` y se cuentan. Está declarado, no tapado.
 * · **No decide conducta.** Que la evidencia aplique no indica el tratamiento, y
 *   que no aplique no lo contraindica.
 * · **Lee prosa con patrones estrictos.** Un criterio redactado de otra forma no
 *   se interpreta: se declara ilegible. Señalar de menos, nunca de más.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  aplicabilidad, evaluarCriterio, dimensionDe, sinPoblacionDeclarada,
  aplicabilidadDesdeResumen, criteriosDelResumen,
  comoSeDiceLaAplicabilidad, POR_QUE_NO_EXISTE_APLICA, DE_DONDE_SALEN_LAS_CIFRAS,
  LO_QUE_NO_DECIDE,
  type EstadoDelPaciente,
} from '@/lib/evidencia/aplicabilidad'

const inc = (texto: string) => ({ texto, clase: 'inclusion' as const })
const exc = (texto: string) => ({ texto, clase: 'exclusion' as const })

describe('el paciente que queda fuera de la población', () => {
  it('un ensayo de 18 a 65 años no aplica a un paciente de 82', () => {
    const r = aplicabilidad([inc('Adultos de 18 a 65 años')], { edadEnAnios: 82 })
    expect(r.veredicto).toBe('no_aplica')
    expect(r.porQue).toContain('82')
    expect(r.porQue).toContain('65')
  })

  it('y sí lo incluye a los 40', () => {
    const r = aplicabilidad([inc('Adultos de 18 a 65 años')], { edadEnAnios: 40 })
    expect(r.veredicto).toBe('nada_lo_excluye')
  })

  it('satisfacer un criterio de EXCLUSIÓN deja fuera al paciente', () => {
    /* La asimetría es la mitad del modelo: cumplir una inclusión suma, cumplir
       una exclusión resta. Confundirlas invierte el veredicto. */
    const r = aplicabilidad([exc('Se excluyeron pacientes con TFG < 30')], { tfg: { valor: 22, vigente: true } })
    expect(r.veredicto).toBe('no_aplica')
  })

  it('y no cumplirla lo deja dentro', () => {
    const r = aplicabilidad([exc('Se excluyeron pacientes con TFG < 30')], { tfg: { valor: 88, vigente: true } })
    expect(r.veredicto).toBe('nada_lo_excluye')
  })
})

describe('las cifras salen del criterio, no de este módulo', () => {
  /**
   * La prueba de que el módulo no tiene umbrales propios es de COMPORTAMIENTO y
   * no de texto: se cambia el número del criterio y el veredicto cambia con él.
   * Un `grep` de literales no probaría esto — un umbral escondido podría estar
   * escrito con palabras.
   */
  it('el mismo paciente entra o sale según lo que diga el estudio', () => {
    const paciente: EstadoDelPaciente = { edadEnAnios: 70 }
    expect(aplicabilidad([inc('mayores de 65 años')], paciente).veredicto).toBe('nada_lo_excluye')
    expect(aplicabilidad([inc('mayores de 75 años')], paciente).veredicto).toBe('no_aplica')
  })

  it('lo mismo con la función renal', () => {
    const paciente: EstadoDelPaciente = { tfg: { valor: 45, vigente: true } }
    expect(aplicabilidad([exc('excluidos con TFG < 30')], paciente).veredicto).toBe('nada_lo_excluye')
    expect(aplicabilidad([exc('excluidos con TFG < 60')], paciente).veredicto).toBe('no_aplica')
  })

  it('y el módulo lo declara por escrito', () => {
    expect(DE_DONDE_SALEN_LAS_CIFRAS).toMatch(/De ninguna parte de este archivo/)
  })
})

describe('ausencia de dato no es dato de ausencia', () => {
  it('EL CASO: excluye embarazadas y el embarazo no consta', () => {
    /**
     * Éste es el caso que justifica el módulo entero. La respuesta cómoda sería
     * «nada lo excluye»; la correcta es que no se sabe. Que nadie lo haya
     * anotado no significa que no lo esté.
     */
    const r = aplicabilidad([exc('Se excluyeron mujeres embarazadas')], { edadEnAnios: 30 })
    expect(r.veredicto).toBe('datos_insuficientes')
    expect(r.porQue).toMatch(/No consta ≠ no lo está/)
  })

  it('con el embarazo registrado en `false`, sí decide', () => {
    /* La diferencia entre «no consta» y «consta que no» es el módulo entero. */
    const r = aplicabilidad([exc('Se excluyeron mujeres embarazadas')], { edadEnAnios: 30, embarazo: false })
    expect(r.veredicto).toBe('nada_lo_excluye')
  })

  it('y con embarazo registrado en `true`, excluye', () => {
    const r = aplicabilidad([exc('Se excluyeron mujeres embarazadas')], { embarazo: true })
    expect(r.veredicto).toBe('no_aplica')
  })

  it('la duda gana a la tranquilidad: un criterio dudoso tiñe el conjunto', () => {
    /* Aunque todo lo demás salga bien, no se redondea hacia «nada lo excluye». */
    const r = aplicabilidad(
      [inc('mayores de 18 años'), exc('Se excluyeron embarazadas')],
      { edadEnAnios: 44 },
    )
    expect(r.veredicto).toBe('datos_insuficientes')
  })

  it('pero excluir gana a dudar: si ya está fuera, no hace falta la duda', () => {
    const r = aplicabilidad(
      [inc('mayores de 65 años'), exc('Se excluyeron embarazadas')],
      { edadEnAnios: 30 },
    )
    expect(r.veredicto).toBe('no_aplica')
  })
})

describe('una función renal caduca no decide (REG-375)', () => {
  it('fuera de ventana, el criterio renal queda en datos insuficientes', () => {
    /* Un número viejo no es un número: la misma regla que la dosificación. */
    const r = aplicabilidad([exc('excluidos con TFG < 30')], { tfg: { valor: 22, vigente: false } })
    expect(r.veredicto).toBe('datos_insuficientes')
    expect(r.porQue).toMatch(/fuera de la ventana/)
  })

  it('y con la misma cifra vigente, sí excluye', () => {
    const r = aplicabilidad([exc('excluidos con TFG < 30')], { tfg: { valor: 22, vigente: true } })
    expect(r.veredicto).toBe('no_aplica')
  })
})

describe('lo que no sabe leer, lo declara — no lo interpreta', () => {
  it('un criterio de organismo o de severidad queda sin leer y se cuenta', () => {
    const r = aplicabilidad(
      [inc('Infección documentada por Pseudomonas aeruginosa multirresistente')],
      { edadEnAnios: 50 },
    )
    expect(r.veredicto).toBe('nada_lo_excluye')
    expect(r.noLeidos).toBe(1)
    expect(r.porQue).toContain('1 criterios sin leer')
  })

  it('y la frase de pantalla lo dice, no lo esconde', () => {
    const r = aplicabilidad([inc('Choque séptico refractario a vasopresores')], { edadEnAnios: 50 })
    expect(comoSeDiceLaAplicabilidad(r)).toContain('sin leer')
  })

  it('`dimensionDe` devuelve null en vez de adivinar', () => {
    /**
     * REG-575 — este caso pedía `null` para «Pacientes con neumonía adquirida en
     * la comunidad», y era cierto mientras el motor no sabía leer comorbilidades.
     * Ahora las lee, y ésa ES la lectura correcta: el criterio nombra una
     * condición del paciente. Se cambia la aserción, no el patrón.
     *
     * Lo que este caso sigue vigilando —que no se adivine— se comprueba abajo con
     * frases que NO nombran ninguna dimensión.
     */
    expect(dimensionDe('Pacientes con neumonía adquirida en la comunidad')).toBe('comorbilidad')
    expect(dimensionDe('El estudio se realizó entre 2019 y 2022')).toBeNull()
    expect(dimensionDe('Consentimiento informado firmado')).toBeNull()
    expect(dimensionDe('mayores de 65 años')).toBe('edad')
    expect(dimensionDe('excluidas embarazadas')).toBe('embarazo')
    expect(dimensionDe('depuración de creatinina menor de 30')).toBe('funcion_renal')
    expect(dimensionDe('alergia conocida a penicilina')).toBe('alergia')
  })

  it('un criterio de alergia sin lista de alergias no se da por cumplido ni por incumplido', () => {
    const r = evaluarCriterio('Alergia conocida a penicilina', 'exclusion', { edadEnAnios: 50 })
    expect(r.veredicto).toBe('datos_insuficientes')
  })

  it('y con la lista, decide', () => {
    const conAlergia = evaluarCriterio('Alergia conocida a penicilina', 'exclusion', { alergenos: ['Penicilina'] })
    expect(conAlergia.veredicto).toBe('cumple')
    const sinAlergia = evaluarCriterio('Alergia conocida a penicilina', 'exclusion', { alergenos: ['Sulfas'] })
    expect(sinAlergia.veredicto).toBe('no_cumple')
  })
})

describe('sin población declarada no hay contra qué comprobar', () => {
  it('un estudio cuya población no se conoce sale en datos insuficientes', () => {
    /* `Declarado<T>` permite decir «no lo sé y por qué». La respuesta a eso no
       puede ser «aplica». */
    const r = sinPoblacionDeclarada('el pasaje no la menciona')
    expect(r.veredicto).toBe('datos_insuficientes')
    expect(r.porQue).toMatch(/no hay contra qué comprobar/)
  })

  it('una lista de criterios vacía tampoco afirma nada de más', () => {
    const r = aplicabilidad([], { edadEnAnios: 50 })
    expect(r.veredicto).toBe('nada_lo_excluye')
    expect(r.noLeidos).toBe(0)
  })
})

describe('el veredicto «aplica» no existe, y no debe existir', () => {
  it('ningún camino del motor lo produce', () => {
    /**
     * Se recorren combinaciones deliberadamente favorables: si alguna devolviera
     * algo distinto de los tres veredictos honestos, este caso lo caza.
     */
    const casos: { c: { texto: string; clase: 'inclusion' | 'exclusion' }[]; p: EstadoDelPaciente }[] = [
      { c: [inc('mayores de 18 años')], p: { edadEnAnios: 50 } },
      { c: [exc('excluidas embarazadas')], p: { embarazo: false } },
      { c: [], p: {} },
      { c: [inc('mayores de 18 años'), exc('TFG < 30')], p: { edadEnAnios: 50, tfg: { valor: 90, vigente: true } } },
    ]
    for (const { c, p } of casos) {
      expect(['no_aplica', 'datos_insuficientes', 'nada_lo_excluye']).toContain(aplicabilidad(c, p).veredicto)
    }
  })

  it('y el módulo explica por qué el máximo es «nada lo excluye»', () => {
    expect(POR_QUE_NO_EXISTE_APLICA).toMatch(/redondea su ignorancia hacia arriba/)
  })

  it('el motor declara que no decide conducta', () => {
    /* Que la evidencia aplique no indica el tratamiento, y que no aplique no lo
       contraindica. Sin esto escrito, alguien leería el veredicto como consejo. */
    expect(LO_QUE_NO_DECIDE).toMatch(/no lo indica/)
    expect(LO_QUE_NO_DECIDE).toMatch(/no lo contraindica/)
  })
})


describe('el camino que existe hoy: el resumen de PubMed, en inglés', () => {
  /**
   * Los criterios estructurados los escribiría el producto en español; los
   * resúmenes llegan de PubMed **en inglés**. Un motor que sólo leyera español
   * declararía `no_evaluable` el 100 % de los resúmenes reales y parecería
   * prudente cuando en realidad estaría ciego.
   */
  const RESUMEN =
    'We randomized 412 adults aged 18 to 65 years with community-acquired pneumonia. ' +
    'Pregnant women were excluded. ' +
    'The primary outcome was 30-day mortality.'

  it('reconoce sólo las frases que sabe leer, y las clasifica', () => {
    const c = criteriosDelResumen(RESUMEN)
    expect(c.length).toBe(2)
    expect(c.find(x => /aged 18 to 65/.test(x.texto))?.clase).toBe('inclusion')
    expect(c.find(x => /Pregnant/.test(x.texto))?.clase).toBe('exclusion')
    /* La frase del desenlace no habla de población: no se cuenta ni se inventa. */
    expect(c.some(x => /primary outcome/.test(x.texto))).toBe(false)
  })

  it('un paciente de 82 queda fuera de un ensayo de 18 a 65', () => {
    const r = aplicabilidadDesdeResumen(RESUMEN, { edadEnAnios: 82, embarazo: false })
    expect(r.veredicto).toBe('no_aplica')
  })

  it('y con el embarazo sin constar, no se da por aplicable', () => {
    const r = aplicabilidadDesdeResumen(RESUMEN, { edadEnAnios: 40 })
    expect(r.veredicto).toBe('datos_insuficientes')
  })

  it('la frase de pantalla DICE que salió del resumen', () => {
    /**
     * Es la diferencia entre «revisé los criterios del estudio» y «reconocí
     * frases en un resumen». Sin decirlo, el médico leería lo primero.
     */
    const r = aplicabilidadDesdeResumen(RESUMEN, { edadEnAnios: 40, embarazo: false })
    expect(comoSeDiceLaAplicabilidad(r)).toContain('según lo que dice el resumen')
    expect(r.desdeResumen).toBe(true)
  })

  it('un resumen sin nada reconocible no afirma que nada lo excluya', () => {
    /* Con cero frases reconocidas, «nada lo excluye» sería una afirmación sobre
       algo que no se miró. Sale `datos_insuficientes`. */
    const r = aplicabilidadDesdeResumen('This review discusses treatment options.', { edadEnAnios: 40 })
    expect(r.veredicto).toBe('datos_insuficientes')
    expect(r.porQue).toMatch(/no se reconoció ninguna frase/)
  })

  it('también lee un corte renal en inglés', () => {
    const r = aplicabilidadDesdeResumen(
      'Patients with creatinine clearance below 30 mL/min were excluded.',
      { tfg: { valor: 22, vigente: true } },
    )
    expect(r.veredicto).toBe('no_aplica')
  })
})


describe('el dato LLEGA: se calcula, viaja y se pinta', () => {
  /**
   * La familia de defectos más repetida de este repositorio es la del cálculo
   * que nadie lee (REG-345: los avisos de evidencia se calculaban y la pantalla
   * los tiraba). Un motor de aplicabilidad sin consumidor sería exactamente eso,
   * y encima en el sitio donde ya pasó una vez.
   */
  const ruta = readFileSync('src/app/api/expediente/evidencia/route.ts', 'utf8')
  const pagina = readFileSync('src/app/(dashboard)/consulta/[patientId]/page.tsx', 'utf8')

  it('la ruta lo calcula para cada artículo', () => {
    expect(ruta).toMatch(/aplicabilidadDesdeResumen/)
    expect(ruta).toMatch(/articulos\.map\(a =>/)
  })

  it('y lo devuelve en la respuesta', () => {
    expect(ruta).toMatch(/_aplicabilidad: aplicabilidadPorArticulo/)
  })

  it('la consulta lo recibe y lo guarda', () => {
    expect(pagina).toMatch(/aplicabilidad: data\._aplicabilidad/)
  })

  it('y lo PINTA junto a la fuente', () => {
    /* Pegado al artículo, que es donde el médico decide si lo abre. */
    expect(pagina).toMatch(/evidencia\.aplicabilidad \?\? \[\]/)
    expect(pagina).toMatch(/veredicto === 'no_aplica'/)
  })

  it('no filtra ni reordena los artículos', () => {
    /**
     * Quitar de la vista un artículo porque un patrón no casó sería peor que no
     * tener esto: el médico dejaría de ver literatura por una heurística. Se
     * ANOTA, no se esconde.
     */
    expect(ruta).not.toMatch(/articulos\s*=\s*articulos\.filter/)
    expect(ruta).not.toMatch(/\.filter\(a => aplicab/)
  })

  it('y no dice nada cuando no hay nada que decir', () => {
    /* «Nada lo excluye» repetido en doce fuentes es ruido que se aprende a
       ignorar — y entonces el aviso que sí importa tampoco se lee. */
    expect(pagina).toMatch(/\(fuera \|\| dudoso\) &&/)
  })
})
