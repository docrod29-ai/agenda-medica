/**
 * Catálogo farmacológico sistemático por clasificación ATC (OMS) + Cuadro
 * Básico de Medicamentos del Sector Salud (México).
 *
 * POR QUÉ ESTE ARCHIVO:
 * El vocabulario base (medical-vocabulary.ts) cubre los fármacos más usados
 * por especialidad. Este archivo COMPLETA la cobertura recorriendo las 14
 * categorías anatómicas ATC (A→V) para que el motor fonético + Levenshtein
 * del corrector tenga la mayor probabilidad de acertar ante una transcripción
 * imperfecta de Whisper.
 *
 * IMPORTANTE: un vocabulario grande NO arregla las mis-audiciones graves
 * (esas van al diccionario de confusiones). Sí mejora los errores "cercanos"
 * (1-3 caracteres de distancia fonética).
 *
 * Denominación: DCI (denominación común internacional) en español. Sin dosis.
 * Mantenimiento: agregar por grupo ATC para no duplicar ni perder cobertura.
 */

// ─── A — Tracto alimentario y metabolismo ───────────────────────
export const ATC_A = [
  // A02 — Antiácidos, antiulcerosos
  'hidróxido de aluminio', 'hidróxido de magnesio', 'carbonato de calcio', 'bismuto subsalicilato',
  'magaldrato', 'almagato', 'alginato de sodio', 'vonoprazan', 'tegoprazan',
  // A03 — Antiespasmódicos, procinéticos
  'butilhioscina', 'hioscina', 'mebeverina', 'otilonio', 'pinaverio', 'trimebutina',
  'dimeticona', 'simeticona', 'cinitaprida', 'itoprida', 'prucaloprida',
  // A04 — Antieméticos
  'meclizina', 'dimenhidrinato', 'ciclizina', 'doxilamina', 'rolapitant', 'netupitant', 'fosaprepitant',
  // A06 — Laxantes
  'bisacodilo', 'picosulfato de sodio', 'glicerina', 'plantago ovata', 'psyllium', 'macrogol',
  'lubiprostona', 'linaclotida', 'plecanatida', 'metilnaltrexona', 'naldemedina',
  // A07 — Antidiarreicos, antiinflamatorios intestinales
  'racecadotrilo', 'octreotida', 'budesonida oral', 'balsalazida', 'olsalazina',
  'saccharomyces boulardii', 'lactobacillus', 'bismuto',
  // A10 — Antidiabéticos (complemento)
  'gliclazida', 'gliquidona', 'glipizida', 'miglitol', 'voglibosa', 'teneligliptina',
  'evogliptina', 'gemigliptina', 'imeglimina', 'bexagliflozina', 'sotagliflozina',
  // A11-A12 — Vitaminas y minerales
  'tiamina', 'riboflavina', 'piridoxina', 'cianocobalamina', 'ácido ascórbico', 'colecalciferol',
  'ergocalciferol', 'retinol', 'tocoferol', 'fitomenadiona', 'biotina', 'niacinamida',
  'gluconato de calcio', 'citrato de calcio', 'óxido de magnesio', 'sulfato de magnesio',
  'gluconato de zinc', 'sulfato de zinc', 'selenio', 'cromo', 'yoduro de potasio',
  // A16 — Otros del aparato digestivo y metabolismo
  'orlistat', 'fentermina', 'fentermina/topiramato', 'naltrexona/bupropión', 'setmelanotida',
  'miglustat', 'eliglustat', 'sapropterina', 'nitisinona', 'betaína', 'carglúmico',
]

