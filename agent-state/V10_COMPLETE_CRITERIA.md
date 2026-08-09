# V10 — criterios de terminado del programa

Copia operativa del §45 de la especificación. `agent-state/V10_COMPLETE.md`
sólo puede crearse cuando **todas** las iteraciones del §32 estén cerradas Y:

- [ ] sin P0 visual abierto;
- [ ] sin P0 de seguridad clínica abierto;
- [ ] sin P1 que bloquee V10;
- [ ] el flujo dorado de Practice pasa de punta a punta;
- [ ] la persistencia de contexto en navegación crítica pasa (§38);
- [ ] el flujo móvil crítico pasa;
- [ ] la suite de regresión visual pasa;
- [ ] hallazgos críticos de accesibilidad resueltos;
- [ ] promedio visual de pantallas núcleo ≥ 9.3/10 **con captura como prueba**;
- [ ] ninguna pantalla crítica < 9.0/10;
- [ ] genérico-IA ≤ 1.0/10 en pantallas críticas;
- [ ] tokens de diseño canónicos (techos de `scripts/design/` en su piso);
- [ ] estilo legado duplicado suficientemente retirado;
- [ ] el Companion del paciente sigue cumpliendo las reglas V9;
- [ ] ninguna funcionalidad clínica regresionada (vitest + sellos);
- [ ] rendimiento aceptable (línea base y sin regresión);
- [ ] repositorio y agent-state coinciden;
- [ ] capturas y métricas registradas.

`V10_COMPLETE.md` llevará: fecha, SHA final, iteraciones cerradas, tabla de
puntuaciones (escritorio y móvil), resultados de accesibilidad y rendimiento,
limitaciones conocidas, backlog P2/P3 restante, notas de rollback y el
programa siguiente recomendado.

**Regla de honestidad**: ninguna casilla se marca sin la evidencia que el §34
exige (captura + razonamiento). Marcar sin evidencia es fabricar métricas
(§6, prohibido).
