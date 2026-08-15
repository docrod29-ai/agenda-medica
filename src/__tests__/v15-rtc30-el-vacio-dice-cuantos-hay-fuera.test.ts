/**
 * RTC-30, CUARTA APLICACIÓN — Y LA PRIMERA EN LA QUE LA REGLA ES UNA PIEZA.
 *
 * ── QUÉ FALLABA, Y CÓMO SE DESCUBRIÓ ────────────────────────────────────────
 *
 * El estado vivo de V15 dejó nombradas cuatro pantallas pendientes de RTC-30
 * («siguen con el hero, y se miran caso por caso: lista de espera, farmacia,
 * cumplimiento, reactivación»). Mirándolas una a una:
 *
 *   · `/lista-espera` — **NO era defecto.** No tiene filtro ni buscador: cero
 *     filas significa que la lista de espera está vacía de verdad, y ahí el
 *     héroe con «Agregar» es la respuesta correcta. Queda declarado para que
 *     nadie lo «arregle» después.
 *   · `/farmacia` — «Sin resultados con esos filtros», ilustración de página
 *     entera y **ningún control**: con 24 ítems dentro se lee igual que una
 *     farmacia recién abierta, y para volver a verlos había que acordarse de
 *     vaciar el buscador Y de devolver el desplegable a «Todas».
 *   · `/cumplimiento` (bitácora) — con 200 asientos traídos y el filtro de
 *     tipo puesto, decía **«Sin eventos registrados aún · Cada acceso,
 *     escritura, impresión y firma quedará aquí»**: describía una bitácora que
 *     todavía no existe, sobre una que sí. Es el peor sitio del producto para
 *     esa frase — la pantalla cita NOM-024 Art. 6.5 dos líneas más abajo.
 *   · `/reactivacion` — el peor de los cuatro, y no por feo: **felicitaba.**
 *     «Nadie pendiente de reactivar · No hay pacientes con más de 365 días sin
 *     volver. ¡Buen seguimiento!» se pintaba igual cuando de verdad no había
 *     nadie que cuando había doce pacientes sin volver y la lista los escondía
 *     por cuatro razones distintas: la píldora del umbral, la baja de
 *     WhatsApp, el bloqueo ARCO y —el que más duele— no tener un teléfono al
 *     que escribir.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * La regla RTC-30 se había descubierto TRES veces (Hoy, REG-314 en `/citas`,
 * REG-315 en `/pacientes`) y las tres se había vuelto a escribir entera. No
 * existía como pieza, así que la cuarta pantalla no podía heredarla: cada una
 * tenía que acordarse sola de decir cuántos hay fuera y de no ofrecer «crear»
 * encima de lo que un filtro esconde.
 *
 * En `/reactivacion` había además una segunda causa, más honda: el desglose no
 * se podía pintar porque **no se calculaba**. `pacientesParaReactivar` devolvía
 * la lista y tiraba el motivo de cada ausencia por el camino.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * `src/lib/ui/vacio-de-una-lista.ts` — una sola función decide clase, PESO,
 * recuento y gestos:
 *
 *   1. Héroe y gesto de alta **sólo** con el conjunto entero vacío.
 *   2. Con filas escondidas: variante línea, título que dice cuántas hay FUERA
 *      y gestos que sueltan la causa. Nunca el de alta — ofrecer crear encima
 *      de lo que un filtro esconde es invitar al duplicado.
 *   3. Una causa que no se puede soltar (`gesto: null`) **se dice igual**.
 *   4. Sin causa declarada no se inventa una: se dice el número, que es lo que
 *      se sabe.
 *
 * Y `clasificarParaReactivar` es ahora la única fuente de verdad sobre a quién
 * se reactiva: `pacientesParaReactivar` es una VISTA suya. Si el desglose que
 * se pinta y la lista que se enseña se calcularan por separado, el día que uno
 * cambiara el otro mentiría — «el dato tiene que LLEGAR» aplicado al revés.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Con la conducta vieja restaurada, caen los casos 2, 3, 4, 5, 8, 9, 10 y 11:
 *
 * · devolviendo `variante: 'hero'` siempre                       → cae el 2
 * · devolviendo el gesto de alta con restricciones activas       → cae el 3
 * · filtrando las restricciones sin gesto antes de la frase      → cae el 4
 * · inventando una frase amable sin causa declarada              → cae el 5
 * · volviendo `desgloseDeReactivacion` a contar sólo candidatos  → caen 8 y 9
 * · devolviendo los literales viejos a las tres pantallas        → caen 10 y 11
 *
 * El caso 11 se escribe contra el USO (`describirVacioDeUnaLista({`) y no
 * contra el identificador suelto: en REG-315 un caso pasó en verde con la
 * llamada borrada porque el nombre seguía escrito en la línea del `import`.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No mide píxeles: que la variante línea pese menos que el héroe lo
 *   comprueba el arnés de navegador, no esto.
 * · No convierte `vacio-de-la-agenda` ni `vacio-de-la-lista` — los dos casos
 *   especiales, con conocimiento que aquí no cabe (los parecidos por nombre,
 *   el día siguiente) y los dos ya medidos en navegador.
 * · No toca `/lista-espera`: ahí no hay defecto que probar.
 * · No comprueba la redacción de cada frase de causa: son del dominio de cada
 *   pantalla y entran como dato.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import {
  describirVacioDeUnaLista,
  contar,
  enumerarEsMx,
  type RestriccionDeLista,
} from '@/lib/ui/vacio-de-una-lista'
import {
  pacientesParaReactivar,
  clasificarParaReactivar,
  desgloseDeReactivacion,
} from '@/lib/reactivacion'
import type { Patient } from '@/types'

const REGISTRO_VACIO = { titulo: 'No hay nada', descripcion: 'Todavía.', gesto: 'Agregar' }
const FILTRO: RestriccionDeLista = { id: 'f', frase: 'el filtro los esconde', gesto: 'Quitar el filtro' }
const SIN_GESTO: RestriccionDeLista = { id: 'x', frase: '3 pidieron no recibir mensajes', gesto: null }

describe('RTC-30 · la decisión, dicha una sola vez', () => {
  it('1. el conjunto entero vacío conserva el héroe y su gesto de alta', () => {
    const v = describirVacioDeUnaLista({
      total: 0, sustantivo: ['ítem', 'ítems'], restricciones: [], registroVacio: REGISTRO_VACIO,
    })
    expect(v.clase).toBe('registro-vacio')
    expect(v.variante).toBe('hero')
    expect(v.titulo).toBe('No hay nada')
    expect(v.gestos).toEqual([{ id: 'alta', etiqueta: 'Agregar' }])
  })

  it('2. con filas escondidas el vacío pesa MENOS y dice cuántas hay fuera', () => {
    const v = describirVacioDeUnaLista({
      total: 24, sustantivo: ['ítem', 'ítems'], restricciones: [FILTRO], registroVacio: REGISTRO_VACIO,
    })
    expect(v.clase).toBe('ocultos-por-restriccion')
    expect(v.variante).toBe('linea')
    // El número no es decorado: es la mitad de la frase que faltaba.
    expect(v.titulo).toContain('24 ítems')
    expect(v.titulo).toContain('fuera de lo que estás mirando')
  })

  it('3. NUNCA se ofrece crear por encima de lo que una restricción esconde', () => {
    const v = describirVacioDeUnaLista({
      total: 24, sustantivo: ['ítem', 'ítems'], restricciones: [FILTRO], registroVacio: REGISTRO_VACIO,
    })
    expect(v.gestos.map(g => g.id)).toEqual(['f'])
    expect(v.gestos.some(g => g.id === 'alta')).toBe(false)
    expect(JSON.stringify(v.gestos)).not.toContain('Agregar')
  })

  it('4. una causa que no se puede soltar se DICE igual, aunque no traiga botón', () => {
    const v = describirVacioDeUnaLista({
      total: 12, sustantivo: ['paciente', 'pacientes'],
      restricciones: [FILTRO, SIN_GESTO], registroVacio: REGISTRO_VACIO,
    })
    expect(v.descripcion).toContain('3 pidieron no recibir mensajes')
    expect(v.descripcion).toContain('el filtro los esconde')
    // Pero sólo la que se puede soltar trae gesto.
    expect(v.gestos.map(g => g.id)).toEqual(['f'])
  })

  it('5. sin causa declarada NO se inventa una frase amable', () => {
    const v = describirVacioDeUnaLista({
      total: 7, sustantivo: ['asiento', 'asientos'], restricciones: [], registroVacio: REGISTRO_VACIO,
    })
    expect(v.clase).toBe('sin-causa-declarada')
    expect(v.titulo).toContain('7 asientos')
    expect(v.descripcion).toContain('no sabe decir por qué')
    expect(v.gestos).toEqual([])
  })

  it('6. singular y plural, y la enumeración en es-MX', () => {
    expect(contar(1, ['ítem', 'ítems'])).toBe('1 ítem')
    expect(contar(24, ['ítem', 'ítems'])).toBe('24 ítems')
    expect(enumerarEsMx(['a'])).toBe('a')
    expect(enumerarEsMx(['a', 'b'])).toBe('a y b')
    expect(enumerarEsMx(['a', 'b', 'c'])).toBe('a, b y c')
  })
})

/* ── /reactivacion: el desglose que hacía falta para no felicitar en falso ── */

