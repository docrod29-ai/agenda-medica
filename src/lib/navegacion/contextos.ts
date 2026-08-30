/**
 * DÓNDE ESTOY — la única tabla que dice a qué contexto pertenece una ruta.
 *
 * ── EL DEFECTO QUE LA TRAJO ─────────────────────────────────────────────────
 *
 * El riel de contextos encendía «Operaciones» sólo en `/operaciones`,
 * `/configuracion` y `/guia`. Pero `/operaciones` es un ÍNDICE: su página
 * declara veinte destinos en `GRUPOS`. Al entrar en cualquiera de ellos
 * —`/citas`, `/calendario`, `/lista-espera`, `/finanzas`, `/chat`…— el riel se
 * apagaba entero: **cero ítems activos y cero `aria-current` en toda la
 * pantalla**, en escritorio y en móvil.
 *
 * Medido, no supuesto: en `/citas`, `/calendario`, `/asistente` y
 * `/lista-espera` la sonda no encontró ni un `[aria-current="page"]`. En
 * `/pacientes` y `/pendientes` sí. La agenda —la superficie que más se usa en
 * un consultorio— era justo la que no sabía contestar «¿dónde estoy?» (§15 de
 * la ley de diseño; §5 de este encargo).
 *
 * ── LA CAUSA RAÍZ, QUE NO ES «FALTABA UNA RUTA» ─────────────────────────────
 *
 * La lista de rutas de Operaciones estaba escrita DOS VECES: completa en
 * `operaciones/page.tsx` (`GRUPOS`) y recortada a tres en el riel. Dos copias
 * de la misma verdad divergen — y ésta ya había divergido en diecisiete rutas.
 * `CLAUDE.md` lo prohíbe de frente: «Nunca duplicar la fuente de verdad».
 *
 * Por eso esto no añade las rutas que faltaban: **quita la segunda copia**. El
 * riel pregunta aquí, y un guardián comprueba que todo destino declarado en
 * `GRUPOS` cae en algún contexto. Si mañana alguien añade una entrada al índice
 * y no la mapea, la prueba falla en vez de apagarse la navegación en silencio.
 *
 * ── LO QUE ESTO NO CUBRE ────────────────────────────────────────────────────
 *
 * `/corte-caja` SÍ se mapea, y no estaba en `GRUPOS`: `Sidebar.tsx` explica por
 * qué —«la ruta sigue viva por si hay marcadores», con su contenido ya
 * renderizado dentro de `/finanzas`—. Una ruta que sólo se alcanza por marcador
 * o por la paleta es justo donde más falta hace que el riel conteste «dónde
 * estoy»: quien llega ahí no viene de navegar. Medido el 30-ago: `aria-current`
 * 0 en los tres anchos. Va al contexto de `/finanzas`, que es donde vive su
 * contenido.
 *
 * `/consultor` y `/antibiograma` salieron de `GRUPOS` en RTC-09 y hoy se
 * alcanzan desde las Herramientas del expediente. No se mapean aquí a
 * propósito: decidir su contexto es una decisión de producto que este carril no
 * tiene por qué tomar, y `/consultor` lo está editando otro carril. Quedan sin
 * contexto —igual que hoy—, y el guardián no los exige porque el índice no los
 * declara.
 */

/** Los cinco contextos del riel. `null` = ruta que ningún contexto reclama. */
export type ContextoDeNavegacion = 'hoy' | 'paciente' | 'encuentro' | 'seguimiento' | 'operaciones'

/**
 * Pertenencia por SEGMENTO, no por prefijo de texto.
 *
 * `startsWith('/cita')` se traga `/citas` y también `/citaciones`, que sería
 * otra pantalla. Aquí `/citas` cubre `/citas` y `/citas/loquesea`, y nada más.
 */
function enFamilia(ruta: string, base: string): boolean {
  return ruta === base || ruta.startsWith(base + '/')
}

/**
 * El orden importa: `encuentro` se pregunta antes que `paciente` porque
 * `/consulta/<id>` es un encuentro aunque hable de un paciente.
 */
const FAMILIAS: { contexto: ContextoDeNavegacion; bases: string[] }[] = [
  {
    contexto: 'encuentro',
    bases: ['/consulta', '/nota', '/receta', '/orden', '/referencia'],
  },
  {
    // El día: la lista, la rejilla, el alta rápida y quién espera un hueco.
    // Es el grupo «Agenda» de `GRUPOS`, más el tablero.
    contexto: 'hoy',
    bases: ['/dashboard', '/citas', '/calendario', '/asistente', '/lista-espera'],
  },
  {
    contexto: 'paciente',
    bases: ['/pacientes', '/expedientes', '/expediente'],
  },
  {
    contexto: 'seguimiento',
    bases: ['/pendientes'],
  },
  {
    // Todo lo demás que el índice de Operaciones declara. Si el índice crece,
    // esta lista crece con él — y si no, el guardián lo dice.
    contexto: 'operaciones',
    bases: [
      '/operaciones', '/configuracion', '/guia',
      '/hospitalizacion', '/uci',
      '/crm', '/resenas', '/reactivacion', '/farmacia', '/finanzas', '/corte-caja', '/membresias',
      '/cumplimiento', '/legal', '/migracion',
      '/chat',
    ],
  },
]

/** A qué contexto pertenece una ruta. `null` si ninguno la reclama. */
export function contextoDeRuta(ruta: string): ContextoDeNavegacion | null {
  for (const { contexto, bases } of FAMILIAS) {
    if (bases.some(b => enFamilia(ruta, b))) return contexto
  }
  return null
}

/** Las bases declaradas de un contexto — para que el guardián pueda leerlas. */
export function basesDelContexto(contexto: ContextoDeNavegacion): string[] {
  return FAMILIAS.find(f => f.contexto === contexto)?.bases ?? []
}
