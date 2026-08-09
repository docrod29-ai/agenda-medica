'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Stethoscope, CheckCircle2, MessageCircle, Bell, Calendar, Users, Clock, BarChart3, ChevronDown, ArrowRight, Shield, MapPin, Zap } from 'lucide-react'
import { MetaPixel } from '@/components/MetaPixel'
import { ProductWindow } from '@/components/ProductWindow'
import { PLANES } from '@/lib/planes-ia'

/* ─── Data ─────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: Calendar,
    title: 'Agenda inteligente',
    desc: 'Calendario por día y semana. Crea, mueve y cancela citas con validación de horarios y sin empalmes.',
  },
  {
    icon: MessageCircle,
    title: 'Bot de WhatsApp',
    desc: 'Tus pacientes agendan solos por WhatsApp 24/7. Sin llamadas, sin depender de que alguien conteste.',
  },
  {
    icon: Bell,
    title: 'Recordatorios automáticos',
    desc: 'WhatsApp 24h antes, automático. Los recordatorios pueden reducir hasta 40% las inasistencias según estudios publicados; los resultados varían por consultorio.',
  },
  {
    icon: Users,
    title: 'Lista de espera',
    desc: 'Cuando cancela un paciente, la lista de espera recibe un WhatsApp automático al instante.',
  },
  {
    icon: Clock,
    title: 'Portal de asistente',
    desc: 'Vista simplificada para tu asistente. Solo ve lo que necesita, sin acceso a configuración.',
  },
  {
    icon: BarChart3,
    title: 'Google Calendar sync',
    desc: 'Todas tus citas aparecen en tu Google Calendar. Nunca pierdas un evento importante.',
  },
]

const STEPS = [
  { n: '01', title: 'Crea tu cuenta', desc: 'Regístrate en menos de 60 segundos. Sin tarjeta de crédito.' },
  { n: '02', title: 'Configura tu horario', desc: 'Define días, horas y duración de consulta. El bot ya está listo.' },
  { n: '03', title: 'Comparte tu número', desc: 'Da a tus pacientes el número de WhatsApp. Ellos agendan solos.' },
]

// FUENTE ÚNICA DE VERDAD: los planes se derivan de src/lib/planes-ia.ts para que
// la landing nunca se desincronice de los precios/features reales (antes estaban
// duplicados y causaban inconsistencias de precio: Pro vs Premium, etc.).
const TAGLINE_PLAN: Record<string, string> = {
  agenda: 'Para empezar a organizar tu consultorio',
  clinica: 'El más popular',
  premium: 'Máxima inteligencia clínica',
}
const PLANS = (['agenda', 'clinica', 'premium'] as const).map(k => {
  const p = PLANES[k]
  return {
    name: p.nombre,
    price: p.precioMXN.toLocaleString('es-MX'),
    desc: TAGLINE_PLAN[k],
    features: p.incluye,
    cta: 'Empezar prueba gratis',
    highlight: !!p.destacado,
  }
})

const FAQS = [
  {
    q: '¿Necesito saber de tecnología para usar esto?',
    a: 'No. El sistema está diseñado para médicos ocupados. La configuración toma menos de 5 minutos y hay videos paso a paso.',
  },
  {
    q: '¿Cómo funciona el bot de WhatsApp?',
    a: 'Conectas tu número de WhatsApp Business y el bot responde automáticamente. El paciente escoge fecha, hora y médico sin que tú intervengas.',
  },
  {
    q: '¿Mis datos están seguros?',
    a: 'Corren sobre Google Cloud (Firebase) con cifrado en tránsito y en reposo, acceso por roles y aislamiento por consultorio (todo verificado). Estamos activando respaldos con recuperación a un punto en el tiempo; no lo declaramos como listo hasta probar una restauración. Los detalles, el estado de cada control y la lista de proveedores están en nuestra página de Seguridad y confianza (/seguridad).',
  },
  {
    q: '¿Qué es un "crédito de IA" y cuántas notas alcanzo?',
    a: 'Un crédito es una unidad de uso de inteligencia artificial. Las funciones consumen créditos según su costo real de cómputo (una nota por voz consume más que una corrección corta). En tu panel ves el consumo en tiempo real y te avisamos antes de agotarlos; puedes recargar o subir de plan. Estamos migrando la comunicación a "notas incluidas por mes" para que sea más claro.',
  },
  {
    q: '¿Los precios incluyen IVA?',
    a: 'Los precios se muestran antes de IVA; al momento del pago ves el desglose con impuestos. Si necesitas comprobante fiscal de tu suscripción, escríbenos y lo gestionamos.',
  },
  {
    q: '¿Puedo llevarme mi información?',
    a: 'Sí. La información es tuya, sin secuestro de datos. Al cancelar te entregamos una exportación completa de tus pacientes y expedientes. Estamos habilitando además la exportación con un clic desde tu panel.',
  },
  {
    q: '¿Puedo cancelar cuando quiera?',
    a: 'Sí, sin penalizaciones ni permanencia mínima. Cancela desde tu panel en cualquier momento; tus datos quedan disponibles para exportar.',
  },
  {
    q: '¿Funciona con cualquier especialidad médica?',
    a: 'Sí. Infectología, pediatría, cardiología, medicina general — cualquier especialidad que maneje citas por tiempo.',
  },
  {
    q: '¿Qué pasa cuando termina el periodo de prueba?',
    a: 'Te avisamos 3 días antes. Si decides continuar, eliges tu plan y configuras el pago. Si no, tu cuenta se pausa sin borrar tus datos.',
  },
]

const WHATSAPP_MESSAGES = [
  { role: 'bot', text: '👋 ¡Hola! Soy el asistente del Dr. García. ¿Qué deseas hacer?\n\n1️⃣ Agendar cita\n2️⃣ Cancelar cita\n3️⃣ Ver mis citas' },
  { role: 'user', text: '1' },
  { role: 'bot', text: '¡Perfecto! ¿Para qué fecha deseas tu cita?\n\nDías disponibles:\n📅 Lunes 26 mayo\n📅 Martes 27 mayo\n📅 Miércoles 28 mayo' },
  { role: 'user', text: 'Lunes 26' },
  { role: 'bot', text: '⏰ Horarios disponibles el lunes 26:\n\n• 9:00 am\n• 10:00 am\n• 11:30 am\n• 4:00 pm' },
  { role: 'user', text: '10:00 am' },
  { role: 'bot', text: '✅ ¡Cita agendada!\n\n📋 Dr. García\n📅 Lunes 26 de mayo\n⏰ 10:00 am\n\nRecibirás un recordatorio 24h antes. ¡Hasta pronto!' },
]

/* ─── Components ────────────────────────────────────────── */
function Nav() {
  return (
    <nav className="nav-portada" style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(11,12,14,0.78)', backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border)',
      padding: '0 24px', height: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'var(--s1)', border: '1px solid var(--border2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <g stroke="#3D5AFE" strokeWidth="5" strokeLinecap="round" fill="none">
              <line x1="8" y1="8" x2="8" y2="40"/>
              <line x1="40" y1="8" x2="40" y2="40"/>
              <line x1="8" y1="8" x2="40" y2="40"/>
            </g>
            <circle cx="24" cy="24" r="3" fill="#F2EFE9"/>
          </svg>
        </div>
        <span className="nav-portada-marca" style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.02em' }}>NexusMED</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Link href="/login" className="btn btn-secondary" style={{ textDecoration: 'none', height: 36, fontWeight: 600 }}>
          Iniciar sesión
        </Link>
        <Link href="/registro" className="btn btn-primary" style={{ textDecoration: 'none', height: 36 }}>
          Prueba gratis →
        </Link>
      </div>
    </nav>
  )
}

