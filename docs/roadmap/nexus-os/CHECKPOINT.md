# Nexus OS — dónde vamos

> **En 30 segundos.** Van **12 de 68** unidades cerradas. Hoy se cerró **E0-12**, y lo que arregla se
> dice en una frase: **el candado antifalsificación de sus notas firmadas sólo protegía la mitad de
> la nota.** Cada nota que usted firma se sella con una huella digital (SHA-256): si alguien cambia
> una letra después, la huella deja de coincidir y la pantalla lo grita. Eso ya funcionaba. El
> problema es **qué** entraba en la huella: **10 de los 26 campos de la nota**. Fuera quedaban, entre
> otros, **los puntajes de riesgo de una valoración preoperatoria**, el **día de antibiótico** y la
> desescalada de una nota de infectología, los datos de hospitalización, el **resumen ejecutivo**, la
> **transcripción del dictado** (que es la fuente de todo el expediente), **con qué modelo de IA se
> redactó la nota y si usted la revisó de verdad**, y hasta **su cédula profesional** del encabezado.
> Se podía cambiar cualquiera de esas cosas en una nota **ya firmada** y el documento seguía diciendo
> «integridad verificada». **Ahora la huella cubre toda la nota firmable**, y lo que queda fuera está
> escrito uno por uno **con el motivo** (son los campos que la propia app mueve *después* de firmar:
> la fecha de modificación, el bloque de firma, el contador de versiones; sellarlos haría que TODAS
> sus notas legítimas salieran marcadas como alteradas, que es el error que de verdad hay que evitar).
> **Quién es el ladrón, para que quede claro:** no es usted editando desde la app — eso ya está
> prohibido por las reglas de la base de datos. Es una escritura por la consola de administración, un
> error de programación futuro, o una contraseña robada. La huella no impide que le toquen la nota:
> hace que **se note**. Y se notaba en la mitad del documento.
> **Lo importante para su tranquilidad: ninguna de sus notas ya firmadas cambia de estado.** Eso no
> es una promesa, es lo que prueban los tests: cada nota se verifica con **su propio** sello, el
> algoritmo viejo quedó **congelado** con una huella de referencia fijada letra por letra, y una nota
> vieja sigue saliendo «verificada» — **no** degradada. Si hubiera subido el número del sello sin ese
> cuidado, **todo su histórico firmado** habría pasado de «verificada» a «no se puede comprobar» de
> golpe: un retroceso disfrazado de mejora.
> **Lo que NO se hizo, a propósito: no se re-selló ninguna nota vieja** *(decisión 9.a — no urge)* y
> **no se tocó ni una línea del flujo de firmar**, ni de la impresión, ni de la receta, ni de los
> cobros. El único cambio que verá en pantalla es un renglón que **no se imprime**: en las notas
> viejas ahora dice qué cubre su sello y qué no, sin alarma roja, porque no hay indicio de alteración.
> **Sigue pendiente lo de siempre:** la prueba de aislamiento entre clínicas espera un sí/no
> *(decisión 8.a)*, el despliegue de seguridad *(2.a)*, el error de la **«Vitamina K»** vivo en
> producción *(1.e)*, la mudanza de las alergias *(6.a)* y quién dicta en su UCI *(7.a)*.

Última corrida: `2026-07-29T22:58:09Z`. `tsc` verde · **2 663 tests verdes** (196 archivos) ·
`npm run build` verde · **nada desplegado, sin `push`**.

---

## El tablero

| Unidad | Qué es | Estado |
|---|---|---|
| E0-01 | Certificado de receta firmado con identidad derivada | ✅ cerrada |
| E0-02 | Invariantes de dosis pediátrica (property-based) | ✅ cerrada |
| E0-03 | Clinical Engine Registry + trinquete de ADRs | ✅ cerrada |
| E0-04 | Un número clínico ya no puede viajar sin su unidad | ✅ cerrada |
| E0-05 | Los motores clínicos ya no aceptan números sin unidad | ✅ cerrada — espera su visto bueno para desplegar |
| E0-14 | Firma aislada · cobro sellado · nota nace borrador | ✅ cerrada (única con reglas desplegadas) |
| E0-15 | Antibiograma: 4 decisiones clínicas suyas implementadas | ✅ cerrada |
| E1-01 | Un hecho clínico no existe sin unidad y sin procedencia | ✅ cerrada |
| E2-01 | Una afirmación no existe sin el fragmento que la respalda | ✅ cerrada |
| E0-07 | Cada puerta dice qué permiso exige (ya no «es médico», sí/no) | ✅ cerrada — 21 puertas migradas sin quitarle acceso a nadie; 26 esperan **decisiones suyas** |
| **E0-12** | **El sello de la nota firmada cubre TODA la nota, no la mitad** | ✅ **cerrada hoy** — riesgo alto, cero notas cambian de estado; 2 preguntas suyas que **no bloquean** |
| E0-08 | Que una clínica no vea a otra: probado empujando la puerta | 🟡 1 120 intentos de robo escritos; **falta ejecutarlos una vez** (hace falta Java) → **decisión 8.a** |
| E0-06 | Recepción no debe ver el expediente | 🟡 agujero de la API cerrado; mudar las alergias espera **una decisión suya** |
| E0-10 | Iframes bloqueados en sus pantallas · interruptor de seguridad | 🔴 espera **un despliegue suyo** |
| E1-02 | «Creatinina», «Cr» y «creatinina sérica» son el mismo dato | 🔴 falta 1 test + sus respuestas |
| E2-02 | La búsqueda de evidencia se arma por partes, no con una frase suelta | 🔴 **el módulo no lo usa nadie** |
| E0-11 | El CI protege los invariantes clínicos | 🟡 código listo — espera 5 min suyos en GitHub |
| E0-09 | El registro del hospital no se edita: se corrige anexando | 🟡 bloqueada — espera 1 línea suya |

