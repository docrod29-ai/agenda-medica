# Iteración 4 — PRESCRIPTION_QR · Reporte final

- **ID:** nexusmed-prescriptionqr-004 · **Modo:** PRESCRIPTION_QR · **Entorno:** staging / rama de features (`feat/inmunocomprometido-valoracion`) · **Producción:** no alterada (main en v372, sin cherry-pick, sin bump de SW).
- **Estado:** **DONE** (integridad verificable extremo a extremo, sin PHI en el QR, con redacción pública precisa y sin afirmaciones regulatorias).

## Auditoría / línea basal
El QR de la receta (`RecetaDocumento.tsx`, 2 lugares) tenía tres problemas:
1. **Contenido sin valor de verificación:** codificaba texto plano `Folio:<folio>` — no permite comprobar nada.
2. **Dependencia de un tercero:** la imagen del QR se pedía a `api.qrserver.com` → filtra el folio a un servicio externo, falla sin red y compite con la captura de html2pdf (carga de imagen remota).
3. **Sin página de verificación, sin firma, sin estado.** El rótulo "QR de verificación" prometía algo inexistente.

## Implementación
| Sub-tarea | Resultado |
|---|---|
| Token firmado de receta | ✅ `src/lib/receta-token.ts` — HMAC-SHA256, dominio separado (prefijo `receta:`), TTL 730 d, **sin datos del paciente** (solo `clinicId/notaId/folio` + nombre/cédula del prescriptor, que ya van impresos en la receta). |
| Página pública de verificación | ✅ `src/app/verificar/[token]/page.tsx` — verifica la firma; muestra "Generado por NexusMED", folio, médico, cédula (registrada, **no** validada ante autoridad), fecha, estado "Vigente (sin registro de cancelación)" + disclaimer. Caso alterado/expirado → "No verificable". |
| Endpoint que firma la URL | ✅ `src/app/api/receta/verificacion-url/route.ts` — server-only (secreto no accesible en cliente), `verificarMiembro` (auth de clínica), devuelve `{ url }`. |
| QR local (sin tercero) | ✅ Componente `QrLocal` genera el QR como data URI con el paquete `qrcode` (ya instalado, antes sin usar). Elimina `api.qrserver.com`. Codifica la URL de verificación; si no hay, cae al folio. |
| Cableado en la receta | ✅ `receta/[patientId]/[notaId]/page.tsx` pide la URL firmada y la pasa a `RecetaDocumento` vía `data.verificacionUrl`. Fallback al folio si el fetch falla (no rompe la impresión). |
| Protección de la ruta | ✅ `next.config.ts`: `/verificar/*` con `noindex,nofollow,noarchive,nosnippet` + `no-referrer` (el token viaja en la URL). |
| Copy público preciso | ✅ Sin afirmaciones regulatorias. Distingue "integridad verificada" de "validación ante la autoridad" (que NexusMED no hace). |
| Tests | ✅ `src/__tests__/receta-token.test.ts` (8 casos: round-trip, sin-PHI-en-payload, firma alterada, payload alterado, expirado, basura, dominio separado, link). |

**Archivos nuevos:** `src/lib/receta-token.ts`, `src/app/verificar/[token]/page.tsx`, `src/app/api/receta/verificacion-url/route.ts`, `src/__tests__/receta-token.test.ts`, este reporte.
**Modificados:** `next.config.ts`, `src/components/RecetaDocumento.tsx`, `src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx`.
**Migraciones/deps nuevas:** 0 (se usa `qrcode`, ya presente).

## Pruebas
- `tsc --noEmit` → exit 0.
- `vitest run` → **393/393** (385 previos + 8 nuevos de receta-token; sin regresión).
- `next build` → OK; rutas `/verificar/[token]` y `/api/receta/verificacion-url` presentes.
- **Smoke E2E en navegador (localhost:3001):**
  - Token válido → "Integridad verificada" con folio/médico/cédula/fecha/estado (captura tomada).
  - Firma alterada (1 char) → "No verificable".
  - QR renderiza como data URI local (sin llamada a `api.qrserver.com`).

## Resultados (antes/después)
| | Antes | Después |
|---|---|---|
| Contenido del QR | `Folio:<folio>` (texto plano) | URL firmada `/verificar/<token HMAC>` |
| Dependencia de tercero para el QR | `api.qrserver.com` | ninguna (data URI local) |
| Verificación de integridad | ✗ | ✅ (HMAC + `timingSafeEqual`) |
| PHI en el QR/URL | — | **ninguna** (solo ids + info del prescriptor) |
| Página de verificación | ✗ | ✅ pública, `noindex`/`no-referrer` |
| Afirmaciones regulatorias falsas | riesgo ("QR de verificación") | ninguna (disclaimers explícitos) |
| Producción alterada | — | **No** |

## Riesgos residuales / pendiente
- **Estado = "Vigente (sin registro de cancelación)":** aún no hay store de cancelación de recetas. El estado es honesto (no afirma "no cancelada", dice que no hay registro). Un store de cancelación (aditivo) es el siguiente incremento natural.
- **Cédula:** se muestra tal como el médico la registró; NexusMED **no** la valida ante la autoridad (declarado en la propia página).
- El token es stateless → no revocable individualmente; mitigado por TTL + firma + no-indexación (mismo criterio que el magic-link de la iteración 3).

## Quality Gate
```
QUALITY GATE: PASS — integridad verificable extremo a extremo; SIN PHI en el QR ni
en la URL (verificado en el payload por test dedicado); QR generado localmente (sin
tercero); ruta con noindex + no-referrer; copy sin afirmaciones regulatorias
(distingue integridad ≠ validación ante autoridad); tsc 0, 393/393 tests, build OK,
smoke E2E válido+alterado. Producción NO alterada. production_deployment_allowed:false.
```

## Rollback
Commits en la rama de features; `git revert`. Producción intacta. El cambio es aditivo y con fallback (si el endpoint no responde, el QR cae al folio, comportamiento previo).

## Siguiente iteración recomendada (no implementada)
`ITERACIÓN 5 — INTERACTIVE_DEMO` (demo pública navegable del producto con datos sintéticos, sin backend real ni PHI, para convertir la confianza en algo que se toca).
