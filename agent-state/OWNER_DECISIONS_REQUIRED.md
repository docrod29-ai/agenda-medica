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

## NUMERACIÓN (añadido 8-ago-2026)

| # | Decisión | Recomendación | Bloqueado | Sigue sin ella |
|---|---|---|---|---|
| T-1b | **Colisión de REG-xxx y de `nexusmed-vNNNN` entre ramas en vuelo.** El 8-ago-2026 hay ~15 ramas de agente basadas en `main` (REG-191 · v1073) y **todas** reclaman REG-211 y v1093; alguna llega a REG-233 · v1115. El número sale de contar lo que hay en `main`, y `main` no se mueve hasta que el dueño fusiona | Renumerar **al fusionar**, en el orden en que se acepten, y no antes: cualquier número elegido hoy vuelve a colisionar mañana. Alternativa si molesta: reservar bloques por rama | Nada del trabajo clínico | Todo: cada rama trae su defecto reparado y sus compuertas en verde; sólo la etiqueta está por decidir |
