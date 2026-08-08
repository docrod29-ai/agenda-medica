# De qué se enferma este sistema

**Formato**: §H7 del charter Master Loop V7 — cada defecto se convierte en
aprendizaje permanente.
**Abierto**: 6-ago-2026. **Actualizado**: 7-ago-2026.
**Fuente**: los 96 REG de `docs/audit/regression-ledger.md`.

---

## Por qué contar

El ledger tiene 85 defectos con su causa raíz. Leídos de uno en uno son 85
historias. **Contados por familia dicen algo que ninguno dice solo**: cuál es la
forma de fallar que se repite.

Eso cambia dónde conviene mirar mañana.

---

## El resultado

| Familia | Casos | Qué tienen en común |
|---|---:|---|
| **Escrito, probado y sin conectar** | **16** | El módulo existe, tiene pruebas y está bien. Simplemente **no corre** en el camino que el médico recorre — o corre con una entrada incompleta |
| **El sistema se contradice a sí mismo** | **14** | Dos partes afirman cosas incompatibles y **ninguna está mal por su cuenta**. El fallo vive en el hueco entre las dos |
| El habla real no cabía en el motor | 10 | El motor cubre el español que uno *escribiría*, no el que se *habla* en un consultorio mexicano |
| Nadie lo estaba midiendo | 8 | No es un defecto del producto: es la ausencia del instrumento que lo habría delatado |
| El hueco tratado como dato | 5 | Lo que nadie dijo se guarda como si alguien lo hubiera dicho |
| Fuga entre consultorios y dinero | 5 | Un dato o un cobro cruza la frontera de su dueño |
| El charter existía sin encarnar | 8 | Una sección del charter que vivía como carpeta vacía |
| Estorba al médico | 5 | Correcto por dentro, insoportable por fuera |
| Pérdida de datos | 6 | Trabajo del médico que desaparece o reaparece solo |
| Llega tarde para servir | 2 | El aviso es correcto y aparece **después** del momento en que habría servido |
| El mensaje mentía sobre la causa | 2 | Falla algo y el sistema culpa a otra cosa |
| *Decisión del médico dueño, no defecto* | 2 | Cambiaron el comportamiento, pero nada estaba roto |
| Al modelo de datos le faltaba un eje | 2 | El dato se guardaba entero y correcto, pero sin la distinción que lo hace utilizable |

---

## Lo que dice el número grande

**«Escrito, probado y sin conectar» — 19 de 96, y el 7-ago-2026 volvió a ser la
familia más grande.**

La recuperó con dos casos del mismo día, y los dos son el patrón en estado puro.
REG-221: el eje que distingue «ya lo toma» de «se lo receto hoy» existía en el
tipo, en el esquema auditado, en el prompt y en una prueba SELLADA — y `z.object`
lo borraba en la lista plana antes de que saliera del servidor. La prueba pasaba
en verde porque comprobaba el esquema equivocado. REG-222: un aviso marcado
`no-print` desaparecía al Imprimir y salía impreso al descargar el PDF, porque
ese camino no es una impresión y nunca miró la marca.

Los dos tienen la misma forma: **la pieza estaba bien, y no corría donde tenía
que correr**.

Adelantó a «escrito y sin conectar» con REG-217: la regla 15 del prompt ORDENABA
escribir «No referido» y la 1-bis lo PROHÍBE. **Ninguna de las dos estaba mal por
su cuenta** — y por eso ninguna revisión de una sola pieza lo encuentra. El fallo
vive en el hueco entre las dos, y vivió meses.

Lo que esto exige: **guardianes que comparen partes**, no que revisen piezas. Y
que su lista de frases prohibidas se amplíe cada vez que aparece una nueva — la
de REG-217 no se cazó porque «No referido» no estaba en ella.

## La segunda

**«El sistema se contradice a sí mismo» — 14 de 96.**

Sumó REG-223: `--nexus` se aclaró para servir de TEXTO (5,96 sobre el lienzo) y
se seguía usando de RELLENO bajo texto blanco, donde el requisito es el
contrario y daba 3,28. Ninguna de las dos decisiones estaba mal por su cuenta. Y
el tema CLARO nunca lo tuvo — la corrección existía, aplicada a un solo tema.

## El patrón que sostiene a las dos

**Nueve veces** el módulo estaba bien, sus pruebas pasaban, y el sistema fallaba
igual porque **el módulo no corría donde tenía que correr**:

Es exactamente el patrón que ya estaba anotado como el fallo más caro, ahora con
la cuenta detrás. Nueve veces el módulo estaba bien, sus pruebas pasaban, y el
sistema fallaba igual porque **el módulo no corría donde tenía que correr**:

- el motor de sobredosis corría *después* de firmar (REG-190)
- «Quitar de la nota» sacaba el dato de un metadato de auditoría, no de la nota
  (REG-198)
- los motores clínicos recibían la receta de hoy en vez del paciente entero
  (REG-188)
- el 80,6 % de las correcciones del médico se tiraba sin mirarlas (REG-169), y el
  bucle que debía aprender de ellas nunca había aprendido nada (REG-170)

**Lo que esto implica para las pruebas**: una prueba unitaria verde es
compatible con las nueve. Todas se cazan con pruebas que recorren **el camino**,
no la pieza — o buscando el símbolo antes de dar algo por entregado.

## Y por qué la segunda sigue importando
 Ninguna de las dos partes
está mal por separado; por eso ninguna revisión de una sola pieza lo encuentra.
Dos reglas del prompt que se anulan, un sello que afirma cubrirlo todo mientras
el propio módulo sabe que no, un número de versión con siete cambios sin moverse.

Es la familia que justifica los ADR y los guardianes de coherencia: **no hay
dónde poner una prueba que vigile una contradicción entre dos módulos, salvo un
tercero que compare**.

## Lo que dicen las dos rarezas

**«Nadie lo estaba midiendo» — 5 de 61**, y cada uno destapó otros al encenderse.
El WER, el foso de vocabulario, el arnés de alucinación: ninguno era un fallo del
producto: era la falta del instrumento.

**«Decisión del médico dueño» — 2**, contados aparte a propósito. Meterlos en el
saco de «defectos» inflaría la cuenta con cosas que nadie rompió.

---

## Lo que este conteo NO dice

**Sólo se cuentan los defectos encontrados**, y encontrar depende de dónde se
miró. Una familia pequeña puede serlo porque es rara o **porque nadie la busca**
— y las dos se ven idénticas desde aquí.

La sospechosa obvia es **fuga entre consultorios**: cuatro casos, los cuatro
hallados al auditar a propósito, ninguno en uso normal. Eso no significa que sea
rara; significa que sólo aparece cuando alguien la persigue. Es también uno de
los dos ceros que la [puerta de liberación](../evals/PUERTA-DE-LIBERACION.md)
declara **DÉBIL**.

---

## Cómo se mantiene honesto

`src/__tests__/de-que-se-enferma-este-sistema.test.ts` compara esta
clasificación contra el ledger y **falla si un REG no tiene familia**. En cuanto
aterrice el REG-220, esta prueba se pone roja hasta que alguien conteste «¿de qué
familia es éste?» — que es la pregunta que convierte un defecto en aprendizaje en
vez de en una entrada más.

También comprueba que ningún REG esté en dos familias (un defecto tiene una causa
raíz), que ninguna familia cite un REG inexistente, y que la advertencia de
arriba siga escrita.
