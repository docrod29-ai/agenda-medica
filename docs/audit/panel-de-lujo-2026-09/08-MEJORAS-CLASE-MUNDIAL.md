# 08 · Mejoras de clase mundial — Fase 6

**Fecha: 2026-09-06 · Rama `claude/medical-app-audit-team-8c37y7` · Redactor de la
Fase 6 del Panel de Lujo.**

Este documento no repara nada y no levanta hallazgos nuevos. Toma lo que ya
existe en NexusMED, lo pone al lado de lo mejor que conozco, y dice qué falta.
Va por áreas, en cuadros de tres columnas, y cierra con las quince mejoras que
más acercan a la misión y con lo que **no** se propone.

## Cómo leerlo

**De dónde sale.** De los 60 hallazgos `tipo: mejora` de `crudos/*.json` con su
veredicto en `R-*.json`. Se dejó fuera el único refutado (N-020, agenda: el
equipo rojo demostró que el aviso automático al siguiente de la lista de espera
y la respuesta SÍ/NO al recordatorio **ya existen**). Los `parcial` entran con
la decisión del dueño de la que dependen, dicha en su fila. Se cruzó con
`agent-state/OWNER_DECISIONS_REQUIRED.md` y `DECISION_LOG.md` para no proponer
lo ya decidido (D-026 a D-030, v972, «no escatimar»).

**Tres reglas duras.**

1. Ninguna mejora duplica una fuente de verdad ni crea una V2 de algo que ya
   existe. Todo se pinta sobre la entidad que ya hay.
2. Ninguna cifra clínica se propone. Donde haga falta una, dice
   `NEEDS_CLINICAL_REVIEW` y quién la fija.
3. Lo que se afirma de otros productos va marcado «según mi conocimiento a
   2026», sin fechas ni cifras precisas de terceros. Cuando no puedo sostenerlo
   con nombre, digo «criterio del panel».

**Esfuerzo.** S = una unidad con su prueba, una capa · M = varias unidades,
más de una capa (pantalla + ruta + reglas) · L = modelo de datos nuevo o
política nueva (declaración en tres sitios, migración o revisión legal).

**Rutas.** Todas las rutas de la columna «lo que hay hoy» se comprobaron con
`ls`/`grep` en esta sesión. Los números de línea son los que verificó el equipo
rojo.

---

## 1. Voz y nota

| Lo que hay hoy | Cómo lo hace lo mejor que existe | Brecha y propuesta |
|---|---|---|
| **Pipeline completo**: sesgo antes de transcribir (`src/lib/asr/lexicon.ts`, `src/lib/asr/sesgo-diarizado.ts`), dos motores con respaldo, corrector vigilado con guardián (`src/lib/asr/guardian-sustituciones.ts`), compuerta de ambigüedad (`src/lib/asr/politica-critica.ts`), aprendizaje de léxico por consultorio (`src/lib/asr/aprendizaje.ts`). | Según mi conocimiento a 2026, Abridge, Nuance DAX Copilot, Suki, Ambience, Nabla, Heidi Health y Freed venden lo mismo: «habla y sal con la nota». Ninguno que conozca publica su cadena de defensas. Criterio del panel: la cadena de NexusMED está por encima de lo habitual. | El filtro `utilizable()` que decide qué término entra al sesgo existe para un motor y no para el otro (`sesgo-diarizado.ts:137` vs `lexicon.ts:271-281`). Propuesta: decidir si una frase ayuda en el prompt libre de Whisper; si no, compartir `utilizable()`; si sí, escribir la diferencia en los dos módulos. **Esfuerzo** S · **Decisión** sí: ¿una frase ayuda en Whisper? (B-015). **Ids** B-015. |
| **Procedencia frase→segundo del dictado**: un solo patrón (`SelloProcedencia` + `DeDondeSalioEsto` + `EscucharElMomento`) montado por `src/components/expediente/ProcedenciaDeLaNota.tsx` en `/consulta`, `/expediente` y `/demo/razonamiento`. | Según mi conocimiento a 2026, Abridge enlaza frases de la nota con la transcripción; no conozco ninguno que lleve al segundo del audio con un clic. Criterio del panel: aquí la referencia es el propio producto. | La nota firmada (`src/app/(dashboard)/nota/[patientId]/[notaId]/page.tsx`), la receta y la orden no enseñan de dónde salió nada (grep = 0 en las tres). Propuesta: montar `ProcedenciaDeLaNota` bajo el documento en `/nota`; receta y orden enlazan a la nota. Sin reescribir el patrón. **Esfuerzo** S · **Decisión** ninguna. **Ids** D-022. |
| **Demostración**: `src/app/demo/razonamiento/page.tsx` recorre los motores deterministas; `src/app/demo/page.tsx:48` la llama «el activo más fuerte del repositorio». Niveles de IA por intención en `src/lib/planes-ia.ts:122`. | Según mi conocimiento a 2026, Freed, Heidi y Nabla dejan probar sin cuenta: subes o dictas un audio de ejemplo en la página pública y ves la nota salir. | La procedencia y las negativas de la portada son lo que un competidor no copia en un trimestre, y no se ven antes de registrarse. Propuesta: prueba pública de 90 segundos con audio **sintético o actuado** (nunca paciente real, `data-privacy.md`): transcripción, nota y clic-a-audio, colgada de `/demo` y enlazada desde el hero. **Esfuerzo** M · **Decisión** sí: ¿se publica una demostración con audio actuado? **Ids** N-021. |
| **Aprendizaje**: `src/lib/asr/aprendizaje.ts` aprende sustituciones de una palabra por una palabra, vistas dos veces, sin cifras ni pares prohibidos. Sólo sesga. | Según mi conocimiento a 2026, Heidi y Freed aprenden la **plantilla** del médico a partir de sus notas corregidas, no sólo su vocabulario. | La estructura de la nota no aprende del médico; el léxico sí. Propuesta: aprender la plantilla (orden y presencia de secciones, no contenido clínico) desde la diferencia entre lo generado y lo firmado, con la misma disciplina de «visto dos veces» y reversible. No es un segundo motor: es otro consumidor de `transcripcionMotor` vs texto firmado, que ya se guardan. **Esfuerzo** L · **Decisión** ninguna, pero es unidad de producto. **Ids** N-021. |
| **Lateralidad en el dictado**: `src/lib/asr/guardian-sustituciones.ts:171-182` compara lado por presencia {d, i, b}; prueba con un solo lado. Guía de ortopedia sin la palabra «lado» (`src/lib/expediente/guias-de-especialidad.ts:129`). Motivo `lateralidad_incierta` en `src/lib/expediente/motivos-confirmacion-texto.ts:55`. | Estándar: el Protocolo Universal de la Joint Commission exige marcar el sitio y el lado antes de cualquier procedimiento; el error de lado es evento centinela. Criterio del panel: un escriba clínico debe tratar el lado como cifra crítica. | El guardián no ve dos lados intercambiados del mismo género (reproducido: `'hombro derecho y pie izquierdo' → 'hombro izquierdo y pie derecho'` pasa). Propuesta: comparar lateralidad por **posición** además de presencia; añadir a la guía «toda estructura par lleva lado copiado del dictado; si no lo dice, sin lado y `needs_review`»; los dos casos a la prueba del guardián. **Esfuerzo** S · **Decisión** ninguna. **Ids** MO-015, MO-013 (parcial: sólo su primera mitad), relacionado con MO-001. |
| **Consentimiento de grabación**: una vez por paciente (`src/app/(dashboard)/consulta/[patientId]/page.tsx:1810`), decisión del dueño. El aviso de privacidad, en cambio, sí guarda huella SHA-256 del texto aceptado (`src/types/index.ts:300-308`). | Criterio del panel: un consentimiento demostrable lleva el texto exacto, su versión y la fecha. El repositorio ya lo resolvió al lado, para el aviso de privacidad. | No hay huella ni versión del texto de grabación, el paciente nunca lo ve, y no hay registro de retiro. Propuesta: copiar el mecanismo del aviso de privacidad (huella + versión), enseñar en Perfil del portal «Autorizaste la grabación el <fecha>» con el texto, y un registro de retiro (fecha, quién) en Datos del paciente. Se respeta «una vez por paciente». **Esfuerzo** S · **Decisión** sí: ¿«una vez por paciente» o «una vez por versión del texto»?; retiro: `NEEDS_LEGAL_REVIEW`. **Ids** PC-012, PG-004. |
| **Corrección de un signo ya guardado**: en Practice el campo se apaga al firmar (`consulta/[patientId]/page.tsx:6764`) y no pide motivo; `motivoCorreccion` sólo existe en Hospital. | Estándar: la política D-026 que el dueño ya fijó para Hospital («se pide y se marca en ámbar, no bloquea»). | La misma regla no rige en el consultorio, que es donde enfermera y médico tocan el mismo campo. Propuesta: llevar el patrón de ámbar-sin-bloquear al bloque de signos de Practice, con autor y hora por signo. **Esfuerzo** S · **Decisión** sí: C-5 sigue abierta, y añade «¿aplica a Practice?». **Ids** ASN-012 (parcial). |

