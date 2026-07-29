# Nexus OS — dónde vamos

**Avance: 7 de 68 unidades.** Etapa E0 (Hardening): **7 de 15**.
Última corrida: `2026-07-29T03:10:52Z` — **E0-04 · ClinicalQuantity: el tipo con unidad obligatoria**.

| Unidad | Qué es | Estado |
|---|---|---|
| E0-01 | Certificado de receta firmado con identidad derivada | cerrada |
| E0-02 | Invariantes de dosis pediátrica (property-based) | cerrada |
| E0-03 | Clinical Engine Registry + trinquete de ADRs | cerrada |
| E0-14 | Firma aislada · cobro sellado · nota nace borrador | cerrada (única con reglas desplegadas) |
| E0-15 | Antibiograma: 4 decisiones clínicas suyas implementadas | cerrada |
| E0-11 | El CI protege los invariantes clínicos | software listo — falta un switch suyo en GitHub |
| **E0-04** | **Un número clínico ya no puede viajar sin su unidad** | **cerrada** |

---

## Lo último: E0-04 — el bug de escala, movido al compilador

El riesgo número uno de este sistema no es un diagnóstico equivocado: es **un número
correcto en la unidad equivocada**. Una creatinina de 88 llega del laboratorio en µmol/L,
el motor la lee como 88 mg/dL, y calcula una falla renal fantasma que recorta antibióticos
que el paciente sí necesitaba.

Hasta hoy eso se defendía **contando el número**: si la creatinina cae fuera de 0.1–25, se
avisa. Es una heurística útil, pero no es una prueba — **una creatinina de 20 µmol/L (un
paciente perfectamente sano) cae dentro de ese rango y pasa como si fueran 20 mg/dL.**

Ahora existe un tipo, `ClinicalQuantity`, donde **el valor y su unidad son inseparables**.
Sumar miligramos con mililitros, o comparar mg/dL con µmol/L, deja de ser algo que se
pueda escribir: **el compilador lo rechaza antes de que el código llegue a existir.**

### El hallazgo que casi deja la unidad hueca

La versión obvia de este tipo **no funciona**, y lo hace en silencio: TypeScript ensancha
el tipo hasta que `sumar(mg, mL)` compila sin quejarse. Se comprobó **rompiéndolo a
propósito**: al quitar la línea que lo impide, cinco de los diez casos prohibidos pasaron
—incluidos **los dos ejemplos exactos que pedía el objetivo**—. Es decir, la versión
ingenua habría entregado la unidad con todo en verde y el agujero abierto.

La línea que lo arregla lleva un comentario de "no borrar" en el propio código, y un test
que falla si alguien la quita.

### Tres agujeros del diseño que la implementación corrigió

Al revisar el catálogo de unidades aparecieron **tres "conversiones" que no existen**:

- **mL/min ↔ mL/min/1.73m²** (depuración cruda vs. indexada) — pasar de una a otra exige
  la superficie corporal del paciente. Juntas, el sistema habría devuelto el mismo número
  con otra etiqueta: el bug que el módulo existe para impedir, reintroducido por el módulo.
- **U/min ↔ µg/min** — las unidades internacionales (vasopresina, insulina, heparina) miden
  actividad biológica, no masa. Su equivalencia depende del fármaco.
- **mg/kg/día ↔ mg/kg/dosis** — el puente exige saber cuántas tomas al día lleva ese
  fármaco, que es criterio clínico.

En los tres casos la respuesta fue **no convertir y separarlas**, nunca inventar el factor.
De ahí salieron 4 de los 10 casos prohibidos.

### Cero números clínicos nuevos

Los dos únicos factores de conversión con contenido médico (creatinina ×88.4, colesterol
÷38.67) **ya vivían en el repo** y se copiaron con su cita. Dos tests leen los archivos
originales y fallan si alguien cambia un sitio y no el otro. Todo lo demás son
definiciones del SI (1 g = 1000 mg) o de metrología (1 mmHg = 133.322387415 Pa).

### Gates reales

`tsc` PASS · `vitest` PASS (**2120** tests, 179 archivos; eran 2083) · `build` PASS.
**Cero archivos de producción tocados** — el módulo nace sin un solo importador, así que
ninguna pantalla, motor, receta, PDF, firma ni cobro cambia de comportamiento. Nada
desplegado, sin `git push`. Deshacerlo es borrar tres archivos.
Detalle en `unidades/E0-04/RESULTADO.json`.

