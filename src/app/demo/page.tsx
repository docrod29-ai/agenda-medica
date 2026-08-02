import Link from 'next/link'
import type { Metadata } from 'next'
import { Calendar, Mic, FileText, MessageCircle, Headset, Smartphone, ArrowRight, ArrowLeft, CheckCircle2, MousePointerClick, FlaskConical, Sparkles, Stethoscope } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Ver demo · NexusMED',
  description: 'Recorrido por NexusMED: agenda, nota por voz e IA, receta y orden con QR, antibiograma inteligente (PROA), Consultor IA, herramientas clínicas, WhatsApp y portal del paciente.',
}

/**
 * Página /demo — recorrido visual del producto (problema comercial nº1: que el
 * médico entienda la app antes de registrarse). Maquetas fieles al estilo real
 * de la app, honestas (no capturas falsas). El sandbox 100% navegable vive en
 * /demo/interactivo (datos ficticios, sin red ni IA) y se enlaza desde el hero.
 */

const FLUJOS = [
  {
    icon: Calendar,
    paso: '01',
    titulo: 'Agenda una cita en segundos',
    texto: 'Calendario por día y semana. El paciente también puede agendar solo por WhatsApp; la cita aparece aquí al instante y se sincroniza con tu Google Calendar.',
    mock: 'agenda',
  },
  {
    icon: Mic,
    paso: '02',
    titulo: 'Dicta la consulta y la nota se escribe sola',
    texto: 'Presionas grabar y hablas con naturalidad. La IA separa lo que dijo el paciente de lo que dijiste tú, y arma una nota estructurada alineada a los requisitos aplicables de la NOM-004. Tú revisas, corriges y firmas.',
    mock: 'nota',
  },
  {
    icon: FileText,
    paso: '03',
    titulo: 'Genera la receta con tu membrete',
    texto: 'La receta sale con tu formato, firma y un código QR de validación. La imprimes o la envías al paciente por WhatsApp. También órdenes de estudios.',
    mock: 'receta',
  },
  {
    icon: FlaskConical,
    paso: '04',
    titulo: 'Interpreta un antibiograma desde una foto',
    texto: 'Subes la foto del reporte; la IA transcribe el patrón S/I/R y tú lo confirmas. El motor PROA infiere el fenotipo y mecanismo (MRSA, BLEE, carbapenemasa…), propone la terapia dirigida, clasifica AWaRe y arma la notificación NOM-045, con la explicación citada.',
    mock: 'antibiograma',
  },
  {
    icon: Sparkles,
    paso: '05',
    titulo: 'Un Consultor IA a tu lado',
    texto: 'Pregúntale dosis por función renal, esquemas empíricos, diagnóstico diferencial o interacciones. Razona el caso a nivel subespecialista y respalda con evidencia real (PubMed). Apoyo decisional; tú decides.',
    mock: 'ia',
  },
  {
    icon: Stethoscope,
    paso: '06',
    titulo: 'Herramientas clínicas por especialidad',
    texto: 'Calculadoras y paneles que razonan mientras atiendes: inmunocomprometido (trasplante, profilaxis), cardiometabólico (riesgo, FIB-4), pediatría (dosis por peso, percentiles OMS) y NEWS2. Todo se integra a la nota.',
    mock: 'herramientas',
  },
  {
    icon: MessageCircle,
    paso: '07',
    titulo: 'El bot atiende tu WhatsApp 24/7',
    texto: 'Tus pacientes agendan, reagendan y reciben recordatorios automáticos. Cuando alguien cancela, la lista de espera recibe aviso al instante.',
    mock: 'whatsapp',
  },
  {
    icon: Headset,
    paso: '08',
    titulo: 'Tu asistente ve solo lo que necesita',
    texto: 'El modo asistente muestra agenda y datos de contacto, sin acceso a la información clínica sensible ni a la configuración. Permisos por rol reales.',
    mock: 'secretaria',
  },
  {
    icon: Smartphone,
    paso: '09',
    titulo: 'El paciente tiene su propio portal',
    texto: 'Con un enlace seguro (sin contraseña) el paciente ve sus próximas citas, sus recetas y puede reagendar. Refuerza tu reputación con reseñas.',
    mock: 'portal',
  },
]

