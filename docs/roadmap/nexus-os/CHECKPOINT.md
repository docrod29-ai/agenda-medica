# Nexus OS — dónde vamos

> **En 30 segundos.**
> **Van 9 de 68** unidades cerradas del todo. Hoy se cerró la parte de software de **E0-10**
> (las pantallas que nadie debe poder meter en un marco ajeno + el interruptor de la política de
> seguridad), la segunda unidad que queda «cerrada en software, esperando a usted».
> Lo más valioso de hoy **no fue código nuevo: fue destapar una mentira nuestra**. El vigilante de
> la política *decía* cazar los tres agujeros y sólo cazaba dos: la **sala de videoconsulta** recibe
> su dirección en el momento, así que el nombre del proveedor **no está escrito en el código** y
> ninguna búsqueda de texto podía verlo. Comprobado a la mala: **borrar el permiso de la
> videoconsulta dejaba todo en verde** y la llamada se habría quedado en negro el día que se apriete
> la política. Ya no: hay un registro explícito de esos marcos y **borrarlo pone el CI en rojo**
> (reproducido, no supuesto).
> Y se cerró un hueco que teníamos delante: **la pantalla de entrada (`/login`) se podía meter en un
> marco invisible** — el truco clásico para robar contraseñas. Ya no se puede.
> **LO ÚNICO QUE URGE DE USTED SIGUE SIENDO `E0-12-D3`.** Es una línea, y hasta que la conteste
> **nada de esta rama debe desplegarse**.
> **La siguiente unidad es E0-12** (cerrar el falso «INTEGRIDAD ALTERADA»), porque es la de mayor
> riesgo — aunque la parte final la decide usted.

Última corrida: `2026-07-30T05:30Z` · `tsc` verde (0 errores) ·
**2 809 tests verdes** · `build` verde **en los dos modos** de la política · rama
`nexus-os/sesion-2026-07-29` · `unidadEnCurso: null` (nada a medio hacer sin registrar).

---

## ⚠️ AVISO QUE SIGUE VIGENTE: la rama está pusheada y trae la regresión del sello

Este documento decía durante días **«nada desplegado, sin `push`»**. **La segunda mitad no es
cierta**: otra sesión —la de la receta (fecha de nacimiento + formulario corto)— **pusheó la
rama**, y con ella se fue el commit `3c09a0d`, **el que trae la regresión del sello de las notas**.

**Lo que se puede afirmar mirando el repositorio:**

- El commit `3c09a0d` (E0-12) está en la historia de esta rama.
- **`main` NO lo contiene.** El sello nuevo no está mergeado a la rama principal.
- `HASH_VERSION = 3` está en el árbol: **cualquier despliegue de esta rama hace que sus notas
  nuevas nazcan con el sello nuevo** — y con el falso «alterada».
- Subir el Service Worker es el **ritual de despliegue** de este repo, y su bitácora atribuye
  versiones a unidades de este mismo programa.

**Lo que NO puedo afirmar desde aquí:** si esas versiones **salieron a producción**. No despliego
ni consulto producción (regla 6).

**Lo que necesito de usted, y es un sí/no:** ¿el despliegue de v707/v708 salió de esta rama?
- **Si salió:** `E0-12-D3` deja de ser una decisión de merge y es **urgente**.
- **Si no salió:** `E0-12-D3` sigue siendo un bloqueo de merge, sin urgencia clínica.

---

## Lo que necesita su decisión, por urgencia

