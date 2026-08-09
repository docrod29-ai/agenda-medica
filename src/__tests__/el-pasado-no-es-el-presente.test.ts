/**
 * GOLDEN — «tuvo neumonía hace 3 años» acababa escrito como padecimiento actual.
 *
 * ── DE DÓNDE SALE ───────────────────────────────────────────────────────────
 *
 * De la auditoría de voz del propio charter, sección «lo que NO se mide»: la
 * negación tiene motor determinista y caso oro desde la v985, y **la
 * temporalidad no tenía nada**. Es el hermano del fallo que costó tres versiones
 * cerrar: allí el interrogatorio nombraba la enfermedad en la PREGUNTA y el
 * extractor la cosechaba; aquí la nombra en PASADO y se cosecha igual.
 *
 * Y se arrastra igual: queda en el expediente, se copia a la nota siguiente y
 * cambia lo que otro médico lee dentro de seis meses.
 *
 * ── LO QUE ESTE MOTOR ES, Y LO QUE NO ───────────────────────────────────────
 *
 * Es gramática, no medicina. No decide si una enfermedad sigue activa —eso es
 * clínico y no es suyo—: decide si el dictado la puso en pasado y la nota la
 * afirma en presente, y enseña las dos frases. El mismo criterio de la intención
 * de orden (REG-130).
 *
 * ── LA TRAMPA, QUE ES LA MITAD DEL TRABAJO ──────────────────────────────────
 *
 * «Desde hace tres años tiene diabetes» trae una marca de tiempo y es PRESENTE:
 * es la forma normal de contar un padecimiento crónico. Un aviso que salta ahí
 * se acaba ignorando, y con él se ignoran los que sí importan.
 */
import { describe, it, expect } from 'vitest'
import { NIVEL, NO_SE_PLIEGAN } from '@/lib/expediente/avisos-consulta'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PROMPT_VERSION } from '@/lib/expediente/prompt-version'
import {
  esFrasePasada, mencionesEnPasado, desajustesTemporales, avisoDeDesajuste,
  padecimientosEn, AGUDAS_FRECUENTES,
  CABEZAS_QUE_NO_NOMBRAN_SOLAS, LO_QUE_NO_DISTINGUE,
  POR_QUE_EL_PRESENTE_MANDA, POR_QUE_NO_DECIDE, POR_QUE_IMPORTA,
} from '@/lib/expediente/temporalidad'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

describe('EL CASO QUE LO MOTIVA', () => {
  it('«tuvo cáncer hace tres años» y la nota lo pone como actual → avisa', () => {
    const dictado = 'El paciente tuvo cáncer hace tres años. Hoy viene por dolor de garganta.'
    const nota = 'Paciente con cáncer. Refiere odinofagia de dos días.'
    const d = desajustesTemporales(mencionesEnPasado(dictado), nota)
    expect(d).toHaveLength(1)
    expect(d[0].condicion).toBe('cáncer')
    expect(d[0].cita).toContain('tuvo cáncer hace tres años')
  })

  it('el aviso enseña las DOS frases y no dice cuál vale', () => {
    const dictado = 'Tuvo tuberculosis en 2019.'
    const d = desajustesTemporales(mencionesEnPasado(dictado), 'Paciente con tuberculosis en estudio.')
    const texto = avisoDeDesajuste(d[0])
    expect(texto).toContain('en el dictado se dijo en pasado')
    expect(texto).toContain('la nota lo afirma como actual')
    expect(texto).toContain('Revisa si es antecedente o padecimiento actual')
  })
})

