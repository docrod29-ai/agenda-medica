# Mobile — Línea basal de flujos clínicos

Baseline de las 12 tareas del programa. Las columnas **Toques/Tiempo/Pantallas** se llenan con medición en dispositivo real (o emulación + sesión); aquí se registra la **ruta de código** conocida y la **fricción estimada por análisis** (no medida). No se ponen números inventados: las celdas empíricas están **pendientes** hasta la corrida en dispositivo.

> Método para llenar cada fila: cronómetro + conteo de toques en el dispositivo, siguiendo el flujo real. Registrar 3 corridas y tomar la mediana.

| # | Tarea | Ruta/pantalla | Toques (medido) | Tiempo (medido) | Fricción estimada por análisis |
|---|---|---|---|---|---|
| 1 | Abrir agenda | `BottomNav → /calendario` o `/dashboard` | pend. | pend. | Bajo. 1 toque a "Calendario" en la barra. Vista semanal apretada en teléfono ([LAY-1]). |
| 2 | Crear cita | `/asistente` o botón agenda | pend. | pend. | Medio. No hay acción central contextual "Nueva cita" ([NAV-1]); ruta menos directa. |
| 3 | Reprogramar | calendario → cita | pend. | pend. | Medio. Depende de tamaño de celda semanal ([LAY-1]) y de gestos vs botón. |
| 4 | Abrir expediente | `/pacientes → /expediente/[id]` | pend. | pend. | Bajo-medio. "Consulta"→/pacientes (etiqueta≠ruta) puede confundir ([NAV-1]). |
| 5 | Revisar alergias | `/expediente` (banner) | pend. | pend. | Bajo. Banner de alergias rojo y visible (bien). |
| 6 | Dictar nota | `/expediente → /consulta/[id]` → grabar | pend. | pend. | Medio. Página de consulta larga; dictado no está a 1 toque desde una vista unificada ([FLW-1]). |
| 7 | Editar nota | `/consulta` secciones | pend. | pend. | Medio. Formulario largo; teclado cubriendo campos sin verificar ([TCH-2]). |
| 8 | Guardar borrador | autosave 30s + respaldo local | pend. | pend. | Bajo (autosave existe), PERO borrador en localStorage plano y sin flush en background ([RES-1]). |
| 9 | Generar receta | `/consulta → /receta/[id]/[nota]` | pend. | pend. | Medio. Cambio de pantalla; selector de medicamentos no auditado en móvil. |
| 10 | Revisar una alerta | consulta (alergia/interacción) | pend. | pend. | Bajo. Alertas de alergia/interacción existen; intrusividad móvil sin medir. |
| 11 | Programar seguimiento | agenda desde consulta | pend. | pend. | Medio. Requiere volver a agenda; preservación de contexto sin verificar. |
| 12 | Cerrar consulta | consulta → firmar/guardar | pend. | pend. | Medio. Resumen de cierre y estado de sincronización a validar en móvil. |

## Objetivos (del programa, para comparar en Iter. 3–4)
- Agenda del día: **1 toque**.
- Siguiente paciente: **≤2 toques**.
- Iniciar nota desde expediente: **≤2 toques**.
- Iniciar dictado desde la nota: **≤1 toque**.
- Volver a agenda sin perder contexto: **1 toque**.

## Señales ya conocidas (de análisis, no cronometradas)
- Feedback local inmediato: el autosave da "guardado local" pero **no** confirma servidor de forma diferenciada en móvil → riesgo de falso "guardado" (§5.2). A validar en Iter. 4/7.
- El flujo 6→7→9 obliga a varios cambios de pantalla; la "Consulta actual" unificada (Iter. 4) es la mayor palanca de reducción de toques.
