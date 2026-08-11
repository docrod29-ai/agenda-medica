# V15-BASELINE-001 — línea base estructural (BEFORE)

Capturada el 11-ago-2026 · commit base `c98525d` · build de producción +
emuladores demo + siembra sintética (`sembrar-capturas.mjs`). Todo sintético.

## Qué hay en esta carpeta

- `<pantalla>--<desktop|tablet|mobile>.png` — 7 pantallas del golden flow ×
  1440/768/390. Éstas son las fotos contra las que se compara todo lo de V15.
- `axe-baseline.json` — WCAG 2.x AA por pantalla (escritorio).
- `consola-errores--*.json` — errores de consola durante la corrida.

## IA actual, medida en el fuente (`src/components/Sidebar.tsx`)

**23 destinos de navegación primaria** para el médico:

- 21 en `NAV` (Dashboard, Agendar rápido, Citas, Calendario, Consulta,
  Pendientes, Hospitalización, UCI, Consultor IA, Antibiograma, Lista de
  espera, CRM, Reseñas, Reactivación, Chat, Farmacia, Finanzas, Membresías,
  Cumplimiento, Documentos legales, Migración)
- - 2 en «Sistema» (Guía de uso, Configuración).

Contra el objetivo V15: **≤ 5 destinos de médico**. Exceso: ~18.

## Crítica estructural (no de color)

1. **Almacén de funciones, no espacio de trabajo.** Los 23 destinos pesan
   igual: una lista plana módulo-primero (§14 del master loop: FAIL del
   feature-menu test hoy). Clínico y administrativo mezclados: Finanzas,
   Membresías, CRM, Reseñas, Migración conviven con Consulta y Pendientes.
2. **El encuentro no es el centro.** «Consulta» es un destino más de la lista,
   con el mismo peso que «Migración». No hay modo de encuentro: la grabación
   es un añadido dentro de la pantalla, no una transformación de la interfaz.
3. **Fragmentación del flujo.** Nota → receta → órdenes → seguimiento cruzan
   módulos separados (Consulta / Pendientes / farmacia / configuración de
   recetas), cada uno con su propia navegación mental.
4. **Capacidades como destinos.** Antibiograma y Consultor IA son capacidades
   que se usan DENTRO de un trabajo clínico, no lugares a los que se va — pero
   son entradas de primer nivel.
5. **Accesibilidad medible** (axe, escritorio): `calendario` 4 violaciones
   (button-name crítico ×2, color-contrast ×2, nested-interactive ×6,
   target-size ×1); `pacientes` 1 (nested-interactive ×5). El resto 0.
6. **Marca inconsistente**: móvil dice «Agenda Médica», escritorio «Ausculta».

## Métricas base de flujo (observadas en las capturas)

- Siguiente paciente → iniciar consulta: Dashboard → Citas/Calendario →
  paciente → Consulta = 3–4 transiciones de pantalla completas.
- Resultado → decisión: no existe cola de resultados con estado de acción;
  Pendientes es lo más cercano (lista, no cola de cierre).

## Qué sigue (V15-IA-001)

Sitemap nuevo: TODAY · PATIENT · ENCOUNTER · WORK/FOLLOW-UP · SEARCH/COMMAND
como contextos primarios del médico; Operations aparte (Finanzas, Membresías,
CRM, Reseñas, Migración, Cumplimiento, Legal, Configuración); capacidades
(Antibiograma, Consultor IA, Farmacia) contextualizadas dentro del trabajo.
Plan de compatibilidad de rutas: las URLs viejas siguen vivas.
