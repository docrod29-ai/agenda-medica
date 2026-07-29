'use client'
/**
 * SANDBOX INTERACTIVO — /demo/interactivo
 *
 * El visitante conduce una sesión simulada de NexusMED: elige una cita, "dicta"
 * la consulta (la transcripción se revela por pasos), ve armarse la nota S/O/A/P
 * y genera una receta con QR verificable. TODO es ficticio y determinista:
 * cero red, cero IA real, cero Firestore, cero PHI. Página pública standalone
 * (no usa los providers del dashboard). Ver src/lib/demo-sandbox.ts.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, ArrowRight, Calendar, Mic, FileText, ShieldCheck, CheckCircle2,
  RotateCcw, Square, Info, MessageCircle, Headset, Smartphone, Lock,
  FlaskConical, Sparkles, Stethoscope, ClipboardList, Send, AlertTriangle, Activity,
} from 'lucide-react'
import {
  DEMO_ESCENARIOS, dictadoHasta, dictadoCompleto, DEMO_WHATSAPP,
  type DemoPaso, type DemoEscenario,
} from '@/lib/demo-sandbox'
import { construirSeccionesUCI } from '@/lib/uci/nota'
import { dosisARate, CATALOGO_INFUSIONES, farmacoPorKey } from '@/lib/uci/infusiones'
import { cantidadDesde } from '@/types/clinical-quantity'
import { snapshotUCI } from '@/lib/uci/copilot'

export default function SandboxPage() {
  const [idx, setIdx] = useState(0)
  const [paso, setPaso] = useState<DemoPaso>('agenda')
  const escenario = DEMO_ESCENARIOS[idx]

  const reiniciar = (nuevoIdx = idx) => { setIdx(nuevoIdx); setPaso('agenda') }

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)' }}>
      {/* Banda permanente: esto es una demostración */}
      <div style={{ background: 'var(--nexus-soft)', borderBottom: '1px solid var(--border2)', padding: '8px 16px', textAlign: 'center', fontSize: 12.5, color: 'var(--text2)', display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
        <Info size={14} style={{ color: 'var(--nexus)', flexShrink: 0 }} />
        <span><strong style={{ color: 'var(--text)' }}>Demostración interactiva</strong> · pacientes y datos ficticios · sin conexión a datos reales, IA ni internet</span>
      </div>

      <div style={{ maxWidth: 980, margin: '0 auto', padding: '20px 20px 80px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
          <Link href="/demo" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text3)', fontSize: 14, textDecoration: 'none' }}>
            <ArrowLeft size={15} /> Volver a la demo
          </Link>
          <Pasos paso={paso} />
        </div>

        {paso === 'agenda' && (
          <Agenda
            idxActual={idx}
            onElegir={(i) => { setIdx(i); setPaso('dictado') }}
          />
        )}
        {paso === 'dictado' && (
          <Dictado escenario={escenario} onListo={() => setPaso('nota')} onReiniciar={() => reiniciar()} />
        )}
        {paso === 'nota' && (
          <Nota escenario={escenario} onGenerarReceta={() => setPaso('receta')} onReiniciar={() => reiniciar()} />
        )}
        {paso === 'receta' && (
          <Receta escenario={escenario} onReiniciar={() => reiniciar()} onOtro={() => reiniciar(idx === 0 ? 1 : 0)} onExplorar={() => setPaso('modulos')} />
        )}
        {paso === 'modulos' && (
          <ExploradorModulos onReiniciar={() => reiniciar()} />
        )}
      </div>

      <style>{`
        .nx-demo-cita:hover { border-color: var(--border2); background: var(--s1); }
        .nx-caret { animation: nxBlink 1s step-end infinite; color: var(--nexus); }
        .nx-pulse { animation: nxPulse 1.1s ease-in-out infinite; }
        .nx-fade { animation: nxFade .35s ease both; }
        @keyframes nxBlink { 50% { opacity: 0; } }
        @keyframes nxPulse { 0%,100% { opacity: 1; } 50% { opacity: .3; } }
        @keyframes nxFade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        @media (max-width: 680px) { .nx-demo-receta { grid-template-columns: 1fr !important; } }
        @media (prefers-reduced-motion: reduce) {
          .nx-caret, .nx-pulse, .nx-fade { animation: none !important; }
        }
      `}</style>
    </main>
  )
}

/* ─────────────────────────── Indicador de pasos ─────────────────────────── */
function Pasos({ paso }: { paso: DemoPaso }) {
  const items: { k: DemoPaso; label: string }[] = [
    { k: 'agenda', label: 'Agenda' },
    { k: 'dictado', label: 'Dictado' },
    { k: 'nota', label: 'Nota' },
    { k: 'receta', label: 'Receta / Orden' },
    { k: 'modulos', label: 'Herramientas' },
  ]
  const orden = items.map(i => i.k)
  const actualI = orden.indexOf(paso)
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {items.map((it, i) => {
        const hecho = i < actualI, activo = i === actualI
        return (
          <div key={it.k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 100,
              color: activo ? '#fff' : hecho ? 'var(--nexus)' : 'var(--text3)',
              background: activo ? 'var(--nexus)' : hecho ? 'var(--nexus-soft)' : 'var(--s2)',
              border: '1px solid ' + (activo || hecho ? 'var(--border2)' : 'var(--border)'),
            }}>{it.label}</span>
            {i < items.length - 1 && <span style={{ width: 10, height: 1, background: 'var(--border2)' }} />}
          </div>
        )
      })}
    </div>
  )
}

