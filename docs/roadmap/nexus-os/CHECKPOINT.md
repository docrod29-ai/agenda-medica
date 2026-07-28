# Nexus OS — dónde vamos

**Avance: 1 completada + 1 esperando su visto bueno / 68 unidades.**
Etapa E0 (Hardening): 1 / 15 cerradas.
Última corrida: `2026-07-28T20:24:18Z` — `E0-02` **necesita validación**.

---

## E0-02 — Invariantes de dosis pediátrica (software LISTO, falta una decisión suya)

Todo el software de esta unidad está implementado, verde y corriendo en CI. **No la doy
por cerrada** porque uno de sus invariantes topa con una pregunta que no me toca
responder: dos partes del sistema no coinciden en cuánta amoxicilina puede llevar una
sola toma, y elegir la cifra es criterio médico. Está abajo, en «Esperando decisión».

### Qué hace ahora el sistema que antes no hacía

Antes existían dos pruebas puntuales: amikacina a 20 kg y «la dosis por toma nunca supera
la del día», sobre 5 pesos fijos y una edad fija. Ahora hay un **invariante permanente
sobre todo el catálogo**: los 25 fármacos pediátricos × 250 pesos entre 0.5 y 120 kg × 11
edades (incluida «sin edad capturada», que es como lo llama el copiloto) — unas 68 mil
combinaciones en cada corrida, en ~110 ms.

El criterio de aceptación del backlog —*ningún fármaco puede producir una dosis por toma
por encima de su tope*— **ya se cumplía**. Un barrido exhaustivo previo dio cero
violaciones. Así que E0-02 no reparó nada roto: **convirtió ese hecho en algo que no se
puede romper en silencio** el día que se agregue el fármaco número 26.

Eso es lo que de verdad protege. Las propiedades son **fail-closed**: si alguien agrega un
fármaco con una unidad nueva, sin ningún tope declarado, o que contradiga el otro
catálogo, **el CI se cae a propósito** y obliga a que usted lo revise antes de que entre.
No es una falla del arnés: es el punto.

### Lo que se comprueba en cada corrida

| | Propiedad |
|---|---|
| **P1** | Forma del catálogo: unidad válida, al menos un tope declarado, rangos ordenados, el piso nunca por encima del techo. |
| **P2** | **Aceptación:** la dosis por toma nunca supera su tope, y multiplicada por las tomas del día tampoco rebasa el techo diario. |
| **P3** | La dosis nunca **baja** al subir el peso (caza un tope mal propagado). Peso cero o negativo ⇒ sin dosis, nunca un «0» usable. |
| **P4** | La contraindicación por edad **manda**: por debajo de la edad mínima siempre sale bloqueado con su motivo, a cualquier peso. |
| **P5** | Verificador adulto: «5 mL» jamás se lee como 5 mg; un fármaco fuera del catálogo **siempre** avisa «sin referencia» (ausencia de alerta nunca significa «seguro»). |
| **P6** | Los dos motores de dosis no se contradicen. Aquí aparece la pregunta pendiente. |

### Y sobre todo: se comprobó que las pruebas SIRVEN

Un invariante en verde contra un motor sano no demuestra nada. Así que la propiedad de
aceptación se ejecuta también contra dos **motores deliberadamente rotos**, y el test
exige que falle:

1. Uno reproduce el bug histórico **REG-018** (el tope por kilo recortaba el total del día
   pero no la dosis por toma, así que la receta de amikacina salía ~50 % arriba del tope).
2. Otro emite la dosis cruda ignorando el tope por toma.

No fue una comprobación de una sola vez: **viven como pruebas permanentes**, así que cada
corrida vuelve a demostrar que el invariante tiene dientes.

### Tres cosas del diseño que resultaron estar mal, y se corrigieron midiendo

- El diseño decía que amoxicilina choca con el techo adulto «desde ~33.3 kg». **Medido:
  desde ≈22.3 kg** — once kilos antes, es decir, en muchos más niños de los que decía el
  papel. Los 33.4 kg son donde la cifra se *estabiliza* en 1500 mg.
- Decía que 22 de 25 fármacos no tienen referencia adulta. **Son 20 de 25.**
- Proponía comprobar la detección bajando a mano un tope de amikacina. **Eso no habría
  fallado nunca**: el motor aplica el tope que el catálogo declara, así que bajarlo solo
  baja la dosis. Por eso se sustituyó por los motores rotos de arriba.

### Gates reales

`tsc` PASS · `vitest` PASS (**1947** tests, 172 archivos; eran 1911) · `build` PASS.
Detalle completo en `unidades/E0-02/RESULTADO.json`.

