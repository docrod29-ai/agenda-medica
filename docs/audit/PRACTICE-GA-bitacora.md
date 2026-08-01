# Bitácora PRACTICE-GA — correcciones y pendientes

> Registro vivo del programa **Master Execution System V5**, track P (NexusMED
> Practice → GA comercial). Se actualiza al cerrar cada iteración.
>
> Dos secciones y las dos importan igual: lo que **arreglé** y lo que **dije mal**.
> Un informe de auditoría que sólo lista aciertos no sirve para decidir dónde
> mirar la próxima vez.

Última actualización: **31-jul-2026**, tras PRACTICE-GA-010.

---

## 1. Correcciones a mi propia auditoría

Dos de los siete P0 de `PRACTICE-GA-001` estaban mal planteados. Los dos se
cazaron **al bajar a leer el código antes de programar**, no después.

| # | Lo que afirmé | Lo que era verdad | Cómo se cazó |
|---|---|---|---|
| **P0-1** | «Sin horario configurado no hay huecos: el médico nuevo no puede agendar» | **Falso.** `DEFAULT_CONFIG` trae lunes a viernes 9-18h y las duraciones; la agenda funciona recién creado el consultorio | Leyendo `DEFAULT_CONFIG` antes de construir el asistente de onboarding |
| **P0-4** | «Clickjacking abierto: sin `X-Frame-Options` y CSP en report-only» | **Falso para la zona autenticada.** `/dashboard`, `/consulta`, `/uci`, `/pacientes`, `/login` y `/setup` ya iban con `DENY` + `frame-ancestors 'none'` en enforce | Midiendo ruta por ruta contra producción, en vez de hacer `curl` a `/` y generalizar |

**Lección de método.** Las dos afirmaciones salieron de leer código y probar *una*
URL de muestra. Al medir caso por caso, las dos se cayeron — **y las dos escondían
un hallazgo mejor**:

- Bajo P0-1 estaba el muro real: la **cédula profesional** vacía dejaba el botón
  de *Firmar* muerto en la primera nota de todo médico nuevo.
- Bajo P0-4 estaba el hueco real: el **portal del paciente** (`/mi`, `/resena`,
  `/verificar`, `/teleconsulta`) sin ninguna cabecera anti-encuadre.

Regla para lo que queda: **verificar cada P0 contra la realidad antes de
programar nada**, no después.

**P0-3 se confirmó tal cual** (`grep` sobre todo el repo: cero manejo de refund o
dispute). Pero al implementarlo apareció debajo un defecto que la auditoría no
vio: la consola del dueño sumaba `platform_payments` de **dos formas
incompatibles** —el ingreso total descartaba los negativos, el pagado-por-cliente
los incluía—. Sin arreglar eso, escribir los reembolsos los habría dejado
invisibles justo en el número grande.

**P0-3 escondía DOS defectos más, ninguno en la auditoría.** Al implementar los
reembolsos apareció que la consola sumaba de dos formas incompatibles. Y al
cargar las tarifas (GA-006) apareció que la transcripción **se cobra por minuto,
no por token**, que el motor sólo sabía de tokens, y que la ruta de dictado no
dejaba asiento: con cada consulta dictada, el renglón probablemente más grande de
la plataforma valía **$0** en el tablero.

En el mismo trabajo, `usoDe` ignoraba los minutos que la ruta le mandaba —
escrito y sin conectar, otra vez, y TypeScript no lo cazó porque el parámetro es
`unknown`. Sólo apareció al mirarlo.

**#5 estaba a MEDIAS, y la mitad que faltaba costaba dinero.** El «solo lectura»
ya existía y bien hecho: `clinicaPuedeEscribir` en `firestore.rules` corta las
escrituras con la prueba vencida y **nunca** la lectura, con el motivo escrito
(NOM-004: el expediente es del paciente). Lo que faltaba: las rutas de IA corren
con Admin SDK, que **ignora** esas reglas, así que un consultorio vencido seguía
quemando la llave del dueño indefinidamente. Y el médico sólo veía «tu prueba
terminó» — el resto lo descubría a golpes, con un error de permisos genérico al
intentar guardar.

**P0-2 estaba mal CONTADO.** Dije «4 motores pendientes»: eran los del flujo de
consulta que yo había mirado. El registro tiene **24 sin validar** (23
`pendiente_validacion` + 1 `experimental`). Y el hallazgo de fondo era otro: ese
estado **lo leían sólo las pruebas** — ninguna pantalla consultaba el registro,
así que para el médico la clasificación no existía. Escrito, probado y sin
conectar.

---

## 2. Cerrado

