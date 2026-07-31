# Nexus OS — dónde vamos

> **En 30 segundos.**
> **Van 9 de 68** unidades cerradas del todo. Hoy se cerró la parte de software de **E1-02**
> (que «creatinina», «Cr» y «creatinina sérica» sean **el mismo dato**), la tercera unidad que
> queda «cerrada en software, esperando a usted».
> Lo importante de hoy **no fue el catálogo: fue quitarle a este proyecto la costumbre de creerse
> sus propios comentarios**. La versión anterior de este vocabulario **decía por escrito** que no se
> había inventado ninguna abreviatura… y traía dos inventadas (`Hb` y `BT`). Ya se habían borrado;
> lo que faltaba era **el candado**. Ahora cada abreviatura del catálogo tiene que ser **confirmada
> por un motor que ya está en su app**, o ser el propio nombre del dato, o venir **citada con
> archivo y línea**. Si alguien mete una inventada, **el CI se pone rojo** — comprobado metiéndola
> a propósito cuatro veces.
> Y de paso apareció **un defecto real, viejo y medido, en la lectura de laboratorios**: al leer un
> panel, **«depuración de creatinina» se guarda como si fuera creatinina en sangre** (son unidades
> distintas: mL/min vs mg/dL). **No lo toqué** — arreglarlo cambia una gráfica que usted ya usa, y
> eso lo decide usted (`E1-02-Q5`).
> **LO ÚNICO QUE URGE DE USTED SIGUE SIENDO `E0-12-D3`.** Es una línea, y hasta que la conteste
> **nada de esta rama debe desplegarse**.
> **La siguiente unidad sigue siendo E0-12** (cerrar el falso «INTEGRIDAD ALTERADA»), porque es la
> de mayor riesgo. Con E1-02 cerrada, **E1-03 queda desatascada** por si prefiere avanzar.

Última corrida: `2026-07-30T05:43Z` · `tsc` verde (0 errores) ·
**2 833 tests verdes** (eran 2 809) · `build` verde · rama `nexus-os/sesion-2026-07-29` ·
`unidadEnCurso: null` (nada a medio hacer sin registrar).

---

## ⚠️ AVISO QUE SIGUE VIGENTE: la rama está pusheada y trae la regresión del sello

Este documento decía durante días **«nada desplegado, sin `push`»**. **La segunda mitad no es
cierta**: otra sesión —la de la receta (fecha de nacimiento + formulario corto)— **pusheó la
rama**, y con ella se fue el commit `3c09a0d`, **el que trae la regresión del sello de las notas**.

**Lo que se puede afirmar mirando el repositorio:**

- El commit `3c09a0d` (E0-12) está en la historia de esta rama.
- **`main` NO lo contiene.** El sello nuevo no está mergeado a la rama principal.
- `HASH_VERSION = 3` está en el árbol: **cualquier despliegue de esta rama hace que sus notas
  nuevas nazcan con el sello nuevo** — y con el falso «alterada».
- Subir el Service Worker es el **ritual de despliegue** de este repo, y su bitácora atribuye
  versiones a unidades de este mismo programa.

**Lo que NO puedo afirmar desde aquí:** si esas versiones **salieron a producción**. No despliego
ni consulto producción (regla 6).

**Lo que necesito de usted, y es un sí/no:** ¿el despliegue de v707/v708 salió de esta rama?
- **Si salió:** `E0-12-D3` deja de ser una decisión de merge y es **urgente**.
- **Si no salió:** `E0-12-D3` sigue siendo un bloqueo de merge, sin urgencia clínica.

---

## Lo que necesita su decisión, por urgencia

