# Iteración 4 — CLINICAL_WORKFLOW · Reporte

- **Iteration ID:** nexusmed-mobile-004 · **Modo:** CLINICAL_WORKFLOW · **Entorno:** staging / rama `feat/mobile-excellence` · **Producción:** no alterada · `production_deployment_allowed: false`.
- **Estado:** **PARTIAL — núcleo verificable entregado; ensamblado de UI diferido.**

## Decisión honesta de alcance
La Iteración 4 (pantalla "Consulta actual" unificada) vive **en el camino clínico autenticado**, que **no puedo verificar en ejecución aquí** (sin sesión). Ensamblar una pantalla clínica completa sin poder probarla es exactamente el riesgo que el Dr. quiere evitar (una alergia o medicamento mal mostrados serían peligrosos). Por eso esta ejecución entrega el **núcleo puro y verificable** de la iteración —las reglas clínicas de seguridad— y **deja el ensamblado de la pantalla** para cuando haya verificación en dispositivo/sesión.

## Entregado (puro + testeado)
`src/lib/mobile/consulta-cierre.ts`:

| Función | Regla del programa | Qué garantiza |
|---|---|---|
| `resumenFijo(entrada)` | §4.2 Resumen fijo | Devuelve los chips críticos (alergia, embarazo, TFG<60) **antes** que la edad; TFG<30 = crítico, 30–59 = relevante, ≥60 no aparece; trunca alergias largas. |
| `checklistCierre(estado)` | §4.6 + §5.2 Cierre seguro | Diferencia el estado de guardado (local / sincronizando / servidor / firmado / error) y **NUNCA marca "servidor" si es local o sincronizando**. Advierte riesgos reales. **Bloquea el cierre SOLO ante error de sincronización** (riesgo real de pérdida), no por datos clínicos incompletos (§4.6: advertir, no estorbar). |

**Archivos:** `src/lib/mobile/consulta-cierre.ts`, `src/__tests__/consulta-cierre.test.ts` (nuevos). Deps/migraciones: 0.

## Pruebas
- `tsc --noEmit` → 0.
- `vitest run` → **377/377** (9 nuevos de `consulta-cierre`; sin regresión). Los tests fijan las reglas no negociables: no afirmar guardado servidor sin confirmación, bloquear solo ante error real, críticos primero en el resumen.
- `next build` → OK.

## Diferido (con razón, no fingido)
- **Pantalla "Consulta actual" unificada** (§4.1), franja de resumen fija en la UI (§4.3), flujo por etapas (§4.3), acciones rápidas (§4.4), línea de tiempo móvil (§4.5), diálogo de cierre visual (§4.6): todo esto **consume** estos helpers pero requiere montar UI sobre datos reales del paciente → **verificación en dispositivo/sesión** antes de tocar el flujo clínico en vivo. No se ensambla a ciegas.
- Cuando haya verificación: (1) mostrar `resumenFijo(...)` como franja superior; (2) al pulsar "Cerrar consulta", mostrar `checklistCierre(...)` como hoja inferior, respetando `bloqueaCierre`.

## Quality Gate
```
QUALITY GATE: PARTIAL — reglas de seguridad clínica del cierre y del resumen fijo
implementadas como funciones PURAS y verificadas (9 tests): no se afirma guardado
sin confirmación, no se bloquea de más, críticos primero. La pantalla que las
consume se difiere a verificación en dispositivo (no se ensambla UI clínica a
ciegas). Sin regresión (377/377, build OK). production_deployment_allowed:false.
```

## Recomendación al Dr. (importante)
Las iteraciones 4–10 son cada vez **más dependientes del dashboard autenticado** (flujo clínico, teclado, cámara, biometría, offline, lector de pantalla). Para avanzarlas **con verificación real** (no a ciegas), conviene una de estas dos:
1. **Tú pruebas en tu teléfono** cada cambio que yo prepare (yo entrego + tú confirmas antes de dar por bueno), o
2. **Acceso a un entorno de staging con datos de prueba** donde yo pueda entrar y verificar (sin pacientes reales).

Mientras tanto seguiré entregando **núcleos puros verificables** (como este) y dejando el ensamblado de UI clínica marcado para verificación.

## Siguiente iteración recomendada (no implementada)
**Cerrar el P0 de PHI en `localStorage`** (riesgo crítico confirmado, verificable sin dispositivo) — o **Iteración 5 (TOUCH_AND_INPUT)**, cuyo P0 (`alert()` nativos → toast) también es verificable sin sesión.
