# Carril · Excelencia de producto — bitácora de defectos

> **Qué es esto.** El registro de esta rama (`product/ausculta-product-excellence`),
> con el mismo rigor que `regression-ledger.md`: qué fallaba, cómo se
> descubrió, la causa raíz, la familia, el guardián que lo cierra y **qué no
> cubre**.
>
> **Por qué vive aparte, y no en el ledger canónico.** Este carril corre **en
> paralelo** a otro que está trabajando sobre `docs/audit/regression-ledger.md`,
> `docs/quality/FAMILIAS-DE-DEFECTO.md` y `src/lib/calidad/familias-de-defecto.ts`
> — los tres a la vez, porque el guardián
> `de-que-se-enferma-este-sistema.test.ts` obliga a tocarlos juntos: todo REG del
> ledger tiene que estar clasificado, y el documento tiene que decir el conteo.
> Meter aquí un `REG-349` significaría chocar en el número **y** en el texto de
> tres archivos que el otro carril está editando hoy.
>
> Así que se deja escrito aquí, entero, y **el número de REG se asigna al
> fusionar**. Lo que no puede pasar es que se pierda: por eso está en un archivo
> propio y no en un mensaje de commit.
>
> Ninguno de estos defectos toca un motor clínico determinista, así que ninguno
> pide sello en `src/lib/clinical/invariantes-clinicos.json`. Los guardianes son
> de interfaz, de tema y de contrato entre lector y escritor.

---

## El hilo que une a los cinco

No se salió a buscar cinco cosas sueltas. Se tiró de una: **el producto tiene
un segundo tema y una auto-reparación, y las dos estaban calladamente rotas**.
Cada defecto apareció al comprobar el anterior.

| # | Qué se veía | Familia |
|---|---|---|
| 1 | El tema claro del sistema operativo no era el tema claro | depende de que alguien se acuerde |
| 2 | La gravedad clínica se codificaba con un color de un solo tema | el sistema se contradice a sí mismo |
| 3 | La purga de versión desfasada no corría desde el cambio de marca | escrito, probado y sin conectar |
| 4 | El 404 decía una versión que no existía, y salía oscuro en una app clara | depende de que alguien se acuerde |
| 5 | «Automático» no sobrevivía a una recarga | el hueco tratado como dato |
| 6 | Lo mismo que el 2, en las pantallas del día del médico | el sistema se contradice a sí mismo |
| 7 | La agenda no sabía qué días existen ni hasta cuándo llega | el sistema se contradice a sí mismo |
| 8 | Reservar dos veces eran dos citas, y el aviso culpaba a un extraño | el mensaje mentía sobre la causa |
| 9 | El arnés visual nunca conectó a los emuladores | depende de que alguien se acuerde |
| 10 | La aplicación llamaba «Dr.» a toda médica | el sistema se contradice a sí mismo |
| 11 | «31 De Agosto» en siete pantallas, arreglado en una | depende de que alguien se acuerde |
| 12 | El portal del asistente se paraba en 12 meses | el sistema se contradice a sí mismo |
| 13 | Un fallo de red se contaba como una contraseña equivocada | el mensaje mentía sobre la causa |
| 14 | La portada no se movía, y el sistema de movimiento estaba sin usar | el charter existía sin encarnar |

Y el orden importa: **el 5 es el que hace alcanzables al 1 y al 2.** Mientras
«automático» no sobreviviera a una recarga, el bloque
`@media (prefers-color-scheme: light)` casi no se activaba nunca, y arreglarlo
habría sido arreglar código muerto.

---

## 1 · El tema claro del sistema operativo era otro tema claro

**Qué fallaba.** `globals.css` declara la paleta clara dos veces —una para el
interruptor (`:root[data-theme="light"]`) y otra para el sistema operativo
(`@media (prefers-color-scheme: light)`)— y la segunda se había quedado atrás en
siete tokens: `--elev-1/2/3`, `--warn-bg`, `--warn-border`, `--warn-text`,
`--success`.

**Qué se veía.** Quien nunca tocó el interruptor heredaba de `:root` las sombras
**negras** del tema oscuro sobre el lienzo hueso. El comentario del bloque
explícito ya decía por qué eso está mal: «una sombra negra sobre blanco se lee
como suciedad». Tarjetas, modales y menús, toda la app. Y el recuadro de aviso
se pintaba con el ámbar translúcido calculado para fondo oscuro.

**Cómo se descubrió.** Al añadir `--rosa` hubo que escribirlo en dos sitios. Esa
fricción es el síntoma; se compararon los dos bloques token a token.

**Causa raíz.** CSS no puede compartir un bloque de declaraciones entre un
selector y una media query, así que la duplicación es inevitable. Lo que no era
inevitable es que nadie la vigilara.

**Guardián.** `src/__tests__/el-tema-claro-es-uno-solo.test.ts` — compara los dos
bloques token a token. Probado al revés: quitando las tres elevaciones del
auto-claro, falla.

**Qué NO cubre.** No juzga los valores, sólo que los dos caminos digan lo mismo.
No mira el tema oscuro (tiene un solo camino, que es por lo que nunca se
desfasó). No detecta un token que falte en los dos.

---

## 2 · La gravedad clínica se codificaba con un color que sólo se lee en un tema

**Qué fallaba.** Ocho paneles clínicos pintaban la gravedad con literales de la
paleta de Tailwind en vez de con los tokens semánticos —que ya existían, ya
estaban medidos para los dos temas, y que los propios archivos usaban a dos
renglones de distancia. Medido sobre `--s1` (WCAG 2.1; el mínimo AA es 4,5):

| literal | oscuro | claro |
|---|---:|---:|
| `#f87171` rojo | 6,61 | **2,77** |
| `#f59e0b` ámbar | 8,52 | **2,15** |
| `#22c55e` verde | 8,03 | **2,28** |
| `#dc2626` rojo | **3,79** | 4,83 |

