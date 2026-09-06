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
import { fondoWord, imagenADataUri, WORD_HTML_NS } from '@/lib/word-membrete'
import { fechaISOLocal } from '@/lib/timezone'
import { conEtiquetaDeEdad } from '@/lib/edad-legible'
import {
  TITULO_OTORGAMIENTO, DECLARACION_OTORGAMIENTO, RENGLONES_DE_FIRMA,
  RENGLON_LUGAR_FECHA, huellaDelTextoAceptado,
} from '@/lib/consentimiento-impreso'

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

export function construirNotaHTML(nota: NotaMedica, config: ClinicConfig | null, extra?: NotaWordExtra, membreteDataUri?: string): string {
  const medico = nota.firma?.nombreMedico || config?.nombreMedico || 'Médico'
  const cedula = nota.firma?.cedulaProfesional || config?.cedulaProfesional || nota.metadata.cedulaProfesional || ''
  const especialidad = nota.firma?.especialidad || config?.especialidad || nota.metadata.especialidad || ''
  const establecimiento = nota.metadata.establecimiento || config?.nombreClinica || ''
  const fecha = new Date(nota.fechaConsulta).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })

  const sec = (titulo: string, cuerpo: string) =>
    cuerpo ? `<div style="margin-bottom:8pt;"><div style="font-weight:bold;text-transform:uppercase;border-bottom:0.5pt solid #999;font-size:10.5pt;letter-spacing:0.3pt;margin-bottom:2pt;">${esc(titulo)}</div><div style="font-size:10.5pt;white-space:pre-wrap;">${cuerpo}</div></div>` : ''

  // Con MEMBRETE (data URI) → va como FONDO DE PÁGINA de Word (v:background) y el
  // texto fluye ENCIMA dentro de la zona segura (márgenes @page amplios), igual que
  // Imprimir/PDF: el membrete ya trae el encabezado, así que NO se pone el de texto
  // (evita duplicar). SIN membrete → encabezado de texto limpio de siempre.
  const fondo = fondoWord(membreteDataUri || '')
  const conMembrete = !!fondo.background
  const encabezado = conMembrete ? '' : `<div style="text-align:center;border-bottom:1.5pt solid #1a1a1a;padding-bottom:6pt;margin-bottom:10pt;">
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

  /**
   * MC-003 — el consentimiento lo firma QUIEN CONSIENTE.
   *
   * Hasta aquí, una nota tipo `consentimiento` salía con el mismo bloque único
   * de firma que una nota de evolución: el del médico. El acto de otorgamiento
   * —paciente o representante, testigos, lugar y fecha, y la huella del texto
   * aceptado— no existía en el papel. Las palabras vienen de
   * `consentimiento-impreso.ts` para que la hoja impresa y este .doc digan lo
   * mismo.
   */
  const renglon = (etiqueta: string) =>
    `<div style="margin-top:26pt;"><div style="border-top:1pt solid #1a1a1a;width:300pt;padding-top:3pt;font-size:9.5pt;">${esc(etiqueta)}</div></div>`
  const otorgamiento = nota.tipo === 'consentimiento'
    ? `<div style="margin-top:20pt;">
        <div style="font-weight:bold;text-transform:uppercase;border-bottom:0.5pt solid #999;font-size:10.5pt;margin-bottom:4pt;">${esc(TITULO_OTORGAMIENTO)}</div>
        <div style="font-size:10.5pt;">${esc(DECLARACION_OTORGAMIENTO)}</div>
        ${RENGLONES_DE_FIRMA.map(renglon).join('')}
        ${renglon(RENGLON_LUGAR_FECHA)}
        <div style="margin-top:10pt;font-size:8.5pt;color:#666;">${esc(huellaDelTextoAceptado(nota.metadata.hashIntegridad))}</div>
      </div>`
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

  // Con membrete: márgenes AMPLIOS = zona segura del membrete (arriba deja pasar el
  // encabezado impreso, abajo el pie). Sin membrete: márgenes normales de carta.
  const pageMargin = conMembrete ? '42mm 22mm 30mm 22mm' : '18mm'
  return `<!DOCTYPE html><html ${WORD_HTML_NS}><head><meta charset="utf-8">
${fondo.head}
<style>@page WordSection1 { size:216mm 279mm; margin:${pageMargin}; } div.WordSection1 { page:WordSection1; }
body { font-family:'Times New Roman', Georgia, serif; font-size:11pt; color:#1a1a1a; }</style></head>
<body>${fondo.background}<div class="WordSection1">
  ${encabezado}
  <div style="text-align:center;font-size:13pt;font-weight:bold;text-transform:uppercase;margin-bottom:8pt;">${esc(TIPO_NOTA_LABEL[nota.tipo])}</div>
  ${nota.estado !== 'firmada' ? `<div style="text-align:center;border:1.5pt solid #b91c1c;color:#b91c1c;font-weight:bold;font-size:11pt;letter-spacing:2pt;padding:4pt 8pt;margin-bottom:8pt;">BORRADOR — DOCUMENTO NO FIRMADO, SIN VALIDEZ LEGAL</div>` : ''}
  <div style="font-size:10.5pt;margin-bottom:4pt;"><b>Paciente:</b> ${esc(nota.pacienteNombre)}${conEtiquetaDeEdad(extra?.edad) ? ' · ' + esc(conEtiquetaDeEdad(extra?.edad)) : ''}${extra?.sexo ? ' · ' + esc(extra.sexo) : ''}${extra?.telefono ? ' · Tel: ' + esc(extra.telefono) : ''} &nbsp;&nbsp; <b>Fecha:</b> ${esc(fecha)}</div>
  ${alergias}
  ${nota.resumenEjecutivo ? `<div style="font-style:italic;margin-bottom:6pt;font-size:10.5pt;">${esc(nota.resumenEjecutivo)}</div>` : ''}
  ${signos ? sec('Signos vitales', signos) : ''}
  ${secciones}
  ${dx}
  ${meds}
  ${otorgamiento}
  ${firma}
  <div style="margin-top:14pt;font-size:8.5pt;color:#666;text-align:center;">Documento EDITABLE exportado de Ausculta. La versión con validez legal es la nota firmada (con sello SHA-256) impresa o en PDF. Conforme a NOM-004-SSA3-2012.</div>
</div></body></html>`
}

/** Genera y descarga la nota como archivo .doc (editable en Word). ASÍNCRONA
 *  porque, si hay hoja membretada, la descarga e incrusta como fondo de página. */
export async function descargarNotaWord(nota: NotaMedica, config: ClinicConfig | null, extra?: NotaWordExtra): Promise<void> {
  const membreteDataUri = extra?.membrete ? await imagenADataUri(extra.membrete) : ''
  const html = construirNotaHTML(nota, config, extra, membreteDataUri)
  const blob = new Blob(['﻿', html], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const nombrePac = (nota.pacienteNombre || 'paciente').replace(/[^\w\sáéíóúñ-]/gi, '').replace(/\s+/g, '_')
  // C-015 — `toISOString()` da el día en UTC y corre la fecha del nombre del
  // archivo un día por las tardes en México. La fecha del documento se
  // formatea en la zona del consultorio.
  const fechaCorta = fechaISOLocal(new Date(nota.fechaConsulta))
  const a = document.createElement('a')
  a.href = url
  a.download = `Nota_${nombrePac}_${fechaCorta}.doc`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
