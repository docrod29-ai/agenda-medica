# Accesibilidad — V10

> Ley: V10 §27 + `.claude/rules/design-system.md` (WCAG 2.2 AA o mejor).
> Los fallos críticos de accesibilidad que impiden uso seguro **bloquean
> release** (V10 §27). Endurecimiento a fondo en `V10-A11Y-001` (iteración 18).

## Mínimos que fallan la compuerta (ya vigentes en el repo)

- Control interactivo que no es `<button>`.
- Campo sin etiqueta.
- Modal que no atrapa el foco o no cierra con Escape.
- Foco invisible.
- Contraste < 4.5:1 en texto normal.
- Objetivo táctil < 44×44.

`docs/DESIGN_SYSTEM.md` documenta cocientes de contraste calculados a mano en
el propio CSS — esa práctica se conserva.

## Línea base (TRUTH-001 salida 10) — levantada el 9-ago-2026

Método: `tests/visual/arnes-a11y.mjs` — axe-core (WCAG 2.x A/AA + 2.2 AA) sobre
el golden flow autenticado contra emuladores, en 1440 y 390. Evidencia completa
en `tests/visual/capturas/reporte-a11y.json`.

**12 hallazgos critical/serious, 5 tipos distintos:**

| Pantalla | Impacto | Regla | Qué es |
|---|---|---|---|
| agenda | critical | `button-name` ×2 | botones de icono (chat/editar) sin nombre accesible |
| agenda | critical | `label` | `input[type=date]` sin etiqueta |
| consulta | critical | `label` ×4 | 4 textareas de la nota sin etiqueta |
| hoy | serious | `color-contrast` ×4 | `.prox-hero-cta` bajo 4.5:1 |
| agenda | serious | `color-contrast` ×3–6 | botones de acción de fila bajo 4.5:1 |
| login | serious | `target-size` | «Mostrar contraseña» < 24px de objetivo |

`pacientes` y `expediente`: **0 violaciones axe** en ambos anchos (con la
lista de pacientes VACÍA — ver actualización abajo).

Los tres critical entran al backlog como `V10-DEBT-005` (P1): son campos y
botones del flujo clínico central sin nombre para un lector de pantalla. El
resto se arregla en `V10-A11Y-001` o al rediseñar cada pantalla — sin dejar
que un rediseño los reintroduzca.

## Re-medición — 9-ago-2026 (noche): 12 → 8, CERO critical

Los 4 critical se repararon y se verificaron con axe en navegador real la
misma corrida; guardián de fuente probado al revés en
`src/__tests__/a11y-flujo-central-etiquetas.test.ts` (6/6 fallan sin el
arreglo). También cayeron: `.prox-hero-cta` (mismo 3.28:1 de v1104, pero en
CSS global, donde el guardián de estilos en línea no mira) y el `target-size`
del toggle de contraseña en login/registro (ahora 44×44).

**Los 8 serious restantes, con dueño:**

| Pantalla | Regla | Dueño |
|---|---|---|
| hoy 1440+390 | `color-contrast` ×3 (subtítulos de la agenda del día) | V10-TODAY-001 |
| agenda 1440+390 | `color-contrast` ×3–6 («Registrar cobro» y pares) | V10-AGENDA-001 |
| pacientes 1440+390 | `nested-interactive` ×3 (fila `div[role=button]` con botones dentro) — **nuevo**: sólo aparece con la lista POBLADA; la línea base original lo midió vacío | V10-DEBT-010 |
| nota 1440+390 | `color-contrast` ×7 (etiquetas grises de la tabla de datos) — **nuevo**: la ruta no existía en la línea base sin nota sembrada | V10-DEBT-008 |

Lección de método: una pantalla auditada con su estado VACÍO puntúa
accesibilidad de más — `pacientes` pasó de 0 violaciones a 3 serious al
poblarla. La siembra manda (V10 §33.2: datos sintéticos realistas).

Pendiente de la línea base (no lo cubre axe): recorrido de teclado completo,
lector de pantalla real y foco visible — se levantan en `V10-A11Y-001`.

## Segunda línea base independiente — 9-ago-2026 (corrida paralela)

Una corrida paralela levantó SU propia línea base con otro arnés y otro método
de conteo (nodos, no tipos), **sobre una línea de código que aún no llevaba los
arreglos de arriba** — por eso sus números no son comparables uno a uno con la
re-medición. Se conserva íntegra porque encontró fallos que la primera línea
base no vio (el FAB de tema sin nombre en TODAS las pantallas, y calendario
completo, que la primera no auditó):