| Iteración | Qué | Versión |
|---|---|---|
| **GA-002** | Muro de la primera firma (cédula), zona horaria adivinada del navegador, especialidad que se perdía | v766 |
| **GA-003** | Anti-encuadre en las 4 rutas del paciente con PHI; corregido el malentendido de `frame-ancestors` en teleconsulta | v767 |
| **GA-004** | Reembolsos y contracargos en el webhook + ingreso NETO con una sola definición de signo | v768 |
| **GA-005** | El estado de validación clínica llega por fin a la pantalla: sello junto al resultado + hoja de revisión en `/cumplimiento/motores` | v769 |
| **GA-006** | Tarifas cargadas de la fuente + el audio se mide por minuto + 25 referencias a modelos retirados | v770 |
| **GA-007** | Cerrados los dos huecos que GA-006 dejó declarados: tarifa de caché cargada y el webhook de Stripe se comprueba solo | v771 |
| **GA-008** | Caché de OpenAI cargada. **Cero huecos declarados en el motor de costos.** | v772 |
| **GA-008b** | La consola dice si Stripe está en prueba o en producción | v773 |
| **GA-009** | Fin del trial: se corta la IA (dinero que se fugaba) y el médico entiende qué conserva | v774 |
| **GA-010** | Golden Flow contra las reglas reales + Playwright por fin dentro del CI | v775 |

Fuera del programa, el mismo día: gateway de fallos de IA (`fallo-proveedor.ts`),
exención de fundador (`fuente: 'fundador'`), incidencias de plataforma visibles
en `/superadmin/costos`, y la pantalla que dice **qué llave se usa de verdad**
(v764-v765).

---

## 3. Pendientes abiertos

### En cola, decididos por el Dr. (sí/no del 31-jul)

| # | Qué | Estado |
|---|---|---|
| 7 | ~~Reembolsos y contracargos en el webhook de Stripe~~ | ✅ GA-004 |
| 2 | ~~Sello «no validado clínicamente» + hoja de reglas~~ | ✅ GA-005 |
| 3 | ~~Tarifas de Anthropic/OpenAI, presentadas y cargadas con su confirmación~~ | ✅ GA-006 |
| 5 | ~~Fin del trial: bloquear IA, agenda y expediente en solo lectura~~ | ✅ GA-009 |

### ⚠️ Acción del Dr. — y ahora la app la comprueba sola

**GA-007:** `/superadmin/costos` le pregunta a Stripe a qué eventos está suscrito
el webhook y avisa en rojo si faltan los tres de devolución. Ya no depende de que
nadie se acuerde. Sigue haciendo falta picarle en el panel — eso no lo puedo
hacer yo — pero deja de ser invisible.

### ⚠️ Acción del Dr. — sin ella, GA-004 no sirve de nada

**Hay que habilitar los tres eventos nuevos en el panel de Stripe.** Stripe sólo
envía los eventos a los que el endpoint está suscrito: el código ya sabe
atenderlos, pero si no están marcados **nunca llegan**, y el resultado sería
idéntico a no haberlo programado.

`dashboard.stripe.com` → Developers → Webhooks → el endpoint de
`agenda-medica-one.vercel.app/api/stripe/webhook` → **Add events**:

    charge.refunded
    charge.dispute.created
    charge.dispute.closed

Es exactamente el fallo de «escrito, probado y sin conectar»: código correcto,
pruebas en verde, y ningún efecto en la realidad.

### P0 de la auditoría todavía sin abordar

| # | Qué | Bloqueado en |
|---|---|---|
| **P0-2** | **24** motores sin validar (23 `pendiente_validacion` + 1 `experimental`), varios en el camino de la receta. Ya son VISIBLES en pantalla y listados en `/cumplimiento/motores` con su pregunta pendiente | **Criterio clínico del Dr.** — `NEEDS_CLINICAL_REVIEW`. El trinquete de `clinical-sellos.test.ts` obliga a bajar el techo cuando valide alguno |
| **P0-5** | **CERRADO en GA-010** para la capa que sí se puede probar hoy: `golden-flow.emu.test.ts` recorre paciente → cita → nota → firma → cobro contra las reglas REALES, y Playwright entró al CI. **Sigue pendiente el E2E de NAVEGADOR**: necesita una cuenta de médico con contraseña en los secretos del CI — decisión del Dr., no mía | él (cuenta de prueba) |
| **P0-6** | Backup / PITR / restore drill: cero evidencia | consola de Firebase (él) + documentar (yo) |
| ~~P0-7~~ | ~~`TARIFAS` vacío~~ — **CERRADO en GA-006.** 11 tarifas cargadas de la página de cada proveedor, con URL y fecha | — |

### P1

| # | Qué |
|---|---|
| ~~**P1-1**~~ | **CERRADO en GA-011 (v776).** Motor puro `lib/pacientes/duplicados.ts` + 29 pruebas. La regla vieja fallaba en las dos direcciones: se le escapaban los duplicados reales (acentos, apellidos invertidos, y el nombre NI SE COMPARABA cuando había teléfono) y alarmaba de lo que no lo era (la familia que comparte celular). Dos reglas nuevas: el teléfono nunca basta solo, y la fecha de nacimiento SEPARA. El aviso salió del guardado y ahora aparece mientras se escribe, ofreciendo «abrir su expediente». Misma red añadida al alta de Hospitalización. **Queda declarado, a propósito**: el alta desde el Asistente sigue fundiendo sólo por coincidencia EXACTA. Ahí no hay nadie a quien preguntar, y fundir a dos personas distintas es peor que un duplicado |
| ~~**P1-2**~~ | **CERRADO en GA-012 (v777).** El gesto del médico ya existía (panel de revisión) pero se guardaba como un número suelto: «camposAprobados: 3» dice cuántos aceptó, no CUÁLES. Ahora el sello lo lleva campo por campo, con distintivo aparte del de origen — un dato puede venir del dictado Y estar aceptado. **La trampa**: el panel numera sobre la extracción y el sello sobre la nota final; comparar índices habría dado por aceptado el diagnóstico equivocado. Se cruza por el índice de la extracción. `confirmados` es opcional: en las notas viejas «no consta» ≠ «cero» |
| ~~**P1-3**~~ | **CERRADO en GA-012 (v777).** Precio y créditos derivados de `PLANES` + centinela `planes-precios.test.ts`. Salió una **mentira viva**: el plan Hospital anunciaba «400 créditos/mes» y son **500** |

