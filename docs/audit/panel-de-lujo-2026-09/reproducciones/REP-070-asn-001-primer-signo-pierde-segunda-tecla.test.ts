/**
 * REP-070 · ASN-001 (AS-enfermería) — el primer signo vital tecleado en una
 * consulta recién abierta pierde su segunda tecla: «154» → «14», «36.7» → «3.7».
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 * La pregunta «¿el formulario está vacío?» tiene DOS respuestas en el mismo
 * archivo:
 *   · `hayAlgoQuePerder` (src/lib/expediente/el-borrador-no-se-pierde.ts:103,
 *     vía `CAMPOS_DEL_BORRADOR`) SÍ cuenta los signos vitales → el espejo en
 *     memoria se escribe tras la PRIMERA tecla con `{signos:{peso:'1'}}`
 *     (page.tsx:3613-3630).
 *   · `vacio` (src/app/(dashboard)/consulta/[patientId]/page.tsx:3494-3495) NO
 *     cuenta signos, estudios, preop ni próxima consulta.
 * Con eso `queHacerConElRespaldoLocal` (src/lib/mobile/local-drafts.ts:136)
 * recibe `formularioVacio:true` sobre un formulario que ya tiene «15» escrito,
 * contesta `APLICAR_SOLO`, y page.tsx:3564 repone el espejo de hace una tecla
 * ENCIMA del estado vivo. La regla escrita en local-drafts.ts:81 —«nunca se
 * aplica solo si hay algo escrito»— se incumple porque quien la llama no ve lo
 * escrito.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor AS-enfermería, hallazgo ASN-001, P1. Equipo rojo (R-AS-enfermeria):
 * REPRODUCIDO EN VIVO 3/3 con Playwright y contexto limpio (peso «154»→«14»,
 * TA «120/80»→«10/80», temperatura «36.7»→«3.7»; el segundo campo tecleado
 * nunca pierde nada). Mecanismo: `voz` es un objeto nuevo en cada render, el
 * efecto de restauración corre en cada commit y en el de la 1ª tecla sale por
 * `if (!b) return` (:3493) sin fijar `autoRestRef`.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * La misma familia de REG-300: la lista de «qué cuenta como contenido» se
 * unificó en `CAMPOS_DEL_BORRADOR` para cinco copias, pero `vacio` es una sexta
 * copia escrita a mano que no se importó de la lista. Dos respuestas a una
 * pregunta; la que decide si se PISA lo escrito es la incompleta.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * Seguridad clínica §3: nada cambia en silencio. local-drafts.ts:81: «Nunca se
 * aplica solo si hay algo escrito. Se ofrece, que es visible y reversible».
 * el-borrador-no-se-pierde.ts: «la regla no se vuelve a copiar: se importa».
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * HÍBRIDA, declarada. La página es un componente cliente que no se monta en
 * node, así que la expresión `const vacio = …` se EXTRAE del texto de page.tsx
 * y se EVALÚA (new Function) contra estados sintéticos; el resultado se mete en
 * el motor real `queHacerConElRespaldoLocal` y se compara con el motor real
 * `hayAlgoQuePerder`. No es una regex sobre la forma: es la expresión de la
 * página corriendo de verdad. Si la reparación deriva `vacio` de
 * `hayAlgoQuePerder`/`CAMPOS_DEL_BORRADOR`, la expresión sigue evaluándose (se
 * inyectan los dos). Si la reparación ELIMINA la variable `vacio`, la extracción
 * falla con un mensaje explícito y hay que adaptar esta prueba — no es un
 * defecto de la reparación.
 *
 * Una reparación que SÓLO marque `autoRestRef` en la rama `!b` deja esta prueba
 * en rojo A PROPÓSITO: la asimetría entre las dos preguntas es un defecto por sí
 * misma (cualquier respaldo cuyo único contenido sean signos se aplicaría
 * encima de un formulario con signos).
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No monta la pantalla ni teclea: no demuestra que la 2ª tecla se pierda en el
 * DOM (eso lo hizo el equipo rojo 3/3 en vivo). No cubre el segundo mecanismo
 * (el efecto que vuelve a correr por `voz` inestable y `!b` sin marcar
 * `autoRestRef`). No cubre la restauración manual (`restaurarRespaldo`). No
 * cubre el build de producción, que el auditor deja pendiente de verificar.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import {
  hayAlgoQuePerder, guardarRespaldoLocal, signosConValor, CAMPOS_DEL_BORRADOR,
  type EstadoDelBorrador,
} from '@/lib/expediente/el-borrador-no-se-pierde'
import { queHacerConElRespaldoLocal } from '@/lib/mobile/local-drafts'

const raiz = path.resolve(__dirname, '../../../..')
const pagina = readFileSync(
  path.join(raiz, 'src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx'), 'utf8')

/** Lo que la página tiene en la mano al evaluar `vacio` (nombres reales de page.tsx). */
type EstadoVivoDePagina = EstadoDelBorrador & { voz: { transcripcion: string } }

/**
 * Extrae `const vacio = <expr>` del efecto de restauración y la convierte en una
 * función real. Se inyectan los helpers del módulo canónico para que una
 * reparación que los importe siga siendo evaluable.
 */