| # | Decisión | Por qué importa |
|---|---|---|
| **1** | **`E0-12-D3`.** El sello nuevo de sus notas marca «ALTERADA» una nota que **nadie alteró**. Tres arreglos posibles, los tres tocan cómo se guarda y se firma: **(a)** que al guardar se borre de verdad el campo que quedó vacío · **(b)** guardar la nota completa en vez de por partes · **(c)** guardar «vacío» explícito en vez de «no existe». | **Bloquea el despliegue de toda la rama.** Camino real, de un clic: usted dicta, el sistema autoguarda el dictado, usted **borra el texto del dictado** y firma → la nota sale con la alarma roja medicolegal sin que nadie la tocara. **Salida de emergencia si necesita mergear ya:** devolver el sello a la versión 2 (una línea) y dejar el nuevo congelado. |
| **2** | **`E0-07-Q1`** — ¿la enfermería de su UCI usa el copiloto y el dictado del expediente, o sólo el médico? | Es el hueco de seguridad más grande que queda abierto, y ahora es **lo único** que separa a E0-07 de estar cerrada del todo: hoy un miembro con rol `laboratorio` o `farmacia` puede pedirle al servidor una nota clínica redactada. El candado está escrito, probado y **atado al código**; falta que usted diga a quién deja fuera. Gobierna 16 puertas. |
| **3** | **`E1-02-Q5`** — ¿autorizo una unidad aparte que arregle la lectura de nombres de laboratorio? | Son **tres defectos medidos, vivos hoy** en la gráfica de sus pacientes: una fila «Vitamina K 10» se dibuja como **potasio 10** (valor letal); «**depuración de creatinina**» entra a la serie de **creatinina en sangre** (mL/min contra mg/dL); y «creatinina **urinaria**» también. El arreglo son ~8 líneas y un test, **pero cambia una gráfica que usted ya usa**, así que no se toca sin su palabra (regla 5). |
| **4** | **`E0-07-Q7`, `E0-07-Q6`, `E0-07-Q3`, `E0-07-Q4`, `E0-07-Q5`, `E0-07-Q2`** — quién agenda citas, quién manda WhatsApp, quién ve pagos, quién entra a la sala de teleconsulta, quién lista los correos del equipo, quién descarga CFDI. | Gobiernan las otras 12 puertas que hoy siguen abiertas a «cualquiera del consultorio». **Ninguna es criterio clínico**: es quién en su consultorio puede hacer qué. Un «no» mal puesto en `appointments` se lee como «la app se rompió», así que no se activa nada sin su palabra. |
| **5** | **`E0-08-Q2`** — ¿se instala Java en su Mac para correr **una vez** la prueba de aislamiento entre clínicas, o se demuestra en GitHub al abrir el primer PR? | Es lo único que separa a esa unidad de estar cerrada: 1 120 intentos de que una clínica lea a otra, escritos y **jamás ejecutados** por falta de Java. |
| 6 | `E1-02-Q1/Q2/Q3/Q4/Q6/Q7` (los códigos internacionales de laboratorio, qué significa «PCR», qué abreviaturas usa usted, si «creatinina» a secas es la de sangre, si «glucosa capilar» es glucometría, y si dicta «PAS/PAD») · `E0-07-D8` · `E0-06-D1` (alergias en recepción) · `E0-09-Q5` · `E0-10-D3/D4/D6/D7/D8` · `E0-11` (5 min en GitHub) · `E2-02-ALCANCE` · `E0-02-Q3` · `E0-04-Q1/Q2` · `E0-01-D1` · `E0-05` (visto bueno para desplegar) · `E0-14` (REG-014) | Las de siempre, con su «por qué» una por una en `estado.json` → `necesitaValidacionDelDr` y `decisionesPendientesDelMedico`. **Ninguna de las de E1-02 bloquea nada**: donde falta su criterio, el programa **dice «no lo sé»** en vez de adivinar. |

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
| E0-07 | Cada puerta dice qué permiso exige | 🟢 cerrada en software — el vigilante compara la llave real con la declarada, puerta y verbo por verbo. Espera sus respuestas de política (Q1, Q3–Q7). |
| E0-10 | Iframes bloqueados · interruptor de seguridad | 🟢 cerrada en software — falta desplegar, correr la matriz de navegador y decir sí/no al apretón (`E0-10-D3`). **No se reintenta.** |
| **E1-02** | **«Creatinina», «Cr» y «creatinina sérica» son el mismo dato** | 🟢 **CERRADA HOY en software** — la aceptación se cumple y ahora **ninguna abreviatura puede entrar sin fuente comprobable** (probado metiendo inventadas a propósito). **Sale de la cola:** lo que queda son 7 preguntas suyas, **ninguna bloqueante**. |
| **E0-12** | El sello de la nota firmada cubre TODA la nota | 🔴 la mejora funciona, pero **acusa en falso** a notas legítimas → `E0-12-D3`. **NO DESPLEGAR.** **SIGUIENTE UNIDAD.** |
| E0-08 | Que una clínica no vea a otra: probado empujando la puerta | 🟡 la prueba existe y **nunca se ha corrido**: falta Java → `E0-08-Q2` |
| E0-06 | Recepción no debe ver el expediente | 🟡 agujero de la API cerrado; mudar las alergias espera `E0-06-D1` |
| E0-09 | El registro del hospital no se edita: se corrige anexando | 🟡 espera una línea suya (`E0-09-Q5`) |
| E0-11 | El CI protege los invariantes clínicos | 🟡 código listo — espera 5 min suyos en GitHub |
| E2-02 | La búsqueda de evidencia se arma por partes | 🔴 el módulo es correcto y **no lo usa nadie**: falta cablearlo |

