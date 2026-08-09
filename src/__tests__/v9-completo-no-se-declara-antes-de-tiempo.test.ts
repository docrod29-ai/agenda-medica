/**
 * V9 NO SE DECLARA TERMINADO ANTES DE TIEMPO.
 *
 * ── QUÉ VIGILA ──────────────────────────────────────────────────────────────
 *
 * El dueño pidió un criterio formal de terminación y fue explícito en las dos
 * direcciones: `agent-state/V9_COMPLETE.md` **sólo puede existir** cuando las
 * diez unidades estén cerradas, no queden P0 ni P1 bloqueantes y pasen las
 * compuertas; y **cuando exista**, las ejecuciones siguientes no deben inventar
 * trabajo ni rediseñar por seguir trabajando.
 *
 * Un criterio escrito en un markdown es una intención. Esto lo convierte en una
 * compuerta: crear el archivo antes de tiempo pone el CI en rojo.
 *
 * ── POR QUÉ HACE FALTA ──────────────────────────────────────────────────────
 *
 * El riesgo no es que alguien mienta a propósito. Es que dentro de seis
 * ejecuciones, con nueve unidades cerradas y una a medias, «ya está» sea una
 * conclusión razonable a las tres de la mañana. Este archivo obliga a que esa
 * conclusión se sostenga sobre la misma evidencia que el resto del programa:
 * un SHA por unidad y un backlog sin P0 ni P1 abiertos.
 *
 * Es el mismo principio de REG-241 —lo verificable se verifica, no se recuerda—
 * aplicado a la última afirmación que hará este programa sobre sí mismo, que es
 * también la más fácil de dar por buena.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **No comprueba que el trabajo esté bien hecho.** Comprueba que esté
 *   DECLARADO cerrado con su evidencia. Un SHA no es una garantía de calidad.
 * - **No puede ejecutar las compuertas de navegador, móvil ni accesibilidad**:
 *   no existen todavía y este proceso no tiene navegador. Por eso exige que la
 *   tabla de compuertas del criterio no deje ninguna en ❌ — que es una
 *   afirmación que alguien tiene que escribir a mano, y responder de ella.
 * - **No impide que alguien borre esta prueba.** Ninguna prueba puede.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const RAIZ = process.cwd()
const COMPLETO = join(RAIZ, 'agent-state', 'V9_COMPLETE.md')
const CRITERIO = join(RAIZ, 'agent-state', 'V9_COMPLETE_CRITERIA.md')

const UNIDADES = [
  'PATIENT-UX-TRUTH-001',
  'DESIGN-SYSTEM-001',
  'NAVIGATION-001',
  'PATIENT-COMPANION-001',
  'POSTVISIT-001',
  'PATIENT-AI-001',
  'DOCUMENTS-001',
  'CLOSED-LOOP-PATIENT-001',
  'PATIENT-LANGUAGE-001',
  'VISUAL-EXCELLENCE-001',
]

interface Elemento { id: string; prioridadV9?: string; estado?: string }

const backlog = (): Elemento[] =>
  JSON.parse(readFileSync(join(RAIZ, 'agent-state', 'BACKLOG.json'), 'utf8')).items

const cerrado = (e: Elemento) => (e.estado ?? '').toUpperCase().startsWith('CERRADO')

describe('el criterio de terminación existe y nombra las diez unidades', () => {
  it('`V9_COMPLETE_CRITERIA.md` existe', () => {
    expect(existsSync(CRITERIO)).toBe(true)
  })

  it('nombra las diez unidades, sin olvidar ninguna', () => {
    /**
     * Si una unidad desapareciera del criterio, V9 podría declararse terminado
     * sin ella y sin que nada chirriara. La lista vive aquí Y en el criterio a
     * propósito: dos copias que se comparan valen más que una que nadie revisa.
     */
    const texto = readFileSync(CRITERIO, 'utf8')
    for (const u of UNIDADES) expect(texto, `falta ${u} en el criterio`).toContain(u)
  })

  it('la lista de unidades coincide con la de la especificación maestra', () => {
    /**
     * La especificación es la autoridad. Si el dueño cambia el orden o añade una
     * unidad, esta prueba obliga a que el criterio se entere.
     */
    const spec = readFileSync(join(RAIZ, 'docs', 'ai', 'NEXUSMED_PATIENT_EXPERIENCE_AND_DESIGN_MASTER_LOOP_V9.md'), 'utf8')
    for (const u of UNIDADES) expect(spec, `falta ${u} en la especificación`).toContain(u)
  })
})

