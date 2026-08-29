/**
 * GOLDEN — UNA ALERGIA SELLADA EN NOTAS FIRMADAS DEJABA DE EXISTIR AL VACIARSE
 * EL CAMPO DEL PACIENTE.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Las alergias del producto salen de UN campo de texto libre de `Patient`,
 * editable en línea en `/consulta` y en `/pacientes`, que la última escritura
 * pisa entera. De ese campo cuelgan las cuatro cosas que importan: el cruce
 * alergia↔fármaco que apaga Firmar, el recuadro rojo de la receta impresa, el
 * recurso FHIR y el sesgo del reconocedor.
 *
 * Cada nota firmada sella una COPIA de esa lista (`alergias: alergiasDe(patient)`,
 * consulta/page.tsx). O sea que el expediente SÍ guarda la alergia, dentro de
 * documentos inmutables, tantas veces como consultas hubo.
 *
 * Y nadie la volvía a leer. Medido sobre el árbol el 29-ago-2026: los
 * llamadores de `alergiasDe` / `alergenosDe` / `alergiasParaImpreso` leen
 * `patient`, ninguno mira el historial; `nota.alergias` sólo lo consumen
 * `nom004.ts` (la compuerta de ESA nota), `integrity.ts` (su hash) y
 * `procedencia.ts` (su manifiesto) — ninguno cruza notas.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Recorriendo WS-10 (Patient State longitudinal): existen proyecciones de
 * problemas activos y de medicación vigente, las dos recorriendo el expediente
 * entero, y la alergia —el dato más letal— no tenía ninguna.
 *
 * El repositorio ya conocía el modo de fallo por el otro extremo: `logAudit`
 * registra `vaciado: true` al borrarse el campo (firestore.ts:656) «porque sin
 * el antes, un vaciado queda indistinguible de haberlas escrito… es lo que hizo
 * irreconstruible el dato en REG-323». Se había construido la CONSTANCIA del
 * borrado y no la RECUPERACIÓN: nadie lee la bitácora con el paciente enfrente.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * El estado de alergias del paciente se leía de un solo documento mutable, no
 * del expediente. Un import de CSV, una migración, o un médico que vacía el
 * campo para poder firmar, dejan al producto comportándose como si dos notas
 * firmadas que dicen «anafilaxia por penicilina» no existieran.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Asimétrica, y a propósito: afirmar SUMA, el silencio NO RESTA, y una negación
 * de hoy no borra — pone en CONFLICTO, que es una pregunta para el médico.
 * El sello de una nota no es una palabra («ya no es alérgico»), es una COPIA
 * («el campo decía esto cuando firmé»).
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · NO alimenta la compuerta que bloquea la firma. Sigue leyendo `patient`, y
 *   debe seguir: una nota de 2024 no puede pisar una corrección de hoy. Esto
 *   ENSEÑA lo que la compuerta no mira; devolverlo a la lista es acto del médico.
 * · NO decide que la alergia sea real, ni infiere severidad, ni agrupa familias
 *   de fármacos (la reactividad cruzada sigue en `nom004.ts`).
 * · NO persiste la proyección. Se recalcula sobre las notas que la pantalla ya
 *   cargó; no hay documento, ni colección, ni respaldo que declarar.
 * · NO ve lo que un historial recortado dejó fuera. Por eso lleva
 *   `historialIncompleto`, y la pantalla lo dice.
 * · NO compone un registro con campos de varias notas. Guarda los sellos
 *   enteros y por separado; `peorSeveridadRegistrada` y `reaccionRegistrada`
 *   eligen CUÁL enseñar y devuelven la fecha de la nota que lo dice.
 */
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import {
  estadoDeAlergias, avisoDeAlergiasQueNoSeVen, VERSION_PROYECCION_ALERGIAS,
  peorSeveridadRegistrada, reaccionRegistrada,
  POR_QUE_EL_SELLO_NO_RETRACTA, type NotaConAlergias,
} from '@/lib/expediente/alergias-longitudinales'
import { alergenosDe } from '@/lib/seguridad/alergias'

