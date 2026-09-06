/**
 * COPILOTO CLÍNICO — el motor que hace que las herramientas dejen de ser botones.
 *
 * Regla de diseño: NO se le pide nada al médico. Este motor lee lo que YA está
 * capturado en la consulta (edad, sexo, signos vitales, diagnósticos, receta) y
 * devuelve solo lo que puede CALCULAR o lo que la seguridad del paciente obliga
 * a decir. Si un dato falta, no se pinta un formulario: se calla, o pide ese
 * dato en una línea.
 *
 * Consecuencia práctica: una consulta normal no dispara nada. Un niño con una
 * receta dispara la verificación de dosis por peso. Una alergia que choca con
 * lo recetado dispara una alerta crítica. Nada más.
 *
 * Todo es PURO y testeado. El médico decide; esto solo pone lo que ya se sabe.
 */

import { FARMACOS_PED, calcularDosisPediatrica, imc as calcImc } from './pediatria'
import { AJUSTE_RENAL, ajustePorTFG, EMBARAZO_LACTANCIA, coincideRenal, RIESGO_HEPATICO, coincideHepatico } from './prescripcion-segura'
import { ckdEpi2021 } from './calculadoras'
import { creatininaPlausibleMgDl } from './funcion-renal'
import { mgPorDl, valorEn } from '@/types/clinical-quantity'
import { metaLipidica, recomendarEstatina } from './cardiometabolico/dislipidemia'
import { clasificarIMC } from './cardiometabolico/obesidad'
import { fib4, interpretarFib4 } from './cardiometabolico/masld'
import { prevent, motivoSinPrevent } from './prevent'
import { extraerMg, esDosisPorKg } from '@/lib/seguridad/dosis'
import { alergenosDe } from '@/lib/seguridad/alergias'
import type { AlergiaEstructurada } from '@/types'
import {
  loQueElExpedienteDiceDelEmbarazo, diagnosticosGestacionales, tratarComoEmbarazada,
} from '@/lib/expediente/lo-que-el-expediente-dice-del-embarazo'

export type NivelSugerencia = 'critico' | 'accion' | 'info'

export interface Sugerencia {
  id: string
  nivel: NivelSugerencia
  titulo: string
  detalle: string
  /** Texto listo para pegarse en la nota. Vacío = no tiene sentido documentarlo. */
  textoNota: string
  /** Qué dato falta para poder calcular esto (solo cuando aporta pedirlo). */
  pide?: string
}

export interface MedicamentoConsulta { nombre: string; dosis?: string }
export interface DiagnosticoConsulta {
  descripcion: string
  /**
   * Con cuánta seguridad lo dio el médico. Opcional porque hay llamadores
   * antiguos que sólo mandan la descripción; ausente se trata como el caso
   * seguro para cada motor, nunca como «confirmado» por defecto.
   */
  tipo?: 'definitivo' | 'presuntivo' | 'descartado' | 'diferencial'
}

export interface SignosConsulta {
  ta?: string
  fc?: number
  fr?: number
  temperatura?: number
  spo2?: number
  peso?: number
  talla?: number
}

export interface EntradaCopiloto {
  edad?: number
  sexo?: string
  alergias?: string
  /**
   * Las alergias capturadas en campo, cuando existen. Mandan sobre el texto
   * libre — lo decide `alergenosDe`, no este motor.
   */
  alergiasEstructuradas?: AlergiaEstructurada[]
  diagnosticos?: DiagnosticoConsulta[]
  medicamentos?: MedicamentoConsulta[]
  signos?: SignosConsulta
  /** Laboratorios sueltos si la nota los trae: creatinina, ast, alt, plaquetas, ldl… */
  labs?: Record<string, number>
  /**
   * CUÁNDO SE MIDIÓ CADA UNO — sólo para los que vienen del EXPEDIENTE (REG-368).
   *
   * Desde que los paneles del paciente llegan a este motor (`labsDelCuadro`), un
   * número puede ser de hoy o de hace ocho meses. Decir «TFG estimada 28
   * (creatinina 2.4)» sin decir de cuándo es esa creatinina afirma una vigencia
   * que nadie comprobó.
   *
   * Ausente = de esta consulta. No se rellena con la fecha de hoy: un «medido
   * hoy» al lado de lo que el médico acaba de dictar es ruido.
   */
  labsMedidosEn?: Record<string, string>
  /**
   * DE DÓNDE VIENE CADA NÚMERO — la medición anterior, dicha (REG-369).
   *
   * Ya redactada por `comoSeDiceLaTrayectoria` («subió desde 1.6 el 2026-01-10»).
   * Aquí llega como texto y no como puntos a propósito: este motor no debe
   * decidir cómo se lee una trayectoria, sólo citarla. Y lo que cita es
   * aritmética —subió, bajó, igual— nunca un juicio.
   *
   * Ausente = no hay medición anterior. Un «sin datos previos» colgando de cada
   * aviso es ruido.
   */
  labsTrayectoria?: Record<string, string>
  /**
   * ¿La creatinina sigue sirviendo para dosificar? — política del dueño (REG-375).
   *
   * Se recibe ya resuelta: qué ventana aplica es una decisión clínica y vive en
   * `laboratorio/vigencia-de-la-funcion-renal.ts`, no en este motor. Aquí sólo se
   * dice lo que esa decisión dictó.
   *
   * Ausente = no se evaluó, y entonces este motor se comporta como antes. No se
   * da por vigente lo que nadie comprobó, simplemente no se afirma nada.
   */
  funcionRenalVigente?: {
    vigente: boolean
    /** El aviso ya redactado, con la marca `STALE_RENAL_FUNCTION`. */
    aviso: string
  }
}

// ── utilidades ──────────────────────────────────────────────────────────────

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/** Sistólica de una TA escrita como "120/80". */
export function sistolica(ta?: string): number | undefined {
  if (!ta) return undefined
  const m = ta.match(/(\d{2,3})\s*\/\s*(\d{2,3})/)
  return m ? Number(m[1]) : undefined
}
export function diastolica(ta?: string): number | undefined {
  if (!ta) return undefined
  const m = ta.match(/(\d{2,3})\s*\/\s*(\d{2,3})/)
  return m ? Number(m[2]) : undefined
}

/**
 * Familias de alergia: si el paciente es alérgico a penicilina, una cefalosporina
 * también debe saltar. Comparar solo por nombre exacto dejaría pasar justo el
 * caso peligroso.
 */
