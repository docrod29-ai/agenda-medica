# Paquete de producción — `nexusmed-v1175`

> **Estado: PREPARADO, NO PUBLICADO.** Este documento describe exactamente qué se
> publicaría. Nadie ha desplegado nada. Publicar a producción y desplegar reglas
> de Firestore siguen siendo decisiones del dueño
> (`.claude/rules/deployment-and-flags.md`).

| | |
|---|---|
| **SHA base del paquete** | `cb9c78f16d2e1cd56db880ea5ccca8983338fe67` (`main`) |
| **Versión del service worker** | `nexusmed-v1174` → **`nexusmed-v1175`** |
| **Última línea desplegada** | `86ffe981` — `ops: nexusmed-v1174`, 28-ago. Ver §1 |
| **Commits que entran** | **78** (63 directos + 15 merges) |
| **Rango de fechas** | 28-ago-2026 → 30-ago-2026 |
| **Superficie** | 294 archivos · +46 068 / −1 091 líneas · **138 de código de producto** |
| **Rutas de API nuevas** | **0** |
| **Pantallas nuevas** | **0** |
| **CI sobre el SHA base** | 6/6 en verde (PR #407 y #408, runs `33340052759` y `33342089732`) |
| **Deploy de reglas de Firestore** | **OBLIGATORIO Y APARTE** — ver §2 |

---

## Por qué existe este documento

> «Un despliegue arrastra TODO lo no desplegado. No publica "lo último que se
> pidió": publica todo lo pendiente. Declarar el paquete antes de publicar.»
> — `.claude/rules/deployment-and-flags.md`

El siguiente `vercel --prod` no publica el arreglo de «Negadas»: publica los **78
commits** de dos días, de una vez. Esto es la declaración de ese paquete, escrita
**antes** de publicar y no después.

---

## 1. La base, y por qué esta vez sí se sabe

A diferencia del paquete del 27-ago —donde la última línea desplegada era una cota
superior y no un dato— aquí la base es firme: `86ffe981` es el commit
`ops: nexusmed-v1174`, y la entrada de v1174 en el changelog dice literalmente
**«Este bump va CON su despliegue»**. De ahí salen los 78.

Sigue valiendo la advertencia de aquel documento: `public/version.txt` es una
copia del propio repositorio, así que **no puede detectar una deriva**. Si
producción sirviera algo distinto de v1174, este repositorio no lo sabría. La
comprobación real es el `curl` de después de publicar, en §4.

**No se pudo verificar desde la sesión que preparó esto**: la política de red del
entorno deniega la salida al sitio vivo y a `vercel.com`. Todo lo de abajo está
preparado, nada está publicado ni comprobado contra producción.

### `MASTER_STATE.json` dice ahora `v1175`, y eso NO significa que esté desplegada

`scripts/agent-state/actualizar.mjs` deriva `ultimaVersionEnProduccion` de
`public/version.txt`. Al subir el service worker a v1175, el campo pasó a
`nexusmed-v1175` **antes de que exista despliegue alguno**.

No se corrigió a mano a propósito: es un documento derivado, y editarlo a mano es
justo lo que REG-241 y el PR #407 prohíben — el guardián lo compararía con lo que
produce su script y fallaría. Queda declarado aquí, que es donde se puede leer:
**ese campo no es evidencia de despliegue**, es una copia de un archivo de este
mismo repositorio, y no puede discrepar de él ni detectar una deriva. La única
evidencia real es el `curl` de §4, contra el sitio vivo, después de publicar.

---

## 2. Las reglas de Firestore van APARTE, y sin ellas queda roto

`vercel --prod` **no publica `firestore.rules`**. Este paquete las cambia
(REG-340), y el código que se publicaría da por buenas dos cosas que sin ese
despliegue no funcionan:

| Colección | Qué pasa hoy sin la regla |
|---|---|
| `clinics/{clinicId}/members/{uid}` | El apodo del chat se lee **y** se escribe desde el navegador y no tenía regla: caía en el comodín de denegación total. **No se guardaba nunca**, y nadie se enteraba porque el código cae con elegancia al nombre por omisión. |
| `.../internamientos/{id}/registros/{id}` | La bitácora **append-only** del episodio — la copia íntegra y sin truncar que existe para la NOM-004. No estaba declarada en ninguno de los tres sitios, así que **no se respaldaba**: se restauraba el episodio, su bitácora legal no volvía, y el pie del archivo seguía diciendo `completo: true`. |

Además **70 líneas nuevas de `firestore.indexes.json`**. Una consulta que las
necesite falla en producción hasta que se publiquen.

```bash
npx firebase deploy --only firestore:rules,firestore:indexes --project nexomed-agenda
```

**Requiere autorización del dueño**, igual que el despliegue.

---

## 3. Qué lleva dentro

**REG-373 → REG-412.** Los que tocan lo que el médico ve:

- **REG-412** — «Negadas» se pintaba como alérgeno en el aviso del expediente, con
  severidad y con botón; cada pulsación la añadía otra vez al campo del paciente.
- **REG-410** — la warfarina de marzo, otra vez, y en la pantalla donde se firma.
- **REG-409** — un WER bajo no compensa una dosis por mil.
- **REG-405** — la medicación vigente se calculaba sobre una ventana y se enseñaba
  como el expediente entero.
- **REG-403 / REG-404** — «lo vi» y «localicé a alguien» eran el mismo gesto; y
  agendar contaba como haber visto al paciente.
- **REG-411** — un aviso efímero sobre una pérdida permanente es no avisar.

**WS-09 · WS-10 · WS-12** — función renal al motor de aplicabilidad, el eje de
riesgos que reúne sin decidir, y la cita literal que dice lo contrario.

**Evidencia y consultor** — REG-400, REG-401, REG-402, REG-406, REG-407.

**Operación del bucle** — un tablero y un escritor; los pliegos del dueño entran al
repositorio; el escritor deja de tocar documentos derivados.

Reparto de la superficie:

| Ruta | Archivos | Líneas |
|---|---:|---|
| `src/__tests__` | 102 | +16 861 / −122 |
| `src/lib` | 81 | +12 061 / −202 |
| `docs` | 26 | +10 873 / −66 |
| `src/app` | 45 | +2 694 / −313 |
| `scripts` | 11 | +1 859 / −23 |
| `e2e` | 2 | +255 / −2 |
| `src/components` | 5 | +125 / −31 |
| `agent-state` | 4 | +270 / −18 |

---

## 4. El ciclo, y dónde está cada paso

```
✅ vitest                     11 654 en verde (ver §5)
✅ lint-trinquete             95 = techo, sin deuda nueva
✅ tsc --noEmit               limpio
⚠️  npm run build             compila; cae en recolección de datos de página por
                              falta de credenciales de Firebase en el contenedor
✅ public/sw.js → v1175
✅ node scripts/version-sw.mjs
✅ bitácora + changelog
✅ commit
⬜ vercel --prod --archive=tgz          ← DEL DUEÑO
⬜ npx firebase deploy --only firestore:rules,firestore:indexes   ← DEL DUEÑO, §2
⬜ curl https://<sitio>/version.txt  →  debe decir nexusmed-v1175
⬜ npm run e2e:seguridad:prod           ← DESPUÉS de publicar, no antes
```

Ninguna ruta de API nueva y **ninguna pantalla nueva**, así que
`e2e:seguridad:prod` no debería teñirse de rojo por una ruta privada que
producción todavía no sirve — que es el falso rojo que describe la regla.

---

## 5. Lo que NO está verde, y por qué no es de este paquete

`src/__tests__/ops-timeout-y-punto-ciego.test.ts` → «el error dice cuánto esperó y
a quién». Marca a `10.255.255.1` esperando que la conexión se agote; el proxy de
este entorno **contesta al instante**, así que el timeout nunca ocurre.
Comprobado sobre `origin/main` sin tocar: **falla igual**. No es de este paquete y
no se tocó.

---

## 6. Lo que este documento NO afirma

- **No afirma que producción sirva hoy v1174.** Lo afirma el changelog de v1174;
  no se pudo comprobar contra el sitio vivo desde aquí.
- **No afirma que el paquete siga siendo éste cuando se publique.** Si algo más
  entra a `main` antes del `vercel --prod`, entra también en el despliegue: hay
  que rehacer la cuenta. En particular, el PR **#399** (321 archivos) está abierto
  y no está incluido en estas cifras.
- **No sustituye la comprobación de cabeceras de producción.** Ésa sólo tiene
  sentido contra el sitio vivo, después de publicar.