const card: React.CSSProperties = { background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }

/* ─────────────────────────────── Agenda ────────────────────────────────── */
function Agenda({ idxActual, onElegir }: { idxActual: number; onElegir: (i: number) => void }) {
  return (
    <div>
      <Encabezado icono={Calendar} titulo="Tu agenda de hoy" sub="Elige una cita para iniciar la consulta. (Lunes 14 de julio — ficticio)" />
      <div style={{ ...card, marginTop: 16 }}>
        {DEMO_ESCENARIOS.map((e, i) => (
          <button
            key={i}
            onClick={() => onElegir(i)}
            style={{
              width: '100%', textAlign: 'left', display: 'flex', gap: 12, alignItems: 'center',
              padding: '12px 12px', borderRadius: 11, background: 'var(--s2)', marginBottom: i < DEMO_ESCENARIOS.length - 1 ? 9 : 0,
              border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text)',
            }}
            className="nx-demo-cita"
          >
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text2)', width: 46 }}>{e.cita.hora}</span>
            <span style={{ width: 3, alignSelf: 'stretch', borderRadius: 3, background: e.cita.color }} />
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>Paciente {e.cita.iniciales} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)' }}>· {e.cita.sexo === 'F' ? 'Femenino' : 'Masculino'} {e.cita.edad} años</span></span>
              <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text3)' }}>{e.cita.motivo}</span>
            </span>
            <ArrowRight size={16} style={{ color: 'var(--text3)' }} />
          </button>
        ))}
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 12 }}>
        En la app real, estas citas llegan solas cuando el paciente agenda por WhatsApp o desde tu perfil público.
      </p>
    </div>
  )
}

/* ─────────────────────────────── Dictado ───────────────────────────────── */
function Dictado({ escenario, onListo, onReiniciar }: { escenario: DemoEscenario; onListo: () => void; onReiniciar: () => void }) {
  const [n, setN] = useState(0)          // fragmentos revelados
  const [grabando, setGrabando] = useState(false)
  const [seg, setSeg] = useState(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const reduce = usePrefiereReducir()
  const completo = dictadoCompleto(escenario, n)

  const parar = () => {
    setGrabando(false)
    if (timer.current) { clearInterval(timer.current); timer.current = null }
  }

  const grabar = () => {
    if (completo) return
    if (reduce) { setN(escenario.dictado.length); return }  // accesibilidad: sin animación
    setGrabando(true)
  }

  // Reloj + revelado progresivo mientras "graba"
  useEffect(() => {
    if (!grabando) return
    timer.current = setInterval(() => {
      setSeg(s => s + 1)
      setN(prev => {
        const next = Math.min(prev + 1, escenario.dictado.length)
        if (next >= escenario.dictado.length) parar()
        return next
      })
    }, 1100)
    return () => { if (timer.current) clearInterval(timer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grabando])

  const mmss = `${String(Math.floor(seg / 60)).padStart(2, '0')}:${String(seg % 60).padStart(2, '0')}`

  return (
    <div>
      <Encabezado icono={Mic} titulo={`Consulta · Paciente ${escenario.cita.iniciales}`} sub="Presiona grabar y observa cómo se transcribe el dictado. (Texto ficticio; no se usa micrófono ni IA)" />
      <div style={{ ...card, marginTop: 16, minHeight: 220 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          {!completo ? (
            grabando ? (
              <button onClick={parar} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <Square size={14} /> Detener
              </button>
            ) : (
              <button onClick={grabar} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <Mic size={15} /> {n === 0 ? 'Grabar dictado' : 'Continuar'}
              </button>
            )
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: '#16a34a' }}>
              <CheckCircle2 size={16} /> Dictado completo
            </span>
          )}
          {grabando && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, color: '#dc2626', background: 'rgba(220,38,38,0.1)', padding: '4px 10px', borderRadius: 100 }}>
              <span style={{ width: 7, height: 7, borderRadius: 100, background: '#dc2626' }} className="nx-pulse" /> Grabando · {mmss}
            </span>
          )}
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Transcripción</div>
        <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, minHeight: 90, margin: 0 }}>
          {n === 0
            ? <span style={{ color: 'var(--text3)' }}>Aún no hay audio. Presiona <strong>Grabar dictado</strong>.</span>
            : dictadoHasta(escenario, n)}
          {grabando && <span className="nx-caret">▍</span>}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
        <button onClick={onListo} disabled={!completo} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, opacity: completo ? 1 : 0.5, cursor: completo ? 'pointer' : 'not-allowed' }}>
          Generar nota <ArrowRight size={16} />
        </button>
        <button onClick={onReiniciar} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <RotateCcw size={14} /> Reiniciar
        </button>
      </div>
    </div>
  )
}

