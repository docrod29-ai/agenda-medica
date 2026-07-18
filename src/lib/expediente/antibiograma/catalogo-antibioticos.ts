/**
 * Catálogo COMPLETO de antimicrobianos para el panel del antibiograma:
 * de los clásicos que siguen en uso a los aprobados más recientes (hasta 2026).
 * Agrupado por clase para que el médico encuentre rápido y el motor reconozca el
 * nombre genérico en español.
 */

export interface GrupoATB { clase: string; agentes: string[] }

export const CATALOGO_ATB: GrupoATB[] = [
  { clase: 'Penicilinas', agentes: [
    'Penicilina G', 'Penicilina V', 'Ampicilina', 'Amoxicilina', 'Oxacilina', 'Dicloxacilina',
    'Nafcilina', 'Piperacilina', 'Carbenicilina', 'Temocilina', 'Pivmecilinam',
  ] },
  { clase: 'Penicilina + inhibidor', agentes: [
    'Amoxicilina-clavulanato', 'Ampicilina-sulbactam', 'Piperacilina-tazobactam', 'Ticarcilina-clavulanato',
  ] },
  { clase: 'Cefalosporinas 1ª G', agentes: ['Cefazolina', 'Cefalexina', 'Cefalotina', 'Cefadroxilo'] },
  { clase: 'Cefalosporinas 2ª G / cefamicinas', agentes: ['Cefuroxima', 'Cefoxitina', 'Cefotetán', 'Cefaclor', 'Cefprozilo'] },
  { clase: 'Cefalosporinas 3ª G', agentes: [
    'Ceftriaxona', 'Cefotaxima', 'Ceftazidima', 'Cefixima', 'Cefpodoxima', 'Cefdinir', 'Ceftibuteno', 'Cefoperazona', 'Cefditoren',
  ] },
  { clase: 'Cefalosporinas 4ª G y anti-MRSA', agentes: ['Cefepime', 'Ceftarolina', 'Ceftobiprol'] },
  { clase: 'Cefalosporina sideróforo', agentes: ['Cefiderocol'] },
  { clase: 'β-lactámico + inhibidor (nuevos)', agentes: [
    'Ceftazidima-avibactam', 'Ceftolozano-tazobactam', 'Meropenem-vaborbactam', 'Imipenem-relebactam',
    'Aztreonam-avibactam', 'Sulbactam-durlobactam', 'Cefepime-taniborbactam', 'Cefepime-enmetazobactam',
  ] },
  { clase: 'Monobactámicos', agentes: ['Aztreonam'] },
  { clase: 'Carbapenémicos', agentes: ['Ertapenem', 'Imipenem', 'Meropenem', 'Doripenem', 'Tebipenem'] },
  { clase: 'Penems orales', agentes: ['Sulopenem'] },
  { clase: 'Aminoglucósidos', agentes: [
    'Gentamicina', 'Tobramicina', 'Amikacina', 'Netilmicina', 'Estreptomicina', 'Kanamicina', 'Neomicina', 'Plazomicina',
  ] },
  { clase: 'Quinolonas y fluoroquinolonas', agentes: [
    'Ácido nalidíxico', 'Ciprofloxacino', 'Levofloxacino', 'Moxifloxacino', 'Ofloxacino', 'Norfloxacino',
    'Gemifloxacino', 'Delafloxacino', 'Finafloxacino',
  ] },
  { clase: 'Macrólidos y cetólidos', agentes: [
    'Eritromicina', 'Claritromicina', 'Azitromicina', 'Espiramicina', 'Telitromicina', 'Solitromicina', 'Fidaxomicina',
  ] },
  { clase: 'Lincosamidas', agentes: ['Clindamicina', 'Lincomicina'] },
  { clase: 'Tetraciclinas y glicilciclinas', agentes: [
    'Tetraciclina', 'Doxiciclina', 'Minociclina', 'Tigeciclina', 'Eravaciclina', 'Omadaciclina', 'Sarecilina',
  ] },
  { clase: 'Glucopéptidos y lipoglucopéptidos', agentes: [
    'Vancomicina', 'Teicoplanina', 'Telavancina', 'Dalbavancina', 'Oritavancina',
  ] },
  { clase: 'Oxazolidinonas', agentes: ['Linezolid', 'Tedizolid', 'Contezolid'] },
  { clase: 'Lipopéptidos', agentes: ['Daptomicina'] },
  { clase: 'Polimixinas', agentes: ['Colistina', 'Polimixina B'] },
  { clase: 'Inhibidores de folato y sulfas', agentes: [
    'Trimetoprim-sulfametoxazol', 'Trimetoprim', 'Sulfadiazina', 'Sulfametoxazol',
  ] },
  { clase: 'Urinarios', agentes: ['Nitrofurantoína', 'Fosfomicina'] },
  { clase: 'Nitroimidazoles', agentes: ['Metronidazol', 'Tinidazol', 'Secnidazol'] },
  { clase: 'Rifamicinas', agentes: ['Rifampicina', 'Rifabutina', 'Rifapentina', 'Rifaximina'] },
  { clase: 'Otros y de nueva clase', agentes: [
    'Cloranfenicol', 'Ácido fusídico', 'Mupirocina', 'Quinupristina-dalfopristina',
    'Lefamulina', 'Gepotidacina', 'Zoliflodacina', 'Nitroxolina',
  ] },
  { clase: 'Antimicobacterianos', agentes: [
    'Isoniazida', 'Pirazinamida', 'Etambutol', 'Bedaquilina', 'Pretomanid', 'Delamanid', 'Clofazimina', 'Etionamida', 'Cicloserina',
  ] },
  { clase: 'Antifúngicos', agentes: [
    'Fluconazol', 'Itraconazol', 'Voriconazol', 'Posaconazol', 'Isavuconazol',
    'Anfotericina B', 'Flucitosina', 'Caspofungina', 'Micafungina', 'Anidulafungina',
    'Rezafungina', 'Ibrexafungerp', 'Nistatina',
  ] },
]

/** Lista plana de TODOS los agentes (para el autocompletado del panel). */
export const TODOS_ATB: string[] = CATALOGO_ATB.flatMap(g => g.agentes)

/** Los de uso más frecuente, para los botones rápidos. */
export const ATB_FRECUENTES: string[] = [
  'Oxacilina', 'Cefoxitina', 'Penicilina G', 'Ampicilina', 'Vancomicina', 'Ceftriaxona',
  'Ceftazidima', 'Cefepime', 'Piperacilina-tazobactam', 'Meropenem', 'Ertapenem',
  'Ciprofloxacino', 'Levofloxacino', 'Gentamicina', 'Amikacina', 'Trimetoprim-sulfametoxazol',
  'Clindamicina', 'Eritromicina', 'Linezolid', 'Daptomicina', 'Colistina', 'Tigeciclina',
  'Ceftazidima-avibactam', 'Cefiderocol',
]
