# 05 — Cobertura de la auditoría «Panel de Lujo»

**Fase 5 · Crítico de completitud · 6-sep-2026 · rama `claude/medical-app-audit-team-8c37y7`**

Este documento no audita nada. Mide **qué se revisó, qué no, y cuánto aguantó lo
revisado** cuando el equipo rojo lo empujó. Se escribe cruzando dos cosas y nada
más: `00-INVENTARIO.md` y los 42 archivos de `crudos/` (21 auditorías + 21
veredictos del equipo rojo). El script que hace el cruce está pegado íntegro al
final, en (i), para que cualquiera pueda repetir el número sin creerme.

## Los seis números

| | |
|---|---|
| Piezas del inventario cruzadas | **506** |
| Piezas con al menos un auditor | **387 (76 %)** |
| Piezas sin ningún auditor | **119 (24 %)** |
| Hallazgos crudos | **442** |
| Confirmados / parciales / refutados | **332 / 88 / 22** (4,98 % refutado) |
| P0 y P1 en pie tras el equipo rojo | **4 P0 · 40 P1** |

## Lo que este crítico señala

**1. «100 % de las rutas de API» es verdad y no significa lo que parece.** Las
100 rutas tienen auditor, pero **54 de ellas tienen exactamente uno: el oficial
de ciberseguridad**, y su nota es siempre del mismo molde — `sesión: sí ·
consultorio: sí · lista blanca: sí`. Es una revisión real y es la correcta para
su lente, pero es **una sola lente**. De esas 54 rutas nadie ha preguntado si el
dato que escriben llega, si el botón que las llama hace lo que dice, ni si lo que
devuelven es clínicamente correcto. En la tabla (a) esas rutas cuentan como
cubiertas; en la realidad están cubiertas *contra fuga de datos*, no *contra
error*. Lo mismo con 21 de las 35 pantallas públicas, vistas sólo por el
Programador.

**2. Cubierta ≠ auditada a fondo.** El criterio de cobertura es «algún auditor
citó esta pieza en `revisado` o en el `archivo` de un hallazgo». Una pieza citada
de pasada en la evidencia de un hallazgo ajeno cuenta igual que una leída entera.
Es el criterio más generoso posible, elegido a propósito: si aun siendo así
sobran 119 piezas sin nadie, el hueco es incontestable.

**3. Las 119 sin nadie no están repartidas al azar.** 52 módulos de `src/lib`,
49 componentes y 18 colecciones. Entre los módulos: `voz`, `firestore`,
`calendario`, `time-blocks.ts`, `time-blocks-core.ts`, `mfa.ts`,
`firebase-admin.ts`, `receta-folio.ts`, `receta-certificado.ts`,
`contrato-encargo.ts`, `learning.ts` y `memoria-medico.ts`. Ninguno aparece
citado ni una vez en los 42 archivos: se comprobó con `grep` sobre los crudos,
no sólo con el normalizador.

**4. La colección `paquetes_visita` no la miró nadie, y su escritor sí.**
`src/lib/paciente/paquete-de-visita.ts` es de lo más auditado del lote (cinco
auditores, un grupo de duplicados de cinco hallazgos). La colección donde ese
paquete **queda escrito** no aparece nombrada en ningún crudo. Es exactamente la
forma de la regla «el dato tiene que LLEGAR»: se auditó la función que escribe,
no el sitio donde el dato aterriza ni la regla que lo guarda. Lo mismo con
`platform_meta`, `whatsapp_outbox`, `whatsapp_events`, `platform_cost_ledger` y
`internamientos`.

**5. El criterio para colecciones es más débil que el de ruta, y hay que
decirlo.** Una colección no tiene ruta de archivo: se cuenta como revisada si
algún auditor la **nombra** (palabra completa) en su `revisado` o en sus
hallazgos. De las 50 nombradas, sólo **42** aparecen alguna vez en una cadena que
además mencione `firestore` / `colección` / `reglas` / `hasOnly`. Las otras ocho
—`adendas`, `alertas_no_entregadas`, `databases`, `farmacia`, `fotos`,
`hospital_roles`, `registros`, `whatsapp_status`— están nombradas de pasada y su
regla no consta revisada por nadie. Cobertura real de reglas: **42 de 68 (62 %)**,
no 74 %.

**6. El equipo rojo bajó de prioridad a uno de cada tres hallazgos, y casi
siempre hacia abajo.** 137 cambios de prioridad sobre 442: **134 bajadas y 3
subidas**. Los P1 crudos pasaron de 96 a 40; los P3 subieron de 144 a 204 (columna «sin los refutados» de (d)). Esto
se puede leer de dos maneras y las dos merecen quedar escritas: o el panel
inflaba, o el equipo rojo poda. El único dato que separa ambas lecturas es que
**ningún auditor superó el 50 % de refutación** (el techo del §5 Fase 2 que
obligaría a volver a correrlo): el máximo es 18,8 % (A, ingeniero de software) y
la mediana está en 4,5 %. Los hallazgos eran ciertos; lo que se corrigió fue su
tamaño, no su verdad.

**7. Una sola subida importa más que las 134 bajadas.** `ASC-001` entró como P1 y
salió como **P0**: anular un cobro ligado a una cita falla siempre, porque la
transacción lee la cita después de escribir el cobro. Un cobro equivocado no se
puede corregir. Lo levantó el asistente de cobros; lo subió el equipo rojo. Los
P0 crudos eran 5, los finales son 4, pero no son los mismos cuatro: `N-003` y
`PO-001` bajaron a P1 y `ASC-001` subió.

**8. Los 21 pares auditor/equipo rojo están completos.** 442 hallazgos, 442
veredictos, cero pendientes. Al empezar esta fase faltaba `R-AS-enfermeria.json`
y apareció durante la ejecución (07:53Z); el cruce se rehízo entero después. Si
alguien repite el script y le salen 14 pendientes, es que leyó el directorio
antes de esa hora.

**9. 52 grupos de duplicados, 130 hallazgos implicados.** Casi un tercio del lote
es el mismo defecto visto por dos o más auditores. No es desperdicio —es la
corroboración que hace creíble el hallazgo— pero al consolidar hay que fusionar,
o el informe ejecutivo contará 442 problemas donde hay del orden de 370.

---

### (a) Cobertura por tipo de pieza

| Pieza | Total | Con ≥1 auditor | Sin ningún auditor | % cubierto | Con un solo auditor |
|---|---:|---:|---:|---:|---:|
| Rutas de API | 100 | 100 | 0 | 100 % | 54 |
| Pantallas de trabajo (dashboard) | 45 | 45 | 0 | 100 % | 0 |
| Pantallas públicas y otras | 35 | 35 | 0 | 100 % | 21 |
| Módulos de `src/lib` (primer nivel) | 144 | 92 | 52 | 64 % | 44 |
| Colecciones de `firestore.rules` | 68 | 50 | 18 | 74 % | 18 |
| Componentes de `src/components` | 114 | 65 | 49 | 57 % | 40 |
| **Total** | **506** | **387** | **119** | **76 %** | |

### (b) Piezas sin ningún auditor

**Rutas de API — 0 sin cubrir**

Ninguna.

**Pantallas de trabajo (dashboard) — 0 sin cubrir**

Ninguna.

**Pantallas públicas y otras — 0 sin cubrir**

Ninguna.

**Módulos de `src/lib` (primer nivel) — 52 sin cubrir**

- `auth`
- `auth-client.ts`
- `avatar-color.ts`
- `branches.ts`
- `calendario`
- `calidad`
- `chat.ts`
- `cie10.ts`
- `clinical-fact`
- `clinical-reasoning`
- `compliance`
- `contrato-encargo.ts`
- `demo-sandbox.ts`
- `dispositivos`
- `evidence-integrations`
- `evidencia`
- `fhir-export.ts`
- `firebase-admin.ts`
- `firestore`
- `guardia`
- `hoy`
- `invitations.ts`
- `learning.ts`
- `marca.ts`
- `markdown.ts`
- `memoria-medico.ts`
- `metricas`
- `mfa.ts`
- `miembros.ts`
- `modulos.ts`
- `ndjson.ts`
- `nombre-medico.ts`
- `observabilidad`
- `operaciones`
- `ops`
- `pdf-download.ts`
- `print-element.ts`
- `receta-certificado.ts`
- `receta-diseno-client.ts`
- `receta-folio.ts`
- `receta-paginacion.ts`
- `red`
- `reportar-error.ts`
- `superadmin-client.ts`
- `telesalud`
- `tema.ts`
- `time-blocks-core.ts`
- `time-blocks.ts`
- `voz`
- `word-membrete.ts`
- `workflow.ts`
- `xlsx.ts`

**Colecciones de `firestore.rules` — 18 sin cubrir**

- `bed_assignments`
- `chat_reads`
- `farmacia_movimientos`
- `handoff_revisiones`
- `icu_stays`
- `internamientos`
- `learning`
- `memoria_medico`
- `paquetes_visita`
- `platform_admin_log`
- `platform_cost_ledger`
- `platform_meta`
- `platform_packages`
- `uci_copilot_feedback`
- `whatsapp_contacts`
- `whatsapp_events`
- `whatsapp_optout`
- `whatsapp_outbox`

**Componentes de `src/components` — 49 sin cubrir**

