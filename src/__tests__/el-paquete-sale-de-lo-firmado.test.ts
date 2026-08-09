/**
 * EL PAQUETE SALE DE LO FIRMADO — V9 · `POSTVISIT-001` · REG-306, REG-307, REG-308.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Tres cosas, y las tres se descubrieron leyendo el backlog que dejó la
 * auditoría `PATIENT-UX-TRUTH-001` y siguiendo cada hallazgo hasta el archivo:
 *
 * **REG-306 · La hoja del paciente se componía del borrador EN CURSO.**
 * `HojaParaElPaciente` se montaba en la consulta con el estado vivo de
 * `medicamentos` y `estudiosOrden`, y su única guarda era `{!esNotaHospital}`
 * (`consulta:5198`). Justo encima, `ComoCerrarLaConsulta` sí exigía `firmada`.
 * La cabecera del módulo afirmaba que el contenido salía de lo «ya revisado y
 * firmado»: **era intención de diseño, no precondición**. Una dosis que la
 * extracción todavía no había corregido, o un estudio que el médico acabaría
 * quitando, podía salir impreso con su membrete.
 *
 * **REG-307 · Deducir una suspensión de que un fármaco no aparezca hoy.**
 * Éste no es un defecto que existiera: es el que `cambiosDeMedicacion` habría
 * cometido si se escribiera de la forma obvia. Comparar dos listas y llamar
 * «suspendido» a lo que falta en la segunda es lo primero que uno escribe, y es
 * exactamente la regla 4 de seguridad clínica al revés: que el médico no
 * re-listara hoy la metformina no significa que la haya suspendido. El paciente
 * **no puede detectar el error** y deja de tomarla.
 *
 * **REG-308 · El seguimiento no estaba atado a la consulta que lo decidió.**
 * `proximoSeguimiento` se escribía sólo en `patients/{id}`, un campo del
 * paciente que la consulta siguiente pisa. Un paquete que lo leyera de ahí le
 * presentaría al paciente el seguimiento de hace tres meses como el de hoy.
 *
 * ── CÓMO SE DESCUBRIERON ────────────────────────────────────────────────────
 *
 * El primero y el tercero estaban anotados en `agent-state/BACKLOG.json` como
 * `POSTVISIT-GATE-001` y como parte de `POSTVISIT-ENTREGA-001`, con archivo y
 * línea, desde la auditoría del 8-ago. El segundo apareció al escribir la
 * función: la firma que pedía el tipo (`'nuevo' | 'suspendido' | 'sin-cambio'`)
 * invitaba a deducirlo.
 *
 * ── LA REGLA QUE LOS HACE SEGUROS ───────────────────────────────────────────
 *
 * El paquete que lee el paciente sale de **material firmado**, se compone de
 * forma **determinista**, y **lo que no se puede sostener no se afirma**: sin
 * lista previa `medicationChanges` es `null` y no `[]`; una suspensión sólo se
 * reporta si el médico la marcó.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **No prueba la ruta HTTP con una petición real.** Comprueba el motor puro y
 *   que la ruta lo use como debe. Montar `/api/expediente/paquete-visita` con
 *   Firestore admin exige el emulador, y eso es otra suite.
 * - **No se ha visto en un navegador.** Ni la pantalla del médico ni la del
 *   paciente. Sigue abierto `NAV-NAVEGADOR-001`.
 * - **No cubre la cartera de documentos** (`DOCUMENTS-001`) ni las preguntas
 *   (`PATIENT-AI-001`): sus campos existen y van vacíos, declarados.
 * - **No comprueba que el paciente entienda lo que lee.** Eso es legibilidad, y
 *   no hay medidor todavía.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  componerPaquete, cambiosDeMedicacion, liberar, visibleParaElPaciente,
  type NotaParaComponer,
} from '@/lib/paciente/paquete-de-visita'

const RAIZ = process.cwd()
const leer = (...p: string[]) => readFileSync(join(RAIZ, ...p), 'utf8')

/** Una nota firmada mínima, con lo que el paciente se lleva a casa. */
const notaFirmada = (extra: Partial<NotaParaComponer> = {}): NotaParaComponer => ({
  id: 'nota_1',
  estado: 'firmada',
  resumenEjecutivo: 'Faringitis aguda.',
  medicamentos: [
    { nombre: 'Amoxicilina', dosis: '500 mg', via: 'oral', frecuencia: 'cada 8 horas', duracion: '7 días' },
  ],
  estudiosOrden: ['Biometría hemática'],
  proximoSeguimiento: 'En 2 semanas',
  ...extra,
})

