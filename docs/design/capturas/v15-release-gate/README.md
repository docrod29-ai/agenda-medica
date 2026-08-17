# Evidencia cruda de `V15-RELEASE-GATE-001`

Actas de la Iteración 19, medidas sobre el árbol candidato que arranca en
`7e593451900b7fe5a2e574df8df951c79be31bfe`.

**Por qué viven aquí y no en las carpetas de sus instrumentos.** Las
Iteraciones 16, 17 y 18 están **cerradas por lectura independiente** y su
evidencia es inmutable. Re-correr sus bancos sirve para saber si algo regresó,
no para reescribir el acta de una iteración que ya cerró. Así que las carpetas
originales se restauraron con `git checkout` después de leer el resultado, y lo
que midió esta corrida vive aquí.

| archivo | qué es | resultado |
|---|---|---|
| `acta-flujos-release-gate.json` | banco de los diez flujos clínicos, 10 × 2 anchos | **20/20 completado · 0 pérdidas de contexto · 0 callejones · 10 errores de consola** (los dos grupos ambientales de siempre: 503 del proveedor de transcripción en WF-04, 500 de `PORTAL_PACIENTE_SECRET` en WF-05). Paridad exacta con la Iteración 17 |
| `acta-coherencia-release-gate.json` | matriz de coherencia de producto, 12 superficies × 2 anchos | **24 filas idénticas** a las de la Iteración 18 en `<h1>`, identidad, primarias y consola. Sin regresión |
| `acta-axe-familia-documental.json` | axe sobre nota/receta/orden/referencia — **las superficies críticas que el instrumento de la Iteración 18 nunca visitó** | nota, referencia y todo el móvil **limpios**; `color-contrast(1)` en receta y orden a 1440 |
| `acta-contraste-familia-documental.json` | el nodo exacto de ese contraste, con selector, texto y colores | rótulo «Receta Médica»/«Orden Médica», 11px/700, `#14b8a6` sobre blanco, **2.48:1** frente a 4.5:1 exigido. No es un control y vive **dentro del papel** (`.receta-sheet`) |

## Lo que la evidencia de axe NO cubre, declarado

`axe-encuentro-v15.mjs` (el instrumento de la Iteración 18) sigue midiendo sus
seis superficies y su acta sigue donde estaba, intacta: esta corrida la
reprodujo **idéntica** (`target-size(3)` en `/pacientes` de escritorio, el
resto limpio) y la restauró.

Lo que se añade aquí es la familia documental, que **nunca se había medido**.
No sustituye a la línea base de V10 (`tests/accessibility/axe-baseline-v10.json`),
que corre con otra siembra y otro subconjunto.

El razonamiento completo, con la clasificación de cada hallazgo, está en
[`docs/design/v15/V15-RELEASE-GATE.md`](../../v15/V15-RELEASE-GATE.md).
