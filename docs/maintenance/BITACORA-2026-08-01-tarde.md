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
13. ~~Anual que acaba en mensual~~ — HECHO (v814) **y el 2º camino también**:
    verificado el 2026-08-02 en `configuracion/page.tsx:startCheckout` — el
    `ciclo` YA viaja (`ciclo: cicloActual`), con el porqué escrito al lado.
14. ~~Recarga sin créditos~~ — HECHO (v813). Antes: (`ai-keys.ts:205` se traga
    su propio error y el webhook responde 200).
15. ~~Los metadatos de Stripe quedan congelados~~ — HECHO (v825 + v870): manda el
    COBRO, y el metadato se corrige en Stripe cuando el plan se supo por el precio.
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

### 2. ~~Los envíos de WhatsApp se pierden sin dejar rastro~~ — HECHO
Verificado el 2026-08-02: el helper `send()` del webhook registra el fallo en
`no-entregados` para las 42 llamadas (se arregló en el helper, no en 42 sitios),
y `public/booking` ya no se traga la confirmación. Lo de abajo es el diagnóstico
original, se conserva por contexto.

<details><summary>Diagnóstico original</summary>

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
</details>

---

## CUADRAGÉSIMA OCTAVA TANDA — v899

### El calendario de Google de los que YA estaban conectados seguía suelto

v875 empezó a escribir el vínculo `médico ↔ uid` **al conectar** Google, y
v876/v877 lo consumieron para que el portal público y el bot descuenten los
eventos del calendario al ofrecer huecos.

Eso sólo cubre a quien **conecte de ahí en adelante**. El que ya estaba
conectado no tiene vínculo: su pantalla dice «Conectado» con su palomita verde,
y la agenda pública sigue ofreciendo huecos encima de su quirófano. Es peor que
el fallo original, porque ahora es invisible — y **nadie va a reconectar por su
cuenta algo que no sabe que le falta**.

Ahora se rellena solo la próxima vez que abre su configuración: esa ruta la
llama su propia sesión, que es justo el momento en que se sabe con certeza quién
es. Con las MISMAS reglas —correo exacto, un solo candidato, si hay duda no se
adivina— y en un solo módulo compartido con el momento de conectar
(`lib/calendario/ligar-en-servidor.ts`), para que afinar una no deje la otra atrás.

Dos cuidados: un vínculo que YA existe **no se recalcula** (moverlo sería
reasignar las horas ocupadas de un médico a otro sin que nadie lo pidiera), y el
relleno **nunca crea** el documento del token: si no hay calendario conectado, no
hay nada que ligar.

Y si aun así no se puede ligar, la pantalla lo **dice, con la consecuencia**:
«un paciente puede reservar encima de algo que ya tienes apuntado», en vez de
dejar la palomita verde prometiendo una cobertura que no existe.

- `src/lib/calendario/ligar-en-servidor.ts` (nuevo), `vinculo-medico.ts`
  (`estadoDelVinculo`, `AVISO_SIN_VINCULO`)
- `src/app/api/calendar/status/route.ts`, `callback/route.ts` (ahora comparten resolvedor)
- `src/app/(dashboard)/configuracion/page.tsx` (el aviso)
- `src/__tests__/vinculo-relleno.test.ts` — 10 pruebas. Total 4779.

---

## CUADRAGÉSIMA NOVENA TANDA — v900

### El color de fondo y borde tampoco cambiaba de tema — y al imprimir salía el de la pantalla

v872 migró los 124 usos de **primer plano** a `--red`/`--amber` y dejó un
trinquete en cero. Los MISMOS colores escritos como `rgba()` para fondos y
bordes se quedaron: **277 sitios en 69 pantallas**.

No rompen el contraste del texto —son capas al 8-12 %— pero comparten la raíz:
un literal no cambia de tema, así que el aviso rojo que en oscuro se lee como
una capa tenue, en claro se ve **exactamente igual de tenue** sobre el fondo
crema y deja de leerse como aviso. Ahora son
`color-mix(in srgb, var(--red) N%, transparent)`, que sí sigue el tema, y el
trinquete tiene un **segundo techo, también en cero**.

El papel se queda con su hexadecimal a propósito: la receta se rasteriza con
html2canvas sobre un clon del nodo y una variable que no resuelva ahí deja sin
color justo lo que existe para verse.

### Y un fallo que encontré al hacerlo: la impresión no fijaba los colores clínicos

La regla `@media print` ponía el fondo blanco y el texto negro, pero **no tocaba
`--red`/`--amber`/`--green`/`--blue`**. Un médico que trabaja en modo oscuro
imprimía sus alertas con el rojo pensado PARA fondo oscuro sobre papel blanco:
el mismo problema de contraste que los tokens vinieron a resolver, sólo que en
la hoja, que es donde ya no se puede corregir. Ahora la impresión fija los
cuatro en los valores del tema claro.

- 69 archivos `.tsx` (fondos y bordes), `src/app/globals.css` (`@media print`)
- `src/__tests__/color-trinquete.test.ts` — segundo techo + prueba de impresión.
  Total 4781.
- De paso: `pacientes/page.tsx` tenía un naranja `#fb923c` en primer plano que
  el trinquete no veía porque no estaba en su lista. Ahora es `--amber`.

---

## QUINCUAGÉSIMA TANDA — v901

### Cuando el paciente reagendaba o cancelaba, el calendario del médico se quedaba como estaba

El paciente movía su cita de martes a jueves desde su enlace: Nexus decía jueves
y el calendario del consultorio —y el del paciente, si estaba invitado— **seguía
diciendo martes**. Cancelaba, y el evento se quedaba vivo: el médico veía ocupada
una hora que ya estaba libre, no se la ofrecía a nadie, y el paciente seguía
recibiendo el recordatorio de una cita que ya había cancelado.

No se sincronizaba **a propósito**, y el motivo estaba escrito ahí mismo: el
token de Google vive por `uid` y quien reagenda es el paciente, así que no había
forma de saber cuál de los médicos conectó ese calendario — y escribir en el
equivocado le mete una cita ajena en su agenda a otro médico y le borra la suya.

**Ese motivo dejó de ser cierto.** v875 empezó a escribir el vínculo
`doctors/{id}.uid`, v899 lo rellenó para los que ya estaban conectados, y desde
v876 la disponibilidad pública ya LEE el freebusy con él. Ahora se usa el mismo
vínculo para escribir.

Sigue sin adivinarse nada: sin vínculo no se toca ningún calendario, sin evento
no se inventa uno, el portal mueve y borra pero **nunca da de alta**, y un fallo
de Google no tumba lo que el paciente ya hizo —la cita ya está en Nexus, que es
la fuente de verdad—, sólo queda marcada.

