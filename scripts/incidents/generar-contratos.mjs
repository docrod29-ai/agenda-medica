/**
 * GENERA LOS DOCUMENTOS QUE NO PUEDEN ENVEJECER SOLOS.
 *
 *     npx tsx scripts/incidents/generar-contratos.mjs
 *
 * Los runbooks y el ejemplo de la consola de soporte salen del CÓDIGO, no de la
 * mano de nadie. Es la lección de `calidad/familias-de-defecto.ts`: una tabla
 * escrita a mano envejece en silencio —el runbook dice «reintentar 5 veces»
 * mientras el código reintenta 3— y una guía que miente es peor que ninguna.
 *
 * El fixture de la consola se genera además para que se pueda MIRAR: un contrato
 * que promete «sin PHI» y del que nadie ha visto una instancia es una promesa.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { RUNBOOKS, incoherenciasDeRunbooks } from '../../src/lib/incidents/runbooks.ts'
import { CATEGORIAS, dimensionesDeCategoria } from '../../src/lib/incidents/taxonomia.ts'
import { agrupar } from '../../src/lib/incidents/agrupacion.ts'
import { evaluarUmbral } from '../../src/lib/incidents/umbrales.ts'
import { nuevoEstado, avanzar, iniciarIntento, cerrarIntento } from '../../src/lib/incidents/maquina.ts'
import { proyectarParaSoporte, auditarVista } from '../../src/lib/incidents/consola-soporte.ts'

const problemas = incoherenciasDeRunbooks()
if (problemas.length) {
  console.error('[contratos] runbooks incoherentes:\n  ' + problemas.join('\n  '))
  process.exit(1)
}

mkdirSync('docs/support', { recursive: true })

// ── 1. Runbooks ────────────────────────────────────────────────────────────
const lista = a => (a.length ? a.map(x => `\`${x}\``).join(', ') : '**ninguna**')
const md = [
  '# Runbooks de incidente',
  '',
  '> **Generado** por `scripts/incidents/generar-contratos.mjs` desde',
  '> `src/lib/incidents/runbooks.ts`. No se edita a mano: una guía escrita aparte',
  '> del código dice «reintentar 5 veces» mientras el código reintenta 3.',
  '',
  'Cada runbook declara **cómo se verifica** que se arregló. Sin ese paso,',
  '«se reintentó» se lee como «se arregló», y así es como un incidente se cierra',
  'estando vivo.',
  '',
  ...RUNBOOKS.flatMap(r => ([
    `## ${r.id} — ${r.titulo}`,
    '',
    `- **Detecta:** categoría \`${r.deteccion.categoria}\`${r.deteccion.subtipos ? ` · subtipos ${r.deteccion.subtipos.map(s => `\`${s}\``).join(', ')}` : ' (toda la categoría)'}`,
    `- **Acciones automáticas permitidas:** ${lista(r.accionesAutomaticas)}`,
    `- **Prohibidas explícitamente:** ${lista(r.accionesProhibidas)}`,
    `- **Qué hace el dueño:** ${r.accionDelDueno ?? '_nada: no hace falta nadie._'}`,
    `- **Qué ve el médico:** «${r.mensajeAlMedico}»`,
    `- **¿Ofrecer reintentar?** ${r.permiteReintento ? 'sí' : 'no'}`,
    `- **Verificación:** ${r.verificacion}`,
    `- **Rollback:** ${r.rollback ?? '_no aplica: no hubo nada que deshacer._'}`,
    '',
  ])),
  '## Dimensiones por categoría',
  '',
  '| Categoría | Severidad | Reintento | Reversibilidad | Idempotencia | Impacto | Dueño |',
  '|---|---|---|---|---|---|---|',
  ...CATEGORIAS.map(c => {
    const d = dimensionesDeCategoria(c)
    return `| \`${c}\` | ${d.severidad} | ${d.reintentabilidad} | ${d.reversibilidad} | ${d.idempotencia} | ${d.impacto} | ${d.dueno} |`
  }),
  '',
  'Estas son el **suelo**, no el techo: quien reporta puede endurecer la',
  'severidad y nunca ablandarla. Si pudiera ablandarla, bastaría con que un',
  'llamador dijera `sev4` para que un incidente de aislamiento dejara de',
  'despertar a nadie.',
  '',
].join('\n')
writeFileSync('docs/support/RUNBOOKS.md', md)

// ── 2. Fixture de la consola de soporte ────────────────────────────────────
const T0 = Date.parse('2026-08-23T09:00:00.000Z')
const eventos = Array.from({ length: 812 }, (_, i) => ({
  categoria: 'ai_provider', subtipo: 'sin_saldo', feature: 'nota',
  ruta: '/consulta/[id]', proveedor: 'anthropic', codigoNormalizado: 'http_400',
  appVersion: 'nexusmed-v1171',
  ocurridoEn: new Date(T0 + i * 400).toISOString(),
  operationId: `op-${i}`, tenantRef: `tref-${String(i % 7).padStart(8, '0')}`,
  correlationId: `c${String(i % 5)}d2e3f4g5h6`,
}))
const { grupos } = agrupar(eventos)
const grupo = grupos[0]
const veredicto = evaluarUmbral(grupo)
let estado = nuevoEstado(grupo.firma, grupo.firstSeen)
estado = avanzar(estado, 'clasificado', grupo.firstSeen)
estado = avanzar(estado, 'agrupado', grupo.firstSeen)
estado = avanzar(estado, 'evaluando', grupo.firstSeen)
estado = avanzar(estado, 'requiere_humano', grupo.firstSeen)
const vista = proyectarParaSoporte({ grupo, estado, veredicto, buildSha: 'd0ab6a7' })

const auditoria = auditarVista(vista)
if (!auditoria.limpia) {
  console.error('[contratos] el fixture de la consola NO está limpio:\n  ' + auditoria.motivos.join('\n  '))
  process.exit(1)
}
writeFileSync('docs/support/consola-soporte-fixture.json', JSON.stringify({
  queEsEsto:
    'Un incidente real proyectado para la consola de soporte. 812 fallos de IA ' +
    'en 7 consultorios. Se puede reparar con esto y no se puede leer el ' +
    'expediente de nadie: no hay identificador de paciente, ni de médico, ni de ' +
    'consultorio — sólo la operación, que es opaca.',
  auditoriaSinPHI: auditoria,
  vista,
}, null, 2) + '\n')

console.log(`[contratos] ${RUNBOOKS.length} runbooks y 1 fixture escritos; fixture limpio de PHI`)
