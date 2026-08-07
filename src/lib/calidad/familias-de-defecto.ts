/**
 * LAS FAMILIAS DE DEFECTO — de qué se enferma este sistema.
 *
 * ── DE DÓNDE SALE ────────────────────────────────────────────────────────────
 *
 * `docs/audit/regression-ledger.md` tiene 54 defectos con su causa raíz. Leídos
 * de uno en uno son 54 historias. Contados por familia dicen algo que ninguno
 * dice solo: **cuál es la forma de fallar que se repite**.
 *
 * Esto no es una taxonomía tomada de un libro. Cada familia salió de agrupar
 * los defectos que este sistema realmente tuvo, y se queda o se va según lo que
 * el ledger siga diciendo.
 *
 * ── POR QUÉ ES CÓDIGO Y NO UNA TABLA EN UN MARKDOWN ──────────────────────────
 *
 * Porque una tabla escrita a mano envejece en silencio: el REG-207 aterriza, la
 * tabla sigue diciendo 54 cuando ya son 55, y nadie se entera. Aquí el guardián compara este
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
    regs: [154, 160, 164, 167, 169, 170, 182, 188, 198],
  },
  {
    clave: 'se_contradice',
    nombre: 'El sistema se contradice a sí mismo',
    patron:
      'Dos partes afirman cosas incompatibles y ninguna está mal por su cuenta: ' +
      'dos reglas del prompt, dos versiones del mismo dato, un metadato que ya ' +
      'no describe lo que describe. El fallo vive en el HUECO entre las dos.',
    regs: [171, 179, 180, 189, 191, 194, 196, 199],
  },
  {
    clave: 'habla_real',
    nombre: 'El habla real no cabía en el motor',
    patron:
      'El motor lingüístico cubre el español que uno escribiría, no el que se ' +
      'habla en un consultorio mexicano. Se descubre midiendo contra frases ' +
      'reales, nunca leyendo el código.',
    regs: [158, 186, 187, 192, 200],
  },
  {
    clave: 'sin_medir',
    nombre: 'Nadie lo estaba midiendo',
    patron:
      'No es un defecto del producto: es la ausencia del instrumento que lo ' +
      'habría delatado. Cada uno de éstos destapó otros al encenderse.',
    regs: [159, 166, 168, 185, 197],
  },
  {
    clave: 'hueco_como_dato',
    nombre: 'El hueco tratado como dato',
    patron:
      'Lo que nadie dijo se guarda como si alguien lo hubiera dicho. Es el más ' +
      'peligroso de todos porque el resultado se LEE bien: una vía, una dosis, ' +
      'una negativa, indistinguibles de un dato real.',
    regs: [165, 172, 176, 177],
  },
  {
    clave: 'aislamiento',
    nombre: 'Fuga entre consultorios y dinero',
    patron:
      'Un dato o un cobro que cruza la frontera de su dueño. Poco frecuente y ' +
      'de consecuencia alta: aquí un solo caso es un incidente, no una molestia.',
    regs: [153, 161, 162, 163],
  },
  {
    clave: 'charter_vacio',
    nombre: 'El charter existía sin encarnar',
    patron:
      'Una sección del charter que vivía como carpeta vacía. No rompe nada hoy; ' +
      'es la diferencia entre un sistema que dice tener un control y uno que lo ' +
      'tiene.',
    regs: [201, 202, 203, 204, 205, 206],
  },
  {
    clave: 'estorba',
    nombre: 'Estorba al médico',
    patron:
      'Correcto por dentro, insoportable por fuera: avisos que interrumpen, se ' +
      'repiten o tapan la nota. Un aviso que estorba se aprende a ignorar, y ' +
      'entonces deja de proteger.',
    regs: [178, 181, 184],
  },
  {
    clave: 'perdida',
    nombre: 'Pérdida de datos',
    patron:
      'Trabajo del médico que desaparece o reaparece solo. Es la categoría de ' +
      'la que menos se perdona: quien lo sufre una vez deja de confiar en todo ' +
      'lo demás.',
    regs: [157, 193, 195],
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
    regs: [155, 156],
  },
  {
    clave: 'decision_del_dueno',
    nombre: 'Decisión del médico dueño, no defecto',
    patron:
      'Están en el ledger porque cambiaron el comportamiento, pero no había ' +
      'nada roto: lo decidió el médico responsable. Se cuentan aparte para no ' +
      'inflar la cuenta de defectos con decisiones.',
    regs: [174, 175],
  },
  {
    clave: 'falta_un_eje',
    nombre: 'Al modelo de datos le faltaba un eje',
    patron:
      'El dato se guardaba entero y correcto, pero sin la distinción que lo hace ' +
      'utilizable. No se arregla con una validación: se arregla añadiendo la ' +
      'pregunta que faltaba.',
    regs: [183],
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
