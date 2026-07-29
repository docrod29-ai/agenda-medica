# Nexus OS — dónde vamos

> **En 30 segundos.** Van **9 de 68** unidades cerradas. En esta corrida cerró
> **E0-10 · CSP + E2E de seguridad**, y de paso apareció **un agujero de seguridad real que
> nadie había pedido buscar**: **22 de las 34 pantallas privadas de la app** —incluidas
> `/uci`, `/hospitalizacion`, `/receta` y `/superadmin`— **se pueden meter hoy dentro de un
> iframe invisible de cualquier página web**. Ya está arreglado en el código; **falta
> desplegarlo**. Ver *Esperando decisión · 1*.
> **Lo siguiente que puedo hacer solo es E2-02 · Extractor PICO** o **E4-01 · Safety Kernel**.
> Ninguna de las dos necesita decisión suya.

Última corrida: `2026-07-29T11:25:21Z`. `tsc` verde · **2276 tests verdes** (+24) · `build`
verde **en los dos modos de la política** · **nada desplegado, sin `push`**.

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
| E2-01 | Una afirmación no existe sin el fragmento de la fuente que la respalda | ✅ cerrada |
| **E0-10** | **Nadie puede meter sus pantallas en un iframe · interruptor de la política de seguridad** | ✅ **cerrada *(hoy)*** — ⚠️ **pendiente de desplegar** |
| E0-11 | El CI protege los invariantes clínicos | 🟡 código listo — espera 5 min suyos en GitHub |
| E0-09 | El registro del hospital no se edita: se corrige anexando | 🟡 bloqueada — espera 1 línea suya |

**9 cerradas · 2 esperándole · 57 sin empezar.**

---

## Qué se hizo hoy: E0-10 · seguridad del navegador

### Lo importante primero: el agujero que apareció buscando otra cosa

El navegador tiene una defensa contra un truco viejo y muy eficaz: **el clickjacking**. Alguien
monta una página cualquiera, mete **su** app dentro en un marco invisible, y lo que usted cree
que está clicando en esa página en realidad lo está clicando **dentro de su sesión abierta de
NexusMED**. La app manda una instrucción («a mí no me metas en un marco») para impedirlo… pero
**la lista de pantallas protegidas se había quedado vieja**.

Medido, no estimado: **22 de las 34 pantallas de la zona privada viajaban sin esa instrucción**.
Entre ellas **`/uci`, `/hospitalizacion` y `/receta`** —que pintan datos de pacientes— y
**`/superadmin`**, que es su consola de dueño.

Ya está arreglado, y arreglado de forma que **no se pueda repetir**: la lista se sacó a un
archivo propio y hay una prueba que la compara con las pantallas que existen de verdad. Si
mañana alguien añade una pantalla nueva y se le olvida protegerla, **el CI se pone rojo**.

> ⚠️ **Esto está en el código, no en producción.** Yo no despliego (es una regla del programa).
> Hasta que se despliegue, el agujero sigue abierto.

### Lo segundo: el interruptor de la política, listo para cuando usted quiera

La app ya manda una lista de «de dónde acepto cargar cosas» (la CSP), pero **en modo aviso**:
apunta lo que sería sospechoso y no bloquea nada. El paso natural es pasarla a **modo bloqueo**.
Hacerlo a ciegas era peligroso, y aquí está el porqué — tres cosas que la app carga hoy **no
estaban en la lista**, así que el modo bloqueo las habría matado **en silencio**:

- el componente que convierte **PDF a imagen** → se cae *subir un laboratorio*, *el antibiograma
  por foto* y *la receta por visión*;
- el marco de **la videoconsulta** → se vería **en blanco**;
- los scripts de **Meta** → deja de medirse la publicidad y se rompe el alta de WhatsApp.

Los tres están ya declarados. Y Meta se concedió **sólo en la portada, el registro y la
configuración** — nunca en el área clínica, porque las direcciones de esa zona llevan
identificadores de paciente y Meta no tiene por qué verlas.

Además apareció una trampa fina: **apretar la política habría debilitado la protección
anti-iframe** de la zona con datos de pacientes, por cómo el sistema resuelve reglas que chocan.
Corregido y fijado con pruebas en los dos modos.

