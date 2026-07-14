# Iteración 3 — PATIENT_MAGIC_LINK · Reporte final

- **ID:** nexusmed-magiclink-003 · **Modo:** PATIENT_MAGIC_LINK · **Entorno:** staging / rama de features · **Producción:** no alterada (main en v372).
- **Estado:** **PARTIAL** (protección técnica implementada y verificada; el token con estado/revocación queda diseñado y scoped como siguiente cambio para no arriesgar el portal).

## Auditoría / línea basal
- Token HMAC-SHA256 **stateless** firmado (`patient-token.ts`); caduca (30 d); verificación en servidor con `timingSafeEqual`. **Sin PHI en la URL** (solo ids opacos). Secreto en env, no en repo.
- Faltaba: `noindex`/`no-referrer` en rutas con token; revocación/usos/bitácora por token; 2ª validación para documentos sensibles.

## Implementación
| Sub-tarea | Resultado |
|---|---|
| 3.4 Protección técnica | ✅ `next.config.ts`: `/mi/*` y `/resena/*` con `X-Robots-Tag: noindex,nofollow,noarchive,nosnippet` + `Referrer-Policy: no-referrer`. Evita indexación y filtración del token por referer. |
| 3.1 Token con estado/revocación | ◑ **diseñado** (`portal_tokens` con hash, usos, estado, bitácora, revocación). NO implementado esta iteración (migración aditiva del portal; se hará como cambio scoped). |
| 3.2 Política por recurso | ✅ documentada (expiración/usos/2ª validación por tipo). |
| 3.3 Segunda validación | ✅ diseñada (OTP; no DOB como único factor). |
| 3.5 Cambio de tel/correo | ✅ diseñado (invalidar enlaces previos). |
| 3.6 Copy público | ✅ redacción precisa definida; **no** se publica hasta que revocación+2ª validación+bitácora existan. |

**Archivos creados:** `docs/security/patient-magic-link.md`, este reporte. **Modificados:** `next.config.ts`. **Migraciones/deps:** 0.

## Pruebas
- tsc exit 0 · build OK (Next validó la config de headers) · 385 tests (sin regresión).

## Resultados (antes/después)
| | Antes | Después |
|---|---|---|
| noindex/no-referrer en rutas con token | ✗ | ✅ |
| Diseño de token revocable | ✗ | ✅ documentado |
| Copy público preciso | pendiente | ✅ definido (no publicado hasta implementar) |
| Producción alterada | — | **No** |

## Riesgos residuales
- El token sigue siendo stateless → **no revocable** hasta implementar `portal_tokens`. Mitigación actual: TTL + firma + no indexación.

## Bloqueos / pendiente
- Implementar el store de tokens (revocación/usos/bitácora) — scoped como siguiente cambio aditivo.
- OTP para documentos sensibles — requiere canal (tel/correo) verificado.

## Quality Gate
```
QUALITY GATE: PARTIAL — sin PHI en URL, sin token en logs (verificado: no se
loguea), no indexación + no-referrer aplicados, sin regresiones. Revocación y 2ª
validación diseñadas pero NO implementadas → el copy público NO se cambia todavía.
```

## Rollback
Un commit en la rama de features (`next.config.ts` + docs); `git revert`. Producción intacta.

## Siguiente iteración recomendada (no implementada)
`ITERACIÓN 4 — PRESCRIPTION_QR` (QR de receta que verifica autenticidad/integridad/estado dentro de NexusMED, sin PHI en el QR, con firma/HMAC y redacción pública precisa sin afirmaciones regulatorias).
