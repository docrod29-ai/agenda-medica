/**
 * GOLDEN — 50 000 pacientes con exactamente tres notas cada uno no es una consulta.
 *
 * ── QUÉ FALTABA (TR-HISTORIA.practica-longitudinal) ─────────────────────────
 *
 * REG-383 siembra 50 000 pacientes con tres notas firmadas cada uno y comprueba
 * que navegar no escala con la historia total. El censo dejó apuntado lo que
 * quedaba: **la distribución**.
 *
 * El generador daba a TODOS los pacientes `encountersPerPatient` encuentros
 * exactos, y nada más: ni medicamentos, ni laboratorios, ni órdenes. Un fixture
 * uniforme mide un caso que no existe — y, peor, **esconde justo el que duele**,
 * que es el expediente largo. Con todos iguales, el percentil 99 de una consulta
 * es el mismo que la mediana, así que la corrida no puede encontrar el problema
 * que va a encontrar el primer paciente con quince años de historia.
 *
 * Y la mitad del coste real de navegar un expediente está en lo que **no** tiene
 * nada: un fixture donde todos los encuentros traen laboratorios no ejercita el
 * camino vacío, que es el más común.
 *
 * ── LO QUE NO SE PUEDE INVENTAR, Y AQUÍ ES SUTIL ────────────────────────────
 *
 * Los pesos de la distribución **no son epidemiología**. Nadie los ha medido
 * contra una práctica real. Son una forma de carga elegida para que el fixture
 * tenga cola larga, y el módulo lo dice con esas palabras.
 *
 * Escribir «el 45 % de los pacientes acude una sola vez» sin fuente sería
 * exactamente la regla 1 aplicada a un arnés: no rompe nada, no falla ninguna
 * prueba, y alguien lo cita en un documento comercial seis meses después.
 *
 * Por lo mismo, los laboratorios de este fixture **no llevan analito ni valor** y
 * los medicamentos **no llevan nombre de fármaco**: aquí se cuenta el documento,
 * y una cifra de laboratorio sintética con aspecto de resultado es justo lo que
 * no puede existir sin fuente.
 *
 * ── EL DEFECTO QUE APARECIÓ AL ESCRIBIR ESTO ────────────────────────────────
 *
 * La primera versión de los pesos daba una media ponderada de **1.178**. Quien
 * pidiera «50 000 pacientes × 3 encuentros» habría obtenido 177 000 documentos
 * en vez de 150 000, **sin que nada lo dijera**. Un arnés que miente sobre su
 * propia carga mide otra cosa y la llama lo pedido.
 *
 * Por eso la normalización se comprueba en el código —el módulo lanza al
 * cargarse si se desbalancea— y no en un comentario: una aritmética escrita en
 * prosa envejece el día que alguien mueve un peso.
 *
 * ── POR QUÉ UN GENERADOR DERIVADO POR PACIENTE ──────────────────────────────
 *
 * Los campos nuevos no pueden consumir del generador principal: cada llamada de
 * más desplaza la secuencia de todos los pacientes siguientes. Derivándolo de
 * `(semilla, ordinal)`, añadir un campo mañana no mueve a nadie más — que es lo
 * que permite ampliar el arnés sin tirar la serie de corridas anteriores.
 *
 * El esquema sube a `v2` de todas formas, porque la distribución SÍ cambia el
 * fixture: fingir que una corrida v2 se compara con una v1 sería peor que
 * decirlo.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No valida los pesos contra una práctica real.** Nadie los ha medido, y por
 *   eso están declarados como carga y no como dato.
 * · **No genera contenido clínico**: ni analitos, ni valores, ni fármacos, ni
 *   diagnósticos. A propósito.
 * · **No corre el arnés.** Comprueba la forma de lo que genera, no el
 *   comportamiento del producto bajo esa carga — eso es el emulador.
 * · **No cubre el sesgo del redondeo**, que se mide y se declara aquí abajo pero
 *   no se corrige: `Math.max(1, …)` empuja el tramo corto hacia arriba.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import {
  FORMA_DE_LA_HISTORIA, mediaDeLaForma, proporcionDeLaForma,
  historiaDe, cuantosMedicamentos, generadorDelPaciente,
} from '../../scripts/product/generate-consultorio-load-fixture.mjs'

const FUENTE = readFileSync('scripts/product/generate-consultorio-load-fixture.mjs', 'utf8')

/**
 * El fuente SIN comentarios.
 *
 * La primera versión de los dos guardianes de abajo inspeccionaba el fuente
 * entero y caía sobre los propios comentarios que EXPLICAN por qué esos campos
 * no están: «una cifra de laboratorio sintética con aspecto de resultado…»
 * contiene «resultado». Un guardián que se dispara con su propia explicación no
 * vigila el código.
 */
