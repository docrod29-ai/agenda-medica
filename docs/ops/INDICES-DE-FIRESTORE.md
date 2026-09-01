# Índices compuestos de Firestore — los que hay, y en qué orden se despliega

> **Estado**: **doce** índices declarados y **las consultas ya los usan**
> (REG-421, REG-422, REG-423).
>
> **OCHO de los doce se enviaron** el 31-ago con v1177 — contados sobre el árbol
> que de verdad se desplegó (`git show 8f74901d:firestore.indexes.json`), no de
> memoria. Los **cuatro** que faltan no existían entonces:
> `waitlist(estado, createdAt)` y `clinic_invitations` los encontró REG-421;
> `platform_cost_ledger(feature, ts)` lo encontró REG-422 al enseñarle al
> guardián a leer el SDK admin; y `tareas_clinicas(estado, pesoUrgencia,
> creadaEn)` lo trae REG-423, que es el que cierra P1-14.
>
> Y enviar no es construir: ver «El envío no es la construcción».
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

## El envío no es la construcción

`firebase deploy --only firestore:indexes` **contesta al enviar, no al terminar**.
La construcción de un índice compuesto sobre una colección con datos es asíncrona
y puede fallar **después** de que el comando haya dicho `success`.

Por eso un acta con `FIRESTORE_RULES = success` cierra la fila de las reglas
—ésas rigen en cuanto se publican— y **no cierra ésta**. Son dos afirmaciones
distintas que salen del mismo comando:

| Qué dijo el despliegue | Qué demuestra | Qué NO demuestra |
|---|---|---|
| `success` el 31-ago, ejecuciones [#11](https://github.com/docrod29-ai/agenda-medica/actions/runs/33430863862) y [#12](https://github.com/docrod29-ai/agenda-medica/actions/runs/33431057064) | Que `firestore.indexes.json` llegó al proyecto | Que los índices estén **construidos** |

**Lo que falta, y no puede vivir en este repositorio**: abrir la consola de
Firestore del proyecto `nexomed-agenda`, pestaña de índices, y comprobar que cada
uno dice `Enabled` y no `Building` ni `Error`. Hasta entonces, ninguna consulta
nueva puede depender de ellos — la regla del `FAILED_PRECONDITION` de abajo sigue
en pie tal cual.

## Los doce, y quién los usa

| Colección | Campos | Quién la hace |
|---|---|---|
| `appointments` | pacienteId ↑ · fechaHora ↓ | `usePatientAppointments` — las citas del paciente en la consulta |
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

1. Los **doce** índices, `Enabled` en la consola. No «enviados». La lista exacta
   es la tabla «Los doce» de arriba, que sale de `firestore.indexes.json`.
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

   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=<sa.json> \
     node scripts/migraciones/peso-de-urgencia.mjs --proyecto nexomed-agenda           # ensayo
   GOOGLE_APPLICATION_CREDENTIALS=<sa.json> \
     node scripts/migraciones/peso-de-urgencia.mjs --proyecto nexomed-agenda --escribir
   ```

   Es idempotente y no toca `prioridad`: una tarea sin prioridad legible se
   escribe con el peso «sin clasificar», que la manda al final del worklist pero
   **la deja dentro**.

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
