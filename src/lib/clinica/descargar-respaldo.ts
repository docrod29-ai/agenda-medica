/**
 * DESCARGAR EL RESPALDO DEL CONSULTORIO — declarado una vez.
 *
 * ── POR QUÉ SALE DE `/pacientes` ────────────────────────────────────────────
 *
 * El botón «Respaldo» vivía en la cabecera primaria de la lista de pacientes,
 * al lado de «Nuevo paciente». Bajar un archivo del consultorio entero no es
 * trabajo clínico: es una **operación** (§11 del Master Loop V15), y su sitio
 * es `/operaciones`. El equipo rojo lo escribió en RTC-15 y la re-puntuación
 * §29 lo confirmó desde el otro lado: parte de lo que hacía que `/pacientes`
 * puntuara 5.0 era ese racimo de tres botones de cabecera con anatomía de CRM.
 *
 * ── QUÉ NO CAMBIA ───────────────────────────────────────────────────────────
 *
 * La conducta, byte a byte: la misma ruta de servidor, el mismo streaming (el
 * archivo empieza a escribirse mientras el servidor sigue leyendo, sin cargar
 * el consultorio entero en memoria de nadie), el mismo nombre de archivo y el
 * mismo mensaje —que dice lo importante: **la última línea del archivo declara
 * si quedó completo y qué faltó**—. Mover no puede significar perder; por eso
 * la lógica se extrae entera en vez de reescribirse en el destino.
 *
 * Devuelve el texto a mostrar en lugar de llamar al toast: quien lo llame
 * decide cómo avisa (esta función no conoce el contexto de React).
 */
import { fetchAutenticado } from '@/lib/auth-client'

export interface ResultadoDeRespaldo {
  ok: boolean
  mensaje: string
}

export async function descargarRespaldo(clinicId: string): Promise<ResultadoDeRespaldo> {
  if (!clinicId) return { ok: false, mensaje: 'No se pudo generar el respaldo' }
  try {
    const res = await fetchAutenticado(`/api/clinic/exportar?clinicId=${encodeURIComponent(clinicId)}`)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      return { ok: false, mensaje: d.error || 'No se pudo generar el respaldo' }
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `respaldo_ausculta_${new Date().toISOString().slice(0, 10)}.ndjson`
    a.click()
    URL.revokeObjectURL(url)
    return {
      ok: true,
      mensaje: 'Respaldo descargado. La última línea del archivo dice si quedó completo y qué faltó.',
    }
  } catch {
    return { ok: false, mensaje: 'No se pudo generar el respaldo' }
  }
}
