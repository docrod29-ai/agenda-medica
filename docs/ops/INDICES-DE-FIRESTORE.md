# Índices compuestos de Firestore — los que hay, y en qué orden se despliega

> ⚠️ **EL TRECE NO ESTÁ CONSTRUIDO.** Al fusionar la rama de laboratorio
> (6-sep-2026) entra una consulta compuesta nueva —`errores` · `visto` ↑ ·
> `fecha` ↓, del vigilante— que **Firestore RECHAZA hasta que su índice se
> construya**. Está declarado en `firestore.indexes.json` y NO desplegado:
> desplegar índices es acto del dueño (`npx firebase deploy --only
> firestore:indexes --project nexomed-agenda`). Los doce anteriores siguen
> construidos y sirviendo.
>
> **Estado**: **trece** índices declarados; **doce construidos en producción** y **las
> consultas ya los usan** (REG-421, REG-422, REG-423).
>
> **DESPLEGADOS Y CONSTRUIDOS — 2-sep-2026.** El detalle, con los
> identificadores que el proyecto dio a cada uno, en «Por qué NINGUNO existió
> hasta el 2-sep» y «CONSTRUIDOS», abajo.
>
> **Los doce dicen `Enabled`** en la consola de `nexomed-agenda` — comprobado por
> el dueño el **2-sep**, del otro lado, que es el único sitio donde eso se puede
> comprobar.
>
> **Antes de ese día no había NINGUNO.** No siete, no ocho: cero. Esa cifra la
> midió el dueño abriendo «Índices → Manuales» el 1-sep y encontrando la pestaña
> **vacía**, sobre un proyecto cuyas actas de despliegue llevaban meses diciendo
> `success`. Este documento afirmó «ocho de los doce se enviaron» hasta el 2-sep,
> y era falso: se corrige aquí en vez de borrarse, porque el error es la lección.
>
> Hicieron falta **dos** arreglos, y ninguno bastaba solo:
>
> | Herida | Qué pasaba | Dónde se arregló |
> |---|---|---|
> | **REG-431** | `firebase.json` declaraba `firestore.rules` y **nunca** el archivo de índices. `--only firestore:indexes` no encontraba nada que publicar y devolvía `success` | En este repositorio |
> | **El 403** | Declarado el archivo, la cuenta de servicio **no tenía permiso** para crear índices. Salió a la luz en la ejecución [#14](https://github.com/docrod29-ai/agenda-medica/actions/runs/33567555699) (1-sep 22:41 UTC), que falló ruidosamente — el primer fallo honesto de esta serie | En IAM de Google Cloud: rol `roles/datastore.indexAdmin`. **No** en este repositorio |
>
> La primera ejecución que publicó índices de verdad fue la
> [#15](https://github.com/docrod29-ai/agenda-medica/actions/runs/33572744371)
> (1-sep 23:50 UTC), con `FIRESTORE_INDICES=success` — una fila del acta que no
> existía dos horas antes, y que trajo REG-433 justamente para poder distinguir
> este acto del de las reglas. La [#16](https://github.com/docrod29-ai/agenda-medica/actions/runs/33573846056)
> lo repitió sin cambiar nada, que es lo que se espera de un despliegue idempotente.
>
> Y enviar sigue sin ser construir: ver «El envío no es la construcción». Lo que
> cerró esta fila no fue el `success`, fue la consola.
>
> **Léase «El orden importa» antes de fusionar nada.**
>
> El número de arriba y la tabla de abajo **no se escriben a mano**: los vigila
> `src/__tests__/el-indice-que-nadie-declaro.test.ts` contra
> `firestore.indexes.json`. Se escribían a mano hasta REG-422, y decían **nueve**
> cuando había **diez** — sobre la lista con la que el dueño verifica la consola.
>
> **Y desde REG-424 el orden ya no es lo único que separa de una pantalla rota**:
> las cuatro consultas indexadas se caen al camino de antes si su índice todavía
> no existe, y lo DICEN. El orden sigue siendo el correcto; lo que ya no depende
> de acordarse es el daño. Ver «Y si el índice todavía no está», abajo.

## El orden importa, y es contraintuitivo

**Los índices se despliegan ANTES que el código que los usa.** No después, no a
la vez.

Una consulta que necesita un índice que no existe **no devuelve una lista vacía:
falla entera**, con `FAILED_PRECONDITION`. Así se abrió el worklist por primera
vez en producción — con un error, no con una pantalla vacía.

Y el botón de producción (`.github/workflows/deploy-production.yml`) **no** salva
de esto: su compuerta 3 exige que el sitio vivo YA sirva la versión antes de
publicar los índices. O sea que, si el código nuevo llega a producción por la
integración de Vercel antes de que los índices existan, hay una ventana con las
pantallas rotas. La ventana se cierra desplegando los índices primero:

```bash
npx firebase deploy --only firestore:indexes --project nexomed-agenda
```

Ese comando no toca Vercel, no toca `firestore.rules` y **no borra** los índices
que ya existan y no estén en el archivo. Crear un índice sobre una colección con
datos tarda de minutos a horas, y **hasta que termina la consulta sigue
fallando**: por eso se despliega, se espera, y se comprueba en la consola
(https://console.firebase.google.com/project/nexomed-agenda/firestore/indexes)
que los **doce** dicen **Habilitado**, no «Compilando».

## Por qué NINGUNO existió hasta el 2-sep (REG-431 + el 403)

**Medido en la consola el 1-sep-2026**: `Firestore → Índices → Manuales` del
proyecto `nexomed-agenda` estaba **vacía**. Cero índices compuestos.

La causa no era el permiso ni la construcción: `firebase.json` declaraba
`firestore.rules` y **nunca declaró `firestore.indexes.json`**. Un
`deploy --only firestore:indexes` sin esa línea no falla — no encuentra nada que
publicar y devuelve `success`. Por eso el acta de v1177 cuadra y la consola está
vacía: las reglas sí llegaron; los índices no llegaron nunca.

Ya está declarado, y lo sostiene
`src/__tests__/lo-que-el-despliegue-dice-publicar-esta-declarado.test.ts`, que
deriva los objetivos del `--only` del workflow real y exige que cada uno esté
declarado.

**Y declararlo no bastó.** La primera ejecución con el archivo ya declarado
—la [#14](https://github.com/docrod29-ai/agenda-medica/actions/runs/33567555699),
1-sep 22:41 UTC— falló así:

```
i  firestore: reading indexes from firestore.indexes.json...   ← esta línea era nueva
i  firestore: deploying indexes...
Error: …/collectionGroups/appointments/indexes had HTTP Error: 403,
       The caller does not have permission
```

Dos heridas encadenadas, y la segunda sólo se podía ver una vez curada la
primera: la cuenta de servicio publicaba **reglas** pero no podía crear
**índices** — son permisos distintos, y `datastore.indexes.create` no viene con
el de reglas. Se concedió `roles/datastore.indexAdmin` en IAM de Google Cloud, y
la [#15](https://github.com/docrod29-ai/agenda-medica/actions/runs/33572744371)
publicó los doce.

Que ese 403 saliera **con nombre y apellido** en vez de perderse es mérito de
REG-433, que separó reglas e índices en dos pasos con dos resultados horas antes.
El acta de la #14, con el paso único, culpó a `firestore.rules` — que era lo
único que había salido bien.

**Consecuencia para la tabla de abajo**: la columna «¿enviado?» llegó a decir
ocho. **Eran cero.** Hoy son doce y están construidos; se deja escrito el número
falso porque la lección no es el número, es que se contaba sobre el árbol
desplegado —cierto e insuficiente— en vez de sobre el proyecto.

## El envío no es la construcción

`firebase deploy --only firestore:indexes` **contesta al enviar, no al terminar**.
La construcción de un índice compuesto sobre una colección con datos es asíncrona
y puede fallar **después** de que el comando haya dicho `success`.

Por eso un acta con `FIRESTORE_RULES = success` cierra la fila de las reglas
—ésas rigen en cuanto se publican— y **no cierra ésta**. Son dos afirmaciones
distintas que salen del mismo comando:

| Qué dijo el despliegue | Qué demostraba | Qué NO demostraba |
|---|---|---|
| `success` el 31-ago, ejecuciones [#11](https://github.com/docrod29-ai/agenda-medica/actions/runs/33430863862) y [#12](https://github.com/docrod29-ai/agenda-medica/actions/runs/33431057064) | **Nada.** Ni siquiera que el archivo llegara: `firebase.json` no lo declaraba (REG-431) | Que los índices existieran |
| `FIRESTORE_INDICES=success` el 1-sep, ejecución [#15](https://github.com/docrod29-ai/agenda-medica/actions/runs/33572744371) | Que `firestore.indexes.json` llegó al proyecto y Firestore aceptó las doce peticiones | Que los índices estén **construidos** |
| Los doce en `Enabled` en la consola, 2-sep | Que están **construidos y sirviendo** | — |

Las dos primeras filas son la misma frase (`success`) valiendo cosas distintas, y
por eso esta tabla existe. La de arriba del todo es la más cara: durante meses el
acta cuadró sobre un proyecto con **cero** índices, porque el comando hizo
literalmente todo lo que se le pidió y lo que se le pidió era nada.

**Lo que no puede vivir en este repositorio**: sólo la última fila. `Enabled` se
mira abriendo la consola de Firestore de `nexomed-agenda`, pestaña de índices, y
comprobando que ninguno dice `Building` ni `Error`. Ninguna prueba de aquí puede
afirmarlo, y por eso ninguna lo intenta.

### CONSTRUIDOS — comprobado en la consola el 2-sep-2026

**Los doce dicen `Habilitado`.** Ni uno en `Compilando`, ni uno en `Error`.

Lo miró el dueño en `Firestore → Índices → Manuales` del proyecto
`nexomed-agenda`, en las dos páginas del listado (`1-10 de 12` y `11-12 de 12`),
y mandó la captura de cada una. La misma pestaña que el 1-sep estaba **vacía**.

Y coinciden con lo declarado **campo por campo**, comparando el listado de la
consola contra `firestore.indexes.json`: doce declarados, doce construidos,
misma colección, mismos campos, mismo sentido. Ninguno de más — que sería un
índice huérfano pagándose sin usarse — y ninguno de menos.

Los identificadores que el proyecto les dio, por si hay que buscar uno en la
consola — la tabla de «Los doce» de abajo sigue siendo la que enumera qué hace
cada uno, y no se repite aquí para que no puedan divergir:

| ID en el proyecto | Índice |
|---|---|
| `CICAgOjXh4EK` | appointments · pacienteId↑ · fechaHora↓ |
| `CICAgOjXh4EJ` | arco_requests · estado↑ · fechaSolicitud↓ |
| `CICAgJiUpoMK` | clinic_invitations · clinicId↑ · createdAt↓ |
| `CICAgJim14AK` | farmacia · activo↑ · nombre↑ |
| `CICAgJjF9oIK` | farmacia_movimientos · itemId↑ · fecha↓ |
| `CICAgJj7z4EK` | notas · estado↑ · fechaConsulta↓ |
| `CICAgOi3kJAK` | platform_cost_ledger · feature↑ · ts↓ |
| `CICAgNi47oMK` | reviews · estado↑ · publicadaEn↓ |
| `CICAgNiav4AK` | tareas_clinicas · estado↑ · pesoUrgencia↑ · creadaEn↑ |
| `CICAgJiUsZIK` | tareas_clinicas · estado↑ · creadaEn↑ |
| `CICAgNirolEK` | waitlist · estado↑ · prioridad↑ · createdAt↑ |
| `CICAgNjpgYIK` | waitlist · estado↑ · createdAt↑ |

`__name__` aparece en la consola y no en el archivo: lo añade Firestore solo.
No es una diferencia.

**Con esto la cadena queda cerrada de punta a punta** — declarados (REG-431) →
enviados (ejecución #15, tras el rol `roles/datastore.indexAdmin`) →
**construidos**. Las cuatro consultas que dependían de ellos ya pueden ordenar
por lo que les toca, y la degradación de REG-424 vuelve a ser lo que debe ser:
una red por si acaso, no el camino de todos los días.

### Cómo se vuelve a comprobar

Esto **no se puede medir desde el repositorio** y por eso no hay guardián: hay
que abrir la consola. Se rehace igual —las dos páginas del listado— cada vez
que se añada un índice nuevo a `firestore.indexes.json`, y el renglón de arriba
vuelve a abrirse hasta que alguien lo mire. Hasta entonces, ninguna consulta
nueva puede depender de ellos — la regla del `FAILED_PRECONDITION` de abajo sigue
en pie tal cual.

**Para el próximo índice que se añada**: el `success` del despliegue ya vale más
que antes —la fila 2 es real— pero sigue sin cerrar la fila 3. La secuencia
completa es: fusionar el índice → apretar el botón → **mirar la consola** → y sólo
entonces fusionar el código que lo usa.

## Los trece, y quién los usa

| Colección | Campos | Quién la hace |
|---|---|---|
| `appointments` | pacienteId ↑ · fechaHora ↓ | `usePatientAppointments` — las citas del paciente en la consulta |
| `errores` | visto ↑ · fecha ↓ | El vigilante: los errores del navegador sin ver, del más nuevo al más viejo (REG-533). **Declarado, aún NO construido.** |
| `arco_requests` | estado ↑ · fechaSolicitud ↓ | La bandeja de derechos ARCO |
| `clinic_invitations` | clinicId ↑ · createdAt ↓ | `listarInvitaciones` — invitar a alguien al consultorio |
| `farmacia` | activo ↑ · nombre ↑ | La lista de la farmacia |
| `farmacia_movimientos` | itemId ↑ · fecha ↓ | El rastro de un controlado |
| `notas` | estado ↑ · fechaConsulta ↓ | `getUltimasNotasResumen` — las tres firmadas más recientes |
| `platform_cost_ledger` | feature ↑ · ts ↓ | `superadmin/simulador` — el costo MEDIDO por nota, con el que se decide el precio (**SDK admin**, REG-422) |
| `reviews` | estado ↑ · publicadaEn ↓ | La página **pública** del médico |
| `tareas_clinicas` | estado ↑ · creadaEn ↑ | `tareasVivas` — la RED de seguridad del worklist: trae también las tareas históricas sin `pesoUrgencia` |
| `tareas_clinicas` | estado ↑ · pesoUrgencia ↑ · creadaEn ↑ | `tareasVivas` — el recorte del worklist **por urgencia** (REG-423, cierra P1-14) |
| `waitlist` | estado ↑ · createdAt ↑ | `getWaitlist` — la pantalla de lista de espera |
| `waitlist` | estado ↑ · prioridad ↑ · createdAt ↑ | `ofrecerHuecoLiberado` — a quién se le ofrece un hueco |

Las dos filas de `waitlist` **no sobran**: Firestore exige que el campo del
`orderBy` vaya inmediatamente después de las igualdades y no admite campos de
más, así que el índice de tres **no sirve** para la consulta de dos. Ésa fue
exactamente la trampa de REG-421.

`platform_cost_ledger` es la fila de REG-422, y su forma de esconderse fue otra:
la hace el **SDK admin**, que el guardián no sabía leer y su encabezado declaraba
como limitación. Lo caro no era el error de Firestore sino lo que hay encima —
`superadmin/simulador` envuelve esa consulta en un `try/catch` que devuelve el
promedio VACÍO y escribe «sin libro de costos». El índice que falta **no se ve
como un fallo: se ve como que no hay datos de costo**, sobre la pantalla con la
que se decide el precio del producto.

## Los cuatro sacrificios, reparados (REG-421)

Estas cuatro consultas estaban escritas peor de lo que debían **a propósito**,
cada una con su aviso, porque su índice no existía. Ya no:

| Módulo | Era | Es |
|---|---|---|
| `tareas-clinicas/firestore.ts` | 200 tareas **arbitrarias** de N | `orderBy creadaEn`: las que se caen son las más nuevas, nunca las viejas |
| `whatsapp/ofrecer-hueco.ts` | lista de espera leída sin orden: el hueco podía ofrecérsele a quien no tocaba | `orderBy prioridad, createdAt`: el recorte se lleva a los MENOS prioritarios |
| `hooks/useAppointments.ts` | listener vivo sin cota sobre el historial entero del paciente | `orderBy fechaHora desc` + `limit(50)`, con `truncada` declarado |
| `expediente/firestore.ts` | 40 notas bajadas para quedarse con 3 | `where estado == firmada` + `limit(3)` |

**Lo que sigue abierto**: P1-14 pedía «las tareas más urgentes» y el worklist da
«las más antiguas». Ordenar por urgencia en el servidor necesita un índice
`(estado, prioridad, creadaEn)` **y** un campo numérico de peso, porque
`prioridad` guarda texto y en orden alfabético `alta` iría antes que `critica`.
Es trabajo con nombre, no un olvido.

## Quién vigila que no vuelva a faltar ninguno

`src/__tests__/el-indice-que-nadie-declaro.test.ts` deriva del árbol todas las
consultas del SDK de cliente que Firestore no puede servir sin índice compuesto,
y comprueba que cada una tenga el suyo **con los campos en el orden correcto**.

Lo que **no** cubre, declarado:

- ~~**El SDK admin.**~~ **Ya lo lee, desde REG-422** — las cadenas
  `.collection('x').where(…).orderBy(…)`. Era una limitación declarada, y como
  toda limitación declarada acabó tapando un hueco real.
- **Una cadena admin cuya colección no sea un literal.** Hoy las dos que hay lo
  son; el día que una use una variable, esa consulta entra en `ilegibles` y el
  guardián se pone rojo — no la da por buena.
- **El `queryScope`.** Un índice de `COLLECTION` no sirve para un
  `collectionGroup`, y eso pasaría en verde.
- **Si el índice está construido.** Declararlo, desplegarlo y verlo `Enabled` son
  tres actos, y los dos últimos se miran del otro lado, en la consola. Ninguna
  prueba de este repositorio puede decir nada de eso.

## Lo que hay que mirar del otro lado antes de dar esto por hecho

Regla «el dato tiene que LLEGAR». Sobre datos reales se cuentan **recuentos,
nunca contenido** — llevan PHI y por eso esto no puede vivir en CI
(`scripts/verificar-invariantes-de-datos.md`):

1. Los **trece** índices, `Enabled` en la consola. No «enviados».
   **REABIERTO el 6-sep-2026**, exactamente como este punto decía que pasaría:
   «vuelve a abrirse el día que esa tabla crezca». Creció. Doce siguen
   `Enabled` desde el 2-sep; el trece —`errores` · `visto` ↑ · `fecha` ↓— está
   declarado y **sin construir**, y hasta que se construya Firestore RECHAZA la
   consulta del vigilante. Desplegar índices es acto del dueño.
2. En `waitlist`: cuántas entradas hay, y cuántas tienen `prioridad` **y**
   `createdAt`. Los dos números tienen que ser el mismo. Un `orderBy` de
   Firestore **excluye** los documentos a los que les falta el campo — no los
   pone al final —, así que una entrada sin `prioridad` desaparecería de la
   lectura sin que nada lo dijera. Hoy `createWaitlistEntry` es el único escritor
   y siempre los pone; esto comprueba que no haya nada más viejo.
3. En `tareas_clinicas`: total contra los que tienen `creadaEn`, por lo mismo.
4. En `tareas_clinicas`: total contra los que tienen `pesoUrgencia`. Mientras no
   sean el mismo número, el worklist sigue pagando su segunda lectura — que es lo
   que impide que un pendiente histórico desaparezca. Lo apaga el backfill:

   **Sin terminal**: Actions → «Backfill de pesoUrgencia (manual)» → Run
   workflow. Sin marcar nada **cuenta lo que haría y no escribe**; para aplicarlo
   hay que marcar la casilla `escribir`. Los recuentos salen en el resumen de la
   ejecución. Esa credencial vive en los secretos del repositorio y no se puede
   sacar de ahí, que es la razón de que este paso llevara meses pendiente.

   Con terminal y una copia de la credencial:

   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=<sa.json> \
     node scripts/migraciones/peso-de-urgencia.mjs --proyecto nexomed-agenda           # ensayo
   GOOGLE_APPLICATION_CREDENTIALS=<sa.json> \
     node scripts/migraciones/peso-de-urgencia.mjs --proyecto nexomed-agenda --escribir
   ```

   Es idempotente y no toca `prioridad`: una tarea sin prioridad legible se
   escribe con el peso «sin clasificar», que la manda al final del worklist pero
   **la deja dentro**.

## `pesoUrgencia` NO añade un despliegue de reglas — comprobado

El campo nuevo de REG-423 se escribe en `clinics/{id}/tareas_clinicas/{tareaId}`,
y la pregunta obligada es si `firestore.rules` lo deja pasar: una colección con la
forma **congelada** (`hasOnly`) rechazaría un campo que no estuviera en su lista,
y entonces P1-14 arrastraría un despliegue de reglas —que es autorización del
dueño— a su camino crítico.

No lo arrastra. La regla de esa colección no congela la forma:

```
match /tareas_clinicas/{tareaId} {
  allow read: if isMedico(clinicId);
  allow create, update: if isMedico(clinicId) && clinicaPuedeEscribir(clinicId);
  allow delete: if false;
}
```

Los nueve `hasOnly` del archivo son de otras colecciones (`aprendizaje`,
`invitaciones`, `displayName`, `used/usedAt`, `role`…). Y `tareas_clinicas` ya
está declarada en los **tres sitios** que exige `security-tenant.md` —reglas,
matriz de acceso y manifiesto del respaldo—, así que esto **añade un campo, no
una colección**.

Dicho al revés, que es lo que importa para decidir el orden: **el único
despliegue que P1-14 necesita es el de índices.** Las reglas se quedan como
están.

## Y si el índice todavía no está — REG-424

El orden de arriba (índices primero) es el correcto y no cambia. Lo que cambia es
qué pasa si se rompe: **ya no se rompe la pantalla**.

`src/lib/firestore/indice-que-todavia-no-esta.ts` corre la consulta buena y, sólo
si el error dice que falta el índice, cae al camino de antes — y lo **declara**:

| Consulta | Respaldo mientras no haya índice | Cómo se ve que está degradada |
|---|---|---|
| worklist por urgencia | el orden por antigüedad de REG-421 | `ordenadaPorUrgencia: false`, pintado en `/pendientes` |
| citas del paciente | sin orden ni cota, como antes de REG-421 | `acotada: false` |
| resumen de notas firmadas | ventana de 40 y filtro en memoria | no se propaga: es contexto de IA, y se declara por qué |
| a quién se le ofrece un hueco | lectura sin orden, prioridad en memoria | el aviso del tope cambia de texto |

**No se traga otros errores.** Un permiso denegado, una red caída o una regla mal
desplegada siguen subiendo: absorberlos convertiría una fuga de aislamiento en una
lista corta, que es peor porque no se ve.
