# 06 — Voces de pacientes

**Los 30 pacientes son personajes interpretados por un modelo**, seis arquetipos por especialidad, sobre datos sintéticos (`consultorio-demo-v10`, `pac-001`…`pac-006`). Ninguno es real.
**Cada afirmación de defecto está anclada a `archivo:línea` y pasó por el equipo rojo**: aquí sólo se citan como defecto los hallazgos con veredicto `confirmado` (o `parcial`, y se dice); un `refutado` no se cita como defecto. Fuente: `crudos/P-*.json` y `crudos/R-P-*.json`.

Los cinco recorridos cerraron 111 hallazgos: 78 confirmados, 29 parciales, 4 refutados (`PC-016`, `PG-009`, `PP-004`, `PP-019`). **Ningún P0 sobrevivió**: el único posible —que la IA del paciente originara un dato— lo descartaron los cinco auditores tras probarlo, y `PO-001` bajó de P0 a P1 porque no hay fuga entre pacientes ni dato inventado.

Escala: cada paso se calificó 1–5 en cuatro preguntas — ¿Entendí? ¿Confié? ¿Pude solo? ¿Me sentí seguro? — y el promedio de la fila es el promedio de esas cuatro sobre todos los pasos calificados del recorrido.

---

## 1. Los 30 recorridos

