# Bitácora reanudable — tarde del 2026-08-01

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
3. **No existe verificación de correo.** `grep sendEmailVerification` → cero.
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
8. **`logAudit` falla en silencio, sin cola ni reintento** — `src/lib/expediente/audit-log.ts:84`.
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
