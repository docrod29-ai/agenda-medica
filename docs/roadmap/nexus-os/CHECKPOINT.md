# Nexus OS — dónde vamos

> **En 30 segundos.** Van **10 de 68** unidades cerradas. En esta corrida se entregó
> **E2-02 · Extractor PICO**: cuando el sistema busca evidencia para un paciente, **deja de
> mandarle a PubMed una frase suelta** y le manda una búsqueda **armada por partes** —a quién
> se busca, qué se le hace, contra qué, y qué desenlace importa—. Suena menor y no lo es:
> hoy nadie puede **explicar** de dónde salió una búsqueda, ni **aflojarla** cuando devuelve
> cero, porque lo que viaja es una cadena que nadie puede leer por dentro.
> **Riesgo para su consultorio: cero.** Cuatro archivos nuevos, **ningún archivo de producción
> tocado**, **ninguna pantalla tocada**, y el módulo **todavía no lo usa nadie**.
> **Sigue pendiente lo de siempre:** el despliegue de seguridad de hace dos corridas
> (*decisión 2.a*) y el error de la **«Vitamina K»** que sigue vivo en producción
> (*decisión 1.e*).

Última corrida: `2026-07-29T11:53:24Z`. `tsc` verde · **2357 tests verdes** (+35) · `build`
verde · **0 archivos de producción modificados** · **nada desplegado, sin `push`**.

---

## El tablero

| Unidad | Qué es | Estado |
|---|---|---|
| E0-01 | Certificado de receta firmado con identidad derivada | ✅ cerrada |
| E0-02 | Invariantes de dosis pediátrica (property-based) | ✅ cerrada |
| E0-03 | Clinical Engine Registry + trinquete de ADRs | ✅ cerrada |
| E0-04 | Un número clínico ya no puede viajar sin su unidad | ✅ cerrada |
| E0-10 | Nadie puede meter sus pantallas en un iframe · interruptor de seguridad | ✅ cerrada — ⚠️ **pendiente de desplegar** |
| E0-14 | Firma aislada · cobro sellado · nota nace borrador | ✅ cerrada (única con reglas desplegadas) |
| E0-15 | Antibiograma: 4 decisiones clínicas suyas implementadas | ✅ cerrada |
| E1-01 | Un hecho clínico no existe sin unidad y sin procedencia | ✅ cerrada |
| E2-01 | Una afirmación no existe sin el fragmento que la respalda | ✅ cerrada |
| **E2-02** | **La búsqueda de evidencia se arma por partes, no con una frase suelta** | ✅ **cerrada *(hoy)*** |
| E1-02 | «Creatinina», «Cr» y «creatinina sérica» son el mismo dato | 🟡 software listo — espera 4 respuestas suyas |
| E0-11 | El CI protege los invariantes clínicos | 🟡 código listo — espera 5 min suyos en GitHub |
| E0-09 | El registro del hospital no se edita: se corrige anexando | 🟡 bloqueada — espera 1 línea suya |

**10 cerradas · 3 esperándole · 55 sin empezar.**

---

## Qué se hizo hoy: E2-02 · la búsqueda se arma por partes

### El problema, en una frase

Cuando usted pide evidencia sobre un paciente, hoy pasa esto: **el modelo de IA redacta la
búsqueda** y el sistema **se la pasa a PubMed tal cual, sin mirarla**. Y hay tres atajos de
emergencia que mandan directamente **la pregunta en español, entera**, o el diagnóstico y los
fármacos **pegados en una sola cadena**.

Eso tiene tres consecuencias muy concretas:

- **No se puede explicar.** Si la búsqueda trae basura, no hay forma de decir de qué parte vino.
- **No se puede aflojar.** Cuando devuelve **cero artículos**, no se sabe qué soltar primero,
  porque población y tratamiento van pegados en el mismo texto.
- **No se puede auditar.** Nada impide que se cuele texto que usted nunca escribió.

### Qué se construyó