### Y un hallazgo de paso: un estado fuera de su propia unión

El portal escribía `googleCalendarSyncStatus: 'desincronizado'`, y el tipo
declara `'pending' | 'synced' | 'error'`. El SDK de admin no tipa `update()`, así
que nadie se quejó — pero **ningún lector que compare contra la unión declarada
podría reconocer ese valor nunca**. Era una marca que no podía leerse, en un
campo que hoy tampoco lee ninguna pantalla.

- `src/lib/calendario/sincronizar-servidor.ts` (nuevo)
- `src/app/api/portal/route.ts` (reagendar y cancelar)
- `src/__tests__/sincronizar-portal.test.ts` — 10 pruebas. Total 4791.

---

## PENDIENTE — cola priorizada (mía)

1. ~~`priceIdDe` cae de anual a mensual en silencio~~ — HECHO. **`priceIdDe`** — `src/lib/stripe.ts:50`:
   `STRIPE_PRICES_ANUAL[plan] || STRIPE_PRICES[plan]`. Si falta la variable del
   precio anual, el cliente compra «anual» y Stripe abre una suscripción MENSUAL,
   con los metadatos diciendo `ciclo: 'anual'`. Nadie se entera hasta el 2º cargo.
2. ~~`planPorMonto` se equivoca con las anuales~~ — HECHO (v870). **Era** — `src/app/api/stripe/webhook/route.ts:71`:
   los cortes están en centavos de plan MENSUAL. Una anual de Agenda (~349000)
   devuelve `'hospital'`. Sólo se dispara si falta `metadata.plan`.
3. ~~`items.data[0]` no tiene orden garantizado~~ — HECHO (y v870 añadió los price ids anuales al conjunto). **Era** — mismo archivo, `:309`. Con un
   ítem de asiento en la suscripción puede ser el precio del médico extra.
4. **Prueba de 14 días en CADA checkout** — `src/app/api/stripe/checkout/route.ts:84`,
   incondicional: cancelar y volver a suscribirse los renueva.
5. ~~`asientos` marca médicos contratados sin cobrarlos~~ — HECHO (409 explicando por qué). **Era** — `src/app/api/stripe/asientos/route.ts:82`.
6. ~~`invoice.paid` sin clínica guarda `clinicId: ''`~~ — HECHO: se marca `huerfano: true`.
7. ~~Las reglas dejan reatribuir `medicoId` al vincular factura~~ — HECHO: `medicoId`, `medicoNombre`, `referenciaExterna` y `folio` congelados. **Era** — `firestore.rules:611`,
   lo que mueve el reparto de comisiones.
8. ~~logAudit en silencio~~ — HECHO (v824). — `src/lib/expediente/audit-log.ts:84`.
9. ~~El portal ARCO público no verifica identidad~~ — HECHO (v871): no puede
   ligar expediente ni declararse verificado, y el panel lo declara. La
   verificación en sí sigue siendo un acto humano de la clínica, como manda el
   Art. 29 LFPDPPP.
10. ~~Horario partido / descansos / festivos recurrentes~~ — HECHO (v829):
    `DaySchedule.descansos` existe y los festivos aceptan `MM-DD` recurrente, con
    su editor en Configuración. Verificado el 2026-08-02.
11. **Las sucursales son decorativas en la agenda** — `branchId` está en la lista blanca
    pero ninguna interfaz lo escribe y ni `getAvailableSlots` ni `hasConflict` lo miran.
12. **Google Calendar: freebusy sólo en el modal del consultorio** — HECHO A
    MEDIAS. `api/calendar/ocupado` existe y lo consume `AppointmentModal`, que
    además DECLARA si la consulta falló. **Queda**: el portal público, el bot y
    el reagendado del paciente NO lo consultan, así que un paciente puede
    reservar encima de un evento de Google. Motivo real, no pereza: el token es
    por `uid` (`googleTokens/{uid}`) y los caminos públicos no tienen sesión ni
    forma fiable de mapear `medicoId` → `uid`. **v875 escribió ese vínculo** al
    conectar el calendario (`doctors/{id}.uid` + `googleTokens/{uid}.medicoId`),
    que era el prerrequisito, y **v876 lo consumió**: la disponibilidad pública
    descuenta el freebusy del médico, el alta lo revalida y **v877 llevó lo mismo
    al bot**, con la consulta en un solo módulo. **v899 cerró el hueco de los ya
    conectados**: el vínculo se rellena solo la próxima vez que el médico abre su
    configuración, con las mismas reglas, sin recalcular uno existente y
    diciéndoselo si no se pudo.
    **v901 cerró lo que faltaba**: el portal ya mueve y borra el evento de Google
    al reagendar y cancelar, con ese mismo vínculo. **Queda**: ninguna pantalla
    LEE todavía `googleCalendarSyncStatus`, así que una cita marcada en `error`
    no se le enseña al médico en ningún lado.
13. ~~Fragmentación cromática~~ — HECHO (v872 + v900): los 124 usos de PRIMER
    PLANO migrados a `--red`/`--amber` con trinquete en 0, y **v900 migró los 277
    de FONDO y BORDE** a `color-mix` con el token, con su propio techo en 0. El
    papel conserva el hexadecimal a propósito. v900 además hizo que `@media print`
    fije los colores clínicos en los valores del tema claro.
14. ~~`BLOQUEA_RECETA` promete una barrera que no existe~~ — HECHO: se llama
    `RIESGO_MAXIMO` y el comentario dice qué es y qué no; la compuerta real es el
    motor determinista. Y `alergia_conflicto` ya está en el esquema zod, así que
    el aviso sí sale del servidor. Verificado el 2026-08-02.
15. ~~Textos clínicos sin fuente~~ — HECHO A MEDIAS (v873): la cita ya se
    ENSEÑA en el panel, en la nota y en el HTML, y su ausencia se declara.
    **Queda, y es del Dr.**: las 42 recomendaciones de
    `src/lib/inmuno/recomendaciones.ts` sin fuente. Yo no las invento.

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

## OCTAVA TANDA — v858 a v859 (farmacia y las promesas al paciente)