- `src/components/AlertasDelEpisodio.tsx`
- `src/components/AvisoConfigNoCargada.tsx`
- `src/components/AvisoCorreoSinVerificar.tsx`
- `src/components/AvisoIncidenteIA.tsx`
- `src/components/AvisoModuloBloqueado.tsx`
- `src/components/AvisoPrivacidadModal.tsx`
- `src/components/CabosSueltosDelPaciente.tsx`
- `src/components/CierreAlPulgar.tsx`
- `src/components/ComoCerrarLaConsulta.tsx`
- `src/components/ContinuidadPanel.tsx`
- `src/components/EmpezarAGrabar.tsx`
- `src/components/EvidenciaEnVivo.tsx`
- `src/components/GuiaConfigurarReceta.tsx`
- `src/components/Herramientas.tsx`
- `src/components/InternamientosDelPaciente.tsx`
- `src/components/LenteContextual.tsx`
- `src/components/MarcaAusculta.tsx`
- `src/components/MarcoEscuchando.tsx`
- `src/components/MetaPixel.tsx`
- `src/components/MientrasHablas.tsx`
- `src/components/MiniMarkdown.tsx`
- `src/components/NerPanel.tsx`
- `src/components/PanelPreventivo.tsx`
- `src/components/PanelRazonamiento.tsx`
- `src/components/PlanPorProblema.tsx`
- `src/components/RastreoErrores.tsx`
- `src/components/RecetaPreviewWrapper.tsx`
- `src/components/TablaNivelesIA.tsx`
- `src/components/TipoCitaIcon.tsx`
- `src/components/TituloDeDocumentoClinico.tsx`
- `src/components/brand/EmptyArt.tsx`
- `src/components/brand/MarcaAuth.tsx`
- `src/components/expediente/ClinicalSpine.tsx`
- `src/components/hospital/GraficaSignos.tsx`
- `src/components/hospital/PanelEnfermeria.tsx`
- `src/components/laboratorio/GraficaLab.tsx`
- `src/components/landing/EsperaDeLaPuerta.tsx`
- `src/components/landing/HeroConsulta.tsx`
- `src/components/landing/NavPublica.tsx`
- `src/components/landing/Revelar.tsx`
- `src/components/motores/QueDiceElMotor.tsx`
- `src/components/operaciones/EstadoDeOperaciones.tsx`
- `src/components/tareas/PorQueEstaAqui.tsx`
- `src/components/tareas/ProgresoResultado.tsx`
- `src/components/ui/Badge.tsx`
- `src/components/ui/Card.tsx`
- `src/components/ui/PageHeader.tsx`
- `src/components/ui/Spinner.tsx`
- `src/components/ui/index.ts`


### (c) Ratio de refutación por auditor

| Auditor | Crudos | Con veredicto | Confirmados | Parciales | Refutados | % refutado | Cambios de prioridad | ↑ | ↓ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A-ingeniero-software (A) | 16 | 16 | 7 | 6 | 3 | 18.8 % | 12 | 0 | 12 |
| AS-mensajeria (ASM) | 25 | 25 | 17 | 5 | 3 | 12 % | 5 | 0 | 5 |
| AS-recepcion (ASR) | 21 | 21 | 10 | 9 | 2 | 9.5 % | 6 | 0 | 6 |
| P-pediatria (PP) | 21 | 21 | 14 | 5 | 2 | 9.5 % | 9 | 0 | 9 |
| M-ginecologa (MG) | 22 | 22 | 17 | 3 | 2 | 9.1 % | 11 | 0 | 11 |
| S-ciberseguridad (S) | 14 | 14 | 11 | 2 | 1 | 7.1 % | 5 | 0 | 5 |
| M-ortopedista (MO) | 16 | 16 | 13 | 2 | 1 | 6.3 % | 9 | 0 | 9 |
| B-ingeniero-ia (B) | 17 | 17 | 12 | 4 | 1 | 5.9 % | 9 | 0 | 9 |
| M-pediatra (MP) | 17 | 17 | 15 | 1 | 1 | 5.9 % | 2 | 0 | 2 |
| C-programador (C) | 38 | 38 | 32 | 4 | 2 | 5.3 % | 7 | 0 | 7 |
| P-cirugia (PC) | 22 | 22 | 17 | 4 | 1 | 4.5 % | 9 | 0 | 9 |
| P-gineco (PG) | 22 | 22 | 15 | 6 | 1 | 4.5 % | 11 | 0 | 11 |
| N-negocio (N) | 26 | 26 | 19 | 6 | 1 | 3.8 % | 8 | 0 | 8 |
| AS-expedientes (ASE) | 27 | 27 | 21 | 5 | 1 | 3.7 % | 2 | 0 | 2 |
| AS-cobros (ASC) | 18 | 18 | 17 | 1 | 0 | 0 % | 4 | 1 | 3 |
| AS-enfermeria (ASN) | 14 | 14 | 10 | 4 | 0 | 0 % | 6 | 0 | 6 |
| D-diseno (D) | 24 | 24 | 22 | 2 | 0 | 0 % | 5 | 0 | 5 |
| M-cirujano (MC) | 22 | 22 | 18 | 4 | 0 | 0 % | 1 | 0 | 1 |
| M-internista (MI) | 14 | 14 | 13 | 1 | 0 | 0 % | 4 | 0 | 4 |
| P-interna (PI) | 25 | 25 | 18 | 7 | 0 | 0 % | 4 | 1 | 3 |
| P-ortopedia (PO) | 21 | 21 | 14 | 7 | 0 | 0 % | 8 | 1 | 7 |
| **Total** | **442** | **442** | **332** | **88** | **22** | **5.0 %** | **137** | **3** | **134** |

### (d) Conteos totales

**Hallazgos crudos por auditor**

| Auditor | Hallazgos |
|---|---:|
| `C-programador.json` | 38 |
| `AS-expedientes.json` | 27 |
| `N-negocio.json` | 26 |
| `AS-mensajeria.json` | 25 |
| `P-interna.json` | 25 |
| `D-diseno.json` | 24 |
| `M-cirujano.json` | 22 |
| `M-ginecologa.json` | 22 |
| `P-cirugia.json` | 22 |
| `P-gineco.json` | 22 |
| `AS-recepcion.json` | 21 |
| `P-ortopedia.json` | 21 |
| `P-pediatria.json` | 21 |
| `AS-cobros.json` | 18 |
| `B-ingeniero-ia.json` | 17 |
| `M-pediatra.json` | 17 |
| `A-ingeniero-software.json` | 16 |
| `M-ortopedista.json` | 16 |
| `AS-enfermeria.json` | 14 |
| `M-internista.json` | 14 |
| `S-ciberseguridad.json` | 14 |

**Por prioridad — cruda vs final**

| Prioridad | Cruda | Final (442) | Final, sin los refutados (420) |
|---|---:|---:|---:|
| P0 | 5 | 4 | 4 |
| P1 | 96 | 40 | 40 |
| P2 | 197 | 172 | 172 |
| P3 | 144 | 226 | 204 |

**Por tipo**

| Clave | Cuenta |
|---|---:|
| defecto | 211 |
| boton_muerto | 30 |
| friccion | 112 |
| innecesario | 29 |
| mejora | 60 |

**Por módulo**

| Clave | Cuenta |
|---|---:|
| practice | 256 |
| nucleo | 53 |
| portal | 86 |
| publico | 37 |
| hospital | 6 |
| uci | 4 |

**Por veredicto del equipo rojo**

| Clave | Cuenta |
|---|---:|
| confirmado | 332 |
| parcial | 88 |
| refutado | 22 |

**P0 y P1 no refutados (prioridad final)**

