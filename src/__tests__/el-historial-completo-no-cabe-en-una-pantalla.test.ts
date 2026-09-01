/**
 * GOLDEN — EL HISTORIAL ENTERO DE UN PACIENTE SE BAJABA EN CADA PANTALLA.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `getNotas(clinicId, patientId)` hacía `getDocs` sobre la colección de notas
 * **sin `limit`**. No es una lista de nombres: cada nota lleva dentro
 * `transcripcionCruda`, `transcripcionMotor` y `dialogoDiarizado` —el dictado
 * completo de la consulta, con separación de voces— más el bloque `extraction`
 * con una cita textual por campo. El propio `updateNota` de ese archivo rechaza
 * una nota que pase de 950 KB porque Firestore admite 1 MB por documento: es
 * decir, **una sola nota puede pesar casi un mega**.
 *
 * Seis sitios pedían el historial completo. Los dos peores:
 *
 *  · `hospitalizacion/[internamientoId]` bajaba TODAS las notas del paciente
 *    para quedarse en memoria con las cuatro de un ingreso;
 *  · `cumplimiento/retencion` llamaba a `getNotas` por CADA uno de hasta 500
 *    pacientes —hasta 500 historiales completos— para calcular **una fecha y un
 *    conteo**.
 *
 * Y `getUltimasNotasResumen` se bajaba todas las notas firmadas para producir
 * **tres cadenas de texto**. Su propio comentario explicaba por qué no tenía
 * `orderBy` (haría falta un índice compuesto) sin ver que la consecuencia era
 * quedarse sin `limit`.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Inventario de escala del tablero de Ausculta (P1-12). No falla ninguna prueba:
 * con fixtures de tres notas todo esto es correcto. El defecto sólo existe en
 * función del tamaño del historial, y ningún fixture lo tenía. Por eso aquí se
 * comparan pacientes de tamaños MUY distintos y se cuentan documentos leídos.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * Ningún contrato de lectura del expediente declaraba un tope. `getNotas` se
 * escribió cuando un paciente tenía tres notas, y quien la llamó después heredó
 * «traer el historial» como si fuera gratis.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Las lecturas dependen del límite de página o de la ventana — **nunca del
 * tamaño del historial**. Y cuando el tope recorta, se DECLARA.
 *
 * Aquí eso pesa más que en una lista de pacientes, y por eso hay casos que lo
 * vigilan: de estas notas salen la **medicación vigente** y los **problemas
 * activos**, que aplican la regla de la última palabra sobre cada fármaco y cada
 * problema. Sobre un recorte, un fármaco crónico que no se haya vuelto a
 * mencionar **desaparece** — y la lista se lee como «no toma nada más», con el
 * paciente enfrente y antes de prescribir. Regla 4 de seguridad clínica.
 *
 * Corolario que este golden vigila explícitamente: **una salvaguarda no puede
 * depender de un techo.** El bloqueo NOM-004 de borrado se resolvía filtrando
 * `getNotas` en memoria; con techo, un paciente con historial largo y las
 * firmadas por debajo del techo se habría vuelto BORRABLE. Ahora es una consulta
 * indexada con `limit(1)` que no depende de nada.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · **No prueba Firestore.** El doble implementa `where/orderBy/limit/startAfter/
 *   getCountFromServer` con la semántica que este código usa. No dice nada sobre
 *   índices desplegados, reglas, ni latencia.
 * · **No renderiza.** Que el aviso de recorte exista en el árbol no prueba que
 *   se vea. Eso es navegador, y sigue sin ejecutarse (WS-05).
 * · **No recupera las notas SIN `fechaConsulta`.** Firestore omite de una
 *   consulta ordenada lo que no tiene el campo del `orderBy`. La limitación
 *   **ya existía** —`getNotas` ordenaba por ese campo desde siempre— y aquí
 *   queda probada en vez de supuesta.
 * · **No cubre las nueve pantallas de P1-11**, que reciben el recorte de
 *   `getPatients` sin declararlo. Es otro requisito y sigue abierto.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'

const h = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  contador: { lecturas: 0, getDocs: 0, getDoc: 0 },
  fallos: { collectionGroup: false },
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

import {
  listarNotasPagina, listarNotasCompat, getNotasDeInternamiento,
  resumenRetencionDeNotas, tieneNotaFirmada, getUltimasNotasResumen,
  LIMITE_PAGINA_NOTAS, LIMITE_MAX_PAGINA_NOTAS, TECHO_COMPAT_NOTAS,
} from '@/lib/expediente/firestore'

const CLINICA = 'clinica-sintetica-1'
const PACIENTE = 'pac-sintetico-1'

/**
 * Siembra `n` notas con fechas DESCENDENTES por índice: la 0 es la más reciente.
 * Cero PHI: fechas y textos generados.
 */
