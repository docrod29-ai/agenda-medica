# 12 — Amigable y fácil de usar, pantalla por pantalla

> Esta auditoría **no borra ni repara nada**: propone, y decide el dueño.
> Todo lo de abajo sale de los JSON de `crudos/` y de los veredictos `R-*.json`; la prioridad que manda es `prioridad_final` del equipo rojo.

Fecha: 2026-09-06 · Lente 2 del §4.0 («amigable y fácil de usar»): ¿se puede decir el propósito en una frase? ¿la tarea frecuente cabe en tres clics? ¿el texto habla como persona? ¿lo primero que se ve es lo más importante?

## Cómo leer la tabla

- **Propósito**: la frase del programador (`C-programador.json › revisado`) o, si él no la dio, la de diseño (`D-diseno.json › revisado`). Si ninguno la dio: «sin propósito declarado», y eso es hallazgo (lista al final del bloque).
- **Clics**: la tarea principal, contada por el programador sobre código. `>3` en negrita. «n/m» = nadie la midió.
- **Habla como sistema**: ids que citan toasts «Error…», mensajes crudos, plurales rotos, fechas ISO, rótulos que mienten, campos sin etiqueta. Entre paréntesis, la frase.
- **Primero vs. importante**: ids sobre jerarquía: lo que pesa igual, lo escondido, lo que tapa, letra pequeña, estados vacíos mudos.
- **Fricción**: hallazgos `tipo: friccion` con veredicto `confirmado` (c) o `parcial` (p) y su prioridad final. Los refutados van al final del archivo.

Un mismo id puede aparecer en dos pantallas cuando el auditor lo vio en las dos.

---

## A. Pantallas de trabajo (dashboard, 45)