const HOY = '2026-08-15'
const paciente = (id: string, dias: number, extra: Partial<Patient> = {}): Patient => {
  const d = new Date(Date.UTC(2026, 7, 15) - dias * 86400000)
  return {
    id, nombre: `Paciente ${id}`, telefono: '5512345678',
    ultimaCita: d.toISOString().slice(0, 10),
    createdAt: '2024-01-01',
    ...extra,
  } as Patient
}

describe('RTC-30 · /reactivacion: por qué NO aparece quien lleva meses sin volver', () => {
  it('7. equivalencia funcional: la lista que se enseña no cambió', () => {
    const ps = [
      paciente('a', 400), paciente('b', 200), paciente('c', 10),
      paciente('d', 300, { telefono: '', whatsapp: '' }),
    ]
    const out = pacientesParaReactivar(ps, HOY, 90)
    expect(out.map(c => c.paciente.id)).toEqual(['a', 'b'])   // sin teléfono fuera, ordenados por antigüedad
    expect(out[0].dias).toBeGreaterThan(out[1].dias)
    expect(out.every(c => c.tuvoCita)).toBe(true)
    // Y es literalmente una VISTA del clasificador: mismo conjunto.
    expect(out.map(c => c.paciente.id).sort()).toEqual(
      clasificarParaReactivar(ps, HOY, 90).filter(c => c.fuera === null).map(c => c.paciente.id).sort(),
    )
  })

  it('8. el desglose cuenta a TODOS los que llevan tiempo sin volver, y por qué', () => {
    const ps = [
      paciente('visible', 400),
      paciente('bajo-umbral', 120),                                    // pasa 90, no pasa 365
      paciente('sin-tel', 400, { telefono: '', whatsapp: '' }),
      paciente('baja', 400, { telefono: '5510000001' }),
      paciente('con-cita', 400, { telefono: '5510000002' }),
      paciente('reciente', 5),                                         // ni siquiera llega al mínimo
    ]
    const razon = (p: Patient) =>
      p.id === 'baja' ? 'baja' as const : p.id === 'con-cita' ? 'cita-futura' as const : null

    const d = desgloseDeReactivacion(ps, HOY, 365, 90, razon)
    expect(d.candidatos.map(c => c.paciente.id)).toEqual(['visible'])
    expect(d.sinTelefono).toBe(1)
    expect(d.conBaja).toBe(1)
    expect(d.conCitaFutura).toBe(1)
    expect(d.bajoElUmbral).toBe(1)
    // «reciente» NO cuenta: no es de quien habla esta pantalla.
    expect(d.total).toBe(5)
    // Los cinco cubos suman el total, sin solaparse: si se solaparan, la
    // pantalla diría un número mayor del que hay.
    expect(d.sinTelefono + d.conBaja + d.conCitaFutura + d.bajoElUmbral + d.candidatos.length).toBe(d.total)
  })

  it('9. la felicitación sólo sobrevive cuando de verdad no hay nadie', () => {
    const nadie = desgloseDeReactivacion([paciente('r', 5)], HOY, 90, 90)
    expect(nadie.total).toBe(0)
    const v = describirVacioDeUnaLista({
      total: nadie.total, sustantivo: ['paciente', 'pacientes'], restricciones: [],
      registroVacio: { titulo: 'Nadie pendiente de reactivar', descripcion: '¡Buen seguimiento!' },
    })
    expect(v.variante).toBe('hero')

    // Y con gente escondida, la MISMA pantalla ya no puede felicitar.
    const hay = desgloseDeReactivacion([paciente('s', 400, { telefono: '', whatsapp: '' })], HOY, 90, 90)
    expect(hay.total).toBe(1)
    const v2 = describirVacioDeUnaLista({
      total: hay.total, sustantivo: ['paciente', 'pacientes'],
      restricciones: [{ id: 'sin-telefono', frase: '1 no tiene teléfono registrado', gesto: null }],
      registroVacio: { titulo: 'Nadie pendiente de reactivar', descripcion: '¡Buen seguimiento!' },
    })
    expect(v2.variante).toBe('linea')
    expect(v2.titulo).toContain('1 paciente')
    expect(v2.descripcion).not.toContain('Buen seguimiento')
  })

  it('10. el bloqueo ARCO sigue mordiendo, y ahora además se cuenta', () => {
    const bloqueado = paciente('arco', 400, {
      // La marca real: `estaBloqueadoArco` pregunta por `bloqueadoEn`.
      arcoBloqueo: {
        bloqueadoEn: '2026-01-01T00:00:00.000Z',
        bloqueadoPor: 'uid', solicitudId: 's1', motivo: 'lo pidió',
      } as never,
      /* `arcoBloqueo` vive en el documento y `estaBloqueadoArco` lo lee, pero el
         tipo `Patient` no lo declara — por eso `reactivacion.ts` también castea.
         Sin esta aserción el literal no compila y `npx tsc --noEmit` queda rojo
         en la rama. Declarar el campo en `Patient` es tocar el modelo de datos,
         que §1 del Master Loop V15 congela: se anota y no se toca aquí. */
    } as Partial<Patient>)
    expect(pacientesParaReactivar([bloqueado], HOY, 90).length).toBe(0)
    expect(desgloseDeReactivacion([bloqueado], HOY, 90, 90).bloqueoArco).toBe(1)
  })
})

