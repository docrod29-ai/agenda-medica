/**
 * GOLDEN PATH 9 — UNA ACCION LOGICA, UNA TRANSICION EFECTIVA.
 *
 * QUE SE PRUEBA Y POR QUE AQUI
 *
 * El contrato de GP9 -agenda, llegada, pago, inicio de consulta- no es sobre lo
 * que el codigo DICE, es sobre lo que la base de datos ACABA TENIENDO cuando la
 * misma intencion llega dos veces. Eso no se puede afirmar leyendo el fuente ni
 * con un doble de Firestore escrito para la ocasion: la parte que falla es
 * justamente la semantica de la transaccion -que la lectura fije la version, que
 * el perdedor reintente y vuelva a leer- y un doble complaciente la reproduce
 * como uno quiera.
 *
 * Por eso esto corre contra el EMULADOR, con:
 *   - las funciones de produccion, sin envolver;
 *   - transacciones de Firestore de verdad, con su concurrencia optimista;
 *   - las REGLAS REALES del repositorio (`firestore.rules`), y una identidad de
 *     medico sintetico via `mockUserToken`, que es como llega el navegador.
 *
 * Lo unico sustituido es `@/lib/firebase`: el handle del SDK (para apuntarlo al
 * emulador) y `auth.currentUser` (la sesion). Ni la logica, ni las escrituras,
 * ni el aislamiento pasan por un doble.
 *
 * COMO SE PROBO AL REVES
 *
 * Cada bloque se corrio contra el codigo ANTERIOR a la reparacion y fallo:
 *   - dos llegadas -> `noShowCount` en 2 con una sola falta;
 *   - dos abonos de $500 por un solo billete de $500;
 *   - dos borradores de la misma consulta.
 * Un guardian que no se ha visto fallar no es un guardian.
 *
 * QUE NO CUBRE, DICHO SIN ADORNOS
 *   - La interfaz: que el boton se apague o no es otra capa (y no es la defensa:
 *     `guardando` no protege del reintento, ni de la otra pestana, ni del
 *     refresh).
 *   - Stripe y los webhooks de pago externos: tienen su propia idempotencia por
 *     `invoice.id` y su propia suite; aqui no se toca ninguna API de pago.
 *   - El reagendado desde la API (`/api/appointments`), que corre en el servidor
 *     con Admin SDK y esta cubierto por su propio golden.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'

/**
 * `vi.mock` se iza por encima de todo, asi que lo que necesite tiene que nacer
 * en `vi.hoisted`. El uid es el del medico sintetico del tenant A, el mismo que
 * siembra `entorno.ts`: con el, las reglas reales evaluan `isMedico` a verdadero
 * sin inventar ninguna identidad nueva.
 */
const H = vi.hoisted(() => {
  const PROJECT_ID = 'demo-nexusmed-test'
  const TENANT_A = 'clinica-alfa'
  const TENANT_B = 'clinica-beta'
  const UID = `u-${TENANT_A}-medico`
  const crudo = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'
  const i = crudo.lastIndexOf(':')
  return {
    PROJECT_ID, TENANT_A, TENANT_B, UID,
    host: crudo.slice(0, i) || '127.0.0.1',
    port: Number(crudo.slice(i + 1)),
  }
})

vi.mock('@/lib/firebase', async () => {
  const { initializeApp } = await import('firebase/app')
  const { getFirestore, connectFirestoreEmulator } = await import('firebase/firestore')
  // App con nombre propio: no pisa la que pueda crear cualquier otro import.
  const app = initializeApp({ projectId: H.PROJECT_ID }, 'gp9-modular')
  const db = getFirestore(app)
  // `mockUserToken` hace que el emulador vea `request.auth.uid == UID`: las
  // reglas del repo se aplican ENTERAS, no se desactivan.
  connectFirestoreEmulator(db, H.host, H.port, { mockUserToken: { sub: H.UID, user_id: H.UID } })
  return {
    db,
    auth: { currentUser: { uid: H.UID, email: `${H.UID}@sintetico.test` } },
    default: app,
  }
})

const { abrirEntorno, sembrar } = await import('./entorno')
const { cambiarEstadoCita } = await import('@/lib/agenda/transicion-cita')
const { registrarCobro, cobrosDeCita, CobroPosiblementeDuplicado } = await import('@/lib/cobros')
const { createNota, listarNotasCompat } = await import('@/lib/expediente/firestore')
const { idIdempotente, claveDeIntento } = await import('@/lib/idempotencia')

const PACIENTE = 'pac-gp9'
const CITA = 'cita-gp9'

