// ════════════════════════════════════════════════════════════════════
// Valoración infectológica del paciente inmunocomprometido — CATÁLOGOS.
// Portado VERBATIM desde StewardMX (lógica clínica idéntica). Datos puros, sin estado.
// Las claves (hc_cb_<grupo>_<clave>, hc_est_<clave>, hc_res_<clave>) son el contrato
// de persistencia: se guardan en patient.txValoracion como { [clave]: valor }.
// ════════════════════════════════════════════════════════════════════

export interface ChipGroup {
  label: string
  /** etiqueta de "presentes" (default "Presentes"); vac usa "Aplicadas" */
  posL?: string
  /** frase breve cuando NADA está marcado (negativo conciso) */
  noneL?: string
  items: Record<string, string>
}

export const TX_CHIPS: Record<string, ChipGroup> = {
  comorb: { label: 'Comorbilidades', noneL: 'Sin comorbilidades referidas', items: { dm2: 'DM2', dm1: 'DM1', has: 'Hipertensión', erc: 'ERC / diálisis', hepatop: 'Hepatopatía / cirrosis', cardiop: 'Cardiopatía', icc: 'Insuficiencia cardiaca', epoc: 'EPOC', autoinm: 'Enf. autoinmune', neopl: 'Neoplasia activa', neoplhem: 'Neoplasia hematológica', obesidad: 'Obesidad', desnut: 'Desnutrición', evc: 'EVC' } },
  disp: { label: 'Dispositivos invasivos', noneL: 'Sin dispositivos invasivos', items: { cvc: 'CVC', picc: 'PICC', port: 'Port-a-cath', sondaur: 'Sonda urinaria', sng: 'Sonda nasogástrica', ostomia: 'Ostomía', protart: 'Prótesis articular', protval: 'Prótesis valvular', marcapaso: 'Marcapaso / DAI', dvp: 'Derivación ventricular', vmi: 'Tubo / ventilación mecánica', drenaje: 'Drenaje' } },
  habitos: { label: 'Hábitos', noneL: 'Negados', items: { tabaco: 'Tabaquismo', alcohol: 'Alcoholismo', drogasiv: 'Drogas IV', drogasinh: 'Drogas inhaladas' } },
  inmuno: { label: 'Inmunosupresión actual (elige el/los fármacos → generan tamizaje y profilaxis específicos)', noneL: 'No recibe inmunosupresión', items: { est: 'Esteroides', estalta: 'Esteroide dosis alta (≥20 mg/d ≥2–4 sem)', cni: 'Calcineurínico (tacro/ciclo)', antimet: 'Antimetabolito (MMF/AZA)', mtx: 'Metotrexato', mtor: 'mTOR (sirolimus/everolimus)', cicfos: 'Ciclofosfamida', purinas: 'Análogo de purinas (fludarabina)', anticd20: 'Anti-CD20 (rituximab)', antitnf: 'Anti-TNF', jak: 'Inhibidor JAK', btk: 'Inhibidor BTK (ibrutinib)', proteasoma: 'Inhibidor de proteasoma (bortezomib)', anticd38: 'Anti-CD38 (daratumumab)', antiintegrina: 'Anti-integrina (natalizumab)', abatacept: 'Abatacept (CTLA-4 Ig)', tocilizumab: 'Anti-IL6 (tocilizumab)', anakinra: 'Anti-IL1 (anakinra)', ustekinumab: 'Anti-IL12/23 (ustekinumab)', secukinumab: 'Anti-IL17 (secukinumab)', belimumab: 'Anti-BAFF (belimumab)', fingolimod: 'Modulador S1P (fingolimod)', cart: 'Terapia CAR-T', checkpoint: 'Inhibidor de checkpoint', belatacept: 'Belatacept', atg: 'ATG / timoglobulina', alemtuzumab: 'Alemtuzumab', eculizumab: 'Eculizumab (anti-complemento)', quimio: 'Quimioterapia' } },
  prof: { label: 'Profilaxis activas', noneL: 'Sin profilaxis activa', items: { pjp: 'TMP-SMX (PJP)', atovacuona: 'Atovacuona / dapsona', valganciclovir: 'Valganciclovir', letermovir: 'Letermovir', aciclovir: 'Aciclovir / valaciclovir', antifung: 'Antifúngico', inhtb: 'INH (TB)' } },
  infecto: { label: 'Antecedentes infectológicos', noneL: 'Sin antecedentes infectológicos relevantes', items: { blee: 'Colonización BLEE', cre: 'CRE', mrsa: 'MRSA', vre: 'VRE', pseudo: 'Pseudomonas MDR', acineto: 'Acinetobacter', cdiff: 'C. difficile previo', tbprev: 'TB previa', candidemia: 'Candidemia previa', aspergilosis: 'Aspergilosis previa', cmvprev: 'Enfermedad por CMV previa' } },
  expos: { label: 'Exposiciones epidemiológicas', noneL: 'Negadas', items: { micosis: 'Zona endémica de micosis', contactotb: 'Contacto con TB', animales: 'Animales / aves', viaje: 'Viaje reciente', transf: 'Transfusiones', jardineria: 'Tierra / jardinería', crudos: 'Alimentos crudos / no pasteurizados' } },
  vac: { label: 'Vacunación', posL: 'Aplicadas', noneL: 'Sin datos de vacunación', items: { flu: 'Influenza', neumo: 'Neumococo (PCV/PPSV)', hepb: 'Hepatitis B', covid: 'SARS-CoV-2', zoster: 'Herpes zóster (recombinante)', hib: 'Hib', mening: 'Meningococo' } },
}

