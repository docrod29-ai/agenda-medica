// ════════════════════════════════════════════════════════════════════
// Composición de la nota (estructurada) — port PURO de _txValCompose.
// Convierte los campos hc_* en pares [título, valor] para la nota/Word.
// `shown` = grupos de chips que SÍ se mostraron (según el motivo); solo esos se
// documentan, para no afirmar negativos de algo no evaluado.
// ════════════════════════════════════════════════════════════════════
import { TX_CHIPS, TX_EST_CATS } from './catalogos'

type V = Record<string, string>

function chipsLine(v: V, gk: string): string {
  const grp = TX_CHIPS[gk]
  if (!grp) return ''
  const keys = Object.keys(grp.items)
  const pos: string[] = []
  let negN = 0
  for (const c of keys) {
    if (v['hc_cb_' + gk + '_' + c] === '1') pos.push(grp.items[c])
    else negN++
  }
  if (!pos.length) return grp.noneL || 'Negativos'
  const posL = grp.posL || 'Presentes'
  const restoW = gk === 'vac' ? 'pendiente' : 'negado'
  return posL + ': ' + pos.join(', ') + (negN ? ' (resto ' + restoW + ')' : '')
}

function resultadosLine(v: V): string {
  const a: string[] = []
  for (const c of TX_EST_CATS) {
    for (const k in c.items) {
      const val = (v['hc_res_' + k] || '').trim()
      if (val && val !== '—') a.push(c.items[k] + ': ' + val.toLowerCase())
    }
  }
  const o = (v['hc_res_otros'] || '').trim()
  if (o) a.push(o)
  return a.join('; ')
}

/**
 * @param v       campos hc_*
 * @param shown   grupos de chips mostrados (default: todos)
 * @returns lista [título, valor] sin entradas vacías.
 */
export function compose(v: V, shown?: Set<string>): Array<[string, string]> {
  const g = (id: string) => (v[id] || '').trim()
  const show = shown || new Set(Object.keys(TX_CHIPS))
  const chips = (gk: string) => (show.has(gk) ? chipsLine(v, gk) : '')
  const rows: Array<[string, string]> = [
    ['Padecimiento actual / motivo de la interconsulta', g('hc_padecimiento')],
    ['Comorbilidades', chips('comorb')],
    ['Dispositivos', chips('disp')],
    ['Hábitos', chips('habitos')],
    ['Inmunosupresión actual', chips('inmuno')],
    ['Profilaxis activas', chips('prof')],
    ['Antecedentes infectológicos', chips('infecto')],
    ['Exposiciones epidemiológicas', chips('expos')],
    ['Vacunación', chips('vac')],
    ['Alergias', g('hc_alergias')],
    ['Resultados', resultadosLine(v)],
    ['Evolución', g('hc_evolucion')],
    ['Notas', g('hc_notas')],
  ]
  return rows.filter((r) => r[1])
}
