# Nexus OS — dónde vamos

> **En 30 segundos.**
> **Van 9 de 68** unidades cerradas — y sí, **ayer decía 10**: hoy una que estaba contada como
> hecha **se devolvió a la cola**, porque traía un defecto que nadie había visto.
> **Hoy se intentaron 3 unidades y se cerraron 0.** Las tres tenían los tres controles de máquina
> en verde (`tsc`, 2 663 tests, `build`) y las tres **no pasaron la revisión adversarial** — el
> segundo par de ojos cuyo único trabajo es tumbar lo que el primero declaró bueno. Hoy se ganó
> el sueldo.
> **LA SIGUIENTE UNIDAD ES E0-07** (cerrar el guardián de permisos): software puro, no necesita
> nada de usted, y además **recupera una protección que se perdió**.
> **LO ÚNICO QUE URGE DE USTED: la decisión `E0-12-D3`.** Es una línea, y hasta que la conteste
> **nada de esta rama debe desplegarse**.
Última corrida: `2026-07-29T23:35Z` · `tsc` verde (re-ejecutado hoy, 0 errores) ·
**2 663 tests verdes** (medición al cerrar el lote) · rama `nexus-os/sesion-2026-07-29` ·
`unidadEnCurso: null` (nada a medio hacer sin registrar).

---

## ⚠️ AVISO QUE CORRIGE LO QUE ESTE ARCHIVO DECÍA AYER

Este documento venía repitiendo **«nada desplegado, sin `push`»**. **La segunda mitad ya no es
cierta**, y lo descubrí al cerrar la corrida: otra sesión —la que trabajó hoy en la receta
(fecha de nacimiento + formulario corto)— **pusheó la rama al remoto**, y con ella se fue el
commit `3c09a0d`, **el que trae la regresión del sello de las notas**.

**Lo que se puede afirmar mirando el repositorio:**

- La rama `nexus-os/sesion-2026-07-29` **está pusheada** e incluye `3c09a0d` (E0-12).
- **`main` NO lo contiene.** El sello nuevo no está mergeado a la rama principal.
- `HASH_VERSION = 3` está en el árbol y en la rama pusheada: **cualquier despliegue de esta rama
  hace que sus notas nuevas nazcan con el sello nuevo** — y con el falso «alterada».
- `public/sw.js` va en **`nexusmed-v708`**, y su bitácora atribuye versiones a unidades de este
  mismo programa (v700 = E0-02, v701–703 = E0-15, v704–705 = REG-014/015/017, v706 = E0-03,
  v707–708 = receta). Subir el Service Worker es el **ritual de despliegue** de este repo.

**Lo que NO puedo afirmar desde aquí:** si v707/v708 **salieron a producción**. No despliego ni
consulto producción (regla 6), así que no voy a decirle «está en producción» ni «no está».

**Lo que necesito de usted, y es un sí/no:** ¿el despliegue de v707/v708 salió de esta rama?
- **Si salió:** `E0-12-D3` deja de ser una decisión de merge y es **urgente** — el falso
  «INTEGRIDAD ALTERADA» estaría vivo para las notas nuevas. La salida de una línea (devolver el
  sello a la versión 2) existe justo para este caso.
- **Si no salió:** `E0-12-D3` sigue siendo un bloqueo de merge, sin urgencia clínica.

*Nota de trazabilidad:* esa misma sesión hizo commit **barriendo con `git add -A`**, así que mi
reconciliación de hoy (estado.json + los `RESULTADO.parcial.json` + los `VERIFICACION.json`)
viajó **dentro de sus commits** `19425b7` y `c8e3cbf`. Nada se perdió; sólo no busque un commit
propio de reconciliación, porque no existe.

---

## Lo que necesita su decisión, por urgencia

