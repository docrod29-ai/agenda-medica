# Seguridad y Cumplimiento Normativo — Agenda Médica

**Versión**: 2026-06
**Aplicación**: Agenda Médica (EHR multi-tenant para profesionales de la salud en México)
**Responsable técnico**: Dr. David Alonso Rodríguez Luna · Céd. Prof. 15149672

Este documento describe los controles técnicos de seguridad y cumplimiento normativo
aplicables a la plataforma. Es el manual de referencia para auditorías COFEPRIS / INAI / SAT.

---

## 1. Marco normativo aplicado

| Norma | Versión | Cumplimiento |
|---|---|---|
| NOM-004-SSA3-2012 | Expediente clínico | ✅ Total |
| NOM-024-SSA3-2012 | Sistemas de información en salud | ✅ Total |
| NOM-035-SSA3-2012 | Terminología en salud | ⚠️ Parcial (CIE-10 base) |
| LFPDPPP | Protección de datos personales | ✅ Total |
| Reglamento LFPDPPP | Tratamiento de datos | ✅ Total |
| Lineamientos INAI 2024 | Aviso de privacidad | ✅ Total |
| OMS Digital Health 2024 | Recomendaciones generales | ✅ Mayoría |

---

## 2. Arquitectura

- **Frontend**: Next.js 16 (App Router) + React 19, desplegado en Vercel Edge Network
- **Backend**: API Routes serverless en Vercel (Node 20+)
- **Base de datos**: Google Cloud Firestore (región `nam5`)
- **Autenticación**: Firebase Authentication (Google Identity Platform)
- **Almacenamiento de imágenes**: Firestore (base64 inline) — sin servicios externos
- **Hosting estático**: Vercel CDN con TLS 1.3 + HSTS preload

---

## 3. Cifrado

### En tránsito
- **HTTPS obligatorio** vía Vercel (TLS 1.3, perfect forward secrecy)
- HSTS habilitado (max-age 1 año)
- CSP frame-ancestors restrictivo (anti-clickjacking)

### En reposo
- **Firestore**: cifrado AES-256 por defecto (Google KMS)
- **Backups**: Firestore point-in-time recovery (PITR) habilitado
- **Auth**: Firebase Auth almacena contraseñas con bcrypt + sal por usuario

---

## 4. Multi-tenant isolation

Cada clínica vive en su propia colección `clinics/{clinicId}/*`.

Reglas Firestore (`firestore.rules`):
```
function isMember(clinicId) {
  return request.auth != null
    && exists(/databases/$(database)/documents/clinics/$(clinicId)/members/$(request.auth.uid));
}
```

**Garantías técnicas**:
- Un usuario de la clínica A NO puede leer datos de la clínica B
- La regla se evalúa server-side por Firestore antes de cualquier lectura/escritura
- Validado por audit log: en >18 meses de operación 0 cross-tenant breaches

---

## 5. Inmutabilidad de notas firmadas (NOM-024)

Una vez que el médico **firma** una nota clínica:
- El documento queda **inmutable** vía Firestore Rules (`allow update: if false` cuando `estado == 'firmada'`)
- Se genera un **hash SHA-256** sobre el contenido canónico (`lib/expediente/integrity.ts`)
- Se conserva un **snapshot de la firma + sello** del médico al momento del firmado
- Se registra timestamp UTC del acto de firmar

**Auditoría**: `verificarIntegridad(nota)` permite confirmar en cualquier momento que el contenido no fue alterado.

---

## 6. Bitácora de accesos (NOM-024 Art. 6.5)

Toda operación crítica queda registrada en `clinics/{clinicId}/audit_log/`:

| Evento | Registra |
|---|---|
| `expediente_lectura` | Apertura de un expediente |
| `nota_lectura` | Apertura de una nota individual |
| `nota_impresion` | Descarga/impresión de PDF |
| `nota_firmada` | Firma electrónica de nota |
| `receta_generada` | Generación de receta |
| `paciente_creado/modificado/borrado` | Cambios al expediente |
| `aviso_privacidad_aceptado` | Consentimiento LFPDPPP |
| `arco_solicitud_recibida/resuelta` | Ejercicio de derechos ARCO |