**Nada desplegado. Sin `git push`.** El único cambio fuera de pruebas es exportar dos
funciones puras de `pediatria.ts` (mismo cálculo, mismo resultado): el test necesita las
tomas/día **reales** del motor, porque re-implementarlas en la prueba haría que la prueba
coincidiera con cualquier bug del motor. No se tocó impresión, PDF, firma, cobros, PHI ni
reglas de Firestore.

---

## Esperando decisión del médico

### 1. Amoxicilina: ¿1000 mg o 1500 mg por toma? — **bloquea el cierre de E0-02**

Las dos partes del sistema se contradicen:

- El **motor pediátrico** da 45–90 mg/kg/día en 2 tomas, con tope de 3000 mg al día. Eso
  son **45 × peso** mg por toma: pasa de 1000 mg **desde ≈22.3 kg** y llega a **1500 mg
  por toma desde 33.4 kg**.
- El **verificador de dosis de adulto** declara un máximo de **1000 mg por toma**. Con lo
  cual marca como **crítica** la receta que el propio motor pediátrico acaba de emitir.

Hoy conviven así: un niño de 35 kg recibe una receta de 1500 mg por toma **y** una alerta
roja que dice que eso rebasa el máximo. Una de las dos cifras sobra.

- Si manda **1000 mg/toma** → hay que ponerle un tope por toma al catálogo pediátrico.
- Si manda **1500 mg/toma** → hay que subir el máximo en el catálogo adulto.

Aplica igual a **amoxicilina-clavulanato**, que se dosifica por el componente amoxicilina.

**No elegí ninguna.** Es un umbral de dosis: inventarlo es exactamente lo que la carta
operativa prohíbe. El hallazgo quedó **versionado y visible** en el código (lista nominal
`INCOHERENCIAS_CONOCIDAS`), así que el CI no se cae hoy por algo ya conocido, pero
**cualquier contradicción nueva sí lo tumba** — y en cuanto usted decida, otra prueba
exige quitar la excepción para que el invariante vuelva a ser estricto y no se pudra ahí.

### 2. ¿Se acepta un desvío de ±0.05 mg por toma al tocar un tope? — no bloquea

El motor redondea a un decimal **al más cercano**, no hacia abajo. Eso puede dejar el
total del día **0.1 mg por encima** del tope:

- Metronidazol a 66.7 kg → 666.7 × 3 = **2000.1** contra un tope de 2000.
- Gentamicina neonatal a 51.3 kg → 128.3 × 2 = **256.6** contra 256.5.

Clínicamente es despreciable, pero prefiero que quede **declarado y acotado** en la prueba
antes que escondido. ¿Lo acepta así, o el motor debe **redondear siempre hacia abajo**
cuando la dosis toca un tope? Si prefiere lo segundo, la tolerancia pasa a cero y la
prueba se aprieta sola — pero **cambiar el redondeo cambia el motor de dosis en
producción**, y eso sería su propia unidad, no ésta.

### 3. ¿Ampliamos el catálogo de dosis del adulto? — no bloquea

**20 de los 25** fármacos pediátricos no existen en el catálogo adulto: todos los
antibióticos salvo amoxicilina, más prednisona, ondansetrón, difenhidramina, aciclovir,
hierro elemental… Al prescribirlos **a un adulto**, el verificador dice «sin referencia» y
**no impone ningún techo**. Avisa honestamente de que no sabe, que es lo correcto, pero no
protege.

Ampliarlo necesita que usted aporte el máximo por toma y por día de cada uno. **No se
derivan de las cifras pediátricas y no los voy a inventar.**

### Pendientes anteriores (E0-01), sin cambios

- **¿El pie IMPRESO de la receta debe leerse de la firma de la nota en vez de la
  configuración de la clínica?** Con un solo médico no cambia nada; con dos o más, papel y
  QR pueden discrepar. Tocar la impresión pide una unidad aparte con verificación visual
  del PDF real. No bloquea.
- **Al desplegar: subir la versión del Service Worker.** Un cliente viejo cacheado deja el
  QR degradado a texto ese día. No rompe la impresión.

---

## Cómo se retoma

Relanzar el workflow `nexus-os`. Lee `estado.json`, comprueba en disco qué unidades ya
tienen `RESULTADO.json` y continúa en la siguiente pendiente. Es idempotente: relanzarlo
nunca repite trabajo ni pierde avance.

`E0-02` queda en `necesitaValidacionDelDr` con sus tres preguntas. La primera bloquea el
**cierre** de E0-02, **no el avance del programa**: la siguiente unidad sugerida es
`E0-03` (ver `unidades/E0-03/DISENO.md`).
