# Inventario de datos personales — NexusMED

Base legal marco: LFPDPPP (México). **Pendiente de validación por abogado** en materia de protección de datos y salud. Roles: NexusMED = **responsable** de datos de médicos/usuarios y **encargado** del expediente; el consultorio = **responsable** de datos de pacientes; proveedores = **subencargados**.

Identidad del responsable de la plataforma (proporcionada por el titular, no inventada): **David Alonso Rodríguez Luna** (RESICO). RFC y domicilio fiscal se conservan **solo en el contrato de encargo / documentos privados**, no en avisos públicos.

| Categoría | Finalidad | Responsable | Encargado / Subencargado | Sistema | Región | Retención | Acceso | Sensible |
|---|---|---|---|---|---|---|---|---|
| Datos de médicos (nombre, cédula, correo, tel) | Cuenta, facturación, soporte | NexusMED | GCP/Firebase | Firestore | EE.UU. | Mientras dure la cuenta + obligaciones fiscales | Dueño, staff autorizado | No |
| Personal administrativo (asistente/recepción) | Acceso por rol | NexusMED / Consultorio | GCP | Firestore/Auth | EE.UU. | Vida de la cuenta | Admin de la clínica | No |
| Datos de pacientes (identificación, contacto, CURP) | Atención, agenda, contacto | **Consultorio** | NexusMED (encargado), GCP | Firestore | EE.UU. | ≥5 años (NOM-004) | Médico/admin del consultorio | Sí (algunos) |
| Datos clínicos (nota, dx, medicación, labs, voz) | Expediente, atención | **Consultorio** | NexusMED, GCP; IA (Anthropic/OpenAI/AssemblyAI) para redacción | Firestore/Storage | EE.UU. | ≥5 años (NOM-004) | Solo médico/admin | **Sí** |
| Audio de dictado | Transcripción → nota | Consultorio | OpenAI/AssemblyAI (transcripción) | Efímero/Storage | EE.UU. | Hasta procesar (revisar retención real) | Médico | **Sí** |
| Datos enviados a IA | Redacción/revisión de nota, evidencia | Consultorio | Anthropic, OpenAI | API (no entrenamiento) | EE.UU. | No persistido para entrenamiento | — | **Sí** |
| Mensajería WhatsApp | Recordatorios, portal, reseñas | Consultorio | Meta/WhatsApp | API | EE.UU. | Según Meta | Consultorio | Contacto |
| Facturación/suscripción | Cobro del SaaS, CFDI | NexusMED | Stripe, Facturama | API | EE.UU./MX | Obligaciones fiscales | Dueño | Fiscal |
| Cobros al paciente | Finanzas del consultorio | Consultorio | GCP | Firestore | EE.UU. | Obligaciones fiscales | Médico/admin | Fiscal |
| Soporte | Atención a dudas | NexusMED | correo | Correo | — | Lo necesario | Soporte | Depende |
| Analítica de producto | Mejora del servicio (sin PHI) | NexusMED | (Meta Pixel en landing) | Cliente | — | Estándar del proveedor | — | No (excluir PHI) |
| Logs técnicos / errores | Operación, depuración | NexusMED | Vercel/GCP; colección `errores` | Servidor/Firestore | EE.UU. | Rotación | Dueño/superadmin | Debe excluir PHI |
| Datos de seguridad (bitácora, MFA) | Auditoría, seguridad | Ambos | GCP | Firestore | EE.UU. | Registro legal | Auditor/admin | No |
| Respaldos | Recuperación | Ambos | GCP | Backup/PITR | EE.UU. | ≥30 días (objetivo) | Dueño (IAM) | Incluye lo anterior |

## Riesgos por categoría (alto nivel)
- **PHI en logs/analytics/IA:** alto — mitigación: no enviar PHI a analytics/logs; IA sin entrenamiento; sanitización de logs.
- **Transferencia internacional (EE.UU.):** requiere que el aviso lo declare y que los DPA de subencargados lo cubran (Google/Anthropic/OpenAI/Meta/Stripe).
- **Retención de audio de dictado:** verificar retención real y minimizar.

## Marcadores de revisión jurídica (pendiente abogado)
- Bases de licitud y consentimiento expreso para datos sensibles de salud.
- Transferencias internacionales y cláusulas modelo.
- Periodos de conservación/bloqueo/eliminación por categoría.
- Deberes de notificación de brechas (plazos).
