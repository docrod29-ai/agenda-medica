# Acta — accesibilidad y recorridos móviles (unidad 15)

Chromium real contra emuladores, **390 / 768 / 1440**.

## 1 · axe-core (WCAG 2.0/2.1/2.2 A + AA) sobre los recorridos del carril

`scripts/carril-excelencia/axe-recorridos.mjs`. No es la auditoría general de la
aplicación —ésa existe y tiene su línea base— sino las pantallas que este carril
tocó y las que forman sus dos recorridos probados.

| Superficie | 390 | 768 | 1440 |
|---|---|---|---|
| `/` (portada) | 0 | 0 | 0 |
| `/reservar/{clinica}` | 0 | 0 | 0 |
| `/login` | 0 | 0 | 0 |
| `/registro` | 0 | 0 | 0 |
| `/citas` *(con sesión)* | 0 | 0 | 0 |
| `/asistente` *(con sesión)* | 0 | 0 | 0 |
| `/pacientes` *(con sesión, sólo medido)* | 0 | 0 | 0 |

**Antes del arreglo** había una violación **seria** en los tres anchos de la
portada: `scrollable-region-focusable` sobre la conversación de ejemplo de
WhatsApp — una caja con `overflow-y: auto` y ningún control dentro, así que el
teclado no podía llegar a ella. Con ratón se lee entera; con teclado, sólo el
primer trozo. Corregido con `tabIndex={0}` + `role="region"` + nombre.

## 2 · El recorrido de reserva, SÓLO CON TECLADO

`scripts/carril-excelencia/teclado-reserva.mjs` — Tab y Enter, sin ratón. axe no
contesta esto: axe mira el árbol accesible, y el teclado es una secuencia.

| Paso | 390 px | 1440 px |
|---|---|---|
| tipo de consulta | ✓ `Primera vez` | ✓ |
| día | ✓ `Lun 31 de ago` | ✓ |
| hora | ✓ `15:00` | ✓ `15:45` |
| formulario (nombre · teléfono · correo) | ✓ | ✓ |
| continuar | ✓ | ✓ |
| consentimientos (Espacio) y confirmar | ✓ **«¡Cita solicitada! ✅»** | ✓ |

**Anillo de foco visible en todos los pasos** — ninguno salió marcado.

**Y el dato llegó**: dos citas en Firestore (`2026-08-31 15:00` y `15:45`,
estado `solicitada`) creadas **sin tocar el ratón**.

### Un falso hallazgo, y por qué se declara

La primera corrida dio «no se alcanza con Tab» en «Continuar» a los dos anchos.
No era un defecto del producto: el campo de nombre llega **ya enfocado**, la
prueba pulsaba Tab a ciegas antes de escribir, el nombre quedaba vacío y el
botón se quedaba **deshabilitado** — y un botón deshabilitado no recibe foco. La
prueba se arregló para rellenar por nombre de campo y no por orden de
tabulación. Se deja escrito porque el siguiente que mida esto va a tropezar
igual.

## 3 · Sin desbordamiento horizontal

Medido en las nueve combinaciones de portada y reserva
(`acta-capturas.json`, `acta-portada.json`): `desbordeHorizontal = false` en
todas, con y sin `prefers-reduced-motion`.

## Lo que esto NO cubre

- axe no ve el **orden** de tabulación, si el foco queda atrapado en un modal,
  ni si un mensaje se anuncia al aparecer. El anuncio del error de identidad sí
  se comprobó aparte (unidad 13, `role="alert"`).
- El recorrido por teclado se hizo en el portal del **paciente**. El de la
  asistente se recorrió con ratón; su versión de teclado queda pendiente.
- No hay lector de pantalla real en este entorno: se comprueba el árbol
  accesible y el foco, no lo que se oye.