describe('REG-306 · no se compone un paquete de un borrador', () => {
  it('se niega con la nota en borrador', () => {
    /**
     * LA QUE MUERDE. Probada al revés: si `componerPaquete` compusiera igual sin
     * mirar el estado, esta línea no lanzaría y el caso falla.
     */
    expect(() => componerPaquete({ nota: notaFirmada({ estado: 'borrador' }) })).toThrow(/sin firmar/i)
  })

  it('se niega con la nota cancelada', () => {
    expect(() => componerPaquete({ nota: notaFirmada({ estado: 'cancelada' }) })).toThrow()
  })

  it('lanza en vez de devolver un paquete vacío', () => {
    /**
     * Devolver `null` o un paquete en blanco convertiría un defecto de quien
     * llama en «esta consulta no tiene nada que entregar», que es una frase que
     * la pantalla pintaría tranquilamente.
     */
    let compuso = true
    try { componerPaquete({ nota: notaFirmada({ estado: 'borrador' }) }) } catch { compuso = false }
    expect(compuso).toBe(false)
  })

  it('con la nota firmada sí compone', () => {
    const p = componerPaquete({ nota: notaFirmada() })
    expect(p.notaId).toBe('nota_1')
    expect(p.medicationInstructions).toHaveLength(1)
  })

  it('una nota de internamiento no compone paquete de casa', () => {
    /** Fármacos intravenosos de hospital con instrucciones de «cómo tomarlo»
     *  confunden en vez de ayudar; y el paciente no se lleva nada hoy. */
    expect(() => componerPaquete({ nota: notaFirmada({ internamientoId: 'int_7' }) })).toThrow()
  })

  it('la pantalla de la consulta exige la firma para pintar la hoja', () => {
    /**
     * El motor ya no compone de un borrador, pero `HojaParaElPaciente` no pasa
     * por el motor: se monta con el estado vivo. La compuerta de esa pantalla se
     * comprueba aquí, sobre el archivo, porque es donde vivía el defecto.
     */
    const consulta = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
    expect(consulta).toContain('{!esNotaHospital && firmada && (\n        <HojaParaElPaciente')
  })
})

describe('REG-307 · una suspensión no se deduce de una ausencia', () => {
  const previa = [{ nombre: 'Metformina' }, { nombre: 'Losartán' }]

  it('un fármaco de la lista previa que hoy no aparece NO se reporta como suspendido', () => {
    /**
     * EL CASO QUE IMPORTA. Hoy sólo se recetó amoxicilina; la metformina y el
     * losartán no se re-listaron. Si esto devolviera «suspendido», el paciente
     * dejaría de tomar los dos.
     *
     * Probada al revés: una implementación que recorra `previa` buscando lo que
     * falta en `actual` hace fallar este caso inmediatamente.
     */
    const cambios = cambiosDeMedicacion(
      [{ nombre: 'Amoxicilina' }],
      previa,
    )
    expect(cambios).not.toBeNull()
    expect(cambios!.some(c => c.tipo === 'suspendido')).toBe(false)
    expect(cambios!.map(c => c.nombre)).toEqual(['Amoxicilina'])
  })

  it('suspendido SÓLO cuando el médico lo marcó en la nota', () => {
    const cambios = cambiosDeMedicacion(
      [{ nombre: 'Losartán', estado: 'suspendida' }],
      previa,
    )
    expect(cambios).toEqual([{ nombre: 'Losartán', tipo: 'suspendido' }])
  })

  it('lo que ya estaba antes sale «sin-cambio», no «nuevo»', () => {
    const cambios = cambiosDeMedicacion([{ nombre: 'metformina' }], previa)
    expect(cambios).toEqual([{ nombre: 'metformina', tipo: 'sin-cambio' }])
  })

  it('los acentos y la caja no inventan un cambio', () => {
    /** «Losartán» y «losartan» son el mismo fármaco. Sin normalizar, el paciente
     *  leería «es nuevo» sobre lo que lleva un año tomando. */
    expect(cambiosDeMedicacion([{ nombre: 'LOSARTAN' }], previa))
      .toEqual([{ nombre: 'LOSARTAN', tipo: 'sin-cambio' }])
  })

  it('sin lista previa devuelve `null`, y `null` no es «sin cambios»', () => {
    expect(cambiosDeMedicacion([{ nombre: 'Amoxicilina' }], null)).toBeNull()
    expect(cambiosDeMedicacion([{ nombre: 'Amoxicilina' }], undefined)).toBeNull()
    /** Y con lista previa VACÍA sí se afirma: «no tenía nada» es un dato. */
    expect(cambiosDeMedicacion([{ nombre: 'Amoxicilina' }], []))
      .toEqual([{ nombre: 'Amoxicilina', tipo: 'nuevo' }])
  })

  it('el paquete arrastra el `null` hasta el paciente', () => {
    expect(componerPaquete({ nota: notaFirmada() }).medicationChanges).toBeNull()
  })

  it('la pantalla del paciente NO pinta nada cuando es `null`', () => {
    /**
     * El defecto que habría quedado si la pantalla usara `?.length === 0` para
     * decir «no hubo cambios»: el paciente leería una afirmación que nadie hizo.
     */
    const portal = leer('src', 'app', 'mi', '[token]', 'page.tsx')
    expect(portal).toContain('p.medicationChanges && p.medicationChanges.length > 0')
  })
})

