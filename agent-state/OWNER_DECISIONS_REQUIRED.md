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

---

## SEGURIDAD · ¿La revocación de un enlace del paciente falla ABIERTA o CERRADA?

**Estado**: pendiente · abierto el 9-ago-2026 (V7 · PATIENT-PORTAL-001 / REG-306)

**El hecho** — `/api/portal` comprueba `portalTokenVersion` para poder invalidar
de golpe todos los enlaces ya emitidos de un paciente (teléfono perdido, número
reciclado, mensaje reenviado). Si esa lectura de Firestore **lanza**, el código
deja pasar a propósito (`route.ts`, el `catch` vacío).

**Lo que YA se hizo en esta corrida, y no depende de usted**: las tres rutas sin
freno de tasa —portal, reseña pública y create-checkout— ya lo tienen (REG-306).
Eso acota el daño de un token filtrado: ya no se puede barrer la agenda a la
velocidad de la red.

**La decisión que es suya**

| Opción | Qué implica |
|---|---|
| **Seguir fallando ABIERTA** (hoy) | Un enlace revocado vuelve a valer mientras dure una incidencia de Firestore. A cambio, ningún paciente se queda fuera de su propia agenda por un mal minuto de la base. La firma y la caducidad siguen protegiendo. |
| **Fallar CERRADA** | Un enlace revocado nunca vuelve a valer. A cambio, una incidencia de Firestore deja a **todos** los pacientes fuera del portal —no sólo a los revocados—, justo cuando el consultorio menos puede atender llamadas. |

**Recomendación por omisión**: **quedarse como está** y no tocarlo. La ventana es
estrecha, ahora está limitada en tasa, y el modo de fallo de la opción cerrada es
más ancho que el riesgo que evita. Pero es una aceptación de riesgo de seguridad,
y §3.2 de la directiva V7 dice que eso lo firma el dueño, no el agente.

**Qué queda bloqueado sin la respuesta**: nada. El límite de tasa ya está puesto
y el resto del portal funciona.

**Qué cuesta responder**: una frase.

---

## PRODUCTO/SEGURIDAD · ¿La firma sola basta para mostrarle algo al paciente, o siempre hace falta un acto de liberación aparte?

**Estado**: pendiente · abierto el 9-ago-2026 (V7 · POSTVISIT-ENTREGA-001 /
REG-308, al chocar con `PATIENT-COMPANION-001` de V9)

**El hecho** — Esta corrida construyó una acción `instrucciones` en
`/api/portal` para entregar la hoja de instrucciones (REG-242/307) al
paciente, con el mismo gate que la acción `documentos` ya usa para las
recetas descargables: `alcance === 'clinico'` y sólo notas `estado ===
'firmada'`. Al fusionar con `main` apareció el módulo de V9
`lib/paciente/paquete-de-visita.ts`, que construye el `PatientVisitPackage`
de la especificación con precisión mayor: nace `DRAFT`, y sólo pasa a
`RELEASED` con un acto de aprobación explícito y registrado
(`approvedAt`/`approvedBy`), **distinto y posterior** a la firma de la nota.
Su propio comentario cita la regla:

> Que el médico haya firmado la nota no libera el paquete: son dos actos.

Conectar mi acción a `/mi/[token]` habría hecho lo que esa regla prohíbe:
mostrarle al paciente contenido cuya única compuerta es la firma, sin ningún
acto de liberación aparte. Se retiró el cableado antes de fusionar; la
pestaña «Cuidado» del portal sigue enseñando su estado vacío honesto —
`PATIENT-COMPANION-001` ya lo resolvió bien.

**La tensión que es suya, no mía** — El patrón que retiré es **el mismo**
que ya usa `documentos` (recetas): firma + alcance clínico, sin liberación
aparte, y esa acción **ya está en producción**. No es una decisión que yo
pueda tomar sola porque toca dos cosas a la vez: qué tan estricto debe ser
el nuevo companion, y si eso implica revisar algo que ya se envió.

| Opción | Qué implica |
|---|---|
| **El estándar de `documentos` basta** (firma + alcance clínico) | Conectar `instrucciones` a `/mi/[token]` es seguro tal como está. Coherente con lo que ya se envió; no resuelve la brecha que `PATIENT-COMPANION-001` señaló a propósito. |
| **El companion exige siempre el nivel de `PatientVisitPackage`** (liberación aparte de la firma) | `instrucciones` se queda sin llamador hasta que exista `POSTVISIT-001` (la pantalla del médico que libera). Más lento, pero es lo que dice `patient-facing-ai.md` §4 al pie de la letra — y entonces cabría preguntarse si `documentos` también debería subir ese nivel. |

**Recomendación por omisión**: **no conectar nada todavía** — es la opción
reversible y la que ya está en el código (la pestaña «Cuidado» sigue
enseñando el estado vacío). Subir el estándar de `documentos` con
retroactividad es un cambio de alcance mayor que esta sesión no debe decidir
por su cuenta.

**Qué queda bloqueado sin la respuesta**: que la hoja de instrucciones llegue
al paciente por cualquier camino automático. El médico la sigue viendo y
copiando/imprimiendo desde su propia pantalla (REG-307).

**Qué cuesta responder**: una frase — «basta con la firma» o «espera a
`POSTVISIT-001`».