| # | Decisión | Por qué importa |
|---|---|---|
| **1** | **`E0-12-D3`.** El sello nuevo de sus notas marca «ALTERADA» una nota que **nadie alteró**. Tres arreglos posibles, los tres tocan cómo se guarda y se firma: **(a)** que al guardar se borre de verdad el campo que quedó vacío · **(b)** guardar la nota completa en vez de por partes · **(c)** guardar «vacío» explícito en vez de «no existe». | **Bloquea el despliegue de toda la rama.** Camino real, de un clic: usted dicta, el sistema autoguarda el dictado, usted **borra el texto del dictado** y firma → la nota sale con la alarma roja medicolegal sin que nadie la tocara. **Salida de emergencia si necesita mergear ya:** devolver el sello a la versión 2 (una línea) y dejar el nuevo congelado. |
| **2** | **`E0-07-Q1`** — ¿la enfermería de su UCI usa el copiloto y el dictado del expediente, o sólo el médico? | Es el hueco de seguridad más grande que queda abierto, y ahora es **lo único** que separa a E0-07 de estar cerrada del todo: hoy un miembro con rol `laboratorio` o `farmacia` puede pedirle al servidor una nota clínica redactada. El candado está escrito, probado y **atado al código**; falta que usted diga a quién deja fuera. Gobierna 16 puertas. |
| **3** | **`E0-07-Q7`, `E0-07-Q6`, `E0-07-Q3`, `E0-07-Q4`, `E0-07-Q5`, `E0-07-Q2`** — quién agenda citas, quién manda WhatsApp, quién ve pagos, quién entra a la sala de teleconsulta, quién lista los correos del equipo, quién descarga CFDI. | Gobiernan las otras 12 puertas que hoy siguen abiertas a «cualquiera del consultorio». **Ninguna es criterio clínico**: es quién en su consultorio puede hacer qué. Un «no» mal puesto en `appointments` se lee como «la app se rompió», así que no se activa nada sin su palabra. |
| **4** | **`E0-08-Q2`** — ¿se instala Java en su Mac para correr **una vez** la prueba de aislamiento entre clínicas, o se demuestra en GitHub al abrir el primer PR? | Es lo único que separa a esa unidad de estar cerrada: 1 120 intentos de que una clínica lea a otra, escritos y **jamás ejecutados** por falta de Java. |
| 5 | `E0-07-D8` (¿se blinda el valor del puesto al aceptar una invitación? toca el alta de miembros) · `E0-06-D1` (alergias en recepción) · `E0-09-Q5` (corregir signos anexando) · `E0-10-D3/D4/D6/D7/D8` (desplegar + cuenta de prueba + ¿`/registro` no-embebible? + ¿rediseñar cabeceras? + **¿funciona hoy el vídeo de la teleconsulta?**) · `E0-11` (5 min en GitHub) · `E1-02-Q6/Q7` · `E2-02-ALCANCE` · `E0-02-Q3` · `E0-04-Q1/Q2` · `E0-01-D1` · `E0-05` (visto bueno para desplegar) · `E0-14` (REG-014) | Las de siempre, con su «por qué» una por una en `estado.json` → `decisionesPendientesDelMedico` y `necesitaValidacionDelDr`. |

---

## El tablero

| Unidad | Qué es | Estado |
|---|---|---|
| E0-01 | Certificado de receta firmado con identidad derivada | ✅ cerrada |
| E0-02 | Invariantes de dosis pediátrica (property-based) | ✅ cerrada |
| E0-03 | Clinical Engine Registry + trinquete de ADRs | ✅ cerrada |
| E0-04 | Un número clínico ya no puede viajar sin su unidad | ✅ cerrada |
| E0-05 | Los motores clínicos ya no aceptan números sin unidad | ✅ cerrada — espera su visto bueno para desplegar |
| E0-14 | Firma aislada · cobro sellado · nota nace borrador | ✅ cerrada (única con reglas desplegadas) |
| E0-15 | Antibiograma: 4 decisiones clínicas suyas implementadas | ✅ cerrada |
| E1-01 | Un hecho clínico no existe sin unidad y sin procedencia | ✅ cerrada |
| E2-01 | Una afirmación no existe sin el fragmento que la respalda | ✅ cerrada |
| E0-07 | Cada puerta dice qué permiso exige | 🟢 cerrada en software — el vigilante compara la llave real con la declarada, puerta y verbo por verbo. Espera sus respuestas de política (Q1, Q3–Q7) para apretar las 28 puertas restantes. |
| **E0-12** | El sello de la nota firmada cubre TODA la nota | 🔴 la mejora funciona, pero **acusa en falso** a notas legítimas → `E0-12-D3`. **NO DESPLEGAR.** **SIGUIENTE UNIDAD.** |
| E0-08 | Que una clínica no vea a otra: probado empujando la puerta | 🟡 la prueba existe y **nunca se ha corrido**: falta Java → `E0-08-Q2` |
| E0-06 | Recepción no debe ver el expediente | 🟡 agujero de la API cerrado; mudar las alergias espera `E0-06-D1` |
| E0-09 | El registro del hospital no se edita: se corrige anexando | 🟡 espera una línea suya (`E0-09-Q5`) |
| **E0-10** | **Iframes bloqueados · interruptor de seguridad** | 🟢 **CERRADA HOY en software** — el vigilante ya caza los tres agujeros (antes dos), `/login` deja de ser embebible y hay una prueba sobre el **artefacto real** del build. **Sale de la cola:** lo que falta es desplegar, correr la matriz de pruebas de navegador y decir sí/no al apretón (`E0-10-D3`). |
| E0-11 | El CI protege los invariantes clínicos | 🟡 código listo — espera 5 min suyos en GitHub |
| E1-02 | «Creatinina», «Cr» y «creatinina sérica» son el mismo dato | 🔴 falta 1 test (software) + sus respuestas |
| E2-02 | La búsqueda de evidencia se arma por partes | 🔴 el módulo es correcto y **no lo usa nadie**: falta cablearlo |

