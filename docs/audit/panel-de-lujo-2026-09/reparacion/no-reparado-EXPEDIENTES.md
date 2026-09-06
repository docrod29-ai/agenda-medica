# Lo que NO se reparó en EXPEDIENTES, y por qué

Los 31 hallazgos de la lista quedan **CLOSED** en `ledger-EXPEDIENTES.md`. Lo que
sigue es lo que quedó **a medias dentro de un hallazgo cerrado**, dicho con
nombre para que nadie lo dé por entero. Cada punto dice quién puede terminarlo.

---

## 1. ASE-027 — la importación sigue dependiendo de la pestaña

**Lo que se hizo**: hay progreso visible («340 de 1 200 · no cierres esta
pestaña»), las filas que fallan se nombran y se pueden bajar en CSV, y el
contenido pegado ya no se borra cuando algo falló, así que reintentar sólo lo
fallido es posible.

**Lo que NO se hizo**: la importación sigue siendo N altas una a una desde el
navegador. Cerrar la pestaña a la mitad deja media importación.

**Por qué**: la reanudación de verdad exige que el archivo lo reciba el
**servidor** (como ya hace `clinic/importar`) y que el trabajo viva ahí. Eso es
una ruta nueva con su propio modelo de progreso y su idempotencia, no un ajuste
de esta pantalla — y `clinic/importar` es de otra rebanada.

**El control que sí existe, y su límite**: reanalizar el mismo CSV reclasifica lo
ya importado como duplicado, así que no se crea dos veces. Ese control dependía
de que las fechas se compararan igual las dos veces, que es exactamente lo que
ASE-003 rompía — **y eso ya está reparado**: la fecha se normaliza a ISO antes de
escribirse y antes de comparar. El control es fiable ahora, y no lo era.

**Quién lo termina**: UI-CONFIG (dueño de las rutas de `api/**` que nadie más
posee) junto con quien tenga `clinic/importar`.

---

## 2. ASE-026 — es un HTML imprimible, no un PDF

**Lo que se hizo**: la entrega de acceso baja los dos archivos del mismo paquete:
el `.json` sobre el que se calculó el hash (intacto, es lo que se acredita) y una
copia legible en HTML con el mismo hash impreso, que declara lo que no se pudo
incluir y explica cómo guardarla como PDF.

**Lo que NO se hizo**: generar el PDF.

**Por qué**: exigiría una dependencia nueva —y el briefing prohíbe dependencias
sin motivo escrito— o el motor de impresión de las recetas
(`print-element`/`pdf-*`), que es de RECETA-DOCS.

**Lo que además no decide esta reparación**: si un HTML imprimible satisface el
«formato legible» del Art. 33 de la LFPDPPP. Queda como `NEEDS_LEGAL_REVIEW` en
la cabecera de `src/lib/compliance/copia-legible-arco.ts`: **lo decide el abogado
del consultorio, no un agente.**

---

## 3. ASE-012 — el consentimiento revocado no queda marcado en el expediente

**Lo que se hizo**: la revocación apaga el contacto de verdad (reutiliza
`/api/arco/oponerse`, que es la ruta que ya sabe hacerlo y dejar constancia de lo
que no puede apagar sola) y guarda la constancia en la solicitud.

**Lo que NO se hizo**: marcar en `patients/{id}` que el consentimiento está
revocado.

**Por qué**: hace falta un campo nuevo en `Patient` y su forma congelada en
`firestore.rules` — los dos de SEGURIDAD. Escribirlo desde aquí habría dejado un
campo que las reglas no vigilan y que el respaldo no declara, que es el defecto
que `security-tenant.md` existe para evitar.

**Lo que se hizo en su lugar**: se dice en la resolución, en vez de fingirlo.
Detalle y receta en `handoff-EXPEDIENTES.md` §3.

---

## 4. ASE-011 — el candado sigue viviendo en la pantalla, no en el servidor

**Lo que se hizo**: `identidadVerificada: true` dejó de estar escrito a fuego en
el cliente (estaba en tres sitios) y sale de la casilla que el médico marca, con
quién y cuándo.

**Lo que NO se hizo**: que el servidor **exija** que la solicitud esté verificada
en vez de creerle al body.

**Por qué**: `api/arco/**` es de SEGURIDAD. Está en `handoff-EXPEDIENTES.md` §3
con la receta exacta (leer `arco_requests/{id}` y comprobar su
`identidadVerificada`, que es lo que escribe `ligarSolicitudArcoAExpediente`).

**Lo que esto significa hoy, dicho claro**: quien controle el navegador puede
mandar `identidadVerificada: true` sin marcar la casilla. **No es una regresión
—era exactamente así antes—, pero tampoco está cerrado.** El defecto que sí se
cerró es que la propia aplicación lo afirmara por el médico.

---

## 5. ASE-009 — la fusión no tiene prueba de ida y vuelta contra la base

**Lo que se hizo**: el motor de decisión (`planDeFusion`) es puro y está probado
al revés; la ruta está probada por contrato (recalcula el plan en el servidor,
copia verbatim, no borra, deja asiento).

**Lo que NO se hizo**: ejecutar la fusión contra datos reales y contar del otro
lado — la regla «el dato tiene que LLEGAR» aplicada aquí.

**Por qué**: esta suite corre sin emulador. Existe `vitest.emulator.config.ts`
para eso, y una prueba de ida y vuelta (sembrar dos expedientes con notas,
fundir, contar notas y citas en el destino, comprobar que el hash de la nota
firmada no cambió) es lo que faltaría. Queda anotada en
`handoff-EXPEDIENTES.md` §2.

**Lo que también falta, y es visible para el médico**: el expediente absorbido
sigue apareciendo en listas y búsquedas hasta que `lib/firestore.ts` filtre
`fusionadoEn` — es de AGENDA-MENSAJERIA.

---

## 6. D-022 — la procedencia sigue sin llegar a los documentos

Sólo se pudo corregir el comentario del componente, que afirmaba una cobertura
que el equipo rojo desmintió. Montarlo en la nota firmada, la receta y la orden
es de RECETA-DOCS, y **no hay nada que construir**: el componente ya recibe una
`NotaMedica` y decide solo qué puede afirmar.

---

## 7. Lo que se decidió NO tocar, y no es deuda

- **`similitudNombre` / `UMBRAL_NOMBRE`** (ASE-001). El razonamiento está en
  `decisiones-EXPEDIENTES.md`: 0.8 es lo que impide que «María» case con media
  consulta, y ese umbral lo usa el motor de DUPLICADOS para decidir si dos
  expedientes son la misma persona. Se arregló la BÚSQUEDA sin tocarlo.
- **El umbral de duplicado de la importación** (ASE-007). Es deliberado y está
  razonado en `csv-pacientes.ts`: evita duplicar el consultorio entero al
  reimportar. Lo que faltaba era enseñar la evidencia y dejar forzar.
- **`/expedientes` y `/pacientes`** («las dos pantallas que hacen lo mismo»).
  Ya estaban fusionadas antes de esta reparación: `/expedientes` es un redirect
  de 17 líneas con la razón escrita, y `13-QUITAR-LO-INNECESARIO.md` lo cita
  como el ejemplo a seguir para `/corte-caja`. No había nada que hacer.