| Ruta | Propósito en una frase | Clics tarea principal | Habla como sistema | Primero vs. importante | Fricción (id · veredicto · prioridad) |
|---|---|---|---|---|---|
| `/antibiograma` | Capturar un antibiograma y que el motor PROA lo interprete (C) | **~6 clics + tecleo** (organismo + sitio + filas S/I/R) | C-021 (`No se pudo razonar (HTTP ${status})`, `:167,:207`) | D-006 (botón de 30 px, `:436`); D-003 (3 `<select>` sin etiqueta) | D-006 · c · P3 |
| `/asistente` | Agendar una cita en un solo formulario (C) · «dar una cita en un par de frases» (D) | **4-5 clics** (nombre, tipo, día, hora, Agendar); recepción midió 5 | C-017 («{n} lugares», `:807`); ASR-013 (nombre y teléfono sin `htmlFor`) | D-006 (flechas de mes 34×34) | ASR-013 · c · P2 · ASR-011 · p · P3 · C-017 · c · P3 |
| `/calendario` | Ver la semana/día y abrir o crear citas (C) | 1 clic + modal (nueva cita desde un hueco) | D-003 (8 campos del modal sin `htmlFor`) | — | PC-009 · c · P3 («caduca en unos días» sin decir cuántos, `AppointmentModal:413`) |
| `/chat` | Mensajería interna del equipo (C) | 1 clic (enviar) | C-011 (error de envío silencioso, `console.error`); N-012 (el índice lo vende como «mensajes con pacientes») | — | sin fricción confirmada |
| `/citas` | La lista de citas del día con sus acciones (C) · confirmar, mover, cancelar (D) | 2 clics (menú → estado). **Marcar «confirmada»: 4 clics más** (ASM-010) | ASR-006 («Estado actualizado: en-sala», «Ya estaba en «cancelada»», select con `pendiente-confirmar`); ASC-011 (modal de cobro sin etiquetas); ASC-015 («autorizó demo@…», el correo como nombre) | ASR-009 (acción primaria «Iniciar consulta» ignora el rol; «Llegó» a dos clics en un menú de diez); ASM-023 (cita sin teléfono: ninguna acción ni porqué); ASR-019 (etiqueta-botón 148×22); ASN-014 (el tour se come el primer clic) | ASM-010 · c · P2 · ASR-004 · c · P2 · ASC-010 · c · P2 · ASC-011 · c · P2 · ASR-009 · p · P2 · ASR-006 · c · P3 · ASM-023 · c · P3 · ASR-018 · p · P3 · ASR-019 · p · P3 · ASE-023 · c · P3 · ASN-014 · c · P3 · ASR-021 · p · P3 · ASC-015 · c · P3 · PC-009 · c · P3 |
| `/configuracion` | **No se puede decir en una frase — 17 pestañas** (C); «configurar el consultorio», 17 pestañas en 5 grupos (D) | 1 clic (guardar la ficha). **Comida de lunes a viernes: 5 clics + Guardar** (ASR-010, cifra del rojo) | C-020 (`toast('Error')`, `:1675`); C-021 («Missing or insufficient permissions», `:232`); ASM-018 («en la pestaña WhatsApp», que no existe); ASM-017 («Consultorio: undefined» / línea colgando); ASM-025 (plantilla, silencio y tope sin etiqueta); ASM-012 y ASM-015 (la vista previa pide «CONFIRMAR», el bot entiende «SÍ») | D-016 («Entregas de WhatsApp» es bitácora, no ajuste; el peor archivo del trinquete de diseño) | ASM-012 · c · P2 · ASM-015 · c · P2 · ASM-017 · p · P3 · ASM-018 · c · P3 · ASM-025 · c · P3 · ASR-010 · p · P3 · C-020 · c · P3 · C-021 · c · P3 · D-016 · c · P3 |
| `/consulta/[patientId]` | Dictar, armar y firmar la nota sin dejar de mirar al paciente (C, D) | 1 clic + confirmación (firmar). 7 567 líneas, 45 `<button>`, 82 `useState` (D) | MP-011 («N vacunas atrasadas», en rojo y urgente, sobre un niño del que la app no sabe qué se aplicó); C-021 (`Error de red al analizar (${String(e)})`, `:2298`); C-020 («Error al firmar», `:4493`); C-018 («1 años», `:4786`); PG-008 (la fecha de seguimiento sale ISO hacia el portal) | MP-015 (la dosis crítica pesa lo mismo que «medicamento controlado»); D-006 (ojo «ver la frase» 44×32 en táctil); D-013 (la acción central de la barra enlaza a la misma URL); MG-011 («Captura la FUM» aunque ya está capturada; ciclo inválido → 28 en silencio); D-001 (correcciones automáticas sin panel visible ni deshacer — `defecto` P2); D-005 (campos de receta sólo con placeholder — `mejora`) | MG-022 · c · P2 (rehace la FUM cada visita) · MP-008 · c · P2 (la dosis se teclea dos veces) · MP-011 · c · P2 · MP-015 · c · P2 · PG-008 · c · P2 · D-006 · c · P3 · D-013 · p · P3 · MG-011 · c · P3 · MG-017 · c · P3 · MG-018 · c · P3 · MO-008 · c · P3 |
| `/consultor` | Preguntar a la evidencia (PubMed/CENETEC) con contexto del paciente (C) | 1 clic | — (dice cuándo no hay citas) | — | sin hallazgo |
| `/corte-caja` | Cierre del día; vive como pestaña de `/finanzas` (C, D) | — (pestaña) | ASC-015 (imprime «autorizó demo@nexusmed.test», `corte-caja/page.tsx:261`) | ASC-006 (el corte, bajo «9 destinos que no hacen falta a diario» y sólo en modo médico) | ASC-015 · c · P3 · ASC-006 · c · P2 · candidato a fusión: D-015 (ver `13-`) |
| `/crm` | Métricas de conversión/retención, sólo lectura (C) · «de dónde llegan los pacientes» (D, y es lo que **no** tiene: N-013) | — (lectura) | N-014 («Confirma manualmente 0 citas pendientes»); C-008 (error de carga silencioso → KPIs en cero como si fueran verdad) | — | N-014 · c · P3 · candidato a fusión: N-015 (ver `13-`) |
| `/cumplimiento/motores` | Hoja de revisión clínica de los motores: validado / pendiente / experimental (C) | — (lectura, buscador con `aria-label`) | MI-003 (promete «etiqueta ámbar junto al dato» que nunca se pinta — ver `11-`) | — | sin fricción; MC-005 · defecto · P1 |
| `/cumplimiento` | Bitácora, ARCO y estado de cumplimiento (C) · «tres trabajos, enlazados como índice» (D) | 1 clic + `prompt()` nativo (resolver ARCO) | C-007 (`prompt('Describe brevemente qué se hizo…')`) | D-008 (badge RECHAZADA a 2.16:1 sobre su propio fondo en tema claro) | C-007 · c · P3 |
| `/cumplimiento/retencion` | Pacientes cerca de los 5 años de retención (C) | 1 clic (Abrir) — única acción | — | — | ASE-022 · **refutado** (ver al final) |
| `/cumplimiento/seguridad` | Activar/desactivar 2FA (C) | **4 pasos** | C-021 (`Error: ${err.message}` crudo de Firebase, `:83,:128`) | — | C-021 · c · P3 |
| `/dashboard` | HOY: las citas del día y entrar a la consulta (C) · «quién sigue ahora y qué pide atención hoy; ya está bien, una primaria» (D) | 1 clic (entrar a consulta) | — | ASR-017 (el aviso «Recordatorios de citas» flota encima de los botones «Consulta» de las 11:00 y 12:00); N-016 (el primer día, el tablero vacío sólo ofrece «Agendar cita»: nueve pasos hasta la primera nota y ninguno se enseña) | N-016 · c · P2 · ASR-017 · c · P3 |
| `/expediente/[patientId]` | El expediente longitudinal del paciente (C, D) | 1 clic (abrir nota) · 1 clic (nueva consulta) | C-018 («1 años», `:921`); ASN-007 («Últimos signos» sin unidades, sin talla, sin fecha) | PI-022 (invalidar el enlace del portal: botón plegado en «Datos del paciente»); D-023 (filtro y nota abierta se reinician al volver) | ASN-007 · p · P3 · D-023 · c · P3 · PG-012 · p · P3 · PI-022 · c · P3 |
| `/expedientes` | Redirección a `/pacientes` por marcadores viejos; dejar (C, D) | 0 | — | — | sin hallazgo |
| `/farmacia` | Inventario interno (C) · existencias del consultorio (D) | 2 clics (icono + confirmar) | C-020 («Error al guardar», `:272`); C-023 («es requerido», `:454`); D-003 (2 campos sin etiqueta) | — | sin fricción confirmada · candidato a esconder: N-026 (ver `13-`) |
| `/finanzas` | Lo cobrado por día/semana/mes (C) · cobros, corte y cómo va el mes (D) | 1 clic + modal (registrar cobro). **El importe se teclea a mano en cada cobro** (ASC-010) | C-017 («Descargados 1 cobros», `:181`); ASC-014 (CSV con fecha ISO UTC, sin quién cobró, anulados omitidos sin aviso); ASC-011 (Monto, Descripción, Notas, Motivo sin etiqueta); ASC-009 («Cobro registrado: $X» cuando no registró nada) | ASC-006 (la asistente que cobra no tiene enlace; para el médico vive bajo «9 destinos»); C-027 (CSV deshabilitado sin motivo, `:219`) | ASC-009 · c · P2 · ASC-010 · c · P2 · ASC-011 · c · P2 · ASC-006 · c · P2 · ASC-014 · c · P3 · ASC-015 · c · P3 |
| `/guia` | Guía de uso + bot de ayuda (C) · «cómo se hace cada cosa» (D) | — (buscador sin etiqueta accesible) | PC-010 (la ayuda afirma «un familiar autorizado es una autorización explícita, revocable y con bitácora» y el producto no tiene cuidador) | D-017 (el chat de ayuda aparece dos veces: FAB y dentro de `/guia`) | PC-010 · c · P2 · candidato a fusión: D-017 (ver `13-`) |
| `/hospitalizacion/[internamientoId]` | *(Hospital, en pausa D-030)* El episodio de internamiento con indicaciones, signos, labs, interconsultas (C) | 2-3 clics (registrar administración) | D-004 (9 campos sin etiqueta + 19 sólo placeholder); D-019 (Tailwind fuera de sistema) | — | sin fricción; C-038 · defecto · P3 |
| `/hospitalizacion/camas` | *(Hospital)* Tablero de camas (C) | 1 clic (borrar cama, **sin confirmación**) | D-004 (3 campos sin etiqueta) | D-020 (violeta literal) | sin fricción; C-013 · defecto · P3 |
| `/hospitalizacion/indicadores` | *(Hospital)* KPIs de ocupación/estancia (C) | — (lectura) | C-010 (error de carga tragado → ceros) | — | sin fricción |
| `/hospitalizacion` | *(Hospital)* Censo activo (C) · censo de internados (D) | 1 clic + modal (nuevo ingreso) | D-004 (3 campos sin etiqueta) | — (error de censo explícito, bien) | sin hallazgo de fricción |
| `/hospitalizacion/unidades` | *(Hospital)* Nombrar/clasificar unidades (C) | — | C-027 (inputs `disabled` para no-admin sin decir por qué, `:128-136`); D-004 (2 campos) | — | sin fricción confirmada |
| `/legal` | Aviso de privacidad y contrato de encargo generados (C) · consentimientos que firma el paciente (D) | 1 clic (copiar / descargar / imprimir) | — | — | PI-007 · p · P3 (el aviso nombra la transcripción, pero «grabación de voz» no está como dato recabado) |
| `/lista-espera` | Quién entra si se libera un hueco (C, D) | 1 clic + modal (agregar) | C-020 (`toast('Error')`, `:106`); C-023 («es requerido», `:258`) | — | sin fricción confirmada · ASR-014 · **refutado** (los campos prioridad y rango sí mandan sobre el aviso) |
| `/membresias` | Planes recurrentes de pacientes y cobro de cuotas (C, D) | 2 clics (cobrar cuota) | C-027 («Asignar a paciente» gris sin decir «crea un plan primero»); error de carga silencioso → «Sin membresías activas» (C) | ASC-018 (una cuota «adelantada sin cobro» sólo se avisa en la consola del navegador) | ASC-018 · c · P3 |
| `/migracion` | Exportar/importar pacientes (C) · traer y sacar expedientes (D) | 1 clic (exportar). **Importar 1 200 pacientes = 1 200 altas una a una, sin reanudación** (ASE-027) | C-017 («1 nuevos», `:235`); ASE-008 («Sube un CSV o Excel» y sólo acepta CSV); ASE-019 (remite al «respaldo en Pacientes», que vive en Operaciones); fecha del archivo en UTC (C) | ASE-007 («N duplicados (se omiten)» sin decir con quién coincide ni permitir forzar) | ASE-007 · c · P2 · ASE-027 · c · P3 |
| `/motores` | Enseñar los motores funcionando en vivo (C, D) | — (nadie la enlaza: D-009 / C-029, ver `11-`) | — | — | sin fricción |
| `/nota/[patientId]/[notaId]` | Ver/imprimir la nota firmada y añadir adendas (C) · leer, imprimir y adendar (D) | 1 clic (PDF). **Esguince: nota + orden + receta + incapacidad = tres pantallas y un documento que no existe** (MO-011) | C-018 («Edad: 1 años» en el impreso, `:441`); nombre de archivo con fecha UTC (C) | D-022 (sin procedencia en el documento — `mejora`) | C-018 · c · P3 · MO-011 · c · P3 |
| `/nota/[patientId]` | Ruta de rescate para `/nota/{id}` huérfano; dejar (C, D) | 0 | — | — | sin hallazgo |
| `/operaciones` | Índice de destinos administrativos (C) · «jerarquía plana a propósito y declarada» (D) | 1 clic por destino | N-012 y N-013 (dos tarjetas que prometen lo que la pantalla no hace); D-014 (el mismo destino se llama distinto según la barra: «Consulta» / «Pacientes» / «Paciente») | ASC-006 (Finanzas bajo «9 destinos que no hacen falta a diario»); ASE-018 (Migración y Documentos legales sólo en modo médico: la asistente que migra no ve la pantalla) | ASC-006 · c · P2 · ASE-018 · c · P2 · D-014 · c · P3 · candidatos en `13-`: D-024, C-034, ASM-022 |
| `/orden/[patientId]/[notaId]` | Generar la orden de estudios (C, D) | 1 clic (PDF). Estudio fuera de catálogo: «Otro» → input → «Agregar» | MO-012 (imprime literalmente «Radiografía de columna (cervical / dorsal / lumbar)»; el chip no se edita); nombre de archivo UTC (C) | — (mismo orden que `/nota` y `/receta`, D) | MO-012 · c · P3 · MO-005 · defecto · P2 (lo elegido no se guarda, ver `11-`) |
| `/pacientes` | Encontrar al paciente y entrar a su expediente/consulta (C, D) | 1 clic (abrir expediente) | C-023 («El nombre es requerido» / «La edad es requerida»); C-018 («1 años», `:424`); ASE-020 (siete campos del alta sin `htmlFor`); ASR-020 («Apellido Apellido, Nombre» aquí, «Nombre completo» en el asistente); D-002 (la X de limpiar búsqueda sin nombre) | ASE-009 (fundir duplicados es imposible; el diálogo dice «nada se junta solo»); ASE-023 / ASN-014 / ASR-021 (el tour «Tu agenda…» se abre encima de Pacientes y bloquea) | ASE-009 · c · P2 · ASE-020 · c · P2 · ASE-023 · c · P3 · ASN-014 · c · P3 · ASR-020 · c · P3 · ASR-021 · p · P3 · C-023 · c · P3 · MP-017 · `innecesario` · P2 (edad manual junto a fecha de nacimiento) |
| `/pendientes` | Worklist de cabos sueltos (C) · «todo lo que quedó abierto, en un solo sitio» (D) | 2 clics + motivo (cerrar tarea). No existe «Nuevo pendiente» (ASN-009, `11-`) | C-017 («1 siguen sin abrirse», `:371`); ASN-011 (el dueño aparece como «demo@nexusmed.test») | PG-013 (la paciente sólo ve «Tu consultorio ya la revisó»: la respuesta no vuelve) | ASN-011 · c · P3 · PG-013 · p · P3 |
| `/reactivacion` | Avisar a quien lleva meses sin volver (C, D) | 1 clic (WhatsApp); `disabled` explicados con motivo en toast | — | — | sin hallazgo |
| `/receta/[patientId]/[notaId]` | Generar la receta de una nota firmada (C, D) | 1 clic (PDF); «primaria primero» (D) | MP-017 (imprime la edad congelada, y ninguna para el lactante porque 0 es falso); nombre de archivo UTC (C) | — | sin `friccion`; MP-017 · `innecesario` · P2 · defectos P1 en `02-`: MI-001, MI-002, MI-014 |
| `/referencia/[patientId]` | Carta de referencia (C) · redactar la carta de referencia (D) | 1 clic (imprimir) | C-018 («1 años», `:239`); fecha sin zona del consultorio (C) | — | sin `friccion`; MC-004 · defecto · **P1** (no se guarda, ver `11-`) |
| `/resenas` | Moderar reseñas (C) · lo que escriben los pacientes y pedirlo cuando toca (D) | 1 clic (publicar) | C-012 (sin estado de error; excepción de carga no capturada) | — | sin fricción |
| `/uci/antimicrobianos` | *(UCI, en pausa)* Probar un caso **y** cargar topes: «dos cosas en una pantalla» por confesión propia (C, D-018) | — | D-004 (17 campos sin etiqueta, el peor archivo de la app; C anota «inputs con `<label>` envolvente»: el rojo dejó D-004 `parcial`) | D-018 (dos trabajos en una pantalla) | D-018 · c · P3 |
| `/uci/benchmark` | *(UCI)* Grabar frases actuadas para medir el dictado (C) | «Empezar de cero» borra **sin confirmar** (C) | — | D-006 (botón 36 px) | sin `friccion`; C-036 · defecto · P3 |
| `/uci/dosificacion` | *(UCI)* Consultar/validar 54 fármacos (C, D) | — (buscador sin etiqueta accesible) | A-016 (las 54 fichas están en inglés y se presentan como del producto) | — | A-016 · p · P3 |
| `/uci/enfermeria` | *(UCI)* Pendientes del turno (C) · hoja de enfermería (D) | — | — | — | sin hallazgo |
| `/uci` | *(UCI)* Pase de visita y calculadora (C) · el pase con cálculo en vivo (D) | 1 935 líneas | C-021 («Error de red al llamar al Copilot»); clave de día en UTC (C) | D-006 (2 botones < 44, `:907,:957`) | D-006 · c · P3 · B-014 · **refutado** (ver `11-`) |

