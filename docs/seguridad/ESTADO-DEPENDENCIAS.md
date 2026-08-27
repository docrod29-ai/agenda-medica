# Estado de las dependencias

<!-- CIFRAS-DERIVADAS:INICIO -->

**Medido el 2026-08-27** por `node scripts/seguridad/auditar.mjs`. Estas cifras
NO se escriben a mano: se derivan del comando. Si alguien las edita, la prueba
`la-cifra-de-seguridad-no-se-pudre` falla.

| Alcance | Total | Critical | High | Moderate | Low |
|---|---|---|---|---|---|
| Rama de producción (`--omit=dev`) | 9 | **0** | **0** | 9 | 0 |
| Árbol completo (incluye herramientas) | 15 | 0 | 2 | 13 | 0 |

**Cero `high` y cero `critical` en la rama que se sirve a los pacientes.**

Las `high` del árbol completo viven en herramientas de desarrollo y no se sirven: fast-uri (high), js-yaml (high).

<!-- CIFRAS-DERIVADAS:FIN -->