Ahora la pregunta se descompone en **cuatro casillas** —**a quién** (población), **qué se le
hace** (intervención), **contra qué** (comparador) y **qué desenlace** interesa— y la búsqueda
**la arma el sistema** juntando esas casillas con reglas fijas. Tres formas de llenarlas:

1. **Desde la nota, sin IA de por medio.** Motivo, diagnósticos y medicamentos ya vienen
   etiquetados en su expediente, así que no hay que adivinar nada. Se conserva el criterio que
   su app ya aplicaba (**el motivo de consulta manda sobre las comorbilidades**), pero **deja de
   pegarlos en una sola cadena**.
2. **Desde el modelo de IA** — pero al modelo **ya no se le pide que redacte la búsqueda**, sino
   que **rellene las casillas con términos sueltos**.
3. **El camino de emergencia**, que sigue existiendo para no devolver nunca cero… pero ahora
   **va marcado como tal**. Hoy una búsqueda de emergencia se ve **idéntica** a una buena.

Y cuando una búsqueda devuelve cero, el sistema **afloja por pasos y de forma explicable**:
primero todo junto, luego sólo *a quién + qué se le hace*, y al final sólo *a quién*.

### Lo importante: cómo se impide hacer trampa

Lo obvio era definir cuatro campos y darse por satisfecho. **No basta**, y por dos motivos que
tienen nombre:

- **Alguien podría seguir pasando una frase suelta.** Ahora **no compila**: la función que arma
  la búsqueda **no acepta texto**, sólo la estructura, y la estructura **no se puede escribir a
  mano**. Hay **nueve casos** que el compilador debe rechazar; si alguien los desactivara, el CI
  se pone rojo.
- **El modelo podría meter la búsqueda ya redactada dentro de una casilla** —del tipo
  *«(IVU O cistitis) Y mujeres»— y fingir que cumple. Eso **se rechaza diciendo por qué**, y
  **no se limpia en silencio**: borrarle los paréntesis produciría un término **que nadie
  escribió**, que es exactamente la clase de dato inventado que este programa persigue.

Además, cada búsqueda **carga consigo de dónde salió cada palabra**. Hay una prueba que recorre
la búsqueda **palabra por palabra** y exige que **ninguna** venga de fuera de las casillas.

### Lo que NO se hizo, a propósito

- **No se decide qué evidencia pesa más.** Hoy su buscador pone **las guías por encima de los
  ensayos clínicos**; eso **no se tocó** porque nadie lo ha validado (es la *decisión 6*).
- **No se usan las etiquetas de PubMed** (`[mh]`, `[tiab]`). Ponerlas exige **saber** que el
  término existe en el tesauro de PubMed, y este sistema no tiene ese diccionario: etiquetar a
  ciegas produce búsquedas que devuelven **cero en silencio**, el peor fallo posible aquí.
- **No se enchufó a ninguna pantalla.** Eso toca un flujo que usted ya probó en vivo y va en
  E2-05, con su propia comparación antes/después.
- **La edad no se traduce a «pediátrico» o «anciano».** Dónde empieza cada banda es criterio
  suyo, no mío (*pregunta 13.b*). Y por defecto **ni la edad ni el sexo salen del consultorio**:
  PubMed es un tercero, y la edad exacta es la vía más fácil de reidentificar a alguien.

### Cómo se comprobó que las pruebas sirven

Tres veces se **rompió el código a propósito** y se comprobó que algo se ponía rojo:

- Se quitó el candado que impide escribir una búsqueda a mano → **el compilador falla**.
- Se relajó la obligación de que siempre haya un «a quién» → **el compilador falla**.
- Se cambió el rechazo de la búsqueda dictada por el modelo por una **limpieza silenciosa** →
  **dos pruebas en rojo**.

Después se restauró todo. Una prueba que no se cae cuando quitas lo que vigila **no vigila nada**.

### Riesgo para el consultorio: nulo

