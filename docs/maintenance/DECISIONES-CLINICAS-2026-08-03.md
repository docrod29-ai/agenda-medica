# DECISIONES CLÍNICAS DEL DR. — 3 de agosto de 2026

Resolución de las **seis preguntas del motor de antibiograma** que estaban
bloqueadas desde la auditoría del equipo. Las contestó el Dr. David Alonso
Rodríguez Luna con fundamento en CLSI M100-Ed35.

Este documento es la **fuente** de la implementación: cada regla del motor debe
poder señalar aquí. Si algún día el código y este archivo discrepan, manda este
archivo hasta que el Dr. diga otra cosa.

---

## PRINCIPIO RECTOR (aplica a las seis)

> «CLSI define categorías e interpretación microbiológica; algunas acciones
> clínicas —aislamiento, notificación o selección terapéutica definitiva— deben
> permanecer como **reglas institucionales separadas**.»

Es la instrucción de arquitectura más importante del lote: **el motor
microbiológico y las consecuencias institucionales dejan de ser la misma cosa**.
Hoy están mezcladas —el fenotipo MRSA arrastra por su cuenta el aislamiento de
contacto y la notificación obligatoria— y eso codifica como consecuencia
universal de CLSI algo que depende de la política del hospital y de la
jurisdicción.

---

## 1 · Conteo de multirresistencia en Gram positivos → **B**

**Quitar la declaración MDR automática.**

M100-Ed35 usa las siglas MDRO en las tablas de *Staphylococcus* y
*Enterococcus*, pero **no establece una regla universal** del tipo «no
susceptible en tres clases» para declarar MDR. Además CLSI enumera resistencias
intrínsecas que no deben interpretarse como adquiridas: en enterococos varias
clases pueden parecer activas in vitro sin ser clínicamente eficaces, y no deben
reportarse como susceptibles.

- **No** llamar MDR a un estafilococo o enterococo mediante un conteo genérico.
- **Sí** conservar una alerta distinta y claramente NO-CLSI, con este sentido:
  «Resistencia adquirida extensa: no susceptible en ≥3 clases evaluables; no
  corresponde a una definición CLSI de MDR.»
- Excluir del conteo: resistencias **intrínsecas**, resultados **deducidos
  redundantes** y clases **no clínicamente aplicables**.

> Conserva la señal sin convertir un indicador interno en una categoría formal.

---

## 2 · Categoría SDD → **B modificada**

**Utilizable con exposición aumentada, pero NUNCA almacenada como S.**

CLSI define SDD como una **categoría propia**, distinta de S y de I: la
probabilidad de eficacia depende de emplear mayor exposición (dosis mayor, mayor
frecuencia o infusión prolongada). CLSI recomienda transmitirla explícitamente
como `SDD` o, cuando el sistema sólo admite un carácter, como `D`.

Aplica, entre otras combinaciones, a:

- cefepime, piperacilina y piperacilina-tazobactam en Enterobacterales;
- ceftarolina en *S. aureus*;
- daptomicina en *E. faecium*.

**Regla del motor (literal del Dr.):**

```
categoria_original            = SDD
utilizable                    = sí, condicional
requiere_exposicion_aumentada = sí
equivalente_a_S               = no
equivalente_a_I               = no
```

Para cefepime en Enterobacterales, CLSI vincula SDD a un régimen de **2 g IV
cada 8 h en infusión de 3 h**, sujeto a función renal y demás factores clínicos.

> La opción A desperdicia información clínicamente relevante; la C hace que SDD
> se interprete con frecuencia como resistencia, que es justo lo que CLSI
> intenta evitar.

---

## 3 · Discordancia entre CMI y categoría del laboratorio → **B condicionada**

**Recalcular SÓLO cuando se ha verificado que el punto de corte aplicable es el
mismo.**

CLSI reconoce que un equipo comercial puede estar usando puntos de corte FDA,
CLSI de otra edición, o configuraciones no actualizadas. Ante resultados
inesperados recomienda comprobar transcripción, contaminación, identificación,
repetibilidad y, cuando corresponda, confirmar con un segundo método.

### Escenario 1 — procedencia PLENAMENTE verificada

Coinciden **los ocho**: organismo y especie · antimicrobiano · método · sitio o
indicación cuando existan cortes específicos · estándar seleccionado · **edición**
del estándar · unidad · valor de la CMI.

```
categoria_para_razonamiento   = la calculada por CLSI
categoria_original_laboratorio = preservada
discordancia                   = visible
```

Si la CMI corresponde a R y el reporte dice S, **manda la CMI**.

### Escenario 2 — procedencia no verificable o estándares distintos

