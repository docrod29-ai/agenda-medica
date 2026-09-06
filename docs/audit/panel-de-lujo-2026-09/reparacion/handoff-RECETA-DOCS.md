# Handoff — RECETA-DOCS

Lo que hace falta para cerrar del todo hallazgos de mi lista, pero cae en
archivos que **no son míos**. No los toqué: el conflicto de fusión sale más caro
que la coordinación.

---

## Para SEGURIDAD

### 1. MC-004 — colección propia para la carta de referencia (opcional, no urgente)

Hoy la carta se asienta como **adenda** de la nota firmada (`adendas`, ya
declarada en los tres sitios) y deja su evento `referencia_emitida`. Eso cierra
el hallazgo: hay expediente, hay bitácora y hay línea de tiempo.

Si el dueño prefiere que la referencia sea una **entidad de primera clase**
—reimprimible, con su propio estado (emitida / contestada) y su
contrarreferencia—, hace falta una colección. Esta es la forma exacta, para que
la decida quien manda en `firestore.rules`:

```
// clinics/{clinicId}/patients/{patientId}/referencias/{refId}
match /referencias/{refId} {
  allow read: if isMedico(clinicId);
  allow create: if isMedico(clinicId)
                && clinicaPuedeEscribir(clinicId)
                && request.resource.data.autorUid == request.auth.uid
                && request.resource.data.keys().hasOnly([
                     'tipo', 'urgencia', 'destino', 'institucion', 'motivo',
                     'resumen', 'diagnosticos', 'tratamiento', 'estudios',
                     'notaId', 'autorUid', 'autorNombre', 'autorCedula',
                     'createdAt', 'huella',
                   ])
                && request.resource.data.tipo in ['referencia', 'contrarreferencia'];
  allow update, delete: if false;   // un documento emitido no se edita ni se borra
}
```

Y con ella, las otras dos declaraciones:

* `src/lib/authz/matriz-acceso.ts` — ruta
  `clinics/{clinicId}/patients/{docId}/referencias/{refId}`, clase `clinico`
  (secreto médico: lleva motivo, resumen y diagnósticos), lectura y escritura
  sólo `medico`.
* `src/lib/clinica/respaldo.ts` — subcolección del paciente, junto a `notas`,
  `laboratorios` y `fotos`. Una colección que nadie respalda se pierde el día
  que hace falta.

**Mientras no exista, no hay nada roto**: la carta ya queda escrita.

### 2. Evento nuevo en la bitácora

Añadí `referencia_emitida` a `AuditEvento` y a `EVENTO_LABEL`
(`src/lib/expediente/audit-eventos.ts`). Ese archivo no es de nadie en el reparto
y es probable que dos rebanadas añadan eventos a la vez: **conflicto de fusión
esperable en esas dos líneas**, trivial de resolver (quedarse con los dos).

---

## Para PORTAL

### 3. PC-001 / PO-001 — la otra mitad del diagnóstico descartado

`diagnosticoParaImprimir` (`src/lib/expediente/fusionar-diagnosticos.ts`) ya
filtra por `estaVigente`: no imprime descartado, diferencial ni resuelto, y si no
queda ninguno devuelve cadena vacía. **Se puede reusar tal cual** en:

* `src/app/api/portal/route.ts:1090` (acción `documentos`), donde hoy va
  `(n.diagnosticos ?? []).map(dx => dx.descripcion).join(', ')` — veinte líneas
  más arriba la misma expresión SÍ aplica `medicamentosDeLaReceta`;
* `src/lib/paciente/paquete-de-visita.ts:337` (`encounterSummary`).

Prueba que lo cubre del lado del médico:
`src/__tests__/el-impreso-no-lleva-un-diagnostico-descartado.test.ts`. La
reproducción `REP-072` sigue en `reproducciones/` porque su mitad es vuestra.

### 4. MO-005 — la orden emitida después de firmar no llega al paquete

Una orden emitida sobre una nota **ya firmada** se asienta como adenda (no se
puede escribir `estudiosOrden` en una nota sellada sin romper su hash, REG-059).
`paquete-de-visita.ts:341` lee `n.estudiosOrden`, así que esa orden no aparece en
`orders`. Para cerrarlo: leer también las adendas cuyo `motivo` empieza por
«Orden de estudios emitida», o —mejor— exponer una lectura conjunta desde el
expediente. El texto asentado lo compone `textoDeLaOrdenEmitida`
(`src/lib/orden-emitida.ts`) y es estable.

### 5. PC-022 / PP-014 — el botón de imprimir en el portal

Dejé lista la función: `abrirRecetaParaImprimir(data, config, recetaConfig,
onError)` en `src/lib/receta-word.ts`. Abre el MISMO documento en una ventana y
lanza el diálogo de impresión (de ahí sale el PDF en cualquier teléfono
moderno). Falta cablear un segundo botón —«Ver / imprimir»— junto a «Descargar»
en `src/app/mi/[token]/page.tsx:1055`. El `.doc` se queda: REG-507 explica por
qué es autocontenido.

### 6. N-022 — las dos partes que viven en el portal

De las tres piezas de «que la receta siga viva», cerré la del médico (renovar lo
vigente en un toque, `src/lib/receta-renovacion.ts`). Quedan, y son vuestras:
recordatorio de toma sobre el plan liberado, y la pregunta de **adherencia**
(«¿siguió tomándolo?») cuyo resultado alimenta la siguiente consulta. Ninguna
necesita un umbral clínico; si alguna lo necesitara, es `NEEDS_CLINICAL_REVIEW`.

---

## Para EXPEDIENTES

