# Decisiones que sólo puede tomar el Dr. — cola, no interrupciones

El programa las **junta**; no las pregunta una por una. Cada entrada dice qué se
puede seguir haciendo sin ella, para que nada se detenga por esperar.

## URGENTE — CONFLICTO DE AUTORIZACIÓN (encontrado el 10-ago-2026)

`agent-state/MASTER_STATE.json` declara `"fusionarAMain": true` y
`"desplegarAProduccion": true`, con una nota que dice que el dueño «levantó la
restricción... de viva voz y por escrito varias veces». `CLAUDE.md` (fuente
de verdad del repositorio) y `.claude/rules/deployment-and-flags.md` dicen lo
contrario sin excepción: *«Desplegar a producción y fusionar a main son
decisiones del dueño»*, y están en la lista de **Prohibido sin autorización
explícita**. La propia regla de coordinación del repositorio pone el estado
persistente **último** en la prioridad, detrás de la especificación
autoritativa.

**Esta corrida no fusionó ni desplegó nada**, precisamente por ese orden. No
se editó el JSON para no borrar un posible registro de una conversación real
con usted que esta sesión no puede verificar. Lo que hace falta es que usted
confirme una de las dos: (a) el JSON está desactualizado y hay que corregirlo
a `false`/`false`, o (b) la autorización fue real y hay que escribirla también
en `CLAUDE.md`, que es donde vive la regla que todas las corridas obedecen.
Mientras no se aclare, cualquier corrida futura que confíe en el JSON en vez
de en `CLAUDE.md` podría fusionar o desplegar sin su permiso.

## CLÍNICAS

| # | Decisión | Recomendación por omisión | Qué queda bloqueado | Qué sigue sin ella |
|---|---|---|---|---|
| C-1 | Validar los 23 motores en `pendiente_validacion` + 1 experimental | Revisarlos por lotes, empezando por los que tocan dosis | Que dejen de mostrarse con la marca de «no validado» | Todo lo demás; la marca es honesta |
| C-2 | Las ~39 recomendaciones de inmuno **sin fuente** | Citarlas o retirarlas de pantalla | El charter §E1 exige que lo no fundamentado no se muestre como clínico | Se muestran declarando que no tienen fuente |
| C-3 | Clasificación de seguridad por fármaco (alto riesgo) | Empezar por insulina, anticoagulantes, opioides y vasopresores | Alertas específicas de alto riesgo | El cruce alergia↔fármaco y el motor de dosis ya corren |
| C-4 | ¿Un flujo de O₂ registrado implica «recibe O₂ suplementario» para NEWS2? | **No deducirlo.** Hoy se declara con ⚠ | Cerrar el modificador de NEWS2 | NEWS2 corre y declara la duda |
| C-5 | ¿El motivo de una corrección de signos es obligatorio? | Pedirlo y enseñarlo, sin bloquear | Que bloquee el guardado | Se pide y se declara en ámbar |
| C-6 | ¿Un CrCl a menos de 1 mL/min del umbral merece aviso propio de «estás en la frontera»? | **No por omisión.** El umbral es «por debajo de», no «cerca de»; un aviso de cercanía en los 18 umbrales es fatiga de alerta | Nada — el umbral funciona | REG-214 ya devolvió las alertas del borde que el redondeo se comía; esto sería una capa NUEVA, no la reparación |

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
| E-2 | Corpus **oro** del motor de temporalidad (EVAL-002): ¿quién etiqueta? | **Usted, sobre frases sintéticas.** Que el agente escriba más casos no arregla nada: la queja del ítem es justo que los casos los escribió el agente, y un oro etiquetado por quien escribió el motor mide su propia opinión | Saber si la defensa protege o estorba | El motor corre y declara la duda; sus casos actuales siguen sellados |

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

