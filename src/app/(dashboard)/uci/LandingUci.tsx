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
import { activable } from '@/lib/ui/activable'
import { useRouter } from 'next/navigation'
import { Activity, BedDouble, AlertTriangle, Clock, Wrench, UserPlus, HeartPulse, BarChart3, Pill, ClipboardCheck } from 'lucide-react'
import { useClinic } from '@/context/ClinicContext'
import { useConfig } from '@/hooks/useConfig'
import { suscribirCenso, getUnidades } from '@/lib/hospital/firestore'
import { esCritica, sinTipoConfigurado, AVISO_SIN_TIPO, type Unidad } from '@/lib/hospital/unidades'
import { getTomas, serieTomas } from '@/lib/uci/observaciones'
import { getEstanciaUci } from '@/lib/uci/estancia-cliente'
import { construirTarjeta, ordenarTarjetas, type TarjetaUci , type SeccionNoLeida } from '@/lib/uci/tarjetas'
import { Spinner } from '@/components/ui'
import { SOPORTE_LABEL, type Internamiento, type SoporteActivo } from '@/types/hospital'

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
  ...botonBase, background: 'var(--nexus-solido)', border: '1px solid transparent', color: '#fff',
}
const botonSecundario: React.CSSProperties = {
  ...botonBase, background: 'none', border: '1px solid var(--border)', color: 'var(--text2)',
}

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
  // El TIPO de unidad decide quién es paciente crítico. NUNCA el nombre: un
  // hospital que llame a su unidad «UTI» o «5º Norte» perdía a sus pacientes de
  // esta pantalla, sin error y sin aviso.
  const [unidades, setUnidades] = useState<Unidad[] | null>(null)
  const [sinTipo, setSinTipo] = useState<string[]>([])
  useEffect(() => {
    if (!clinicId) return
    let vivo = true
    getUnidades(clinicId).then(u => { if (vivo) setUnidades(u) }).catch(() => { if (vivo) setUnidades([]) })
    return () => { vivo = false }
  }, [clinicId])

  useEffect(() => {
    if (!clinicId || unidades === null) return
    let vivo = true
    const off = suscribirCenso(clinicId, async censo => {
      const uci = censo.filter(i => esCritica(i.servicio, unidades))
      // Un servicio sin tipo NO se descarta en silencio: se declara arriba.
      setSinTipo(sinTipoConfigurado(censo.map(i => i.servicio), unidades))
      const ahora = new Date().toISOString()
      const armadas = await Promise.all(uci.map(async i => {
        /**
         * Si la subcolección falla (permisos, red), la tarjeta sale igual —es
         * mejor que desaparecer al paciente de la lista— pero el fallo se
         * DECLARA. Antes entraba disfrazado de dato: `catch(() => [])` hacía
         * que la tarjeta afirmara «sin ninguna toma registrada» y «no consta
         * ningún soporte» de un paciente monitorizado y ventilado.
         */
        const sinLeer: SeccionNoLeida[] = []
        const [tomas, estancia] = await Promise.all([
          getTomas(clinicId, i.id, TOPE_LANDING).catch(() => { sinLeer.push('tomas'); return [] }),
          getEstanciaUci(clinicId, i.id).catch(() => { sinLeer.push('estancia'); return null }),
        ])
        const vigentes = serieTomas(tomas)
        const ultima = vigentes.length > 0 ? vigentes[vigentes.length - 1] : undefined
        return construirTarjeta({
          internamientoId: i.id,
          pacienteNombre: i.pacienteNombre,
          cama: i.cama,
          servicio: i.servicio,
          dxIngreso: i.diagnosticoIngreso,
          // El día de UCI se cuenta desde el ingreso a la UNIDAD, no al hospital.
          // Antes salía «Día UCI 4» para quien llevaba 3 días en urgencias y
          // ayer subió a terapia. Si no consta la estancia, se declara el hueco
          // en vez de contar desde una fecha que no es.
          ingresoEn: estancia?.fechaIngresoUci ?? '',
          unitTimezone: tz,
          // Los soportes salen de la ESTANCIA (ICUStay), declarados en el panel.
          // NO se deducen de las mediciones: que haya PEEP anotada no prueba que
          // el paciente siga ventilado. Si no hay ninguno, la tarjeta lo declara.
          soportes: (estancia?.soportes ?? []) as SoporteActivo[],
          ultimaTomaEn: ultima?.medidoEn ?? null,
          ultimaTomaPor: ultima?.por ?? null,
          ultimaTomaFuente: ultima?.fuente ?? null,
          sinLeer,
        }, ahora)
      }))
      if (vivo) setTarjetas(ordenarTarjetas(armadas))
    })
    return () => { vivo = false; off?.() }
  }, [clinicId, tz, unidades])

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '8px 4px 40px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Activity size={22} style={{ color: 'var(--nexus,#3d5afe)' }} /> Terapia intensiva
      </h1>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', margin: '0 0 20px' }}>
        <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0, flex: '1 1 320px' }}>
          Ordenado por antigüedad de la última toma: arriba, de quien hace más rato que no se anota nada.
        </p>
        {/* Siempre visible, no sólo cuando la lista está vacía: un ingreso a
            terapia no espera a que la pantalla esté en su estado vacío. */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => router.push('/uci/enfermeria')} style={botonSecundario}>
            <HeartPulse size={14} /> Turno de enfermería
          </button>
          <button onClick={() => router.push('/uci/benchmark')} style={botonSecundario}>
            <BarChart3 size={14} /> Benchmark de voz
          </button>
          <button onClick={() => router.push('/uci/antimicrobianos')} style={botonSecundario}>
            <Pill size={14} /> Antimicrobianos
          </button>
          <button onClick={() => router.push('/uci/dosificacion')} style={botonSecundario}>
            <ClipboardCheck size={14} /> Validar dosis
          </button>
          <button onClick={() => router.push('/hospitalizacion?nuevo=1&servicio=UCI')} style={botonPrimario}>
            <UserPlus size={14} /> Ingresar paciente a UCI
          </button>
        </div>
      </div>

      {sinTipo.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'color-mix(in srgb, var(--amber) 9%, transparent)', border: '1px solid color-mix(in srgb, var(--amber) 40%, transparent)', borderRadius: 12, padding: '13px 15px', margin: '0 0 16px' }}>
          <AlertTriangle size={17} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text)' }}>
            <strong>Servicios sin tipo de unidad: {sinTipo.join(' · ')}.</strong>{' '}
            {AVISO_SIN_TIPO}{' '}
            <button onClick={() => router.push('/hospitalizacion/unidades')} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--nexus,#3d5afe)', cursor: 'pointer', fontSize: 13, fontWeight: 600, textDecoration: 'underline' }}>
              Configurar unidades
            </button>
          </div>
        </div>
      )}

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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', gap: 12 }}>
          {tarjetas.map(t => {
            const alerta = t.horasDesdeUltimaToma === null
            return (
              <div
                key={t.internamientoId}
                {...activable(() => router.push(`/uci?internamiento=${t.internamientoId}`), { etiqueta: 'Abrir el pase de este paciente' })}
                style={{
                  padding: 14, borderRadius: 12, cursor: 'pointer',
                  border: `1px solid ${alerta ? 'color-mix(in srgb, var(--red) 45%, transparent)' : 'var(--border)'}`,
                  background: alerta ? 'color-mix(in srgb, var(--red) 6%, transparent)' : 'var(--s2)',
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
                  {t.cama ?? <span style={{ color: 'var(--amber)' }}>sin cama</span>}
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
                    <AlertTriangle size={13} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 2 }} />
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
