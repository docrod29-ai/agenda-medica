# Acceso del paciente por enlace (magic link) — endurecimiento

## Estado actual (auditado)
- Token **HMAC-SHA256 firmado, stateless** (`src/lib/patient-token.ts`): payload = `{clinicId, patientId, exp}` (base64) + firma; verificación en servidor con `timingSafeEqual`; caduca (TTL 30 días por defecto).
- **No hay PHI en la URL**: solo ids opacos de clínica/paciente (no nombre, dx, medicamento, expediente, correo ni teléfono).
- Secreto en `PORTAL_PACIENTE_SECRET` (variable de entorno, no en el repo).

## Aplicado en esta iteración (3.4 — protección técnica)
- `/mi/*` y `/resena/*` ahora envían (next.config.ts):
  - `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet` → los buscadores no indexan URLs con token.
  - `Referrer-Policy: no-referrer` → el navegador no filtra la URL (con el token) a terceros al hacer clic en enlaces externos.
- Globales ya presentes: `X-Content-Type-Options`, HSTS, Permissions-Policy, CSP.

## Gap principal (diseño recomendado — NO implementado para no romper el portal)
El token stateless **no se puede revocar** ni limitar por usos, ni tiene bitácora por token. Upgrade recomendado (aditivo, sin romper el flujo actual):

`clinics/{clinicId}/portal_tokens/{id}`:
```ts
interface PortalToken {
  id: string                 // aleatorio cripto-seguro (opaco, en la URL)
  tokenHash: string          // SHA-256 del secreto (NO se guarda en claro)
  clinicId: string
  patientId: string
  purpose: 'portal' | 'cita' | 'receta' | 'resultado' | 'documento'
  issuedAt: string
  expiresAt: string
  maxUsos: number
  usos: number
  estado: 'activo' | 'revocado' | 'expirado'
  accesos: { at: string; ip?: string }[]   // bitácora (sin PHI)
}
```
Verificación: buscar por `id`, comparar hash con `timingSafeEqual`, validar estado/expiración/usos, registrar acceso, permitir **revocación**.

## Política por recurso (3.2 — recomendada)
| Recurso | Expiración | Usos | 2ª validación |
|---|---|---|---|
| Confirmación de cita | corta (72 h) | pocos | baja |
| Portal general | corta (7–14 d) | sesión | OTP recomendado |
| Receta | definida | lectura | 2ª validación |
| Resultado clínico | corta | lectura | 2ª validación |
| Documento sensible | muy corta | 1 uso | OTP o dato extra |

## Segunda validación para documentos sensibles (3.3 — diseño)
Antes de mostrar un documento sensible: **OTP** al teléfono/correo previamente verificado (preferido), o código entregado por el consultorio, o autenticación del portal. **No** usar fecha de nacimiento como único factor.

## Cambio de teléfono/correo (3.5 — diseño)
Solicitud → verificar identidad → **invalidar enlaces previos** (revocar tokens del paciente) → confirmar por canal antiguo (si es posible) y nuevo → bitácora.

## Copy público (3.6)
Sustituir "enlace seguro, sin contraseña" por:
> El paciente accede mediante un enlace temporal y revocable. Los documentos sensibles pueden requerir un código adicional de verificación y todos los accesos quedan registrados.
Publicar esta redacción **solo cuando** el token con estado/revocación + 2ª validación + bitácora estén implementados (hoy: parcial → mantener redacción actual hasta entonces).

## Bloqueos / pendiente
- Token con estado/revocación/usos/bitácora: **scoped como siguiente cambio** (migración aditiva del flujo del portal; no se hizo en esta iteración para no arriesgar el portal en producción).
- OTP para documentos sensibles: requiere canal verificado (tel/correo).
