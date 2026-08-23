# `docs/reliability/` — carril #310

Escala, resiliencia y arquitectura sin pantalla blanca. Tablero #296, estándar #320.

| Documento | Qué contiene |
|---|---|
| [`HOT-PATH-INVENTORY.md`](HOT-PATH-INVENTORY.md) | el camino caliente medido leyendo el repositorio: 2 P0, 7 P1, con archivo y línea |
| [`SLO-SLI-CONTRACT.md`](SLO-SLI-CONTRACT.md) | indicadores con `TARGET` y `OBSERVED` separados. Toda la columna `OBSERVED` está vacía, y eso es información |
| [`BACKPRESSURE-QUEUES-CONTRACT.md`](BACKPRESSURE-QUEUES-CONTRACT.md) | la frontera camino caliente / trabajo asíncrono, y qué lleva todo trabajo encolado |
| [`FAILURE-INJECTION-MATRIX.md`](FAILURE-INJECTION-MATRIX.md) | 17 fallos × qué se conserva / reintenta / degrada / bloquea |
| [`NO-WHITE-SCREEN-INVENTORY.md`](NO-WHITE-SCREEN-INVENTORY.md) | dónde puede quedarse la pantalla en blanco y dónde va el freno |
| [`CAPACITY-REPORT.md`](CAPACITY-REPORT.md) · [`capacity-report.json`](capacity-report.json) | **generados**: qué está probado, qué preparado y qué necesita dinero |
| [`HANDOFF-306.md`](HANDOFF-306.md) | lo que hay que cablear, para quién, con el contrato ya escrito |

## Lo ejecutable

```bash
# un escenario, con su evidencia en el formato de #310 (PR #340)
node scripts/load/run-consultorio-load.mjs --cohorte=multi-tenant-2k --fallo=ia-caida \
  --sha=$(git rev-parse HEAD) --salida=resultado.json

# la matriz de CI entera
node scripts/load/run-consultorio-load.mjs --matriz --sha=$(git rev-parse HEAD)

# regenerar el informe de capacidad
node scripts/load/generar-informe-de-capacidad.mjs --sha=$(git rev-parse HEAD)

# los golden del carril
npx vitest run src/__tests__/reliability-*.test.ts src/__tests__/observability-*.test.ts \
  src/__tests__/arnes-carga-*.test.ts
```

## La frase que ordena todo este directorio

**No existe evidencia de que Ausculta soporte 2 000 ni 10 000 médicos.** Lo que existe es un
arnés determinista, un contrato de invariantes ejecutable y un inventario con dos P0
abiertos. El controlador simulado del arnés mide el MODELO; su propia salida lo declara en
`evidenceClass: "harness-only"` y en `capacityClaim: "none"`, dentro del mismo objeto que
las cifras, para que no se puedan citar por separado.
