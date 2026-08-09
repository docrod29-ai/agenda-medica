# El camino del médico

**Formato**: §4.1 del charter Master Loop V7.
**Abierto**: 6-ago-2026.

---

## Por qué este documento existe, y por qué es una prueba

La familia de defecto más grande del ledger —**9 de 56**— es *«escrito, probado
y sin conectar»*: el módulo existe, sus pruebas pasan, y **no corre en el camino
que el médico recorre**.

> el motor de sobredosis corriendo *después* de firmar · «Quitar de la nota»
> tocando un metadato de auditoría · los motores recibiendo la receta de hoy en
> vez del paciente entero · el 80,6 % de las correcciones tirado sin mirarlas

**Los nueve tenían prueba unitaria en verde.** Ninguna cantidad de pruebas de
pieza los habría encontrado, porque ninguna hacía la pregunta que importa: *¿esto
está en el camino?*

Este documento nombra el camino. Y su prueba lo recorre.

---

## Los siete pasos

Del paciente entrando a la nota firmada. La lista de módulos no es exhaustiva
—el camino toca decenas— sino **la columna vertebral**: lo que si se desconecta
deja al médico sin la parte del producto por la que paga.

### 1 · Escuchar

El médico habla y el paciente contesta; el audio se transcribe y se separa por
hablante.

`confianza-audio` · `motivo-sin-diarizacion` · `asr/especialidad-del-medico`

Cuando la separación de voces falla, el sistema **dice por qué** en vez de
atribuir al azar — lo que dijo el paciente quedando como dicho por el médico fue
REG-158.

### 2 · Entender lo dicho

Distinguir lo que se niega de lo que se afirma, y lo que pasó de lo que pasa hoy.

`negaciones` · `temporalidad` · `hueco-textual`

Es el paso donde más veces ha fallado el producto, y siempre por lo mismo: el
motor cubría el español que uno *escribiría*, no el que se *habla*. La negación
cazaba **1 de 7** formas mexicanas de decir que no; la temporalidad se comía diez
formas de decir «ya pasó».

### 3 · Extraer sin inventar

Convertir la conversación en datos, **dejando vacío lo que nadie dijo**.

`medical-ner` · `procedencia` · `via-asumida`

La regla que gobierna este paso: *vacío significa vacío*. Un hueco escrito —«no
refirió»— no es un dato; es la ausencia de uno, y guardarlo como dato es cómo
llegó una vía oral que nadie dictó a una receta firmada.

### 4 · Ver al paciente entero

Los motores reciben el cuadro completo, no sólo lo de hoy.

`cuadro-completo` · `problemas-activos`

REG-188: los motores clínicos veían **la receta que se estaba escribiendo** en
vez del paciente. Un motor de interacciones que no ve lo que el paciente ya toma
no está comprobando nada.

### 5 · Avisar antes de firmar

Una sola barra, tres niveles, y lo que no se pliega no se pliega.

`avisos-consulta` · `seguridad/dosis-de-la-lista` · `AntesDeFirmar`

Hubo ocho recuadros sobre la nota y sólo uno bloqueaba. Tres cosas **nunca se
pliegan**: alergia a un medicamento, contradicción con lo que el paciente negó, y
dosis peligrosa. Un aviso que estorba se aprende a ignorar, y entonces deja de
proteger.

### 6 · Poder corregir

**Quitar de la nota tiene que quitar de la nota.**

`quitar-de-la-nota` · `RevisionPanel`

REG-198: el botón sacaba el dato de un metadato de auditoría y el renglón se
tachaba en pantalla — mientras el diagnóstico equivocado seguía en la nota que se
firmaba. Un control que miente sobre lo que hizo es **peor que no tenerlo**: sin
botón, el médico habría borrado el renglón a mano.

### 7 · Firmar, o saber por qué no

El botón apagado dice su motivo; la firma sella lo firmado.

`por-que-no-se-firma` · `nom004` · `integrity`

Un botón deshabilitado sin explicación convierte al médico en adivino. Y lo
firmado queda sellado: el sello tiene versión propia para que un cambio de
formato no dispare una falsa alarma de integridad.

---

## Lo que la prueba comprueba, y lo que no

`src/__tests__/el-camino-del-medico-llega-entero.test.ts` parte de `src/app/` y
sigue los imports hasta donde lleguen. Para cada paso pregunta: **¿se llega hasta
aquí?**

**Lo que añade a lo que ya había** — `modulos-sin-conectar` caza el caso extremo:
el módulo que *nadie* importa. Pero un módulo puede estar importado por otro que
tampoco corre —una isla de dos— y pasar en verde. Esto recorre el grafo de
verdad.

**Lo que NO prueba, dicho aquí para que nadie lo suponga**:

- **No prueba que el módulo funcione.** Para eso están sus propias pruebas.
- **No prueba que corra en el momento correcto.** REG-190 y REG-173 eran motores
  perfectamente alcanzables que **llegaban tarde** — el aviso salía después de
  firmar. La alcanzabilidad no dice nada del cuándo.

Prueba **que el cable existe**, que es la condición previa a todo lo demás y la
que se rompió nueve veces.

---

## Lo que este producto se niega a hacer

Un documento de producto que sólo enumera funciones no dice nada del producto.
Estas negativas sí:

| No hace | Por qué |
|---|---|
| **El LLM no calcula una cifra clínica** | Escalas, dosis y conversiones las hace código probado ([ADR-002](../decisions/ADR-002-el-llm-no-calcula.md)) |
| **No rellena un hueco para que la nota se vea completa** | Un campo vacío es información; uno inventado es un riesgo con apariencia de dato |
| **No interrumpe con un paciente delante** | Los avisos de operación esperan; los clínicos no |
| **No deja firmar sin dosis ni sin unidad** | Decisión del médico dueño (REG-174, REG-175) |
| **No decide nada clínico** | Presenta, calcula y avisa. Quien decide y firma es el médico |