const AHORA = '2026-08-29T10:00:00.000Z'

/** Las dos notas firmadas del caso real: la misma alergia, sellada dos veces. */
const HISTORIAL: NotaConAlergias[] = [
  {
    fecha: '2024-03-11T09:00:00.000Z', estado: 'firmada',
    alergias: [{ alergeno: 'Penicilina', severidad: 'anafilaxia', reaccion: 'edema de glotis' }],
  },
  {
    fecha: '2024-11-02T09:00:00.000Z', estado: 'firmada',
    alergias: [{ alergeno: 'Penicilina', severidad: 'anafilaxia' }],
  },
]

describe('el vaciado del campo no borra lo que las notas firmadas sellaron', () => {
  it('con el campo vacío, la compuerta de hoy ve CERO — y el expediente sigue diciendo penicilina', () => {
    const paciente = { alergias: '' }

    /* Lo que la compuerta mira hoy. Esta línea es el defecto: es correcta y es
       lo único que se leía. */
    expect(alergenosDe(paciente)).toEqual([])

    const estado = estadoDeAlergias(HISTORIAL, paciente, AHORA)
    expect(estado.ausentesDeLaListaDeHoy.map(a => a.alergeno)).toEqual(['Penicilina'])
    expect(estado.ausentesDeLaListaDeHoy[0].notasQueLaAfirman).toBe(2)
    /* La severidad NO se inventa: se enseña la que la nota selló, tal cual. */
    expect(estado.ausentesDeLaListaDeHoy[0].registro?.severidad).toBe('anafilaxia')
  })

  it('NO pierde el detalle que sólo lleva la nota vieja — lo encontró esta prueba', () => {
    /*
     * La primera versión de este módulo se quedaba con el sello MÁS RECIENTE y
     * nada más. La nota de noviembre dice «anafilaxia» a secas; la de marzo dice
     * «anafilaxia, edema de glotis». Con la regla del sello más reciente,
     * «edema de glotis» —lo que distingue una anafilaxia de un exantema— se
     * perdía en silencio.
     *
     * Lo caro habría sido arreglarlo componiendo un registro con campos de dos
     * notas: un registro que nadie escribió. Se guardan LOS DOS sellos, cada uno
     * con su fecha, y quien necesite el detalle lo pide con su procedencia.
     */
    const estado = estadoDeAlergias(HISTORIAL, { alergias: '' }, AHORA)
    const pen = estado.alergias[0]
    expect(pen.registros.map(r => r.fecha)).toEqual([
      '2024-11-02T09:00:00.000Z', '2024-03-11T09:00:00.000Z',
    ])
    expect(reaccionRegistrada(pen)).toEqual({
      reaccion: 'edema de glotis', fecha: '2024-03-11T09:00:00.000Z',
    })
    /* Y el sello más reciente sigue siendo el suyo, sin campos prestados. */
    expect(pen.registro).toEqual({ alergeno: 'Penicilina', severidad: 'anafilaxia' })
  })

  it('la peor severidad sellada gana a la más reciente, y dice de qué nota sale', () => {
    /* La nota nueva no lleva severidad; la vieja dice anafilaxia. Enseñar «sin
       gravedad conocida» sería sub-declarar, que es la dirección cara. */
    const notas: NotaConAlergias[] = [
      { fecha: '2024-03-11', estado: 'firmada', alergias: [{ alergeno: 'Penicilina', severidad: 'anafilaxia' }] },
      { fecha: '2025-06-01', estado: 'firmada', alergias: [{ alergeno: 'Penicilina' }] },
    ]
    const estado = estadoDeAlergias(notas, { alergias: '' }, AHORA)
    expect(estado.alergias[0].registro?.severidad).toBeUndefined()
    expect(peorSeveridadRegistrada(estado.alergias[0]))
      .toEqual({ severidad: 'anafilaxia', fecha: '2024-03-11' })
    /* Y llega al aviso, que es donde el médico lo lee. */
    expect(avisoDeAlergiasQueNoSeVen(estado)).toContain('anafilaxia')
  })

  it('sin severidad sellada devuelve null — «no se sabe» no se rellena', () => {
    const estado = estadoDeAlergias(
      [{ fecha: '2025-01-01', estado: 'firmada', alergias: [{ alergeno: 'Mariscos' }] }],
      { alergias: '' }, AHORA,
    )
    expect(peorSeveridadRegistrada(estado.alergias[0])).toBeNull()
    expect(reaccionRegistrada(estado.alergias[0])).toBeNull()
    expect(avisoDeAlergiasQueNoSeVen(estado)).not.toContain('undefined')
  })

  it('el aviso dice cuántas notas lo afirman y que la alerta NO lo está mirando', () => {
    const aviso = avisoDeAlergiasQueNoSeVen(estadoDeAlergias(HISTORIAL, { alergias: '' }, AHORA))
    expect(aviso).toContain('Penicilina')
    expect(aviso).toContain('2 notas firmadas')
    expect(aviso).toContain('anafilaxia')
    expect(aviso).toMatch(/NO la está mirando/)
  })

  it('cuando la lista de hoy SÍ la tiene, no hay nada que avisar', () => {
    const estado = estadoDeAlergias(HISTORIAL, { alergias: 'Penicilina' }, AHORA)
    expect(estado.ausentesDeLaListaDeHoy).toEqual([])
    expect(estado.enConflicto).toEqual([])
    expect(avisoDeAlergiasQueNoSeVen(estado)).toBe('')
    expect(estado.alergias[0].enLaListaDeHoy).toBe(true)
    expect(estado.alergias[0].notasQueLaAfirman).toBe(2)
  })

  it('reconoce el mismo alérgeno escrito con otra caja y otro acento', () => {
    const estado = estadoDeAlergias(
      [{ fecha: '2025-01-01', estado: 'firmada', alergias: [{ alergeno: 'penicilína' }] }],
      { alergias: 'PENICILINA' }, AHORA,
    )
    expect(estado.ausentesDeLaListaDeHoy).toEqual([])
    expect(estado.alergias).toHaveLength(1)
  })
})

