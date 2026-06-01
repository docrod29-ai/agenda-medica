# Matriz normativa LATAM · Agenda Médica

> Documento técnico interno. NO constituye asesoría legal. Cada país requiere
> validación con asesor legal local antes de uso en producción.
> Las marcas "requires_legal_review" deben tratarse como pendientes.

## Cobertura actual

Configuración técnica en `src/lib/compliance/country-profiles.ts` para 18 países.

| País | Estado | Referencias principales |
|---|---|---|
| 🇲🇽 México | Perfil completo | NOM-004-SSA3, NOM-024-SSA3, LFPDPPP |
| 🇨🇴 Colombia | Perfil completo | Ley 1581/2012, Decreto 1377/2013, Res. 1995/1999, Res. 2654/2019, Ley 2015/2020 (HCEU) |
| 🇦🇷 Argentina | Perfil completo | Ley 25.326, Ley 26.529, Ley 27.553, Ley 25.506 |
| 🇨🇱 Chile | Perfil completo | Ley 19.628, Ley 20.584, normas MINSAL |
| 🇵🇪 Perú | Perfil completo | Ley 29733, Ley 30024, DS 009-2017-SA |
| 🇧🇷 Brasil | Perfil completo | LGPD, CFM 1.821/2007, CFM 2.314/2022, Lei 14.510/2022 |
| 🇺🇾 Uruguay | Perfil completo | Ley 18.331, Decreto 396/003 HCE |
| 🇵🇾 Paraguay | Placeholder | Pendiente validación legal local |
| 🇧🇴 Bolivia | Placeholder | Pendiente validación legal local |
| 🇪🇨 Ecuador | Placeholder | Pendiente validación legal local |
| 🇨🇷 Costa Rica | Placeholder | Pendiente validación legal local |
| 🇵🇦 Panamá | Placeholder | Pendiente validación legal local |
| 🇬🇹 Guatemala | Placeholder | Pendiente validación legal local |
| 🇭🇳 Honduras | Placeholder | Pendiente validación legal local |
| 🇸🇻 El Salvador | Placeholder | Pendiente validación legal local |
| 🇳🇮 Nicaragua | Placeholder | Pendiente validación legal local |
| 🇩🇴 R. Dominicana | Placeholder | Pendiente validación legal local |
| 🇻🇪 Venezuela | Placeholder | Pendiente validación legal local |

## Política configurable por país

Cada perfil define:

- **Consentimientos**: privacidad, informado clínico, telemedicina, grabación de voz, exportación
- **Retención**: años mínimos de conservación del expediente y receta
- **Firma**: electrónica vs digital con certificado
- **Almacenamiento**: nube permitida, transferencia internacional
- **Derechos**: acceso, corrección, eliminación (con excepciones de salud)
- **Notificación de brechas**: requerida y plazo
- **Auditoría**: requerida y retención
- **Voz/IA**: bitácora obligatoria, regulación específica si existe

## Patrón de uso en código

```ts
import { getCountryProfile } from '@/lib/compliance/country-profiles'
import { requireVoiceConsent, getComplianceSummary } from '@/lib/compliance/policy'

// Lee perfil de la clínica
const profile = getCountryProfile(clinic.countryCode ?? 'MX')

// Decisiones derivadas
if (requireVoiceConsent(profile)) showConsentModal()

// Resumen para UI de configuración
const s = getComplianceSummary('MX')
// → { country, consents, retentionYears, cloud, crossBorder, audit, authority, references, needsReview }
```

## Política técnica obligatoria (independiente del país)

1. **Cifrado en tránsito** (HTTPS forzado, HSTS por Vercel)
2. **Aislamiento multi-tenant** (Firestore Rules con `isMember(clinicId)`)
3. **Inmutabilidad de notas firmadas** (Rules deniegan update/delete)
4. **Sello SHA-256** en cada nota firmada (NOM-024 y equivalentes)
5. **Auditoría persistente** (`clinics/{id}/audit_log`)
6. **Consentimiento explícito de grabación de voz** (modal antes de iniciar)
7. **Sin datos sensibles en logs/consola**

## Pendientes legales por país (resumen ejecutivo)

- **MX**: validar deletion right en salud (excepción NOM-004). Validar plazo de notificación de brechas.
- **CO**: confirmar años de retención por Resolución 1995 (norma original menciona >15 años en ciertos casos).
- **AR**: confirmar requisitos de firma digital con certificado (Ley 25.506) para validez de receta y firma de nota.
- **CL**: monitorear nueva ley de protección de datos (reforma a Ley 19.628 en implementación).
- **PE**: confirmar telemedicina y plazos de retención de RENHICE.
- **BR**: validar reglas específicas de CFM para almacenamiento en nube y transferencia internacional.
- **UY**: validar conservación de HCE bajo Decreto 396/003 y normas posteriores.
- **Todos los placeholder**: revisión legal local antes de habilitar producción.

## Roadmap normativo

1. **Q3 2026**: Auditar perfil MX con asesor legal mexicano. Generar templates de aviso de privacidad y consentimiento informado por país.
2. **Q4 2026**: Habilitar Colombia y Brasil con asesor legal local en cada país.
3. **Q1 2027**: Argentina y Chile.
4. **Q2 2027**: Perú y Uruguay.
5. **Q3 2027**: Países placeholder según demanda comercial.
