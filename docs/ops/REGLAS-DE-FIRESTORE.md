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

**Hoy NO está vacía** (6-sep-2026, al fusionar la rama de laboratorio):

| Regla escrita y sin desplegar | De dónde viene | Qué NO protege mientras tanto |
|---|---|---|
| `match /platform_authz_denegadas/{denId}` — `allow read, write: if false` | REG-533, el registro de denegaciones de autorización que lee el vigilante | **Nada, y hay que decirlo con precisión.** Esta regla no ABRE ni CIERRA nada por sí sola: el `match /{document=**}` del final ya deniega todo lo no declarado, así que la colección está cerrada al cliente esté o no desplegada esta regla. Lo que falta es que la regla sea EXPLÍCITA, que es lo que impide que un `match` futuro más laxo la deje al descubierto sin que nadie lo note |

Se despliega con el resto, y **eso es acto del dueño**:
`npx firebase deploy --only firestore:rules --project nexomed-agenda`.

La última fila que hubo aquí era el `match` de
`clinics/{id}/patients/{pid}/preguntas_paciente/{doc}` (V9 `PATIENT-AI-001`),
escrito al fusionarse #443 y sin regir hasta la ejecución **#18** del botón de
producción, el 4-sep-2026. Se cerró ahí.

Esta sección no se vacía a mano para poner una prueba en verde: la vacía haber
desplegado. El guardián
`src/__tests__/las-reglas-escritas-no-son-las-que-rigen.test.ts` compara el hash
en los dos sentidos —si hay hueco exige que se declare, y si no lo hay exige que
la lista esté vacía—, así que mentir en cualquiera de las dos direcciones pone
rojo el CI.

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
