import type { EntradaAntibiograma, InterpretacionAntibiograma } from './tipos'

/**
 * Convierte la interpretación del antibiograma en texto para la nota clínica.
 *
 * POR QUÉ EXISTE: el antibiograma vivía en una pantalla aparte, así que su
 * conclusión —el fenotipo, el mecanismo, la terapia dirigida, el aislamiento—
 * había que reescribirla a mano en la nota. Para un infectólogo es justo la
 * herramienta cuyo resultado más veces tiene que quedar en el expediente.
 *
 * Se incluye el PANEL además de la conclusión: sin él, la nota afirma un
 * mecanismo de resistencia sin el dato que lo sustenta, y en seis meses nadie
 * puede reconstruir de dónde salió.
 *
 * Puro y determinista → testeable.
 */
export function resumenParaNota(
  entrada: EntradaAntibiograma,
  r: InterpretacionAntibiograma,
): string {
  const L: string[] = []

  L.push(`ANTIBIOGRAMA — ${entrada.organismo || 'organismo no especificado'}${entrada.sitio && entrada.sitio !== 'otro' ? ` (${entrada.sitio})` : ''}`)

  const panel = entrada.resultados
    .filter(x => x.antibiotico?.trim())
    .map(x => `${x.antibiotico} ${x.interpretacion}${typeof x.cmi === 'number' ? ` (CMI ${x.cmiCensurada ?? ''}${x.cmi})` : ''}`)
  if (panel.length) L.push(`Panel: ${panel.join(' · ')}`)

  if (r.fenotipos.length) {
    L.push('')
    L.push(`Fenotipo: ${r.fenotipos.map(f => `${f.nombre} [${f.confianza}]`).join('; ')}`)
  }
  if (r.mecanismos.length) {
    L.push(`Mecanismo: ${r.mecanismos.map(m => `${m.nombre}${m.ambler ? ` (Ambler ${m.ambler})` : ''}`).join('; ')}`)
  }

  const conflictos = r.resistenciaIntrinseca.filter(n => n.tipo === 'conflicto')
  if (conflictos.length) {
    L.push(`Conflicto con la resistencia intrínseca de la especie: ${conflictos.map(c => c.antibiotico).join(', ')} — reconfirmar identificación.`)
  }

  if (r.terapiaDirigida.length) {
    L.push('')
    L.push('Terapia:')
    for (const t of r.terapiaDirigida) {
      L.push(`  · [${t.linea}] ${t.agente} — ${t.razon}`)
    }
  }

  if (r.optimizacionPKPD.length) {
    L.push('')
    L.push(`PK/PD: ${r.optimizacionPKPD.join(' ')}`)
  }

  if (r.advertencias.length) {
    L.push('')
    L.push(`Advertencias: ${r.advertencias.join(' ')}`)
  }

  // Lo accionable va al final y destacado: es lo que hay que ejecutar hoy.
  const criticas = r.alertas.filter(a => a.nivel === 'critica')
  if (criticas.length) {
    L.push('')
    L.push(`ALERTAS: ${criticas.map(a => a.mensaje).join(' | ')}`)
  }
  if (r.aislamiento) L.push(`Aislamiento: ${r.aislamiento}`)
  if (r.notificacionObligatoria) L.push('Notificación epidemiológica OBLIGATORIA.')

  if (r.pruebasSugeridas.length) {
    L.push('')
    L.push(`Pruebas por solicitar: ${r.pruebasSugeridas.map(p => p.nombre).join('; ')}`)
  }

  return L.join('\n')
}
