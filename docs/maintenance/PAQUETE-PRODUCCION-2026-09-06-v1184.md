# Paquete de producción — `nexusmed-v1184`

> **Estado: PREPARADO.** Autorizado por el dueño el 6-sep-2026, con la
> instrucción «hazlo tú te doy permiso… desplegando y subiendo a producción».
> Este documento se escribe ANTES de fusionar, para que lo que se declara no se
> pueda ajustar a lo que salga.

| | |
|---|---|
| **Versión del service worker** | `nexusmed-v1183` → **`nexusmed-v1184`** |
| **Commits que entran** | **16** (15 de trabajo + 1 de fusión de `main`) |
| **Superficie** | 139 archivos · +5 498 / −186 · **39 de código de producto** |
| **Rutas de API nuevas** | **0** |
| **Pantallas nuevas** | **0** |
| **Reglas de Firestore** | **sin cambios** |
| **Índices de Firestore** | **sin cambios** |
| **Regresiones cerradas** | **14** (REG-519 … REG-532) |
| **Arneses nuevos** | **4** |

Es el carril de excelencia de producto: doce encargos del dueño, medidos en un
navegador de verdad. Ninguna pantalla nueva y ninguna ruta nueva — **todo lo que
cambia, cambia en pantallas que ya existían.**

---

## 1. Qué cambia para el médico

### En el teléfono

- **Finanzas ya no esconde dinero.** `<main>` medía 390 px de ancho con 685 px
  de contenido: la tarjeta de **Transferencia** entera, con su importe y su
  porcentaje, quedaba fuera de la vista detrás de un arrastre lateral que nadie
  descubre. Ahora el total manda a lo ancho y efectivo/transferencia quedan lado
  a lado, que es la comparación para la que existe el par. **(REG-527)**
- **La agenda dice a quién tienes.** En la vista de semana los bloques decían
  «08:00», «09:00» — la hora que la fila de la izquierda ya daba — y el nombre
  del paciente no llegaba a pintarse nunca en columnas de 41 px. Ahora el nombre
  manda y lo que se recorte lo dicen los puntos suspensivos: un nombre cortado
  en seco («Ros» por Rosalía o por Rosario) es un riesgo de identidad en una
  agenda clínica. **(REG-528)**
- **Las 28 pantallas del panel caben.** De 2 pantallas con arrastre lateral y 10
  textos cortados en silencio, a **0 y 0**.

### En cualquier pantalla

- **El diálogo que confirma un borrado ya no se dispara solo.** `confirm()`
  gobierna toda acción destructiva de la aplicación y tenía el teclado escrito a
  mano, sin trampa de foco y con el `Enter` atado a la **ventana**. Medido: con
  «¿Eliminar esta cita permanentemente?» abierto, cinco tabulaciones sacaban el
  foco a un enlace de la navegación de detrás, y pulsar `Enter` ahí —creyendo
  que se navegaba— **borraba la cita**. La lista pasó de 7 citas a 6 y la
  navegación ni siquiera ocurrió. **(REG-530)**
- **Las tardes ya no envejecen a nadie.** A partir de las 18:00 hora del
  consultorio, todo paciente atendido esa misma mañana pasaba a decir «visto
  ayer», y en Reactivación «Hace 1 día». Se restaban instantes en UTC sobre una
  fecha sin hora. Ahora se cuentan días de calendario del consultorio. Y la
  tarde es justo cuando el médico repasa la jornada. **(REG-531)**
- **La edad del paciente ya no se queda vieja** (REG-519), **la alergia no se
  dice dos veces** (REG-520), **la fecha se escribe igual en todo el producto**
  —nueve pantallas la enseñaban en ISO— (REG-522), **el expediente dice quién
  puso cada diagnóstico** (REG-525), y **el riel de la agenda mira el reloj**
  (REG-524).
- **Cuando la IA no está, el error no nombra al proveedor**: quince rutas se lo
  contaban al médico. **(REG-523)**
- **Dos defectos de contraste que sólo existían en tema claro** (REG-526).

---

## 2. Lo que NO cambia, y conviene saber

- **Ninguna regla ni índice de Firestore.** Este paquete no necesita el
  despliegue aparte de `firestore.rules`.
- **Ninguna ruta de API nueva ni pantalla nueva.**
- **Hospital y UCI siguen en pausa** como los dejó v1181.
- **La grabación de la consulta se queda como la dejó `main`**: al fusionar, las
  dos ramas habían resuelto el mismo problema por caminos incompatibles y **gana
  el de `main`**, que está sellado por sus guardianes. Lo de este carril se
  revirtió entero. Ver REG-532.

---

## 3. Riesgo

**Bajo.** No hay migración de datos, ni cambio de esquema, ni ruta nueva, ni
regla que desplegar. Lo que se toca son pantallas existentes y tres módulos de
lógica pura (`estado-clinico`, `vocabulario-de-la-escucha`, `formato/fecha`),
todos con golden nuevo y probado al revés.

El cambio de mayor alcance es el de `ultimaVezVisto` (REG-531), que afecta a
cinco superficies —lista de pacientes, CRM, reactivación, retención,
cumplimiento—. Está sellado con 7 casos, incluidos los dos que fallan si se
vuelve a restar instantes.

---

## 4. Qué se midió antes de declarar esto

Sobre el árbol ya fusionado con `main`:

| | |
|---|---|
| Suite | **12 695 / 12 696** |
| Trinquete de lint | **94**, igual que el techo |
| Trinquete de diseño | sin deuda nueva |
| `npm run build` | limpio |
| 390 px, 28 pantallas | arrastre lateral **0** · recorte mudo **0** |
| Controles tapados por algo que flota | **0** de 787, con la consulta **grabando** |
| Regresión visual | 14 / 14 iguales a la línea base |
| El día del médico, de entrar a cobrar | en verde |

**El único rojo** es `ops-timeout-y-punto-ciego`, que exige que `10.255.255.1`
trague paquetes y el proxy del contenedor rechaza al instante. Falla también en
árbol limpio y es intermitente: en una corrida de la suite entera pasó.

---

## 5. Lo que este paquete NO prueba

- **iPhone.** No hay WebKit en el entorno de medición y su descarga está
  bloqueada. Todo lo de arriba se midió en **Chromium**. Nada de este paquete
  puede declararse «probado en iPhone».
- **La transcripción de verdad.** Sin clave de IA en el entorno, el proveedor
  devuelve 503. Lo que sí se comprobó es lo que el médico ve entonces: «No se
  pudo transcribir», «Descargar audio» y «Descartar audio guardado» — y que al
  recargar, el audio guardado sigue ahí y la pantalla lo ofrece.
- **Las cabeceras de producción.** `npm run e2e:seguridad:prod` recorre el sitio
  **vivo**, y desde el contenedor de esta sesión la salida a
  `agenda-medica-one.vercel.app` está denegada por política del proxy (403 al
  CONNECT). **Queda pendiente y se declara**: es el paso que la regla de
  despliegue sitúa DESPUÉS de publicar, y hay que correrlo desde una máquina con
  salida a la red.
