# Regression Ledger — NexusMED

Registro canónico de incidentes de seguridad/clínicos/integridad corregidos, cada uno
con su **test permanente** (o el control que lo cierra). Regla del charter: un problema
corregido no se asume corregido para siempre — cada ciclo verifica que no reaparezca.

Estados: **CLOSED** (con test/control) · **OPEN** (detectado, pendiente de reparar).

| ID | Área | Incidente | Estado | Test / control permanente |
|----|------|-----------|--------|----------------------------|
| REG-001 | Clínico | FIB-4 daba 3053.54 en vez de 3.05 (plaquetas ×10⁹/L vs /µL, error 1000×) | CLOSED | `src/__tests__/clinical-safety-harness.test.ts` (bloque FIB-4: caso exacto + robustez de unidad) |
| REG-002 | Seguridad | Cliente podía extender `trialEndsAtMs`/plan/entitlements | CLOSED | `firestore.rules` (clinics create/update congelan campos) + `src/__tests__/firestore-rules-guard.test.ts` |
| REG-003 | Dinero | `cobroExento=true` creado desde cliente sin autorización | CLOSED | `firestore.rules` appointments (exige `exentoPor==uid` + motivo) |
| REG-004 | Seguridad | `googleTokens` (OAuth) leíbles/escribibles por cliente | CLOSED | `firestore.rules` (deny read+write total) |
| REG-005 | Dinero | Monto de pago controlado por el navegador | CLOSED | Servidor resuelve monto (api/stripe, booking) — pendiente test dedicado de replay/monto |
| REG-006 | Clínico-legal | Receta/QR firmada con datos arbitrarios del cliente | CLOSED | Servidor firma datos autoritativos (fetch receta → verifica → hash) |
| REG-007 | Clínico | CKD-EPI implementada dos veces con redondeo distinto | CLOSED | `funcion-renal.ts` fuente única + re-export en `calculadoras.ts` + harness |
| REG-008 | Clínico | Thresholds de NEWS2 duplicados en la UI | CLOSED | `src/lib/hospital/news2.ts` fuente única + `src/__tests__/l6-acvpu-fhir.test.ts` |
| REG-009 | Seguridad | XSS almacenado en brazalete BCMA (servicio/cama/nombre en `document.write`) | CLOSED | Escape HTML completo en `imprimirBrazalete` (hospitalizacion/[internamientoId]) |
| REG-010 | Seguridad | Mass-assignment en `/api/appointments` y `/api/hospital/mutar` (crear) | CLOSED | Allowlist explícita de campos + autoría fijada por servidor |
| REG-011 | Datos | Corte de caja usaba tz de CDMX (día equivocado en el norte) | CLOSED | `corte-caja/page.tsx` usa `config.zonaHoraria` real |
| REG-012 | Auth | Cuenta con MFA quedaba fuera (login no manejaba `multi-factor-auth-required`) | CLOSED | `src/app/login/page.tsx` + `src/lib/mfa.ts` (resolver TOTP) |
| REG-013 | Clínico | Peso pediátrico: confusión kg/lb producía dosis peligrosa | CLOSED | `src/__tests__/peso-pediatrico-seguridad.test.ts` (hard-stop, sin heurística) |
| REG-014 | Seguridad-legal | Firma médica (`firmaImagenDataUrl` en `config/main`) **leíble** por cualquier miembro vía SDK → robo para estampar recetas | **OPEN** | (pendiente) separar a subdoc con `read: if isMedico` |
| REG-015 | Dinero | `cobros` create no fuerza `creadoPor==uid` ni valida `monto≥0` → cobro atribuible a otro / retroactivo | **OPEN** | (pendiente) regla create como `farmacia_movimientos` |
| REG-016 | Integridad | `clinic_review_requests` update sin `hasOnly` → al marcar `used` se pueden mutar otros campos | **OPEN** | (pendiente) `hasOnly(['used','usedAt'])` |
| REG-017 | Integridad | Una nota puede nacer `estado:'firmada'` (salta flujo borrador→firmada) | **OPEN** | (pendiente) forzar `estado=='borrador'` en create |
| REG-018 | Clínico | Amikacina: dosis/toma no acotada por `topeMgKgDia` → receta 50% arriba del tope seguro en 1 toma/día | CLOSED | `src/__tests__/clinical-safety-harness.test.ts` (bloque Aminoglucósidos + invariante universal porToma≤porDía) |
| REG-019 | Auth | WhatsApp disconnect/connect y CFDI eran any-member (podía desconectar mensajería a pacientes / timbrar) | CLOSED | Endpoints ahora `verificarMedico` (paridad con plantillas-config/voz-config) |

> Mantener este archivo actualizado en cada ciclo del loop de auditoría. Cada `OPEN` debe
> pasar a `CLOSED` con su test/control antes de cerrar el lote correspondiente.