**Qué se veía, y por qué importa.** La jerarquía quedaba invertida justo donde
peor cae. En `GraficaLab`, `#dc2626` es el color del valor de laboratorio
**crítico o fuera de rango**: el número que existe para saltar a la vista era el
peor leído del panel en tema oscuro. En `ValoracionInmuno`, de los tres niveles
de `SEV_COLOR` el único que reprobaba era `alta`.

El tema claro es el que enciende la luz del consultorio, así que la mitad peor
leída es la que más se usa.

**Causa raíz.** Deriva, no decisión: lo que
`docs/design/GENERIC_AI_AESTHETIC_AUDIT.md` mide como «el sistema existe y la
aplicación lo esquiva».

**Lo que se hizo además.** El primer plano sobre relleno semántico pasa a
`--sobre-aviso` (tinta en oscuro, blanco en claro, porque los rellenos son
brillantes en uno y profundos en el otro). Los tintes `rgba()` a mano pasan a
`color-mix` con su token. Se añade `--rosa`, que no es un color nuevo sino el
acento de ginecología que vivía como literal y no tenía cara clara: medido
5,50:1 en oscuro y 5,02:1 en claro, los dos sobre `--s3`.

**Guardián.** `src/__tests__/el-color-de-la-severidad-se-lee-en-los-dos-temas.test.ts`
— calcula el contraste con la fórmula de luminancia relativa y comprueba
primero que sabe reproducir los números ya medidos en `globals.css`, para que la
prueba pueda fallar. Probado al revés. Trinquete de diseño: `hexEnLinea`
485 → 385, `halosDeColor` 7 → 6.

**Qué NO cubre.** Es un barrido de fuente, no del árbol pintado. Sólo mira los
ocho paneles de la lista: uno nuevo no se vigila hasta que se añada. No juzga el
fondo — un token de texto sobre un fondo equivocado sigue siendo ilegible.

**Excepciones declaradas.** El HTML que `ValoracionInmuno` exporta a Word y la
hoja impresa de `PanelCardiometabolico`: salen del navegador y viajan solos, así
que ahí un `var(--red)` se pintaría negro.

---

## 3 · La purga de versión desfasada llevaba muerta desde el cambio de marca

**Qué fallaba.** `ServiceWorkerRegister` compara la versión que sirve el sitio
(`/version.txt`) contra la que tiene viva el navegador, para detectar que el
usuario se quedó con JS viejo mezclado con HTML nuevo —el «no me abre nada y va
lentísimo» que describe su propio comentario— y purgar. Buscaba el sello con el
prefijo de la marca **nueva**; lo que escriben `sw.js` y `version-sw.mjs` es
`nexusmed-vNNN`, y tiene que seguir siéndolo: `marca.ts` lo declara en
`NO_SE_RENOMBRAN`.

La expresión no casaba nunca. `servidor` y `local` salían los dos `null`, la
guarda devolvía, y la auto-reparación no corría jamás. **Sin error, sin aviso y
con la suite entera en verde.**

**Por qué duró.** Los tres guardianes del sello miraban a quien lo **escribe** —
`version.txt` y `sw.js` conservan el prefijo, y lo comprueban— y ninguno miraba
a quien lo **lee**. El renombrado cruzó la frontera por el lado que nadie
vigilaba. Es `.claude/rules/el-dato-tiene-que-llegar.md` en su forma pura.

**Causa raíz.** Familia «escrito, probado y sin conectar», con el agravante de
que el módulo sí corría: lo que no llegaba era el dato.

**Guardián.** Dos casos nuevos en
`src/__tests__/renombrar-la-marca-no-borra-el-audio.test.ts`: que el lector no
busque el prefijo de la marca nueva, y que el prefijo que lee **case** contra
los archivos reales que sirve el sitio hoy. Probado al revés.

**Qué NO cubre.** No comprueba que la purga funcione en un navegador —
desregistrar el service worker y borrar cachés necesita uno—. Comprueba que la
comparación que la dispara ya no es imposible.

---

## 4 · El 404 decía una versión que no existía, y se pintaba oscuro en una app clara

**Qué fallaba.** Tres cosas, y las tres se notan justo cuando ya algo va mal:

1. **El sello mentía.** El recuadro de diagnóstico escribía a mano
   `Build: 2026-06-03-ausculta`. El sello real vive en `public/version.txt` y
   dice `nexusmed-v1174`: llevaba casi tres meses desfasado y ni siquiera tenía
   la forma del sello real. Ese recuadro es lo que el médico copia y manda al
   reportar «no me abre», así que soporte recibía un identificador falso.
2. **Se pintaba oscuro dentro de una app clara.** Lienzo y tinta fijos. Lo
   justificaba un comentario del propio archivo: esta página «vive FUERA del
   shell y no hereda sus tokens». Era falso, y el mismo archivo lo desmentía dos
   líneas más arriba usando `var(--nexus)`.
3. **Contraste bajo AA.** `#6C7075` sobre el lienzo oscuro da **3,93:1**. Lo
   llevaban el texto de ayuda y la etiqueta «URL fallida:».

**Causa raíz.** Para (1), familia «depende de que alguien se acuerde». Para (2)
y (3), un comentario que declaraba una limitación inexistente: nadie vuelve a
comprobar lo que ya está explicado.

**Lo que se hizo.** La versión se pide a `/version.txt` y, si no se puede leer,
**el renglón no existe**: una versión inventada es peor que ninguna porque nadie
duda de ella.

**Guardián.** `src/__tests__/el-404-dice-la-version-que-hay.test.ts`. Mira el
código **sin comentarios**, porque los comentarios de este repositorio citan el
defecto que arreglaron y un guardián ingenuo se dispara con su propia
explicación. Probado al revés: fallan cuatro de sus siete casos.

