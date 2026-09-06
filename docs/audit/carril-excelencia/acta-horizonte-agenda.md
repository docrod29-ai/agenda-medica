# Acta — el horizonte de la agenda, contra el servidor vivo

`GET /api/public/availability/demo?fecha=…` contra el build de producción
servido en localhost:3210 (`npm run build && npm start`), 2026-08-29T19:28:33Z.

El 500 de `Could not load the default credentials` es la PRUEBA de que la
fecha pasó la puerta: el entorno no tiene credenciales de Firebase, así que
todo lo que llega a leer configuración falla ahí. Lo que se rechaza con 400
no llega a tocar la base.

| Fecha | HTTP | Respuesta | Lectura |
|---|---|---|---|
| `2027-03-15` | 500 | _(credenciales)_ | ✅ aceptada (muere en Firestore por falta de credenciales) |
| `2030-06-20` | 500 | _(credenciales)_ | ✅ aceptada (muere en Firestore por falta de credenciales) |
| `2040-02-29` | 500 | _(credenciales)_ | ✅ aceptada (muere en Firestore por falta de credenciales) |
| `2039-02-29` | 400 | Esa fecha no existe en el calendario. | ⛔ rechazada |
| `2050-01-01` | 500 | _(credenciales)_ | ✅ aceptada (muere en Firestore por falta de credenciales) |
| `2050-12-31` | 500 | _(credenciales)_ | ✅ aceptada (muere en Firestore por falta de credenciales) |
| `2051-01-01` | 400 | La agenda llega hasta el 2050-12-31. | ⛔ rechazada |
| `2099-12-31` | 400 | La agenda llega hasta el 2050-12-31. | ⛔ rechazada |
| `9999-12-31` | 400 | La agenda llega hasta el 2050-12-31. | ⛔ rechazada |
| `2027-02-30` | 400 | Esa fecha no existe en el calendario. | ⛔ rechazada |
| `2026-04-31` | 400 | Esa fecha no existe en el calendario. | ⛔ rechazada |
| `0000-01-01` | 400 | La agenda no admite fechas anteriores al 2000-01-01. | ⛔ rechazada |
| `2027-13-01` | 400 | Esa fecha no existe en el calendario. | ⛔ rechazada |