**9 cerradas del todo · 3 cerradas en software y esperando a usted (E0-07, E0-10 y E1-02) ·
5 a medias con código ya guardado en la rama · 51 sin empezar.**
Ninguna de las que están a medias hay que rehacerla desde cero: a todas les falta **cerrar**.

---

## Qué pasó en esta corrida, en español

### E1-02 — el diccionario del expediente, y el fin de los comentarios que se creen a sí mismos

**Para qué sirve esta unidad.** Su app tiene que entender que «creatinina», «Cr» y «creatinina
sérica» **son el mismo dato**, para que la gráfica del paciente no se parta en tres. Eso es un
**diccionario**: una lista de nombres oficiales con sus apodos. Nada más. No decide, no calcula, no
interpreta.

**Cuál era el problema.** El diccionario ya estaba escrito y funcionaba, pero la revisión
adversarial lo devolvió por una razón incómoda: **el archivo afirmaba por escrito que no se había
inventado ningún apodo, y traía dos inventados** (`Hb` de hemoglobina y `BT` de bilirrubina total).
No aparecen en ninguna parte de su app: alguien —yo, en una pasada anterior— los escribió porque
«se ven razonables». Ya se habían borrado. **Lo que faltaba era el candado**, porque una promesa que
ninguna prueba puede desmentir no vale nada.

**Qué se hizo hoy.**

1. **Cada apodo tiene que justificarse solo, o el CI se pone rojo.** Para entrar al diccionario, un
   apodo debe cumplir una de estas cosas: que **un motor que ya está en su app lo reconozca** (el
   lector de laboratorios o el lector de signos vitales — se les pregunta de verdad, ejecutándolos);
   que sea **el nombre oficial del propio dato**; que sea **el nombre internacional** que su app ya
   usa al exportar (y se comprueba **leyendo ese archivo**, no de memoria); o que venga **citado con
   archivo y línea**. Si no cumple ninguna, **la prueba lo señala por su nombre** y ofrece las dos
   salidas honestas: retirarlo o citarlo.
2. **Se comprobó a la mala, cuatro veces.** Volví a meter `Hb` → **rojo**. Volví a meter «glucosa
   capilar» → **rojo**. Devolví el diccionario al comportamiento viejo del filtro → **rojo**. Vacié
   una cita para ver si colaba → **rojo**. Los cuatro sabotajes se revirtieron. Una prueba que no se
   puede poner roja no protege nada.
