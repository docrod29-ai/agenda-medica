/**
 * EL RESUMEN DE LA CONSULTA LLEGA AL PACIENTE — V9 · `POSTVISIT-001`.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Dos defectos hermanos, los dos declarados en la auditoría del producto real
 * (`PATIENT-UX-TRUTH-001`, 8-ago-2026) y los dos con las pruebas en verde:
 *
 * **`POSTVISIT-GATE-001`** — `HojaParaElPaciente` se montaba con el estado VIVO
 * de medicamentos y estudios, y su única guarda era `{!esNotaHospital}`. Justo
 * encima, `ComoCerrarLaConsulta` sí exigía `{firmada && …}`. La cabecera del
 * módulo afirmaba que el contenido salía de lo «ya revisado y firmado»: era
 * intención de diseño, no precondición. El médico podía copiar e imprimir una
 * hoja compuesta de un borrador a medio dictar.
 *
 * **`POSTVISIT-ENTREGA-001`** — la hoja tenía dos botones, portapapeles e
 * impresora, y **no aparecía en `/mi/[token]`, ni en `/api/portal`, ni en
 * ninguna plantilla de WhatsApp**. La pieza mejor pensada del lado del paciente
 * —determinista, se niega a inventar— no le llegaba nunca. Y `proximaCita` iba
 * fija en `undefined`, así que su cuarto bloque no podía renderizarse jamás.
 *
 * ── CÓMO SE DESCUBRIERON ────────────────────────────────────────────────────
 *
 * Leyendo los importadores de `HojaParaElPaciente`: uno solo en producción, la
 * consulta, y ninguna ruta ni pantalla del paciente entre ellos. La misma
 * técnica que caza la familia «escrito, probado y sin conectar», que es la más
 * grande de este repositorio.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * La compuerta estaba escrita en un COMENTARIO. La cabecera de
 * `como-se-lo-explico.ts` decía que cada línea sale de un campo «que el médico
 * ya revisó y firmó» — y era cierto respecto de dónde salían los campos, y
 * falso respecto de CUÁNDO. Nada en el código comprobaba el estado de la nota.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Firmar y liberar son dos actos, y el segundo exige el primero. La compuerta
 * vive en el motor puro (`componerPaquete` LANZA con una nota sin firmar) y se
 * repite en la frontera HTTP, que es la que le contesta al médico. Y el
 * contenido que se entrega **no viene del navegador**: el servidor lo recompone
 * desde la nota firmada, porque si el cuerpo de la petición trajera el texto,
 * la compuerta la decidiría quien llame a la ruta.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **No ejecuta la ruta HTTP.** Comprueba el motor puro con casos reales y que
 *   la ruta lo use como debe, leyendo su fuente. Montar Firestore admin exige
 *   el emulador y eso es otra suite (`vitest.emulator.config.ts`).
 * - **No se ha visto en un navegador.** Ni el botón de entregar, ni la pantalla
 *   del paciente. `NAV-NAVEGADOR-001` sigue abierto.
 * - **No prueba el envío por WhatsApp**: no existe. El paciente ve el resumen
 *   entrando a su portal, que es el enlace que ya recibe.
 * - **No dice nada de `warningSigns` ni de `educationalMaterial`** salvo que
 *   van vacíos: son indicación médica y evidencia curada, y no hay de dónde
 *   sacarlos sin inventarlos (regla 1 de seguridad clínica).
 * - **No cubre el caso de que el paciente tenga dos consultorios**: el token
 *   ata `{clinicId, patientId}` y eso lo vigila el guardián del portal.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  componerPaquete, cambiosDeMedicacion, tieneContenidoParaElPaciente,
  liberar, visibleParaElPaciente, ERROR_NOTA_SIN_FIRMAR,
  type NotaParaElPaquete,
} from '@/lib/paciente/paquete-de-visita'
import { cifrasClinicas } from '@/lib/seguridad/la-reescritura-no-pierde-cifras'
import { REGISTRO_RUTAS } from '@/lib/authz/registro-rutas'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const RUTA = leer('src', 'app', 'api', 'paciente', 'paquete', 'route.ts')
const HOJA = leer('src', 'components', 'HojaParaElPaciente.tsx')
const CONSULTA = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
const PORTAL_PACIENTE = leer('src', 'app', 'mi', '[token]', 'page.tsx')

const NOTA_FIRMADA: NotaParaElPaquete = {
  id: 'nota_1',
  estado: 'firmada',
  resumenEjecutivo: 'Faringitis aguda estreptocócica.',
  diagnosticos: [{ descripcion: 'Faringitis aguda' }],
  medicamentos: [
    { nombre: 'Amoxicilina', dosis: '500 mg', via: 'oral', frecuencia: 'cada 8 horas', duracion: '7 días' },
    { nombre: 'Paracetamol', dosis: '500 mg', via: 'v.o.', frecuencia: 'cada 6 horas', duracion: '3 días' },
  ],
  estudiosOrden: ['Biometría hemática'],
}

const componer = (nota: NotaParaElPaquete, previa: readonly string[] | null = null) =>
  componerPaquete({ nota, medicacionPrevia: previa, version: 1 })

describe('LA COMPUERTA: una nota sin firmar no se le entrega a nadie', () => {
  it('se niega a componer desde un borrador', () => {
    /**
     * La que muerde. Probada al revés: con `estado: 'firmada'` (el caso de
     * abajo) compone sin problema, así que si la comprobación desapareciera
     * este `toThrow` fallaría inmediatamente.
     */
    expect(() => componer({ ...NOTA_FIRMADA, estado: 'borrador' })).toThrow(ERROR_NOTA_SIN_FIRMAR)
  })

  it('se niega también con una nota cancelada', () => {
    expect(() => componer({ ...NOTA_FIRMADA, estado: 'cancelada' })).toThrow(ERROR_NOTA_SIN_FIRMAR)
  })

  it('con la nota firmada, compone', () => {
    expect(componer(NOTA_FIRMADA).medicationInstructions).toHaveLength(2)
  })

  it('y aun firmada, el paquete NACE en borrador', () => {
    /** Firmar es hacia el expediente; liberar es hacia el paciente. Dos actos. */
    const p = componer(NOTA_FIRMADA)
    expect(p.estado).toBe('DRAFT')
    expect(visibleParaElPaciente(p)).toBe(false)
  })
})

