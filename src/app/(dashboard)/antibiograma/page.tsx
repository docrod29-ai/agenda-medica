'use client'
/**
 * Herramienta de antibiograma inteligente — apoyo decisional PROA.
 * El médico captura organismo + sitio + panel S/I/R (con CMI opcional);
 * el motor DETERMINISTA infiere fenotipos, MECANISMO molecular
 * (β-lactamasas/porinas/bombas/carbapenemasas), terapia dirigida por clase,
 * conflictos de resistencia intrínseca y una explicación didáctica citada.
 * Superficie independiente: no toca el flujo de la nota/consulta.
 */
import { useState } from 'react'
import {
  interpretarAntibiograma, type SIR, type SitioInfeccion, type InterpretacionAntibiograma,
} from '@/lib/expediente/antibiograma'
import {
  FlaskConical, Plus, Trash2, AlertTriangle, ShieldAlert, Activity, Info, Bug,
  Dna, Target, BookOpen, Microscope,
} from 'lucide-react'

const ANTIBIOTICOS_COMUNES = [
  'Oxacilina', 'Cefoxitina', 'Penicilina', 'Ampicilina', 'Vancomicina', 'Ceftriaxona', 'Ceftazidima', 'Cefepime',
  'Aztreonam', 'Meropenem', 'Imipenem', 'Ertapenem', 'Piperacilina/Tazobactam',
  'Ciprofloxacino', 'Levofloxacino', 'Gentamicina', 'Amikacina', 'Colistina',
  'Ceftazidima-avibactam', 'Trimetoprim/Sulfametoxazol', 'Linezolid', 'Eritromicina', 'Clindamicina',
]

const SITIOS: { v: SitioInfeccion; t: string }[] = [
  { v: 'otro', t: 'General' }, { v: 'sangre', t: 'Sangre' }, { v: 'orina', t: 'Orina' },
  { v: 'respiratorio', t: 'Respiratorio' }, { v: 'snc', t: 'SNC/meningitis' },
  { v: 'piel-partes-blandas', t: 'Piel/partes blandas' }, { v: 'intraabdominal', t: 'Intraabdominal' },
  { v: 'hueso-articulacion', t: 'Hueso/articulación' },
]

interface Fila { antibiotico: string; interpretacion: SIR; cmi: string }
const nuevaFila = (antibiotico = ''): Fila => ({ antibiotico, interpretacion: 'S', cmi: '' })

export default function AntibiogramaPage() {
  const [organismo, setOrganismo] = useState('')
  const [sitio, setSitio] = useState<SitioInfeccion>('otro')
  const [filas, setFilas] = useState<Fila[]>([nuevaFila('Ceftriaxona'), nuevaFila('Meropenem')])
  const [res, setRes] = useState<InterpretacionAntibiograma | null>(null)

  const setFila = (i: number, patch: Partial<Fila>) =>
    setFilas(fs => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)))
  const quitar = (i: number) => setFilas(fs => fs.filter((_, j) => j !== i))
  const agregar = (nombre = '') => setFilas(fs => [...fs, nuevaFila(nombre)])

  const interpretar = () => {
    const resultados = filas
      .filter(f => f.antibiotico.trim())
      .map(f => ({
        antibiotico: f.antibiotico.trim(),
        interpretacion: f.interpretacion,
        ...(f.cmi.trim() && !isNaN(Number(f.cmi)) ? { cmi: Number(f.cmi) } : {}),
      }))
    setRes(interpretarAntibiograma({ organismo: organismo.trim(), resultados, sitio }))
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '20px 16px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <FlaskConical size={22} color="var(--teal)" />
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Antibiograma inteligente — PROA</h1>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 20, lineHeight: 1.5 }}>
        Captura organismo, sitio y panel S/I/R (con CMI si la tienes). El motor infiere fenotipos,
        <b> mecanismo molecular</b>, terapia dirigida y notificación NOM-045, con explicación citada.
        <b> Apoyo decisional — no sustituye el juicio clínico.</b>
      </p>

      {/* Organismo + sitio */}
      <label style={label}>Organismo</label>
      <input value={organismo} onChange={e => setOrganismo(e.target.value)}
        placeholder="p. ej. Escherichia coli, Klebsiella pneumoniae, Pseudomonas aeruginosa, S. aureus"
        style={{ ...input, marginBottom: 14 }} />

      <label style={label}>Sitio de infección (afina la lectura, p. ej. neumococo meníngeo)</label>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
        {SITIOS.map(s => (
          <button key={s.v} type="button" onClick={() => setSitio(s.v)}
            style={{ ...chip, ...(sitio === s.v ? { background: 'var(--teal)', color: '#fff', borderColor: 'var(--teal)' } : {}) }}>
            {s.t}
          </button>
        ))}
      </div>

      {/* Panel */}
      <label style={label}>Panel de sensibilidad</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
        {filas.map((f, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input value={f.antibiotico} onChange={e => setFila(i, { antibiotico: e.target.value })}
              placeholder="Antibiótico" list="ab-comunes" style={{ ...input, flex: 1 }} />
            <div style={{ display: 'flex', gap: 3 }}>
              {(['S', 'I', 'R'] as SIR[]).map(v => (
                <button key={v} type="button" onClick={() => setFila(i, { interpretacion: v })}
                  style={sirBtn(f.interpretacion === v, v)}>{v}</button>
              ))}
            </div>
            <input value={f.cmi} onChange={e => setFila(i, { cmi: e.target.value })}
              placeholder="CMI" inputMode="decimal" style={{ ...input, width: 66, textAlign: 'center' }} />
            <button type="button" onClick={() => quitar(i)} style={delBtn} aria-label="Quitar"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
      <datalist id="ab-comunes">{ANTIBIOTICOS_COMUNES.map(a => <option key={a} value={a} />)}</datalist>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => agregar()} style={addBtn}><Plus size={14} /> Fila</button>
        {ANTIBIOTICOS_COMUNES.slice(0, 8).map(a => (
          <button key={a} type="button" onClick={() => agregar(a)} style={chip}>{a}</button>
        ))}
      </div>

      <button type="button" onClick={interpretar} disabled={!organismo.trim()}
        style={{ ...cta, opacity: organismo.trim() ? 1 : 0.5, cursor: organismo.trim() ? 'pointer' : 'default' }}>
        <FlaskConical size={16} /> Interpretar
      </button>

      {res && <Resultado res={res} />}
    </div>
  )
}

