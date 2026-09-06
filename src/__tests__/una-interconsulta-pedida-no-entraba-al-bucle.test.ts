/**
 * GOLDEN — UNA INTERCONSULTA PEDIDA Y NO CONTESTADA ERA INVISIBLE.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Una interconsulta vivía SÓLO dentro de `Internamiento.interconsultas`: un
 * array embebido en el documento del episodio. El motor del ciclo cerrado lee
 * otra cosa — `tareasVivas`, `cabosDelPaciente` y `estadoDeAccion` trabajan
 * sobre la colección `tareas_clinicas`.
 *
 * Consecuencia: pedir una interconsulta a cardiología y que nadie contestara
 * NUNCA aparecía en ningún worklist, ni en los cabos sueltos del paciente, ni en
 * nada que reclamara. La única forma de enterarse era abrir esa pestaña de ese
 * episodio y acordarse de mirar — que es exactamente lo que no ocurre en una
 * guardia.
 *
 * Es la misma fuga que REG-252 cerró para los resultados de laboratorio, con la
 * misma forma: la entidad existe, el motor existe, y nadie los une.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * El censo lo tenía diagnosticado desde la sesión de REG-515, con el plan
 * escrito y el trabajo REVERTIDO a propósito: se había construido el modelo
 * (`origenId`, el tipo nuevo) sin poder conectarlo, y dejar algo escrito y sin
 * conectar es lo que REG-406 enseñó a no hacer.
 *
 * Lo que desbloqueó el paso fue mirar por qué no se podía conectar. El motivo
 * era que el id lo acuñaba el servidor dentro de la transacción y no salía de
 * ella —`agregarInterconsulta` devolvía cadena vacía—, así que no había forma de
 * saber a qué interconsulta colgarle la tarea. Acuñar el id del lado del que
 * pide, con la puerta de idempotencia que este árbol ya usa, lo resuelve.
 *
 * ── EL DEFECTO DE PROPINA, QUE YA ESTABA ────────────────────────────────────
 *
 * Con el id del servidor, un reintento —doble clic, o una red que se corta
 * DESPUÉS de escribir— acuñaba un id nuevo y dejaba la interconsulta duplicada
 * en el episodio. Nada lo impedía. Con el id en la mano del que pide, el
 * servidor reconoce el reintento.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * La tarea se crea en la LIBRERÍA, no en la pantalla: `agregarInterconsulta` es
 * la única puerta por la que se pide una, y si la creación viviera arriba la
 * segunda pantalla que alguien escriba nacería con la fuga. Es la lección de
 * REG-252 dicha otra vez.
 *
 * Y contestar la deja `completada`, NO `cerrada`. El censo pedía cerrarla y el
 * modelo no lo permite, con razón: `completada` es que el trabajo se hizo,
 * `cerrada` es que alguien LO MIRÓ y decidió. El cardiólogo contesta; si el que
 * la pidió no lee la respuesta, no ha pasado nada por mucho que el episodio diga
 * «respondida». Cerrarla, con la decisión escrita, es del que la pidió.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · NO fija el PLAZO tras el cual una interconsulta sin contestar está vencida.
 *   Depende de especialidad, urgencia y acuerdo del hospital: es criterio
 *   clínico y no está decidido. Por eso la tarea nace SIN `venceEn` y
 *   `estaVencida` no opina. Inventar «48 h» metería en rojo pendientes que quizá
 *   no lo están, y un grupo «Vencidos» que miente deja de leerse.
 * · NO decide su grupo del worklist. Cae en `otros` («Otros pendientes») porque
 *   `esperando_resultado` la etiquetaría mal —se espera a un colega, no a una
 *   máquina— y una categoría nueva es la clase de modelo sin información que
 *   REG-404 evitó. `otros` es honesto y consigue lo que importaba: que se vea.
 * · NO toca REFERENCIA ni IMAGEN. La referencia sigue siendo sólo un impreso y
 *   la imagen no tiene entidad propia (modalidad, lateralidad, informe). El
 *   ORDEN de imagen ya entraba, porque `estudio_pendiente` cubre gabinete.
 * · NO prueba contra Firestore. Prueba la derivación de identidad, la forma de
 *   la tarea, la idempotencia del servidor y el recorrido de estados; que el
 *   documento quede escrito es la otra frontera («el dato tiene que LLEGAR») y
 *   se mira en navegador.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { tareaDeInterconsulta } from '@/lib/tareas-clinicas/derivar'
import { idDeTareaDeOrigen, idDerivado } from '@/lib/tareas-clinicas/firestore'
import { estadoDeAccion } from '@/lib/tareas-clinicas/estado-de-accion'
import { puedeTransicionar, estaVencida, ETIQUETA_TIPO } from '@/lib/tareas-clinicas/modelo'
import { idIdempotente, claveDeIntento, esIdDeUnSoloSegmento } from '@/lib/idempotencia'

const RUTA = readFileSync('src/app/api/hospital/mutar/route.ts', 'utf8')
const HOSPITAL = readFileSync('src/lib/hospital/firestore.ts', 'utf8')
const PANTALLA = readFileSync('src/app/(dashboard)/hospitalizacion/[internamientoId]/page.tsx', 'utf8')

const AHORA = Date.parse('2026-08-30T10:00:00.000Z')
const tarea = (icId = 'interconsulta__' + 'a'.repeat(32)) => tareaDeInterconsulta({
  clinicId: 'c1', patientId: 'p1', patientNombre: 'Paciente Sintético',
  interconsultaId: icId, especialidad: 'Cardiología', motivo: 'Dolor torácico atípico',
  ahoraMs: AHORA,
})

describe('la interconsulta entra al motor del bucle', () => {
  it('produce una tarea clínica con paciente, que es lo que el motor lee', () => {
    const t = tarea()
    expect(t.tipo).toBe('interconsulta_pendiente')
    expect(t.patientId).toBe('p1')
    expect(t.estado).toBe('solicitada')
    expect(t.titulo).toBe('Interconsulta a Cardiología')
    expect(t.detalle).toBe('Dolor torácico atípico')
  })

  it('el tipo tiene etiqueta: sin ella la pantalla la pintaría sin nombre', () => {
    expect(ETIQUETA_TIPO.interconsulta_pendiente).toBe('Interconsulta')
  })

  it('SIN `venceEn`, y por eso `estaVencida` no opina', () => {
    /* El plazo es criterio clínico y no está decidido. Esto es la prueba de que
       no se inventó uno: si alguien le pone un número, esto se pone rojo. */
    expect(tarea().venceEn).toBeUndefined()
    expect(estaVencida(tarea(), AHORA + 365 * 86_400_000)).toBe(false)
  })

  it('cae en «Otros pendientes» — se ve, aunque su cajón no esté decidido', () => {
    /* Lo que NO puede pasar es que desaparezca. `esperando_resultado` sería
       mentir: se espera a un colega, no a una máquina. */
    const grupo = estadoDeAccion(tarea(), AHORA)
    expect(grupo).toBe('otros')
    expect(grupo).not.toBe('esperando_resultado')
  })

  it('sin médico concreto nace sin dueño, que es lo que la hace reclamable', () => {
    expect(tarea().ownerUid).toBeUndefined()
    const dirigida = tareaDeInterconsulta({
      clinicId: 'c1', patientId: 'p1', interconsultaId: 'x', especialidad: 'Cardiología',
      ahoraMs: AHORA, ownerUid: 'u9', ownerNombre: 'Dra. Sintética',
    })
    expect(dirigida.ownerUid).toBe('u9')
  })
})

