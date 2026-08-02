'use client'
// ══════════════════════════════════════════════════════════════
// UNIDADES DEL HOSPITAL — el nombre lo pone el hospital, el TIPO lo entiende
// el software.
//
// Esta pantalla existe porque el listado de UCI decidía quién era paciente
// crítico leyendo el TEXTO del servicio. Un hospital que llame a su unidad
// «UTI», «5º Norte» o «Torre B» perdía a sus pacientes de la pantalla de
// terapia, sin error y sin aviso.
//
// Aquí NO se adivina nada: la propuesta del catálogo se muestra, y el hospital
// la confirma. «Terapia» puede ser terapia intensiva o terapia física.
// ══════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react'
import { ArrowLeft, Building2, Plus, Trash2, AlertTriangle } from 'lucide-react'
import { useSmartBack } from '@/hooks/useSmartBack'
import { useClinic } from '@/context/ClinicContext'
import { useToast } from '@/context/ToastContext'
import { getUnidades, guardarUnidad, borrarUnidad, getCamas, suscribirCenso } from '@/lib/hospital/firestore'
import {
  TIPOS_UNIDAD, TIPO_UNIDAD_LABEL, unidadesDelCatalogo, sinTipoConfigurado,
  type Unidad, type TipoUnidad,
} from '@/lib/hospital/unidades'
import { Button, Spinner } from '@/components/ui'

export default function UnidadesPage() {
  const volver = useSmartBack('/hospitalizacion')
  const { clinicId, role } = useClinic()
  const { toast } = useToast()
  const esAdmin = role === 'admin' || role === 'medico'

  const [unidades, setUnidades] = useState<Unidad[] | null>(null)
  const [enUso, setEnUso] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const cargar = () => {
    if (!clinicId) return
    getUnidades(clinicId).then(setUnidades).catch(() => setUnidades([]))
  }
  useEffect(cargar, [clinicId])

  // Nombres de servicio que HOY están en uso (censo + camas). Son los que de
  // verdad hay que clasificar; el resto del catálogo es relleno.
  useEffect(() => {
    if (!clinicId) return
    let vivo = true
    const off = suscribirCenso(clinicId, censo => {
      getCamas(clinicId).then(camas => {
        if (!vivo) return
        const nombres = [...censo.map(i => i.servicio), ...camas.map(c => c.servicio)]
        setEnUso([...new Set(nombres.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')))
      }).catch(() => { /* sin camas, el censo basta */ })
    })
    return () => { vivo = false; off?.() }
  }, [clinicId])

  const guardar = async (u: Omit<Unidad, 'id'> & { id?: string }) => {
    if (!clinicId) return
    setBusy(true)
    try { await guardarUnidad(clinicId, u); cargar() }
    catch { toast('No se pudo guardar la unidad', 'error') }
    finally { setBusy(false) }
  }

  const sembrar = async () => {
    if (!clinicId) return
    setBusy(true)
    try {
      // Se siembran los servicios EN USO, no los 17 del catálogo: clasificar
      // unidades que nadie usa es ruido.
      const propuesta = unidadesDelCatalogo()
      const aCrear = enUso.length > 0
        ? enUso.map(n => propuesta.find(p => p.nombre === n) ?? { id: '', nombre: n, tipo: 'otro' as TipoUnidad, activa: true })
        : propuesta
      for (const p of aCrear) {
        if ((unidades ?? []).some(u => u.nombre === p.nombre)) continue
        await guardarUnidad(clinicId, { nombre: p.nombre, tipo: p.tipo, activa: true })
      }
      cargar()
      toast('Unidades creadas. Revisa el tipo de cada una antes de confiar en la pantalla de UCI.', 'success')
    } catch { toast('No se pudieron crear las unidades', 'error') }
    finally { setBusy(false) }
  }

  const faltantes = sinTipoConfigurado(enUso, unidades ?? [])

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '8px 4px 40px' }}>
      <button onClick={volver} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13, marginBottom: 12, padding: 0 }}>
        <ArrowLeft size={15} /> Atrás
      </button>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Building2 size={22} style={{ color: 'var(--nexus,#3d5afe)' }} /> Unidades del hospital
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text3)', margin: '0 0 20px', lineHeight: 1.6 }}>
        Su hospital llama a cada unidad como quiera. Lo que el sistema necesita saber es
        de qué <strong>tipo</strong> es, porque de eso depende en qué pantalla aparece cada
        paciente. Renombrar una unidad nunca cambia su comportamiento clínico.
      </p>

      {faltantes.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'rgba(217,119,6,0.09)', border: '1px solid rgba(217,119,6,0.4)', borderRadius: 12, padding: '13px 15px', margin: '0 0 16px' }}>
          <AlertTriangle size={17} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text)' }}>
            <strong>Sin clasificar: {faltantes.join(' · ')}.</strong>{' '}
            Mientras no tengan tipo, el sistema no puede saber si son de cuidados críticos.
            No lo adivina por el nombre: «Terapia» puede ser intensiva o física.
            {esAdmin && (
              <div style={{ marginTop: 9 }}>
                <Button size="sm" loading={busy} onClick={sembrar}>Crear las unidades en uso</Button>
              </div>
            )}
          </div>
        </div>
      )}

      {unidades === null ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {unidades.length === 0 && faltantes.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--text3)', padding: 24, textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 12 }}>
              Aún no hay unidades configuradas. Mientras tanto se usa el catálogo de fábrica.
            </div>
          )}
          {unidades.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map(u => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '11px 14px', borderRadius: 11, border: '1px solid var(--border)', background: 'var(--s2)' }}>
              <input
                defaultValue={u.nombre}
                disabled={!esAdmin}
                onBlur={e => { const v = e.target.value.trim(); if (v && v !== u.nombre) guardar({ ...u, nombre: v }) }}
                style={{ flex: '1 1 200px', minWidth: 160, minHeight: 36, background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 9px', fontSize: 13, color: 'var(--text)' }}
              />
              <select
                value={u.tipo}
                disabled={!esAdmin}
                onChange={e => guardar({ ...u, tipo: e.target.value as TipoUnidad })}
                style={{ minHeight: 36, background: 'var(--s1)', border: `1px solid ${u.tipo === 'critica' ? 'var(--nexus,#3d5afe)' : 'var(--border)'}`, borderRadius: 8, padding: '6px 9px', fontSize: 12.5, color: u.tipo === 'critica' ? 'var(--nexus,#3d5afe)' : 'var(--text2)', fontWeight: u.tipo === 'critica' ? 700 : 500 }}
              >
                {TIPOS_UNIDAD.map(t => <option key={t} value={t}>{TIPO_UNIDAD_LABEL[t]}</option>)}
              </select>
              {esAdmin && (
                <button
                  title="Eliminar unidad"
                  onClick={async () => { if (!clinicId) return; await borrarUnidad(clinicId, u.id); cargar() }}
                  style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4, minHeight: 32 }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          {esAdmin && (
            <div style={{ marginTop: 6 }}>
              <Button variant="secondary" size="sm" icon={<Plus size={14} />} loading={busy}
                onClick={() => guardar({ nombre: 'Nueva unidad', tipo: 'piso', activa: true })}>
                Agregar unidad
              </Button>
            </div>
          )}
        </div>
      )}

      <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 20, lineHeight: 1.6 }}>
        Las unidades marcadas como <strong>Cuidados críticos</strong> son las que alimentan la
        pantalla de UCI y el día de estancia en terapia. Las demás siguen en Hospitalización.
      </p>
    </div>
  )
}