---

## 2. Receta y seguridad de medicamentos

| Lo que hay hoy | Cómo lo hace lo mejor que existe | Brecha y propuesta |
|---|---|---|
| **Receta en papel resuelta**: membrete y firma (`src/components/RecetaDocumento.tsx`), folio (`src/lib/receta-folio.ts`), QR verificable por el servidor (`src/app/verificar/[token]`, `src/lib/receta-certificado.ts`), firma protegida (`src/lib/firma-protegida.ts`), salida a Word (`src/lib/receta-word.ts`). Motores deterministas antes de firmar: `src/lib/seguridad/dosis.ts`, `alergias.ts`, `terapia-duplicada.ts`, `src/lib/expediente/prescripcion-segura.ts`. | Según mi conocimiento a 2026, en Estados Unidos la referencia es la receta electrónica de extremo a extremo (Surescripts): la orden viaja a la farmacia y el paciente no lleva papel. En México no conozco una red equivalente de adopción general, y la receta impresa con datos del prescriptor sigue siendo la forma normal. | **No se propone** perseguir una red de receta electrónica: sería construir contra una infraestructura que no puedo afirmar que exista. Lo que sí falta es lo de después de salir del consultorio (filas siguientes). **Ids** N-022. |
| **Después de la receta**: se entrega por WhatsApp y al portal; el portal distingue borrador de liberado. Sin renovación, sin adherencia (`grep renovar\|adherencia` en `src/lib`, `src/app`: nada funcional). | Según mi conocimiento a 2026, Doctoralia y los expedientes de práctica privada recuerdan la toma, avisan cuando acaba el tratamiento y saben si el paciente lo recogió. | (1) **Renovación de crónicos en un clic** desde la nota anterior, pasando igual por motor de seguridad y firma: el internista dicta lo mismo cada tres meses. (2) **Adherencia** preguntada en el portal, sin inferencia clínica, que alimenta la siguiente consulta. (3) Plan de toma con recordatorios opcionales. Las tres se pintan sobre la misma entidad de medicamento; ninguna crea un segundo registro. **Esfuerzo** M cada una · **Decisión** ninguna; `NEEDS_CLINICAL_REVIEW` para cualquier intervalo que (3) necesite. **Ids** N-022. |
| **Dosis pediátrica**: `src/lib/expediente/pediatria.ts:86` (`DosisCalculada` en mg, sin presentación ni volumen); `src/components/PanelPediatria.tsx:177-179` pinta mg. | Criterio del panel: una calculadora pediátrica de clase mundial devuelve «400 mg = 8 mL de 250 mg/5 mL», nunca mL sin la concentración al lado, y redondea al escalón del dosificador. | La regla de tres mg→mL se hace a mano en cada renglón, que es donde nacen los errores ×2 entre presentaciones. Propuesta: selector de presentación por fármaco y conversión determinista mg→mL **extendiendo** `DosisCalculada` (no un segundo motor). La tabla de presentaciones y el escalón del dosificador los aporta el Dr. (`NEEDS_CLINICAL_REVIEW`). Va después de reparar MP-005 (P0). **Esfuerzo** M · **Decisión** sí: qué presentaciones y qué escalón. **Ids** MP-009; relacionado con MP-005. |
| **Perioperatorio**: `src/lib/expediente/preop.ts:462-480` tiene las recomendaciones de anticoagulantes con fuente; `src/components/PreopAssessment.tsx:11-19` no recibe la lista de medicamentos; `src/lib/expediente/avisos-consulta.ts` no cruza «cirugía programada» con la lista vigente. | Criterio del panel: un apoyo a la decisión cruza la lista vigente con el evento programado y avisa antes de firmar. Es lo que un cirujano espera de un copiloto perioperatorio. | El sistema tiene los dos datos y no los cruza. Propuesta: (1) prellenar `tomaAnticoagulante`/`tipoAnticoagulante`/`tomaAspirina` desde la lista vigente (motor determinista, vocabulario declarado); (2) aviso alto antes de firmar cuando la nota dice cirugía programada y la lista tiene anticoagulante o antiagregante, con enlace a la valoración preoperatoria. Los intervalos siguen siendo los ya citados en `preop.ts`; no se propone ninguno nuevo. **Esfuerzo** M · **Decisión** ninguna. **Ids** MC-015. |
| **Embarazo**: `src/lib/expediente/prescripcion-segura.ts:287-303` tiene 15 renglones; `src/lib/clinical/registry.ts:1727-1731` los marca `pendiente_validacion`; `src/components/SelloMotor.tsx` existe y no se renderiza. | Criterio del panel: cada renglón con su fuente y su estado de validación visible, como ya hace la pestaña de citología de `src/components/PanelGineco.tsx:249-251`. | Ausencia de fármaco se lee como «sin alerta» (regla 5: vocabulario, no criterio). Propuesta: que la médica dueña amplíe la tabla con fuente por renglón (qué entra y con qué categoría: `NEEDS_CLINICAL_REVIEW`) y que `SelloMotor` se pinte donde el motor se usa. **Esfuerzo** S (pintar) + acto clínico · **Decisión** C-1 (ya encolada). **Ids** PG-022, MG-021. |
| **La receta en el portal**: único botón «Descargar» (`src/app/mi/[token]/page.tsx:1055`) entrega `.doc` (`src/lib/receta-word.ts:235`), con el nombre del paciente en el archivo. | Criterio del panel: en el mostrador de la farmacia se enseña una pantalla o un PDF; nadie edita una receta. | En un celular sin Word no abre; acaba en captura de pantalla. Propuesta: vista imprimible en el portal y/o PDF del mismo documento; el `.doc` queda como opción secundaria. Papelería y QR: los mismos que hoy. **Esfuerzo** S · **Decisión** de producto (implicaciones de papelería, REG-507). **Ids** PC-022, PP-014; relacionado con PG-015. |
| **Documentos del médico**: sólo nota, receta, orden, referencia y hoja del paciente. `RecetaDocumento.tsx:49` y `receta-word.ts:20` conocen `'receta' \| 'orden'`. La incapacidad/constancia sólo existe como patrón de escalación (`src/lib/paciente/pregunta-del-paciente.ts:185-189`). | Criterio del panel: el justificante o constancia sale del mismo expediente, con folio y verificación, y se enlaza a la nota de la que deriva. Las incapacidades oficiales las emite el IMSS; el privado emite constancia. | El documento que un ortopedista o un cirujano firma varias veces al día se hace en Word, sin folio ni QR ni firma protegida. Propuesta: familia «documentos del médico» (constancia de asistencia, incapacidad privada, informe para aseguradora) reutilizando `useFirmaProtegida`, folio y `/verificar/[token]`; persistida y enlazada a la nota firmada; visible en el portal como documento liberado. Periodos y diagnósticos los pone el médico; nada se autocompleta; la IA del paciente nunca lo genera (§3 de `patient-facing-ai.md`). **Esfuerzo** M · **Decisión** sí: formato y validez legal (`NEEDS_LEGAL_REVIEW`). **Ids** MC-016, MO-010, PO-009, PC-020. |

