/**
 * EL PAQUETE SALE DE LO FIRMADO — Y LLEGA — V9 · `POSTVISIT-001` · REG-306, REG-307.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Dos defectos hermanos, los dos declarados P1 por la auditoría del producto
 * real (`PATIENT-UX-TRUTH-001`, 8-ago-2026):
 *
 * **REG-306 · La hoja del paciente se componía del borrador EN CURSO.**
 * `HojaParaElPaciente` se montaba con el estado vivo de la pantalla de consulta
 * —`medicamentos` y `estudiosOrden` a medio dictar— y la única guarda era
 * `{!esNotaHospital}`. Justo encima, `ComoCerrarLaConsulta` sí exigía
 * `{firmada && …}`. Dos criterios distintos para dos cosas que salen de la misma
 * nota. La cabecera del módulo afirmaba que el contenido venía de «lo ya
 * revisado y firmado»: era intención de diseño, no precondición.
 *
 * **REG-307 · La hoja no llegaba nunca al paciente.** Dos botones —copiar e
 * imprimir— y ninguno la hace llegar a nadie. No estaba en `/mi/[token]`, ni en
 * `/api/portal`, ni en ninguna plantilla. Y `proximaCita={undefined}` estaba
 * FIJO, así que su cuarto bloque no podía renderizarse jamás.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Leyendo la pantalla de consulta de arriba abajo en la auditoría de V9, y
 * comparando la guarda de la hoja con la de su vecina de dos líneas más arriba.
 * Ninguna prueba podía verlo: las dos piezas eran correctas por separado.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * La compuerta vivía en un **comentario**. El módulo declaraba de dónde salía su
 * contenido, y no había una sola línea de código que lo comprobara. Un contrato
 * escrito en prosa no es un contrato: es una intención.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * `componerPaquete` **lanza** si la nota no está firmada, y lanza en vez de
 * devolver vacío porque un valor de retorno se ignora y una excepción no. La
 * comprobación está DOS veces: en la ruta, para poder explicarlo con un 409, y
 * dentro del compositor, para que ningún llamador futuro pueda saltársela.
 *
 * Y `approvedBy` sale de la sesión verificada del servidor, nunca del cuerpo de
 * la petición. Un campo de aprobación que escribe el navegador vale cero.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **No monta la ruta HTTP con Firestore.** Comprueba el motor puro, y sobre el
 *   archivo de la ruta comprueba que las decisiones estén escritas donde tienen
 *   que estar. Montar `/api/expediente/paquete-visita` de verdad exige el
 *   emulador, y eso es otra suite.
 * - **No se ha visto en un navegador.** El botón «Entregar al paciente», el
 *   estado de error y la tarjeta del portal están sellados por lectura del
 *   código, no por uso. `NAV-NAVEGADOR-001` sigue abierto.
 * - **No prueba que el aviso llegue por WhatsApp**: liberar deja el paquete
 *   visible en el portal, no manda mensajes. Eso es `CLOSED-LOOP-PATIENT-001`.
 * - **No cubre equivalencias de fármaco.** Un cambio de marca comercial a
 *   genérico se lee como suspensión + alta, a propósito: adivinarlo exigiría un
 *   catálogo que este proyecto no tiene, y adivinar es inventar.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  componerPaquete, cambiosDeMedicacion, liberar, visibleParaElPaciente,
  NO_SE_COMPONE_DE_UN_BORRADOR,
  type MedicacionDelPaquete, type NotaParaPaquete,
} from '@/lib/paciente/paquete-de-visita'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

const NOTA_FIRMADA: NotaParaPaquete = {
  id: 'nota_1',
  estado: 'firmada',
  resumenEjecutivo: 'Faringitis aguda estreptocócica.',
  diagnosticos: [{ descripcion: 'Faringitis aguda' }],
  medicamentos: [{ nombre: 'Amoxicilina', dosis: '500 mg', via: 'oral', frecuencia: 'cada 8 horas', duracion: '7 días' }],
  estudiosOrden: ['Biometría hemática'],
}

describe('LA COMPUERTA DE FIRMA — un borrador no compone nada', () => {
  it('se niega a componer de una nota sin firmar', () => {
    /**
     * La que muerde, y la que se prueba AL REVÉS: si `componerPaquete` mirara
     * cualquier otra cosa que el estado —o no lo mirara—, este caso pasaría en
     * verde y la hoja del borrador volvería a salir del consultorio.
     */
    expect(() => componerPaquete({ ...NOTA_FIRMADA, estado: 'borrador' })).toThrow(NO_SE_COMPONE_DE_UN_BORRADOR)
  })

  it('se niega también sin estado, que es el caso de una nota a medio nacer', () => {
    expect(() => componerPaquete({ ...NOTA_FIRMADA, estado: undefined })).toThrow()
    expect(() => componerPaquete({ ...NOTA_FIRMADA, estado: 'FIRMADA' })).toThrow()
  })

  it('se niega sin saber de qué nota sale', () => {
    /** Un paquete sin `notaId` es un artefacto huérfano: no se puede auditar
     *  contra la nota que lo sostiene, que es su única fuente de verdad. */
    expect(() => componerPaquete({ ...NOTA_FIRMADA, id: '' })).toThrow()
  })

  it('con la nota firmada, compone', () => {
    const p = componerPaquete(NOTA_FIRMADA)
    expect(p.notaId).toBe('nota_1')
    expect(p.medicationInstructions).toHaveLength(1)
    expect(p.orders).toEqual(['Biometría hemática'])
  })
})

