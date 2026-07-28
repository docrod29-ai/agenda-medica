# Nexus OS — dónde vamos

**Avance: 0 / 68 unidades.** Programa recién creado, ninguna corrida ejecutada aún.

## Siguiente unidad

`E0-01` — Receta/QR 100% derivada de datos autoritativos del servidor.

La etapa **E0 (Hardening)** va primero por decisión del charter: dar más poder a la IA
sobre una infraestructura que puede confundir 135 con 135 000 es lo peligroso. Son 15
unidades y varias ya tienen trabajo previo hecho (ver `docs/audit/regression-ledger.md`,
REG-001…REG-040) — la primera corrida debe reconocer eso y no rehacerlo.

## Esperando decisión del médico

Nada todavía. En cuanto una unidad tope con un criterio clínico que no está en el repo,
aparecerá aquí con la pregunta concreta, y **no se implementará adivinando**.

## Cómo se retoma

Relanzar el workflow `nexus-os`. Lee `estado.json`, comprueba en disco qué unidades ya
tienen `RESULTADO.json` y continúa en la siguiente pendiente. Es idempotente: relanzarlo
nunca repite trabajo ni pierde avance.
