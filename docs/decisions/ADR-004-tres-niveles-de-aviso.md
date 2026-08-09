# ADR-004 · Tres niveles de aviso, no un recuadro por motor

**Estado**: Vigente · **Fecha**: 5-ago-2026 (REG-181)

---

## Contexto

Cada motor de seguridad clínica quiere avisar: dosis incompleta, alergia cruzada,
vía no dictada, interacción, controlado, contradicción con el dictado, desajuste
temporal, conflicto de extracción, requisito NOM-004, sobredosis.

Cada uno se añadió con su propio recuadro. El resultado, medido sobre la pantalla
real del médico dueño: **ocho bloques apilados sobre la nota, unos cuarenta
elementos, tres de ellos rojos — y sólo uno impedía firmar.**

Su reacción, textual: *«esto nomás confunde… sin tanta mamada que desubique y
confunda a los médicos»*.

## Decisión

**Tres niveles, y sólo tres.** Un motor nuevo declara su nivel en una tabla y
entra en una lista que ya existe. No se añaden recuadros.

| Nivel | La pregunta que responde |
|---|---|
| **BLOQUEA** | ¿es la razón por la que el botón Firmar no responde? |
| **REVISA** | ¿pide una decisión antes de firmar, aunque no lo impida? |
| **YA EN LA NOTA** | ¿es contenido que ya está escrito? |

Y una regla aparte: **lo que puede matar hoy no se pliega**, aunque no bloquee.

## Por qué

El problema no era que sobraran avisos: era que **estaban todos al mismo
volumen**. Había tres recuadros rojos y dos no bloqueaban nada.

**Cuando todo grita, nada se oye** — y lo que se acaba ignorando es el que sí
importaba. La fatiga de alerta no es un problema estético: es el mecanismo por el
que un médico deja de leer el aviso que le habría salvado un paciente.

## Alternativas descartadas

**1. Ordenar los ocho recuadros por gravedad.** Descartada: ocho recuadros
ordenados siguen siendo ocho recuadros, y siguen empujando la nota fuera de la
pantalla.

**2. Dejar que cada motor decida su color.** Es lo que había, y produjo tres
rojos de los que dos no bloqueaban. La decisión de nivel no puede tomarla quien
tiene interés en que su aviso destaque.

**3. Un solo nivel con todo plegado.** Descartada: escondería lo que apaga el
botón Firmar, y el médico pulsaría sin entender por qué no pasa nada.

## Consecuencias

**Aceptadas, y la primera duele:**

- **Plegar es esconder.** La vía asumida y el desajuste temporal se van a leer
  menos que antes. Es un precio consciente a cambio de que el rojo vuelva a
  significar algo, y está escrito en el código (`EL_PRECIO_QUE_SE_PAGA`).
- **`bloquea` no significa «es lo más grave».** El cruce alergia ↔ medicamento es
  lo peor de la pantalla y **no bloquea**: esa decisión es del médico dueño. Lo
  que se hace con lo grave que no bloquea es **no plegarlo nunca**.
- La tabla de niveles es un punto único: mal puesta, degrada un riesgo real en
  silencio. Por eso está a la vista y una prueba la recorre entera.

**A favor:**

- Lo que bloquea quedó **más** visible que antes, no menos.
- Ningún aviso desapareció: se recolocaron y se plegaron.
- Cuatro de las nueve viñetas de «datos críticos» eran **ecos** de la compuerta
  de dosis; ahora se deduplican.

## Cómo se hace cumplir

- `src/lib/expediente/avisos-consulta.ts` — módulo puro con la tabla `NIVEL` y la
  lista `NO_SE_PLIEGAN`, ambas explícitas.
- `src/__tests__/una-barra-y-no-ocho-recuadros.test.ts` recorre **los diez
  orígenes** y falla si alguno pierde su nivel o si alergia/contradicción salen
  de `NO_SE_PLIEGAN`.
