# WhatsApp — Backlog priorizado

Prioridad por **riesgo/impacto ÷ esfuerzo**, mapeado a las iteraciones del programa. Cada ítem se implementa en SU iteración (una por ejecución).

## P0 — Riesgo de política confirmado (atender pronto)
| Ítem | Riesgo | Iteración |
|---|---|---|
| **Plantillas HSM aprobadas + lógica de ventana de 24 h** (texto dentro, plantilla fuera) | WA-1, WA-5 | 9 (CONFIRMATIONS) |
| **Opt-out (STOP/BAJA/ALTO) + consentimiento granular** (administrativo/recordatorios/marketing) | WA-2 | 5 (CONSENT_AND_OPT_OUT) |
| **Deduplicación/idempotencia de webhook** (inbox + `wamid` visto) | WA-3 | 3 (WEBHOOK_FOUNDATION) / 14 |

## P1 — Experiencia estructurada (el gran salto de UX)
| Ítem | Riesgo | Iteración |
|---|---|---|
| **Botones** en puntos de decisión + **confirmación con botón** (elimina ambigüedad) | WA-4 | 6 (CONVERSATION_DESIGN) |
| **Listas** para especialidad/médico/sucursal | — | 6 |
| **WhatsApp Flows**: agendar, reprogramar, lista de espera, actualizar datos (validación en servidor) | — | 7 (WHATSAPP_FLOWS) |
| **Handoff a recepción** en un toque (estados BOT_ACTIVE→HANDOFF→AGENT→…) | WA-7 | 12 (HUMAN_HANDOFF) |

## P2 — Seguridad clínica y robustez
| Ítem | Iteración |
|---|---|
| **Seguridad clínica**: detección determinista de urgencias → derivar a emergencias, no diagnosticar | 13 (CLINICAL_SAFETY) |
| **PHI fuera de WhatsApp**: contenido sensible solo por enlace temporal + verificación → portal seguro | (transversal, verificar en 5/13) |
| **Reprogramación** conservando la cita original + lista de espera con holds y expiración | 10 (RESCHEDULING_AND_WAITLIST) |
| **Motor de agenda** con holds temporales (`WhatsAppAppointmentHold`) | 8 (APPOINTMENT_ENGINE) |

## P3 — Plataforma / arquitectura
| Ítem | Iteración |
|---|---|
| **Adaptador de proveedor** formal (`WhatsAppProviderAdapter`) para no depender de 360dialog; ruta a **Meta Embedded Signup** | 2 (META_ONBOARDING) |
| Modelo `WhatsAppTenantConnection` estructurado (WABA, phoneNumberId, calidad, estado) | 2/4 |
| Secreto fuera del path del documento (índice por hash) | 4 (TENANT_CONNECTIONS) |
| IA multi-intención (clasificar, no ejecutar) + fallback seguro | 11 (MULTI_INTENT_AI) |
| Fiabilidad: outbox transaccional, DLQ, circuit breaker, métricas por tenant | 14 (RELIABILITY_AND_ANALYTICS) |
| Piloto progresivo + benchmark | 15 (PILOT_AND_VALIDATION) |

## Nota de secuencia
Seguir el orden del programa (2→15). **Excepción sugerida:** adelantar el **P0 de plantillas/ventana (WA-1)** si los recordatorios están fallando o afectando la calidad del número en producción — es un riesgo de política confirmado y de negocio (recordatorios que no llegan = inasistencias). Decisión del Dr.
