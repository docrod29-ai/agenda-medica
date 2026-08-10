# Cuándo se declara V10 completo

`agent-state/V10_COMPLETE.md` sólo se crea cuando **todo** lo de la spec §45 se
cumple. Copia operativa (la spec gana si difieren):

- Las 24 iteraciones de §32 completas.
- Sin P0 visual ni P0 de seguridad clínica abiertos; sin P1 bloqueante de V10.
- Golden flow de Practice pasa; persistencia de navegación crítica pasa; flujo
  móvil crítico pasa.
- Suite de regresión visual pasa; hallazgos críticos de accesibilidad resueltos.
- Promedio de puntuación visual de pantallas núcleo ≥ 9.3/10 y ninguna crítica
  < 9.0/10 — **con captura de pantalla como evidencia, nunca desde el código**.
- GENERIC_AI_LOOK_SCORE ≤ 1.0/10 en pantallas críticas.
- Tokens canónicos; estilo legado duplicado suficientemente retirado (los techos
  del trinquete de diseño lo miden).
- Patient Companion sigue seguro; ninguna funcionalidad clínica regresionada.
- Rendimiento aceptable; repositorio y agent-state coinciden; capturas y
  métricas registradas.

El archivo final lleva: fecha, SHA, tabla de puntuaciones por pantalla
(escritorio y móvil), resultados de accesibilidad y rendimiento, limitaciones
conocidas, backlog P2/P3 no bloqueante, notas de rollback y programa siguiente
recomendado.