describe('la asimetría: afirmar suma, el silencio no resta', () => {
  it('una nota POSTERIOR con el sello vacío no retracta la alergia', () => {
    /* El caso del import de CSV y el de la migración: la nota de hoy sella []
       porque el campo estaba vacío, no porque nadie sea alérgico. */
    const conNotaVacia: NotaConAlergias[] = [
      ...HISTORIAL,
      { fecha: '2026-08-20T09:00:00.000Z', estado: 'firmada', alergias: [] },
    ]
    const estado = estadoDeAlergias(conNotaVacia, { alergias: '' }, AHORA)
    expect(estado.ausentesDeLaListaDeHoy.map(a => a.alergeno)).toEqual(['Penicilina'])
  })

  it('AL REVÉS — si el sello vacío retractara, la alergia desaparecería del aviso', () => {
    /* Prueba invertida del guardián: se reproduce aquí la regla EQUIVOCADA
       («manda la última palabra», la de problemas y medicación) y se comprueba
       que produce justo el desenlace que este módulo existe para impedir. */
    const notas: NotaConAlergias[] = [
      ...HISTORIAL,
      { fecha: '2026-08-20T09:00:00.000Z', estado: 'firmada', alergias: [] },
    ]
    const ultimaPalabra = [...notas]
      .sort((a, b) => b.fecha.localeCompare(a.fecha))[0].alergias ?? []
    expect(ultimaPalabra).toEqual([])   // ← el desenlace que NO queremos
    expect(estadoDeAlergias(notas, { alergias: '' }, AHORA).ausentesDeLaListaDeHoy).toHaveLength(1)
  })

  it('los borradores no cuentan: la nota de hoy todavía se está escribiendo', () => {
    const estado = estadoDeAlergias(
      [{ fecha: '2026-08-29', estado: 'borrador', alergias: [{ alergeno: 'Sulfas' }] }],
      { alergias: '' }, AHORA,
    )
    expect(estado.alergias).toEqual([])
  })

  it('`desde` es la PRIMERA nota que la selló y `selladaEn` la última', () => {
    const a = estadoDeAlergias(HISTORIAL, { alergias: '' }, AHORA).alergias[0]
    expect(a.desde).toBe('2024-03-11T09:00:00.000Z')
    expect(a.selladaEn).toBe('2024-11-02T09:00:00.000Z')
  })
})

