# V15-ORIGINALITY-REDTEAM-001 — veredicto del equipo rojo de originalidad

> **Fecha**: 13-ago-2026 · **Método**: panel independiente de 3 revisores
> (§26/§41) sobre **27 capturas reales** de la app corriendo con siembra
> sintética (`docs/design/capturas/v15-redteam/` — escritorio 1440 + móvil
> 390, tema oscuro/claro y variante GRIS por superficie), contrastadas contra
> el código. El orquestador verificó cada afirmación load-bearing en la
> fuente antes de sellarla aquí. Los tres informes crudos viven en la
> bitácora de la corrida; este documento es el veredicto consolidado.

## Veredicto

**Lo ORIGINAL se sostiene. Lo ESTRUCTURAL se sostiene a medias — y una de
las piezas nuevas traía una regresión clínica (P0, reparada en esta misma
corrida).**

- **No hay** degradado morado, ni shadcn/Radix/cva, ni glassmorphism
  extendido (5 usos acotados), ni imitación de trade dress de
  Abridge/Suki/Nabla/Huli (verificado activamente y **refutado** por los
  tres revisores). La cola de cierre de `/pendientes` (Resultado →
  Significado → Dueño → Revisión → Decisión → Acción → Aviso al paciente →
  Cerrado) es **genuinamente original y del dominio**: la semilla de
  identidad real del producto.
- **Pero** la jerarquía de las superficies clave vive demasiado en el canal
  del COLOR (las capturas `-gris` lo enseñan sin discusión), `/pacientes` y
  `/operaciones` conservan gramática de plantilla, no existe un contenedor
  de página unificado, y los guardianes del riel certifican **reubicación**
  (21 rutas alcanzables, cero huérfanas) más que reducción.

## GENERIC_AI_LOOK_SCORE por superficie (objetivo ≤ 1.0)

Razones ESTRUCTURALES (§29) — ninguna de paleta. Ninguna superficie alcanza
el objetivo todavía; el camino no es recolorear, es llevar la gramática que
Pendientes ya habla a Hoy y Pacientes.

| Superficie | Score | Silueta §13 | Logo-off §28 | Razón estructural dominante |
|---|---|---|---|---|
| Hoy | 3.5 esc / 4.5 móv | FAIL (acción primaria) | FAIL marginal | sidebar + columna de tarjetas del mismo peso; `.prox-hero` ≈ `.card` con tinte; dos CTA primarios co-iguales (admin vs clínico); sin riel temporal R1 |
| Pacientes | 6 esc / 7 móv | FAIL (todo pesa igual) | FAIL | composición CRM genérica; única acción por fila = «Editar» (admin); cero estado clínico por fila; móvil = escritorio estrujado (nombre en 3 líneas) |
| Expediente | 4.5 | PASS parcial (ancla) / FAIL zona media | FAIL marginal | sin Clinical Spine: pila de cajas-módulo; 3 tarjetas KPI **vacías** en la zona más cara; FHIR/exportar al nivel del CTA clínico |
| Consulta (PREPARE) | 3 | **PASS** | FAIL marginal | una acción domina de verdad (§8.6 ✓); pero el shell NO se transforma (banner de cobro + FABs + sidebar íntegro = «chart browsing with a recorder bolted on») |
| Pendientes | **2** | PASS marginal | **PASS (único)** | cola de cierre real con las 4 preguntas de §10; le falta: pista de 8 chips → nodo-sobre-línea, y silueta crítica ≠ normal |
| Operaciones | 7 | FAIL (inventario) | FAIL | 19 tuiles idénticos; confesión en pantalla: «Nada de esto cambió de sitio»; grupo «CLÍNICO» dentro del área admin |
| Shell móvil | 3.5 | PASS parcial | FAIL marginal | paridad de IA y paciente-como-centro bien resueltos; pero el privilegio del pulgar corona «Nueva cita» (admin) y los FAB dobles tapan trabajo clínico |

## La P0 — reparada en esta corrida (REG-311)

`PatientAnchor` (componente que V15 escribió) traía la **séptima copia** de
la regla de negación de alergias, peor que la que REG-279 condenó (sin
`\b`): «Niega penicilina. Alérgico a sulfas» → «sin alergias» en gris;
«Nolotil» → gris; alergia sólo-estructurada → «no registradas». En
`/consulta`, dos criterios contradictorios en el mismo viewport (franja
editable: rojo con cualquier texto; píldora: prefijo). **Arreglado**: las
tres piezas derivan de `alergenosDe`/`negacionesEnTexto` (módulo sellado),
rojo enseña los ALÉRGENOS, el hueco es ámbar, y el barrido de repositorio
del guardián nuevo (`reg-311-el-ancla-no-decide-la-negacion.test.ts`,
probado al revés: 3 fallan sin el arreglo) impide la octava copia. Ledger:
REG-311 · sello actualizado (4560 → 4569 casos).

