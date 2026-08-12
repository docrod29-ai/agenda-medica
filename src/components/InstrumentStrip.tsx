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

/**
 * `enTopbar` (V15-MOBILE-001, tercera rebanada, §22/§23): en móvil la franja
 * NO es una segunda fila bajo la topbar — es el CENTRO de la topbar. La
 * medición de baseline (`medir-trabajos-moviles-v15.mjs`) encontró «Ausculta»
 * dos veces apiladas en el shell de todas las pantallas, 30px extra de shell
 * fijo, y el enlace del paciente con un objetivo táctil de 141×18 (menos de
 * la mitad del mínimo de 44px de §24).
 *
 * En la variante compacta el paciente GANA a la clínica: con 390px no caben
 * los dos, y a media consulta lo periférico que importa es EN QUIÉN estás y
 * si estás grabando — el nombre del consultorio es admin no esencial (§8.5).
 * Sin paciente en la ruta, la fila enseña la identidad de siempre (una vez).
 */
export function InstrumentStrip({ enTopbar }: { enTopbar?: boolean }) {
  const { config } = useConfig()
  const segundos = useSegundosGrabando()
  const paciente = usePacienteActual()

  if (enTopbar) {
    return (
      <div
        role="status"
        aria-label="Estado clínico y de sistema"
        style={{
          display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0,
          fontSize: 12, color: 'var(--text3)', overflow: 'hidden',
        }}
        className="nx-instrument-strip-topbar"
      >
        {paciente ? (
          /* V15-VISUAL-SYSTEM-001 (8ª rebanada): la identidad de la franja es
             `.nx-ident-franja` — 14/600/var(--text), la voz más fuerte DE LA
             FRANJA (antes: 12/--text2 con ellipsis, más chica que el respaldo
             del consultorio). El enlace centra un objetivo táctil de 44px y el
             span interior envuelve hasta 2 líneas (--clamp, excepción
             declarada a §24 en globals.css) — ellipsis de una línea era la
             truncación de identidad que las rebanadas 4-7 retiraron del resto
             del shell. */
          <Link
            href={`/expediente/${paciente.id}`}
            className="nx-ident-franja"
            style={{
              display: 'flex', alignItems: 'center', minHeight: 44,
              paddingRight: 8, minWidth: 0,
            }}
          >
            <span className="nx-ident-franja--clamp">{paciente.nombre}</span>
          </Link>
        ) : (
          /* Sin paciente en la ruta, el consultorio porta la MISMA voz de
             identidad de la franja — antes pintaba 16px mientras el paciente
             pintaba 12: la franja hablaba más fuerte enseñando lo menos
             importante (§5: «current patient» es el primer estado periférico). */
          <span className="nx-ident-franja" style={{
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {config.nombreClinica || 'Ausculta'}
          </span>
        )}
        {segundos != null && (
          /* V15-VISUAL-SYSTEM-001 (Fase 10): el indicador de grabación habla
             el MISMO idioma que el marco perimetral (`MarcoEscuchando`):
             cobalto, nunca rojo — rojo aquí significa riesgo clínico, y el
             cobalto es el territorio libre de significado clínico (ver el
             comentario «POR QUÉ NO ES ROJO» en MarcoEscuchando.tsx). */
          <span className="nx-num" style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--nexus)', fontWeight: 600, flexShrink: 0 }}>
            <Circle size={8} fill="currentColor" style={{ animation: 'pulse 1.6s ease-in-out infinite' }} />
            {formatearDuracion(segundos)}
          </span>
        )}
      </div>
    )
  }

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
        <>
          {/* El separador vive FUERA del enlace: subrayar «·» diría que el
              punto también navega. */}
          <span aria-hidden="true">·</span>
          {/* 8ª rebanada: el paciente es la voz de identidad de la franja
              (.nx-ident-franja, 14/600/var(--text)) — antes era cromo 12/
              --text2, indistinguible del nombre del consultorio de al lado.
              En escritorio hay sitio: envuelve libre (minHeight 30 crece),
              sin clamp. */}
          <Link href={`/expediente/${paciente.id}`} className="nx-ident-franja">
            {paciente.nombre}
          </Link>
        </>
      )}
      {segundos != null && (
        /* Fase 10: cobalto = grabando, igual que la variante de topbar y que
           el marco perimetral — un solo idioma para «el micrófono está
           abierto» en todo el shell. 8ª rebanada: nx-num — los dígitos del
           timer son tabulares, el ancho no tiembla a cada segundo. */
        <span className="nx-num" style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--nexus)', fontWeight: 600 }}>
          <Circle size={8} fill="currentColor" style={{ animation: 'pulse 1.6s ease-in-out infinite' }} />
          Grabando · {formatearDuracion(segundos)}
        </span>
      )}
    </div>
  )
}
