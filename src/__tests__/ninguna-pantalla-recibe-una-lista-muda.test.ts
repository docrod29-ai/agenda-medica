/**
 * GOLDEN — NUEVE PANTALLAS TRATABAN UN RECORTE COMO EL CENSO COMPLETO.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * REG-341 le puso techo a `getPatients` y REG-347 encontró la factura en la
 * pantalla de buscar. Quedaron **nueve pantallas más** haciendo lo mismo, cada
 * una con su consecuencia:
 *
 *  · `/asistente` — el typeahead filtraba el recorte en memoria. Al no ver al
 *    paciente, quien agenda lo daba de alta otra vez; y `elegirExpedienteParaCita`
 *    decidía **a qué expediente se cuelga la cita** comparando contra ese mismo
 *    recorte. La nota, el diagnóstico y la receta van detrás.
 *  · `/migracion` — clasificaba las filas de un CSV contra 500 de N: **todo el
 *    que quedara fuera salía como «nuevo»**, y un clic duplicaba el consultorio
 *    entero. Y el botón de exportar descargaba 500 pacientes diciendo «tu
 *    información es tuya».
 *  · `/farmacia` — un `<select>` con el directorio para elegir a quién se
 *    dispensa. En un controlado ese campo es OBLIGATORIO (NOM-220): el paciente
 *    no aparecía entre las opciones y la salida se registraba a nombre de otro
 *    o sin nombre.
 *  · `/cumplimiento` — el filtro de la bitácora era otro `<select>` del
 *    directorio: el auditor —o el paciente ejerciendo ARCO— no podía nombrar a
 *    quien quería rastrear. Y el panel de retención afirmaba «al día» habiendo
 *    mirado 500 de N.
 *  · `/hospitalizacion` — el buscador del ingreso, y el antiduplicado del alta.
 *  · `/citas` — el índice `id → Patient` de las filas: las citas cuyo paciente
 *    quedó fuera se pintaban sin nombre y sin su señal de riesgo, igual que si
 *    el paciente no existiera.
 *  · `/membresias` — el buscador del modal de asignación.
 *  · `/crm` y `/reactivacion` — cifras y campañas calculadas sobre el recorte y
 *    presentadas como hechos del consultorio.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * REG-347 lo dejó escrito al cerrarse: «quedan nueve pantallas sin declarar el
 * recorte». Es P1-11 del tablero de Ausculta. Ninguna prueba fallaba: todas son
 * correctas con fixtures pequeños.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * **Un `Patient[]` pelado no puede decir que viene recortado.** Acotar
 * `getPatients` y conservar su firma dejó una puerta por la que el recorte pasa
 * sin etiqueta, y quien lo recibe no tiene forma de enterarse. El fallo va
 * siempre hacia el silencio —«no está», «es nuevo», «al día»— que es la
 * dirección que nadie vuelve a comprobar.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Ninguna pantalla llama a `getPatients`. Hay cuatro puertas y cada una dice lo
 * que aquélla callaba: `listarPacientesPagina`, `listarPacientesCompat` (con
 * `truncada`), `buscarPacientes`/`candidatosDePaciente` y `recorrerPacientes`.
 *
 * Y **los sondeos viven en un solo sitio**. Copiar los dos de REG-347 nueve
 * veces habría garantizado que divergieran: es el patrón `depende_de_recordar`
 * de este repositorio.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · **No renderiza.** Los casos de pantalla leen la FUENTE: comprueban que el
 *   aviso y el camino existan, no que se vean. Eso es navegador (WS-05).
 * · **La búsqueda sigue siendo por PREFIJO.** Un duplicado con el orden de los
 *   nombres cambiado y sin teléfono en común no aparece (P1-17). No se cierra
 *   aquí; tampoco se agranda.
 * · **No prueba Firestore**: el doble no dice nada de índices ni de reglas.
 * · **`recorrerPacientes` no está medido contra un directorio real.** Su techo
 *   de 50 000 es una cota razonada, y cuando se toca la operación se DETIENE o
 *   avisa — que es lo que se prueba aquí.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const h = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  contador: { lecturas: 0, getDocs: 0, getDoc: 0 },
  fallos: { collectionGroup: false, lectura: false },
}))

vi.mock('@/lib/firebase', () => ({
  db: { doble: true },
  auth: { currentUser: { uid: 'medico-sintetico' } },
  storage: null,
}))
vi.mock('@/lib/expediente/audit-log', () => ({ logAudit: async () => {} }))
vi.mock('firebase/firestore', async () => {
  const { firestoreClienteSobre } = await import('./_harness/firestore-cliente-en-memoria')
  return firestoreClienteSobre(h)
})

import { candidatosDePaciente, duplicadosProbablesDe } from '@/lib/pacientes/candidatos'
import {
  recorrerPacientes, invalidarCachePacientes,
  TECHO_COMPAT_PACIENTES, VENTANA_BUSQUEDA_PACIENTES,
} from '@/lib/firestore'

const CLINICA = 'clinica-sintetica-1'

function sembrar(n: number, nombre: (i: number) => string = i => `Paciente ${String(i).padStart(5, '0')}`) {
  for (let i = 0; i < n; i++) {
    h.docs.set(`clinics/${CLINICA}/patients/p${String(i).padStart(5, '0')}`, {
      nombre: nombre(i), telefono: `55${String(10000000 + i)}`,
    })
  }
}

const reset = () => { h.contador.lecturas = 0; h.contador.getDocs = 0; h.contador.getDoc = 0 }

beforeEach(() => { h.docs.clear(); invalidarCachePacientes(); reset() })

describe('PREGUNTAR POR ALGUIEN NO DEPENDE DEL TAMAÑO DEL CONSULTORIO', () => {
  it('EL CASO: encuentra a un paciente que está MUY por encima del techo de compatibilidad', async () => {
    sembrar(TECHO_COMPAT_PACIENTES + 400)
    // El nombre del último: con el filtro en memoria sobre el recorte, este
    // paciente no existía para el typeahead ni para el antiduplicado.
    const buscado = `Paciente ${String(TECHO_COMPAT_PACIENTES + 399).padStart(5, '0')}`
    const c = await candidatosDePaciente(CLINICA, { nombre: buscado })
    expect(c.pacientes.map(p => p.nombre)).toContain(buscado)
    expect(c.sePudoPreguntar).toBe(true)
  })

  it('y cuesta lo mismo en un consultorio de 100 que en uno de 5 000', async () => {
    sembrar(100)
    await candidatosDePaciente(CLINICA, { nombre: 'Paciente 00050' })
    const conPocos = h.contador.lecturas

    h.docs.clear(); reset()
    sembrar(5000)
    await candidatosDePaciente(CLINICA, { nombre: 'Paciente 00050' })
    expect(h.contador.lecturas).toBe(conPocos)
  })

  it('sondea por TELÉFONO y por NOMBRE: el teléfono es la señal fuerte de duplicado', async () => {
    h.docs.set(`clinics/${CLINICA}/patients/x1`, { nombre: 'Zeta Sintética', telefono: '5511110000' })
    // El nombre no se parece; el teléfono sí. Un sondeo sólo por nombre lo pierde.
    const c = await candidatosDePaciente(CLINICA, { nombre: 'Otra Persona', telefono: '5511110000' })
    expect(c.pacientes.map(p => p.id)).toContain('x1')
  })

  it('«no se pudo preguntar» NO se cuenta como «no hay»', async () => {
    sembrar(10)
    h.fallos.lectura = true
    try {
      const c = await candidatosDePaciente(CLINICA, { nombre: 'Paciente 00001' })
      expect(c.pacientes).toEqual([])
      expect(
        c.sePudoPreguntar,
        'un fallo de lectura que se cuenta como «no hay duplicado» crea el duplicado',
      ).toBe(false)
    } finally {
      h.fallos.lectura = false
    }
  })

  it('sin nombre ni teléfono no falla: es un vacío honesto, no un error', async () => {
    const c = await candidatosDePaciente(CLINICA, {})
    expect(c.pacientes).toEqual([])
    expect(c.sePudoPreguntar).toBe(true)
  })

  it('declara `truncada` cuando la ventana se llena', async () => {
    // Muchísimos homónimos: la ventana de búsqueda se llena y puede haber más.
    sembrar(VENTANA_BUSQUEDA_PACIENTES + 50, () => 'Paciente Homonimo')
    const c = await candidatosDePaciente(CLINICA, { nombre: 'Paciente Homonimo' })
    expect(c.truncada).toBe(true)
  })
})

describe('EL ANTIDUPLICADO ES EL MISMO EN TODAS LAS PUERTAS DE ALTA', () => {
  it('reconoce a un duplicado seguro que está por encima del techo', async () => {
    sembrar(TECHO_COMPAT_PACIENTES + 100)
    // Nombre idéntico Y misma fecha de nacimiento: el motor sólo dice `seguro`
    // con eso (el teléfono nunca basta solo — es el celular de la familia).
    h.docs.set(`clinics/${CLINICA}/patients/tarde`, {
      nombre: 'Zulema Sintética Prueba', telefono: '5544332211', fechaNacimiento: '1980-05-04',
    })
    const r = await duplicadosProbablesDe(CLINICA, {
      nombre: 'Zulema Sintética Prueba', telefono: '5544332211', fechaNacimiento: '1980-05-04',
    })
    expect(r.seguros.map(x => x.paciente.id)).toContain('tarde')
    expect(r.sePudoPreguntar).toBe(true)
  })

  it('respeta el «es otra persona» que ya se dijo en la pantalla', async () => {
    h.docs.set(`clinics/${CLINICA}/patients/descartado`, {
      nombre: 'Zulema Sintética Prueba', telefono: '5544332211', fechaNacimiento: '1980-05-04',
    })
    const r = await duplicadosProbablesDe(
      CLINICA,
      { nombre: 'Zulema Sintética Prueba', telefono: '5544332211', fechaNacimiento: '1980-05-04' },
      new Set(['descartado']),
    )
    expect(r.seguros).toEqual([])
  })
})

describe('EXPORTAR E IMPORTAR SÍ RECORREN EL DIRECTORIO ENTERO', () => {
  it('el recorrido trae a TODOS, no 500', async () => {
    sembrar(TECHO_COMPAT_PACIENTES + 700)
    const r = await recorrerPacientes(CLINICA)
    expect(r.pacientes.length).toBe(TECHO_COMPAT_PACIENTES + 700)
    expect(r.incompleto).toBe(false)
  })

  it('pero sigue acotado: si se toca el techo, lo DICE', async () => {
    sembrar(300)
    const r = await recorrerPacientes(CLINICA, { techo: 120 })
    expect(r.pacientes.length).toBeLessThanOrEqual(120)
    expect(
      r.incompleto,
      'un recorrido que se queda corto en silencio es peor que uno que falla',
    ).toBe(true)
  })

  it('no repite ni se salta a nadie al pasar de página', async () => {
    sembrar(650)
    const r = await recorrerPacientes(CLINICA)
    const ids = r.pacientes.map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('EL GUARDIÁN: ninguna pantalla vuelve a recibir una lista muda', () => {
  /** Todos los `.ts`/`.tsx` de la capa de producto. */
  function archivosDe(raiz: string): string[] {
    const out: string[] = []
    const caminar = (d: string) => {
      for (const e of readdirSync(d)) {
        const p = join(d, e)
        if (statSync(p).isDirectory()) { caminar(p); continue }
        if (/\.tsx?$/.test(p)) out.push(p)
      }
    }
    caminar(raiz)
    return out
  }

  const pantallas = [
    ...archivosDe('src/app'),
    ...archivosDe('src/components'),
    ...archivosDe('src/hooks'),
  ]

  it('el guardián mira de verdad un árbol grande (si no, pasa por vacío)', () => {
    expect(pantallas.length).toBeGreaterThan(100)
  })

  it('NINGUNA pantalla llama a `getPatients`', () => {
    /**
     * Se busca la LLAMADA, no la palabra: varios archivos la nombran en un
     * comentario para explicar por qué ya no la usan, y borrar esa explicación
     * para que pase un regex sería perder justamente lo que evita la recaída.
     */
    const culpables = pantallas.filter(p => /\bgetPatients\(/.test(readFileSync(p, 'utf8')))
    expect(
      culpables,
      'Un `Patient[]` pelado no puede decir que viene recortado. Usa ' +
      'listarPacientesCompat (y mira `truncada`), buscarPacientes / ' +
      'candidatosDePaciente, o recorrerPacientes si de verdad los necesitas todos.',
    ).toEqual([])
  })

  it('y ninguna importa `getPatients`', () => {
    const culpables = pantallas.filter(p => /import\s*\{[^}]*\bgetPatients\b/.test(readFileSync(p, 'utf8')))
    expect(culpables).toEqual([])
  })
})