| v | Qué se reparó |
|---|---|
| **858** | **La farmacia deja de ser una isla sin memoria.** El libro de movimientos era de **sólo escritura** —`listarMovimientos` no lo llamaba ninguna pantalla— y ya se abre desde cada ítem. El `patientId` iba **siempre vacío** pese a que el módulo invoca la trazabilidad lote→paciente de la NOM-220: ahora la dispensación pide a qué paciente, y en un **controlado es obligatorio**. Y tirar un lote vencido era indistinguible de dispensarlo: se separan *dispensado / caducó / merma*. |
| **859** | **Tres promesas al paciente que el código no cumplía.** El recordatorio dice «Responde SÍ para confirmar» y **nada lo implementaba** (el bot contestaba el menú); ahora el envío deja la sesión esperando esa respuesta con la cita concreta, y va **antes** del detector de FAQ porque «sí, esa *hora* me sirve» se lo quedaba. «Responda NO y le quitamos de la lista» **no daba de baja a nadie**. Y quien recibía una oferta y no contestaba quedaba `contactado` y **no volvía a recibir ninguna nunca**. Además «Mis recetas» imprimía «Invalid Date» y Descargar lanzaba un error que el paciente no veía. |

## NOVENA TANDA — v860 (el enlace del paciente)

| v | Qué se reparó |
|---|---|
| **860** | **El enlace del portal no se podía revocar, y duraba 30 días.** Firmado y con fecha, no había forma de invalidar uno ya emitido: teléfono perdido, número reciclado o mensaje reenviado valían hasta caducar — y ese enlace da acceso a las citas del paciente (motivo incluido, que es texto clínico) y permite cancelar y reagendar. Ahora el expediente lleva un **contador de versión**: subirlo tumba de golpe todos los enlaces de ese paciente, desde un botón en su expediente. TTL de 30 → **7 días**, y el mensaje ya le advierte que es personal y caduca. Botón verificado en producción. |

## DÉCIMA TANDA — v861

| v | Qué se reparó |
|---|---|
| **861** | **«Pagar anticipo · Asegura tu lugar» no aseguraba nada**: abría un enlace externo suelto, sin retorno, sin webhook, sin cambio de estado y **sin cobro registrado** — y el importe del cartel podía no ser el que cobraba el enlace. La ruta que sí lo registra existía y **no la llamaba nadie**. **El aviso de lista de espera desde el modal iba sin `medicoId`**: el hueco liberado por una doctora se agendaba con otro médico. **La cama del alta no pasaba por limpieza terminal** —el bloque estaba condicionado al traslado— y contaba disponible en el mismo instante del alta. |

## UNDÉCIMA TANDA — v862 (lo que la UCI afirmaba sin saberlo)

| v | Qué se reparó |
|---|---|
| **862** | **Las tomas del pase se firmaban con el nombre del médico tratante** aunque las capturara otra persona —y en blanco si fallaba la lectura del internamiento—: el mismo defecto ya reparado en el MAR. Ahora el autor lo sella la sesión, con `uid`, y la hora del **servidor** va al lado de la del dispositivo. **La entrega de turno imprimía «No hay dispositivos invasivos registrados»** en un paciente con catéter y ventilador, porque esa sección no tiene quién la alimente: una sección declarada **sin fuente** ya dice que el sistema no lo sabe. **El turno de enfermería ocultaba pacientes** de una unidad sin tipo configurado y afirmaba que no había nada pendiente. |

## DUODÉCIMA TANDA — v863 (lo que el portal no le contaba a nadie)

| v | Qué se reparó |
|---|---|
| **863** | **Cancelar o reagendar desde el enlace del paciente mutaba el estado y ahí terminaba todo.** El hueco liberado **no se le ofrecía a nadie**: la oferta vivía dentro de `api/whatsapp/waitlist-notify`, detrás de `verificarMiembro`, así que sólo el consultorio podía dispararla — y justo la cancelación del paciente es la que nadie del equipo ve. Ahora vive en `src/lib/whatsapp/ofrecer-hueco.ts` y la llaman los dos caminos, con el `medicoId` (sin él, el hueco de una doctora se le ofrecía a quien espera con otro). **No quedaba asiento en la bitácora** aunque el estado se mutara con `updatedPor: 'paciente'` (NOM-024): ambas acciones escriben ya el de/a en `audit_log`. Y **fuera de la ventana de 24 h sin plantilla HSM** el mensaje se descartaba en silencio mientras el contador decía «notificados N»: ahora cuenta como omitido y se registra como no entregado con su motivo. |

## DECIMOTERCERA TANDA — v864 (lo que se perdía sin que nadie lo viera)

| v | Qué se reparó |
|---|---|
| **864** | **Un cobro suelto no era de nadie.** Abierto desde Finanzas no hay cita de la que sacar el médico y el modal tampoco preguntaba: el cobro caía en la fila «sin atribuir» del reparto de comisiones — dinero cobrado y depositado que al repartir no es de nadie, y que nadie reclama porque no aparece en la fila de ningún médico. Con un solo médico no se pregunta (es suyo); con varios se pregunta y es obligatorio, sin preseleccionar al primero de la lista (`lib/finanzas/cobro-suelto.ts`, 6 pruebas). **Cancelar desde el enlace no contaba como cancelación**: `cancelacionCount` alimenta el riesgo de no-show y el CRM, el menú de Citas sí lo incrementa y el portal no — el motor veía a un paciente impecable. **El alta pública le servía el error crudo a cualquiera**: `String(err)` con nombres de colecciones, rutas de documentos y mensajes del Admin SDK, a internet abierto y sin sesión. |

## DECIMOCUARTA TANDA — v865 (dos formas de perder una dosis sin que nadie lo note)

| v | Qué se reparó |
|---|---|
| **865** | **Una dosis registrada podía desaparecer del MAR.** El servidor guardaba el objeto del cliente entero (`{ ...p.adm }`) dentro del registro de administración, y `estado` sólo puede ser `administrado` u `omitido` — nadie lo comprobaba. El motor del MAR reparte las administraciones justo en esas dos cubetas: una dosis con otro estado no cae en ninguna, la enfermera la ve confirmada en pantalla y el pase de visita lee «sin administraciones» y un atraso que no ocurrió. Lista blanca + estado inválido RECHAZADO, no corregido a un valor por omisión (`lib/hospital/administracion-entrante.ts`, 5 pruebas); `cincoCorrectos` e `identidadVerificada` exigen un `true` explícito (la cadena `"no"` es truthy y pasaba como verificación hecha). **La tarjeta de UCI afirmaba lo que no pudo leer**: `catch(() => [])` en las tomas y `catch(() => null)` en la estancia hacían que dijera «sin ninguna toma registrada» y «no consta ningún soporte activo» de un paciente monitorizado y ventilado. El paciente sale igual —esconderlo sería peor— pero el fallo se declara (4 pruebas). |

## DECIMOQUINTA TANDA — v866 (el motor sin puerta de entrada)

