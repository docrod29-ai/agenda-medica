# WhatsApp — Registro de riesgos de política/privacidad/clínicos

Severidad: **Crítico** (bloqueo del número / violación de política / fuga PHI) · **Alto** · **Medio** · **Bajo**. Confianza: **Confirmado** (en código) / **Por verificar** (consola/runtime).

| ID | Riesgo | Tipo | Severidad | Confianza | Evidencia |
|---|---|---|---|---|---|
| WA-1 | Recordatorios/avisos **fuera de ventana** enviados como **texto libre**, sin plantilla HSM aprobada | Política Meta | **Crítico** | Confirmado | `/api/cron/reminders` → `sendWhatsApp(phone, message)` (texto); `whatsapp.ts` no usa `template`. Puede fallar o degradar la calidad del número. |
| WA-2 | Sin **opt-out** (STOP/BAJA/ALTO) ni consentimiento **granular** por propósito | Consentimiento/privacidad | **Alto** | Confirmado | Solo se marca `consentimientoMensajes: true`; no hay revocación ni separación administrativo/marketing. |
| WA-3 | Sin **deduplicación/idempotencia** de webhook | Fiabilidad | **Alto** | Confirmado | Llega `wamid` pero no hay dedup; evento duplicado podría re-procesar (mitigado por booking atómico). |
| WA-4 | **Confirmación ambigua** posible (flujo por texto) | Seguridad de datos | **Alto** | Confirmado | Sin botones; "sí, pero…"/emojis/audio podrían interpretarse como confirmación (prohibido por el programa). |
| WA-5 | Sin **manejo explícito de la ventana de 24 h** (`MessagingWindow`) | Política | **Alto** | Confirmado | No hay lógica que distinga dentro/fuera de ventana al enviar. |
| WA-6 | Sin **seguridad clínica** (detección de urgencias) en el canal | Clínico | **Alto** | Confirmado | El bot no detecta expresiones de urgencia ni deriva a emergencias. |
| WA-7 | Sin **handoff a recepción** estructurado | Operativo | **Medio** | Confirmado | No se encontró estado de transferencia humana. |
| WA-8 | Secreto (api_key 360dialog) usado como **ID de documento** (path) | Secretos | **Medio** | Confirmado | `whatsapp_channels/{apiKey}`. Recorte en logs ya corregido. |
| WA-9 | Envío de **PHI** por WhatsApp (dx/resultados/notas) | Privacidad | **Alto** | **Decidido (D-034, 5-sep-2026)** | Verificado el 5-sep: dos flujos mandan texto del paciente — la pregunta escalada del portal (300 caracteres + nombre, `pregunta-del-paciente.ts`) y el aviso de urgencia (`urgencia.ts`, con teléfono). El dueño decidió que la pregunta viaje completa. Los demás mensajes siguen siendo administrativos. |
| WA-10 | Proveedor = 360dialog (BSP), no Embedded Signup: el tenant no es 100% dueño de sus activos | Arquitectura | **Medio** | Confirmado | Aceptable como "solution partner"; el programa prefiere Embedded Signup + adaptador. |

## Reglas no negociables del programa vs estado
| Regla | Estado |
|---|---|
| Solo canal oficial (no QR/puppeteer) | ✅ Cumple |
| LLM NO ejecuta acciones | ✅ Cumple (máquina de estados) |
| Firma de webhook verificada | ✅ Cumple |
| Consentimiento granular + opt-out | ❌ Falta (WA-2) |
| Plantillas aprobadas fuera de ventana | ❌ Falta (WA-1) |
| Confirmación explícita no ambigua | ⚠️ Riesgo por texto (WA-4) |
| PHI fuera de WhatsApp (portal seguro) | ⚠️ Excepción decidida por el dueño: la pregunta escalada viaja completa (D-034, WA-9) |
| Sin PHI en logs | ✅ (sanitizador + guards) |
