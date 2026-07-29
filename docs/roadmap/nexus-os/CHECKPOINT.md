# Nexus OS — dónde vamos

> **En 30 segundos.** Van **8 de 68** unidades cerradas. **Hoy el marcador BAJÓ de 10 a 8, y es
> una buena noticia.** No se perdió código: un verificador independiente revisó las tres unidades
> de esta corrida (**E0-10**, **E1-02**, **E2-02**) y **las tres quedaron INCOMPLETAS**; dos
> estaban contadas como terminadas sin serlo. Se les quitó el sello de «hecho» y vuelven a la
> cola. **A las tres les falta CERRAR, no construir:** a una le falta un despliegue suyo, a otra
> un test y una decisión, y a la tercera conectar el módulo a las dos pantallas que lo usarían.
> **Riesgo para su consultorio: cero** — nada de esto está en producción y ninguno de los tres
> módulos toca todavía una sola pantalla.
> **Lo siguiente: E1-02** (reintento barato, el código ya está escrito).
> **Sigue pendiente lo de siempre:** el despliegue de seguridad de hace tres corridas
> (*decisión 2.a*) y el error de la **«Vitamina K»**, vivo en producción (*decisión 1.e*).

Última corrida: `2026-07-29T12:12:11Z`. `tsc` verde · **2357 tests verdes** · **0 archivos de
producción modificados** · **nada desplegado, sin `push`**.

---

## El tablero

| Unidad | Qué es | Estado |
|---|---|---|
| E0-01 | Certificado de receta firmado con identidad derivada | ✅ cerrada |
| E0-02 | Invariantes de dosis pediátrica (property-based) | ✅ cerrada |
| E0-03 | Clinical Engine Registry + trinquete de ADRs | ✅ cerrada |
| E0-04 | Un número clínico ya no puede viajar sin su unidad | ✅ cerrada |
| E0-14 | Firma aislada · cobro sellado · nota nace borrador | ✅ cerrada (única con reglas desplegadas) |
| E0-15 | Antibiograma: 4 decisiones clínicas suyas implementadas | ✅ cerrada |
| E1-01 | Un hecho clínico no existe sin unidad y sin procedencia | ✅ cerrada |
| E2-01 | Una afirmación no existe sin el fragmento que la respalda | ✅ cerrada |
| **E0-10** | Iframes bloqueados en sus pantallas · interruptor de seguridad | 🔴 **destapada hoy** — espera **un despliegue suyo** |
| **E1-02** | «Creatinina», «Cr» y «creatinina sérica» son el mismo dato | 🔴 **destapada hoy** — falta 1 test + sus respuestas |
| **E2-02** | La búsqueda de evidencia se arma por partes, no con una frase suelta | 🔴 **destapada hoy** — **el módulo no lo usa nadie** |
| E0-11 | El CI protege los invariantes clínicos | 🟡 código listo — espera 5 min suyos en GitHub |
| E0-09 | El registro del hospital no se edita: se corrige anexando | 🟡 bloqueada — espera 1 línea suya |

**8 cerradas · 5 destapadas o esperándole · 55 sin empezar.**

---

## Qué pasó hoy, sin adornos

Se intentaron tres unidades y las tres se entregaron con sus pruebas en verde. Después las revisó
un verificador **cuyo trabajo es refutar**, no aplaudir. Resultado:

### E0-10 · seguridad del navegador — la mitad no está hecha

La aceptación pedía dos cosas: *política de seguridad en modo bloqueo sin romper flujos*, y
*pruebas de seguridad en verde*.

- **El modo bloqueo no está puesto.** El interruptor existe y funciona, pero **por defecto sigue
  en modo observación**, y el valor que lo pondría en bloqueo no está escrito en ninguna parte del
  proyecto ni de la configuración de despliegue.
- **Las pruebas de navegador nunca se ejecutaron.** El propio archivo declara un grupo en rojo
  hasta que se despliegue, y los dos únicos casos que probarían el modo bloqueo están saltados
  salvo que alguien los active a mano.

**Lo que SÍ quedó en pie y es real:** se descubrió y se cerró en código un agujero de verdad —
**22 de sus 34 pantallas con sesión viajaban sin ninguna protección contra iframes**, incluidas
`/uci`, `/hospitalizacion`, `/receta` y `/superadmin`. Está escrito y probado; le falta salir a
producción.

> **Esto no lo puede terminar el sistema automático**: exige desplegar y observar, y el workflow
> tiene prohibido desplegar. Es suyo.

