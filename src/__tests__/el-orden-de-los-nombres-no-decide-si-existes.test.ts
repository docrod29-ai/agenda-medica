/**
 * GOLDEN — UN DUPLICADO CON LOS NOMBRES AL REVÉS NO APARECÍA.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * Firestore no tiene «contiene», así que la búsqueda de pacientes es por
 * **PREFIJO**. Con el texto completo, teclear «María López» sólo encuentra a
 * quien está guardado **empezando** por «María López».
 *
 * En México el mismo expediente se captura tan a menudo como «López María» que
 * ese hueco no es un caso raro: es la mitad de los casos. Y lo abrió el propio
 * arreglo de REG-347, que lo dejó escrito como límite conocido (P1-17).
 *
 * ── LAS DOS CONSECUENCIAS, Y LA SEGUNDA ES LA CARA ──────────────────────────
 *
 * · El buscador dice «no está» de alguien que sí está.
 * · El aviso **antiduplicado** no salta, así que se abre un segundo expediente
 *   y la historia del paciente queda partida en dos: la mitad de sus alergias,
 *   diagnósticos y medicación bajo un registro y la otra mitad bajo otro. Nadie
 *   ve el error — se ve como un paciente nuevo.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * Se buscaba por el **texto completo** como una sola cadena. Un nombre no es una
 * cadena: es un conjunto de palabras cuyo orden de captura no está garantizado
 * por nada.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Se sondea además por cada **palabra**. No convierte el prefijo en «contiene»
 * —«López» sigue sin encontrar a «María de los Ángeles López»— pero cierra el
 * caso que de verdad ocurre. Y lo hace con consultas indexadas del **mismo
 * campo y la misma forma**, así que **no necesita ningún índice compuesto**:
 * importa, porque los índices se crean fuera de este repositorio
 * (`docs/ops/INDICES-DE-FIRESTORE.md`) y una consulta que necesitara uno
 * fallaría entera en producción.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · **Sigue sin ser «contiene».** Una palabra que no empieza el nombre y no es
 *   ninguna de las dos sondeadas no se encuentra. Cerrar eso de verdad exige un
 *   índice invertido de tokens —un campo derivado que hay que escribir en cada
 *   alta y en cada edición— y eso es un cambio de modelo de datos con
 *   retroactivo, no un ajuste de consulta. Queda dicho, no dado por resuelto.
 * · **Se sondean dos palabras**, no todas: cada una es una consulta con su
 *   ventana, y un nombre compuesto largo multiplicaría las lecturas.
 * · **No prueba Firestore.** El doble implementa la semántica de prefijo que
 *   este código usa; no dice nada de índices desplegados ni de reglas.
 * · **No normaliza acentos.** «Lopez» no encuentra a «López». Es otro hueco, y
 *   exigiría el mismo campo derivado que el punto anterior.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const h = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  contador: { lecturas: 0, getDocs: 0, getDoc: 0 },
  fallos: { collectionGroup: false, lectura: false, lecturaEn: '' },
}))

vi.mock('@/lib/firebase', () => ({
  db: { doble: true },
  auth: { currentUser: { uid: 'medico-sintetico' } },
  storage: null,
}))
vi.mock('@/lib/expediente/audit-log', () => ({ logAudit: async () => {} }))
vi.mock('firebase/firestore', async () => {
  const { firestoreClienteSobre } = await import('./_harness/firestore-cliente-en-memoria')
  return firestoreClienteSobre(h)
})

import {
  buscarPacientes, invalidarCachePacientes,
  PALABRAS_SONDEADAS, MINIMO_PALABRA, VENTANA_BUSQUEDA_PACIENTES, VENTANA_PALABRA,
} from '@/lib/firestore'
import { duplicadosProbablesDe } from '@/lib/pacientes/candidatos'

const CLINICA = 'clinica-sintetica-1'

function paciente(id: string, nombre: string, extra: Record<string, unknown> = {}) {
  h.docs.set(`clinics/${CLINICA}/patients/${id}`, { nombre, telefono: '', ...extra })
}

const reset = () => { h.contador.lecturas = 0; h.contador.getDocs = 0; h.contador.getDoc = 0 }
beforeEach(() => { h.docs.clear(); invalidarCachePacientes(); reset() })

describe('EL CASO QUE PARTÍA EXPEDIENTES', () => {
  it('«María López» encuentra a quien está guardado como «López María»', async () => {
    paciente('alreves', 'López María')
    const r = await buscarPacientes(CLINICA, 'María López')
    expect(
      r.pacientes.map(p => p.id),
      'el orden con el que se capturó el nombre no puede decidir si alguien existe',
    ).toContain('alreves')
  })

  it('y al revés: «López María» encuentra a «María López»', async () => {
    paciente('derecho', 'María López')
    const r = await buscarPacientes(CLINICA, 'López María')
    expect(r.pacientes.map(p => p.id)).toContain('derecho')
  })

  it('LO QUE DE VERDAD IMPORTA: el antiduplicado ya lo ve', async () => {
    /**
     * Sin esto se abría un segundo expediente y la historia quedaba partida en
     * dos: la mitad de las alergias bajo un registro y la otra mitad bajo otro.
     */
    /**
     * SIN teléfono en común, a propósito. Con él lo encontraba ya el sondeo por
     * teléfono, y este caso pasaría sin probar nada del nombre — que es
     * exactamente el hueco que P1-17 describe: «y **sin teléfono en común** no
     * aparece».
     */
    paciente('existente', 'López María Fernanda', { telefono: '5599990000', fechaNacimiento: '1985-03-12' })
    const r = await duplicadosProbablesDe(CLINICA, {
      nombre: 'María Fernanda López', telefono: '5511112222', fechaNacimiento: '1985-03-12',
    })
    expect(r.seguros.map(x => x.paciente.id)).toContain('existente')
  })

  it('sigue encontrando por el principio, como siempre', async () => {
    paciente('normal', 'María López')
    const r = await buscarPacientes(CLINICA, 'María')
    expect(r.pacientes.map(p => p.id)).toContain('normal')
  })

  it('y declara qué estrategias lanzó', async () => {
    paciente('x', 'López María')
    const r = await buscarPacientes(CLINICA, 'María López')
    expect(r.estrategias).toContain('prefijo-nombre')
    expect(r.estrategias).toContain('prefijo-nombre-palabra')
  })
})