/* ──────────────────────────────── Nota ─────────────────────────────────── */
function Nota({ escenario, onGenerarReceta, onReiniciar }: { escenario: DemoEscenario; onGenerarReceta: () => void; onReiniciar: () => void }) {
  return (
    <div>
      <Encabezado icono={FileText} titulo="Nota estructurada" sub="La app arma la nota S/O/A/P desde el dictado. Tú revisas, corriges y firmas. (Nota ficticia pre-escrita)" />
      <div style={{ ...card, marginTop: 16 }}>
        {escenario.nota.map((s, i) => (
          <div key={i} style={{ marginBottom: i < escenario.nota.length - 1 ? 16 : 0 }} className="nx-fade">
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--nexus)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{s.seccion}</div>
            <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.55 }}>{s.texto}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
        <button onClick={onGenerarReceta} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          Generar receta <ArrowRight size={16} />
        </button>
        <button onClick={onReiniciar} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <RotateCcw size={14} /> Reiniciar
        </button>
      </div>
    </div>
  )
}

/* ─────────────────────────────── Receta ────────────────────────────────── */
function Receta({ escenario, onReiniciar, onOtro, onExplorar }: { escenario: DemoEscenario; onReiniciar: () => void; onOtro: () => void; onExplorar: () => void }) {
  const [verificado, setVerificado] = useState(false)
  const [doc, setDoc] = useState<'receta' | 'orden'>('receta')
  const esReceta = doc === 'receta'
  // Estudios ficticios para ilustrar la ORDEN médica (mismo flujo que la receta).
  const estudios = ['Biometría hemática completa', 'Química sanguínea (glucosa, creatinina, PFH)', 'Examen general de orina', 'Proteína C reactiva']
  return (
    <div>
      <Encabezado icono={FileText} titulo="Receta y orden médica" sub="Salen con tu formato, firma y un QR que verifica la integridad. Cambia entre receta y orden. (Documentos ficticios)" />
      {/* Conmutador Receta / Orden */}
      <div style={{ display: 'inline-flex', gap: 4, margin: '16px 0 0', padding: 4, background: 'var(--s2)', borderRadius: 100, border: '1px solid var(--border)' }}>
        {([['receta', 'Receta', FileText], ['orden', 'Orden médica', ClipboardList]] as const).map(([k, label, Icono]) => (
          <button key={k} onClick={() => setDoc(k)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
            padding: '6px 14px', borderRadius: 100, border: 'none',
            background: doc === k ? 'var(--nexus)' : 'transparent', color: doc === k ? '#fff' : 'var(--text2)',
          }}><Icono size={14} /> {label}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 16, marginTop: 12 }} className="nx-demo-receta">
        {/* Documento (receta u orden) */}
        <div style={{ ...card, background: '#fff', color: '#111' }}>
          <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: 10, marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>Dr. Nombre Apellido <span style={{ fontSize: 11, fontWeight: 500, color: '#6b7280' }}>(ficticio)</span></div>
            <div style={{ fontSize: 11.5, color: '#6b7280' }}>Medicina General · Céd. Prof. 0000000</div>
          </div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', color: '#3D5AFE', textTransform: 'uppercase', marginBottom: 8 }}>{esReceta ? 'Receta médica' : 'Orden de estudios'}</div>
          <div style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}><strong>Paciente:</strong> {escenario.cita.iniciales} · {escenario.cita.sexo === 'F' ? 'F' : 'M'} {escenario.cita.edad} a · <strong>Folio:</strong> {escenario.folio}</div>
          <div style={{ fontSize: 12, color: '#374151', marginBottom: 12 }}><strong>Dx:</strong> {escenario.diagnostico}</div>
          {esReceta
            ? escenario.medicamentos.map((m, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <CheckCircle2 size={15} style={{ color: '#3D5AFE', flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 12.5 }}><strong>{m.nombre}</strong> — {m.indicacion}</span>
                </div>
              ))
            : estudios.map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <ClipboardList size={15} style={{ color: '#3D5AFE', flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 12.5 }}>{e}</span>
                </div>
              ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 8, background: '#f3f4f6', display: 'grid', placeItems: 'center', fontSize: 9, color: '#6b7280', textAlign: 'center', lineHeight: 1.15, border: '1px solid #e5e7eb' }}>QR<br/>verif.</div>
          </div>
        </div>

        {/* Verificación */}
        <div style={{ ...card }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Verificación del documento</div>
          {!verificado ? (
            <>
              <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.55, marginTop: 0 }}>
                Al escanear el QR, cualquiera puede comprobar que la receta se generó en NexusMED y no fue alterada.
              </p>
              <button onClick={() => setVerificado(true)} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <ShieldCheck size={15} /> Simular escaneo del QR
              </button>
            </>
          ) : (
            <div className="nx-fade">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#16a34a', marginBottom: 10 }}>
                <ShieldCheck size={20} /> <strong>Integridad verificada</strong>
              </div>
              {[['Documento', 'Generado por NexusMED'], ['Folio', escenario.folio], ['Estado', 'Vigente']].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text3)' }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span>
                </div>
              ))}
              <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 10, lineHeight: 1.5 }}>
                La verificación confirma integridad; no sustituye los requisitos legales ni la validación de la cédula ante la autoridad.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Siguiente: explorar los otros módulos interactivos */}
      <div style={{ ...card, marginTop: 20, textAlign: 'center' }}>
        <h3 style={{ fontSize: 19, fontWeight: 600, margin: '0 0 8px' }}>Explora las herramientas clínicas</h3>
        <p style={{ fontSize: 14, color: 'var(--text2)', margin: '0 auto 16px', maxWidth: 480 }}>Antibiograma inteligente, Consultor IA, calculadoras clínicas, WhatsApp y portal del paciente — todo lo pruebas tú.</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={onExplorar} className="btn btn-primary btn-lg" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            Explorar módulos <ArrowRight size={16} />
          </button>
          <button onClick={onOtro} className="btn btn-secondary btn-lg" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <RotateCcw size={15} /> Probar otro caso
          </button>
        </div>
        <button onClick={onReiniciar} style={{ marginTop: 14, background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline' }}>
          Volver a la agenda
        </button>
      </div>
    </div>
  )
}