describe('REG-308 · el seguimiento va atado a la consulta que lo decidió', () => {
  it('el paquete lo toma de la nota, no del paciente', () => {
    expect(componerPaquete({ nota: notaFirmada() }).followUp).toBe('En 2 semanas')
  })

  it('sin seguimiento en la nota queda vacío, no se busca en otro sitio', () => {
    /** Ausencia de dato no es dato de ausencia: vacío significa «el médico no
     *  puso ninguno», no «no hace falta volver». */
    const p = componerPaquete({ nota: notaFirmada({ proximoSeguimiento: undefined }) })
    expect(p.followUp).toBe('')
  })

  it('la nota firmada lo sella', () => {
    const consulta = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
    expect(consulta).toContain('proximoSeguimiento: proximoSeguimiento.trim() || undefined')
  })
})

describe('lo que no se puede componer sin inventar, se queda vacío', () => {
  const p = componerPaquete({ nota: notaFirmada() })

  it('los signos de alarma son indicación médica: vacíos', () => {
    expect(p.warningSigns).toEqual([])
  })

  it('el material educativo es evidencia curada: vacío', () => {
    expect(p.educationalMaterial).toEqual([])
  })

  it('el resumen va literal, sin reescribir', () => {
    expect(p.encounterSummary).toBe('Faringitis aguda.')
  })

  it('ninguna cifra del paquete deja de estar en la nota', () => {
    /**
     * La garantía que hereda de `como-se-lo-explico`: la línea del paciente se
     * COMPONE de campos firmados. Aquí se comprueba de la forma que muerde —
     * toda cifra del resultado tiene que existir en la entrada.
     *
     * SE DESCUENTA UN PARÉNTESIS, Y SÓLO UNO: el «(3 veces al día)» que sale de
     * 24 ÷ 8. Es la única cifra del resultado que no está literalmente en la
     * nota, es aritmética exacta sobre lo que el médico dictó, y sólo se hace
     * cuando el resultado es exacto — «cada 5 horas» no produce nada. Su regla y
     * su golden viven en `como-se-lo-explico`; aquí se descuenta y se declara,
     * en vez de dejar pasar cualquier cifra nueva sin mirar.
     *
     * Esta prueba encontró de verdad ese paréntesis al escribirse, que es la
     * razón de que esté explicado en vez de silenciado.
     */
    const nota = notaFirmada()
    const compuesto = componerPaquete({ nota })
    const textoEntrada = JSON.stringify(nota)
    const derivado = /\((?:una vez al día|\d+ veces al día)\)/g
    const cifras = (
      compuesto.medicationInstructions.map(m => m.instruccion).join(' ').replace(derivado, '')
        .match(/\d+([.,]\d+)?/g) ?? []
    )
    expect(cifras.length).toBeGreaterThan(0)   // si no hay cifras, esto no prueba nada
    for (const c of cifras) expect(textoEntrada).toContain(c)
  })

  it('una frecuencia que no divide a 24 no produce ninguna cifra nueva', () => {
    /** El otro lado de la misma regla: «cada 5 horas» no son «4,8 veces al día»
     *  y redondearlo sería inventarle una pauta al médico. */
    const p = componerPaquete({
      nota: notaFirmada({
        medicamentos: [{ nombre: 'X', dosis: '10 mg', frecuencia: 'cada 5 horas' }],
      }),
    })
    expect(p.medicationInstructions[0].instruccion).not.toMatch(/veces al día/)
  })
})

describe('el paquete compuesto nace DRAFT, y liberarlo es otro acto', () => {
  it('recién compuesto de una nota FIRMADA sigue siendo DRAFT', () => {
    /** La regla que más fácil sería «mejorar» por comodidad. Firmar va hacia el
     *  expediente; liberar va hacia el paciente. */
    const p = componerPaquete({ nota: notaFirmada() })
    expect(p.estado).toBe('DRAFT')
    expect(p.approvedBy).toBeNull()
    expect(visibleParaElPaciente(p)).toBe(false)
  })

  it('sólo `liberar()` lo hace visible', () => {
    const p = liberar(componerPaquete({ nota: notaFirmada() }), 'dra@ejemplo.mx', 1_754_000_000_000)
    expect(visibleParaElPaciente(p)).toBe(true)
  })
})

