/**
 * EL PLAN LIBERADO LLEGA A LA PANTALLA DEL PACIENTE — V9 · REG-308.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * REG-304 puso la compuerta y la acción `paquetes` en `/api/portal`. REG-307
 * puso el botón que crea los paquetes y escribió, en su propia entrada del
 * ledger, que «el paquete aparece en su portal y ya».
 *
 * No aparecía. **Nadie llamaba a la acción.** La pestaña «Cuidado» de
 * `/mi/[token]` pintaba un estado vacío escrito a mano —«cuando tu médico libere
 * el resumen de una consulta, lo verás aquí»— y no tenía ni un `fetch`. El
 * médico firmaba, revisaba, pulsaba «Liberar al paciente», el documento se
 * escribía en Firestore… y el paciente veía la misma frase de siempre.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Aplicando la regla «el dato tiene que LLEGAR» a la unidad recién cerrada:
 * ¿dónde acaba este dato? La respuesta era «en la ruta que lo sirve», y eso
 * todavía no es llegar. Un `grep` de `action: 'paquetes'` en `src/app/` devolvió
 * exactamente cero resultados fuera del servidor.
 *
 * ── CAUSA RAÍZ ──────────────────────────────────────────────────────────────
 *
 * La unidad se dio por cerrada al comprobar las dos mitades por separado —el
 * botón escribe, la ruta filtra— sin comprobar la costura. Es la misma familia
 * que la propia REG-307 arregló (`escrito_probado_y_sin_conectar`), una capa más
 * arriba: esta vez lo desconectado no era el motor, era el consumidor.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Un guardián estructural: **toda acción que `/api/portal` sabe atender tiene
 * que tener un llamador en la superficie del paciente**. Es la única de las
 * comprobaciones de este archivo que habría cazado el defecto, y sigue viva para
 * la acción número nueve.
 *
 * Y una invariante de contenido: la tarjeta del médico se titula «lo que va a
 * leer el paciente en su portal», así que las dos pantallas piden sus bloques al
 * MISMO módulo y sus líneas tienen que coincidir byte a byte.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Quitando el `fetch` de `action: 'paquetes'` de `src/app/mi/[token]/page.tsx`,
 * el primer bloque falla nombrando la acción huérfana. Cambiando una sola línea
 * de la voz `paciente` en `como-se-ve-el-paquete.ts`, falla el segundo.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **No monta la pantalla ni hace una petición real.** Comprueba que la llamada
 *   está escrita y que la composición es única; que React pinte lo que devuelve
 *   el servidor sólo lo demuestra un navegador, y eso sigue sin ejecutarse
 *   (`NAV-NAVEGADOR-001`).
 * - **No comprueba la compuerta de visibilidad**: eso es
 *   `un-borrador-no-llega-al-paciente.test.ts`, y sigue siendo quien manda.
 * - **No valida el contenido clínico** de los bloques. Que ninguna cifra se
 *   invente lo vigila el golden de `como-se-lo-explico`.
 * - **No cubre el aviso al paciente** de que hay algo nuevo: eso es
 *   `CLOSED-LOOP-PATIENT-001`, y hoy no existe.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  bloquesDelPaquete, SIN_CON_QUE_COMPARAR, ETIQUETA_CAMBIO,
  type ClaveDeBloque,
} from '@/lib/paciente/como-se-ve-el-paquete'
import type { PaqueteDeVisita } from '@/lib/paciente/paquete-de-visita'

const RUTA_PORTAL = join(process.cwd(), 'src/app/api/portal/route.ts')
const PANTALLA_PACIENTE = join(process.cwd(), 'src/app/mi/[token]/page.tsx')
const TARJETA_MEDICO = join(process.cwd(), 'src/components/LiberarAlPaciente.tsx')

const leer = (p: string) => readFileSync(p, 'utf8')

/** Un paquete liberado con algo en cada campo, para que ningún bloque se filtre. */
function paqueteCompleto(): PaqueteDeVisita {
  return {
    notaId: 'nota-1',
    encounterSummary: 'Control de diabetes tipo 2.',
    medicationInstructions: [
      { nombre: 'Metformina', instruccion: 'Metformina 850 mg por la boca cada 12 horas — 2 veces al día' },
    ],
    medicationChanges: [
      { nombre: 'Metformina', tipo: 'modificado' },
      { nombre: 'Glibenclamida', tipo: 'suspendido' },
    ],
    orders: ['Hemoglobina glucosilada'],
    followUp: 'En 3 meses',
    warningSigns: ['Si te sientes mareado y con sudor frío'],
    educationalMaterial: [],
    documents: [],
    unansweredQuestions: [],
    clinicianContactRules: 'Consultorio Rodríguez · WhatsApp 55 1234 5678',
    language: 'es-MX',
    estado: 'RELEASED',
    approvedAt: 1_754_000_000_000,
    approvedBy: 'uid-medico',
    version: 1,
  }
}

