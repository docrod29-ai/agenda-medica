# Nexus OS — dónde vamos

**Avance: 7 de 68 unidades cerradas + 2 esperando decisión suya.** Etapa E0 (Hardening): 7 de 15.
Última corrida: `2026-07-29T03:29:14Z` — **E0-09 · Eventos hospitalarios críticos append-only**.

| Unidad | Qué es | Estado |
|---|---|---|
| E0-01 | Certificado de receta firmado con identidad derivada | cerrada |
| E0-02 | Invariantes de dosis pediátrica (property-based) | cerrada |
| E0-03 | Clinical Engine Registry + trinquete de ADRs | cerrada |
| E0-04 | Un número clínico ya no puede viajar sin su unidad | cerrada |
| E0-14 | Firma aislada · cobro sellado · nota nace borrador | cerrada (única con reglas desplegadas) |
| E0-15 | Antibiograma: 4 decisiones clínicas suyas implementadas | cerrada |
| E0-11 | El CI protege los invariantes clínicos | software listo — falta un switch suyo en GitHub |
| **E0-09** | **El registro del hospital no se edita: se corrige anexando** | **software listo — 5 decisiones suyas** |

---

## Lo último: E0-09 — un hecho registrado no se borra, se corrige encima

La idea de la unidad es la de siempre en un expediente serio: **lo que ya pasó, pasó**.
Si una lectura se capturó mal, no se sobrescribe ni se borra — **se anexa una corrección y
el valor erróneo queda visible, tachado**, con quién lo corrigió y cuándo. Es lo que pide
la NOM-004 y es lo que un perito espera encontrar.

### El agujero real que se encontró (y se cerró)

El sistema ya tenía un "libro legal" append-only del internamiento — la subcolección
`registros` — y ahí se guardaban el balance hídrico, las escalas y los SBAR. **Pero el MAR
no llegaba a ese libro.** Una dosis administrada vivía únicamente dentro de un arreglo
anidado en el documento del episodio. Dos consecuencias, las dos malas:

1. **Las reglas de seguridad no podían protegerlo, ni ahora ni nunca.** Ese documento lo
   escribe el servidor con privilegios de administrador, y esos privilegios **ignoran las
   reglas por diseño**. El registro más delicado del hospital era justo el que quedaba
   fuera de la garantía.
2. **Ese arreglo no tenía tope.** El balance, las escalas y el SBAR sí lo tienen. El MAR
   no: una estancia larga acerca el documento al límite de tamaño de Firestore, y la
   forma de fallar habría sido **perder escrituras de administraciones**.

Ahora cada administración, cada indicación nueva, cada suspensión y cada verificación de
farmacia **entra al libro legal**, con el autor y la hora que pone el servidor (no la
tablet, cuyo reloj es manipulable) y con una **lista blanca de campos**: el navegador no
puede colar datos arbitrarios en un registro permanente. La ruta del gateway **no se tocó
ni una línea**.

### Un candado nuevo para que no vuelva a pasar

Cada acción del hospital tiene que estar clasificada: **o produce registro legal, o lleva
escrita la razón de por qué no**. Si alguien añade mañana una acción nueva al gateway y no
la clasifica, **el CI se cae**. No es un descuido que se pueda repetir en silencio.

### Lo que quedó listo pero apagado, esperándole

El motor de correcciones está escrito y probado: sabe encadenar correcciones (A corregido
por B, corregido por C), sabe qué hacer con una corrección cuyo original ya no está
cargado en pantalla, y **nunca elimina nada** — sólo marca. Pero **no está conectado a
ninguna pantalla todavía**, a propósito, porque las cinco decisiones de abajo son suyas.
Hay incluso un test que **falla si alguien lo conecta antes de que usted responda**.

### Gates reales

`tsc` PASS · `vitest` PASS (**2164** tests, 180 archivos; eran 2120) · `build` PASS.
`firestore.rules` **intacto**. Nada desplegado, sin `git push`.
Detalle en `unidades/E0-09/RESULTADO.json`.

---

## Esperando decisión del médico

### 1. NUEVO (E0-09) — la pregunta que bloquea esta unidad

**¿Confirma cambiar la política de los signos vitales?**

Hoy, si enfermería captura mal una tensión, **la sobrescribe en el sitio** y la anterior
desaparece. Eso **no es un descuido**: está escrito así a propósito en las reglas, con su
comentario, desde la auditoría maestra de julio — "se corrige encima, pero nadie borra".

E0-09 pide lo contrario: **anexar la corrección** y dejar el valor erróneo visible y
tachado. Es más fiel a la NOM-004 y es exactamente lo que exige el objetivo de la unidad,
pero **es revertir una decisión suya anterior** y hace la pantalla de signos más ruidosa.
Por eso no lo hice solo.

Dos datos que bajan el riesgo de hacerlo:

- **Ningún punto del código sobrescribe un signo hoy.** Cerrar esa puerta no rompe nada.
- **El botón "Borrar registro mal capturado" de la ficha ya está roto en producción**: la
  regla lo bloquea y siempre muestra el error. Hoy, en la práctica, **nadie puede señalar
  una lectura mala**. La corrección es lo que arregla eso.

El cambio exacto de reglas, con las tres líneas, está escrito y esperando su visto bueno
en `unidades/E0-09/RESULTADO.json`.

### 2. NUEVO (E0-09) — las cuatro que definen cómo se corrige

