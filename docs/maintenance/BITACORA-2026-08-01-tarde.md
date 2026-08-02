# Bitácora reanudable — tarde del 2026-08-01

**El objetivo del Dr. es terminar el MASTER EXECUTION LOOP V6 completo.** El
estado fase por fase, verificado contra el código, está en
**`V6-PRACTICE-GA.md`** — léelo también: dice qué falta de cada P y en qué orden
seguir. Este archivo es el registro de versiones y la cola fina.

**Para retomar:** lee este archivo primero. Cada punto dice si está HECHO, EN CURSO
o PENDIENTE, y lo pendiente trae el archivo y la línea por donde entrar.

Rama: `nexus-os/sesion-2026-07-29`. Despliegue: `npx vercel --prod --yes --archive=tgz`.
**Las reglas de Firestore se despliegan APARTE**: `npx firebase deploy --only firestore:rules --project nexomed-agenda`.

Verificar despliegue (lo único fiable):
```
curl -s "https://agenda-medica-one.vercel.app/sw.js?x=$RANDOM" | grep -oE "nexusmed-v[0-9]+"
```

---

## Desplegado esta sesión

| Versión | Qué |
|---|---|
| v799 | Motor de tareas clínicas (P17/P18) + `/pendientes` |
| v800 | 10 defectos: doble cobro del anticipo, citas sin verificar, sala de teleconsulta caducada, bloqueos de agenda, timeouts de IA, tamizaje→receta |
| v801 | Trazabilidad de agenda, cortesías que no se registraban, alerta crítica sin rastro |
| v802 | El anticipo saldaba la consulta entera · CSV que reventaba · contraste AA en tema oscuro |
| v803 | Anular abono liberaba otro cobro · zona horaria de Finanzas · fecha del reembolso · bitácora ARCO/privacidad · foco del modal · 44 px táctiles |
| v804 | `/pendientes` estaba roto en producción: índice compuesto, reglas sin desplegar, tokens CSS inexistentes |
| v805 | Minimizado Google Calendar (iniciales + puntero) · purga del audio en AssemblyAI · aviso de privacidad con proveedores reales |
| v806 | CFDI con defaults inventados · membresías siempre en efectivo · sobreagendar autorizado y auditado |
| v807 | Sobreagendar sólo el médico |
| v808 | Reparto de la asistente: factura sí, borrar/sobreagendar/teleconsulta no |
| v809 | La «C» de ARCO con camino técnico real (supresión o bloqueo) |
| v810 | El tope de 24 huecos borraba la tarde · WhatsApp del bot sin rastro |
| v811 | Al cerrar sesión se borraba lo no guardado (las 4 salidas) · precio falso de $499 |
| v812 | Cambiar de plan cancelaba la clínica · valoración inmuno se borraba sola · censo en spinner eterno |
| v813 | Recarga pagada sin créditos · rebote mudo del plan · dos fugas del respaldo local |
| v814 | Cobrar un ciclo distinto del ofrecido · adivinar mal el plan por importe |
| v815 | Médicos habilitados sin cobrar · pagos huérfanos invisibles |
| v816 | Teléfono del alta era campo muerto · recordatorios en verde sin WhatsApp conectado |
| v817 | El pase de UCI se evaporaba (respaldo local + acuse) · resultados de laboratorio con Escape |
| v818 | Se podía mover dinero entre médicos por «vincular factura» (reglas + 3 tests de emulador) |
| v819 | pagoVencido/disputaAbierta que nadie leía · el año pagado que se perdía al cambiar de plan |
| v820 | Dos pestañas sobre la misma nota se pisaban: guardia de concurrencia |
| v821 | El historial de versiones ya se puede leer · dónde están las tarifas de consulta |
| v822 | Verificación de correo (no existía en ninguna parte) |
| v823 | Borrar expediente desde el navegador: cerrado (la protección NOM-004 vivía en código muerto) |
| v824 | La bitácora se quedaba con huecos: cola de reintento con fallos permanentes descartados |
| v825 | Bajar de plan en el portal de Stripe dejaba los módulos caros (manda el precio, no el metadato) |
| v826 | El portal ARCO no verificaba a nadie, y la solicitud ya ejecuta: acreditación del titular antes del acto irreversible |

---

## EN CURSO — seguir por aquí

### Cola nueva de los auditores de la tarde (verificar cada uno antes de tocar)

