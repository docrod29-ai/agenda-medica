# Nexus OS — dónde vamos

> **En 30 segundos.** Van **9 de 68** unidades cerradas. Hoy se trabajó **E0-06**, los permisos de
> acceso, y hay que decir dos cosas con claridad:
> **(1) Se encontró y se cerró un agujero real:** cuando su asistente pulsaba «mandar el enlace del
> portal por WhatsApp», el sistema le entregaba a ella —en su navegador— una llave válida **30 días**
> que abría **los diagnósticos y los medicamentos de todas las recetas firmadas** de ese paciente.
> Ese enlace ya sólo sirve para las citas; para las recetas hace falta un enlace emitido por usted.
> **(2) La otra mitad no se pudo terminar, y no por falta de trabajo:** «que recepción no vea las
> alergias» **es imposible con reglas de permisos** — las alergias están guardadas *dentro* de la
> ficha del paciente, y esa ficha su asistente **tiene** que poder abrirla para agendar. Firestore
> no sabe ocultar campos sueltos: o abre la ficha entera o no la abre. Hay que **mudar** las
> alergias de sitio, y eso cambia el alta de pacientes que ella usa a diario → **decisión 6.a**.
> **Lo siguiente: E1-02** (reintento barato, el código ya está escrito).
> **Sigue pendiente lo de siempre:** el despliegue de seguridad *(decisión 2.a)* y el error de la
> **«Vitamina K»**, vivo en producción *(decisión 1.e)*.

Última corrida: `2026-07-29T13:12:00Z`. `tsc` verde · **2445 tests verdes** (190 archivos) ·
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
| **E0-06** | **Recepción no debe ver el expediente** | 🟡 **hoy** — agujero de la API cerrado; mudar las alergias espera **una decisión suya** |
| E0-10 | Iframes bloqueados en sus pantallas · interruptor de seguridad | 🔴 espera **un despliegue suyo** |
| E1-02 | «Creatinina», «Cr» y «creatinina sérica» son el mismo dato | 🔴 falta 1 test + sus respuestas |
| E2-02 | La búsqueda de evidencia se arma por partes, no con una frase suelta | 🔴 **el módulo no lo usa nadie** |
| E0-11 | El CI protege los invariantes clínicos | 🟡 código listo — espera 5 min suyos en GitHub |
| E0-09 | El registro del hospital no se edita: se corrige anexando | 🟡 bloqueada — espera 1 línea suya |

**9 cerradas · 6 esperándole · 53 sin empezar.**

---

## Qué pasó hoy: E0-06, en español

**La pregunta que había que responder era una sola:** *«su recepcionista puede ver la cita, pero
¿puede ver la nota y las alergias?»*. Se probó contra el sistema real y salieron **tres respuestas
distintas**, no una.

**1. La nota: no la ve. Nunca la vio.** Las notas, los laboratorios y las fotos clínicas ya estaban
cerradas a médico/administrador desde hace versiones. Lo que faltaba era que eso **no se pudiera
aflojar por descuido**: ahora hay una prueba que se pone roja si alguien toca esas tres puertas.

**2. La API: sí lo veía, y ése era el agujero grave.** Cuando su asistente pedía el enlace del
portal del paciente para mandárselo por WhatsApp, el servidor le devolvía **a ella** una llave
firmada, válida **30 días**, que también abría la pestaña «Mis recetas» — es decir, **diagnóstico y
medicamentos de cada nota que usted firmó**. Ella nunca vio esa pantalla, pero la llave la tenía.
Es exactamente el mismo hueco que ya se había tapado en el enlace de teleconsulta y que aquí seguía
abierto.
**Ya está cerrado, y sin quitarle trabajo a ella:** el enlace que ella manda sigue sirviendo para
confirmar, cancelar y reagendar citas; simplemente ya no abre las recetas. Los enlaces que emite
usted (teleconsulta) sí las abren.