### Deuda técnica congelada

- **Lint: 104 errores** en el trinquete (`docs/audit/lint-techo.json`). Bajó de 105 en GA-009 al arreglar un `Date.now()` impuro en el render.
- **CSP sigue en report-only** salvo `frame-ancestors`. Pasarla a enforce exige
  días de observación de reportes; la observación **no se ha arrancado**.
- ~~**A7**~~ — **CERRADO en GA-013 (v778).** **Todas** las rutas que gastan dejan
  asiento, y hay un centinela (`libro-costos-cobertura.test.ts`) que recorre el
  disco y falla si aparece una nueva sin él. El peor hueco era
  `transcribir-chunk` —el texto en vivo, cada ~20 s de cada consulta—: el gasto
  de voz salía sistemáticamente por debajo del real. El centinela encontró tres
  más en su primera ejecución. La causa de fondo era el tipo: `Proveedor` era
  `'anthropic' | 'openai'` y la app le paga a **tres** (AssemblyAI hace la
  separación de voces). **Queda declarado**: la tarifa de AssemblyAI NO está
  cargada —no la he leído de su página— así que su costo sale **nulo**, nunca
  cero. Lo de «5 de 16 por el gateway» sigue igual y ya no importa para el
  dinero: el asiento está garantizado por las dos vías.
- **A8**: el dataset V3 de antimicrobianos fusiona ficha y guía en 11 de 49 entradas.
- ~~**Tarifa de caché sin cargar**~~ — **CERRADO en GA-007.** Era 0.1× la entrada
  y estaba cobrándose completa: un error de 10× sobre el renglón más grande del
  costo de texto, porque el prompt de la nota va cacheado. Declararlo en vez de
  ir a buscarlo fue pereza mía; el Dr. lo señaló.
- ~~**Caché de OpenAI**~~ — **CERRADO en GA-008.** Y con una lección: su
  proporción **no es la de Anthropic**. `gpt-5` va a 0.1×, pero `gpt-4o` va a
  **0.5×**. Deducirla en vez de leerla habría metido un error de 5× en gpt-4o.
  Hay una prueba con ese nombre.
- ~~**Sonnet 5 a precio de LISTA**~~ — **CERRADO en GA-013 (v778).** La tarifa
  ahora admite una ventana con fecha, y el asiento se valora con el `ts` de la
  llamada: una nota de agosto cuesta $2 y una de septiembre $3, que es la verdad
  de cada una. Sin fecha se cae al precio de LISTA a propósito — sobrestimar el
  costo hace cobrar de más, subestimarlo hace vender por debajo del costo sin
  enterarse, y sólo uno de los dos errores quiebra un negocio.

---

## 4. Decisiones tomadas por el Dr. — asentadas

| Decisión | Qué implica |
|---|---|
| **MFA queda OPCIONAL** por usuario | **Riesgo aceptado por el dueño**, declarado aquí a propósito para que el pentest lo vea asentado y no lo descubra como hallazgo. No es un olvido. |
| **Sin paquetes para terceros** (#8) | El de abogado se trata aparte. Los de pentest y contador quedan disponibles si los pide. |
| **Trial: 14 días**, y al terminar se bloquea la IA con agenda y expediente en **solo lectura** | Nunca se le borra nada ni se le cierra el expediente a un médico que no pagó. Implementación en cola (#5). |
| **Precios**: se conservan $349 / $899 / $1,590 | Hasta tener COGS y comportamiento real. No optimizar precio sin datos. |

---

## 5. Lo que NO está roto (no volver a auditar)

Comprobado ejecutando, no de memoria:

- **Doble reserva**: transacción real en las dos vías (interna y portal público)
- **Webhook de Stripe**: firma verificada + candado atómico `create()` por sesión e invoice
- **Trial**: `trial_period_days: 14` en el checkout, con tarjeta obligatoria
- **Cobro de consulta**: `runTransaction`, sin doble cobro
- **kg ↔ lb en pediatría**: la guarda **existe** (`pediatria.ts`) — cierra un `NEEDS_CLINICAL_REVIEW` que seguía abierto en mis notas
- **Zona autenticada**: anti-clickjacking en enforce desde antes de esta sesión
- **Aislamiento entre consultorios**, **sanitización de logs**, **arquitectura sin ciclos**
