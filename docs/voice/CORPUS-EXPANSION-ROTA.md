# Corpus V3 — la expansión de unidades rompió 1 364 filas

**Encontrado el 4-ago-2026** midiendo el corpus contra el pipeline.

## Qué pasó

El generador expandió las unidades a su forma hablada (`mcg` → «microgramos»)
**sin límite de palabra**. Y una sustitución sin frontera no distingue una unidad
de una letra que va dentro de otra palabra.

| Se escribió | Quedó en el audio |
|---|---|
| guiada | gramos**uiada** |
| agua | a**gramos**ua |
| Ingresos | In**gramos**resos |
| segundo | se**gramos**undo |
| magnesio | ma**gramos**nesio |
| Hemoglobina | Hemo**gramos**lobina |
| fibrinógeno | fibrinó**gramos**eno |
| higiene | hi**gramos**iene |

98 palabras distintas, **1 364 filas de 6 000 — el 23 %**.

## Esto ya se había diagnosticado bien, y se reparó a medias

El propio corpus trae `2_REGENERAR_391_CORREGIDOS.command`, y su diagnóstico era
correcto:

> «La expansión g → gramos corrió DESPUÉS de que mg y mcg ya se habían
> expandido, y **sin límite de palabra**.»

Reparó **391 filas**: las que decían «microgramosramos». Pero el mismo defecto
—la misma línea— estaba pegando en el vocabulario normal, y ahí no se buscó.

**La lección**: se reparó donde dolía la métrica, no donde estaba la causa. Es
exactamente lo que pasa cuando se arregla el síntoma que se está midiendo.

## Por qué importa

El audio dice una palabra que no existe y la referencia espera la correcta. El
reconocedor sale **reprobado por un defecto del corpus, no suyo** — y con él,
cualquier decisión que se tome mirando ese número.

## Qué hay aquí

- `CORPUS-EXPANSION-ROTA.csv` — las 1 364 filas, con las palabras rotas de cada
  una y si quedó reparada o pendiente.
- `scripts/reparar-corpus-expansion.ts` — repara **verificando cada palabra
  contra el texto de referencia**. Lo que no se puede verificar, no se toca:
  reparar a ciegas un corpus de evaluación es cambiar la vara de medir sin mirar.

```bash
npx tsx scripts/reparar-corpus-expansion.ts <corpus.csv> --escribir
```

Resultado: **1 322 reparadas y verificadas · 42 pendientes**, todas la misma
palabra («gramose», de deletrear «GCS» como «ge ce ese»), que no se puede
verificar contra la referencia porque es una letra leída en voz alta.

El original **no se toca**: la salida va a `*_REPARADO.csv`.

## El parche del generador — las tres reglas

Reparar el CSV arregla lo de ayer. Para que no vuelva a pasar:

```js
const UNIDADES = [
  ['mcg','microgramos'], ['mg','miligramos'], ['pg','picogramos'],
  ['ng','nanogramos'], ['kg','kilogramos'], ['mEq','miliequivalentes'],
  ['mmol','milimoles'], ['mL','mililitros'], ['ms','milisegundos'],
  ['g','gramos'], ['L','litros'],
]   // ← de la MÁS LARGA a la más corta

const RE = new RegExp(`(?<=\\d\\s?)\\b(${UNIDADES.map(u => u[0]).join('|')})\\b`, 'g')
const hablado = escrito.replace(RE, m => tabla.get(m) ?? m)
```

1. **Con frontera de palabra** (`\b`). Es la causa raíz, literal.
2. **De la más larga a la más corta, en UNA sola pasada.** Si «mcg» se expande
   primero y luego se corre «g» sobre el resultado, la «g» de «microgramos»
   vuelve a caer — que es exactamente lo que produjo «microgramosramos».
3. **Sólo detrás de una cifra** (`(?<=\d\s?)`). Una «g» suelta en una frase no
   es una unidad.

Quitar cualquiera de las tres reproduce el defecto.

## Después de regenerar

Vuelva a correr el trinquete: `npx vitest run src/__tests__/trinquete-de-voz.test.ts`.
La supervivencia del término clínico en la forma hablada **tiene que subir** —
hoy está en 4 016 de 5 845, y parte de lo que falta es esto.
