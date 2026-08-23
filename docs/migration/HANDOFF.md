# Traspaso — migración y portabilidad (#311)

Qué queda escrito, qué queda por hacer, y **de quién es cada cosa**.

Este carril entrega **contrato, motor y arnés**. No entrega pantalla ni ruta de
servidor, y no por falta de tiempo: #320 manda **un solo escritor solapado**, y
la pantalla de Migración y la capa de escritura son de #306.

---

## Lo que está hecho y funcionando

`src/lib/migration/**` — 17 módulos puros, 121 pruebas en 4 archivos.

Ninguno importa Firestore, red ni reloj; hay una prueba que lo vigila mirando los
imports. Esa pureza es lo que permite garantizar que **el ensayo no escribe**:
no depende de que nadie se acuerde de no llamar a nada, es que no tiene con qué.

| módulo | qué resuelve |
|---|---|
| `contrato.ts` | etapas, transiciones (lista blanca), 22 códigos de razón, 5 destinos |
| `adaptadores.ts` | CSV disponible; XLSX y export estructurado declarados y no disponibles |
| `mapeo.ts` | columnas → campos, conflictos, columnas desconocidas, huella de mapeo |
| `normalizacion.ts` | fechas ambiguas, sexo, teléfono, correo, CURP, cantidades sin unidad |
| `emparejamiento.ts` | 4 clases + señales legibles por máquina + índice con bloqueo |
| `huella.ts` | las 4 identidades de la idempotencia |
| `procedencia.ts` | origen por fila y por campo; proyección a `ProcedenciaHechoSchema` |
| `ensayo.ts` | el dry-run completo, determinista y sin escrituras |
| `lotes.ts` | troceado, punto de control, arrendamiento, reintentos, progreso |
| `reconciliacion.ts` | las cuentas + informe JSON y Markdown |
| `rollback.ts` | reversión acotada que no borra el trabajo del médico |
| `aislamiento.ts` | un trabajo, un consultorio |
| `auditoria.ts` | asientos sin PHI + guardián de fuga |
| `adjuntos.ts` | contrato de documentos, checksum, huérfanos |
| `exportacion.ts` | manifiesto y supervivencia de la procedencia |
| `sintetico.ts` | fixtures deterministas, cero PHI |

`scripts/migration/arnes.mjs` — arnés de escala. Sale con error si las cuentas no
cuadran o si el coste por fila se duplica.

---

## Primitivas reutilizadas (no se duplicó ninguna)

| primitiva existente | dónde se usa |
|---|---|
| `parseCsv` (`csv-pacientes.ts`) | dentro de `ADAPTADOR_CSV` |
| `mapearEncabezados` + `SINONIMOS` | base de `mapear()` |
| `compararPacientes` (`pacientes/duplicados.ts`) | **el único** juez de «mismo paciente» |
| `normalizarNombre`, `telefonoComparable` | claves de bloqueo |
| `MAXIMO_POR_BLOQUE` | tope del índice — importado, no copiado |
| `sha256Hex` (`expediente/integrity.ts`) | todas las huellas |
| `celdaSegura` (`csv-seguro.ts`) | fixtures y el desescape al reimportar |
| `ProcedenciaHechoSchema` variante `externo` | destino canónico de la procedencia |
| `AuditEvento` `export_datos` | evento de bitácora |

**No se creó** un segundo modelo de paciente, ni una segunda capa de Firestore,
ni una segunda definición de duplicado, ni un segundo modelo de procedencia.

---

## Para #306 — Consultorio (la pantalla)

`src/app/(dashboard)/migracion/page.tsx` sigue usando el camino viejo. Los tres
P0 del registro de riesgos **siguen vivos ahí**: no son teóricos, están en el
código que un médico puede pulsar hoy.

Lo que hay que cablear:

1. **Cambiar `analizar()`** para llamar a `ensayar()` en vez de a
   `clasificarFilas`. Devuelve conteos completos, bloqueos, columnas
   desconocidas y una muestra de filas.
2. **Enseñar el ensayo antes de aprobar.** Conteos por destino, mapeo detectado,
   columnas desconocidas, señales saturadas y lotes estimados. `aprobable()`
   dice si se puede seguir.
3. **Pedir el formato de fecha** cuando haya `AMBIGUOUS_DATE`: es una pregunta
   por archivo, no por fila. Con la respuesta, `formatoFecha` resuelve todas de
   golpe.
4. **Resolver conflictos de mapeo** con `forzado` (por índice de columna).
   `hayConflictos` los señala; hoy la pantalla no los ve y una de las dos
   columnas se perdería.
5. **Pantalla de revisión** para `ambiguous` y `quarantined`. Sin ella, la
   cuarentena es un cajón donde caen filas que nadie abre — que es sólo una
   forma más lenta de perderlas.
6. **Corregir la copia del XLSX** (P1-1): `ADAPTADOR_XLSX.porQueNo` ya trae el
   texto que resuelve el problema del médico en treinta segundos.
7. **Distinguir export legible de estructurado** en la copia (P3-1).

**Lo que NO debe hacer la pantalla:** escribir fila a fila desde el navegador. La
idempotencia y el aislamiento viven en el servidor; una pantalla que escribe
directo se salta los dos.

Cuando esto se cablee, `FUERA_DEL_CAMINO_HOY` en
`el-camino-del-medico-llega-entero.test.ts` **vuelve de 46 a 29** de golpe. Está
escrito allí.

