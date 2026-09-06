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
import { SIN_REGISTRO_DE_ALERGIAS } from '@/lib/impreso-medico'
import { fechaISOLocal } from '@/lib/timezone'
import { conEtiquetaDeEdad } from '@/lib/edad-legible'
import { marcaDelRenglonImpreso } from '@/lib/receta-renglon-impreso'

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
  /** REG-507 — membrete ya convertido a data URI por `descargarRecetaWord`. */
  membreteResuelto?: string,
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
  // NOTA sobre el WORD (auditoría flujo 2026-07): Word NO reproduce bien un DISEÑO a
  // página completa con texto superpuesto (sale "mocho y mal acomodado"). Por eso el
  // Word es la versión LIMPIA y editable (encabezado de texto o el membrete pequeño),
  // pensada para pegar sobre tu papel o editar; el diseño completo va FIEL en
  // Imprimir/PDF. Solo se usa el membrete CHICO de plantilla si existe.
  const membreteSrc = (() => {
    // Si el médico usa un DISEÑO a página completa, el Word NO lo reproduce bien
    // (mezcla la maqueta con su arte = "mocho"). Con diseño → texto limpio; el arte
    // va fiel en Imprimir/PDF. Solo se usa el membrete CHICO cuando NO hay diseño.
    if (recetaConfig.disenoCompletoDataUrl) return ''
    const u = recetaConfig.membreteDataUrl
    if (!u) return ''
    // REG-507: si ya se resolvió a un data URI autocontenido, ese gana.
    if (membreteResuelto) return membreteResuelto
    if (/^(data:|https?:)/i.test(u)) return u
    if (typeof window === 'undefined') return u
    return new URL(u, window.location.origin).href
  })()

  // Encabezado: membrete pequeño de plantilla o datos del médico (limpio)
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
    // MP-005 — si al renglón le falta la concentración (o la unidad, o la
    // cantidad), la marca viaja con el documento: el .doc se reenvía por
    // WhatsApp y se enseña en el mostrador, donde nadie ve la pantalla del
    // médico.
    cuerpo = `<ol style="margin:0;padding-left:18pt;">` + data.medicamentos.map(m => {
      const marca = marcaDelRenglonImpreso(m)
      return `
      <li style="margin-bottom:6pt;">
        <b>${esc(m.nombre)}${m.dosis ? ' ' + esc(m.dosis) : ''}</b>${m.via ? ' · ' + esc(m.via) : ''}${marca ? ` <span style="color:#b91c1c;font-weight:bold;">· ${esc(marca)}</span>` : ''}<br/>
        <span style="font-size:10.5pt;">${esc(m.frecuencia)}${m.duracion ? ' por ' + esc(m.duracion) : ''}${m.indicacion ? ' — ' + esc(m.indicacion) : ''}</span>
      </li>`
    }).join('') + `</ol>`
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
        ALERGIAS: ${esc(alergiaTexto || SIN_REGISTRO_DE_ALERGIAS)}</div>`
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
  <div><b>Paciente:</b> ${esc(data.pacienteNombre)}${conEtiquetaDeEdad(data.pacienteEdad) ? ' · ' + esc(conEtiquetaDeEdad(data.pacienteEdad)) : ''}${data.pacienteSexo ? ' · ' + esc(data.pacienteSexo) : ''}${data.pacienteFechaNac ? ' · F. nac.: ' + esc(fmtFechaNacWord(data.pacienteFechaNac)) : ''}</div>
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

/**
 * ¿Es una URL RELATIVA del proxy del diseño? Sólo ésas se pueden traer
 * same-origin con la sesión del navegador.
 */
const ES_PROXY_RELATIVO = (u: string): boolean => u.startsWith('/api/receta/diseno')

/**
 * REG-507 — el membrete del .doc, autocontenido.
 *
 * El .doc guardaba un ENLACE ABSOLUTO al proxy (`/api/receta/diseno?path=…`) y
 * Word lo pedía al abrir el archivo desde el disco: sin sesión y sin firma. Eso
 * funcionaba sólo porque la ruta aceptaba enlaces sin firmar, que es justo el
 * hueco que `RECETA_DISENO_FIRMA=obligatoria` viene a cerrar.
 *
 * Se trae la imagen aquí —dentro de la app, con la sesión puesta— y se incrusta
 * en el documento. El .doc deja de depender de la red, de la sesión y del
 * candado, y de paso deja de caducar.
 *
 * **Nunca lanza ni bloquea**: si algo falla se devuelve la URL de siempre y el
 * documento sale como salía. Mismo contrato que `firmarImagenesDiseno`.
 */
export async function resolverMembreteParaWord(u: string, timeoutMs = 4000): Promise<string> {
  if (!u || !ES_PROXY_RELATIVO(u) || typeof window === 'undefined') return u
  try {
    const control = new AbortController()
    const t = setTimeout(() => control.abort(), timeoutMs)
    const r = await fetch(new URL(u, window.location.origin).href, { signal: control.signal })
    clearTimeout(t)
    if (!r.ok) return u
    const blob = await r.blob()
    const dataUri = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(String(fr.result ?? ''))
      fr.onerror = () => reject(new Error('no se pudo leer el membrete'))
      fr.readAsDataURL(blob)
    })
    return dataUri.startsWith('data:image/') ? dataUri : u
  } catch {
    return u
  }
}

/** Genera y descarga la receta/orden como archivo .doc (editable en Word). */
export async function descargarRecetaWord(
  data: RecetaWordData,
  config: ClinicConfig | null,
  recetaConfig: RecetaConfig,
): Promise<void> {
  const membreteResuelto = recetaConfig.disenoCompletoDataUrl
    ? undefined
    : await resolverMembreteParaWord(recetaConfig.membreteDataUrl ?? '')
  const html = construirRecetaHTML(data, config, recetaConfig, membreteResuelto)
  const blob = new Blob(['﻿', html], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const nombrePac = (data.pacienteNombre || 'paciente').replace(/[^\w\sáéíóúñ-]/gi, '').replace(/\s+/g, '_')
  // C-015 — mismo motivo que en la nota: el día en UTC corría la fecha del
  // nombre del archivo.
  const fechaCorta = fechaISOLocal(data.fecha)
  const a = document.createElement('a')
  a.href = url
  a.download = `${data.tipo === 'receta' ? 'Receta' : 'Orden'}_${nombrePac}_${fechaCorta}.doc`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * VER E IMPRIMIR LA RECETA SIN WORD — PC-022 · PP-014.
 *
 * ── EL DEFECTO ───────────────────────────────────────────────────────────────
 *
 * El único botón de «Descargar» del portal del paciente entrega un `.doc`
 * (HTML disfrazado de Word). En un teléfono de gama baja sin Word no abre; la
 * madre que va a la farmacia acaba enseñando una captura de pantalla. Y el
 * archivo que queda en la carpeta de descargas compartida lleva el nombre del
 * paciente, así que se identifica solo.
 *
 * ── LO QUE HACE ──────────────────────────────────────────────────────────────
 *
 * Abre EL MISMO documento —el mismo HTML— en una ventana del navegador y lanza
 * el diálogo de impresión, desde donde cualquier teléfono moderno guarda un
 * PDF. No se genera un segundo formato ni una segunda plantilla: una entidad,
 * dos vistas.
 *
 * El `.doc` se queda: hay médicos que lo quieren editable, y REG-507 lo
 * documenta. Lo que cambia es que deja de ser la ÚNICA salida.
 *
 * ── LO QUE NO CUBRE ──────────────────────────────────────────────────────────
 *
 * · No firma electrónicamente la receta ni añade el QR de verificación: eso
 *   vive en el impreso del médico (`RecetaDocumento`), no aquí.
 * · No cablea el botón del portal (`src/app/mi/[token]`): esa pantalla es de
 *   otra rebanada y está en el handoff.
 * · Si el navegador bloquea las ventanas emergentes se avisa y NO se abre nada,
 *   el mismo criterio de `print-element.ts`.
 */
export type ResultadoImprimible = 'abierta' | 'bloqueada' | 'sin-navegador'

export async function abrirRecetaParaImprimir(
  data: RecetaWordData,
  config: ClinicConfig | null,
  recetaConfig: RecetaConfig,
  onError?: (mensaje: string) => void,
): Promise<ResultadoImprimible> {
  if (typeof window === 'undefined') return 'sin-navegador'
  const membreteResuelto = recetaConfig.disenoCompletoDataUrl
    ? undefined
    : await resolverMembreteParaWord(recetaConfig.membreteDataUrl ?? '')
  const html = construirRecetaHTML(data, config, recetaConfig, membreteResuelto)
  const win = window.open('', '_blank', 'width=900,height=1000')
  if (!win) {
    const msg = 'No se pudo abrir la ventana para imprimir (el navegador la bloqueo). ' +
      'Permite las ventanas emergentes de este sitio, o usa «Descargar» para guardar el archivo.'
    if (onError) onError(msg)
    // eslint-disable-next-line no-alert
    else window.alert(msg)
    return 'bloqueada'
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.onafterprint = () => { try { win.close() } catch { /* — */ } }
  // Un respiro para que el navegador maquete antes del dialogo; si no llega a
  // tiempo, la ventana queda abierta con el documento y el paciente imprime
  // desde el menu. Nunca se cierra sola sin haber ensenado nada.
  setTimeout(() => { try { win.focus(); win.print() } catch { /* — */ } }, 250)
  return 'abierta'
}

export const POR_QUE_NO_BASTA_EL_DOC =
  'Porque el paciente no necesita editar su receta: necesita verla y ' +
  'ensenarla. Un formato editable que su telefono no abre es, para el, un ' +
  'archivo roto.'
