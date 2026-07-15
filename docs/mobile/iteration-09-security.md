# Iteración 9 — MOBILE_SECURITY · Reporte

- **Iteration ID:** nexusmed-mobile-009 · **Modo:** MOBILE_SECURITY · **Entorno:** staging / rama `feat/mobile-excellence` · **Producción:** no alterada · `production_deployment_allowed: false`.
- **Estado:** **PARTIAL — logs endurecidos (§9.5) y controles verificados; app-switcher/sesión-UX difieren a dispositivo.**

## Auditoría (hallazgos, varios positivos)
- **§9.5 Logs sin PHI:** el sanitizador (`src/lib/security/sanitize.ts`: `redactarString`, `safeLog`, `sanitize`) **ya se aplica** en los endpoints de mayor riesgo (`expediente/procesar`, `extraer-entidades`) — donde una respuesta de error de la IA podría reflejar contenido clínico. Existe `sanitize.test.ts` (redacta CURP). El resto de `console.*` loguea **objetos de error con etiqueta**, no valores de paciente. **Positivo.**
- **§9.4 Deep links:** las rutas con token (`/mi/[token]`, `/verificar/[token]`) usan **HMAC-SHA256 + `timingSafeEqual`** (patient-token, receta-token), sin PHI en el token, con caducidad. **Positivo.**
- **§9.1–9.2 Sesión / dispositivo compartido:** `AutoLogout` (inactividad) + MFA (código listo) + **limpieza de borrador al cerrar sesión** (añadida en Iter. 7). **Positivo.**
- **Único punto mejorable:** `whatsapp/360dialog-webhook` registraba `apiKey.slice(0,8)+'...'` → 8 caracteres de una llave de canal en los logs del servidor.

## Cambios
| Cambio | Efecto |
|---|---|
| `360dialog-webhook`: quita el recorte de la api_key del log | §9.5: no queda material de secreto en logs; se conserva el diagnóstico ("api_key desconocida"). |
| **Guard `log-secrets-guard.test.ts`** | Falla si algún `console.*` vuelve a loguear un `.slice` de un secreto (apiKey/token/secret/password/authorization). Red de regresión. |

**Archivos:** `360dialog-webhook/route.ts` (log), `log-secrets-guard.test.ts` (nuevo). Deps/migraciones: 0.

## Pruebas
- `tsc --noEmit` → 0.
- `vitest run` → **387/387** (1 nuevo guard; sin regresión).
- `next build` → OK.

## Diferido (requiere dispositivo)
- **§9.3 Protección de pantalla:** ocultar PHI en el app-switcher (thumbnail al minimizar), bloquear captura en módulos de alto riesgo si la plataforma lo permite. En PWA hay límites reales del navegador → **documentar limitaciones, no afirmar bloqueo de capturas si el navegador no lo permite**. Verificación en iPhone/Android.
- **§9.1–9.2 UX de sesión:** lista de dispositivos, cierre remoto, alerta de nuevo dispositivo, "no mostrar paciente previo tras cerrar sesión" (parcialmente cubierto por la limpieza de Iter. 7; falta verificar en dispositivo el estado tras volver del background).
- **§9.6 Threat model móvil:** documento de amenazas (pérdida/robo, root/jailbreak, shoulder surfing, MITM, push fraudulento). Es documentación; se puede redactar sin dispositivo en una iteración dedicada.

## Quality Gate
```
QUALITY GATE: PARTIAL — logs sin material de secretos (§9.5) con guard de regresión;
sanitizador ya aplicado en endpoints de IA; deep links HMAC verificados; limpieza de
sesión (Iter.7) en su lugar. tsc 0, 387/387, build OK. Protección de pantalla /
UX de sesión / threat model se difieren (dispositivo o iteración de documentación).
production_deployment_allowed:false.
```

## Siguiente iteración recomendada (no implementada)
**Iteración 10 — ACCESSIBILITY** (contraste, texto aumentado sin ruptura, no depender solo del color, errores comprensibles). Parte es verificable por código (etiquetas aria, `prefers-reduced-motion`, no-solo-color); VoiceOver/TalkBack necesita dispositivo. O redactar el **threat model móvil (§9.6)**, que es documentación pura.
