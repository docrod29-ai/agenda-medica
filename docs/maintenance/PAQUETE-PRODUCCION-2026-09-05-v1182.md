# Paquete de producción — `nexusmed-v1182`

> **Estado: PREPARADO, NO PUBLICADO.** Sigue el ciclo que el dueño autorizó el
> 5-sep-2026 para este trabajo. Se escribe ANTES de fusionar.

> **SUPERADO — 5-sep-2026 23:28 UTC. PUBLICADO Y VERIFICADO.** Vercel publicó
> `main` por su integración de git al fusionarse #455, y el botón corrió sobre
> `e9cf6d38`: ejecución
> [#22](https://github.com/docrod29-ai/agenda-medica/actions/runs/33998676281),
> en verde, con la Compuerta 3 midiendo `nexusmed-v1182` contra el sitio vivo.
> La línea de arriba no se borra: era verdad cuando se escribió. Lo que pasó de
> verdad está en la última sección. (Este aviso lo escribió la sesión que cerró
> v1181, al encontrarse el acta abierta con la versión ya publicada.)

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

## Lo que pasó de verdad

Se publicó el 5-sep-2026. Los tres pasos salieron en el orden previsto.

| Paso | Qué fue | Resultado |
|---|---|---|
| 1 | PR #455 — service worker a v1182 y esta acta | fusionado, 5 checks de CI en verde |
| — | Vercel publicó `main` (`e9cf6d38`) por su integración de git | producción pasa a servir `nexusmed-v1182` |
| 2 | PR #456 — `SHA_AUTORIZADO` repuntado a `e9cf6d38` | fusionado, 5 checks en verde |
| 3 | Workflow «Despliegue a producción (manual)», ejecución **#22** | `PRODUCTION_RELEASE=SUCCESS` |

Acta que emitió la ejecución #22:

```
PRODUCTION_URL=https://agenda-medica-one.vercel.app
APP_SHA=e9cf6d38c274d19d31441d92a6147645abae279c
VERSION=nexusmed-v1182
VERCEL_PROJECT=agenda-medica
FIRESTORE_RULES=success
FIRESTORE_INDICES=success
FIRESTORE_RULES_SHA256=1d91d7077e616e2a600a0f0526d79c46b85d5ffe9d7d5bffd0d8b157923d2df7
SECURITY_E2E=success
SMOKE=success
SMOKE_PORTAL=success
PRODUCTION_RELEASE=SUCCESS
```

<https://github.com/docrod29-ai/agenda-medica/actions/runs/33998676281>

### Lo que esta ejecución NO demuestra

- **Reglas e índices**: se reenviaron sin cambio. El hash es el que dejó #18
  (`1d91d707…`); no había ninguna regla nueva que publicar.
- **Que el service worker viejo se haya retirado de los navegadores.** Sube la
  versión del caché; la retirada ocurre cuando cada cliente recarga.
- **La pantalla de `/guia` en un navegador**, igual que decía la sección
  anterior. Publicar no la miró.

