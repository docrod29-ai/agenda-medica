# Pendientes que NO son código (Grupo 3) — guía de acción para el Dr.

> Grupo 1 (madurez pública) y Grupo 2 (identidad/privacidad) ya están **en producción** (main, SW v373+).
> Lo de abajo **no lo puede resolver el código**: o lo activas tú en una consola, o lo hace un tercero.
> Están ordenados por **impacto ÷ esfuerzo** (primero los que rinden más rápido).

---

## ⚡ Ganancias rápidas (dependen solo de ti)

### 1. MFA / verificación en dos pasos  — *código YA listo, falta un switch*
**Estado real:** la pantalla de 2FA (TOTP con Google Authenticator/Authy) **ya existe y funciona** en la app
(`Cumplimiento → Seguridad de la cuenta`). Lo único que falta es **habilitar MFA a nivel de proyecto** en Firebase.

**Qué hacer (≈10 min):**
1. Firebase Console → tu proyecto `nexomed-agenda` → **Authentication**.
2. Si te lo pide, **actualiza a Identity Platform** (es el mismo Auth, con MFA; tiene capa gratuita).
3. Activa **Multi-factor authentication → TOTP** (aplicación autenticadora).
4. Entra a la app con tu cuenta → `Cumplimiento → Seguridad` → **Activar 2FA** → escanea el QR → listo.

**Después, avísame:** cambio el estado del control `mfa` de "planeado" a "activo-verificado" en `/seguridad`
(solo cuando confirmes que ya enrolaste tu factor — no antes, para no mentir en esa página).

### 2. Pagos más profundos (Stripe Connect + CFDI)  — *depende de llaves y config*
**Qué hacer:**
1. Crear/activar cuenta **Stripe** (México) y, para cobrar por consultorio, **Stripe Connect**.
2. Facturación CFDI: cuenta en **Facturama** (o PAC equivalente).
3. Poner las llaves como variables de entorno en **Vercel** (Production): `STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET`, y las de Facturama. (El código de cobro/paywall ya existe; solo faltan llaves.)
4. Configurar el **webhook de Stripe** apuntando a `https://agenda-medica-one.vercel.app/api/stripe/webhook`
   (la ruta exacta, verificada en `src/app/api/stripe/webhook/route.ts` — ya no hace falta pedirla).
   El `whsec_…` lo **emite Stripe al crear el endpoint**; ese es el valor de `STRIPE_WEBHOOK_SECRET`.

**El formato de cada variable, qué pasa sin ella y cómo comprobar que llegó**:
[`docs/ops/VARIABLES-DE-ENTORNO.md`](ops/VARIABLES-DE-ENTORNO.md). Ahí está también
la advertencia que no es obvia: **una variable de Vercel no surte efecto hasta el
siguiente despliegue**, y un despliegue arrastra todo lo no publicado.

### 3. Protección de rama en `main`  — *el gate clínico YA existe, falta que BLOQUEE* (unidad E0-11)

**Estado real:** el CI ya corre en cada Pull Request un job llamado **`clinical-safety`** que
verifica los 78 archivos de invariantes clínicos y de seguridad, y que además detecta si alguien
**borró, apagó (`skip`/`only`) o vació** uno de ellos. Funciona y está probado
(`docs/ci/clinical-safety-gate.md`).

**Lo que el código NO puede hacer:** *impedir el merge*. Eso lo decide GitHub. Si el ruleset no
exige `clinical-safety`, un PR con el gate en **rojo** se puede mergear igual: el gate avisa, pero
no bloquea. **Este párrafo afirmaba que hoy es así**; se corrige, porque no está comprobado — la
API dice que `main` está protegida y no dice de qué.

**Dónde están los pasos, y por qué ya no están aquí.** Esta sección daba la
instrucción en prosa y **le faltaban tres de los cinco nombres**, incluido el
único que no coincide con el id de su job: el job `lint` reporta a GitHub como
**`lint (trinquete)`**. Quien escribiera `lint` en el ruleset habría exigido un
check que nadie reporta nunca, y GitHub habría dejado **todos los PRs**
esperándolo para siempre, con el botón de merge gris.

Los pasos verificados, los cinco nombres tal como los reporta `ci.yml`, y por qué
sólo se exigen tres, viven ahora en un solo sitio:
**[`docs/ops/PROTECCION-DE-RAMA.md`](ops/PROTECCION-DE-RAMA.md)**, con un guardián
(`src/__tests__/la-proteccion-de-rama-exige-checks-que-existen.test.ts`) que falla
si alguien renombra uno de los tres exigidos.

