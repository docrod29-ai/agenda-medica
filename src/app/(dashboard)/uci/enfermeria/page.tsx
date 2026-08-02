'use client'
// ══════════════════════════════════════════════════════════════
// TURNO DE ENFERMERÍA DE UCI — charter §40.
//
// Toda la lógica vive en `@/lib/uci/enfermeria` (puro y con golden). Aquí sólo
// se leen los datos y se pintan.
//
// La pantalla DICE su propio límite: ordena por el estado del registro, no por
// gravedad clínica. Un antibiótico atrasado y una vitamina atrasada se ven igual
// desde aquí, y quien la lee tiene que saberlo.
// ══════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, HeartPulse, AlertTriangle, Info, BedDouble, CheckCircle2 } from 'lucide-react'
import { useSmartBack } from '@/hooks/useSmartBack'
import { useClinic } from '@/context/ClinicContext'
import { useConfig } from '@/hooks/useConfig'
import { graciaMar } from '@/lib/uci/gracia'
import { suscribirCenso, getUnidades } from '@/lib/hospital/firestore'
import { getTomas, serieTomas } from '@/lib/uci/observaciones'
import { esCritica, sinTipoConfigurado, AVISO_SIN_TIPO, type Unidad } from '@/lib/hospital/unidades'
import {
  turnoDeEnfermeria, TAREA_LABEL, NO_PRIORIZA_CLINICAMENTE,
  type ResumenEnfermeria, type TipoTarea,
} from '@/lib/uci/enfermeria'
import { Spinner } from '@/components/ui'

/**
 * Gracia del MAR. NO es un valor clínico: es cuántos minutos de margen da esta
 * unidad antes de llamar atrasada a una dosis, y el motor la exige a propósito.
 * Cuando el Dr. la fije, sale de la configuración del hospital.
 */

const TOPE_TOMAS_LISTA = 5

const COLOR: Record<TipoTarea, string> = {
  medicamento_atrasado: '#dc2626',
  sin_toma: '#dc2626',
  medicamento_toca: '#d97706',
  horario_ilegible: '#7c3aed',
}

