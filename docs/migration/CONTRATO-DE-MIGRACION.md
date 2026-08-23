# Contrato de migración y portabilidad (#311)

Cómo llega a Ausculta un médico con veinte años de expediente y 10 000–50 000
pacientes, sin inventar datos, sin perderlos y sin quedarse dentro después.

Todo lo que se describe aquí vive en `src/lib/migration/**` y es **puro**:
ningún módulo importa Firestore, red ni reloj. Hay una prueba que lo vigila
mirando los imports, no la buena fe.

---

## La regla que ordena todo lo demás

Las dos formas de fallar **no son comparables**:

| | se ve | se arregla |
|---|---|---|
| **Rechazar una fila buena** | sí — sale en el informe con su razón | el médico la corrige y la vuelve a subir |
| **Aceptar una fila inventada** | **no** | nunca: entra al expediente con la misma cara que un dato correcto |

Por eso, ante la duda, se **CUARENTENA**. Siempre.

La cuarentena es el producto, no el fallo: convierte «no sé» en una decisión del
médico, en vez de en un dato falso con su firma encima.

---

## El pipeline

```
UPLOAD → DETECT_SCHEMA → MAP_FIELDS → NORMALIZE → VALIDATE → MATCH_DEDUPE
       → QUARANTINE_AMBIGUOUS → DRY_RUN → HUMAN_APPROVAL
       → CHUNKED_IMPORT → RECONCILIATION → COMPLETED | PARTIAL | ROLLED_BACK
```

Las transiciones son **lista blanca** (`TRANSICIONES` en `contrato.ts`). Lo que
no está, no pasa. Una lista blanca y no negra a propósito: un estado nuevo que
alguien añada sin pensar en sus salidas se queda sin salidas —el fallo seguro—
en vez de heredar permiso para saltarse el ensayo.

**La frontera de escritura** es `puedeEscribir(etapa)`, y sólo devuelve `true`
en `CHUNKED_IMPORT` y `ROLLED_BACK`. No se puede ir de `DRY_RUN` a
`CHUNKED_IMPORT`: hay que pasar por `HUMAN_APPROVAL`.

---

## Los cinco destinos de una fila

Mutuamente excluyentes y exhaustivos — de eso depende que las cuentas cuadren.

| destino | qué es | ¿escribe? |
|---|---|---|
| `accepted` | entra al expediente | **sí** |
| `rejected` | el archivo no permite abrir un expediente | no |
| `duplicate` | ya está, o ya se importó | no |
| `ambiguous` | se parece a alguien, y no lo bastante para fundir | no |
| `quarantined` | hay una duda que nadie debe resolver adivinando | no |

`duplicate` va aparte de `rejected` a propósito: un duplicado **no es un error
del archivo**, es el resultado correcto de haber importado dos veces. Juntarlos
hacía que el informe dijera «12 errores» en una importación perfecta, y eso
enseña a ignorar el informe.

Todo destino distinto de `accepted` lleva **al menos un código de razón**.
`rechazada()` revienta si no lo lleva: un descarte sin razón no es revisable.

---

## No inventar

### La fecha `03/04/25`

Puede ser el 3 de abril o el 4 de marzo. **No se elige.** Se devuelve `ambiguo`
con las dos lecturas, y el médico declara el formato del archivo — que es una
propiedad del archivo, no de la celda, así que se resuelve una vez para todas
las filas.

Lo que **sí** se resuelve solo: `25/12/1980` (el día pasa de 12, no hay dos
lecturas posibles) y cualquier fecha ISO. Descartar la ambigüedad cuando no la
hay es lo que evita mandar medio archivo a revisión — y un archivo donde todo va
a revisión se revisa como todo lo que es demasiado: en bloque y sin mirar.

El año de dos dígitos se expande con la regla del pivote (00-30 → 2000s) y eso
**se declara** en `normalizationApplied` como `ano-2-digitos-pivote-30`. Es una
suposición, y una suposición declarada deja de ser un dato inventado.

### El valor que no se reconoce

`sexo` con `M`, `F`, `Male`, `Mujer` se traduce. Con `1` **no**: hay sistemas
donde 1 es hombre y otros donde es mujer, y traducirlo sería jugárselo a cara o
cruz en la mitad de los expedientes.

El vocabulario es **vocabulario, no criterio**: que falte un término significa
que ese valor va a cuarentena, no que se dé por bueno ninguno.

### La cantidad sin unidad

`500` en una columna de dosis no se completa con `mg`. El par mg↔mcg es de los
prohibidos en todo el repositorio: el factor es mil. Sin unidad, el número se
conserva como texto de origen con `MISSING_UNIT`.

### Ausencia de dato no es dato de ausencia

Una columna presente y vacía se marca `columna-presente-vacia`, que es distinto
de que la columna no existiera. Sólo una de las dos cosas se puede preguntar
después.

### Lo que no se entiende, se guarda