---

## 3. Agenda y recepción

| Lo que hay hoy | Cómo lo hace lo mejor que existe | Brecha y propuesta |
|---|---|---|
| **Agenda madura**: `src/app/(dashboard)/citas/page.tsx` con riesgo de no-show (`src/lib/no-show-risk.ts`), `src/app/(dashboard)/lista-espera/page.tsx`, alta por lenguaje natural (`src/app/(dashboard)/asistente/page.tsx`), reserva pública (`src/app/reservar/[clinicId]/page.tsx`, `src/app/api/public/booking/route.ts`), Google Calendar (`src/lib/google-calendar.ts`), zona horaria probada (REG-011). **Verificado por el equipo rojo**: el hueco liberado se ofrece solo (`src/lib/whatsapp/ofrecer-hueco.ts:59`, desde portal y bot) y el recordatorio ya acepta SÍ/NO (`src/app/api/cron/reminders/route.ts:212, 334-350`). | Según mi conocimiento a 2026, Doctoralia/Docplanner es el estándar de facto de reserva en línea en México, y su ventaja es el directorio, no el calendario. Fuera de México, Cliniko, Jane App y SimplePractice son la referencia de agenda de consultorio pequeño. | Es la parte más madura y menos diferencial. Lo que queda en pie tras la refutación de N-020 es su punto 3, que el equipo rojo dejó vivo: el riesgo de no-show **se calcula y se pinta, pero no actúa**. Criterio del panel: un riesgo alto debería disparar doble confirmación o pedir anticipo, que es lo que `src/app/(dashboard)/crm/page.tsx:204` ya recomienda por escrito y nadie ejecuta. **Esfuerzo** S de código · **Decisión** sí: es política (¿pedir anticipo a quien tiene riesgo alto?). **Ids** criterio del panel sobre N-020 (refutado en sus puntos 1 y 2). |
| **Cierre del día**: las citas de hoy ya pasadas se atenúan (`citas/page.tsx:962`) pero conservan «Iniciar consulta» como primaria por decisión escrita (`:941-947`); «No vino» sólo en el menú (`:1061`). `noShowCount` sube en transacción (`src/lib/agenda/transicion-cita.ts`). | Criterio del panel: al final del día, la recepción marca inasistencias en un barrido de un clic con deshacer; las estadísticas de no-show se llenan solas. | El «Riesgo 66 de 100» se alimenta de un contador que nadie sube. Propuesta: para citas `pasado` sin resolver, primaria «No vino» con deshacer, conservando «Iniciar consulta» en el menú; y un «Cerrar el día» que las liste juntas. **Esfuerzo** S · **Decisión** sí: cambiar la primaria contradice el comentario razonado de `:941-947`. **Ids** ASR-016 (parcial). |
| **Reserva pública**: `reservar/[clinicId]/page.tsx:337` pide «Doy mi consentimiento informado…» sin preguntar edad ni relación; `api/public/booking` no captura fecha de nacimiento. | Criterio del panel: la primera pregunta de una reserva es «¿para ti o para alguien más?». Sin eso, el padre agenda como si fuera el hijo. | El sistema no sabe quién es menor ni quién es tutor. Propuesta: pregunta de relación y fecha de nacimiento en la reserva, como antesala del modelo de cuidador (área 5). **Esfuerzo** S (la pregunta) · **Decisión** sí: forma parte del cuidador autorizado (`NEEDS_LEGAL_REVIEW`). **Ids** PO-014, PG-011. |
| **Presencia pública**: `src/app/dr/[clinicId]/page.tsx` existe y nada la enlaza desde `/`; la portada habla sólo al médico. | Según mi conocimiento a 2026, el directorio es el negocio de Doctoralia. NexusMED no compite ahí y no debería. | Un adulto mayor con un nombre y sin enlace no tiene camino. Propuesta mínima: un enlace discreto en el pie «¿Eres paciente? Pide a tu consultorio su enlace». O no hacer nada y dejarlo declarado. **Esfuerzo** S · **Decisión** sí: ¿hay o no directorio de pacientes? (recomendación: no). **Ids** PI-024 (parcial); relacionado con PG-019. |

---

## 4. Cobro y corte

| Lo que hay hoy | Cómo lo hace lo mejor que existe | Brecha y propuesta |
|---|---|---|
| **Libro bien hecho**: cobros sellados por servidor (`src/lib/cobros.ts`, REG-015), moneda fija (REG-024), exentos con autor y motivo (REG-003), abonos que no saldan sin tarifa (`src/lib/finanzas/anticipo.ts`), membresías (`src/lib/membresias.ts`), CFDI sin timbrar por decisión. El único cobro en línea es el anticipo, y cae en la cuenta de la plataforma (`src/app/api/payment/create-checkout/route.ts`, N-002 P0). | Según mi conocimiento a 2026, SimplePractice y Jane App cobran con tarjeta guardada al terminar y liquidan al profesional con cuentas conectadas (Stripe Connect). En México, Mercado Pago y Clip son lo que un paciente reconoce, y la transferencia inmediata (SPEI/CoDi) es habitual en consultorio. | La brecha no es de funciones: es de **custodia** (N-002, N-003, ya P0/P1 en el backlog). Orden obligatorio: (1) resolver a dónde va el dinero; (2) sólo después, un **código de cobro por consulta** que el paciente escanea al salir y liquida directo al consultorio, registrado en el mismo libro. (3) Con lo mismo resuelto, automatizar las membresías, que hoy dependen de que la asistente marque el cobro a mano y son el activo más subestimado de esta rebanada. **Esfuerzo** L (custodia) + M (código) + M (membresías) · **Decisión** sí: la de N-002, custodia del dinero del paciente. **Ids** N-024 (parcial); relacionado con N-002, N-003. |
| **Corte de caja**: `src/app/(dashboard)/corte-caja/page.tsx:121-296` calcula todo en memoria y no escribe nada; controles: día, Hoy, Imprimir. No hay colección `cortes` (grep en `firestore.rules` y `src/lib/clinica/respaldo.ts` = 0). | Según mi conocimiento a 2026, todo sistema de mostrador (Nimbo, AgendaPro) tiene «cerrar caja» con arqueo: efectivo contado, diferencia, quién y cuándo. | El corte es un reporte, no un cierre: un faltante descubierto el jueves no se puede atribuir al día ni a la persona. Propuesta: botón «Cerrar el día» que pide efectivo contado, calcula diferencia y guarda `clinics/{c}/cortes/{dia}` con totales, quién, cuándo y folios incluidos — **declarada en los tres sitios** (reglas con `hasOnly`, matriz, respaldo); el impreso lista movimientos; anulaciones posteriores se marcan «después del cierre». **Esfuerzo** M · **Decisión** sí: forma de la colección, turnos y fondo de caja. **Ids** ASC-013; relacionado con ASC-007. |

---

## 5. Portal del paciente e IA del paciente

