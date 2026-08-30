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
| 15 | Una caja con scroll dejaba fuera al teclado | nadie lo estaba midiendo |
| 16 | Los enlaces que son acciones no se podían tocar | nadie lo estaba midiendo |

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

---

## 15 · Una caja con scroll dejaba fuera al teclado

**FOUND.** Pasando axe-core (WCAG 2.0/2.1/2.2 A+AA) sobre los recorridos de este
carril a 390 / 768 / 1440, salió **una** violación, seria, en los tres anchos:
`scrollable-region-focusable` sobre la conversación de ejemplo de WhatsApp de la
portada. Es una caja con `overflow-y: auto` y **ningún control dentro**, así que
nada podía recibir el foco: con ratón se lee la conversación entera, con teclado
sólo el primer trozo. WCAG 2.1.1.

**ROOT_CAUSE.** Familia «nadie lo estaba midiendo»: no es un defecto nuevo, es
que estas superficies no se habían pasado por axe a los tres anchos.

**CHANGE.** `tabIndex={0}` + `role="region"` + nombre. El arreglo **no** fue
quitarle el scroll —eso cortaría la conversación— y hay un caso que lo vigila.

**REGRESSION.** `la-caja-con-scroll-tambien-se-alcanza-con-el-teclado.test.ts`.
Probado al revés — y en el primer intento **la prueba pasó con el arreglo
borrado**: el comentario que explica el arreglo contiene la cadena
`tabIndex={0}` y `toContain` no distingue código de prosa. Es el mismo tropiezo
que ya cazó el guardián de las mayúsculas. Se descomenta antes de mirar, y ahora
sí falla.

**BROWSER_PROOF.**

*axe, después:* **0 violaciones** en las siete superficies × tres anchos —
portada, reserva, login, registro, y con sesión `/citas`, `/asistente` y
`/pacientes` (esta última sólo medida, es del otro carril).

*Recorrido de reserva SÓLO CON TECLADO*, Tab y Enter, sin ratón: los seis pasos
hasta «¡Cita solicitada! ✅» a 390 y 1440, con **anillo de foco visible en
todos**. Y el dato llegó: dos citas en Firestore creadas sin tocar el ratón.

*Sin desbordamiento horizontal* en las nueve combinaciones medidas.

**UN FALSO HALLAZGO, DECLARADO.** La primera corrida por teclado dio «no se
alcanza con Tab» en «Continuar». No era del producto: el campo de nombre llega
ya enfocado, la prueba pulsaba Tab antes de escribir, el nombre quedaba vacío y
el botón se quedaba **deshabilitado** — y un botón deshabilitado no recibe foco.
Se arregló la prueba, no el producto. Queda escrito porque el siguiente que mida
esto va a tropezar igual.

**GATES.** `vitest` entero · lint 95 · diseño sin deuda nueva · build.

**SCORE_BEFORE → SCORE_AFTER.** Violaciones axe en las superficies del carril:
**3 nodos serios → 0**. Recorrido de reserva completable sólo con teclado: **no
medido → sí, a 390 y 1440, con dato verificado**.

**RESIDUAL_RISK.**

- axe no ve el **orden** de tabulación, el atrapado de foco en un modal, ni si
  un mensaje se anuncia al aparecer.
- El recorrido por teclado se hizo en el portal del **paciente**; el de la
  asistente se recorrió con ratón. Su versión de teclado queda **pendiente**.
- No hay lector de pantalla real en este entorno: se comprueba el árbol
  accesible y el foco, no lo que se oye.

**NEXT.** Pase de pulido de interacción en el resto de la aplicación
(prioridad 7) y certificación final (prioridad 9).

---

## 16 · Los enlaces que son acciones no se podían tocar

**FOUND.** La regla propia del repositorio pone «objetivo táctil por debajo de
44×44» entre los mínimos que fallan la compuerta. Medido a 390 px: **doce**
enlaces de acción por debajo. Entre ellos, los dos que conectan las dos puertas
del producto:

  · portada → «Inicia sesión aquí →» **129×18**
  · login → «Crea una gratis →» **113×18**

Dieciocho píxeles de alto en un teléfono, para el camino de ida y vuelta entre
registrarse y entrar.

**ROOT_CAUSE.** La que `v15-a11y-tactiles-de-enlace` ya había nombrado y dejado
declarada: el bloque `@media (pointer: coarse)` cubre `.btn`, `button`,
`select`, `input` y `textarea` — **nunca cubrió `<a>`**. Aquel guardián cerró
dos familias y escribió lo que no cubría: «un enlace nuevo con otra clase no
está vigilado por esto». Esto es exactamente ese hueco.

**CHANGE.** Se añade la familia al **mismo mecanismo que ya existía**: un pseudo
invisible centrado (`max(100%, 44px)`) que estira el área de golpe sin mover un
píxel de lo visible, y **sólo en puntero grueso**. No se usa `min-height`, que
engordaría lo visible y movería la maqueta.

**REGRESSION.** `los-enlaces-de-accion-tambien-se-tocan.test.ts`, 6 casos, con la
guarda de alcance (la regla tiene que vivir DENTRO del bloque coarse). Probado
al revés: caen tres.

**BROWSER_PROOF.** Hit-testing a 390 px:

| Superficie | Antes | Después |
|---|---:|---:|
| `/` | 11 | 3 (dos de 40–42 px + un artefacto de ±1) |
| `/login` | 1 | **0** |
| `/registro` · `/reservar` | 0 | 0 |

**EL INSTRUMENTO SE EQUIVOCÓ TRES VECES, Y ESO ES PARTE DEL HALLAZGO.** El
guardián original ya advertía que un pseudo **no aparece en
`getBoundingClientRect`** y que hay que hit-testear. Este carril tropezó igual:
(1) leyendo rects; (2) hit-testeando por debajo del pliegue, donde
`elementFromPoint` no ve nada; (3) suponiendo el alcance simétrico, cuando el
pseudo se sesga 2 px hacia el pulgar a propósito. La versión final trae el
elemento a pantalla y **busca** el alcance real arriba y abajo.

**GATES.** `vitest` entero · lint 95 · diseño sin deuda nueva · build.

**SCORE_BEFORE → SCORE_AFTER.** Objetivos táctiles bajo mínimo en las cuatro
superficies públicas: **12 → 2**.

**RESIDUAL_RISK.** Los dos que quedan (`Operación` 42 px, `Soporte` 40 px) son
enlaces legales del pie, no caminos de producto: sus pseudos se pisan en una
fila apretada, y separarlos cambia la maqueta del pie — decisión de diseño, no
arreglo. El conteo tiene precisión de ±1 px.

---

# Pase de excelencia visual e interacción

