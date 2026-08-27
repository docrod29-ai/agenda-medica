/**
 * LAS FAMILIAS DE DEFECTO — de qué se enferma este sistema.
 *
 * ── DE DÓNDE SALE ────────────────────────────────────────────────────────────
 *
 * `docs/audit/regression-ledger.md` tiene 67 defectos con su causa raíz. Leídos
 * de uno en uno son 67 historias. Contados por familia dicen algo que ninguno
 * dice solo: **cuál es la forma de fallar que se repite**.
 *
 * Esto no es una taxonomía tomada de un libro. Cada familia salió de agrupar
 * los defectos que este sistema realmente tuvo, y se queda o se va según lo que
 * el ledger siga diciendo.
 *
 * ── POR QUÉ ES CÓDIGO Y NO UNA TABLA EN UN MARKDOWN ──────────────────────────
 *
 * Porque una tabla escrita a mano envejece en silencio: el REG-220 aterriza, la
 * tabla sigue diciendo 67 cuando ya son 68, y nadie se entera. Aquí el guardián compara este
 * archivo contra el ledger y **falla si un REG no está clasificado** — lo que
 * obliga a clasificarlo, que es justo el momento en que uno se pregunta «¿y de
 * qué familia es éste?».
 */

export interface FamiliaDeDefecto {
  /** Clave estable; se usa en las pruebas y no debería cambiar. */
  clave: string
  /** Cómo se llama en voz alta, en la lengua en que se habla del problema. */
  nombre: string
  /** Qué tienen en común, dicho de forma que sirva para reconocer el siguiente. */
  patron: string
  /** Los REG del ledger que pertenecen a esta familia. */
  regs: readonly number[]
}

