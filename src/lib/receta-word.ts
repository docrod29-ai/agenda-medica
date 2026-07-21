'use client'
/**
 * Exportación de receta/orden a Word (.doc) editable.
 *
 * POR QUÉ: subir el diseño propio como imagen de fondo y sobreponer texto
 * calibrado se ve mal y es frágil (el nombre no alinea, se empalma). La
 * alternativa que pidió el médico: un Word LIMPIO que él abre, ajusta a su
 * membrete/formato y manda/imprime.
 *
 * CÓMO: generamos HTML compatible con Word y lo descargamos con MIME
 * application/msword. Word y Google Docs lo abren como documento editable
 * SIN librerías pesadas (cero dependencias nuevas). El contenido va
 * estructurado y con estilos tipográficos limpios — listo para imprimir o
 * pegar en la hoja membretada del médico.
 */
import type { ClinicConfig, RecetaConfig } from '@/types'
import type { Medicamento } from '@/types/expediente'

export interface RecetaWordData {
  tipo: 'receta' | 'orden'
  folio: string
  fecha: Date
  pacienteNombre: string
  pacienteEdad?: number | string
  pacienteSexo?: string
  pacienteFechaNac?: string
  alergias?: string
  diagnostico?: string
  medicamentos?: Medicamento[]
  estudios?: string[]
  indicaciones?: string
  notaParaPaciente?: string
}