describe('una negación de hoy es un conflicto, no una resolución', () => {
  it('«Niega alergia a penicilina» contra dos notas firmadas queda EN CONFLICTO', () => {
    const estado = estadoDeAlergias(HISTORIAL, { alergias: 'Niega alergia a penicilina' }, AHORA)
    expect(estado.enConflicto.map(a => a.alergeno)).toEqual(['Penicilina'])
    /* Y no se cuenta dos veces: negada y ausente son cosas distintas. */
    expect(estado.ausentesDeLaListaDeHoy).toEqual([])
    expect(avisoDeAlergiasQueNoSeVen(estado)).toContain('hoy el campo la NIEGA')
  })

  it('el conflicto NO borra la alergia del estado', () => {
    const estado = estadoDeAlergias(HISTORIAL, { alergias: 'Niega alergia a penicilina' }, AHORA)
    expect(estado.alergias.map(a => a.alergeno)).toEqual(['Penicilina'])
    expect(estado.alergias[0].negadaHoy).toBe(true)
  })

  it('la negación se compara por PALABRAS COMPLETAS: «sal» no entra en «sulfas»', () => {
    const estado = estadoDeAlergias(
      [{ fecha: '2025-01-01', estado: 'firmada', alergias: [{ alergeno: 'Sal' }] }],
      { alergias: 'Niega alergia a sulfas' }, AHORA,
    )
    /* No es conflicto — nadie negó la sal. Es ausencia, que es otra cosa. */
    expect(estado.enConflicto).toEqual([])
    expect(estado.ausentesDeLaListaDeHoy.map(a => a.alergeno)).toEqual(['Sal'])
  })

  it('una negación que NO habla de la alergia sellada la deja como ausente', () => {
    const estado = estadoDeAlergias(HISTORIAL, { alergias: 'Niega alergia a mariscos' }, AHORA)
    expect(estado.enConflicto).toEqual([])
    expect(estado.ausentesDeLaListaDeHoy.map(a => a.alergeno)).toEqual(['Penicilina'])
  })
})

describe('lo que hoy se escribió y todavía no se ha firmado también es estado', () => {
  it('una alergia sólo en la lista de hoy entra, con cero notas detrás', () => {
    const estado = estadoDeAlergias(HISTORIAL, { alergias: 'Penicilina, Mariscos' }, AHORA)
    const mariscos = estado.alergias.find(a => a.alergeno === 'Mariscos')!
    expect(mariscos.notasQueLaAfirman).toBe(0)
    expect(mariscos.selladaEn).toBe('')
    expect(mariscos.enLaListaDeHoy).toBe(true)
    /* No es «ausente»: está en la lista, la compuerta SÍ la mira. */
    expect(estado.ausentesDeLaListaDeHoy).toEqual([])
  })

  it('lee `alergiasEstructuradas`, no sólo el texto libre (REG-034/035/171)', () => {
    const estado = estadoDeAlergias(
      HISTORIAL, { alergiasEstructuradas: [{ alergeno: 'Penicilina' }] }, AHORA,
    )
    expect(estado.ausentesDeLaListaDeHoy).toEqual([])
  })
})

