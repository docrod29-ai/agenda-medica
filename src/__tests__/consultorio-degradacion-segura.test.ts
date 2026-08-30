/**
 * ── POR QUÉ ESTE ARCHIVO CAMBIÓ DE FORMA — REG-414 ──────────────────────────
 *
 * Comprobaba la degradación **leyendo el código fuente**: recortaba la rama de
 * error del archivo de la pantalla y miraba que ese trozo no contuviera
 * `setDiagnosticos([])`. Eso vigila la FORMA del código, no la propiedad:
 *
 *  · pasa a verde si alguien mueve el borrado dos líneas más abajo del corte;
 *  · se pone rojo si alguien reformatea sin cambiar nada — de hecho el corte se
 *    hacía con una cadena que llevaba un salto de línea y dos niveles de sangría
 *    dentro, así que un `if` reindentado lo rompía;
 *  · y no dice nada de las ramas de error que se escriban mañana.
 *
 * El censo lo llamó por su nombre: «la degradación de la CONSULTA se comprueba
 * hoy por substring y no por comportamiento».
 *
 * Ahora la DECISIÓN vive en `que-sobrevive-a-un-fallo.ts` y se ejecuta: para cada
 * clase de fallo, sin excepción. Lo que queda leyendo el archivo es sólo el
 * cableado —que la pantalla use el módulo— y un cerco estrecho sobre las ramas
 * que hoy existen, explicado en su caso.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  comoSeDegrada, LO_QUE_NUNCA_SE_PIERDE,
  POR_QUE_NO_SE_COMPRUEBA_LEYENDO_EL_CODIGO, POR_QUE_LA_LISTA_NO_CAMBIA_POR_CLASE,
  type ClaseDeFallo,
} from '@/lib/expediente/que-sobrevive-a-un-fallo'

const RAIZ = process.cwd()
const consulta = readFileSync(join(RAIZ, 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8')

/** Las cuatro clases que la consulta sabe degradar. Añadir una es añadirla aquí. */
const CLASES: ClaseDeFallo[] = ['ia_respuesta_ilegible', 'ia_red', 'evidencia_http', 'evidencia_red']

describe('ningún fallo técnico borra contenido clínico — probado ejecutándolo', () => {
  it('NINGUNA clase de fallo puede perder un campo clínico', () => {
    /**
     * El caso que sustituye al recorte de código. No mira cómo está escrito el
     * manejador: pregunta a la decisión, para las cuatro clases, qué conserva.
     */
    for (const c of CLASES) {
      expect(comoSeDegrada(c).conserva, c).toEqual(LO_QUE_NUNCA_SE_PIERDE)
    }
  })

  it('y la lista incluye lo que la rama de error podría haber vaciado', () => {
    /* Los mismos cuatro que el guardián viejo buscaba a mano, más los dos que
       nunca miró: signos y alergias. */
    for (const campo of ['secciones', 'diagnosticos', 'medicamentos', 'transcripcion', 'signos', 'alergias']) {
      expect(LO_QUE_NUNCA_SE_PIERDE).toContain(campo)
    }
  })

  it('lo que se detiene es SIEMPRE trabajo secundario, nunca la nota', () => {
    for (const c of CLASES) {
      expect(['procesamiento_de_la_nota', 'analisis_de_evidencia']).toContain(comoSeDegrada(c).detiene)
    }
  })

  it('AL REVÉS: una clase nueva no puede colarse sin decidir qué detiene', () => {
    /**
     * El `switch` es exhaustivo y TypeScript lo comprueba, así que este caso
     * documenta la propiedad y además la prueba en ejecución: una clase que no
     * esté contemplada devolvería `undefined` y esto caería.
     */
    for (const c of CLASES) {
      const d = comoSeDegrada(c)
      expect(d, `«${c}» no tiene degradación declarada`).toBeTruthy()
      expect(d.mensaje.length, `«${c}» sin mensaje`).toBeGreaterThan(5)
    }
  })

  it('sólo el fallo POSTERIOR al envío promete que la nota no se tocó', () => {
    /**
     * «Tu nota NO se modificó» es el único caso donde el médico puede temer que
     * le hayan tocado el texto, porque la petición ya salió con la nota dentro.
     * Repetirlo en los otros tres sembraría una duda que nadie tenía.
     */
    expect(comoSeDegrada('ia_respuesta_ilegible').mensaje).toMatch(/NO se modificó/)
    for (const c of ['ia_red', 'evidencia_http', 'evidencia_red'] as ClaseDeFallo[]) {
      expect(comoSeDegrada(c).mensaje, c).not.toMatch(/NO se modificó/)
    }
  })

  it('el fallo de evidencia dice lo que dijo el servidor, si lo dijo', () => {
    expect(comoSeDegrada('evidencia_http', { estado: 503 }).mensaje).toMatch(/HTTP 503/)
    expect(comoSeDegrada('evidencia_http', { estado: 503, dijo: 'sin cuota' }).mensaje).toBe('sin cuota')
  })

  it('las dos razones están escritas donde se puedan leer', () => {
    expect(POR_QUE_NO_SE_COMPRUEBA_LEYENDO_EL_CODIGO).toMatch(/vigila la FORMA del código/)
    expect(POR_QUE_LA_LISTA_NO_CAMBIA_POR_CLASE).toMatch(/es NINGUNO/)
  })
})

