# Briefing del equipo rojo — Fase 2 (refutación adversarial)

Trabajas CONTRA el auditor. Recibes un archivo JSON de hallazgos en
`docs/audit/panel-de-lujo-2026-09/crudos/<AUDITOR>.json` y tu trabajo es REFUTAR
cada uno. Sólo lectura: no modificas nada en `src/`; lo único que escribes es tu
archivo de veredictos. No dejes archivos temporales en el repositorio (usa /tmp).

## Cómo se refuta
Para cada hallazgo, ABRE el `archivo:linea` citado y comprueba:
1. ¿La evidencia citada existe literalmente en esa línea (±5)? Si no, `refutado` («evidencia no coincide»).
2. ¿Hay otra línea, en ese archivo o en quien lo llama, que ya impide el defecto? Cítala.
3. ¿La premisa es falsa? (Por ejemplo: «nadie lo llama» pero sí lo llama alguien: demuéstralo con grep.)
4. ¿Llega a producción? (¿Está detrás de una bandera apagada, en un módulo en pausa D-030, o en código muerto?)
5. ¿Ya está en `docs/audit/regression-ledger.md` como CLOSED y sigue cerrado? Entonces `refutado` («ya cerrado en REG-nnn») salvo que el auditor demuestre que reapareció.
6. ¿La prioridad es exagerada? Puedes CONFIRMAR bajando la prioridad (di por qué) o subirla si el auditor se quedó corto.
7. Si el hallazgo es `friccion`, `innecesario` o `mejora` (opinión de producto), no se refuta por «no es defecto»: se confirma si la evidencia existe y la lectura es razonable, y se marca `parcial` si depende de una decisión del dueño.

Ante la duda, REFUTA. Un hallazgo que no puedes ni confirmar ni refutar con evidencia queda `parcial` con lo que faltó.

Puedes ejecutar motores puros con `node`/jiti desde /tmp para comprobar una afirmación numérica (sin tocar `src/`, sin red, sin datos reales). Si lo haces, guarda la salida literal en `nota`.

## Formato de salida (JSON único)
```json
{
  "auditor": "<AUDITOR>",
  "fecha": "2026-09-06",
  "veredictos": [
    {
      "id": "A-001",
      "veredicto": "confirmado | refutado | parcial",
      "prioridad_final": "P0|P1|P2|P3",
      "evidencia": "archivo:línea que sostiene el veredicto (la que impide el defecto si refutas; la que lo confirma si confirmas)",
      "nota": "una o dos frases; qué comprobaste y cómo"
    }
  ],
  "ratio": { "total": 0, "confirmados": 0, "refutados": 0, "parciales": 0 },
  "observaciones_del_auditor": "patrones de error del auditor (exagera prioridades, cita líneas movidas, no verifica llamadores…)"
}
```
Escríbelo en `docs/audit/panel-de-lujo-2026-09/crudos/R-<AUDITOR>.json` y valida con node.
En tu mensaje final (≤15 líneas): ruta, ratio, y los ids que cambiaron de prioridad o quedaron refutados con una frase cada uno.