describe('LA TRAMPA: «desde hace» ES PRESENTE', () => {
  it('«desde hace tres años tiene diabetes» NO se marca', () => {
    /**
     * La forma más común de contar un crónico en la consulta mexicana. Marcarla
     * sería peor que no mirar nada.
     */
    expect(esFrasePasada('Desde hace tres años tiene diabetes.')).toBe(false)
    expect(mencionesEnPasado('Desde hace tres años tiene diabetes.')).toEqual([])
  })

  it('ni «sigue con», «todavía», «actualmente», «en control» o «en tratamiento»', () => {
    for (const f of [
      'Tuvo hipertensión y sigue con hipertensión.',
      'Padeció asma y todavía tiene asma.',
      'Tenía diabetes, actualmente con diabetes descontrolada.',
      'Diabetes en control desde 2019.',
      'Hipotiroidismo en tratamiento desde hace años.',
    ]) {
      expect(esFrasePasada(f), f).toBe(false)
    }
  })

  it('y está escrito por qué el presente manda', () => {
    expect(POR_QUE_EL_PRESENTE_MANDA).toMatch(/se acaba ignorando/)
  })
})

describe('LO QUE SÍ CUENTA COMO PASADO', () => {
  it('el verbo: «tuvo», «tenía», «padeció», «le operaron», «ya se le quitó»', () => {
    for (const f of [
      'Tuvo epilepsia.',
      'Tenía asma de niño.',
      'Padeció tuberculosis.',
      'Le operaron de cáncer.',
      'Ya se le quitó el asma.',
    ]) {
      expect(esFrasePasada(f), f).toBe(true)
    }
  })

  it('y la marca de cuándo: «hace N años», «en 2019», «años atrás»', () => {
    for (const f of [
      'Cáncer hace cinco años.',
      'Tuberculosis en 2018.',
      'Epilepsia años atrás.',
    ]) {
      expect(esFrasePasada(f), f).toBe(true)
    }
  })
})

describe('NO AVISA CUANDO LA NOTA YA LO ESCRIBIÓ BIEN', () => {
  it('si la nota dice «antecedente de», no hay nada que avisar', () => {
    const dictado = 'Tuvo tuberculosis hace diez años.'
    for (const nota of [
      'Antecedente de tuberculosis tratada.',
      'Historia de tuberculosis en la juventud.',
      'Tuvo tuberculosis, resuelta.',
    ]) {
      expect(desajustesTemporales(mencionesEnPasado(dictado), nota), nota).toEqual([])
    }
  })

  it('ni cuando la nota no lo menciona siquiera', () => {
    const d = desajustesTemporales(mencionesEnPasado('Tuvo asma de niño.'), 'Faringitis aguda.')
    expect(d).toEqual([])
  })

  it('sin dictado no inventa nada', () => {
    expect(mencionesEnPasado('')).toEqual([])
    expect(desajustesTemporales([], 'Paciente con diabetes.')).toEqual([])
  })
})

describe('LO QUE EL MOTOR NO HACE — la parte que lo hace seguro', () => {
  it('no borra ni reclasifica: sólo devuelve avisos', () => {
    /**
     * Un padecimiento de hace años puede seguir importando como antecedente, y
     * escribirlo no es un error. La que no vale es la versión que nadie miró.
     */
    const d = desajustesTemporales(mencionesEnPasado('Tuvo cáncer en 2015.'), 'Paciente con cáncer.')
    expect(Object.keys(d[0]).sort()).toEqual(['cita', 'condicion', 'enLaNota'])
  })

  it('y están escritas las razones', () => {
    expect(POR_QUE_NO_DECIDE).toMatch(/gramática, no medicina/)
    expect(POR_QUE_IMPORTA).toMatch(/dentro de seis meses/)
  })
})

describe('ESTÁ CONECTADO A LA CONSULTA', () => {
  const page = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')

  it('se calcula contra TODO lo que la nota afirma, no sólo el resumen', () => {
    // El expediente se lee entero: da igual en qué campo aparezca.
    expect(page).toContain('const pasadas = mencionesEnPasado(dictado)')
    expect(page).toContain('return desajustesTemporales(pasadas, textoNota)')
  })

  it('y se enseña, en ámbar y no en rojo', () => {
    /**
     * Escribir un padecimiento pasado no es un error como lo es afirmar algo que
     * el paciente negó. El color dice cuánto pesa: igualarlos gastaría el rojo.
     */
    /**
     * ── TRASLADADO A LA BARRA (5-ago-2026, REG-181) ───────────────────────
     * Los siete recuadros de la consulta son ahora una barra de tres niveles.
     * Lo que esta prueba protege no cambió; cambió DÓNDE está escrito: el nivel
     * y el color los decide `avisos-consulta.ts`, un módulo puro cuya tabla se
     * puede vigilar de un vistazo — que es más de lo que se podía hacer con el
     * `tone="…"` de un JSX de 5000 líneas.
     */
    expect(NIVEL.desajuste_temporal).toBe('revisa')
    expect(page).toContain('avisoDeDesajuste(d)')
    expect(page).toContain('construirAvisos(')
    // Y la negación pesa más: no bloquea, pero NO se pliega nunca — el
    // desajuste temporal sí. Ésa es la diferencia de peso, ahora explícita.
    expect(NO_SE_PLIEGAN).toContain('contradiccion_negacion')
    expect(NO_SE_PLIEGAN).not.toContain('desajuste_temporal')
  })
})