**Cero archivos de producción modificados.** Cero pantallas, cero recetas, cero impresión, cero
cobros, cero reglas de seguridad. No se tocó el buscador de PubMed que ya funciona (su
regulador de velocidad fue el arreglo de aquel bug de *«a veces no salen las citas»*): sólo se le
puso **una entrada con forma** delante. El módulo **todavía no lo usa nadie**.

---

## Lo que se hizo antes: E1-02 · el diccionario de conceptos

Un catálogo de **35 conceptos** para que **«Creatinina», «Cr» y «creatinina sérica»** sean **el
mismo dato** y no tres gráficas distintas. El software está terminado y en verde, pero **la
unidad no está cerrada**: faltan cuatro respuestas suyas (*decisión 1*).

**🔴 Y sigue vivo el error que apareció buscando otra cosa:** una fila de laboratorio que diga
**«Vitamina K 10»** se dibuja hoy en su pantalla como **potasio 10** —una cifra que en un
paciente sería mortal—. Está **medido, no supuesto**. El diccionario nuevo **no hereda** el
fallo, pero **la pantalla vieja sí lo tiene**, y repararlo toca una pantalla en uso: es la
**autorización 1.e**.

## Y antes: E0-10 · seguridad del navegador · y E2-01 · Claim / Source / Passage

**E0-10:** 22 de las 34 pantallas privadas viajaban sin la instrucción que impide meterlas en un
marco invisible dentro de otra web (*clickjacking*). **Arreglado en el código y sin desplegar** —
mientras tanto el agujero sigue abierto (*decisión 2.a*).

**E2-01:** una afirmación clínica ya no se puede ni escribir **sin el fragmento de la fuente que
la respalda**. El agujero real (hoy, si el modelo cita el artículo 9 y sólo hay 6, **esa cita se
borra en silencio** y la frase se ve igual que una bien respaldada) **sigue abierto en la
pantalla de consulta** hasta E2-05.

---

## 👉 Lo siguiente

**Sin necesitar nada de usted:**

1. **E4-01 · Contrato del Safety Kernel** — que el veredicto de seguridad se pueda pedir **sin el
   LLM** y sea un valor, no un párrafo.
2. **E0-12 / E0-13** (sello de integridad, webhook de Stripe) — riesgo medio: probablemente
   entreguen **plan** antes que código.

**Ojo con la continuación natural de hoy:** **E2-03** (buscar en varias fuentes y ordenarlas por
calidad) **está bloqueada por la decisión 6**, no por falta de código: decidir que un
meta-análisis pesa más que una serie de casos es criterio clínico, no software.

**Con una respuesta corta suya** se cierra **E1-02** (decisión 1) y se desbloquea la reparación
del error de la «Vitamina K».

---

## Esperando decisión del médico

### 1. Cuatro preguntas de E1-02 + una autorización

Ninguna bloquea el resto del programa, pero las cuatro primeras son las que faltan para **cerrar**
la unidad. En todas quedó aplicado el comportamiento **más conservador**, nunca un valor inventado.

**a. ¿Le pongo códigos internacionales (LOINC) a los análisis de laboratorio?** Los **signos
vitales ya los tienen** en su app y se reutilizaron tal cual. Los **24 análisis no tienen
ninguno**, y **no los elijo yo**: para algo tan simple como la creatinina hay códigos **distintos**
según cómo se mida y según sea de **sangre u orina**, y ese código **sale de su consultorio**
dentro de la exportación clínica, donde otro sistema lo lee como verdad. O me da la tabla
validada, o me dice «publícalo sin códigos de laboratorio».
*Mientras tanto:* van vacíos, con un candado que impide que nadie los rellene a ojo.

**b. «PCR»: en su práctica, ¿proteína C reactiva o reacción en cadena de la polimerasa?** Hoy su
app lo interpreta **siempre** como proteína C reactiva — y por eso «PCR para influenza» acaba en
esa gráfica. Con módulo de infectología, el otro sentido aparece a diario.
*Mientras tanto:* «PCR» a secas **pregunta**; «proteína C reactiva» escrito completo funciona.