Una columna que no mapea a ningún campo conocido **no desaparece**: va a
`camposNoMapeados` tal cual vino. No entra a ningún motor clínico y la
exportación la devuelve. Un dato que no entendemos sigue siendo del médico.

---

## Deduplicación

Quien decide si dos expedientes son la misma persona sigue siendo
`compararPacientes` (`src/lib/pacientes/duplicados.ts`). **No hay una segunda
definición de «el mismo paciente»** — tener una para el alta y otra para la
importación es exactamente cómo se llega a que la pantalla avise de un duplicado
que el importador acaba de crear.

| clase | qué pasa |
|---|---|
| `EXACT_MATCH` | no se vuelve a crear |
| `LIKELY_MATCH` | **a revisión.** No se funde |
| `AMBIGUOUS` | **a revisión.** Más de un candidato, o parecido a medias |
| `NEW_RECORD` | se crea |

**Ni `EXACT_MATCH` funde nada.** Sólo dice «éste ya está». Fundir el contenido de
dos expedientes es otra operación, con su propia aprobación, y no es de este
carril.

Cada veredicto trae `senales` legibles por máquina (`CURP_IGUAL`,
`FECHA_NACIMIENTO_DISTINTA`, `VARIOS_CANDIDATOS`…) derivadas de los datos —**no
del texto en español**, que cambiaría con la redacción y rompería en silencio las
cuentas de todos los informes.

La familia que comparte celular entra entera: el teléfono nunca basta por sí
solo, hace falta parecido de nombre.

---

## Idempotencia

Cuatro identidades, y son cuatro porque contestan cuatro preguntas:

| | qué identifica |
|---|---|
| `importJobId` | este archivo, esta persona, esta vez — **derivado**, no aleatorio |
| `batchId` | un trozo del trabajo — derivado, para poder reanudar |
| `fingerprint` | el **contenido** de una fila |
| `idempotencyKey` | fila + trabajo — **es el id del documento** |

La llave se usa como **id de documento** y la escritura es `set`, no `add`:
repetir es sobrescribir con lo mismo. `add` más una comprobación previa tiene una
carrera en medio, y la carrera importa exactamente en el caso que más duele —
dos reintentos a la vez.

El caso peor no es el reintento evidente, es el **tiempo de espera agotado
después de que la escritura entró**. Ese camino sólo lo cubre una llave que ya
esté ocupada.

La huella se calcula sobre lo **normalizado**: sobre el crudo, `  JUAN  PÉREZ `
y `Juan Pérez` son dos filas distintas y el mismo paciente entra dos veces.

---

## Por lotes y reanudable

400 filas por lote (Firestore admite 500; el margen deja sitio a que una fila
produzca más de un documento). El troceado es **determinista**: mismo archivo y
mismo tamaño de lote dan siempre los mismos lotes, así que «el lote 37» es una
dirección estable — y eso es lo que permite que el punto de control sea **un
número** en vez de una lista de filas pendientes que se desincroniza.

Un lote **enviado y sin respuesta NO se confirma**: si de verdad entró, repetirlo
es inocuo por la llave idempotente. Marcarlo por si acaso sería saltarse un lote
que nunca entró. Se prefiere repetir a saltar, siempre.

Confirmar un lote fuera de orden **revienta** en vez de tolerarse: dejaría el
punto de control apuntando más adelante de lo escrito, y todo lo de en medio no
lo volvería a mirar nadie.

**El trabajador zombi** —vivo pero sin red— se resuelve con un arrendamiento de
5 minutos que caduca. Mientras vive, sólo escribe su dueño; cuando caduca,
escribe cualquiera. La comprobación va junto a la escritura, no al empezar:
entre «puedo» y «escribo» pasan minutos.

**Cancelar es dejar de empezar lotes, no deshacer los hechos.** Deshacer al
cancelar borraría expedientes que ya entraron bien.

---

## Reconciliación

```
sourceRecords = accepted + rejected + duplicate + ambiguous + quarantined
```

`sourceRecords` se pasa **aparte** y no se deduce de los veredictos. Es la clave
de todo: deducido, cuadraría siempre por construcción y no comprobaría nada.

Si no cuadra → `PARTIAL`. No es un aviso, es un estado.

Los **adjuntos se cuentan aparte**, con su propia identidad. Un paciente puede
traer cero documentos o quince; meterlos en la misma cuenta haría que ninguna de
las dos cuadrara nunca.

Lo que **no** impide estar completa: filas rechazadas, duplicadas o en
cuarentena. Una importación con 300 filas en cuarentena está `COMPLETED` — se
procesaron las 2 000 y se sabe dónde está cada una. Lo que rompe la completitud
es que una fila **no esté en ninguna parte**.

Salen dos informes: JSON (sin PHI, para guardar y comparar) y Markdown (para
personas, abriendo por el veredicto y no por la tabla — nadie suma mentalmente
una tabla para saber si algo salió mal).

---

## Reversión

**No hay «deshacer» mágico y no se promete.** Una importación no es una
transacción: son miles de escrituras a lo largo de minutos.