**Lanzamiento comercial** (`docs` del auditor de flujo):
1. **El gate de tarjeta bloquea la app entera a un médico nuevo**, pese a que
   `/registro` y `/setup` prometen «14 días de prueba, sin tarjeta».
   `src/app/(dashboard)/layout.tsx:148-154` — `estadoAcceso` devuelve
   `'sin_tarjeta'` para `status: 'trial'`. Y hay un sistema de prueba COMPLETO y
   muerto en `src/lib/finanzas/paywall-prueba.ts`: el `TrialBanner` sólo se pinta
   con `status === 'trial'`, que es exactamente el estado que ya bloqueó la app.
   **Decisión comercial del Dr: ¿la prueba es sin tarjeta o con tarjeta?** El
   código promete una cosa en tres sitios y hace la contraria.
2. ~~Plan Agenda: rebote mudo~~ — HECHO (v813).
   `src/lib/modulos.ts:58` (`/pacientes` es core, `/expediente` no) +
   `src/app/(dashboard)/layout.tsx:404-406` (`router.replace` mudo). La entrada
   del menú se llama «Consulta». Parece la app rota, no un límite de plan.
3. ~~Verificación de correo~~ — HECHO (v822), sin bloquear el acceso. `grep sendEmailVerification` → cero.
   Un correo mal tecleado = cuenta irrecuperable sin soporte humano.
4. ~~Recordatorios encendidos sin proveedor~~ — HECHO (v816).
   (`src/types/index.ts:648`): dos interruptores en verde que no mandan nada.
5. ~~Teléfono del alta~~ — HECHO (v816). `src/app/setup/page.tsx:25`
   tiene el campo en el estado y NINGÚN input; el impreso lee `telefonoAdmin`.
6. ~~Precio de consulta escondido~~ — PARCIAL (v821): el cobro ahora dice dónde fijarlo. Moverlo de sitio sigue pendiente.
7. **El dueño no puede reproducir nada de esto**: `layout.tsx:475` le da pase
   libre. Para validar el lanzamiento hace falta una cuenta con correo ajeno.

**Pérdida de datos** (auditor de pérdida):
8. ~~Panel UCI sin persistir~~ — HECHO (v817). Antes:: salir de la ruta borra el
   pase completo. `src/app/(dashboard)/uci/page.tsx:124` — y tampoco escucha
   `EVENTO_GUARDAR_TODO`. Agrava que el audio se borra de IndexedDB en cuanto
   llega el texto.
9. ~~Resultados de laboratorio con Escape~~ — HECHO (v817)., y
   reabrir los pone en blanco. `hospitalizacion/[internamientoId]/page.tsx:772`.
10. ~~Historial ilegible + sin guardia de concurrencia~~ — HECHO (v820 + v821).
11. ~~Respaldo local sin estudios/preop~~ — HECHO (v813). Antes decía:
    estudios o preop (faltan en las deps). `consulta/[patientId]/page.tsx:1496`.
12. ~~restaurarRespaldo sin notaId~~ — HECHO (v813). — el mismo bug que ya se
    arregló en la ruta automática.

**Stripe** (auditor de suscripciones):
13. ~~Anual que acaba en mensual~~ — HECHO (v814). Queda el 2º camino: Configuración no manda `ciclo` al cambiar de plan, así que un cliente anual pasa a mensual y pierde lo pagado del año, sin nota ni abono.
14. ~~Recarga sin créditos~~ — HECHO (v813). Antes: (`ai-keys.ts:205` se traga
    su propio error y el webhook responde 200).
15. Los metadatos de Stripe quedan congelados en el plan de la compra original.
16. ~~planPorMonto se equivoca~~ — HECHO (v814).
17. La prueba de 14 días se puede repetir indefinidamente. **PENDIENTE — decisión comercial del Dr: ¿se permite repetir la prueba?**
18. ~~Asiento sin cobrar~~ — HECHO (v815).
19. ~~Reatribuir el médico de un cobro~~ — HECHO (v818). Antes:
    factura» y mover comisiones (`firestore.rules:619`).
20. ~~pagoVencido/disputaAbierta sin lector~~ — HECHO (v819).
21. ~~Pagos huérfanos~~ — HECHO (v815).

### 1. El tope de 24 huecos corta la tarde en silencio — HECHO (v810)
- `src/lib/availability.ts:15` — `MAX_SLOTS_POR_DIA = 24`, y `:135` corta con `break`
  y un `console.warn` que sólo ve el servidor.
- Duplicado en `src/app/api/public/availability/[clinicId]/route.ts:121`.
- **Escenario:** dentista u oftalmólogo con seguimientos de 15 min de 09:00 a 19:00 =
  40 huecos. La agenda ofrece hasta ~15:00 y el resto del día aparece «sin lugares»,
  en el panel Y en el portal público.
- **Lo que SÍ es mío:** que el corte sea VISIBLE. Hoy es silencioso.
- **Lo que es del Dr:** cuál debe ser el número (o si debe haber tope).

