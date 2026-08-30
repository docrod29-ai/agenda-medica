/**
 * GOLDEN — REG-348: el respaldo se llevaba lo que ata una cuenta al
 * consultorio, y el camino de vuelta no sabía devolverlo.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * REG-343 metió en el respaldo tres colecciones que pertenecen al consultorio
 * **por un campo** y no por la ruta: `clinic_members`, `clinic_invitations` y
 * `clinic_review_requests`. El exportador las escribe con ruta de dos segmentos
 * (`clinic_members/{uid}`).
 *
 * `leerLinea` exigía que toda ruta empezara por `clinics/` y tuviera un número
 * PAR de segmentos ≥ 4. Una ruta de dos segmentos caía en «ruta con forma
 * inesperada», así que **todas** esas líneas se rechazaban al restaurar.
 *
 * Consecuencia exacta: se restaura el respaldo, vuelven pacientes, notas,
 * recetas y agenda… y **nadie que pueda entrar a verlos**. Es el mismo defecto
 * que REG-343 cerró en la ida, reaparecido en la vuelta — y con el agravante de
 * que ahora el archivo SÍ lleva el dato, así que la pérdida ocurre en el único
 * momento en que un respaldo importa.
 *
 * El simulacro (`npm run simulacro:respaldo`) tenía la otra mitad del mismo
 * agujero: corría estas líneas por el camino del árbol y las declaraba
 * «re-enraizado incorrecto», de modo que un respaldo SANO salía sucio.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Estaba escrito. La propia entrada de REG-343 lo dejó declarado en «qué no
 * cubre»: «El importador no se ha tocado… queda abierto y es la mitad que falta
 * del bucle». P1-16 del `AUSCULTA-MASTER-BOARD`.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * El camino de vuelta daba por hecho que «pertenecer a un consultorio» se
 * expresa **posicionalmente**. Es la misma confusión que REG-343 corrigió en la
 * ida —«del consultorio» ≠ «bajo la ruta del consultorio»— corregida en un solo
 * sentido. Un respaldo es un bucle: arreglar la mitad que escribe y no la que
 * lee deja el bucle abierto y con mejor aspecto.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * 1. Lo que el manifiesto sabe **llevarse**, el importador sabe **devolverlo**:
 *    las dos mitades leen `COLECCIONES_RAIZ`, así que una cuarta colección de
 *    nivel raíz no puede entrar en el respaldo sin entrar también en la vuelta.
 * 2. El re-enraizado de éstas es **de campo**, no de ruta, y se fuerza siempre
 *    al destino: quien decide el destino es quien restaura, no el archivo.
 * 3. **Restaurar no le quita nada a otro consultorio.** Su identificador es
 *    global, así que se lee el destino ANTES de escribir y un documento que ya
 *    pertenece a otro consultorio se rechaza con su razón en vez de pisarse.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · **No toca Firestore.** Demuestra que el formato, la lista blanca y el
 *   re-enraizado por campo son correctos, y que la ruta está cableada a ellos.
 *   No demuestra que el Admin SDK escriba: eso sigue esperando el ensayo de
 *   restauración de verdad, que es del dueño.
 * · **No prueba `getAll` contra la base**: comprueba que la ruta lo llama y que
 *   el veredicto puro que consume decide bien, no que Firestore responda.
 * · **Sigue sin haber respaldo de plataforma.** Las `platform_*` no entran aquí
 *   —no son del consultorio— y tampoco existen en otro sitio. Abierto.
 * · No cubre el caso de dos personas con el mismo `uid` en dos respaldos
 *   distintos restaurados a la vez: la restauración no es concurrente hoy.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  COLECCIONES_RAIZ, RAIZ_EXCLUIDAS, lineaDeDocumento,
} from '@/lib/clinica/respaldo'
import {
  leerLinea, coleccionRaizDeLaRuta, reenraizarPorCampo, admitirRaizExistente,
  POR_QUE_LA_RAIZ_SE_REAPUNTA_AL_DESTINO,
} from '@/lib/clinica/restaurar'
import { simularRestauracion, ensayoLimpio, actaDeSimulacro } from '@/lib/clinica/simulacro'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const rutaImportar = leer('src', 'app', 'api', 'clinic', 'importar', 'route.ts')

const ORIGEN = 'clinica-origen'
const DESTINO = 'clinica-destino'

/** La línea que el exportador escribe hoy para una colección de nivel raíz. */
const lineaRaiz = (coleccion: string, id: string, datos: Record<string, unknown>) =>
  JSON.stringify(lineaDeDocumento(coleccion, coleccion, id, datos))

