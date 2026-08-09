# Análisis competitivo · Agenda Médica

> Última actualización: 2026-05-26. Revisado el 6-ago-2026. Documento técnico
> interno. No copia propiedad intelectual; analiza funciones públicas para
> identificar diferenciadores legítimos.
>
> **AVISO DE ALCANCE (6-ago-2026)** — Las filas sobre competidores de la matriz
> de abajo se escribieron **sin dejar constancia de fuente ni fecha de
> consulta**. Sirven como notas de orientación interna y **no se pueden usar en
> una diligencia debida, una presentación a inversión ni material comercial**.
> Lo que sí está verificado y es reproducible vive en
> [`docs/competitive/EL-FOSO.md`](competitive/EL-FOSO.md).

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

## Lo que este producto hace, verificable en el repositorio

**La columna «mejor competidor en esto» se retiró el 6-ago-2026.** Decía «Nadie
con esa granularidad», «Pocos en LATAM», «Casi nadie en EHR cloud» — seis
afirmaciones sobre terceros **sin una sola fuente**. Un comprador que verifica
una y la encuentra falsa deja de creerse el resto del paquete, incluido lo que
sí está medido (§N5).

Lo que queda es lo único que se puede sostener: **qué hace este producto**, con
dónde comprobarlo. Comparar con otro exige mirar al otro y dejar la fecha.

| Función | Implementación | Dónde se comprueba |
|---|---|---|
| Extracción IA con metadatos por campo (`value`, `confidence`, `source_quote`, `speaker`, `needs_review`) | Zod + revisión campo a campo | `src/lib/expediente/`, sus pruebas |
| 7 escalas preoperatorias con conducta COR/LOE | Lee/DASI/Caprini/STOP-BANG/ARISCAT/CHA₂DS₂-VASc/HAS-BLED, deterministas | registro clínico + golden |
| Vocabulario médico en español de México | 700+ términos + corrector; **foso medido 78,89 % → 82,91 %** | `docs/voice/SESGO-MEDIDO.md` |
| Sello SHA-256 con inmutabilidad a nivel de reglas | Firestore Rules bloquea update/delete | `firestore.rules`, ADR-003 |
| Chat médico↔asistente en tiempo real | Firestore `onSnapshot` | módulo de mensajería |
| WhatsApp multi-inquilino para auto-agendamiento | Webhook + 360dialog | puerta `aislamiento-tenant` en CI |
| Funcionamiento sin red | IndexedDB + Service Worker, multi-pestaña | `public/sw.js` |

## Oportunidades de superación (ordenadas por impacto)

1. **Reserva pública 24/7 (portal paciente)** — superar a Doctoralia con mejor UX y sin marketplace.
2. **Riesgo de no-show con IA** — exponerlo de forma visible al médico. (La nota anterior afirmaba que ningún competidor lo hace; se retiró por no tener fuente.)
3. **Configuración multi-país con matriz normativa** — superar AgendaPro y Huli con base normativa explícita.
4. **Carta de referencia con AI** — superar a SimplePractice/Jane con flujo nativo.
5. **Telemedicina integrada en el flujo de agenda** — no como módulo separado.
6. **Dashboard CRM con pipeline visual** — superar a Nimbo y Setmore con foco en revenue health.

## Riesgos a vigilar

- **AgendaPro** está acelerando multi-país en LATAM. Hay que llegar antes con cumplimiento normativo configurable.
- **Doctoralia** sigue dominando reseñas. Estrategia: hacer reseñas opcionales y propias, no depender de su marketplace.
- **Doctolib** podría entrar a LATAM. Diferenciador: voz médica + español MX.