**c. ¿Qué abreviaturas quiere que se entiendan solas?** Hoy funcionan **Na, K, Cl, FA, Glu, ALP,
A1c, BUN, Hto, Hct, TSH** (más «Cr»). ¿Sobra alguna? ¿Falta alguna que usted teclea —**BH, QS,
ES, TP, TTP**—? Cada una que añada tiene que tener **un solo significado**.

**d. ¿«Creatinina» a secas es la de sangre?** Su app ya lo daba por hecho; ahora está escrito y
protegido. **Confírmelo**, porque fija el significado de todas las gráficas futuras.

**e. ⚠️ ¿Autorizo la reparación de la «Vitamina K»?** Exigir el **nombre completo** para las
abreviaturas de 1 a 3 letras y dejar la búsqueda dentro de la frase sólo para los nombres largos.
Son ~6 líneas **más su prueba de regresión**. Toca una pantalla viva, por eso pregunto.

### 2. ⚠️ Un despliegue urgente y cuatro preguntas (E0-10)

**a. Lo urgente no es una decisión, es un despliegue.** El arreglo del clickjacking está en el
código y **no en producción**. **No exige apretar la política de seguridad**: basta con desplegar.
Al desplegar, **subir la versión del Service Worker**.

**b. El conversor de PDF a imagen se descarga de un servidor ajeno (`unpkg.com`)** cada vez que
usted sube un laboratorio: código de un tercero ejecutándose en su sesión. Se puede guardar una
copia dentro de la app. Toca un flujo vivo, así que merece unidad propia. ¿Lo hacemos?

**c. ¿Sigue usando el Pixel de Meta y el alta de WhatsApp desde Configuración?** Si está apagado,
quito los permisos de Facebook y la superficie expuesta se encoge. Es un sí/no.

**d. ¿Aprieto la política a modo bloqueo?** **Mi recomendación: todavía no** — antes hace falta (e).

**e. ¿Creamos un usuario de prueba con datos INVENTADOS?** Hoy ninguna prueba automática entra a
la zona con sesión: ni expediente, ni nota, ni receta, ni farmacia. Es el punto ciego más grande
del proyecto.

### 3. El grafo no puede expresar 14 de los 35 datos que necesita primero *(bloquea E1-03)*

Está **medido** y fijado con un test. Al catálogo de unidades le faltan las más cotidianas de una
consulta: **lpm, rpm, °C, cm, kg/m² y «puntos»** (Glasgow, dolor), y de laboratorio **U/L**,
**10³/µL** y **µUI/mL**. La tensión «120/80» son **dos datos, no uno**.

**Hoy el comportamiento ya es seguro**: un dato con unidad desconocida **se rechaza
ruidosamente**, no se guarda a medias.

**Por qué no lo hice solo:** añadir °C obliga a **reescribir un candado que E0-04 puso a
propósito** («°C↔°F no es un factor, es una fórmula»).

> **Lo que necesito:** un «adelante». No hay criterio clínico de por medio (son unidades de
> medida, no umbrales), sólo el permiso para tocar el candado.

### 4. 🔓 Una línea suya cierra E0-09

Hoy, si enfermería captura mal una tensión, **la sobrescribe y la anterior desaparece**. E0-09
pide **anexar la corrección** dejando el valor erróneo visible y tachado (NOM-004). Su documento
`DECISIONES-ARQUITECTURA-2026-07-28.md` §A3 ya lo lista; el matiz es que habla de datos
**«finalizados/firmados»** y un signo vital no tiene ese estado.

> **Lo que necesito:** *«sí, aplica a los signos desde que se guardan»*. Con eso entra el parche
> de 3 líneas, ya escrito, en `unidades/E0-09/RESULTADO.parcial.json`.

### 5. ⏱️ Cinco minutos en GitHub — es lo que le falta a E0-11

