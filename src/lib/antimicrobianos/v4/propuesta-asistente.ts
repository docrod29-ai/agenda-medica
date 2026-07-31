/**
 * PROPUESTA DE TOPES — la parte que el dataset no traía en forma legible.
 *
 * ── QUÉ ES ESTE ARCHIVO Y POR QUÉ ESTÁ SEPARADO ──────────────────────────────
 *
 * `propuestos.ts` transcribe cifras que YA ESTÁN escritas en el dataset
 * verificado. Este archivo es otra cosa: son las que **no estaban en forma
 * legible** y se proponen desde el etiquetado adulto estándar y las guías de uso
 * corriente.
 *
 * Van en un archivo aparte, con su propio origen y su propio color en pantalla,
 * porque **no tienen el mismo respaldo**. Mezclarlas con las transcritas haría
 * que las dos parecieran igual de firmes, y no lo son. La separación es el punto
 * de este archivo, no un detalle de organización.
 *
 * ── LO QUE NO SE HACE AQUÍ ───────────────────────────────────────────────────
 *
 * **No se cita una tabla, una página ni un PMID.** Se nombra la familia de la
 * fuente («etiquetado adulto estándar», «IDSA 2026 AMR») porque eso es lo que se
 * puede afirmar sin tener el documento delante. Una cita inventada es peor que
 * ninguna: da por comprobado lo que nadie comprobó, y es exactamente lo que el
 * propio dataset prohíbe al advertir que no se afirme validación con Sanford sin
 * una integración licenciada.
 *
 * **No se propone un número cuando un número sería falso.** Los que se dosifican
 * por kilo, los que se guían por concentración y los que se etiquetan en
 * unidades distintas (colistina, polimixina B, penicilina G) NO llevan cifra:
 * llevan escrito por qué no la llevan. Poner un mg fijo a una amikacina sería
 * inventar el peso del paciente.
 *
 * Nada de esto entra en el motor hasta que alguien lo confirma en pantalla.
 */

import type { TipoMaximo } from '@/lib/antimicrobianos/v4/tipos'

export interface PropuestaAsistente {
  farmaco: string
  /** `'*'` = cualquier indicación. */
  indicacion: string
  usualMaxPorDosis?: number
  usualMaxPorDia?: number
  contextualMaxPorDosis?: number
  contextualMaxPorDia?: number
  absolutoMaxPorDia?: number
  unidad: string
  tipoMaximo: TipoMaximo
  /** Familia de la fuente. Nunca una tabla o un PMID inventados. */
  fuente: string
  /** El razonamiento en una línea: de dónde sale la aritmética. */
  razon: string
}

/**
 * Adulto, función renal conservada, vía intravenosa salvo que se diga.
 *
 * Todas las cifras están en mg salvo donde se indique. El «habitual» es la pauta
 * corriente; el «contextual» es la pauta alta de indicaciones que la piden
 * (SNC, neutropenia febril, infección por microorganismo resistente); el
 * «absoluto» sólo se pone cuando el etiquetado declara un techo.
 */
