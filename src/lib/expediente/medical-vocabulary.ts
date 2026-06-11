/**
 * VOCABULARIO MÉDICO AMPLIO + corrector de transcripción.
 *
 * Estrategia:
 *  1) Diccionario categorizado (antibióticos, antifúngicos, ARV, anti-TB,
 *     biológicos, cardiovasculares, endocrino, oncológicos, analgésicos,
 *     laboratorios, microbiología, imagenología, vacunas, abreviaturas).
 *  2) Normalización fonética del español (cefalexina ≡ sefaleksina) +
 *     distancia de Levenshtein para detectar errores comunes de transcripción.
 *  3) Aplicación conservadora: solo corrige cuando hay coincidencia fonética
 *     exacta o distancia muy pequeña, y la palabra original no es de uso común.
 */

/* ════════════════════════════════════════════════════════════════
 * CATÁLOGOS
 * ════════════════════════════════════════════════════════════════ */

export const ANTIBIOTICOS = [
  // Penicilinas
  'penicilina G', 'penicilina V', 'penicilina benzatínica', 'penicilina procaínica',
  'amoxicilina', 'amoxicilina/clavulanato', 'ampicilina', 'ampicilina/sulbactam',
  'dicloxacilina', 'oxacilina', 'cloxacilina', 'piperacilina', 'piperacilina/tazobactam',
  // Cefalosporinas
  'cefalexina', 'cefadroxilo', 'cefazolina', 'cefuroxima', 'cefoxitina',
  'cefotaxima', 'ceftriaxona', 'ceftazidima', 'ceftazidima/avibactam',
  'cefepime', 'cefepime/zidebactam', 'ceftarolina', 'ceftolozano/tazobactam',
  'ceftobiprol', 'cefiderocol',
  // Carbapenémicos
  'ertapenem', 'imipenem', 'imipenem/cilastatina', 'imipenem/relebactam',
  'meropenem', 'meropenem/vaborbactam', 'doripenem',
  // Monobactámicos
  'aztreonam', 'aztreonam/avibactam',
  // Glicopéptidos / lipoglicopéptidos
  'vancomicina', 'teicoplanina', 'dalbavancina', 'oritavancina', 'telavancina',
  // Oxazolidinonas
  'linezolid', 'tedizolid',
  // Lipopéptidos
  'daptomicina',
  // Aminoglucósidos
  'gentamicina', 'amikacina', 'tobramicina', 'estreptomicina', 'neomicina', 'plazomicina',
  // Quinolonas
  'ciprofloxacino', 'levofloxacino', 'moxifloxacino', 'ofloxacino', 'norfloxacino',
  'delafloxacino', 'gemifloxacino',
  // Macrólidos
  'azitromicina', 'claritromicina', 'eritromicina', 'roxitromicina', 'fidaxomicina',
  // Tetraciclinas
  'doxiciclina', 'minociclina', 'tetraciclina', 'tigeciclina', 'eravaciclina', 'omadaciclina',
  // Lincosamidas
  'clindamicina', 'lincomicina',
  // Sulfonamidas
  'trimetoprim/sulfametoxazol', 'TMP/SMX', 'cotrimoxazol', 'sulfadiazina',
  // Nitroimidazoles
  'metronidazol', 'tinidazol', 'secnidazol',
  // Otras
  'cloranfenicol', 'rifaximina', 'nitrofurantoína', 'fosfomicina', 'fosfomicina trometamol',
  'polimixina B', 'colistina', 'colistimetato',
  'mupirocina', 'ácido fusídico', 'bacitracina',
  // Anti-TB
  'rifampicina', 'rifabutina', 'rifapentina', 'isoniazida', 'pirazinamida', 'etambutol',
  'bedaquilina', 'delamanid', 'pretomanid', 'cicloserina', 'protionamida', 'etionamida',
  'capreomicina', 'kanamicina', 'PAS', 'ácido paraaminosalicílico', 'clofazimina',
]

export const ANTIFUNGICOS = [
  'fluconazol', 'itraconazol', 'voriconazol', 'posaconazol', 'isavuconazol',
  'ketoconazol', 'miconazol', 'terbinafina', 'griseofulvina',
  'anfotericina B', 'anfotericina B liposomal', 'anfotericina B complejo lipídico',
  'caspofungina', 'micafungina', 'anidulafungina',
  'flucitosina', '5-FC', 'nistatina', 'clotrimazol',
]

export const ANTIVIRALES = [
  'aciclovir', 'valaciclovir', 'famciclovir', 'penciclovir',
  'ganciclovir', 'valganciclovir', 'cidofovir', 'foscarnet', 'letermovir',
  'oseltamivir', 'zanamivir', 'baloxavir', 'peramivir',
  'ribavirina', 'remdesivir', 'molnupiravir', 'paxlovid', 'nirmatrelvir/ritonavir',
  'interferón alfa', 'peginterferón',
]

export const ANTIRRETROVIRALES = [
  // INTI
  'tenofovir disoproxilo', 'TDF', 'tenofovir alafenamida', 'TAF',
  'emtricitabina', 'FTC', 'lamivudina', '3TC', 'abacavir', 'ABC',
  'zidovudina', 'AZT', 'estavudina', 'didanosina',
  // INNTI
  'efavirenz', 'EFV', 'nevirapina', 'rilpivirina', 'doravirina', 'etravirina',
  // IP
  'lopinavir/ritonavir', 'atazanavir', 'darunavir', 'darunavir/cobicistat',
  // II
  'dolutegravir', 'DTG', 'bictegravir', 'BIC', 'raltegravir', 'RAL',
  'elvitegravir/cobicistat', 'cabotegravir',
  // Inhibidores de entrada / otros
  'maraviroc', 'enfuvirtida', 'fostemsavir', 'ibalizumab',
  // Combinaciones de uso frecuente
  'Biktarvy', 'Genvoya', 'Triumeq', 'Truvada', 'Descovy', 'Stribild',
]

export const CARDIOVASCULARES = [
  // IECA
  'enalapril', 'captopril', 'lisinopril', 'ramipril', 'perindopril', 'quinapril', 'fosinopril', 'benazepril',
  // ARA II
  'losartán', 'telmisartán', 'valsartán', 'irbesartán', 'candesartán', 'olmesartán',
  // ARNI
  'sacubitrilo/valsartán',
  // Beta-bloqueadores
  'metoprolol', 'bisoprolol', 'carvedilol', 'nebivolol', 'atenolol', 'propranolol', 'labetalol', 'esmolol',
  // BCC
  'amlodipino', 'nifedipino', 'felodipino', 'lercanidipino', 'verapamilo', 'diltiazem',
  // Diuréticos
  'hidroclorotiazida', 'clortalidona', 'indapamida', 'furosemida', 'torasemida', 'bumetanida',
  'espironolactona', 'eplerenona', 'amilorida',
  // Antianginosos
  'isosorbide mononitrato', 'isosorbide dinitrato', 'nitroglicerina', 'ivabradina', 'ranolazina', 'trimetazidina',
  // Estatinas
  'atorvastatina', 'rosuvastatina', 'simvastatina', 'pitavastatina', 'pravastatina', 'fluvastatina', 'lovastatina',
  // Otros lipídicos
  'ezetimibe', 'evolocumab', 'alirocumab', 'inclisirán', 'fenofibrato', 'gemfibrozilo', 'colestiramina', 'ácido bempedoico',
  // iSGLT2 / GLP-1 (también endocrino)
  'dapagliflozina', 'empagliflozina', 'canagliflozina', 'ertugliflozina',
  // Antiarrítmicos
  'amiodarona', 'flecainida', 'propafenona', 'sotalol', 'dronedarona', 'lidocaína',
  // Antiplaquetarios
  'aspirina', 'clopidogrel', 'prasugrel', 'ticagrelor', 'dipiridamol', 'cilostazol',
  // Anticoagulantes
  'warfarina', 'acenocumarol', 'rivaroxabán', 'apixabán', 'edoxabán', 'dabigatrán',
  'enoxaparina', 'nadroparina', 'dalteparina', 'tinzaparina', 'fondaparinux',
  'heparina sódica', 'heparina no fraccionada', 'argatrobán', 'bivalirudina',
]

