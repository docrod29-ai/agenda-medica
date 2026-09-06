# Ledger de reparación — CONSULTA (Panel de Lujo 2026-09)

Rama `reparacion/CONSULTA`. 45 hallazgos en la lista: **41 CLOSED**, 4 sin
reparar o reparados a medias (ver `no-reparado-CONSULTA.md` y
`handoff-CONSULTA.md`).

El ID es el del hallazgo del Panel de Lujo; el orquestador asigna los REG-nnn al
integrar.

| ID | Área | Incidente | Estado | Test / control permanente |
|---|---|---|---|---|
| ASN-001 | consulta · respaldo | El primer signo vital tecleado perdía su segunda cifra: «154» quedaba «14». `vacio` era una sexta copia a mano de `CAMPOS_DEL_BORRADOR` y no contaba signos, así que el espejo de hace una tecla se aplicaba encima del estado vivo | CLOSED | `src/__tests__/el-primer-signo-vital-no-pierde-su-segunda-cifra.test.ts` |
| ASN-002 | consulta · signos | TA 400/300, T 45 °C y SpO₂ 9 % se aceptaban y llegaban al copiloto como hipotensión e hipoxemia reales | CLOSED | `src/__tests__/los-signos-capturados-se-preguntan-no-se-tragan.test.ts` |
| ASN-003 | consulta · borrador | Los signos capturados en otro equipo no llegaban a la consulta abierta desde la agenda | CLOSED | `src/__tests__/panel-de-lujo-la-consulta-entrega-lo-que-promete.test.ts` |
| ASN-005 | consulta · signos | «154 lb» se tragaba la unidad y viajaba como 154 kg a la verificación mg/kg | CLOSED | `src/__tests__/los-signos-capturados-se-preguntan-no-se-tragan.test.ts` |
| ASN-012 | consulta · signos | Corregir un signo ya guardado no pedía motivo ni dejaba rastro (C-5 sólo existía en Hospital) | CLOSED | `src/__tests__/panel-de-lujo-la-consulta-entrega-lo-que-promete.test.ts` |
| B-009 | voz · sesgo | El módulo desde el que se dicta sesgaba sólo al motor de repuesto | CLOSED (mitad de la consulta; la ruta, en handoff) | `src/__tests__/lo-aprendido-llega-al-motor-que-transcribe.test.ts` (existente, sigue verde) |
| B-017 | voz · turnos | Al corregir turno por turno se tiraban las violaciones y los motivos de ese turno | CLOSED | `src/__tests__/panel-de-lujo-la-consulta-entrega-lo-que-promete.test.ts` no lo cubre: lo cubre el propio tipo `CorreccionDeTurnos` y `npx tsc`; ver decisiones |
| C-014 | paneles | Edad gestacional y edad en meses con la fecha del navegador en UTC | CLOSED | `src/__tests__/panel-de-lujo-los-paneles-de-la-consulta.test.ts` |
| D-001 | consulta · dictado | Las correcciones automáticas de cifras y unidades no se veían ni se deshacían en /consulta | CLOSED | `src/__tests__/consultorio-la-correccion-automatica-se-ve-y-se-deshace.test.ts` |
| D-005 | consulta · accesibilidad | Los campos de la receta sólo se nombraban por marcador de posición | CLOSED | `src/__tests__/panel-de-lujo-la-consulta-entrega-lo-que-promete.test.ts` |
| MC-002 | consulta · paciente | Las indicaciones postoperatorias no llegaban a la hoja del paciente | CLOSED | `src/__tests__/panel-de-lujo-la-consulta-entrega-lo-que-promete.test.ts` |
| MC-007 | cirugía | ASA arrancaba en «II» sin que nadie lo eligiera y no llegaba a la nota | CLOSED | `src/__tests__/panel-de-lujo-los-paneles-de-la-consulta.test.ts` |
| MC-008 | consulta · herramientas | «Es caso quirúrgico» con regex sin frontera: «neurología» casaba «urolog» | CLOSED | `src/__tests__/panel-de-lujo-los-paneles-de-la-consulta.test.ts` |
| MC-013 | cirugía | «Aplicar escalas» sobrescribía lo que el cirujano había escrito | CLOSED | `src/__tests__/panel-de-lujo-los-paneles-de-la-consulta.test.ts` |
| MC-014 | cirugía | El panel proponía cefazolina sin ver las alergias del expediente | CLOSED | `src/__tests__/panel-de-lujo-los-paneles-de-la-consulta.test.ts` |
| MC-015 | cirugía | Nada cruzaba «cirugía programada» con anticoagulante o antiagregante | CLOSED | `src/__tests__/cirugia-programada-y-anticoagulante-se-cruzan.test.ts` |
| MC-017 | cirugía | Los puntajes vivían sólo en memoria y el total no decía qué factores llevaba | CLOSED | `src/__tests__/panel-de-lujo-los-paneles-de-la-consulta.test.ts` |
| MC-018 | cirugía | La lista de la OMS en el consultorio, y su resumen sin nombrar lo pendiente | CLOSED | `src/__tests__/panel-de-lujo-los-paneles-de-la-consulta.test.ts` |
| MG-009 | gineco | Sin edad, la conducta ante la citología se calculaba con 35 años inventados | CLOSED | `src/__tests__/panel-de-lujo-los-paneles-de-la-consulta.test.ts` |
| MG-011 | gineco | FUM futura y ciclo inválido: mensaje equivocado y sustitución silenciosa por 28 | CLOSED | `src/__tests__/panel-de-lujo-los-paneles-de-la-consulta.test.ts` |
| MG-017 | gineco | El panel desaparecía a los 61 años y no entraba al buscador | CLOSED | `src/__tests__/panel-de-lujo-los-paneles-de-la-consulta.test.ts` |
| MG-022 | gineco | La gestación se rehacía en cada visita (vivía en el estado local del panel) | CLOSED (dentro del encuentro; la persistencia, en handoff) | `src/__tests__/panel-de-lujo-los-paneles-de-la-consulta.test.ts` |
| MI-003 | consulta · motores | `SelloMotor` estaba importado y nunca se pintaba, mientras /cumplimiento lo prometía | CLOSED | `src/__tests__/el-sello-de-motor-sin-validar-se-pinta.test.ts` |
| MO-004 | consulta · órdenes | Los estudios dictados nunca llegaban a `estudiosOrden` | CLOSED | `src/__tests__/panel-de-lujo-la-consulta-entrega-lo-que-promete.test.ts` |
| MP-002 | pediatría | Un lactante de 11 meses era «0 años» para la barra de vacunas | CLOSED | `src/__tests__/panel-de-lujo-los-paneles-de-la-consulta.test.ts` |
| MP-006 | consulta · signos | El hard-stop kg/lb protegía sólo al panel; el peso de signos alimentaba mg/kg sin guarda, y el «peso previo» era el de hoy | CLOSED (la receta, en handoff) | `src/__tests__/el-peso-de-signos-pasa-por-la-guarda-de-unidad.test.ts` |
| MP-008 | pediatría | El botón «Nota» pegaba un rango en texto libre; no llegaba a la receta ni al verificador | CLOSED | `src/__tests__/panel-de-lujo-los-paneles-de-la-consulta.test.ts` |
| MP-011 | pediatría | La barra afirmaba «N vacunas atrasadas» en rojo sin registro de lo aplicado | CLOSED | `src/__tests__/panel-de-lujo-los-paneles-de-la-consulta.test.ts` |
| N-021 | comercial | La nota por voz es el activo diferencial y no se enseña antes de comprar | NO REPARADO (decisión del dueño) | — (ver `no-reparado-CONSULTA.md`) |
| PC-012 | consentimiento | Sin huella ni versión del texto que se leyó | CLOSED a medias (versión escrita; persistencia en handoff) | `src/__tests__/el-consentimiento-dice-donde-va-el-audio.test.ts` |
| PG-002 | paciente | Los signos de alarma escritos en indicaciones no llegan al portal, y la pantalla lo prometía | CLOSED (texto veraz; el paquete, en handoff) | `src/__tests__/panel-de-lujo-la-consulta-entrega-lo-que-promete.test.ts` |
| PG-003 | consentimiento | Decía «se conserva en este dispositivo» y el audio sube a la nube hasta 24 h | CLOSED | `src/__tests__/el-consentimiento-dice-donde-va-el-audio.test.ts` |
| PG-004 | consentimiento | No hay forma de registrar el retiro del consentimiento | NO REPARADO (NEEDS_LEGAL_REVIEW + campo ajeno) | — |
| PI-003 | consentimiento | Duplicado de PG-003 desde la voz del paciente | CLOSED | `src/__tests__/el-consentimiento-dice-donde-va-el-audio.test.ts` |
| PI-008 | consentimiento | No consta qué texto se leyó | CLOSED a medias (versión escrita; persistencia en handoff) | `src/__tests__/el-consentimiento-dice-donde-va-el-audio.test.ts` |
| PO-004 | paciente | «Entregar al paciente» prometía que las indicaciones viajan, y no viajan | CLOSED | `src/__tests__/panel-de-lujo-la-consulta-entrega-lo-que-promete.test.ts` |
| PO-016 | consentimiento | Duplicado de PG-003 con el plazo de 24 h | CLOSED | `src/__tests__/el-consentimiento-dice-donde-va-el-audio.test.ts` |
| PP-009 | consentimiento | Redactado para quien consiente por sí mismo; en pediatría consiente el tutor | CLOSED en el texto (el campo `otorgadoPor`, en handoff) | `src/__tests__/el-consentimiento-dice-donde-va-el-audio.test.ts` |
| PP-018 | pediatría · portal | El esquema de vacunación no llega al portal por ninguna fuente | NO REPARADO (falta el registro de vacunas aplicadas: unidad con decisión del dueño) | — |
| RT-004 | consulta · evidencia | Una cita inventada entraba a la nota firmada con aspecto de fuente | CLOSED | `src/__tests__/la-cita-sin-fuente-se-marca-y-no-se-borra.test.ts` · `src/__tests__/la-cita-del-analisis-se-comprueba-antes-de-la-nota.test.ts` |
| ZC-002 | entidades | «Alternativa segura: X» sobre un fármaco que ningún motor cruzó con las alergias | CLOSED | `src/__tests__/panel-de-lujo-los-paneles-de-la-consulta.test.ts` |
| ZC-014 | preventivo | Umbrales de tendencia sin fuente, y sin comprobar la unidad, entrando a la nota | CLOSED | `src/__tests__/panel-de-lujo-los-paneles-de-la-consulta.test.ts` |
| ZC-015 | preventivo | El catálogo de tamizajes entraba a la nota sin organismo ni advertencia | CLOSED | `src/__tests__/panel-de-lujo-los-paneles-de-la-consulta.test.ts` |
| ZC-016 | entidades | El panel hablaba como sistema («Claude está identificando», «cross-checks») | CLOSED | `src/__tests__/panel-de-lujo-los-paneles-de-la-consulta.test.ts` |
| ZC-017 | entidades | La procedencia de cada entidad sólo vivía en un `title` | CLOSED | `src/__tests__/panel-de-lujo-los-paneles-de-la-consulta.test.ts` |

