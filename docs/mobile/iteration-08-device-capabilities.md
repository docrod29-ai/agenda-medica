# Iteración 8 — DEVICE_CAPABILITIES · Reporte

- **Iteration ID:** nexusmed-mobile-008 · **Modo:** DEVICE_CAPABILITIES · **Entorno:** staging / rama `feat/mobile-excellence` · **Producción:** no alterada · `production_deployment_allowed: false`.
- **Estado:** **PARTIAL — fuga de PHI en notificaciones (§8.6) CONFIRMADA y CORREGIDA; cámara/biometría/compartir se difieren a dispositivo.**

## Hallazgo confirmado y corregido (privacidad, §8.6 / §5.3)
Las notificaciones de recordatorio de cita **mostraban PHI en la pantalla bloqueada** (`useNotificacionesCitas.ts`):
- Título: `Cita en 30 min — <NOMBRE DEL PACIENTE>` → **nombre completo en el lock screen**.
- Body: `<hora> · <MOTIVO>` → **motivo/contenido clínico** en el lock screen.
- Teleconsulta body: `<NOMBRE DEL PACIENTE> · prepara tu cámara` → nombre otra vez.

Cualquiera cerca del teléfono podía leer el nombre del paciente y el motivo sin desbloquear. §8.6 lo prohíbe por defecto.

### Corrección
- Nuevo `src/lib/mobile/notif-privacidad.ts` → `notificacionCitaSegura(tipo, {minutos})`: texto **sin nombre ni motivo**. El médico ve el detalle **al abrir** la app (autenticado).
  - "Cita próxima" · "Tienes una consulta en 30 minutos. Ábrela en la app."
  - "Teleconsulta en 5 min" · "Prepara tu cámara y ábrela en la app."
- `useNotificacionesCitas.ts` ahora usa esa política en los dos recordatorios.

**Archivos:** `notif-privacidad.ts`, `notif-privacidad.test.ts` (nuevos); `useNotificacionesCitas.ts` (usa la política). Deps/migraciones: 0.

## Pruebas
- `tsc --noEmit` → 0.
- `vitest run` → **386/386** (3 nuevos; sin regresión). El test **falla si el texto contiene un nombre de paciente o un motivo** → fija la regla §8.6.
- `next build` → OK.
- **Verificación:** el CONTENIDO seguro está verificado por test (no hay nombre/motivo en la salida). El render real en la pantalla bloqueada de un iPhone/Android no se puede probar aquí, pero el texto que se envía ya no lleva PHH.

## Diferido (requiere dispositivo — §8.1–8.5)
- **Cámara/escáner:** consentimiento, confirmación antes de guardar, sin geolocalización, sin galería automática, revisión antes de OCR.
- **Micrófono:** indicador visible, pausa/cancelación, política de retención (existe parcialmente; auditar en dispositivo).
- **Biometría:** WebAuthn/passkeys para login/reautenticación/firma (no almacenar biometría).
- **Compartir:** share sheet con confirmación de destinatario + expiración.
Todo esto necesita hardware real para verificar permisos y comportamiento.

## Quality Gate
```
QUALITY GATE: PARTIAL — corregida una fuga REAL de PHI en notificaciones (nombre y
motivo del paciente ya NO van a la pantalla bloqueada, §8.6), con política pura y
test que lo fija. tsc 0, 386/386, build OK. Cámara/biometría/compartir se difieren
a verificación en dispositivo. production_deployment_allowed:false.
```

## Nota de despliegue
Este fix (quitar PHI de las notificaciones) es seguro y verificado; se puede incluir en el próximo despliegue a producción cuando quieras.

## Siguiente iteración recomendada (no implementada)
**Iteración 9 — MOBILE_SECURITY** (sesiones, dispositivo compartido, PHI en app-switcher, logs sin PHI, threat model). Parte es verificable por código (sanitización de logs, deep-link auth), parte necesita dispositivo.
