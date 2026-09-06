# De qué se enferma este sistema

**Formato**: §H7 del charter Master Loop V7 — cada defecto se convierte en
aprendizaje permanente.
**Abierto**: 6-ago-2026. **Actualizado**: 5-sep-2026.
**Fuente**: los REG de `docs/audit/regression-ledger.md` (309 clasificados hoy).

> La tabla de «El resultado» es la foto del conteo del 6-ago y se conserva como
> acta. Los números vivos salen de `src/lib/calidad/familias-de-defecto.ts`, que
> es lo que el guardián compara.

---

## Por qué contar

El ledger tiene 85 defectos con su causa raíz. Leídos de uno en uno son 85
historias. **Contados por familia dicen algo que ninguno dice solo**: cuál es la
forma de fallar que se repite.

Eso cambia dónde conviene mirar mañana.

---

## El resultado

| Familia | Casos | Qué tienen en común |
|---|---:|---|
| **Escrito, probado y sin conectar** | **84** | El módulo existe, tiene pruebas y está bien. Simplemente **no corre** en el camino que el médico recorre — o corre con una entrada incompleta |
| **El sistema se contradice a sí mismo** | **45** | Dos partes afirman cosas incompatibles y **ninguna está mal por su cuenta**. El fallo vive en el hueco entre las dos |
| El habla real no cabía en el motor | 18 | El motor cubre el español que uno *escribiría*, no el que se *habla* en un consultorio mexicano |
| Nadie lo estaba midiendo | 49 | No es un defecto del producto: es la ausencia del instrumento que lo habría delatado |
| El hueco tratado como dato | 13 | Lo que nadie dijo se guarda como si alguien lo hubiera dicho |
| Fuga entre consultorios y dinero | 8 | Un dato o un cobro cruza la frontera de su dueño |
| El charter existía sin encarnar | 10 | Una sección del charter que vivía como carpeta vacía |
| Estorba al médico | 9 | Correcto por dentro, insoportable por fuera |
| Pérdida de datos | 20 | Trabajo del médico que desaparece o reaparece solo |
| Llega tarde para servir | 2 | El aviso es correcto y aparece **después** del momento en que habría servido |
| El mensaje mentía sobre la causa | 8 | Falla algo y el sistema culpa a otra cosa |
| *Decisión del médico dueño, no defecto* | 4 | Cambiaron el comportamiento, pero nada estaba roto |
| Al modelo de datos le faltaba un eje | 3 | El dato se guardaba entero y correcto, pero sin la distinción que lo hace utilizable |

---

## Lo que dice el número grande

**«Escrito, probado y sin conectar» — 85 de 309, y el 7-ago-2026 volvió a ser la
familia más grande.**

Los tres últimos (REG-425, 426 y 427, 1-sep-2026) salieron de **abrir el producto
en un teléfono**, y los tres son la familia en formas distintas: el gancho
escrito y la regla no (`className="nx-fila-porque"`, una clase que no existía en
ninguna hoja, y el toque del control se lo quedaba el velo de la fila); el
respaldo que no cabe donde está escrito (`100vh` en un estilo EN LÍNEA no puede
llevar su `100dvh` detrás); y la **condición previa** que falta (28 usos de
`env(safe-area-inset-*)` corriendo y valiendo cero porque `viewport-fit=cover`
era una línea en otro archivo que nadie vigilaba).

Lo que enseñan juntos: **esta familia no se caza leyendo el diff de quien la
comete.** Los tres diffs se ven bien. Se caza abriendo el producto y
preguntándole al navegador — `document.elementFromPoint` en el centro del control
es la única pregunta que responde «¿esto recibe el toque?».

El miembro más reciente es **REG-335** (27-ago-2026), y es la familia
describiendo su propia forma. `PaqueteDeVisita` llegó con su modelo, su máquina
de estados `DRAFT`/`RELEASED`, su compuerta en el servidor, la acción del portal
que la usa, las reglas de Firestore, la matriz de acceso, el manifiesto del
respaldo y la exportación ARCO. Todo escrito. Todo probado. Y **ningún camino
del producto escribía jamás un documento en esa colección**, porque la función
que lo componía se había borrado el mismo día por no tener llamador.

