'use client'
/**
 * Fotografía clínica seriada del paciente: toma/sube foto en cada consulta,
 * la etiqueta por región anatómica y permite COMPARAR dos fechas lado a lado.
 * Sirve para dermatología (lesiones, nevos, psoriasis) y para el seguimiento de
 * heridas quirúrgicas / úlceras.
 */
import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/context/ToastContext'
import { Camera, Loader2, Trash2, GitCompare, X } from 'lucide-react'
import { subirImagen } from '@/lib/subir-imagen'
import {
  crearFoto, getFotos, deleteFoto, agruparPorRegion, parAntesDespues, diasEntre,
  REGIONES, REGIONES_AGRUPADAS, type FotoClinica,
} from '@/lib/expediente/fotos-clinicas'

interface Props {
  clinicId: string
  patientId: string
  /** Si se toma durante una consulta, liga la foto a esa nota. */
  notaId?: string
  /**
   * 'captura'  → en la CONSULTA: tomar la foto (que es cuando tienes al paciente
   *              enfrente) y ver las últimas tomas como referencia.
   * 'completo' → en el EXPEDIENTE: la serie agrupada por región con el
   *              antes/después y los días de evolución.
   */
  modo?: 'captura' | 'completo'
  /** Dentro de la barra de herramientas: sin título propio. */
  embebido?: boolean
}