// ─── B — Sangre y órganos hematopoyéticos ───────────────────────
export const ATC_B = [
  // B01 — Antitrombóticos
  'abciximab', 'eptifibatida', 'tirofibán', 'vorapaxar', 'defibrotida',
  'alteplasa', 'tenecteplasa', 'reteplasa', 'estreptoquinasa', 'uroquinasa',
  'danaparoid', 'desirudina', 'lepirudina',
  // B02 — Antihemorrágicos
  'ácido aminocaproico', 'etamsilato', 'fitomenadiona', 'complejo protrombínico',
  'factor VIII', 'factor IX', 'factor VII activado', 'emicizumab', 'concizumab',
  'fibrinógeno humano', 'desmopresina', 'romiplostim', 'avatrombopag', 'lusutrombopag',
  // B03 — Antianémicos (complemento)
  'hierro dextrano', 'hierro isomaltósido', 'gluconato férrico', 'ferrimanitol',
  'roxadustat', 'daprodustat', 'vadadustat', 'molidustat',
  // B05 — Sustitutos del plasma y soluciones
  'solución salina', 'solución glucosada', 'solución mixta', 'hartmann', 'plasmalyte',
  'almidón hidroxietílico', 'gelatina', 'dextrano', 'manitol', 'glicerol',
]

// ─── C — Cardiovascular (complemento) ───────────────────────────
export const ATC_C = [
  // C01 — Cardiacos
  'digoxina', 'metildigoxina', 'milrinona', 'enoximona', 'levosimendán',
  'adenosina', 'vernakalant', 'ivabradina', 'ranolazina', 'nicorandil', 'molsidomina',
  'mexiletina', 'disopiramida', 'quinidina', 'procainamida', 'ajmalina',
  // C02 — Antihipertensivos
  'clonidina', 'metildopa', 'moxonidina', 'rilmenidina', 'guanfacina',
  'prazosina', 'terazosina', 'doxazosina', 'urapidil', 'minoxidil',
  'hidralazina', 'dihidralazina', 'bosentán', 'ambrisentán', 'macitentán', 'riociguat',
  'selexipag', 'epoprostenol', 'iloprost', 'treprostinil', 'sildenafil pulmonar',
  // C03 — Diuréticos (complemento)
  'metolazona', 'xipamida', 'piretanida', 'canrenona', 'finerenona',
  'acetazolamida', 'tolvaptán', 'conivaptán',
  // C07 — Beta-bloqueadores (complemento)
  'celiprolol', 'betaxolol', 'acebutolol', 'pindolol', 'oxprenolol', 'sotalol', 'landiolol',
  // C08 — Bloqueadores de canales de calcio (complemento)
  'nicardipino', 'nisoldipino', 'nimodipino', 'nitrendipino', 'isradipino', 'clevidipino', 'manidipino',
  // C09 — IECA / ARA (complemento)
  'trandolapril', 'cilazapril', 'imidapril', 'zofenopril', 'moexipril', 'espirapril',
  'azilsartán', 'fimasartán', 'eprosartán',
  // C10 — Hipolipemiantes (complemento)
  'bezafibrato', 'ciprofibrato', 'colestipol', 'colesevelam', 'ácido nicotínico',
  'lomitapida', 'mipomersén', 'evinacumab', 'volanesorsén', 'ácido omega-3',
]

// ─── D — Dermatológicos (complemento) ───────────────────────────
export const ATC_D = [
  'mupirocina', 'ácido fusídico', 'retapamulina', 'gentamicina tópica', 'neomicina tópica',
  'sulfadiazina de plata', 'nitrofural', 'clioquinol',
  'ciclopirox', 'amorolfina', 'sertaconazol', 'eberconazol', 'flutrimazol', 'oxiconazol',
  'tioconazol', 'bifonazol', 'naftifina', 'butenafina',
  'aciclovir tópico', 'penciclovir tópico', 'imiquimod', 'podofilotoxina', 'sinecatequinas',
  'tazaroteno', 'trifaroteno', 'tapinarof', 'crisaborol', 'ruxolitinib tópico', 'roflumilast tópico',
  'pimecrolimus', 'calcineurina', 'antralina', 'brea de hulla', 'ácido salicílico',
  'urea tópica', 'ácido láctico', 'tacalcitol', 'calcitriol tópico',
  'eflornitina', 'bimatoprost dermatológico', 'metilaminolevulinato', 'fluorouracilo tópico',
  'ingenol mebutato', 'diclofenaco tópico', 'capsaicina',
]

