# Nexus OS — dónde vamos

**Avance: 1 / 68 unidades.** Etapa E0 (Hardening): 1 / 15.
Última corrida: `2026-07-28T20:13:41Z` — `E0-01` **completada**.

## Lo que quedó cerrado

`E0-01` — Receta/QR 100% derivada de datos autoritativos del servidor.

`/api/receta/verificacion-url` ya no le cree al body. Del cliente solo acepta
**localizadores** (`clinicId`, `patientId`, `notaId`); el folio, el nombre y la cédula que
el certificado *afirma* los deriva el servidor de la **nota firmada** leída con el Admin
SDK. Un `notaId` inexistente devuelve 404 y una nota sin firmar 409, así que ya no se
puede acuñar un "Integridad verificada" de un documento que nunca existió.

Efecto colateral bueno: en consultorios con varios médicos el QR deja de decir la
identidad de *quien imprime* y dice la de *quien firmó*.

**REG-025 pasa de `CLOSED (parcial)` a `CLOSED`** en `docs/audit/regression-ledger.md`.

Gates reales: `tsc` PASS · `vitest` PASS (1911 tests, 171 archivos) · `build` PASS.
Los 11 casos nuevos de ruta se verificaron en rojo contra el código anterior — no son
tests que pasarían igual sin el cambio. Detalle en `unidades/E0-01/RESULTADO.json`.

**Nada desplegado. Sin `git push`.**

## Siguiente unidad

`E0-02` — Invariantes property-based de dosis pediátrica y aminoglucósidos
(riesgo bajo, sin dependencias). Extiende REG-013/REG-018 a todo el catálogo:
`porToma ≤ porDía ≤ tope`, unidad obligatoria.

## Esperando decisión del médico

1. **D1 — ¿el pie IMPRESO de la receta debe leerse de `nota.firma` en vez de `config/main`?**
   Hoy el papel imprime el nombre y la cédula de la *clínica*. Tras E0-01 el QR imprime los
   del médico que firmó la nota. Con un solo médico no cambia nada; con dos o más, papel y
   QR pueden discrepar. Antes el QR mentía; ahora dice la verdad y el papel es el que puede
   quedarse atrás. Corregir el impreso toca el camino de impresión/PDF, que la carta
   operativa manda **no** arriesgar a ciegas: sería una unidad aparte con verificación
   visual del PDF real. **No bloquea el programa.**

2. **Al desplegar: subir la versión del Service Worker.** Un cliente viejo cacheado manda el
   body antiguo (sin `patientId`), recibe 400 y el QR degrada a `Folio:<folio>` en texto
   plano hasta que el navegador tome el bundle nuevo. No rompe la impresión.

Ningún umbral, dosis ni regla clínica hizo falta para esta unidad: era autorización y
procedencia de datos, no criterio médico.

## Cómo se retoma

Relanzar el workflow `nexus-os`. Lee `estado.json`, comprueba en disco qué unidades ya
tienen `RESULTADO.json` y continúa en la siguiente pendiente. Es idempotente: relanzarlo
nunca repite trabajo ni pierde avance.
