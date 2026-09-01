# Paquete de producción — `nexusmed-v1177`

> **Estado: PREPARADO, NO PUBLICADO.** Publicar sigue siendo decisión del dueño
> (`.claude/rules/deployment-and-flags.md`).

> **SUPERADO — 31-ago-2026 19:33 UTC. PUBLICADO Y VERIFICADO.** El dueño corrió el
> botón. Nada de lo de arriba se borra: era verdad cuando se escribió, y un acta
> que se reescribe deja de servir para reconstruir qué se sabía y cuándo. Lo que
> pasó de verdad está en §5.

| | |
|---|---|
| **Versión del service worker** | `nexusmed-v1176` → **`nexusmed-v1177`** |
| **Última línea desplegada** | `3bada501` — v1176, **verificada contra el sitio vivo** |
| **Commits que entran** | **5** (3 directos + 2 merges), más los de esta preparación |
| **Superficie** | 13 archivos · +359 / −26 · **7 de código de producto** |
| **Rutas de API nuevas** | **0** |
| **Pantallas nuevas** | **0** |
| **Reglas / índices de Firestore** | **NINGUNO** |

Un paquete pequeño, y el acta va a la medida: no hay incertidumbre que declarar.

---

## 1. La base

`3bada501` es v1176 y está comprobada, no deducida: el workflow la midió contra el
sitio vivo y la ejecución cerró con `PRODUCTION_RELEASE=SUCCESS`.

De los 5 commits, **2 son el propio botón** apuntándose a v1176 (PR #417) — no
tocan producto. Los otros 3 son el PR #415.

---

## 2. Qué arregla, y por qué no es cosmético

**En `/consultor`, «Cerrar sesión» y «Ayuda» no se podían pulsar.** La barra de
preguntas es `position: fixed; left: 0` y en escritorio el riel ocupa los primeros
224 px: la barra se comía sus últimos 89. `document.elementFromPoint` en el centro
del botón devolvía la barra.

**En `/asistente`, las ocho horas que se pulsan para agendar no acusaban el
puntero.** Son el control con el que se agenda una cita. No salieron en la
medición anterior porque aquel día no había ninguna franja pintada.

### El punto ciego que tapaba a los dos

El arnés de estaticidad sólo miraba `<main>`, y el armazón —riel, barra, pie—
está en todas las pantallas. El guardián que debía cazar el solape tenía **el
mismo punto ciego**. Los dos se abren ahora a todo el documento.

Y la lección queda escrita como riesgo, porque vale más que los dos arreglos:
**un trinquete a 0 sólo vigila lo que se llegó a pintar el día que se midió.**

---

## 3. El ciclo

```
✅ vitest                  12 008 en verde sobre 886 archivos
✅ lint-trinquete          95 = techo
✅ trinquete de diseño     sin deuda nueva
✅ tsc --noEmit            limpio
✅ public/sw.js → v1177 · version-sw.mjs · changelog + acta
⬜ apuntar el botón a v1177            ← PR aparte
⬜ Actions → «Despliegue a producción (manual)» → Run workflow   ← DEL DUEÑO
```

El botón va en un PR aparte por lo de siempre: su compuerta 2 exige un **Vercel
success sobre el SHA al que apunta**, y ningún commit tiene `version.txt = v1177`
hasta que esto entre a `main`.

---

## 4. Lo que este documento NO afirma

- No afirma que el paquete siga siendo éste al publicar: si algo entra a `main`
  antes, entra también. **El bucle autónomo corre cada hora**, así que aquí eso no
  es hipotético.
- Los commits de esta preparación entran también en el despliegue.

---

## 5. Publicado — acta de la ejecución

Añadido **después** de publicar. Las secciones 1-4 quedan como se escribieron.

| | |
|---|---|
| **Ejecuciones** | [#11](https://github.com/docrod29-ai/agenda-medica/actions/runs/33430863862) (19:29 UTC) y [#12](https://github.com/docrod29-ai/agenda-medica/actions/runs/33431057064) (19:31 UTC) — **las dos `success`** |
| **SHA autorizado** | `8f74901d` — la fusión del PR #418 |
| **Versión** | `nexusmed-v1177`, medida contra el sitio vivo por la Compuerta 3 |
| **Proyecto de Vercel** | `agenda-medica` (el principal, no `agenda-medica-v10`) |

Lo que devolvió el acta del workflow:

```
FIRESTORE_RULES    = success
SECURITY_E2E       = success
SMOKE              = success
SMOKE_PORTAL       = success
PRODUCTION_RELEASE = SUCCESS
```

Medido contra producción, no contra el build del PR:

- **57 casos de seguridad** en verde (2 saltados a propósito: los de `CSP_MODE=enforce`).
- **10 casos de humo público**: landing, login, las cinco páginas públicas, `robots.txt`,
  `sitemap.xml`, y que los endpoints protegidos devuelvan 401.
- **Portal cerrado por defecto**: `POST /api/portal` sin enlace → **401**.

### Se corrió dos veces, y conviene que quede escrito

El botón se disparó dos veces con dos minutos de diferencia. Las dos terminaron en
verde y publicaron lo mismo: el paso de Firestore es idempotente y el árbol
apuntado era el mismo `8f74901d` en ambas. **No hubo doble publicación de nada**;
la segunda repitió la primera.

### La fila «Reglas / índices: NINGUNO» no se contradice con `FIRESTORE_RULES=success`

Dicen cosas distintas y las dos son ciertas. La tabla de arriba cuenta lo que este
paquete **añade o cambia**: ni una regla ni un índice nuevos. El paso del workflow
publica el archivo **entero** cada vez, traiga cambios o no. Que salga `success`
significa «se publicó lo que ya había», no «este paquete tocó las reglas».

Importa distinguirlo porque `firestore.rules` es la frontera de aislamiento entre
consultorios: leer ese `success` como «aquí se cambiaron las reglas» mandaría a
revisar un cambio que no existe, y peor, acostumbraría a que ese renglón no
signifique nada.
