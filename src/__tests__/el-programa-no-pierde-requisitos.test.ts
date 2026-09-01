/**
 * GUARDIÁN — un requisito no puede desaparecer, ni bajar de estado en silencio.
 *
 * ── QUÉ FALLABA, Y CÓMO SE DESCUBRIÓ ────────────────────────────────────────
 *
 * `docs/product/AUSCULTA-MASTER-BOARD.md` es el tablero canónico del programa y
 * está bien escrito — pero es **prosa**. Reconciliándolo contra el alcance
 * canónico completo aparecieron **seis dominios sin una sola fila**:
 *
 *   voz · aprendizaje · autoridad de la automatización · WhatsApp ·
 *   razonamiento · accesibilidad
 *
 * Ninguno estaba `DEFERRED`. Ninguno estaba `BLOCKED_EXTERNAL`. **No estaban.**
 * Y el producto tiene un subsistema de voz enorme, con su propia regla en
 * `.claude/rules/voice-asr.md` y decenas de pruebas.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Ningún documento derivado puede notar la ausencia de algo. Un tablero, una
 * nota de PR y un `FINAL-READINESS` se escriben **mirando lo que hay**; lo que
 * se cayó no aparece en ninguno de los tres, y cada uno hereda el hueco del
 * anterior con más autoridad que el anterior.
 *
 * Es el patrón `depende_de_recordar` del repositorio en su forma más cara: no un
 * dato desfasado, sino un dominio entero evaporado.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * El censo (`src/lib/programa/requisitos.ts`) es la lista, y aquí se le exige:
 *
 *   · **el censo sólo crece** — un id sellado que desaparece pone el CI en rojo;
 *   · **ningún estado baja en silencio** — el sello guarda el estado de cada id;
 *   · **cada estado paga su evidencia** — `PROVEN` sin comando reproducible es
 *     una opinión con formato de dato; `BLOCKED_EXTERNAL` sin la acción externa
 *     exacta es la palabra que se usa para no terminar algo;
 *   · **ningún dominio canónico se queda sin fila** — que es el defecto original.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No comprueba que un `PROVEN` sea verdad.** Comprueba que declare cómo se
 *   reproduce. Quien miente en el campo `resultado` puede pasar este guardián —
 *   lo que no puede es hacerlo sin dejar por escrito un comando que otro corre.
 * · **No mide cobertura del alcance.** Que un dominio tenga una fila no
 *   significa que tenga todas las que le tocan; significa que no está evaporado.
 * · **No sustituye al tablero en prosa.** La causa raíz, la historia y la cita
 *   del archivo viven allí, y eso no cabe en una tabla de datos.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  REQUISITOS, DOMINIOS_CANONICOS, USUARIOS_REGISTRADOS, PACIENTES_POR_MEDICO,
  FUENTES_CANONICAS, FUERZA, sinProbar, POR_QUE_ESTE_CENSO,
  type EstadoRequisito,
} from '@/lib/programa/requisitos'

const SELLO = JSON.parse(readFileSync('src/lib/programa/censo-sellado.json', 'utf8')) as {
  sellado: string
  porQue: string
  requisitos: { id: string; estado: EstadoRequisito }[]
}

const porId = new Map(REQUISITOS.map(r => [r.id, r]))

describe('el censo del programa sólo crece', () => {
  it('el censo tiene tamaño de censo (si no, pasaría vacío)', () => {
    /* El modo de fallo de un guardián de listas es quedarse sin lista. */
    expect(REQUISITOS.length).toBeGreaterThanOrEqual(60)
    expect(SELLO.requisitos.length).toBeGreaterThanOrEqual(60)
  })

  it('ningún requisito sellado desapareció', () => {
    const perdidos = SELLO.requisitos.map(s => s.id).filter(id => !porId.has(id))
    expect(
      perdidos,
      'requisitos que estaban en el sello y ya no están en el censo — para quitar uno, ' +
      'ciérralo con estado y evidencia; borrarlo no es cerrarlo',
    ).toEqual([])
  })

  it('los identificadores son únicos y estables', () => {
    expect(new Set(REQUISITOS.map(r => r.id)).size).toBe(REQUISITOS.length)
  })

  it('ningún estado bajó sin actualizar el sello', () => {
    /**
     * Subir de estado es trabajo hecho y no necesita permiso. **Bajar** es otra
     * cosa: o se descubrió que la evidencia no probaba lo que decía —y entonces
     * hay que decirlo— o alguien está maquillando el tablero al revés.
     *
     * Los estados laterales (`BLOCKED_EXTERNAL`, `DEFERRED_BY_OWNER`,
     * `NEEDS_CLINICAL_REVIEW`) no se comparan por fuerza sino por identidad: pasar
     * de `PROVEN` a `BLOCKED_EXTERNAL` también es una bajada que hay que declarar.
     */
    const bajadas: string[] = []
    for (const s of SELLO.requisitos) {
      const actual = porId.get(s.id)
      if (!actual) continue
      const antes = FUERZA[s.estado]
      const ahora = FUERZA[actual.estado]
      if (antes >= 0 && ahora >= 0 && ahora < antes) bajadas.push(`${s.id}: ${s.estado} → ${actual.estado}`)
      if (antes === 4 && ahora < 0) bajadas.push(`${s.id}: PROVEN → ${actual.estado}`)
    }
    expect(bajadas, 'bajaron de estado; si es correcto, actualiza censo-sellado.json y di por qué').toEqual([])
  })
})