/**
 * ── LA SEGUNDA PUERTA (v1028) ────────────────────────────────────────────────
 *
 * La nota no es el único sitio donde se cosecha el pasado. El extractor de
 * entidades corre sobre EL MISMO texto y su `estado` **nace en `activo` por
 * omisión del esquema**, así que «tuvo neumonía hace tres años» sale como una
 * condición activa — y una entidad estructurada tiene peor pinta que una frase:
 * parece un dato verificado.
 *
 * Es exactamente lo que pasó con las negaciones, y por eso allí quedó escrito
 * que arreglarlo en una pantalla dejaría la otra rota.
 */
describe('LA SEGUNDA PUERTA: EL EXTRACTOR DE ENTIDADES', () => {
  it('una condición ACTIVA que el dictado puso en pasado se señala', async () => {
    const { avisosTemporalesDelExtractor } = await import('@/lib/expediente/temporalidad')
    const pasadas = mencionesEnPasado('Tuvo tuberculosis hace diez años.')
    const avisos = avisosTemporalesDelExtractor([{ texto: 'tuberculosis', estado: 'activo' }], pasadas)
    expect(avisos).toHaveLength(1)
    expect(avisos[0].condicion).toBe('tuberculosis')
  })

  it('pero NO se toca: se devuelve el aviso, no una condición modificada', async () => {
    /**
     * Con una negación se puede reclasificar —el paciente dijo que no—. Aquí no
     * hay nada equivalente: pasar algo a «resuelto» porque la frase iba en
     * pretérito sería una decisión clínica. Una neumonía de hace tres años puede
     * estar resuelta; una cardiopatía no lo está por contarla en pasado.
     */
    const { avisosTemporalesDelExtractor, POR_QUE_AQUI_NO_SE_RECLASIFICA } = await import('@/lib/expediente/temporalidad')
    const avisos = avisosTemporalesDelExtractor(
      [{ texto: 'cardiopatía', estado: 'activo' }],
      mencionesEnPasado('Tuvo un infarto en 2019.'),
    )
    expect(Object.keys(avisos[0]).sort()).toEqual(['cita', 'condicion', 'texto'])
    expect(POR_QUE_AQUI_NO_SE_RECLASIFICA).toMatch(/sería una decisión clínica/)
  })

  it('si el extractor ya la puso como resuelta, acertó: ni se anota', async () => {
    const { avisosTemporalesDelExtractor } = await import('@/lib/expediente/temporalidad')
    const avisos = avisosTemporalesDelExtractor(
      [{ texto: 'tuberculosis', estado: 'resuelto' }],
      mencionesEnPasado('Tuvo tuberculosis hace diez años.'),
    )
    expect(avisos).toEqual([])
  })

  it('la ruta lo calcula y lo devuelve', () => {
    const ruta = leer('src', 'app', 'api', 'expediente', 'extraer-entidades', 'route.ts')
    expect(ruta).toContain('avisosTemporalesDelExtractor(conditions, mencionesEnPasado(texto))')
    expect(ruta).toContain('avisosTemporales,')
  })

  it('y el panel lo enseña, diciendo que no cambió nada', () => {
    // Señalar sin tocar sólo sirve si se enseña.
    const panel = leer('src', 'components', 'NerPanel.tsx')
    expect(panel).toContain('salen como activas y en el dictado se dijeron en pasado')
    expect(panel).toMatch(/No se cambiaron: decidir que están resueltas sería una decisión clínica/)
  })

  it('la consulta lo recibe y se lo pasa al panel', () => {
    const page = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
    expect(page).toContain('setAvisosTemporales(((data as { avisosTemporales?: AvisoTemporal[] }).avisosTemporales) ?? [])')
    expect(page).toContain('avisosTemporales={avisosTemporales}')
  })
})