**No modificar automáticamente.** Mostrar ambas interpretaciones y **bloquear las
conclusiones dependientes** de ese resultado hasta aclarar el estándar usado.

> C queda descartada: la corrección asimétrica «sólo hacia lo más restrictivo»
> no es una regla de CLSI y puede crear falsas resistencias.

---

## 4 · BLEE confirmatoria negativa frente a patrón inferido → **B**

**Degradar la confianza.**

CLSI señala que el tamizaje sólo puede *indicar* producción de BLEE; que las
pruebas fenotípicas pueden dar falsos negativos (p. ej. por coproducción de
AmpC); que con los breakpoints actuales la prueba rutinaria de BLEE **no es
necesaria** para interpretar cefalosporinas y aztreonam; y que aun confirmada,
**no** hay que cambiar automáticamente S→R con los cortes actuales.

```
tamizaje compatible + confirmatoria negativa
  → BLEE: «sospecha» / «no confirmada»
  → NO «probable» sin cambios
  → NO cancelación absoluta
```

Además: **separar el fenotipo de la terapia.** La selección terapéutica debe
basarse principalmente en las categorías actuales del antibiograma, el foco y el
paciente — no únicamente en la etiqueta «BLEE».

---

## 5 · mCIM negativo con resistencia a carbapenémicos → **A**

**«Carbapenemasa no detectada»; mecanismo indeterminado.**

La interpretación textual de CLSI para un mCIM negativo es *«Carbapenemase not
detected»*. **No** equivale a «mecanismo no enzimático demostrado». Además, mCIM
está estandarizado para Enterobacterales y *P. aeruginosa*, no de forma general
para otros no fermentadores; CLSI describe limitaciones y falsos negativos para
determinados productores; y en *Acinetobacter* **no respalda mCIM** por
especificidad y reproducibilidad.

```
carbapenémico R + mCIM negativo
  → resistencia a carbapenémicos CONFIRMADA por AST
  → carbapenemasa NO DETECTADA por mCIM
  → mecanismo: INDETERMINADO
  → recomendar método adicional cuando sea clínica o epidemiológicamente necesario
```

> B queda descartada como automatismo: permeabilidad, eflujo o β-lactamasas con
> pérdida de porinas son hipótesis razonables, pero M100 no da en este contexto
> un orden universal que permita al motor declararlas como mecanismo principal.

---

## 6 · Cefoxitina S/negativa con oxacilina R → **A modificada**

**Se reporta resistencia a meticilina, pero NO se llama «confirmada» mientras
haya discordancia.**

CLSI es directo: los aislamientos resistentes por cefoxitina **o** por oxacilina
deben reportarse como resistentes a meticilina/oxacilina; y *mecA*, *mecC* o
PBP2a son las pruebas más definitivas — cualquier método fenotípico recomendado
que resulte resistente basta para el reporte de MRS.

```
oxacilina R + cefoxitina S
  → MRS/MRSA FENOTÍPICO
  → alerta CRÍTICA de discordancia
  → repetir / verificar pruebas
  → confirmar preferentemente con mecA / mecC / PBP2a
```

Texto que debe salir, en vez de «MRSA confirmado»:

> «*S. aureus* resistente a meticilina por oxacilina; resultado discordante con
> cefoxitina. Confirmación molecular o PBP2a recomendada.»

Como **medida temporal de seguridad clínica** puede manejarse como MRSA hasta
aclararlo, pero **aislamiento de contacto, notificación obligatoria y aviso a
salud pública dependen de la política institucional y la jurisdicción**. No
conviene codificarlos como consecuencia universal de M100.

---

## TABLA FINAL (la del Dr., literal)

| Criterio | Regla recomendada |
|---|---|
| MDR en Gram positivos | No declarar MDR mediante conteo genérico; conservar sólo una alerta no-CLSI claramente identificada |
| SDD | Estado propio SDD/D; utilizable únicamente con exposición aumentada |
| CMI–categoría discordante | Recalcular sólo tras verificar estándar, edición, método y contexto; preservar el original |
| BLEE confirmatoria negativa | Degradar a sospecha/no confirmada |
| Carbapenémico R + mCIM negativo | «Carbapenemasa no detectada»; mecanismo indeterminado |
| Cefoxitina S + oxacilina R | Reportar MRS fenotípico, declarar discordancia y confirmar; no etiquetar todavía como «confirmado» |

**Combinación:** 1B · 2B con estado SDD independiente · 3B condicionada · 4B ·
5A · 6A sin la palabra «confirmado».

---

## LO QUE ESTO ABRE, Y QUE NO ESTABA EN LAS SEIS PREGUNTAS

