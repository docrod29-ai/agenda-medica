'use client'
/**
 * Exportación de una NOTA clínica a Word (.doc) editable.
 *
 * Mismo criterio que receta-word.ts: HTML compatible con Word descargado como
 * application/msword (cero dependencias). Para el médico que prefiere ajustar la
 * nota a su propio membrete/formato antes de imprimir o archivar.
 *
 * NO reemplaza al PDF/impresión (que llevan sello de integridad y firma gráfica):
 * el Word es un documento EDITABLE, por eso no estampa el sello como verificable.
 */
import type { ClinicConfig } from '@/types'
import type { NotaMedica } from '@/types/expediente'
import { TIPO_NOTA_LABEL } from '@/types/expediente'

function esc(s: string | undefined | null): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export interface NotaWordExtra {
  edad?: number | string
  sexo?: string
  telefono?: string
  alergias?: string
  /** Hoja membretada ya resuelta (URL absoluta). Si viene, se usa como encabezado
   *  en vez del encabezado de texto — congruente con pantalla/Imprimir/PDF. */
  membrete?: string
}

export function construirNotaHTML(nota: NotaMedica, config: ClinicConfig | null, extra?: NotaWordExtra): string {
  const medico = nota.firma?.nombreMedico || config?.nombreMedico || 'Médico'
  const cedula = nota.firma?.cedulaProfesional || config?.cedulaProfesional || nota.metadata.cedulaProfesional || ''
  const especialidad = nota.firma?.especialidad || config?.especialidad || nota.metadata.especialidad || ''
  const establecimiento = nota.metadata.establecimiento || config?.nombreClinica || ''
  const fecha = new Date(nota.fechaConsulta).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })

  const sec = (titulo: string, cuerpo: string) =>
    cuerpo ? `<div style="margin-bottom:8pt;"><div style="font-weight:bold;text-transform:uppercase;border-bottom:0.5pt solid #999;font-size:10.5pt;letter-spacing:0.3pt;margin-bottom:2pt;">${esc(titulo)}</div><div style="font-size:10.5pt;white-space:pre-wrap;">${cuerpo}</div></div>` : ''

  // Congruencia (auditoría flujo 2026-07): si hay hoja membretada, se usa como
  // encabezado (imagen) igual que pantalla/Imprimir/PDF, en vez del texto.
  const membreteAbs = (() => {
    const u = extra?.membrete
    if (!u) return ''
    if (/^(data:|https?:)/i.test(u)) return u
    if (typeof window === 'undefined') return u
    return new URL(u, window.location.origin).href
  })()
  const encabezado = membreteAbs
    ? `<img src="${membreteAbs}" style="max-width:100%;display:block;margin:0 auto 8pt;" />`
    : `<div style="text-align:center;border-bottom:1.5pt solid #1a1a1a;padding-bottom:6pt;margin-bottom:10pt;">
    <div style="font-size:15pt;font-weight:bold;">${esc(medico)}</div>
    <div style="font-size:10pt;">${esc(especialidad)}${especialidad && cedula ? ' · ' : ''}${cedula ? 'Cédula Prof. ' + esc(cedula) : '<span style="color:#b91c1c;font-weight:bold;">[FALTA CÉDULA PROFESIONAL]</span>'}</div>
    ${establecimiento ? `<div style="font-size:10pt;">${esc(establecimiento)}</div>` : ''}
    ${config?.direccion ? `<div style="font-size:9.5pt;color:#555;">${esc(config.direccion)}</div>` : ''}
  </div>`

  const signos = nota.signosVitales && Object.values(nota.signosVitales).some(Boolean)
    ? [
        nota.signosVitales.ta && `TA ${nota.signosVitales.ta} mmHg`,
        nota.signosVitales.fc && `FC ${nota.signosVitales.fc} lpm`,
        nota.signosVitales.fr && `FR ${nota.signosVitales.fr} rpm`,
        nota.signosVitales.temperatura && `T° ${nota.signosVitales.temperatura}°C`,
        nota.signosVitales.spo2 && `SpO₂ ${nota.signosVitales.spo2}%`,
        nota.signosVitales.peso && `Peso ${nota.signosVitales.peso} kg`,
        nota.signosVitales.talla && `Talla ${nota.signosVitales.talla} cm`,
      ].filter((x): x is string => !!x).map(esc).join(' · ')
    : ''

  const secciones = nota.secciones.filter(s => s.value.trim()).map(s => sec(s.label, esc(s.value))).join('')

  const dx = nota.diagnosticos.length
    ? `<div style="margin-bottom:8pt;"><div style="font-weight:bold;text-transform:uppercase;border-bottom:0.5pt solid #999;font-size:10.5pt;margin-bottom:2pt;">Diagnósticos</div><ol style="margin:0;padding-left:16pt;font-size:10.5pt;">${nota.diagnosticos.map(d => `<li>${esc(d.descripcion)}${d.codigoCIE10 ? ` (CIE-10: ${esc(d.codigoCIE10)})` : ''}</li>`).join('')}</ol></div>`
    : ''

  const meds = nota.medicamentos.length
    ? `<div style="margin-bottom:8pt;"><div style="font-weight:bold;text-transform:uppercase;border-bottom:0.5pt solid #999;font-size:10.5pt;margin-bottom:2pt;">Plan farmacológico</div><ol style="margin:0;padding-left:16pt;font-size:10.5pt;">${nota.medicamentos.map(m => `<li>${esc([`${m.nombre}${m.dosis ? ` ${m.dosis}` : ''}`.trim(), m.via, m.frecuencia, m.duracion].filter(Boolean).join(' · '))}${m.indicacion ? ` — ${esc(m.indicacion)}` : ''}</li>`).join('')}</ol></div>`
    : ''

  const firma = `<div style="margin-top:34pt;text-align:center;">
    <div style="border-top:1pt solid #1a1a1a;width:240pt;margin:0 auto;padding-top:3pt;font-size:10.5pt;">
      <b>${esc(medico)}</b><br/>${esc(especialidad)}<br/>${cedula ? 'Cédula Profesional ' + esc(cedula) : '<span style="color:#b91c1c;font-weight:bold;">[FALTA CÉDULA PROFESIONAL]</span>'}
    </div>
  </div>`

  // Auditoría flujo 2026-07 (P1): NO inventar "Negadas" — el llamador ya manda el
  // texto correcto de 3 estados (valor real / "Negadas" si se interrogó / "NO
  // DISPONIBLE" si no se pudo leer al paciente). Aquí solo se muestra tal cual.
  const alergias = `<div style="border:1pt solid #b91c1c;color:#b91c1c;font-weight:bold;font-size:10.5pt;padding:4pt 8pt;margin-bottom:8pt;">ALERGIAS: ${esc(extra?.alergias || 'No disponible')}</div>`

  return `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8">
<style>@page WordSection1 { size:216mm 279mm; margin:18mm; } div.WordSection1 { page:WordSection1; }
body { font-family:'Times New Roman', Georgia, serif; font-size:11pt; color:#1a1a1a; }</style></head>
<body><div class="WordSection1">
  ${encabezado}
  <div style="text-align:center;font-size:13pt;font-weight:bold;text-transform:uppercase;margin-bottom:8pt;">${esc(TIPO_NOTA_LABEL[nota.tipo])}</div>
  <div style="font-size:10.5pt;margin-bottom:4pt;"><b>Paciente:</b> ${esc(nota.pacienteNombre)}${extra?.edad ? ' · Edad: ' + esc(String(extra.edad)) + ' años' : ''}${extra?.sexo ? ' · ' + esc(extra.sexo) : ''}${extra?.telefono ? ' · Tel: ' + esc(extra.telefono) : ''} &nbsp;&nbsp; <b>Fecha:</b> ${esc(fecha)}</div>
  ${alergias}
  ${nota.resumenEjecutivo ? `<div style="font-style:italic;margin-bottom:6pt;font-size:10.5pt;">${esc(nota.resumenEjecutivo)}</div>` : ''}
  ${signos ? sec('Signos vitales', signos) : ''}
  ${secciones}
  ${dx}
  ${meds}
  ${firma}
  <div style="margin-top:14pt;font-size:8.5pt;color:#666;text-align:center;">Documento EDITABLE exportado de NexusMED. La versión con validez legal es la nota firmada (con sello SHA-256) impresa o en PDF. Conforme a NOM-004-SSA3-2012.</div>
</div></body></html>`
}

/** Genera y descarga la nota como archivo .doc (editable en Word). */
export function descargarNotaWord(nota: NotaMedica, config: ClinicConfig | null, extra?: NotaWordExtra): void {
  const html = construirNotaHTML(nota, config, extra)
  const blob = new Blob(['﻿', html], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const nombrePac = (nota.pacienteNombre || 'paciente').replace(/[^\w\sáéíóúñ-]/gi, '').replace(/\s+/g, '_')
  const fechaCorta = new Date(nota.fechaConsulta).toISOString().slice(0, 10)
  const a = document.createElement('a')
  a.href = url
  a.download = `Nota_${nombrePac}_${fechaCorta}.doc`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