### E1-02 · el diccionario de conceptos — se coló una invención

Lo que la unidad prometía **sí se cumple**: «creatinina», «Cr» y «creatinina sérica» resuelven al
**mismo** concepto, comprobado de la forma más estricta posible.

Pero el verificador encontró lo más grave que puede pasar en este proyecto: **se inventaron dos
abreviaturas de laboratorio**, `Hb` para hemoglobina y `BT` para bilirrubina total, **que no
existen en ninguna parte de su app** — y un comentario del propio archivo afirmaba que sólo se
había añadido una abreviatura nueva («Cr»). La lista que le presentamos para revisar **no las
incluía**.

**Ya está reparado en esta reconciliación:** las dos se borraron, y la prueba que vigilaba ese
archivo se cambió para que compruebe **la declaración contra la fuente real** en vez de fiarse de
un comentario. *No se sustituyó una invención por otra: se borró.*

Queda un residuo del mismo tipo, **sin riesgo hoy** porque nadie usa aún el módulo: cuatro
sinónimos de signos vitales escritos a mano sin respaldo (`pulso`, `bmi`, `dextrostix`,
`glucosa capilar`). Son las preguntas **1.f** y **1.g**.

### E2-02 · la búsqueda por partes — el módulo no lo usa nadie

El módulo es correcto y está bien probado (el verificador le metió 9 fallos a propósito y todos
saltaron). Pero la aceptación **no habla del módulo, habla de la búsqueda del producto** — y la
búsqueda del producto sigue exactamente igual: las dos rutas reales de evidencia siguen mandándole
a PubMed una frase pegada con cinta.

Dicho claro: **hoy usted no notaría ninguna diferencia**, porque el extractor nuevo **no está
conectado a nada**. Conectarlo es poco trabajo, pero **cambia qué artículos ve usted**, así que no
se hace a ciegas: es la decisión **2.f**.

> **El patrón se repitió tres veces** y ya está anotado para corregir el protocolo: el agente que
> construye da por buena la aceptación **dentro de su módulo** —compila, pasa los tests, no rompe
> nada— mientras la aceptación habla **del producto**. Un módulo impecable que nadie usa no cumple
> «la búsqueda se arma por partes».

---

## 👉 Lo siguiente: **E1-02 (reintento, no reimplementación)**

**Es la más barata y la que desatasca más.** El código ya está escrito, en disco y en verde; lo
que falta es **software, no criterio médico**:

1. Un test que **derive** las abreviaturas de laboratorio desde la fuente real de su app, para que
   «aquí no hay nada inventado» lo compruebe una máquina y no un comentario.
2. Retirar —o darles fuente— a los cuatro sinónimos de signos vitales sin respaldo.
3. Formular la pregunta de la glucosa capilar y **detenerse ahí**: es criterio suyo.

**Por qué ésta y no otra:** **E1-03** (proyectar todo su expediente actual a hechos clínicos) es la
siguiente pieza grande de la columna vertebral y **depende de E1-02**. Mientras E1-02 siga a
medias, la rama E1 entera está clavada.

**Si prefiere terreno nuevo:** **E4-01 · Contrato del Safety Kernel** (riesgo medio, sin
dependencias pendientes). Su aceptación —*«el motor de seguridad se puede invocar sin la IA y su
veredicto es un valor, no un texto»*— se agota **dentro** del módulo, así que no cae en la trampa
que tumbó a E2-02.

**Lo que NO se toca sin plan aprobado por usted:** las cuatro unidades de E0 que quedan (E0-05,
E0-06, E0-12, E0-13) son de riesgo **alto** y tocan justo lo que la carta operativa manda no
arriesgar a ciegas: **sellos de integridad, cobros de Stripe, permisos de acceso y motores
clínicos**.

---

## Esperando decisión del médico

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

**f. 🆕 ¿«Glucosa capilar» y «glucosa sérica» son dos cosas distintas** (glucometría de dedo vs
laboratorio) **o la misma con distinto origen?** El diccionario ya las separa, y **esa separación
la decidió el software, no usted**. Fija cómo se agruparán todas sus gráficas de glucosa.

**g. 🆕 ¿Acepta como sinónimos `pulso` (FC), `bmi` (IMC), `dextrostix` y `glucosa capilar`?**
Ninguno tiene respaldo en el código de su app; los demás sí. Si no los firma, se retiran.

### 2. Seguridad, despliegue y alcance

