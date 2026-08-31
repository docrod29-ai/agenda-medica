'use client'
import { useState, useRef, useEffect } from 'react'
import { fetchAutenticado } from '@/lib/auth-client'
import { useClinic } from '@/context/ClinicContext'
import { getPatient } from '@/lib/firestore'
import { Sparkles, Send, Loader2, FlaskConical, BookOpen, X, UserRound, AlertTriangle } from 'lucide-react'
import { MiniMarkdown } from '@/components/MiniMarkdown'
import { useTarea } from '@/context/TareasContext'
import { comportamientoScroll } from '@/lib/ui/movimiento'

interface Articulo { pmid: string; titulo: string; revista: string; anio: string; url: string; tipo?: string; doi?: string }
/**
 * El estado REAL de la recuperación (#314), no una interpretación de la lista
 * de artículos. `sin_resultados` («se preguntó y no hay») y `no_consultado`
 * («no se pudo preguntar») producían la misma pantalla, y son lo contrario.
 */
interface Recuperacion {
  estado: 'con_evidencia' | 'sin_resultados' | 'no_consultado'
  fuentesCitables?: number
  procedencia?: { sourceId: string; proveedor: string }[]
  avisos?: string[]
  motivo?: string | null
}
interface Turno { pregunta: string; respuesta: string; articulos: Articulo[]; cenetecUrl?: string; modelos?: string[]; fechaBusqueda?: string; cargando?: boolean; sinCitas?: boolean; recuperacion?: Recuperacion }

/** Nivel de evidencia orientativo por DISEÑO del estudio (proxy tipo GRADE, no un grado GRADE formal). */
function nivelEvidencia(tipo?: string): { label: string; color: string } | null {
  switch (tipo) {
    case 'Meta-análisis': return { label: 'Evidencia alta', color: 'var(--green)' }
    case 'Guía': return { label: 'Guía de práctica', color: 'var(--green)' }
    case 'ECA': return { label: 'Evidencia alta', color: 'var(--green)' }
    case 'Revisión': return { label: 'Evidencia moderada', color: 'var(--amber)' }
    default: return null
  }
}

