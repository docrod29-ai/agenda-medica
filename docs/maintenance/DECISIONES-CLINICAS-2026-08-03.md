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