El principio rector obliga a un cambio que va más allá de las seis reglas: hoy
el motor mezcla **interpretación microbiológica** con **acción institucional**.
El fenotipo MRSA enciende por su cuenta `aislamiento` y `notificacionObligatoria`,
y la carbapenemasa confirmada dispara «infectología OBLIGADA».

Según la instrucción del Dr., eso pasa a ser una **capa aparte y configurable
por consultorio**: el motor dice qué es el organismo; la política del hospital
dice qué se hace con eso. Se implementa después de las seis reglas, y hasta
entonces el comportamiento actual se conserva para no dejar a nadie sin su aviso
de aislamiento.

---
---

# SEGUNDA TANDA — decisiones 7 a 13

Contestadas el mismo 3 de agosto de 2026, con el criterio declarado por el Dr.:
**seguridad clínica, trazabilidad, baja fricción y honestidad comercial**.

| # | Decisión |
|---|---|
| 7 · O₂ en NEWS2 | **B con condiciones estrictas** |
| 8 · Motivo de corrección | **A, pero obligatorio antes del cierre definitivo** |
| 9 · Medicamento al cumplirse la duración | **B** |
| 10 · Recomendaciones sin fuente | **C ahora; A para recuperarlas** |
| 11 · Prueba | **C** |
| 12 · Costos de IA | **B, con aprobación y versionado** |
| 13 · CFDI | **A ahora; construir después** |

---

## 7 · ¿Flujo de O₂ > 0 implica oxígeno suplementario? → **B con reglas**

En NEWS2 el oxígeno suplementario suma **2 puntos**, y el Royal College of
Physicians recomienda registrar dispositivo y flujo. «O₂ por cánula nasal a
3 L/min» **no es una inferencia débil: es evidencia estructurada**.

**Se deduce `supplementalOxygen = true` sólo si se cumple todo:**

```
oxygenFlow > 0
+ dispositivo de oxígeno ACTIVO
+ observación clínicamente válida
+ mismo conjunto de observación / marca de tiempo actual
```

**NO se deduce cuando:** el flujo es histórico o está vencido · el oxígeno fue
suspendido · el registro fue corregido · no hay asociación con el episodio actual
· el campo representa otra clase de flujo · la fuente es texto ambiguo sin
confirmación.

**Se muestra la procedencia del modificador**, y es corregible:

```
Oxígeno suplementario: Sí
Derivado de: cánula nasal, 3 L/min, 14:05
NEWS2: +2
```

**Si hay contradicción** entre «aire ambiente» y flujo > 0 → `NEWS2 =
REVIEW_REQUIRED`. No preguntar cuando la evidencia estructurada sea inequívoca.

---

## 8 · ¿El motivo de una corrección bloquea? → **A mejorada**

No se bloquea la corrección de una TA, SpO₂ o frecuencia respiratoria peligrosa
porque falte un campo narrativo. FHIR distingue `corrected`, `amended` y
`entered-in-error` —lo que respalda conservar original y modificación— pero **no
obliga a impedir la corrección** hasta completar el motivo.

Tampoco queda eternamente opcional. **Dos etapas:**

```
GUARDAR CORRECCIÓN     → permitido de inmediato
FIRMAR / FINALIZAR / CERRAR TURNO → motivo REQUERIDO si sigue vacío
```

Mientras falte: `correctionReasonStatus = PENDING`, en ámbar, y **tarea de
completar trazabilidad**.

**Motivos rápidos:** error de captura · paciente incorrecto · unidad incorrecta ·
transcripción incorrecta · artefacto del dispositivo · dato confirmado nuevamente
· otro (texto libre).

**Nunca** borrar ni sobrescribir en silencio la observación original.

---

## 9 · ¿El medicamento termina solo al cumplirse la duración? → **B**

Una fecha esperada de término **no demuestra** que el paciente suspendiera el
medicamento: puede haber prolongación, mala adherencia, repetición de receta,
cambio verbal de duración, crónico mal capturado, o simplemente que siga
tomándolo. FHIR distingue el estado de la ORDEN del estado real de consumo.

```
Duración cumplida
  → PROBABLY_COMPLETED / RECONCILIATION_REQUIRED
  → NO pasa automáticamente a COMPLETED
  → confirmar con un clic:
     Terminó / Continúa / Extendido / Suspendido / Nunca iniciado / Desconocido
```

**No debe desaparecer en silencio.** La lista se separa en tres:

- **ACTIVOS CONFIRMADOS** → análisis de interacciones completo;
- **PROBABLEMENTE TERMINADOS** → advertencia contextual, no alerta interruptiva;
- **HISTÓRICOS** → no se tratan como activos.

