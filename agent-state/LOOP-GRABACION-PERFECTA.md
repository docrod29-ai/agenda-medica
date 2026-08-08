# LOOP «GRABACIÓN PERFECTA»

**Abierto**: 7-ago-2026 · **Estado**: en curso · **Versión al abrir**: v1106

---

## EL OBJETIVO, CON SUS PALABRAS

> «tiene que ser la mejor herramienta para el médico, **única en el mundo**»
>
> «objetivo: tener la mejor aplicación de este tipo en el mundo, **que sorprenda
> al mejor programador y al mejor médico del mundo**»
>
> «que esté perfecto, que no tenga errores, que sea 100 % funcional, aplicable,
> útil, **simple pero complejo**, tecnológico, mejor que todas las aplicaciones»
>
> «sobre todo quiero mejorar **el proceso de grabación, el procesamiento de la
> nota y la nota final debe de ser perfecta**»

Ese último renglón es el que ordena el loop: **grabación → procesamiento → nota
final**. Todo lo demás es consecuencia.

---

## LO QUE PIDIÓ, TEXTUAL, Y DÓNDE SE ATIENDE

Ninguna iteración existe porque se me ocurriera. Cada una viene de una frase suya
o de una respuesta a las doce preguntas.

| Lo que dijo | Iteración |
|---|---|
| «me paras en seco y me dices que recupere el audio» | **I-1** ✅ |
| «que capte la grabación lo largo que sea y **no pare**» | **I-1** ✅ |
| «no llenas los apartados como es» | **I-2** ✅ · **I-3** |
| «no puedes entender en la grabación el motivo de consulta, el padecimiento actual, los antecedentes» | **I-3** |
| «**el plan debe ser cuando el médico diga el plan**» | **I-3** |
| «arreglar el flujo de grabación (**consulta, UCI y hospital**)» | **I-4** |
| «la mejor nota médica: **de primera vez, de seguimiento, historia clínica, evolución clínica**» | **I-4** · **I-5** |
| «nota como **internista, pediatra, ginecólogo, cirujano, intensivista, infectólogo** etcétera según sea el caso» | **I-5** |
| «dejas espacios porque la inteligencia no entendió» · «**deja dudas**» | **I-6** |
| «que sea más fácil, **con menos pasos**» · «que no tenga tantas maneras de confundirse» | **I-7** |
| «no me gusta nada, deja dudas» (confianza en la nota) | **I-8** |
| «necesito **mejor precisión, con el audio, mejor inteligencia artificial**» | **I-9** |
| «**me estás confundiendo medicamentos**» / antibióticos | **I-10** ✅ |
| «la receta es cuando ya te estén diciendo el plan» | **I-11** ✅ |
| «investiga a **Abridge, Suki, Nabla** (y Huli), toma ideas pero mejóralas, sé más original, **algo nunca antes visto**» | **I-12** |
| «utiliza **Google Chrome** y navega por toda la app para detectar conflictos, problemas, errores» | **I-13** |
| «utiliza **todos los agentes y expertos**» | Ver *El panel* |

### Y las doce respuestas

| # | Contestó | Obliga |
|---|---|---|
| 1 | Corta **antes de 10 min**, **igual en iPhone que en computadora** | Descarta el navegador: es aritmética → I-1 |
| 2 | Dicta **saltando de tema** | La nota no se arma por orden → I-2, I-3 |
| 3 | Huecos: **que la IA los complete** | Como propuesta que él acepta → I-6 |
| 4 | **Conversación** en consulta; **dictado** en UCI y hospital | Tres modos → I-4 |
| 5 | **Sí** a palabras clave, y que además adivine | Ancla + LLM → I-3 |
| 6 | Al cortarse, **recupera pero con pasos** | Tiene que ser solo → I-1 |
| 7 | Nota **«como la escribe un internista»**: prosa que razona | → I-5 |
| 8 | Lo usarán médicos de **CUALQUIER especialidad** | Configurable, no fijo → I-5 |
| 9 | Firma **con el paciente enfrente** | Cerrar en un gesto → I-7 |
| 10 | Receta en **papel, WhatsApp y PDF**, según el paciente | Los tres desde una pantalla → I-7 |
| 11 | Consentimiento **una vez por paciente** | Un paso menos → I-7 |
| 12 | Confianza: **que un segundo modelo la revise** | → I-8 |

### Dos respuestas que cambian el ALCANCE del producto

- **«Médicos de CUALQUIER especialidad»** — deja de ser una app para él. Todo lo
  que hoy está codificado con su criterio personal tiene que volverse
  **configurable**.