export const ENDOCRINO_METABOLICO = [
  // Hipoglucemiantes
  'metformina', 'sitagliptina', 'linagliptina', 'saxagliptina', 'vildagliptina', 'alogliptina',
  'glibenclamida', 'glimepirida', 'glicazida',
  'pioglitazona', 'rosiglitazona', 'acarbosa', 'repaglinida', 'nateglinida',
  // GLP-1
  'liraglutida', 'semaglutida', 'dulaglutida', 'exenatida', 'lixisenatida', 'tirzepatida',
  // Insulinas
  'insulina glargina', 'insulina degludec', 'insulina detemir',
  'insulina aspart', 'insulina lispro', 'insulina glulisina',
  'insulina NPH', 'insulina regular', 'insulina premezclada',
  // Tiroides
  'levotiroxina', 'liotironina', 'metimazol', 'propiltiouracilo',
  // Esteroides
  'prednisona', 'prednisolona', 'metilprednisolona', 'dexametasona', 'hidrocortisona',
  'deflazacort', 'fluticasona', 'budesonida', 'beclometasona',
  // Otros
  'desmopresina', 'octreótido', 'cabergolina', 'bromocriptina',
]

export const INMUNOSUPRESORES_BIOLOGICOS = [
  'tacrolimus', 'ciclosporina', 'sirolimus', 'everolimus',
  'micofenolato', 'micofenolato sódico', 'azatioprina',
  'metotrexato', 'leflunomida', 'sulfasalazina', 'hidroxicloroquina',
  'rituximab', 'obinutuzumab', 'ofatumumab', 'ocrelizumab',
  'tocilizumab', 'sarilumab', 'siltuximab',
  'infliximab', 'adalimumab', 'etanercept', 'golimumab', 'certolizumab',
  'abatacept', 'belatacept',
  'ustekinumab', 'guselkumab', 'risankizumab', 'tildrakizumab',
  'secukinumab', 'ixekizumab', 'bimekizumab', 'brodalumab',
  'vedolizumab', 'natalizumab', 'eculizumab', 'ravulizumab',
  'tofacitinib', 'baricitinib', 'upadacitinib', 'filgotinib', 'ruxolitinib',
  'belimumab', 'anifrolumab',
  'omalizumab', 'mepolizumab', 'benralizumab', 'reslizumab', 'dupilumab',
  'inmunoglobulina humana', 'IGIV', 'gammaglobulina',
]

export const PSICOFARMACOS = [
  'sertralina', 'escitalopram', 'fluoxetina', 'paroxetina', 'citalopram',
  'venlafaxina', 'duloxetina', 'desvenlafaxina', 'mirtazapina',
  'amitriptilina', 'imipramina', 'clomipramina', 'nortriptilina',
  'bupropión', 'trazodona', 'vortioxetina',
  'olanzapina', 'risperidona', 'quetiapina', 'aripiprazol', 'ziprasidona', 'paliperidona', 'clozapina',
  'haloperidol', 'levomepromazina',
  'litio',
  'valproato', 'ácido valproico', 'lamotrigina', 'carbamazepina', 'topiramato', 'gabapentina', 'pregabalina', 'lacosamida',
  'diazepam', 'lorazepam', 'clonazepam', 'alprazolam', 'midazolam', 'oxazepam', 'bromazepam',
  'zolpidem', 'zopiclona', 'eszopiclona',
]

export const ANALGESICOS_AINE = [
  'paracetamol', 'ibuprofeno', 'naproxeno', 'diclofenaco', 'ketorolaco',
  'meloxicam', 'celecoxib', 'etoricoxib', 'parecoxib',
  'piroxicam', 'tenoxicam', 'indometacina', 'nimesulida',
  'metamizol', 'dipirona', 'ácido acetilsalicílico',
]

export const OPIOIDES = [
  'tramadol', 'codeína', 'morfina', 'oxicodona', 'hidromorfona', 'fentanilo',
  'buprenorfina', 'metadona', 'naloxona', 'naltrexona', 'tapentadol',
]

export const ANTINEOPLASICOS_COMUNES = [
  'doxorrubicina', 'ciclofosfamida', 'vincristina', 'vinblastina', 'bleomicina', 'metotrexato',
  'cisplatino', 'carboplatino', 'oxaliplatino', 'paclitaxel', 'docetaxel', '5-fluorouracilo', '5-FU',
  'capecitabina', 'gemcitabina', 'irinotecán', 'topotecán', 'imatinib', 'dasatinib', 'nilotinib',
  'erlotinib', 'gefitinib', 'osimertinib', 'crizotinib', 'pembrolizumab', 'nivolumab', 'ipilimumab',
  'atezolizumab', 'durvalumab', 'cetuximab', 'panitumumab', 'bevacizumab', 'trastuzumab', 'pertuzumab',
  'lapatinib', 'lenvatinib', 'sunitinib', 'sorafenib', 'pazopanib',
]

export const INHALADORES_BRONCODILATADORES = [
  'salbutamol', 'salmeterol', 'formoterol', 'vilanterol',
  'tiotropio', 'umeclidinio', 'glicopirronio', 'aclidinio',
  'budesonida', 'fluticasona', 'mometasona', 'beclometasona',
  'fluticasona/vilanterol', 'budesonida/formoterol', 'tiotropio/olodaterol',
  'umeclidinio/vilanterol', 'fluticasona/umeclidinio/vilanterol',
  'mepolizumab', 'omalizumab', 'dupilumab', 'tezepelumab',
]

export const GASTRO = [
  'omeprazol', 'pantoprazol', 'esomeprazol', 'lansoprazol', 'rabeprazol', 'dexlansoprazol',
  'ranitidina', 'famotidina', 'cimetidina',
  'sucralfato', 'misoprostol', 'rebamipida',
  'metoclopramida', 'domperidona', 'ondansetrón', 'granisetrón', 'palonosetrón', 'aprepitant',
  'levosulpirida', 'ortopramida',
  'loperamida', 'difenoxilato',
  'mesalazina', 'sulfasalazina', 'rifaximina',
  'lactulosa', 'polietilenglicol', 'docusato sódico', 'sennósidos',
]

export const NEFRO_UROLOGICO = [
  'tamsulosina', 'silodosina', 'doxazosina', 'alfuzosina', 'terazosina',
  'finasterida', 'dutasterida',
  'tolterodina', 'oxibutinina', 'solifenacina', 'darifenacina', 'fesoterodina', 'mirabegrón',
  'sildenafilo', 'tadalafilo', 'vardenafilo', 'avanafilo',
]

export const HEMATO = [
  'eritropoyetina', 'darbepoetina', 'epoetina alfa', 'epoetina beta',
  'filgrastim', 'pegfilgrastim', 'lenograstim',
  'romiplostim', 'eltrombopag',
  'ácido fólico', 'sulfato ferroso', 'hierro polimaltosado', 'hierro carboximaltosa', 'hierro sacarosa',
  'vitamina B12', 'cianocobalamina', 'metilcobalamina', 'hidroxocobalamina',
  'desferoxamina', 'deferasirox', 'deferiprona',
  'caplacizumab',
]

export const VACUNAS = [
  'BCG', 'hexavalente', 'pentavalente', 'triple viral', 'SRP', 'tetraviral',
  'antineumocócica conjugada PCV13', 'antineumocócica polisacárida PPSV23',
  'antiinfluenza', 'antiinfluenza tetravalente', 'anti SARS-CoV-2',
  'anti-rotavirus', 'anti-meningocócica', 'anti-Hib', 'antihepatitis A', 'antihepatitis B',
  'VPH', 'anti-tetánica', 'anti-rábica', 'antitifoídica', 'anti-fiebre amarilla',
  'anti-herpes zoster', 'antivaricela', 'anti-meningocócica B', 'dengue',
]

