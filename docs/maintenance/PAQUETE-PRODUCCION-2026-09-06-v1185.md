# Paquete de producción — `nexusmed-v1185`

> **Estado: PREPARADO.** Autorizado por el dueño el 6-sep-2026, con la
> instrucción «hazlo tú te doy permiso… desplegando y subiendo a producción».
> Este documento se escribe ANTES de fusionar, para que lo que se declara no se
> pueda ajustar a lo que salga.

> **Estado: PREPARADO, NO PUBLICADO** es lo que la línea de arriba quería decir
> con su «PREPARADO» a secas; se transcribe entera porque el guardián
> `el-tablero-del-loop-no-miente` busca esa frase para comprobar que el estado
> original no se borró.

> **SUPERADO — 6-sep-2026 02:36 UTC. PUBLICADO Y VERIFICADO.** Vercel publicó
> `main` por su integración de git al fusionarse #461, y el botón corrió sobre
> `18d56347`: ejecución
> [#25](https://github.com/docrod29-ai/agenda-medica/actions/runs/34006857815),
> en verde, con la Compuerta 3 midiendo `nexusmed-v1185` contra el sitio vivo.
> Lo que pasó de verdad está en el §6. (Este aviso lo escribió la sesión del PR
> #458, cuarenta minutos después de la ejecución, al encontrar el acta abierta
> con la versión ya publicada.)

| | |
|---|---|
| **Versión del service worker** | `nexusmed-v1184` → **`nexusmed-v1185`** |
| **Commits que entran** | **16** (15 de trabajo + 1 de fusión de `main`) |
| **Superficie** | 139 archivos · +5 498 / −186 · **39 de código de producto** |
| **Rutas de API nuevas** | **0** |
| **Pantallas nuevas** | **0** |
| **Reglas de Firestore** | **sin cambios** |
| **Índices de Firestore** | **sin cambios** |
| **Regresiones cerradas** | **14** (REG-542 … REG-555) |
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
  a lado, que es la comparación para la que existe el par. **(REG-550)**
- **La agenda dice a quién tienes.** En la vista de semana los bloques decían
  «08:00», «09:00» — la hora que la fila de la izquierda ya daba — y el nombre
  del paciente no llegaba a pintarse nunca en columnas de 41 px. Ahora el nombre
  manda y lo que se recorte lo dicen los puntos suspensivos: un nombre cortado
  en seco («Ros» por Rosalía o por Rosario) es un riesgo de identidad en una
  agenda clínica. **(REG-551)**
- **Las 28 pantallas del panel caben.** De 2 pantallas con arrastre lateral y 10
  textos cortados en silencio, a **0 y 0**.

### En cualquier pantalla

- **El diálogo que confirma un borrado ya no se dispara solo.** `confirm()`
  gobierna toda acción destructiva de la aplicación y tenía el teclado escrito a
  mano, sin trampa de foco y con el `Enter` atado a la **ventana**. Medido: con
  «¿Eliminar esta cita permanentemente?» abierto, cinco tabulaciones sacaban el
  foco a un enlace de la navegación de detrás, y pulsar `Enter` ahí —creyendo
  que se navegaba— **borraba la cita**. La lista pasó de 7 citas a 6 y la
  navegación ni siquiera ocurrió. **(REG-553)**
- **Las tardes ya no envejecen a nadie.** A partir de las 18:00 hora del
  consultorio, todo paciente atendido esa misma mañana pasaba a decir «visto
  ayer», y en Reactivación «Hace 1 día». Se restaban instantes en UTC sobre una
  fecha sin hora. Ahora se cuentan días de calendario del consultorio. Y la
  tarde es justo cuando el médico repasa la jornada. **(REG-554)**
- **La edad del paciente ya no se queda vieja** (REG-542), **la alergia no se
  dice dos veces** (REG-543), **la fecha se escribe igual en todo el producto**
  —nueve pantallas la enseñaban en ISO— (REG-545), **el expediente dice quién
  puso cada diagnóstico** (REG-548), y **el riel de la agenda mira el reloj**
  (REG-547).
- **Cuando la IA no está, el error no nombra al proveedor**: quince rutas se lo
  contaban al médico. **(REG-546)**
- **Dos defectos de contraste que sólo existían en tema claro** (REG-549).

---

## 2. Lo que NO cambia, y conviene saber

- **Ninguna regla ni índice de Firestore.** Este paquete no necesita el
  despliegue aparte de `firestore.rules`.
- **Ninguna ruta de API nueva ni pantalla nueva.**
- **Hospital y UCI siguen en pausa** como los dejó v1181.
- **La grabación de la consulta se queda como la dejó `main`**: al fusionar, las
  dos ramas habían resuelto el mismo problema por caminos incompatibles y **gana
  el de `main`**, que está sellado por sus guardianes. Lo de este carril se
  revirtió entero. Ver REG-555.

---

## 3. Riesgo

**Bajo.** No hay migración de datos, ni cambio de esquema, ni ruta nueva, ni
regla que desplegar. Lo que se toca son pantallas existentes y tres módulos de
lógica pura (`estado-clinico`, `vocabulario-de-la-escucha`, `formato/fecha`),
todos con golden nuevo y probado al revés.

El cambio de mayor alcance es el de `ultimaVezVisto` (REG-554), que afecta a
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

## 6. Lo que pasó de verdad

Se publicó el 6-sep-2026. Los tres pasos salieron en el orden previsto.

| Paso | Qué fue | Resultado |
|---|---|---|
| 1 | PR #461 — service worker a v1185 y esta acta | fusionado con auto-merge, 5 checks de CI en verde |
| — | Vercel publicó `main` (`18d56347`) por su integración de git | producción pasa a servir `nexusmed-v1185` |
| 2 | PR #465 — `SHA_AUTORIZADO` repuntado a `18d56347` | fusionado, 5 checks en verde |
| 3 | Workflow «Despliegue a producción (manual)», ejecución **#25** | `PRODUCTION_RELEASE=SUCCESS` (02:36 UTC) |

Acta que emitió la ejecución #25:

```
PRODUCTION_URL=https://agenda-medica-one.vercel.app
APP_SHA=18d56347fbbd12a9d387ecb72a602debc6d5bf37
VERSION=nexusmed-v1185
VERCEL_PROJECT=agenda-medica
FIRESTORE_RULES=success
FIRESTORE_INDICES=success
FIRESTORE_RULES_SHA256=1d91d7077e616e2a600a0f0526d79c46b85d5ffe9d7d5bffd0d8b157923d2df7
SECURITY_E2E=success
SMOKE=success
SMOKE_PORTAL=success
PRODUCTION_RELEASE=SUCCESS
```

<https://github.com/docrod29-ai/agenda-medica/actions/runs/34006857815>

### Lo que esta ejecución SÍ cierra del §5

- **Las cabeceras de producción.** El §5 las dejaba pendientes porque el
  contenedor no llega al sitio vivo. El botón sí llega: el paso «Seguridad ·
  producción» corrió `e2e:seguridad:prod` contra `agenda-medica-one.vercel.app`
  y salió en verde. Ese renglón queda cerrado por la ejecución, no por esta
  sesión.

### Lo que esta ejecución NO demuestra

- **Reglas e índices**: se reenviaron sin cambio. El hash es el que dejó #18
  (`1d91d707…`); no había ninguna regla nueva que publicar.
- **Que el service worker viejo se haya retirado de los navegadores.** Sube la
  versión del caché; la retirada ocurre cuando cada cliente recarga.
- **iPhone y transcripción real**: siguen exactamente como los deja el §5.

