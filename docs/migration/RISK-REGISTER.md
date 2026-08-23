# Registro de riesgos — migración y portabilidad (#311)

Hallazgos **de este repositorio**, con archivo y símbolo. No es una lista
genérica de buenas prácticas: cada renglón se puede abrir y mirar.

Medido el 23-ago-2026 sobre la rama `claude/patient-migration-portability-2st43q`.

`safe_to_fix_here` dice si el arreglo cabía en este carril sin abrir un segundo
escritor sobre archivos que posee otro (#320: **un solo escritor solapado**).

---

## P0-1 · El importador no es idempotente: reintentar duplica el consultorio

| | |
|---|---|
| **file** | `src/app/(dashboard)/migracion/page.tsx` |
| **symbol** | `importar()` — línea 152, `await createPatient(...)` en la 179 |
| **migration_stage** | `CHUNKED_IMPORT` |
| **severity** | **P0** |
| **safe_to_fix_here** | no |
| **owner_slice** | #306 (pantalla) + ruta de servidor nueva |

**current_behavior** — Un bucle `for` en el NAVEGADOR llama `createPatient` una
vez por fila. `createPatient` (`src/lib/firestore.ts:133`) hace `addDoc`, que
genera un id **nuevo en cada llamada**. No hay `importJobId`, ni huella de fila,
ni llave idempotente en ninguna parte del camino.

Consecuencias, las tres reales:

- volver a pulsar «Importar» crea el padrón entero otra vez;
- cerrar la pestaña a mitad deja media importación y **ningún registro de por
  dónde iba**: la única forma de continuar es volver a subir el archivo, y eso
  duplica lo ya escrito;
- un tiempo de espera agotado **después** de que la escritura entró se ve como
  fallo, se reintenta, y quedan dos.

**required_behavior** — Id de documento derivado del contenido
(`llaveIdempotente(importJobId, huellaFila)`), escritura con `set` y no `add`,
y punto de control por lote para poder reanudar.

**proposed_test** — `migracion-idempotencia-y-duplicados.test.ts` ya fija las
llaves y el punto de control. **Falta** la prueba contra el emulador de
Firestore: escribir un lote, matar el proceso, reanudar, y comprobar que el
conteo de documentos no subió. Va en `vitest.emulator.config.ts`.

---

## P0-2 · Las cuentas no cuadran con nada, y una fila se pierde en silencio

| | |
|---|---|
| **file** | `src/lib/csv-pacientes.ts` · `src/app/(dashboard)/migracion/page.tsx` |
| **symbol** | `construirFilas()` línea 119 · `importar()` línea 185 |
| **migration_stage** | `RECONCILIATION` |
| **severity** | **P0** |
| **safe_to_fix_here** | parcial — el motor sí, la pantalla no |
| **owner_slice** | #311 (motor, hecho) + #306 (pantalla) |

**current_behavior** — `construirFilas` termina en
`.filter(f => (f.nombre ?? '').trim() !== '')`: las filas sin nombre se
descartan **antes** de clasificarse. Efectos encadenados:

1. El estado `sin_nombre` de `clasificarFilas` (`csv-pacientes.ts:162`) es
   **código muerto**: nunca puede alcanzarse, porque esas filas ya no llegan.
2. El informe final (`{ creados, duplicados, errores }`) **no se compara con
   cuántas filas traía el archivo**. No existe el dato: `sourceRecords` no se
   guarda en ninguna parte.

Un archivo de 2 000 filas con 300 sin nombre produce «1 700 creados» y ni un
aviso. La suma cuadra consigo misma y se lee como un trabajo bien hecho.

Se suma que `parseCsv` descarta filas vacías sin decir cuántas, y que una coma
sin escapar (`Pérez, Juan`) desplaza las columnas: el apellido acaba en el campo
del teléfono, y ese expediente **parece bueno**.

**required_behavior** — `sourceRecords = accepted + rejected + duplicate +
ambiguous + quarantined`. Si no da, el estado es `PARTIAL`.

**proposed_test** — Hecho: `migracion-cuentas-aislamiento-y-reversion.test.ts`
(«AL REVÉS: si falta una fila por clasificar, NO está completa»).

---

## P0-3 · «Duplicado» significa «no se importa», y nadie lo mira nunca

| | |
|---|---|
| **file** | `src/lib/csv-pacientes.ts` |
| **symbol** | `clasificarFilas()` línea 128 |
| **migration_stage** | `MATCH_DEDUPE` / `QUARANTINE_AMBIGUOUS` |
| **severity** | **P0** |
| **safe_to_fix_here** | parcial |
| **owner_slice** | #311 (motor, hecho) + #306 (pantalla de revisión) |

**current_behavior** — La función baja el listón a propósito («aquí basta
CUALQUIER coincidencia del motor, no sólo una segura») y `importar()` filtra
`c.estado === 'nuevo'`. Una coincidencia **probable** —nombre parecido y nada
más— basta para que la fila **no se escriba**, y no queda en ninguna parte donde
revisarla.

El comentario del propio módulo explica por qué se bajó el listón, y el
razonamiento es correcto para evitar duplicar el padrón entero. Lo que falta es
el otro lado: **no hay cubo de cuarentena**, así que bajar el listón convierte
las dudas en descartes.

**required_behavior** — `EXACT_MATCH` no se reescribe; `LIKELY_MATCH` y
`AMBIGUOUS` van a un cubo revisable, nunca se funden solos y **nunca se
descartan en silencio**.

**proposed_test** — Hecho, salvo la pantalla de revisión.

---

## P1-1 · La pantalla promete Excel y no lee Excel

| | |
|---|---|
| **file** | `src/app/(dashboard)/migracion/page.tsx` |
| **symbol** | copia en la línea 273 · `accept` en la 281 · `readAsText` en la 127 |
| **migration_stage** | `UPLOAD` |
| **severity** | **P1** |
| **safe_to_fix_here** | no — es copia de pantalla (#306) |
| **owner_slice** | #306, o el dueño si se quiere el lector de verdad |

**current_behavior** — El texto dice «Sube un CSV **o Excel** exportado desde tu
sistema actual». El selector acepta `.csv,text/csv` y `cargarArchivo` hace
`readAsText(f, 'utf-8')`.

`src/lib/xlsx.ts` es un **escritor** hecho a mano; no hay lector en el
repositorio, y un `.xlsx` real viene comprimido con DEFLATE, que tampoco está.
Un médico que arrastra su Excel ve «El archivo no tiene filas de datos» con su
archivo bueno delante — y concluye que Ausculta no sirve para migrar.

**required_behavior** — O la copia dice la verdad y ofrece la salida («guárdalo
como CSV en UTF-8»), o se implementa el lector. `ADAPTADOR_XLSX` ya lleva ese
texto en `porQueNo`, listo para pintarlo.

**Decisión del dueño requerida:** el lector exige `inflate`. Añadir una librería
de hoja de cálculo es decisión suya — pesan megas y han tenido CVEs, que es la
razón por la que `xlsx.ts` se escribió a mano para exportar. Ver HANDOFF.

---

## P1-2 · El ensayo de 50 000 filas no cabe en una función sin servidor

| | |
|---|---|
| **file** | `src/lib/migration/ensayo.ts` |
| **symbol** | `ensayar()` — `lectura.filas` y `preparadas` |
| **migration_stage** | `DRY_RUN` |
| **severity** | **P1** |
| **safe_to_fix_here** | no — exige rediseñar a flujo, y no hay ruta todavía |
| **owner_slice** | #311, segunda entrega · roza #342 |

**current_behavior** — Defecto **de lo que acabo de escribir**, medido por el
arnés y no supuesto. El ensayo sostiene el archivo entero y una entrada por fila
en memoria a la vez. Medido en Node 22, `local observado`:

| filas | archivo | Δ montón | tiempo |
|---:|---:|---:|---:|
| 10 000 | 4.1 MB | 162 MB | 1.0 s |
| 50 000 | 20.7 MB | **629 MB** | 5.1 s |

629 MB deja muy poco margen bajo el tope habitual de una función sin servidor.
**10 000 va holgado; 50 000 no puede correr así.**

Ya se bajó de 882 MB acotando el detalle devuelto (`detalleMaximo`, por omisión
1 000 filas). Lo que queda es inherente al ensayo de una sola pasada: para
detectar duplicados dentro del archivo hacen falta todas las huellas a la vez.

**required_behavior** — Dos pasadas sobre el archivo en flujo: la primera saca
sólo huellas (y las suelta), la segunda resuelve fila a fila. El coste es CPU;
la memoria pasa a ser O(huellas) en vez de O(archivo).

**proposed_test** — El arnés ya falla si el coste por fila se dispara. Falta un
tope de montón explícito, que exige correr con `--expose-gc` para medir bien.

---

## P1-3 · La colección del trabajo de importación no está declarada en los tres sitios

| | |
|---|---|
| **file** | `firestore.rules` · `src/lib/authz/matriz-acceso.ts` · `src/lib/clinica/respaldo.ts` |
| **symbol** | `COLECCIONES` (38 rutas declaradas hoy) |
| **migration_stage** | `CHUNKED_IMPORT` / `RECONCILIATION` |
| **severity** | **P1** |
| **safe_to_fix_here** | no — deliberado |
| **owner_slice** | dueño + #306 |

**current_behavior** — Un trabajo de importación necesita persistir: punto de
control, huellas ya importadas, cuarentena e informe. Ninguna colección para eso
existe todavía, y `security-tenant.md` exige declararla en **tres** sitios.

**Por qué no lo hice aquí:** los tres archivos son compartidos entre carriles y
tienen guardián propio. Tocarlos desde este carril abriría el segundo escritor
que #320 prohíbe, y además no hay todavía ruta que escriba esas colecciones —
declararlas ahora sería declarar una forma que la ruta aún puede desmentir.

**required_behavior** — Cuando exista la ruta: declarar
`clinics/{id}/import_jobs` (y su subcolección `batches`) en los tres sitios, con
`hasOnly` congelado. **Una colección que nadie respalda se pierde el día que
hace falta, y el archivo llamado «respaldo» sigue pareciendo completo.**

El riesgo específico de ésta: la cuarentena contiene filas de pacientes que
**todavía no están en el expediente**. Si no entra al respaldo, un desastre
entre la importación y la revisión se lleva justo lo que nadie había mirado aún.

**proposed_test** — Los tres guardianes que ya existen la exigirán solos en
cuanto se declare en uno.

---

## P2-1 · La tabla de sinónimos no cubre los encabezados mexicanos corrientes

| | |
|---|---|
| **file** | `src/lib/csv-pacientes.ts` |
| **symbol** | `SINONIMOS` (línea 97) |
| **migration_stage** | `MAP_FIELDS` |
| **severity** | **P2** |
| **safe_to_fix_here** | no — es de quien posee el módulo |
| **owner_slice** | #306 |

**current_behavior** — `NOMBRE DEL PACIENTE`, `F. NAC.`, `FECHA NAC`, `TEL CEL`
y `No. Expediente` no están. Son encabezados corrientes en exports mexicanos.

**No es pérdida de datos** —la columna queda declarada como desconocida, se
conserva en `noMapeados` y el médico la asigna a mano— pero sí es trabajo manual
en cada importación, y el trabajo manual en una pantalla de migración es
exactamente lo que hace que alguien la abandone a medias.

**required_behavior** — Ampliar `SINONIMOS`. Es aditivo y de bajo riesgo.

**proposed_test** — Hecho: «un encabezado que la tabla de sinónimos NO conoce se
conserva y se puede forzar» fija el comportamiento seguro mientras tanto.

---

## P2-2 · El emparejamiento deja de mirar bloques saturados

| | |
|---|---|
| **file** | `src/lib/migration/emparejamiento.ts` |
| **symbol** | `IndicePacientes.vecinos()` |
| **migration_stage** | `MATCH_DEDUPE` |
| **severity** | **P2** |
| **safe_to_fix_here** | sí — hecho y declarado |
| **owner_slice** | #311 |

**current_behavior** — Sin tope de bloque, el coste por fila subía de 577 µs
(10 000 filas) a 2 510 µs (50 000): la curva cuadrática asomando. Con el tope
—el mismo `MAXIMO_POR_BLOQUE` que ya usa `duplicados.ts`— el coste queda plano
en 103 µs.

El precio es real: **un duplicado que viviera sólo en un bloque saturado no se
detecta.** En el fixture de 50 000, los emparejamientos dudosos detectados
cayeron de 557 a 2 al poner el tope.

Ese número asusta menos de lo que parece: el generador sintético usa 16 nombres
y 16 apellidos, así que los bloques de nombre se saturan de una forma que un
padrón real no reproduce. Pero **no se puede afirmar sin medirlo sobre un padrón
real**, y por eso queda como riesgo abierto y no como detalle resuelto.

**required_behavior** — `senalesSaturadas` sale en el resultado del ensayo y
tiene que llegar al informe que ve el médico: «no busqué en todos los sitios» no
es «no hay duplicados».

**proposed_test** — Hecho, con su prueba al revés.

---

## P3-1 · El respaldo es reimportable; la exportación por dominio no

| | |
|---|---|
| **file** | `src/app/api/clinic/exportar-csv` · `exportar-excel` |
| **symbol** | rutas de exportación por dominio |
| **migration_stage** | `EXPORT` |
| **severity** | **P3** |
| **safe_to_fix_here** | no |
| **owner_slice** | #306 |

**current_behavior** — Las exportaciones por dominio y el libro de Excel son
`legible`: pierden estructura a propósito y **no se pueden reimportar**. Está
bien y es su función. Lo que falta es que la pantalla lo **diga**: un médico
puede llevarse el `.xlsx`, creer que se llevó su expediente, y descubrir tarde
que no se puede meter en ningún sitio.

El respaldo NDJSON (`clinic/exportar`) sí reconstruye, y la pantalla ya lo
distingue en su copia — pero está en Pacientes, no en Migración.

**required_behavior** — `ManifiestoExportacion` distingue `estructurada` de
`legible` y `coherente()` rechaza una `legible` que se declare reimportable.
Falta pintarlo.

---

## Lo que este registro NO cubre

- **La ruta de servidor de importación no existe todavía**, así que no hay
  riesgos medidos de autorización, límite de tamaño de subida ni tiempo máximo
  de ejecución. Aparecerán cuando exista.
- **No se ha probado nada contra Firestore.** Ni idempotencia real, ni ritmo de
  escritura, ni comportamiento del lote de 400 bajo contención.
- **No hay adjuntos reales.** El contrato está escrito y probado con metadatos
  sintéticos; ningún paquete con documentos ha pasado por él.
- **No se ha mirado ningún export real de un sistema de terceros**, porque no
  hay ninguno en la mano. Todo lo que dice este carril sobre formatos de otros
  proveedores es contrato, no observación.
