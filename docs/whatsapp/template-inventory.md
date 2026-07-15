# WhatsApp — Inventario de plantillas/mensajes

## Mensajes que hoy genera el código (TEXTO libre, no HSM)
`src/lib/whatsapp.ts` + `/api/cron/reminders`:
| Mensaje | Función | Cuándo se envía | ¿Dentro de ventana? |
|---|---|---|---|
| Confirmación de cita | `msgConfirmacion` | al agendar | normalmente sí (paciente escribió) |
| Recordatorio 24 h | `msgRecordatorio24h` (cron) | 24 h antes | **NO** (iniciado por negocio) |
| Recordatorio mismo día | `msgRecordatorioDia` (cron) | el día | **NO** |
| Cancelación | `msgCancelacion` | al cancelar | según el caso |
| Aviso lista de espera | `msgListaEsperaAviso` | al liberarse un lugar | **NO** |
| Resumen diario | `msgResumenDiario` | al médico | interno |

## Hallazgo crítico
**Ninguno de estos es una PLANTILLA aprobada (HSM) de Meta.** Son cadenas de texto. Los mensajes marcados "**NO** (fuera de ventana)" son **iniciados por el negocio fuera de la ventana de 24 h** → Meta/360dialog **exige plantilla aprobada** para esos. Enviarlos como texto:
- puede **fallar** silenciosamente (rechazo del proveedor), o
- degradar la **calidad del número** (marcado como spam), o
- violar la política de la plataforma.

## Categorías de plantilla que el programa exige (a crear en Iter. 9)
Confirmación · Recordatorio · Reprogramación · Cancelación · Cambio de médico · Cambio de ubicación · Lista de espera · Pago · Acceso seguro · Seguimiento administrativo · Autenticación. **No** usar plantillas de marketing para lo administrativo/clínico.

## Recomendación
1. Crear plantillas HSM por categoría en la consola (utility/authentication, no marketing) con sus variables.
2. En el envío, decidir **plantilla vs texto** según el estado de la ventana de 24 h (`MessagingWindow`).
3. Registrar en cada envío: plantilla usada + versión + categoría (para auditoría y conciliación de costos).
