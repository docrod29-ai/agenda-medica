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

**Dos azules, y no son intercambiables.** `--nexus` (`text-nexus`) es el azul que
va **como texto** sobre fondo oscuro y por eso está aclarado. `--nexus-solido`
(`bg-nexus-solido`) es el que va **de relleno** bajo texto blanco y por eso está
oscurecido: los requisitos de contraste son opuestos y un solo token no puede
cumplir los dos. El razonamiento completo, con los cocientes medidos, está en
`globals.css` junto a la declaración.

**Cada token tiene su utilidad.** Desde V9 · `DESIGN-SYSTEM-001`, `@theme` expone
los tokens a Tailwind: `bg-s1/s2/s3` · `text-fg/fg2/fg3` · `border-linea/linea2`
· `bg-nexus-solido` · `text-nexus` · `text-error/aviso/exito/info`. Antes exponía
cuatro cosas y el código no tenía alternativa al estilo en línea — de ahí salió
el 88,5 % de archivos con `style={{`.

---

## 3. Tipografía

- **UI / texto:** Geist Sans (grotesque nítida). Tracking ligeramente negativo en títulos.
- **Display / editorial:** Fraunces — SOLO para momentos (hero, citas), nunca en chrome de app.
- **Números clínicos:** `font-variant-numeric: tabular-nums` siempre (dosis, signos, métricas).

**Escala — ocho pasos** (clase `.t-*` para bloques, utilidad `text-*` para casos sueltos):

| Clase | Utilidad | Tamaño | Uso |
|---|---|---|---|
| `.t-display` | `text-display` | 28px / 600 / -0.03em | Hero, momentos |
| `.t-h1` | `text-h1` | 20px / 600 / -0.02em | Título de página |
| `.t-h2` | `text-h2` | 16px / 600 / -0.01em | Sección |
| `.t-body` | `text-body` | 14px / 400 | Texto base |
| — | `text-meta` | 13px | Metadatos densos — **el tamaño más usado del producto** |
| `.t-caption` | `text-caption` | 12px / 500 | Etiquetas |
| — | `text-micro` | 11px | Pie de tabla, sellos |
| `.t-overline` | `text-overline` | 10.5px / 600 / 0.06em / uppercase | Encabezado de grupo |

**13, 12 y 11 px se añadieron el 9-ago-2026** (V9 · `DESIGN-SYSTEM-001`). No son
concesiones: son, por ese orden, los tres tamaños más usados de toda la
aplicación —538, 424 y 295 usos— y ninguno estaba en la escala de seis pasos.
Una escala que deja fuera lo que más se usa no describe el producto: lo declara
fuera del sistema.

**Prohibidos los medios píxeles.** 12,5 · 11,5 · 13,5 · 14,5 · 9,5 suman 907 usos
y no existen: a 1× se redondean, así que 12,5 y 13 pintan lo mismo mientras el
código afirma que son distintos. (Excepción declarada: `.t-overline`, 10,5px, que
ya estaba y cuyo cambio repinta todas las versalitas — deuda de
`VISUAL-EXCELLENCE-001`, no criterio.)

---

## 4. Espacio, radio, elevación

**Rejilla de 2 px.** Los valores geométricos se nombran por su medida —`gap-8px`,
`p-12px`, `rounded-10px`— y no por talla. Es deliberado: quedan ~2 700 valores
en línea por migrar, y `gap: 8` → `gap-8px` se comprueba de un vistazo mientras
`gap: 8` → `gap-sm` obliga a consultar una tabla en cada sitio. La restricción la
impone el trinquete, no el nombre.

- **Espacio:** `2 · 4 · 6 · 8 · 10 · 12 · 16 · 20 · 24 · 32`. Cubre el 81 % de los
  `gap` existentes. *(Antes decía «múltiplos de 4»; el producto nunca lo cumplió
  — `gap: 6` y `gap: 10` suman 533 usos.)*
- **Radio:** `4 · 6 · 8 · 10 · 12 · 14 · 16`, más `rounded-pill` y
  `rounded-circulo`. *(Antes decía «6 / 10 / 14»; `8` se usa tanto como `10`
  —245 veces cada uno— y `12` otras 163, y los tres están en el propio
  `globals.css`.)*
- **Elevación:** plana por defecto. Tres alturas y ninguna más:
  `shadow-realce` (levantar al pasar por encima) · `shadow-menu` (desplegable) ·
  `shadow-modal` (capa completa). Ninguna sombra decorativa en cards.
  *(Había 23 sombras en línea con 21 valores distintos: no era una paleta, era
  ruido con forma de paleta.)*
- **Bordes:** 1px `--border` / `border-linea`. El borde define superficie, no la
  sombra.

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

---

## 9. Qué sostiene este documento

La cabecera dice «si el código contradice esto, el documento gana». Durante
mucho tiempo eso fue una intención sin máquina detrás, y el código ganó 200
archivos seguidos. Desde V9 · `DESIGN-SYSTEM-001` hay tres compuertas:

| Compuerta | Qué impide | Dónde |
|---|---|---|
| **Trinquete de diseño** | Que la deriva crezca; que una pantalla nueva nazca con literales | `npm run diseno:trinquete` · techo en `docs/design/diseno-techo.json` |
| **Trinquete de accesibilidad** | Botón de icono mudo, campo sin etiqueta, `<div onClick>`, `<img>` sin `alt` | `npm run a11y:trinquete` · techo en `docs/design/a11y-techo.json` |
| **Las utilidades llegan** | Que un token declarado no produzca la clase que promete | `scripts/design/verificar-utilidades.mjs` |

Las tres corren en la suite (`el-sistema-de-diseno-se-cumple.test.ts` y
`la-interfaz-se-puede-usar-sin-raton.test.ts`), así que también en CI.

**La regla que muerde: un archivo nuevo nace limpio.** El techo congela la deuda
de lo que ya existía; lo que no estaba en la foto no tiene nada que congelar.

**Lo que ninguna de las tres hace: aprobar una pantalla.** Eso exige lanzar el
producto y mirarlo — regla `.claude/rules/design-system.md`, directiva V9 §4.
Hoy **ninguna pantalla está aprobada**.

### La deuda del día que se puso el trinquete (9-ago-2026)

| Dimensión | Deuda |
|---|---|
| Hexadecimal que ya es un token, reteclado a mano | 251 |
| `fontSize` fuera de escala | 1 198 |
| Radio fuera de escala | 184 |
| Espacio fuera de la rejilla | 940 |
| Sombra en línea | 27 |
| **Total de deriva de diseño** | **2 600** |
| Campo sin etiqueta | 288 |
| `<div onClick>` sin `role` | 13 |
| Botón de icono sin nombre accesible | 11 |
| **Total de deuda de accesibilidad** | **312** |
