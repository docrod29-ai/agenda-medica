# Respaldos automáticos + App Check — guía paso a paso

Dos protecciones que requieren **un paso tuyo** en las consolas de Google/Firebase
(yo ya dejé el código y la configuración lista en la app). Hazlas una vez y quedan
corriendo solas.

---

## 1. App Check (anti-abuso) — evita que roben tus llaves

**Qué protege:** tus claves `NEXT_PUBLIC_FIREBASE_*` viajan al navegador (es normal),
así que cualquiera podría copiarlas e intentar pegarle a tu Firestore desde un script.
App Check exige que cada llamada traiga un token que **solo tu app real** puede generar
(vía reCAPTCHA v3 de Google). Sin ese token, Firebase rechaza la llamada.

**El código ya está** en `src/lib/firebase.ts`: se activa solo cuando defines el site key.
Mientras no lo definas, no pasa nada (la app funciona igual).

### Pasos

1. **Registra reCAPTCHA v3**
   - Ve a https://www.google.com/recaptcha/admin/create
   - Tipo: **reCAPTCHA v3**
   - Dominios: agrega el dominio de producción (ej. `nexusmed.mx`, tu dominio de Vercel)
     y `localhost` para pruebas.
   - Copia la **Clave del sitio** (site key). *La clave secreta NO se usa aquí.*

2. **Habilita App Check en Firebase**
   - Firebase Console → **App Check** → tu app web → **Registrar**
   - Proveedor: **reCAPTCHA v3** → pega el site key.

3. **Pon el site key en Vercel** (es pública, no es secreto)
   - Vercel → tu proyecto → Settings → Environment Variables → **Add**
   - Name: `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY`
   - Value: el site key de reCAPTCHA
   - Environments: Production + Preview → Save → **Redeploy**.

4. **NO actives la enforcement todavía.** Primero deja rodar 1–2 días con App Check
   solo *monitoreando* (Firebase Console → App Check muestra el % de tráfico verificado).
   Cuando veas que casi todo el tráfico legítimo trae token, entonces:
   - App Check → APIs (Firestore, Storage) → **Enforce**.
   - Si algo se rompe, apaga la enforcement — el resto de la app sigue funcionando.

> ⚠️ Si prendes *Enforce* antes de que el site key esté desplegado, bloquearás tu
> propia app. Por eso el orden: registrar → desplegar key → monitorear → enforce.

---

## 2. Respaldos automáticos de Firestore

**Qué protege:** pérdida o borrado accidental de datos (censo, expedientes, citas).
Tú eres especialmente sensible a esto — esto es la red de seguridad definitiva.

Hay **dos capas**. Activa las dos.

### Capa A — Point-in-Time Recovery (PITR) · lo más importante y fácil

Permite restaurar Firestore a **cualquier minuto de los últimos 7 días**. Un comando:

```bash
gcloud firestore databases update --database='(default)' \
  --enable-pitr --project=TU_PROJECT_ID
```

(o desde Firebase Console → Firestore → ⚙️ → **Point-in-time recovery** → Enable).

### Capa B — Exportaciones diarias a Cloud Storage (respaldo frío)

Copias completas diarias que puedes descargar/archivar.

1. **Crea un bucket para respaldos** (una vez):
   ```bash
   gcloud storage buckets create gs://TU_PROJECT_ID-backups \
     --location=us-central1 --project=TU_PROJECT_ID
   ```

2. **Programa el respaldo diario** (Firestore lo trae nativo):
   ```bash
   gcloud firestore backups schedules create \
     --database='(default)' \
     --recurrence=daily \
     --retention=14d \
     --project=TU_PROJECT_ID
   ```
   Esto guarda 14 días de respaldos diarios administrados por Firestore.

3. **(Opcional) Export manual a tu bucket** cuando quieras un snapshot descargable:
   ```bash
   gcloud firestore export gs://TU_PROJECT_ID-backups/$(date +%F) \
     --project=TU_PROJECT_ID
   ```

### Cómo restaurar (si algún día pasa lo peor)

- **PITR** (borrado reciente): `gcloud firestore databases restore` apuntando al
  timestamp anterior al incidente → crea una base nueva desde ese punto.
- **Backup programado**: `gcloud firestore backups restore --backup=BACKUP_ID`.
- **Export manual**: `gcloud firestore import gs://.../CARPETA`.

Guarda tu `TU_PROJECT_ID` a la mano. Con esto, **ningún borrado es permanente**.

---

## Checklist rápido

- [ ] reCAPTCHA v3 creado, site key copiado
- [ ] App Check registrado en Firebase con ese key
- [ ] `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` en Vercel + redeploy
- [ ] Monitorear 1–2 días → luego Enforce
- [ ] PITR habilitado (1 comando)
- [ ] Respaldo diario programado (retención 14 días)