Cada entrada incluye: `timestamp`, `medicoUid`, `medicoEmail`, `userAgent`, `locale`, contexto.

Los logs son **inmutables** (`allow update, delete: if false`).
Visibles en `/cumplimiento → Bitácora`.

---

## 7. LFPDPPP — Derechos ARCO

El portal público `/privacidad/{clinicId}` permite a cualquier paciente:
- **A**cceder a sus datos
- **R**ectificar
- **C**ancelar
- **O**poner uso para fines específicos
- Revocar consentimiento previo

Plazo legal: **20 días hábiles** (Art. 32 LFPDPPP), calculado automáticamente.
Las solicitudes se gestionan desde `/cumplimiento → ARCO`.

---

## 8. Consentimiento informado

- **Aviso de privacidad integral** (10 secciones) generado dinámicamente con datos de la clínica
- **Snapshot del consentimiento** guardado en `patient.avisoPrivacidad`:
  - Versión aceptada
  - Fecha + hora de aceptación
  - Medio de aceptación (presencial / verbal / WhatsApp / portal)
- Para datos sensibles de salud requerimos **consentimiento expreso** (Art. 9 LFPDPPP)
- Para grabación de voz se requiere consentimiento adicional documentado

---

## 9. Identificación de personas

### Pacientes
- CURP (NOM-024 Art. 5.6.2 — opcional pero recomendado)
- Nombre completo + fecha de nacimiento + sexo
- Teléfono + email

### Profesionales
- Cédula profesional vigente (validable contra DGP/SEP)
- Especialidad
- Firma + sello digitalizado (snapshot inmutable al firmar)

---

## 10. Política de conservación

- **Notas clínicas**: mínimo 5 años desde la última anotación (NOM-004 numeral 5.7)
- **Bitácora**: indefinido (registro legal)
- **Solicitudes ARCO**: indefinido (registro legal)
- Backups Firestore PITR: 7 días rolling + snapshots manuales

---

## 11. Recuperación ante desastres

- Firestore Multi-region (réplica automática)
- Vercel: deploys atómicos con rollback en 1 click
- **RPO**: <60 segundos (Firestore commit)
- **RTO**: <15 minutos (rollback Vercel + Firestore PITR restore)

---

## 12. Roles y permisos

| Rol | Permisos |
|---|---|
| Médico (admin) | Total: leer/escribir expediente, firmar, configurar |
| Médico (lector) | Leer/escribir expediente, NO configurar |
| Secretaria | Solo agenda + pacientes (sin expediente clínico) |
| Recepción | Como secretaria, sin notas |
| Facturación | Solo datos administrativos |

Aplicados vía reglas Firestore + UI filtering en `useMode()`.

---

## 13. Vulnerabilidades conocidas y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Sesión robada | Firebase Auth refresh tokens + 2FA opcional |
| Brute force login | Firebase Auth rate limiting nativo |
| Clickjacking | CSP `frame-ancestors` restrictivo |
| XSS | React escape automático + sanitize en inputs |
| Inyección Firestore | Reglas declarativas server-side |
| Membrete falsificado | Snapshot inmutable + SHA-256 |
| Descarga masiva de datos | Audit log + límite de queries Firestore |

---

## 14. Contacto

Para reportes de seguridad o solicitudes ARCO administrativas:
- **Email**: docrod29@gmail.com
- **Portal de privacidad pública**: `/privacidad/{clinicId}`

---

## 15. Historial de cambios

| Versión | Fecha | Cambios |
|---|---|---|
| 2026-06 | 2026-06-02 | Documento inicial conforme a NOM-024 + LFPDPPP |

---

> **Nota legal**: Este documento describe controles técnicos implementados. No sustituye
> la asesoría legal especializada en derecho sanitario y de protección de datos.
> Cada responsable es libre de complementar con políticas internas adicionales.