function vacioSegunLaPagina(): (e: EstadoVivoDePagina) => boolean {
  const m = pagina.match(/const vacio = ([\s\S]*?)\n\s*(?:\/\*\*|\/\/|if\b|const\b|let\b)/)
  if (!m) throw new Error('no encontré `const vacio = …` en page.tsx: adaptar REP-070 a la nueva forma')
  const expr = m[1].trim().replace(/;$/, '')
  const fn = new Function(
    'resumen', 'secciones', 'signos', 'diagnosticos', 'medicamentos', 'estudiosOrden',
    'preop', 'proximoSeguimiento', 'voz', 'tipo',
    'hayAlgoQuePerder', 'signosConValor', 'CAMPOS_DEL_BORRADOR',
    `return Boolean(${expr})`,
  )
  return e => fn(
    e.resumen ?? '', e.secciones ?? [], e.signos ?? {}, e.diagnosticos ?? [], e.medicamentos ?? [],
    e.estudiosOrden ?? [], e.preop ?? null, e.proximoSeguimiento ?? '', e.voz, e.tipo ?? 'consulta',
    hayAlgoQuePerder, signosConValor, CAMPOS_DEL_BORRADOR,
  ) as boolean
}

/** Un formulario recién abierto, sin nada, salvo lo que se le ponga encima. */
function formulario(extra: Partial<EstadoVivoDePagina>): EstadoVivoDePagina {
  return {
    tipo: 'consulta', resumen: '', secciones: [{ value: '' }, { value: '' }], signos: {},
    diagnosticos: [], medicamentos: [], estudiosOrden: [], preop: null,
    proximoSeguimiento: '', transcripcion: '', voz: { transcripcion: '' }, ...extra,
  }
}

describe('REP-070 · ASN-001 — un respaldo de hace una tecla no se aplica encima de un formulario con signos', () => {
  const vacio = vacioSegunLaPagina()

  /* La escena del equipo rojo: el médico ya tecleó «15» (espejo) y acaba de teclear «4» (vivo). */
  const VIVO = formulario({ signos: { peso: '154' } })
  const ESPEJO: EstadoDelBorrador = { tipo: 'consulta', signos: { peso: '15' } }

  it('control: el espejo con sólo signos SÍ se escribe (hayAlgoQuePerder cuenta los signos)', () => {
    // Fija el punto de partida real: sin esto no habría respaldo que reponer.
    expect(hayAlgoQuePerder(ESPEJO)).toBe(true)
    const escrito: Record<string, unknown>[] = []
    const r = guardarRespaldoLocal(ESPEJO, { notaId: null, ts: 1, bloqueado: false }, c => { escrito.push(c) })
    expect(r).toBe('guardado')
    expect(escrito[0]?.signos).toEqual({ peso: '15' })
  })

  it('control: el motor canónico ve que el formulario vivo con «154» NO está vacío', () => {
    expect(hayAlgoQuePerder(VIVO)).toBe(true)
    expect(signosConValor(VIVO.signos)).toBe(true)
  })

  it('FALLA HOY · la expresión `vacio` de la página da la MISMA respuesta que hayAlgoQuePerder para un formulario con sólo signos', () => {
    // Hoy: vacio(VIVO) === true aunque hay «154» escrito.
    expect(vacio(VIVO)).toBe(!hayAlgoQuePerder(VIVO))
  })

  it('FALLA HOY · la decisión de restauración con el `vacio` de la página NO es «aplicar el respaldo encima»', () => {
    const decision = queHacerConElRespaldoLocal({
      hayRespaldo: true,
      respaldoNotaId: null,       // el espejo no lleva notaId en un encuentro nuevo
      notaAbierta: null,          // se entró desde /citas sin ?nota=
      notaFirmada: false,
      formularioVacio: vacio(VIVO),
    })
    // Con «154» en pantalla, lo único aceptable es OFRECER (visible y reversible).
    expect(decision).not.toBe('APLICAR_SOLO')
  })

  it('PASA HOY (control de no-señalar-de-más): con el formulario de verdad vacío, la decisión sigue siendo APLICAR_SOLO', () => {
    const limpio = formulario({})
    expect(vacio(limpio)).toBe(true)
    expect(hayAlgoQuePerder(limpio)).toBe(false)
    expect(queHacerConElRespaldoLocal({
      hayRespaldo: true, respaldoNotaId: null, notaAbierta: null, notaFirmada: false, formularioVacio: vacio(limpio),
    })).toBe('APLICAR_SOLO')
  })
})

describe('REP-070 · propiedad de simetría — cada campo que cuenta para «hay algo que perder» cuenta para «está vacío»', () => {
  const vacio = vacioSegunLaPagina()

  /** Un valor no vacío por campo, para poblar UNO solo cada vez. */
  const MUESTRA: Record<string, unknown> = {
    resumen: 'Refiere cefalea sintética',
    secciones: [{ value: 'texto sintético' }],
    signos: { temperatura: '36.7' },
    diagnosticos: [{ descripcion: 'Dx sintético' }],
    medicamentos: [{ nombre: 'Fármaco sintético' }],
    estudiosOrden: ['BH'],
    preop: { asa: 'II' },
    proximoSeguimiento: '2026-10-01',
    transcripcion: 'dictado sintético',
  }
  const campos = CAMPOS_DEL_BORRADOR.filter(c => c.cuenta !== null).map(c => c.nombre as string)

  it('control: la lista canónica declara los campos que se esperan (si cambia, revisar MUESTRA)', () => {
    for (const c of campos) expect(MUESTRA, `falta muestra para «${c}»`).toHaveProperty(c)
  })

  it.each(campos)('FALLA HOY para signos/estudiosOrden/preop/proximoSeguimiento · sólo «%s» escrito ⇒ la página no lo llama vacío', campo => {
    const extra: Partial<EstadoVivoDePagina> = { [campo]: MUESTRA[campo] }
    // La página no tiene `transcripcion` suelta: la lee de `voz.transcripcion`.
    if (campo === 'transcripcion') extra.voz = { transcripcion: String(MUESTRA[campo]) }
    const e = formulario(extra)
    expect(hayAlgoQuePerder(e), 'el motor canónico debe contarlo (control)').toBe(true)
    expect(vacio(e), `la página considera vacío un formulario con sólo «${campo}»`).toBe(false)
  })
})
