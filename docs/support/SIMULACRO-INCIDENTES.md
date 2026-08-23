# Simulacro de incidentes — informe

**Generado con:** reloj inyectado, sin red, sin proveedores, sin producción.
**Reloj:** `2026-08-23T09:00:00.000Z` (constante). **Versión:** `simulacro`.
**Conformes:** 13/13.

> Este informe mide el MOTOR de incidentes. No mide la red, ni el proveedor,
> ni la base de datos. Ver «Lo que este informe NO demuestra» al final.

## Escenarios

| # | Escenario | Eventos | Grupos | ¿Incidente? | ¿Repara solo? | Intentos | Desenlace | ¿Avisa? | Runbook | MTTD | MTTR |
|---|---|--:|--:|---|---|--:|---|---|---|--:|--:|
| IA-SALDO | La cuenta del proveedor de IA se quedó sin saldo | 60 | 1 | sí | no | 0 | requiere_humano | sí | RB-IA-SALDO | 12.2 s | — |
| IA-SOBRECARGA | El proveedor de IA está saturado | 40 | 1 | sí | sí | 2 | recuperado | no | RB-IA-SOBRECARGA | 12.3 s | 4.6 s |
| IA-TIMEOUT | El proveedor de IA deja de responder a tiempo | 30 | 1 | sí | sí | 1 | recuperado | no | RB-IA-SOBRECARGA | 20.7 s | 2.5 s |
| PERSISTENCIA-TRANSITORIA | Escritura a la base que falla de forma transitoria, CON clave de idempotencia | 25 | 1 | sí | sí | 1 | recuperado | no | RB-PERSISTENCIA | 20.0 s | 1.4 s |
| PERSISTENCIA-SIN-CLAVE | La MISMA escritura, SIN clave de idempotencia | 25 | 1 | sí | no | 0 | requiere_humano | sí | RB-PERSISTENCIA | 20.0 s | — |
| AUTOGUARDADO | El autoguardado de la consulta deja de guardar | 22 | 1 | sí | sí | 1 | recuperado | no | RB-AUTOSAVE | 45.7 s | 1.5 s |
| ENTREGA-DUPLICADA | Un trabajo asíncrono se entrega dos veces | 30 | 1 | sí | no | 0 | requiere_humano | sí | RB-NOTIF-WHATSAPP | 27.6 s | — |
| RESPUESTA-CADUCA | El paciente reserva sobre un hueco que ya no existe | 26 | 1 | sí | sí | 1 | recuperado | no | RB-AGENDA | 28.8 s | 1.2 s |
| UI-COMPONENTE | Un componente secundario de la pantalla lanza | 24 | 1 | sí | sí | 1 | recuperado | no | RB-UI | 41.7 s | 1.1 s |
| WHATSAPP-TRAS-RESERVA | La cita se guardó y el mensaje al paciente no salió | 21 | 1 | sí | sí | 1 | recuperado | no | RB-NOTIF-WHATSAPP | 48.0 s | 1.9 s |
| AISLAMIENTO | Una lectura intentó cruzar de un consultorio a otro | 1 | 1 | sí | no | 0 | requiere_humano | sí | RB-AISLAMIENTO | 0.0 s | — |
| API-500-REPETIDO | Un 500 que se repite y que nadie ha clasificado todavía | 40 | 1 | sí | no | 0 | requiere_humano | sí | RB-DESCONOCIDO | 24.6 s | — |
| RED-PUNTUAL | Un fallo de red suelto e inofensivo | 1 | 1 | no | sí | 0 | sin_incidente | no | RB-RED | — | — |

## Tiempos agregados

- **MTTD:** 22.7 s (MEDIDO EN SIMULACRO — mide el motor, no el mundo real, n=12) · peor caso 48.0 s
- **MTTR:** 1.5 s (MEDIDO EN SIMULACRO — mide el motor, no el mundo real, n=7) · peor caso 4.6 s

## Por qué cada uno decidió lo que decidió

### IA-SALDO — La cuenta del proveedor de IA se quedó sin saldo