## Defectos rastreados (consolidados y verificados)

Los IDs de panel (RT/DS/CW) se conservan entre paréntesis. Estado OPEN salvo
nota.

| ID | Sev | Superficie | Defecto | Evidencia verificada |
|---|---|---|---|---|
| ORT-01 | P0 | expediente/consulta | Séptima copia de la negación de alergias + dos criterios en un viewport (RT-01, RT-02, CW-07 parcial) | **FIXED esta corrida** — REG-311 |
| ORT-02 | P1 | operaciones | Grupo «CLÍNICO» (Consultor IA, Antibiograma) dentro del área admin; «Consultor IA» = IA feature-first, la antítesis del principio Suki §3.2 (CW-01, DS-11, RT-10) | `operaciones/page.tsx:40-48`; captura operaciones-desktop |
| ORT-03 | P1 | shell | Destino «Encuentro» no es un lugar: sin encuentro activo → `/pacientes`, y se ilumina «Paciente» — el mapa mental se contradice en su primer uso (CW-02, RT-04) | `FlowRail.tsx:131,183-185` |
| ORT-04 | P1 | shell móvil | La acción del pulgar (FAB central) es «Nueva cita» (admin → /asistente) en Hoy/Pendientes/Operaciones; en Hoy aparece 2× en el primer viewport y destrona a «Iniciar consulta» (CW-03, DS-02) | `BottomNav.tsx:82-86`; hoy-movil.png |
| ORT-05 | P1 | hoy | Dos CTA primarios co-iguales («Nueva cita» y «Iniciar consulta») — el comentario del código dice «la ÚNICA acción primaria» y no lo es (DS-01, RT-06) | `dashboard/page.tsx:131,142-144,340`; hoy-desktop-gris |
| ORT-06 | P1 | consulta/todas | Banner de cobro a peso íntegro DENTRO del modo encuentro, sobre la franja de alergia; ni él ni la pila de avisos se suscriben a EVENTO_GRABANDO (CW-04, DS-05) | `layout.tsx:757`; consulta-movil.png |
| ORT-07 | P1 | expediente | Sin Clinical Spine (§7): pila de cajas-módulo; 3 tarjetas KPI vacías (defecto #15 de la DNA, vivo); FHIR/exportar al nivel del CTA clínico; en móvil 4 botones antes que cualquier dato (DS-06, RT-07) | expediente-desktop/movil; `ResumenPaciente.tsx:60` |
| ORT-08 | P1 | pacientes | Móvil: identidad rota (nombre en 3 líneas en columna ~90px, teléfono partido, «Editar» intacto) — defecto #13 de la DNA reaparecido en superficie nueva (DS-03, RT-13) | pacientes-movil.png |
| ORT-09 | P2 | pacientes | Directorio sin dimensión clínica: única acción por fila «Editar»; «Respaldo» (operación §11) en cabecera primaria (DS-10, CW-08, RT-13) | pacientes-desktop.png |
| ORT-10 | P2 | hoy | Jerarquía de zonas §6 sólo por tinte: `.prox-hero` = `.card` + color-mix (menos padding que una tarjeta normal); TODAY sin estructura temporal (sin riel R1, pasado = opacity .6) (RT-06, DS-07) | `globals.css:591-596` vs `2309-2319`; hoy-desktop-gris |
| ORT-11 | P2 | expediente | Salience de la banda de alergias 100 % cromática: en gris es el elemento MENOS saliente; el icono se pinta idéntico en ambos estados (RT-05) | expediente-movil-gris.png; `PatientAnchor.tsx` (estados, no predicado — el predicado es ORT-01 FIXED) |
| ORT-12 | P2 | shell | No hay UN contenedor de página: 4 contenedores distintos; `.page-pad` sólo existe dentro de `@media (max-width:480px)` — clase muerta en escritorio; `/pendientes` sin contenedor (a sangre hasta x=1440) (RT-08) | `globals.css:1609-1612`; pendientes-desktop.png |
| ORT-13 | P2 | pendientes | `NexusClosureTrack` degradado a 8 chips de 10.5px: envuelve a 2 líneas en móvil; etapa actual ilegible sin color; tarjeta crítica y normal con silueta idéntica (DS-08, DS-09, RT-15) | pendientes-movil.png; pendientes-desktop-gris.png; `ProgresoResultado.tsx:46-63` |
| ORT-14 | P2 | shell | FAB dobles (ayuda+tema) tapan trabajo clínico en las 6 superficies móviles (defecto #7 DNA, intacto); glassmorphism en el toggle; 3 parches previos con números mágicos (RT-09, DS-12, CW-10) | `BotonAyuda.tsx:22,64`; `globals.css:1979-1997,2062-2080` |
| ORT-15 | P2 | consulta/varias | Vendors y «con IA» como etiquetas de flujo: «Claude estructurando…», «Claude + GPT», «AssemblyAI», «Antibiograma inteligente», «Nueva consulta con IA», Sparkles ✨ en 15 archivos (CW-05, RT-10) | `consulta/page.tsx:4657`; `antibiograma/page.tsx:281,462`; `expediente/page.tsx:272` |
| ORT-16 | P2 | shell | Los guardianes certifican reubicación, no reducción: ≤5 contando nodos JSX; reachability exige ≥21 rutas alcanzables con cero huérfanas (RT-04) | `v15-flow-rail-cableado.test.ts:81,100-110` |
| ORT-17 | P3 | shell escritorio | InstrumentStrip vacía en rutas sin paciente («Ausculta» ×2 apiladas — ya corregido en móvil, conservado en escritorio) (DS-14, RT-12) | `InstrumentStrip.tsx:106-109,205-244` |
| ORT-18 | P3 | hoy | Motion decorativo: entrada escalonada 520+120ms en la pantalla más frecuente; luna que rota 20° al hover (RT-14) | `globals.css:2048,2303` |
| ORT-19 | P3 | todas | Cuatro nombres para el objeto central: Encuentro / Iniciar consulta / Consulta / Nueva consulta con IA (CW-06) | FlowRail, Hoy, BottomNav, expediente |
| ORT-20 | P3 | móvil | Textos que envuelven/truncan a 390px: rótulo del héroe en 3 líneas; placeholder de búsqueda cortado; píldoras-pestaña del expediente sangrando (DS-13, DS-15, DS-16) | hoy-movil.png; pacientes-movil.png; expediente-movil.png |
| ORT-21 | P3 | repo | `style={{` subió en absoluto (6065 → 6173) aunque el cociente inline/className mejoró (7.43 → 5.99); por eso `.page-pad` puede estar muerta sin que nadie lo note (RT-11) | medición 13-ago sobre src/app+src/components |

## Señales buscadas y NO encontradas (con qué se descarta)

- **Degradado morado / from-purple**: 0 resultados en todo `src/`.
- **shadcn/Radix/cva**: no existen; `src/components/ui/` son 12 componentes
  propios. El parecido de `/pacientes` es de COMPOSICIÓN, no de librería.
- **Glassmorphism extendido**: 5 usos acotados (creció 1: el theme-toggle,
  contabilizado en ORT-14).
- **Imitación de competidor**: refutada por los tres revisores. El círculo
  de grabación es convergencia de categoría; la anatomía de Hoy sale de §6;
  la cola de Pendientes no la expone así ningún competidor.
- **Móvil con >5 destinos**: 4 contextos + acción central contextual.
- **Gimmicks** (carruseles, parallax, 3D, bento): ninguno. Motion gobernado
  por tokens con `prefers-reduced-motion` (12 keyframes en 2822 líneas).

## Hueco de evidencia declarado

El paquete de capturas NO contiene el encuentro GRABANDO (transcripción
viva, nota emergiendo, cierre). El aquietado §8.1 existe en código
(`FlowRail.tsx:62-101`, con razonamiento AA) pero no está fotografiado. El
Encounter Mode se juzgó en estado PREPARE. Primera tarea del siguiente
paquete de capturas: el ciclo §8 completo.

## Lo que la siguiente iteración NO debe pisar

La IA de 5 contextos con paridad y guardián; el anti-paciente-obsoleto de la
franja; el aquietado con razonamiento AA; el estado de error honesto de la
agenda («no se pudo leer» ≠ «agenda libre»); la cola de cierre de Pendientes
entera — es la semilla de identidad del producto y el único Logo-off PASS.
