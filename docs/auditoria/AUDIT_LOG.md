# Registro de auditoría — NexusMED

Bitácora del loop maestro de auditoría por módulos. Un módulo se cierra cuando todos
sus agentes han corrido y sus hallazgos están reparados, diferidos con motivo, o
elevados al médico por ser decisiones suyas y no de código.

Regla de este registro: **se escribe lo que se verificó, no lo que se intentó.** Si algo
quedó sin comprobar en producción, se dice.

---

## Módulo 0 — Núcleo · CERRADO 2026-07-19

Superficie: layout del panel, contextos (clínica, modo, toast), hooks de sesión y
configuración, `firestore.rules`, alta y unión de consultorios, cierre de sesión,
service worker.

Agentes: Bugs · Seguridad · Rendimiento · Normativa · Integridad de datos.

### Reparado y desplegado

| Ver | Hallazgo | Por qué importaba |
|---|---|---|
| v460 | `websocket-driver` ≤0.7.4 (crítica) | Llegaba por `@firebase/database`, que la app no usa. Salto de parche, sin romper nada. |
| v460 | Dos 404 después de pagar | El portal de facturación volvía a `/dashboard/configuracion` y la recarga a `/consulta`; ambas inexistentes. Verificado contra producción. |
| v461 | `useAppointments` sin `where` ni `limit` | **Causa real de la lentitud.** Suscrito a todas las citas de la clínica, montado en toda pantalla del panel. Se degradaba solo conforme crecía la agenda. |
| v461 | Borrador ilegible al cerrar sesión | El flush del desmonte reescribía con la clave equivocada tras `signOut`. PHI en disco **e** irrecuperable, con el modal diciendo "a salvo". |
| v461 | Firma del médico sustituible por recepción | `config/main` con `write: if isMember`. Ataque de suplantación, no solo de robo. |
| v461 | `/api/superadmin/*` sin `email_verified` | Trampa armada para el día que se añada un correo nuevo a `SUPERADMIN_EMAILS`. |
| v462 | Pantalla en blanco sin salida | `return null` cuando Firestore no responde: ni spinner, ni error, ni logout. |
| v462 | Receta impresa con formato por defecto | Sin membrete, firma ni cédula, y sin avisar. Documento inválido para NOM-004. |
| v462 | 0 % de cobertura en `auth-server`, `superadmin`, `rate-limit` | Única frontera de las API routes, que saltan las reglas de Firestore. |
| **v463** | **Regresión propia de v461** | Al bloquear la firma por campo, la segunda rama del `\|\|` quedó **sin `isMember`**: cualquier cuenta podía sobrescribir la config de cualquier consultorio. Cerrar un hueco abrió uno mayor. Hay test guardián. |
| v463 | Consulta dictada perdida | El autoguardado condicionaba en `resumen \|\| secciones`, vacíos mientras se dicta. Y dictar no cuenta como actividad → cierre por inactividad → purga de la única copia. |
| v463 | Proxy de imágenes: caché compartida y SSRF | `cache-control: public` sobre la firma del médico; el chequeo de bucket se satisfacía con la cadena en la query. |
| v463 | `permisosPorRol(null)` → ADMIN | El comentario decía "defaults seguros". |
| v464 | Bitácora forjable | Se escribía desde el navegador, con reloj del navegador y `create: if isMember` sin validar campos. Ahora servidor + `serverTimestamp`. |
| v464 | Aviso de privacidad falso | Prometía "control de acceso multi-factor"; el MFA está `planned` y BLOCKED. El responsable ante el INAI es el médico. |
| v464 | Consentimiento "verbal" | Art. 9 LFPDPPP exige por escrito para datos sensibles. |
| v465 | Paciente duplicado por caché de 30 s | Historial clínico partido en dos expedientes. No se ve como error: se ve como paciente nuevo. |
| v465 | Sesiones de WhatsApp duplicadas | Dos mensajes seguidos → dos documentos → la conversación saltaba entre ellos. |
| v465 | Alta de consultorio no atómica | Dos pestañas en `/setup` → dos consultorios, uno huérfano y facturable. |

### Diferido con motivo

- **10 vulnerabilidades moderadas** en la cadena de `firebase-admin`. Solo se resuelven con
  `npm audit fix --force`, que es rompiente sobre el Admin SDK en producción.
- **Token firmado para el proxy de imágenes.** Es la solución de fondo a que la firma del
  médico viva tras una URL sin sesión. Toca el camino de impresión: va aparte y con prueba
  real, no de pasada.