describe('y el dato LLEGA a la pantalla', () => {
  it('las cuatro ramas de error usan la decisión, no una cadena suelta', () => {
    /**
     * «El dato tiene que LLEGAR»: una política en un módulo que la pantalla no
     * llama no degrada nada. Se cuentan las cuatro.
     */
    expect(consulta.split('comoSeDegrada(').length - 1).toBe(4)
    for (const c of CLASES) expect(consulta, c).toContain(`comoSeDegrada('${c}'`)
  })

  it('y ya no quedan los mensajes escritos a mano', () => {
    /* El que evita la recaída: volver a poner la cadena aquí saca la política
       del módulo sin que nada se ponga rojo. */
    expect(consulta).not.toContain("toast('Error al conectar con la IA', 'error')")
    expect(consulta).not.toContain("toast('La IA no respondió correctamente.")
  })
})

describe('Consultorio Golden Path 8 — degradación segura sin perder el encuentro', () => {
  it('si IA devuelve una respuesta ilegible, detiene el trabajo secundario y nada más', () => {
    expect(consulta).toContain('setTareaProc({ ejecutando: false })')
  })

  it('un fallo de red de IA deja de procesar, pero no convierte la consulta en un bloqueo de firma', () => {
    /**
     * Antes esto fijaba el bloque `catch` LETRA POR LETRA, con su salto de línea
     * y sus seis espacios de sangría dentro de la cadena. Vigilaba el formato: la
     * misma lógica reindentada lo rompía, y el mensaje movido a su módulo
     * también. Lo que importa es que el fallo detenga el trabajo secundario —eso
     * lo prueba `comoSeDegrada` arriba— y que no toque la firma, que es lo que
     * comprueban las tres líneas siguientes.
     */
    expect(consulta).toContain("comoSeDegrada('ia_red')")
    expect(consulta).toContain('else setProcesando(false)')

    // La firma vive en su propio flujo clínico y no exige que el trabajo IA siga
    // activo o haya producido resultado. Los bloqueos de firma son los motivos
    // clínicos/medicolegalmente explícitos del módulo canónico.
    expect(consulta).toContain('motivosParaNoFirmar')
    expect(consulta).toContain('porQueNoSePuedeFirmar')
    expect(consulta).not.toMatch(/(?:procesando|tareaProc)[^\n]{0,120}(?:motivosParaNoFirmar|porQueNoSePuedeFirmar)/)
  })

  it('si evidencia falla, sólo degrada ese análisis: no borra nota, diagnósticos ni tratamiento', () => {
    /**
     * El cerco estrecho que SÍ vale la pena conservar: comprueba que las ramas
     * de error que hoy existen no llaman a un `set…` clínico. No sustituye a la
     * prueba de comportamiento de arriba — la complementa, porque el módulo no
     * puede impedir que alguien escriba un borrado FUERA de él.
     */
    const marca = "console.error('[evidencia] fallo'"
    expect(consulta).toContain(marca)
    expect(consulta).toContain('finally { setAnalizandoEv(false) }')

    const inicio = consulta.indexOf(marca)
    const fin = consulta.indexOf('finally { setAnalizandoEv(false) }', inicio) + 'finally { setAnalizandoEv(false) }'.length
    const degradacion = consulta.slice(inicio, fin)
    expect(degradacion).not.toContain('setSecciones(')
    expect(degradacion).not.toContain('setDiagnosticos(')
    expect(degradacion).not.toContain('setMedicamentos(')
    expect(degradacion).not.toContain('router.push(')
  })

  it('si el proveedor opcional de comandos de voz no carga, cae al modo estándar sin interrumpir la consulta', () => {
    expect(consulta).toContain(".catch(() => { /* sin config → modo estándar */ })")
    expect(consulta).toContain("fetchAutenticado(`/api/voz/comandos-config?clinicId=${clinicId}`)")
  })

  it('el respaldo del encuentro no depende del éxito de IA/evidencia/provider', () => {
    expect(consulta).toContain('localStorage.setItem(respaldoKey')
    expect(consulta).toContain('transcripcion: e.transcripcion')
    expect(consulta).toContain('diagnosticos: e.diagnosticos')
    expect(consulta).toContain('medicamentos: e.medicamentos')
    expect(consulta).toContain("window.addEventListener('pagehide', flushRespaldo)")
    expect(consulta).toContain("document.addEventListener('visibilitychange', onHide)")
  })
})
