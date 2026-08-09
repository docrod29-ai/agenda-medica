---
name: v9
description: Retomar el Master Loop V9 de NexusMED (Patient Companion + World-Class Product Experience) exactamente donde se quedó. Úsalo al reanudar tras compactación de contexto, reinicio de sesión, fin de créditos o reinicio de la máquina.
---

# Reanudar el Master Loop V9

V9 gobierna **experiencia del paciente, UX/UI, navegación e IA de cara al
paciente**. Extiende a V7; no lo sustituye.

## Paso 1 — leer el estado, en este orden

```
agent-state/LAST_SAFE_CHECKPOINT.md     ← EMPIEZA AQUÍ. Dice qué NO rehacer.
agent-state/CURRENT_ITERATION.md        ← criterio de la unidad en curso
agent-state/DESIGN_STATE.md
agent-state/PATIENT_COMPANION_STATE.md
agent-state/BACKLOG.json                ← los P0/P1/P2/P3
docs/ai/NEXUSMED_PATIENT_EXPERIENCE_AND_DESIGN_MASTER_LOOP_V9.md   ← la directiva íntegra
```

## Paso 2 — comprobar que el repositorio dice lo mismo

```bash
cd /Users/davidrdz/Desktop/agenda-medica
git rev-parse --abbrev-ref HEAD                       # claude/nexus-patient-ux-v9
git log --oneline -5                                  # ¿coincide con el SHA del checkpoint?
git status --porcelain                                # ¿trabajo a medias?
node scripts/agent-state/actualizar.mjs --verificar    # ¿el tablero miente?
```

**Si el tablero y el repositorio no coinciden, gana el repositorio.** Se
regenera con `node scripts/agent-state/actualizar.mjs` y se documenta.

## Paso 3 — detectar unidad incompleta y continuar

Secuencia de V9, en orden y sin saltos:

```
PATIENT-UX-TRUTH-001 → DESIGN-SYSTEM-001 → NAVIGATION-001
→ PATIENT-COMPANION-001 → POSTVISIT-001 → PATIENT-AI-001
→ DOCUMENTS-001 → CLOSED-LOOP-PATIENT-001 → PATIENT-LANGUAGE-001
→ VISUAL-EXCELLENCE-001
```

Una unidad marcada CERRADA con su SHA **no se rehace**. Si hay una a medias, se
termina antes de abrir la siguiente.

## Paso 4 — el ciclo de cada unidad

```
leer las reglas del dominio  (.claude/rules/design-system.md,
                              .claude/rules/patient-facing-ai.md,
                              + las siete que ya existían)
→ auditar con panel de especialistas en paralelo (Agent), y VERIFICAR tú cada
  hallazgo en el código: llegan falsos positivos
→ implementar
→ npx vitest run
→ node scripts/lint-trinquete.mjs        (techo 98, sólo baja)
→ npm run build
→ LANZAR EL PRODUCTO Y MIRARLO           (skill agent-browser, no basta el código)
   · flujo real · móvil · teclado · consola y red · el estado sobrevive
→ commit
→ actualizar LAST_SAFE_CHECKPOINT.md con el SHA
```

## Candados de V9 — no se relajan sin palabra del dueño

**NO** desplegar a producción · **NO** fusionar a `main` · **NO** datos reales de
pacientes · **NO** Stripe productivo · **NO** mensajes reales · **NO** recetas
reales · **NO** migraciones destructivas.

El trabajo autónomo llega hasta **rama + commit**.

## Lo que no cambia nunca

- Ninguna cifra clínica se inventa. Falta → `NEEDS_CLINICAL_REVIEW` y se sigue.
- Hospital y UCI en ALPHA: se usan, **no se venden**, y su incompletitud no
  descuenta a Practice.
- Una interfaz no se aprueba leyendo el código.
- Decisiones reversibles: se toman solo. Decisiones del dueño: se acumulan en
  `agent-state/OWNER_DECISIONS_REQUIRED.md`, no se preguntan de una en una.

## Levantar el producto para mirarlo

```bash
npm run dev        # http://localhost:3000
```

Con la skill `agent-browser`. **Nunca abrir expedientes de pacientes reales**:
sólo estructura, estilos, navegación y estado.
