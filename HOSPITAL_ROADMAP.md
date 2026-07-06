# Nexus — Módulo de Hospitalización · Roadmap y cumplimiento

> Basado en investigación multi-fuente verificada (106 agentes, 24 fuentes, 23 afirmaciones confirmadas). El objetivo: ser el **mejor EHR de hospitalización** para el mercado mexicano.

## Qué mueve la aguja (evidencia)

| Intervención | Efecto medido | Fuente |
|---|---|---|
| **CPOE** vs papel | Errores de medicación ~a la mitad (RR 0.46); eventos adversos prevenibles RR 0.47 | Nuckols, *Syst Rev* 2014 |
| **BCMA** (código de barras) | Errores de administración −43.5%; dañinos −55.4% | Mayo Clinic, *MCP:IQO* 2018 |
| **CDS "mejorado"** vs básico | Errores OR 0.85; ADEs OR 0.82 | AHRQ/Cochrane 2021 |
| **CDS básico** vs papel | NO significativo (OR 0.74) | AHRQ 2021 |
| Fatiga de alertas | Médicos ignoran 49–96% de las alertas | van der Sijs |

**Lección de oro:** el CDS solo ayuda si es de **alta especificidad**; el genérico genera fatiga y se ignora. Incluso Epic (Helsinki/APOTTI) sufrió "massive alert fatigue".

## El ciclo cerrado del medicamento (estándar mundial)

`CPOE → verificación farmacéutica → bombas inteligentes → gabinetes (ADC) → administración con código de barras (BCMA)`

## Estado de Nexus vs checklist de clase mundial

| Capacidad | Estado en Nexus |
|---|---|
| ADT / censo / gestión de camas | ✅ Censo + tablero de camas + episodio de internamiento |
| Notas hospitalarias (ingreso/evolución/egreso) | ✅ Por voz + IA, NOM-004 |
| Notas quirúrgicas / anestesia / consentimiento | ✅ |
| Documentación de enfermería + signos seriados | ✅ Signos con alertas de color |
| Hoja de indicaciones médicas (CPOE) | ✅ (estructura básica) · ⏳ falta catálogo estructurado dosis/vía |
| **Verificación farmacéutica** | ✅ Rol Farmacia + estado "verificada" en cada medicamento |
| **eMAR** (registro de administración) | ✅ |
| **BCMA** (5 correctos + brazalete con código de barras) | ✅ Verificación de identidad + 5 correctos obligatorios; brazalete Code 39 imprimible |
| **CDS en el punto de orden** (alergias/interacciones/renal/controlados) | ✅ Alta especificidad, pocas alertas (anti-fatiga) |
| **Conciliación de medicamentos** (ingreso/traslado/egreso) | ✅ Medicamentos del hogar vs indicaciones activas |
| Interconsultas | ✅ (con enlace a valoración inmuno) |
| Integridad NOM-024 (sello SHA-256) | ✅ Canonicalización estable |
| **Interoperabilidad HL7 v2 / FHIR R4** | ⏳ Export FHIR parcial; falta HL7 v2 ADT para LIS |
| Bombas inteligentes / ADC | 🔜 Fuera de MVP (hardware) |
| LIS / RIS-PACS / farmacia hospitalaria / RCM | 🔜 Fuera de MVP (integración) |

## Cumplimiento normativo (México)

- **NOM-024-SSA3-2012** (interoperabilidad + integridad): sello SHA-256 estable ✅. Pendiente: interoperabilidad basada en **HL7 FHIR R4** (referencia internacional US Core) y catálogos.
- **NOM-004-SSA3-2012** (expediente clínico): documentos hospitalarios obligatorios — historia clínica, notas de ingreso/evolución/egreso, interconsulta, indicaciones médicas, hoja de enfermería, notas pre/postoperatoria y de anestesia, consentimiento informado → **cubiertos** en el módulo.
- ⚠️ **Pendiente de verificar:** el texto exacto y vigente de las funcionalidades obligatorias de NOM-024/004 (catálogos, campos mínimos). No confirmado en la investigación; verificar contra el DOF antes de declarar "certificable".

## Roadmap restante (priorizado por impacto)

1. **Interoperabilidad FHIR R4** — export/import de Bundle (Patient, Encounter, MedicationRequest, Observation) → NOM-024 + integración. *(Alto)*
2. **CPOE estructurado** — catálogo de medicamentos con dosis/vía/frecuencia y validación en el punto de orden. *(Alto)*
3. **HL7 v2 ADT** — mensajería para integrarse con el laboratorio del hospital. *(Medio)*
4. **Verificación de norma NOM** — checklist de cumplimiento contra el texto vigente del DOF. *(Medio)*
5. **Bombas inteligentes / ADC / LIS / PACS** — integraciones de hardware/terceros. *(Fuera de MVP)*

## Diferenciador estratégico

No competir con Epic en amplitud/hardware. La ventaja defendible de Nexus:
1. **Documentación por voz + IA** (cero fricción; Epic es "laborioso").
2. **CDS de alta especificidad impulsado por IA** (ganar donde Epic falla: fatiga de alertas).
3. **Cumplimiento mexicano nativo (NOM-004/024) + facilidad de uso**, a una fracción del costo.