**3. Las alergias: sí las ve, y no se puede arreglar con permisos.** Esto es lo importante y
conviene decirlo sin rodeos. Las alergias, los antecedentes y la valoración del inmunocomprometido
**no están en una carpeta aparte: son campos escritos dentro de la ficha del paciente**, la misma
ficha que su asistente necesita abrir para saber cómo se llama y a qué teléfono le habla. La base
de datos **no sabe entregar media ficha**: o la entrega completa o no la entrega. Por eso ninguna
regla de permisos —por bien escrita que esté— puede cumplir esto. **Hay que mover las alergias a
una carpeta propia**, y ese movimiento toca el formulario de alta de pacientes que ella usa todos
los días. Por eso se detuvo aquí y se le pregunta: **decisión 6.a**.

**Lo que sí quedó listo para ese día:** la carpeta nueva ya tiene su candado escrito (sólo médico),
la lista exacta de qué campos hay que mudar está fijada por una prueba, y —lo más importante— quedó
blindado el error que este sistema **ya cometió una vez**: que la ausencia de un dato se imprima
como una afirmación. Si mañana la lectura de las alergias falla, el papel **no** puede decir
«Negadas»; decir «no lo sé» y decir «el paciente no tiene» no son la misma frase.

**Además, un mapa que no existía.** Se levantó el inventario completo: **las 44 colecciones de
datos** de su sistema, cada una clasificada (administrativa · clínica · financiera · identidad
profesional) con quién la puede leer y quién la puede escribir, y **el porqué de cada una**. No es
un documento que se quede viejo: hay una prueba que falla si alguien añade una colección nueva y no
la clasifica, y otra que falla si el documento publicado deja de coincidir con el sistema real.

---

## 👉 Lo siguiente: **E1-02 (reintento, no reimplementación)**

**Sigue siendo la más barata y la que desatasca más.** El código ya está escrito, en disco y en
verde; lo que falta es **software, no criterio médico**:

1. Un test que **derive** las abreviaturas de laboratorio desde la fuente real de su app, para que
   «aquí no hay nada inventado» lo compruebe una máquina y no un comentario.
2. Retirar —o darles fuente— a los cuatro sinónimos de signos vitales sin respaldo.
3. Formular la pregunta de la glucosa capilar y **detenerse ahí**: es criterio suyo.

**Por qué ésta y no otra:** **E1-03** (proyectar todo su expediente actual a hechos clínicos) es la
siguiente pieza grande de la columna vertebral y **depende de E1-02**. Mientras E1-02 siga a
medias, la rama E1 entera está clavada.

**Si prefiere terreno nuevo:** **E4-01 · Contrato del Safety Kernel** (riesgo medio, sin
dependencias pendientes). Su aceptación —*«el motor de seguridad se puede invocar sin la IA y su
veredicto es un valor, no un texto»*— se agota **dentro** del módulo.

**Lo que NO se toca sin plan aprobado por usted:** de las cuatro unidades de riesgo **alto** de E0
quedan dos sin empezar: **E0-12** (sellos de integridad) y **E0-13** (cobros de Stripe).

---

## Esperando decisión del médico

### 6. 🆕 Quién ve qué (E0-06)

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

- **🆕 Las alergias, los antecedentes y la valoración del inmunocomprometido siguen guardados
  dentro de la ficha del paciente.** Mientras sigan ahí, cualquier miembro del consultorio los lee,
  y ninguna regla de permisos puede impedirlo. La mudanza está diseñada, con su candado escrito y
  su lista de campos fijada por una prueba; espera la decisión 6.a.
- **🆕 Las reglas de permisos se prueban leyendo el archivo, no ejecutándolo.** No hay emulador de
  base de datos en el proyecto: se afirma qué dice el archivo de reglas, no qué haría la base ante
  una petición real. Eso es la unidad **E0-08**, que ahora tiene la matriz de acceso como tabla de
  casos lista para usar.
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