/* ─────────────────────── Explorador de módulos ─────────────────────────── */
type ModTab = 'uci' | 'antibiograma' | 'ia' | 'herramientas' | 'whatsapp' | 'secretaria' | 'portal'

function ExploradorModulos({ onReiniciar }: { onReiniciar: () => void }) {
  const [tab, setTab] = useState<ModTab>('uci')
  const tabs: { k: ModTab; label: string; icon: typeof MessageCircle }[] = [
    { k: 'uci', label: 'Panel UCI', icon: Activity },
    { k: 'antibiograma', label: 'Antibiograma', icon: FlaskConical },
    { k: 'ia', label: 'Consultor IA', icon: Sparkles },
    { k: 'herramientas', label: 'Herramientas clínicas', icon: Stethoscope },
    { k: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
    { k: 'secretaria', label: 'Secretaria', icon: Headset },
    { k: 'portal', label: 'Portal del paciente', icon: Smartphone },
  ]
  return (
    <div>
      <Encabezado icono={Stethoscope} titulo="Herramientas clínicas y módulos" sub="Pruébalos tú mismo. Todo es ficticio; no se conecta a datos reales, IA ni internet." />
      <div style={{ display: 'flex', gap: 8, margin: '16px 0', flexWrap: 'wrap' }}>
        {tabs.map(t => {
          const activo = tab === t.k
          return (
            <button key={t.k} onClick={() => setTab(t.k)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              padding: '8px 14px', borderRadius: 100,
              border: '1px solid ' + (activo ? 'var(--nexus)' : 'var(--border)'),
              background: activo ? 'var(--nexus-soft)' : 'var(--s2)', color: activo ? 'var(--nexus)' : 'var(--text2)',
            }}><t.icon size={15} /> {t.label}</button>
          )
        })}
      </div>

      {tab === 'uci' && <ModUCI />}
      {tab === 'antibiograma' && <ModAntibiograma />}
      {tab === 'ia' && <ModConsultorIA />}
      {tab === 'herramientas' && <ModHerramientas />}
      {tab === 'whatsapp' && <ModWhatsApp />}
      {tab === 'secretaria' && <ModSecretaria />}
      {tab === 'portal' && <ModPortal />}

      <div style={{ ...card, marginTop: 20, textAlign: 'center' }}>
        <h3 style={{ fontSize: 19, fontWeight: 600, margin: '0 0 8px' }}>Pruébalo con tus propios pacientes</h3>
        <p style={{ fontSize: 14, color: 'var(--text2)', margin: '0 auto 16px', maxWidth: 460 }}>14 días gratis, sin tarjeta.</p>
        <Link href="/registro" className="btn btn-primary btn-lg" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          Comenzar prueba gratis <ArrowRight size={16} />
        </Link>
        <button onClick={onReiniciar} style={{ display: 'block', margin: '14px auto 0', background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline' }}>
          Volver a la agenda
        </button>
      </div>
    </div>
  )
}

/** Panel UCI: el visitante elige un escenario y "dicta" el pase; los MOTORES
 *  REALES (deterministas) calculan y arman la nota por 7 sistemas. Valores de
 *  ejemplo, cálculos reales del producto. Incluye calculadora de infusión viva. */
interface EscenarioUCI { id: string; titulo: string; cama: string; transcripcion: string; v: Record<string, string> }
const DEMO_UCI_ESCENARIOS: EscenarioUCI[] = [
  {
    id: 'sepsis', titulo: 'SDRA séptico + LRA', cama: 'Cama 4 · Hombre 58 a, 70 kg',
    transcripcion: 'Día 3 de UCI, asistido controlado por volumen, FiO₂ 60, PEEP 10, volumen corriente 420, plateau 26, PaO₂ 78, gasometría arterial pH 7.28, PaCO₂ 34, bicarbonato 15, sodio 138, cloro 108, albúmina 2.5, lactato 3.2. Tensión 95 sobre 55, norepinefrina 0.2, bajo sedación RASS menos 2. Creatinina 1.6, plaquetas 90, bilirrubina 1.5. En eco vena cava 2.3, hepática grave, porta grave. En CVVHDF.',
    v: { sexo: 'M', talla: '170', vt: '420', fio2: '60', peep: '10', pplat: '26', pao2: '78', muestra: 'arterial', soporte: 'si', modo: 'AC-VC', ph: '7.28', paco2: '34', hco3: '15', na: '138', cl: '108', alb: '2.5', lactato: '3.2', pas: '95', pad: '55', norepi: '0.2', rass: '-2', creat: '1.6', plaquetas: '90', bili: '1.5', vci: '2.3', vHep: 'grave', vPor: 'grave', vRen: 'normal' },
  },
  {
    id: 'cardiogenico', titulo: 'Choque cardiogénico + ECMO VA', cama: 'Cama 2 · Hombre 63 a, 80 kg',
    transcripcion: 'Choque cardiogénico en ECMO veno-arterial. SpO₂ mano derecha 84, miembro inferior 99, presión 70 sobre 62, válvula aórtica no abre. Norepinefrina 0.3, dobutamina 5, lactato 4.5, sedación profunda RASS menos 4. TAPSE 12, VD sobre VI 1.1. Presión pre-oxigenador 260, post 200, basal 25.',
    v: { sexo: 'M', talla: '172', fio2: '50', peep: '8', pplat: '22', pao2: '90', muestra: 'arterial', soporte: 'si', modo: 'AC-VC', vt: '400', pas: '80', pad: '55', norepi: '0.3', dobu: '5', lactato: '4.5', rass: '-4', creat: '1.4', plaquetas: '140', bili: '1.0', tapse: '12', vdvi: '1.1', ecmoConf: 'VA', ecmoPre: '260', ecmoPost: '200', ecmoBasal: '25', ecmoSpD: '84', ecmoSpI: '99', ecmoValv: 'no', ecmoPas: '70', ecmoPad: '62' },
  },
  {
    id: 'tce', titulo: 'TCE grave · neurocrítico', cama: 'Cama 7 · Hombre 41 a, 75 kg',
    transcripcion: 'Trauma craneoencefálico grave, Glasgow al ingreso 6, intubado, sedación profunda RASS menos 4. Presión intracraneal 26, pupilas anisocóricas, PaCO₂ 30, temperatura 38, sodio 150, osmolaridad 315. Tensión 110 sobre 70. FiO₂ 40, PEEP 5, plateau 18, PaO₂ 95, gasometría arterial.',
    v: { sexo: 'M', talla: '175', glasgow: '6', rass: '-4', pic: '26', pas: '110', pad: '70', paco2: '30', temp: '38', na: '150', osm: '315', pupilas: 'anisocoria', fio2: '40', peep: '5', pplat: '18', pao2: '95', muestra: 'arterial', soporte: 'si', vt: '450', modo: 'AC-VC' },
  },
]

function ModUCI() {
  const [escId, setEscId] = useState('sepsis')
  const [estado, setEstado] = useState<'idle' | 'grabando' | 'listo'>('idle')
  const esc = DEMO_UCI_ESCENARIOS.find(e => e.id === escId)!
  const snap = useMemo(() => snapshotUCI(esc.v), [esc])
  const secciones = useMemo(() => construirSeccionesUCI(esc.v).filter(s => s.value.trim() !== ''), [esc])
  const dictar = () => { setEstado('grabando'); setTimeout(() => setEstado('listo'), 1600) }
  const cambiar = (id: string) => { setEscId(id); setEstado('idle') }

  // Métricas REALES calculadas por los motores para este escenario.
  const metricas: [string, string, string][] = [
    ['PaO₂/FiO₂', snap.ventilacion.indiceKirby.ok ? String(snap.ventilacion.indiceKirby.valor) : '—', 'Kirby/Berlin'],
    ['Driving pressure', snap.ventilacion.drivingPressure.ok ? String(snap.ventilacion.drivingPressure.valor) : '—', 'meta ≤ 15'],
    ['SOFA', snap.sofa.total != null ? String(snap.sofa.total) : '—', snap.sofa.parcial ? 'parcial' : 'completo'],
    ['PAM', snap.pam.ok ? String(snap.pam.valor) : '—', 'mmHg'],
    ['VExUS-C', snap.pocus.vexus.ok ? String(snap.pocus.vexus.valor) : '—', 'congestión'],
    ['PPC', snap.neuro.ppc.ok ? String(snap.neuro.ppc.valor) : '—', 'PAM − PIC'],
    ['RASS', snap.neuro.rass.ok ? `${snap.neuro.rass.valor! > 0 ? '+' : ''}${snap.neuro.rass.valor}` : '—', snap.neuro.gcsValorable ? 'GCS valorable' : 'intubado → RASS'],
  ]

  return (
    <div>
      <Encabezado icono={Activity} titulo="Panel UCI · dicta el pase, la nota se escribe sola" sub="Elige un escenario y dicta el pase. Los motores deterministas calculan (P/F, driving pressure, SOFA, VExUS, PPC, gasometría, ECMO) y arman la nota por los 7 sistemas. Valores de ejemplo; los cálculos son los reales del producto." />

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '14px 0' }}>
        {DEMO_UCI_ESCENARIOS.map(e => {
          const on = e.id === escId
          return <button key={e.id} onClick={() => cambiar(e.id)} style={{ fontSize: 12.5, fontWeight: 600, padding: '7px 13px', borderRadius: 100, cursor: 'pointer', border: '1px solid ' + (on ? 'var(--nexus)' : 'var(--border)'), background: on ? 'var(--nexus-soft)' : 'var(--s2)', color: on ? 'var(--nexus)' : 'var(--text2)' }}>{e.titulo}</button>
        })}
      </div>

      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>{esc.cama}</div>
        <div style={{ fontSize: 16, fontWeight: 600, margin: '4px 0 12px' }}>{esc.titulo}</div>
        <button onClick={dictar} disabled={estado === 'grabando'} className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, ...(estado === 'grabando' ? { background: '#dc2626', border: 'none', color: '#fff' } : {}) }}>
          {estado === 'grabando' ? <Square size={15} /> : <Mic size={15} />}
          {estado === 'grabando' ? 'Grabando…' : estado === 'listo' ? 'Volver a dictar' : 'Dictar pase de visita'}
        </button>
        {estado === 'grabando' && <span style={{ marginLeft: 12, fontSize: 12.5, color: '#dc2626' }}>● Escuchando y transcribiendo…</span>}
        {estado === 'listo' && (
          <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--text2)', background: 'var(--s2)', borderRadius: 8, padding: '10px 12px', fontStyle: 'italic' }}>“{esc.transcripcion}”</div>
        )}
      </div>

      {estado === 'listo' && (<>
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}><CheckCircle2 size={15} style={{ color: 'var(--nexus)' }} /> El código calculó (no la IA)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8 }}>
            {metricas.map(([l, n, t]) => (
              <div key={l} style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', opacity: n === '—' ? 0.5 : 1 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{l}</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'ui-monospace,monospace' }}>{n}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 2 }}>{n === '—' ? 'sin dato' : t}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}><FileText size={15} style={{ color: 'var(--nexus)' }} /> Nota de evolución UCI · por los 7 sistemas</div>
          <div style={{ fontFamily: 'ui-monospace,monospace', fontSize: 12 }}>
            {secciones.map(s => (
              <div key={s.key} style={{ borderTop: '1px solid var(--border)', padding: '9px 0' }}>
                <div style={{ color: 'var(--nexus)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', fontSize: 10.5 }}>{s.label}</div>
                <div style={{ color: 'var(--text2)', marginTop: 3, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 10 }}>Si falta un dato que invalida un cálculo, el motor lo bloquea y lo declara — nunca inventa. Cada alerta trae su guía citada.</div>
        </div>
      </>)}

      <CalcInfusionDemo />
    </div>
  )
}

/** Calculadora de infusión interactiva (motor real): el visitante cambia fármaco,
 *  dosis y peso y ve la velocidad en mL/h en vivo. */
function CalcInfusionDemo() {
  const [fk, setFk] = useState('norepinefrina')
  const [dosis, setDosis] = useState('0.2')
  const [peso, setPeso] = useState('70')
  // E0-05 — FRONTERA de la demo: la dosis se etiqueta con la unidad del fármaco
  // elegido (la misma que muestra el catálogo) y el peso con kg. Números idénticos.
  const res = useMemo(() => {
    const f = farmacoPorKey(fk)
    const u = f?.unidad ?? 'µg/kg/min'
    const d = u === 'µg/kg/min' ? cantidadDesde(dosis, 'µg/kg/min', 'tasa_dosis_peso')
      : u === 'U/min' ? cantidadDesde(dosis, 'U/min', 'tasa_actividad')
      : cantidadDesde(dosis, 'µg/min', 'tasa_dosis')
    return dosisARate({ farmacoKey: fk, dosis: d, pesoKg: cantidadDesde(peso, 'kg', 'masa') })
  }, [fk, dosis, peso])
  const inp: React.CSSProperties = { padding: '7px 9px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text)', fontSize: 13 }
  return (
    <div style={{ ...card }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>💉 Calculadora de infusión · dosis → mL/h (motor real)</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11.5, color: 'var(--text3)' }}>Fármaco
          <select value={fk} onChange={e => setFk(e.target.value)} style={{ ...inp, width: 170 }}>
            {CATALOGO_INFUSIONES.map(f => <option key={f.key} value={f.key}>{f.nombre}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11.5, color: 'var(--text3)' }}>Dosis
          <input value={dosis} onChange={e => setDosis(e.target.value)} inputMode="decimal" style={{ ...inp, width: 90 }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11.5, color: 'var(--text3)' }}>Peso (kg)
          <input value={peso} onChange={e => setPeso(e.target.value)} inputMode="decimal" style={{ ...inp, width: 80 }} />
        </label>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          {res.ok
            ? <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'ui-monospace,monospace', color: 'var(--nexus)' }}>{res.rateMlH?.valor} <span style={{ fontSize: 12, color: 'var(--text3)' }}>mL/h</span></div>
            : <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>{res.motivoBloqueo}</div>}
        </div>
      </div>
      {res.ok && <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 8 }}>{res.interpretacion}</div>}
      {res.advertencias.map((a, i) => <div key={i} style={{ fontSize: 11.5, color: '#d97706', marginTop: 4 }}>⚠ {a}</div>)}
    </div>
  )
}

