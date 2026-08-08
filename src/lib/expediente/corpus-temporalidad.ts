/**
 * CORPUS ORO DEL MOTOR DE TEMPORALIDAD — la vara que le faltaba.
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────
 *
 * El motor se construyó entre la v1027 y la v1030 y salió a producción **sin
 * corpus**: sus únicos casos eran los que se escribieron junto al código, o sea
 * los que ya se sabía que pasaban. Una defensa medida sólo contra sí misma no
 * dice si protege o si estorba — y ésta puede hacer las dos cosas:
 *
 * · Si señala de menos, un padecimiento de hace tres años se queda escrito como
 *   diagnóstico actual, se copia a la nota siguiente y cambia lo que otro médico
 *   lee dentro de seis meses.
 * · Si señala de más, salta en «desde hace tres años tiene diabetes» —la forma
 *   normal de contar un crónico en la consulta mexicana— y el médico aprende a
 *   ignorar el aviso. Con él ignora los que sí importan.
 *
 * Por eso el corpus mide **las dos direcciones**: sensibilidad sobre lo que está
 * dicho en pasado, y especificidad sobre lo que no. Un corpus de sólo positivos
 * premiaría a un motor que marcara todo.
 *
 * ── LO QUE MIDIÓ LA PRIMERA VEZ QUE SE CORRIÓ (7-ago-2026) ───────────────────
 *
 * Cuatro defectos, ninguno de los cuales rompía una prueba (REG-192):
 *
 * 1. «Le operaron de la vesícula en 2018 y **quedó en control** por consulta
 *    externa» → no se marcaba. «En control» y «en tratamiento» anulaban un
 *    pretérito explícito.
 * 2. Una nota que escribe bien el antecedente ARRIBA y luego afirma lo mismo en
 *    presente ABAJO no producía aviso: sólo se miraba la PRIMERA aparición.
 * 3. «Tuvo **derrame pleural** hace un mes» se etiquetaba como evento vascular
 *    cerebral.
 * 4. «Le **extirparon** el apéndice» quedaba sin padecimiento: el verbo contaba
 *    como pasado pero no como cirugía.
 *
 * ── DATOS ────────────────────────────────────────────────────────────────────
 *
 * 100 % sintéticos. Ninguna frase viene de un paciente real ni de una consulta
 * real: son reconstrucciones del PATRÓN de habla, escritas para esta prueba en
 * el español de la consulta mexicana. No hay nombres, edades ni fechas de nadie.
 *
 * ── LO QUE ESTE CORPUS **NO** ES ─────────────────────────────────────────────
 *
 * No es una medición de producción. Es sintético y pequeño: dice si el motor
 * determinista sigue en pie, no con qué frecuencia acierta sobre el habla real
 * del Dr. Ese número necesita transcripciones anotadas por un clínico y lo
 * produce el dueño, no el programa. Presentar el uno como el otro sería inventar
 * una cifra con otro nombre.
 *
 * Tampoco mide el vocabulario: que un padecimiento no esté en la lista significa
 * que **ese caso no se vigila**, no que se dé por bueno. Los casos marcados
 * `fuera-de-vocabulario` están aquí para que esa frontera sea visible y para que
 * nadie la cruce por accidente inventando sinónimos de más.
 *
 * Módulo PURO: sólo datos.
 */

/**
 * En qué se apoya el caso. Sirve para medir por separado dónde se rompe: un
 * motor puede estar sano en el pretérito y ciego a la marca de tiempo.
 */
export type FamiliaTemporal =
  /** El verbo o la marca sitúan el hecho en el pasado. Debe detectarse. */
  | 'pasado'
  /** La frase habla del presente, con o sin marca de tiempo. NO debe detectarse. */
  | 'presente'
  /** Lo que va a pasar. En el futuro no hay nada que corregir. */
  | 'futuro'
  /** Está en pasado pero el padecimiento no es del vocabulario: no se vigila. */
  | 'fuera-de-vocabulario'

