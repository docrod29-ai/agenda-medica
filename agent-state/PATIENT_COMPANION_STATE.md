# Estado del compañero del paciente — V9

> Se escribe **a mano**, tras cada iteración.
> Línea base completa con evidencia: `docs/patient/PATIENT_COMPANION_BASELINE.md`.

**Unidad**: `POSTVISIT-001` **cerrada** el 10-ago-2026 · REG-306, REG-307.
**Siguiente**: `PATIENT-AI-001` — «Preguntar» sigue escalando al consultorio, y
eso seguirá siendo lo correcto hasta que exista la clasificación de las cinco
respuestas y las doce pruebas de equipo rojo.

---

## Lo que quedó montado en `POSTVISIT-001`

**El camino existe entero por primera vez.** Nota firmada → el médico pulsa
«Entregar al paciente» → `POST /api/paciente/paquete` compone y libera → el
resumen aparece en `/mi/[token] → Cuidado`. Hasta hoy la superficie del paciente
estaba lista para recibir paquetes **y nadie los creaba**.

**La compuerta de firma, en tres sitios y no en uno.** En el motor puro
(`componerPaquete` lanza), en la frontera HTTP (409 con un texto que el médico
entiende) y en la pantalla (vista previa declarada, copiar e imprimir cerrados).
El defecto original era justo el contrario: la compuerta vivía en un comentario.

**El contenido no viene del navegador.** El cuerpo de la petición lleva
`clinicId`, `patientId`, `notaId` y el seguimiento. Nada más. El servidor lee la
nota firmada y compone él — con el contenido en el cuerpo, la compuerta de firma
la decidiría quien llame a la ruta.

**Una entrega no se edita: se entrega otra vez.** `{notaId}__v{n}` con `create`,
nunca `set`. Dentro de un año la pregunta será «¿qué se le dijo exactamente a
este paciente?», y la respuesta no puede ser «lo que compondría hoy el código».

**El silencio no suspende.** `cambiosDeMedicacion` sólo dice «suspendido» cuando
la orden lo dice. Un fármaco que hoy no se mencionó no aparece — el paciente lo
dejaría. Y sin nota firmada anterior no hay línea base: `null`, que no es «no
hubo cambios».

## Lo que NO se hizo, y por qué

- **`warningSigns` sigue vacío.** Los signos de alarma son indicación médica: o
  los escribe el médico, o no existen. Hoy no hay campo donde escribirlos, y
  componerlos de «lo habitual» es la regla 1 de seguridad clínica. El campo está
  y se pinta si algún día llega lleno.
- **No hay aviso por WhatsApp** de que hay algo nuevo en el portal. El paciente
  lo ve cuando entra por el enlace que ya recibe. Mandar un mensaje real está
  fuera de lo autorizado.
- **`documents` sigue vacío** (`DOCUMENTS-001`) y `unansweredQuestions` también
  (`PATIENT-AI-001`).

## Lo que este estado NO afirma

**Nada de esto se ha visto en un navegador.** Ni el botón, ni la pantalla del
paciente, ni un documento real en Firestore. La ruta no corre en la suite: lo
que hay son guardianes sobre el motor puro —probados al revés— y sobre lo que la
ruta hace con él.

---

## Iteración anterior (`PATIENT-COMPANION-001`, 9-ago)

## Lo que quedó montado en `PATIENT-COMPANION-001`

**Los cinco destinos** en `/mi/[token]`: Hoy · Preguntar · Cuidado · Documentos
· Perfil. Barra fija abajo — esa pantalla se usa con una mano, de pie, en la
sala de espera. Cinco es el techo de la especificación, no el objetivo.

**`PaqueteDeVisita`**, trece campos, dos estados. Nace `DRAFT` **aunque la nota
esté firmada**: firmar va hacia el expediente, liberar va hacia el paciente, y
son dos actos.

**La compuerta**: `visibleParaElPaciente` exige estado, aprobador **y** fecha —
un `RELEASED` sin `approvedBy` es un documento al que alguien le puso el estado a
mano. Y la aplica el **servidor**, en `/api/portal`, con alcance `clinico`.
Esconder una pestaña no cierra una ruta HTTP.

**Declarado en cuatro sitios**, no tres: reglas de Firestore con escritura
cerrada, matriz de acceso, manifiesto del respaldo **y exportación ARCO** — el
paquete es dato del titular, borradores incluidos.

## Lo que NO se hizo, y por qué importa

`componerPaquete` se escribió y el guardián de conexión la cazó: motor con
cuerpo real, cero llamadores. Se difirió a `POSTVISIT-001`, que es donde vive la
pantalla que la llamará. Al quitarla, el guardián cazó a su ayudante en la vuelta
siguiente — **un motor sin llamador no deja de serlo porque su vecino se haya
ido**. Se fueron los dos.

«Escrito, probado y sin conectar» es la familia más grande del proyecto (32 de
129). Añadirle una más a sabiendas, con nota o sin ella, era justo lo que no
toca.