/** Antibiograma: el visitante "interpreta" un panel S/I/R ficticio y ve el
 *  fenotipo, mecanismo y terapia dirigida que armaría el motor. */
function ModAntibiograma() {
  const [interpretado, setInterpretado] = useState(false)
  const panel: [string, 'S' | 'I' | 'R'][] = [
    ['Oxacilina', 'R'], ['Cefoxitina', 'R'], ['Vancomicina', 'S'],
    ['Clindamicina', 'S'], ['TMP-SMX', 'S'], ['Ciprofloxacino', 'R'],
  ]
  const colorSIR = (v: string) => v === 'S' ? '#16a34a' : v === 'R' ? '#dc2626' : '#d97706'
  return (
    <div style={{ ...card }}>
      <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 12 }}>
        Organismo: <strong style={{ color: 'var(--text)' }}>Staphylococcus aureus</strong> · Sitio: <strong style={{ color: 'var(--text)' }}>piel y partes blandas</strong> · panel de sensibilidad de ejemplo.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 8, marginBottom: 14 }}>
        {panel.map(([ab, v]) => (
          <div key={ab} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 11px', borderRadius: 9, background: 'var(--s2)', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: 12.5 }}>{ab}</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: colorSIR(v), width: 18, textAlign: 'center' }}>{v}</span>
          </div>
        ))}
      </div>
      {!interpretado ? (
        <button onClick={() => setInterpretado(true)} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <FlaskConical size={15} /> Interpretar con el motor PROA
        </button>
      ) : (
        <div className="nx-fade" style={{ display: 'grid', gap: 10 }}>
          <div style={{ padding: 12, borderRadius: 11, background: 'var(--nexus-soft)', border: '1px solid var(--border2)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--nexus)', marginBottom: 5 }}>Fenotipo y mecanismo</div>
            <div style={{ fontSize: 13, lineHeight: 1.55 }}><strong>MRSA</strong> (oxacilina/cefoxitina R → mecA/PBP2a). β-lactámicos convencionales no útiles; sensible a vancomicina, clindamicina y TMP-SMX.</div>
          </div>
          <div style={{ padding: 12, borderRadius: 11, background: 'var(--s2)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 5 }}>Terapia dirigida sugerida</div>
            <div style={{ fontSize: 13, lineHeight: 1.55 }}>Infección no grave de piel: <strong>TMP-SMX</strong> o <strong>clindamicina</strong> VO. Grave/sistémica: <strong>vancomicina</strong> IV. Clasificación AWaRe y notificación NOM-045 listas.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 11.5, color: 'var(--text3)' }}>
            <AlertTriangle size={14} style={{ color: '#d97706', flexShrink: 0, marginTop: 1 }} />
            <span>Ejemplo ilustrativo. En la app real tú confirmas el S/I/R y el motor razona con EUCAST/CLSI y cita la fuente. Apoyo decisional, no sustituye tu juicio.</span>
          </div>
        </div>
      )}
    </div>
  )
}

