# Estado del compañero del paciente — V9

> Se escribe **a mano**, tras cada iteración.
> Línea base completa con evidencia: `docs/patient/PATIENT_COMPANION_BASELINE.md`.

**Unidad**: `POSTVISIT-001` **cerrada** el 9-ago-2026 · REG-306 a REG-309.
**Siguiente**: `PATIENT-AI-001` — ASK NEXUS, la unidad más peligrosa del programa.

---

## Lo que quedó montado en `POSTVISIT-001`

**El bucle cierra.** Hasta hoy el compañero del paciente era una superficie
esperando contenido que nadie producía. Ahora:

```
nota firmada → el médico revisa y libera → el paquete existe, fechado y firmado
             → el portal lo sirve filtrado → el paciente lo lee
```

**La composición volvió, con quien la llama.** `componerPaquete` y
`cambiosDeMedicacion` se habían **quitado** en la unidad anterior por ser motores
sin llamador. Vuelven porque ya existe el llamador —el servidor— y no al revés.
Ésa es la disciplina que este repositorio lleva meses persiguiendo.

**Compone el SERVIDOR.** No la pantalla. Si la pantalla compusiera y mandara el
resultado, la lista blanca de campos estaría validando la forma de algo que ya
viene del cliente: quien controle ese navegador escribe lo que quiera en el
documento que va a leer el paciente. Del cuerpo sólo se aceptan
**identificadores**, y hay un guardián que enumera cuáles.

**Dos actos, dos capacidades.** Previsualizar pide `clinico.leer`; liberar pide
`firmar`, porque es una aprobación con identidad profesional detrás. El mapa vive
en el registro de rutas, no en la ruta.

**Un liberado no se reescribe.** `.create()` sobre `{notaId}-v{n}`. Si dentro de
un año hay que responder «¿qué leyó este paciente el 9 de agosto?», la respuesta
existe.

## Lo que esta unidad se NEGÓ a hacer, y es lo importante

**No deduce una suspensión de una ausencia** (REG-307). Comparar la lista de hoy
con la de la visita anterior y llamar «suspendido» a lo que falta es la
implementación obvia — y le diría a un diabético que su médico le quitó la
metformina porque no la re-listó. El paciente **no puede detectar el error**.

`suspendido` sale sólo de que el médico lo marcara. Y sin lista previa,
`medicationChanges` es `null` y la pantalla del paciente **se calla**, en vez de
afirmar que nada cambió.

**Signos de alarma y material educativo van vacíos.** La especificación los pide
y los campos existen. No hay de dónde sacarlos sin inventar: los signos de alarma
son indicación médica y el material educativo es evidencia curada.

## Las cinco destinaciones, hoy

| Destino | Hoy |
|---|---|
| **TODAY** | citas, teleconsulta, anticipo, formulario previo |
| **ASK NEXUS** | **escala al consultorio, no responde.** `PATIENT-AI-001` |
| **CARE** | **plan liberado con medicación, cambios, estudios y seguimiento** ← nuevo |
| **DOCUMENTS** | recetas derivadas de notas firmadas. Sin cartera todavía: `DOCUMENTS-001` |
| **PROFILE** | dice que el idioma es es-MX y que no hay cuidador. `PATIENT-LANGUAGE-001` |

## P0/P1 que siguen abiertos en esta superficie

- **P0** `PATIENT-TELE-002` — el enlace de videoconsulta por WhatsApp sigue sin
  token. Desde REG-265 manda «recibirás el enlace» en vez de un 404: honesto,
  pero el paciente sigue sin enlace.
- **P1** `PATIENT-PORTAL-001` — `/api/portal` sin límite de tasa, y la
  comprobación de revocación falla **abierta**.

Cerrados hoy: `POSTVISIT-GATE-001` y `POSTVISIT-ENTREGA-001`.

## Lo que este estado NO afirma

**Nada se ha visto en un navegador.** Ni la pantalla del médico ni la del
paciente. Los tres guardianes nuevos se probaron al revés —defecto inyectado,
rojo— pero Firestore no existe en la suite: la ruta se vigila leyéndola, no
ejecutándola. Y `npm run build` sigue sin poder recolectar datos de página en
este contenedor por falta de credenciales (`NAV-NAVEGADOR-001`).

**Tampoco se ha provocado la carrera de dos pestañas liberando a la vez.**
`.create()` la hace fallar en vez de pisar, que es lo correcto, pero es una
decisión leída, no observada.

---

## Estado anterior (`PATIENT-COMPANION-001`, 9-ago)

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
