# LOOP «GRABACIÓN PERFECTA»

**Abierto**: 7-ago-2026 · **Estado**: en curso · **Versión al abrir**: v1106

Loop finito y reanudable. **Una iteración por vez, cerrada y desplegada antes de
empezar la siguiente.** Si se corta la sesión, se retoma leyendo este archivo:
cada iteración dice qué la cierra y cómo se comprueba.

---

## De dónde sale

De doce preguntas al médico dueño, contestadas el 7-ago-2026. No es una lista de
ideas: **cada iteración existe porque una respuesta suya la exige**.

| # | Lo que contestó | Qué obliga |
|---|---|---|
| 1 | Corta **antes de 10 min**, **igual en iPhone que en computadora** | Descarta el navegador. Es aritmética → **I-1** |
| 2 | Dicta **saltando de tema** | La nota no se puede armar por orden → **I-2, I-3** |
| 3 | Los huecos: **que la IA los complete** | Pero como propuesta que él acepta → **I-6** |
| 4 | Graba **conversación** en consulta, **dictado** en UCI y hospital | Tres modos distintos, un solo motor → **I-4** |
| 5 | **Sí** a palabras clave, y que además adivine | Ancla determinista + LLM → **I-3** |
| 6 | Al cortarse, **recupera pero con pasos** | La recuperación tiene que ser sola → **I-1** |
| 7 | Nota **«como la escribe un internista»**: prosa que razona | → **I-5** |
| 8 | Lo usarán médicos de **cualquier especialidad** | La nota se adapta a la rama → **I-5** |
| 9 | Firma **con el paciente enfrente** | Cerrar todo en un gesto → **I-7** |
| 10 | Receta en **papel, WhatsApp y PDF**, según el paciente | Los tres desde la misma pantalla → **I-7** |
| 11 | Consentimiento **una vez por paciente** | Quitar un paso de cada consulta → **I-7** |
| 12 | Confianza: **que un segundo modelo la revise** | → **I-8** |

Y dos respuestas que **cambian el alcance del producto**, no sólo del loop:

- **«Médicos de CUALQUIER especialidad»** — deja de ser una app para él. Todo lo
  que se codifique con su criterio personal tiene que volverse configurable.
- **«El médico de esa especialidad, al usarla»** valida su propia rama. O sea:
  las primeras notas de un pediatra saldrán imperfectas **a propósito**, y la
  app tiene que dejarle corregirlas y aprender de eso.

---

## Reglas del loop

1. **Una iteración por vez.** Se cierra —desplegada y verificada— antes de la
   siguiente. Nada de ramas paralelas.
2. **Reproducir antes de reparar.** Ninguna iteración empieza sin un caso que
   falle de verdad. Los cuatro defectos de hoy se encontraron así, no leyendo.
3. **Nunca una cifra clínica inventada.** Ni dosis, ni umbral, ni percentil. Lo
   que falte se marca `NEEDS_CLINICAL_REVIEW` y se sigue con otra cosa.
4. **Cada iteración deja un guardián** que falla si el defecto vuelve, y una
   entrada en el ledger con su causa raíz.
5. **Lo que no se puede medir, no se declara arreglado.**

---

## I-1 · Que la grabación no se corte — **CERRADA** (v1107)

**Causa** — a los 7 min 30 s (3,6 MB a 64 kbps) el audio deja de caber en el
cuerpo de la petición y cambia al camino «grande», que subía a Storage y pedía
la URL con `getDownloadURL()`. La regla de Storage decía `allow read: if false`:
fallaba en el primer segundo, y el error se etiquetaba «tiempo agotado».

Tres daños colaterales reparados con él: el motivo que mentía, el texto en vivo
que se tiraba cuando era lo único que quedaba, y la recuperación que siempre
tomaba el camino roto.

**Cierra con** — REG-225 · `la-grabacion-larga-no-muere.test.ts` (11 casos).
**Se comprueba** — grabando **más de ocho minutos** y viendo que la nota sale
con voces separadas. Requiere `npx firebase deploy --only storage`.

---

## I-2 · Que la primera versión no congele el apartado — **CERRADA** (v1107)

**Causa** — `if (enVivo && s.value?.trim()) return s` congelaba el apartado en
cuanto cualquiera escribía algo, incluido un pase anterior de la propia IA. Con
el pase en vivo cada 15 s y el modelo rápido, la peor versión se quedaba fija.

**Cierra con** — REG-226 · `la-nota-no-sale-hueca.test.ts`, ampliado.

---