**9 cerradas del todo · 2 cerradas en software y esperando a usted (E0-07 y E0-10) ·
6 a medias con código ya guardado en la rama · 51 sin empezar.**
Ninguna de las que están a medias hay que rehacerla desde cero: a todas les falta **cerrar**.

---

## Qué pasó en esta corrida, en español

### E0-10 — el vigilante de la política ya no se sobrevende

**Cuál era el problema.** El archivo que vigila la política de seguridad **afirmaba por escrito**
haber cazado los tres agujeros que había antes de poder apretarla. Era falso en uno: la **sala de
videoconsulta** se abre con una dirección que llega **en el momento** (la crea el proveedor cuando
empieza la llamada), así que el nombre del proveedor **no aparece en el código** y ninguna búsqueda
de texto podía encontrarlo. Se comprobó a la mala: **borrando el permiso de la videoconsulta de la
política, las 19 pruebas seguían en verde**. El día que se apriete la política, la llamada se
queda en negro y el CI no habría dicho nada. Una red de seguridad que se sobrevende es peor que no
tenerla.

**Qué se hizo.**

1. **Los marcos que reciben su dirección en el momento ahora se declaran uno por uno** (archivo,
   proveedor y por qué), y la prueba exige que la política los permita. Además hay un **trinquete**:
   si mañana alguien mete otro marco de un tercero sin declararlo, el CI se pone rojo. Los dos
   sabotajes correspondientes se ejecutaron: **los dos salen rojos ahora**.
2. **La pantalla de entrada (`/login`) deja de ser embebible.** Era el hueco clásico de robo de
   contraseñas —meter su pantalla de acceso en un marco invisible— y estaba abierto justo en la
   unidad cuyo objetivo es cerrarlo. Es **el único cambio de comportamiento** de hoy, y se revierte
   borrando una línea. No hay nadie que la embeba a propósito: el único marco hacia dentro de la app
   es el widget de citas que su web puede incrustar, y ése apunta a otra pantalla.
3. **Se añadió una prueba sobre el archivo que el servidor consume de verdad** (el resultado del
   build), no sólo sobre la intención escrita en el código. Si no hay build, la prueba se declara
   **saltada** con el comando exacto: no se inventa un verde.
4. **Se acotó el único riesgo que quedaba sin medir**: la regla «gana la última cabecera» está leída
   del servidor de desarrollo, no del proxy que sirve producción. Si ese proxy acumulara en vez de
   reemplazar, sólo se verían afectadas **tres** direcciones (la portada, el registro y
   configuración) y el síntoma sería visible —el Pixel deja de medir y el alta de WhatsApp no
   carga—, nunca silencioso. Esas tres quedan **congeladas** en la prueba, y el runbook estrena un
   «paso 0»: un comando de una línea contra un despliegue de prueba para saber cuál de las dos
   semánticas rige.

**Una corrección de honestidad.** El runbook decía «57/57 en verde con la política apretada, medido
el 29 de julio». **Esa medición no consta**: correr el navegador automatizado está prohibido para el
agente (procesos que no terminan solos han tumbado corridas enteras). Queda retractado en el propio
documento. Lo que **sí** está ejecutado hoy: el vigilante (23 pruebas) y la prueba del artefacto del
build (4 pruebas, en los dos modos).

**Riesgo:** cuatro de los cinco cambios son pruebas y documentación — no pueden romper nada. El
quinto es `/login` no-embebible. Y el interruptor **sigue en modo observación por defecto**: nada
empieza a bloquearse sin que usted ponga la variable.

