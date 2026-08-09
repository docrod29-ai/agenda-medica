# Estado del sistema de diseño — V9

**Abierto**: 2026-08-08 · **Unidades**: `DESIGN-SYSTEM-001`, `NAVIGATION-001`,
`VISUAL-EXCELLENCE-001`
**Regla que lo gobierna**: `.claude/rules/design-system.md`

---

## Dónde estamos

**`PATIENT-UX-TRUTH-001` en curso.** Todavía no se ha tocado una sola clase de
CSS, y así debe ser: la instrucción §13 del dueño es explícita — *no empezar por
cambiar colores*. Primero se mide qué hay.

Lo que ya se sabe sin necesidad de auditoría, por conteo directo del repositorio:

| Hecho | Cifra | Por qué importa |
|---|---|---|
| Pantallas (`page.tsx`) | **78** | Un rediseño sin sistema es 78 rediseños |
| Componentes | **81** archivos, ~13 800 líneas | Hay masa suficiente para que la duplicación duela |
| La pantalla de consulta | **5 778 líneas**, un solo archivo | Es la pantalla central del producto y es la más difícil de cambiar sin romper |
| Configuración | 2 605 líneas | Segunda más grande; señal de pantalla sin propósito único |
| Documento de diseño existente | `docs/DESIGN_SYSTEM.md`, **14-jun-2026** | Existe desde hace ocho semanas; falta comprobar si el código lo obedece |

## Lo que NO se ha hecho todavía

- No hay tokens de color verificados como fuente única.
- No hay escala tipográfica ni de espacio verificada.
- No hay capa de primitivas confirmada (`Button`, `Input`, `Card`).
- No hay compuerta de accesibilidad, ni de regresión visual, ni de móvil.
- No hay paleta de comandos `Cmd/Ctrl+K`.

Todo eso son **objetivos de `DESIGN-SYSTEM-001`**, no defectos declarados: hasta
que la auditoría lo confirme con conteos y `file:line`, ninguno está probado.

## Decisiones de diseño ya tomadas (reversibles, mías)

Ninguna todavía. Se registrarán aquí conforme se tomen, con la razón, para que la
siguiente sesión no las re-litigue.

## Decisiones que serán del dueño

Se acumulan en `agent-state/OWNER_DECISIONS_REQUIRED.md`, no se preguntan de una
en una. Candidata previsible: la **identidad visual** de NexusMED (marca, no
tokens) — el dueño pidió «original», y «original» tiene tantas lecturas que
elegir una por él sería adivinar.