**12 cerradas · 7 esperándole · 49 sin empezar.**

---

## Qué pasó hoy: E0-12, en español

**El problema, en una frase:** cuando usted firma una nota, el sistema le calcula una **huella
digital** del contenido y la guarda dentro del documento. Si mañana alguien altera la nota, la huella
ya no cuadra y la pantalla saca una alarma roja: «esta nota pudo haber sido alterada». Ése es el
mecanismo que exige la NOM-024 y **funcionaba**. Lo que nadie había medido es **cuánto de la nota
entraba en la huella: 10 de sus 26 campos.**

**Qué se podía cambiar en una nota YA FIRMADA sin que el sistema se enterara** (esto no es una
lista teórica; es lo que se midió campo por campo):

- **Los puntajes de la valoración preoperatoria.** El riesgo cardiovascular, el de trombosis, el de
  apnea. Se podía bajar el riesgo quirúrgico de una valoración firmada y el documento seguía
  diciendo «integridad verificada». *Es literalmente la prueba de aceptación de esta unidad.*
- **El día de antibiótico y la desescalada** de una nota de infectología (PROA / NOM-045).
- **Los datos de hospitalización:** servicio, cama, día de estancia, balance hídrico.
- **El resumen ejecutivo** — que es la primera línea que se imprime de la nota.
- **La transcripción del dictado y el diálogo separado por voces.** Es la **fuente** del expediente,
  la evidencia de origen de todo lo demás. Era editable sin dejar rastro.
- **La trazabilidad de la IA:** con qué modelo se redactó, con qué versión del prompt, y **si usted
  la revisó de verdad antes de firmar**. Ese último campo existe precisamente para poder auditar
  «firmó sin revisar», y se podía cambiar después.
- **Su cédula profesional, su especialidad y el establecimiento** del encabezado medicolegal. Y el
  **nombre del paciente**.
- **Las etiquetas de las secciones.** La huella vieja sellaba el *texto* de cada sección pero no su
  *título*, y el documento imprime el título: se podía cambiar «Objetivo» por «Subjetivo» y así
  cambiar **lo que la nota afirma** sin tocar una sola letra del contenido.

**Quién es el ladrón, porque importa.** No es usted editando su propia nota desde la app: eso ya
está prohibido por las reglas de la base de datos (una nota firmada es de sólo lectura para
cualquier cliente). Los escenarios reales son tres: una escritura desde la **consola de
administración** de Google, un **error de programación futuro** que reescriba una nota firmada, o
una **contraseña robada**. Para exactamente esos tres existe la huella. Y no sirve para
*prevenirlos* —nada en el código de la app puede— sino para que **queden a la vista**. Estaba a la
vista en la mitad del documento.

**Lo que se hizo.** Se creó el sello **versión 3**, que cubre **todo el contenido firmable**. Y lo
que queda fuera está escrito **uno por uno con su motivo**, no por olvido:

- **el bloque de la firma**, la **fecha de modificación** y el **contador de versiones** se escriben
  *después* de calcular la huella. Sellarlos haría que **todas** sus notas legítimas salieran
  marcadas como alteradas — y ése es el error grave de verdad: una alarma roja falsa destruye la
  confianza en el sello, y ya pasó una vez en este sistema.
- **el estado de la nota** queda fuera porque **cancelar una nota firmada es legítimo**. Sellarlo
  convertiría una cancelación válida en una acusación de alteración.

**Lo importante: ninguna de sus notas ya firmadas cambia de estado.** Y hay una trampa aquí que era
fácil de pisar: si se sube el número del sello **sin más**, el código viejo trataba a todas las notas
con el sello anterior como «no se puede comprobar». Es decir: **todo su histórico firmado** habría
pasado de «verificada» a «legado» en un solo despliegue — perder la verificabilidad de todo lo
firmado, con la etiqueta de mejora. Se evitó así: **cada nota se verifica con el algoritmo de SU
propio sello**, el algoritmo viejo quedó **congelado** (con un comentario que lo prohíbe tocar) y se
fijó una **huella de referencia letra por letra**, medida con el código anterior, que se pone roja si
alguien lo modifica.