| Lo que hay hoy | Cómo lo hace lo mejor que existe | Brecha y propuesta |
|---|---|---|
| **Arquitectura de confianza**: enlace firmado atado a {clinicId, patientId} con versión revocable (`src/lib/portal/vigencia-del-enlace.ts`, `src/lib/patient-token.ts:27`, 7 días), paquete DRAFT→RELEASED, clasificador **sin modelo de lenguaje** con cinco clases (`src/lib/paciente/pregunta-del-paciente.ts`), fixture de 29 casos (`evals/patient-ai/casos.json`), formulario previo (`src/lib/portal/formulario-previo.ts`). | Según mi conocimiento a 2026, la referencia mundial es MyChart (Epic): cuenta propia, histórico, resultados, mensajería. En consultorio privado, Athenahealth y los portales de Doctoralia. Lo que hacen mejor: identidad, resultados que llegan solos, mensajería asíncrona. | **No se propone sustituir el enlace por una cuenta**: un paciente de 70 años no va a crear una contraseña, y `patient-facing-ai.md` §8 ya lo razona. Se propone permanencia sin contraseña (fila siguiente). **Ids** N-023. |
| **Permanencia**: el manifiesto PWA existe (`src/app/manifest.ts`) pero su `start_url` es `/dashboard`: el portal no es instalable como aplicación propia. El enlace caduca y el paciente ve «pide otro al consultorio» (`grep renovar` en `src/lib/portal`, `src/app/api/portal` = 0). | Criterio del panel: el paciente vuelve si tiene un icono y si el enlace no lo expulsa. | Propuesta: (1) portal instalable con manifiesto propio bajo `/mi`; (2) renovación automática del enlace al caducar, mandando uno nuevo por el mismo canal — acorta la vigencia sin castigar al paciente; (3) resultados con tendencia por analito en lenguaje llano, **siempre desde material liberado**, nunca originados por el modelo. **Esfuerzo** M · **Decisión** ninguna. **Ids** N-023. |
| **Control del enlace**: revocar sólo lo puede el médico desde `src/app/(dashboard)/expediente/[patientId]/page.tsx:986-988`; Perfil del portal (`mi/[token]/page.tsx:1081-1088`) no tiene botón; no hay registro de aperturas visible (PI-010, defecto aparte). | Criterio del panel: quien recibe un enlace puede cerrarlo él mismo. | Un reenvío por error a un grupo familiar expone diagnóstico y alergias sin que el paciente pueda cortarlo. Propuesta sostenida por el equipo rojo: **«Cerrar este enlace» en Perfil**, que sube `portalTokenVersion` — exactamente lo que ya hace el botón del médico. El segundo factor ligero **no se recomienda**: contradice el diseño de magic-link que el repositorio razonó por escrito. **Esfuerzo** S · **Decisión** ninguna para el botón; sí para el segundo factor (recomendación: no). **Ids** PC-018, PO-009. |
| **Cuidador**: no existe. `mi/[token]/page.tsx:1066-1078` lo declara («el token ata a UN paciente, sin concepto de cuidador») y `:1086-1088` lo dice en pantalla. `src/types/index.ts` no guarda tutor del menor (MP-014). | Estándar propio: `patient-facing-ai.md` §8 exige autorización explícita, revocable y con bitácora. Según mi conocimiento a 2026, MyChart tiene acceso por apoderado con alcance y vigencia. | La hija que cuida al padre, la madre de la adolescente embarazada y el padre del menor de 15 comparten la credencial completa o nada. Propuesta: modelo mínimo de cuidador (quién, para quién, alcance agenda/clínico, desde/hasta, revocable, bitácora) con **enlace propio** sobre el mismo `patientId`; el consentimiento lo firma el responsable. Qué puede ver la madre de una menor embarazada lo decide el derecho, no el código. **Esfuerzo** L · **Decisión** sí + `NEEDS_LEGAL_REVIEW`. **Ids** PG-011, PO-014, PI-013; relacionado con MP-014. |
| **Paquete de visita**: `src/lib/paciente/paquete-de-visita.ts:334-346` compone diagnósticos, medicamentos, órdenes y próxima cita; `warningSigns`, `educationalMaterial` y `documents` nacen vacíos. No hay campo de actividad, indicaciones, gestación ni vacunas. | Criterio del panel: el plan liberado contesta lo que el médico ya dijo en consulta; lo demás escala. La escalación es el producto, no el fallo. | «¿Puedo manejar?», «¿para cuándo nace?», «¿le toca vacuna?», «¿cuántas horas de ayuno?» escalan aunque el médico ya lo contestó. Propuesta: campos **estructurados en la nota** que el paquete pueda leer — `procedimiento {fecha, nombre, lateralidad}`, gestación (semanas, método, FPP, quién), «indicaciones para el paciente», `activityRestrictions`, registro de vacunas aplicadas — y el clasificador cita ese campo. Nunca recalcular en el portal; nunca «atrasada» sin registro. Va después de PC-002/PG-002/MC-002 (defectos P2 del compositor). **Esfuerzo** M por campo · **Decisión** sí: alcance de V9 para Practice; `activityRestrictions` toca §1. **Ids** MO-016, PC-020, PG-014, PP-018, MC-021. |
| **Vocabulario del clasificador**: `PREGUNTA_POR_TOMA` (`pregunta-del-paciente.ts:276`) no incluye «cuánto(s) le doy», «dos juntos», «me mandas otra receta». Todo eso escala con motivo `no_esta_en_el_plan_liberado`. El fixture no tiene un cuidador preguntando por la dosis de un menor. | Criterio del panel: escalar es correcto; escalar con la **etiqueta** equivocada hace que el consultorio triaje mal una pregunta de dosis. | Propuesta: ampliar vocabulario sólo como cita literal de la instrucción liberada (nunca cálculo) y **cada frase nueva al fixture** («¿cuántos ml le doy a mi hija?», «se me olvidó una toma», «¿le puedo dar paracetamol e ibuprofeno?» → escala, «¿puedo manejar?» → escala hasta que exista el campo). **Esfuerzo** S · **Decisión** ninguna. **Ids** MP-013, PO-018, MO-016 (la parte del fixture). |
| **Foto del paciente**: ningún `type="file"` en `src/app/mi`, `src/app/api/portal`, `src/lib/paciente`, `src/lib/portal`. La fotografía clínica existe del lado del médico (`src/components/FotosClinicas.tsx`). | Criterio del panel: la foto de la herida llega al expediente con fecha y procedencia, no al WhatsApp personal del cirujano. | Propuesta: adjunto de imagen en Preguntar que se guarde en la serie de fotografía clínica con procedencia «paciente, fecha», visible sólo al médico; **la IA no clasifica la imagen** (escala siempre). Está fuera del alcance escrito de V9. **Esfuerzo** M · **Decisión** sí: ¿entra en V9-Practice? **Ids** PC-011 (parcial). |

---

## 6. Mensajería WhatsApp

| Lo que hay hoy | Cómo lo hace lo mejor que existe | Brecha y propuesta |
|---|---|---|
| **Canal bien construido**: tres proveedores con cascada (`src/lib/whatsapp-send.ts:165-170`), opt-out con pie «Responda BAJA» (`:179-183`, `src/lib/whatsapp/consent.ts`), interruptor de circuito (REG-391), cola con dead-letter (`src/lib/whatsapp/outbox.ts`), tope de 3 proactivos por contacto y día (`src/lib/whatsapp/frecuencia.ts`), baja por status 131050 (`src/lib/whatsapp/status.ts:80-82`), bot que agenda (`src/app/api/whatsapp/webhook/route.ts`). | Según mi conocimiento a 2026, Doctoralia y las plataformas de mensajería de la región (Zenvia y similares) resuelven el alta por el consultorio: el mensaje sale del número de la plataforma con el nombre del consultorio, y sólo quien quiere su número lo conecta. La implementación técnica de NexusMED es igual o mejor. | El médico no puede saber por cuál de las tres vías sale su mensaje: la tarjeta sólo dice «Conectado · {número}». Es el mismo defecto que ya costó una tarde con las llaves de IA, y por eso existe `fuenteEfectiva` en `src/lib/ai-keys.ts:481`. Propuesta: copiar ese patrón al canal («tus recordatorios salen del número de NexusMED» / «conecta tu número») y decirlo también en los términos. **Esfuerzo** S · **Decisión** sí: ¿los consultorios en prueba mandan desde el número de la plataforma? Si no, apagar el respaldo global para ellos. **Ids** N-025 (parcial). |
| **Idempotencia del recordatorio**: la marca `recordatorio24hEnviado` se escribe **después** de enviar (`src/app/api/cron/reminders/route.ts:313-319`); el `catch` del consultorio (`:456-458`) se traga el fallo; ventana de hasta 4 ciclos. | Criterio del panel: reservar antes de enviar y confirmar después es el patrón mínimo de un envío idempotente. | Si falla la escritura, la hora siguiente lo manda otra vez (el tope de 3 acota el daño). Propuesta: `recordatorio24hIntentoAt` antes de enviar; una reserva reciente impide reenviar aunque falte la confirmación. **Esfuerzo** S · **Decisión** ninguna. **Ids** ASM-019. |
| **Dos criterios para la misma pregunta**: `consent.ts:89-101` es fail-open con razón escrita; `src/lib/whatsapp/puede-contactar.ts:10-28` es fail-closed con la asimetría del daño razonada. | Criterio del panel: para un mensaje **proactivo**, no poder comprobar la baja es motivo para no mandar; la cola ya sabe pausar por proveedor. | Propuesta: fail-closed sólo para proactivos, dejando el mensaje en la cola con motivo «no se pudo comprobar la baja». Los dos criterios están razonados; cambiarlo es política. **Esfuerzo** S · **Decisión** sí: política del dueño. **Ids** ASM-020 (parcial). |
| **Discreción**: el recordatorio no dice el tipo de cita (correcto) pero lleva nombre del médico y «📍 nombre del consultorio» (`reminders/route.ts:296, 300`). | Criterio del panel: en especialidades sensibles, el recordatorio sólo dice hora y teléfono. | Si el consultorio se llama «Ginecología y Obstetricia», quien vea el teléfono infiere el dato. Propuesta: opción por consultorio «recordatorios discretos», encendida por defecto en especialidades sensibles. **Esfuerzo** S · **Decisión** sí + `NEEDS_LEGAL_REVIEW` (¿el nombre de la clínica es dato de salud por inferencia?). **Ids** PG-018. |