- **Separar los campos clínicos del documento `patients`.** `alergias`, `curp`, `notas` y la
  valoración del inmunocomprometido son legibles por roles no clínicos. Requiere migración.

### Elevado al médico — no es decisión de código

1. **El modal de aviso de privacidad no está conectado a nada.** Cero llamadores en todo el
   repo. En consulta no se captura el consentimiento LFPDPPP de ningún paciente. Falta
   decidir dónde aparece: alta del paciente, primera apertura del expediente, o recepción.
2. Numerales "NOM-024 Art. 6.4 / 6.5" citados en el código **sin verificar contra el DOF**.
   El requisito de trazabilidad es real; la numeración no está comprobada.

### No verificado

Ninguna reparación se probó con una sesión real del médico. Se verificó: `tsc`, la suite de
tests, `next build`, las respuestas HTTP de producción y el despliegue de reglas. **No** se
abrió un paciente ni se imprimió una receta.

---

## Módulo 1 — Consulta y Expediente Clínico · CERRADO 2026-07-19

Superficie: dictado, generación de la nota por IA, firma, adendas, versiones, las 11 rutas
de `api/expediente`.

Agentes: IA clínica · Bugs · Seguridad · Integridad de datos.

Es el peor módulo del loop hasta ahora, y era predecible: es donde vive lo clínico.

### Los dos que podían dañar a un paciente

| Ver | Hallazgo |
|---|---|
| v466 | **La nota inventaba la alergia.** Rellenaba `severidad:'moderada'` y `confirmada:true` desde un campo de texto libre. Una **anafilaxia** dictada quedaba registrada como moderada, y la nota firmada afirmaba una confirmación inexistente. Causa de fondo: el TIPO exigía los cinco campos, así que el código no tenía más remedio que inventar los que no sabía. Un tipo que obliga a rellenar obliga a inventar. |
| v466 | **Caprini ignoraba la negación.** "Niega várices, niega fractura de cadera" marcaba **ambas presentes**: ~+6 puntos y tromboprofilaxis en quien las negó. La línea de arriba, para TVP, sí comprobaba negación. |

### Pérdida de la consulta

| Ver | Hallazgo |
|---|---|
| v466 | Un lote de transcripción que fallaba se descartaba en silencio **y se borraba el audio** que lo respaldaba. Cualquier consulta de más de ~7,5 min con la red inestable. |
| v466 | Grabar por segunda vez **borraba** el dictado anterior. |
| v468 | Si fallaba la carga de un borrador, el autoguardado lo **vaciaba** a los 30 s. |
| v468 | El contenido de la consulta **anterior** se volcaba en una nota nueva y vacía. |
| v468 | El pase en vivo borraba los diagnósticos escritos a mano. |
| v466 | Notas duplicadas (el respaldo no guardaba el `notaId`) y consultas descartadas que resucitaban. |

### Integridad del documento firmado

| Ver | Hallazgo |
|---|---|
| v466 | Una nota firmada decía "Agregado a la nota ✓" sin guardar nada: engaño medicolegal, no cosmético. |
| v467 | `revisadoPorHumano` era una tautología — **firmar** era lo que lo ponía en true, así que el registro nunca podía decir "firmada sin revisar", que es justo el evento auditable. |
| v468 | El sello de integridad se calculaba sobre un UUID que cambiaba en cada render. |
| v468 | El ensamble truncaba la nota a 20k y fusionaba sobre un JSON partido. |

### La decisión de fondo: cuánto completa la IA (v467)

El prompt ordenaba literalmente *"si el médico solo dictó parte, complétalo con lo que
aplique al cuadro clínico"*, y el plan era obligatorio para firmar: el sistema empujaba
estructuralmente al modelo a rellenar. El médico dictaba "faringitis, le doy amoxicilina" y
firmaba 500 mg cada 8 h por 7 días con signos de alarma, **con su cédula**.

Se le presentaron tres opciones y eligió la intermedia: **la IA sigue completando, pero
marca lo que no se dictó** con `[IA — no dictado]`. Antes de firmar hay que aceptarlo como
propio o quitarlo. No se puede firmar con la marca puesta.

### Seguridad (v466)

- Cualquiera que se registrara usaba la **API key del dueño sin medidor**: con `clinicId`
  nulo, las cuatro funciones de contabilidad retornaban temprano. Opus 4.8 ilimitado.
