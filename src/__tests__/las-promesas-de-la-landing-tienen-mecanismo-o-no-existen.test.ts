/**
 * REP-060 · N-004 y N-005 (N-negocio) — dos promesas públicas sin mecanismo:
 * «los primeros 50 médicos congelan su tarifa de por vida» y «Te avisamos tres
 * días antes» de que acabe la prueba.
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 * N-004 · `src/app/precios/page.tsx:193`: «Precio fundador — los primeros 50
 * médicos congelan su tarifa de por vida. Aplica tu código FUNDADOR al pagar».
 * `grep FUNDADOR src/` → sólo texto (precios:193, (dashboard)/layout.tsx:496) y
 * el comentario junto a `allow_promotion_codes: true` (checkout/route.ts:137).
 * No hay contador de plazas, ni comprobación de que queden, ni campo en
 * clinics/{id} que congele la tarifa cuando el catálogo suba.
 * `src/lib/authz/fundador.ts` es OTRA cosa (el dueño de la plataforma).
 *
 * N-005 · `src/app/page.tsx:207`: «Te avisamos tres días antes…». `vercel.json`
 * declara cinco crons (reminders, limpiar-audio, vigilante, retencion,
 * asientos) y ninguno mira `trialEndsAt`. No existe canal de correo en el
 * repositorio. El único control es el banner de (dashboard)/layout.tsx:117-121,
 * que exige que el médico entre — y el que se pierde es el que dejó de entrar.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor N-negocio, N-004 y N-005; equipo rojo confirmado P1 ambos (verificó
 * que `esFundador` no es la oferta comercial y que el aviso «no está apagado:
 * no está construido»).
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * Texto de arranque publicado como oferta. Contradice la propia portada
 * (page.tsx:157: «lo que publicamos … es una oferta real»).
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * el-dato-tiene-que-llegar («escrito y sin conectar», aquí: prometido y sin
 * construir). CLAUDE.md: «Prueba de 14 días … nunca bloquear la app entera» —
 * la promesa de aviso es la mitad de esa decisión. Decisión del dueño: ¿la
 * oferta fundador existe? Si sí, se construye; si no, se retira la frase.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * CONTRATO TEXTUAL declarado (son páginas y configuración de despliegue). La
 * forma es «cada promesa tiene su mecanismo O no existe»: cada caso pasa
 * también si la frase se retira, porque ésa es una salida honesta que el
 * hallazgo contempla. Los nombres del mecanismo (`tarifaCongelada`, tope/cupo
 * de fundadores, cron sobre `trialEndsAt`) son los de la propuesta del auditor.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No cubre la otra mención en (dashboard)/layout.tsx:496 (hereda el problema).
 * No cubre al médico sin correo verificado (N-2). No comprueba que el cupón
 * exista en Stripe (eso es del otro lado: verificar-invariantes-de-datos). No
 * prueba que el correo se mande: sólo que exista la selección programada.
 * Si el arreglo nombra el mecanismo de otra forma, se ajusta la regex, no la
 * expectativa.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync, existsSync } from 'fs'
import path from 'path'

const raiz = path.resolve(__dirname, '../..')
const leer = (rel: string) => readFileSync(path.join(raiz, rel), 'utf8')

function archivos(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e)
    if (statSync(p).isDirectory()) archivos(p, out)
    else if (/\.(tsx|ts)$/.test(e) && !p.includes(`${path.sep}__tests__${path.sep}`)) out.push(p)
  }
  return out
}
const codigo = [...archivos(path.join(raiz, 'src/lib')), ...archivos(path.join(raiz, 'src/app/api'))]
  .filter(f => !f.endsWith(path.join('authz', 'fundador.ts')))
const contiene = (re: RegExp) => codigo.filter(f => re.test(readFileSync(f, 'utf8'))).map(f => path.relative(raiz, f))

describe('REP-060 · N-004 · «los primeros 50 médicos congelan su tarifa de por vida»', () => {
  const precios = leer('src/app/precios/page.tsx')
  const prometeEscasez = /primeros\s+\d+\s+m[eé]dicos/i.test(precios)
  const prometePermanencia = /congelan su tarifa|de por vida/i.test(precios)

  it('si se promete escasez (N plazas), existe un tope/cupo de fundadores en el código (hoy: no)', () => {
    if (!prometeEscasez) return
    const donde = contiene(/(tope|cupo|plazas)\w*fundador|fundador\w*(tope|cupo|plazas)/i)
    expect(donde, 'la escasez sólo vende si es verdad y se ve agotarse').not.toHaveLength(0)
  })

  it('si se promete permanencia, existe la marca de tarifa congelada por consultorio (hoy: no)', () => {
    if (!prometePermanencia) return
    const donde = contiene(/tarifaCongelada/)
    expect(donde, '«de por vida» dura hasta la próxima edición del catálogo').not.toHaveLength(0)
  })
})

describe('REP-060 · N-005 · «Te avisamos tres días antes»', () => {
  const portada = leer('src/app/page.tsx')
  const promete = /avisamos tres d[ií]as antes/i.test(portada)
  const crons = (JSON.parse(leer('vercel.json')) as { crons: { path: string }[] }).crons

  it('control: vercel.json tiene crons declarados (el mecanismo tendría dónde vivir)', () => {
    expect(crons.length).toBeGreaterThan(0)
  })

  it('si se promete el aviso, algún cron DECLARADO en vercel.json mira trialEndsAt (hoy: ninguno)', () => {
    if (!promete) return
    const conAviso = crons.filter(c => {
      const ruta = path.join(raiz, 'src/app', c.path, 'route.ts')
      return existsSync(ruta) && /trialEndsAt/.test(readFileSync(ruta, 'utf8'))
    })
    expect(conAviso.map(c => c.path), `crons: ${crons.map(c => c.path).join(', ')} — ninguno mira trialEndsAt`).not.toHaveLength(0)
  })
})