/** Consultor IA: chat clínico con respuestas ficticias pre-escritas. */
function ModConsultorIA() {
  const guion: Record<string, string> = {
    'Ajuste de dosis por función renal': 'Para un paciente con TFG 30–50 mL/min, muchos antimicrobianos requieren ajuste. Ejemplo: cefepime, reduce el intervalo; nitrofurantoína, evítala por <60. Dime el fármaco y la TFG exacta y te doy la dosis.',
    'Esquema empírico de neumonía': 'NAC que amerita hospitalización (no UCI): β-lactámico (ceftriaxona) + macrólido, o una fluoroquinolona respiratoria en monoterapia. Ajusta según factores de riesgo de resistencia y comorbilidades.',
    'Interacciones de un fármaco': 'Dime el fármaco y los que ya toma el paciente; reviso interacciones relevantes (QT, CYP, nefrotoxicidad) y te propongo alternativas si hay conflicto.',
  }
  const [chat, setChat] = useState<{ de: 'yo' | 'ia'; texto: string }[]>([
    { de: 'ia', texto: 'Soy tu Consultor IA. Pregúntame dosis, esquemas empíricos o interacciones. (Respuestas de ejemplo)' },
  ])
  const preguntar = (q: string) => setChat(c => [...c, { de: 'yo', texto: q }, { de: 'ia', texto: guion[q] }])
  return (
    <div style={{ ...card, maxWidth: 560 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12, minHeight: 90 }}>
        {chat.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.de === 'yo' ? 'flex-end' : 'flex-start' }}>
            <span style={{ maxWidth: '85%', fontSize: 12.5, lineHeight: 1.5, padding: '9px 12px', borderRadius: 12,
              background: m.de === 'yo' ? 'var(--nexus)' : 'var(--s2)', color: m.de === 'yo' ? '#fff' : 'var(--text)',
              border: m.de === 'yo' ? 'none' : '1px solid var(--border)' }}>{m.texto}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        {Object.keys(guion).map(q => (
          <button key={q} onClick={() => preguntar(q)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            padding: '7px 12px', borderRadius: 100, border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text2)',
          }}><Send size={12} /> {q}</button>
        ))}
      </div>
    </div>
  )
}