const FAMILIAS_ALERGIA: { familia: string; dispara: string[]; miembros: string[]; precaucion?: string[] }[] = [
  {
    familia: 'betalactámicos',
    dispara: ['penicilina', 'amoxicilina', 'ampicilina', 'betalactam', 'cefalosporina', 'peni'],
    miembros: ['penicilina', 'amoxicilina', 'ampicilina', 'dicloxacilina', 'piperacilina',
      'cefalexina', 'cefuroxima', 'ceftriaxona', 'cefotaxima', 'cefepime', 'cefazolina',
      'cefixima', 'ceftazidima'],
    // Carbapenémicos: reactividad cruzada REAL con penicilina ~1% (dependiente de
    // cadena lateral). Se avisa como PRECAUCIÓN, no como choque crítico, para no
    // empujar a evitar el tratamiento de 1ª línea (p. ej. meropenem en meningitis).
    precaucion: ['meropenem', 'imipenem', 'ertapenem', 'doripenem'],
  },
  {
    familia: 'sulfas',
    dispara: ['sulfa', 'sulfonamida', 'trimetoprim', 'tmp', 'bactrim'],
    // SIN furosemida/hidroclorotiazida: la evidencia no sustenta reactividad cruzada
    // relevante entre sulfonamidas antibióticas y no-antibióticas (diuréticos). Marcarlas
    // podía llevar a retirar un diurético necesario. (El validador de impresión ya las excluía.)
    miembros: ['trimetoprim', 'sulfametoxazol', 'sulfadiazina'],
  },
  {
    familia: 'antiinflamatorios no esteroideos',
    // Auditoría 2026-07 (P1): `dispara` solo tenía 4 términos, así que una alergia
    // registrada a un AINE CONCRETO (p. ej. «diclofenaco», «ketorolaco») no activaba
    // la familia y no saltaba con otro AINE. Se igualan `dispara` y `miembros`.
    dispara: ['aine', 'antiinflamatorio', 'ibuprofeno', 'naproxeno', 'diclofenaco', 'ketorolaco',
      'indometacina', 'meloxicam', 'aspirina', 'acido acetilsalicilico', 'celecoxib'],
    miembros: ['ibuprofeno', 'naproxeno', 'diclofenaco', 'ketorolaco', 'indometacina',
      'meloxicam', 'aspirina', 'acido acetilsalicilico', 'celecoxib'],
  },
  {
    familia: 'quinolonas',
    dispara: ['quinolona', 'ciprofloxacino', 'levofloxacino'],
    miembros: ['ciprofloxacino', 'levofloxacino', 'moxifloxacino', 'norfloxacino'],
  },
  {
    familia: 'macrólidos',
    dispara: ['macrolido', 'eritromicina', 'azitromicina', 'claritromicina'],
    miembros: ['eritromicina', 'azitromicina', 'claritromicina'],
  },
]

// ── 1. SEGURIDAD: alergia contra lo recetado ────────────────────────────────

function alergiaVsReceta(e: EntradaCopiloto): Sugerencia[] {
  /**
   * ── EL CAMPO SE LEE ALÉRGENO POR ALÉRGENO (7-ago-2026, REG-208) ────────────
   *
   * Aquí se normalizaba el campo ENTERO y se buscaba el fármaco dentro con un
   * `includes`, con un limpiador propio de negaciones. Sobre una frase suelta eso
   * funciona; sobre el campo entero no puede funcionar, porque la negación va
   * pegada a UN alérgeno y el `includes` mira todos a la vez:
   *
   *   «Niega alergia a penicilina» + amoxicilina → alerta CRÍTICA
   *   «Niega penicilina. Alérgico a sulfas» + amoxicilina → alerta CRÍTICA
   *
   * Reproducido con este motor: 4 de 9 frases del consultorio daban una
   * crítica falsa. El aviso de alergia es de los que **no se pliegan**
   * (`avisos-consulta.ts`), así que la única salida que le quedaba al médico
   * era borrar el texto del expediente — mutilando el registro para poder
   * trabajar. Es el mismo desenlace que ya describía la cabecera de
   * `alergias.ts`, cometido otra vez por un consumidor distinto.
   *
   * `alergenosDe` ya parte el campo por fragmentos y descarta los negados uno
   * a uno, y encima lee `alergiasEstructuradas`. El guardián de REG-144 buscaba
   * un quinto `split` a mano; éste no partía el campo **en absoluto**, que es
   * el mismo defecto hecho más grande.
   */
  const alergenos = alergenosDe({
    alergias: e.alergias,
    alergiasEstructuradas: e.alergiasEstructuradas,
  }).map(norm).filter(Boolean)
  if (alergenos.length === 0) return []
  const meds = e.medicamentos ?? []
  if (meds.length === 0) return []

  const out: Sugerencia[] = []
  for (const fam of FAMILIAS_ALERGIA) {
    if (!fam.dispara.some(d => alergenos.some(a => a.includes(d)))) continue
    for (const m of meds) {
      const nm = norm(m.nombre ?? '')
      if (!nm) continue
      const choca = fam.miembros.find(x => nm.includes(x))
      if (choca) {
        out.push({
          id: `alergia:${fam.familia}:${choca}`,
          nivel: 'critico',
          titulo: `${m.nombre} choca con una alergia registrada`,
          detalle: `El paciente tiene registrada alergia a ${fam.familia}, y ${m.nombre} pertenece a esa familia. Confirma la reacción previa antes de recetarlo o cambia de familia.`,
          textoNota: `Se identificó que ${m.nombre} pertenece a la familia de ${fam.familia}, a la que el paciente refiere alergia. Se verificó con el paciente antes de prescribir.`,
        })
        continue
      }
      // Reactividad cruzada BAJA (p. ej. carbapenémicos ante alergia a penicilina, ~1%):
      // aviso de PRECAUCIÓN, no choque crítico, para no descartar 1ª línea de golpe.
      const precaucion = fam.precaucion?.find(x => nm.includes(x))
      if (precaucion) {
        out.push({
          id: `alergia:precaucion:${fam.familia}:${precaucion}`,
          nivel: 'accion',
          titulo: `${m.nombre}: precaución por alergia a ${fam.familia}`,
          detalle: `${m.nombre} tiene reactividad cruzada BAJA con ${fam.familia} (≈1%, según la cadena lateral). No está contraindicado: valora la gravedad de la reacción previa; si fue leve/no-anafiláctica suele poder usarse con vigilancia.`,
          textoNota: `${m.nombre}: reactividad cruzada baja con la alergia a ${fam.familia} referida. Se valoró el antecedente y se decidió su uso con vigilancia.`,
        })
      }
    }
  }
  return out
}

// ── 2. SEGURIDAD: dosis pediátrica contra el peso real ──────────────────────

/**
 * Extrae los miligramos de un texto de dosis.
 *
 * DELEGA en `extraerMg`, que es el parser de la frontera de texto y ya está
 * probado. Esto era una regex propia —la tercera del producto para el mismo
 * campo— y leía «45 mg/kg» como 45 mg: el copiloto le decía al médico que
 * había recetado 45 mg a un niño de 20 kg y que el rango era 250 a 500,
 * avisando de infradosis sobre una orden correcta. Tampoco entendía mcg, así
 * que se saltaba el renglón en silencio.
 */
export function mgDeTexto(dosis?: string): number | undefined {
  if (!dosis) return undefined
  return extraerMg(dosis) ?? undefined
}