El gate **avisa** pero no **bloquea**: impedir una fusión lo decide GitHub.
`github.com/docrod29-ai/agenda-medica` → **Settings → Rules → Rulesets → New branch ruleset**,
sobre `main`: (1) exigir pull request, (2) exigir que pasen **`clinical-safety`** y
**`verificar`**, (3) rama al día, (4) sin excepciones. Detalle en `docs/pendientes-externos.md` §3.

### 6. Tres preguntas sobre EVIDENCIA *(bloquean E2-03 y E2-04)* — ahora son el cuello de botella

Con E2-02 cerrada, **estas tres son lo único que separa al programa de la siguiente unidad de
evidencia**:

- **¿Qué pesa más?** Hoy el buscador **ya ordena** poniendo **las guías por encima de los ensayos
  clínicos**. Nadie validó eso y no lo di por bueno. Además no distingue cohortes, casos y
  controles, series de casos ni estudios en animales: caen todos en el mismo montón.
- **¿Y si la cita existe pero no dice lo que la afirmación afirma?** ¿La ve **marcada como no
  respaldada** o **no se le muestra**?
- **¿Y si dos fuentes buenas se contradicen?** Ya está decidido que se muestran las dos; falta
  saber si a partir de cierta antigüedad la guía se marca como *posiblemente superada*.

### 7. Las otras cuatro de E0-09 (definen *cómo* se corrige) — no bloquean

- **¿Un signo corregido sigue contando para el NEWS2 y el expediente FHIR?** Hoy el sistema **se
  niega a calcular** en vez de suponer.
- **¿Quién puede corregir?** ¿Puede enfermería anular una administración de medicamento?
- **¿Hay ventana de tiempo?** ¿Algo de hace cinco días? ¿Un paciente ya egresado?
- **¿El motivo escrito es obligatorio?** Lo pediría la NOM-004, pero encarece cada corrección.

### 8. ¿Ampliamos el catálogo de dosis del adulto? (E0-02, REG-043) — no bloquea

**20 de los 25** fármacos pediátricos no existen en el catálogo adulto. Al prescribirlos **a un
adulto**, el verificador dice «sin referencia» y no impone techo. Falta el máximo por toma y por
día de cada uno. **No se derivan de las cifras pediátricas y no los voy a inventar.**

### 9. ¿Qué análisis más deben convertirse entre mg/dL y µmol/L? (E0-04) — no bloquea

Arrancó con **creatinina y colesterol**; para cualquier otro devuelve «no lo sé». *Relacionado:*
**mEq/L no se convierte solo a mmol/L** — para sodio, potasio y cloro el número coincide; para
calcio y magnesio no.

### 10. Firma: ¿se construye el renderizado server-side? (E0-14, REG-014) — no bloquea

Recepción, farmacia y enfermería ya no pueden leer la firma, pero el médico autenticado sigue
recibiendo la imagen en su navegador porque la impresión es del lado del cliente.

### 11. Pendientes anteriores (E0-01), sin cambios

- **¿El pie IMPRESO de la receta debe leerse de la firma de la nota, no de la configuración?**
- **Al desplegar: subir la versión del Service Worker.**

### 12. Tres preguntas de E1-01 que **no** bloquean nada

- ¿Un mismo hecho puede tener **dos certezas a la vez**?
- Un laboratorio **preliminar**: ¿se muestra en la línea de tiempo o se esconde?
- ¿Confirma que los códigos UCUM son cosa de la **exportación** y no del almacenamiento?

### 13. 🆕 Dos preguntas de E2-02 — **nuevas hoy, ninguna bloquea**

**a. El fármaco que el paciente YA TOMA, ¿qué es en la búsqueda?** ¿El **tratamiento que se está
evaluando**, o parte de la **descripción del paciente** («pacientes con IVU recurrente **en
tratamiento con** nitrofurantoína»)? Cambia qué artículos devuelve PubMed.
*Mientras tanto:* cuenta como **tratamiento evaluado**, y basta un parámetro para cambiarlo.

