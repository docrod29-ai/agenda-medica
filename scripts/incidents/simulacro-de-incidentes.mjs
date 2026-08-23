/**
 * EL SIMULACRO DE INCIDENTES — se corre entero sin tocar producción.
 *
 *     npx tsx scripts/incidents/simulacro-de-incidentes.mjs
 *
 * ── POR QUÉ EL RELOJ ES UNA CONSTANTE ────────────────────────────────────────
 *
 * Con `Date.now()` el informe cambiaría en cada ejecución y no se podría
 * comparar con el anterior. Un informe que no se puede comparar no detecta que
 * el motor empeoró — que es la única razón para guardarlo.
 *
 * ── QUÉ NO HACE ──────────────────────────────────────────────────────────────
 *
 * No llama a ningún proveedor, no escribe en ninguna base, no gasta un peso y no
 * necesita credenciales. Todo lo que mide es del motor de incidentes.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { correrTodos } from '../../src/lib/incidents/simulacro.ts'
import { ESCENARIOS } from '../../src/lib/incidents/escenarios.ts'
import { comoSeDice } from '../../src/lib/incidents/mttd-mttr.ts'

/** 2026-08-23T09:00:00Z. Fijo a propósito: ver la cabecera. */
const T0 = Date.parse('2026-08-23T09:00:00.000Z')
const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? 'simulacro'

const informe = correrTodos(ESCENARIOS, T0, VERSION)

mkdirSync('docs/support', { recursive: true })
writeFileSync('docs/support/simulacro-incidentes.json', JSON.stringify(informe, null, 2) + '\n')

const ms = v => (v === null ? '—' : `${(v / 1000).toFixed(1)} s`)
const si = b => (b ? 'sí' : 'no')

const md = [
  '# Simulacro de incidentes — informe',
  '',
  `**Generado con:** ${informe.generadoCon}.`,
  `**Reloj:** \`${informe.t0}\` (constante). **Versión:** \`${informe.appVersion}\`.`,
  `**Conformes:** ${informe.conformes}/${informe.total}.`,
  '',
  '> Este informe mide el MOTOR de incidentes. No mide la red, ni el proveedor,',
  '> ni la base de datos. Ver «Lo que este informe NO demuestra» al final.',
  '',
  '## Escenarios',
  '',
  '| # | Escenario | Eventos | Grupos | ¿Incidente? | ¿Repara solo? | Intentos | Desenlace | ¿Avisa? | Runbook | MTTD | MTTR |',
  '|---|---|--:|--:|---|---|--:|---|---|---|--:|--:|',
  ...informe.escenarios.map(r => [
    '', r.id, r.titulo, r.eventosGenerados, r.grupos, si(r.esIncidente),
    si(r.remediacionPermitida), r.intentos, r.desenlace, si(r.avisoRequerido),
    r.runbookId, ms(r.mttdMs), ms(r.mttrMs), '',
  ].join(' | ').replace(/^ \| /, '| ').replace(/ \| $/, ' |')),
  '',
  '## Tiempos agregados',
  '',
  `- **MTTD:** ${comoSeDice(informe.tiempos.mttd)} · peor caso ${ms(informe.tiempos.peorMttdMs)}`,
  `- **MTTR:** ${comoSeDice(informe.tiempos.mttr)} · peor caso ${ms(informe.tiempos.peorMttrMs)}`,
  '',
  '## Por qué cada uno decidió lo que decidió',
  '',
  ...informe.escenarios.flatMap(r => ([
    `### ${r.id} — ${r.titulo}`,
    '',
    `- **Firma:** \`${r.firma ?? '—'}\``,
    `- **Raya:** ${r.veredicto.porQue}`,
    `- **Política de reparación:** ${r.porQueLaRemediacion}`,
    `- **Lo que ve el médico:** «${r.mensajeAlMedico.whatFailed}» · seguridad del dato: «${r.mensajeAlMedico.dataSafety}» · reintentar: ${si(r.mensajeAlMedico.retryAvailable)} · visibilidad: ${r.mensajeAlMedico.visibilidad}`,
    ...(r.veredicto.noEvaluado.length ? [`- **No evaluado:** ${r.veredicto.noEvaluado.join('; ')}`] : []),
    ...(r.conforme ? [] : [`- **DISCREPANCIA:** ${r.discrepancias.join('; ')}`]),
    '',
  ])),
  '## Lo que este informe NO demuestra',
  '',
  ...informe.loQueNoDemuestra.map(x => `- ${x}`),
  '',
].join('\n')

writeFileSync('docs/support/SIMULACRO-INCIDENTES.md', md)

console.log(`[simulacro] ${informe.conformes}/${informe.total} conformes`)
for (const r of informe.escenarios) {
  if (!r.conforme) console.error(`  ✗ ${r.id}: ${r.discrepancias.join('; ')}`)
}
process.exit(informe.conformes === informe.total ? 0 : 1)
