/**
 * GOLDEN — «Niega alergia a penicilina» disparaba una alerta CRÍTICA de alergia.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Auditoría del 7-ago-2026, siguiendo el camino del campo de alergias hasta su
 * último consumidor. REG-144 había unificado cuatro parsers en `alergenosDe` y
 * dejó un guardián para impedir el quinto. El guardián buscaba un `split` a
 * mano; el consumidor que faltaba **no partía el campo en absoluto**:
 * `alergiaVsReceta` (el cruce alergia↔fármaco del copiloto) hacía
 * `norm(e.alergias).includes('penicilina')` sobre el campo ENTERO, con su propio
 * limpiador de palabras de negación.
 *
 * Reproducido con el motor real antes de tocar nada: de nueve frases de
 * consultorio, **cuatro daban una crítica falsa**.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * La negación va pegada a UN alérgeno; el `includes` mira todos a la vez. Por
 * eso el limpiador no podía funcionar aunque se le añadieran palabras: en
 * «Niega alergia a penicilina» sobra «a penicilina» después de limpiar, así que
 * la comprobación seguía viva y el campo seguía conteniendo «penicilina».
 * Y en «Niega penicilina. Alérgico a sulfas» **las dos** familias saltaban,
 * porque el campo entero contiene las dos palabras.
 *
 * ── POR QUÉ IMPORTA PARA UN PACIENTE ─────────────────────────────────────────
 *
 * El aviso de alergia es de los que **no se pliegan** (`avisos-consulta.ts`, y
 * es la decisión correcta: es lo más grave de esa pantalla). Un aviso que no se
 * puede cerrar y que es falso deja al médico una sola salida: **borrar el texto
 * del expediente** para poder trabajar — mutilando el registro. Es literalmente
 * el desenlace que la cabecera de `alergias.ts` describe como el fallo a evitar.
 *
 * Y el daño no se queda en el paciente equivocado: una crítica roja que sale
 * donde no debe enseña a ignorar las críticas rojas. La siguiente sí será real.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * El campo de alergias se lee **alérgeno por alérgeno**, y siempre por
 * `alergenosDe`: es el único sitio donde vive cómo se parte el campo y qué
 * fragmento está negado. Un consumidor que lo lea entero está afirmando que la
 * negación es del campo, y nunca lo es.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * · **No amplía ni recorta las familias de alergia.** `FAMILIAS_ALERGIA` sigue
 *   igual: los mismos disparadores, los mismos miembros, la misma precaución de
 *   carbapenémicos. Un fármaco que no esté en la tabla sigue sin vigilarse — eso
 *   es vocabulario, no criterio.
 * · **No cambia el nivel del aviso ni qué bloquea la firma.** Sigue sin plegarse
 *   y sigue sin impedir firmar; eso lo decidió el médico dueño (REG-181).
 * · **No juzga la reacción previa.** «Alérgico a penicilina: sólo rash» y una
 *   anafilaxia entran igual. Distinguirlas es decisión clínica (C-3 en
 *   OWNER_DECISIONS_REQUIRED).
 * · **No garantiza que una negación rara se entienda.** `alergenosDe` reconoce
 *   los negadores de su lista; uno nuevo («descarta alergia a…») haría falta
 *   añadirlo ahí, y esta prueba lo vería fallar, no lo adivinaría.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { copiloto } from '@/lib/expediente/copiloto'

const criticasDeAlergia = (alergias: string, medicamento: string) =>
  copiloto({ alergias, medicamentos: [{ nombre: medicamento, dosis: '500 mg' }] })
    .filter(s => s.id.startsWith('alergia:'))

describe('UNA NEGACIÓN NO ES UNA ALERGIA', () => {
  /**
   * Las cuatro frases que daban crítica falsa, tal como las escribe el médico.
   * Se comprobó que fallan sin el arreglo: con el `includes` sobre el campo
   * entero, las cuatro devolvían `critico`.
   */
  it('«Niega alergia a penicilina» + amoxicilina NO alerta', () => {
    expect(criticasDeAlergia('Niega alergia a penicilina', 'Amoxicilina')).toEqual([])
  })

  it('«No refiere alergia a penicilina» + amoxicilina NO alerta', () => {
    expect(criticasDeAlergia('No refiere alergia a penicilina', 'Amoxicilina')).toEqual([])
  })

  it('«Niega alergia a sulfas» + TMP/SMX NO alerta', () => {
    expect(criticasDeAlergia('Niega alergia a sulfas', 'Trimetoprima/sulfametoxazol')).toEqual([])
  })

  it('«Sin alergia a AINEs» + ketorolaco NO alerta', () => {
    expect(criticasDeAlergia('Sin alergia a AINEs', 'Ketorolaco')).toEqual([])
  })
})

