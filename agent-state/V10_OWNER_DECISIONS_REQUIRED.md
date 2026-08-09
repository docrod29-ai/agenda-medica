# V10 — Decisiones que sólo puede tomar el dueño

| # | Qué | Default recomendado | Riesgo de no decidir | Estado |
|---|---|---|---|---|
| V10-D1 | **Fusionar `claude/nexus-patient-ux-v9` a main** (8 commits: DESIGN-SYSTEM-001, NAVIGATION-001, PATIENT-COMPANION-001, REG-274…281). Está 48 commits detrás; necesita rebase/merge y PR | Abrir PR de esa rama y fusionarla antes de que V10 toque shell, navegación o compañero | V10 construiría encima de un main que no tiene el sistema de diseño real → trabajo duplicado o pisado | ⏳ abierta |

Nada más requiere al dueño hoy. Las decisiones reversibles de diseño las toma
el programa con la jerarquía de V10 §5.
