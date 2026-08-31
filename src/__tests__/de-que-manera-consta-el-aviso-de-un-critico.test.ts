/**
 * GOLDEN — «avisado» no decía a quién ni por qué vía.
 *
 * ── LAS DOS DECISIONES, Y DE QUIÉN SON ──────────────────────────────────────
 *
 * El censo dejaba dos preguntas abiertas sobre el valor crítico de laboratorio,
 * las dos del médico. **El 31-ago-2026 el dueño contestó las dos.**
 *
 * **D-027 · el plazo: ninguno.** Se le ofrecieron 1 h, 4 h, 24 h y «que no venza
 * nunca», y eligió el último. Así que `venceEn` no se pone y `estaVencida` no
 * opina sobre un crítico — igual que antes, pero ahora por decisión y no por
 * conservación. Lo que queda en pie es que se PREGUNTA al cerrar: sin plazo, la
 * pregunta es la única defensa.
 *
 * **D-028 · quién cuenta: los cuatro.** Hablar con el paciente, hablar con un
 * cuidador autorizado, entregárselo a otro médico tratante y **un mensaje
 * enviado**. Con sus palabras: «al que sea».
 *
 * ── LO QUE SE LE ADVIRTIÓ, Y AUN ASÍ DECIDIÓ ────────────────────────────────
 *
 * Que un mensaje puede morir sin acuse. No es una suposición: este repositorio
 * lo mide desde REG-432 y REG-438 —hay una pantalla entera de mensajes que se
 * rindieron y otra de respuestas del bot que no salieron—. Se le dijo en la
 * propia opción y eligió que cuente igual.
 *
 * Así que cuenta. Lo que este golden protege es la otra mitad: **que se guarde
 * CUÁL de las cuatro fue**, para que quien lea el expediente dentro de un año
 * distinga «hablé con él» de «le mandé un mensaje».
 *
 * ── UN CAMPO, UNA PREGUNTA ──────────────────────────────────────────────────
 *
 * Tres de las cuatro opciones son *a quién* y la cuarta es *por qué vía*.
 * Guardarlas en un campo llamado `destinatario` habría sido un campo haciendo
 * dos trabajos — REG-418, el defecto que este repositorio lleva cazando desde
 * entonces. Por eso el campo pregunta una sola cosa: **de qué manera consta**.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No obliga.** El campo es opcional, como `avisoAlPaciente`: exigirlo
 *   convierte el cierre en un formulario y un worklist que cuesta se abandona.
 *   Sin valor con `avisado` = se avisó y no se dijo cómo, que es exactamente lo
 *   que pasaba antes de este campo.
 * · **No verifica nada.** Que se marque «hablé con el paciente» no prueba que se
 *   hablara. Esto registra lo que el médico declara, como todo el cierre.
 * · **No cruza con el outbox.** Marcar «mandé un mensaje» no comprueba que ese
 *   mensaje saliera ni que no muriera en la cola. Sería lo siguiente, y necesita
 *   atar el cierre a un identificador de mensaje que hoy no existe.
 * · **No es una prueba de navegador.**
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  preguntasAlCerrar, avisoRegistrado, estaVencida,
  constaQueLoRecibieron, COMO_SE_AVISO_ETIQUETA,
  LA_DECISION_DEL_PLAZO, LA_DECISION_DE_QUIEN_CUENTA,
  POR_QUE_EL_CRITICO_PREGUNTA_Y_NO_BLOQUEA,
  type ComoSeAviso, type TareaClinica,
} from '@/lib/tareas-clinicas/modelo'
import { progresoResultado } from '@/lib/tareas-clinicas/progreso-resultado'

const PANTALLA = readFileSync('src/app/(dashboard)/pendientes/page.tsx', 'utf8')
const MODELO = readFileSync('src/lib/tareas-clinicas/modelo.ts', 'utf8')

const critica = (cierre?: Partial<TareaClinica['cierre']>): TareaClinica => ({
  clinicId: 'c', patientId: 'p', tipo: 'resultado_por_revisar',
  titulo: 'Potasio 6.9', prioridad: 'critica', estado: 'completada',
  creadaEn: '2026-08-31T10:00:00Z', origen: 'laboratorio',
  ...(cierre ? { cierre: cierre as TareaClinica['cierre'] } : {}),
})

describe('D-027 · un crítico no vence, y eso ahora es decisión', () => {
  it('sin `venceEn` no vence, por muy viejo que sea', () => {
    const hace30dias = Date.now() - 30 * 24 * 3600 * 1000
    expect(estaVencida({ estado: 'completada' }, Date.now())).toBe(false)
    expect(estaVencida({ estado: 'completada', venceEn: undefined }, hace30dias)).toBe(false)
  })

  it('la decisión queda con su fecha y con las opciones que se descartaron', () => {
    expect(LA_DECISION_DEL_PLAZO).toContain('31-ago-2026')
    expect(LA_DECISION_DEL_PLAZO).toMatch(/1 h, 4 h, 24 h/)
    expect(LA_DECISION_DEL_PLAZO).toMatch(/no por\s*\n?\s*'?\s*\+?\s*'?conservación/)
  })

  it('y sin plazo, la PREGUNTA al cerrar sigue siendo la única defensa', () => {
    /* Si esto se quitara, un crítico podría cerrarse sin que conste nada y sin
       que nada venciera nunca: «lo vi» y «localicé a alguien» otra vez iguales. */
    expect(preguntasAlCerrar(critica(), undefined)).toHaveLength(1)
    expect(preguntasAlCerrar(critica(), undefined)[0]).toMatch(/¿Se le avisó a alguien\?/)
    expect(POR_QUE_EL_CRITICO_PREGUNTA_Y_NO_BLOQUEA).toMatch(/POLÍTICA CLÍNICA/)
  })

  it('y deja de preguntar en cuanto se contesta cualquiera de las tres', () => {
    for (const a of ['avisado', 'no_avisado', 'no_aplica'] as const) {
      expect(preguntasAlCerrar(critica(), { avisoAlPaciente: a }), a).toEqual([])
    }
  })
})