**Qué NO cubre.** No abre un navegador. No comprueba la auto-reparación del
service worker que hace esa página. No dice nada de `global-error.tsx`, que sí
tiene paleta fija **con razón**: se activa cuando ni el layout carga.

---

## 5 · «Automático» no sobrevivía a una recarga

**Qué fallaba.** El control del tema tiene tres modos y uno es **automático**
(«sigue al sistema operativo», con su icono y su texto). Se guardaba **borrando
la llave** de `localStorage`. Así que «elegí automático» y «nunca elegí nada»
quedaban escritos igual: sin dato. Y los dos lectores leían esa ausencia como
oscuro:

- el guion en línea del `<head>` de `layout.tsx`, que corre antes de React;
- `useTema`, con su propio `?? 'dark'`.

**Qué se veía.** El médico elegía automático, el tema seguía al sistema… hasta
la siguiente carga. Al recargar —o al abrir la aplicación instalada, que es como
se abre cada mañana— volvía a oscuro, y el control decía «oscuro» **como si lo
hubiera elegido él**.

**Cómo se descubrió.** Barriendo llaves de `localStorage` que se escriben y
nadie lee, y al revés. `nexusmed.theme` salió como «se lee y nadie lo escribe»,
que era un falso positivo del barrido —se escribe desde una variable— pero al ir
a comprobarlo apareció esto.

**Causa raíz.** Regla 4 de seguridad clínica dicha en lenguaje de interfaz:
**ausencia de dato no es dato de ausencia**. Un hueco no puede representar una
elección, porque entonces no se distingue del silencio. Con el agravante de dos
lectores con su propia copia de la tabla.

**Lo que NO cambia.** El valor de fábrica sigue siendo oscuro: es la identidad
de la marca y es una decisión de producto. Lo único que cambia es que
«automático» se escribe.

**Guardián.** `src/__tests__/el-tema-automatico-sobrevive-a-una-recarga.test.ts`
— ejecuta el guion **real** del `<head>` contra un `localStorage` y un
`documentElement` de mentira, para los cinco valores posibles, y comprueba que
coincide con la tabla del hook. Probado al revés.

**Qué NO cubre.** No abre un navegador: comprueba la decisión, no el píxel.
**No migra** al médico que ya tenía «automático» guardado como hueco: para el
código eso era «nunca eligió», y seguirá en oscuro hasta que lo vuelva a
elegir. Se declara a propósito — inventarle una preferencia sería el mismo error
al revés.

---

## 6 · Lo mismo que el 2, en las pantallas del día del médico

**Qué fallaba.** El mismo literal en vez de token, ahora fuera de los paneles
clínicos: la **prioridad** de la lista de espera, el **stock bajo** y el
**caducado** de farmacia, el dinero que **sube o baja** en finanzas, el aviso
**urgente** de la caja de herramientas y el color con el que se distingue a un
médico de otro.

Se separa del 2 a propósito: aquel se arregló mirando los paneles clínicos, y
esto es lo que quedaba al mirar el resto del camino del día. Misma causa, misma
medida, mismo guardián — que ahora cubre las dos listas.

**Lo que se encontró de paso.** `DoctorFilter` tenía **dos implementaciones
idénticas** de la misma función `id → color`: la privada `colorFor` y la
exportada `colorMedico`. El sentido de ese color es que sea EL MISMO para un
médico en toda la aplicación; dos copias de la tabla son la forma de que un día
deje de serlo. Ahora hay una.

Los cinco tonos del avatar eran pasteles de tema oscuro y **tres de los cinco**
quedaban bajo 4,5:1 en claro. Pasan a `--nexus`, `--purple`, `--amber`,
`--blue` y `--rosa`: siguen siendo cinco tonos distinguibles, y los cinco están
medidos en los dos temas. La inicial que va encima usa `--sobre-aviso`.

**Guardián.** El mismo de la entrada 2, con la lista ampliada. Se le añade el
descomentado de fuentes: los comentarios de este repositorio citan el literal
que arreglaron —ahí está la evidencia del defecto— y un guardián ingenuo se
dispara con su propia explicación. Probado al revés.

**Trinquete de diseño.** `hexEnLinea` 385 → 357. Acumulado del carril:
**485 → 357**, y `halosDeColor` 7 → 6.

**Qué NO cubre.** Sigue siendo un barrido de fuente sobre una lista declarada.
Quedan literales en pantallas que este carril no tocó —el módulo de hospital y
UCI (ALPHA), `superadmin`, las páginas legales y los documentos impresos— y el
trinquete de diseño los cuenta.

---

## 7 · La agenda no sabía qué días existen, ni hasta cuándo llega

**FOUND — dos defectos, y el segundo tapaba al primero.**

**a) Fechas que no existen, atendidas como si existieran.** Las tres rutas que
validaban algo usaban `/^\d{4}-\d{2}-\d{2}$/`: forma, no calendario.
`2027-02-30` la pasa, y `new Date('2027-02-30T12:00:00')` no falla — DESBORDA al
2 de marzo. Medido con un horario de 09:00–14:00 cada 30 min, antes del arreglo:

    2027-02-30 → JS 2027-03-02 → horario=sí → 10 huecos
    2027-02-31 → JS 2027-03-03 → horario=sí → 10 huecos
    2026-04-31 → JS 2026-05-01 → horario=sí → 10 huecos
    0000-01-01 → JS 0000-01-01 → horario=sí → 10 huecos

La cita se validaba contra el horario, la bandera de activo y los festivos de
**otro día**, y se guardaba con la fecha imposible. Y como el chequeo de solapes
consulta `fechaHora >= '2027-02-30 00:00'`, **no chocaba** con las citas reales
del 2 de marzo: doble reserva sobre el mismo hueco del médico, en una cita que
no aparece en la vista de ningún día.