/* ─── Maquetas ligeras (divs con el estilo de la app, no capturas) ─── */
function Mock({ tipo }: { tipo: string }) {
  const base: React.CSSProperties = { background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, minHeight: 200 }
  if (tipo === 'agenda') {
    return (
      <div style={base}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', marginBottom: 10 }}>Lunes 14 de julio</div>
        {[['09:00', 'María López', 'Primera vez', 'var(--nexus)'], ['10:30', 'Juan Pérez', 'Seguimiento', '#16a34a'], ['12:00', 'Ana Ríos', 'Control', '#d97706']].map((c, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 10px', borderRadius: 9, background: 'var(--s2)', marginBottom: 7 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', width: 42 }}>{c[0]}</span>
            <span style={{ width: 3, alignSelf: 'stretch', borderRadius: 3, background: c[3] }} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{c[1]}</span>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>{c[2]}</span>
          </div>
        ))}
      </div>
    )
  }
  if (tipo === 'nota') {
    return (
      <div style={base}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, color: 'var(--red)', background: 'color-mix(in srgb, var(--red) 10%, transparent)', padding: '4px 10px', borderRadius: 100, marginBottom: 12 }}>
          <span style={{ width: 7, height: 7, borderRadius: 100, background: '#dc2626' }} /> Grabando · 01:24
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Padecimiento actual</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5, margin: '4px 0 12px' }}>Masculino de 54 años con dolor torácico opresivo de 2 h de evolución, irradiado a brazo izquierdo…</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Exploración física</div>
        <div style={{ height: 8, borderRadius: 4, background: 'var(--s2)', margin: '6px 0', width: '90%' }} />
        <div style={{ height: 8, borderRadius: 4, background: 'var(--s2)', width: '70%' }} />
      </div>
    )
  }
  if (tipo === 'receta') {
    return (
      <div style={{ ...base, display: 'flex', flexDirection: 'column' }}>
        <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>Dr. Nombre Apellido</div>
          <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>Cardiología · Céd. Prof. 0000000</div>
        </div>
        {['Ácido acetilsalicílico 100 mg — 1 tableta cada 24 h', 'Atorvastatina 40 mg — 1 tableta por la noche'].map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text2)', marginBottom: 7 }}><CheckCircle2 size={14} style={{ color: 'var(--nexus)', flexShrink: 0, marginTop: 1 }} /> {m}</div>
        ))}
        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', paddingTop: 10 }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--s2)', display: 'grid', placeItems: 'center', fontSize: 9, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.1 }}>QR<br/>válido</div>
        </div>
      </div>
    )
  }
  if (tipo === 'antibiograma') {
    return (
      <div style={base}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', marginBottom: 10 }}>S. aureus · piel</div>
        {[['Oxacilina', 'R', '#dc2626'], ['Cefoxitina', 'R', '#dc2626'], ['Vancomicina', 'S', '#16a34a'], ['TMP-SMX', 'S', '#16a34a']].map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: 'var(--s2)', marginBottom: 6 }}>
            <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text)' }}>{r[0]}</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: r[2] }}>{r[1]}</span>
          </div>
        ))}
        <div style={{ marginTop: 8, padding: '9px 11px', borderRadius: 9, background: 'var(--nexus-soft)', border: '1px solid var(--border2)', fontSize: 12, color: 'var(--text)' }}>
          <strong>MRSA</strong> → terapia dirigida + NOM-045
        </div>
      </div>
    )
  }
  if (tipo === 'ia') {
    return (
      <div style={base}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <span style={{ maxWidth: '80%', fontSize: 12, padding: '8px 11px', borderRadius: 12, background: 'var(--nexus)', color: '#fff' }}>¿Dosis de cefepime con TFG 35?</span>
        </div>
        <div style={{ display: 'flex', marginBottom: 8 }}>
          <span style={{ maxWidth: '85%', fontSize: 12, padding: '8px 11px', borderRadius: 12, background: 'var(--s2)', color: 'var(--text)', border: '1px solid var(--border)', lineHeight: 1.5 }}>Con TFG 30–60 mL/min, ajusta el intervalo de cefepime. Dime indicación y peso y te doy la dosis exacta.</span>
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>Respaldado por evidencia · apoyo decisional</div>
      </div>
    )
  }
  if (tipo === 'herramientas') {
    return (
      <div style={base}>
        {[['Inmunocomprometido', 'Trasplante · profilaxis'], ['Cardiometabólico', 'Riesgo ACC/AHA · FIB-4'], ['Pediatría', 'Dosis/peso · percentiles OMS'], ['NEWS2', 'Score de deterioro']].map((r, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: '9px 11px', borderRadius: 9, background: 'var(--s2)', marginBottom: 7 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{r[0]}</span>
            <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>{r[1]}</span>
          </div>
        ))}
      </div>
    )
  }
  if (tipo === 'whatsapp') {
    return (
      <div style={{ ...base, background: '#0b141a' }}>
        {[['in', 'Hola, quiero una cita con el Dr.'], ['out', '¡Claro! Tengo martes 10:00 o jueves 12:30. ¿Cuál te acomoda?'], ['in', 'Martes 10:00'], ['out', '✅ Listo, María. Cita el martes 10:00. Te recuerdo un día antes.']].map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m[0] === 'out' ? 'flex-end' : 'flex-start', marginBottom: 7 }}>
            <span style={{ maxWidth: '80%', fontSize: 12.5, lineHeight: 1.4, padding: '7px 10px', borderRadius: 10, color: '#e9edef', background: m[0] === 'out' ? '#005c4b' : '#1f2c34' }}>{m[1]}</span>
          </div>
        ))}
      </div>
    )
  }
  if (tipo === 'secretaria') {
    return (
      <div style={base}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11.5, fontWeight: 700, color: '#60a5fa', background: 'rgba(59,130,246,0.12)', padding: '4px 10px', borderRadius: 100, marginBottom: 12 }}>
          <Headset size={12} /> Modo asistente
        </div>
        {[['María López', '09:00', true], ['Juan Pérez', '10:30', true], ['Expediente clínico', '', false]].map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: 'var(--s2)', marginBottom: 7, opacity: r[2] ? 1 : 0.5 }}>
            <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text)' }}>{r[0]}</span>
            {r[2] ? <span style={{ fontSize: 12, color: 'var(--text3)' }}>{r[1] as string}</span>
                  : <span style={{ fontSize: 10.5, color: 'var(--text3)' }}>🔒 sin acceso</span>}
          </div>
        ))}
      </div>
    )
  }
  // portal
  return (
    <div style={base}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Hola, María 👋</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Tu próxima cita</div>
      <div style={{ padding: 12, borderRadius: 10, background: 'var(--nexus-soft)', border: '1px solid var(--border2)', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Martes 15 de julio · 10:00</div>
        <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>Dr. Nombre Apellido · Cardiología</div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: 'var(--nexus)', border: '1px solid var(--border2)', borderRadius: 8, padding: '7px 0' }}>Reagendar</span>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 0' }}>Mi receta</span>
      </div>
    </div>
  )
}

