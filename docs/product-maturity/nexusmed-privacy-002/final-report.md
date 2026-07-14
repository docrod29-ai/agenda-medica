# Iteración 2 — PRIVACY_AND_LEGAL · Reporte final

- **ID:** nexusmed-privacy-002 · **Modo:** PRIVACY_AND_LEGAL · **Entorno:** staging / rama de features · **Producción:** no alterada (main en v372).
- **Estado:** **PARTIAL / BLOCKED** (inventario y arquitectura documentados; 2 de 3 documentos y ARCO ya existían en código; 1 bloqueo de dato y varios marcadores de revisión jurídica).

## Línea basal
- Ya existían en código: aviso por consultorio (`aviso-privacidad.ts`), DPA (`contrato-encargo.ts`), flujo ARCO (`arco.ts` + `/cumplimiento`), aviso de plataforma (`/privacidad`), subencargados en `/seguridad`, protección de RFC/domicilio fiscal.

## Implementación
| Sub-tarea | Resultado |
|---|---|
| 2.1 Inventario de datos | ✅ `docs/privacy/data-inventory.md` (14 categorías: responsable/encargado/subencargado, sistema, región, retención, acceso, sensibilidad, riesgos). |
| 2.2 Doc 1 (médicos/usuarios) | ◑ existe `/privacidad`; documentado con variables; **BLOCKED** el domicilio publicable (el fiscal es particular, no se publica). |
| 2.3 Doc 2 (aviso consultorio) | ✅ ya implementado (`aviso-privacidad.ts` + `/legal`), con disclaimer. |
| 2.4 Doc 3 (DPA) | ✅ ya implementado (`contrato-encargo.ts` + `/legal`), marcado a revisar por abogado. |
| 2.5 Flujo ARCO | ✅ ya implementado (`arco.ts` + `/cumplimiento`), append-only. |

**Archivos creados:** `docs/privacy/data-inventory.md`, `docs/privacy/document-architecture.md`, este reporte. **Modificados:** 0 código. **Migraciones/deps:** 0.

## Sin datos jurídicos inventados
- Identidad usada = la que el titular proporcionó (David Alonso Rodríguez Luna, RESICO). **No** se inventó razón social/domicilio/RFC/responsable.
- RFC y domicilio fiscal se mantienen **fuera de lo público** (solo DPA/privado).

## Resultados (antes/después)
| | Antes | Después |
|---|---|---|
| Inventario de datos | ✗ | ✅ 14 categorías |
| Arquitectura documental mapeada | dispersa | ✅ documentada (3 docs + ARCO) |
| Producción alterada | — | **No** |

## Riesgos residuales
- **Jurídico:** todo el paquete requiere abogado (bases de licitud, transferencias, retención, brechas).
- **Operativo:** falta un domicilio publicable de la plataforma (Doc 1 incompleto en esa variable).

## Bloqueos
- **Domicilio publicable** de la plataforma (el fiscal es particular).
- **Revisión por abogado** mexicano de protección de datos/salud (marcado en ambos docs).

## Quality Gate
```
QUALITY GATE: PARTIAL/BLOCKED — inventario completo, 3 documentos identificados/
existentes, subencargados y retención documentados, flujo ARCO definido, sin datos
jurídicos inventados, variables faltantes bloqueadas, revisión jurídica marcada.
Ningún borrador incompleto se publicó.
```

## Rollback
Solo documentación nueva en la rama de features; `git revert` o descartar. Producción intacta.

## Siguiente iteración recomendada (no implementada)
`ITERACIÓN 3 — PATIENT_MAGIC_LINK` (endurecer el acceso por token del portal del paciente: hash de token, expiración por tipo de recurso, segunda validación para documentos sensibles, no-index, no-token-en-logs).
