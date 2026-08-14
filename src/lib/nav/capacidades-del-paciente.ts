/**
 * CAPACIDADES DEL PACIENTE — la IA es CONTEXTUAL, no una página-módulo.
 *
 * ── DE DÓNDE SALE ESTE MÓDULO ────────────────────────────────────────────────
 *
 * RTC-09 del registro canónico del equipo rojo
 * (`docs/design/v15/V15-REDTEAM-REGISTRO-CANONICO.md`): `/operaciones` tenía un
 * grupo titulado **«Clínico»** con «Consultor IA» y «Antibiograma» dentro del
 * índice ADMINISTRATIVO — y la propia pantalla dice de sí misma «todo lo
 * administrativo del consultorio, **aparte del trabajo clínico del día**».
 *
 * Los dos paneles coincidieron en el diagnóstico: «Consultor IA» presentado
 * como destino-módulo es IA **feature-first**, la antítesis de §3.2 («AI must
 * be contextual… never a feature-first module»). El defecto no era el color ni
 * el sitio del enlace: era la PREGUNTA que la pantalla contestaba. Un módulo de
 * IA en un menú obliga al médico a (1) acordarse de que existe, (2) salir del
 * paciente, (3) volver a teclear de quién estaba hablando.
 *
 * ── QUÉ CAMBIA ───────────────────────────────────────────────────────────────
 *
 * Las dos capacidades dejan de ser destinos del índice admin y pasan a vivir
 * donde está la pregunta clínica: **en el expediente del paciente**, dentro de
 * la barra de `Herramientas` que ya existía. La consulta (`/consulta/[id]`) ya
 * las tenía así desde antes — embebía `AntibiogramaTool` y abría el consultor
 * con `?paciente=` — de modo que esto no inventa un patrón: **termina de
 * aplicar el que el encuentro ya usaba** y que el expediente no había recibido.
 *
 * ── POR QUÉ UNA SOLA DECLARACIÓN ─────────────────────────────────────────────
 *
 * Porque el guardián de alcanzabilidad (`v15-flow-rail-cableado`) tiene que
 * poder responder «¿sigue existiendo una puerta a /consultor?» LEYENDO el
 * código, no confiando en una lista escrita a mano en la prueba. Si mañana
 * alguien borra la fila del expediente, la ruta se queda huérfana y el guardián
 * lo dice. Ésta es la lección de «el dato tiene que LLEGAR» aplicada a la
 * navegación: la puerta se declara UNA vez y se mide desde el otro lado.
 *
 * ── LO QUE ESTE MÓDULO NO HACE ───────────────────────────────────────────────
 *
 * No borra las rutas `/consultor` ni `/antibiograma`: siguen existiendo, con su
 * página, y la paleta de comandos (⌘K) sigue llevando al consultor para quien
 * ya sabe lo que busca. Quitar la página sería otra decisión —del dueño— y
 * rompería el enlace que la consulta abre en pestaña nueva. Lo que cambia es
 * **desde dónde se ofrece**: del índice administrativo al paciente.
 */

export interface CapacidadDelPaciente {
  /** Id estable; es también el id de la fila en `Herramientas`. */
  id: 'consultor' | 'antibiograma'
  nombre: string
  /** Una línea de para qué sirve — el mismo contrato que `Herramienta.para`. */
  para: string
  /**
   * La ruta de la página-módulo que esta capacidad SUSTITUYE en el índice
   * administrativo. El guardián de alcanzabilidad la lee de aquí: mientras la
   * capacidad esté cableada en el expediente, esta ruta tiene puerta.
   */
  ruta: string
  /**
   * Cómo se llega LLEVANDO al paciente, o `null` cuando la capacidad se embebe
   * en el expediente y no se navega a ninguna parte.
   *
   * La distinción es real y no cosmética: el consultor razona sobre el caso y
   * por eso necesita el paciente en la URL (su página ya lee `?paciente=` desde
   * antes); el antibiograma interpreta un cultivo que el médico teclea ahí
   * mismo, así que se abre EN el expediente y no manda a nadie a otra pantalla.
   */
  conPaciente: ((patientId: string) => string) | null
}

export const CAPACIDADES_DEL_PACIENTE: readonly CapacidadDelPaciente[] = [
  {
    id: 'consultor',
    nombre: 'Consultor de evidencia',
    para: 'Pregunta clínica sobre este paciente, contestada con literatura citada',
    ruta: '/consultor',
    conPaciente: (patientId: string) => `/consultor?paciente=${encodeURIComponent(patientId)}`,
  },
  {
    id: 'antibiograma',
    nombre: 'Antibiograma',
    para: 'Interpreta el panel S/I/R: fenotipo, mecanismo y terapia dirigida',
    ruta: '/antibiograma',
    conPaciente: null,
  },
]

/** Las rutas que estas capacidades mantienen alcanzables desde el paciente. */
export const RUTAS_DE_CAPACIDADES: readonly string[] =
  CAPACIDADES_DEL_PACIENTE.map(c => c.ruta)

export const POR_QUE_CONTEXTUAL =
  'Una capacidad de IA en un menú administrativo obliga al médico a acordarse ' +
  'de que existe, salir del paciente y volver a decir de quién hablaba. En el ' +
  'expediente la capacidad ya sabe de quién se trata (§3.2).'