describe('REG-308 · toda acción del portal tiene quien la llame', () => {
  /**
   * EL GUARDIÁN QUE HABRÍA CAZADO EL DEFECTO.
   *
   * No mira `paquetes` en particular: enumera lo que la ruta sabe atender y
   * exige un llamador para cada uno. La acción que se escriba mañana entra sola.
   */
  it('cada `case` de /api/portal se pide desde la superficie del paciente', () => {
    const ruta = leer(RUTA_PORTAL)
    const pantalla = leer(PANTALLA_PACIENTE)

    const acciones = [...ruta.matchAll(/^\s*case '([a-z]+)':/gm)].map(m => m[1])
    expect(acciones.length).toBeGreaterThanOrEqual(8)

    /* El literal basta: unas viajan en `action: 'x'` y otras como argumento de
       `accionCita('x', …)`. Lo que se persigue es que exista el llamador. */
    const huerfanas = acciones.filter(a => !pantalla.includes(`'${a}'`))
    expect(huerfanas, `acciones de /api/portal que nadie llama: ${huerfanas.join(', ')}`).toEqual([])
  })

  it('la pantalla del paciente pide los paquetes y los pinta con el módulo compartido', () => {
    const pantalla = leer(PANTALLA_PACIENTE)
    expect(pantalla).toMatch(/action: 'paquetes'/)
    expect(pantalla).toMatch(/bloquesDelPaquete\(paquete, 'paciente'\)/)
  })

  /**
   * `approvedBy` es un uid, no un nombre.
   *
   * Pintarlo le enseñaría al paciente un identificador interno, y derivar un
   * nombre de él sería inventarse quién firmó.
   */
  it('la pantalla del paciente no pinta approvedBy', () => {
    /* Sin los comentarios: la cabecera de `PlanLiberado` explica precisamente
       por qué NO se pinta, y buscar la palabra a secas cazaría esa explicación. */
    const codigo = leer(PANTALLA_PACIENTE).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(codigo).not.toMatch(/\bapprovedBy\b/)
  })
})

