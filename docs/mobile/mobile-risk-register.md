# Mobile — Registro de riesgos

Severidad: **Crítico** (daño clínico / pérdida de datos / fuga PHI) · **Alto** (bloquea tarea o degrada mucho) · **Medio** (fricción real) · **Bajo** (pulido). "Confianza" indica si el riesgo está **confirmado** en código o es **por verificar** en dispositivo.

| ID | Riesgo | Categoría | Severidad | Confianza | Evidencia / nota |
|---|---|---|---|---|---|
| RES-1 | Borrador clínico (resumen, dx, medicamentos, transcripción) en `localStorage` **plano** | Privacidad/PHI | **Crítico** | Confirmado | `consulta/[patientId]`: `respaldoKey` → `localStorage.setItem(...)`. §7.2 prohíbe PHI en localStorage sin protección. Además sin flush en `visibilitychange`/`beforeunload`. |
| TCH-1 | 10 `alert()` nativos se **ignoran en silencio** en apps instaladas | Táctil/entrada | **Alto** | Confirmado | Misma clase que el `window.confirm` arreglado hoy; validaciones que el usuario no ve. |
| DATA-1 | Falso "guardado" en móvil (no se distingue local vs servidor vs firmado) | Seguridad clínica | **Alto** | Por verificar | §5.2 exige diferenciar estados. Autosave da ack local; falta señal clara de servidor en móvil. |
| RES-2 | Pérdida de borrador ante llamada/bloqueo/cambio de app | Resiliencia | **Alto** | Por verificar | Autosave 30s mitiga, pero ventana de 30s + sin flush en background. Historial de pérdidas en notas (memoria del proyecto). |
| RES-3 | Sin cola de sincronización idempotente / manejo de conflictos entre dispositivos auditado | Resiliencia | **Alto** | Por verificar | No se localizó capa offline/queue explícita; a revisar en Iter. 7. |
| PRF-1 | JS pesado (~5.3 MB en disco, chunk mayor ~920 KB) en gama baja / 4G | Rendimiento | **Medio-Alto** | Confirmado (peso) / por medir (impacto) | Falta Lighthouse de campo (LCP/INP). |
| LAY-1 | Calendario semanal de 7 columnas apretado en teléfono | Layout | **Medio** | Confirmado | `56px repeat(7,1fr)`; sin vista "día" compacta. |
| LAY-4 | Tablas clínicas ilegibles en móvil (`nota`, `hospitalizacion`) | Layout | **Medio** | Confirmado | `nota` sin overflow-x; `hospitalizacion` parcial. |
| NAV-1 | Sin acción principal contextual; etiqueta "Consulta"→/pacientes | Navegación | **Medio** | Confirmado | `BottomNav`. |
| FLW-1 | Sin pantalla "Consulta actual" unificada → mucho scroll/cambios | Flujo clínico | **Medio** | Confirmado | `consulta/[patientId]` es página larga. |
| SEC-1 | PHI en notificaciones bloqueadas / app-switcher / caché al cerrar sesión | Seguridad móvil | **Alto** | Por verificar | Iter. 8–9. |
| TCH-2 | Teclado cubriendo campos / botón guardar tapado | Táctil | **Medio** | Por verificar | Dispositivo real. |
| A11Y-1 | VoiceOver/TalkBack, contraste, texto aumentado sin ruptura | Accesibilidad | **Medio** | Por verificar | Iter. 10. |
| LAY-2/3 | Grids `repeat(3,1fr)` y anchos fijos (540/420/900px) sin colapsar | Layout | **Bajo-Medio** | Confirmado (código) | Verificar overflow real por instancia. |

## Riesgos clínicos destacados (para atención temprana)
1. **RES-1 (PHI en localStorage)** — crítico por privacidad; abordar junto con el modelo de guardado seguro (Iter. 7), pero puede adelantarse por ser fuga confirmada.
2. **DATA-1 / RES-2 (falso guardado / pérdida en interrupción)** — tocan directamente la regla "no perder notas" y "no afirmar guardado sin confirmación" (§5.2). Prioridad en Iter. 4 y 7.
3. **TCH-1 (alert nativos)** — rápido de cerrar; mismo patrón ya resuelto para confirm.
