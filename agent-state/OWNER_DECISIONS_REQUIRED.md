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

## URGENTE — TRAZABILIDAD (nace el 7-ago-2026, medido otra vez el 8)

| # | Decisión | Recomendación | Qué queda bloqueado | Qué sigue sin ella |
|---|---|---|---|---|
| T-1 | **22 PRs abiertos. Catorce se titulan «REG-192 … (v1074)»** y son reparaciones DISTINTAS; dos se titulan «REG-194 … (v1076)» | Fusionar o cerrar por lotes, renumerando al fusionar | El número de regresión y la versión del service worker **dejan de acotar un lote de notas clínicas** — que es justo lo que REG-191 acababa de reparar para IEC 62304 | Cada reparación por separado es correcta y tiene sus compuertas en verde |

**Medido el 8-ago-2026 con `node scripts/estado-de-las-ramas.mjs`:** 33 ramas
vivas · REG en `main` **191**, en alguna rama **224** · service worker en `main`
**v1073**, en alguna rama **v1106**. Son **33 números de regresión gastados** en
trabajo sin fusionar, y seis ramas distintas llamándose «v1074».

**Por qué se repite.** Cada disparo del bucle arranca de `main`. Desde `main`, el
ítem de mayor score y el siguiente REG libre son siempre los mismos mientras nada
se fusione, así que cada disparo elige lo mismo y le pone el mismo número. No es
que los agentes se equivoquen: ninguno veía el trabajo de los otros.

**Lo que ya no hace falta decidir.** El disparo del 8-ago añade
`scripts/estado-de-las-ramas.mjs`: dice el siguiente REG y la siguiente versión
libres sobre **todas** las ramas, y qué ramas tocan un archivo dado. Ese mismo
disparo lo usó y, al ver que su hallazgo ya estaba resuelto en el PR #237, **no
abrió un PR duplicado**. Sigue haciendo falta la decisión de fusionar: mientras
no se fusione nada, la cola sólo crece.

---

**Regla del programa**: esta cola se presenta al final del ciclo autónomo o
cuando toda tarea productiva esté bloqueada — nunca a mitad del trabajo.
