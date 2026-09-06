/**
 * LA COPIA QUE EL PACIENTE PUEDE LEER.
 *
 * ── EL FALLO QUE ESTO REPARA (ASE-026) ───────────────────────────────────────
 *
 * La entrega de un ARCO de acceso bajaba `JSON.stringify(expediente, null, 2)`
 * y se llamaba `arco_acceso_<id>.json`. Para el ACUSE está bien —el hash se
 * calcula sobre ese paquete exacto y es lo que se puede demostrar ante el
 * INAI—, pero un archivo `.json` no es una «copia comprensible» para un señor
 * de setenta años que ejerció su derecho de acceso.
 *
 * ── LO QUE SE ENTREGA AHORA ──────────────────────────────────────────────────
 *
 * Los DOS archivos, del MISMO paquete:
 *
 *  · el `.json`, que es sobre lo que se calculó el hash — no se toca;
 *  · un `.html` que se abre en cualquier navegador y se imprime a PDF desde
 *    ahí, con el mismo hash impreso en la cabecera.
 *
 * El hash de la cabecera es el del JSON, no el del HTML: lo que se acredita es
 * lo entregado, y lo entregado es el paquete. Decirlo así en el propio documento
 * es la diferencia entre una constancia y un adorno.
 *
 * ── LO QUE NO HACE, Y ESTÁ DECLARADO ─────────────────────────────────────────
 *
 * No genera un PDF: eso exigiría una dependencia nueva o el motor de impresión
 * de las recetas (`print-element`/`pdf-*`), que es de otra rebanada. Un HTML
 * imprimible entrega hoy lo que el paciente necesita leer, y el paso a PDF
 * queda anotado en el handoff.
 *
 * **NEEDS_LEGAL_REVIEW**: si un HTML imprimible satisface el «formato legible»
 * del Art. 33 de la LFPDPPP lo decide el abogado del consultorio, no esta
 * función. Aquí sólo se hace legible lo que ya se entregaba.
 *
 * Módulo PURO: recibe el paquete y devuelve texto. Sin red, sin DOM, sin reloj.
 */

/** Escapa para HTML. Un nombre con «&» o «<» no puede romper el documento. */
function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Un rótulo humano para una clave del paquete («fechaNacimiento» → «Fecha nacimiento»). */
function rotulo(clave: string): string {
  const conEspacios = clave
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .trim()
  return conEspacios.charAt(0).toUpperCase() + conEspacios.slice(1)
}

function valor(v: unknown, nivel = 0): string {
  if (v === null || v === undefined || v === '') return '<em>sin dato</em>'
  if (typeof v === 'boolean') return v ? 'sí' : 'no'
  if (typeof v !== 'object') return esc(v)
  if (Array.isArray(v)) {
    if (!v.length) return '<em>sin registros</em>'
    return `<ul>${v.map(x => `<li>${valor(x, nivel + 1)}</li>`).join('')}</ul>`
  }
  const filas = Object.entries(v as Record<string, unknown>)
    .filter(([k]) => !k.startsWith('_'))
    .map(([k, x]) => `<div class="campo"><span class="rotulo">${esc(rotulo(k))}</span><span class="dato">${valor(x, nivel + 1)}</span></div>`)
  return filas.length ? `<div class="bloque">${filas.join('')}</div>` : '<em>sin dato</em>'
}

export interface DatosDeLaCopia {
  /** El paquete tal cual lo devolvió `/api/arco/acceso`. */
  expediente: Record<string, unknown>
  /** SHA-256 del JSON entregado. Se imprime tal cual. */
  paqueteHash: string
  /** Nombre del consultorio, para que el documento diga quién responde. */
  consultorio?: string
  /** Secciones que no se pudieron leer. Lo que falta SE DECLARA. */
  faltantes?: { seccion: string; motivo?: string }[]
  /** Instante ISO de la entrega. Por parámetro: módulo puro. */
  entregadoEn: string
}

export function copiaLegibleDeArcoAcceso(d: DatosDeLaCopia): string {
  const secciones = Object.entries(d.expediente)
    .filter(([k]) => !k.startsWith('_'))
    .map(([k, v]) => `<section><h2>${esc(rotulo(k))}</h2>${valor(v)}</section>`)
    .join('\n')

  const faltantes = (d.faltantes ?? []).length
    ? `<section class="aviso">
        <h2>Lo que no se pudo incluir</h2>
        <p>Estas partes del expediente no se pudieron leer al armar esta copia. Se declaran
        aquí a propósito: una copia incompleta que parece completa es peor que no tenerla.</p>
        <ul>${d.faltantes!.map(f => `<li>${esc(f.seccion)}${f.motivo ? ` — ${esc(f.motivo)}` : ''}</li>`).join('')}</ul>
       </section>`
    : ''

  return `<!doctype html>
<html lang="es-MX">
<meta charset="utf-8">
<title>Copia de mi expediente clínico</title>
<style>
  body { font: 15px/1.6 -apple-system, "Segoe UI", system-ui, sans-serif; color: #1a1d21; margin: 0; padding: 32px; max-width: 820px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 26px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #d9dde1; }
  .acuse { background: #f4f6f7; border: 1px solid #d9dde1; border-radius: 8px; padding: 12px 14px; font-size: 13px; margin: 16px 0 8px; }
  .acuse code { font-family: ui-monospace, monospace; word-break: break-all; font-size: 12px; }
  .campo { display: flex; gap: 10px; padding: 3px 0; border-bottom: 1px solid #eef1f2; }
  .rotulo { flex: 0 0 200px; color: #5a6169; }
  .dato { flex: 1; min-width: 0; }
  .bloque { margin: 6px 0 6px 6px; }
  ul { margin: 4px 0; padding-left: 20px; }
  em { color: #7a828a; }
  .aviso { background: #fff8e6; border: 1px solid #e6c86a; border-radius: 8px; padding: 12px 14px; }
  @media print { body { padding: 0; } .noimprimir { display: none; } }
</style>
<h1>Copia de mi expediente clínico</h1>
<p>Entrega en respuesta a una solicitud de <strong>acceso</strong> a datos personales
(LFPDPPP, artículos 28 a 33).${d.consultorio ? ` Responsable del tratamiento: <strong>${esc(d.consultorio)}</strong>.` : ''}</p>

<div class="acuse">
  <div><strong>Fecha de la entrega:</strong> ${esc(new Date(d.entregadoEn).toLocaleString('es-MX'))}</div>
  <div><strong>Huella (SHA-256) de lo entregado:</strong> <code>${esc(d.paqueteHash)}</code></div>
  <p style="margin:8px 0 0">Esta huella corresponde al archivo <code>.json</code> que acompaña a esta
  copia: es el paquete exacto que se entregó, y sirve para comprobar que nadie lo cambió después.
  Este documento es la <em>versión legible</em> de ese mismo paquete.</p>
</div>

<p class="noimprimir" style="font-size:13px;color:#5a6169">
  Para guardarlo en PDF: abre el menú de tu navegador, elige <strong>Imprimir</strong> y después
  <strong>Guardar como PDF</strong>.
</p>

${faltantes}
${secciones}
</html>
`
}
