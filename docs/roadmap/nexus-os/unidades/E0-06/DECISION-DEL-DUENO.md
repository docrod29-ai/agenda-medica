# E0-06 / P1-6 — decisión del dueño sobre el acceso a las alergias

**Fecha:** 28-ago-2026 · **Decide:** Dr. David Alonso Rodríguez Luna (dueño).

Cierra D1 y D3 del [diseño](DISENO.md) §9 y fija la secuencia de la migración.

---

## La política, literal

1. Las alergias son información clínica.
2. El rol **RECEPCIÓN no puede leer**: alérgeno/fármaco · reacción · gravedad ·
   fecha · notas clínicas relacionadas.
3. Recepción accede **únicamente** a información administrativa necesaria para
   agenda, identificación, contacto, cobro y operación.
4. Una interfaz administrativa puede avisar de que existe un asunto clínico con un
   **indicador no descriptivo** —«Requiere revisión clínica»— sin revelar la
   naturaleza de la alergia.
5. La fuente canónica futura de las alergias está en la **superficie clínica
   protegida** del paciente, no en el documento administrativo compartido.
6. **No se permite doble Clinical Truth.**
7. La migración es: `add → backfill → verify → switch reads → verify → remove legacy`.
8. **Ningún campo legado se elimina hasta demostrar equivalencia de datos.**
9. Pruebas obligatorias: médico autorizado puede leer · recepción no puede leer ·
   usuario de otra clínica no puede leer · el backfill conserva el 100 % de las
   alergias · reacción/gravedad no se pierden · pacientes sin alergias no adquieren
   alergias · un fallo de migración no destruye la fuente anterior · rollback
   disponible antes del corte.
10. **Autorizado:** el trabajo preparatorio en código y pruebas.
11. **NO autorizado todavía:** backfill de producción · eliminación de campos
    reales · despliegue de `firestore.rules` · merge a `main` · deploy de producción.

---

## Qué resuelve del diseño

| Pregunta abierta | Respuesta |
|---|---|
| **D1** — ¿la asistente puede *capturar* alergias en el alta aunque no las lea? | **No.** El punto 3 la deja sólo en lo administrativo. Se descarta la opción *write-only*: `clinico/{clinicoId}` se queda en `isMedico` para leer **y** escribir. |
| **D3** — ¿qué ve entonces el mostrador? | El indicador **no descriptivo** del punto 4, no los `tags` clínicos. |
| Orden de la migración | El del punto 7, con la equivalencia del punto 8 como condición para el último paso. |

---

## Qué se entregó bajo el punto 10 (el paso `add`)

| Pieza | Dónde |
|---|---|
| Superficie canónica: reparto de campos, fusión de lectura, estado explícito, indicador | `src/lib/expediente/paciente-clinico.ts` |
| Acceso con el SDK cliente | `src/lib/expediente/paciente-clinico-firestore.ts` |
| Entradas del corte en la capa de datos | `getPatientCompleto` · `updatePatientRepartido` (`src/lib/firestore.ts`) |
| Plan de backfill, equivalencia, rollback, guardián de operaciones | `src/lib/migracion/phi-clinico.ts` |
| Script (ensayo por defecto, `--verificar`, `--rollback`) | `scripts/migrar-phi-clinico.mjs` · `npm run phi:migrar` / `npm run phi:verificar` |
| Indicador no descriptivo en el documento administrativo | `Patient.requiereRevisionClinica` |
| Pruebas de política, backfill, equivalencia y rollback (41) | `src/__tests__/alergias-superficie-clinica.test.ts` |
| Pruebas de acceso contra el motor real de reglas | `emulator/alergias-superficie-clinica.emu.test.ts` |

### El sello es el interruptor del corte

`ResumenClinicoPaciente.migradoEn` decide de dónde sale el dato:

- **sin sello** → el subdocumento manda campo a campo y lo que no trae se sirve del
  campo legado (ventana transitoria, sin hueco);
- **con sello** → el subdocumento es la única verdad y el legado deja de mirarse.

Así `switch reads` y su rollback son **operaciones de datos**, no despliegues: el
backfill sella a quien verificó, y quitar el sello lo devuelve al estado anterior.

---

## Lo que TODAVÍA NO se cumple, dicho sin adornos

La aceptación literal de E0-06 —«rol recepción: lee cita, **no lee alergias**»—
**sigue sin cumplirse en producción**. Las alergias continúan siendo campos de
`patients/{id}`, que es `allow read: if isMember`, y ninguna regla puede impedir
que recepción las lea mientras estén ahí.

Lo que existe es el camino entero hacia la casa nueva, con su verificación y su
vuelta atrás. Lo que falta es el punto 11: correr el backfill, cambiar las lecturas
de las pantallas y retirar los campos heredados. Los tres son decisión del dueño.
