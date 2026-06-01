# Análisis competitivo · Agenda Médica

> Última actualización: 2026-05-26. Documento técnico interno. No copia
> propiedad intelectual; analiza funciones públicas para identificar
> diferenciadores legítimos.

## Matriz comparativa

| Plataforma | Región | Modelo | Fortaleza | Riesgo competitivo para nosotros | Diferenciador a tomar | Diferenciador a NO copiar |
|---|---|---|---|---|---|---|
| Doctoralia | LATAM/ES | Marketplace + agenda | Reserva 24/7 + reseñas + tráfico orgánico | Marketplace propio, cobran por leads | Reserva pública 24/7 con configuración fina por médico | Modelo marketplace (perdemos control de relación) |
| Doctolib | EU | EHR + agenda + telemedicina | UX premium, GDPR-first, telemedicina nativa | Marca premium establecida | Privacy by design + tele nativa | Sistema cerrado de pagos |
| NexHealth | US | API-first | Integraciones EHR/PMS, recall pacientes | Solo US | Pipeline de retención (recalls) | Complejidad de integración API-first |
| Zocdoc | US | Marketplace + verify insurance | Discovery + booking + seguros verificados | Solo US | Verificación pre-consulta de datos | Comisión por paciente nuevo |
| AgendaPro | LATAM (CL/MX/CO/PE) | SaaS multi-país | Multi-sucursal nativa, pagos integrados | Competidor directo más serio en LATAM | Multi-país configurable | UX a veces saturada |
| Nimbo | MX | SaaS solo consultorio | Sencillo, foco consultorio | Sólido en consultorio individual | Simplicidad médico solo | Falta de profundidad clínica |
| Huli | LATAM | EHR + integración hospitalaria | EHR robusto, instituciones | Caro, enterprise | Estructura clínica modular | Complejidad enterprise |
| Tebra | US | RCM + marketing | Revenue cycle management + marketing | Solo US | Marketing automatizado | Complejidad RCM |
| SimplePractice | US/UK | Salud mental | Portal paciente sólido | Especializado | Portal paciente UX premium | Foco mental health |
| Jane App | CA/AU | EHR + telehealth | UX excelente, charting fluido | Caro | UX premium | Pricing |
| Athenahealth | US enterprise | EHR + RCM enterprise | Network effects de datos | Enterprise-only | Analytics de población | Complejidad enterprise |
| Top Doctors | EU | Marketplace premium | Brand premium + reseñas | Marketplace | Reputación digital | Modelo marketplace |
| Setmore | Global | Multi-industria | Gratuito, onboarding rápido | No clínico | Velocidad de onboarding | Falta de profundidad médica |
| Calendly (salud) | Global | Booking minimal | UX simple | No clínico | Simplicidad de reserva | Falta de contexto clínico |

## Ventajas REALES que ya tiene Agenda Médica vs los competidores

| Función | Nuestra implementación | Mejor competidor en esto | Por qué somos superiores |
|---|---|---|---|
| Extracción IA con metadatos por campo (`value`, `confidence`, `source_quote`, `speaker`, `needs_review`) | ✅ con Zod + revisión por campo | Nadie con esa granularidad | Auditable a nivel de fuente textual |
| 7 escalas preoperatorias con motor de recomendaciones COR/LOE | ✅ Lee/DASI/Caprini/STOP-BANG/ARISCAT/CHA₂DS₂-VASc/HAS-BLED | Calculadoras separadas (MDCalc) o EHR sin escalas integradas | Cálculo + conducta + clase de evidencia + cita |
| Vocabulario médico fonético español + Whisper biased | ✅ 700+ términos + corrector | Modelos genéricos | Diseñado para español MX/LATAM |
| Sello SHA-256 NOM-024 + inmutabilidad rules-level | ✅ Firestore Rules bloquea update/delete | Pocos en LATAM | Inmutabilidad criptográfica |
| Chat médico↔asistente nativo + real-time | ✅ Firestore onSnapshot | Pocos lo tienen integrado | Sin app externa |
| WhatsApp bot multi-tenant para auto-agendamiento | ✅ Webhook + meta + 360dialog/manual | Ventaja clave LATAM | Mismo flujo de pacientes habitual |
| Offline real con Firestore IndexedDB + Service Worker | ✅ Multi-tab tab manager | Casi nadie en EHR cloud | Continuidad clínica sin red |

## Oportunidades de superación (ordenadas por impacto)

1. **Reserva pública 24/7 (portal paciente)** — superar a Doctoralia con mejor UX y sin marketplace.
2. **Riesgo de no-show con IA** — diferenciar vs cualquier competidor (nadie lo expone visualmente).
3. **Configuración multi-país con matriz normativa** — superar AgendaPro y Huli con base normativa explícita.
4. **Carta de referencia con AI** — superar a SimplePractice/Jane con flujo nativo.
5. **Telemedicina integrada en el flujo de agenda** — no como módulo separado.
6. **Dashboard CRM con pipeline visual** — superar a Nimbo y Setmore con foco en revenue health.

## Riesgos a vigilar

- **AgendaPro** está acelerando multi-país en LATAM. Hay que llegar antes con cumplimiento normativo configurable.
- **Doctoralia** sigue dominando reseñas. Estrategia: hacer reseñas opcionales y propias, no depender de su marketplace.
- **Doctolib** podría entrar a LATAM. Diferenciador: voz médica + español MX.