El cambio a modo bloqueo es ahora **una variable de entorno**, no un cambio de código: se activa
y se revierte en unos dos minutos. Con una salvaguarda deliberada: **cualquier valor que no sea
exactamente `enforce` deja la política en modo aviso**, para que una errata nunca empiece a
bloquear recursos en una app clínica.

### Cómo se comprobó que las pruebas sirven

Se **quitaron a propósito** `/uci` y `/superadmin` de la lista protegida —o sea, se reintrodujo
el agujero real— y el CI **se puso rojo** señalándolo por su nombre. Después se restauró. Un
test que no se cae cuando quitas lo que vigila no vigila nada.

### Lo que esta unidad NO puede prometerle

La frase del plan era «modo bloqueo sin romper flujos». **Sólo lo puedo afirmar del camino
público** (portada, precios, login, registro, páginas legales). **De la zona con sesión iniciada
no**: no existe un usuario de prueba con datos ficticios, así que ninguna prueba automática
entra a expediente, nota, receta o farmacia. Es justo donde el modo bloqueo podría romper algo
sin avisar. Por eso **no recomiendo apretar la política** hasta resolver eso (decisión 1.d).

---

## Lo que se hizo antes: E2-01 · Claim / Source / Passage

**El problema, y no es teórico: está en producción hoy.** Cuando la IA le da un análisis con
evidencia, cada afirmación viene con unos números de cita (`[1]`, `[3]`). El código que las
pinta hace, literalmente, «quédate sólo con las citas que existen». **Si el modelo cita el
artículo 9 y sólo hay 6, esa cita se borra sin decir nada** y la afirmación aparece en pantalla
*exactamente igual* que una bien respaldada: misma viñeta, mismas negritas, ninguna marca. Y el
propio instructivo que se le da al modelo permite explícitamente que una afirmación venga **sin
ninguna cita**. Es decir: hoy, una afirmación clínica sin respaldo se le muestra como hecho.

**Lo que se construyó.** Las tres piezas que faltaban para que eso deje de poder ocurrir:

- **Source** — el documento recuperado, con **dos fechas distintas** (cuándo se publicó y
  cuándo lo recuperamos) y con la fecha de publicación **a la precisión que de verdad había**:
  si PubMed sólo da el año, se guarda el año, no se inventa un «1 de enero».
- **Passage** — *la pieza que no existía en ninguna parte del sistema*: **el fragmento textual
  de la fuente** que respalda la afirmación. Una paráfrasis no es un pasaje.
- **Claim** — la afirmación en español **con uno o más pasajes**. Cero pasajes no es una opción.

**La promesa era una sola frase: «una afirmación sin pasaje de respaldo no puede
construirse».** Y se verificó **intentando romperla**, que es la parte que importa:

- Se intentó crear una afirmación **con cero citas** → rechazada. No es que esté prohibida:
  **no se puede ni escribir**.
- Se intentó **fabricar a mano** un pasaje de respaldo, saltándose la verificación → imposible.
- Se intentó **una cita fuera de rango** (el artículo 9 de una lista de 6) → **rechazada con
  motivo**, en vez de borrada en silencio como hoy.
- Se intentó respaldar una afirmación con **una paráfrasis** en vez del texto de la fuente →
  rechazada.
- Se intentó colar una **cifra que no está en el pasaje** (afirmar «riesgo 0.35» citando un
  pasaje que dice 0.72) → rechazada.
- Se intentó guardar un estudio diciendo que **«no tiene limitaciones»** dejando la lista vacía
  → rechazado: hay que decir si es que **la fuente no las declaró** o que **no las extrajimos**.
  Son cosas distintas y la ambigüedad se lee como la más peligrosa de las dos.
- Se intentó usar una fuente **de licencia dudosa** (UpToDate, ClinicalKey, CLSI) → no compila.
  Eso codifica la decisión que usted ya tomó, no un criterio nuevo.
- Se intentó **manipular la base de datos** para que un documento guardado pareciera respaldado
  → al volver a leerlo se revisa el pasaje contra la fuente otra vez, y no pasa.

**Control obligatorio, ejecutado tres veces:** se *quitaron a propósito* las defensas clave y se
comprobó que el CI **se pone rojo** cada vez — incluso se reintrodujo el bug real de producción
(el descarte silencioso de citas) para confirmar que el test lo caza. Después se restauró todo.
Un test que no se cae cuando quitas lo que vigila no vigila nada.