describe('REG-348 · lo que el respaldo se lleva, la restauración sabe devolverlo', () => {
  it('EL DEFECTO: una membresía del respaldo ya no se rechaza', () => {
    /**
     * Ésta es la línea exacta que `clinic/exportar` escribe desde REG-343 y que
     * el importador rechazaba entera con «ruta con forma inesperada».
     */
    const l = leerLinea(lineaRaiz('clinic_members', 'uid-1', { clinicId: ORIGEN, role: 'medico' }))
    expect(l?.clase).toBe('documento')
    expect(l).toMatchObject({ nivel: 'raiz', coleccion: 'clinic_members', campoClinica: 'clinicId' })
  })

  it('y los metadatos del transporte no se escriben como campos', () => {
    const l = leerLinea(lineaRaiz('clinic_members', 'uid-1', { clinicId: ORIGEN, role: 'medico' }))
    const datos = (l as { datos: Record<string, unknown> }).datos
    expect(datos).not.toHaveProperty('_ruta')
    expect(datos).not.toHaveProperty('_coleccion')
    expect(datos.role).toBe('medico')
  })

  it('LAS DOS MITADES LEEN EL MISMO MANIFIESTO: todas las de raíz vuelven', () => {
    /**
     * El guardián de verdad. Si mañana entra una cuarta colección de nivel raíz
     * en `COLECCIONES_RAIZ` —el exportador se la llevará sola— y el camino de
     * vuelta no la reconoce, esto cae aquí y no el día de la restauración.
     */
    expect(COLECCIONES_RAIZ.length).toBeGreaterThanOrEqual(3)
    for (const c of COLECCIONES_RAIZ) {
      const l = leerLinea(lineaRaiz(c.ruta, 'doc-1', { [c.campoClinica]: ORIGEN }))
      expect(l, c.ruta).toMatchObject({ clase: 'documento', nivel: 'raiz', coleccion: c.ruta })
    }
  })

  it('la lista blanca es real: una colección de raíz inventada NO entra', () => {
    // Probado al revés sin tocar el manifiesto: mismo formato, nombre que nadie
    // declaró. Con el SDK admin —que se salta las reglas— esto es lo único que
    // impide que un archivo editado a mano escriba en cualquier colección.
    expect(coleccionRaizDeLaRuta('coleccion_que_nadie_declaro/x')).toBeNull()
    const l = leerLinea(lineaRaiz('coleccion_que_nadie_declaro', 'x', { clinicId: ORIGEN }))
    expect(l).toMatchObject({ clase: 'rechazada' })
    expect((l as { porQue: string }).porQue).toMatch(/no declarada en el respaldo/)
  })

  it('y una excluida a propósito se rechaza CON su motivo declarado', () => {
    // Distinguir «no se restaura a propósito» de «no se entendió» es la
    // diferencia entre una decisión y un defecto.
    const l = leerLinea(lineaRaiz('platform_planes', 'p1', { algo: 1 }))
    expect(l).toMatchObject({ clase: 'rechazada' })
    expect((l as { porQue: string }).porQue).toContain(RAIZ_EXCLUIDAS['platform_*'].slice(0, 40))
  })

  it('lo que NO es de nivel raíz sigue rechazándose como antes', () => {
    // `patients/p1` tiene dos segmentos y no es de raíz: adivinarle un destino
    // sería escribir un expediente fuera de todo consultorio.
    expect(leerLinea(JSON.stringify({ _ruta: 'patients/p1', _coleccion: 'patients' })))
      .toMatchObject({ clase: 'rechazada' })
    expect(leerLinea(JSON.stringify({ _ruta: 'clinics/X/patients', _coleccion: 'patients' })))
      .toMatchObject({ clase: 'rechazada' })
  })
})