function dosisPediatrica(e: EntradaCopiloto): Sugerencia[] {
  const edad = e.edad
  const peso = e.signos?.peso
  const meds = e.medicamentos ?? []
  if (edad == null || edad >= 18 || meds.length === 0) return []

  if (!peso || peso <= 0) {
    return [{
      id: 'ped:falta-peso',
      nivel: 'accion',
      titulo: 'Falta el peso para verificar las dosis',
      detalle: 'Es un paciente pediátrico con receta. Con el peso puedo comprobar cada dosis contra el rango por kilogramo y avisarte si alguna rebasa el tope de adulto.',
      textoNota: '',
      pide: 'peso',
    }]
  }

  const out: Sugerencia[] = []
  for (const m of meds) {
    const nm = norm(m.nombre ?? '')
    const f = FARMACOS_PED.find(x => nm.includes(norm(x.nombre)) || norm(x.nombre).includes(nm))
    if (!f) continue
    const d = calcularDosisPediatrica(f, peso)
    if (!d) continue

    /**
     * UNA DOSIS POR KILO NO SE COMPARA CONTRA UN RANGO ABSOLUTO.
     *
     * «45 mg/kg» y «450 mg» son cifras distintas de la misma orden. Compararlas
     * contra el rango por toma acusaba de infradosis a una receta correcta.
     * Tampoco se convierte multiplicando por el peso: mg/kg puede ser por toma o
     * por día, y eso no lo decide un archivo de software. Cuando la dosis viene
     * por kilo se MUESTRA el rango de referencia y no se emite juicio.
     */
    const porKilo = !!m.dosis && esDosisPorKg(m.dosis)
    const recetada = porKilo ? undefined : mgDeTexto(m.dosis)
    const excede = recetada != null && recetada > d.porToma.max * 1.05
    const corta = recetada != null && recetada < d.porToma.min * 0.95

    out.push({
      id: `ped:dosis:${f.nombre}`,
      nivel: excede ? 'critico' : 'accion',
      titulo: excede
        ? `${f.nombre}: la dosis recetada rebasa el rango para ${peso} kg`
        : `${f.nombre} para ${peso} kg`,
      detalle: excede
        ? `Recetaste ${recetada} ${d.unidad} por toma; para ${peso} kg el rango es ${d.porToma.min} a ${d.porToma.max} ${d.unidad} ${d.intervalo}${d.topeAplicado ? ' (ya con el tope de adulto aplicado)' : ''}.`
        : corta
          ? `Recetaste ${recetada} ${d.unidad}; el rango para ${peso} kg es ${d.porToma.min} a ${d.porToma.max} ${d.unidad} ${d.intervalo}. Verifica si es intencional.`
          : `${d.porToma.min === d.porToma.max ? d.porToma.max : `${d.porToma.min} a ${d.porToma.max}`} ${d.unidad} ${d.intervalo}${d.topeAplicado ? ' · ya con el tope de adulto' : ''}.`,
      textoNota: `${f.nombre}: ${d.porToma.min === d.porToma.max ? d.porToma.max : `${d.porToma.min}-${d.porToma.max}`} ${d.unidad} ${d.intervalo} para ${peso} kg${d.nota ? `. ${d.nota}` : ''}`,
    })
  }
  return out
}

// ── 3. SEGURIDAD: ajuste renal de lo recetado ───────────────────────────────

/**
 * Cómo se cita un laboratorio que puede no ser de hoy — REG-368.
 *
 * Una sola definición para los cuatro sitios que nombran un valor: si el número
 * vino del expediente, la frase lleva **cuándo se midió**; si lo dictó el médico
 * en esta consulta, va limpia.
 */
function citaDelLab(e: EntradaCopiloto, clave: string, texto: string): string {
  const cuando = e.labsMedidosEn?.[clave]
  const trayecto = e.labsTrayectoria?.[clave]
  /* Fecha primero, trayectoria después: «creatinina 2.4 mg/dL, medida el
     2026-07-14, subió desde 1.6 el 2026-01-10». Las dos son procedencia; la
     segunda sólo aparece si hay una medición anterior de verdad. */
  return `${texto}${cuando ? `, medida el ${cuando}` : ''}${trayecto ? `, ${trayecto}` : ''}`
}

function ajusteRenal(e: EntradaCopiloto): Sugerencia[] {
  const cr = e.labs?.creatinina
  const edad = e.edad
  const meds = e.medicamentos ?? []
  if (!cr || !edad || meds.length === 0) return []

  // GUARDA PEDIÁTRICA (NEXUS-QUALITY-004): CKD-EPI 2021 está validada SOLO en ≥18
  // años. En menores NO se calcula una TFG "adulta" ni se emiten contraindicaciones
  // basadas en ella (antes sí → una fórmula inaplicable contraindicaba fármacos en
  // niños). Se deriva a la fórmula pediátrica (Schwartz).
  if (edad < 18) {
    return [{
      id: 'renal:pediatrico',
      nivel: 'info',
      titulo: 'Ajuste renal pediátrico: CKD-EPI no aplica en < 18 años',
      detalle: 'La TFG por CKD-EPI 2021 está validada solo en adultos. En menores usa la fórmula de Schwartz (0.413 × talla_cm ÷ creatinina) para estimar la TFG y ajustar dosis.',
      textoNota: 'Ajuste renal en < 18 años: estimar TFG por Schwartz (no CKD-EPI).',
    }]
  }

  // GUARDA DE UNIDAD (auditoría P0): una creatinina fuera de mg/dL plausible (p.ej.
  // 88 en µmol/L) daría una TFG minúscula → falla renal fantasma y contraindicaciones
  // antibióticas falsas. No se estima; se pide revisar la unidad.
  if (!creatininaPlausibleMgDl(cr)) {
    return [{
      id: 'renal:unidad',
      nivel: 'info',
      titulo: `${citaDelLab(e, 'creatinina', `Creatinina ${cr}`)}: revisa la unidad (mg/dL)`,
      detalle: `Un valor fuera de 0.1–25 mg/dL suele venir en µmol/L (dividir entre 88.4) o ser un error de captura. No se estima TFG ni se ajustan dosis hasta corregir la unidad.`,
      textoNota: `Creatinina ${cr} fuera de rango en mg/dL — verificar unidad antes de ajustar por función renal.`,
    }]
  }
  // E0-05: la creatinina entra al motor CON SU UNIDAD. `mgPorDl` es legítimo aquí
  // porque el campo `labs.creatinina` está declarado en mg/dL en laboratorio/analitos.ts
  // y acaba de pasar la guarda de plausibilidad de esa misma unidad.
  const tfg = valorEn(ckdEpi2021(mgPorDl(cr), edad, !!e.sexo && /^f/i.test(e.sexo)), 'mL/min/1.73m²')
  if (!Number.isFinite(tfg) || tfg >= 60) return []

  const out: Sugerencia[] = []
  /**
   * ── LA CREATININA QUE SE PASÓ DE SU VENTANA (REG-375) ─────────────────────
   *
   * Va PRIMERO y no sustituye a nada: la política del dueño dice que no se
   * bloquee en silencio ni se invente función renal. Así que las
   * recomendaciones de abajo se siguen dando —con su fecha, desde REG-368— y
   * encima se dice que el dato está caduco y qué hace falta.
   *
   * Sólo aquí, que es donde se emite una recomendación de dosificación
   * dependiente del riñón. Un aviso de caducidad en una consulta que no
   * prescribe nada renal sería ruido.
   */
  if (e.funcionRenalVigente && !e.funcionRenalVigente.vigente) {
    out.push({
      id: 'renal:stale',
      nivel: 'accion',
      titulo: 'Función renal no vigente para dosificar',
      detalle: e.funcionRenalVigente.aviso,
      textoNota: '',
    })
  }
  for (const m of meds) {
    const nm = norm(m.nombre ?? '')
    /**
     * Guard de longitud — auditoría 2026-07 (P2). `revisarListaRenal` sí lo tenía
     * y aquí faltaba: con el nombre vacío o a medio teclear, el match por subcadena
     * casaba con el PRIMER fármaco del catálogo e inventaba una contraindicación de
     * metformina en quien no la toma.
     */
    if (nm.length < 3) continue
    // Casa también por PRINCIPIO ACTIVO: sin esto, «Ketorolaco» nunca encontraba la
    // entrada de clase «Antiinflamatorios no esteroideos» y la contraindicación con
    // TFG<30 era código muerto (auditoría 2026-07, P0).
    const f = AJUSTE_RENAL.find(x => coincideRenal(x, nm))
    if (!f) continue
    const a = ajustePorTFG(f, tfg)
    if (!a) continue
    out.push({
      id: `renal:${f.nombre}`,
      nivel: a.contraindicado ? 'critico' : 'accion',
      titulo: a.contraindicado
        ? `${f.nombre} está contraindicado con TFG de ${Math.round(tfg)}`
        : `${f.nombre} requiere ajuste con TFG de ${Math.round(tfg)}`,
      /* La TFG sale de una creatinina que puede no ser de hoy (REG-368). El
         aviso que cambia la conducta tiene que decir de cuándo es el número: sin
         eso afirma una vigencia que nadie comprobó, y es el aviso más grave que
         produce este motor. */
      detalle: `${a.conducta}${a.nota ? ` ${a.nota}` : ''}${
        e.labsMedidosEn?.creatinina ? ` TFG calculada con la creatinina del ${e.labsMedidosEn.creatinina}.` : ''}`,
      textoNota: `Con TFG estimada de ${Math.round(tfg)} mL/min/1.73 m² (CKD-EPI 2021, ${citaDelLab(e, 'creatinina', `creatinina ${cr} mg/dL`)}): ${f.nombre} — ${a.conducta}`,
    })
  }
  return out
}

