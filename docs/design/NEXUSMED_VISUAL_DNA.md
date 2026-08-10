# NEXUSMED VISUAL DNA — especificación de identidad

> **Origen**: `docs/ai/NEXUSMED_ORIGINAL_PRODUCT_IDENTITY_DIRECTIVE.md`
> (dueño, 10-ago-2026, P0 de identidad de producto). Extiende el Master Loop
> V10. **Estado**: viva; cada firma se marca cuando existe EN el producto con
> captura, no cuando existe en este documento.

## 0 · Diagnóstico honesto (con evidencia, 10-ago-2026)

Lo que ya es identidad real (conservar, no rehacer):

- Lienzo oscuro neutro `#0B0C0E`, superficies ink, **cobalto con semántica**
  (`--nexus` texto / `--nexus-solido` relleno, contrastes calculados a mano).
- **Fraunces serif SOLO display** (saludo de /dashboard, wordmark) sobre
  grotesca — combinación poco común en salud; ya pasa el logo-off en /dashboard.
- HOME-001: jerarquía §14 (próxima cita → atención → agenda), un renglón de
  resumen, cero KPI.

Lo que NO es identidad sino plantilla (evidencia: capturas del 9/10-ago):

- La **composición** de toda pantalla interna: sidebar-almacén de ~22 destinos
  planos + contenido en contenedores redondeados. Es la composición de
  cualquier SaaS generado.
- El **muro de botones** (agenda--1440: hasta 4 CTA × 4 colores por fila +
  3 iconos), píldoras para todo (estado, el propio nombre del médico),
  filtros duplicados (chips de conteo + segmentos), avatar-círculo genérico.
- El detalle que delata generación: fecha en formato US, «De Agosto» en
  mayúscula, FABs dobles tapando contenido.

**Conclusión operativa**: los tokens se quedan; la GRAMÁTICA de composición se
reemplaza. No recolorear el patrón: sustituirlo.

## 1 · La gramática NexusMED

Concepto rector (directiva):

`UN PACIENTE → UN ESPACIO CLÍNICO → UN MOMENTO ACTUAL → UNA SIGUIENTE ACCIÓN SEGURA`

Tres reglas de composición que TODAS las pantallas comparten (esto es lo que
se reconoce sin logo):

### R1 — EL RIEL (la columna del momento)

Toda pantalla temporal (agenda, timeline, encuentro, tareas) se organiza sobre
un **riel vertical a la izquierda del contenido**: una línea continua de la
que cuelgan los eventos, con el **MARCADOR DE AHORA** — una línea cobalto de
borde a borde con la hora actual — separando lo pasado (atenuado) de lo que
viene. El riel ES la firma: ninguna plantilla SaaS organiza la agenda como una
línea de tiempo con «ahora» siempre visible.

### R2 — UNA ACCIÓN POR ENTRADA

Cada entrada (cita, resultado, tarea, medicamento) muestra **exactamente una
acción primaria**, derivada del ESTADO clínico/operativo — la «siguiente
acción segura» — y el resto vive en el menú de la entrada. El estado se dice
con **tipografía + un punto de color** (small-caps, atenuado), nunca con
píldora salvo riesgo clínico.

### R3 — TIPOGRAFÍA ANTES QUE CONTENEDOR

La identidad del paciente es el elemento tipográfico dominante de su entrada
(grotesca, 15–16, peso 550). Metadatos en 12–13 atenuado. Números SIEMPRE
tabulares. Serif Fraunces SOLO en el nivel display (saludo, nombre del
paciente en su espacio clínico). Cero contenedores nuevos donde el espacio y
el tipo ya jerarquizan: las entradas del riel **no son tarjetas** — se separan
con espacio y una línea de riel, no con cajas.

## 2 · Roles tipográficos (mapear a clases, no inventar tamaños)

| Rol | Clase | Especificación |
|---|---|---|
| identidad del paciente | `.nx-ident` | grotesca 15.5/1.3, peso 550, `--text` |
| título display | `.nx-display` | Fraunces, ya existe |
| dato numérico | `.nx-num` | `font-variant-numeric: tabular-nums` |
| hora del riel | `.nx-riel-hora` | 13 tabular, peso 600 |
| estado operativo | `.nx-estado` | 11.5 small-caps espaciado +0.04em, punto de color delante |
| metadato clínico | `.nx-meta` | 12.5, `--text-3` |
| valor crítico | `.nx-critico` | 13 peso 700 + icono, NUNCA sólo color |
| procedencia IA | `.nx-prov` | 11.5 con marca de origen, ya nace en REG-213/250 |

## 3 · Color semántico (sin cambios de paleta; cambios de USO)

- Neutro por defecto; cobalto = acción/selección/ahora; ámbar = requiere
  confirmación humana; rojo = riesgo clínico (siempre con icono+texto);
  verde = cerrado/completo (atenuado, nunca celebratorio).
- **Prohibido**: un color por tipo de botón (el arcoíris teal/azul/verde/
  morado de la agenda muere con R2), color para «hacer interesante» una caja.

## 4 · Las cinco firmas (estado real)