let env: RulesTestEnvironment

/** Escribe con las reglas apagadas: sembrar es montaje, no lo que se prueba. */
async function sembrarCaso(tenant: string, cita: Record<string, unknown> = {}): Promise<void> {
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore()
    await db.doc(`clinics/${tenant}/patients/${PACIENTE}`).set({
      clinicId: tenant, nombre: 'Paciente Sintetico', noShowCount: 0, cancelacionCount: 0,
    })
    await db.doc(`clinics/${tenant}/appointments/${CITA}`).set({
      clinicId: tenant, pacienteId: PACIENTE, pacienteNombre: 'Paciente Sintetico',
      fechaHora: '2026-08-24 10:00', duracion: 30, estado: 'confirmada',
      cobroExento: false, ...cita,
    })
  })
}

async function leer(ruta: string): Promise<Record<string, unknown> | undefined> {
  let datos: Record<string, unknown> | undefined
  await env.withSecurityRulesDisabled(async ctx => {
    const s = await ctx.firestore().doc(ruta).get()
    datos = s.exists ? (s.data() as Record<string, unknown>) : undefined
  })
  return datos
}

/**
 * Cuenta los documentos REALES de una coleccion.
 *
 * `sembrar()` deja un documento en cada ruta destino -entre ellas `cobros`- para
 * que las reglas que dereferencian `resource.data` no fallen por ausencia. Ese
 * documento es andamio del arnes, no un cobro: contarlo haria que «un cobro»
 * saliera 2 y la prueba mediria el montaje en vez de la reparacion.
 */
async function contar(ruta: string): Promise<number> {
  let n = 0
  await env.withSecurityRulesDisabled(async ctx => {
    const snap = await ctx.firestore().collection(ruta).get()
    n = snap.docs.filter(d => (d.data() as { semilla?: boolean }).semilla !== true).length
  })
  return n
}

beforeAll(async () => { env = await abrirEntorno() })
afterAll(async () => { await env?.cleanup() })
beforeEach(async () => {
  await env.clearFirestore()
  await sembrar(env)          // membresias + doc de la clinica: sin ellos las reglas revientan
  await sembrarCaso(H.TENANT_A)
})

describe('GP9 - llegada / cambio de estado de la cita', () => {
  it('dos toques seguidos dejan UNA transicion y UN incremento', async () => {
    const primero = await cambiarEstadoCita(H.TENANT_A, CITA, 'no-asistio')
    const segundo = await cambiarEstadoCita(H.TENANT_A, CITA, 'no-asistio')

    expect(primero.aplicado).toBe(true)
    // El segundo NO falla ni crea nada: devuelve el estado que ya existia.
    expect(segundo.aplicado).toBe(false)
    expect(segundo.estado).toBe('no-asistio')

    const paciente = await leer(`clinics/${H.TENANT_A}/patients/${PACIENTE}`)
    // EL NUMERO QUE IMPORTA. Antes salia 2: una sola falta contada dos veces,
    // con el motor de riesgo de no-show creyendo que el paciente reincide.
    expect(paciente?.noShowCount).toBe(1)
  })

  it('dos peticiones CONCURRENTES con la misma intencion conservan una sola', async () => {
    const [a, b] = await Promise.all([
      cambiarEstadoCita(H.TENANT_A, CITA, 'cancelada'),
      cambiarEstadoCita(H.TENANT_A, CITA, 'cancelada'),
    ])
    // Exactamente una escribio; la otra reintento, releyo y convergio.
    expect([a.aplicado, b.aplicado].filter(Boolean)).toHaveLength(1)
    const paciente = await leer(`clinics/${H.TENANT_A}/patients/${PACIENTE}`)
    expect(paciente?.cancelacionCount).toBe(1)
    expect((await leer(`clinics/${H.TENANT_A}/appointments/${CITA}`))?.estado).toBe('cancelada')
  })

  it('el reintento tras un timeout aparente no vuelve a contar', async () => {
    // El primer intento SI commiteo; lo que se perdio fue su respuesta. El
    // cliente no lo sabe y repite la misma llamada.
    await cambiarEstadoCita(H.TENANT_A, CITA, 'no-asistio')
    const reintento = await cambiarEstadoCita(H.TENANT_A, CITA, 'no-asistio')
    expect(reintento.aplicado).toBe(false)
    expect((await leer(`clinics/${H.TENANT_A}/patients/${PACIENTE}`))?.noShowCount).toBe(1)
  })

  it('el estado previo lo pone el SERVIDOR, no la pantalla que ya miro', async () => {
    // La cita avanza por otra sesion. Una pantalla con la foto vieja pide el
    // mismo destino: no debe fabricar una segunda transicion.
    await cambiarEstadoCita(H.TENANT_A, CITA, 'en-sala')
    const r = await cambiarEstadoCita(H.TENANT_A, CITA, 'en-sala')
    expect(r.aplicado).toBe(false)
    expect(r.estadoPrevio).toBe('en-sala')
  })

  it('no fuerza un estado invalido para conseguir idempotencia', async () => {
    // Converger no es reescribir: una transicion real distinta si se aplica, y
    // el estado que queda es el pedido, no uno inventado para cuadrar.
    await cambiarEstadoCita(H.TENANT_A, CITA, 'en-sala')
    const r = await cambiarEstadoCita(H.TENANT_A, CITA, 'atendida')
    expect(r.aplicado).toBe(true)
    expect(r.estadoPrevio).toBe('en-sala')
    expect((await leer(`clinics/${H.TENANT_A}/appointments/${CITA}`))?.estado).toBe('atendida')
  })

  it('NEGATIVO ENTRE CONSULTORIOS: la cita del vecino no existe desde aqui', async () => {
    await sembrarCaso(H.TENANT_B)
    // Mismo id de cita, otro consultorio. El id lo propone el cliente y no puede
    // servir para alcanzar la entidad ajena: bajo esta ruta no hay nada.
    await expect(cambiarEstadoCita(H.TENANT_B, CITA, 'cancelada')).rejects.toMatchObject({
      code: expect.stringMatching(/cita-inexistente|permission-denied/),
    })
    // Y sobre todo: la cita del vecino NO se movio.
    expect((await leer(`clinics/${H.TENANT_B}/appointments/${CITA}`))?.estado).toBe('confirmada')
  })
})