**b) No había techo, y las cinco entradas no se ponían de acuerdo.**
`9999-12-31` generaba sus diez huecos. `/api/appointments` —la vía del médico y
de la asistente— no miraba la fecha en absoluto: `fechaHora.slice(0, 10)` y
adelante. El POST de reserva pública y el portal sólo miraban la forma. Y
`GET /api/public/availability` sí tenía un tope de un año… que el POST de
reserva **no aplicaba**: la disponibilidad se negaba a OFRECER un hueco a tres
años y el endpoint de reserva lo ACEPTABA con una petición directa. Es la
lección que ese mismo archivo ya tiene escrita dos veces, para los descansos y
para los bloqueos. Ese tope además contestaba `200 { ok: true, slots: [] }`:
para el navegador, indistinguible de un día lleno o cerrado. Y se medía contra
`new Date()` del servidor, que en Vercel es UTC — a partir de las 18:00 en
México la ventana se corría un día.

**ROOT_CAUSE.** Familia «el sistema se contradice a sí mismo»: cinco entradas de
fecha, cinco criterios distintos y ninguno completo. Una comprobación de FORMA
se lee como una comprobación de VALIDEZ, y nadie vuelve a mirarla.

**FILES_OWNED.** `src/lib/agenda/horizonte.ts` (nuevo) ·
`api/appointments` · `api/public/booking` · `api/public/availability/[clinicId]` ·
`api/portal` · `citas/page.tsx` · `AppointmentModal.tsx` · `mi/[token]/page.tsx` ·
`lista-espera/page.tsx`.

**CROSS_LANE_CHECK.** El otro carril no toca **nada** de agenda, reservas,
disponibilidad, portal ni WhatsApp (comprobado contra su diff). Único roce:
`docs/design/SCREEN_INVENTORY.md`, que lleva el conteo de líneas por pantalla y
hubo que regenerar. Sus filas son `/consulta/[patientId]`, `/consultor`,
`/cumplimiento/*`, `/pacientes` y `/pendientes`; las mías son `/mi/[token]`,
`/citas` y `/lista-espera`. Filas distintas, sin solape — verificado con
`git merge-tree`: **cero conflictos añadidos**.

**CHANGE.** Una puerta única, `src/lib/agenda/horizonte.ts`. Una fecha sirve si
tiene la forma, **existe en el calendario** y cae en
`[2000-01-01, 2050-12-31]`. La existencia se comprueba con un viaje de ida y
vuelta en UTC —construir y verificar que las tres partes vuelvan iguales—, que
cubre los bisiestos sin tabla propia. La ventana del portal público (un año)
sube al mismo módulo y ahora la aplican **el GET y el POST**, medida contra el
día de la clínica con `hoyISO(tz)`, y devuelve un motivo en vez de una lista
vacía. Los cuatro campos de fecha de la interfaz llevan `max`.

**No se pregeneran fechas.** El horizonte llega a 2050 y enumerarlo serían
~9 000 cadenas vivas para contestar una comparación de texto: `YYYY-MM-DD`
ordena igual como texto que como fecha. Hay un guardián que comprueba que el
módulo no cría una lista de días.

**REGRESSION.** `la-agenda-tiene-un-horizonte-y-un-calendario.test.ts`, 32
casos. Probado al revés **dos veces**: quitando la comprobación de calendario y
el techo caen 14 casos; quitando la validación de `/api/appointments` cae el
caso de conexión. La segunda vuelta encontró un defecto **en el propio
guardián**: `toContain('validarFechaHoraDeAgenda')` se satisfacía con la línea
del `import`, así que la ruta podía importar la puerta y no llamarla —«escrito y
sin conectar» colándose dentro del guardián que existe para cazarlo. Ahora se
miran las llamadas, no los `import`.

Y una fragilidad ajena corregida de paso: `portal-reagenda-google.test.ts`
recortaba el cuerpo de un `case` a 900 y 2 600 caracteres «a ojo». Cualquier
línea nueva dentro del `case` lo ponía en rojo sin que el invariante se hubiera
roto. Ahora recorta hasta el `case` siguiente.

**BROWSER_PROOF.**

*Servidor vivo* — `npm run build && npm start`, matriz completa en
`docs/audit/carril-excelencia/acta-horizonte-agenda.md`. El 500 por falta de
credenciales de Firebase es la prueba de que la fecha **pasó** la puerta; lo
rechazado no llega a tocar la base:

| Fecha | HTTP | Lectura |
|---|---|---|
| 2027-03-15 · 2030-06-20 · 2040-02-29 · 2050-01-01 · **2050-12-31** | 500 | aceptadas |
| **2051-01-01** · 2099-12-31 · 9999-12-31 | 400 | «La agenda llega hasta el 2050-12-31.» |
| 2027-02-30 · 2026-04-31 · 2027-13-01 · **2039-02-29** | 400 | «Esa fecha no existe en el calendario.» |
| 0000-01-01 | 400 | «La agenda no admite fechas anteriores al 2000-01-01.» |

2040 bisiesto se acepta y 2039-02-29 se rechaza, sin tabla de bisiestos.

*Chromium real, 390 / 768 / 1440* — el `max` que se añadió a los campos: con
`2050-12-31` el campo es válido; con `2051-01-01` y `2099-12-31`,
`validity.rangeOverflow = true` y `checkValidity() = false`; el `min` sigue
funcionando (`rangeUnderflow`). Idéntico en los tres anchos.

*Capturas* — `/` y `/reservar/demo` a los tres anchos, sin desbordamiento
horizontal, en `docs/audit/carril-excelencia/capturas/`. Harness reutilizable:
`scripts/carril-excelencia/capturar.mjs`.

**GATES.** `vitest` entero · trinquete de lint 95 (sin deuda nueva) · trinquete
de diseño sin deuda nueva · `npm run build` compila.

