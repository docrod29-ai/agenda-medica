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
      {/*
        EL RÓTULO NO SOBREVIVE AL FALLO.

        Medido con PubMed sin responder: el bloque enseñaba el aviso de error y
        ENCIMA seguía puesto el distintivo «PubMed real» —`rgb(42,165,181)`,
        medido— y el párrafo seguía prometiendo, en presente, que «cada PMID es
        real y verificable». Un sello de garantía sobre una garantía que
        acababa de fallar delante de quien lo lee.

        Es la misma regla que el resto del producto: nada afirma lo que no pudo
        comprobar. Aquí el sello sólo se pone cuando de verdad volvieron
        artículos, y la promesa se escribe en el tiempo verbal que le toca.
      */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <BookOpen size={16} style={{ color: 'var(--nexus)' }} />
        <strong style={{ fontSize: 14 }}>Pasos 8-9 en vivo — recuperación y verificación de PMID</strong>
        {estado === 'ok' && (
          <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.02em', padding: '2px 8px', borderRadius: 'var(--r-pill)', background: 'var(--nexus-soft)', color: 'var(--nexus)' }}>PubMed real</span>
        )}
      </div>
      <p style={{ fontSize: 12, color: 'var(--text3)', margin: '0 0 12px', lineHeight: 1.5 }}>
        {estado === 'ok' ? (
          <>Esto se consultó a PubMed <b>al abrir esta página</b>, para el caso de arriba
          (AINE + IECA + ERC). Cada PMID es real: haz clic y abre la ficha en
          pubmed.ncbi.nlm.nih.gov.</>
        ) : (
          <>Al abrir esta página se consulta a PubMed <b>de verdad</b> para el caso de arriba
          (AINE + IECA + ERC), y se enseña lo que conteste — sin rellenar el hueco
          con nada.</>
        )}
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
                      {/* El fondo era `rgba(13,148,136,.12)` —el verde azulado viejo— bajo un
                          texto que ya salía del token. Medido: texto `rgb(42,165,181)` sobre
                          un tinte `rgb(13,148,136)`. Pasaba el contraste, así que axe callaba;
                          lo que se veía era un distintivo de otro tono que el resto de la
                          página. Es la pareja partida otra vez, en un archivo que el guardián
                          no vigilaba. */}
                      {a.tipo && <span style={{ fontWeight: 700, color: 'var(--nexus)', background: 'var(--nexus-soft)', padding: '1px 7px', borderRadius: 'var(--r-pill)' }}>{a.tipo}</span>}
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
        <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid color-mix(in srgb, var(--amber) 42%, transparent)', background: 'color-mix(in srgb, var(--amber) var(--tinte), var(--s1))', borderRadius: 10, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
            <AlertTriangle size={15} aria-hidden="true" style={{ color: 'var(--amber-texto)', flexShrink: 0, marginTop: 1 }} />
            <span>
              <b style={{ color: 'var(--amber-texto)' }}>PubMed no contestó.</b>{' '}
              {msg || 'No se pudo recuperar evidencia en vivo.'} No se rellena con
              artículos de ejemplo: lo que no se pudo recuperar, no se enseña.
            </span>
          </div>
          <button onClick={cargar} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 8, padding: '7px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <RefreshCw size={13} /> Reintentar
          </button>
        </div>
      )}
    </div>
  )
}