export const NEUROLOGIA = [
  // Antiepilépticos (los no cubiertos en psicofármacos)
  'levetiracetam', 'brivaracetam', 'fenitoína', 'fenobarbital', 'oxcarbazepina',
  'eslicarbazepina', 'zonisamida', 'perampanel', 'vigabatrina', 'etosuximida', 'cenobamato',
  // Antiparkinsonianos
  'levodopa/carbidopa', 'levodopa/benserazida', 'pramipexol', 'ropinirol', 'rotigotina',
  'rasagilina', 'selegilina', 'safinamida', 'entacapona', 'opicapona', 'amantadina',
  'biperideno', 'trihexifenidilo', 'apomorfina',
  // Antimigrañosos
  'sumatriptán', 'rizatriptán', 'eletriptán', 'zolmitriptán', 'naratriptán',
  'erenumab', 'fremanezumab', 'galcanezumab', 'eptinezumab', 'rimegepant', 'ubrogepant',
  'flunarizina', 'cinarizina',
  // Demencia
  'donepezilo', 'rivastigmina', 'galantamina', 'memantina', 'lecanemab', 'donanemab',
  // Esclerosis múltiple
  'interferón beta', 'acetato de glatiramero', 'fingolimod', 'siponimod', 'ozanimod',
  'dimetilfumarato', 'teriflunomida', 'cladribina', 'alemtuzumab',
  // Otros
  'riluzol', 'edaravona', 'nusinersen', 'tetrabenazina', 'toxina botulínica',
  'betahistina', 'piracetam', 'citicolina', 'melatonina', 'modafinilo', 'armodafinilo',
]

export const REUMA_OSTEO = [
  // Gota
  'alopurinol', 'febuxostat', 'colchicina', 'probenecid', 'pegloticasa',
  // Osteoporosis
  'alendronato', 'risedronato', 'ibandronato', 'ácido zoledrónico', 'zoledronato',
  'denosumab', 'teriparatida', 'abaloparatida', 'romosozumab', 'raloxifeno',
  'calcitriol', 'colecalciferol', 'ergocalciferol', 'calcio/vitamina D', 'carbonato de calcio', 'citrato de calcio',
  // Artritis y otros (los no cubiertos en inmunosupresores)
  'cloroquina', 'penicilamina', 'apremilast', 'avacopan', 'condroitina', 'glucosamina',
]

export const DERMA_OFTALMO_ORL = [
  // Dermatología
  'isotretinoína', 'tretinoína', 'adapaleno', 'peróxido de benzoilo',
  'calcipotriol', 'tacalcitol', 'pimecrolimus', 'tacrolimus tópico',
  'clobetasol', 'betametasona', 'mometasona tópica', 'fluocinolona',
  'ivermectina', 'permetrina', 'benzoato de bencilo', 'ketoconazol champú',
  'minoxidil', 'finasterida tópica', 'dutasterida',
  'hidroquinona', 'ácido azelaico', 'metronidazol tópico', 'dapsona',
  // Oftalmología
  'latanoprost', 'bimatoprost', 'travoprost', 'timolol oftálmico', 'brimonidina',
  'dorzolamida', 'brinzolamida', 'acetazolamida', 'pilocarpina', 'atropina oftálmica',
  'tropicamida', 'ciclopentolato', 'fenilefrina oftálmica',
  'prednisolona oftálmica', 'loteprednol', 'fluorometolona',
  'moxifloxacino oftálmico', 'tobramicina oftálmica', 'tobramicina/dexametasona',
  'ranibizumab', 'aflibercept', 'brolucizumab', 'faricimab', 'verteporfina',
  'ciclosporina oftálmica', 'lágrimas artificiales', 'hialuronato de sodio',
  // ORL
  'fluticasona nasal', 'mometasona nasal', 'budesonida nasal', 'azelastina',
  'oximetazolina', 'fenilefrina nasal', 'ipratropio nasal',
  'cetirizina', 'levocetirizina', 'loratadina', 'desloratadina', 'fexofenadina', 'bilastina',
  'ebastina', 'rupatadina', 'clorfenamina', 'difenhidramina', 'hidroxizina',
  'ambroxol', 'bromhexina', 'acetilcisteína', 'carbocisteína', 'dextrometorfano',
  'benzonatato', 'levodropropizina', 'guaifenesina',
]

export const GINECO_OBSTETRICIA = [
  'oxitocina', 'carbetocina', 'ergonovina', 'metilergonovina', 'dinoprostona',
  'atosibán', 'nifedipino tocolítico', 'sulfato de magnesio',
  'progesterona', 'progesterona micronizada', 'didrogesterona', 'medroxiprogesterona',
  'estradiol', 'valerato de estradiol', 'estrógenos conjugados', 'tibolona',
  'etinilestradiol/levonorgestrel', 'etinilestradiol/drospirenona', 'etinilestradiol/gestodeno',
  'levonorgestrel', 'desogestrel', 'dienogest', 'acetato de ulipristal',
  'clomifeno', 'letrozol', 'gonadotropina coriónica', 'hCG', 'FSH recombinante',
  'cabergolina', 'ácido tranexámico', 'tamoxifeno', 'anastrozol', 'exemestano', 'fulvestrant',
  'mifepristona', 'metilergometrina',
  'hierro/ácido fólico', 'multivitamínico prenatal',
]

export const ANESTESIA_URGENCIAS = [
  'propofol', 'etomidato', 'ketamina', 'tiopental', 'dexmedetomidina',
  'sevoflurano', 'desflurano', 'isoflurano', 'óxido nitroso',
  'rocuronio', 'vecuronio', 'cisatracurio', 'atracurio', 'succinilcolina', 'sugammadex',
  'neostigmina', 'atropina', 'glicopirrolato',
  'lidocaína', 'bupivacaína', 'ropivacaína', 'levobupivacaína', 'mepivacaína', 'prilocaína',
  'remifentanilo', 'sufentanilo', 'alfentanilo',
  'adrenalina', 'epinefrina', 'noradrenalina', 'norepinefrina', 'vasopresina',
  'dopamina', 'dobutamina', 'milrinona', 'levosimendán',
  'nitroprusiato', 'labetalol intravenoso', 'esmolol', 'nicardipino', 'clevidipino',
  'flumazenil', 'protamina', 'dantroleno', 'intralipid',
  'gluconato de calcio', 'cloruro de calcio', 'bicarbonato de sodio',
  'manitol', 'solución salina hipertónica', 'albúmina', 'hartmann', 'solución Ringer lactato',
]

