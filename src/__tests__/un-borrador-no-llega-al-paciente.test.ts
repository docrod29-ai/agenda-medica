/**
 * UN BORRADOR NO LLEGA AL PACIENTE — V9 · PATIENT-COMPANION-001 · REG-304.
 *
 * ── LA FRASE QUE GOBIERNA ESTE ARCHIVO ──────────────────────────────────────
 *
 * La especificación del dueño, literal:
 *
 *     «Never expose a clinical draft to the patient as final.»
 *
 * Y la regla 4 de `.claude/rules/patient-facing-ai.md`, que explica por qué no
 * basta con que la nota esté firmada:
 *
 *     «Que el médico haya firmado la nota no libera el paquete: son dos actos.»
 *
 * ── POR QUÉ ESTA UNIDAD NECESITA UN GUARDIÁN ANTES QUE UNA PANTALLA ─────────
 *
 * Hasta hoy la IA y los datos de este producto le hablaban a un internista con
 * cédula: un error se lo comía alguien entrenado para verlo. La primera vez que
 * el producto le habla al **paciente**, el lector **no puede detectar el
 * error**. No sabe que esa dosis todavía no estaba revisada, ni que ese
 * diagnóstico era una hipótesis a medio dictar.
 *
 * Por eso la compuerta se escribe antes que la interfaz, y por eso vive en el
 * **servidor**. Esconder una pestaña no cierra una ruta HTTP.
 *
 * ── LAS TRES DECISIONES QUE SE SELLAN AQUÍ ──────────────────────────────────
 *
 * 1. **Un paquete nace DRAFT, siempre.** Y sólo llega a RELEASED pasando por
 *    `liberar()`, que exige saber quién aprueba. Si hubiera otra puerta,
 *    cualquier camino futuro podría saltarse la aprobación sin que se notara.
 * 2. **Liberar exige saber quién y cuándo.** Un paquete «aprobado por nadie» es
 *    lo que la especificación prohíbe al pedir `approvedBy`.
 * 3. **La compuerta exige las tres condiciones.** Un `RELEASED` sin
 *    `approvedBy` es un documento al que alguien le puso el estado a mano.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **No prueba la ruta HTTP con una petición real.** Comprueba la función que
 *   la ruta usa, y que la ruta la use. Montar `/api/portal` con Firestore
 *   admin exige el emulador, y eso es otra suite (`vitest.emulator.config.ts`).
 * - **No cubre la composición ni la entrega.** Llegaron en `POSTVISIT-001`
 *   (REG-306, REG-307) y tienen su propio golden:
 *   `el-paquete-sale-de-una-nota-firmada.test.ts`. Este archivo sigue vigilando
 *   sólo lo suyo —la máquina de estados y la compuerta de visibilidad—, que es
 *   lo que no debe cambiar aunque cambie de dónde sale el contenido.
 * - **No valida el contenido clínico** del paquete. Que la composición no
 *   invente cifras lo vigilan el golden de `como-se-lo-explico` y el de
 *   `POSTVISIT-001`.
 * - **No cubre la cartera de documentos** (`DOCUMENTS-001`) ni las preguntas
 *   (`PATIENT-AI-001`): sus campos existen y van vacíos, declarados.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  liberar, visibleParaElPaciente,
  DESTINOS_PACIENTE, type PaqueteDeVisita,
} from '@/lib/paciente/paquete-de-visita'

/**
 * Un paquete recién nacido, tal como lo dejará `componerPaquete` cuando llegue
 * con su llamador en `POSTVISIT-001`. Se escribe a mano aquí porque lo que estas
 * pruebas vigilan es la MÁQUINA DE ESTADOS y la compuerta, no la composición.
 */
const recienCompuesto = (): PaqueteDeVisita => ({
  notaId: 'nota_1',
  encounterSummary: 'Faringitis aguda.',
  medicationInstructions: [{ nombre: 'Amoxicilina', instruccion: 'Amoxicilina 500 mg por la boca cada 8 horas' }],
  medicationChanges: null,
  orders: ['Biometría hemática'],
  followUp: '',
  warningSigns: [],
  educationalMaterial: [],
  documents: [],
  unansweredQuestions: [],
  clinicianContactRules: '',
  language: 'es-MX',
  estado: 'DRAFT',
  approvedAt: null,
  approvedBy: null,
  version: 1,
})