Una confirmación humana fija el estado clínico definitivo.

---

## 10 · Las 42 recomendaciones de inmuno sin fuente → **C ahora, A después**

En inmunocomprometidos una recomendación sin fuente puede afectar profilaxis,
vacunación, diagnóstico, uso de antimicrobianos, tamizajes, suspensión de
inmunosupresión y tiempos de tratamiento.

**No** se marcan como «criterio del autor» dentro del motor clínico habitual:
visualmente acaban adquiriendo la misma autoridad que una guía.

```
retirar de la salida clínica
  → exportar las 42
  → asignar fuente y alcance
  → revisar → probar → reactivar
```

Estado mientras tanto: `UNSOURCED / NOT_FOR_CLINICAL_DISPLAY`. **No se borra el
contenido.**

Cada recomendación, para volver, necesita: `statement` · `population` ·
`trigger` · `exceptions` · `source` · `publicationDate` · `guidelineVersion` ·
`evidenceStrength` · `lastReviewedAt` · `reviewer`.

Cuando de verdad sea opinión experta local, existe **en un carril aparte**:
`LOCAL EXPERT POLICY` — no como recomendación de guía.

---

## 11 · Prueba: ¿con tarjeta o sin tarjeta? → **C**

**Sin tarjeta, con la IA limitada.** La web ya promete «14 días gratis, sin
tarjeta»; cambiar ahora a tarjeta primero aumenta la fricción, rompe la
consistencia y reduce cuántos médicos llegan al primer valor.

El trial **incluye el flujo completo**: agenda, pacientes, consulta, nota,
receta, cobro manual, sandbox y funciones clínicas básicas. Y una **bolsa
limitada y visible de IA**.

> **La cifra de la bolsa debe salir del Cost Engine, no elegirse
> arbitrariamente.** (Depende de la decisión 12.)

**Sin overage durante el trial.** Al agotarse la IA: se mantienen agenda y
consulta manual, se ofrece el modo de menor costo si está incluido, y se muestra
la mejora — sin bloquear el expediente.

**Al terminar sin método de pago:**

```
subscription = PAUSED
datos preservados
lectura y exportación disponibles
funciones premium de escritura bloqueadas
```

No borrar datos ni cancelar violentamente. Y **unificar de inmediato el control
de acceso con las seis pantallas**.

---

## 12 · Tarifas de los modelos de IA → **B, con aprobación y versionado**

Claude las transcribe **sólo de las páginas oficiales de cada proveedor**; el
dueño aprueba antes de que entren en vigor. No tiene sentido capturar a mano
precios publicados que cambian y tienen varias modalidades; tampoco que se
cambien costos productivos sin revisión.

`ProviderPriceCatalog` con: `provider` · `model` · `inputPrice` ·
`cachedInputPrice` · `outputPrice` · `audioPrice` · `batchPrice` · `currency` ·
`billingUnit` · `source` · `effectiveFrom` · `retrievedAt` · `approvedAt` ·
`approvedBy`.

```
fuente oficial → transcripción → diff contra el vigente
  → revisión humana → aprobación → NUEVA VERSIÓN
```

**Nunca sobrescribir históricos**: el margen de un mes pasado se calcula con la
tarifa que estaba vigente entonces.

Se muestra: precio anterior · precio nuevo · diferencia · fuente · fecha de
consulta · modelos afectados · impacto estimado en margen.

Si falta precio: `costStatus = UNKNOWN`. **El tablero no inventa ni estima cero.**

---

## 13 · CFDI al paciente → **A ahora**

**Retirar la promesa inmediatamente.** No se vende una función que no existe, y
«próximamente» sin fecha ni implementación comprometida no resuelve el problema.

Emitir CFDI de verdad exige: proveedor/PAC · cuenta productiva · RFC y régimen ·
CSD · manejo seguro de certificado y llave · catálogo fiscal · datos del receptor
· emisión · timbrado · cancelación · sustitución · descarga XML/PDF · webhooks ·
conciliación · pruebas.

**Copy provisional:** en vez de «Facturación CFDI al paciente» →
«Registro de cobros, recibos y control financiero».

Cuando exista: «Emisión de CFDI integrada mediante [proveedor], disponible para
cuentas configuradas.»

Se mantienen sólo las capacidades reales: registro de cobro · recibo **no
fiscal**, correctamente identificado · cuenta por cobrar · conciliación.

**No volver a publicar la promesa** hasta pasar la prueba de extremo a extremo
completa. **No almacenar CSD ni llaves sin diseño y revisión de seguridad.**