**Qué falta, y es suyo.** (a) **Desplegar** — el cierre de los marcos está en el código y no en
producción; (b) **una corrida de la matriz de navegador**, que ahora es **un comando** y no necesita
desplegar nada: `npm run build && npm run e2e:seguridad` (y la variante `:enforce` para probarlo con
la política apretada); (c) `E0-10-D3`: decir sí/no a apretar la política en Vercel. Se abrieron tres
preguntas nuevas, ninguna clínica: `D-6` (¿`/registro` también deja de ser embebible?), `D-7`
(¿rediseñar las cabeceras para que ninguna dirección reciba dos políticas?) y **`D-8`: ¿funciona hoy
el vídeo de la teleconsulta en producción?** — porque la cabecera global cierra la cámara para todo
el sitio y eso no se puede volver a conceder desde dentro del marco. Si el vídeo no funciona, es un
fallo **vivo** anterior a esta unidad.

## 👉 Cómo retomar (para la próxima sesión, mía o de otro)

1. **Leer `estado.json`**, no este archivo: es la fuente de verdad. `unidadEnCurso` está en `null`.
2. **Lo primero: `E0-12`** — el PLAN de las tres salidas con su coste y su riesgo, más el test de
   round-trip que falta, con la semántica de guardado **real** (merge sobre el borrador). **No
   implementar el arreglo sin la decisión `E0-12-D3`:** toca el flujo de firma (regla 5). Y corregir
   la sobreafirmación del acta y de `REG-059`, que sí es ejecutable.
3. **Después: `E1-02`** (retirar o dar fuente a los sinónimos de signos vitales sin respaldo, más
   el test que **deriva** los sinónimos de laboratorio de los patrones de los analitos) y **`E2-02`**
   (cablear el extractor PICO a las dos rutas de evidencia, previa decisión de alcance).
4. **`E0-07` y `E0-10` no se reintentan.** Su parte de software está cerrada y verificada; lo que
   queda son respuestas y acciones del Dr. En E0-07 el lote pendiente es mecánico (cambiar
   `verificarModuloIA` por `verificarModuloYCapacidad` en las 16 rutas de IA). En E0-10 **no queda
   software**: falta desplegar, correr la matriz (`npm run e2e:seguridad`) y decidir `D-3`. Tres
   pasadas anteriores se gastaron re-diseñando lo que ya estaba implementado; por eso ahora tiene
   acta en disco (`RESULTADO.json`, estado `necesita_validacion`) y `reintentar: false`.
5. Si el Dr. prefiere terreno nuevo: **E4-01 «Contrato del Safety Kernel»** (riesgo medio,
   aceptación autocontenida).

**Convención vigente:** una unidad devuelta a la cola pierde su `RESULTADO.json` (se renombra a
`RESULTADO.parcial.json`, para no perder la evidencia) y su veredicto queda en `VERIFICACION.json`.
E0-07 vuelve a tener `RESULTADO.json`; su `RESULTADO.parcial.json` y su `VERIFICACION.json` se
conservan como historia de por qué se devolvió. **E0-10 también vuelve a tener `RESULTADO.json`,
pero con estado `necesita_validacion` y la razón escrita dentro**: no cuenta como cerrada del todo y
**no debe entrar en `completadas`** (ése fue el error V-5 que encontró su verificación). El acta
existe para que la unidad deje de volver a la cola, porque su software está cerrado y lo que falta
lo prohíben las reglas de despliegue y de procesos.

---

## Deuda técnica y residuales anotados (para no perderlos)

- **Una regresión medicolegal vive en la rama (E0-12).** `3c09a0d` está commiteado y **no debe
  desplegarse** hasta cerrar el falso «alterada». Es el único bloqueo duro de merge.
- **28 puertas siguen abiertas a cualquiera del consultorio (E0-07), por decisión pendiente.** Ya
  **no** es un problema de software: la declaración está atada al código, cada pendiente dice qué
  decisión espera y hay pruebas que lo vigilan. Lo que falta son sus respuestas (Q1, Q3–Q7).
- **El blindaje del puesto al aceptar una invitación sigue abierto (E0-07, P2-2).** Hoy quien puede
  invitar podría escribir un puesto que la app no ofrece. Severidad contenida (quien invita ya tiene
  esos permisos), y el arreglo toca el **alta de miembros**, así que se entregó como plan → `E0-07-D8`.
  La mitad de reglas de base de datos exige un despliegue de reglas, que el agente no hace.
- **~190 de las 1 120 pruebas de aislamiento son tautológicas (E0-08).** Y bajo `clinics/**` sólo se
  prueba leer *un documento*, nunca **enumerar** una colección cross-tenant.