**Lo que sí sigue siendo cierto aquí**: el código está completo y el criterio de
aceptación de E0-11 —«un PR que rompe un invariante clínico no puede
mergearse»— **no lo cumple el código**, lo cumple una casilla en GitHub. La rama
ya reporta `protected: true`, pero la API no dice **qué** exige el ruleset: eso
se comprueba abriendo un PR y viendo los tres checks listados como *Required*.

**Lo que este párrafo mandaba hacer y NO hay que hacer** (corregido el 2-sep-2026, REG-510):
decía que había que activar **Require review from Code Owners**, y que «ya no es opcional».
Seguirlo habría cerrado `main` para siempre: `@docrod29-ai` es el único colaborador Y el único
dueño en `CODEOWNERS` Y el autor de todos los PR, y **GitHub no deja aprobar el PR propio**. La
condición no la podría cumplir nadie. El detalle, con los tres hechos medidos, está en
[`docs/ops/PROTECCION-DE-RAMA.md`](ops/PROTECCION-DE-RAMA.md) §«El paso 4 que este archivo mandaba
dar», y hay un guardián que falla si alguien vuelve a escribirlo.

**Lo que sí quedó verificado de este párrafo**: `docrod29-ai` **es** el handle real de GitHub
—comprobado contra la API el 2-sep, no deducido de la URL del remoto—, así que el archivo
`CODEOWNERS` es válido y estará listo el día que exista una segunda persona que pueda aprobar.

---

## 🛡️ Seguridad verificable (requiere infraestructura o terceros)

### 4. Recuperación probada (PITR + restore drill)
- Activar **Point-in-Time Recovery** en Firestore (GCP Console) y **backups programados** (`gcloud firestore backups`).
- Correr **una restauración de prueba** en un proyecto/entorno staging y medir RPO/RTO.
- **Hasta que no se pruebe la restauración**, el control sigue "en proceso" en `/seguridad` (es lo honesto).
- El diseño y objetivos ya están en `docs/security/backup-and-restore.md`.

### 5. Pentest externo
- Contratar una **firma de seguridad** (pentest de aplicación web + API). Rango típico PyME: variable.
- Entregable: reporte con hallazgos priorizados → los corregimos → se puede citar "evaluado por terceros".
- Checklist de preparación: `docs/security/pentest-readiness.md`.

### 6. Certificación / evaluación regulatoria
- No existe hoy y **no se puede afirmar sin que un tercero la emita** (sería falso).
- Caminos: evaluación **ISO 27001** (seguridad de la información) y, para dispositivo médico/SaMD, lo que aplique con **COFEPRIS**.
- Es un proyecto con costo y tiempo; se arranca cuando haya tracción comercial que lo justifique.

---

## 📈 Cosas que solo llegan con uso real (no se pueden inventar)

### 7. Métricas públicas de precisión y rendimiento
- Requieren **medir con datos reales** (p. ej. exactitud de la nota por voz, tiempos). Publicarlas inventadas es justo lo que evitamos.
- Cuando haya volumen, se instrumenta y se publican **con su método** (no como eslogan).

### 8. Prueba social / usuarios verificables
- Testimonios y logos reales requieren **clientes reales**. Mientras tanto, la página es honesta ("producto nuevo, no inflamos cifras" — ya en `/evidencia`).
- Primer paso: conseguir 3–5 médicos piloto y pedir permiso para citarlos.

---

## Resumen de prioridad
| # | Pendiente | Quién | Esfuerzo | Desbloquea |
|---|---|---|---|---|
| 1 | MFA (habilitar en Firebase) | Tú | ~10 min | Control de seguridad "activo" |
| 2 | Stripe Connect + CFDI | Tú + Stripe/Facturama | Medio | Cobro real + facturación |
| 3 | ~~Protección de rama en `main`~~ **HECHO 2-sep-2026** | — | — | Cierra E0-11: los tres checks exigidos, el gate clínico BLOQUEA el merge |
| 4 | Restore drill (PITR) | Tú + GCP | Medio | "Recuperación probada" |
| 5 | Pentest externo | Firma de seguridad | Alto ($) | "Evaluado por terceros" |
| 6 | Certificación (ISO/COFEPRIS) | Certificador | Alto ($$) | Sello regulatorio |
| 7 | Métricas de precisión | Datos reales | Con el tiempo | Cifras propias verificables |
| 8 | Prueba social | Clientes reales | Con el tiempo | Testimonios/logos |

**Lo más rentable hoy: #1 (MFA) y #2 (Stripe).** Cuando hagas el #1, dímelo y actualizo `/seguridad` en un minuto.
