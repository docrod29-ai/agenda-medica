# Bitácora del trabajo autónomo

## 2026-08-04 — INFRA-001 · el sistema operativo del programa

- `CLAUDE.md` reescrito: misión, invariantes, comandos, mapa, seguridad clínica,
  condición de terminado, prohibiciones y decisiones ya tomadas por el dueño.
- `.claude/rules/` — seis reglas por dominio.
- `.claude/agents/` — ocho especialistas con herramientas limitadas y contrato de
  salida; el equipo rojo es independiente y su trabajo es **refutar**.
- `agent-state/` — estado, métricas, bloqueadores, supuestos, decisiones y riesgos.

**Lo que de verdad importa de esta iteración**: se corrió por primera vez el
corpus V3 de **6 000 frases** contra el pipeline. El dueño tenía razón en
reclamar — el corpus llevaba en disco desde hace días y nadie lo había medido.

Resultado: **96.02 % intactas, cero términos clave perdidos**, y un defecto real
encontrado por la medición (R-02).

## 2026-08-04 — VOICE-004 · el balance negativo pedía confirmación

Encontrado **midiendo**: 25 de 6 000 frases, todas la misma. `ES_CANTIDAD` no
aceptaba signo delante de la cifra. Re-medido tras el arreglo: **25 → 0**, con
las intactas y los términos clave sin moverse.

## 2026-08-04 — SAFE-002 · la defensa miraba sólo el resumen

Visto en producción, en la alerta del propio Dr.: «…Diabetes mellitus tipo 2.
[object Object]…». `diagnosticos` y `secciones` son arreglos de objetos, así que
el texto contrastado era basura y **el cuerpo de la nota era invisible** para la
comprobación de negación y de temporalidad.

Y la prueba que debía protegerlo **certificaba el defecto**: exigía la línea
literal rota. Fijar la forma de una expresión no prueba su comportamiento.

## 2026-08-04 — OPS-001 · la caída de IA sigue al dueño

Franja en el armazón de la app, sólo para el dueño, con el titular y qué hacer.

**Nota honesta**: la premisa inicial era que `avisoAlDueno` no lo llamaba nadie.
Era falsa —lo busqué con el nombre mal escrito— y se verificó **antes** de
construir nada encima. Lo que faltaba no era el registro: era que llegara a él.

## 2026-08-04 — SAFE-001 · un solo parser de alergias, y conectado

Cuatro parsers del mismo campo. `alergenosDe` había salido a producción en la
v1031 **sin un solo llamador** — error del propio agente, cazado revisando el
estado. El trinquete de lint bajó a 97 y se apretó.

## 2026-08-04 — EVAL-003 · el trinquete de voz, en CI

Las 6 000 frases del Dr. corriendo en cada push. La regresión de texto **no
necesita el audio**: 1.2 MB de frases contra 429 MB de mp3.

Mide que el pipeline no dañe lo correcto (criterio CERO en términos clave) y que
el término clínico sobreviva al pasar de hablado a escrito. Probado al revés.

**Hallazgo sobre el corpus, para el Dr.**: algunas filas traen la forma hablada
corrompida por el generador — «dosis guiada» quedó como «dosis gramosuiada»
(alguien expandió «g» → «gramos» dentro de la palabra). Son del corpus, no del
pipeline, y bajan su propia medición.

## 2026-08-09 — La especificación de V9 pasa a ser la fuente de verdad

El dueño entregó el Master Loop V9 completo (907 líneas) y pidió que se guardara
íntegro, sin resumir, como especificación autoritativa.

- `docs/ai/NEXUSMED_PATIENT_EXPERIENCE_AND_DESIGN_MASTER_LOOP_V9.md` es ahora
  **exactamente** ese archivo (md5 `f4a6d421c2944ccc565a670037940419`, verificado
  con `diff` contra el original).
- Lo que antes vivía dentro de él —la lectura operativa y la bitácora de unidades
  cerradas con su SHA— se movió a `docs/ai/V9-BITACORA-Y-OPERACION.md`, **sin
  perder nada**, para que la especificación no se mezcle con su interpretación.
- `CLAUDE.md`, `MASTER_STATE.json` y `CURRENT_ITERATION.md` obligan a leerla
  completa antes de elegir trabajo.
- Nace `agent-state/V9_COMPLETE_CRITERIA.md`: cuándo puede existir
  `V9_COMPLETE.md`. **No existe todavía** y `v9-completo-no-se-declara-antes-de-
  tiempo.test.ts` falla si aparece con unidades pendientes, con P0/P1 abiertos o
  con una compuerta sin ejecutar.

La razón de la compuerta, escrita antes de que hiciera falta: un programa
autónomo sin condición de terminado no termina, **se le ocurren tareas**. Y un
criterio escrito al final se escribe para que dé aprobado.


---

## 9-ago-2026 — `POSTVISIT-001`: el paquete llega al paciente

**REG-306.** La hoja del paciente se componía del **borrador en curso**. Su
única guarda era `!esNotaHospital`, y sus dos botones —copiar e imprimir— la
entregaban tal cual. La cabecera del módulo afirmaba que el contenido sale de lo
«ya revisado y firmado»: era intención de diseño, no precondición. Veintitantas
líneas más arriba, `ComoCerrarLaConsulta` **sí** exigía `firmada`.

Familia nueva, la decimosexta: **`invariante_solo_en_prosa`** — la regla está
escrita, es correcta, y no hay nada que la haga cumplirse. No es
`no_conectado` (el módulo sí corre) ni `se_contradice` (no hay dos
implementaciones que reconciliar): la reparación es **añadir el comprobador**, y
añadirlo dentro del motor para que viaje con él hasta el segundo llamador.

**REG-307.** Y aunque se firmara, la hoja **no llegaba a ninguna parte**. El
portal del paciente ya existía con su pestaña vacía y su compuerta puesta
(REG-304); entre las dos mitades no había nada. Faltaba el **acto de liberar**.

Ahora: `POST /api/paciente/paquete` bajo `clinico.escribir`, con
`previsualizar` y `liberar`. El cliente manda **cuatro identificadores**; todo
el contenido lo lee el servidor de la nota firmada, del expediente y de la
configuración. Un cuerpo con `estado` o `approvedBy` se **rechaza** en vez de
ignorarse. Cada liberación **crea** su documento con un id que lleva la versión
dentro, así que corregir es liberar una versión nueva y dos pestañas a la vez no
pueden pisarse.

**Un cuarto tipo de cambio de medicación.** `CambioDeMedicacion` tenía tres, y
con tres hay que mentir: el cotejo es por nombre, así que bajar la metformina de
850 a 425 mg salía como **«sin cambio»**. Se añadió `modificado`, y la
comparación pasó a ser sobre la **pauta** y no sobre la línea entera —que lleva
el nombre dentro y hacía que «Losartan» y «Losartán» salieran como un cambio de
tratamiento.

**Compuertas**: vitest 8 615/8 616 (1 fallo de entorno preexistente,
`ops-timeout`), trinquete de lint 96 = techo, trinquete de diseño sin deuda
nueva, `tsc` limpio, `npm run build` completo. **Navegador: no ejecutado.**
