/**
 * GATE DEL COMPILADOR de E0-05 — NO es un test de vitest.
 *
 * La aceptación de la unidad es literal: «creatinina en µmol/L ya no puede llegar
 * cruda a CKD-EPI». Eso no lo puede probar un `expect()`: lo prueba `tsc`. Este
 * archivo lista, motor por motor, los casos que DEBEN fallar la compilación, cada
 * uno con `@ts-expect-error`. Si alguno dejara de fallar, TypeScript emite
 * `TS2578 Unused '@ts-expect-error' directive` y tumba `npx tsc --noEmit` Y
 * `npm run build` — es decir, el CI. Ese es el mecanismo de aceptación.
 *
 * Termina en `.tipos.ts` a propósito: NO empareja con el `include` de vitest
 * (`src/__tests__/**\/*.test.ts`) pero SÍ con el `**\/*.ts` de tsconfig.json.
 * Vitest lo ignora; el compilador lo verifica.
 *
 * Su integridad la vigila el guardián de src/__tests__/motores-unidad-cruzada.test.ts
 * (borrar este archivo o comentar los casos no puede ser la forma de poner el CI
 * en verde). Mismo patrón que clinical-quantity.tipos.ts (E0-04).
 */
import {
  cantidad, sumar, mgPorDl, kg, micromolPorL,
} from '@/types/clinical-quantity'
import {
  ckdEpi2021, cockcroftGault, evaluarFuncionRenal, ajusteRenalFarmacos,
} from '@/lib/expediente/funcion-renal'
import { analizarGasometria } from '@/lib/uci/gasometria'
import { dosisARate, rateADosis } from '@/lib/uci/infusiones'
import { revisarDosis } from '@/lib/seguridad/dosis'

const creatMgDl = mgPorDl(1.2)
const creatUmolL = micromolPorL(106)
const peso = kg(70)
const meds = [{ nombre: 'Vancomicina 1 g' }]

// ── LOTE 1 · FUNCIÓN RENAL ─────────────────────────────────────────────────

// 1 — LA ACEPTACIÓN LITERAL DE E0-05: creatinina en µmol/L a CKD-EPI.
// @ts-expect-error µmol/L es concentracion_sustancia, no concentracion_masa
ckdEpi2021(creatUmolL, 60, 'Masculino')

// 2 — un `number` crudo (sin unidad) a CKD-EPI
// @ts-expect-error un número suelto ya no es una creatinina
ckdEpi2021(1.2, 60, 'Masculino')

// 3 — peso como número crudo en Cockcroft-Gault
// @ts-expect-error el peso debe traer su unidad
cockcroftGault(creatMgDl, 60, 'Masculino', 70)

// 4 — peso como VOLUMEN (el clásico "70 L" por "70 kg")
// @ts-expect-error un volumen no es una masa
cockcroftGault(creatMgDl, 60, 'Masculino', cantidad(70, 'L', 'volumen'))

// 5 — creatinina cruda a evaluarFuncionRenal
// @ts-expect-error la frontera debe nombrar la unidad
evaluarFuncionRenal(1.2, 60, 'Masculino', peso)

// 6 — depuración cruda al ajuste renal de fármacos
// @ts-expect-error la depuración debe declarar su procedencia y su unidad
ajusteRenalFarmacos(meds, 45)

// 7 — depuración MAL ETIQUETADA: base Cockcroft con una TFG indexada
// @ts-expect-error mL/min/1.73m² no es mL/min; no hay factor sin superficie corporal
ajusteRenalFarmacos(meds, { base: 'cockcroft-gault', q: cantidad(45, 'mL/min/1.73m²', 'depuracion_indexada') })

// 8 — sumar una TFG indexada con una depuración cruda
// @ts-expect-error dimensiones separadas a propósito (decisión D2 de E0-04)
sumar(cantidad(60, 'mL/min/1.73m²', 'depuracion_indexada'), cantidad(60, 'mL/min', 'depuracion'))

// ── LOTE 2 · GASOMETRÍA ────────────────────────────────────────────────────

// 9 — PaCO2 con dimensión de electrolito
// @ts-expect-error mEq/L no es una presión
analizarGasometria({ paco2: cantidad(40, 'mEq/L', 'concentracion_equivalente') })

// 10 — albúmina en mEq/L (el bug real de la albúmina en g/L, ahora también en tipos)
// @ts-expect-error la albúmina es concentracion_masa (g/dL)
analizarGasometria({ albumina: cantidad(40, 'mEq/L', 'concentracion_equivalente') })