### 2. Los envíos de WhatsApp se pierden sin dejar rastro
- `src/lib/whatsapp/outbox.ts:44` (`encolarReintento`) tiene UN solo llamador:
  `src/app/api/whatsapp/waitlist-notify/route.ts:163`.
- `src/app/api/whatsapp/webhook/route.ts:381` — el helper `send()` devuelve booleano
  y **36 llamadas lo descartan**. Si falla la confirmación de una cita agendada por
  WhatsApp, la cita queda creada y el paciente nunca se entera.
- `src/app/api/public/booking/route.ts:280` — `.catch(() => {})` traga la confirmación
  del portal público.
- **Nota:** reintentar fuera de la ventana de 24 h exige plantilla aprobada en Meta
  (pendiente del Dr). Lo que sí se puede hacer sin él: que el fallo quede REGISTRADO
  y visible, como ya se hizo con `alertas_no_entregadas`.

---

## PENDIENTE — cola priorizada (mía)

1. **`priceIdDe` cae de anual a mensual en silencio** — `src/lib/stripe.ts:50`:
   `STRIPE_PRICES_ANUAL[plan] || STRIPE_PRICES[plan]`. Si falta la variable del
   precio anual, el cliente compra «anual» y Stripe abre una suscripción MENSUAL,
   con los metadatos diciendo `ciclo: 'anual'`. Nadie se entera hasta el 2º cargo.
2. **`planPorMonto` se equivoca con las anuales** — `src/app/api/stripe/webhook/route.ts:71`:
   los cortes están en centavos de plan MENSUAL. Una anual de Agenda (~349000)
   devuelve `'hospital'`. Sólo se dispara si falta `metadata.plan`.
3. **`items.data[0]` no tiene orden garantizado** — mismo archivo, `:309`. Con un
   ítem de asiento en la suscripción puede ser el precio del médico extra.
4. **Prueba de 14 días en CADA checkout** — `src/app/api/stripe/checkout/route.ts:84`,
   incondicional: cancelar y volver a suscribirse los renueva.
5. **`asientos` marca médicos contratados sin cobrarlos** — `src/app/api/stripe/asientos/route.ts:82`.
6. **`invoice.paid` sin clínica guarda `clinicId: ''`** — ingreso huérfano.
7. **Las reglas dejan reatribuir `medicoId` al vincular factura** — `firestore.rules:611`,
   lo que mueve el reparto de comisiones.
8. ~~logAudit en silencio~~ — HECHO (v824). — `src/lib/expediente/audit-log.ts:84`.
9. **El portal ARCO público no verifica identidad** — `src/app/privacidad/[clinicId]/page.tsx:70`.
10. **Horario partido / descansos / festivos recurrentes no existen en el modelo** —
    `src/types/index.ts:408` (`DaySchedule` es un solo tramo).
11. **Las sucursales son decorativas en la agenda** — `branchId` está en la lista blanca
    pero ninguna interfaz lo escribe y ni `getAvailableSlots` ni `hasConflict` lo miran.
12. **Google Calendar es unidireccional** — no hay `freebusy`: un evento creado en
    Google no bloquea la agenda.
13. **Fragmentación cromática** — 160 de 187 `.tsx` con estilo en línea, 4 rojos y
    8 ámbares distintos. Saneamiento progresivo; bloquear con lint.
14. **`BLOQUEA_RECETA` promete una barrera que no existe** — `src/lib/expediente/medical-ner.ts:176`:
    lo decide el LLM y no bloquea nada, sólo se pinta.
15. **Textos clínicos en imperativo sin fuente** — `src/lib/seguridad/prescripcion-segura.ts`
    y `src/lib/inmuno/`: pasar a voz informativa es software; las CIFRAS son del Dr.

---

## DECISIONES COMERCIALES QUE FALTAN (no las tomo yo)

- **¿La prueba de 14 días es con tarjeta o sin ella?** El código promete «sin
  tarjeta» en `/registro` y en `/setup`, y el gate de `layout.tsx` bloquea la app
  entera a quien está en `trial`. Además hay un sistema de prueba COMPLETO y
  muerto en `lib/finanzas/paywall-prueba.ts`. Los dos modelos conviven y se
  contradicen; hay que elegir uno.
- **¿Se puede repetir la prueba?** Hoy sí, indefinidamente: `trial_period_days:
  14` es incondicional en cada checkout.
- **Verificación de correo**: no existe (`sendEmailVerification` no aparece en el
  repo). Un correo mal tecleado deja la cuenta irrecuperable sin soporte humano.

## BLOQUEADO EN EL DR. (lo último, por su instrucción)