**SCORE_BEFORE → SCORE_AFTER.** Entradas de fecha con validación completa
(calendario + techo): **0 de 5 → 5 de 5**. Superficies que aplican la ventana
pública: **1 de 2 (y en silencio) → 2 de 2 (con motivo)**. Campos de fecha de la
interfaz con tope: **0 de 4 → 4 de 4**.

**RESIDUAL_RISK.**

- El recorrido HTTP **completo** de reserva —crear una cita real y volver a
  leerla— necesita credenciales de Firebase o emuladores; aquí sólo se probó que
  la puerta de fecha acepta y rechaza lo que debe. Lo que llega a Firestore
  queda sin recorrer en navegador.
- La ventana pública no se pudo probar por HTTP: se comprueba **después** de
  leer la configuración de la clínica, y sin credenciales no hay clínica. Está
  cubierta por casos unitarios y por el barrido que confirma que las dos rutas
  la llaman con `hoyISO`.
- El techo de 2050 y el suelo de 2000 son decisiones de plataforma que este
  carril declara, no política del dueño. Si quiere otro, se cambia en un sitio.
- **No se tocó WhatsApp.** `api/whatsapp/webhook` maneja fechas para el flujo
  conversacional y merece su propia unidad; queda anotado en NEXT.

**NEXT.** Recorrido de reserva del paciente de punta a punta contra emuladores
(prioridad 2), que además desbloquea el navegador para las pantallas
autenticadas.

---

## 8 · Reservar dos veces eran dos citas, y el aviso culpaba a un extraño

**FOUND — tres cosas, recorriendo el alta del paciente en un navegador real.**

**a) El reenvío se trataba como conflicto ajeno.** Enviando tres veces la misma
reserva contra el emulador: `200`, luego `409 «Ese horario acaba de ocuparse.
Elige otro.»` dos veces. Se le dice al paciente que **otra persona** le quitó el
hueco cuando quien lo tomó fue él. Lo razonable entonces es elegir otra hora — y
acabar con dos citas, y el consultorio con dos avisos de «🔔 Nueva cita».

El doble clic es el caso amable. El que duele es el **resultado desconocido**:
el servidor crea la cita y la respuesta se pierde por el camino. El paciente no
tiene forma de saber que ya la tiene.

**b) «Lun 31 De Ago».** `text-transform: capitalize` pone mayúscula en cada
palabra — la regla del inglés. En español las preposiciones no la llevan. Las
doce fichas de la pantalla donde el paciente elige el día de su cita estaban mal
escritas.

**c) El calendario del paciente llegaba a 14 días; el servidor, a un año.** La
ventana de reserva en línea (`DIAS_VENTANA_RESERVA_PUBLICA = 365`) existía en el
servidor y **ninguna superficie llegaba a ella**: quien necesitaba cita a seis
semanas no tenía forma de pedirla. Familia «escrito y sin conectar».

**ROOT_CAUSE.** (a) el chequeo de solape no distinguía «alguien ocupa este
hueco» de «TÚ ocupas este hueco» — una reserva repetida solapa consigo misma por
definición. (b) una regla tipográfica de otro idioma. (c) una constante local de
14 que nadie volvió a mirar cuando el servidor abrió el año.

**FILES_OWNED.** `src/lib/agenda/reserva-repetida.ts` (nuevo) ·
`src/lib/texto-es.ts` (nuevo) · `api/public/booking/route.ts` ·
`reservar/[clinicId]/page.tsx` · `scripts/carril-excelencia/*`.

**CROSS_LANE_CHECK.** Ninguno de estos archivos está en el diff del otro carril.
`git merge-tree`: **cero conflictos añadidos**.

**CHANGE.** La reserva se vuelve **idempotente**: reenviar exactamente la misma
—mismo teléfono normalizado a diez dígitos, mismo `fechaHora`, mismo tipo, cita
viva— devuelve la que ya existe con `yaExistia: true` y **el mismo `citaId`**, y
sale antes de los avisos para no anunciar dos veces la misma cita. Ante la duda
NO se fusiona: sin teléfono, dos reservas no son la misma, porque juntar las
citas de dos personas es mucho peor que crear una de más. La decisión vive en un
módulo puro para poder probarla en CI. La mayúscula pasa del CSS al texto. Y el
calendario crece de cuatro en cuatro semanas hasta la ventana real, sin
pregenerar el año.

**REGRESSION.** `reservar-dos-veces-no-son-dos-citas.test.ts`, 12 casos.
Probado al revés **dos veces**: quitando la rama del reenvío cae «el reenvío gana
al conflicto»; quitando la salida temprana cae «devuelve la cita que ya existía».
Un caso vigila que los avisos de WhatsApp queden **después** de esa salida.

**BROWSER_PROOF.** Chromium real contra emuladores, 390 / 768 / 1440 — los ocho
pasos del recorrido hasta «¡Cita solicitada! ✅», sin errores de consola ni
desbordamiento horizontal. Acta y capturas en
`docs/audit/carril-excelencia/acta-recorrido-reserva.md`.

Y **el dato llegó**: se leyó Firestore después, sin fiarse de la pantalla de
éxito. Tres corridas, tres citas en tres huecos distintos (09:00 · 09:45 ·
10:30) porque cada una tomó el primero realmente libre.

Tras el arreglo: tres envíos → **una** cita, el mismo `citaId`, `yaExistia`.
Otro paciente sobre ese hueco sigue recibiendo `409`. Domingo, festivo, hora de
comida, fuera de ventana, sobre el techo y fecha imposible: todos rechazados con
su motivo propio. Nueve envíos desde una IP: `429`.

«Ver más días» medido en navegador: 24 → 48 fichas, hasta «Sáb 24 de oct», y el
botón mide **44 px** de alto — el mínimo táctil que pide la regla de diseño.

