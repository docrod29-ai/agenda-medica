/**
 * GOLDEN — la «A» de ARCO se ejecuta y deja acuse.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * `lib/arco.ts` declara los cinco derechos, el portal público los recibe, y el
 * panel de Cumplimiento **cuenta el plazo de 20 días hábiles** de la LFPDPPP.
 *
 * Pero la única que se ejecutaba de verdad era la Cancelación. El Acceso se
 * «resolvía» así:
 *
 *     const resolucion = prompt('Describe brevemente qué se hizo:')
 *
 * Se guardaba el texto, la solicitud pasaba a «resuelta», y **al titular no se
 * le entregaba nada**. El plazo se contaba, la alerta se pintaba, y no había qué
 * entregar cuando vencía.
 *
 * Es el mismo pecado que este repositorio ya se reprochó al construir
 * `arco/cancelar` —«la pantalla aceptaba solicitudes y las resolvía escribiendo
 * un texto libre»— y que seguía vivo para la A.
 *
 * ── Y UNA TRAMPA DEL PROPIO GUARDIÁN, EN ESTE MISMO CAMBIO ───────────────────
 *
 * Al sacar el armado del expediente a una librería compartida —para que el botón
 * del médico y la entrega ARCO no acabaran entregando cosas distintas—, la ruta
 * dejó de contener `collection('notas')` y **se volvió invisible** para el
 * detector de PHI de `authz-rutas-declaradas.test.ts`, que busca ese literal en
 * el cuerpo de la ruta.
 *
 * O sea: el refactor correcto apagaba el guardián, y lo apagaba en silencio —la
 * lista de rutas con PHI se acortaba, que parece una buena noticia—. El detector
 * ahora sigue un nivel de importación.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const ruta = leer('src', 'app', 'api', 'arco', 'acceso', 'route.ts')
const panel = leer('src', 'app', '(dashboard)', 'cumplimiento', 'page.tsx')

describe('la entrega existe y es del servidor', () => {
  it('hay una ruta para el derecho de Acceso', () => {
    expect(ruta).toContain('export async function POST')
  })

  it('arma el expediente con el MISMO manifiesto que el botón del médico', () => {
    /**
     * Si cada camino lo armara por su cuenta, en tres meses uno entregaría menos
     * que el otro y nadie sabría cuál — que es lo que ya pasó con las dos
     * implementaciones FHIR divergentes y con las cinco del cálculo de huecos.
     */
    expect(ruta).toContain("from '@/lib/expediente/exportacion-servidor'")
    expect(ruta).toContain('armarExpediente(clinicId, patientId)')
    const exportar = leer('src', 'app', 'api', 'expediente', 'exportar', '[patientId]', 'route.ts')
    expect(exportar).toContain('armarExpediente(clinicId, patientId)')
  })

  it('va bajo `administrar`, no bajo el permiso clínico', () => {
    // Entregar datos a un tercero —aunque sea su titular— es una decisión del
    // responsable del tratamiento, no un acto clínico.
    expect(ruta).toContain("verificarCapacidad(req, clinicId, 'administrar')")
  })
})

describe('sin acreditar al titular no se entrega', () => {
  it('exige `identidadVerificada`', () => {
    /**
     * El portal público pide la identificación como TEXTO LIBRE y nadie la
     * comprueba: cualquiera puede abrir una solicitud a nombre de otro. Aquí lo
     * que está en juego es entregar un expediente completo.
     */
    expect(ruta).toContain('if (body.identidadVerificada !== true)')
    expect(ruta).toContain('acreditar que quien pide es el titular')
  })

  it('y el ensayo NO entrega: sólo dice qué saldría', () => {
    // Nadie debería enterarse de qué salió del consultorio DESPUÉS de mandarlo.
    const i = ruta.indexOf('if (body.simular === true)')
    expect(i).toBeGreaterThan(0)
    // El ensayo va ANTES de la comprobación de identidad y no devuelve el
    // expediente: enseña el conteo y lo que falta.
    const bloque = ruta.slice(i, i + 260)
    expect(bloque).toContain('conteo')
    expect(bloque).not.toContain('expediente,')
  })
})

describe('el acuse: sin él no hay forma de demostrar qué se entregó', () => {
  it('se calcula el hash de lo entregado', () => {
    expect(ruta).toContain("createHash('sha256')")
    expect(ruta).toContain('paqueteHash: hash')
  })

  it('queda en la solicitud, con su formato y su fecha', () => {
    expect(ruta).toContain('paqueteFormato: expediente.formato')
    expect(ruta).toContain('entregadoEn,')
  })

  it('y en la bitácora, con quién acreditó la identidad', () => {
    expect(ruta).toContain("evento: 'arco_solicitud_resuelta'")
    expect(ruta).toContain('identidadVerificadaPor: acceso.uid')
  })

  it('la solicitud se CIERRA, para que el plazo deje de correr', () => {
    // Si no se cierra, los 20 días siguen contando sobre algo ya resuelto.
    expect(ruta).toContain("estado: 'resuelta'")
  })

  it('el modelo declara los campos del acuse', () => {
    const arco = leer('src', 'lib', 'arco.ts')
    expect(arco).toContain('paqueteHash?: string')
    expect(arco).toContain('entregadoEn?: string')
  })
})

describe('el panel ya no resuelve el Acceso escribiendo', () => {
  it('una solicitud de acceso se ejecuta, no se teclea', () => {
    expect(panel).toContain("if (req.tipo === 'acceso' && estado === 'resuelta') { await entregarAcceso(req); return }")
  })

  it('rechazarla SÍ sigue siendo un texto, y está explicado', () => {
    // Una negativa es una decisión con su fundamento, no una operación de datos.
    expect(panel).toContain('Rechazarlo sí sigue siendo un texto')
  })

  it('no se puede entregar lo que no está ligado a un expediente', () => {
    // Una solicitud anónima del portal no señala a nadie: entregar «el
    // expediente» de una solicitud sin `patientId` sería entregar el de otro.
    expect(panel).toContain('no está ligada a un expediente')
  })

  it('y enseña el acuse y lo que faltó', () => {
    expect(panel).toContain('paqueteHash')
    expect(panel).toContain('no se pudieron leer')
  })
})

describe('el detector de PHI sigue la librería', () => {
  const guardian = leer('src', '__tests__', 'authz-rutas-declaradas.test.ts')

  it('lee también lo que la ruta importa de `lib/`', () => {
    /**
     * El refactor que sacó el armado a una librería dejó a las dos rutas que
     * entregan el expediente sin `collection('notas')` en su cuerpo — y por lo
     * tanto invisibles para el guardián. Un guardián textual al que un refactor
     * correcto apaga es peor que ninguno: se apaga en silencio.
     */
    expect(guardian).toContain('function fuenteConLibrerias')
    expect(guardian).toContain('const FUENTE_CON_LIBS')
  })

  it('pero el guardián de sesión sigue mirando SÓLO el archivo de la ruta', () => {
    // Mezclarlos haría que una ruta «llame a verificarMedico» porque lo menciona
    // una librería que importa, y se darían por buenas rutas sin candado propio.
    expect(guardian).toContain('const FUENTE = new Map(ARCHIVOS.map(p => [claveDe(p), codigo(p)]))')
  })

  it('y las dos rutas del expediente vuelven a estar en la lista de PHI', () => {
    expect(guardian).toContain("'arco/acceso', 'arco/cancelar', 'expediente/exportar/[patientId]'")
  })
})
