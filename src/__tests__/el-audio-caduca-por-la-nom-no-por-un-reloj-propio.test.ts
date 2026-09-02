/**
 * EL AUDIO CADUCA POR LA NOM-004, NO POR UN RELOJ PROPIO — REG-511.
 *
 * QUÉ FALTABA. El dueño autorizó dos cosas en dos momentos: conservar el audio
 * de la consulta (8-ago-2026) y **borrarlo según la NOM-004** (2-sep-2026). La
 * segunda no se podía escribir, y no por falta de ganas:
 *
 *   · REG-509 — la ruta no llegaba a la nota, así que no había forma de saber de
 *     qué PACIENTE era cada archivo. Y el reloj de la norma cuenta desde el
 *     último acto médico del paciente, no desde la fecha del archivo.
 *   · REG-510 — el audio conservado vivía en el prefijo del efímero y un cron lo
 *     borraba a las 24 h. Una caducidad de cinco años sobre archivos que no
 *     llegaban al segundo día no significaba nada.
 *
 * CÓMO SE DESCUBRIÓ TODA LA CADENA. Tirando de un solo hilo: «¿de qué paciente
 * es este audio?». Las tres reparaciones salieron de esa pregunta, en ese orden.
 *
 * LA REGLA QUE LO HACE SEGURO, y es la razón de este golden: **aquí no hay
 * ningún plazo escrito**. El estado de retención lo pasa quien llama y sale de
 * `evaluarRetencion`, que cita la norma. Duplicar el número daría dos relojes
 * que un día discrepan; elegir otro —la fecha del archivo— sería inventar una
 * regla más estricta que la norma y llamarla «la norma».
 *
 * QUÉ NO CUBRE.
 * - **Es la decisión, no el barrido.** No lista el bucket, no lee notas y no
 *   borra: eso es la ruta que lo usa, y se prueba aparte.
 * - **No decide nada del expediente.** La nota, la transcripción y el sello se
 *   quedan. Sólo caduca un archivo de audio con autorización explícita.
 * - **Un audio huérfano no se borra nunca por esta vía.** Si ninguna nota lo
 *   referencia —lo que le pasa a todo el audio anterior a REG-509— este módulo
 *   dice que no sabe de quién es y se abstiene. Limpiarlos es otro problema, y
 *   uno que NO se resuelve adivinando.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { veredictoNom004, esAudioConservado } from '@/lib/expediente/audio-nom004'
import { PREFIJO_AUDIO, PREFIJO_AUDIO_CONSERVADO } from '@/lib/expediente/audio-caduco'

const RUTA = `${PREFIJO_AUDIO_CONSERVADO}uid-1/consulta-7-1756000000000.webm`
const ret = (estado: 'vigente'|'cercano'|'vencido'|'no_evaluable', dias: number | null) =>
  ({ estado, diasDesdeUltimoActo: dias })

describe('borra sólo cuando la norma dice que ya se puede', () => {
  it('expediente vencido → se borra, y la razón dice cuántos días', () => {
    const v = veredictoNom004({ ruta: RUTA, retencion: ret('vencido', 1900) })
    expect(v.borrar).toBe(true)
    expect(v.porQue).toContain('1900 días')
  })

  it('vigente → no se borra', () => {
    const v = veredictoNom004({ ruta: RUTA, retencion: ret('vigente', 30) })
    expect(v.borrar).toBe(false)
    expect(v.porQue).toMatch(/sigue vigente/)
  })

  it('cercano al límite → TAMPOCO se borra: «cerca» no es «vencido»', () => {
    // 4 años y medio. Un barrido que redondee hacia abajo se lleva PHI que la
    // norma aún obliga a conservar.
    const v = veredictoNom004({ ruta: RUTA, retencion: ret('cercano', 1643) })
    expect(v.borrar).toBe(false)
  })
})

describe('las tres negativas — un barrendero se juzga por lo que se niega a hacer', () => {
  it('sin veredicto de retención NO se borra: ausencia de dato no es dato de ausencia', () => {
    const v = veredictoNom004({ ruta: RUTA, retencion: ret('no_evaluable', null) })
    expect(v.borrar).toBe(false)
    expect(v.porQue).toMatch(/ausencia de dato no es dato de ausencia/)
  })

  it('un audio huérfano no se borra: no se sabe de quién es', () => {
    // Es TODO el audio anterior a REG-509. Adivinar aquí sería borrar PHI de un
    // expediente que quizá lleva tres años.
    const v = veredictoNom004({ ruta: RUTA, retencion: null })
    expect(v.borrar).toBe(false)
    expect(v.porQue).toMatch(/huérfano/)
  })

  it('no toca el audio de TRABAJO, que tiene su propio barrido', () => {
    const v = veredictoNom004({
      ruta: `${PREFIJO_AUDIO}uid-1/tmp-1756000000000.webm`,
      retencion: ret('vencido', 5000),
    })
    expect(v.borrar).toBe(false)
    expect(v.porQue).toContain(PREFIJO_AUDIO_CONSERVADO)
  })

  it('«vencido» sin días calculados es incoherente y NO se borra', () => {
    // `evaluarRetencion` no puede producirlo; si aparece, alguien lo construyó a
    // mano. Borrar PHI por un dato que se contradice a sí mismo, nunca.
    const v = veredictoNom004({ ruta: RUTA, retencion: ret('vencido', null) })
    expect(v.borrar).toBe(false)
    expect(v.porQue).toMatch(/incoherente/)
  })

  it('la barra final protege: `…-nota-viejo/` no entra', () => {
    expect(esAudioConservado('consultas-audio-nota-viejo/uid/x.webm')).toBe(false)
  })
})

describe('siempre da una razón, también cuando dice que no', () => {
  it('ningún veredicto sale sin explicación', () => {
    // Sin esto, «no se borró nada» es indistinguible de «el barrido no corrió».
    const casos = [
      { ruta: RUTA, retencion: ret('vencido', 1900) },
      { ruta: RUTA, retencion: ret('vigente', 10) },
      { ruta: RUTA, retencion: ret('no_evaluable', null) },
      { ruta: RUTA, retencion: null },
      { ruta: 'otra-cosa/x.webm', retencion: ret('vencido', 9999) },
    ]
    for (const c of casos) {
      expect(veredictoNom004(c).porQue.length, JSON.stringify(c)).toBeGreaterThan(15)
    }
  })
})

describe('el reloj no vive aquí, y es el invariante de este módulo', () => {
  const src = () => readFileSync(join(process.cwd(), 'src/lib/expediente/audio-nom004.ts'), 'utf8')

  it('no hay ningún número de días ni de años escrito en el módulo', () => {
    // AL REVÉS: meter un `const DIAS = 1825` aquí crea un SEGUNDO reloj que un
    // día discrepa del de `retencion.ts`, y nadie se entera hasta que borra de
    // más. El plazo tiene un solo dueño.
    const cuerpo = src().replace(/\/\*[\s\S]*?\*\//g, '')   // fuera los comentarios
    expect(cuerpo).not.toMatch(/\b(1825|365|1461|1643)\b/)
    expect(cuerpo).not.toMatch(/DIAS_[A-Z_]*\s*=/)
  })

  it('no importa el plazo de nadie: recibe el veredicto ya hecho', () => {
    expect(src()).not.toMatch(/import .*DIAS_5_ANIOS/)
  })

  it('y lo dice por escrito, para que nadie lo «arregle» duplicándolo', () => {
    expect(src()).toMatch(/numeral 5\.7/)
  })
})

describe('la ruta que lo aplica se niega por omisión', () => {
  const ruta = () => readFileSync(join(process.cwd(), 'src/app/api/cron/audio-nom004/route.ts'), 'utf8')

  it('SECA por omisión: sin ?aplicar=1 no borra un solo archivo', () => {
    // AL REVÉS: si `aplicar` naciera en true, la primera vez que alguien toca la
    // URL borra PHI de forma irreversible. Es el mismo gesto aparte que el botón
    // del backfill.
    expect(ruta()).toMatch(/const aplicar = req\.nextUrl\.searchParams\.get\('aplicar'\) === '1'/)
    expect(ruta()).toMatch(/if \(!aplicar\) continue/)
  })

  it('fail-closed: sin CRON_SECRET en producción no corre', () => {
    expect(ruta()).toMatch(/CRON_SECRET no configurado \(fail-closed\)/)
  })

  it('sin bucket DECLARA el problema en vez de responder «0 borrados»', () => {
    // «0 borrados» y «no pude mirar» se leen igual desde fuera, y sólo uno
    // significa que hay PHI esperando.
    expect(ruta()).toMatch(/no puede mirar el bucket/)
  })

  it('recorre por PACIENTE, así que un audio huérfano no se visita nunca', () => {
    expect(ruta()).toMatch(/collection\('patients'\)/)
    expect(ruta()).not.toMatch(/getFiles\(/)
  })

  it('salta al paciente cuyo último acto no se pudo fechar', () => {
    expect(ruta()).toMatch(/if \(retencion\.estado === 'no_evaluable'\) \{ sinVeredicto\+\+; continue \}/)
  })

  it('el veredicto lo toma el motor, no la ruta: aquí no hay ningún plazo', () => {
    const cuerpo = ruta().replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    expect(cuerpo).toMatch(/veredictoNom004\(/)
    expect(cuerpo).not.toMatch(/\b(1825|365|5\s*\*\s*365)\b/)
  })

  it('el acta dice el MODO, o no se sabe si borró o sólo contó', () => {
    expect(ruta()).toMatch(/modo: aplicar \? 'aplicado' : 'seco/)
  })

  it('declara si se truncó: un retraso acumulado no debe parecer vacío', () => {
    expect(ruta()).toMatch(/truncada/)
  })

  it('no registra rutas ni nombres en los logs — llevan PHI', () => {
    const logs = ruta().match(/safeLog\.[a-z]+\([^)]*\)/g) ?? []
    for (const l of logs) expect(l, l).not.toMatch(/audioPath|n\.audioPath|p\.id|ruta/)
  })
})