**Y algo que no se hizo, a propósito: no se re-selló ninguna nota vieja.** Dos razones, cada una
suficiente. **La legal:** un sello afirma «éste era el contenido *en el momento de la firma*»; si hoy
lo recalculo sobre una nota de mayo, lo que afirma es «éste es el contenido *hoy*» — y si alguien la
alteró en junio, el sello nuevo **bendice la alteración** y destruye la única prueba. **La técnica:**
sólo la consola de administración podría reescribir una nota firmada, que es justamente el vector del
que la huella debe proteger. Así que las notas viejas se extinguen solas (cada nota nueva nace con el
sello completo) y mientras coexistan, **la pantalla dice la verdad completa**: «sello de formato
anterior, verificado sobre el cuerpo de la nota; **no cubre** valoración preoperatoria, datos
hospitalarios, infectología, trazabilidad de IA». Sin alarma roja, porque **no hay indicio de
alteración** — informar no es acusar. Y si una nota vieja necesita corrección, el camino legal ya
existe y no se toca: la **adenda**.

**El candado para que esto no se repita.** El hueco de `preop` no nació por descuido puntual: nació
porque **nadie tenía que declarar** si un campo nuevo entra o no en la huella. Ahora sí. La partición
está escrita —cada campo, en una lista o en la otra, **con el motivo**— y hay un trinquete de tipos:
**si alguien añade un campo nuevo a la nota, el control de calidad se pone rojo** hasta que se
clasifique. Se comprobó saboteándolo: se añadió un campo de prueba al tipo de la nota y `tsc` cayó
señalando la línea exacta; se restauró.

**Lo que se saboteó a propósito para comprobar que los tests sirven** (todos restaurados):

- se **bajó el sello a la versión vieja** → **29 casos rojos**, incluida la aceptación;
- se **mutó el algoritmo congelado** → cae la huella de referencia (que es su única defensa contra
  que alguien lo toque sin darse cuenta);
- se **quitó un campo** del sello nuevo → cae exactamente la mutación que lo vigilaba;
- se **añadió un campo al tipo de la nota** → el control de calidad rojo.

**Cero datos suyos.** Un paciente ficticio y puntajes inventados que sólo existen como *bytes que
deben romper la huella*, nunca como criterio clínico. Esta unidad **no decide nada médico**: se
limita a ampliar qué bytes entran a un cálculo.

---

## Lo de la corrida anterior: E0-08

**El problema, en una frase:** que los datos de una clínica no se puedan ver desde otra estaba
comprobado **leyendo** el archivo de permisos, no **probándolo** — como comprobar que una puerta
cierra leyendo el manual de la cerradura. Se montaron dos consultorios de mentira (`clinica-alfa` y
`clinica-beta`, con pacientes y notas **inventados**) y **1 120 intentos de robo**: cada puesto de
la clínica A tratando de leer y escribir en cada una de las **36 carpetas** de la clínica B, en las
dos direcciones, más **8 pruebas al revés** (que en su propia clínica cada quien sí puede lo suyo,
porque unos permisos que bloquearan **todo** también aprobarían el examen y usted se quedaría sin
app).

**Lo que hay que decir sin adornos: esos 1 120 intentos todavía no se han ejecutado ni una vez.** El
simulador de la base de datos de Google necesita **Java** y esta máquina no lo tiene. Por eso la
unidad se cierra **«falta ejecutarla»** y no «hecha»: escribir «demostrado que ninguna clínica ve a
la otra» sin haberlo corrido sería justo la mentira que la unidad venía a eliminar → **decisión
8.a** (un sí/no de un minuto). Lo que **sí** quedó probado: que la prueba nueva **no puede tumbar el
resto** (se sabotearon 6 cosas y las 6 salieron rojas), que **no se tocó ni una línea** de los
permisos de su base de datos, y que los tres controles de calidad siguen verdes.

---

## 👉 Lo siguiente

**Lo más barato de todo sigue siendo la decisión 8.a.** Un sí/no. Si me dice «instala Java», los
1 120 intentos de robo se ejecutan aquí y **E0-08 pasa de «falta ejecutarla» a cerrada el mismo
día**, con la frase «ninguna clínica puede ver a otra» por fin **demostrada**. Si me dice «sólo en
GitHub», también sirve: corre sola en cuanto se abra el primer Pull Request. Lo que no voy a hacer es
instalar cosas en su computadora sin preguntarle.

**Si contesta la decisión 7.a (una frase), lo siguiente es cerrar el hueco de la IA.** Es, con
diferencia, **el mayor valor de seguridad que queda pendiente en todo el programa** y ya no requiere
diseño: el candado está escrito, probado y en verde. Son las 16 pantallas de IA clínica pasando de
«¿tiene plan?» a «¿tiene plan **y** es quien debe?». Un lote corto.

