/**
 * REP-015 · B-001 (B-ingeniero-ia) — el prompt del consultor de evidencia
 * ORDENA al modelo ajustar la dosis por función renal/hepática y peso.
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 * `src/app/api/consultor-evidencia/route.ts:474`, en `const system = '…'`:
 *   «usa la "DOSIS OFICIAL (FDA)" dada (ajústala a función renal/hepática y
 *   peso …)» y «Recuerda ajustar por función renal/hepática, peso y edad».
 * El ajuste renal tiene motor determinista (`funcion-renal.ts`,
 * `prescripcion-segura.ts`) y este camino no lo usa; la prosa llega a la nota
 * por `agregarAnalisisANota` (consulta page.tsx:2305-2334) y la compuerta de
 * firma sólo mira medicamentos estructurados, no esa sección.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor B-ingeniero-ia, B-001; equipo rojo confirmado P1: el verbo es
 * «ajústala», imperativo; río abajo no hay defensa determinista, sólo otra
 * frase del mismo prompt («NUNCA emitas una CIFRA sin respaldo») — prompt
 * contra prompt.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * Prohibir inventar la cifra BASE no es prohibir CALCULAR el ajuste; el prompt
 * lo ordena explícitamente.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * clinical-safety §2: el modelo de lenguaje redacta y extrae; todo ajuste
 * renal, conversión o cálculo corre en un motor determinista con pruebas.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * CONTRATO TEXTUAL declarado: la ruta importa el cliente de IA y Firebase Admin
 * y no se puede cargar sin red/credenciales. Se extrae el literal `system` y
 * se busca una orden de ajustar/calcular/estimar sobre dosis en función de
 * renal/hepático/peso/edad.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No garantiza que el modelo obedezca un prompt corregido (WS-12, corpus y
 * jueces). No revisa el resto de `system` de `src/app/api/**` — B-001 propone
 * un guardián general con lista de exentos; esto sólo reproduce el caso. No
 * propone qué cifra debe entregar el motor: NEEDS_CLINICAL_REVIEW donde falte.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

const raiz = path.resolve(__dirname, '../../../..')
const ruta = readFileSync(path.join(raiz, 'src', 'app', 'api', 'consultor-evidencia', 'route.ts'), 'utf8')

/** Orden (imperativo o «recuerda …») de ajustar/calcular/estimar en función de renal/hepático/peso/edad. */
const ORDEN_DE_AJUSTAR =
  /\b(aj[uú]st(a|ala|arla|ar)|calc[uú]l(a|ala|ar)|estim(a|ala|ar))\b[^.;]{0,80}(renal|hep[aá]tic|\bpeso\b|\bedad\b)/i

describe('REP-015 · el prompt del consultor no ordena calcular ni ajustar dosis', () => {
  const system = ruta.match(/const system = '((?:[^'\\]|\\.)*)'/)?.[1]

  it('el literal `system` se encuentra (si no, la prueba no dice nada)', () => {
    expect(system, 'no se encontró `const system = \'…\'` en la ruta').toBeTruthy()
    expect(system!.length).toBeGreaterThan(200)
  })

  it('no contiene una orden de ajustar/calcular/estimar dosis por función renal/hepática, peso o edad', () => {
    const m = system!.match(ORDEN_DE_AJUSTAR)
    expect(m, `el prompt ordena: «${m?.[0]}»`).toBeNull()
  })

  it('control: la regex no dispara con una redacción que delega el cálculo al motor', () => {
    const bien = 'El ajuste por función renal YA lo calculó un motor determinista y te llega en el contexto; no lo recalcules.'
    expect(bien.match(ORDEN_DE_AJUSTAR)).toBeNull()
    const mal = 'Ajústala a función renal y peso.'
    expect(mal.match(ORDEN_DE_AJUSTAR)).not.toBeNull()
  })
})
