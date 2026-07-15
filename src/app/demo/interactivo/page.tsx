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
} from 'lucide-react'
import {
  DEMO_ESCENARIOS, dictadoHasta, dictadoCompleto, DEMO_WHATSAPP,
  type DemoPaso, type DemoEscenario,
} from '@/lib/demo-sandbox'

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
    { k: 'receta', label: 'Receta' },
    { k: 'modulos', label: 'Módulos' },
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
  return (
    <div>
      <Encabezado icono={FileText} titulo="Receta con tu membrete" sub="Sale con tu formato, firma y un QR que verifica la integridad del documento. (Receta ficticia)" />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 16, marginTop: 16 }} className="nx-demo-receta">
        {/* Receta */}
        <div style={{ ...card, background: '#fff', color: '#111' }}>
          <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: 10, marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>Dr. Nombre Apellido <span style={{ fontSize: 11, fontWeight: 500, color: '#6b7280' }}>(ficticio)</span></div>
            <div style={{ fontSize: 11.5, color: '#6b7280' }}>Medicina General · Céd. Prof. 0000000</div>
          </div>
          <div style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}><strong>Paciente:</strong> {escenario.cita.iniciales} · {escenario.cita.sexo === 'F' ? 'F' : 'M'} {escenario.cita.edad} a · <strong>Folio:</strong> {escenario.folio}</div>
          <div style={{ fontSize: 12, color: '#374151', marginBottom: 12 }}><strong>Dx:</strong> {escenario.diagnostico}</div>
          {escenario.medicamentos.map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <CheckCircle2 size={15} style={{ color: '#3D5AFE', flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 12.5 }}><strong>{m.nombre}</strong> — {m.indicacion}</span>
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
        <h3 style={{ fontSize: 19, fontWeight: 600, margin: '0 0 8px' }}>Explora los otros módulos</h3>
        <p style={{ fontSize: 14, color: 'var(--text2)', margin: '0 auto 16px', maxWidth: 460 }}>WhatsApp, portal de secretaria y portal del paciente — también los pruebas tú.</p>
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
type ModTab = 'whatsapp' | 'secretaria' | 'portal'

function ExploradorModulos({ onReiniciar }: { onReiniciar: () => void }) {
  const [tab, setTab] = useState<ModTab>('whatsapp')
  const tabs: { k: ModTab; label: string; icon: typeof MessageCircle }[] = [
    { k: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
    { k: 'secretaria', label: 'Secretaria', icon: Headset },
    { k: 'portal', label: 'Portal del paciente', icon: Smartphone },
  ]
  return (
    <div>
      <Encabezado icono={MessageCircle} titulo="Otros módulos" sub="Pruébalos tú mismo. Todo es ficticio; no se envían mensajes ni se conecta a nada." />
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
        <Headset size={13} /> Vista de secretaria
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
