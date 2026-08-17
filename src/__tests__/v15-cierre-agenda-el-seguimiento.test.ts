/**
 * EL CIERRE AGENDA EL SEGUIMIENTO — V15-NOTE-PLAN-CONTINUITY-001 (Fase 8, §33).
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * La cadena de §33 Fase 8 es «Note → Rx → Orders → Instructions → Follow-up»
 * y el último eslabón no existía en el cierre: el médico ponía fecha en
 * «Próxima consulta», la firma derivaba la tarea «Agendar el seguimiento»…
 * y el checklist de cierre no decía nada. La cita se agendaba después, desde
 * /pendientes, con el paciente ya ido — cuando el momento natural de agendar
 * es el cierre, con el paciente todavía enfrente.
 *
 * Hermano del mismo patrón: el motor de la hoja del paciente
 * (`comoSeLoExplico`, REG-242) tenía el bloque «Su próxima cita» desde su
 * primer día y la consulta le pasaba `proximaCita={undefined}` — el dato
 * existía dos pantallas más arriba y nunca llegaba («escrito y sin conectar»,
 * `.claude/rules/el-dato-tiene-que-llegar.md`).
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Midiendo la cadena de §33 Fase 8 contra `queFaltaParaCerrar`: receta ✓,
 * orden ✓, hoja ✓ … y de seguimiento, nada — aunque `derivar.ts` ya creaba
 * la tarea y `/citas` ya sabía leer `?d=` (REG-302).
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. El paso sólo existe si el médico puso fecha (no se inventa un «vuelva en
 *    tres meses» — regla 1 de seguridad clínica), y sólo con forma ISO exacta:
 *    es lo único que `paramFecha` de /citas sabe interpretar; otra cosa
 *    aterrizaría en «hoy» sin avisar.
 * 2. NO fuerza el panel (`aDondeIrDirecto` lo excluye): a diferencia de la
 *    orden de REG-244, el seguimiento ya tiene red — la tarea del worklist.
 *    El caso común (sólo receta) sigue yendo directo, como siempre.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * - REABRIR una nota firmada: la nota no guarda `proximoSeguimiento` (va al
 *   expediente del paciente y a la tarea; añadirle el campo a la nota es un
 *   cambio de esquema congelado por V15 §1). El paso sólo se ve recién
 *   firmada — después, quien lo recuerda es la tarea del worklist.
 * - Que la cita realmente se cree en /citas: eso es el flujo ya probado de
 *   la agenda (REG-302 y compañía), no de este módulo.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  queFaltaParaCerrar, aDondeIrDirecto,
  POR_QUE_EL_SEGUIMIENTO_NO_FUERZA_EL_PANEL,
} from '@/lib/expediente/que-falta-para-cerrar'
import { guardarSeguimientoDeCierre, leerSeguimientoDeCierre } from '@/lib/expediente/cierre-hechos'

const BASE = { patientId: 'p1', notaId: 'n1' }

describe('el paso «Agendar el seguimiento»', () => {
  it('aparece cuando el médico puso fecha, y lleva al día exacto en /citas', () => {
    const pasos = queFaltaParaCerrar({ ...BASE, hayMedicamentos: true, proximoSeguimiento: '2026-09-08' })
    const seg = pasos.find(p => p.que === 'seguimiento')!
    expect(seg).toBeDefined()
    expect(seg.ruta).toBe('/citas?d=2026-09-08')
    expect(seg.siNoSeHace).toMatch(/sin cita/)
  })

  it('sin fecha no aparece — no se inventa un control que el médico no indicó', () => {
    expect(queFaltaParaCerrar({ ...BASE, hayMedicamentos: true }).map(p => p.que))
      .not.toContain('seguimiento')
  })

  it('con una fecha que /citas no sabe leer, tampoco', () => {
    /**
     * `paramFecha` de /citas sólo acepta AAAA-MM-DD; cualquier otra cosa cae
     * en «hoy» EN SILENCIO. Un botón que promete llevar al día del control y
     * lleva a otro día es peor que ningún botón.
     */
    for (const mala of ['la próxima semana', '08/09/2026', '2026-9-8', '2026-09-08T10:00']) {
      expect(queFaltaParaCerrar({ ...BASE, proximoSeguimiento: mala }).map(p => p.que))
        .not.toContain('seguimiento')
    }
  })

  it('va después de la hoja del paciente y antes de volver al expediente', () => {
    /** Primero lo que se le entrega en mano; agendar es el último gesto antes de que salga. */
    const claves = queFaltaParaCerrar({
      ...BASE, hayMedicamentos: true, hayEstudios: true, proximoSeguimiento: '2026-09-08',
    }).map(p => p.que)
    expect(claves.indexOf('hoja_del_paciente')).toBeLessThan(claves.indexOf('seguimiento'))
    expect(claves.indexOf('seguimiento')).toBeLessThan(claves.indexOf('expediente'))
  })
})

describe('el seguimiento NO fuerza el panel — el caso común sigue directo', () => {
  it('sólo receta + fecha de control → directo a la receta, como siempre', () => {
    expect(aDondeIrDirecto({ ...BASE, hayMedicamentos: true, proximoSeguimiento: '2026-09-08' }))
      .toBe('/receta/p1/n1')
  })

  it('sólo la fecha, nada que imprimir → al expediente', () => {
    expect(aDondeIrDirecto({ ...BASE, proximoSeguimiento: '2026-09-08' }))
      .toBe('/expediente/p1')
  })

  it('y la razón está escrita: la tarea del worklist ya es la red', () => {
    expect(POR_QUE_EL_SEGUIMIENTO_NO_FUERZA_EL_PANEL).toMatch(/ya está protegido/)
  })
})