/** Marcas comerciales frecuentes en México — el médico las dicta como marca. */
export const MARCAS_COMERCIALES_MX = [
  'Tafil', 'Rivotril', 'Lexotan', 'Ativan', 'Valium',
  'Eliquis', 'Xarelto', 'Pradaxa', 'Lixiana', 'Sintrom', 'Coumadin', 'Clexane',
  'Ozempic', 'Wegovy', 'Mounjaro', 'Trulicity', 'Saxenda', 'Victoza', 'Rybelsus',
  'Jardiance', 'Forxiga', 'Invokana', 'Januvia', 'Galvus', 'Onglyza', 'Trayenta',
  'Glucophage', 'Dabex', 'Predial',
  'Lantus', 'Levemir', 'Tresiba', 'Toujeo', 'NovoRapid', 'Humalog', 'Fiasp',
  'Lipitor', 'Crestor', 'Zocor', 'Pravacol', 'Ezetrol', 'Repatha', 'Praluent',
  'Norvasc', 'Adalat', 'Cardura', 'Concor', 'Lopresor', 'Tenormin', 'Dilatrend',
  'Cozaar', 'Micardis', 'Diován', 'Atacand', 'Aprovel', 'Exforge', 'Co-Diován',
  'Lasix', 'Aldactone', 'Higrotón', 'Entresto', 'Procoralan',
  'Plavix', 'Brilinta', 'Effient', 'Cardioaspirina', 'Aspirina Protect',
  'Losec', 'Nexium', 'Pantozol', 'Controloc', 'Dexilant', 'Pepcidine',
  'Plasil', 'Motilium', 'Zofran', 'Dramamine',
  'Eutirox', 'Synthroid', 'Karet', 'Tapazol',
  'Lyrica', 'Neurontin', 'Cymbalta', 'Tryptanol', 'Keppra', 'Epamin', 'Tegretol',
  'Depakene', 'Lamictal', 'Topamax', 'Trileptal',
  'Prozac', 'Zoloft', 'Lexapro', 'Paxil', 'Effexor', 'Wellbutrin', 'Remeron',
  'Zyprexa', 'Risperdal', 'Seroquel', 'Abilify', 'Invega',
  'Voltaren', 'Cataflam', 'Dolac', 'Mobic', 'Celebrex', 'Arcoxia', 'Feldene',
  'Tempra', 'Tylenol', 'Advil', 'Motrín', 'Flanax', 'Naxen', 'Neo-Melubrina', 'Plidan',
  'Tramacet', 'Sinergix', 'Temgesic', 'Durogesic',
  'Augmentin', 'Amoxil', 'Pentrexyl', 'Bactrim', 'Septrin', 'Klaricid', 'Zithromax',
  'Cravit', 'Avelox', 'Ciproxina', 'Flagyl', 'Vibramicina', 'Dalacin', 'Rocephin',
  'Diflucan', 'Sporanox', 'Vfend', 'Zovirax', 'Valtrex', 'Tamiflu',
  'Ventolin', 'Seretide', 'Symbicort', 'Spiriva', 'Relvar', 'Trelegy', 'Berodual',
  'Singulair', 'Xolair', 'Nucala', 'Dupixent',
  'Allegra', 'Zyrtec', 'Claritin', 'Aerius', 'Avapena', 'Virlix',
  'Nasonex', 'Flonase', 'Rinofluimucil', 'Afrin',
  'Humira', 'Enbrel', 'Remicade', 'Stelara', 'Cosentyx', 'Taltz', 'Skyrizi',
  'Xeljanz', 'Olumiant', 'Rinvoq', 'Mabthera', 'Actemra',
  'Prograf', 'Sandimmun', 'CellCept', 'Imuran', 'Medrol', 'Meticorten', 'Calcort',
  'Fosamax', 'Actonel', 'Prolia', 'Forteo', 'Evista',
  'Zyloprim', 'Adenuric', 'Colchiquim',
  'Viagra', 'Cialis', 'Levitra', 'Avodart', 'Proscar', 'Flomax', 'Secotex', 'Omnic',
  'Vesicare', 'Betmiga', 'Ditropan',
  'Yasmin', 'Diane', 'Belara', 'Mirena', 'Cerazette', 'Primolut',
  'Roaccutan', 'Differin', 'Benzac', 'Elidel', 'Protopic', 'Dermovate', 'Elocon',
  'Xalatan', 'Lumigan', 'Cosopt', 'Alphagan', 'Eylea', 'Lucentis', 'Restasis', 'Lagricel',
  'Keytruda', 'Opdivo', 'Avastin', 'Herceptin', 'Tagrisso', 'Glivec', 'Tarceva',
]

/* ────────────────────────────────────────────────────────────
 * LABORATORIO / MICROBIOLOGÍA / IMAGENOLOGÍA / PROCEDIMIENTOS
 * ──────────────────────────────────────────────────────────── */

export const LABORATORIO = [
  // Hematología
  'biometría hemática', 'BH', 'hemoglobina', 'hematocrito', 'plaquetas', 'leucocitos',
  'volumen corpuscular medio', 'VCM', 'hemoglobina corpuscular media', 'HCM',
  'concentración de hemoglobina corpuscular media', 'CHCM',
  'eritrocitos', 'reticulocitos', 'neutrófilos', 'linfocitos', 'monocitos', 'eosinófilos', 'basófilos',
  'frotis de sangre periférica',
  // Coagulación
  'tiempo de protrombina', 'TP', 'INR', 'tiempo de tromboplastina parcial activada', 'TTPa',
  'fibrinógeno', 'dímero D', 'antitrombina III', 'proteína C', 'proteína S',
  'anti-Xa', 'anti-factor X activado',
  // Química
  'glucosa', 'urea', 'BUN', 'creatinina', 'ácido úrico',
  'aspartato aminotransferasa', 'AST', 'TGO', 'alanino aminotransferasa', 'ALT', 'TGP',
  'fosfatasa alcalina', 'FA', 'gamma glutamil transferasa', 'GGT',
  'bilirrubina total', 'bilirrubina directa', 'bilirrubina indirecta',
  'albúmina', 'proteínas totales', 'globulinas',
  'lactato', 'lactato deshidrogenasa', 'LDH', 'amilasa', 'lipasa',
  'creatinfosfokinasa', 'CPK', 'CK-MB', 'troponina I', 'troponina T', 'troponina ultrasensible',
  'BNP', 'NT-proBNP',
  // Electrolitos
  'sodio', 'potasio', 'cloro', 'calcio', 'calcio iónico', 'fósforo', 'magnesio',
  // Gasometría
  'gasometría arterial', 'gasometría venosa', 'pH', 'pCO2', 'pO2', 'bicarbonato', 'exceso de base', 'HCO3',
  // Lípidos
  'colesterol total', 'LDL', 'HDL', 'no-HDL', 'triglicéridos', 'apolipoproteína B', 'apoB', 'Lp(a)',
  // Endocrino
  'hormona estimulante de tiroides', 'TSH', 'T4 libre', 'T4 total', 'T3 libre', 'T3 total',
  'anti-TPO', 'anti-tiroglobulina', 'tiroglobulina',
  'hemoglobina glicada', 'HbA1c', 'insulina', 'péptido C', 'fructosamina',
  'cortisol matutino', 'cortisol salival', 'ACTH', 'aldosterona', 'renina',
  'prolactina', 'FSH', 'LH', 'estradiol', 'progesterona', 'testosterona total', 'testosterona libre',
  'DHEA-S', 'SHBG', '17-hidroxiprogesterona',
  'IGF-1', 'GH', 'PTH', 'calcitonina',
  '25-hidroxivitamina D', 'vitamina D',
  // Inflamación
  'proteína C reactiva', 'PCR', 'PCR ultrasensible', 'velocidad de sedimentación globular', 'VSG',
  'procalcitonina', 'ferritina', 'IL-6', 'TNF-alfa',
  // Hierro
  'hierro sérico', 'transferrina', 'saturación de transferrina', 'TSAT', 'capacidad total de fijación',
  // Inmunología / autoinmunidad
  'anticuerpos antinucleares', 'ANA', 'patrón homogéneo', 'patrón moteado', 'patrón nucleolar',
  'anti-DNA de doble cadena', 'anti-DNA', 'anti-Sm', 'anti-Ro', 'anti-La', 'anti-RNP',
  'anti-Scl-70', 'anti-Jo-1', 'anti-centrómero',
  'anti-cardiolipina IgG', 'anti-cardiolipina IgM', 'anti-beta2-glicoproteína I', 'anticoagulante lúpico',
  'ANCA', 'c-ANCA', 'p-ANCA', 'anti-MPO', 'anti-PR3',
  'complemento C3', 'complemento C4', 'CH50',
  'factor reumatoide', 'FR', 'anti-péptido cíclico citrulinado', 'anti-CCP',
  'IgG', 'IgM', 'IgA', 'IgE', 'IgE específica',
  // Infecciosos serológicos
  'VIH ELISA', 'VIH Western blot', 'carga viral del VIH', 'recuento de CD4', 'CD4', 'CD8',
  'VDRL', 'RPR', 'FTA-ABS', 'TPHA',
  'antígeno de superficie de hepatitis B', 'HBsAg', 'anti-HBs', 'anti-HBc IgM', 'anti-HBc total', 'HBeAg', 'anti-HBe',
  'carga viral hepatitis B', 'DNA-VHB',
  'anti-VHC', 'carga viral hepatitis C', 'RNA-VHC', 'genotipo VHC',
  'anti-VHA IgM', 'anti-VHA total',
  'dengue NS1', 'dengue IgM', 'dengue IgG', 'chikungunya IgM',
  'COVID-19 PCR', 'antígeno SARS-CoV-2', 'anti-SARS-CoV-2 IgG',
  'paludismo', 'gota gruesa', 'frotis para paludismo',
  'toxoplasma IgG', 'toxoplasma IgM', 'CMV IgG', 'CMV IgM', 'EBV VCA IgG', 'EBV VCA IgM',
  'herpes simple IgG', 'herpes simple IgM', 'VZV IgG',
  'leptospira IgM', 'brucella aglutinaciones', 'Salmonella aglutinaciones', 'PPD', 'IGRA', 'QuantiFERON',
  // Microbiología / cultivos
  'hemocultivo', 'urocultivo', 'coprocultivo', 'cultivo de esputo', 'cultivo de exudado faríngeo',
  'cultivo de exudado nasal', 'cultivo de LCR', 'cultivo de líquido pleural', 'cultivo de líquido ascítico',
  'cultivo de líquido sinovial', 'cultivo de catéter', 'cultivo de herida',
  'antibiograma', 'CIM', 'MIC', 'concentración inhibitoria mínima',
  'tinción de Gram', 'tinción de Ziehl-Neelsen', 'tinción auramina', 'KOH', 'tinta china',
  'detección de antígeno de criptococo', 'galactomanano', 'beta-D-glucano',
  // Orina
  'examen general de orina', 'EGO', 'sedimento urinario', 'urocultivo', 'microalbuminuria',
  'cociente albúmina-creatinina urinaria', 'creatinina urinaria de 24 horas',
  'depuración de creatinina', 'DCC', 'TFG estimada', 'eGFR',
  // Heces
  'coproparasitoscópico', 'coproparasitoscópico seriado', 'CPS', 'sangre oculta en heces',
  'calprotectina fecal', 'antígeno de Helicobacter pylori en heces',
  'toxina A y B de Clostridioides difficile', 'GDH', 'PCR para C. difficile',
  // Hormonas y otros
  'AFP', 'alfa-fetoproteína', 'CEA', 'antígeno carcinoembrionario',
  'CA 19-9', 'CA 125', 'CA 15-3', 'PSA', 'PSA libre',
]

