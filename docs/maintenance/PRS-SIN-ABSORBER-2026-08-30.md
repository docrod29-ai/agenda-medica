# PRs con trabajo que `main` no tiene — 30-ago-2026

> **Para qué sirve**: el 30-ago se cerraron **42 de los 62 PRs abiertos** porque
> su trabajo ya estaba en `main` o lo había superado un carril vivo. Estos **no**
> se cerraron: llevan cosas que `main` no tiene, y cerrarlos sin dejarlas
> escritas sería tirarlas.
>
> (Eran 50 al empezar; al cerrar los primeros 30 aparecieron 12 más que la
> primera página de la API no mostraba, de la misma familia y con el mismo
> desenlace. El PR **#1** del repositorio estaba entre ellos: todo su port de
> StewardMX está en `main` desde hace meses.)
>
> Medido rama por rama: para cada PR se listó qué archivos suyos **no existen**
> en `main` hoy. Un archivo que falta no prueba que haga falta — prueba que la
> decisión de tirarlo no se ha tomado todavía.

---

## Cómo leer esto

Ninguno de estos PRs debería fusionarse tal cual: van entre **130 y 145 commits
por detrás** de `main`, de la semana del 23-ago. Fusionar hoy uno de ellos es
reaplicar un árbol viejo sobre un producto que ya cambió debajo — el mismo error
que REG-341 evitó al **portar** el PR #356 en vez de fusionarlo.

Lo que procede con cada uno es una de tres:

- **RESCATAR** — su idea entra al Master Board como unidad, y se reimplementa
  sobre el árbol de hoy. El PR se cierra citando la entrada.
- **PORTAR** — su código es pequeño y aún válido; se trae como REG con su golden.
- **TIRAR** — se cierra a sabiendas, porque ya no aplica.

Mientras no se decida, el PR sigue abierto y esta lista es su memoria.

---

## Los ocho con trabajo real

### #342 · Escala, resiliencia y «sin pantalla en blanco»
**30 archivos ausentes de `main`.** Banco de carga completo
(`scripts/load/motor-de-simulacion.mjs`, escenarios, informe de capacidad) y la
documentación de fiabilidad: inventario de caminos calientes, matriz de
inyección de fallos, contrato de contrapresión de colas.

*Por qué importa hoy*: el Master Board tiene abierto **P1-15 — no hay circuit
breaker ni presupuesto de reintentos en ninguna parte**. Este PR trae el banco
que lo mediría. Recomendación: **RESCATAR** como unidad del tablero.

### #345 · Router de coste/calidad de IA
**16 archivos ausentes**, entre ellos `src/lib/ia/router/calidad.ts` y el modo
sombra (`scripts/ai/router-sombra.ts`) con su informe.

*Ojo con la política del dueño*: «la nota usa el razonamiento premium — no
escatimar; no bajar de modelo por velocidad sin avisar». Un router de coste toca
esa decisión de frente. **No se porta sin que el dueño diga qué puede decidir el
router y qué no.** Recomendación: **RESCATAR con decisión previa del dueño**.

### #348 · Detección de incidencias y auto-reparación segura
**35 archivos ausentes**: runbooks, contratos de incidencia, simulacro,
remediación segura, puente con la IA.

*Relación con el carril vivo*: #398 cerró **REG-396** — «la avería que motivó el
módulo de incidencias no avisaba a nadie». O sea que el módulo existe hoy en el
carril vivo y este PR trae la capa de simulacro y runbooks que aquél no tiene.
Recomendación: **RESCATAR sólo lo que #398 no cubra**, comprobándolo antes.

### #349 · Durabilidad, respaldo, restauración y evidencia de recuperación
**29 archivos ausentes**: simulacro de recuperación, registro de riesgos, plan,
decisiones del dueño sobre recuperación.

*Relación con lo ya hecho*: REG-343 (respaldo de las colecciones de raíz) y
**P1-16** (el importador no sabe devolverlas) están abiertos en el tablero, y el
último commit del bucle autónomo tocó justo `restaurar.ts` y el simulacro. Aquí
hay solape real. Recomendación: **RESCATAR contra P1-16**, sin duplicar.

### #351 y #353 · Migración y portabilidad de pacientes
**27 y 29 archivos ausentes**; son dos versiones del mismo trabajo (contrato de
migración, arnés, escala, aislamiento y reversión, idempotencia y duplicados).
Uno de los dos sobra.

*Por qué importa*: migrar un consultorio entero desde otro sistema es la puerta
de entrada comercial, y el aislamiento y la reversión son lo que impide que una
migración mezcle dos expedientes. Recomendación: **RESCATAR uno solo**, decidir
cuál, y cerrar el otro citándolo.

### #355 · Capacidad de diseño de receta atada a dueño y consultorio
**4 archivos ausentes**, y son de los que importan: `receta-diseno-ruta.test.ts`
y `receta-diseno-client.test.ts`. La ruta y el token **sí** están en `main`
(`src/app/api/receta/diseno-url/route.ts`, `receta-diseno-token.test.ts`): lo que
falta son **dos guardianes**, no la funcionalidad.

Recomendación: **PORTAR** — traer las dos pruebas al árbol de hoy y comprobarlas
al revés. Es la pieza más barata de esta lista y cubre una capacidad de
seguridad ya desplegada.

### #357 · La marca del proveedor no se le enseña al médico
**1 archivo ausente**, y es sólo el documento de rebanada
(`docs/product/slices/ROUTER_PHYSICIAN_UX_345.md`). El guardián
(`el-medico-no-elige-marca.test.ts`) **está en `main`**: el trabajo se hizo.

Recomendación: **TIRAR** — cerrar, salvo que quieras conservar la rebanada.

### #332 · n8n: autenticación por token de acceso
Cambia `ops/n8n/workflows/ausculta-dev-autopilot-cloud-v1.json`: `oAuth2` →
`accessToken`, tres líneas.

*El contexto cambió debajo*: ese autopiloto orquestaba `/ausculta-codex-judge` y
`/ausculta-claude-writer`, y **Codex salió del camino crítico el 29-ago**
(`a65690e`). Recomendación: **TIRAR** si n8n ya no gobierna el bucle; si sigue en
uso, es un cambio de cinco minutos que se rehace sobre el archivo de hoy.

---

## Aparte: la pila de mediados de agosto — decisión pendiente

**#293, #295, #297, #300, #301, #302, #303, #347.** Ocho PRs apilados unos sobre
otros (contexto → documentación → voz → razonamiento → plano de control), **172
commits por detrás**, y ninguno es ancestro de lo que sí llegó a `main`: son una
línea entera que nunca desembocó.

Contienen código que `main` no tiene, pero su tamaño (hasta 94 commits en #303)
hace que «rescatar» signifique reimplementar, no portar. **No se cierran sin que
el dueño lo diga**: tirar ocho PRs de arquitectura es una decisión suya, no de
quien limpia.

---

## Lo que este documento NO afirma

- **No dice que lo listado haga falta.** Dice que `main` no lo tiene. Que algo
  falte y que algo sea necesario son dos cosas distintas, y confundirlas es como
  se reconstruye trabajo que se había descartado a propósito.
- **No se ha ejecutado nada de estas ramas.** El inventario es de existencia de
  archivos, no de que su código funcione sobre el árbol de hoy.
- No cubre los 30 PRs cerrados: ésos llevan su motivo escrito en su propio hilo.