describe('CADA PANTALLA DICE LO QUE ANTES CALLABA', () => {
  const leer = (p: string) => readFileSync(p, 'utf8')

  it('/asistente busca en el servidor y NO decide expediente si no pudo preguntar', () => {
    const src = leer('src/app/(dashboard)/asistente/page.tsx')
    expect(src).toContain('candidatosDePaciente')
    // Crear un expediente a partir de un fallo de lectura es fabricar un duplicado.
    expect(src).toContain('if (!sePudoPreguntar) throw')
  })

  it('/migracion no clasifica un CSV si no pudo revisar el directorio entero', () => {
    const src = leer('src/app/(dashboard)/migracion/page.tsx')
    expect(src).toContain('recorrerPacientes')
    expect(src).toContain('duplicaría expedientes')
    // Y el export incompleto se declara en vez de pasar por completo.
    expect(src).toContain('El archivo está INCOMPLETO')
  })

  it('/farmacia busca al paciente al que dispensa, no lo elige de un desplegable', () => {
    const src = leer('src/app/(dashboard)/farmacia/page.tsx')
    expect(src).toContain('useBusquedaDePacientes')
    expect(src).not.toMatch(/pacientes\.map\(p => <option/)
  })

  it('/cumplimiento puede nombrar a cualquier paciente en la bitácora', () => {
    const src = leer('src/app/(dashboard)/cumplimiento/page.tsx')
    expect(src).toContain('useBusquedaDePacientes')
    expect(src).toContain('usePacientesPorId')
    // Y el veredicto NOM-004 no se afirma sobre un recorte.
    expect(src).toContain('!pacientesViejos.truncada')
  })

  it('/hospitalizacion distingue «no hay» de «no se pudo preguntar»', () => {
    const src = leer('src/app/(dashboard)/hospitalizacion/page.tsx')
    expect(src).toContain('No se pudo consultar el directorio')
    expect(src).toContain('duplicadosProbablesDe')
  })

  it('/citas resuelve los pacientes que pinta, no el directorio', () => {
    const src = leer('src/app/(dashboard)/citas/page.tsx')
    expect(src).toContain('usePacientesPorId')
  })

  it('/crm y /reactivacion declaran que sus cifras salen de un recorte', () => {
    expect(leer('src/app/(dashboard)/crm/page.tsx')).toContain('no son el total')
    expect(leer('src/app/(dashboard)/reactivacion/page.tsx')).toContain('esta pantalla no ha mirado')
  })

  it('/membresias dice cuándo hay más coincidencias de las que enseña', () => {
    expect(leer('src/app/(dashboard)/membresias/page.tsx')).toContain('escribe más letras')
  })
})
