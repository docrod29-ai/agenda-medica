# Simulacro de recuperación — simulacro-recuperacion-2026-01-05-40p

> Veredicto del arnés: **PASS** · 24 escenarios
>
> **Esto NO es el RTO.** Mide nuestra mitad del camino de vuelta.

## Qué corrió

- commit: `7d09ebba2bd2bd71cf6106c24a876f48543ca1c1`
- entorno: local
- formato del respaldo: nexusmed-respaldo-2
- fixture: durabilidad-1 — A: 562 documentos, B: 46
- tamaño del respaldo: 394 KiB

## Escenarios

| escenario | detectado | cómo | ms |
|---|---|---|---|
| `ida-y-vuelta-limpia` | ✅ | veredicto COMPLETA, 562 escritos, reconciliación limpia | 123.77 |
| `respaldo-truncado-sin-pie` | ✅ | veredicto PARCIAL · manifiesto.evaluarCompletitud → sin pie ⇒ incompleto; veredicto.dictaminar ⇒ PARCIAL. | 187.66 |
| `linea-json-corrupta` | ✅ | veredicto REVISION_HUMANA · restaurar.leerLinea ⇒ rechazada; el resto del archivo sigue restaurándose. | 137.58 |
| `documento-ausente` | ✅ | veredicto PARCIAL · reconciliacion.reconciliar ⇒ FALTA. | 130.74 |
| `documento-duplicado` | ✅ | veredicto PARCIAL · reconciliacion.duplicadosPorContenido y ⇒ SOBRA. | 267.84 |
| `version-rancia` | ✅ | veredicto PARCIAL · idempotencia.decidirEscritura ⇒ no-pisar-lo-mas-nuevo; reconciliar ⇒ RANCIO. | 292.77 |
| `ruta-de-otro-consultorio` | ✅ | veredicto REVISION_HUMANA · restaurar.reenraizar la reescribe; integridad-referencial la ve si llega sin re-enraizar. | 255.48 |
| `referencia-interna-forastera` | ✅ | veredicto REVISION_HUMANA · aislamiento.referenciasForasteras ⇒ campo-de-inquilino-forastero. | 336.8 |
| `nota-firmada-alterada` | ✅ | veredicto REVISION_HUMANA · verdad-firmada.compararNotaFirmada ⇒ archivo-alterado (fail closed). | 260.64 |
| `adenda-sin-nota` | ✅ | veredicto REVISION_HUMANA · integridad-referencial ⇒ adenda-sin-nota (P0). | 220.23 |
| `adjunto-sin-metadato` | ✅ | 2 objeto(s) que ningún documento referencia | 1.81 |
| `metadato-sin-adjunto` | ✅ | 1 metadato(s) sin objeto en el bucket destino | 0.64 |
| `huella-corrompida` | ✅ | veredicto PARCIAL · manifiesto.evaluarCompletitud ⇒ huella no coincide. | 232.16 |
| `archivo-con-dos-consultorios` | ✅ | 46 documento(s) del consultorio B detectados, veredicto REVISION_HUMANA | 383.81 |
| `re-enraizado-a-otro-consultorio` | ✅ | 560 documento(s) declaran pertenecer a «clinica-sintetica-a»; veredicto REVISION_HUMANA (correcto: no se escribe) | 99.67 |
| `peticion-repetida` | ✅ | la segunda pasada escribe 0 y reconoce 562 idénticos; el estado final no cambia | 509.73 |
| `timeout-despues-de-escribir` | ✅ | 281 reconocidos como ya escritos, 281 completados; sin duplicados | 216.86 |
| `reinicio-del-proceso` | ✅ | se reanuda tras el lote 1: 282 saltados, 280 rehechos; un archivo distinto NO reanuda encima | 3.33 |
| `restauracion-interrumpida` | ✅ | el lote que murió a mitad no consta; el reintento lo rehace entero | 0.09 |
| `rollback-no-borra-lo-posterior` | ✅ | 3 documento(s) modificados después quedan para revisión; la reversión NO se aplica sola | 0.43 |
| `retencion-no-borra-nada-clinico` | ✅ | expediente de 30 años → ELEGIBLE_PARA_BORRADO, y aun así autorizadoAborrar=false; con retención legal gana la retención y no caduca | 0.29 |
| `punto-seguro-de-la-consulta` | ✅ | al-dia / en-riesgo / conflicto se distinguen; 2 hueco(s) de continuidad declarados para #306 | 0.43 |
| `inventario-sin-huecos` | ✅ | 36 clases de dato clasificadas; ninguna ruta del respaldo sin régimen de restauración | 0.53 |
| `crecimiento-etiquetado` | ✅ | proyección a 60 meses = 0.96 GB, etiquetada ESCENARIO; sin precio citado NO se calcula coste | 0.4 |

## RPO / RTO

`observedRpoMs`: **NOT_MEASURED**

`observedRtoMs`: **NOT_MEASURED** — no se publica mientras queden tramos sin medir: deteccion, restoreDeFirestore, escritura, conmutacion

Suma de los tramos que SÍ se midieron: **217 ms** (parseoYReenraizado, verificacion). Esto no es el RTO.

| tramo | procedencia | ms | alcance |
|---|---|---|---|
| deteccion | `NOT_MEASURED` | — | desde que el consultorio pierde datos hasta que alguien se entera |
| restoreDeFirestore | `NOT_MEASURED` | — | el `gcloud firestore databases restore` a una base nueva |
| parseoYReenraizado | `OBSERVED_LOCAL` | 216 | leer las 562 líneas del NDJSON, re-enraizar cada ruta al destino y decidir documento a documento (aislamiento, verdad firmada, frescura, idempotencia) sobre el fixture durabilidad-1 |
| escritura | `NOT_MEASURED` | — | escribir los documentos de vuelta en Firestore por lotes |
| verificacion | `OBSERVED_LOCAL` | 1 | conciliar 562 documentos contra la línea base: faltantes, sobrantes, distintos, rancios y forasteros |
| conmutacion | `NOT_MEASURED` | — | apuntar la aplicación a la base restaurada |

> Medido: parseoYReenraizado, verificacion. SIN MEDIR: deteccion, restoreDeFirestore, escritura, conmutacion. Esta cifra NO es el RTO: es la suma de los tramos medidos.

## Qué se midió

- generar el fixture sintético
- serializar el respaldo NDJSON v2 con recuentos y huella
- releer el archivo, re-enraizar y decidir documento a documento
- conciliar la fotografía resultante contra la línea base

## Qué NO se midió

- gcloud firestore databases restore — es de Google y se cronometra con consola
- escritura real contra un proyecto de Firestore — este arnés no importa el SDK
- tiempo de detección del incidente — no hay vigilancia que dispare sobre pérdida de datos clínicos
- descarga de objetos de Cloud Storage — se comprueban nombres y tamaños, nunca contenido

## Sin resolver

- El ensayo con consola (`gcloud firestore databases restore`) sigue sin correrse nunca. Ver docs/SIMULACRO_RESTAURACION.md.
- Los objetos de Cloud Storage (fotografía clínica, membrete, firma) NO viajan en el respaldo NDJSON. Restaurar deja el metadato apuntando a un objeto del consultorio de origen.
