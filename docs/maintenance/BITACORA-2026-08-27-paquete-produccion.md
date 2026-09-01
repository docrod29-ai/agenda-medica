# Bitácora — 27-ago-2026 · el paquete de producción, preparado y sin publicar

**Qué se pidió:** dejar listo el paquete de producción para que al dueño sólo le
quede autorizar y publicar.

**Lo que apareció por el camino:** el número del service worker había dejado de
identificar lo que está publicado. Está contado abajo, y es la razón de que el
paquete diga «≤ 229» y no «229».

**Qué NO se hizo, a propósito:** no se desplegó nada. Ni `vercel --prod`, ni
`firebase deploy`, ni un `merge` a `main`. Ni una línea de funcionalidad clínica.
Este trabajo es **documentación y un número de caché**.

---

## Estado del que se partió

| | |
|---|---|
| `main` | `f4ee921` — PR #383, el candidato final de Consultorio, ya fusionado |
| CI sobre ese SHA | **5/5 en verde** (run `33129847291`): `verificar` (tsc + vitest + build), `lint (trinquete)`, `clinical-safety`, `aislamiento-tenant`, `e2e-publico` |
| Árbol | limpio |
| Service worker | `nexusmed-v1171`, y `version.txt` de acuerdo con él |

## Qué cambió en esta rama

Rama `release/prod-package-2026-08-27`, salida de `f4ee921`. Cuatro cosas:

1. `public/sw.js` → `nexusmed-v1172`, con `public/version.txt` y
   `agent-state/MASTER_STATE.json` **regenerados** por sus scripts (no escrito a mano: dos sitios donde escribir la
   versión son dos sitios que se desincronizan, y ésta gobierna la purga de caché).
2. Entrada `v1172` en `docs/maintenance/sw-changelog.md`.
3. `docs/maintenance/PAQUETE-PRODUCCION-2026-08-27.md` — el inventario exacto:
   los 229 commits uno por uno (cota superior, §1 del paquete), las 63
   regresiones que cierran, dónde caen los 2 012 archivos, el orden de
   publicación y lo que el paquete **no** afirma.
4. Esta bitácora.

## Lo que se descubrió al prepararlo

**El deploy de reglas no es un trámite.** Desde `v1149` hay dos cambios sin
publicar en `firestore.rules`, y no pesan igual:

- `paquetes_visita` (`5d496cf`) — se fue a mirar quién lee esa colección antes
  de escribir que el post-visita se rompería sin las reglas. **No se rompe**:
  los dos únicos accesos son rutas de API con el SDK de administrador, que no
  pasa por las reglas. Sin desplegar, la colección queda en denegación por
  omisión para el cliente: más cerrada, no más abierta.
- `laboratorios` / REG-323 (`a03c582`) — **éste sí importa**. Es la segunda capa
  del vínculo de sujeto: sin ella, lo único que impide archivar una hoja de
  laboratorio bajo el paciente equivocado es la frontera del cliente. Una sola
  capa donde el árbol declara dos.

**La base del paquete no se sabe, y el número del service worker no la puede
decir.** Los 229 salen de contar desde el último `chore(deploy)` (`b37498f`,
v1149, 8-ago), y es el único dato del repositorio sobre qué se publicó.

`agent-state/MASTER_STATE.json` parece una segunda fuente —tiene un campo
`ultimaVersionEnProduccion`— y no lo es: se deriva de `public/version.txt`. Es
una copia del repo, así que no puede discrepar de él ni detectar una deriva. Al
ir a comprobarlo apareció el fondo del asunto: **`v1171` se subió el 9-ago
dentro de un commit de producto y nunca se volvió a mover.** Los 164 commits
siguientes no tocaron `public/sw.js`. Cualquier despliegue hecho entre el 9 y el
27 de agosto sirve exactamente el mismo `/version.txt`. El contador dejó de medir
lo que se publicó y pasó a medir la última vez que alguien tocó esa constante.

Consecuencia práctica: `curl /version.txt` **no basta** si devuelve `v1171`; hay
que leer el SHA del despliegue de producción en el panel de Vercel. Hasta que eso
se mire, 229 es una **cota superior, no una medición**, y así queda escrito en el
paquete en vez de redondearlo hacia la comodidad.

Esta máquina tampoco alcanza el sitio vivo (403 a la salida), así que ni siquiera
el primer `curl` se pudo hacer desde aquí.

**Un tropiezo propio, anotado.** Al ver que un derivado cambiaba
`ultimaVersionEnProduccion` a `v1172` —con nada publicado— se revirtió por
parecer una afirmación falsa. Era un error: el repositorio **exige** que ese
campo sea igual a `version.txt` (`el-tablero-del-loop-no-miente`), así que
regenerarlo es parte del bump, no un efecto colateral. Se regeneró y se
commiteó. Lo que sí queda dicho, arriba y en el paquete, es que el campo no
significa lo que su nombre promete.

## Lo que sigue pendiente y no lo arregla este paquete

- `TIPO_CAMBIO_USD_MXN` (B-03) y `OPS_ALERTA_WEBHOOK` (B-04) en Vercel.
- GP-FINAL corrió contra **emuladores**, no contra Firestore real.
- **Sin proveedor de ASR no se dicta**: la transcripción tardía tras edición
  manual y H-19 en navegador siguen sin recorrerse en navegador.
- Las cabeceras de producción sólo se pueden medir **después** de publicar
  (`npm run e2e:seguridad:prod`).

## Para retomar

Todo lo operativo —qué entra, en qué orden se publica, qué comprobar después—
está en [`PAQUETE-PRODUCCION-2026-08-27.md`](PAQUETE-PRODUCCION-2026-08-27.md).
Preparar el paquete y publicarlo son dos actos; el segundo es del dueño.
