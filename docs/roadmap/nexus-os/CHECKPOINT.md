# Nexus OS — dónde vamos

> **En 30 segundos.** Van **9 de 68** unidades cerradas. Hoy se cerró **E0-05**, la más grande y la
> más delicada de las que quedaban en E0: **un número clínico ya no puede entrar a un motor sin su
> unidad.** La creatinina, la gasometría, las infusiones de la UCI y los techos de dosis dejaron de
> recibir números pelados; ahora el compilador rechaza, por ejemplo, meter una creatinina en µmol/L
> a la fórmula de la función renal.
> **Se encontró y se tapó un agujero real, vivo en producción:** en la tarjeta de riesgo
> cardiovascular, una creatinina capturada en la unidad equivocada producía un riesgo calculado
> sobre un dato basura, sin avisar. Ahora esa tarjeta ya no se muestra y se dice qué dato falta.
> **Eso es lo único que usted vería cambiar, y le pido su visto bueno antes de desplegarlo**
> *(decisión 5.a)*.
> **Lo siguiente: E1-02** (reintento barato, el código ya está escrito).
> **Sigue pendiente lo de siempre:** el despliegue de seguridad de hace cuatro corridas
> *(decisión 2.a)* y el error de la **«Vitamina K»**, vivo en producción *(decisión 1.e)*.

Última corrida: `2026-07-29T12:50:33Z`. `tsc` verde · **2403 tests verdes** (186 archivos) ·
`npm run build` verde · **nada desplegado, sin `push`**.

---

## El tablero

| Unidad | Qué es | Estado |
|---|---|---|
| E0-01 | Certificado de receta firmado con identidad derivada | ✅ cerrada |
| E0-02 | Invariantes de dosis pediátrica (property-based) | ✅ cerrada |
| E0-03 | Clinical Engine Registry + trinquete de ADRs | ✅ cerrada |
| E0-04 | Un número clínico ya no puede viajar sin su unidad | ✅ cerrada |
| **E0-05** | **Los motores clínicos ya no aceptan números sin unidad** | ✅ **cerrada hoy** — espera su visto bueno para desplegar |
| E0-14 | Firma aislada · cobro sellado · nota nace borrador | ✅ cerrada (única con reglas desplegadas) |
| E0-15 | Antibiograma: 4 decisiones clínicas suyas implementadas | ✅ cerrada |
| E1-01 | Un hecho clínico no existe sin unidad y sin procedencia | ✅ cerrada |
| E2-01 | Una afirmación no existe sin el fragmento que la respalda | ✅ cerrada |
| E0-10 | Iframes bloqueados en sus pantallas · interruptor de seguridad | 🔴 espera **un despliegue suyo** |
| E1-02 | «Creatinina», «Cr» y «creatinina sérica» son el mismo dato | 🔴 falta 1 test + sus respuestas |
| E2-02 | La búsqueda de evidencia se arma por partes, no con una frase suelta | 🔴 **el módulo no lo usa nadie** |
| E0-11 | El CI protege los invariantes clínicos | 🟡 código listo — espera 5 min suyos en GitHub |
| E0-09 | El registro del hospital no se edita: se corrige anexando | 🟡 bloqueada — espera 1 línea suya |

**9 cerradas · 5 esperándole · 54 sin empezar.**

---

## Qué pasó hoy: E0-05, en español

**El problema.** En medicina el mismo análisis se reporta en unidades distintas según el
laboratorio. La creatinina, en México, se reporta en **mg/dL** (un valor normal es ~1.0). En buena
parte del mundo se reporta en **µmol/L** (el mismo paciente sano da ~88). Hasta hoy, todos los
motores de la app recibían **un número pelado, sin unidad**: si un 88 entraba donde se esperaba un
1.0, la app calculaba una falla renal que no existe y ajustaba dosis de antibiótico a partir de
ella. La única defensa era una lista de rangos «esto no puede ser mg/dL», que es una heurística,
no una prueba.