**Sin propósito declarado en el dashboard: ninguna.** Las 45 tienen frase del programador; 43 también de diseño. Las dos que no caben en una frase están dichas por sus propios auditores: `/configuracion` («17 pestañas») y `/uci/antimicrobianos» («dos cosas»); `/cumplimiento` («tres trabajos») lo salva el ser índice.

**Tareas que pasan de tres clics** (marcadas arriba): `/antibiograma` (~6), `/asistente` (4-5), `/cumplimiento/seguridad` (4 pasos), `/citas › marcar confirmada` (4 más), `/migracion › importar` (una alta por fila), `/nota › cierre con orden y receta` (tres pantallas), `/finanzas › cada cobro` (importe a mano).

---

## B. Portal del paciente

| Ruta | Propósito en una frase | Clics tarea principal | Habla como sistema | Primero vs. importante | Fricción (id · veredicto · prioridad) |
|---|---|---|---|---|---|
| `/mi/[token]` | Portal del paciente (C) · «lo que el paciente necesita de su visita» (D) | Confirmar/cancelar cita: 1 clic. **Cada apertura gasta 3 de las 15 llamadas clínicas de 10 min: a la quinta recarga desaparecen plan, recetas y preguntas en silencio** (PC-006, PP-010); cuatro peticiones por carga (PI-025) | PC-005 / PP-015 (la respuesta urgente sale con asteriscos de WhatsApp sin procesar y dice «este canal es para citas» dentro de Preguntar); PG-008 / PI-016 («Tu próxima cita: 2026-09-20», «consulta del 2026-09-05», tomas con «·»); PG-021 («tú mismo», «¡Bienvenido!» a una paciente); PI-014 («Avisamos al consultorio» cuando se apuntó en una lista); PI-020 (pedir permiso para la hija → «esa pregunta la tiene que contestar tu médico»); PI-012 (sin señal muestra la landing para médicos; instalada abre el login del doctor); PC-019 («Agendar» = añadir a Google Calendar); C-017 («1 horas», `:614`) | PC-015 / PG-010 / PI-017 / PP-016 (lo que más importa a 10.5-12 px: navegación, «Preguntaste», procedencia, quién firma, «personal y caduca»); PP-011 («Documentos» sin recetas es una pestaña en blanco); PI-018 (citas pasadas escondidas al final de Cuidado); PG-020 (enlace vencido: una línea sin encabezado ni teléfono); PI-015 («Hola» a secas sin cita); PO-017 (ningún camino a ARCO); PP-020 / PO-021 (el destino «Perfil» no tiene un solo control) | **P2**: PC-005 · c · PC-006 · c · PC-015 · c · PG-008 · c · PI-016 · c · PP-010 · c · PP-011 · c · PI-011 · p (hipoglucemia y doble dosis no cuentan como urgencia — vocabulario, `NEEDS_CLINICAL_REVIEW`) · **P3**: PC-019 · c · PG-010 · c · PG-013 · p · PG-015 · c · PG-020 · c · PG-021 · c · PI-012 · c · PI-014 · c · PI-015 · c · PI-017 · c · PI-018 · c · PI-020 · c · PI-021 · c · PI-025 · p · PO-013 · c · PO-017 · c · PO-020 · c · PP-015 · c · PP-016 · c · PP-021 · p |

Nota de contexto: la compuerta A11Y-GATE-001 del portal está en 0 y la vía de urgencia va inmediatamente bajo el `<h1>` (D). Lo que falla no es la estructura: es el texto y la letra.

---

## C. Pantallas públicas principales

| Ruta | Propósito en una frase | Clics tarea principal | Habla como sistema | Primero vs. importante | Fricción (id · veredicto · prioridad) |
|---|---|---|---|---|---|
| `/` | Portada para médicos: H1 «Sal de la consulta con la nota hecha» (C: «Portada, 12 Links»; D: «Landing, 0 degradados») | 1 clic (Empezar gratis) | — | PC-021 / PG-019 (un paciente que llega a «/» no tiene ninguna salida hacia la reserva — por diseño, sin buscador de consultorios) | PC-021 · c · P3 · PG-019 · p · P3 · N-005 · defecto · P1 (en `02-`) |
| `/login` | **Sin propósito declarado** (C sólo anota los códigos `auth/*`; D el CTA de 48 px) | n/m | C-022 («No se pudo entrar con Google: auth/…», `:53,:120`); ASE-014 (el aviso `?pendiente=` que nadie lee, ver `11-`) | — | C-022 · p · P3 |
| `/registro` | **Sin propósito declarado** (C: «mismo patrón que login») | n/m | — | N-011 (en el teléfono se esconde el panel entero con «14 días gratis · sin tarjeta · desde $349»; el botón dice «Comenzar prueba gratis» sin decir de qué); N-018 (vende agenda y bot: ni una palabra de la nota por voz, justo lo que la portada retiró) | N-011 · c · P2 · N-018 · c · P2 |
| `/reservar/[clinicId]` | Reserva pública paso a paso (C) | n/m (pasos: tipo → fecha → hora → datos → confirmar; nadie contó clics) | C-019 («Error de conexión», «Error de red» de cara al paciente, `:107,:138`); ASR-012 / PO-019 (`/reservar` sin id cae en un 404 que habla de «caché», «versión vieja de la app» e «Ir al dashboard»); PP-007 (no pregunta para quién es la cita ni fecha de nacimiento: el niño nace sin edad) | PO-006 / PP-012 (con `tiposCita` vacío, «¿Qué tipo de consulta deseas?» sin un solo botón: callejón sin salida) | C-019 · c · P2 · PO-006 · c · P2 · PP-007 · c · P2 · PP-012 · c · P2 · ASR-012 · c · P3 · PO-019 · p · P3 |
| `/dr/[clinicId]` | Perfil público del médico, servidor, con «Agendar cita en línea» (C: «Perfil público SSR; enlaces reales») | 1 clic (agendar) | — | PO-017 (sin camino al portal de privacidad desde aquí); PP-012 (manda a una reserva que puede estar vacía) | sin fricción propia |
| `/privacidad/[clinicId]` | Portal ARCO del paciente (C) | Enviar una solicitud: elegir derecho → 3 campos obligatorios → enviar (botón gris hasta llenarlos, PI-023) | C-006 / PG-016 (`alert('Por favor llena los campos obligatorios')`, `alert('Error al enviar: ' + e.message)`); PP-013 («Nombre completo, como aparece en tu INE»: el menor no tiene INE ni forma de decir «en representación de»); PC-014 («Oposición (no usar para X)», la X de plantilla) | D-007 (contador de caracteres a 2.4:1); PO-012 (tarjeta con colores fijos: en tema oscuro el título parece deshabilitado) | C-006 · c · P2 · PG-016 · c · P2 · PO-012 · p · P2 · PC-014 · c · P3 · PP-013 · c · P3 |
| `/privacidad` | **Sin propósito declarado** (C: «sin hallazgo», sin nota) | n/m | — | — | sin hallazgo |
| `/resena/[token]` | **Sin propósito declarado** (C sólo anota las frases de error) | n/m | C-019 («Error de conexión» / «Error al enviar», `:25,:33`) | — | PP-019 · **refutado** (ver al final) · PO-011 · defecto · P2 |
| `/verificar/[token]` | **Sin propósito declarado** (C: «sin hallazgo», sin nota) | n/m | — | — | sin hallazgo |

**Sin propósito declarado (hallazgo de esta lectura): 5 pantallas** — `/login`, `/registro`, `/privacidad`, `/resena/[token]`, `/verificar/[token]`. Ningún auditor escribió para qué sirven. Que nadie lo haya dicho no significa que no lo tengan; significa que nadie las juzgó con la primera pregunta de la lente 2.

### Otras públicas (por completitud del inventario)

| Ruta | Lo que dijeron los auditores |
|---|---|
| `/operacion` | C-028 · p · P3: dice que Comisiones «está en construcción» y Membresías es «roadmap»; la segunda es falsa, la primera defendible |
| `/setup` | N-017 · `innecesario` · P3: contador `step` de un asistente que ya no tiene pasos (ver `13-`) |
| `/precios` | N-004 · `boton_muerto` · **P1** (ver `11-`) |
| `/superadmin` | C-031 · c · P3: `alert()` y `window.confirm()` nativos para guardar y borrar paquetes |
| `/superadmin/costos`, `/superadmin/contabilidad` | C anota «mes inicial en UTC» (sin id propio; entra en C-026) |
| `/teleconsulta/[citaId]` | C-019 («Enlace incompleto», «Error de conexión», `:23,:35`) |
| `/unirse/[code]` | C: «Error al aceptar la invitación.» es la única frase de sistema; menor |
| `/demo`, `/demo/interactivo`, `/demo/razonamiento`, `/paquetes`, `/arquitectura`, `/evidencia`, `/seguridad`, `/terminos`, `/contacto`, `/pago/exito`, `/pago/cancelado`, `/superadmin/{planes,simulador,csp,errores,onboarding,soporte}` | sin hallazgo (C revisó todas) |

---

## D. Los 10 cambios de facilidad con mejor relación impacto/esfuerzo

Ordenados por lo que la evidencia sostiene: prioridad final, cuántos auditores lo vieron y cuánto cuesta según la propia `propuesta`. Ninguno inventa una cifra clínica.

| # | Cambio | Por qué pesa | Esfuerzo (según la propuesta) | ids | archivo:línea |
|---|---|---|---|---|---|
| 1 | Estado vacío honesto en la reserva pública cuando no hay tipos de cita, y no dejar `publicBookingEnabled` sin al menos un tipo con duración | Es la primera pantalla de un consultorio recién dado de alta; **cinco auditores** cayeron en el mismo callejón; P2 | Una rama `tiposCita.length === 0` + una validación en Configuración | PG-007, PI-005, PO-006, PP-012, PC-007 | `src/app/reservar/[clinicId]/page.tsx:203`, `:151` · `src/app/api/public/clinic/[clinicId]/route.ts:83` |
| 2 | Añadir `'confirmada'` a `QUICK_STATUSES` y renombrar el primario «Confirmar» → «Pedir confirmación» (WhatsApp) con un segundo paso «Confirmada ✓ / No contesta» | Hoy «Confirmar» no confirma; marcar la confirmación telefónica cuesta 4 clics más y pasa por el editor; P2, visto por dos asistentes | Una entrada en un arreglo y una etiqueta | ASM-010, ASR-004 | `src/app/(dashboard)/citas/page.tsx:1061`, `:901`, `:1013-1017`, `:1088` |
| 3 | Fechas en palabras en el portal: pasar `procedencia.fechaConsulta` y `followUp` por `fmtFecha(tzClinica)`, también en la respuesta de la IA | «Tu próxima cita: 2026-09-20» en la pantalla del paciente; la norma ya existe una pantalla más allá (REG-242) y `fmtFecha` ya vive en ese archivo; P2 | Dos llamadas a una función que ya está importada | PG-008, PI-016 | `src/app/mi/[token]/page.tsx:814`, `:963` · `src/app/api/expediente/paquete-de-visita/route.ts:182` |
| 4 | Estado vacío en «Documentos» del portal, copiando la rama que «Cuidado» ya tiene (`:895-903`) | La abuela no sabe si cargó, si no hay nada o si hizo algo mal; P2 | Copiar una rama del mismo archivo | PP-011 | `src/app/mi/[token]/page.tsx:1039` |
| 5 | Una sola acción `inicio` en `/api/portal` (o cargar por pestaña) y enseñar el 429 real con su tiempo de espera; `preguntas === null` con su propio texto | A la quinta recarga el portal se queda sin plan, recetas ni preguntas y no lo dice; P2, dos pacientes | Una acción nueva que agrupe cuatro lecturas + dos mensajes | PC-006, PP-010, PI-025 | `src/app/api/portal/route.ts:331` · `src/app/mi/[token]/page.tsx:258-292`, `:775`, `:882` |
| 6 | `htmlFor`/`id` en los tres formularios de Practice que fallan la compuerta: alta de paciente (7 campos), modal de cobro (4 + 3 `<select>`), asistente y bloqueos (5 pares), plantillas de WhatsApp | «Campo sin etiqueta» es uno de los mínimos que **fallan la compuerta** de `design-system.md`; el patrón correcto ya está en el mismo archivo (`configuracion:545,550,556`); P2 | Líneas sueltas, ~25 pares | ASE-020, ASC-011, ASR-013, ASM-025, D-003 | `src/app/(dashboard)/pacientes/page.tsx:1174` · `src/components/CobrarModal.tsx:334` · `src/app/(dashboard)/asistente/page.tsx:455` · `secciones-comunicacion.tsx:385` · `src/components/AppointmentModal.tsx:513` |
| 7 | Frases de persona en las puertas públicas: reusar las de `/mi` («Sin conexión. Intenta de nuevo») en reservar, reseña y teleconsulta; y un 404 público que no hable de caché ni de dashboard | Es la lente 2 del dueño dicha por él; el paciente lee «Error de red»; P2 + P3 | Cambiar cadenas; una variante pública de `not-found` | C-019, ASR-012, PO-019 | `src/app/reservar/[clinicId]/page.tsx:107`, `:138` · `src/app/resena/[token]/page.tsx:25`, `:33` · `src/app/teleconsulta/[citaId]/page.tsx:23`, `:35` · `src/app/not-found.tsx:89`, `:120` |
| 8 | En móvil, promover la tira «14 días gratis · sin tarjeta · después desde $349/mes» encima del formulario de registro y repetir «sin tarjeta» junto al botón | La decisión del dueño (prueba sin tarjeta) es invisible justo donde se decide; P2 | Reordenar CSS; el texto ya existe y sale de `PLANES` | N-011 | `src/app/registro/page.tsx:390` (media query), `:213-226`, `:370` |
| 9 | Usar `estadoCita(s).label` en los dos toasts y en el `<select>` de estados; helpers `plural()` y `edadLegible()` para los 14 + 8 sitios contados | «Estado actualizado: en-sala», «Descargados 1 cobros», «Edad: 1 años» en el impreso firmado; el traductor ya se usa 200 líneas más abajo; P3 pero en documentos que se firman | Dos helpers y sustituciones mecánicas | ASR-006, C-017, C-018 | `src/app/(dashboard)/citas/page.tsx:427`, `:411`, `:1253` · `src/components/AppointmentModal.tsx:654` · `src/app/(dashboard)/nota/[patientId]/[notaId]/page.tsx:441` · `src/lib/texto-es.ts` |
| 10 | Rótulos que digan lo que abre: «Mensajes con tu equipo», «Cómo va la agenda: confirmaciones, ausencias y retención», «Conectar WhatsApp →» a `?tab=integraciones`, «Guardar en mi calendario», y condicionar «Confirma 0 citas pendientes» | Cinco textos que prometen o mandan a donde no está; cada uno es una línea; P3 | Cinco líneas | N-012, N-013, ASM-018, PC-019, N-014 | `src/app/(dashboard)/operaciones/page.tsx:154`, `:132` · `src/app/(dashboard)/configuracion/page.tsx:806` · `src/app/mi/[token]/page.tsx:592` · `src/app/(dashboard)/crm/page.tsx:211` |

Fuera de los diez por costar más de lo que parece, pero con el mismo peso: la letra mínima de 14 px en el portal (PC-015, PG-010, PI-017, PP-016 — decisión de diseño del dueño, no regla escrita); un solo vocabulario para el bot y las plantillas (ASM-012, ASM-015); la dosis pediátrica que pasa del panel a la receta con un clic (MP-008); la FUM que persiste entre visitas (MG-022); y la tarjeta de primeros pasos del primer día (N-016).

---

## E. Propuestas concretas de texto (antes → después)

Tomadas literalmente de los campos `propuesta`. Ninguna añade un dato; todas cambian cómo se dice.

| Pantalla | Antes | Después | id |
|---|---|---|---|
| `/citas` | «Confirmar» (abre WhatsApp, no cambia el estado) | «Pedir confirmación» + segundo paso «Confirmada ✓ / No contesta» | ASM-010, ASR-004 |
| `/citas` | «Estado actualizado: en-sala» · «Ya estaba en «cancelada»» | «Rosalía ya está en sala» (con `estadoCita(...).label`) | ASR-006 |
| `/citas` | (fila sin teléfono: nada) | Acción primaria «Falta teléfono» que abra el editor en ese campo; contador «1 sin teléfono» | ASM-023 |
| `/citas` › cobro repetido | «Cobro registrado: $8,000» (no registró nada) | «Esta cita ya estaba cobrada (folio CB-…, $800) desde otro dispositivo. No se registró un cobro nuevo.» | ASC-009 |
| `/finanzas` | «Descargados 1 cobros» | «Descargado 1 cobro» (helper `plural`) | C-017 |
| `/nota`, `/referencia`, `/expediente`, `/pacientes` | «Edad: 1 años» | «Edad: 1 año» (helper `edadLegible`) | C-018 |
| `/pacientes`, `/lista-espera`, `/farmacia`, `/configuracion` | «El nombre es requerido» · «La edad es requerida» | «Falta el nombre» · «Escribe el nombre del paciente» | C-023 |
| Toda la app (45 toasts) | «Error» · «Error al guardar» · «Error al firmar» | «qué no pasó + qué queda + qué hacer»; guardián de texto contra `toast('Error` | C-020 |
| `/configuracion`, `/cumplimiento/seguridad`, `/antibiograma` | «Error al guardar: Missing or insufficient permissions» · «Error: auth/…» · «HTTP 500» | Códigos conocidos → frases (como `login:93-97`); el detalle a `reportar-error`, no al toast | C-021 |
| `/configuracion › Notificaciones` | «…hasta que conectes el número del consultorio en la pestaña *WhatsApp*» | Enlace «Conectar WhatsApp →» a `?tab=integraciones` | ASM-018 |
| Recordatorio automático | «Consultorio: undefined» / «Consultorio: » | Omitir la línea entera cuando no hay teléfono; avisar en Notificaciones que falta | ASM-017 |
| `/operaciones` | «Chat — Mensajes con pacientes y con el equipo» | «Chat — Mensajes con tu equipo» | N-012 |
| `/operaciones` | «CRM — De dónde llegan los pacientes y qué pasó con cada contacto» | «Cómo va la agenda: confirmaciones, ausencias y retención» | N-013 |
| `/operaciones` | «9 destinos que no hacen falta a diario» (incluye Finanzas y Migración) | Quitar la frase para lo que la recepción sí usa; «Cobros y corte del día» en «Todos los días» con `modos: 'ambos'` | ASC-006, ASE-018 |
| `/crm` | «Confirma manualmente 0 citas pendientes para reducir no-shows» | Sólo si `> 0`; si nada aplica, «Nada urgente hoy» | N-014 |
| `/migracion` | «Sube un CSV o Excel exportado desde tu sistema actual» | «CSV (desde Excel: Guardar como → CSV UTF-8)» + rechazo del `.xlsx` diciendo cómo convertirlo | ASE-008 |
| `/migracion` | «…está el respaldo completo en Pacientes» | «…en Operaciones → Respaldo» (con enlace) | ASE-019 |
| `/migracion` | «N duplicados (se omiten)» | «coincide con: <nombre existente> · <motivo>» + «Importar de todas formas» | ASE-007 |
| `/cumplimiento` | «Marcar resuelta» (para los cinco tipos ARCO) | «Entregar expediente…» / «Ejecutar oposición…», con casilla de identidad | ASE-011 |
| `/cumplimiento/motores` | «sus resultados salen en pantalla con una etiqueta ámbar junto al dato» | O se pinta el sello, o se quita la frase | MI-003 |
| `/consulta › Entregar al paciente` | «Si quieres que los lea, escríbelos en tus indicaciones» | Decir dónde se escriben de verdad (campo «Signos de alarma para el paciente») o quitar la promesa | PO-004, MG-015 |
| `/consulta › barra pediátrica` | «N vacunas atrasadas» (rojo, urgente) | «N vacunas corresponden por edad · verifica cartilla», sin `urgente` | MP-011 |
| `/consulta › gineco` | «Captura la fecha de última menstruación» (con FUM futura) | «La FUM no puede ser posterior a hoy» · «Ciclo no válido: se usa 28 días» | MG-011 |
| `/dashboard` (tour) | «Aquí ves las citas del día… Es tu pantalla de inicio» (abierto sobre Pacientes o Configuración) | Sólo en `/dashboard`, o que el primer paso describa la pantalla donde se abrió | ASE-023, ASR-021 |
| `/dashboard` (primer día) | «Hoy no hay citas. La agenda está libre.» + «Agendar cita» | Tarjeta de tres pasos mientras no haya primera nota: «Prueba el dictado con un paciente de ejemplo» · «Da de alta a tu primer paciente» · «Completa tu cédula para poder firmar» | N-016 |
| `/registro` (móvil) | «Comenzar prueba gratis →» a secas | «14 días gratis · sin tarjeta · después desde $349/mes» encima del formulario | N-011 |
| `/registro` (panel) | «Tu consultorio, conectado» + seis beneficios de agenda y bot | «Sal de la consulta con la nota hecha» + los beneficios de `RECORRIDO` (`page.tsx:73`), una sola lista compartida | N-018 |
| `/reservar` | «Error de conexión» · «Error de red» | «No pudimos conectar. Revisa tu señal e inténtalo de nuevo» | C-019 |
| `/teleconsulta` | «Enlace incompleto» | «Este enlace está incompleto: ábrelo desde el mensaje que te mandó el consultorio» | C-019 |
| `/reservar` (sin id, 404) | «Es posible que tu navegador esté usando una versión vieja de la app… Ir al dashboard» | «Este enlace no está completo. Pide a tu consultorio el enlace de citas» · «¿Eres médico? Ir a tu agenda» | ASR-012, PO-019 |
| `/reservar` (sin tipos) | «¿Qué tipo de consulta deseas?» (vacío) | «Este consultorio todavía no abrió su agenda en línea; llama al {teléfono}» | PG-007, PI-005, PO-006, PP-012 |
| `/reservar › datos` | «Nombre completo *» | «¿Para quién es la cita?» (para mí / para mi hijo·a) → nombre, fecha de nacimiento, quién agenda y parentesco | PP-007 |
| `/` (pie) | (nada para pacientes) | «¿Eres paciente? Usa el enlace que te dio tu médico» | PC-021, PG-019 |
| `/mi` › cita | «Agendar» (añade a Google Calendar) | «Guardar en mi calendario» | PC-019 |
| `/mi` › urgencia | «🚨 *Esto puede ser una urgencia médica.* … este canal es para citas … Llame al *911*» | Mismo texto sin marcas de WhatsApp, con `tel:911` y `tel:` del consultorio tocables; «esta pantalla no la lee nadie ahora mismo» | PC-005, PI-014, PP-015 |
| `/mi` › urgencia | «Avisamos al consultorio de que usted escribió» | «Quedó marcada como urgente para tu consultorio; no esperes a que te llamen» | PI-014 |
| `/mi` › escalación | «Esta pregunta la tiene que contestar tu médico, no yo… llámales» (también para «¿cómo le doy permiso a mi hija?») | Para enlace/permiso/acceso/familiar: `ADMINISTRATIVE_ACTION` con el texto de Perfil («pídeselo al consultorio») | PI-020 |
| `/mi` › escalación | «…el consultorio la va a ver. Si es algo que no puede esperar, llámales.» | «El consultorio lee estas preguntas de 9 a 18 h. Si no puede esperar, llama al …» (horario y teléfono configurados) | PP-021 |
| `/mi` › respuesta | «Eso lo puedes ver y cambiar tú mismo» · «¡Bienvenido!» | «lo puedes ver y cambiar en Hoy» · «Hola, ¿en qué le podemos ayudar?» | PG-021 |
| `/mi` (menor) | «Hola, Tadeo» · «¿Qué quieres preguntar sobre tu tratamiento?» | «Hola. Aquí está lo de Tadeo» · «¿Qué quieres preguntar sobre el tratamiento de Tadeo?» | PP-015 |
| `/mi` (sin cita) | «Hola» | «Hola, Rosalía» (nombre del expediente, no de la primera cita) | PI-015 |
| `/mi` › Documentos vacío | (nada) | «Cuando tu médico firme una receta, aparecerá aquí para descargarla. Si ya te dio una en papel, es la misma.» | PP-011 |
| `/mi` › enlace vencido | «Este enlace ya no es válido o venció. Pide uno nuevo al consultorio.» (sin encabezado) | H1 «Este enlace ya no sirve» + teléfono del consultorio si el token lo permite | PG-020 |
| `/mi` › Preguntar (freno) | «No pudimos cargar el resumen de tus consultas… vuelve a intentarlo» (era un 429) | «Has abierto el portal muchas veces seguidas; espera N minutos» (lo que el servidor ya devuelve) | PC-006, PP-010 |
| `/mi` › Cuidado | «Paracetamol · 1 g · por la boca · cada 8 horas (3 veces al día) · durante 5 días» | «por la boca, cada 8 horas —3 veces al día—, durante 5 días» (conectores, sin datos nuevos) | PI-016 |
| `/mi`, cita por WhatsApp | «caduca en unos días» | «caduca en 7 días» (`DIAS_DEFECTO`) | PC-009 |
| `/privacidad/[clinicId]` | «Oposición (no usar para X)» | «Oposición (que no se usen mis datos para un fin concreto)» | PC-014, PP-013 |
| `/privacidad/[clinicId]` | `alert('Por favor llena los campos obligatorios')` · `alert('Error al enviar: ' + e.message)` | Texto en pantalla junto al campo con `role=alert`; fallo fijo sin `e.message` | C-006, PG-016 |
| `/privacidad/[clinicId]` | «Enviar solicitud» gris sin explicación | «Faltan nombre y teléfono» junto al botón, o botón activo que anuncie lo que falta | PI-023 |
| `/privacidad/[clinicId]` | «Nombre completo, como aparece en tu INE» | Primer paso «¿Los datos son tuyos o de alguien a tu cargo?»; si es menor: nombre y fecha del menor + nombre, parentesco e identificación del representante | PP-013 |
| `/guia` › Ayuda | «Un familiar autorizado es una autorización explícita, revocable y con bitácora» | «Todavía no: pídelo al consultorio» hasta que exista el cuidador | PC-010 |
| `/orden` | «Radiografía de columna (cervical / dorsal / lumbar)» impreso tal cual | Entradas concretas por segmento y lado, o chips editables | MO-012 |
| `/pendientes` | «demo@nexusmed.test» como dueño | Nombre del miembro del consultorio (mismo resolvedor que `medicoNombre`) | ASN-011 |
| `/corte-caja` | «autorizó demo@nexusmed.test» | Nombre del equipo vía `nombrePorUid` (como ya hace `quienAnulo`) | ASC-015 |
| `/operacion` (pública) | «Comisiones: en construcción» · «Membresías: roadmap» | Membresías → activo; Comisiones → activo o «parcial» si el dueño lo considera incompleto; derivar de `modulos.ts` | C-028 |

---

## F. Se propuso y no procede (refutados por el equipo rojo)

| id | Se propuso | Motivo del equipo rojo | Prioridad final |
|---|---|---|---|
| ASE-022 | Que `/cumplimiento/retencion` deje de decir «con acciones disponibles» o gane una acción «Archivar» | La frase está en el **comentario de cabecera** del archivo (`:5`), invisible para el médico: la pantalla no promete nada que incumpla. Qué hacer con un expediente de más de 5 años es política del dueño con su asesor | P3 |
| PP-019 | Que el enlace de reseña vencido diga que caducó y dé teléfono | La línea 22 ya dice «Este enlace ha expirado» y hay rama propia para «ya fue enviada»; el auditor probó `/resena/invalido` (token inexistente) y generalizó al vencido. Sobrevive sólo que ninguna rama ofrece teléfono (P3 informativo) | P3 |

Además, 21 `friccion` quedaron **parciales**: el hecho es cierto, la consecuencia o la cifra no. Están marcados «p» en las tablas; el matiz del rojo vive en `R-*.json` y conviene leerlo antes de tocar: ASR-009 (la asistente no llega a `/consulta`: el guardia la rebota), ASR-010 (5 clics, no 18), ASR-011 (crear el duplicado es la decisión que cerró REG-039), ASR-018 (cobrar antes es un anticipo legítimo), ASR-019 (el nombre accesible ya explica; sólo sobrevive el tamaño), ASR-021 (el tour sólo lo ve `esMedicoReal`), D-013 (que la grabación muera al remontar es supuesto no verificado y choca con REG-303), C-022 (el `popup-closed` no puede ocurrir: se usa redirect), C-028, ASM-017, ASN-007 (el IMC sí se calcula en el copiloto; lo que no se hace es persistirlo), PG-012 (la invalidación sí deja bitácora; falta el motivo), PG-013 (devolver texto del médico al portal exige decisión del dueño por `patient-facing-ai.md` §1 y §4), PI-007 (el aviso sí nombra la transcripción), PI-011, PI-025, PO-012 (los 55×20 son artefacto del arnés sin `hasTouch`), PO-019, PG-019, PP-021, A-016.
