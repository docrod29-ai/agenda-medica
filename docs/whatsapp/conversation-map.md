# WhatsApp — Mapa de conversación (bot actual)

La máquina de estados vive en `src/app/api/whatsapp/webhook/route.ts`. El paciente responde con **texto** (no hay botones/listas). La sesión se guarda por `(clinicId, telefono)`.

## Estados detectados
```
inicio
  → (cualquier texto) → menu
menu
  → "agendar" / opción → agendar_nombre → … → (transacción) crear cita
  → "cancelar" → cancelar_buscar → cancelar cita
  → (lista de espera) → esperando_lista
agendar_nombre → … (recolección de datos por texto)
cancelar_buscar → localizar y cancelar
esperando_lista → paciente en lista, espera oferta de lugar
```
- **FAQ:** se detecta en casi cualquier estado (horarios/ubicación/etc.) antes de continuar el flujo.
- **Creación de cita:** transacción atómica que re-chequea conflicto → sin doble cita.
- Marca `consentimientoMensajes: true` y `recordatorio24hEnviado: false` al crear.

## Comparado con el diseño objetivo del programa
| Objetivo | Estado actual |
|---|---|
| Botones para pocas opciones | ✗ (texto) |
| Listas para varias opciones | ✗ (texto) |
| WhatsApp Flows para procesos multipaso (agendar/reprogramar/registro) | ✗ |
| Comandos globales: MENÚ / ATRÁS / CANCELAR / HABLAR CON RECEPCIÓN | parcial (no se detectó handoff) |
| Confirmación final explícita con botones | texto (riesgo de confirmación ambigua) |
| Handoff humano en un toque | ✗ |
| Reprogramación conservando la cita original | por verificar (no evidente en el mapa) |

## Riesgos de UX/seguridad del flujo por texto
- **Confirmación ambigua:** "sí, pero…", emojis, audios → el programa prohíbe interpretarlos como confirmación. Con texto libre es más fácil equivocarse; los **botones** eliminan esa ambigüedad.
- **Callejones sin salida:** sin comandos globales fiables (MENÚ/ATRÁS/RECEPCIÓN) el paciente puede quedar atrapado.
- **Accesibilidad:** teclear números es más difícil para adultos mayores que tocar un botón/lista.

## Recomendación
Migrar los puntos de decisión a **botones/listas** (Iter. 6) y los procesos multipaso (agendar, reprogramar, registro, lista de espera) a **WhatsApp Flows** con validación en servidor (Iter. 7), conservando la máquina de estados como el control determinista.