---

## 7. Seguridad y aislamiento

| Lo que hay hoy | Cómo lo hace lo mejor que existe | Brecha y propuesta |
|---|---|---|
| **Tres sitios**: `firestore.rules` (catch-all `:1210` cierra todo lo no declarado), `src/lib/authz/matriz-acceso.ts:96` (una entrada por `match`), `src/lib/clinica/respaldo.ts:209-220` (`RAIZ_EXCLUIDAS` con motivo). Un guardián por cada uno. | Criterio del panel: la garantía «toda colección se declara» sólo vale si el guardián también mira lo que el servidor escribe, no sólo lo que las reglas nombran. | La matriz sólo conoce colecciones con `match`; una raíz nueva puede nacer en cero sitios sin que nadie lo diga. Propuesta: entrada de clase `plataforma` por cada raíz que el servidor escribe, y ampliar `matriz-acceso.test.ts` con el cruce que falta: todo `adminDb.collection('…')` de primer nivel está en la matriz o en una lista de exenciones con motivo. Sin impacto hoy. **Esfuerzo** S · **Decisión** ninguna. **Ids** S-010 (parcial). |
| **Respaldo**: `googleTokens` tiene regla propia (`firestore.rules:1182`, cerrada al cliente) y no está ni en `COLECCIONES_RAIZ` ni en `RAIZ_EXCLUIDAS`. | Criterio del panel: excluir sin declarar es la misma omisión que se castiga para los secretos. | Tras restaurar, cada médico amanece sin Google Calendar y el manifiesto no lo dice. Propuesta: `googleTokens` en `RAIZ_EXCLUIDAS` con la razón, y que el acta de restauración liste «lo que hay que reconectar a mano». **Esfuerzo** S · **Decisión** ninguna. **Ids** ASE-017. |
| **CSP**: `next.config.ts:43-45` sólo aprieta con `CSP_MODE=enforce`; `:133` permite `'unsafe-inline' 'unsafe-eval'`. Criterios del flip ya calculados en `src/lib/security/csp-observacion.ts`. El único sumidero de HTML con datos de usuario está escapado a mano (`src/app/dr/[clinicId]/page.tsx:139-143`). Desde el repositorio no se sabe el modo de producción. | Estándar: CSP nivel 3 con nonces por petición (W3C); según mi conocimiento a 2026, es lo que OWASP recomienda como segunda barrera contra XSS almacenado. | Hoy la cabecera informa y no protege. Propuesta en dos pasos separados: (1) medir el modo real en producción (`npm run e2e:seguridad:prod`) y fijar la fecha del flip con los criterios que ya existen; (2) retirar `unsafe-inline`/`unsafe-eval` con nonces, que es la unidad aparte que el propio archivo anuncia. **Esfuerzo** S (1) + M (2) · **Decisión** operativa: fecha del flip (junto a O-3). **Ids** S-011. |

---

## 8. PWA, móvil y accesibilidad

| Lo que hay hoy | Cómo lo hace lo mejor que existe | Brecha y propuesta |
|---|---|---|
| **Red de accesibilidad**: `scripts/design/lib/a11y-jsx.mjs` tiene 15 reglas y se aplica sólo a las 10 superficies del paciente (`scripts/design/medir-a11y-superficies-paciente.mjs:74-85`); diez guardianes puntuales `a11y-*` y `v15-a11y-*` en `src/__tests__/`; `docs/design/ACCESSIBILITY.md:262-265` declara el resto como «trabajo aparte»; `agent-state/RISK_REGISTER.md` no tiene fila de accesibilidad. | Estándar: WCAG 2.2 AA, que `design-system.md` ya fija como mínimo. Según mi conocimiento a 2026, la práctica común es axe en CI más un conteo estático que sólo baja. | Los 111 campos sin etiqueta y 2 botones sin nombre (D-002, D-003) pueden crecer sin que nadie lo note. Propuesta: correr `a11y-jsx.mjs` sobre `src/app/(dashboard)` y `src/components` con **techo sellado por regla que sólo baje** — el patrón de `scripts/lint-trinquete.mjs`, sin dependencias nuevas — y añadir R-09 «accesibilidad del flujo clínico» al registro de riesgos. **Esfuerzo** S · **Decisión** ninguna. **Ids** D-021; relacionado con D-002, D-003. |
| **Campos de la receta en consulta**: `consulta/[patientId]/page.tsx:6933-6979` nombra Medicamento, Dosis, Frecuencia y Duración sólo por `placeholder`, que desaparece al escribir (115 campos así en el repo). | Estándar: WCAG 3.3.2 (etiquetas o instrucciones); axe los da por buenos y no lo son del todo. | Con la fila llena, el médico cansado lee por posición, no por nombre. Propuesta: encabezado de columna una sola vez encima de la lista y `aria-label` por campo; sin cambiar la fila. **Esfuerzo** S · **Decisión** ninguna. **Ids** D-005. |
| **Portal con lector de pantalla**: `mi/[token]/page.tsx:1120` pone la barra de secciones **después** de `</main>` (`:1105`); sin enlace «ir al contenido» (grep = 0); cada pregunta es un `<div>` sin encabezado (`:780`). Lo bueno: todos los controles tienen nombre, `aria-current`, `role=alert`. | Estándar: WCAG 2.4.1 (saltar bloques), criterio A. | Para llegar a «Cuidado» se oye todo, cada vez. Propuesta: enlace «Ir a las secciones» visible al enfocar como primer control; cada pregunta como `<article aria-labelledby>` con `<h3>`; `aria-live` al cambiar de destino. **Esfuerzo** S · **Decisión** ninguna. **Ids** PP-017. |
| **Instalable**: `public/sw.js` con app shell offline; `src/app/manifest.ts` con `start_url: '/dashboard'`. | Criterio del panel: el médico ya la instala; el paciente no puede (área 5, N-023). | Cubierto en el área 5. **Ids** N-023. |
| **i18n**: `src/lib/i18n.ts` tiene 18 claves, marca desactualizada (`:44 'Agenda Médica'`) y **cero** consumidores en `src/app`, `src/components`, `src/hooks`; `src/lib/texto-es.ts` la usan 7 archivos; 44 de 45 pantallas con texto en el JSX. | Estándar propio: `design-system.md` («texto fuera del componente desde el primer día»). | en-US está «arquitectado» sólo en el papel. Propuesta: **no retroajustar 78 pantallas**. Exigir el patrón sólo en pantallas nuevas y en las 10 del paciente, con guardián sólo para archivos nuevos; y corregir la marca del diccionario. **Esfuerzo** S · **Decisión** sí: (a) retirar `i18n.ts` y aceptar es-MX única lengua, o (b) patrón sólo en lo nuevo (recomendación: b). **Ids** D-011. |
| **Tokens de diseño**: 13 `rounded-full` y los `rounded-md` de toda la app viven en 3 archivos (`src/components/pacientes/ValoracionInmuno.tsx:44,55,67`, `DoctorOnboarding.tsx`, y el episodio hospitalario); violeta en hex literal en ≥12 archivos aunque `docs/design/GENERIC_AI_AESTHETIC_AUDIT.md:26` afirma que «el último literal violeta murió»; `#a855f7` sobre blanco mide 3.96 (bajo AA). | Estándar propio: `docs/design/` y el trinquete de diseño, que mide valores CSS pero no ve clases. | Propuesta: `className="input"` y `var(--r-pill)` en `ValoracionInmuno`; `var(--purple)`/`var(--badge-purple-t)` en los archivos de Practice; corregir la frase del documento para que la compuerta compare contra un número real. `DoctorOnboarding.tsx` no tiene consumidor (D-010): candidato de `13-`, no de aquí. El archivo de hospitalización **no se toca** (D-030). **Esfuerzo** S · **Decisión** ninguna. **Ids** D-019, D-020. |