- **Firma:** `ai_provider|sin_saldo|nota|/consulta/[id]|anthropic|http_400|simulacro`
- **Raya:** 5 evento(s) en 0.2 min sobre 5 operación(es); cruzó: operaciones_afectadas
- **Política de reparación:** «reintento_idempotente» no puede ejecutarse sola: no_se_arregla_reintentando.
- **Lo que ve el médico:** «El servicio de IA no está disponible.» · seguridad del dato: «Tu dictado está guardado.» · reintentar: no · visibilidad: discreto
- **No evaluado:** tasa de error: el umbral es un SLO y lo fija el dueño (PREPARED_ONLY); latencia: el umbral es un SLO y lo fija el dueño (PREPARED_ONLY); pico: no hay línea base de esta firma

### IA-SOBRECARGA — El proveedor de IA está saturado

- **Firma:** `ai_provider|sobrecarga|nota|/consulta/[id]|anthropic|http_529|simulacro`
- **Raya:** 5 evento(s) en 0.2 min sobre 5 operación(es); cruzó: operaciones_afectadas
- **Política de reparación:** «reintento_idempotente» es reversible e idempotente, no toca verdad clínica ni permisos ni dinero, y el incidente admite reintento.
- **Lo que ve el médico:** «El servicio de IA no está disponible.» · seguridad del dato: «Tu dictado está guardado.» · reintentar: sí · visibilidad: discreto
- **No evaluado:** tasa de error: el umbral es un SLO y lo fija el dueño (PREPARED_ONLY); latencia: el umbral es un SLO y lo fija el dueño (PREPARED_ONLY); pico: no hay línea base de esta firma

### IA-TIMEOUT — El proveedor de IA deja de responder a tiempo

- **Firma:** `ai_provider|timeout|transcribir|/consulta/[id]|assemblyai|http_504|simulacro`
- **Raya:** 5 evento(s) en 0.3 min sobre 5 operación(es); cruzó: operaciones_afectadas
- **Política de reparación:** «respaldo_de_proveedor_autorizado» es reversible e idempotente, no toca verdad clínica ni permisos ni dinero, y el incidente admite reintento.
- **Lo que ve el médico:** «El servicio de IA no está disponible.» · seguridad del dato: «Tu dictado está guardado.» · reintentar: sí · visibilidad: discreto
- **No evaluado:** tasa de error: el umbral es un SLO y lo fija el dueño (PREPARED_ONLY); latencia: el umbral es un SLO y lo fija el dueño (PREPARED_ONLY); pico: no hay línea base de esta firma

### PERSISTENCIA-TRANSITORIA — Escritura a la base que falla de forma transitoria, CON clave de idempotencia

- **Firma:** `persistence|escritura_rechazada|nota|/consulta/[id]|-|unavailable|simulacro`
- **Raya:** 5 evento(s) en 0.3 min sobre 5 operación(es); cruzó: operaciones_afectadas
- **Política de reparación:** «reintento_idempotente» es reversible e idempotente, no toca verdad clínica ni permisos ni dinero, y el incidente admite reintento.
- **Lo que ve el médico:** «No pude confirmar el guardado en el servidor.» · seguridad del dato: «ATENCIÓN: no se pudo confirmar el guardado. Tu texto sigue en pantalla — no cierres sin comprobar que aparece guardado.» · reintentar: sí · visibilidad: franja
- **No evaluado:** tasa de error: el umbral es un SLO y lo fija el dueño (PREPARED_ONLY); latencia: el umbral es un SLO y lo fija el dueño (PREPARED_ONLY); pico: no hay línea base de esta firma

### PERSISTENCIA-SIN-CLAVE — La MISMA escritura, SIN clave de idempotencia

- **Firma:** `persistence|escritura_rechazada|cobro|/api/[id]|-|unavailable|simulacro`
- **Raya:** 5 evento(s) en 0.3 min sobre 5 operación(es); cruzó: operaciones_afectadas
- **Política de reparación:** «reintento_idempotente» no puede ejecutarse sola: incidente_irreversible, sin_garantia_de_idempotencia.
- **Lo que ve el médico:** «No pude confirmar el guardado en el servidor.» · seguridad del dato: «ATENCIÓN: no se pudo confirmar el guardado. Tu texto sigue en pantalla — no cierres sin comprobar que aparece guardado.» · reintentar: sí · visibilidad: franja
- **No evaluado:** tasa de error: el umbral es un SLO y lo fija el dueño (PREPARED_ONLY); latencia: el umbral es un SLO y lo fija el dueño (PREPARED_ONLY); pico: no hay línea base de esta firma

