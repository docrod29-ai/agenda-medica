# Certificación final — carril de excelencia de producto

> ## ⚠ ESTE DOCUMENTO CADUCÓ, Y UNA DE SUS AFIRMACIONES DEJÓ DE SER CIERTA
>
> Se escribió en `e531077`, con 14 commits por delante de `main`. El carril
> siguió trabajando: hoy va por **45 commits** y las unidades 44–57 son
> posteriores a todo lo que hay escrito aquí abajo.
>
> Lo grave no es que los números envejecieran —eso se ve— sino que el §2 dice
> **CROSS_LANE_CONFLICT = 0** y **ya no lo es**. Un documento que se llama
> «certificación» y afirma algo falso es peor que no tenerlo: es la familia «el
> sistema se contradice a sí mismo», cometida por este carril sobre sí mismo.
>
> **Lo vigente está en el §0, medido de nuevo el 30-ago.** Lo de abajo se
> conserva como lo que es: el acta de un momento, no del estado de hoy.

---

## 0 · Estado REAL a día de hoy (re-medido)

**SHA:** `6e5f340cfbb3317a4fe1afaef5448eeae6ee2bf5`
**Rama:** `product/ausculta-product-excellence`
**Base:** `origin/main` (`bcf6063`) · **45 commits** por delante
**Fecha de esta medición:** 2026-08-30

### Compuertas

| Compuerta | Resultado |
|---|---|
| `npx vitest run` | **10 821 de 10 822** · el único rojo es `ops-timeout-y-punto-ciego` |
| `node scripts/lint-trinquete.mjs` | 95 = techo. Sin deuda nueva |
| `node scripts/design/trinquete-de-diseno.mjs` | Sin deuda nueva (bajado dos contadores más: `lienzosAMano` 43→42, `radiosFueraDeEscala` 618→617) |
| `npx tsc --noEmit` | Sin errores |
| `npm run build` | Compila |
| **Trinquete de interfaz** | **69 combinaciones · 23 rutas · axe 0 · desborde 0** |
| Fusión contra `main` | **Limpia** (0 conflictos) |

`ops-timeout-y-punto-ciego` necesita una IP que trague paquetes; en esta caja el
proxy contesta. Ha pasado y fallado de forma alternante a lo largo del carril
(verde en las unidades 50 y 52, rojo en la 51 y desde la 53). **No se declara ni
arreglado ni roto**: es del entorno, y se verificó contra `main` antes de empezar.

### CROSS_LANE_CONFLICT — **ya no es 0, y así se dice**

Re-medido con `git merge-tree`, contra las **dos** ramas vivas del otro carril:

| Comparación | Preexistentes con `main` | Con esta rama | **Añadidos por esta rama** |
|---|---:|---:|---:|
| `origin/product/ausculta-master-completion` | 8 | 9 | **1** |
| `origin/claude/ausculta-master-completion-4clx9v` | 10 | 15 | **5** |

Los que añade este carril, con su unidad y por qué:

| Archivo | De dónde sale | Naturaleza |
|---|---|---|
| `cumplimiento/retencion/page.tsx` | unidad 45 | **Solape real de contenido**: los dos carriles editaron la misma pantalla |
| `asistente/page.tsx` | unidades tempranas | Solape real de contenido |
| `lib/auth-client.ts` | unidad 37 (techo al token) | Solape real de contenido |
| `package.json` | unidades 53, 54, 56, 62, 63, 64 (guiones de arnés) | **Mecánico**: líneas añadidas en el mismo bloque de `scripts` |
| `consulta/[patientId]/page.tsx` | unidad 63 | **Mecánico, UNA línea**: ver abajo |

**El de la consulta, con nombre y apellido.** Es **un solo trozo en conflicto, de
una línea**: el botón «Agregar diagnóstico». Este carril le añade
`className="nx-acc-caja"` para que acuse el puntero; el otro añade
`tipoOrigen: 'medico'` dentro del objeto del `onClick`. **Las dos caben a la vez**
y la resolución es quedarse con las dos:

```jsx
<button onClick={() => setDiagnosticos(prev => [...prev, { descripcion: '', tipo: 'presuntivo', estado: 'activo', tipoOrigen: 'medico' }])} className="nx-acc-caja" style={S.addBtn}>
```

