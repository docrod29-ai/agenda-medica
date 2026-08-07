# El foso — qué es defendible y qué no

**Formato**: §4.1 y §N5 del charter Master Loop V7.
**Abierto**: 6-ago-2026.

---

## La regla de este documento

Un documento competitivo tiene dos clases de frase y **sólo una se puede
sostener en una diligencia debida**:

| | |
|---|---|
| ✅ **Lo que hacemos nosotros** | Verificable en este repositorio, con el comando que lo comprueba |
| ⚠️ **Lo que hace o no hace un competidor** | Una afirmación sobre un tercero. Necesita **fuente y fecha**, o no se escribe |

El documento anterior (`docs/COMPETITIVE_ANALYSIS.md`) mezclaba las dos. Contenía
**seis afirmaciones sobre terceros sin una sola fuente**: «Nadie con esa
granularidad», «Pocos en LATAM», «Pocos lo tienen integrado», «Casi nadie en EHR
cloud», «nadie lo expone visualmente», bajo una columna titulada «Por qué somos
superiores».

**Por qué eso es caro y no exagerado** — un comprador que verifica **una** de las
seis y la encuentra falsa deja de creerse las otras cinco **y todo lo demás del
paquete**, incluido lo que sí está medido. Es exactamente el riesgo que el §N5
llama tracción falsa, sólo que apuntando a un competidor en vez de a nosotros.

---

## Lo que sí es un foso

Un foso no es lo que hace el producto: es **lo que un competidor con el mismo
modelo y el mismo presupuesto no puede tener mañana**.

### 1 · El corpus mexicano y su medición

| Qué | Valor medido | Dónde |
|---|---|---|
| WER en crudo | **25,55 %** | `docs/voice/WER-MEDIDO.md` |
| WER con el pipeline | **22,81 %** | idem |
| Sesgo de vocabulario | 78,89 % → 80,90 % (catálogo) → **82,91 %** (expediente) | `docs/voice/SESGO-MEDIDO.md` |
| Corpus de temporalidad | **32 frases** de consulta mexicana | `corpus-oro-temporalidad.test.ts` |
| Corpus de negación | **21 formas** de decir que no | `como-se-dice-que-no-en-una-consulta.test.ts` |

**Por qué es foso**: los números no son buenos por sí solos — lo valioso es que
**existen y son reproducibles**. Quien quiera igualarlos necesita el corpus, la
taxonomía de correcciones y la traza de qué falla y por qué. Eso se acumula con
consultas reales, no se compra.

### 2 · Los motores deterministas

El LLM **nunca calcula** una cifra clínica ([ADR-002](../decisions/ADR-002-el-llm-no-calcula.md)).
Las escalas, dosis y conversiones las hace código probado, y hay una prueba que
lo vigila en todos los tipos de nota, no sólo en UCI.

**Por qué es foso**: es una decisión de arquitectura con años de consecuencia, no
una función. Un competidor que ya dejó calcular al modelo no lo revierte sin
reescribir su producto.

### 3 · El historial de defectos con causa raíz

55 REG con causa raíz, reparación y prueba de regresión permanente; 13 familias
de causa contadas ([`docs/quality/`](../quality/FAMILIAS-DE-DEFECTO.md)).

**Por qué es foso, y es contraintuitivo**: 55 defectos documentados enseñan más
del rigor del equipo que una lista vacía — que sólo significa que nadie los
estaba buscando. Y la lista de familias dice **dónde mirar mañana**, que es
conocimiento operativo que no viene con ninguna API.

### 4 · Los guardianes

7 253 pruebas, 231 archivos sellados que no pueden encoger, aislamiento entre
consultorios probado en cada PR, dirección de dependencias medida, y una
[puerta de liberación](../evals/PUERTA-DE-LIBERACION.md) de nueve ceros.

**Por qué es foso**: no impide que alguien construya lo mismo. Impide que **se
degrade** mientras se construye lo siguiente, que es donde se pierden los
productos clínicos.

---

## Lo que NO es un foso, dicho para no engañarnos

| No es foso | Por qué |
|---|---|
| Usar un modelo de frontera | Lo compra cualquiera con una tarjeta |
| Transcribir voz | Es una llamada a una API |
| Tener agenda, receta y expediente | Todos los competidores del sector los tienen |
| «UX bonita» | Se copia en un trimestre |
| El número de funciones | Se iguala contratando |

**Casi todo lo que un usuario ve no es foso.** Lo que lo es vive debajo: el
corpus, las decisiones de arquitectura, el historial y los guardianes.

---

## Lo que no se puede afirmar hoy

⬜ **Ninguna comparación funcional contra un competidor concreto**, porque no hay
una verificación con fecha de qué hace hoy cada uno. Las que había se retiraron.

Para afirmar «X no tiene Y» hace falta: la fuente (página de producto, demo,
documentación pública), la fecha de consulta, y la cita. Sin las tres, se
describe lo nuestro y se calla lo ajeno.

⬜ **Cuota de mercado, número de médicos y comparación de precios**: dependen de
datos del dueño y de investigación de mercado que este repositorio no tiene.

👤 **Del dueño**: su conocimiento directo del mercado mexicano —qué usan los
colegas, qué les molesta, qué pagan— es información real que este documento no
puede inventar y que sería lo más valioso que se le añadiera.

---

## Cómo se mantiene honesto

`src/__tests__/el-foso-no-inventa-competidores.test.ts` extiende el guardián de
afirmaciones a `docs/` — que hasta hoy sólo cubría el copy público (`landing`,
`precios`, `demo`).

**Ese hueco era el punto**: la regla más estricta se aplicaba a la página que ve
un visitante, y no al documento que lee un comprador en diligencia debida. De los
dos, el segundo es el que tiene consecuencias.