---

## Para la ruta de servidor (no existe todavía)

Lo que tiene que hacer, en orden:

1. `verificarCapacidad(req, clinicId, 'administrar')` — es la operación más
   destructiva después de la supresión ARCO. `clinic/importar` ya lo hace así.
2. `escrituraAutorizada({ clinicIdSesion, clinicIdTrabajo, ruta })` **junto a
   cada escritura**, no una vez al empezar.
3. `puedeEscribirLote(punto, trabajador, ahora)` antes de cada lote.
4. Escribir con `set(llaveIdempotente(...))`, **nunca** `add`.
5. `confirmarLote` sólo cuando la escritura **volvió bien**.
6. `logAudit` con `asientoDeAprobacion` y `asientoDeCierre`.
7. `maxDuration` y reanudación: 106 lotes de 50 000 filas no caben en una
   invocación.

### La colección que hay que declarar (P1-3)

`clinics/{clinicId}/import_jobs` y su subcolección `batches`, en los **tres**
sitios que exige `security-tenant.md`:

1. `firestore.rules`, con `hasOnly` congelado;
2. `src/lib/authz/matriz-acceso.ts` (y regenerar el markdown);
3. `src/lib/clinica/respaldo.ts` — el manifiesto del respaldo.

**El tercero importa más de lo que parece aquí.** La cuarentena contiene filas de
pacientes que **todavía no están en el expediente**. Si no entra al respaldo, un
desastre entre la importación y la revisión se lleva justo lo que nadie había
mirado aún — y el archivo llamado «respaldo» seguiría pareciendo completo.

No lo declaré desde este carril: los tres archivos son compartidos y tienen
guardián propio; tocarlos abriría el segundo escritor que #320 prohíbe. Y sin
ruta que las escriba, declarar la forma ahora es declarar algo que la ruta aún
puede desmentir.

---

## Decisiones que necesitan al dueño

### 1. Lector de XLSX — ¿librería nueva, o no?

`src/lib/xlsx.ts` es un **escritor** hecho a mano, sin dependencias, y su propio
comentario explica por qué: las librerías del ramo pesan megas, arrastran árboles
de dependencias y han tenido su cuota de CVEs.

Leer es **peor** que escribir en superficie de ataque: se procesa un archivo que
llega de fuera. Y hace falta `inflate` (los `.xlsx` reales vienen con DEFLATE),
que no está en el repositorio.

Tres caminos:

| | coste | riesgo |
|---|---|---|
| **A.** Decir la verdad y pedir CSV | ninguno | el médico da un paso más |
| **B.** Librería de lectura | dependencia nueva | superficie de ataque sobre archivo externo |
| **C.** Lector propio con `inflate` | trabajo real | código de descompresión propio sobre entrada hostil |

Mi lectura: **A ahora, y B o C sólo si un médico real se atasca**. «Guárdalo como
CSV» se resuelve en treinta segundos y no compromete nada. El adaptador ya está
declarado, así que pasar a B o C después no toca nada más del carril.

**No añadí ninguna dependencia.** Es decisión suya.

### 2. Formatos de proveedores — hace falta un archivo real

`ADAPTADOR_ESTRUCTURADO` es un hueco declarado a propósito. Para escribir un
adaptador de Doctoralia, Nimbo o cualquier otro hace falta **una especificación
publicada o un export de muestra real**.

No se raspa ningún sitio y no se inventa la API de nadie. Adivinar el formato de
un competidor y estrenarlo con los pacientes de alguien es cómo se pierde un
expediente entero.

**Lo que se necesita de usted:** un archivo de export real (con datos de prueba,
no de pacientes) de cada sistema del que quiera importar.

### 3. ¿Evento propio de bitácora?

Hoy la migración reutiliza `export_datos` con `meta.accion = 'migracion'`, que es
lo que ya hace `clinic/importar`. Un evento propio (`migracion_importada`) sería
más limpio en la bitácora, y cuesta un renglón en tres sitios de un dominio que
no es éste. Diga si lo quiere.

### 4. ¿Se aprueban 50 000 en una sola importación?

Hoy **no cabe** (P1-2: 629 MB). El arreglo son dos pasadas en flujo. La pregunta
de producto es si eso es prioritario ya o si 10 000 por archivo —que va holgado—
cubre a los médicos reales del primer año, partiendo los padrones grandes en
varios archivos.

---

## Lo que este carril NO tocó, a propósito

- Voz (#302), Razonamiento (#303/#347), Consultorio (#306), Evidencia
  (#341/#346), Escala (#342), Enrutador de IA (#345), Autorreparación (#315).
- `firestore.rules`, `matriz-acceso.ts`, `respaldo.ts` — ver P1-3.
- La rebanada de #312: se leyó para conocer las fronteras futuras de durabilidad
  y restauración, no se implementó.
- Hospital y UCI.
- Ninguna dependencia nueva, ningún despliegue, ninguna fusión a `main`, ningún
  dato de paciente real.

---

## Dónde seguir leyendo

- `docs/migration/CONTRATO-DE-MIGRACION.md` — cómo funciona y por qué así
- `docs/migration/RISK-REGISTER.md` — los hallazgos, con archivo y símbolo
- `docs/migration/ESCALA.md` — lo medido y, sobre todo, **lo no probado**