describe('la ruta que libera: el contenido clínico sale del servidor, no del cuerpo', () => {
  const RUTA = leer('src', 'app', 'api', 'expediente', 'paquete-visita', 'route.ts')

  it('compone con el motor, no arma el paquete a mano', () => {
    expect(RUTA).toContain('componerPaquete(')
    expect(RUTA).toContain('import {')
  })

  it('la nota la lee de Firestore, no la recibe', () => {
    /**
     * EL INVARIANTE DE ESTA RUTA. Si el cuerpo pudiera traer medicamentos,
     * estudios o resumen, quien controle el navegador escribe lo que quiera en
     * el documento que va a leer el paciente — y la lista blanca estaría
     * validando la forma de algo que ya viene del cliente.
     */
    const cuerpo = /body\.\w+/g
    const campos = new Set(Array.from(RUTA.matchAll(cuerpo), m => m[0]))
    expect(campos).toEqual(new Set(['body.clinicId', 'body.patientId', 'body.notaId', 'body.accion']))
  })

  it('exige la firma antes de componer', () => {
    expect(RUTA).toContain("!== 'firmada'")
  })

  it('quién aprueba y cuándo salen del servidor', () => {
    /** Nunca del cuerpo: un registro que el registrado escribe a discreción no
     *  acredita nada. Es la lección de la bitácora de auditoría. */
    expect(RUTA).toContain('acceso.email ?? acceso.uid')
    expect(RUTA).toContain('Date.now()')
    expect(RUTA).not.toContain('body.approvedBy')
    expect(RUTA).not.toContain('body.approvedAt')
  })

  it('liberar pide `firmar`; previsualizar sólo `clinico.leer`', () => {
    /**
     * Y el mapa NO está en la ruta: está en el registro, que es donde se audita
     * la política de acceso. Un ternario aquí sería una copia más de esa
     * política — el defecto que E0-07 vino a cerrar, y del que este repositorio
     * llegó a tener seis.
     */
    expect(RUTA).toContain('ACCIONES_PAQUETE_VISITA[accion]')
    expect(RUTA).toContain('exigeCapacidad(')
    expect(RUTA).not.toMatch(/\?\s*'firmar'/)
  })

  it('un paquete ya liberado no se sobrescribe: se versiona', () => {
    /**
     * `.create()` y no `.set()`. Con `set`, dos pestañas liberando a la vez —o
     * una segunda liberación por error— pisarían en silencio el documento que el
     * paciente ya leyó, y la pregunta «¿qué se le dijo el 9 de agosto?» se
     * quedaría sin respuesta.
     */
    expect(RUTA).toContain('.create({')
    expect(RUTA).toContain('`${notaId}-v${version}`')
    expect(RUTA).not.toContain('.set({')
  })

  it('está declarada en el registro de rutas con sus dos capacidades', () => {
    const registro = leer('src', 'lib', 'authz', 'registro-rutas.ts')
    expect(registro).toContain("'expediente/paquete-visita'")
    expect(registro).toContain('ACCIONES_PAQUETE_VISITA')
    expect(registro).toContain("liberar: 'firmar'")
  })
})

describe('el paciente lo recibe de verdad — POSTVISIT-ENTREGA-001', () => {
  const PORTAL = leer('src', 'app', 'mi', '[token]', 'page.tsx')

  it('la pantalla del paciente pide sus paquetes', () => {
    /**
     * Lo que fallaba antes de esta unidad: la acción `paquetes` existía en
     * `/api/portal` desde REG-304 y **nadie la llamaba**. El servidor sabía
     * responder y la pantalla no preguntaba — «escrito y sin conectar», la
     * familia de defectos más grande de este proyecto.
     */
    expect(PORTAL).toContain("action: 'paquetes'")
    expect(PORTAL).toContain('setPaquetes(')
  })

  it('los pinta en el destino de cuidado', () => {
    expect(PORTAL).toContain('paquetes?.map(')
  })

  it('la pantalla NO vuelve a decidir quién puede verlos', () => {
    /**
     * El filtro es del servidor (`visibleParaElPaciente` en `/api/portal`).
     * Repetirlo aquí sería tener dos políticas, y el día que discrepen gana la
     * que nadie está mirando.
     */
    /* Se busca la LLAMADA, no la palabra: el comentario de esa pantalla nombra
       la compuerta para explicar de quién es, y eso es lo que se quiere. */
    expect(PORTAL).not.toContain('visibleParaElPaciente(')
  })

  it('la pantalla del médico existe y llama a la ruta', () => {
    const liberarUI = leer('src', 'components', 'LiberarParaElPaciente.tsx')
    expect(liberarUI).toContain("'/api/expediente/paquete-visita'")
    expect(liberarUI).toContain("pedir('liberar')")
    /* Y que el cuerpo lleve la acción: sin ella la ruta responde 400 y el botón
       no haría nada, con la suite en verde. */
    expect(liberarUI).toContain('accion })')
    const consulta = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
    expect(consulta).toContain('<LiberarParaElPaciente')
  })
})