**Riesgo para el consultorio: nulo.** **Cero archivos de producción tocados** y cero pantallas
que usen esto todavía. Cero recetas, cero impresión, cero cobros, cero reglas de seguridad.
`npm run build` compila las 127 páginas igual que antes.

**Lo que E2-01 deliberadamente NO hace, y conviene que lo sepa:**

- **No decide qué evidencia pesa más.** Que una guía valga más o menos que un ensayo clínico es
  criterio metodológico suyo, no de un agente. Hoy el sistema **ya ordena** los resultados con
  una jerarquía que nadie validó (pone las guías por encima de los ensayos); **no la copié**.
  Se decide en E2-03 — ver *Esperando decisión · 5*.
- **No comprueba que el pasaje realmente *diga* lo que la afirmación afirma.** Garantiza que el
  fragmento **existe y es de esa fuente**. Un pasaje real que no respalda la afirmación todavía
  pasa; cazarlo es E2-06. Queda **declarado**, no escondido.
- **No arregla todavía la pantalla de consulta.** El agujero sigue abierto en producción hasta
  E2-05, que sí toca la interfaz y por eso va en su propia unidad.

---

## 👉 Lo siguiente

**Sin necesitar nada de usted hay dos caminos, ambos de software puro:**

1. **E2-02 · Extractor PICO** — la continuación natural: convertir la pregunta clínica en
   Población / Intervención / Comparador / Desenlace para que la búsqueda se arme desde ahí y no
   desde el texto crudo. E2-01 la acaba de desbloquear.
2. **E4-01 · Contrato del Safety Kernel** — que el veredicto de seguridad se pueda pedir **sin
   el LLM** y sea un valor, no un párrafo.

**Ojo:** a partir de **E2-03** la cadena de evidencia **sí requiere decisiones suyas** (qué pesa
más, qué se hace ante fuentes que se contradicen). Están abajo, en la 5.

---

## Esperando decisión del médico

### 1. ⚠️ Un despliegue urgente y cuatro preguntas (E0-10) — **nuevas hoy**

**a. Lo urgente no es una decisión, es un despliegue.** El arreglo del clickjacking está en el
código y **no en producción**. Mientras tanto, `/uci`, `/hospitalizacion`, `/receta`, `/orden`,
`/corte-caja` y `/superadmin` se pueden embeber en un iframe desde cualquier sitio web.
**Ojo: esto NO exige apretar la política de seguridad.** El arreglo funciona igual en el modo
aviso de hoy; basta con desplegar. Al desplegar, **subir la versión del Service Worker**.

**b. El componente que convierte PDF a imagen se descarga de un servidor ajeno (`unpkg.com`)
cada vez que usted sube un laboratorio.** Funciona, pero significa que **código de un tercero
se ejecuta dentro de su sesión**: si ese servidor cae, se cae la función; si lo comprometen,
peor. Se puede guardar una copia dentro de la app y no depender de nadie. **No lo hice porque
toca un flujo vivo** (laboratorios, antibiograma por foto, receta por visión) y merece su propia
unidad con prueba manual. ¿Lo hacemos?

**c. ¿Sigue usando el Pixel de Meta y el alta de WhatsApp desde Configuración?** Si el Pixel
está apagado, quito los dos permisos de Facebook y la superficie expuesta se encoge. Es un sí/no.

**d. ¿Aprieto la política a modo bloqueo?** Es lo único que falta para cumplir el objetivo
original. **Mi recomendación: todavía no** — antes hace falta (e). Revertirlo son ~2 minutos.

**e. ¿Creamos un usuario de prueba con datos INVENTADOS?** Hoy ninguna prueba automática puede
entrar a la zona con sesión: ni expediente, ni nota, ni receta, ni farmacia. Es el punto ciego
más grande que tiene el proyecto y arrastra desde antes de esta unidad. Sin eso, «no rompe nada»
nunca podrá afirmarse de la parte que de verdad importa.

### 2. El grafo no puede expresar 14 de los 35 datos que necesita primero *(bloquea E1-03)*

Esto **está medido, no estimado**, y fijado con un test para que no se olvide.

El catálogo de unidades que cerró E0-04 cubre bien lo de laboratorio, pero **le faltan las
unidades más cotidianas de una consulta**:

- De signos vitales: **latidos por minuto, respiraciones por minuto, °C, cm, kg/m² (IMC) y
  "puntos"** (Glasgow, escala de dolor). También la tensión "120/80", que en realidad **son dos
  datos, no uno** (sistólica y diastólica) — así lo hace ya la exportación FHIR.
- De laboratorio: **U/L** (transaminasas, fosfatasa alcalina), **10³/µL** (leucocitos,
  plaquetas) y **µUI/mL** (TSH).

**Hoy el comportamiento ya es seguro** y verificado: un dato con unidad desconocida **se rechaza
ruidosamente**, no se guarda "a medias". Nada se corrompe. Pero el proyector que convertirá su
expediente actual en hechos (E1-03) no puede empezar hasta cerrar esto.

**Por qué no lo hice solo:** añadir °C obliga a **reescribir un candado que E0-04 puso a
propósito** ("no hay temperatura porque °C↔°F no es un factor, es una fórmula"). Tocar de
puntillas un candado ajeno es exactamente lo que la carta operativa me prohíbe.

> **Lo que necesito de usted:** un "adelante" para ampliar el catálogo. No hay criterio clínico
> de por medio (son unidades de medida, no umbrales), sólo el permiso para tocar el candado.

### 3. 🔓 Una línea suya cierra E0-09 — y ya casi la escribió usted

Hoy, si enfermería captura mal una tensión, **la sobrescribe y la anterior desaparece**. E0-09
pide lo contrario: **anexar la corrección** y dejar el valor erróneo visible y tachado
(NOM-004). Su documento `DECISIONES-ARQUITECTURA-2026-07-28.md` §A3 ya lista «signos vitales»
como append-only; el único matiz es que ese §A3 habla de datos **«finalizados/firmados»** y un
signo vital no tiene ese estado: nace y ya está.

> **Lo que necesito:** *"sí, aplica a los signos desde que se guardan"*.
> Con eso entra el parche de 3 líneas, ya escrito, en `unidades/E0-09/RESULTADO.parcial.json`.

### 4. ⏱️ Cinco minutos en GitHub — es lo que le falta a E0-11 por su lado

El gate **avisa** pero no **bloquea**: impedir una fusión lo decide GitHub.

`github.com/docrod29-ai/agenda-medica` → **Settings → Rules → Rulesets → New branch ruleset**,
sobre `main`: (1) exigir pull request, (2) exigir que pasen **`clinical-safety`** y
**`verificar`**, (3) rama al día, (4) sin excepciones (incluido usted).
Detalle en `docs/pendientes-externos.md` §3.

### 5. 🆕 Tres preguntas sobre EVIDENCIA *(nuevas hoy — bloquean E2-03 y E2-04, no lo de ahora)*

- **¿Qué pesa más?** Hoy el buscador **ya ordena** los resultados así: meta-análisis, luego
  **guías**, luego **ensayos clínicos**, luego revisiones. Es decir, **una guía flota por encima
  de un ensayo**. Nadie validó eso y yo no lo di por bueno. Además hay diseños que hoy no
  distingue en absoluto (cohortes, casos y controles, series de casos, estudios en animales):
  caen todos en el mismo montón. ¿Cómo debe ordenarse?
- **¿Y si la cita existe pero no dice lo que la afirmación afirma?** ¿Prefiere ver la afirmación
  **marcada como no respaldada**, o que **no se le muestre**?
- **¿Y si dos fuentes buenas se contradicen** (una guía de 2023 contra un ensayo de 2026)?
  Ya está decidido que se muestran **las dos**; falta saber si a partir de cierta antigüedad la
  guía debe marcarse como *posiblemente superada*, y de cuánta.

### 6. Las otras cuatro de E0-09 (definen *cómo* se corrige) — no bloquean

- **¿Un signo corregido sigue contando para el NEWS2 y el expediente FHIR?** Las dos respuestas
  fallan feo en direcciones opuestas. Hoy el sistema **se niega a calcular** en vez de suponer.
- **¿Quién puede corregir?** ¿Puede enfermería anular una administración de medicamento?
- **¿Hay ventana de tiempo?** ¿Algo de hace cinco días? ¿Un paciente ya egresado?
- **¿El motivo escrito es obligatorio?** Lo pediría la NOM-004, pero encarece cada corrección.

