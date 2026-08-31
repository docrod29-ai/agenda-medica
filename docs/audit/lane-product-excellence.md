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

---

## Unidad 38 — el barrido, y la asimetría que lo explica todo

Tras la unidad 37 prometí recorrer los demás caminos de escritura buscando la
misma familia. Esto es ese barrido, y encontró **menos de lo que esperaba y algo
mejor**: la regla que hay detrás.

**EL BARRIDO.** De las nueve pantallas y modales de este carril con bandera de
«guardando», tres esperaban a una llamada del SDK sin techo: `/lista-espera`
(cinco), `AppointmentModal` (una) y `CobrarModal` (una, y es la del dinero).

**NO TOQUÉ EL CAMINO DEL DINERO SIN MIRARLO.** `CobrarModal` es código cuidadoso
—tiene una clave de idempotencia que sobrevive al reintento, escrita
explícitamente para el caso del timeout—, así que en vez de aplicarle el arreglo
por analogía, sembré una cita `atendida` sin cobrar (el único estado en el que
aparece el botón «Cobrar»; **cuarta vez en esta vuelta que la siembra era lo que
impedía ver una pantalla**) y lo medí.

**Y NO SE CUELGA.** Sin red, el botón vuelve a la normalidad a los **1,5 s**.

**LA ASIMETRÍA, QUE ES EL VERDADERO HALLAZGO.**

| | Sin red | Por qué |
|---|---|---|
| **Leer** (`getPatients`, `getDocs`) | **se queda pendiente** | necesita al servidor; no rechaza, espera |
| **Escribir por el SDK** (`addDoc`) | **resuelve en local** | la persistencia offline lo encola |
| **Escribir por ruta de API** (`fetchAutenticado`) | falla | no hay cola: se pierde |

El alta de la asistente se colgaba porque hacía una **lectura** antes de
escribir. El cobro no se cuelga porque sólo escribe. No era «los formularios se
cuelgan»: era **una lectura sin techo en medio de un envío**.

Eso convierte tres «hay que arreglarlo» en **uno**, y explica por qué.

**Y ME OBLIGÓ A CORREGIR MI PROPIO ARREGLO DE LA UNIDAD 37.** Había cambiado la
franja de offline a «lo que guardes ahora **puede no registrarse**». Medido,
también es impreciso — y en la dirección que hace daño: las escrituras del SDK
**sí** se guardan. Decirle a la asistente que su cobro puede perderse la empuja
a repetirlo. Ese es el daño simétrico del que arreglé.

Una franja global no sabe qué va a hacer quien la lee, así que ahora dice lo
único cierto de las dos familias: «**Algunas acciones no se guardarán hasta
recuperar la señal**». Ni promete una cola que no cubre las rutas de API, ni
niega la que sí existe.

**RESIDUAL_RISK.**

- `/lista-espera` y `AppointmentModal` **siguen con lecturas sin techo**. No las
  he medido, así que **no digo que estén rotas ni que estén bien**: digo que
  tienen la forma del defecto y que no las he mirado. Aplicarles el arreglo a
  ciegas sería exactamente lo que no hice con el cobro.
- La tabla de la asimetría vale para la configuración actual de persistencia
  offline. Si alguien la desactiva, las escrituras del SDK pasan a la tercera
  fila y la franja vuelve a quedarse corta.

---

## Unidad 39 — cerrar el barrido midiendo, y no encontrar nada

De la unidad 38 quedaban dos candidatos sin medir. Los dejé escritos como «tienen
la forma del defecto y no los he mirado». Esto es mirarlos.

**`/lista-espera` — NO se cuelga.** Con la red cortada, el alta vuelve a la
normalidad en **7,1 s** (10,1 s en una corrida anterior: variable, pero acotado).
Su `handleSave` sólo **escribe** (`createWaitlistEntry`), y por la asimetría de
la unidad 38 eso resuelve en local. Las otras cuatro esperas del archivo son
lecturas de la carga inicial y actualizaciones de fila: la lectura deja la
pantalla en «Cargando lista de espera…», que es honesto, no una mentira.

**No hay arreglo que hacer.** Lo anoto porque un barrido que sólo se escribe
cuando encuentra algo acaba siendo un catálogo de sustos.

**LO QUE SÍ QUEDÓ ANOTADO, sin arreglar:** siete segundos para una escritura que
en `/cobrar` tarda uno y medio. Las dos son escrituras del SDK, así que la
diferencia es de la propia llamada, no de la familia. No lo he investigado y no
lo declaro bueno: está medido y dicho.

**Y UNA VERIFICACIÓN QUE ME DEBÍA A MÍ MISMO.** En la unidad 38 afirmé en el
mensaje del commit que la franja «ahora dice: *Algunas acciones no se guardarán
hasta recuperar la señal*». Al medir `/lista-espera` la franja seguía enseñando
la redacción **intermedia** — el build era anterior al cambio. Reconstruido y
vuelto a mirar, ya dice la definitiva.

Es exactamente el defecto que este carril lleva persiguiendo desde la unidad 23:
**afirmar desde el código lo que no se ha visto en la pantalla.** Esta vez me
tocó a mí, en la frase de un commit.

**`AppointmentModal` sigue sin medir.** Su espera es `crearSolicitudResena`, una
escritura, en un camino secundario (pedir reseña tras la cita). Por la asimetría
no debería colgarse, pero **eso es un razonamiento, no una medición**, y así
queda declarado.

---

## Unidad 40 — el médico le mandaba al paciente un enlace que el servidor no conocía

**CÓMO SE LLEGÓ AQUÍ.** Buscando otra cosa. `AppointmentModal` era el último
candidato del barrido de la unidad 38 —«¿se cuelga sin red?»— y la respuesta es
**no**: `crearSolicitudResena` escribe con `setDoc`, y las escrituras del SDK
resuelven en local.

**Justo esa respuesta destapa el defecto de verdad: resolver en local es
precisamente el problema** cuando lo siguiente que se hace es mandarle algo a
una persona.

**FOUND.** «Pedir reseña» hace tres cosas seguidas: crea la solicitud, coge el
token que devuelve y **abre WhatsApp con un enlace que lo lleva dentro**. Sin
red, la promesa cumple, el token vuelve y el mensaje sale. El servidor no ha
visto ese token nunca.

El paciente lo abre y lee **«Enlace no válido»** — comprobado en
`app/resena/[token]`, que es exactamente lo que contesta cuando el documento no
existe. El médico cree que pidió la reseña; el paciente recibe un enlace roto de
su consultorio.

Si la red vuelve antes de cerrar la pestaña, la cola de Firestore lo sincroniza
y el enlace acaba funcionando. Si no vuelve, **se pierde**: el mensaje ya salió y
el token no existirá jamás.

**LA REGLA.** `el-dato-tiene-que-LLEGAR.md`, en su forma más literal: cuando algo
cruza una frontera, hay que mirar del otro lado antes de dar nada por entregado.
Aquí la frontera es **un mensaje a una persona real, y no se puede deshacer**.

Una escritura local no es una escritura entregada. Si de ella cuelga un acto
hacia fuera —un WhatsApp, un correo, una receta—, hay que confirmar antes.

**CHANGE.** Sin red, el acto hacia el paciente no ocurre y se dice por qué. La
comprobación va **antes** de crear la solicitud: crearla y no mandarla dejaría
basura sincronizándose sin motivo. Lo demás del modal sigue funcionando — no es
«bloquear la pantalla sin red», es detener lo único que sale hacia fuera.

**REGRESSION.** `no-se-manda-un-enlace-que-el-servidor-no-conoce.test.ts`, 5
casos, dos de ellos vigilando que la **premisa siga viva**: que el lado del
paciente siga contestando «Enlace no válido» a un token desconocido, y que la
solicitud se siga creando con `setDoc`. Si algún día pasa por una ruta de API,
esta guarda sobra — y habrá que quitarla a conciencia, no dejarla de
superstición. Probado al revés dos veces.

**RESIDUAL_RISK.**

- `navigator.onLine` sabe si hay interfaz de red, **no si el servidor
  responde**. Un wifi de hotel que engancha y no enruta pasaría el filtro.
  Cierra el caso frecuente, no todos.
- **No se han barrido los demás actos hacia fuera** de la aplicación
  —recordatorios, recetas, portal del paciente—. Este carril sólo ha mirado
  éste, y **no declara buenos los otros**. Es la unidad que más claramente pide
  continuación.

---

## Unidad 41 — barrer los demás actos hacia fuera, y no encontrar más

La unidad 40 acabó diciendo que era «la que más claramente pide continuación».
Esto es esa continuación: los **siete** sitios que mandan un WhatsApp desde la
aplicación, mirando en cada uno si el envío cuelga de una escritura previa que
sin red resolvería en local.

**Resultado: uno solo, y era el ya arreglado.**

| Sitio | Envío tras escritura local |
|---|---|
| `AppointmentModal` (pedir reseña) | **sí** — arreglado en la unidad 40 |
| `/lista-espera` (avisar de un hueco) | **no** (ver abajo) |
| `/citas`, `/reactivacion`, `EntregarAlPaciente`, `lib/whatsapp` | no |

**EL BARRIDO SE EQUIVOCÓ UNA VEZ, Y LO COMPROBÉ EN VEZ DE ACTUAR.** Marcó
`/lista-espera` porque encontró un `await updateWaitlistEntry(` en las 900
letras anteriores al envío. Leyéndolo, ese `await` es de **otra función** de más
arriba: en `enviarAviso` el WhatsApp sale **primero** y la escritura viene
después, y es sólo contabilidad («marcar contactado»). El contenido del mensaje
no depende de ningún token local.

Si esa escritura se encola sin red, el paciente ya recibió un mensaje **válido**;
el único riesgo es que se le vuelva a avisar más tarde. Molesto, no roto — y de
otra familia.

**Actuar sobre el hallazgo del escáner sin leerlo habría metido una guarda de
red en un camino que no la necesita**, encareciendo el aviso a un paciente que
espera un hueco. Es la misma disciplina que con `CobrarModal` en la unidad 38.

**RESIDUAL_RISK.** El barrido cubre los envíos por **WhatsApp desde el
navegador**. No cubre los que salen del servidor —el cron de recordatorios, el
webhook— ni el correo, ni la impresión de una receta. Este carril no los ha
mirado y **no los declara buenos**.

---

## Unidad 42 — dos cosas medidas para NO hacerlas

Las dos veces la medición dijo que no había trabajo que hacer. Se anotan porque
un carril que sólo escribe cuando cambia algo acaba pareciendo que nunca se
equivoca al elegir qué tocar.

### 1. No hay esqueletos de carga — y no hacían falta

Llevo varias unidades declarando «sin esqueletos en ninguna pantalla» como si
fuera deuda. El §12 los pide «donde convenga» y desaconseja los giradores a
pantalla completa, así que la hipótesis razonable era: **el girador centrado
provoca un salto de maqueta cuando llega el contenido**.

**Medido con 1,5 s de latencia emulada, muestreando cada 400 ms:**

| Pantalla | Posición del primer texto, cargando → cargado |
|---|---|
| `/citas` | 56 px → **56 px** |
| `/finanzas` | 26 px → **26 px** |
| `/lista-espera` | 24 px → **24 px** |

**Ninguna se mueve.** El alto del documento crece (900 → 972, 900 → 2042) porque
aparece contenido por debajo del pliegue, que es lo que tiene que pasar.

Sin salto, un esqueleto sería **decoración**: cambiaría un texto honesto
(«Cargando citas…», «Calculando…») por una animación que no resuelve nada. Es
exactamente lo que el §27 llama pulido falso. **No se añaden.**

Queda como preferencia declarada, no como defecto: el producto informa con
texto, y eso es honesto aunque no sea lo que está de moda.

### 2. El §26 estaba bloqueado de verdad, y ahora lo sé

Llevo todo el carril escribiendo que «este entorno no tiene acceso al producto
de referencia» y **nunca lo había comprobado**. Es exactamente la clase de
afirmación cómoda que este carril persigue en el código ajeno.

**Comprobado:** `curl` a hosts externos devuelve `http=000`, y el estado del
proxy lo explica — `connect_rejected: gateway answered 403 to CONNECT (policy
denial)`, incluido `www.google.com`. La salida a la web general está denegada
por política del entorno.

Así que la evaluación estructurada contra el referente es **BLOCKED_EXTERNAL con
evidencia**, no una excusa. Y sigue en pie la consecuencia: **ninguna dimensión
se declara PARITY ni ABOVE**, porque declararlo sin haber visto el referente es
justo lo que el §26 prohíbe.

---

## Unidad 43 — se protegió el ENVÍO de WhatsApp y no la CONEXIÓN

**CÓMO SE LLEGÓ AQUÍ.** Comprobando una afirmación del propio repositorio. La
cabecera de `lib/fetch-con-timeout.ts` dice que nació, entre otras cosas, porque
«los envíos de WhatsApp, igual: cinco `fetch` sin timeout dentro de un cron que
recorre todos los consultorios **en serie**».

**Verificado: `lib/whatsapp-send.ts` usa el helper en 5 de 5.** La afirmación era
cierta y el arreglo llegó. Eso también hay que escribirlo.

**FOUND.** El mismo barrido encontró **siete `fetch` crudos** a la API de Meta en
los caminos de **conexión**: seis en `meta-connect` y uno en `manual-connect`. Se
protegió el envío y no la conexión — el patrón «alguien arregló uno y no el de al
lado» por cuarta vez en esta vuelta.

**POR QUÉ NO ES SÓLO UNA FACTURA.** Aquel módulo argumenta con el coste: «un
socket colgado del proveedor inmoviliza el lambda los 300 segundos completos,
facturados por GB-segundo». Cierto, y no es lo peor.

El médico que conecta su WhatsApp pulsa el botón y **lo ve girar minutos**,
porque su petición espera a esta ruta, que espera a Meta. Es la misma familia que
el «Guardando…» eterno de la unidad 37: ni error, ni éxito, ni nada que hacer.
`setConnecting(false)` está escrito en `configuracion`, y bien, y no llega a
correr hasta que el servidor conteste.

**Eso es lo que lo hace de este carril y no del de endurecimiento**: el síntoma
es un recorrido del médico, no una línea de la factura. Los dos archivos están
libres del otro carril; verificado antes de tocarlos.

**CHANGE.** Las siete llamadas pasan por `fetchConTimeout`, y **«se tardó» se
contesta distinto de «falló»**: `TiempoAgotado` → **504** con «Meta no respondió
a tiempo. **No se cambió nada**: vuelve a intentar la conexión.»

Esa última frase es la que decide qué hace el médico: reintentar, en vez de
ponerse a revisar unas credenciales que están bien.

**REGRESSION.** `conectar-whatsapp-no-cuelga-la-funcion.test.ts`, 4 casos, uno de
ellos vigilando que **el envío siga protegido** — si al arreglar la conexión se
rompiera aquello, habríamos cambiado un agujero por otro. Probado al revés dos
veces.

**RESIDUAL_RISK.**

- Escáner de fuente: **no llama a Meta ni simula un socket colgado**. Que el
  helper aborte de verdad lo cubre `ops-timeout-y-punto-ciego`, que en este
  entorno falla por red —necesita una IP que trague paquetes— e igual en `main`.
- **No se han barrido las demás integraciones del servidor** (Google Calendar,
  Stripe). Este carril ha mirado el camino de WhatsApp y **no declara buenos los
  otros**.
- No se juzga el valor del tiempo máximo: lo pone el helper por omisión.

---

## Unidad 44 — un `catch` protege de un fallo; no protege de un silencio

**CÓMO SE LLEGÓ AQUÍ.** Cerrando el residual que dejó escrito la unidad 43: «no
se han barrido las demás integraciones del servidor (Google Calendar, Stripe)».
El barrido llevaba la pregunta de la unidad 37: **¿dónde se espera a alguien de
fuera sin techo de tiempo?**

- **Stripe** — ningún `fetch` crudo. Nada que arreglar, y se dice: no todo
  barrido tiene que producir un arreglo para haber servido.
- **`api/receta/diseno`** — uno. Proxy del membrete de la receta contra Firebase
  Storage. El navegador acota al cliente porque lo consume como `<img src>`; la
  función no se acota sola.
- **`lib/calendario/ocupado-servidor.ts`** — **ninguno, y aun así el peor**,
  porque no usa `fetch`: usa el SDK `googleapis`, que no trae tiempo máximo. Un
  barrido de `fetch(` no lo habría encontrado nunca.

**FOUND.** Este módulo **ya degradaba bien** cuando Google falla, y lo tenía
razonado por escrito en `POR_QUE_NO_SE_ESCONDE_EL_DIA`: «ni la agenda pública ni
el bot se caen porque Google tenga un mal día». El `catch` devuelve el día entero
libre y lo declara con `fallo: true`. Está bien pensado y está bien escrito.

Pero **un cuelgue es Google teniendo un mal día**, y era justo el caso que no
cubría: una promesa que no se resuelve ni se rechaza **no entra en el `catch`**.
No hay nada que capturar. La degradación estaba escrita y no llegaba a
ejecutarse.

Es la misma forma que el «Guardando…» eterno de la unidad 37, y la misma familia
de defecto que ya tiene nombre en este repositorio: **escrito, probado y sin
conectar** — sólo que aquí lo que no se conecta es el camino de degradación
consigo mismo.

**A QUIÉN LE PASA.** A los tres caminos que agendan sobre esta consulta, y el
peor es el público: **un paciente mirando la pantalla de reserva** mientras la
petición de disponibilidad no acaba. No ve un error —vería otra cosa—, ve una
pantalla que carga para siempre. Eso lo hace de este carril: el síntoma es un
recorrido, no una línea de la factura.

**CHANGE.**

- `ocupado-servidor.ts`: `intervalosOcupados` va dentro de `conTiempoLimite` con
  `ESPERA_GOOGLE_MS = 6000` — generoso para una llamada real a Google, muy por
  debajo de lo que aguanta quien mira una pantalla de reserva. Al agotarse toma
  **exactamente el mismo camino que un fallo** (`fallo: true`, sin bloqueos), que
  es el que este archivo ya declaró correcto y justificó por escrito. No se
  inventa una conducta nueva: se hace alcanzable la que ya había.
- La constante se subió por encima de la función que la lee, en vez de dejarla
  al final del archivo donde la escribí primero: leer una `const` de módulo desde
  arriba funciona, pero pide al que lee el archivo que confíe en el orden de
  evaluación para entenderlo.
- `api/receta/diseno/route.ts`: el `fetch` crudo pasa a `fetchConTimeout`.

**REGRESSION.**
`un-google-que-no-contesta-no-cuelga-la-agenda-publica.test.ts`, 5 casos.

Y aquí sí es **de conducta, no un escáner de fuente**: se sustituye
`intervalosOcupados` por una promesa que **ni resuelve ni rechaza** y se
comprueba que `ocupadoEnGoogle` **vuelve**. Los otros dos casos existen para que
un `return VACIO` a secas no pase la prueba: una respuesta lenta que llega
dentro del plazo tiene que seguir contando, y un fallo declarado de Google tiene
que degradar como antes.

**PROBADO AL REVÉS.** Quitando `conTiempoLimite`, «Google mudo» no falla con un
mensaje: **se queda colgada 8 s y vitest la mata por tiempo agotado del caso** —
que es exactamente lo que le pasaba al paciente. Restaurado el `fetch` crudo,
cae el caso del membrete.

**COMPUERTAS.** `vitest` 10 785 casos en 791 archivos, verde · trinquete de lint
95, igual al techo · trinquete de diseño sin deuda nueva · `tsc` limpio ·
`npm run build` compila (con configuración de Firebase **sintética**: sin ella el
build no recoge `/dr/[clinicId]`, y eso es del entorno, no de la rama).

**RESIDUAL_RISK.**

- `Promise.race` **no cancela la llamada perdedora** —no se puede, con una
  promesa ajena—, así que la petición a Google sigue viva por dentro. Lo que se
  recupera es el control del flujo, no el socket.
- La prueba **no llama a Google**: prueba el control de flujo de este módulo, no
  la librería.
- El caso del membrete **es** un escáner de fuente: dice que no queda `fetch`
  crudo, no que Storage aborte de verdad.
- Los 6 s son un número de producto, no una invariante: no se prueba su valor.
- El barrido cubrió Stripe, Google Calendar y el proxy del membrete. **No declara
  buenas** las integraciones que no aparecen aquí.

---

## Unidad 45 — una lectura que falla no puede volver viejo y vacío un expediente

**CÓMO SE LLEGÓ AQUÍ.** Con la pregunta que dejó abierta el contador de
`/citas` (unidad 39): **¿qué pantalla apaga el «cargando» tras un fallo que
nadie ve?** Barrido de las 80 pantallas del panel que pintan un estado vacío.

Tres candidatas. Dos, **falsas**: `/resenas` y `/membresias` ya tienen el vacío
detrás del `loading`. Se comprobaron **leyendo**, no arreglando — mi barrido sólo
miraba dos líneas hacia atrás y no veía el `loading ?` que envuelve el bloque
entero. Es la cuarta vez en este carril que un hallazgo del instrumento no
sobrevive a que alguien lea el archivo, y por eso se leen todos.

La tercera no era falsa.

**FOUND.** `/cumplimiento/retencion` es la pantalla de la **NOM-004 5.7**: dice
qué expedientes superaron los cinco años desde el último acto médico. Cargaba
las notas de cada paciente y, al fallar esa lectura, hacía esto:

```
catch { return evaluarRetencion(p, [], p.ultimaCita) }
```

`[]` no es «falló la lectura»: es **«este paciente no tiene notas»**. Y el motor,
que no podía distinguirlas, calculaba con eso. Dos consecuencias, en la misma
fila:

- Sin notas, la fecha del último acto **cae hasta `ultimaCita` o `createdAt`**.
  Un paciente al que se le sigue escribiendo pero cuyas citas no se llevan aquí
  queda fechado **el día en que se dio de alta** — y a los cinco años de eso sale
  en rojo como «>5 años».
- `notasFirmadas` valía 0, y la fila **ocultaba** la insignia (`notasFirmadas > 0
  &&`). El expediente aparecía sin conservar nada.

La lectura que falló hacía parecer el expediente **a la vez viejo y vacío** —
justo las dos señales que invitan a archivarlo. Y la cabecera del módulo dice
para qué sirve: conservar, archivar o **anonimizar**.

Silencioso, además: el `catch` estaba **vacío**. Ni un `console.error`.

Y dos defectos más en la misma carga: el `async` exterior **no tenía `catch`**,
así que un fallo de `getPatients` dejaba «Evaluando expedientes…» fijo para
siempre; y sin techo de tiempo, una lectura sin red —que **no rechaza**, se queda
pendiente, como estableció la unidad 37— hacía lo mismo sin que hubiera fallo
ninguno.

**POR QUÉ ES DE ESTE CARRIL.** Porque el síntoma es lo que el médico **lee** en
una pantalla de decisión: un veredicto legal y un recuento de notas, los dos
inventados a partir de un hueco. Es la regla 4 de seguridad clínica —ausencia de
dato no es dato de ausencia— dicha en lenguaje de interfaz, y la 2: un motor que
no puede calcular **lo dice**.

**CHANGE.**

- `lib/retencion.ts`: `notas` admite `null` = «no se pudieron leer», distinto de
  `[]` = «no tiene». Con `null` no se calcula nada: `estado: 'no_evaluable'`,
  `ultimoActo` y `diasDesdeUltimoActo` en `null`, `notasFirmadas` en `null`.
  `no_evaluable` **no es un cuarto grado de antigüedad**: es la ausencia de
  veredicto, y por eso no se pinta ni en ámbar ni en rojo.
- `listarPacientesPorRevisar` los pone **primero**, y no por antigüedad —no la
  tienen— sino porque su pendiente es del sistema, no del expediente.
- La pantalla: `null` en vez de `[]`; techo en las dos lecturas; `finally` que
  apaga el «cargando» pase lo que pase; aviso cuando hay expedientes sin evaluar
  («los totales de abajo **no los incluyen**»); y un fallo de carga que **no** se
  contesta con «Ningún paciente requiere acción», que era la respuesta
  tranquilizadora que este fallo no puede dar.
- La fila sin veredicto dice lo que pasó: «No se pudieron leer sus notas: no se
  evaluó su antigüedad».

Los tres errores de tipo que salieron al cambiar el modelo señalaron **exactamente**
los tres sitios donde la pantalla pintaba un veredicto sacado de un hueco.

**REGRESSION.** `una-lectura-que-falla-no-vuelve-viejo-un-expediente.test.ts`,
10 casos: 6 de **conducta** sobre el motor, 4 de cableado sobre la pantalla.

**PROBADO AL REVÉS.** Devolviendo el `[]` original, caen 5 de 10 — y el primero
enseña el defecto entero en una línea:

```
AssertionError: expected 'vencido' to be 'no_evaluable'
```

Mismo paciente, mismo día, misma base de datos. Lo único que cambió es si la
lectura de sus notas funcionó. Los otros 5 casos siguen pasando, que es lo que
dice que la prueba discrimina y no se limita a exigir el arreglo.