describe('EL RE-ENRAIZADO DE ÉSTAS ES DE CAMPO, Y SE FUERZA AL DESTINO', () => {
  it('una membresía vuelve apuntando al consultorio destino, no al de origen', () => {
    /**
     * Si se dejara pasar el valor del archivo, el consultorio reconstruido
     * tendría el expediente entero y ni un solo miembro: la membresía seguiría
     * apuntando a un consultorio que puede ya no existir.
     */
    const l = leerLinea(lineaRaiz('clinic_members', 'uid-1', { clinicId: ORIGEN, role: 'medico' }))!
    const { datos, campoClinica } = l as { datos: Record<string, unknown>; campoClinica: string }
    const vuelta = reenraizarPorCampo(datos, campoClinica, DESTINO)
    expect(vuelta.clinicId).toBe(DESTINO)
    expect(vuelta.role).toBe('medico')
  })

  it('se fuerza también cuando el archivo ya traía el destino', () => {
    // El destino lo decide quien restaura, no un archivo que pudo tocar
    // cualquiera. Es la misma regla que la reescritura de la raíz.
    const vuelta = reenraizarPorCampo({ clinicId: DESTINO, role: 'admin' }, 'clinicId', DESTINO)
    expect(vuelta.clinicId).toBe(DESTINO)
  })

  it('y no muta el objeto que le pasaron', () => {
    const original = { clinicId: ORIGEN }
    reenraizarPorCampo(original, 'clinicId', DESTINO)
    expect(original.clinicId).toBe(ORIGEN)
  })

  it('está escrito por qué', () => {
    expect(POR_QUE_LA_RAIZ_SE_REAPUNTA_AL_DESTINO).toMatch(/ni un solo miembro/i)
  })
})

describe('RESTAURAR NO LE QUITA NADA A OTRO CONSULTORIO', () => {
  it('si la ruta está libre, se escribe', () => {
    expect(admitirRaizExistente(undefined, 'clinicId', DESTINO).escribir).toBe(true)
  })

  it('si ya es del destino, se sobrescribe: es su propio respaldo volviendo', () => {
    expect(admitirRaizExistente({ clinicId: DESTINO }, 'clinicId', DESTINO).escribir).toBe(true)
  })

  it('EL PELIGRO: si es de otro consultorio, NO se pisa', () => {
    /**
     * `clinic_members/{uid}` es la MISMA ruta en todos los consultorios: no hay
     * re-enraizado de ruta que los separe. Un `merge` a ciegas arrastraría al
     * consultorio que se restaura a alguien que hoy trabaja en otro, y esa
     * persona perdería el acceso al suyo sin que nadie hiciera nada mal.
     */
    const v = admitirRaizExistente({ clinicId: 'clinica-de-alguien-mas' }, 'clinicId', DESTINO)
    expect(v.escribir).toBe(false)
    expect(v.porQue).toMatch(/clinica-de-alguien-mas/)
    expect(v.porQue).toMatch(/se lo quitaría/)
  })

  it('y un documento sin dueño declarado tampoco se pisa', () => {
    // No se sabe de quién es. Pisar lo que no se sabe de quién es no es
    // restaurar: es perder algo de alguien.
    const v = admitirRaizExistente({ role: 'medico' }, 'clinicId', DESTINO)
    expect(v.escribir).toBe(false)
    expect(v.porQue).toMatch(/nadie declarado/)
  })
})