**Medido otra vez el 10-ago-2026 con `node scripts/estado-de-las-ramas.mjs` y
la API de GitHub:** **107 ramas vivas** (33 el 8-ago, 92 la noche del 9-ago —
casi el triple en 48 horas) · **38 PRs abiertos** · REG en `main` **305**, en
alguna rama **309** · service worker en `main` **v1167**, en alguna rama
**v1169**. Un disparo anterior (10-ago-2026, PR #283) ya midió 92 ramas y
**decidió explícitamente no abrir la #93** para no empeorar esto — esa misma
decisión sigue sin fusionar, en la rama `claude/clever-lamport-tys0vj`. Añadir
otro PR de sólo-estado a la pila no resuelve nada que el #283 no haya dicho
ya; lo que falta es que alguien fusione.

`docs/ai/NEXUSMED_AUTONOMOUS_MEDICAL_INTELLIGENCE_MASTER_LOOP_V7.md` — la
directiva que este mismo programa debe leer completa antes de decidir qué
hacer — **tampoco está fusionada a `main`**. Vive, idéntica, en dos ramas sin
fusionar (`claude/clever-lamport-a9htn3`, `claude/clever-lamport-xv6ul4`/
`3fkemu`). Cada disparo que arranca desde `main` la reconstruye o la relee de
una rama distinta, que es justo lo que la propia directiva prohíbe.

**Números de regresión repetidos entre PRs abiertos** (mismo REG, hallazgos
DISTINTOS, cada uno con sus pruebas en verde por separado): **REG-270** en al
menos 15 PRs (#234, #237, #239, #242, #243, #244, #245, #247, #250, #252,
#253, #255, #257, #258, #259, #261, #265, #266) · **REG-306** en al menos 8
PRs (#273, #274, #276, #280, #281, #282, #284, #285). Fusionar cualquiera de
ellos primero **sin renumerar** repite el defecto que T-1 describe.

**Candidato limpio para fusionar primero**: PR #285 (`claude/clever-lamport-
9uv5wq`, rebasado sobre el `main` de hoy, `mergeable_state: clean`, 8564
pruebas en verde, sólo `agent-state/`+`docs/`+3 rutas de API). Es el único de
los 38 que está al día contra `main`; el resto necesita rebase antes o
después de fusionar.

**Lo que esta corrida decidió, siguiendo el precedente del PR #283**: no
abrir una rama #109 con más código. La causa raíz no es falta de trabajo
autónomo — es falta de fusión. Cada corrida adicional que abre PR sin que
nadie fusione empeora exactamente lo que T-1 mide.

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

## CLÍNICA/OPERACIÓN · Política de correcciones a un registro ya hecho

**Encontrado por el instrumento de REG-255** (`validarCorreccion`, 18 líneas de
cuerpo real, sin llamador). **No es un defecto de software**: la función exige
una política como parámetro **obligatorio**, y `POLITICA_CORRECCION` nace en
`null` a propósito. Su propio comentario lo dice: *«la única forma de usar esta
función es que alguien haya decidido Q2-Q4 y lo haya escrito»*.

Sin su respuesta, **corregir una toma de signos o una administración ya
registrada no está habilitado**. El motor está escrito y probado.

Cuatro preguntas, y con las cuatro queda conectado:

1. **¿Quién puede corregir?** (roles: médico, enfermería, farmacia,
   laboratorio, administración)
2. **¿Quién puede ANULAR una administración de medicamento?** Es aparte porque
   anular una administración borra la constancia de que algo se dio.
3. **¿Cuántas horas después del evento se admite corregir?** ¿Y se admite
   corregir en un episodio ya egresado?
4. **¿El motivo escrito es obligatorio?**

**Por qué no lo decido yo.** Es política de registro clínico con peso
NOM-004: quién puede tocar un dato ya asentado y hasta cuándo. Elegir un valor
«razonable» y enterrarlo en una constante sería exactamente lo que este proyecto
no hace.

**Qué cuesta responder**: cuatro frases.