- El **nombre del paciente** viajaba a Anthropic sin aportar nada a estructurar la nota.
- Se podía **silenciar al verificador de seguridad hablando en voz alta**: recibía la
  transcripción cruda sin guarda, y su prompt termina pidiendo `{"hallazgos":[]}`.

### Limpio (confirmado por los agentes)

- **Citas y evidencia**: no hay ningún camino por el que se muestre un PMID o DOI no
  verificado contra PubMed. El modelo nunca emite PMIDs, solo índices, y los fuera de rango
  se descartan antes de pintar.
- **Sin IDOR** en las 11 rutas: el `clinicId` siempre se deriva del servidor.
- **Signos vitales inventados**: no existe tal camino. Ni exploración física "normal" por
  defecto.
- El **motor de antibiograma** determinista no está invadido por el LLM.
- **Inmutabilidad de lo firmado** y atomicidad de la firma: correctas.

### Pendiente en este módulo

- Dos pestañas sobre la misma nota se pisan en silencio (last-write-wins) y el historial de
  versiones se escribe pero **no lo lee ninguna pantalla** — además con dos formas
  incompatibles, así que cada lector ve la mitad.
- Carrera en la atribución de roles: la primera nota se redacta antes de que lleguen.
- `_schemaWarning` se emite y nadie lo lee; `sanitizarProsa` borra los avisos de
  incertidumbre que el modelo escribió a propósito.
- Al borrar una nota, sus `versions` y `adendas` quedan huérfanas con PHI completo.

### No verificado

**Nada de este módulo se ha probado dictando una consulta real.** Lo pendiente más
importante: comprobar que el modelo no marque de más — si marca lo que sí se dictó, el
aviso se vuelve ruido y se deja de leer.

---

## Módulo 2 — Agenda y citas · CERRADO 2026-07-20

Superficie: agenda, calendario, asistente, modal de citas, disponibilidad, portal
público de reservas y el bot de WhatsApp.

Agentes: Bugs · Integridad de datos.

### Veredicto sobre la ventana de 120 días (introducida en v461)

**LIMPIA.** Se rastrearon todos los consumidores de `useAppointments`: ninguna pantalla de
métricas lo usa. Corte de caja, CRM y reactivación consultan su propia ventana, siempre
≥ al periodo que reportan. No hay ningún total calculado sobre datos parciales. La ventana
solo tiene cota inferior, así que ninguna cita futura puede quedar oculta.

Sí dejó dos defectos propios, corregidos en v470: al ampliarse no volvía a "cargando"
(pintaba "No hay citas" hasta que respondiera Firestore) y el modal usaba su propia
ventana, así que al editar una cita de hace más de 120 días veía ese día vacío y ofrecía
como libre el horario de la cita de al lado.

### Empalmes — el peor resultado de una agenda es un paciente sin atención

| Ver | Hallazgo |
|---|---|
| v470 | Se podía agendar en **domingo, en festivo y fuera del horario**: cuando no hay huecos el modal cambia el desplegable por un campo de hora libre, y ni el cliente ni `POST /api/appointments` validaban día ni horario. Solo lo hacía el portal público. |
| v470 | **Reagendar no pasaba por ninguna transacción**: iba por `updateDoc` directo desde el navegador, así que mover una cita encima de otra ni siquiera competía con las altas nuevas. |
| v470 | El hueco liberado se ofrece a **3 pacientes de la lista de espera** y los 3 podían agendarlo: esa rama del bot creaba la cita con un `.add()` pelón. La otra rama ya era transaccional. |
| v470 | Esa cita nacía **sin `medicoId`**: invisible al filtrar por médico y contando como ocupada para todos. Una cita que existe, que nadie ve, y que estorba. |
| v470 | El **centinela de serialización** se partía por médico+día cuando la lógica dice que una cita sin médico choca contra todas: dos transacciones que debían competir no se veían. |

### Datos y visibilidad

