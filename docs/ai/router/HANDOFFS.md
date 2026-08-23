# HANDOFFS del riel #313 — cambios que NO se hicieron, y a quién le tocan

Ninguno de estos cambios se aplicó. Cada uno toca un archivo cuyo dueño es otro
slice, y aplicarlo desde aquí sería un segundo escritor sobre trabajo ajeno.

---

## HANDOFF-1 — El médico ve marcas de modelo. `#306` / propietario del precio

**Archivo** `src/lib/planes-ia.ts`
**Símbolo** `MOTORES` (`Record<ClaveMotor, Motor>`), campo `modelos`
**Severidad** **P1** — contradice una condición de aceptación de #313 y del
Gate 6 de #320 («technical AI/model selectors» en la lista de auditoría).

**Qué pasa.** El médico elige hoy entre tres motores y la interfaz le enseña,
literalmente:

```
⚡ Rápida    modelos: 'Haiku 4.5'
⭐ Estándar  modelos: 'Sonnet 5 + separación de voces'
💎 Máxima    modelos: 'Opus 4.8 + GPT-5 + 2ª opinión'
```

Eso **es** un model picker con nombres de proveedor, y aparece en `/precios` y
en el selector de nota. #313 §K lo prohíbe («el médico no debe ver GPT / Claude
/ Gemini / temperature / tokens / provider»), y #320 lo lista como superficie a
auditar antes del lanzamiento.

**Por qué no se toca desde aquí.** `MOTORES` no es sólo interfaz: es la unidad
de cobro (`creditos: 1/3/10`) y la fuente de `perfil` que consume `procesar`.
Cambiarlo toca precio, gates y la pantalla de la consulta a la vez — tres
superficies de otros slices.

**Cambio mínimo propuesto.** No borrar el menú: **cambiar lo que dice**. El
campo `modelos` pasa de nombrar marcas a nombrar CAPACIDAD, que es lo que el
médico compra:

```ts
// antes: modelos: 'Opus 4.8 + GPT-5 + 2ª opinión'
// después: capacidad: 'Máximo razonamiento + segunda revisión independiente'
```

El campo `incluye` de cada motor ya está escrito así y es bueno. `perfil` y
`creditos` no cambian, así que no se mueve ni el precio ni el enrutado actual.

**Prueba requerida.** Un guardián que recorra `MOTORES` y las cadenas de cara
al médico y falle si aparece `claude|gpt|gemini|opus|sonnet|haiku|anthropic|
openai`. Probado al revés: se le mete un nombre de modelo y tiene que fallar.

**Dueño** #306 (UX de consultorio) con el dueño del producto, porque cambia
copy comercial.

---

## HANDOFF-2 — Umbrales de calidad: `NEEDS_CLINICAL_REVIEW`. Dueño + `#303`

**Archivo** `src/lib/ia/router/tareas.ts` (este riel; no requiere tocar otro)
**Símbolo** `PISO_ESTRUCTURAL`, `NEEDS_CLINICAL_REVIEW`
**Severidad** **P1 para poder enchufar el router**; P3 mientras esté preparado.

**Qué falta, literal.**

1. Exactitud mínima por campo para `note_rendering`, `clinical_reasoning` y
   `safety_review`.
2. Tamaño mínimo de muestra para declarar que un modelo pasa una clase.
3. Caducidad en días de una evidencia (hoy sólo caduca por versión de corpus).

**Por qué no se rellenaron.** `clinical-safety.md` §1. Un `0.9` plausible no
falla ninguna prueba y acaba citado como si alguien lo hubiera medido — y es el
número que decide si un modelo barato puede redactar la nota que se firma.

**Consecuencia hoy, medida.** Sin esos números el router falla cerrado en el
100 % de las tareas de riesgo `material` o superior (`piso_no_medible` /
`QUALITY_NOT_PROVEN`). Está en `informe-sombra.md`.

**Cambio mínimo.** Declarar los tres valores con quién los fijó y cuándo, y
pasarlos como `pisoCalidad` desde la capa clínica. El router ya los acepta: es
un dato de entrada, no una constante que haya que editar.

**Dueño** el dueño del producto, con la capa clínica de #303.

---

## HANDOFF-3 — Límites de contexto y salida sin cargar. Este riel, con fuente

**Archivo** `src/lib/ia/router/catalogo.ts`
**Símbolo** `CapacidadModelo.limiteContexto` / `.limiteSalida`
**Severidad** **P2**