### AUTOGUARDADO — El autoguardado de la consulta deja de guardar

- **Firma:** `autosave|guardado_fallido|nota|/consulta/[id]|-|unavailable|simulacro`
- **Raya:** 5 evento(s) en 0.8 min sobre 5 operación(es); cruzó: operaciones_afectadas
- **Política de reparación:** «reintento_idempotente» es reversible e idempotente, no toca verdad clínica ni permisos ni dinero, y el incidente admite reintento.
- **Lo que ve el médico:** «El guardado automático no está funcionando.» · seguridad del dato: «ATENCIÓN: el guardado automático dejó de funcionar. Tu texto sigue en pantalla y en este dispositivo, pero NO está en el servidor.» · reintentar: sí · visibilidad: bloqueante
- **No evaluado:** tasa de error: el umbral es un SLO y lo fija el dueño (PREPARED_ONLY); latencia: el umbral es un SLO y lo fija el dueño (PREPARED_ONLY); pico: no hay línea base de esta firma

### ENTREGA-DUPLICADA — Un trabajo asíncrono se entrega dos veces

- **Firma:** `notification|entrega_duplicada|recordatorio|-|-|duplicado|simulacro`
- **Raya:** 5 evento(s) en 0.5 min sobre 5 operación(es); cruzó: operaciones_afectadas
- **Política de reparación:** «reintento_idempotente» no puede ejecutarse sola: sin_garantia_de_idempotencia.
- **Lo que ve el médico:** «No se pudo enviar el mensaje al paciente.» · seguridad del dato: «La cita sigue guardada; sólo falló el mensaje al paciente.» · reintentar: sí · visibilidad: discreto
- **No evaluado:** tasa de error: el umbral es un SLO y lo fija el dueño (PREPARED_ONLY); latencia: el umbral es un SLO y lo fija el dueño (PREPARED_ONLY); pico: no hay línea base de esta firma

### RESPUESTA-CADUCA — El paciente reserva sobre un hueco que ya no existe

- **Firma:** `scheduling|hueco_caduco|reservar|/reservar/[id]|-|http_409|simulacro`
- **Raya:** 5 evento(s) en 0.5 min sobre 5 operación(es); cruzó: operaciones_afectadas
- **Política de reparación:** «invalidar_cache_caduca» es reversible e idempotente, no toca verdad clínica ni permisos ni dinero, y el incidente admite reintento.
- **Lo que ve el médico:** «No pude completar el cambio en la agenda.» · seguridad del dato: «La agenda no cambió. Ninguna cita se creó ni se movió a medias.» · reintentar: sí · visibilidad: franja
- **No evaluado:** tasa de error: el umbral es un SLO y lo fija el dueño (PREPARED_ONLY); latencia: el umbral es un SLO y lo fija el dueño (PREPARED_ONLY); pico: no hay línea base de esta firma

### UI-COMPONENTE — Un componente secundario de la pantalla lanza

- **Firma:** `ui|componente_lanza|panel-evidencia|/consulta/[id]|-|render_error|simulacro`
- **Raya:** 5 evento(s) en 0.7 min sobre 5 operación(es); cruzó: operaciones_afectadas
- **Política de reparación:** «reiniciar_estado_de_cliente» es reversible e idempotente, no toca verdad clínica ni permisos ni dinero, y el incidente admite reintento.
- **Lo que ve el médico:** «Una parte de la pantalla no se pudo mostrar.» · seguridad del dato: «Tu nota y tu dictado siguen guardados en este dispositivo.» · reintentar: sí · visibilidad: discreto
- **No evaluado:** tasa de error: el umbral es un SLO y lo fija el dueño (PREPARED_ONLY); latencia: el umbral es un SLO y lo fija el dueño (PREPARED_ONLY); pico: no hay línea base de esta firma