| Esp. | Arquetipo | Prom. | Paso peor (prom.) | Veredicto del personaje |
|---|---|---|---|---|
| Interna | 1 · Adulto mayor | 3.08 | Consentimiento de grabación (2.00) | «Cuando el enlace llega, el portal es limpio y honesto; lo que sobra (tema, Word, fechas crudas, letra de 12 px) y lo que falta (mi nombre, un botón en la reserva vacía) es justo lo que a una persona de 74 años la deja fuera.» |
| Interna | 2 · Gama baja | 3.21 | Seguimiento sin conexión (1.50) | «El portal no pesa por diseño sino por repetición: cuatro peticiones por carga, un cupo que se agota con cinco recargas y un modo sin conexión heredado del médico.» |
| Interna | 3 · Cuidadora | 3.25 | Consentimiento de grabación (2.25) | «No existe la cuidadora: o comparte la credencial completa de su padre sin rastro, o no entra; el portal al menos no finge lo contrario.» |
| Interna | 4 · Lector de pantalla | 3.42 | Agendar desde la página pública (2.50) | «El portal es de las pantallas mejor construidas para un lector de pantalla en todo el producto; los tropiezos están antes (la reserva vacía) y después (el botón gris del ARCO).» |
| Interna | 5 · 2 a.m. | 3.54 | Agendar (2.50) | «Ninguna respuesta nace del modelo general (no hay P0); la urgencia sale primero y llega al worklist; el hueco está en la cita literal del plan que contesta preguntas de omisión y de efectos adversos como si fueran de horario, y en un cupo que puede callar la urgencia.» |
| Interna | 6 · Reenvía el enlace | 3.41 | Revocar (2.50) | «El enlace de agenda filtra poco y el clínico lo filtra todo durante siete días; la defensa (caducidad + revocación) existe, pero vive sólo del lado del consultorio y sin bitácora de accesos.» |
| Cirugía | 1 · Adulto mayor | 3.52 | Consentimiento quirúrgico (2.25) | «El portal me habla bien y en grande donde importa, pero me enseñó diagnósticos que no son míos y la reserva en línea me dejó frente a una pared en blanco.» |
| Cirugía | 2 · Gama baja | 3.42 | Recargar varias veces (2.25) | «Con datos flojos el portal se vuelve un cascarón: lo único que quiero leer sin conexión es lo único que no guarda.» |
| Cirugía | 3 · Cuidadora | 3.05 | Bitácora / revocación (2.25) | «Cuidé a mi esposo con su identidad prestada: el producto lo sabe y lo dice, pero la ayuda del médico cuenta otra historia.» |
| Cirugía | 4 · Lector de pantalla | 3.93 | Reserva pública (1.75) | «El portal está hecho pensando en mí (etiquetas, foco, encabezados); lo que me falla es la letra y el markdown crudo de la urgencia.» |
| Cirugía | 5 · 2 a.m. | 3.81 | «¿La herida se ve normal?» + foto (2.75) | «La IA nunca me inventó nada —eso es lo mejor del producto— pero a las dos de la mañana “ya quedó registrada” sin teléfono es una puerta cerrada con buenos modales.» |
| Cirugía | 6 · Reenvía el enlace | 3.67 | Revocación (2.75) | «El enlace está bien atado (firma, 7 días, alcance, revocación), pero reenviado es una llave completa sin segundo candado y sin que yo me entere.» |
| Gineco | 1 · Adulto mayor (42, embarazo tardío) | 3.20 | Buscar y agendar (2.25) | «Confío en la doctora y en que el portal no inventa, pero no pude sola con la letra, con la fecha en números ni con encontrar dónde empezar.» |
| Gineco | 2 · Gama baja | 3.62 | Buscar y agendar (2.75) | «Ligero y directo cuando funciona; la reserva vacía y la receta en Word son los dos muros para un celular como el mío.» |
| Gineco | 3 · Cuidadora (madre de menor) | 3.30 | Consentimiento de grabación (2.25) | «El sistema ni me autoriza ni me impide: soy dueña del expediente de mi hija por haber puesto mi teléfono, y eso no lo decidió nadie.» |
| Gineco | 4 · Lector de pantalla | 3.70 | Consentimiento de grabación (2.25) | «El portal está hecho pensando en mí (etiquetas, roles, encabezados), y justo el botón de urgencia y las etiquetas de navegación se quedaron pequeños.» |
| Gineco | 5 · 2 a.m. | 3.25 | «Tengo sangrado y dolor fuerte» (2.00) | «Nunca me inventó nada — eso lo cumple — pero tampoco reconoció que sangrar embarazada es urgencia, y me dejó esperando al consultorio.» |
| Gineco | 6 · Reenvía el enlace | 3.27 | ARCO / revocación (2.25) | «El enlace caduca y se puede invalidar de golpe, pero sólo desde el consultorio: durante una semana quien lo tenga soy yo ante el sistema.» |
| Ortopedia | 1 · Adulto mayor | 3.18 | Agendar desde la página pública (2.25) | «Con una mano se usa (barra abajo, botones grandes, letra legible), pero lo que más necesita —ejercicios, lado, una receta que se abra— no está en su portal, y lo que sí está (el Word) trae diagnósticos que no son suyos.» |
| Ortopedia | 2 · Gama baja | 3.43 | Agendar desde la página pública (2.00) | «Funciona en su teléfono y se entiende, pero la primera pantalla pública puede estar vacía y el portal se bloquea si lo abre muchas veces desde WhatsApp.» |
| Ortopedia | 3 · Cuidador (padre de menor) | 3.34 | Agendar desde la página pública (2.75) | «Todo funciona a nombre del menor y nada registra que quien actúa es el padre: honesto en la pantalla, inexistente en el modelo.» |
| Ortopedia | 4 · Lector de pantalla | 3.48 | Pedir mis datos (ARCO) (2.25) | «El portal es la pantalla mejor hecha para lector de pantalla del recorrido; la reserva y el portal de privacidad no están a su altura.» |
| Ortopedia | 5 · 2 a.m. | 3.43 | «El pie se me puso morado y frío con la férula» (2.25) | «La IA nunca inventa (no hay modelo detrás) y eso es lo mejor del producto; lo peor es que la única urgencia propia de su lesión se le contesta ‘pendiente de revisar’.» |
| Ortopedia | 6 · Reenvía el enlace | 2.75 | Receta / plan liberado (2.25) | «El aislamiento entre pacientes y la caducidad funcionan; lo que falla es que el único papel que ella puede compartir es todo su expediente, y ese papel además dice diagnósticos que no son suyos.» |
| Pediatría | 1 · Adulto mayor (abuela) | 3.07 | ARCO del menor (2.25) | «El portal no le miente ni le inventa nada, pero le habla al nieto, escribe pequeño lo que a ella le importa y no le dice hasta qué día dar el jarabe.» |
| Pediatría | 2 · Gama baja (madre joven) | 3.11 | Portal: recargar varias veces (2.25) | «Ligero y honesto cuando funciona, pero la reserva pública la deja sin botones, la receta le baja en un formato que no abre y el freno del portal le borra sus preguntas sin avisar.» |
| Pediatría | 3 · Cuidador (padre separado) | 2.82 | ¿Quién ve qué? (2.50) | «No hay cuidadores: hay un enlace por niño, y dos padres con el mismo enlace son la misma persona para el sistema, sin bitácora ni revocación individual — el producto lo confiesa en Perfil, que es lo único bueno.» |
| Pediatría | 4 · Lector de pantalla | 3.89 | Documentos (2.50) | «Correcto en lo básico (etiquetas, roles, alertas, urgencia primero) y flojo en navegación: sin salto a secciones, historial sin encabezados y una pestaña que enmudece cuando está vacía.» |
| Pediatría | 5 · 2 a.m. (madre) | 3.53 | Mismo mensaje por WhatsApp (1.75) | «La IA nunca inventa una dosis ni una hora —eso está bien hecho—, pero al lactante letárgico con 39.5 y a la doble dosis ya tomada los manda a la bandeja de la mañana, y el bot de WhatsApp contesta precios a preguntas de mililitros.» |
| Pediatría | 6 · Reenvía el enlace (a la guardería) | 2.96 | ¿Hay algo acotado que compartir? (2.00) | «El WhatsApp no filtra nada, pero el enlace lo abre todo durante siete días, deja actuar en nombre del niño y no existe la pieza que la madre de verdad quería mandar: sólo la receta.» |

Notas de cálculo: el paso «Pagar» de Cirugía-1 se calificó 0/0/0/0 («No me apareció nada de pagar») y no entra en el promedio. Los «Llegar y esperar» de Interna (3/3/3/3, «no existe pantalla de espera para el paciente») sí entran en la fila pero no en el mapa de calor, porque no son un paso del bucle canónico. Empates en el paso peor se resuelven por orden de aparición.

