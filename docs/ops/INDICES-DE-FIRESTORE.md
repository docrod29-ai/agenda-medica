# Índices compuestos de Firestore — lo que falta, con nombre

> **Estado**: `BLOCKED_EXTERNAL`. Este archivo **declara** los índices; no los
> crea. Desplegarlos es una acción del dueño (ver abajo).

## Por qué existe este archivo

Hasta hoy los índices que le faltan a este producto vivían **en comentarios**,
uno por módulo, cada uno explicando por qué su consulta está peor de lo que
debería:

| Dónde | Qué se sacrificó por no tener el índice |
|---|---|
| `tareas-clinicas/firestore.ts` | El worklist devuelve **200 tareas arbitrarias** de N. No las más urgentes: las que Firestore devuelva. Es P1-14 del tablero de Ausculta |
| `whatsapp/ofrecer-hueco.ts` | La lista de espera se lee **sin orden de prioridad**: con más entradas que el tope, el hueco puede ofrecérsele a alguien menos prioritario |
| `hooks/useAppointments.ts` | Las citas de un paciente se leen **sin cota** en un listener en vivo. Acotar sin orden sería peor: perdería la cita de hoy, y con ella el enlace entre el cobro y el encuentro |
| `expediente/firestore.ts` (`getUltimasNotasResumen`) | El resumen mira una **ventana** de las 40 notas más recientes y filtra el estado en memoria, en vez de pedir las 3 firmadas más recientes |

Un comentario no es un entregable. Repartidos así, nadie puede saber **cuántos
faltan** ni pedirlos de una vez, y cada módulo vuelve a descubrir la pared por su
cuenta. Es el patrón `depende_de_recordar` de este repositorio: el dato existe y
el registro que lo reúne, no.

## La regla que hace peligroso improvisar aquí

**Una consulta que necesita un índice que no existe no devuelve una lista vacía:
falla entera**, con `FAILED_PRECONDITION`. Así se abrió el worklist por primera
vez en producción — con un error, no con una pantalla vacía.

Por eso **ninguna consulta nueva puede depender de un índice de este archivo
hasta que esté desplegado**. Mientras tanto se escribe la versión que funciona
sin él, aunque sea peor, y el sacrificio **se declara en el módulo**.

## Cómo se despliegan (requiere autorización del dueño)

`vercel --prod` **no** publica esto, igual que no publica `firestore.rules`:

```bash
npx firebase deploy --only firestore:indexes --project nexomed-agenda
```

Crear un índice sobre una colección con datos **tarda** (minutos u horas según el
volumen) y hasta que termina la consulta sigue fallando. Por eso se despliega y
se **verifica** antes de tocar el código que lo usaría.

## Después de desplegarlos

Cada fila de la tabla tiene su reparación esperando, y ninguna es automática: hay
que ir al módulo, cambiar la consulta y **quitar el aviso** que hoy declara el
sacrificio. Mientras el aviso siga escrito, el tablero puede seguir diciendo —con
razón— que el hueco existe.