Se intentó evitarlo separando el `className` a su propia línea, con el `style` en
medio, para que `git` mezclara solo. **No sirvió y empeoró la cosa**: reescribir
la línea que el otro carril también cambia deja las dos regiones solapadas igual,
y el comentario que añadí para explicarlo cayó justo donde el otro carril inserta
otro bloque — un conflicto de uno pasó a dos. Se revirtió el intento y se declara
el conflicto tal cual.

Se declara y **no se resuelve aquí**: resolverlo pediría traer el trabajo del
otro carril a esta rama, que es justo lo que el encargo prohíbe.

**No se resuelven aquí, y es a propósito.** Las dos ramas están en vuelo; traer
la del otro carril a ésta para deshacer el conflicto sería meterse en su trabajo,
que es justo lo que el encargo prohíbe. Lo que corresponde es **declararlo con
nombre y unidad** para que quien fusione sepa qué toca y por qué, en vez de
encontrarse una sorpresa detrás de un documento que decía cero.

`uci/page.tsx`, que la unidad 57 tocó, **no añade conflicto**: comprobado.

---

---

## 1 · Compuertas

| Compuerta | Resultado |
|---|---|
| `npx vitest run` | **777 de 777 archivos · 10 696 de 10 696 casos** |
| `node scripts/lint-trinquete.mjs` | 95 errores = techo. Sin deuda nueva |
| `node scripts/design/trinquete-de-diseno.mjs` | Sin deuda nueva |
| `npx tsc --noEmit` | Sin errores |
| `npm run build` | Compila |

La suite incluye `ops-timeout-y-punto-ciego`, que durante casi todo el carril
falló por el entorno —necesita una IP que trague paquetes y el proxy de esta
caja contesta— y que en la corrida final pasa. **No se tocó**: su rojo era del
entorno, no de la rama, y se verificó contra `main` antes de empezar.

### Trinquete de diseño — lo que este carril bajó

| Contador | Al empezar | Ahora |
|---|---:|---:|
| `hexEnLinea` | 485 | **357** |
| `halosDeColor` | 7 | **6** |
| resto | — | sin cambio, sin deuda nueva |

---

## 2 · CROSS_LANE_CONFLICT = 0 — **SUPERADO, ver §0**

Verificado con `git merge-tree` contra `origin/product/ausculta-master-completion`:

| | Conflictos |
|---|---:|
| `main` vs. el otro carril (preexistentes) | 8 |
| **esta rama** vs. el otro carril | **8** |
| **añadidos por esta rama** | **0** |

Y la rama **fusiona limpio contra `main`**.

Los 8 preexistentes están en `regression-ledger.md`, `FAMILIAS-DE-DEFECTO.md`,
`familias-de-defecto.ts`, `MASTER_STATE.json`, `INDICE.md`,
`SCREEN_INVENTORY.md`, `ClinicalSpine.tsx` y un test del spine — exactamente
los archivos que este carril **decidió no tocar**, y por eso su bitácora vive
aparte en `lane-product-excellence.md`.

**`SCREEN_INVENTORY.md` sí se regeneró** (lleva conteo de líneas por pantalla).
Filas tocadas por este carril: `/asistente`, `/calendario`, `/chat`, `/citas`,
`/finanzas`, `/mi/[token]`, `/reservar`, `/login`, `/registro`. Filas del otro
carril: `/consulta`, `/consultor`, `/cumplimiento/*`, `/pacientes`,
`/pendientes`. **Disjuntas** — por eso no añade conflicto.

---

## 3 · Prueba en navegador

Chromium real. Dos entornos, y lo que cada uno certifica:

### Contra el build de PRODUCCIÓN (`next start`, puerto 3300)

| Qué | Resultado |
|---|---|
| Portada con y sin `prefers-reduced-motion`, 390/768/1440 | 7 de 7 bloques revelados · **0 ocultos** · latido 2,4 s / 1e-05 s · sin desborde · sin errores de consola |
| axe-core WCAG 2.0/2.1/2.2 A+AA — portada, reserva, login, registro × 3 anchos | **0 violaciones** |
| Techo de agenda | `2051-01-01` → 400 «La agenda llega hasta el 2050-12-31.» · `2027-02-30` → 400 «Esa fecha no existe en el calendario.» |