/* ── El dato tiene que LLEGAR: las tres pantallas lo CONSUMEN ── */

const PANTALLAS = [
  ['src/app/(dashboard)/farmacia/page.tsx', 'Sin resultados con esos filtros'],
  ['src/app/(dashboard)/cumplimiento/page.tsx', ''],
  ['src/app/(dashboard)/reactivacion/page.tsx', 'días sin volver. ¡Buen seguimiento!'],
] as const

describe('RTC-30 · la decisión llega a la pantalla', () => {
  it('11. las tres LLAMAN al módulo (no basta con importarlo)', () => {
    for (const [ruta] of PANTALLAS) {
      const fuente = fs.readFileSync(ruta, 'utf8')
      // El USO, no el identificador: un `import` suelto contaría como uso y en
      // REG-315 eso dejó un caso en verde con la llamada borrada.
      expect(fuente, ruta).toMatch(/describirVacioDeUnaLista\(\s*\{/)
    }
  })

  it('12. los literales que mentían ya no los pinta ninguna pantalla', () => {
    /*
      Se miran los literales del CÓDIGO, no los de los comentarios: el
      encabezado de cada arreglo cita la frase vieja a propósito —un caso sin
      origen se borra en seis meses por parecer trivial— y contarla ahí sería
      exigir que la explicación se pierda.
    */
    const sinComentarios = (s: string) =>
      s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    for (const [ruta, literal] of PANTALLAS) {
      if (!literal) continue
      expect(sinComentarios(fs.readFileSync(ruta, 'utf8')), ruta).not.toContain(literal)
    }
    // El vacío de la bitácora ya no puede afirmar que no hay bitácora cuando
    // lo único que hay es un filtro de tipo puesto.
    const cumpl = fs.readFileSync('src/app/(dashboard)/cumplimiento/page.tsx', 'utf8')
    expect(cumpl).toMatch(/registroVacio:\s*\{/)
  })

  it('13. `/lista-espera` NO se toca: ahí el héroe es la respuesta correcta', () => {
    const fuente = fs.readFileSync('src/app/(dashboard)/lista-espera/page.tsx', 'utf8')
    // Sin buscador ni filtro no hay nada que pueda esconder filas: cero filas
    // significa cero de verdad. Si algún día aparece un filtro aquí, este caso
    // cae y obliga a mirarlo — que es justo lo que se quiere.
    expect(fuente).not.toMatch(/setSearch|categoriaFiltro|eventoFiltro/)
    expect(fuente).toContain('La lista de espera está vacía')
  })
})