### 7. MC-020 — borrar la copia local de `esHospitalaria`

`esHospitalaria` en `src/lib/expediente/templates.ts` ya implementa la regla
buena (manda el `internamientoId`; el tipo sólo decide en ingreso, evolución,
evolución de UCI y egreso) y acepta el tipo suelto o la nota entera. La copia
local de `src/app/(dashboard)/expediente/[patientId]/page.tsx:63` puede
sustituirse por un import.

**Ojo**: `src/__tests__/v15-el-expediente-lleno-no-dice-que-esta-vacio.test.ts:161`
congela literalmente `const esHospitalaria =` en esa pantalla, así que hay que
actualizar esa línea del golden en el mismo cambio.

### 8. C-018 — los seis sitios de «1 años» que no son míos

Ya existe `edadLegible` / `conEtiquetaDeEdad` en `src/lib/edad-legible.ts`.
Faltan:

* `src/app/(dashboard)/expediente/[patientId]/page.tsx:921`
* `src/app/(dashboard)/pacientes/page.tsx:424` y `:793`
* `src/components/PatientAnchor.tsx:126-129`
* `src/components/ValoracionInmuno.tsx:338`
* `src/app/(dashboard)/consulta/[patientId]/page.tsx:4786` (CONSULTA)

---

## Para UI-CONFIG (y quien toque pantallas)

### 9. C-015 — el resto del patrón UTC

`new Date().toISOString().slice(0, 10)` sigue vivo fuera de mi rebanada:
`superadmin/costos:53`, `contabilidad:52` y `uci/ResumenPase.tsx:71` (éste es el
que más duele: la revisión de HOY se guarda bajo la clave de mañana y vuelve a
pedirse). Sustituir por `hoyISO()` de `src/lib/timezone.ts`.

### 10. Archivos generados que TODOS vamos a tocar

* `docs/design/SCREEN_INVENTORY.md` — lo regeneré con
  `node scripts/design/inventario-de-pantallas.mjs` porque su guardián compara
  contra el árbol real y mis pantallas cambiaron de tamaño. **Conflicto seguro**
  con las demás rebanadas: regenerar una vez al integrar, no resolver a mano.
* `scripts/design/techos-de-diseno.json` — bajé `hexEnLinea` de 320 a 316
  (extraje el rojo del papel de `RecetaDocumento` a una constante). El guardián
  exige que el techo sea EXACTAMENTE el conteo, así que al integrar hay que
  correr `node scripts/design/trinquete-de-diseno.mjs --actualizar` una vez.

---

## Para MOTORES

### 11. La reactividad cruzada penicilina → cefalosporina desapareció

En la rama base (`7066d3a`) hay **once casos rojos** que no son míos y que
dependen de decisiones de `medical-dictionary.ts` / `dosis.ts`. Dos de ellos
tocan un archivo mío pero no su lógica:

* `src/__tests__/nom004.test.ts` — «alergia a penicilina + cefalosporina bloquea
  la firma».
* `src/__tests__/la-alergia-estructurada-llega-a-la-compuerta.test.ts` — el
  mismo caso.

Con la nueva cobertura por clase, `miembrosCubiertosPorAlergia('Penicilina')`
devuelve la subfamilia de las penicilinas y **cefalexina no está**, así que el
cruce dejó de dispararse. Ampliarlo es criterio clínico (el propio módulo lo
declara `NEEDS_CLINICAL_REVIEW`), y por eso no lo toqué desde la compuerta:
duplicaría el criterio. **Hay que decidirlo y actualizar esos dos goldens**, o
restaurar la cobertura en el motor.

Lista completa de lo rojo en la base, medido con `git stash` sobre mi rama:
`dosis-unidad-ausente`, `dosis-avisa-antes-de-firmar`, `medical-dictionary`,
`e0-15-antibiograma-decisiones`, `nom004`,
`la-alergia-estructurada-llega-a-la-compuerta` — 11 casos en 6 archivos.

### 12. Reproducción ajena que hace fallar `tsc`

`docs/audit/panel-de-lujo-2026-09/reproducciones/REP-013-dos-catalogos-renales.test.ts`
tiene un error de tipos (`ClinicalQuantity<"depuracion"> | ...`) y `tsc` lo
compila porque la carpeta entra en el proyecto. No es mío; al moverlo a
`src/__tests__` (o al borrarlo) se va.

### 13. MC-021 — el modelo del procedimiento

Añadí la sección de texto `fechaProcedimiento` a la nota postoperatoria, que es
lo que se puede hacer sin tocar el modelo. Para que un motor calcule el **día
postoperatorio** y para que exista la tarea «retirar puntos / drenaje» hace falta
un campo estructurado en `NotaMedica` —`procedimiento { fecha, nombre,
lateralidad }`— con su sello nuevo (REG-059) y su derivación en
`src/lib/tareas-clinicas/derivar.ts`. Sin plazo propuesto: el plazo lo fija el
médico.

---

## Para PROMPTS-ASR

### 14. El prompt de la nota quirúrgica no pide lo que ahora cabe

`SECCIONES_POR_TIPO.nota_postoperatoria` tiene ahora operación planeada, fecha y
lugar del procedimiento, equipo quirúrgico, cuenta de gasas/compresas/
instrumental, estudios transoperatorios, piezas a patología y pronóstico. El
prompt (`src/lib/expediente/prompts.ts:548`) no los menciona, así que la IA no
los redactará y quedarán vacíos salvo que el médico los escriba. Mismo caso para
`pronostico` en las notas de consultorio y `tipoIntervencion` en la
preoperatoria.