**GATES.** `vitest` entero · lint 95 · diseño sin deuda nueva · build compila.
El trinquete de diseño **cazó** el `fontSize: 13` del botón nuevo; se arregló el
cambio (`var(--t-body)`), no el techo.

**SCORE_BEFORE → SCORE_AFTER.** Envíos duplicados que crean cita de más:
**2 de 3 → 0 de 3**. Fichas de día mal escritas: **12 de 12 → 0**. Días
alcanzables por el paciente: **14 → 365**, en pasos de 28.

**RESIDUAL_RISK.**

- La idempotencia **no tiene ventana de tiempo**: un reenvío tres días después
  también devuelve la cita existente. Es correcto —sigue siendo la misma cita—
  pero significa que esto es idempotencia, no un anti-doble-clic.
- **No cubre el alta desde el panel** (`/api/appointments`). Ahí hay sesión y
  una asistente que ve la agenda, así que el reenvío ciego no es el mismo
  problema; queda declarado, no resuelto.
- Dos personas que comparten teléfono y piden el mismo hueco del mismo tipo se
  tratan como la misma reserva. El hueco es uno, así que no se pierde ninguna
  cita posible, pero está dicho.
- El portal público muestra el **slug crudo** de un tipo de cita que no esté en
  su tabla de etiquetas (`TIPO_LABEL[t.tipo] ?? t.tipo`). Se vio al sembrar una
  clave no canónica: el paciente leía «urgencia» en minúscula entre tres
  etiquetas capitalizadas. No se tocó — es config inválida, no un defecto del
  camino— pero queda anotado.

**NEXT.** Agenda de la asistente/recepción de punta a punta (prioridad 3), con
el mismo arnés y ya con sesión sintética disponible en el emulador.

---

## 9 · El arnés visual nunca conectó a los emuladores

**FOUND.** `npm run arnes:dev` —el comando que existe para poder mirar las
pantallas con sesión y datos sintéticos, sin tocar pacientes reales— exportaba
`NEXT_PUBLIC_FIREBASE_EMULATOR=1` (**singular**). El candado de
`src/lib/firebase.ts` lee `NEXT_PUBLIC_FIREBASE_EMULATORS` (**plural**).

Nunca coincidieron. El navegador salía a `identitytoolkit.googleapis.com` **de
verdad** y el inicio de sesión sintético se quedaba en «Entrando…» hasta que la
red lo cortaba. O sea: el arnés que existe para mirar pantallas no podía abrir
ninguna pantalla con sesión.

**ROOT_CAUSE.** El comentario de cabecera de `firebase.ts` decía el singular y el
código leía el plural. El guion se copió del comentario. Familia «depende de que
alguien se acuerde», agravada: estaba **escrito** en
`agent-state/V15_CURRENT_ITERATION.md` —«el arnés se escribió con el singular y
el candado lee el plural»— y aun así el guion siguió roto. Saberlo y arreglarlo
no son lo mismo.

**FILES_OWNED.** `package.json` · `src/lib/firebase.ts` (comentario) ·
`src/__tests__/emulador-solo-demo.test.ts`.

**CROSS_LANE_CHECK.** Ninguno en el diff del otro carril. Cero conflictos.

**CHANGE.** El guion enciende la variable que el código lee; el comentario deja
de contradecirlo y explica por qué el plural importa.

**REGRESSION.** Cuatro casos nuevos en el guardián que ya existía: que el módulo
lea una sola variable, que **ningún** guion de `package.json` use el nombre
singular, que `arnes:dev` encienda exactamente la que el módulo lee (y con
proyecto `demo-*`), y que el comentario no vuelva a contradecir al código.
Probado al revés: devolviendo el singular al guion, caen dos.

**BROWSER_PROOF.** Antes: `1-login → /login`, botón clavado en «Entrando…»,
traza de red con `POST identitytoolkit.googleapis.com … ERR_CONNECTION_RESET`.
Después: `1-login → /dashboard`, con la agenda real del consultorio sintético
pintada a 390 / 768 / 1440.

**SCORE_BEFORE → SCORE_AFTER.** Pantallas con sesión revisables en navegador:
**0 → todas**. Esto es lo que desbloquea las unidades 10 y 11, y las que vienen.

**RESIDUAL_RISK.** El guardián compara textos; que la conexión funcione se ve en
el navegador, y eso no corre en CI. `arnes:emuladores` sigue asumiendo `brew`
(macOS): aquí se levantó con `npx firebase emulators:start` a mano. No se tocó —
es del entorno del dueño, no del producto.

---

## 10 · La aplicación llamaba «Dr.» a toda médica

**FOUND.** Con la sesión sintética abierta, la barra lateral y el riel de flujo
decían **«Dr. Ximena Alcántara Robledo»**. El portal del paciente, que lee el
nombre de otro documento donde sí venía escrito, decía «Dra.».

El mismo médico con dos títulos según la pantalla, y uno de los dos inventado:

```
const yaTienePrefijo = /^Dr\.?\s+|^Dra\.?\s+/i.test(config.nombreMedico)
return yaTienePrefijo ? config.nombreMedico : `Dr. ${config.nombreMedico}`
```

**ROOT_CAUSE.** Un valor de fábrica que parece cortesía y es una suposición. En
un país donde la mitad de los médicos son médicas, acierta la mitad de las
veces. Y estaba **dos veces**, con la misma expresión regular copiada.

**FILES_OWNED.** `src/lib/nombre-medico.ts` (nuevo) · `Sidebar.tsx` ·
`FlowRail.tsx`.

**CROSS_LANE_CHECK.** Ninguno en el diff del otro carril. Cero conflictos.

**CHANGE.** El software no adivina el género de nadie. Si el médico escribió un
título, se enseña; si no, se enseña su nombre. La regla vive en un módulo, no en
dos copias.