// ─── G — Genitourinario y hormonas sexuales (complemento) ───────
export const ATC_G = [
  'clotrimazol vaginal', 'nistatina vaginal', 'metronidazol vaginal', 'clindamicina vaginal',
  'fenticonazol', 'butoconazol', 'terconazol', 'dequalinio',
  'estriol', 'promestrieno', 'ospemifeno', 'prasterona',
  'noretisterona', 'linestrenol', 'clormadinona', 'nomegestrol', 'drospirenona',
  'nestorona', 'segesterona', 'elagolix', 'relugolix', 'linzagolix',
  'flibanserina', 'bremelanotida', 'oxitocina', 'carbetocina', 'dinoprostona', 'misoprostol',
  'finasterida', 'dutasterida', 'alfuzosina', 'silodosina', 'tadalafil prostático',
  'darifenacina', 'fesoterodina', 'trospio', 'propiverina', 'vibegron',
  'dapoxetina', 'alprostadil', 'papaverina', 'fentolamina',
]

// ─── H — Hormonal sistémico (complemento) ───────────────────────
export const ATC_H = [
  'somatropina', 'somatrogón', 'lonapegsomatropina', 'mecasermina', 'pegvisomant',
  'lanreotida', 'pasireotida', 'desmopresina', 'terlipresina', 'vasopresina',
  'tiroxina', 'liotironina', 'tiratricol',
  'carbimazol', 'tiamazol', 'propiltiouracilo', 'lugol', 'perclorato de potasio',
  'cinacalcet', 'etelcalcetida', 'paricalcitol', 'doxercalciferol', 'maxacalcitol',
  'teriparatida', 'abaloparatida', 'paratohormona', 'calcitonina',
  'fludrocortisona', 'cortisona', 'triamcinolona', 'betametasona', 'parametasona',
  'deflazacort', 'cloprednol', 'meprednisona',
  'metirapona', 'osilodrostat', 'ketoconazol antiadrenal', 'mitotano', 'mifepristona',
]

// ─── J — Antiinfecciosos sistémicos (complemento) ───────────────
export const ATC_J = [
  // Penicilinas
  'bencilpenicilina', 'fenoximetilpenicilina', 'flucloxacilina', 'temocilina', 'mecilinam',
  'sulbactam', 'tazobactam', 'avibactam', 'relebactam', 'vaborbactam', 'durlobactam',
  // Cefalosporinas
  'cefaclor', 'cefprozil', 'cefdinir', 'cefditoren', 'cefpodoxima', 'cefixima', 'ceftibuteno',
  'cefoperazona', 'cefsulodina', 'cefamandol', 'cefonicid', 'cefmetazol', 'cefminox', 'cefpiroma',
  // Carbapenémicos y otros betalactámicos
  'biapenem', 'panipenem', 'tebipenem', 'sulopenem', 'faropenem',
  // Macrólidos/cetólidos
  'josamicina', 'midecamicina', 'espiramicina', 'telitromicina', 'solitromicina', 'flurithromicina',
  // Quinolonas
  'pefloxacino', 'lomefloxacino', 'rufloxacino', 'prulifloxacino', 'besifloxacino', 'finafloxacino',
  'sitafloxacino', 'zabofloxacino', 'nemonoxacino', 'lascufloxacino', 'ácido nalidíxico', 'ácido pipemídico',
  // Otros antibacterianos
  'lefamulina', 'contezolid', 'cadazolid', 'ridinilazol', 'gepotidacina', 'zoliflodacina',
  'temocilina', 'pivmecilinam', 'espectinomicina', 'novobiocina', 'fusafungina',
  'metenamina', 'nifurtoinol', 'furazolidona', 'nifuroxazida',
  // Antimicobacterianos
  'rifapentina', 'rifaximina', 'terizidona', 'tioacetazona', 'morinamida',
  // Antifúngicos
  'fosfluconazol', 'ravuconazol', 'efinaconazol', 'luliconazol', 'rezafungina', 'ibrexafungerp',
  'olorofim', 'fosmanogepix', 'oteseconazol',
  // Antivirales
  'brincidofovir', 'tecovirimat', 'pleconaril', 'pocapavir', 'maribavir',
  'sofosbuvir', 'ledipasvir', 'velpatasvir', 'voxilaprevir', 'glecaprevir', 'pibrentasvir',
  'daclatasvir', 'elbasvir', 'grazoprevir', 'ombitasvir', 'paritaprevir', 'dasabuvir',
  'entecavir', 'telbivudina', 'adefovir', 'bulevirtida', 'lenacapavir', 'islatravir',
  'doravirina', 'fostemsavir', 'temsavir', 'leronlimab',
  'sotrovimab', 'tixagevimab', 'cilgavimab', 'bebtelovimab', 'ensitrelvir',
  // Antiparasitarios sistémicos
  'cloroquina', 'hidroxicloroquina', 'primaquina', 'tafenoquina', 'mefloquina', 'lumefantrina',
  'artemeter', 'artesunato', 'dihidroartemisinina', 'piperaquina', 'amodiaquina', 'pirimetamina',
  'atovacuona', 'proguanil', 'quinina', 'pentamidina', 'miltefosina',
  'nifurtimox', 'benznidazol', 'suramina', 'melarsoprol', 'eflornitina', 'fexinidazol',
]