(El primer intento de probarlo al revés **rompió la sintaxis** del módulo en vez
de su conducta: eso no prueba nada y se rehízo. Un rojo no vale por ser rojo.)

**COMPUERTAS.** `vitest` 10 794/10 795 · trinquete de lint 95, igual al techo ·
trinquete de diseño sin deuda · `tsc` limpio · `npm run build` compila ·
`SCREEN_INVENTORY.md` regenerado con su script, que es lo que pide su guardián.

El único rojo es `ops-timeout-y-punto-ciego`, que necesita una IP que trague
paquetes y **falla igual con mis cambios guardados aparte** — comprobado en este
mismo árbol, no supuesto. Ya estaba declarado en la unidad 43.

**RESIDUAL_RISK.**

- La prueba de la pantalla es un **escáner de fuente**: no renderiza. Lo que
  comprueba es el cableado (`null`, no `[]`) y que el «cargando» se apague.
- El módulo hace **una lectura de notas por paciente** (`Promise.all` sobre
  todos). No se toca: rediseñarlo es otra unidad, y con techo por lectura el
  síntoma que importaba —la pantalla clavada— ya no ocurre.
- No se juzgan los umbrales de la NOM (5 años, 4½): son política.
- `retencion` **no está** en `lib/clinical/registry.ts`. No se añade: es un
  cálculo legal-administrativo, no un motor clínico, y ese archivo es del otro
  carril. Queda dicho, no resuelto.
- El barrido cubrió las pantallas del panel que pintan un vacío y apagan un
  «cargando». **No declara buenas** las que no aparecen aquí. Los dos hallazgos
  restantes (`hospitalizacion/camas`, `hospitalizacion/indicadores`) son ALPHA
  detrás de bandera y quedan **anotados, no arreglados**: este carril es
  Consultorio.

---

## Unidad 46 — medir catorce pantallas por primera vez, y lo que salió

**CÓMO SE LLEGÓ AQUÍ.** El trinquete de interfaz cubría **6 rutas de 80**, las
seis de la familia de la agenda —las que este carril había arreglado—. Todas en
cero. Ese cero decía «lo que miro está bien», no «el producto está bien». El
hueco real del §3/§20/§22 no eran las seis medidas: eran las **setenta y cuatro
sin medir**.

Se añaden catorce pantallas de Consultorio (no hospital ni UCI: son ALPHA y no
se venden; no rutas con parámetro: necesitan id sembrado). 20 rutas × 3 anchos =
**60 combinaciones**.

**FOUND — y estaba ahí desde siempre.**

| Ruta | Violación | Impacto |
|---|---|---|
| `/crm` | `select-name` — el selector de periodo del análisis, sin nombre | **CRÍTICO** |
| `/farmacia` | `select-name` — el filtro de categoría del inventario | **CRÍTICO** |
| `/corte-caja` | `label` — el campo de fecha: **qué día se cuadra** | **CRÍTICO** |
| `/consultor` | `button-name` — el botón de ENVIAR la pregunta clínica | **CRÍTICO** |
| `/dashboard` | `color-contrast` ×2 — 2.85 : 1 | serious |
| `/reactivacion` | `color-contrast` — 2.93 : 1 | serious |

Y dos rutas con **`aria-current` 0** en los tres anchos: `/corte-caja` y
`/consultor`. El riel no contesta «dónde estoy».

**LAS CAUSAS RAÍZ, QUE NO SON «FALTABA UN `aria-label`».**

1. **Los componentes ya habían aprendido la lección; nada obliga a usarla.**
   `Field.tsx` documenta este mismo defecto («un lector de pantalla anunciaba el
   control sin nombre») y asocia la etiqueta **cuando se le da una**. Nada exige
   dárselas. Familia «depende de que alguien se acuerde».

2. **`/dashboard`: el CSS prohibía por escrito lo que la pantalla hacía.**
   `globals.css` dice sobre `.riel-entrada`: «lo pasado y lo cerrado se ATENÚAN
   POR TOKEN, no por opacity: bajar la opacidad del texto ya atenuado (--text3,
   12.5px) lo tiraba bajo 4.5:1 — **lo midió axe en la primera captura del
   riel**». La fila de al lado, `.cita-fila`, hacía `opacity: isPast ? 0.6 : 1`.
   La lección se aprendió en un componente y no se aplicó al de al lado —
   **quinta vez en este carril**.

3. **`/reactivacion`: se usó el token de acento como relleno.** `--nexus` es
   color de texto e icono; el de relleno es `--nexus-solido`, y su comentario
   trae el contraste medido: «blanco encima = 5.16 : 1 ✓ AA». La respuesta
   correcta estaba escrita en el propio token.

4. **`/corte-caja` no estaba en el mapa de navegación.** `Sidebar.tsx` explica
   por qué: «la ruta sigue viva por si hay marcadores», con su contenido ya
   renderizado dentro de `/finanzas`. Una ruta que sólo se alcanza por marcador
   o por la paleta es justo donde más falta hace que el riel diga dónde estás:
   **quien llega ahí no viene de navegar**.

**CHANGE.** Los cuatro controles reciben nombre accesible que dice qué hacen;
`/dashboard` atenúa por token (`data-pasada` + regla CSS) en vez de por opacidad;
`/reactivacion` usa `--nexus-solido`; `/corte-caja` entra en el contexto de
`/finanzas`. Y `ui/Skeleton.tsx` —**componente compartido**— gana `role="status"`:
tenía `aria-label` sobre un `div` sin rol, que es atributo prohibido y deja la
pantalla muda justo mientras carga.

**Una prueba existente cayó, y tenía razón a medias.**
`v15-roles-tipograficos-en-hoy` exigía literalmente `opacity: isPast ? 0.6 : 1`.
Congelaba **el cómo, y el cómo estaba mal**: pedía exactamente lo que
`globals.css` prohíbe y lo que axe midió en 2.85 : 1. Se reescribe para congelar
la **intención** —lo pasado se distingue, por token, y la opacidad no vuelve— y
se prueba al revés **tres veces**: devolviendo la opacidad, y borrando cada una
de las dos reglas de CSS por separado. La primera versión de mi reescritura
pasaba con la regla borrada (el patrón era laxo y casaba con la regla hermana);
se apretó hasta que las tres inyecciones caen.

**PROOF.** 60 combinaciones medidas en navegador: **axe 0 en todas**, sin
desborde a lo ancho en ninguna, en 390 / 768 / 1440.

**EL INSTRUMENTO SE ARREGLÓ TAMBIÉN, Y ESO ES PARTE DE LA UNIDAD.** El trinquete
ahora aborta si la sonda **aterriza en otra ruta** (un redirect al login se medía
como si fuera la ruta pedida, y el login saca cero en todo) o si la página cargó
**sin hoja de estilo**.

Lo segundo no es hipotético: durante esta unidad un `next start` viejo siguió
dueño del puerto tras un `kill` que di por bueno, sirviendo el manifiesto de un
build cuyos ficheros yo acababa de borrar. El chunk del CSS devolvía **500** y
las páginas se pintaban desnudas. De ahí saqué, y **retiro**, dos conclusiones
falsas: que un bloque entero de CSS estaba muerto, y que el botón de cerrar del
aviso de push medía 18×21 saltándose su propia regla de 44×44. Las dos eran el
servidor. Comprobado después con la hoja en 200 y 571 reglas cargadas, `tienePush:
true`.

Ya me había pasado con este mismo puerto. La diferencia es que ahora **no depende
de que me acuerde**: lo comprueba el instrumento antes de escribir un número.

**COMPUERTAS.** `vitest` 10 794/10 795 · trinquete de lint 95 · trinquete de
diseño sin deuda · `tsc` limpio · `npm run build` compila · inventario de
pantallas regenerado. El único rojo sigue siendo `ops-timeout-y-punto-ciego`,
ambiental, verificado idéntico en el árbol sin mis cambios.

**RESIDUAL_RISK.**

- **Los techos de las 14 rutas nuevas NO están escritos todavía.** La medición
  de las 60 combinaciones se completó; el `--actualizar` que las fija se cortó
  por un reinicio del contenedor. Hasta que se escriban, esas rutas están
  **medidas pero no protegidas**. Es la siguiente unidad, no una nota al pie.
- El mapeo de `/corte-caja` está probado por su guardián de unidad, **no** en
  navegador: se hizo después de la corrida de 60. Sin volver a medir, es
  NOT_PROVEN.
- `/consultor` y `/antibiograma` siguen **sin contexto a propósito** (unidad 17):
  se alcanzan desde las Herramientas del expediente y decidir su contexto es una
  decisión de producto. Lo nuevo es que ahora está **medido**: `aria-current` 0
  en los tres anchos. Deja de ser una suposición.
- axe no ve el aspecto, ni el movimiento, ni el orden de tabulación. Cero
  violaciones **no es** «la pantalla está bien».
- Sigue sin usarse ningún lector de pantalla real.
- 20 rutas de 80. Las 60 restantes —hospital, UCI, rutas con parámetro— **no se
  declaran buenas**: se declaran sin medir.

---

## Unidad 47 — lo medido queda protegido (y el riel de `/corte-caja`, probado)

**POR QUÉ EXISTE.** Es el residual que la unidad 46 dejó escrito con todas sus
letras: las catorce rutas nuevas estaban **medidas pero no protegidas**, porque
la corrida que fija los techos se cortó por un reinicio del contenedor. Un
número medido que no queda en un trinquete se pierde en la siguiente semana.

**QUÉ SE HIZO.** Arnés reconstruido de cero —emuladores, siembra, `.next`
borrado, build, servidor— con la comprobación de hoja de estilo en 200 antes de
medir nada. 60 combinaciones, techos escritos, y **la misma corrida repetida
entera** contra los techos recién puestos.

**RESULTADO.**

- **axe: 0 en las 60.** 20 rutas × 390 / 768 / 1440.
- **Desborde a lo ancho: 0 en las 60.**
- **Errores de consola: 0 en las 60.**
- Dos corridas independientes dan lo mismo. No es un número con suerte: dado el
  ruido de estado que esta misma unidad encontró (un aviso que aparece a los 3 s,
  un esqueleto que sólo existe mientras carga), repetir era parte de la prueba.

**`/corte-caja`: PROVEN.** Era NOT_PROVEN al cerrar la unidad 46 —el mapeo se
hizo después de la corrida de 60 y sólo lo respaldaba su guardián—. Ahora está
medido en navegador: **`aria-current` 2 en los tres anchos**, donde antes era 0.

**`/consultor`: sigue en 0, y sigue siendo a propósito.** Es la excepción que
declaró la unidad 17: se alcanza desde las Herramientas del expediente y decidir
su contexto es una decisión de producto, no de este carril. La diferencia con
antes es que ya no es una suposición: está en el trinquete, con su cero escrito,
en los tres anchos. Si alguien decide su contexto, el número sube y el trinquete
lo nota.

**RESIDUAL_RISK.**

- El trinquete **no corre en CI**: necesita emuladores sembrados y un build de
  producción, y los emuladores no viven en el runner. Es compuerta local, como
  `verificar-invariantes-de-datos`. Que dependa de que alguien se acuerde está
  **declarado, no disimulado** — y ahora al menos el instrumento se niega a
  escribir un número si aterrizó en otra ruta o si la página cargó sin CSS.
- Sigue siendo 20 rutas de 80. Hospital, UCI y rutas con parámetro **no se
  declaran buenas**: se declaran sin medir.
- axe no ve el aspecto, ni el movimiento, ni el orden de tabulación. Cero
  violaciones no es «la pantalla está bien».

---

## Unidad 48 — el diálogo canónico existe, y anular un cobro no lo usaba

**CÓMO SE LLEGÓ AQUÍ.** El trinquete de interfaz declara en su propia cabecera
lo que **no** ve: «no ve el movimiento ni el orden de tabulación». Sesenta
combinaciones en cero de axe no dicen nada del teclado. Así que se barrió el
árbol buscando capas a pantalla completa y se miró cuáles traen lo que un
diálogo necesita.

**LO QUE SALIÓ.** `ui/Modal.tsx` está **bien hecho**: Escape, trampa de foco en
los dos sentidos, `role="dialog"`, `aria-modal`, y devuelve el foco a quien lo
abrió. Alguien hizo ese trabajo, y hay que decirlo.

Y varios diálogos no lo usan. El peor: **anular un cobro**, en `/finanzas`.
Escrito a mano con dos `div`, sin Escape, sin trampa de foco y sin anunciarse.
Es la confirmación de un acto **destructivo sobre dinero**.

Familia conocida: la lección vive en un componente y nada obliga a usarlo — la
misma de `Field.tsx` en la unidad 46, y van seis.

**MEDIDO EN NAVEGADOR, ANTES Y DESPUÉS.** Misma sonda, mismo build limpio, 25
pulsaciones de Tab con el diálogo abierto:

| | `role="dialog"` | Tabulaciones fuera | Elementos alcanzados | Escape |
|---|---|---|---|---|
| **Antes** | no existe | **25 de 25** | **15**, todos de la página de detrás | sin manejador |
| **Después** | sí, con `aria-modal` | **0 de 25** | 3, los del diálogo | cierra |

Quince elementos de la página de detrás. El médico que tabula desde el diálogo
de anular un cobro estaba paseando por la pantalla que hay debajo, creyendo que
seguía dentro.

**CHANGE.** El diálogo pasa por `<Modal>`. Se conserva lo que ya hacía bien —
mientras guarda no se cierra, ni por Escape ni por el fondo — y el motivo de la
anulación gana nombre accesible (el `placeholder` desaparece al escribir la
primera letra: no es un nombre).

**Y el cambio ADELGAZÓ el sistema, no lo engordó.** El trinquete de diseño lo
midió solo: `lienzosAMano` 43 → **42** y `radiosFueraDeEscala` 618 → **617**.
El ancho y el radio del diálogo dejaron de escribirse a mano. Los techos bajan,
que es la única dirección en la que se mueven.

**REGRESSION.** `un-dialogo-a-mano-no-atrapa-el-foco.test.ts`, 7 casos.
Probado al revés **tres veces**: creando una capa nueva sin teclado (falla
nombrando el archivo), quitando el `<Modal>`, y quitando la guarda de «guardando
no se cierra».

**LA PRUEBA LLEVA UNA LISTA, A PROPÓSITO.** Quedan cinco diálogos a mano y
esconderlos sería peor que declararlos. Cada uno con su razón:

- `AutoLogout` — **no debe cerrarse con Escape**: es el aviso de cierre de
  sesión y cerrarlo sin querer desactiva un control de seguridad. Migrarlo a
  `Modal` sería meterle Escape, así que **no se migra**. Le faltan la trampa de
  foco y el rol: real y abierto.
- `PanelLaboratorios` — le faltan las tres.
- `layout.tsx` — cajón de navegación móvil: tiene `role=dialog`, le faltan
  Escape y trampa.
- `OnboardingTour` — tiene Escape, le falta la trampa.
- `PaletteBusqueda` — tiene Escape y enfoca su campo; le faltan trampa y rol.

Un diálogo **nuevo** a mano hace fallar la prueba con el nombre del archivo.
Cerrar uno de los cinco obliga a quitarlo de la lista.

**DOS FALSOS POSITIVOS, VERIFICADOS LEYENDO.** `citas/page.tsx` y
`DoctorFilter.tsx` salen en el patrón pero son **capturadores de clic fuera**
para cerrar un menú, sin contenido dentro. Quedan declarados en la prueba con su
razón, para que el próximo barrido no los vuelva a levantar. Y `AppointmentModal`
—el diálogo más usado del producto— **ya usaba el canónico**: no todo hallazgo
tiene que producir un arreglo.

**Y una trampa en mi propio detector:** la primera versión pedía la trampa de
foco como `=== 'Tab'` y **falló contra `ui/Modal`**, que la escribe como
`!== 'Tab'` (sale pronto). Habría dado por malo justo el que está bien. El
patrón ahora acepta las dos formas.

**TRES GUARDIANES EXISTENTES CAYERON, Y LOS TRES TENÍAN QUE CAER.**

- `el-trinquete-de-interfaz-esta-cableado` fijaba `toBe(18)` combinaciones.
  Cazaba que alguien **quitara** una ruta, y de paso impedía **añadir** — que es
  lo contrario de lo que hace falta. Ahora la superficie medida es un trinquete
  más: **sólo crece** (`>= 60`), con las seis originales exigidas por nombre.
- El mismo guardián exigía `aria-current >= 2` en **todas**. `/consultor` está
  sin contexto a propósito (unidad 17). Ahora la excepción está **por nombre y
  congelada en su cero**: si sube, hay que sacarla de la lista en vez de dejar
  una excepción vencida.
- `v15-el-lienzo-no-se-escribe-a-mano` exigía un `maxWidth: 420` en `/finanzas`.
  Era el ancho del diálogo a mano. Sale de la lista porque el número **dejó de
  escribirse a mano**, que es exactamente lo que ese guardián persigue.

**COMPUERTAS.** `vitest` 10 801/10 802 · trinquete de lint 95 · trinquete de
diseño **bajado** en dos contadores · `tsc` limpio · `npm run build` compila ·
inventario regenerado. El único rojo sigue siendo `ops-timeout-y-punto-ciego`,
ambiental.

**RESIDUAL_RISK.**

- Cinco diálogos a mano siguen abiertos, listados arriba. **Declarados, no
  arreglados.**
- La prueba es escáner de fuente: no pulsa Escape ni tabula. La prueba de
  teclado de verdad se hizo **a mano en navegador** para este diálogo, y **no
  está automatizada** — otro diálogo que se migre necesita su propia medición.
- No se miran `src/app/mi/**` (portal del paciente) ni UCI/hospital.
- No se juzga el orden de tabulación **dentro** de un diálogo correcto, sólo que
  el foco no se escape.

---

## Unidad 49 — el teclado del diálogo, escrito una vez

**POR QUÉ EXISTE.** Residual de la unidad 48: cinco diálogos a mano sin el
teclado completo. La forma obvia de cerrarlos —copiar la trampa de foco cinco
veces— es exactamente lo que `CLAUDE.md` prohíbe y lo que este repositorio ya
pagó una vez: «cinco implementaciones del cálculo de huecos, cuatro de ellas
desactualizadas».

**CHANGE — primero factorizar, luego aplicar.**

`useDialogoDeTeclado` sale de `ui/Modal.tsx` **sin cambiar una línea de lógica**.
No es una implementación nueva: es la que ya estaba bien, puesta donde puedan
usarla los diálogos que **no pueden ser un `Modal`**. Y `Modal` pasa a usarla,
para que no queden dos copias — que era el riesgo entero de la maniobra.

Trae las cinco: Escape (opcional), trampa de foco en los dos sentidos, foco
inicial (opcional), scroll del cuerpo bloqueado y foco devuelto a quien abrió.

**LOS DOS QUE SE CIERRAN, Y POR QUÉ NO PODÍAN SER UN `Modal`.**

- **`AutoLogout`** — el aviso de cierre de sesión por inactividad. `Modal` cierra
  con Escape, y aquí eso **sería el defecto**: un Escape distraído desactiva un
  control de seguridad (LFPDPPP). Va con `cierraConEscape: false`.
  Lo que sí le faltaba y ahora tiene: trampa de foco, foco inicial, foco
  devuelto, `aria-modal` y `role="alertdialog"` —no `dialog`: interrumpe y pide
  una decisión con plazo—, más `aria-labelledby`/`describedby`.
  **El daño concreto**: sin trampa, quien sólo usa teclado podía tabular fuera
  del aviso y **no llegar a «Seguir conectado» antes de que se cerrara la
  sesión** — perdiendo el trabajo que el aviso existe para no perder.
- **`PaletteBusqueda`** — el centro de comandos. Gobierna su propio teclado
  (flechas, Enter) y enfoca su campo, así que va con `enfocaAlAbrir: false`.
  Tenía Escape y foco inicial —lo que se nota con ratón—; le faltaba lo que sólo
  se nota con teclado. **Era la única superficie del producto que existe para no
  tocar el ratón, y era la que dejaba escapar el foco.**

**PROOF — navegador, 25 pulsaciones de Tab con el diálogo abierto.**

| | se anuncia | Tab fuera | Escape |
|---|---|---|---|
| `Modal` canónico, **tras** sacarle el teclado al gancho | sí | **0 de 25** | cierra |
| Paleta de búsqueda, antes | no había rol | (sin trampa) | cerraba |
| Paleta de búsqueda, ahora | sí | **0 de 25** | cierra |

Lo primero era el riesgo de la unidad: refactorizar un componente compartido y
proven. Medido, no supuesto — **el canónico se comporta igual que antes del
refactor**, con la misma sonda y el mismo build limpio.

**REGRESSION.** El guardián de la unidad 48 crece a 11 casos y aprende a
distinguir tres familias: los que usan `Modal`, los que usan el gancho (por
nombre, con su razón) y los que siguen a mano. Probado al revés **cuatro veces**:
quitando el gancho de `AutoLogout`, quitándole la opción de Escape, devolviéndole
a `Modal` su teclado propio, y quitándole el rol a la paleta.

**Y una trampa que sólo salió al probar al revés:** el caso de
`cierraConEscape: false` pasaba **con la opción borrada del código**, porque el
párrafo que la explica la nombra. Un comentario satisfacía la prueba. Ahora se
mira el archivo **sin su prosa**. Es la segunda vez en dos unidades que probar al
revés caza un defecto en mi propio guardián, y las dos veces el defecto era del
tipo que no se ve leyendo.

**COMPUERTAS.** `vitest` 10 805/10 806 · trinquete de lint 95 · trinquete de
diseño sin deuda · `tsc` limpio · `npm run build` compila · inventario
regenerado. Único rojo: `ops-timeout-y-punto-ciego`, ambiental.

**RESIDUAL_RISK.**

- **`AutoLogout` NO está probado en navegador.** Necesita 30 minutos de
  inactividad y no hay forma de adelantarlo aquí: manipular el reloj congela el
  SDK de Firestore (probado, unidad 32). Su teclado está probado **en fuente y
  por el gancho compartido**, que sí está medido en dos diálogos. No es lo
  mismo, y por eso se dice.
- **Quedan tres a mano**, declarados en la prueba: `PanelLaboratorios` (le
  faltan las tres), el cajón de navegación de `layout.tsx` (tiene rol, le faltan
  Escape y trampa) y `OnboardingTour` (tiene Escape, le falta trampa). El
  trinquete de la lista baja de 5 a 3 y no puede subir.
- No se juzga el **orden** de tabulación dentro de un diálogo correcto, sólo que
  el foco no se escape.
- Sigue sin usarse ningún lector de pantalla real: `role` y `aria-*` se
  comprueban por su presencia, no por cómo suenan.

---

## Unidad 50 — medir la consulta, que era la que faltaba

**POR QUÉ.** El trinquete llegó a 20 rutas en la unidad 46, y ninguna era
`/consulta`. **La superficie donde el médico pasa la visita** —la razón de ser
del producto— estaba sin medir, y por una razón tonta: las rutas con parámetro
necesitan un id. El arnés ya siembra uno estable (`pac-001`), así que la excusa
no existía.

Se añaden `/consulta/pac-001` y `/expediente/pac-001`. **66 combinaciones.**

**RESULTADO.** axe **0** en las 66. Desborde 0. Errores de consola 0. La
consulta y el expediente entran limpios en los tres anchos.

**LO QUE SÍ SALIÓ, Y NO SE ARREGLA MARCANDO ALGO.**

`/consulta` da `aria-current` **1**, no 2: marca «Encuentro» en el riel de
escritorio y **no marca nada en el de móvil**. Y el riel de móvil **está
visible** — comprobado en el DOM, no supuesto: el primer diagnóstico («la barra
no está en esta pantalla») era falso y se cayó al mirar.

La causa es concreta: los cuatro destinos de abajo son `hoy`, `paciente`,
`seguimiento` y `operaciones`. **Ninguno es el encuentro.** Y aquí es donde este
carril se para:

- Marcar otro sería **mentir**: `aria-current="page"` señala el enlace a la
  página en la que estás, no al sitio del que vienes.
- Añadir un quinto destino chocaría con la regla de diseño de móvil —«4–5
  destinos primarios como máximo. Ni seis»— porque el hueco central ya lo ocupa
  la acción contextual.

O sea: **qué enseña el riel de móvil durante una consulta es una decisión de
producto**, no un defecto que se tape con un atributo. Lo que aporta esta unidad
es el **número medido y congelado en 1**: si baja a 0, el riel de escritorio
también se apagó, y eso sí sería un defecto. Es el mismo trato que `/consultor`
en la unidad 47: la excepción deja de ser una suposición y pasa a estar vigilada.

**Y UN TROPIEZO DEL ARNÉS, OTRA VEZ DEL MISMO TIPO.** La primera sonda falló al
no encontrar el campo de correo. No era la pantalla: la compuerta de `build` que
había corrido justo antes reconstruyó `.next` con la configuración **sintética
de producción**, así que la aplicación apuntaba a Firebase de verdad y el
formulario no llegaba a montarse. Tercera vez que el emparejamiento
build/servidor me engaña, y la primera en que **no** saqué una conclusión falsa
sobre el producto: el instrumento ya se sospecha antes que la pantalla.

