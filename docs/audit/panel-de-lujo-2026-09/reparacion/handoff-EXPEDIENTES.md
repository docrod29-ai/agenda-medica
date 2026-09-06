# Handoff de EXPEDIENTES — lo que cae fuera de mi rebanada

Cada entrada: **qué hay que cambiar · dónde · qué prueba lo cubre**.

---

## 0. AVISO PARA EL ORQUESTADOR — tres archivos ajenos tocados a propósito

La rama toca **cuatro archivos que no son de esta rebanada** porque sin ellos
`npx vitest run` no puede quedar verde en el worktree. Los cuatro cambios son
**aditivos y de una sola pieza**; si hay conflicto al integrar, la resolución es
quedarse con las dos partes.

| Archivo | Dueño | Qué se añadió | Cómo se resuelve un conflicto |
|---|---|---|---|
| `src/lib/authz/registro-rutas.ts` | SEGURIDAD | Una entrada: `'pacientes/fundir': { tipo: 'capacidad', capacidad: 'administrar' }`, con su comentario. Sin ella, `authz-rutas-declaradas` y `api-authz-guard` rechazan la ruta nueva (una ruta sin declarar es un fallo de CI, no una omisión). | Conservar las dos listas: la entrada es una línea nueva en un objeto. |
| `src/__tests__/authz-rutas-declaradas.test.ts` | SEGURIDAD | Cuatro conteos congelados subidos en 1 (`CLAVES_DISCO` 100→101, `llamadas` 99→100, `rutasConGuardia` 81→82, `conVocabulario` 56→57, `declarados/activos` 64/37→65/38) y `pacientes/fundir` añadida a las dos listas congeladas (PHI clínico e identidad), cada una con su razón escrita. | Sumar los deltas de las dos ramas; las listas van ordenadas alfabéticamente. |
| `scripts/design/techos-de-diseno.json` | UI-CONFIG | `tamanosFueraDeEscala` **bajó** de 1868 a 1860 (`node scripts/design/trinquete-de-diseno.mjs --actualizar`). El guardián exige que el techo sea la medida de hoy, sin holgura. | Quedarse con el número **más bajo** y volver a correr `--actualizar`. |
| `docs/design/SCREEN_INVENTORY.md` | UI-CONFIG | Regenerado con `node scripts/design/inventario-de-pantallas.mjs` (sale de un script, no se edita a mano). | Regenerar tras integrar: `node scripts/design/inventario-de-pantallas.mjs`. |

### Las cuatro reproducciones movidas

`docs/audit/panel-de-lujo-2026-09/reproducciones/` **no existe en el árbol
versionado**: vive sólo en el checkout compartido del orquestador. Las cuatro
reproducciones de esta rebanada se copiaron a `src/__tests__/` con su cabecera
golden reescrita (qué fallaba en pasado, la reparación, y qué NO cubre), pero
**no se pudieron borrar del origen** — no están en este worktree. Al integrar,
retirar estos cuatro archivos del checkout compartido:

| Reproducción | Dónde vive ahora |
|---|---|
| `REP-037-el-vacio-del-servidor-pisa-el-acierto-local.test.ts` | `src/__tests__/el-vacio-del-servidor-no-pisa-el-acierto-local.test.ts` |
| `REP-038-fecha-de-nacimiento-cruda-en-la-importacion.test.ts` | `src/__tests__/la-fecha-del-archivo-llega-en-iso-al-expediente.test.ts` |
| `REP-039-apellidos-en-columnas-separadas-se-pierden.test.ts` | `src/__tests__/los-apellidos-en-columnas-separadas-llegan-al-nombre.test.ts` |
| `REP-080-homonimo-con-telefono-funde-con-expediente-sin-telefono.test.ts` | `src/__tests__/un-homonimo-no-se-cuelga-del-expediente-sin-telefono.test.ts` |

---

## 1. RECETA-DOCS

