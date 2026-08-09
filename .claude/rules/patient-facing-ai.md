# Regla — IA de cara al paciente

Aplica a: todo lo que le hable a un **paciente** en lugar de a un médico. Hoy
eso es `src/app/mi/**`, `src/app/api/portal/**` y lo que V9 construya bajo
`src/lib/paciente/**`.

Nace con el Master Loop V9 (`docs/ai/NEXUSMED_PATIENT_EXPERIENCE_AND_DESIGN_MASTER_LOOP_V9.md`).

## Por qué esta regla existe aparte

Hasta hoy la IA de este producto le hablaba a un **internista con cédula**. Un
error se lo comía alguien entrenado para verlo. La primera vez que la IA le habla
al paciente, el lector **no puede detectar el error**: no sabe que la dosis está
mal, no sabe que el fármaco no era el suyo, no sabe que eso que suena a permiso
médico no lo dijo su médico.

Las defensas del lado del médico **no se heredan**. Se vuelven a escribir aquí.

## 1. El orden de las fuentes ES la defensa

Un dato **específico de ese paciente** sólo puede salir de material aprobado por
su médico, y en este orden:

```
1. receta firmada
2. plan de cuidado liberado
3. instrucciones aprobadas por el clínico
4. órdenes firmadas
5. resultados revisados por el clínico
6. nota de encuentro firmada
7. expediente longitudinal aprobado
8. evidencia curada
9. modelo general — SÓLO para explicar o reformular lo anterior
```

El nivel 9 **nunca origina** un dato del paciente. Explica lo que ya dijeron los
niveles 1-8, en palabras más simples. Si un dato específico no se sostiene en un
nivel 1-8, **no hay respuesta**: hay escalación.

## 2. Cinco clases de respuesta, y ninguna sexta

`ANSWER_FROM_APPROVED_PLAN` · `EDUCATIONAL_EXPLANATION` ·
`ADMINISTRATIVE_ACTION` · `ESCALATE_TO_CLINICIAN` · `URGENT_REVIEW_REQUIRED`

Toda respuesta se clasifica **antes** de redactarse, y la clase se guarda con la
respuesta. Una respuesta sin clase es un defecto, no un caso raro.

## 3. Lo que la IA del paciente NUNCA hace por su cuenta

- establecer un diagnóstico nuevo
- cambiar el tratamiento
- cambiar una dosis
- suspender un medicamento
- prescribir
- firmar una receta
- generar un certificado médico firmado
- generar una nota médica firmada
- pasar por encima de una instrucción aprobada por el médico
- activar una orden clínica

No es una lista de cosas a evitar: es una lista de cosas que el código **no debe
poder hacer**. Si una ruta lo permite y sólo el prompt lo impide, está mal
construida. La prohibición vive en el servidor, no en la instrucción.

**En lugar de eso, se escala.** La escalación es el producto, no el fallo.

## 4. DRAFT hasta que el médico apruebe

`PatientVisitPackage` nace `DRAFT` y sólo pasa a `RELEASED` con aprobación de
alguien autorizado, con `approvedAt`, `approvedBy` y `version`. Un paquete
`DRAFT` **no es visible para el paciente**. Nunca.

Que el médico haya firmado la nota no libera el paquete: son dos actos. Firmar
es un acto medicolegal hacia el expediente; liberar es un acto de comunicación
hacia el paciente. Se pueden hacer juntos, pero se registran aparte.

## 5. Ausencia de dato no es dato de ausencia — también aquí

Que el plan no mencione el embarazo no significa que la paciente no lo esté. Que
no diga «no manejes» no significa que pueda manejar. Que no aparezca una alergia
no significa que no exista.

Ante una pregunta cuya respuesta segura depende de un dato que **no está en el
plan aprobado**, la respuesta es escalar — no completar con lo probable.

## 6. La urgencia gana a todo lo demás

Dolor torácico, dificultad respiratoria, ingesta accidental por un tercero,
sobredosis, síntomas neurológicos agudos: `URGENT_REVIEW_REQUIRED` **antes** de
cualquier otra clasificación, con la vía de contacto real y sin sepultar el aviso
bajo una explicación educativa.

Un aviso urgente que llega en el tercer párrafo no llegó.

## 7. Se prueba con las doce preguntas, siempre

Las doce del §0 de V9 son **fixture permanente** en `evals/patient-ai/`. No son
ejemplos: son la puerta. Un cambio en la IA del paciente que no las corra no está
terminado.

Cada defecto nuevo que encuentre el equipo rojo se convierte en:
**reproducción → arreglo → prueba de regresión → fixture permanente.**

## 8. Aislamiento, igual que en el resto

El paciente ve **lo suyo y nada más**. El token del portal está atado a
`{clinicId, patientId}` y el alcance se aplica **en el servidor**. Un cuidador
autorizado es una autorización explícita y revocable, con bitácora — no un
segundo dueño del expediente.

PHI nunca en logs, nunca en la URL, nunca en un mensaje de error. Aquí se agrava:
un enlace de paciente se reenvía por WhatsApp y acaba en sitios que nadie
controla.