| id | Prioridad cruda → final | Veredicto | Módulo | `archivo:línea` | Título |
|---|---|---|---|---|---|
| `ASC-001` | P1 → **P0** | confirmado | practice | `src/lib/cobros.ts:441` | Anular un cobro ligado a una cita falla SIEMPRE: la transacción lee la cita después de escribir el cobro, y Firestore la rechaza. Un cobro equivocado no se puede corregir |
| `MP-005` | P0 → **P0** | confirmado | practice | `src/lib/seguridad/dosis.ts:476` | Se puede firmar, imprimir y liberar al cuidador «Amoxicilina 5 mL cada 8 horas» sin decir de qué concentración: no hay campo de presentación, «5 mL» pasa la compuerta de unidad como completa, y el verificador de dosis se salta el renglón |
| `N-001` | P0 → **P0** | confirmado | practice | `src/app/api/stripe/webhook/route.ts:216` | Cambiar de plan cancela la suscripción anual sin abono: el médico pierde los meses que ya pagó, y no queda nota en ninguna parte |
| `N-002` | P0 → **P0** | confirmado | practice | `src/app/api/payment/create-checkout/route.ts:103` | El anticipo que paga el paciente cae en la cuenta de Stripe de la plataforma y se asienta como ingreso del consultorio: el corte de caja reporta dinero que el médico nunca recibió |
| `ASC-002` | P1 → **P1** | confirmado | practice | `firestore.rules:917` | Anular un cobro SIN cita (suelto, membresía) lo niega la regla de Firestore: compara `citaId`/`patientId` por acceso directo y en ese documento no existen. Con ASC-001, hoy ningún cobro se puede anular |
| `ASC-003` | P1 → **P1** | confirmado | practice | `firestore.rules:152` | Escribir `cobroId` a mano en la cita hace desaparecer la deuda del corte, de «por cobrar» y del botón Cobrar sin cobro real ni rastro: la regla de citas sólo vigila la cortesía, no el «ya está pagada» |
| `ASC-004` | P1 → **P1** | confirmado | practice | `src/lib/cobros.ts:403` | Quitar una cortesía no pide motivo, borra quién la autorizó y por qué, y no deja bitácora: el rastro anti-fraude que exige REG-003 se puede deshacer con dos clics |
| `ASE-001` | P1 → **P1** | confirmado | practice | `src/app/(dashboard)/pacientes/page.tsx:168` | Buscar a un paciente por su apellido a secas («iparraguirre») contesta «Ninguno de los 6 expedientes coincide» aunque el paciente existe: la respuesta vacía del servidor pisa el acierto del filtro local |
| `ASE-003` | P1 → **P1** | confirmado | practice | `src/app/(dashboard)/migracion/page.tsx:211` | El importador guarda la fecha de nacimiento tal cual venga («15/03/1980») sin validarla: la edad no se deriva, y ese mismo paciente capturado a mano («1980-03-15») es «otra persona» para el motor de duplicados por siempre |
| `ASE-004` | P1 → **P1** | confirmado | practice | `src/lib/csv-pacientes.ts:80` | Un Excel con «Nombre», «Apellido paterno» y «Apellido materno» en columnas separadas —el formato de casi cualquier sistema mexicano— importa 1 200 pacientes con SOLO el nombre de pila y sin avisar |
| `ASE-010` | P1 → **P1** | confirmado | practice | `src/app/(dashboard)/cumplimiento/page.tsx:931` | Las solicitudes ARCO reales no se pueden ejecutar: llegan del portal sin expediente ligado, no existe pantalla para ligarlas, y el panel manda a «ejecutarla desde su expediente» donde no hay ninguna acción ARCO |
| `ASE-013` | P1 → **P1** | confirmado | practice | `src/lib/salir-seguro.ts:101` | Cerrar sesión desde Pacientes, Agenda u Operaciones —cualquier pantalla sin una consulta abierta— NO limpia la caché IndexedDB de Firestore con los expedientes, aunque Operaciones prometa «nada del consultorio se queda guardado aquí» |
| `ASM-002` | P1 → **P1** | confirmado | nucleo | `src/lib/whatsapp/telefono.ts:18` | Un teléfono de EE.UU. se convierte en silencio en un número mexicano de otra persona: +1 619 555 1234 → 52 619 555 1234 |
| `ASM-004` | P1 → **P1** | confirmado | practice | `src/lib/firestore.ts:638` | Corregir el teléfono del paciente no corrige el de sus citas: el recordatorio de mañana sale al número viejo |
| `ASM-006` | P1 → **P1** | confirmado | practice | `src/app/api/whatsapp/webhook/route.ts:574` | El «SÍ» del paciente al recordatorio se pierde si contesta más de 2 h después: el bot borra la sesión y le manda el menú |
| `ASN-001` | P1 → **P1** | confirmado | practice | `src/app/(dashboard)/consulta/[patientId]/page.tsx:3493` | El primer signo vital que se teclea en una consulta recién abierta pierde su segunda cifra: «154» queda «14», «36.7» queda «3.7», «120/80» queda «10/80», sin aviso |
| `B-001` | P1 → **P1** | confirmado | practice | `src/app/api/consultor-evidencia/route.ts:474` | El prompt del consultor le pide al modelo que AJUSTE la dosis por funcion renal y peso — el ajuste renal tiene motor determinista y este camino no lo usa |
| `MC-001` | P1 → **P1** | confirmado | nucleo | `src/lib/expediente/prompts.ts:823` | El prompt ordena al modelo ASUMIR un punto de Caprini («cirugía menor») a partir de una cirugía pasada mencionada de pasada |
| `MC-003` | P1 → **P1** | confirmado | practice | `src/app/(dashboard)/nota/[patientId]/[notaId]/page.tsx:548` | El consentimiento informado se imprime sólo con la firma del médico: no hay línea para el paciente, testigos, fecha de otorgamiento ni huella del texto aceptado |
| `MC-004` | P1 → **P1** | confirmado | practice | `src/app/(dashboard)/referencia/[patientId]/page.tsx:35` | La carta de referencia no se guarda en ninguna parte: se imprime y desaparece (sin colección, sin auditoría, sin línea de tiempo) |
| `MC-005` | P1 → **P1** | confirmado | practice | `src/lib/expediente/cirugia.ts:177` | Las dosis de profilaxis antibiótica quirúrgica no tienen fuente citada, el registro las declara «pendiente de validación», y el panel las agrega a la nota sin ningún sello de «SIN VALIDAR» |
| `MG-006` | P1 → **P1** | confirmado | nucleo | `src/lib/expediente/prescripcion-segura.ts:293` | «Ácido valproico» y «Metotrexato» no tienen sinónimos: «valproato de magnesio» y «metotrexate», como se recetan en México, no casan y el teratógeno pasa sin aviso |
| `MG-014` | P1 → **P1** | confirmado | portal | `src/lib/paciente/pregunta-del-paciente.ts:208` | «Estoy dando pecho, ¿cómo tomo el ibuprofeno?» no escala: la regex sólo conoce «doy pecho», y la pregunta se contesta desde un plan que nunca consideró la lactancia |
| `MI-001` | P1 → **P1** | confirmado | practice | `src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx:284` | En la receta, el ajuste renal sólo mira los fármacos de hoy: la metformina crónica de mi diabético con ERC no dispara nada aunque su creatinina esté ahí |
| `MI-002` | P1 → **P1** | confirmado | practice | `src/components/RecetaDocumento.tsx:977` | La receta impresa por omisión afirma «ALERGIAS: Negadas / no referidas» aunque nadie haya preguntado, y lee un campo distinto del que revisa la pantalla |
| `MI-004` | P1 → **P1** | confirmado | practice | `src/lib/expediente/medical-dictionary.ts:147` | Una alergia escrita como «cefalosporinas» no dispara nada al recetar ceftriaxona en la receta ni en la compuerta de firma, aunque el copiloto de la consulta sí la ve |
| `MI-005` | P1 → **P1** | confirmado | practice | `src/lib/expediente/medical-dictionary.ts:148` | Una alergia a «betametasona» o a «betabloqueadores» bloquea la firma de la nota como si fuera alergia a betalactámicos, y la única salida es borrar la alergia del expediente |
| `MI-006` | P1 → **P1** | confirmado | practice | `src/lib/seguridad/dosis.ts:293` | En un producto combinado el motor de dosis lee el número equivocado: «Paracetamol/tramadol 325/37.5 mg» se revisa como 37.5 mg de paracetamol, y así se lo dice al médico |
| `MI-014` | P1 → **P1** | confirmado | practice | `src/lib/expediente/funcion-renal.ts:222` | Dos catálogos renales distintos: el AINE contraindicado con TFG<30 avisa en la consulta y NO avisa en la receta, sobre el mismo paciente |
| `MP-003` | P1 → **P1** | confirmado | practice | `src/lib/expediente/pediatria.ts:67` | El neonato no existe para el motor: la pauta «Gentamicina neonatal (≤7 días)» no tiene edad máxima, el «matcher por edad» que promete el comentario no está escrito, y el copiloto la elige por nombre para CUALQUIER niño (falsa alarma crítica en un escolar; y al revés, la pauta de 7.5 mg/kg se ofrece a un recién nacido) |
| `MP-004` | P1 → **P1** | confirmado | practice | `src/lib/seguridad/dosis.ts:187` | REG-043 sigue OPEN y no es sólo un problema «de adultos»: 20 de los 25 fármacos pediátricos no tienen ningún techo en el verificador que corre en consulta y receta, así que a un adolescente de 60 kg (o a un niño de 20 kg con peso capturado) se le puede recetar Prednisona 500 mg u Ondansetrón 80 mg sin un solo aviso |
| `MP-006` | P1 → **P1** | confirmado | practice | `src/app/(dashboard)/consulta/[patientId]/page.tsx:6727` | El hard-stop kg/lb de REG-013 protege sólo al panel: el peso de signos vitales (sin selector de unidad, sin plausibilidad) es el que alimenta la verificación mg/kg de la consulta y de la receta, y la comparación «contra el peso previo» se hace contra el peso de hoy |
| `MP-016` | P1 → **P1** | confirmado | practice | `src/lib/expediente/copiloto.ts:290` | Las contraindicaciones por edad (ibuprofeno < 6 meses, TMP-SMX < 2 meses, nitrofurantoína < 1 mes) sólo viven en el panel: el copiloto llama al motor sin edad y el verificador de la receta no las conoce, así que «Ibuprofeno 30 mg c/8 h» a un lactante de 3 meses pasa consulta y receta sin aviso |
| `N-003` | P0 → **P1** | confirmado | portal | `src/app/api/portal/route.ts:374` | El médico pega su liga de MercadoPago porque la pantalla se lo pide, y el portal cobra por otro sitio: la liga sólo aparece cuando el pago falla |
| `N-004` | P1 → **P1** | confirmado | publico | `src/app/precios/page.tsx:193` | «Los primeros 50 médicos congelan su tarifa de por vida» no existe en el código: ni el contador de 50, ni el cupón, ni la marca de tarifa congelada |
| `N-005` | P1 → **P1** | confirmado | publico | `src/app/page.tsx:207` | La portada promete «Te avisamos tres días antes» de que acabe la prueba, y no existe ningún aviso que salga de la aplicación |
| `PC-001` | P1 → **P1** | confirmado | portal | `src/app/api/portal/route.ts:1090` | El paciente lee como suyos diagnósticos presuntivos, descartados y propuestos por la IA: el portal vuelca todos los diagnósticos de la nota firmada sin filtrar por tipo, tanto en «Mis recetas» como en el resumen del plan de cuidado |
| `PG-005` | P1 → **P1** | confirmado | publico | `src/lib/legal/subencargados.ts:150` | El aviso de privacidad publicado dice que Meta/WhatsApp «no trata datos de salud», mientras el portal manda por WhatsApp del consultorio el nombre de la paciente y su pregunta íntegra («tengo sangrado…») |
| `PI-001` | P1 → **P1** | confirmado | portal | `src/lib/paciente/pregunta-del-paciente.ts:276` | Le pregunté si podía SALTARME la pastilla y el portal me contestó cómo tomarla, sin avisar a nadie |
| `PI-002` | P1 → **P1** | confirmado | portal | `src/lib/paciente/pregunta-del-paciente.ts:357` | Conté un efecto raro del diurético («cuando tomo la furosemida me da mucha sed, ¿es normal?») y me contestó la pauta; la queja no llegó al médico |
| `PI-004` | P1 → **P1** | confirmado | portal | `src/app/api/portal/route.ts:331` | A las 2 a.m., tras recargar el portal cinco veces, escribí «me duele el pecho y me falta el aire» y me contestó «Demasiadas consultas a tus documentos»: la urgencia no se registró ni avisó a nadie |
| `PO-001` | P0 → **P1** | confirmado | portal | `src/app/api/portal/route.ts:1090` | La receta que el paciente descarga (y que reenvía al jefe) imprime como «diagnóstico» TODOS los diagnósticos de la nota: descartados, presuntivos, resueltos y propuestas de la IA sin confirmar |
| `PO-010` | P2 → **P1** | confirmado | portal | `src/app/api/portal/route.ts:118` | El enlace de AGENDA —el que emite cualquier asistente— devuelve al navegador el `motivo` clínico de cada cita y lo incrusta en el enlace «Agendar» de Google Calendar |
| `S-002` | P1 → **P1** | confirmado | practice | `src/types/index.ts:371` | La recepción lee y ESCRIBE las alergias del paciente, de las que dependen la compuerta de la receta y el cruce de la nota |