// ─── L — Antineoplásicos e inmunomoduladores (complemento) ──────
export const ATC_L = [
  'melfalán', 'clorambucilo', 'busulfán', 'tiotepa', 'dacarbazina', 'temozolomida',
  'bendamustina', 'estramustina', 'trabectedina', 'lurbinectedina',
  'mercaptopurina', 'tioguanina', 'fludarabina', 'cladribina', 'clofarabina', 'nelarabina',
  'citarabina', 'azacitidina', 'decitabina', 'pemetrexed', 'raltitrexed', 'pralatrexato',
  'vinorelbina', 'vindesina', 'cabazitaxel', 'eribulina', 'ixabepilona',
  'etopósido', 'tenipósido', 'mitoxantrona', 'idarrubicina', 'epirrubicina', 'daunorrubicina',
  'valrubicina', 'pixantrona', 'mitomicina', 'dactinomicina', 'plicamicina',
  'nedaplatino', 'lobaplatino', 'satraplatino',
  // Inhibidores de tirosina cinasa
  'bosutinib', 'ponatinib', 'asciminib', 'ruxolitinib', 'fedratinib', 'pacritinib', 'momelotinib',
  'ibrutinib', 'acalabrutinib', 'zanubrutinib', 'pirtobrutinib',
  'idelalisib', 'copanlisib', 'duvelisib', 'umbralisib', 'alpelisib', 'inavolisib',
  'palbociclib', 'ribociclib', 'abemaciclib', 'trilaciclib',
  'olaparib', 'rucaparib', 'niraparib', 'talazoparib',
  'vemurafenib', 'dabrafenib', 'encorafenib', 'trametinib', 'cobimetinib', 'binimetinib', 'selumetinib',
  'axitinib', 'cabozantinib', 'regorafenib', 'tivozanib', 'fruquintinib', 'anlotinib', 'apatinib',
  'cediranib', 'vandetanib', 'lenvatinib', 'midostaurina', 'gilteritinib', 'quizartinib',
  'larotrectinib', 'entrectinib', 'repotrectinib', 'selpercatinib', 'pralsetinib',
  'capmatinib', 'tepotinib', 'savolitinib', 'crizotinib', 'ceritinib', 'alectinib', 'brigatinib', 'lorlatinib',
  'afatinib', 'dacomitinib', 'osimertinib', 'mobocertinib', 'amivantamab', 'lazertinib',
  'sotorasib', 'adagrasib', 'sacituzumab', 'trastuzumab deruxtecán', 'enhertu',
  'tucatinib', 'neratinib', 'pyrotinib',
  'venetoclax', 'navitoclax', 'glasdegib', 'sonidegib', 'vismodegib',
  'bortezomib', 'carfilzomib', 'ixazomib', 'panobinostat', 'vorinostat', 'romidepsina', 'belinostat',
  'tazemetostat', 'enasidenib', 'ivosidenib', 'olutasidenib',
  // Inmunoterapia / anticuerpos
  'cemiplimab', 'dostarlimab', 'retifanlimab', 'tislelizumab', 'toripalimab', 'sintilimab', 'camrelizumab',
  'tremelimumab', 'relatlimab', 'tiragolumab',
  'blinatumomab', 'mosunetuzumab', 'epcoritamab', 'glofitamab', 'teclistamab', 'talquetamab', 'elranatamab',
  'tafasitamab', 'loncastuximab', 'polatuzumab', 'brentuximab', 'gemtuzumab', 'inotuzumab',
  'daratumumab', 'isatuximab', 'elotuzumab', 'belantamab',
  'margetuximab', 'mirvetuximab', 'enfortumab', 'tisotumab', 'disitamab',
  'dinutuximab', 'naxitamab', 'olaratumab', 'ramucirumab', 'necitumumab',
  // Terapia celular / hormonal antineoplásica
  'tisagenlecleucel', 'axicabtagén', 'brexucabtagén', 'lisocabtagén', 'idecabtagén', 'ciltacabtagén',
  'bicalutamida', 'flutamida', 'nilutamida', 'enzalutamida', 'apalutamida', 'darolutamida',
  'abiraterona', 'leuprorelina', 'goserelina', 'triptorelina', 'buserelina', 'degarelix', 'relugolix',
  'tamoxifeno', 'toremifeno', 'anastrozol', 'letrozol', 'exemestano', 'fulvestrant', 'elacestrant',
  'megestrol', 'medroxiprogesterona oncológica',
]

