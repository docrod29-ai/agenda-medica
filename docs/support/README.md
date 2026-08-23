# Soporte automatizado, detección de incidentes y auto-reparación segura

**Carril:** [#315](https://github.com/docrod29-ai/agenda-medica/issues/315) ·
**Estándar:** #320 · **Golden paths:** #321 (agenda) y #322 (encuentro).

El objetivo no es «no fallar nunca». Es **fallar de forma predecible**: conservar
el trabajo del médico, proteger el expediente, recuperarse solo **sólo cuando es
seguro**, encontrar la causa rápido, y que el mismo defecto no vuelva.

---

## Estado: PREPARED_ONLY, con una conexión real

El núcleo (`src/lib/incidents/`) **decide**. Hoy casi nadie **ejecuta**, y eso
está declarado en dos trinquetes del repositorio, no escondido:

| | |
|---|---|
| **Conectado de verdad** | `src/lib/ia/incidentes-servidor.ts` firma cada incidente de IA con el núcleo y guarda `firma`, `familia`, `categoria`, `severidad`, `runbookId` y `appVersion` en el MISMO documento de `platform_incidentes`. La clave del documento **no cambió**. Y si el núcleo fallara al firmar, el incidente se anota igual. |
| **También conectado** | El contador de salud de la telemetría: cuando el vigilante lleva cinco escrituras seguidas sin poder anotar, se declara **ciego** — el único incidente que él mismo no puede reportar. |
| **Preparado, sin ejecutar** | El motor de umbrales, la máquina de remediación, el contrato del médico, la consola de soporte, el puente de regresión y el arnés de simulacros. Los puntos de inserción exactos están en [`HANDOFF-306-INCIDENTES.md`](HANDOFF-306-INCIDENTES.md). |

Nadie ejecuta hoy una acción de auto-reparación. La política existe, está
probada, y no hay ninguna ruta que la llame: **ese cableado es una decisión de
producto y va como handoff, no como una conexión a medias.**

---

## Cómo se lee esto

| Documento | Qué contesta |
|---|---|
| [`TAXONOMIA-DE-INCIDENTES.md`](TAXONOMIA-DE-INCIDENTES.md) | Qué es un evento, qué es un incidente, y por qué la identidad es vocabulario cerrado. |
| [`RUNBOOKS.md`](RUNBOOKS.md) | Qué se hace con cada clase. **Generado desde el código.** |
| [`SIMULACRO-INCIDENTES.md`](SIMULACRO-INCIDENTES.md) | Los trece simulacros y sus tiempos. **Generado.** |
| [`RIESGOS-315.json`](RIESGOS-315.json) | Los nueve riesgos reales encontrados, con archivo y símbolo. |
| [`HANDOFF-306-INCIDENTES.md`](HANDOFF-306-INCIDENTES.md) | Dónde se enchufa esto en el producto. |
| [`DEPENDENCIAS-342-345-341.md`](DEPENDENCIAS-342-345-341.md) | Qué necesita de los otros carriles y qué NO se duplicó. |
| [`consola-soporte-fixture.json`](consola-soporte-fixture.json) | Un incidente real proyectado para soporte. **Generado y auditado sin PHI.** |

## Cómo se corre

```bash
npx tsx scripts/incidents/simulacro-de-incidentes.mjs   # trece simulacros → JSON + Markdown
npx tsx scripts/incidents/generar-contratos.mjs         # runbooks + fixture de la consola
npx vitest run src/__tests__/incidentes                 # los guardianes
```

Ninguno de los dos scripts llama a un proveedor, escribe en una base ni gasta un
peso. El reloj del simulacro es una **constante**: sin eso, el informe de hoy no
se podría comparar con el de ayer, y un informe que no se compara no detecta que
el motor empeoró.

## Lo que este carril NO hizo, a propósito

- **No desplegó nada** ni tocó producción.
- **No contrató** ningún proveedor de monitoreo.
- **No fijó SLOs.** `tasaError` y `latenciaP95Ms` siguen en `null` y se declaran
  como «no evaluado». Inventar aquí un umbral «razonable» sería la cifra
  plausible que la regla 1 de seguridad clínica prohíbe.
- **No tocó `firestore.rules` ni la matriz de acceso**, aunque encontró un hueco
  real en las dos (R-05). Es política de seguridad y su despliegue exige
  autorización del dueño.
- **No tocó la interfaz de #306**, ni Voice, ni Reasoning, ni Evidence, ni los
  módulos de #342 o #345.
- **No cubre Hospital ni UCI.**
