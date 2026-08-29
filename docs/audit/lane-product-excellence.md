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
