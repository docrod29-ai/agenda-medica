# Mobile — Backlog priorizado

Priorización por **impacto clínico/UX ÷ esfuerzo**, mapeado a las iteraciones del programa. Cada ítem se implementa en SU iteración (una por ejecución), no aquí.

## P0 — Riesgo confirmado o seguridad clínica (adelantar si el Dr. lo aprueba)
| Ítem | Riesgo | Iteración destino | Nota |
|---|---|---|---|
| Borrador clínico fuera de `localStorage` plano (cifrar/minimizar/expirar/limpiar al salir) | RES-1 (crítico) | 7 (OFFLINE_AND_RESILIENCE) | Fuga PHI confirmada; se puede adelantar como fix puntual. |
| Estados de guardado diferenciados en móvil (local / sincronizando / servidor / firmado) | DATA-1 | 4 + 7 | Regla §5.2. |
| Flush de borrador en `visibilitychange`/`beforeunload` (bloqueo/cambio de app) | RES-2 | 7 | Cierra la ventana de 30s. |
| Migrar 10 `alert()` a toast/in-app | TCH-1 | 5 (TOUCH_AND_INPUT) | Mismo patrón que el confirm de hoy; barato. |

## P1 — Alto impacto en el flujo clínico móvil
| Ítem | Riesgo | Iteración |
|---|---|---|
| Pantalla "Consulta actual" unificada (paciente+alergias+nota+dictado+receta) | FLW-1 | 4 (CLINICAL_WORKFLOW) |
| Acción principal contextual en BottomNav (Nueva cita / Nueva nota / Dictar) + arreglar etiqueta "Consulta" | NAV-1 | 3 (MOBILE_NAVIGATION) |
| Preservar contexto al volver (paciente/fecha/scroll/filtros/borrador) | NAV | 3 |
| Reducir/So dividir el JS inicial; no cargar editor/copiloto/gráficas al abrir agenda | PRF-1 | 6 (MOBILE_PERFORMANCE) |

## P2 — Layout responsive
| Ítem | Riesgo | Iteración |
|---|---|---|
| Calendario: vista "día" compacta en teléfono (no 7 col apretadas) | LAY-1 | 2 (RESPONSIVE_FOUNDATION) |
| Tablas clínicas → tarjetas/filas expandibles en móvil (`nota`, tablas ui) | LAY-4 | 2 |
| Grids `repeat(3,1fr)` → colapsar a 1–2 col; auditar anchos fijos 540/420/900px | LAY-2/3 | 2 |
| Modales → bottom sheets / pantalla completa en teléfono | (revisar) | 2 |

## P3 — Capacidades, seguridad, accesibilidad, PWA (iteraciones dedicadas)
| Ítem | Iteración |
|---|---|
| Teclado no cubre campos; teclados numéricos/decimales; `Next/Done` | 5 |
| Cola de sync idempotente + conflictos visibles | 7 |
| Cámara/escáner/micrófono/biometría/compartir con consentimiento | 8 (DEVICE_CAPABILITIES) |
| Sesiones, dispositivo compartido, PHI en notificaciones/app-switcher, logs | 9 (MOBILE_SECURITY) |
| VoiceOver/TalkBack, contraste, texto aumentado, foco | 10 (ACCESSIBILITY) |
| Manifest completo (shortcuts/screenshots), SW estrategia segura, update sin perder borrador | 11 (PWA) |
| Suite E2E móvil + perfiles reales + tabla comparativa antes/después | 12 (MOBILE_VALIDATION) |

## Secuencia recomendada
Seguir el orden del programa (2→12). **Excepción sugerida:** adelantar los P0 de PHI/guardado (RES-1, DATA-1, TCH-1) si el Dr. quiere cerrar riesgo antes del rediseño responsive, porque son fugas/bugs confirmados y baratos. Decisión del Dr.
