# Nexus OS — dónde vamos

> **En 30 segundos.** Van **7 de 68** unidades cerradas y verificadas. En esta corrida cerró
> **E1-01 · ClinicalFact**: la pieza de la que cuelga toda la etapa E1 (el expediente como
> grafo de hechos, no como montón de notas).
> **Lo siguiente que puedo hacer solo es E4-01 · Safety Kernel.** La continuación natural
> (E1-02) necesita **una decisión suya** primero — ver *Esperando decisión · 1*.

Última corrida: `2026-07-29T04:06:30Z`. `tsc` verde · 2211 tests verdes · `build` verde ·
**nada desplegado, sin `push`**.

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
| **E1-01** | **Un hecho clínico no existe sin unidad y sin procedencia** | ✅ **cerrada *(hoy)*** |
| E0-11 | El CI protege los invariantes clínicos | 🔴 bloqueada — el gate se puede burlar |
| E0-09 | El registro del hospital no se edita: se corrige anexando | 🟡 bloqueada — espera 1 línea suya |

**7 cerradas · 2 bloqueadas · 59 sin empezar.**

---

## Qué se hizo hoy: E1-01 · ClinicalFact

**El problema.** Hoy el sistema guarda *documentos* (notas, labs, recetas). Un dato suelto
—«creatinina 1.2»— vive dentro de un texto, sin saber **de qué unidad es**, **quién lo dijo**
ni **cuándo dejó de ser verdad**. Por eso no se puede preguntar «¿cómo va la función renal de
este paciente en dos años?» sin releerlo todo.

**Lo que se construyó.** La forma del **hecho clínico atómico**: concepto, valor, unidad,
certeza, fuente, autor, cuándo pasó, hasta cuándo vale y a qué hecho anterior corrige. Nada de
esto está conectado todavía a ninguna pantalla: es el cimiento sobre el que se levantan las
ocho unidades siguientes de la etapa E1.

**La promesa era una sola frase: «un hecho sin unidad o sin procedencia no valida».** Y se
verificó intentando **romperla**, que es la parte que importa:

- Se intentó colar **un número sin unidad** → rechazado. No es que esté prohibido: es que
  **no se puede ni escribir**.
- Se intentó colar el número **disfrazado de texto** (`"135"` como si fuera una frase) →
  rechazado. Sin esa guarda la promesa habría sido decorativa: cualquier cifra entraba por esa
  puerta sin decir en qué unidad estaba.
- Se intentó colgar una unidad **al lado** de un texto para aparentar que la tenía → rechazado.
- Se intentó una unidad **de la dimensión equivocada** (mililitros declarados como peso) →
  rechazado. No basta con que «haya algo escrito en unidad».
- Se intentó un hecho **sin autoría**, o con autoría vacía → rechazado. Un dato generado por IA
  sin modelo ni versión de prompt, o por un motor sin versión, no entra: si mañana hay que
  auditar por qué el sistema afirmó algo, tiene que poder reconstruirse.

**Control obligatorio, ejecutado:** se *quitaron a propósito* las dos defensas clave y se
comprobó que los tests **se ponen rojos** (2 y 3 casos respectivamente). Un test que no se cae
cuando quitas lo que vigila no vigila nada. Después se restauraron.

**Riesgo para el consultorio: nulo.** Tres archivos nuevos que nadie usa todavía y una función
añadida a un módulo sin consumidores. Cero pantallas, cero recetas, cero impresión, cero
cobros, cero reglas de seguridad. `npm run build` compila las 127 páginas igual que antes.

*De paso se arregló un rojo **ajeno**: un documento de preguntas que una corrida anterior dejó
sin declarar hacía fallar un test desde ayer. Queda anotado como reparación ajena, no como
mérito de esta unidad.*

---

## 👉 Lo siguiente

**Sin decisión suya, la mejor unidad es E4-01 · Contrato del Safety Kernel** (riesgo medio,
software puro, depende sólo de E0-04, que ya está cerrada).