describe('nace DRAFT aunque la nota esté firmada', () => {
  it('firmar no libera', () => {
    /** Firmar es un acto hacia el expediente; liberar es un acto hacia el
     *  paciente. Es la regla que más fácil sería «mejorar» por comodidad. */
    const p = componerPaquete(NOTA_FIRMADA)
    expect(p.estado).toBe('DRAFT')
    expect(p.approvedBy).toBeNull()
    expect(p.approvedAt).toBeNull()
    expect(visibleParaElPaciente(p)).toBe(false)
  })
})

describe('lo que no se puede componer se queda vacío, no se rellena', () => {
  const p = componerPaquete(NOTA_FIRMADA)

  it('los signos de alarma van vacíos: son indicación médica', () => {
    expect(p.warningSigns).toEqual([])
  })

  it('el material educativo va vacío: es evidencia curada y no existe', () => {
    expect(p.educationalMaterial).toEqual([])
  })

  it('sin seguimiento escrito, `followUp` va vacío y no se inventa una cita', () => {
    expect(p.followUp).toBe('')
  })
})

describe('la instrucción no puede traer una cifra que no esté en la nota', () => {
  it('cada número de la hoja aparece en el material firmado', () => {
    /**
     * La garantía la da `como-se-lo-explico` y aquí se comprueba que el paquete
     * no la rompa por el camino. `24 ÷ 8 = 3` es aritmética exacta sobre lo que
     * el médico dictó, y por eso «3 veces al día» sí puede aparecer.
     */
    const p = componerPaquete(NOTA_FIRMADA)
    const linea = p.medicationInstructions[0].instruccion
    expect(linea).toContain('500 mg')
    expect(linea).toContain('por la boca')
    expect(linea).toContain('3 veces al día')
  })

  it('una pauta que no divide 24 no se expande', () => {
    const p = componerPaquete({
      ...NOTA_FIRMADA,
      medicamentos: [{ nombre: 'X', dosis: '1 tableta', frecuencia: 'cada 5 horas' }],
    })
    expect(p.medicationInstructions[0].instruccion).not.toMatch(/veces al día/)
  })
})

