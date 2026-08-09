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

## 2026-08-09 — REG-306 · `componerPaquete` llega con su llamador (POSTVISIT-001)

Cierra la deuda que dejó `PATIENT-COMPANION-001`: `componerPaquete` y
`cambiosDeMedicacion` estaban escritas, probadas al revés y **sin llamador** —
a propósito, para no sumar otra a «escrito, probado y sin conectar» (32 de 127
regresiones, la familia más grande del proyecto).

- `POST /api/expediente/paquete-visita` (acción `liberar`, capacidad
  `clinico.escribir`) es el llamador: exige `nota.estado === 'firmada'`
  (compuerta de firma, POSTVISIT-GATE-001), recompone del lado del servidor
  —nunca acepta el paquete armado desde el cliente— y escribe `RELEASED`
  directo en `paquetes_visita`.
- El botón «Liberar al paciente» (`LiberarPaqueteAlPaciente.tsx`), junto a
  `HojaParaElPaciente` en la consulta, es el camino desde `app/` que el
  guardián de conexión exige. Llega en el mismo commit que la función — no en
  una sesión aparte.
- Hallazgo al escribir la ruta: «lo vigente» no es «lo que dice esta nota» — un
  crónico que hoy no se tocó sigue vigente (`medicamentosVigentes`, REG-183).
  `componerPaquete` recibe ambas listas ya resueltas por quien llama, en vez de
  repetir esa lógica (invariante nº1).
- Registrado en `src/lib/authz/registro-rutas.ts` bajo `clinico.escribir`, y en
  las tres listas congeladas de `authz-rutas-declaradas.test.ts` que exigen
  justificar por escrito toda ruta nueva que toque `notas` o `patients`.
- Golden nuevo: `el-paquete-se-compone-de-lo-firmado.test.ts`, 15 casos,
  sellado en `invariantes-clinicos.json`. Probado al revés: con
  `cambiosDeMedicacion` devolviendo `[]` en vez de `null` sin lista previa, el
  golden lo cazó en dos sitios antes de confirmar el arreglo.
- El primer intento del botón subió el techo de `trinquete-de-diseno.mjs`
  (`var(--ok, #hex)`/`var(--danger, #hex)`, tamaños y radios fuera de la
  escala declarada) — corregido con los tokens reales (`--success`, `--red`,
  10/12) antes de dar la unidad por terminada.
- `npm run build`: el compilador TS y el bundler pasan; la recolección de
  datos de página falla en `/dr/[clinicId]` por falta de credenciales de
  Firebase — confirmado idéntico en la rama base (`git stash` + build), no es
  una regresión de este cambio.
- Sigue abierto en `POSTVISIT-001`: vista previa real del `PaqueteDeVisita`
  antes de liberar, `proximaCita` (fija en `undefined`), y verificación en
  navegador.