| v | Qué se reparó |
|---|---|
| **866** | **El algoritmo de dosificación del Dr. no tenía puerta de entrada.** `lib/uci/dosificacion-critica.ts` —meropenem en el adulto crítico, dictado el 30 de julio— estaba escrito, probado y sin un solo llamador: el fallo que más veces se ha repetido en este repositorio. Ahora hay pestaña **«Dosis en crítico»** en el panel de UCI: CrCl, modalidad de reemplazo renal, MIC y criterios de alta exposición, y **las dos columnas** —convencional y alta exposición— sin marcar ninguna como la buena. Si falta el dato que decide la fila, no propone: dice qué falta. La pantalla no calcula nada; todo lo decide el motor puro, con sus avisos (en CRRT no se aplica el ajuste de falla renal; una resistencia verdadera no se vence subiendo la dosis; la preparación la fija la farmacia del hospital). Sale de `HUERFANOS_ACEPTADOS`. |

## DECIMOSEXTA TANDA — v867 (el número escrito dos veces)

| v | Qué se reparó |
|---|---|
| **867** | **El margen del MAR estaba escrito dos veces y donde el hospital no puede tocarlo.** `const GRACIA_MIN = 30` vivía en el MAR del paciente y otra vez en el turno de enfermería: dos pantallas que leen el mismo motor y le dicen a la misma enfermera si una dosis va atrasada. El propio motor declara (`FALTA_GRACIA`) que la gracia es una decisión **operativa de la unidad**, no un umbral clínico — y estaba clavada en el código. Un solo módulo (`lib/uci/gracia.ts`) con el valor de fábrica de siempre (30 min, sin cambiar nada en silencio) y `config.graciaMarMin` para la unidad; un valor imposible cae al de fábrica en vez de reventar el MAR o inventar un margen (4 pruebas). |

## DECIMOSÉPTIMA TANDA — v868 (la primera cama que no existía)

| v | Qué se reparó |
|---|---|
| **868** | **El ingreso no abría la asignación de cama.** El traslado y el egreso escribían en `bed_assignments`; el ingreso no — el mismo agujero que ya se reparó con la estancia de UCI, en la colección de al lado. La primera cama de cada episodio no existía en la historia, y el primer traslado anotaba «el episodio venía de antes de que existiera la historia de camas» de un paciente ingresado esa misma mañana: el historial empezaba en la **segunda** cama y `ocupantesDe` no veía a nadie en la primera. **Y esa historia no la leía nadie**: `historialCamas` y `ocupantesDe`, escritos y probados, sin un solo llamador. Al abrir el traslado se enseñan ya las camas del episodio con fechas y motivo (`getAsignacionesCama`). |

## DECIMOCTAVA TANDA — v869 (los campos que la estancia prometía y no existían)

| v | Qué se reparó |
|---|---|
| **869** | **`motivoIngresoUci` era obligatorio y no lo captura ninguna pantalla** — un campo obligatorio que jamás se llena sólo hace que el tipo mienta; pasa a opcional. **`codigoReanimacion` y `aislamiento` no tenían ni escritor ni lector**: en terapia intensiva eso no es inocuo — en cuanto una pantalla lo enseñe, un código de reanimación vacío se lee como «no hay limitación del esfuerzo terapéutico registrada», la afirmación que nadie hizo; se quitan hasta que exista la captura de verdad. **`createdAt`/`creadoPor` eran obligatorios y no los escribía nadie**: sólo constaba quién tocó la estancia por última vez, así que al cabo de un turno no quedaba rastro de quién decidió abrirla; se escriben ahora en las tres rutas que la abren, y sólo la primera vez. |

## DECIMONOVENA TANDA — v870 (la anual que se leía como otro plan)

| v | Qué se reparó |
|---|---|
| **870** | **La suscripción ANUAL se deducía como otro plan.** El webhook comparaba el importe cobrado contra una tabla de centavos **mensual**: la anual de un plan barato cae en el rango del mensual de uno caro — Agenda al año (349 000 ¢) se leía como **hospital**. Y desde que «manda el precio sobre el metadato» (v8xx, correcto para la baja hecha desde el portal de Stripe), esa deducción equivocada **pisa el metadato correcto**: quien paga Agenda al año se queda con Hospital, con módulos que no compró y la llave de IA cara del dueño. La selección del ítem del plan tampoco conocía los price ids anuales, así que en una anual podía caer en el asiento del médico extra. Nuevo `lib/finanzas/plan-de-suscripcion.ts` (puro, 7 pruebas): price id exacto → importe **sólo si es mensual** → metadato → no tocar el plan. |

## VIGÉSIMA TANDA — v871 (la solicitud ARCO que señalaba a un tercero)

| v | Qué se reparó |
|---|---|
| **871** | **Cualquiera desde internet podía señalar el expediente de un tercero para que se suprimiera.** El portal público de derechos ARCO crea la solicitud sin sesión —tiene que ser así—, pero las reglas no constreñían `patientId`, y el panel de Cumplimiento enseña «Ejecutar cancelación…» exactamente cuando la solicitud trae uno: una solicitud anónima con el `patientId` de un paciente real y un nombre plausible ponía la supresión de ese expediente a un clic, con la casilla de identidad como única barrera. Reglas: quien no es miembro no puede mandar `patientId`, debe declarar `origen: 'portal-publico'` y no puede declararse verificada a sí misma. El panel marca «Identidad sin verificar» y explica por qué no hay botón cuando no hay expediente ligado. **Reglas desplegadas aparte**; 101 specs del emulador en verde. |

## VIGESIMOPRIMERA TANDA — v872 (el color que no cambiaba de tema)

| v | Qué se reparó |
|---|---|
| **872** | **El color de la alerta clínica no cambiaba de tema.** Cuatro rojos y ocho ámbares escritos a mano en 55 pantallas; el problema no es la variedad sino que un hexadecimal no cambia de tema: `#f87171` es el rosa **para fondo oscuro** y sobre el crema del tema claro da 2.5:1 (AA pide 4.5). Y es el color del error bajo un campo de **dosis**, del atraso del MAR y de las alertas clínicas. 124 colores de primer plano migrados a `--red`/`--amber`, medidos en los dos temas. **Excepción deliberada**: las superficies que se imprimen conservan el hexadecimal (html2canvas clona el nodo y una variable sin resolver deja sin color el «[FALTA CÉDULA PROFESIONAL]»; y el papel fuerza tema claro). Queda un **trinquete** con techo 0 vigilado por prueba. |

## VIGESIMOSEGUNDA TANDA — v873 (la cita que se caía al suelo)