function Resultado({ res }: { res: InterpretacionAntibiograma }) {
  const badge = (c: string) => c === 'confirmado' ? { bg: 'rgba(239,68,68,.15)', fg: '#f87171' }
    : c === 'probable' ? { bg: 'rgba(245,158,11,.15)', fg: '#f59e0b' }
    : { bg: 'rgba(148,163,184,.15)', fg: 'var(--text3)' }

  const conflictos = res.resistenciaIntrinseca.filter(n => n.tipo === 'conflicto')

  return (
    <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {res.notificacionObligatoria && (
        <div style={{ ...box, borderColor: 'rgba(239,68,68,.4)', background: 'rgba(239,68,68,.08)', color: '#f87171' }}>
          <ShieldAlert size={16} /> <b>Notificación epidemiológica obligatoria (NOM-045).</b>
          {res.aislamiento && <span style={{ color: 'var(--text2)' }}> · {res.aislamiento}</span>}
        </div>
      )}

      {conflictos.length > 0 && (
        <div>
          <SecTitle icon={<AlertTriangle size={15} />} t="Conflicto con resistencia intrínseca" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {conflictos.map((n, i) => (
              <div key={i} style={{ ...box, borderColor: 'rgba(245,158,11,.4)', background: 'rgba(245,158,11,.08)', color: '#f59e0b' }}>
                <span><b>{n.antibiotico}:</b> {n.mensaje}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {res.fenotipos.length === 0
        ? <div style={{ ...box, color: 'var(--text3)' }}><Info size={15} /> Sin fenotipos de resistencia detectados en el panel capturado.</div>
        : (
          <div>
            <SecTitle icon={<Bug size={15} />} t="Fenotipos de resistencia" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {res.fenotipos.map((f, i) => {
                const b = badge(f.confianza)
                return (
                  <div key={i} style={card}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{f.nombre}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 100, background: b.bg, color: b.fg }}>{f.confianza}</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0, lineHeight: 1.5 }}>{f.base}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      {res.mecanismos.length > 0 && (
        <div>
          <SecTitle icon={<Dna size={15} />} t="Mecanismo molecular inferido" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {res.mecanismos.map((m, i) => (
              <div key={i} style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{m.nombre}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: 'var(--s2)', color: 'var(--text3)' }}>{m.categoria}{m.ambler ? ` · clase ${m.ambler}` : ''}</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text3)', margin: '0 0 5px', lineHeight: 1.5 }}>{m.explicacion}</p>
                <p style={{ fontSize: 10.5, color: 'var(--text4, var(--text3))', margin: 0, fontStyle: 'italic' }}>{m.referencia}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {res.terapiaDirigida.length > 0 && (
        <div>
          <SecTitle icon={<Target size={15} />} t="Terapia dirigida por mecanismo" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {res.terapiaDirigida.map((t, i) => (
              <div key={i} style={{ ...box, ...terapiaEstilo(t.linea) }}>
                <span><b>{etiquetaLinea(t.linea)} · {t.agente}</b> — {t.razon}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {res.alertas.length > 0 && (
        <div>
          <SecTitle icon={<AlertTriangle size={15} />} t="Alertas clínicas" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {res.alertas.map((a, i) => (
              <div key={i} style={{ ...box, ...alertaEstilo(a.nivel) }}>{a.mensaje}</div>
            ))}
          </div>
        </div>
      )}

      {res.advertencias.length > 0 && (
        <div>
          <SecTitle icon={<AlertTriangle size={15} />} t="Advertencias de stewardship" />
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {res.advertencias.map((a, i) => <li key={i} style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>{a}</li>)}
          </ul>
        </div>
      )}

      {res.didactica.length > 0 && (
        <div>
          <SecTitle icon={<BookOpen size={15} />} t="Aprende: por qué este patrón" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {res.didactica.map((d, i) => (
              <div key={i} style={card}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{d.titulo}</div>
                <p style={{ fontSize: 12, color: 'var(--text3)', margin: '0 0 5px', lineHeight: 1.5 }}>{d.texto}</p>
                <p style={{ fontSize: 10.5, color: 'var(--text3)', margin: 0, fontStyle: 'italic' }}>{d.referencia}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {res.optimizacionPKPD.length > 0 && (
        <div>
          <SecTitle icon={<Activity size={15} />} t="Optimización PK/PD" />
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {res.optimizacionPKPD.map((a, i) => <li key={i} style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>{a}</li>)}
          </ul>
        </div>
      )}

      {res.referencias.length > 0 && (
        <div>
          <SecTitle icon={<Microscope size={15} />} t="Referencias" />
          <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {res.referencias.map((r, i) => <li key={i} style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>{r}</li>)}
          </ol>
        </div>
      )}

      <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}>
        Motor determinista basado en lectura interpretada del antibiograma (CLSI M100 / EUCAST /
        literatura citada). Herramienta en validación clínica; confirmar mecanismo por método
        fenotípico/molecular cuando aplique.
      </p>
    </div>
  )
}

function SecTitle({ icon, t }: { icon: React.ReactNode; t: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: 'var(--teal)' }}>
      {icon}<span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.03em', textTransform: 'uppercase' }}>{t}</span>
    </div>
  )
}

function alertaEstilo(n: 'critica' | 'alta' | 'info'): React.CSSProperties {
  if (n === 'critica') return { borderColor: 'rgba(239,68,68,.4)', background: 'rgba(239,68,68,.08)', color: '#f87171' }
  if (n === 'alta') return { borderColor: 'rgba(245,158,11,.4)', background: 'rgba(245,158,11,.08)', color: '#f59e0b' }
  return { color: 'var(--text2)' }
}

function terapiaEstilo(l: 'dirigida' | 'alternativa' | 'evitar'): React.CSSProperties {
  if (l === 'dirigida') return { borderColor: 'rgba(16,185,129,.4)', background: 'rgba(16,185,129,.08)', color: 'var(--text2)' }
  if (l === 'evitar') return { borderColor: 'rgba(239,68,68,.4)', background: 'rgba(239,68,68,.06)', color: 'var(--text2)' }
  return { color: 'var(--text2)' }
}
function etiquetaLinea(l: 'dirigida' | 'alternativa' | 'evitar'): string {
  return l === 'dirigida' ? '✓ Dirigida' : l === 'evitar' ? '✕ Evitar' : '○ Alternativa'
}

const label: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }
const input: React.CSSProperties = { background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 11px', fontSize: 13, color: 'var(--text)', outline: 'none', width: '100%', boxSizing: 'border-box' }
const delBtn: React.CSSProperties = { background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 6, flexShrink: 0 }
const addBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, background: 'var(--s2)', border: '1px dashed var(--border)', color: 'var(--text2)', borderRadius: 8, padding: '7px 12px', fontSize: 12.5, cursor: 'pointer' }
const chip: React.CSSProperties = { background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text3)', borderRadius: 100, padding: '5px 11px', fontSize: 11.5, cursor: 'pointer' }
const cta: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--nexus)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 18px', fontSize: 14, fontWeight: 600, marginTop: 20, width: '100%' }
const box: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', border: '1px solid var(--border)', borderRadius: 8, padding: '11px 13px', fontSize: 12.5, lineHeight: 1.5 }
const card: React.CSSProperties = { background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }

function sirBtn(activo: boolean, v: SIR): React.CSSProperties {
  const color = v === 'S' ? '#10b981' : v === 'I' ? '#f59e0b' : '#f87171'
  return {
    width: 32, height: 34, borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer',
    border: '1px solid ' + (activo ? color : 'var(--border)'),
    background: activo ? color : 'var(--s2)',
    color: activo ? '#fff' : 'var(--text3)',
  }
}
