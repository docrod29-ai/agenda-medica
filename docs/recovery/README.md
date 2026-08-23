# Recuperación — qué corre, qué está preparado, y qué no está probado

> **Un respaldo no es un respaldo hasta que se ha demostrado la restauración.**
>
> Y una restauración no salió bien hasta que los conteos cuadran, el aislamiento
> entre consultorios se sostiene, la verdad firmada sigue intacta, el linaje
> sobrevive, no se perdió nada en silencio, y la evidencia dice exactamente qué
> se midió y qué no.

Carril #312, con evidencia de #325. Consultorio primero; Hospital/UCI queda
fuera.

---

## Los cuatro anclajes que ya existían

Este carril **no crea otro formato de respaldo ni otro restaurador**. Construye
alrededor de lo que ya estaba:

| archivo | qué aporta |
|---|---|
| `src/lib/clinica/respaldo.ts` | el manifiesto: qué colecciones viajan, el árbol de subcolecciones, y qué se excluye a propósito. |
| `src/lib/clinica/restaurar.ts` | el camino de vuelta: parseo NDJSON, rechazo de líneas que no se entienden, derivación de la colección desde la ruta real, re-enraizado. |
| `src/lib/clinica/simulacro.ts` | la ida y vuelta con las MISMAS funciones que la importación, y la honestidad de decir que no es el RTO. |
| `src/lib/ops/retencion.ts` | el barrido de datos operativos, y la regla de que **nada clínico** se barre. |

---

## Lo que corre de verdad

```bash
npm run simulacro:recuperacion                  # 24 escenarios, ~1 000 documentos
npm run simulacro:recuperacion -- --pacientes=750   # >10 000 documentos
npm run simulacro:recuperacion -- --solo=nota-firmada-alterada
npx vitest run src/__tests__/durabilidad-respaldo-y-restauracion.test.ts
```

- **En producción**, dentro de las rutas: `manifiesto`, `huellas`,
  `aislamiento`, `verdad-firmada`, `idempotencia`, `veredicto`,
  `reconciliacion`, `integridad-referencial`, `ensayo`. Los importan
  `api/clinic/exportar` y `api/clinic/importar`.
- **En el CI y en el arnés**, a propósito: `fixtures`, `inventario`,
  `crecimiento`, `rpo-rto`, `adjuntos`, `archivado`, `rollback`,
  `autosave-contrato`. Están declarados por nombre en
  `el-camino-del-medico-llega-entero`, con su razón.

---

## Lo que está PREPARADO y no cableado

| qué | por qué no se cableó |
|---|---|
| reanudación por punto de control en la restauración | exige una colección nueva bajo `clinics/{id}`, y toda colección nueva se declara en tres sitios y necesita **publicar reglas**, que es del dueño. Mientras tanto la idempotencia se sostiene en la comparación de contenido, que no necesita estado. |
| reversión de una restauración | mismo motivo: los asientos hay que guardarlos en algún sitio. |
| ciclo de vida del expediente (`archivado.ts`) | **no hay plazo mínimo decidido**. `DIAS_MINIMOS_DE_CONSERVACION` vale `null` y ningún expediente llega a `ELEGIBLE_PARA_BORRADO` hasta que el dueño y su abogado lo fijen. |
| punto seguro visible en la consulta | la pantalla es de #306. Traspaso exacto en [`HANDOFF-306-AUTOGUARDADO.md`](HANDOFF-306-AUTOGUARDADO.md). |
| cruce de objetos de Storage contra el bucket | necesita un listado del bucket, que sólo tiene un script con credenciales. El motor está probado con listados sintéticos. |

---

## Lo que NO está probado

Se dice aquí y en cada acta, porque un hueco que sólo aparece en una nota al pie
deja de aparecer:

1. **El restore de Firestore.** `gcloud firestore databases restore` es de
   Google. Nunca se ha cronometrado. Es, con diferencia, el tramo más largo.