function sembrarNotas(n: number, extra: (i: number) => Record<string, unknown> = () => ({})): void {
  for (let i = 0; i < n; i++) {
    const dia = String(n - i).padStart(5, '0')
    h.docs.set(`clinics/${CLINICA}/patients/${PACIENTE}/notas/n${String(i).padStart(5, '0')}`, {
      fechaConsulta: `2${dia}-01-01T10:00:00.000Z`,
      estado: 'firmada',
      resumenEjecutivo: `Resumen sintético ${i}`,
      diagnosticos: [], medicamentos: [], alergias: [], secciones: [],
      ...extra(i),
    })
  }
}

const reset = () => { h.contador.lecturas = 0; h.contador.getDocs = 0; h.contador.getDoc = 0 }

beforeEach(() => { h.docs.clear(); reset() })

describe('LAS LECTURAS DEPENDEN DE LA PÁGINA, NO DEL TAMAÑO DEL HISTORIAL', () => {
  it('EL INVARIANTE: 40 notas y 4 000 notas cuestan lo mismo', async () => {
    sembrarNotas(40)
    const a = await listarNotasPagina(CLINICA, PACIENTE)
    const leidasConPocas = h.contador.lecturas

    h.docs.clear(); reset()
    sembrarNotas(4000)
    const b = await listarNotasPagina(CLINICA, PACIENTE)

    expect(a.notas.length).toBe(LIMITE_PAGINA_NOTAS)
    expect(b.notas.length).toBe(LIMITE_PAGINA_NOTAS)
    expect(
      h.contador.lecturas,
      'una página de un historial de 4 000 no puede costar más que una de 40',
    ).toBe(leidasConPocas)
  })

  it('viene de la más reciente a la más antigua', async () => {
    sembrarNotas(10)
    const p = await listarNotasPagina(CLINICA, PACIENTE, { limite: 3 })
    expect(p.notas.map(n => n.id)).toEqual(['n00000', 'n00001', 'n00002'])
  })

  it('el cursor avanza HACIA ATRÁS en el tiempo y no repite ni se salta', async () => {
    sembrarNotas(10)
    const vistas: string[] = []
    let cursor = null as Awaited<ReturnType<typeof listarNotasPagina>>['cursor']
    for (let vuelta = 0; vuelta < 10; vuelta++) {
      const p: Awaited<ReturnType<typeof listarNotasPagina>> =
        await listarNotasPagina(CLINICA, PACIENTE, { limite: 3, cursor })
      vistas.push(...p.notas.map(n => n.id))
      if (!p.hayMas || !p.cursor) break
      cursor = p.cursor
    }
    expect(vistas).toEqual([...new Set(vistas)])
    expect(vistas.length).toBe(10)
  })

  it('dos notas del MISMO día no rompen el cursor', async () => {
    // Una consulta y su nota de laboratorio el mismo día: sin desempate por
    // documentId la página siguiente repetiría una o se saltaría la otra.
    for (const id of ['a', 'b', 'c', 'd']) {
      h.docs.set(`clinics/${CLINICA}/patients/${PACIENTE}/notas/${id}`, {
        fechaConsulta: '2026-03-03T09:00:00.000Z', estado: 'firmada',
        diagnosticos: [], medicamentos: [], alergias: [], secciones: [],
      })
    }
    const p1 = await listarNotasPagina(CLINICA, PACIENTE, { limite: 2 })
    const p2 = await listarNotasPagina(CLINICA, PACIENTE, { limite: 2, cursor: p1.cursor })
    const vistas = [...p1.notas.map(n => n.id), ...p2.notas.map(n => n.id)]
    expect(vistas.length).toBe(4)
    expect(new Set(vistas).size, 'el mismo día sin desempate repite documentos').toBe(4)
  })

  it('el llamador no puede pedir una página sin techo', async () => {
    sembrarNotas(500)
    const p = await listarNotasPagina(CLINICA, PACIENTE, { limite: 100_000 })
    expect(p.notas.length).toBe(LIMITE_MAX_PAGINA_NOTAS)
  })
})