/** Herramientas clínicas: tarjetas de las calculadoras/paneles por especialidad. */
function ModHerramientas() {
  const items: { t: string; d: string; ej: string }[] = [
    { t: 'Inmunocomprometido', d: 'Valoración de trasplante (SOT/TCMH), biológicos y profilaxis.', ej: 'Ej.: receptor de riñón en tacrolimús → profilaxis anti-Pneumocystis y CMV sugeridas.' },
    { t: 'Cardiometabólico', d: 'Riesgo ACC/AHA, obesidad y MASLD con FIB-4.', ej: 'Ej.: FIB-4 1.9 → fibrosis indeterminada, sugiere elastografía.' },
    { t: 'Pediatría', d: 'Dosis por peso y percentiles OMS por edad/sexo.', ej: 'Ej.: amoxicilina 45 mg/kg/día en niño de 14 kg = 630 mg/día.' },
    { t: 'NEWS2 / signos', d: 'Score de deterioro a partir de los signos vitales.', ej: 'Ej.: FR 24, SpO₂ 92%, TA 100 → NEWS2 elevado, vigilar.' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 10 }}>
      {items.map(it => (
        <div key={it.t} style={{ ...card, padding: 15 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 4 }}>{it.t}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 9, lineHeight: 1.5 }}>{it.d}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 9, padding: '8px 10px', lineHeight: 1.5 }}>{it.ej}</div>
        </div>
      ))}
    </div>
  )
}

