# Paquete de producción — `nexusmed-v1183`

> **Estado: PREPARADO, NO PUBLICADO.** Sigue el ciclo que el dueño autorizó el
> 6-sep-2026 («desplegando y subiendo a producción, no quiero atascadero»). Se
> escribe ANTES de fusionar.

| | |
|---|---|
| **Versión del service worker** | `nexusmed-v1182` → **`nexusmed-v1183`** |
| **Última línea desplegada** | `e9cf6d38` — v1182, pin del botón de producción (PR #456) |
| **Commits que entran** | **27** (17 cortes del programa de preservación + la fusión de `main` + contabilidad) |
| **Superficie** | 40 rutas de API (mensaje de error genérico), 5 pantallas (receta, consulta, orden, vista previa), 8 módulos nuevos de `src/lib`, 17 pruebas nuevas, CI (+1 paso) |
| **Código de producto** | **sí**: receta, consulta, guardia de membresía sin cambios de contrato, redactor de logs, candado del canal de WhatsApp |
| **Reglas / índices de Firestore** | **sin cambios** — el botón los vuelve a publicar idénticos |

## Qué entra (REG-515 … REG-531, `docs/audit/regression-ledger.md`)

**Seguridad y aislamiento**
- **515** · un enlace REVOCADO del paciente seguía abriendo la sala de video.
- **522** · la cancelación ARCO ahora apaga el portal del paciente (D-034).
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

Decisiones del dueño escritas en el código: **D-032** (alergia crítica sólo avisa), **D-033** (la pregunta viaja completa), **D-034** (ARCO revoca el portal).

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
4. `Despliegue a producción (manual)`: Compuerta 0–3 (el árbol autorizado publica lo mismo que `main`, producción sirve `nexusmed-v1183`), reglas e índices de Firestore idénticos, acta.

## Lo que este paquete NO demuestra

- **No se miró la consulta con `pac-006` en el navegador**, sólo la receta. La consulta lleva el mismo cableado (REG-524, 531) y sus pruebas; la sonda queda para el siguiente tramo.
- **Las cabeceras de seguridad contra producción** (`e2e:seguridad:prod`) se comprueban después de publicar, no antes: el CI del PR mide el build del PR.
- **Dos decisiones del dueño siguen abiertas** y no bloquean: D-D (tres validadores viejos sin conectar) y D-E (la llave de 360dialog como id de documento).
- **No es un iPhone**: la verificación en navegador fue Chromium.