// ─── M — Sistema musculoesquelético (complemento) ───────────────
export const ATC_M = [
  'aceclofenaco', 'acemétacina', 'proglumetacina', 'sulindaco', 'tolmetina', 'ketoprofeno',
  'dexketoprofeno', 'flurbiprofeno', 'fenoprofeno', 'ácido tiaprofénico', 'ácido mefenámico',
  'ácido flufenámico', 'ácido niflúmico', 'lornoxicam', 'lumiracoxib', 'firocoxib',
  'fenilbutazona', 'oxifenbutazona', 'nabumetona', 'azapropazona', 'benzidamina',
  'baclofeno', 'tizanidina', 'ciclobenzaprina', 'metocarbamol', 'orfenadrina', 'carisoprodol',
  'clorzoxazona', 'tiocolchicósido', 'pridinol', 'eperisona', 'tolperisona', 'dantroleno',
  'penicilamina', 'aurotiomalato', 'auranofina',
  'rasburicasa', 'lesinurad', 'benzbromarona', 'sulfinpirazona',
  'ácido ibandrónico', 'ácido pamidrónico', 'ácido clodrónico', 'ácido etidrónico', 'ácido tiludrónico',
  'burosumab', 'asfotasa alfa',
]

// ─── N — Sistema nervioso (complemento) ─────────────────────────
export const ATC_N = [
  // Anestésicos
  'tiopental', 'metohexital', 'óxido nitroso', 'xenón', 'halotano', 'enflurano',
  'articaina', 'tetracaína', 'cloroprocaína', 'cincocaína', 'benzocaína', 'oxetacaína',
  // Analgésicos opioides
  'petidina', 'meperidina', 'piritramida', 'dextropropoxifeno', 'dihidrocodeína', 'nalbufina',
  'butorfanol', 'pentazocina', 'meptazinol', 'tilidina', 'oxicodona/naloxona', 'cebranopadol',
  // Antimigraña
  'almotriptán', 'frovatriptán', 'avitriptán', 'ergotamina', 'dihidroergotamina', 'metisergida',
  'lasmiditán', 'atogepant', 'zavegepant',
  // Antiepilépticos (complemento)
  'primidona', 'sultiamo', 'estiripentol', 'rufinamida', 'tiagabina', 'felbamato', 'progabida',
  'fenfluramina', 'ganaxolona', 'fintepla', 'beclamida', 'metsuximida', 'fensuximida',
  // Antiparkinsonianos (complemento)
  'tolcapona', 'pergolida', 'lisurida', 'cabergolina', 'piribedil', 'bromocriptina',
  'istradefilina', 'foslevodopa', 'opicapona',
  // Antipsicóticos (complemento)
  'amisulprida', 'sulpirida', 'tiaprida', 'pimozida', 'flupentixol', 'zuclopentixol', 'clotiapina',
  'loxapina', 'molindona', 'asenapina', 'iloperidona', 'lurasidona', 'brexpiprazol', 'cariprazina',
  'lumateperona', 'pimavanserina', 'trifluoperazina', 'perfenazina', 'flufenazina', 'tioridazina',
  'levomepromazina', 'clorpromazina', 'periciazina',
  // Ansiolíticos / hipnóticos (complemento)
  'bromazepam', 'cloxazolam', 'clobazam', 'clorazepato', 'ketazolam', 'pinazepam', 'prazepam',
  'halazepam', 'medazepam', 'tetrazepam', 'flurazepam', 'flunitrazepam', 'nitrazepam', 'temazepam',
  'estazolam', 'triazolam', 'brotizolam', 'loprazolam', 'lormetazepam', 'cuazepam',
  'buspirona', 'hidroxizina', 'meprobamato', 'clometiazol', 'ramelteón', 'tasimelteón',
  'suvorexant', 'lemborexant', 'daridorexant', 'dexmedetomidina',
  // Antidepresivos (complemento)
  'fluvoxamina', 'agomelatina', 'reboxetina', 'milnaciprán', 'levomilnaciprán', 'vilazodona',
  'maprotilina', 'mianserina', 'amoxapina', 'doxepina', 'trimipramina', 'dosulepina', 'lofepramina',
  'tranilcipromina', 'fenelzina', 'moclobemida', 'esketamina', 'brexanolona', 'zuranolona',
  'tianeptina', 'opipramol',
  // Demencia / otros SNC
  'tacrina', 'idebenona', 'piracetam', 'pramiracetam', 'oxiracetam', 'aniracetam', 'fenibut',
  'vinpocetina', 'nimodipino', 'naftidrofurilo', 'pentoxifilina', 'flunarizina', 'cinarizina',
  'betahistina', 'acetilleucina', 'fampridina', 'tetrabenazina', 'deutetrabenazina', 'valbenazina',
  'riluzol', 'edaravona', 'tofersén', 'nusinersén', 'risdiplam', 'onasemnogén',
  // Adicciones
  'vareniclina', 'citisina', 'bupropión', 'acamprosato', 'disulfiram', 'nalmefeno', 'buprenorfina/naloxona',
  'lofexidina', 'metadona',
  // TDAH
  'metilfenidato', 'dexmetilfenidato', 'lisdexanfetamina', 'dextroanfetamina', 'atomoxetina',
  'guanfacina', 'clonidina', 'viloxazina', 'solriamfetol', 'pitolisant',
]