export const IMAGENOLOGIA = [
  'radiografía de tórax', 'placa de tórax', 'Rx tórax', 'radiografía simple',
  'radiografía de abdomen', 'placa simple de abdomen', 'serie ósea',
  'ultrasonido abdominal', 'USG abdominal', 'eco abdominal',
  'ultrasonido pélvico', 'ultrasonido transvaginal', 'ultrasonido obstétrico',
  'ultrasonido renal', 'ultrasonido tiroideo', 'ultrasonido mamario',
  'ultrasonido Doppler', 'eco Doppler',
  'tomografía simple', 'tomografía contrastada', 'TAC', 'TC',
  'tomografía de tórax', 'tomografía de abdomen y pelvis', 'tomografía de cráneo',
  'angiotomografía pulmonar', 'angio-TC', 'angiografía',
  'resonancia magnética', 'RMN', 'resonancia magnética con contraste',
  'PET-CT', 'PET-scan', 'SPECT', 'gammagrafía ósea', 'gammagrafía tiroidea', 'gammagrafía renal',
  'ecocardiograma transtorácico', 'ecocardiograma transesofágico', 'eco-estrés',
  'electrocardiograma', 'ECG', 'EKG', 'monitoreo Holter', 'MAPA', 'prueba de esfuerzo',
  'colangiopancreatografía retrógrada endoscópica', 'CPRE', 'colangiografía por resonancia', 'colangio-RMN',
  'urografía excretora', 'urotomografía', 'cistografía',
  'panendoscopia', 'endoscopia digestiva alta', 'colonoscopia', 'rectosigmoidoscopia', 'cápsula endoscópica',
  'broncoscopia', 'mediastinoscopia', 'cistoscopia', 'histeroscopia',
  'mamografía', 'tomosíntesis',
  'densitometría ósea', 'DXA',
]

export const PROCEDIMIENTOS_QUIRURGICOS = [
  'colecistectomía', 'apendicectomía', 'herniorrafia', 'plastia inguinal',
  'cesárea', 'salpingoclasia', 'OTB', 'histerectomía',
  'prostatectomía', 'RTU de próstata', 'nefrectomía',
  'tiroidectomía', 'paratiroidectomía',
  'mastectomía', 'cuadrantectomía', 'biopsia de ganglio centinela',
  'artroscopia', 'artroplastia de cadera', 'artroplastia de rodilla',
  'fijación interna', 'osteosíntesis', 'amputación',
  'cirugía de revascularización coronaria', 'bypass coronario', 'intervención coronaria percutánea', 'PCI',
  'cateterismo cardiaco', 'angioplastia', 'stent coronario',
  'craneotomía', 'derivación ventrículo-peritoneal',
  'paracentesis', 'toracocentesis', 'punción lumbar', 'biopsia hepática',
  'colocación de catéter venoso central', 'catéter Mahurkar', 'catéter Port-a-Cath',
]

export const ABREVIATURAS: Record<string, string> = {
  // Enfermedades
  DM2: 'diabetes mellitus tipo 2', DM1: 'diabetes mellitus tipo 1',
  HAS: 'hipertensión arterial sistémica', HTA: 'hipertensión arterial',
  ERC: 'enfermedad renal crónica', IRA: 'insuficiencia renal aguda',
  EPOC: 'enfermedad pulmonar obstructiva crónica',
  IAM: 'infarto agudo de miocardio', SCA: 'síndrome coronario agudo',
  ICC: 'insuficiencia cardiaca congestiva', ICFEr: 'insuficiencia cardiaca con fracción de eyección reducida',
  ICFEp: 'insuficiencia cardiaca con fracción de eyección preservada',
  EVC: 'enfermedad vascular cerebral', AIT: 'accidente isquémico transitorio',
  FA: 'fibrilación auricular', FLA: 'flutter auricular',
  IVU: 'infección de vías urinarias', ITU: 'infección del tracto urinario',
  NAC: 'neumonía adquirida en la comunidad', NAH: 'neumonía adquirida en el hospital',
  TVP: 'trombosis venosa profunda', TEP: 'tromboembolia pulmonar',
  EII: 'enfermedad inflamatoria intestinal', CUCI: 'colitis ulcerosa crónica inespecífica',
  ERGE: 'enfermedad por reflujo gastroesofágico', HDA: 'hemorragia digestiva alta', HDB: 'hemorragia digestiva baja',
  HTP: 'hipertensión portal', EHGNA: 'enfermedad hepática grasa no alcohólica',
  AR: 'artritis reumatoide', LES: 'lupus eritematoso sistémico', EA: 'espondilitis anquilosante',
  // Signos / exploración
  FC: 'frecuencia cardiaca', FR: 'frecuencia respiratoria', TA: 'tensión arterial', PA: 'presión arterial',
  SatO2: 'saturación de oxígeno', SpO2: 'saturación de oxígeno por pulsioximetría',
  IMC: 'índice de masa corporal',
  EVA: 'escala visual analógica del dolor',
  ECG: 'electrocardiograma', EKG: 'electrocardiograma',
  // Laboratorios
  BH: 'biometría hemática', QS: 'química sanguínea', PFH: 'pruebas de función hepática',
  PFR: 'pruebas de función renal', PFT: 'pruebas de función tiroidea',
  EGO: 'examen general de orina', CPS: 'coproparasitoscópico seriado',
  HbA1c: 'hemoglobina glicada', PCR: 'proteína C reactiva', VSG: 'velocidad de sedimentación globular',
  LDH: 'lactato deshidrogenasa', CPK: 'creatinfosfokinasa',
  TSH: 'hormona estimulante de tiroides', T4L: 'tiroxina libre',
  VDRL: 'VDRL', RPR: 'reaginina plasmática rápida',
  TP: 'tiempo de protrombina', INR: 'razón internacional normalizada',
  TTPa: 'tiempo de tromboplastina parcial activada',
  // Microbiología
  BLEE: 'beta-lactamasa de espectro extendido', AmpC: 'AmpC beta-lactamasa',
  MRSA: 'Staphylococcus aureus resistente a meticilina',
  VRE: 'Enterococcus resistente a vancomicina',
  CRE: 'Enterobacterales resistentes a carbapenémicos',
  // Servicios
  UCI: 'unidad de cuidados intensivos', UCIN: 'unidad de cuidados intensivos neonatales',
  // Otros
  CIE10: 'Clasificación Internacional de Enfermedades décima revisión',
  NOM: 'Norma Oficial Mexicana', SSA: 'Secretaría de Salud',
  GDM: 'diabetes mellitus gestacional',
  TARV: 'terapia antirretroviral', TAR: 'tratamiento antirretroviral',
  PROA: 'programa de optimización del uso de antimicrobianos',
}