- **«El médico de esa especialidad, al usarla»** valida su propia rama. O sea:
  las primeras notas de un pediatra saldrán imperfectas **a propósito**, y la app
  tiene que dejarle corregirlas y **aprender de esas correcciones**.

---

## EL PANEL — qué experto entra en cada iteración

Pidió que se usen todos. Se usan **donde aportan**, no todos en todo.

| Experto | Entra en |
|---|---|
| Ingeniero de software / sistemas | I-1, I-4, I-7 (caminos, estados, límites de infraestructura) |
| Experto en programación | I-2, I-3 (motores deterministas y su conexión real) |
| Experto en inteligencia artificial | I-3, I-5, I-6, I-8, I-9 (prompt, modelos, medición) |
| Experto en apps médicas (Abridge, Suki, Nabla, Huli) | I-12, y revisión de I-7 |
| Clínicos por especialidad | I-5 — **proponen**, no aprueban solos |
| Equipo rojo | Cierre de cada iteración: intenta refutar el arreglo |
| Seguridad del paciente | I-3, I-5, I-6 (todo lo que pueda afirmar algo falso) |

---

## LAS REGLAS DEL LOOP

1. **No para hasta terminar.** Se sigue sin preguntar entre iteraciones. Sólo se
   detiene ante algo que sólo él puede decidir, y se dice cuál es.
2. **Una iteración por vez**, cerrada y desplegada antes de la siguiente.
3. **Reproducir antes de reparar.** Ninguna empieza sin un caso que falle de
   verdad. Los cinco defectos de hoy salieron así, no leyendo código.
4. **Nunca una cifra clínica inventada.** Ni dosis, ni umbral, ni percentil. Lo
   que falte se marca `NEEDS_CLINICAL_REVIEW` y se sigue con otra cosa.
5. **Cada iteración deja un guardián** que falla si el defecto vuelve, y una
   entrada en el ledger con su causa raíz.
6. **Lo que no se puede medir, no se declara arreglado.**

---

# LAS ITERACIONES

## I-1 · Que la grabación no se corte — ✅ CERRADA (v1107)

> «me paras en seco» · «que capte lo largo que sea y no pare»

**Causa** — a los 7 min 30 s (3,6 MB a 64 kbps) el audio deja de caber en el
cuerpo de la petición y cambia al camino «grande»: subir a Storage y pedir la URL
con `getDownloadURL()`. La regla decía `allow read: if false` → fallaba en el
primer segundo, y el error se etiquetaba «tiempo agotado».

Misma causa raíz que v245 en el otro bucket. Igual en iPhone que en computadora
porque **es aritmética de bytes**.

**Tres daños colaterales reparados con él**: el motivo que mentía; el texto en
vivo que se tiraba cuando era lo único que quedaba; la recuperación que siempre
tomaba el camino roto.

**Cierra con** — REG-225 · `la-grabacion-larga-no-muere.test.ts` (11 casos).
**Comprobación pendiente del Dr.** — grabar **más de ocho minutos** y ver que la
nota sale con voces separadas.

---

## I-2 · Que la primera versión no congele el apartado — ✅ CERRADA (v1107)

> «no llenas los apartados como es»

`if (enVivo && s.value?.trim()) return s` congelaba el apartado en cuanto
cualquiera escribía algo — **incluido un pase anterior de la propia IA**, cada
15 s, con el modelo rápido, el primero con la consulta apenas empezada.

**Cierra con** — REG-226 · `la-nota-no-sale-hueca.test.ts`, ampliado.

---

## I-3 · El dictado que salta: anclas + regla

> «el plan debe ser cuando el médico diga el plan» · «no puedes entender el
> motivo de consulta, el padecimiento actual, los antecedentes»

**Lo que falta hoy, verificado** — el reparto por apartados lo decide el modelo
**entero**, sin un solo ancla determinista y **sin ninguna regla que contemple
que el médico salta de tema y regresa**. Y el repo ya tiene escritos los patrones
para detectar «el plan es…», «indico…», «suspendo…» (`uci/discusion.ts`), sólo
que se usan para decidir **quién habla**, no **de qué apartado se habla**.

**Qué se construye**
- Motor determinista de **anclas de apartado**: dicho «plan», «antecedentes»,
  «exploración», todo lo que sigue va ahí, **seguro**, sin criterio del modelo.
- Si **no** dice ninguna, el LLM reparte como hoy (él pidió las dos cosas).
- Regla nueva en el prompt: el dictado **no es lineal**; el médico vuelve sobre
  temas ya tratados y **lo último que diga de un tema es lo que vale**.
