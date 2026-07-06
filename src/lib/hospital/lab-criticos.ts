// ══════════════════════════════════════════════════════════════
// Valores CRÍTICOS de laboratorio (valores de pánico) — motor determinista.
// Marca crítico por RANGO numérico aunque el técnico olvide el flag manual o
// el LIS no lo etiquete. Red de seguridad para alertar al médico.
// Rangos de adulto de referencia; el médico valida el contexto clínico.
// ══════════════════════════════════════════════════════════════

interface RangoCritico { re: RegExp; bajo?: number; alto?: number }

const CRITICOS: RangoCritico[] = [
  { re: /potasio|\bk\b|kalio/, bajo: 2.5, alto: 6.5 },
  { re: /sodio|\bna\b|natrem/, bajo: 120, alto: 160 },
  { re: /glucosa|glicemia|glucemia/, bajo: 50, alto: 400 },
  { re: /calcio/, bajo: 6, alto: 13 },
  { re: /magnesio/, bajo: 1, alto: 4.7 },
  { re: /fosfor|fosfat/, bajo: 1, alto: 9 },
  { re: /hemoglobina|\bhb\b/, bajo: 7, alto: 20 },
  { re: /plaqueta/, bajo: 20, alto: 1000 },   // ×10³/µL
  { re: /leucocito/, bajo: 1, alto: 50 },      // ×10³/µL
  { re: /lactato/, alto: 4 },
  { re: /\binr\b/, alto: 5 },
  { re: /fibrinogeno/, bajo: 100 },
  { re: /\bph\b/, bajo: 7.2, alto: 7.6 },
  { re: /pco2|paco2/, alto: 60 },
  { re: /po2|pao2/, bajo: 55 },
  { re: /troponina/, alto: 0.04 },
  { re: /creatinina/, alto: 4 },
  { re: /bilirrubina/, alto: 15 },
]

/** ¿El valor numérico de este estudio cae en rango crítico (pánico)? */
export function esCriticoLab(estudio: string, valor: string | number): boolean {
  const v = typeof valor === 'number' ? valor : parseFloat(String(valor).replace(',', '.'))
  if (isNaN(v)) return false
  const norm = (estudio || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  for (const r of CRITICOS) {
    if (r.re.test(norm)) {
      if (r.bajo != null && v < r.bajo) return true
      if (r.alto != null && v > r.alto) return true
    }
  }
  return false
}
