/**
 * GOLDEN — las doce escrituras clínicas del árbol, con nombre propio.
 *
 * ── QUÉ CIERRA ──────────────────────────────────────────────────────────────
 *
 * Las cuatro que REG-412 y REG-413 dejaron nombradas y sin cerrar, todas del
 * carril de Hospital y UCI:
 *
 *  · **signos vitales**, alta y corrección — de estos documentos salen NEWS2 y
 *    las tendencias. Dos tomas idénticas a la misma hora inclinan una escala de
 *    gravedad y disparan —o callan— una alerta de deterioro. No es una molestia
 *    de inventario: es una cifra clínica movida por un fallo de red.
 *  · **solicitud de laboratorio** — un duplicado se le TOMA DOS VECES al
 *    paciente: dos punciones, dos tubos y dos resultados que reconciliar.
 *  · **observación de UCI** — alimenta escalas y tendencias, igual que los signos.
 *
 * Con esto el trinquete de escrituras sin clave de intención llega a **cero**.
 *
 * ── TRES SITIOS, TRES FORMAS DE ACUÑAR LA CLAVE ─────────────────────────────
 *
 * No hay una receta única, y forzarla habría dejado protecciones decorativas:
 *
 *  1. **Signos y laboratorio** — hay un modal. La clave nace al ABRIRLO. Acuñarla
 *     al pulsar Guardar haría que cada reintento trajera una nueva: el defecto
 *     entero con más pasos y con aspecto de resuelto.
 *  2. **Observación de UCI** — no hay modal ni reintento automático: el fallo
 *     guarda en local y avisa. No existe un «momento anterior» del que colgar la
 *     intención, así que la identidad sale de la TOMA: su instante medido.
 *  3. (Y en REG-413, **las fotos** — la identidad sale del archivo, porque el
 *     usuario vuelve a elegir el mismo y para la interfaz es un intento nuevo.)
 *
 * ── QUÉ PROTEGE DE VERDAD LA DE UCI, Y QUÉ NO ───────────────────────────────
 *
 * Protege el caso caro —commit hecho, respuesta perdida, el aviso dice «no se
 * pudo enviar» siendo mentira— y cualquier reenvío futuro de las lecturas
 * locales, que queda idempotente por construcción.
 *
 * No protege dos pulsaciones separadas por segundos: son dos instantes y por
 * tanto dos tomas. Colapsarlas exigiría comparar valores, y **dos tomas iguales
 * seguidas SON posibles en una UCI**.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **Un cero no es «no puede volver a pasar»**: es «la próxima vez se ve». Una
 *   escritura clínica nueva sube el número el mismo día.
 * · **El inventario es estático.** Ver una clave en la función no prueba que el
 *   llamador la pase — por eso este archivo comprueba los llamadores uno a uno.
 * · **No deduplica entre dispositivos.** Dos personas registrando signos a la vez
 *   son dos intenciones y dos tomas, que es lo correcto.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { idIdempotente } from '@/lib/idempotencia'
import { recuento, sinIntencion } from '../../scripts/idempotencia/escrituras-sin-intencion.mjs'

const HOSP_LIB = readFileSync('src/lib/hospital/firestore.ts', 'utf8')
const UCI_LIB = readFileSync('src/lib/uci/observaciones.ts', 'utf8')
const HOSP_UI = readFileSync('src/app/(dashboard)/hospitalizacion/[internamientoId]/page.tsx', 'utf8')
const UCI_UI = readFileSync('src/app/(dashboard)/uci/page.tsx', 'utf8')

describe('no queda ninguna escritura clínica con nombre aleatorio', () => {
  it('el trinquete está en cero', () => {
    expect(sinIntencion().map((x: { archivo: string }) => x.archivo)).toEqual([])
  })

  it('y sigue viendo las doce: el cero no es una lista vacía', () => {
    /**
     * El caso que impide el falso cero. Si el inventario dejara de reconocer las
     * escrituras, `sinIntencion` daría cero por no mirar — indistinguible de cero
     * por estar bien.
     */
    expect(recuento().clinicas).toBe(12)
    expect(recuento().sinClasificar).toBe(0)
  })
})

