/**
 * GOLDEN — «100 000 usuarios» no es una carga mientras nadie diga cuántos están dentro.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * El censo lo tenía escrito palabra por palabra: «No hay modelo de carga que diga
 * cuántos de N registrados están en consulta a la vez, ni con qué mezcla de
 * operaciones. Sin eso, «100 k» no nombra ningún experimento.»
 *
 * Y era literal. `run-consultorio-load.mjs` pedía `--tenants`,
 * `--physicians-per-tenant` y `--concurrent`: tres números que había que
 * inventarse a mano en cada corrida. La evidencia guardada decía «100 médicos, 50
 * concurrentes» y **nadie podía decir si eso era el producto a 2 000 usuarios o a
 * 100 000**, porque no existía la función que traduce lo uno en lo otro.
 *
 * ── CÓMO SE DESCUBRIÓ QUE LA COTA SUPUESTA ESTABA MAL ───────────────────────
 *
 * Midiéndola. La primera versión de `COTAS_LOCALES` puso `sesiones: 200` a ojo,
 * para decidir qué escenarios cabían aquí. Al correrlo salieron dos cosas que no
 * se habrían adivinado:
 *
 *   · **400 sesiones simultáneas aguantan** con cero errores — la cota supuesta
 *     se quedaba corta a la mitad, y con ella el escenario de 10 000 registrados
 *     se habría declarado bloqueado sin serlo;
 *   · pero **el caudal no subió**: 221 pet/s con 200 sesiones y 220 con 400. Lo
 *     único que creció fue la espera (p50 460 → 1 042 ms).
 *
 * O sea que la cota del entorno no es un número de sesiones sino una meseta de
 * caudal, y por encima de ella se mide cola y no carga. Ésa es exactamente la
 * clase de cosa que un número supuesto nunca habría contado.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Un arnés parametrizado por sus propios botones. Mientras las entradas fueran
 * «cuántos clientes abro», ninguna corrida podía ser evidencia DE algo: era
 * evidencia de sí misma.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Los ocho conceptos de concurrencia se declaran con **ventana** y con **lo que
 * NO cuentan**, y de ellos se derivan los siete escenarios. Un escenario que no
 * cabe en la cota local **aborta**: no se corre a escala reducida con la etiqueta
 * puesta. Y `--registered` junto a `--concurrent` es un error, porque una corrida
 * con la etiqueta de un escenario y la carga de otro es la evidencia más cara de
 * producir y la más fácil de creerse.
 *
 * ── LO QUE NO SE INVENTÓ, Y POR QUÉ ─────────────────────────────────────────
 *
 * Las razones del modelo (qué fracción de los registrados está en consulta a la
 * vez) son **supuestos declarados** con `medidoEn: null`: sirven para nombrar el
 * experimento, no para afirmar un hecho. Los umbrales de aceptación —qué p95 pasa,
 * qué tasa de error se tolera— son del dueño y van con `NEEDS_OWNER_DECISION`,
 * igual que el validador declara que no aprueba SLOs. Un umbral plausible sería
 * peor que ninguno: convierte una corrida en un aprobado que nadie firmó.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No prueba que el producto aguante 100 000 usuarios.** Prueba que el
 *   escenario está definido, que dos de los siete se corrieron aquí, y que los
 *   cinco restantes dicen con precisión qué infraestructura les falta.
 * · **La corrida es de SATURACIÓN, no del caudal del escenario.** El arnés no
 *   espacia las peticiones: aplicó 88 veces el caudal modelado de 2 000
 *   registrados. Los percentiles son los de la cola, no los que vería un médico.
 * · **Toca el 44 % de la consulta.** No provoca autoguardado, receta,
 *   transcripción, redacción ni evidencia; el informe lo lleva escrito.
 * · **Un emulador no es producción.** La latencia crece con el volumen porque no
 *   hay índices desplegados; lo que sí se comprobó es que las lecturas siguen
 *   acotadas —20 documentos por consulta con 780 residentes y con 39 600—, que es
 *   la propiedad del producto y no del emulador.
 * · **No valida los supuestos.** Nadie ha medido si el 12 % es el 12 %.
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import {
  CONCEPTOS, SUPUESTOS, MEZCLA_DE_OPERACIONES, PETICIONES_POR_CONSULTA,
  LO_QUE_MIDE_LA_CORRIDA, COTAS_LOCALES, ESCENARIOS, USUARIOS_REGISTRADOS,
  PENDIENTE_DEL_DUENO, escenario,
} from '../../scripts/escala/modelo-de-concurrencia.mjs'
import { USUARIOS_REGISTRADOS as DEL_CENSO, REQUISITOS } from '@/lib/programa/requisitos'

const ARNES = 'scripts/product/run-consultorio-load.mjs'
const DOS_MIL = 'docs/audit/ws-02-carga/escenario-2000-registrados.json'
const DIEZ_MIL = 'docs/audit/ws-02-carga/escenario-10000-registrados-eje-concurrencia.json'

/** Corre el arnés y devuelve lo que escribió en stderr al abortar. */
const arnesFalla = (...args: string[]): string => {
  try {
    execFileSync('node', [ARNES, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return ''
  } catch (e) {
    return String((e as { stderr?: string }).stderr ?? '')
  }
}

describe('los ocho conceptos se distinguen, y cada uno dice lo que NO afirma', () => {
  it('están los ocho, con identificador único', () => {
    expect(CONCEPTOS).toHaveLength(8)
    expect(new Set(CONCEPTOS.map(c => c.id)).size).toBe(8)
  })

  it('«usuarios registrados» es el ÚNICO sin ventana, porque es un inventario', () => {
    /**
     * El corazón de la confusión que este archivo existe para impedir. Un stock
     * sin ventana y una foto por minuto no son la misma clase de número, y
     * tratarlos igual es como se anuncia «soporta 100 000» habiendo probado un
     * caudal que 300 habrían producido.
     */
    const sinVentana = CONCEPTOS.filter(c => c.ventana === null)
    expect(sinVentana.map(c => c.id)).toEqual(['usuarios_registrados'])
  })

  it('y los otros siete traen ventana, unidad y lo que no cuentan', () => {
    for (const c of CONCEPTOS) {
      expect(c.unidad, c.id).toBeTruthy()
      expect(c.cuenta, c.id).toBeTruthy()
      expect(c.noCuenta, `${c.id} no declara lo que NO cuenta`).toBeTruthy()
      expect(c.noCuenta.length, `${c.id}: «${c.noCuenta}» no dice nada`).toBeGreaterThan(40)
    }
  })

  it('ráfaga y sostenida no comparten ventana: si la compartieran serían el mismo número', () => {
    const rafaga = CONCEPTOS.find(c => c.id === 'concurrencia_en_rafaga')!
    const sostenida = CONCEPTOS.find(c => c.id === 'concurrencia_sostenida')!
    expect(rafaga.ventana).not.toBe(sostenida.ventana)
  })
})

describe('la traducción existe, y separa lo que se confundía', () => {
  const e = escenario(100_000)

  it('de 100 000 registrados NO salen 100 000 sesiones', () => {
    /**
     * AL REVÉS del estado anterior: sin este módulo, «100 000 usuarios» y «100 000
     * sesiones» eran la misma frase. Aquí hay dos órdenes de magnitud entre una y
     * otra, y ésa es toda la diferencia entre un experimento y un eslogan.
     */
    expect(e.derivado.sesionesConcurrentes).toBeLessThan(e.usuariosRegistrados / 10)
    expect(e.derivado.sesionesConcurrentes).toBeGreaterThan(0)
  })

  it('registrados > activos del día > en consulta a la vez, siempre y en ese orden', () => {
    for (const s of ESCENARIOS) {
      expect(s.derivado.medicos, s.id).toBeLessThan(s.usuariosRegistrados)
      expect(s.derivado.medicosActivos, s.id).toBeLessThan(s.derivado.medicos)
      expect(s.derivado.medicosEnConsultaALaVez, s.id).toBeLessThan(s.derivado.medicosActivos)
    }
  })

  it('la ráfaga es mayor que la sostenida, que es de lo que sirve distinguirlas', () => {
    for (const s of ESCENARIOS) {
      expect(s.derivado.concurrenciaEnRafaga, s.id).toBeGreaterThan(s.derivado.concurrenciaSostenida)
    }
  })

  it('están los siete escenarios del contrato, derivados y no escritos a mano', () => {
    expect(ESCENARIOS.map(s => s.usuariosRegistrados)).toEqual([...USUARIOS_REGISTRADOS])
    expect(USUARIOS_REGISTRADOS).toContain(100_000)
  })

  it('y son EXACTAMENTE los siete del censo, no una segunda lista', () => {
    /**
     * El modelo vive en `.mjs` (lo importan el arnés y esta prueba) y el censo en
     * `.ts`. Dos listas de los mismos siete números en dos archivos es la forma
     * más tonta de que el censo pida un escenario que el arnés no sabe derivar —
     * y no rompería nada al divergir, sólo dejaría un hueco.
     */
    expect([...USUARIOS_REGISTRADOS]).toEqual([...DEL_CENSO])
    for (const n of DEL_CENSO) {
      expect(REQUISITOS.some(r => r.id === `WS-02.registrados-${n}`), `falta WS-02.registrados-${n}`).toBe(true)
    }
  })

  it('y cada uno trae las dimensiones que el contrato nombra', () => {
    for (const s of ESCENARIOS) {
      for (const k of [
        'medicos', 'medicosActivos', 'pacientesActivosDia', 'sesionesConcurrentes',
        'concurrenciaPorConsultorio', 'concurrenciaPorMedico',
        'concurrenciaSostenida', 'concurrenciaEnRafaga', 'documentosResidentes',
      ]) {
        expect(Number.isFinite(s.derivado[k as keyof typeof s.derivado] as number), `${s.id}.${k}`).toBe(true)
      }
      expect(s.mezcla.lecturasPorEscritura, s.id).toBeGreaterThan(0)
      expect(s.mezcla.throughputSostenido, s.id).toBeGreaterThan(0)
      expect(s.duracion.sostenidaMinutos, s.id).toBeGreaterThanOrEqual(60)
      expect(s.duracion.rafagaMinutos, s.id).toBeLessThan(s.duracion.sostenidaMinutos)
    }
  })

  it('la mezcla incluye IA y evidencia, que es la parte que más cuesta', () => {
    expect(PETICIONES_POR_CONSULTA.ia).toBeGreaterThan(0)
    expect(PETICIONES_POR_CONSULTA.evidencia).toBeGreaterThan(0)
    expect(PETICIONES_POR_CONSULTA.enElArnes).toBeLessThan(PETICIONES_POR_CONSULTA.total)
  })

  it('y el arnés declara que sólo provoca una PARTE de ella', () => {
    /* Sin este número, el throughput de la corrida se lee como el de la consulta
       entera, y no lo es: falta la voz, la redacción y el autoguardado. */
    const enElArnes = MEZCLA_DE_OPERACIONES.filter(o => o.caminoDelArnes)
    expect(enElArnes.length).toBeGreaterThan(0)
    expect(enElArnes.length).toBeLessThan(MEZCLA_DE_OPERACIONES.length)
    expect(MEZCLA_DE_OPERACIONES.every(o => o.caminoDelArnes)).toBe(false)
  })
})

describe('los supuestos se declaran supuestos, y los umbrales no se inventan', () => {
  it('NINGÚN supuesto dice estar medido', () => {
    /**
     * AL REVÉS: poner un `medidoEn` en cualquiera de ellos sin un acta detrás lo
     * convierte en un hecho, y el escenario entero dejaría de leerse como una
     * hipótesis. Probado rellenando uno.
     */
    for (const s of SUPUESTOS) {
      expect(s.medidoEn, `${s.id} dice estar medido`).toBeNull()
      expect(s.base, `${s.id} no dice de dónde sale`).toBeTruthy()
    }
  })

  it('y NINGÚN umbral de aceptación es un número', () => {
    /* Qué p95 pasa y qué error se tolera lo decide el dueño. Un número plausible
       aquí convierte una corrida en un aprobado que nadie firmó — que es lo mismo
       que el validador declara cuando dice que no aprueba SLOs. */
    expect(LO_QUE_MIDE_LA_CORRIDA.length).toBeGreaterThanOrEqual(10)
    for (const m of LO_QUE_MIDE_LA_CORRIDA) {
      expect(m.umbral, `${m.campo} trae un umbral inventado`).toBe(PENDIENTE_DEL_DUENO)
      expect(m.unidad, m.campo).toBeTruthy()
    }
  })

  it('las casillas medidas nacen en null, no en cero', () => {
    for (const s of ESCENARIOS) {
      for (const [campo, valor] of Object.entries(s.medido)) {
        expect(valor, `${s.id}.${campo} nace con un valor`).toBeNull()
      }
    }
  })
})

describe('la cota local está medida, y su acta existe', () => {
  it('cita ficheros que están en el árbol', () => {
    /* Una cota con un acta que no existe es una cota supuesta con mejor prensa. */
    expect(COTAS_LOCALES.medidoEn.length).toBeGreaterThanOrEqual(2)
    for (const acta of COTAS_LOCALES.medidoEn) {
      expect(existsSync(acta), `no existe el acta ${acta}`).toBe(true)
    }
  })

  it('el acta de 400 sesiones dice 400 sesiones y cero errores', () => {
    const a = JSON.parse(readFileSync('docs/audit/ws-02-carga/cota-local-400-sesiones.json', 'utf8'))
    expect(a.concurrentConsultations).toBe(COTAS_LOCALES.sesiones)
    expect(a.errorCount).toBe(0)
  })

  it('y la meseta está escrita: por encima se mide cola, no carga', () => {
    /* Es lo que la medición enseñó y la suposición no: doblar las sesiones no
       dobló el trabajo, dobló la espera. */
    const doscientas = JSON.parse(readFileSync('docs/audit/ws-02-carga/cota-local-200-sesiones.json', 'utf8'))
    const cuatrocientas = JSON.parse(readFileSync('docs/audit/ws-02-carga/cota-local-400-sesiones.json', 'utf8'))
    expect(cuatrocientas.concurrentConsultations).toBe(doscientas.concurrentConsultations * 2)
    expect(cuatrocientas.throughput).toBeLessThanOrEqual(doscientas.throughput * 1.2)
    expect(cuatrocientas.latencyMs.p50).toBeGreaterThan(doscientas.latencyMs.p50 * 1.5)
    expect(COTAS_LOCALES.laMeseta).toMatch(/cola, no carga/)
  })
})

describe('lo que no cabe aquí lo dice, en vez de correrse a medias', () => {
  it('los escenarios grandes declaran qué infraestructura falta, con nombre', () => {
    const grandes = ESCENARIOS.filter(s => !s.ejecutable.concurrenciaAqui)
    expect(grandes.length).toBeGreaterThan(0)
    for (const s of grandes) {
      expect(s.ejecutable.faltaFuera.length, s.id).toBeGreaterThan(0)
      for (const f of s.ejecutable.faltaFuera) {
        expect(f.necesita, `${s.id} no dice qué necesita`).toBeTruthy()
        expect(f.conQue, `${s.id} no dice con qué se consigue`).toBeTruthy()
        /* «un entorno más grande» no es una petición que nadie pueda atender. */
        expect(f.conQue.length).toBeGreaterThan(40)
      }
    }
  })

  it('pero NO todos están bloqueados: dos caben aquí', () => {
    /**
     * El caso que impide convertir trabajo interno difícil en bloqueo externo.
     * Si esto cayera a cero, alguien habría marcado WS-02 entero como bloqueado
     * sin haber medido la cota.
     */
    const caben = ESCENARIOS.filter(s => s.ejecutable.concurrenciaAqui)
    expect(caben.map(s => s.usuariosRegistrados)).toEqual([2_000, 10_000])
  })

  it('los dos ejes se declaran por separado, que es lo que salva a los pequeños', () => {
    /* Un registrado que no está en consulta no produce ni una petición: sólo deja
       documentos. Sin separar los ejes, «100 000 registrados» parece pedir 100 000
       sesiones y todo WS-02 se declara bloqueado. */
    const diez = ESCENARIOS.find(s => s.usuariosRegistrados === 10_000)!
    expect(diez.ejecutable.concurrenciaAqui).toBe(true)
    expect(diez.ejecutable.volumenAqui).toBe(false)
  })
})

describe('el arnés no deja etiquetar una corrida con un escenario que no corrió', () => {
  it('AL REVÉS: `--registered` con `--concurrent` a la vez es un error', () => {
    /**
     * Sin esto se podían pasar los dos y el escenario sólo ponía la etiqueta: una
     * corrida de 8 sesiones guardada como «100 000 registrados». Se lee igual de
     * bien que la de verdad, que es lo que la hace cara.
     */
    const err = arnesFalla('--registered=2000', '--concurrent=8')
    expect(err).toMatch(/escenario ya los deriva|evidencia falsa/)
  })

  it('y un escenario que no cabe ABORTA diciendo qué falta', () => {
    /* La otra mitad: correr una fracción con la etiqueta puesta sería mentir
       sobre la carga, así que no se ofrece la opción. */
    const err = arnesFalla('--registered=100000')
    expect(err).toMatch(/sesiones concurrentes y la cota local/)
    expect(err).toMatch(/mentir sobre la carga/)
  })

  it('el que sí cabe pasa de los argumentos y llega a pedir el emulador', () => {
    /* Prueba que el aborto de arriba es POR LA COTA y no porque `--registered`
       falle siempre — que lo dejaría pasando por la razón equivocada. */
    const err = arnesFalla('--registered=2000')
    expect(err).toMatch(/FIRESTORE_EMULATOR_HOST/)
  })
})

describe('las dos corridas alcanzables son evidencia DE un escenario', () => {
  const dosMil = JSON.parse(readFileSync(DOS_MIL, 'utf8'))
  const diezMil = JSON.parse(readFileSync(DIEZ_MIL, 'utf8'))

  it('llevan escrito de qué escenario son, y con qué modelo', () => {
    for (const [n, a] of [['2 000', dosMil], ['10 000', diezMil]] as const) {
      expect(a.modeloDeConcurrencia, `${n} sin escenario`).toBeTruthy()
      expect(a.scenario, n).toMatch(/^WS-02\.registrados-/)
      expect(a.modeloDeConcurrencia.version, n).toBe(1)
    }
    expect(dosMil.modeloDeConcurrencia.usuariosRegistrados).toBe(2_000)
    expect(diezMil.modeloDeConcurrencia.usuariosRegistrados).toBe(10_000)
  })

  it('las sesiones de la corrida son las que el modelo derivó', () => {
    /* «El dato tiene que LLEGAR»: un escenario que sólo pone la etiqueta y no
       mueve los botones no habría cambiado nada. */
    expect(dosMil.concurrentConsultations).toBe(escenario(2_000).derivado.sesionesConcurrentes)
    expect(diezMil.concurrentConsultations).toBe(escenario(10_000).derivado.sesionesConcurrentes)
  })

  it('no hubo fuga entre consultorios, y las sondas se contaron', () => {
    for (const [n, a] of [['2 000', dosMil], ['10 000', diezMil]] as const) {
      expect(a.crossTenantLeakageCount, n).toBe(0)
      expect(a.sondas.fugaEntreConsultorios, n).toBeGreaterThan(100)
      expect(a.idempotencyViolationCount, n).toBe(0)
      expect(a.durableSavePassed, n).toBe(true)
      expect(a.recoveryPassed, n).toBe(true)
      expect(a.errorCount, n).toBe(0)
    }
  })

  it('declaran que la carga fue de SATURACIÓN, no el caudal del escenario', () => {
    /**
     * El arnés corre a fondo. En 2 000 registrados eso fue decenas de veces el
     * caudal modelado — que es holgura de verdad hacia arriba, y percentiles de
     * cola hacia abajo. Callarlo dejaría leer los dos como lo que no son.
     */
    expect(dosMil.modeloDeConcurrencia.formaDeLaCarga.tipo).toBe('saturacion')
    expect(dosMil.modeloDeConcurrencia.formaDeLaCarga.vecesElModelo).toBeGreaterThan(10)
  })

  it('y qué fracción de la consulta tocaron', () => {
    const c = dosMil.modeloDeConcurrencia.cobertura
    expect(c.fraccion).toBeGreaterThan(0)
    expect(c.fraccion).toBeLessThan(1)
    expect(c.queNoProvoca).toMatch(/transcripción/)
  })

  it('lo no medido sigue en null, no en cero', () => {
    for (const campo of [
      'blankScreenCount', 'lostDraftCount', 'silentProviderFailureCount',
      'unboundedReadCount', 'timeoutRate', 'backpressureRejections', 'providerHealth',
    ]) {
      expect(dosMil[campo], `${campo} dejó de ser null`).toBeNull()
    }
    expect(dosMil.complete).toBe(false)
  })
})

describe('el volumen no rompió la cota de lectura, que es lo que importaba', () => {
  const dosMil = JSON.parse(readFileSync(DOS_MIL, 'utf8'))

  it('la corrida se midió sobre expediente previo, no sobre una base vacía', () => {
    /* Hasta aquí toda corrida medía un emulador recién nacido. Un escenario de N
       registrados es concurrencia ENCIMA de lo que esos N ya acumularon. */
    expect(dosMil.documentosResidentes).toBe(escenario(2_000).derivado.documentosResidentes)
    expect(dosMil.documentosResidentes).toBeGreaterThan(10_000)
  })

  it('y cada consulta siguió leyendo 20 documentos, ni uno más', () => {
    /**
     * LA COMPROBACIÓN QUE VALE DE TODA ESTA UNIDAD. Con 39 600 documentos
     * residentes, la paginación devolvió exactamente el tope de 20 por consulta —
     * el mismo número que sobre una base casi vacía.
     *
     * La latencia SÍ creció (p50 115 → 737 ms), pero eso es del emulador, que no
     * tiene índices desplegados; WS-03 ya había medido plano el número de
     * documentos devueltos. Lo que se comprueba aquí es la propiedad del
     * PRODUCTO —la lectura está acotada— y no la del emulador.
     */
    const consultas = dosMil.requestCount / 4
    expect(dosMil.firestoreOps.lecturas / consultas).toBe(20)
  })

  it('las operaciones de Firestore se cuentan por documento, no por consulta', () => {
    /* Contar un `getDocs` como una sola operación oculta el coste de la lectura
       que crece con el consultorio, que es justo lo que WS-03 persigue. */
    expect(dosMil.firestoreOps.lecturas).toBeGreaterThan(dosMil.firestoreOps.escrituras)
    expect(dosMil.firestoreOps.total).toBe(dosMil.firestoreOps.lecturas + dosMil.firestoreOps.escrituras)
  })
})