### (e) Grupos de duplicados

52 grupos con hallazgos de más de un auditor (130 hallazgos implicados).

| Grupo | Motivo | Archivo | Miembros |
|---:|---|---|---|
| 1 | mismo archivo ±10 líneas, auditores distintos | `src/lib/clinical/registry.ts` | `A-002`(A L1733 P2) · `MG-007`(MG L1728 P2) · `MI-012`(MI L1732 P3) |
| 2 | mismo archivo ±10 líneas, auditores distintos | `public/sw.js` | `A-007`(A L74 P3) · `PC-017`(PC L66 P3) |
| 3 | mismo archivo ±10 líneas, auditores distintos | `firestore.rules` | `ASC-003`(ASC L152 P1) · `S-007`(S L151 P2) |
| 4 | se citan en `relacionado`, auditores distintos | — | `ASC-005`(ASC L677 P2) · `ASC-012`(ASC L73 P3) · `N-002`(N L103 P0) |
| 5 | se citan en `relacionado`, auditores distintos | — | `ASC-006`(ASC L50 P2) · `ASE-018`(ASE L54 P2) · `D-015`(D L30 P3) |
| 6 | se citan en `relacionado`, auditores distintos | — | `ASC-007`(ASC L123 P2) · `ASC-013`(ASC L121 P3) · `C-027`(C L119 P3) |
| 7 | mismo archivo ±10 líneas, auditores distintos | `src/components/OnboardingTour.tsx` | `ASN-014`(ASN L22 P3) · `ASE-023`(ASE L22 P3) |
| 8 | se citan en `relacionado`, auditores distintos | — | `ASE-010`(ASE L931 P1) · `ASE-011`(ASE L268 P2) · `ASE-026`(ASE L277 P3) · `S-001`(S L174 P2) |
| 9 | mismo archivo ±10 líneas, auditores distintos | `src/app/(dashboard)/cumplimiento/page.tsx` | `ASE-012`(ASE L352 P2) · `C-007`(C L352 P3) |
| 10 | se citan en `relacionado`, auditores distintos | — | `ASE-017`(ASE L209 P3) · `S-010`(S L96 P3) |
| 11 | mismo archivo ±10 líneas, auditores distintos | `src/app/(dashboard)/pacientes/page.tsx` | `ASE-020`(ASE L1174 P2) · `ASR-020`(ASR L1175 P3) |
| 12 | mismo archivo ±10 líneas, auditores distintos | `src/app/(dashboard)/pacientes/page.tsx` | `ASM-001`(ASM L950 P2) · `C-023`(C L950 P3) |
| 13 | mismo archivo ±10 líneas, auditores distintos | `src/lib/whatsapp-send.ts` | `ASM-009`(ASM L171 P2) · `N-025`(N L168 P3) |
| 14 | mismo archivo ±10 líneas, auditores distintos | `src/app/(dashboard)/citas/page.tsx` | `ASM-010`(ASM L1061 P2) · `ASR-004`(ASR L1061 P2) |
| 15 | mismo archivo ±10 líneas, auditores distintos | `src/app/(dashboard)/configuracion/page.tsx` | `ASM-016`(ASM L843 P3) · `C-002`(C L843 P3) |
| 16 | mismo archivo ±10 líneas, auditores distintos | `src/app/api/cron/reminders/route.ts` | `ASM-017`(ASM L304 P3) · `PG-018`(PG L300 P3) |
| 17 | mismo archivo ±10 líneas, auditores distintos | `src/app/(dashboard)/operaciones/page.tsx` | `ASM-022`(ASM L154 P3) · `N-012`(N L154 P3) |
| 18 | mismo archivo ±10 líneas, auditores distintos | `src/app/(dashboard)/citas/page.tsx` | `ASM-023`(ASM L901 P3) · `ASR-009`(ASR L905 P2) |
| 19 | se citan en `relacionado`, auditores distintos | — | `C-001`(C L2297 P2) · `PI-005`(PI L203 P2) |
| 20 | mismo archivo ±10 líneas, auditores distintos | `src/app/privacidad/[clinicId]/page.tsx` | `C-005`(C L114 P3) · `PI-023`(PI L234 P3) |
| 21 | mismo archivo ±10 líneas, auditores distintos | `src/app/privacidad/[clinicId]/page.tsx` | `C-006`(C L65 P2) · `PG-016`(PG L65 P2) |
| 22 | mismo archivo ±10 líneas, auditores distintos | `src/components/PanelGineco.tsx` | `C-014`(C L31 P2) · `MG-022`(MG L35 P2) |
| 23 | mismo archivo ±10 líneas, auditores distintos | `src/components/AppointmentModal.tsx` | `C-024`(C L522 P2) · `D-003`(D L513 P2) |
| 24 | mismo archivo ±10 líneas, auditores distintos | `src/components/Sidebar.tsx` | `C-034`(C L28 P3) · `D-014`(D L32 P3) · `D-024`(D L22 P3) |
| 25 | se citan en `relacionado`, auditores distintos | — | `D-007`(D L218 P2) · `PI-017`(PI L1085 P3) |
| 26 | mismo archivo ±10 líneas, auditores distintos | `src/lib/paciente/pregunta-del-paciente.ts` | `MC-016`(MC L187 P2) · `MO-010`(MO L185 P3) |
| 27 | mismo archivo ±10 líneas, auditores distintos | `src/app/mi/[token]/page.tsx` | `MG-012`(MG L176 P2) · `PC-008`(PC L177 P2) |
| 28 | mismo archivo ±10 líneas, auditores distintos | `src/lib/paciente/urgencia.ts` | `MG-013`(MG L48 P2) · `PG-001`(PG L48 P2) |
| 29 | mismo archivo ±10 líneas, auditores distintos | `src/lib/paciente/paquete-de-visita.ts` | `MG-015`(MG L344 P2) · `PC-002`(PC L342 P2) · `PC-020`(PC L334 P3) · `PG-014`(PG L338 P3) · `PO-002`(PO L338 P2) |
| 30 | mismo archivo ±10 líneas, auditores distintos | `src/app/(dashboard)/consulta/[patientId]/page.tsx` | `MG-017`(MG L753 P3) · `MP-001`(MP L744 P3) |
| 31 | mismo archivo ±10 líneas, auditores distintos | `src/lib/herramientas-por-especialidad.ts` | `MG-018`(MG L108 P3) · `MO-014`(MO L112 P3) |
| 32 | mismo archivo ±10 líneas, auditores distintos | `src/lib/expediente/funcion-renal.ts` | `MI-014`(MI L222 P1) · `MO-006`(MO L223 P3) |
| 33 | se citan en `relacionado`, auditores distintos | — | `MP-013`(MP L276 P3) · `MP-014`(MP L262 P2) · `PI-001`(PI L276 P1) · `PO-018`(PO L276 P3) |
| 34 | mismo archivo ±10 líneas, auditores distintos | `src/app/api/portal/route.ts` | `PC-001`(PC L1090 P1) · `PO-001`(PO L1090 P1) |
| 35 | se citan en `relacionado`, auditores distintos | — | `PC-003`(PC L447 P2) · `PC-004`(PC L899 P3) · `PI-020`(PI L450 P3) · `PP-021`(PP L450 P3) |
| 36 | mismo archivo ±10 líneas, auditores distintos | `src/lib/paciente/urgencia.ts` | `PC-005`(PC L197 P2) · `PI-014`(PI L199 P3) |
| 37 | mismo archivo ±10 líneas, auditores distintos | `src/app/api/portal/route.ts` | `PC-006`(PC L331 P2) · `PI-004`(PI L331 P1) |
| 38 | mismo archivo ±10 líneas, auditores distintos | `src/app/reservar/[clinicId]/page.tsx` | `PC-007`(PC L203 P3) · `PG-007`(PG L203 P2) · `PO-006`(PO L203 P2) · `PP-012`(PP L203 P2) |
| 39 | mismo archivo ±10 líneas, auditores distintos | `src/app/(dashboard)/consulta/[patientId]/page.tsx` | `PC-012`(PC L1810 P3) · `PG-004`(PG L1810 P3) · `PI-008`(PI L1810 P3) |
| 40 | mismo archivo ±10 líneas, auditores distintos | `src/app/reservar/[clinicId]/page.tsx` | `PC-013`(PC L337 P2) · `PG-006`(PG L331 P2) · `PO-007`(PO L331 P2) |
| 41 | mismo archivo ±10 líneas, auditores distintos | `src/lib/patient-token.ts` | `PC-018`(PC L27 P3) · `PO-009`(PO L26 P3) |
| 42 | mismo archivo ±10 líneas, auditores distintos | `src/app/page.tsx` | `PC-021`(PC L1 P3) · `PG-019`(PG L1 P3) · `PI-024`(PI L1 P3) |
| 43 | mismo archivo ±10 líneas, auditores distintos | `src/components/EntregarAlPaciente.tsx` | `PG-002`(PG L257 P2) · `PO-004`(PO L257 P2) |
| 44 | mismo archivo ±10 líneas, auditores distintos | `src/app/(dashboard)/consulta/[patientId]/page.tsx` | `PG-003`(PG L7462 P2) · `PI-003`(PI L7461 P2) · `PO-016`(PO L7462 P2) · `PP-009`(PP L7460 P3) |
| 45 | mismo archivo ±10 líneas, auditores distintos | `src/app/mi/[token]/page.tsx` | `PG-010`(PG L1128 P3) · `PP-017`(PP L1120 P3) |
| 46 | mismo archivo ±10 líneas, auditores distintos | `src/app/mi/[token]/page.tsx` | `PG-011`(PG L1086 P2) · `PI-013`(PI L1086 P3) · `PO-014`(PO L1086 P2) · `PO-017`(PO L1079 P3) · `PO-021`(PO L1079 P3) · `PP-020`(PP L1079 P3) |
| 47 | mismo archivo ±10 líneas, auditores distintos | `src/app/(dashboard)/expediente/[patientId]/page.tsx` | `PG-012`(PG L665 P3) · `PI-022`(PI L665 P3) |
| 48 | mismo archivo ±10 líneas, auditores distintos | `src/app/mi/[token]/page.tsx` | `PG-015`(PG L432 P3) · `PI-021`(PI L432 P3) |
| 49 | mismo archivo ±10 líneas, auditores distintos | `src/app/api/portal/route.ts` | `PI-009`(PI L686 P2) · `PI-010`(PI L1001 P2) · `PP-008`(PP L695 P2) |
| 50 | mismo archivo ±10 líneas, auditores distintos | `src/lib/paciente/urgencia.ts` | `PI-011`(PI L160 P2) · `PP-002`(PP L163 P2) |
| 51 | mismo archivo ±10 líneas, auditores distintos | `src/app/mi/[token]/page.tsx` | `PI-025`(PI L258 P3) · `PO-008`(PO L254 P2) |
| 52 | mismo archivo ±10 líneas, auditores distintos | `src/app/privacidad/[clinicId]/page.tsx` | `PO-012`(PO L187 P2) · `PP-013`(PP L197 P3) |