- **P6** — validar los 23 motores en `pendiente_validacion` + 1 experimental.
- **P7/P8** — asignar la clasificación de seguridad a cada fármaco (el esquema ya existe).
- **P19** — pentest externo, PITR y simulacro de restauración (sus consolas).
- **P22** — cuenta de prueba con contraseña en los secretos de CI para el E2E.
- Tarifas de los modelos de IA (el libro de costos nace vacío a propósito).
- Plantillas de WhatsApp aprobadas en Meta.
- Cuál debe ser el tope de huecos por día (punto 1 de EN CURSO).
- Las ~39 recomendaciones de inmuno sin `fuente` declarada.

---

# NOCHE DEL 1 AL 2 DE AGOSTO — v829 a v833

Panel de especialistas en paralelo (agenda, IA/voz, clínico-como-software,
abogado sanitarista). ~45 hallazgos; lo confirmado leyendo el código está abajo.

| v | Qué se reparó |
|---|---|
| **829** | **Horario partido.** `DaySchedule` era un solo tramo: 9-14 y 16-20 no se podía expresar. `descansos` es opcional — sin él, el día se comporta igual que antes. Un descanso mal escrito se IGNORA en vez de romper el día. |
| **830** | **El fósil y los otros tres motores.** Hay CINCO implementaciones del cálculo de huecos. El horario del médico se copiaba al darlo de alta y no se volvía a escribir nunca —no hay editor por médico— y aun así los cuatro caminos la preferían: **todo cambio de horario decía «guardado» y no llegaba a la agenda**. El bot tenía su propia copia (ofrecía la comida, escondía huecos libres, no revalidaba al confirmar). El POST del portal aceptaba lo que el GET ya no ofrecía. |
| **831** | **La IA cobraba lo que no daba.** «Agregar análisis a la nota» NO ha funcionado nunca (`res.json()` sobre NDJSON) y cobraba 4 créditos por clic. El consultor cobraba aunque el proveedor fallara. Dos rutas llamaban al modelo sin mover el contador → el corte no podía dispararse. La ruta de la nota esquivaba la cartera (doble gasto). |
| **832** | **Alergias y dosis.** «Niega alergia a penicilina» bloqueaba la firma. La compuerta por nombre exacto estaba muerta (`tipo` que nadie escribe). El peso tecleado no llegaba a la verificación mg/kg. «45 mg/kg» se leía como 45 mg. El parser local inventaba vía y severidad. Ya queda constancia del consentimiento de grabación y de quién toca las alergias. |
| **833** | **ARCO a medias.** La supresión dejaba vivas las subcolecciones (versions, adendas, laboratorios, fotos, clinico) diciendo «se elimina el expediente completo». El bloqueo no bloqueaba nada. El fallo de la baja de WhatsApp se tragaba respondiendo «listo». La solicitud legal seguía en «recibida». |

**Módulos nuevos**: `lib/horario-medico.ts`, `lib/ndjson.ts`.
**Pruebas**: 4463 → 4493. Lint en el techo (99) en todas.

## COLA CONFIRMADA, PENDIENTE (por orden de daño)

1. **`BLOQUEA_RECETA` se lo come zod** — el esqueleto de `SafetyBlock`
   (`extraction-schema.ts:83`) no declara `alergia_conflicto`, así que la bandera
   nunca sale del servidor por la ruta de la nota. Por la del NER sí llega, pero
   sólo pinta una tarjeta: `entidades` no se lee en el guardado ni en la receta.
2. **Procedencia sella como «dictado» sin verificar la cita** — basta una cadena
   no vacía (`procedencia.ts:101`). El emparejamiento de medicamentos es por
   NOMBRE pero el valor sellado incluye la dosis: el médico corrige la dosis y
   queda sellada como dictada con la cita original. Y en el fallback local todo
   sale como `manual`, o sea «lo escribió el médico», sobre datos de máquina.
3. **La página de verificación afirma «no fue alterado» sin comparar nada**
   (`verificar/[token]/page.tsx:58`). Sólo muestra el hash. Y el QR puede
   arrastrar el hash viejo si se imprime justo tras corregir una dosis.
4. **Un fallo de PubMed es indistinguible de «no hay literatura»** —
   `pubmed.ts:97` devuelve `[]` en el 429. El médico lee «no hay evidencia».
5. **`corregirViaParenteral` sólo existe en el papel** — la nota firmada conserva
   la vía equivocada y `medicamentosVigentes` la propaga (`receta/page.tsx:226`).
6. **El ciclo de vida de la orden de medicamento no tiene escritores** — nada
   asigna `suspendida/terminada/cancelada`, así que «Está tomando» es en realidad
   «todo lo que alguna vez apareció en una nota». NEEDS_CLINICAL_REVIEW: ¿una
   duración cumplida pasa a terminada sola?
