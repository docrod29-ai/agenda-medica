# Anti-plagio — proteger NexusMED de que te copien

Protección en tres frentes: **legal** (lo más fuerte, lo haces tú),
**técnico** (ya reforzado en el código) y **operativo** (buenas prácticas).

---

## 1. Legal — registra tus derechos (México)

Esto es lo que de verdad te deja demandar a quien te copie. El código sin registro
te protege poco; la marca y el registro de obra, mucho.

### a) Marca "NexusMED" — IMPI

Registra la marca para que nadie más pueda usar el nombre/logo en software médico.

- Portal: https://www.gob.mx/impi → **Marca en Línea**.
- Antes: haz una **búsqueda fonética** (gratis, en el mismo portal) para confirmar que
  "NexusMED" está libre en tu clase.
- **Clases de Niza** recomendadas:
  - **Clase 42** — software como servicio (SaaS), diseño y desarrollo de software.
  - **Clase 44** — servicios médicos / de salud (si lo posicionas así).
  - **Clase 9** — software descargable (opcional).
- Costo aprox.: ~$2,900–3,500 MXN por clase. Vigencia 10 años, renovable.
- Resultado: derecho exclusivo sobre el nombre → puedes frenar imitadores.

### b) Registro de obra (código y diseño) — INDAUTOR

El código fuente es una **obra** protegida por derecho de autor desde que se crea,
pero registrarla te da **fecha cierta** y prueba de autoría para un juicio.

- Portal: https://www.indautor.gob.mx → registro de obra tipo **"programa de cómputo"**.
- Entregas un ejemplar del código (puede ser parcial/ofuscado) + datos del autor.
- Costo aprox.: ~$250 MXN. Trámite sencillo.
- Registra también el **manual/guía** y el **diseño de interfaz** como obras separadas si quieres.

### c) Contratos

- **Términos de Uso** (ya publicados en `/terminos`): prohíben expresamente revender,
  descompilar o crear obras derivadas del Servicio. Esto es tu base contractual.
- Si contratas desarrolladores o socios: **cláusula de cesión de derechos + NDA**, para
  que el código y la marca queden a nombre de tu empresa, no de ellos.

---

## 2. Técnico — ya reforzado en el código

Lo que un competidor necesitaría para clonarte NO está expuesto:

- ✅ **Lógica de negocio en el servidor.** Los prompts clínicos, el motor de
  antibiogramas, el cálculo de créditos y las llaves de IA viven en API routes /
  Admin SDK, no en el bundle del navegador. Copiar el front no les da el cerebro.
- ✅ **Secretos fuera del cliente.** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, Stripe,
  Facturama: todos server-side. Nunca en `NEXT_PUBLIC_*`.
- ✅ **Sin source maps en producción** (`productionBrowserSourceMaps: false`) → no
  pueden descargar tu código fuente legible desde el navegador.
- ✅ **Sin header `X-Powered-By`** → no regalas el stack a quien escanee.
- ✅ **App Check** (ver `RESPALDOS_Y_APPCHECK.md`) → aunque copien tus claves
  públicas de Firebase, no pueden usar tu backend desde su propia app.
- ✅ **Rate limiting** → no pueden raspar/abusar tus endpoints de IA en masa.

> Nota honesta: cualquier front-end web es, por naturaleza, inspeccionable (el HTML/CSS
> se ve). Lo que importa es que **lo valioso** (IA, datos, lógica, marca) esté protegido —
> y lo está. La ofuscación total del JS da falsa sensación de seguridad y complica el
> mantenimiento; no vale la pena.

---

## 3. Operativo

- Mantén el repositorio **privado** (GitHub privado) con acceso mínimo.
- Registra la **fecha de tus commits** (el historial de git ya es evidencia de autoría
  y anterioridad).
- Pon un aviso `© NexusMED. Todos los derechos reservados.` en la landing y el footer
  (ya está).
- Si detectas una copia: guarda evidencia (capturas con fecha, URL), y con tu marca IMPI
  registrada puedes enviar un requerimiento de cese o proceder legalmente.

---

## Checklist

- [ ] Búsqueda fonética "NexusMED" en IMPI
- [ ] Registro de marca IMPI (clase 42, opcional 44/9)
- [ ] Registro de obra (código) en INDAUTOR
- [ ] Repo privado + NDA/cesión con cualquier colaborador
- [x] Lógica y secretos en servidor (hecho)
- [x] Source maps y X-Powered-By desactivados (hecho)
- [x] App Check + rate limiting (hecho / por activar en consola)
