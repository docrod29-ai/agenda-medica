# Comprobar que el dato LLEGA, no que el código lo diga

**Por qué existe este documento:** el 5 de agosto de 2026, tres defectos del mismo
tipo aparecieron el mismo día. Los tres tenían pruebas en verde.

| | Lo que las pruebas comprobaban | Lo que pasaba de verdad |
|---|---|---|
| REG-167 | Que la petición llevara el sesgo | El proveedor lo rechazaba y **degradaba el motor** al modelo viejo |
| REG-170 | Que la nota escribiera `transcripcionMotor` | **Ninguna nota firmada lo tenía** |
| REG-160 | Que el importador validara la colección | Validaba un campo y **escribía en otro** |

Ninguno era un error de lógica. Los tres eran **el dato que no llegaba a su
destino**, y ninguna prueba de contrato puede verlo: comprueban lo que el código
dice, y el código decía la verdad.

---

## La regla

> Una prueba de contrato comprueba que el código diga lo acordado.
> **No comprueba que el destinatario lo acepte, ni que el dato quede escrito.**

Cuando algo cruza una frontera —una API de terceros, una escritura a la base, un
formato que otro sistema lee— hace falta **mirar del otro lado**.

---

## Las tres preguntas, antes de dar algo por entregado

1. **¿Dónde acaba este dato?** Nómbralo: un documento de Firestore, un parámetro
   del proveedor, un archivo. Si la respuesta es «en la función que lo escribe»,
   todavía no ha llegado.
2. **¿Quién lo lee después, y encuentra lo que espera?** El bucle de corrección
   leía `transcripcionMotor` de notas firmadas que nunca lo tuvieron.
3. **¿Lo he mirado del otro lado, hoy?** No la documentación: la respuesta real
   del proveedor, o el documento real en la base.

---

## Cómo comprobarlo en el sistema real

Los datos de producción llevan PHI, así que **esto no puede correr en CI**. Se
hace a mano, sobre el consultorio real, y **sólo se sacan recuentos** — nunca
contenido.

Con la sesión del dueño abierta en el navegador, contra la API REST de Firestore:

```js
// Patrón: contar, nunca extraer.
// Por cada nota, comprobar el invariante y sumar. El texto no sale de aquí.
let cumplen = 0, incumplen = 0
for (const nota of notas) {
  const esDeVoz = nota.metadata?.fuenteGeneracion === 'ia_voz'
  const tieneOrigen = !!(nota.transcripcionMotor ?? '').trim()
  if (!esDeVoz) continue
  tieneOrigen ? cumplen++ : incumplen++
}
({ cumplen, incumplen })   // ← lo único que sale
```

### Resultado de la primera pasada — 5-ago-2026

Ejecutada sobre el consultorio real del Dr. **Sólo recuentos; ningún contenido
salió del navegador.**

| Invariante | Resultado |
|---|---|
| Nota firmada ⇒ tiene sello de integridad | **10 / 10** ✓ |
| Nota firmada ⇒ tiene bloque de firma | **10 / 10** ✓ |
| Nota firmada ⇒ tiene médico y cédula | **10 / 10** ✓ |
| Nota ⇒ tiene `estado` en la raíz | **22 / 22** ✓ |
| Cobro de anticipo ⇒ sin duplicados | **0 cobros** — el defecto REG-153 nunca llegó a materializarse |
| Cita ⇒ sin doble reserva | **0** ✓ |
| Nota de voz firmada ⇒ tiene `transcripcionMotor` | **0 / 10** ✗ → REG-170 |
| Cita ⇒ tiene médico asignado | 1 sin médico (caso aislado, no patrón) |

El expediente está íntegro. El único incumplimiento sistemático era el que
destapó REG-170 — y es justo el que ninguna prueba podía ver.

**Un aviso sobre la propia herramienta:** la primera medición de citas dio «0
dobles reservas» porque buscaba los campos `fecha` y `hora`, y el documento usa
`fechaHora`. El número era correcto por accidente y la medición estaba mal. Antes
de publicar un recuento hay que confirmar que los campos existen — leer un campo
inexistente devuelve vacío, no un error.

### La herramienta

`scripts/auditoria-de-datos.js` — un solo bloque para pegar en la consola del
navegador con la sesión iniciada. Corre todos los invariantes de abajo y devuelve
una tabla de recuentos.

Validada el 5-ago-2026 contra el consultorio real: reproduce exactamente los
mismos números que se obtuvieron a mano.

| Invariante | Cumplen | Incumplen |
|---|---:|---:|
| Nota firmada ⇒ sello de integridad | 10 | 0 |
| Nota firmada ⇒ bloque de firma | 10 | 0 |
| Nota firmada ⇒ cédula profesional | 10 | 0 |
| Nota de voz firmada ⇒ `transcripcionMotor` | 0 | **10** → REG-170 |
| Medicamento ⇒ tiene dosis | 24 | **4** → REG-173 |
| Medicamento ⇒ vía del enum | 23 | **5** → REG-172 |
| Cita activa ⇒ sin doble reserva | 0 | 0 |

Las tres filas con incumplimientos son las que se repararon hoy. Al volver a
pasarla tras unas consultas nuevas, las dos primeras deberían empezar a cumplir;
la de la dosis depende de lo que el médico decida escribir.

### Invariantes que hoy conviene comprobar

| Invariante | Por qué | Estado |
|---|---|---|
| Nota de voz firmada ⇒ tiene `transcripcionMotor` | Sin él, el bucle de corrección no aprende (REG-170) | Reparado en v1053; **se comprueba desde la próxima consulta** |
| Nota ⇒ tiene `estado` en la raíz | Las reglas de Firestore lo exigen para crear | Verificado: 22/22 |
| Cobro de anticipo ⇒ id `stripe_{session}` | Evita el cobro duplicado (REG-153) | Reparado en v1038 |
| Transcript ⇒ tiene dueño registrado | Sin él, otro consultorio podía leerlo (REG-164) | Reparado en v1047 |
| Pregunta con `escalada == true` ⇒ existe `tareas_clinicas/pregunta__{id}` | Sin ella, la escalación sólo vive en un WhatsApp que quizá no salió (REG-521) | Reparado el 5-sep-2026; **se comprueba desde la próxima pregunta escalada** |

---

## Y contra un proveedor externo

Mandar la petición **tal y como la manda producción** y leer su respuesta. Fue lo
que destapó REG-167: la documentación decía «keyterms prompting», el código
mandaba `word_boost`, y sólo la API real dijo que eran incompatibles — y que al
mandarlos juntos **descartaba el modelo bueno en silencio**.

Tres límites distintos aparecieron así, uno por rechazo: términos → palabras →
**tokens**. Ninguno estaba en la documentación que teníamos.
