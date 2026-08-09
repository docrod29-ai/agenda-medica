# NexusMED — Design System

> Identidad: **técnico-preciso** (referencia: Linear). Sobrio, denso, oscuro por defecto,
> grotesque nítida, acento cobalto usado con intención. Se siente "herramienta de poder".
> Versión 2026.06.14 · viva.

Este documento es la fuente de verdad de la capa visual. Si el código contradice esto,
el documento gana y el código se corrige.

---

## 1. Principios

1. **Identidad antes que adorno.** Cada decisión encoda jerarquía/legibilidad, no gusto.
2. **Tokens, no inline.** Color/espacio/radio/sombra/tipo salen de variables CSS. Cero hex
   sueltos ni px mágicos nuevos en JSX (la migración los va eliminando).
3. **Jerarquía real.** Tres niveles: crítico domina, secundario se atenúa, terciario casi
   desaparece. Tamaño + peso + color encodean importancia.
4. **Densidad clínica.** El médico escanea mucha info. Listas/tablas densas pero legibles,
   números tabulares, line-height controlado.
5. **Motion con significado.** Curva única `cubic-bezier(0.16,1,0.3,1)`. Comunica causalidad,
   no decora. Respeta `prefers-reduced-motion`.
6. **Sin emojis en la UI.** Iconografía lineal consistente (lucide-react, grosor 1.5-2).
   Los emojis SOLO viven en mensajes a pacientes (WhatsApp, portal) donde aportan calidez.

---

## 2. Color (tokens en globals.css)

Oscuro por defecto (`--bg #0B0C0E`), superficies ink, acento cobalto `--nexus #3D5AFE`.
Light mode disponible vía `[data-theme="light"]`. No introducir colores fuera de estos tokens.

| Token | Uso |
|---|---|
| `--bg` | Canvas (fondo de página) |
| `--s1 / --s2 / --s3` | Superficies elevadas (card / hover / activa) |
| `--border / --border2` | Bordes (sutil / énfasis) |
| `--nexus / --nexus-hover / --nexus-soft` | Acento cobalto (acción, foco, selección) |
| `--text / --text2 / --text3` | Texto (primario / secundario / terciario) |
| `--red / --amber / --green` | Semántica (crítico / advertencia / éxito) |

**Regla de acento:** el cobalto se usa para *acción* y *estado activo*, no para decorar.
Una pantalla no debe tener cobalto en 5 lugares sin razón.

---

## 3. Tipografía

- **UI / texto:** Geist Sans (grotesque nítida). Tracking ligeramente negativo en títulos.
- **Display / editorial:** Fraunces — SOLO para momentos (hero, citas), nunca en chrome de app.
- **Números clínicos:** `font-variant-numeric: tabular-nums` siempre (dosis, signos, métricas).

**Escala (utilidades en globals.css):**

| Clase | Tamaño / peso / tracking | Uso |
|---|---|---|
| `.t-display` | 28px / 600 / -0.03em | Hero, momentos |
| `.t-h1` | 20px / 600 / -0.02em | Título de página |
| `.t-h2` | 16px / 600 / -0.01em | Sección |
| `.t-body` | 14px / 400 | Texto base |
| `.t-caption` | 12px / 500 | Etiquetas, metadatos |
| `.t-overline` | 10.5px / 600 / 0.06em / uppercase | Encabezado de grupo |

---

## 4. Espacio, radio, elevación

- **Espacio:** múltiplos de 4 (4, 8, 12, 16, 24, 32). Densidad: paddings de fila 12-13px.
- **Radio:** `6` (controles), `10` (cards), `14` (modales). Nada de radios aleatorios.
- **Elevación:** plana por defecto. Sombra SOLO en overlays (dropdown/modal). Nada de
  sombras decorativas en cards.
- **Bordes:** 1px `--border`. El borde define superficie, no la sombra.

> **Desde REG-291 esto es token, no sólo prosa.** Durante dos meses esta sección
> dijo «múltiplos de 4» y «radios 6/10/14» y **no existía ninguna variable CSS que
> los llevara**, así que no había nada que usar y el código escribía el número a
> mano: 23 valores distintos de `gap`, ~19 de radio, 24 sombras para 28 usos.
>
> | Concepto | Token | Utilidad |
> |---|---|---|
> | Espacio | `--sp-0-5 · --sp-1 · --sp-2 · --sp-3 · --sp-4 · --sp-6 · --sp-8` | `gap-sp3`, `p-sp4`… |
> | Radio | `--r-control · --r-card · --r-modal` (+ `--r-pill`, `--r-circulo`) | `rounded-card`… |
> | Elevación | `--sombra-menu · --sombra-modal` | `shadow-menu`, `shadow-modal` |
> | Tipografía | `--fs-display … --fs-overline` | `text-h1`, `text-cuerpo`… |
> | Aviso en línea | `--warn-bg · --warn-text · --warn-border` | `bg-aviso-fondo`… |
>
> Un token nuevo **no cuenta hasta que `@theme inline` lo expone**: si Tailwind no
> lo ve, la utilidad no existe y el código vuelve al estilo en línea. Lo vigila
> `src/__tests__/un-token-que-no-existe-no-se-calla.test.ts`, que compila este CSS
> de verdad.

---

## 5. Iconografía (reemplazo de emojis)

Set único: **lucide-react**, tamaño 13-16 inline / 18-20 destacado, color heredado o semántico.
Mapa de reemplazo de los emojis actuales:

| Emoji | Icono lucide | Contexto |
|---|---|---|
| 🚨 / ⚠️ | `AlertTriangle` | Alerta crítica / advertencia |
| 🔒 | `Lock` / `ShieldAlert` | Controlado / seguridad |
| 🦠 | `Bug` / `Activity` | PROA / infectología |
| 🩺 | `Stethoscope` | Clínico / receta |
| 💊 | `Pill` | Medicamento / farmacia |
| 📄 / 📋 | `FileText` / `ClipboardList` | Documento / orden |
| 📅 / 🕐 | `Calendar` / `Clock` | Agenda / hora |
| ✅ / ✓ | `CheckCircle2` / `Check` | Éxito / confirmado |
| 🔬 | `FlaskConical` | Entidades / laboratorio |
| 📤 | `Upload` / `Share2` | Exportar / compartir |
| 🩺 (renal) | `Droplet` / `Activity` | Función renal |

**Excepción:** los emojis en plantillas de WhatsApp y el portal del paciente SE QUEDAN
(👋 ✅ 📅 📍 etc.) — ahí son calidez apropiada hacia el paciente, no chrome de app.

---

## 6. Componentes base (objetivo `src/components/ui/`)

A migrar (Fase 2): `Button`, `Card`, `Input`, `Select`, `Table`, `Badge`, `Tabs`, `Modal`,
`EmptyState`, `PageHeader`, `Alert`. Cada uno consume tokens; reemplazan los estilos inline
dispersos. Variantes claras: primario / secundario / fantasma / peligro.

---

## 7. Voz visual

- Sentence case siempre (no Title Case, no MAYÚSCULAS salvo `.t-overline`).
- Lenguaje directo, médico, sin relleno. Botones en imperativo ("Firmar", "Generar receta").
- Vacíos con propósito: dicen qué hacer, no solo "no hay datos".

---

## 8. Anti-patrones (prohibidos)

Emojis en chrome · tarjetas idénticas sin jerarquía · estilos inline nuevos · gradientes/
sombras decorativas · 6+ colores sin sistema · Title Case · botones sin jerarquía clara ·
spacing inconsistente · iconos de distinto grosor/familia mezclados.