Promedio por arquetipo, cruzando las cinco especialidades: **4 · lector de pantalla 3.66** · 5 · 2 a.m. 3.50 · 2 · gama baja 3.36 · 1 · adulto mayor 3.21 · 6 · reenvío 3.21 · **3 · cuidador 3.20**. Promedio global de los 280 pasos calificados: 3.36.

---

## 2. Mapa de calor por paso del bucle de cuidado

Promedio de las cuatro preguntas sobre los 280 pasos calificados de los 30 recorridos, y cuántos de esos pasos se auditaron **sobre código y no en vivo** (`recorrido: no`, o «código»/«motor»). Donde dice «no» en 19 de 19, el personaje leyó `archivo:línea` y contó lo que leyó: la calificación mide el texto del código, no una pantalla.

| Paso | Pasos | Prom. | En vivo | Parcial | Sobre código | Lectura |
|---|---|---|---|---|---|---|
| Agendar (página pública) | 24 | **2.81** | 14 | 7 | 3 | El peor del bucle. La pantalla «¿Qué tipo de consulta deseas?» sin opciones ni mensaje (`PI-005`, `PG-007`, `PO-006`, `PP-012`; `PC-007` P3). Nadie pasó del primer paso en vivo. |
| Confirmar por WhatsApp | 19 | 3.99 | 0 | 0 | 19 | Sólo código: WhatsApp real prohibido. El texto «Responde SÍ / NO» gustó a todos. |
| Consentimiento de grabación | 19 | **2.84** | 4 | 0 | 15 | Se lo lee el médico, se pide una vez por vida, y el texto dice «en este dispositivo» cuando el audio sube a la nube (`PG-003`, `PO-016`, `PI-003`, P2). |
| Consulta | 17 | 3.99 | 0 | 0 | 17 | No hay dictado en el arnés. «Me miró a mí y no a la computadora» se escribió leyendo `consulta/[patientId]/page.tsx`, no viéndolo. |
| Receta / plan liberado | 30 | 3.22 | 19 | 0 | 11 | Diagnósticos descartados en receta y resumen (`PC-001`, `PO-001` P1; `PO-002`), indicaciones que no llegan (`PO-004`, `PG-002`, `PC-002`), .doc que no abre (`PG-015`, `PP-014`, `PC-022`, `PO-013`, `PI-021`). |
| Portal (leerlo, alcance del enlace, quién ve qué) | 46 | 3.35 | 31 | 0 | 15 | Bien para lector de pantalla; mal en letra (`PC-015`, `PG-010`, `PI-017`, `PP-016`), saludo sin nombre (`PI-015`), cuidador inexistente (`PC-010`, `PP-008`), sin bitácora de accesos (`PI-010`). |
| Preguntar a la IA | 52 | 3.63 | 32 | 2 | 18 | Nunca origina un dato; escala. Los puntos bajos son urgencias de especialidad fuera del vocabulario (parciales) y el cupo que bloquea la urgencia (`PI-004` P1). |
| Pagar | 19 | 3.05 | 0 | 0 | 19 | Sin anticipo configurado en la siembra, nadie vio «Pagar». Sólo `create-checkout/route.ts` leído. |
| Dejar reseña | 16 | 4.00 | 0 | 4 | 12 | El token lo crea el cron tras la cita: sólo se recorrió el enlace inválido. Las estrellas con nombre gustaron. `PO-011` (no anónima) P2. |
| ARCO | 19 | **2.93** | 19 | 0 | 0 | El único paso recorrido en vivo por todos. Botón «Enviar» gris sin decir por qué (`PI-023`, `PG-016`), `alert()` del sistema, sin camino desde `/mi` (`PO-017`, `PC-014`), sin «en representación de mi hijo» (`PP-013`), contraste (`PO-012` parcial). |
| Seguimiento | 19 | 3.13 | 10 | 0 | 9 | Fechas ISO (`PG-008`), respuesta que no vuelve (`PG-013` parcial), ejercicios y vacunas que no llegan (`PO-004`, `PP-018`), offline heredado del médico (`PI-012`). |

Totales: 129 pasos en vivo, 13 parciales, **138 sobre código**. Tres pasos del bucle (confirmar, consulta, pagar) nunca se recorrieron en vivo por nadie; el §5 dice por qué.

---

## 3. Por arquetipo: qué les pasó a los seis en las cinco especialidades

### Arquetipo 1 · Adulto mayor, letra grande (promedio 3.21)

Patrones que se repiten en las cinco:

- **La reserva vacía.** Los cinco chocaron con «¿Qué tipo de consulta deseas?» sin un botón. La pantalla no tiene rama vacía (`src/app/reservar/[clinicId]/page.tsx:203`): `PI-005`, `PG-007`, `PO-006`, `PP-012` (P2), `PC-007` (P3). El equipo rojo aclaró en `ASR-002` que la lista vacía la produce la siembra sintética (`scripts/design/sembrar-emulador.mjs:425-435`; todo consultorio real nace con 8 duraciones), pero el silencio de la pantalla es real.
- **La letra chica donde más importa.** Etiquetas de navegación a 10.5 px y «quién firmó», «Preguntaste», «pendiente de revisar» a 12 px: `PC-015` (P2), `PG-010`, `PI-017`, `PP-016` (P3), en `src/app/globals.css:302` y `src/app/mi/[token]/page.tsx:979-1128`.
- **La receta en Word.** «Descargar» entrega un .doc que el teléfono no abre: `PI-021`, `PC-022`, `PG-015`, `PO-013`, `PP-014` (P3), `src/lib/receta-word.ts:3`.
- **Le hablan a otro, o a nadie.** «Hola» sin nombre cuando no hay cita (`PI-015`, `src/app/api/portal/route.ts:356`); «Hola, Tadeo» a la abuela que lee (`PP-015`, `src/app/mi/[token]/page.tsx:496`); fechas «2026-09-20» y tomas con puntitos (`PI-016` P2, `src/app/mi/[token]/page.tsx:814`; `PG-008`).
- **Diagnósticos que no son suyos.** `PC-001` y `PO-001` (P1): `src/app/api/portal/route.ts:1090` vuelca todos los diagnósticos de la nota, descartados incluidos, en la receta descargable y en el resumen.
- **Tempra y paracetamol como dos medicinas** (`PI-006` P2, `src/lib/paciente/paquete-de-visita.ts:282`); «5 mL cada 8 horas 7 días» sin fecha de fin ni peso (`PP-006`, parcial P3).

Citas:

> «“Hola” y ya, sin mi nombre. Las medicinas vienen con puntitos: Paracetamol · 1 g · por la boca · cada 8 horas. Y dice que ya no tomo Tempra pero que empiezo paracetamol, ¿no es lo mismo? La letra chiquita abajo no la leo.» — Interna (`PI-015`, `PI-016`, `PI-006`, `PI-017`)

> «Dice que tengo “sospecha” de algo y una “descartada”. ¿Entonces qué tengo?» — Cirugía (`PC-001`)

> «Dice que ‘el paciente fue informado’. El paciente tiene once meses. ¿Firmo yo? Yo no soy su mamá.» — Pediatría (`PP-009`, parcial P3; `src/app/(dashboard)/consulta/[patientId]/page.tsx:7460`)

### Arquetipo 2 · Celular de gama baja y datos limitados (promedio 3.36)

- **Cuatro peticiones por apertura contra un cupo de 15 en 10 minutos.** A la quinta o sexta recarga desde WhatsApp desaparecen plan, recetas e historial, con un mensaje que habla de «documentos»: `PC-006`, `PO-008`, `PP-010` (P2), `PI-025` (parcial P3), en `src/app/api/portal/route.ts:331` y `src/app/mi/[token]/page.tsx:254-292`. El equipo rojo precisó: falla la sexta, no la quinta, y el freno se cobra antes del control de alcance. La consecuencia grave la vivió el arquetipo 5: con el cupo agotado la urgencia no se registra (`PI-004` P1).
- **Sin conexión no hay nada.** El service worker guarda el cascarón y no el plan (`PC-016` **refutado como defecto**: es la política declarada en `public/sw.js:70-73` de no cachear datos clínicos; queda como decisión del dueño). Lo que sí se confirmó: sin señal el portal enseña la página de venta para médicos y «instalar» abre el login del doctor (`PI-012` P3, `public/sw.js:88`), y el HTML de `/mi/<token>` queda en Cache Storage con el token como clave (`PC-017` P3, `public/sw.js:66`).
- **El .doc y la reserva vacía** (mismos ids que el arquetipo 1).
- **Lo que gustó:** texto plano por WhatsApp, un enlace sin adjuntos, «Sin conexión. Tu pregunta no se envió; vuelve a intentarlo» (`src/app/mi/[token]/page.tsx:349`).
- Peso de página medido sólo en servidor de desarrollo (2.4–6 MB de JS): no representativo, y así lo declaran los cinco.

Citas:

> «Cada vez que entro hace cuatro peticiones y si cambio de pestaña y vuelvo, vuelve a pedir todo. A la sexta recarga me dice “demasiadas consultas”.» — Interna (`PI-025`; la parte «al cambiar de pestaña» la refutó el equipo rojo: los destinos son estado local)

> «Volví a entrar y mis preguntas ya no estaban. Nadie me dijo por qué.» — Pediatría (`PP-010`)

> «Carga bien con Wi-Fi. En el camión, “Sin conexión. Intenta de nuevo” y mis indicaciones no están.» — Cirugía (`PC-016`, refutado: política declarada)

### Arquetipo 3 · Cuidador de un tercero (promedio 3.20, el más bajo)