export const FAMILIAS: readonly FamiliaDeDefecto[] = [
  {
    clave: 'no_conectado',
    nombre: 'Escrito, probado y sin conectar',
    patron:
      'El módulo existe, tiene pruebas y está bien. Simplemente NO CORRE en el ' +
      'camino que el médico recorre — o corre con una entrada incompleta. Las ' +
      'pruebas del módulo pasan; el sistema falla.',
    regs: [154, 160, 164, 167, 169, 170, 182, 188, 198, 218, 221, 222, 225, 230, 232, 236, 238, 239, 244, 249, 252, 256, 257, 258, 259, 261, 262, 264, 266, 268, 288, 290, 296, 303, 309, 315, 316, 318, 320],
  },
  {
    clave: 'se_contradice',
    nombre: 'El sistema se contradice a sí mismo',
    patron:
      'Dos partes afirman cosas incompatibles y ninguna está mal por su cuenta: ' +
      'dos reglas del prompt, dos versiones del mismo dato, un metadato que ya ' +
      'no describe lo que describe. El fallo vive en el HUECO entre las dos.',
    /**
     * 321 y 322 entran aquí y no en `sin_medir` a propósito. Es cierto que
     * los destapó un instrumento nuevo —la matriz de coherencia—, pero el
     * defecto NO era la falta del instrumento: era que dos partes del producto
     * afirmaban cosas incompatibles y ninguna estaba mal por su cuenta. El
     * expediente dice que el sujeto es el paciente; la receta decía que era la
     * herramienta. El rótulo prometía «Ir a Consulta»; el destino era la lista
     * de pacientes. El fallo vivía en el hueco entre las dos, que es
     * exactamente el patrón de esta familia.
     */
    regs: [171, 179, 180, 189, 191, 194, 196, 199, 214, 217, 223, 226, 229, 234, 269, 270, 272, 273, 277, 278, 279, 285, 286, 291, 293, 298, 305, 307, 311, 312, 313, 314, 321, 322],
  },
  {
    clave: 'habla_real',
    nombre: 'El habla real no cabía en el motor',
    patron:
      'El motor lingüístico cubre el español que uno escribiría, no el que se ' +
      'habla en un consultorio mexicano. Se descubre midiendo contra frases ' +
      'reales, nunca leyendo el código.',
    regs: [158, 186, 187, 192, 200, 209, 210, 211, 212, 220, 271, 275, 276, 280, 281, 282, 284, 289],
  },
  {
    clave: 'sin_medir',
    nombre: 'Nadie lo estaba midiendo',
    patron:
      'No es un defecto del producto: es la ausencia del instrumento que lo ' +
      'habría delatado. Cada uno de éstos destapó otros al encenderse.',
    regs: [159, 166, 168, 185, 197, 213, 235, 237, 240, 245, 246, 247, 248, 254, 255, 260, 263, 265, 267, 274, 299, 306, 308],
  },
  {
    clave: 'hueco_como_dato',
    nombre: 'El hueco tratado como dato',
    patron:
      'Lo que nadie dijo se guarda como si alguien lo hubiera dicho. Es el más ' +
      'peligroso de todos porque el resultado se LEE bien: una vía, una dosis, ' +
      'una negativa, indistinguibles de un dato real.',
    /**
     * 331 es esta familia en su versión de seguridad, no de clínica: «no pude
     * comprobar si este enlace sigue vigente» se guardaba como «sigue vigente».
     * El hueco —la lectura que no respondió— se leía igual que un permiso real,
     * que es exactamente el patrón; sólo que aquí lo que sale bien formado no
     * es una dosis, es una autorización.
     */
    regs: [165, 172, 176, 177, 228, 331],
  },
  {
    clave: 'aislamiento',
    nombre: 'Fuga entre consultorios y dinero',
    patron:
      'Un dato o un cobro que cruza la frontera de su dueño. Poco frecuente y ' +
      'de consecuencia alta: aquí un solo caso es un incidente, no una molestia.',
    regs: [153, 161, 162, 163, 224],
  },
  {
    clave: 'charter_vacio',
    nombre: 'El charter existía sin encarnar',
    patron:
      'Una sección del charter que vivía como carpeta vacía. No rompe nada hoy; ' +
      'es la diferencia entre un sistema que dice tener un control y uno que lo ' +
      'tiene.',
    regs: [201, 202, 203, 204, 205, 206, 207, 208],
  },
  {
    clave: 'estorba',
    nombre: 'Estorba al médico',
    patron:
      'Correcto por dentro, insoportable por fuera: avisos que interrumpen, se ' +
      'repiten o tapan la nota. Un aviso que estorba se aprende a ignorar, y ' +
      'entonces deja de proteger.',
    regs: [178, 181, 184, 231, 233, 301, 319],
  },
  {
    clave: 'perdida',
    nombre: 'Pérdida de datos',
    patron:
      'Trabajo del médico que desaparece o reaparece solo. Es la categoría de ' +
      'la que menos se perdona: quien lo sufre una vez deja de confiar en todo ' +
      'lo demás.',
    regs: [157, 193, 195, 215, 216, 219, 283, 287, 294, 295, 297, 300, 302, 323],
  },
  {
    clave: 'tarde',
    nombre: 'Llega tarde para servir',
    patron:
      'El aviso es correcto y aparece DESPUÉS del momento en que habría servido ' +
      '— casi siempre después de firmar. Un aviso tras la firma no es una ' +
      'protección: es un registro de que no la hubo.',
    regs: [173, 190],
  },
  {
    clave: 'mensaje_miente',
    nombre: 'El mensaje mentía sobre la causa',
    patron:
      'Falla algo y el sistema culpa a otra cosa. Cuesta doble: la avería y las ' +
      'horas persiguiendo la avería equivocada.',
    regs: [155, 156, 251, 317],
  },
  {
    clave: 'decision_del_dueno',
    nombre: 'Decisión del médico dueño, no defecto',
    patron:
      'Están en el ledger porque cambiaron el comportamiento, pero no había ' +
      'nada roto: lo decidió el médico responsable. Se cuentan aparte para no ' +
      'inflar la cuenta de defectos con decisiones.',
    regs: [174, 175, 292],
  },
  {
    /**
     * Familia NUEVA, abierta el 8-ago-2026 con REG-241.
     *
     * Se abre porque ninguna de las trece anteriores la describía. No es que el
     * sistema mienta sobre la causa (`mensaje_miente`) ni que falte el
     * instrumento (`sin_medir`): el dato correcto EXISTE en el repositorio y el
     * registro que lo copia se queda atrás porque copiarlo depende de que
     * alguien se acuerde.
     */
    clave: 'depende_de_recordar',
    nombre: 'Depende de que alguien se acuerde',
    patron:
      'Hay un dato que ya vive en el repositorio y un segundo sitio que lo ' +
      'repite a mano. El segundo se desfasa —siempre—, y como tiene forma de ' +
      'registro oficial se le cree más que a la fuente. La reparación nunca es ' +
      'volver a copiarlo bien: es DERIVARLO, y poner una compuerta que falle ' +
      'cuando se separen.',
    regs: [241, 253, 310],
  },
  {
    /**
     * Familia abierta el 8-ago-2026 con REG-242, y va a crecer.
     *
     * No es un defecto: no había nada roto. Es una función que el mercado da
     * por supuesta y que aquí **nunca existió**, y por eso ninguna prueba, ni
     * ninguna auditoría interna, podía delatarla — sólo se ve comparando.
     *
     * Se cuenta aparte a propósito. Mezclarla con los defectos haría creer que
     * el sistema falla más de lo que falla, y haría perder de vista que estos
     * se encuentran con OTRO instrumento: mirar afuera, no mirar el código.
     */
    clave: 'hueco_frente_al_mercado',
    nombre: 'El mercado lo tiene y aquí nunca existió',
    patron:
      'Función que los productos de referencia dan por supuesta y que aquí no ' +
      'estaba. Ninguna prueba interna puede delatarla: no hay nada roto que ' +
      'medir. Se encuentra comparando con casos idénticos, no leyendo el ' +
      'código.',
    regs: [242, 243, 250, 304],
  },
  {
    clave: 'falta_un_eje',
    nombre: 'Al modelo de datos le faltaba un eje',
    patron:
      'El dato se guardaba entero y correcto, pero sin la distinción que lo hace ' +
      'utilizable. No se arregla con una validación: se arregla añadiendo la ' +
      'pregunta que faltaba.',
    regs: [183, 227],
  },
] as const