| Firma | Estado | Dónde |
|---|---|---|
| **NEXUS RIEL DEL DÍA** (R1 aplicada a la agenda) | 🔶 v1 implementada y revisada 10-ago: revisor independiente da IDENTITY 7.5 / GENERIC 2.5 / VISUAL 7.5 — «la gramática es correcta; falta que los CONTROLES hablen el idioma del riel». Punch list en V10_BACKLOG (AGENDA-IDENTITY-002) | `/citas` — AGENDA-IDENTITY-001 |
| **NEXUS INSIGHT** (QUÉ·POR QUÉ·FUENTE·LÍMITE·ACCIÓN) | parcial — procedencia REG-213/250 existe; primitivo unificado pendiente | V10-NEXUS-001 |
| **NEXUS ENCOUNTER MODE** (UI mínima grabando) | parcial — círculo cobalto domina; reducción radical pendiente | V10-ENCOUNTER-001 |
| **NEXUS CONTINUITY** (volver al contexto exacto) | base V9 (REG-276…279) | V10-SHELL-001 |
| **NEXUS COMMAND** (⌘K clínico) | búsqueda ⌘K existe; acciones+navegación pendiente | V10-COMMAND-001 |
| **NEXUS TIMELINE** (longitudinal) | no existe — el riel de agenda es su semilla visual | V10-TIMELINE-001 |

Regla: una firma «existe» cuando pasa logo-off con captura, no antes.

## 5 · Sistema de símbolos (propuesta inicial, NO tocar marca legal)

Un solo motivo geométrico: **el nodo en el riel** — un punto sobre una línea
vertical (el momento presente sobre la continuidad del cuidado). De él deriva:

- estado de espera: nodo vacío ○ sobre riel
- momento actual: nodo lleno cobalto ● con anillo
- inteligencia disponible: nodo con segundo anillo concéntrico (no sparkle)
- procedencia: nodo pequeño + línea que apunta a la fuente
- carga: el nodo recorre el riel

Funciona a 16/24 px (es un punto y una línea), como favicon y como marca de
estado IA. Propuesta de marca completa → decisión del dueño (registrada, no
ejecutada — la directiva lo prohíbe en automático).

## 6 · Los 20 defectos de identidad de mayor impacto (10-ago-2026)

Con captura; orden = impacto × frecuencia de uso. GEN = generic-AI score.

| # | Defecto | Evidencia | Destino |
|---|---|---|---|
| 1 | Muro de botones 4 CTA × 4 colores por fila de cita | agenda--1440 | ✅ AGENDA-IDENTITY-001 (R2) |
| 2 | Agenda móvil rota: botones sobre el texto, nombre palabra a palabra | agenda--390 | ✅ AGENDA-IDENTITY-001 |
| 3 | Filtro duplicado: chips de conteo + segmentos (9 chips, 3 pantallas en móvil) | agenda--390 | 🔶 AGENDA-IDENTITY-001: reducido 12→4 controles (renglón + selector callado); la revisión independiente señala que coexistir tabs+selector sigue siendo doble — fusión total en la iteración 2 |
| 4 | Píldora «Ana» (el propio médico) en cada fila | agenda--1440 | ✅ AGENDA-IDENTITY-001 |
| 5 | Sidebar-almacén: ~22 destinos planos de igual peso | todas--1440 | V10-SHELL-001 |
| 6 | Marca partida en tres («Agenda Médica» móvil / NexusMED login / clínica sidebar) | 4/4 móviles | V10-SHELL-001 |
| 7 | FABs dobles (ayuda con halo + luna) tapando contenido | todas--390 | V10-SHELL-001 |
| 8 | Fecha US «08/09/2026» en producto es-MX | agenda--1440 | ✅ AGENDA-IDENTITY-001 |
| 9 | Avatar-círculo con inicial: el patrón genérico nº1 de SaaS | agenda, hoy, pacientes | R3: la identidad es tipográfica — se retira del riel |
| 10 | Estado como píldora de color en vez de tipografía | agenda, hoy | ✅ AGENDA-IDENTITY-001 (`.nx-estado`) |
| 11 | Calendario móvil = escritorio encogido (7 columnas a 390) | calendario--mobile | V10-AGENDA-001 |
| 12 | Eventos del calendario todos naranjas; estado sólo por borde punteado | calendario--desktop | V10-AGENDA-001 |
| 13 | Nombre truncado en /pacientes mientras «Editar» conserva ancho | pacientes--mobile | V10-PATIENT-001 |
| 14 | Fila entera `div[role=button]` anidando botones (pacientes) | axe vigente | V10-DEBT-010 |
| 15 | Expediente vacío: 3 tarjetas «sin dato» en el espacio más caro | expediente--desktop | V10-PATIENT-001 |
| 16 | Consulta: alergia duplicada a 40 px (franja + píldora) | consulta--desktop | V10-ENCOUNTER-001 (con clinical-safety) |
| 17 | Contraste bajo en subtítulos de hoy y «Registrar cobro» | axe vigente ×9 | ✅ agenda / V10-TODAY-001 |
| 18 | «3 – 9 De Agosto» — mayúscula errónea del formateador | calendario--desktop | V10-AGENDA-001 |
| 19 | Barra inferior móvil sólo en /pacientes (patrón inconsistente) | 390 todas | V10-SHELL-001 / V10-MOBILE-001 |
| 20 | Título «Citas» + botón azul genérico como toda la cabecera | agenda--1440 | ✅ AGENDA-IDENTITY-001 (cabecera = día es-MX + resumen) |

## 7 · Compuertas de identidad

- **Logo-off**: ocultar wordmark/logo/nombre de clínica y preguntar «¿podría
  ser cualquier SaaS de salud?». Falla → rediseño. IDENTITY_SCORE ≥ 9,
  GENERIC_AI_SCORE ≤ 1 por pantalla crítica, con captura.
- **Tres segundos**: dónde estoy / qué paciente / qué pasa / qué pide atención
  / qué sigue.
- **Atención**: cada elemento justifica atención del médico AHORA o se
  colapsa/mueve.
- **Equipo rojo de originalidad**: revisor independiente (design-systems-lead
  o red-team); el implementador no aprueba su propia originalidad (V10 §40).
- **Función intocable**: ningún dato clínico, procedencia, aviso de seguridad
  ni flujo V7/V9 se pierde por estética; axe no empeora; los guardianes
  existentes siguen en verde.
