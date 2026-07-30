# ADR · Vocabulario por contexto (voz de UCI)

**Motor:** `uci-contexto-vocabulario` · `src/lib/uci/contexto-vocabulario.ts`
**Estado:** `validado` — las listas son del médico dueño; el módulo sólo las
consulta.

## Fuente de verdad

**Charter NEXUSMED CRITICAL CARE OS §8** (Dr. David Alonso Rodríguez Luna):

> «El vocabulario debe cambiar según contexto. Si el médico dice
> **Respiratorio**, activar diccionario: PEEP · PIP · Pplat · VT · FiO2 ·
> driving pressure · compliance · auto-PEEP · flow · trigger · I:E · PS»

Y las otras tres listas — **hemodinámico**, **prisma**, **ECMO** — igual de
literales.

⚠️ **Ningún término fue añadido, quitado ni "mejorado".** El charter §10 lo
prohíbe expresamente: «NO crear aliases clínicamente incorrectos». Cuatro casos
del golden comparan cada lista **exacta** contra la del charter, así que un
añadido silencioso rompe el CI.

## Referencia

Terminología de cuidados críticos aportada por el médico dueño. No hay umbrales
ni criterios clínicos en este archivo: sólo qué palabras están activas.

## Golden

`src/__tests__/uci-contexto-vocabulario.test.ts` — **22 casos**.

| Congela |
|---|
| Las cuatro listas, **palabra por palabra**, contra el charter |
| El médico nombra el contexto como lo dice de verdad («Prisma», «el ventilador») |
| **Sin contexto nombrado ⇒ `null`** — no se adivina del contenido |
| `sweep` es de ECMO y **no** de respiratorio (par peligroso del §42) |
| `VT` respiratorio vs `VTI` hemodinámico — **no compiten** si hay contexto |
| `flow` aparece en DOS contextos y se detecta **solo**, derivado del vocabulario |
| `contextoConcuerda` es **fail-open** sin contexto activo |

## Por qué no se adivina el contexto

Inferirlo de las palabras dictadas sería **circular**: el contexto existe
precisamente para desempatar palabras ambiguas, así que deducirlo de esas mismas
palabras le quita todo su valor. Si el médico no lo nombra, no hay contexto — y
la ambigüedad se sigue cazando por las otras señales de `confirmacion.ts`
(confianza, candidato cercano, plausibilidad).

## Por qué `contextoConcuerda` falla ABIERTO

Sin contexto declarado no se puede afirmar que un término lo contradiga.
Devolver `false` haría preguntar desde el primer término de cada dictado — que es
exactamente la fatiga de alertas que prohíbe la decisión ICU-Q4.4.

Un término que no está en **ningún** vocabulario tampoco contradice nada: puede
ser narrativa perfectamente legítima («abdomen blando»).

## Cómo alimenta a la seguridad

Un diccionario único compite consigo mismo: «sweep» contra «suip», «VT» contra
«VTI», «PEEP» contra «PIP», todos a la vez y siempre. Acotar al contexto activo
reduce el número de candidatos confundibles, que es la entrada
`candidatos` de `clasificarConfirmacion`. Y en la otra dirección, un término
ajeno al contexto activo levanta la señal `contextoConcuerda: false`, que hace
preguntar.
