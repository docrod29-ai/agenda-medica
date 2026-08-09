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

## URGENTE — TRAZABILIDAD (nace el 7-ago-2026, medido otra vez el 8, y otra vez el 9 por la tarde)

| # | Decisión | Recomendación | Qué queda bloqueado | Qué sigue sin ella |
|---|---|---|---|---|
| T-1 | **36 PRs abiertos, 92 ramas vivas.** `REG-306` reclamado de forma independiente en al menos cinco (#273, #274, #276, #280, #281/#282) sobre el mismo hallazgo | Fusionar la cadena #281→#282 primero (la más completa y con `mergeable_state: clean`), luego cerrar por lotes los duplicados que quedaron obsoletos, renumerando al fusionar | El número de regresión y la versión del service worker **dejan de acotar un lote de notas clínicas** — que es justo lo que REG-191 acababa de reparar para IEC 62304 | Cada reparación por separado es correcta y tiene sus compuertas en verde |

**Medido el 9-ago-2026 (tarde) con `node scripts/estado-de-las-ramas.mjs`:**
**92 ramas vivas** (eran 33 el 8-ago — casi el triple en un día) · REG en
`main` **305**, en alguna rama **309** · service worker en `main` **v1167**,
en alguna rama **v1168**. Son **4 números de regresión** ya gastados en ramas
sin fusionar, y el `docs/ai/NEXUSMED_AUTONOMOUS_MEDICAL_INTELLIGENCE_MASTER_LOOP_V7.md`
que toda ejecución de V7 debe leer primero **no existe fusionado en `main`** —
sólo vive en PRs abiertos sin fusionar (#280, #281, #282), lo que significa que
cada disparo de V7 hasta ahora ha estado reconstruyendo su propio criterio en
vez de leer la directiva real (violación de §3: «Do not replace it with your
own plan»), sin que nadie lo notara porque el archivo nunca llegó a `main`.

**Por qué se repite, y por qué empeoró en vez de mejorar.** Cada disparo del
bucle arranca de `main`. Desde `main`, el ítem de mayor score y el siguiente
REG libre son siempre los mismos mientras nada se fusione, así que cada disparo
elige lo mismo y le pone el mismo número. El script `estado-de-las-ramas.mjs`
(añadido el 8-ago) evita que un disparo individual reabra el MISMO hallazgo,
pero no resuelve el problema de fondo: **mientras el dueño no fusione nada, la
cola sólo crece**, y ya creció de 33 a 92 ramas en 24 horas.

**Esta ejecución (9-ago, tarde) decidió no abrir una rama #93.** Añadir otra
reparación nueva sobre `main` sin fusionar nada habría repetido exactamente el
patrón que este ítem describe. En su lugar: se actualizó este registro con la
cifra real y se avisó al dueño por notificación — la cola ya no es un
recordatorio pasivo, es el bloqueador de mayor prioridad del programa.

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