const SOLO_CODIGO = FUENTE
  .split('\n')
  .filter(l => {
    const t = l.trim()
    return t && !t.startsWith('*') && !t.startsWith('//') && !t.startsWith('/*')
  })
  .join('\n')

describe('la forma de la carga está balanceada, y se comprueba en el código', () => {
  it('las proporciones suman exactamente 1', () => {
    expect(proporcionDeLaForma()).toBeCloseTo(1, 9)
  })

  it('y la media ponderada es 1: el arnés genera la carga que se le pidió', () => {
    /**
     * AL REVÉS de la primera versión, que daba 1.178 — un 18 % más de carga de
     * la pedida, en silencio.
     */
    expect(mediaDeLaForma()).toBeGreaterThan(0.98)
    expect(mediaDeLaForma()).toBeLessThan(1.02)
  })

  it('el módulo LANZA si alguien la desbalancea, en vez de confiar en un comentario', () => {
    expect(FUENTE).toMatch(/throw new Error\(\s*`FORMA_DE_LA_HISTORIA desbalanceada/)
    expect(() => {
      const forma = [{ proporcion: 1, factor: 3 }]
      if (Math.abs(mediaDeLaForma(forma) - 1) > 0.02) throw new Error('desbalanceada')
    }).toThrow()
  })

  it('hay cola larga: el expediente que duele existe en el fixture', () => {
    const factores = FORMA_DE_LA_HISTORIA.map(t => t.factor)
    expect(Math.max(...factores), 'sin cola, el p99 es la mediana').toBeGreaterThanOrEqual(4)
    expect(Math.min(...factores), 'y sin pacientes de una visita, tampoco es una consulta').toBeLessThan(0.5)
  })
})

describe('la historia deja de ser la misma para todos', () => {
  it('un paciente de una sola visita y uno de años salen del mismo promedio', () => {
    const vistos = new Set<number>()
    for (let i = 1; i <= 400; i++) vistos.add(historiaDe(generadorDelPaciente(20260819, i), 3))
    expect(vistos.size, 'si sale un solo valor, la distribución no distribuye').toBeGreaterThan(2)
    expect(Math.max(...vistos)).toBeGreaterThanOrEqual(6)
    expect(Math.min(...vistos)).toBe(1)
  })

  it('nunca cero: un paciente sin ningún encuentro no es un paciente de este arnés', () => {
    for (let i = 1; i <= 300; i++) {
      expect(historiaDe(generadorDelPaciente(1, i), 1), `paciente ${i}`).toBeGreaterThanOrEqual(1)
    }
  })

  it('EL SESGO DEL REDONDEO se mide, no se supone', () => {
    /**
     * `Math.max(1, Math.round(3 × 0.34))` es 1, no 1.02: el tramo corto se
     * redondea hacia arriba y el total sube un poco por encima del pedido. Se
     * mide y se declara en vez de esconderlo — un arnés que dice «150 000» y
     * entrega 155 000 sigue mintiendo, aunque poco.
     */
    let total = 0
    const N = 2000
    for (let i = 1; i <= N; i++) total += historiaDe(generadorDelPaciente(20260819, i), 3)
    const desvio = total / (N * 3) - 1
    expect(desvio, `desvío medido: ${(desvio * 100).toFixed(1)} %`).toBeGreaterThan(-0.05)
    expect(desvio, `desvío medido: ${(desvio * 100).toFixed(1)} %`).toBeLessThan(0.06)
  })
})

describe('medicamentos: ni todos con tres, ni todos con ninguno', () => {
  it('hay pacientes sin ninguno y hay polifarmacia', () => {
    const n = Array.from({ length: 500 }, (_, i) => cuantosMedicamentos(generadorDelPaciente(99, i + 1)))
    expect(n.filter(x => x === 0).length, 'sin el vacío no se ejercita el camino vacío').toBeGreaterThan(0)
    expect(Math.max(...n), 'sin polifarmacia no se ejercita el otro extremo').toBeGreaterThanOrEqual(6)
  })

  it('nunca negativo', () => {
    for (let i = 1; i <= 300; i++) expect(cuantosMedicamentos(generadorDelPaciente(5, i))).toBeGreaterThanOrEqual(0)
  })
})

describe('el determinismo, que es lo que hace comparable una corrida', () => {
  it('la misma semilla y el mismo ordinal dan lo mismo', () => {
    const a = generadorDelPaciente(20260819, 42)
    const b = generadorDelPaciente(20260819, 42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('y ordinales distintos NO dan lo mismo', () => {
    /* Sin esto, un derivador roto que ignorara el ordinal daría a todos los
       pacientes la misma historia — el defecto que este golden cierra, montado
       de nuevo por debajo. */
    const a = generadorDelPaciente(20260819, 1)
    const b = generadorDelPaciente(20260819, 2)
    expect(a()).not.toBe(b())
  })
})

/**
 * ── Y EL GENERADOR LA USA DE VERDAD ─────────────────────────────────────────
 *
 * Los casos de arriba prueban `historiaDe` y `cuantosMedicamentos` por
 * separado. Al probarlos al revés —desconectando la distribución del generador y
 * dejándolo plano otra vez— **ninguno cayó**: probaban el módulo, no que el
 * módulo corriera.
 *
 * Es la familia «escrito, probado y sin conectar» montada dentro de su propio
 * golden. Estos casos miran la SALIDA.
 */
describe('la salida del generador, no lo que el fuente dice', () => {
  const salida = execFileSync('node', [
    'scripts/product/generate-consultorio-load-fixture.mjs',
    '--patientsPerPhysician=300', '--encountersPerPatient=3', '--seed=20260819',
  ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .trim().split('\n').map(l => JSON.parse(l) as Record<string, unknown>)

  const de = (tipo: string) => salida.filter(r => r.type === tipo)

  it('los pacientes NO tienen todos la misma historia', () => {
    const porPaciente = new Map<string, number>()
    for (const e of de('encounter')) {
      porPaciente.set(e.patientId as string, (porPaciente.get(e.patientId as string) ?? 0) + 1)
    }
    const cuentas = [...porPaciente.values()]
    expect(new Set(cuentas).size, 'todos iguales = el fixture que este golden cierra').toBeGreaterThan(2)
    expect(Math.max(...cuentas), 'sin cola larga, el p99 es la mediana').toBeGreaterThanOrEqual(6)
    expect(Math.min(...cuentas)).toBe(1)
  })

  it('y salen medicamentos, laboratorios y órdenes, que antes no existían', () => {
    for (const tipo of ['medication', 'lab', 'order']) {
      expect(de(tipo).length, tipo).toBeGreaterThan(0)
    }
  })

  it('no todos los encuentros traen laboratorios: el camino vacío también se mide', () => {
    const conLabs = new Set(de('lab').map(l => l.encounterId))
    const total = de('encounter').length
    expect(conLabs.size, 'si todos traen, no se ejercita el expediente vacío').toBeLessThan(total)
    expect(conLabs.size, 'y si ninguno, tampoco se ejercita el lleno').toBeGreaterThan(0)
  })

  it('el resumen cuadra con lo que se escribió', () => {
    const resumen = de('summary')[0]
    expect({
      patients: resumen.patients, encounters: resumen.encounters,
      medications: resumen.medications, labs: resumen.labs, orders: resumen.orders,
    }).toEqual({
      patients: de('patient').length, encounters: de('encounter').length,
      medications: de('medication').length, labs: de('lab').length, orders: de('order').length,
    })
  })

  it('todo documento lleva su marca de sintético, sin excepción', () => {
    const sinMarca = salida.filter(r => r.syntheticNonPhi !== true).map(r => r.type)
    expect(sinMarca).toEqual([])
  })
})

describe('lo que el fixture NO inventa', () => {
  it('el esquema sube a v2: una corrida nueva no se compara con una vieja', () => {
    expect(FUENTE).toContain("ausculta.consultorio.synthetic-load.v2")
  })

  it('los laboratorios no traen analito ni valor', () => {
    const bloque = SOLO_CODIGO.slice(SOLO_CODIGO.indexOf("type: 'lab'"), SOLO_CODIGO.indexOf("type: 'order'"))
    for (const prohibido of ['analito', 'valor', 'unidad', 'resultado:']) {
      expect(bloque, prohibido).not.toContain(prohibido)
    }
    expect(FUENTE).toMatch(/Ni analito ni valor/)
  })

  it('los medicamentos no traen nombre de fármaco', () => {
    const bloque = SOLO_CODIGO.slice(SOLO_CODIGO.indexOf("type: 'medication'"), SOLO_CODIGO.indexOf("for (let e = 1"))
    for (const prohibido of ['nombre', 'farmaco', 'dosis', 'via']) {
      expect(bloque, prohibido).not.toContain(prohibido)
    }
  })

  it('y dice, con todas las letras, que los pesos NO son epidemiología', () => {
    expect(FUENTE).toMatch(/ESTO NO ES EPIDEMIOLOGÍA/)
    expect(FUENTE).toMatch(/Nadie los ha medido contra una práctica de verdad/)
  })

  it('todo lo que genera sigue marcado como sintético', () => {
    for (const tipo of ["type: 'medication'", "type: 'lab'", "type: 'order'"]) {
      const i = SOLO_CODIGO.indexOf(tipo)
      expect(SOLO_CODIGO.slice(i, i + 320), tipo).toContain('syntheticNonPhi: true')
    }
  })
})
