'use client'
/**
 * EVIDENCIA EN VIVO — enciende los pasos 8-9 del razonamiento en el demo público.
 *
 * Llama a /api/demo/evidencia, que busca en PubMed DE VERDAD (E-utilities). Muestra
 * los artículos reales con su PMID verificable (clic → pubmed.ncbi.nlm.nih.gov). Si
 * PubMed no responde, lo dice con honestidad y ofrece reintentar — nunca inventa.
 */
import { useState, useEffect, useCallback } from 'react'
import { BookOpen, ExternalLink, Loader2, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react'

interface Art {
  pmid: string
  titulo: string
  revista: string
  anio: string
  tipo: string
  doi: string | null
  url: string
}

type Estado = 'cargando' | 'ok' | 'vacio' | 'error'

export function EvidenciaEnVivo() {
  const [estado, setEstado] = useState<Estado>('cargando')
  const [arts, setArts] = useState<Art[]>([])
  const [msg, setMsg] = useState('')

  const cargar = useCallback(async () => {
    setEstado('cargando'); setMsg('')
    try {
      const r = await fetch('/api/demo/evidencia', { cache: 'no-store' })
      const d = await r.json()
      if (d.ok && Array.isArray(d.articulos) && d.articulos.length > 0) {
        setArts(d.articulos); setEstado('ok')
      } else {
        setMsg(d.error || 'PubMed no devolvió artículos ahora mismo.'); setEstado('vacio')
      }
    } catch (e) {
      setMsg(String(e).slice(0, 120)); setEstado('error')
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--s1, rgba(127,127,127,.03))', padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <BookOpen size={16} style={{ color: 'var(--nexus)' }} />
        <strong style={{ fontSize: 14.5 }}>Pasos 8-9 en vivo — recuperación y verificación de PMID</strong>
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.02em', padding: '2px 8px', borderRadius: 'var(--r-pill)', background: 'rgba(61,90,254,.12)', color: 'var(--nexus)' }}>PubMed real</span>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text3)', margin: '0 0 12px', lineHeight: 1.5 }}>
        Consulta a PubMed <b>en este momento</b> para el caso de arriba (AINE + IECA + ERC). Cada PMID es
        real y verificable: haz clic y abre la ficha en pubmed.ncbi.nlm.nih.gov.
      </p>

      {estado === 'cargando' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text3)', fontSize: 13.5, padding: '10px 0' }}>
          <Loader2 size={15} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Consultando PubMed…
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {estado === 'ok' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--teal)', fontWeight: 700, marginBottom: 8 }}>
            <CheckCircle2 size={14} /> {arts.length} artículos recuperados y verificados
          </div>
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
            {arts.map((a, i) => (
              <li key={a.pmid} style={{ border: '1px solid var(--border)', borderRadius: 9, background: 'var(--bg)', padding: '10px 12px' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, color: 'var(--text)' }}>{a.titulo}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 5, fontSize: 11.5, color: 'var(--text3)' }}>
                      {a.tipo && <span style={{ fontWeight: 700, color: 'var(--teal)', background: 'rgba(13,148,136,.12)', padding: '1px 7px', borderRadius: 'var(--r-pill)' }}>{a.tipo}</span>}
                      <span>{a.revista} · {a.anio}</span>
                      <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--nexus)', textDecoration: 'none', fontWeight: 700 }}>
                        PMID {a.pmid} <ExternalLink size={11} />
                      </a>
                      {a.doi && <span style={{ color: 'var(--text3)' }}>doi:{a.doi}</span>}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}

      {(estado === 'vacio' || estado === 'error') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--amber)' }}>
            <AlertTriangle size={15} /> {msg || 'No se pudo recuperar evidencia en vivo.'}
          </div>
          <button onClick={cargar} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 8, padding: '7px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <RefreshCw size={13} /> Reintentar
          </button>
        </div>
      )}
    </div>
  )
}