## Pruebas nuevas y movidas

| Archivo | Origen | Casos |
|---|---|---|
| `src/__tests__/el-primer-signo-vital-no-pierde-su-segunda-cifra.test.ts` | REP-070 movida | 15 |
| `src/__tests__/el-peso-de-signos-pasa-por-la-guarda-de-unidad.test.ts` | REP-053 movida | 4 (+1 `todo` de handoff) |
| `src/__tests__/la-cita-del-analisis-se-comprueba-antes-de-la-nota.test.ts` | REP-082 movida | 5 |
| `src/__tests__/el-sello-de-motor-sin-validar-se-pinta.test.ts` | REP-020 movida | 4 |
| `src/__tests__/los-signos-capturados-se-preguntan-no-se-tragan.test.ts` | nueva | 15 |
| `src/__tests__/la-cita-sin-fuente-se-marca-y-no-se-borra.test.ts` | nueva | 6 |
| `src/__tests__/el-consentimiento-dice-donde-va-el-audio.test.ts` | nueva | 7 |
| `src/__tests__/cirugia-programada-y-anticoagulante-se-cruzan.test.ts` | nueva | 9 |
| `src/__tests__/panel-de-lujo-los-paneles-de-la-consulta.test.ts` | nueva | 20 |
| `src/__tests__/panel-de-lujo-la-consulta-entrega-lo-que-promete.test.ts` | nueva | 13 |
| `src/__tests__/consultorio-la-correccion-automatica-se-ve-y-se-deshace.test.ts` | invierte el sello anterior | 7 |

## Módulos nuevos (puros, junto a la pantalla que los usa)

- `src/app/(dashboard)/consulta/[patientId]/signos-que-se-capturan.ts` — lectura,
  unidad y plausibilidad de los signos (ASN-002, ASN-005).
- `src/app/(dashboard)/consulta/[patientId]/citas-del-analisis.ts` — comprobación
  de las citas `[n]` antes de escribir en la nota (RT-004).
- `src/app/(dashboard)/consulta/[patientId]/consentimiento-de-grabacion.ts` — el
  texto del consentimiento y su versión (PG-003, PI-003, PO-016, PP-009, PC-012).
- `src/app/(dashboard)/consulta/[patientId]/anticoagulantes-y-cirugia.ts` — el
  cruce quirúrgico (MC-015).