// 11 — HCO3 como número crudo
// @ts-expect-error el bicarbonato debe traer su unidad (mEq/L)
analizarGasometria({ ph: 7.2, paco2: cantidad(30, 'mmHg', 'presion'), hco3: 12 })

// 12 — Na en mmol/L: numéricamente igual, pero el anion gap resta las tres y el
//      catálogo declara Na/Cl/HCO3 en mEq/L (mEq y mmol son dimensiones aparte:
//      el puente depende de la valencia del ion).
// @ts-expect-error concentracion_sustancia no es concentracion_equivalente
analizarGasometria({ na: cantidad(140, 'mmol/L', 'concentracion_sustancia') })

// ── LOTE 3 · INFUSIONES ────────────────────────────────────────────────────

// 13 — dosis cruda a la conversión con mayor potencial de daño de la UCI
// @ts-expect-error la dosis debe traer su unidad
dosisARate({ farmacoKey: 'norepinefrina', pesoKg: kg(70), dosis: 0.1 })

// 14 — una MASA (mg) no es una tasa de infusión
//
// HONESTIDAD: lo que el tipo NO puede atrapar aquí es el cruce fármaco↔dimensión
// (µg/min para norepinefrina, que se dosifica por kg), porque `farmacoKey` es un
// string en tiempo de compilación. Eso lo bloquea el motor EN EJECUCIÓN y está
// probado en uci-infusiones.test.ts («la dimensión de la dosis debe ser la del
// fármaco»). El tipo cierra la puerta de las dimensiones ajenas al catálogo.
// @ts-expect-error 'masa' no es ninguna de las tres dimensiones de dosis de infusión
dosisARate({ farmacoKey: 'vasopresina', dosis: cantidad(0.03, 'mg', 'masa') })

// 15 — velocidad de infusión como número crudo
// @ts-expect-error mL/h debe viajar como tasa_volumen
rateADosis({ farmacoKey: 'norepinefrina', pesoKg: kg(70), rateMlH: 12 })

// ── LOTE 4 · SEGURIDAD DE DOSIS ────────────────────────────────────────────

// 16 — dosis cruda: el estado que causó el P0 de pediatría ya no es representable
// @ts-expect-error la dosis prescrita debe declarar si es absoluta o por kg
revisarDosis({ farmaco: 'paracetamol', dosis: 500 })

// 17 — una dosis POR PESO no es una masa: el discriminante ya no es un booleano
//      que se pueda olvidar, es la dimensión.
// @ts-expect-error mg/kg/dosis (dosis_por_peso) no es 'masa'
revisarDosis({ farmaco: 'paracetamol', dosis: cantidad(15, 'mg/kg/dosis', 'dosis_por_peso'), peso: 20 })

// ── POSITIVOS DE CONTROL: cada motor con la cantidad correcta DEBE compilar ──
// Sin esto el gate podría pasar "por vacío" (todo rechazado, nada usable).

ckdEpi2021(creatMgDl, 60, 'Masculino')
cockcroftGault(creatMgDl, 60, 'Masculino', peso)
evaluarFuncionRenal(creatMgDl, 60, 'Masculino', peso)
ajusteRenalFarmacos(meds, { base: 'cockcroft-gault', q: cantidad(45, 'mL/min', 'depuracion') })
ajusteRenalFarmacos(meds, { base: 'ckd-epi', q: cantidad(45, 'mL/min/1.73m²', 'depuracion_indexada') })
analizarGasometria({
  ph: 7.2,
  paco2: cantidad(30, 'mmHg', 'presion'),
  hco3: cantidad(12, 'mEq/L', 'concentracion_equivalente'),
  na: cantidad(140, 'mEq/L', 'concentracion_equivalente'),
  cl: cantidad(100, 'mEq/L', 'concentracion_equivalente'),
  albumina: cantidad(4, 'g/dL', 'concentracion_masa'),
})
dosisARate({ farmacoKey: 'norepinefrina', pesoKg: kg(70), dosis: cantidad(0.1, 'µg/kg/min', 'tasa_dosis_peso') })
dosisARate({ farmacoKey: 'vasopresina', dosis: cantidad(0.03, 'U/min', 'tasa_actividad') })
rateADosis({ farmacoKey: 'norepinefrina', pesoKg: kg(70), rateMlH: cantidad(12, 'mL/h', 'tasa_volumen') })
revisarDosis({ farmaco: 'paracetamol', dosis: cantidad(500, 'mg', 'masa') })
revisarDosis({ farmaco: 'paracetamol', dosis: cantidad(15, 'mg/kg/dosis', 'dosis_por_peso'), peso: kg(20) })
