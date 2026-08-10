# Workflow Constitution (V14 §16–§21)

Una pantalla hermosa con un flujo pobre falla. Se diseñan trabajos completos:

```text
INTENT → CONTEXT → ACTION → SYSTEM RESPONSE → NEXT SAFE ACTION → COMPLETION → RECOVERY / FOLLOW-UP
```

Todo flujo importante define: estado inicial, disparador, actor, contexto de
paciente y de encuentro, información requerida, acción primaria, camino
alternativo, camino de error, camino de recuperación, dueño, estado, plazo
cuando aplica, salida, siguiente acción, criterio de cierre, y
auditoría/procedencia.

## Cero flujos sin salida (§17)

Ningún flujo clínicamente significativo termina en «guardado». Nada
clínicamente significativo desaparece porque una página se cerró.

## Una siguiente acción (§18)

En cada paso el sistema sabe: qué acaba de pasar, cuál es el estado, quién es
el dueño, cuál es la siguiente acción segura — y la expone.

## Persistencia de contexto (§19)

Se preservan automáticamente: paciente, encuentro, tarea, flujo en curso,
borrador de nota, estado de audio, posición del transcript, valores de
formulario, filtros, posición de la línea de tiempo, resultado/medicación
seleccionados, borrador de IA, acción inconclusa. Navegar es moverse dentro de
UN espacio de trabajo clínico. (Base validada: NAVIGATION-001 / REG-300…303.)

## Flujos conscientes del rol (§20)

physician · secretary · nurse · admin · patient · caregiver · roles futuros.
Por flujo: quién puede iniciar, editar, aprobar, firmar, revisar, cerrar, ser
notificado. No se muestran acciones que el usuario no puede ejecutar — y la
autorización vive en el servidor (regla security-tenant).

## Niveles de consecuencia (§21)

| Nivel | Tipo | UX |
|---|---|---|
| 0 | Navegación/vista | sin confirmación |
| 1 | Edición reversible de bajo riesgo | inmediata + deshacer |
| 2 | Cambio significativo de flujo | acción/confirmación clara |
| 3 | Clínicamente consecuente | revisión + confirmación |
| 4 | Alto riesgo / irreversible | confirmación explícita + procedencia + auditoría |

Optimista sólo en 0–1; jamás en 3–4 (§23).