| Ver | Hallazgo |
|---|---|
| v470 | `noShowCount`, `cancelacionCount` y `ultimaCita` se leían en **cuatro pantallas y nunca se escribían**. El motor de riesgo de no-show documenta el historial como "la señal más fuerte" y esa señal valía 0 siempre. En el CRM todos los pacientes contaban como inactivos; la retención NOM-004 se evaluaba con una fecha vacía. |
| v470 | El **calendario se corría un día completo** en zonas al este de CDMX (Cancún es UTC-5 todo el año y es mercado real de turismo médico). |
| v471 | **Cancelar desde el menú rápido no borraba el evento de Google Calendar** — el paciente lo seguía viendo y se presentaba. |
| v471 | El **filtro de médico se quedaba pegado** si ese médico se daba de baja: agenda vacía todos los días, sin control en pantalla para quitarlo. |
| v471 | Guardar en el modal reescribía las banderas de recordatorio con el valor congelado al abrirlo → el paciente **recibía el aviso dos veces**. |
| v471 | Borrar una cita cobrada dejaba el **cobro huérfano** y descuadraba el corte de caja. |
| v471 | La cita **sin expediente ligado** se creaba en silencio, con toast verde. |
| v471 | `/api/public/availability` leía la **colección completa** de citas en cada clic del portal, sin autenticación. |

### Herramienta nueva

`POST /api/mantenimiento/backfill-contadores` reconstruye los contadores históricos desde
las citas existentes. Idempotente por diseño: recalcula y escribe el total, no incrementa —
un backfill que incrementa no se puede repetir si se corta a la mitad. Admite `?simular=1`.

### Pendiente en este módulo

- Reagenda desde el portal: se marca la cita como desincronizada de Google Calendar en vez
  de sincronizarla, porque el token está guardado por usuario y no se puede saber cuál de
  los médicos conectó ese calendario. Falta el control en el panel para re-sincronizar.
- `bot_sessions` tiene dos convenciones de id conviviendo (`waitlist-notify` usa `where` +
  `add`; `lib/firestore` usa id determinista): puede duplicar sesiones y perder la oferta
  de un hueco en silencio.
- `public/booking` interpreta la fecha en la zona del servidor (UTC en Vercel). Hoy no
  explota porque el portal solo ofrece de mañana en adelante; se rompe el día que se
  habilite reserva el mismo día.
- Enlace `?id=` a una cita fuera de la ventana no abre nada y no avisa.

### No verificado

El backfill **no se ha ejecutado**. Conviene correrlo primero con `?simular=1` y mirar los
números antes de escribir.

---

## Módulo 3 — Recetas, órdenes y referencias · CERRADO 2026-07-20

Superficie: lo que sale IMPRESO y FIRMADO del consultorio — receta, orden médica, carta de
referencia, vista previa, PDF, Word, calibrador visual del formato.

Agentes: seguridad clínica de la prescripción · Bugs.

Los dos agentes, trabajando por separado, señalaron el mismo hallazgo como el peor.

### Suplantación

| Ver | Hallazgo |
|---|---|
| v473 | **La receta de un médico podía salir con la firma escaneada de otro.** `entradaPorMedico` decía ser "segura para clínicas de varios médicos" y no lo era: como el propio archivo documenta, el match exacto casi siempre falla (las notas se sellan con el uid de Firebase y la config guarda por id de `doctors`), así que la regla de respaldo "si hay UNA sola entrada válida, úsala" no era la excepción — era el camino normal. Y sin ninguna entrada se caía a la firma global de la clínica, la del dueño. Ahora la regla exige un solo médico, no se cae a la global, y se avisa antes de imprimir: **una firma ausente se nota; una firma ajena no**. |

### El papel contradecía a la pantalla

| Ver | Hallazgo |
|---|---|
| v473 | El **.doc de la orden afirmaba "ALERGIAS: Negadas"** para un paciente alérgico —no mandaba el campo— mientras el PDF de esa misma orden imprimía la alergia real. Peligroso en estudios con contraste. Además "Negadas" ya no se afirma desde un campo vacío: no es lo mismo que el paciente niegue a que nadie pregunte. |
| v473 | El **QR de verificación nunca funcionó**: la llamada iba con `fetch` plano contra una ruta que exige token → 401 siempre, con dos catches tragándoselo. El QR impreso codificaba el folio en texto plano en vez de la URL firmada. |
| v474 | El **folio se reinventaba en cada carga**: reimprimir daba otro folio, y el QR firma ese folio. |

### Pérdida de contenido en el papel