describe('la proyección dice a qué momento corresponde y qué no pudo ver', () => {
  it('lleva `asOf` y versión — una proyección sin ninguno de los dos no se puede invalidar', () => {
    const estado = estadoDeAlergias(HISTORIAL, { alergias: '' }, AHORA)
    expect(estado.asOf).toBe(AHORA)
    expect(estado.version).toBe(VERSION_PROYECCION_ALERGIAS)
  })

  it('no lee el reloj por dentro: dos llamadas con el mismo `asOf` son idénticas', () => {
    expect(estadoDeAlergias(HISTORIAL, { alergias: '' }, AHORA))
      .toEqual(estadoDeAlergias(HISTORIAL, { alergias: '' }, AHORA))
  })

  it('un historial recortado se declara: «no encontré más» no es «no hay más»', () => {
    const estado = estadoDeAlergias([], { alergias: '' }, AHORA, { historialIncompleto: true })
    expect(estado.historialIncompleto).toBe(true)
    expect(estado.alergias).toEqual([])   // y aun así no afirma que no haya alergias
  })

  it('sin paciente y sin notas no inventa nada ni revienta', () => {
    const estado = estadoDeAlergias([], null, AHORA)
    expect(estado.alergias).toEqual([])
    expect(avisoDeAlergiasQueNoSeVen(estado)).toBe('')
  })

  it('la explicación de por qué el sello no retracta está escrita en el módulo', () => {
    expect(POR_QUE_EL_SELLO_NO_RETRACTA).toMatch(/copia/)
    expect(POR_QUE_EL_SELLO_NO_RETRACTA).toMatch(/retroactiva/)
  })
})


/**
 * ── «ESCRITO Y SIN CONECTAR» ────────────────────────────────────────────────
 *
 * Un módulo de seguridad que nadie llama no protege a nadie. Esta proyección
 * existe justamente porque otro dato ya estaba escrito —las alergias selladas
 * en cada nota firmada— y ninguna pantalla lo leía. Repetir el mismo defecto
 * con el arreglo sería la broma más cara de este repositorio.
 *
 * Se comprueba el ÁRBOL, no un mock: que las dos pantallas que ya tienen las
 * notas cargadas llamen a `estadoDeAlergias` y pinten su aviso.
 */
describe('el dato tiene que LLEGAR a una pantalla', () => {
  const PANTALLAS = [
    'src/app/(dashboard)/consulta/[patientId]/page.tsx',
    'src/app/(dashboard)/expediente/[patientId]/page.tsx',
  ]

  for (const ruta of PANTALLAS) {
    it(`${ruta} calcula la proyección y pinta su aviso`, () => {
      const src = readFileSync(ruta, 'utf8')
      expect(src).toContain("from '@/lib/expediente/alergias-longitudinales'")
      expect(src).toMatch(/estadoDeAlergias\(/)
      expect(src).toMatch(/avisoDeAlergiasQueNoSeVen\(/)
      /* Y lo RENDERIZA: importarlo y no pintarlo es el defecto de siempre. */
      expect(src).toMatch(/\{avisoAlergias(?: && )/)
      /* Con procedencia: sin la fecha de la nota esto sería una afirmación del
         sistema en vez de una cita del expediente. */
      expect(src).toContain('a.selladaEn.slice(0, 10)')
    })
  }

  it('la compuerta que bloquea la firma NO lee de aquí — sigue leyendo `patient`', () => {
    /*
     * A propósito, y es la mitad delicada del arreglo. Si esta proyección
     * alimentara `validarAlergiasVsMedicamentos`, una nota de 2024 pisaría una
     * corrección que el médico hizo hoy a conciencia, y el producto tendría dos
     * lecturas del mismo campo — ADR-001, REG-034/035/171.
     */
    const nom004 = readFileSync('src/lib/expediente/nom004.ts', 'utf8')
    expect(nom004).not.toContain('alergias-longitudinales')
    const seguridad = readFileSync('src/lib/seguridad/alergias.ts', 'utf8')
    expect(seguridad).not.toContain('alergias-longitudinales')
  })
})
