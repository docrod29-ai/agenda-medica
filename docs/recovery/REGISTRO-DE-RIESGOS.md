# Registro de riesgos — durabilidad, respaldo y restauración (#312)

> Sólo riesgos encontrados **en archivos y símbolos reales de este repositorio**,
> leídos el 23-ago-2026 sobre el árbol de `main` (`d0ab6a7`). Ninguna entrada es
> una preocupación genérica de la industria: cada una nombra el archivo, el
> símbolo y la línea de razonamiento que la produce.
>
> `safeToFixHere` significa: se puede arreglar dentro de este carril (#312) sin
> pisar a otro escritor ni tocar producción.

---

## R-01 · `merge: true` sobre una nota firmada, con el SDK admin — **P0 · ARREGLADO**

| | |
|---|---|
| **file** | `src/app/api/clinic/importar/route.ts` |
| **symbol** | `lote.set(adminDb.doc(destino), l.datos, { merge: true })` |
| **dataClass** | `encounter-signed-note` |
| **failureMode** | El importador escribe con el SDK admin, que **no evalúa las reglas de Firestore**. La regla `allow update: if … resource.data.estado != 'firmada'` no se aplica ni una vez por este camino. Y `merge: true` es peor que una sobrescritura limpia: deja los campos que el archivo no trae y pisa los que sí, produciendo una MEZCLA de dos versiones que nunca existió, con un `hashIntegridad` que puede no corresponder a ninguna de las dos. |
| **impact** | Alteración silenciosa de un documento medicolegal inmutable por la NOM-024, indistinguible de una restauración legítima en el informe. |
| **existingProtection** | Ninguna. `restaurar.ts` documenta el riesgo en su propia cabecera; la ruta que lo consume no lo comprobaba. |
| **missingProtection** | Comparar la nota del archivo contra la del destino antes de escribir, y detenerse si difieren. |
| **severity** | P0 |
| **safeToFixHere** | sí |
| **ownerSlice** | #312 |
| **proposedTest** | `durabilidad-respaldo-y-restauracion` §7 — «una nota firmada alterada en el archivo NO se escribe», probada **al revés** con la misma nota sin alterar. |
| **estado** | **Arreglado.** `compararNotaFirmada` + `conteos.verdadFirmadaEnConflicto` en la ruta. |

---

## R-02 · El pie certifica «completo» sin poder comprobarlo — **P0 · ARREGLADO**

| | |
|---|---|
| **file** | `src/app/api/clinic/exportar/route.ts` |
| **symbol** | `linea({ _tipo: 'pie', documentos, problemas, completo: problemas.length === 0 })` |
| **dataClass** | todas |
| **failureMode** | `completo` se calculaba de UNA cosa: que ninguna colección lanzara excepción. Una rama del árbol que nadie declaró se exporta de menos, **no lanza nada**, y el archivo se certifica completo. Es literalmente lo que pasó con `patients/{p}/notas/{n}/adendas` — el mecanismo de corrección legal de una nota firmada — mientras el pie decía `completo: true`. |
| **impact** | El médico guarda un archivo que cree completo. El día que hace falta, no está lo que creía, y no hay forma de saber qué falta. |
| **existingProtection** | El guardián `respaldo-consultorio` compara el manifiesto contra `firestore.rules`, así que caza la colección que falta **en el código**. No caza la exportación que sale corta en tiempo de ejecución. |
| **missingProtection** | Recuento por colección y huella del conjunto en el pie, para que quien restaura pueda comparar lo que llegó con lo que debía llegar. |
| **severity** | P0 |
| **safeToFixHere** | sí |
| **ownerSlice** | #312 |
| **proposedTest** | `durabilidad-respaldo-y-restauracion` §2 y §14. |
| **estado** | **Arreglado.** Formato `nexusmed-respaldo-2` con `conteos` y `huella`; v1 se lee pero no alcanza «completo», y se dice. |

---

## R-03 · Re-enraizar la ruta no reescribe el contenido — **P0 · ARREGLADO (con residuo)**

| | |
|---|---|
| **file** | `src/lib/clinica/restaurar.ts` |
| **symbol** | `reenraizar(ruta, clinicIdDestino)` |
| **dataClass** | todas las que llevan `clinicId` por dentro |
| **failureMode** | `reenraizar` reescribe `clinics/A/…` → `clinics/B/…`. No toca el documento, y el documento lleva `clinicId: 'A'` y `metadata.clinicId: 'A'`. El resultado es un documento guardado en B que declara pertenecer a A. No falla nada. |
| **impact** | Contaminación entre consultorios: la siguiente consulta que filtre por ese campo verá lo que no debe, o dejará de ver lo que sí. |
| **existingProtection** | Ninguna: el re-enraizado se declaraba en el informe, pero sólo el de la ruta. |
| **missingProtection** | Recorrer el documento entero buscando referencias al consultorio de origen, y detenerse. |
| **severity** | P0 |
| **safeToFixHere** | sí |
| **ownerSlice** | #312 |
| **proposedTest** | `durabilidad-respaldo-y-restauracion` §6. |
| **estado** | **Arreglado** el detector. **Residuo declarado**: ver R-04. |

---

## R-04 · Restaurar un expediente FIRMADO en otro consultorio no tiene salida limpia — **P1 · DECISIÓN DEL DUEÑO**

| | |
|---|---|
| **file** | `src/lib/expediente/integrity.ts` |
| **symbol** | `CAMPOS_SELLADOS_V3` incluye `clinicId` y `metadata.clinicId` |
| **dataClass** | `encounter-signed-note` |
| **failureMode** | Al restaurar una nota firmada en un consultorio distinto del suyo: si **no** se reescribe `clinicId`, hay contaminación entre consultorios; si **sí** se reescribe, el hash deja de cuadrar y se ha alterado un documento inmutable. No hay tercera opción. |
| **impact** | La restauración de desastre (mismo consultorio a su propio `clinicId`) sale limpia. La migración de titularidad de un expediente entre consultorios **no se puede hacer automáticamente**, y hacerla a medias es peor que no hacerla. |
| **existingProtection** | Ahora: `evaluarAislamiento(hallazgos, esInmutable) → 'revision-humana'`, y el veredicto entero pasa a `REVISION_HUMANA`. |
| **missingProtection** | Una decisión medicolegal escrita: ¿qué significa mover un expediente firmado a otro consultorio? ¿Cesión, migración de titularidad, error? |
| **severity** | P1 |
| **safeToFixHere** | no — es política, no código |
| **ownerSlice** | dueño + asesoría legal |
| **proposedTest** | Ya existe el detector; el test es `re-enraizado-a-otro-consultorio` en el arnés, que comprueba que **se para**, no que se resuelve. |

---

## R-05 · La fotografía clínica vive bajo el prefijo del membrete, enraizada por médico — **P0 · NO ARREGLABLE AQUÍ**

| | |
|---|---|
| **file** | `src/components/FotosClinicas.tsx` → `src/lib/subir-imagen.ts` → `src/app/api/config/imagen/route.ts` |
| **symbol** | `subirImagen(dataUrl, \`fotos/${patientId}/${Date.now()}\`)` y `const path = \`receta-diseno/${acc.uid}/${key}-${Date.now()}.${ext}\`` |
| **dataClass** | `clinical-photo-object` |
| **failureMode** | La clave se sanea con `.replace(/[^a-z0-9_-]/gi, '').slice(0, 40)`, así que `fotos/{pid}/{ts}` pierde las barras y queda aplanada dentro de un nombre de archivo. El objeto acaba en `receta-diseno/{uid-del-médico}/…`: **el mismo prefijo que el resto del código documenta como «la firma y el membrete del médico»**, y cuya raíz de aislamiento es el `uid`, no el `clinicId`. |
| **impact** | Tres cosas: (a) desde el documento de Firestore es imposible comprobar a qué consultorio pertenece el objeto; (b) el cron `limpiar-audio` declara explícitamente que **no toca** `receta-diseno/` porque «no caduca» — así que ahí se acumula PHI que ningún barrido mira; (c) al restaurar en otro consultorio, el metadato vuelve apuntando al objeto del médico de origen. |
| **existingProtection** | Ninguna. Ni el manifiesto del respaldo ni `EXCLUIDAS` mencionaban Storage. |
| **missingProtection** | Enraizar los objetos clínicos por `clinicId`, separarlos del prefijo de papelería, y decidir si el respaldo debe llevárselos. |
| **severity** | P0 |
| **safeToFixHere** | **no** — mover el prefijo huerfanaría todas las fotografías ya subidas, y eso es una migración de datos con su propio plan de reversión (#311/#326). |
| **ownerSlice** | #320 Gate 2 (arquitectura de objetos grandes) + #311 (migración) |
| **proposedTest** | Existe el detector: `adjuntos.cruzarObjetos → 'objeto-de-otro-duenno'` (P0), probado en §12. Falta la migración. |

---

## R-06 · `/api/receta/diseno?path=` sirve objetos sin sesión ni comprobación de consultorio — **P0 · CERRADO (1-sep-2026)**

> **Cerrado por el PR #355**, con autorización explícita del dueño — que era lo
> que faltaba, no el código: el arreglo estaba escrito desde el 23-ago y llevaba
> nueve días parado porque cambiar el proxy toca la papelería en uso.
>
> | | Antes | Ahora |
> |---|---|---|
> | Qué liga la firma | `path\|exp` | `version\|path\|ownerUid\|clinicId\|exp` |
> | Cuánto dura | 24 h | 15 min |
> | Sin secreto en el servidor | devolvía la URL pelada | **503** |
> | URL sin firma | pasaba salvo variable de entorno | se rechaza, y la compatibilidad **no existe en producción** |
>
> El cambio que más pesa no es el de los 15 minutos: es el de la última fila.
> Antes la puerta estaba abierta y se cerraba poniendo una variable; ahora está
> cerrada y sólo se abre poniendo otra, y ni así en producción.
>
> **Y trajo un riesgo propio, cerrado en el mismo cambio**: al fallar cerrado el
> proxy, una imagen de papelería sin capacidad deja de verse, y el documento
> salía incompleto sin decirlo. Ahora avisa antes del diálogo de impresión y
> antes de guardar el PDF (**REG-432**). Avisa y no bloquea: una receta sin
> membrete sigue siendo válida.
>
> **Lo que sigue sin cubrirse:** la capacidad se puede REENVIAR dentro de su
> ventana. Quince minutos y el ligado al dueño acotan el daño de una fuga, no la
> impiden. Cerrarlo del todo exige sesión en el proxy, y el proxy lo consume un
> `<img>` que no manda cabeceras.

### Cómo estaba declarado antes de cerrarse


| | |
|---|---|
| **file** | `src/app/api/receta/diseno/route.ts` |
| **symbol** | la rama `const path = req.nextUrl.searchParams.get('path')` |
| **dataClass** | `clinical-photo-object` |
| **failureMode** | Esa rama **no llama a `verificarUsuario` ni a `verificarCapacidad`**. Lo único que la protege es (a) que la ruta del bucket no sea adivinable y (b) un token HMAC que hoy **no es obligatorio**: `firmaObligatoria()` depende de `RECETA_DISENO_FIRMA=obligatoria`, y el propio comentario del archivo declara el despliegue en dos pasos con el candado todavía abierto. Como la fotografía clínica pasa por aquí (ver R-05), el material que se sirve por este camino ya no es sólo papelería. |
| **impact** | Cualquiera con la ruta —que viaja en la `url` guardada en Firestore y en cualquier respaldo descargado— puede descargar una imagen clínica sin sesión. |
| **existingProtection** | Anti-traversal, `cache-control: private`, rutas con `uid` de 28 caracteres, y el HMAC cuando está presente. |
| **missingProtection** | Sesión y pertenencia al consultorio para los objetos que son PHI; o `RECETA_DISENO_FIRMA=obligatoria` activado, que el propio archivo describe como el paso pendiente. |
| **severity** | P0 |
| **safeToFixHere** | **no** — cerrar esa rama ahora rompe la impresión de recetas de las URLs ya guardadas en la configuración de los médicos, que es exactamente el motivo por el que el despliegue se planteó en dos pasos. |
| **ownerSlice** | seguridad / #320 Gate 1 |
| **proposedTest** | Un caso en `e2e/seguridad.spec.ts` que pida `?path=` sin sesión y espere 403 una vez activado el candado. |

---

## R-07 · Los objetos de Storage no viajan en el respaldo — **P1 · DECLARADO, NO RESUELTO**

| | |
|---|---|
| **file** | `src/lib/clinica/respaldo.ts` |
| **symbol** | `COLECCIONES` / `EXCLUIDAS` |
| **dataClass** | `clinical-photo-object` |
| **failureMode** | El respaldo NDJSON lleva el metadato de la fotografía clínica y **ni un byte del objeto**. Ni `COLECCIONES` ni `EXCLUIDAS` lo mencionaban, así que la ausencia no estaba declarada en ninguna parte: el guardián de las tres declaraciones sólo mira colecciones de Firestore, y esto no es una. |
| **impact** | «Restauramos 10 000 documentos» incluye fotografías que se cuentan como restauradas y cuya imagen no existe en el destino. |
| **existingProtection** | Ahora: `FUERA_DEL_ARCHIVO` en la cabecera del archivo, y `noVuelve` en la respuesta de la restauración. |
| **missingProtection** | Decidir si el respaldo debe llevarse los objetos. Es una decisión del dueño: multiplicaría el tamaño del archivo y el coste. |
| **severity** | P1 |
| **safeToFixHere** | la **declaración** sí (hecha); el respaldo de objetos, no |
| **ownerSlice** | dueño (coste) + #320 Gate 2 |
| **proposedTest** | §12 — «el archivo DECLARA que los objetos no viajan, y la restauración lo repite». |

---

## R-08 · «Consultorio vacío» miraba dos colecciones — **P1 · ARREGLADO**

| | |
|---|---|
| **file** | `src/app/api/clinic/importar/route.ts` |
| **symbol** | `clinicRef.collection('patients').limit(1)` + `appointments` |
| **dataClass** | `arco-requests`, `audit-log`, `payments-and-charges` |
| **failureMode** | Un consultorio con cobros, con bitácora de accesos o con internamientos —pero **sin pacientes, porque una supresión ARCO se los llevó**— pasaba por vacío. Y encima de ese consultorio se restauraba un respaldo anterior a la supresión. |
| **impact** | Un derecho ejercido por un paciente (LFPDPPP Art. 25-26) se deshace sin que nadie lo pida y sin que nadie se entere. |
| **existingProtection** | Ninguna. |
| **missingProtection** | Mirar también `cobros`, `audit_log` e `internamientos`. |
| **severity** | P1 |
| **safeToFixHere** | sí |
| **ownerSlice** | #312 |
| **proposedTest** | `respaldo-ida-y-vuelta` — «sólo a consultorio VACÍO», ahora exigiendo las cinco señales. |
| **residuo** | Con `sobrescribir=1` sigue siendo posible restaurar encima de un consultorio con datos PROPIOS. Lo que ya no puede es deshacer una supresión ARCO: ver R-09, cerrado. |

---

## R-09 · `sobrescribir=1` puede deshacer una supresión ARCO — **P1 · CERRADO (31-ago-2026)**

> **Cerrado, y el rodeo importa más que el cierre.**
>
> Esta ficha daba el riesgo por bloqueado a la espera de #306: decía que hacía
> falta leer `arco_requests` del destino y decidir un criterio de coincidencia de
> identidad de paciente —«¿por `patientId`? ¿por CURP? ¿por nombre?»—, que es una
> decisión de producto que no tocaba a esta rebanada.
>
> **La dependencia no existía.** La supresión ya deja su propio asiento en la
> bitácora del destino (`audit_log`, `evento: 'paciente_borrado'` con
> `meta.accion: 'supresion_arco'`), y ese asiento **nombra al paciente**: es una
> afirmación fechada de que el derecho se ejerció, no una inferencia sobre quién
> es quién. No hay criterio de coincidencia que decidir porque no hay que
> coincidir nada.
>
> Se deja escrito porque es el patrón caro: **un riesgo declarado bloqueado por
> una dependencia que nadie comprobó se queda abierto indefinidamente**, y el
> registro de riesgos deja de ser una lista de trabajo para ser una lista de
> excusas. Éste llevaba ocho días así.
>
> | | |
> |---|---|
> | **Dónde corre** | `src/lib/durability/supresion-arco.ts`, CANDADO 0 de `api/clinic/importar` |
> | **Cuándo** | En la ADMISIÓN de cada línea, antes de comparar nada con el destino |
> | **`sobrescribir=1`** | **No lo salta.** Ese permiso es para pisar datos propios del consultorio, no para deshacer el derecho de un tercero |
> | **En modo ensayo** | También. Un ensayo que no aplique la compuerta prometería que el expediente vuelve, y quien lea esa promesa pulsará el botón |
> | **Prueba** | `src/__tests__/durabilidad-supresion-arco-y-perdida-clinica.test.ts` (37 casos), probada al revés con cinco defectos instalados |
>
> **Lo que sigue sin cubrirse:** la compuerta DETIENE, no reactiva. Reactivar un
> expediente cancelado es una decisión legal con el titular delante, y eso no lo
> modela ningún código de aquí.

### Cómo estaba declarado antes de cerrarse


| | |
|---|---|
| **file** | `src/app/api/clinic/importar/route.ts` |
| **symbol** | el parámetro `sobrescribir` |
| **dataClass** | `arco-requests` |
| **failureMode** | El invariante del inventario para `arco-requests` dice: «si el archivo trae un paciente cuya supresión consta en el destino, es revisión humana». Eso **no está implementado**: haría falta leer `arco_requests` del destino y cruzarlo con los pacientes del archivo. |
| **impact** | Restaurar con `sobrescribir=1` un respaldo anterior a una supresión resucita al paciente suprimido. |
| **existingProtection** | El parámetro exige pedirse a propósito, y la operación va bajo `administrar`. |
| **missingProtection** | El cruce contra `arco_requests` del destino. |
| **severity** | P1 |
| **safeToFixHere** | sí, pero **no se hizo en esta ronda**: exige leer la colección de solicitudes ARCO y decidir el criterio de coincidencia (¿por `patientId`? ¿por CURP? ¿por nombre?), que es una decisión de producto sobre identidad de paciente y toca #306. |
| **ownerSlice** | #312 (implementación) + #306 (criterio de identidad) |
| **proposedTest** | «restaurar un respaldo anterior a una supresión ARCO se detiene en el paciente suprimido», con fixture de dos pacientes y una solicitud resuelta. |

---

## R-10 · La reanudación por punto de control no está cableada — **P2 · PREPARED_ONLY**

| | |
|---|---|
| **file** | `src/app/api/clinic/importar/route.ts` |
| **symbol** | ausencia de persistencia de `TrabajoDeRestauracion` |
| **dataClass** | todas |
| **failureMode** | `maxDuration = 300`. Un archivo grande agota el tiempo y el reintento recorre el archivo **entero** desde el principio. Hoy eso no duplica —porque la identidad del documento va en la ruta y el contenido idéntico no se reescribe— pero es caro, y dejaría de ser cierto en cuanto una colección usara identificadores generados. |
| **impact** | Restauraciones largas que no terminan nunca, y una garantía de no-duplicación que depende de un detalle frágil en vez de un contrato. |
| **existingProtection** | La comparación de contenido: un documento idéntico no se reescribe (implementado y probado). |
| **missingProtection** | Persistir el punto de control. Exige una **colección nueva** bajo `clinics/{id}`, y toda colección nueva se declara en `firestore.rules`, en `matriz-acceso.ts` y en el manifiesto del respaldo — y publicar reglas requiere autorización del dueño. |
| **severity** | P2 |
| **safeToFixHere** | **no** sin autorización para publicar reglas |
| **ownerSlice** | dueño (despliegue de reglas) |
| **proposedTest** | Ya existen los motores probados (`idempotencia` §9-10, y `reinicio-del-proceso` en el arnés). Falta el de la ruta. |

---

## R-11 · `transcripcionMotor` no está sellada, y la restauración podía cambiarla sin romper el sello — **P2 · MITIGADO**

| | |
|---|---|
| **file** | `src/lib/expediente/integrity.ts` |
| **symbol** | `CAMPOS_NO_SELLADOS_V3` → `transcripcionMotor` |
| **dataClass** | `transcription-artifacts` |
| **failureMode** | El propio módulo declara que `transcripcionMotor` **es** material de origen y le corresponde ir sellada, pero que añadirla al canónico marcaría como alteradas todas las notas ya firmadas (REG-060). Consecuencia para la restauración: una nota firmada cuyo único cambio esté ahí **pasa la comprobación de sello**. |
| **impact** | La fuente del expediente —la mitad medicolegal del careo, junto con `transcripcionCruda`— podría cambiar en una restauración sin que el sello lo notara. |
| **existingProtection** | Ahora: la comparación se hace en **dos niveles**. El sello decide si es una alteración del documento firmado; `camposQueDifieren` compara el documento completo y detiene igualmente. |
| **missingProtection** | El sello v4, que es su propia versión con su propia migración. |
| **severity** | P2 |
| **safeToFixHere** | no — subir la versión del sello es una migración de todo el histórico firmado |
| **ownerSlice** | #312 (detección, hecho) + una futura ronda de sello v4 |
| **proposedTest** | §7 — «si el destino ya tiene la nota firmada y difiere, se detiene» usa un campo distinto del sello. |

---

## R-12 · Restaurar puede resucitar una baja de WhatsApp — **P2 · ABIERTO**

| | |
|---|---|
| **file** | `src/lib/clinica/respaldo.ts` |
| **symbol** | la entrada `whatsapp_optout` de `COLECCIONES` |
| **dataClass** | sin clasificar (declarada en `FUERA_DE_LA_RUTA_DE_LANZAMIENTO`) |
| **failureMode** | `whatsapp_optout` guarda quién pidió no recibir mensajes. Es una preferencia con consecuencia legal. Restaurar un respaldo **anterior** a la baja devuelve el estado de antes: el paciente vuelve a estar suscrito. |
| **impact** | Se le escribe a alguien que pidió que no se le escribiera. |
| **existingProtection** | Ninguna específica. |
| **missingProtection** | Que las bajas sean acumulativas al restaurar: una baja que consta en el destino no se revierte por un respaldo viejo. |
| **severity** | P2 |
| **safeToFixHere** | sí, pero pertenece al bloque de mensajería y no a este carril |
| **ownerSlice** | mensajería / WhatsApp |
| **proposedTest** | «una baja que consta en el destino sobrevive a la restauración de un respaldo anterior». |

---

## R-13 · Nadie se entera de que se han perdido datos clínicos — **P1 · ABIERTO**

| | |
|---|---|
| **file** | `src/lib/ops/latido.ts`, `src/app/api/cron/*` |
| **symbol** | `registrarLatido` |
| **dataClass** | todas |
| **failureMode** | Hay latido para los crons (si el barrido de audio deja de correr, se sabe). **No hay nada que vigile la pérdida de datos clínicos**: ni conteos por consultorio, ni alarma por caída brusca, ni comprobación de que el respaldo programado corrió. Por eso el tramo `deteccion` de la tabla de RPO/RTO sale `NOT_MEASURED` y no puede salir de otra forma. |
| **impact** | El RTO empieza a contar cuando el médico llama, y eso puede ser al día siguiente. Es, casi seguro, el tramo más largo del total. |
| **existingProtection** | `scripts/respaldos-verificar.mjs` responde si la recuperación a un punto en el tiempo está encendida y de cuándo es el último respaldo — pero hay que **correrlo a mano**. |
| **missingProtection** | Colgar `respaldos-verificar` de una tarea programada (el propio script sale con código 1 para eso) y una vigilancia de conteos por consultorio. |
| **severity** | P1 |
| **safeToFixHere** | **no** — exige `gcloud` con credenciales del proyecto y una tarea programada, que es infraestructura del dueño |
| **ownerSlice** | dueño / operaciones · #342 |
| **proposedTest** | Ninguno posible desde el repositorio: es una comprobación contra el proyecto vivo. |

---

## R-14 · El ensayo con consola nunca se ha corrido — **P1 · ABIERTO DESDE EL PRINCIPIO**

| | |
|---|---|
| **file** | `docs/SIMULACRO_RESTAURACION.md` |
| **symbol** | la sección «El ensayo con consola» |
| **dataClass** | todas |
| **failureMode** | El documento lo dice con todas las letras: *«Pendiente: necesita `gcloud` y el proyecto de Firebase. Es lo único de esta página que no se puede automatizar desde el repositorio, y es lo que falta para cerrar el P0-6 del todo.»* Sigue siendo cierto. |
| **impact** | El tramo más caro del RTO —`gcloud firestore databases restore`— no tiene ni un número. Cualquier cifra que se publique como «el RTO» sería optimista por un factor desconocido. |
| **existingProtection** | La honestidad del propio producto: `POR_QUE_ESTE_ENSAYO_NO_ES_EL_RTO`, y ahora la tabla de tramos con `NOT_MEASURED`. |
| **missingProtection** | Correrlo. Con consola, contra una base `ensayo-restauracion`, cronometrando. |
| **severity** | P1 |
| **safeToFixHere** | **no** — exige `gcloud`, el proyecto y autorización del dueño |
| **ownerSlice** | dueño |
| **proposedTest** | El acta de `docs/SIMULACRO_RESTAURACION.md`, rellenada. |

---

## Lo que este registro NO cubre

- **Hospital / UCI.** En ALPHA y fuera del alcance de #312. Sus colecciones se
  respaldan y están declaradas en `FUERA_DE_LA_RUTA_DE_LANZAMIENTO` sin régimen
  de restauración fijado.
- **Migración de esquema.** Es #311/#326. Aquí sólo vive la reversión de un
  trabajo de restauración, que es lo único que este carril crea.
- **Capacidad y saturación.** Es #342. El arnés corre 10 000 documentos para
  comprobar que la conciliación no se rompe con el tamaño, no para afirmar
  capacidad.
- **Cualquier cosa medida contra producción.** Nada de este carril ha tocado
  producción, ni datos reales, ni credenciales.