function esc(s: string | undefined | null): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function fmtFechaNacWord(fecha: string): string {
  if (!fecha) return ''
  const d = new Date(fecha.length === 10 ? fecha + 'T12:00:00' : fecha)
  if (isNaN(d.getTime())) return fecha
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function construirRecetaHTML(
  data: RecetaWordData,
  config: ClinicConfig | null,
  recetaConfig: RecetaConfig,
): string {
  const medico = config?.nombreMedico ?? ''
  const cedula = config?.cedulaProfesional ?? ''
  const especialidad = config?.especialidad ?? ''
  const clinica = config?.nombreClinica ?? ''
  const direccion = config?.direccion ?? ''
  const telefono = config?.telefonoAdmin || config?.whatsappConsultorio || ''
  const accent = recetaConfig.colorAccento ?? '#2845EA'
  const fechaTxt = data.fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
  const titulo = data.tipo === 'receta' ? 'RECETA MÉDICA' : 'ORDEN MÉDICA'

  /**
   * URL ABSOLUTA para el membrete.
   *
   * Tras migrar las imágenes a Storage, `membreteDataUrl` puede ser una ruta
   * RELATIVA (`/api/receta/diseno?path=…`). Word abre el .doc desde el disco, así
   * que una ruta relativa no resuelve contra nada: la imagen sale rota. Solo se
   * absolutiza cuando ya no es un data URI ni una URL completa.
   */
  const membreteSrc = (() => {
    const u = recetaConfig.membreteDataUrl
    if (!u) return ''
    if (/^(data:|https?:)/i.test(u)) return u
    if (typeof window === 'undefined') return u
    return new URL(u, window.location.origin).href
  })()

  // Encabezado: membrete subido (imagen) o datos del médico generados
  const encabezado = membreteSrc
    ? `<img src="${membreteSrc}" style="max-width:100%;max-height:140px;display:block;margin:0 auto 8pt;" />`
    : `
      <div style="text-align:center;border-bottom:2px solid ${accent};padding-bottom:6pt;margin-bottom:8pt;">
        <div style="font-size:16pt;font-weight:bold;color:${accent};">${esc(medico)}</div>
        <div style="font-size:10pt;">${esc(especialidad)}${especialidad && cedula ? ' · ' : ''}${cedula ? 'Cédula Prof. ' + esc(cedula) : '<span style="color:#b91c1c;">[FALTA CÉDULA PROFESIONAL]</span>'}</div>
        ${clinica ? `<div style="font-size:10pt;color:#444;">${esc(clinica)}</div>` : ''}
        ${direccion ? `<div style="font-size:9pt;color:#666;">${esc(direccion)}</div>` : ''}
        ${telefono ? `<div style="font-size:9pt;color:#666;">Tel. ${esc(telefono)}</div>` : ''}
      </div>`

  // Cuerpo: medicamentos (receta) o estudios (orden)
  let cuerpo = ''
  if (data.tipo === 'receta' && data.medicamentos?.length) {
    cuerpo = `<ol style="margin:0;padding-left:18pt;">` + data.medicamentos.map(m => `
      <li style="margin-bottom:6pt;">
        <b>${esc(m.nombre)}${m.dosis ? ' ' + esc(m.dosis) : ''}</b>${m.via ? ' · ' + esc(m.via) : ''}<br/>
        <span style="font-size:10.5pt;">${esc(m.frecuencia)}${m.duracion ? ' por ' + esc(m.duracion) : ''}${m.indicacion ? ' — ' + esc(m.indicacion) : ''}</span>
      </li>`).join('') + `</ol>`
  } else if (data.tipo === 'orden' && data.estudios?.length) {
    cuerpo = `<div style="font-weight:bold;margin-bottom:4pt;">Estudios solicitados:</div>
      <ol style="margin:0;padding-left:18pt;">` + data.estudios.map(e => `<li style="margin-bottom:3pt;">${esc(e)}</li>`).join('') + `</ol>`
  }

  /**
   * NO SE AFIRMA "NEGADAS" A PARTIR DE UN CAMPO VACÍO.
   *
   * Esto ponía `data.alergias || 'Negadas / no referidas'`. La orden médica NO
   * mandaba el campo `alergias` en su payload, así que su .doc imprimía la
   * negación de alergias para un paciente alérgico — mientras el PDF de esa misma
   * orden sí imprimía la alergia real. Dos documentos del mismo acto médico
   * contradiciéndose, y el peligroso es el que va a un estudio con contraste.
   *
   * "Negadas" es una afirmación clínica: significa que se preguntó y el paciente
   * negó. Un campo vacío significa que no se preguntó. No son lo mismo y el papel
   * no puede confundirlos.
   */
  const alergiaTexto = (data.alergias ?? '').trim()
  const alergias = recetaConfig.mostrarAlergias !== false
    ? `<div style="border:1pt solid #b91c1c;color:#b91c1c;padding:3pt 8pt;font-size:10pt;font-weight:bold;margin:6pt 0;">
        ALERGIAS: ${esc(alergiaTexto || 'Sin registro en el expediente')}</div>`
    : ''

  const dx = (recetaConfig.mostrarDiagnostico !== false && data.diagnostico)
    ? `<div style="margin:4pt 0;"><b>Dx:</b> ${esc(data.diagnostico)}</div>` : ''

  const indicaciones = data.indicaciones
    ? `<div style="margin-top:8pt;"><b>Indicaciones generales:</b><br/>${esc(data.indicaciones).replace(/\n/g, '<br/>')}</div>` : ''
  const nota = data.notaParaPaciente
    ? `<div style="margin-top:6pt;padding:4pt 8pt;border-left:3pt solid ${accent};background:#f5f5f5;font-size:10pt;">${esc(data.notaParaPaciente).replace(/\n/g, '<br/>')}</div>` : ''

  const firma = `
    <div style="margin-top:36pt;text-align:center;">
      <div style="border-top:1pt solid #000;width:240pt;margin:0 auto;padding-top:4pt;font-size:10pt;">
        <b>${esc(medico)}</b><br/>
        ${especialidad ? esc(especialidad) + '<br/>' : ''}
        ${cedula ? 'Cédula Prof. ' + esc(cedula) : '[FALTA CÉDULA PROFESIONAL]'}
        ${recetaConfig.registroDGP ? '<br/>Reg. DGP/SSA ' + esc(recetaConfig.registroDGP) : ''}
      </div>
    </div>`

  const aviso = recetaConfig.avisoLegal
    ? `<div style="margin-top:14pt;font-size:8.5pt;color:#666;text-align:center;border-top:1pt dashed #ccc;padding-top:4pt;">
        ${esc(recetaConfig.avisoLegal)}${recetaConfig.vigenciaDias ? ' · Vigencia: ' + recetaConfig.vigenciaDias + ' días' : ''}</div>`
    : ''

  // mso: configura página carta con márgenes — el médico ajusta luego en Word
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"/>
<style>
  @page { size: 21.6cm 27.9cm; margin: 2cm 2.2cm; }
  body { font-family: 'Calibri', Arial, sans-serif; font-size: 11pt; color: #1a1a1a; }
</style></head>
<body>
  ${encabezado}
  <table style="width:100%;font-size:10pt;margin-bottom:4pt;"><tr>
    <td><b>${titulo}</b></td>
    <td style="text-align:right;color:#666;">Folio: ${esc(data.folio)} · ${fechaTxt}</td>
  </tr></table>
  <div><b>Paciente:</b> ${esc(data.pacienteNombre)}${data.pacienteEdad ? ' · Edad: ' + esc(String(data.pacienteEdad)) : ''}${data.pacienteSexo ? ' · ' + esc(data.pacienteSexo) : ''}${data.pacienteFechaNac ? ' · F. nac.: ' + esc(fmtFechaNacWord(data.pacienteFechaNac)) : ''}</div>
  ${alergias}
  ${dx}
  <hr style="border:none;border-top:0.5pt solid #ccc;margin:6pt 0;"/>
  ${cuerpo}
  ${indicaciones}
  ${nota}
  ${firma}
  ${aviso}
</body></html>`
}

/** Genera y descarga la receta/orden como archivo .doc (editable en Word). */
export function descargarRecetaWord(
  data: RecetaWordData,
  config: ClinicConfig | null,
  recetaConfig: RecetaConfig,
): void {
  const html = construirRecetaHTML(data, config, recetaConfig)
  const blob = new Blob(['﻿', html], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const nombrePac = (data.pacienteNombre || 'paciente').replace(/[^\w\sáéíóúñ-]/gi, '').replace(/\s+/g, '_')
  const fechaCorta = data.fecha.toISOString().slice(0, 10)
  const a = document.createElement('a')
  a.href = url
  a.download = `${data.tipo === 'receta' ? 'Receta' : 'Orden'}_${nombrePac}_${fechaCorta}.doc`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
