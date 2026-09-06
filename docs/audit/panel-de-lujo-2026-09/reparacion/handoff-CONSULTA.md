# Handoff de CONSULTA — lo que hay que reparar en archivos de otras rebanadas

Todo lo de aquí es la MITAD de un hallazgo cuya otra mitad ya está reparada en
`reparacion/CONSULTA`. Ninguno de estos archivos se tocó desde esta rama.

---

## Para MOTORES

### 1. `EntradaCopiloto` no acepta la edad en meses ni en días (bloquea el cableado que la consulta debe hacer)

- **Archivo**: `src/lib/expediente/copiloto.ts` (`EntradaCopiloto`, l.64) y
  `src/types/expediente.ts`.
- **Qué falta**: campos `edadMeses?: number` y `edadDias?: number`, y el aviso
  crítico cuando un fármaco está contraindicado a esa edad más el aviso de acción
  cuando la edad no consta (REP-054).
- **Qué hace la consulta en cuanto existan**: ya deriva la edad en meses con la
  fecha del consultorio —`edadEnMesesDelPaciente`, en
  `src/app/(dashboard)/consulta/[patientId]/page.tsx`— y la pasa a
  `entradaCopiloto` en la misma línea donde hoy pasa `edad`. Sin el campo en el
  tipo, TypeScript rechaza la propiedad, así que no se pudo cablear: un lactante
  de tres meses sigue sin esa protección.
- **Prueba que lo cubrirá**: `REP-054-copiloto-sin-edad-no-ve-contraindicacion`,
  más un caso en `panel-de-lujo-los-paneles-de-la-consulta.test.ts` que exija
  `edadMeses={edadEnMesesDelPaciente}` en el montaje.

### 2. `MedicamentoConsulta` / `Medicamento` sin presentación ni concentración (MP-005)

- **Archivo**: `src/types/expediente.ts` (`Medicamento`) y
  `src/lib/seguridad/dosis.ts` (`revisarUnidadDosis`, aviso
  `volumen_sin_concentracion`).
- **Qué falta**: el campo de presentación/concentración («jarabe 250 mg/5 mL») y
  el aviso cuando se receta un volumen sin concentración.
- **Qué hará la consulta**: capturarlo en el renglón del medicamento, junto a la
  dosis. La fila ya tiene encabezado de columna y `aria-label` por campo
  (D-005), así que añadir una columna es un cambio local.

### 3. Embarazo y lactancia como campo (MG-001)

- **Archivo**: `src/types/expediente.ts` (o `Patient` en `src/types/index.ts`,
  según dónde decida vivir).
- **Qué hará la consulta**: capturarlo y pasarlo al copiloto; hoy el estado
  gestacional sólo existe como texto pegado en la sección «gineco» y por eso no
  entra por `dxDelCuadro` a `entradaCopiloto` (MG-022 lo dejó dicho).

### 4. Lateralidad dudosa: caja ámbar y deshacer (MO-001 · MO-002, parte de pantalla)

- **Qué falta del lado del motor**: que la ambigüedad de lateralidad llegue a la
  consulta como un motivo de confirmación con su cita.
- **Qué hará la consulta**: pintarla en la caja ámbar de «Conviene confirmar
  antes de firmar» y ofrecer deshacer, igual que hacen ahora
  `CambiosCifrasPanel` y `CorreccionesPanel` (D-001).

---

## Para RECETA-DOCS

### 5. El peso de la nota entra a `revisarDosis` sin pasar por su guarda (MP-006, mitad de la receta)

- **Archivo**: `src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx:196-211`
  (`pesoParaDosis` → `revisarDosis({ … peso: kgMasa(pesoParaDosis) })`).
- **Qué falta**: pasar ese peso por `revisarPesoPediatrico(pesoKg, pesoPrevio)`
  cuando el paciente es menor, con el mismo alto en seco VISIBLE que ahora tiene
  la consulta: mientras no se confirme, no se calcula por kilo y se dice.
- **Prueba lista para activarse**: el caso `it.todo('HANDOFF RECETA-DOCS · …')`
  de `src/__tests__/el-peso-de-signos-pasa-por-la-guarda-de-unidad.test.ts`
  (REP-053). Quitarle el `.todo` en cuanto exista el arreglo.

---

## Para PORTAL

### 6. Las indicaciones del médico no viajan al paquete del paciente (PO-004 · PG-002)

- **Archivo**: `src/lib/paciente/paquete-de-visita.ts` (`NotaParaElPaquete`,
  l.223-232, y `componerPaquete`, l.318-345, que fija `warningSigns: []`).
- **Qué falta**: incluir las indicaciones LITERALES de la nota firmada —las
  mismas claves de plantilla que ahora usa la hoja impresa:
  `planPostop`, `signosAlarma`, `indicacionesAlta`, `indicacionesEgreso`,
  `planTratamiento`, `plan`— como sección propia con su procedencia («de tus
  indicaciones firmadas»). Nunca componer signos de alarma «habituales».
- **Qué ya se hizo aquí**: la hoja impresa sí las lleva (MC-002) y el texto de
  `EntregarAlPaciente` dejó de prometer lo que no viaja, y dice por dónde sí
  llegan hoy. Cuando el paquete las lleve, hay que **volver a cambiar ese
  texto**; el caso que lo vigila está en
  `panel-de-lujo-la-consulta-entrega-lo-que-promete.test.ts`.