**La continuación natural de hoy sería E1-02 · Vocabulario de conceptos clínicos**, pero está
marcada como *requiere validación clínica*: decide cómo se llama cada cosa en el expediente y
qué códigos estándar se usan. Eso no lo puede inventar un agente.

---

## Esperando decisión del médico

### 1. 🆕 El grafo no puede expresar 14 de los 35 datos que necesita primero *(nuevo hoy — bloquea E1-03)*

Esto **está medido, no estimado**, y fijado con un test para que no se olvide.

El catálogo de unidades que cerró E0-04 cubre bien lo de laboratorio, pero **le faltan las
unidades más cotidianas de una consulta**:

- De signos vitales: **latidos por minuto, respiraciones por minuto, °C, cm, kg/m² (IMC) y
  "puntos"** (Glasgow, escala de dolor). También la tensión "120/80", que en realidad **son dos
  datos, no uno** (sistólica y diastólica) — así lo hace ya la exportación FHIR.
- De laboratorio: **U/L** (transaminasas, fosfatasa alcalina), **10³/µL** (leucocitos,
  plaquetas) y **µUI/mL** (TSH).

**Hoy el comportamiento ya es seguro** y verificado: un dato con unidad desconocida **se rechaza
ruidosamente**, no se guarda "a medias" ni pierde la unidad por el camino. Nada se corrompe.
Pero el proyector que convertirá su expediente actual en hechos (E1-03) no puede empezar hasta
cerrar esto.

