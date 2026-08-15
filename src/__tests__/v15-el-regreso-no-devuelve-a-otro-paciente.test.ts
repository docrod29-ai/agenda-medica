/**
 * EL CONTRATO DE REGRESO — §21, y la invariante que lo hace seguro.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * §21 pide la cadena entera: «fact → inspect → source → **return exactly where
 * you were**». Los tres primeros tramos existían. El cuarto no: la traza hacia
 * la consulta de origen era un `<Link href>` y nada más, o sea **navegación
 * normal**. Al aterrizar en la consulta el médico se quedaba sin hilo de
 * vuelta — sin ruta de origen, sin su sitio en la lista, sin foco y sin memoria
 * de qué hecho estaba inspeccionando.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * La re-auditoría independiente `V15-ORIGINALITY-INDEPENDENT-REAUDIT-002`
 * (SHA 01a1086) lo declaró P1 bloqueante con esas palabras: «the outbound
 * transition to the consultation is effectively normal navigation». No lo
 * encontró ninguna prueba de este repositorio, y eso es parte del hallazgo:
 * había pruebas de que la traza EXISTÍA y ninguna de que sirviera para volver.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Nadie era dueño del estado de vuelta. `continuidad.ts` coreografía UNA
 * navegación y su estado muere con la transición; `encuentro-abierto.ts`
 * responde otra pregunta y vive en `localStorage` durante días. Salir a la
 * fuente no anotaba nada, así que volver era imposible por construcción.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * **Un contrato rancio o de otro paciente NUNCA devuelve al médico a un
 * contexto que no es el suyo.** El veredicto compara el contrato contra el
 * destino REAL —el consultorio de la sesión, el paciente de la ruta, la nota
 * del parámetro—, nunca contra lo que el propio contrato afirma: un contrato
 * que se valida con sus propios datos siempre dice que sí.
 *
 * Las tres fronteras se comprueban por SEPARADO. Comparar sólo el paciente
 * dejaría pasar un testigo de otra nota del mismo paciente, y el médico
 * volvería a la lista creyendo que venía de un encuentro en el que nunca
 * estuvo.
 *
 * Y en la URL viaja **sólo un testigo opaco**: el cuerpo del contrato vive en
 * el almacén de la pestaña. Un enlace de consulta acaba pegado en un chat.
 *
 * Probado al revés (cada reversión se aplicó y se comprobó que muerde):
 *  · comparar sólo el paciente y no la nota → caso 4;
 *  · quitar la caducidad → caso 5;
 *  · devolver `puedeVolver` sin comparar nada → casos 3-6;
 *  · aceptar un contrato a medio escribir → caso 8;
 *  · meter el paciente en la URL en vez del testigo → caso 9;
 *  · dejar que el restaurador reponga en cualquier ruta → caso 12.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No cubre el render.** Esta suite corre en `node` y sin testing-library:
 *   que el foco vuelva de verdad, que el desplazamiento se reponga y que el
 *   control aparezca sólo cuando toca se miden en navegador real
 *   (`scripts/design/medir-regreso-a-la-fuente-v15.mjs`).
 * · **No cubre más consumidores que el pendiente.** La traza sale hoy de
 *   `TareaClinica.notaId`; expedientes y resultados quedan declarados y sin
 *   hilo de vuelta.
 * · No juzga si la fuente que se abre es clínicamente suficiente: sólo que se
 *   vuelve exactamente de donde se salió, o no se vuelve.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  MOTIVO_VISIBLE, PARAM_REGRESO, VIGENCIA_MS, deserializar, rutaConRegreso,
  veredictoDeRegreso, type ContratoDeRegreso, type DestinoReal,
} from '@/lib/ui/regreso-a-la-fuente'

const leer = (r: string) => readFileSync(join(process.cwd(), r), 'utf8')
const sinComentarios = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const AHORA = Date.parse('2026-08-15T10:00:00.000Z')

const contrato = (extra: Partial<ContratoDeRegreso> = {}): ContratoDeRegreso => ({
  id: 'testigo-1',
  creadoEnMs: AHORA - 60_000,
  origen: { ruta: '/pendientes', scrollTop: 640, disparadorId: 'porque-t1', nombre: 'Pendientes' },
  hecho: { clase: 'pendiente', id: 't1' },
  limite: { clinicId: 'c1', patientId: 'pac-luz', notaId: 'nota-1' },
  ...extra,
})

const destino: DestinoReal = { clinicId: 'c1', patientId: 'pac-luz', notaId: 'nota-1' }

describe('el hilo de vuelta se honra sólo cuando cuadra', () => {
  it('1 · con todo igual, se puede volver — y devuelve el contrato entero', () => {
    const v = veredictoDeRegreso(contrato(), destino, AHORA)
    expect(v.puedeVolver).toBe(true)
    expect(v.puedeVolver && v.contrato.origen.ruta).toBe('/pendientes')
    expect(v.puedeVolver && v.contrato.origen.scrollTop).toBe(640)
  })

  it('2 · sin contrato no hay veredicto positivo, y ese caso NO se anuncia', () => {
    const v = veredictoDeRegreso(null, destino, AHORA)
    expect(v.puedeVolver).toBe(false)
    expect(v.puedeVolver === false && v.motivo).toBe('sin-contrato')
    // Quien llegó a la consulta por su cuenta no pidió volver: decirle que no
    // se puede sería ruido. Los otros tres SÍ hablan (casos 3-5).
    expect(MOTIVO_VISIBLE['sin-contrato']).toBeNull()
  })

  it('3 · OTRO PACIENTE no restaura, y lo dice', () => {
    const v = veredictoDeRegreso(contrato(), { ...destino, patientId: 'pac-aurelio' }, AHORA)
    expect(v.puedeVolver).toBe(false)
    expect(v.puedeVolver === false && v.motivo).toBe('otro-paciente')
    expect(MOTIVO_VISIBLE['otro-paciente']).toMatch(/otro paciente/i)
  })

  it('4 · OTRO ENCUENTRO del MISMO paciente tampoco restaura', () => {
    /*
      El caso que mata la reversión «comparar sólo el paciente». Mismo enfermo,
      otra consulta: si esto pasara, el médico volvería a la lista creyendo que
      venía de un encuentro en el que nunca estuvo, y la traza —que existe para
      responder «¿de dónde salió esto?»— estaría mintiendo sobre su propio
      origen.
    */
    const v = veredictoDeRegreso(contrato(), { ...destino, notaId: 'nota-9' }, AHORA)
    expect(v.puedeVolver).toBe(false)
    expect(v.puedeVolver === false && v.motivo).toBe('otro-encuentro')
  })

  it('5 · OTRO CONSULTORIO no restaura — el aislamiento no depende de la pantalla', () => {
    const v = veredictoDeRegreso(contrato(), { ...destino, clinicId: 'c2' }, AHORA)
    expect(v.puedeVolver).toBe(false)
    expect(v.puedeVolver === false && v.motivo).toBe('otro-consultorio')
  })

  it('6 · un contrato RANCIO caduca, y justo en su límite', () => {
    const justoDentro = veredictoDeRegreso(
      contrato({ creadoEnMs: AHORA - VIGENCIA_MS }), destino, AHORA)
    expect(justoDentro.puedeVolver).toBe(true)

    const pasado = veredictoDeRegreso(
      contrato({ creadoEnMs: AHORA - VIGENCIA_MS - 1 }), destino, AHORA)
    expect(pasado.puedeVolver).toBe(false)
    expect(pasado.puedeVolver === false && pasado.motivo).toBe('caducado')

    // Una fecha ilegible es rancia, no válida: no se completa con supuestos.
    const rota = veredictoDeRegreso(contrato({ creadoEnMs: NaN }), destino, AHORA)
    expect(rota.puedeVolver === false && rota.motivo).toBe('caducado')
  })

  it('7 · las tres fronteras se comprueban por separado, no como una sola', () => {
    // Si alguien las fundiera en una comparación, estos tres darían el MISMO
    // motivo y el médico no sabría qué se declinó.
    const motivos = [
      veredictoDeRegreso(contrato(), { ...destino, clinicId: 'x' }, AHORA),
      veredictoDeRegreso(contrato(), { ...destino, patientId: 'x' }, AHORA),
      veredictoDeRegreso(contrato(), { ...destino, notaId: 'x' }, AHORA),
    ].map(v => (v.puedeVolver === false ? v.motivo : 'PASO'))
    expect(new Set(motivos).size).toBe(3)
    expect(motivos).not.toContain('PASO')
  })

  it('8 · un contrato a medio escribir se descarta entero', () => {
    expect(deserializar(null)).toBeNull()
    expect(deserializar('no soy json')).toBeNull()
    expect(deserializar(JSON.stringify({ id: 'x' }))).toBeNull()               // sin límite
    expect(deserializar(JSON.stringify({ id: 'x', limite: { patientId: 'p' } }))).toBeNull() // sin origen
    expect(deserializar(JSON.stringify(contrato()))?.id).toBe('testigo-1')
  })
})