export const PROPUESTAS: readonly PropuestaAsistente[] = [
  // ── Carbapenémicos ──────────────────────────────────────────────────────
  { farmaco: 'Meropenem', indicacion: '*',
    usualMaxPorDosis: 1000, usualMaxPorDia: 3000,
    contextualMaxPorDosis: 2000, contextualMaxPorDia: 6000, absolutoMaxPorDia: 6000,
    unidad: 'mg', tipoMaximo: 'CONTEXTUAL',
    fuente: 'Etiquetado adulto estándar + IDSA 2026 AMR',
    razon: '1 g q8h habitual (3 g/día); 2 g q8h en SNC y en gramnegativo resistente (6 g/día), que es también el techo del etiquetado.' },
  { farmaco: 'Imipenem-cilastatin', indicacion: '*',
    usualMaxPorDosis: 500, usualMaxPorDia: 2000,
    contextualMaxPorDosis: 1000, contextualMaxPorDia: 4000, absolutoMaxPorDia: 4000,
    unidad: 'mg', tipoMaximo: 'CONTEXTUAL',
    fuente: 'Etiquetado adulto estándar',
    razon: '500 mg q6h habitual (2 g/día); hasta 1 g q6h (4 g/día) en infección grave, que es el techo etiquetado.' },
  { farmaco: 'Ertapenem', indicacion: '*',
    usualMaxPorDosis: 1000, usualMaxPorDia: 1000, absolutoMaxPorDia: 1000,
    unidad: 'mg', tipoMaximo: 'EXPLICIT',
    fuente: 'Etiquetado adulto estándar',
    razon: 'Dosis única diaria de 1 g; el etiquetado no contempla escalar.' },

  // ── Cefalosporinas ──────────────────────────────────────────────────────
  { farmaco: 'Cefepime', indicacion: '*',
    usualMaxPorDosis: 2000, usualMaxPorDia: 4000,
    contextualMaxPorDosis: 2000, contextualMaxPorDia: 6000, absolutoMaxPorDia: 6000,
    unidad: 'mg', tipoMaximo: 'CONTEXTUAL',
    fuente: 'Etiquetado adulto estándar',
    razon: '2 g q12h habitual (4 g/día); 2 g q8h en neutropenia febril y pseudomonas (6 g/día), techo del etiquetado.' },
  /**
   * MENINGITIS tiene su propia entrada, y por eso existe todo este motor.
   *
   * Con sólo el tope general, 2 g cada 12 h —la pauta de libro en el SNC— salía
   * como «por encima de lo habitual» cada vez. Verificado en pantalla el
   * 31-jul. Una alerta que salta en lo que se hace siempre enseña a ignorarla, y
   * el día que la alerta tenga razón tampoco se va a leer.
   *
   * Las cifras salen del propio dataset: «Meningitis commonly uses 2 g q12h» y
   * «max 4 g/day», que son 4 000 mg y coinciden.
   */
  { farmaco: 'Ceftriaxone', indicacion: 'meningitis',
    usualMaxPorDosis: 2000, usualMaxPorDia: 4000, absolutoMaxPorDia: 4000,
    unidad: 'mg', tipoMaximo: 'CONTEXTUAL',
    fuente: 'Dataset V3: «Meningitis commonly uses 2 g q12h» + «max 4 g/day»',
    razon: '2 g cada 12 h son 4 g/día, que es exactamente el máximo escrito. Es la pauta habitual EN ESTA indicación, no una dosis alta.' },
  { farmaco: 'Cefepime', indicacion: 'neutropenia febril',
    usualMaxPorDosis: 2000, usualMaxPorDia: 6000, absolutoMaxPorDia: 6000,
    unidad: 'mg', tipoMaximo: 'CONTEXTUAL',
    fuente: 'Etiquetado adulto estándar',
    razon: '2 g cada 8 h son 6 g/día: la pauta de la indicación, no una excepción. Sin esta entrada saltaría un aviso en cada neutropénico.' },
  { farmaco: 'Meropenem', indicacion: 'meningitis',
    usualMaxPorDosis: 2000, usualMaxPorDia: 6000, absolutoMaxPorDia: 6000,
    unidad: 'mg', tipoMaximo: 'CONTEXTUAL',
    fuente: 'Etiquetado adulto estándar + IDSA 2026 AMR',
    razon: '2 g cada 8 h son 6 g/día, que es la pauta del SNC y a la vez el techo del etiquetado.' },
  { farmaco: 'Ceftolozane-tazobactam', indicacion: 'neumonía nosocomial',
    usualMaxPorDosis: 3000, usualMaxPorDia: 9000, absolutoMaxPorDia: 9000,
    unidad: 'mg', tipoMaximo: 'CONTEXTUAL',
    fuente: 'Etiquetado adulto estándar',
    razon: '3 g cada 8 h en HABP/VABP: el DOBLE que en vía urinaria. Sin esta entrada, cada neumonía nosocomial daría aviso.' },
  { farmaco: 'Ceftriaxone', indicacion: '*',
    usualMaxPorDosis: 2000, usualMaxPorDia: 2000,
    contextualMaxPorDosis: 2000, contextualMaxPorDia: 4000, absolutoMaxPorDia: 4000,
    unidad: 'mg', tipoMaximo: 'CONTEXTUAL',
    fuente: 'Etiquetado adulto estándar (el propio dataset dice «max 4 g/day»)',
    razon: '1-2 g q24h habitual; en SNC 2 g q12h son 4 g/día, que coincide con el máximo escrito. El contextual es lo que evita que la meningitis salte una alarma.' },
  { farmaco: 'Ceftazidime', indicacion: '*',
    usualMaxPorDosis: 2000, usualMaxPorDia: 6000, absolutoMaxPorDia: 6000,
    unidad: 'mg', tipoMaximo: 'EXPLICIT',
    fuente: 'Etiquetado adulto estándar',
    razon: '2 g q8h en infección grave (6 g/día), que es el techo etiquetado.' },
  { farmaco: 'Cefazolin', indicacion: '*',
    usualMaxPorDosis: 2000, usualMaxPorDia: 6000,
    contextualMaxPorDia: 12000, absolutoMaxPorDia: 12000,
    unidad: 'mg', tipoMaximo: 'CONTEXTUAL',
    fuente: 'Etiquetado adulto estándar (el dataset dice «up to 12 g/day»)',
    razon: '1-2 g q8h habitual; hasta 12 g/día en infección que amenaza la vida, tal como lo escribe el dataset.' },
  { farmaco: 'Ceftobiprole medocaril', indicacion: '*',
    usualMaxPorDosis: 500, usualMaxPorDia: 1500, absolutoMaxPorDia: 1500,
    unidad: 'mg', tipoMaximo: 'EXPLICIT',
    fuente: 'Etiquetado adulto estándar',
    razon: '500 mg q8h en infusión de 2 h (1.5 g/día). El etiquetado no contempla escalar por encima de esa pauta en el adulto con función renal conservada.' },

  // ── Penicilinas y combinaciones ─────────────────────────────────────────
  { farmaco: 'Piperacillin-tazobactam', indicacion: '*',
    usualMaxPorDosis: 4500, usualMaxPorDia: 18000, absolutoMaxPorDia: 18000,
    unidad: 'mg', tipoMaximo: 'EXPLICIT',
    fuente: 'Etiquetado adulto estándar',
    razon: '4.5 g q6h (18 g/día) es la pauta alta habitual y el techo. La infusión extendida 4.5 g q8h en 4 h da menos total con mejor fT>MIC: no sube el tope.' },
  { farmaco: 'Ampicillin-sulbactam', indicacion: '*',
    usualMaxPorDosis: 3000, usualMaxPorDia: 12000, absolutoMaxPorDia: 12000,
    unidad: 'mg', tipoMaximo: 'EXPLICIT',
    fuente: 'Etiquetado adulto estándar',
    razon: '3 g q6h (12 g/día). OJO: la pauta de sulbactam alto para Acinetobacter resistente es OTRA cosa y necesita su propia entrada por indicación.' },
  { farmaco: 'Nafcillin', indicacion: '*',
    usualMaxPorDosis: 2000, usualMaxPorDia: 12000, absolutoMaxPorDia: 12000,
    unidad: 'mg', tipoMaximo: 'EXPLICIT',
    fuente: 'Etiquetado adulto estándar',
    razon: '2 g q4h (12 g/día) en infección grave por S. aureus sensible a meticilina.' },
  { farmaco: 'Aztreonam', indicacion: '*',
    usualMaxPorDosis: 2000, usualMaxPorDia: 6000,
    contextualMaxPorDia: 8000, absolutoMaxPorDia: 8000,
    unidad: 'mg', tipoMaximo: 'CONTEXTUAL',
    fuente: 'Etiquetado adulto estándar',
    razon: '2 g q8h habitual (6 g/día); techo etiquetado 8 g/día.' },
  { farmaco: 'Aztreonam-avibactam', indicacion: '*',
    usualMaxPorDosis: 2000, usualMaxPorDia: 8000, absolutoMaxPorDia: 8000,
    unidad: 'mg', tipoMaximo: 'EXPLICIT',
    fuente: 'Etiquetado (el dataset describe carga 2.67 g y luego 2 g q6h)',
    razon: 'Mantenimiento 2 g q6h = 8 g/día. La CARGA se da una vez y no entra en el total diario.' },

  // ── Betalactámico + inhibidor de nueva generación ───────────────────────
  { farmaco: 'Ceftazidime-avibactam', indicacion: '*',
    usualMaxPorDosis: 2500, usualMaxPorDia: 7500, absolutoMaxPorDia: 7500,
    unidad: 'mg', tipoMaximo: 'EXPLICIT',
    fuente: 'Etiquetado adulto estándar + IDSA 2026 AMR',
    razon: '2.5 g q8h. Ficha y guía coinciden en la dosis y difieren en la DURACIÓN DE INFUSIÓN (2 h contra 3 h), que no cambia el tope.' },
  { farmaco: 'Ceftolozane-tazobactam', indicacion: '*',
    usualMaxPorDosis: 1500, usualMaxPorDia: 4500,
    contextualMaxPorDosis: 3000, contextualMaxPorDia: 9000, absolutoMaxPorDia: 9000,
    unidad: 'mg', tipoMaximo: 'CONTEXTUAL',
    fuente: 'Etiquetado adulto estándar',
    razon: '1.5 g q8h en vía urinaria e intraabdominal; 3 g q8h en neumonía nosocomial. Sin el contextual, cada neumonía saltaría una alarma.' },

  // ── Otros ───────────────────────────────────────────────────────────────
  { farmaco: 'Levofloxacin', indicacion: '*',
    usualMaxPorDosis: 750, usualMaxPorDia: 750, absolutoMaxPorDia: 750,
    unidad: 'mg', tipoMaximo: 'EXPLICIT',
    fuente: 'Etiquetado adulto estándar',
    razon: '750 mg cada 24 h es la dosis alta habitual y el techo diario.' },
  { farmaco: 'Metronidazole', indicacion: '*',
    usualMaxPorDosis: 500, usualMaxPorDia: 1500,
    absolutoMaxPorDia: 4000, unidad: 'mg', tipoMaximo: 'CONTEXTUAL',
    fuente: 'Etiquetado adulto estándar',
    razon: '500 mg q8h habitual (1.5 g/día); el etiquetado admite hasta 4 g/día como techo.' },
  { farmaco: 'Doxycycline', indicacion: '*',
    usualMaxPorDosis: 100, usualMaxPorDia: 200,
    contextualMaxPorDosis: 200, contextualMaxPorDia: 400,
    unidad: 'mg', tipoMaximo: 'CONTEXTUAL',
    fuente: 'Etiquetado adulto estándar',
    razon: '100 mg q12h habitual; 200 mg q12h en indicaciones que lo piden.' },
  { farmaco: 'Minocycline', indicacion: '*',
    usualMaxPorDosis: 200, usualMaxPorDia: 400, absolutoMaxPorDia: 400,
    unidad: 'mg', tipoMaximo: 'EXPLICIT',
    fuente: 'IDSA 2026 AMR (pauta alta para gramnegativo resistente)',
    razon: '200 mg q12h es la pauta alta que recoge el propio dataset.' },
  { farmaco: 'Tigecycline', indicacion: '*',
    usualMaxPorDosis: 50, usualMaxPorDia: 100,
    contextualMaxPorDosis: 100, contextualMaxPorDia: 200,
    unidad: 'mg', tipoMaximo: 'CONTEXTUAL',
    fuente: 'Etiquetado adulto estándar + IDSA 2026 AMR (pauta alta)',
    razon: 'Mantenimiento 50 mg q12h; pauta alta 100 mg q12h. La CARGA (100 o 200 mg) se da una vez y no entra en el total diario.' },
  { farmaco: 'Nitrofurantoin', indicacion: '*',
    usualMaxPorDosis: 100, usualMaxPorDia: 200, absolutoMaxPorDia: 400,
    unidad: 'mg', tipoMaximo: 'CONTEXTUAL',
    fuente: 'Etiquetado adulto estándar',
    razon: 'Presentación de liberación modificada 100 mg q12h; la de liberación inmediata es 50-100 mg q6h. **Las formulaciones NO son intercambiables** y merecen entradas separadas.' },
  { farmaco: 'Fosfomycin tromethamine PO', indicacion: '*',
    usualMaxPorDosis: 3000, usualMaxPorDia: 3000, absolutoMaxPorDia: 3000,
    unidad: 'mg', tipoMaximo: 'EXPLICIT',
    fuente: 'Etiquetado adulto estándar',
    razon: 'Sobre único de 3 g en cistitis no complicada.' },
]