7. **La firma no da no repudio** — hora e identidad las pone el cliente y las
   reglas no exigen `metadata.medicoId == request.auth.uid` (`firestore.rules:212`).
   Las adendas se autoatribuyen y el motivo es opcional.
8. **Laboratorios y fotos se borran desde el navegador sin dejar rastro**
   (`firestore.rules:240,249`), contra la conservación que promete el aviso.
9. **La cola de bitácora se atribuye a quien entre después** — el asiento se
   encola sin identidad y se drena con el token del siguiente usuario.
10. **El portal público no escribe el aviso de privacidad en el paciente** —
    dos booleanos en la cita, sin versión ni huella (`public/booking:253`).
11. **La verificación de la nota se recorta a 12 000 chars sin marca** y puede
    devolver «sin hallazgos» sobre lo que no leyó (`verificar-nota:69`).
12. **Los bloqueos se guardan con la zona del navegador**, no la del consultorio
    (`configuracion/page.tsx:1991`).
13. **El portal público decide los días con tres relojes** y ninguno es el del
    consultorio: un paciente en otro huso pierde un día entero sin aviso.
14. **El Consultor manda el NOMBRE del paciente al proveedor** y lo persiste vía
    `extraerAprendizajes` (`consultor/page.tsx:63`).
15. **Festivos no editables ni recurrentes** — se leen en cuatro sitios y no se
    escriben en ninguno: la lista está siempre vacía.


## SEGUNDA TANDA DE LA NOCHE — v834 a v839

| v | Qué se reparó |
|---|---|
| **834** | Zod se comía `safety.alergia_conflicto` (el prompt lo pedía desde siempre) → se leía como «el modelo no vio nada». La vía se corregía sólo en el papel, no en la nota firmada. El QR podía certificar la versión anterior. La página de verificación afirmaba «no fue alterado» sin comparar nada. Un 429 de PubMed se leía como «no hay evidencia». |
| **835** | **El sello de procedencia mentía en las dos direcciones**: bastaba una cadena no vacía para sellar un campo como «dictado» y mostrar la frase entrecomillada como literal; y un valor que el médico corrigió seguía diciendo «dictado» con la cita original. Sin extracción, todo salía como «manual» aunque lo hubiera escrito el parser local — que además se atribuía a Opus. |
| **836** | La segunda opinión recortaba a 12 000 caracteres **sin marca** y podía decir «sin hallazgos» sobre lo que no leyó. Los bloqueos se guardaban con la hora del navegador. El portal armaba los días con el reloj del paciente. El Consultor mandaba el nombre del paciente al proveedor. |
| **837** | Festivos editables y **recurrentes** (`MM-DD`): la lista se leía en cuatro sitios y no se escribía en ninguno. El portal público ya escribe el aviso de privacidad en el expediente, con versión y huella, igual que el alta desde el consultorio. |
| **838** | Los asientos de bitácora encolados sin red **se firmaban con el nombre de quien entrara después** en ese equipo. Y `asientosPendientes()` no lo mostraba ninguna pantalla. |
| **839** | **Cualquier médico podía firmar una nota con la cédula de otro** (`firestore.rules`). Las adendas —el único mecanismo de corrección sobre un documento inmutable— se creaban sin acreditar autor ni motivo. Reglas desplegadas aparte. |

**Módulos nuevos**: `lib/horario-medico.ts`, `lib/ndjson.ts`, `esFestivo` en
`lib/availability.ts`, `asientosDeOtros` en `lib/expediente/audit-log.ts`.

**Pruebas**: 4463 → 4501 · emulador 100 → 101 · **techo de lint apretado de 99 a 98**.

## LO QUE QUEDA DE LA COLA (verificado, sin tocar)

1. **Laboratorios y fotos se borran desde el navegador sin dejar rastro**
   (`firestore.rules:240,249`), contra la conservación que promete el aviso. Hace
   falta decidir si se prohíbe desde el cliente o se exige motivo.
2. **El ciclo de vida de la orden de medicamento no tiene escritores** — nada
   asigna `suspendida/terminada/cancelada`, así que «Está tomando» es en realidad
   «todo lo que alguna vez apareció en una nota». **NEEDS_CLINICAL_REVIEW**:
   ¿una duración cumplida pasa a `terminada` sola, o exige acto médico?
3. **El header de la consulta no muestra problemas activos ni última visita**
   (P-005 del V6). Los medicamentos vigentes ya están (v828).
4. **`BLOQUEA_RECETA` del NER sigue sin gatear nada** — el estado `entidades` no
   se lee en el guardado ni en la receta, y el NER es un botón manual.
5. **Sucursales decorativas** (`branchId` no lo escribe ninguna interfaz).
6. **Google Calendar unidireccional** — no hay `freebusy`.
7. **`timeToFirst*` del onboarding** y los **cuatro tableros** de P-022.
8. **`BillingEngine`/`StripeAdapter`** (P-012) — sólo si sobra tiempo: hoy funciona.


