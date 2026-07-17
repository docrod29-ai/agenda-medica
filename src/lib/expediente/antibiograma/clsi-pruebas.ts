/**
 * Pruebas microbiológicas confirmatorias y fenotípicas del CLSI M100-Ed35 (2025):
 * cuándo hacerlas, el método y CÓMO INTERPRETARLAS. El motor las recomienda según
 * el fenotipo inferido, para cerrar el ciclo diagnóstico.
 *
 * Fuente: CLSI. Performance Standards for Antimicrobial Susceptibility Testing.
 *         35th ed. CLSI supplement M100 (Ed35), 2025. Tablas 3A-3L.
 *
 * Los criterios numéricos que se incluyen (ESBL, Carba NP) se transcriben de las
 * tablas leídas; para las pruebas cuyo detalle numérico vive en su tabla, se cita
 * la tabla y se describe la interpretación establecida (sin inventar cifras).
 */
import type { FenotipoClave, PruebaCLSI } from './tipos'

const M100 = 'CLSI M100-Ed35 (2025)'

export type { PruebaCLSI }

export const PRUEBAS: Record<string, PruebaCLSI> = {
  ESBL: {
    id: 'ESBL',
    nombre: 'Prueba confirmatoria de BLEE (β-lactamasa de espectro extendido)',
    cuando: 'Con los puntos de corte VIGENTES de cefalosporinas la prueba de BLEE NO es necesaria para reportar (se reporta tal como se probó); es útil para manejo terapéutico y para vigilancia/control de infecciones. Tamiz: cefpodoxima, ceftazidima, aztreonam, cefotaxima o ceftriaxona con halo reducido.',
    organismos: 'K. pneumoniae, K. oxytoca, E. coli y P. mirabilis (Tabla 3A).',
    metodo: 'Disco combinado o microdilución: ceftazidima y cefotaxima SOLAS vs en combinación con clavulanato (30/10 µg en disco).',
    interpretacion: 'DIFUSIÓN: aumento ≥5 mm del halo del agente combinado con clavulanato vs solo = BLEE (p. ej. ceftazidima 16 mm → ceftazidima-clavulanato 21 mm). MICRODILUCIÓN: disminución ≥3 diluciones (≥8×) de la CMI en combinación con clavulanato = BLEE. Con los puntos de corte actuales NO se cambia la interpretación a R por el solo hecho de ser BLEE — reportar como se probó.',
    referencia: `${M100} Tabla 3A`,
  },
  CARBA_NP: {
    id: 'CARBA_NP',
    nombre: 'Carba NP — detección rápida de producción de carbapenemasa',
    cuando: 'Enterobacterales y P. aeruginosa NO sensibles a ≥1 carbapenémico. Detecta producción de carbapenemasa (informa aislamiento/epidemiología); NO determina la clase.',
    organismos: 'Enterobacterales, P. aeruginosa (Tabla 3B).',
    metodo: 'Ensayo colorimétrico (rojo de fenol + imipenem). Tubo A = control interno; Tubo B = con imipenem. Lectura ≤2 h.',
    interpretacion: 'Tubo B rojo/rojo-naranja = NEGATIVO (no carbapenemasa). Tubo B naranja claro/amarillo oscuro/amarillo = POSITIVO (productor de carbapenemasa). Naranja = inválido. ⚠ Sensibilidad POBRE para OXA-48-like y Acinetobacter (usar mCIM/molecular).',
    referencia: `${M100} Tabla 3B`,
  },
  mCIM_eCIM: {
    id: 'mCIM_eCIM',
    nombre: 'mCIM / eCIM — inactivación de carbapenémico (modificada) ± EDTA',
    cuando: 'Enterobacterales (y P. aeruginosa para mCIM) NO sensibles a ≥1 carbapenémico. El eCIM (con EDTA) DISTINGUE serina- vs metalo-β-lactamasa.',
    organismos: 'Enterobacterales; P. aeruginosa (solo mCIM) (Tabla 3C).',
    metodo: 'mCIM: se incuba el aislado con un disco de meropenem y luego se siembra un indicador; requiere incubación nocturna. eCIM: mCIM en paralelo con EDTA.',
    interpretacion: 'mCIM POSITIVO = produce carbapenemasa. eCIM: si la actividad se RESTAURA con EDTA (halo crece) → METALO-β-lactamasa (NDM/VIM/IMP); si NO se restaura → serina-carbapenemasa (KPC/OXA-48). Falsos negativos si coproduce serina + metalo. NO identifica el gen específico.',
    referencia: `${M100} Tabla 3C`,
  },
  MOLECULAR: {
    id: 'MOLECULAR',
    nombre: 'Método molecular / inmunocromatográfico de carbapenemasa',
    cuando: 'Cuando se requiere el GEN específico para decidir terapia dirigida (KPC vs OXA-48 vs NDM/VIM/IMP).',
    organismos: 'Enterobacterales, no fermentadores.',
    metodo: 'PCR (p. ej. Xpert Carba-R) o inmunocromatografía (Carba 5 / RESIST-5).',
    interpretacion: 'Identifica el gen (KPC/NDM/OXA-48/VIM/IMP) → dirige el inhibidor: KPC→ceftazidima-avibactam/meropenem-vaborbactam/imipenem-relebactam; OXA-48→ceftazidima-avibactam o cefiderocol; MBL→aztreonam-avibactam o cefiderocol. ⚠ Falso negativo si el gen no está en el panel.',
    referencia: `${M100} Introducción a Tablas 3B-3C`,
  },
  CEFOXITINA_MRSA: {
    id: 'CEFOXITINA_MRSA',
    nombre: 'Tamiz de cefoxitina/oxacilina para resistencia a meticilina (mecA)',
    cuando: 'Staphylococcus para detectar MRSA (la cefoxitina es el mejor inductor/marcador de mecA).',
    organismos: 'S. aureus, S. lugdunensis y otros estafilococos (Tabla 2C; agar sal-oxacilina Tabla 3H).',
    metodo: 'Halo/CMI de cefoxitina (subrogado de oxacilina), o agar de tamiz oxacilina-sal, según los criterios de la Tabla 2C/3H del CLSI M100-Ed35.',
    interpretacion: 'Cefoxitina R (o tamiz positivo) = mecA/PBP2a → informar R a TODOS los β-lactámicos EXCEPTO las cefalosporinas anti-MRSA (ceftarolina). Cefoxitina S = usar β-lactámicos antiestafilocócicos.',
    referencia: `${M100} Tablas 2C y 3H`,
  },
  D_ZONE: {
    id: 'D_ZONE',
    nombre: 'D-zone test — resistencia inducible a clindamicina (MLSb inducible)',
    cuando: 'Estafilococo o estreptococo con ERITROMICINA R y CLINDAMICINA S (o intermedia).',
    organismos: 'Staphylococcus spp., S. pneumoniae y Streptococcus β-hemolíticos (Tabla 3J).',
    metodo: 'Discos de eritromicina y clindamicina adyacentes (aproximación indicada en la Tabla 3J del CLSI M100-Ed35).',
    interpretacion: 'Aplanamiento del halo de clindamicina del lado de la eritromicina (zona en "D") = POSITIVO → informar clindamicina RESISTENTE (metilasa erm inducible). D-zone negativo (bomba msrA) → clindamicina puede reportarse S.',
    referencia: `${M100} Tabla 3J`,
  },
  HLAR: {
    id: 'HLAR',
    nombre: 'Tamiz de resistencia de ALTO nivel a aminoglucósidos (HLAR)',
    cuando: 'Enterococo, para predecir sinergia β-lactámico/glucopéptido + aminoglucósido en endocarditis/infección grave.',
    organismos: 'Enterococcus spp. (Tabla 3L).',
    metodo: 'Tamiz de alto nivel para gentamicina y estreptomicina (agar/caldo), según la Tabla 3L del CLSI M100-Ed35.',
    interpretacion: 'HLAR POSITIVO (gentamicina de alto nivel R) → se PIERDE la sinergia β-lactámico + aminoglucósido (no usar el aminoglucósido para sinergia). Estreptomicina es un mecanismo independiente (probar por separado). HLAR negativo → la sinergia es posible.',
    referencia: `${M100} Tabla 3L`,
  },
  BETALACTAMASA_NITROCEFIN: {
    id: 'BETALACTAMASA_NITROCEFIN',
    nombre: 'Prueba de β-lactamasa (nitrocefina)',
    cuando: 'Estafilococo/enterococo antes de reportar penicilina S; también Haemophilus/gonococo.',
    organismos: 'Staphylococcus, Enterococcus (Tabla 3G).',
    metodo: 'Disco/reactivo de nitrocefina (cromogénico).',
    interpretacion: 'Nitrocefina POSITIVA = produce β-lactamasa (penicilinasa) → penicilina/ampicilina R (aunque el halo parezca S). En enterococo, un raro productor de β-lactamasa se detecta así (no por difusión).',
    referencia: `${M100} Tabla 3G`,
  },
  COLISTINA: {
    id: 'COLISTINA',
    nombre: 'Prueba de sensibilidad a colistina (microdilución en caldo)',
    cuando: 'Cuando se considere colistina/polimixina (la difusión en disco NO es fiable).',
    organismos: 'Enterobacterales, P. aeruginosa, Acinetobacter (Tabla 3E).',
    metodo: 'Microdilución en caldo (BMD) — método de referencia; la difusión en disco y el gradiente NO son válidos para colistina.',
    interpretacion: 'Interpretar la CMI según la Tabla 3E del CLSI M100-Ed35 (categoría "intermedio"/"resistente"; no hay categoría "susceptible" para colistina). Un halo por difusión NO es interpretable.',
    referencia: `${M100} Tabla 3E`,
  },
}