export interface FraseOroTemporal {
  id: string
  /** El dictado, tal como saldría del reconocedor. Sintético. */
  frase: string
  /** Los padecimientos canónicos que la frase sitúa en pasado. Vacío = ninguno. */
  esperado: readonly string[]
  familia: FamiliaTemporal
  /** Qué pone a prueba. Un caso sin motivo se borra en seis meses por trivial. */
  porQue: string
}

export const FRASES_ORO_TEMPORAL: readonly FraseOroTemporal[] = [
  // ── PRETÉRITO EXPLÍCITO ───────────────────────────────────────────────────
  {
    id: 'tmp-p01',
    frase: 'Tuvo neumonía hace tres años y estuvo internado una semana.',
    esperado: ['neumonía'], familia: 'pasado',
    porQue: 'El titular del motor: verbo en pretérito + marca de cuándo.',
  },
  {
    id: 'tmp-p02',
    frase: 'Tuvo neumonía hace tres años y estuvo en tratamiento con levofloxacino once días.',
    esperado: ['neumonía'], familia: 'pasado',
    porQue: 'REG-192: «en tratamiento» anulaba el pretérito. El tratamiento también fue de entonces.',
  },
  {
    id: 'tmp-p03',
    frase: 'Le operaron de la vesícula en 2018 y quedó en control por consulta externa.',
    esperado: ['cirugía'], familia: 'pasado',
    porQue: 'REG-192: «quedó en control» describe el seguimiento, no que la cirugía sea de hoy.',
  },
  {
    id: 'tmp-p04',
    frase: 'Hace cinco años le extirparon el apéndice.',
    esperado: ['cirugía'], familia: 'pasado',
    porQue: 'REG-192: «extirparon» contaba como pasado pero no como cirugía. Quedaba sin padecimiento.',
  },
  {
    id: 'tmp-p05',
    frase: 'Le resecaron un segmento de intestino en 2017.',
    esperado: ['cirugía'], familia: 'pasado',
    porQue: 'El mismo hueco que tmp-p04, con el otro verbo quirúrgico del dictado.',
  },
  {
    id: 'tmp-p06',
    frase: 'De niño tuvo hepatitis A.',
    esperado: ['hepatitis'], familia: 'pasado',
    porQue: 'La marca de cuándo sin cifra ni año: «de niño», que es como se cuenta lo de la infancia.',
  },
  {
    id: 'tmp-p07',
    frase: 'Tuvo COVID en 2020, cuadro leve, sin oxígeno.',
    esperado: ['COVID-19'], familia: 'pasado',
    porQue: 'El año como marca, y la forma corta del padecimiento.',
  },
  {
    id: 'tmp-p08',
    frase: 'Padeció dengue el año pasado.',
    esperado: ['dengue'], familia: 'pasado',
    porQue: 'Pretérito sin marca numérica: el verbo tiene que bastar.',
  },
  {
    id: 'tmp-p09',
    frase: 'Sufrió un evento vascular cerebral en 2021.',
    esperado: ['evento vascular cerebral'], familia: 'pasado',
    porQue: '«Sufrió» es la forma en que se cuenta lo agudo grave.',
  },
  {
    id: 'tmp-p10',
    frase: 'Se fracturó la cadera hace ocho meses.',
    esperado: ['fractura'], familia: 'pasado',
    porQue: 'La marca en meses, no en años: el intervalo corto también es pasado.',
  },
  {
    id: 'tmp-p11',
    frase: 'Presentó una trombosis venosa profunda hace dos años.',
    esperado: ['trombosis venosa'], familia: 'pasado',
    porQue: '«Presentó» en pretérito, que se confunde de vista con «presenta».',
  },
  {
    id: 'tmp-p12',
    frase: 'Anteriormente padeció pancreatitis por alcohol.',
    esperado: ['pancreatitis'], familia: 'pasado',
    porQue: 'La marca adverbial suelta, sin cifra ni año: el pasado dicho sin decir cuándo.',
  },
  {
    id: 'tmp-p13',
    frase: 'Tuvo una infección urinaria hace seis meses.',
    esperado: ['infección urinaria'], familia: 'pasado',
    porQue: 'Lo agudo que más se repite en consulta; importa que no se arrastre como actual.',
  },
  {
    id: 'tmp-p14',
    frase: 'En el pasado tuvo una embolia pulmonar.',
    esperado: ['embolia pulmonar'], familia: 'pasado',
    porQue: 'La marca más explícita que existe. Si ésta se cae, se ha caído el motor entero.',
  },
  {
    id: 'tmp-p15',
    frase: 'Tuvo hemorragia digestiva años atrás.',
    esperado: ['hemorragia digestiva'], familia: 'pasado',
    porQue: '«Años atrás» sin cifra delante: la misma marca que tmp-p01 con la cantidad implícita.',
  },
  {
    id: 'tmp-p16',
    frase: 'Ya se le quitó la cistitis con nitrofurantoína.',
    esperado: ['infección urinaria'], familia: 'pasado',
    porQue: 'La resolución contada como tal: «ya se le quitó».',
  },
  {
    id: 'tmp-p17',
    frase: 'Le hicieron una colecistectomía hace diez años.',
    esperado: ['cirugía'], familia: 'pasado',
    porQue: 'El nombre técnico del procedimiento, que es como queda en el expediente.',
  },
  {
    id: 'tmp-p18',
    frase: 'Tuvo bronconeumonía en la infancia.',
    esperado: ['neumonía'], familia: 'pasado',
    porQue: 'Variante léxica del padecimiento + marca de infancia.',
  },
  {
    id: 'tmp-p19',
    frase: 'Le dio un derrame cerebral en 2019.',
    esperado: ['evento vascular cerebral'], familia: 'pasado',
    porQue: 'La forma coloquial con la que el paciente lo cuenta. Sin verbo de pretérito de la lista: manda la marca.',
  },
  {
    id: 'tmp-p20',
    frase: 'Tuvo pielonefritis hace seis meses y requirió hospitalización.',
    esperado: ['infección urinaria'], familia: 'pasado',
    porQue: 'Sinónimo clínico que debe caer en la misma canónica.',
  },
  {
    id: 'tmp-p21',
    frase: 'Padeció tromboembolia pulmonar en 2022.',
    esperado: ['embolia pulmonar'], familia: 'pasado',
    porQue: 'El sinónimo que usa el internista, no el que usa el paciente.',
  },
  {
    id: 'tmp-p22',
    frase: 'Tuvo COVID en 2021 y le dejó neumonía.',
    esperado: ['COVID-19', 'neumonía'], familia: 'pasado',
    porQue: 'Dos padecimientos en una frase: el motor no puede quedarse con el primero.',
  },
  {
    id: 'tmp-p23',
    frase: 'Tenía asma cuando era niño y se le quitó en la adolescencia.',
    esperado: ['asma'], familia: 'pasado',
    porQue: 'Un CRÓNICO contado en pasado. El vocabulario de negaciones también entra aquí.',
  },
  {
    id: 'tmp-p24',
    frase: 'Le operaron de cáncer de colon hace cuatro años.',
    esperado: ['cirugía', 'cáncer'], familia: 'pasado',
    porQue: 'Los dos vocabularios —lo agudo y lo crónico— en la misma frase.',
  },

  // ── PRESENTE: LA TRAMPA QUE HAY QUE NO PISAR ──────────────────────────────
  {
    id: 'tmp-n01',
    frase: 'Desde hace tres años tiene diabetes.',
    esperado: [], familia: 'presente',
    porQue: 'La forma más común de contar un crónico. Marcarla sería peor que no mirar nada.',
  },
  {
    id: 'tmp-n02',
    frase: 'Desde hace dos años tiene hipertensión arterial en control con losartán.',
    esperado: [], familia: 'presente',
    porQue: 'La misma trampa con el marcador de estado detrás: sigue siendo presente.',
  },
  {
    id: 'tmp-n03',
    frase: 'Sigue con neumonía, continúa con antibiótico.',
    esperado: [], familia: 'presente',
    porQue: 'Continuidad explícita sobre un padecimiento agudo: no es antecedente.',
  },
  {
    id: 'tmp-n04',
    frase: 'Actualmente cursa con infección urinaria baja.',
    esperado: [], familia: 'presente',
    porQue: 'El adverbio que dice «ahora» sin marca de tiempo.',
  },
  {
    id: 'tmp-n05',
    frase: 'Todavía tiene dolor en el sitio de la fractura.',
    esperado: [], familia: 'presente',
    porQue: 'El padecimiento se nombra pero la frase habla de ahora.',
  },
  {
    id: 'tmp-n06',
    frase: 'Hoy en día persiste con tos productiva.',
    esperado: [], familia: 'presente',
    porQue: 'Locución de actualidad completa, la que más usa el paciente para decir que sigue igual.',
  },
  {
    id: 'tmp-n07',
    frase: 'Desde 2019 tiene diabetes tipo 2 en tratamiento con metformina.',
    esperado: [], familia: 'presente',
    porQue: 'El año como INICIO de algo que sigue, no como fecha de un hecho cerrado.',
  },
  {
    id: 'tmp-n08',
    frase: 'Su madre tiene diabetes y su padre tiene hipertensión.',
    esperado: [], familia: 'presente',
    porQue: 'Antecedente familiar en presente: ni es del paciente ni es pasado.',
  },
  {
    id: 'tmp-n09',
    frase: 'Está en control en la clínica por su diabetes.',
    esperado: [], familia: 'presente',
    porQue: 'El marcador de estado SOLO, sin pretérito que lo gobierne: manda el presente.',
  },
  {
    id: 'tmp-n10',
    frase: 'Continúa con el tratamiento para la hepatitis C.',
    esperado: [], familia: 'presente',
    porQue: 'Enfermedad activa en tratamiento; el aviso aquí sería ruido puro.',
  },
  {
    id: 'tmp-n11',
    frase: 'Permanece con datos de infección urinaria pese al antibiótico.',
    esperado: [], familia: 'presente',
    porQue: 'Cuarto verbo de continuidad, el menos frecuente de los cuatro.',
  },
  {
    id: 'tmp-n12',
    frase: 'En la actualidad tiene dengue confirmado por laboratorio.',
    esperado: [], familia: 'presente',
    porQue: 'Locución de actualidad con un agudo confirmado hoy.',
  },
  {
    id: 'tmp-n13',
    frase: 'Aún presenta secuelas del evento vascular cerebral.',
    esperado: [], familia: 'presente',
    porQue: 'El hecho fue pasado pero la frase afirma el presente. El encuadre manda, como en la intención de orden.',
  },
  {
    id: 'tmp-n14',
    frase: 'El paciente viene por control de su diabetes.',
    esperado: [], familia: 'presente',
    porQue: 'Frase de motivo de consulta, sin ninguna marca temporal.',
  },
  {
    id: 'tmp-n15',
    frase: 'Presenta dolor abdominal de tres días de evolución.',
    esperado: [], familia: 'presente',
    porQue: '«Presenta» a un carácter de «presentó»: el motor no puede confundirlos.',
  },
  {
    id: 'tmp-n16',
    frase: 'Refiere que no ha tenido neumonías.',
    esperado: [], familia: 'presente',
    porQue: 'Una negación no es un pasado: de eso se ocupa el otro motor y con otro criterio.',
  },
  {
    id: 'tmp-n17',
    frase: 'Niega antecedente de trombosis.',
    esperado: [], familia: 'presente',
    porQue: 'La palabra «antecedente» dentro de una negación no puede volverla un hecho pasado.',
  },
  {
    id: 'tmp-n18',
    frase: 'Desde hace quince años tiene hipertensión arterial y desde hace ocho, diabetes.',
    esperado: [], familia: 'presente',
    porQue: 'Dos crónicos con dos marcas de tiempo: el caso donde un motor mal ajustado avisaría dos veces.',
  },

  // ── FUTURO ────────────────────────────────────────────────────────────────
  {
    id: 'tmp-f01',
    frase: 'Lo van a operar de la vesícula la próxima semana.',
    esperado: [], familia: 'futuro',
    porQue: 'En el futuro no hay nada que corregir. «Operar» no puede caer en «operaron».',
  },
  {
    id: 'tmp-f02',
    frase: 'Tiene programada una cirugía de vesícula para el mes que viene.',
    esperado: [], familia: 'futuro',
    porQue: 'El padecimiento SÍ se nombra; lo que falta es el encuadre pasado.',
  },
  {
    id: 'tmp-f03',
    frase: 'Se le va a solicitar tomografía si persiste el dolor.',
    esperado: [], familia: 'futuro',
    porQue: 'Condicional a futuro, sin padecimiento del vocabulario.',
  },

  // ── FUERA DE VOCABULARIO: la frontera, dicha en voz alta ──────────────────
  {
    id: 'tmp-v01',
    frase: 'Tuvo derrame pleural hace un mes.',
    esperado: [], familia: 'fuera-de-vocabulario',
    porQue: 'REG-192: se etiquetaba como evento vascular cerebral. Un derrame pleural no es un ictus. Mejor no vigilarlo que vigilarlo con la etiqueta equivocada.',
  },
  {
    id: 'tmp-v02',
    frase: 'Se le drenó un derrame pericárdico durante la hospitalización.',
    esperado: [], familia: 'fuera-de-vocabulario',
    porQue: 'La otra colección que se llama «derrame» en la consulta.',
  },
  {
    id: 'tmp-v03',
    frase: 'Hace tres años cambió de trabajo y desde entonces fuma menos.',
    esperado: [], familia: 'fuera-de-vocabulario',
    porQue: 'Marca de pasado sin ningún padecimiento: la marca sola no puede producir un aviso.',
  },
  {
    id: 'tmp-v04',
    frase: 'Tuvo un cuadro de gastroenteritis hace dos semanas.',
    esperado: [], familia: 'fuera-de-vocabulario',
    porQue: 'Agudo frecuente que NO está en la lista. Que falte significa que no se vigila, no que se dé por bueno.',
  },
]