function Hero() {
  return (
    <section style={{
      textAlign: 'center', padding: '120px 24px 88px',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Fondo de marca: red clínica luminosa (Nano-Banana) + velo para legibilidad */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/hero.jpg" alt="" aria-hidden="true" style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        objectFit: 'cover', objectPosition: 'center right', opacity: 0.85, pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(120% 90% at 50% 30%, transparent 0%, var(--bg) 78%)',
      }} />

      <div style={{ position: 'relative' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'var(--nexus-soft)', border: '1px solid rgba(61,90,254,0.28)',
          borderRadius: 'var(--r-pill)', padding: '5px 14px', marginBottom: 28,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--nexus)' }} />
          <span style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 500, letterSpacing: '-0.005em' }}>
            14 días gratis · sin tarjeta
          </span>
        </div>

        <h1 className="nx-display" style={{
          fontSize: 'clamp(40px, 6.5vw, 84px)', lineHeight: 1.02,
          color: 'var(--text)', maxWidth: 880, margin: '0 auto 28px',
          fontWeight: 500, letterSpacing: '-0.035em',
        }}>
          El consultorio,<br />
          <span style={{ color: 'var(--nexus)', fontStyle: 'italic' }}>conectado.</span>
        </h1>

        <p style={{
          // --text (no --text2): el subtítulo caía sobre la parte BRILLANTE de la
          // imagen del hero y con el gris medio se lavaba. La sombra del color de
          // fondo lo despega de la imagen sin cambiar el tono en ninguno de los
          // dos temas.
          fontSize: 'clamp(16px, 1.6vw, 19px)', color: 'var(--text)',
          maxWidth: 580, margin: '0 auto 44px', lineHeight: 1.6,
          letterSpacing: '-0.005em', fontWeight: 500,
          textShadow: '0 1px 16px var(--bg), 0 0 2px var(--bg)',
        }}>
          Agenda, expediente, recetas y cobros en una sola herramienta.
          Sin saltar de app en app.
        </p>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/registro" className="btn btn-primary btn-lg" style={{ textDecoration: 'none' }}>
            Comenzar prueba gratis <ArrowRight size={17} />
          </Link>
          <Link href="/demo" className="btn btn-secondary btn-lg" style={{ textDecoration: 'none' }}>
            Ver demo
          </Link>
        </div>
        <div style={{ marginTop: 16, fontSize: 14, color: 'var(--text2)' }}>
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" style={{ color: 'var(--nexus)', fontWeight: 700, textDecoration: 'none' }}>Inicia sesión aquí →</Link>
        </div>

        {/* Hero shot del producto: UI real (tokens del design system) con datos ficticios */}
        <div style={{ maxWidth: 860, margin: '64px auto 0' }}>
          <ProductWindow />
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 10 }}>Interfaz de ejemplo · datos ficticios</div>
        </div>
      </div>
    </section>
  )
}