| v | Qué se reparó |
|---|---|
| **873** | **La cita de guía no llegaba a ninguno de los tres sitios donde se lee.** `Rec.fuente` existe —su comentario dice «para citarla en la nota»— y `lib/inmuno/farmacos.ts` la **exige** en sus 34 recomendaciones (ASH 2020, consenso IS ACCP/AST/ISHLT 2022, ACIP…). No la enseñaba ni el panel —que promete «con su cita de guía»—, ni el texto que se le dicta a la IA, ni el HTML del expediente: la nota salía con recomendaciones de profilaxis y cero atribución, con el dato guardado al lado. Ahora viaja a los tres, y donde no hay fuente **se dice** en vez de omitirla en silencio. Las 42 de `recomendaciones.ts` siguen sin cita: es trabajo clínico del Dr. —una cita inventada sería peor que ninguna— y quedan declaradas con una prueba que vigila que el número no suba. |

## VIGESIMOTERCERA TANDA — v874 (el fallo que ofrecía escribirle a quien pidió la baja)

| v | Qué se reparó |
|---|---|
| **874** | **Un fallo de lectura ofrecía escribirle a quien pidió la baja.** La pantalla de reactivación lee `whatsapp_optout` con `.catch(() => null)` y después `new Set((optSnap?.docs ?? []))`: un fallo de red, permisos o App Check daba el **mismo conjunto vacío** que un consultorio sin bajas — y con él la pantalla ofrecía «WhatsApp» sobre toda la base, incluida la gente que pidió que no se le escriba. El daño no es simétrico: el mensaje que no se mandó se manda mañana; el que se mandó a quien pidió la baja no se devuelve. Sin la lista, los contactos quedan **deshabilitados** y se dice por qué (`lib/whatsapp/puede-contactar.ts`, 5 pruebas). Las citas futuras no bloquean pero avisan. |

## VIGESIMOCUARTA TANDA — v875 (el calendario que no sabía de quién era)

| v | Qué se reparó |
|---|---|
| **875** | **El calendario de Google no sabía de qué médico era.** El token vive en `googleTokens/{uid}` y la agenda razona con `medicoId`: **no existía relación entre los dos**, y de ahí salen las dos cosas que hoy no funcionan — el portal público / el bot / el reagendado no consultan el freebusy (un paciente puede reservar encima de una cirugía apuntada en el calendario personal del médico), y la sincronización desde el portal quedó sin hacer a propósito. El único momento en que se sabe con certeza que un uid es de una persona concreta es cuando esa persona conecta su propio calendario: ahí se escribe el vínculo, por correo **exacto** y sólo si es inequívoco (`lib/calendario/vinculo-medico.ts`, 7 pruebas). Dos correos iguales o ninguno → vínculo **sin hacer y declarado**, y el médico se entera al volver. |

## VIGESIMOQUINTA TANDA — v876 (el paciente reservaba encima del calendario del médico)

| v | Qué se reparó |
|---|---|
| **876** | **El portal público no descontaba lo que el médico tiene en su Google Calendar.** El panel del consultorio sí lo consultaba; el camino que usa el paciente no, porque el token vive por `uid` y no se sabía de quién era el calendario — lo desbloqueó el vínculo de v875. Ahora la disponibilidad pública lo descuenta **y el alta lo vuelve a comprobar antes de escribir**: «no ofrecer» y «no aceptar» son distintas (una pestaña abierta desde antes mete la cita igual), y ese error ya se pagó una vez con el horario partido. Cautelas: sólo con `medicoId`; si Google falla se sigue como antes —ni se esconde el día ni se rechaza una cita real por un fallo de red—; y no viaja nada del evento, sólo el intervalo. |

## VIGESIMOSEXTA TANDA — v877 (el bot, y una sola consulta para los tres)

| v | Qué se reparó |
|---|---|
| **877** | **El bot de WhatsApp era el último camino que agendaba sin mirar el calendario del médico**: ofrecía —y aceptaba— la hora de una cirugía. Ahora lo carga junto con los bloqueos del consultorio, que es la función por la que pasan sus **tres** momentos (listar, revalidar al confirmar, buscar el próximo día), así que queda cubierto también el cuarto que se escriba mañana. **Excepción declarada**: la búsqueda del «próximo día disponible» recorre 14 días y no consulta Google —serían 14 llamadas dentro de un webhook que debe contestar rápido—; no abre agujero porque sólo propone días y al elegir uno se lista con Google y al confirmar se revalida. Y la consulta se sacó a **un** módulo (`lib/calendario/ocupado-servidor.ts`) que usan el portal, el alta pública y el bot: v876 la había dejado escrita dos veces, que es como empiezan las cinco implementaciones. |

## VIGESIMOSÉPTIMA TANDA — v878 (la videoconsulta a la que el paciente no podía llegar)

| v | Qué se reparó |
|---|---|
| **878** | **Se podía vender, agendar y cobrar una teleconsulta a la que el paciente no podía entrar.** Es un tipo de cita con su concepto de cobro y su precio, y el consultorio tiene «Unirse» en la lista de citas; en el portal del paciente `teleconsulta` era **sólo una etiqueta** en el mapa de tipos, y ni la confirmación ni los recordatorios llevan el enlace de la sala. Ahora «Mis citas» enseña **«Entrar a la videoconsulta»** dentro de la ventana, y fuera de ella dice por qué no («se abre 30 min antes» / «ya se cerró, llama al consultorio»). La ventana son los **mismos** 30 min / 2 h que el servidor aplica al crear la sala en Daily, ahora en un módulo probado (`lib/telesalud/ventana-sala.ts`, 6 pruebas); la hora es la del consultorio, no la del servidor. El enlace del paciente no lleva `dr=1`. |

## VIGESIMOCTAVA TANDA — v879 (a la videoconsulta se le mandaba la dirección)

| v | Qué se reparó |
|---|---|
| **879** | **A quien tenía videoconsulta se le mandaba la dirección del consultorio.** La confirmación y los dos recordatorios se escribieron cuando todas las citas eran presenciales y **nunca miraron el tipo**: al paciente de teleconsulta le llegaba «📍 Consultorio, Av. …» y «Te esperamos / Favor de acudir puntualmente», sin el enlace de la sala. En el mejor caso llama; en el peor conduce hasta allá y pierde su consulta. Pasaba en los tres mensajes de `lib/whatsapp` **y** en las plantillas del cron, que se mandan solas de madrugada sin que nadie las lea antes. Ahora el tipo decide (`lib/telesalud/donde-es.ts`, 7 pruebas): la teleconsulta lleva el enlace y no la dirección, y el cierre deja de ser «te esperamos». Sin URL base se dice que es videoconsulta en vez de callar. |

## VIGESIMONOVENA TANDA — v880 (el bot, que confirma solo)