### MP-017 — la receta imprime la edad CONGELADA, no la derivada

**Qué**: `receta/[patientId]/page.tsx:511` pasa `pacienteEdad: patient?.edad`, y
en esa misma pantalla convive `edadPaciente` derivada (`:191-194`) que sólo se
usa para dosificar. La receta no aplica `conLaEdadAlDia`, que sí existe y sí usa
la consulta (`consulta/page.tsx:353`).

Además, `edad: 0` (el lactante) no imprime nada en ninguno de los dos formatos,
porque `data.pacienteEdad ? …` es falso con cero:
`receta-word.ts:171` y `RecetaDocumento.tsx:654` y `:959`.

**Dónde**: `src/app/(dashboard)/receta/[patientId]/page.tsx`,
`src/lib/receta-word.ts`, `src/components/RecetaDocumento.tsx`.

**Cómo**: imprimir la edad DERIVADA (`edadParaDosificar` / `conLaEdadAlDia`), y
cambiar `edad ? …` por `edad != null ? …`. En menores de 2 años, en meses
(«8 meses»), que es como se prescribe.

**Lo que ya está hecho de mi lado**: `construirGuardadoDePaciente` ya no guarda
una edad que contradiga la fecha —la deriva—, así que la congelada ya no puede
estar vieja *desde el alta*. Pero sigue congelándose entre cumpleaños: la
derivación en el punto de impresión es lo que cierra el hueco.

**Prueba que lo cubre**: `src/__tests__/el-alta-de-un-paciente-revisa-lo-que-guarda.test.ts`
(bloque «MP-017») cubre el guardado; la impresión necesita su propio caso —el
que propuso el auditor: `descargarRecetaWord` con una `fechaNacimiento` de hace
8 meses debe imprimir «8 meses» y hoy omite la edad.

### D-022 — PROCEDENCIA no llega a las tres superficies documentales

**Qué**: `ProcedenciaDeLaNota` está montado en `/consulta`, `/expediente` y
`/demo/razonamiento`. Faltan las tres que salen impresas con una cédula encima:
la nota firmada, la receta y la orden (`grep -c` del equipo rojo: 0 en las tres).

**Dónde**: `src/app/(dashboard)/nota/[patientId]/[notaId]/page.tsx` (montarlo),
y `receta/**` y `orden/**` (enlazar a la nota).

**Cómo**: el componente recibe una `NotaMedica` y decide solo qué puede afirmar
(`procedenciaDeLaNotaArchivada`); no sabe nada del expediente ni de la lista, así
que se monta tal cual bajo el documento. **No hay nada que construir.**

**Prueba que lo cubre**: extender `medir-procedencia-expediente-v15.mjs` a
`/nota`, como propuso el auditor. Del lado de esta rebanada quedó corregido lo
que el comentario del componente afirmaba de más.

---

## 2. AGENDA-MENSAJERIA

### ASM-001 — los otros dos formularios que capturan el mismo teléfono

**Qué**: el editor de pacientes ya valida la forma del teléfono. `AppointmentModal`
(`:257`, sólo hace `telefono.replace(/\D/g, '')`) y la lista de espera siguen sin
validar, y escriben el mismo campo.

**Dónde**: `src/components/AppointmentModal.tsx`,
`src/app/(dashboard)/lista-espera/page.tsx`.

**Cómo**: importar `revisarTelefonoDelPaciente` de
`@/lib/pacientes/telefono-del-paciente` —ya escrito y probado, usa
`normalizarTelefonoWa` para enseñar el número como lo verá WhatsApp— y bloquear
«Confirmar» / «Recordar» con el motivo cuando no pasa. Es la misma función, no
una copia: tres `if` escritos por separado divergen.

**Prueba que lo cubre**: `src/__tests__/el-alta-de-un-paciente-revisa-lo-que-guarda.test.ts`
(bloque «ASM-001») cubre el motor y la pantalla de pacientes; las otras dos
pantallas necesitan su contrato textual.