export default function EnfermeriaUciPage() {
  const router = useRouter()
  const volver = useSmartBack('/uci')
  const { clinicId } = useClinic()
  const { config } = useConfig()
  // El margen lo decide un solo módulo: aquí estaba escrito a mano y otra vez
  // en el MAR del paciente, y las dos pantallas se lo dicen a la misma
  // enfermera sobre el mismo paciente.
  const gracia = graciaMar(config.graciaMarMin)
  const [unidades, setUnidades] = useState<Unidad[] | null>(null)
  const [resumen, setResumen] = useState<ResumenEnfermeria | null>(null)
  /**
   * SERVICIOS QUE EL HOSPITAL NO HA CLASIFICADO.
   *
   * `esCritica` devuelve `false` para un servicio sin tipo —y el módulo dice que
   * el llamador DEBE declararlo con `sinTipoConfigurado`—. El landing de UCI lo
   * hace; esta pantalla no: un hospital que llamó a su unidad «UTI Adultos» (que
   * no está en el catálogo de fábrica) veía la lista vacía y el cartel «No hay
   * nada pendiente en terapia», con antibióticos atrasados en la unidad.
   */
  const [sinTipo, setSinTipo] = useState<string[]>([])
  /** Y si ni siquiera se pudo leer el catálogo, tampoco se afirma que no haya nada. */
  const [falloUnidades, setFalloUnidades] = useState(false)
  /** No se pudieron leer las tomas de al menos un paciente. */
  const [falloTomas, setFalloTomas] = useState(false)

  useEffect(() => {
    if (!clinicId) return
    let vivo = true
    getUnidades(clinicId)
      .then(u => { if (vivo) setUnidades(u) })
      .catch(() => { if (vivo) { setUnidades([]); setFalloUnidades(true) } })
    return () => { vivo = false }
  }, [clinicId])

  useEffect(() => {
    if (!clinicId || unidades === null) return
    let vivo = true
    const off = suscribirCenso(clinicId, async censo => {
      const uci = censo.filter(i => esCritica(i.servicio, unidades))
      if (vivo) setSinTipo(sinTipoConfigurado(censo.map(i => i.servicio), unidades))
      const ahora = new Date().toISOString()
      const pacientes = await Promise.all(uci.map(async i => {
        // Un fallo de lectura entraba como «este paciente no tiene ninguna toma»
        // y la lista lo trataba como un hecho. Sale igual —no se le esconde—
        // pero el aviso de arriba dice que la lista puede no ser fiable.
        const tomas = await getTomas(clinicId, i.id, TOPE_TOMAS_LISTA)
          .catch(() => { if (vivo) setFalloTomas(true); return [] })
        const vigentes = serieTomas(tomas)
        const ultima = vigentes.length > 0 ? vigentes[vigentes.length - 1] : undefined
        const ms = ultima ? Date.parse(ultima.medidoEn) : NaN
        return {
          internamientoId: i.id,
          pacienteNombre: i.pacienteNombre,
          cama: i.cama,
          indicaciones: i.indicaciones ?? [],
          horasDesdeUltimaToma: Number.isNaN(ms) ? null : (Date.parse(ahora) - ms) / 3_600_000,
        }
      }))
      if (vivo) setResumen(turnoDeEnfermeria(pacientes, ahora, gracia))
    })
    return () => { vivo = false; off?.() }
  }, [clinicId, unidades])

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '8px 4px 40px' }}>
      <button onClick={volver} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13, marginBottom: 12, padding: 0 }}>
        <ArrowLeft size={15} /> Pacientes y camas de UCI
      </button>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <HeartPulse size={22} style={{ color: 'var(--nexus,#3d5afe)' }} /> Turno de enfermería
      </h1>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, margin: '10px 0 18px', padding: '11px 13px', borderRadius: 11, background: 'var(--s2)', border: '1px solid var(--border)' }}>
        <Info size={15} style={{ color: 'var(--text3)', flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--text3)' }}>
          {NO_PRIORIZA_CLINICAMENTE}
        </div>
      </div>

      {resumen === null ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
      ) : (
        <>
          {Object.keys(resumen.conteo).length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {(Object.entries(resumen.conteo) as [TipoTarea, number][]).map(([tipo, n]) => (
                <span key={tipo} style={{ fontSize: 12, fontWeight: 700, padding: '5px 10px', borderRadius: 7, border: `1px solid color-mix(in srgb, ${COLOR[tipo]} 33%, transparent)`, background: COLOR[tipo] + '14', color: COLOR[tipo] }}>
                  {TAREA_LABEL[tipo]}: {n}
                </span>
              ))}
            </div>
          )}

          {(sinTipo.length > 0 || falloUnidades || falloTomas) && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'color-mix(in srgb, var(--amber) 9%, transparent)', border: '1px solid color-mix(in srgb, var(--amber) 40%, transparent)', borderRadius: 12, padding: '13px 15px', marginBottom: 14 }}>
              <AlertTriangle size={17} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text)' }}>
                {falloUnidades
                  ? <><strong>No se pudo leer la configuración de unidades.</strong> Esta lista puede estar incompleta: no significa que no haya pendientes.</>
                  : falloTomas && sinTipo.length === 0
                    ? <><strong>No se pudieron leer las tomas de algún paciente.</strong> Los que aparecen «sin toma» pueden tenerlas: la pantalla no alcanzó a verlas.</>
                    : <><strong>Servicios sin tipo de unidad: {sinTipo.join(' · ')}.</strong> {AVISO_SIN_TIPO}</>}
              </div>
            </div>
          )}

          {resumen.tareas.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: 'var(--text3)', padding: 24, justifyContent: 'center', border: '1px dashed var(--border)', borderRadius: 12 }}>
              <CheckCircle2 size={17} style={{ color: 'var(--teal)' }} />
              {sinTipo.length > 0 || falloUnidades || falloTomas
                ? 'Sin pendientes entre los pacientes que esta pantalla alcanza a ver (mira el aviso de arriba).'
                : 'No hay nada pendiente en terapia según el registro.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {resumen.tareas.map((t, i) => (
                <div
                  key={`${t.internamientoId}-${i}`}
                  onClick={() => router.push(`/uci?internamiento=${t.internamientoId}`)}
                  style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: '11px 13px', borderRadius: 11, cursor: 'pointer', border: `1px solid color-mix(in srgb, ${COLOR[t.tipo]} 27%, transparent)`, background: COLOR[t.tipo] + '0d' }}
                >
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em', color: COLOR[t.tipo], minWidth: 96, paddingTop: 2 }}>
                    {TAREA_LABEL[t.tipo]}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 13.5, color: 'var(--text)' }}>{t.pacienteNombre}</strong>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text3)' }}>
                        <BedDouble size={12} /> {t.cama ?? 'sin cama'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 3, lineHeight: 1.5 }}>{t.texto}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {resumen.sinTareas.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text3)', marginTop: 16 }}>
              <CheckCircle2 size={14} style={{ color: 'var(--teal)', flexShrink: 0 }} />
              {resumen.sinTareas.length} paciente{resumen.sinTareas.length !== 1 ? 's' : ''} sin
              pendientes en el registro. Una lista que sólo muestra lo que falta esconde que el resto va al día.
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11.5, color: 'var(--text3)', marginTop: 18, lineHeight: 1.6 }}>
            <AlertTriangle size={13} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 2 }} />
            <div>
              Las infusiones continuas, los PRN y las dosis únicas ya administradas
              <strong> no aparecen aquí</strong>: no se atrasan por definición, y ponerlas en rojo
              cada hora haría que el rojo dejara de significar algo.
              El margen antes de marcar una dosis atrasada es de {gracia} min — un valor
              operativo de la unidad, no clínico.
            </div>
          </div>
        </>
      )}
    </div>
  )
}