---

## Para PROMPTS-ASR

### 7. La ruta de diarización no lee `contexto` (B-009, otra mitad)

- **Archivo**: `src/app/api/expediente/transcribir-diarizado/route.ts` (l.150-205,
  donde se arma `ctxSesgo` por los dos caminos).
- **Qué falta**: leer `contexto` (multipart y JSON) y expandirlo con
  `nombresDelModulo()` + `terminosDeEspecialidades()` antes de `componerSesgo`.
  `nombresDelModulo` está escrita y no la llama nadie (`lexicon.ts:174-179`): se
  escribió justamente para esto.
- **Qué ya se hizo aquí**: el hook lo manda por los dos caminos de la
  diarización. Mientras la ruta no lo lea, es un campo ignorado — no un error.
- **Guardián a extender**: el de REG-520
  (`lo-aprendido-llega-al-motor-que-transcribe.test.ts`) para exigir que las
  TRES rutas lean `contexto`, no sólo las dos de Whisper.

### 8. La extracción no devuelve los estudios solicitados (MO-004, aguas arriba)

- **Archivo**: `src/lib/expediente/extraction-schema.ts:314-321`.
- **Qué falta**: que el esquema devuelva los estudios con `source_quote` y una
  marca `estudio_solo_propuesto` cuando el verbo es condicional.
- **Qué ya se hizo aquí**: la consulta recoge los estudios que el **extractor de
  entidades** (`entidades.tests`) ya devuelve y los ofrece para la orden, con
  revisión visible. Con el campo en la extracción de la nota, el mismo bloque
  puede alimentarse de las dos fuentes.

---

## Para SEGURIDAD

### 9. `Patient.consentimientoGrabacion` no puede guardar qué texto se leyó (PC-012 · PI-008 · PP-009 · PG-004)

- **Archivo**: `src/types/index.ts:264-267`, `firestore.rules` (forma congelada
  de `patients`) y `src/lib/authz/matriz-acceso.ts` si aplica.
- **Qué falta**: `version` (o `hash` del texto, como ya hace
  `AvisoPrivacidadModal`), `otorgadoPor?: { nombre, parentesco }` para el
  consentimiento por representante, y `retiradoEn?: string` con quién lo retiró.
- **Qué ya se hizo aquí**: el texto vive en un módulo con
  `VERSION_DEL_CONSENTIMIENTO` y se dirige al tutor cuando el paciente es menor.
  En cuanto el campo exista, la consulta escribe la versión en el mismo
  `updatePatient` que ya hace (está señalado con un comentario en el código), y
  `yaConsintio` puede pasar a `false` cuando la versión cambie o haya retiro.
- **Antes de escribir código**: la redacción del consentimiento por representante
  y la política de re-consentimiento son `NEEDS_LEGAL_REVIEW` (decisión del
  dueño).

---

## Para UI-CONFIG

### 10. `citasEnTexto` vive como función local de `/consultor` (RT-004, higiene)

- **Archivo**: `src/app/(dashboard)/consultor/page.tsx:38`.
- **Qué convendría**: mover el escaneo de `[n]` a un módulo compartido y que las
  dos pantallas lo importen. La consulta ya tiene el suyo
  (`consulta/[patientId]/citas-del-analisis.ts`, que además marca y no borra);
  hoy hay dos implementaciones porque cruzar rebanadas costaba más que el
  duplicado. `REP-082` acepta las dos formas.

### 11. El guardián de módulos huérfanos no distingue «importado» de «usado» (MI-003, segunda mitad)

- **Archivo**: `src/__tests__/modulos-sin-conectar.test.ts:196` (`importados()`
  marca conectado cualquier archivo al que apunte un import de valor).
- **Qué falta**: mirar el USO como elemento JSX o `createElement`, no el import.
  Es su tercer falso negativo, después del nombre de archivo y del `import type`
  que el propio archivo ya documenta.
- **Qué ya se hizo aquí**: `src/__tests__/el-sello-de-motor-sin-validar-se-pinta.test.ts`
  hace exactamente esa distinción, pero sólo para `SelloMotor`.

### 12. `RANGOS_UCI` no se exporta (ASN-002, higiene)

- **Archivo**: `src/lib/uci/extraccion.ts:319`.
- **Qué convendría**: exportarla para que la compuerta de plausibilidad de la
  consulta la importe en vez de copiar sus valores. Hoy están copiados **con su
  origen escrito al lado** en `signos-que-se-capturan.ts`, precisamente para no
  tocar un archivo ajeno; si se exporta, ese módulo debería pasar a importarla.

---

## Nota para el orquestador

`scripts/design/techos-de-diseno.json` se volvió a sellar desde esta rama
(1868→1857 en `tamanosFueraDeEscala`, 599→598 en `radiosFueraDeEscala`) porque
la prueba `el-sistema-de-diseno-no-pierde-terreno.test.ts` exige que el techo sea
exactamente la medición. Si otra rebanada lo sella también, la fusión se resuelve
corriendo `node scripts/design/trinquete-de-diseno.mjs --actualizar` una vez
sobre el árbol integrado. Lo mismo con `docs/design/SCREEN_INVENTORY.md`
(`node scripts/design/inventario-de-pantallas.mjs`).