(La comprobación de hoja de estilo de la unidad 46 no lo habría cazado —el CSS
estaba bien—; lo que lo cazó fue que el arnés no pudo entrar. Queda dicho para
quien añada comprobaciones: **entrar es parte de medir**.)

**COMPUERTAS.** `vitest` **10 806/10 806, entero en verde** —incluido
`ops-timeout-y-punto-ciego`, que depende de la red y esta vez sí pasó; no se ha
arreglado nada suyo y puede volver a fallar— · trinquete de lint 95 · trinquete
de diseño sin deuda · `tsc` limpio · `npm run build` compila.

**RESIDUAL_RISK.**

- Se mide `/consulta` **en reposo**: cargada, sin dictado, sin nota abierta, sin
  modales. El estado más importante de esa pantalla —**grabando**— no se mide
  aquí, y es donde vive el trabajo real. Declarado, no cubierto.
- Un solo paciente sintético. Un expediente cargado de años de notas puede dar
  otra cosa.
- 22 rutas de 80. Hospital y UCI siguen sin medir y **no se declaran buenas**.
- Los tres diálogos a mano de la unidad 49 (`PanelLaboratorios`, cajón de
  navegación, `OnboardingTour`) siguen abiertos, con su trinquete en 3.

---

## Unidad 51 — los tres que quedaban, y una corrección a lo que dije de ellos

**PRIMERO LA CORRECCIÓN, PORQUE CAMBIA LO QUE ESCRIBÍ.**

La unidad 48 declaró cinco diálogos a mano, y **dos de sus razones exageraban el
defecto**. Mi barrido buscaba Escape como `key === 'Escape'` y no conocía
`useCerrarConEscape`, **un gancho estrecho que ya existía** en
`lib/ui/activable` y que usan cuatro sitios. Por eso dije:

- de `PanelLaboratorios`: «le faltan las tres» — **falso**: cierra con Escape
  desde antes;
- del cajón de navegación: «le faltan Escape y trampa» — **falso** por la mitad,
  igual.

A los dos les faltaba **la trampa de foco**, y sólo eso. Corregido en la prueba,
que ahora conoce las dos formas.

Es la misma lección que la unidad 46 («`title` no es un canal de información»)
y la 48 (mi detector daba por malo a `ui/Modal`): **un barrido que no habla el
idioma de la casa inventa defectos**. Tres veces ya. Por eso ningún hallazgo de
un barrido entra en la bitácora sin que alguien lea el archivo — y por eso
ninguno de estos tres se «arregló» a ciegas.

**CHANGE — los tres pasan al gancho de diálogo, y el trinquete baja a 0.**

- **`PanelLaboratorios`** — la revisión de lo que leyó la IA. Sustituye el
  gancho estrecho por el completo (no se suman: dos manejadores de Escape sobre
  el mismo diálogo es una forma cara de que un día cierren cosas distintas) y
  gana `role="dialog"`, `aria-modal` y `aria-labelledby`. Importa más de lo que
  parece: es la pantalla donde se decide **de quién es una hoja de resultados**,
  con su casilla de «confirmo que son de este paciente».
- **Cajón de navegación (`layout.tsx`)** — igual, y además **`inert` mientras
  está cerrado**. El cajón vive montado (entra deslizándose), así que sus
  enlaces seguían en el orden de tabulación con el cajón invisible: tabular por
  la pantalla pasaba por media aplicación que no se ve. Ese medio defecto no lo
  había declarado nadie; salió al mirar el elemento.
- **`OnboardingTour`** — gana la trampa. Flecha derecha y Enter siguen siendo
  suyos (avanzan el tour); Escape pasa al gancho para no tener dos manejadores.
  Es lo primero que ve un médico nuevo.

**PROOF.** Tour, en navegador a 390px: **0 de 20 tabulaciones fuera** de la
tarjeta, y Escape cierra.

**RESIDUAL_RISK.** El **cajón no se pudo medir**: existe para la asistente y la
sesión del arnés es la del médico. Queda probado en fuente y por el gancho
compartido —que sí está medido en tres diálogos—, no en navegador. Igual que
`AutoLogout` en la unidad 49. Dicho, no disimulado.

**DOS GUARDIANES EXISTENTES CAYERON, Y LOS DOS TENÍAN QUE CAER.**

- `teclado-controles` pedía `useCerrarConEscape` **por su nombre** en los cuatro
  paneles. Vigilaba la conducta correcta —«se sale con Escape»— con una prueba
  que impedía **mejorar**: pasar al gancho de diálogo la hacía fallar. Ahora
  acepta los dos, porque los dos cierran con Escape, y sigue cayendo si un panel
  se queda sin ninguno (probado al revés con `DoctorFilter`).
- El trinquete de lint subió a 96 por un `useCallback` que puse para estabilizar
  `cerrar`. El compilador de React de este proyecto ya memoiza: envolverla da
  «Existing memoization could not be preserved». Se retiró — **se arregla el
  cambio, no se sube el techo**. Vuelve a 95.

**COMPUERTAS.** `vitest` 10 805/10 806 · trinquete de lint 95 · trinquete de
diseño sin deuda · `tsc` limpio · `npm run build` compila · inventario
regenerado. Único rojo: `ops-timeout-y-punto-ciego`, ambiental (pasó en la
corrida de la unidad 50 y volvió a fallar en ésta: depende de la red, y por eso
no se declara arreglado ni roto).

**ESTADO DE LA FAMILIA.** Diálogos a mano sin teclado completo: **5 → 3 → 0**.
La lista vacía **no** significa que no queden diálogos a mano: significa que los
que hay traen el teclado. Cinco usan `ui/Modal`; cinco usan el gancho, cada uno
con su razón escrita de por qué no puede ser un `Modal`. Un diálogo nuevo sin
teclado hace fallar la prueba con el nombre del archivo.

**LO QUE SIGUE SIN CUBRIRSE.** El **orden** de tabulación dentro de un diálogo
correcto. Ningún lector de pantalla real. Y `src/app/mi/**` —el portal del
paciente— sigue **sin barrer**: es otra superficie y otra regla
(`patient-facing-ai.md`), y no se declara buena.

---

## Unidad 52 — el portal del paciente, medido por primera vez

**POR QUÉ.** `src/app/mi/**` estaba declarado como **sin barrer** desde la
unidad 48. Es la superficie que ve el **paciente**, tiene su propia regla
(`patient-facing-ai.md`) y este carril nunca la había mirado — no por decisión,
sino porque no se podía entrar: el portal va por token HMAC, no por sesión.

Se acuñó uno con el mismo secreto y el mismo cálculo que `lib/patient-token.ts`.
**Y la primera versión del acuñado estaba mal**: puse el campo `exp` donde el
módulo escribe `e`. Habría firmado bien y caducado mal. Se cazó leyendo el otro
lado antes de usarlo, que es literalmente la regla «el dato tiene que LLEGAR».

**FOUND — y le toca al paciente, en su teléfono.**

A 390px, axe marcó el destino **«Perfil»** de la barra del portal como objetivo
táctil insuficiente. No por pequeño —la caja mide 78×59— sino por **tapado**:
`.theme-toggle` (fijo, `bottom: 16px; right: 16px`, z-index 199) le caía encima
y dejaba **22px útiles**.

Comprobado con `elementFromPoint` en los tres tercios del botón: en el centro
contestaba `BUTTON.theme-toggle`. **El paciente toca su perfil y lo que pasa es
que cambia el color de la pantalla.**

**LA CAUSA RAÍZ, otra vez la misma familia.** La regla RTC-32 de `globals.css`
retiró la convivencia entre botones flotantes razonando que sólo quedaba el
toggle «fuera del shell —**login, registro, marketing**—», donde flota sobre
formularios. La lista era correcta y **estaba incompleta**: el portal del
paciente también vive fuera del shell, y allí debajo no hay un formulario sino
su barra de destinos. Una regla retirada porque su causa desapareció en las
superficies que alguien enumeró, con una superficie que no estaba en la lista.

**CHANGE.** El toggle se aparta por encima de la barra —60px, el alto **medido**
de la barra a 390px, más el aire de la esquina y el área segura—, con el mismo
procedimiento que `.nx-push-optin` ya usa con el BottomNav. La barra recibe una
clase estable para que la regla tenga a qué agarrarse.

**PROOF.** Antes: axe 1 a 390px; el centro del botón contestaba el toggle.
Después: **axe 0 en los tres anchos**, el toggle en y=724 y la barra en y=785
(sin solape), y los tres tercios del botón contestan **el botón**.

**LO QUE SE MIDIÓ Y RESULTÓ ESTAR BIEN.** Dos errores 403 en la consola, en los
tres anchos. **No son un defecto**: el portal pide `documentos` y `paquetes` al
cargar y, con un token de alcance `agenda`, el servidor los rechaza —
correctamente — con un mensaje escrito para el paciente: «Pide a tu médico el
acceso a tus recetas». Comprobado con `curl` contra las tres acciones: `session`
200, las otras dos 403 **con su mensaje**. Es la autorización funcionando, y
además funcionando como pide la regla del paciente. Quedan **declarados y
congelados en 2** en el trinquete, no escondidos.

(Al re-medir salieron **429** en vez de 403: eso era mi propio arnés
machacando el endpoint y disparando su limitador. Mío, no del producto.)

**REGRESSION.** `el-boton-flotante-no-tapa-la-barra-del-paciente.test.ts`,
6 casos, con uno que existe **para que la prueba no sea una tautología**:
comprueba que la regla **hace falta** —que el `bottom` de base del toggle sigue
siendo menor que el alto de la barra—, de modo que si un día el toggle se mueve
de verdad, la prueba diga que la regla sobra en vez de quedarse pidiendo algo
inútil. Probado al revés tres veces: sin la regla, sin la clase de la barra, y
moviendo el toggle a `bottom: 96px`.

**Y EL PORTAL ENTRA EN EL TRINQUETE.** El script acuña su propio token; sin
`PORTAL_PACIENTE_SECRET` **no lo mide y lo dice** —medirlo con un token
inválido sería medir la pantalla de «enlace no válido» creyendo que es el
portal—. La clave se guarda como `/mi/[token]`, sin el token, que caduca y
cambia en cada corrida.

**69 combinaciones. axe 0 en todas. Desborde 0 en todas.**

**COMPUERTAS.** `vitest` **10 812/10 812, entero en verde** · trinquete de lint
95 · trinquete de diseño sin deuda · `tsc` limpio · `npm run build` compila ·
inventario regenerado.

**RESIDUAL_RISK.**

- El solape se comprobó **a mano** en el navegador (`elementFromPoint` antes y
  después). La prueba automática es escáner de fuente: **no abre el navegador**.
  Lo que sí queda automatizado es el axe del portal, en el trinquete.
- El trinquete del portal **depende de una variable de entorno**. Sin ella no
  falla: avisa y sigue. Es lo correcto —no se puede exigir un secreto en toda
  máquina— y también significa que **se puede dejar de medir sin que nadie se
  entere**. Declarado.
- Se midió **una** pantalla del portal, la de inicio con alcance `agenda`. Los
  otros cuatro destinos y un token de alcance mayor **no están medidos**.
- El portal se midió con **un** paciente sintético y una cita.

---

## Unidad 53 — los otros cuatro destinos del paciente, y una medición que no cambió nada

**POR QUÉ.** La unidad 52 dejó escrito su propio residual: «se midió **una**
pantalla del portal, la de inicio. Los otros cuatro destinos **no están
medidos**». El trinquete mide por URL y los cinco destinos del portal viven en
la misma: son pestañas de cliente. Decir que faltan no los mide.

**RESULTADO: los cinco limpios.** axe **0** en los cinco destinos —Hoy,
Preguntar, Cuidado, Documentos, Perfil— a 390 y 1440. Sin desborde. Y el
`aria-current` **sigue al destino pulsado** en los diez casos: la barra del
paciente sí contesta «dónde estoy».

**Esta unidad no cambia una línea de producto, y ésa es la conclusión.** Las
cuatro pantallas que faltaban por mirar estaban bien. Vale la pena escribirlo:
un carril que sólo apunta lo que rompe acaba pareciendo que el producto es sólo
defectos.

**LO QUE CASI SE ME CUELA.** La primera sonda leía 50 caracteres del cuerpo para
saber qué pantalla estaba midiendo — y esos 50 son la **cabecera, idéntica en
los cinco**. Cinco pantallas limpias, cinco huellas iguales, y yo a punto de
declarar cobertura de cinco destinos habiendo medido **uno cinco veces**. Se
arregló leyendo la huella del contenido, saltándose la cabecera: ahora se ve
«Próximas ci…», «Preguntar S…», «Tu plan de…», «Mis recetas», «Tu perfil I…»,
que son cinco de verdad.

**LA SONDA SE QUEDA, Y CON DIENTES.** Vive en
`scripts/carril-excelencia/destinos-del-portal.mjs`, declarada en `package.json`
como `arnes:portal-destinos` —un script que nadie puede invocar por su nombre es
un script que nadie invoca— y **sale con código 2** si no encuentra un destino o
si falta el secreto del token.

Eso último tiene una historia: **cuatro veces** en este carril un `npm run
build` de las compuertas reconstruyó `.next` con otra configuración mientras el
servidor del arnés seguía en pie, y la sonda midió una pantalla que no era. La
cuarta fue en esta misma unidad, y esta vez no llegó a producir una conclusión
falsa porque los cinco destinos salieron «no encontrado» de golpe. **No encontrar
nada no puede confundirse con no encontrar nada malo**, así que ahora falla en
vez de imprimir ceros.

**COMPUERTAS.** `vitest` 10 811/10 812 · trinquete de lint 95 · trinquete de
diseño sin deuda · `tsc` limpio · `npm run build` compila. El rojo es
`ops-timeout-y-punto-ciego`, ambiental (pasó en la unidad 50, falló en la 51,
pasó en la 52, falla aquí: depende de la red y no se declara ni arreglado ni
roto).

**RESIDUAL_RISK.**

- Los cuatro destintos nuevos están **medidos, no atrincherados**: el trinquete
  sigue cubriendo sólo la vista por defecto del portal. La sonda hay que
  invocarla; que dependa de que alguien se acuerde está **declarado**.
- Un solo alcance de token (`agenda`) y un solo paciente sintético. Con
  `documentos` y `paquetes` liberados aparecen pantallas que **nadie ha medido**.
- Los destinos se miden **recién pulsados**, en reposo. No se prueba escribir una
  pregunta, abrir un documento ni editar el perfil.

---

## Nota de CI — un commit rojo que me hice yo, y por qué

**QUÉ PASÓ.** CI marcó `verificar` en rojo sobre **`d98eb89`** (unidad 47). Las
dos pruebas que cayeron son exactamente las dos que arreglé en la unidad 48:

```
el-trinquete-de-interfaz-esta-cableado
  · cubre las seis pantallas …   expected 60 to be 18
  · la navegación resuelta …     /consultor@390: expected 0 to be >= 2
```

**LA CAUSA NO ES NINGUNA DE LAS DOS PRUEBAS.** Es que partí en dos commits algo
que era uno solo: la unidad 47 escribió los **techos nuevos** (60 combinaciones,
con `/consultor` en 0) y la unidad 48 actualizó el **guardián que los lee**. Entre
una y otra, el árbol quedó rojo un commit.

Localmente no lo vi porque cuando corrí la suite de la 47 el guardián todavía
no existía en su forma nueva… **y ahí está el error real**: corrí `vitest` en la
unidad 47 y pasó, pero lo que cambió en esa unidad fue un **fichero de datos**
que otra prueba lee. Un cambio de datos puede romper una prueba que no toqué.

**LA REGLA QUE SALE DE AQUÍ.** Un fichero de trinquete y el guardián que lo lee
**viajan en el mismo commit**. Si `--actualizar` cambia los números, la prueba
que los interpreta se actualiza y se prueba **antes de hacer commit**, no en la
unidad siguiente.

**ESTADO.** Arreglado en `b91bcca` (unidad 48), y las corridas posteriores
—`2987569`, `568c9bd`, `e34957b`, `3de1bc3`— no reportan fallos. Verificado
contra los registros de la corrida, no supuesto: se leyó el log del trabajo
99231429066.

No se comenta en el PR: el fallo ya no existe en la cabeza y el propio historial
lo explica. Queda aquí, que es donde este carril guarda sus causas raíz —
incluidas las mías.

---

## Unidad 54 — la consulta GRABANDO, que es donde ocurre el trabajo

**POR QUÉ.** El trinquete mide `/consulta` **en reposo**: cargada, sin dictado.
Y ése no es el estado en el que un médico usa esta pantalla. Medir sólo el
reposo y decir «la consulta sale limpia» es medir la sala de espera y hablar del
quirófano. Estaba declarado como residual desde la unidad 50.

**CÓMO SE ENTRA.** Micrófono falso de Chromium: un tono, sin hardware. No
transcribe —eso necesita proveedor y aquí no hay— pero **enciende el grabador de
verdad**.

**LO QUE SE ENCONTRÓ POR EL CAMINO, Y ES BUENO.** Grabar no arranca: **pide
consentimiento primero**. No es un obstáculo del arnés, es el control
medicolegal, y el código lo razona por escrito («se grababa la voz del paciente,
se enviaba a un tercero para transcribir, y ante una queja no había
absolutamente nada que exhibir»). El diálogo:

- `aria-modal="true"`, **axe 0**;
- **0 de 15 tabulaciones** se escapan — la trampa de foco del gancho de la
  unidad 49, funcionando en el diálogo que más importa de esta pantalla;
- dos salidas claras: «Cancelar» y «Confirmo el consentimiento e iniciar».

Y a la segunda corrida ya no aparece, porque el consentimiento **queda asentado**
y el producto no vuelve a preguntarlo. También eso es correcto, y está dicho en
el guion para que nadie lo lea como un fallo.

**EL ESTADO DE GRABACIÓN, MEDIDO.** Con el grabador en marcha: los botones
cambian a «Pausar la grabación», «Terminar la grabación» y «Detener y generar
nota», y el cronómetro **avanza** (0:05 → 0:10 en cuatro segundos).

**axe 0 · errores de consola 0.**

**PERO NO SE DECLARA LIMPIO DEL TODO, Y ÉSTA ES LA PARTE QUE IMPORTA.** En
**una** de las seis corridas, axe dio **1**. En las otras cinco, 0. No pude
reproducirla ni nombrarla: cuando añadí la captura del detalle, dejó de salir.

Así que lo que queda escrito es lo que sé: **el estado de grabación mide axe 0
en cinco de seis corridas, y una vez midió 1 sin que pudiera identificarlo.**
Redondearlo a cero sería exactamente lo que este carril lleva 54 unidades
evitando.

**Y LA SONDA ESTUVO A PUNTO DE MENTIRME DOS VECES.**

1. Su primera versión daba por «grabando» cualquier `[aria-live]` de la página.
   Declaró el estado de grabación con **axe 0** sobre la pantalla **en reposo** —
   el botón seguía diciendo «Grabar la consulta» y no había cronómetro. Por eso
   ahora exige **tres señales**, y que el cronómetro **haya avanzado**.
2. Su botón de aceptar buscaba «acepto / de acuerdo / continuar». El del producto
   dice **«Confirmo el consentimiento e iniciar»**. No casaba, no se pulsaba, y
   la sonda seguía midiendo el reposo creyendo que grababa.

Las dos las cazó preguntarle a la pantalla en vez de al selector.

**LA SONDA SE QUEDA.** `scripts/carril-excelencia/consulta-grabando.mjs`,
declarada como `arnes:consulta-grabando`, y **sale con código 2** si no encuentra
el botón de grabar.

**COMPUERTAS.** `vitest` 10 811/10 812 · trinquete de lint 95 · `tsc` limpio ·
`npm run build` compila. El rojo sigue siendo `ops-timeout-y-punto-ciego`,
ambiental.

**RESIDUAL_RISK.**

- **La violación que no supe reproducir.** Queda anotada, no cerrada.
- **No hay transcripción.** El micrófono es un tono y no hay proveedor de ASR:
  todo lo que la pantalla hace **con texto reconocido** —la corrección visible,
  la procedencia, la compuerta de ambigüedad— sigue **sin medir**, y es
  BLOCKED_EXTERNAL, no «bien».
- Se mide el arranque de la grabación, no `pausar`, `reanudar`, `terminar` ni
  «Detener y generar nota» —que llama al modelo—.
- Un solo ancho (390) y un solo paciente.
- El estado de grabación **no entra en el trinquete**: la sonda hay que
  invocarla. Declarado.

---

## Unidad 55 — el fallo del dictado se anuncia, y una acusación mía que era falsa

**LOS CONTROLES DE LA GRABACIÓN, MEDIDOS.** Continuación de la unidad 54, con la
sonda extendida a pausar, reanudar y terminar. Ninguno necesita proveedor: son
locales al `MediaRecorder`.

| | resultado |
|---|---|
| Pausar | cronómetro **0:10 → 0:10**: congelado, correcto · axe 0 |
| Reanudar | **0:13 → 0:17**: vuelve a correr, correcto · axe 0 |
| Terminar | los controles desaparecen · axe 0 |

**Y ANTES DE ESO, DOS VECES CASI ESCRIBO UNA MENTIRA.**

1. La sonda informó «PAUSAR: no se encontró el control» de dos botones que
   estaban ahí. Buscaba por **texto** y los controles son iconos con
   `aria-label` — que es lo correcto. Se cambió a buscar por **nombre
   accesible**.
2. Con eso arreglado informó «PAUSADO: el reloj SIGUIÓ CORRIENDO», que habría
   sido un defecto de verdad. No lo era: mi lector de reloj cogía la **primera**
   cadena con forma `m:ss` de toda la pantalla, y en esta hay varias. Leyendo el
   elemento concreto: congelado, correcto.

**LA ACUSACIÓN GRANDE, TAMBIÉN FALSA.** Al terminar sin proveedor de ASR
—`transcribir-diarizado` contesta 503— vigilé `[role="alert"]`, `[role="status"]`
y clases de *toast* durante doce segundos y no vi nada. Estuve a punto de
escribir que **al médico no se le dice nada tras perder la transcripción de una
consulta**. Sería el hallazgo más grave del carril, y era **mentira**: leyendo el
texto de la pantalla estaba

> «No se pudo transcribir (OPENAI_API_KEY no configurada…). El audio quedó
> **GUARDADO en este dispositivo** — reintenta con "Recuperar audio".»

más «Descargar audio» y «Descartar audio guardado». El producto lo hace bien:
avisa, dice dónde quedó el audio y ofrece tres salidas.

Cuarta vez esta sesión que un instrumento mío fabrica un defecto. Las cuatro se
cazaron igual: **preguntándole a la pantalla en vez de al selector.**

**EL HALLAZGO DE VERDAD ESTABA EN MI PROPIO ERROR.** El aviso no tenía **ninguno**
de los roles que yo buscaba. Se pinta en un `<div>` normal y aparece **de forma
asíncrona, después de detener la grabación**, en la única pantalla del producto
diseñada para que el médico **esté mirando al paciente y no la pantalla**. Sin
región viva, un lector no lo anuncia: se acaba de perder la transcripción de una
consulta y quien no mira no se entera.

WCAG 2.2 AA §4.1.3, y la regla 3 de seguridad clínica dicha en voz alta.

**CHANGE — dos roles distintos, a propósito.**

- `role="alert"` (asertivo) al **fallo**: se perdió la transcripción y hay
  acciones —recuperar, descargar— que caducan con la sesión.
- `role="status"` (educado) a **«sin separación de voces»**: la transcripción
  SÍ se hizo, con el motor alterno. Es una advertencia sobre qué revisar, no una
  pérdida, y no debe interrumpir.

Poner `alert` a los dos sería enseñar a ignorarlos, y eso lo vigila un caso.

**PROOF.** La misma sonda que antes sólo veía el nombre del paciente y la lista
de «no se puede firmar todavía», ahora recoge el aviso entero. Mismo arnés,
misma construcción limpia: lo único que cambió es el rol. axe sigue en **0** en
los cuatro estados (grabando, pausado, reanudado, tras terminar).

**REGRESSION.** `el-fallo-del-dictado-se-anuncia.test.ts`, 4 casos, probado al
revés quitando cada rol por separado.

**COMPUERTAS.** `vitest` 10 815/10 816 · trinquete de lint 95 · trinquete de
diseño sin deuda · `tsc` limpio · `npm run build` compila · inventario
regenerado. El rojo es `ops-timeout-y-punto-ciego`, ambiental.

**RESIDUAL_RISK.**

- **Ningún lector de pantalla real.** Que el rol esté puesto no prueba que se
  oiga. Es lo mismo que este carril lleva diciendo desde la unidad 46.
- `uci/page.tsx` tiene el **mismo aviso sin rol**. Es ALPHA y de otro carril:
  **anotado, no arreglado**.