**Método**: axe-core 4.11.4 inyectado en las 7 pantallas del golden flow,
autenticado, datos sintéticos, build de producción, 1440 y 390
(`bash scripts/design/arnes-capturas-v10.sh axe`). Resultado completo:
`tests/accessibility/axe-baseline-v10.json`.

**Total: 71 nodos con fallo — 30 críticos, 41 serios. 5 reglas distintas.**

| Regla (impacto) | Dónde | Qué es |
|---|---|---|
| `button-name` (crítico) | **TODAS las pantallas** (1 botón recurrente — el FAB de luna/tema) + 3 en citas y calendario (iconos chat/lápiz/kebab) | Botones sin nombre accesible: un lector de pantalla anuncia «botón» y nada más |
| `label` (crítico) | consulta: **4 textareas clínicas** con `placeholder=""`; citas: `input[type="date"]` | Campos clínicos sin etiqueta programática — el dictado de la nota es invisible para tecnologías de apoyo |
| `color-contrast` (serio) | dashboard: `.prox-hero-cta` (el CTA **primario** «Iniciar consulta»); citas: «Registrar cobro»; calendario: ranuras | Texto bajo 4.5:1 — incluye el botón más importante del dashboard |
| `nested-interactive` (serio) | calendario: `role="button"` dentro de `role="button"` en las ranuras | El elemento interno no es alcanzable por teclado/lector |
| `target-size` (serio) | login: ojo de contraseña; calendario: ranuras | Objetivo táctil bajo el mínimo (WCAG 2.2) |

**Lecturas**: el fallo más repetido (FAB sin nombre) confirma el hallazgo del
revisor visual (V10-FABS-DOBLES). Lo más grave clínicamente son las textareas
de la consulta sin etiqueta. Lo más visible: el contraste del CTA primario.

**Lo que esta línea NO mide** (declarado, para señalar de menos): orden real
de tabulación, visibilidad del foco al navegar, trampas de foco en modales,
experiencia de lector de pantalla. Se mide a mano en `V10-A11Y-001`.

Los defectos están en `V10_BACKLOG.json` (`V10-A11Y-*`); la compuerta de CI
nace en `V10-A11Y-001` cuando los críticos estén en cero.

## Reconciliación de las dos líneas (9-ago-2026, fusión)

Tras fusionar las dos corridas, quedan **abiertos** (unión de ambas mediciones,
descontando lo ya reparado con guardián):

| Hallazgo | Origen | Dueño |
|---|---|---|
| FAB de luna/tema sin `button-name`, todas las pantallas | 2.ª línea | V10-FABS-DOBLES / V10-SHELL-001 |
| Iconos chat/lápiz/kebab sin nombre en citas y calendario | 2.ª línea (agenda ya reparada) | V10-AGENDA-001 |
| `color-contrast` hoy/agenda/nota (subtítulos, «Registrar cobro», etiquetas grises) | ambas | V10-TODAY/AGENDA-001, DEBT-008 |
| `nested-interactive` pacientes (fila poblada) y calendario (ranuras) | ambas | DEBT-010 / V10-AGENDA-001 |
| `target-size` ranuras de calendario | 2.ª línea | V10-AGENDA-001 |

La próxima medición axe corre sobre la línea FUSIONADA (las dos ramas ya son
una), con siembra poblada en todas las pantallas — las cifras de referencia a
partir de ahí son las de esa corrida, no las de estas dos.

## ★ REFERENCIA VIGENTE — línea fusionada, medida el 10-ago-2026

`tests/visual/arnes-a11y.mjs` sobre la fusión de las tres corridas (siembra
poblada, 7 pantallas, 1440 y 390). Resultado: **CERO critical; 6 hallazgos
serious en las 3 familias ya abiertas** — exactamente lo que la reconciliación
predijo, ninguna regresión de la fusión:

| Pantalla | Hallazgo (serious) | Dueño |
|---|---|---|
| hoy 1440+390 | `color-contrast` ×3 (subtítulos de la agenda del día) | V10-TODAY-001 |
| agenda 1440+390 | `color-contrast` ×6 («Registrar cobro») | V10-AGENDA-001 |
| pacientes 1440+390 | `nested-interactive` ×3 (fila poblada) | V10-DEBT-010 |

login, expediente, consulta y nota: **0 violaciones** en ambos anchos.