### ASE-009 — el expediente fusionado tiene que salir de listas y búsquedas

**Qué**: `/api/pacientes/fundir` escribe `fusionadoEn` en el absorbido. Falta que
`listarPacientesCompat` y `buscarPacientes` lo excluyan: hoy el absorbido sigue
apareciendo, vacío, y el médico puede volver a abrirlo.

**Dónde**: `src/lib/firestore.ts`.

**Cómo**: filtrar `!p.fusionadoEn` en la lista y en la búsqueda. **No** con una
consulta `where` —Firestore no indexa la ausencia de un campo y dejaría fuera a
todos los pacientes viejos—: se filtra el resultado.

**Prueba que lo cubre**: `src/__tests__/dos-expedientes-de-la-misma-persona-se-pueden-juntar.test.ts`
declara este hueco en su «QUÉ NO CUBRE».

---

## 3. SEGURIDAD

### ASE-011 — el servidor no puede confiar en `identidadVerificada` del cliente

**Qué**: `api/arco/{acceso,cancelar,oponerse}` reciben `identidadVerificada` en el
body. Ahora la pantalla lo manda desde la casilla y ya no como constante, pero el
servidor sigue aceptando lo que le llegue: quien controle el navegador lo pone en
`true` sin marcar nada.

**Dónde**: `src/app/api/arco/acceso/route.ts`, `cancelar/route.ts`,
`oponerse/route.ts`.

**Cómo**: leer la solicitud (`arco_requests/{id}`) y exigir que su
`identidadVerificada` sea `true` —la que escribe `ligarSolicitudArcoAExpediente`
con el uid y el documento— en vez de creerle al body. El body pasaría a ser
informativo. Es «la prohibición vive en el servidor, no en la instrucción»
aplicado a un candado que hoy vive en la pantalla.

**Prueba que lo cubre**: `src/__tests__/una-solicitud-arco-real-se-puede-ejecutar.test.ts`
lo declara explícitamente en «QUÉ NO CUBRE».

### ASE-012 — falta el campo que marca el consentimiento como revocado

**Qué**: la revocación apaga el contacto (ruta de oposición) y lo deja dicho en la
resolución, pero el expediente no queda marcado: `Patient.avisoPrivacidad` no
tiene forma de decir «revocado el …».

**Dónde**: `src/types/index.ts` (el campo), `firestore.rules` (la forma
congelada), `src/lib/authz/matriz-acceso.ts` y `src/lib/clinica/respaldo.ts` si
hiciera falta declarar algo nuevo.

**Cómo**: un campo `avisoPrivacidad.revocadoEn` / `revocadoPor`, o un
`consentimientoRevocado` con fecha. **NEEDS_LEGAL_REVIEW**: qué hay que conservar
tras una revocación lo fija el abogado del consultorio.

**Prueba que lo cubre**: hoy ninguna — el hueco está declarado en
`decisiones-EXPEDIENTES.md` y en el comentario de `confirmarResolucion`.

### ASE-009 — la regla de `patients` no contempla `fusionadoEn`

**Qué**: la fusión escribe `fusionadoEn`/`fusionadoAt` con el SDK admin, que se
salta las reglas. Si algún día la escritura se moviera al cliente, la regla
`allow update: if isMember(clinicId)` la dejaría pasar sin más; conviene que la
forma quede congelada como el resto.

**Dónde**: `firestore.rules`, bloque `match /patients/{docId}`.

---

## 4. PORTAL

### PI-022 / PG-012 — el paciente no puede invalidar su propio enlace

**Qué**: si el paciente reenvía su enlace y se arrepiente, sólo el consultorio
puede invalidarlo. En `/mi` el destino «Perfil» sólo informa.

**Dónde**: `src/app/mi/[token]/page.tsx` (el botón, en Perfil, que es donde
`13-QUITAR-LO-INNECESARIO.md` recomienda fusionar lo que le falta a ese destino),
`src/app/api/portal/route.ts` (una acción `invalidar`).