- Se prueba el arranque, la pausa, la reanudación y el final. **«Detener y
  generar nota» no se pulsa**: llama al modelo, y eso está bloqueado por fuera.
- Sin transcripción real, nada de lo que la pantalla hace **con texto
  reconocido** está medido. Sigue BLOCKED_EXTERNAL.

---

## Unidad 56 — «menos movimiento» sí se respeta, y ahora hay quien lo vigile

**POR QUÉ.** §4 del encargo pide que el movimiento respete
`prefers-reduced-motion`, y este carril nunca lo había **medido**. `globals.css`
tiene el bloque global con `!important` y nueve reglas más: leerlo y darlo por
bueno es exactamente lo que aquí no se hace, porque **un `!important` de una hoja
no puede detener código** —ni la Web Animations API, ni `requestAnimationFrame`,
ni `startViewTransition`— y `lib/ui/movimiento.ts` lo dice de sí mismo.

**MEDIDO EN NAVEGADOR, CINCO PANTALLAS, DOS PASADAS.**

| | transiciones >50 ms | animaciones CSS | WAAPI corriendo |
|---|---|---|---|
| **con** la preferencia | **0** en las 5 | **0** en las 5 | **0** en las 5 |
| **sin** la preferencia | 22 – 128 | 1 – 3 | 0 |

La segunda fila no es de adorno: **es lo que hace que la primera signifique
algo**. Un producto sin movimiento daría los mismos ceros y no probaría nada.

**Y EL CAMINO DE JS TAMBIÉN PREGUNTA.** `puedeCoreografiar()` consulta
`matchMedia('(prefers-reduced-motion: reduce)')` y devuelve `false` antes de
llamar a `startViewTransition`. El módulo lo tiene razonado por escrito: «el
apagador de la hoja no llega al JS; cada comportamiento de movimiento decidido en
JS pregunta por su cuenta».

**Esta unidad no cambia una línea de producto.** §4 estaba bien resuelto. Lo que
faltaba era comprobarlo y dejar quien lo vigile.

**CHANGE — dos instrumentos, ninguno de producto.**

- `scripts/carril-excelencia/respeta-menos-movimiento.mjs`
  (`arnes:menos-movimiento`): la medición de arriba, repetible.
- `el-movimiento-decidido-en-js-pregunta-por-su-cuenta.test.ts`, 4 casos: lo que
  la medición **no puede vigilar sola**, porque hay que invocarla. El escáner
  corre en CI y exige que **todo** archivo que llame a `startViewTransition`
  consulte la preferencia.

**PROBADO AL REVÉS, TRES VECES.** Quitando la consulta de `puedeCoreografiar`;
**creando un archivo nuevo** que llama al API sin preguntar (cae nombrándolo); y
retirando el `!important` del apagador global.

**COMPUERTAS.** `vitest` 10 819/10 820 · trinquete de lint 95 · trinquete de
diseño sin deuda · `tsc` limpio · `npm run build` compila. El rojo es
`ops-timeout-y-punto-ciego`, ambiental.

**RESIDUAL_RISK.**

- **`requestAnimationFrame` no se vigila.** Los usos del árbol se clasificaron a
  mano: reposicionar la lente, vaciar la maquetación con doble rAF, y el medidor
  de nivel del audio —que es la señal de que la grabación está viva, no
  decoración—. Ninguno es una animación decorativa. **Clasificado, no vigilado**:
  si mañana alguien anima algo con rAF, este guardián no lo caza.
- Cinco pantallas de 80, y en reposo. Un movimiento que sólo aparece al abrir un
  panel no entra en la medición.
- No se prueba que un usuario con la preferencia puesta **vea** menos
  movimiento: se cuentan transiciones y animaciones, que es lo medible desde
  aquí.

---

## Unidad 57 — el hermano que dejé sin arreglar, y los dos de UCI

**LO PRIMERO, PORQUE ES MÍO.** La unidad 55 puso región viva a dos avisos del
dictado de la consulta y **dejó el tercero sin tocar**: `chunksFallidos`, «faltan
N tramo(s) en el texto en vivo». Es el que llega **mientras se está grabando** —
o sea, en el momento exacto en que el médico menos mira la pantalla, que es
justamente el argumento con el que arreglé los otros dos.

Es la familia que este carril lleva encontrando en el código de otros desde la
unidad 46 —«la lección se aprende en un componente y no en el de al lado»—
cometida por mí **una unidad antes**. No se descubre sola: salió al ir a mirar
UCI y contar cuántos avisos había en total.

**Y LOS DOS DE UCI.** `uci/page.tsx` tiene los mismos dos avisos —«sin separación
de voces en este pase» y «faltan N tramos»— y ninguno se anunciaba.

La unidad 55 los declaró «ALPHA, de otro carril: anotado, no arreglado». **Se
revisa esa decisión y se arregla**, por tres razones concretas:

1. El archivo está **libre**: `main` no lo ha tocado desde el punto de partida de
   esta rama, y su último cambio es del 9-ago. No hay carril con el que chocar.
2. ALPHA aquí significa «**se usa**, no se vende» — el dueño lo usa. El médico
   que dicta un pase de visita es real.
3. El arreglo es **un atributo**, con el criterio ya probado y su guardián ya
   escrito. Dejarlo sin hacer por una etiqueta, teniendo el arreglo en la mano,
   sería fabricar exactamente el defecto que este carril persigue.

**CHANGE.** Los tres avisos que faltaban reciben `role="status"`. Ninguno pasa a
`alert`: el texto en vivo va incompleto pero **la transcripción final usa la
grabación entera** —lo dice el propio aviso— y «sin separación de voces» significa
que sí hubo nota, con el motor alterno. Son advertencias sobre qué revisar, no
pérdidas.

**EL CRITERIO, AHORA EXPLÍCITO Y VIGILADO.** El guardián pasa a llevar la tabla
de los **cinco** avisos con su rol y su razón, y añade un caso que exige que
**sólo uno sea asertivo**: el que informa de una pérdida con acciones que caducan.
Si todo fuera `alert`, el médico aprendería a ignorarlos y el único que importaba
de verdad se perdería entre los demás.

**PROBADO AL REVÉS, TRES VECES.** Quitando el rol en UCI, quitándolo al tramo
perdido de la consulta, y convirtiendo el error en una advertencia más. Los tres
caen **nombrando el aviso concreto**.

**COMPUERTAS.** `vitest` 10 821/10 822 · trinquete de lint 95 · trinquete de
diseño sin deuda · `tsc` limpio · `npm run build` compila · inventario
regenerado. El rojo es `ops-timeout-y-punto-ciego`, ambiental.

**RESIDUAL_RISK.**

- Sigue sin usarse **ningún lector de pantalla real**. Que el rol esté puesto no
  prueba que se oiga, y esto ya se dice desde la unidad 46.
- Los avisos de UCI **no se han medido en navegador**: la pantalla necesita un
  paciente internado y el arnés no lo siembra. Arreglados por el mismo criterio
  y vigilados en fuente, **no vistos funcionando**. Es menos de lo que se probó
  en la consulta, y se dice.
- No se ha barrido el resto de UCI ni de hospitalización buscando más avisos
  asíncronos sin anunciar. Se arreglaron **los dos del dictado**, que son los
  hermanos directos de los de la consulta.

---

## Unidad 58 — la certificación decía cero, y ya no era cero

**CÓMO SALIÓ.** Buscando el «tablero maestro» que el encargo pide en su §30.
Existe algo parecido —`CERTIFICACION-FINAL.md`— y al abrirlo estaba **clavado en
`e531077`, con 14 commits por delante de `main`**. Hoy el carril va por 45.

Que los números envejezcan se ve venir. Lo que no se ve es lo otro: su §2
afirmaba **CROSS_LANE_CONFLICT = 0**, el encargo pide mantenerlo en `none`, y
**había dejado de ser cierto**.

**RE-MEDIDO, CONTRA LAS DOS RAMAS VIVAS DEL OTRO CARRIL.**

| Comparación | Preexistentes con `main` | Con esta rama | **Añadidos aquí** |
|---|---:|---:|---:|
| `product/ausculta-master-completion` | 8 | 9 | **1** |
| `claude/ausculta-master-completion-4clx9v` | 10 | 14 | **4** |

Con nombre y unidad: `cumplimiento/retencion/page.tsx` (unidad 45),
`asistente/page.tsx` (unidades tempranas), `lib/auth-client.ts` (unidad 37) y
`package.json` (los tres guiones de arnés de las unidades 53, 54 y 56 — éste es
**mecánico**, líneas añadidas al mismo bloque).

`uci/page.tsx`, que la unidad 57 tocó y que era el candidato obvio, **no añade
conflicto**. Comprobado, no supuesto.

**NO SE RESUELVEN, Y ES A PROPÓSITO.** Las dos ramas están en vuelo. Traer la
del otro carril a ésta para deshacer el conflicto sería meterse en su trabajo,
que es lo que el encargo prohíbe. Lo que toca es **declararlo con nombre y
unidad** para que quien fusione sepa qué le espera, en vez de encontrarse la
sorpresa detrás de un documento que decía cero.

**CHANGE.**

- La certificación gana una cabecera que dice **que caducó y qué afirmación suya
  dejó de ser cierta**, y un §0 con el estado re-medido. Lo viejo **no se borra**:
  se marca como «superado». Un acta es el retrato de un momento; falsearla
  hacia atrás sería peor que dejarla vencida.
- `scripts/carril-excelencia/conflictos-entre-carriles.mjs`
  (`arnes:conflictos-carriles`): el número deja de escribirse a mano. Compara
  contra **todas** las ramas del otro carril, porque quedarse con la más
  favorable sería elegir la respuesta, y hace **la resta** —lo que este carril
  añade— porque contar los conflictos totales culparía a este carril de los que
  ya existían.

**Y EL GUION MINTIÓ EN SU PRIMERA VERSIÓN, JUSTO EN ESTO.** `git merge-tree
--write-tree` **sale con código ≠ 0 cuando hay conflictos**. Con `execSync`
dentro de un `try/catch`, cada comparación lanzaba, el `catch` devolvía lista
vacía y el guion informaba **cero conflictos en todo**.

O sea: el instrumento escrito para cazar un cero falso escrito a mano produjo un
cero falso propio, y lo habría «confirmado». Se cazó porque los números de la
medición manual estaban al lado. Ahora usa `spawnSync`, donde el código ≠ 0 es
**información y no un fallo**, y sus números coinciden con los de la mano.

**ESTADO RE-MEDIDO.** `vitest` 10 821/10 822 · lint 95 · diseño sin deuda ·
`tsc` limpio · `build` compila · **trinquete de interfaz: 69 combinaciones, 23
rutas, axe 0, desborde 0** · **fusión contra `main`: limpia**.

**RESIDUAL_RISK.**

- **CROSS_LANE_CONFLICT ya no es 0.** Queda declarado, no resuelto, y quien
  fusione tiene la lista. Es una desviación del encargo y se dice con esas
  palabras.
- La comparación depende de qué rama del otro carril se mire: **1 contra una, 4
  contra la otra**. Se publican las dos.
- El guion **no corre en CI** —necesita las ramas remotas— así que el número
  vuelve a depender de que alguien lo invoque. Menos frágil que escribirlo a
  mano, no infalible.

---

## Unidad 59 — el orden del tabulador: lo que se puede afirmar y lo que no

**POR QUÉ.** WCAG 2.4.3, orden del foco. Este carril había probado que el foco
**no se escapa** de un diálogo (unidades 48–51); nunca que el **orden** tenga
sentido. Son criterios distintos.

**LO QUE SE PUEDE AFIRMAR.** No hay **un solo `tabindex` positivo** en el árbol.
Los diez que existen son `-1` (ocho cajas de diálogo que reciben el foco inicial)
y `0` (dos). Ninguno **reordena** nada.

Importa porque un `tabindex` positivo es el defecto clásico de 2.4.3: saca un
control de su sitio y lo mete antes que todo, de modo que el orden del teclado
deja de parecerse a lo que se ve. Es fácil de escribir, invisible con el ratón, y
sólo se nota cuando ya hay diez.

**LO QUE NO SE PUEDE AFIRMAR — y me costó tres intentos entenderlo.**

La sonda recorrió 40 tabulaciones en cuatro pantallas comparando posiciones. En
`/finanzas` informó un salto hacia atrás dentro de la tabla de cobros: «Anular
(y=844) → Anular (y=683)». Parecía un orden roto.

1. Primero **lo di por defecto del producto**.
2. Luego lo achaqué al desplazamiento de la ventana y pasé a coordenadas de
   documento. **Los números salieron idénticos**: `window.scrollY` era 0. Mi
   segunda explicación también era falsa.
3. La causa real: los botones viven en un `div` **con scroll propio**, que se
   desplaza al mover el foco. Ni la ventana ni `scrollY` saben de eso.

Leídos directamente, los doce botones están en **y = 1552 … 2193, estrictamente
crecientes**. El orden era correcto desde el principio.

O sea: **quinta vez en esta sesión que un instrumento mío fabrica un defecto**, y
la primera que hacen falta tres pasadas para desmontarlo — porque mi primera
corrección era tan falsa como la acusación.

**CONCLUSIÓN HONESTA.** El **orden completo** del foco queda **NOT_PROVEN**: el
recorrido con Tab no es fiable con contenedores que hacen scroll por dentro, y no
encontré forma barata de hacerlo fiable. Lo que sí queda vigilado es la causa que
**sí** se puede cazar leyendo.

**REGRESSION.** `el-orden-del-tabulador-no-se-fuerza.test.ts`, 2 casos. El
segundo existe para que el primero no se vuelva decorativo: comprueba que el
barrido **encuentra los `tabindex` que sí hay** —si un día el patrón deja de
casar, el caso de arriba pasaría para siempre, incluido el día que alguien
escriba `tabIndex={3}`—. Probado al revés: cae nombrando el archivo.

**COMPUERTAS.** `vitest` 10 823/10 824 · lint 95 · `tsc` limpio · `build`
compila. El rojo es `ops-timeout-y-punto-ciego`, ambiental.

**RESIDUAL_RISK.**

- **El orden del foco en sí no está probado.** Es la parte grande de 2.4.3 y se
  queda sin cubrir, con el método fallido descrito para que el siguiente no
  repita mis tres intentos.
- `tabindex` asignado desde JavaScript (`el.tabIndex = 3`) **no se busca**.
- Cuatro pantallas recorridas de 80, y sólo a 1440.

---

## Unidad 60 — los documentos que el médico imprime, medidos por fin

**EL HUECO.** Las rutas del **encuentro** —`/nota`, `/receta`, `/orden`— llevaban
fuera del trinquete desde el principio. No por decisión: **necesitan un
`notaId`** y la siembra estándar no crea notas.

Y son lo que el médico **produce**: lo que sale impreso con su cédula
profesional. La misión que abre `CLAUDE.md` es «que el médico salga de la
consulta con la nota hecha». Medir 23 rutas y ninguna de éstas era medir el
camino y no el destino.

**BUSCAR ANTES DE CREAR.** La nota sintética **ya existía**:
`scripts/design/capturar-nota-cromo-v15.mjs` siembra una firmada, con su
paciente sintético y su candado anti-producción. Se reutiliza tal cual —
reapuntada a la clínica y al paciente del arnés— en vez de inventar otra. Y **no
se mete en la siembra estándar**: un expediente con nota no es el mismo que uno
sin ella, y movería 69 combinaciones ya certificadas por algo que no es un
cambio de producto.

**FOUND — en el papel.** A 1440, `/receta` y `/orden` daban **axe 2** cada una:
`color-contrast` de **2.48 : 1** sobre papel blanco, en el **título del
documento** («Receta Médica» / «Orden Médica», 11 px) y en la **especialidad**
del médico (10.5 px). Las dos con el color de acento.

**POR QUÉ ES UN DEFECTO Y NO LA MARCA DE NADIE.** El acento **lo elige el
médico** (`colorAccento` en configuración) y este carril no toca la identidad de
nadie. Pero al mirar dónde se usa, es casi todo decorativo: los filetes, la barra
de 3 px del encabezado, el borde inferior, los rellenos, el ℞ de 24 px. Los
**únicos** dos sitios donde cargaba texto pequeño que hay que **leer** son
exactamente los dos que axe marcó.

Así que no se cambia el color del médico: **se deja de pedirle que haga de
tinta**. Su acento sigue en todo lo demás —incluida la barra pegada a la
especialidad— y esos dos textos pasan al gris neutro que el documento ya usaba
(`#111` el nombre, `#666` el folio de al lado).

**PROOF.** Antes: axe 2 en `/receta@1440` y 2 en `/orden@1440`. Después: **0 en
las seis combinaciones** (tres rutas × 390 y 1440).

**UN INTENTO QUE SE DESHIZO POR DISCIPLINA.** Al ver 23 literales de gris
repetidos, consolidé una paleta de tinta con nombre. Mejoraba el archivo… y era
**alcance que nadie pidió**, en un documento médico que se imprime, con riesgo de
regresión visual si una sustitución era mala. Se revirtió: queda sólo el arreglo
de contraste. (De paso: el trinquete cuenta **hex de 6 dígitos**, así que los
grises de 3 nunca contaron — el `+1` que vi venía de mis propios comentarios, que
citaban el color. Reescritos sin él.)

**REGRESSION.** `el-color-de-marca-no-carga-texto-pequeno.test.ts`, 4 casos: dos
exigen que el acento **siga** en lo decorativo —si alguien «arregla» el contraste
borrándolo de todas partes, el médico pierde su identidad en el papel, y eso es
el defecto del otro lado— y dos que no vuelva al texto pequeño.

**Y EL GUARDIÁN NO PODÍA FALLAR — dos veces seguidas.** El caso de la
especialidad ancló en la primera aparición de `{especialidad}`, que es la
**condición** y no el elemento: pasaba con el defecto puesto. Al corregirlo usé
`[^}]*` en una línea que lleva `}}>` en medio: entonces fallaba **siempre**, con
defecto y sin él. La tercera versión compara dos subcadenas y por fin discrimina.
Las dos lo cazó probar al revés, que es para lo que está.

**COMPUERTAS.** `vitest` 10 827/10 828 · lint 95 · diseño sin deuda nueva ·
`tsc` limpio · `build` compila. El rojo es `ops-timeout-y-punto-ciego`,
ambiental.

**RESIDUAL_RISK.**

- **No se juzga el acento que elija cada médico.** Uno claro sobre papel blanco
  seguirá dando mal contraste en lo decorativo, y **eso no se vigila**. Avisarle
  al elegirlo sería una función nueva, y este carril no las añade.
- Se midió **la pantalla**, no el PDF ni la impresión.
- El **℞ de 24 px** sigue con el acento. axe no lo marca; no se toca lo que no se
  ha medido roto.
- Las tres rutas quedan **medidas pero no atrincheradas**: dependen de una nota
  sembrada, así que viven en su propio guion (`arnes:documentos-encuentro`) y no
  en el trinquete de 69 combinaciones.
- `/nota` sin `notaId` pinta «Nota no encontrada» y se midió limpia: es un estado
  vacío legítimo, **no el documento**.

---

## Unidad 61 — comprobar que no rompí lo que ya había certificado

**POR QUÉ.** Las unidades 55–60 tocaron **componentes compartidos**: `ui/Modal`
pasó a usar el gancho de teclado, la pantalla de consulta ganó tres regiones
vivas, UCI otras dos, y el documento de receta cambió dos colores. Todo eso lo
ven pantallas que este carril ya había medido y congelado.

Certificar 69 combinaciones y luego cambiar el diálogo que usan todas, sin
volver a medir, sería exactamente el hueco que este carril persigue.

**RESULTADO: sin regresión.** Las **69 combinaciones** —23 rutas × 3 anchos,
incluidos el portal del paciente, la consulta y el expediente— siguen en **axe 0,
sin desborde**, contra los techos ya escritos.

**Y EL ARNÉS ME LO PUSO DIFÍCIL UNA VEZ MÁS.** Al ir a medir, el trinquete murió
con un `TimeoutError` seco de Playwright: la compuerta de `build` de la unidad 60
había reconstruido `.next` con la configuración **sintética de producción**, y la
aplicación apuntaba a Firebase de verdad. **Octava vez.**

Las unidades 53 y 55 pusieron una guarda que lo dice con palabras en los dos
guiones nuevos… y el trinquete, que es el más antiguo y el que más se usa, **no
la tenía**. La lección estaba aprendida en dos sitios y no en el de al lado — la
familia de siempre, otra vez mía. Ahora la tiene, con el número de veces que ha
pasado escrito dentro.

(La comprobación de hoja de estilo que añadió la unidad 46 **no** caza este caso:
el CSS carga perfecto —200 y 93 KB— y lo que falla es que el formulario no llega
a montarse. Dos síntomas distintos del mismo tropiezo, y hacían falta las dos
guardas.)

**COMPUERTAS.** `vitest` 10 827/10 828 · lint 95 · trinquete de interfaz **69/69
sin regresión**. El rojo es `ops-timeout-y-punto-ciego`, ambiental.

---

## Unidad 62 — el campo donde el médico escribe la nota no decía dónde estaba el cursor

**LO QUE PEDÍA EL ENCARGO.** «Encuentra lo que todavía se siente muerto,
estático o genérico», y entre los mínimos que reprueban la compuerta de diseño:
**foco invisible**. Así que en vez de seguir leyendo código, medí.

**LO QUE SALIÓ.** En `/consulta/pac-001` —la pantalla donde el médico ESCRIBE LA
NOTA— **15 de 15 campos estaban mudos**. Ni un píxel cambiaba al llegar el
cursor: `outline: 0px none`, misma sombra, mismo borde, mismo fondo. Con el
teclado no había forma de saber en qué caja se escribía. Y en `/guia`, dos más.

El `grep` posterior enseñó que las rutas visitadas eran la punta: **33
declaraciones en 21 archivos** — los paneles clínicos (cardiometabólico, gineco,
pediatría, cirugía, preventivo, preoperatorio, calculadoras, antibiograma), el
chat y el asistente, `setup`, `finanzas`, `configuración`, `guía`, fotos
clínicas, facturación, soporte y la paleta de búsqueda. Es decir, **casi todos
los campos escritos a mano del producto**.

**CAUSA RAÍZ — la familia de siempre: la lección aprendida en un componente y no
en el de al lado.** El sistema de diseño hace lo correcto: `.input` apaga el
`outline` del navegador —ruidoso en un formulario denso— y **pone otro anillo en
su lugar** (`:focus` con borde teñido y halo de 3px). Los campos escritos a mano
copiaron la línea que quita y no la que devuelve. Y no podían copiarla: un
`style={{ }}` en línea **no sabe expresar `:focus`**.

Peor: el estilo en línea le gana por especificidad al `:focus-visible` global que
viste al resto de la aplicación. Cada `outline: 'none'` no es que no añadiera
nada — **desactivaba la defensa que ya existía**.

**EL ARREGLO NO AÑADE NADA: QUITA.** Se borra el apagado en los 33 sitios y el
anillo global vuelve solo, idéntico al del resto del producto. Sin CSS nuevo, sin
color nuevo, sin degradado, sin sombra, sin radio. La única excepción es
`#cierre-de-la-consulta`, un `<div tabIndex={-1}>` que sólo recibe el foco por
programa: anillar una sección entera al aterrizar es ruido, y queda en la lista
de permitidos con nombre y razón.

**POR QUÉ AXE NO LO VIO.** No existe regla automática de foco visible. Catorce
pantallas ya auditadas con 0 violaciones llevaban esto dentro. El criterio 2.4.7
de WCAG 2.2 (AA) sólo se comprueba ejecutando.

**Y EL MISMO DEFECTO, OTRA VEZ, EN `/operaciones`.** La unidad anterior le había
puesto `.nx-op-fila:hover { background: var(--s2) }` a las 22 filas navegables
que no acusaban el puntero. Al ir a comprobarlo en el navegador: **la transición
se aplicaba (0.12s) y el color no cambiaba**. La fila llevaba
`background: 'transparent'` en línea, que le ganaba al `:hover` — el mismo
defecto de especificidad que acababa de encontrar en los campos, escrito por mí
tres horas antes. El fondo pasa a la clase, y de paso las tres filas que son
`<button>` (cerrar sesión, respaldo, tema) reciben el mismo idioma que las 18 que
son `<Link>`. Medido después: **21 de 22 controles responden al puntero**, y el
fondo va de `transparent` a `rgb(26,29,33)`.

**LO QUE VIGILA ESTO A PARTIR DE HOY.**

- `src/__tests__/el-campo-que-se-queda-sin-anillo-de-foco.test.ts` — la CAUSA,
  sin navegador, en CI. Probado al revés devolviendo el apagado a
  `consulta-ui.tsx`: cae nombrando archivo y línea.
- `npm run arnes:foco-visible` — el EFECTO sobre el producto vivo: enfoca cada
  campo de cada ruta y compara cinco propiedades antes y después. **45 campos en
  22 rutas, 0 mudos.**