describe('en la URL viaja un testigo, no el paciente', () => {
  it('9 · la ruta lleva SÓLO el testigo, y respeta el ?nota= que ya venía', () => {
    const url = rutaConRegreso('/consulta/pac-luz?nota=nota-1', 'testigo-1')
    expect(url).toBe(`/consulta/pac-luz?nota=nota-1&${PARAM_REGRESO}=testigo-1`)
    // Sin consulta previa el separador es `?`, no un segundo `&`.
    expect(rutaConRegreso('/x', 'tk')).toBe(`/x?${PARAM_REGRESO}=tk`)
    // Y lo que NO puede aparecer nunca: el sitio de la lista ni el foco.
    expect(url).not.toMatch(/scrollTop|disparador|640|Pendientes/)
  })

  it('10 · el cuerpo del contrato vive en la PESTAÑA, no en el enlace', () => {
    const src = sinComentarios(leer('src/lib/ui/regreso-a-la-fuente.ts'))
    expect(src).toMatch(/sessionStorage/)
    // localStorage sobreviviría al cierre de la pestaña y convertiría un hilo
    // de vuelta de hace tres días en una invitación a volver a otro sitio.
    expect(src).not.toMatch(/localStorage/)
  })
})

describe('el regreso es de un solo uso y no se pinta en cualquier ruta', () => {
  it('11 · salir de la lente FIRMA el contrato en vez de navegar a secas', () => {
    const src = sinComentarios(leer('src/components/tareas/PorQueEstaAqui.tsx'))
    // La traza era un <Link href> — navegación normal, que es el hallazgo.
    expect(src).toMatch(/guardarContrato\(\{/)
    expect(src).toMatch(/rutaConRegreso\(traza\.href, id\)/)
    // Y anota las tres fronteras y el sitio exacto, no sólo el destino.
    expect(src).toMatch(/limite: \{ clinicId[^}]*patientId[^}]*notaId/)
    /*
      EL SITIO SE ANOTA AL ABRIR, NO AL SALIR — y esto lo encontró el navegador.
      En el teléfono la lente es una hoja EN FLUJO: al abrirse, `<main>` cede
      alto y su `scrollTop` se mueve. Leerlo al pulsar la traza guardaba una
      coordenada del layout encogido para reponerla sobre el normal (41px de
      desfase en móvil, 0 en escritorio). Si alguien vuelve a leerlo aquí en vez
      de usar el valor capturado en el gesto de abrir, este caso muerde.
    */
    expect(src).toMatch(/scrollTop: scrollAlAbrir\?\.current/)
    expect(sinComentarios(leer('src/components/tareas/PorQueEstaAqui.tsx')))
      .toMatch(/scrollAlAbrir\.current = document\.querySelector\('main'\)\?\.scrollTop/)
  })

  it('12 · el restaurador sólo repone en la ruta que el contrato nombra', () => {
    const src = sinComentarios(leer('src/components/lente/VolverALaFuente.tsx'))
    expect(src).toMatch(/if \(pathname !== contrato\.origen\.ruta\) return/)
    // Un solo uso: sin esto, volver a entrar a la pantalla movería el
    // desplazamiento bajo el dedo del médico sin que nadie lo pidiera.
    expect(src).toMatch(/olvidarContrato\(contrato\.id\)/)
    // Y la espera tiene tope: esperar sin tope es colgarse.
    expect(src).toMatch(/intentos >= TOPE/)
  })

  it('13 · el disparador tiene id ESTABLE — sin él no hay a quién devolver el foco', () => {
    const src = sinComentarios(leer('src/components/tareas/PorQueEstaAqui.tsx'))
    expect(src).toMatch(/export function idDelDisparador/)
    expect(src).toMatch(/id=\{idDelDisparador\(tarea\.id\)\}/)
    // Tras cambiar de ruta el nodo original ya no existe: lo único que
    // sobrevive es el nombre, y por eso se busca por `getElementById`.
    expect(sinComentarios(leer('src/components/lente/VolverALaFuente.tsx')))
      .toMatch(/getElementById\(contrato\.origen\.disparadorId\)/)
  })

  it('14 · la consulta compara contra LO QUE ELLA ES, no contra el contrato', () => {
    const src = sinComentarios(leer('src/app/(dashboard)/consulta/[patientId]/page.tsx'))
    expect(src).toMatch(/<VolverALaFuente destino=\{\{/)
    // `notaIdParam` y no el `notaId` de estado: el estado cambia si la pantalla
    // crea una nota nueva, y la comparación dejaría de hablar del encuentro por
    // el que se entró.
    expect(src).toMatch(/notaId: notaIdParam \?\? ''/)
  })
})
