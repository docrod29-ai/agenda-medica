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

**Escala — ocho pasos** (V9 · `DESIGN-SYSTEM-001`, 9-ago-2026):

| Token | Clase | Tamaño / peso / tracking | Uso |
|---|---|---|---|
| `--fs-display` | `.t-display` | 28px / 600 / -0.03em | Hero, momentos |
| `--fs-h1` | `.t-h1` | 20px / 600 / -0.02em | Título de página |
| `--fs-h2` | `.t-h2` | 16px / 600 / -0.01em | Sección |
| `--fs-body` | `.t-body` | 14px / 400 | Texto base |
| `--fs-dense` | — | 13px | Fila de tabla, chrome denso |
| `--fs-caption` | `.t-caption` | 12px / 500 | Etiquetas, metadatos |
| `--fs-micro` | — | 11px | Sellos, contadores |
| `--fs-overline` | `.t-overline` | 10.5px / 600 / 0.06em / uppercase | Encabezado de grupo |

**Por qué ocho y no seis.** La escala declaraba seis y la aplicación usaba otra cosa: la
auditoría de V9 midió ~3 000 `fontSize` en línea con ~60 valores distintos, y de los cuatro
más frecuentes —13 (538 usos), 12,5 (466), 12 (424), 11 (295)— **dos no estaban en la
escala**. Una escala que la aplicación no usa no es una escala: es un deseo. Se absorben los
dos pasos enteros que faltaban (13 y 11) y se rechazan los medios píxeles.

**Los medios píxeles (12,5 · 13,5 · 11,5 · 14,5) están prohibidos.** No los decidió nadie:
son lo que queda al copiar un bloque y ajustarlo a ojo. Y no sobreviven al redondeo del
navegador con el zoom del sistema al 110 % — la configuración del médico cansado.

---

## 4. Espacio, radio, elevación

Desde V9 · `DESIGN-SYSTEM-001` todo esto es **token**, no prosa. Un valor que sólo vive en
un documento no lo puede usar nadie: hay que acordarse de él.

- **Espacio:** `--sp-1`…`--sp-7` = 4 · 8 · 12 · 16 · 24 · 32 · 48. Densidad de fila: `--sp-3`.
- **Radio:** `--r-control` 6 · `--r-card` 10 · `--r-modal` 14 · `--r-pill` · `--r-circulo`.
  Nada de radios aleatorios, y **nunca `9999` crudo**: para eso está `--r-pill`.
- **Elevación:** plana por defecto. `--sh-overlay` (desplegables) y `--sh-modal` (lo que
  bloquea la página). No hay una tercera. Nada de sombras decorativas en cards.
- **Bordes:** 1px `--border`. El borde define superficie, no la sombra.

---

## 4b. Lo que Tailwind ve — y por qué importa

Hasta V9, `@theme inline` exponía **cuatro** valores. Todo el sistema vivía en variables CSS
que Tailwind no mira, así que no existía `bg-nx-s2` ni `text-nx-caption` y **el código no
tenía alternativa al `style={{ … }}`**: 6 065 estilos en línea en 177 de 200 archivos. No era
dejadez, era mecánica.

Hoy el bloque `@theme inline` de `globals.css` expone el sistema con prefijo `nx-`:

| Familia | Utilidades | Ejemplo |
|---|---|---|
| Color | `bg-nx-*` `text-nx-*` `border-nx-*` | `bg-nx-s2`, `text-nx-text3`, `border-nx-border` |
| Radio | `rounded-nx-*` | `rounded-nx-card` |
| Tipo | `text-nx-*` | `text-nx-caption` |
| Sombra | `shadow-nx-*` | `shadow-nx-modal` |

El prefijo separa lo nuestro de la paleta de Tailwind y deja ver en el `className` que el
valor sigue al tema: `bg-nx-s2` cambia en modo claro, `bg-[#131518]` no.

**Compuerta:** `node scripts/design/trinquete-de-diseno.mjs` cuenta los valores fuera del
sistema (hexadecimales a mano, tamaños fuera de la escala, radios fuera de la escala) en
`src/app/` y `src/components/`. La deuda **sólo baja**, y **un archivo nuevo con deuda falla
siempre** — lo nuevo nace con el sistema; lo viejo se limpia por barrido, no por sorpresa.
Techo en `docs/design/diseno-techo.json`. Lo sella
`src/__tests__/el-diseno-tiene-trinquete.test.ts`.

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
