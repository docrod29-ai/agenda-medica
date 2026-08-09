# V10 — decisiones que sólo puede tomar el dueño

Hoy: **ninguna bloqueante.** El programa avanza sin interrumpirte.

## Opcionales (sólo si quieres acelerar o si el Plan A fracasa)

### OD-V10-1 · Proyecto Firebase de prueba para la inspección visual (opcional)

- **Qué**: un proyecto `nexusmed-visual-qa` (o similar) sin ningún dato real,
  cuyas claves públicas se pongan en el entorno de estas sesiones.
- **Por qué**: permitiría abrir las pantallas clínicas reales en el navegador
  del agente sin emuladores. El Plan A (emuladores locales, `V10-ENV-001`) no
  te necesita; esto sólo sería el Plan B si la red del contenedor no deja
  descargar los binarios del emulador.
- **Riesgo si se hace**: ninguno clínico (cero datos reales); costo Firebase ~0.
- **Recomendación**: esperar al resultado de `V10-ENV-001`.

### OD-V10-2 · /precios y los nombres de modelos (aviso, no pregunta todavía)

La página de precios nombra los modelos internos (Haiku/Sonnet/Opus/GPT-5).
Tu regla registrada (REG-292) dice «lo que hace, no cómo lo hace». Antes de
preguntarte nada, la próxima corrida revisará el diff de v1166 para ver si los
dejaste a propósito. Si sigue ambiguo, la pregunta vendrá aquí con una
recomendación concreta.
