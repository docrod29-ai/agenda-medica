# Plan de simulacro de recuperación

> Reproducible, sin producción, sin PHI, sin credenciales y sin red. Se puede
> correr en cualquier máquina y en el CI, y no puede tocar datos de nadie porque
> **ninguno de sus módulos importa Firestore** — hay una prueba que lo comprueba.

```bash
npm run simulacro:recuperacion                       # ~1 000 documentos, 24 escenarios
npm run simulacro:recuperacion -- --pacientes=750    # >10 000 documentos
npm run simulacro:recuperacion -- --solo=adenda-sin-nota
npm run simulacro:recuperacion -- --sin-evidencia    # no escribe acta
```

Sale con código distinto de cero si algún escenario **no detecta** su avería,
para que pueda vigilarlo algo automático y no sólo una persona leyendo.

---

## Los ocho pasos

1. **Generar** dos consultorios sintéticos, A y B, con semilla fija. Dos, porque
   la mitad de las averías sólo existen cuando hay más de uno.
2. **Respaldar** A en NDJSON del formato `nexusmed-respaldo-2`, con recuento por
   colección y huella del conjunto en el pie.
3. **Fotografiar** el estado de A: ruta, huella de contenido, colección, fecha y
   si es inmutable. Ésa es la línea base.
4. **Inyectar** una avería sobre una copia del archivo, o provocar un suceso del
   proceso.
5. **Restaurar** en simulación: releer, re-enraizar, y decidir documento a
   documento (procedencia, aislamiento, verdad firmada, frescura, idempotencia).
6. **Conciliar** contra la línea base: qué falta, qué sobra, qué difiere, qué
   volvió rancio, qué quedó forastero.
7. **Comprobar que la avería se detectó.** Si no se detecta, el escenario sale en
   rojo — el arnés no da por bueno un caso que no probó nada.
8. **Dejar acta** en JSON y en Markdown, sin pisar ninguna anterior.

---

## Los datos

Sintéticos, versionados (`durabilidad-1`) y deterministas: la misma semilla
produce el mismo archivo, byte por byte. Hay una prueba que lo fija.

**Sin cifras clínicas.** Los signos vitales van a `null` y los medicamentos no
llevan dosis: sólo nombre de relleno y una intención (`reported`, `continue`,
`start`, `change`, `stop`, `unknown`), que es lo único que el arnés necesita
comprobar. Un fixture con dosis plausibles acaba copiado a un ejemplo, a una
captura de pantalla y a una demostración.

**El sello de las notas firmadas es el de verdad**: `generarHashIntegridad` de
`expediente/integrity.ts`, el mismo que sella las notas en producción. Si el
fixture usara un sello inventado, la prueba de que restaurar no altera una nota
firmada estaría probando un mecanismo que no corre.

Lo que el consultorio sintético incluye: pacientes, antecedentes, citas, notas
—la primera de cada paciente **firmada**, con adenda—, versiones de borrador,
laboratorios, fotografía clínica con su metadato de Storage, cobros y bitácora.

---

## Los escenarios

### Averías del ARCHIVO — se inyectan editando el NDJSON

| escenario | qué se rompe | quién lo detecta |
|---|---|---|
| `respaldo-truncado-sin-pie` | el archivo se corta antes de cerrar | `evaluarCompletitud` → sin pie ⇒ incompleto |
| `linea-json-corrupta` | una línea deja de ser JSON | `leerLinea` → rechazada, y el resto sigue |
| `documento-ausente` | falta un documento que existía | conciliación → `FALTA` |
| `documento-duplicado` | el mismo contenido con otra identidad | conciliación → `SOBRA` |
| `version-rancia` | el archivo trae una versión anterior a la del destino | `decidirEscritura` → `no-pisar-lo-mas-nuevo` |
| `ruta-de-otro-consultorio` | una línea viene de otro `clinicId` | procedencia contra la cabecera |
| `referencia-interna-forastera` | el contenido declara el consultorio de origen | `referenciasForasteras` |
| `nota-firmada-alterada` | se cambia el plan de una nota firmada sin resellar | `compararNotaFirmada` → `archivo-alterado` |
| `adenda-sin-nota` | se quita la nota padre de una adenda | integridad referencial, **P0** |
| `adjunto-sin-metadato` | objeto en el bucket que nadie referencia | `cruzarObjetos` |
| `metadato-sin-adjunto` | ficha de foto cuya imagen no está | `cruzarObjetos` |
| `huella-corrompida` | la huella del pie no corresponde | `evaluarCompletitud` |