describe('la identidad de la tarea se puede reconstruir', () => {
  it('el mismo hecho da la misma tarea: pedirla dos veces no son dos', () => {
    const a = idDeTareaDeOrigen('hospital', 'ic-1')
    expect(idDeTareaDeOrigen('hospital', 'ic-1')).toBe(a)
    expect(idDeTareaDeOrigen('hospital', 'ic-2')).not.toBe(a)
  })

  it('quien contesta la encuentra con el id que tiene en la mano', () => {
    /**
     * EL PUNTO ENTERO, y la aserción que este caso tenía mal escrita.
     *
     * La primera versión comprobaba `idDeTareaDeOrigen` a solas, así que seguía
     * verde con el defecto puesto: comprobaba UN extremo, no que los dos
     * coincidan. Lo que importa es que el id con el que la tarea se ESCRIBE
     * (`idDerivado`, que es lo que usa `crearTareas`) sea el mismo que
     * reconstruye quien responde con el `icId` en la mano.
     *
     * Si el id llevara el título dentro —como el de una nota— haría falta
     * conocer la especialidad para reconstruirlo, y quien contesta no la tiene.
     * La tarea seguiría creándose y NADIE volvería a encontrarla: contestar no
     * cerraría nada, en silencio.
     */
    const t = tarea('ic-7')
    expect(idDerivado(t)).toBe(idDeTareaDeOrigen(t.origen, t.origenId!))
    expect(idDerivado(t)).toBe('hospital-ic-7')
  })

  it('y una nota SIGUE llevando el título: una nota da muchas tareas', () => {
    /* La otra mitad de la regla. Sin el título, tres estudios pedidos en la
       misma consulta colapsarían en un solo documento. */
    const deNota = { ...tarea(), notaId: 'n1', origenId: undefined }
    expect(idDerivado(deNota)).toBe('n1__interconsulta-pendiente-interconsulta-a-cardiologia')
  })

  it('dos clases de hecho con el mismo id no chocan', () => {
    expect(idDeTareaDeOrigen('hospital', 'x')).not.toBe(idDeTareaDeOrigen('laboratorio', 'x'))
  })

  it('nada que llegue puede convertir el id en una RUTA', () => {
    /* Un `/` en el id lo volvería otra colección, u otro consultorio. */
    expect(idDeTareaDeOrigen('hospital', '../../otra-clinica/x')).not.toContain('/')
    expect(idDeTareaDeOrigen('hospital', 'a/b')).toBe('hospital-a-b')
  })

  it('`origenId` NO es `notaId`: quien lee una nota no encuentra una que no existe', () => {
    /* Meter el id de la interconsulta en `notaId` era lo barato y lo peor. */
    expect(tarea().notaId).toBeUndefined()
    expect(tarea().origen).toBe('hospital')
  })
})

