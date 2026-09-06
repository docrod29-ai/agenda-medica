# Ledger de reparación — rebanada PORTAL

Panel de Lujo (sep-2026). 80 hallazgos: 9 P1, 31 P2, 40 P3. El `ID` es el del
hallazgo; los `REG-nnn` los asigna el orquestador al integrar.

Rama: `reparacion/PORTAL`.

| ID | Área | Incidente | Estado | Test / control permanente |
|---|---|---|---|---|
| MG-014 | Portal · IA del paciente | «Estoy dando pecho, ¿cómo tomo el ibuprofeno?» no escalaba: el vocabulario de lactancia tenía un solo verbo y el hueco caía a RESPONDER desde el plan, no a escalar | CLOSED | `src/__tests__/dando-pecho-no-es-una-forma-menor-de-decir-lactancia.test.ts` · fixture `evals/patient-ai/casos.json` (`pl-01`, `pl-02`) |
| PI-001 | Portal · IA del paciente | «Si no como, ¿me tomo la metformina?» y «¿puedo saltarme el paracetamol hoy?» recibían la pauta literal del plan con `avisarAlConsultorio:false`: la subcadena «como» | CLOSED | `src/__tests__/como-y-cuando-dentro-de-otra-pregunta-no-son-una-pregunta-de-toma.test.ts` · fixture `pl-03`, `pl-04` |
| PI-002 | Portal · IA del paciente | «Cuando tomo la furosemida me da mucha sed, ¿es normal?» se contestaba con el horario: la subcadena «cuando». La queja no llegaba a nadie | CLOSED | mismo golden · fixture `pl-05` |
| PI-004 | Portal · API | A las 2 a.m. «me duele el pecho y me falta el aire» recibió «Demasiadas consultas a tus documentos»: el freno de tasa se preguntaba ANTES que la urgencia | CLOSED | `src/__tests__/la-urgencia-no-la-frena-el-limite-de-tasa.test.ts` |
| PC-001 | Portal · paquete y receta | El paquete del paciente y el `.doc` de la receta volcaban TODOS los diagnósticos de la nota: descartados, diferenciales y propuestas del modelo sin confirmar | CLOSED | `src/__tests__/al-paciente-solo-bajan-los-diagnosticos-que-su-medico-confirmo.test.ts` · `portal-alcance.test.ts` |
| PO-001 | Portal · receta | La receta que el paciente descarga imprimía como «diagnóstico» todo lo de la nota | CLOSED | ídem |
| PO-002 | Portal · plan de cuidado | El resumen de «Cuidado» concatenaba los mismos diagnósticos sin filtrar | CLOSED | ídem |
| PO-010 | Portal · API y pantalla | El enlace de AGENDA devolvía el `motivo` clínico de cada cita y lo incrustaba en la URL de Google Calendar | CLOSED | `src/__tests__/el-motivo-clinico-no-viaja-en-la-url-de-google.test.ts` |
| MG-012 | Portal · pantalla | El motivo de la cita («control prenatal», «interrupción») viajaba en la URL del botón de Google | CLOSED | ídem |
| PC-008 | Portal · pantalla | Ídem, dicho por cirugía («Ajuste de metformina») | CLOSED | ídem |
| PG-005 | Legal · subencargados | El aviso publicado decía que Meta/WhatsApp «no trata datos de salud» mientras el portal mandaba por WhatsApp el nombre y la pregunta íntegra de la paciente | CLOSED | `src/__tests__/lo-que-se-declara-de-whatsapp-y-lo-que-se-manda-por-whatsapp.test.ts` |
| PP-005 | Portal · alcance del enlace | El enlace reenviado abría TODO lo del paciente durante siete días y dejaba actuar en su nombre; no había forma de compartir sólo una cosa | CLOSED | `src/__tests__/el-enlace-del-paciente-abre-menos-y-se-puede-cerrar.test.ts` |
| PO-009 | Portal · alcance del enlace | Para justificar una incapacidad sólo se podía reenviar el enlace clínico entero | CLOSED | ídem |
| PC-018 | Portal · alcance del enlace | El paciente no podía cerrar su enlace ni enterarse de que alguien más entró | CLOSED | ídem |
| PP-008 | Portal · formulario previo | Dos cuidadores indistinguibles: el formulario del segundo borraba el del primero, en silencio (`merge: false`) | CLOSED | ídem |
| PG-011 | Portal · cuidador | Adolescente y su madre: el sistema no sabía quién es quién y no había autorización explícita ni bitácora | CLOSED | ídem (§8) |
| PO-014 | Portal · cuidador | No existía el cuidador; el padre agendaba y consentía por el hijo como si fuera el paciente | CLOSED | ídem |
| PI-013 | Portal · cuidador | «Soy la hija y cuido a mi papá»: no hay forma de que me autoricen ni de saber qué vi | CLOSED | ídem |
| PI-009 | Portal · API | Con el enlace de agenda, el vecino podía escribir a nombre del paciente qué medicamentos toma y a qué es alérgico | CLOSED | ídem |
| PI-010 | Portal · API | El aviso promete «registro de accesos a su expediente» y las lecturas del portal no se asentaban | CLOSED | ídem |
| MG-013 | Portal · urgencia | «Estoy sangrando», «no siento al bebé», «se me rompió la fuente» no eran urgencia | CLOSED | `las-doce-preguntas-del-paciente.test.ts` · fixture `pl-07`…`pl-09` |
| PG-001 | Portal · urgencia | «Tengo sangrado y dolor fuerte» y «ya no siento que se mueve» caían en escalación ordinaria | CLOSED | ídem |
| PP-001 | Portal · urgencia | «Tiene 39.5 y está muy dormido y no quiere despertar» se clasificaba como escalación | CLOSED | fixture `pl-10`, `pl-11` |
| PP-002 | Portal · urgencia | «Se tomó doble dosis sin querer» no contaba como ingesta accidental: faltaba la palabra «dosis» | CLOSED | fixture `pl-14` |
| PC-003 | Portal · urgencia | Herida abierta con pus y fiebre a las 2 a.m. recibía la escalación genérica, sin teléfono y sin 911 | CLOSED | fixture `pl-12` · `textoDeEscalacion` |
| PO-003 | Portal · urgencia | «El pie se me puso morado y frío con la férula» no disparaba urgencia | CLOSED | fixture `pl-13` |
| PI-011 | Portal · urgencia | «Tengo la glucosa en 40 y sudo frío» y «me tomé dos veces el losartán» no contaban como urgencia | CLOSED | fixture `pl-15` |
| PC-005 | Portal · pantalla | La respuesta urgente se pintaba con formato de WhatsApp («*911*»), decía «este canal es para citas» dentro de Preguntar y el número no era pulsable | CLOSED | `mensajeDeUrgencia(tel, 'portal')` · `el-aviso-urgente-del-portal-llegaba-el-ultimo.test.ts` |
| PI-014 | Portal · pantalla | El aviso decía «avisamos al consultorio» cuando en realidad se apunta en una lista que alguien abre por la mañana | CLOSED | ídem |
| PP-021 | Portal · escalación | La escalación no ponía plazo ni vía; «llámales» sin teléfono no lleva a ningún sitio | CLOSED | `textoDeEscalacion` |
| PO-020 | Portal · escalación | Ídem con el consultorio sin teléfono configurado | CLOSED | ídem + PC-004 |
| PC-004 | Portal · emisión del enlace | Se podía liberar un plan clínico y mandar el enlace de Preguntar sin teléfono del consultorio | CLOSED | `src/app/api/portal/link/route.ts` (409 al emitir) |
| PC-002 | Portal · paquete | Los signos de alarma que el cirujano escribe nunca llegaban al portal: `warningSigns` se componía vacío | CLOSED | `el-paquete-de-la-visita-se-libera-y-llega.test.ts` · `lineasDeIndicaciones` |
| MG-015 | Portal · paquete | Ídem para los signos de alarma del embarazo | CLOSED | ídem |
| PC-020 | Portal · paquete | Ayuno, qué suspender, cuidado de la herida y reposo no tenían sitio en el paquete | CLOSED | campo `indicaciones` + pantalla |
| MO-016 | Portal · paquete | Restricciones de actividad y ejercicios no tenían dónde viajar | CLOSED | ídem |
| PC-006 | Portal · API | Cada apertura gastaba 3 de las 15 llamadas clínicas; a la quinta recarga desaparecía el plan | CLOSED | acción `inicio` · `la-pantalla-de-preguntar-no-clasifica-ni-adivina.test.ts` |
| PO-008 | Portal · API | Cuatro peticiones por apertura contra el mismo tope | CLOSED | ídem |
| PP-010 | Portal · API | Ídem, y el aviso hablaba de «documentos» cuando lo que hizo fue preguntar | CLOSED | ídem |
| PI-025 | Portal · API | Con datos contados, cuatro peticiones por apertura se pagan cuatro veces | CLOSED | ídem |
| PO-018 | Portal · IA del paciente | Preguntas de dosis y de receta escalaban con la etiqueta «no está en el plan» | CLOSED | fixture `pl-06`, `pl-17` |
| MC-016 | Portal · IA del paciente | «¿Me dan incapacidad?» no se etiquetaba como documento firmado (el documento sigue sin existir: handoff) | CLOSED (parcial) | fixture `pl-16` |
| MO-010 | Portal · IA del paciente | Ídem para constancia y certificado | CLOSED (parcial) | ídem |
| MP-013 | Portal · IA del paciente | «¿Cuántos mL le doy?» escalaba sin etiqueta útil y no había un solo caso de cuidador en el fixture | CLOSED (parcial) | fixture `pl-06` |
| PI-020 | Portal · IA del paciente | «¿Cómo le doy permiso a mi hija?» se contestaba «eso lo tiene que contestar tu médico» | CLOSED | fixture `pl-18` |
| PG-021 | Portal · IA del paciente | «Eso lo puedes ver y cambiar tú mismo» a una paciente de ginecología | CLOSED (parcial) | `lo-que-el-paciente-pregunta-se-clasifica-antes-de-contestarse.test.ts` |
| N-003 | Portal · pantalla | El médico pega su liga de cobro y el portal sólo la enseñaba cuando el pago fallaba | CLOSED | `src/app/mi/[token]/page.tsx` |
| PI-015 | Portal · API | El portal saludaba «Hola» a secas cuando el paciente no tenía citas | CLOSED | acción `session` e `inicio` |
| PP-011 | Portal · pantalla | «Documentos» sin recetas era una pestaña en blanco | CLOSED | estado vacío explícito |
| PG-020 | Portal · pantalla | Enlace vencido: una línea sin encabezado, sin teléfono y sin acción | CLOSED | pantalla de error con salida |
| PI-018 | Portal · pantalla | Las citas pasadas vivían al final de «Cuidado» | CLOSED | vuelven a «Hoy» |
| PC-019 | Portal · pantalla | Un cuarto botón «Agendar» que en realidad copia la cita al calendario | CLOSED | «Añadir a mi calendario» |
| PI-021 · PG-015 · PO-013 | Portal · pantalla | La receta sólo se podía descargar como `.doc`; en un teléfono sin Word no se abre | CLOSED | vista en pantalla + descarga |
| PI-016 | Portal · pantalla | Fechas como «2026-09-05» | CLOSED | `fmtFecha` en procedencia y documentos |
| PG-010 · PI-017 · PP-016 | Portal · pantalla | Lo que más importa iba en la letra más pequeña (10.5-12 px) | CLOSED | tamaños en la escala del sistema (14/16) |
| PP-017 | Portal · accesibilidad | La barra de secciones al final del documento, sin enlaces de salto; cada pregunta un bloque sin encabezado | CLOSED | `skip-link` + `<section>`/`<article>` con nombre |
| PP-020 · PO-021 | Portal · pantalla | «Perfil» ocupaba uno de los cinco destinos para decir que no hacía nada | CLOSED | «Tu acceso»: cuidadores, cerrar enlace, privacidad |
| PO-017 | Portal · pantalla | Desde el portal no había camino al Portal de Privacidad | CLOSED | enlace en «Tu acceso» |
| C-016 | Portal · pantalla | El panel de reagenda fijaba `America/Mexico_City` | CLOSED | usa la zona del consultorio |
| C-005 | Privacidad · pantalla | El botón «Cerrar» tras enviar la solicitud ARCO no hacía nada | CLOSED | folio como acuse + «Hacer otra solicitud» |
| C-006 · PG-016 | Privacidad · pantalla | El formulario validaba y fallaba con `alert()` nativos, y enseñaba el mensaje crudo de la excepción | CLOSED | aviso `role="alert"` en la pantalla |
| D-007 | Privacidad · pantalla | El contador de caracteres a 2.4:1 sobre fondo claro | CLOSED | token de texto secundario, 14 px |
| PI-023 | Privacidad · accesibilidad | «Enviar solicitud, no disponible» sin decir qué falta | CLOSED | el botón se puede pulsar y dice qué falta |
| PO-012 | Privacidad · pantalla | «← Volver» de 55×20 px | CLOSED (parcial) | 44×44; el tema oscuro de la tarjeta va en el handoff |
| PP-013 | Privacidad · pantalla | No había forma de decir «solicito en representación de mi hijo» | CLOSED | casilla + titular + parentesco |
| PG-017 | Legal · aviso | El aviso se publicaba con el marcador `[Domicilio del consultorio]` | CLOSED | dice que falta, no imprime el corchete |
| PI-007 | Legal · aviso | El aviso no decía que se graba la voz ni que una IA transcribe y redacta | CLOSED | §2 y §3 del aviso |
| PO-011 | Reseñas · pantalla | «Tu opinión es anónima» y se publica «Nombre A.» | CLOSED (parcial) | el texto dice la verdad; cambiar la publicación va en el handoff |
| PP-015 | Portal · pantalla | El portal le habla al niño y no a quien lo lee; la respuesta urgente cambiaba a «usted» con asteriscos | CLOSED (parcial) | el mensaje del portal ya no mezcla registros ni pinta asteriscos |
| N-023 | Portal · producto | «El paciente casi no tiene motivos para volver» | CLOSED (parcial) | ahora hay qué gestionar: acceso, cuidadores, compartir un documento |
