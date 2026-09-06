/**
 * LA PAUTA NEONATAL NO ES LA DE UN ESCOLAR — Panel de Lujo MP-003 (P1).
 *
 * Nació como `REP-052` en `docs/audit/panel-de-lujo-2026-09/reproducciones/` y
 * se movió aquí, ya en verde, con el arreglo puesto. Lo que sigue es la
 * cabecera original del reproductor, íntegra, más lo que se reparó al final.
 *
 * ── CÓMO SE REPARÓ ───────────────────────────────────────────────────────────
 *
 * Tres piezas, ninguna de ellas una cifra nueva:
 *
 *  1. `FarmacoPed.edadMaximaDias` — la franja de la pauta deja de ser un
 *     comentario y pasa a ser un dato. Los 7 días salen del NOMBRE y de la NOTA
 *     de la propia pauta, que ya llevaban la validación del Dr.
 *  2. `elegirFarmacoPed(nombre, edad)` — la elección entre pautas del mismo
 *     fármaco se hace por EDAD y no por la primera coincidencia de subcadena.
 *     Cuando sólo los días de vida separan dos pautas y no se sabe la edad en
 *     días, **no elige ninguna**: devuelve `pideEdadEnDias` y el copiloto pide
 *     la fecha de nacimiento. Se pregunta, no se adivina.
 *  3. `edadEnDias()` — porque «≤7 días» es irrepresentable en meses, que era la
 *     razón de fondo por la que la franja no podía acotarse.
 *
 * ── QUÉ SIGUE SIN CUBRIRSE, ADEMÁS DE LO DE ABAJO ────────────────────────────
 *
 * Ninguna otra pauta del catálogo recibe franja de edad: sólo se acotó la que
 * ya declaraba la suya en su nombre. Si hay más pautas con franja implícita, no
 * se vigilan — es `NEEDS_CLINICAL_REVIEW` y lo decide el Dr. Y la edad
 * posmenstrual del prematuro sigue sin existir en el modelo.
 *
 * ── CABECERA ORIGINAL DEL REPRODUCTOR ────────────────────────────────────────
 *
 * REP-052 · MP-003 (M-pediatra) — el copiloto elige «Gentamicina neonatal
 * (≤7 días)» por subcadena para CUALQUIER niño: falsa alarma crítica en un
 * escolar; y el motor devuelve esa pauta como usable a los 8 años.
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 * `src/lib/expediente/copiloto.ts:288`
 *   `FARMACOS_PED.find(x => nm.includes(norm(x.nombre)) || norm(x.nombre).includes(nm))`
 * Para nm='gentamicina', `norm('Gentamicina neonatal (≤7 días)')` la contiene
 * y es la PRIMERA del arreglo (pediatria.ts:67). Luego `:290`
 * `calcularDosisPediatrica(f, peso)` sin edad. La entrada neonatal lleva
 * `edadMinimaMeses: 0` y ninguna edad máxima, así que
 * `calcularDosisPediatrica(neonatal, 20, 96)` devuelve `porToma {50, 50}`.
 * Con 140 mg (7 mg/kg, dentro del tope real de 7.5) sale `excede` ⇒ `critico`.
 * El comentario de pediatria.ts:65-66 («el matcher por edad la prefiera;
 * calcularDosisPediatrica elige por edadMeses») describe una selección que no
 * existe: «escrito y sin conectar».
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor M-pediatra, MP-003; equipo rojo confirmado P1 con jiti (matcher →
 * literalmente la entrada neonatal; motor → 50 mg c/12 h para 8 años).
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * Selección por primera coincidencia de subcadena, sin edad; y un catálogo sin
 * límite superior de edad para una pauta que sólo vale ≤7 días.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * clinical-safety §5 (señalar de menos, nunca de más: un crítico falso enseña a
 * ignorar el verdadero — dosis.ts:437-445 ya lo documenta para insulina) y
 * el-dato-tiene-que-llegar («escrito y sin conectar»).
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * COMPORTAMIENTO: `copiloto()` real y `calcularDosisPediatrica()` real. El
 * escolar sintético (8 años, 20 kg, 140 mg c/24 h) es el del auditor.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No fija la edad máxima en días de la pauta neonatal (NEEDS_CLINICAL_REVIEW:
 * la decide el Dr.). No cubre prematuridad ni edad posmenstrual. No cubre el
 * caso inverso del panel (ofrecer la pauta de 7.5 mg/kg a un recién nacido):
 * eso es PanelPediatria y exige la misma decisión del dueño.
 */
import { describe, it, expect } from 'vitest'
import { copiloto } from '@/lib/expediente/copiloto'
import { FARMACOS_PED, calcularDosisPediatrica, elegirFarmacoPed, edadEnDias } from '@/lib/expediente/pediatria'

const ESCOLAR = { edad: 8, signos: { peso: 20 }, medicamentos: [{ nombre: 'Gentamicina', dosis: '140 mg' }] }
const OCHO_ANIOS_EN_MESES = 96
const neonatal = FARMACOS_PED.find(f => /neonatal/i.test(f.nombre))!
const general = FARMACOS_PED.find(f => f.nombre === 'Gentamicina')!

