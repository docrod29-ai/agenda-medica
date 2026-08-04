# Regla — seguridad y aislamiento entre consultorios

## Toda colección nueva se declara en TRES sitios

1. `firestore.rules`, con la forma **congelada** (`hasOnly`) y su guarda.
2. `src/lib/authz/matriz-acceso.ts` (y se regenera el markdown de la matriz).
3. `src/lib/clinica/respaldo.ts` — el manifiesto del respaldo.

Una colección que nadie respalda se pierde el día que hace falta, y el archivo
llamado «respaldo» sigue pareciendo completo. Hay un guardián por cada uno de los
tres.

## Las reglas se despliegan aparte

`vercel --prod` **no** publica `firestore.rules`. Van con
`npx firebase deploy --only firestore:rules --project nexomed-agenda`, y eso
requiere autorización del dueño.

## Autorización en el servidor, no en la pantalla

Esconder un botón no cierra una ruta HTTP. Toda ruta que escriba datos clínicos
valida sesión, pertenencia al consultorio y **lista blanca de campos**.

## PHI

Nunca en logs (`safeLog`), nunca en parámetros de URL, nunca en un mensaje de
error. Al cerrar sesión se limpia IndexedDB.
