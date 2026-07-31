/**
 * GATE DEL COMPILADOR de E1-01 — NO es un test de vitest.
 *
 * Media aceptación de la unidad («un hecho sin unidad… no valida») se prueba en
 * runtime, pero la otra media la prueba `tsc`: que un hecho MAL FORMADO ni
 * siquiera sea expresable. Eso no lo puede probar un `expect()`.
 *
 * Cada caso lleva `@ts-expect-error`. Si alguno dejara de fallar, TypeScript
 * emite `TS2578 Unused '@ts-expect-error' directive` y tumba `npx tsc --noEmit`
 * Y `npm run build` — ése es el mecanismo de aceptación.
 *
 * Termina en `.tipos.ts` a propósito: NO empareja con el `include` de vitest
 * (`src/__tests__/**\/*.test.ts`) pero SÍ con el `**\/*.ts` de tsconfig.json.
 * Mismo patrón que `clinical-quantity.tipos.ts` (E0-04). Su integridad la vigila
 * el guardián de `src/__tests__/clinical-fact.test.ts`.
 */
import { cantidad, parsearCantidad, type ClinicalQuantity } from '@/types/clinical-quantity'
import type { ClinicalFact, ValorClinico, ProcedenciaHecho } from '@/types/clinical-fact'

const concepto = { clave: 'creatinina' }
const fuente = { tipo: 'laboratorio' } as const
const procedenciaOk: ProcedenciaHecho = {
  origen: 'humano',
  registradoEn: '2026-07-28T09:00:00Z',
  autor: { uid: 'uid_demo' },
}
const valorOk: ValorClinico = { clase: 'cantidad', cantidad: cantidad(1.2, 'mg/dL', 'concentracion_masa') }

const hechoOk: ClinicalFact = {
  id: 'f1', clinicId: 'clinic_demo', pacienteId: 'pac_demo_1',
  concepto, valor: valorOk, estado: 'final', certeza: 'confirmed',
  fuente, procedencia: procedenciaOk, observedAt: '2026-07-28T09:00:00Z',
}

// ── CASOS NEGATIVOS: cada uno DEBE ser un error de compilación ──────────────

// 1 — un número SUELTO como valor: es exactamente lo que la unidad prohíbe
// @ts-expect-error un number no es una cantidad clínica (le falta la unidad)
const v1: ValorClinico = { clase: 'cantidad', cantidad: 1.2 }

// 2 — inventar una variante «numero» sin unidad para saltarse el catálogo
// @ts-expect-error la union de ValorClinico es CERRADA: no hay variante sin unidad
const v2: ValorClinico = { clase: 'numero', valor: 1.2 }

// 3 — fabricar la cantidad a mano (sin pasar por la puerta de entrada de E0-04)
// @ts-expect-error falta la marca fantasma: `cantidad()` es la única puerta
const v3: ValorClinico = { clase: 'cantidad', cantidad: { valor: 1.2, unidad: 'mg/dL', dimension: 'concentracion_masa' } }

// 4 — un hecho SIN procedencia (mitad literal de la aceptación)
// @ts-expect-error `procedencia` es obligatoria: sin ella el hecho no responde ante nadie
const h4: ClinicalFact = {
  id: 'f2', clinicId: 'clinic_demo', pacienteId: 'pac_demo_1',
  concepto, valor: valorOk, estado: 'final', certeza: 'confirmed',
  fuente, observedAt: '2026-07-28T09:00:00Z',
}

// 5 — procedencia vacía: el patrón `provenance: {}` que hoy sí pasa en expediente.ts
// @ts-expect-error la union está discriminada por `origen`: no hay variante vacía
const p5: ProcedenciaHecho = {}

// 6 — procedencia de IA SIN modelo (invariante 5 del programa)
// @ts-expect-error la variante 'ia' exige modelo y promptVersion
const p6: ProcedenciaHecho = {
  origen: 'ia', registradoEn: '2026-07-28T09:00:00Z',
  autor: { uid: 'uid_demo' }, promptVersion: 'v1', revisadoPorHumano: true,
}

// 7 — procedencia de motor SIN engineVersion (no se puede reproducir el cálculo)
// @ts-expect-error la variante 'motor' exige engineId y engineVersion
const p7: ProcedenciaHecho = { origen: 'motor', registradoEn: '2026-07-28T09:00:00Z', engineId: 'ckd-epi-2021' }

// 8 — efecto de corrección fuera del vocabulario ya decidido en hospital.ts
// @ts-expect-error 'borra' no existe: el libro es append-only (anula|sustituye|aclara)
const s8: ClinicalFact['supersedes'] = { factId: 'f1', efecto: 'borra' }

// 9 — el hecho es INMUTABLE: corregir es anexar otro, no editar éste
// @ts-expect-error `estado` es readonly
hechoOk.estado = 'anulado'

// 10 — la puerta de entrada de datos externos devuelve una cantidad HETEROGÉNEA:
//      no se puede colar en un motor que exige una dimensión concreta
const suelta = parsearCantidad(1.2, 'mg/dL', 'concentracion_masa')
// @ts-expect-error CualquierCantidad sirve para guardar/mostrar, no para operar tipado
const q10: ClinicalQuantity<'concentracion_masa'> = suelta!

// Consumo de los símbolos para que `noUnusedLocals` (si se activa) no interfiera
// con el mecanismo del gate: lo que importa es el @ts-expect-error, no el uso.
export const _casos = [v1, v2, v3, h4, p5, p6, p7, s8, q10]