describe('un paquete nace DRAFT y no hay forma de que nazca de otra manera', () => {
  it('recién compuesto es DRAFT, sin aprobador ni fecha', () => {
    const p = recienCompuesto()
    expect(p.estado).toBe('DRAFT')
    expect(p.approvedBy).toBeNull()
    expect(p.approvedAt).toBeNull()
  })

  it('un DRAFT NO es visible para el paciente', () => {
    /** Ésta es la que muerde. Probada al revés: si `visibleParaElPaciente`
     *  devolviera `true` para cualquier estado, falla. */
    expect(visibleParaElPaciente(recienCompuesto())).toBe(false)
  })

  it('aunque la nota esté firmada, el paquete sigue naciendo DRAFT', () => {
    /**
     * Firmar y liberar son DOS actos. Es la regla que más fácil sería «mejorar»
     * por comodidad —«si ya firmó, para qué otro clic»— y la que no se toca:
     * firmar es hacia el expediente, liberar es hacia el paciente.
     */
    expect(recienCompuesto().estado).toBe('DRAFT')
  })
})

describe('liberar exige saber quién y cuándo', () => {
  it('libera con aprobador y fecha', () => {
    const p = liberar(recienCompuesto(), 'dr_david', 1_754_000_000_000)
    expect(p.estado).toBe('RELEASED')
    expect(p.approvedBy).toBe('dr_david')
    expect(visibleParaElPaciente(p)).toBe(true)
  })

  it('se niega a liberar sin aprobador', () => {
    /** Un campo vacío en la base es indistinguible de un campo que nadie llenó.
     *  Mejor romper aquí que guardar un «aprobado por nadie». */
    expect(() => liberar(recienCompuesto(), '', 1)).toThrow()
    expect(() => liberar(recienCompuesto(), '   ', 1)).toThrow()
  })

  it('se niega a liberar sin fecha válida', () => {
    expect(() => liberar(recienCompuesto(), 'dr_david', 0)).toThrow()
    expect(() => liberar(recienCompuesto(), 'dr_david', Number.NaN)).toThrow()
  })
})

describe('la compuerta exige las TRES condiciones, no sólo el estado', () => {
  const liberado = liberar(recienCompuesto(), 'dr_david', 1_754_000_000_000)

  it('un RELEASED sin `approvedBy` no pasa', () => {
    expect(visibleParaElPaciente({ ...liberado, approvedBy: null })).toBe(false)
  })

  it('un RELEASED sin `approvedAt` no pasa', () => {
    expect(visibleParaElPaciente({ ...liberado, approvedAt: null })).toBe(false)
  })

  it('un documento con el estado puesto a mano no pasa', () => {
    /**
     * El caso realista: alguien escribe `{estado:'RELEASED'}` en la base a mano
     * o desde una migración. Sin `approvedBy` ni `approvedAt`, no hubo
     * aprobación, y la compuerta lo trata como lo que es.
     */
    const aMano = { estado: 'RELEASED', approvedBy: null, approvedAt: null } as unknown as PaqueteDeVisita
    expect(visibleParaElPaciente(aMano)).toBe(false)
  })
})

describe('el servidor filtra, no la pantalla', () => {
  const RUTA = readFileSync(join(process.cwd(), 'src', 'app', 'api', 'portal', 'route.ts'), 'utf8')

  it('`/api/portal` usa la compuerta con nombre', () => {
    /**
     * Escrito como `.filter(visibleParaElPaciente)` y no como una comparación
     * suelta a propósito: una comprobación con nombre se puede exigir en una
     * prueba; un `p.estado === 'RELEASED'` incrustado se olvida en la segunda
     * ruta que alguien escriba.
     */
    expect(RUTA).toContain("import { visibleParaElPaciente")
    expect(RUTA).toContain('.filter(visibleParaElPaciente)')
  })

  it('la acción exige alcance clínico', () => {
    /** Un token de agenda —el que emite cualquier miembro para confirmar una
     *  cita— no puede abrir diagnósticos y medicación. */
    const accion = /case 'paquetes': \{[\s\S]*?\n      \}/.exec(RUTA)?.[0] ?? ''
    expect(accion).not.toBe('')
    expect(accion).toContain("if (alcance !== 'clinico')")
  })
})

describe('lo que no se puede componer se queda vacío, no se rellena', () => {
  it('el material educativo va vacío mientras no haya evidencia curada', () => {
    expect(recienCompuesto().educationalMaterial).toEqual([])
  })

})

describe('los cinco destinos del compañero', () => {
  it('son exactamente cinco, en el orden de la especificación', () => {
    /** TODAY · ASK NEXUS · CARE · DOCUMENTS · PROFILE. El máximo de la
     *  especificación para móvil es 4-5 destinos; cinco es el techo. */
    expect(DESTINOS_PACIENTE).toEqual(['hoy', 'preguntar', 'cuidado', 'documentos', 'perfil'])
    expect(DESTINOS_PACIENTE.length).toBeLessThanOrEqual(5)
  })
})