**Qué pasa.** Están todos en `null` porque no se pueden escribir de memoria. La
consecuencia está implementada: una tarea que declara `requiereContextoLargo`
no encuentra candidato y devuelve `CAPABILITY_NOT_MET` en vez de elegir a
ciegas.

**Cambio mínimo.** Cargarlos leyendo la página de cada proveedor, con `fuente`
y `consultado`, igual que `precios-modelo.ts` hace con las tarifas.

**Prueba requerida.** Que un modelo con límites cargados acepte una entrada que
cabe y rechace una que no; y que uno sin límites siga fallando cerrado ante
`requiereContextoLargo`. La segunda mitad ya existe.

**Dueño** este riel. Requiere una consulta a la documentación de proveedor, no
una decisión.

---

## HANDOFF-4 — El router no tiene consumidor. `#306`

**Archivo** el flujo de consulta (superficie de #306)
**Severidad** **P2** — declarado, no escondido.

**Qué pasa.** `decidirRuta()` no lo llama nadie en producción. Está declarado
en los dos trinquetes del repositorio
(`modulos-sin-conectar.test.ts`, `el-camino-del-medico-llega-entero.test.ts`)
con su motivo, en vez de dejarlo pasar callado.

**Por qué no se conectó.** Dos razones, y la segunda manda:

1. El consumidor natural es el flujo de consulta, superficie de #306, que está
   PREPARED_ONLY hasta que cierren #302 y #303.
2. **Sin evidencia cargada, conectarlo hoy apagaría la IA**, no la mejoraría:
   el router fallaría cerrado en todo. HANDOFF-2 va antes que éste.

**Forma de la conexión, cuando toque.** El llamador construye una
`SolicitudTarea` (clase, riesgo, latencia, piso, señales), llama a
`decidirRuta()`, y pasa `proveedorSeleccionado` + `[modeloSeleccionado,
...respaldos]` a `llamarIA()`. **El gateway no cambia**: ya recibe proveedor y
lista de modelos. Ése era el objetivo de diseño.

**Prueba requerida.** Una prueba de integración que demuestre que un fallo de
ruteo llega al médico como estado funcional (`capacidad_limitada`), no como un
nombre de modelo ni un código.

**Dueño** #306.

---

## HANDOFF-5 — La telemetría de ruteo no tiene sumidero. `#342` (escala/observabilidad)

**Archivo** el destino de la telemetría (superficie de #342/#310)
**Símbolo** `EventoRuteo`, `cerrarEvento()`
**Severidad** **P3**

**Qué pasa.** El evento se construye y se valida (lista blanca, sin PHI, con
pruebas al revés) pero nadie lo escribe en ningún sitio. Sin él no se puede
calcular la **tasa de segunda opinión**, y `economia.ts` lo declara con
`tasaSegundaOpinion: null` en vez de deducirla del libro de costos, que no la
sabe.

**Cambio mínimo.** Un sumidero que acepte `EventoRuteo` y rechace lo que
`infraccionesDePhi()` marque. No debe ir al libro de costos: son dos registros
con distintos lectores y distinta retención.

**Dueño** #342 / #310.

---

## Decisiones que requieren al dueño (gasto, credenciales, proveedor)

Ninguna se tomó. Se listan porque el riel las hace visibles:

1. **Tercer proveedor (Gemini u otro).** El catálogo tiene una fila
   `estado: 'declarado'` que demuestra que se puede razonar sobre un candidato
   futuro sin poder ejecutarlo. **No hay llave, no hay contrato y no se pidió
   ninguno.** Contratarlo es decisión del dueño e implica gasto.
2. **Presupuesto de evaluación.** Medir cada modelo en cada clase de tarea
   cuesta llamadas de pago. No se gastó ni una: todo el harness corre sin red.
   El tamaño de la muestra (HANDOFF-2) decide cuánto costaría.
3. **Corpus de-identificado.** `data-privacy.md` exige decisión explícita del
   dueño y consentimiento documentado. El corpus de hoy es sintético y lo dice.
4. **Topes de gasto** (`EstadoPresupuesto.topeUsd`, `topeReintentos`,
   `topeTasaSegundaOpinion`) están en `null` = sin tope declarado. **No se
   inventó ninguno**: un tope puesto por un módulo apagaría la IA de un
   consultorio por un número que nadie decidió.
