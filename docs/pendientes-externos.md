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
4. Configurar el **webhook de Stripe** apuntando a `/api/stripe/...` (te doy la URL exacta cuando lo hagas).

---

## 🛡️ Seguridad verificable (requiere infraestructura o terceros)

### 3. Recuperación probada (PITR + restore drill)
- Activar **Point-in-Time Recovery** en Firestore (GCP Console) y **backups programados** (`gcloud firestore backups`).
- Correr **una restauración de prueba** en un proyecto/entorno staging y medir RPO/RTO.
- **Hasta que no se pruebe la restauración**, el control sigue "en proceso" en `/seguridad` (es lo honesto).
- El diseño y objetivos ya están en `docs/security/backup-and-restore.md`.

### 4. Pentest externo
- Contratar una **firma de seguridad** (pentest de aplicación web + API). Rango típico PyME: variable.
- Entregable: reporte con hallazgos priorizados → los corregimos → se puede citar "evaluado por terceros".
- Checklist de preparación: `docs/security/pentest-readiness.md`.

### 5. Certificación / evaluación regulatoria
- No existe hoy y **no se puede afirmar sin que un tercero la emita** (sería falso).
- Caminos: evaluación **ISO 27001** (seguridad de la información) y, para dispositivo médico/SaMD, lo que aplique con **COFEPRIS**.
- Es un proyecto con costo y tiempo; se arranca cuando haya tracción comercial que lo justifique.

---

## 📈 Cosas que solo llegan con uso real (no se pueden inventar)

### 6. Métricas públicas de precisión y rendimiento
- Requieren **medir con datos reales** (p. ej. exactitud de la nota por voz, tiempos). Publicarlas inventadas es justo lo que evitamos.
- Cuando haya volumen, se instrumenta y se publican **con su método** (no como eslogan).

### 7. Prueba social / usuarios verificables
- Testimonios y logos reales requieren **clientes reales**. Mientras tanto, la página es honesta ("producto nuevo, no inflamos cifras" — ya en `/evidencia`).
- Primer paso: conseguir 3–5 médicos piloto y pedir permiso para citarlos.

---

## Resumen de prioridad
| # | Pendiente | Quién | Esfuerzo | Desbloquea |
|---|---|---|---|---|
| 1 | MFA (habilitar en Firebase) | Tú | ~10 min | Control de seguridad "activo" |
| 2 | Stripe Connect + CFDI | Tú + Stripe/Facturama | Medio | Cobro real + facturación |
| 3 | Restore drill (PITR) | Tú + GCP | Medio | "Recuperación probada" |
| 4 | Pentest externo | Firma de seguridad | Alto ($) | "Evaluado por terceros" |
| 5 | Certificación (ISO/COFEPRIS) | Certificador | Alto ($$) | Sello regulatorio |
| 6 | Métricas de precisión | Datos reales | Con el tiempo | Cifras propias verificables |
| 7 | Prueba social | Clientes reales | Con el tiempo | Testimonios/logos |

**Lo más rentable hoy: #1 (MFA) y #2 (Stripe).** Cuando hagas el #1, dímelo y actualizo `/seguridad` en un minuto.
