# ADR-003 · El sello de integridad tiene versión propia

**Estado**: Vigente · **Fecha**: 2-ago-2026 (formalizado 6-ago-2026, REG-199)

---

## Contexto

Cada nota firmada lleva un hash de su contenido (NOM-024). Ese sello permite
demostrar que el documento no se alteró después de firmarse.

El problema aparece cuando el sello tiene que **cambiar**: añadir un campo al
cálculo cambia el hash de **todas las notas ya firmadas**, que pasarían a
verificarse como **«ALTERADA»** — siendo íntegras.

## Decisión

**El sello lleva `hashVersion`. Cada nota se verifica con el algoritmo de su
propia versión.** Ampliar la cobertura significa crear una versión nueva, no
modificar la vigente.

Y **la cobertura declarada se deriva de la lista real de exclusiones**, no se
escribe aparte.

## Por qué

El modo de fallo grave de un sello no es que no detecte una alteración: es la
**falsa alarma**. Un banner rojo de «INTEGRIDAD NO VERIFICADA» sobre expedientes
intactos destruye la confianza en el mecanismo entero, y a partir de ahí nadie
mira el sello — incluido el día que sí detecte algo.

Ya ocurrió: **REG-060**, cuando Firestore reordenaba las claves y el hash sobre
`JSON.stringify` cambiaba solo. La reparación fue canonicalizar el orden **y**
versionar.

## Alternativas descartadas

**1. Recalcular el sello de las notas viejas con el algoritmo nuevo.**
Descartada, y es la más tentadora: reescribiría el sello de documentos firmados.
Un sello que se puede regenerar sobre un documento ya firmado **no prueba nada**.

**2. No versionar y no ampliar nunca.** Descartada: congela el alcance para
siempre. Hoy `transcripcionMotor` —el origen del que se re-proyecta la nota— no
está sellado, y debería estarlo.

**3. Sellarlo todo desde el principio.** Es lo que se querría, pero campos como
`updatedAt` o `estado` cambian legítimamente después de firmar. Sellarlos
marcaría «alterada» a cualquier nota que reciba una adenda.

## Consecuencias

**Aceptadas:**

- **Conviven varias versiones de sello.** El verificador debe mantener el
  algoritmo de cada una, para siempre.
- **Ampliar la cobertura exige una migración**, no un cambio de una línea.
- Hoy `transcripcionMotor` **no está sellado** y se dice claramente en pantalla.
  Subir a v4 está registrado como **D-08** en
  `agent-state/OWNER_DECISIONS_REQUIRED.md`, esperando al médico dueño: tocar el
  hash es irreversible sobre documentos firmados con su cédula.

**A favor:**

- Una nota firmada hace dos meses se verifica hoy igual que entonces.
- Cada exclusión tiene su razón escrita, y la pantalla no puede afirmar más
  cobertura de la que hay.

## Cómo se hace cumplir

- `COBERTURA_SELLO[3].noCubre` se **deriva** de `CAMPOS_NO_SELLADOS_V3`.
- `cubreTodo` significa «no queda nada fuera», no «es la última versión».
- `src/__tests__/e0-12-sello-integridad.test.ts` comprueba las dos cosas.

## Historia

Hasta el 6-ago-2026 la pantalla decía **«cubre todo»** mientras el propio módulo
documentaba, veinte líneas más arriba, que no. Contar una limitación hacia dentro
y ocultarla hacia fuera es peor que no documentarla: **una afirmación de
integridad más ancha que su alcance real se confía** (REG-199).