export const MICROBIOLOGIA_PATOGENOS = [
  // Bacterias Gram +
  'Staphylococcus aureus', 'Staphylococcus epidermidis', 'Staphylococcus saprophyticus',
  'Streptococcus pneumoniae', 'Streptococcus pyogenes', 'Streptococcus agalactiae', 'Streptococcus viridans',
  'Enterococcus faecalis', 'Enterococcus faecium',
  'Listeria monocytogenes', 'Corynebacterium diphtheriae',
  'Clostridium perfringens', 'Clostridioides difficile', 'Clostridium tetani', 'Clostridium botulinum',
  // Bacterias Gram -
  'Escherichia coli', 'Klebsiella pneumoniae', 'Klebsiella oxytoca', 'Enterobacter cloacae', 'Enterobacter aerogenes',
  'Proteus mirabilis', 'Proteus vulgaris', 'Morganella morganii', 'Serratia marcescens',
  'Salmonella typhi', 'Salmonella enteritidis', 'Shigella', 'Yersinia enterocolitica',
  'Pseudomonas aeruginosa', 'Acinetobacter baumannii', 'Stenotrophomonas maltophilia', 'Burkholderia cepacia',
  'Haemophilus influenzae', 'Moraxella catarrhalis', 'Bordetella pertussis',
  'Neisseria meningitidis', 'Neisseria gonorrhoeae',
  'Helicobacter pylori', 'Campylobacter jejuni',
  'Legionella pneumophila',
  // Atípicas
  'Mycoplasma pneumoniae', 'Chlamydia pneumoniae', 'Chlamydia trachomatis', 'Coxiella burnetii',
  // Micobacterias
  'Mycobacterium tuberculosis', 'Mycobacterium avium-intracellulare', 'Mycobacterium kansasii', 'Mycobacterium leprae',
  // Hongos
  'Candida albicans', 'Candida glabrata', 'Candida krusei', 'Candida auris', 'Candida tropicalis', 'Candida parapsilosis',
  'Cryptococcus neoformans', 'Histoplasma capsulatum', 'Coccidioides immitis', 'Coccidioides posadasii',
  'Aspergillus fumigatus', 'Aspergillus flavus', 'Aspergillus terreus',
  'Pneumocystis jirovecii',
  // Parásitos comunes
  'Plasmodium falciparum', 'Plasmodium vivax', 'Plasmodium ovale', 'Plasmodium malariae',
  'Toxoplasma gondii', 'Trypanosoma cruzi', 'Leishmania',
  'Entamoeba histolytica', 'Giardia lamblia', 'Cryptosporidium',
  'Ascaris lumbricoides', 'Strongyloides stercoralis', 'Trichuris trichiura',
  // Virus
  'virus de la influenza A H1N1', 'virus de la influenza A H3N2', 'virus de la influenza B',
  'virus sincitial respiratorio', 'rinovirus', 'adenovirus', 'parainfluenza',
  'virus del herpes simple tipo 1', 'virus del herpes simple tipo 2', 'virus varicela zóster',
  'citomegalovirus', 'virus de Epstein-Barr', 'virus del herpes humano 6', 'virus del herpes humano 8',
  'virus de la hepatitis A', 'virus de la hepatitis B', 'virus de la hepatitis C', 'virus de la hepatitis D', 'virus de la hepatitis E',
  'virus del papiloma humano', 'rotavirus', 'norovirus', 'enterovirus',
  'virus del dengue', 'virus del chikungunya', 'virus del Zika',
  'SARS-CoV-2', 'COVID-19',
]

/* ════════════════════════════════════════════════════════════════
 * Normalización fonética del español + Levenshtein
 * ════════════════════════════════════════════════════════════════ */

/** Convierte una palabra a su forma fonética canónica del español. */
export function fonetEs(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // sin acentos
    .replace(/v/g, 'b')                                 // v↔b
    .replace(/ll/g, 'y')                                // yeísmo
    .replace(/x/g, 'ks')                                // examen → eksamen
    .replace(/y/g, 'i')                                 // y vocálica
    .replace(/z/g, 's')                                 // seseo
    .replace(/c([eéií])/g, 's$1')                       // ce/ci → se/si
    .replace(/g([eéií])/g, 'j$1')                       // ge/gi → je/ji
    .replace(/qu([eéií])/g, 'k$1').replace(/qu/g, 'k')  // qu → k
    .replace(/c([aoouú])/g, 'k$1')                      // ca/co/cu → ka/ko/ku
    .replace(/c$/, 'k')
    .replace(/h/g, '')                                  // h muda
    .replace(/ñ/g, 'ni')
    .replace(/[-/.,'`´']/g, '')                          // signos
    .replace(/\s+/g, ' ')                               // espacios
    .trim()
}

/** Distancia de Levenshtein (iterativa, O(n·m)). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a) return b.length
  if (!b) return a.length
  const dp = Array(b.length + 1).fill(0).map((_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : Math.min(prev, dp[j], dp[j - 1]) + 1
      prev = tmp
    }
  }
  return dp[b.length]
}

/* ════════════════════════════════════════════════════════════════
 * Vocabulario unificado + índice fonético
 * ════════════════════════════════════════════════════════════════ */

const TODOS_LOS_TERMINOS: string[] = [
  ...ANTIBIOTICOS, ...ANTIFUNGICOS, ...ANTIVIRALES, ...ANTIRRETROVIRALES,
  ...CARDIOVASCULARES, ...ENDOCRINO_METABOLICO, ...INMUNOSUPRESORES_BIOLOGICOS,
  ...PSICOFARMACOS, ...ANALGESICOS_AINE, ...OPIOIDES,
  ...ANTINEOPLASICOS_COMUNES, ...INHALADORES_BRONCODILATADORES,
  ...GASTRO, ...NEFRO_UROLOGICO, ...HEMATO, ...VACUNAS,
  // v2 — todas las especialidades
  ...NEUROLOGIA, ...REUMA_OSTEO, ...DERMA_OFTALMO_ORL,
  ...GINECO_OBSTETRICIA, ...ANESTESIA_URGENCIAS, ...MARCAS_COMERCIALES_MX,
  ...LABORATORIO, ...IMAGENOLOGIA, ...PROCEDIMIENTOS_QUIRURGICOS,
  ...MICROBIOLOGIA_PATOGENOS,
  ...Object.values(ABREVIATURAS),  // forma expandida también es buena
  ...Object.keys(ABREVIATURAS),     // y la abreviada
]

// Índice fonético: forma fonética → término canónico
const INDICE_FONETICO: Map<string, string> = (() => {
  const m = new Map<string, string>()
  for (const t of TODOS_LOS_TERMINOS) {
    const f = fonetEs(t)
    if (!m.has(f)) m.set(f, t)
  }
  return m
})()