describe('CUANDO SE QUEDA CORTA, LO DICE', () => {
  it('un historial por debajo del techo NO se declara truncado', async () => {
    sembrarNotas(30)
    const l = await listarNotasCompat(CLINICA, PACIENTE)
    expect(l.notas.length).toBe(30)
    expect(l.truncada).toBe(false)
  })

  it('EL CASO QUE IMPORTA: por encima del techo, `truncada` es true', async () => {
    sembrarNotas(TECHO_COMPAT_NOTAS + 25)
    const l = await listarNotasCompat(CLINICA, PACIENTE)
    expect(l.notas.length).toBe(TECHO_COMPAT_NOTAS)
    expect(
      l.truncada,
      'un historial recortado que no se declara se lee como el historial completo',
    ).toBe(true)
    expect(l.techo).toBe(TECHO_COMPAT_NOTAS)
  })

  it('justo en el techo, sin nada más detrás, NO miente diciendo que falta', async () => {
    sembrarNotas(TECHO_COMPAT_NOTAS)
    const l = await listarNotasCompat(CLINICA, PACIENTE)
    expect(l.notas.length).toBe(TECHO_COMPAT_NOTAS)
    expect(l.truncada, 'declarar un recorte que no existe también es mentir').toBe(false)
  })

  it('y el recorte se queda con las MÁS RECIENTES, que es lo que un médico espera', async () => {
    sembrarNotas(TECHO_COMPAT_NOTAS + 10)
    const l = await listarNotasCompat(CLINICA, PACIENTE)
    expect(l.notas[0].id).toBe('n00000')
  })
})

describe('UNA SALVAGUARDA NO PUEDE DEPENDER DE UN TECHO', () => {
  it('encuentra una nota firmada MUCHO más allá del techo de compatibilidad', async () => {
    // El historial largo es de borradores; la única firmada es la más antigua.
    sembrarNotas(TECHO_COMPAT_NOTAS + 50, i => ({
      estado: i === TECHO_COMPAT_NOTAS + 49 ? 'firmada' : 'borrador',
    }))
    const l = await listarNotasCompat(CLINICA, PACIENTE)
    expect(
      l.notas.some(n => n.estado === 'firmada'),
      'montaje: la firmada tiene que quedar FUERA del recorte para que el caso pruebe algo',
    ).toBe(false)
    expect(
      await tieneNotaFirmada(CLINICA, PACIENTE),
      'con el filtro en memoria sobre el recorte, este paciente sería BORRABLE pese a tener una nota firmada (NOM-004)',
    ).toBe(true)
  })

  it('y no inventa una firmada donde no la hay', async () => {
    sembrarNotas(20, () => ({ estado: 'borrador' }))
    expect(await tieneNotaFirmada(CLINICA, PACIENTE)).toBe(false)
  })

  it('la comprobación cuesta UNA lectura, tenga el paciente 20 notas o 2 000', async () => {
    sembrarNotas(2000, () => ({ estado: 'firmada' }))
    reset()
    await tieneNotaFirmada(CLINICA, PACIENTE)
    expect(h.contador.lecturas).toBe(1)
  })
})

