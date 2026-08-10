# Bloqueos V10

| # | Bloqueo | Qué bloquea | Qué sigue sin él |
|---|---|---|---|
| B-1 | El entorno de ejecución no tiene credenciales de Firebase y el **cliente** no tiene cableado de emulador (`connectAuthEmulator`/`connectFirestoreEmulator` no existen en `src/lib/firebase.ts`) | Inspeccionar en navegador las 33 pantallas `medico` con datos | La superficie pública (18) y `/demo/interactivo` (clínica, offline, datos ficticios) sí corren. Alternativa a evaluar: cablear soporte de emulador **sólo en dev** (reversible, sin tocar producción) en una iteración futura. |

Ningún bloqueo detiene el programa: V10-TRUTH-001 parte 1 y V10-CONSTITUTION-001
tienen trabajo seguro de sobra.
