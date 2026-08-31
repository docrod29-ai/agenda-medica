/**
 * Farmacovigilancia para la receta — seguridad clínica + cumplimiento COFEPRIS.
 *
 * Dos chequeos deterministas que corren sobre los medicamentos de la receta
 * (el artefacto que realmente se dispensa):
 *
 *  1. detectarInteracciones() — pares de fármacos con interacción clínicamente
 *     relevante (curados, no exhaustivos). Apoyo decisional, no sustituye juicio.
 *  2. detectarControlados() — fármacos controlados según el Reglamento de
 *     Insumos para la Salud / COFEPRIS, con su Fracción y el requisito de
 *     receta especial. Cierra el hueco regulatorio detectado en la auditoría.
 *
 * Diseño: normalización sin tildes/minúsculas + matching por nombre genérico
 * y marcas comerciales MX comunes. Sin dependencias externas, testeable.
 */

export interface AlertaFarmaco {
  severidad: 'mayor' | 'moderada' | 'menor'
  titulo: string
  detalle: string
}

export interface ControladoDetectado {
  farmaco: string
  fraccion: 'I' | 'II' | 'III' | 'IV' | 'V'
  requisito: string
}

function norm(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// ─────────────────────────────────────────────────────────────────
// 1. INTERACCIONES FÁRMACO-FÁRMACO (curadas, alto valor clínico)
//    Cada regla: si AMBOS grupos están presentes en la receta → alerta.
// ─────────────────────────────────────────────────────────────────

interface ReglaInteraccion {
  a: string[]            // términos del fármaco A (genérico o marca, normalizados)
  b: string[]            // términos del fármaco B
  severidad: AlertaFarmaco['severidad']
  titulo: string
  detalle: string
}

const REGLAS: ReglaInteraccion[] = [
  {
    /**
     * Auditoría 2026-07 (P1): la regla se llama "Anticoagulante + AINE" pero sólo
     * listaba antagonistas de vitamina K. Ningún ANTICOAGULANTE ORAL DIRECTO
     * (apixabán, rivaroxabán, dabigatrán, edoxabán) la disparaba, y hoy son los más
     * prescritos en fibrilación auricular. Se completa la lista para que la regla
     * cubra lo que su propio título promete; no se cambió su severidad ni su texto.
     */
    a: ['warfarina', 'acenocumarol', 'coumadin', 'sintrom',
        'apixaban', 'apixabán', 'eliquis',
        'rivaroxaban', 'rivaroxabán', 'xarelto',
        'dabigatran', 'dabigatrán', 'pradaxa',
        'edoxaban', 'edoxabán', 'lixiana',
        // HBPM y heparina — auditoría 2026-07 (P2): faltaban.
        'enoxaparina', 'clexane', 'dalteparina', 'tinzaparina', 'nadroparina', 'bemiparina',
        'fondaparinux', 'heparina',
        // Antiagregantes — también aumentan el sangrado con AINE.
        'clopidogrel', 'prasugrel', 'ticagrelor'],
    b: ['ibuprofeno', 'naproxeno', 'ketorolaco', 'diclofenaco', 'aspirina', 'aine', 'meloxicam', 'celecoxib'],
    severidad: 'mayor',
    titulo: 'Anticoagulante o antiagregante + AINE',
    detalle: 'Riesgo elevado de sangrado (gastrointestinal y otros). Preferir paracetamol; si es indispensable el AINE, gastroprotección y monitoreo de INR.',
  },
  {
    a: ['warfarina', 'acenocumarol'],
    b: ['fluconazol', 'metronidazol', 'trimetoprim', 'sulfametoxazol', 'ciprofloxacino', 'amiodarona'],
    severidad: 'mayor',
    titulo: 'Warfarina + inhibidor de su metabolismo',
    detalle: 'Aumenta el efecto anticoagulante (riesgo de sangrado). Vigilar INR estrechamente o elegir antibiótico/antifúngico alternativo.',
  },
  {
    a: ['sertralina', 'fluoxetina', 'paroxetina', 'escitalopram', 'citalopram', 'venlafaxina', 'duloxetina', 'isrs'],
    b: ['tramadol', 'linezolid', 'fentanilo', 'meperidina', 'petidina'],
    severidad: 'mayor',
    titulo: 'Serotoninérgico + serotoninérgico',
    detalle: 'Riesgo de síndrome serotoninérgico. Linezolid + ISRS es contraindicado. Con tramadol, vigilar y usar dosis baja.',
  },
  {
    a: ['claritromicina', 'eritromicina', 'azitromicina', 'itraconazol', 'ketoconazol'],
    b: ['atorvastatina', 'simvastatina', 'lovastatina', 'estatina'],
    severidad: 'mayor',
    titulo: 'Macrólido/azol + estatina',
    detalle: 'Riesgo de rabdomiólisis por aumento de niveles de la estatina. Suspender la estatina durante el antibiótico o usar pravastatina/rosuvastatina.',
  },
  {
    a: ['enalapril', 'lisinopril', 'ramipril', 'captopril', 'losartan', 'telmisartan', 'valsartan', 'ieca', 'ara'],
    b: ['espironolactona', 'eplerenona', 'amilorida'],
    severidad: 'moderada',
    titulo: 'IECA/ARA-II + diurético ahorrador de potasio',
    detalle: 'Riesgo de hiperkalemia. Vigilar potasio y función renal, sobre todo en ERC o diabéticos.',
  },
  {
    a: ['metformina'],
    b: ['medio de contraste', 'contraste yodado', 'iohexol', 'iopamidol'],
    severidad: 'moderada',
    titulo: 'Metformina + contraste yodado',
    detalle: 'Riesgo de acidosis láctica si hay deterioro renal. Suspender metformina al usar contraste y reanudar 48h después con función renal normal.',
  },
  {
    a: ['digoxina'],
    b: ['amiodarona', 'verapamilo', 'claritromicina', 'espironolactona'],
    severidad: 'mayor',
    titulo: 'Digoxina + inhibidor de su eliminación',
    detalle: 'Aumenta niveles de digoxina (riesgo de toxicidad). Reducir dosis y monitorear digoxinemia.',
  },
  {
    a: ['clopidogrel'],
    b: ['omeprazol', 'esomeprazol'],
    severidad: 'moderada',
    titulo: 'Clopidogrel + omeprazol/esomeprazol',
    detalle: 'Reduce la activación de clopidogrel (menor efecto antiplaquetario). Preferir pantoprazol si se requiere IBP.',
  },
  {
    a: ['alopurinol'],
    b: ['azatioprina', 'mercaptopurina'],
    severidad: 'mayor',
    titulo: 'Alopurinol + azatioprina/mercaptopurina',
    detalle: 'Toxicidad medular grave por acumulación. Reducir la tiopurina al 25% o evitar la combinación.',
  },
  {
    a: ['litio'],
    b: ['ibuprofeno', 'naproxeno', 'aine', 'enalapril', 'losartan', 'hidroclorotiazida'],
    severidad: 'mayor',
    titulo: 'Litio + AINE / IECA-ARA / tiazida',
    detalle: 'Aumenta niveles de litio (riesgo de toxicidad). Vigilar litemia y función renal.',
  },
]

export function detectarInteracciones(medicamentos: readonly { nombre?: string }[]): AlertaFarmaco[] {
  const nombres = medicamentos.map(m => norm(m.nombre ?? '')).filter(Boolean)
  if (nombres.length < 2) return []
  /**
   * FALSO POSITIVO que esto cierra (auditoría 2026-07, P2 — lo hallaron TRES
   * auditores): el término 'ara' (por ARA-II) casaba por subcadena dentro de
   * «par-ARA-cetamol», así que un paciente con paracetamol + espironolactona
   * recibía una alerta de hiperkalemia falsa. Las alertas falsas son caras: enseñan
   * al médico a ignorar el panel, y entonces la verdadera tampoco se lee.
   *
   * Criterio: los términos CORTOS (≤4) son abreviaturas de clase ('ara', 'ieca',
   * 'isrs', 'aine') y deben aparecer como PALABRA COMPLETA. Los largos son raíces
   * de principio activo y siguen casando por subcadena, para no perder sensibilidad
   * (p. ej. 'estatina' debe seguir atrapando «rosuvastatina», que no está listada).
   */
  const casa = (n: string, t: string) =>
    t.length <= 4
      ? new RegExp(`(^|[^a-z0-9])${t}([^a-z0-9]|$)`).test(n)
      : n.includes(t)
  const tiene = (terminos: string[]) => terminos.some(t => nombres.some(n => casa(n, t)))
  const alertas: AlertaFarmaco[] = []
  for (const r of REGLAS) {
    if (tiene(r.a) && tiene(r.b)) {
      alertas.push({ severidad: r.severidad, titulo: r.titulo, detalle: r.detalle })
    }
  }
  return alertas
}

/**
 * ── LAS INTERACCIONES DEL PACIENTE, NO LAS DE LA RECETA DE HOY ──────────────
 *
 * REG-188 encontró que los motores clínicos recibían **sólo la receta de hoy** y
 * lo escribió con este ejemplo: *«paciente con warfarina de marzo al que hoy se
 * le receta ketorolaco: la regla de sangrado existe y está probada, y no
 * dispara»*. La reparación creó `cuadro-completo` y lo llevó al copiloto, a la
 * evidencia, a la vigencia renal y a la reconciliación.
 *
 * **A la barra de avisos no.** Siguió llamando `detectarInteracciones(medicamentos)`
 * con la lista de hoy — o sea que el escenario exacto que REG-188 nombra, en la
 * superficie donde el médico mira antes de firmar, seguía sin disparar. Es la
 * familia «escrito y sin conectar» sobre una reparación anterior: el arreglo
 * llegó a cuatro consumidores y no al quinto, que era el que enseñaba el aviso.
 *
 * ── POR QUÉ NO BASTA CON PASARLE LA LISTA LARGA ─────────────────────────────
 *
 * Porque entonces una interacción entre dos fármacos que el paciente lleva
 * tomando años saldría **en cada consulta**, para siempre, junto a la que se
 * acaba de crear. Y este archivo ya aprendió lo que cuesta eso: *«las alertas
 * falsas son caras: enseñan al médico a ignorar el panel, y entonces la
 * verdadera tampoco se lee»*. Una alerta verdadera pero repetida hasta el
 * cansancio hace el mismo daño.
 *
 * Así que se separa lo que **cambia hoy** de lo que ya venía, corriendo el mismo
 * detector sobre dos subconjuntos. Sin motor nuevo y sin heurística: si la
 * interacción ya salía con la medicación previa sola, no la introduce esta
 * consulta.
 */
export interface InteraccionDelCuadro extends AlertaFarmaco {
  /**
   * ¿La crea lo que se prescribe HOY?
   *
   * `false` no significa «menos grave»: significa que ya existía antes de esta
   * consulta y que el médico probablemente ya la conoce. Lo que cambia es cuánto
   * tiene que gritar, no si se dice.
   */
  introducidaHoy: boolean
}

export function interaccionesDelCuadro(
  cuadro: readonly { nombre?: string; deHoy?: boolean }[],
): InteraccionDelCuadro[] {
  const previos = cuadro.filter(m => !m.deHoy)
  /* Las que ya salían SIN lo de hoy: ésas no las introduce esta consulta. */
  const yaEstaban = new Set(detectarInteracciones(previos).map(a => a.titulo))
  return detectarInteracciones(cuadro).map(a => ({ ...a, introducidaHoy: !yaEstaban.has(a.titulo) }))
}

// ─────────────────────────────────────────────────────────────────
// 2. CONTROLADOS COFEPRIS (Reglamento de Insumos para la Salud)
//    Fracción I  — estupefacientes (receta especial con código de barras)
//    Fracción II — psicotrópicos (receta especial / con folio)
//    III-V       — retención de receta según fracción
// ─────────────────────────────────────────────────────────────────

interface ReglaControlado { terminos: string[]; fraccion: ControladoDetectado['fraccion'] }

const CONTROLADOS: ReglaControlado[] = [
  // Fracción I — estupefacientes
  { terminos: ['morfina', 'fentanilo', 'fentanil', 'oxicodona', 'hidromorfona', 'metadona', 'meperidina', 'petidina', 'buprenorfina', 'tapentadol', 'nalbufina', 'oxicontin', 'durogesic'], fraccion: 'I' },
  // Fracción II — psicotrópicos
  { terminos: ['alprazolam', 'tafil', 'clonazepam', 'rivotril', 'diazepam', 'valium', 'lorazepam', 'ativan', 'bromazepam', 'lexotan', 'midazolam', 'triazolam', 'flunitrazepam', 'zolpidem', 'tramadol', 'tramacet', 'codeina', 'fenobarbital', 'metilfenidato', 'lisdexanfetamina', 'tapentadol', 'ketamina', 'pregabalina', 'lyrica'], fraccion: 'II' },
  // Fracción III — productos que contienen estupefacientes en bajas dosis
  { terminos: ['codeina/paracetamol', 'butalbital'], fraccion: 'III' },
]

const REQUISITO_POR_FRACCION: Record<ControladoDetectado['fraccion'], string> = {
  I: 'Estupefaciente (Fracción I): requiere RECETA ESPECIAL con código de barras emitida por COFEPRIS. Verifica folio y conserva copia.',
  II: 'Psicotrópico (Fracción II): requiere receta especial con folio. Se retiene una copia. Anota cantidad con letra.',
  III: 'Fracción III: receta común que se retiene en la farmacia. Conserva registro.',
  IV: 'Fracción IV: receta común; puede surtirse varias veces dentro de su vigencia.',
  V: 'Fracción V: venta libre / sin requisito especial de receta.',
}

export function detectarControlados(medicamentos: readonly { nombre?: string }[]): ControladoDetectado[] {
  const out: ControladoDetectado[] = []
  const vistos = new Set<string>()
  for (const m of medicamentos) {
    const n = norm(m.nombre ?? '')
    if (!n) continue
    for (const c of CONTROLADOS) {
      if (c.terminos.some(t => n.includes(t))) {
        const clave = `${m.nombre}|${c.fraccion}`
        if (vistos.has(clave)) continue
        vistos.add(clave)
        out.push({ farmaco: m.nombre ?? '', fraccion: c.fraccion, requisito: REQUISITO_POR_FRACCION[c.fraccion] })
        break  // un fármaco, una fracción (la primera que coincida)
      }
    }
  }
  return out
}
