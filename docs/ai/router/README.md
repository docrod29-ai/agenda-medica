# Router de costo/calidad de IA — #313

Control plane que elige el **modelo mínimo suficiente** para cada tarea, sin
enseñarle un selector de modelos al médico.

Vive **por encima** del gateway. No lo sustituye, no lo duplica y no lo toca.

```
TAREA (clase · riesgo · latencia · piso de calidad)
  → catálogo de capacidades      catalogo.ts
  → compuerta de calidad         calidad.ts     ← evaluacion.ts + casos-oro.ts
  → salud del proveedor          disponibilidad.ts ← fallo-proveedor.ts
  → política de presupuesto      presupuesto.ts
  → DECISIÓN                     decidir.ts     (pura y determinista)
  → gateway.llamarIA()           ← YA EXISTE. No se modificó.
  → asiento en el libro          ← YA EXISTE. No se modificó.
  → telemetría sin PHI           telemetria.ts
  → economía unitaria            economia.ts    ← cost-ledger.ts
```

## Lo que se reutilizó, y lo que por tanto NO se construyó

| Ya existía | Qué aporta | Qué NO se construyó |
|---|---|---|
| `src/lib/ia/gateway.ts` | fetch, timeout, cascada, asiento de costo, reserva de créditos | segundo gateway |
| `src/lib/ia/protocolo.ts` | `Proveedor`, `ClaseFallo`, `Resultado`, cuándo pasar de modelo | segunda semántica de proveedor |
| `src/lib/ia/fallo-proveedor.ts` | clasificación de fallo (saldo disfrazado de 400/429), `seArreglaReintentando` | segunda taxonomía de fallo |
| `src/lib/ia/evaluacion.ts` | `ResumenEvaluacion`: exactitud, tasa de error, alucinaciones | segundo benchmark |
| `src/lib/ia/casos-oro.ts` | corpus y el criterio **cero alucinaciones** | segundo corpus |
| `src/lib/finanzas/precios-modelo.ts` | tarifas con `fuente` y `consultado`, promociones con caducidad | segunda tabla de precios |
| `src/lib/finanzas/cost-ledger.ts` | `resumir`, `porClave`, `soloCogs`, `costoPorConsulta`, `CADENA_CONSULTA` | segundo libro de costos |
| `src/lib/finanzas/cartera-server.ts` | reserva/confirmación de créditos por operación | segundo contador de créditos |

**Ningún archivo núcleo fue modificado.** Los `HANDOFF` de abajo dicen qué
haría falta y a quién le toca.

## Las tres invariantes

1. **Un presupuesto bajo NUNCA baja el piso de calidad.**
   `presupuesto.elPresupuestoPuedeBajarElPiso()` devuelve `false` y siempre lo
   hará; existe como función con nombre para que quien quiera lo contrario
   encuentre el sitio donde se dijo que no, y la prueba que lo comprueba.
   Cuando no queda candidato: fallo explícito, nunca el más barato de los
   insuficientes.

2. **Sin evidencia no hay promoción.** Sin benchmark, con benchmark de otra
   versión, caducado o fallido, un modelo no se promueve. `EVIDENCIA_CARGADA`
   está **vacía a propósito**: no se ha medido nada, y una tabla plausible
   acabaría decidiendo a qué modelo se le baja la nota que el médico firma.

3. **Al médico no se le enseñan modelos.** Lo único que sale hacia la interfaz
   es `estadoParaElMedico()`, que devuelve `disponible` o `capacidad_limitada`.
   Los motivos que nombran proveedores van al tablero del dueño.

## El estado de hoy, medido

`npx tsx scripts/ai/router-sombra.ts` (sin llamadas a proveedores):

| | actual | con evidencia sintética de ejemplo |
|---|---|---|
| tareas simuladas | 100 | 100 |
| **sin candidato** | **100 %** (`QUALITY_NOT_PROVEN`) | 0 % |
| violaciones del piso | 0 | 0 |
| costo estimado | — | $3.85 USD / 25 consultas |
| 2ª revisión pedida sin candidato independiente | 0 | 5 |

El 100 % de fallo cerrado **es el resultado correcto**: nadie ha medido nada
todavía. Conectar el router hoy no daría mejores decisiones — apagaría la IA.
Primero se mide, después se enchufa.

## Qué falta para poder enchufarlo

1. **Umbrales de calidad** (`NEEDS_CLINICAL_REVIEW` en `tareas.ts`): exactitud
   mínima, tamaño mínimo de muestra y caducidad. Decide el dueño con la capa
   clínica. No se pueden deducir de cuatro casos sintéticos.
2. **Corpus de evaluación real** por clase de tarea. Hoy `casos-oro.ts` tiene
   cuatro casos y dice de sí mismo que no es una medición de producción.
3. **Límites de contexto y salida** por modelo, con fuente. Están en `null`:
   por eso una tarea que pide contexto largo se queda sin candidato y lo dice.
4. **Su consumidor**: el flujo de consulta (#306), hoy PREPARED_ONLY.

## Cómo correr el informe

```bash
npx tsx scripts/ai/router-sombra.ts              # fecha de hoy
npx tsx scripts/ai/router-sombra.ts 2026-08-23   # fecha fija (determinista)
CONSULTAS=100 npx tsx scripts/ai/router-sombra.ts
```

Escribe `informe-sombra.json` y `informe-sombra.md` en esta carpeta. Sale con
código 1 si alguna configuración viola el piso de calidad.

## Pruebas

- `src/__tests__/ia-router-decision.test.ts` — la matriz de 14 casos del
  contrato, con seis pruebas «al revés».
- `src/__tests__/ia-router-economia-y-sombra.test.ts` — economía unitaria,
  modo sombra y la invariante de §K.
