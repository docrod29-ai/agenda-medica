# WhatsApp — Auditoría del estado actual (Iteración 1: WHATSAPP_AUDIT)

- **Iteration ID:** nexusmed-whatsapp-001 · **Modo:** WHATSAPP_AUDIT · **Entorno:** staging / rama `feat/whatsapp-excellence` · **Producción:** no alterada · `production_deployment_allowed: false`.
- **Alcance:** auditoría de **código**. No se conectaron cuentas reales, no se migraron números, no se tocó producción. Lo que depende de la consola de Meta/360dialog (WABA, números, calidad, costos, plantillas aprobadas reales) queda marcado **PENDIENTE (consola)** — el Dr. debe consultarlo, no se inventa.

## Arquitectura actual (real, en código)
```
Paciente WhatsApp
   ↓
360dialog (BSP oficial)  ── también hay rutas Meta Cloud API y Twilio en la capa de envío
   ↓
Webhook  (/api/whatsapp/webhook · firma X-Hub-Signature-256 verificada)
   ↓
Máquina de estados (bot)  ── NO controlada por LLM
   ↓
Agenda (transacción atómica), lista de espera
```

**Archivos clave:**
- `src/lib/whatsapp-send.ts` — envío unificado; lee credenciales **por clínica** de Firestore (360dialog), con fallback a env global. Proveedores: 360dialog, Meta, Twilio.
- `src/lib/whatsapp.ts` — constructores de TEXTO (confirmación, recordatorio 24h, cancelación, lista de espera, resumen) + `openWhatsApp` (deep link `wa.me/…`).
- `src/app/api/whatsapp/webhook/route.ts` (752 líneas) — el bot: máquina de estados (`inicio → menu → agendar_nombre → … → cancelar_buscar → esperando_lista`), detección de FAQ, creación de cita **atómica** (re-chequea conflicto en la transacción).
- Onboarding: `360dialog-callback` (genera api_key permanente vía Partner API + índice `whatsapp_channels/{apiKey}`), `meta-connect`, `manual-connect`.
- `/api/cron/reminders` — envía recordatorios usando `sendWhatsApp` (texto).
- `waitlist-notify`, `whatsapp-disconnect`.

## Lo que ya está BIEN (positivos verificados)
- **Canal OFICIAL:** usa 360dialog (BSP oficial) + Cloud API. **No** hay puppeteer / whatsapp-web / baileys / QR no oficial (verificado). Cumple la regla dura del programa.
- **Bot determinista:** máquina de estados, **no** un LLM ejecutando acciones. Alineado con "la IA no ejecuta la acción".
- **Firma verificada:** `X-Hub-Signature-256` sobre el body crudo (`firmaValida`).
- **Multitenant:** credenciales por clínica; el tenant se resuelve del activo (apiKey → `whatsapp_channels/{apiKey}` → clínica), no de parámetros del cliente.
- **Sin doble cita:** la creación es una transacción que re-chequea el conflicto.
- **Log de secreto ya corregido:** el recorte de api_key en logs se quitó (guard `log-secrets-guard`).

## Huecos / riesgos (detalle en `policy-risk-register.md`)
1. **Recordatorios como TEXTO fuera de ventana** — el cron envía `sendWhatsApp(phone, message)` (texto). Los mensajes iniciados por el negocio **fuera de la ventana de 24 h requieren PLANTILLA aprobada**. No se detectó uso de `template`/HSM. **Riesgo de política #1.**
2. **Sin botones / listas / WhatsApp Flows** — el bot es de **texto puro** (el paciente teclea "1", "2"). El programa quiere Botón > Lista > Flow > texto. Hueco de UX grande.
3. **Consentimiento no granular / sin opt-out** — se marca `consentimientoMensajes: true` al agendar, pero no hay opt-in explícito por propósito (administrativo/recordatorios/marketing) ni manejo de **STOP/BAJA/ALTO**.
4. **Sin deduplicación de webhook** — llega `wamid` pero no se detectó dedup/idempotencia; un evento duplicado podría re-procesarse (mitigado en parte por la creación atómica de cita).
5. **Sin handoff a recepción** en el bot (no se encontró estado de transferencia humana).
6. **Sin manejo explícito de la ventana de 24 h** (no hay `MessagingWindow`).
7. **Sin seguridad clínica** (detección de urgencias) en el canal.
8. **Proveedor = 360dialog (BSP), no Embedded Signup de Meta directo** — permitido como "solution partner", pero el programa prefiere Embedded Signup para que el tenant sea dueño de sus activos.

## Conclusión
La base es **oficial y sólida** (BSP, bot determinista, firma, multitenant, booking atómico) — mejor que muchas integraciones caseras. Los focos: **plantillas aprobadas + ventana (Iter. 9)**, **UX estructurada botones/listas/Flows (Iter. 6–7)**, **consentimiento/opt-out (Iter. 5)**, **dedup/idempotencia (Iter. 3/14)** y **handoff + seguridad clínica (Iter. 12–13)**. Ver `implementation-backlog.md`.