/** Flags del huésped que gatean qué estudios aparecen. */
export interface HostFlags { isSOT: boolean; isTCMH: boolean; isVIH: boolean; isNeutro: boolean; isLung: boolean; isTx: boolean }

export function hostFlags(huesped: string): HostFlags {
  const h = huesped || ''
  const isSOT = /^SOT/.test(h), isTCMH = /TCMH/.test(h), isVIH = /^VIH/.test(h)
  const isNeutro = /Neutropenia|Quimio/.test(h), isLung = /Pulmonar/.test(h)
  return { isSOT, isTCMH, isVIH, isNeutro, isLung, isTx: isSOT || isTCMH }
}

export interface EstCat { cat: string; g: (t: HostFlags) => boolean; items: Record<string, string> }

export const TX_EST_CATS: EstCat[] = [
  { cat: 'Serologías basales', g: () => true, items: { vih: 'VIH Ag/Ab 4ª gen', hbsag: 'HBsAg', antihbc: 'Anti-HBc total', antihbs: 'Anti-HBs', hbvdna: 'HBV DNA', hcv: 'Anti-VHC', vha: 'VHA IgG (hepatitis A)', sifilis: 'VDRL / RPR' } },
  { cat: 'Serologías del trasplante', g: (t) => t.isTx, items: { cmv: 'CMV IgG (donante y receptor)', ebv: 'EBV VCA IgG', hsv: 'HSV-1/2 IgG', vzv: 'VZV IgG', toxo: 'Toxoplasma IgG', htlv: 'HTLV-1/2', chagas: 'T. cruzi (Chagas) IgG', strongy: 'Strongyloides serología', sarampion: 'Sarampión / rubéola IgG' } },
  { cat: 'Tuberculosis', g: () => true, items: { igra: 'IGRA / PPD', rxtorax: 'Rx de tórax' } },
  { cat: 'Micosis endémica / oportunista', g: (t) => t.isTx || t.isVIH || t.isNeutro, items: { cocci: 'Coccidioides serología', histo: 'Histoplasma Ag urinario', crag: 'Antígeno criptocócico (CrAg)' } },
  { cat: 'Laboratorio', g: () => true, items: { bh: 'Biometría hemática', quim: 'Química + función renal (TFG)', pfh: 'Pruebas de función hepática', g6pd: 'G6PD (antes de TMP-SMX/dapsona)', igg: 'Inmunoglobulinas (IgG)', nivelis: 'Niveles de inmunosupresor', cd4: 'CD4 + carga viral VIH', procal: 'PCR / procalcitonina' } },
  { cat: 'Cargas virales / molecular', g: (t) => t.isTx || t.isNeutro, items: { cmvpcr: 'CMV PCR', ebvpcr: 'EBV PCR', bkpcr: 'BK virus PCR', adenopcr: 'Adenovirus PCR', hhv6: 'HHV-6 PCR', panelresp: 'Panel viral respiratorio' } },
  { cat: 'Micología (vigilancia)', g: (t) => t.isTCMH || t.isNeutro || t.isLung, items: { gm: 'Galactomanano (suero / BAL)', bdg: '(1,3)-β-D-glucano' } },
  { cat: 'Cultivos y colonización', g: () => true, items: { hemo: 'Hemocultivos', uro: 'Urocultivo', esputo: 'Cultivo de expectoración / BAL', vigilancia: 'Cultivos de vigilancia (MDR)', mdronasal: 'Hisopado nasal (MRSA)', mdrorectal: 'Hisopado rectal (BLEE/CRE/VRE)', cdiff: 'Toxina / PCR C. difficile' } },
  { cat: 'Imagen', g: () => true, items: { tctorax: 'TC de tórax', tcsenos: 'TC de senos paranasales' } },
]

/** Mapa clave→etiqueta (derivado de TX_EST_CATS) para el ligado inicial→seguimiento. */
export const TX_EST_LABELS: Record<string, string> = (() => {
  const m: Record<string, string> = {}
  for (const c of TX_EST_CATS) for (const k in c.items) m['hc_est_' + k] = c.items[k]
  return m
})()

/** Estudios cuantitativos / de imagen → resultado como TEXTO (valor/hallazgo); el resto Pos/Neg/Pendiente. */
export const TX_EST_QUANT = new Set<string>(['bh', 'quim', 'pfh', 'g6pd', 'igg', 'nivelis', 'cd4', 'procal', 'hbvdna', 'rxtorax', 'tctorax', 'tcsenos'])

/** Título del documento según el motivo de la interconsulta. */
export const TX_MOT_TIT: Record<string, string> = {
  aptitud_pretx: 'Valoración de aptitud pretrasplante',
  aptitud_biologico: 'Valoración previa a terapia biológica o inmunosupresora',
  fiebre: 'Valoración por fiebre o foco infeccioso',
  profilaxis: 'Valoración de profilaxis antiinfecciosa',
  vacunacion: 'Valoración de inmunizaciones',
  otro: 'Valoración infectológica del paciente inmunocomprometido',
}
