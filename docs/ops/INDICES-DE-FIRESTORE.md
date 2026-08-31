# Índices compuestos de Firestore — los que hay, y en qué orden se despliega

> **Estado**: los índices están **declarados y las consultas ya los usan**
> (REG-415). Desplegarlos y verlos `Enabled` en la consola sigue siendo una
> acción del dueño. **Léase «El orden importa» antes de fusionar nada.**

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
que los nueve dicen **Habilitado**, no «Compilando».

## Los nueve, y quién los usa

| Colección | Campos | Quién la hace |
|---|---|---|
| `appointments` | pacienteId ↑ · fechaHora ↓ | `usePatientAppointments` — las citas del paciente en la consulta |
| `arco_requests` | estado ↑ · fechaSolicitud ↓ | La bandeja de derechos ARCO |
| `clinic_invitations` | clinicId ↑ · createdAt ↓ | `listarInvitaciones` — invitar a alguien al consultorio |
| `farmacia` | activo ↑ · nombre ↑ | La lista de la farmacia |
| `farmacia_movimientos` | itemId ↑ · fecha ↓ | El rastro de un controlado |
| `notas` | estado ↑ · fechaConsulta ↓ | `getUltimasNotasResumen` — las tres firmadas más recientes |
| `reviews` | estado ↑ · publicadaEn ↓ | La página **pública** del médico |
| `tareas_clinicas` | estado ↑ · creadaEn ↑ | `tareasVivas` — el worklist |
| `waitlist` | estado ↑ · createdAt ↑ | `getWaitlist` — la pantalla de lista de espera |
| `waitlist` | estado ↑ · prioridad ↑ · createdAt ↑ | `ofrecerHuecoLiberado` — a quién se le ofrece un hueco |

Las dos filas de `waitlist` **no sobran**: Firestore exige que el campo del
`orderBy` vaya inmediatamente después de las igualdades y no admite campos de
más, así que el índice de tres **no sirve** para la consulta de dos. Ésa fue
exactamente la trampa de REG-415.

## Los cuatro sacrificios, reparados (REG-415)

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

- **El SDK admin.** Lo que corre en rutas de servidor no lo lee este guardián.
- **El `queryScope`.** Un índice de `COLLECTION` no sirve para un
  `collectionGroup`, y eso pasaría en verde.
- **Si el índice está construido.** Declararlo, desplegarlo y verlo `Enabled` son
  tres actos, y los dos últimos se miran del otro lado, en la consola. Ninguna
  prueba de este repositorio puede decir nada de eso.

## Lo que hay que mirar del otro lado antes de dar esto por hecho

Regla «el dato tiene que LLEGAR». Sobre datos reales se cuentan **recuentos,
nunca contenido** — llevan PHI y por eso esto no puede vivir en CI
(`scripts/verificar-invariantes-de-datos.md`):

1. Los nueve índices, `Enabled` en la consola. No «enviados».
2. En `waitlist`: cuántas entradas hay, y cuántas tienen `prioridad` **y**
   `createdAt`. Los dos números tienen que ser el mismo. Un `orderBy` de
   Firestore **excluye** los documentos a los que les falta el campo — no los
   pone al final —, así que una entrada sin `prioridad` desaparecería de la
   lectura sin que nada lo dijera. Hoy `createWaitlistEntry` es el único escritor
   y siempre los pone; esto comprueba que no haya nada más viejo.
3. En `tareas_clinicas`: total contra los que tienen `creadaEn`, por lo mismo.