| Ver | Hallazgo |
|---|---|
| v473 | Arrastrar el **folio al pie del formato borraba los medicamentos**: el margen superior se deriva del campo más bajo, el área de contenido colapsaba y `overflow: hidden` hacía el resto. |
| v474 | **Reservas de paginación cortas** → el bloque de firma, colocado con `marginTop:auto`, se quedaba sin espacio y terminaba fuera de la hoja. No es una hoja fea: es una receta sin firma ni cédula. Hoja 1 con membrete: 52 mm reservados contra ~69 reales; pie: 26 contra ~30 más el aviso legal. Y el formato propio firma cada hoja, pero solo se reservaba en la última. |
| v473 | Un **medicamento vacío** se imprimía como viñeta numerada en blanco, consumiendo altura y pudiendo empujar otro fármaco fuera. |
| v474 | Con la ventana emergente bloqueada, el respaldo imprimía la receta **al 40 % y recortada** (el documento vive dentro de la vista previa escalada). Ahora se avisa y no se imprime nada. |

### Otros

- v473: la carta de referencia se quedaba en "Cargando…" para siempre (sin `catch`).
- v474: sin cédula se imprimía "Cédula Prof. —", que parece maquetación y no la ausencia de un
  dato obligatorio.
- v474: el membrete del Word con URL relativa salía roto (Word abre el .doc desde disco).
- v473: el contador de hojas usaba distinta config que el documento ("1 hoja", PDF con 2).

### Limpio (confirmado por los agentes)

- **No hay mezcla entre pacientes.** `getNota` está anclado a la ruta del paciente; un notaId
  ajeno devuelve `null`.
- El escapado del Word no altera el texto médico; los saltos de página van inline y sobreviven
  a la copia y a la captura; el QR se genera local, sin fuga a terceros.
- `receta-token.ts`: HMAC con `timingSafeEqual` y caducidad, sin PHI en el payload.
- El anti-SSRF de `/api/receta/diseno` (reparado en el Módulo 0) resiste la revisión.

### Pendiente en este módulo

- **Lo impreso no queda en el expediente.** El médico puede editar, agregar o borrar
  medicamentos en la pantalla de receta y nada de eso se guarda: el papel entregado puede
  diferir de la nota, sin rastro. El QR acredita que alguien emitió un token, no que el papel
  diga lo que dice.
- El Word ignora `disenoCompletoDataUrl`: quien usa su formato escaneado obtiene un
  encabezado auto-generado distinto al que aprobó en pantalla.
- Los márgenes en mm del calibrador se ignoran cuando hay campos colocados, y la guía cian
  del editor dibuja los valores que el documento ya descartó.
- **Sustancias controladas**: se detectan y se muestran en pantalla, pero nada de eso llega al
  papel — ni marca, ni fracción, ni advertencia de que la receta de la app no sustituye al
  recetario oficial de COFEPRIS.

### No verificado — y es lo más importante de este módulo

**Nada se ha impreso.** El motor de paginación estima alturas con una heurística de
caracteres y el render real usa otro ancho; los tests comparan el estimador consigo mismo, no
con el papel. Las reservas se subieron con margen, pero el invariante "la firma siempre cabe"
solo se puede comprobar imprimiendo una receta de 8–10 medicamentos con nombres largos.

---

## Módulo 5 — Antibiograma y motor PROA · CERRADO 2026-07-20

Superficie: `lib/expediente/antibiograma/**` completo, las rutas de razonamiento y de visión,
y la pantalla del antibiograma.

Agentes: microbiología clínica y PROA · Bugs. Ambos verificaron sus hallazgos EJECUTANDO el
motor, no solo leyéndolo.

### Veredicto de los agentes, que conviene no perder

**El contenido microbiológico está bien.** Los puntos de corte del CLSI M100 bien
transcritos, la matriz de β-lactamasas de Bush & Bradford correcta, la lógica
CAZ-AVI/aztreonam para metalo-β-lactamasas es la buena, y la frontera IA↔motor está bien
concebida a nivel de arquitectura. **Los P0 eran de plomería**: una función de seis líneas y
un dedup de ocho rompían conclusiones clínicas correctas.

### Los tres P0 (v476)

| Hallazgo | Consecuencia |
|---|---|
| **Emparejamiento por subcadena.** Los β-lactámicos nuevos son COMBINACIONES cuyo nombre contiene el del agente suelto. | `Meropenem-vaborbactam S` hacía que la clase CARBAPENEM viera una S: una **K. pneumoniae pan-carbapenem-R salía como "pérdida de porina"**, sin alerta crítica, sin terapia dirigida, sin notificación NOM-045 y sin aislamiento. El alias `avibactam` casaba "Aztreonam-avibactam" y el motor concluía carbapenemasa **de serina** — al revés. Y `ampicilina` casaba "Amoxicilina-clavulanato": una Klebsiella S a amox-clav, lo NORMAL, disparaba alarma de resistencia intrínseca. |
| **Lo confirmado perdía contra lo inferido.** El dedup conservaba el primero y la inferencia se fusiona antes. | Una **KPC confirmada por PCR** salía como "clase no determinada [probable]", y la terapia **prescribía y prohibía CAZ-AVI en la misma lista**. |
| **Los conflictos intrínsecos miraban solo la primera fila.** | "Meropenem R, Imipenem S" en *S. maltophilia* no reportaba conflicto: la fila biológicamente imposible —la señal de error de identificación— ni se miraba. |