15 grupos más son **referencias cruzadas dentro de un mismo auditor** (`relacionado`), no dos ojos sobre la misma pieza; se listan aparte para que nadie los cuente como corroboración.

| Grupo | Auditor | Miembros |
|---:|---|---|
| 1 | ASC | `ASC-001` · `ASC-002` |
| 2 | ASC | `ASC-008` · `ASC-014` |
| 3 | ASR | `ASR-001` · `ASR-002` · `ASR-011` |
| 4 | ASR | `ASR-005` · `ASR-006` |
| 5 | MC | `MC-006` · `MC-017` |
| 6 | MC | `MC-008` · `MC-019` |
| 7 | MC | `MC-009` · `MC-022` |
| 8 | MG | `MG-001` · `MG-002` · `MG-003` · `MG-004` · `MG-005` · `MG-006` · `MG-016` |
| 9 | MG | `MG-010` · `MG-011` |
| 10 | MO | `MO-001` · `MO-002` · `MO-003` · `MO-013` |
| 11 | MO | `MO-004` · `MO-005` · `MO-011` |
| 12 | MP | `MP-002` · `MP-011` |
| 13 | MP | `MP-003` · `MP-016` |
| 14 | MP | `MP-004` · `MP-005` · `MP-008` · `MP-015` |
| 15 | MP | `MP-006` · `MP-007` |

### (f) Lo que los auditores declararon no haber alcanzado


**A-ingeniero-software** (`A-ingeniero-software.json`)

- npx vitest run y npm run build: no se ejecutaron en esta rebanada. La linea base la anota el orquestador en la Fase 0.
- Barrido inverso del registro de motores (toda funcion clinica llamada desde una pantalla esta en entryPoints) sobre los 93 motores: solo se hizo sobre los que salieron al tirar del hilo de A-001 y A-002.
- Lectura una a una de las ~290 cabeceras de golden que SI existen para comprobar si declaran «que NO cubre». El hallazgo A-009 se levanta solo sobre los 29 que no tienen ninguna cabecera, que es lo incontestable.
- Tautologias por mock (un doble que devuelve exactamente lo que la asercion afirma): no se detectan con un patron de texto y requieren lectura archivo a archivo. No se buscaron.
- Condiciones de carrera en las ~70 rutas de API que hacen lectura y escritura fuera de transaccion: se revisaron a fondo los caminos de dinero (cobros, appointments, stripe) y estan defendidos. Las rutas de superadmin y de configuracion no se revisaron una a una.
- src/lib/uci (46 archivos) y src/lib/hospital (20) mas alla de lo que toco el barrido de alcanzabilidad y el modelo de tarea. Modulos en pausa (D-030); prioridad menor que Practice.
- src/lib/durability (19 archivos, 4907 lineas) mas alla de comprobar que es alcanzable solo desde scripts/recovery.
- Los 114 componentes y las 45 pantallas: no son de esta rebanada (van al Programador y a Diseno).

**AS-recepcion** (`AS-recepcion.json`)

- Doble reserva en vivo: no se pudo crear ninguna cita (POST 500, ASR-001); la defensa se verificó sólo en código (AppointmentModal.tsx:228, route.ts:202-224).
- Reprogramar y cancelar mi propia cita de prueba: no llegó a existir; cancelé una cita sintética del día en su lugar.
- Google Calendar con cuenta real y envío real de WhatsApp (prohibidos).
- Los pasos 2-5 de la reserva pública (fecha, hora, datos, consentimientos): la página no ofrece tipos (ASR-002).
- Configuración: zona horaria y horario NO se cambiaron para no romper a los demás auditores; sólo se leyó y se pulsó «+ Añadir descanso» sin guardar.
- Pantalla /consulta (rol médico), fuera de mi rebanada.

**C-programador** (`C-programador.json`)