| # | Decisión | Por qué importa |
|---|---|---|
| **1** | **`E0-12-D3` — NUEVA.** El sello nuevo de sus notas marca «ALTERADA» una nota que **nadie alteró**. Tres arreglos posibles, los tres tocan cómo se guarda y se firma: **(a)** que al guardar se borre de verdad el campo que quedó vacío · **(b)** guardar la nota completa en vez de por partes · **(c)** guardar «vacío» explícito en vez de «no existe». | **Bloquea el despliegue de toda la rama.** Camino real, de un clic: usted dicta, el sistema autoguarda el dictado, usted **borra el texto del dictado** y firma → la nota sale con la alarma roja medicolegal sin que nadie la tocara. Reproducido con el código real en 5 campos. **Salida de emergencia si necesita mergear ya:** devolver el sello a la versión 2 (una línea) y dejar el nuevo congelado. |
| **2** | **`E0-07-Q1`** — ¿la enfermería de su UCI usa el copiloto y el dictado, o sólo el médico? | Es el hueco de seguridad más grande abierto: hoy un miembro con rol `laboratorio` o `farmacia` puede pedirle al servidor una nota clínica redactada. El candado ya está escrito y probado; **falta que usted diga a quién deja fuera.** |
| **3** | **`E0-08-Q2`** — ¿se instala Java en su Mac para correr **una vez** la prueba de aislamiento entre clínicas, o se demuestra en GitHub al abrir el primer PR? | Es lo único que separa a esa unidad de estar cerrada: 1 120 intentos de que una clínica lea a otra, escritos y **jamás ejecutados** por falta de Java. |
| 4 | `E0-06-D1` (captura de alergias en recepción) · `E0-09-Q5` (corregir signos anexando) · `E0-10-D3/D4` (desplegar + cuenta de prueba) · `E0-11` (5 min en GitHub) · `E1-02-Q6/Q7` · `E2-02-ALCANCE` · `E0-02-Q3` · `E0-04-Q1/Q2` · `E0-01-D1` · `E0-05` (visto bueno para desplegar) · `E0-14` (REG-014) | Las de siempre, con su «por qué» una por una en `estado.json` → `decisionesPendientesDelMedico` y `necesitaValidacionDelDr`. |

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
| **E0-12** | El sello de la nota firmada cubre TODA la nota | 🔴 **DEVUELTA HOY** — la mejora funciona, pero **acusa en falso** a notas legítimas → `E0-12-D3`. **NO DESPLEGAR.** |
| **E0-07** | Cada puerta dice qué permiso exige | 🟡 **DEVUELTA HOY** — el guardián comprueba que se llame al candado, no **cuál** → **SIGUIENTE UNIDAD** |
| **E0-08** | Que una clínica no vea a otra: probado empujando la puerta | 🟡 **DEVUELTA HOY** (2ª vez) — la prueba existe y **nunca se ha corrido**: falta Java → `E0-08-Q2` |
| E0-06 | Recepción no debe ver el expediente | 🟡 agujero de la API cerrado; mudar las alergias espera `E0-06-D1` |
| E0-09 | El registro del hospital no se edita: se corrige anexando | 🟡 espera una línea suya (`E0-09-Q5`) |
| E0-10 | Iframes bloqueados · interruptor de seguridad | 🔴 espera un despliegue suyo + cuenta de prueba |
| E0-11 | El CI protege los invariantes clínicos | 🟡 código listo — espera 5 min suyos en GitHub |
| E1-02 | «Creatinina», «Cr» y «creatinina sérica» son el mismo dato | 🔴 falta 1 test (software) + sus respuestas |
| E2-02 | La búsqueda de evidencia se arma por partes | 🔴 el módulo es correcto y **no lo usa nadie**: falta cablearlo |

**9 cerradas · 8 a medias con código ya guardado en la rama · 51 sin empezar.**
Ninguna de las 8 hay que rehacerla desde cero: a todas les falta **cerrar**, no construir.

---

## Qué pasó hoy, en español

### 1. E0-12 — el sello nuevo de sus notas acusa en falso

**Lo bueno, y es mucho.** El candado antifalsificación de sus notas firmadas pasó de cubrir
**10 de los 26 campos** a cubrir **todo el contenido firmable**. Antes se podía cambiar, en una
nota **ya firmada**, los puntajes de una valoración preoperatoria, el día de antibiótico, el
resumen ejecutivo, la transcripción del dictado, con qué modelo de IA se redactó y si usted la
revisó, y hasta su cédula profesional — y el documento seguía diciendo «integridad verificada».
Eso quedó cerrado, y el revisor lo comprobó **campo por campo y por su cuenta**, sin fiarse de
los tests: 57 de 68 puntos de la nota ahora se detectan, y los 11 que no son exactamente los
declarados con motivo. También comprobó, ejecutando el algoritmo viejo por separado, que
**ninguna de sus notas ya firmadas cambia de estado**.

**Lo malo, y por eso se devuelve.** El sello nuevo también sella campos que a veces quedan
**vacíos**: el dictado, los estudios pedidos, el diálogo separado por voces. Y cuando uno de
esos campos se vacía, el sistema **no lo borra de la base de datos**: guarda lo demás y deja el
valor viejo ahí. Entonces la huella se calcula sin el campo y el documento se queda con él: no
cuadran, y la pantalla saca la **alarma roja** sobre una nota que nadie alteró.

**Por qué los tests no lo vieron.** El test simulaba el guardado como si la nota se escribiera
**completa y de cero**; el flujo real de firma la escribe **por partes, encima del borrador**.
Dos formas de guardar que parecen equivalentes y no lo son. **Ésa es la lección del día**, y ya
quedó escrita en `estado.json`: si una unidad toca el guardado, el test tiene que guardar
**igual** que la app, no «parecido».