describe('D-028 · las cuatro cuentan como avisado', () => {
  const TODAS: ComoSeAviso[] = [
    'hablado_con_paciente', 'hablado_con_cuidador', 'entregado_a_otro_medico', 'mensaje_enviado',
  ]

  it('las cuatro existen y tienen su etiqueta, ni una más ni una menos', () => {
    expect(Object.keys(COMO_SE_AVISO_ETIQUETA).sort()).toEqual([...TODAS].sort())
  })

  it('con cualquiera de las cuatro, el aviso consta como AVISADO', () => {
    for (const como of TODAS) {
      expect(avisoRegistrado(critica({ decision: 'x', quien: 'u', cuando: 'z', avisoAlPaciente: 'avisado', comoSeAviso: como })), como)
        .toBe('avisado')
    }
  })

  it('y el mensaje enviado NO vale menos: el dueño decidió que cuenta', () => {
    /* AL REVÉS de lo que este repositorio haría por su cuenta. Se le advirtió de
       que un mensaje puede morir sin acuse y aun así lo eligió. */
    expect(avisoRegistrado(critica({
      decision: 'x', quien: 'u', cuando: 'z',
      avisoAlPaciente: 'avisado', comoSeAviso: 'mensaje_enviado',
    }))).toBe('avisado')
  })
})

describe('pero se guarda CUÁL fue, que es la otra mitad', () => {
  it('los tres que fueron conversación se distinguen del que no', () => {
    expect(constaQueLoRecibieron('hablado_con_paciente')).toBe(true)
    expect(constaQueLoRecibieron('hablado_con_cuidador')).toBe(true)
    expect(constaQueLoRecibieron('entregado_a_otro_medico')).toBe(true)
    /* Un mensaje se manda; que llegue es otra cosa, y el producto lo mide. */
    expect(constaQueLoRecibieron('mensaje_enviado')).toBe(false)
  })

  it('sin registrar es `null`, y `null` no es «no lo recibieron»', () => {
    /**
     * El caso que impide que el campo nuevo invente un dato. Alguien que marca
     * «avisado» sin decir cómo no está diciendo que nadie lo recibió — está
     * diciendo lo mismo que decía antes de que este campo existiera.
     */
    expect(constaQueLoRecibieron(undefined)).toBeNull()
    expect(constaQueLoRecibieron(undefined)).not.toBe(false)
  })

  it('el campo es OPCIONAL, y el modelo dice por qué', () => {
    expect(MODELO).toMatch(/readonly comoSeAviso\?: ComoSeAviso/)
    expect(MODELO).toMatch(/un worklist que cuesta se\s*\n\s*\*\s*abandona/)
  })

  it('y no es un campo haciendo dos trabajos', () => {
    /* Tres de las cuatro son «a quién» y la cuarta «por qué vía». El campo
       pregunta UNA cosa: de qué manera consta. */
    expect(MODELO).toMatch(/DE QUÉ MANERA CONSTA EL AVISO/)
    expect(MODELO).toMatch(/REG-418/)
    expect(MODELO).not.toMatch(/readonly destinatario/)
  })
})