describe('la fecha sobrevive al remonte (hallado por el arnés: marcado=null)', () => {
  /**
   * El primer arnés de esta rebanada midió que al VOLVER de /citas el paso
   * desaparecía del checklist — ni marcado ni pendiente — porque el remonte
   * dejaba `proximoSeguimiento` vacío y la nota no guarda ese campo
   * (esquema congelado). La pareja guardar/leer sobre `sessionStorage` es lo
   * que lo mantiene vivo dentro de la pestaña. Ventana fake, mismo patrón
   * que `v15-cierre-recuerda-lo-hecho.test.ts`.
   */
  const almacen = new Map<string, string>()
  beforeEach(() => {
    almacen.clear()
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: (k: string) => almacen.get(k) ?? null,
        setItem: (k: string, v: string) => { almacen.set(k, v) },
      },
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('lo guardado con una nota se lee con ESA nota, y con otra no', () => {
    guardarSeguimientoDeCierre('n1', '2026-09-08')
    expect(leerSeguimientoDeCierre('n1')).toBe('2026-09-08')
    expect(leerSeguimientoDeCierre('n2')).toBe('')
  })

  it('sin fecha o con fecha malformada no guarda nada — nunca se inventa', () => {
    guardarSeguimientoDeCierre('n1', '')
    guardarSeguimientoDeCierre('n1', 'la próxima semana')
    expect(leerSeguimientoDeCierre('n1')).toBe('')
  })

  it('lo que salga corrupto del almacén se descarta, no se propaga', () => {
    almacen.set('nx-cierre-seguimiento:n1', '<script>')
    expect(leerSeguimientoDeCierre('n1')).toBe('')
  })
})

describe('está CONECTADO (el dato tiene que LLEGAR)', () => {
  const page = readFileSync(
    join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8')

  it('la consulta le pasa la fecha al motor de cierre', () => {
    /** Dentro de la llamada a queFaltaParaCerrar, no en cualquier parte. */
    const llamada = page.slice(page.indexOf('pasos={queFaltaParaCerrar({'), page.indexOf('hechos={hechosCierre}'))
    expect(llamada).toMatch(/proximoSeguimiento,/)
  })

  it('pulsar el paso lo marca hecho ANTES de salir a /citas', () => {
    expect(page).toMatch(/r\.startsWith\('\/citas'\)\) setHechosCierre\(marcarHechoDeCierre\(notaId, 'seguimiento'\)\)/)
  })

  it('la hoja del paciente ya no recibe proximaCita={undefined}', () => {
    expect(page).not.toMatch(/proximaCita=\{undefined\}/)
    /** Y lo que recibe sale de proximoSeguimiento, en palabras (formatDateMX), no en ISO crudo. */
    expect(page).toMatch(/proximaCita=\{proximoSeguimiento\.trim\(\) \? formatDateMX\(proximoSeguimiento\)/)
  })

  it('REG-310: firmar depende de proximoSeguimiento — sin esto, la fecha tecleada al final NUNCA llega', () => {
    /**
     * `firmar` es un `useCallback` y `proximoSeguimiento` no estaba en sus
     * dependencias (ni en las de `construirNota`). Teclear la fecha como
     * ÚLTIMO gesto antes de firmar — el orden natural — dejaba el callback
     * memorizado con `''`: la tarea «Agendar el seguimiento» no se derivaba
     * y `patient.proximoSeguimiento` no se actualizaba. Medido contra el
     * emulador: 4 notas firmadas con fecha, 0 tareas derivadas. Este caso
     * lee el array de dependencias REAL de la fuente.
     */
    const depsDeFirmar = page.match(/\}, (\[[^\]]*\])\)\s*\n\n  \/\/ Firma con PIN/)?.[1]
      ?? page.slice(page.indexOf('const firmar = useCallback')).match(/\n\s*\}, (\[[^\]]*\])\)/)?.[1]
    expect(depsDeFirmar).toBeTruthy()
    expect(depsDeFirmar).toContain('proximoSeguimiento')
  })

  it('firmar guarda la fecha y el estado la recupera al remontar', () => {
    /** Las dos mitades del puente: sin la primera no hay qué leer; sin la segunda, leer no sirve. */
    expect(page).toMatch(/guardarSeguimientoDeCierre\(id, proximoSeguimiento\)/)
    expect(page).toMatch(/useState\(\(\) => leerSeguimientoDeCierre\(notaIdParam\)\)/)
  })

  it('y /citas entiende el otro lado del enlace: lee ?d= de la URL', () => {
    /**
     * La mitad que REG-167/REG-170 enseñaron a comprobar: no basta con que
     * esta pantalla EMITA la ruta — el destinatario tiene que aceptarla.
     */
    const citas = readFileSync(join(process.cwd(), 'src/app/(dashboard)/citas/page.tsx'), 'utf8')
    expect(citas).toMatch(/paramFecha\(params\.get\('d'\)\)/)
  })
})