describe('cada estado paga la evidencia que ese estado exige', () => {
  it('PROVEN trae evidencia, comando y resultado', () => {
    const flojos = REQUISITOS
      .filter(r => r.estado === 'PROVEN')
      .filter(r => !r.evidencia?.trim() || !r.comando?.trim() || !r.resultado?.trim())
      .map(r => r.id)
    expect(flojos, 'PROVEN sin evidencia/comando/resultado es una opinión con formato de dato').toEqual([])
  })

  it('BLOCKED_EXTERNAL dice la acción externa exacta Y lo que ya está hecho de este lado', () => {
    const flojos = REQUISITOS
      .filter(r => r.estado === 'BLOCKED_EXTERNAL')
      .filter(r => !r.desbloqueaCon?.trim() || !r.preparacionInterna?.trim())
      .map(r => r.id)
    expect(
      flojos,
      'sin preparación interna declarada, «bloqueado» es la palabra que se usa para no terminar algo',
    ).toEqual([])
  })

  it('todo lo demás dice qué falta, en términos que otro pueda retomar', () => {
    const flojos = REQUISITOS
      .filter(r => !['PROVEN', 'BLOCKED_EXTERNAL'].includes(r.estado))
      .filter(r => (r.queFalta ?? '').trim().length < 40)
      .map(r => r.id)
    expect(flojos, 'un requisito sin `queFalta` útil es uno que nadie puede retomar').toEqual([])
  })

  it('un PROVEN no puede tener por comando una frase vaga', () => {
    /* «se verificó manualmente» no es reproducible. Se exige que el comando
       nombre una herramienta real del repositorio o un procedimiento con verbo. */
    const sospechosos = REQUISITOS
      .filter(r => r.estado === 'PROVEN')
      .filter(r => !/(npx|npm|node|git|gcloud|Comparar|PLAYWRIGHT|FIRESTORE)/.test(r.comando ?? ''))
      .map(r => `${r.id}: ${r.comando}`)
    expect(sospechosos).toEqual([])
  })
})