describe('LA RUTA DE IMPORTACIÓN ESTÁ CABLEADA A TODO ESTO', () => {
  it('reconoce el nivel raíz y no lo manda por el camino del árbol', () => {
    expect(rutaImportar).toContain("if (l.nivel === 'raiz')")
    expect(rutaImportar).toContain('reenraizarPorCampo(g.datos, g.campoClinica, clinicId)')
  })

  it('lee el destino ANTES de escribir, y en bloque', () => {
    // Una lectura por documento en un consultorio con miles de solicitudes de
    // reseña gasta el presupuesto de la función antes de escribir nada.
    expect(rutaImportar).toContain('admitirRaizExistente(')
    expect(rutaImportar).toContain('const LOTE_RAIZ = 200')
  })

  it('y mirar y escribir son UN acto: van dentro de una transacción (REG-349)', () => {
    /**
     * ── POR QUÉ ESTA ASERCIÓN CAMBIÓ ────────────────────────────────────────
     *
     * Aquí decía `adminDb.getAll(` a secas y que la escritura colgaba de
     * `!simular`. Las dos cosas se cumplían **y aun así se le podía quitar la
     * cuenta a otro consultorio**: la lectura suelta era una foto, y el `merge`
     * salía en un lote que se commiteaba más tarde. REG-349 lo reproduce
     * ejecutando la ruta contra una tienda con concurrencia optimista, en
     * `restaurar-no-le-quita-la-cuenta-a-otro-consultorio.test.ts`.
     *
     * Ésta se queda como comprobación **estructural** —que el camino que
     * escribe es el transaccional— y no como la prueba del comportamiento, que
     * es la de allá.
     */
    const bloque = rutaImportar.slice(
      rutaImportar.indexOf('const vaciarRaiz'),
      rutaImportar.indexOf('for (const crudo of texto.split'),
    )
    expect(bloque).toContain('adminDb.runTransaction(')
    expect(bloque).toContain('tx.getAll(')
    // La lectura transaccional va ANTES de la escritura transaccional: Firestore
    // no admite leer después de escribir dentro de una transacción.
    expect(bloque.indexOf('tx.getAll(')).toBeLessThan(bloque.indexOf('tx.set('))
  })

  it('la comprobación se hace TAMBIÉN en modo ensayo', () => {
    /**
     * Un ensayo que se salta el paso que puede fallar no ensaya nada. El ensayo
     * no necesita transacción —no escribe, no hay nada que proteger— pero sí
     * tiene que hacer la MISMA comprobación, y la hace con la misma función
     * pura que el camino real.
     */
    const bloque = rutaImportar.slice(
      rutaImportar.indexOf('const vaciarRaiz'),
      rutaImportar.indexOf('for (const crudo of texto.split'),
    )
    expect(bloque).toContain('simular\n        ? decidirRaiz(grupo, await adminDb.getAll(...refs))')
    // La MISMA función decide en los dos caminos: si se bifurcara el criterio,
    // el ensayo dejaría de predecir lo que hace la restauración de verdad.
    expect(bloque.match(/decidirRaiz\(grupo,/g)?.length).toBe(2)
  })

  it('vacía lo que quede pendiente antes del último commit', () => {
    // Un buffer que no se vacía pierde justo la última tanda, que en un archivo
    // real es donde viven estas colecciones: el exportador las escribe al final.
    expect(rutaImportar).toContain('await vaciarRaiz()\n    await vaciar()')
  })

  it('y lo que no se pudo restaurar se DICE, sin tapar el otro aviso', () => {
    expect(rutaImportar).toContain('raizDeOtroConsultorio')
    expect(rutaImportar).toContain('NO podrá entrar hasta que se le dé de alta a mano')
    expect(rutaImportar).toContain("avisos.join(' · ')")
  })
})

describe('EL SIMULACRO YA NO DA POR SUCIO UN RESPALDO SANO', () => {
  const CABECERA = JSON.stringify({ _tipo: 'cabecera', clinicId: ORIGEN })
  const PIE = JSON.stringify({ _tipo: 'pie', documentos: 2, completo: true })
  const PACIENTE = JSON.stringify(
    lineaDeDocumento(`clinics/${ORIGEN}/patients`, 'patients', 'p1', { nombre: 'Sintético' }),
  )
  const MIEMBRO = lineaRaiz('clinic_members', 'uid-1', { clinicId: ORIGEN, role: 'medico' })

  it('un respaldo con `clinic_members` sale LIMPIO', () => {
    // Antes: «re-enraizado incorrecto», ensayo sucio, salida 1 del script.
    const r = simularRestauracion([CABECERA, PACIENTE, MIEMBRO, PIE].join('\n'), DESTINO)
    expect(r.rechazadas).toEqual([])
    expect(r.restaurables).toBe(2)
    expect(ensayoLimpio(r)).toBe(true)
  })

  it('y las cuenta aparte, porque son las que deciden si alguien puede entrar', () => {
    const r = simularRestauracion([CABECERA, PACIENTE, MIEMBRO, PIE].join('\n'), DESTINO)
    expect(r.raiz).toBe(1)
    expect(r.porColeccion.clinic_members).toBe(1)
  })

  it('el acta lo dice aunque sean CERO', () => {
    // Un respaldo sin ninguna devuelve el expediente y a nadie que pueda verlo.
    // Eso tiene que leerse en el acta sin ir a buscarlo.
    const r = simularRestauracion([CABECERA, PACIENTE, PIE].join('\n'), DESTINO)
    expect(r.raiz).toBe(0)
    expect(actaDeSimulacro(r, 10, '2026-08-29T00:00:00.000Z')).toContain('De nivel raíz')
  })

  it('y declara lo que el ensayo puro NO puede comprobar de ellas', () => {
    const r = simularRestauracion([CABECERA, MIEMBRO, PIE].join('\n'), DESTINO)
    expect(actaDeSimulacro(r, 10, '2026-08-29T00:00:00.000Z'))
      .toMatch(/ya pertenece a\s+> otro consultorio/)
  })

  it('el guion del simulacro siembra una, para que el camino se recorra', () => {
    const s = leer('scripts', 'simulacro-respaldo.mjs')
    expect(s).toContain("_coleccion: 'clinic_members'")
  })
})
