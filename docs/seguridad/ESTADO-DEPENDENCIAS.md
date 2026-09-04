# Estado de las dependencias

<!-- CIFRAS-DERIVADAS:INICIO -->

**Medido el 2026-09-02** por `node scripts/seguridad/auditar.mjs`. Estas cifras
NO se escriben a mano: se derivan del comando. Si alguien las edita, la prueba
`la-cifra-de-seguridad-no-se-pudre` falla.

| Alcance | Total | Critical | High | Moderate | Low |
|---|---|---|---|---|---|
| Rama de producción (`--omit=dev`) | 11 | **0** | **0** | 11 | 0 |
| Árbol completo (incluye herramientas) | 21 | 0 | 3 | 18 | 0 |

**Cero `high` y cero `critical` en la rama que se sirve a los pacientes.**

Las `high` del árbol completo viven en herramientas de desarrollo y no se sirven: browserslist (high), fast-uri (high), js-yaml (high).

<!-- CIFRAS-DERIVADAS:FIN -->
