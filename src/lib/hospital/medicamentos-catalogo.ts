// ══════════════════════════════════════════════════════════════
// Catálogo de medicamentos hospitalarios (genéricos + presentaciones + vías
// comunes). Base para el CPOE estructurado: el médico busca, elige y se
// pre-llenan las presentaciones/vías. Curado para uso intrahospitalario en MX.
// No pretende ser exhaustivo del vademécum; cubre lo de alto uso en piso/UCI.
// ══════════════════════════════════════════════════════════════

export interface MedCatalogo {
  nombre: string            // genérico (DCI)
  cat: string               // categoría
  pres: string[]            // presentaciones/dosis comunes
  vias: string[]            // vías habituales
  marcas?: string[]         // nombres comerciales MX frecuentes (para la búsqueda)
}

const V = { iv: 'IV', vo: 'VO', im: 'IM', sc: 'SC', inh: 'INH', top: 'tópica', neb: 'NEB', sl: 'SL', rect: 'rectal', of: 'oftálmica' }

export const CATALOGO_MEDS: MedCatalogo[] = [
  // ── Antibióticos ──
  { nombre: 'Ceftriaxona', cat: 'Antibiótico', pres: ['1 g', '2 g', '500 mg'], vias: [V.iv, V.im], marcas: ['Rocephin'] },
  { nombre: 'Cefepime', cat: 'Antibiótico', pres: ['1 g', '2 g'], vias: [V.iv], marcas: ['Maxipime'] },
  { nombre: 'Cefotaxima', cat: 'Antibiótico', pres: ['1 g', '2 g'], vias: [V.iv, V.im] },
  { nombre: 'Ceftazidima', cat: 'Antibiótico', pres: ['1 g', '2 g'], vias: [V.iv] },
  { nombre: 'Cefuroxima', cat: 'Antibiótico', pres: ['750 mg', '1.5 g'], vias: [V.iv, V.vo] },
  { nombre: 'Cefalexina', cat: 'Antibiótico', pres: ['500 mg'], vias: [V.vo] },
  { nombre: 'Meropenem', cat: 'Antibiótico', pres: ['500 mg', '1 g'], vias: [V.iv], marcas: ['Merrem'] },
  { nombre: 'Imipenem/cilastatina', cat: 'Antibiótico', pres: ['500 mg'], vias: [V.iv] },
  { nombre: 'Ertapenem', cat: 'Antibiótico', pres: ['1 g'], vias: [V.iv, V.im], marcas: ['Invanz'] },
  { nombre: 'Piperacilina/tazobactam', cat: 'Antibiótico', pres: ['4.5 g', '2.25 g'], vias: [V.iv], marcas: ['Tazocin'] },
  { nombre: 'Amoxicilina/clavulanato', cat: 'Antibiótico', pres: ['875/125 mg', '500/125 mg', '1.2 g'], vias: [V.vo, V.iv], marcas: ['Augmentin', 'Clavulin'] },
  { nombre: 'Amoxicilina', cat: 'Antibiótico', pres: ['500 mg', '875 mg'], vias: [V.vo], marcas: ['Amoxil'] },
  { nombre: 'Ampicilina', cat: 'Antibiótico', pres: ['1 g', '500 mg'], vias: [V.iv, V.im] },
  { nombre: 'Ampicilina/sulbactam', cat: 'Antibiótico', pres: ['1.5 g', '3 g'], vias: [V.iv, V.im], marcas: ['Unasyn'] },
  { nombre: 'Dicloxacilina', cat: 'Antibiótico', pres: ['500 mg'], vias: [V.vo] },
  { nombre: 'Penicilina G sódica cristalina', cat: 'Antibiótico', pres: ['5 000 000 UI'], vias: [V.iv] },
  { nombre: 'Vancomicina', cat: 'Antibiótico', pres: ['500 mg', '1 g'], vias: [V.iv], marcas: ['Vancocin'] },
  { nombre: 'Linezolid', cat: 'Antibiótico', pres: ['600 mg'], vias: [V.iv, V.vo], marcas: ['Zyvox'] },
  { nombre: 'Daptomicina', cat: 'Antibiótico', pres: ['500 mg'], vias: [V.iv], marcas: ['Cubicin'] },
  { nombre: 'Teicoplanina', cat: 'Antibiótico', pres: ['400 mg'], vias: [V.iv] },
  { nombre: 'Clindamicina', cat: 'Antibiótico', pres: ['600 mg', '900 mg', '300 mg'], vias: [V.iv, V.vo], marcas: ['Dalacin'] },
  { nombre: 'Metronidazol', cat: 'Antibiótico', pres: ['500 mg'], vias: [V.iv, V.vo], marcas: ['Flagyl'] },
  { nombre: 'Azitromicina', cat: 'Antibiótico', pres: ['500 mg'], vias: [V.iv, V.vo], marcas: ['Zithromax'] },
  { nombre: 'Claritromicina', cat: 'Antibiótico', pres: ['500 mg'], vias: [V.iv, V.vo], marcas: ['Klaricid'] },
  { nombre: 'Levofloxacino', cat: 'Antibiótico', pres: ['500 mg', '750 mg'], vias: [V.iv, V.vo], marcas: ['Tavanic', 'Levaquin'] },
  { nombre: 'Ciprofloxacino', cat: 'Antibiótico', pres: ['400 mg', '500 mg'], vias: [V.iv, V.vo], marcas: ['Ciproxina'] },
  { nombre: 'Moxifloxacino', cat: 'Antibiótico', pres: ['400 mg'], vias: [V.iv, V.vo], marcas: ['Avelox'] },
  { nombre: 'Gentamicina', cat: 'Antibiótico', pres: ['80 mg', '160 mg', '240 mg'], vias: [V.iv, V.im] },
  { nombre: 'Amikacina', cat: 'Antibiótico', pres: ['500 mg', '1 g'], vias: [V.iv, V.im] },
  { nombre: 'Trimetoprima/sulfametoxazol', cat: 'Antibiótico', pres: ['160/800 mg', 'amp'], vias: [V.vo, V.iv], marcas: ['Bactrim'] },
  { nombre: 'Colistina (colistimetato)', cat: 'Antibiótico', pres: ['1 000 000 UI'], vias: [V.iv, V.neb] },
  { nombre: 'Tigeciclina', cat: 'Antibiótico', pres: ['50 mg'], vias: [V.iv], marcas: ['Tygacil'] },
  { nombre: 'Doxiciclina', cat: 'Antibiótico', pres: ['100 mg'], vias: [V.vo, V.iv] },
  { nombre: 'Nitrofurantoína', cat: 'Antibiótico', pres: ['100 mg'], vias: [V.vo] },
  { nombre: 'Fosfomicina', cat: 'Antibiótico', pres: ['3 g', '4 g'], vias: [V.vo, V.iv] },
  { nombre: 'Aztreonam', cat: 'Antibiótico', pres: ['1 g', '2 g'], vias: [V.iv] },
  // ── Antifúngicos / antivirales ──
  { nombre: 'Fluconazol', cat: 'Antifúngico', pres: ['100 mg', '200 mg', '400 mg'], vias: [V.iv, V.vo], marcas: ['Diflucan'] },
  { nombre: 'Anfotericina B liposomal', cat: 'Antifúngico', pres: ['50 mg'], vias: [V.iv], marcas: ['AmBisome'] },
  { nombre: 'Caspofungina', cat: 'Antifúngico', pres: ['50 mg', '70 mg'], vias: [V.iv], marcas: ['Cancidas'] },
  { nombre: 'Anidulafungina', cat: 'Antifúngico', pres: ['100 mg'], vias: [V.iv] },
  { nombre: 'Voriconazol', cat: 'Antifúngico', pres: ['200 mg'], vias: [V.iv, V.vo], marcas: ['Vfend'] },
  { nombre: 'Posaconazol', cat: 'Antifúngico', pres: ['300 mg'], vias: [V.iv, V.vo], marcas: ['Noxafil'] },
  { nombre: 'Aciclovir', cat: 'Antiviral', pres: ['250 mg', '500 mg'], vias: [V.iv, V.vo] },
  { nombre: 'Valaciclovir', cat: 'Antiviral', pres: ['500 mg', '1 g'], vias: [V.vo] },
  { nombre: 'Ganciclovir', cat: 'Antiviral', pres: ['500 mg'], vias: [V.iv] },
  { nombre: 'Valganciclovir', cat: 'Antiviral', pres: ['450 mg'], vias: [V.vo], marcas: ['Valcyte'] },
  { nombre: 'Oseltamivir', cat: 'Antiviral', pres: ['75 mg'], vias: [V.vo], marcas: ['Tamiflu'] },
  // ── Analgésicos / antiinflamatorios / opioides ──
  { nombre: 'Paracetamol', cat: 'Analgésico', pres: ['500 mg', '1 g'], vias: [V.vo, V.iv, V.rect], marcas: ['Tempra', 'Tylenol'] },
  { nombre: 'Metamizol (dipirona)', cat: 'Analgésico', pres: ['1 g', '2 g'], vias: [V.iv, V.im, V.vo], marcas: ['Neomelubrina'] },
  { nombre: 'Ketorolaco', cat: 'AINE', pres: ['30 mg', '10 mg'], vias: [V.iv, V.im, V.vo] },
  { nombre: 'Diclofenaco', cat: 'AINE', pres: ['75 mg', '50 mg'], vias: [V.im, V.vo] },
  { nombre: 'Ibuprofeno', cat: 'AINE', pres: ['400 mg', '600 mg'], vias: [V.vo] },
  { nombre: 'Naproxeno', cat: 'AINE', pres: ['250 mg', '500 mg'], vias: [V.vo] },
  { nombre: 'Tramadol', cat: 'Opioide', pres: ['50 mg', '100 mg'], vias: [V.iv, V.im, V.vo] },
  { nombre: 'Buprenorfina', cat: 'Opioide', pres: ['0.3 mg', 'parche'], vias: [V.iv, V.im, V.top] },
  { nombre: 'Morfina', cat: 'Opioide', pres: ['10 mg', '2.5 mg'], vias: [V.iv, V.sc, V.vo] },
  { nombre: 'Fentanilo', cat: 'Opioide', pres: ['0.05 mg/mL', 'parche'], vias: [V.iv, V.top] },
  { nombre: 'Nalbufina', cat: 'Opioide', pres: ['10 mg'], vias: [V.iv, V.im] },
  { nombre: 'Oxicodona', cat: 'Opioide', pres: ['10 mg', '20 mg'], vias: [V.vo] },
  // ── Cardiovascular ──
  { nombre: 'Furosemida', cat: 'Diurético', pres: ['20 mg', '40 mg'], vias: [V.iv, V.vo], marcas: ['Lasix'] },
  { nombre: 'Espironolactona', cat: 'Diurético', pres: ['25 mg', '100 mg'], vias: [V.vo] },
  { nombre: 'Enalapril', cat: 'Antihipertensivo', pres: ['5 mg', '10 mg', '20 mg'], vias: [V.vo] },
  { nombre: 'Captopril', cat: 'Antihipertensivo', pres: ['25 mg'], vias: [V.vo, V.sl] },
  { nombre: 'Losartán', cat: 'Antihipertensivo', pres: ['50 mg', '100 mg'], vias: [V.vo] },
  { nombre: 'Telmisartán', cat: 'Antihipertensivo', pres: ['40 mg', '80 mg'], vias: [V.vo] },
  { nombre: 'Amlodipino', cat: 'Antihipertensivo', pres: ['5 mg', '10 mg'], vias: [V.vo] },
  { nombre: 'Nifedipino', cat: 'Antihipertensivo', pres: ['30 mg', '60 mg'], vias: [V.vo] },
  { nombre: 'Metoprolol', cat: 'Betabloqueador', pres: ['50 mg', '100 mg', '5 mg IV'], vias: [V.vo, V.iv] },
  { nombre: 'Carvedilol', cat: 'Betabloqueador', pres: ['6.25 mg', '12.5 mg', '25 mg'], vias: [V.vo] },
  { nombre: 'Propranolol', cat: 'Betabloqueador', pres: ['40 mg'], vias: [V.vo] },
  { nombre: 'Labetalol', cat: 'Antihipertensivo', pres: ['20 mg', '100 mg'], vias: [V.iv, V.vo] },
  { nombre: 'Hidralazina', cat: 'Antihipertensivo', pres: ['20 mg'], vias: [V.iv, V.im, V.vo] },
  { nombre: 'Nitroprusiato de sodio', cat: 'Vasodilatador', pres: ['50 mg'], vias: [V.iv] },
  { nombre: 'Nitroglicerina', cat: 'Vasodilatador', pres: ['50 mg', '0.4 mg SL'], vias: [V.iv, V.sl] },
  { nombre: 'Amiodarona', cat: 'Antiarrítmico', pres: ['150 mg', '200 mg'], vias: [V.iv, V.vo] },
  { nombre: 'Digoxina', cat: 'Cardiotónico', pres: ['0.25 mg'], vias: [V.iv, V.vo] },
  { nombre: 'Adenosina', cat: 'Antiarrítmico', pres: ['6 mg'], vias: [V.iv] },
  { nombre: 'Norepinefrina', cat: 'Vasopresor', pres: ['4 mg', '8 mg'], vias: [V.iv] },
  { nombre: 'Epinefrina (adrenalina)', cat: 'Vasopresor', pres: ['1 mg'], vias: [V.iv, V.im, V.sc] },
  { nombre: 'Dopamina', cat: 'Vasopresor', pres: ['200 mg'], vias: [V.iv] },
  { nombre: 'Dobutamina', cat: 'Inotrópico', pres: ['250 mg'], vias: [V.iv] },
  { nombre: 'Vasopresina', cat: 'Vasopresor', pres: ['20 UI'], vias: [V.iv] },
  { nombre: 'Atorvastatina', cat: 'Hipolipemiante', pres: ['20 mg', '40 mg', '80 mg'], vias: [V.vo] },
  { nombre: 'Rosuvastatina', cat: 'Hipolipemiante', pres: ['10 mg', '20 mg'], vias: [V.vo] },
  // ── Anticoagulantes / antiagregantes ──
  { nombre: 'Enoxaparina', cat: 'Anticoagulante', pres: ['40 mg', '60 mg', '80 mg'], vias: [V.sc], marcas: ['Clexane'] },
  { nombre: 'Heparina sódica', cat: 'Anticoagulante', pres: ['5000 UI', '25000 UI'], vias: [V.iv, V.sc] },
  { nombre: 'Warfarina', cat: 'Anticoagulante', pres: ['5 mg'], vias: [V.vo] },
  { nombre: 'Acenocumarol', cat: 'Anticoagulante', pres: ['4 mg'], vias: [V.vo] },
  { nombre: 'Rivaroxabán', cat: 'Anticoagulante', pres: ['10 mg', '15 mg', '20 mg'], vias: [V.vo], marcas: ['Xarelto'] },
  { nombre: 'Apixabán', cat: 'Anticoagulante', pres: ['2.5 mg', '5 mg'], vias: [V.vo], marcas: ['Eliquis'] },
  { nombre: 'Dabigatrán', cat: 'Anticoagulante', pres: ['110 mg', '150 mg'], vias: [V.vo] },
  { nombre: 'Ácido acetilsalicílico', cat: 'Antiagregante', pres: ['100 mg', '300 mg'], vias: [V.vo], marcas: ['Aspirina'] },
  { nombre: 'Clopidogrel', cat: 'Antiagregante', pres: ['75 mg', '300 mg'], vias: [V.vo], marcas: ['Plavix'] },
  // ── Gastrointestinal ──
  { nombre: 'Omeprazol', cat: 'IBP', pres: ['20 mg', '40 mg'], vias: [V.iv, V.vo] },
  { nombre: 'Pantoprazol', cat: 'IBP', pres: ['40 mg'], vias: [V.iv, V.vo] },
  { nombre: 'Esomeprazol', cat: 'IBP', pres: ['40 mg'], vias: [V.iv, V.vo] },
  { nombre: 'Ranitidina', cat: 'Antiácido', pres: ['50 mg', '150 mg'], vias: [V.iv, V.vo] },
  { nombre: 'Metoclopramida', cat: 'Antiemético', pres: ['10 mg'], vias: [V.iv, V.im, V.vo] },
  { nombre: 'Ondansetrón', cat: 'Antiemético', pres: ['4 mg', '8 mg'], vias: [V.iv, V.vo] },
  { nombre: 'Butilhioscina', cat: 'Antiespasmódico', pres: ['20 mg', '10 mg'], vias: [V.iv, V.im, V.vo], marcas: ['Buscapina'] },
  { nombre: 'Ondansetrón', cat: 'Antiemético', pres: ['8 mg'], vias: [V.iv] },
  { nombre: 'Lactulosa', cat: 'Laxante', pres: ['20 g'], vias: [V.vo, V.rect] },
  // ── Endocrino / metabólico ──
  { nombre: 'Insulina rápida (regular)', cat: 'Insulina', pres: ['UI (esquema)'], vias: [V.sc, V.iv], marcas: ['Humulin R'] },
  { nombre: 'Insulina glargina', cat: 'Insulina', pres: ['UI'], vias: [V.sc], marcas: ['Lantus'] },
  { nombre: 'Insulina NPH', cat: 'Insulina', pres: ['UI'], vias: [V.sc] },
  { nombre: 'Insulina lispro', cat: 'Insulina', pres: ['UI'], vias: [V.sc], marcas: ['Humalog'] },
  { nombre: 'Metformina', cat: 'Antidiabético', pres: ['500 mg', '850 mg'], vias: [V.vo] },
  { nombre: 'Levotiroxina', cat: 'Hormona tiroidea', pres: ['50 mcg', '100 mcg'], vias: [V.vo] },
  { nombre: 'Hidrocortisona', cat: 'Corticoide', pres: ['100 mg', '500 mg'], vias: [V.iv, V.im] },
  { nombre: 'Metilprednisolona', cat: 'Corticoide', pres: ['40 mg', '125 mg', '500 mg'], vias: [V.iv], marcas: ['Solu-Medrol'] },
  { nombre: 'Dexametasona', cat: 'Corticoide', pres: ['4 mg', '8 mg'], vias: [V.iv, V.im, V.vo] },
  { nombre: 'Prednisona', cat: 'Corticoide', pres: ['5 mg', '50 mg'], vias: [V.vo] },
  // ── Respiratorio ──
  { nombre: 'Salbutamol', cat: 'Broncodilatador', pres: ['100 mcg IDM', '2.5 mg NEB'], vias: [V.inh, V.neb], marcas: ['Ventolin'] },
  { nombre: 'Ipratropio', cat: 'Broncodilatador', pres: ['0.5 mg NEB'], vias: [V.neb, V.inh] },
  { nombre: 'Budesonida', cat: 'Corticoide inhalado', pres: ['0.5 mg NEB'], vias: [V.neb, V.inh] },
  { nombre: 'Aminofilina', cat: 'Broncodilatador', pres: ['250 mg'], vias: [V.iv] },
  // ── SNC / sedación ──
  { nombre: 'Midazolam', cat: 'Sedante', pres: ['5 mg', '15 mg'], vias: [V.iv, V.im] },
  { nombre: 'Diazepam', cat: 'Benzodiacepina', pres: ['10 mg'], vias: [V.iv, V.vo] },
  { nombre: 'Lorazepam', cat: 'Benzodiacepina', pres: ['1 mg', '2 mg'], vias: [V.iv, V.vo] },
  { nombre: 'Clonazepam', cat: 'Benzodiacepina', pres: ['0.5 mg', '2 mg'], vias: [V.vo] },
  { nombre: 'Propofol', cat: 'Anestésico', pres: ['200 mg', '500 mg'], vias: [V.iv] },
  { nombre: 'Dexmedetomidina', cat: 'Sedante', pres: ['200 mcg'], vias: [V.iv], marcas: ['Precedex'] },
  { nombre: 'Ketamina', cat: 'Anestésico', pres: ['500 mg'], vias: [V.iv, V.im] },
  { nombre: 'Haloperidol', cat: 'Antipsicótico', pres: ['5 mg'], vias: [V.iv, V.im, V.vo] },
  { nombre: 'Quetiapina', cat: 'Antipsicótico', pres: ['25 mg', '100 mg'], vias: [V.vo] },
  { nombre: 'Fenitoína', cat: 'Anticonvulsivo', pres: ['250 mg', '100 mg'], vias: [V.iv, V.vo] },
  { nombre: 'Levetiracetam', cat: 'Anticonvulsivo', pres: ['500 mg', '1 g'], vias: [V.iv, V.vo], marcas: ['Keppra'] },
  { nombre: 'Ácido valproico', cat: 'Anticonvulsivo', pres: ['500 mg'], vias: [V.iv, V.vo] },
  // ── Hematología / otros ──
  { nombre: 'Ácido tranexámico', cat: 'Antifibrinolítico', pres: ['500 mg', '1 g'], vias: [V.iv, V.vo] },
  { nombre: 'Vitamina K (fitomenadiona)', cat: 'Antihemorrágico', pres: ['10 mg'], vias: [V.iv, V.im, V.vo] },
  { nombre: 'Ácido fólico', cat: 'Vitamina', pres: ['5 mg'], vias: [V.vo] },
  { nombre: 'Tiamina (B1)', cat: 'Vitamina', pres: ['100 mg'], vias: [V.iv, V.im] },
  { nombre: 'Sulfato de magnesio', cat: 'Electrolito', pres: ['1 g', '10%'], vias: [V.iv] },
  { nombre: 'Gluconato de calcio', cat: 'Electrolito', pres: ['1 g 10%'], vias: [V.iv] },
  { nombre: 'Cloruro de potasio', cat: 'Electrolito', pres: ['amp 10%'], vias: [V.iv] },
  { nombre: 'Bicarbonato de sodio', cat: 'Electrolito', pres: ['amp 7.5%'], vias: [V.iv] },
  { nombre: 'Naloxona', cat: 'Antagonista', pres: ['0.4 mg'], vias: [V.iv, V.im] },
  { nombre: 'Flumazenil', cat: 'Antagonista', pres: ['0.5 mg'], vias: [V.iv] },
  // ── Soluciones / líquidos ──
  { nombre: 'Solución fisiológica 0.9%', cat: 'Solución', pres: ['500 mL', '1000 mL'], vias: [V.iv] },
  { nombre: 'Solución Hartmann', cat: 'Solución', pres: ['500 mL', '1000 mL'], vias: [V.iv] },
  { nombre: 'Solución glucosada 5%', cat: 'Solución', pres: ['500 mL', '1000 mL'], vias: [V.iv] },
  { nombre: 'Solución mixta', cat: 'Solución', pres: ['1000 mL'], vias: [V.iv] },
  { nombre: 'Albúmina humana 20%', cat: 'Coloide', pres: ['50 mL'], vias: [V.iv] },
]

/** Busca en el catálogo por nombre genérico, marca o categoría (sin acentos). */
export function buscarMed(q: string, limite = 12): MedCatalogo[] {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const t = norm(q.trim())
  if (!t) return []
  return CATALOGO_MEDS.filter(m =>
    norm(m.nombre).includes(t) || norm(m.cat).includes(t) || (m.marcas ?? []).some(x => norm(x).includes(t))
  ).slice(0, limite)
}