describe('y llega a la pantalla', () => {
  it('las cuatro se ofrecen, y sólo cuando se marcó «avisado»', () => {
    expect(PANTALLA).toMatch(/\{aviso === 'avisado' && \(/)
    expect(PANTALLA).toContain('COMO_SE_AVISO_ETIQUETA')
    expect(PANTALLA).toMatch(/¿De qué manera\? \(opcional\)/)
  })

  it('se dice que un mensaje no confirma que se leyera — texto visible', () => {
    /**
     * Cuenta como avisado, y aun así esto se dice. Callarlo sería esconder algo
     * que el propio producto mide en dos pantallas.
     */
    expect(PANTALLA).toMatch(/\{como === 'mensaje_enviado' && \(/)
    expect(PANTALLA).toMatch(/no confirma que se leyera/)
  })

  it('y se guarda sólo si se marcó avisado: no se cuela con «todavía no»', () => {
    expect(PANTALLA).toMatch(/aviso === 'avisado' && como \? \{ comoSeAviso: como \} : \{\}/)
  })

  it('y el médico lo LEE en el progreso del resultado, no sólo en un campo', () => {
    /**
     * La mitad que faltaba y que cazó el trinquete de conexión: sin esto,
     * `constaQueLoRecibieron` era una función exportada que nadie llamaba y la
     * decisión del dueño se habría guardado en un campo que nadie mira.
     *
     * El ESTADO de la etapa no cambia —las cuatro cuentan como avisado, que es
     * lo que él decidió—; lo que cambia es cómo se llama.
     */
    const base = {
      clinicId: 'c', patientId: 'p', tipo: 'resultado_por_revisar' as const,
      titulo: 'Potasio 6.9', prioridad: 'critica' as const, estado: 'cerrada' as const,
      creadaEn: '2026-08-31T10:00:00Z', origen: 'laboratorio',
    }
    const etapa = (comoSeAviso?: ComoSeAviso) =>
      progresoResultado({
        ...base,
        cierre: { decision: 'x', quien: 'u', cuando: 'z', avisoAlPaciente: 'avisado', ...(comoSeAviso ? { comoSeAviso } : {}) },
      } as TareaClinica).find(e => e.clave === 'aviso_paciente')

    expect(etapa('hablado_con_paciente')?.etiqueta).toBe('Aviso al paciente (hablado)')
    expect(etapa('mensaje_enviado')?.etiqueta).toBe('Aviso al paciente (por mensaje)')
    /* Sin detalle, dice lo mismo que decía antes: el campo es opcional. */
    expect(etapa(undefined)?.etiqueta).toBe('Aviso al paciente')
    /* Y las tres cuentan igual como hechas: eso NO cambia. */
    for (const c of [undefined, 'hablado_con_paciente', 'mensaje_enviado'] as const) {
      expect(etapa(c)?.estado, String(c)).toBe('hecha')
    }
  })

  it('la decisión queda registrada con la advertencia que se le hizo', () => {
    expect(LA_DECISION_DE_QUIEN_CUENTA).toContain('31-ago-2026')
    expect(LA_DECISION_DE_QUIEN_CUENTA).toMatch(/al que sea/)
    expect(LA_DECISION_DE_QUIEN_CUENTA).toMatch(/morir sin acuse/)
  })
})
