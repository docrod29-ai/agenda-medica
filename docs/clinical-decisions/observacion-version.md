# ADR · Observación versionada — vigencia clínica y temporal

**Motor:** `observacion-version` · `src/lib/clinical/observacion-version.ts`
**Estado:** `pendiente_validacion` — falta que el médico dueño defina la ventana
temporal (ver «Pendiente» al final).

---

## Fuente de verdad

**Decisión ICU-Q3 del médico dueño, 29-jul-2026**, en
`docs/clinical-decisions/DECISIONES-ICU-VOICE-INFUSION-OBSERVATION.md`.

Esa decisión cerró además **E0-09/Q1**, abierta desde el 28-jul. Sus dos reglas
literales, que este motor implementa sin reinterpretar:

> «Una observación corregida **SÍ** entra al cálculo si es la versión clínica
> vigente. Pero **NO** modificar ni borrar la observación original.»

> «El motor utiliza la **latest clinically valid observation** dentro de la
> ventana temporal aplicable. **Nunca** *latest database row* sin validar estado.»

Y la distinción que el médico marcó como **esencial**:

| | CORRECCIÓN | OBSERVACIÓN NUEVA |
|---|---|---|
| 08:00 | SpO₂ 82 % | SpO₂ 82 % |
| Después | 08:03 «me equivoqué, era 92» | 08:10 SpO₂ 92 % **tras intervención** |
| Qué es | Un hecho, mal capturado | **Dos hechos válidos** |
| Score | El **retrospectivo de las 08:00 usa 92** | 08:00 → 82 · 08:10 → 92 |

## Referencia

- **Decisión ICU-Q3** (arriba). Es la fuente normativa: este motor no añade
  criterio clínico propio.
- **HL7 FHIR R4 · Observation** — la separación `effectiveDateTime` (cuándo
  ocurrió el hecho) / `issued` (cuándo se registró) y los valores de
  `Observation.status` (`preliminary`, `final`, `amended`, `corrected`,
  `entered-in-error`). Se adopta esa semántica para alinear con el export FHIR
  que ya existe en el repo, **no** como fuente de decisión clínica.

⚠️ **No** se copió ningún umbral, ventana ni criterio clínico de una respuesta de
IA. Los 6 estados y la regla de selección salen de la decisión del médico; la
nomenclatura temporal, del estándar.

## Golden

`src/__tests__/observacion-version.test.ts` — **35 casos**.

Los dos primeros bloques son **el criterio de aceptación**: transcriben
literalmente los dos ejemplos que escribió el médico. Si uno se pone rojo, el
motor dejó de cumplir la decisión.

| Bloque | Qué congela |
|---|---|
| Ejemplo A · corrección | La corrección **hereda la hora efectiva** (08:00, no 08:03) y el score retrospectivo de las 08:00 **usa 92** |
| Ejemplo B · observación nueva | 08:00→82 · 08:10→92 · **08:05→82** (el valor disponible en ese momento) |
| Contraste A vs B | El **mismo par** de valores da 1 punto y 92 como corrección, y 2 puntos y 82 como observaciones nuevas |
| latest valid ≠ latest row | Una fila más reciente en estado no calculable **no gana** |
| Clasificación total | **Todo** estado está en `ESTADOS_CALCULABLES` o `ESTADOS_NO_CALCULABLES`, y los dos son disjuntos |
| Ventana temporal | Omitirla **lanza**; `null` explícito calcula; fuera de ventana descarta **con motivo** |
| Robustez | Futuro · serie vacía · instante inválido · fecha inválida · cadena de 3 · ciclo A↔B · corrección huérfana |
| Audit trail | `construirCorreccion` **exige motivo** y **no muta** el original |

## Unidades y firma

```ts
vigenteEn(
  observaciones: readonly ObservacionVersionada<T>[],
  instanteIso: string,
  ventanaMs: number | null,        // OBLIGATORIO. Omitirlo lanza.
): { vigente: ObservacionVersionada<T> | null; descartadas: Descartada<T>[] }
```

No calcula magnitudes: **selecciona versiones**. No hay redondeo. El instante
siempre entra por parámetro — el motor **no lee el reloj**, para que un cálculo
sea reproducible.

## Dato faltante

- **Ventana sin declarar → LANZA** `FALTA_VENTANA_TEMPORAL`. La decisión prohíbe
  mezclar variables de horas distintas «sin política explícita», así que no se
  asume un default.
- **Fecha inválida o del futuro → se descarta CON motivo.** Nunca en silencio:
  `descartadas[]` dice por qué salió cada una.
- **Serie vacía → `null`**, no un valor inventado.

## Por qué existe

La política anterior era un booleano disfrazado
(`'incluye_corregidos' | 'excluye_corregidos'`), y un booleano no puede expresar
«la versión clínicamente vigente».

Y había un defecto más grave: **la corrección no conservaba la hora del hecho**.
Una corrección hecha a las 08:03 se guardaba a las 08:03, así que un score
recalculado para las 08:00 **no la encontraba** — y descartar el valor erróneo
dejaba **un hueco en vez de una corrección**. Sin la hora efectiva, el Ejemplo A
de la decisión no es computable.

## Pendiente de validación clínica

**La ventana temporal por tipo de observación.** Cuánto tiempo sigue siendo
«vigente» una SpO₂, una TA o un lactato para entrar a un score. Hoy el parámetro
es obligatorio y sin default a propósito: el motor está listo, el número lo pone
el médico.

Mientras no exista, cada llamador debe pasar `null` (sin límite) **de forma
explícita** y quedar declarado como decisión pendiente en su propio sitio.