No faltaba una pantalla: faltaba el **acto**. Nada podía pasar de `DRAFT` a
`RELEASED` porque no existía ninguna superficie con autoridad para hacerlo, y
mientras tanto la hoja que sí se componía salía del borrador EN CURSO y no
llegaba al paciente por ningún camino. Es el coste entero de esta familia en un
solo defecto: la pieza mejor pensada del lado del paciente, terminada y sin
entregar.

Antes que él, **REG-320** (15-ago-2026), y lo encontró un banco de
flujos haciendo el trabajo del médico en el teléfono: el respaldo local de la
nota se escribía, se conservaba en disco y **no se ofrecía nunca** al reabrir
una nota por `?nota=`, porque la única condición capaz de enseñarlo probaba que
el formulario estuviera vacío — y al reabrir una nota nunca lo está. Escrito,
probado, en disco, y sin llegar a nadie.

Antes que él, **REG-316** (15-ago-2026) y lo trae desde un sitio
donde nadie la había buscado: **una hoja de estilos**. Cuatro líneas de prosa
fuera de un comentario dejaron muerta una regla de `globals.css` —la que aparta
los botones flotantes mientras el médico escribe— sin que el fuente lo
enseñara, sin que ninguna prueba se pusiera roja y con el aviso del propio
`npm run build` diciéndolo en una salida que nadie lee. Escrito, probado por
inspección visual, y **sin llegar al navegador**.

Antes que él, **REG-315** enseña la variante más
cara de la familia: no es que el módulo no corra en ningún sitio, es que **corre
en el sitio equivocado del tiempo**. `buscarPosiblesDuplicados` se consultaba
dentro del formulario de alta —cuando el médico ya decidió crear— y no en la
búsqueda, que es el momento anterior en que se hace exactamente la misma
pregunta. El módulo estaba conectado, probado y en producción; el minuto en que
habría evitado un expediente partido pasaba sin llamarlo.

La recuperó con dos casos del mismo día, y los dos son el patrón en estado puro.
REG-221: el eje que distingue «ya lo toma» de «se lo receto hoy» existía en el
tipo, en el esquema auditado, en el prompt y en una prueba SELLADA — y `z.object`
lo borraba en la lista plana antes de que saliera del servidor. La prueba pasaba
en verde porque comprobaba el esquema equivocado. REG-222: un aviso marcado
`no-print` desaparecía al Imprimir y salía impreso al descargar el PDF, porque
ese camino no es una impresión y nunca miró la marca.

Los dos tienen la misma forma: **la pieza estaba bien, y no corría donde tenía
que correr**.

## La que más creció de golpe

**«Pérdida de datos» — de 6 a 9 en un solo día**, con REG-294, REG-295 y
REG-297: los tres caminos por los que una consulta **ya grabada** desaparecía.

Y los tres tenían la misma causa de fondo, que es lo que merece quedar escrito:

> **Todo el esfuerzo de persistencia se puso donde YA había red.**

El texto de la nota tiene borrador en memoria, respaldo en `localStorage`,
autoguardado a Firestore cada 30 s y volcado al desmontar: **cuatro copias**. El
audio, que no tiene ninguna otra copia en ningún sitio, se quedó fuera de todas
esas defensas. Y cuando hubo que elegir entre proteger el texto y proteger el
audio —en la purga del cierre de sesión— se protegió el texto, con un comentario
que explicaba muy bien por qué.

No fue descuido: fue que **cada arreglo se hizo mirando el activo que ya se
sabía frágil**. Nadie preguntó cuál era el activo sin ninguna red.

La pregunta que deja esta familia, para la próxima vez que se refuerce algo:
**¿qué otra cosa se pierde en este mismo camino, y cuántas copias tiene?**

