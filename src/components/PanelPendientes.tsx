'use client'
/**
 * PANEL "SIGUIENTE ACCIÓN" — la cara del Workflow Orchestrator en el dashboard.
 * Unifica en una sola lista lo que necesita atención hoy (cobros pendientes,
 * membresías vencidas, citas por confirmar), priorizado. Se auto-carga.
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useClinic } from '@/context/ClinicContext'
import { useAppointments } from '@/hooks/useAppointments'
import { hoyISO } from '@/lib/timezone'
import { listarCobros } from '@/lib/cobros'
import { listarMembresias, type Membresia } from '@/lib/membresias'
import { accionesPendientes, resumenAcciones, type Prioridad } from '@/lib/workflow'
import type { Cobro } from '@/lib/cobros'
import { ListChecks, ArrowRight, CircleAlert } from 'lucide-react'

const COLOR: Record<Prioridad, string> = { alta: 'var(--red)', media: 'var(--amber)', baja: 'var(--text3)' }

export function PanelPendientes() {
  const { clinicId } = useClinic()
  const hoy = hoyISO()
  const { appointments, error: falloCitas } = useAppointments(`${hoy} 00:00`)
  const [cobros, setCobros] = useState<Cobro[]>([])
  const [membresias, setMembresias] = useState<Membresia[]>([])
  /**
   * QUÉ FUENTES NO SE PUDIERON CONSULTAR.
   *
   * Las tres se tragaban su fallo —dos con un `.catch(() => {})` vacío y la de
   * citas sin recoger `error`— y las tres alimentan la misma lista. Con una
   * caída, la lista sale corta o vacía, y con la lista vacía este panel
   * **desaparecía del tablero**: ni error, ni hueco, ni rastro. Un panel que se
   * quita solo dice «no tienes nada que hacer hoy» sin haberlo comprobado.
   */
  /*
   * Se guarda DE QUÉ PETICIÓN fue el fallo, no un `true` pelado.
   *
   * Con un booleano hacía falta ponerlo a `false` al principio del efecto —o el
   * aviso de ayer seguiría puesto hoy—, y eso es un `setState` síncrono dentro
   * de un efecto, que el trinquete de lint caza con razón. Atado a su petición
   * se limpia solo: cambia el día o el consultorio, la llave deja de coincidir y
   * el fallo caduca sin que nadie lo borre.
   */
  const peticion = `${clinicId ?? ''}|${hoy}`
  const [falloCobrosEn, setFalloCobrosEn] = useState<string | null>(null)
  const [falloMembresiasEn, setFalloMembresiasEn] = useState<string | null>(null)
  const falloCobros = falloCobrosEn === peticion
  const falloMembresias = falloMembresiasEn === peticion

  useEffect(() => {
    if (!clinicId) return
    listarCobros(clinicId, hoy, hoy).then(setCobros).catch(() => setFalloCobrosEn(peticion))
    listarMembresias(clinicId).then(setMembresias).catch(() => setFalloMembresiasEn(peticion))
  }, [clinicId, hoy, peticion])

  const acciones = useMemo(
    () => accionesPendientes({ citas: appointments, cobros, membresias, hoy }),
    [appointments, cobros, membresias, hoy],
  )
  const r = resumenAcciones(acciones)

  /**
   * Qué NO se pudo mirar, con su nombre. Se dice cuál falló porque no es lo
   * mismo no haber podido ver los cobros que no haber podido ver la agenda: el
   * médico sabe a qué pantalla ir a mirar a mano.
   */
  const sinConsultar = [
    falloCitas ? 'las citas' : null,
    falloCobros ? 'los cobros' : null,
    falloMembresias ? 'las membresías' : null,
  ].filter(Boolean) as string[]

  /*
   * El panel sólo desaparece cuando **de verdad** no hay nada: cero acciones Y
   * las tres fuentes contestaron. Si alguna falló, se queda y lo dice — aunque
   * la lista esté vacía, que es justo el caso en que callarse engaña más.
   */
  if (acciones.length === 0 && sinConsultar.length === 0) return null

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--panel, var(--s1)', padding: '16px 18px', marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <ListChecks size={16} style={{ color: 'var(--nexus)' }} />
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Siguiente acción</h2>
        {r.alta > 0 && (
          <span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 'var(--r-pill)', background: 'color-mix(in srgb, var(--red) 12%, transparent)', color: 'var(--red)' }}>
            {r.alta} urgente{r.alta > 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {acciones.slice(0, 8).map((a, i) => (
          <Link key={i} href={a.href} className="nx-acc-plana" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', border: '1px solid var(--border)', borderRadius: 10, textDecoration: 'none' }}>
            <CircleAlert size={14} style={{ color: COLOR[a.prioridad], flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{a.titulo}</div>
              {/* nx-meta (8ª rebanada): el detalle es metadato de §2 — en
                  /pendientes la misma pieza ya habla este rol. */}
              <div className="nx-meta">{a.detalle}</div>
            </div>
            <ArrowRight size={14} style={{ color: 'var(--text3)', flexShrink: 0 }} />
          </Link>
        ))}
      </div>
      {acciones.length > 8 && <div className="nx-meta" style={{ marginTop: 8 }}>+{acciones.length - 8} más</div>}
      {/*
        Y el aviso, que vale para las dos formas de engañar: la lista vacía que
        parece un día tranquilo, y la lista corta que parece completa.
      */}
      {sinConsultar.length > 0 && (
        <div
          role="status"
          style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 10, fontSize: 12, lineHeight: 1.45, color: 'var(--amber)' }}
        >
          <CircleAlert size={13} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
          <span>
            No se pudieron consultar {sinConsultar.join(' ni ')}.{' '}
            {acciones.length === 0 ? 'Esto NO quiere decir que no tengas nada pendiente.' : 'Puede faltar algo en esta lista.'}
          </span>
        </div>
      )}
    </div>
  )
}
