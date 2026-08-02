'use client'
// ══════════════════════════════════════════════════════════════
// RESUMEN DEL PASE y LÍNEA DE TIEMPO — charter §30, §33, §35 y §36.
//
// Los motores ya existían y estaban probados; lo que faltaba era que se vieran.
// Aquí NO se calcula nada: se lee del expediente, se pasa por los motores puros
// y se pinta. Cualquier regla que apareciera en este archivo estaría fuera del
// golden, y por eso no hay ninguna.
// ══════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from 'react'
import { Clock, Sunrise, Target, ClipboardList, AlertTriangle } from 'lucide-react'
import { getTomas, serieTomas } from '@/lib/uci/observaciones'
import type { TomaUci } from '@/lib/uci/observaciones'
import { cambiosDeTomas, eventosDeTomas, clavesSinMetrica } from '@/lib/uci/resumen'
import { construirBrief, PENDIENTES_NO_DISPONIBLES } from '@/lib/uci/morning-brief'
import { SIN_METAS_FIJADAS } from '@/lib/uci/metas-diarias'
import { unirLinea, porHora } from '@/lib/uci/linea-tiempo'
import { construirHandoff, loQueFaltaDelMedico } from '@/lib/uci/handoff'
import { Spinner } from '@/components/ui'
import type { SoporteActivo } from '@/types/hospital'

/** Ventana del brief. Se declara en pantalla: un delta sin ventana no se audita. */
const VENTANA_HORAS = 12

const COLOR_VEREDICTO: Record<string, string> = {
  mejoro: '#0d9488', empeoro: '#dc2626', sin_cambio: 'var(--text3)', sin_veredicto: '#d97706',
}

function Bloque({ icon: Icon, titulo, sub, children }: {
  icon: typeof Clock; titulo: string; sub?: string; children: React.ReactNode
}) {
  return (
    <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <Icon size={16} style={{ color: 'var(--nexus,#3d5afe)' }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>{titulo}</span>
        {sub && <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>· {sub}</span>}
      </div>
      {children}
    </div>
  )
}

const Nota = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 12, lineHeight: 1.55, color: 'var(--text3)' }}>
    <AlertTriangle size={13} style={{ color: '#d97706', flexShrink: 0, marginTop: 2 }} />
    <div>{children}</div>
  </div>
)