**Si prefiere no decidir todavía: E1-02 (reintento, no reimplementación).** Sigue siendo la más
barata y la que desatasca más. El código ya está escrito, en disco y en verde; lo que falta es
**software, no criterio médico**:

1. Un test que **derive** las abreviaturas de laboratorio desde la fuente real de su app, para que
   «aquí no hay nada inventado» lo compruebe una máquina y no un comentario.
2. Retirar —o darles fuente— a los cuatro sinónimos de signos vitales sin respaldo.
3. Formular la pregunta de la glucosa capilar y **detenerse ahí**: es criterio suyo.

**Por qué ésta y no otra:** **E1-03** (proyectar todo su expediente actual a hechos clínicos) es la
siguiente pieza grande de la columna vertebral y **depende de E1-02**. Mientras E1-02 siga a medias,
la rama E1 entera está clavada.

**Si prefiere terreno nuevo:** **E4-01 · Contrato del Safety Kernel** (riesgo medio, sin
dependencias pendientes). Su aceptación —*«el motor de seguridad se puede invocar sin la IA y su
veredicto es un valor, no un texto»*— se agota **dentro** del módulo.

**De las cuatro unidades de riesgo alto de E0, ya sólo queda una sin empezar: E0-13 (cobros de
Stripe).** E0-12 acaba de cerrarse, y no se toca sin plan aprobado por usted.

---

## Esperando decisión del médico

### 9. 🆕 El sello de las notas firmadas (E0-12)

**Ninguna de las dos bloquea nada** — la unidad quedó **cerrada** sin ellas. Son las dos únicas
piezas de este trabajo que no se pueden deducir del código, así que no las decidí yo.

**a. Para las notas que YA firmó: ¿quiere una «constancia de estado observado»?** Aquí está el
problema, sin adornos. Sus notas viejas se sellaron con el sello corto. **No se puede arreglar hacia
atrás**, y no por falta de ganas: un sello afirma «éste era el contenido **en el momento de la
firma**». Si hoy le recalculo el sello a una nota que firmó en mayo, lo que ese número afirmaría es
«éste es el contenido **hoy**» — y si alguien la hubiera alterado en junio, **el sello nuevo
bendeciría la alteración** y borraría la única prueba de que ocurrió. Eso es fabricar evidencia, y no
lo voy a hacer. Lo que **sí** se puede es distinto y honesto: guardar aparte, y **con esa etiqueta
literal**, un «hash del estado observado el día tal» — que no sirve para el pasado, pero **detecta
cualquier alteración a partir de hoy** en las notas viejas. *Mientras no responda:* las notas viejas
siguen verificándose con su propio sello (nada se rompió) y la pantalla ahora **le dice qué cubre y
qué no**, en vez de decir sólo «verificada».

**b. ¿Extiendo el sello de la firma para que cubra su nombre y su cédula?** Hoy hay dos sellos: el
del **contenido** (que a partir de esta unidad cubre toda la nota) y el de la **firma**, que se
calcula sólo con la nota, su identificador de usuario y la hora. Consecuencia real: el bloque de
firma —nombre, cédula, especialidad, la imagen— no está dentro de ese segundo sello. Está
**parcialmente cubierto por rebote**, porque el sello del contenido ya sella su cédula y su
establecimiento, así que un cambio en el bloque de firma **se delata por contradicción** con lo que
el contenido afirma. Cerrarlo del todo es un cambio pequeño, pero cae **dentro del flujo de firma y
de la impresión**, que es exactamente donde la carta operativa manda entregar el plan antes de
tocar. *Se lo entrego como plan; usted dice cuándo.*


### 8. La prueba de que una clínica no ve a otra (E0-08)

Ninguna de las dos es criterio clínico. La primera es un sí/no de un minuto y es la que **cierra la
unidad**.

**a. ⚠️ ¿Instalo Java en su máquina para poder correr aquí la prueba de aislamiento, o la
demostramos sólo en GitHub?** El simulador de la base de datos de Google es un programa de Java y
esta máquina no lo tiene. Son dos caminos:

- **(a) «Instala Java».** Un comando (`brew install --cask temurin`), y en la siguiente corrida los
  1 120 intentos de robo se ejecutan de verdad, se corren también los tres sabotajes que faltan y
  **E0-08 queda cerrada** con la frase demostrada. *Es un cambio en su computadora, y por eso no lo
  hago sin su permiso.*
- **(b) «Sólo en GitHub».** Ya quedó configurado un trabajo automático que instala Java y corre la
  prueba **en los servidores de GitHub** en cuanto se abra el primer Pull Request. No toca su
  máquina; simplemente la respuesta llega cuando eso pase.