describe('QUÉ CAMBIÓ — sin lista previa no se afirma nada', () => {
  const linea = (nombre: string, instruccion: string): MedicacionDelPaquete => ({ nombre, instruccion })

  it('sin lista previa devuelve `null`, no una lista vacía', () => {
    /** `null` = «no se pudo determinar». `[]` diría «no hubo cambios», que es lo
     *  contrario. Confundirlos es dato de ausencia. */
    expect(cambiosDeMedicacion([linea('A', 'A 1 mg')], undefined)).toBeNull()
    expect(cambiosDeMedicacion([linea('A', 'A 1 mg')], null)).toBeNull()
  })

  it('una lista previa VACÍA sí es un dato: todo sale nuevo', () => {
    expect(cambiosDeMedicacion([linea('A', 'A 1 mg')], [])).toEqual([{ nombre: 'A', tipo: 'nuevo' }])
  })

  it('lo que desapareció sale suspendido', () => {
    expect(cambiosDeMedicacion([], [linea('A', 'A 1 mg')])).toEqual([{ nombre: 'A', tipo: 'suspendido' }])
  })

  it('MISMO fármaco con OTRA dosis es `cambiado`, nunca «sin cambio»', () => {
    /**
     * El caso que justifica el cuarto tipo, y el que se prueba al revés: si la
     * comparación mirara sólo el nombre, esto saldría `sin-cambio` y el paciente
     * leería «sigue igual» junto a una warfarina que pasó de 2 mg a 10 mg.
     */
    const r = cambiosDeMedicacion(
      [linea('Warfarina', 'Warfarina · 10 mg · por la boca')],
      [linea('Warfarina', 'Warfarina · 2 mg · por la boca')],
    )
    expect(r).toEqual([{ nombre: 'Warfarina', tipo: 'cambiado' }])
  })

  it('mismo fármaco e idéntica instrucción sí es `sin-cambio`', () => {
    const r = cambiosDeMedicacion([linea('A', 'A · 1 mg')], [linea('A', 'A · 1 mg')])
    expect(r).toEqual([{ nombre: 'A', tipo: 'sin-cambio' }])
  })

  it('el acento y la caja no parten un fármaco en dos', () => {
    /** «Ácido fólico» y «acido folico» son el mismo fármaco escrito por dos
     *  personas distintas; tratarlos como dos sería una suspensión falsa. */
    const r = cambiosDeMedicacion([linea('Ácido Fólico', 'X')], [linea('acido folico', 'X')])
    expect(r).toEqual([{ nombre: 'Ácido Fólico', tipo: 'sin-cambio' }])
  })

  it('el paquete arrastra el `null` cuando no se sabe qué tomaba', () => {
    expect(componerPaquete(NOTA_FIRMADA).medicationChanges).toBeNull()
    expect(componerPaquete(NOTA_FIRMADA, { medicacionPrevia: [] }).medicationChanges)
      .toEqual([{ nombre: 'Amoxicilina', tipo: 'nuevo' }])
  })
})

describe('LIBERAR — quién aprueba sale del servidor, no del navegador', () => {
  const RUTA = leer('src', 'app', 'api', 'expediente', 'paquete-visita', 'route.ts')

  it('la ruta exige la capacidad de firmar', () => {
    /** Liberar es un acto de aprobación clínica: del mismo peso que firmar la
     *  nota, y por eso no basta con ser miembro del consultorio. */
    expect(RUTA).toContain("verificarCapacidad(req, clinicId, 'firmar')")
  })

  it('la ruta comprueba la firma ANTES de componer', () => {
    expect(RUTA).toContain('ESTADO_NOTA_FIRMADA')
    expect(RUTA).toContain('status: 409')
  })

  it('`approvedBy` NO se lee del cuerpo de la petición', () => {
    /**
     * La comprobación que importa es la negativa: si mañana alguien añade
     * `body.approvedBy`, esto se pone en rojo. Un campo de aprobación que viaja
     * desde el navegador convierte la bitácora de quién aprobó en decoración.
     */
    expect(RUTA).toContain('acceso.email || acceso.uid')
    expect(RUTA).not.toMatch(/body\.\s*approvedBy|body\.\s*aprobadoPor/)
  })

  it('un paquete liberado no se sobrescribe: se crea con su versión', () => {
    /** `.create()` y no `.set()`: `set` sobre un id existente pisaría lo que ya
     *  se le entregó al paciente, y un paquete liberado es inmutable. */
    expect(RUTA).toContain('idDePaquete(notaId, version)')
    expect(RUTA).toContain('.create(liberado)')
  })

  it('`liberar` sigue exigiendo quién y cuándo', () => {
    const p = componerPaquete(NOTA_FIRMADA)
    expect(() => liberar(p, '', Date.now())).toThrow()
    expect(visibleParaElPaciente(liberar(p, 'dra@x.mx', 1_754_000_000_000))).toBe(true)
  })
})