// ── 4. SEGURIDAD: fármaco de riesgo en mujer en edad fértil ─────────────────

function riesgoGestacional(e: EntradaCopiloto): Sugerencia[] {
  const esMujer = !!e.sexo && /^f/i.test(e.sexo)
  const edad = e.edad
  if (!esMujer || edad == null || edad < 12 || edad > 50) return []
  // ¿El Dx/nota indican embarazo CONFIRMADO? Solo entonces se avisa de los
  // teratógenos categoría 'evitar' (estatinas/tetraciclinas/quinolonas/AINE): sin
  // esto se metería ruido en toda mujer en edad fértil. Los 'contraindicado' sí
  // avisan siempre (el riesgo de un embarazo no detectado pesa más).
  // OJO (icu-013): NO incluir 'puerper' (puerperio = posparto): la paciente YA NO
  // está embarazada, el feto nació. Marcar embarazo por un Dx de puerperio hacía que
  // los teratógenos categoría 'evitar' dispararan un aviso "La paciente cursa
  // embarazo" a una puérpera — incoherente. La lactancia es otra cosa (transferencia
  // a leche, no teratogenicidad) y tiene su propia lista, no este flag.
  /**
   * ── «CURSA EMBARAZO» ES UNA AFIRMACIÓN, Y SE GANA (REG-364) ───────────────
   *
   * Esto miraba sólo la descripción. Un `tipo:'descartado'` —«embarazo
   * descartado», que es como se documenta una prueba negativa— encendía el
   * aviso de categoría `evitar`, cuyo detalle dice literalmente **«La paciente
   * cursa embarazo»** y cuyo `textoNota` se puede insertar en la nota firmada.
   * Un descarte convertido en afirmación, dentro de un documento medicolegal.
   *
   * `problemasDelCuadro` ya no deja pasar los descartados, pero este motor no
   * puede depender de que su llamador filtre: quien afirma es él.
   *
   * Un `presuntivo` o un `diferencial` **sí** cuentan para AVISAR —el riesgo de
   * un embarazo no detectado pesa más—, pero no para afirmar: el texto lo dice
   * en condicional más abajo. Sin `tipo` se comporta como antes.
   *
   * Esto fue FALSO durante años: el código excluía el `diferencial`. Lo hizo
   * cierto la decisión del dueño del 31-ago-2026 (REG-591), y afecta a la rama
   * `evitar` —estatinas, tetraciclinas y doxiciclina, quinolonas, AINE—; los
   * `contraindicado` avisaban ya en cualquier paciente.
   */
  /* WS-09 — la lectura se mudó a `lo-que-el-expediente-dice-del-embarazo.ts`
     para que el motor de aplicabilidad no escriba una segunda. La CONDUCTA no
     cambia: `tratarComoEmbarazada` es esta misma línea, movida. */
  const lecturaEmbarazo = loQueElExpedienteDiceDelEmbarazo(e.diagnosticos)
  const dxGestacional = diagnosticosGestacionales(e.diagnosticos)
  const embarazoConfirmado = tratarComoEmbarazada(lecturaEmbarazo)
  /**
   * ¿Alguien lo dio por CIERTO? Decide si el aviso AFIRMA o sólo CITA la nota.
   *
   * `presuntivo` no cuenta como afirmación —es el valor de fábrica del esquema,
   * no un juicio (REG-365)— pero tampoco se lee como negación: cuando no consta,
   * el aviso dice lo que el expediente dice y no más.
   */
  const embarazoAfirmado = dxGestacional.some(d => d.tipo === undefined || d.tipo === 'definitivo')
  const coincide = (x: { farmaco: string; sinonimos?: string[] }, nm: string) =>
    (x.sinonimos ?? []).some(s => nm.includes(norm(s))) ||
    nm.includes(norm(x.farmaco)) ||
    norm(x.farmaco).split(/[ ,]/).some(w => w.length > 5 && nm.includes(w))

  const meds = e.medicamentos ?? []
  const out: Sugerencia[] = []
  for (const m of meds) {
    const nm = norm(m.nombre ?? '')
    if (!nm) continue
    const g = EMBARAZO_LACTANCIA.find(x =>
      (x.embarazo === 'contraindicado' || (x.embarazo === 'evitar' && embarazoConfirmado)) &&
      coincide(x, nm))
    if (!g) continue
    if (g.embarazo === 'contraindicado') {
      out.push({
        id: `gesta:${m.nombre}`,
        nivel: 'critico',
        titulo: `${m.nombre} está contraindicado en el embarazo`,
        // Correcto en ambos casos (el motor aún no sabe con certeza si hay embarazo):
        // si está embarazada → suspender; si no → descartar antes de prescribir.
        detalle: `${g.motivo}${g.alternativa ? ` Alternativa: ${g.alternativa}` : ''} Si la paciente está o pudiera estar embarazada, suspender de inmediato; si no, descarta embarazo antes de prescribir y comenta planeación/anticoncepción.`,
        textoNota: `Se comentó con la paciente que ${m.nombre} está contraindicado en el embarazo. ${g.motivo}`,
      })
    } else {
      // 'evitar' + embarazo confirmado: aviso de acción (cambiar), no crítico.
      out.push({
        id: `gesta:evitar:${m.nombre}`,
        nivel: 'accion',
        titulo: `${m.nombre}: evítalo en el embarazo`,
        /* Afirma sólo si alguien lo afirmó; si no, CITA el expediente. Lo que
           no puede hacer es dar por cierto un embarazo que nadie confirmó ni
           por falso uno que nadie descartó. */
        detalle: `${embarazoAfirmado ? 'La paciente cursa embarazo.' : 'Hay un embarazo registrado en la nota.'} ${g.motivo}${g.alternativa ? ` Alternativa: ${g.alternativa}` : ''}`,
        textoNota: `${m.nombre} debe evitarse en el embarazo; se comentó y se valoró una alternativa. ${g.motivo}`,
      })
    }
  }
  return out
}