export function FotosClinicas({ clinicId, patientId, notaId, modo = 'completo', embebido }: Props) {
  const { confirm } = useToast()
  const [fotos, setFotos] = useState<FotoClinica[]>([])
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')
  const [region, setRegion] = useState(REGIONES[0])
  const [descripcion, setDescripcion] = useState('')
  const [comparar, setComparar] = useState<{ a: FotoClinica; b: FotoClinica } | null>(null)

  const cargar = useCallback(async () => {
    if (!clinicId || !patientId) return
    setCargando(true)
    try { setFotos(await getFotos(clinicId, patientId)) }
    catch (e) { setError('No se pudieron cargar las fotos: ' + (e instanceof Error ? e.message : String(e))) }
    finally { setCargando(false) }
  }, [clinicId, patientId])

  useEffect(() => { cargar() }, [cargar])

  const onArchivo = async (file: File) => {
    setSubiendo(true); setError('')
    try {
      const dataUrl = await new Promise<string>((res, rej) => {
        const fr = new FileReader()
        fr.onload = () => res(String(fr.result)); fr.onerror = () => rej(new Error('lectura'))
        fr.readAsDataURL(file)
      })
      const url = await subirImagen(dataUrl, `fotos/${patientId}/${Date.now()}`)
      if (!url) throw new Error('Storage no devolvió URL')
      await crearFoto(clinicId, patientId, {
        url, fecha: new Date().toISOString(), region,
        ...(descripcion.trim() ? { descripcion: descripcion.trim() } : {}),
        ...(notaId ? { notaId } : {}),
      })
      setDescripcion('')
      await cargar()
    } catch (e) {
      setError('No se pudo guardar la foto: ' + (e instanceof Error ? e.message : String(e)))
    } finally { setSubiendo(false) }
  }

  const borrar = async (f: FotoClinica) => {
    // confirm in-app: el nativo se ignora en silencio en la PWA instalada.
    if (!(await confirm('¿Eliminar esta foto del expediente?', { peligro: true, confirmar: 'Eliminar' }))) return
    try { await deleteFoto(clinicId, patientId, f.id); await cargar() }
    catch (e) { setError('No se pudo eliminar: ' + (e instanceof Error ? e.message : String(e))) }
  }

  const grupos = agruparPorRegion(fotos)
  const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {!embebido && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Camera size={17} color="var(--teal)" />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Fotografía clínica seriada</span>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>({fotos.length})</span>
        </div>
      )}

      {/* Captura */}
      <div style={{ border: '1px dashed var(--border)', borderRadius: 12, padding: 14, background: 'var(--s1)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={rotulo}>1 · Zona anatómica</span>
            <select value={region} onChange={e => setRegion(e.target.value)} style={{ ...input, width: '100%' }}>
              {REGIONES_AGRUPADAS.map(g => (
                <optgroup key={g.grupo} label={g.grupo}>
                  {g.regiones.map(r => <option key={r} value={r}>{r}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={rotulo}>2 · Hallazgo <span style={{ fontWeight: 400 }}>(opcional)</span></span>
            <input value={descripcion} onChange={e => setDescripcion(e.target.value)}
              placeholder="p. ej. placa eritematosa de 3 cm"
              style={{ ...input, width: '100%' }} />
          </label>
          <span style={rotulo}>3 · Captura</span>
        </div>
        <label style={{ ...cta, opacity: subiendo ? 0.6 : 1, cursor: subiendo ? 'wait' : 'pointer' }}>
          {subiendo ? <><Loader2 size={16} className="spin" /> Guardando…</> : <><Camera size={16} /> Tomar / subir foto</>}
          <input type="file" accept="image/*" capture="environment" disabled={subiendo} style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) onArchivo(f); e.target.value = '' }} />
        </label>
        <p style={{ fontSize: 10.5, color: 'var(--text3)', margin: '8px 0 0', lineHeight: 1.5 }}>
          Toma la foto siempre de la <b>misma zona, distancia y luz</b> para que la comparación sea válida.
          Requiere consentimiento del paciente (dato personal sensible).
        </p>
      </div>

      {error && <div style={{ ...caja, borderColor: 'rgba(239,68,68,.4)', background: 'rgba(239,68,68,.08)', color: 'var(--red)' }}>{error}</div>}
      {cargando && <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>Cargando fotos…</div>}
      {!cargando && fotos.length === 0 && (
        <div style={{ ...caja, color: 'var(--text3)' }}>Sin fotos aún. La primera toma es la línea base del seguimiento.</div>
      )}

      {/* En la CONSULTA basta una tira de las últimas tomas como referencia para
          encuadrar igual; la serie completa vive en el expediente. */}
      {modo === 'captura' && fotos.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>
            Últimas tomas — la serie completa y el antes/después están en el expediente
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {fotos.slice(0, 6).map(f => (
              <div key={f.id} style={{ minWidth: 96, maxWidth: 96 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt={`${f.region} ${fechaCorta(f.fecha)}`}
                  style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 9, border: '1px solid var(--border)', display: 'block' }} />
                <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 3 }}>{f.region}</div>
                <div style={{ fontSize: 9.5, color: 'var(--text3)' }}>{fechaCorta(f.fecha)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Galería agrupada por región (expediente) */}
      {modo === 'completo' && grupos.map(g => {
        const par = parAntesDespues(g.fotos)
        return (
          <div key={g.region}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{g.region}</span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>{g.fotos.length} foto(s)</span>
              {par && (
                <button type="button" onClick={() => setComparar({ a: par.antes, b: par.despues })}
                  style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(20,184,166,.12)', color: 'var(--teal)', border: '1px solid rgba(20,184,166,.35)', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  <GitCompare size={13} /> Comparar antes/después
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {g.fotos.map(f => (
                <div key={f.id} style={{ minWidth: 130, maxWidth: 130 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt={`${g.region} ${fechaCorta(f.fecha)}`}
                    style={{ width: 130, height: 130, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)', display: 'block' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <span style={{ fontSize: 10.5, color: 'var(--text2)', flex: 1 }}>{fechaCorta(f.fecha)}</span>
                    <button type="button" onClick={() => borrar(f)} aria-label="Eliminar"
                      style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: 2 }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                  {f.descripcion && <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.4 }}>{f.descripcion}</div>}
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Comparación lado a lado */}
      {modo === 'completo' && comparar && (
        <div style={{ border: '1px solid rgba(20,184,166,.35)', borderRadius: 12, padding: 14, background: 'rgba(20,184,166,.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <GitCompare size={15} color="var(--teal)" />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--teal)' }}>
              {comparar.a.region} · {diasEntre(comparar.a, comparar.b)} días de evolución
            </span>
            <button type="button" onClick={() => setComparar(null)} aria-label="Cerrar"
              style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[{ f: comparar.a, t: 'Antes' }, { f: comparar.b, t: 'Después' }].map(({ f, t }) => (
              <div key={t}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>{t} · {fechaCorta(f.fecha)}</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt={t} style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border)', display: 'block' }} />
                {f.descripcion && <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 4, lineHeight: 1.4 }}>{f.descripcion}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const input: React.CSSProperties = { background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 12.5, color: 'var(--text)', outline: 'none' }
const rotulo: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', letterSpacing: 0.3 }
const cta: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--nexus)', color: '#fff', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600 }
const caja: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 12.5, lineHeight: 1.5 }