| v | Qué se reparó |
|---|---|
| **880** | **El bot también mandaba al consultorio a quien pedía videoconsulta.** Ofrece «5️⃣ Teleconsulta» en su menú y luego imprimía consultorio y dirección en sus **tres** mensajes (resumen previo, «su cita ha sido registrada» y el de lista de espera), sin el enlace. Es el más caro de los tres caminos: el bot **confirma en el momento**, de madrugada, sin que nadie del consultorio lo lea antes. Ahora los tres usan el criterio por tipo de v879; en los dos de cita agendada el enlace se arma con el **id real** de la cita —que en el camino de lista de espera hubo que tomar antes de escribir, porque se creaba con un `doc()` anónimo—. |

## TRIGÉSIMA TANDA — v881 (la frase más natural para pedir cita no agendaba)

| v | Qué se reparó |
|---|---|
| **881** | **«Quiero agendar una consulta» nunca agendaba.** El bot detecta las preguntas frecuentes antes que nada y el patrón de PRECIO es `/costo|precio|cobr|cuanto|pag|consulta/`: la palabra **«consulta»** dispara la respuesta de precios. La frase más natural para pedir cita hacía que el bot contestara cuánto cuesta, enseñara el menú y no agendara nada — y desde fuera parecía que funcionaba, porque contestó rápido y con información correcta. Igual «necesito una consulta», «me gustaría agendar consulta». Y «quiero cancelar mi cita de mañana a las 10» caía en la FAQ de **horarios** por la palabra «hora». Ahora un verbo de acción gana al tema (`lib/whatsapp/intencion.ts`, 7 pruebas) y pedir cita arranca el alta desde cualquier estado de reposo. Sin verbo no cambia nada: «cuánto cuesta la consulta» sigue siendo precio. |

## TRIGÉSIMA PRIMERA TANDA — v882 (el menú ofrecía cancelar y no cancelaba)

| v | Qué se reparó |
|---|---|
| **882** | **«3️⃣ Cancelar cita» era una promesa sin nada detrás.** Contestaba «comuníquese al consultorio… también puede escribir su nombre completo y le ayudamos», y el estado siguiente **ignoraba lo que el paciente escribiera**: repetía el teléfono y volvía al menú. El paciente tecleaba su nombre completo —dato personal, a un canal externo— para nada, y su cita seguía viva: el día de la consulta contaba como no-show, con el lugar perdido y el paciente creyendo que había cancelado. El bot **sí sabía** cancelar (contestar «NO» a un recordatorio lo hace); faltaba encontrar la cita, y eso se hace por teléfono. Ahora busca, enseña la cita (o una lista), cancela con SÍ/NO, **respeta la política de cancelación** y no esconde la cita bloqueada. **Cuidado crítico**: en ese estado «SÍ» significaba «confirmo que asisto» — sin distinguir la pregunta, quien pedía cancelar acababa con la cita CONFIRMADA. Y la cancelación ya hace las tres cosas de v863. |

## TRIGÉSIMA SEGUNDA TANDA — v883 (el bot decía que abren a la hora de la comida)

| v | Qué se reparó |
|---|---|
| **883** | **El horario que contestaba el bot ignoraba los descansos.** Imprimía `inicio–fin` a secas: un consultorio de 9 a 14 y de 16 a 20 le decía al paciente «Lunes: 09:00–20:00» — o se presenta a una puerta cerrada, o intenta agendar a las 15:00 y la agenda no se lo ofrece, porque el motor de huecos **sí** respeta el descanso desde v829/v830. El sistema sabía la verdad y su propio bot decía otra cosa (`lib/whatsapp/horario-legible.ts`, 8 pruebas). **Segundo fallo**: `buildFAQReply` empezaba con «sin `botConfig`, contesta el teléfono» **para todo**, cuando el horario y la dirección salen de la configuración del consultorio, que siempre está llena. Un consultorio sin onboarding del bot tenía «Información» en el menú y el bot contestando el teléfono a todo. |

## TRIGÉSIMA TERCERA TANDA — v884 (datos de salud sin aviso de privacidad)

| v | Qué se reparó |
|---|---|
| **884** | **El bot recogía datos de salud sin aviso de privacidad.** El portal público **exige** el consentimiento (sin él la ruta responde 400) y lo guarda en la cita con su marca de tiempo; el bot creaba expediente y cita **sin aviso ninguno**. La misma aplicación que bloquea el alta web por falta de consentimiento la dejaba pasar por el canal por el que entra buena parte de los pacientes. Ahora, antes de pedir un solo dato, manda el aviso —responsable, finalidad, derechos ARCO y enlace al aviso completo— y pide un **sí expreso**; se guarda quién aceptó, cuándo, por qué canal y con qué versión (`lib/whatsapp/aviso-bot.ts`, 10 pruebas). Nunca se marca aceptado por no contestar, y a quien dice que no no se le insiste. |

## TRIGÉSIMA CUARTA TANDA — v885 (el aviso no llegaba al expediente)

| v | Qué se reparó |
|---|---|
| **885** | **El aviso del bot se quedaba en la cita y no llegaba al expediente.** v884 guardó el consentimiento en la cita, pero el portal público guarda **además** un sello en `patients/{id}.avisoPrivacidad` con versión, medio y **hash del texto** — y ése es el campo que lee el panel de Pacientes. El paciente de WhatsApp seguía apareciendo sin aviso en su expediente. Ahora el bot escribe el mismo sello con `medioAceptacion: 'whatsapp'`. La huella importa porque `versionAviso` es una constante del código pero el texto se genera en vivo con la razón social y el domicilio: si el médico los cambia, el aviso que verá el siguiente paciente **no** es el que aceptó éste. No se pisa un sello anterior: el primero es el que vale. |

## TRIGÉSIMA QUINTA TANDA — v886 (los números que el menú no tenía)

| v | Qué se reparó |
|---|---|
| **886** | **El menú de información prometía números que no existían — y llevaban al sitio equivocado.** Terminaba con «O responda con el número de su interés» sin listar ninguno, y como el estado seguía siendo `menu`, quien escribía «1» acababa en el **alta de cita** y «3» en cancelar: el paciente que quería saber el horario terminaba dando su nombre completo para agendar. Ahora los cinco temas están numerados, el menú tiene su propio estado y «0» vuelve. Además el estado del **aviso de privacidad** ya no se secuestra: si una pregunta frecuente contestaba encima, el paciente acababa dando sus datos sin haber contestado si acepta. |

## TRIGÉSIMA SEXTA TANDA — v887 (el contacto que nadie sabía que debía hacer)

