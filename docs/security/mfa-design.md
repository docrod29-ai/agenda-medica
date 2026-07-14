# Diseño de MFA — NexusMED

Estado: **PLANEADO / BLOCKED** — requiere habilitar **Firebase Identity Platform** (multi-factor) en el proyecto. Firebase Auth "básico" no soporta MFA TOTP; la API `multiFactor` del SDK exige Identity Platform. No se implementa código de auth que no pueda probarse en staging (riesgo de romper el login).

## Factores (preferencia)
1. **TOTP** (app autenticadora) — preferido, sin costo, sin dependencia de SMS.
2. **Códigos de recuperación** de un solo uso (10, regenerables).
3. SMS solo como respaldo (costo + riesgo SIM-swap).
4. WebAuthn/passkeys: evaluar cuando Firebase lo soporte de forma estable.

## Política
- **Obligatorio** para administradores.
- **Muy recomendado** (opción de obligatorio por clínica) para médicos.
- Reautenticación de MFA para acciones críticas (cambiar MFA, exportar datos, cambiar cobros).
- Alertas por correo ante enrolamiento/cambio/revocación de MFA.
- Rate limiting + protección contra enumeración de usuarios (ya parcial en login).
- Registro de eventos de MFA en la bitácora.

## Flujos a implementar (cuando Identity Platform esté activo)
- Enrolamiento: mostrar QR TOTP → confirmar código → generar códigos de recuperación.
- Verificación en login (segundo paso).
- Uso de código de recuperación.
- Revocación / cambio de dispositivo / regeneración de códigos.
- Recuperación de cuenta (soporte con verificación de identidad).

## Pruebas (definidas, a ejecutar en staging)
Enrolamiento válido · código incorrecto · expirado · reutilizado · recuperación · revocación · cambio de dispositivo · sesión existente tras cambio de MFA · admin sin MFA (bloqueo de acciones) · fuerza bruta (rate limit).

## Bloqueo
`MFA: BLOCKED — habilitar Identity Platform (consola Firebase) + entorno de staging para probar los flujos sin afectar el login de producción.`