### WHATSAPP-TRAS-RESERVA — La cita se guardó y el mensaje al paciente no salió

- **Firma:** `notification|envio_fallido|confirmacion-portal|/api/public/booking|whatsapp|http_502|simulacro`
- **Raya:** 5 evento(s) en 0.8 min sobre 5 operación(es); cruzó: operaciones_afectadas
- **Política de reparación:** «reintentar_notificacion» es reversible e idempotente, no toca verdad clínica ni permisos ni dinero, y el incidente admite reintento.
- **Lo que ve el médico:** «No se pudo enviar el mensaje al paciente.» · seguridad del dato: «La cita sigue guardada; sólo falló el mensaje al paciente.» · reintentar: sí · visibilidad: discreto
- **No evaluado:** tasa de error: el umbral es un SLO y lo fija el dueño (PREPARED_ONLY); latencia: el umbral es un SLO y lo fija el dueño (PREPARED_ONLY); pico: no hay línea base de esta firma

### AISLAMIENTO — Una lectura intentó cruzar de un consultorio a otro

- **Firma:** `tenant_isolation|lectura_cruzada|expediente|/api/[id]|-|permission_denied|simulacro`
- **Raya:** 1 evento(s) en 0.0 min sobre 1 operación(es); cruzó: invariante_de_seguridad, severidad_alta
- **Política de reparación:** «reintento_idempotente» no puede ejecutarse sola: categoria_de_seguridad, incidente_irreversible, no_se_arregla_reintentando.
- **Lo que ve el médico:** «Se detuvo una operación por una comprobación de seguridad.» · seguridad del dato: «La operación se detuvo. No se escribió nada y el caso ya está en revisión.» · reintentar: no · visibilidad: franja
- **No evaluado:** tasa de error: el umbral es un SLO y lo fija el dueño (PREPARED_ONLY); latencia: el umbral es un SLO y lo fija el dueño (PREPARED_ONLY); pico: no hay línea base de esta firma

### API-500-REPETIDO — Un 500 que se repite y que nadie ha clasificado todavía

- **Firma:** `unknown|error_no_clasificado|expediente|/api/[id]|-|http_500|simulacro`
- **Raya:** 5 evento(s) en 0.4 min sobre 5 operación(es); cruzó: operaciones_afectadas
- **Política de reparación:** el escenario no propone ninguna acción automática
- **Lo que ve el médico:** «Algo falló y todavía no sé qué.» · seguridad del dato: «No se pudo confirmar qué pasó con esta acción. Tu texto sigue en pantalla: compruébalo antes de cerrar.» · reintentar: sí · visibilidad: franja
- **No evaluado:** tasa de error: el umbral es un SLO y lo fija el dueño (PREPARED_ONLY); latencia: el umbral es un SLO y lo fija el dueño (PREPARED_ONLY); pico: no hay línea base de esta firma

### RED-PUNTUAL — Un fallo de red suelto e inofensivo

- **Firma:** `network|conexion_perdida|nota|/consulta/[id]|-|network_error|simulacro`
- **Raya:** 1 evento(s) en 0.0 min: por debajo de toda raya (20 eventos / 5 min, 5 operaciones)
- **Política de reparación:** «reintento_idempotente» es reversible e idempotente, no toca verdad clínica ni permisos ni dinero, y el incidente admite reintento.
- **Lo que ve el médico:** «Se perdió la conexión.» · seguridad del dato: «Tu trabajo sigue en este dispositivo. Se enviará cuando vuelva la conexión.» · reintentar: sí · visibilidad: discreto
- **No evaluado:** tasa de error: el umbral es un SLO y lo fija el dueño (PREPARED_ONLY); latencia: el umbral es un SLO y lo fija el dueño (PREPARED_ONLY); pico: no hay línea base de esta firma

## Lo que este informe NO demuestra

- No demuestra ningún MTTD/MTTR de producción: no hay red, ni proveedor, ni base de datos.
- La duración de cada acción de reparación es un parámetro del escenario, no una medición.
- No prueba que las rutas reales del producto emitan estos eventos: eso es cableado, y va en los handoffs.
- No cubre Hospital ni UCI.
