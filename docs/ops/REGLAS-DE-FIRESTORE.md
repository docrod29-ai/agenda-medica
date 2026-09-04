# Reglas de Firestore — qué está escrito y qué rige de verdad

> **Estado**: lo escrito **es** lo que rige. `firestore.rules` se publicó el
> **31-ago-2026** junto con `nexusmed-v1177`, y el sello lo registra. Este archivo
> dice cómo se sabe eso sin fiarse de la memoria de nadie.

## El problema que este archivo cierra

`firestore.rules` vive en el repositorio, se revisa en cada PR y se prueba contra
el emulador. Y **`vercel --prod` no lo publica**. El despliegue es otro comando y
otra autorización:

```bash
npx firebase deploy --only firestore:rules --project nexomed-agenda
```

Entre las dos cosas hay un hueco donde caben meses. El repositorio queda diciendo
una verdad —«esta colección está protegida así»— que **en producción no rige**, y
nada lo detecta: la suite pasa, el emulador pasa, el PR se ve bien.

Ya pasó, y duró meses: `docs/roadmap/nexus-os/estado.json` llevaba anotado desde
E0-06 que el bloque `clinico` estaba modificado en el repositorio y sin desplegar.

## Cómo deja de depender de que alguien se acuerde

`firestore.rules.estado.json` guarda el **sha256 de las reglas que se
confirmaron desplegadas**. El guardián
`src/__tests__/las-reglas-escritas-no-son-las-que-rigen.test.ts` compara ese
hash con el de las reglas de hoy:

- **Iguales** → lo escrito es lo que rige. La lista de pendientes tiene que estar
  **vacía**, o estaría asustando con un hueco ya cerrado.
- **Distintos** → hay cambios sin desplegar, y entonces este documento **tiene
  que decir cuáles** en la sección de abajo. Si no lo dice, el guardián falla.

Es la misma regla que el resto del repositorio: el estado se **deriva**, no se
recuerda. Lo único que se pide a mano es lo que ninguna máquina puede saber —qué
se rompe mientras tanto— y eso es justo lo que hay que escribir.

**El hash no se actualiza para poner una prueba en verde.** Sólo se actualiza
después de correr el despliegue y ver que terminó bien. Un registro de despliegue
que se edita para pasar el CI deja de ser un registro.

### Y el valor a pegar lo emite el propio despliegue

Calcular el hash a mano era el último sitio donde esto seguía dependiendo de que
alguien se acordara. El paso **«Firestore · emitir el sello de las reglas»** del
workflow lo calcula sobre el árbol que **acaba de publicar** y lo escribe en el
acta de la ejecución, junto al `FIRESTORE_RULES_SHA256` del resumen. Actualizar
el sello es copiar tres líneas de un acta, no reconstruir un dato.

Que ese paso no se pueda borrar en silencio lo vigila
`src/__tests__/el-despliegue-emite-su-propio-sello.test.ts` (REG-416).

## PENDIENTE DE DESPLIEGUE

Mientras esta lista no esté vacía, hay reglas escritas que no protegen nada en
producción.

| Regla | Qué NO rige hoy | Consecuencia mientras tanto |
|---|---|---|
| `clinics/{id}/patients/{pid}/preguntas_paciente/{doc}` | El `match` nuevo de V9 `PATIENT-AI-001` (`read: isMedico`, `write: if false`) | **Sin exposición de acceso, y conviene decir por qué.** La colección cae en el comodín de denegación de la raíz, así que hoy ningún cliente la lee ni la escribe — tampoco el médico. Quien escribe es el servidor con Admin SDK, que se salta las reglas, así que el portal del paciente funciona igual. Lo que no rige hasta desplegar es la **lectura del consultorio** por SDK de cliente: la pantalla donde el médico vea lo que preguntaron sus pacientes no traerá nada. Hoy esa pantalla no existe, así que el hueco es teórico; deja de serlo el día que alguien la escriba, y entonces parecerá un defecto de la pantalla |

Mientras esta fila esté aquí, `firestore.rules` tiene una regla escrita que no
protege ni habilita nada en producción. Se despliega con el botón de producción
(`npx firebase deploy --only firestore:rules`), y eso es decisión del dueño.

## Lo que se desplegó, y cuándo

| Cuándo | Qué se publicó | Con qué evidencia |
|---|---|---|
| **31-ago-2026, 19:33 UTC** | `firestore.rules` entero, sobre el árbol `8f74901d` (v1177) | Ejecuciones [#11](https://github.com/docrod29-ai/agenda-medica/actions/runs/33430863862) y [#12](https://github.com/docrod29-ai/agenda-medica/actions/runs/33431057064), las dos con `FIRESTORE_RULES = success` y `PRODUCTION_RELEASE = SUCCESS` |

Con eso quedaron rigiendo las tres cosas que esta lista llevaba meses declarando
rotas: el `match` de `clinics/{id}/members/{uid}` —y con él el apodo del chat del
consultorio, que hasta entonces **no se guardaba nunca** y caía con elegancia al
nombre por omisión (REG-340)—, el bloque de `clinics/{id}/patients/{pid}/clinico/{doc}`
de E0-06, y los `match` de las nueve colecciones que REG-340 declaró.

**El paso publica el archivo entero cada vez**, traiga cambios o no. Por eso un
`FIRESTORE_RULES = success` en un acta significa «se publicó lo que había», no
«este paquete tocó las reglas». Distinguirlo importa: `firestore.rules` es la
frontera de aislamiento entre consultorios, y leer ese `success` como un cambio
manda a revisar algo que no existe.

## Qué NO arregla desplegarlas

Desplegar las reglas **no** deja construidos los índices. Van en el mismo comando
del workflow, pero `deploy --only firestore:indexes` **contesta al enviar, no al
terminar**: la construcción de un índice compuesto es asíncrona y puede fallar
después. «Deploy success» no es «índices `Enabled`».

Cuáles están construidos de verdad **se mira del otro lado**, en la consola del
proyecto. El detalle, y las cuatro consultas que hoy siguen sacrificando algo por
no tenerlos, están en `docs/ops/INDICES-DE-FIRESTORE.md`.