Segunda vuelta sobre el mismo carril y el mismo PR (#399). El encargo:
*«Ausculta no debe sentirse estática, plana, genérica ni de plantilla»*, con
prohibición explícita de resolverlo con degradados, sombras, bordes más
redondos o animación por todas partes.

Lo que sigue son las unidades de esa vuelta. Cada una nace de una **medición en
navegador**, no de una opinión sobre una captura.

---

## Unidad 17 — el riel se apagaba en toda la agenda

**FOUND.** En `/citas`, `/calendario`, `/asistente` y `/lista-espera` la
navegación se apagaba **entera**: cero ítems activos y **cero
`[aria-current="page"]`** en toda la pantalla, en escritorio y en móvil.
`/pacientes` y `/pendientes` sí encendían. La agenda —lo que más se usa en un
consultorio— era la única familia que no podía contestar «¿dónde estoy?».

Medido con sonda de Playwright sobre el arnés con sesión, ruta por ruta, a 390 y
1440 px. No se dedujo leyendo JSX.

**ROOT_CAUSE.** No era «faltaba una ruta». La lista de destinos de Operaciones
estaba escrita **dos veces**: completa en `operaciones/page.tsx` (`GRUPOS`,
veinte destinos, agrupados y descritos) y **recortada a tres** en los rieles
(`/operaciones`, `/configuracion`, `/guia`). Las dos copias habían divergido en
diecisiete rutas. `CLAUDE.md`: «Nunca duplicar la fuente de verdad».

La pista de que el producto ya sabía la respuesta estaba en el propio
`BottomNav`: su variante de médico agrupaba `/calendario` y `/citas` bajo
«Agenda». Los otros tres rieles, no. **El sistema se contradecía a sí mismo.**

**FILES_OWNED.** `src/lib/navegacion/contextos.ts` (nuevo) ·
`src/components/FlowRail.tsx` · `src/components/BottomNav.tsx`.

**CROSS_LANE_CHECK.** Ninguno de los tres lo toca el carril de Master
Completion. Verificado contra `origin/product/ausculta-master-completion`.

**CHANGE.** No se añaden las rutas que faltaban: **se quita la segunda copia**.
Una tabla única de contextos, con pertenencia por **segmento** (`/citas` cubre
`/citas` y `/citas/x`, y no `/citaciones`). Los cuatro rieles preguntan ahí.

**REGRESSION.** `el-riel-sabe-donde-estas.test.ts`, 7 casos. Probado al revés
tres veces: (1) devolviendo «Hoy» a `pathname === '/dashboard'` → caen 4;
(2) añadiendo un destino al índice sin mapearlo → cae el guardián de cobertura,
nombrando la ruta huérfana; (3) devolviendo a la barra inferior su lista propia
→ cae el caso de «no reconstruyen la suya».

**BROWSER_PROOF.** Nueve rutas × dos anchos, contando `[aria-current="page"]` y
comprobando que la barra indicadora **se pinta** (`::before`, 3 px,
`rgb(42,165,181)`), no sólo que el atributo exista:

| Ruta | Antes | Después |
|---|---:|---|
| `/citas` `/calendario` `/asistente` `/lista-espera` | **0** | 2 · «Hoy» |
| `/finanzas` | **0** | 2 · «Operaciones» |
| `/dashboard` `/pacientes` `/pendientes` `/operaciones` | 2 | 2 (sin cambio) |

**RESIDUAL_RISK.** Que `/finanzas` sea «Operaciones» y no un contexto propio es
una decisión de producto, no un teorema: el guardián sólo exige que **algún**
contexto la reclame. `/consultor` y `/antibiograma` salieron del índice en
RTC-09 y siguen sin contexto a propósito — decidirlo es una decisión de producto
y `/consultor` lo está editando el otro carril.

---

## Unidad 18 — el estado de una cita vivía sólo en el pixel

**FOUND.** En la rejilla del calendario el estado de una cita llegaba por tres
canales y **ninguno servía a todo el mundo**: `title=` (sólo con ratón; en una
tableta no existe), `opacity` y `text-decoration`. El nombre accesible decía
literalmente «Cita de Nadia Ferreiro Ocampo a las 13:00» de una cita
**cancelada**. Y la vista de **mes** no pintaba el estado por ningún canal:
cancelada y confirmada, idénticas.

**UN ERROR MÍO, Y VALE LA PENA DEJARLO ESCRITO.** La primera lectura de la sonda
decía que *confirmada* y *pendiente* se pintaban igual. Era falso: la **siembra
del arnés** escribía `estado: 'programada'`, que no es miembro de
`AppointmentStatus`. El producto la caía por el `else` («el resto → sólido»), o
sea la pintaba como confirmada. El defecto era del instrumento, no de la
pantalla. Misma familia que el `urgencia` por `urgente` de la unidad 16: **un
dato de prueba fuera del vocabulario hace mentir a la pantalla que se audita.**
Corregida la siembra, el producto sí distingue — y el hallazgo real quedó más
estrecho y más cierto.

**ROOT_CAUSE.** `etiqueta:` se escribió como «quién y a qué hora», que es lo que
identifica la cita. El estado se trató como decoración del bloque. Pero el
estado es justo lo que el médico busca en la rejilla: quién no ha confirmado.

**CHANGE.** El estado entra por el **nombre accesible** en las tres vistas, con
una sola función (`@/lib/agenda/etiqueta-de-cita`). Un estado que el catálogo no
conozca **se dice crudo**, no se calla — regla 5 de `clinical-safety`. La vista
de mes recibe además la misma gramática visual de estado que semana y día.

**REGRESSION.** `el-estado-de-la-cita-no-vive-solo-en-el-pixel.test.ts`, 7
casos.

**LA PRIMERA VERSIÓN DEL GUARDIÁN NO PODÍA FALLAR.** Comprobaba que la función
*mencionara* el catálogo leyendo el fuente. Probada al revés —quitándole el
estado a la cadena devuelta— seguía en verde: **mencionar no es devolver**. Por
eso la función se sacó de la página a un módulo propio, donde se la puede
llamar. Ahora el mismo defecto tumba tres casos. Es la regla de
`testing-gates.md` cazándome a mí.

**RESIDUAL_RISK.** Se comprueba el árbol accesible, **no el audio**: ningún
lector de pantalla real se ha usado en este carril. Y no se juzga si «Pendiente
confirmar» es el término que el médico espera oír.

---

## Unidad 19 — dos vistas de la misma agenda, y sólo una sabía qué hora era

**FOUND.** `/citas` dibuja la hora actual desde v9xx (`.riel-ahora`, con su
`role="separator"` y su nombre accesible). El **calendario no la dibujaba en
absoluto** — la sonda no encontró ni un elemento que la marcara. Es el primer
punto del §15 del encargo, y el producto lo tenía a medias.

**ROOT_CAUSE.** El reloj estaba escrito **a mano dentro de `/citas`**. No había
nada que compartir, así que el calendario nació sin él y nadie lo notó: cada
pantalla se auditó por separado.

**CHANGE.** El reloj se saca a `useAhoraMinutos`, y lo usan las dos. Se elige
sacarlo en vez de copiarlo: dos copias acabarían refrescando a ritmos distintos,
que es como empiezan los relojes que se contradicen. Nace `null` para no
fabricar un desajuste de hidratación (familia V10-HARNESS-OBS-001) y la hora es
la del **consultorio**, no la del proceso.

**RESIDUAL_RISK.** La marca sólo aparece dentro de la franja horaria dibujada
(07:00–19:00). Fuera de ella no hay línea — correcto, pero no lo dice.

---

## Unidad 20 — se podía pulsar y no acusaba recibo

**FOUND.** Los bloques de cita y las celdas vacías del calendario declaraban
`cursor: pointer` y `transition-duration: 0s`. Medido en el navegador sobre los
cinco bloques del día: cero movimiento en el plano de contenido.

**CHANGE.** Respuesta al ratón y al dedo con los tokens que ya existen
(`--mov-presion`, `--mov-rapido`, `--mov-curva`): la celda vacía se ofrece al
pasar por encima, el bloque se levanta y se hunde al pulsarlo. **Nada de esto
pinta estado clínico**: el movimiento dice «te oí», no «esto está confirmado».

**LO QUE SE DECIDIÓ NO HACER, Y POR QUÉ.** Las filas de `/citas` **no** llevan
resaltado al pasar por encima. No son pulsables: son un `<div>` con un botón de
acción y un menú aparte. Un resaltado de fila prometería un clic que no existe.
Añadir movimiento donde no hay acción es exactamente lo que el §27 del encargo
llama pulido falso.

---

## Unidad 21 — el arnés no recompila la hoja si nadie la mira

**FOUND.** Reglas nuevas de `globals.css` no aparecían en la hoja servida por el
arnés de desarrollo: la hoja terminaba **exactamente** en la última regla
anterior al cambio. Sobrevivió a reiniciar el servidor y a borrar `.next`.

**ROOT_CAUSE, en dos capas.** La primera fue mía: un servidor de la sesión
anterior seguía dueño del puerto 3200 (seis horas de vida), así que **mis
reinicios nunca llegaban a escuchar** — el hash de la hoja no cambiaba nunca, y
esa era la pista. La segunda es real y queda anotada: una edición de
`globals.css` hecha **mientras ningún servidor la vigila** no se recoge al
arrancar; la hoja servida se queda una edición por detrás. Sólo un cambio hecho
con el servidor en marcha dispara la recompilación.

**CÓMO SE DEMOSTRÓ.** Con una regla marcadora única añadida al final: apareció
en la hoja servida en el mismo instante en que se escribió con el servidor
vigilando, y al borrarla la hoja siguió mostrándola. La hoja va **una edición
por detrás**.

**CONSECUENCIA PARA ESTE CARRIL.** Toda comprobación visual que dependa de CSS
se hace contra el **build de producción**, no contra el arnés de desarrollo. El
arnés sirve para recorrer y para leer el DOM; no para certificar una hoja.

---

## Unidad 22 — el estilo en línea mataba la respuesta al ratón

**FOUND.** El arreglo de la unidad 20 **no funcionaba en las celdas**, y leyendo
el CSS parecía correcto: la clase estaba puesta, la regla `:hover` existía, la
transición estaba declarada. Las 91 celdas de la rejilla seguían sin responder.

**CÓMO SE DESCUBRIÓ.** Midiendo `backgroundColor` antes y después de posar el
ratón, sobre el **build de producción**: `rgba(0,0,0,0)` → `rgba(0,0,0,0)`. El
bloque de cita sí respondía (`filter: none` → `brightness(1.35)`); la celda, no.

**ROOT_CAUSE.** La celda llevaba el tinte de fin de semana como **estilo en
línea** (`style={{ background: … }}`). Un estilo en línea gana siempre a la hoja,
así que la regla `:hover` estaba escrita y muerta. Es «escrito y sin conectar»
dentro de una hoja de estilos: el símbolo existe, la regla existe, y no llega.

**CHANGE.** El tinte se muda a la hoja por atributo (`[data-finde]`), que es
quien sabe de cascada. La página deja de opinar sobre el fondo de la celda.

**REGRESSION.** `la-agenda-acusa-recibo.test.ts`, 6 casos. Probado al revés tres
veces: devolviendo el `background` en línea, quitando la regla `:hover`, y
escribiendo una duración a mano en vez del token. Caen los tres.

**LA LECCIÓN, QUE ES LA DE SIEMPRE.** Un `git diff` que se ve bien no es una
pantalla que funciona. Este defecto lo introduje yo arreglando el anterior, y
sólo apareció porque la comprobación fue **medir el navegador**, no releer el
cambio.

---

## Unidad 23 — el arnés de producción servía trozos de dos compilaciones

**FOUND.** Tras reconstruir con el servidor de producción **en marcha**, la
pantalla caía en su límite de error: `ChunkLoadError`, hojas rechazadas por MIME
`text/plain`, y un 500. La rejilla no existía — cero celdas, cero bloques.

**ROOT_CAUSE.** `next build` reemplaza `.next` bajo los pies del `next start`
que lo está sirviendo: el manifiesto pasa a apuntar a trozos que ya no existen
con ese nombre. No es un defecto del producto; es el arnés mintiendo, y de la
peor forma — **una pantalla rota que parece un defecto de producto**.

Un rato antes había pasado la variante barata del mismo error: `curl` sobre
`/calendario` sin sesión **redirige a `/login`**, así que la hoja que yo estaba
inspeccionando era la de la pantalla de entrada, no la del calendario. Dos veces
seguidas midiendo algo que no era lo que creía medir.

**CHANGE.** Procedimiento fijo para toda comprobación visual de este carril:
**parar el servidor → borrar `.next` → construir → arrancar → medir**, y las
hojas se leen desde el navegador **con sesión**, nunca con `curl` sobre una ruta
privada.

**RESIDUAL_RISK.** Nada de esto está automatizado: es disciplina escrita, y por
tanto de la familia «depende de que alguien se acuerde». Queda declarado.

---

## Unidad 24 — las flechas que mueven la agenda no tenían nombre

**FOUND.** `button-name`, impacto **crítico**, dos nodos, en `/calendario` a
390, 768 y 1440 px. Las dos flechas `‹ ›` que mueven el calendario son un
`<button>` con un icono dentro y **ninguna palabra**. Son la única forma de
moverse por la rejilla.

**NO ES NUEVO, Y ESO ES PARTE DEL HALLAZGO.** Está en la línea base de axe de
V10 (`docs/design/capturas/v10-truth/axe-baseline.json`) y en la de V15, con el
mismo selector (`.btn-ghost.btn-icon.btn:nth-child(4)`). Llevaba dos programas
de diseño registrado y sin cerrar: medido, anotado y nunca arreglado. Es la
familia «nadie lo estaba midiendo» en su variante peor — **sí se medía**, y aun
así seguía ahí.

**CHANGE.** Nombre accesible en las dos, derivado de la vista activa: no es lo
mismo saltar una semana que un mes, y un «anterior» a secas no dice de qué.

**REGRESSION.** Caso añadido a `la-agenda-acusa-recibo.test.ts`. Probado al
revés quitando uno de los dos `aria-label`: cae.

**LO QUE NO SE TOCÓ, Y POR QUÉ.** En la misma pantalla quedan:

| Violación | Nodos | Decisión |
|---|---:|---|
| `nested-interactive` | 4 | **Declarada.** El bloque de cita es pulsable dentro de una celda pulsable. Arreglarlo bien es dejar de hacer botón la celda cuando tiene citas, y eso cambia dónde se puede pulsar para agendar — decisión de producto, no arreglo de accesibilidad. Estaba en la línea base de V10 con 5 nodos y en la de V15 con 6. |
| `color-contrast` | 2 | **Declarada.** Es el texto de la cita cancelada, atenuado a 0,45 a propósito para que se lea «muerta». Subir el contraste borra la señal de estado; bajar la opacidad menos la debilita. Necesita rediseñar cómo se dice «cancelada» en la rejilla. |
| `target-size` | 1 | **Declarada.** Una celda de la rejilla por debajo del mínimo a 390 px. Agrandarla cambia la densidad de la semana entera. |

Ninguna de las tres subió con este carril. Las tres estaban ya en las líneas
base. Se dejan escritas con su motivo en vez de arregladas a medias.

---

## Unidad 25 — el nombre del paciente era lo menos legible del bloque

**FOUND.** `color-contrast`, impacto serio, en los bloques de cita de la rejilla
semanal, a 390, 768 y 1440 px. No sólo en la cita cancelada —que se atenúa a
propósito— sino también en una **confirmada, a opacidad 1**: ámbar
`rgb(217,119,6)` a 11 px sobre un fondo del mismo ámbar al 13 %.

En la superficie donde el médico busca a quién tiene a las nueve, **el nombre
del paciente era lo menos legible del bloque**.

**ROOT_CAUSE.** El texto se pintaba con el color del médico (`colorMedico`), que
existe para distinguir agendas cuando hay varios. Un color de identidad estaba
haciendo, además, de color de lectura. Son dos trabajos distintos y sólo uno de
ellos tiene un mínimo de contraste que cumplir.

**CHANGE.** Se separan. La identidad del médico se queda donde ya estaba y donde
no compite con la lectura —el borde izquierdo de 3 px y el tinte del fondo— y el
texto pasa al primer plano normal.

**POR QUÉ NO SE ACLARÓ EL ÁMBAR.** Porque el color sale de una **paleta por
médico**, y una paleta no se audita un color cada vez: aclarar éste dejaría el
fallo esperando al siguiente médico que entrara al consultorio. El arreglo tiene
que ser independiente del color que toque.

**RESIDUAL_RISK.** La cita cancelada sigue a opacidad 0,45 a propósito, y eso
baja su contraste. Es una señal de estado deliberada y va acompañada de tachado
y del nombre accesible; subirla borraría la señal. Queda declarado, no arreglado.

---

## Nota sobre los conteos de axe: la siembra buena empeora el número

Al arreglar la fecha de la siembra (unidad 23 bis), las citas pasaron a caer en
el día que la aplicación llama «hoy». Eso subió los conteos de axe en
`/calendario` (7 → 9) y en `/dashboard` (0 → 3).

**No es una regresión: es que antes se estaba midiendo un día vacío.** Las
violaciones de la rejilla son *por cita* —cada bloque pulsable dentro de una
celda pulsable suma un `nested-interactive`—, así que un día sin citas puntúa
mejor sin ser mejor.

Queda escrito porque es la trampa que hace que una auditoría visual mejore sola
cuando los datos empeoran. Los conteos de este acta se leen **siempre** contra la
misma siembra.

Las tres de `/dashboard` (`.riel-dur`, `.nx-meta` y una insignia) son de una
pantalla que este carril **no posee** y aparecieron sólo porque ahora hay citas
que pintar. Se declaran; no se tocan.

---

## Unidad 26 — el vacío decía la verdad y aun así engañaba

**FOUND.** El portal de la asistente selecciona **hoy** por omisión. Si hoy el
consultorio no abre —sábado, domingo, festivo— la pantalla decía «No hay
horarios disponibles este día» y ahí terminaba, mientras **dos filas más
arriba** había un día con nueve lugares. El día seleccionado por omisión era,
además, un botón **deshabilitado**.

Visto en el arnés a 1440 px: «Hoy · Sin lugar» seleccionado y en gris,
«Domingo 30 · Sin lugar», «Lunes 31 · 9 lugares».

**ROOT_CAUSE.** «No hay horarios» es cierto en tres situaciones que **no
significan lo mismo** para quien está al teléfono con el paciente:

| Situación | Cómo se resuelve |
|---|---|
| el consultorio no abre ese día de la semana | buscando otro **día** |
| es festivo | buscando otro **día** |
| está lleno | buscando otra **hora**, o lista de espera |

Quien lee «no hay horarios» entiende la tercera. El mensaje no era escueto: era
**ambiguo entre tres cosas distintas**. Regla 4 de `clinical-safety` en versión
de agenda — ausencia de hueco no es dato de ausencia.

**CHANGE.** El vacío contesta a las tres preguntas del §13: qué significa (el
motivo real, leído del horario y de los festivos), si es normal, y qué se puede
hacer ahora (**ir al primer día con lugar**, de un clic).

**LO QUE SE DECIDIÓ NO HACER.** No salta solo al primer día con hueco. Se
**ofrece**. Un cambio de fecha en silencio es justo lo que la asistente no puede
permitirse no haber visto — y encaja con la regla 3 de seguridad clínica: nada
cambia sin que se vea.

**DE PASO, UNA INEFICIENCIA REAL.** `getAvailableSlots` corría **una vez por día
dentro del `map` del JSX**. Ahora se calcula una sola vez (`lugaresPorDia`) y lo
leen la lista y la sugerencia, que así no pueden discrepar sobre cuántos lugares
tiene un día. Y «1 lugar» ya no se dice en plural.

**REGRESSION.** `un-dia-sin-huecos-dice-por-que.test.ts`, 6 casos.

**OTRO CASO QUE NO PODÍA FALLAR.** El de «no salta de fecha por su cuenta»
buscaba bloques `useEffect` con una expresión que exigía cierre en varias
líneas. Probado al revés con un efecto de **una sola línea**, no escaneaba nada
y pasaba por vacío. Reescrito para mirar el único sitio donde la fecha se mueve
y exigir que cuelgue de un `onClick`. Es la segunda vez en este pase que la
prueba al revés caza un guardián mío inútil, y las dos veces por la misma razón:
**medir la forma del código en vez de su efecto.**

**EL TRINQUETE ME CAZÓ OTRA VEZ.** El primer `primerDiaConLugar` salía de un
bucle con `return` temprano, y el compilador de React no pudo conservar la
memoización: lint 95 → 96. Se arregló el cambio, no el techo — y el arreglo
resultó ser mejor que el original.

---

## Unidad 27 — la protección de regresión que faltaba

**FOUND.** El §24 del encargo pide **protección** de regresión visual. Lo que
este carril tenía era un **álbum**: capturas de antes y después a tres anchos,
que documentan y no fallan solas. Nada impedía que la siguiente sesión volviera
a apagar el riel en `/citas` sin que nadie se enterase hasta abrirlo a mano.

Es el hueco que el propio PR declaró como el más grande del pase. Éste lo cierra.

**POR QUÉ NO ES COMPARACIÓN DE PÍXELES.** Porque daría rojo cada día **por
construcción**:

- la rejilla dibuja la **hora actual**, que se mueve cada minuto;
- la siembra fecha en el día en curso, así que la semana cambia sola;
- el mes cambia la maqueta del calendario sin que nadie toque nada.

Una compuerta que se pone roja sola se desactiva en una semana, y entonces no
protege nada — **pero sigue pareciendo que sí**, que es lo peor de los dos
mundos. Así que se fija lo estable y lo que de verdad importa: axe, errores de
consola, desbordamiento horizontal y `aria-current` por ruta y por ancho.

**CHANGE.** `scripts/carril-excelencia/trinquete-de-interfaz.mjs` +
`docs/audit/carril-excelencia/techos-de-interfaz.json`, con el mismo contrato
que los otros dos trinquetes: axe, consola y desborde **sólo bajan**;
`aria-current` **sólo sube**. Declarado en `package.json` como
`arnes:trinquete-interfaz`. 18 combinaciones ruta×ancho.

**PROBADO AL REVÉS CONTRA EL NAVEGADOR, que es como se prueba un guardián de
navegador.** Se reintrodujo el defecto de la unidad 17 en
`lib/navegacion/contextos.ts`, se reconstruyó y se volvió a medir: el trinquete
salió con código 1 y nombró **las doce** combinaciones afectadas, una por una,
con el texto «la navegación dejó de decir dónde estás». Restaurado y
reconstruido, sale con código 0 y «Sin regresión de interfaz».

**REGRESSION.** `el-trinquete-de-interfaz-esta-cableado.test.ts`, 6 casos, que
cubren lo que aquel ejercicio no puede cubrir en CI: que el archivo de techos no
se borre, no se afloje y no se quede sin rutas. Probado al revés aflojando un
techo de `aria-current`, aceptando errores de consola, y quitando el script del
`package.json`. Caen los tres.

**RESIDUAL_RISK, sin adornos.**

- **No corre en CI.** Necesita emuladores sembrados y un build de producción.
  Es compuerta **local**, como `verificar-invariantes-de-datos`. Que dependa de
  que alguien se acuerde es la familia de defecto que este repositorio ya tiene
  fichada, y queda **declarado, no disimulado**.
- **No ve el aspecto.** Una pantalla puede volverse fea, perder jerarquía o
  quedarse sin espaciado con los dieciocho números intactos. Esto protege lo que
  se puede contar; lo que se ve sigue necesitando abrirlo y mirarlo.
- **No ve el movimiento ni el orden de tabulación.**
- Los conteos se leen **siempre contra la misma siembra**: un día vacío puntúa
  mejor sin ser mejor (ver la nota de los conteos de axe).

---

## Unidad 28 — un botón dentro de otro botón no es navegable

**FOUND.** `nested-interactive`, impacto **serio**, en `/calendario` a los tres
anchos. La celda vacía es un `role="button"` («Agendar a las 09:00») y cada cita
que cae dentro es **otro** `role="button"`. Cinco nodos: uno por hora ocupada.

**CUÁNTO LLEVABA AHÍ.** Está en la línea base de axe de **V10** (5 nodos) y en
la de **V15** (6). Dos programas de diseño lo midieron, lo anotaron y ninguno lo
cerró. No es «nadie lo estaba midiendo»: es su variante peor — **sí se medía**.

**POR QUÉ NO ES UNA ETIQUETA MAL PUESTA.** El árbol accesible no admite un botón
dentro de otro, así que el de dentro se queda **sin forma fiable de
alcanzarse**: quien navega con teclado o con lector no podía abrir la cita, que
es lo único que de verdad se hace en esa celda. Con ratón funcionaba. Por eso
sobrevivió a dos auditorías visuales.

**CHANGE, y no es el mismo en las tres vistas.**

| Vista | Regla | Por qué |
|---|---|---|
| Semana y día | la celda es botón **sólo si está vacía** | «agendar a esta hora» tiene otra puerta de teclado: «Nueva cita» |
| Mes | el control se muda al **número del día** | ahí «ver el día» no tiene otra puerta, y un día con citas es justo el que se quiere abrir |

Es la misma regla —un solo control por región— resuelta según lo que cada vista
tiene que seguir permitiendo. El número del día pasa además a decir cuántas
citas hay, que es lo que decide si vale la pena abrirlo.

**LO QUE CUESTA, DICHO.** En una celda ya ocupada de la semana, agendar a esa
hora deja de alcanzarse con teclado **desde la rejilla**. Se sigue pudiendo por
«Nueva cita». Se cambia un camino roto por uno que funciona, no un camino por
ninguno.

---

## Unidad 29 — la señal de estado se estaba pagando con el contraste del dato

**FOUND.** Al cerrar el anidamiento quedaron tres familias, y al medir **las
tres vistas** (hasta ahora sólo se medía la de semana, que es la de entrada)
aparecieron más: mes 5, día 5.

Ordenadas por lo que resultaron ser:

| Qué | Dónde | Causa |
|---|---|---|
| `target-size` ×3 | píldoras del mes | ~16 px de alto; el mínimo de WCAG 2.2 §2.5.8 es 24 |
| `color-contrast` ×2 | píldoras del mes | `var(--teal)` sobre `--nexus-soft`, a 10 px |
| `color-contrast` ×5 | tarjetas del día | `--text3` **dentro de una tarjeta teñida** |
| `color-contrast` | las tres vistas | la cita cancelada, a opacidad 0,45 |

**ROOT_CAUSE, tres primos hermanos.**

1. **Un token atenuado deja de serlo sobre otro fondo.** `--text3` está
   calibrado contra el fondo de la PÁGINA; dentro de una tarjeta con tinte
   propio se cae. Es el primo de la unidad 25 —allí un color de identidad hacía
   de color de lectura; aquí un gris calibrado para un fondo se usa sobre otro.
2. **Una píldora de 16 px no se puede tocar.** Una cita que no se puede tocar en
   el móvil no está en la pantalla. La celda del mes crece si hace falta: que
   crezca es preferible a un objetivo inalcanzable.
3. **La señal de estado se estaba pagando con el contraste del dato.** La cita
   cancelada al 0,45 dejaba ilegible *todo* lo que llevaba dentro.

**CHANGE.** El tercero es el que enseña algo. La tentación es declararlo
intocable «porque atenuar es la señal». Pero la cancelación **ya está dicha por
tres vías que no cuestan legibilidad**: el tachado, el borde discontinuo y el
estado dentro del nombre accesible —más la insignia en la vista de día. La
opacidad era la única redundante **y** la única que hacía ilegible el dato.

Dos cambios, y el segundo importa más que el primero:

- 0,45 → **0,72**. Sigue leyéndose apagada frente a las vivas (1 y 0,85).
- En la vista de día, la merma se muda de la **tarjeta** al **nombre**. Atenuar
  la tarjeta entera atenuaba también **la insignia que dice «Cancelada»** —
  atenuar el aviso de cancelación para señalar que está cancelada se muerde la
  cola.

**Regla que deja:** una señal de estado no puede pagarse con el contraste del
dato que señala, si hay otra forma de decir lo mismo.

**BROWSER_PROOF.** Build de producción, las **tres** vistas medidas por separado
—que es lo que nunca se había hecho:

| Vista | Antes | Después |
|---|---:|---:|
| Semana | 7 | **0** |
| Mes | 5 | **0** |
| Día | 5 | **0** |

**Las 18 combinaciones ruta×ancho del trinquete de interfaz quedan en axe 0.**
El techo se baja en consecuencia — sólo puede bajar.

**REGRESSION.** `ningun-boton-vive-dentro-de-otro.test.ts`, 8 casos. Probado al
revés cinco veces: devolviendo el `activable` incondicional a la celda de la
semana, a la del día y a la del mes; devolviendo el 0,45; y devolviendo la
opacidad a la tarjeta del día. Caen los cinco.

**RESIDUAL_RISK.** Sigue siendo un escáner de fuente más una medición puntual:
no prueba que el orden de tabulación resultante sea bueno, ni que un lector de
pantalla real lo recorra bien. Y las tres vistas se midieron con **una** siembra
— un día vacío puntúa mejor sin ser mejor.

---

## Unidad 30 — cambiar un defecto de accesibilidad por otro no es arreglarlo

**FOUND.** El arreglo de la unidad 28 dejaba, en la celda **ocupada**, un
`onClick` suelto «para no perder el clic de ratón». Eso es un control que sólo
funciona con ratón, que es exactamente lo que prohíbe `teclado-controles`.

**Lo cazó el guardián del repositorio**, no yo — pero sólo a medias, y esa
mitad importa: marcó la celda del **mes** y **no** las de semana y día. Su regla
da por resuelta una etiqueta si ve `activable(` en cualquier parte de ella, y en
semana y día `activable(` aparecía en la **otra rama del ternario**. Un punto
ciego que mi propio arreglo estrenó.

**CHANGE.** Se quitan los tres. En semana y día, la celda ocupada no reparte
ningún manejador —y el cursor deja de prometer un clic que ya no existe—. En el
mes, la salida no era elegir entre accesibilidad y función: era **hacer el
control de verdad lo bastante grande**. La cabecera del día pasa de un círculo
de 24×24 a una franja de **154×24** que ocupa el ancho de la celda, se alcanza
con el tabulador en 5 pasos y **enseña cuántas citas hay** — dato que antes sólo
existía en el nombre accesible.

**No se aflojó el guardián ajeno ni se apoyó uno en su hueco**: se añadió el
caso desde este lado, en `ningun-boton-vive-dentro-de-otro.test.ts`.

**BROWSER_PROOF.** Build de producción, las tres vistas: **axe 0 / 0 / 0**.
Cabecera del día: 154×24, alcanzada con teclado en 5 tabulaciones, con nombre
accesible «Ver el día 29 · 5 citas» y «Ver el día 30 · 1 cita» (singular
correcto). Píldoras del mes a 24 px de alto.

**EL TRINQUETE DE DISEÑO ME CAZÓ POR QUINTA VEZ EN EL CARRIL**: el contador
llevaba `fontSize: 10`, fuera de escala. Se arregló el cambio (`--t-overline`),
no el techo.

**RESIDUAL_RISK.** El punto ciego de `teclado-controles` sigue ahí para
cualquier otro que escriba un ternario parecido. No lo toqué: endurecerlo podría
marcar código preexistente de otras pantallas y este carril no las posee. Queda
**declarado** — es exactamente la familia «depende de que alguien se acuerde».

---

## Unidad 31 — `/finanzas` no era plana: estaba vacía

**CORRECCIÓN DE UN VEREDICTO MÍO.** En la matriz del PR declaré `/finanzas`
como **STATIC/FLAT**. Era un juicio hecho sobre una pantalla **sin datos**: la
siembra no tenía un solo cobro, así que todo salía a `$0.00`, con la gráfica en
blanco y la tabla sin filas.

Con doce cobros sembrados, la pantalla resulta tener bastante más jerarquía de
la que le atribuí: una tarjeta principal con tratamiento propio, dos de método
con barra de proporción, una **fila compacta** —no una tarjeta— para «otros
métodos», tres estadísticas secundarias visiblemente más ligeras, la gráfica y
dos desgloses.

Lo dejo escrito porque el error es del tipo que este carril lleva persiguiendo
toda la vuelta: **una pantalla vacía no se parece a la misma pantalla llena**, y
juzgarla vacía miente en las dos direcciones — puede parecer más limpia de lo
que es, o más pobre.

**LA SIEMBRA, AHORA CON FORMA REAL.** No un relleno bonito: varios métodos de
pago, **un reembolso** (monto negativo, que es el caso que rompe los promedios),
un importe de cinco cifras junto a otros de tres para ver si las columnas se
alinean, el paciente del nombre más largo, y días vacíos entre medias para que
la gráfica tenga relieve en vez de una meseta.

---

## Unidad 32 — una gráfica que sólo se lee con el ratón no es información

**FOUND.** «Ingresos por día» pinta una barra por día y las cifras vivían
**únicamente en `title=`**. Sin `role`, sin `aria-label`, sin tabla alternativa.

No existen en una tableta —donde no hay hover—, no existen para un lector de
pantalla, y no existen para quien mira desde un metro. El médico veía nueve
barras y no podía saber cuánto vale ninguna. **Nueve barras sin escala son una
textura, no un dato** — y aquí el dato es el dinero del consultorio.

**ROOT_CAUSE.** Misma familia que el estado de la cita (unidad 18): el dato
existía y llegaba por un canal de puntero. Es la tercera vez en este carril que
aparece el mismo patrón —estado de cita, tooltip del calendario, cifras de la
gráfica—, lo que sugiere que `title=` se ha usado en este producto como si fuera
un canal de información y no lo es.

**CHANGE.** El **techo** de la escala se dice a la vista (`máx. $12,500.00`), así
que cualquier barra se lee por proporción sin tocar nada; y cada barra entra en
el árbol accesible con su día, su importe y su número de cobros —diciendo «sin
cobros» cuando no los hay, que no es lo mismo que cero ambiguo—. De paso, la
cabecera dice **9 de 31 días con cobro**, que es la forma del mes en una línea.

**LO QUE SE DECIDIÓ NO HACER.** No se pinta el importe encima de cada barra: con
31 días es un muro de cifras de 8 px — cambiar ilegible por ilegible.

---

## Unidad 33 — mil píxeles de caja para doscientos de contenido

**FOUND.** El periodo se elegía en un segmentado (`Hoy · Semana · Mes`) y se
recorría en **una tarjeta a todo lo ancho** cuyo contenido entero era una
etiqueta y dos flechas.

**ROOT_CAUSE.** No es «una tarjeta de más». Es que el **granulado** y la
**posición dentro de ese granulado** son la misma pregunta —¿qué periodo estoy
mirando?— y estaban partidos en dos regiones, obligando a mirar en dos sitios
para saber una cosa.

**CHANGE.** Una fila: segmentado, separador fino, flechas y etiqueta. Las
flechas pasan además a decir de qué se mueven (`Mes anterior` / `Mes siguiente`),
que cambia con el granulado activo.

**SCORE.** Tarjetas en `/finanzas`: 13 → **12** a 1440 px, 16 → **15** a 390.
Unos 55 px de alto recuperados por encima del pliegue. La fatiga de tarjeta baja,
pero **sigue alta** y queda declarada: doce tarjetas es inventario, no jerarquía.

**GATES.** vitest 10 745/10 746 · lint 95 = techo · trinquete de diseño **bajado**
(`tamanosFueraDeEscala` 1950 → 1949; el guardián exige que el techo sea la
medición de hoy, sin holgura escondida) · tsc limpio · build compila · trinquete
de interfaz sin regresión, con `/finanzas` en axe 0 a los tres anchos.

---

## Unidad 34 — `title=` se estaba usando como si fuera un canal de información

**FOUND, y esta vez por patrón, no por pantalla.** El mismo defecto había
aparecido ya tres veces en este carril, cada una pareciendo aislada:

| Unidad | Dónde | Qué vivía sólo en `title` |
|---|---|---|
| 18 | rejilla del calendario | el **estado** de la cita |
| 32 | `/finanzas` | las **cifras** de «Ingresos por día» |
| 34 | `/citas` | el motivo de una cortesía, el aviso del calendario descuadrado y **la recomendación del riesgo de no-show** |

A la tercera deja de ser un defecto y pasa a ser un **hábito del código**.

**POR QUÉ NO SIRVE.** `title` es un canal de PUNTERO: no aparece al tocar en una
tableta —que es la mitad de los sitios donde se usa este producto—, los lectores
de pantalla lo anuncian de forma inconsistente o no lo anuncian, y no se ve de
lejos. Un dato que sólo está ahí es un dato que la mitad de la gente no tiene.

De los tres de `/citas`, el que duele es el **riesgo de no-show**: la insignia
decía el nivel («Alto») y la cifra y la **recomendación** —«Riesgo 58 de 100.
Activar doble confirmación 24 h y 2 h antes»— sólo salían al posar el ratón. Es
justo lo que le dice a la asistente si toca llamar al paciente.

**CHANGE.** Una utilidad reutilizable, `.nx-solo-lector`, que oculta a la vista
**sin sacar del árbol accesible** (`display:none` lo borraría). Los tres datos
pasan por ahí; `title` se queda como comodidad del ratón, que es para lo que
sirve.

**EL GUARDIÁN ENCONTRÓ UNO MÁS QUE YO NO HABÍA VISTO.** Al barrer las tres
pantallas marcó el bloque del calendario: su `title` decía el **médico** y el
nombre accesible no. En un consultorio de varios médicos, «de quién es esta
cita» era un dato de ratón — y en la rejilla el médico se distingue por COLOR,
que es el otro canal que no llega a todos. Arreglado: la etiqueta lo dice.

**Y EL GUARDIÁN TAMBIÉN SE EQUIVOCÓ UNA VEZ**, en mi contra y a mi favor: no
conocía `activable({ etiqueta })`, que es como este repositorio pone un nombre
accesible, y marcaba como huérfano un `title` que sí estaba cubierto. Enseñarle
el vocabulario no es aflojarlo — y el hallazgo de debajo era real.

**LA SIEMBRA, OTRA VEZ, ERA LO QUE FALTABA.** Ninguno de los tres avisos se
podía ver: no había cita de cortesía, ni cita descuadrada con Google, ni
paciente con historial de inasistencia. El código estaba escrito y la pantalla
que lo enseña **no se podía auditar**. Ahora la siembra produce los tres casos.
Es la tercera vez en esta vuelta que el arnés era el que no dejaba ver
(estado inventado, día equivocado, cero cobros).

**BROWSER_PROOF.** Build de producción, `/citas`:

```
". Riesgo 58 de 100. Activar doble confirmación 24 h y 2 h antes."   1×1 px
": Familiar del personal"                                            1×1 px
". Google Calendar quedó con los datos viejos de esta cita…"         1×1 px
```

Invisibles a la vista, presentes en el árbol. Y en el calendario:
«Cita de Rosalía Mendieta Cuevas a las 09:00 · Dra. Ximena Alcántara Robledo —
Confirmada».

**REGRESSION.** `title-no-es-un-canal-de-informacion.test.ts`, 6 casos, con un
barrido que exige que **ningún** `title` de las tres pantallas se quede solo.
Probado al revés tres veces: quitando el texto oculto del riesgo, ocultando la
utilidad con `display:none` (que la sacaría del árbol) y metiendo un `title`
nuevo sin otro canal.

**RESIDUAL_RISK.** El barrido cubre **sólo** las tres pantallas de este carril.
El resto de la aplicación tiene más `title=`; no se han auditado y **no se
declaran buenos**. Y no se comprueba el caso contrario —texto oculto que repite
lo visible y hace la lectura pesada—, que también es un defecto.

---

## Unidad 35 — la pantalla decía «0 citas» y «Cargando citas…» a la vez

**FOUND.** Con la red lenta, `/citas` mostraba **«0 citas»** en el chip de
resumen y, dos centímetros más abajo, **«Cargando citas…»**. El producto
contradiciéndose a sí mismo en un solo golpe de vista.

Y en el peor sentido: quien mira de reojo se queda con el número. Un médico que
abre la agenda del día, lee «0 citas» y cierra, se va con la idea de que no
tiene consulta.

**POR QUÉ NO SE HABÍA VISTO.** Porque en este entorno **no se puede ver**: los
emuladores son locales y todo llega en menos de medio segundo. La ventana de
carga no dura lo suficiente para mirarla. Hubo que **emular latencia** (2 s, por
CDP) para que existiera.

**DOS INSTRUMENTOS FALLARON ANTES, Y LAS DOS VECES MEDÍ UNA PANTALLA EN BLANCO
QUE ERA MÍA.** Interceptar `**/*` con `page.route` retrasa también el JavaScript
de la propia página; y aun acotando el patrón al emulador, la intercepción choca
con el **service worker** de la PWA. Las dos veces el resultado era `body` con
cero caracteres, que leído deprisa parecía un defecto gravísimo del producto. La
emulación por CDP va por debajo de las dos cosas.

**ROOT_CAUSE.** La LISTA sí estaba resuelta: enseña «Cargando citas…» y
distingue el fallo de carga del día vacío —hay un comentario en el propio
archivo explicando que «un fallo de carga no puede verse como *hoy no hay
nada*»—. **Alguien arregló la lista y no el contador que va encima**, que leía
`daySummary.total`, igual a 0 hasta que llegan los datos.

**CHANGE.** Mientras no hay datos en la mano —cargando **o** con error— el chip
no afirma un número: enseña «—» y dice «aún cargando» por el canal de lector.
Los chips de «por confirmar» y «por cobrar» tampoco aparecen, y el filtro queda
inerte.

**LA REGLA.** Ausencia de dato no es dato de ausencia (`clinical-safety`, regla
4) en lenguaje de interfaz: mientras no se sabe, **se dice que no se sabe**. Y
vale igual para el fallo que para la espera.

**BROWSER_PROOF.** Build de producción con 2 s de latencia emulada:

| Pantalla | Antes | Después |
|---|---|---|
| `/citas` | «**0 citas**» + «Cargando citas…» | «**— citas · aún cargando**» |
| `/finanzas` | «Calculando…» | sin cambio (ya estaba bien) |
| `/lista-espera` | «Cargando lista de espera…» | sin cambio (ya estaba bien) |
| `/calendario` | rejilla vacía que se llena | sin cambio (la rejilla ya informa) |

**REGRESSION.** `un-contador-no-dice-cero-mientras-no-sabe.test.ts`, 6 casos.

**Y OTRO CASO MÍO QUE MEDÍA LA FORMA.** El primero prohibía el literal
`{daySummary.total}` en el chip — y fallaba **con el arreglo puesto**, porque
ese literal sí aparece dentro de la rama buena del ternario. Prohibir un texto
que la solución usa no garantiza nada. Reescrito para exigir el **orden**: la
bandera se pregunta antes de leer el total. Tercera vez en esta vuelta que la
prueba al revés caza un guardián mío que medía la forma en vez del efecto.

**RESIDUAL_RISK.**

- El arranque en frío del panel con 2 s de latencia tarda **~6,4 s** hasta el
  primer contenido. Es característica del arranque de Next.js con los trozos
  throttled, no de estas pantallas, y **no se ha tocado**: queda medido y
  declarado, no arreglado.
- **No hay esqueletos en ninguna de las cuatro.** Las que informan lo hacen con
  texto («Calculando…», «Cargando lista de espera…»). Es honesto y no es
  moderno; cambiarlo es una decisión de diseño que no he tomado por mi cuenta.
- No se han auditado los contadores del resto de la aplicación.

---

## Unidad 36 — ocho alternativas de una elección no son ocho objetos

**CORRECCIÓN DE MI PROPIA MEDIDA, PRIMERO.** Vengo diciendo «15 tarjetas en
`/asistente`». Al desglosarlas una a una resulta que mi heurística —rectángulo
con borde y radio— cuenta como tarjeta **dos campos de formulario** y **tres
filas de lista**, que no lo son. La fatiga real eran las **ocho opciones de tipo
de consulta**. El número que repetí en el PR estaba inflado por el instrumento.

**FOUND.** Los ocho tipos eran ocho rectángulos con borde propio, mismo tamaño y
mismo peso: 179×56 a 1440 px, 292×56 a 390.

**ROOT_CAUSE, y la segunda parte importa más que la primera.**

1. Leídas de golpe son inventario (§6: las tarjetas indican agrupación con
   sentido, no decoran contenido).
2. Era **falso como modelo**. No son ocho cosas: son ocho formas de contestar
   **una** pregunta. Un control, no un catálogo. Y como eran ocho `<button>`
   sueltos, con teclado se tabulaba ocho veces y el lector anunciaba ocho
   botones sin relación entre sí.

El detalle que convierte un control en un catálogo es dónde está el borde: si
cada alternativa tiene su caja, el ojo cuenta ocho objetos antes de entender que
sólo puede elegir una.

**CHANGE.** El borde pasa al grupo; las opciones se separan con líneas internas;
sólo se destaca la elegida. Y se declara como lo que es: `radiogroup` + `radio`
+ `aria-checked`.

**EL MISMO ERROR MÍO, POR SEGUNDA VEZ.** La primera versión pintaba el fondo de
la opción elegida **en línea**, así que ganaba a `:hover` y dejaba el resaltado
muerto — el defecto exacto de la unidad 22, cometido otra vez y en otro archivo.
Me acordé antes de construir. Ahora va por `data-elegido` y lo pinta la hoja.

**BROWSER_PROOF.** Build de producción:

| | Antes | Después |
|---|---:|---:|
| Cajas con borde en `/asistente` @390 | 16 | **9** |
| Cajas con borde @1440 | 15 | **8** |
| Alto del panel izquierdo @390 | 789 px | **543 px** |
| axe | 0 | **0** |

Comprobado además en el navegador: `radiogroup` con ocho `radio`, exactamente
uno `aria-checked`, el resaltado al pasar el ratón vivo
(`transparent → rgb(26,29,33)`), y al elegir otra opción la marca se mueve —y
la sugerencia de día recalcula sola (9 lugares con un tipo de 60 min, **18** con
uno de 30).

**REGRESSION.** `ocho-alternativas-no-son-ocho-objetos.test.ts`, 5 casos.
Probado al revés tres veces: devolviendo el borde a cada opción, quitando el
`radiogroup`, y devolviendo el fondo a la línea.

**GATES.** Trinquete de diseño **bajado dos veces más**
(`tamanosFueraDeEscala` 1949 → 1948, `radiosFueraDeEscala` 619 → 618): su
guardián exige que el techo sea la medición de hoy, sin holgura escondida.

**RESIDUAL_RISK.** `role=radio` promete recorrido con flechas dentro del grupo y
**el navegador no lo implementa solo**: hoy se sigue tabulando opción a opción.
Queda declarado. Y no se juzga si ocho tipos son demasiados — eso es
configuración del consultorio, no diseño.

---

## Unidad 37 — «Guardando…» para siempre, y una promesa que no se puede cumplir

**FOUND.** Con la red cortada, el alta de la asistente se quedaba en
**«Guardando…»**, con el botón deshabilitado, **más de 18 segundos** y sin
resolverse. Ni error, ni éxito, ni forma de saber si la cita se creó.

Es el peor de los tres estados posibles. «Falló» se reintenta; «se guardó» se
cierra; **«no lo sé» produce el reintento a ciegas**, que es exactamente como se
fabrica una cita duplicada — el mismo daño que la unidad 8 arregló del lado del
paciente.

**CÓMO SE DESCUBRIÓ.** Rellenando el formulario en el navegador, cortando la red
con `setOffline(true)`, pulsando «Agendar cita» y **vigilando el botón cada
500 ms**. Sin ese muestreo el defecto no se ve: una captura al final parece
simplemente una pantalla cargando.

**LA PRIMERA CAUSA QUE ENCONTRÉ NO ERA LA CAUSA, Y LO DEJO ESCRITO.** Vi que
`fetchAutenticado` hacía dos esperas seguidas y sólo una tenía techo:
`usuarioCuandoSePueda()` sí (8 s, con el motivo escrito en el archivo — «es
mejor fallar con un mensaje claro que dejar la pantalla girando para siempre») y
`user.getIdToken()` no. Le puse tapa. **Volví a medir y el botón seguía colgado
pasados los 12 s.** No era eso.

El arreglo se queda igualmente, y no por consuelo: `getIdToken()` sin red
tampoco falla, reintenta por dentro y deja la promesa pendiente. Es el mismo
agujero, en la línea de al lado de la que sí tenía tapa, en un camino que usan
**53 archivos**.

**LA CAUSA DE VERDAD.** `getPatients()` — una lectura del SDK de Firestore.
**Sin red no rechaza: se queda pendiente.** Y una promesa que ni resuelve ni
rechaza deja inútil al `try/catch` que la rodea —no hay nada que capturar— y al
`finally` que devuelve el botón a su sitio. `setSaving(false)` estaba escrito, y
bien, y no llegaba a ejecutarse jamás.

**CHANGE.** `conTiempoLimite`, hermano de `fetchConTimeout` para promesas que no
son un `fetch` propio, compartiendo el mismo `TiempoAgotado` — para que quien
llame distinga «se tardó» de «falló» venga de donde venga. Se aplica a la
lectura y al alta del expediente, y el token pasa a usar el mismo mecanismo:
dos mecanismos para lo mismo divergen, y este archivo ya tuvo una espera con
tapa y otra sin ella.

**Y UNA PROMESA QUE NO SE PUEDE CUMPLIR.** La franja de «sin conexión» decía
«**Los cambios se sincronizarán al reconectar**». Es cierto de las escrituras
del SDK de Firestore, que tiene persistencia offline. **Es falso de todo lo que
pasa por una ruta de API** — el alta de una cita, entre otras.

Se vio en el mismo experimento: la franja prometía sincronizar mientras la
petición moría. La asistente que lee eso cierra el portátil tranquila y la cita
no existe. Es la regla 3 de `clinical-safety` con el signo al revés: se
anunciaba un cambio que no iba a ocurrir. Ahora dice lo que se sostiene — que se
puede seguir consultando, y que lo que se guarde ahora puede no registrarse.

**BROWSER_PROOF.** Build de producción, red cortada, muestreando cada 500 ms:

| | Antes | Después |
|---|---|---|
| Estado del botón | «Guardando…», `disabled`, **>18 s sin resolverse** | vuelve a «Agendar cita», habilitado, a los **8,1 s** |
| Aviso | ninguno | «✕ Error al guardar la cita» |
| Franja de offline | promete sincronizar | dice que puede no registrarse |

**REGRESSION.** `el-boton-no-se-queda-en-guardando-para-siempre.test.ts`, 8
casos, incluido uno de **comportamiento** con temporizadores falsos: una promesa
que nunca resuelve acaba rechazando en vez de colgar. Probado al revés cinco
veces.

**RESIDUAL_RISK.**

- `Promise.race` **no cancela** la promesa perdedora: la lectura de Firestore
  sigue viva por dentro. Lo que se recupera es el control del flujo, que es lo
  que le devuelve el botón a la asistente — no un ahorro de trabajo.
- Los **otros 52 archivos** que usan `fetchAutenticado` no se han recorrido uno
  a uno: heredan el techo del token, pero si alguno espera además a una promesa
  del SDK sin tapa, tendrá el mismo defecto. No se declaran buenos.
- El texto nuevo de la franja **no se ha probado con nadie**: es más honesto,
  no necesariamente el mejor redactado.
