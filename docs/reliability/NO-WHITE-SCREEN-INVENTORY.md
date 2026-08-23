# Inventario de pantalla blanca

**Carril:** #310 («no-white-screen architecture»). **Estándar:** #320 · **Golden path B:** #322.

Una pantalla blanca en mitad de una consulta no es un error de interfaz: es el médico
delante del paciente sin saber si su nota existe todavía.

---

## 1. Lo que ya existe, y es bueno

Next.js sube el error hasta el `error.tsx` más cercano. Hoy hay tres frenos:

| Freno | Archivo | Qué cubre |
|---|---|---|
| Consulta | `src/app/(dashboard)/consulta/[patientId]/error.tsx` | la pantalla de consulta |
| Panel | `src/app/(dashboard)/error.tsx` | **todas** las pantallas del panel |
| Global | `src/app/global-error.tsx` | cuando ni el layout raíz carga |

El de consulta está bien pensado y merece decirse: distingue «no pude bajar un trozo de la
aplicación» (REG-218) de cualquier otro error, porque para ése **«Reintentar» no puede
funcionar** —`reset()` vuelve a renderizar y el trozo sigue sin estar—, así que ofrece
recargar. Y dice lo único que el médico necesita oír: *tu audio y tu nota están guardados en
este dispositivo*.

## 2. Lo que falta

### N-1 · Las rutas de cara al paciente no tienen freno propio — **P1**

`src/app/mi/[token]/`, `src/app/reservar/[clinicId]/`, `src/app/teleconsulta/[citaId]/`,
`src/app/resena/`, `src/app/verificar/`.

No hay `error.tsx` en ninguna. Un error de componente sube hasta `global-error.tsx`, que
**reemplaza el documento entero** — está escrito para «ni el layout carga» y por eso pinta
su propio `<html>` con colores fijos. Para el paciente que abrió el enlace de su cita, eso
es la pantalla en blanco con un mensaje genérico.

`/reservar/[clinicId]` es el **autoagendado del paciente**: Golden Path A de #320/#321. Un
fallo de componente ahí es un paciente que no consigue cita y no vuelve a intentarlo.

**Punto de inserción exacto:** `src/app/mi/error.tsx`, `src/app/reservar/error.tsx`,
`src/app/teleconsulta/error.tsx`. Ninguno existe y ningún carril activo los reclama
(#306 declara `(dashboard)/**`; #302/#303 no tocan `src/app/` fuera de `consulta/`).

**No se crean en esta rama** porque son superficie de cara al paciente y la regla de diseño
del repositorio es explícita: «no se aprueba una interfaz leyendo el código — se lanza el
producto, se mira, se recorre el flujo, se prueba en móvil y con teclado». Este carril no
tiene entorno para hacer eso. Queda como handoff con el archivo exacto.

### N-2 · `RastreoErrores` sólo está montado en el panel — **P2**

`src/components/RastreoErrores.tsx` engancha `window.onerror` y `unhandledrejection`, y se
monta únicamente en `src/app/(dashboard)/layout.tsx:841`. En las rutas de cara al paciente
un error asíncrono no atrapado **no se reporta**: no rompe la pantalla, y tampoco se entera
nadie de que ocurrió.

### N-3 · El panel no tiene frenos granulares — **P2**

`(dashboard)/error.tsx` cubre las 45 pantallas, y al activarse **sustituye el área de
trabajo entera**. En `/citas` —Golden Path A— un fallo en un panel lateral se lleva por
delante el calendario, que sí funcionaba.

`/consulta` ya tiene el suyo; el resto comparte uno. Frenos por panel (React
`ErrorBoundary` alrededor de las piezas secundarias) mantendrían el trabajo en pantalla. El
modo limitado ya está declarado en `src/lib/reliability/degradacion.ts`, fila
`componente-secundario`: *«Esta parte no se pudo mostrar. El resto de la consulta sigue
funcionando.»* Falta la interfaz que lo use. → **#306**.

### N-4 · Un estado de carga sin fin es una pantalla blanca con otro nombre — **P2**

12 pantallas tienen `loading.tsx`; ninguna declara qué pasa si la carga **nunca** termina.
Con un proveedor colgado y sin cortacircuitos (P1-3 del inventario del camino caliente), un
`loading` puede quedarse hasta el timeout de 60 s. El médico ve una pantalla que no dice
nada durante un minuto.

Técnicamente hay contenido en el DOM; para el médico es indistinguible de una caída.

## 3. Cómo se prueba esto de verdad

Lo que hay hoy en esta rama es el contrato de degradación
(`src/lib/reliability/degradacion.ts`) con su golden: toda caída declara qué se conserva,
qué se reintenta, qué se degrada, qué se bloquea y **qué ve el médico**. Un subsistema sin
mensaje falla la prueba.

Lo que **falta** y no se puede hacer desde aquí:

1. **Pruebas de componente** que monten cada pantalla con un hijo que lanza y comprueben que
   el resto sigue en pie. Requiere entorno DOM: la suite corre en `environment: 'node'`
   (`vitest.config.ts`), así que habría que añadir jsdom o un proyecto de vitest aparte —
   decisión de configuración compartida que toca a todos los carriles.
2. **E2E con Playwright** que inyecte un fallo de proveedor y recorra el camino. `e2e/` ya
   existe; el escenario no.

Plan de casos, listos para escribirse cuando exista el entorno:

| Caso | Pantalla | Se espera |
|---|---|---|
| hijo que lanza en el panel de razonamiento | `/consulta/[id]` | el panel cae, la nota sigue editable |
| hijo que lanza en el resumen de evidencia | `/consulta/[id]` | se dice «evidencia no disponible» |
| proveedor de IA 503 durante 60 s | `/consulta/[id]` | modo limitado visible, autoguardado sigue |
| recarga tras punto durable | `/consulta/[id]` | se ofrece recuperar, sin pérdida |
| fallo de red al listar huecos | `/reservar/[clinicId]` | mensaje al paciente, no pantalla blanca |
| token caducado | `/mi/[token]` | mensaje de enlace vencido, no `global-error` |
| trozo que no carga tras despliegue | cualquiera | se ofrece recargar, no reintentar |
| pestaña en segundo plano 30 min | `/consulta/[id]` | al volver, la nota sigue y el estado es visible |

## 4. Lo que este inventario NO cubre

- **No se ha ejecutado la aplicación.** Es lectura de código. Una pantalla puede tener
  `error.tsx` y aun así quedarse en blanco por un fallo de CSS o de hidratación.
- **No cubre Hospital/UCI.**
- **No mide** la tasa de pantalla blanca. Ese indicador está en
  [`SLO-SLI-CONTRACT.md`](SLO-SLI-CONTRACT.md) como TARGET, con su OBSERVED vacío.
