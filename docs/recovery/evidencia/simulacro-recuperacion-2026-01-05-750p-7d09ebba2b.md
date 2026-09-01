# Simulacro de recuperación — simulacro-recuperacion-2026-01-05-750p

> Veredicto del arnés: **PASS** · 24 escenarios
>
> **Esto NO es el RTO.** Mide nuestra mitad del camino de vuelta.

## Qué corrió

- commit: `7d09ebba2bd2bd71cf6106c24a876f48543ca1c1`
- entorno: local
- formato del respaldo: nexusmed-respaldo-2
- fixture: durabilidad-1 — A: 10502 documentos, B: 827
- tamaño del respaldo: 7275 KiB

## Escenarios

| escenario | detectado | cómo | ms |
|---|---|---|---|
| `ida-y-vuelta-limpia` | ✅ | veredicto COMPLETA, 10502 escritos, reconciliación limpia | 4157.25 |
| `respaldo-truncado-sin-pie` | ✅ | veredicto PARCIAL · manifiesto.evaluarCompletitud → sin pie ⇒ incompleto; veredicto.dictaminar ⇒ PARCIAL. | 4465.99 |
| `linea-json-corrupta` | ✅ | veredicto REVISION_HUMANA · restaurar.leerLinea ⇒ rechazada; el resto del archivo sigue restaurándose. | 3899.68 |
| `documento-ausente` | ✅ | veredicto PARCIAL · reconciliacion.reconciliar ⇒ FALTA. | 4694.48 |
| `documento-duplicado` | ✅ | veredicto PARCIAL · reconciliacion.duplicadosPorContenido y ⇒ SOBRA. | 5956.31 |
| `version-rancia` | ✅ | veredicto PARCIAL · idempotencia.decidirEscritura ⇒ no-pisar-lo-mas-nuevo; reconciliar ⇒ RANCIO. | 6313.31 |
| `ruta-de-otro-consultorio` | ✅ | veredicto REVISION_HUMANA · restaurar.reenraizar la reescribe; integridad-referencial la ve si llega sin re-enraizar. | 6179.86 |
| `referencia-interna-forastera` | ✅ | veredicto REVISION_HUMANA · aislamiento.referenciasForasteras ⇒ campo-de-inquilino-forastero. | 5761.49 |
| `nota-firmada-alterada` | ✅ | veredicto REVISION_HUMANA · verdad-firmada.compararNotaFirmada ⇒ archivo-alterado (fail closed). | 4792.31 |
| `adenda-sin-nota` | ✅ | veredicto REVISION_HUMANA · integridad-referencial ⇒ adenda-sin-nota (P0). | 4259.57 |
| `adjunto-sin-metadato` | ✅ | 2 objeto(s) que ningún documento referencia | 124.02 |
| `metadato-sin-adjunto` | ✅ | 1 metadato(s) sin objeto en el bucket destino | 8.79 |
| `huella-corrompida` | ✅ | veredicto PARCIAL · manifiesto.evaluarCompletitud ⇒ huella no coincide. | 4326.52 |
| `archivo-con-dos-consultorios` | ✅ | 827 documento(s) del consultorio B detectados, veredicto REVISION_HUMANA | 5006.14 |
| `re-enraizado-a-otro-consultorio` | ✅ | 10500 documento(s) declaran pertenecer a «clinica-sintetica-a»; veredicto REVISION_HUMANA (correcto: no se escribe) | 1456.28 |
| `peticion-repetida` | ✅ | la segunda pasada escribe 0 y reconoce 10502 idénticos; el estado final no cambia | 9304.41 |
| `timeout-despues-de-escribir` | ✅ | 5251 reconocidos como ya escritos, 5251 completados; sin duplicados | 4870.48 |
| `reinicio-del-proceso` | ✅ | se reanuda tras el lote 1: 5252 saltados, 5250 rehechos; un archivo distinto NO reanuda encima | 148.23 |
| `restauracion-interrumpida` | ✅ | el lote que murió a mitad no consta; el reintento lo rehace entero | 0.15 |
| `rollback-no-borra-lo-posterior` | ✅ | 3 documento(s) modificados después quedan para revisión; la reversión NO se aplica sola | 0.38 |
| `retencion-no-borra-nada-clinico` | ✅ | expediente de 30 años → ELEGIBLE_PARA_BORRADO, y aun así autorizadoAborrar=false; con retención legal gana la retención y no caduca | 0.28 |
| `punto-seguro-de-la-consulta` | ✅ | al-dia / en-riesgo / conflicto se distinguen; 2 hueco(s) de continuidad declarados para #306 | 0.32 |
| `inventario-sin-huecos` | ✅ | 36 clases de dato clasificadas; ninguna ruta del respaldo sin régimen de restauración | 0.48 |
| `crecimiento-etiquetado` | ✅ | proyección a 60 meses = 0.96 GB, etiquetada ESCENARIO; sin precio citado NO se calcula coste | 0.41 |

## RPO / RTO

`observedRpoMs`: **NOT_MEASURED**

`observedRtoMs`: **NOT_MEASURED** — no se publica mientras queden tramos sin medir: deteccion, restoreDeFirestore, escritura, conmutacion

Suma de los tramos que SÍ se midieron: **3856 ms** (parseoYReenraizado, verificacion). Esto no es el RTO.

| tramo | procedencia | ms | alcance |
|---|---|---|---|
| deteccion | `NOT_MEASURED` | — | desde que el consultorio pierde datos hasta que alguien se entera |
| restoreDeFirestore | `NOT_MEASURED` | — | el `gcloud firestore databases restore` a una base nueva |
| parseoYReenraizado | `OBSERVED_LOCAL` | 3835 | leer las 10502 líneas del NDJSON, re-enraizar cada ruta al destino y decidir documento a documento (aislamiento, verdad firmada, frescura, idempotencia) sobre el fixture durabilidad-1 |
| escritura | `NOT_MEASURED` | — | escribir los documentos de vuelta en Firestore por lotes |
| verificacion | `OBSERVED_LOCAL` | 21 | conciliar 10502 documentos contra la línea base: faltantes, sobrantes, distintos, rancios y forasteros |
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