- **El cuidador no existe en el modelo.** Un enlace por paciente, atado a `{clinicId, patientId}`; quien lo tiene es el paciente ante el sistema. Sin autorización, sin revocación individual, sin bitácora: `PC-010` (P2, confirmado: la Ayuda del médico en `src/lib/ayuda/conocimiento.ts:282` promete «explícito, revocable y con bitácora», que es la regla copiada como si fuera el producto), `PG-011` y `PO-014` (parciales P2: ausencia declarada por escrito en `src/app/mi/[token]/page.tsx:1086`), `PI-013` (parcial P3).
- **Dos cuidadores se pisan.** El formulario previo del segundo borra el del primero (`merge: false`, `src/app/api/portal/route.ts:698`): `PP-008` P2. El equipo rojo lo hizo más grande: el formulario nunca se prefilla, así que la misma persona se borra a sí misma al corregir un campo.
- **El enlace de agenda deja escribir por el paciente.** Con el enlace que reparte el mostrador, un tercero llena «qué medicamentos tomo y a qué soy alérgico» sin comprobación de alcance (`PI-009` P2, `src/app/api/portal/route.ts:686`).
- **Nadie sabe quién abrió.** El aviso promete «registro de accesos a su expediente» y las lecturas del portal no se asientan (`PI-010` P2, `src/app/api/portal/route.ts:1001`).
- **La reserva no pregunta para quién es** ni la fecha de nacimiento (`PP-007` P2, `src/app/reservar/[clinicId]/page.tsx:303`); el consentimiento de grabación guarda fecha y médico, no quién consintió por el menor (`PP-009`, parcial P3).
- **Lo honesto:** Perfil dice «todavía no podemos darle acceso desde aquí». Los seis lo valoraron.

Citas:

> «La ayuda del doctor dice que el familiar autorizado es “explícito, revocable y con bitácora”. Nada de eso me pasó a mí.» — Cirugía (`PC-010`)

> «Llené lo que sé del niño; luego ella llenó lo suyo y lo mío desapareció.» — Pediatría (`PP-008`)

> «Puse mi teléfono y el nombre de mi hijo. Nadie me preguntó quién soy yo.» — Ortopedia (`PO-014`, parcial; `PP-007`)

### Arquetipo 4 · Baja visión, lector de pantalla (promedio 3.66, el más alto)

- **El portal es la pantalla mejor construida del producto para lector de pantalla.** Cinco de cinco lo dijeron: `<main>`, h1/h2/h3/h4, nav «Secciones» con `aria-current`, aside «Qué hacer en una urgencia», campo de pregunta con `<label>` real, botón con `aria-busy`, errores en `role=alert`, foco visible, cero SIN-LABEL / NO-BUTTON en `/mi`, `/reservar`, `/dr` y `/privacidad`.
- **Lo que sí falla:** la urgencia se lee con asteriscos de WhatsApp («asterisco Esto puede ser una urgencia médica asterisco») y el 911 de la respuesta no es tocable (`PC-005` P2, `src/lib/paciente/urgencia.ts:197`); «Enviar solicitud, no disponible» sin decir qué falta y `alert()` del sistema (`PI-023` P3, `PG-016` P2, `src/app/privacidad/[clinicId]/page.tsx:65-234`); título del trámite casi blanco sobre blanco en tema oscuro (`PO-012` parcial P2; el equipo rojo lo midió: `#F2EFE9` sobre `#fff`); barra de secciones al final sin «ir a…» e historial sin encabezados (`PP-017` P3); pestaña Documentos muda cuando está vacía (`PP-011` P2); la reserva vacía no le dice nada a nadie.
- **Refutados:** `PG-009` («Llamar al 911» de 30 px): en cualquier puntero grueso mide ≥44 px por `src/app/globals.css:1691-1704` y `:3282-3284`; la mitad táctil de `PO-012` («Volver» 55×20) cae por la misma regla — el arnés emuló el viewport sin `hasTouch`.

Citas:

> «Hay <main>, h1 “Hola”, h2 por sección, un nav “Secciones” con aria-current, un aside “Qué hacer en una urgencia”. Tab: 911 → Hoy → Preguntar → Cuidado → Documentos → Perfil → Tema. Sin campos sin etiqueta. El foco se ve.» — Interna

> «Primero “Esto puede ser una urgencia” con icono y palabra, bien. Luego el lector me lee “asterisco Esto puede ser una urgencia médica asterisco”.» — Cirugía (`PC-005`)

> «La barra ‘Secciones’ está al final. Para llegar a Cuidado paso por todo. No hay ‘ir a…’.» — Pediatría (`PP-017`)

### Arquetipo 5 · Síntoma urgente a las 2 a.m. (promedio 3.50)

