# Bitácora de reparación — AGENDA Y MENSAJERÍA

Agenda, recordatorios, bot de WhatsApp y lista de espera. Reconstruida por el
orquestador desde los dos commits de la rebanada.

| ID | Área | Incidente | Estado |
|----|------|-----------|--------|
| ASM-002 | Datos-PHI (P1) | **Un teléfono con país explícito se convertía en mexicano.** Cualquier número que no encajara recibía un 52 delante, así que un paciente extranjero quedaba con un número que no es de nadie — o peor, de otra persona | CLOSED — `normalizarTelefonoWa` sólo normaliza lo que entiende: «+» respeta el país, diez dígitos son México, 52 y 521 convergen; el resto devuelve vacío CON su motivo. `claveTelefonoWa` acepta el `wa_id` del proveedor sin fabricar un 52 |
| ASM-004 | Datos-PHI (P1) | **El teléfono corregido no llegaba a las citas.** `pacienteTelefono` es un dato desnormalizado en la cita y nadie era dueño de mantenerlo: el editor escribía sólo el expediente, la pantalla decía «Paciente actualizado», y el recordatorio de mañana salía al número viejo porque el cron lee el de la CITA | CLOSED — `updatePatient` lo propaga a las citas futuras y a la lista de espera, y el cron además cae al expediente: dos redes |
| ASM-006 | Datos (P1) | La sesión `confirmando_cita` caducaba antes que la cita, así que un «sí» tardío no confirmaba nada y el paciente creía que sí | CLOSED — la sesión vive hasta la hora de la cita y el mensaje lo dice |
| ASM-012 · ASM-013 · ASM-014 | Mensajería (P2) | Botones e interactivos no se leían como texto, un audio o una foto se quedaban sin respuesta, y el webhook contestaba antes de terminar | CLOSED — SÍ/NO/CAMBIAR en un módulo puro; los interactivos son texto; audio y foto se contestan; el webhook espera |
| PP-003 · RT-006 · PO-005 | Clínico (P1) | Una pregunta clínica por WhatsApp se quedaba en el chat sin dueño | CLOSED — se escala como tarea con dueño |
| RT-008 | Seguridad clínica (P1) | Con dos expedientes bajo el WhatsApp de la casa —la madre y la hija— se tomaba el primero que devolviera el índice | CLOSED — con uno se usa pero queda MARCADO «elegido por teléfono, sin nombre» y sin enlace de portal; con dos o más la cita nace sin expediente y la cuelga una persona |
| ASM-005 · ASM-007 · ASM-008 · ASM-017 · ASM-019 · N-006 · PG-018 | Agenda y mensajería (P2-P3) | Se enviaba antes de reservar, lo que no salía no quedaba escrito, la reseña no salía por la puerta proactiva, una prueba vencida seguía mandando, no había modo discreto, y salía «Consultorio: undefined» | CLOSED |

## Nota del orquestador

`cron/reminders` salió del censo de llamadores de WhatsApp que no declaran quién
inicia — el trinquete bajó de 4 a 3. Al integrar se descubrió que ese censo tenía
un punto ciego: sólo miraba el `import` estático, así que `public/booking` y
`avisar-consultorio`, que cargan el módulo con `await import(...)`, eran dos
llamadores REALES que no contaba. Corregido el detector; los dos siguen
pendientes, que es la verdad.