// ── 5. SIGNOS VITALES QUE CRUZAN UMBRAL ─────────────────────────────────────

function signosDeAlarma(e: EntradaCopiloto): Sugerencia[] {
  const s = e.signos
  if (!s) return []
  const out: Sugerencia[] = []
  const tas = sistolica(s.ta)
  const tad = diastolica(s.ta)
  // icu-014: los umbrales de abajo (qSOFA, FC ≥120, TAS <90, TA 140/90–180/110) son
  // de ADULTO. En < 12 años los signos normales cambian con la edad (FC 100–160 en
  // lactantes, TAS más baja), así que aplicarlos genera falsas alarmas o falsa
  // tranquilidad. La SpO₂ < 90 (hipoxemia) y la fiebre SÍ son válidas a cualquier edad.
  const edad = e.edad
  const pediatrico = edad != null && edad < 12
  if (pediatrico && (s.fr != null || s.fc != null || tas != null)) {
    out.push({
      id: 'vital:pediatrico',
      nivel: 'info',
      titulo: 'Signos vitales pediátricos: interpreta por edad',
      detalle: 'Los umbrales de alarma de adulto (FC ≥120, TAS <90, qSOFA, 140/90) no aplican en < 12 años; los rangos normales dependen de la edad (PALS). Valora FC/FR/TA contra la tabla por edad.',
      textoNota: 'Signos vitales interpretados con umbrales pediátricos por edad (no de adulto).',
    })
  }

  // qSOFA: dos de los tres componentes son medibles con lo que ya hay. Si esos
  // dos ya suman 2, el puntaje YA es positivo — no puede bajar con el tercero.
  if (!pediatrico && s.fr != null && tas != null && s.fr >= 22 && tas <= 100) {
    out.push({
      id: 'vital:qsofa',
      nivel: 'critico',
      titulo: 'qSOFA ya es positivo con los signos capturados',
      detalle: `Frecuencia respiratoria ${s.fr} y sistólica ${tas}: dos criterios de qSOFA. Ante sospecha de infección, indica mayor riesgo de mortalidad y obliga a valorar sepsis y el nivel de atención.`,
      textoNota: `qSOFA positivo (FR ${s.fr}/min y TAS ${tas} mmHg). Se valora sepsis y nivel de atención.`,
    })
  }

  if (s.spo2 != null && s.spo2 < 90) {
    out.push({
      id: 'vital:hipoxemia',
      nivel: 'critico',
      titulo: `Hipoxemia: SpO₂ ${s.spo2}%`,
      detalle: 'Saturación por debajo de 90%. Requiere oxígeno suplementario y valorar el nivel de atención.',
      textoNota: `SpO₂ de ${s.spo2}% al aire ambiente. Se indica oxígeno suplementario y se valora el nivel de atención.`,
    })
  }

  if (!pediatrico && tas != null && tas < 90) {
    out.push({
      id: 'vital:hipotension',
      nivel: 'critico',
      titulo: `Hipotensión: sistólica ${tas} mmHg`,
      detalle: 'Presión sistólica por debajo de 90. Valora perfusión, causa y necesidad de reanimación con líquidos.',
      textoNota: `TA ${s.ta} mmHg. Se valora estado de perfusión y causa de la hipotensión.`,
    })
  }

  if (!pediatrico && tas != null && tad != null && (tas >= 180 || tad >= 110)) {
    out.push({
      id: 'vital:crisis-ht',
      nivel: 'critico',
      titulo: `Cifras de crisis hipertensiva: ${s.ta} mmHg`,
      detalle: 'Distingue urgencia de emergencia hipertensiva: busca daño agudo a órgano blanco (neurológico, cardiaco, renal, visual).',
      textoNota: `TA ${s.ta} mmHg. Se busca intencionadamente daño agudo a órgano blanco para distinguir urgencia de emergencia hipertensiva.`,
    })
  } else if (tas != null && tad != null && (tas >= 140 || tad >= 90) && (e.edad ?? 0) >= 18) {
    out.push({
      id: 'vital:ht',
      nivel: 'info',
      titulo: `Cifras elevadas: ${s.ta} mmHg`,
      detalle: 'Por arriba de 140/90. Una sola toma no diagnostica hipertensión: confirma con tomas repetidas o monitoreo ambulatorio.',
      textoNota: `TA ${s.ta} mmHg. Se indica confirmar con tomas seriadas antes de establecer el diagnóstico.`,
    })
  }

  if (!pediatrico && s.fc != null && s.fc >= 120) {
    out.push({
      id: 'vital:taquicardia',
      nivel: 'accion',
      titulo: `Taquicardia: ${s.fc} lpm`,
      detalle: 'Busca causa: fiebre, dolor, deshidratación, anemia, hipoxemia, arritmia o tirotoxicosis.',
      textoNota: `FC de ${s.fc} lpm. Se busca causa de la taquicardia.`,
    })
  }

  if (s.temperatura != null && s.temperatura >= 38) {
    out.push({
      id: 'vital:fiebre',
      nivel: 'info',
      titulo: `Fiebre: ${s.temperatura} °C`,
      detalle: 'Documenta foco infeccioso y tiempo de evolución.',
      textoNota: `Temperatura de ${s.temperatura} °C.`,
    })
  }
  return out
}

// ── 6. LO QUE SE PUEDE CALCULAR SOLO ────────────────────────────────────────