### Correcciones clínicas indicadas por el médico (v477)

- **MDR ya no cuenta la resistencia INTRÍNSECA** (Magiorakos lo exige). Un *Proteus mirabilis*
  completamente sensible salía `MDR[confirmado]` porque el panel reporta sus cuatro
  resistencias naturales. Aplica a toda especie con patrón intrínseco, no solo Proteus.
- ***P. aeruginosa* carbapenem-R con cefalosporinas S** ya no pasa en silencio (no disparaba
  NADA): se atribuye a porina OprD + bombas MexAB-OprM, y explícitamente **no** a
  carbapenemasa — una carbapenemasa arrastraría también las cefalosporinas.
- **Carbapenemasas**: KPC y OXA-48 → CAZ-AVI; IMP/NDM/VIM → aztreonam, casi siempre con
  serina coproducida, de ahí la combinación con avibactam. Se suavizó el "EXCLUYE".

### Los cuatro puntos de corte que el agente marcó SIN proponer cifras

Hizo bien en no inventarlos. Se verificaron contra fuentes primarias:

| Valor | Veredicto |
|---|---|
| Pip-tazo / *P. aeruginosa* | **Ya estaba correcto.** S ≤16 / R ≥64 = revisión CLSI enero 2023 (antes R ≥128). |
| Minociclina / *Acinetobacter* | **Ya estaba correcto y en la edición más nueva.** S ≤1 / R ≥4 = CLSI M100-Ed35 (2025). El agente recordaba los de Ed34. |
| Oxacilina / coagulasa-negativo | **Estaba mal.** Se aplicaba el corte de *S. aureus*: un *S. epidermidis* con CMI 1 salía SENSIBLE. Corregido a S ≤0.25 / R ≥0.5, que es el que detecta mecA (~80 % de los CoNS lo portan). *S. lugdunensis* conserva el de *S. aureus*. |
| Daptomicina / *E. faecium* | **Estaba mal.** Se usaba el corte de estafilococo. CLSI no define S: solo SDD ≤4 (8-12 mg/kg/día) y R ≥8. El motor además se contradecía consigo mismo en un VRE. |

### Cierre (v478)

- **HLAR falso**: se declaraba con una gentamicina R de panel rutinario, pero el enterococo es
  intrínsecamente R de bajo nivel — esa R es lo esperado. Se abandonaba la sinergia en
  endocarditis sin fundamento. Ahora exige el tamiz de alto nivel.
- **CMI censurada**: `parseCMI` tiraba el símbolo, así que «>500» se leía como 500 exacto
  contra un umbral estricto `>500` — daba falso y apagaba el HLAR.
- **Frontera IA**: las alertas críticas del motor no llegaban al prompt (el modelo razonaba
  sin ellas), y la regla anti-contradicción era solo texto. Se añadió validación posterior que
  **anota** —no censura— cuando el texto recomienda algo reportado R, marcado "evitar" o
  intrínsecamente resistente.

### Pendiente en este módulo

- `perfilAEntrada` descarta las celdas `'SDD'` (el tipo `SIR` no la contempla): un cefepime SDD
  desaparece del panel y empuja a escalar a carbapenémico.
- La rama BLEE exige un carbapenémico probado y S; en panel básico —frecuente en México— el
  fenotipo más común del país no se detecta.
- `nofermentadores` recomienda amp-sulbactam en *Acinetobacter* sin consultar su S/I/R
  reportado, y cotrimoxazol en *S. maltophilia* cuando no se probó.
- Las ediciones interpretativas EUCAST se emiten pero no se aplican al array que consumen los
  demás módulos.

### No verificado

Ninguna interpretación se ha contrastado contra un antibiograma real del laboratorio del
médico. Los agentes ejecutaron el motor con casos construidos; eso valida la lógica, no la
correspondencia con lo que imprime su lab.