2. **La escritura real contra un proyecto.** El arnés no importa el SDK: no
   puede escribir en ninguna parte.
3. **La detección.** No hay nada que vigile la pérdida de datos clínicos. El RTO
   empieza a contar cuando el médico llama.
4. **La conmutación** de la aplicación a una base restaurada.
5. **Los bytes de los objetos.** Se cruzan nombres, tamaños y huellas; no se
   descarga ni un archivo.
6. **Capacidad.** Los 10 000 documentos comprueban que la conciliación no se
   rompe con el tamaño, **no** que el sistema aguante. Eso es #342.

---

## RPO y RTO

No hay un número de RTO, y eso es una respuesta, no una omisión. La tabla vive
en `src/lib/durability/rpo-rto.ts` con cinco procedencias posibles —`TARGET`,
`OBSERVED_LOCAL`, `OBSERVED_CI`, `OBSERVED_STAGING`, `NOT_MEASURED`— y el alcance
pegado a cada cifra.

Hoy sólo dos tramos salen medidos: leer el archivo y re-enraizarlo, y conciliar.
Los otros cuatro están en `NOT_MEASURED`. `rtoPublicable()` devuelve `false` y
seguirá devolviéndolo mientras quede uno sin medir.

> Publicar la suma de los tramos que sabemos medir, llamándola RTO, daría una
> cifra optimista por un factor desconocido. Y una cifra publicada no se vuelve
> a comprobar.

---

## Índice

- [`PLAN-SIMULACRO.md`](PLAN-SIMULACRO.md) — cómo se corre el ensayo y qué
  significa cada escenario.
- [`REGISTRO-DE-RIESGOS.md`](REGISTRO-DE-RIESGOS.md) — 14 riesgos encontrados en
  archivos y símbolos reales, con severidad, qué protege hoy y quién puede
  arreglarlo.
- [`DECISIONES-DEL-DUENO.md`](DECISIONES-DEL-DUENO.md) — lo que este carril **no
  puede** decidir.
- [`HANDOFF-306-AUTOGUARDADO.md`](HANDOFF-306-AUTOGUARDADO.md) — el punto seguro
  de la consulta.
- [`evidencia/`](evidencia/) — actas de simulacro. **No se sobrescriben**: una
  evidencia que se pisa deja de ser evidencia y pasa a ser el último intento.
- [`../SIMULACRO_RESTAURACION.md`](../SIMULACRO_RESTAURACION.md) — el ensayo con
  consola, que sigue siendo la mitad que no se puede automatizar.

---

## Fronteras con otros carriles

| carril | frontera |
|---|---|
| **#311 · Migración** | Esa rama no se toca. Aquí sólo vive la reversión de un trabajo de **restauración**, no la de una migración de esquema. Los invariantes se escriben igual a propósito: no cruzar consultorios, no tocar verdad firmada, no promover un antecedente a prescripción. |
| **#326 · Invariantes de migración** | El fixture incluye los seis estados de intención de medicamento (`reported`, `continue`, `start`, `change`, `stop`, `unknown`) y linaje de borrador + firmada, que es lo que #326 exige de un fixture. Se puede reutilizar. |
| **#325 · Evidencia de lanzamiento** | Las actas de `evidencia/` son el artefacto que #325 pide: SHA exacto, marcas de tiempo, conteos antes y después, corrupciones detectadas, alcance de RPO/RTO, veredicto y lo que queda sin resolver. |
| **#342 · Escala** | No se copia ninguna primitiva suya. Los 10 000 documentos son una prueba de que la conciliación no se degrada, no una afirmación de capacidad. |
| **#306 · Consultorio** | No se toca ni un archivo suyo. El traspaso está escrito. |
| **#320 · Endurecimiento** | Dos hallazgos P0 de este carril caen en su Gate 1 y su Gate 2, y están en el registro de riesgos como `safeToFixHere: no`. |
