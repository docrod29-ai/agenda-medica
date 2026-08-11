'use client'
/**
 * INSTRUMENT STRIP — V15-SHELL-GREYBOX-001, Capa 1.
 *
 * V15 §5 la define como «estado periférico persistente»: paciente actual,
 * estado de encuentro, grabación activa, sync/autoguardado, consultorio.
 * Advierte explícitamente: «no debe volverse una segunda barra de navegación».
 *
 * ── LAS SEÑALES QUE PINTA ─────────────────────────────────────────────────────
 *
 *   - consultorio activo (mismo dato que ya pinta `Sidebar`/`FlowRail`);
 *   - grabación activa, releyendo el MISMO evento `EVENTO_GRABANDO` que ya
 *     escucha `MarcoEscuchando` — no es una segunda fuente de verdad, es la
 *     misma señal PINTADA distinto (el marco perimetral es la advertencia
 *     ambiental; esta franja es la confirmación textual con hora transcurrida);
 *   - paciente actual (V15-PATIENT-WORKSPACE-001, continuación) — ver abajo.
 *
 * ── PACIENTE ACTUAL, Y POR QUÉ SE LEE DE LA URL ──────────────────────────────
 *
 * Quedó pendiente desde V15-SHELL-GREYBOX-001: pintarlo exigía o inventar un
 * selector nuevo, o leer PHI fuera del componente que ya lo hacía con permisos
 * verificados. `patientIdDeLaRuta()` resuelve lo primero sin tocar Firestore
 * (es la URL, no una consulta); `getPatient()` resuelve lo segundo siendo LA
 * MISMA función, con el mismo alcance de clínica, que ya usan
 * expediente/consulta/receta/orden/nota/referencia — no una lectura nueva con
 * su propio criterio de permisos.
 *
 * Así el médico no pierde de vista EN QUIÉN ESTÁ al pasar del expediente a
 * generar una receta o una orden, aunque esas pantallas (Fase 8 del master
 * loop) no se toquen todavía — es la franja persistente la que carga, no cada
 * pantalla la que tiene que avisar.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Circle } from 'lucide-react'
import { useConfig } from '@/hooks/useConfig'
import { useClinic } from '@/context/ClinicContext'
import { getPatient } from '@/lib/firestore'
import { patientIdDeLaRuta } from '@/lib/nav/paciente-de-la-ruta'
import { EVENTO_GRABANDO, type DetalleDeEscucha } from '@/lib/seguridad/estoy-grabando'

/**
 * Nombre del paciente cuya ruta se está viendo ahora mismo, o `null` si esta
 * pantalla no es de un paciente concreto o el nombre aún no cargó.
 *
 * NUNCA enseña el nombre del paciente ANTERIOR mientras carga el siguiente: el
 * estado guarda el último `{id, nombre}` resuelto, y el hook sólo lo devuelve
 * si ese `id` coincide con el `patientId` de la URL actual — si cambió de
 * paciente (o salió a una pantalla sin paciente), el id ya no coincide y el
 * valor queda oculto de inmediato, sin esperar a que resuelva la nueva lectura
 * ni llamar `setState` a ciegas dentro del efecto.
 */
function usePacienteActual(): { id: string; nombre: string } | null {
  const pathname = usePathname()
  const { clinicId } = useClinic()
  const patientId = patientIdDeLaRuta(pathname)
  const [cargado, setCargado] = useState<{ id: string; nombre: string } | null>(null)

  useEffect(() => {
    if (!clinicId || !patientId) return
    let vivo = true
    getPatient(clinicId, patientId)
      .then(p => { if (vivo && p) setCargado({ id: patientId, nombre: p.nombre }) })
      .catch(() => { /* silencioso: la franja es conveniencia, no la fuente de la identidad — el ancla del expediente ya avisa si falla la lectura */ })
    return () => { vivo = false }
  }, [clinicId, patientId])

  return cargado && cargado.id === patientId ? cargado : null
}

function useSegundosGrabando(): number | null {
  const [segundos, setSegundos] = useState<number | null>(null)
  useEffect(() => {
    let inicio: number | null = null
    let intervalo: ReturnType<typeof setInterval> | null = null
    const detener = () => { if (intervalo != null) { clearInterval(intervalo); intervalo = null } }
    const alSonar = (ev: Event) => {
      const d = (ev as CustomEvent<DetalleDeEscucha>).detail
      if (!d || typeof d.activo !== 'boolean') return
      if (!d.activo) { inicio = null; detener(); setSegundos(null); return }
      if (inicio != null) return   // ya estaba contando; el latido de EVENTO_GRABANDO no reinicia
      inicio = performance.now()
      setSegundos(0)
      intervalo = setInterval(() => {
        setSegundos(Math.max(0, Math.round((performance.now() - (inicio as number)) / 1000)))
      }, 1000)
    }
    window.addEventListener(EVENTO_GRABANDO, alSonar)
    return () => { window.removeEventListener(EVENTO_GRABANDO, alSonar); detener() }
  }, [])
  return segundos
}

function formatearDuracion(s: number): string {
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

export function InstrumentStrip() {
  const { config } = useConfig()
  const segundos = useSegundosGrabando()
  const paciente = usePacienteActual()

  return (
    <div
      role="status"
      aria-label="Estado clínico y de sistema"
      style={{
        display: 'flex', alignItems: 'center', gap: 10, minHeight: 30,
        padding: '5px 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--s1)', fontSize: 12, color: 'var(--text3)',
      }}
      className="nx-instrument-strip"
    >
      <span style={{ fontWeight: 600, color: 'var(--text2)' }}>
        {config.nombreClinica || 'Ausculta'}
      </span>
      {paciente && (
        <Link
          href={`/expediente/${paciente.id}`}
          style={{ color: 'var(--text2)', textDecoration: 'none', fontWeight: 600 }}
        >
          · {paciente.nombre}
        </Link>
      )}
      {segundos != null && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text)', fontWeight: 600 }}>
          <Circle size={8} fill="currentColor" style={{ animation: 'pulse 1.6s ease-in-out infinite' }} />
          Grabando · {formatearDuracion(segundos)}
        </span>
      )}
    </div>
  )
}