describe('la especificación maestra está entera', () => {
  it('no se ha truncado', () => {
    /**
     * El dueño la entregó completa y pidió que se guardara sin resumir. Un
     * archivo que se acorta poco a poco —una compactación aquí, un «resumen»
     * allá— es la forma más silenciosa de perder la autoridad del documento.
     *
     * No se sella con un hash: el dueño puede querer ampliarla, y una prueba que
     * prohíbe editar lo que su autor quiere editar acaba borrada. Se comprueba
     * que no ENCOJA por debajo de lo entregado y que sus anclas sigan ahí.
     */
    const spec = readFileSync(join(RAIZ, 'docs', 'ai', 'NEXUSMED_PATIENT_EXPERIENCE_AND_DESIGN_MASTER_LOOP_V9.md'), 'utf8')
    expect(spec.split('\n').length).toBeGreaterThanOrEqual(907)
    for (const ancla of [
      'CARE-PLAN-BOUNDED PATIENT INTELLIGENCE',
      'PATIENT SAFETY FIREWALL',
      'PatientVisitPackage',
      'claim validation not actually performed',
      'Continue from persistent state.',
    ]) expect(spec, `falta el ancla: ${ancla}`).toContain(ancla)
  })
})

describe('`V9_COMPLETE.md` sólo puede existir cuando de verdad se cumple', () => {
  /**
   * Estos casos pasan hoy **porque el archivo no existe**. Ése es su estado
   * normal durante todo el programa. Se activan el día que alguien lo cree, y
   * ese día tienen que morder.
   *
   * Probado al revés: creando `agent-state/V9_COMPLETE.md` con el programa a
   * medias, los tres siguientes fallan.
   */
  const declarado = () => existsSync(COMPLETO)

  it('si existe, las diez unidades tienen SHA de cierre en el checkpoint', () => {
    if (!declarado()) return
    const chk = readFileSync(join(RAIZ, 'agent-state', 'LAST_SAFE_CHECKPOINT.md'), 'utf8')
    const sinCerrar = UNIDADES.filter(u => !new RegExp(`${u}[\\s\\S]{0,400}?\`[0-9a-f]{7,40}\``).test(chk))
    expect(sinCerrar, `unidades sin SHA de cierre: ${sinCerrar.join(', ')}`).toEqual([])
  })

  it('si existe, no queda ningún P0 ni P1 abierto', () => {
    if (!declarado()) return
    const abiertos = backlog()
      .filter(e => e.prioridadV9 === 'P0' || e.prioridadV9 === 'P1')
      .filter(e => !cerrado(e))
      .map(e => `${e.prioridadV9} ${e.id}`)
    expect(abiertos, `bloqueantes abiertos: ${abiertos.join(', ')}`).toEqual([])
  })

  it('si existe, ninguna compuerta del criterio sigue en ❌', () => {
    if (!declarado()) return
    /**
     * «claim validation not actually performed» está en la lista de NUNCA de la
     * especificación. Una compuerta en ❌ es exactamente eso: una validación que
     * no se hizo. Declarar V9 terminado con una pendiente sería incumplir la
     * especificación en la última línea del programa.
     */
    expect(readFileSync(CRITERIO, 'utf8')).not.toContain('❌')
  })
})

describe('mientras V9 no esté terminado, el estado lo dice', () => {
  it('hoy `V9_COMPLETE.md` NO existe', () => {
    /**
     * Este caso es la foto del momento y **se espera que falle** el día
     * legítimo: cuando V9 termine de verdad, se borra este caso en el mismo
     * commit que crea el archivo, y los tres de arriba pasan a mandar.
     *
     * Está escrito así a propósito. Un programa que puede declararse terminado
     * sin tocar ninguna prueba se declara terminado antes.
     */
    expect(existsSync(COMPLETO)).toBe(false)
  })

  it('quedan unidades pendientes y bloqueantes abiertos, y el backlog lo refleja', () => {
    const bloqueantes = backlog().filter(e => (e.prioridadV9 === 'P0' || e.prioridadV9 === 'P1') && !cerrado(e))
    expect(bloqueantes.length).toBeGreaterThan(0)
  })
})
