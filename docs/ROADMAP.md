# Roadmap · Agenda Médica

## Estado al 2026-05-26

**Implementado** (entregado en producción):

- Fase A — Fundamentos LATAM y operativos
  - ✅ Capa de compliance por país (18 países, MX/CO/AR/CL/PE/BR/UY con perfil específico)
  - ✅ 2 estados nuevos de cita (`pendiente-pago`, `pagada`)
  - ✅ Etiquetas de paciente (13 tipos, opcionales, no rompen nada existente)
  - ✅ Dashboard CRM/Revenue con pipeline + retención + sugerencias
  - ✅ Nuevo item de Sidebar para CRM
  - ✅ 60 tests pasando (16 nuevos de compliance)

## Próximas fases (priorizadas por impacto)

### Fase B — Portal del paciente (8-12 días)

- Reserva pública 24/7 en URL `/reservar/{clinicId}`
- Selección de servicio + médico + horario disponible
- Formulario de datos básicos
- Consentimientos (privacidad + informado)
- Confirmación por WhatsApp o email
- Posibilidad de pago anticipado opcional (Stripe Checkout)
- Política de cancelación configurable

### Fase C — Telemedicina nativa (6-10 días)

- Tipo de cita `teleconsulta` ya existe
- Generar sala de video con WebRTC o Daily.co/Twilio Video
- Enviar enlace 30 min antes
- Consentimiento de teleconsulta automático
- Grabación opcional con consentimiento
- Disponible en portal del paciente

### Fase D — Reseñas y reputación (5-7 días)

- Solicitud automática post-consulta por WhatsApp
- Calificación 1-5 estrellas + texto opcional
- Página pública del médico con reseñas verificadas
- Moderación con criterios (no permitir spam, validar usuario tuvo cita)
- SEO básico (sitemap, schema.org/Physician)

### Fase E — Predicción de no-show con IA (5-7 días)

- Modelo simple: regresión logística con features
  - Historia de no-shows del paciente
  - Tipo de cita
  - Día/hora
  - Tiempo desde agendamiento
  - Llegó a confirmar o no
- Score 0-100 expuesto en la UI
- Sugerencia automática: doble confirmación si score > 60
- Tracking de exactitud del modelo

### Fase F — Pagos al paciente (4-6 días)

- Stripe Checkout para anticipos por consulta
- Política de cancelación configurable
- Reembolso automático según política
- Conciliación en dashboard CRM
- Soporte multi-moneda (de los perfiles por país)

### Fase G — i18n / Português (3-5 días)

- next-intl
- Strings extraídos a JSON
- Catálogos por país (es-MX, es-AR, es-CO, pt-BR)
- Auto-detectar por perfil de país

### Fase H — Bloqueo de horarios / vacaciones (2-3 días)

- Bloques de tiempo no agendables
- Vacaciones programadas
- Ausencias puntuales
- Sincronización con el bot de WhatsApp

### Fase I — Roles avanzados (4-6 días)

- 5 roles: admin · médico · asistente · recepción · facturación
- Permisos granulares por módulo
- Auditoría de cambios de permiso

### Fase J — Multi-sucursal y multi-médico (8-12 días)

- Modelo `branches/{branchId}` dentro de `clinics`
- Médicos asignables a múltiples sucursales
- Vista de agenda por sucursal
- Reportes consolidados

## Métricas objetivo de producto (12 meses)

- **Adquisición**: tasa de conversión solicitud→cita > 75%
- **Confirmación**: tasa de confirmación > 85%
- **No-show**: reducir a < 8%
- **Retención**: pacientes activos a 90 días > 60%
- **NPS médico**: > 50
- **NPS paciente**: > 60
- **Tiempo administrativo**: -40% vs sistema actual del consultorio

## Estrategia de salida a mercado LATAM

1. **MX** (mercado actual). Foco: consultorios privados de especialidades médicas.
2. **CO** (Q4 2026). Mismo posicionamiento. WhatsApp bot ya es ventaja.
3. **BR** (Q1 2027). Requiere portugués nativo (Fase G).
4. **AR/CL/PE/UY** (Q2-Q3 2027). Mismo SaaS, traducción español regionalizada.

## Riesgos a vigilar

- **Vendedor lock-in con Firebase**: mitigado por arquitectura modular; migración a Postgres es posible pero costosa.
- **Costos de Claude API**: ~$0.25 MXN/consulta con voz. A 1000 consultas/día = ~$250 MXN/día. Sostenible para SaaS ≥ $499/mes.
- **WhatsApp Business limits**: en escala se requiere acelerar Meta Embedded Signup approval.
- **Regulación de IA en salud**: vigilar normas emergentes en BR (ANPD) y MX (INAI).
