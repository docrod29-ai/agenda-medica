# V10 — bloqueos vivos

## B-1 · Rutas de API en 401 dentro del entorno de emuladores

**Qué pasa**: el cliente (navegador) ya habla con los emuladores, pero las
rutas de `src/app/api/**` validan sesión con `firebase-admin`, que no está
apuntado al emulador de Auth. Todo lo que pasa por API responde 401
(auditoría, `voz/comandos-config`, y cualquier flujo de nota/transcripción).

**Efecto**: el flujo dorado no se puede recorrer más allá de la pantalla de
consulta; la inspección visual de nota/receta/resultados con datos vivos
queda pendiente.

**Camino**: `firebase-admin` respeta `FIREBASE_AUTH_EMULATOR_HOST` y
`FIRESTORE_EMULATOR_HOST` como variables de entorno del proceso `next dev`.
Probar arrancando el dev server con ambas y el mismo `projectId` demo. No es
bloqueo del dueño: es trabajo de la siguiente corrida.

## B-2 · Ninguno del dueño

No hay hoy ningún bloqueo que requiera decisión del dueño para continuar
V10-TRUTH-001. `V10_OWNER_DECISIONS_REQUIRED.md` queda vacío a propósito.