## TERCERA TANDA — v840 a v844 (madrugada del 2)

| v | Qué se hizo |
|---|---|
| **840** | **«¿Qué tiene?»** — el encabezado de la consulta ya dice problemas activos y última visita, con la misma regla del silencio que la medicación (no mencionar no resuelve). Lo crónico va primero; el CIE-10 manda sobre el texto. **Verificado en producción con Chrome**, sin errores de consola. Y borrar un laboratorio o una foto ya deja rastro. |
| **841** | El `timeToFirst*` del charter **ya se calculaba** en `lib/onboarding/embudo.ts` y no lo pintaba nadie. Segunda corrección de mi propio mapa del V6 en vez de escribir un duplicado. |
| **842** | **Tablero técnico**: latencias p50/p95/p99, la peor y tasa de fallo, por operación y por modelo. Los datos llevaban meses en cada asiento del libro de costos, sin leer. Tres percentiles y no uno: con 5 lentas de 105 el p95 aún cae en la zona rápida. |
| **843** | **Tasa de bajas** al lado del MRR. Primero hubo que poder medirla: al cancelar sólo se escribía `status: 'cancelled'`, sin fecha. El denominador es quien PODÍA irse. Sin base dice «sin base», no 0 %. |
| **844** | La corrección por voz podía devolver una nota **mutilada** (la segunda opinión de GPT no se validaba contra el esquema). Y el cruce alergia↔medicamento no veía el último tercio de una consulta larga: la ruta aceptaba 20 000 caracteres y el prompt recortaba a 12 000 en silencio, dejando el panel vacío. |

**Estado del V6 (mío)**: P-002, P-003, P-005, P-007, P-008, P-009, P-021 y P-022
cerrados. **P-012 (`BillingEngine`) NO se hizo a propósito**: el ciclo de vida ya
está reparado y probado; extraer la abstracción sin un segundo proveedor de pago
es mover código que funciona.

**Pruebas**: 4463 → 4530 · emulador 101 · lint 99 → 98.

| **845** | **Suspender es un acto, no un olvido.** El ciclo de vida de la orden existía en el modelo y no lo escribía nadie: «Está tomando» era «todo lo que alguna vez apareció en una nota». Cada fármaco lleva un «ya no» con dos opciones (se suspende / ya terminó) y **motivo obligatorio**. No se edita el pasado: se escribe en la nota de hoy. Y lo suspendido **no se receta**. Verificado en producción sin errores de consola. |

| **846** | **Un campo que decía `BLOQUEA_RECETA` y no bloqueaba nada.** El estado con las entidades del NER no se lee en el guardado ni en la impresión, así que sólo pintaba una tarjeta roja — y la documentación afirmaba que «el frontend NO permite firmar». Ahora se llama `RIESGO_MAXIMO` y la tarjeta dice quién detiene de verdad la firma. |
| **847** | **La API aceptaba `branchId` y no lo miraba nadie.** Se guardaba, pero el motor de agenda no particiona por sede: dos sucursales compartían una agenda mientras el cliente recibía 200. Aceptar un campo que se ignora es prometer una función que no existe. |

**Sigue siendo del Dr. (P-008)**: si una `duracion` cumplida debe pasar sola a
`terminada` o exige acto médico explícito. Hoy exige acto explícito, que es la
opción que no inventa nada.

| **848** | **Google Calendar deja de ser unidireccional.** Una cirugía puesta en Google el jueves de 8 a 12 seguía ofreciéndose a los pacientes. **Y NO hacía falta ampliar el permiso** —como yo había apuntado aquí—: el alcance que ya se concede incluye `freebusy`. Se pregunta sólo por intervalos (sin títulos ni asistentes), se convierte a bloqueos —el idioma que el motor ya habla— y el bloqueo lleva el `medicoId` del dueño del token. Si la consulta falla, se dice en pantalla. |

| **849** | **La próxima consulta.** El motor de tareas sabía derivar «agendar el seguimiento» desde que se escribió, y el CRM cuenta «seguimientos vencidos» sobre `patient.proximoSeguimiento`: **un campo que no escribía nadie**. La tarea no nacía y el contador era cero permanente. Ahora la consulta lo pide (opcional) y al firmar alimenta las dos. **NO va dentro de la nota firmada**: es dato de agenda, no afirmación clínica, y meterlo obligaría a subir la versión del sello de integridad. |