Esto **cierra** el riesgo residual que la unidad 14 había declarado (la portada
sólo se había medido en desarrollo).

*Lo que este entorno NO certifica:* el servidor de producción de esta caja no
tiene el SDK de administración apuntando al emulador, así que devuelve
«Clínica no encontrada» y listas de huecos vacías. Los rechazos de fecha sí son
concluyentes —ocurren antes de tocar la base—, los recorridos con datos no.

### Contra emuladores (`next dev`, puerto 3200)

| Recorrido | Resultado |
|---|---|
| Reserva del paciente, 8 pasos, 390/768/1440 | «¡Cita solicitada! ✅» · **dato verificado en Firestore** |
| Reserva **sólo con teclado**, 390/1440 | 6 pasos completados · anillo de foco visible en todos · 2 citas en Firestore |
| Alta de la asistente, 8 pasos, 390/768/1440 | 3 citas `confirmada`/`Manual` en Firestore |
| Fallo, reintento, envío duplicado, resultado desconocido | 3 envíos → **1 cita**, mismo `citaId` · otro paciente sigue recibiendo 409 |
| Fecha: domingo, festivo, comida, ventana, techo, imposible | rechazadas, **cada una con su motivo propio** |
| Fallo de red en login y registro, 390/768/1440 | alerta correcta y botón listo para reintentar en los 6 |
| Objetivos táctiles a 390 px | 12 → **2** (los dos restantes, enlaces legales del pie) |
| axe con sesión — `/citas`, `/asistente`, `/pacientes` × 3 anchos | 0 violaciones |

Fechas del recorrido certificadas: **2027-03-15 · 2030-06-20 · 2040-02-29 ·
2050-01-01 · 2050-12-31**, y rechazo de **2051-01-01**, 2099-12-31, 9999-12-31.
Bisiestos sin tabla: 2040-02-29 pasa, 2039-02-29 no.

---

## 4 · Lo que queda declarado y NO resuelto

- **Dos enlaces del pie** a 40 y 42 px (`Operación`, `Soporte`). Separarlos
  cambia la maqueta del pie: decisión de diseño, no arreglo.
- **Saltar de año** en el portal del asistente. El techo ya es verdadero, pero
  llegar a 2050 son 292 clics de flecha. Añadir el salto es función nueva.
- **WhatsApp** (`api/whatsapp/webhook`) maneja fechas para el flujo
  conversacional y **no se tocó**. Merece su propia unidad.
- **El alta desde el panel** (`/api/appointments`) no es idempotente. Ahí hay
  sesión y una asistente que ve la agenda, así que el reenvío ciego no es el
  mismo problema — pero está dicho.
- **El nombre del médico vive en dos documentos** (el de la clínica y
  `config/main`) y pueden decir cosas distintas; en el consultorio sembrado, de
  hecho, las dicen.
- **El honorífico**: quien escribió sólo su nombre ya no ve título. Es una
  decisión de este carril, reversible en una línea de `@/lib/nombre-medico`.
- **La consulta y el dictado por voz** (prioridad 5) **no se recorrieron**: el
  entorno no tiene proveedor de ASR. Sin él no hay recorrido que probar.
- **Ningún lector de pantalla real**: se comprueba el árbol accesible y el foco,
  no lo que se oye.
- Las 16 entradas de este carril **no están en el ledger canónico**, a propósito.
  Su número de REG se asigna al fusionar.

---

# Matriz por pantalla — lo que está medido y lo que no

**Fecha de la medición: 30-ago-2026.** Todo lo que dice «medido» sale de un
guion que se puede volver a correr; lo que dice NOT_PROVEN es que **nadie lo ha
medido**, no que esté mal. La diferencia importa: un carril que llama PROVEN a lo
que no midió es peor que uno que no mide.

## Las columnas, y con qué se llenan