describe('ninguna cifra que no esté en la nota', () => {
  it('el paquete no añade ni una', () => {
    /**
     * Misma compuerta que el golden de `como-se-lo-explico` (REG-240/242): toda
     * cifra CON UNIDAD que aparece en lo que lee el paciente tiene que estar en
     * la nota. Aquí se aplica sobre el paquete entero, que es lo que de verdad
     * viaja.
     */
    const p = componer(NOTA_FIRMADA)
    const origen = [
      NOTA_FIRMADA.resumenEjecutivo,
      ...(NOTA_FIRMADA.medicamentos ?? []).map(m => `${m.nombre} ${m.dosis} ${m.frecuencia} ${m.duracion}`),
      ...(NOTA_FIRMADA.estudiosOrden ?? []),
    ].join(' ')
    const entregado = [
      p.encounterSummary,
      ...p.medicationInstructions.map(m => m.instruccion),
      ...p.orders,
      p.followUp,
    ].join(' ')

    const enLaNota = cifrasClinicas(origen)
    /**
     * La única derivación permitida, igual que en el golden de REG-242: 24 ÷ n
     * cuando el resultado es EXACTO. No se perdona la unidad «veces» entera —
     * eso sería un boquete—: se calcula qué números concretos autoriza la nota.
     * Si alguien «mejora» la función y empieza a redondear, esto falla.
     */
    const derivacionesLegitimas = new Set(
      [...enLaNota.keys()]
        .map(c => c.match(/^(\d+)horas?$/)?.[1]).filter(Boolean).map(Number)
        .filter(h => h > 0 && h <= 24 && 24 % h === 0)
        .map(h => `${24 / h}veces`),
    )
    const inventadas = [...cifrasClinicas(entregado).keys()]
      .filter(c => !enLaNota.has(c) && !derivacionesLegitimas.has(c))
    expect(inventadas, `cifras que el paquete añade sin origen: ${inventadas.join(', ')}`).toEqual([])
  })
})