- **¿Un signo corregido debe seguir contando para el NEWS2 y para el expediente FHIR?**
  Las dos respuestas fallan feo en direcciones opuestas: si una saturación mal capturada
  de 80 % se queda, dispara una alerta falsa; si se oculta un valor que en realidad era
  correcto, **se esconde un deterioro real**. No lo deduzco del código. Hoy el sistema
  **se niega a calcular** en vez de suponer.
- **¿Quién puede corregir?** ¿Sólo quien registró, cualquier enfermería del turno, o sólo
  el médico tratante? Y en concreto: **¿puede enfermería anular una administración de
  medicamento, o eso queda para el médico?** (Hoy administrar sí lo puede hacer enfermería.)
- **¿Hay ventana de tiempo?** ¿Se corrige algo de hace cinco días? ¿Y de un paciente ya
  egresado?
- **¿El motivo escrito es obligatorio?** Yo lo propondría por NOM-004, pero encarece cada
  corrección — y si estorba demasiado, la gente deja de corregir y el registro empeora.
  Es su expediente.

### 3. Cinco minutos en GitHub — es lo único que le falta a E0-11

El gate de invariantes clínicos ya **avisa**, pero todavía no **bloquea**: impedir un merge
lo decide GitHub, no el CI. Hoy un Pull Request con el gate en rojo se puede mergear igual.

En `github.com/docrod29-ai/agenda-medica` → **Settings → Rules → Rulesets → New branch
ruleset**, sobre `main`:

1. Require a pull request before merging.
2. Require status checks to pass → marcar **`clinical-safety`** y **`verificar`**.
3. Require branches to be up to date before merging.
4. Do not allow bypassing the above settings (incluirse usted).

Detalle en `docs/pendientes-externos.md` §3. *Opcional, mismo sitio:* confirme que
`docrod29-ai` es su usuario de GitHub y active «Require review from Code Owners».

### 4. ¿Ampliamos el catálogo de dosis del adulto? (E0-02, REG-043) — no bloquea

**20 de los 25** fármacos pediátricos no existen en el catálogo adulto: todos los
antibióticos salvo amoxicilina, más prednisona, ondansetrón, difenhidramina, aciclovir,
hierro elemental… Al prescribirlos **a un adulto**, el verificador dice «sin referencia» y
no impone ningún techo. Usted aprobó ampliarlo; falta que aporte el máximo por toma y por
día de cada uno. **No se derivan de las cifras pediátricas y no los voy a inventar.**

### 5. ¿Qué análisis más deben convertirse entre mg/dL y µmol/L? (E0-04) — no bloquea

El conversor arrancó con **creatinina y colesterol**, que son los dos que ya usaba el
sistema. Para cualquier otro (glucosa, urea/BUN, bilirrubina, calcio) devuelve «no lo sé»
en vez de un número — que es el comportamiento seguro. Si quiere alguno más, dígame cuál y
de qué referencia sale su peso molecular.

*Relacionado, misma unidad:* **mEq/L no se convierte automáticamente a mmol/L.** Para
sodio, potasio y cloro el número coincide, pero para calcio y magnesio no (depende de la
valencia del ion), así que automatizarlo sería sembrar un error. Si lo quiere, se hace
aparte y explícito.

### 6. Firma: ¿se construye el renderizado server-side? (E0-14, REG-014) — no bloquea

La firma ya no la puede leer recepción, farmacia ni enfermería. Pero el médico
autenticado sigue recibiendo la imagen en su navegador, porque la impresión es toda del
lado del cliente. Cerrarlo del todo exige generar el documento firmado en el servidor: es
una unidad aparte y toca el camino de impresión.

### 7. Pendientes anteriores (E0-01), sin cambios

- **¿El pie IMPRESO de la receta debe leerse de la firma de la nota en vez de la
  configuración de la clínica?** Con un solo médico no cambia nada; con dos o más, papel y
  QR pueden discrepar. No bloquea.
- **Al desplegar: subir la versión del Service Worker.** Un cliente viejo cacheado deja el
  QR degradado a texto ese día. No rompe la impresión.

---

## Qué sigue

Con E0-09 fuera de la lista, **la etapa E0 se queda sin trabajo de riesgo medio**: lo que
resta es alto, o exige mirar producción. El programa se mueve a las etapas nuevas.

- **E1-01 — ClinicalFact** (riesgo bajo). Primera unidad de **E1 · Nexus Context** y **la
  única de riesgo bajo que queda elegible en todo el programa**. Se apoya en el tipo con
  unidades que E0-04 dejó en disco.
- **E4-01 — Safety Kernel** (medio). Abre la etapa **E4**. Aún no tiene diseño escrito, así
  que su primera pasada incluiría el diseño.
- **E0-05 — migrar los motores a ClinicalQuantity** (alto). Es la que da valor real al tipo
  de E0-04, pero cambia las firmas de motores que hoy usan pantallas reales (función renal,
  gasometría, infusiones, dosis, PREVENT). Conviene por lotes o como plan, no de un tirón.

Lo que reste de E0 después (E0-06 PHI, E0-10 CSP, E0-12 sello de integridad, E0-13 webhook
de Stripe) es de riesgo medio/alto y varias deben entregarse como **plan** para que usted
decida, no ejecutarse a ciegas.

---

## Cómo se retoma

Relanzar el workflow `nexus-os`. Lee `estado.json`, comprueba en disco qué unidades ya
tienen `RESULTADO.json` y continúa en la siguiente pendiente. Es idempotente: relanzarlo
nunca repite trabajo ni pierde avance.