---

## 9. Expedientes, migración y ARCO

| Lo que hay hoy | Cómo lo hace lo mejor que existe | Brecha y propuesta |
|---|---|---|
| **Respaldo con ida y sin vuelta**: la descarga tiene botón (`src/app/(dashboard)/operaciones/page.tsx:481`); la restauración es `POST /api/clinic/importar` (`src/app/api/clinic/importar/route.ts`, capacidad `administrar` en `src/lib/authz/registro-rutas.ts:267`) **sin ningún llamador** en `src/app`, `src/components`, `src/hooks`. Ensayo en seco en `src/lib/durability/veredicto.ts`; `scripts/simulacro-respaldo.mjs` mide sólo nuestra mitad. | Criterio del panel: las consolas de respaldo de los proveedores de nube restauran con resumen del archivo, ensayo en seco y confirmación tecleada. | El día que se pierdan los datos, «volver» exige un ingeniero con `curl`. Propuesta: pantalla «Restaurar desde un respaldo» en Operaciones: subir el NDJSON, ver fecha y documentos por colección, ensayo en seco con el veredicto, confirmación con frase tecleada. O-2 (restauración con `gcloud`) sigue aparte y no se duplica. **Esfuerzo** M · **Decisión** ninguna (O-2 sigue siendo suya). **Ids** ASE-016; relacionado con R-07, O-2. |
| **ARCO**: plazo de 20 días hábiles saltando sólo fines de semana (`src/lib/arco.ts:77-86`); la entrega de acceso baja JSON crudo (`src/app/(dashboard)/cumplimiento/page.tsx:273-277`) con hash SHA-256 (`src/app/api/arco/acceso/route.ts:113-114`). Antes de todo esto: las solicitudes reales no se pueden ejecutar (ASE-010, P1). | Estándar: LFPDPPP. Si «días hábiles» excluye los días de descanso obligatorio, y si JSON satisface «formato legible», lo decide el asesor legal, no esta auditoría. El sesgo actual es conservador: avisa antes, no después. | Propuesta: (1) entregar dos archivos del mismo paquete — el JSON con hash en el acuse y un PDF legible con el **mismo hash** impreso; (2) si el asesor confirma, lista de feriados por año en un módulo puro con prueba. Ambas después de reparar ASE-010. **Esfuerzo** S + S · **Decisión** `NEEDS_LEGAL_REVIEW` en las dos. **Ids** ASE-026, ASE-024 (parciales); relacionado con ASE-010. |
| **CURP**: `src/lib/curp.ts:42` asigna siglo XXI a todo año de dos cifras ≤ el actual; `fechaNacimientoDesdeCURP` no tiene llamador. El importador (`src/app/(dashboard)/migracion/page.tsx`) acepta CURP inválido (ASE-005, P2). | Estándar: el criterio oficial del RENAPO — la homoclave distingue el siglo (letra = nacido en 2000 o después, dígito = antes). | Escrito y sin conectar: si se conecta para reparar ASE-005, un nacido en 1926 saldría recién nacido. Propuesta: siglo por homoclave y prueba con AA=26, **antes** de conectarla. **Esfuerzo** S · **Decisión** ninguna. **Ids** ASE-025; relacionado con ASE-005. |

---

## 10. Especialidades — lo que la app no sabe hoy de cada tronco

El tronco por defecto es el del infectólogo. Cada especialidad quirúrgica ve
«la app de infectólogo» (MO-014). Aquí, por tronco, lo que falta.

### 10.1 Cirugía

| Lo que hay hoy | Cómo lo hace lo mejor que existe | Brecha y propuesta |
|---|---|---|
| `src/lib/expediente/templates.ts:79-89` — `nota_postoperatoria` con diagnósticos pre/post, cirugía realizada, hallazgos, técnica, sangrado, complicaciones, estado de egreso, plan. Sin operación planeada, cuenta de gasas/compresas/instrumental, equipo quirúrgico, piezas a patología, pronóstico ni **fecha de la cirugía**. La cuenta de gasas vive sólo en el checklist OMS en memoria (`src/lib/expediente/cirugia.ts:278`, `src/components/PanelCirugia.tsx:185-189` → «Salida: 4/5» sin decir cuál faltó). `src/lib/nota-word.ts:35` imprime un solo establecimiento: el del consultorio. | Estándar: NOM-004-SSA3-2012, numeral de nota postoperatoria. El auditor recuerda la lista y **no la afirma como texto normativo**: qué apartados son obligatorios es `NEEDS_CLINICAL_REVIEW`/legal. Lista de verificación quirúrgica de la OMS: ya existe en el panel. | Propuesta: (1) secciones nuevas en `nota_postoperatoria` — `operacionPlaneada`, `cuentaGasasCompresasInstrumental` (con **cuál** faltó), `equipoQuirurgico`, `piezasPatologia`, `pronostico`, `lugarDelProcedimiento` (hospital y quirófano ajenos) — y `pronostico` en la preoperatoria; el prompt (`prompts.ts:548`) en consecuencia. (2) Campo estructurado `procedimiento {fecha, nombre, lateralidad}` dentro del sello (versión nueva) → **día postoperatorio determinista** en el seguimiento y en el rótulo de las fotos, y tarea «retirar puntos/drenaje» con la fecha que fije el médico (sin plazo propuesto). **Esfuerzo** M · **Decisión** sí: cuáles bloquean la firma (revisión legal). **Ids** MC-009 (parcial), MC-021, MC-022. |
| `src/lib/expediente/preop.ts:462-480` (anticoagulantes con fuente) sin cruce con la lista vigente. Ayuno preoperatorio: sólo placeholder en `nota_anestesia` (`templates.ts:91`). | Ver área 2. | Cruce anticoagulante × cirugía programada (MC-015). Ayuno: no existe motor ni texto; cifras `NEEDS_CLINICAL_REVIEW`. **Ids** MC-015. |
| Indicaciones al paciente (ayuno, qué suspender, herida, baño, reposo) sin sitio en el paquete; incapacidad inexistente. | Ver áreas 2 y 5. | Campo «Indicaciones para el paciente» en pre y postoperatoria, volcado al paquete; constancia firmada por el médico. **Ids** PC-020, MC-016. |

### 10.2 Gineco-obstetricia

