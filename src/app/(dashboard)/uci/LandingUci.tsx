'use client'
// ══════════════════════════════════════════════════════════════
// LANDING DE UCI — charter §3.
//
// Tarjeta por paciente de terapia intensiva, ordenada por LO QUE HAY QUE MIRAR
// PRIMERO: el que no tiene ninguna toma, luego el de toma más antigua. Ordenar
// por número de cama escondería justo a ese.
//
// Toda la lógica vive en `@/lib/uci/tarjetas` (puro y con golden). Aquí sólo se
// leen los datos y se pintan.
// ══════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, BedDouble, AlertTriangle, Clock, Wrench, UserPlus } from 'lucide-react'
import { useClinic } from '@/context/ClinicContext'
import { useConfig } from '@/hooks/useConfig'
import { suscribirCenso } from '@/lib/hospital/firestore'
import { getTomas, serieTomas } from '@/lib/uci/observaciones'
import { construirTarjeta, ordenarTarjetas, type TarjetaUci } from '@/lib/uci/tarjetas'
import { Spinner } from '@/components/ui'
import { SOPORTE_LABEL, type Internamiento } from '@/types/hospital'

/**
 * Ventana de lectura por paciente. NO es el tope de la ficha (200): esta
 * pantalla abre N pacientes a la vez y bajar 200 documentos por cada uno fue la
 * causa real de la lentitud de la agenda. 30 basta para resolver correcciones
 * recientes y saber cuándo fue la última toma.
 */
const TOPE_LANDING = 30

const botonBase: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 9,
  padding: '9px 15px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
}
const botonPrimario: React.CSSProperties = {
  ...botonBase, background: 'var(--nexus,#3d5afe)', border: '1px solid transparent', color: '#fff',
}
const botonSecundario: React.CSSProperties = {
  ...botonBase, background: 'none', border: '1px solid var(--border)', color: 'var(--text2)',
}

const esUci = (i: Internamiento) => /uci|intensiv/i.test(i.servicio ?? '')

function tiempo(horas: number | null): string {
  if (horas === null) return 'sin tomas'
  if (horas < 1) return `hace ${Math.round(horas * 60)} min`
  if (horas < 48) return `hace ${horas.toFixed(1)} h`
  return `hace ${Math.floor(horas / 24)} d`
}

export default function LandingUci({ alPanelLibre }: { alPanelLibre: () => void }) {
  const router = useRouter()
  const { clinicId } = useClinic()
  // La zona horaria es la de la UNIDAD, nunca la del navegador: el mismo
  // paciente debe estar en el mismo día de UCI para quien pasa visita y para
  // quien lo consulta desde otro huso.
  const { config } = useConfig()
  const tz = config.zonaHoraria || 'America/Mexico_City'
  const [tarjetas, setTarjetas] = useState<TarjetaUci[] | null>(null)

  useEffect(() => {
    if (!clinicId) return
    let vivo = true
    const off = suscribirCenso(clinicId, async censo => {
      const uci = censo.filter(esUci)
      const ahora = new Date().toISOString()
      const armadas = await Promise.all(uci.map(async i => {
        // Si la subcolección falla (permisos, red), la tarjeta sale igual y el
        // hueco se declara: es mejor que desaparecer al paciente de la lista.
        const tomas = await getTomas(clinicId, i.id, TOPE_LANDING).catch(() => [])
        const vigentes = serieTomas(tomas)
        const ultima = vigentes.length > 0 ? vigentes[vigentes.length - 1] : undefined
        return construirTarjeta({
          internamientoId: i.id,
          pacienteNombre: i.pacienteNombre,
          cama: i.cama,
          servicio: i.servicio,
          dxIngreso: i.diagnosticoIngreso,
          ingresoEn: i.fechaIngreso,
          unitTimezone: tz,
          // Los soportes salen de la estancia UCI cuando exista (ICUStay). NO se
          // deducen de las mediciones: que haya PEEP anotada no prueba que siga
          // ventilado. Mientras tanto, la tarjeta declara el hueco.
          soportes: [],
          ultimaTomaEn: ultima?.medidoEn ?? null,
          ultimaTomaPor: ultima?.por ?? null,
          ultimaTomaFuente: ultima?.fuente ?? null,
        }, ahora)
      }))
      if (vivo) setTarjetas(ordenarTarjetas(armadas))
    })
    return () => { vivo = false; off?.() }
  }, [clinicId, tz])

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '8px 4px 40px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Activity size={22} style={{ color: 'var(--nexus,#3d5afe)' }} /> Terapia intensiva
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text3)', margin: '0 0 20px' }}>
        Ordenado por antigüedad de la última toma: arriba, de quien hace más rato que no se anota nada.
      </p>

      {tarjetas === null ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
      ) : tarjetas.length === 0 ? (
        <div style={{ padding: 28, textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>
            No hay pacientes activos en UCI / Terapia Intensiva en el censo.
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => router.push('/hospitalizacion?nuevo=1&servicio=UCI')} style={botonPrimario}>
              <UserPlus size={14} /> Ingresar paciente a UCI
            </button>
            <button onClick={alPanelLibre} style={botonSecundario}>
              <Wrench size={14} /> Abrir herramientas rápidas
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {tarjetas.map(t => {
            const alerta = t.horasDesdeUltimaToma === null
            return (
              <div
                key={t.internamientoId}
                onClick={() => router.push(`/uci?internamiento=${t.internamientoId}`)}
                style={{
                  padding: 14, borderRadius: 12, cursor: 'pointer',
                  border: `1px solid ${alerta ? 'rgba(220,38,38,0.45)' : 'var(--border)'}`,
                  background: alerta ? 'rgba(220,38,38,0.06)' : 'var(--s2)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.pacienteNombre}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', flexShrink: 0 }}>
                    {t.estancia?.etiqueta.replace(' de estancia', '') ?? 'Sin fecha de ingreso'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, color: 'var(--text2)' }}>
                  <BedDouble size={13} style={{ flexShrink: 0 }} />
                  {t.cama ?? <span style={{ color: '#d97706' }}>sin cama</span>}
                </div>
                {t.dxIngreso && (
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.dxIngreso}
                  </div>
                )}
                {t.soportes.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                    {t.soportes.map(sp => (
                      <span key={sp} style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 5, background: 'rgba(61,90,254,0.12)', color: 'var(--nexus,#3d5afe)' }}>
                        {SOPORTE_LABEL[sp]}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, fontWeight: 600, color: alerta ? '#dc2626' : 'var(--text2)' }}>
                  <Clock size={13} style={{ flexShrink: 0 }} />
                  Última toma {tiempo(t.horasDesdeUltimaToma)}
                </div>
                {t.avisos.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 8, fontSize: 11.5, lineHeight: 1.5, color: 'var(--text3)' }}>
                    <AlertTriangle size={13} style={{ color: '#d97706', flexShrink: 0, marginTop: 2 }} />
                    <div>{t.avisos.join(' ')}</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {tarjetas !== null && tarjetas.length > 0 && (
        <button onClick={alPanelLibre} style={{ ...botonSecundario, marginTop: 22 }}>
          <Wrench size={14} /> Herramientas UCI · panel fisiológico
        </button>
      )}
    </div>
  )
}