*Mientras no responda:* el software está escrito, en verde y no molesta a nada — pero la unidad
sigue marcada como **«falta ejecutarla»**, a propósito.

**b. Informativo, no pregunta: el control de calidad automático (CI) tarda un poco más.** Para poder
levantar el simulador hay que instalar las herramientas de Firebase, que traen **487 paquetes de
desarrollo**. Consecuencia: el CI tarda unos minutos más. Lo que **no** cambia: nada de eso viaja a
su app ni a sus pacientes —son herramientas de taller, no piezas del producto—. La alternativa era
descargarlas al vuelo cada vez, sin dejar constancia de qué versión se usó, y eso rompía la
reproducibilidad (mañana la prueba podría estar examinando otra cosa sin que nadie se enterara).
*Queda aplicado así; si prefiere lo contrario, se revierte.*

### 7. Quién puede *hacer* qué (E0-07)

Ninguna es criterio médico: son decisiones de **cómo trabaja su consultorio**. Mientras no
responda, **todo sigue funcionando exactamente igual que hoy** — nadie pierde acceso a nada.

**a. ⚠️ ¿La enfermería de su UCI dicta y usa el copiloto, o sólo usted?** Es **la más importante de
toda esta lista.** Hoy las 16 pantallas de IA clínica comprueban su **plan** pero no el **puesto**:
una cuenta de laboratorio o de farmacia puede mandar un audio y recibir **una nota clínica
redactada** —el mismo dato que la base de datos le niega a esa cuenta. Si me dice **«sólo el
médico»**, el hueco se cierra en un lote corto y sin riesgo. Si me dice **«la enfermería también
dicta»**, necesita su propio permiso y lo escribo. *Lo que no voy a hacer es adivinarlo.*

**b. ¿Enfermería, farmacia y laboratorio deben poder ver la lista de correos de su equipo?**
**Hoy pueden.** No es PHI, pero tampoco es su trabajo.

**c. ¿Su asistente descarga las facturas (CFDI), o sólo cobra?** Hoy las descarga. Determina si
«facturar» y «cobrar» son dos permisos separados de verdad.

**d. En un consultorio de un solo médico —el suyo—, ¿el puesto «médico» debe seguir tocando la
suscripción de Stripe, las llaves de IA y el alta de WhatsApp?** Hoy sí, y **se dejó así a
propósito**: quitárselo le rompería su propia cuenta mañana. Si prefiere que sólo «administrador»
toque el dinero, es un cambio de una línea.

**e. 🆕 ¿Su asistente entra a la sala de teleconsulta, o sólo usted y el paciente?** El diseño daba
por hecho que apretar esta puerta no molestaba a nadie y **no era cierto**: dejaría fuera al
mostrador. Por eso **no se tocó**. Sí se le escribió una prueba que protege lo delicado de esa
pantalla: que el enlace del paciente se compruebe **primero**, y que cuando nada autoriza el sistema
responda «esa cita no existe» en vez de «no tienes permiso» — porque lo segundo confirmaría que la
cita existe.

**f. 🆕 ¿Enfermería, farmacia y laboratorio necesitan agendar citas, mandar WhatsApp o ver los
pagos?** Ésta gobierna **seis** puertas de golpe. Y es la de consecuencias más visibles: si aprieto
la de citas y alguien la usaba, esa persona **deja de poder agendar** y usted lo va a leer como «la
app se rompió». La de la lista de espera es peor: cortaría confirmaciones de cita.

### 6. Quién ve qué (E0-06)

**a. ⚠️ ¿Su asistente puede *capturar* alergias y antecedentes en el alta, aunque después no pueda
verlos?** Hoy los captura: el formulario de alta de pacientes tiene el campo «Alergias» y el de
«Notas». Cumplir al pie de la letra «recepción no ve las alergias» se lo quita. Tres caminos:

- **(a) No puede.** Las captura usted en la consulta. Es la única que cumple la regla al pie de la
  letra. *Riesgo real:* que en el alta no las capture nadie.
- **(b) Puede escribirlas pero no leerlas.** Técnicamente se puede. Raro de usar: escribe a ciegas
  y no puede corregir ni siquiera lo que ella misma acaba de poner.
- **(c) Puede alergias, no antecedentes ni valoración.** Dos carpetas separadas.

*Mi recomendación:* **(a)**. Pero es su consultorio y su flujo de trabajo, no una decisión técnica.
**Sin su respuesta, las alergias se quedan donde están** y su asistente las sigue viendo.

**b. Aviso, no pregunta: el enlace del portal que manda su asistente ya no abre «Mis recetas».**
Ya está aplicado, porque era el agujero grave. El paciente que reciba ese enlace verá sus citas y
un aviso: «Este enlace sirve para tus citas. Pide a tu médico el acceso a tus recetas». Los enlaces
de 30 días **ya enviados** también pierden esa pestaña. Si prefiere que siga como antes, se
revierte en una línea — pero entonces vuelve a existir la llave de 30 días con secreto médico en
manos del mostrador.