- Recorrido con la app levantada (escritorio/móvil/teclado/consola/red): lo hará otra pasada; aquí todo es lectura de código.
- Los 29 inputs sin id de hospitalizacion/[internamientoId]/page.tsx no se revisaron uno por uno: se muestreó (1185-1215, 307-324).
- Componentes no abiertos: AlertasDelEpisodio, AlertasDictado, AvisoConfigNoCargada, AvisoCorreoSinVerificar, AvisoIncidenteIA, AvisoModuloBloqueado, AvisoPrivacidadModal, AutoLogout, CabosSueltosDelPaciente, CambiosCifrasPanel, CierreAlPulgar, ComoCerrarLaConsulta, ContinuidadPanel, Copiloto, CorreccionesPanel, DeDondeSalioEsto, EmpezarAGrabar, EscucharElMomento, EvidenciaEnVivo, FirmadorDisenos, GuiaConfigurarReceta, Herramientas, InternamientosDelPaciente, LenteContextual, MarcaAusculta, MarcoEscuchando, MetaPixel, MientrasHablas, MiniMarkdown, NerPanel, PanelCardiometabolico, PanelCirugia, PanelPreventivo, PanelRazonamiento, PlanPorProblema, PreopAssessment, QueNotaEs, RastreoErrores, RecetaPreviewWrapper, RevisionPanel, SelloMotor, SelloProcedencia, ServiceWorkerRegister, TablaNivelesIA, TipoCitaIcon, TituloDeDocumentoClinico, brand/*, expediente/ClinicalSpine, expediente/ProcedenciaDeLaNota, expediente/ResumenPaciente, hospital/*, landing/*, lente/*, motores/*, operaciones/*, pacientes/ValoracionInmuno (sólo greps), tareas/*. Sí entraron en los barridos globales (alert/href/onClick/img/outline/plural/toLocale).
- Dependencias de useEffect que disparen escrituras: no se auditaron a fondo; sólo se inspeccionaron las lecturas con .then/.catch.
- Contraste de color y tamaño de objetivo táctil: requieren render; no se midieron.

**M-ginecologa** (`M-ginecologa.json`)

- No se ejecutó la extracción real para comprobar qué diagnóstico produce el modelo ante «amenorrea de 8 semanas, prueba positiva»; MG-001 lo trata como dependencia no determinista.
- No se recorrió el flujo en el navegador (sólo lectura): el conteo de clics de MG-022 es por lectura de la pantalla.
- No se auditó el módulo de hospitalización/UCI para pacientes obstétricas (en pausa, D-030).
- No se revisó la receta del portal (receta-token.ts) más allá de confirmar que no consulta la tabla gestacional.

**M-pediatra** (`M-pediatra.json`)

- src/app/(dashboard)/consulta/[patientId]/page.tsx: sólo las regiones citadas (7 567 líneas); no recorrí el modal de consentimiento completo (1800-1930) ni las rutas de IA que reciben `contexto.edad` (2195, 2280, 2399, 4585).
- No lancé el producto (prohibido en esta tarea): lo visual del aviso (MP-015) se infiere del código, no de la pantalla.
- src/lib/dosing/** revisado pero es de adulto UCI; no lo audité en profundidad por no ser pediátrico.
- Contenido clínico de FARMACOS_PED, CATALOGO y ESQUEMA_MX (cifras, edades): NO lo valido; es criterio del Dr. (NEEDS_CLINICAL_REVIEW global).

**P-cirugia** (`P-cirugia.json`)

- Pago del anticipo por Stripe (sin anticipo configurado en el demo: sólo código).
- Reseña en la app levantada (el token lo crea el cron tras la cita; sólo código).
- Teleconsulta (/teleconsulta/[citaId]) y verificación de receta (/verificar/[token]).
- Modo offline real (deducido de sw.js, no probado sin red).
- Peso de página en producción (dev inflado a 2.4 MB de JS).
- Contraste de color (no medido).
- Ejecución de vitest sobre evals/patient-ai (leí los casos y probé el clasificador aparte).

**P-ortopedia** (`P-ortopedia.json`)

- Reserva pública más allá del primer paso (sin tipos de cita en el consultorio sintético): fecha, hora, datos y consentimientos sólo por código
- Pago de anticipo (Stripe) y reseña con token válido: sólo por código
- Peso real de la página en build de producción (5-6 MB medidos en el servidor de desarrollo no son representativos)
- Envío real de WhatsApp (no hay proveedor en el emulador)
- Firma de una nota nueva y liberación real de un paquete desde la consulta (dictado no reproducible en el arnés): la composición se auditó por código
- Recordatorios (cron/reminders) y la teleconsulta

**P-pediatria** (`P-pediatria.json`)

- Agendar de punta a punta desde la página pública (el consultorio sintético no tiene tipos de cita ni horarios): el formulario y el booking se auditaron sobre código.
- Confirmación por WhatsApp, entrega del paquete y aviso al consultorio (no se mandan mensajes reales).
- La consulta con grabación sobre el menor sintético y la liberación de un paquete real (no se creó nota firmada: sólo lectura).
- Pago del anticipo (el consultorio sintético no tiene anticipoLink) y la pantalla de reseña con enlace válido.
- Medición de contraste real y prueba con lector de pantalla real; prueba sin conexión del portal.
- El bot de WhatsApp en vivo: sólo código.

### Anexo — quién revisó cada ruta de API y cada pantalla


**Rutas de API**

| Pieza | n.º | Auditores |
|---|---:|---|
| `/api/appointments` | 3 | A ASR S |
| `/api/arco/acceso` | 2 | ASE S |
| `/api/arco/cancelar` | 2 | ASE S |
| `/api/arco/oponerse` | 2 | ASE S |
| `/api/auditoria/registrar` | 1 | S |
| `/api/ayuda-bot` | 2 | B S |
| `/api/calendar/calendars` | 1 | S |
| `/api/calendar/callback` | 1 | S |
| `/api/calendar/connect` | 1 | S |
| `/api/calendar/ocupado` | 1 | S |
| `/api/calendar/status` | 1 | S |
| `/api/calendar/sync` | 1 | S |
| `/api/clinic/ai-keys` | 1 | S |
| `/api/clinic/crear` | 2 | N S |
| `/api/clinic/exportar-csv` | 1 | S |
| `/api/clinic/exportar-excel` | 1 | S |
| `/api/clinic/exportar` | 1 | S |
| `/api/clinic/importar` | 1 | S |
| `/api/clinic/miembros` | 1 | S |
| `/api/clinic/unirse` | 1 | S |
| `/api/clinic/whatsapp-disconnect` | 1 | S |
| `/api/config/imagen` | 2 | MC S |
| `/api/consultor-evidencia` | 2 | B S |
| `/api/cron/asientos` | 2 | N S |
| `/api/cron/limpiar-audio` | 1 | S |
| `/api/cron/reminders` | 5 | ASM N PC PG S |
| `/api/cron/retencion` | 1 | S |
| `/api/cron/vigilante` | 1 | S |
| `/api/csp-report` | 1 | S |
| `/api/cumplimiento/bitacora` | 1 | S |
| `/api/demo/evidencia` | 1 | S |
| `/api/errores` | 1 | S |
| `/api/expediente/antibiograma-razonar` | 1 | S |
| `/api/expediente/antibiograma-vision` | 1 | S |
| `/api/expediente/atribuir-roles` | 2 | B S |
| `/api/expediente/corregir` | 2 | B S |
| `/api/expediente/evidencia` | 2 | B S |
| `/api/expediente/exportar/[patientId]` | 1 | S |
| `/api/expediente/extraer-entidades` | 2 | B S |
| `/api/expediente/laboratorio-vision` | 1 | S |
| `/api/expediente/paquete-de-visita` | 5 | B PC PG PO S |
| `/api/expediente/pregunta-atendida` | 2 | PG S |
| `/api/expediente/procesar` | 3 | B MG S |
| `/api/expediente/transcribir-chunk` | 2 | B S |
| `/api/expediente/transcribir-diarizado` | 3 | A B S |
| `/api/expediente/transcribir` | 2 | B S |
| `/api/expediente/verificar-nota` | 2 | B S |
| `/api/facturacion/descargar` | 1 | S |
| `/api/facturacion/pagos` | 1 | S |
| `/api/facturacion/solicitar` | 1 | S |
| `/api/fhir/paciente/[patientId]` | 1 | S |
| `/api/health` | 1 | S |
| `/api/hl7/convertir` | 1 | S |
| `/api/hospital/alerta` | 2 | ASM S |
| `/api/hospital/mutar` | 1 | S |
| `/api/inmuno/redactar` | 1 | S |
| `/api/mantenimiento/backfill-contadores` | 1 | S |
| `/api/payment/create-checkout` | 6 | ASC N PC PG PI S |
| `/api/planes` | 1 | S |
| `/api/portal/link` | 6 | PC PG PI PO PP S |
| `/api/portal` | 11 | ASM B MG MP N PC PG PI PO PP S |
| `/api/public/availability/[clinicId]` | 1 | S |
| `/api/public/booking` | 8 | ASM MP PC PG PI PO PP S |
| `/api/public/clinic/[clinicId]` | 4 | ASR PI PO S |
| `/api/public/resena` | 3 | PC PI S |
| `/api/receta/detectar-campos` | 1 | S |
| `/api/receta/diseno-url` | 2 | MC S |
| `/api/receta/diseno` | 2 | MC S |
| `/api/receta/verificacion-url` | 1 | S |
| `/api/seguridad/csp-estado` | 1 | S |
| `/api/soporte` | 1 | S |
| `/api/stripe/asientos` | 2 | N S |
| `/api/stripe/checkout` | 2 | N S |
| `/api/stripe/portal` | 2 | N S |
| `/api/stripe/recarga` | 2 | N S |
| `/api/stripe/webhook` | 3 | ASC N S |
| `/api/superadmin/accion` | 1 | S |
| `/api/superadmin/clientes` | 2 | N S |
| `/api/superadmin/contabilidad` | 1 | S |
| `/api/superadmin/costos` | 1 | S |
| `/api/superadmin/csp` | 1 | S |
| `/api/superadmin/incidentes` | 1 | S |
| `/api/superadmin/onboarding` | 1 | S |
| `/api/superadmin/paquetes` | 1 | S |
| `/api/superadmin/planes` | 1 | S |
| `/api/superadmin/simulador` | 1 | S |
| `/api/telesalud/sala` | 1 | S |
| `/api/telesalud/token` | 1 | S |
| `/api/uci/copilot` | 3 | A B S |
| `/api/uci/estancia` | 1 | S |
| `/api/voz/comandos-config` | 1 | S |
| `/api/whatsapp/360dialog-callback` | 2 | ASM S |
| `/api/whatsapp/360dialog-connect` | 2 | ASM S |
| `/api/whatsapp/360dialog-webhook` | 2 | ASM S |
| `/api/whatsapp/entregas` | 2 | ASM S |
| `/api/whatsapp/manual-connect` | 2 | ASM S |
| `/api/whatsapp/meta-connect` | 2 | ASM S |
| `/api/whatsapp/plantillas-config` | 2 | ASM S |
| `/api/whatsapp/waitlist-notify` | 2 | ASM S |
| `/api/whatsapp/webhook` | 5 | ASM MG PG PP S |

**Pantallas de trabajo**

| Pieza | n.º | Auditores |
|---|---:|---|
| `/antibiograma` | 3 | C D MI |
| `/asistente` | 3 | ASR C D |
| `/calendario` | 3 | ASR C D |
| `/chat` | 3 | ASM C D |
| `/citas` | 7 | ASC ASN ASM ASR C D N |
| `/configuracion` | 7 | ASC ASE ASM ASR C D N |
| `/consulta/[patientId]` | 15 | ASC ASN C D MC MG MI MO MP N PC PG PI PO PP |
| `/consultor` | 3 | C D MI |
| `/corte-caja` | 3 | ASC C D |
| `/crm` | 4 | ASM C D N |
| `/cumplimiento/motores` | 4 | C D MC MI |
| `/cumplimiento` | 4 | ASE C D MC |
| `/cumplimiento/retencion` | 3 | ASE C D |
| `/cumplimiento/seguridad` | 3 | ASE C D |
| `/dashboard` | 5 | ASN ASR C D N |
| `/expediente/[patientId]` | 10 | ASN C D MC MI PC PG PI PO PP |
| `/expedientes` | 3 | ASE C D |
| `/farmacia` | 4 | C D MI N |
| `/finanzas` | 3 | ASC C D |
| `/guia` | 2 | C D |
| `/hospitalizacion/[internamientoId]` | 4 | ASN C D MC |
| `/hospitalizacion/camas` | 2 | C D |
| `/hospitalizacion/indicadores` | 2 | C D |
| `/hospitalizacion` | 2 | C D |
| `/hospitalizacion/unidades` | 2 | C D |
| `/legal` | 4 | ASE C D MC |
| `/lista-espera` | 4 | ASM ASR C D |
| `/membresias` | 4 | ASC C D N |
| `/migracion` | 3 | ASE C D |
| `/motores` | 3 | C D MI |
| `/nota/[patientId]/[notaId]` | 5 | C D MC MI MO |
| `/nota/[patientId]` | 4 | C D MC MI |
| `/operaciones` | 6 | ASC ASE ASM C D N |
| `/orden/[patientId]/[notaId]` | 7 | C D MC MG MI MO PO |
| `/pacientes` | 6 | ASE ASM ASR C D MP |
| `/pendientes` | 6 | ASN ASR C D PG PO |
| `/reactivacion` | 3 | ASM C D |
| `/receta/[patientId]/[notaId]` | 6 | C D MG MI MO MP |
| `/referencia/[patientId]` | 4 | C D MC MI |
| `/resenas` | 3 | ASM C D |
| `/uci/antimicrobianos` | 2 | C D |
| `/uci/benchmark` | 2 | C D |
| `/uci/dosificacion` | 2 | C D |
| `/uci/enfermeria` | 3 | ASN C D |
| `/uci` | 3 | B C D |

**Pantallas públicas**

| Pieza | n.º | Auditores |
|---|---:|---|
| `/arquitectura` | 1 | C |
| `/contacto` | 1 | C |
| `/demo/interactivo` | 1 | C |
| `/demo` | 1 | C |
| `/demo/razonamiento` | 1 | C |
| `/dr/[clinicId]` | 7 | C D PC PG PI PO PP |
| `/evidencia` | 1 | C |
| `/login` | 2 | C D |
| `/mi/[token]` | 10 | C D MG MP N PC PG PI PO PP |
| `/operacion` | 1 | C |
| `/` | 8 | C D N PC PG PI PO PP |
| `/pago/cancelado` | 2 | C PI |
| `/pago/exito` | 2 | C PI |
| `/paquetes` | 2 | C N |
| `/precios` | 3 | C D N |
| `/privacidad/[clinicId]` | 8 | ASE C D PC PG PI PO PP |
| `/privacidad` | 1 | C |
| `/registro` | 3 | C D N |
| `/resena/[token]` | 6 | C PC PG PI PO PP |
| `/reservar/[clinicId]` | 7 | C D PC PG PI PO PP |
| `/seguridad` | 1 | C |
| `/setup` | 2 | C N |
| `/superadmin/contabilidad` | 1 | C |
| `/superadmin/costos` | 1 | C |
| `/superadmin/csp` | 1 | C |
| `/superadmin/errores` | 1 | C |
| `/superadmin/onboarding` | 1 | C |
| `/superadmin` | 1 | C |
| `/superadmin/planes` | 1 | C |
| `/superadmin/simulador` | 1 | C |
| `/superadmin/soporte` | 1 | C |
| `/teleconsulta/[citaId]` | 1 | C |
| `/terminos` | 1 | C |
| `/unirse/[code]` | 1 | C |
| `/verificar/[token]` | 2 | C PI |

---

### (g) Línea base de la Fase 0

Copiada literal de `agent-state/AUDITORIA_PANEL_STATE.json` → `fases.0_linea_base`:

```json
{
  "estado": "hecha",
  "inventario": "hecho",
  "vitest": "12876 pasan / 1 falla ambiental (ops-timeout-y-punto-ciego, proxy del contenedor)",
  "lint": "93 = techo",
  "build": "TS pasa; sin env falla en /dr/[clinicId] (Firebase al importar); con env del arnés compila",
  "mantenimiento": "script no existe en package.json aunque CLAUDE.md lo cita",
  "app_levantada": "sí — emuladores auth+firestore sembrados, next dev :3200, demo@nexusmed.test"
}
```

Dos cosas de esa línea base condicionan lo que se puede afirmar en este
documento, y quedan dichas aquí para que no se pierdan: `npm run mantenimiento`
**no existe** en `package.json` aunque `CLAUDE.md` lo cita como comando, y el
`build` sólo compila con el entorno del arnés. La suite entra a la auditoría con
una falla ambiental, no clínica.

### (h) El corte por límite de sesión

Copiado literal de `agent-state/AUDITORIA_PANEL_STATE.json` → `incidente`:

> `2026-09-06 ~04:30Z: límite de sesión (429) tumbó 10 agentes; el contenedor se reinició; todos los archivos escritos antes del corte estaban completos y válidos; relanzados a las 07:45Z`

Efecto sobre esta fase: los archivos de `crudos/` se escribieron en dos tandas
(03:13–03:56Z y 07:51–07:53Z). El cruce de este documento se corrió **después**
de la segunda tanda, con los 42 archivos presentes y los 21 pares completos. La
única consecuencia visible del corte es la que dice el punto 8 de arriba: un
veredicto rojo (`R-AS-enfermeria.json`) aterrizó mientras esta fase ya estaba en
marcha, y obligó a rehacer el cruce.

Lo que el incidente **no** permite afirmar: que ningún agente tumbado dejara
trabajo a medias sin declararlo. Los diez relanzados devolvieron JSON completo y
válido, pero un auditor que se cae a mitad de su barrido y se relanza no
necesariamente recorre lo mismo que habría recorrido de un tirón. Las 119 piezas
sin auditor de (b) son el resultado observado; cuánto de eso es el corte y cuánto
es reparto original, no se puede separar desde aquí.

### (i) Método — el script, entero

Se corrió con `node cobertura.mjs --escribir` desde cualquier directorio (usa
rutas absolutas). Sólo lee `00-INVENTARIO.md` y `crudos/*.json`; lo único que
escribe son `01-HALLAZGOS-CRUDOS.json` y `02-HALLAZGOS-VERIFICADOS.json`, y por
`stdout` el JSON con todo el cruce del que salen las tablas de arriba.

Normalización de rutas: se recorta `:línea`, se parte por el primer espacio o
guión largo (para citas en prosa del tipo `` `firestore.rules — appointments
(l.134-170)` ``) y se comparan variantes con y sin `src/`, con y sin `/route.ts`
y con y sin `/page.tsx`. Una entrada de `src/lib` cuenta como revisada si alguna
cita cae dentro de esa carpeta. El bloque de colecciones del inventario viene
envuelto a 100 columnas **partiendo nombres por la mitad** (`audit_` + `log`), así
que se unen las líneas sin separador antes de partir por espacios; si no, salen
76 colecciones falsas en vez de 68.

```javascript
#!/usr/bin/env node
// Fase 5 — Crítico de completitud. Sólo lectura sobre el inventario y los crudos.
// Uso: node cobertura.mjs   (imprime JSON con todo el cruce por stdout)
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = '/home/user/agenda-medica';
const DIR = path.join(RAIZ, 'docs/audit/panel-de-lujo-2026-09');
const CRUDOS = path.join(DIR, 'crudos');

// ─────────────────────────── 1. Inventario ───────────────────────────
const inv = fs.readFileSync(path.join(DIR, '00-INVENTARIO.md'), 'utf8').split('\n');
const secciones = {};
let sec = null;
for (const l of inv) {
  if (l.startsWith('## ')) { sec = l.slice(3).trim(); secciones[sec] = []; continue; }
  if (sec) secciones[sec].push(l);
}
const filas = (nombre) => (secciones[nombre] || [])
  .filter((l) => l.startsWith('|') && !/^\|\s*-+/.test(l) && !/^\|\s*(Ruta|Módulo|Pieza)\s*\|/.test(l))
  .map((l) => l.split('|').slice(1, -1).map((c) => c.trim().replace(/^`|`$/g, '')));

const piezas = [];
const add = (tipo, id, archivo, alias = []) => piezas.push({ tipo, id, archivo, alias });

for (const [ruta, , archivo] of filas('Rutas de API')) add('api', ruta, archivo, [ruta]);
for (const [ruta, archivo] of filas('Pantallas de trabajo (dashboard)')) add('dashboard', ruta, archivo, [ruta]);
for (const [ruta, archivo] of filas('Pantallas públicas y otras')) add('publica', ruta, archivo, [ruta]);
for (const [mod] of filas('Módulos de biblioteca (src/lib, primer nivel)')) add('lib', mod, 'src/lib/' + mod, []);

// El bloque de colecciones viene con salto de línea DENTRO de los nombres (envuelto a 100
// columnas): se unen las líneas sin separador y luego se parte por espacios.
const colecciones = (secciones['Colecciones en firestore.rules'] || []).join('')
  .split(/\s+/).map((s) => s.trim()).filter((s) => /^[a-zA-Z][a-zA-Z_]*$/.test(s));
for (const c of new Set(colecciones)) add('coleccion', c, null, []);

const comps = new Set((secciones['Componentes (src/components)'] || [])
  .filter((l) => l.trim().startsWith('- `'))
  .map((l) => l.trim().replace(/^- `/, '').replace(/`$/, '')));
for (const c of comps) add('componente', c, c, []);

// ─────────────────────────── 2. Crudos ───────────────────────────
const archivos = fs.readdirSync(CRUDOS).filter((f) => f.endsWith('.json')).sort();
const auditores = {}, rojos = {};
for (const f of archivos) {
  const j = JSON.parse(fs.readFileSync(path.join(CRUDOS, f), 'utf8'));
  if (f.startsWith('R-')) rojos[f.replace(/^R-/, '').replace(/\.json$/, '')] = { archivo: f, ...j };
  else auditores[f.replace(/\.json$/, '')] = { archivo: f, ...j };
}

// Normaliza una cita a una ruta comparable: quita ':línea', backticks, sufijos en prosa.
const normaliza = (s) => {
  if (typeof s !== 'string') return null;
  let t = s.trim().replace(/^`|`$/g, '').split(/\s+[—–-]\s+/)[0].trim();
  t = t.split(/\s/)[0];                    // primer token: "firestore.rules (l.12)" -> "firestore.rules"
  t = t.replace(/[:#]\d+([-–]\d+)?$/, ''); // ":142" / ":10-20"
  t = t.replace(/^\.\//, '').replace(/\/+$/, '');
  return t || null;
};
// Variantes de una ruta de inventario: con/sin src/, con/sin /route.ts, /page.tsx.
const variantes = (p) => {
  const v = new Set();
  const push = (x) => { if (!x) return; v.add(x); v.add(x.replace(/^src\//, '')); };
  push(p);
  push(p.replace(/\/route\.ts$/, ''));
  push(p.replace(/\/page\.tsx$/, ''));
  if (!/\.(ts|tsx)$/.test(p)) { push(p + '/route.ts'); push(p + '/page.tsx'); }
  return v;
};

// Citas por auditor: revisado[].pieza (+ .archivo si viene) y hallazgos[].archivo.
const citasPorAuditor = {}, textoPorAuditor = {}, cadenasPorAuditor = {};
for (const [nombre, j] of Object.entries(auditores)) {
  const citas = new Set();
  for (const r of j.revisado || []) {
    for (const c of [typeof r === 'string' ? r : r.pieza, r && r.archivo]) {
      const n = normaliza(c); if (n) citas.add(n);
    }
  }
  for (const h of j.hallazgos || []) { const n = normaliza(h.archivo); if (n) citas.add(n); }
  citasPorAuditor[nombre] = citas;
  textoPorAuditor[nombre] = JSON.stringify({ revisado: j.revisado || [], hallazgos: j.hallazgos || [] });
  // Cadenas sueltas, para el criterio estricto de colección (nombre citado EN contexto de regla).
  const cad = [];
  for (const r of j.revisado || []) cad.push(typeof r === 'string' ? r : [r.pieza, r.nota, r.veredicto].filter(Boolean).join(' · '));
  for (const h of j.hallazgos || []) cad.push([h.archivo, h.titulo, h.evidencia, h.propuesta].filter(Boolean).join(' · '));
  cadenasPorAuditor[nombre] = cad;
}

// ─────────────────────────── 3. Cruce ───────────────────────────
for (const p of piezas) {
  p.auditores = [];
  for (const [nombre, citas] of Object.entries(citasPorAuditor)) {
    let hit = false;
    if (p.tipo === 'coleccion') {
      // Una colección no es una ruta: se cuenta como revisada si el auditor la NOMBRA
      // (palabra completa) en su revisado o en sus hallazgos. Criterio más débil que el de ruta.
      const re = new RegExp(`(^|[^a-zA-Z_])${p.id}([^a-zA-Z_]|$)`);
      hit = re.test(textoPorAuditor[nombre]);
      // Estricto: el nombre aparece en la MISMA cadena que una marca de regla/colección.
      if (hit && cadenasPorAuditor[nombre].some((c) => re.test(c) && /firestore|colecci|collection\(|reglas|hasOnly/i.test(c))) {
        (p.auditores_estrictos ||= []).push(nombre);
      }
    } else if (p.tipo === 'lib') {
      // Carpeta o archivo de primer nivel: cuenta cualquier cita que caiga dentro.
      const base = 'src/lib/' + p.id, corto = 'lib/' + p.id;
      for (const c of citas) {
        if (c === base || c === corto || c.startsWith(base + '/') || c.startsWith(corto + '/')) { hit = true; break; }
      }
    } else {
      const vs = variantes(p.archivo);
      for (const a of p.alias) vs.add(a);
      for (const c of citas) if (vs.has(c)) { hit = true; break; }
    }
    if (hit) p.auditores.push(nombre);
  }
}
const porTipo = {};
for (const p of piezas) {
  const t = (porTipo[p.tipo] ||= { total: 0, cubiertas: 0, sin: [], un_solo_auditor: [], estrictas: 0 });
  t.total++;
  if (p.auditores.length) t.cubiertas++; else t.sin.push(p.id);
  if (p.auditores.length === 1) t.un_solo_auditor.push({ pieza: p.id, auditor: p.auditores[0] });
  if ((p.auditores_estrictos || []).length) t.estrictas++;
}

// ─────────────────────────── 4. Refutación y prioridades ───────────────────────────
const veredictoPorId = {};
for (const [aud, r] of Object.entries(rojos)) for (const v of r.veredictos || []) veredictoPorId[v.id] = { ...v, rojo_archivo: r.archivo, auditor: aud };

const refutacion = [];
for (const [nombre, j] of Object.entries(auditores)) {
  const r = rojos[nombre];
  const hs = j.hallazgos || [];
  let cambios = 0, subidas = 0, bajadas = 0;
  for (const h of hs) {
    const v = veredictoPorId[h.id];
    if (v && v.prioridad_final && v.prioridad_final !== h.prioridad) {
      cambios++;
      (Number(v.prioridad_final[1]) < Number(h.prioridad[1]) ? subidas++ : bajadas++);
    }
  }
  const ratio = r ? r.ratio : null;
  refutacion.push({
    auditor: nombre, rojo: r ? r.archivo : null, crudos: hs.length,
    total: ratio ? ratio.total : 0, confirmados: ratio ? ratio.confirmados : 0,
    refutados: ratio ? ratio.refutados : 0, parciales: ratio ? ratio.parciales : 0,
    pct_refutado: ratio && ratio.total ? +(100 * ratio.refutados / ratio.total).toFixed(1) : null,
    cambios_prioridad: cambios, subidas, bajadas,
    pendientes: hs.length - (ratio ? ratio.total : 0),
  });
}

// ─────────────────────────── 5. Conteos ───────────────────────────
const todos = [];
for (const [nombre, j] of Object.entries(auditores)) for (const h of j.hallazgos || []) todos.push({ ...h, auditor_archivo: j.archivo });
const cuenta = (arr, f) => arr.reduce((a, x) => (a[f(x)] = (a[f(x)] || 0) + 1, a), {});
const finales = todos.map((h) => {
  const v = veredictoPorId[h.id];
  return { ...h, veredicto_rojo: v ? v.veredicto : 'pendiente', prioridad_final: v && v.prioridad_final ? v.prioridad_final : h.prioridad, nota_rojo: v ? v.nota : null, evidencia_rojo: v ? v.evidencia : null };
});
const noRefutados = finales.filter((h) => h.veredicto_rojo !== 'refutado');
const p0p1 = noRefutados.filter((h) => h.prioridad_final === 'P0' || h.prioridad_final === 'P1')
  .sort((a, b) => a.prioridad_final.localeCompare(b.prioridad_final) || a.id.localeCompare(b.id));

// ─────────────────────────── 6. Duplicados ───────────────────────────
const grupos = [];
const vistos = new Set();
const clave = (h) => normaliza(h.archivo);
for (let i = 0; i < finales.length; i++) {
  const a = finales[i];
  if (vistos.has(a.id)) continue;
  const grupo = [a];
  for (let k = i + 1; k < finales.length; k++) {
    const b = finales[k];
    if (vistos.has(b.id)) continue;
    const mismoAuditor = a.auditor_archivo === b.auditor_archivo;
    const mismoArchivo = clave(a) && clave(a) === clave(b) && Math.abs(a.linea - b.linea) <= 10;
    const seCitan = (a.relacionado || []).includes(b.id) || (b.relacionado || []).includes(a.id);
    if ((!mismoAuditor && mismoArchivo) || seCitan) grupo.push(b);
  }
  if (grupo.length > 1) {
    for (const g of grupo) vistos.add(g.id);
    const auds = new Set(grupo.map((g) => g.auditor_archivo));
    const archivos = new Set(grupo.map((g) => clave(g)));
    // Tres cubos. Sólo los dos primeros son duplicados de verdad: el tercero son
    // referencias cruzadas DENTRO de un mismo auditor, que no son dos ojos sobre lo mismo.
    const motivo = auds.size === 1 ? 'cadena interna de un mismo auditor (no es duplicado)'
      : archivos.size === 1 ? 'mismo archivo ±10 líneas, auditores distintos'
      : 'se citan en `relacionado`, auditores distintos';
    grupos.push({ motivo, archivo: archivos.size === 1 ? [...archivos][0] : null, auditores: auds.size,
      miembros: grupo.map((g) => ({ id: g.id, auditor: g.auditor_archivo, archivo: g.archivo, linea: g.linea, prioridad_final: g.prioridad_final, veredicto: g.veredicto_rojo, titulo: g.titulo })) });
  }
}

// ─────────────────────────── 7. No alcanzado ───────────────────────────
const noAlcanzado = {};
for (const [nombre, j] of Object.entries(auditores)) {
  const l = [];
  for (const k of ['no_alcanzado', 'no_revisado']) if (j[k]) l.push(...(Array.isArray(j[k]) ? j[k] : [j[k]]));
  for (const r of j.revisado || []) {
    const vd = (r && r.veredicto) || '';
    if (/no\s+(revis|alcanz|se\s+revis)/i.test(vd)) l.push(`[revisado] ${r.pieza}: ${vd}`);
  }
  if (l.length) noAlcanzado[nombre] = l;
}

// ─────────────────────────── 8. Entregables ───────────────────────────
// `node cobertura.mjs --escribir` deja 01-HALLAZGOS-CRUDOS.json y 02-HALLAZGOS-VERIFICADOS.json.
if (process.argv.includes('--escribir')) {
  fs.writeFileSync(path.join(DIR, '01-HALLAZGOS-CRUDOS.json'), JSON.stringify(todos, null, 1) + '\n');
  const verificados = noRefutados.map((h) => { const { evidencia_rojo, ...r } = h; return r; });
  fs.writeFileSync(path.join(DIR, '02-HALLAZGOS-VERIFICADOS.json'), JSON.stringify(verificados, null, 1) + '\n');
  process.stderr.write(`escritos: ${todos.length} crudos, ${verificados.length} verificados\n`);
}

process.stdout.write(JSON.stringify({
  piezas, porTipo, refutacion, noAlcanzado, grupos,
  totales: {
    hallazgos: todos.length, con_veredicto: Object.keys(veredictoPorId).length,
    por_auditor: cuenta(todos, (h) => h.auditor_archivo),
    por_prioridad_cruda: cuenta(todos, (h) => h.prioridad),
    por_prioridad_final: cuenta(finales, (h) => h.prioridad_final),
    por_prioridad_final_no_refutados: cuenta(noRefutados, (h) => h.prioridad_final),
    por_tipo: cuenta(todos, (h) => h.tipo), por_modulo: cuenta(todos, (h) => h.modulo),
    por_veredicto: cuenta(finales, (h) => h.veredicto_rojo),
  },
  p0p1: p0p1.map((h) => ({ id: h.id, prioridad_cruda: h.prioridad, prioridad_final: h.prioridad_final, veredicto: h.veredicto_rojo, modulo: h.modulo, tipo: h.tipo, archivo: h.archivo, linea: h.linea, titulo: h.titulo })),
  crudos_salida: todos, verificados_salida: noRefutados.map((h) => { const { evidencia_rojo, ...resto } = h; return resto; }),
}, null, 1));
```


## Adenda — oleada de cierre (Fase 5, segunda pasada)

Las 119 piezas sin auditor de la primera pasada se auditaron en una oleada de cierre y pasaron por equipo rojo:

| Pieza | Sin auditor (1.ª pasada) | Cubiertas por la oleada de cierre | Sin cubrir al final |
|---|---:|---:|---:|
| Módulos de `src/lib` | 52 | 52 (`Z-cierre-lib.json`, archivo por archivo) | 0 |
| Colecciones de `firestore.rules` | 18 | 18 (`Z-cierre-lib.json`: tres sitios, `hasOnly`, lectura) | 0 |
| Componentes de `src/components` | 49 | 49 (`Z-cierre-componentes.json`) | 0 |

Lo que sigue siendo verdad tras la adenda: 54 rutas de API y 21 pantallas públicas tienen **un solo auditor**; los recorridos de confirmar por WhatsApp, consulta y pago no se hicieron en vivo; y la profundidad declarada como no alcanzada por cada auditor (sección f) no cambia.

Números finales tras la oleada de cierre y los ataques propios del equipo rojo (script `consolidar.mjs`, corrido al cierre sobre `crudos/`; `01-HALLAZGOS-CRUDOS.json` y `02-HALLAZGOS-VERIFICADOS.json` regenerados con ellos):

| Concepto | Valor |
|---|---:|
| Hallazgos crudos | 493 |
| Con veredicto del equipo rojo | 493 (los 8 de ataques propios se auto-verifican con salida literal) |
| Confirmados / parciales / refutados | 370 / 95 / 28 (5,7 % refutado) |
| P0 / P1 / P2 / P3 en pie | 4 / 44 / 186 / 231 |
| Por tipo (en pie) | defecto 227 · fricción 117 · mejora 66 · botón muerto 30 · innecesario 25 |
| Reproducciones que fallan hoy | 43 archivos · 103 casos rojos · 83 controles verdes · 0 importes rotos (`reproducciones/SALIDA-FINAL.txt`) |