### Sucesos del PROCESO — los provoca el arnés, no el archivo

| escenario | qué pasa | qué se comprueba |
|---|---|---|
| `peticion-repetida` | se pide dos veces la misma restauración | la segunda escribe **0** y el estado final no cambia |
| `timeout-despues-de-escribir` | el servidor escribió, la respuesta no llegó | el reintento reconoce lo escrito y completa el resto, sin duplicar |
| `reinicio-del-proceso` | el trabajador muere y vuelve | se reanuda tras el último lote confirmado; un archivo distinto **no** reanuda encima |
| `restauracion-interrumpida` | muere a mitad de un lote | ese lote **no consta**: el reintento lo rehace entero |

`inyectar()` **lanza** si se le pide una avería de proceso, precisamente para que
no se puedan confundir: creer que están cubiertas sin haberlas ejercitado es
peor que no tenerlas.

### Los cinco restantes

| escenario | qué comprueba |
|---|---|
| `ida-y-vuelta-limpia` | el caso feliz: veredicto `COMPLETA` y conciliación limpia. Sin esto, todo lo demás podría pasar por el motivo equivocado. |
| `archivo-con-dos-consultorios` | un archivo con A y B mezclados se detecta y se detiene |
| `re-enraizado-a-otro-consultorio` | restaurar A en otro consultorio **se para**, porque `clinicId` va dentro del sello |
| `rollback-no-borra-lo-posterior` | lo que el médico tocó después de restaurar no se puede revertir automáticamente |
| `retencion-no-borra-nada-clinico` | un expediente de 30 años llega a `ELEGIBLE_PARA_BORRADO` y aun así `autorizadoAborrar` es `false`; con retención legal gana la retención, y no caduca |
| `punto-seguro-de-la-consulta` | `al-dia`, `en-riesgo` y `conflicto` se distinguen, y los huecos de continuidad quedan declarados para #306 |
| `inventario-sin-huecos` | ninguna ruta del respaldo se queda sin régimen de restauración |
| `crecimiento-etiquetado` | lo proyectado sale como `ESCENARIO`, y sin precio citado **no** se calcula coste |

---

## El acta

Cada ejecución deja dos archivos en `docs/recovery/evidencia/`, nombrados por
identificador de simulacro y SHA del commit:

```
simulacro-recuperacion-<fecha>-<N>p-<sha10>.json
simulacro-recuperacion-<fecha>-<N>p-<sha10>.md
```

Llevan: SHA exacto, entorno, versión del formato de respaldo, versión del
fixture, conteos antes y después, corrupciones detectadas, la tabla de tramos de
RPO/RTO con su procedencia, el veredicto, y lo que quedó **sin resolver**.

**No se sobrescriben.** Si ya existe un acta con ese nombre, el arnés lo dice y
no escribe: una evidencia que se pisa deja de ser evidencia y pasa a ser el
último intento, y el histórico —que es donde se ve si algo empeoró— desaparece
sin que nadie lo note.

---

## Lo que este simulacro NO mide

Va en la salida del propio arnés, no sólo aquí:

- el `gcloud firestore databases restore`, que es de Google y se cronometra con
  consola;
- la escritura real contra un proyecto de Firestore;
- el tiempo de **darse cuenta** de que hubo un incidente;
- la conmutación de la aplicación a la base restaurada;
- los bytes de los objetos de Storage.

De los seis tramos de la tabla, hoy sólo dos salen `OBSERVED`. Los otros cuatro
siguen `NOT_MEASURED`, y `rtoPublicable()` devuelve `false` mientras quede uno.

---

## Y el otro simulacro, el que no se puede automatizar

[`docs/SIMULACRO_RESTAURACION.md`](../SIMULACRO_RESTAURACION.md) tiene el
procedimiento con `gcloud`. Su historial sigue diciendo que **nunca se ha
corrido**. Ése es el que cierra el hueco grande, y es D-5 de
[`DECISIONES-DEL-DUENO.md`](DECISIONES-DEL-DUENO.md).