- **Ninguna respuesta la originó el modelo general.** En el portal no hay modelo: `src/lib/paciente/pregunta-del-paciente.ts:10-24` clasifica, cita el plan liberado (nivel 2) o escala. Los cinco lo probaron (19 frases en cirugía, 21 en ortopedia con vitest, las doce de `evals/patient-ai/` en clase esperada). Sin P0.
- **La urgencia cardiaca dispara primero.** «Me duele el pecho y me falta el aire» → `URGENT_REVIEW_REQUIRED` en rojo, antes de cualquier explicación, y aparece en Pendientes como «Prioridad crítica sin nadie asignado» (Interna, Cirugía; reproducido por el equipo rojo en `PC-003`).
- **El vocabulario de urgencia no conoce la especialidad.** Sangrado en el embarazo y «ya no se mueve» (`PG-001`), pie morado y frío con férula (`PO-003`), lactante de 39.5 letárgico (`PP-001`), herida que sangra o supura (`PC-003`), glucosa en 40 (`PI-011`): todos **parciales P2** por la misma razón — `src/lib/paciente/urgencia.ts:44-51` declara por escrito lo que no vigila, como manda `clinical-safety.md §5`, y ampliarlo es política clínica del dueño (`NEEDS_CLINICAL_REVIEW`). Lo que sí se puede arreglar sin decisión: «se tomó doble dosis» no dispara porque falta la palabra «dosis» en una categoría ya autorizada (`PP-002` P2, `urgencia.ts:163`), y «no despierta / no reacciona» son sinónimos de «no responde», que ya está cubierto.
- **El plan citado contesta lo que no le preguntaron.** «¿Puedo saltarme la metformina? como poco por las tardes» y «cuando tomo la furosemida me da mucha sed, ¿es normal?» reciben la pauta del plan, sin avisar al médico: `PI-001` y `PI-002` (P1, `pregunta-del-paciente.ts:276` y `:357`). No es originación (cita nivel 2), es una pregunta de omisión o de efecto adverso tratada como pregunta de horario.
- **El cupo puede callar la urgencia.** Tras cinco recargas, «me duele el pecho» devuelve «Demasiadas consultas a tus documentos» y no llega a `clasificarPregunta` ni al worklist (`PI-004` P1, `src/app/api/portal/route.ts:331`).
- **Por WhatsApp, «¿cuántos mL le doy?» recibe el costo de la consulta** (`PP-003` P2, `src/app/api/whatsapp/webhook/route.ts:384`; la urgencia sigue primero, no reaparece REG-326).
- **«Ya quedó registrada» sin teléfono** cuando el consultorio no lo cargó (`PO-020`, `PP-021`, `PC-004`, P3): el portal lo declara en vez de callarlo, y el 911 está arriba en todos los destinos. `PP-004` («no se avisa a nadie») **refutado**: la tarea crítica se abre haya teléfono o no (REG-521, `route.ts:905-919`).

Citas:

> «La respuesta salió PRIMERO en rojo: “Esto puede ser una urgencia… Llame al 911”, sin explicación educativa encima. En Pendientes de la doctora apareció como “Prioridad crítica sin nadie asignado”. Pero dice “este canal es para citas”, y con el cupo agotado la misma frase me devolvió “Demasiadas consultas a tus documentos”.» — Interna (`PI-014`, `PI-004`)

> «A secas me dijo que eso lo contesta mi médico. Pero cuando añadí “como poco por las tardes” me contestó cómo tomarla y ya no avisó a nadie.» — Interna (`PI-001`)

> «Me contestó “Esta pregunta la tiene que contestar tu médico… Ya quedó registrada y el consultorio la va a ver.” Son las dos de la mañana. Arriba había un recuadro de urgencias que hablaba de pecho y de respirar, no de mí.» — Gineco (`PG-001`, parcial)

### Arquetipo 6 · Reenvía su enlace por WhatsApp (promedio 3.21)

- **El enlace está bien atado y eso se verificó del otro lado:** token HMAC con `{clinicId, patientId}`, alcance `agenda|clinico`, 7 días (`src/lib/patient-token.ts:27`, bajados de 30 por este escenario), token alterado → 401, enlace de agenda → 403 en documentos/paquetes/preguntar, token de otro paciente → sólo lo suyo, revocación por contador desde el expediente que además tumba pago y sala de video, mensaje de entrega sin nada clínico, `/mi` con noindex y no-referrer.
- **Pero el enlace de agenda —el que emite cualquier asistente— filtra el motivo clínico** en la respuesta de `session` y lo mete en el `details` del enlace a Google Calendar: `PO-010` **subido de P2 a P1** por el equipo rojo (PHI en parámetro de URL hacia un tercero, `src/app/api/portal/route.ts:118`, `src/app/mi/[token]/page.tsx:177`; también `PC-008` P2).
- **El clínico reenviado es una llave completa** durante 7 días —citas con motivo, recetas con diagnóstico, alergias, preguntas de madrugada— y no hay «compartir sólo la receta»: `PP-005`, `PO-009`, `PC-018` (parciales: la función no existe y cuál construir es decisión del dueño). Lo que sostienen sin decisión: un «Cerrar este enlace» en Perfil (`PI-022` P3, `PG-012` parcial P3 — «no deja bitácora» fue refutado: `updatePatient` sí asienta con actor; falta el motivo).
- **Y ese papel dice diagnósticos descartados** (`PO-001` P1) y la reseña «anónima» publica «Nombre A.» hasta en el JSON-LD (`PO-011` P2, `src/app/resena/[token]/page.tsx:77`, `src/lib/reviews.ts:155`).
- Nadie registra que un tercero entró (`PI-010` P2); el token queda en la caché del navegador del tercero (`PC-017` P3).

Citas:

> «El jefe abrió el enlace y vio: mi nombre, mis citas con motivo, ‘Alergias: Penicilina (anafilaxia), sulfas, AINEs’, y en la receta un ‘diagnóstico’ con seis cosas, incluidas una ‘sospecha’ y una ‘descartada’.» — Ortopedia (`PO-001`, `PO-009`)

> «El enlace de la cita no abre recetas ni preguntas (403 comprobado); el clínico sólo lo emite quien firma. Un token alterado: 401.» — Cirugía

> «No. O mando el enlace entero o una captura de pantalla.» — Pediatría (`PP-005`, parcial)

---

## 4. Lo que salió bien, medido

**Pasos calificados 5/5/5/5 (6 de 280):**

| Esp. · arq. | Paso | Cita |
|---|---|---|
| Cirugía 1 | Confirmar por WhatsApp | «“Responde SÍ para confirmar o NO para cancelar” — eso sí lo sé hacer.» (`src/app/api/cron/reminders/route.ts:212`) |
| Cirugía 4 | Orden de foco en Hoy | «Llamar al 911 → Confirmar → Reagendar → Cancelar → Agendar → Cuéntale a tu médico → barra de destinos. En orden, con foco visible, todo ≥44 px.» |
| Cirugía 4 | Encabezados | «H1 Hola, Rosalía; H2 por destino; H3 por consulta; H4 por bloque. Se navega.» |
| Cirugía 5 | Las doce de `evals/patient-ai` | «Doce de doce en la clase esperada; cuatro del plan citadas con fecha y versión.» (leídas en `casos.json`; vitest no ejecutado por ese auditor) |
| Pediatría 4 | Controles sin nombre | «Ninguno en el portal, en /reservar, en /dr ni en /privacidad.» |
| Pediatría 5 | ¿Alguna respuesta la originó el modelo general? | «Ninguna: en el portal no hay modelo (`pregunta-del-paciente.ts:9-19`); cada respuesta fue cita del plan, escalación o urgencia.» |

Además, con 4 o más en las cuatro preguntas en todas las especialidades: confirmar por WhatsApp (3.99), consulta (3.99 — sobre código), reseña (4.00), y el paso «Preguntar» del arquetipo 4 (etiqueta real, `aria-busy`, `role=alert`).

**Lo que el equipo rojo verificó en positivo** (buscó la línea que lo impide y la encontró):

- **La IA del paciente no origina datos.** `src/lib/paciente/pregunta-del-paciente.ts:10-24` no tiene modelo; `CLASES_QUE_ESTE_MOTOR_NO_EMITE` está declarado. Cinco auditores lo probaron con 19–21 frases cada uno y el equipo rojo reprodujo con `jiti` las salidas literales (`PI-001`, `PC-003`, `PO-003`, `PP-001`, `PP-002`).
- **La urgencia cardiaca dispara y llega.** «Tengo dolor en el pecho» → `URGENT_REVIEW_REQUIRED / dolor_toracico`; «no siento la pierna» → `sintomas_neurologicos_agudos`; «se tomó dos pastillas de más» → `ingesta_accidental_o_sobredosis`. La tarea crítica se abre en `tareas_clinicas` **antes** del WhatsApp y sin depender del teléfono (`src/app/api/portal/route.ts:905-919`, REG-521 cerrado y probado al revés) — por eso `PP-004` se refutó.
- **La vía de urgencia está en todos los destinos.** `ViaDeUrgencia.tsx:70-77`: «Nadie está leyendo esta pantalla ahora mismo», `<a href="tel:911">` pulsable, y ≥44 px en móvil (refutación de `PG-009`).
- **El enlace se revoca y se aísla.** Token manipulado → 401; alcance `agenda` → 403 en lo clínico (guardas en `route.ts:754, 799, 968, 1015`); token de `pac-002` → sólo lo de `pac-002`; «Invalidar enlaces del portal» funciona y deja asiento `paciente_modificado` con actor puesto por el servidor (`src/lib/firestore.ts:655-667`, `audit-log.ts:162`); el alcance clínico sólo lo emite quien puede firmar (`link/route.ts:38-43`).
- **El WhatsApp de entrega no lleva nada clínico** (`src/lib/paciente/entrega-del-paquete.ts:60-78`) y `/mi` no filtra el token por referer (`rutas-privadas.ts:100-125`, `next.config.ts:325`).
- **El service worker hace lo que declara**: no cachea `/api/` ni HTML clínico (`public/sw.js:66-73`), y el portal dice «Sin conexión» en vez de pintar un plan viejo (por eso `PC-016` se refutó como defecto).
- **El consentimiento de la reserva queda fechado y reproducible**: el servidor guarda `versionAviso` y `sha256` del aviso aceptado (`src/app/api/public/booking/route.ts:249-257`), aunque la paciente no lo pueda abrir (`PG-006` bajó a P2 por esto).
- **La reseña vencida tiene su propia rama** («Este enlace ha expirado», `src/app/resena/[token]/page.tsx:20-22`): `PP-019` se refutó porque el auditor probó con un token inexistente.
- **La pregunta escalada se ve completa en la tarjeta de Pendientes** (`pendientes/page.tsx:178` pinta `detalle: p.texto`): la mitad grave de `PO-005` cayó por la propia captura del auditor.
- **La fecha probable de parto se calcula con motor determinista** (Naegele, `paquete-de-visita.ts:338`); lo que falta es enseñarla (`PG-014` P3).

