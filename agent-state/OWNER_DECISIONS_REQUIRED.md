# Decisiones que sólo puede tomar el Dr. — cola, no interrupciones

El programa las **junta**; no las pregunta una por una. Cada entrada dice qué se
puede seguir haciendo sin ella, para que nada se detenga por esperar.

## CLÍNICAS

| # | Decisión | Recomendación por omisión | Qué queda bloqueado | Qué sigue sin ella |
|---|---|---|---|---|
| C-1 | Validar los 23 motores en `pendiente_validacion` + 1 experimental | Revisarlos por lotes, empezando por los que tocan dosis | Que dejen de mostrarse con la marca de «no validado» | Todo lo demás; la marca es honesta |
| C-2 | Las ~39 recomendaciones de inmuno **sin fuente** | Citarlas o retirarlas de pantalla | El charter §E1 exige que lo no fundamentado no se muestre como clínico | Se muestran declarando que no tienen fuente |
| C-3 | Clasificación de seguridad por fármaco (alto riesgo) | Empezar por insulina, anticoagulantes, opioides y vasopresores | Alertas específicas de alto riesgo | El cruce alergia↔fármaco y el motor de dosis ya corren |
| C-4 | ¿Un flujo de O₂ registrado implica «recibe O₂ suplementario» para NEWS2? | **No deducirlo.** Hoy se declara con ⚠ | Cerrar el modificador de NEWS2 | NEWS2 corre y declara la duda |
| C-5 | ¿El motivo de una corrección de signos es obligatorio? | Pedirlo y enseñarlo, sin bloquear | Que bloquee el guardado | Se pide y se declara en ámbar |

## DESPLIEGUE Y OPERACIÓN

| # | Decisión | Recomendación | Bloqueado | Sigue sin ella |
|---|---|---|---|---|
| O-1 | Buzón real para alertas de operación (`OPS_ALERTA_WEBHOOK`) | Un canal de Slack o un correo dedicado | Enterarse con la app cerrada | La franja de la app ya avisa dentro |
| O-2 | Simulacro de restauración con `gcloud firestore databases restore` | Cronometrarlo una vez, en un proyecto de prueba | El acta de restauración real | La ida y vuelta del respaldo ya está medida |
| O-3 | Pentest externo y PITR | Contratar cuando haya clientes de pago | El registro de riesgos lo declara pendiente | Todo lo demás |
| O-4 | Cuenta de prueba en los secretos de CI | Una cuenta de juguete con datos sintéticos | El E2E sólo cubre lo público | El resto de CI |

## EVALUACIÓN

| # | Decisión | Recomendación | Bloqueado | Sigue sin ella |
|---|---|---|---|---|
| E-1 | ¿Se pueden reinyectar transcripciones de producción **desidentificadas** al corpus? | **No, por omisión.** La voz es biométrica | El número «de verdad» de consulta real | El corpus actuado ya mide atribución de rol |

## COMERCIALES

| # | Decisión | Recomendación | Bloqueado | Sigue sin ella |
|---|---|---|---|---|
| N-1 | ¿Se puede repetir la prueba de 14 días? | Una por cuenta, comprobada contra Stripe | Cerrar el hueco de pruebas repetidas | El resto del cobro |
| N-2 | Verificación de correo al registrarse | Activarla: un correo mal tecleado deja la cuenta irrecuperable | Recuperación sin soporte humano | El alta funciona |

---

**Regla del programa**: esta cola se presenta al final del ciclo autónomo o
cuando toda tarea productiva esté bloqueada — nunca a mitad del trabajo.


---

## D-08 · ¿Se sube el sello a v4 para que cubra la transcripción de origen?

**Estado**: pendiente · abierto el 6-ago-2026 (TRACE-001 / REG-199)

**El hecho** — El sello v3 no cubre `transcripcionMotor`, que es el material de
origen del que se re-proyecta la nota. La exclusión está documentada y tiene una
razón sólida: añadirlo al canónico **cambiaría el hash de todas las notas ya
firmadas** y las marcaría «alterada» de golpe — la falsa alarma que ya costó
REG-060.

**Lo que ya se hizo sin tocar nada** (v1080): la pantalla dejó de decir «cubre
todo». Ahora declara qué queda fuera, con su nombre legible.

**La decisión que es suya, no mía**

| Opción | Qué implica |
|---|---|
| **Quedarse en v3** | El origen no va sellado. Se dice claramente. Cero riesgo. |
| **Subir a v4** | El origen queda sellado en las notas NUEVAS. Las viejas conservan su sello v3 y se re-verifican con su propio algoritmo (ya está soportado). Coste: una migración y un periodo con dos versiones vivas. |

**Lo que NO se hará sin su palabra** — Tocar el hash. Es irreversible sobre
documentos firmados con su cédula, y ninguna mejora de trazabilidad justifica
marcar como alteradas notas que están intactas.

## CLÍNICA/LEGAL · Cuánto tiempo se conserva el audio de la consulta

**Estado**: el Dr. autorizó **conservarlo** («conserva el audio», 8-ago-2026). Lo
que falta es el **periodo**.

**Por qué se pregunta y no se asume.** El audio de una consulta es dato de salud.
El código no lleva ningún periodo escrito a mano justamente para que la respuesta
sea suya y no un supuesto mío enterrado en una constante.

**Lo que ya es cierto hoy**: el audio vive en `consultas-audio/{uid}/`, sólo lo
lee su dueño (regla de Storage), y en el expediente se guarda **la ruta**, nunca
la URL de descarga —que llevaría un token dentro—.

**Recomendación por defecto** (si no decide otra cosa, no se implementa nada:
el audio simplemente se queda): alinear la retención con la del expediente en
NOM-004 y borrar automáticamente al vencer. Eso exige una tarea de limpieza y
**su confirmación del plazo**.

**Alternativas**: (a) conservarlo indefinidamente; (b) borrarlo al firmar la nota
—se pierde el clic-a-audio, que es justo lo que él pidió—; (c) un plazo fijo.

**Qué queda bloqueado sin la respuesta**: nada del clic-a-audio. Sólo la tarea de
borrado automático.

**Qué cuesta responder**: una frase.