**c. Las etiquetas «embarazo», «crónico» y «alto riesgo» del paciente: ¿administrativas o
clínicas?** Hoy las ve todo el equipo y las usa la agenda. «Embarazo» es un dato de salud.
Moverlas cambia listados que su asistente usa a diario. *Mientras tanto:* se quedan donde están y
está anotado como residual aceptado.

**d. Informativo:** el **motivo de la cita** es un dato de salud y su recepción lo lee — es
inevitable, porque agendar exige saber a qué viene el paciente. Queda documentado como residual
aceptado, no se cambia.

**e. Cuando decida (a), (b) o (c), hay que desplegar las reglas.** El candado de la carpeta nueva
está escrito en el repositorio pero **no está en producción**. Hoy da igual (esa carpeta aún está
vacía), pero tiene que desplegarse **antes** de mudar las alergias.

### 5. La migración de unidades (E0-05)

**a. ⚠️ Visto bueno para desplegar el arreglo de la tarjeta de riesgo cardiovascular.** Es el único
cambio visible de toda la unidad. Con una creatinina fuera del rango posible en mg/dL, la tarjeta
«PREVENT-ASCVD a 10 años» **deja de mostrarse** y en su lugar se dice qué dato falta. Antes se
mostraba un porcentaje calculado sobre una función renal fantasma. Va en la dirección segura, pero
**cambia lo que usted ve en pantalla**, y por eso no se despliega sin su sí.

**b. Etiqueta oficial del bicarbonato: ¿mEq/L o mmol/L?** Su app decía las dos cosas en sitios
distintos (el registro de motores decía mEq/L, el comentario del código decía mmol/L). **El número
es idéntico** —sodio, cloro y bicarbonato son iones de una sola carga—, pero la etiqueta que se
imprime en la nota no. *Mientras tanto:* se adoptó **mEq/L**, por coherencia con el sodio y el
cloro de su propio catálogo de laboratorio. Cambiarlo es una línea.

**c. Ajuste renal cuando NO hay peso capturado: ¿(a) seguir igual, (b) que la alerta diga de dónde
sale la depuración, o (c) no alertar sin peso?** Sin peso, la app usa la **TFG indexada**
(mL/min/1.73 m²) y la compara contra umbrales que las fichas técnicas expresan en **mL/min**. Es
lo que ya hacía y **E0-05 no lo cambió**; su propia regla de la enoxaparina ya advierte del punto.
Lo nuevo es que ahora el código **declara** de dónde viene el número, así que su decisión se puede
aplicar sin tocar ninguna fórmula.

**d. ¿Qué otros análisis llevan conversión masa↔sustancia?** (glucosa, urea/BUN, bilirrubina,
calcio). Hoy sólo hay creatinina y colesterol, que ya existían en su app. Para el resto la
conversión **devuelve «no sé»**, que es el comportamiento seguro. Cada uno exige su fuente citada.
*(Es la misma pregunta que quedó de E0-04.)*

### 1. El diccionario de conceptos (E1-02)

Ninguna bloquea el resto del programa. En todas quedó aplicado el comportamiento **más
conservador**, nunca un valor inventado.

**a. ¿Le pongo códigos internacionales (LOINC) a los análisis de laboratorio?** Los signos vitales
ya los tienen en su app y se reutilizaron tal cual; los 24 análisis no tienen ninguno y **no los
elijo yo**. O me da la tabla validada, o me dice «publícalo sin códigos de laboratorio».
*Mientras tanto:* van vacíos, con un candado que impide rellenarlos a ojo.

**b. «PCR»: ¿proteína C reactiva o reacción en cadena de la polimerasa?** Hoy su app lo interpreta
**siempre** como proteína C reactiva. *Mientras tanto:* «PCR» a secas **pregunta**; escrito
completo, funciona.

**c. ¿Qué abreviaturas quiere que se entiendan solas?** Hoy funcionan **Na, K, Cl, FA, Glu, ALP,
A1c, BUN, Hto, Hct, TSH** y **Cr**. ¿Sobra alguna? ¿Falta alguna suya (**BH, QS, ES, TP, TTP**)?

**d. ¿«Creatinina» a secas es la de sangre?** Su app ya lo daba por hecho; ahora está escrito y
protegido. Confírmelo: fija el significado de todas las gráficas futuras.

**e. ⚠️ ¿Autorizo la reparación de la «Vitamina K»?** Exigir el nombre completo para las
abreviaturas de 1-3 letras. ~6 líneas más su prueba de regresión. **Toca una pantalla viva**, por
eso pregunto. *Este error sigue vivo en producción.*

**f. ¿«Glucosa capilar» y «glucosa sérica» son dos cosas distintas** (glucometría de dedo vs
laboratorio) **o la misma con distinto origen?** El diccionario ya las separa, y **esa separación
la decidió el software, no usted**. Fija cómo se agruparán todas sus gráficas de glucosa.