describe('REG-308 · el médico aprueba exactamente lo que el paciente lee', () => {
  it('las dos voces dan los mismos bloques, en el mismo orden y con las mismas líneas', () => {
    const p = paqueteCompleto()
    const delMedico = bloquesDelPaquete(p, 'medico')
    const delPaciente = bloquesDelPaquete(p, 'paciente')

    expect(delPaciente.map(b => b.clave)).toEqual(delMedico.map(b => b.clave))
    expect(delPaciente.map(b => b.lineas)).toEqual(delMedico.map(b => b.lineas))
  })

  it('lo único que cambia es el encabezado', () => {
    const p = paqueteCompleto()
    const titulos = (voz: 'medico' | 'paciente') => bloquesDelPaquete(p, voz).map(b => b.titulo)
    expect(titulos('paciente')).not.toEqual(titulos('medico'))
    expect(titulos('paciente')).toContain('Tus medicamentos')
    expect(titulos('medico')).toContain('Sus medicamentos')
  })

  it('las dos pantallas piden sus bloques al mismo módulo', () => {
    expect(leer(TARJETA_MEDICO)).toMatch(/bloquesDelPaquete/)
    expect(leer(PANTALLA_PACIENTE)).toMatch(/bloquesDelPaquete/)
    /* Y ninguna de las dos vuelve a escribir las etiquetas de cambio por su
       cuenta: era la copia que existía antes de REG-308. */
    expect(leer(TARJETA_MEDICO)).not.toMatch(/'se suspende'/)
    expect(leer(PANTALLA_PACIENTE)).not.toMatch(/'se suspende'/)
  })

  it('el orden es el del riesgo: primero lo que hay que hacer, al final cómo preguntar', () => {
    const esperado: ClaveDeBloque[] = ['resumen', 'medicamentos', 'cambios', 'estudios', 'seguimiento', 'alarma', 'contacto']
    expect(bloquesDelPaquete(paqueteCompleto(), 'paciente').map(b => b.clave)).toEqual(esperado)
  })
})

describe('REG-308 · ausencia de dato no es dato de ausencia', () => {
  /**
   * La regla 4 de seguridad clínica, en una pantalla.
   *
   * `medicationChanges === null` significa «no sé qué había antes». Callarlo se
   * lee como «no cambió nada», y el paciente que lo lee deja de comprobar la
   * caja.
   */
  it('sin visita anterior, «qué cambió» se pinta diciendo que no se sabe', () => {
    const p = { ...paqueteCompleto(), medicationChanges: null }
    for (const voz of ['medico', 'paciente'] as const) {
      const cambios = bloquesDelPaquete(p, voz).find(b => b.clave === 'cambios')
      expect(cambios, `la voz ${voz} se calló que no sabe qué cambió`).toBeDefined()
      expect(cambios!.lineas).toEqual([SIN_CON_QUE_COMPARAR])
    }
  })

  it('una lista de cambios vacía sí se calla: no hay nada que decir', () => {
    const p = { ...paqueteCompleto(), medicationChanges: [] }
    expect(bloquesDelPaquete(p, 'paciente').some(b => b.clave === 'cambios')).toBe(false)
  })

  it('cada tipo de cambio tiene su verbo, y «modificado» no dice «sigue igual»', () => {
    expect(ETIQUETA_CAMBIO.modificado).toBe('cambia')
    expect(ETIQUETA_CAMBIO.modificado).not.toBe(ETIQUETA_CAMBIO['sin-cambio'])
    const p = { ...paqueteCompleto(), medicationChanges: [{ nombre: 'Metformina', tipo: 'modificado' as const }] }
    const cambios = bloquesDelPaquete(p, 'paciente').find(b => b.clave === 'cambios')
    expect(cambios!.lineas).toEqual(['Metformina — cambia'])
  })
})

describe('REG-308 · un bloque vacío no se pinta', () => {
  it('un paquete sin nada que decir no produce ni un encabezado', () => {
    const vacio: PaqueteDeVisita = {
      ...paqueteCompleto(),
      encounterSummary: '',
      medicationInstructions: [],
      medicationChanges: [],
      orders: [],
      followUp: '',
      warningSigns: [],
      clinicianContactRules: '',
    }
    expect(bloquesDelPaquete(vacio, 'paciente')).toEqual([])
  })

  it('las líneas en blanco se caen, y con ellas su bloque', () => {
    const p = { ...paqueteCompleto(), orders: ['', '   '] }
    expect(bloquesDelPaquete(p, 'paciente').some(b => b.clave === 'estudios')).toBe(false)
  })

  it('un bloque con una línea buena y otra vacía conserva sólo la buena', () => {
    const p = { ...paqueteCompleto(), orders: ['Biometría hemática', '  '] }
    const estudios = bloquesDelPaquete(p, 'paciente').find(b => b.clave === 'estudios')
    expect(estudios!.lineas).toEqual(['Biometría hemática'])
  })
})
