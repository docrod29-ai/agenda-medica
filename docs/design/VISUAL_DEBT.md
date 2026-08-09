# Deuda visual — V10

> Registro vivo. Cada entrada sigue el ciclo de V10 §9:
> `DETECT → EXPLAIN → REPLACE → TEST → SCREENSHOT → REGRESSION GUARD`.

## Deuda medida (V9, 8-ago-2026 — fuente: `agent-state/DESIGN_STATE.md`)

| Deuda | Magnitud | Estado |
|---|---|---|
| Estilos en línea `style={{` | 6 065 en 177/200 archivos (88,5 %) | abierta — dueño: V10-CONSTITUTION-001, tras fusión V9 |
| Hex a mano | 1 205 (151 distintos) | abierta — ídem |
| `fontSize` en línea | ~3 000, ~60 valores (la escala declara 6) | abierta — ídem |
| Radios en línea | ~19 valores (el sistema declara 3) | abierta — ídem |
| Adopción de `components/ui/` | 48/200 archivos (~24 %) | abierta |
| Tokens visibles para Tailwind | 4 (`@theme inline`) — **causa raíz mecánica** | abordada por DESIGN-SYSTEM-001 (rama V9, sin fusionar) |

## Lo que NO es deuda aquí (para no gastar en fantasmas)

La auditoría V9 midió **cero** degradados, cero `from-purple`, 1 `rounded-2xl`,
1 `shadow-2xl`, 1 `backdrop-blur`: la «cara de producto de IA» de V10 §9 no es
el problema de este repositorio. El problema es la **desobediencia al
sistema** (arriba). No abrir unidades anti-gradiente donde no hay gradientes.

## Entradas nuevas

(se añaden con captura y guardián, nunca sólo con grep)