La misma corrida verificó en consola de navegador real que el arreglo de
hidratación portado funciona: **28 avisos de hydration → 0**; los errores de
consola totales bajaron 124 → 97 (los 96 restantes son la familia conocida
del arnés dev: la bitácora de auditoría contesta 401 porque el admin SDK del
servidor no está cableado al emulador — no es defecto del producto, está en
V10-HARNESS-OBS-001).

## Tercera línea independiente — corrida paralela de la noche (fusionada el 10-ago)

Una tercera corrida (22:49 del 9-ago, rama paralela) midió con SU propio arnés
(`scripts/design/capturar-golden-flow.mjs`, escritorio, build de producción,
sembrado) **sin conocer las dos anteriores**. JSON:
`docs/design/capturas/v10-truth/axe-baseline.json`.

Coincide en las dos familias (botones/campos sin nombre; contraste) y no
aportó reglas nuevas. Sus dos únicos datos propios:

- `/pendientes`: **0 violaciones** — pantalla que las otras líneas no listaron.
- Reparó y re-midió `/dashboard` a **0** tras REG-308 (el mismo arreglo del
  `.prox-hero-cta` que la primera línea hizo por su lado: dos corridas ciegas,
  el mismo defecto, el mismo azul sólido — el hallazgo se confirma solo).

## Línea base histórica de la corrida paralela (se conserva por su tabla por pantalla)

Con la app **servida** (build de producción, emuladores, datos sintéticos) y
axe-core 4.11 sobre cada pantalla del golden flow en escritorio. El JSON crudo
vive junto a las capturas: `docs/design/capturas/v10-truth/axe-baseline.json`.
Se regenera con `scripts/design/capturar-golden-flow.mjs`.

| Pantalla | Violaciones WCAG 2.x AA (axe) |
|---|---|
| `/dashboard` | **0** — tras REG-308 (el CTA del héroe usaba el azul de texto como relleno: 2.9:1) |
| `/citas` | `button-name` ×2 (botones de icono sin nombre) · `color-contrast` ×7 · `label` ×1 (input de fecha) |
| `/calendario` | `button-name` ×2 · `nested-interactive` ×5 (huecos `div[role=button]` con botones dentro) · `target-size` ×1 |
| `/pacientes` | `nested-interactive` ×5 (fila entera `div[role=button]` conteniendo botones) |
| `/expediente/[id]` | **0** |
| `/consulta/[id]` | `label` ×4 — **las textareas de la nota clínica no tienen nombre programático** (crítico: es el campo de trabajo principal) |
| `/pendientes` | **0** |

**Lectura.** Los ceros demuestran que el patrón base del producto es sano; las
violaciones se concentran en dos familias reparables de una vez: (1) botones de
icono sin `aria-label` y campos sin etiqueta — la compuerta de arriba ya los
prohíbe, pero no se estaba midiendo sobre la app servida (familia `sin_medir`);
(2) filas/huecos clicables hechos con `div[role=button]` que anidan botones
reales — el mínimo «control interactivo que no es `<button>`» de esta misma
página. Ambas están en `V10_BACKLOG.json` (`V10-A11Y-001`, P1).

**Qué NO cubre esta línea base todavía**: teclado (orden y foco visible),
lector de pantalla, `prefers-reduced-motion`, zoom 200 %, y las pantallas fuera
del golden flow. Se amplía en `V10-A11Y-001`.

---

# La compuerta de la superficie del paciente — `A11Y-GATE-001` (27-ago-2026)

Todo lo de arriba se **midió** con axe en un navegador y quedó anotado. Ninguna
de esas mediciones era una **compuerta**: `tests/visual/arnes-a11y.mjs` y los
`scripts/design/axe-*.mjs` necesitan servidor levantado y emulador sembrado, así
que corren cuando alguien se acuerda. Un guardián que sólo corre cuando alguien
se acuerda no es una red — y en efecto, la línea base de arriba lleva desde el
9-ago sin que nada impida que los mismos defectos vuelvan a entrar.

Esta unidad pone la primera red **automática**, y la pone donde más asimétrico
es el daño: la superficie del paciente.

## Por qué el paciente primero

Es la asimetría de `patient-facing-ai.md` dicha en interfaz. Hasta hoy la
interfaz de este producto le hablaba a un internista con cédula: un defecto se
lo comía alguien entrenado para verlo. El paciente **no puede detectarlo** — y
es un paciente de 70 años, en un teléfono, con el texto al 200 %. Que no pueda
reservar su cita no se manifiesta como un error: se manifiesta como que no
reservó.

