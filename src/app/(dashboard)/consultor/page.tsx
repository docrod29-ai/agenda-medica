'use client'
import { useState, useRef, useEffect } from 'react'
import { fetchAutenticado } from '@/lib/auth-client'
import { useClinic } from '@/context/ClinicContext'
import { getPatients } from '@/lib/firestore'
import { Sparkles, Send, Loader2, FlaskConical, BookOpen, X, UserRound } from 'lucide-react'
import { MiniMarkdown } from '@/components/MiniMarkdown'
import { useTarea } from '@/context/TareasContext'

interface Articulo { pmid: string; titulo: string; revista: string; anio: string; url: string }
interface Turno { pregunta: string; respuesta: string; articulos: Articulo[]; cenetecUrl?: string; cargando?: boolean }

const EJEMPLOS = [
  '¿Antibiótico de primera línea para neumonía adquirida en la comunidad en adulto sano?',
  '¿Metformina vs SGLT2 como inicio en diabetes tipo 2 con enfermedad renal?',
  '¿Duración óptima de anticoagulación tras un primer TEP no provocado?',
  '¿Corticoide inhalado en EPOC: a quién sí y a quién no?',
]

export default function ConsultorPage() {
  const { clinicId } = useClinic()
  const [pregunta, setPregunta] = useState('')
  // Conversación + "pensando" viven en un almacén EN MEMORIA (por encima del
  // navegador de pantallas): si te cambias de pantalla mientras la IA piensa, la
  // petición sigue y el resultado te espera al volver — no se pierde.
  const [estado, setEstado] = useTarea<{ turnos: Turno[]; cargando: boolean }>('consultor')
  const turnos = estado?.turnos ?? []
  const cargando = estado?.cargando ?? false
  // Contexto de paciente (cuando se abre desde un expediente con ?paciente=ID).
  const [pacienteNombre, setPacienteNombre] = useState('')
  const [pacienteCtx, setPacienteCtx] = useState('')
  const finRef = useRef<HTMLDivElement>(null)
  useEffect(() => { finRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [estado])

  // Al entrar, si la URL trae ?paciente=ID, carga sus datos como contexto.
  useEffect(() => {
    if (!clinicId) return
    const id = new URLSearchParams(window.location.search).get('paciente')
    if (!id) return
    getPatients(clinicId).then(ps => {
      const p = ps.find(x => x.id === id)
      if (!p) return
      const alergias = p.alergias?.trim() || 'no referidas'
      setPacienteNombre(p.nombre)
      setPacienteCtx(`${p.nombre}, ${p.edad ?? '?'} años, ${p.sexo ?? '?'}. Alergias: ${alergias}.`)
    }).catch(() => {})
  }, [clinicId])

  const preguntar = async (q: string) => {
    const texto = q.trim()
    if (!texto || cargando) return
    setPregunta('')
    const historial = turnos.flatMap(t => [{ rol: 'user', texto: t.pregunta }, { rol: 'ia', texto: t.respuesta }])
    // Escribe SIEMPRE al almacén (referencia estable): sobrevive a desmontar.
    setEstado(prev => ({ turnos: [...(prev?.turnos ?? []), { pregunta: texto, respuesta: '', articulos: [], cargando: true }], cargando: true }))
    try {
      const res = await fetchAutenticado('/api/consultor-evidencia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pregunta: texto, historial, contextoPaciente: pacienteCtx || undefined }),
      })
      const d = await res.json().catch(() => null)
      setEstado(prev => {
        const copia = [...(prev?.turnos ?? [])]
        const i = copia.length - 1
        if (i >= 0) copia[i] = d?.ok
          ? { pregunta: texto, respuesta: d.respuesta ?? '', articulos: d.articulos ?? [], cenetecUrl: d.cenetecUrl }
          : { pregunta: texto, respuesta: `⚠️ ${d?.error || 'No se pudo consultar.'}`, articulos: [] }
        return { turnos: copia, cargando: false }
      })
    } catch {
      setEstado(prev => {
        const c = [...(prev?.turnos ?? [])]
        if (c.length > 0) c[c.length - 1] = { pregunta: texto, respuesta: '⚠️ Sin conexión.', articulos: [] }
        return { turnos: c, cargando: false }
      })
    }
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '20px 16px 120px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(20,184,166,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FlaskConical size={20} style={{ color: 'var(--teal)' }} />
        </div>
        <div>
          <h1 style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Consultor de Evidencia</h1>
          <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>Pregunta clínica → respuesta con citas reales de PubMed (NEJM · JAMA · Cochrane)</div>
        </div>
      </div>

      {/* Chip de paciente en contexto */}
      {pacienteNombre && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 12, padding: '6px 10px', borderRadius: 100, background: 'rgba(61,90,254,0.10)', border: '1px solid rgba(61,90,254,0.3)', fontSize: 12.5, color: 'var(--nexus, #3d5afe)', fontWeight: 600 }}>
          <UserRound size={13} /> Sobre: {pacienteNombre}
          <button onClick={() => { setPacienteNombre(''); setPacienteCtx('') }} title="Quitar contexto del paciente"
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', display: 'flex', padding: 0, marginLeft: 2 }}>
            <X size={13} />
          </button>
        </div>
      )}

      {turnos.length === 0 && (
        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 10 }}>Ejemplos para empezar:</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {EJEMPLOS.map((e, i) => (
              <button key={i} onClick={() => preguntar(e)}
                style={{ textAlign: 'left', padding: '11px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text2)', fontSize: 13.5, cursor: 'pointer' }}>
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 20 }}>
        {turnos.map((t, i) => (
          <div key={i}>
            <div style={{ display: 'flex', gap: 9, marginBottom: 10 }}>
              <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', background: 'var(--nexus, #3d5afe)', color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Dr</div>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text)', paddingTop: 3 }}>{t.pregunta}</div>
            </div>
            <div style={{ display: 'flex', gap: 9 }}>
              <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', background: 'rgba(20,184,166,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={14} style={{ color: 'var(--teal)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {t.cargando ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text3)', paddingTop: 3 }}>
                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Buscando en la literatura y razonando…
                  </div>
                ) : (
                  <>
                    <MiniMarkdown texto={t.respuesta} />
                    {t.cenetecUrl && (
                      <a href={t.cenetecUrl} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 12, fontWeight: 600, color: 'var(--nexus, #3d5afe)', textDecoration: 'none', background: 'rgba(61,90,254,0.08)', border: '1px solid rgba(61,90,254,0.28)', borderRadius: 8, padding: '5px 10px' }}>
                        <BookOpen size={12} /> Buscar la guía mexicana (GPC · CENETEC)
                      </a>
                    )}
                    {t.articulos.length > 0 && (
                      <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', marginBottom: 6 }}>
                          <BookOpen size={13} /> Fuentes ({t.articulos.length})
                        </div>
                        {t.articulos.map((a, k) => (
                          <div key={a.pmid} style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 3, lineHeight: 1.4 }}>
                            [{k + 1}] <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal)', textDecoration: 'none' }}>{a.titulo}</a> · <span style={{ fontStyle: 'italic' }}>{a.revista}</span> {a.anio}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={finRef} />
      </div>

      {/* Barra de pregunta fija abajo */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--bg)', borderTop: '1px solid var(--border)', padding: '12px 16px' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            value={pregunta}
            onChange={e => setPregunta(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); preguntar(pregunta) } }}
            placeholder="Escribe tu pregunta clínica… (Enter para enviar)"
            rows={1}
            style={{ flex: 1, resize: 'none', maxHeight: 120, padding: '11px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text)', fontSize: 14, lineHeight: 1.4, fontFamily: 'inherit' }}
          />
          <button onClick={() => preguntar(pregunta)} disabled={cargando || !pregunta.trim()}
            style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 12, border: 'none', cursor: cargando || !pregunta.trim() ? 'default' : 'pointer', background: cargando || !pregunta.trim() ? 'var(--s3)' : 'var(--teal)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {cargando ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={18} />}
          </button>
        </div>
        <div style={{ maxWidth: 820, margin: '4px auto 0', fontSize: 10.5, color: 'var(--text3)', textAlign: 'center' }}>
          Evidencia de PubMed (resúmenes públicos + citas). Apoyo a la decisión — el juicio clínico es tuyo.
        </div>
      </div>
    </div>
  )
}