/**
 * ── Y LA REGLA DEL PROMPT (v1029) ────────────────────────────────────────────
 *
 * El motor determinista se queda; la regla se añade igual porque es barata. Pero
 * el orden importa y está escrito en `negaciones.ts`: **un prompt es una
 * petición**, se cumple casi siempre, y «casi siempre» sobre un antecedente que
 * se arrastra a todas las notas siguientes no es suficiente. La regla ayuda a que
 * el fallo no ocurra; el motor garantiza que, si ocurre, se vea.
 */
describe('LA REGLA DEL PROMPT ACOMPAÑA AL MOTOR', () => {
  const prompts = leer('src', 'lib', 'expediente', 'prompts.ts')

  it('existe, y va junto a la de la enfermedad nombrada en la pregunta', () => {
    expect(prompts).toContain('24. EL PASADO NO ES EL PRESENTE.')
    expect(prompts).toContain('23. UNA ENFERMEDAD NOMBRADA EN LA PREGUNTA NO ES UN DIAGNÓSTICO.')
  })

  it('y avisa de la trampa contraria, que es la que puede hacer daño', () => {
    /**
     * Una regla que sólo dijera «el pasado va a antecedentes» empujaría al modelo
     * a degradar «desde hace tres años tiene diabetes», y eso BORRA un
     * diagnóstico activo. La regla tiene que traer las dos mitades.
     */
    expect(prompts).toMatch(/son PRESENTE aunque traigan una\s+fecha/)
    expect(prompts).toMatch(/borraría un diagnóstico activo/)
  })

  it('y la versión del prompt cambió, que es lo que queda en el registro', () => {
    /**
     * ── ESTE CANDADO ESTABA PUESTO AL REVÉS (6-ago-2026, REG-191) ──────────
     *
     * Su intención era buena y sigue siendo la misma: `_promptVersion` viaja al
     * sello de procedencia de cada nota, y dejarla igual haría indistinguibles
     * las notas hechas con una regla y con la otra.
     *
     * Pero la fijaba al literal `'nota-2026-08'`, así que **subirla rompía la
     * suite**: el candado impedía justamente lo que existía para exigir. El
     * prompt cambió siete veces en una noche y la versión no se movió.
     *
     * Ahora la intención se comprueba donde se puede comprobar de verdad —
     * `la-version-del-prompt-no-miente.test.ts` compara una huella del prompt
     * real contra la declarada— y aquí sólo se exige que la regla y su versión
     * sigan existiendo.
     */
    expect(PROMPT_VERSION).toMatch(/^nota-\d{4}-\d{2}-\d{2}-\d+$/)
    expect(PROMPT_VERSION).not.toBe('nota-2026-08')
  })
})

/**
 * ── EL TITULAR NO ESTABA CUBIERTO (v1030) ────────────────────────────────────
 *
 * La v1027 reutilizó **sólo** el vocabulario de `negaciones.ts`, que es de
 * enfermedades **crónicas** — las del interrogatorio dirigido. Y el ejemplo con
 * el que se bautizó el motor en el módulo, en la bitácora, en el changelog y en
 * el PR —«tuvo neumonía hace tres años»— **no lo cazaba**: «neumonía» no es una
 * crónica y no estaba en ninguna lista.
 *
 * El motor funcionaba y no cubría su propio titular. No fallaba, no rompía una
 * prueba, y hacía creer que algo estaba vigilado.
 *
 * Y era justo al revés de lo que pide el problema: lo que se cuenta en pasado es
 * lo AGUDO —una neumonía, una fractura, una cirugía—, mientras que lo crónico
 * casi siempre sigue activo.
 */