describe('el id que se acuña, y el reintento que ya no duplica', () => {
  it('tiene forma cerrada y validable', () => {
    const id = idIdempotente('c1', 'interconsulta', claveDeIntento())
    expect(id).toMatch(/^interconsulta__[0-9a-f]{32}$/)
    expect(esIdDeUnSoloSegmento(id)).toBe(true)
  })

  it('el servidor VALIDA lo que llega y no escribe lo que no encaje', () => {
    expect(RUTA).toContain("typeof p.id === 'string' && esIdDeUnSoloSegmento(p.id) ? p.id : randomUUID()")
  })

  it('el servidor reconoce el reintento en vez de añadir otra interconsulta', () => {
    expect(RUTA).toMatch(/if \(arr\('interconsultas'\)\.some\(x => \(x as Any\)\.id === id\)\) return \{\}/)
  })

  it('la librería acuña el id por la puerta del árbol, no con `crypto` a pelo', () => {
    /* `crypto.randomUUID` LANZA fuera de un contexto seguro, y esto corre en
       tabletas de hospital. `claveDeIntento` trae su respaldo. */
    expect(HOSPITAL).toContain("idIdempotente(clinicId, 'interconsulta', claveDeIntento())")
  })
})

describe('contestar es completar, no cerrar', () => {
  it('el modelo PROHÍBE el atajo, y por eso se recorren dos pasos', () => {
    expect(puedeTransicionar('solicitada', 'cerrada').permitido).toBe(false)
    expect(puedeTransicionar('solicitada', 'completada').permitido).toBe(false)
    expect(puedeTransicionar('solicitada', 'aceptada').permitido).toBe(true)
    expect(puedeTransicionar('aceptada', 'completada').permitido).toBe(true)
  })

  it('cerrar sigue exigiendo que alguien lo mire y diga qué decidió', () => {
    /* Si esto dejara de ser cierto, «respondida» pasaría por «revisada» y el
       bucle se cerraría sin que nadie leyera la respuesta del colega. */
    expect(puedeTransicionar('completada', 'cerrada').permitido).toBe(true)
  })

  it('la librería recorre los dos pasos y falla del lado seguro', () => {
    expect(HOSPITAL).toContain("cambiarEstado(clinicId, actual, 'aceptada')")
    expect(HOSPITAL).toContain("cambiarEstado(clinicId, actual, 'completada')")
    /* Nunca salta a cerrada por su cuenta. */
    expect(HOSPITAL).not.toContain("cambiarEstado(clinicId, actual, 'cerrada')")
  })

  it('contestar dos veces no la marca como fallida', () => {
    expect(HOSPITAL).toMatch(/estado === 'completada' \|\| tarea\.estado === 'cerrada'\) return \{ estado: 'movida'/)
  })
})

describe('lo que no se abrió, no se calla', () => {
  it('la tarea se crea en la LIBRERÍA, que es la única puerta', () => {
    /* Si se creara en la pantalla, la siguiente pantalla nacería con la fuga.
       Es la lección de REG-252, y esto la fija. */
    expect(HOSPITAL).toContain('tareaDeInterconsulta({')
    expect(PANTALLA).not.toContain('tareaDeInterconsulta')
  })

  it('la pantalla avisa si la interconsulta quedó fuera del worklist', () => {
    expect(PANTALLA).toContain('abierta.tareasCreadas < abierta.tareasEsperadas')
  })

  it('«no había tarea» no se confunde con «no se pudo»', () => {
    /* Una interconsulta anterior a esto nunca tuvo tarea. Tratarla como error
       haría saltar el aviso siempre, y un aviso que sale siempre no se lee. */
    expect(HOSPITAL).toContain("estado: 'sin_tarea'")
    expect(PANTALLA).toContain("trabajada.estado === 'no_se_pudo'")
  })
})
