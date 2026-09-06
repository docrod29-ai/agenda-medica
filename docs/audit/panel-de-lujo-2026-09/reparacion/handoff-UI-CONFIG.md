# Handoff — UI-CONFIG

Hallazgos de mi lista cuyo arreglo (o la mitad que falta) cae en archivos de
**otra rebanada**. No los toqué: el briefing lo dice y tiene razón, un conflicto
de fusión en un archivo compartido sale más caro que el defecto.

Cada entrada trae **qué cambiar, dónde y qué prueba lo cubre**, para que el
agente dueño del archivo no tenga que volver a investigarlo.

---

## Para PROMPTS-ASR

### A-006 · `registrarUso` no se espera en ocho rutas (P2)

**Está en tu lista** (`lista-PROMPTS-ASR.json`), y también me lo pidió el
orquestador a mí. No lo toqué para no duplicar el trabajo en ocho archivos que
son tuyos. Lo que sí hice fue leer la documentación, como pide `AGENTS.md`.

`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`, lo
que importa:

- `after` se importa de `next/server` y **vale en Route Handlers** (lo dice
  explícitamente en el primer párrafo).
- **No es una API de tiempo de petición**: llamarla no vuelve dinámica la ruta.
- **Se ejecuta aunque la respuesta no termine bien** — incluso si se lanzó un
  error, o se llamó a `notFound` o `redirect`. Eso es lo que arregla el defecto:
  hoy la escritura muere con la función sin servidor.
- Corre dentro del `maxDuration` de la ruta, configurable por segmento.
- Dentro de un Route Handler se pueden usar `cookies` y `headers`.

El cambio, una línea por sitio:

```ts
import { after } from 'next/server'
// …
after(() => registrarUso(clinicId, fuente))
```

Los diez sitios (nueve rutas):

| Archivo | Línea | Hoy |
|---|---|---|
| `src/app/api/expediente/procesar/route.ts` | 590, 594 | `void registrarUso(...)` |
| `src/app/api/expediente/transcribir-diarizado/route.ts` | 386 | `void registrarUso(...)` |
| `src/app/api/expediente/transcribir/route.ts` | 195 | `void registrarUso(...)` |
| `src/app/api/expediente/evidencia/route.ts` | 403 | `void registrarUso(...)` |
| `src/app/api/expediente/verificar-nota/route.ts` | 159 | `void registrarUso(...)` |
| `src/app/api/consultor-evidencia/route.ts` | 429, 502 | `void registrarUso(...)` |
| `src/app/api/uci/copilot/route.ts` | 231 | `registrarUso(...).catch(() => {})` |

El `.catch(() => {})` de `uci/copilot` **sobra** una vez dentro de `after()`:
`registrarUso` ya se traga sus errores (`ai-keys.ts:457`).

`src/app/api/inmuno/redactar/route.ts:88` ya hace `await` y no hay que tocarla —
es el control de que el patrón correcto existía.

**Prueba sugerida**: un guardián que lea las nueve rutas y exija que ninguna
llamada a `registrarUso` quede sin `after(` ni `await` delante. Se prueba al
revés quitando el `after` de una.

---

## Para AGENDA-MENSAJERIA

### C-001 · el mensaje del portal de reservas no llega al paciente (P2)

Mitad reparada aquí: la pantalla de configuración ya **no promete** que el
paciente lo lee, y el texto se sigue guardando en `publicBookingNote`.

Lo que falta, dos cambios:

1. `src/app/api/public/clinic/[clinicId]/route.ts:80` — devolver también
   `publicBookingNote` junto a `publicBookingEnabled`.
2. `src/app/reservar/[clinicId]/page.tsx` — pintarlo en la cabecera o en el paso
   de «tipo de cita».

Cuando esté, hay que quitar el aviso «Todavía no se le muestra al paciente» de
`src/app/(dashboard)/configuracion/page.tsx` y el caso que lo fija en
`src/__tests__/lo-que-la-pantalla-promete-lo-cumple.test.ts`.

### C-008 · el CRM enseña tasas en 0 % tras un fallo de lectura (P2)

No está en mi lista pero el orquestador me lo nombró: es de `/crm`, tuyo.
`src/app/(dashboard)/crm/page.tsx:60`. Ya existe la pieza compartida:

```tsx
import { NoSePudoLeer } from '@/components/ui'
// …
if (falloAlLeer !== undefined) {
  return <NoSePudoLeer que="las citas del periodo" error={falloAlLeer} alReintentar={recargar} />
}
```

**La rama del fallo va ANTES que la del vacío.** El guardián de
`src/__tests__/no-se-pudo-leer-no-es-no-hay-nada.test.ts` explica por qué y sirve
de plantilla: basta añadir la fila a su tabla `SUPERFICIES`.

### N-013 · sellar el origen de la cita

El rótulo ya no miente («Cómo va la agenda…»). Lo que vale dinero es lo otro:
`origen: 'portal-publico' | 'whatsapp-bot' | 'mostrador' | 'lista-espera'` en la
cita, sellado **en el momento de crearla**, en las cuatro rutas que la escriben y
que hoy no comparten código. Es el único número que le dice al médico si su
inversión en captación funciona.

### C-020 · avisos «Error…» en tus pantallas

Quedan en `citas/page.tsx` (2), `lista-espera/page.tsx` (3),
`asistente/page.tsx` (1), `resenas/page.tsx` (1) y `AppointmentModal.tsx` (1).
La utilidad ya existe:

```ts
import { noSePudo } from '@/lib/texto-es'
toast(noSePudo('guardar la cita', e), 'error')
```

El trinquete de `src/__tests__/la-pantalla-habla-como-persona.test.ts` tiene el
techo en **25**. Cuando los repares, bájalo.

---

## Para DINERO

### C-009 · Membresías enseña «Sin membresías activas» tras un fallo (P2)

`src/app/(dashboard)/membresias/page.tsx:54`. Mismo patrón y misma pieza que
C-008, arriba.

### N-018 · una sola lista de la promesa

`RECORRIDO` vive dentro de `src/app/page.tsx` y no se exporta, así que la puerta
de registro tuvo que copiar el texto a mano (está marcado como tal en
`src/app/registro/page.tsx`). Moverlo a `src/lib/marca.ts` y que las dos
pantallas lean de ahí cierra la causa raíz: hoy hay dos copias que se
desincronizan en la próxima corrección de la promesa.

---

## Para RECETA-DOCS

### C-003 · conectar `mostrarSignosVitales` en la orden

El toggle se retiró de Configuración porque no cambiaba nada. Si el dueño lo
quiere de verdad, el lector va en `src/app/(dashboard)/orden/**` (hoy la palabra
«signos» sólo aparece en un comentario, `orden/[notaId]/page.tsx:6`), junto a
`mostrarDiagnostico` y `mostrarAlergias`, que sí se leen en
`RecetaDocumento.tsx:745,769`.

### MI-007 · pintar la cobertura declarada en la receta

Ya existe y ya llega a la barra de la consulta. Falta en la receta:

```ts
import { coberturaDeclarada } from '@/lib/expediente/farmacovigilancia'
const cobertura = coberturaDeclarada(medicamentos, alertasVisibles)
```

Y de paso, el filtro de `receta/[patientId]/[notaId]/page.tsx:241`
(`.filter(a => a.codigo !== 'sin_referencia')`) esconde los fármacos sin techo en
el catálogo: el hallazgo pedía sustituirlo por un renglón agregado («N de los M
fármacos no tienen techo»).

---

## Para EXPEDIENTES

### C-020 · avisos «Error…» en tus pantallas

`pacientes/page.tsx` (1), `expediente/[patientId]/page.tsx` (1),
`cumplimiento/page.tsx` (1), `cumplimiento/seguridad/page.tsx` (2). Misma
utilidad `noSePudo`, mismo trinquete.

### ZC-019 · fechas en la zona del navegador

Quedan dos en tus archivos: `src/components/expediente/HistorialVersiones.tsx:124`
y `src/components/expediente/PatientAnchor.tsx:265`. El formateador único
(`fechaCorta`/`fechaConHora` de `src/lib/formato/fecha.ts`) ya formatea en la
zona del consultorio; basta con usarlo.

### D-009 · enlazar `/motores` desde `/cumplimiento/motores`

Ojo antes de hacerlo: **REG-292 la desenlazó a propósito** y hay un guardián
(`lo-que-hace-si-como-lo-hace-no.test.ts`) que prohíbe ofrecerla desde las
superficies del cliente. `/cumplimiento/motores` NO está en esa lista, así que
enlazarla desde ahí es compatible con la decisión — pero conviene que lo mire el
dueño. Mi razonamiento completo está en `decisiones-UI-CONFIG.md`.

---

## Para SEGURIDAD

### C-004 · sacar del tipo los campos que nadie escribe

`copiasEnHoja` y `registroAntidopaje` (`src/types/index.ts:679,687,768`) ya no se
verifican ni se ofrecen. Si el dueño quiere retirarlos del tipo, es aquí. Los
dejé a propósito para no borrar valores guardados.

### C-002 · lo mismo con `horaResumenDiario`

`src/types/index.ts:547,758`. Y `msgResumenDiario` (`src/lib/whatsapp.ts:101`)
sigue sin llamador.

### MC-011 · la foto clínica se guarda en la carpeta equivocada

Verificado por el equipo rojo: `src/app/api/imagen/route.ts:28` sanea la clave
quitando las barras y `:45` la escribe bajo `receta-diseno/{uid}/`. Una foto
clínica de un paciente acaba en la carpeta de los diseños de receta del médico.
El EXIF ya no viaja (reparado aquí), pero la ruta sigue mal.

---

## Para CONSULTA

### C-020 · avisos «Error…»

`consulta/[patientId]/page.tsx` tiene los que quedan del bloque grande. Misma
utilidad, mismo trinquete.

### MP-015 · pintar la jerarquía de la dosis crítica

El motor ya marca `manda: true` en el aviso de dosis peligrosa crítica y
`construirAvisos` los sube al principio de la lista. Falta que la barra de la
consulta **lo pinte distinto**: fármaco y cifra en negrita, y el ancla al
renglón. Hoy el orden ya cambió, el peso visual no.

---

## Para PORTAL

### PC-017 · lo ya cacheado

La lista del service worker ya no cachea `/mi`, `/resena`, `/teleconsulta` ni
`/verificar` (reparado aquí, con guardián). Lo que **no** hace esta reparación es
borrar lo que ya está en el teléfono de alguien: se va solo cuando el `CACHE`
rote de versión en el siguiente despliegue. Si quieres forzarlo antes, es en el
`activate` de `public/sw.js`.

### PI-012 · el portal sin señal enseña la página de venta para médicos

No lo toqué: pide una página de respaldo propia para `/mi` («Sin conexión — tu
médico y el 911», con `tel:`) y un manifest aparte con `start_url` del portal.
Las dos cosas son tuyas.