describe('EL TITULAR, QUE ES LO QUE FALTABA', () => {
  it('«tuvo neumonía hace tres años» + nota que la afirma → avisa', () => {
    const d = desajustesTemporales(
      mencionesEnPasado('Tuvo neumonía hace tres años.'),
      'Paciente con neumonía. Se inicia antibiótico.',
    )
    expect(d).toHaveLength(1)
    expect(d[0].condicion).toBe('neumonía')
  })

  it('«le operaron de la vesícula en 2019» también', () => {
    // En la consulta se cuenta con el verbo, no con el sustantivo.
    expect(mencionesEnPasado('Le operaron de la vesícula en 2019.')[0]?.condicion).toBe('cirugía')
  })

  it('pero «lo van a operar» NO: en el futuro no hay nada que corregir', () => {
    expect(mencionesEnPasado('Lo van a operar de la vesícula.')).toEqual([])
  })

  it('y la trampa sigue en pie con el vocabulario nuevo', () => {
    // «Desde hace» manda igual sobre lo agudo: una neumonía recurrente ACTUAL no
    // se degrada a antecedente.
    expect(mencionesEnPasado('Desde hace tres años tiene neumonía recurrente.')).toEqual([])
  })

  it('el vocabulario de lo agudo está declarado y es vocabulario, no criterio', () => {
    /**
     * Igual que `CRONICAS`: que falte un padecimiento significa que ese caso no
     * se vigila, NO que se dé por bueno. El motor sólo puede señalar de menos.
     */
    expect(AGUDAS_FRECUENTES.length).toBeGreaterThan(8)
    for (const c of AGUDAS_FRECUENTES) {
      expect(c.formas.length, c.canonica).toBeGreaterThan(0)
    }
  })

  it('y sigue viendo lo crónico: los dos vocabularios, no uno en lugar del otro', () => {
    expect(padecimientosEn('diabetes y neumonía').sort()).toEqual(['diabetes', 'neumonía'])
  })

  it('`cronicasEn` no se tocó: ensancharlo cambiaría lo que cuenta como negación', async () => {
    /**
     * El vocabulario de `negaciones.ts` es el del interrogatorio dirigido. Meter
     * ahí lo agudo cambiaría OTRA defensa —qué se considera negado— y eso es
     * otra decisión, no un efecto secundario de ésta.
     */
    const { cronicasEn } = await import('@/lib/expediente/negaciones')
    expect(cronicasEn('neumonía')).toEqual([])
  })
})

/**
 * ── «SÓLO PUEDE SEÑALAR DE MENOS, NUNCA DE MÁS» ERA MENTIRA (v1080, REG-198) ──
 *
 * El módulo lo dice tres veces y una prueba lo repetía. Nadie lo había MEDIDO en
 * la otra dirección: todos los casos existentes comprobaban que el motor cazara
 * lo que debía, ninguno que no cazara lo que no.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Auditoría del motor de temporalidad (backlog EVAL-002: «se construyó en
 * v1027-v1030 y no tiene corpus»). Al pasarle frases de infectología escritas al
 * revés —la forma aparece como subcadena pero el diagnóstico es otro— salieron
 * seis de doce mal, todas del mismo tipo.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * `padecimientosEn` busca cada forma como subcadena. `derrame` y `trombosis`
 * estaban puestas como formas **a secas**, y una cabeza sin calificador no
 * nombra una condición: la nombra el calificador. Así, «derrame pleural»
 * coincidía con la entrada de `evento vascular cerebral`.
 *
 * ── POR QUÉ IMPORTA MÁS QUE UN AVISO DE SOBRA ────────────────────────────────
 *
 * El aviso no dice «revisa el derrame»: dice, con la cita del dictado delante,
 * que se habló en pasado de un **evento vascular cerebral**. Es un hecho clínico
 * fabricado, de otro órgano y otra gravedad, puesto delante del médico en el
 * segundo en que va a firmar. Y un derrame pleural es de lo más frecuente que ve
 * un infectólogo.
 *
 * ── LO QUE ESTOS CASOS NO CUBREN ─────────────────────────────────────────────
 *
 * · La cistitis intersticial sigue contándose como infección urinaria: sobra el
 *   aviso, no fabrica un órgano. Está declarado en `LO_QUE_NO_DISTINGUE`.
 * · Las cabezas sueltas de `CRONICAS` («infarto» → cardiopatía, «tiroides» →
 *   hipotiroidismo) producen el mismo defecto y **siguen vivas**: viven en
 *   `negaciones.ts`, donde el vocabulario decide además qué cuenta como
 *   negación. Aquí sólo se declaran.
 * · Nada de esto mide lo que el reconocedor OYE. Otro corpus, otro coste.
 *
 * Pacientes sintéticos: ninguna frase viene de una consulta real.
 */