**DOS VECES ME ENGAÑÓ MI PROPIA SONDA, Y LAS DOS QUEDAN ESCRITAS.**

1. Tras el arreglo, el barrido dijo **«0 de 0»** en las quince rutas. No era un
   aprobado: el servidor viejo seguía en el puerto sirviendo un manifiesto que ya
   no existía y las pantallas no montaban. Es la segunda vez que este carril cae
   en el mismo huérfano; ahora el guion aborta si una ruta no monta `<main>`.
2. La lista de rutas la escribí **de memoria**: `/inventario`, `/recetas`,
   `/laboratorio`, `/tareas` y `/mensajes` **no existen**. Daban 404 y el barrido
   los contaba como «0 de 0 · ok» — cinco aprobados sobre pantallas que no están
   ahí. Ahora usa las 22 rutas reales del trinquete, y distingue un 404 de un
   build viejo: decir el segundo por el primero manda a reconstruir el arnés por
   nada.

Y una tercera, del guardián: el patrón llevaba comilla simple **y** doble, y al
pasarlo por `grep` el intérprete lo partía («Unterminated quoted string»). El
barrido se hace desde Node, sin intérprete de por medio.

**COMPUERTAS.** `vitest` 10 831/10 832 · lint 95 · diseño sin deuda nueva ·
`tsc` limpio · `build` compila · trinquete de interfaz **69/69 sin regresión** ·
`arnes:foco-visible` 45/45. El rojo es `ops-timeout-y-punto-ciego`, ambiental:
necesita una IP que no conteste nunca y aquí el proxy contesta al momento.

**RESIDUAL_RISK.**

- **No se mide el contraste del anillo** contra el fondo del campo (1.4.11 /
  2.4.13). Es `--nexus` sobre la escala `--s1/--s2`; queda sin medir.
- **No se comprueba que el anillo no se recorte** por un `overflow: hidden` del
  contenedor. Eso sólo se ve mirando, y se miró en la consulta, no en las 22.
- El barrido sólo ve **campos visibles al aterrizar**: los que viven dentro de un
  diálogo o un panel sin abrir quedan fuera.
- El guardián de tabla **no mira las hojas de estilo**, donde apagar el `outline`
  es legítimo porque ahí sí se puede reponer en `:focus`.
- No vigila el apagado desde JavaScript (`el.style.outline = 'none'`).
- **`/operaciones` queda en 21 de 22.** El control restante no es una fila del
  grupo; no se toca lo que no se ha mirado.

---

## Unidad 63 — dieciséis botones en el centro de mando clínico, ninguno acusaba el puntero

**LO QUE PEDÍA EL ENCARGO.** «Consulta como clinical command center», «motion y
microinteracciones con propósito», «feedback perceptual», y cerrar cualquier
pantalla que siga sintiéndose estática. Con una prohibición explícita: nada de
degradados gratuitos, sombras por todas partes, más radio, animaciones
decorativas ni glassmorphism.

**LO QUE SALIÓ AL MEDIRLO.** En `/consulta/pac-001`, **16 de 16 botones no
respondían al puntero**. Ninguno. Ni «Grabar la consulta», que es la acción
primera del producto, ni «Firmar y cerrar nota», que es la última. Tampoco las
cinco herramientas clínicas, ni «Agregar diagnóstico», ni «Agregar medicamento»,
ni las tres acciones de apoyo del cierre. Un botón que no acusa el puntero se lee
como texto.

**CAUSA RAÍZ: LA MISMA DE LA UNIDAD ANTERIOR.** El fondo de cada botón vivía en
su `style={{ }}`, y **el estilo en línea le gana por especificidad a cualquier
`:hover` de la hoja**. Por eso no bastaba con escribir un `:hover`: había que
mudar el fondo. La lección ya estaba escrita en el propio repositorio, en el
comentario de `.btn` —«la apariencia vive en la HOJA, no en el JSX»— y esta
pantalla no la había adoptado.

**Y ME MORDIÓ UNA TERCERA VEZ, DENTRO DEL PROPIO ARREGLO.** Los controles de
texto suelto («Buscar», «limpiar», el tipo de nota) tienen 2px de relleno, así
que su acuse honesto es el color y no un fondo. Escribí `.nx-acc-texto:hover {
color: var(--text) }`… y siguieron mudos: el `color` **también** estaba en
línea. Tres veces el mismo defecto en una sesión — 33 campos sin anillo de foco,
las filas de `/operaciones`, y ahora esto.

**QUÉ SE AÑADIÓ, Y QUÉ NO.** Cuatro papeles en la hoja, con **los mismos pasos
que ya usan `.btn-*`**: una superficie hacia arriba al pasar, otra al pulsar.

| Papel | Para qué | Acuse |
|---|---|---|
| `.nx-acc-plana` | acción de apoyo sin caja | fondo → `--s2` |
| `.nx-acc-riesgo` | acción que destruye trabajo | fondo teñido de `--red` |
| `.nx-acc-caja` | acción con caja propia | `--s2` → `--s3` |
| `.nx-acc-fuerte` | la acción que manda | `--nexus-solido` → `--nexus-hover` |
| `.nx-acc-texto` | control de texto suelto | el texto sube de tono |

Sin un color nuevo, sin un degradado, sin una sombra, sin un radio nuevo. Los
tokens son los que ya existían. El trinquete de diseño no se movió.

Dos detalles que valen la pena: un `<button disabled>` **sigue sin responder**, a
propósito —decir «aquí puedes pulsar» cuando no se puede es peor que callarse—, y
la fila de herramienta abierta **se queda** con la superficie puesta, para que se
vea cuál está abierta sin leer la flecha.

**MEDIDO DESPUÉS: 16 de 16 acusan** (14 activos cambian de fondo o de color; 2
están apagados y callan, que es lo correcto). **0 controles mudos** en la
consulta.

**UN GUARDIÁN DE OTRO CARRIL ME PARÓ, Y TENÍA RAZÓN A MEDIAS.**
`v15-firmar-domina-al-cerrar` cayó por dos casos. Los dos comprobaban **la
letra** y no **el invariante**: uno exigía la cadena literal `background: 'none'`
dentro del objeto de estilo, y otro la etiqueta `<button>` entera palabra por
palabra. Lo que ese guardián protege —que Firmar domine y que Guardar/Descartar
no tengan caja, con su lógica clínica congelada— **sigue siendo cierto**: el
fondo transparente ahora lo pone la clase. Así que se actualizó para mirar el
invariante en los dos sitios donde puede romperse, no la cadena. No es de los
cuatro cruces con Master Completion: comprobado antes de tocarlo.

**Y AL REESCRIBIRLO, DOS VECES NO PODÍA FALLAR.** Primero comprobé los tres
trozos por separado: `disabled={guardando}` lo llevan también «Leer resumen» y
«Descartar», así que quitárselo a «Guardar borrador» **seguía pasando**. Luego los
metí en una expresión regular con `[^>]*` y falló **siempre**, con defecto y sin
él: el manejador es una función flecha y el `>` de `=>` corta cualquier clase
negada que excluya `>`. La tercera versión recorta la etiqueta contando llaves.
Las dos las cazó probar al revés.

**LO QUE VIGILA ESTO A PARTIR DE HOY.** `npm run arnes:acuse-puntero` —
trinquete de estaticidad. Pasa el puntero por cada control **habilitado** de cada
ruta y cuenta los que no cambian ni de fondo ni de color. **Sólo puede bajar**, y
avisa también cuando el producto está MEJOR que su techo, para que una mejora no
se pierda sin que nadie se entere. Techos en
`docs/audit/carril-excelencia/techos-de-estaticidad.json`.

Con eso, «se siente estático» deja de ser una opinión y pasa a ser un número por
pantalla. La primera medición, que es el punto de partida:

| Ruta | Mudos | Ruta | Mudos |
|---|---:|---|---:|
| `/consulta/pac-001` | **0** | `/guia` | 23 |
| `/lista-espera` | 0 | `/finanzas` | 19 |
| `/pendientes` | 0 | `/dashboard` | 16 |
| `/resenas` | 0 | `/expediente/pac-001` | 11 |
| `/membresias` | 0 | `/calendario` | 11 |
| `/farmacia` | 0 | `/consultor` | 4 |
| `/corte-caja` | 0 | `/pacientes` · `/reactivacion` · `/asistente` · `/cumplimiento/retencion` | 3 |
| `/citas` · `/operaciones` · `/configuracion` · `/cumplimiento` | 1 | `/crm` | 2 |

**COMPUERTAS.** `vitest` 10 831/10 832 · lint 95 · diseño sin deuda nueva ·
`tsc` limpio · `build` compila. El rojo es `ops-timeout-y-punto-ciego`,
ambiental.

> **CORRECCIÓN (unidad 64).** Aquí escribí «CROSS_LANE_CONFLICT sigue en 5, sin
> deuda nueva». **Era falso, y por un error de método mío**: corrí el guion de
> conflictos ANTES de confirmar esta unidad, y ese guion compara `HEAD` — así que
> midió el árbol de la unidad 62, sin los cambios que iba a evaluar. Medidos ya
> confirmados, esta unidad **añade un cruce**:
> `consulta/[patientId]/page.tsx` contra
> `origin/claude/ausculta-master-completion-4clx9v`. Está declarado con su
> naturaleza en la certificación. La lección para el guion: una compuerta que lee
> `HEAD` se corre DESPUÉS de confirmar, no antes.

**RESIDUAL_RISK.**

- **El trinquete mide que algo cambie, no que el cambio sea el correcto.** Un
  botón que se pusiera fucsia al pasar contaría como vivo. Para eso están el
  trinquete de diseño y mirar la pantalla, que es lo que se hizo aquí.
- **No mide el teléfono.** Sin puntero no hay `:hover`; en móvil el acuse es el
  `:active`, y eso queda **NOT_PROVEN**.
- No mide el pulsado en escritorio ni lo que vive dentro de un diálogo cerrado.
- **Quedan 102 controles mudos** en el resto del producto, con techo escrito y
  nombre propio. `/guia` (23), `/finanzas` (19) y `/dashboard` (16) son los
  siguientes.
- `S.chip` y `S.del` **no se tocaron**: no salieron en la medición de esta
  pantalla, y no se toca lo que no se ha medido roto.

---

## Unidad 64 — dos citas del día cuyo botón no se podía pulsar

**CÓMO SE LLEGÓ AQUÍ.** Bajando la estaticidad de `/guia` (23 controles mudos de
23). Al medir `/dashboard` de paso, un botón con la clase `.btn-secondary`
—que **sí** tiene `:hover` en la hoja— salió mudo. Eso no cuadraba, y no cuadraba
por una razón buena.

**LO QUE HABÍA DEBAJO.** `DIV.nx-push-optin`, el aviso de notificaciones:
`position: fixed`, `z-index: 44`, 360×146 en la esquina inferior derecha. Tapaba
**dos botones «Consulta»** —la acción primera de dos de las citas del día— y
`elementFromPoint` sobre su centro devolvía el aviso. Un clic ahí lo recibía el
aviso, no el botón.

Y no era una fila que pasa por debajo mientras uno se desplaza: **el scroll de
`<main>` se llevó hasta el final (189 de 189) y los dos seguían tapados.** Era el
final de la lista, sin sitio al que moverla. En la pantalla de inicio del médico.

RTC-32 había retirado de ese mismo sitio la regla que apartaba unos flotantes de
otros, porque su causa había muerto. Tenía razón en lo suyo: aquello era el aviso
contra otro widget. Esto es el aviso contra **el contenido**, que nadie había
mirado. Misma familia que el toggle de tema sobre la barra del paciente a 390px.

**EL ARREGLO.** Se reserva el hueco que ocupa el aviso al final del scroll, con
la medida tomada de verdad (162px a 1440/1024, 187 a 768, 221 a 390) y holgura.
Medido después: **0 tapados, y el clic en el último «Consulta» lo recibe el
botón.**

**Y LA MITAD MÓVIL DEL ARREGLO NO LLEGABA.** A 390px el relleno seguía siendo
72px: `main` ya lleva ahí un `padding-bottom … !important` para apartarse de la
barra inferior, y mi regla perdía contra él sin decir nada. Se vio midiendo el
valor calculado en el navegador, no leyendo el diff. «El dato tiene que LLEGAR»,
también cuando el dato es una regla de estilo.

**`/guia`: 23 mudos → 0.** Las filas que despliegan adoptan el idioma de fila que
ya usan `/operaciones` y el panel de herramientas —y la abierta se queda con la
superficie puesta—; las píldoras de rol y las sugerencias del asistente acusan el
puntero; el botón de enviar del chat toma el papel de acción fuerte. Las píldoras
de rol ganan además `aria-pressed`, que no tenían: un lector de pantalla no sabía
cuál filtro estaba puesto.

**EL GUARDIÁN NUEVO, Y LAS TRES VECES QUE MINTIÓ ANTES DE SERVIR.**
`npm run arnes:nada-tapa` recorre cada ruta a 1440 y 390, lleva el scroll a los
extremos y pregunta quién hay encima del centro de cada control.

1. **Acusó a cuatro barras SUPERIORES** (`.mobile-topbar`) de tapar controles
   mirando sólo abajo del todo. Falso: una barra de arriba se libera **subiendo**.
   La que atrapa es la de abajo, y sólo cuando ya no se puede bajar más. Ahora
   mira los dos extremos y acusa a la capa que corresponde a cada uno.
2. **Acusó a la barra inferior en `/finanzas`.** Tampoco: la lista de cobros es
   una caja de 480px con scroll propio, y `getBoundingClientRect()` devuelve
   dónde ESTARÍA una fila recortada aunque no se dibuje ahí. Ahora el rectángulo
   se corta contra el de cada antepasado que recorta.
3. **Y luego no cazaba el defecto que lo trajo.** Al quitar el arreglo para
   probarlo al revés, dijo «ok». El aviso vive a `bottom: 16px` y mi tolerancia
   para considerar una capa «anclada abajo» era de 12px: se quedaba fuera de las
   dos categorías y lo ignoraba. Ahora son 64px, que cubren los desplazamientos
   de este producto más el área segura del teléfono.

Las tres las cazó probar al revés o mirar lo que decía. Un guion que informa cero
sin poder informar otra cosa no es un aprobado.

**Estado hoy: 479 controles mirados en los dos extremos, a dos anchos, 0
tapados.**

**OTRO GUARDIÁN DE V15 PARÓ EL CAMBIO, Y OTRA VEZ POR LA LETRA.**
`v15-la-hoja-inferior-no-la-tapa-la-barra` exige que el pie de la hoja inferior
use **la misma constante** que `main`, para que las dos reservas se muevan
juntas. Su patrón buscaba `main\s*\{`, que casa con **cualquier selector
terminado en `main {`** — incluido el mío, condicional y para otra cosa. Empezó a
comparar contra 236 en vez de 72. Se ancló a la regla de `main` a secas; sigue
cazando la deriva de verdad (probado subiendo 72 a 90).

**Y AQUÍ SALIÓ QUE LA UNIDAD 63 SÍ AÑADIÓ DEUDA ENTRE CARRILES.** Al correr el
guion de conflictos —esta vez **después** de confirmar— aparecieron 6, no 5. El
nuevo es `consulta/[patientId]/page.tsx`, de la unidad 63. En aquella unidad lo
corrí ANTES de confirmar y el guion compara `HEAD`: midió el árbol anterior y me
dio un cero que no era. Queda corregido allí y declarado aquí.

Es **un trozo de una línea**: este carril le pone `className="nx-acc-caja"` al
botón «Agregar diagnóstico» y el otro le añade `tipoOrigen: 'medico'` al objeto
del `onClick`, en la misma línea. **Las dos caben a la vez.** Se intentó evitarlo
separando el `className` a otra línea y **salió peor** —reescribir la línea que el
otro también cambia deja las regiones solapadas igual, y el comentario que puse
para explicarlo cayó donde el otro carril inserta otro bloque: de un conflicto
pasaron a dos—. Se revirtió el intento. Queda declarado con su resolución escrita
en la certificación, que es lo que el encargo pide para los cruces.

**Y EL TRINQUETE LLEVABA MIDIENDO 66 COMBINACIONES, NO 69.** Al correrlo aquí
avisó: «portal del paciente: SIN MEDIR (falta `PORTAL_PACIENTE_SECRET`)». El
guion acuña el token del portal con el mismo secreto que el servidor, y en el
arnés de esta sesión ese secreto nunca se puso — así que `/mi/[token]` quedaba
fuera en sus tres anchos. El guion lo decía cada vez, en una línea, y yo miraba
el veredicto del final. Puesto el secreto en el arranque del servidor y del
guion: **69 de 69, portal incluido, sin regresión.** Un aviso que nadie lee es un
hueco de cobertura con buena conciencia.

**COMPUERTAS.** `vitest` 10 831/10 832 · lint 95 · diseño sin deuda nueva · `tsc`
limpio · `build` compila · trinquete de interfaz **69/69 sin regresión** ·
`arnes:foco-visible` 45/45 · `arnes:nada-tapa` 0 de 479 · estaticidad **102 → 77
mudos**. El rojo es `ops-timeout-y-punto-ciego`, ambiental.

**RESIDUAL_RISK.**

- **Sólo se mira el centro del control.** Uno tapado a medias, con el centro
  libre, no se cuenta: se puede pulsar, aunque se lea mal.
- **Sólo lo que flota** (`fixed`/`sticky`). Un solape del flujo normal por un
  margen negativo no entra.
- **Sólo la pantalla al aterrizar**: diálogos, menús y avisos que aparecen tras
  pulsar algo quedan sin mirar.
- Las reservas del aviso son **constantes medidas**, no calculadas. Si el texto
  del aviso creciera, el guion lo volvería a cazar — pero hasta que alguien lo
  corra.
- **Quedan 77 controles mudos**: `/finanzas` (19), `/dashboard` (14),
  `/calendario` (11), `/expediente/pac-001` (11) son los siguientes.
- **No se tocó `/finanzas`**: sus 19 mudos son de esta misma familia pero su
  arquitectura de scroll (una caja de 480px dentro de `main`) merece mirarse
  aparte, no de pasada.

---

## Unidad 65 — el trinquete de estaticidad mentía, y sólo se vio bajándolo

**LO QUE IBA A SER.** Seguir bajando controles mudos: `/finanzas` 19,
`/dashboard` 14, `/calendario` 11, `/expediente` 11.

**LO QUE PASÓ EN `/dashboard`.** Un botón con la clase `.btn-secondary` —que
**sí** tiene `:hover` en la hoja y que comprobé a mano que responde— salía mudo.
Tirando de ahí, el trinquete tenía **dos defectos de medición y luego un
tercero**:

1. **Leía sólo `backgroundColor` y `color`.** Los bloques de cita del calendario
   (`.nx-agenda-bloque`) se aclaran con `filter: brightness(1.35)` y levantan una
   sombra al pasar. Nada de eso es fondo ni color, así que los contaba muertos.
   **Ocho citas acusadas de no responder mientras respondían.**
2. **Miraba el elemento y no lo que se VE.** Cada cita del dashboard es un
   `<a class="cita-principal">` dentro de un `.cita-fila`, y quien se ilumina es
   **la fila**. El enlace no cambia un píxel propio, pero el médico ve encenderse
   el renglón entero. Ocho más.
3. **Y al arreglar lo anterior, informó 0 en las 22 rutas.** Un pleno. La lista
   de propiedades quedó como constante de Node y la función corre **en el
   navegador**: `ReferenceError` en cada medición, `catch` mudo, ningún control
   contado. **Un cero perfecto es la forma que tiene una medición rota de
   parecer un aprobado**, y es la tercera vez en esta sesión que un instrumento
   mío informa cero sin poder informar otra cosa.

Ahora lee siete propiedades, recorre la cadena de antepasados hasta `<main>`, y
**cuenta los fallos**: si se rompe más de una cuarta parte de las mediciones de
una ruta, aborta diciendo que no está midiendo.

**LA CUENTA HONESTA, ANTES Y DESPUÉS.** El techo de 102 que escribió la unidad 63
estaba inflado: **43 eran reales**. Bajados hasta **8**.

| | mudos |
|---|---:|
| Techo escrito en la unidad 63 (con falsos positivos) | 102 |
| Medida honesta, mismo árbol | 43 |
| Hoy | **8** |

**Y UNA CUARTA LECCIÓN, DEL LADO DEL PRODUCTO.** El trinquete contaba también el
control **que ya está puesto**: la pestaña abierta, el filtro activo, el destino
donde estás. Ésos llevan su superficie precisamente porque son el sitio actual, y
apuntarlos no cambia nada — correctamente. Contarlos me empujaba a añadirle un
`:hover` de adorno a la pestaña abierta para bajar un número, que es justo lo que
el encargo llama animación decorativa. Ahora se excluyen `aria-pressed="true"`,
`aria-current` y `.active`, con la razón escrita dentro.

**LO QUE SE ARREGLÓ DE VERDAD.**

| Pantalla | Antes | Hoy | Qué era |
|---|---:|---:|---|
| `/finanzas` | 19 | **0** | pestañas, el conmutador de periodo, doce «Anular» y las flechas de navegación |
| `/dashboard` | 4 | **0** | las filas de «pide atención» y «Ver todas», el único enlace de la portada sin acuse |
| `/expediente/pac-001` | 11 | **2** | «Atrás», «Nueva consulta», los chips, y los tres botones de exportación |
| `/consultor` | 4 | **0** | las cuatro preguntas de ejemplo |
| `/pacientes` · `/reactivacion` | 3 · 3 | **0** · **0** | sus píldoras de filtro |
| `/calendario` | 3 | **0** | el conmutador Día · Semana · Mes |
| `/crm` | 2 | **0** | las dos filas de aviso |
| `/citas` · `/operaciones` | 1 · 1 | **0** · **0** | el aviso de calendario descuadrado y el enlace que lo remata |

Y con ello, **`aria-pressed` en cinco grupos de filtro que no lo tenían**: un
lector de pantalla no sabía cuál estaba puesto.

**EL CONTRASTE MEDIDO NO SE TOCA, SE MUDA.** `/pacientes` y `/reactivacion`
rellenan su chip activo con `--nexus-solido` y blanco encima —«5.16:1 ✓ AA»—
porque `--teal` de fondo daba 2.99:1 y lo cazó axe a 390px. Esa decisión viaja
entera a `.nx-chip--relleno`; lo único que cambia es que ahora vive donde el
`:hover` puede alcanzarla. Su guardián (`v15-trial-banner-tokens-por-tema`) pedía
la cadena literal en el `style={{ }}`: se actualizó para comprobar el
**invariante** en los dos sitios —el JSX no vuelve a `--teal`/`#000`, y la hoja
rellena con el token medido— y sigue cayendo si alguien cambia el relleno
(probado poniéndole `--teal`).

**DONDE ME PARO, Y POR QUÉ.** Los **8 controles mudos que quedan** están todos en
archivos que ya figuran en CROSS_LANE_CONFLICT: `/asistente` (3) y
`/cumplimiento/retencion` (3), que este carril ya tenía declarados, y las dos
pestañas de `ClinicalSpine.tsx` (2), que ya chocaba entre `main` y la otra rama
antes de que yo llegara. Tocarlos bajaría un número a cambio de hacerle el merge
más difícil a otro. **Se dejan medidos, con nombre, y sin tocar.**

**COMPUERTAS.** `vitest` 10 831/10 832 · lint 95 · diseño sin deuda nueva · `tsc`
limpio · `build` compila. El rojo es `ops-timeout-y-punto-ciego`, ambiental.

**RESIDUAL_RISK.**

- **El trinquete sigue midiendo que algo cambie, no que el cambio sea el
  correcto.** Un botón que se pusiera fucsia contaría como vivo.
- **No mide el teléfono**: sin puntero no hay `:hover`. El acuse táctil es el
  `:active` y sigue **NOT_PROVEN**.
- Las píldoras de filtro de tres pantallas se unificaron sobre `.nx-chip`. Es
  coherencia de sistema, pero **la escala de superficie de `/reactivacion` cambió**
  (su base era transparente y ahora es `--s2`): se miró y se ve bien, no se midió
  contra un antes.
- El acuse por **cadena de antepasados** cuenta como bueno que se ilumine la fila
  entera. Es lo que ve el ojo, pero un control cuya única señal es la de su
  contenedor se distingue peor entre hermanos.

---

## Unidad 66 — una semana entera vacía que en realidad estaba cargando

**LA COLUMNA QUE NADIE HABÍA MIRADO.** El encargo pide cerrar cualquier pantalla
«sin loading/skeleton/progress terminado». Este carril había medido foco,
estaticidad y solapes; los estados de carga, no. Y no se habían mirado por una
razón concreta: **con la red del arnés duran milisegundos**. Así que se
ralentizó a propósito todo lo que pide datos (1,6 s) y se fotografió el instante
en que el armazón ya está y los datos vienen de camino.

**LO QUE SALIÓ, Y LO GRAVE VA PRIMERO.**