function calculosAutomaticos(e: EntradaCopiloto): Sugerencia[] {
  const out: Sugerencia[] = []
  const s = e.signos
  const edad = e.edad

  // IMC
  if (s?.peso && s?.talla) {
    const i = calcImc(s.peso, s.talla)
    if (Number.isFinite(i)) {
      const pediatrico = edad != null && edad < 18
      out.push({
        id: 'calc:imc',
        nivel: 'info',
        titulo: `IMC ${i}`,
        detalle: pediatrico
          ? 'En menores de 18 años el IMC se interpreta por percentil para edad y sexo, no por los cortes de adulto.'
          : `${clasificarIMC(i)}.`,
        textoNota: pediatrico
          ? `IMC ${i} kg/m² (a interpretar por percentil para edad y sexo).`
          : `IMC ${i} kg/m² — ${clasificarIMC(i)}.`,
      })
    }
  }

  // Función renal — CKD-EPI 2021 es una fórmula de ADULTOS. Auditoría 2026-07 (P1):
  // aplicarla a un niño/recién nacido daba una TFG falsamente normal y se ofrecía
  // pegarla a la nota. En <18 años se avisa, no se calcula (la TFG pediátrica usa
  // la fórmula de Schwartz con la TALLA, que no está en este flujo).
  if (e.labs?.creatinina && edad != null && edad < 18) {
    out.push({
      id: 'renal:pediatrico-tfg',
      nivel: 'info',
      titulo: 'TFG en menores de 18 años requiere fórmula pediátrica',
      detalle: 'CKD-EPI y Cockcroft-Gault son de adultos. En pediatría la estimación usa la fórmula de Schwartz con la talla; no se calcula aquí para no dar un valor engañoso.',
      textoNota: '',
    })
  } else if (e.labs?.creatinina && edad != null && creatininaPlausibleMgDl(e.labs.creatinina)) {
    const tfg = valorEn(ckdEpi2021(mgPorDl(e.labs.creatinina), edad, !!e.sexo && /^f/i.test(e.sexo)), 'mL/min/1.73m²')
    if (Number.isFinite(tfg)) {
      out.push({
        id: 'calc:tfg',
        nivel: tfg < 45 ? 'accion' : 'info',
        titulo: `TFG estimada ${Math.round(tfg)} mL/min/1.73 m²`,
        detalle: tfg < 60
          ? 'Por debajo de 60: revisa que todo lo que se elimina por riñón esté ajustado.'
          : 'Por CKD-EPI 2021, sin coeficiente de raza.',
        textoNota: `TFG estimada por CKD-EPI 2021: ${Math.round(tfg)} mL/min/1.73 m² (${citaDelLab(e, 'creatinina', `creatinina ${e.labs.creatinina} mg/dL`)}).`,
      })
    }
  }

  /**
   * POTASIO y SODIO críticos del dictado — auditoría 2026-07 (P2). El copiloto los
   * extraía (labsDesdeEstudios) y los TIRABA: ninguna alerta ambulatoria de hiper/
   * hipokalemia ni de disnatremia. Se reutilizan los umbrales YA auditados en
   * `lab-criticos.ts` (K 2.5–6.5 mEq/L, Na 120–160 mEq/L). No se inventan valores.
   */
  /**
   * RIESGO HEPÁTICO de fármacos — auditoría 2026-07 (P2). La capa `RIESGO_HEPATICO`
   * existía pero NO la consumía nadie. Se activa cuando el dx trae hepatopatía y
   * un fármaco recetado está en 'evitar' (AINE/benzodiacepinas en cirrosis, etc.).
   */
  const dxHep = norm((e.diagnosticos ?? []).map(d => d.descripcion).join(' · '))
  if (/cirrosis|hepatopat|insuficiencia hepatica|falla hepatica|encefalopat|hipertension portal|ascitis/.test(dxHep)) {
    for (const m of e.medicamentos ?? []) {
      const q = norm(m.nombre ?? '')
      if (q.length < 3) continue
      const h = RIESGO_HEPATICO.find(x => coincideHepatico(x, q))
      if (h && h.riesgo === 'evitar') {
        out.push({
          id: `hepatico:${m.nombre}`,
          nivel: 'accion',
          titulo: `${m.nombre}: evitar en hepatopatía`,
          detalle: h.motivo,
          textoNota: `${m.nombre}: se desaconseja en hepatopatía. ${h.motivo}`,
        })
      }
    }
  }

  const k = e.labs?.potasio
  if (typeof k === 'number' && k > 0) {
    if (k >= 6.5) out.push({ id: 'lab:k-alto', nivel: 'critico', titulo: `Potasio ${k} mEq/L: hiperkalemia crítica`, detalle: 'Riesgo de arritmia. ECG, suspender ahorradores de potasio/IECA-ARA-II y tratar según gravedad.', textoNota: `Potasio ${k} mEq/L (hiperkalemia crítica).` })
    else if (k <= 2.5) out.push({ id: 'lab:k-bajo', nivel: 'critico', titulo: `Potasio ${k} mEq/L: hipokalemia crítica`, detalle: 'Riesgo de arritmia y debilidad. Reponer y buscar causa (pérdidas, diuréticos).', textoNota: `Potasio ${k} mEq/L (hipokalemia crítica).` })
  }
  const na = e.labs?.sodio
  if (typeof na === 'number' && na > 0) {
    if (na >= 160) out.push({ id: 'lab:na-alto', nivel: 'accion', titulo: `Sodio ${na} mEq/L: hipernatremia`, detalle: 'Evaluar estado de volumen y corregir el déficit de agua a ritmo seguro.', textoNota: `Sodio ${na} mEq/L (hipernatremia).` })
    else if (na <= 120) out.push({ id: 'lab:na-bajo', nivel: 'accion', titulo: `Sodio ${na} mEq/L: hiponatremia`, detalle: 'Corrección a ritmo seguro (evitar >8–10 mEq/L en 24 h por riesgo de desmielinización). Definir volumen y osmolaridad.', textoNota: `Sodio ${na} mEq/L (hiponatremia).` })
  }

  // FIB-4 cuando los laboratorios ya están
  const { ast, alt, plaquetas } = e.labs ?? {}
  if (ast && alt && plaquetas && edad != null) {
    /**
     * UNIDADES: las plaquetas llegan en ×10⁹/L (panel: 135) o en conteo absoluto
     * (parser de labs: 135 000) según la fuente. Antes aquí se dividía SIEMPRE /1000,
     * lo que corregía la fuente absoluta pero ROMPÍA la que ya venía en ×10⁹/L
     * (135/1000 → FIB-4 ×1000, 3053 en vez de 3.05). Ahora fib4() detecta la unidad
     * por magnitud y normaliza sola — se pasan crudas. Auditoría maestra 2026-07 (P0).
     */
    const v = fib4(edad, ast, plaquetas, alt)
    const r = v != null ? interpretarFib4(v, edad) : null
    if (r) {
      out.push({
        id: 'calc:fib4',
        nivel: r.zona === 'alto' ? 'accion' : 'info',
        titulo: `FIB-4 ${r.valor} — ${r.zona === 'bajo' ? 'riesgo bajo' : r.zona === 'alto' ? 'riesgo alto de fibrosis' : 'zona indeterminada'}`,
        detalle: r.conducta,
        textoNota: `FIB-4 de ${r.valor}. ${r.interpretacion} ${r.conducta}`,
      })
    }
  }

  return out
}