3. **Se retiraron tres apodos sin respaldo**: «glucosa capilar», «dextrostix» (que además es una
   **marca comercial**) y «BMI». **No se perdieron**: quedan guardados aparte con su pregunta para
   usted, y mientras tanto el sistema responde **«no lo sé»** en vez de adivinar. Y una **corrección
   de honestidad al acta anterior**: decía que «pulso» también estaba inventado, y es **falso** —
   su app ya lo reconoce (lo comprobé ejecutándola). Eran **dos** sin respaldo, no cuatro.
4. **Se cerró una trampa antes de que hiciera daño.** Al pedir un dato «del grupo de signos
   vitales», si el nombre pertenecía al grupo de laboratorio el sistema **devolvía el de laboratorio
   igual**, en silencio. Ahora responde «no lo sé». Se cambió **hoy** porque este diccionario
   **todavía no lo usa ninguna pantalla**: mañana, con la primera pantalla enchufada, el cambio ya
   no sería gratis.

**El hallazgo del día, y es de producción.** Al medir apodo por apodo apareció que **su lector de
laboratorios confunde dos cosas distintas**: «**depuración de creatinina**» (que se mide en mL/min)
se guarda en la serie de «**creatinina en sangre**» (que se mide en mg/dL). El nombre correcto sí
está escrito en el código, pero **nunca se alcanza**, porque «creatinina» aparece antes en la lista y
gana. Lo mismo con «creatinina **urinaria**»: el filtro que separa la orina **sólo mira la palabra
«orina»**, así que «urinaria» se le escapa. **Atenuante medido:** una depuración normal (60–120) se
descarta sola por estar fuera del rango plausible de la creatinina; **la que sí pasa es una
depuración baja (1–25)** — justo la del paciente renal. **No lo arreglé**: cambia una gráfica que
usted ya usa → `E1-02-Q5`. Lo que sí hice fue **dejarlo clavado con una prueba** que describe el
comportamiento real, de modo que ningún arreglo futuro pueda pasar en silencio.

**Riesgo:** bajo y medido. Este diccionario **no lo usa ninguna pantalla todavía** (comprobado: sólo
lo usan sus propias pruebas). No se tocó el lector de laboratorios, ni el de signos vitales, ni la
exportación, ni el catálogo de diagnósticos, ni las reglas de la base de datos, ni la impresión, ni
los cobros. **Lo único nuevo que puede molestar:** si mañana alguien cambia un nombre en el lector de
laboratorios, **el CI se pondrá rojo** aunque el cambio sea legítimo. Es a propósito —así se detecta
que el diccionario se desincronizó— y el mensaje de error dice exactamente qué hacer.

**Qué falta, y es suyo.** Siete preguntas, **ninguna bloquea**: los códigos internacionales de
laboratorio (hoy se exporta sólo la clave interna, porque un código equivocado viaja fuera y otro
sistema lo lee como verdad), qué significa «PCR» en su consultorio, qué abreviaturas escribe usted de
verdad, si «creatinina» a secas es la de sangre, si «glucosa capilar» es glucometría, si dicta
«PAS/PAD», y la autorización del arreglo del lector (`Q5`).

## 👉 Cómo retomar (para la próxima sesión, mía o de otro)

1. **Leer `estado.json`**, no este archivo: es la fuente de verdad. `unidadEnCurso` está en `null`.
2. **Lo primero: `E0-12`** — el PLAN de las tres salidas con su coste y su riesgo, más el test de
   round-trip que falta, con la semántica de guardado **real** (merge sobre el borrador). **No
   implementar el arreglo sin la decisión `E0-12-D3`:** toca el flujo de firma (regla 5). Y corregir
   la sobreafirmación del acta y de `REG-059`, que sí es ejecutable.
3. **Después, terreno recién desatascado: `E1-03`** (proyectar el expediente actual a hechos
   clínicos). Sus dos dependencias —`E1-01` y `E1-02`— ya tienen el software cerrado. **Dos
   condiciones no negociables** para quien la tome: consumir `resolverConcepto` **con el dominio como
   FILTRO** (ya no es una pista) y tratar `ambiguo` y `desconocido` como **estados normales**, no como
   errores que haya que «resolver» eligiendo. Alternativa: **`E2-02`** (cablear el extractor PICO a
   las dos rutas de evidencia, previa decisión de alcance).