**`/calendario` dibujaba una semana entera COMPLETAMENTE VACÍA** —sus columnas,
sus horas, su línea del ahora— **sin una palabra de que las citas venían de
camino**. Indistinguible de «no tienes ninguna cita». El médico mira su semana de
un vistazo, la ve libre, y planifica sobre eso.

La causa, leída después de verlo: `loading` se calcula, se pasa a las tres vistas
—`WeekView`, `DayView`, `MonthView`—, **las tres lo declaran en su firma y en su
tipo, y ninguna lo usa en el cuerpo**. Escrito, pasado y sin conectar: la familia
de defectos que este repositorio tiene nombrada, en su versión más cara.

Y es, dicho en lenguaje de interfaz, la **regla 4 de seguridad clínica**:
ausencia de dato no es dato de ausencia. Una rejilla vacía que significa
«todavía no sé» y se lee «no hay nada» es el hueco tratado como dato.

**`/configuracion` y `/membresias` perdían la pantalla entera.** `<main>` se
sustituía por un renglón: **23 y 20 caracteres en toda la página**, sin título,
sin descripción, sin estructura. Se pulsaba «Configuración» y quedaba un lienzo
negro con una línea en la esquina. La cabecera es lo único que se sabe sin datos:
ahora se queda, y el contenido espera debajo.

**LO QUE NO ERA UN DEFECTO, Y POR QUÉ SE DICE.** Las otras 12 rutas medidas
pintan su armazón primero y rellenan después — que es lo correcto. `/operaciones`,
`/cumplimiento`, `/consultor`, `/guia` y `/consulta` salen «sin señal» porque a
ese instante **ya tienen su contenido** (de 500 a 2 300 caracteres): no hay hueco
que declarar. No se les tocó nada.

**EL AVISO DE LA AGENDA, Y POR QUÉ FLOTA.** Va absoluto sobre la rejilla y no en
el flujo: metido en el flujo empujaría la agenda hacia abajo al aparecer y la
subiría al irse, y un salto de posición en la pantalla que más se mira todo el
día se paga caro. Lleva `role="status"` y el lienzo lleva `aria-busy`, para quien
no lo ve.

**LO QUE VIGILA ESTO A PARTIR DE HOY.**

- `src/__tests__/el-prop-que-llega-y-nadie-usa.test.ts` — la CAUSA, en CI, sin
  navegador: la agenda pinta algo cuando `loading` es cierto, lo anuncia por
  `aria-busy` y `role="status"`, y las tres vistas siguen recibiendo el prop
  (si deja de llegar, el aviso se queda sin fuente). Probado al revés quitando
  el aviso: caen dos de los tres casos. El caso mira el código **sin
  comentarios**: un guardián que se satisface con su propia prosa no comprueba
  nada, y en esta rama ya pasó una vez.
- `npm run arnes:estado-de-carga` — el EFECTO, sobre el producto vivo y con la
  red lenta: **15 rutas, todas conservan su nombre y declaran su hueco**.
  Probado al revés quitando el arreglo de la agenda: la marca como «HUECO SIN
  DECLARAR».

**Y DE PASO, UNA PRUEBA QUE DEPENDÍA DE QUE NADIE SE ACORDARA.** Al exportar
`PORTAL_PACIENTE_SECRET` en la terminal —para que el trinquete de interfaz
pudiera medir el portal del paciente, que llevaba **66 combinaciones en vez de
69** por faltarle— `portal-alcance.test.ts` se puso rojo con «expected null not
to be null». No decía nada del producto: el archivo firma tokens a mano con el
secreto de desarrollo y eso sólo vale mientras **nadie** haya exportado el del
entorno, que `getSecret()` prefiere. Ahora la prueba lo fija ella con
`vi.stubEnv`, y pasa con la variable puesta y sin ella.

**COMPUERTAS.** `vitest` 10 834/10 835 · lint 95 · diseño sin deuda nueva · `tsc`
limpio · `build` compila. El rojo es `ops-timeout-y-punto-ciego`, ambiental.

**Y EL TRINQUETE DE DISEÑO ME PARÓ UNA VEZ.** El arreglo de `/membresias`
duplicaba el `maxWidth: 1000` de la página en la rama de carga y `lienzosAMano`
subió de 42 a 43. Se arregló el cambio, no el techo: el lienzo se escribe una
vez y las dos ramas lo comparten — que además impide que la pantalla mida
distinto según cuándo se mire.

**RESIDUAL_RISK.**

- **No se mide el estado VACÍO de verdad** —datos llegados y ninguno—, que es
  otro estado y pide sembrar un consultorio sin citas. **NOT_PROVEN.**
- **No se mide el estado de ERROR** —la petición falla—. **NOT_PROVEN**, y es la
  siguiente sonda natural.
- El aviso se comprueba que exista, no que sea bueno: no se mide cuánto tarda en
  aparecer ni si parpadea en cargas muy cortas.
- Sólo la primera pantalla de cada ruta: lo que carga dentro de un panel o un
  diálogo queda fuera.
- El retardo es sintético. Sigue sin haber una medida de lo que tarda de verdad.

---

## Unidad 67 — una caída de red convertía al médico en un usuario nuevo

**LA COLUMNA QUE QUEDABA.** La unidad anterior dejó el estado de ERROR escrito
como NOT_PROVEN. Se fue a por él: una sonda hace **fallar con 500 todo lo que
pide datos** —el emulador incluido— y mira dónde acaba el producto.

**LO QUE SALIÓ.** Las cuatro rutas probadas acababan en la misma pantalla:

> **Configura tu consultorio · ¡Bienvenido! Solo tu nombre y el del consultorio.**

Ante un problema de conexión, la aplicación le decía a un médico **con su
consultorio, sus pacientes y su historia** que no tenía consultorio, y lo
invitaba a crear uno.

**CAUSA RAÍZ.** `ClinicContext` escucha `clinic_members/{uid}` y hacía
`if (!snap.exists()) setNeedsSetup(true)`. Firestore entrega **primero lo que
tiene en cache y después lo que dice el servidor**: un documento ausente en un
snapshot `fromCache` no significa que no exista, significa que **todavía no se
sabe**. Las dos situaciones acababan en el mismo estado y el layout redirigía a
`/setup`.

Regla 4 de seguridad clínica en la puerta de entrada: **ausencia de dato no es
dato de ausencia**. El hueco tratado como dato, en el sitio donde más caro sale.

**Y LO QUE MÁS DUELE: LA PANTALLA CORRECTA YA EXISTÍA.** A dos líneas del
defecto, en el mismo layout:

> **No pudimos cargar tu consultorio** · Tus datos están a salvo en el servidor.
> Esto es un problema de conexión, no de tu información. · **Reintentar**

Escrita, bien escrita, con su botón — y no se llegaba a ella **nunca**, porque el
hueco se confundía con el dato antes de llegar. No hubo que diseñar nada: hubo
que dejar de concluir de más.

**EL ARREGLO.** Sólo se concluye que un usuario no tiene consultorio cuando el
servidor lo ha confirmado. La decisión sale del contexto a una función pura
—`seSabeQueNoTieneConsultorio({ existe, deCache })`— para poder probarla sin
montar Firebase ni renderizar nada, que es como prueba este repositorio.

**COMPROBADO EN LOS DOS SENTIDOS, SOBRE EL PRODUCTO VIVO.**

- Con la red de datos cortada: antes «Configura tu consultorio», ahora **«No
  pudimos cargar tu consultorio»** en las cinco rutas.
- Y un usuario **realmente nuevo** —creado a mano en el emulador de auth, sin
  membresía— **sigue llegando a `/setup`**. Era el riesgo del arreglo y por eso
  se probó de verdad en vez de razonarlo: su snapshot vacío acaba confirmado por
  el servidor y entonces sí.

**LO QUE VIGILA ESTO A PARTIR DE HOY.**

- `un-consultorio-que-no-se-pudo-leer-no-es-un-consultorio-que-no-existe.test.ts`
  — la tabla entera de las cuatro combinaciones, en CI. Sólo una da verdadero.
  Probado al revés devolviendo `!existe` a secas: caen dos casos.
- `npm run arnes:caida-de-datos` — el EFECTO: corta los datos y exige que el
  producto lo **diga** y que **no ofrezca dar de alta un consultorio**. Probado
  al revés reintroduciendo el defecto: marca las rutas con «OFRECE CREAR
  CONSULTORIO». Lleva además una guarda que aborta si la sesión de prueba ya
  estaba sin consultorio antes de cortar — si no, lo que se mide después no dice
  nada.

**COMPUERTAS.** `vitest` 10 838/10 839 · lint 95 · diseño sin deuda nueva ·
`tsc` limpio · `build` compila. El rojo es `ops-timeout-y-punto-ciego`,
ambiental.

**RESIDUAL_RISK.**

- **El segundo listener queda igual.** En `clinics/{id}`, un snapshot de cache
  vacío deja `clinic` en nulo y con él el nombre y los módulos del consultorio.
  Es el mismo defecto en su versión menos grave: **no se arregló**, y se dice
  aquí para que no se descubra dos veces. El `else` que lo pone a nulo existe por
  una razón buena (no enseñar el consultorio anterior al cambiar de uno a otro),
  así que arreglarlo pide distinguir tres casos y no dos — trabajo aparte.
- **Sólo se simula la caída TOTAL de datos.** Un fallo parcial —una colección que
  responde y otra no— no se prueba, y es el escenario más común de verdad.
- No se comprueba que **Reintentar** reintente.
- No se cubre la caída de **auth**: la sesión se establece antes de cortar.
- Los 8 s de la red de seguridad son largos si la conexión es mala pero viva. No
  se tocaron: cambiarlos es una decisión de producto, no de este carril.

---

## Unidad 68 — el consultorio recién abierto, y la única pantalla que le mentía

**LA ÚLTIMA COLUMNA MEDIBLE.** Quedaban cuatro NOT_PROVEN en la matriz: vacío,
jerarquía, contenido largo y comparación externa. Se fue a por el **vacío**,
que es el único de los cuatro que se puede medir sin opinar.

**CÓMO.** No sirve el consultorio sembrado: tiene ocho citas. Así que el guion
**crea un médico** en el emulador de auth, lo pasa por el alta, y recorre las
pantallas de un consultorio **sin una sola cita, ni paciente, ni cobro**. Es el
estado que ningún dato sembrado enseña y que todo médico ve el primer día.

**TRECE DE CATORCE ESTABAN BIEN, Y VARIAS MUY BIEN.**

> «Hoy no hay citas. La agenda está libre. **+ Agendar cita**»
>
> «Nada abierto — cuando firmes una consulta con estudios o receta, sus
> pendientes aparecen aquí con fecha y dueño.»

Eso es un estado vacío terminado: dice qué falta, por qué, y qué hacer. **No se
tocó ninguna**, y decirlo importa tanto como arreglar: este carril mide para
saber, no para justificar cambios.

**LA CATORCE ERA `/crm`, Y NO DECÍA QUE ESTABA VACÍA: DECÍA CEROS.**

> Tasa de confirmación **0%** · Tasa de no-show **0%** · Tasa de atención **0%**

Los cuatro indicadores se calculaban como `total > 0 ? (n/total)*100 : 0`. Ese
`: 0` es el defecto: sin citas, la tasa se **define** como cero. A un médico que
acaba de abrir su consultorio le lee como un boletín de notas pésimo sobre un
trabajo que todavía no ha hecho.

Es la misma regla que este repositorio ya tiene escrita para lo clínico, aplicada
a los indicadores del consultorio: **un cálculo al que le falta el dato dice que
no puede hacerse, no estima**. «No se puede calcular Kirby: falta PaO₂ y FiO₂».
Ahora `null` significa «no hay con qué» y se pinta con una raya.

**Y EL CERO LEGÍTIMO NO SE PERDIÓ**, que era el riesgo: con la cuenta sembrada
las tasas siguen saliendo **63 %, 0 % y 13 %** — cero ausencias de ocho citas es
información, y sigue diciéndose `0%`.

**LA SONDA SE EQUIVOCÓ DOS VECES ANTES DE ACERTAR.** Dio por calladas a
`/lista-espera` —que dice «La lista de espera está vacía»— y a `/pendientes`
—que dice «Nada abierto»—: su patrón no reconocía esas dos formas. Un guion que
acusa al producto de lo que no hace es peor que no tenerlo, así que la lista de
frases de vacío está escrita entera y a la vista en el guion.

**LO QUE VIGILA ESTO A PARTIR DE HOY.**

- `una-tasa-sin-denominador-no-es-cero.test.ts` — la aritmética y su escritura,
  en CI. Probado al revés devolviendo `0`: caen tres casos.
- `npm run arnes:consultorio-vacio` — el efecto, con un consultorio de verdad
  creado en la corrida. **13 pantallas, todas lo dicen.**

**LO QUE VI Y NO TOQUÉ, A PROPÓSITO.** La primera pantalla del médico nuevo trae
**tres interrupciones a la vez** —confirma tu correo, tu prueba termina en 14
días · Activar plan, y activa las notificaciones— antes de que haya hecho nada, y
debajo unos 600 px vacíos. El estado vacío en sí está bien resuelto; lo que
compite con él es comercial y administrativo.

**No lo cambio**: qué banners salen y cuándo depende de la decisión del dueño
sobre la prueba de 14 días (v972), y eso es política de producto, no acabado
visual. Queda dicho aquí, con la captura, para que lo decida quien puede.

**COMPUERTAS.** `vitest` 10 843/10 844 · lint 95 · diseño sin deuda nueva ·
`tsc` limpio · `build` compila. El rojo es `ops-timeout-y-punto-ciego`,
ambiental.

**RESIDUAL_RISK.**

- **Sólo se comprueba que la pantalla diga su vacío**, no que lo diga bien ni que
  ofrezca la acción siguiente. Que trece lo hagan bien es lectura mía, no medida.
- **Los demás cocientes del producto: mirados por encima, no auditados.**
  `/finanzas` tiene dos `total > 0 ? … : 0`. Uno está protegido por un «Sin
  datos» que se pinta antes, así que su rama de cero no se alcanza. El otro
  —`MetodoCard`, el reparto por forma de pago— **no se comprobó en su caso
  vacío**: es un porcentaje SOBRE el total, no una tasa de desempeño, así que el
  daño sería menor, pero está sin mirar y así queda dicho. `/corte-caja` y el
  panel de comisiones, sin mirar.
- `/calendario` queda fuera de esta sonda a propósito: una rejilla de semana
  vacía **es** la representación honesta de una semana sin citas.
- No se mide el vacío **parcial** —pacientes sí, cobros no—, que es el más común
  después del primer día.
- **Jerarquía, contenido largo y comparación externa siguen NOT_PROVEN.** La
  primera perdió su métrica por engañosa; las otras dos no se han intentado.

---

## Unidad 69 — 70 píxeles para 2 887 de nota

**LA COLUMNA «CONTENIDO LARGO».** Y lo primero, lo que **ya estaba bien**, que es
la mitad del trabajo de medir: el arnés siembra a propósito «el nombre compuesto
más largo que un registro civil mexicano admite de verdad», y el trinquete de
interfaz mide desborde con él dentro en 69 combinaciones. **Nada se sale de
lado**, ni siquiera metiendo una palabra impronunciable de 96 letras sin un solo
punto de corte. Eso queda dicho y no se toca.

**LO QUE FALTABA POR MIRAR ERA EL TEXTO LIBRE, Y AHÍ SÍ.** Escribiendo un
padecimiento actual de tamaño normal para una primera vez:

| | campo | contenido |
|---|---:|---:|
| escritorio | **70 px** | 602 px |
| 390 px | **73 px** | 2 887 px |

El médico relee lo que escribió —o lo que le dictó a la IA— por una ventana de
tres renglones. Y el momento en que más falta hace leerlo entero es **justo antes
de firmar**.

`resize: vertical` no salva esto: en un teléfono no hay tirador que arrastrar.

**EL ARREGLO.** El campo crece con lo que tiene dentro, hasta el 60 % del alto de
la ventana; pasado el tope hace su propio scroll. El tope no es decoración: sin
él, una nota larga empujaría los botones de firmar fuera de la pantalla y habría
que recorrer media nota para llegar a ellos.

Medido después: **478 px de 478 px** en escritorio (todo), y **540 de 2 272** a
390 (el tope). Comprobado también que **encoge**: 124 px con 780 caracteres → 70
px al dejar 23. Y que un campo vacío sigue en 70.

**EL DETALLE QUE HABÍA QUE ACERTAR.** El alto se recalcula **con el valor**, no
al teclear. Estas secciones **las rellena la IA** al estructurar la nota, sin que
nadie pulse una tecla — que es justamente el caso que trajo el defecto: una nota
dictada, larga, que aparece de golpe. Colgarlo de `onChange` habría dejado ese
caso intacto y habría parecido arreglado al probarlo a mano.

**LO QUE VIGILA ESTO A PARTIR DE HOY.**

- `el-campo-de-la-nota-ensena-lo-que-tiene-dentro.test.ts` — en CI: el campo
  existe, sabe encoger (`height = auto` primero), tiene tope, y **depende del
  valor**. Probado al revés cambiando la dependencia a `[]`: cae ese caso.
- `npm run arnes:texto-largo` — con navegador, a 1440 y 390: nada se sale de lado
  y el campo enseña lo que tiene. Probado al revés quitando el ajuste: marca
  RENDIJA en los dos anchos.

**Y UN GUARDIÁN DE ACCESIBILIDAD ME PARÓ, POR TERCERA VEZ EN ESTA SESIÓN, POR LA
LETRA.** `a11y-flujo-central-etiquetas` exige que cada sección narrativa tenga
nombre accesible —su título visible vive en el `<Section>` de al lado, sin
asociar— y lo comprobaba buscando el `<textarea aria-label={s.label}>` escrito a
mano. Ese textarea ya no existe: ahora es `CampoNarrativo`, que sigue poniendo el
`aria-label`. Se actualizó para comprobar el **invariante en los dos sitios** —la
página pasa la etiqueta, el componente la convierte en `aria-label`— y sigue
cayendo si el nombre desaparece (probado quitándolo).

Es la tercera vez: un guardián que ancla en la forma exacta del JSX caza
refactorizaciones inocentes y deja pasar el defecto que le importa el día que
alguien mueve una línea. Queda anotado como patrón, no como incidente.

**COMPUERTAS.** `vitest` 10 847/10 848 · lint 95 · diseño sin deuda nueva ·
`tsc` limpio · `build` compila. El rojo es `ops-timeout-y-punto-ciego`,
ambiental.

**RESIDUAL_RISK.**

- **Listas largas sin probar**: cientos de citas, de pacientes o de cobros. Es la
  otra mitad de «contenido largo» y sigue **NOT_PROVEN**.
- El tope del 60 % **es una decisión, no una medida**. En una pantalla muy baja
  puede quedarse corto; no se probó en alturas raras.
- **Sólo la consulta.** Otras superficies de texto libre —adendas, comentarios,
  el chat de corrección— no se miraron.
- El campo crece al escribir, así que **la página se mueve mientras se teclea**.
  Es el precio de verlo entero; no se midió si molesta en un dictado largo.
- Nombres largos en lo que se **imprime** (receta, orden, PDF) siguen sin medir:
  el arnés mide pantalla.

---

## Unidad 70 — doscientos cincuenta pacientes, y ningún número inventado

**LA OTRA MITAD DE «CONTENIDO LARGO».** La unidad anterior midió el texto libre;
faltaban las **listas**. El arnés de siempre siembra cinco pacientes y ocho
citas, y con eso no se puede saber qué pasa un martes cualquiera de una consulta
con años de rodaje.

Así que el guion **se hace su propio consultorio**: crea un médico, lo pasa por
el alta y le escribe **250 pacientes y 90 citas** con nombres compuestos a la
mexicana. No toca la cuenta sembrada, así que no mueve ningún techo de los otros
trinquetes.

**RESULTADO: las listas largas no rompen nada.**

| | filas pintadas | nodos en `<main>` | desborde |
|---|---|---:|---|
| `/pacientes` (Todos A-Z) | **250 de 250** | 3 798 | no |
| `/citas` | **90 de 90** | 2 188 | no |

Ninguna pantalla se sale de lado y **no falta ni una fila**. Eso último importa
más de lo que parece: una lista que enseña 50 de 250 sin decirlo es peor que una
lenta, porque el médico busca a alguien que sí está y no lo encuentra.

**Y AQUÍ NO SE PUBLICA UN NÚMERO DE TIEMPO, A PROPÓSITO.** Lo intenté dos veces
y las dos me salió un número que no medía lo que decía medir:

1. Cronometrando desde la navegación, el resultado incluía **mis propias esperas
   fijas** —siete segundos más tres y medio— e informaba «12 000 ms hasta
   pintar» de una lista que tardaba segundo y medio. Una falsa alarma con
   formato de dato.
2. Arrancando el reloj tras la última interacción, informaba **«14 ms»** — porque
   para entonces la lista **ya estaba pintada**. La misma mentira del revés.

Publicar cualquiera de los dos habría sido peor que no medir: uno haría perseguir
un problema que no existe, el otro daría por bueno lo que nadie comprobó. Se
quitó la métrica y **el rendimiento percibido de las listas largas queda
NOT_PROVEN**, dicho con todas las letras.

Es la tercera vez en esta sesión que la respuesta correcta ha sido **retirar una
medida** en vez de perseguirla: la de jerarquía, la de estaticidad —que hubo que
rehacer entera— y ahora ésta.

**PROBADO AL REVÉS.** Rompiendo el contador de filas, el guion informa «0 de 20»
y falla. Sin eso, un selector que dejara de casar habría informado «0 de 0» y
alguien lo habría leído como aprobado.

**COMPUERTAS.** `vitest` 10 847/10 848 · lint 95 · diseño sin deuda nueva ·
`tsc` limpio. **Esta unidad no toca una sola línea de producto** —sólo el guion
nuevo y su entrada en `package.json`—, así que no se vuelven a correr las ocho
compuertas de navegador: no hay nada que hayan podido dejar de cubrir. El rojo de
`vitest` es `ops-timeout-y-punto-ciego`, ambiental.

**RESIDUAL_RISK.**

- **250 no son 5 000.** A 3 798 nodos por 250 filas, un consultorio con una
  década encima metería decenas de miles en el árbol: **no hay virtualización**.
  No se extrapola —se midió 250— pero el número está aquí para quien decida si
  hace falta.
- **Sin medida de tiempo**, por lo dicho arriba.
- Sólo `/pacientes` y `/citas`. Cobros, pendientes y el expediente de un paciente
  con cien notas **no se miraron**.
- No se probó el desplazamiento con el dedo ni el consumo de memoria.
- El guion deja su médico y su consultorio en el emulador. Es un emulador.

---

## Unidad 71 — la mitad de los colores del producto no la miraba nadie

**LO QUE FALTABA MIRAR.** El trinquete de interfaz mide 69 combinaciones y las
mide **todas en el mismo tema**. Este producto tiene dos, y sus tokens no son los
mismos: `--nexus` vale `#2AA5B5` en oscuro y `#12626E` en claro, las superficies
se invierten y `--nexus-soft` cambia de alfa.

Es decir: **la mitad de las decisiones de color de este producto no las estaba
mirando este carril**. Y no era una preocupación teórica: el historial está lleno
de defectos que sólo salían en claro —«`--teal` de fondo daba 2.99:1 **en
claro**», «con `--nexus` daba 2.93:1 — axe, 390px»—.

**Y MI PRIMERA MEDICIÓN DIJO QUE TODO ESTABA BIEN. ERA MENTIRA.** Dos corridas,
1440 y 390, cero violaciones. El guion ponía el tema así:

```js
await ctx.addInitScript(() => { localStorage.setItem('nexusmed.theme', process.env.TEMA) })
```

`process` **no existe dentro del navegador**. La función lanzaba, el `try/catch`
se lo tragaba, el tema no se ponía nunca — y lo que medí, dos veces, fue el tema
oscuro llamándolo claro. **Cuarto instrumento de esta sesión que informa un cero
que no era.**

El guion definitivo pasa el tema **como argumento** a `addInitScript` y **aborta
si `data-theme` no quedó puesto**: medir el otro tema y llamarlo éste es
exactamente lo que acababa de pasar.

**LO QUE APARECIÓ AL MEDIRLO DE VERDAD.** Dos defectos reales, reproducibles en
los dos anchos:

| Dónde | Texto | Contraste |
|---|---|---:|
| `/cumplimiento` | «Todavía no ha llegado ningún reporte», «Tu cuenta NO tiene 2FA» | **4.46 : 1** |
| `/asistente` | «60 min», bajo la opción elegida | **4.33 : 1** |

Los dos son `--text3` del tema claro, `#6B6F75`, por debajo del **4.5 : 1** que
pide AA para texto normal. Sobre `--s3` bajaba a **4.20**.

**Y EL TEMA OSCURO YA HABÍA PAGADO ESTO.** Su `--text3` subió en su día de
`#6C7075` (≈3.8:1) a `#8A8F94` (≈5:1), con la nota escrita en la hoja. El claro
no recibió el mismo trato. La lección aprendida en un tema y no en el de al lado
— la familia de siempre.

