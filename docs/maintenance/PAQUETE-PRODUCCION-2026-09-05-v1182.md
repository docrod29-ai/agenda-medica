# Paquete de producción — `nexusmed-v1182`

> **Estado: PREPARADO, NO PUBLICADO.** Sigue el ciclo que el dueño autorizó el
> 5-sep-2026 para este trabajo. Se escribe ANTES de fusionar.

| | |
|---|---|
| **Versión del service worker** | `nexusmed-v1181` → **`nexusmed-v1182`** |
| **Última línea desplegada** | `e78e1242` — v1181, certificada por las ejecuciones #19 y #20 |
| **Commits que entran** | **1** |
| **Superficie** | texto de la guía + un guardián nuevo |
| **Código de producto** | **0** — ni motores, ni rutas, ni pantallas |
| **Reglas / índices de Firestore** | sin cambios |

## Qué arregla

La guía de la app mentía sobre la navegación en tres sitios:

1. «A la izquierda están las secciones: Dashboard, Citas, Consulta,
   **Hospitalización, Consultor IA**, etc.» — el menú son **cinco destinos**
   desde V15-IA-001 (Hoy · Paciente · Encuentro · Seguimiento · Operaciones).
2. «Abre el Consultor: **en el menú**, "Consultor IA"» — se mudó al expediente
   del paciente en RTC-09, precisamente para no obligar al médico a salir del
   paciente y repetir de quién hablaba.
3. El tema de Hospitalización enseñaba a usar un módulo que **ya no aparece en
   el menú** (D-030), sin decirlo.

Es la clase de defecto más barata de escribir y más cara de sufrir: **el texto
no se rompe**, así que ninguna prueba lo cazaba, y cada reforma de navegación lo
dejaba un poco más falso. Lo lee quien ya está perdido.

## La defensa

`la-ayuda-describe-el-menu-que-existe.test.ts` ata la guía a los datos reales:
los destinos salen de `FlowRail`, la pausa de `MODULOS_EN_PAUSA` y lo que se
mudó de `CAPACIDADES_DEL_PACIENTE`. Probado al revés: con el texto viejo caen
3 de sus 5 casos.

## Lo que este paquete NO demuestra

- No mira la pantalla de `/guia` en un navegador: comprueba el contenido, no el
  pintado.
- No audita el resto de la guía. Se corrigieron las afirmaciones sobre **dónde
  están** las cosas —las que caducan al mover una pantalla—; el resto del texto
  (qué hace cada función) sigue sin guardián y puede tener otras frases viejas.
