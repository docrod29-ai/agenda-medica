/**
 * DATASET DE DOSIFICACIÓN V2 — la fuente de verdad, sin retipear una cifra.
 *
 * Entregado por el Dr. el 30-jul-2026: `Ausculta_UCI_Drug_Dosing_V2_REAL_DOSING.json`,
 * 54 fármacos de adulto hospital/UCI con sus ramas renal, de reemplazo renal y de
 * paciente crítico, más 12 reglas duras globales y 8 fuentes citadas.
 *
 * ── POR QUÉ EL JSON ENTRA TAL CUAL Y NO SE COPIA A MANO ──────────────────────
 *
 * Porque copiar una dosis a mano es exactamente donde se pierde una dosis. Hoy
 * mismo se descubrió que el corrector de voz se comía el «dos» de «Meropenem dos
 * gramos» y llevaba meses haciéndolo. Un número que pasa por unos dedos o por una
 * expresión regular puede salir distinto del que entró, y aquí eso es una orden
 * médica.
 *
 * Así que el archivo se copia BYTE A BYTE y su huella queda anclada en un test:
 * si alguien edita una dosis dentro del repo, el CI se cae. Corregir el dataset
 * se hace en el origen y se vuelve a importar, con su huella nueva a la vista en
 * el diff.
 *
 * ── LO QUE ESTE MÓDULO NO HACE ───────────────────────────────────────────────
 *
 * No interpreta, no calcula y no elige. Sólo carga, tipa y describe. La selección
 * de rama vive en `motor.ts` y la validación clínica es del médico.
 */

import bruto from '@/lib/dosing/data/dosing-v2.json'

/* ════════════════════════════════════════════════════════════════════════
   Tipos
   ════════════════════════════════════════════════════════════════════════ */

/** Una fuente citada. `verified` es la fecha que declara el dataset. */
export interface FuenteDosis {
  title: string
  url: string
  type: string
  verified: string
}

/**
 * Un fármaco del dataset.
 *
 * Las cuatro reglas (`dose_rule`, `renal_rule`, `rrt_rule`, `critical_care_rule`)
 * son **prosa**, no campos numéricos. El motor las selecciona y las devuelve
 * literales: convertirlas en ramas de código sería transcribir, y transcribir es
 * lo que hay que evitar.
 */
export interface FarmacoDosis {
  drug: string
  class: string
  adult_scope: boolean
  status: string
  dose_rule: string
  renal_rule: string
  rrt_rule: string
  critical_care_rule: string
  monitoring: string
  hard_stops: string
  notes: string
  source_ids: string[]
  tags: string[]
}

export interface DatasetDosis {
  title: string
  version: string
  release_date: string
  scope: string
  important_limitations: string[]
  required_inputs: string[]
  global_hard_stops: string[]
  sources: Record<string, FuenteDosis>
  drugs: FarmacoDosis[]
  claude_contract: {
    source_of_truth: string
    algorithm: string[]
    if_no_exact_match: string
    output_fields: string[]
  }
}

export const DATASET = bruto as unknown as DatasetDosis

/* ════════════════════════════════════════════════════════════════════════
   Estado de validación
   ════════════════════════════════════════════════════════════════════════ */

/**
 * El dataset se marca a sí mismo `VERIFIED_NUMERIC_CORE` en los 54 fármacos.
 *
 * Eso describe **el origen del dato**, no que un médico de esta app lo haya
 * revisado. Son cosas distintas y la pantalla no puede confundirlas: una dice
 * «viene de UCSF», la otra dice «el Dr. lo comprobó».
 *
 * Mientras no haya lo segundo, toda salida del motor viaja marcada
 * `sin_validar`, y la pantalla lo dice. El Dr. valida fármaco por fármaco; el
 * registro de esa validación es suyo, no del dataset.
 */
export type EstadoValidacion = 'sin_validar' | 'validado_por_medico'

export const AVISO_SIN_VALIDAR =
  'Regla tomada del dataset de dosificación, TODAVÍA SIN VALIDAR por el médico de ' +
  'este consultorio. El dataset cita su fuente y su fecha, pero esa etiqueta ' +
  'describe de dónde viene el dato, no que alguien de aquí lo haya comprobado. ' +
  'Verifique contra la fuente antes de indicar.'

/* ════════════════════════════════════════════════════════════════════════
   Acceso
   ════════════════════════════════════════════════════════════════════════ */

const norm = (s: string) =>
  s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/**
 * Índice por nombre, incluyendo los nombres en español que usa la app.
 *
 * El dataset viene en inglés (`Vancomycin IV`) y la app dicta en español
 * («vancomicina»). El puente se declara A MANO abajo: emparejar por parecido
 * sería la sustitución fonética que ya causó daño hoy.
 */