Hay más: a diez líneas del token vive una regla que ya oscurecía **los
placeholders** en claro porque «#6B6F75 quedaba en el filo de AA». Se sabía. Se
arregló para los placeholders y se dejó para todo lo demás.

**EL ARREGLO.** `--text3` claro pasa a `#63666B`, que despeja **todas** las
superficies claras del producto —`--s` 5.76, `--bg` 5.51, `--s2` 5.20, `--s3`
4.79, y los dos tintes 4.94 y 5.09— con margen y sin cambiar el tono. Se cambia
en los **dos** sitios: el tema claro explícito y el `auto`, que sigue al sistema
operativo. Tocar sólo uno habría dejado el defecto para quien no elige tema, que
son la mayoría.

**Medido después: 44 combinaciones, axe 0, y 0 de 91 campos sin foco.** El anillo
de foco de la unidad 62 también funciona en claro, que no se sabía.

**COMPUERTAS.** `vitest` 10 847/10 848 · lint 95 · diseño sin deuda nueva · `tsc`
limpio · `build` compila · las nueve compuertas de navegador. El rojo es
`ops-timeout-y-punto-ciego`, ambiental.

**RESIDUAL_RISK.**

- **El tema `auto` sí se mide** (`TEMA=auto`), y sale igual de limpio: 44
  combinaciones, axe 0, foco 0 de 91. Pero **no se corre en cada pasada**: el
  gasto se triplicaría. Conviene correrlo al tocar tokens de color.

  Y ahí la sonda me corrigió otra vez: la primera versión **borraba** la
  preferencia creyendo que «sin preferencia» era «automático». No lo es — sin
  nada guardado el producto pinta OSCURO a propósito, por identidad de marca, y
  `auto` sólo se alcanza eligiéndolo. La comprobación de tema abortó diciendo
  «se pidió auto y `data-theme` dice dark». Para eso estaba.
- **Sólo se repiten en claro axe y el foco.** Estaticidad, solapes y estados de
  carga son de estructura, no de color, y correrlos dos veces gastaría el doble
  sin cambiar el resultado — pero si un cambio de tema mueve una caja, esto no lo
  vería.
- El cambio de `--text3` **afecta a todo el tema claro**. Se comprobó que no
  rompe axe en 44 combinaciones; **no se comparó capturas** antes y después, así
  que un cambio de aspecto sutil no se habría visto.
- axe mira el contraste **calculado**, no el percibido sobre degradados,
  imágenes o texto encima de un `filter`.

---

## Unidad 72 — el guion de conflictos llevaba días diciendo «LIMPIA» sobre un `main` de otro día

**CÓMO SALIÓ.** Leyendo los avisos de GitHub del PR #399. Veintinueve, todos
ruido de despliegues de Vercel y `check_suite.completed` en verde… y al
comprobar el estado real del PR contra la fuente primaria, en vez de fiarme de
los avisos: **`mergeable_state: "dirty"`**.

Mi propio `arnes:conflictos-carriles` había dicho **«Fusión contra main: LIMPIA»**
seis veces seguidas esa misma tarde.

**POR QUÉ MENTÍA.** Compara contra la copia **local** de `origin/main`. Nadie
había hecho `fetch` en toda la sesión, así que comparaba contra el `main` del día
anterior. Mientras tanto `main` pasó de `bcf6063` a `85656f96`: entró el **#406**,
con el trabajo de Master Completion.

Un guion que existe para medir conflictos y no ve los que hay es peor que no
tenerlo. **Quinto instrumento de esta sesión que informa un cero que no era**, y
el más caro: los otros cuatro se equivocaban sobre píxeles; éste, sobre si el
trabajo de dos semanas se puede integrar.

Ahora **le pregunta al remoto por el SHA de `main`** y **se para** si la copia
local no coincide.

**Y AL PARARSE, EL NÚMERO SALTÓ A 24 — QUE TAMPOCO ERA VERDAD.** La cuenta
«conflictos míos con el otro carril MENOS los que ya tenía `main`» sólo significa
algo mientras el otro carril esté **fuera** de `main`. En cuanto se fusiona,
`main` lo contiene, su baseline cae a cero, y **todos** mis conflictos pasan a
contarse como míos. Ninguno lo añadí yo: lo que pasa es que esta rama todavía no
se ha puesto encima del `main` nuevo. El guion lo detecta y lo dice, en vez de
soltar el 24.

**LO QUE HAY DE VERDAD: 7 archivos, 12 trozos.**

| Archivo | Trozos | Naturaleza |
|---|---:|---|
| `SCREEN_INVENTORY.md` · `techos-de-diseno.json` | 4 | **Generados** — un comando |
| `package.json` | 1 | **Mecánico** — líneas adyacentes en `scripts` |
| `lib/auth-client.ts` | 2 | **Se quedan las dos** — `main` la correlación de pestaña, ésta el techo al token |
| `consulta/[patientId]/page.tsx` | 2 | **Se quedan las dos** — `tipoOrigen: 'medico'` y `className="nx-acc-caja"` caben en la misma línea |
| `asistente/page.tsx` | 1 | **Pide criterio** |
| `cumplimiento/retencion/page.tsx` | 2 | **Pide criterio** |

Los dos últimos son **el mismo camino endurecido por los dos carriles contra
peligros distintos**: en `asistente`, `main` cambia a sondeos indexados con
`sePudoPreguntar` y esta rama le puso techo de tiempo a `getPatients` porque sin
red el SDK no rechaza; en `retencion`, `main` añade `truncada` (se llegó al techo
de paginación) y esta rama `falloCarga` (la lectura falló) — **dos huecos
distintos, y los dos hacen falta**, que una lista de la NOM-004 que se queda
corta en silencio y una que falla en silencio se leen igual de mal.

**NO LO RESUELVO, Y ES LA DECISIÓN.** El encargo dice «no los invadas, déjalos
documentados para integración posterior» y «NO hagas merge». Resolver esos cuatro
archivos **es** esa integración, y decidir por el otro carril qué versión de su
propio endurecimiento sobrevive es exactamente lo que se me pidió no hacer.
Queda medido, con nombre y con la resolución propuesta, en un comentario del PR
—que además **corrige el cuerpo del PR**, que sigue diciendo
«CROSS_LANE_CONFLICT = none» y hoy es falso—.

**COMPUERTAS.** Esta unidad **no toca una línea de producto**: sólo el guion de
conflictos. `tsc` y los trinquetes quedan como estaban.

**RESIDUAL_RISK.**

- **La rama sigue sin fusionar limpio contra `main`.** Es el estado real y no se
  arregla solo; lo hará quien integre.
- El guion pregunta al remoto por `main`, **pero no por las ramas del otro
  carril**: si una de ellas avanza sin fusionarse, su copia local puede seguir
  atrasada y nadie avisa.
- **Ninguno de los otros nueve guiones de este carril compara contra `main`**, así
  que ninguno habría cazado esto. Lo cazó mirar el PR en GitHub.

---

## Unidad 73 — la semana entera vacía, sin decir que no cargó

**DE DÓNDE SALE.** De la columna **error** de la matriz, que estaba medida en 5
rutas de 23. Al completarla salieron dos cosas, y la segunda es la que importa.

**LO PRIMERO: las 18 rutas que faltaban están bien.** Con el acceso a datos
cortado entero, las 23 dicen «No pudimos cargar tu consultorio · Tus datos están
a salvo en el servidor» y ninguna ofrece dar de alta un consultorio a quien ya lo
tiene. La columna **error pasa de 5 rutas a 23**, y se cierra sin tocar código:
lo resuelve la guarda de `ClinicContext` de la unidad 65, que resultó ser global.

**LO SEGUNDO: eso mide UN escenario, y el de al lado no lo miraba nadie.** El
propio guion lo declaraba fuera de alcance: «sólo la caída TOTAL de datos; un
fallo parcial —una colección que responde y otra no— es otro escenario». En el
parcial **el consultorio SÍ cargó**, así que no salta ninguna pantalla global y
cada pantalla se queda a solas con una lista vacía. Y una agenda vacía tiene dos
causas que se ven idénticas:

- ese día no hay pacientes;
- ese día **no se pudo preguntar**.

Sólo una de las dos significa que el médico tiene la tarde libre.

**MEDIDO, ANTES DEL ARREGLO.** `/calendario` pintaba la rejilla entera —«Lun 24 ·
Mar 25 · Mié 26…»— vacía y **sin un solo aviso**. Ni siquiera saltaba la frontera
de error genérica. El aviso «Cargando la agenda…» que puso la unidad 66 existe,
pero cuelga de `loading`, y al fallar la consulta `loading` baja igual: **mi
propio arreglo se quedó a un caso de distancia del de al lado**, que es la
familia «la lección se aprende en un componente y no en el de al lado» cometida
dentro del mismo bloque.

De las **nueve** llamadas a `useAppointments`, sólo **dos** recogían `error`.

**Y EL MODAL DE AGENDAR, que es donde duele.** Ahí `appointments` alimenta las
dos funciones de seguridad: `getAvailableSlots` y `hasConflict`. Medido en frío
sobre los motores, con el mismo día y la misma configuración:

| | huecos ofrecidos | conflicto a las 10:00 |
|---|---:|---|
| con la cita cargada | 9 | **`true`** |
| con la lista vacía | **10** | **`false`** |

Es decir: con la consulta caída, el modal ofrece como libre la hora ya tomada y
dice que no hay empalme. **La cita no llega a escribirse encima** —
`/api/appointments` re-chequea en transacción y devuelve 409, que es el borde
real y está bien puesto—, así que **el daño es de información, no de datos**;
pero para cuando salta el 409 ya se le dijo la hora al paciente por teléfono.

Lo notable es que **esta pantalla ya razonaba así, diez líneas más abajo**, para
Google Calendar: «"No pude consultar" y "no tiene nada" producen la misma lista
vacía de ocupación, y sólo uno de los dos significa que esas horas están libres».
La lección estaba aprendida para el calendario **secundario** y no para la agenda
**propia**.

**EL ARREGLO.** `/calendario` y el modal recogen `error` y lo dicen. En el
calendario, un aviso en el mismo sitio que el de carga: «No se pudo cargar tu
agenda. Esto NO quiere decir que no tengas citas.» En el modal, el gemelo del
aviso de Google, con la forma **declarada una sola vez** — los dos dicen lo mismo
y ahora comparten estilo, que además devolvió `tamanosFueraDeEscala` a su techo.

**CÓMO SE PROVOCA — y por qué NO con la red.** La primera versión del arnés
cortaba peticiones con el enrutador del navegador, como el guion hermano.
**Interceptó cero y lo iba a informar como bueno**: Firestore mantiene un canal
largo ya abierto y, ante un fallo de red, **sirve la caché en silencio** — el
callback de error ni se entera. Por la vía de la red este defecto **no se
alcanza**. Lo cazó imprimir el contador de peticiones cortadas; sin él habría
sido el sexto «cero que no era» de este carril.

Las causas que sí lo encienden son de servidor. Se emula **permiso denegado**
cambiando las reglas del emulador y devolviéndolas en un `finally`.

**PROBADO AL REVÉS, en navegador.** Quitando el aviso y recompilando, con el
permiso negado: rejilla pintada, `lo dice: false`. Con el aviso: `lo dice: true`.
El guardián cae por los dos lados — si se tira el `error:` y si se recoge y no se
lee, que es la forma que tenía el defecto.

**LO QUE QUEDA NOT_PROVEN, Y SE DICE.** **El aviso del modal no se ha visto
pintado.** Con el permiso negado, *todos* los caminos que abren ese modal pasan
antes por una lista que también falla —`/citas` cambia la lista por su estado de
error, bien hecho, y el calendario se queda sin bloques que pulsar—: no se puede
editar una cita que no se puede ver. Se intentaron dos rodeos y ninguno medía lo
que decía; el segundo falló porque `useAppointments` **sólo amplía la ventana
hacia atrás**, a propósito, así que mover la fecha a un día posterior no
re-suscribe nada y `error` se queda en `null` **correctamente** — medía el guion,
no el producto. La causa que lo alcanzaría en producción es la que el emulador no
sabe fabricar: un índice que falta para la ventana ancha del modal mientras la
consulta estrecha de la pantalla sí responde.

Se conserva el aviso —es correcto, cuesta cuatro líneas y no puede romper nada—
**etiquetado como no visto**, en vez de borrarlo o de llamarlo probado.

**COMPUERTAS.** `vitest` 10 852 de 10 854 · trinquete de lint 95 = techo ·
trinquete de diseño sin deuda nueva (cazó un `11.5` duplicado y se arregló el
cambio, no el techo) · `tsc` limpio · `npm run build` compila · el arnés nuevo en
verde. Los dos rojos: el inventario de pantallas, regenerado; y
`ops-timeout-y-punto-ciego`, que **falla igual con mis cambios guardados** —
comprobado con `git stash`— y es el de siempre, que necesita una IP que trague
paquetes.

**RESIDUAL_RISK.**

- **Seis de las nueve llamadas a `useAppointments` siguen sin recoger `error`**:
  `PanelPendientes`, `/asistente`, `useNotificacionesCitas`. No se tocan porque
  no se han medido; que no estén en el guardián significa que **no se vigilan**,
  no que estén bien.
- El fallo por **índice que falta** no se emula en ninguna parte.
- No se comprueba que el aviso **se quite** al volver el permiso.
- El escenario parcial sólo se mide en `/calendario`. Las otras 22 rutas están
  medidas contra la caída total, no contra la parcial.

---

## Unidad 74 — la cita de las 20:30 no estaba en ninguna parte

**DE DÓNDE SALE.** De mirar una captura. El arnés del consultorio recién abierto
acusó a `/calendario` y a `/configuracion` de no decir que están vacías, y en vez
de arreglarlo se abrió la imagen. **Los dos eran falsos positivos**:
`/configuracion` es un formulario —«vacío» no es un estado que tenga— y la
rejilla del calendario se explica sola, con «Nueva cita» donde tiene que estar.
Eso queda dicho y no se toca.

Pero en la captura, **las trece filas de hora pesaban exactamente lo mismo**. Al
preguntar de dónde salían, resultó que de ninguna parte:

```js
const HOURS = Array.from({ length: 13 }, (_, i) => i + 7) // 7am–7pm
```

Trece números fijos que **nunca habían consultado el horario del consultorio**.

**LO QUE ESO ESCONDÍA.** Cada cita se pinta metiéndola en la celda de su hora.
Una cita a las 20:30 **no encuentra celda**, así que no se pinta: ni atenuada, ni
recogida en un «+2 más», ni con un aviso. Desaparece.

Medido con dos citas confirmadas de hoy, a las 06:30 y a las 20:30:

```
/calendario (semana) -> 06:30 visible: false · 20:30 visible: false
/calendario (día)    -> 06:30 visible: false · 20:30 visible: false
/citas      (lista)  -> 06:30 visible: true  · 20:30 visible: true
```

La lista sí las tiene. Sólo desaparecen **en la pantalla donde el médico mira su
día**. Un consultorio que atiende hasta las 21:00 —cosa que la propia
configuración permite declarar— no ve sus últimas consultas, y tampoco puede
agendar ahí: no hay fila que pulsar.

**EL ARREGLO.** La rejilla se calcula: `lib/agenda/horas-a-ensenar`. Abarca (1)
el horario declarado por el consultorio —para poder AGENDAR donde se atiende, no
sólo ver lo agendado— y (2) **las horas donde de verdad hay citas**, que es lo
que cierra el defecto: una cita puede caer fuera del horario por sobreagenda, por
una importación o porque el horario cambió DESPUÉS de agendarla, y ninguna de las
tres puede volverla invisible. El 07:00–19:00 se queda de suelo, así que un
consultorio normal ve la misma rejilla de siempre.

**PROBADO AL REVÉS, dos veces.** Volviendo a poner el `HOURS` fijo y
recompilando: semana y día esconden las dos citas, la lista las enseña. Y
quitando el ensanche por citas del módulo, caen tres casos del golden.

**UN FALSO NEGATIVO PROPIO, y cómo se cazó.** La primera versión del arnés
buscaba el nombre en `document.body.innerText` y dijo que la vista de semana
seguía escondiéndolas **después** de arreglarla. No era verdad: el bloque estaba
pintado —se vio consultando el DOM— pero su nombre no sale por `innerText`,
porque es una caja absoluta y estrecha con el texto recortado. Se pregunta ahora
por los bloques, que es lo que de verdad ocupa un sitio en la rejilla. Sin esa
comprobación habría «arreglado» dos veces algo que ya estaba bien.

**Y UN TRINQUETE QUE CAZÓ EL CAMBIO.** `timezone-sitios` subió a 41 sobre un
techo de 40: mi cálculo añadía una llamada suelta a `fechaISOLocal`. Se arregló
el cambio, no el techo — los siete días se calculan **una vez** por semana en vez
de una vez por celda (siete por fila, trece filas, más la cabecera), así que la
cuenta **baja** en lugar de subir.

**COMPUERTAS.** `vitest` 10 858 de 10 859 —sólo `ops-timeout-y-punto-ciego`, el
de siempre— · lint 95 = techo · trinquete de diseño sin deuda nueva · `tsc`
limpio · `npm run build` compila · **trinquete de interfaz: sin regresión en las
69 combinaciones**, que aquí importa porque una rejilla más alta podía haber
roto el ancho de 390.

**RESIDUAL_RISK.**

- **El horario partido no se mira.** `DaySchedule` admite huecos dentro del día
  (la comida) y esto sólo usa `inicio` y `fin`: esas horas se enseñan como
  normales, igual que antes. No es una regresión, pero tampoco está resuelto.
- Un consultorio de 24 h daría 24 filas. Se acepta: es lo que hay que enseñar.
- **No se comprueba que se pueda AGENDAR en la fila nueva**, sólo que la cita se
  vea. El clic sobre la celda libre usa el mismo camino de siempre.
- La vista de MES no se mira: no usa rejilla de horas.
- El arnés sólo prueba dos horas, 06:30 y 20:30. No barre las 24.

---

## Unidad 75 — un panel que se quita solo está afirmando algo

**DE DÓNDE SALE.** Del barrido que dejó abierta la unidad 73: de las nueve
llamadas a `useAppointments`, sólo dos recogían `error`. Éste —`PanelPendientes`,
«Siguiente acción», **lo primero que mira el médico al entrar**— no sólo no lo
recogía: además tenía dos `.catch` vacíos, que es la forma más explícita que hay
de tragarse un fallo.

```js
listarCobros(...).then(setCobros).catch(() => {})
listarMembresias(...).then(setMembresias).catch(() => {})
const { appointments } = useAppointments(...)      // `error` sin recoger
...
if (acciones.length === 0) return null
```

**LO QUE ESO HACÍA.** Las tres fuentes alimentan la misma lista. Con una caída la
lista sale **corta**; con las tres, **vacía**. Y con la lista vacía el panel se
quitaba del tablero entero: ni error, ni hueco, ni rastro de que hubiera
existido.

Un panel que desaparece no se está callando: está diciendo **«hoy no tienes nada
que hacer»**. Y lo dice sin haberlo comprobado. Detrás puede haber un cobro sin
cerrar, una membresía vencida o un paciente sin confirmar.

**EL ARREGLO.** Se recogen los tres fallos y el panel sólo desaparece cuando de
verdad no hay nada: cero acciones **y** las tres fuentes contestaron. Si alguna
falló, se queda y **dice cuál** — no es lo mismo no haber podido ver los cobros
que no haber podido ver la agenda: el médico sabe a qué pantalla ir a mirar a
mano. El aviso distingue las dos formas de engañar: lista vacía («esto NO quiere
decir que no tengas nada pendiente») y lista corta («puede faltar algo en esta
lista»).

**PROBADO AL REVÉS, y con precisión sobre QUÉ mitad.** Negando la lectura de
`cobros` en el emulador, con el código anterior: el panel se queda —porque las
citas seguían dando acciones— y **no dice** que le falta una fuente. Ésa es la
mitad medida en navegador: la lista corta que parece completa. La otra mitad —la
desaparición— pide que las tres fuentes den cero a la vez y **no se midió en
navegador**; la vigila el golden, sobre la condición de salida temprana. Se dice
así en vez de dar por vista una pantalla que no se vio.

**Y OTRO TRINQUETE QUE CAZÓ EL CAMBIO.** El lint subió a 96 sobre 95: mi primera
versión ponía los fallos a `false` al principio del efecto —un `setState`
síncrono dentro de un efecto—. Se arregló el cambio, no el techo, y el arreglo
salió mejor que el original: el fallo se guarda **atado a la petición que lo
produjo**, así que caduca solo cuando cambia el día o el consultorio, sin que
nadie tenga que acordarse de borrarlo.

**COMPUERTAS.** `vitest` 10 861 de 10 862 —sólo `ops-timeout-y-punto-ciego`— ·
lint 95 = techo · trinquete de diseño sin deuda nueva · `tsc` limpio · `npm run
build` compila · `arnes:caida-parcial` en verde con su tercer bloque.

**RESIDUAL_RISK.**

- **Siguen sin recoger `error` dos consumidores**: `/asistente` y
  `useNotificacionesCitas`. No se han medido, y no estar en ningún guardián
  significa que **nadie los mira**.
- La desaparición del panel no está medida en navegador (arriba, con su razón).
- El aviso no se comprueba que se QUITE al volver el permiso.
- `accionesPendientes` sigue sin saber que una fuente falló: recibe listas
  vacías y no puede distinguirlas. El aviso vive en la pantalla, no en el motor.

---

## Unidad 76 — el único diálogo del producto sin teclado

**DE DÓNDE SALE.** De buscar qué requisito del encargo **no medía nadie**. Dos
salieron a la vez, y sólo uno es accionable aquí:

- **WebKit** — `BLOCKED_EXTERNAL`. En esta caja sólo está instalado Chromium
  (`/opt/pw-browsers/`: chromium, chromium_headless_shell, ffmpeg) y el entorno
  prohíbe `playwright install`. Se registra y se salta, como manda el encargo.
- **El teclado de los diálogos** — interno, y sin medir. El arnés de foco mira
  los campos de formulario; los diálogos no los miraba ninguno, **aunque la
  regla de diseño los nombre literalmente**: «modal que no atrapa el foco ni
  cierra con Escape» está en la lista de mínimos que fallan la compuerta.

**LO QUE HABÍA.** Ocho `role="dialog"` en el producto. Siete usan
`useDialogoDeTeclado` —el gancho donde viven las cinco conductas: Escape, foco
atrapado, foco inicial, scroll bloqueado y foco devuelto—. Uno no: `BotonAyuda`,
el panel del asistente. Medido en `/citas`:

```
foco entra: false · sigue abierto tras Escape: sí
```

Quien usa teclado o lector pulsaba «Ayuda» y el panel se abría **sin que el foco
se moviera**: para él la ayuda no había ocurrido. Y para quitársela de encima
tenía que tabular a ciegas hasta la aspa, porque Escape no hacía nada.

**No era una decisión.** El panel se escribió antes de que el gancho existiera, y
cuando las cinco conductas se sacaron de `ui/Modal` a un sitio común, éste se
quedó atrás. La familia de siempre: la lección aprendida en un componente y no en
el de al lado. Los otros dos ficheros que parecían faltar —`nota/` y `finanzas/`—
eran **falsas alarmas del grep**: sus menciones a Escape están dentro de
comentarios que explican cómo ya se pasaron a la primitiva.

**EL ARREGLO.** `useDialogoDeTeclado`, igual que los otros siete. No es una
implementación nueva; es la que ya estaba bien, aplicada donde faltaba.

**PROBADO AL REVÉS.** Con la versión anterior recompilada: `arnes:dialogos-teclado`
marca FALLA en el panel —«el foco NO entra · Escape NO lo cierra»— y **deja la
paleta en verde**, así que el arnés discrimina y no acusa a todos. El golden cae
con el mismo cambio, nombrando el archivo.

**EL ARNÉS ABRE LOS DIÁLOGOS, no lee el código**, y a propósito: el gancho puede
estar llamado con un `ref` que no llega al elemento o con `abierto` mal cableado,
y el código se leería perfecto. Se abre, se pulsa Escape y se mira dónde quedó el
foco. El golden cubre lo otro —que ninguno se quede sin gancho— porque el arnés
sólo sabe abrir dos de los ocho.

**COMPUERTAS.** `vitest` 10 863 de 10 864 —sólo `ops-timeout-y-punto-ciego`— ·
lint 95 = techo · trinquete de diseño sin deuda nueva · `tsc` limpio · `npm run
build` compila · `arnes:dialogos-teclado` en verde.

**RESIDUAL_RISK.**

- **El arnés sólo sabe abrir 2 de los 8 diálogos.** Los que piden un estado
  difícil —un cobro a medias, una firma, un laboratorio— no se abren, y **no
  estar en la lista significa que no se vigilan**, no que estén bien.
