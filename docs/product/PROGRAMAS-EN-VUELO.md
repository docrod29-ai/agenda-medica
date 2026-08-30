# Programas en vuelo

> **GENERADO. No editar a mano.**
> Regenerar: `node scripts/programa/reconciliar-programas.mjs`.

El tablero de Ausculta custodia **un programa de tres**. Este documento existe
para que «quedan N accionables» no vuelva a leerse como si fuera el producto entero.

| Programa | Carril | Requisitos | Abiertos | Fuente |
|---|---|---|---|---|
| Ausculta — Master Completion Loop | master | 80 | 34 | `src/lib/programa/requisitos.ts` |
| V9 — Experiencia del paciente y diseño | compartido | 25 | 5 | `agent-state/BACKLOG.json` |
| V10 — Excelencia visual | product-excellence | 39 | 27 | `agent-state/V10_BACKLOG.json` |

## Quién ejecuta qué

**V10 es el carril de Product Excellence.** El §20 del directivo de Master dice
que no se rehaga su trabajo y el §18 que no se invadan sus cambios visuales.
Master lo cuenta; no lo ejecuta.

**V9 es compartido**: toca experiencia del paciente y diseño, y parte de eso
coincide con ejes que Master sí custodia.

## V9 — Experiencia del paciente y diseño — 5 abiertos de 25

Última reconciliación: 2026-08-30

| Item | Estado | Qué es | Comprobado contra el árbol |
|---|---|---|---|
| `EVAL-001` | bloqueado B-01 — externo confirmado 30-ago-2026 | Medir el reconocedor sobre los 6000 audios del corpus V3 | Necesita el gold de 6000 audios. La voz es biometrica: no puede nacer de audio real sin decision del dueno y consentimiento documentado. |
| `UX-002` | NO CONFIRMADO — medido y falso (6-ago-2026) | El texto que explica por qué no se puede firmar es ilegible en tema oscuro | Medido el 6-ago-2026 y resultado FALSO: el contraste del texto que explica por que no se puede firmar cumple en tema oscuro. Se conserva la fila en vez de borrarla porque un hallazgo refutado es informacion: evita que alguien lo vuelva a levantar. |
| `SAFE-003` | pendiente — CONFIRMADO ABIERTO 30-ago-2026 | «Sin referencia de dosis» se descarta también en niños | src/__tests__/dosis-desconocida-declarada.test.ts no tiene ni un caso pediatrico. El hueco es real. |
| `NAV-NAVEGADOR-001` | pendiente — NECESITA NAVEGADOR (verificado 30-ago-2026) | Seis comprobaciones que sólo un navegador puede resolver — dos pueden ser P0 | Seis comprobaciones que por definicion exigen un navegador. Aqui la descarga de WebKit esta bloqueada. |
| `DESIGN-TABLAS-001` | pendiente — NECESITA NAVEGADOR (verificado 30-ago-2026) | Nueve tablas fijan minWidth 520-720 y tres no tienen envoltorio: se desbordan a 375 px | Los 8 archivos con minWidth 500-799 tienen al menos un envoltorio con overflow, pero la medicion es por ARCHIVO y un archivo puede tener un envoltorio y tres tablas. Confirmarlo exige 390px real. |

## V10 — Excelencia visual — 27 abiertos de 39

Última reconciliación: 10-ago-2026: unión de los backlogs de TRES corridas paralela

