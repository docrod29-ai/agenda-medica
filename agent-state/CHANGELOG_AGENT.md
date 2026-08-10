# Bitácora del trabajo autónomo

## 2026-08-10 — MARCA · NexusMED → **Ausculta**

Instrucción del dueño, a mitad de la ejecución de V9. Renombrado el producto en
toda la aplicación: metadatos, manifiesto, PWA, portada, precios, demo, términos,
aviso de privacidad, contrato de encargo, prompts, correos y `aria-label`s.

- `src/lib/marca.ts` — el nombre vive en un sitio; `MARCA` alimenta metadatos,
  manifiesto, la barra lateral, el canal de alertas, la descripción del CFDI y
  el aviso de privacidad.
- `la-marca-es-una-sola.test.ts` — el nombre viejo no puede reaparecer en `src/`
  fuera de la lista blanca (citas, artefactos del dueño), y los identificadores
  **no** se renombran: hay un caso que lo comprueba al revés.
- `VERSION_AVISO` → `2026-08` y `COPILOT_VERSION` → `1.1.0`, los dos porque el
  texto que se firma o se manda al modelo cambió.

Lo que **no** se tocó, y está en `OWNER_DECISIONS_REQUIRED` (M-1…M-6): el
logotipo sigue siendo una «N», el dominio sigue siendo `nexusmed.mx`, y el
proyecto de Firebase y el `appId` no se migran.


## 2026-08-10 — V9 · `PATIENT-TELE-002` (P0) · REG-306

**El recordatorio de una videoconsulta ya lleva por dónde entrar.** Los tres
emisores de servidor —recordatorio de 24 h, de mismo día y los dos mensajes de
cita agendada del bot— llamaban a `dondeEsLaCita` sin token, así que todos
mandaban «recibirás el enlace por este medio» y no había ningún otro medio.

- `src/lib/telesalud/enlace-de-sala.ts` — decide cuántos días vale el enlace, o
  si no procede emitirlo. Puro.
- `src/lib/telesalud/token-de-sala-servidor.ts` — lo acuña con la
  `portalTokenVersion` del expediente. Una sola copia de la regla.
- Guardián de 13 casos; dos muerden.

**Lo que se descartó del plan escrito**: `ttlDias = 1`. Habría caducado el token
a la hora exacta de la consulta, con la sala abierta dos horas más — el 404 de
REG-268 por otra puerta.


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