## Qué corre, y cuándo

```bash
npm run a11y:paciente          # el medidor, con archivo y línea
npx vitest run src/__tests__/a11y-*.test.ts
```

Y en CI, en el job del trinquete, en cada PR. **Sin dependencias nuevas**: el
analizador usa la API del compilador de TypeScript, que ya era `devDependency`
(Apache-2.0). Cero paquetes de pago, cero servicios externos, cero binarios que
descargar.

| Pieza | Qué hace |
|---|---|
| `scripts/design/lib/a11y-jsx.mjs` | 15 reglas sobre el árbol real del TSX |
| `scripts/design/lib/contraste-wcag.mjs` | la aritmética de WCAG 2.2, con composición de alfa |
| `scripts/design/medir-a11y-superficies-paciente.mjs` | las 10 superficies + 34 pares de contraste + el inventario de rutas |
| `a11y-la-superficie-del-paciente-no-pierde-terreno.test.ts` | la compuerta |
| `a11y-el-detector-si-puede-fallar.test.ts` | el guardián **del** guardián |

## Las 15 reglas

`botonSoloIconoSinNombre` · `enlaceSinNombreAccesible` · `campoSinEtiqueta` ·
`interactivoSinTeclado` · `focoInvisible` · `botonOcupadoSinAriaBusy` ·
`anchoFijoRompeReflujo` · `imagenSinAlt` · `iframeSinTitulo` ·
`dialogoSinAriaModal` · `dialogoSinNombre` · `dialogoSinEscape` ·
`sinEncabezadoPrincipal` · `saltoDeNivelDeEncabezado` ·
`estadoAsincronoSinRegionViva`

Cada una está probada **al revés**: el defecto sintético la dispara y la
corrección mínima la calla. Las dos mitades — un detector que grita siempre pasa
la primera y no sirve, porque pone en rojo la corrección igual que el defecto y
acaba desactivado (REG-245).

## Las diez superficies

`/mi/[token]` (portal, con la hoja/paquete de la visita) · `/reservar/[clinicId]`
· `/dr/[clinicId]` · `/verificar/[token]` · `/privacidad` ·
`/privacidad/[clinicId]` · `/teleconsulta/[citaId]` · `/resena/[token]` ·
`/pago/exito` · `/pago/cancelado`

La lista **no se puede quedar corta en silencio**: hay un guardián que cruza
`src/app/` con ella y con la lista de exclusiones declaradas, y falla cuando
aparece una `page.tsx` pública que nadie clasificó. Así es como se pierde una
compuerta — no porque alguien la borre, sino porque deja de cubrir lo que se
añadió después.

## Aquí el número es 0, y es prohibición

No es el trinquete de diseño, que cuenta deuda tolerada y la deja bajar. Son
diez archivos, caben en una tarde, y es la superficie donde el lector no puede
detectar el error.

**En el resto de la aplicación esta unidad no toca nada.** Poner hoy en rojo 200
pantallas es la manera segura de que alguien borre el guardián el martes. El
barrido al resto es trabajo aparte, y su forma natural es la del trinquete:
contar, sellar, y que el número sólo baje.

## Qué NO cubre esta compuerta

- **No abre un navegador.** El contraste **pintado** (texto sobre imagen o
  degradado), el orden real del foco y la trampa de foco de un modal siguen
  siendo axe con Chromium — y mirar la pantalla, que la ley de diseño exige
  aparte («no se aprueba una interfaz leyendo el código»).
- **No cruza el límite del componente.** Un `<button>` que vive en
  `components/ui/` no lo juzga la superficie que lo usa.
- **No mide el contraste de los bordes** (WCAG 1.4.11, 3:1). `--border` está en
  1,18:1 en oscuro **a propósito**: es un separador decorativo, no el límite que
  identifica un control. Cambiarlo es rediseño.
- **La regla de la región viva cuenta por archivo, no por estado.** Una sola
  `aria-live` la apaga entera. Se descubrió reparando `/mi/[token]`: la regla se
  puso en verde con el formulario previo arreglado mientras el cartel de «tu
  enlace ya no vale» seguía mudo. Se encontró **mirando**, no midiendo.
- **No cubre el resto de la aplicación.**

Los 23 defectos que encontró el primer día, y sus arreglos, están en
`docs/audit/regression-ledger.md` § REG-331.