| **850** | **En una consulta normal no salía NINGÚN pendiente de estudios.** `/pendientes` promete que «salen solos al firmar», pero el motor los deriva de `nota.estudiosOrden` y ese campo sólo lo llena la Valoración del inmunocomprometido: en una consulta corriente el médico elige los estudios en **Orden Médica**, imprime, y esa pantalla nunca escribía de vuelta. Ahora los pendientes nacen al **emitir** la orden —entregarla es un hecho, marcar casillas es una idea— y reimprimir **no duplica**: las tareas con `notaId` van con id derivado, y el `merge` no pisa el estado si el médico ya la movió. |

## LO QUE QUEDA EN LA COLA (nada de esto es urgente)
- **Fragmentación cromática**: 160 de 187 `.tsx` con estilo en línea.
- **Formularios previos a la consulta** en el portal del paciente (P-019).
- ~~Próxima cita al motor de tareas~~ — HECHO (v849).
- **Instrucciones al paciente (P-010)**: el tipo de tarea `indicacion_paciente`
  existe y `/pendientes` sabe etiquetarlo, pero **nada lo crea**, y lo dejo así a
  propósito. Las indicaciones se escriben dentro del plan, que es obligatorio en
  todas las notas: derivar de ahí pondría una tarea en CADA consulta y el
  worklist se abandonaría en una semana. Falta una **decisión de producto**: qué
  acto concreto significa «hay indicaciones que entregar» — ¿imprimir una hoja
  para el paciente? ¿marcarlo a mano? Queda declarado en `modelo.ts` para que
  nadie lo dé por hecho al leer el tipo.
- **`PlanVersion`/`LegacyPlan`/`OverageRule`/`Addon`/`Discount`** del motor de
  precios (P-013).


## CUARTA TANDA — v851 a v852 + AUDITORÍA DE LOS MÓDULOS QUE FALTABAN

Tres auditores nuevos sobre lo que no se había mirado en toda la noche:
**hospitalización/UCI**, **farmacia y dinero del consultorio**, y **portal del
paciente + mensajería**. ~36 hallazgos con archivo:línea.

| v | Qué se reparó |
|---|---|
| **851** | **El paciente podía borrar el estado «pagada» de su cita con un toque.** El portal sólo bloqueaba los estados terminales: una cita `pagada` o `pendiente-pago` pasaba a «confirmada» desde el enlace, y salía del control de cobro. Igual con `en-sala`/`en-consulta`. Ahora es **lista blanca** —con lista negra, cada estado nuevo nace tocable— y una cita **con cobro** ya no se cancela ni se reagenda desde el portal. Confirmar sí: no mueve el hueco ni el dinero. |
| **852** | **Un anticipo saldaba una consulta que nadie había tasado.** Sin tarifa fijada, el checkout escribe el anticipo en `pagoMonto` y el webhook lo comparaba contra sí mismo: «cubre» → cita **pagada** → el resto no se reclamaba en ninguna pantalla. El comentario del propio webhook ya decía lo correcto y el código hacía lo contrario. El saldo queda en «no se sabe», no en cero. |

## QUINTA TANDA — v853 a v854 (dinero del consultorio)

| v | Qué se reparó |
|---|---|
| **853** | **El mismo médico con DOS identificadores partía la comisión en dos.** Desde Citas viajaba el id del documento de `doctors`; desde Consulta, el `uid`. El reparto agrupa por `medicoId`, así que la misma doctora salía en dos filas y media comisión se pagaba al 0 %. Se resuelve **en el origen** (`registrarCobro`), nunca adivinando: ante ambigüedad queda `sin-resolver` y se conserva lo que venía — atribuir mal se paga en silencio a quien no era. Los cobros anteriores siguen como estaban, y el panel **avisa** antes de pagar. |
| **854** | **Una consulta ya pagada aparecía como deuda.** El corte carga los cobros del DÍA, así que un anticipo pagado el viernes para la cita del lunes la dejaba en «cuentas por cobrar». Ahora manda `cita.cobroId`, que sólo escribe un cobro de cierre y se limpia al anular. |

## SEXTA TANDA — v855 a v856 (UCI y farmacia)

| v | Qué se reparó |
|---|---|
| **855** | **Un reingreso a terapia borraba la estancia anterior.** `ICUStay` vivía en un id fijo y reabrirlo lo sobreescribía, mientras el tipo prometía que «cada estancia se conserva». La que se cierra se **archiva** con id derivado de su fecha de ingreso —no aleatorio: una transacción se reintenta y con id al azar el historial diría que hubo un reingreso que nunca ocurrió—. `actual` sigue siendo el puntero a la vigente, así que ningún lector migró. Y **egresar también cierra la estancia**: antes sólo la cerraba el traslado a piso, así que quien fallecía o salía del hospital desde UCI la dejaba activa para siempre. |
| **856** | **Farmacia: tres contadores que mentían.** «Eliminar» no eliminaba nada visible (`soloActivos = false`). «Bajo stock: 0» con el anaquel vacío, porque exigía un mínimo capturado que el formulario deja en blanco. Y la caducidad se evaluaba en UTC: un lote que vence el 2 salía caducado desde las 18:00 del 1. |