/* ════════════════════════════════════════════════════════════════════════
   Los que NO llevan cifra, y por qué
   ════════════════════════════════════════════════════════════════════════ */

/**
 * Poner un número aquí sería inventarlo, no proponerlo.
 *
 * No es cautela: es que la cifra **depende de un dato del paciente** que el
 * motor no tiene, o de una unidad que primero hay que declarar. Un mg fijo en
 * una amikacina es inventarle el peso al enfermo.
 */
export const SIN_CIFRA: readonly { farmaco: string; porQue: string }[] = [
  { farmaco: 'Amikacin', porQue: 'Se dosifica por kilo y se ajusta por concentraciones (TDM). Un tope en mg depende del peso: hay que cargarlo como mg/kg, no como mg.' },
  { farmaco: 'Gentamicin', porQue: 'Por kilo y guiada por concentraciones. El dataset sí escribe «hasta 5 mg/kg/día en infección que amenaza la vida»: ése es el tope, en mg/kg.' },
  { farmaco: 'Tobramycin', porQue: 'Igual que gentamicina: por kilo, con «hasta 5 mg/kg/día» escrito en el dataset.' },
  { farmaco: 'Plazomicin', porQue: 'Por kilo (15 mg/kg/día) y con TDM. El tope es por kilo.' },
  { farmaco: 'Daptomycin', porQue: 'Por kilo. Y aquí está el caso que motivó todo el motor: 10 mg/kg/día es dosis alta RESPALDADA, no sobredosis — un tope fijo la marcaría como error.' },
  { farmaco: 'Eravacycline', porQue: 'Se dosifica por kilo (1 mg/kg cada 12 h), así que el tope en mg depende del peso del paciente y no se puede fijar como una cifra única.' },
  { farmaco: 'Vancomycin IV', porQue: 'El objetivo es AUC24/MIC 400-600, no una dosis fija. Su tope es TDM_DEPENDENT: lo fija la concentración medida, no una tabla.' },
  { farmaco: 'Trimethoprim-sulfamethoxazole', porQue: 'Las pautas altas van por kilo del componente trimetoprima (8-20 mg/kg/día según la indicación). Un tope en mg fijos taparía la de neumocistosis.' },
  { farmaco: 'Colistimethate sodium (colistin)', porQue: 'La misma cifra significa tres dosis distintas según se exprese en base de colistina (CBA), colistimetato (CMS) o unidades internacionales. Antes del tope hay que declarar la unidad — el motor ya lo bloquea por eso.' },
  { farmaco: 'Polymyxin B', porQue: 'Se etiqueta en unidades internacionales y también por kilo. Mismo problema de unidad que la colistina.' },
  { farmaco: 'Penicillin G potassium', porQue: 'Se dosifica en MILLONES DE UNIDADES, no en mg. Un tope en mg no se podría comparar con lo que se prescribe.' },
  { farmaco: 'Ciprofloxacin', porQue: 'El tope cambia con la VÍA: 400 mg q8h intravenosa (1.2 g/día) contra 750 mg q12h oral (1.5 g/día). Necesita una entrada por vía, no una sola.' },
  { farmaco: 'Fosfomycin IV', porQue: 'La entrada del dataset trae la ficha y la guía fusionadas; hay que separarlas antes de fijar el tope.' },
  { farmaco: 'Pivmecillinam', porQue: 'Ficha y guía fusionadas con dos dosis distintas (185 mg y 370 mg). Hay que decidir cuál aplica en su medio.' },
  { farmaco: 'Sulopenem etzadroxil/probenecid', porQue: 'Producto combinado con dos componentes; el tope se declara por componente.' },
  { farmaco: 'Vancomycin PO', porQue: 'No se absorbe: el tope sistémico no aplica y la entrada del dataset no declara fuentes.' },
  { farmaco: 'Ceftazidime-avibactam + aztreonam', porQue: 'Es una COMBINACIÓN de dos fármacos: cada uno lleva su propio tope, no hay uno común.' },
  { farmaco: 'Nafcillin/Oxacillin class pathway', porQue: 'No es un fármaco, es una ruta de selección. El tope va en nafcilina o en oxacilina.' },
]

export const POR_QUE_ESTAS_VAN_APARTE =
  'Las transcritas salen de una frase que está escrita en el dataset verificado. ' +
  'Éstas salen del etiquetado adulto de uso corriente y no tienen el mismo ' +
  'respaldo. Mezclarlas haría que las dos parecieran igual de firmes, y quien ' +
  'las revisa necesita saber cuál es cuál para decidir dónde mirar dos veces.'
