# V10 — Interfaces clínicas líderes, medidas

**Fecha:** 2026-08-09 · **Ámbito:** Suki AI · Abridge · Freed AI · Nabla Copilot · Heidi Health
**Propósito:** sustituir «se ve genérico» por conteos con origen. Nada de calcar: extraer principios.

---

## Método, y sus límites

**Lo que hice** (todo reproducible):

1. Descargué el HTML de los cinco sitios públicos y **todas** sus hojas de estilo (11 archivos CSS,
   ~2.7 MB) con `curl`.
2. Escribí un analizador (`analyze.py`) que cruza las clases **realmente presentes en el DOM**
   contra las reglas CSS, y sólo cuenta declaraciones de reglas aplicables. Esto evita el error
   clásico de medir Webflow/Tailwind: sus hojas traen miles de reglas muertas.
3. Extraje los `@font-face`, los archivos `.woff2/.otf` servidos, y las variables CSS de tema.
4. Descargué las capturas **reales de producto** de la App Store vía `itunes.apple.com/lookup`
   (31 capturas) y las imágenes de producto de los propios sitios, y las miré una por una.

**Lo que NO pude medir, y por tanto no afirmo:**

- **Estilos computados en navegador vivo.** No tuve herramientas de navegador en esta sesión. Los
  hexadecimales de abajo salen de los tokens y reglas CSS, no de `getComputedStyle`. Cuando digo
  «el fondo es X» y viene de una captura, lo marco como *observado en captura*.
- **Cualquier pantalla tras autenticación.** Ninguno de los cinco expone su app sin cuenta.
- **Animación y microinteracción.** Las duraciones/curvas reales sólo se ven en ejecución. Sólo cito
  los tokens de transición cuando están declarados.
- **Suki en profundidad de producto.** Su sitio es fotografía documental; el producto sólo se ve en
  4 capturas de App Store. Es la evidencia más delgada de las cinco.

**Etiquetas que uso:** `[CSS]` medido en hoja de estilo · `[DOM]` contado en el HTML servido ·
`[CAPTURA]` observado en imagen de producto · `[INFERENCIA]` deducción mía, no medición.

---

## 1. Suki AI — el minimalismo tipográfico

### Tipografía

`[CSS]` Dos familias propias, ninguna del sistema:

| Familia | Archivos servidos | Uso |
|---|---|---|
| **ABC Monument Grotesk** (Dinamo) | Regular 400, Medium 500, Bold 700 + las 3 itálicas — `woff2` + `woff` | Todo |
| **General Grotesque** | Demi + DemiItalic | Declarada, **0 usos** en la portada |

`[DOM]` `font-monument` aparece **84 veces**; `font-general-grotesque`, **0**. Una sola familia hace
el trabajo entero.

`[CSS]` La escala **no** es `text-sm/base/lg`. Es semántica y fluida (`clamp()` entre 375 y 1600 px):

| Token | Tamaño | Peso | Interletra | Interlínea |
|---|---|---|---|---|
| `title-100` | 48 → 80 px | 600 | **−0.04em** | 1.1 |
| `title-80` | 36 → 60 px | 600 | −0.04em | 1.1 |
| `title-60` | 28 → 48 px | 600 | −0.04em | 1.1 |
| `title-40` | 24 → 32 px | 600 | −0.04em | 1.2 |
| `title-20` | 20 → 24 px | 600 | −0.04em | 1.2 |
| `subtitle-20` | 18 → 21 px | 400 | 0 | 1.4 |
| `body-20` | 16 → 18 px | 400 | normal | 1.4 |
| `body-10` | 14 → 16 px | 400 | normal | 1.4 |
| `button-20` | 14 → 16 px | 500 | −0.01em | 1 |
| `caption-10` | 12 px | 500 | **+0.05em** | 1 |

Dos reglas duras: **los títulos siempre aprietan (−0.04em), los cuerpos nunca**; y el único estilo
con interletra positiva es el `caption`. Sólo 4 pesos existen: 400/500/600/700.

### Paleta

`[CSS]` **19 colores en total.** El sistema entero:

- Neutros: `black #1b1b1b` · `white #fff` · `offwhite #fffbf0` · `gray-60 #d1d1d1` · `gray-80 #959595` · `gray-90 #646464`
- Amarillo (acento): `60 #fff9da` · `80 #fff394` · `100 #ffe148`
- Menta: `60 #d8f4e6` · `80 #9de4bf` · `100 #3fb679`
- Azul: `60 #d1eeff` · `80 #ade1ff` · `100 #4fb3ee`
- Rojo: `60 #ffe4e9` · `80 #ffb9c5` · `100 #e6506c`
- Funcional: `error #c52a41`

