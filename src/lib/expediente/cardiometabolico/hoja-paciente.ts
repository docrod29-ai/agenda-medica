/**
 * HOJA DE INFORMACIÓN PARA EL PACIENTE.
 *
 * Genera, en lenguaje llano y con los NÚMEROS DEL PACIENTE, una hoja imprimible
 * para que se la lleve de la consulta. Todo el contenido sale de los módulos
 * respaldados por guía; aquí solo se traduce a lenguaje de paciente.
 *
 * Reglas de redacción que se siguen a propósito:
 *  · Segunda persona, frases cortas, sin siglas sin explicar.
 *  · Cada meta va con SU número, no con generalidades ("baje de peso").
 *  · Se dice qué logra cada cambio, porque eso es lo que sostiene la adherencia.
 *  · Nada de alarmismo ni de promesas: lo que dice la evidencia y ya.
 */

import { metaLipidica, planTrigliceridos, type EntradaMetas } from './dislipidemia'
import { interpretarFib4 } from './masld'
import { METAS_POR_COMPLICACION } from './obesidad'

export interface DatosPaciente {
  nombre?: string
  edad?: number
  esMujer?: boolean
  pesoKg?: number
  tallaCm?: number
  cinturaCm?: number
  /** Colesterol LDL actual (mg/dL). */
  ldl?: number
  /** Triglicéridos en ayuno (mg/dL). */
  tg?: number
  /** FIB-4 calculado. */
  fib4?: number
  /** Complicaciones marcadas por el médico (texto libre). */
  complicaciones?: string[]
  /** Contexto clínico para calcular la meta de lípidos. */
  contextoLipidico?: EntradaMetas
}

export interface SeccionHoja {
  titulo: string
  parrafos: string[]
  /** Puntos accionables: lo que el paciente hace desde hoy. */
  acciones?: string[]
}

export interface HojaPaciente {
  titulo: string
  intro: string
  secciones: SeccionHoja[]
  cierre: string
}

const pct = (n: number) => `${Math.round(n * 10) / 10}%`

/** Redondea a un kilo: el paciente no necesita decimales. */
function kilosPara(pesoKg: number, porcentaje: number): number {
  return Math.round((pesoKg * porcentaje) / 100)
}

// ═══════════════════════════════════════════════════════════════════════════

