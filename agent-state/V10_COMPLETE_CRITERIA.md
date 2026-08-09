# V10 — criterios de terminación (contrato §45 de la espec)

`agent-state/V10_COMPLETE.md` sólo puede crearse cuando TODO esto sea verdad
a la vez, con evidencia:

1. Las 24 iteraciones de §32 cerradas (V10-TRUTH-001 … V10-RELEASE-GATE-001).
2. Cero P0 visual y cero P0 de seguridad clínica sin resolver; cero P1 que
   bloquee V10.
3. El flujo dorado Practice pasa de punta a punta en navegador.
4. La persistencia de navegación crítica pasa (§38, incl. Atrás/refresh/pestañas).
5. El flujo móvil crítico pasa con diseño móvil real, no escritorio apilado.
6. La suite de regresión visual pasa con datos sintéticos deterministas.
7. Accesibilidad: hallazgos críticos resueltos (los que impiden uso seguro son
   bloqueadores de release, §27).
8. Promedio visual de pantallas núcleo >= 9.3/10 y ninguna crítica < 9.0/10,
   con captura y justificación por pantalla.
9. GENERIC_AI_LOOK_SCORE <= 1.0/10 en pantallas críticas.
10. Tokens de diseño canónicos y el estilo legado duplicado retirado (el
    trinquete de diseño en cero o con techo justificado por escrito).
11. Patient Companion sigue seguro (las 12 preguntas de V9 §0 en verde).
12. Ninguna funcionalidad clínica regresionada (vitest + build + trinquete).
13. Rendimiento aceptable y medido.
14. Repo y agent-state de acuerdo; capturas y métricas registradas.

`V10_COMPLETE.md` debe contener: fecha, SHA final, iteraciones cerradas, tabla
de calificaciones (escritorio y móvil), resultados de accesibilidad y
rendimiento, limitaciones conocidas, backlog P2/P3 no bloqueante, notas de
rollback y programa siguiente recomendado.
