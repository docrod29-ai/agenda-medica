# WhatsApp — Inventario de activos Meta / 360dialog

Lo verificable en **código** vs lo que requiere la **consola** (Meta Business Manager / 360dialog). No se accedió a cuentas reales.

## En código (cómo se modela)
| Activo | Dónde | Nota |
|---|---|---|
| Proveedor (BSP) | `whatsapp-send.ts` | 360dialog (principal) · Meta Cloud API · Twilio (adaptadores) |
| Credencial por clínica | Firestore: `clinics/{id}` (secretos) + índice `whatsapp_channels/{apiKey}` | La api_key de 360dialog resuelve el tenant en O(1) |
| Onboarding | `360dialog-callback` (Partner API → api_key permanente), `meta-connect`, `manual-connect` | Enrolamiento tipo embedded del partner |
| Firma de webhook | `WHATSAPP_WEBHOOK_TOKEN` / `META_APP_SECRET` (env) | Verifica X-Hub-Signature-256 |
| Tokens de partner | `DIALOG360_PARTNER_ID`, `DIALOG360_PARTNER_TOKEN` (env) | En variables de entorno de Vercel |

## Modelo objetivo del programa (para comparar)
`WhatsAppTenantConnection { businessPortfolioId, whatsappBusinessAccountId, phoneNumberId, displayPhoneNumber, status, tokenReference, … }`. El modelo actual (índice por api_key de 360dialog) cubre la resolución de tenant pero **no** guarda explícitamente WABA/phoneNumberId/estado de calidad de forma estructurada por conexión — recomendable si se migra a Cloud API / Embedded Signup.

## PENDIENTE (consola — lo consulta el Dr.)
- **WABA(s)** activas y su estado.
- **Números** conectados, `displayPhoneNumber`, y **calidad del número** (verde/amarillo/rojo).
- **Plantillas** aprobadas/rechazadas reales (categoría y estado).
- **Costos** por conversación / categoría.
- **Límite de mensajería** (tier) por número.
- Bloqueos / quejas / opt-outs a nivel Meta.

## Riesgo de secretos
- La api_key de 360dialog es el **ID del documento índice** (`whatsapp_channels/{apiKey}`). Poner el secreto en un **path** es subóptimo (puede aparecer en reglas/consultas/errores). Recomendación: índice por hash de la api_key, y la key en un doc de secretos aparte (o gestor de secretos). El recorte de api_key en logs **ya se corrigió**.