// ── 7. METAS SEGÚN EL DIAGNÓSTICO ───────────────────────────────────────────

function metasPorDiagnostico(e: EntradaCopiloto): Sugerencia[] {
  const dx = norm((e.diagnosticos ?? []).map(d => d.descripcion).join(' · '))
  if (!dx) return []
  const out: Sugerencia[] = []

  const tieneDiabetes = /diabetes|dm2|dm 2|dm1/.test(dx)
  const tieneASCVD = /infarto|cardiopatia isquemica|angina|evc|isquemi|arteriopat|aterosclerosis|revasculariza/.test(dx)
  const tieneDislip = /dislipidemia|hipercolesterolemia|hipertriglicerid|colesterol/.test(dx)

  if (tieneDiabetes || tieneASCVD || tieneDislip) {
    /**
     * Auditoría 2026-07 (P1): antes se llamaba a metaLipidica SOLO con {diabetes,
     * ascvdClinica, tg}. Nunca se le pasaba el PREVENT ni los factores de riesgo,
     * así que la meta salía SIEMPRE la más laxa y la nota afirmaba «Diabetes SIN
     * factores de riesgo» sin haberlos interrogado. Ahora:
     *  - factoresRiesgo y erc se derivan del MISMO texto de diagnósticos.
     *  - preventPct se calcula de verdad (mismo motor que la tarjeta de riesgo).
     * Con esto la meta se ajusta al riesgo (ACC/AHA 2026, validado por el Dr):
     * PREVENT <3% → <130 · 3-<10% → <100 · ≥10% → <70 · ASCVD → <55/<70.
     */
    const factoresRiesgo = /hipertension|hta|tabaquismo|fumador|obesidad|sobrepeso|renal cronica|erc\b|sindrome metabolico|antecedente familiar/.test(dx)
    const erc = /renal cronica|erc\b|nefropat|insuficiencia renal/.test(dx)
    const tfg = (e.labs?.creatinina && e.edad != null && creatininaPlausibleMgDl(e.labs.creatinina))
      ? valorEn(ckdEpi2021(mgPorDl(e.labs.creatinina), e.edad, !!e.sexo && /^f/i.test(e.sexo)), 'mL/min/1.73m²') : 0
    const prev = prevent({
      edad: e.edad ?? 0, esMujer: !!e.sexo && /^f/i.test(e.sexo),
      tas: sistolica(e.signos?.ta) ?? 0,
      colesterolTotal: e.labs?.colesterolTotal ?? 0, hdl: e.labs?.hdl ?? 0,
      tfg: tfg || (e.labs?.tfg ?? 0),
      diabetes: tieneDiabetes, fuma: /tabaquismo|fumador|fuma/.test(dx),
      tomaAntihipertensivo: false, tomaEstatina: false,
    })
    const meta = metaLipidica({
      diabetes: tieneDiabetes, ascvdClinica: tieneASCVD, tg: e.labs?.trigliceridos,
      factoresRiesgo, erc, preventPct: prev?.riesgo10, edad: e.edad,
      hipercolesterolemiaSevera: (e.labs?.ldl ?? 0) >= 190,
    })
    const ldl = e.labs?.ldl
    out.push({
      id: 'meta:ldl',
      nivel: ldl != null && ldl > meta.ldl ? 'accion' : 'info',
      titulo: `Meta de LDL-C: menos de ${meta.ldl} mg/dL`,
      detalle: ldl != null
        ? (ldl > meta.ldl
            ? `Está en ${ldl}: faltan ${Math.round(ldl - meta.ldl)} mg/dL. ${meta.poblacion}.`
            : `Está en ${ldl}, dentro de meta. ${meta.poblacion}.`)
        : `${meta.poblacion}. Con el LDL puedo decirte cuánto falta.`,
      textoNota: `Meta de LDL-C menor de ${meta.ldl} mg/dL y no-HDL-C menor de ${meta.noHDL} mg/dL (${meta.poblacion}), según la guía ACC/AHA 2026.`,
      pide: ldl == null ? 'LDL' : undefined,
    })

    /**
     * ¿A quién indicar estatina? (guía ACC/AHA 2026, imagen validada por el Dr).
     * Recomienda la INTENSIDAD por escenario, no solo la meta. Solo se muestra
     * cuando ya está indicada de forma clara (no en «individualizar/no-de-rutina»,
     * para no empujar estatina sin criterio).
     */
    const rec = recomendarEstatina({
      edad: e.edad, ldl, preventPct: prev?.riesgo10, prevent30Pct: prev?.riesgo30 ?? undefined,
      ascvdClinica: tieneASCVD, diabetes: tieneDiabetes, diabetesMultiplesFR: tieneDiabetes && factoresRiesgo,
      ercEstadio3o4: erc, potenciadores: factoresRiesgo,
    })
    if (rec.indicar === 'alta' || rec.indicar === 'moderada' || rec.indicar === 'considerar-moderada') {
      const alta = rec.indicar === 'alta'
      out.push({
        id: 'meta:estatina',
        nivel: 'info',
        titulo: alta ? 'Corresponde estatina de ALTA intensidad' : rec.indicar === 'moderada' ? 'Corresponde estatina de intensidad moderada' : 'Considerar estatina moderada',
        detalle: `${rec.motivo}${alta ? ' Preferidas: atorvastatina 40–80 mg o rosuvastatina 20–40 mg (reducción de LDL-C ≥50%).' : rec.indicar === 'moderada' ? ' Preferidas: atorvastatina 10–20 mg o rosuvastatina 5–10 mg (reducción 30–49%).' : ''}`,
        textoNota: `${rec.motivo} (guía ACC/AHA 2026).`,
      })
    }
  }

  // MASLD (antes «hígado graso no alcohólico»): el tamizaje con FIB-4 se hace
  // aunque las enzimas estén normales.
  if ((tieneDiabetes || /obesidad|sobrepeso|higado graso|esteatosis/.test(dx)) && !(e.labs?.ast && e.labs?.alt && e.labs?.plaquetas)) {
    out.push({
      id: 'meta:fib4-tamizaje',
      nivel: 'info',
      titulo: 'Corresponde tamizar esteatosis hepática metabólica (MASLD) con FIB-4',
      detalle: 'La ADA lo indica anual en diabetes tipo 2, prediabetes u obesidad con factor cardiovascular, AUNQUE las enzimas hepáticas estén normales: la mayoría de quienes tienen fibrosis significativa las tiene normales.',
      textoNota: 'Se solicita AST, ALT y plaquetas para calcular FIB-4 como tamizaje de fibrosis hepática (ADA, Standards of Care 2026).',
      pide: 'AST, ALT y plaquetas',
    })
  }

  return out
}

// ── 8. RIESGO CARDIOVASCULAR (PREVENT) ──────────────────────────────────────