| Columna | Cómo se mide | Estado |
|---|---|---|
| **desktop** (1440) | `arnes:trinquete-interfaz` — axe + desborde | **medido**, 23 rutas |
| **390 px** | el mismo, a 390 y 768 | **medido**, 23 rutas × 3 anchos = 69 |
| **accessibility** | axe-core en las 69 combinaciones · foco visible en 45 campos · **y el tema claro aparte** (`arnes:tema-claro`: 44 combinaciones, axe 0, foco 0/91) | **medido** |
| **visual regression** | techos congelados en `techos-de-interfaz.json`; sólo pueden bajar | **medido** |
| **staticness** | `arnes:acuse-puntero` — controles habilitados que no acusan el puntero | **medido**, 22 rutas |
| **motion/feedback** | lo mismo, más `arnes:foco-visible` y `arnes:menos-movimiento` | **medido** |
| **loading** | `arnes:estado-de-carga` — con la red lenta a propósito | **medido**, 22 rutas |
| **error** | `arnes:caida-de-datos` — cortando los datos (caída TOTAL) · `arnes:caida-parcial` — el consultorio carga y falla una consulta suelta | **medido**, 22 rutas ³ |
| **empty** | `arnes:consultorio-vacio` — con un consultorio creado de cero | **medido**, 20 rutas ⁴ |
| **long content** | desborde con el nombre más largo (trinquete) · texto libre (`arnes:texto-largo`) · listas de 250 filas (`arnes:listas-largas`) | **medido** ¹ |
| **hierarchy** | — | **NOT_PROVEN** |
| **benchmark quality** | — | **NOT_PROVEN** |

## Lo medido, ruta por ruta

`axe` = violaciones críticas · `mudos` = controles sin acuse al puntero ·
`tapados` = controles bajo algo que flota, en los dos extremos del scroll.

| Ruta | axe (3 anchos) | desborde | mudos | foco | tapados | loading | error | empty |
|---|---:|---|---:|---|---:|---|---|---|
| `/citas` | 0 | no | 0 | ok | 0 | ok | ok | ok |
| `/calendario` | 0 | no | 0 | ok | 0 | **arreglado u66** | ok · parcial **arreglado u73** | n/a ⁴ |
| `/asistente` | 0 | no | 3 ¹ | ok | 0 | ok | ok | ok |
| `/lista-espera` | 0 | no | 0 | ok | 0 | ok | ok | ok |
| `/finanzas` | 0 | no | 0 | ok | 0 | ok | ok | ok |
| `/operaciones` | 0 | no | 0 | ok | 0 | ok | ok | ok |
| `/dashboard` | 0 | no | 0 | ok | 0 ² | ok | ok · parcial **arreglado u75** | ok |
| `/pacientes` | 0 | no | 0 | ok | 0 | ok | ok | ok |
| `/pendientes` | 0 | no | 0 | ok | 0 | ok | ok | ok |
| `/configuracion` | 0 | no | 0 | ok | 0 | **arreglado u66** | ok | n/a ⁴ |
| `/crm` | 0 | no | 0 | ok | 0 | ok | ok | **arreglado u68** |
| `/reactivacion` | 0 | no | 0 | ok | 0 | ok | ok | ok |
| `/resenas` | 0 | no | 0 | ok | 0 | ok | ok | ok |
| `/membresias` | 0 | no | 0 | ok | 0 | **arreglado u66** | ok | ok |
| `/farmacia` | 0 | no | 0 | ok | 0 | ok | ok | ok |
| `/corte-caja` | 0 | no | 0 | ok | 0 | ok | ok | ok |
| `/cumplimiento` | 0 | no | 0 | ok | 0 | ok | ok | ok |
| `/cumplimiento/retencion` | 0 | no | 3 ¹ | ok | 0 | ok | ok | ok |
| `/consultor` | 0 | no | 0 | ok | 0 | ok | ok | ok |
| `/guia` | 0 | no | 0 | ok | 0 | ok | ok | ok |
| `/consulta/pac-001` | 0 | no | 0 | ok | 0 | ok | ok | — |
| `/expediente/pac-001` | 0 | no | 2 ¹ | ok | 0 | ok | ok | — |
| `/mi/[token]` (portal) | 0 | no | — | — | — | — | — | — |

¹ **Los 8 mudos que quedan están todos en archivos ya declarados en
CROSS_LANE_CONFLICT.** Se dejan medidos, con nombre, y sin tocar: bajar un número
a cambio de complicarle el merge a otro carril no es una mejora.

² `/dashboard` llegó a tener **dos botones «Consulta» imposibles de pulsar** bajo
el aviso de notificaciones, sin posición de scroll que los liberara (unidad 64).

