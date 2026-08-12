# V15 §23 — Modelo responsivo por breakpoint

**Fase 9 (`V15-MOBILE-001`), séptima rebanada · 12-ago-2026.**
Cada decisión de este documento está **medida** en navegador real
(`scripts/design/medir-breakpoints-v15.mjs`, 8 anchos, evidencia en
`docs/design/capturas/v15-breakpoints/` y `…/v15-breakpoints-despues/`), no
decidida desde el código. §23 exige que cada breakpoint defina qué persiste,
qué se vuelve contextual, qué colapsa y dónde vive la acción primaria — esto
es esa definición, con la razón de cada corte.

## La frontera es UNA: móvil ≤768 · escritorio ≥769

El lado móvil del shell (topbar, BottomNav, colchones de `main`, hoja del
aviso push, pantalla-lienzo) vive bajo `max-width: 768px`. El lado escritorio
(barra lateral, franja de instrumentos de fila propia) vivía bajo Tailwind
`md:` = `min-width: 768px`: **las dos familias aplicaban a la vez en 768px
exacto**, que no es un ancho teórico — es el ancho CSS de un iPad
Mini/9.7/10.2 en vertical. La radiografía lo midió como el único ancho con
shell híbrido: topbar móvil + franja de escritorio (instrumentos dos veces) +
BottomNav + colchones móviles, con el FlowRail ahogado (su wrapper `md:flex`
encendía pero la regla móvil `.sidebar { display:none }` lo apagaba por
dentro).

Decisión: **768 le pertenece al móvil.** Es coherente con todas las reglas
`max-width: 768px` ya selladas por los guardianes de las rebanadas 1–6, y un
iPad en vertical es un dispositivo de pulgar. Las piezas de escritorio ahora
encienden en `min-width: 769px` vía clases de hoja (`nx-lado-escritorio`,
`nx-franja-escritorio` — guardián:
`src/__tests__/v15-frontera-768-un-solo-shell.test.ts`).

## Los cinco anchos de §23 y qué hace cada uno

Medidos: 390 · 767 · 768 · 769 · 834 · 1024 · 1280 · 1440.

### Teléfono y tablet vertical (≤768) — shell de pulgar

- **Persiste**: topbar de una fila con la **franja de instrumentos como
  centro** (paciente actual GANA a la clínica; grabación con duración) +
  Buscar en el borde derecho (SEARCH/COMMAND al pulgar); **BottomNav** con la
  MISMA IA de 5 contextos que el escritorio (Hoy · Paciente · Encuentro ·
  Seguimiento · Operaciones); el scroll vive en `<main>` (`nx-app-shell`).
- **Contextual**: firmar/cerrar sube al pulgar (`CierreAlPulgar` en
  /consulta); el aviso push es una hoja anclada ENCIMA del BottomNav (z 44 <
  45: si la geometría falla, gana la navegación).
- **Colapsa**: el cajón lateral NO existe en modo médico (retirado, no
  escondido); pistas de teclado de la paleta (`nx-pista-teclado`) ocultas;
  franja de fila propia fusionada en la topbar (jamás dos veces).
- **Acción primaria**: borde inferior, dentro de la zona del pulgar;
  objetivos ≥44px (§24); los modales se vuelven hoja inferior
  (`align-self: flex-end`).
- Pantallas-lienzo (`nx-lienzo-completo`, hoy /chat) llenan el alto del shell
  y neutralizan los colchones de página-documento.

### Frontera 769 y tablet horizontal (769–1024) — shell de escritorio táctil

- **Persiste**: FlowRail (5 contextos, greybox) + franja de instrumentos de
  fila propia; sin topbar móvil ni BottomNav ni colchones móviles.
- **Táctil sin engordar escritorio**: los mínimos de 44px NO dependen del
  ancho aquí — `@media (pointer: coarse)` los aplica en iPad horizontal
  (1024) aunque el shell sea el de escritorio.
- 767→769 medido limpio: un solo shell a cada lado de la frontera, sin
  desborde horizontal en ningún ancho intermedio.

### Laptop (1025–1439) y escritorio ancho (≥1440)

- Mismo shell de escritorio; el canvas activo gobierna el ancho útil y cada
  pantalla decide sus columnas internas (ej. Copiloto junto a los hechos en
  /consulta, lente contextual bajo demanda). Medido sin cambio estructural
  entre 1280 y 1440: no hay un breakpoint extra que documentar hasta que una
  pantalla lo necesite — no se inventan cortes sin un trabajo que los pida.

## Reglas que este modelo deja selladas

1. Un ancho → un shell. Ninguna regla de escritorio del shell usa
   `min-width: 768px` (guardián, caso 5).
2. El lado móvil no se corrió a 767: sigue en `max-width: 768px` (guardián,
   caso 6 — los literales que otros guardianes ya sellan no se reescriben).
3. Los gates de visibilidad viven en la HOJA, nunca inline (lección
   nx-stat-grid, quinta aplicación en esta fase).
4. Táctil por CAPACIDAD (`pointer: coarse`), no por ancho: un iPad horizontal
   es escritorio en layout y táctil en objetivos.