## SÉPTIMA TANDA — v857 (el corte que cambiaba sin explicar)

| v | Qué se reparó |
|---|---|
| **857** | **Un corte reimpreso bajaba de total sin una sola nota.** Anular un cobro no tiene restricción de fecha —se anula el jueves uno del lunes— y la pantalla excluía los anulados: el corte del lunes reimpreso daba otro número y nadie podía saber qué cambió. Ahora se listan **aparte**, con motivo y fecha de anulación, sin entrar en ningún total. Y el KPI **«Reembolsos» estaba condenado a $0.00** (los negativos se rechazan en el origen y la devolución no existe como operación): ese cero se leía como «no hubo devoluciones». Ahora dice **«Anulados»**, que es lo que de verdad baja el día. Verificado en producción. |

## LO QUE ENCONTRARON LOS AUDITORES Y NO ESTÁ REPARADO

Por orden de daño. Todo con archivo:línea, verificable.

### Dinero
1. ~~Dos identificadores de médico~~ — HECHO (v853). Queda pendiente decidir si
   se **migran los cobros viejos**: hoy el panel los señala, pero no los une.
2. ~~Consultas pagadas como cuentas por cobrar~~ — HECHO (v854).
3. ~~Anular reescribe un corte cerrado sin nota~~ — HECHO (v857).
4. ~~«Reembolsos $0.00»~~ — HECHO (v857): ahora dice «Anulados».
5. **Un cobro suelto no tiene médico** → cae en `sinAtribuir` y desaparece del
   desglose (`CobrarModal.tsx:126`).

### Farmacia
6. ~~«Eliminar» no elimina nada visible~~ — HECHO (v856).
7. ~~«Bajo stock: 0» con el anaquel vacío~~ — HECHO (v856).
8. **La farmacia es una isla**: dispensar no descuenta ni cobra, `patientId` y
   `notaId` del movimiento no los escribe nadie (NOM-220 lote→paciente), y
   `listarMovimientos` no tiene ni una pantalla que lo llame.
9. ~~Caducidad evaluada en UTC~~ — HECHO (v856).

### Hospital / UCI
10. ~~Un reingreso borra la estancia anterior~~ — HECHO (v855), junto con el
    cierre de la estancia al egresar (punto 10 del informe de UCI).
11. **La limpieza terminal no se aplica al EGRESO**, sólo al traslado: la cama
    cuenta como disponible en el mismo instante del alta.
12. **El turno de enfermería de UCI oculta pacientes** de una unidad sin tipo
    configurado y afirma «no hay nada pendiente» (`uci/enfermeria/page.tsx:51`).
13. **Las tomas de UCI se firman con el nombre del médico tratante**, no de quien
    las captura, y con el reloj del navegador (`uci/page.tsx:485`). Es el mismo
    defecto que ya se reparó en el MAR.
14. **La entrega de turno afirma ausencias que nadie puede desmentir** («no hay
    dispositivos invasivos registrados» en un paciente con catéter y VM) porque
    la fuente no existe (`ResumenPase.tsx:92`), y `marcarRevisado` no tiene
    llamador: el estado REVISADO es inalcanzable.

### Portal y mensajería
15. **El enlace mágico no se puede revocar** ni caduca antes de 30 días
    (`lib/patient-token.ts:85`): quien lo tenga lee citas y motivo, y puede
    cancelar y reagendar.
16. **El recordatorio promete «Responde SÍ para confirmar»** y nada lo
    implementa (`cron/reminders/route.ts:146`): el bot contesta el menú.
17. **Lista de espera**: «responda NO y le quitamos de la lista» no da de baja, y
    quien no contesta queda marcado `contactado` y **nunca vuelve a recibir otra
    oferta** (`waitlist-notify:159`).
18. **El detector de FAQ secuestra las confirmaciones**: «sí, esa **hora** me
    sirve» responde el horario de atención y pierde el hueco (`webhook:305`).
19. **«Mis recetas» del portal imprime "Invalid Date" y el botón Descargar no
    descarga** (`mi/[token]/page.tsx:62`, formato ISO vs. `YYYY-MM-DD HH:MM`).
20. **«Pagar anticipo · Asegura tu lugar» no asegura nada**: abre un enlace
    externo suelto sin retorno ni registro; la ruta que sí lo registraría no
    tiene ni un llamador.
21. **Aviso de lista de espera desde el modal sin `medicoId`** → la cita se
    agenda con el médico equivocado (`AppointmentModal.tsx:308`).