**Por qué no lo hice solo:** añadir °C obliga a **reescribir un candado que E0-04 puso a
propósito** (dice: "no hay dimensión de temperatura porque °C↔°F no es un factor, es una
fórmula"). Tocar de puntillas un candado ajeno es exactamente lo que la carta operativa me
prohíbe. Va como unidad aparte y explícita.

> **Lo que necesito de usted:** un "adelante" para ampliar el catálogo con esas unidades.
> No hay criterio clínico de por medio (son unidades de medida, no umbrales), sólo el permiso
> para tocar el candado.

### 2. 🔓 Una línea suya cierra E0-09 — y ya casi la escribió usted

Hoy, si enfermería captura mal una tensión, **la sobrescribe y la anterior desaparece**. E0-09
pide lo contrario: **anexar la corrección** y dejar el valor erróneo visible y tachado
(NOM-004). Su documento `DECISIONES-ARQUITECTURA-2026-07-28.md` §A3 ya lista «signos vitales»
como append-only; el único matiz es que ese §A3 habla de datos **«finalizados/firmados»** y un
signo vital no tiene ese estado: nace y ya está.

> **Lo que necesito:** *"sí, aplica a los signos desde que se guardan"*.
> Con eso entra el parche de 3 líneas, ya escrito, en `unidades/E0-09/RESULTADO.parcial.json`.

### 3. ⏱️ Cinco minutos en GitHub — es lo que le falta a E0-11 por su lado

El gate **avisa** pero no **bloquea**: impedir una fusión lo decide GitHub.

`github.com/docrod29-ai/agenda-medica` → **Settings → Rules → Rulesets → New branch ruleset**,
sobre `main`: (1) exigir pull request, (2) exigir que pasen **`clinical-safety`** y
**`verificar`**, (3) rama al día, (4) sin excepciones (incluido usted).
Detalle en `docs/pendientes-externos.md` §3.

### 4. Las otras cuatro de E0-09 (definen *cómo* se corrige) — no bloquean

- **¿Un signo corregido sigue contando para el NEWS2 y el expediente FHIR?** Las dos respuestas
  fallan feo en direcciones opuestas. Hoy el sistema **se niega a calcular** en vez de suponer.
- **¿Quién puede corregir?** ¿Puede enfermería anular una administración de medicamento?
- **¿Hay ventana de tiempo?** ¿Algo de hace cinco días? ¿Un paciente ya egresado?
- **¿El motivo escrito es obligatorio?** Lo pediría la NOM-004, pero encarece cada corrección.

### 5. ¿Ampliamos el catálogo de dosis del adulto? (E0-02, REG-043) — no bloquea

**20 de los 25** fármacos pediátricos no existen en el catálogo adulto. Al prescribirlos **a un
adulto**, el verificador dice «sin referencia» y no impone techo. Usted aprobó ampliarlo; falta
el máximo por toma y por día de cada uno. **No se derivan de las cifras pediátricas y no los voy
a inventar.**

### 6. ¿Qué análisis más deben convertirse entre mg/dL y µmol/L? (E0-04) — no bloquea

Arrancó con **creatinina y colesterol**. Para cualquier otro (glucosa, urea/BUN, bilirrubina,
calcio) devuelve «no lo sé» — el comportamiento seguro. *Relacionado:* **mEq/L no se convierte
automáticamente a mmol/L**: para sodio, potasio y cloro el número coincide; para calcio y
magnesio no.

### 7. Firma: ¿se construye el renderizado server-side? (E0-14, REG-014) — no bloquea

Recepción, farmacia y enfermería ya no pueden leer la firma, pero el médico autenticado sigue
recibiendo la imagen en su navegador porque la impresión es del lado del cliente. Cerrarlo exige
generar el documento firmado en el servidor: unidad aparte, y toca impresión.

### 8. Pendientes anteriores (E0-01), sin cambios

- **¿El pie IMPRESO de la receta debe leerse de la firma de la nota, no de la configuración?**
  Con un solo médico no cambia nada; con dos o más, papel y QR pueden discrepar.
- **Al desplegar: subir la versión del Service Worker.**

### 9. Tres preguntas nuevas de hoy que **no** bloquean nada

- ¿Un mismo hecho puede tener **dos certezas a la vez** (un antecedente que además es
  sospecha)? Hoy es una sola; si debe ser dos, se resuelve en E1-08.
- Un laboratorio **preliminar** (aún no validado por el laboratorio): ¿se muestra en la línea de
  tiempo o se esconde hasta el definitivo? Hoy se *representa*; quién lo muestra lo deciden
  E1-07/E1-09.
- ¿Confirma que los códigos UCUM son cosa de la **exportación** (ya los emite la salida FHIR) y
  no del almacenamiento? Es lo que se asumió.

---

## Deuda técnica anotada (para no perderla)

- **E0-05 hereda un cabo suelto de E0-04.** La protección distingue *dimensiones* (masa vs
  volumen) pero no *unidades* dentro de una dimensión: copiar una cantidad cambiándole la
  etiqueta de `mg` a `µg` compila, y produce un **error de escala de 1000×**. Hoy es inocuo
  —nadie lo usa— y E1-01 **no lo agrava** (los hechos se construyen por la puerta de entrada,
  nunca copiando a mano), pero debe cerrarse **antes** de que un motor real lo consuma.
- **Lo que resta de E0** (E0-06 PHI, E0-10 CSP, E0-12 sello de integridad, E0-13 webhook de
  Stripe) es de riesgo medio/alto y varias deben entregarse como **plan** para que usted decida.
  E0-05 (migrar motores reales) va **por lotes**, nunca de un tirón.

---

## Cómo se retoma

Relanzar el workflow `nexus-os`. Lee `estado.json`, comprueba en disco qué unidades tienen
`RESULTADO.json` y sigue en la primera pendiente. Es idempotente: relanzarlo nunca repite
trabajo ni pierde avance.

**Regla vigente:** un `RESULTADO.json` **no** es prueba suficiente por sí solo. Sólo cuenta si
el `VERIFICACION.json` de esa unidad no la declara *INCOMPLETA*. Lo refutado queda como
`RESULTADO.parcial.json` y **vuelve a la cola**.