**Tres grises. Cero morados. El negro no es negro** (#1b1b1b) y **el blanco de lienzo es crema**
(#fffbf0). Cada hue tiene exactamente 3 pasos: 60 (fondo), 80 (borde), 100 (sólido).

`[DOM]` Reparto real de color en la portada: `bg-black` 96 · `text-black` 47 · `border-black` 17 ·
`bg-white` 16 · `bg-yellow-100` **15** · `text-gray-90` 14 · `bg-gray-60` 12. El acento amarillo
aparece 15 veces sobre ~190 aplicaciones de color: **~8%**.

### Densidad y layout

`[DOM]` Los números que importan:

- **Sombras: 0.** Cero clases `shadow-*` en toda la portada.
- **Radios: 23 en total** — 15 `rounded-full` (píldoras y avatares) + 8 `rounded` (4 px). Nada de
  `rounded-2xl` por defecto.
- **Degradados: 3.**
- **Navegación: 4 destinos** (`/solutions/`, `/clinicians/`, `/partners/`, `/about/`).
- Rejillas explícitas de 12, 8, 6, 4 y 3 columnas; ancho máximo de maquetación 1600 px.

La separación se hace con **borde negro de 1 px** (`border-black`, 17 usos) y con aire, no con
elevación.

### El momento del dictado

`[CAPTURA]` La app es deliberadamente sosa, y ese es el punto:

- Pantalla de inicio: lista blanca con `Recent Notes` / `Today's Schedule` / `Start a visit`. Filas
  densas (nombre · motivo truncado · hora), **sin tarjetas**.
- El botón primario `Start Ambient` es una **píldora amarilla** — el amarillo sólo se gasta ahí.
- Flotando abajo, una cápsula negra con una forma de onda blanca: el control de voz.
- En la nota, cada problema numerado lleva su **código ICD alineado a la derecha** (`ICD E11.9`,
  `ICD I10`, `ICD M10.07`) en una pastilla pálida. La codificación vive dentro de la prosa, no en
  otra pantalla.
- El otro botón amarillo es `Send`. **Dos acciones amarillas por pantalla, como mucho.**

### Qué NO hacen

- No enseñan capturas de producto en la portada: **fotografía documental** de clínicos reales.
- No usan sombras. No usan glass. No usan degradado de marca.
- No tienen escala tipográfica genérica: no existe `text-base`.
- No tienen 12 grises.

---

## 2. Abridge — el color como modo, no como decoración

### Tipografía

`[CSS]` **Avantt** (Displaay) en **8 pesos** servidos: Thin, Light, Regular, Medium, SemiBold, Bold,
ExtraBold, Heavy. `--_font---font-family--primary-font: Avantt, Arial, sans-serif`. Además una
fuente-icono propia, `Abridge Font` (.otf).

`[CSS]` Aunque cargan 8 pesos, los tokens sólo usan **tres**: 400, 500, 600. Los títulos van en
**500 (Medium)**, no en bold.

Escala (móvil → escritorio), toda con `line-height` menor que 1:

| Token | Tamaño | Peso | Interletra | Interlínea |
|---|---|---|---|---|
| `headline-large` | 2.25 → **5.25 rem** | 500 | −0.04em | **0.95** |
| `headline-medium` | 2 → 4.5 rem | 500 | −0.04em | 0.95 |
| `headline-small` | 1.625 → 3.625 rem | 500 | −0.03em | 1 |
| `body-medium` | 0.875 → 1.25 rem | 500 | 0 | 1.28 |
| `body-small` | 0.875 → 1 rem | 400 | 0 | 1.3 |
| `label-step` | 0.75 → 1 rem | 500 | **+0.1em** | 1.16 |
| `navigation` | 0.75 → 1 rem | 500 | −0.01em | 1 |

Mismo patrón que Suki: títulos apretados, y **un solo** estilo con interletra abierta (`label-step`,
para numerar pasos).

### Paleta

`[CSS]` Rampa de **gris cálido**, no neutro:

`5 #fbf9f6` · `10 #f7f2ed` · `20 #eee5dd` · `30 #d5cbc0` · `50 #a7988a` · `60 #6d645a` ·
`80 #393633` · `90 #242220` · `100 #141312`

Acento **rojo cadmio**: `30 #ffa996` · `50 #ff5832` · **`55 #ea2c00` (primary)** · `60 #c02907` ·
`90 #440c00`. Secundarios: rosa `#ffd5cc`, azul pizarra `#76a8f4`.

Las transparencias también son cálidas: `--_colors---transparent--warm-15: #a7988a26` — el velo gris
es *beige* al 15%, no negro.

`[CSS]` Encima hay una **capa semántica al estilo Material 3**, y es lo verdaderamente copiable:

```
surface · surface-container · surface-container-high · surface-container-highest
on-surface · on-surface-variant
primary · on-primary · primary-container · primary-dim
secondary · on-secondary · secondary-container · secondary-dim
outline · outline-variant · outline-focus
overlay · overlay-variant
emphasis-primary · emphasis-secondary
button-primary/secondary/tertiary × {background, border, text} × {normal, hover}
```

Cada nombre tiene valor **claro y oscuro**. `outline-focus` = el rojo primario: **el foco usa el
color de marca**, no un azul de navegador.

`[CSS]` Tema por defecto: **claro.** `:root { --_theme---surface--surface: white }`. El oscuro es
`.u-theme-dark`, un modificador de sección — `[DOM]` usado en **4 elementos** de la portada.

### Densidad y layout

`[CSS]` Radios: `0 · 2 · 4 · 8 · 12 · 20 · 24 px · full`. **`radius--primary = 8 px.`** El radio por
defecto del producto es 8, no 16 ni 24.

`[CSS]` Sombras en reglas aplicables: **3 son `box-shadow: none`** y la única real es
`box-shadow: 0 0 0 1px var(--outline-variant)` — es decir, **un anillo de 1 px, no una elevación**.
Abridge separa con borde. `[DOM]` Navegación: 15 destinos (es un sitio empresarial, no una app).

### El momento del dictado — lo mejor de las cinco

`[CAPTURA]` **Grabando, la pantalla entera se vuelve roja.** No un punto rojo en una barra: el
viewport completo en `#ea2c00`, con una forma de onda blanca gigante y abstracta ocupando el centro,
el nombre del paciente arriba, una `X` para salir, y abajo el texto «Your conversation will be
summarized.» más el botón de parar. Se ve desde el otro lado de la sala que está grabando.

`[CAPTURA]` En escritorio, la misma idea comprimida: una **única píldora roja** flotando al pie con
onda en vivo + `0:05` + pausa. Es el **único** elemento saturado de toda la pantalla.

`[CAPTURA]` **El color señala el modo, y hay tres:**

| Modo | Lienzo | Señal extra |
|---|---|---|
| Leyendo / inactivo | crema `#fbf9f6` | tarjetas blancas, borde cálido, sin sombra |
| **Grabando** | **rojo a sangre** | onda gigante + temporizador |
| **Editando por voz** | **azul pálido** | tarjeta con borde azul y **el texto nuevo en negrita** |

`[CAPTURA]` Dos patrones más que valen su peso en oro:

- **Los temas de conversación se tachan solos** conforme la consulta los cubre. La lista
  «Discussion topics» pasa de negro a gris tachado en vivo. El médico ve qué le falta preguntar sin
  leer nada.
- **Procedencia como botón:** bajo el resumen del paciente hay una píldora con contorno,
  `▤ 8 Sources`. La cifra de fuentes es un control, no una nota al pie.

`[CAPTURA]` La nota terminada se presenta como **documento**: `Assessment & Plan` en negrita, problema
numerado en negrita, prosa, viñetas. Ancho de medida corto, interlínea generosa, texto negro sobre
crema. Ni una etiqueta de color, ni un chip, ni una insignia. El borde superior se **desvanece con
máscara** al hacer scroll bajo la cabecera.

### Qué NO hacen

- No usan gris neutro: **todo el gris está sesgado a cálido**.
- No usan sombras para agrupar: usan anillos de 1 px.
- No ponen el acento en más de un sitio por pantalla.
- No marcan la nota con colores por sección.
- No usan bold para los titulares (van en Medium 500).

---

## 3. Freed AI — el contraejemplo útil

Freed es el producto de los cinco que **sí** tiene la estética que el dueño rechaza. Vale documentarlo
para saber qué se está evitando.

### Tipografía

`[CSS]` `--font-family--heading: kit-rounded, sans-serif` (una grotesca redondeada servida por Adobe
Typekit) y `--font-family--body: Inter, Arial, sans-serif`. Sirven Inter en v18 y v20, pesos 400–800
más itálicas. **Inter es la única fuente de cuerpo del grupo que es la opción por defecto de la
industria.**

### Paleta

`[CSS]` Morado como marca: `#6a3cdf` (base) · `#9166ff` (claro) · `#4d2ba1` (oscuro) · `#301574`
(más oscuro) · `#4c1db9`. Neutros `#212121` / `#f7f7f7`. Verde `#62e774`, naranja `#ff7a14`.

### Densidad

`[CSS]` Radios: `xsmall .25rem · small .5rem · primary 1rem · large 1.5–2rem · xlarge 2–3rem ·
xxlarge 3–4rem · full-circle 1000000px`. **El radio por defecto es 16 px** (el doble que Abridge), y
además hay radios **relativos al viewport** (`1vw`, `1.5vw`, `2vw`, `3vw`).

`[CSS]` Glassmorphism explícito y tokenizado: `--_theme---glass--glass-highlight-90`,
`--_theme---bubble--inner-highlight-strong`, `--_theme---elevation--secondary`; sombras de hasta
**seis capas** con `inset` para simular vidrio y neumorfismo:

```
box-shadow: inset .848px 1.696px 1.696px #ffffff80,
            inset 3.9px 3.561px 6.172px #0000000d,
            inset -1.24px -2.24px … ;
```

### Y sin embargo: su producto es sobrio

`[CAPTURA]` La nota real de Freed **no tiene nada de eso**: negro sobre blanco, Inter, secciones SOAP
como **filas plegables** con triángulo (`▾ Subjective` abierta, `▸ Objective` y `▸ Assessment & Plan`
cerradas), y en la cabecera de cada sección tres iconos: **👍 / 👎 / copiar**. Retroalimentación y
copiado **por sección**, no por nota.

**Lección:** el marketing morado y el producto sobrio conviven. No confundir la portada de un
competidor con su interfaz. Y aun así, Freed es el único cuyo *producto* no tiene una identidad
visual propia.

---

## 4. Nabla Copilot — verde clínico y sombras casi invisibles

### Tipografía

`[CSS]` Familias aplicadas en reglas vivas: **Neue Montreal** (`Neuemontreal`, 4 reglas),
**Euclid Circular B** (3), **Saans** (1) y `Saans Trial` (1). Los archivos servidos incluyen
PP Neue Montreal, Saans, **SeasonSans TRIAL**, **SeasonMix TRIAL**, Euclid Circular B y **Coranto W01**
(una serif).

`[INFERENCIA]` La presencia simultánea de licencias *TRIAL* y de las definitivas sugiere un
rebranding tipográfico en curso (de Euclid/Neue Montreal hacia Saans/SeasonSans). No lo doy por
hecho.

### Paleta

`[CSS]` Verde azulado, ningún morado en el sistema de marca:

`green #b5f3de` (menta) · `green-black #0d7868` · `green-base #187d8b` · `green-leaf #4d9b7a` ·
`green-link #569580` · `green-span #1ad2b0` · `green-dark #204444` · `dark-crayola #004854` ·
`dark-prismarine #03241d` · `prismarine #233c38` · `jade #d5e9e5` · `porcelaine #edf2f3`

Neutros: `black-nabla #1c1c1e` · `davy-grey #525b59` · `grey #6d7881`. Texto tokenizado en
`text--primary / secondary / tertiary`.

### Densidad

`[CSS]` Sombras aplicadas, todas casi imperceptibles:

```
0 1px 2px #1c1c1e0d, 0 2px 12px #1c1c1e0d   /* 5% y 5% */
0 3px 6px -2px #212a2f14                     /* 8% */
0 4px 34px #43788014                         /* 8%, tintada de verde */
```

Ninguna pasa del 8% de opacidad, y la de mayor radio está **teñida del color de marca**, no de negro.
Radios: 5 px, 8 px, 10 px, .5rem, .75rem, 1rem, y píldora.

`[DOM]` La `<nav>` sólo contiene **2 destinos de producto**: `/dictation` y `/coding`.

### El momento del dictado

`[CAPTURA]` La nota móvil: blanco, cabecera mínima (hamburguesa · `Encounter` · `+`), y las secciones
del documento como **encabezados en VERSALITAS, con interletra abierta y en color** —
`CHIEF COMPLAINT`, `HISTORY OF PRESENT ILLNESS`, `PAST MEDICAL HISTORY`, `MEDICATIONS`, `ALLERGIES` —
con el cuerpo en negro plano y viñetas. Sin tarjetas, sin separadores, sin insignias.

Es la solución más barata y más efectiva del grupo para dar jerarquía a una nota clínica larga: **el
color y las versalitas viven en la etiqueta de sección, nunca en el contenido clínico.**

---

## 5. Heidi Health — el sistema más completo, y el más cercano a lo que necesitamos

### Tipografía

`[CSS]` Cuatro familias, cada una con un trabajo:

| Variable | Familia | Papel | `[DOM]` usos |
|---|---|---|---|
| `--font-inter` | **Inter** | interfaz y cuerpo | 56 |
| `--font-exposure` | **exposure** — *serif* (respaldo Georgia / Times New Roman) | títulos y momentos editoriales | 15 |
| `--font-ibm-plex-mono` | **IBM Plex Mono** | datos / monoespaciado | — |
| `--font-japanese` / `--font-arabic` | **Noto Sans JP** (496 `@font-face`) y **Noto Sans Arabic** (20) | i18n | — |

**La única de las cinco que empareja una serif con la sans**, y la única que trae el i18n resuelto en
el sistema de fuentes en lugar de bifurcado por país.

`[CSS]` Métricas globales, y son agresivas:

```
--heading-letter-spacing: -0.05em
--body-letter-spacing:    -0.03em      ← también el cuerpo aprieta
--body-line-height:       140%
```

| Token | Móvil → escritorio | Interlínea |
|---|---|---|
| `heading-1` | 3.25 → 4.5 rem | 100% |
| `heading-2` | 2.5 → 3.5 rem | 100% |
| `heading-3` | 2.25 → 3 rem | 110% |
| `heading-4` | 2 → 2.5 rem | 110% |
| `heading-5` | 1.5 → 2 rem | 120% |
| `heading-6` | 1.25 → 1.5 rem | 125% |

La interlínea **crece** conforme el texto se hace pequeño (100% → 125%). Es lo correcto y casi nadie
lo hace.

### Paleta

`[CSS]` Cinco rampas propias, todas sesgadas a cálido, más semánticos:

- **bark** (marrón rosado, el color de texto y de marca): `25 #fbf9fa` · `50 #f4f0f2` · `100 #e9e2e3` ·
  `200 #d4c4c9` · `300 #c39da8` · `400 #a98993` · `500 #8a7078` · `600 #755760` · `700 #5b3e47` ·
  `800 #4c2934` · `900 #28030f` · `950 #211217`
- **sand** (los lienzos): `25 #fcfaf8` · `50 #f9f4f1` · `75 #f6efea` · `100 #f6ece4` ·
  **`150 #f4e7dd`** · `200 #f0dfd1` · `300 #ecd7c6` · `400 #e2cab6` · `500 #dabfa9` · `600 #d1af94`
- **forest**: `50 #f2f7f2` … `700 #2b6433` · `800 #194b22` · `950 #0a1e0d`
- **sky**: `25 #ebf2ff` … `500 #5b8df6` · `700 #2255c3` · `950 #03194a`
- **sunlight**: `50 #fefde8` · `300 #fdf444` · `500 #ccc200` … `950 #2e2c05`

`[CSS]` **Estado clínico y de producto, tokenizado con tres piezas cada uno** (base · *muted* · *hover*):

```
danger   #dc2626   danger-muted   #fee2e2   danger-hover   #b91c1c
warning  #ea580c   warning-muted  #ffedd5   warning-hover  #c2410c
success  #16a34a   success-muted  #dcfce7   success-hover  #15803d
pro      #978aea   pro-muted      #e4e1fa   pro-hover      #7e70db
practice #ea8743   practice-muted #f9dfcd   practice-hover #d46d25
```

El patrón `base / muted / hover` es exactamente lo que falta para pintar una alerta clínica legible:
el `muted` es el fondo, el `base` el texto o el borde. Nótese que **el morado (`pro`) existe pero está
reservado para el nivel de suscripción**, no para el producto.

`[DOM]` El lienzo dominante de la portada es `bg-sand-150` = **`#f4e7dd`**, con **36 usos** — arena
cálida, ni blanco ni oscuro. `bg-white` aparece 2 veces.

### Densidad y layout

`[CSS]` Radios: `xs 4 · sm 6 · md 8 · lg 12 · xl 16 · 2xl 24 · 3xl 36 px`.

`[DOM]` Y su uso real es el dato más útil de todo este informe:

| Clase | Usos |
|---|---|
| `rounded-lg` (12 px) | 50 |
| **`rounded-none`** | **46** |
| `rounded-md` (8 px) | 36 |
| `rounded-2xl` (24 px) | 8 |
| `rounded-3xl` (36 px) | 7 |

**Casi un tercio de las esquinas son cuadradas a propósito**, y el 87% de las redondeadas usan 8–12 px.
Los radios grandes (24–36 px) se reservan para el borde donde una superficie se encuentra con otra.

`[CSS]` Sombras: **8 en toda la portada** (5 `shadow-xs`, 1 `sm`, 1 `md`, 1 `lg`). Y el detalle fino:

```
--shadow-color: 120 90 60;                              /* marrón cálido, NO negro */
--shadow-xs: 0 1px 3px 1px rgb(var(--shadow-color)/.06),
             0 1px 1px 0   rgb(var(--shadow-color)/.03);
```

**La sombra está teñida de cálido y va al 3–6%.** Es lo que hace que una interfaz clara no parezca
plástico.

### El momento del dictado

`[CAPTURA]` **Escritorio** (interfaz observada **en español**, ya localizada):

- **Riel izquierdo de iconos, sin etiquetas, 5 destinos**: logotipo · `+` (nuevo, cuadrado relleno en
  bark oscuro) · onda (activo, relleno en arena) · microscopio · teléfono. El estado activo es un
  **cuadrado relleno de arena con radio ~12 px**, no un subrayado ni un color de texto.
- La superficie de trabajo es **blanca con una esquina superior izquierda muy redondeada**, apoyada
  sobre el lienzo de arena. **No es una tarjeta flotante**: es una superficie continua anclada al riel.
- Miga de pan `Ⓐ Mario Sainz › Síntomas de resfriado y gripe`: **paciente › encuentro**.
- Debajo, los documentos derivados como **pestañas-píldora**: iconos circulares con contorno y una
  sola píldora **rellena** (`✎ Nota clínica`) + `+`. Sólo lo activo lleva relleno.
- Arriba a la derecha: selector de micrófono con onda **verde** y el botón primario **`Transcribir`**
  en verde sólido con menú partido.
- El cuerpo de la nota es **texto plano**: `Subjetivo`, `Objetivo`, `Valoración/Investigaciones:` como
  etiquetas en negrita y viñetas. **Cero tarjetas dentro de la nota.**
- Las sugerencias de la IA flotan a la derecha como tarjetas blancas con: un **chip de categoría**
  (`🔗 Solicitar` en rosa, `✳ Acción` en azul), un **icono de onda** para oír el momento del audio del
  que salió, un **círculo de aceptación** y la acción en tipo grande
  («Prescribir amoxicilina a dosis altas», «Seguimiento del paciente en 48 horas»).
- Abajo, un **compositor persistente**: `Investiga, escribe o edita cualquier cosa…` con `+`,
  `⇶ Fuentes`, micrófono y botón de envío. Está en **todas** las pantallas.

`[CAPTURA]` **Procedencia**, y es el mejor tratamiento visto:

- Una franja discreta sobre el contenido: `⚡ 27 fuentes utilizadas: Directrices clínicas e
  investigación primaria`.
- **Chips de cita en línea** dentro del párrafo (`BMJBestPractice`), con contorno fino.
- Al posarse, una **tarjeta de cita** con el logotipo de la revista (BMJ), título, año, extracto, y
  una **insignia de fiabilidad** — `Altamente confiable` — como píldora verde sólida.

`[CAPTURA]` **Grabando** (móvil): fondo claro, selector de fuente arriba (`🎙 Kate's Airpods ⌄`),
control segmentado **`Transcribir | Dictate`**, y en el centro un **botón circular verde grande con
pausa, rodeado de anillos concéntricos** que laten con la amplitud. Al pie: `⏱ 0:02:24 ●` (punto rojo)
y el nombre del paciente. **Un solo control domina la pantalla.** Todo lo demás desaparece.

`[CAPTURA]` **La sesión sobrevive**: en la nota hay una píldora `⏵ Resume` al pie — la grabación se
reanuda. Y en la lista de sesiones, una fila de estado: `⊕ 1 session waiting to be uploaded`, con el
lema «Stay productive — even without internet». **La persistencia es interfaz visible, no un detalle
de implementación.**

`[CAPTURA]` **Móvil: 2 destinos** en la barra inferior — `Scribe` y `Evidence`. Las sesiones son filas
densas con avatar circular de iniciales en color, `Sarah Stevenson 35F` y una segunda línea
`3:00pm · Endometriosis check-up`. La nota tiene pestañas horizontales:
`…note | Transcript | SOAP note | Referral letter | +` — **un encuentro, muchos documentos derivados**.

### Qué NO hacen

- No usan blanco puro como lienzo (usan arena `#f4e7dd`).
- No usan sombra negra: la tiñen de marrón y la bajan al 3–6%.
- No redondean por defecto: 46 esquinas cuadradas explícitas.
- No ponen etiquetas en el riel de navegación.
- No meten la nota clínica en tarjetas.
- No usan el morado para nada clínico (lo reservan al plan de pago).

---

## Cuadro comparativo

| | Suki | Abridge | Freed | Nabla | Heidi |
|---|---|---|---|---|---|
| **Sans** | ABC Monument Grotesk | Avantt | Inter | Neue Montreal / Euclid / Saans | Inter |
| **Display** | — | — | kit-rounded | (Coranto, serif, presente) | **exposure (serif)** |
| **¿Fuente por defecto?** | No | No | **Sí (Inter)** | No | Parcial |
| **Pesos en uso** | 400/500/600/700 | **400/500/600** | 400–800 | n/m | 400/500/600 |
| **Interletra de título** | −0.04em | −0.04em | n/m | n/m | **−0.05em** |
| **Lienzo por defecto** | crema `#fffbf0` | crema `#fbf9f6` | blanco/morado | blanco | **arena `#f4e7dd`** |
| **Tema por defecto** | claro | **claro** | claro | claro | claro |
| **Acento** | amarillo `#ffe148` | rojo `#ea2c00` | morado `#6a3cdf` | verde `#0d7868` | bark + verde |
| **¿Morado?** | no | no | **sí** | no | sólo para el plan «pro» |
| **Temperatura del gris** | cálida | **cálida** | neutra | fría-verdosa | **cálida** |
| **Radio por defecto** | 4 px | **8 px** | 16 px | 5–8 px | 8–12 px |
| **Sombras (portada)** | **0** | anillo 1 px | multicapa + glass | ≤8% opacidad | 8, al 3–6%, cálidas |
| **Destinos de nav** | 4 | 15 (sitio empresarial) | 7 | 2 | 5 escritorio / **2 móvil** |
| **Grabando =** | cápsula negra | **pantalla roja entera** | n/m | n/m | **botón verde + anillos** |

---

## Principios extraíbles

No son elementos a calcar. Son las decisiones que los cinco (o los cuatro buenos) comparten.

### P1 — El lienzo es cálido, y el tema por defecto es claro

Los cinco arrancan en claro. Cuatro de cinco tienen el gris sesgado a cálido: `#fffbf0`, `#fbf9f6`,
`#f4e7dd`. Ninguno usa blanco puro de lienzo, y **ninguno usa un casi-negro como estado por defecto**.
El casi-negro frío es precisamente la marca de la interfaz de IA de 2024.

### P2 — El acento se gana el derecho a aparecer

Suki gasta amarillo en el **8%** de sus aplicaciones de color, y en producto sólo en dos botones por
pantalla. Abridge deja el rojo para **un único elemento**: el control de grabación. Si el acento está
en el botón, en el icono, en el borde y en el título, deja de significar algo.

### P3 — Grabar es un **modo**, no un indicador

Abridge vuelve la pantalla entera roja. Heidi la vacía hasta dejar un botón verde con anillos que
laten. Ambos comunican lo mismo: *ahora mismo esto está escuchando, y no estás haciendo otra cosa*.
El punto rojo de 8 px en una barra de herramientas es la solución equivocada a un momento que es
clínica y legalmente el más delicado del producto.

### P4 — La nota es un documento, no un formulario

Ninguno de los cuatro buenos mete la nota en tarjetas. Abridge la compone como prosa con viñetas;
Nabla le da jerarquía con **versalitas en color en la etiqueta de sección** y deja el contenido en
negro; Heidi usa etiquetas en negrita y nada más; Freed la pliega por secciones. La medida es corta,
la interlínea generosa, y **el color no toca el texto clínico**.

### P5 — La procedencia es un control, no una nota al pie

`▤ 8 Sources` en Abridge es un botón. En Heidi hay tres capas: recuento de fuentes arriba, chip de
cita en línea, y tarjeta al posarse con revista, año, extracto y **calificación de fiabilidad**. Y
cada sugerencia lleva un **icono de onda para oír el segundo del audio del que salió**. Esto es
exactamente PROCEDENCIA — y confirma que REG-213/REG-250 va en la dirección correcta; lo que falta es
**forma estable y visible**, no la capacidad.

### P6 — La reversibilidad se ve

Abridge pinta el texto recién dictado en **negrita** sobre el existente, y cambia el lienzo a azul
mientras edita por voz. Heidi presenta cada sugerencia con un **círculo de aceptación** — nada entra
en la nota sin un acto explícito. Freed pone 👍/👎/copiar **por sección**. Ninguno aplica correcciones
en silencio.

### P7 — Separar con borde y con aire, no con sombra

Suki: **cero sombras**, 17 bordes negros. Abridge: la única sombra real es un anillo de 1 px. Heidi:
8 sombras al 3–6% **y teñidas de marrón**. La sombra a 15% de negro sobre tarjeta redondeada es la
firma del SaaS de plantilla.

### P8 — Radio pequeño por defecto, grande sólo donde una superficie encuentra a otra

`radius--primary` de Abridge = **8 px**. En Heidi el 87% de las esquinas redondeadas son de 8–12 px, y
**46 son cuadradas a propósito**. Los 24–36 px se reservan para el encuentro entre superficies (la
esquina donde el lienzo de arena se topa con la superficie blanca de trabajo).

### P9 — La escala tipográfica es semántica y fluida, no `sm/base/lg`

Suki: `title-20…100`, `body-10/20`, `caption-10`, `tag-10`, todo en `clamp()` de 375 a 1600 px.
Abridge: `headline-*`, `body-*`, `label-step`, `label-eyebrow`, `number-stat`. Heidi: `heading-1…6`
con interlínea que **crece** al bajar de tamaño. Un token de texto lleva dentro su tamaño, su peso,
su interlínea y su interletra: se aplica uno, no cuatro.

### P10 — Los títulos aprietan, los cuerpos respiran

−0.04em (Suki, Abridge) y −0.05em (Heidi) en títulos; y **un solo** estilo con interletra positiva en
todo el sistema, siempre una etiqueta pequeña (`caption-10` +0.05em, `label-step` +0.1em). Es la
diferencia entre tipografía dibujada y tipografía por defecto.

### P11 — El estado clínico se tokeniza en tres piezas

Heidi: `base / muted / hover` para `danger`, `warning`, `success`. El `muted` (`#fee2e2`, `#ffedd5`,
`#dcfce7`) es el fondo; el `base` es el texto y el borde. Sin ese par no se puede pintar una alerta
que además cumpla contraste AA.

### P12 — Pocos destinos, y el activo se rellena

Suki: 4. Nabla: 2. Heidi: 5 en escritorio (riel de iconos sin etiquetas) y **2 en móvil**. El estado
activo en Heidi es una **forma rellena**, no un color de texto ni un subrayado — se ve de reojo.

### P13 — La persistencia es interfaz

`⏵ Resume` para reanudar la grabación. `⊕ 1 session waiting to be uploaded` como fila visible. Heidi
convierte la promesa «no pierdes lo dictado» en dos elementos que se ven. Un médico que ya dictó y
perdió lo dictado no vuelve a confiar; decirlo en la interfaz vale más que garantizarlo en el backend.

### P14 — Un encuentro, muchos documentos derivados, en pestañas

`Transcript | SOAP note | Referral letter | +` (Heidi). El dictado es la fuente y las notas son
proyecciones. NexusMED ya tiene esta arquitectura (`procesarIA(tipoOverride)`); **no está expresada en
la interfaz**.

---

## Espejo: qué mide NexusMED hoy

Medido en este repositorio, para que la comparación no sea una impresión.

**Lo que el enunciado daba por hecho y NO es cierto:**

| Afirmación | Medición |
|---|---|
| «degradados morados por todas partes» | **0** ocurrencias de `bg-gradient-to-*` en `src/**/*.tsx`; **0** de `from|via|to-(purple\|violet\|indigo\|fuchsia)`; **4** `linear-gradient` en `globals.css` |
| «tarjetas redondeadas en todas partes» | **30** usos de `rounded-*` en todo `src/**/*.tsx` (13 `md`, 13 `full`, 2 `xl`, 1 `lg`, 1 `2xl`) |
| «exceso de sombras» | **1** `shadow-2xl` en `.tsx`; **12** `box-shadow` en 1 920 líneas de `globals.css` |
| glassmorphism | **1** `backdrop-blur` en `.tsx`; **10** `backdrop-filter` en `globals.css` |

En elevación, radio y degradado, NexusMED **ya está dentro de lo que hacen Suki/Abridge/Heidi**. El
problema visual no está ahí.

**Dónde sí está el problema, medido:**

| Hallazgo | Medición | Severidad |
|---|---|---|
| **La tipografía es la de fábrica de Vercel.** `Geist` + `Geist_Mono` | `src/app/layout.tsx:2,7,12` | **P1** |
| **La serif está cargada y sin usar.** `Fraunces` se importa y define `--font-display`, pero `var(--font-display)` aparece **4 veces** en todo `src` | `src/app/layout.tsx:19`, `globals.css:177` | **P1** |
| **El acento es índigo-violeta**, el hue más asociado a producto de IA genérico. `--nexus: #6E84FE` (oscuro) / `#2845EA` (claro) | `globals.css:34`; **375** usos de `var(--nexus)` en **97** archivos | **P1** |
| **644 hexadecimales crudos fuera de token** en **102** archivos `.ts/.tsx` (los más repetidos: `#dc2626` ×47, `#3d5afe` ×47, `#f59e0b` ×43, `#f87171` ×30, `#d97706` ×28, `#0d9488` ×27) | `src/**` | **P1** |
| **126 hexadecimales crudos** adicionales dentro de `globals.css` | `globals.css` | P2 |
| **La temperatura del tema es incoherente**: superficies claras cálidas (`#FFFFFF` / `#F5F3EE` / `#ECEAE3`) contra superficies oscuras frías (`#131518` / `#1A1D21` / `#232629`) | `globals.css:17-19, 1182-1184` | P2 |
| **No hay tokens de estado clínico `base/muted/hover`.** Por eso los 644 hexadecimales: `#dc2626` y `#b91c1c` (los mismos valores que el `danger`/`danger-hover` de Heidi) están escritos a mano, uno por uno | — | **P1** |

**Dónde el código ya está bien** — y conviene decirlo, porque un medidor que grita de más se aprende
a ignorar (REG-245):

- **Los radios ya están tokenizados.** `--r-sm 6px`, `--r-md 10px`, `--r-lg 14px`, `--r-pill`,
  `--r-circulo`; 23 de 26 `border-radius` de `globals.css` pasan por una variable. Y **10 px de radio
  por defecto está exactamente en la banda de Abridge (8) y Heidi (8–12)**.
- **Las superficies claras ya son cálidas** (`#F5F3EE`, `#ECEAE3`), que es la decisión P1 de este
  informe, ya tomada.
- **El token de acento lleva su justificación de contraste escrita al lado** (`globals.css:34`: «AA
  sobre --s3 (4.63); antes #3D5AFE = 2.96») y hay pruebas que lo verifican
  (`src/__tests__/lo-que-el-navegador-vio.test.ts:91`). Eso es mejor práctica que la de tres de los
  cinco competidores.
- **La serif ya está contratada y con el uso declarado** («uso restringido a hero/citas/momentos
  editoriales», `layout.tsx:19`). Falta gastarla, no elegirla.

---

## Lo que estos hallazgos NO autorizan

- **No autorizan un rediseño masivo.** El sistema va antes que el repintado; repintar 78 pantallas sin
  tokens de estado es repintarlas dos veces.
- **No autorizan calcar.** El rojo cadmio de Abridge, la arena de Heidi y el amarillo de Suki son
  *trade dress* de sus dueños. Lo transferible es la **estructura**: rampa cálida, acento escaso,
  estado en tres piezas, radio pequeño, sombra teñida y débil, escala semántica fluida.
- **No autorizan empezar por los colores.** Empezar por la escala tipográfica y por los tokens de
  estado clínico: son los que borran los 644 hexadecimales.
- **Ninguna interfaz queda aprobada por este informe.** Todo lo de arriba se leyó en CSS y en
  capturas. Nada se aprueba sin lanzar el producto, recorrerlo, probarlo a 375 px y con teclado.

---

## Reproducir estas mediciones

```bash
# 1. sitios y hojas de estilo
curl -sL https://www.suki.ai/ -o suki.html            # → assets/tailwind-*.css
curl -sL https://www.abridge.com/ -o abridge.html     # → cdn.prod.website-files.com/6279c9d1…
curl -sL https://www.heidihealth.com/ -o heidi.html   # → _next/static/css/*.css

# 2. tokens
grep -oE '\-\-color-[a-z0-9-]+: *#[0-9a-f]{3,8}' heidi/*.css | sort -u
grep -oE '\-\-_colors---[a-z0-9-]+: *#[0-9a-f]{3,8}' abridge/*.css | sort -u

# 3. uso real (no reglas muertas): contar clases en el DOM servido
grep -oE 'rounded(-[a-z0-9]+)*|shadow(-[a-z0-9]+)*' heidi.html | sort | uniq -c | sort -rn

# 4. capturas reales de producto
curl -s "https://itunes.apple.com/lookup?id=1580370720&country=us" | python3 -c \
  "import json,sys;[print(u) for u in json.load(sys.stdin)['results'][0]['screenshotUrls']]"
# 1425102117 Suki · 1580370720 Abridge · 6449428266 Freed · 6503088605 Nabla · 6504471106 Heidi
```

Artefactos de trabajo de esta sesión (HTML, CSS, 31 capturas de App Store, imágenes de producto y
`analyze.py`) quedaron en el scratchpad de la sesión; no se versionan.