| v | Qué se reparó |
|---|---|
| **887** | **El portal público no le avisaba a nadie del consultorio.** Le contesta al paciente «Te contactaremos para confirmar» y la cita se queda en `solicitada`: si la asistente no recarga la agenda —o mira sólo las confirmadas— el paciente espera una llamada que no va a llegar y el consultorio pierde la cita sin enterarse de que la tuvo. El bot **sí** manda su «🔔 Nueva cita»: dos caminos, dos criterios. Lo mismo con la cancelación desde el enlace (v863 dejó bitácora y oferta del hueco, pero ningún aviso). Ahora los dos avisan por el mismo helper, el fallo queda **registrado** como no entregado, y ninguno espera al aviso — la respuesta al paciente ya salió. |

## TRIGÉSIMA SÉPTIMA TANDA — v888 (mover una cita en silencio es peor que cancelarla)

| v | Qué se reparó |
|---|---|
| **888** | **Reagendar desde el portal seguía sin avisarle a nadie.** v887 cubrió altas y cancelaciones; mover la cita no. Y aquí importa más: la cita **no desapareció, se movió** — quien tenga la lista del día sigue esperando al paciente a la hora vieja, y a la hora nueva le llega alguien que «no estaba». La cancelación deja un hueco visible; un reagendado silencioso deja **dos** errores. Además vuelve a `pendiente-confirmar` y nadie sabía que había que confirmarla otra vez. **Segundo**: una teleconsulta no tiene lugar físico y el portal imprime «Teleconsulta · {lugar}» — el alta pública y el bot escribían ahí el nombre del consultorio, enseñándole a dónde ir a quien no tiene que ir. |

## TRIGÉSIMA OCTAVA TANDA — v889 (P-019: el formulario previo a la consulta)

| v | Qué se reparó |
|---|---|
| **889** | **P-019 del charter — la última pieza del portal que faltaba en la fase 3.** Desde su enlace, el paciente llena con calma lo que hoy el médico reconstruye a las prisas: qué le pasa, desde cuándo, qué toma, a qué es alérgico. **La regla que lo hace seguro: lo que dice el paciente NO pisa el expediente** — si escribiera en `patient.alergias`, un «no» suyo borraría una alergia a penicilina documentada, y de ese campo dependen la compuerta de la receta y el cruce de la nota. Tampoco puntúa ni calcula nada: es una declaración, no una valoración. Las reglas cierran la escritura desde el navegador y la lectura es `isMedico` (lo cazó el guardián de la matriz cuando lo puse en `isMember`). La consulta lo enseña separado y declarado. **Reglas desplegadas aparte.** |

## TRIGÉSIMA NOVENA TANDA — v890 (el criterio que nadie podía consultar)

| v | Qué se reparó |
|---|---|
| **890** | **La CSP lleva meses sin proteger nada y el criterio para activarla no se podía consultar.** La política va en *report-only*: el navegador avisa y no bloquea. Pasarla a bloqueo es una variable (`CSP_MODE=enforce`) y el criterio estaba escrito y probado —7 días y cero violaciones recientes— pero **nadie leía los reportes**: se acumulaban en `platform_csp` sin una sola pantalla que dijera cuántos días llevan ni cuántas violaciones hay. Ahora Cumplimiento enseña el veredicto, los días, las violaciones y **qué** chocaría, para arreglarlo en vez de sólo esperar. **Cero reportes no se lee como «todo bien»**: puede ser que el buzón no reciba. Cierra un punto de **P-020**. |

## CUADRAGÉSIMA TANDA — v891 (adaptador de dispositivos: fases 6-12)

| v | Qué se reparó |
|---|---|
| **891** | **Los signos vitales ya pueden llegar del monitor.** Era la **única** pieza de las fases 6-12 que de verdad no existía — las otras seis las verifiqué una por una antes de escribir nada. Casi todos los monitores hablan HL7 y mandan un `OBX` por parámetro; el convertidor sólo devolvía FHIR genérico. Cuatro reglas, cada una contra un dato falso: la **unidad no se adivina** (98.6 °F leído como °C es 37 y NEWS2 puntúa con eso), la **hora es la del aparato**, la **presión sólo entra completa**, y **nada se completa ni se promedia** —un valor no numérico no se fuerza a cero, porque un cero inventado en una frecuencia cardiaca es un paro que no ocurrió—. Lo que llega del monitor va marcado con su fuente. |

## CUADRAGÉSIMA PRIMERA TANDA — v892 (P-006: «manual» significa «lo escribió el médico»)

| v | Qué se reparó |
|---|---|
| **892** | **El sello de procedencia metía a la máquina y al médico en la misma casilla.** Sólo tenía tres orígenes y todo lo que no venía de la extracción caía en `manual` — que significa literalmente «lo escribió el médico». Con el adaptador de v891 ya entran signos de monitor: sellarlos así afirmaría que el médico tecleó una frecuencia cardiaca que midió un aparato. Ahora hay `calculado` e `importado`, con su propio icono, y un **puente** entre la `fuente` de una toma y el sello de la nota: una fuente desconocida **no** se degrada a `manual`, devuelve `null` — inventar un autor es peor que no tener uno. Cierra **P-006**. |

## CUADRAGÉSIMA SEGUNDA TANDA — v893 (el monitor llega a la ficha)

| v | Qué se reparó |
|---|---|
| **893** | **El adaptador convertía y ahí se quedaba.** La ruta lo dice sin rodeos: «NO almacena nada» — el clínico veía un JSON y seguía tecleando los signos a mano. Ahora la ficha del episodio tiene **«Importar del monitor»**: se pega el HL7, se enseña qué se reconoció **y qué se descartó con su motivo** —si sólo se enseñara lo bueno, creería que se importó todo— y **una persona confirma** antes de escribir. Se guarda con **la hora del aparato** y marcado como venido de un dispositivo, que v892 traduce a `importado`. |

## CUADRAGÉSIMA TERCERA TANDA — v894 (§36: «siempre revisado por médico»)

| v | Qué se reparó |
|---|---|
| **894** | **El charter exige que la entrega de turno la revise un médico, y no había forma de revisarla.** El tipo lo hace imposible de saltar —un handoff nace BORRADOR y sólo `marcarRevisado()` lo cambia— pero **esa función no tenía un solo llamador**: la entrega nacía y moría en borrador, y la cabecera decía «sin revisar» para siempre. Una etiqueta que nunca cambia deja de significar algo, y ésta le dice al turno que llega si alguien leyó esto — el handoff es el documento que se lee cuando el que conoce al paciente **ya se fue**. Ahora hay «Lo revisé y lo entrego», con nombre y hora. La revisión se guarda **aparte** del handoff, que se recalcula en cada carga: dentro, desaparecería al llegar una toma nueva. **Reglas desplegadas aparte.** |

