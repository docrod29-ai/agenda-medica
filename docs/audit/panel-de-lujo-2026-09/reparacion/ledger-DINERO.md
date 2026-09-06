# Bitácora de reparación — DINERO

Cobros, cortes, suscripciones, anticipos y promesas públicas de precio.
Reconstruida por el orquestador desde los tres commits de la rebanada: su agente
cerró el trabajo y no llegó a escribir la bitácora.

| ID | Área | Incidente | Estado |
|----|------|-----------|--------|
| ASC-001 | Dinero (P0) | **Ningún cobro ligado a una cita se podía anular.** La transacción escribía el cobro y LEÍA la cita después; Firestore rechaza siempre esa transacción, y el aviso enseñaba el mensaje crudo del SDK. No era un caso raro: era todos | CLOSED — todas las lecturas van antes de las escrituras, y los errores del SDK se traducen a lenguaje de persona |
| N-001 | Dinero (P0) | **Cambiar de plan cancelaba la suscripción anterior sin abonar nada.** El médico perdía los meses ya pagados y no quedaba constancia | CLOSED — con suscripción viva se actualiza en sitio con prorrateo; el empalme residual se cancela prorrateado y deja constancia en `clinics/{id}.cambioDePlan` |
| N-002 | Dinero (P0) | **El anticipo del paciente caía en la cuenta de Stripe de la plataforma** y se asentaba como ingreso del consultorio: el corte reportaba dinero que el médico nunca recibió | CLOSED — sin cuenta conectada la ruta responde 409 con la vía que SÍ existe (liga propia del médico, o pagar en el consultorio); con cuenta, el Checkout se abre con destino a esa cuenta |
| ASC-004 | Dinero (P1) | Quitar una cortesía no exigía motivo ni autor y borraba el sello original | CLOSED — motivo y autor obligatorios, sello original conservado en `historialCortesia`, retiro sellado y asiento en bitácora |
| ASC-005 | Dinero (P1) | Un reembolso de Stripe no llegaba al libro del consultorio | CLOSED — `charge.refunded` asienta un REFUND con traza y libera la cita si la devolución es total |
| ASC-009 | Dinero (P2) | El segundo intento desde otro dispositivo decía «Cobro registrado: $X» con el importe TECLEADO aunque no registrara nada, y reescribía `cobradoEn` con la hora del intento fallido | CLOSED — `registrarCobroDetallado` devuelve `yaExistia` y el cobro existente; el modal dice «ya estaba cobrada» |
| RT-005 | Dinero (P2) | Un abono o cobro suelto igual de hoy desde otra pestaña se duplicaba sin preguntar | CLOSED — huella de la intención; se lanza `CobroPosiblementeDuplicado` y el modal pregunta «¿es otro distinto?». Con la confirmación se registran dos, que a veces es lo correcto |
| ASC-003 | Dinero (P1, lado cliente) | El modal escribía `cobroId` en la cita con un update suelto, DESPUÉS del cobro | CLOSED — cobro, marca y estado se escriben en la misma transacción; el modal ya no toca la cita |
| ASC-012 | Dinero (P1) | La devolución no era una unidad con traza propia | CLOSED — `registrarReembolso` escribe un REFUND con monto positivo y traza al original, sin devolver de más; corte, resumen y comisiones lo restan |
| ASC-010 · ASC-011 · ASC-014 · ASC-015 · ASC-016 · ASC-018 | Dinero (P2-P3) | Desvío de importe sin preguntar, etiquetas ausentes, CSV sin día/hora del consultorio ni anulados marcados, correo del operador expuesto, agrupación por nombre en vez de por id, cuota adelantada sin marcar | CLOSED |
| N-003 · N-004 · N-005 | Dinero-legal (P1, público) | Promesas públicas sin mecanismo detrás: «precio fundador» con escasez y permanencia sin contador ni tarifa sellada, y una respuesta de portada que prometía un correo al acabar la prueba que nadie manda | CLOSED — se retiran. Una promesa pública sin mecanismo no se matiza: se quita |

## Lo que NO se reparó

`ASC-002` (anular un cobro suelto) y el resto de P3 quedan con su motivo en el
informe de la auditoría. La cifra de comisión de Stripe por país es
`NEEDS_CLINICAL_REVIEW` en su versión comercial: la decide el dueño.

## Nota del orquestador

Al integrar, dos guardianes de esta rebanada estaban desfasados y se
actualizaron: `gp9-idempotencia` buscaba el nombre viejo de la llamada, y el
doble de `firebase/firestore` de sus dos pruebas no exportaba `limit`, que la
integración necesitó para acotar dos lecturas nuevas.
