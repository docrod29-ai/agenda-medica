# ADR · NEWS2 sobre conjunto contemporáneo

**Motor:** `news2-set` · `src/lib/clinical/news2-set.ts`
**Estado:** `validado` — la decisión que implementa es explícita y completa.

## Fuente de verdad

**Decisión ICU-Q4.1 del médico dueño, 29-jul-2026**
(`docs/clinical-decisions/DECISIONES-ICU-VOICE-INFUSION-OBSERVATION.md`):

> «**NO** implementar TTL fijo de 4 horas **ni** Last Observation Carried Forward
> para fabricar un NEWS2 actual. NEWS2 debe calcularse sobre un conjunto
> **CONTEMPORÁNEO** de observaciones. Si una variable requerida no está
> disponible en ese set: `NEWS2_STATUS = INCOMPLETE`. No rellenarla
> automáticamente con el último dato histórico.»

Y el ejemplo literal del encuadre:

```
Último NEWS2: 3 · calculado 08:00 · hora actual 12:00
  NO:  NEWS2 actual = 3
  SÍ:  Último NEWS2 válido: 3 · 08:00
```

## Referencia

- **Royal College of Physicians · NEWS2** — los seis parámetros fisiológicos más
  el oxígeno suplementario, con Scale 1 y Scale 2. Este motor **no toca la
  fórmula**: los puntos los calcula `src/lib/hospital/news2.ts`. La decisión lo
  prohíbe expresamente: «la política hospitalaria puede definir frecuencia de
  adquisición, pero no modificar la fórmula NEWS2».
- **HL7 FHIR · Observation** — `effectiveDateTime` para `measuredAt`.

⚠️ Ningún umbral de este archivo se copió de una respuesta de IA. Aquí no hay
umbrales: sólo se decide **qué observaciones entran** al score.

## Golden

`src/__tests__/news2-set-contemporaneo.test.ts` — **15 casos**.

| Congela |
|---|
| El ejemplo del Dr: set vigente incompleto ⇒ encuadre «último válido», NO se fabrica un score |
| NO se mezclan tomas: FR 08:10 + TA 09:40 + SpO₂ 11:55 dan tres sets incompletos, no un NEWS2 «de ahora» |
| Una variable de OTRA toma no completa la vigente (la TA vieja no se arrastra) |
| El set incompleto DICE qué falta |
| Una corrección pertenece a la MISMA toma y desplaza a la corregida (enlaza con ICU-Q3) |
| Las **seis** variables del Royal College, ni una más ni una menos |
| `oxigeno` es modificador, no una séptima variable puntuada |

## Unidades y firma

```ts
agruparEnSets(ObservacionDeSet[]) → SetContemporaneo[]
presentarNews2(SetContemporaneo[], instanteIso) → News2Presentacion
```

No calcula puntos. El instante entra por parámetro: el motor no lee el reloj.

## Dato faltante

Variable ausente del set ⇒ `INCOMPLETE` y `puedeCalcularAhora: false`. Sin
observaciones válidas ⇒ `NO_DATA`, nunca un cero. Set del futuro ⇒ no es el
vigente. Instante inválido ⇒ lanza.

## Por qué existe

`observacion-version.ts` responde «¿cuál es el valor vigente de **una**
variable?», con un parámetro `ventanaMs`. Para un score **compuesto** eso es
exactamente el TTL que la decisión rechaza: con una ventana de 4 h un NEWS2 de
las 12:00 podría armarse con seis variables de horas distintas, y ese número no
describe a ningún paciente en ningún momento.

La unidad de verdad de un score compuesto es la **toma**.

## Nota de alcance clínico

La decisión lo declara: en UCI, NEWS2 es **complementario** — no reemplaza la
monitorización continua ni las herramientas propias del paciente crítico.