describe('qué cambió de la medicación — y qué NO se afirma', () => {
  it('sin lista previa devuelve null, no una lista vacía', () => {
    /**
     * «No aparecía antes» y «no sé qué había antes» son cosas distintas.
     * Devolver `[]` diría «no hubo cambios», que es una afirmación clínica que
     * nadie puede sostener sin línea base. Ausencia de dato no es dato de
     * ausencia.
     */
    expect(componer(NOTA_FIRMADA, null).medicationChanges).toBeNull()
    expect(cambiosDeMedicacion(NOTA_FIRMADA.medicamentos, null)).toBeNull()
  })

  it('con lista previa, distingue lo nuevo de lo que ya tomaba', () => {
    const cambios = componer(NOTA_FIRMADA, ['Paracetamol']).medicationChanges
    expect(cambios).toEqual([
      { nombre: 'Amoxicilina', tipo: 'nuevo' },
      { nombre: 'Paracetamol', tipo: 'sin-cambio' },
    ])
  })

  it('«Amoxicilina» y «amoxicilina» son el mismo fármaco', () => {
    /**
     * Comparten `claveFarmaco` con `medicamentosVigentes` a propósito: con dos
     * normalizaciones distintas, un fármaco escrito con mayúscula distinta
     * saldría como «nuevo» y el paciente empezaría de cero algo que ya tomaba.
     */
    const cambios = cambiosDeMedicacion([{ nombre: '  AMOXICILINA ' }], ['amoxicilina'])
    expect(cambios).toEqual([{ nombre: 'AMOXICILINA', tipo: 'sin-cambio' }])
  })

  it('EL SILENCIO NO SUSPENDE: lo que hoy no se menciona no sale como suspendido', () => {
    /**
     * La regla más importante de este archivo. La metformina estaba en la lista
     * previa y hoy no se habló de ella: eso significa que hoy no se habló de
     * ella, no que el paciente la haya dejado. Si saliera como «ya no lo tomes»,
     * el paciente **la dejaría** — y quien lee esto no puede detectar el error.
     */
    const cambios = cambiosDeMedicacion(NOTA_FIRMADA.medicamentos, ['Metformina', 'Paracetamol'])
    expect(cambios?.some(c => /metformina/i.test(c.nombre))).toBe(false)
  })

  it('sólo se dice «suspendido» cuando la orden lo dice', () => {
    const cambios = cambiosDeMedicacion(
      [{ nombre: 'Ibuprofeno', estado: 'suspendida' }, { nombre: 'Naproxeno', estado: 'cancelada' }],
      ['Ibuprofeno', 'Naproxeno'],
    )
    expect(cambios).toEqual([
      { nombre: 'Ibuprofeno', tipo: 'suspendido' },
      { nombre: 'Naproxeno', tipo: 'suspendido' },
    ])
  })

  it('una orden terminada no se traduce a ninguna casilla', () => {
    /** El tipo tiene tres casillas y «terminada» no es ninguna. Se calla en vez
     *  de decir «suspendido», que significa otra cosa para el paciente. */
    expect(cambiosDeMedicacion([{ nombre: 'Azitromicina', estado: 'terminada' }], ['Azitromicina'])).toEqual([])
  })
})

describe('un fármaco suspendido no lleva instrucciones de cómo tomarlo', () => {
  it('no aparece en `medicationInstructions`', () => {
    /**
     * Sería el renglón «Ibuprofeno 400 mg por la boca cada 8 horas» justo
     * debajo del renglón que dice que lo deje.
     */
    const p = componer({
      ...NOTA_FIRMADA,
      medicamentos: [{ nombre: 'Ibuprofeno', dosis: '400 mg', via: 'oral', frecuencia: 'cada 8 horas', estado: 'suspendida' }],
    }, ['Ibuprofeno'])
    expect(p.medicationInstructions).toEqual([])
    expect(p.medicationChanges).toEqual([{ nombre: 'Ibuprofeno', tipo: 'suspendido' }])
  })
})

