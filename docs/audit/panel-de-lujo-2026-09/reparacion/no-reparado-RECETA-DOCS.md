# No reparado — RECETA-DOCS

Lo que quedó fuera, y por qué. Nada de esto es «no me dio tiempo»: cada punto
tiene una razón que sobrevive a la prisa.

---

## 1. MO-011 · la pantalla única de cierre y el certificado de incapacidad

**Estado: parcial.** Lo que sí se hizo: enlaces directos entre /receta y /orden
(antes había que volver a la nota entre documento y documento), catálogo de
imagen concreto y lateralidad obligatoria — que es donde estaban los clics de
verdad.

**Lo que no**: la propuesta pedía «una sola pantalla de cierre que muestre
receta, orden y certificado pre-poblados y los imprima juntos». Eso es una
pantalla nueva y un tipo de documento nuevo (la incapacidad/certificado **no
existe** en el producto). Dos cosas:

* La pantalla de cierre toca `queFaltaParaCerrar`, la consulta y la navegación —
  tres rebanadas — y cambia el flujo que hoy funciona. No es una reparación: es
  un rediseño, y el equipo rojo ya bajó el hallazgo a P3 precisamente porque «no
  es un hallazgo propio: es la suma de MO-003, MO-004 y MO-010 contada en clics».
* El certificado de incapacidad tiene requisitos legales (qué dice, quién lo
  puede emitir, qué formato acepta el IMSS) que este repositorio no tiene
  escritos en ningún sitio: inventarlos sería fijar política. `NEEDS_CLINICAL_REVIEW`
  y decisión del dueño.

## 2. MC-021 · el día postoperatorio y la tarea «retirar puntos»

**Estado: parcial.** La nota postoperatoria ya tiene dónde asentar la fecha del
procedimiento (sección `fechaProcedimiento`), que es lo que faltaba para poder
capturarla.

**Lo que no**: el cálculo determinista del día postoperatorio y la tarea clínica
de retiro de puntos necesitan un campo ESTRUCTURADO en `NotaMedica`
(`procedimiento { fecha, nombre, lateralidad }`) con su sello nuevo (REG-059) y
su derivación en el motor de tareas. `src/types/expediente.ts` y
`src/lib/tareas-clinicas/**` son de otras rebanadas. Está en el handoff con la
forma exacta. Y el plazo del retiro **no se propone**: lo fija el médico.

## 3. N-022 · recordatorios de toma y adherencia

**Estado: parcial.** La renovación de crónicos —la pieza del lado del médico—
está hecha y probada. Las otras dos viven enteras en el portal del paciente
(`src/app/mi/**`, `src/app/api/portal/**`), que es otra rebanada. Handoff.

## 4. PC-022 / PP-014 · el botón del portal

**Estado: parcial.** La función existe y está documentada
(`abrirRecetaParaImprimir`, `src/lib/receta-word.ts`): abre el mismo documento
en una ventana e imprime, que es de donde sale el PDF en un teléfono. Cablearla
al botón de `src/app/mi/[token]/page.tsx` es de PORTAL. Handoff.

## 5. Once casos rojos que vienen de la rama base

`npx vitest run` no queda entero en verde, y **no es por esta rebanada**. Medido
con `git stash` sobre mi propia rama: en `7066d3a` —la base, que trae el motor de
dosis recién reparado— hay **11 casos rojos en 6 archivos**:

* `src/__tests__/dosis-unidad-ausente.test.ts` — «los volúmenes son OTRO problema»
  (ahora sí avisan: es el arreglo de MP-005, y el golden viejo no se actualizó).
* `src/__tests__/dosis-avisa-antes-de-firmar.test.ts` — «5 mL/h» de una velocidad
  de infusión entra por la misma puerta nueva.
* `src/__tests__/medical-dictionary.test.ts`, `e0-15-antibiograma-decisiones.test.ts`,
  `nom004.test.ts` y `la-alergia-estructurada-llega-a-la-compuerta.test.ts` — la
  reactividad cruzada penicilina → cefalosporina dejó de dispararse con la nueva
  cobertura por clase.

Los cuatro últimos tocan la decisión clínica de qué clase alerta sobre qué otra,
que el propio motor declara `NEEDS_CLINICAL_REVIEW`. **No los toqué**: hacerlo
desde la compuerta de firma (`nom004.ts`, que sí es mío) significaría escribir un
segundo criterio de reactividad cruzada — exactamente el defecto que MI-004
denuncia. Está en el handoff para MOTORES.

## 6. Una prueba intermitente que no es de nadie

`src/__tests__/ops-timeout-y-punto-ciego.test.ts` → «el error dice cuánto esperó
y a quién» hace una petición real a `10.255.255.1` con 30 ms de tope. Bajo carga
falla y en reposo pasa; **comprobado en la rama base sin mis cambios**: falla una
corrida y pasa la siguiente. No es una regresión de esta rebanada, pero conviene
que alguien la haga determinista (un `fetch` inyectado en vez de la red real).

## 7. Lo que ninguna prueba de esta rebanada puede afirmar

* **Que el dato LLEGUE a Firestore.** Las adendas de la carta de referencia y de
  la orden emitida se comprueban por contrato (la pantalla llama a
  `agregarAdenda` y a `logAudit`), no mirando el documento real. Cerrar eso exige
  el emulador y está descrito en `scripts/verificar-invariantes-de-datos.md`.
* **Que el impreso se vea bien.** No se renderizó el DOM: `RecetaDocumento` no
  termina su paginación sin medición de navegador. La regla de diseño pide
  lanzar el producto y mirarlo; eso sigue pendiente para las tres pantallas que
  cambiaron (receta, orden, referencia).
