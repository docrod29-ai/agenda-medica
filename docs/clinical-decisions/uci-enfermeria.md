# ADR · Turno de enfermería de UCI (§40)

**Motor:** `uci-enfermeria` · `src/lib/uci/enfermeria.ts`
**Estado:** `validado`.

## Fuente de verdad

Charter §40 vía ICU-001, con su condición: **«el charter dice: después del core
médico»**. Y así se hizo — es la última unidad del backlog, y no inventa ningún
motor: compone el MAR (§37) y la antigüedad de la última toma (§3).

## Referencia

Ninguna clínica. Todas las frases vienen ya redactadas por el motor de origen;
este módulo no reescribe ninguna.

## Lo que este módulo NO sabe, y lo dice en pantalla

**No prioriza clínicamente.** Ordena por el estado del **registro**, no por la
gravedad de lo pendiente: un antibiótico atrasado y una vitamina atrasada se ven
exactamente igual desde aquí.

El módulo no sabe cuál importa más, y fingir que sí sería un juicio clínico. Por
eso `NO_PRIORIZA_CLINICAMENTE` se muestra **arriba de la lista**, no en un
comentario que nadie lee. Un caso comprueba además que no existe ningún export
con nombre de severidad, urgencia o riesgo.

## Lo que nunca aparece

Infusión continua, PRN, dosis única ya administrada y orden suspendida. **No se
atrasan por definición**, y ponerlas en rojo cada hora haría que el rojo dejara
de significar algo — la misma razón que gobierna el MAR.

Cuatro casos lo congelan, uno por cada caso.

## De dónde sale cada tarea

| Tarea | Hecho registrado |
|---|---|
| medicamento atrasado / toca | motor del MAR, con la gracia que fija la unidad |
| sin toma | no hay ninguna medición en el episodio |
| horario ilegible | orden activa cuyo horario no se pudo interpretar |

El horario ilegible es trabajo del médico, pero enfermería es quien se topa con
él: por eso sale aquí en vez de quedarse enterrado.

## La lista también dice quién está al día

`sinTareas` lista los pacientes sin pendientes. Una lista que sólo muestra lo que
falta esconde que el resto va bien, y eso hace que se lea como si toda la unidad
estuviera atrasada.

## Golden

`src/__tests__/uci-enfermeria.test.ts` — **23 casos**.

Un caso **encontró un defecto real durante el desarrollo**: la gracia sólo se
validaba dentro del MAR, así que un paciente **sin ninguna indicación** dejaba
pasar una gracia inválida en silencio. Ahora se valida en la entrada.

## Lo que NO se asume

La **gracia** en minutos la fija la unidad, igual que en el MAR. La pantalla la
muestra y dice que es un valor **operativo, no clínico**.
