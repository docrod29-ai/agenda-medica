/**
 * EL CONSULTOR NO ORDENA AJUSTAR LA DOSIS: EL AJUSTE RENAL LO CALCULA EL MOTOR.
 *
 * Era `REP-015` de la auditoría del Panel de Lujo (sep-2026), hallazgo B-001
 * (auditor B-ingeniero-ia, confirmado P1 por el equipo rojo). Reparado.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * `src/app/api/consultor-evidencia/route.ts`, en `const system = '…'`:
 *   «usa la "DOSIS OFICIAL (FDA)" dada (ajústala a función renal/hepática y
 *    peso …)» y «Recuerda ajustar por función renal/hepática, peso y edad».
 * El ajuste renal tiene motor determinista (`funcion-renal.ts`,
 * `prescripcion-segura.ts`) y este camino no lo usaba; la prosa llega a la nota
 * por `agregarAnalisisANota` y la compuerta de firma sólo mira medicamentos
 * estructurados, no esa sección.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor B-ingeniero-ia, B-001; el equipo rojo confirmó que el verbo es
 * «ajústala», imperativo, y que río abajo no hay defensa determinista, sólo
 * otra frase del mismo prompt («NUNCA emitas una CIFRA sin respaldo») —
 * prompt contra prompt.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * Prohibir inventar la cifra BASE no es prohibir CALCULAR el ajuste; el prompt
 * lo ordenaba explícitamente, y el catálogo renal del sistema no entraba nunca
 * en ese camino.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 * clinical-safety §2: el modelo redacta y extrae; todo ajuste renal corre en un
 * motor determinista. `bloqueDeAjusteRenal()` consulta el catálogo `AJUSTE_RENAL`
 * con la depuración que manda la pantalla y entrega al modelo el resultado —o
 * la AUSENCIA declarada— y el prompt ordena citarlo, no recalcularlo.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * (a) COMPORTAMIENTO sobre el módulo puro `bloqueDeAjusteRenal`, probado al
 *     revés (sin depuración → NO calculado; fármaco fuera del catálogo → «no se
 *     vigila», nunca una cifra).
 * (b) CONTRATO TEXTUAL declarado sobre la ruta: importa el cliente de IA y
 *     Firebase Admin y no se puede cargar sin red. Se extrae el literal `system`
 *     y se busca una orden de ajustar/calcular/estimar sobre dosis en función
 *     de renal/hepático/peso/edad; y se exige que el bloque renal llegue al
 *     mensaje de usuario.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No garantiza que el modelo obedezca (WS-12, corpus y jueces). No revisa el
 * resto de `system` de `src/app/api/**`. No calcula la depuración: eso sigue
 * siendo `evaluarFuncionRenal`, y que la pantalla la mande (`depuracionMlMin`)
 * es trabajo de CONSULTA/UI-CONFIG (handoff). Y no propone ninguna cifra para
 * los fármacos que el catálogo no tiene: ésos se declaran «no vigilados».
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { bloqueDeAjusteRenal, depuracionPlausible } from '@/lib/ia/ajuste-renal-para-el-consultor'

const raiz = path.resolve(__dirname, '../..')
const ruta = readFileSync(path.join(raiz, 'src', 'app', 'api', 'consultor-evidencia', 'route.ts'), 'utf8')

/** Orden (imperativo o «recuerda …») de ajustar/calcular/estimar en función de renal/hepático/peso/edad. */
const ORDEN_DE_AJUSTAR =
  /\b(aj[uú]st(a|ala|arla|ar)|calc[uú]l(a|ala|ar)|estim(a|ala|ar))\b[^.;]{0,80}(renal|hep[aá]tic|\bpeso\b|\bedad\b)/i

describe('B-001 · el prompt del consultor no ordena calcular ni ajustar dosis', () => {
  const system = ruta.match(/const system = '((?:[^'\\]|\\.)*)'/)?.[1]

  it('el literal `system` se encuentra (si no, la prueba no dice nada)', () => {
    expect(system, 'no se encontró `const system = \'…\'` en la ruta').toBeTruthy()
    expect(system!.length).toBeGreaterThan(200)
  })

  it('no contiene una orden de ajustar/calcular/estimar dosis por función renal/hepática, peso o edad', () => {
    const m = system!.match(ORDEN_DE_AJUSTAR)
    expect(m, `el prompt ordena: «${m?.[0]}»`).toBeNull()
  })

  it('y dice quién SÍ calcula: el motor, cuyo bloque el modelo cita tal cual', () => {
    expect(system).toMatch(/NO LO HACES TÚ/)
    expect(system).toContain('AJUSTE RENAL CALCULADO POR EL MOTOR')
  })

  it('control: la regex no dispara con una redacción que delega el cálculo al motor', () => {
    const bien = 'El ajuste por función renal YA lo calculó un motor determinista y te llega en el contexto; no lo recalcules.'
    expect(bien.match(ORDEN_DE_AJUSTAR)).toBeNull()
    const mal = 'Ajústala a función renal y peso.'
    expect(mal.match(ORDEN_DE_AJUSTAR)).not.toBeNull()
  })

  it('el bloque del motor LLEGA al mensaje de usuario (no sólo se calcula)', () => {
    expect(ruta).toContain('const renal = bloqueDeAjusteRenal(farmacos, body.depuracionMlMin)')
    expect(ruta).toMatch(/\$\{dosisTxt\}\$\{renalTxt\}/)
  })
})

describe('B-001 · el bloque que arma el motor', () => {
  it('sin depuración: NO CALCULADO, y se le dice al modelo que no la estime', () => {
    const r = bloqueDeAjusteRenal(['vancomicina'], undefined)
    expect(r.calculado).toBe(false)
    expect(r.bloque).toMatch(/NO CALCULADO/)
    expect(r.bloque).toMatch(/[Nn]o la estimes/)
    expect(r.bloque).not.toMatch(/\d+\s*mg/)
  })

  it('con depuración plausible: cita el catálogo para el fármaco que sí está', () => {
    // Metformina está en AJUSTE_RENAL con reglas por TFG; con 25 mL/min hay conducta.
    const r = bloqueDeAjusteRenal(['metformina'], 25)
    expect(r.calculado).toBe(true)
    expect(r.bloque).toContain('AJUSTE RENAL CALCULADO POR EL MOTOR')
    expect(r.bloque).toMatch(/metformina/i)
    expect(r.noVigilados).toEqual([])
  })

  it('un fármaco fuera del catálogo se declara NO VIGILADO — nunca se inventa un ajuste', () => {
    const r = bloqueDeAjusteRenal(['farmacoinexistente'], 25)
    expect(r.noVigilados).toEqual(['farmacoinexistente'])
    expect(r.bloque).toMatch(/NO ESTÁ en el catálogo/)
    expect(r.bloque).not.toMatch(/\d+\s*mg/)
  })

  it('una depuración imposible se trata como desconocida', () => {
    expect(depuracionPlausible(-4)).toBe(false)
    expect(depuracionPlausible(Number.NaN)).toBe(false)
    expect(depuracionPlausible('60')).toBe(false)
    expect(bloqueDeAjusteRenal(['metformina'], 900).calculado).toBe(false)
  })

  it('sin fármacos no hay bloque: no se le habla de riñón a una pregunta que no tiene fármaco', () => {
    expect(bloqueDeAjusteRenal([], 60).bloque).toBe('')
  })
})