| Item | Estado | Qué es | Comprobado contra el árbol |
|---|---|---|---|
| `V10-DEBT-004` | abierto | El shell móvil dice «Agenda Médica» en la cabecera — no es la marca; y el FAB de ayuda tap | _no comprobado_ |
| `V10-DEBT-010` | abierto | PACIENTES MÓVIL: los nombres se truncan («María Fernanda…») mientras el botón secundario E | _no comprobado_ |
| `V10-DEBT-006` | mitad-expediente-CERRADA 9-ago-2026 (madrugada-3) | Jerarquía de acción invertida: expediente móvil pone el CTA primario (Nueva consulta con I | _no comprobado_ |
| `V10-DEBT-007` | abierto | Navegación: la barra lateral resalta «Consulta» estando en /pacientes; sobredosis de píldo | _no comprobado_ |
| `V10-DASHBOARD-002` | abierto | P2 móvil del héroe de HOME-001: overline en 3 renglones, nombre truncado con espacio de so | _no comprobado_ |
| `V10-CONSULTA-001` | abierto | P2: la alergia sale dos veces a 40 px (franja + píldora) en /consulta; en móvil la franja  | _no comprobado_ |
| `V10-CALENDARIO-002` | abierto | P2: todos los eventos del calendario van del mismo naranja sin distinguir estado; confirma | _no comprobado_ |
| `V10-EXPEDIENTE-001` | abierto | P3: con expediente vacío, tres tarjetas «sin dato» ocupan el espacio más caro; un solo est | _no comprobado_ |
| `V10-HOME-002` | abierto | «¿Qué puedo continuar?» — cola de notas en borrador sin firmar en la pantalla de inicio | _no comprobado_ |
| `V10-HOME-003` | abierto | «¿Qué preparó NexusMED?» — lo que la aplicación dejó listo desde la última sesión | _no comprobado_ |
| `V10-HOME-004` | abierto | `.kpi-card` y sus derivadas quedan en `globals.css` sin ningún consumidor | _no comprobado_ |
| `V10-MOBILE-CALENDARIO-SEMANA` | abierto | El calendario móvil muestra la semana de 7 columnas en 390px: bloques ilegibles. Debe abri | _no comprobado_ |
| `V10-SHELL-ALMACEN` | abierto | Barra lateral con ~20 destinos de peso igual (almacén de funciones, §8.16); en móvil la ma | _no comprobado_ |
| `V10-CITAS-ARCOIRIS` | abierto | Cada fila de cita lleva 3-4 botones de color distinto (teal/azul/verde/morado) con énfasis | _no comprobado_ |
| `V10-EXPEDIENTE-EDAD` | abierto | Cabecera de expediente/consulta: separador «·» huérfano cuando falta edad; la edad sólo sa | _no comprobado_ |
| `V10-E006-LECTURA-LEGADA` | abierto | El expediente lee alergias SOLO del campo legado patient.alergias; cuando E0-06 termine la | _no comprobado_ |
| `V10-FECHAS-INCONSISTENTES` | abierto | Fechas mezcladas en citas: «Hoy 2026-08-09» (ISO) junto a input nativo «08/09/2026» — form | _no comprobado_ |
| `V10-FABS-DOBLES` | abierto | Dos FABs (ayuda «?» con halo + luna) en la esquina de las 5 pantallas; en móvil tapan cont | _no comprobado_ |
| `V10-LOGIN-A11Y` | parcialmente-cerrado | Login: contraste aparente <4.5:1 en secundarios («o con tu correo», footer); luna ~40px ba | _no comprobado_ |
| `V10-PACIENTES-VACIO-PASIVO` | abierto | El vacío de «Recientes» nombra «Todos A-Z» en negrita en vez de ofrecer el chip como acció | _no comprobado_ |
| `V10-A11Y-BOTONES-SIN-NOMBRE` | parcialmente-cerrado | Botones sin nombre accesible (axe button-name, CRÍTICO): el FAB de luna/tema en TODAS las  | _no comprobado_ |
| `V10-A11Y-CONTRASTE-CTA` | parcialmente-cerrado | Contraste <4.5:1 (axe color-contrast, serio) en el CTA PRIMARIO del dashboard (.prox-hero- | _no comprobado_ |
| `V10-A11Y-CALENDARIO-ANIDADO` | abierto | role=button dentro de role=button en las ranuras del calendario (axe nested-interactive, s | _no comprobado_ |
| `V10-PACIENTES-RECIENTES-VACIO` | abierto | Pestaña por defecto «Recientes» de pacientes sale vacía aunque hay 5 citas hoy (se aliment | _no comprobado_ |
| `V10-HARNESS-CONSOLIDAR` | abierto | P2: TRES arneses de captura para lo mismo (tests/visual/*, scripts/design/arnes-capturas-v | _no comprobado_ |
| `V10-HARNESS-OBS-001` | abierto | P3 observación del arnés: aviso de hidratación en dev en /dashboard (saludo por hora local | _no comprobado_ |
| `AGENDA-IDENTITY-002` | abierto | P1: segunda pasada de identidad del riel — punch list del revisor independiente (IDENTITY  | _no comprobado_ |

