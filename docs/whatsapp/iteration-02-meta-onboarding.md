# Iteración 2 — META_ONBOARDING · Reporte

- **Iteration ID:** nexusmed-whatsapp-002 · **Modo:** META_ONBOARDING · **Entorno:** staging / rama `feat/whatsapp-excellence` · **Producción:** no alterada · `production_deployment_allowed: false`.
- **Estado:** **PARTIAL — contratos y modelo de conexión (verificables) + auditoría del onboarding/desconexión; Embedded Signup real se difiere (necesita cuentas Meta/app review, prohibido por el propio programa).**

## Hallazgo de la auditoría (positivos)
El onboarding YA existe y es mejor de lo esperado:
- **`meta-connect`** hace el **intercambio OAuth de código → token** y localiza la WABA → es un flujo tipo **Embedded Signup de Meta** (ya presente, no había que inventarlo).
- **`360dialog-callback`** genera la api_key permanente (partner) + índice de tenant.
- **`whatsapp-disconnect`** ya: borra credenciales, elimina **ambos** índices (apiKey y phoneNumberId → el bot deja de responder), **conserva las citas**, requiere auth de miembro.

Huecos: el estado de conexión es pobre (`connected: boolean`, sin calidad/estados), no había **evento de auditoría** al desconectar, y no hay **revocación remota** del token en el proveedor.

## Entregado (verificable, puro/aditivo)
| Pieza | Qué aporta |
|---|---|
| `src/lib/whatsapp/connection.ts` | `WhatsAppTenantConnection` + **estados** (`pending/connected/verification_required/restricted/disconnected`) + `puedeOperar` (solo `connected` opera) + `transicionValida` (sin saltos inválidos) + `conexionSinSecreto` (nunca expone el token). Puro, testeable. |
| `src/lib/whatsapp/adapter.ts` | Contrato **`WhatsAppProviderAdapter`** (sendText/Template/Buttons/List/Flow + verify/normalize webhook) → "la agenda no depende del proveedor". Tipo **`WhatsAppConsent`** granular. |
| `whatsapp-disconnect` | **Evento de auditoría** de la desconexión (`clinics/{id}/whatsapp_events`), aditivo y a prueba de fallos (nunca rompe la desconexión). |
| `whatsapp-connection.test.ts` | 4 tests: solo `connected` opera, transiciones válidas, etiquetas, no fuga de token. |

**Archivos nuevos:** `whatsapp/connection.ts`, `whatsapp/adapter.ts`, `whatsapp-connection.test.ts`. **Modificado:** `whatsapp-disconnect/route.ts`. Deps/migraciones: 0.

## Pruebas
- `tsc --noEmit` → 0. · `vitest run` → **403/403** (4 nuevos). · `next build` → OK.
- **Límite honesto:** el flujo real de conectar/desconectar (OAuth Meta, revocación, pantalla de conexión) **no se puede ejecutar aquí** (necesita sesión + cuentas Meta reales, y el programa prohíbe conectar cuentas reales). La lógica pura (estados, contrato) sí está verificada.

## Diferido (con razón)
- **Embedded Signup completo:** widget de Facebook SDK en el cliente + **Meta App Review** de la app de NexusMED. Requiere activos reales de Meta.
- **Pantalla de conexión** con número/nombre/estado/**calidad**/plantillas/errores/desconectar: diseñada (el modelo `WhatsAppTenantConnection` la soporta); construirla toca el dashboard (verificación en sesión).
- **Revocación remota** del token en Meta/360dialog al desconectar (hoy se borra localmente + se elimina el índice → deja de operar; falta la llamada de revocación al proveedor).
- **Adaptadores concretos** que envuelvan `whatsapp-send.ts` bajo la interfaz — no se refactorizó el envío en producción a ciegas (riesgo de romper el envío real sin poder probarlo).

## Quality Gate
```
QUALITY GATE: PARTIAL — el tenant ya conecta SUS activos (meta-connect OAuth /
360dialog); desconexión funcional + auditoría añadida + citas conservadas + tokens
no expuestos (conexionSinSecreto). Contratos del programa implementados y testeados.
tsc 0, 403/403, build OK. Embedded Signup real / pantalla de conexión / revocación
remota se difieren (cuentas Meta + sesión). production_deployment_allowed:false.
```

## Siguiente iteración recomendada (no implementada)
**Iteración 3 — WEBHOOK_FOUNDATION** (deduplicación/idempotencia por `wamid`, inbox + DLQ, procesamiento asíncrono, sin PHI en logs) — es verificable por código sin cuentas reales, y cierra el riesgo confirmado WA-3. O adelantar el **P0 crítico WA-1** (plantillas + ventana de 24 h).
