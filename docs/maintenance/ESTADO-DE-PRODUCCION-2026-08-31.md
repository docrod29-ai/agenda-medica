# Estado de producción — 31-ago-2026

> **Sucede a [`PAQUETE-PRODUCCION-2026-08-30.md`](PAQUETE-PRODUCCION-2026-08-30.md),
> que quedó desfasado.** Aquel documento dice «PREPARADO, NO PUBLICADO» y describe
> un paquete de 84 commits sobre `nexusmed-v1174`. **Ya se publicó.** No se toca
> aquel texto —es de otro carril y cuenta bien lo que contó— pero leerlo hoy sin
> esta nota lleva a la conclusión contraria a la verdad.

| | |
|---|---|
| **Despliegue** | Ejecutado **31-ago 03:10–03:12 UTC**, [run 33352973942](https://github.com/docrod29-ai/agenda-medica/actions/runs/33352973942) — **éxito, 15 pasos** |
| **Árbol certificado** | `ee1b3632` (`SHA_AUTORIZADO` del workflow) |
| **Versión** | `nexusmed-v1175`, confirmada sirviéndose desde el runner de GitHub |
| **Reglas de Firestore** | **Publicadas** con índices (paso 9) |
| **Seguridad y smoke contra producción** | En verde (pasos 12–14) |

---

## 1. Lo que sí está cerrado

**Las reglas de Firestore que se publicaron son, hoy, byte a byte las de `main`.**

```
git diff --stat ee1b3632..origin/main -- firestore.rules firestore.indexes.json
(vacío)
```

Eso importa porque el paquete traía **nueve colecciones nuevas** —`registros`,
`members`, `memoria_medico`, `slot_locks`, `uci_copilot_feedback`,
`whatsapp_outbox`, `whatsapp_contacts`, `whatsapp_status`, `whatsapp_events`— y
las reglas son la frontera de aislamiento entre consultorios. Están vivas y están
al día.

Las tres declaraciones que pide `.claude/rules/security-tenant.md` se comprobaron
con sus guardianes, no con un `grep` mío:
`firestore-rules-guard` · `matriz-acceso` · `respaldo-consultorio` →
**61 casos en verde**.

`slot_locks` aparece en `respaldo.ts` como **exclusión declarada con su motivo**
(«viven segundos… restaurar un candado viejo sólo bloquearía una agenda que ya
está libre»). Eso es la regla cumplida, no incumplida.

---

## 2. Lo que NO se puede afirmar desde aquí

Después del despliegue entraron **87 commits** (`ee1b3632..f270cefc`): 341
archivos, +22 922 líneas — sobre todo el PR #399 y el #414.

**Ninguno tocó `public/version.txt` ni `public/sw.js`. Los tres puntos declaran
`nexusmed-v1175`.**

De ahí sale el punto ciego, y es el mismo que ya avisaba el acta del 27-ago:

> `public/version.txt` es una copia del propio repositorio, así que **no puede
> detectar una deriva**.

Como la cadena de versión no se movió, **nada en este repositorio distingue si
producción sirve el árbol de `ee1b3632` o el de `f270cefc`.** Se sabe que sirve
«v1175»; «v1175» son ahora dos árboles distintos.

No se pudo mirar del otro lado: la política de red de este contenedor devuelve
**403** contra `agenda-medica-one.vercel.app`. Queda como
**`NEEDS_OWNER_VERIFICATION`**, no como hecho.

### Lo que sí se puede afirmar sobre la caché

El service worker **no** deja a nadie con código viejo, y conviene decirlo porque
la conclusión intuitiva es la contraria:

- las navegaciones van **network-first** — el HTML siempre se pide a la red;
- los estáticos van **stale-while-revalidate**, pero `/_next/**` lleva **hash de
  contenido**: si el contenido cambia, cambia la URL, y una URL nueva no está en
  la caché.

El nombre de la caché sólo gobierna el **desalojo** de lo viejo (`activate` borra
las claves distintas de `CACHE`). No subir la versión deja basura acumulada, no
código atrasado. Las únicas excepciones son los estáticos **sin hash** que casan
con el patrón —`manifest.json`, iconos—: salen viejos una vez y se corrigen solos
a la siguiente carga.

**Conclusión: no bumpear v1175 es un problema de higiene, no de corrección.**

---

## 3. El botón tiene una trampa, y hay que decirla

`.github/workflows/deploy-production.yml` fija:

```yaml
SHA_AUTORIZADO: ee1b363225082c88ce5ddcfbc7401a8c6dbe7206
VERSION_ESPERADA: nexusmed-v1175
```

El workflow **hace checkout de `SHA_AUTORIZADO`**, no de `main`. Ese SHA está hoy
**87 commits por detrás**.

Y la compuerta que debería cazarlo no puede: la **Compuerta 3** sólo comprueba que
producción sirva `VERSION_ESPERADA`. Como `version.txt` no se ha movido, **pasa
igual de rápido tanto si el árbol está al día como si está 87 commits atrasado.**

Hoy no hace daño —las reglas de `ee1b3632` son las de `main`— pero el día que
alguien cambie `firestore.rules` y pulse el botón sin mover el pin, se publicarán
**las reglas viejas con las tres compuertas en verde**. Es el mismo defecto que
el PR #413 fue a arreglar («el SHA vive en UN solo sitio»): se quitó la copia
duplicada, pero el pin sigue siendo manual y su compuerta sigue siendo ciega.

**No se toca aquí.** Ese archivo lo está iterando otro carril —#412 y #413 son de
hace horas— y `AGENTS.md` §6 dice que no se pisa el trabajo de otro agente. Queda
**declarado y sin arreglar**, con el arreglo propuesto:

> hacer que la Compuerta 1 falle si `SHA_AUTORIZADO` no es la cabeza de `main`,
> en vez de confiar en una cadena de versión que no se mueve.

---

## 4. Respuesta corta a «¿ya se puede desplegar?»

- **Las reglas y el árbol de `ee1b3632` ya están desplegados.** Eso ya pasó.
- Lo que entró después **no requiere despliegue de reglas** (no las toca) ni
  bump de service worker para ser correcto (§2).
- Lo que **no** se puede certificar desde aquí es qué árbol sirve producción
  ahora mismo, y la causa es el punto ciego de §2 — no una sospecha.

Sigue valiendo, entera, la prohibición de `CLAUDE.md`: **desplegar a producción y
fusionar a `main` son decisiones del dueño.** Este documento es papel; no publica
nada.