| Lo que hay hoy | Cómo lo hace lo mejor que existe | Brecha y propuesta |
|---|---|---|
| `src/lib/expediente/ginecologia.ts:96-101` — hitos prenatales con dosis (ácido fólico, aspirina, anti-D) sin fuente por renglón; `src/lib/clinical/registry.ts:1934-1951` trae la referencia (NOM-007 / OMS / ACOG-USPSTF / Bishop) y el estado `pendiente_validacion`; `src/components/PanelGineco.tsx:129-148` pinta los hitos **sin fuente ni estado**. La gestación (FUM, FPP, semanas) se calcula bien (`ginecologia.ts:43, 57`) y **no se escribe en ningún sitio**: es texto pegado (MG-022, P2). | Estándar: NOM-007-SSA2-2016 (control prenatal), ya citada en el registro. Criterio del panel: fuente y estado por renglón en pantalla, como la pestaña de citología. | Propuesta: (1) `fuente` por hito y `SelloMotor` visible en el panel; no se confirma ninguna cifra aquí. (2) Campo estructurado de gestación en la nota (semanas, método FUM/USG, FPP, quién y cuándo) → el paquete lo pinta con procedencia «calculado por el sistema a partir de la FUM que registró la Dra. el <fecha>»; nunca recalcular en el portal. **Esfuerzo** S (1) + M (2) · **Decisión** C-1 para (1); ninguna para (2). **Ids** MG-021, PG-014; relacionado con MG-007, MG-022. |
| `src/lib/expediente/preventivo.ts:38-52` — mastografía y citología citan USPSTF/ASCCP; la cabecera declara que no se leyó la fuente vigente; la advertencia sí se pinta (`PanelPreventivo.tsx:91`). `ginecologia.ts:296-301` repite los intervalos cervicales. | Estándar para es-MX: NOM o GPC CENETEC, con USPSTF como comparación. `grep NOM-041\|NOM-014` en `src/lib/expediente` = 0. | Dos copias del mismo dato y ninguna con la referencia nacional. Propuesta: que un GO con cédula fije edades e intervalos para es-MX con la referencia vigente, y **unificar** `preventivo.ts` y `ginecologia.ts:296-301` en una sola fuente. Sin cifras aquí. **Esfuerzo** S de código + acto clínico · **Decisión** sí: ¿referencia rectora del tamizaje para es-MX? **Ids** MG-020. |
| `src/lib/expediente/prescripcion-segura.ts:287-303` — 15 fármacos en la tabla de embarazo. | Ver área 2. | Ampliar con fuente por renglón (`NEEDS_CLINICAL_REVIEW`). **Ids** PG-022. |
| Cuidador/tutora de menor embarazada: inexistente. Recordatorios con nombre del consultorio. | Ver áreas 5 y 6. | **Ids** PG-011, PG-018. |

### 10.3 Ortopedia y traumatología

| Lo que hay hoy | Cómo lo hace lo mejor que existe | Brecha y propuesta |
|---|---|---|
| `src/lib/herramientas-por-especialidad.ts:87, 112` — ortopedia y traumatología caen en el tronco `cirugia`: copiloto, cirugía, calculadoras, antibiograma, fotos, laboratorios. `src/lib/expediente/calculadoras.ts` tiene Wells TEP/TVP; `grep ottawa\|tobillo\|rodilla\|fractura` = 0. | Criterio del panel: un consultorio ortopédico ve por defecto sus reglas de decisión y su imagen, y el antibiograma sólo cuando hay diagnóstico infeccioso. | Ruido en la consulta más común. Propuesta: sub-tronco `ortopedia` con antibiograma oculto por defecto (se enciende por diagnóstico infeccioso) y calculadoras de consultorio ortopédico. **El contenido y los puntos de corte de cualquier regla (Ottawa u otra) son `NEEDS_CLINICAL_REVIEW` con fuente citada; no se proponen aquí.** **Esfuerzo** S (encaje) · **Decisión** sí: qué reglas y con qué fuente. **Ids** MO-014. |
| Lateralidad: guía sin «lado» (`guias-de-especialidad.ts:129`); guardián por presencia (`guardian-sustituciones.ts:171-182`); la orden de imagen es texto libre y el catálogo dice «Radiografía de extremidades» sin lado (`src/app/(dashboard)/orden/[patientId]/[notaId]/page.tsx:269, 342`); el portal contesta la orden **tal cual** con sello de procedencia (`pregunta-del-paciente.ts:384-394`). | Estándar: Protocolo Universal (Joint Commission). Criterio del panel: el lado se pide al elegir el estudio, no se confía al tecleo. | El sello de procedencia le presta autoridad a una orden incompleta (PO-015 es P2 por eso). Propuesta: marcar en el catálogo los estudios de estructura par y **pedir lado al elegirlos**; en «Entregar al paciente» avisar «esta orden no dice lado»; más lo del área 1 para dictado y guardián. Sin cifras. **Esfuerzo** S · **Decisión** ninguna. **Ids** PO-015, MO-013, MO-015; relacionado con MO-001, MO-003. |
| `src/lib/paciente/paquete-de-visita.ts:133-160` — sin campo de actividad, restricciones ni ejercicios; `evals/patient-ai/casos.json` sin «manejar», «cargar», «apoyar». | Ver área 5. | `activityRestrictions` escrito sólo por el médico; casos al fixture (hoy ESCALATE, correcto). **Ids** MO-016. |
| Incapacidad/justificante: inexistente. | Ver área 2. | **Ids** MO-010, PO-009. |

### 10.4 Pediatría

| Lo que hay hoy | Cómo lo hace lo mejor que existe | Brecha y propuesta |
|---|---|---|
| `src/lib/expediente/pediatria.ts:86` — dosis en mg sin presentación ni volumen (y MP-005, P0: se puede firmar «5 mL cada 8 h» sin concentración). | Ver área 2. | mg→mL con concentración al lado, extendiendo `DosisCalculada`. **Ids** MP-009; relacionado con MP-005. |
| `src/lib/expediente/oms-crecimiento.ts:20-21` — percentiles de 0 a 60 meses, generados desde los archivos oficiales; `PanelPediatria.tsx:213-217` avisa en ámbar que 5-19 años no está. | Estándar: la OMS publica referencias distintas para 5-19 años; cuál usar es del Dr. | El escolar y el adolescente (mitad de la consulta) no tienen referencia. Propuesta: cargar 5-19 años con el **mismo generador auditable** (script desde los archivos oficiales, sin transcribir). **Esfuerzo** M (datos) · **Decisión** sí: ¿qué referencia usa el Dr. de 5 a 19 años? **Ids** MP-012. |
| `src/lib/expediente/pediatria.ts:334, 362` — `ESQUEMA_MX` (Cartilla Nacional) y `vacunasSegunEdad(edadMeses, aplicadas = [])`: **no hay registro de lo aplicado**, por eso el panel informa qué corresponde y remite a la cartilla (`PanelPediatria.tsx:282-286`), que es lo correcto (regla 4). El portal no tiene destino de vacunas. | Criterio del panel: dos listas — aplicadas (del expediente) y las que corresponden por edad (material curado, nivel 8) — marcadas «verifica en su cartilla». Nunca «atrasada» sin registro. | Propuesta: primero el registro de vacunas aplicadas (fecha, lote opcional, fuente: cartilla vista/capturada); sólo entonces «Vacunas» en el paquete liberado. **Esfuerzo** M · **Decisión** sí: ¿se construye el registro antes de V9-Practice? **Ids** PP-018. |
| Fixture sin cuidador; clasificador sin «¿cuántos ml le doy?». Tutor del menor inexistente (MP-014, P2). | Ver área 5. | **Ids** MP-013, PO-014; relacionado con MP-014. |

### Transversal (núcleo)