function Stats() {
  const items = [
    { value: 'hasta 40%', label: 'menos inasistencias con recordatorios*' },
    { value: 'menos', label: 'tiempo escribiendo notas' },
    { value: '$0', label: 'los primeros 14 días' },
    { value: '5 min', label: 'para estar listo' },
  ]
  return (
    <section style={{
      display: 'flex', justifyContent: 'center', gap: 0,
      borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
      background: 'var(--s1)', flexWrap: 'wrap',
    }}>
      {items.map((s, i) => (
        <div key={i} style={{
          flex: '1 1 160px', padding: '32px 24px', textAlign: 'center',
          borderRight: i < items.length - 1 ? '1px solid var(--border)' : 'none',
        }}>
          <div style={{ fontSize: 36, fontWeight: 600, color: 'var(--teal)' }}>{s.value}</div>
          <div style={{ fontSize: 14, color: 'var(--text3)', marginTop: 4 }}>{s.label}</div>
        </div>
      ))}
      <div style={{ flexBasis: '100%', textAlign: 'center', padding: '0 24px 16px', fontSize: 11.5, color: 'var(--text3)' }}>
        * De revisiones sistemáticas publicadas: reducción relativa ~34% en promedio (hasta ~39% con recordatorio telefónico). La reducción real
        varía por especialidad, población y consultorio.{' '}
        <Link href="/evidencia" style={{ color: 'var(--nexus)', fontWeight: 600, textDecoration: 'none' }}>Ver fuentes →</Link>
      </div>
    </section>
  )
}

