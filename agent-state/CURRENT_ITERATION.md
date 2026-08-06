# Iteración actual — el backlog del loop, al día

**Modo**: autónomo CON despliegue. El dueño levantó la restricción de viva voz y
por escrito varias veces («despliega el fix ya», «no pares», «quita los
candados»). Lo demás sigue igual: nada de datos reales de pacientes, nada
destructivo, ninguna cifra clínica inventada.

## Lo que estaba desactualizado

El tablero decía **v1030** mientras producción iba por **v1079**. Un tablero que
no se actualiza miente con más autoridad que no tenerlo, así que lo primero fue
ponerlo al día: `MASTER_STATE.json`, `BACKLOG.json` con la fórmula de prioridad
recalculada, y los ítems cerrados marcados.

- `SAFE-001` (score 73) — **ya estaba cerrado** y figuraba «a medias». Verificado:
  `alergenosDe` es el parser único en consulta, UCI, receta y sesgo del
  reconocedor, y lee `alergiasEstructuradas`.
- `VOICE-004` — cerrado en v1031.

## Cerrado en esta iteración

`UX-001` (score 70) — **«Quitar de la nota» no quitaba nada de la nota**. El
botón sacaba el id de `aprobados`, que sólo se guarda como metadato. El médico
quitaba un diagnóstico mal extraído y seguía en la nota que firmaba.

Reparado con `quitarDeLaNota()`, módulo puro, con punto de deshacer. REG-198,
desplegado en v1079.

## Siguiente por score

1. `TRACE-001` (54) — el sello de integridad dice «cubre todo» y deja fuera
   `transcripcionMotor`. **No se toca el hash sin plan de migración**: cambiarlo
   invalida todo lo firmado.
2. `UX-002` (39) — el texto que explica por qué no se puede firmar está a 2.42:1
   de contraste en tema oscuro. Ilegible equivale a ausente.
3. `SAFE-003` — «sin referencia de dosis» se calla también en pediatría.
   **Necesita decisión del médico**: en un niño, «no tengo referencia» no es lo
   mismo que «no hay alerta».
