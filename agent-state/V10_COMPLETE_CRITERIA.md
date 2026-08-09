# V10 — Criterios de terminación

`agent-state/V10_COMPLETE.md` sólo puede existir cuando TODO lo de §45 de la
especificación se cumpla a la vez:

1. Las 24 iteraciones de §32 cerradas (TRUTH → … → RELEASE-GATE).
2. Cero P0 visual, cero P0 de seguridad clínica, cero P1 bloqueante de V10.
3. El flujo dorado de Practice pasa entero (§1) y la persistencia de navegación
   crítica pasa (§38).
4. El flujo móvil crítico pasa.
5. La suite de regresión visual pasa.
6. Los hallazgos críticos de accesibilidad resueltos (WCAG 2.2 AA, §27).
7. Promedio visual de pantallas núcleo ≥ 9.3/10 y ninguna crítica < 9.0/10 —
   **con captura y justificación por puntuación**, nunca inflado.
8. genericAiLook ≤ 1.0/10 en críticas.
9. Tokens de diseño canónicos y el estilo legado duplicado suficientemente
   retirado (medible: los techos del trinquete de diseño MUY por debajo de los
   2029/638 actuales).
10. El Patient Companion sigue seguro (reglas de patient-facing-ai intactas).
11. Cero funcionalidad clínica regresionada; rendimiento aceptable (§29).
12. Repositorio y agent-state de acuerdo; capturas y métricas registradas.

El archivo final lleva: fecha, SHA, tabla de puntuaciones por pantalla
(escritorio y móvil), resultados de accesibilidad y rendimiento, limitaciones
conocidas, backlog P2/P3 no bloqueante, notas de rollback y programa siguiente
recomendado.

**Regla de honestidad**: si una pantalla no se vio en navegador, no puntúa. Un
V10_COMPLETE con pantallas sin captura es inválido por construcción.