**g. ¿Acepta como sinónimos `pulso` (FC), `bmi` (IMC), `dextrostix` y `glucosa capilar`?**
Ninguno tiene respaldo en el código de su app; los demás sí. Si no los firma, se retiran.

### 2. Seguridad, despliegue y alcance

**a. ⚠️ Lo urgente no es una decisión, es un despliegue.** El arreglo del clickjacking (22
pantallas) está en el código y **no en producción**. No exige apretar la política de seguridad:
basta con desplegar. **Al desplegar, suba la versión del Service Worker.**
*Nota de hoy:* en ese mismo despliegue entra también el cierre del enlace del portal (6.b) y, si
usted quiere, las reglas de la carpeta clínica (6.e).

**b. El conversor de PDF a imagen se descarga de un servidor ajeno (`unpkg.com`)** cada vez que
usted sube un laboratorio. Se puede guardar una copia dentro de la app. ¿Lo hacemos?

**c. ¿Sigue usando el Pixel de Meta y el alta de WhatsApp desde Configuración?** Si está apagado,
quito los permisos de Facebook. Es un sí/no.

**d. ¿Aprieto la política de seguridad a modo bloqueo?** **Mi recomendación: todavía no** — antes
hace falta (e), y antes hay que **observar los reportes** con la app ya desplegada.

**e. ¿Creamos un usuario de prueba con datos INVENTADOS?** Hoy **ninguna** prueba automática entra
a la zona con sesión: ni expediente, ni nota, ni receta, ni farmacia. Es el punto ciego más grande
del proyecto, y es lo que impide cerrar E0-10.

**f. ¿Conecto la búsqueda por partes (E2-02) a sus dos pantallas de evidencia?** Es lo único que
falta para que esa unidad signifique algo. **Cambia qué artículos ve usted**, así que iría con
pruebas que congelen antes el comportamiento actual. Además: **ninguna unidad del plan es dueña de
ese trabajo** — hay que decidir si es E2-02 ampliada o una unidad nueva.

### 3. El grafo no puede expresar 14 de los 35 datos que necesita *(bloquea E1-03)*

Está **medido** y fijado con un test. Al catálogo de unidades le faltan las más cotidianas: **lpm,
rpm, °C, cm, kg/m² y «puntos»** (Glasgow, dolor), y de laboratorio **U/L**, **10³/µL** y
**µUI/mL**. La tensión «120/80» son **dos datos, no uno**. Hoy el comportamiento ya es seguro: un
dato con unidad desconocida **se rechaza ruidosamente**, no se guarda a medias. Añadir °C obliga a
reescribir un candado que E0-04 puso a propósito («°C↔°F no es un factor, es una fórmula»).

*Nota:* E0-05 añadió **U/mL** (para la vasopresina de la UCI). Va en dimensión aparte:
las «unidades internacionales» miden actividad biológica y su equivalencia en miligramos depende
del fármaco, así que **nunca se convierten solas**.

### 4. Lo que sigue esperándole de corridas anteriores

| | Qué | Unidad |
|---|---|---|
| ⚠️ | **Un sí/no:** ¿instalo Java para correr aquí la prueba de aislamiento, o se demuestra en GitHub? | **E0-08** (8.a) |
| ⚠️ | **Una frase suya:** ¿la enfermería de su UCI dicta, o sólo usted? Cierra el hueco de la IA | **E0-07** (7.a) |
| ⚠️ | Activar protección de rama en `main` (`clinical-safety` + `verificar`) — 5 minutos en GitHub | E0-11 |
| ⚠️ | Confirmar que `docrod29-ai` es su handle real y activar «Require review from Code Owners» | E0-11 |
| 🔴 | **Una línea suya:** ¿los signos vitales pasan de «corregir en el sitio» a «anexar corrección»? | E0-09 (bloqueada) |
| | Las otras 4 preguntas del registro append-only (quién corrige, ventana de tiempo, motivo obligatorio, NEWS2) | E0-09 |
| | ¿Se amplía el catálogo adulto de dosis con los 20 fármacos que faltan? (usted lo aprobó; falta su tabla) | E0-02 |
| | ¿El pie IMPRESO de la receta debe leerse de la firma de la nota en vez de la config de la clínica? | E0-01 |
| | ¿Se construye el servicio de firmado en servidor (REG-014)? | E0-14 |
| | En la búsqueda de evidencia: el fármaco que ya toma el paciente, ¿es la intervención o parte de la población? ¿quiere bandas de edad? | E2-02 |

---

## Deuda técnica anotada (para no perderla)

- **🆕 Quedan 26 puertas que en EJECUCIÓN siguen siendo «cualquiera del consultorio».** Ya están
  todas **declaradas** con el permiso que les corresponde y con la pregunta que falta escrita al
  lado, así que ninguna es un descuido silencioso — pero declarar no es aplicar. Se activan con las
  decisiones 7.a a 7.f.
