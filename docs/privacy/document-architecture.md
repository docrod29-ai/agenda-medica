# Arquitectura documental de privacidad — NexusMED

Tres documentos separados según el rol. **Ninguno es asesoría jurídica definitiva; requieren revisión por abogado mexicano especializado.** Ningún borrador con variables sin resolver se publica.

## Documento 1 — Aviso para médicos y usuarios (NexusMED como responsable)
- **Estado:** existe la página pública `/privacidad` (aviso de la plataforma; sección específica de WhatsApp/Meta para revisión de la app).
- **Responsable de la plataforma:** David Alonso Rodríguez Luna (RESICO). Variables:
  - `{{LEGAL_ENTITY_NAME}}` = David Alonso Rodríguez Luna
  - `{{PRIVACY_CONTACT}}` / `{{ARCO_CONTACT}}` = privacidad@nexusmed.mx (o docrod29@gmail.com hasta configurar buzón)
  - `{{PHYSICAL_ADDRESS}}` = **RESERVADO** — el domicilio fiscal es particular y NO se publica; usar un domicilio de contacto/comercial cuando exista. **Bloqueo hasta definir domicilio publicable.**
  - `{{COUNTRY}}` = México
- **Debe contemplar** (revisar cobertura en `/privacidad`): identidad, datos tratados, sensibles, finalidades primarias/secundarias, facturación/suscripción/soporte/seguridad/analítica/comunicaciones, transferencias (EE.UU.), subencargados, conservación, ARCO, revocación, limitación de uso, cookies, cambios, contacto.
- **Bloqueo:** falta un **domicilio publicable** (el fiscal es particular). Hasta definirlo, la sección de domicilio queda como variable pendiente.

## Documento 2 — Aviso modelo del consultorio (el médico como responsable)
- **Estado: IMPLEMENTADO en código.** `src/lib/aviso-privacidad.ts` genera el aviso por consultorio con los datos que cada médico captura (razón social, domicilio de consultorio, correo ARCO, responsable de privacidad); se ve en `/privacidad/[clinicId]` y se descarga desde `/legal`.
- Muestra el disclaimer: *"debe ser revisado y adaptado por el responsable del consultorio"*. **No** se presenta como asesoría definitiva.
- RFC y domicilio fiscal del médico **no** se exponen en el aviso público (protección aplicada en iteración previa).

## Documento 3 — Acuerdo de tratamiento de datos (DPA: NexusMED encargado ↔ consultorio responsable)
- **Estado: IMPLEMENTADO en código.** `src/lib/contrato-encargo.ts` genera el DPA (objeto, instrucciones, confidencialidad, seguridad, subencargados, notificación de incidentes, solicitudes de titulares, exportación, eliminación, retención, auditoría, terminación, devolución, responsabilidades, jurisdicción). Descargable desde `/legal`, marcado como borrador a revisar por abogado.

## Subencargados
Lista pública en `/seguridad` (Google/Firebase, Anthropic, OpenAI, Meta/WhatsApp, Stripe, Vercel) con región y política. Ver también `data-inventory.md`.

## Retención / bloqueo / eliminación
- Expediente clínico: ≥5 años (NOM-004), luego bloqueo y eliminación segura (declarado en el aviso por consultorio).
- Otras categorías: ver `data-inventory.md`. **Periodos exactos pendientes de validar con abogado.**

## Flujo ARCO (2.5)
- **Estado: IMPLEMENTADO.** `src/lib/arco.ts` (crear/listar/resolver solicitud; plazo 20 días hábiles) + `/cumplimiento` (panel ARCO, bitácora). El paciente puede solicitar desde el portal de privacidad por consultorio.
- Cubre: solicitud, registro, plazo configurable, asignación, resolución (acceso/rectificación/cancelación/oposición/revocación), conservación de evidencia (append-only, no se borra).
- **Verificación de identidad del solicitante:** el flujo la contempla como campo; el procedimiento operativo lo define el consultorio. **No se automatizan decisiones jurídicas.**

## Marcadores de revisión jurídica (pendiente abogado)
- Domicilio publicable de la plataforma (bloqueo del Documento 1).
- Bases de licitud, consentimiento de datos sensibles, transferencias internacionales.
- Periodos de conservación por categoría; deberes y plazos de notificación de brechas.
- Jurisdicción/cláusulas del DPA.