export default function ResumenPase({ clinicId, internamientoId, vista, zonaHoraria, soportes, cama, diaUci, diaVm }: {
  clinicId: string
  internamientoId: string
  vista: 'resumen' | 'linea'
  zonaHoraria: string
  soportes: SoporteActivo[]
  cama: string | null
  diaUci: number | null
  diaVm: number | null
}) {
  const [tomas, setTomas] = useState<TomaUci[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let vivo = true
    setTomas(null); setError('')
    getTomas(clinicId, internamientoId)
      .then(t => { if (vivo) setTomas(serieTomas(t)) })
      .catch(() => { if (vivo) { setTomas([]); setError('No se pudieron leer las tomas del expediente.') } })
    return () => { vivo = false }
  }, [clinicId, internamientoId])

  // El instante se congela al montar: si se recalculara en cada render, la
  // ventana se movería bajo los pies del médico mientras lee.
  const ahora = useMemo(() => new Date().toISOString(), [clinicId, internamientoId])

  const { brief, conUnSoloPunto, sinMapear } = useMemo(() => {
    if (!tomas) return { brief: null, conUnSoloPunto: [] as string[], sinMapear: [] as string[] }
    const { cambios, conUnSoloPunto } = cambiosDeTomas(tomas, VENTANA_HORAS, ahora)
    return { brief: construirBrief(cambios, VENTANA_HORAS), conUnSoloPunto, sinMapear: clavesSinMetrica(tomas) }
  }, [tomas, ahora])

  const tramos = useMemo(() => {
    if (!tomas) return []
    const { linea } = unirLinea(eventosDeTomas(tomas))
    const hora = (iso: string) => new Intl.DateTimeFormat('es-MX', {
      timeZone: zonaHoraria, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso))
    return porHora(linea, hora)
  }, [tomas, zonaHoraria])

  const handoff = useMemo(() => {
    if (!brief) return null
    /**
     * `pendientes` y `dispositivos` NO tienen quién los alimente todavía: no
     * existe ninguna función que los produzca. Se declaran como SIN FUENTE para
     * que la tarjeta diga «el sistema no lo sabe» en vez de afirmar «no hay
     * dispositivos invasivos registrados» en un paciente con catéter y
     * ventilador — que en una entrega de turno se lee como una afirmación
     * clínica de quien entrega.
     */
    return construirHandoff({
      pacienteId: internamientoId, generadoEn: ahora,
      cama, diaUci, diaVm, soportes,
      cambios: brief.cambios.map(c => c.texto),
    }, ['pendientes', 'dispositivos'])
  }, [brief, ahora, cama, diaUci, diaVm, soportes, internamientoId])

  if (tomas === null) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
  }

  if (vista === 'linea') {
    return (
      <Bloque icon={Clock} titulo="Línea de tiempo" sub={`horas en ${zonaHoraria}`}>
        {error && <Nota>{error}</Nota>}
        {tramos.length === 0 ? (
          <Nota>
            No hay ningún cambio registrado todavía. Un valor repetido no genera evento:
            llenaría la línea de ruido y escondería lo que sí se movió.
          </Nota>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tramos.map(t => (
              <div key={t.hora} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', minWidth: 118, paddingTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                  {t.hora}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                  {t.eventos.map((e, i) => (
                    <div key={i} style={{ fontSize: 12.5, display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ color: 'var(--text2)' }}>{e.etiqueta}</span>
                      <strong style={{ color: e.direccion === 'sube' ? '#d97706' : 'var(--text)' }}>
                        {e.direccion === 'sube' ? '↑' : '↓'} {String(e.valor)}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Bloque>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Bloque icon={Sunrise} titulo="Morning Brief" sub={`últimas ${VENTANA_HORAS} h`}>
        {error && <Nota>{error}</Nota>}
        {brief && brief.cambios.length === 0 ? (
          <Nota>
            No hay cambios que mostrar en la ventana.
            {conUnSoloPunto.length > 0 && <> Con una sola lectura de {conUnSoloPunto.join(', ')} no se
            puede calcular un delta, y fabricarlo contra sí mismo diría «sin cambio» donde lo que
            hay es falta de comparación.</>}
          </Nota>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {brief!.cambios.map(c => (
              <div key={c.clave} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13 }}>{c.texto}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: COLOR_VEREDICTO[c.veredicto] }}>
                  {c.veredicto === 'sin_veredicto' ? 'sin veredicto' : c.veredicto.replace('_', ' ')}
                </span>
              </div>
            ))}
            {brief!.sinVeredicto.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <Nota>
                  Sin veredicto en {brief!.sinVeredicto.join(', ')}: el delta es un hecho, pero
                  llamarlo mejoría o empeoramiento exige una dirección de beneficio declarada, y
                  para esas métricas no lo está.
                </Nota>
              </div>
            )}
          </div>
        )}
        {sinMapear.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <Nota>Medidas capturadas que aún no llegan a ninguna métrica del brief: {sinMapear.join(', ')}.</Nota>
          </div>
        )}
      </Bloque>

      <Bloque icon={Target} titulo="Metas del día">
        <Nota>{SIN_METAS_FIJADAS}</Nota>
        <div style={{ marginTop: 8 }}>
          <Nota>{PENDIENTES_NO_DISPONIBLES}</Nota>
        </div>
      </Bloque>

      {handoff && (
        <Bloque icon={ClipboardList} titulo="Entrega de turno" sub={handoff.estado === 'BORRADOR' ? 'BORRADOR — sin revisar' : 'revisado'}>
          <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.6 }}>
            {handoff.cambios.length > 0
              ? <div style={{ marginBottom: 8 }}>{handoff.cambios.map((c, i) => <div key={i}>· {c}</div>)}</div>
              : null}
          </div>
          <Nota>
            Lo redacta el médico antes de entregar: <strong>{loQueFaltaDelMedico(handoff).join(' y ')}</strong>.
            La lista de problemas es una síntesis clínica, no un volcado de diagnósticos; y
            «si la MAP baja de X, hacer Y» es un plan terapéutico que el sistema no propone.
          </Nota>
          {handoff.ausentes.filter(a => !['problemas activos', 'contingencias'].includes(a.seccion)).map(a => (
            <div key={a.seccion} style={{ marginTop: 8 }}><Nota>{a.motivo}</Nota></div>
          ))}
        </Bloque>
      )}
    </div>
  )
}
