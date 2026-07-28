/**
 * ARNÉS PROPERTY-BASED de la casa (Nexus OS · E0-02).
 *
 * Por qué NO se agrega `fast-check`: el repo ya resuelve las propiedades con
 * MALLAS DETERMINISTAS (`clinical-safety-harness.test.ts` → bloque "PROPERTY-BASED"),
 * y una suite clínica que dependa de `Math.random` produce fallos que no se pueden
 * reproducir. Aquí se conserva ese estilo y se le da una forma reutilizable:
 *
 *  - PRNG explícito con semilla → la misma corrida SIEMPRE da los mismos casos.
 *  - El "shrinking" se sustituye por algo más honesto: al primer fallo se reporta
 *    el CASO EXACTO que lo produjo, ya legible y reproducible a mano.
 *
 * NOTA: este archivo NO termina en `.test.ts`, así que `vitest.config.ts`
 * (`include: ['src/__tests__/**\/*.test.ts']`) no lo ejecuta como suite. Tampoco lo
 * importa nada de `src/lib` ni de la app: no entra al bundle de producción.
 */

/**
 * PRNG determinista (LCG de Numerical Recipes, módulo 2³²). Devuelve números en
 * [0, 1). Sin `Math.random`: misma semilla ⇒ misma secuencia, en cualquier máquina.
 */
export function prng(semilla: number): () => number {
  let estado = Math.abs(Math.floor(semilla)) % 4294967296 || 1
  return () => {
    estado = (estado * 1664525 + 1013904223) % 4294967296
    return estado / 4294967296
  }
}

/**
 * Pesos pediátricos en kg: rejilla FIJA (bordes + valores clínicos típicos +
 * los pesos que el barrido previo mostró como peores casos de redondeo) unida a
 * `extra` pesos pseudoaleatorios reproducibles en [0.5, 120].
 *
 * El techo de 120 kg es el de `revisarPesoPediatrico`: por encima hay hard-stop de
 * confirmación, no una dosis que validar.
 */
export function mallaPesosKg(opts?: { semilla?: number; extra?: number }): number[] {
  const fijos = [
    // bordes y neonatos
    0.5, 0.8, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5,
    // lactante y preescolar
    6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20,
    // escolar y adolescente
    22, 25, 28, 30, 33, 33.3, 33.4, 35, 40, 45, 50, 55, 60,
    // adolescente grande / límite del validador de peso
    65, 70, 75, 80, 90, 100, 110, 119.9, 120,
    // peores casos de redondeo detectados en el barrido exhaustivo previo
    51.3, 66.7,
  ]
  const extra = opts?.extra ?? 0
  if (extra <= 0) return [...new Set(fijos)].sort((a, b) => a - b)

  const r = prng(opts?.semilla ?? 20260728)
  const azar: number[] = []
  for (let i = 0; i < extra; i++) {
    // 2 decimales: es la resolución real de una báscula pediátrica.
    azar.push(Math.round((0.5 + r() * 119.5) * 100) / 100)
  }
  return [...new Set([...fijos, ...azar])].sort((a, b) => a - b)
}

/**
 * Edades en meses para las mallas. INCLUYE `undefined` a propósito: hay llamadores
 * que dosifican sin edad capturada (`src/lib/expediente/copiloto.ts`), y ese camino
 * también tiene que cumplir los invariantes.
 */
export const MALLA_EDADES_MESES: readonly (number | undefined)[] = [
  undefined, 0, 1, 2, 3, 6, 12, 24, 60, 120, 204,
]

/**
 * Recorre TODOS los casos aplicando `prop`. Al primer fallo relanza el error con el
 * caso exacto delante, para que el mensaje del CI diga qué fármaco y qué peso lo
 * rompió sin tener que instrumentar nada.
 */
export function paraTodo<T>(
  casos: Iterable<T>,
  etiqueta: (caso: T) => string,
  prop: (caso: T) => void,
): void {
  for (const caso of casos) {
    try {
      prop(caso)
    } catch (e) {
      const detalle = e instanceof Error ? e.message : String(e)
      const err = new Error(`CONTRAEJEMPLO → ${etiqueta(caso)}\n${detalle}`)
      if (e instanceof Error && e.stack) err.stack = e.stack
      throw err
    }
  }
}

/** Producto cartesiano perezoso de dos mallas (evita materializar 50k tuplas). */
export function* pares<A, B>(as: Iterable<A>, bs: Iterable<B>): Generator<[A, B]> {
  const listaB = [...bs]
  for (const a of as) for (const b of listaB) yield [a, b]
}

/** Producto cartesiano perezoso de tres mallas. */
export function* tercias<A, B, C>(
  as: Iterable<A>, bs: Iterable<B>, cs: Iterable<C>,
): Generator<[A, B, C]> {
  const listaB = [...bs], listaC = [...cs]
  for (const a of as) for (const b of listaB) for (const c of listaC) yield [a, b, c]
}