describe('ningún dominio ni objetivo canónico se queda sin fila', () => {
  it('los 21 dominios canónicos están representados', () => {
    /**
     * Éste es el caso que habría cazado el defecto original. Cada dominio se
     * localiza por el workstream o el eje transversal que lo cubre; si mañana se
     * borra el último requisito de un dominio, esto se pone rojo.
     */
    const COBERTURA: Record<string, string[]> = {
      'Clinical Truth': ['WS-10.vocabulario-canonico', 'WS-10.historico-no-es-actual'],
      'Voice': ['TR-VOZ.pipeline'],
      'Reasoning': ['TR-RAZONAMIENTO.procedencia'],
      'Evidence': ['WS-06.censo-de-fuentes'],
      'Consultorio': ['WS-03.lecturas-sin-cota'],
      'Automation': ['TR-AUTOMATIZACION.autoridad'],
      'Learning': ['TR-APRENDIZAJE.no-es-politica'],
      'Patient Experience': ['TR-PACIENTE.experiencia'],
      'WhatsApp': ['TR-WHATSAPP.entrega'],
      'Mobile UX': ['WS-05.webkit-390'],
      'Scale': ['WS-02.arnes'],
      'Reliability': ['WS-04.colas'],
      'Observability': ['WS-13.correlation-id'],
      'Security': ['WS-13.aislamiento'],
      'Disaster Recovery': ['WS-13.restauracion'],
      'Evaluation': ['WS-12.contratos-de-evaluacion'],
      'Patient State': ['WS-10.proyeccion-no-es-segunda-verdad'],
      'Closed Loop': ['WS-11.estados-del-cierre'],
      'Evidence Applicability': ['WS-09.motor'],
      'Specialty Packages': ['TR-ESPECIALIDAD.infecto'],
      'Production Readiness': ['WS-13.reglas-desplegadas'],
    }
    for (const dominio of DOMINIOS_CANONICOS) {
      const ids = COBERTURA[dominio] ?? []
      expect(ids.length, `el dominio «${dominio}» no tiene requisito que lo cubra`).toBeGreaterThan(0)
      for (const id of ids) {
        expect(porId.has(id), `«${dominio}» apunta a ${id}, que ya no está en el censo`).toBe(true)
      }
    }
  })

  it('cada objetivo de escala tiene su propia fila, sin colapsar', () => {
    /* «Aguanta 100 k» sin un experimento por escalón es una frase, no una
       medición. Y usuarios registrados NO es concurrencia activa: van aparte. */
    for (const n of USUARIOS_REGISTRADOS) {
      expect(porId.has(`WS-02.registrados-${n}`), `falta el escalón de ${n} registrados`).toBe(true)
    }
    for (const n of PACIENTES_POR_MEDICO) {
      expect(porId.has(`WS-03.pacientes-${n}`), `falta el escalón de ${n} pacientes/médico`).toBe(true)
    }
    expect(porId.has('WS-02.concurrencia-definida')).toBe(true)
  })

  it('la lista de fuentes canónicas no se encoge, y el catálogo la cubre', () => {
    /**
     * ── ESTE CASO CAMBIÓ, Y EL PORQUÉ IMPORTA ────────────────────────────
     *
     * Nació exigiendo que la lista canónica fuera **más larga** que el catálogo:
     * eran 29 contra 12, y la tentación era igualarlas por abajo —borrar de la
     * vista lo que faltaba— en vez de por arriba.
     *
     * REG-389 las igualó **por arriba**: metió las 17 ausentes al catálogo con su
     * estado honesto. Así que la desigualdad dejó de ser la propiedad correcta, y
     * mantenerla habría obligado a deshacer el arreglo para que la prueba pasara
     * — que es exactamente cómo una prueba se vuelve el jefe del producto.
     *
     * Lo que se exige ahora es lo que siempre se quiso decir: que la lista no
     * encoja, y que ninguna fuente canónica se quede sin ficha. De la cobertura
     * responde `el-catalogo-de-fuentes-no-calla-ninguna`.
     */
    expect(FUENTES_CANONICAS.length).toBeGreaterThanOrEqual(29)
    for (const imprescindible of ['NEJM', 'UpToDate', 'Cochrane', 'IDSA', 'COFEPRIS', 'Crossref']) {
      expect(FUENTES_CANONICAS).toContain(imprescindible)
    }
  })
})

describe('lo que el censo dice de sí mismo', () => {
  it('NOT_PROVEN se calcula, no se declara — así no se puede vaciar renombrándolo', () => {
    const abiertos = sinProbar()
    /* No se exige que esté vacío: se exige que se pueda contar sin creerle a nadie. */
    expect(abiertos.every(r => !['PROVEN', 'BLOCKED_EXTERNAL', 'DEFERRED_BY_OWNER', 'NEEDS_CLINICAL_REVIEW'].includes(r.estado))).toBe(true)
    expect(abiertos.length + REQUISITOS.filter(r => ['PROVEN', 'BLOCKED_EXTERNAL', 'DEFERRED_BY_OWNER', 'NEEDS_CLINICAL_REVIEW'].includes(r.estado)).length)
      .toBe(REQUISITOS.length)
  })

  it('el censo explica por qué existe, con el defecto que lo motivó', () => {
    expect(POR_QUE_ESTE_CENSO).toMatch(/SEIS dominios/)
    expect(POR_QUE_ESTE_CENSO).toMatch(/ausentes/)
  })

  it('NEEDS_CLINICAL_REVIEW se reserva a decisiones clínicas, no a ingeniería', () => {
    /* La categoría es una salida de emergencia legítima y por eso se vigila: si
       se llena de decisiones técnicas, deja de significar nada. */
    const clinicos = REQUISITOS.filter(r => r.estado === 'NEEDS_CLINICAL_REVIEW')
    expect(clinicos.length).toBeLessThanOrEqual(3)
    for (const r of clinicos) {
      expect(r.queFalta, `${r.id} no dice por qué es una decisión clínica`).toMatch(/clínic|política|dueño/i)
    }
  })
})