describe('NUNCA DE MÁS — el corpus escrito al revés', () => {
  /** [frase, condiciones que el motor DEBE nombrar — ni una más]. */
  const CORPUS: readonly [string, readonly string[]][] = [
    // La cabeza sola no nombra nada: el calificador decide el órgano.
    ['Tuvo derrame pleural derecho hace tres años, drenado.', []],
    ['Presentó derrame pericárdico en 2019.', []],
    ['Tuvo derrame articular de rodilla hace dos meses.', []],
    ['Tenía trombosis arterial de miembro inferior.', []],
    ['Tuvo trombosis de la arteria mesentérica en 2020.', []],
    // Y lo que sí nombra la condición se sigue cazando.
    ['Tuvo un derrame cerebral en 2018.', ['evento vascular cerebral']],
    ['Padeció un EVC hace cinco años.', ['evento vascular cerebral']],
    ['Tuvo trombosis venosa profunda hace dos años.', ['trombosis venosa']],
    ['Le diagnosticaron TVP en 2021.', ['trombosis venosa']],
    // El resto del vocabulario, para que estrechar no se lleve nada por delante.
    ['Tuvo neumonía adquirida en la comunidad hace tres años.', ['neumonía']],
    ['Presentó fractura de cadera hace cinco años.', ['fractura']],
    ['Tuvo pancreatitis biliar en 2020.', ['pancreatitis']],
    ['Padeció dengue hace un año.', ['dengue']],
    ['Le operaron de la vesícula en 2019.', ['cirugía']],
    // Vecinos que nunca coincidieron y deben seguir sin coincidir.
    ['Tuvo tromboflebitis superficial.', []],
    ['Presentó neumonitis por hipersensibilidad en 2019.', []],
  ]

  it.each(CORPUS)('«%s» → sólo %j', (frase, esperado) => {
    expect(padecimientosEn(frase).sort()).toEqual([...esperado].sort())
  })

  it('el caso que lo motiva, entero: un derrame pleural NO es un ictus', () => {
    /**
     * Extremo a extremo, como lo ve el médico: dictado, nota y aviso. Antes de
     * la reparación esto devolvía un desajuste de «evento vascular cerebral».
     */
    const dictado = 'Tuvo derrame pleural derecho hace tres años, drenado.'
    const nota = 'Paciente con derrame pleural derecho de nueva aparición. Se solicita toracocentesis.'
    expect(desajustesTemporales(mencionesEnPasado(dictado), nota)).toEqual([])
  })

  it('ninguna cabeza sin calificador puede volver a entrar en el vocabulario', () => {
    /**
     * El guardián, no el parche. Sin esto, la quinta forma suelta que alguien
     * añada reintroduce REG-198 sin romper ninguna prueba — que es exactamente
     * como entró ésta.
     */
    for (const c of AGUDAS_FRECUENTES) {
      for (const forma of c.formas) {
        expect(CABEZAS_QUE_NO_NOMBRAN_SOLAS, `«${forma}» en ${c.canonica}`)
          .not.toContain(forma.toLowerCase())
      }
    }
  })

  it('y lo que sigue sin distinguirse está escrito, no descubierto dentro de un año', () => {
    expect(LO_QUE_NO_DISTINGUE).toMatch(/cistitis intersticial/)
    expect(LO_QUE_NO_DISTINGUE).toMatch(/negaciones\.ts/)
  })
})