/** WhatsApp: chat con el bot, el visitante toca las opciones (guion ficticio). */
function ModWhatsApp() {
  const [turnos, setTurnos] = useState<{ de: 'bot' | 'yo'; texto: string }[]>([{ de: 'bot', texto: DEMO_WHATSAPP.inicio.bot }])
  const [opciones, setOpciones] = useState<string[]>(DEMO_WHATSAPP.inicio.opciones)

  const elegir = (op: string) => {
    if (op === 'Reiniciar') {
      setTurnos([{ de: 'bot', texto: DEMO_WHATSAPP.inicio.bot }])
      setOpciones(DEMO_WHATSAPP.inicio.opciones)
      return
    }
    const sig = DEMO_WHATSAPP[op]
    if (!sig) return
    setTurnos(t => [...t, { de: 'yo', texto: op }, { de: 'bot', texto: sig.bot }])
    setOpciones(sig.opciones)
  }

  return (
    <div style={{ ...card, background: '#0b141a', maxWidth: 420 }}>
      <div style={{ fontSize: 12, color: '#8aa', marginBottom: 10 }}>Asistente del Dr. · WhatsApp (demo)</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 12, minHeight: 120 }}>
        {turnos.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.de === 'yo' ? 'flex-end' : 'flex-start' }}>
            <span style={{ maxWidth: '82%', fontSize: 12.5, lineHeight: 1.4, padding: '7px 10px', borderRadius: 10, color: '#e9edef', background: m.de === 'yo' ? '#005c4b' : '#1f2c34' }}>{m.texto}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        {opciones.map(op => (
          <button key={op} onClick={() => elegir(op)} style={{
            fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: '7px 12px', borderRadius: 100,
            border: '1px solid #2a3942', background: '#111b21', color: '#8fd3c4',
          }}>{op === 'Reiniciar' ? '↺ Reiniciar' : op}</button>
        ))}
      </div>
    </div>
  )
}

/** Secretaria: la misma agenda pero SIN acceso a lo clínico (permisos por rol). */
function ModSecretaria() {
  return (
    <div style={{ ...card }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, color: '#60a5fa', background: 'rgba(59,130,246,0.12)', padding: '4px 10px', borderRadius: 100, marginBottom: 12 }}>
        <Headset size={13} /> Vista de asistente
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 12 }}>Ve la agenda y datos de contacto; <strong>no</strong> ve notas, diagnósticos ni configuración.</div>
      {[['09:00', 'Paciente M. F.', true], ['10:30', 'Paciente J. R.', true], ['Expediente clínico', '', false], ['Configuración', '', false]].map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 9, background: 'var(--s2)', marginBottom: 7, opacity: r[2] ? 1 : 0.55 }}>
          {r[2] ? <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', width: 42 }}>{r[0]}</span> : <Lock size={14} style={{ color: 'var(--text3)' }} />}
          <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{r[2] ? r[1] : r[0]}</span>
          {!r[2] && <span style={{ fontSize: 11, color: 'var(--text3)' }}>sin acceso</span>}
        </div>
      ))}
    </div>
  )
}

/** Portal del paciente: lo que ve el paciente con su enlace (clickeable). */
function ModPortal() {
  const [msg, setMsg] = useState('')
  return (
    <div style={{ ...card, maxWidth: 420 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Hola, M. F. 👋</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Tu próxima cita</div>
      <div style={{ padding: 12, borderRadius: 10, background: 'var(--nexus-soft)', border: '1px solid var(--border2)', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Martes 15 de julio · 10:00</div>
        <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>Dr. Nombre Apellido · Medicina General</div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setMsg('Te enviamos opciones para reagendar (demo).')} style={portalBtn(true)}>Reagendar</button>
        <button onClick={() => setMsg('Aquí verías tu receta con el QR de verificación (demo).')} style={portalBtn(false)}>Mi receta</button>
      </div>
      {msg && <div className="nx-fade" style={{ marginTop: 12, fontSize: 12.5, color: 'var(--text2)', background: 'var(--s2)', borderRadius: 9, padding: '10px 12px' }}>{msg}</div>}
    </div>
  )
}
const portalBtn = (primario: boolean): React.CSSProperties => ({
  flex: 1, textAlign: 'center', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: '9px 0', borderRadius: 8,
  color: primario ? 'var(--nexus)' : 'var(--text3)',
  border: '1px solid ' + (primario ? 'var(--border2)' : 'var(--border)'), background: 'var(--s2)',
})

/* ─────────────────────────────── Utilidades ────────────────────────────── */
function Encabezado({ icono: Icono, titulo, sub }: { icono: React.ComponentType<{ size?: number }>; titulo: string; sub: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--nexus-soft)', border: '1px solid var(--border2)', display: 'grid', placeItems: 'center', color: 'var(--nexus)', flexShrink: 0 }}>
        <Icono size={20} />
      </div>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 3px', letterSpacing: '-0.02em' }}>{titulo}</h1>
        <p style={{ fontSize: 13.5, color: 'var(--text3)', margin: 0, lineHeight: 1.5 }}>{sub}</p>
      </div>
    </div>
  )
}

function usePrefiereReducir(): boolean {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduce(mq.matches)
    const on = () => setReduce(mq.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return reduce
}