**Riesgo hoy:** cero **si** esta rama no se ha desplegado — y eso es justo lo que hay que
confirmar (vea el aviso de arriba). En `main` no está. Nada de esta rama debe salir a producción
hasta `E0-12-D3`.

### 2. E0-07 — el registro de permisos era documentación, no candado

Se construyó el catálogo de permisos (14 capacidades × 8 roles) y **las 74 puertas** de la API
ya dicen qué permiso exigen; eso está bien hecho y comprobado (las 74 están, sin sobras ni
faltantes). **El problema:** el vigilante automático sólo comprueba que la puerta **llame al
candado**, no **qué llave pide**. El revisor cambió la llave de tres puertas por una equivocada y
**los 2 663 tests siguieron en verde**. El registro *dice* la verdad hoy, pero nada impide que
mañana deje de decirla.

Y algo peor: esta unidad **quitó sin querer** una protección que ya existía — el candado de la
sala de teleconsulta estaba fijado *en el código* y ahora sólo se fija *en el papel*. Es una de
las dos fallas graves históricas que ese vigilante cuida, así que al reintentarla hay que
**restaurarlo**, no sólo añadir cobertura nueva.

**Nadie perdió acceso a nada:** las 21 puertas migradas son justo las donde no cambia quién
entra. Las 26 que sí dejarían a alguien fuera están **declaradas y apagadas**, esperando sus
respuestas (Q1, Q3–Q7).

### 3. E0-08 — la prueba de que una clínica no ve a otra sigue sin ejecutarse

Se escribieron **1 120 intentos** de que una clínica lea o escriba datos de otra, contra el
motor de reglas **real** (no leyendo el archivo: preguntándole al motor). Está en el CI, tipado,
y no rompió nada. **Pero jamás se ha corrido:** el emulador de Firestore necesita Java y esta Mac
no lo tiene — el revisor lo verificó él mismo. La aceptación exige la palabra **demostrado**, así
que firmarla habría sido justo la mentira que la unidad existe para evitar. El implementador
**no** la firmó, y eso estuvo bien.

Se le encontró además una franqueza pendiente: **unas 190 de esas 1 120 pruebas no distinguen
nada** — son colecciones cerradas para *todo* cliente, así que saldrían verdes incluso con el
aislamiento roto. El titular «1 120 intentos, todos denegados» es cierto; lo que falta es
sensibilidad, no verdad. Anotado para arreglar (V-2 a V-5 en `estado.json`).

---

## 👉 Cómo retomar (para la próxima sesión, mía o de otro)

1. **Leer `estado.json`**, no este archivo: es la fuente de verdad. `unidadEnCurso` está en
   `null`.
2. **Lo primero: el PLAN de `E0-12-D3`** — las tres salidas con su coste y su riesgo — más el
   test de round-trip que falta, con la semántica de guardado **real** (merge sobre el borrador).
   **No implementar el arreglo sin la decisión:** toca el flujo de firma (regla 5).
3. **Después, la unidad: `E0-07`, reintento de CIERRE.** Alcance exacto en `estado.json` →
   `siguientesElegibles.recomendacionExplicita.alcanceExacto`. En resumen: que el vigilante
   **extraiga del archivo la llave real** que pide cada puerta y la compare con la declarada;
   control negativo obligatorio (romper una llave, verla roja, restaurarla); **restaurar** el
   candado en código de teleconsulta; `activacionPendiente` por método; y **no activar** ninguna
   de las 26 puertas que estrecharían acceso.
4. Escribir `unidades/E0-07/RESULTADO.json` **en el mismo commit** que el código, y retirar su
   `RESULTADO.parcial.json`.
5. Si el Dr. prefiere terreno nuevo: **E4-01 «Contrato del Safety Kernel»** (riesgo medio,
   aceptación autocontenida — no cae en la trampa que ya tumbó a E2-02 y a E0-10).

**Convención vigente:** una unidad devuelta a la cola pierde su `RESULTADO.json` (se renombra a
`RESULTADO.parcial.json`, para no perder la evidencia) y su veredicto queda en
`VERIFICACION.json`. Hoy se retiraron tres: E0-07, E0-08 y E0-12.

**Aviso:** el último commit de la rama, `07cefc9` (fecha de nacimiento en receta + formulario
corto de Consulta), es trabajo **ajeno** a este programa hecho en la misma rama. No cuenta como
avance de ninguna unidad y no hay que revertirlo.

---

## Deuda técnica y residuales anotados (para no perderlos)

- **🆕 Una regresión medicolegal vive en la rama (E0-12).** `3c09a0d` está commiteado y **no debe
  desplegarse** hasta cerrar el falso «alterada». Es el único bloqueo duro de merge.