---

## Esperando decisión del médico

### 1. Cinco minutos en GitHub — es lo único que le falta a E0-11

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

### 2. ¿Ampliamos el catálogo de dosis del adulto? (E0-02, REG-043) — no bloquea

**20 de los 25** fármacos pediátricos no existen en el catálogo adulto: todos los
antibióticos salvo amoxicilina, más prednisona, ondansetrón, difenhidramina, aciclovir,
hierro elemental… Al prescribirlos **a un adulto**, el verificador dice «sin referencia» y
no impone ningún techo. Usted aprobó ampliarlo; falta que aporte el máximo por toma y por
día de cada uno. **No se derivan de las cifras pediátricas y no los voy a inventar.**

### 3. Nuevo (E0-04): ¿qué análisis más deben convertirse entre mg/dL y µmol/L? — no bloquea

El conversor arrancó con **creatinina y colesterol**, que son los dos que ya usaba el
sistema. Para cualquier otro (glucosa, urea/BUN, bilirrubina, calcio) devuelve «no lo sé»
en vez de un número — que es el comportamiento seguro. Si quiere alguno más, dígame cuál y
de qué referencia sale su peso molecular.

*Relacionado, misma unidad:* **mEq/L no se convierte automáticamente a mmol/L.** Para
sodio, potasio y cloro el número coincide, pero para calcio y magnesio no (depende de la
valencia del ion), así que automatizarlo sería sembrar un error. Si lo quiere, se hace
aparte y explícito.

### 4. Firma: ¿se construye el renderizado server-side? (E0-14, REG-014) — no bloquea

La firma ya no la puede leer recepción, farmacia ni enfermería. Pero el médico
autenticado sigue recibiendo la imagen en su navegador, porque la impresión es toda del
lado del cliente. Cerrarlo del todo exige generar el documento firmado en el servidor: es
una unidad aparte y toca el camino de impresión.

### 5. Pendientes anteriores (E0-01), sin cambios

- **¿El pie IMPRESO de la receta debe leerse de la firma de la nota en vez de la
  configuración de la clínica?** Con un solo médico no cambia nada; con dos o más, papel y
  QR pueden discrepar. No bloquea.
- **Al desplegar: subir la versión del Service Worker.** Un cliente viejo cacheado deja el
  QR degradado a texto ese día. No rompe la impresión.

---

## Qué sigue

**E0-04 abrió dos etapas nuevas de golpe.** El programa deja de estar confinado a E0:

- **E1-01 — ClinicalFact** (riesgo bajo). Primera unidad de la etapa **E1 · Nexus Context**,
  recién desbloqueada, y **la única de riesgo bajo que queda elegible en todo el programa**.
  Se apoya directamente en el tipo que acaba de quedar en disco.
- **E0-09 — Eventos hospitalarios críticos append-only** (medio). MAR, órdenes y eventos de
  UCI dejan de poder editarse o borrarse: solo se anexa corrección. Toca reglas de
  Firestore, así que su despliegue sería decisión suya aparte.
- **E4-01 — Safety Kernel** (medio). Abre la etapa **E4**. Aún no tiene diseño escrito, así
  que su primera pasada incluiría el diseño.

**E0-05 (migrar los motores a ClinicalQuantity) queda elegible pero es la de riesgo alto
del bloque:** cambia las firmas de motores que hoy usan pantallas reales (función renal,
gasometría, infusiones, dosis, PREVENT). Conviene por lotes o como plan, no de un tirón.

Lo que reste de E0 después (E0-06 PHI, E0-10 CSP, E0-12 sello de integridad, E0-13 webhook
de Stripe) es de riesgo medio/alto y varias deben entregarse como **plan** para que usted
decida, no ejecutarse a ciegas.

---

## Cómo se retoma

Relanzar el workflow `nexus-os`. Lee `estado.json`, comprueba en disco qué unidades ya
tienen `RESULTADO.json` y continúa en la siguiente pendiente. Es idempotente: relanzarlo
nunca repite trabajo ni pierde avance.