**Lo que se hizo.** Cuatro motores dejaron de recibir números y pasaron a recibir **cantidades con
su unidad pegada**: función renal, gasometría, infusiones de la UCI y techos de dosis. Ahora
intentar meter una creatinina en µmol/L a la fórmula renal **no compila**: el error salta al
construir la app, no en la consulta.

**Lo importante: ni un solo número cambió.** Antes de dar nada por bueno se sacaron los cuatro
motores **tal como estaban antes del cambio** y se compararon, caso por caso, contra los nuevos:
unas **16 000 combinaciones** entre las cuatro mallas (creatininas, edades, sexos, pesos,
gasometrías completas, siete fármacos de infusión en ambos sentidos, y la malla entera de dosis con
sus vías y edades). **Cero diferencias numéricas y cero diferencias de texto.** Sus alertas dicen
exactamente lo mismo que decían ayer.

**El agujero que apareció por el camino.** Al enumerar todos los sitios que llamaban a la fórmula
renal, el compilador destapó uno que **se había quedado sin la protección de rango** que sus tres
hermanos sí tenían: el que alimenta la tarjeta de **riesgo cardiovascular PREVENT**. Con una
creatinina de 88 (normal si es µmol/L), esa tarjeta calculaba el riesgo a partir de una función
renal fantasma y lo mostraba como si fuera un dato bueno. **Ya está tapado**: en ese caso la
tarjeta no se muestra y en su lugar aparece «falta la TFG (o creatinina)». Es el **único** cambio
que usted notaría, y sólo ocurre cuando el dato está mal capturado.

**Lo que esto NO resuelve, dicho antes de que lo pregunte.** Si el laboratorio reporta en µmol/L
pero **la etiqueta dice mg/dL**, ningún sistema de tipos puede verlo: eso lo sigue atrapando la
lista de rangos, y por eso **no se tocó**. Y hay un residuo honesto: un valor sano en µmol/L
(p. ej. 20) cae dentro del rango plausible y sigue pasando. Cerrarlo del todo exige que el
laboratorio traiga su unidad desde el origen — eso es E1, no esta unidad. Está escrito como test,
no como comentario.

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
veredicto es un valor, no un texto»*— se agota **dentro** del módulo.

**Lo que NO se toca sin plan aprobado por usted:** de las cuatro unidades de riesgo **alto** que
quedaban en E0, hoy se cerró una (E0-05). Quedan tres: **E0-06** (permisos de acceso), **E0-12**
(sellos de integridad) y **E0-13** (cobros de Stripe).

---

## Esperando decisión del médico

### 5. 🆕 La migración de unidades (E0-05)

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

*Nota de hoy:* E0-05 añadió **U/mL** (para la vasopresina de la UCI). Va en dimensión aparte:
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

- **El motor de dosis no habla el idioma del principio 3** de sus decisiones clínicas: devuelve
  alertas, no `PASS | WARN | BLOCK | UNKNOWN | N/A`. Funciona, pero hay que migrarlo. *(E0-05 ya le
  cambió la entrada; la salida sigue igual.)*
- **🆕 El rango habitual de cada fármaco de infusión sigue siendo un par de números sin unidad.**
  Se dejó fuera de E0-05 a propósito: tiparlo multiplica el catálogo entero sin cerrar ningún hueco
  nuevo, porque la dosis ya llega con su unidad. Candidato a «E0-05-bis».
- **🆕 Las fórmulas siguen usando números pelados POR DENTRO.** El tipo protege la entrada y la
  salida de cada motor, no los pasos intermedios: `mL/h = dosis × peso × 60 ÷ concentración` sigue
  siendo aritmética suelta. Blindarlo exige álgebra de dimensiones derivadas, que es otra unidad.
- **La política de seguridad sigue permitiendo `unsafe-inline`/`unsafe-eval`.** Quitarlo exige
  firmar cada script en cada petición; su riesgo típico es *pantalla en blanco*. Unidad aparte.
- **`RETOMAR-AQUI.md` está viejo.** La fuente de verdad son `estado.json` y este archivo.
- **Los comentarios que afirman cobertura no valen; el test que la deriva de la fuente, sí.** Es la
  lección de la invención de `Hb`/`BT`, ya aplicada en el vocabulario.