/** Números de cita [n] presentes en el texto (para verificación determinista). */
const citasEnTexto = (texto: string): number[] => {
  const s = new Set<number>()
  for (const m of texto.matchAll(/\[(\d{1,2})\]/g)) s.add(parseInt(m[1], 10))
  return [...s].sort((a, b) => a - b)
}

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
  useEffect(() => { finRef.current?.scrollIntoView({ behavior: comportamientoScroll() }) }, [estado])

  // Al entrar, si la URL trae ?paciente=ID, carga sus datos como contexto.
  useEffect(() => {
    if (!clinicId) return
    const id = new URLSearchParams(window.location.search).get('paciente')
    if (!id) return
    /**
     * A3 — UNA PANTALLA QUE NECESITA UN PACIENTE LEE UN PACIENTE.
     *
     * Antes se descargaba el directorio para hacer `.find()`. Además del coste,
     * con la lista ya acotada un `.find()` sobre el recorte devolvería «no
     * está» de un paciente que sí existe: el contexto clínico desaparecería en
     * silencio justo en el consultorio grande.
     */
    getPatient(clinicId, id).then(p => {
      if (!p) return
      const alergias = p.alergias?.trim() || 'no referidas'
      setPacienteNombre(p.nombre)
      // SIN EL NOMBRE. No aporta nada clínico y viaja al proveedor en el extranjero —
      // y de ahí a `extraerAprendizajes`, que PERSISTE lo que saca. El otro llamador
      // de esta misma ruta (la consulta) ya lo minimizaba; había dos políticas
      // opuestas para el mismo endpoint.
      setPacienteCtx(`${p.edad ?? '?'} años, ${p.sexo ?? '?'}. Alergias: ${alergias}.`)
    }).catch(() => {})
  }, [clinicId])

  const preguntar = async (q: string) => {
    const texto = q.trim()
    if (!texto || cargando) return
    setPregunta('')
    const historial = turnos.flatMap(t => [{ rol: 'user', texto: t.pregunta }, { rol: 'ia', texto: t.respuesta }])
    // Escribe SIEMPRE al almacén (referencia estable): sobrevive a desmontar.
    setEstado(prev => ({ turnos: [...(prev?.turnos ?? []), { pregunta: texto, respuesta: '', articulos: [], cargando: true }], cargando: true }))
    // Parche del ÚLTIMO turno (el que se está transmitiendo). `fin=false` mantiene
    // el input deshabilitado mientras llega el stream; `fin=true` lo libera.
    const patch = (p: Partial<Turno>, fin = false) => setEstado(prev => {
      const c = [...(prev?.turnos ?? [])]
      const i = c.length - 1
      if (i >= 0) c[i] = { ...c[i], ...p }
      return { turnos: c, cargando: !fin }
    })
    try {
      const res = await fetchAutenticado('/api/consultor-evidencia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pregunta: texto, historial, contextoPaciente: pacienteCtx || undefined }),
      })
      // Error (402 sin créditos, 503 sin llave, timeout no-stream): viene como JSON.
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => null)
        patch({ respuesta: `⚠️ ${d?.error || 'La consulta tardó demasiado. Vuelve a intentarlo o hazla más corta.'}`, cargando: false }, true)
        return
      }
      // STREAM (NDJSON): 1ª línea meta (fuentes), luego deltas de texto en vivo.
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = '', acc = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lineas = buf.split('\n'); buf = lineas.pop() ?? ''
        for (const linea of lineas) {
          const s = linea.trim(); if (!s) continue
          let ev: { type?: string; text?: string; error?: string; articulos?: Articulo[]; cenetecUrl?: string; modelos?: string[]; fechaBusqueda?: string; sinCitas?: boolean; recuperacion?: Recuperacion }
          try { ev = JSON.parse(s) } catch { continue }
          if (ev.type === 'meta') patch({ articulos: ev.articulos ?? [], cenetecUrl: ev.cenetecUrl, modelos: ev.modelos, fechaBusqueda: ev.fechaBusqueda, sinCitas: ev.sinCitas === true, recuperacion: ev.recuperacion, cargando: false })
          else if (ev.type === 'delta') { acc += ev.text ?? ''; patch({ respuesta: acc, cargando: false }) }
          else if (ev.type === 'error') { acc = acc || `⚠️ ${ev.error}`; patch({ respuesta: acc, cargando: false }) }
        }
      }
      patch({ respuesta: acc || 'Sin respuesta.' }, true)
    } catch {
      patch({ respuesta: '⚠️ Sin conexión.', cargando: false }, true)
    }
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '20px 16px 120px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: 'color-mix(in srgb, var(--nexus) 12%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FlaskConical size={20} style={{ color: 'var(--teal)' }} />
        </div>
        <div>
          <h1 style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Consultor de Evidencia</h1>
          <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>Pregunta clínica → respuesta con citas reales de PubMed (NEJM · JAMA · Cochrane)</div>
        </div>
      </div>

      {/* Chip de paciente en contexto */}
      {pacienteNombre && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 12, padding: '6px 10px', borderRadius: 'var(--r-pill)', background: 'rgba(61,90,254,0.10)', border: '1px solid rgba(61,90,254,0.3)', fontSize: 12.5, color: 'var(--nexus)', fontWeight: 600 }}>
          <UserRound size={13} /> Sobre: {pacienteNombre}
          <button onClick={() => { setPacienteNombre(''); setPacienteCtx('') }} title="Quitar contexto del paciente"
            className="nx-acc-texto"
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0, marginLeft: 2 }}>
            <X size={13} />
          </button>
        </div>
      )}

      {turnos.length === 0 && (
        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 10 }}>Ejemplos para empezar:</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {EJEMPLOS.map((e, i) => (
              <button key={i} onClick={() => preguntar(e)} className="nx-acc-caja"
                style={{ textAlign: 'left', padding: '11px 14px', borderRadius: 10, border: '1px solid var(--border)', color: 'var(--text2)', fontSize: 13.5, cursor: 'pointer' }}>
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
              <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', background: 'var(--nexus-solido)', color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Dr</div>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text)', paddingTop: 3 }}>{t.pregunta}</div>
            </div>
            <div style={{ display: 'flex', gap: 9 }}>
              <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', background: 'color-mix(in srgb, var(--nexus) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={14} style={{ color: 'var(--teal)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {t.cargando ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text3)', paddingTop: 3 }}>
                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Buscando en la literatura y razonando…
                  </div>
                ) : (
                  <>
                    {/*
                      EL AVISO DE «SIN CITAS» LO ESCRIBE LA PANTALLA, NO EL MODELO.
                      El servidor manda `sinCitas: true` de forma determinista
                      cuando PubMed no devolvió nada. Antes la honestidad dependía
                      de que el modelo obedeciera una instrucción del prompt
                      («empieza con una línea honesta…»): si la omitía o la
                      reformulaba, la respuesta se leía idéntica a una respaldada
                      por literatura. El dato ya existía; sólo que nadie lo usaba.
                    */}
                    {/*
                      Y LA OTRA MITAD: «no se pudo preguntar» NO es «no hay».
                      El cartel de abajo afirmaba que PubMed no tenía resultados
                      también cuando PubMed no había contestado — un fallo de red
                      con forma de hallazgo clínico. Ahora el estado viene del
                      sobre de recuperación (#314) y cada caso dice lo suyo.
                    */}
                    {t.recuperacion?.estado === 'no_consultado' && !t.cargando && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10, fontSize: 12, borderRadius: 'var(--r-md)', padding: '8px 10px', color: 'var(--red)', background: 'color-mix(in srgb, var(--red) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)' }}>
                        <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                        <span>
                          NO se pudo consultar PubMed. <strong>No se sabe si hay literatura sobre esto</strong> —
                          no es que no exista. Lo de abajo es razonamiento clínico sin búsqueda bibliográfica;
                          vuelve a intentarlo en un momento.
                          {t.recuperacion?.motivo ? <><br /><span style={{ opacity: 0.85 }}>{t.recuperacion.motivo}</span></> : null}
                        </span>
                      </div>
                    )}
                    {t.sinCitas && !t.cargando && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10, fontSize: 12, borderRadius: 8, padding: '8px 10px', color: 'var(--amber)', background: 'color-mix(in srgb, var(--amber) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--amber) 30%, transparent)' }}>
                        <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                        <span>Sin resultados de PubMed para esta pregunta. Lo de abajo es razonamiento clínico, no literatura citada — verifica antes de aplicarlo.</span>
                      </div>
                    )}
                    {/**
                      * QUÉ SE CONSULTÓ Y QUÉ NO (REG-345).
                      *
                      * `seleccion.ts` construye estos avisos con una regla
                      * explícita: un proveedor no operativo BAJA en el orden
                      * pero **no desaparece** — el médico tiene que poder leer
                      * «UpToDate: no se consultó». El servidor los calculaba, los
                      * mandaba por el cable en `meta.recuperacion.avisos`, la
                      * pantalla los tipaba… y no los pintaba en ningún sitio.
                      *
                      * O sea: la honestidad estaba escrita, probada y sin llegar.
                      * Un consultor que sólo enseña lo que SÍ encontró se lee
                      * como si hubiera mirado en todas partes.
                      */}
                    {!t.cargando && !!t.recuperacion?.avisos?.length && (
                      <details style={{ marginBottom: 10 }}>
                        <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--text3)', listStyle: 'revert' }}>
                          Qué se consultó para responder ({t.recuperacion.avisos.length})
                        </summary>
                        <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
                          {t.recuperacion.avisos.map((a, i) => <li key={i}>{a}</li>)}
                        </ul>
                      </details>
                    )}
                    <MiniMarkdown texto={t.respuesta} />
                    {/*
                      LA VERIFICACIÓN CORRE SIEMPRE, TAMBIÉN SIN ARTÍCULOS.
                      Estaba condicionada a `articulos.length > 0`, así que en la
                      rama sin evidencia —justo la del fallo de PubMed— cualquier
                      «[1]» del modelo se pintaba con estilo de cita, sin lista de
                      fuentes y sin una sola advertencia. Con cero artículos, toda
                      cita está fuera de rango por definición: eso es lo que dice.
                    */}
                    {!t.cargando && t.respuesta && (() => {
                      const citadas = citasEnTexto(t.respuesta)
                      if (citadas.length === 0) return null
                      const fuera = citadas.filter(n => n < 1 || n > t.articulos.length)
                      const ok = fuera.length === 0
                      return (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, marginRight: 6, fontSize: 11, fontWeight: 600, borderRadius: 8, padding: '4px 9px', color: ok ? '#16a34a' : '#b45309', background: ok ? 'color-mix(in srgb, var(--green) 10%, transparent)' : 'color-mix(in srgb, var(--amber) 10%, transparent)', border: `1px solid ${ok ? 'color-mix(in srgb, var(--green) 30%, transparent)' : 'color-mix(in srgb, var(--amber) 30%, transparent)'}` }}>
                          {ok
                            ? `✓ ${citadas.length} cita${citadas.length === 1 ? '' : 's'} verificada${citadas.length === 1 ? '' : 's'} contra las fuentes`
                            : t.articulos.length === 0
                              ? `⚠ ${fuera.length} cita${fuera.length === 1 ? '' : 's'} sin fuente: no hay artículos contra los que comprobarlas`
                              : `⚠ ${fuera.length} cita${fuera.length === 1 ? '' : 's'} fuera de rango`}
                        </div>
                      )
                    })()}
                    {t.modelos && t.modelos.length > 0 && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 11, fontWeight: 600, color: 'var(--text3)', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 9px' }}>
                        <Sparkles size={12} style={{ color: 'var(--teal)' }} /> Razonado por {t.modelos.join(' + ')}
                      </div>
                    )}
                    {t.cenetecUrl && (
                      <a href={t.cenetecUrl} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 12, fontWeight: 600, color: 'var(--nexus)', textDecoration: 'none', background: 'rgba(61,90,254,0.08)', border: '1px solid rgba(61,90,254,0.28)', borderRadius: 8, padding: '5px 10px' }}>
                        <BookOpen size={12} /> Buscar la guía mexicana (GPC · CENETEC)
                      </a>
                    )}
                    {t.articulos.length > 0 && (
                      <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', marginBottom: 6, flexWrap: 'wrap' }}>
                          <BookOpen size={13} /> Fuentes ({t.articulos.length})
                          {t.fechaBusqueda && <span style={{ fontWeight: 500 }}>· PubMed, búsqueda del {t.fechaBusqueda}</span>}
                        </div>
                        {t.articulos.map((a, k) => {
                          const citada = citasEnTexto(t.respuesta).includes(k + 1)
                          const nivel = nivelEvidencia(a.tipo)
                          return (
                          <div key={a.pmid} style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 5, lineHeight: 1.45 }}>
                            <div>
                              [{k + 1}] {a.tipo && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--teal)', background: 'color-mix(in srgb, var(--nexus) 12%, transparent)', borderRadius: 5, padding: '1px 6px', marginRight: 4 }}>{a.tipo}</span>}<a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal)', textDecoration: 'none' }}>{a.titulo}</a> · <span style={{ fontStyle: 'italic' }}>{a.revista}</span> {a.anio}
                              {citada && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: 'var(--green)', background: 'color-mix(in srgb, var(--green) 12%, transparent)', borderRadius: 5, padding: '1px 6px' }}>✓ citado</span>}
                            </div>
                            <div style={{ fontSize: 10.5, color: 'var(--text3)', opacity: 0.85, marginTop: 1, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {nivel && <span style={{ fontWeight: 700, color: nivel.color }}>{nivel.label}</span>}
                              <span>PMID {a.pmid}</span>
                              {a.doi && <a href={`https://doi.org/${a.doi}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal)', textDecoration: 'none' }}>DOI: {a.doi}</a>}
                            </div>
                          </div>
                        )})}
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
            // Es la acción primaria de la pantalla y era un icono sin nombre.
            aria-label={cargando ? 'Consultando la evidencia…' : 'Enviar la pregunta'}
            style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 12, border: 'none', cursor: cargando || !pregunta.trim() ? 'default' : 'pointer', background: cargando || !pregunta.trim() ? 'var(--s3)' : 'var(--nexus-solido)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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