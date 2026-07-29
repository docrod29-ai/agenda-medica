# Nexus OS — dónde vamos

> **En 30 segundos.** Van **6 de 68** unidades cerradas y verificadas. Hoy se intentaron 3:
> **una cerró (E0-04)** y **dos volvieron atrás** (E0-11, E0-09) porque la verificación
> adversarial demostró que no cumplían lo prometido.
> **La siguiente unidad es E0-11** — hay que cerrar un agujero por el que un gate de
> seguridad clínica se puede apagar sin que nadie lo note.
> Y hay **una línea suya** que destraba E0-09 (ver *Esperando decisión del médico · 1*).

Última corrida: `2026-07-29T03:44:05Z`. Repo limpio, `tsc` en verde, **nada desplegado, sin `push`**.

---

## El tablero

| Unidad | Qué es | Estado |
|---|---|---|
| E0-01 | Certificado de receta firmado con identidad derivada | ✅ cerrada |
| E0-02 | Invariantes de dosis pediátrica (property-based) | ✅ cerrada |
| E0-03 | Clinical Engine Registry + trinquete de ADRs | ✅ cerrada |
| E0-04 | Un número clínico ya no puede viajar sin su unidad | ✅ cerrada *(hoy)* |
| E0-14 | Firma aislada · cobro sellado · nota nace borrador | ✅ cerrada (única con reglas desplegadas) |
| E0-15 | Antibiograma: 4 decisiones clínicas suyas implementadas | ✅ cerrada |
| **E0-11** | **El CI protege los invariantes clínicos** | 🔴 **bloqueada — el gate se puede burlar** |
| **E0-09** | **El registro del hospital no se edita: se corrige anexando** | 🟡 **bloqueada — espera 1 línea suya** |

**6 cerradas · 2 bloqueadas · 60 sin empezar.**

---

## Qué pasó hoy, sin adornos

Se intentaron tres unidades. Después, un verificador independiente intentó **refutar** cada
una — que es el paso que existe justamente para que nadie se crea su propio informe.

**E0-04 sobrevivió.** El tipo que impide que un número clínico viaje sin su unidad hace lo
que promete: el compilador rechaza sumar miligramos con mililitros. Confirmada.

**E0-11 y E0-09 no.** Las dos se habían apuntado como listas y **las dos se dieron de baja**.
No es un tecnicismo de papeleo:

- **E0-11 tenía un agujero real y demostrado.** El guardián que vigila que nadie apague un
  test de seguridad clínica reconoce las formas obvias de apagarlo… pero no dos que vitest
  ofrece de serie (`skipIf` / `runIf`). Con una sola línea se apaga **un archivo entero de
  42 comprobaciones clínicas** y el semáforo del CI **sigue en verde**. Se probó. Un guardián
  así es peor que no tener guardián, porque da confianza falsa. **Por eso es lo siguiente.**
- **E0-09 entregó el andamiaje, no la promesa.** El motor de correcciones está escrito,
  probado y el MAR ya entra al libro legal del hospital — todo eso es bueno y se queda. Pero
  lo que la unidad prometía era que **las reglas de seguridad rechacen sobrescribir** un
  signo vital, y las reglas están intactas. Eso depende de una decisión suya, no mía.

**Lo importante de este día no es el retroceso, es que se detectó.** El sistema daba por
hecha una unidad en cuanto existía su archivo de resultado, y un "hecho" falso así quedaba
enterrado para siempre. Ahora la reconciliación cruza el resultado con su verificación, y lo
refutado vuelve a la cola. Se corrigió la cuenta: eran 7 declaradas, son **6 reales**.

*Nada de esto tocó pantallas, impresión, recetas, cobros ni firmas. El código de las dos
unidades bloqueadas es aditivo y no está conectado a nada — no había basura que revertir.*

---

## 👉 La siguiente unidad: **E0-11 — tapar el bypass**

Es la elección obvia y no depende de usted:

- El fallo está **localizado con precisión** (`src/lib/clinical/safety-gate.ts`, líneas 137-142).
- Es **software puro**: ninguna decisión médica de por medio.
- Es **pequeño**, y arregla algo que hoy da seguridad falsa.

Ojo con la expectativa: **cerrado el bypass, E0-11 todavía no queda "completada"**, porque su
promesa final es *"un cambio que rompe un invariante clínico no se puede fusionar"* — y eso lo
decide GitHub, no el CI. Ese switch es suyo (punto 2 de abajo). Pero eso **no es motivo para
posponer el arreglo**.

Después de E0-11, la siguiente unidad nueva es **E1-01 · ClinicalFact** (riesgo bajo, abre la
etapa E1 y se apoya en lo que E0-04 dejó listo). Luego **E4-01 · Safety Kernel** (medio).

---

## Esperando decisión del médico

### 1. 🔓 Una línea suya cierra E0-09 — y ya casi la escribió usted

Hoy, si enfermería captura mal una tensión, **la sobrescribe y la anterior desaparece**. Eso
está así a propósito en las reglas, con su comentario, desde la auditoría de julio. E0-09
pide lo contrario: **anexar la corrección** y dejar el valor erróneo visible y tachado
(NOM-004). Como era revertir una política suya, no lo hice solo.

**Novedad:** su documento `DECISIONES-ARQUITECTURA-2026-07-28.md` **ya está en el repositorio**
(usted lo subió) y su §A3 **lista «signos vitales» como append-only**, con «corrección = nueva
versión/adenda, original conservado». Es exactamente lo que pide la unidad.

Sólo queda un matiz: ese §A3 habla de datos **«FINALIZADOS/FIRMADOS»**, y un registro de signos
no tiene ese estado — nace y ya está.

