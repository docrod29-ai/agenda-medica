# Acta — el recorrido de reserva del paciente, de punta a punta

**Contra qué.** Emuladores de Firebase (Firestore + Auth, proyecto `demo-*`,
que el SDK se niega a cambiar por uno real), consultorio **sintético**
`consultorio-demo-v10`, app en `next dev`. Cero pacientes reales.

**Configuración sembrada** (`scripts/carril-excelencia/sembrar-reserva.mjs`):
lunes a sábado 09:00–19:00, comida 14:00–15:00, **domingo cerrado**, festivo
recurrente `12-25`, reservas públicas abiertas, primera vez 45 min.

---

## 1 · El camino completo, en Chromium real, a tres anchos

`scripts/carril-excelencia/recorrido-reserva.mjs` — capturas de cada paso en
`capturas/recorrido-{movil,tableta,escritorio}-*.png`.

| Paso | 390 px | 768 px | 1440 px |
|---|---|---|---|
| 1 · abrir el portal | ✓ | ✓ | ✓ |
| 2 · elegir tipo de consulta | ✓ | ✓ | ✓ |
| 3 · elegir día (`Lun 31 de ago`) | ✓ | ✓ | ✓ |
| 4 · elegir hora (`09:00`) | ✓ | ✓ | ✓ |
| 5 · datos (nombre · teléfono · correo · motivo) | ✓ | ✓ | ✓ |
| 6 · continuar al resumen | ✓ | ✓ | ✓ |
| 7 · aceptar los dos consentimientos | ✓ | ✓ | ✓ |
| 8 · confirmar → **«¡Cita solicitada! ✅»** | ✓ | ✓ | ✓ |

Sin errores de consola. Sin desbordamiento horizontal en ningún ancho.

**Y el dato LLEGÓ.** No se da por buena la pantalla de éxito: se leyó Firestore
después. Las tres corridas crearon tres citas —`09:00`, `09:45`, `10:30`—
porque cada una tomó el primer hueco **realmente libre**: la corrida anterior ya
había ocupado el suyo. El chequeo de solape funcionando entre corridas.

---

## 2 · Fallo, reintento, envío duplicado y resultado desconocido

| Caso | Resultado | Lectura |
|---|---|---|
| Dos reservas **simultáneas** sobre el mismo hueco | `200` + `409 Ese horario acaba de ocuparse` | La transacción aguanta la carrera |
| **Mismo paciente**, mismo envío ×3 (antes) | `200` + `409` + `409` | ⛔ **defecto**: se le decía que otro le quitó el hueco |
| **Mismo paciente**, mismo envío ×3 (después) | `200` + `200 yaExistia` + `200 yaExistia`, **el mismo `citaId`** | ✅ idempotente |
| Citas realmente creadas en ese hueco | **1** | ✅ verificado en Firestore |
| **Otra persona** sobre ese mismo hueco | `409` | ✅ el conflicto real sigue siendo conflicto |
| Domingo (cerrado) | `409 Ese día no hay servicio` | ✅ |
| 25 de diciembre (festivo recurrente `MM-DD`) | `409 Ese día no hay servicio` | ✅ |
| 14:30 (hora de comida) | `409 …(descanso)` | ✅ el POST no acepta lo que el GET no ofrece |
| 2030-06-20 (fuera de la ventana pública) | `400` con la fecha límite real | ✅ |
| 2051-01-01 (sobre el techo de la plataforma) | `400 La agenda llega hasta el 2050-12-31.` | ✅ |
| 2027-02-30 (fecha que no existe) | `400 Esa fecha no existe en el calendario.` | ✅ |
| 9 envíos seguidos desde una IP | `429 Demasiadas solicitudes` | ✅ el limitador de abuso vive |

**El caso del resultado desconocido**, que es el que motiva el arreglo: el
servidor crea la cita y la respuesta se pierde. Antes, el reintento contestaba
«ese horario acaba de ocuparse» y empujaba al paciente a elegir otra hora —
acabando con dos citas y con el consultorio recibiendo dos avisos. Ahora el
reintento devuelve **la misma cita**, y los avisos de WhatsApp no se repiten.

---

## 3 · Disponibilidad, contra el consultorio sembrado

| Fecha | Respuesta |
|---|---|
| 2026-09-01 (martes) | `09:00 09:45 10:30 11:15 12:00 12:45 15:00 15:45 16:30 18:00` — el salto de 12:45 a 15:00 **es la hora de comida** |
| 2026-09-06 (domingo) | `No hay atención este día` |
| 2026-12-25 | `Día festivo` |
| 2027-03-15 | 11 huecos |
| 2030-06-20 · 2040-02-29 · 2050-12-31 | `400` — fuera de la ventana pública, **con la fecha límite dicha** |
| 2051-01-01 | `400` — sobre el techo |
| 2027-02-30 | `400` — no existe |