/** Recomienda las pruebas CLSI pertinentes según el organismo y los fenotipos inferidos. */
export function pruebasRecomendadas(organismo: string, fenotipos: FenotipoClave[]): PruebaCLSI[] {
  const set = new Set<string>()
  const has = (...cs: FenotipoClave[]) => cs.some(c => fenotipos.includes(c))

  if (has('BLEE')) set.add('ESBL')
  if (has('carbapenemasa')) { set.add('CARBA_NP'); set.add('mCIM_eCIM'); set.add('MOLECULAR') }
  if (has('porina-perdida')) { set.add('mCIM_eCIM'); set.add('MOLECULAR') } // patrón ertapenem-aislado: descartar OXA-48
  if (has('MRSA', 'BORSA')) set.add('CEFOXITINA_MRSA')
  if (has('MLSb-inducible')) set.add('D_ZONE')
  if (has('HLAR')) set.add('HLAR')
  if (has('penicilinasa-estafilococica')) set.add('BETALACTAMASA_NITROCEFIN')
  if (has('colistin-R') || /pseudomonas|acinetobacter|klebsiella|coli/i.test(organismo)) {
    // sugerir método correcto de colistina solo si el fenotipo es MDR/carbapenemasa (contexto de última línea)
    if (has('carbapenemasa', 'colistin-R', 'MDR', 'XDR')) set.add('COLISTINA')
  }
  return [...set].map(id => PRUEBAS[id]).filter(Boolean)
}