**a. ⚠️ Lo urgente no es una decisión, es un despliegue.** El arreglo del clickjacking (22
pantallas) está en el código y **no en producción**. No exige apretar la política de seguridad:
basta con desplegar. **Al desplegar, suba la versión del Service Worker.**

**b. El conversor de PDF a imagen se descarga de un servidor ajeno (`unpkg.com`)** cada vez que
usted sube un laboratorio. Se puede guardar una copia dentro de la app. ¿Lo hacemos?

**c. ¿Sigue usando el Pixel de Meta y el alta de WhatsApp desde Configuración?** Si está apagado,
quito los permisos de Facebook. Es un sí/no.

**d. ¿Aprieto la política de seguridad a modo bloqueo?** **Mi recomendación: todavía no** — antes
hace falta (e), y antes hay que **observar los reportes** con la app ya desplegada.

**e. ¿Creamos un usuario de prueba con datos INVENTADOS?** Hoy **ninguna** prueba automática entra
a la zona con sesión: ni expediente, ni nota, ni receta, ni farmacia. Es el punto ciego más grande
del proyecto, y es lo que impide cerrar E0-10.

**f. 🆕 ¿Conecto la búsqueda por partes (E2-02) a sus dos pantallas de evidencia?** Es lo único que
falta para que esa unidad signifique algo. **Cambia qué artículos ve usted**, así que iría con
pruebas que congelen antes el comportamiento actual. Además: **ninguna unidad del plan es dueña de
ese trabajo** — hay que decidir si es E2-02 ampliada o una unidad nueva.

### 3. El grafo no puede expresar 14 de los 35 datos que necesita *(bloquea E1-03)*

Está **medido** y fijado con un test. Al catálogo de unidades le faltan las más cotidianas: **lpm,
rpm, °C, cm, kg/m² y «puntos»** (Glasgow, dolor), y de laboratorio **U/L**, **10³/µL** y
**µUI/mL**. La tensión «120/80» son **dos datos, no uno**. Hoy el comportamiento ya es seguro: un
dato con unidad desconocida **se rechaza ruidosamente**, no se guarda a medias. Añadir °C obliga a
reescribir un candado que E0-04 puso a propósito («°C↔°F no es un factor, es una fórmula»).

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
| | ¿Qué analitos llevan conversión masa↔sustancia? ¿mEq/L convierte solo a mmol/L? | E0-04 |
| | En la búsqueda de evidencia: el fármaco que ya toma el paciente, ¿es la intervención o parte de la población? ¿quiere bandas de edad? | E2-02 |

---

## Deuda técnica anotada (para no perderla)

- **El motor de dosis no habla el idioma del principio 3** de sus decisiones clínicas: devuelve
  alertas, no `PASS | WARN | BLOCK | UNKNOWN | N/A`. Funciona, pero hay que migrarlo.
- **La política de seguridad sigue permitiendo `unsafe-inline`/`unsafe-eval`.** Quitarlo exige
  firmar cada script en cada petición; su riesgo típico es *pantalla en blanco*. Unidad aparte.
- **`RETOMAR-AQUI.md` está viejo** (habla de 2/68 y del 28 de julio). La fuente de verdad son
  `estado.json` y este archivo.
- **Los comentarios que afirman cobertura no valen; el test que la deriva de la fuente, sí.** Es la
  lección de la invención de `Hb`/`BT`, ya aplicada en el vocabulario.
- **Propuesta de cambio al protocolo:** que el `DISENO.md` de cada unidad cite textualmente la
  aceptación del backlog **y nombre el archivo de producción que la hará cierta** — o declare por
  escrito que el cableado es de otra unidad, **identificándola por id**. Las tres incompletas de
  hoy se habrían evitado con eso.

---

## Cómo se retoma

1. Leer este archivo y `estado.json` (mismo directorio). Nada depende del chat.
2. `estado.json → siguientesElegibles.recomendacionExplicita` da la unidad y su alcance exacto.
3. **Regla de oro:** las unidades de `bloqueadas` **no se reimplementan desde cero**. Su código
   está commiteado y en verde; se les completa lo que falta. Un `RESULTADO.json` sólo cuenta si el
   `VERIFICACION.json` de esa unidad no la declara *INCOMPLETA*; cuando la declara, el
   `RESULTADO.json` **se borra** y la unidad vuelve a la cola (eso se hizo hoy con tres).
4. Gates permitidos: `npx tsc --noEmit`, `npx vitest run src/__tests__/`, `npm run build`. Nunca un
   servidor, nunca Playwright, nunca `--watch`, nunca `push`, nunca desplegar.