export function generarHoja(d: DatosPaciente): HojaPaciente {
  const secciones: SeccionHoja[] = []

  // ── Peso ──
  if (d.pesoKg && d.pesoKg > 0) {
    const cinco = kilosPara(d.pesoKg, 5)
    const diez = kilosPara(d.pesoKg, 10)
    const quince = kilosPara(d.pesoKg, 15)

    const parrafos = [
      `Su peso hoy es de ${d.pesoKg} kg. En medicina no buscamos un peso "ideal": buscamos el porcentaje de peso que hace que mejore cada problema de salud. Por eso las metas se ponen en porcentaje y no en un número de la báscula.`,
      `Bajar ${cinco} kg equivale al 5% de su peso. Bajar ${diez} kg es el 10%. Bajar ${quince} kg es el 15%.`,
    ]

    const acciones: string[] = []
    const comps = (d.complicaciones ?? []).map(c => c.toLowerCase())
    const relevantes = METAS_POR_COMPLICACION.filter(m => {
      const clave = m.complicacion.toLowerCase()
      return comps.some(c => clave.includes(c) || c.includes(clave.split(' ')[0]))
    })
    for (const m of relevantes.slice(0, 6)) {
      if (/investigación/i.test(m.beneficio)) continue
      acciones.push(`Para ${m.complicacion.toLowerCase()}: bajar ${m.beneficio} de su peso ya produce un beneficio real.`)
    }
    if (acciones.length === 0) {
      acciones.push(`Bajar entre 5% y 10% de su peso (${cinco} a ${diez} kg) mejora la presión arterial, el azúcar, el colesterol y la grasa en el hígado.`)
    }
    acciones.push('Perder peso poco a poco protege su músculo y su hueso; bajarlo muy rápido no.')

    secciones.push({ titulo: 'Su peso y lo que gana al bajarlo', parrafos, acciones })
  }

  // ── Colesterol ──
  if (d.ldl != null && d.ldl > 0) {
    const meta = metaLipidica(d.contextoLipidico ?? {})
    const falta = d.ldl - meta.ldl
    const parrafos = [
      `Su colesterol LDL (el que tapa las arterias) está en ${d.ldl} mg/dL. Su meta es tenerlo por debajo de ${meta.ldl} mg/dL.`,
      falta > 0
        ? `Le faltan ${Math.round(falta)} mg/dL para llegar a la meta. Esa diferencia se cierra con tratamiento y con los cambios de alimentación que vienen abajo.`
        : 'Usted ya está en su meta. Lo importante ahora es mantenerse ahí: el beneficio viene de sostenerlo en el tiempo, no de alcanzarlo una vez.',
      'El colesterol alto no se siente. No duele, no da síntomas y por eso es fácil descuidarlo. El daño se acumula en silencio durante años en las arterias.',
    ]
    secciones.push({
      titulo: 'Su colesterol',
      parrafos,
      acciones: [
        'Cambiar la grasa de origen animal por grasa de origen vegetal: use aceite de oliva, aguacate y nueces en lugar de mantequilla, crema y carnes grasas.',
        'Una porción de nueces al día baja el colesterol malo cerca de 5 mg/dL.',
        'Comer más frijoles, lentejas, verduras y granos enteros; la fibra ayuda.',
        'Los suplementos "para el colesterol" que se venden sin receta (aceite de pescado, ajo, canela, levadura roja de arroz) NO han demostrado servir. En el estudio que los comparó de frente, ninguno bajó el colesterol más que una pastilla de placebo.',
      ],
    })
  }

  // ── Triglicéridos ──
  if (d.tg != null && d.tg > 0) {
    const plan = planTrigliceridos(d.tg)
    if (plan) {
      const parrafos = [`Sus triglicéridos están en ${d.tg} mg/dL.`]
      if (plan.riesgoPancreatitis) {
        parrafos.push('En este nivel existe riesgo de pancreatitis, que es una inflamación grave del páncreas. Por eso las indicaciones de abajo son más estrictas de lo habitual y es importante cumplirlas.')
      } else if (d.tg >= 150) {
        parrafos.push('Están por arriba de lo deseable. Los triglicéridos responden muy bien a los cambios de alimentación: es de lo que más rápido mejora.')
      } else {
        parrafos.push('Están en rango normal.')
      }
      secciones.push({
        titulo: 'Sus triglicéridos',
        parrafos,
        acciones: [
          `Azúcares añadidos: ${plan.azucares.toLowerCase()}. Esto incluye refrescos, jugos, pan dulce y postres.`,
          `Alcohol: ${plan.alcohol.toLowerCase()}.`,
          `Grasa: ${plan.grasaTotal.toLowerCase()} de lo que come al día.`,
          'Bajar de peso funciona: por cada kilo que baja, los triglicéridos bajan alrededor de 4 mg/dL.',
        ],
      })
    }
  }

  // ── Hígado ──
  if (d.fib4 != null && d.edad != null) {
    const r = interpretarFib4(d.fib4, d.edad)
    if (r) {
      const parrafos = [
        /**
       * Al paciente se le habla en su idioma. Se conserva «grasa en el hígado»
       * —que es lo que entiende— y se le enseña el nombre nuevo, porque es el que
       * va a leer en sus estudios y en el resumen de su consulta.
       */
      'La grasa en el hígado (su nombre médico actual es esteatosis hepática metabólica, o MASLD) es la acumulación de grasa dentro del hígado. Es muy frecuente en México y casi nunca da síntomas.',
      ]
      if (r.zona === 'bajo') {
        parrafos.push('Sus estudios indican que es poco probable que tenga cicatrización importante del hígado. Es una buena noticia, y el objetivo ahora es que siga así.')
      } else if (r.zona === 'indeterminado') {
        parrafos.push('Sus estudios no permiten descartar cicatrización del hígado, así que necesitamos un estudio adicional para saberlo con certeza. No significa que ya tenga daño: significa que hay que revisarlo bien.')
      } else {
        parrafos.push('Sus estudios sugieren que puede haber cicatrización avanzada del hígado. Por eso lo vamos a enviar con el especialista en hígado. Detectarlo a tiempo es justamente lo que permite tratarlo.')
      }
      parrafos.push('Lo importante: la grasa del hígado se puede quitar, y la cicatrización temprana puede mejorar. El hígado tiene una gran capacidad de recuperarse cuando se le quita la causa.')
      secciones.push({
        titulo: 'Su hígado',
        parrafos,
        acciones: [
          'Bajar 5% de su peso quita grasa del hígado. Bajar 10% o más es lo que mejora la cicatrización.',
          'Nada de alcohol. Con grasa en el hígado, el alcohol acelera el daño y reduce las probabilidades de mejorar.',
          'Evitar bebidas azucaradas. La fructosa de los refrescos y jugos se relaciona con más cicatrización del hígado incluso sin comer de más.',
          'Caminar o hacer ejercicio al menos 150 minutos por semana; el ejercicio mejora el hígado aunque el peso no baje mucho.',
        ],
      })
    }
  }

  // ── Alimentación y ejercicio (siempre) ──
  secciones.push({
    titulo: 'Cómo comer',
    parrafos: [
      'No hay una dieta única que sea superior a las demás. La mejor dieta es la que usted pueda sostener durante años, no la más estricta.',
      'De todas, la dieta mediterránea es la única que ha demostrado reducir infartos y embolias a largo plazo. Adaptada a lo que se come en México, significa: más verduras, frutas, frijoles, lentejas, nueces, granos enteros y pescado; menos carnes procesadas, harinas refinadas y comida ultraprocesada.',
    ],
    acciones: [
      'Llene la mitad del plato con verduras.',
      'Cambie el pan blanco, el arroz blanco y las harinas refinadas por versiones integrales.',
      'Coma pescado al menos dos veces por semana.',
      'Quite las bebidas azucaradas. Es el cambio único con mayor impacto.',
      'Coma proteína suficiente en cada comida (huevo, pollo, pescado, frijol, lenteja): protege su músculo mientras baja de peso.',
    ],
  })

  secciones.push({
    titulo: 'Cómo moverse',
    parrafos: [
      'La meta es 150 minutos por semana de actividad moderada. Son 30 minutos, 5 días. Moderada quiere decir que puede hablar pero no cantar mientras lo hace.',
      'Además, ejercicio de fuerza 2 o 3 días por semana. Esto no es opcional ni es solo para el gimnasio: cuando usted baja de peso, pierde grasa pero también músculo, y la fuerza es lo que protege el músculo. Sirven las ligas, el propio peso del cuerpo o pesas ligeras.',
      'Si va a mantener el peso que ya bajó, va a necesitar más: entre 200 y 300 minutos por semana.',
    ],
    acciones: [
      'Empiece donde esté hoy, no donde quisiera estar. Cualquier actividad es mejor que ninguna.',
      'Si no puede 30 minutos seguidos, haga tramos de 10 minutos: cuentan igual.',
      'Si le duelen las rodillas, la caminata en agua o el ejercicio sentado son buenas opciones.',
    ],
  })

  const nombre = d.nombre ? `, ${d.nombre}` : ''
  return {
    titulo: 'Su plan de salud cardiovascular y metabólica',
    intro: `Esta hoja${nombre} resume lo que hablamos en la consulta, con sus propios números. Léala con calma en casa. No tiene que hacer todo de golpe: elija uno o dos cambios y empiece por ahí.`,
    secciones,
    cierre: 'Esta hoja es información para usted, no sustituye la consulta. Si algo no le queda claro, pregúntelo en la próxima cita. Si aparecen síntomas nuevos o algo empeora, busque atención antes de la cita.',
  }
}

/** Convierte la hoja a texto plano, para imprimir o pegar en la nota. */
export function hojaATexto(h: HojaPaciente): string {
  const partes = [h.titulo, '', h.intro, '']
  for (const s of h.secciones) {
    partes.push(`── ${s.titulo.toUpperCase()} ──`)
    for (const p of s.parrafos) partes.push(p)
    if (s.acciones?.length) {
      partes.push('')
      for (const a of s.acciones) partes.push(`• ${a}`)
    }
    partes.push('')
  }
  partes.push(h.cierre)
  return partes.join('\n')
}

export { pct }