**LA DECISIÓN, DICHA PARA QUE SE PUEDA REVERTIR.** El coste es que quien escribió
sólo su nombre deja de ver un título. Se prefiere un nombre sin título a un
título equivocado. Si el dueño quiere un valor de fábrica, se pone en
`@/lib/nombre-medico`, en un sitio.

**REGRESSION.** `el-software-no-adivina-el-genero-del-medico.test.ts`, 6 casos,
probado al revés. Un caso vigila que ninguna de las dos pantallas reimplemente
la regla.

**BROWSER_PROOF.** Antes y después a 390 / 768 / 1440: «Dr. Ximena Alcántara
Robledo» → «Ximena Alcántara Robledo». Verificado sobre el texto de las tres
corridas.

**RESIDUAL_RISK.** El nombre del médico vive en **dos documentos** (el de la
clínica y `config/main`) y pueden decir cosas distintas — en el consultorio
sembrado, de hecho, las dicen. Es un defecto aparte, declarado y **no resuelto**
aquí. Tampoco se tocan la receta ni los documentos impresos: ahí el nombre sale
del sello de la firma.

---

## 11 · «31 De Agosto» en siete pantallas, arreglado en una

**FOUND.** `text-transform: capitalize` pone mayúscula en cada palabra — la regla
del inglés. En español, dentro de una frase, las preposiciones van en minúscula.
Siete pantallas pintaban fechas así:

| Pantalla | Se leía |
|---|---|
| portal de reserva (paciente) | `Lun 31 De Ago` — las doce fichas del día |
| portal del asistente | `Agosto De 2026` · `Domingo, 30 De Agosto` |
| calendario | la etiqueta del rango |
| finanzas | la etiqueta del periodo |
| chat | el separador de fecha |
| portal del paciente | el día de su cita, y `Primera Vez · Solicitada` |

