# Índices compuestos de Firestore — lo que falta, con nombre

> **Estado**: `BLOCKED_EXTERNAL`. Este encabezado decía, hasta el 1-sep-2026,
> que el workflow «los manda desde v1175» y que lo único que faltaba era mirar
> la consola. **Era falso**: no se había enviado ni un índice —ver REG-506—.
> `firebase.json` no declaraba `firestore.indexes`, y sin esa clave el CLI
> anuncia el paso, recorre una lista vacía y contesta `Deploy complete!`.
> Corregido; el envío queda pendiente del **próximo** disparo del botón, y la
> construcción sigue mirándose en la consola. Ver «El envío no es la
> construcción», abajo.

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

## Los cuatro que ya hacían falta (REG-379)

La tabla de arriba son índices **anticipados**: para consultas que el código
todavía no hace. Al contarlas para preparar el despliegue aparecieron cuatro del
signo contrario — consultas que el producto **ya hace hoy** y cuyo índice no
estaba declarado en ninguna parte:

| Colección | La consulta | Dónde se rompe |
|---|---|---|
| `arco_requests` | `estado in [recibida, en_proceso]` → `orderBy fechaSolicitud` | La bandeja de derechos ARCO |
| `farmacia` | `activo == true` → `orderBy nombre` | La lista de la farmacia |
| `farmacia_movimientos` | `itemId ==` → `orderBy fecha` | El rastro de un controlado |
| `reviews` | `estado == publicada` → `orderBy publicadaEn` | La página **pública** del médico |

Ya están en `firestore.indexes.json`, y `el-indice-que-nadie-declaro.test.ts`
deriva la lista del árbol para que no vuelva a faltar ninguno.

**Lo que esto NO afirma**: que esas cuatro estén rotas en producción hoy. Firestore
crea índices a mano desde la consola cuando alguien sigue el enlace del error, y
un `deploy --only firestore:indexes` **no borra** los que no estén en el archivo,
así que el proyecto vivo puede tenerlos aunque el repositorio no los declarara.
Lo que sí estaba roto era la **declaración**: un consultorio nuevo, un proyecto
restaurado o una recreación desde este repositorio se habría quedado sin ellos.
Cuáles existen de verdad **se mira del otro lado**, en la consola del proyecto, y
eso no puede vivir aquí.

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

## El envío no es la construcción

`firebase deploy --only firestore:indexes` **contesta al enviar, no al terminar**.
La construcción de un índice compuesto sobre una colección con datos es asíncrona
y puede fallar **después** de que el comando haya dicho `success`.

Por eso un acta con `FIRESTORE_RULES = success` cierra la fila de las reglas
—ésas rigen en cuanto se publican— y **no cierra ésta**. Son dos afirmaciones
distintas que salen del mismo comando:

| Qué dijo el despliegue | Qué demuestra | Qué NO demuestra |
|---|---|---|
| `success` en las ejecuciones [#11](https://github.com/docrod29-ai/agenda-medica/actions/runs/33430863862), [#12](https://github.com/docrod29-ai/agenda-medica/actions/runs/33431057064) y [#13](https://github.com/docrod29-ai/agenda-medica/actions/runs/33470948206) | **Nada sobre los índices.** REG-506: las tres salieron bien sin enviar ninguno | Ni que llegaran, ni que estén construidos |
| A partir del arreglo de REG-506: la línea `deployed indexes in firestore.indexes.json successfully` en la salida, que el propio paso exige | Que el archivo **llegó** al proyecto | Que los índices estén **construidos** |

**Cómo se supo, y por qué no bastaba el código de salida.** El log de la #13
imprime `deploying indexes...` y salta directo a `Deploy complete!`, sin las dos
líneas que `firebase-tools` escribe cuando de verdad manda un archivo
(`reading indexes from …` y `deployed indexes in … successfully`). El comando
contestó que sí; el dato no cruzó. Desde REG-506 el paso **falla** si esa línea
no aparece.

**Lo que falta, y no puede vivir en este repositorio**: abrir la consola de
Firestore del proyecto `nexomed-agenda`, pestaña de índices, y comprobar que cada
uno dice `Enabled` y no `Building` ni `Error`. Hasta entonces, ninguna consulta
nueva puede depender de ellos — la regla del `FAILED_PRECONDITION` de abajo sigue
en pie tal cual.

## Después de desplegarlos

Cada fila de la tabla tiene su reparación esperando, y ninguna es automática: hay
que ir al módulo, cambiar la consulta y **quitar el aviso** que hoy declara el
sacrificio. Mientras el aviso siga escrito, el tablero puede seguir diciendo —con
razón— que el hueco existe.