// ─── P — Antiparasitarios ───────────────────────────────────────
export const ATC_P = [
  'metronidazol', 'tinidazol', 'ornidazol', 'secnidazol', 'nimorazol',
  'albendazol', 'mebendazol', 'tiabendazol', 'flubendazol', 'fenbendazol',
  'pamoato de pirantel', 'pamoato de pirvinio', 'levamisol', 'niclosamida', 'praziquantel',
  'ivermectina', 'moxidectina', 'dietilcarbamazina', 'oxamniquina', 'triclabendazol',
  'nitazoxanida', 'paromomicina', 'furoato de diloxanida', 'teclozán', 'etofamida', 'quinfamida',
  'permetrina', 'deltametrina', 'malatión', 'lindano', 'crotamitón', 'benzoato de bencilo',
  'espinosad', 'abametapir', 'dimeticona pediculicida',
]

// ─── R — Sistema respiratorio (complemento) ─────────────────────
export const ATC_R = [
  'terbutalina', 'fenoterol', 'procaterol', 'bambuterol', 'indacaterol', 'olodaterol',
  'reproterol', 'clenbuterol', 'isoetarina', 'orciprenalina',
  'ipratropio', 'oxitropio', 'revefenacina',
  'ciclesonida', 'flunisolida', 'triamcinolona inhalada',
  'teofilina', 'aminofilina', 'doxofilina', 'bamifilina', 'difilina',
  'roflumilast', 'cromoglicato', 'nedocromil', 'ketotifeno', 'zafirlukast', 'pranlukast',
  'mepolizumab', 'reslizumab', 'benralizumab', 'tezepelumab', 'omalizumab', 'dupilumab',
  'nintedanib', 'pirfenidona',
  'mannitol inhalado', 'dornasa alfa', 'ivacaftor', 'lumacaftor', 'tezacaftor', 'elexacaftor',
  'erdosteína', 'fudosteína', 'sobrerol', 'mesna inhalado', 'guaifenesina',
  'codeína antitusiva', 'folcodina', 'cloperastina', 'dropropizina', 'noscapina', 'oxolamina',
  'pentoxiverina', 'dimemorfán', 'butamirato',
  'difenhidramina', 'clemastina', 'dexclorfeniramina', 'triprolidina', 'azatadina', 'ciproheptadina',
  'mizolastina', 'mequitazina', 'epinastina', 'acrivastina', 'olopatadina', 'emedastina',
]