const ALIAS_ES: Readonly<Record<string, string>> = {
  aciclovir: 'Acyclovir IV', amikacina: 'Amikacin',
  'anfotericina b liposomal': 'Amphotericin B liposomal (AmBisome)',
  ampicilina: 'Ampicillin', 'ampicilina/sulbactam': 'Ampicillin/sulbactam',
  azitromicina: 'Azithromycin', aztreonam: 'Aztreonam', cefazolina: 'Cefazolin',
  cefepime: 'Cefepime', cefiderocol: 'Cefiderocol', ceftarolina: 'Ceftaroline',
  ceftazidima: 'Ceftazidime', 'ceftazidima/avibactam': 'Ceftazidime/avibactam',
  'ceftolozano/tazobactam': 'Ceftolozane/tazobactam', ceftriaxona: 'Ceftriaxone',
  ciprofloxacino: 'Ciprofloxacin', clindamicina: 'Clindamycin',
  daptomicina: 'Daptomycin', doxiciclina: 'Doxycycline', ertapenem: 'Ertapenem',
  fluconazol: 'Fluconazole', flucitosina: 'Flucytosine', ganciclovir: 'Ganciclovir IV',
  gentamicina: 'Gentamicin', 'imipenem/cilastatina': 'Imipenem/cilastatin',
  isavuconazol: 'Isavuconazonium/isavuconazole', levofloxacino: 'Levofloxacin',
  linezolid: 'Linezolid', meropenem: 'Meropenem', metronidazol: 'Metronidazole',
  micafungina: 'Micafungin', minociclina: 'Minocycline',
  'piperacilina/tazobactam': 'Piperacillin/tazobactam',
  posaconazol: 'Posaconazole IV/DR tablet', tigeciclina: 'Tigecycline',
  'trimetoprima/sulfametoxazol': 'TMP/SMX', 'tmp/smx': 'TMP/SMX',
  vancomicina: 'Vancomycin IV', voriconazol: 'Voriconazole', remdesivir: 'Remdesivir',
  norepinefrina: 'Norepinephrine', noradrenalina: 'Norepinephrine',
  vasopresina: 'Vasopressin', epinefrina: 'Epinephrine', adrenalina: 'Epinephrine',
  fenilefrina: 'Phenylephrine', dobutamina: 'Dobutamine', milrinona: 'Milrinone',
  propofol: 'Propofol', dexmedetomidina: 'Dexmedetomidine', midazolam: 'Midazolam',
  ketamina: 'Ketamine', etomidato: 'Etomidate', rocuronio: 'Rocuronium',
  fosfenitoina: 'Fosphenytoin', nicardipino: 'Nicardipine', furosemida: 'Furosemide IV',
}

const PORNOMBRE = new Map<string, FarmacoDosis>()
for (const f of DATASET.drugs) PORNOMBRE.set(norm(f.drug), f)
for (const [es, en] of Object.entries(ALIAS_ES)) {
  const f = PORNOMBRE.get(norm(en))
  if (f) PORNOMBRE.set(norm(es), f)
}

/**
 * Busca un fármaco por su nombre en inglés o en español.
 *
 * Coincidencia EXACTA sobre el nombre normalizado. No hay búsqueda por parecido:
 * «ceftriaxona» y «ceftazidima» se parecen mucho y son fármacos distintos.
 *
 * @returns el fármaco, o `null` si no está en el dataset — que es una respuesta
 *   legítima y la pantalla debe decirla.
 */
export function buscarFarmaco(nombre: string): FarmacoDosis | null {
  if (!nombre?.trim()) return null
  return PORNOMBRE.get(norm(nombre)) ?? null
}

/** Los nombres del dataset, para poblar un selector. */
export function nombresFarmacos(): string[] {
  return DATASET.drugs.map(f => f.drug).sort((a, b) => a.localeCompare(b, 'es'))
}

/** Las fuentes de un fármaco, resueltas. Un id desconocido se declara. */
export function fuentesDe(f: FarmacoDosis): { id: string; fuente: FuenteDosis | null }[] {
  return f.source_ids.map(id => ({ id, fuente: DATASET.sources[id] ?? null }))
}

export const POR_QUE_VERBATIM =
  'Las reglas se devuelven con el texto EXACTO del dataset. Reescribirlas en ' +
  'campos numéricos es transcribir, y transcribir una dosis es donde se pierde ' +
  'una dosis. El motor elige la rama; las cifras son las que el dataset trae.'