- Que la nota diga **qué frase ancló cada apartado**, para poder auditarlo.

**Cierra con** — guardián con frases reales de dictado no lineal.
**Bloqueado en el Dr.** — la lista de palabras ancla es contenido clínico: la
propone él.

---

## I-4 · Un motor, tres modos, cuatro notas — ✅ CERRADA (v1108)

> «el flujo de grabación (consulta, UCI y hospital)» · «la mejor nota médica: de
> primera vez, de seguimiento, historia clínica, evolución clínica»

**Tres modos**: consulta = conversación entre dos; UCI = él dictando por aparatos
y sistemas; hospital = él dictando la evolución.

Hoy la separación de voces se pide **igual en los tres**. En un dictado de una
sola voz eso es trabajo inútil que además **inventa un «paciente» que no habló**.

**Cuatro notas que tienen que salir perfectas**: primera vez, seguimiento,
historia clínica, evolución. Seguimiento y evolución son SOAP; las otras dos no.
Lo que hoy les falla es el reparto (I-3) y la prosa (I-5).

**Lo que se construyó** — dos piezas, en este orden:

**1 · La red** (`esMonologo`) — si al final hubo un solo hablante, no se arma
diálogo: va texto plano. Funciona pase lo que pase.

**2 · El ahorro** (`esDictado`) — si el tipo de nota es de dictado, ni se pide la
separación de voces. UCI siempre; en consulta, según el tipo.

El orden importa: con la red puesta, equivocarse clasificando sólo cuesta una
diarización inútil. Sin ella, un tipo mal clasificado se traga la conversación
real.

La lista de dictado es corta a propósito —`evolucion_uci` y `evolucion`, las dos
que él nombró—. El INGRESO no entra aunque sea de hospital: se hace interrogando
al paciente. **Ante la duda, se diariza.**

**Cierra con** — REG-227 · `un-monologo-no-es-un-dialogo.test.ts` (16 casos).

---

## I-5 · La nota como la escribe cada especialista — ✅ CERRADA (v1111)

> «nota como internista, pediatra, ginecólogo, cirujano, intensivista,
> infectólogo etcétera según sea el caso» · «como la escribe un internista: prosa
> que razona»

Hoy hay **17 guías de especialidad fijas en el código**. Con médicos de cualquier
rama eso no escala.

**Qué se construye**
- El perfil de especialidad como **dato configurable por médico**, sembrado con
  las 17 que ya existen.
- El **motivo de consulta** como segunda capa (`GUIA_MOTIVOS` ya existe), y que
  la nota **diga qué plantilla usó** — él lo pidió así.
- **Prosa que razona**: que el análisis conecte hallazgos con diagnóstico y
  justifique el plan, en vez de enumerar.
- Que las correcciones del médico **alimenten** su perfil (lo exige la respuesta
  «el médico de esa especialidad valida al usarla»).

**Lo que se construyó**
- Las 16 guías salieron de `prompts.ts` a `guias-de-especialidad.ts`, como DATOS
  con procedencia (`repositorio` / `del_medico`). Comprobado antes de tocar: el
  prompt resultante es **idéntico byte a byte**.
- **La del médico manda sobre la del repositorio**, y puede añadir una rama nueva
  — que es lo que exige «cada especialista valida su propia rama al usarla».
- **Cuando NO hay guía, se dice.** Antes caía a genérico en silencio.
- Regla 14-bis: **la prosa razona, no enumera** — conecta hallazgo → síndrome →
  diagnóstico → plan, y ata cada indicación a lo que la justifica. Sin aflojar la
  prohibición de inventar: razonar no es rellenar.
- Un guardián falla si el menú ofrece una especialidad **sin** guía.

**Un defecto que encontró su propia prueba** — «Infectología pediátrica» caía en
PEDIATRÍA sólo porque `pediatr` estaba antes en la lista. Ahora gana la raíz que
aparece **antes en el texto**: en español el núcleo del nombre va primero.

**Límite duro, sin cambios** — no se redacta criterio clínico de ramas que el
dueño no ejerce. Las dieciséis están porque ya estaban.

**Cierra con** — REG-230 · `la-nota-la-escribe-un-especialista.test.ts`
(19 casos). Prompt `nota-2026-08-07-4`.

---

## I-6 · Los huecos se completan como propuesta — ✅ CERRADA (v1109)

> «dejas espacios porque la inteligencia no entendió» · «no me gusta nada, deja
> dudas»

Pidió que la IA rellene lo que falta. Se hace — **marcado y sin entrar solo**.

