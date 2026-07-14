# Iteración 3 — MOBILE_NAVIGATION · Reporte

- **Iteration ID:** nexusmed-mobile-003 · **Modo:** MOBILE_NAVIGATION · **Entorno:** staging / rama `feat/mobile-excellence` · **Producción:** no alterada · `production_deployment_allowed: false`.
- **Estado:** **PARTIAL** (acción central contextual + arreglo de etiqueta entregados y verificados por lógica/tests; búsqueda móvil, preservación de contexto y verificación de deep links quedan documentados como pendientes con su plan).

## Ventaja de seguridad
`BottomNav` es **solo móvil** (`.bottom-nav-wrap { display:none }` en escritorio, oculto en print). Todo el cambio de navegación es **desktop-safe por construcción**.

## Cambios entregados
| Cambio | Detalle | Métrica del programa que ataca |
|---|---|---|
| **Acción central contextual** | Botón central elevado (zona del pulgar) que cambia por ruta: en `/expediente/[id]` o `/consulta/[id]` → **"Consulta"** de ESE paciente (`/consulta/[id]`); en el resto → **"Nueva cita"** (`/asistente`). | "Iniciar consulta ≤2 toques" (ahora **1 toque** desde el expediente). |
| **Etiqueta corregida** | El destino "Consulta"→/pacientes (etiqueta ≠ ruta, confuso — NAV-1) ahora es **"Pacientes"**, y resalta también en `/expediente`. | Claridad de navegación. |
| **Estructura 4 destinos + acción** | Inicio · Agenda · **[acción central]** · Pacientes · CRM/Chat. Se retiró "Agendar" como destino plano; su función (agendar) la cubre la acción central "Nueva cita". | "Máximo 5 destinos" con acción contextual. |

**Archivos:** `src/components/BottomNav.tsx` (reescrito), `src/__tests__/bottomnav-accion.test.ts` (nuevo). Deps/migraciones: 0.

## Cambio estructural a revisar por el Dr.
Se **retiró "Agendar" (/asistente) como pestaña plana**. Sigue accesible por la acción central ("Nueva cita" → /asistente) y desde otros accesos. Si prefieres conservar "Agendar" como pestaña y mover otra, es un ajuste de una línea — dímelo.

## Pruebas
- `tsc --noEmit` → 0.
- `vitest run` → **368/368** (4 nuevos de `bottomnav-accion`; sin regresión). El test fija: expediente→consulta del mismo paciente, consulta mantiene el paciente, resto→Nueva cita, y que no confunde subrutas.
- `next build` → OK.
- **Límite honesto:** el render **visual en el dashboard** (botón elevado en el teléfono real) **no** se verificó en ejecución por falta de sesión. La *lógica* (a dónde lleva cada toque) sí está verificada por tests puros.

## Pendiente de esta iteración (documentado, no fingido)
- **3.5 Búsqueda global en móvil:** `PaletteBusqueda` **solo abre con Cmd/Ctrl+K** → en teléfono no hay entrada directa (hay que abrir el drawer → "Buscar", 2 toques poco obvios). **Propuesta:** ícono de búsqueda en la topbar móvil o 6º acceso que dispare la paleta. Requiere tocar la topbar/layout (dashboard) → conviene hacerlo con verificación en dispositivo.
- **3.4 Preservación de contexto** (paciente/fecha/scroll/filtros/borrador al volver): existe `useSmartBack` + autosave, pero la restauración de scroll/filtros no se auditó en ejecución. Pendiente de revisión en dispositivo/sesión.
- **3.6 Deep links protegidos:** las rutas `/expediente|/consulta/[id]` están bajo el layout autenticado; falta **verificar en ejecución** el gate de autorización por consultorio (no exponer datos de otro consultorio). Pendiente.

## Quality Gate
```
QUALITY GATE: PARTIAL — acción central contextual + etiqueta corregida entregadas,
lógica verificada por tests, ≤5 destinos, escritorio sin regresión (nav solo móvil),
368/368 tests, build OK. Búsqueda móvil / preservación de contexto / auth de deep
links: DOCUMENTADOS como pendientes de verificación en dispositivo/sesión (no se
declaran hechos). production_deployment_allowed:false.
```

## Riesgos residuales
- Verificación visual/interactiva del dashboard en dispositivo real (intrínseco a no tener sesión aquí).
- Muscle-memory del Dr. por retirar "Agendar" como pestaña — reversible en una línea.

## Siguiente iteración recomendada (no implementada)
**Iteración 4 — CLINICAL_WORKFLOW** (pantalla "Consulta actual" unificada: paciente + alergias + medicamentos + nota + dictado + receta en una sola vista móvil), que es la mayor palanca de reducción de toques. Alternativa: cerrar antes el **P0 de PHI en `localStorage`** (riesgo crítico confirmado) o completar la **búsqueda móvil (3.5)**.
