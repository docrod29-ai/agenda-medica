# Nexus OS — dónde vamos

> **En 30 segundos.**
> **Van 9 de 68** unidades cerradas del todo, **y hoy se cerró la parte de software de una décima**:
> **E0-07** (los permisos de cada puerta de la API), que ayer se había devuelto a la cola.
> El defecto era serio y quedó tapado: el vigilante automático comprobaba que la puerta
> **llamara al candado**, pero no **qué llave pedía**. Ahora extrae la llave real del código y la
> compara con la declarada, puerta por puerta **y verbo por verbo**. Los **cinco sabotajes** que
> el revisor había dejado pasar en verde **ahora salen rojos**, y se recuperó la protección que
> se había perdido sin querer (el candado en código de la sala de teleconsulta).
> **No se le quitó el acceso a nadie: no se modificó ni un archivo de la API.**
> **LO ÚNICO QUE URGE DE USTED SIGUE SIENDO `E0-12-D3`.** Es una línea, y hasta que la conteste
> **nada de esta rama debe desplegarse**.
> **La siguiente unidad es E0-12** (cerrar el falso «INTEGRIDAD ALTERADA»), porque es la de mayor
> riesgo — aunque la parte final la decide usted.

Última corrida: `2026-07-30T05:13Z` · `tsc` verde (0 errores) ·
**2 801 tests verdes** · `build` verde · rama `nexus-os/sesion-2026-07-29` ·
`unidadEnCurso: null` (nada a medio hacer sin registrar).

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
| 5 | `E0-07-D8` (¿se blinda el valor del puesto al aceptar una invitación? toca el alta de miembros) · `E0-06-D1` (alergias en recepción) · `E0-09-Q5` (corregir signos anexando) · `E0-10-D3/D4` (desplegar + cuenta de prueba) · `E0-11` (5 min en GitHub) · `E1-02-Q6/Q7` · `E2-02-ALCANCE` · `E0-02-Q3` · `E0-04-Q1/Q2` · `E0-01-D1` · `E0-05` (visto bueno para desplegar) · `E0-14` (REG-014) | Las de siempre, con su «por qué» una por una en `estado.json` → `decisionesPendientesDelMedico` y `necesitaValidacionDelDr`. |

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
| **E0-07** | **Cada puerta dice qué permiso exige** | 🟢 **CERRADA HOY en software** — el vigilante ya compara la llave real con la declarada, puerta y verbo por verbo. Sólo espera sus respuestas de política (Q1, Q3–Q7) para apretar las 28 puertas restantes. |
| **E0-12** | El sello de la nota firmada cubre TODA la nota | 🔴 la mejora funciona, pero **acusa en falso** a notas legítimas → `E0-12-D3`. **NO DESPLEGAR.** **SIGUIENTE UNIDAD.** |
| E0-08 | Que una clínica no vea a otra: probado empujando la puerta | 🟡 la prueba existe y **nunca se ha corrido**: falta Java → `E0-08-Q2` |
| E0-06 | Recepción no debe ver el expediente | 🟡 agujero de la API cerrado; mudar las alergias espera `E0-06-D1` |
| E0-09 | El registro del hospital no se edita: se corrige anexando | 🟡 espera una línea suya (`E0-09-Q5`) |
| E0-10 | Iframes bloqueados · interruptor de seguridad | 🔴 espera un despliegue suyo + cuenta de prueba |
| E0-11 | El CI protege los invariantes clínicos | 🟡 código listo — espera 5 min suyos en GitHub |
| E1-02 | «Creatinina», «Cr» y «creatinina sérica» son el mismo dato | 🔴 falta 1 test (software) + sus respuestas |
| E2-02 | La búsqueda de evidencia se arma por partes | 🔴 el módulo es correcto y **no lo usa nadie**: falta cablearlo |

**9 cerradas del todo · 1 cerrada en software y esperando sus respuestas (E0-07) ·
7 a medias con código ya guardado en la rama · 51 sin empezar.**
Ninguna de las que están a medias hay que rehacerla desde cero: a todas les falta **cerrar**.

---

## Qué pasó en esta corrida, en español

### E0-07 — el registro de permisos ya es un candado, no un cartel

**Cuál era el problema.** El catálogo de permisos (14 capacidades × 8 puestos) y las **74 puertas**
de la API declaradas estaban bien hechos: el revisor los reprodujo uno por uno y salieron exactos.
Lo que **no** estaba bien era el vigilante automático: comprobaba que la puerta **llamara al
candado**, no **qué llave pedía**. El revisor cambió la llave de tres puertas por una equivocada
—entre ellas el portal de facturación de Stripe, que quedaba abierto a los 8 puestos— y los
**2 663 tests siguieron en verde**. El registro *decía* la verdad, pero nada impedía que mañana
dejara de decirla.

**Qué se hizo.** Se escribió un lector propio (`analisis-estatico.ts`) que abre cada archivo de
puerta y saca tres cosas: **qué candado** se usa, **qué llave exacta** pide, y **dentro de qué
verbo** (consultar, guardar, borrar…). Con eso el vigilante ya no pregunta «¿hay candado?» sino
«¿la llave que corre es la que dice el registro?». Tres detalles que importan:

1. **La comprobación es por verbo, no por puerta.** Antes, en dos puertas con dos verbos, el
   «pendiente» de uno tapaba al otro: el verbo que **guarda las llaves de inteligencia artificial
   de su consultorio** podía volver a «cualquiera del consultorio» sin que nada se moviera. Ya no.
2. **Se recuperó una protección perdida.** El candado de la sala de teleconsulta estaba fijado *en
   el código* antes de esta unidad y había quedado fijado sólo *en el papel*. Es una de las dos
   fallas graves históricas que ese vigilante cuida. Está restaurado, y ahora sobre el argumento
   real, que es más fuerte que antes.
3. **El vigilante no puede pasar por vacío.** El modo de falla más traicionero de un lector así es
   que se rompa, no encuentre nada y todo salga verde. Hay un control que congela lo que tiene que
   encontrar (74 candados en 61 de las 74 puertas), y se comprobó rompiendo el lector a propósito:
   14 pruebas se ponen rojas de inmediato.

**Cómo sé que sirve, y no es fe.** Se repitieron **los cinco sabotajes exactos** que el revisor
había dejado pasar en verde: **los cinco salen rojos ahora**, con el mensaje diciendo qué llave
declara y qué llave corre. Se añadieron dos sabotajes propios (romper el lector; devolver a la
puerta del hospital su viejo mapa de puestos) y también salen rojos. Y —tan importante como lo
anterior— **dos controles al revés**: reordenar código legítimo **no** pone nada rojo. Un
vigilante que grita con todo no sirve de nada.

**Riesgo:** **no se modificó ni un archivo de la API.** Cero cambios en quién entra a dónde, cero
cambios en los mensajes de error, cero cambios en las reglas de la base de datos. Lo único nuevo
es un módulo que sólo usan las pruebas. Si el lector se equivocara, lo que pasa es que **se
detiene un commit**, no que se rompa algo para usted.

**Qué falta, y es suyo.** 28 puertas siguen abiertas a «cualquiera del consultorio» **en
ejecución**. Ninguna es un descuido: cada una declara qué permiso debería pedir, **dice por
escrito qué decisión suya espera**, y hay una prueba que verifica que el candado viejo sigue
puesto de verdad y otra que congela la lista. La más importante es `E0-07-Q1` (la enfermería de
UCI y el dictado): 16 de esas 28. Con sus respuestas, apretarlas es mecánico y ya está probado.

---

## 👉 Cómo retomar (para la próxima sesión, mía o de otro)

1. **Leer `estado.json`**, no este archivo: es la fuente de verdad. `unidadEnCurso` está en `null`.
2. **Lo primero: `E0-12`** — el PLAN de las tres salidas con su coste y su riesgo, más el test de
   round-trip que falta, con la semántica de guardado **real** (merge sobre el borrador). **No
   implementar el arreglo sin la decisión `E0-12-D3`:** toca el flujo de firma (regla 5). Y corregir
   la sobreafirmación del acta y de `REG-059`, que sí es ejecutable.
3. **Después: `E1-02`** (retirar o dar fuente a los sinónimos de signos vitales sin respaldo, más
   el test que **deriva** los sinónimos de laboratorio de los patrones de los analitos) y **`E2-02`**
   (cablear el extractor PICO a las dos rutas de evidencia, previa decisión de alcance).
4. **`E0-07` no se reintenta.** Su parte de software está cerrada y verificada; lo que queda son
   respuestas del Dr. Cuando lleguen, el lote es mecánico: cambiar `verificarModuloIA` por
   `verificarModuloYCapacidad` en las 16 rutas de IA y quitar el `activacionPendiente` de las que
   él autorice. El guardián nuevo comprobará solo que el código haga lo que el registro dice.
5. Si el Dr. prefiere terreno nuevo: **E4-01 «Contrato del Safety Kernel»** (riesgo medio,
   aceptación autocontenida).

**Convención vigente:** una unidad devuelta a la cola pierde su `RESULTADO.json` (se renombra a
`RESULTADO.parcial.json`, para no perder la evidencia) y su veredicto queda en `VERIFICACION.json`.
E0-07 vuelve a tener `RESULTADO.json`; su `RESULTADO.parcial.json` y su `VERIFICACION.json` se
conservan como historia de por qué se devolvió.

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
- **El arreglo del clickjacking (22 pantallas) está en el código y no en producción.** Basta
  desplegar — **subiendo la versión del Service Worker**.
- **La política de seguridad sigue permitiendo `unsafe-inline`/`unsafe-eval`.** Quitarlo exige
  firmar cada script en cada petición; su riesgo típico es *pantalla en blanco*. Unidad aparte.
- **Ninguna prueba automática entra a la zona con sesión** (expediente, nota, receta, farmacia). Es
  el punto ciego más grande del proyecto y lo que impide cerrar E0-10 → `E0-10-D4`.
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