- **La prueba de aislamiento nunca se ha ejecutado.** Hasta esa primera corrida, el aislamiento
  entre clínicas está **argumentado**, no **demostrado**.
- **Lo que esa prueba NO cubrirá aunque se ponga verde:** permisos campo por campo (eso es E0-09),
  permisos de archivos (fotos, PDFs), y las rutas del servidor (no pasan por esas reglas, por
  diseño — y por eso existe el vigilante de E0-07).
- **El sello de la FIRMA no cubre su nombre ni su cédula.** Son dos sellos: el del contenido (que
  desde E0-12 cubre toda la nota) y el de la firma. Cerrarlo entra al flujo de firma y a la
  impresión → `E0-12-Q2`.
- **Las notas más antiguas (sello versión 1) siguen sin poder re-verificarse.** Salen como «formato
  anterior», que **no** significa alteradas.
- **`hospital` e `infectologia` entraron al sello sin que hoy los escriba nadie.** Blindaje
  preventivo, probado con datos ficticios.
- **Las alergias, los antecedentes y la valoración del inmunocomprometido siguen dentro de la ficha
  del paciente.** Mientras estén ahí, cualquier miembro del consultorio los lee. La mudanza está
  diseñada y espera `E0-06-D1`.
- **8 puestos en el tipo, 6 asignables desde la app** («recepción» y «facturación» existen en la
  matriz y nadie puede tenerlos). Hay una prueba que lo vigila → `E0-07-Q2`.
- **El arreglo del clickjacking está en el código y no en producción.** Son 22 pantallas con datos
  clínicos **más la pantalla de entrada (`/login`)**, cerrada hoy. Basta desplegar — **subiendo la
  versión del Service Worker**.
- **La política de seguridad sigue permitiendo `unsafe-inline`/`unsafe-eval`.** Quitarlo exige
  firmar cada script en cada petición; su riesgo típico es *pantalla en blanco*. Unidad aparte.
- **Ninguna prueba automática entra a la zona con sesión** (expediente, nota, receta, farmacia). Es
  el punto ciego más grande del proyecto y lo que impide afirmar «apretar la política no rompe
  nada» más allá del camino público → `E0-10-D4`.
- **La matriz de pruebas de navegador nunca se ha ejecutado** (ni contra producción ni en local).
  Ahora es un solo comando y no exige desplegar; hasta que corra, «pruebas de seguridad en verde»
  es una promesa, no un hecho.
- **La cámara está cerrada para todo el sitio mientras la videoconsulta la pide** (`camera=()` vs
  el marco de Daily). Es anterior a E0-10 y no se toca de oficio: aflojar una cabecera de seguridad
  merece unidad aparte → `E0-10-D8`, que empieza por una observación suya en producción.
- **El grafo no puede expresar 14 de los 35 datos que necesita** *(bloquea E1-03)*. Faltan lpm, rpm,
  °C, cm, kg/m², «puntos» (Glasgow, dolor), U/L, 10³/µL, µUI/mL. «120/80» son **dos datos, no uno**.
- **El motor de dosis no habla el idioma del principio 3** de sus decisiones clínicas: devuelve
  alertas, no `PASS | WARN | BLOCK | UNKNOWN | N/A`.
- **Las fórmulas usan números pelados POR DENTRO.** El tipo protege entrada y salida de cada motor,
  no los pasos intermedios.
- **El rango habitual de cada fármaco de infusión sigue siendo un par de números sin unidad.**
  Candidato a «E0-05-bis».
- **El conversor de PDF a imagen se descarga de `unpkg.com`** cada vez que usted sube un
  laboratorio. Se puede guardar una copia dentro de la app: es un sí/no.
- **487 paquetes de desarrollo con 32 avisos de seguridad conocidos**, todos del árbol de las
  herramientas de Firebase. Son **de taller**: no viajan a su app ni al servidor.
- **`RETOMAR-AQUI.md` está viejo.** La fuente de verdad son `estado.json` y este archivo.
- **Los comentarios que afirman cobertura no valen; el test que la deriva de la fuente, sí.** Es la
  lección de los sinónimos inventados `Hb`/`BT`, de la lista de campos sellados escrita a mano
  (E0-12) y del registro de permisos que nadie comparaba con el código (E0-07). Las tres veces el
  arreglo fue el mismo: **derivar el dato del código, no escribirlo al lado**.