---

## 5. Lo que no se pudo recorrer en vivo, y por qué

| Qué | Por qué | Cómo se auditó |
|---|---|---|
| **Interior del portal `/mi/<token>` en Gineco** | La interfaz sólo entrega el enlace abriendo WhatsApp o al portapapeles; acuñar un token sintético quedó fuera de permisos de ese auditor | Sobre código (`recorrido: no` en los 10 pasos de portal) |
| Portal en Interna, Cirugía, Ortopedia, Pediatría | Mismo motivo; `next dev` no define `PORTAL_PACIENTE_SECRET` | Token firmado con el secreto de desarrollo (o vía `/api/portal/link` con sesión de médica, en Interna); el token nunca se copió a los JSON |
| **Reserva pública, pasos 2–5** (fecha, hora, datos, consentimientos) | La siembra sintética no tiene `duraciones` ni `horario` (`sembrar-emulador.mjs:425-435`): `tiposCita=[]` | `reservar/[clinicId]/page.tsx:284-337` y `api/public/booking/route.ts` leídos |
| **Confirmar por WhatsApp, entrega del paquete, recordatorios, bot** | WhatsApp real prohibido; el emulador no tiene proveedor | `whatsapp.ts`, `cron/reminders/route.ts:212-300`, `AppointmentModal.tsx:420`, `webhook/route.ts:384` |
| **Pagar** | Sin anticipo configurado en la siembra (`anticipo: null`): el botón «Pagar anticipo» no aparece; Stripe real prohibido | `create-checkout/route.ts:38-72` |
| **Reseña con token válido** | El token lo crea el cron después de la cita | Sólo `/resena/<inválido>` en vivo; `resena/[token]/page.tsx:74-118` leído |
| **Consulta, grabación, firma y liberación real del paquete** | No se puede dictar en el arnés; no se creó nota firmada (sólo lectura) | `consulta/[patientId]/page.tsx:1810, 7449-7469` y `paquete-de-visita.ts` leídos |
| **Llegar y esperar** | No existe pantalla de espera para el paciente | Calificado 3/3/3/3 por convención; fuera del mapa de calor |
| **Peso de página** | Servidor de desarrollo (2.4–6 MB de JS): no representativo del build de producción | Declarado no-anclable por los cinco |
| **Offline real** | No se cortó la red | Deducido de `public/sw.js:3-6, 61-88` y `manifest.ts` |
| **Contraste y lector de pantalla reales** | No se midió contraste con instrumento ni se usó NVDA/VoiceOver | Atributos ARIA, orden del DOM y Tab con teclado; el equipo rojo sí midió el contraste de `/privacidad` (`PO-012`) |
| **Teleconsulta y `/verificar/[token]`** | Fuera del recorrido | No cubiertos (declarado en Cirugía) |
| **`npx vitest` sobre `evals/patient-ai`** | Cirugía e Interna leyeron `casos.json`; Ortopedia ejecutó `clasificarPregunta` con vitest sobre 21 preguntas propias | El equipo rojo reprodujo con `jiti` las frases citadas |

Lo que esto significa para leer el §2: tres pasos del bucle —confirmar, consulta, pagar— tienen promedio alto (3.99, 3.99, 3.05) y **cero recorridos en vivo**. Esa calificación es del texto del código, no de una pantalla.

---

## Resumen

- 30 recorridos, 280 pasos calificados; promedio global 3.36/5; 129 pasos en vivo, 138 sobre código.
- Sin P0: la IA del paciente nunca originó un dato; la urgencia cardiaca sale primero y abre tarea crítica; el enlace se aísla, caduca y se revoca.
- P1 confirmados: diagnósticos descartados en receta y resumen (`PC-001`, `PO-001`); motivo clínico en el enlace de agenda y en la URL de Google (`PO-010`); cupo que calla la urgencia (`PI-004`); pregunta de omisión o efecto adverso contestada como horario (`PI-001`, `PI-002`); aviso de privacidad que contradice D-034 (`PG-005`).
- Pasos peores del bucle: agendar (2.81), consentimiento de grabación (2.84), ARCO (2.93).
- Arquetipo peor: cuidador (3.20) — no existe en el modelo, y la Ayuda del médico dice lo contrario. Mejor: lector de pantalla (3.66).
- Patrones en las cinco especialidades: reserva vacía, letra de 10.5–12 px, receta en .doc, urgencias de especialidad fuera del vocabulario (parciales: decisión clínica del dueño).
- 4 refutados (`PC-016`, `PG-009`, `PP-004`, `PP-019`): no repararlos.
- Confirmar, consulta y pagar no se recorrieron en vivo por nadie; el portal de Gineco se auditó sólo sobre código.