describe('REP-052 · un escolar con «gentamicina» no casa la pauta neonatal', () => {
  const ped = copiloto(ESCOLAR).filter(s => s.id.startsWith('ped:dosis:'))

  it('control: el catálogo tiene las dos entradas y el copiloto emite algo de dosis pediátrica', () => {
    expect(neonatal).toBeDefined()
    expect(general).toBeDefined()
    expect(ped.length).toBeGreaterThan(0)
  })

  it('ninguna sugerencia pediátrica del escolar habla de la pauta neonatal (hoy: «Gentamicina neonatal (≤7 días): …»)', () => {
    const neo = ped.filter(s => /neonatal/i.test(s.id) || /neonatal/i.test(s.titulo))
    expect(neo.map(s => s.titulo), 'eligió la entrada neonatal por subcadena').toHaveLength(0)
  })

  it('140 mg a 20 kg (7 mg/kg, dentro del tope 7.5) NO es crítico (hoy: falsa alarma crítica)', () => {
    const criticos = ped.filter(s => s.nivel === 'critico')
    expect(criticos.map(s => `${s.titulo} — ${s.detalle}`), 'crítico falso').toHaveLength(0)
  })

  it('el motor no devuelve la pauta neonatal como usable a los 8 años (hoy: 50 mg c/12 h)', () => {
    const d = calcularDosisPediatrica(neonatal, 20, OCHO_ANIOS_EN_MESES) as
      (ReturnType<typeof calcularDosisPediatrica> & { noAplicaPorEdad?: boolean })
    const usable = d != null && !d.contraindicadoPorEdad && !d.noAplicaPorEdad && d.porToma.max > 0
    expect(usable, `devolvió ${JSON.stringify(d?.porToma)}`).toBe(false)
  })

  it('control: la entrada general de gentamicina sí da un rango que contiene 140 mg para 20 kg', () => {
    const d = calcularDosisPediatrica(general, 20, OCHO_ANIOS_EN_MESES)!
    expect(d.contraindicadoPorEdad).toBeFalsy()
    expect(140).toBeLessThanOrEqual(d.porToma.max * 1.05)
  })
})

/**
 * EL CASO INVERSO, QUE EL REPRODUCTOR DECLARÓ SIN CUBRIR.
 *
 * El reproductor sólo miraba el escolar. El otro lado del mismo defecto es peor:
 * a un recién nacido se le podía ofrecer la pauta general de 7.5 mg/kg/día, que
 * es justo la que la nota del catálogo prohíbe («en ≤7 días usar la pauta
 * neonatal»). Aquí se fija que la elección por edad va en las dos direcciones y
 * que, sin la edad en días, no se elige ninguna.
 */
describe('el recién nacido tampoco recibe la pauta del escolar', () => {
  it('con 3 días de vida se elige la pauta neonatal, no la general', () => {
    const e = elegirFarmacoPed('Gentamicina', { dias: 3 })!
    expect(e.pideEdadEnDias).toBeFalsy()
    expect(e.farmaco?.nombre).toMatch(/neonatal/i)
  })

  it('con 40 días de vida se elige la general, no la neonatal', () => {
    const e = elegirFarmacoPed('Gentamicina', { dias: 40 })!
    expect(e.pideEdadEnDias).toBeFalsy()
    expect(e.farmaco?.nombre).toBe('Gentamicina')
  })

  it('sin edad NO se elige ninguna de las dos: se pide la fecha de nacimiento', () => {
    /*
     * Es el punto entero del arreglo. Elegir la general «por descarte» sería
     * dosificar a un recién nacido a 7.5 mg/kg/día; elegir la neonatal, alarmar
     * en falso a un escolar. Las dos son decisiones que este código no puede
     * tomar, así que no las toma.
     */
    const e = elegirFarmacoPed('Gentamicina')!
    expect(e.pideEdadEnDias).toBe(true)
    expect(e.farmaco).toBeUndefined()
    expect(e.candidatos.length).toBe(2)
  })

  it('un fármaco con una sola pauta sigue eligiéndose sin preguntar nada', () => {
    /* AL REVÉS: si el arreglo hubiera hecho preguntar a todo el catálogo, sería
       una regresión de fricción disfrazada de seguridad. */
    const e = elegirFarmacoPed('Paracetamol')!
    expect(e.pideEdadEnDias).toBeFalsy()
    expect(e.farmaco?.nombre).toBe('Paracetamol')
  })

  it('el copiloto, sin fecha de nacimiento, pide el dato en vez de dosificar', () => {
    const s = copiloto({ edad: 0, signos: { peso: 3.2 }, medicamentos: [{ nombre: 'Gentamicina', dosis: '16 mg' }] })
    const pide = s.filter(x => x.id.startsWith('ped:pauta-por-dias:'))
    expect(pide.length).toBe(1)
    expect(pide[0].detalle).toMatch(/fecha de nacimiento/)
    /* Y no emite ninguna dosis para ese fármaco. */
    expect(s.filter(x => x.id === 'ped:dosis:Gentamicina')).toHaveLength(0)
  })
})

describe('edadEnDias', () => {
  it('cuenta días de calendario', () => {
    expect(edadEnDias('2026-09-01', '2026-09-08')).toBe(7)
    expect(edadEnDias('2026-09-01', '2026-09-01')).toBe(0)
  })

  it('una fecha ilegible devuelve null, NO cero', () => {
    /* Un cero aquí significaría «recién nacido»: la conclusión más cara posible
       a partir de un dato que falta. Es la asimetría que MP-010 señaló en
       `edadEnMeses`, resuelta bien desde el principio en la función nueva. */
    expect(edadEnDias('no-es-fecha', '2026-09-08')).toBeNull()
    expect(edadEnDias(undefined)).toBeNull()
    expect(edadEnDias('')).toBeNull()
  })
})
