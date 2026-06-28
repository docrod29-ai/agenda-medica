# Cumplimiento normativo — NexusMED / agenda-medica

> Estado: **listo para auditoría** (technical readiness). La **certificación formal**
> la emite un organismo/unidad de verificación externa; este documento es la base
> que el auditor revisa. No sustituye la certificación.

## 1. Marco aplicable (México)

| Norma | Qué exige | Estado técnico en la app |
|---|---|---|
| **NOM-004-SSA3-2012** (expediente clínico) | Estructura, contenido y conservación de la nota; identificación del médico (nombre + cédula) | ✅ Notas estructuradas por tipo; cédula/firma del médico; validación `validarNOM004` |
| **NOM-024-SSA3-2012** (interoperabilidad / SIRES) | Intercambio en estándares; integridad; firma electrónica; trazabilidad | ✅ Firma electrónica con sello SHA-256 (`hashIntegridad`/`hashFirma`); nota firmada **inmutable**; versionado de borradores; **export HL7 FHIR R4** |
| **LFPDPPP** (datos personales) | Aviso de privacidad; derechos ARCO; consentimiento; medidas de seguridad | ✅ Aviso de privacidad versionado y registrado; solicitudes ARCO; consentimiento de grabación; sanitización de PII en logs |
| **ISO/IEC 27001** (seguridad de la información) | SGSI, control de accesos, cifrado, registro de auditoría | ⚙️ Controles técnicos implementados (ver §3); **certificación = auditoría externa** |

## 2. Lo que YA cumple técnicamente

- **Firma e integridad (NOM-024):** al firmar se genera `hashIntegridad` (SHA-256 del
  contenido) + `hashFirma`. La nota firmada es **inmutable**; cualquier alteración se
  detecta (verificación de integridad en la vista imprimible).
- **Trazabilidad / auditoría:** `audit_log` por evento (procesamiento IA, firma, export,
  acceso). `allow update, delete: if false` (inmutable).
- **Control de acceso multi-tenant:** reglas Firestore por `clinicId`; el secreto médico
  (notas) solo lo leen médicos/admin (`isMedico`), nunca la asistente. API keys de IA por
  consultorio en `clinics/{id}/secretos` (solo Admin SDK).
- **PHI / minimización:** audio de consulta temporal, se **borra** tras transcribir;
  sanitización de PII en logs (`sanitize.ts`); transcripción cruda separada de la nota.
- **Cifrado:** en tránsito (TLS, HSTS + cabeceras de seguridad) y en reposo (Firebase/GCS).
- **Consentimiento:** modal de consentimiento de grabación antes de capturar audio.
- **Interoperabilidad:** export **FHIR R4** (Patient, Practitioner, Condition+CIE-10,
  MedicationRequest, AllergyIntolerance, Observation).
- **Derechos ARCO (LFPDPPP):** flujo de solicitudes + export de datos del paciente.

## 3. Pendiente para la CERTIFICACIÓN (proceso externo del titular)

La certificación **no es código** — es un trámite legal/auditoría. Ruta sugerida:

1. **NOM-024 (conformidad SIRES):** solicitar la **evaluación de la conformidad** ante una
   Unidad de Verificación acreditada (o vía la DGIS/SSA). Entregable: este matriz +
   evidencia de FHIR + bitácoras.
2. **LFPDPPP:** registrar el Aviso de Privacidad y, si aplica, inscribir la base ante el
   INAI; nombrar responsable de datos.
3. **ISO 27001:** contratar un organismo certificador (auditoría de etapa 1 y 2). Requiere
   formalizar el SGSI (políticas, análisis de riesgos, plan de continuidad).
4. **COFEPRIS / SaMD (importante):** si la IA emite **recomendaciones clínicas**, podría
   considerarse *Software como Dispositivo Médico*. Conviene una **consulta regulatoria**
   para determinar si requiere registro sanitario. Mitigación actual: la IA **asiste**, el
   médico **revisa y firma** cada dato (no diagnostica de forma autónoma).
5. **Internacional (si exportas):** HIPAA (EE. UU.), MDR/CE (Europa) para SaMD.

## 4. Recomendación

Para vender a hospitales en México, lo más pedido es la **conformidad NOM-024** + el
**aviso de privacidad/ARCO**. La app ya está técnicamente lista para ambas; el siguiente
paso es **tramitarlas** con los datos de este documento. Para hospitales grandes,
priorizar **ISO 27001** y la consulta **COFEPRIS/SaMD**.