¹ **long content.** Desborde medido en 69 combinaciones con el nombre compuesto
más largo que admite un registro civil mexicano; texto libre medido a 1440 y 390
con catorce párrafos y una palabra de 96 letras sin cortes; listas medidas con
**250 pacientes y 90 citas** sembrados en un consultorio aparte — 250 de 250 y 90
de 90 filas pintadas, sin desborde. Lo que **no** se mide es el TIEMPO: se
intentó dos veces y ninguna de las dos versiones medía lo que decía (ver unidad
70). El rendimiento percibido de las listas largas queda **NOT_PROVEN**.

³ **error.** Las 22 rutas con sesión de médico, medidas contra la caída **total** del acceso a datos:
todas dicen «No pudimos cargar tu consultorio · Tus datos están a salvo en el
servidor» y ninguna ofrece dar de alta un consultorio a quien ya lo tiene. Lo
resuelve una sola guarda global (unidad 65), y por eso las 18 que faltaban
salieron limpias sin tocar código. El escenario **parcial** —el consultorio carga
y falla una consulta suelta— es otro, y sólo está medido en `/calendario`
(unidad 73); ahí el aviso del modal de agendar queda **NOT_PROVEN en navegador**,
con su razón escrita en la cabecera del guion. `/mi/[token]` **sigue sin medir**:
es el portal del paciente y estos guiones entran con sesión de médico.

⁴ **empty.** Las 7 que faltaban se midieron el 30-ago (unidad 74). Cinco dicen su
vacío. Las otras dos —`/calendario` y `/configuracion`— las acusó el clasificador
y **son falsos positivos**, comprobado mirando la captura: `/configuracion` es un
formulario, donde «vacío» no es un estado que exista, y la rejilla del calendario
se explica sola con «Nueva cita» a la vista. Se dejan como están, dicho aquí para
que nadie las «arregle» dentro de seis meses. `/consulta` y `/expediente` siguen
sin medir: piden un paciente, y un consultorio de cero no tiene ninguno.

## Las dos columnas sin medir, y por qué

- **hierarchy** — se intentó con una razón «mayor texto ÷ segundo» y **el número
  engañaba**: marcaba `/citas` como plana cuando lo que pasa es que su contenido
  —los nombres de los pacientes— pesa casi tanto como su cabecera, que es lo
  correcto en una agenda. Se descartó la métrica en vez de perseguirla. Sin
  sustituto, queda sin medir.
- **benchmark quality** — comparar contra una referencia externa es un juicio, y
  este carril sólo escribe lo que puede volver a medir.

## Y una tercera que NO es una decisión, sino un límite del entorno

- **WebKit** — `BLOCKED_EXTERNAL`. Las 69 combinaciones, los diez arneses y todo
  lo demás están medidos en **Chromium**, porque es el único navegador instalado
  en esta caja (`/opt/pw-browsers/`) y el entorno prohíbe `playwright install`.
  El encargo lo pide por su nombre; se registra sin medir, y no se disfraza de
  medido.

## Los diez guiones, para volver a correrlo

```bash
npm run arnes:trinquete-interfaz   # axe + desborde, 69 combinaciones
npm run arnes:foco-visible         # ¿se ve dónde está el foco? 45 campos
npm run arnes:acuse-puntero        # estaticidad: controles que no acusan
npm run arnes:nada-tapa            # nada flotante tapa un control
npm run arnes:estado-de-carga      # el hueco dice que está cargando
npm run arnes:caida-de-datos       # una caída no borra el consultorio
npm run arnes:caida-parcial        # una caída parcial no es un día libre
npm run arnes:cita-fuera-de-hora   # ninguna cita se queda fuera de la rejilla
npm run arnes:dialogos-teclado     # el foco entra, Escape cierra, el foco vuelve
npm run arnes:hoy-del-consultorio  # la agenda abre anclada en el día del consultorio
npm run arnes:consultorio-vacio    # el estado vacío, con un consultorio de cero
npm run arnes:texto-largo          # el texto largo cabe y el campo lo enseña
npm run arnes:listas-largas        # 250 pacientes y 90 citas, en su propio consultorio
npm run arnes:tema-claro           # axe y foco en el OTRO tema, que nadie miraba
```

Todos exigen el servidor del arnés construido con la configuración del arnés, y
todos avisan con palabras cuando no lo está — porque eso ya costó nueve tropiezos.
