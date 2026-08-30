# Regla — pruebas y compuertas

## Una prueba que no puede fallar no es una prueba

Prohibidas las tautologías (`expect(f(x)).toBe(f(x))`). Todo guardián nuevo se
prueba **al revés**: se le mete el defecto y se comprueba que falla.

## El golden explica, no sólo verifica

Cabecera con: qué fallaba, **cómo se descubrió**, la causa raíz, la regla que lo
hace seguro y **qué NO cubre**. Un caso sin origen se borra en seis meses por
parecer trivial.

## El trinquete sólo baja

`node scripts/lint-trinquete.mjs`. Techo actual **95** (el número vivo está en
`docs/audit/lint-techo.json`, que es lo que compara el guardián). Si un cambio lo sube, se
arregla el cambio — no se sube el techo.

## `npm run build` no es opcional

`tsc` cubre lo que vitest no ve: la suite ha pasado con 6 000 casos y el build ha
fallado por un tipo. Los dos, siempre.

## Sellado

Toda prueba citada en `docs/audit/regression-ledger.md` va sellada en
`src/lib/clinical/invariantes-clinicos.json` con su conteo mínimo de casos.