- **🆕 El puesto de cada persona ya admite 8 valores en el tipo, pero sólo 6 se pueden asignar
  desde la app** («recepción» y «facturación» existen en la matriz y nadie los puede tener). Es lo
  que hace que ampliar un permiso hacia ellos **no le dé acceso a nadie real**, y hay una prueba que
  lo vigila. Sigue esperando la decisión de E0-06 sobre si se activan o se borran.
- **Las alergias, los antecedentes y la valoración del inmunocomprometido siguen guardados
  dentro de la ficha del paciente.** Mientras sigan ahí, cualquier miembro del consultorio los lee,
  y ninguna regla de permisos puede impedirlo. La mudanza está diseñada, con su candado escrito y
  su lista de campos fijada por una prueba; espera la decisión 6.a.
- **🆕 La prueba que empuja la puerta ya existe, pero nunca se ha ejecutado.** E0-08 dejó escrita la
  suite que le pregunta a la base de datos de verdad (1 120 intentos cross-tenant + 8 controles al
  revés) y el trabajo automático de GitHub que la corre. Falta la primera ejecución: hace falta Java
  → **decisión 8.a**. Hasta entonces, el aislamiento entre clínicas sigue estando **argumentado**,
  no **demostrado**.
- **🆕 Lo que la prueba de aislamiento NO cubre, para que un verde futuro no se lea de más:** los
  permisos **campo por campo** (que una nota firmada no se pueda editar, que la facturación quede
  congelada) son la unidad E0-09; los permisos de los **archivos** (fotos, PDFs) necesitan su propio
  simulador y quedan fuera; y las rutas del servidor **no pasan por estas reglas** por diseño — ésas
  las cubre otra prueba distinta.
- **🆕 487 paquetes de desarrollo nuevos, con 32 avisos de seguridad conocidos.** Vienen todos del
  árbol de las herramientas de Firebase. Son **de taller**: no viajan a su app ni al servidor.
  Anotado a propósito y no «arreglado», porque arreglarlos significa cambiar de versión mayor unas
  herramientas que no tienen nada que ver con el trabajo de esta unidad.
- **🆕 El sello de la FIRMA no cubre su nombre ni su cédula.** Son dos sellos distintos: el del
  contenido (que desde E0-12 cubre toda la nota) y el de la firma, que se calcula con la nota, el
  identificador de usuario y la hora. El bloque de firma queda cubierto **por rebote** —el sello del
  contenido ya lleva su cédula y su establecimiento, así que un cambio ahí se delata por
  contradicción— pero no por el hash. Cerrarlo entra al flujo de firma y a la impresión →
  **decisión 9.b**.
- **🆕 `hospital` e `infectologia` entraron al sello sin que hoy los escriba nadie.** Los tipos
  existen y ningún camino de producción los llena todavía. Sellarlos ahora es blindaje **preventivo**
  (para que no nazcan fuera del sello el día que el módulo hospitalario los escriba), probado con
  datos ficticios y no contra un flujo real.
- **🆕 Las notas más antiguas (sello versión 1) siguen sin poder re-verificarse.** No es cosa de
  E0-12: el algoritmo original dependía del orden en que la base de datos devolvía los campos, y ese
  orden no se conserva. Salen como «formato anterior», que **no** significa alteradas.
- **El motor de dosis no habla el idioma del principio 3** de sus decisiones clínicas: devuelve
  alertas, no `PASS | WARN | BLOCK | UNKNOWN | N/A`. Funciona, pero hay que migrarlo. *(E0-05 ya le
  cambió la entrada; la salida sigue igual.)*
- **El rango habitual de cada fármaco de infusión sigue siendo un par de números sin unidad.**
  Se dejó fuera de E0-05 a propósito: tiparlo multiplica el catálogo entero sin cerrar ningún hueco
  nuevo, porque la dosis ya llega con su unidad. Candidato a «E0-05-bis».
- **Las fórmulas siguen usando números pelados POR DENTRO.** El tipo protege la entrada y la
  salida de cada motor, no los pasos intermedios: `mL/h = dosis × peso × 60 ÷ concentración` sigue
  siendo aritmética suelta. Blindarlo exige álgebra de dimensiones derivadas, que es otra unidad.
- **La política de seguridad sigue permitiendo `unsafe-inline`/`unsafe-eval`.** Quitarlo exige
  firmar cada script en cada petición; su riesgo típico es *pantalla en blanco*. Unidad aparte.
- **`RETOMAR-AQUI.md` está viejo.** La fuente de verdad son `estado.json` y este archivo.
- **Los comentarios que afirman cobertura no valen; el test que la deriva de la fuente, sí.** Es la
  lección de la invención de `Hb`/`BT`, ya aplicada en el vocabulario.