// Lista de palabras médicas para Lev: solo las que son "raras" (poco común en español)
const TERMINOS_LEV: { term: string; fonet: string }[] = TODOS_LOS_TERMINOS
  // multipalabra se maneja aparte; aquí solo palabras únicas
  .filter(t => !t.includes(' ') && !t.includes('/') && t.length >= 5)
  .map(t => ({ term: t, fonet: fonetEs(t) }))

// Set de palabras españolas comunes que NO debemos "corregir" a término médico
const PALABRAS_COMUNES = new Set([
  'paciente','consulta','tratamiento','dolor','fiebre','tos','dosis','medicamento',
  'historia','clinico','clínica','antecedente','familiar','personal','social',
  'examen','laboratorio','imagen','estudio','diagnostico','diagnóstico','plan',
  'mismo','misma','antes','despues','después','desde','hasta','para','porque',
  'sobre','tambien','también','entre','cuando','donde','cuanto','cuanta','muchas',
  'muchos','poco','poca','pocas','pocos','este','esta','estos','estas','aquel',
  'aquella','aquellos','aquellas','algunos','algunas','varios','varias','siempre',
  'nunca','luego','despues','muy','mas','menos','bastante','casi','algunas','ningun',
  'ninguna','ningunos','ningunas','encuentra','realiza','observa','presenta','refiere',
  'tienen','tiene','tener','dice','dicen','dijo','dijeron','tomar','tomando','toma',
  'hace','dias','días','meses','años','semanas','aumenta','disminuye','mejora','empeora',
])

/* ════════════════════════════════════════════════════════════════
 * CORRECTOR DE TRANSCRIPCIÓN
 * ════════════════════════════════════════════════════════════════ */

export interface CambioTranscripcion {
  original: string
  corregido: string
  motivo: 'fonético' | 'levenshtein' | 'abreviatura' | 'diccionario'
}

export interface ResultadoCorreccion {
  corregido: string
  cambios: CambioTranscripcion[]
}

const REGEX_PALABRA = /([A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9-]*)/g

/** Decide si la distancia es aceptable según el largo de la palabra. */
function distAceptable(distancia: number, longitud: number): boolean {
  if (longitud <= 4) return distancia === 0
  if (longitud <= 7) return distancia <= 1
  if (longitud <= 11) return distancia <= 2
  return distancia <= 3
}

/** Busca la mejor coincidencia médica para una palabra. */
function mejorCandidato(palabra: string): { term: string; motivo: CambioTranscripcion['motivo'] } | null {
  const limpia = palabra.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (PALABRAS_COMUNES.has(limpia)) return null
  if (limpia.length < 5) return null

  // 1. Abreviatura literal (mayúsculas)
  const upper = palabra.toUpperCase()
  if (ABREVIATURAS[upper]) {
    return { term: upper, motivo: 'abreviatura' }   // mantiene la sigla, no la expande
  }

  // 2. Coincidencia fonética exacta
  const fon = fonetEs(palabra)
  const matchFon = INDICE_FONETICO.get(fon)
  if (matchFon && fonetEs(matchFon) === fon && matchFon.toLowerCase() !== limpia) {
    return { term: matchFon, motivo: 'fonético' }
  }

  // 3. Levenshtein contra términos de longitud parecida
  let mejor: { term: string; dist: number } | null = null
  for (const { term, fonet } of TERMINOS_LEV) {
    if (Math.abs(fonet.length - fon.length) > 3) continue
    const d = levenshtein(fonet, fon)
    if (!distAceptable(d, Math.max(fonet.length, fon.length))) continue
    if (!mejor || d < mejor.dist) mejor = { term, dist: d }
    if (mejor.dist === 0) break
  }
  if (mejor && mejor.term.toLowerCase() !== limpia) {
    return { term: mejor.term, motivo: 'levenshtein' }
  }
  return null
}

/* ════════════════════════════════════════════════════════════════
 * DICCIONARIO DE CONFUSIONES CONOCIDAS
 *
 * Errores REALES observados en producción (screenshot del Dr., 2026-06-11):
 *   "Empaq linfocina"  ← empagliflozina   (distancia fonética 3)
 *   "Dag glifos Inna"  ← dapagliflozina   (distancia 4 — irrecuperable
 *                                           por fonética; solo diccionario)
 *   "Plátano pros"     ← latanoprost      (¡Whisper oyó una fruta!)
 *   "dap glifos"       ← dapagliflozina
 *
 * Cada vez que el médico reporte una confusión nueva, se agrega aquí.
 * Matching: minúsculas + sin acentos, frase completa con límites de palabra.
 * Este pase corre PRIMERO (antes de n-gramas y palabra-por-palabra).
 * ════════════════════════════════════════════════════════════════ */

export const CONFUSIONES_CONOCIDAS: Record<string, string> = {
  // ── Gliflozinas (iSGLT2) — las más destrozadas por Whisper ──
  'empaq linfocina': 'empagliflozina',
  'empac linfocina': 'empagliflozina',
  'empa linfocina': 'empagliflozina',
  'empaq lifocina': 'empagliflozina',
  'empa glifocina': 'empagliflozina',
  'empagli fozina': 'empagliflozina',
  'empaglifocina': 'empagliflozina',
  'empaglifozina': 'empagliflozina',
  'dag glifos inna': 'dapagliflozina',
  'dag glifos ina': 'dapagliflozina',
  'dag glifosina': 'dapagliflozina',
  'dap glifos': 'dapagliflozina',
  'dapa glifos': 'dapagliflozina',
  'dapaglifozina': 'dapagliflozina',
  'dapaglifocina': 'dapagliflozina',
  'cana glifos': 'canagliflozina',
  'canaglifozina': 'canagliflozina',
  // ── Oftálmicos ──
  'platano pros': 'latanoprost',
  'platano prost': 'latanoprost',
  'latano pros': 'latanoprost',
  // ── GLP-1 ──
  'sema glutida': 'semaglutida',
  'tirse patida': 'tirzepatida',
  'tirze patida': 'tirzepatida',
  'lira glutida': 'liraglutida',
  'dula glutida': 'dulaglutida',
  // ── Otros patrones frecuentes de partición ──
  'leve tiracetam': 'levetiracetam',
  'keto rolaco': 'ketorolaco',
  'pantopra sol': 'pantoprazol',
}

/** Índice normalizado (sin acentos) para matching robusto */
const CONFUSIONES_NORMALIZADAS: Array<{ regex: RegExp; term: string; clave: string }> = (() => {
  const lista: Array<{ regex: RegExp; term: string; clave: string }> = []
  for (const [frase, term] of Object.entries(CONFUSIONES_CONOCIDAS)) {
    // Construir regex tolerante: espacios flexibles, límites de palabra,
    // case-insensitive, acentos opcionales en vocales
    const cuerpo = frase
      .replace(/[aá]/g, '[aá]')
      .replace(/[eé]/g, '[eé]')
      .replace(/[ií]/g, '[ií]')
      .replace(/[oó]/g, '[oó]')
      .replace(/[uú]/g, '[uú]')
      .replace(/\s+/g, '\\s+')
    lista.push({ regex: new RegExp(`(?<![A-Za-zÁÉÍÓÚáéíóúñÑ])${cuerpo}(?![A-Za-zÁÉÍÓÚáéíóúñÑ])`, 'gi'), term, clave: frase })
  }
  // Frases más largas primero (evita que "dap glifos" gane sobre "dag glifos inna")
  return lista.sort((a, b) => b.clave.length - a.clave.length)
})()

/** Aplica el diccionario de confusiones conocidas. Corre PRIMERO. */
export function aplicarConfusionesConocidas(texto: string): ResultadoCorreccion {
  const cambios: CambioTranscripcion[] = []
  let corregido = texto
  for (const { regex, term } of CONFUSIONES_NORMALIZADAS) {
    corregido = corregido.replace(regex, (match) => {
      const empMay = match[0] === match[0].toUpperCase()
      const sustituto = empMay ? term[0].toUpperCase() + term.slice(1) : term
      cambios.push({ original: match, corregido: sustituto, motivo: 'diccionario' })
      return sustituto
    })
  }
  return { corregido, cambios }
}