**ROOT_CAUSE — y lo que hace especial a este defecto.** Ya estaba fichado y ya
estaba arreglado… en **una** pantalla. El comentario de `citas/page.tsx` lo dice
con todas las letras: «Mayúscula SÓLO la primera letra — `capitalize` produce
"Domingo 9 De Agosto De 2026", el mismo defecto ya fichado en calendario ("De
Agosto", Visual DNA §6 nº18)». Alguien lo vio, lo entendió, lo arregló donde
estaba mirando, **escribió dónde más pasaba**, y ahí se quedó.

**FILES_OWNED.** `src/lib/texto-es.ts` (nuevo) · `reservar/[clinicId]` ·
`asistente` · `calendario` · `citas` · `finanzas` · `chat` · `mi/[token]`.

**CROSS_LANE_CHECK.** Ninguno en el diff del otro carril. Cero conflictos.

**CHANGE.** La mayúscula la pone el idioma, no el CSS —no existe un
`text-transform` que haga esto—, desde un helper único. Se conservan los dos
`capitalize` legítimos: sobre una palabra suelta (el día corto de finanzas, el
conmutador día/semana/mes) es correcto.

**REGRESSION.** `las-fechas-en-espanol-no-llevan-mayuscula-en-de.test.ts`, 11
casos. Uno reproduce el comportamiento de `capitalize` para demostrar que la
prueba puede fallar. Probado al revés. Y un caso impide que vuelva la copia
local: al escribirlo cazó **dos** reimplementaciones que quedaban sueltas.

**BROWSER_PROOF.** 390 / 768 / 1440, antes y después. Después: «Agosto de 2026»,
«Domingo, 30 de agosto», «Lunes, 31 de agosto», «Lun 31 de ago». Barrido
automático sobre el texto de las tres corridas: cero «De» capitalizados.

**GATES (9–11).** `vitest` entero · lint 95 · diseño sin deuda nueva · build.

**SCORE_BEFORE → SCORE_AFTER.** Pantallas de fecha con la regla del inglés:
**7 → 0**. Copias locales de la mayúscula: **3 → 0**.

**NEXT.** Terminar el alta de cita de la asistente de punta a punta (queda
llegar hasta guardar) y seguir con el rediseño con movimiento de la portada.

---

## 12 · El portal del asistente se paraba en 12 meses

**FOUND.** Completando el alta de la asistente en navegador apareció un
**tercer** horizonte de agenda, escrito a mano: `const MAX_MES_OFFSET = 12`.
Con el techo de plataforma (2050-12-31) y la ventana pública (365 días), eran
tres alcances distintos. Y la misma asistente, en `/citas`, tiene al lado un
campo con `max="2050-12-31"`: pedir una cita a dieciocho meses era imposible en
una pantalla y trivial en la otra.

**ROOT_CAUSE.** Un número redondo donde había que preguntar por el techo.

**CHANGE.** El tope se calcula desde `FECHA_MAXIMA_AGENDA`, y el generador de
días del mes recorta también por el techo para no ofrecer lo que el servidor va
a rechazar.

**REGRESSION.** `la-asistente-alcanza-el-mismo-techo-que-el-medico.test.ts`,
7 casos, probado al revés.

**BROWSER_PROOF.** Recorrido completo de la asistente a 390 / 768 / 1440 —
sesión, agenda, portal, datos, mes, día, hora y **Agendar**— con tres citas
verificadas en Firestore (`confirmada`, origen `Manual`). Y la flecha ▶ medida:

| | Antes | Después |
|---|---|---|
| Último mes alcanzable | agosto de **2027** | **Diciembre de 2050** |
| Clics hasta agotarla | 12 | 292 |
| Días ofrecidos ahí | — | 31 |

**RESIDUAL_RISK.** 292 clics para llegar al final. El tope ya es verdadero, pero
**saltar de año no existe**: es una carencia de interfaz declarada, no resuelta
aquí, porque añadir un salto de año es función nueva.

---

## 13 · Un fallo de red se contaba como una contraseña equivocada

**FOUND.** Cortando la llamada de identidad en el navegador y pulsando el botón:
`/login` → «Error al iniciar sesión. Intenta de nuevo.»; `/registro` → **ningún
mensaje**.

El de login culpa al inicio de sesión; lo que pasó fue que no había red. Lo que
hace el médico con ese mensaje es lo contrario de lo que le conviene: vuelve a
teclear la contraseña, la cambia, pide recuperarla —otra llamada que tampoco va
a salir— y acaba llamando a soporte con una cuenta que nunca estuvo mal.

**ROOT_CAUSE.** El `else` final de cada `catch` recogía todo lo que no fuera un
código conocido de credenciales, y un fallo de red cae ahí.

**CHANGE.** La red se comprueba **antes** que los códigos de credenciales, desde
un detector único usado en las cinco puertas. Y el recuadro de error pasa a
`role="alert"`: aparecía después de pulsar, así que quien no mira la pantalla no
se enteraba.

**REGRESSION.** `un-fallo-de-red-no-es-una-contrasena-equivocada.test.ts`, 9
casos. Un caso vigila el ORDEN, que es el arreglo. Probado al revés.

**BROWSER_PROOF.** Seis combinaciones (2 pantallas × 3 anchos): alerta correcta y
botón listo para reintentar en todas. Y la mitad que importa, comprobada aparte:
con la red buena y la contraseña mal escrita, sigue saliendo «Correo o
contraseña incorrectos…», no el mensaje de conexión.

**RESIDUAL_RISK.** No reintenta solo, a propósito. No distingue «no hay wifi» de
«el proveedor no contesta»: desde el navegador no se puede. Sólo cubre las cinco
puertas de identidad; el resto de la aplicación queda declarado.

---

## 14 · La portada no se movía, y el sistema de movimiento estaba entero sin usar

**FOUND.** Tres `transition` en 655 líneas y ni una sola entrada. Los tokens
`--mov-*` y el apagador de `prefers-reduced-motion` (§24) existían y no se usaban
ahí. La primera pantalla de un producto que se vende por lo bien hecho que está
no se movía.

**ROOT_CAUSE.** Familia «el charter existía sin encarnar»: el sistema estaba
escrito y esa pantalla no lo hablaba.

**CHANGE — y el riesgo que gobierna el diseño.** Animar una entrada es fácil; el
defecto caro es esconder algo que luego no se revela. La forma habitual
(`opacity: 0` en la hoja + una clase que lo sube) deja **la portada en blanco**
el día que el JavaScript no corra — y no se descubre nunca, porque en la máquina
de quien lo escribió siempre corre.

Así que se invierte: **el contenido nace visible**; el estado oculto lo pone el
propio JavaScript y sólo tras comprobar que hay `IntersectionObserver` y que el
usuario acepta movimiento. Lo peor que puede pasar es que no haya animación.

El apagador de §24 no bastaría solo: anula la *duración*, pero un elemento que
arranca en `opacity: 0` y del que nadie tira sigue invisible dure lo que dure.

Lo que se añadió:

- **Coreografía de entrada del héroe** (promesa → titular → subtítulo → acción →
  escaparate), con `animation … both`, que bajo §24 se resuelve en su estado
  final. Sin JavaScript.
- **Revelado al llegar** para los siete bloques siguientes, con el contrato de
  arriba.
- **El latido del micrófono** en el escaparate. No es adorno: la portada afirma
  que la nota se dicta sola, y sin nada vivo es la foto de algo quieto. Es
  **opacidad, no tamaño** — nada se mueve de sitio, así que no arrastra la vista
  fuera del texto.
- **Tarjetas que responden al dedo**: los dos manejadores de ratón que había
  pasan a `.nx-lift`, que añade `:active` — o sea, en un móvil ahora contestan.

**REGRESSION.** `la-portada-se-mueve-sin-esconder-nada.test.ts`, 11 casos.
Probado al revés **dos veces**, en los dos puntos que importan: haciendo que la
hoja esconda por su cuenta, y quitando la consulta de preferencia antes de
esconder.

**BROWSER_PROOF.** `scripts/carril-excelencia/medir-portada.mjs` recorre la
portada entera en Chromium a 390 / 768 / 1440, **con y sin**
`prefers-reduced-motion`:

| Modo | Bloques revelados | Ocultos al final | Latido | Desborde | Consola |
|---|---|---|---|---|---|
| normal | **7 de 7** | **0** | 2,4 s · infinito | no | 0 |
| reducido | 0 (**no se preparó ninguno**) | **0** | 1e-05 s · 1 vez | no | 0 |

Los ceros del modo reducido son la prueba fina: no es que se revelara deprisa,
es que **nunca se escondió nada**.

**GATES.** `vitest` entero · lint 95 · diseño sin deuda nueva · build.

**SCORE_BEFORE → SCORE_AFTER.** Transiciones en la portada: **3 → 3 + 6 entradas
+ 7 revelados + 1 latido + tarjetas con `:active`**. Bloques que podrían quedar
invisibles ante un fallo de JS: **0 antes y 0 después** — la propiedad se
conserva por construcción, no por suerte.

**RESIDUAL_RISK.**

- La medición es de una portada **servida en desarrollo**. En producción el CSS
  va minificado por Lightning CSS; el build compila, pero el recorrido con
  movimiento no se ha repetido contra `next start`.
- **No se tocó la tipografía ni el contenido** de la portada: este carril
  entiende «rediseñar con movimiento» como añadir intención al movimiento, no
  como reescribir la propuesta comercial, que es decisión del dueño.
- El latido es el único elemento en bucle de la portada. Si algún día hay más,
  hace falta una política de cuántas cosas pueden estar vivas a la vez.

**NEXT.** Pase de pulido de interacción en el resto de la aplicación
(prioridad 7) y recorridos móviles/accesibilidad (prioridad 8).