describe('GP9 - cobro', () => {
  const abono = { monto: 500, metodo: 'efectivo' as const, concepto: 'abono' as const, citaId: CITA, patientId: PACIENTE, creadoPor: H.UID }

  it('un ABONO repetido con la misma clave no cobra dos veces', async () => {
    // El abono es el caso que el candado por cita NO cubria: a proposito no
    // reserva `cita.cobroId`, para que la cita siga "por cobrar" por el saldo.
    const clave = claveDeIntento()
    const a = await registrarCobro(H.TENANT_A, abono, { claveIdempotencia: clave })
    const b = await registrarCobro(H.TENANT_A, abono, { claveIdempotencia: clave })
    expect(b).toBe(a)
    expect(await contar(`clinics/${H.TENANT_A}/cobros`)).toBe(1)
    // Y el dinero: un solo billete de $500 en el cajon, un solo asiento.
    const cobros = await cobrosDeCita(H.TENANT_A, CITA)
    expect(cobros.reduce((s, c) => s + c.monto, 0)).toBe(500)
  })

  it('dos cobros CONCURRENTES de la misma intencion dejan un solo asiento', async () => {
    const clave = claveDeIntento()
    const ids = await Promise.all([
      registrarCobro(H.TENANT_A, abono, { claveIdempotencia: clave }),
      registrarCobro(H.TENANT_A, abono, { claveIdempotencia: clave }),
    ])
    expect(ids[0]).toBe(ids[1])
    expect(await contar(`clinics/${H.TENANT_A}/cobros`)).toBe(1)
  })

  it('el orden de llegada no cambia cual es la entidad canonica', async () => {
    // Dos intentos distintos, lanzados al reves. Sigue habiendo exactamente un
    // documento por intento: el orden no fabrica ni pierde ninguno.
    //
    // `esOtroDistinto` es lo que RT-005 añadió, y aquí es lo que este caso ya
    // decia con palabras: son DOS ABONOS distintos del mismo importe el mismo
    // dia. Sin esa confirmacion el motor pregunta —«¿ya hay un cobro igual de
    // hoy, es otro?»— porque desde fuera no se distinguen de un doble clic. La
    // pregunta la contesta una persona; aqui la contesta el fixture, que es
    // quien sabe que son dos.
    //
    // Lo que NO cambia, y es lo que mide esta prueba: cada clave converge a SU
    // documento, llegue en el orden que llegue.
    const k1 = claveDeIntento()
    const k2 = claveDeIntento()
    const sonDos = { esOtroDistinto: true }
    const segundo = await registrarCobro(H.TENANT_A, abono, { claveIdempotencia: k2, ...sonDos })
    const primero = await registrarCobro(H.TENANT_A, abono, { claveIdempotencia: k1, ...sonDos })
    expect(primero).not.toBe(segundo)
    expect(await contar(`clinics/${H.TENANT_A}/cobros`)).toBe(2)
    // Y repetir el PRIMERO, ya llegado tarde, sigue convergiendo al suyo.
    expect(await registrarCobro(H.TENANT_A, abono, { claveIdempotencia: k1, ...sonDos })).toBe(primero)
  })

  it('al reves: SIN esa confirmacion, el segundo abono igual de hoy PREGUNTA', async () => {
    /**
     * El control del caso de arriba. Si `esOtroDistinto` no hiciera nada, el
     * caso anterior pasaria igual y esta prueba dejaria de proteger a RT-005:
     * un doble clic sobre «Cobrar» volveria a cobrar dos veces en silencio.
     */
    const a = await registrarCobro(H.TENANT_A, abono, { claveIdempotencia: claveDeIntento(), esOtroDistinto: true })
    expect(a).toBeTruthy()
    await expect(
      registrarCobro(H.TENANT_A, abono, { claveIdempotencia: claveDeIntento() }),
    ).rejects.toBeInstanceOf(CobroPosiblementeDuplicado)
  })

  it('un cobro SUELTO (sin cita) tampoco se duplica al reintentar', async () => {
    const clave = claveDeIntento()
    const suelto = { monto: 800, metodo: 'efectivo' as const, concepto: 'procedimiento' as const, creadoPor: H.UID }
    const a = await registrarCobro(H.TENANT_A, suelto, { claveIdempotencia: clave })
    const b = await registrarCobro(H.TENANT_A, suelto, { claveIdempotencia: clave })
    expect(b).toBe(a)
    expect(await contar(`clinics/${H.TENANT_A}/cobros`)).toBe(1)
  })

  it('el reintento NO reescribe el asiento contable', async () => {
    const clave = claveDeIntento()
    const id = await registrarCobro(H.TENANT_A, abono, { claveIdempotencia: clave })
    const antes = await leer(`clinics/${H.TENANT_A}/cobros/${id}`)
    await registrarCobro(H.TENANT_A, { ...abono, monto: 999 }, { claveIdempotencia: clave })
    const despues = await leer(`clinics/${H.TENANT_A}/cobros/${id}`)
    // Un cobro es un registro contable: converger es DEVOLVER lo que hay, nunca
    // pisarlo -ni con los mismos datos, ni mucho menos con otros.
    expect(despues?.monto).toBe(antes?.monto)
    expect(despues?.folio).toBe(antes?.folio)
  })

  it('el cobro que SALDA sigue con su candado por cita, sin clave y con ella', async () => {
    const salda = { ...abono, concepto: 'consulta' as const }
    const a = await registrarCobro(H.TENANT_A, salda, { claveIdempotencia: claveDeIntento() })
    // Otra clave, otra intencion... pero la cita YA esta saldada: el candado
    // viejo (GP8) no se debilita por haber anadido el nuevo.
    const b = await registrarCobro(H.TENANT_A, salda, { claveIdempotencia: claveDeIntento() })
    expect(b).toBe(a)
    expect(await contar(`clinics/${H.TENANT_A}/cobros`)).toBe(1)
  })

  it('NEGATIVO ENTRE CONSULTORIOS: la misma clave nunca alcanza el cobro del vecino', async () => {
    const clave = claveDeIntento()
    const id = await registrarCobro(H.TENANT_A, abono, { claveIdempotencia: clave })
    // La MISMA clave en el otro consultorio deriva OTRO id: el hash lleva el
    // tenant dentro, asi que una clave prestada no puede nombrar lo ajeno.
    expect(idIdempotente(H.TENANT_B, 'cobro', clave)).not.toBe(id)
    // Y el cobro del tenant A no aparece en la coleccion del tenant B.
    expect(await leer(`clinics/${H.TENANT_B}/cobros/${id}`)).toBeUndefined()
  })

  it('NEGATIVO ENTRE CONSULTORIOS: las reglas reales rechazan cobrar en el vecino', async () => {
    await sembrarCaso(H.TENANT_B)
    // El actor es medico del tenant A. Aunque conozca los ids del vecino, la
    // escritura sale por el borde real y las reglas la deniegan.
    await expect(
      registrarCobro(H.TENANT_B, abono, { claveIdempotencia: claveDeIntento() }),
    ).rejects.toBeTruthy()
    expect(await contar(`clinics/${H.TENANT_B}/cobros`)).toBe(0)
  })
})