- ~~La trampa de foco no se mide.~~ **Se mide desde el 31-ago**: 25 tabulaciones
  por diálogo —más del doble de los controles de cualquiera— comprobando que
  ninguna caiga fuera. Probado al revés quitándole el gancho al panel de ayuda:
  **25 de 25 se van fuera**, y la paleta se queda en 25/25, así que discrimina.
  Lo que sigue sin medirse es el ORDEN dentro del diálogo.
- El aviso de cierre de sesión **no** cierra con Escape a propósito, y por eso
  no está en la lista del arnés: desactivar sin querer un control de seguridad
  es el defecto contrario.
- **WebKit sigue sin medirse.** Todo lo de este carril está medido en Chromium.
- Un diálogo escrito con `role={'dialog'}` en vez de la forma literal se le
  escapa al golden.

---

## Unidad 77 — la columna rotulada «31» contenía las citas del 30

**DE DÓNDE SALE, y de cómo casi se pierde.** El arnés de las citas fuera de hora
empezó a fallar **sólo en la vista de semana**, después de que el contenedor
cruzara la medianoche UTC. La primera reacción fue sospechar del arreglo de la
unidad 74. Mirar la captura dijo otra cosa, y bastante peor.

Antes de eso hubo que arreglar dos cosas del propio arnés, y las dos merecen
constar porque las dos producían un rojo falso:

1. **El emulador de auth se había caído.** Firestore seguía en pie, así que la
   pantalla de acceso salía y el fallo parecía del producto. Se levantó de nuevo
   y se recreó el usuario **con su UID original** —el que apunta el documento de
   `clinic_members`—, porque uno nuevo deja al médico sin consultorio.
2. **El arnés sembraba con la fecha del CONTENEDOR.** El contenedor va en UTC y
   el consultorio en México: a esa hora eran días distintos, así que se sembraban
   citas para un día que la pantalla no estaba mirando, y el guion informó que
   hasta la LISTA las escondía. No las escondía: no existían para ese día.

**EL DEFECTO DE VERDAD, que estaba debajo.** El calendario usaba DOS husos a la
vez, y en la misma casilla:

- el número de la cabecera salía de `d.getDate()` — el calendario **del aparato**;
- la llave con la que se buscan las citas de esa casilla salía de
  `fechaISOLocal(d)`, que convierte el instante a la zona **del consultorio**.

`getWeekDates` fabrica sus siete fechas como **posiciones de calendario** —a
mediodía, con aritmética local—, no como instantes. Convertirlas de huso las corre
de día en cuanto el aparato y el consultorio no coinciden. Y encima la semana que
se abría salía de `new Date()` mientras el resaltado de «hoy» salía de `hoyISO()`.

Medido con el navegador en `Pacific/Kiritimati` (UTC+14) y el consultorio en
México (UTC−6):

```
días en la cabecera: 31, 1, 2, 3, 4, 5, 6
marcados como hoy:  31        ← y hoy, en el consultorio, era el 30
```

**La columna rotulada «31» estaba marcada como hoy y contenía las citas del 30.**
Son dos defectos, y el segundo es el que no se ve: abrir en la semana equivocada
se nota; poner las citas de un día bajo el rótulo de otro, no.

**EL ARREGLO.** Una casilla de rejilla es un **día del calendario**, no un momento
en la línea del tiempo: se lee por las mismas partes con las que se construyó y se
rotula (`lib/agenda/dia-de-rejilla`), sin convertir de huso. Y el ancla de la
rejilla se pone en el día del CONSULTORIO, que es el que usa todo lo demás de la
pantalla. **Para quien tiene el aparato en la zona de su consultorio —el caso
normal— no cambia absolutamente nada.**

**PROBADO AL REVÉS, en navegador y en la suite.** Devolviendo `new Date()` y
`fechaISOLocal`: el arnés marca «la semana abierta no contiene el 30» y «el 30 no
está marcado como hoy».

**Y UNA TAUTOLOGÍA CAZADA A TIEMPO.** La primera versión del golden «pasó» con el
defecto puesto, y estuvo a punto de quedarse así: la suite **fija la zona**
(`vitest.config.ts`: `TZ = America/Mexico_City`), así que en una corrida normal el
aparato y el consultorio siempre coinciden — justo el caso en que esto no se
manifiesta. Se comprobó imprimiendo la zona dentro de vitest en vez de darla por
buena. Con el interruptor que ya existía, `TZ_TESTS=Pacific/Kiritimati`, y la
conversión devuelta, caen tres casos con el desfase exacto
(«expected '2025-12-31' to be '2026-01-01'»). Queda escrito en la cabecera del
golden, porque el siguiente que lo lea merece saberlo.

**COMPUERTAS.** `vitest` 11 986 de 11 987 —sólo `ops-timeout-y-punto-ciego`— ·
lint 95 = techo · trinquete de diseño sin deuda nueva · `tsc` limpio · `npm run
build` compila · **trinquete de interfaz sin regresión (69 combinaciones)** · los
cinco arneses de este carril en verde.

**RESIDUAL_RISK.**

- **No se cubre el cambio de día con la pantalla ABIERTA**: a medianoche del
  consultorio, `baseDate` sigue donde estaba. Es el estado inicial lo que se
  arregló, no un reloj vivo.
- ~~La vista de MES no se miró.~~ **Medida** justo después: el arnés cambia a
  «Mes» con el aparato en Kiritimati y comprueba que marque el día del
  consultorio — sale bien (marca el 30). Lo que **no** se corrió aparte es su
  mitad al revés: comparte ancla y lectura de día con la semana, que sí se probó
  al revés, y por eso se dice «medida», no «probada al revés».
- Sólo se prueba una zona **por delante** del consultorio. La simétrica —por
  detrás— produce el defecto espejo y **no se vigila**.
- El resto del producto sigue usando `fechaISOLocal` donde toca: esto cambia
  **sólo** la rejilla del calendario, que es donde las fechas son casillas y no
  instantes.

---

## Unidad 78 — cincuenta de las noventa y una celdas eran horas cerradas, y pesaban lo mismo

**DE DÓNDE SALE.** De la unidad 74, que hizo que la rejilla consultara el horario
del consultorio para decidir **hasta dónde llegar**. Al mirar la captura después,
lo que quedaba claro era otra cosa: la rejilla llega de 07:00 a 19:00 y el
consultorio atiende de 09:00 a 18:00 —los viernes hasta las 14:00, los fines de
semana nada—, así que **50 de las 91 celdas de la semana son horas cerradas** y
se veían exactamente igual que las abiertas.

«Todo con el mismo peso visual» está literalmente en la lista de lo que esta
interfaz no debe parecer.

**LO QUE SE INTENTÓ PRIMERO, Y POR QUÉ NO VALÍA.** Copiar el tinte que ya existe
para el fin de semana: un velo claro al 3 %. Se implementó, se compiló, se
miró — y **no se veía nada**. Peor: iba en la dirección contraria. Aclarar una
banda grande la ADELANTA, y lo que tiene que hacer una hora cerrada es
retroceder. Se cambió a `--bg`, que en los **dos temas** es la superficie que hay
debajo de la rejilla (`--s1`): la hora cerrada se lee como «aquí no hay mesa de
trabajo, se ve el suelo». Un token que ya existía; ni gradiente, ni sombra, ni
color inventado.

Mirado otra vez en los dos temas: el viernes por la tarde, el sábado, el domingo
y las franjas de antes de las 09:00 y después de las 18:00 se leen de un vistazo.
En claro incluso mejor que en oscuro.

**TIÑE, NO BLOQUEA.** Agendar fuera de horario sigue pudiéndose: una urgencia es
legítima, y este repositorio ya tiene dicho cómo se tratan esos casos —«la salida
autorizada, no un muro»—. Lo que faltaba era que se viera.

**MEDIDO.** 91 celdas, **50 marcadas**, y el puntero sigue vivo sobre una celda
cerrada (`rgb(11,12,14) → rgb(26,29,33)`). Eso último no es un detalle: la
primera versión usaba `[data-finde][data-cerrado]`, **dos atributos**, que le
gana en especificidad a un `:hover` de uno solo — habría dejado muerta la
respuesta al ratón en las celdas de fin de semana. Es el mismo defecto que ya
costó las 91 celdas de esta rejilla una vez, ahora por especificidad en vez de
por estilo en línea. Se vio comprobando el color antes y después de posar el
ratón, no leyendo el CSS.

**DOS COSAS QUE CAZARON MIS PROPIOS CASOS DE PRUEBA:**

1. **`estaAbierto` devolvía `false` cuando no había día declarado**, y habría
   teñido de cerrado la columna entera de un consultorio que no publicó ese día.
   Ausencia de dato tomada por dato de ausencia —la regla 4— pintada en la
   rejilla. Ahora, sin horario, **no se opina**.
2. **`la-agenda-acusa-recibo` se puso rojo**, y no era un defecto: pedía
   `.nx-agenda-celda:hover {` con la llave pegada, y al añadir un segundo
   selector a la misma regla dejó de casar aunque el puntero respondía. Guardián
   anclado en la forma literal —el tercero de este carril—. Se reescribió para
   comprobar la **invariante** (que exista una regla de `:hover` sobre la celda,
   sola o acompañada, que toque el fondo) y se probó al revés **por los dos
   lados**: sin fondo en la regla, y sin regla ninguna.

**COMPUERTAS.** `vitest` 11 990 de 11 991 —sólo `ops-timeout-y-punto-ciego`— ·
lint 95 = techo · trinquete de diseño sin deuda nueva · `tsc` limpio · `npm run
build` compila · **trinquete de interfaz sin regresión (69 combinaciones)** ·
**`arnes:tema-claro`: 44 combinaciones, axe 0, 0 de 91 campos sin foco** — que
aquí importaba de verdad, porque los bloques de cita ahora se pintan sobre otro
fondo.

**RESIDUAL_RISK.**

- ~~El horario partido sigue sin verse.~~ **Cerrado en la misma sesión**, ver
  abajo: era el hueco más visible que dejaba esta unidad y no llegó a dormir.
- **No mira festivos** (`diasFestivos` existe y `getDaySchedule` lo usa; la
  rejilla no).
- **No mira horarios por médico**: usa el del consultorio, aunque el producto
  sepa de horarios individuales.
- La vista de **día** y la de **mes** no llevan la banda: sólo la semana.

---

## Unidad 79 — la hora de comer se enseñaba como agendable

**DE DÓNDE SALE.** Del riesgo residual que dejó la unidad 78, sin dejarlo dormir.
`DaySchedule` tiene `descansos` —el horario partido— y el tipo no lo trata como
un adorno: «un médico que atiende de 9 a 14 y de 16 a 20, **que en México es lo
normal, no la excepción**».

**LO QUE FALLABA, y por qué es de la familia de siempre.** `getAvailableSlots`
**ya** se salta las franjas que pisan un descanso (`pisaDescanso`, desde hace
tiempo). La rejilla no. Así que el selector de horas se negaba a ofrecer las
14:00 mientras la rejilla las pintaba abiertas y clicables: **la pantalla decía
una cosa y el motor otra**, y el que se lleva el chasco es quien confía en la
pantalla.

**MEDIDO EN NAVEGADOR**, con el consultorio puesto a 09:00–20:00 y descanso de
14:00 a 16:00:

```
07:00  cerradas 7/7      13:00  cerradas 0/7
08:00  cerradas 7/7      14:00  cerradas 7/7   ← la comida
09:00  cerradas 0/7      15:00  cerradas 7/7   ←
…                        16:00  cerradas 0/7
```

**SE TIÑE DE MENOS, NUNCA DE MÁS.** Sólo se marca cerrada la hora que el descanso
cubre **entera**. Un descanso de 14:30 a 15:30 deja las 14:00 y las 15:00 medio
abiertas —se puede agendar en ellas—, y pintarlas de cerrado sería decirle al
médico que no puede cuando sí puede.

**Y ESE MISMO CASO CAZÓ UN DEFECTO MÍO.** La primera versión comparaba con
`hora24`, que se queda con la hora y **tira los minutos**: un descanso de 14:30 a
15:30 se leía como «de 14 a 15» y cerraba las 14:00 enteras. El caso «se tiñe de
menos» se puso rojo antes de que nadie lo viera en una pantalla. Ahora se compara
en minutos desde medianoche.

**PROBADO AL REVÉS.** Quitando la comprobación de descansos, caen dos casos: «las
14:00 caen dentro del descanso» y su gemelo de las 15:00.

**COMPUERTAS.** `vitest` 11 993 de 11 994 —sólo `ops-timeout-y-punto-ciego`— ·
lint 95 = techo · trinquete de diseño sin deuda nueva · `tsc` limpio · `npm run
build` compila. La configuración del emulador se devolvió a como estaba: el
descanso se puso para medir y se quitó, para no mover la línea base de los otros
arneses.

**RESIDUAL_RISK.**

- **Los festivos siguen sin verse.** `diasFestivos` existe y `getDaySchedule` lo
  usa; la rejilla no lo mira. Es ahora el hueco más grande de esta banda.
- ~~Ni los horarios por médico.~~ **Cerrado abajo, y de paso corregido lo que
  decía esta línea**: afirmaba «la banda miente» como si pasara hoy, y no pasaba
  — `horarioPropio` no lo enciende ninguna pantalla. Era una exageración mía.
- La banda sigue siendo sólo de la vista de **semana**.
- Un descanso que cubre media hora no se dibuja de ninguna forma: o cubre la
  franja entera o no se ve. Media franja sombreada pediría otra pieza.

---

## Unidad 80 — la banda del médico filtrado, y una exageración mía corregida

**DE DÓNDE SALE.** Del último riesgo residual de la unidad 79. Al ir a cerrarlo,
lo primero que apareció fue que **yo lo había escrito mal**: decía «con el filtro
puesto en un médico con otro horario, la banda miente», como si fuera algo que
pasa hoy. No pasa. El propio tipo lo dice: «HORARIO PROPIO — **hoy nadie lo
enciende**», y no hay pantalla que lo active.

Queda corregido arriba. Un carril que exagera sus propios riesgos residuales
gasta la credibilidad de los que sí son ciertos.

**LO QUE SÍ SE HACE, y por qué aun así vale la pena.** La rejilla se puede
filtrar por médico, y `getAvailableSlots` **ya** resuelve el horario con
`configParaMedico` —el sitio donde vive esa decisión—. La banda no lo hacía: leía
el del consultorio y punto. El día que alguien encienda `horarioPropio`, la
pantalla y el motor se separarían otra vez.

Se cablea con **el mismo helper**, no con una regla nueva. Tres líneas.

**MEDIDO, con un médico sintético de sólo tarde (16:00–19:00):**

```
SIN filtro:  07:00 7/7  08:00 7/7  09:00 2/7 … 14:00 3/7 … 18:00 7/7
CON filtro:  07:00 7/7 … 15:00 7/7  16:00 0/7  17:00 0/7  18:00 0/7  19:00 7/7
```

Sin filtro, la banda del consultorio —con el viernes cerrando a las 14:00, que es
el 3/7—. Con el filtro, **sólo sus tres horas abiertas**, y las 19:00 cerradas
porque a esa hora termina. El médico sintético y su compañero se borraron al
acabar, y se comprobó que el emulador quedó como estaba: cero médicos y sin
`horario` propio en la configuración, que es lo que hace que caiga a
`DEFAULT_CONFIG`.

**COMPUERTAS.** `vitest` 11 993 de 11 994 —sólo `ops-timeout-y-punto-ciego`— ·
lint 95 = techo · trinquete de diseño sin deuda nueva · `tsc` limpio · `npm run
build` compila.

**RESIDUAL_RISK.**

- ~~Los festivos siguen sin verse.~~ **Cerrado abajo**, en la unidad 81.
- **Esto no tiene arnés que se vuelva a correr solo.** Se midió a mano con datos
  sintéticos y se limpió; no queda un guion que lo repita. Es la diferencia entre
  «medido una vez» y «vigilado», y aquí es lo primero.
- La banda sigue siendo sólo de la vista de **semana**.

---

## Unidad 81 — el día festivo se pintaba entero como agendable

**DE DÓNDE SALE.** Del último riesgo residual que quedaba de la banda. Es la
tercera vez seguida que aparece **el mismo patrón**, y por eso vale la pena
nombrarlo así: `getDaySchedule` devuelve `null` en un festivo —de modo que el
selector de horas **no ofrece ninguna**— y la rejilla pintaba el día entero
abierto y clicable. Igual que con el horario partido y con el horario del médico:
**el motor ya sabía; la pantalla no se había enterado.**

**MEDIDO EN NAVEGADOR**, con el miércoles 26 declarado festivo y el consultorio
en su horario por defecto:

```
24: 9 abiertas de 13      28: 5 abiertas de 13   ← viernes cierra a las 14:00
25: 9 abiertas de 13      29: 0 abiertas de 13
26: 0 abiertas de 13  ←   30: 0 abiertas de 13
27: 9 abiertas de 13
```

**PROBADO AL REVÉS**, también en navegador: quitando la comprobación del cableado
y recompilando, el miércoles 26 vuelve a **9 abiertas de 13** — el festivo
desaparece de la pantalla mientras el selector sigue sin ofrecer horas.

**Se usa `esFestivo` de `lib/availability`**, que es el que ya usa
`getDaySchedule`: la misma función, no una regla nueva. Entiende las dos formas
que admite el producto —fecha completa `YYYY-MM-DD` y recurrente `MM-DD`— porque
se le pasa el arreglo tal cual.

Un festivo cierra el día **entero**, así que se resuelve **por columna** y no por
celda: siete llamadas por semana en vez de noventa y una.

**COMPUERTAS.** `vitest` **11 994 de 11 994** —esta vez `ops-timeout-y-punto-ciego`
también pasó, que es exactamente la alternancia que este carril lleva
documentando: es del entorno— · lint 95 = techo · trinquete de diseño sin deuda
nueva · `tsc` limpio · `npm run build` compila · `arnes:cita-fuera-de-hora` y
`arnes:hoy-del-consultorio` en verde sobre este build.

El festivo sembrado y el resto de datos de prueba se quitaron, y se comprobó
documento a documento que el emulador quedó como estaba: sin `diasFestivos`, sin
`horario` propio y con cero médicos.

**RESIDUAL_RISK.**

- ~~Nada de esta banda tiene arnés que se vuelva a correr solo.~~ **Cerrado en la
  unidad 82**, que es exactamente el arnés que esta línea pedía.
- La banda sigue siendo sólo de la vista de **semana**: ni el día ni el mes la
  llevan.
- Un festivo se pinta igual que un domingo. No se distingue «cerrado porque es
  festivo» de «cerrado porque no se atiende ese día», y para el médico son cosas
  distintas.

---

## Unidad 82 — «medido una vez» no es «vigilado»

**DE DÓNDE SALE.** De la línea que yo mismo escribí al cerrar la unidad 81:
*«nada de esta banda tiene arnés que se vuelva a correr solo… el día que alguien
rompa la banda, no salta nada»*. Las cuatro propiedades de la banda —horario,
comida, médico filtrado y festivo— estaban medidas **a mano**, con datos
sintéticos que se sembraban y se borraban a mano. Eso no es una compuerta: es una
anécdota.

Y era la peor clase de hueco para este defecto en concreto, porque **las cuatro
veces el patrón fue el mismo**: el motor ya sabía y la pantalla no se había
enterado. Ese defecto no rompe ninguna prueba y sólo se ve mirando la pantalla —
es decir, vuelve en cuanto nadie mire.

**LO QUE HACE.** `npm run arnes:banda-de-atencion` siembra un consultorio de
09:00 a 20:00 con la comida de 14:00 a 16:00, declara festivo el miércoles **de
la semana que el calendario va a abrir** —calculado desde el «hoy» del
consultorio, no del contenedor— y crea dos médicos, uno con horario propio de
sólo tarde. Después mide la rejilla por filas y por columnas.

Medido con eso:

```
filas:    07:00=0  08:00=0  09:00=6 … 13:00=6  14:00=0  15:00=0  16:00=6 … 19:00=6
columnas: 24=9  25=9  26=0  27=9  28=9  29=9  30=9      · festivo: 26
filtro:   15:00=0  16:00=6  18:00=6  19:00=0
```

Los 6 de 7 en las horas abiertas son la columna del festivo, cerrada.

**PROBADO AL REVÉS.** Desactivando la banda y recompilando, el arnés canta **seis
fallos con nombre** —«07:00 debería estar cerrada en toda la semana y hay 6
celdas abiertas», «el médico de tarde NO atiende a las 15:00 y la banda la da por
abierta»…—. Y **la columna del festivo se queda en 0**, porque esa comprobación
es otra: el arnés discrimina en vez de ponerse rojo entero, que es lo que hace
falta para que un rojo signifique algo.

**DEVUELVE LA CONFIGURACIÓN COMO ESTABA, no «a lo normal».** Lee el documento
antes de tocarlo y restaura los campos con la forma que tenían —si el consultorio
ya traía horario propio, borrarlo lo dejaría distinto de como estaba—. Se
comprobó después de cada corrida: sin `horario`, sin `diasFestivos`, cero
médicos.

**COMPUERTAS.** `vitest` 11 993 de 11 994 —`ops-timeout-y-punto-ciego`, que en la
corrida anterior pasó y en ésta no: es del entorno y lleva todo el carril
alternando— · lint 95 = techo · `tsc` limpio · `npm run build` compila ·
`arnes:banda-de-atencion` verde, y rojo con la banda desactivada.

**RESIDUAL_RISK.**

- **No juzga si el tinte se ve LO BASTANTE**, y esa parte sigue siendo un juicio
  hecho mirando capturas. Lo que sí comprueba desde la misma sesión es que
  **algo lo pinte**: la celda cerrada tiene que salir con el token elegido
  (`--bg`) y la abierta no. Probado al revés quitando **sólo la regla de la
  hoja** y dejando el atributo puesto —el escenario «escrito y sin conectar»—:
  el arnés lo dice con esas palabras, «la banda está puesta y no se ve», y las
  comprobaciones de estructura se quedan verdes, así que discrimina. No se
  inventa un umbral perceptual: eso sería un número sacado de la manga.
- ~~Sólo la vista de semana.~~ **La de día la lleva desde la unidad 83**, y el
  arnés la mide. La de MES sigue sin banda: no tiene rejilla de horas, así que
  la banda por horas no le aplica; una banda por DÍAS —cerrar el festivo y el
  domingo— sí tendría sentido y **no está hecha**.
- Un `kill -9` a mitad de corrida deja la configuración sembrada puesta. El
  `finally` cubre los fallos normales, no eso.
- Sigue sin distinguirse «cerrado por festivo» de «cerrado porque no se atiende
  ese día», y para el médico son cosas distintas.

---

## Unidad 83 — la vista de día también tiene horas cerradas

**DE DÓNDE SALE.** Del riesgo residual de la unidad 82: la banda existía sólo en
la vista de semana. La de **día** es la que usa el médico para mirar hoy, y tenía
el mismo defecto — las 07:00 pintadas igual de agendables que las 11:00.

**EL ARREGLO.** El mismo `estaAbierto` y el mismo `esFestivo`, con una diferencia:
aquí manda el horario de **ese** día de la semana, no los siete. `getDay()` da 0
en domingo y este producto numera de lunes a domingo, así que el índice es
`(getDay() + 6) % 7`. De paso, el alto de la rejilla del día se calcula ya con el
horario de ese día en vez de con los siete.

**MEDIDO**, con el consultorio de 09:00 a 20:00 y comida de 14:00 a 16:00:

```
08:00 cerrada=true   11:00 cerrada=false   14:00 cerrada=true   17:00 cerrada=false
```

**PROBADO AL REVÉS.** Quitando el atributo de la celda del día y recompilando, el
arnés canta «las 08:00 son antes de abrir y la banda las da por abiertas» y «las
14:00 son la comida…» — y **las comprobaciones de la semana se quedan verdes**,
así que discrimina entre las dos vistas.

**Y OTRO DEFECTO MÍO, EN EL ARNÉS.** La primera versión medía el día **con el
filtro del médico de tarde todavía puesto** y acusó al producto de dar las 11:00
por cerradas. Lo estaban — **para él**, que entra a las 16:00. El defecto era del
guion, que ahora quita el filtro antes de medir. De paso quedó visto, sin
buscarlo, que el horario del médico llega también a la vista de día.

**COMPUERTAS.** `vitest` 11 993 de 11 994 —`ops-timeout-y-punto-ciego`, el de
siempre— · lint 95 = techo · trinquete de diseño sin deuda nueva · `tsc` limpio ·
`npm run build` compila · `arnes:banda-de-atencion` verde, y rojo al quitar la
banda del día.

**RESIDUAL_RISK.**

- **La vista de MES sigue sin banda.** No tiene rejilla de horas, así que la
  banda por horas no le aplica; una banda por DÍAS —marcar el festivo y el
  domingo— sí tendría sentido y no está hecha.
- Sigue sin distinguirse «cerrado por festivo» de «cerrado porque no se atiende
  ese día».
- El arnés mide cuatro franjas del día (08, 11, 14, 17), no las trece.