describe('lo que no se puede componer se queda vacío', () => {
  const p = componer(NOTA_FIRMADA)

  it('los signos de alarma van vacíos: son indicación médica', () => expect(p.warningSigns).toEqual([]))
  it('el material educativo va vacío: es evidencia curada', () => expect(p.educationalMaterial).toEqual([]))
  it('los documentos los llenará DOCUMENTS-001', () => expect(p.documents).toEqual([]))
  it('las preguntas sin contestar las llenará PATIENT-AI-001', () => expect(p.unansweredQuestions).toEqual([]))

  it('sin resumen ejecutivo cae a los diagnósticos, y no se redacta nada', () => {
    const p2 = componer({ ...NOTA_FIRMADA, resumenEjecutivo: undefined })
    expect(p2.encounterSummary).toBe('Faringitis aguda')
  })
})

describe('no se entrega una hoja en blanco', () => {
  it('una nota firmada sin nada que decir no pasa la comprobación', () => {
    const vacia = componer({ id: 'n', estado: 'firmada' })
    expect(tieneContenidoParaElPaciente(vacia)).toBe(false)
  })
  it('con medicamentos, sí', () => {
    expect(tieneContenidoParaElPaciente(componer(NOTA_FIRMADA))).toBe(true)
  })
})

describe('LA RUTA: el contenido no viene del navegador', () => {
  it('el cuerpo sólo se usa para identificadores y el seguimiento', () => {
    /**
     * Si la ruta leyera `body.medicamentos` o `body.resumen`, la compuerta de
     * firma sería decorativa: bastaría con llamarla con lo que hubiera en
     * pantalla. Lo único que se acepta escrito es `seguimiento`, que es un dato
     * de agenda y no una afirmación clínica.
     */
    expect(RUTA).not.toMatch(/body\.(medicamentos|diagnosticos|resumen|paquete|instrucciones)/)
    expect(RUTA).toContain('componerPaquete(')
    expect(RUTA).toContain('.collection(\'notas\').doc(notaId).get()')
  })

  it('exige la capacidad de firmar, y está declarada', () => {
    expect(RUTA).toContain("verificarCapacidad(req, clinicId, 'firmar')")
    expect(REGISTRO_RUTAS['paciente/paquete']).toEqual({ tipo: 'capacidad', capacidad: 'firmar' })
  })

  it('rechaza la nota sin firmar antes de escribir nada', () => {
    const guarda = RUTA.indexOf("nota.estado !== 'firmada'")
    const escritura = RUTA.indexOf('.create(paquete)')
    expect(guarda).toBeGreaterThan(-1)
    expect(escritura).toBeGreaterThan(guarda)
    expect(RUTA).toContain('ERROR_NOTA_SIN_FIRMAR')
  })

  it('libera con quien aprueba y con la fecha, no a mano', () => {
    /** `liberar()` es la única puerta a RELEASED: exige aprobador y fecha. */
    expect(RUTA).toContain('liberar(borrador, acceso.uid, Date.now()')
    expect(RUTA).not.toMatch(/estado:\s*'RELEASED'/)
  })

  it('una entrega nueva no pisa la anterior', () => {
    /**
     * `create` y no `set`: si el id se repitiera, `set` sobrescribiría en
     * silencio lo que se le entregó al paciente la vez anterior. Lo que se
     * entregó se entregó.
     */
    expect(RUTA).toContain('__v${paquete.version}')
    expect(RUTA).toContain('.create(paquete)')
    expect(RUTA).not.toContain('.set(paquete')
  })

  it('el correo del médico no viaja al paquete del paciente', () => {
    /** El documento acaba en el navegador del paciente, y un enlace de portal se
     *  reenvía por WhatsApp. Va el `uid`, que es opaco, y el nombre de la firma. */
    expect(RUTA).not.toContain('acceso.email')
  })
})

