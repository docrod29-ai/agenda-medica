# Lo que NO se reparó — CONSULTA (Panel de Lujo 2026-09)

Cuatro de los 45 hallazgos quedan sin cerrar del todo. Ninguno es un defecto
clínico vivo: dos dependen de una decisión del dueño que el valor seguro no
resuelve, y dos son la mitad ajena de un trabajo cuya mitad propia sí está hecha.

---

## N-021 · La nota por voz no se enseña antes de comprar (P3, `mejora`, parcial)

**Por qué no se reparó.** La propuesta central del auditor es publicar una
demostración de 90 segundos en la página pública: audio, transcripción, nota y
clic-a-la-procedencia, sin cuenta. Eso es **decisión del dueño** —el propio
hallazgo la formula— y roza `data-privacy.md`: sólo sería admisible con audio
sintético o actuado con consentimiento documentado, nunca con habla de consulta
real. El valor seguro del briefing («no publicar») es no hacerlo.

Además, la superficie es `src/app/demo/**` y `src/app/page.tsx`, que no son de
esta rebanada.

**Qué haría falta para cerrarlo**: una decisión escrita del dueño autorizando la
demostración pública con audio actuado, y luego el trabajo en DINERO/UI-CONFIG.

---

## PG-004 · No hay forma de retirar el consentimiento de grabación (P3, parcial)

**Por qué no se reparó.** Necesita dos cosas que no están en esta rebanada:

1. `retiradoEn` (y quién) en `Patient.consentimientoGrabacion`
   (`src/types/index.ts`) más su forma congelada en `firestore.rules` — handoff
   a SEGURIDAD, punto 9.
2. `NEEDS_LEGAL_REVIEW`: si el retiro obliga a borrar el audio ya conservado, y
   qué se le entrega al paciente como constancia.

**Lo que sí quedó hecho**: el texto del consentimiento dice ahora la verdad sobre
dónde va el audio y cuánto vive, y lleva versión — que es la mitad que permitirá
volver a pedirlo cuando cambie. La grabación se puede detener hoy desde la propia
pantalla: lo que falta es la **constancia** del retiro, no la capacidad.

---

## PP-018 · El esquema de vacunación no llega al portal (P3, `mejora`)

**Por qué no se reparó.** El propio auditor y el equipo rojo coinciden en que lo
que hace hoy el producto es **lo correcto**: no enseñarle a la madre un esquema
que la app no puede verificar, porque no existe registro de lo aplicado
(`vacunasSegunEdad` se llama siempre sin `aplicadas`). Enseñarlo sin ese registro
sería afirmar un hecho clínico que nadie comprobó (clinical-safety §4).

El trabajo previo —el registro de vacunas aplicadas en el expediente, con fecha y
fuente— es una unidad con nombre y una decisión del dueño («¿se construye antes
de V9-Practice?»), y toca el tipo del paciente y el portal: dos rebanadas ajenas.

**Lo que sí quedó hecho**: la barra de herramientas dejó de afirmar «N vacunas
atrasadas» en rojo (MP-011) y el panel enseña el sello del motor sin validar
(MI-003), así que la contradicción dentro de la misma pantalla desapareció.

---

## B-009 · El módulo del dictado sólo sesgaba al motor de repuesto (P3, parcial)

**Reparado a medias, a propósito.** El hook ya manda `contexto` por los dos
caminos de la diarización. Lo que falta es que
`src/app/api/expediente/transcribir-diarizado/route.ts` lo lea y lo expanda con
`nombresDelModulo()`, y esa ruta es de PROMPTS-ASR (handoff, punto 7). Mandar un
campo que el servidor todavía ignora no rompe nada.

---

## Además, declarado y no escondido

- **MP-006 en la receta**: la mitad de la consulta está cerrada; la de
  `receta/[patientId]/[notaId]/page.tsx` es de RECETA-DOCS y su caso está escrito
  como `it.todo` en la prueba movida, para activarse sin volver a redactarlo.
- **MG-022 (persistencia de la gestación)**: la FUM sobrevive dentro del
  encuentro; guardarla en la paciente para la visita siguiente necesita un campo
  ajeno (handoff, punto 3).
- **PC-012 · PI-008 · PP-009 (constancia del consentimiento)**: el texto y su
  versión existen; guardarlos con el consentimiento necesita el campo de
  SEGURIDAD (handoff, punto 9).
- **MO-004 (extracción de estudios de la nota)**: la consulta recoge los del
  extractor de entidades; que el esquema de la nota los devuelva es de
  PROMPTS-ASR (handoff, punto 8).
