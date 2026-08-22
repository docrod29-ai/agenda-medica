# Handoff — lo que #314 NO tocó y por qué

Este carril (Evidence Integrations, issue #314) se construyó **sin mutar los
archivos que ahora mismo tienen otro escritor**: Voice #302, Clinical Reasoning
#303 y Consultorio #306. Todo lo que habría exigido tocarlos está aquí, escrito
con la precisión suficiente para que el escritor de ese slice lo aplique sin
tener que reconstruir el razonamiento.

Regla operativa del tablero #296: «mantener **un solo escritor** sobre
archivos/slice solapados».

---

## 1. Lo que este carril SÍ tocó, y por qué no colisiona

| Archivo | Por qué era inevitable | Riesgo de colisión |
|---|---|---|
| `src/lib/evidence-integrations/**` | Módulo nuevo, directorio nuevo. | **Ninguno.** Ningún slice activo lo toca. |
| `src/__tests__/evidence-integrations-*.test.ts` | Archivos nuevos. | **Ninguno.** |
| `src/__tests__/tipos/evidence-integrations.tipos.ts` | Archivo nuevo. | **Ninguno.** |
| `scripts/evidence/**`, `docs/evidence/**` | Directorios nuevos. | **Ninguno.** |
| `src/__tests__/modulos-sin-conectar.test.ts` | Trinquete: al usar `desde-pubmed.ts` deja de ser huérfano y la lista **obliga** a quitarlo. | **Ninguno.** Ningún slice activo toca este archivo. |
| `src/__tests__/campos-sin-usar.test.ts` | Trinquete: al leer `Claim.apoyos` y `Passage.sourceId` la lista **obliga** a quitarlos. | **Mínima — ver abajo.** |

### El único punto de fricción: `campos-sin-usar.test.ts`

Los tres slices activos **ya están quitando líneas de la misma lista**:

- `Passage.sourceId` — lo quitan **los tres** (#302, #303, #306) y también este
  carril. Deleción idéntica: git la resuelve sin conflicto.
- `Claim.apoyos` — lo quita **#303** y también este carril (idéntica, limpia).
  **#302 y #306 lo conservan**, y ahí git marca un conflicto de una línea porque
  las dos deleciones son adyacentes.

**Resolución, y no hay otra posible:** quedarse con la deleción. Tras este
carril, `Claim.apoyos` **está usado** por
`src/lib/evidence-integrations/soporte.ts`, así que si la línea sobrevive el
guardián falla con `ya se usan (o se borraron), quítalos: Claim.apoyos`. No es
una preferencia de estilo: el trinquete impone la respuesta.

Verificado con `git merge-file` contra las tres ramas: #303 mergea limpio; #302
y #306 producen ese único conflicto de una línea.

---

## 2. Lo que este carril NO tocó — trabajo pendiente para el escritor del slice

### 2.1 `src/app/api/consultor-evidencia/route.ts` — CONSULTORIO #306

**Qué le pasa hoy.** Llama a PubMed dentro de un `try` y, cuando falla, sigue
con menos artículos (`route.ts`, bloque de `catch`). El médico ve una respuesta
más pobre y **no tiene forma de saber si la literatura no dice nada o si la
literatura no se consultó**. Son dos frases con consecuencias clínicas opuestas
y hoy se pintan idénticas. Es exactamente lo que prohíbe el punto 9 de #314, y
se viola sin escribir ninguna mentira: simplemente devolviendo menos.

**Cambio exacto:**

```ts
import { adaptadorPubMed, corpusParaSintesis, mapaDeSoporte, avisosDeDegradacion }
  from '@/lib/evidence-integrations'

const sobre = await adaptadorPubMed().recuperar(
  { pregunta, terminos, maximo: 8 },
  { ahora: new Date().toISOString(), correlacion: correlacionSinPhi },
)
// `sobre.fuentes` NO COMPILA si el sobre es de fallo: hay que estrechar.
const corpus = corpusParaSintesis([sobre])
```

Y en la respuesta HTTP, añadir `avisos: avisosDeDegradacion(mapa)` para que la
pantalla pueda decir «PubMed no respondió» en vez de callarse.

**No lo hizo este carril porque** la ruta pertenece al camino crítico de
Consultorio y su prompt, su gate de créditos y su memoria del médico son de ese
slice.

### 2.2 `src/app/api/expediente/evidencia/route.ts` — CONSULTORIO #306

**Qué le pasa hoy.** El prompt autoriza el arreglo de citas vacío y devuelve
`{punto, sustento, citas:[n]}`. En
`src/app/(dashboard)/consulta/[patientId]/page.tsx:2698`, el render hace
`(nums ?? []).filter(n => arts[n - 1])`: **un índice fuera de rango se descarta
en silencio y la afirmación se pinta idéntica a una respaldada.**

Este defecto ya estaba diagnosticado en el encabezado de `src/types/evidence.ts`
(unidad E2-01), que construyó el modelo para cerrarlo. Lo que faltaba —y aporta
este carril— es el objeto que representa «tres respaldadas y una no»:
`MapaDeSoporte`.

**Cambio exacto:** sustituir el `.filter()` por

```ts
const mapa = mapaDeSoporte(crudas, corpus)
// mapa.respaldadas  → se pintan con su cita
// mapa.sinRespaldo  → se pintan MARCADAS, con su motivo. NO se borran.
```

**Nota de producto para quien lo aplique:** `esRespuestaRespaldada()` es
deliberadamente estricto — una respuesta con tres afirmaciones buenas y una
inventada **no** es una respuesta respaldada. Si el slice de Consultorio decide
otra cosa, es una decisión de producto y hay que escribirla; no se cambia el
umbral por conveniencia de la pantalla.

### 2.3 `src/types/evidence.ts` — CANÓNICO, no lo toca nadie sin acuerdo

**Qué haría falta y por qué NO se hizo.** `PROVEEDORES` no incluye `cochrane`,
`openevidence`, `perplexity` ni `conocimiento_personal`. Sin entrada ahí,
**ninguno puede producir un `Source`**.

**Eso no es un defecto: es la compuerta funcionando.** Sin `Source` no hay
`Passage`, y sin `Passage` no hay `Claim`. Un proveedor sin licencia verificada
es, **por construcción**, incapaz de respaldar una afirmación clínica. No hace
falta un guardián que lo prohíba — el modelo de tipos ya lo hace imposible.

**Cuándo tocarlo:** el día que exista una licencia verificada. Entonces, y sólo
entonces:

1. añadir la entrada a `PROVEEDORES` con `licencia: 'ENABLED'`;
2. poner `proveedorCanonico` en `src/lib/evidence-integrations/catalogo.ts`;
3. cambiar `licencia` a `LICENSED_OK` y rellenar los campos de la matriz **con
   la nota de dónde salió cada uno**;
4. sustituir el adaptador `no-configurado` por uno real;
5. regenerar la matriz: `node scripts/evidence/matriz-proveedores.mjs`.

**Perplexity y conocimiento personal NO deben añadirse a `PROVEEDORES` nunca**,
ni siquiera con contrato: su rol no es respaldar (puntos 7 y 8 de #314).

### 2.4 `src/lib/clinical-reasoning/index.ts` — REASONING #303

El motor de razonamiento debería consumir `MapaDeSoporte` en vez de una lista de
artículos, para que cada afirmación del diferencial lleve su respaldo o su marca
de no respaldada. **Archivo del slice #303; no se tocó.**

Lo que el carril deja listo: `corpusParaSintesis()` produce exactamente lo que
un sintetizador necesita, y `mapaDeSoporte()` consume la forma
`{texto, citas, pasajes}` que **el prompt de producción ya devuelve** — enchufarlo
no exige cambiar el prompt.

### 2.5 `src/lib/clinica/respaldo.ts` y `firestore.rules` — SEGURIDAD

Si algún día se persiste material de evidencia (caché, notas personales
importadas), `.claude/rules/security-tenant.md` exige declarar la colección en
**tres** sitios: `firestore.rules`, `src/lib/authz/matriz-acceso.ts` y el
manifiesto de respaldo.

**Este carril NO persiste nada** — todo es en memoria — así que no hay colección
que declarar. Queda anotado para quien conecte la caché: `puedeCachearse()` y
`claveDeCache()` dan el veredicto, pero **no escriben en ningún sitio**.

---

## 3. Bloqueos que sólo el dueño puede levantar

Ninguno bloquea el lanzamiento de Consultorio: la evidencia es **opcional** y su
ausencia se declara sin romper nada (`hayRespaldoOperativo()`).

| # | Bloqueo | Clase | Efecto hoy |
|---|---|---|---|
| P1 | **UpToDate** — términos de integración, precio y si el reuso generativo está permitido | licencia + gasto | adaptador en `not_configured`; se declara al médico |
| P1 | **Cochrane** — acceso programático y, **por separado**, reuso generativo | licencia + gasto | ídem. Los resúmenes indexados siguen llegando por PubMed |
| P1 | **OpenEvidence** — si existe vía oficial, y si su rol debe ser `descubrimiento` | licencia + arquitectura | ídem |
| P2 | **Perplexity** — su API es de pago | gasto | ídem. No se contrató nada |
| P2 | **PMC** — el subconjunto Open Access mezcla licencias por artículo | licencia | hoy no se filtra antes de reproducir texto completo |
| P2 | **WHO** — la cláusula NC de CC BY-NC-SA dentro de un producto de pago | licencia | pregunta legal abierta |
| P3 | **Conocimiento personal** — confirmar que se muestra siempre atribuido y separado | política clínica | el carril lo asume así y lo impone por contrato |

**No hay ningún P0.** Nada de lo anterior impide terminar una consulta ni
degrada la seguridad: lo que falta se declara, y lo declarado es legible por el
médico.