describe('LO QUE SÍ TIENE QUE SEGUIR SALTANDO', () => {
  /**
   * La mitad cara de este arreglo. Callar una alergia real es peor que gritar
   * una falsa, así que cada caso que ya funcionaba se fija aquí.
   */
  it('«Alérgico a penicilina» + amoxicilina sigue siendo crítico', () => {
    const s = criticasDeAlergia('Alérgico a penicilina', 'Amoxicilina')
    expect(s.map(x => x.nivel)).toEqual(['critico'])
  })

  it('la familia entera: penicilina registrada + ceftriaxona', () => {
    // Comparar sólo por nombre exacto dejaría pasar justo el caso peligroso.
    const s = criticasDeAlergia('Alérgico a penicilina', 'Ceftriaxona')
    expect(s.map(x => x.nivel)).toEqual(['critico'])
  })

  it('«Sulfas; no refiere otras» + TMP/SMX sigue saltando', () => {
    // El fraseo mexicano que ya había roto esto una vez: la negación se refiere
    // a OTRAS alergias, no a la que está escrita delante.
    const s = criticasDeAlergia('Sulfas; no refiere otras', 'Trimetoprima/sulfametoxazol')
    expect(s.map(x => x.nivel)).toEqual(['critico'])
  })

  it('carbapenémico ante alergia a penicilina: precaución, no choque', () => {
    // Reactividad cruzada ≈1%: empujar a evitar meropenem en una meningitis
    // haría más daño que el aviso.
    const s = criticasDeAlergia('Alérgico a penicilina', 'Meropenem')
    expect(s.map(x => x.nivel)).toEqual(['accion'])
  })
})

describe('UN CAMPO CON UNA NEGADA Y UNA REAL', () => {
  /**
   * El caso que ninguna de las dos mitades cubre por separado, y el que prueba
   * que el defecto era leer el campo entero: la negación es de la penicilina y
   * la alergia es de las sulfas, en la misma línea.
   */
  const CAMPO = 'Niega penicilina. Alérgico a sulfas'

  it('la penicilina negada NO alerta con amoxicilina', () => {
    expect(criticasDeAlergia(CAMPO, 'Amoxicilina')).toEqual([])
  })

  it('y la sulfa real SÍ alerta con TMP/SMX', () => {
    expect(criticasDeAlergia(CAMPO, 'Trimetoprima/sulfametoxazol').map(x => x.nivel)).toEqual(['critico'])
  })
})

describe('EL PACIENTE MEJOR DOCUMENTADO TAMBIÉN SE CRUZA', () => {
  /**
   * `alergiasEstructuradas` no lo llena hoy ninguna ruta de escritura, pero
   * cualquier importación desde otro sistema lo activa el mismo día — y hasta
   * este arreglo el cruce no lo miraba: el paciente con sus alergias bien
   * capturadas y el texto libre vacío era **el único sin cruce**.
   */
  it('con las estructuradas y el texto libre vacío, la alerta sale igual', () => {
    const s = copiloto({
      alergiasEstructuradas: [{ alergeno: 'Penicilina' }],
      medicamentos: [{ nombre: 'Amoxicilina', dosis: '500 mg' }],
    }).filter(x => x.id.startsWith('alergia:'))
    expect(s.map(x => x.nivel)).toEqual(['critico'])
  })

  it('sin alergias de ninguna forma, no se inventa ninguna', () => {
    expect(copiloto({ medicamentos: [{ nombre: 'Amoxicilina' }] })
      .filter(x => x.id.startsWith('alergia:'))).toEqual([])
  })
})

describe('GUARDIÁN — el cruce no vuelve a leer el campo entero', () => {
  const src = readFileSync(join(process.cwd(), 'src', 'lib', 'expediente', 'copiloto.ts'), 'utf8')

  it('el copiloto lee las alergias por `alergenosDe`', () => {
    expect(src).toContain('alergenosDe({')
  })

  it('y no vuelve a normalizar el campo a mano para compararlo', () => {
    /**
     * El guardián de REG-144 buscaba un quinto `split`. Éste busca lo otro: un
     * consumidor que trate el campo como una sola cadena, que es el mismo
     * defecto hecho más grande.
     */
    expect(src, 'el cruce volvió a leer el campo de alergias entero')
      .not.toMatch(/norm\(\s*e\.alergias/)
  })
})