| Lo que hay hoy | Cómo lo hace lo mejor que existe | Brecha y propuesta |
|---|---|---|
| `src/app/(dashboard)/antibiograma/page.tsx:572-574` y `src/app/(dashboard)/corte-caja/page.tsx` funcionan como biblioteca: `consulta:235`, `expediente:913` y `finanzas:30` las importan como componentes. | Estándar: Next trata `page.tsx` como módulo de ruta (`node_modules/next/dist/docs/`). | Acopla la consulta a una ruta y complica mover o retirar la pantalla. Propuesta: `AntibiogramaTool` y `CorteCajaContenido` a `src/components`, las `page.tsx` como envoltorios de una línea; actualizar `src/__tests__/v15-rtc09-ia-contextual.test.ts:146` en el mismo cambio. **Esfuerzo** S · **Decisión** ninguna. **Ids** C-033. |

---

## 11. Las quince que más acercan a la misión

Ordenadas por impacto entre esfuerzo. Misión: nota hecha sin dejar de mirar al
paciente · seguridad · trazabilidad · simplicidad.

1. **Lateralidad de punta a punta** (MO-015, MO-013, PO-015). Guardián por posición, guía con «lado», y lado obligatorio al elegir un estudio de estructura par.
   Evento centinela evitado con tres unidades S y cero cifras. Sin decisión.
2. **Vocabulario del clasificador del paciente + fixture** (MP-013, PO-018). «¿Cuántos ml le doy?» cita la instrucción liberada; cada frase nueva va al fixture.
   Menos escalaciones de lo ya dicho y etiquetas correctas para el triage. S, sin decisión.
3. **Procedencia en la nota firmada** (D-022). Montar `ProcedenciaDeLaNota` bajo el documento en `/nota`.
   El diferencial del producto, en la pantalla donde se discute la nota. S, sin decisión.
4. **«Cerrar este enlace» en el Perfil del portal** (PC-018, PO-009). Sube `portalTokenVersion`, como ya hace el botón del médico.
   El paciente corta un reenvío sin llamar al consultorio. S, sin decisión.
5. **Estado del canal de WhatsApp visible** (N-025). Copiar `fuenteEfectiva` de las llaves de IA al canal.
   Cierra una ambigüedad que ya costó una tarde. S; decisión ligera sobre la prueba.
6. **Recordatorio idempotente** (ASM-019). Reservar antes de enviar, confirmar después.
   Sin duplicados por un fallo de escritura. S, sin decisión.
7. **Trinquete de accesibilidad para todo el dashboard** (D-021, D-005, PP-017). Techo por regla que sólo baja, rótulos en la receta, salto al contenido en el portal.
   El médico cansado y el paciente de 70 años son el mismo problema. S, sin decisión.
8. **Anticoagulante × cirugía programada** (MC-015). Prellenar desde la lista vigente y avisar antes de firmar.
   El sistema tiene los dos datos; sólo falta cruzarlos. M, sin decisión, sin cifra nueva.
9. **Renovación de crónicos en un clic** (N-022). Desde la nota anterior, por el mismo motor y la misma firma.
   Tiempo puro para el internista, sobre la misma entidad. M, sin decisión.
10. **mg→mL con presentación** (MP-009, tras MP-005). Extender `DosisCalculada`, nunca mL sin concentración.
    La función que un pediatra espera de una calculadora. M; decisión: la tabla es del Dr.
11. **Campos estructurados que el paquete pueda leer** (MC-021, PG-014, PC-020, MO-016). Procedimiento con fecha, gestación, indicaciones, actividad.
    Lo que el médico ya dijo deja de escalar. M por campo; decisión de alcance V9.
12. **Cerrar el día** (ASC-013, ASR-016). Arqueo con acta en tres sitios; «No vino» de un clic.
    El corte pasa de reporte a cierre; el no-show se mide solo. M; decisión sobre la forma.
13. **CSP en modo `enforce` y nonces** (S-011). Medir el modo real, fijar la fecha, retirar `unsafe-inline`.
    Segunda barrera contra XSS en el área clínica. S + M; decisión operativa de fecha.
14. **Restaurar con pantalla** (ASE-016). Subir, ver, ensayar en seco, confirmar tecleando.
    El día malo no depende de un ingeniero con `curl`. M, sin decisión (O-2 sigue aparte).
15. **Prueba pública de 90 segundos** (N-021). Audio actuado, nota, clic-a-audio, sin cuenta.
    Lo que vende el producto, visible antes de registrarse. M; decisión: publicar audio actuado.

Justo debajo del corte, y sin decisión: portal instalable con renovación
automática del enlace (N-023), `googleTokens` declarado (ASE-017), cerrar el
círculo de la matriz (S-010), i18n sólo en lo nuevo (D-011).

---

## 12. Lo que NO se propone, y por qué

- **Ninguna V2.** Ni «nota V2», ni «receta V2», ni un segundo clasificador del
  paciente con modelo de lenguaje. Todo lo de arriba extiende lo que existe:
  `DosisCalculada`, `PaqueteDeVisita`, `ProcedenciaDeLaNota`, `fuenteEfectiva`,
  `portalTokenVersion`, el generador de percentiles, el mecanismo de huella del
  aviso de privacidad.
- **Duplicar un motor o una fuente de verdad.** El mL sale del mismo motor de
  dosis; la gestación se escribe una vez en la nota y el portal la pinta; los
  intervalos de tamizaje se **unifican** (`preventivo.ts` y `ginecologia.ts`),
  no se copian; el código de cobro escribe en el mismo libro. Un paciente, un
  expediente, muchas vistas.
- **Tocar Hospital y UCI.** Están en pausa por D-030 (se usan, no se venden, no
  aparecen en la navegación). D-019 se limita a los archivos de Practice; MC-021
  y MO-014 dejan fuera el episodio hospitalario. Reactivar es vaciar
  `src/lib/navegacion/modulos-en-pausa.ts`, y eso es del dueño.
- **Bajar de modelo por velocidad.** «La nota usa el razonamiento premium, no
  escatimar» sigue vigente; el router de coste/calidad espera D-09. Ninguna
  mejora de aquí lo supone.
- **Bajar o condicionar la prueba de 14 días.** v972: sin tarjeta, IA limitada,
  nunca bloquear la app entera. Lo que sí se propone es decir en qué estado
  está el canal de WhatsApp durante la prueba (N-025), no recortarla.
- **Una cuenta con contraseña en el portal** (N-023) ni **un segundo factor
  para el enlace** (PC-018). El magic-link es decisión razonada para un
  paciente de 70 años; se le añade permanencia y un botón para cerrarlo, no
  fricción.
- **Un directorio de pacientes** (PI-024, PG-019). La captación es de
  Doctoralia; NexusMED no compite ahí.
- **Una red de receta electrónica** (N-022). No puedo afirmar que exista en
  México una de adopción general; no se construye contra una infraestructura
  supuesta.
- **Ninguna cifra clínica.** Ottawa, ayuno preoperatorio, feriados de la
  LFPDPPP, presentaciones pediátricas, tamizajes es-MX, tabla de embarazo,
  percentiles 5-19: todo queda como `NEEDS_CLINICAL_REVIEW` o
  `NEEDS_LEGAL_REVIEW` con quién lo decide. Rellenar una cifra plausible es el
  fallo más caro posible aquí.
- **Retirar nada.** La lente 3 (farmacia, CRM, `DoctorOnboarding`, contador
  del asistente de alta) vive en `13-QUITAR-LO-INNECESARIO.md` y la decide el
  dueño. Aquí sólo se menciona lo que estorba a una mejora concreta.
- **Lo que el equipo rojo refutó.** N-020 en sus puntos 1 y 2: el aviso
  automático de hueco liberado y la respuesta SÍ/NO al recordatorio ya existen
  y no se «proponen» otra vez.

---

## 13. Validación

Ids citados en este documento, comprobados con grep contra `crudos/*.json`
(no `R-`): todos existen. Los `mejora` incluidos: 59 de 60 (fuera N-020,
refutado). Los ids de otro tipo (defectos, fricción, botón muerto) aparecen
sólo como «relacionado con», nunca como sostén de una propuesta. Las rutas de
la columna «lo que hay hoy» se comprobaron con `ls` en la rama de la auditoría
el 6-sep-2026.