function Features() {
  return (
    <section style={{ padding: '96px 24px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 64 }}>
        <h2 style={{ fontSize: 40, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
          Todo lo que necesitas, nada de lo que no
        </h2>
        <p style={{ fontSize: 17, color: 'var(--text2)', maxWidth: 500, margin: '0 auto' }}>
          Diseñado específicamente para médicos en México que quieren recuperar su tiempo.
        </p>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 24,
      }}>
        {FEATURES.map(f => (
          <div key={f.title} style={{
            background: 'var(--s1)', border: '1px solid var(--border)',
            borderRadius: 16, padding: '28px 24px',
            transition: 'border-color 0.2s',
          }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(61,90,254,0.4)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'rgba(61,90,254,0.1)', border: '1px solid rgba(61,90,254,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
            }}>
              <f.icon size={20} color="var(--teal)" />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
              {f.title}
            </h3>
            <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6 }}>
              {f.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section id="como-funciona" style={{
      padding: '96px 24px',
      background: 'linear-gradient(180deg, var(--s1) 0%, var(--bg) 100%)',
      borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/workspace.jpg" alt="Espacio de trabajo clínico conectado de NexusMED"
            style={{ width: '100%', maxWidth: 720, height: 'auto', margin: '0 auto 40px', display: 'block', borderRadius: 16, border: '1px solid var(--border)' }} />
          <h2 style={{ fontSize: 40, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
            Listo en 5 minutos
          </h2>
          <p style={{ fontSize: 17, color: 'var(--text2)' }}>
            Sin instalaciones, sin configuraciones complejas.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
          {/* Steps */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
            {STEPS.map(s => (
              <div key={s.n} style={{ display: 'flex', gap: 20 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                  background: 'rgba(61,90,254,0.1)', border: '1px solid rgba(61,90,254,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, color: 'var(--teal)', fontFamily: 'monospace',
                }}>
                  {s.n}
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                    {s.title}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6 }}>
                    {s.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* WhatsApp mockup */}
          <div style={{
            background: '#0A0F1A', borderRadius: 20, border: '1px solid var(--border)',
            overflow: 'hidden', maxWidth: 360, margin: '0 auto', width: '100%',
          }}>
            {/* Header */}
            <div style={{
              background: '#128C7E', padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Stethoscope size={18} color="#FFF" />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#FFF' }}>Dr. García</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>en línea</div>
              </div>
            </div>

            {/* Messages */}
            <div style={{
              padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 10,
              maxHeight: 360, overflowY: 'auto',
              background: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'60\'%3E%3C/svg%3E") #0D1117',
            }}>
              {WHATSAPP_MESSAGES.map((m, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                }}>
                  <div style={{
                    maxWidth: '82%', padding: '8px 12px', borderRadius: 12,
                    background: m.role === 'user' ? '#005C4B' : '#1F2C34',
                    color: '#E9EDEF', fontSize: 12.5, lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    borderTopRightRadius: m.role === 'user' ? 2 : 12,
                    borderTopLeftRadius: m.role === 'bot' ? 2 : 12,
                  }}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '48px auto 0', display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link href="/demo/razonamiento" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--nexus-solido)', color: '#FFF', textDecoration: 'none', borderRadius: 10, padding: '12px 20px', fontSize: 14.5, fontWeight: 700 }}>
          Ver cómo razona la IA en vivo →
        </Link>
        <Link href="/arquitectura" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', color: 'var(--text2)', textDecoration: 'none', borderRadius: 10, padding: '12px 20px', fontSize: 14.5, fontWeight: 600, border: '1px solid var(--border)' }}>
          Ver los 10 motores
        </Link>
        <Link href="/paquetes" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', color: 'var(--text2)', textDecoration: 'none', borderRadius: 10, padding: '12px 20px', fontSize: 14.5, fontWeight: 600, border: '1px solid var(--border)' }}>
          Paquetes por especialidad
        </Link>
      </div>

      <style>{`
        @media (max-width: 768px) {
          #como-funciona .how-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  )
}

function Pricing() {
  return (
    <section id="precios" style={{ padding: '96px 24px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 64 }}>
        <h2 style={{ fontSize: 40, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
          Precios simples y transparentes
        </h2>
        <p style={{ fontSize: 17, color: 'var(--text2)' }}>
          14 días gratis en cualquier plan. Sin contratos. Cancela cuando quieras.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 24 }}>
        {PLANS.map(p => (
          <div key={p.name} style={{
            background: p.highlight ? 'rgba(61,90,254,0.05)' : 'var(--s1)',
            border: p.highlight ? '2px solid var(--teal)' : '1px solid var(--border)',
            borderRadius: 20, padding: '32px 28px',
            position: 'relative',
          }}>
            {p.highlight && (
              <div style={{
                position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
                background: 'var(--nexus-solido)', color: '#FFF', fontSize: 12, fontWeight: 700,
                padding: '4px 16px', borderRadius: 'var(--r-pill)',
              }}>
                MÁS POPULAR
              </div>
            )}

            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 4 }}>{p.desc}</div>
            <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--text)' }}>{p.name}</div>
            <div style={{ marginTop: 16, marginBottom: 28 }}>
              <span style={{ fontSize: 48, fontWeight: 900, color: p.highlight ? 'var(--teal)' : 'var(--text)' }}>
                ${p.price}
              </span>
              <span style={{ fontSize: 14, color: 'var(--text3)' }}> MXN/mes</span>
            </div>

            <Link href="/registro" style={{
              display: 'block', textAlign: 'center',
              padding: '13px 20px', borderRadius: 10,
              background: p.highlight ? 'var(--teal)' : 'var(--s2)',
              color: p.highlight ? '#000' : 'var(--text)',
              fontWeight: 700, fontSize: 14, textDecoration: 'none',
              border: p.highlight ? 'none' : '1px solid var(--border)',
              marginBottom: 28,
            }}>
              {p.cta}
            </Link>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {p.features.map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <CheckCircle2 size={16} color="var(--teal)" style={{ marginTop: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: 14, color: 'var(--text2)' }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Trust() {
  const items = [
    { icon: Shield, text: 'Datos cifrados con Google Cloud' },
    { icon: MapPin, text: 'Hecho en México para México' },
    { icon: Zap, text: 'Listo en menos de 5 minutos' },
  ]
  return (
    <section style={{
      borderTop: '1px solid var(--border)', padding: '48px 24px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 48, flexWrap: 'wrap' }}>
        {items.map(t => (
          <div key={t.text} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <t.icon size={18} color="var(--teal)" />
            <span style={{ fontSize: 14, color: 'var(--text2)' }}>{t.text}</span>
          </div>
        ))}
      </div>
      {/* Punto de entrada a la página de seguridad: exhibe la inversión en
          confianza como argumento de venta (antes solo estaba en el footer). */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link href="/seguridad" style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, textDecoration: 'none',
          fontSize: 13.5, fontWeight: 700, color: 'var(--nexus)',
          border: '1px solid var(--border2)', borderRadius: 'var(--r-pill)', padding: '8px 18px',
        }}>
          <Shield size={15} /> Cómo protegemos la información clínica <ArrowRight size={14} />
        </Link>
        <Link href="/evidencia" style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, textDecoration: 'none',
          fontSize: 13.5, fontWeight: 700, color: 'var(--text2)',
          border: '1px solid var(--border2)', borderRadius: 'var(--r-pill)', padding: '8px 18px',
        }}>
          <BarChart3 size={15} /> Evidencia y transparencia <ArrowRight size={14} />
        </Link>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text3)', maxWidth: 520, textAlign: 'center', margin: 0, lineHeight: 1.6 }}>
        NexusMED es nuevo: no inflamos cifras de usuarios ni inventamos testimonios. Lo que mostramos está respaldado por
        evidencia publicada o es una oferta real.
      </p>
    </section>
  )
}

function FAQ() {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <section style={{
      padding: '96px 24px', maxWidth: 720, margin: '0 auto',
      borderTop: '1px solid var(--border)',
    }}>
      <h2 style={{ fontSize: 40, fontWeight: 600, color: 'var(--text)', textAlign: 'center', marginBottom: 48 }}>
        Preguntas frecuentes
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {FAQS.map((f, i) => (
          <div key={i} style={{
            background: 'var(--s1)', border: '1px solid var(--border)',
            borderRadius: 12, overflow: 'hidden',
          }}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              style={{
                width: '100%', padding: '18px 20px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text)', fontSize: 15, fontWeight: 600, textAlign: 'left', gap: 12,
              }}
            >
              {f.q}
              <ChevronDown
                size={18}
                color="var(--text3)"
                style={{ flexShrink: 0, transition: 'transform 0.2s', transform: open === i ? 'rotate(180deg)' : 'none' }}
              />
            </button>
            {open === i && (
              <div style={{
                padding: '0 20px 18px', fontSize: 14, color: 'var(--text2)', lineHeight: 1.7,
              }}>
                {f.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function FinalCTA() {
  return (
    <section style={{
      padding: '96px 24px',
      background: 'linear-gradient(135deg, rgba(61,90,254,0.06) 0%, rgba(61,90,254,0.04) 100%)',
      borderTop: '1px solid var(--border)', textAlign: 'center',
    }}>
      <h2 style={{ fontSize: 40, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
        Recupera tu tiempo hoy
      </h2>
      <p style={{ fontSize: 17, color: 'var(--text2)', marginBottom: 40, maxWidth: 480, margin: '0 auto 40px' }}>
        Reúne agenda, expediente, recetas y cobros en una sola herramienta. 14 días gratis, sin compromisos.
      </p>
      <Link href="/registro" style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: 'var(--nexus-solido)', color: '#FFF', fontWeight: 700,
        fontSize: 18, padding: '16px 36px', borderRadius: 14,
        textDecoration: 'none',
      }}>
        Comenzar prueba gratis <ArrowRight size={20} />
      </Link>
      <p style={{ marginTop: 16, fontSize: 13, color: 'var(--text3)' }}>
        Sin tarjeta de crédito · Cancela cuando quieras
      </p>
    </section>
  )
}

function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid var(--border)', padding: '32px 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Stethoscope size={16} color="var(--teal)" />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.02em' }}>NexusMED</span>
        <span style={{ fontSize: 14, color: 'var(--text3)' }}>· Hecho en México 🇲🇽</span>
      </div>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <a href="/arquitectura" style={{ fontSize: 13, color: 'var(--text3)', textDecoration: 'none' }}>Arquitectura</a>
        <a href="/paquetes" style={{ fontSize: 13, color: 'var(--text3)', textDecoration: 'none' }}>Paquetes por especialidad</a>
        <a href="/demo/razonamiento" style={{ fontSize: 13, color: 'var(--text3)', textDecoration: 'none' }}>Cómo razona la IA</a>
        <a href="/operacion" style={{ fontSize: 13, color: 'var(--text3)', textDecoration: 'none' }}>Operación</a>
        <a href="/seguridad" style={{ fontSize: 13, color: 'var(--text3)', textDecoration: 'none' }}>Seguridad</a>
        <a href="/terminos" style={{ fontSize: 13, color: 'var(--text3)', textDecoration: 'none' }}>Términos</a>
        <a href="/privacidad" style={{ fontSize: 13, color: 'var(--text3)', textDecoration: 'none' }}>Privacidad</a>
        <a href="/contacto" style={{ fontSize: 13, color: 'var(--text3)', textDecoration: 'none' }}>Soporte</a>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text3)' }}>
        © {new Date().getFullYear()} NexusMED. Todos los derechos reservados.
      </div>
    </footer>
  )
}

/* ─── Page ──────────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <MetaPixel />
      <Nav />
      <Hero />
      <Stats />
      <Features />
      <HowItWorks />
      <Pricing />
      <Trust />
      <FAQ />
      <FinalCTA />
      <Footer />

      <style>{`
        @media (max-width: 768px) {
          #como-funciona > div > div:last-child {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