## I-3 · El dictado que salta: anclas + regla

**Lo que falta hoy** — el reparto por apartados lo decide el modelo entero, sin
una sola regla que contemple que el médico salta de tema y regresa. Y el repo ya
tiene escritos los patrones para detectar «el plan es…» (`uci/discusion.ts`),
sólo que se usan para decidir **quién habla**, no **de qué apartado se habla**.

**Qué se construye**
- Un motor determinista de **anclas de apartado**: cuando el médico dice «plan»,
  «antecedentes», «exploración», todo lo que sigue va a ese apartado, seguro.
- Cuando **no** dice ninguna, el LLM reparte como hoy.
- Una regla nueva en el prompt que le diga al modelo, con estas palabras, que el
  dictado **no es lineal**: el médico vuelve sobre temas ya tratados y lo último
  que diga de un tema es lo que vale.

**Cierra con** — un guardián con frases reales de dictado no lineal, y la regla
citada en el ledger. **Ojo**: la lista de palabras ancla es contenido clínico —
la propone el médico, no yo.

---

## I-4 · Un motor, tres modos

Consulta = conversación entre dos. UCI y hospital = él dictando solo. Hoy la
diarización se pide igual en los tres, y en un dictado de una sola voz eso es
trabajo inútil que además puede partir el texto en turnos falsos.

**Qué se construye** — que el modo se derive del tipo de nota, no de una opción
más en pantalla.

---

## I-5 · La nota como la escribe cada especialista

Hoy existen 17 guías de especialidad en el prompt. Con médicos de **cualquier**
rama, eso tiene que dejar de ser una lista fija en el código.

**Qué se construye**
- El perfil de especialidad como **dato configurable por médico**, no como
  constante. Se siembra con las 17 que ya hay.
- El **motivo de consulta** como segunda capa (ya existe `GUIA_MOTIVOS`), y que
  la nota diga qué plantilla usó — él lo pidió así.
- La prosa de internista: que el análisis **conecte** hallazgos con diagnóstico y
  justifique el plan, en vez de enumerar.

**Límite duro** — yo construyo la máquina y la relleno con lo que el repo ya
tiene. Lo que falte de pediatría, gineco o cirugía se marca
`NEEDS_CLINICAL_REVIEW`: **no voy a redactar criterio clínico de ramas que el
dueño no ejerce**.

---

## I-6 · Los huecos se completan como propuesta

Él pidió que la IA rellene lo que falta. Se hace — **marcado y sin entrar solo**.

Una nota es un documento legal con su firma: si dice «niega tabaquismo» y el
paciente nunca lo dijo, eso lo afirmó él. La maquinaria ya existe a medias
(`sugerenciasPendientes`, las marcas `[IA — no dictado]`); falta que redacte la
propuesta y que se acepte con un toque.

---

## I-7 · Firmar cierra la consulta entera

Hoy son 15 pasos y 3 pantallas. Cuatro de esos pasos existen sólo porque el
sistema se equivocó antes (I-1 a I-3 los quitan).

**Qué se construye** — consentimiento una vez por paciente; el pase final que
ya corre solo al detener; y **una sola pantalla de cierre**: nota + lo que falta
+ firmar, donde firmar deja la receta lista (papel, WhatsApp o PDF) y el cobro
registrado.

Los avisos de prescripción **no** se mueven ahí: alergia ↔ fármaco, sobredosis,
dosis incompleta, interacción y vía tienen que llegar **mientras receta** o no
sirven de nada. Eso ya costó dos regresiones (REG-173, REG-190).

---

## I-8 · El segundo modelo que revisa

Su respuesta a «qué te haría confiar sin releerla entera». Ya existe
`/api/expediente/verificar-nota`; falta que sea parte del cierre y no una opción,
y que lo que reporte sea accionable, no un párrafo.

---

## I-9 · Barrido de toda la app con el navegador

Al final, no al principio: recorrer la app con un navegador real y un teléfono
emulado, buscando lo que ninguna prueba unitaria ve. Los cuatro defectos de la
portada salieron así.

---

## Lo que este loop NO va a hacer

- **Redactar criterio clínico de especialidades que el dueño no ejerce.** Se
  construye la máquina; el contenido lo pone quien lo ejerce.
- **Rellenar la nota con lo probable sin marcarlo.** Ver I-6.
- **Mover los avisos de prescripción al final.** Ver I-7.
- **Declarar arreglado lo que no se pueda medir.** I-1 no está comprobada hasta
  que una grabación real de más de ocho minutos salga con voces separadas.
