# V10 — Iteración actual

**Directiva**: leer COMPLETO
[`docs/ai/NEXUSMED_VISUAL_EXCELLENCE_AND_CLINICAL_INTERACTION_MASTER_LOOP_V10.md`](../docs/ai/NEXUSMED_VISUAL_EXCELLENCE_AND_CLINICAL_INTERACTION_MASTER_LOOP_V10.md)
antes de tocar nada.

**Rama**: la historia V10 quedó **RECONCILIADA POR SEGUNDA VEZ** el
10-ago-2026 en `claude/kind-brahmagupta-ajtolc`. Esa punta contiene:
la cadena completa (instalación → exbp9m → 2yxowl → rms50y → ysxb6q),
iurzog, HOME-001 de la rama canónica, la reconciliación 40oom1 **y** la
corrida nocturna 9r4m7a (REG-307/308, v1169) — más el arreglo de hidratación
que i2uo2j y bttia7 encontraron por separado (portado, con guardián).
Superadas (NO arrancar de ellas ni fusionarlas): c51p2n, 9xajvg, dwmunz,
gu7h9g, i2uo2j, 397pqw, 4tkrhu, ake878, bttia7 — la lista con motivos vive en
`V10_MASTER_STATE.json → ramasSuperadas`.

## Protocolo de arranque (que la fragmentación no se repita)

El 9-ago corrieron **ocho** sesiones V10 en paralelo sin verse: cuatro
construyeron un arnés de capturas cada una, dos repararon el MISMO bug de
hidratación, tres re-auditaron la superficie pública ya auditada. Causa raíz:
cada corrida programada nace en SU rama de sesión (`claude/kind-brahmagupta-*`)
y no puede empujar a la canónica, así que ninguna veía a las demás.

**Protocolo desde ahora, ANTES de trabajar**:

1. `git fetch origin` y comparar por fecha TODAS las ramas
   `claude/kind-brahmagupta-*`, la canónica V10 y main.
2. Arrancar desde la punta más avanzada que contenga `puntaReconciliada`
   (hoy: la fusión del 10-ago); si otra corrida avanzó después, fusionarla
   ANTES de trabajar — nunca rehacer su trabajo.
3. Si hay una corrida viva (push < 10 min), no tocar sus archivos y
   reconciliar sólo cuando quede quieta (V10 §41).
4. Al empujar, dejar en `V10_MASTER_STATE.json → puntaReconciliada` el nombre
   de la rama propia para que la siguiente corrida la encuentre.

**Recomendación al dueño (pendiente)**: fusionar la punta reconciliada a la
rama canónica o a main por PR — mientras la verdad viva en ramas de sesión,
cada reconciliación cuesta una corrida entera.

## Estado tras la fusión del 10-ago

| Qué | Estado |
|---|---|
| **V10-TRUTH-001** | ✅ CERRADA — cerrada dos veces por corridas ciegas entre sí y reconciliada: capturas de dos arneses, scorecard con revisor independiente + lectura nocturna, dos líneas base axe unidas + una tercera confirmatoria, backlog con evidencia |
| **V10-D1 (fusión V9)** | ✅ EJECUTADA: PR #279 en main (`56d9fc7a`); REG de V9 = 294…305 |
| **HOME-001** (/dashboard) | ✅ implementado; la corrida nocturna lo verificó en navegador (8.6/1.0, cero axe tras REG-308); falta contrarrevisión independiente sobre la línea fusionada |
| **REG-307/308** | ✅ reparados con guardián (`lo-que-la-captura-real-midio.test.ts`), sellados, sw v1169 (SIN desplegar) |
| **NOTE-001 quick** (DEBT-008/009) | ✅ cerrado; re-captura `nota--*.png` pendiente |
| **DEBT-005 / DEBT-006a** | ✅ cerrados con guardián (etiquetas del flujo central; CTA primero en expediente móvil) |
| **Hidratación (V10-BUG-001)** | ✅ portado de i2uo2j/bttia7: `suppressHydrationWarning` en `<html>` (el script anti-flicker pone `data-theme` antes de hidratar), con guardián |
| **Trinquete de diseño** | 560 hex / 2020 tamaños / 637 radios (bajó en la fusión anterior; verificar tras esta) |
| **Backlog** | unión de TRES corridas en `V10_BACKLOG.json`; P0 vigente: agenda/citas móvil (DEBT-003) |
| **Arneses de captura** | TRES en el repo (deuda declarada): consolidar en V10-VISUAL-REGRESSION-001 |

## Compuertas de esta corrida (10-ago, reconciliación 2)

Ver mensaje del commit de fusión: vitest + lint-trinquete + build corridos
sobre la línea fusionada ANTES de empujar.

## Próxima acción exacta (siguiente corrida)

**Hecho en la corrida del 10-ago (después de la reconciliación)**: la
directiva de IDENTIDAD del dueño quedó instalada
(`docs/ai/NEXUSMED_ORIGINAL_PRODUCT_IDENTITY_DIRECTIVE.md`), el Visual DNA
existe (`docs/design/NEXUSMED_VISUAL_DNA.md`, con los 20 defectos de
identidad), y **AGENDA-IDENTITY-001 cerró el P0**: /citas es ahora el RIEL
DEL DÍA (marcador de AHORA, una acción por entrada, estado tipográfico,
es-MX, móvil apilado, axe 0 en 1440/390, trinquete de diseño BAJÓ y quedó
sellado en 557/2008/637/23). Revisión independiente (V10 §40): gramática
correcta, IDENTITY 7.5 — los CONTROLES aún delatan librería.

1. **AGENDA-IDENTITY-002 (P1)** — punch list del revisor independiente
   (en `V10_BACKLOG.json`): forma propia de CTA, fusionar tabs+selector,
   capturas con `next start`, evidencia de cortesía/descuadre/no-show.
2. **V10-SHELL-001** — es el siguiente techo de identidad: sidebar-almacén
   de ~22 destinos, FABs que tapan contenido clínico (P1.3 del revisor),
   marca partida en tres, «Nueva cita» duplicada a 768.
3. Re-captura y puntuación independiente de /dashboard y nota (pendiente
   desde la fusión).
4. V10-CONSTITUTION-001 (tokens/utilidades sobre el sistema V9).