describe('signos vitales: la cifra que mueve una escala', () => {
  it('el alta acepta la clave y NO pisa lo que ya está', () => {
    /**
     * No se pisa porque la toma anterior lleva su hora, que es el dato que la
     * ordena en la tendencia. Reescribirla movería el punto de la gráfica.
     */
    expect(HOSP_LIB).toMatch(/idIdempotente\(clinicId, 'signos', claveDeIntento\)/)
    expect(HOSP_LIB).toMatch(/if \(!\(await getDoc\(ref\)\)\.exists\(\)\) await setDoc\(ref, datos\)/)
  })

  it('la CORRECCIÓN también, que es la que se olvida', () => {
    /**
     * Una corrección duplicada deja DOS enmiendas del mismo original, y una
     * enmienda es un acto medicolegal. `corregirSignos` es un llamador distinto
     * de `agregarSignos` — arreglar sólo uno es como se pierden las reparaciones
     * en este árbol (REG-410, REG-411).
     */
    const i = HOSP_LIB.indexOf('export async function corregirSignos')
    expect(HOSP_LIB.slice(i, i + 1200)).toMatch(/idIdempotente\(clinicId, 'signos'/)
  })

  it('sin clave se comporta como antes, a propósito', () => {
    /* Quedarse sin registrar unos signos es peor que registrarlos dos veces. */
    expect(HOSP_LIB).toMatch(/if \(!claveDeIntento\) \{ await addDoc\(signosCol\(clinicId, iid\), datos\); return \}/)
  })

  it('la pantalla la acuña al ABRIR el modal, en los dos caminos', () => {
    /**
     * Dos: el botón «Registrar signos» y el de corregir una toma existente. Si
     * uno no la acuñara, ese camino quedaría sin protección y el otro daría la
     * sensación de que está resuelto.
     */
    expect(HOSP_UI.split('setClaveSignos(claveDeIntento())').length - 1).toBe(2)
    expect(HOSP_UI).toMatch(/agregarSignos\(clinicId, internamientoId, datos, claveSignos\)/)
    expect(HOSP_UI).toMatch(/\}, claveSignos\)/)
  })
})

describe('laboratorio: un duplicado son dos punciones', () => {
  it('acepta la clave y no pisa una solicitud que ya puede tener resultado', () => {
    const i = HOSP_LIB.indexOf('export async function crearSolicitudLab')
    const cuerpo = HOSP_LIB.slice(i, i + 900)
    expect(cuerpo).toMatch(/idIdempotente\(clinicId, 'laboratorio', claveDeIntento\)/)
    expect(cuerpo).toMatch(/if \(!\(await getDoc\(ref\)\)\.exists\(\)\)/)
  })

  it('y la pantalla se la pasa desde el modal', () => {
    expect(HOSP_UI).toMatch(/setClaveLab\(claveDeIntento\(\)\)/)
    expect(HOSP_UI).toMatch(/\}, claveLab\)/)
  })

  it('reutiliza el ámbito «laboratorio» que ya existía', () => {
    /* La lista de ámbitos es cerrada: inventar `lab-hospital` habría partido en
       dos la identidad de lo mismo. */
    expect(idIdempotente('c1', 'laboratorio', 'k')).toMatch(/^laboratorio__[0-9a-f]{32}$/)
  })
})

describe('UCI: sin modal, la identidad sale de la toma', () => {
  it('la clave es el instante MEDIDO, no un intento', () => {
    /**
     * Aquí no hay un «momento anterior» del que colgar la intención: no hay modal
     * que abrir y el fallo no reintenta, guarda en local y avisa. Una clave
     * acuñada dentro del manejador sería nueva en cada pulsación — protección
     * decorativa.
     */
    expect(UCI_UI).toMatch(/\}, iso\)/)
    expect(UCI_LIB).toMatch(/idIdempotente\(clinicId, 'observacion', claveDeIntento\)/)
  })

  it('y dice qué protege y qué no, en el sitio donde se lee', () => {
    /* Una protección cuyo alcance no está escrito se lee como total. */
    const i = UCI_UI.indexOf('REG-419')
    const nota = UCI_UI.slice(i, i + 900)
    expect(nota).toMatch(/QUÉ PROTEGE/)
    expect(nota).toMatch(/QUÉ NO/)
    expect(nota).toMatch(/dos tomas iguales seguidas SON posibles/i)
  })

  it('no pisa: `registradoEnServidor` es el sello de cuándo llegó de verdad', () => {
    expect(UCI_LIB).toMatch(/if \(!\(await getDoc\(ref\)\)\.exists\(\)\) await setDoc\(ref, datos\)/)
  })
})

describe('los ámbitos nuevos están declarados, no son texto libre', () => {
  it('«signos» y «observacion» derivan ids con la forma sellada', () => {
    expect(idIdempotente('c1', 'signos', 'k')).toMatch(/^signos__[0-9a-f]{32}$/)
    expect(idIdempotente('c1', 'observacion', 'k')).toMatch(/^observacion__[0-9a-f]{32}$/)
  })

  it('y el consultorio va dentro: una clave prestada no aterriza en otro', () => {
    expect(idIdempotente('c1', 'signos', 'k')).not.toBe(idIdempotente('c2', 'signos', 'k'))
  })
})