/** Todos los REG clasificados, sin repetir. */
export function regsClasificados(): number[] {
  return FAMILIAS.flatMap(f => f.regs).sort((a, b) => a - b)
}

/** ¿Algún REG está en dos familias? Un defecto tiene UNA causa raíz. */
export function regsDuplicados(): number[] {
  const vistos = new Set<number>()
  const dobles = new Set<number>()
  for (const f of FAMILIAS) {
    for (const r of f.regs) {
      if (vistos.has(r)) dobles.add(r)
      vistos.add(r)
    }
  }
  return [...dobles].sort((a, b) => a - b)
}

/** Las familias ordenadas por tamaño: la primera es de la que más se enferma. */
export function porTamano(): FamiliaDeDefecto[] {
  return [...FAMILIAS].sort((a, b) => b.regs.length - a.regs.length || a.clave.localeCompare(b.clave))
}

/**
 * Lo que el conteo dice y no dice.
 *
 * DICE: cuál es la forma de fallar que más se repite en lo que YA se encontró.
 *
 * NO DICE: cuál es la más frecuente en el sistema. Sólo se cuentan los defectos
 * ENCONTRADOS, y encontrar depende de dónde se miró. Una familia pequeña puede
 * serlo porque es rara o porque nadie la busca — y las dos se ven igual desde
 * aquí. La de «aislamiento» es la sospechosa obvia: cuatro casos, todos hallados
 * al auditar a propósito, ninguno en uso normal.
 */
export const LO_QUE_EL_CONTEO_NO_DICE =
  'Sólo se cuentan los defectos ENCONTRADOS. Una familia pequeña puede serlo ' +
  'porque es rara o porque nadie la busca, y las dos se ven igual desde aquí.'