Adelantó a «escrito y sin conectar» con REG-217: la regla 15 del prompt ORDENABA
escribir «No referido» y la 1-bis lo PROHÍBE. **Ninguna de las dos estaba mal por
su cuenta** — y por eso ninguna revisión de una sola pieza lo encuentra. El fallo
vive en el hueco entre las dos, y vivió meses.

Lo que esto exige: **guardianes que comparen partes**, no que revisen piezas. Y
que su lista de frases prohibidas se amplíe cada vez que aparece una nueva — la
de REG-217 no se cazó porque «No referido» no estaba en ella.

## La segunda

**«El sistema se contradice a sí mismo» — 45 de 309.**

Sumó REG-377 (30-ago-2026), que enseña algo sobre las **deudas con fecha de
caducidad puesta**. Desde REG-199 el módulo del sello llevaba escrito que
`transcripcionMotor` —lo que oyó el reconocedor— **le correspondía ir sellado**,
por qué todavía no lo estaba y hasta cuándo entraría: «cuando se suba a
`hashVersion` 4». Mientras tanto el sello decía «verificada» de notas firmadas en
las que ese campo se podía alterar. Las dos partes eran correctas por su cuenta;
el defecto vivía en el hueco.

Escribirlo así la hizo barata de cerrar —el diseño ya estaba hecho— y a la vez la
dejó abierta **casi doscientos REG**, porque nada la ponía en rojo. Una deuda
declarada no es una deuda vigilada: lo que no tiene guardián no tiene fecha.

Antes REG-336 (27-ago-2026), y es la forma más cara que ha tomado esta familia:
la compuerta que deja **firmar** pedía `medicoId` y cédula; la que deja
**entregar al paciente** pedía nombre y cédula. Ninguna de las dos estaba mal
por su cuenta. En el hueco cabía una nota firmable e **inentregable**, y como
`nota.firma` es inmutable, irreparable: el paciente no recibía su hoja nunca y
el mensaje mandaba al médico a revisar la cédula, que sí estaba. Lo encontró el
Golden Path GP-FINAL recorriendo el consultorio en un navegador, con los 10 480
casos de la suite en verde — ninguna prueba de unidad podía verlo, porque el
defecto no estaba en ninguna de las dos piezas sino entre ellas.

Y antes REG-313 (14-ago-2026): la exportación del expediente lanzaba **dos
avisos que se contradecían sobre el mismo archivo** —«los borradores van
marcados como preliminares» y «los borradores NO van»—, y el falso era el
último en pintarse, o sea el que se leía. El médico creía que el archivo que
mandaba a otra institución no llevaba nada sin firmar; sí lo llevaba. El
guardián nuevo ata los dos lados: llama al exportador y exige que la pantalla
no prometa una exclusión que no ocurre.

Y antes REG-312: la ventana de clic ciego de la coreografía de continuidad —
lo que se PINTA (instantánea vieja) y lo que RECIBE el clic (DOM nuevo)
afirmaban cosas incompatibles durante el callback de la view transition, y
ninguna pieza estaba mal por su cuenta. Riesgo de paciente equivocado desde
una worklist; candado + tope 400ms + guardián probado al revés ×2.

Sumó REG-311: la séptima copia local de la negación de alergias — el ancla
nueva de V15 y la píldora de consulta afirmaban cosas incompatibles sobre el
mismo campo, contra la regla sellada de REG-279. El fallo vivía en el HUECO
entre la copia y el módulo que ya sabía la respuesta.

Sumó REG-223: `--nexus` se aclaró para servir de TEXTO (5,96 sobre el lienzo) y
se seguía usando de RELLENO bajo texto blanco, donde el requisito es el
contrario y daba 3,28. Ninguna de las dos decisiones estaba mal por su cuenta. Y
el tema CLARO nunca lo tuvo — la corrección existía, aplicada a un solo tema.

## El patrón que sostiene a las dos

**Nueve veces** el módulo estaba bien, sus pruebas pasaban, y el sistema fallaba
igual porque **el módulo no corría donde tenía que correr**:

Es exactamente el patrón que ya estaba anotado como el fallo más caro, ahora con
la cuenta detrás. Nueve veces el módulo estaba bien, sus pruebas pasaban, y el
sistema fallaba igual porque **el módulo no corría donde tenía que correr**:

- el motor de sobredosis corría *después* de firmar (REG-190)
- «Quitar de la nota» sacaba el dato de un metadato de auditoría, no de la nota
  (REG-198)
- los motores clínicos recibían la receta de hoy en vez del paciente entero
  (REG-188)
- el 80,6 % de las correcciones del médico se tiraba sin mirarlas (REG-169), y el
  bucle que debía aprender de ellas nunca había aprendido nada (REG-170)

**Lo que esto implica para las pruebas**: una prueba unitaria verde es
compatible con las nueve. Todas se cazan con pruebas que recorren **el camino**,
no la pieza — o buscando el símbolo antes de dar algo por entregado.

## Y por qué la segunda sigue importando
 Ninguna de las dos partes
está mal por separado; por eso ninguna revisión de una sola pieza lo encuentra.
Dos reglas del prompt que se anulan, un sello que afirma cubrirlo todo mientras
el propio módulo sabe que no, un número de versión con siete cambios sin moverse.

Es la familia que justifica los ADR y los guardianes de coherencia: **no hay
dónde poner una prueba que vigile una contradicción entre dos módulos, salvo un
tercero que compare**.

## Lo que dicen las dos rarezas

**«Nadie lo estaba midiendo» — 52 de 309**, y cada uno destapó otros al encenderse.
El WER, el foso de vocabulario, el arnés de alucinación: ninguno era un fallo del
producto: era la falta del instrumento.

**REG-331** (27-ago-2026) es esta familia dicha en voz alta: veintitrés defectos
de accesibilidad en las seis pantallas que ve el paciente, con 10 425 casos en
verde. No se rompió nada — es que ese eje no lo medía nadie. El instrumento
(`npm run a11y:paciente`) los encontró todos el día que se encendió, que es
exactamente lo que hace esta familia cada vez.

El miembro más reciente es **REG-421** (1-sep-2026), y es la versión más afilada:
ahí el instrumento **sí existía y corría en verde**. El guardián de índices se
saltaba con un `continue` las consultas que no sabía leer, y llevaba meses tapando
dos consultas vivas sin índice. No medir es un hueco; medir mal es un hueco que
además te dice que no lo hay. Se descubrió por la única vía que lo descubre:
probar el guardián **al revés** antes de fiarse de él.

**«Decisión del médico dueño» — 2**, contados aparte a propósito. Meterlos en el
saco de «defectos» inflaría la cuenta con cosas que nadie rompió.

---

## Lo que este conteo NO dice

**Sólo se cuentan los defectos encontrados**, y encontrar depende de dónde se
miró. Una familia pequeña puede serlo porque es rara o **porque nadie la busca**
— y las dos se ven idénticas desde aquí.

La sospechosa obvia es **fuga entre consultorios**: cuatro casos, los cuatro
hallados al auditar a propósito, ninguno en uso normal. Eso no significa que sea
rara; significa que sólo aparece cuando alguien la persigue. Es también uno de
los dos ceros que la [puerta de liberación](../evals/PUERTA-DE-LIBERACION.md)
declara **DÉBIL**.

---

## Cómo se mantiene honesto

`src/__tests__/de-que-se-enferma-este-sistema.test.ts` compara esta
clasificación contra el ledger y **falla si un REG no tiene familia**. En cuanto
aterrice el REG-220, esta prueba se pone roja hasta que alguien conteste «¿de qué
familia es éste?» — que es la pregunta que convierte un defecto en aprendizaje en
vez de en una entrada más.

También comprueba que ningún REG esté en dos familias (un defecto tiene una causa
raíz), que ninguna familia cite un REG inexistente, y que la advertencia de
arriba siga escrita.