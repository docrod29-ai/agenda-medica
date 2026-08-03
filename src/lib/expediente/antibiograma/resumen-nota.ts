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

  /**
   * La nota imprime la interpretación EFECTIVA (E0-15a). Antes usaba el panel
   * crudo y podía imprimir «Levofloxacino S» en la misma hoja donde el motor
   * decía R — contradicción dentro del mismo documento clínico.
   * El dato del laboratorio NO se oculta: se muestra junto a la edición.
   */
  const efectivos = r.resultadosEfectivos?.length ? r.resultadosEfectivos : entrada.resultados
  const panel = efectivos
    .filter(x => x.antibiotico?.trim())
    .map(x => {
      const cmi = typeof x.cmi === 'number' ? ` (CMI ${x.cmiCensurada ?? ''}${x.cmi})` : ''
      const editado = x.interpretacionLab && x.interpretacionLab !== x.interpretacion
      return `${x.antibiotico} ${x.interpretacion}${cmi}${editado ? ` [lab: ${x.interpretacionLab} → ${x.interpretacion} por regla experta]` : ''}`
    })
  if (panel.length) L.push(`Panel: ${panel.join(' · ')}`)

  // Las ediciones se declaran explícitamente con su fuente, no solo en la celda.
  if (r.edicionesInterpretativas?.length) {
    L.push(`Interpretación Nexus (regla experta): ${r.edicionesInterpretativas.map(e => `${e.antibiotico} ${e.de}→${e.a} — ${e.razon} [${e.referencia}]`).join(' · ')}`)
  }

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

  /**
   * Lo accionable va al final y destacado. Antes SOLO pasaban las 'critica' y
   * las de nivel 'alta' se descartaban en silencio: una alerta que el motor
   * consideró relevante desaparecía del documento clínico. Ahora pasan ambas,
   * separadas para que la jerarquía siga siendo legible.
   */
  const criticas = r.alertas.filter(a => a.nivel === 'critica')
  const altas = r.alertas.filter(a => a.nivel === 'alta')
  if (criticas.length) {
    L.push('')
    L.push(`ALERTAS: ${criticas.map(a => a.mensaje).join(' | ')}`)
  }
  if (altas.length) {
    if (!criticas.length) L.push('')
    L.push(`Atención: ${altas.map(a => a.mensaje).join(' | ')}`)
  }
  if (r.aislamiento) L.push(`Aislamiento: ${r.aislamiento}`)
  if (r.notificacionObligatoria) L.push('Notificación epidemiológica OBLIGATORIA.')

  /**
   * LA DIDÁCTICA DEJA DE PERDERSE. Es donde viven los resultados NEGATIVOS de las
   * confirmatorias —«tamiz de cefoxitina negativo: no hay mecA, es MSSA»,
   * «D-test negativo: la clindamicina SÍ puede usarse»—, que el motor leía,
   * tipaba, transportaba… y esta función no imprimía nunca. La pantalla sí los
   * enseñaba; la nota, que es lo que queda en el expediente, no.
   *
   * Va DESPUÉS de lo accionable y sin la referencia completa: es el porqué, no la
   * orden, y alargar la nota con las citas la vuelve ilegible.
   */
  if (r.didactica.length) {
    L.push('')
    L.push(`Interpretación: ${r.didactica.map(d => `${d.titulo} — ${d.texto}`).join(' ')}`)
  }

  if (r.pruebasSugeridas.length) {
    L.push('')
    L.push(`Pruebas por solicitar: ${r.pruebasSugeridas.map(p => p.nombre).join('; ')}`)
  }
  /**
   * Lo que se recorta se dice: sin esta línea, una prueba desaparecida de la
   * lista no deja distinguir «no aplicaba» de «ya estaba hecha».
   */
  if (r.pruebasYaReportadas?.length) {
    if (!r.pruebasSugeridas.length) L.push('')
    L.push(`Ya vienen en el reporte (no se piden de nuevo): ${r.pruebasYaReportadas.map(p => p.nombre).join('; ')}`)
  }

  return L.join('\n')
}