## CUADRAGÉSIMA CUARTA TANDA — v895 (§16: el peso con el que se dosifica)

| v | Qué se reparó |
|---|---|
| **895** | **Dos pantallas del mismo paciente podían dosificar con pesos distintos.** El charter §16 exige un peso fijado a propósito y con su autor; el campo estaba modelado en `ICUStay` con valor, tipo, autor y hora — **y no lo escribía nadie**. Cada calculadora pedía el suyo (infusiones `infPeso`, CKRT `ckrtPeso`, e infusiones caía a la de CKRT): se tecleaba 70 en una y 80 en la otra y ambas enseñaban un número plausible. En µg/kg/min, 14 % de diferencia en el peso es 14 % en la dosis. Ahora hay uno solo por estancia, con autor sellado por el **servidor**, y las calculadoras lo usan por debajo de lo que se teclee en ellas. **No** se toma del peso de la nota: ése cambia y movería todas las dosis sin que nadie lo pidiera. |

## CUADRAGÉSIMA QUINTA TANDA — v896 (§31: la talla y el volumen protector)

| v | Qué se reparó |
|---|---|
| **896** | **La talla también se re-tecleaba en cada pantalla.** Mismo hallazgo que v895 en el dato de al lado: `ICUStay.tallaCm` está declarado «para calcular PBW y VT/PBW (§31)» y no lo escribía nadie. Y la talla de un adulto **no cambia** durante la estancia: re-teclearla en cada pase es re-arriesgar el mismo número cada vez. De ella sale el peso predicho (ARDSNet/Devine, ya en el código) y de ahí el **VT/PBW**, la meta de ventilación protectora — un dedazo de 10 cm mueve el peso predicho unos 9 kg. Ahora se fija una vez y el motor la usa por debajo de lo que se teclee. Sin talla fijada no se inventa ninguna. |

## CUADRAGÉSIMA SEXTA TANDA — v897 (fallo mío de v893)

| v | Qué se reparó |
|---|---|
| **897** | **Los signos importados del monitor entraban sin disparar la alerta de deterioro.** Registrar signos a mano calcula NEWS2 y avisa al médico tratante si hay riesgo alto o parámetro en rojo; los importados en v893 no hacían nada de eso. Un paciente que se deteriora podía quedar registrado sin que nadie se enterara — y son justo los signos que llegan **sin que una persona los mire**. Un canal nuevo que se salta la alerta del viejo da sensación de cobertura sin darla. Ahora pasa por el mismo motor y la misma alerta, con el título diciendo que viene del monitor. Lo que el monitor no manda (conciencia, O₂) **no se inventa**. |

## CUADRAGÉSIMA SÉPTIMA TANDA — v898 (segundo fallo mío del día)

| v | Qué se reparó |
|---|---|
| **898** | **El formulario previo llegaba y nadie se enteraba.** v887 hizo que el consultorio supiera de las citas y cancelaciones del portal, y **v889 volvió a abrir el hueco** con el formulario. El paciente lo llena la noche antes y el médico sólo lo ve si abre la consulta y mira la tarjeta — uno que dice «soy alérgico a la penicilina» merece saberse **antes** de tenerlo enfrente. Ahora avisa por el mismo helper. **No viaja el contenido**: son datos de salud por un canal externo; el aviso dice que llegó y de quién, lo demás se lee en el expediente. Encontrado revisando mi propio trabajo del día. |

## LO QUE ENCONTRARON LOS AUDITORES Y NO ESTÁ REPARADO

Por orden de daño. Todo con archivo:línea, verificable.

### Dinero
1. ~~Dos identificadores de médico~~ — HECHO (v853). Queda pendiente decidir si
   se **migran los cobros viejos**: hoy el panel los señala, pero no los une.
2. ~~Consultas pagadas como cuentas por cobrar~~ — HECHO (v854).
3. ~~Anular reescribe un corte cerrado sin nota~~ — HECHO (v857).
4. ~~«Reembolsos $0.00»~~ — HECHO (v857): ahora dice «Anulados».
5. ~~Un cobro suelto no tiene médico~~ — HECHO (v864): el modal pregunta cuando
   hay más de un médico. **Queda**: los cobros VIEJOS sin atribuir siguen sin
   atribuir; unirlos es una decisión contable del Dr.

### Farmacia
6. ~~«Eliminar» no elimina nada visible~~ — HECHO (v856).
7. ~~«Bajo stock: 0» con el anaquel vacío~~ — HECHO (v856).
8. ~~La farmacia es una isla~~ — HECHO A MEDIAS (v858): el libro ya se lee y la
   dispensación ya dice a quién. **Queda**: dispensar desde la CONSULTA no
   descuenta inventario ni genera cobro — sigue siendo una captura aparte.
9. ~~Caducidad evaluada en UTC~~ — HECHO (v856).

### Hospital / UCI
0. ~~`bed_assignments` no se abre al ingresar; `historialCamas`/`ocupantesDe` sin
   lectores~~ — HECHO (v868).
10. ~~Un reingreso borra la estancia anterior~~ — HECHO (v855), junto con el
    cierre de la estancia al egresar (punto 10 del informe de UCI).
11. ~~La limpieza terminal no se aplica al egreso~~ — HECHO (v861).
12. ~~El turno de enfermería oculta pacientes~~ — HECHO (v862).
13. ~~Las tomas de UCI se firman con el médico tratante~~ — HECHO (v862).
14. ~~La entrega de turno afirma ausencias~~ — HECHO (v862 + **v894**): ya no
    afirma lo que no sabe, y la revisión del charter §36 tiene por fin su
    puerta — con nombre, hora y persistencia aparte del handoff recalculado.

### Portal y mensajería
15. ~~El enlace mágico no se puede revocar~~ — HECHO (v860).
16. ~~El recordatorio promete «Responde SÍ»~~ — HECHO (v859).
17. ~~Lista de espera: el NO no daba de baja y el silencio desterraba~~ — HECHO (v859).
18. ~~El detector de FAQ secuestra las confirmaciones~~ — HECHO (v859).
19. ~~«Mis recetas» imprime "Invalid Date"~~ — HECHO (v859).
20. ~~«Pagar anticipo» no aseguraba nada~~ — HECHO (v861).
21. ~~Aviso de lista de espera sin `medicoId`~~ — HECHO (v861).
22. ~~Cancelar/reagendar desde el portal no ofrece el hueco, no avisa y no deja
    rastro~~ — HECHO (v863) **y el aviso al consultorio en v887**, por WhatsApp,
    con el fallo registrado si no sale.