export interface NotaOroTemporal {
  id: string
  /** El dictado sintético del que salen las menciones en pasado. */
  dictado: string
  /** La nota generada, tal como la leería el médico antes de firmar. */
  nota: string
  /** Los padecimientos que deben producir aviso de desajuste. */
  esperado: readonly string[]
  porQue: string
}

export const NOTAS_ORO_TEMPORAL: readonly NotaOroTemporal[] = [
  {
    id: 'tmp-d01',
    dictado: 'Tuvo neumonía hace tres años. Hoy viene por tos y fiebre de dos días.',
    nota: 'Antecedentes personales patológicos: neumonía en 2019.\n\n'
      + 'Impresión diagnóstica: neumonía adquirida en la comunidad.',
    esperado: ['neumonía'],
    porQue: 'REG-192: el antecedente bien escrito ARRIBA tapaba la afirmación en presente de ABAJO. '
      + 'Sólo se miraba la primera aparición, y una nota ordenada empieza por los antecedentes.',
  },
  {
    id: 'tmp-d02',
    dictado: 'Tuvo neumonía hace tres años. Hoy viene por tos y fiebre de dos días.',
    nota: 'Impresión diagnóstica: neumonía adquirida en la comunidad.',
    esperado: ['neumonía'],
    porQue: 'El mismo caso sin el antecedente delante: es el que ya funcionaba, y tiene que seguir.',
  },
  {
    id: 'tmp-d03',
    dictado: 'Tuvo neumonía hace tres años. Hoy viene por tos y fiebre de dos días.',
    nota: 'Antecedente de neumonía tratada en 2019. Cuadro actual: rinofaringitis viral.',
    esperado: [],
    porQue: 'La nota lo escribió BIEN. Avisar aquí sería el ruido que hace que se ignore el aviso de al lado.',
  },
  {
    id: 'tmp-d04',
    dictado: 'Tuvo neumonía hace tres años.',
    nota: 'Antecedente de neumonía en 2019. Historia de neumonía sin secuelas respiratorias.',
    esperado: [],
    porQue: 'El contra-caso de tmp-d01: mirar TODAS las apariciones no puede convertirse en avisar por cada una. '
      + 'Las dos están encuadradas como antecedente y las dos son correctas.',
  },
  {
    id: 'tmp-d05',
    dictado: 'Sufrió un evento vascular cerebral en 2021.',
    nota: 'Diagnósticos: 1. Evento vascular cerebral. 2. Hipertensión arterial.',
    esperado: ['evento vascular cerebral'],
    porQue: 'Una lista numerada de diagnósticos no lleva la palabra «antecedente» delante, y es donde más pesa el error.',
  },
  {
    id: 'tmp-d06',
    dictado: 'Tuvo COVID en 2020, cuadro leve.',
    nota: 'Antecedentes: COVID-19 en 2020, manejo ambulatorio, sin oxígeno.',
    esperado: [],
    porQue: 'Escrito como antecedente con su año: nada que avisar.',
  },
  {
    id: 'tmp-d07',
    dictado: 'Desde hace tres años tiene diabetes.',
    nota: 'Diabetes mellitus tipo 2 en tratamiento con metformina.',
    esperado: [],
    porQue: 'Sin mención en pasado no hay desajuste posible. La trampa, extremo a extremo.',
  },
  {
    id: 'tmp-d08',
    dictado: 'Ya se le quitó la cistitis con nitrofurantoína.',
    nota: 'Antecedente de infección urinaria resuelta el mes pasado.',
    esperado: [],
    porQue: '«Resuelta» también encuadra como pasado, aunque no diga «antecedente de» pegado al término.',
  },
  {
    id: 'tmp-d09',
    dictado: 'Ya se le quitó la cistitis con nitrofurantoína.',
    nota: 'Impresión: infección urinaria en curso, se inicia esquema antibiótico.',
    esperado: ['infección urinaria'],
    porQue: 'El dictado dice que se resolvió y la nota la deja activa. Puede tener razón la nota: por eso se avisa, no se corrige.',
  },
  {
    id: 'tmp-d10',
    dictado: 'Tuvo derrame pleural hace un mes.',
    nota: 'Derrame pleural derecho drenado, sin recurrencia.',
    esperado: [],
    porQue: 'REG-192 en la nota: no puede aparecer un aviso de «evento vascular cerebral» que nadie mencionó.',
  },
  {
    id: 'tmp-d11',
    dictado: 'Le operaron de la vesícula en 2018 y quedó en control por consulta externa.',
    nota: 'Padecimiento actual: cirugía de vesícula.',
    esperado: ['cirugía'],
    porQue: 'REG-192 extremo a extremo: si la frase no se detecta como pasada, la nota nunca se contrasta.',
  },
  {
    id: 'tmp-d12',
    dictado: 'Hace cinco años le extirparon el apéndice.',
    nota: 'Diagnóstico: apendicectomía.',
    esperado: ['cirugía'],
    porQue: 'El verbo quirúrgico que faltaba, hasta el aviso.',
  },
]

export const POR_QUE_SE_MIDEN_LAS_DOS_DIRECCIONES =
  'Un corpus de sólo positivos premia al motor que marca todo, y un motor que ' +
  'marca todo es el que consigue que el médico deje de leer los avisos. La ' +
  'especificidad sobre «desde hace tres años tiene diabetes» vale tanto como la ' +
  'sensibilidad sobre «tuvo neumonía hace tres años».'

export const POR_QUE_NO_ES_UNA_MEDICION_DE_PRODUCCION =
  'Es sintético y pequeño: dice si el motor determinista sigue en pie, no con ' +
  'qué frecuencia acierta sobre el habla real de la consulta. Ese número ' +
  'necesita transcripciones anotadas por un clínico y lo produce el dueño. ' +
  'Presentar el uno como el otro sería inventar una cifra con otro nombre.'

export const POR_QUE_HAY_CASOS_FUERA_DE_VOCABULARIO =
  'Que un padecimiento no esté en la lista significa que ese caso NO se vigila, ' +
  'no que se dé por bueno. Los casos «fuera-de-vocabulario» dibujan la frontera ' +
  'para que sea visible — y para que ensancharla se haga a propósito y no ' +
  'inventando sinónimos que arrastran la etiqueta equivocada, como «derrame».'