describe('LA PANTALLA DEL MÉDICO: se ve sin firmar, se entrega firmada', () => {
  it('la consulta le pasa el estado de firma a la hoja', () => {
    expect(CONSULTA).toContain('firmada={firmada}')
  })

  it('`proximaCita` ya no está fija en undefined', () => {
    /** Estaba escrita `proximaCita={undefined}` desde REG-242: el cuarto bloque
     *  de la hoja —cuándo volver— no podía renderizarse jamás. */
    expect(CONSULTA).not.toContain('proximaCita={undefined}')
    expect(CONSULTA).toContain('proximaCita={proximoSeguimiento || undefined}')
  })

  it('copiar está cerrado sin firma, y no sólo deshabilitado en pantalla', () => {
    /**
     * Un `disabled` es una pantalla. La comprobación de verdad va dentro del
     * manejador, que es lo que escribe en el portapapeles.
     */
    expect(HOJA).toMatch(/const copiar = async \(\) => \{[\s\S]{0,200}if \(!firmada\) return/)
    expect(HOJA).toContain('disabled={!firmada}')
  })

  it('la compuerta falla CERRADA si alguien olvida pasar el estado', () => {
    /** `firmada?: boolean` sin valor ⇒ `p.firmada === true` es falso ⇒ vista
     *  previa. Un llamador nuevo que se olvide no entrega nada. */
    expect(HOJA).toContain('const firmada = p.firmada === true')
  })

  it('el botón de entregar sólo existe con la nota firmada', () => {
    expect(HOJA).toContain('{firmada && p.alEntregar && (')
  })

  it('la consulta manda identificadores, no contenido', () => {
    expect(CONSULTA).toContain("accion: 'liberar'")
    expect(CONSULTA).toMatch(/body: JSON\.stringify\(\{ clinicId, patientId, notaId, accion: 'liberar', seguimiento: proximoSeguimiento \}\)/)
  })
})

describe('EL DATO TIENE QUE LLEGAR: lo que se escribe es lo que se lee', () => {
  /**
   * Es la regla `.claude/rules/el-dato-tiene-que-llegar.md`, nacida de REG-170:
   * la nota escribía `transcripcionMotor` y ninguna nota firmada lo tenía, así
   * que el bucle de corrección nunca aprendió una palabra. Las pruebas de
   * contrato de aquel día comprobaban que el código lo DIJERA, no que el
   * destinatario lo recibiera.
   *
   * Aquí el destinatario es la pantalla del paciente. Si alguien renombra un
   * campo del paquete, esto se pone rojo — en vez de que el paciente lea una
   * tarjeta a la que le faltan sus medicamentos y nadie se entere.
   */
  const CAMPOS_QUE_EL_PACIENTE_LEE = [
    'encounterSummary', 'medicationInstructions', 'medicationChanges',
    'orders', 'followUp', 'warningSigns', 'clinicianContactRules',
    'approvedAt', 'approvedByName',
  ] as const

  it.each(CAMPOS_QUE_EL_PACIENTE_LEE)('`%s` lo escribe el motor y lo lee la pantalla', campo => {
    const p = componerPaquete({ nota: NOTA_FIRMADA, medicacionPrevia: [], version: 1 })
    expect(Object.prototype.hasOwnProperty.call(p, campo), `el paquete no trae ${campo}`).toBe(true)
    expect(PORTAL_PACIENTE.includes(campo), `/mi/[token] no lee ${campo}`).toBe(true)
  })

  it('la pantalla del paciente pide los paquetes al servidor', () => {
    expect(PORTAL_PACIENTE).toContain("action: 'paquetes'")
    expect(PORTAL_PACIENTE).toContain('<ResumenDeConsulta')
  })

  it('un cambio de medicación se dice con palabras, no sólo con color', () => {
    /** Regla de accesibilidad de la especificación: «never represent clinical
     *  risk only with color». Quien no distingue rojo de verde se toma lo que
     *  no debe. */
    expect(PORTAL_PACIENTE).toContain('es nuevo, empiézalo')
    expect(PORTAL_PACIENTE).toContain('ya no lo tomes')
  })

  it('un paquete liberado sí pasa la compuerta del portal', () => {
    /** El extremo del camino: lo que la ruta escribe es exactamente lo que
     *  `/api/portal` deja salir. */
    const p = liberar(componer(NOTA_FIRMADA), 'uid_medico', 1_754_000_000_000, 'Dr. David Rodríguez')
    expect(visibleParaElPaciente(p)).toBe(true)
    expect(p.approvedByName).toBe('Dr. David Rodríguez')
  })
})
