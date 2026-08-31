# Paquete de producción — `nexusmed-v1177`

> **Estado: PREPARADO, NO PUBLICADO.** Publicar sigue siendo decisión del dueño
> (`.claude/rules/deployment-and-flags.md`).

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