Una nota es un documento legal con su firma: si dice «niega tabaquismo» y el
paciente nunca lo dijo, **eso lo afirmó él**. La maquinaria existe a medias
(`sugerenciasPendientes`, marcas `[IA — no dictado]`); falta que **redacte la
propuesta** y que se acepte con un toque.

**Las dos fronteras que lo hacen seguro**

**1 · Sólo en el pase FINAL.** La nota se estructura sola cada 15 s y la primera
pasada ocurre con la ficha de identificación apenas dictada. Con la propuesta
activa ahí, esa pasada rellenaría la consulta entera antes de la primera palabra
clínica — que es exactamente lo que pasó con REG-217. Durante la consulta, un
apartado vacío sigue diciendo que falta.

**2 · Ninguna cifra.** Una sección propuesta se lee, se juzga y se acepta o se
borra. Una CIFRA propuesta se lee **idéntica a una medida real**, y ahí ya nadie
puede distinguirlas. Si un apartado sólo se podría llenar con cifras, se queda
vacío.

**Cierra con** — REG-228 · `los-huecos-se-proponen-marcados.test.ts` (15 casos).
Prompt `nota-2026-08-07-3`.

**Pendiente** — lo dudoso subrayado dentro de la nota (respuesta 8) se hace en
I-8, junto con el segundo modelo.

---

## I-7 · Menos pasos para cerrar la consulta — ✅ PARCIAL (v1112)

> «que sea más fácil, con menos pasos» · «que no tenga tantas maneras de
> confundirse»

**Hoy son 15 pasos y 3 pantallas.** Cuatro de esos pasos existen sólo porque el
sistema se equivocó antes; I-1 a I-3 los quitan.

**Qué se construye**
- Consentimiento **una vez por paciente**.
- El pase final ya corre solo al detener: quitar el «Procesar con IA» manual.
- **Una sola pantalla de cierre**: nota + lo que falta + firmar.
- **Firmar deja la receta lista en los tres canales** —papel, WhatsApp y PDF— y
  **el cobro registrado**. Sin saltar de pantalla.

**Hecho en v1112**
- **Consentimiento una vez por paciente**: queda en el expediente con quién lo
  recabó y cuándo. Ausente = nunca se pidió; no se asume otorgado jamás.
- **Los avisos rojos dejan de tapar la nota.** La barra sólo lleva los cinco de
  PRESCRIPCIÓN —que tienen que llegar mientras receta—; los de revisión del
  texto aparecen al firmar, que es cuando sirven.
- La distinción sale del campo `ancla.seccion` que cada aviso ya traía: no hay
  lista nueva que mantener.

**Lo que NO se mueve, y es deliberado** — los cinco de prescripción (alergia ↔
fármaco, sobredosis, dosis incompleta, interacción, vía) tienen que llegar
**mientras receta** o no sirven. Eso ya costó dos regresiones (REG-173, REG-190).

**Cierra con** — REG-231 · `menos-pasos-para-cerrar-la-consulta.test.ts` (19).

**Queda pendiente de esta iteración**
- Quitar el «Procesar con IA» manual (el pase final ya corre solo al detener).
- La pantalla única de cierre.
- Que firmar deje la receta lista en los tres canales y el cobro registrado.
Son cambios grandes de pantalla sobre un archivo de 5 300 líneas con pruebas
selladas: van en su propia iteración, no de propina.

---

## I-8 · El segundo modelo que revisa — ✅ CERRADA (v1110)

> Respuesta 12: «que un segundo modelo la revise»

Ya existía y corría sola. **Ése era el problema**: después de que corre, el
médico edita —corrige un apartado, cambia una dosis, acepta las líneas
propuestas— y el panel seguía diciendo en verde «sin observaciones de seguridad»
de una versión del texto que ya no existe.

Un sello sobre un texto que cambió no es una garantía: es una garantía caducada
que **se lee igual que una vigente**. Peor que no tenerla, porque invita a no
releer — que es justo para lo que él la quería.

**Lo que faltaba** era una huella estable de lo que se revisó, para poder
comparar. Se ordena antes de medir (reordenar la lista no puede caducar una
revisión válida), lleva separador de campo, y una sección vacía no cuenta.

**No bloquea**: bloquear por una revisión caducada convertiría cada coma en un
trámite y el médico aprendería a esquivarlo. Lo que faltaba no era otra
compuerta, era poder decir la verdad.

**Cierra con** — REG-229 · `lo-revisado-es-lo-que-se-firma.test.ts` (18 casos).

---

## I-9 · Más precisión en el audio

> «necesito mejor precisión, con el audio, mejor inteligencia artificial»

Iteración aparte porque **no se arregla con prompts: se mide y se sube**.

