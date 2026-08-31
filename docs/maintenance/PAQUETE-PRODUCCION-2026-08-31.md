# Paquete de producción — `nexusmed-v1176`

> **Estado: PREPARADO, NO PUBLICADO.** Este documento describe exactamente qué se
> publicaría. Nadie ha desplegado nada. Publicar a producción sigue siendo
> decisión del dueño (`.claude/rules/deployment-and-flags.md`).

> **SUPERADO — 31-ago-2026 13:28 UTC. PUBLICADO Y VERIFICADO.** El dueño corrió el
> botón sobre `3bada501`: ejecuciones
> [#9](https://github.com/docrod29-ai/agenda-medica/actions/runs/33396253979) y
> [#10](https://github.com/docrod29-ai/agenda-medica/actions/runs/33396994838), las
> dos `PRODUCTION_RELEASE=SUCCESS`. No se borra nada de lo de abajo: era verdad
> cuando se escribió. **Este documento ya no describe algo pendiente.**

| | |
|---|---|
| **Versión del service worker** | `nexusmed-v1175` → **`nexusmed-v1176`** |
| **Última línea desplegada** | `ee1b3632` — v1175, publicada y **verificada contra el sitio vivo** (ver §1) |
| **Commits que entran** | **87** (80 directos + 7 merges) — ver §0 |
| **Rango de fechas** | 31-ago-2026 |
| **Superficie** | 342 archivos · +22 934 / −819 · **102 de código de producto** |
| **Rutas de API nuevas** | **0** |
| **Pantallas nuevas** | **0** |
| **Reglas / índices de Firestore** | **NINGUNO** — este despliegue es sólo código |

---

## 0. El recuento se cuenta a sí mismo

Las cifras de arriba se midieron sobre `f270cefc` (`main` al preparar esto). Los
commits de este propio paquete —el bump, este documento y el que apunte el botón—
entran también en el despliegue, como entró la corrección del paquete anterior.
Es decir: **87 más los de esta preparación**.

Se dice aquí porque el acta de v1175 tuvo que recontarse por no haberlo dicho, y
lo que se aprende dos veces no se aprendió.

---

## 1. La base, y por qué esta vez es firme

`ee1b3632` es v1175, y no es una suposición: el propio workflow de despliegue la
midió contra el sitio vivo **veinte veces en cinco minutos**, y luego la
ejecución #8 cerró con `PRODUCTION_RELEASE=SUCCESS`.

Es la primera vez en este repositorio que un paquete arranca desde una base
**comprobada contra producción** en vez de deducida del historial. Los dos
paquetes anteriores lo declararon como incertidumbre; éste ya no la tiene.

---

## 2. Esta vez NO hay despliegue aparte

v1175 arrastraba `firestore.rules` y 70 líneas de índices, y publicar Vercel sin
publicar las reglas dejaba dos cosas rotas. **Aquí no.** Medido:

```
git diff --name-only ee1b3632..main | grep -E "firestore\.(rules|indexes)"
  → (nada)
```

El botón las publica igualmente —es idempotente— pero no hay nada nuevo que
publicar. Un despliegue de sólo código.

---

## 3. Qué lleva dentro

Casi todo es el **carril de excelencia de producto** (PR #399, 27 unidades, cada
una nacida de una medición en navegador y no de una opinión sobre una captura).

### El defecto que hoy está vivo en producción

Una cita podía **reservarse dos veces sobre el mismo hueco**, en un día que no
existe. `2027-02-30` pasaba la validación de forma y `new Date` la desbordaba al
2 de marzo: se validaba contra el horario de un día y se guardaba en otro. Como el
chequeo de solapes consulta por la fecha original, **no chocaba** con las citas
reales del 2 de marzo.

Dos pacientes en el mismo hueco, y una cita que no aparece en la vista de ningún
día. Ése es el motivo principal para publicar esto.

### Lo demás

- Reenviar la misma reserva le decía al paciente que **otro** le quitó el hueco.
  Ahora es idempotente.
- Con la red caída, `/login` mandaba a recuperar una contraseña que nunca estuvo
  mal; `/registro` no decía nada.
- **Los dos críticos de axe de `/calendario` eliminados** (las flechas del mes sin
  nombre, en las líneas base de V10 y V15, medidas dos veces y nunca cerradas).
- El riel de navegación resuelto: de 4 rutas con `aria-current` a **9 de 9**.
- El estado de la cita en el **nombre accesible**: una cita cancelada dejaba de
  anunciarse como si fuera normal.
- Objetivos táctiles a 390 px: de 12 incumplimientos a **2**.
- **REG-414** — la suite fallaba por la carga de la máquina, no por el código.
- Un **trinquete de interfaz** de 18 combinaciones ruta×ancho.

| Ruta | Archivos | Líneas |
|---|---:|---|
| `docs` | 145 | +7 540 / −35 |
| `src/__tests__` | 60 | +6 286 / −33 |
| `scripts` | 31 | +4 662 / −13 |
| `src/app` | 40 | +2 232 / −458 |
| `src/lib` | 21 | +1 309 / −18 |
| `src/components` | 37 | +618 / −240 |

---

## 4. El ciclo

```
✅ vitest                  12 008 en verde sobre 886 archivos
✅ lint-trinquete          95 = techo
✅ trinquete de diseño     sin deuda nueva
✅ tsc --noEmit            limpio
✅ public/sw.js → v1176 · node scripts/version-sw.mjs · changelog + acta
⬜ apuntar el botón a v1176            ← PR aparte, ver §5
⬜ Actions → «Despliegue a producción (manual)» → Run workflow   ← DEL DUEÑO
```

Cero rutas de API y cero pantallas nuevas, así que `e2e:seguridad:prod` —que el
botón corre solo— no debería teñirse de rojo por una ruta privada que producción
todavía no sirve.

---

## 5. Por qué el botón se apunta en un PR APARTE

`deploy-production.yml` fija `SHA_AUTORIZADO` y `VERSION_ESPERADA`, y su
compuerta 2 exige un **Vercel success sobre ese SHA**. Ningún commit tiene todavía
`version.txt = v1176`, así que no hay a qué apuntar hasta que este paquete entre a
`main` y Vercel lo publique.

De ahí el orden: **primero este PR, luego el que apunta el botón.** Intentar las
dos cosas a la vez es lo que hizo fallar la ejecución #7 — el SHA vivía en dos
sitios y las copias divergieron (arreglado en el PR #413: ahora vive en uno).

---

## 6. Lo que este documento NO afirma

- **No afirma que el paquete siga siendo éste cuando se publique.** Si algo entra
  a `main` antes, entra también al despliegue: hay que rehacer la cuenta. Pasó
  con v1175 y está escrito para que no vuelva a sorprender.
- **No sustituye la comprobación contra producción.** Ésa la hace el botón, y
  sólo tiene sentido después de publicar.
