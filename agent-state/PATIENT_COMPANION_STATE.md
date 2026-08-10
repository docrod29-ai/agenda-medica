# Estado del compañero del paciente — V9

> Se escribe **a mano**, tras cada iteración.
> Línea base completa con evidencia: `docs/patient/PATIENT_COMPANION_BASELINE.md`.

**Unidad**: `POSTVISIT-001` **cerrada** el 10-ago-2026 · REG-306, REG-307.
**Siguiente**: `PATIENT-AI-001` — ASK NEXUS, las cinco clases de respuesta y las
doce preguntas del equipo rojo como fixture permanente.

---

## Lo que quedó montado en `POSTVISIT-001`

**El bucle se cierra de punta a punta por primera vez**: el médico firma, libera,
y el paciente lo ve en «Cuidado». Hasta hoy la superficie del paciente estaba
lista para recibir paquetes y **nada en producción creaba uno**.

**La compuerta de firma, en el servidor.** `componerPaquete` lanza si la nota no
está firmada; la ruta lo traduce a 409 y le dice al médico exactamente qué le
falta. En la pantalla, copiar/imprimir/liberar **no se renderizan** sin firma, y
se dice por qué en vez de dejar tres botones apagados.

**El contenido no viaja en el cuerpo.** La ruta recibe `clinicId`, `patientId` y
`notaId`. Lo demás lo lee el servidor de la nota firmada. Con el contenido en el
cuerpo, cualquiera con sesión del consultorio podría publicarle al paciente el
texto que quisiera bajo el membrete de su médico — y la compuerta sería una
comprobación del navegador, o sea ninguna.

**Capacidad `firmar`, no `clinico.escribir`.** Enfermería escribe en el
expediente y no puede aprobar lo que el paciente lee como palabra de su médico.

**Inmutable.** `.create()` en `{notaId}-v{n}`. Una versión entregada no se
sobrescribe: «¿qué se le dijo exactamente el 9 de agosto?» no puede contestarse
con «lo que compondría hoy el código».

## El defecto que no se buscaba — REG-306

El fármaco que el médico acaba de suspender salía impreso bajo **«SUS
MEDICAMENTOS»**, junto a lo que sí hay que tomar. Meses en producción, 8 000
pruebas en verde, ninguna dependía del comportamiento roto. Apareció **siguiendo
el dato**: al decidir qué hacer con `estado` hubo que buscar quién lo escribe.

## Lo que este estado NO afirma

**Nada se ha visto en un navegador.** Los tres tramos se sellan leyendo el
código. Y la ruta HTTP no se probó con Firestore: eso exige el emulador.

## Lo que queda apuntado, y no es defecto

- **`warningSigns` no tiene de dónde salir.** El campo existe y va vacío: los
  signos de alarma son indicación médica, y hoy el médico no tiene dónde
  escribirlos. Casilla de producto, no defecto.
- **El paquete no se puede revocar.** `DOCUMENTS-001` trae `REVOKED`; debería
  heredarlo.
- **El paciente no se entera de que hay algo nuevo.** Va con
  `CLOSED-LOOP-PATIENT-001`.

---

## Lo anterior (`PATIENT-COMPANION-001`, 9-ago)

### Lo que quedó montado en `PATIENT-COMPANION-001`

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