**Lo que ya sabemos, medido** — error de transcripción **25,55 % en crudo** y
**22,81 % con el pipeline** (REG-159). Menos de 3 puntos de ganancia: poco para
lo que cuesta mantenerlo.

**Qué se construye**
- Volver a medir sobre **dictado real suyo**, no sobre el corpus viejo.
- El vocabulario que se le manda al reconocedor cabe en **224 tokens** y hoy se
  llena con criterio genérico. Debe llenarse con **los fármacos y términos de
  ESTE paciente y ESTA especialidad**, que ya tenemos.
- La cascada de motores: medir **cuál acierta más en español mexicano** y ponerlo
  primero, en vez del orden actual.
- **Dosis y unidades** merecen el mismo trato que ya tienen los antimicrobianos
  (I-10): nunca sustituir por parecido.

**Cierra con** — una cifra nueva medida sobre su dictado, publicada como la
anterior. **Sin cifra no se declara mejorado.**

---

## I-10 · Que no confunda medicamentos — ✅ CERRADA (v1106)

> «me estás confundiendo medicamentos» / «me estás confundiendo antibióticos»

Reproducido con el pipeline de producción, **con cero avisos**:

```
«Le doy azitro micina cinco días»  →  «Le roxitromicina 5 días»
«Doy mico nazol tópico»            →  «Voriconazol tópico»
«Le doy neo micina tópica»         →  «Le lincomicina tópica»
«lleva cefa lotina»                →  «lleva cefazolina»   (siempre)
```

Regla nueva: **un antimicrobiano sólo se acepta si coincide exacto**. Barrido de
los 126 del catálogo: antes 118 sustituciones, ahora cero.

**Cierra con** — REG-220 · `un-antibiotico-no-se-convierte-en-otro.test.ts`.
**Pendiente en I-9** — el mismo trato para dosis y unidades.

---

## I-11 · La receta sólo con lo del plan — ✅ CERRADA (v1106)

> «no me gusta que hagas la receta con lo que te digo de antecedentes, la receta
> es cuando ya te estén diciendo el plan»

Dos causas: el eje `procedenciaClinica` existía en el tipo, el prompt y una
prueba sellada, pero **el validador lo borraba** antes de salir del servidor; y
la lista **acumulaba** de los ~40 pases en vivo.

**Cierra con** — REG-221 · `que-va-en-la-receta.test.ts`.

---

## I-12 · Abridge, Suki, Nabla y Huli

> «investiga a Abridge, Suki y Nabla, toma ideas pero mejóralas, sé más original,
> **que sea algo nunca antes visto**, pero ve cómo lo hacen ellos y agarra una
> idea»

**Estado** — investigación en curso. Se llenará con: cómo captura cada uno el
audio, cómo estructura la nota, cómo maneja la especialidad, cómo demuestra que
no alucina, **qué NO hacen**, y —lo que importa— **tres huecos que ninguno
cubre**.

**Lo que ya se sabe sin investigar**: ninguno está hecho para México —español
mexicano, NOM-004/NOM-024, receta impresa con cédula— y **ninguno hace
antibiograma ni PROA**. Ése es terreno propio, no copiado.

**Regla** — nada entra aquí sin fuente. Una cifra de marketing se etiqueta como
marketing.

---

## I-13 · Barrido de toda la app con el navegador

> «utiliza Google Chrome y navega por toda la app para detectar conflictos,
> problemas, errores etcétera»

Recorrer la app con un navegador real y un teléfono emulado, buscando lo que
ninguna prueba unitaria ve. **Va al final, no al principio**: primero hay que
arreglar lo que ya sabemos que está roto.

Los cuatro defectos de la portada (v1104-v1105) salieron exactamente así, y
ninguno era visible desde el código.

---

## LO QUE ESTE LOOP NO VA A HACER

- **Redactar criterio clínico de especialidades que el dueño no ejerce.** Se
  construye la máquina; el contenido lo pone quien la ejerce.
- **Rellenar la nota con lo probable sin marcarlo.** Ver I-6.
- **Mover los avisos de prescripción al final.** Ver I-7.
- **Declarar arreglado lo que no se pueda medir.** I-1 no está comprobada hasta
  que una grabación real de más de ocho minutos salga con voces separadas.

---

## BLOQUEADO EN EL DR.

| Qué | Para |
|---|---|
| Grabar **8+ minutos** y decir si salió bien | Cerrar I-1 |
| La lista de **palabras ancla** que dice al cambiar de tema | I-3 |
| Una nota real con **demasiados diagnósticos**: cuántos y cuáles sobraban | Afinar el tope |