/**
 * La guía ACC/AHA 2026 pide estimar el riesgo con PREVENT en prevención
 * primaria de 30 a 79 años. No se le pregunta nada al médico: si los datos ya
 * están en la nota se calcula, y si falta alguno se dice cuál en una línea.
 */
function riesgoCardiovascular(e: EntradaCopiloto): Sugerencia[] {
  const dx = norm((e.diagnosticos ?? []).map(d => d.descripcion).join(' · '))
  // En prevención SECUNDARIA no aplica: ahí la meta ya la fija el evento previo.
  if (/infarto|cardiopatia isquemica|angina|evc|isquemi|arteriopat|revasculariza/.test(dx)) return []
  if (e.edad == null || e.edad < 30 || e.edad > 79) return []

  /**
   * E0-05 — HUECO CERRADO (único cambio de comportamiento de la unidad).
   *
   * Los otros tres call sites de ckdEpi2021 de este archivo (:270, :493, :598) ya
   * filtraban con `creatininaPlausibleMgDl`; éste NO. Una creatinina de 88 (que es
   * un valor NORMAL en µmol/L) entraba cruda, salía una TFG de ~5 mL/min/1.73 m² y
   * alimentaba el riesgo PREVENT — un riesgo cardiovascular calculado sobre un dato
   * basura, sin avisar. Ahora se filtra igual que en :598: con creatinina
   * implausible, PREVENT recibe tfg=0 y devuelve null (prevent.ts), es decir,
   * DECLARA el dato faltante en vez de inventar un riesgo.
   */
  const tfg = e.labs?.tfg ?? (e.labs?.creatinina && e.edad && creatininaPlausibleMgDl(e.labs.creatinina)
    ? valorEn(ckdEpi2021(mgPorDl(e.labs.creatinina), e.edad, !!e.sexo && /^f/i.test(e.sexo)), 'mL/min/1.73m²')
    : undefined)

  const entrada = {
    edad: e.edad,
    esMujer: !!e.sexo && /^f/i.test(e.sexo),
    tas: sistolica(e.signos?.ta) ?? 0,
    colesterolTotal: e.labs?.colesterolTotal ?? 0,
    hdl: e.labs?.hdl ?? 0,
    tfg: tfg ?? 0,
    diabetes: /diabetes|dm2|dm 2|dm1/.test(dx),
    fuma: /tabaquismo|fumador|fuma/.test(dx),
    /**
     * Auditoría 2026-07 (P1): la lista sólo tenía 9 fármacos y dejaba fuera los más
     * recetados en México. Un paciente con irbesartán, captopril, bisoprolol,
     * carvedilol o nifedipino contaba como NO tratado y PREVENT SUBESTIMABA su
     * riesgo cardiovascular. Se completa por CLASE (ARA-II, IECA, calcioantagonistas,
     * betabloqueadores, diuréticos); es clasificación factual de fármacos, no un
     * cambio de umbrales ni de la fórmula.
     */
    tomaAntihipertensivo: (e.medicamentos ?? []).some(m =>
      /losartan|telmisartan|valsartan|irbesartan|candesartan|olmesartan|azilsartan|eprosartan/
        .test(norm(m.nombre ?? '')) ||
      /enalapril|lisinopril|captopril|ramipril|perindopril|quinapril|benazepril|fosinopril|trandolapril/
        .test(norm(m.nombre ?? '')) ||
      /amlodipino|nifedipino|felodipino|nitrendipino|lercanidipino|verapamilo|diltiazem/
        .test(norm(m.nombre ?? '')) ||
      /metoprolol|bisoprolol|carvedilol|atenolol|nebivolol|propranolol|labetalol/
        .test(norm(m.nombre ?? '')) ||
      /hidroclorotiazida|clortalidona|indapamida|espironolactona|eplerenona|furosemida/
        .test(norm(m.nombre ?? ''))),
    tomaEstatina: (e.medicamentos ?? []).some(m =>
      /atorvastatina|rosuvastatina|simvastatina|pravastatina|pitavastatina|lovastatina|fluvastatina/
        .test(norm(m.nombre ?? ''))),
  }

  const r = prevent(entrada)
  if (!r) {
    // No se pide en cualquier consulta: en una faringitis, pedir colesterol y
    // TFG para estimar riesgo cardiovascular es justo el ruido que hace que las
    // alertas dejen de leerse. Solo cuando el propio caso ya lo justifica.
    const pertinente = /diabetes|dm2|dm 2|hipertension|hta|dislipidemia|colesterol|obesidad|sobrepeso|tabaquismo|fumador|sindrome metabolico|renal cronica/.test(dx)
    if (!pertinente) return []
    const falta = motivoSinPrevent(entrada)
    if (!falta) return []
    return [{
      id: 'prevent:falta',
      nivel: 'info',
      titulo: 'Se puede estimar el riesgo cardiovascular a 10 años',
      detalle: `La guía 2026 lo pide en prevención primaria de 30 a 79 años. Con ${falta} lo calculo y te digo la meta de LDL que le corresponde.`,
      textoNota: '',
      pide: falta,
    }]
  }

  return [{
    id: 'prevent:riesgo',
    nivel: r.categoria === 'alto' ? 'accion' : 'info',
    titulo: `PREVENT-ASCVD a 10 años: ${r.riesgo10}% — ${r.etiqueta.replace(/ \(.*/, '')}`,
    detalle: r.conducta + (r.riesgo30 != null ? ` Riesgo a 30 años: ${r.riesgo30}%.` : ''),
    textoNota: `Riesgo de ASCVD a 10 años por las ecuaciones PREVENT: ${r.riesgo10}% (${r.etiqueta.replace(/ \(.*/, '').toLowerCase()})${r.riesgo30 != null ? `, y ${r.riesgo30}% a 30 años` : ''}. ${r.conducta} Fuente: ${r.fuente}.`,
  }]
}

// ── ORQUESTADOR ─────────────────────────────────────────────────────────────

const ORDEN: Record<NivelSugerencia, number> = { critico: 0, accion: 1, info: 2 }

/**
 * Devuelve lo relevante para ESTE paciente, ordenado por lo que puede dañarlo.
 * Una consulta sin hallazgos devuelve arreglo vacío, y entonces no se pinta nada.
 */
export function copiloto(e: EntradaCopiloto): Sugerencia[] {
  const todas = [
    ...alergiaVsReceta(e),
    ...riesgoGestacional(e),
    ...dosisPediatrica(e),
    ...ajusteRenal(e),
    ...signosDeAlarma(e),
    ...calculosAutomaticos(e),
    ...metasPorDiagnostico(e),
    ...riesgoCardiovascular(e),
  ]
  // Sin duplicados por id, y lo grave primero.
  const vistos = new Set<string>()
  return todas
    .filter(s => (vistos.has(s.id) ? false : (vistos.add(s.id), true)))
    .sort((a, b) => ORDEN[a.nivel] - ORDEN[b.nivel])
}

/** Junta en un solo texto lo que el médico decida documentar. */
export function textoParaNota(sugerencias: Sugerencia[]): string {
  return sugerencias.map(s => s.textoNota).filter(Boolean).join('\n')
}