describe('LAS NOTAS DE UN INGRESO SALEN POR CONSULTA INDEXADA', () => {
  it('un ingreso ANTIGUO ya no se pinta vacío', async () => {
    // 300 notas de consultorio más recientes, y las del ingreso al fondo.
    sembrarNotas(300, i => (i >= 298 ? { internamientoId: 'ing-1' } : {}))
    const delIngreso = await getNotasDeInternamiento(CLINICA, PACIENTE, 'ing-1')
    expect(
      delIngreso.length,
      'un episodio de hospital sin notas no se lee como «no cargaron»: se lee como «no se escribió nada»',
    ).toBe(2)
  })

  it('y no cuesta el historial entero', async () => {
    sembrarNotas(2000, i => (i >= 1998 ? { internamientoId: 'ing-1' } : {}))
    reset()
    await getNotasDeInternamiento(CLINICA, PACIENTE, 'ing-1')
    expect(h.contador.lecturas).toBe(2)
  })

  it('no se lleva las notas de OTRO ingreso del mismo paciente', async () => {
    sembrarNotas(6, i => ({ internamientoId: i < 3 ? 'ing-1' : 'ing-2' }))
    const a = await getNotasDeInternamiento(CLINICA, PACIENTE, 'ing-1')
    expect(a.map(n => n.id).sort()).toEqual(['n00000', 'n00001', 'n00002'])
  })
})

describe('LA PANTALLA DE RETENCIÓN NO SE BAJA 500 HISTORIALES', () => {
  it('una fecha y un conteo cuestan dos lecturas, no el historial', async () => {
    sembrarNotas(1500)
    reset()
    const r = await resumenRetencionDeNotas(CLINICA, PACIENTE)
    expect(r.notasFirmadas).toBe(1500)
    expect(
      h.contador.lecturas,
      'la nota más reciente (1) + el conteo en servidor (1 por millar): nunca 1 500',
    ).toBeLessThanOrEqual(3)
  })

  it('el conteo de firmadas NO depende de ningún techo', async () => {
    sembrarNotas(TECHO_COMPAT_NOTAS + 40)
    const r = await resumenRetencionDeNotas(CLINICA, PACIENTE)
    expect(
      r.notasFirmadas,
      'este número se enseña al lado de un veredicto NOM-004: recortarlo lo vuelve falso',
    ).toBe(TECHO_COMPAT_NOTAS + 40)
  })

  it('la fecha es la de la nota MÁS RECIENTE', async () => {
    sembrarNotas(50)
    const r = await resumenRetencionDeNotas(CLINICA, PACIENTE)
    expect(r.ultimaFecha).toBe('200050-01-01T10:00:00.000Z')
  })

  it('un paciente sin notas devuelve null, no una fecha inventada', async () => {
    const r = await resumenRetencionDeNotas(CLINICA, PACIENTE)
    expect(r.ultimaFecha).toBeNull()
    expect(r.notasFirmadas).toBe(0)
  })
})