// ─── S — Órganos sensoriales (complemento) ──────────────────────
export const ATC_S = [
  'gentamicina oftálmica', 'ciprofloxacino oftálmico', 'gatifloxacino', 'besifloxacino',
  'azitromicina oftálmica', 'cloranfenicol oftálmico', 'ácido fusídico oftálmico',
  'ganciclovir oftálmico', 'trifluridina',
  'nepafenaco', 'bromfenaco', 'ketorolaco oftálmico', 'diclofenaco oftálmico', 'flurbiprofeno oftálmico',
  'dexametasona oftálmica', 'difluprednato', 'rimexolona', 'medrisona',
  'olopatadina oftálmica', 'ketotifeno oftálmico', 'epinastina oftálmica', 'cromoglicato oftálmico',
  'azelastina oftálmica', 'bepotastina', 'alcaftadina', 'emedastina oftálmica',
  'timolol', 'levobunolol', 'carteolol', 'metipranolol', 'betaxolol oftálmico',
  'dorzolamida', 'brinzolamida', 'apraclonidina', 'brimonidina', 'tafluprost', 'unoprostona',
  'latanoprosteno', 'netarsudil', 'ripasudil', 'pilocarpina', 'carbacol', 'fisostigmina',
  'ciclosporina oftálmica', 'lifitegrast', 'cenegermina', 'voretigén',
  'ciprofloxacino ótico', 'ofloxacino ótico', 'neomicina ótica', 'polimixina ótica',
]

// ─── V — Varios (medios de contraste, antídotos, etc.) ──────────
export const ATC_V = [
  'gadobutrol', 'gadoterato', 'gadobenato', 'gadoxetato', 'gadodiamida', 'gadoteridol', 'gadopiclenol',
  'iohexol', 'iodixanol', 'iopamidol', 'ioversol', 'iopromida', 'ioxitalamato', 'iobitridol',
  'sulfato de bario', 'hexafluoruro de azufre', 'perflutren', 'fluorodesoxiglucosa',
  'tecnecio', 'galio', 'lutecio', 'itrio', 'samario', 'radio-223', 'flúor-18',
  'deferoxamina', 'deferasirox', 'deferiprona', 'dimercaprol', 'edetato cálcico', 'penicilamina',
  'azul de prusia', 'tiosulfato de sodio', 'hidroxocobalamina', 'fomepizol', 'acetilcisteína antídoto',
  'flumazenil', 'naloxona', 'naltrexona', 'sugammadex', 'idarucizumab', 'andexanet alfa',
  'protamina', 'fitomenadiona', 'glucagón', 'octreotida antídoto', 'digoxina inmune fab',
  'crotalidae fab', 'antiveneno', 'fab antielapídico', 'bezlotoxumab', 'obiltoxaximab', 'raxibacumab',
  'sevelamer', 'carbonato de lantano', 'oxihidróxido sucroférrico', 'patiromer', 'ciclosilicato de zirconio',
  'lactulosa', 'rifaximina', 'ornitina aspartato', 'glicerol fenilbutirato', 'carglúmico',
]

/** Todos los términos ATC en un solo arreglo (consumido por el corrector). */
export const VOCABULARIO_ATC: string[] = [
  ...ATC_A, ...ATC_B, ...ATC_C, ...ATC_D, ...ATC_G, ...ATC_H,
  ...ATC_J, ...ATC_L, ...ATC_M, ...ATC_N, ...ATC_P, ...ATC_R,
  ...ATC_S, ...ATC_V,
]