describe('NO SE VUELVE CARO NI RUIDOSO', () => {
  it('las palabras cortas no se sondean: «de», «la», «y» llenarían la ventana', async () => {
    paciente('x', 'Ana de la Cruz')
    const r = await buscarPacientes(CLINICA, 'Ana de la Cruz')
    // Se sondean como mucho `PALABRAS_SONDEADAS` palabras >= MINIMO_PALABRA.
    const porPalabra = r.estrategias.filter(e => e === 'prefijo-nombre-palabra')
    expect(porPalabra.length).toBeLessThanOrEqual(PALABRAS_SONDEADAS)
    expect(MINIMO_PALABRA).toBeGreaterThanOrEqual(3)
  })

  it('un nombre largo no multiplica las consultas sin límite', async () => {
    paciente('x', 'José Antonio Ramírez Gutiérrez Villalobos')
    const r = await buscarPacientes(CLINICA, 'José Antonio Ramírez Gutiérrez Villalobos')
    expect(r.estrategias.filter(e => e === 'prefijo-nombre-palabra').length)
      .toBeLessThanOrEqual(PALABRAS_SONDEADAS)
  })

  it('los sondeos por palabra usan una ventana CORTA: son red, no búsqueda', async () => {
    /**
     * Un apellido común como «López» llenaría la ventana grande con gente que
     * no tiene nada que ver, y multiplicado por tres palabras convertiría cada
     * tecleo en una lectura cara.
     */
    for (let i = 0; i < 200; i++) paciente(`l${i}`, `López Persona ${i}`)
    reset()
    await buscarPacientes(CLINICA, 'Ana López Ruiz')
    expect(VENTANA_PALABRA).toBeLessThan(VENTANA_BUSQUEDA_PACIENTES)
    expect(
      h.contador.lecturas,
      'los sondeos por palabra no pueden costar lo mismo que la búsqueda principal',
    ).toBeLessThanOrEqual(VENTANA_BUSQUEDA_PACIENTES * 2 + VENTANA_PALABRA * 6)
  })

  it('con una sola palabra no se sondea dos veces lo mismo', async () => {
    paciente('x', 'Guillermina')
    const r = await buscarPacientes(CLINICA, 'Guillermina')
    // El texto completo YA es esa palabra: repetirlo sería pagar dos ventanas
    // por la misma consulta.
    expect(r.estrategias).not.toContain('prefijo-nombre-palabra')
  })

  it('el coste sigue dependiendo de la ventana, no del tamaño del consultorio', async () => {
    for (let i = 0; i < 30; i++) paciente(`p${i}`, `Paciente Sintético ${i}`)
    await buscarPacientes(CLINICA, 'Paciente Sintético')
    const conPocos = h.contador.lecturas

    h.docs.clear(); invalidarCachePacientes(); reset()
    for (let i = 0; i < 3000; i++) paciente(`p${i}`, `Paciente Sintético ${i}`)
    await buscarPacientes(CLINICA, 'Paciente Sintético')
    // Las ventanas se llenan igual en los dos: lo que no puede pasar es que
    // crezca con N.
    expect(h.contador.lecturas).toBeLessThanOrEqual(conPocos + VENTANA_BUSQUEDA_PACIENTES * 4)
  })

  it('no devuelve duplicados aunque dos sondeos encuentren al mismo', async () => {
    paciente('unico', 'María López')
    const r = await buscarPacientes(CLINICA, 'María López')
    expect(r.pacientes.filter(p => p.id === 'unico').length).toBe(1)
  })
})

describe('LO QUE SIGUE SIN ALCANZAR, PROBADO EN VEZ DE SUPUESTO', () => {
  it('una palabra MÁS ALLÁ de las sondeadas no se encuentra', async () => {
    /**
     * «López» no encuentra a «María de los Ángeles López» si no es una de las
     * palabras sondeadas. Cerrar esto exige un índice invertido de tokens: un
     * campo derivado que hay que escribir en cada alta y en cada edición, con
     * retroactivo. Es un cambio de modelo de datos, no un ajuste de consulta.
     */
    // El expediente EMPIEZA por «Gutiérrez», que es la CUARTA palabra de lo
    // tecleado: más allá de las tres que se sondean.
    paciente('cuarta', 'Gutiérrez José Antonio Ramírez')
    const r = await buscarPacientes(CLINICA, 'José Antonio Ramírez Gutiérrez')
    expect(r.pacientes.map(p => p.id)).not.toContain('cuarta')
  })

  it('y los acentos siguen contando: «Lopez» no encuentra a «López»', async () => {
    paciente('conacento', 'López María')
    const r = await buscarPacientes(CLINICA, 'Lopez')
    expect(r.pacientes.map(p => p.id)).not.toContain('conacento')
  })
})