/* ════════════════════════════════════════════════════════════════
 * PASE DE N-GRAMAS — une palabras PARTIDAS por Whisper
 *
 * Whisper parte fármacos largos que no conoce:
 *   "empagliflozina"  → "em pagli flozina"
 *   "dapagliflozina"  → "dapa gli flozina"
 *   "ácido zoledrónico" → "asido soledronico"
 * El corrector palabra-por-palabra NUNCA puede arreglar eso.
 * Este pase prueba ventanas de 2-3 palabras consecutivas:
 *   a) unidas SIN espacio  → vs términos de una palabra
 *   b) unidas CON espacio  → vs términos multipalabra
 * Umbral: el MISMO distAceptable() del pase palabra-por-palabra
 * (≤2 para 8-11 chars, ≤3 para ≥12) — calibrado con errores reales:
 * "empaqlinfosina"→"empagliflosina" es distancia 3.
 * ════════════════════════════════════════════════════════════════ */

/** ¿El token es una palabra "pura" (sin puntuación pegada)? */
const REGEX_PALABRA_PURA = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9-]*$/

function buscarTerminoUnido(fonUnido: string): string | null {
  // Coincidencia exacta en el índice fonético
  const exacto = INDICE_FONETICO.get(fonUnido)
  if (exacto && fonUnido.length >= 8) return exacto
  // Levenshtein con el mismo umbral que palabra-por-palabra (distAceptable),
  // solo para uniones de ≥10 chars fonéticos (las cortas son riesgosas)
  if (fonUnido.length >= 10) {
    let mejor: { term: string; dist: number } | null = null
    for (const { term, fonet } of TERMINOS_LEV) {
      if (Math.abs(fonet.length - fonUnido.length) > 3) continue
      const d = levenshtein(fonet, fonUnido)
      if (!distAceptable(d, Math.max(fonet.length, fonUnido.length))) continue
      if (!mejor || d < mejor.dist) mejor = { term, dist: d }
      if (mejor.dist === 0) break
    }
    if (mejor) return mejor.term
  }
  return null
}

export function corregirNGramas(texto: string): ResultadoCorreccion {
  const cambios: CambioTranscripcion[] = []
  // split conservando los separadores de espacio (índices impares)
  const tokens = texto.split(/(\s+)/)
  // posiciones de tokens que son palabras puras
  const posPalabras: number[] = []
  for (let i = 0; i < tokens.length; i++) {
    if (REGEX_PALABRA_PURA.test(tokens[i])) posPalabras.push(i)
  }

  let w = 0
  while (w < posPalabras.length) {
    let reemplazado = false
    // ventana 3 primero (más específica), luego 2
    for (const n of [3, 2]) {
      if (w + n > posPalabras.length) continue
      const idxs = posPalabras.slice(w, w + n)
      // las palabras deben ser CONSECUTIVAS en el texto (solo espacios entre ellas)
      if (idxs[idxs.length - 1] - idxs[0] !== (n - 1) * 2) continue
      const palabras = idxs.map(i => tokens[i])
      // si la unión es muy corta no vale la pena
      const unida = palabras.join('')
      if (unida.length < 8) continue
      // si TODAS son palabras comunes del español, no intentar
      const todasComunes = palabras.every(p =>
        PALABRAS_COMUNES.has(p.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''))
      )
      if (todasComunes) continue

      // a) unidas sin espacio → término de una palabra
      // b) unidas con espacio → término multipalabra ("ácido fólico")
      const term = buscarTerminoUnido(fonetEs(unida)) ?? buscarTerminoUnido(fonetEs(palabras.join(' ')))
      if (!term) continue
      // no reemplazar si ya estaba bien escrito
      if (term.toLowerCase() === palabras.join(' ').toLowerCase()) { reemplazado = false; break }

      // conservar capitalización inicial
      const empMay = palabras[0][0] === palabras[0][0].toUpperCase()
      const sustituto = empMay && term[0] !== term[0].toUpperCase()
        ? term[0].toUpperCase() + term.slice(1)
        : term
      cambios.push({ original: palabras.join(' '), corregido: sustituto, motivo: 'fonético' })
      // sustituir: primer token = término completo, el resto (palabras y espacios intermedios) se vacían
      tokens[idxs[0]] = sustituto
      for (let k = idxs[0] + 1; k <= idxs[idxs.length - 1]; k++) tokens[k] = ''
      w += n
      reemplazado = true
      break
    }
    if (!reemplazado) w++
  }

  return { corregido: tokens.join(''), cambios }
}

/**
 * Corrige una transcripción aplicando el vocabulario médico.
 * Conservadora: solo cambia cuando hay alta confianza.
 *
 * Orden de pases:
 *   0. Diccionario de confusiones CONOCIDAS (errores reales reportados)
 *   1. N-gramas: une palabras que Whisper partió ("em pagli flozina")
 *   2. Palabra por palabra: fonético exacto → Levenshtein acotado
 */
export function corregirTranscripcion(texto: string): ResultadoCorreccion {
  // Pase 0 — confusiones conocidas (lo más certero primero)
  const pase0 = aplicarConfusionesConocidas(texto)
  // Pase 1 — n-gramas (palabras partidas)
  const pase1 = corregirNGramas(pase0.corregido)
  const cambios: CambioTranscripcion[] = [...pase0.cambios, ...pase1.cambios]

  // Pase 2 — palabra por palabra
  const corregido = pase1.corregido.replace(REGEX_PALABRA, (palabra) => {
    const cand = mejorCandidato(palabra)
    if (!cand) return palabra
    // Conservar la capitalización original (si la palabra empieza en mayúscula)
    const empMay = palabra[0] === palabra[0].toUpperCase()
    const sustituto = empMay && cand.term[0] !== cand.term[0].toUpperCase()
      ? cand.term[0].toUpperCase() + cand.term.slice(1)
      : cand.term
    cambios.push({ original: palabra, corregido: sustituto, motivo: cand.motivo })
    return sustituto
  })
  return { corregido, cambios }
}

/* ════════════════════════════════════════════════════════════════
 * Prompt biased para Whisper (≤ ~200 tokens)
 * ════════════════════════════════════════════════════════════════ */

export const WHISPER_PROMPT_MEDICO = [
  // ⚠️ LÍMITE DE WHISPER: usa solo los ÚLTIMOS ~224 tokens del prompt.
  // Si crece más, se trunca EN SILENCIO y el sesgo se pierde (bug real
  // que tuvimos con la versión de ~1000 tokens). Aquí van SOLO los
  // fármacos más mal transcritos. El vocabulario completo de todas las
  // especialidades vive en corregirTranscripcion() — sin límite.
  'Consulta médica en México. Fármacos:',
  'empagliflozina, dapagliflozina, canagliflozina, semaglutida, tirzepatida, liraglutida,',
  'sitagliptina, linagliptina, insulina glargina, insulina degludec,',
  'atorvastatina, rosuvastatina, losartán, telmisartán, bisoprolol, carvedilol,',
  'espironolactona, sacubitrilo/valsartán, apixabán, rivaroxabán, dabigatrán, ticagrelor,',
  'levetiracetam, lamotrigina, pregabalina, escitalopram, venlafaxina, quetiapina,',
  'meropenem, ertapenem, piperacilina/tazobactam, vancomicina, linezolid, daptomicina,',
  'ceftriaxona, cefepime, ceftazidima/avibactam, levofloxacino, claritromicina,',
  'trimetoprim/sulfametoxazol, fluconazol, voriconazol, caspofungina,',
  'tacrolimus, micofenolato, rituximab, adalimumab, tocilizumab, hidroxicloroquina,',
  'tamsulosina, alopurinol, colchicina, denosumab, levotiroxina, isotretinoína,',
  'latanoprost, oxitocina, propofol, rocuronio, ondansetrón.',
  'Términos: procalcitonina, hemocultivo, antibiograma, BLEE, MRSA, HbA1c, qSOFA, desescalada.',
].join(' ')
