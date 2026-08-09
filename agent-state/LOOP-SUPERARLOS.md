# LOOP «SUPERARLOS» — programa finito y reanudable

**Abierto**: 7-ago-2026 · **Objetivo**: cerrar las cuatro distancias reales
frente a Abridge, Nabla y Suki, medidas en
[`QUARTERLY_MATRIX.md`](../docs/competitive/QUARTERLY_MATRIX.md).

**Regla del loop**: una iteración por ejecución, cerrada de punta a punta
(código → pruebas → sello → despliegue → verificación → bitácora). Nada se marca
hecho sin su número. Si se acaban los créditos o el internet, **el progreso vive
en este archivo**: se relanza, no se empieza de cero.

---

## Por qué estas cuatro y no veinte

Se descartaron a propósito las carreras que no se ganan escribiendo código:
integración con Epic, sellos de mercado, número de hospitales. Ésas dependen de
contratos y de tiempo, no de esta noche.

Lo que queda es lo que **sí** se puede construir, ordenado por lo que un médico
nota primero.

---

## Iteraciones

### SUP-001 · Trazabilidad: de dónde salió cada frase de la nota
**Cierra la distancia con**: Abridge (Linked Evidence)
**Charter**: §B10 · **Estado**: ✅ **HECHO — v1095, REG-213**

Cada afirmación de la nota debe poder señalar **el fragmento del dictado que la
sostiene**. El médico resalta una línea y ve de dónde salió.

*Por qué primero*: es la distancia más grande, es el §B10 del charter propio, y
responde el único reclamo que un médico no puede resolver solo — «¿de dónde sacó
esto la IA?». Sin esto, revisar obliga a reescuchar la consulta entera.

*Alcance de esta iteración*: enlazar **texto de la nota ↔ segmento del
transcript**. El audio con marca de tiempo va en SUP-002, porque exige tocar la
captura y eso se decide aparte.

*Hecho cuando*: existe el motor, tiene corpus oro, está **conectado** a la
pantalla de revisión, y una afirmación sin respaldo se marca como tal.

---

### SUP-002 · El audio se puede volver a oír en el punto exacto
**Cierra la distancia con**: Abridge · **Estado**: ⬜ pendiente · depende de SUP-001

Marca de tiempo por segmento y reproducción desde ahí. Es lo que convierte la
trazabilidad en verificación de verdad.

---

### SUP-003 · La voz manda, no sólo dicta
**Cierra la distancia con**: Suki · **Charter**: §B9 · **Estado**: ⬜ pendiente

«Agrega hipertensión a la lista de problemas», «¿cuál fue su última A1c?»,
«receta metformina 850 cada 12 horas». Ya existe `intencion-de-orden` y hay
comandos en UCI: **falta la capa de mando en la consulta**.

*Restricción que no se negocia*: nada se activa sin confirmación. «Podríamos
pedir una TAC» no es una orden — eso ya está probado y no se relaja para parecerse
a nadie.

---

### SUP-004 · Salida a campos estructurados, no sólo a texto
**Cierra la distancia con**: Nabla · **Charter**: §K · **Estado**: ⬜ pendiente

Que la nota salga como recursos FHIR (Condition, MedicationRequest,
Observation, AllergyIntolerance) además de como prosa. Es lo que permite que un
tercero la lea sin volver a interpretarla.

*Honestidad obligatoria*: no se afirma «compatible con FHIR» sin versión,
recursos soportados y pruebas de conformidad (§K).

---

### SUP-005 · Codificación asistida
**Cierra la distancia con**: Suki · **Estado**: ⬜ pendiente

Ya existe CIE-10 con autocompletado. Falta **proponer el código desde la nota** y
que el médico lo confirme. NUNCA seleccionarlo solo: eso es facturación.

---

## Lo que este loop NO va a intentar

| No se hace | Por qué |
|---|---|
| Integración nativa con Epic / Oracle | Contratos y certificaciones, no código |
| Presumir exactitud superior a la suya | No hay corpus común; afirmarlo sería tracción falsa |
| Copiar su interfaz | El producto es distinto: ellos son escribas, esto es el expediente |
| Anunciar lo que aún no corre | §A8: disponible / beta / hoja de ruta, sin mezclar |

---

## Bloqueado en el dueño

Nada de este loop está bloqueado en él. Lo que sí lo está, y es de otra liga:
**la titularidad del código a nombre de una sociedad** — el bloqueo nº 1 de la
sala de datos, y el único que ninguna función arregla.

---

## Bitácora del loop

| Iteración | Versión | Fecha | Resultado |
|---|---|---|---|
| SUP-001 | v1095 | 7-ago-2026 | Motor de trazabilidad nota ↔ dictado, corpus de 13 casos, conectado a la barra. El hallazgo caro fue el falso positivo: «cefalea», «colecistectomía» y «madre» se marcaban como inventadas siendo traducciones correctas del habla del paciente. Sin la tabla de sinónimos, el aviso se habría aprendido a cerrar en dos consultas. |