### 7. ¿Ampliamos el catálogo de dosis del adulto? (E0-02, REG-043) — no bloquea

**20 de los 25** fármacos pediátricos no existen en el catálogo adulto. Al prescribirlos **a un
adulto**, el verificador dice «sin referencia» y no impone techo. Usted aprobó ampliarlo; falta
el máximo por toma y por día de cada uno. **No se derivan de las cifras pediátricas y no los voy
a inventar.**

### 8. ¿Qué análisis más deben convertirse entre mg/dL y µmol/L? (E0-04) — no bloquea

Arrancó con **creatinina y colesterol**. Para cualquier otro (glucosa, urea/BUN, bilirrubina,
calcio) devuelve «no lo sé» — el comportamiento seguro. *Relacionado:* **mEq/L no se convierte
automáticamente a mmol/L**: para sodio, potasio y cloro el número coincide; para calcio y
magnesio no.

### 9. Firma: ¿se construye el renderizado server-side? (E0-14, REG-014) — no bloquea

Recepción, farmacia y enfermería ya no pueden leer la firma, pero el médico autenticado sigue
recibiendo la imagen en su navegador porque la impresión es del lado del cliente. Cerrarlo exige
generar el documento firmado en el servidor: unidad aparte, y toca impresión.

### 10. Pendientes anteriores (E0-01), sin cambios

- **¿El pie IMPRESO de la receta debe leerse de la firma de la nota, no de la configuración?**
  Con un solo médico no cambia nada; con dos o más, papel y QR pueden discrepar.
- **Al desplegar: subir la versión del Service Worker.**

### 11. Tres preguntas de E1-01 que **no** bloquean nada

- ¿Un mismo hecho puede tener **dos certezas a la vez** (un antecedente que además es
  sospecha)? Hoy es una sola; si debe ser dos, se resuelve en E1-08.
- Un laboratorio **preliminar** (aún no validado): ¿se muestra en la línea de tiempo o se
  esconde hasta el definitivo?
- ¿Confirma que los códigos UCUM son cosa de la **exportación** y no del almacenamiento?

---

## Deuda técnica anotada (para no perderla)

- **El agujero de las citas sigue abierto en producción.** E2-01 construyó la puerta, pero la
  pantalla de consulta todavía usa el camino viejo (el que borra las citas inválidas en
  silencio). Se cierra en **E2-05**, que toca interfaz y por eso va aparte. **Está fijado con un
  test**: si alguien reintroduce ese comportamiento en el modelo nuevo, el CI se pone rojo.
- **E0-05 hereda un cabo suelto de E0-04.** La protección distingue *dimensiones* (masa vs
  volumen) pero no *unidades* dentro de una dimensión: copiar una cantidad cambiándole la
  etiqueta de `mg` a `µg` compila, y produce un **error de escala de 1000×**. Hoy es inocuo
  —nadie lo usa— pero debe cerrarse **antes** de que un motor real lo consuma.
- **Lo que resta de E0** (E0-06 PHI, E0-12 sello de integridad, E0-13 webhook de Stripe) es de
  riesgo medio/alto y varias deben entregarse como **plan** para que usted decida.
  E0-05 (migrar motores reales) va **por lotes**, nunca de un tirón.
- **La política de seguridad sigue permitiendo `unsafe-inline`/`unsafe-eval` en los scripts.**
  Quitarlo es el endurecimiento fuerte de verdad, pero exige firmar cada script en cada petición
  y su riesgo típico es *pantalla en blanco*. Va en unidad aparte, nunca de propina (E0-10).
- **Punto ciego estructural: no hay usuario de prueba.** Ninguna prueba de navegador puede
  entrar a la zona con sesión. Afecta a E0-10 y a todo lo que venga después (decisión 1.e).

---

## Cómo se retoma

Relanzar el workflow `nexus-os`. Lee `estado.json`, comprueba en disco qué unidades tienen
`RESULTADO.json` y sigue en la primera pendiente. Es idempotente: relanzarlo nunca repite
trabajo ni pierde avance.

**Regla vigente:** un `RESULTADO.json` **no** es prueba suficiente por sí solo. Sólo cuenta si
el `VERIFICACION.json` de esa unidad no la declara *INCOMPLETA*. Lo refutado queda como
`RESULTADO.parcial.json` y **vuelve a la cola**.