- **🆕 El registro de permisos no es una garantía verificable (E0-07).** Declarar ≠ exigir. De las
  45 rutas con permiso declarado, sólo 17 lo **exigen**; 28 siguen con «cualquiera del
  consultorio». Todas están declaradas con su pregunta al lado, así que ninguna es un descuido
  silencioso.
- **🆕 ~190 de las 1 120 pruebas de aislamiento son tautológicas (E0-08).** Y bajo `clinics/**`
  sólo se prueba leer *un documento*, nunca **enumerar** una colección cross-tenant.
- **La prueba de aislamiento nunca se ha ejecutado.** Hasta esa primera corrida, el aislamiento
  entre clínicas está **argumentado**, no **demostrado**.
- **Lo que esa prueba NO cubrirá aunque se ponga verde:** permisos campo por campo (eso es
  E0-09), permisos de archivos (fotos, PDFs — necesitan otro simulador), y las rutas del servidor
  (no pasan por estas reglas, por diseño).
- **El sello de la FIRMA no cubre su nombre ni su cédula.** Son dos sellos: el del contenido (que
  desde E0-12 cubre toda la nota) y el de la firma. El bloque de firma queda cubierto **por
  rebote**, no por el hash. Cerrarlo entra al flujo de firma y a la impresión → `E0-12-Q2`.
- **Las notas más antiguas (sello versión 1) siguen sin poder re-verificarse.** No es cosa de
  E0-12: el algoritmo original dependía del orden en que la base devolvía los campos. Salen como
  «formato anterior», que **no** significa alteradas.
- **`hospital` e `infectologia` entraron al sello sin que hoy los escriba nadie.** Blindaje
  preventivo, probado con datos ficticios, no contra un flujo real.
- **Las alergias, los antecedentes y la valoración del inmunocomprometido siguen dentro de la
  ficha del paciente.** Mientras estén ahí, cualquier miembro del consultorio los lee y ninguna
  regla puede impedirlo. La mudanza está diseñada y espera `E0-06-D1`.
- **8 puestos en el tipo, 6 asignables desde la app** («recepción» y «facturación» existen en la
  matriz y nadie puede tenerlos). Por eso ampliar un permiso hacia ellos no le da acceso a nadie
  real. Hay una prueba que lo vigila.
- **El arreglo del clickjacking (22 pantallas) está en el código y no en producción.** No exige
  apretar la política de seguridad: basta desplegar — **subiendo la versión del Service Worker**.
- **La política de seguridad sigue permitiendo `unsafe-inline`/`unsafe-eval`.** Quitarlo exige
  firmar cada script en cada petición; su riesgo típico es *pantalla en blanco*. Unidad aparte.
- **Ninguna prueba automática entra a la zona con sesión** (expediente, nota, receta, farmacia).
  Es el punto ciego más grande del proyecto y lo que impide cerrar E0-10 → `E0-10-D4`.
- **El grafo no puede expresar 14 de los 35 datos que necesita** *(bloquea E1-03)*. Faltan las
  unidades más cotidianas: lpm, rpm, °C, cm, kg/m², «puntos» (Glasgow, dolor), U/L, 10³/µL,
  µUI/mL. «120/80» son **dos datos, no uno**. Hoy el comportamiento ya es seguro: un dato con
  unidad desconocida **se rechaza ruidosamente**.
- **El motor de dosis no habla el idioma del principio 3** de sus decisiones clínicas: devuelve
  alertas, no `PASS | WARN | BLOCK | UNKNOWN | N/A`. Funciona, pero hay que migrarlo.
- **Las fórmulas usan números pelados POR DENTRO.** El tipo protege entrada y salida de cada
  motor, no los pasos intermedios. Blindarlo exige álgebra de dimensiones: otra unidad.
- **El rango habitual de cada fármaco de infusión sigue siendo un par de números sin unidad.**
  Candidato a «E0-05-bis».
- **El conversor de PDF a imagen se descarga de `unpkg.com`** cada vez que usted sube un
  laboratorio. Se puede guardar una copia dentro de la app: es un sí/no.
- **487 paquetes de desarrollo con 32 avisos de seguridad conocidos**, todos del árbol de las
  herramientas de Firebase. Son **de taller**: no viajan a su app ni al servidor.
- **`RETOMAR-AQUI.md` está viejo** (habla de 2/68). La fuente de verdad son `estado.json` y este
  archivo.
- **Los comentarios que afirman cobertura no valen; el test que la deriva de la fuente, sí.** Es
  la lección de los sinónimos inventados `Hb`/`BT`, y hoy se repitió en dos formas nuevas: una
  lista de campos sellados escrita a mano (E0-12) y un registro de permisos que nadie compara con
  el código (E0-07).