4. **`E0-07`, `E0-10` y `E1-02` no se reintentan.** Su parte de software está cerrada y verificada;
   lo que queda son respuestas y acciones del Dr. En E0-07 el lote pendiente es mecánico (cambiar
   `verificarModuloIA` por `verificarModuloYCapacidad` en las 16 rutas de IA). En E0-10 no queda
   software: falta desplegar, correr la matriz (`npm run e2e:seguridad`) y decidir `D-3`. En E1-02 no
   queda software: **todo lo que `estado.json` listaba como pendiente ejecutable está hecho**.
   Pasadas anteriores se gastaron re-diseñando lo ya implementado; por eso las tres tienen acta en
   disco (`RESULTADO.json`, estado `necesita_validacion`) y no vuelven a la cola.
5. Si el Dr. prefiere terreno nuevo: **E4-01 «Contrato del Safety Kernel»** (riesgo medio,
   aceptación autocontenida).

**Convención vigente:** una unidad devuelta a la cola pierde su `RESULTADO.json` (se renombra a
`RESULTADO.parcial.json`, para no perder la evidencia) y su veredicto queda en `VERIFICACION.json`.
E0-07, E0-10 y **E1-02** vuelven a tener `RESULTADO.json`, **con estado `necesita_validacion` y la
razón escrita dentro**: no cuentan como cerradas del todo y **no deben entrar en `completadas`** (ése
fue el error V-5 que encontró la verificación de E0-10). El acta existe para que la unidad deje de
volver a la cola cuando su software está cerrado y lo que falta es del médico.

---

## Deuda técnica y residuales anotados (para no perderlos)

- **Una regresión medicolegal vive en la rama (E0-12).** `3c09a0d` está commiteado y **no debe
  desplegarse** hasta cerrar el falso «alterada». Es el único bloqueo duro de merge.
- **El lector de nombres de laboratorio confunde tres pares de cosas, y está vivo hoy (E1-02).**
  «Vitamina K» → potasio · «depuración de creatinina» → creatinina en sangre · «creatinina urinaria»
  → creatinina en sangre. Los tres están **medidos y clavados con pruebas** que describen el
  comportamiento real; el arreglo espera `E1-02-Q5` porque cambia una gráfica en uso.
- **Los 24 analitos del catálogo no tienen código internacional (E1-02).** Se exporta sólo la clave
  interna, a propósito: elegir mal un código lo manda fuera como verdad. Espera `E1-02-Q1`. Hay un
  trinquete que impide rellenarlos sin cita (el número sólo puede bajar).
- **Hay dos catálogos de analitos en el repo, duplicados desde antes de este programa** (el de las
  gráficas y el del copiloto). Fusionarlos toca dos rutas de producción a la vez; hoy sólo hay una
  prueba que vigila que **no se desincronicen las claves**.
- **28 puertas siguen abiertas a cualquiera del consultorio (E0-07), por decisión pendiente.** Ya
  **no** es un problema de software: la declaración está atada al código, cada pendiente dice qué
  decisión espera y hay pruebas que lo vigilan. Lo que falta son sus respuestas (Q1, Q3–Q7).
- **El blindaje del puesto al aceptar una invitación sigue abierto (E0-07, P2-2).** Hoy quien puede
  invitar podría escribir un puesto que la app no ofrece. Severidad contenida, y el arreglo toca el
  **alta de miembros** → `E0-07-D8`.
- **~190 de las 1 120 pruebas de aislamiento son tautológicas (E0-08).** Y bajo `clinics/**` sólo se
  prueba leer *un documento*, nunca **enumerar** una colección cross-tenant.
- **La prueba de aislamiento nunca se ha ejecutado.** Hasta esa primera corrida, el aislamiento
  entre clínicas está **argumentado**, no **demostrado**.