describe('EL PACIENTE VE UNA ENTRADA POR CONSULTA, NO UNA POR VERSIÓN', () => {
  const PORTAL = leer('src', 'app', 'api', 'portal', 'route.ts')

  it('`/api/portal` se queda con la versión más alta de cada nota', () => {
    /** El expediente conserva todas las versiones; el paciente ve la vigente.
     *  Dos hojas parecidas con dosis distintas y sin saber cuál manda es peor
     *  que no enseñar nada. */
    expect(PORTAL).toContain('if (!visibleParaElPaciente(p)) continue')
    expect(PORTAL).toContain('porNota.set(p.notaId, p)')
  })
})

describe('LA ENTREGA — la hoja ya tiene por dónde salir', () => {
  const CONSULTA = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
  const HOJA = leer('src', 'components', 'HojaParaElPaciente.tsx')
  const PORTAL_UI = leer('src', 'app', 'mi', '[token]', 'page.tsx')

  it('la hoja de la consulta ya NO se pinta sin la nota firmada', () => {
    /** El defecto exacto de REG-306: la guarda era sólo `!esNotaHospital`. */
    expect(CONSULTA).toContain('{!esNotaHospital && firmada && (')
  })

  it('la consulta llama a la ruta que libera, y no manda quién aprueba', () => {
    expect(CONSULTA).toContain("'/api/expediente/paquete-visita'")
    expect(CONSULTA).toContain("action: 'liberar'")
    expect(CONSULTA).not.toMatch(/approvedBy\s*:/)
  })

  it('el cuarto bloque ya puede renderizarse: `proximaCita` dejó de ser `undefined` fijo', () => {
    /** Estaba escrito `proximaCita={undefined}` desde que nació. El dato estaba
     *  a una variable de distancia, en la misma pantalla. */
    expect(CONSULTA).not.toContain('proximaCita={undefined}')
    expect(CONSULTA).toContain('proximaCita={proximoSeguimiento || undefined}')
  })

  it('el botón de entregar sólo existe si hay a dónde entregar', () => {
    expect(HOJA).toContain('alEntregar?: () => Promise<void>')
    expect(HOJA).toContain('{p.alEntregar && (')
  })

  it('un fallo al entregar se ENSEÑA', () => {
    /** Creer que el paciente ya tiene su hoja cuando no la tiene es peor que no
     *  haber pulsado. Por eso el error se pinta con `role="alert"`. */
    expect(HOJA).toContain('role="alert"')
    expect(HOJA).toContain('setErrorEntrega')
  })

  it('el portal del paciente pide los paquetes y los pinta', () => {
    expect(PORTAL_UI).toContain("action: 'paquetes'")
    expect(PORTAL_UI).toContain('p.medicationInstructions.map')
  })

  it('la casilla de cambios NO se pinta cuando es `null`', () => {
    /** `null` = no se pudo determinar. Una casilla vacía diría «no cambió
     *  nada», que es justo lo contrario. */
    expect(PORTAL_UI).toContain('{p.medicationChanges && p.medicationChanges.length > 0 && (')
  })
})
