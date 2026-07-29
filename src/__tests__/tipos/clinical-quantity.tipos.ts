/**
 * GATE DEL COMPILADOR de E0-04 — NO es un test de vitest.
 *
 * La aceptación de la unidad es literal: «el compilador rechaza operar cantidades
 * de unidades incompatibles». Eso no lo puede probar un `expect()`: lo prueba
 * `tsc`. Este archivo lista los casos que DEBEN fallar la compilación, cada uno
 * con `@ts-expect-error`. Si alguno dejara de fallar, TypeScript emite
 * `TS2578 Unused '@ts-expect-error' directive` y tumba `npx tsc --noEmit` Y
 * `npm run build` — es decir, el CI. Ese es el mecanismo de aceptación.
 *
 * Termina en `.tipos.ts` a propósito: NO empareja con el `include` de vitest
 * (`src/__tests__/**\/*.test.ts`) pero SÍ con el `**\/*.ts` de tsconfig.json.
 * Vitest lo ignora; el compilador lo verifica.
 *
 * Su integridad la vigila el guardián de src/__tests__/clinical-quantity.test.ts
 * (borrar este archivo o comentar los casos no debe ser una forma de "arreglar"
 * el CI).
 */
import {
  cantidad, sumar, comparar, convertir, valorEn, etiqueta,
  type ClinicalQuantity, type CualquierCantidad,
} from '@/types/clinical-quantity'

const masa = cantidad(500, 'mg', 'masa')
const volumen = cantidad(500, 'mL', 'volumen')
const creatMgDl = cantidad(1.2, 'mg/dL', 'concentracion_masa')
const creatUmolL = cantidad(106, 'µmol/L', 'concentracion_sustancia')
const tfgCruda = cantidad(80, 'mL/min', 'depuracion')
const tfgIndexada = cantidad(80, 'mL/min/1.73m²', 'depuracion_indexada')
const dosisDiaria = cantidad(40, 'mg/kg/día', 'tasa_dosis_peso')
const noradrenalina = cantidad(0.1, 'µg/kg/min', 'tasa_dosis_peso')
const vasopresina = cantidad(0.03, 'U/min', 'tasa_actividad')

// ── CASOS NEGATIVOS: cada uno DEBE ser un error de compilación ──────────────

// 1 — sumar masa con volumen (ejemplo textual del objetivo del backlog)
// @ts-expect-error mg y mL son dimensiones distintas
sumar(masa, volumen)

// 2 — comparar mg/dL con µmol/L (segundo ejemplo textual del backlog)
// @ts-expect-error concentración de masa vs. concentración de sustancia
comparar(creatMgDl, creatUmolL)

// 3 — convertir a una unidad de otra dimensión
// @ts-expect-error 'mL' no es una unidad de masa
convertir(masa, 'mL')

// 4 — construir con una unidad que no pertenece a la dimensión declarada
// @ts-expect-error 'mL' no pertenece a la dimensión masa
cantidad(5, 'mL', 'masa')

// 5 — número crudo donde se exige una cantidad
// @ts-expect-error un number suelto no es una cantidad clínica
sumar(masa, 500)

// 6 — colar un CualquierCantidad donde se exige <'masa'>
const heterogenea: CualquierCantidad[] = [masa, volumen, creatMgDl]
// @ts-expect-error la puerta de escape sirve para guardar/mostrar, no para operar
sumar(masa, heterogenea[0])

// 7 — extraer el valor en una unidad de otra dimensión
// @ts-expect-error 'mmol/L' no es unidad de concentración de masa
valorEn(creatMgDl, 'mmol/L')

// 8 — depuración cruda vs. indexada a 1.73 m² (exige superficie corporal)
// @ts-expect-error mL/min y mL/min/1.73m² son dimensiones distintas a propósito
comparar(tfgCruda, tfgIndexada)

// 9 — dosis por peso en U/min (actividad) contra mg/kg/min (masa)
// @ts-expect-error una tasa en unidades internacionales no es una tasa de masa
sumar(noradrenalina, vasopresina)

// 10 — objeto fabricado a mano: la MARCA no es exportable
// @ts-expect-error falta la marca fantasma: la única puerta es cantidad()
const falsa: ClinicalQuantity<'masa'> = { valor: 5, unidad: 'mg', dimension: 'masa' }

// ── CASOS POSITIVOS: DEBEN compilar ────────────────────────────────────────

const suma: ClinicalQuantity<'masa'> = sumar(masa, cantidad(250, 'g', 'masa'))
const enMgL: ClinicalQuantity<'concentracion_masa'> = convertir(creatMgDl, 'mg/L')
const orden: -1 | 0 | 1 = comparar(dosisDiaria, cantidad(1, 'mg/kg/min', 'tasa_dosis_peso'))
const texto: string = etiqueta(heterogenea[0])
const numero: number = valorEn(creatMgDl, 'mg/dL')

// Referencias para que nada quede como declaración muerta.
export const _positivos = { suma, enMgL, orden, texto, numero, falsa, creatUmolL, tfgIndexada }