describe('GP9 - inicio de consulta', () => {
  const nota = (extra: Record<string, unknown> = {}) => ({
    estado: 'borrador' as const,
    fechaConsulta: '2026-08-24',
    metadata: { medicoId: H.UID, fechaModificacion: '2026-08-24T16:00:00.000Z' },
    ...extra,
  }) as unknown as Parameters<typeof createNota>[2]

  it('dos «Iniciar consulta» del mismo encuentro abren UNA nota', async () => {
    const clave = `cita:${CITA}`
    const a = await createNota(H.TENANT_A, PACIENTE, nota(), { claveEncuentro: clave })
    const b = await createNota(H.TENANT_A, PACIENTE, nota(), { claveEncuentro: clave })
    expect(b).toBe(a)
    expect(await contar(`clinics/${H.TENANT_A}/patients/${PACIENTE}/notas`)).toBe(1)
  })

  it('el reintento tras un timeout aparente no abre un segundo expediente', async () => {
    // El autoguardado commiteo y perdio su respuesta: la pantalla vuelve aqui
    // con `notaIdRef` todavia en null y repite la llamada.
    const clave = `cita:${CITA}`
    await createNota(H.TENANT_A, PACIENTE, nota(), { claveEncuentro: clave })
    await createNota(H.TENANT_A, PACIENTE, nota({ subjetivo: 'texto dictado' }), { claveEncuentro: clave })
    expect(await contar(`clinics/${H.TENANT_A}/patients/${PACIENTE}/notas`)).toBe(1)
  })

  it('dos aperturas CONCURRENTES del mismo encuentro convergen', async () => {
    const clave = `cita:${CITA}`
    const ids = await Promise.all([
      createNota(H.TENANT_A, PACIENTE, nota(), { claveEncuentro: clave }),
      createNota(H.TENANT_A, PACIENTE, nota(), { claveEncuentro: clave }),
    ])
    expect(ids[0]).toBe(ids[1])
    expect(await contar(`clinics/${H.TENANT_A}/patients/${PACIENTE}/notas`)).toBe(1)
  })

  it('NO converge sobre una nota FIRMADA: la segunda visita del dia es otra nota', async () => {
    /**
     * El limite de la idempotencia, y la razon por la que existe: si la clave es
     * la cita y el paciente vuelve el mismo dia, converger devolveria la nota
     * firmada de la manana. La pantalla intentaria escribir sobre un documento
     * inmutable (REG-017) y el medico se quedaria sin poder abrir la consulta.
     * Un estado invalido no se fuerza para conseguir idempotencia.
     */
    const clave = `cita:${CITA}`
    const primera = await createNota(H.TENANT_A, PACIENTE, nota(), { claveEncuentro: clave })
    await env.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore()
        .doc(`clinics/${H.TENANT_A}/patients/${PACIENTE}/notas/${primera}`)
        .update({ estado: 'firmada' })
    })
    const segunda = await createNota(H.TENANT_A, PACIENTE, nota(), { claveEncuentro: clave })
    expect(segunda).not.toBe(primera)
    expect(await contar(`clinics/${H.TENANT_A}/patients/${PACIENTE}/notas`)).toBe(2)
    // Y la firmada sigue firmada: no se piso ni una linea.
    // REG-350: la lectura del historial declara si vino recortada. Aquí son dos
    // notas, así que `truncada` tiene que ser false — y comprobarlo evita que
    // esta aserción pase un día sobre una ventana que no contiene la nota.
    const historial = await listarNotasCompat(H.TENANT_A, PACIENTE)
    expect(historial.truncada).toBe(false)
    expect(historial.notas.find(n => n.id === primera)?.estado).toBe('firmada')
  })

  it('sin clave se conserva el comportamiento de siempre (un documento por llamada)', async () => {
    // El control: la idempotencia es OPT-IN. Quien no la pide -importadores,
    // recreacion tras `nota-inexistente`- no cambia de comportamiento.
    await createNota(H.TENANT_A, PACIENTE, nota())
    await createNota(H.TENANT_A, PACIENTE, nota())
    expect(await contar(`clinics/${H.TENANT_A}/patients/${PACIENTE}/notas`)).toBe(2)
  })

  it('NEGATIVO ENTRE CONSULTORIOS: la clave del encuentro no cruza de clinica', async () => {
    const clave = `cita:${CITA}`
    const id = await createNota(H.TENANT_A, PACIENTE, nota(), { claveEncuentro: clave })
    expect(idIdempotente(H.TENANT_B, 'nota', clave)).not.toBe(id)
    expect(await leer(`clinics/${H.TENANT_B}/patients/${PACIENTE}/notas/${id}`)).toBeUndefined()
  })
})