export default function DemoPage() {
  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 24px 80px' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text3)', fontSize: 14, textDecoration: 'none', marginBottom: 24 }}>
          <ArrowLeft size={15} /> Volver
        </Link>

        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 className="nx-display" style={{ fontSize: 'clamp(30px, 5vw, 48px)', fontWeight: 600, margin: '0 0 12px', letterSpacing: '-0.03em' }}>
            NexusMED en 2 minutos
          </h1>
          <p style={{ fontSize: 17, color: 'var(--text2)', maxWidth: 560, margin: '0 auto 20px', lineHeight: 1.6 }}>
            Todo lo que tu consultorio necesita, en un solo lugar. Mira cómo se ve cada parte antes de crear tu cuenta.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link href="/demo/interactivo" className="btn btn-primary btn-lg" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <MousePointerClick size={18} /> Probar el sandbox interactivo
            </Link>
            <Link href="/demo/razonamiento" className="btn btn-secondary btn-lg" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              Ver cómo razona el copiloto
            </Link>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 10 }}>Sin registro · datos ficticios · lo conduces tú</div>
        </div>

        {/* Video del producto (reel vertical 9:16) */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 52 }}>
          {/*
            PORTADA. Sin ella, quien entra a la página que existe para convencerlo
            ve un rectángulo NEGRO con un spinner mientras cargan 8.5 MB de vídeo
            — y en una conexión de consultorio eso son varios segundos delante de
            la primera impresión del producto.
            El fotograma es el gancho de la campaña («Son las 9 pm. Y me faltan 12
            notas»), así que la espera pasa de un vacío a un argumento. 52 KB.
          */}
          <video
            controls
            playsInline
            preload="metadata"
            poster="/videos/demo-nota-portada.jpg"
            style={{
              width: '100%', maxWidth: 340, aspectRatio: '9 / 16', borderRadius: 20,
              background: '#000', border: '1px solid var(--border)', boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
            }}
          >
            <source src="/videos/demo-nota.mp4" type="video/mp4" />
            Tu navegador no puede reproducir el video.
          </video>
        </div>

        {/* Flujos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          {FLUJOS.map((f, i) => {
            const Icono = f.icon
            const reverse = i % 2 === 1
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 28, alignItems: 'center' }} className="nx-demo-row">
                <div style={{ order: reverse ? 2 : 1 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--nexus-soft)', border: '1px solid var(--border2)', display: 'grid', placeItems: 'center', color: 'var(--nexus)' }}>
                      <Icono size={19} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text3)', letterSpacing: '0.05em' }}>{f.paso}</span>
                  </div>
                  <h2 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 8px', textWrap: 'balance' }}>{f.titulo}</h2>
                  <p style={{ fontSize: 14.5, color: 'var(--text2)', lineHeight: 1.6, margin: 0 }}>{f.texto}</p>
                </div>
                <div style={{ order: reverse ? 1 : 2 }}><Mock tipo={f.mock} /></div>
              </div>
            )
          })}
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center', marginTop: 64, padding: '40px 24px', borderRadius: 18, background: 'var(--s1)', border: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 26, fontWeight: 600, margin: '0 0 10px' }}>Pruébalo con tus propios pacientes</h2>
          <p style={{ fontSize: 15, color: 'var(--text2)', margin: '0 auto 24px', maxWidth: 460 }}>14 días gratis, sin tarjeta. Configúralo en 5 minutos.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/registro" className="btn btn-primary btn-lg" style={{ textDecoration: 'none' }}>
              Comenzar prueba gratis <ArrowRight size={17} />
            </Link>
            <Link href="/precios" className="btn btn-secondary btn-lg" style={{ textDecoration: 'none' }}>Ver precios</Link>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 720px) {
          .nx-demo-row { grid-template-columns: 1fr !important; }
          .nx-demo-row > div { order: initial !important; }
        }
      `}</style>
    </main>
  )
}
