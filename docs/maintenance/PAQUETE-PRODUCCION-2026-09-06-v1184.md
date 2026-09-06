# Paquete de producción — `nexusmed-v1184`

> **Estado: PREPARADO, NO PUBLICADO.** Sigue el ciclo que el dueño autorizó el
> 6-sep-2026 («desplegando y subiendo a producción, no quiero atascadero»). Se
> escribe ANTES de fusionar.

> **SUPERADO — 6-sep-2026 02:04 UTC. PUBLICADO Y VERIFICADO.** Vercel publicó
> `main` por su integración de git al fusionarse #459, y el botón corrió sobre
> `8fe45415`: ejecución
> [#24](https://github.com/docrod29-ai/agenda-medica/actions/runs/34005457180),
> en verde, con la Compuerta 3 midiendo `nexusmed-v1184` contra el sitio vivo.
> La línea de arriba no se borra: era verdad cuando se escribió. Lo que pasó de
> verdad está en la última sección. (Este aviso lo escribió la sesión que cerró
> v1181, al encontrarse el acta abierta con la versión ya publicada.)

| | |
|---|---|
| **Versión del service worker** | `nexusmed-v1183` → **`nexusmed-v1184`** |
| **Última línea desplegada** | `078664fe` — v1183 (PR #457, las cuatro cosas que el dueño encontró en su iPhone), pin en PR #460 |
| **Commits que entran** | los 17 cortes del programa de preservación + dos fusiones de `main` + contabilidad |
| **Superficie** | 40 rutas de API (mensaje de error genérico), 5 pantallas (receta, consulta, orden, vista previa), 8 módulos nuevos de `src/lib`, 17 pruebas nuevas, CI (+1 paso) |
| **Código de producto** | **sí**: receta, consulta, guardia de membresía sin cambios de contrato, redactor de logs, candado del canal de WhatsApp |
| **Reglas / índices de Firestore** | **sin cambios** — el botón los vuelve a publicar idénticos |

> **Nota (6-sep-2026, 01:35 UTC).** Este paquete nació como `v1183` con los
> números REG-515…531 y D-032…034. Mientras corría su CI, otra sesión fusionó a
> `main` el paquete `v1183` (REG-515…518, D-032: las cuatro cosas del iPhone del
> dueño). Novena colisión del contador: este paquete pasa a `v1184`, sus
> regresiones a REG-519…535 y sus decisiones a D-033…035. Dos escritores sin
> coordinar es justo el atascadero que el dueño no quiere; queda dicho en
> `agent-state/BLOCKERS.md`.

## Qué entra (REG-519 … REG-535, `docs/audit/regression-ledger.md`)

**Seguridad y aislamiento**
- **515** · un enlace REVOCADO del paciente seguía abriendo la sala de video.
- **522** · la cancelación ARCO ahora apaga el portal del paciente (D-035).
- **527** · la guardia de membresía del servidor tiene por fin una prueba ejecutada contra un doble con id (sin cambio de código).
- **528** · `sanitize` redacta nombres de paciente por llave y llaves de Stripe por patrón.
- **529** · `reclamarCanal` en transacción: dos consultorios no pueden quedarse el mismo número de WhatsApp.
- **530** · cuarenta rutas dejan de devolver el error crudo (`String(err)`) al cliente; mensaje genérico, detalle al log.

**Receta y medicación**
- **520** · sin edad en el expediente no se aplican topes de adulto a un niño en silencio; manda la fecha de nacimiento.
- **521** · la huella de una receta larga ya no se pierde entera en la bitácora.
- **523** · la receta ve la medicación VIGENTE y la creatinina más reciente del expediente, con fecha y vigencia.
- **524** · la misma sustancia en dos renglones («Paracetamol» + «Tempra») se dice, con la suma contra el techo del catálogo.
- **531** · la receta ya no cuenta su propia nota firmada como «lo que ya toma» (se vio en el navegador).

**Voz y portal del paciente**
- **516** · los alérgenos del expediente llegan también a Whisper (una lista para los cuatro puntos de envío).
- **517** · la pregunta escalada del paciente abre una tarea en `/pendientes` aunque no haya teléfono.
- **519** · cerrar esa tarea marca la pregunta como atendida en el portal.

**Pruebas que no probaban**
- **518** · el guardián del paciente equivocado se probaba contra un comentario; ahora contra sus mutantes.
- **525** · `csp-manifest` corre en CI después del build (antes, siempre saltada).
- **526** · el prompt se vigila por frases sobre lo emitido, no por literales.

Decisiones del dueño escritas en el código: **D-033** (alergia crítica sólo avisa), **D-034** (la pregunta viaja completa), **D-035** (ARCO revoca el portal).

## Compuertas, medidas sobre el árbol fusionado con `main`

| | |
|---|---|
| `npx vitest run` | **12 764 pasan · 1 falla** (`ops-timeout-y-punto-ciego`: el proxy del contenedor; entorno, no árbol) · 953 archivos |
| `npx tsc --noEmit` | limpio |
| `node scripts/lint-trinquete.mjs` | **93** = techo |
| Trinquete de diseño | sin deuda nueva |
| `npm run build` | 164/164 páginas con los placeholders del CI |
| Sello | 476 archivos · 6 685 casos |
| Navegador | receta con `pac-006` a 390 y 1440, cero errores de consola (readiness §8) |

## Cómo se publica

1. PR de esta rama a `main` → 5 jobs de CI en verde → fusión.
2. Vercel construye `main` y lo sirve en producción (integración Git del proyecto `agenda-medica`).
3. PR de una línea: `SHA_AUTORIZADO` → el commit de fusión (misma maniobra que #456).
4. `Despliegue a producción (manual)`: Compuerta 0–3 (el árbol autorizado publica lo mismo que `main`, producción sirve `nexusmed-v1184`), reglas e índices de Firestore idénticos, acta.

## Lo que este paquete NO demuestra

- **No se miró la consulta con `pac-006` en el navegador**, sólo la receta. La consulta lleva el mismo cableado (REG-528, 531) y sus pruebas; la sonda queda para el siguiente tramo.
- **Las cabeceras de seguridad contra producción** (`e2e:seguridad:prod`) se comprueban después de publicar, no antes: el CI del PR mide el build del PR.
- **Dos decisiones del dueño siguen abiertas** y no bloquean: D-D (tres validadores viejos sin conectar) y D-E (la llave de 360dialog como id de documento).
- **No es un iPhone**: la verificación en navegador fue Chromium.

## Lo que pasó de verdad

Se publicó el 6-sep-2026. Los tres pasos salieron en el orden previsto.

| Paso | Qué fue | Resultado |
|---|---|---|
| 1 | PR #459 — service worker a v1184 y esta acta | fusionado, 5 checks de CI en verde |
| — | Vercel publicó `main` (`8fe45415`) por su integración de git | producción pasa a servir `nexusmed-v1184` |
| 2 | PR #463 — `SHA_AUTORIZADO` repuntado a `8fe45415` | fusionado, 5 checks en verde |
| 3 | Workflow «Despliegue a producción (manual)», ejecución **#24** | `PRODUCTION_RELEASE=SUCCESS` (02:04 UTC) |

Acta que emitió la ejecución #24:

```
PRODUCTION_URL=https://agenda-medica-one.vercel.app
APP_SHA=8fe45415217ca5379b1914339f04848160741306
VERSION=nexusmed-v1184
VERCEL_PROJECT=agenda-medica
FIRESTORE_RULES=success
FIRESTORE_INDICES=success
FIRESTORE_RULES_SHA256=1d91d7077e616e2a600a0f0526d79c46b85d5ffe9d7d5bffd0d8b157923d2df7
SECURITY_E2E=success
SMOKE=success
SMOKE_PORTAL=success
PRODUCTION_RELEASE=SUCCESS
```

<https://github.com/docrod29-ai/agenda-medica/actions/runs/34005457180>

### Lo que esta ejecución NO demuestra

- **Reglas e índices**: se reenviaron sin cambio. El hash es el que dejó #18
  (`1d91d707…`); no había ninguna regla nueva que publicar.
- **Que el service worker viejo se haya retirado de los navegadores.** Sube la
  versión del caché; la retirada ocurre cuando cada cliente recarga.
- Nada de lo que la sección anterior declara sin verificar. Publicar no lo
  verificó.