describe('EL CONTEXTO DE IA PIDE LAS TRES FIRMADAS, NI UNA MÁS (REG-421)', () => {
  it('tres resúmenes cuestan tres lecturas, no una ventana de cuarenta', async () => {
    sembrarNotas(1000)
    reset()
    const texto = await getUltimasNotasResumen(CLINICA, PACIENTE)
    expect(texto).toContain('Resumen sintético 0')
    expect(
      h.contador.lecturas,
      'con el índice `notas(estado, fechaConsulta)` desplegado se piden las 3 '
      + 'firmadas más recientes; antes se bajaban 40 y se filtraba en memoria',
    ).toBe(3)
  })

  it('sigue quedándose sólo con las FIRMADAS', async () => {
    sembrarNotas(10, i => ({ estado: i < 2 ? 'borrador' : 'firmada' }))
    const texto = await getUltimasNotasResumen(CLINICA, PACIENTE)
    expect(texto).not.toContain('Resumen sintético 0')
    expect(texto).toContain('Resumen sintético 2')
  })

  it('encuentra una firmada ENTERRADA bajo cuarenta borradores', async () => {
    /**
     * ÉSTE ES EL HUECO QUE CIERRA REG-421, Y FALLA SIN EL ARREGLO.
     *
     * Con la ventana de 40 + filtro en memoria, un paciente cuyas últimas
     * cuarenta notas fueran borradores devolvía resumen VACÍO aunque tuviera
     * firmadas más atrás. Se toleraba porque este texto es contexto de IA y una
     * tarjeta de cortesía — pero era una ausencia que no significaba nada, y en
     * esta casa la ausencia de dato no es dato de ausencia.
     *
     * Con `where('estado','==','firmada')` en la consulta, la busca donde esté.
     */
    sembrarNotas(45, i => ({ estado: i < 41 ? 'borrador' : 'firmada' }))
    const texto = await getUltimasNotasResumen(CLINICA, PACIENTE)
    expect(texto).toContain('Resumen sintético 41')
  })

  it('sin notas firmadas devuelve cadena vacía, no un texto a medias', async () => {
    sembrarNotas(5, () => ({ estado: 'borrador' }))
    expect(await getUltimasNotasResumen(CLINICA, PACIENTE)).toBe('')
  })
})

describe('LO QUE ESTE ORDEN DEJA FUERA, PROBADO EN VEZ DE SUPUESTO', () => {
  it('una nota SIN `fechaConsulta` no aparece en el historial paginado', async () => {
    sembrarNotas(3)
    h.docs.set(`clinics/${CLINICA}/patients/${PACIENTE}/notas/sin-fecha`, {
      estado: 'firmada', diagnosticos: [], medicamentos: [], alergias: [], secciones: [],
    })
    const l = await listarNotasCompat(CLINICA, PACIENTE)
    expect(l.notas.map(n => n.id)).not.toContain('sin-fecha')
    // Y la vía que NO ordena por fecha sí la encuentra: la limitación es del
    // `orderBy`, no del expediente.
    expect(await tieneNotaFirmada(CLINICA, PACIENTE)).toBe(true)
  })
})

describe('EL RECORTE LLEGA A LA PANTALLA — no se queda en la función', () => {
  const leer = (p: string) => readFileSync(p, 'utf8')

  it('ya no existe una puerta que devuelva el historial como array pelado', () => {
    const lib = leer('src/lib/expediente/firestore.ts')
    expect(
      /export async function getNotas\(/.test(lib),
      'un array no puede decir que viene recortado; por eso esa puerta se borró',
    ).toBe(false)
  })

  it('el hook del expediente saca `truncada` a la superficie', () => {
    const hook = leer('src/hooks/useExpediente.ts')
    expect(hook).toContain('listarNotasCompat')
    expect(hook).toContain('truncada')
    // Un fallo de carga NO es un historial recortado: son dos cosas distintas.
    expect(hook).toContain('setTruncada(false)')
  })

  it('el expediente lo pinta ANTES de las conclusiones derivadas', () => {
    const pag = leer('src/app/(dashboard)/expediente/[patientId]/page.tsx')
    expect(pag).toContain('historialTruncado')
    expect(pag).toContain('no des por ausente')
    expect(
      pag.indexOf('{historialTruncado &&'),
      'si el aviso va debajo del resumen, el médico lee la conclusión antes de saber que falta historia',
    ).toBeLessThan(pag.indexOf('<PatientAnchor'))
  })

  it('la consulta avisa junto a la MEDICACIÓN VIGENTE, que es lo que puede faltar', () => {
    const pag = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')
    expect(pag).toContain('setHistorialTruncado(truncada)')
    expect(pag).toContain('puede faltar')
    // El aviso vive dentro del bloque de medicación vigente, no en otro sitio.
    const bloque = pag.slice(pag.indexOf('{vigentes.length > 0 &&'))
    expect(bloque.slice(0, 4000)).toContain('historialTruncado')
  })
})
