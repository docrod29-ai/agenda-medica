'use client'
import { AlertTriangle } from 'lucide-react'

/**
 * Aviso de que la configuración del consultorio NO se pudo leer.
 *
 * Hallazgo de la auditoría del Núcleo: cuando falla la lectura de
 * `clinics/{id}/config/main` (permisos, red, token vencido), `useConfig` se
 * quedaba en DEFAULT_CONFIG y la pantalla no podía distinguir "config cargada"
 * de "no se pudo leer". En las pantallas de impresión eso significa que la
 * receta sale SIN hoja membretada, SIN firma ni sello y SIN cédula profesional
 * — un documento inválido para NOM-004 — y el médico se lo entrega al paciente
 * sin que nada le avise.
 *
 * Este aviso hace visible el fallo y las acciones de imprimir/descargar quedan
 * bloqueadas mientras esté presente. No se imprime (`.no-print`): si alguien
 * fuerza la impresión desde el navegador, el papel no lleva el banner.
 */
export function AvisoConfigNoCargada({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <div className="no-print" style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)',
      borderRadius: 12, padding: '13px 15px', margin: '0 0 16px',
    }}>
      <AlertTriangle size={17} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 1 }} />
      <div style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--text)' }}>
        <strong>No se pudo cargar la configuración de tu consultorio.</strong>{' '}
        Este documento saldría sin membrete, sin tu firma y sin tu cédula profesional, así que
        imprimir y descargar están bloqueados. Revisa tu conexión y recarga la página.
        <div style={{ color: 'var(--text3)', marginTop: 5, fontSize: 12.5 }}>Detalle técnico: {error}</div>
      </div>
    </div>
  )
}
