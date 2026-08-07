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
| C-6 | ~~El guardián de negaciones usa **un mismo regex** para dos preguntas: «¿esta mención de la nota ya viene explicada?» y «¿el médico negó esto en el dictado?». ¿Se separan?~~ **RESUELTO 7-ago-2026.** El dueño decidió separar. `negaciones.ts` ahora tiene `DISCULPA_EN_LA_NOTA` y `NIEGA_EN_EL_DICTADO` como constantes propias — mismo texto hoy, pero ensanchar una ya no puede tocar la otra por accidente. Golden: `la-nota-lo-dice-dos-veces.test.ts` → `C-6 RESUELTO`. | — | — | — |
| C-6-bis | Qué frases cuentan como disculpa en la NOTA (`DISCULPA_EN_LA_NOTA`) es vocabulario clínico, no estructura — separar el regex (C-6) no contesta esto. Dos huecos reproducidos: (a) frases que hoy **no** excusan y deberían, como «no se documenta…», «ninguna…» (7-ago); (b) formas concretas que hoy **disparan** el aviso contra una nota correcta (REG-193): «Negó diabetes» —falla sólo por el acento, `nieg[ao]` no cubre `negó`—, «Sin diabetes», «No es diabético», «Diabetes: negada», «DM2 (-)» | No ensanchar sin criterio clínico — es justo lo que salió mal en REG-192. Para (b), al menos la **morfología de lo ya aprobado** («negó», «negaba»); el resto es vocabulario nuevo y lo decide el Dr. | Que ambos huecos dejen de disparar / de dejar pasar el aviso | El guardián corre; los dos huecos están declarados y van con su golden |
| C-8 | Cuando el paciente contesta «no sé», ¿debe **verse** en la consulta? (REG-193) | **Enseñarlo**, en gris y sin puntuar: «no lo sabe» es distinto de «no lo tiene» y de que no se preguntara | Que la duda del paciente llegue a la pantalla y a la nota | Ya no cuenta como negación: la condición se queda como la puso el extractor, que es el lado seguro |
| C-9 | ¿Un hedge («creo que no», «casi no») debe preguntarse o callarse? (REG-193) | **Preguntar** por la vía de `politica-critica.ts`, no decidir por él | Cerrar la zona gris entre «no» y «no sé» | Hoy no cuentan como negación: no se niega de más |
| C-7 | ¿Se añaden los **compuestos** al vocabulario — «miocardiopatía» como cardiopatía, «esteatohepatitis» como hepatitis? | Añadirlos como formas, igual que ya está `bronconeumonía` | Que esos compuestos se vigilen | Todo lo demás; hoy esos casos no se vigilan y así queda declarado |

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

## URGENTE — TRAZABILIDAD (nace el 7-ago-2026)

| # | Decisión | Recomendación | Qué queda bloqueado | Qué sigue sin ella |
|---|---|---|---|---|
| T-1 | **19 PRs abiertos, catorce dicen ser «REG-192 … (v1074)» y dos dicen ser «REG-194 … (v1076)»** — reparaciones DISTINTAS con el mismo número | Fusionar o cerrar por lotes, renumerando al fusionar. Y arreglar el arranque del bucle (ver abajo) | El número de regresión y la versión del service worker **dejan de acotar un lote de notas** — que es justo lo que REG-191 acababa de reparar para IEC 62304 | Cada reparación por separado es correcta y tiene sus compuertas en verde |

**Por qué se repite y no se arregla solo.** La rutina nocturna arranca de `main`
en cada firing. Desde `main`, el ítem de mayor score sigue siendo el mismo
mientras nada se fusione, así que cada firing vuelve a elegirlo, le asigna el
siguiente REG libre **según `main`** —que siempre es el mismo— y abre una rama
nueva. No es que los agentes se equivoquen: es que ninguno ve el trabajo de los
otros. El firing del 7-ago por la tarde empezó a reimplementar REG-192 entero por
enésima vez y sólo se dio cuenta al fallar el `git push` contra una rama que ya
existía.

**Lo que se puede hacer sin decidir nada clínico:** que el bucle, antes de elegir,
mire las ramas de `origin` y los PRs abiertos, y que el REG se tome del máximo
entre `main` y las ramas vivas. Queda anotado como OPS-003 en el backlog. Pero
mientras no se fusione nada, la cola sólo crece.

---

**Regla del programa**: esta cola se presenta al final del ciclo autónomo o
cuando toda tarea productiva esté bloqueada — nunca a mitad del trabajo.