**Cómo**: la acción sube `portalTokenVersion` con la sesión actual y devuelve 401
al mismo token después; la pantalla explica cómo pedir uno nuevo. Que la
revocación emita su asiento de auditoría, como ya hace la del consultorio.

**Lo que ya está hecho de mi lado**: la invalidación del consultorio pide y
guarda el MOTIVO, que era lo único que faltaba en la bitácora (el asiento ya
existía: el equipo rojo refutó esa mitad del hallazgo).

**Prueba que lo cubre**: `src/__tests__/el-expediente-recuerda-donde-estabas.test.ts`
(bloque «PG-012») cubre el lado del consultorio y declara el resto.

### PG-012 — la vigencia del enlace dice 7 en el código y 30 en dos comentarios

**Qué**: `patient-token.ts:26` `DIAS_DEFECTO = 7`; el comentario de `:88` y
`link/route.ts:52` hablan de 30 días. El código es coherente; los textos no.

**Dónde**: `src/lib/patient-token.ts`, `src/app/api/portal/link/route.ts`.

---

## 5. UI-CONFIG

### D-002 — la otra mitad: la X que cierra la revisión de laboratorios

**Qué**: `src/components/laboratorio/PanelLaboratorios.tsx:298` es el segundo (y
último) botón sólo-icono sin nombre accesible del barrido — lo reprodujo el
equipo rojo con `scripts/design/lib/a11y-jsx.mjs` sobre los 224 `.tsx`.

**Cómo**: `aria-label="Cerrar revisión"` (o `className="btn btn-icon"`, que
además fija 44×44 en táctil). Y, como propuso el auditor, extender la regla
`botonSoloIconoSinNombre` del analizador a `src/app/(dashboard)` como trinquete
con techo 2, que sólo puede bajar — con la mitad de `/pacientes` ya reparada, el
techo nace en 1.

### D-008 — el otro gris literal

**Qué**: `src/app/(dashboard)/configuracion/page.tsx:2551`, `color: '#999'` sobre
`#fafafa` = 2.73:1 (medido por el equipo rojo, no 2.85). Es uno de los tres
grises literales que quedan en `color:` de toda la app; el tercero es
`privacidad:218` (D-007, de otra lista).

**Cómo**: `var(--text3)`.

### D-023 — los otros dos puntos de NAVIGATION_STATE_AUDIT

1. **La pestaña «Agenda» miente**: `BottomNav.tsx:65` se ilumina cuando
   `contextoDeRuta(p) === 'hoy'` —lo que incluye `/citas`— y su `href` es
   `/calendario`. Se ilumina en una pantalla y navega a otra.
2. **La restauración de scroll sólo existe en la consulta**
   (`consulta/[patientId]/page.tsx` y `tareas/PorQueEstaAqui.tsx`).

**Lo que ya está hecho de mi lado**: el filtro y la nota abierta del expediente
viven en la URL.

---

## 6. CONSULTA

### ASN-007 — el IMC se calcula y no se persiste

**Qué**: el copiloto de la consulta SÍ calcula el IMC con motor determinista y lo
ofrece a la nota, pero `signos.imc` no lo escribe nadie (0 escrituras de `imc:` en
`src/`). Por eso el expediente nunca lo pintaba.

**Dónde**: `src/app/(dashboard)/consulta/[patientId]/page.tsx` (donde se arman
los `signosVitales` de la nota).

**Cómo**: persistir el IMC calculado junto a peso y talla. Del lado del
expediente ya está resuelto sin depender de esto: si `signos.imc` existe manda, y
si no se deriva de peso y talla con el mismo motor
(`cardiometabolico/obesidad.imc`).

**Prueba que lo cubre**: `src/__tests__/los-ultimos-signos-dicen-de-donde-salieron.test.ts`
lo declara en «QUÉ NO CUBRE».