## Dos pantallas que dicen la verdad en vez de fingir

- **Preguntar no responde.** Escala al consultorio. Un cuadro de texto que
  conteste «lo que sea» es lo que la regla de IA de cara al paciente prohíbe, y
  se lo diría a alguien que no puede detectar el error. `PATIENT-AI-001`.
- **Perfil** dice que el idioma es es-MX y que todavía no se puede autorizar a un
  cuidador. Un selector con un solo idioma le miente al paciente sobre lo que
  puede esperar.

## Lo que este estado NO afirma

Nada se ha visto en un navegador. **Y hoy ningún paquete existe en producción**:
falta la pantalla del médico para liberarlos. La superficie del paciente está
lista para recibirlos y el estado vacío lo dice.

---

## Línea base anterior (`PATIENT-UX-TRUTH-001`, 8-ago)

---

## Lo que existe hoy

**Nueve pantallas del paciente**, y el portal hace bastante más de lo que el
programa suponía: confirmar, reagendar con huecos en vivo, cancelar, pagar
anticipo, formulario previo de 6 campos, citas pasadas, descarga de recetas en
Word, y derechos ARCO sin cuenta.

**El token está bien hecho**: HMAC, comparación en tiempo constante, 7 días,
ámbito `agenda`/`clinico` que **falla cerrado**, `clinicId` y `patientId` que
salen del token y nunca del cuerpo, y **revocación por contador de versión**.

## Las cinco destinaciones de V9, contra lo que hay

| Destino | Hoy |
|---|---|
| **TODAY** | no existe |
| **ASK NEXUS** | no existe. El bot de WhatsApp es una máquina de estados **determinista**, sin modelo |
| **CARE** | parcial: citas sí; plan, cambios de medicación y signos de alarma no |
| **DOCUMENTS** | parcial y **derivado**: «Mis recetas» se recalcula en cada lectura desde notas firmadas. No hay colección, ni versiones, ni estados |
| **PROFILE** | no existe. Sin idioma, sin cuidador, sin preferencias |

## Reparado en esta iteración

**REG-265 · El enlace de la videoconsulta no llevaba token** → el paciente
recibía **404 «Cita no encontrada»** al pulsar «Entrar a la videoconsulta»
**dentro de su propio portal**, en la hora de su consulta. Nadie de dentro lo
veía porque el botón del médico sí añade `&t=`.

## Lo mejor que hay, y no se entrega

`HojaParaElPaciente` + `como-se-lo-explico.ts`. Es **determinista, no un
modelo**: compone desde campos ya firmados, traduce la vía a español llano y
expande frecuencias sólo cuando 24÷n es exacto — **se niega** a «cada 5 horas».
Eso es el principio de V9 §2 aplicado antes de que V9 existiera.

Y tiene tres problemas: **no hay compuerta de firma** (se compone del borrador en
curso), **el paciente no la recibe nunca** (sólo copiar e imprimir), y
`proximaCita` está fijo en `undefined`, así que su cuarto bloque no puede
renderizarse jamás.

Ése es el núcleo de `POSTVISIT-001`: **el contenido está resuelto; faltan la
compuerta y el camino.**

## Con qué se construye el `PatientVisitPackage`

Todo cuelga de `clinics/{clinicId}/patients/{patientId}`: `notas` (con
`versions` y `adendas`) — de donde se **derivan** receta y órdenes, que hoy no
son colecciones —, `laboratorios`, `clinico`, `formularios_previos`,
`appointments`, y `tareas_clinicas` (que cuelga del consultorio, a propósito).

**Restricción del invariante nº1**: el paquete tiene que **referenciar** la nota
firmada, no copiarla. Nunca duplicar la fuente de verdad de una entidad clínica.

## Idioma

`src/lib/i18n.ts` existe, está escrito y **no lo importa nadie** — está en la
lista de huérfanos aceptados de `modulos-sin-conectar.test.ts`, línea 99.

La superficie del paciente son **~180 cadenas** con diacríticos, contra
2 000-4 000 en toda la aplicación. Ése es el argumento para empezar es-MX→en-US
por el paciente.

## P0 abiertos en esta superficie

- `PATIENT-TELE-002` — el enlace por WhatsApp sigue sin token.

## P1 abiertos

- `PATIENT-PORTAL-001` — `/api/portal` sin límite de tasa; revocación que falla
  **abierta**.
- `POSTVISIT-GATE-001` — sin compuerta de firma.
- `POSTVISIT-ENTREGA-001` — la hoja no llega al paciente.

## Lo que este estado NO afirma

Nada se ejecutó. El 404 de la teleconsulta se confirmó siguiendo tres archivos,
no abriendo la aplicación, y **la reparación necesita comprobación en
navegador**. Tampoco se trazó dónde se pinta el formulario previo del paciente:
si no se pinta en ninguna pantalla, el paciente rellena un formulario que nadie
lee (`PATIENT-PREVIO-001`).