**b. ¿Quiere que la edad se traduzca a una categoría («pediátrico», «anciano»…) en la búsqueda?**
**No inventé los cortes**: dónde empieza cada banda es criterio suyo.
*Mientras tanto:* la demografía **está apagada**; si se enciende, el sexo entra traducido y la
edad entra como cifra («34 years»), nunca como categoría.

---

## Deuda técnica anotada (para no perderla)

- 🔴 **El falso positivo de la «Vitamina K» sigue vivo en producción** (E1-02-H1). El diccionario
  nuevo **no lo hereda**, pero la pantalla vieja sí lo tiene. Espera la autorización 1.e.
- **Su app tiene DOS catálogos de análisis** que conviven (uno alimenta las gráficas, otro el
  copiloto de la consulta) con reglas ligeramente distintas. La duplicación es anterior a E1-02;
  fusionarlos toca dos caminos vivos a la vez, así que va aparte (E1-02-H2).
- **El agujero de las citas sigue abierto en producción.** E2-01 construyó la puerta, pero la
  pantalla de consulta usa el camino viejo. Se cierra en **E2-05**.
- 🆕 **Aviso para E2-05, escrito antes de que duela:** al enchufar la búsqueda por partes existe
  un riesgo **real y probable** de que devuelva **menos** artículos que la frase suelta de hoy.
  Por eso E2-02 entrega ya el aflojamiento por pasos y el camino de emergencia marcado, y por eso
  la recomendación es **cablearlo comparando A/B** (misma nota, búsqueda vieja contra búsqueda
  nueva, contar artículos) **antes** de retirar el camino viejo. No a ciegas.
- **E0-05 hereda un cabo suelto de E0-04.** La protección distingue *dimensiones* pero no
  *unidades* dentro de una dimensión: cambiar la etiqueta de `mg` a `µg` compila y produce un
  **error de escala de 1000×**. Hoy es inocuo, pero debe cerrarse **antes** de que un motor real
  lo consuma.
- **Lo que resta de E0** (E0-06 PHI, E0-12 sello de integridad, E0-13 webhook de Stripe) es de
  riesgo medio/alto y varias deben entregarse como **plan**. E0-05 va **por lotes**.
- **La política de seguridad sigue permitiendo `unsafe-inline`/`unsafe-eval`.** Quitarlo exige
  firmar cada script en cada petición; su riesgo típico es *pantalla en blanco*. Unidad aparte.
- **Punto ciego estructural: no hay usuario de prueba.** Ninguna prueba de navegador entra a la
  zona con sesión (decisión 2.e).

---

## Cómo se retoma

Relanzar el workflow `nexus-os`. Lee `estado.json`, comprueba en disco qué unidades tienen
`RESULTADO.json` y sigue en la primera pendiente. Es idempotente: relanzarlo nunca repite trabajo
ni pierde avance.

**Regla vigente:** un `RESULTADO.json` **no** es prueba suficiente por sí solo. Sólo cuenta si el
`VERIFICACION.json` de esa unidad no la declara *INCOMPLETA*. Lo refutado queda como
`RESULTADO.parcial.json` y **vuelve a la cola**.

**Sobre E1-02 en concreto:** su `RESULTADO.json` dice `necesita_validacion` a propósito. El
software está completo y en verde; con las respuestas 1.a–1.d, cerrarla es **editar tablas**
(`SINONIMOS_LAB`, los códigos y la lista de términos reservados en
`src/lib/clinical-fact/vocabulario.ts`) y bajar el número congelado. **No hay que rehacer el
diseño ni las pruebas.**

**Nota de la corrida de hoy:** el código de **E1-02** quedó en el árbol de trabajo **sin
commitear** por la corrida anterior (`src/lib/clinical-fact/vocabulario.ts`,
`src/__tests__/clinical-vocabulario.test.ts`, `src/__tests__/fixtures/conceptos.ts` y
`docs/roadmap/nexus-os/unidades/E1-02/`). E2-02 **no los tocó ni los commiteó**: siguen ahí,
verdes, esperando el commit de su propia unidad.