- **Lo que esa prueba NO cubrirá aunque se ponga verde:** permisos campo por campo (eso es E0-09),
  permisos de archivos (fotos, PDFs), y las rutas del servidor (no pasan por esas reglas, por
  diseño — y por eso existe el vigilante de E0-07).
- **El sello de la FIRMA no cubre su nombre ni su cédula.** Son dos sellos: el del contenido (que
  desde E0-12 cubre toda la nota) y el de la firma. Cerrarlo entra al flujo de firma y a la
  impresión → `E0-12-Q2`.
- **Las notas más antiguas (sello versión 1) siguen sin poder re-verificarse.** Salen como «formato
  anterior», que **no** significa alteradas.
- **`hospital` e `infectologia` entraron al sello sin que hoy los escriba nadie.** Blindaje
  preventivo, probado con datos ficticios.
- **Las alergias, los antecedentes y la valoración del inmunocomprometido siguen dentro de la ficha
  del paciente.** Mientras estén ahí, cualquier miembro del consultorio los lee. La mudanza está
  diseñada y espera `E0-06-D1`.
- **8 puestos en el tipo, 6 asignables desde la app** («recepción» y «facturación» existen en la
  matriz y nadie puede tenerlos). Hay una prueba que lo vigila → `E0-07-Q2`.
- **El arreglo del clickjacking está en el código y no en producción.** Son 22 pantallas con datos
  clínicos **más la pantalla de entrada (`/login`)**. Basta desplegar — **subiendo la versión del
  Service Worker**.
- **La política de seguridad sigue permitiendo `unsafe-inline`/`unsafe-eval`.** Quitarlo exige
  firmar cada script en cada petición; su riesgo típico es *pantalla en blanco*. Unidad aparte.
- **Ninguna prueba automática entra a la zona con sesión** (expediente, nota, receta, farmacia). Es
  el punto ciego más grande del proyecto → `E0-10-D4`.
- **La matriz de pruebas de navegador nunca se ha ejecutado.** Ahora es un solo comando y no exige
  desplegar; hasta que corra, «pruebas de seguridad en verde» es una promesa, no un hecho.
- **La cámara está cerrada para todo el sitio mientras la videoconsulta la pide** (`camera=()` vs
  el marco de Daily). Es anterior a E0-10 → `E0-10-D8`, que empieza por una observación suya.
- **El grafo no puede expresar 14 de los 35 datos que necesita** *(pesa sobre E1-03)*. Faltan lpm,
  rpm, °C, cm, kg/m², «puntos» (Glasgow, dolor), U/L, 10³/µL, µUI/mL. «120/80» son **dos datos, no
  uno** — y el diccionario de E1-02 ya lo respeta: son dos conceptos, no uno.
- **El motor de dosis no habla el idioma del principio 3** de sus decisiones clínicas: devuelve
  alertas, no `PASS | WARN | BLOCK | UNKNOWN | N/A`.
- **Las fórmulas usan números pelados POR DENTRO.** El tipo protege entrada y salida de cada motor,
  no los pasos intermedios.
- **El rango habitual de cada fármaco de infusión sigue siendo un par de números sin unidad.**
  Candidato a «E0-05-bis».
- **El conversor de PDF a imagen se descarga de `unpkg.com`** cada vez que usted sube un
  laboratorio. Se puede guardar una copia dentro de la app: es un sí/no.
- **487 paquetes de desarrollo con 32 avisos de seguridad conocidos**, todos del árbol de las
  herramientas de Firebase. Son **de taller**: no viajan a su app ni al servidor.
- **`RETOMAR-AQUI.md` está viejo.** La fuente de verdad son `estado.json` y este archivo.
- **Los comentarios que afirman cobertura no valen; el test que la deriva de la fuente, sí.** Es la
  lección de los sinónimos inventados `Hb`/`BT` (**cerrada hoy con un candado ejecutable**), de la
  lista de campos sellados escrita a mano (E0-12) y del registro de permisos que nadie comparaba con
  el código (E0-07). Las tres veces el arreglo fue el mismo: **derivar el dato del código, no
  escribirlo al lado**.