> **Lo que necesito de usted:** *"sí, aplica a los signos desde que se guardan"*.
> Con eso entra el parche de 3 líneas, ya escrito y esperando en
> `unidades/E0-09/RESULTADO.parcial.json`.

Dos datos que bajan el riesgo: **ningún punto del código sobrescribe un signo hoy** (cerrar esa
puerta no rompe nada), y el botón *"Borrar registro mal capturado"* ya está bloqueado en
producción — o sea que **hoy nadie puede señalar una lectura mala**. La corrección lo arregla.

### 2. ⏱️ Cinco minutos en GitHub — es lo que le falta a E0-11 por su lado

El gate **avisa** pero no **bloquea**: impedir una fusión lo decide GitHub. Hoy un cambio con
el gate en rojo se fusiona igual.

`github.com/docrod29-ai/agenda-medica` → **Settings → Rules → Rulesets → New branch ruleset**,
sobre `main`:

1. Require a pull request before merging.
2. Require status checks to pass → marcar **`clinical-safety`** y **`verificar`**.
3. Require branches to be up to date before merging.
4. Do not allow bypassing the above settings (incluirse usted).

Detalle en `docs/pendientes-externos.md` §3. *Opcional:* confirme que `docrod29-ai` es su
usuario de GitHub y active «Require review from Code Owners».

### 3. Las otras cuatro de E0-09 (definen *cómo* se corrige) — no bloquean el arreglo de arriba

- **¿Un signo corregido sigue contando para el NEWS2 y el expediente FHIR?** Las dos respuestas
  fallan feo en direcciones opuestas: si una saturación mal capturada de 80 % se queda, dispara
  una alerta falsa; si se oculta un valor que era correcto, **se esconde un deterioro real**. Hoy
  el sistema **se niega a calcular** en vez de suponer.
- **¿Quién puede corregir?** Y en concreto: **¿puede enfermería anular una administración de
  medicamento, o eso queda para el médico?**
- **¿Hay ventana de tiempo?** ¿Algo de hace cinco días? ¿Un paciente ya egresado?
- **¿El motivo escrito es obligatorio?** Lo propondría por NOM-004, pero encarece cada corrección
  — y si estorba, la gente deja de corregir y el registro empeora. Es su expediente.

### 4. ¿Ampliamos el catálogo de dosis del adulto? (E0-02, REG-043) — no bloquea

**20 de los 25** fármacos pediátricos no existen en el catálogo adulto (todos los antibióticos
salvo amoxicilina, más prednisona, ondansetrón, difenhidramina, aciclovir, hierro elemental…).
Al prescribirlos **a un adulto**, el verificador dice «sin referencia» y no impone ningún techo.
Usted aprobó ampliarlo; falta el máximo por toma y por día de cada uno. **No se derivan de las
cifras pediátricas y no los voy a inventar.**

### 5. ¿Qué análisis más deben convertirse entre mg/dL y µmol/L? (E0-04) — no bloquea

Arrancó con **creatinina y colesterol**, los dos que el sistema ya usaba. Para cualquier otro
(glucosa, urea/BUN, bilirrubina, calcio) devuelve «no lo sé» — el comportamiento seguro. Si
quiere alguno, dígame cuál y de qué referencia sale su peso molecular.
*Relacionado:* **mEq/L no se convierte automáticamente a mmol/L**: para sodio, potasio y cloro
el número coincide, para calcio y magnesio no. Automatizarlo sería sembrar un error.

### 6. Firma: ¿se construye el renderizado server-side? (E0-14, REG-014) — no bloquea

Recepción, farmacia y enfermería ya no pueden leer la firma. Pero el médico autenticado sigue
recibiendo la imagen en su navegador porque la impresión es toda del lado del cliente. Cerrarlo
exige generar el documento firmado en el servidor: unidad aparte, y toca impresión.

### 7. Pendientes anteriores (E0-01), sin cambios

- **¿El pie IMPRESO de la receta debe leerse de la firma de la nota, no de la configuración de la
  clínica?** Con un solo médico no cambia nada; con dos o más, papel y QR pueden discrepar.
- **Al desplegar: subir la versión del Service Worker.** Un cliente viejo cacheado deja el QR
  degradado a texto ese día. No rompe la impresión.

---

## Deuda técnica anotada (para no perderla)

- **E0-05 hereda un cabo suelto de E0-04.** La protección del tipo distingue *dimensiones*
  (masa vs volumen) pero no *unidades* dentro de una dimensión: copiar una cantidad cambiándole
  la etiqueta de `mg` a `µg` compila, y produce un **error de escala de 1000×**. Hoy es inocuo
  —el módulo no lo usa nadie— pero debe cerrarse **antes** de que un motor real lo consuma.
- **Lo que resta de E0** (E0-06 PHI, E0-10 CSP, E0-12 sello de integridad, E0-13 webhook de
  Stripe) es de riesgo medio/alto y varias deben entregarse como **plan** para que usted decida,
  no ejecutarse a ciegas. E0-05 (migrar motores reales) va **por lotes**, nunca de un tirón.

---

## Cómo se retoma

Relanzar el workflow `nexus-os`. Lee `estado.json`, comprueba en disco qué unidades tienen
`RESULTADO.json` y sigue en la primera pendiente. Es idempotente: relanzarlo nunca repite
trabajo ni pierde avance.

**Regla nueva de hoy, aprendida a golpes:** un `RESULTADO.json` **no** es prueba suficiente por
sí solo. Sólo cuenta si el `VERIFICACION.json` de esa unidad no la declara *INCOMPLETA*. Lo
refutado pierde su `RESULTADO.json` (queda como `RESULTADO.parcial.json`, como evidencia de lo
que sí sirvió) y **vuelve a la cola**.