Lo que sí se hace: borrar lo que este trabajo creó, **siempre que se pueda
demostrar que lo creó él y que nadie lo ha tocado desde entonces**.

El caso que manda: el médico importa el lunes, atiende a doce de esos pacientes
el martes, y el miércoles pide deshacer. Un «deshacer» que borre los 2 000 se
lleva doce notas que **no estaban en ningún archivo**. La importación es
recuperable; el trabajo del médico, no.

Un expediente sale de la reversión si: se modificó después de importarlo, tiene
notas o recetas colgando, o no se puede demostrar ninguna de las dos cosas. La
compuerta se vuelve a comprobar con el dato **fresco** en el momento de borrar,
no sólo al planificar: entre las dos cosas el médico pudo abrirlo.

---

## Aislamiento

Un trabajo pertenece a **exactamente un** `clinicId`, y no cambia.

Aquí una fuga no se cuela de uno en uno: se cuela de cincuenta mil en cincuenta
mil, con el aspecto de una importación que funcionó.

`rutaDentroDelConsultorio` compara **con la barra final puesta**. Sin ella,
`clinics/abc` daría por buena `clinics/abcdef/patients/x` — el fallo de prefijo
de toda la vida, que aquí vale un padrón entero.

---

## Bitácora

Todo **números, códigos y huellas**. Ni un nombre, ni un teléfono, ni una celda.

El **nombre del archivo también es PHI** —los médicos los llaman
`expediente_ramirez.csv`— así que se guarda sólo la extensión y el tamaño. La
huella SHA-256 del contenido basta para atar el asiento a un archivo concreto
cuando el médico lo vuelve a tener delante.

Con eso alcanza para contestar quién importó qué, cuándo, con qué reglas y cómo
acabó. Una bitácora que lleva PHI no se puede mandar a soporte ni enseñar en una
auditoría — y una que no lleva nada no acredita nada.

---

## Portabilidad

Dos cosas distintas que la gente llama «exportar», y confundirlas es cómo un
médico cree que se llevó su expediente y se llevó un PDF de 900 páginas:

- **`estructurada`** — para que otro sistema la lea. Completa, con procedencia,
  reimportable.
- **`legible`** — para que una persona la lea. Pierde estructura a propósito y
  **no sirve para migrar de vuelta**.

`coherente()` rechaza una `legible` que se declare reimportable, y una
`estructurada` sin procedencia.

`procedenciaSobrevive()` comprueba la ida y vuelta. Lo que vigila —y ninguna otra
prueba del repositorio mira— es que **las dudas sigan siendo dudas al otro
lado**: una fecha que entró como «puede ser el 3 de abril o el 4 de marzo» y sale
como una fecha a secas ya no se puede volver a discutir. La certeza aparecería de
la nada, sin que nadie haya decidido nada.

---

## Adjuntos

Se guarda la **referencia**, no el binario: un PDF de 8 MB en base64 revienta el
tope de 1 MiB de Firestore y, cuando no lo revienta, hace que cada lectura del
expediente arrastre megas (#320, compuerta 2).

Sin checksum comprobado, un documento se trata como **corrupto**, no como bueno:
«no pude comprobarlo» y «está bien» no son lo mismo. Un archivo truncado por una
subida a medias sigue abriéndose y enseña las tres primeras páginas sin decir
nada de las otras nueve.

Un documento del que no se sabe de quién es queda **huérfano**, nunca colgado del
paciente más probable por el nombre del archivo.

**No hay OCR** y no es un olvido: convertir un escaneo en «datos clínicos» por
lectura automática que nadie revisó sería inventar hechos.

---

## Adaptadores

El resto del carril sólo conoce `FilaOrigen`. Todo lo demás es del adaptador, y
por eso un origen nuevo no obliga a tocar la normalización ni las cuentas.

| adaptador | estado |
|---|---|
| `csv` | **disponible** |
| `xlsx` | declarado, **no** disponible — no hay lector en el repositorio |
| `export-estructurado` | hueco declarado — hace falta una muestra real |

Lo que no se hace, y no es un olvido: **no se raspa ningún sitio**, no se inventa
la API de nadie, y no se supone el formato de ningún proveedor. Un adaptador
concreto se escribe cuando haya especificación publicada o archivo de muestra en
la mano. Adivinar el formato de un competidor y estrenarlo con los pacientes de
alguien es cómo se pierde un expediente entero.

---

## Fixtures

Cero PHI. Listas cerradas de nombres comunes combinadas por índice, teléfonos en
el rango `555…` y correos `@ejemplo.invalid`. Generador **determinista**: misma
semilla, mismo archivo byte por byte — un arnés que genera datos distintos en
cada corrida no mide dos veces la misma cosa.

Los defectos se inyectan a propósito: sin nombre, fecha ambigua, fecha inválida,
sexo desconocido, duplicado exacto, duplicado ambiguo, Unicode, campo larguísimo,
inyección de fórmula, encabezados en inglés, CSV malformado. Un fixture de 50 000
filas perfectas mide velocidad y no mide nada más.
