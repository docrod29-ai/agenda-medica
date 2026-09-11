# Estado de las dependencias

<!-- CIFRAS-DERIVADAS:INICIO -->

**Medido el 2026-09-11** por `node scripts/seguridad/auditar.mjs`. Estas cifras
NO se escriben a mano: se derivan del comando. Si alguien las edita, la prueba
`la-cifra-de-seguridad-no-se-pudre` falla.

| Alcance | Total | Critical | High | Moderate | Low |
|---|---|---|---|---|---|
| Rama de producción (`--omit=dev`) | 0 | **0** | **0** | 0 | 0 |
| Árbol completo (incluye herramientas) | 5 | 0 | 0 | 5 | 0 |

**Cero `high` y cero `critical` en la rama que se sirve a los pacientes.**



<!-- CIFRAS-DERIVADAS:FIN -->

## Alcance de la corrección del 11-sep-2026

El lock publicado conserva Firebase Admin 13 y actualiza DOMPurify, qs, baseline-browser-mapping y las dependencias compatibles de sus herramientas. UUID 11.1.1 se limita a google-gax, teeny-request y gaxios: sus consumidores de v4, la carga CommonJS y las peticiones multipart se comprobaron contra localhost en [CI](https://github.com/docrod29-ai/agenda-medica/actions/runs/34546034255). Vitest y coverage-v8 quedan alineados en 4.1.11.

Los cinco avisos moderados restantes pertenecen al árbol de Firebase CLI: @opentelemetry/core, @google-cloud/pubsub, firebase-tools, csv-parse y stream-json. No se sirven en la aplicación. Permanecen declarados; el audit completo devuelve error por ellos. La propuesta automática de volver a firebase-tools 10.1.1 y los saltos mayores de sus parsers requieren una migración separada y no se aplicaron a ciegas. No procesar importaciones ajenas con esas herramientas hasta corregir esa cadena.

Las cifras de arriba proceden del script canónico sobre el lock publicado, no de una edición manual de la tabla.
