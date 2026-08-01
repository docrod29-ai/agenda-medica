'use client'
/**
 * OBSERVACIÓN DE LA CSP — la pantalla que faltaba para poder terminarla.
 *
 * La política de seguridad de contenido va en modo AVISO: no bloquea, sólo
 * reporta. Pasar a bloquear de verdad exige saber antes QUÉ se estaría
 * bloqueando, o se rompen pantallas legítimas de golpe y con un paciente
 * enfrente.
 *
 * Ese dato existía y se tiraba: los reportes iban a un log del servidor que
 * nadie lee y que además caduca. Aquí están acumulados, agrupados y ordenados
 * por frecuencia — que es el orden en que hay que resolverlos.
 *
 * Sólo lectura. La decisión de bloquear se toma cambiando `CSP_MODE=enforce` en
 * el entorno, a mano y a sabiendas; esta pantalla dice si ya toca.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { fetchAutenticado } from '@/lib/auth-client'
import { ArrowLeft, ShieldCheck, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'

interface Grupo { directiva: string; bloqueado: string; pagina: string; dia: string; veces: number; ultimaVez: string }
interface Estado {
  ok: boolean
  modo: 'aviso' | 'enforce'
  diasObservados: number
  diasMinimos: number
  violacionesRecientes: number
  grupos: Grupo[]
  veredicto: { listo: boolean; motivo: string }
}

export default function CspObservacion() {
  const [d, setD] = useState<Estado | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  /**
   * TODO EL `setState` OCURRE EN UNA DEVOLUCIÓN DE LLAMADA, NUNCA EN EL CUERPO.
   *
   * Es la diferencia que marca la regla de React: un `setState` síncrono dentro
   * de un efecto encadena renders; uno dentro de un `.then` es exactamente el
   * caso para el que existen los efectos —sincronizar con un sistema externo—.
   * Por eso el `fetch` vive aquí dentro y no en una función aparte.
   *
   * Refrescar se hace subiendo `recarga`: el botón es un evento del usuario, así
   * que ahí sí se puede tocar el estado, y el efecto vuelve a correr solo.
   *
   * `vivo` corta el aviso si la pantalla se cerró antes de que llegara la
   * respuesta: escribir en un componente desmontado es un aviso en consola y,
   * peor, un estado que ya no le importa a nadie.
   */
  const [recarga, setRecarga] = useState(0)
  useEffect(() => {
    let vivo = true
    fetchAutenticado('/api/superadmin/csp')
      .then(r => r.json())
      .then(x => {
        if (!vivo) return
        if (x.ok) { setD(x); setError('') } else setError(x.error || 'No se pudo leer.')
      })
      // Un fallo de lectura NO puede verse como «no hay violaciones»: eso se
      // leería como luz verde para bloquear, con la información al revés.
      .catch(() => { if (vivo) setError('No se pudo leer la observación.') })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [recarga])

  const refrescar = () => { setCargando(true); setRecarga(n => n + 1) }

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '28px 18px 80px' }}>
      <Link href="/superadmin" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text3)', textDecoration: 'none', fontSize: 13, marginBottom: 14 }}>
        <ArrowLeft size={15} /> Volver a la consola
      </Link>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 9 }}>
        <ShieldCheck size={20} style={{ color: 'var(--teal)' }} /> Política de seguridad de contenido
      </h1>
      <p style={{ fontSize: 12.5, color: 'var(--text3)', margin: '0 0 18px', lineHeight: 1.55, maxWidth: 720 }}>
        Hoy la política <strong>avisa pero no bloquea</strong>. Aquí está todo lo que habría bloqueado,
        para poder decidir con datos antes de encenderla de verdad. Sin datos de pacientes: sólo
        direcciones recortadas a su origen.
      </p>

      {cargando && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text3)', padding: 20 }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Cargando…
        </div>
      )}

      {error && (
        <div style={{ padding: 14, borderRadius: 10, border: '1px solid var(--red)', color: 'var(--red)', fontSize: 13 }}>
          {error} — <button onClick={refrescar} style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', padding: 0, font: 'inherit' }}>reintentar</button>
        </div>
      )}

      {d && !cargando && (
        <>
          {/* El veredicto arriba: es lo único que hay que leer para decidir. */}
          <div style={{
            display: 'flex', gap: 10, alignItems: 'flex-start', padding: '13px 15px', borderRadius: 10, marginBottom: 18,
            border: `1px solid ${d.veredicto.listo ? 'var(--teal)' : 'var(--border)'}`,
            background: d.veredicto.listo ? 'rgba(20,184,166,0.08)' : 'var(--s1)',
          }}>
            {d.veredicto.listo
              ? <CheckCircle2 size={17} style={{ color: 'var(--teal)', flexShrink: 0, marginTop: 1 }} />
              : <AlertTriangle size={17} style={{ color: 'var(--text3)', flexShrink: 0, marginTop: 1 }} />}
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 3 }}>
                {d.modo === 'enforce' ? 'La política YA está bloqueando' : d.veredicto.listo ? 'Se puede pasar a bloquear' : 'Todavía no se puede pasar a bloquear'}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.55 }}>{d.veredicto.motivo}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 20 }}>
            <Dato titulo="Días observando" valor={`${d.diasObservados} / ${d.diasMinimos}`} />
            <Dato titulo="Violaciones (7 días)" valor={String(d.violacionesRecientes)} />
            <Dato titulo="Modo actual" valor={d.modo === 'enforce' ? 'Bloqueando' : 'Sólo avisa'} />
          </div>

          {d.grupos.length === 0 ? (
            <div style={{ padding: 22, textAlign: 'center', color: 'var(--text3)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 10, lineHeight: 1.6 }}>
              Todavía no ha llegado ningún reporte.<br />
              <span style={{ fontSize: 12 }}>
                Puede significar que nada se sale de la política — o que aún no ha navegado nadie
                desde que esto se encendió. Los días observados lo distinguen.
              </span>
            </div>
          ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 620 }}>
                <thead>
                  <tr style={{ background: 'var(--s2)', textAlign: 'left' }}>
                    <th style={th}>Veces</th>
                    <th style={th}>Directiva</th>
                    <th style={th}>Recurso</th>
                    <th style={th}>Pantalla</th>
                    <th style={th}>Día</th>
                  </tr>
                </thead>
                <tbody>
                  {d.grupos.map((g, i) => (
                    <tr key={`${g.directiva}|${g.bloqueado}|${g.dia}|${i}`} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ ...td, fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{g.veces}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{g.directiva}</td>
                      <td style={{ ...td, wordBreak: 'break-all' }}>{g.bloqueado}</td>
                      <td style={{ ...td, wordBreak: 'break-all', color: 'var(--text3)' }}>{g.pagina}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--text3)' }}>{g.dia}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 16, lineHeight: 1.6, maxWidth: 720 }}>
            Para encender el bloqueo: poner <code>CSP_MODE=enforce</code> en Vercel y volver a desplegar.
            Se hace a mano y a sabiendas — nada de aquí lo cambia solo.
          </p>
        </>
      )}
    </div>
  )
}

const th: React.CSSProperties = { padding: '8px 11px', fontWeight: 700, color: 'var(--text3)', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.04em' }
const td: React.CSSProperties = { padding: '8px 11px' }

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>{titulo}</div>
      <div style={{ fontSize: 19, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{valor}</div>
    </div>
  )
}
