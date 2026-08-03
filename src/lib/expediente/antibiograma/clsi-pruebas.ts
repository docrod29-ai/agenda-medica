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
import type { FenotipoClave, PruebaCLSI, PruebasConfirmatorias } from './tipos'

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
    nombre: 'Sensibilidad a colistina — métodos VALIDADOS',
    cuando: 'Cuando se considere colistina/polimixina B (última línea). La difusión en disco y el gradiente (E-test) NO son válidos y subestiman la R.',
    organismos: 'Enterobacterales, P. aeruginosa, Acinetobacter (Tabla 3E).',
    metodo: 'Métodos ACEPTADOS: (1) Microdilución en caldo BMD con colistina sulfato en poliestireno sin polisorbato-80 (REFERENCIA); (2) CBDE — Colistin Broth Disk Elution (elución de discos de 10 µg en 4 tubos de caldo → 0/1/2/4 µg/mL), validado y de bajo costo; (3) CAT — Colistin Agar Test (cribado). NO válidos: disco, gradiente/E-test, automatizados sin verificar.',
    interpretacion: 'Interpretar la CMI por BMD/CBDE según la Tabla 3E: solo hay categorías "Intermedio" (CMI ≤2) y "Resistente" (≥4) — NO existe "Sensible". Confirmar la R de colistina (mcr/mgrB) siempre por un método válido; considerar terapia combinada guiada por CMI.',
    referencia: `${M100} Tabla 3E`,
  },
  AMPC_CONFIRM: {
    id: 'AMPC_CONFIRM',
    nombre: 'Confirmación de AmpC (inhibición con cloxacilina / ác. borónico)',
    cuando: 'Cefoxitina R + C3G no-S en Enterobacterales, para distinguir AmpC de BLEE/carbapenemasa y desenmascarar una BLEE coproducida.',
    organismos: 'Enterobacterales (E. coli, Klebsiella, grupo ESCPM).',
    metodo: 'Disco combinado cefotetán/cefoxitina ± inhibidor de AmpC (cloxacilina o ác. 3-aminofenilborónico, APB). En medio CON cloxacilina se inhibe la AmpC y se "destapa" la BLEE (sinergia con clavulanato que antes quedaba oculta).',
    interpretacion: 'Aumento del halo con el inhibidor de AmpC (cloxacilina/APB) = AmpC confirmada. Si al inhibir la AmpC aparece sinergia con clavulanato → DOBLE productor AmpC + BLEE. La cefoxitina R por sí sola no distingue AmpC de pérdida de porina.',
    referencia: `${M100} Tablas 3A-3C + AmpC (Tamma/Doi/Bonomo, CID 2019)`,
  },
  SINERGIA_ESBL_DDST: {
    id: 'SINERGIA_ESBL_DDST',
    nombre: 'Sinergia de doble disco (DDST) para BLEE',
    cuando: 'Tamiz de BLEE positivo, para confirmar por sinergia con clavulanato.',
    organismos: 'Enterobacterales (Tabla 3A).',
    metodo: 'Discos de cefotaxima y ceftazidima colocados a 20 mm (borde a borde) de un disco de amoxicilina-clavulanato; o disco combinado C3G ± clavulanato.',
    interpretacion: 'Ampliación del halo de la cefalosporina HACIA el clavulanato ("tapón de champán"/zona en huso) = BLEE. En disco combinado: ≥5 mm de aumento con clavulanato = BLEE.',
    referencia: `${M100} Tabla 3A`,
  },
  SINERGIA_CARBAPENEMASA: {
    id: 'SINERGIA_CARBAPENEMASA',
    nombre: 'Doble detección de carbapenemasa por inhibidores (clase serina vs metalo)',
    cuando: 'Carbapenemasa confirmada/sospechada, para DIFERENCIAR la clase por inhibición (complementa mCIM/eCIM y molecular).',
    organismos: 'Enterobacterales, P. aeruginosa, Acinetobacter.',
    metodo: 'Disco combinado de meropenem ± inhibidores: ác. FENILBORÓNICO (APB, inhibe SERINA-carbapenemasas tipo KPC), EDTA o ác. dipicolínico (DPA, inhibe METALO-β-lactamasas NDM/VIM/IMP), y cloxacilina (AmpC). El eCIM (mCIM + EDTA) hace la misma distinción serina/metalo.',
    interpretacion: 'Sinergia SOLO con APB → KPC (serina). Sinergia SOLO con EDTA/DPA → MBL. Sinergia con AMBOS → doble carbapenemasa (KPC + MBL). Sin sinergia con ninguno pero mCIM+ → sospechar OXA-48-like (clase D, no se inhibe con APB ni EDTA). Confirmar con inmunocromatografía/molecular.',
    referencia: `${M100} Tablas 3B-3C + Simner/Pitout CMR 2024`,
  },
  INMUNOCROMATOGRAFIA: {
    id: 'INMUNOCROMATOGRAFIA',
    nombre: 'Inmunocromatografía de carbapenemasa (Carba-5 / RESIST-5)',
    cuando: 'Carbapenemasa positiva: identifica el TIPO en ~15 min (dirige el inhibidor).',
    organismos: 'Enterobacterales, P. aeruginosa, Acinetobacter.',
    metodo: 'Flujo lateral que detecta las 5 carbapenemasas más frecuentes: KPC, OXA-48-like, NDM, VIM, IMP, directo de la colonia.',
    interpretacion: 'Banda positiva identifica el gen → KPC/OXA-48 (serina) → ceftazidima-avibactam (KPC también mero-vaborbactam/imipenem-relebactam; OXA-48 solo avibactam/cefiderocol); NDM/VIM/IMP (metalo) → aztreonam-avibactam o cefiderocol. Falso negativo si la carbapenemasa no está en el panel de 5.',
    referencia: `${M100} Intro Tablas 3B-3C`,
  },
  DOBLE_PRODUCTOR: {
    id: 'DOBLE_PRODUCTOR',
    nombre: 'Sospecha de DOBLE productor de β-lactamasas',
    cuando: 'Patrón que sugiere ≥2 enzimas (p. ej. AmpC/BLEE + carbapenemasa, o carbapenemasa serina + metalo).',
    organismos: 'Enterobacterales, no fermentadores.',
    metodo: 'Combinación de pruebas: cloxacilina (destapa BLEE bajo AmpC), APB + EDTA (serina + metalo), aztreonam (respetado por MBL pero hidrolizado por serina coproducida). El molecular resuelve.',
    interpretacion: 'Ej.: "CAZ-AVI no-S + aztreonam no-S" en CRE = MBL + serina coproducida ("no es una carbapenemasa, son dos"). Cefoxitina R que enmascara una BLEE = AmpC + BLEE. Definir TODAS las enzimas cambia el esquema (p. ej. aztreonam-avibactam para MBL+serina).',
    referencia: `${M100} + Bush & Bradford 2019; Simner/Pitout CMR 2024`,
  },
}

/**
 * QUÉ PRUEBA RESPONDE CADA CONFIRMATORIA QUE YA VIENE EN EL REPORTE.
 *
 * No es una tabla nueva: es exactamente el emparejamiento que `confirmatorias.ts`
 * ya usa cuando la prueba sale positiva (cefoxitina→MRSA, D-test→MLSb inducible,
 * etc.). Aquí sirve para lo contrario: dejar de PEDIR una prueba cuyo resultado
 * el laboratorio ya imprimió.
 *
 * Se listan sólo las pruebas que responden LA MISMA pregunta con el MISMO método.
 * `SINERGIA_ESBL_DDST`, `MOLECULAR`, `INMUNOCROMATOGRAFIA` y `DOBLE_PRODUCTOR`
 * quedan fuera a propósito: son métodos alternativos o responden a otra pregunta
 * (qué CLASE de carbapenemasa), y esas siguen teniendo sentido aunque la primera
 * ya esté hecha.
 */
const RESPONDIDA_POR: Partial<Record<string, keyof PruebasConfirmatorias>> = {
  CEFOXITINA_MRSA: 'cefoxitinaScreen',
  D_ZONE: 'dTest',
  ESBL: 'esbl',
  CARBA_NP: 'carbapenemasa',
  mCIM_eCIM: 'carbapenemasa',
  HLAR: 'hlar',
  BETALACTAMASA_NITROCEFIN: 'betaLactamasa',
}

/**
 * Separa lo que hay que PEDIR de lo que el reporte YA TRAE.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * La nota terminaba con «Pruebas por solicitar: Tamiz de cefoxitina…; D-zone
 * test» en un caso donde el reporte traía impresos los dos resultados y el
 * médico los había capturado. Se le pedía al laboratorio una prueba que el
 * laboratorio acababa de entregar.
 *
 * ── POR QUÉ NO SE FILTRA EN SILENCIO ─────────────────────────────────────────
 *
 * Quitarlas de la lista y ya está deja al médico sin saber si la prueba no
 * aplicaba o si simplemente ya estaba hecha. Se devuelven aparte, y las salidas
 * las nombran: **lo que se recorta se dice**.
 *
 * Un resultado INDETERMINADO no cuenta como respondido: la prueba se sigue
 * pidiendo. Sólo un `pos` o un `neg` cierran la pregunta.
 */
export function pruebasPendientes(
  organismo: string,
  fenotipos: FenotipoClave[],
  pruebas?: PruebasConfirmatorias,
): { pedir: PruebaCLSI[]; yaReportadas: PruebaCLSI[] } {
  const todas = pruebasRecomendadas(organismo, fenotipos)
  if (!pruebas) return { pedir: todas, yaReportadas: [] }
  const respondida = (p: PruebaCLSI) => {
    const id = Object.keys(PRUEBAS).find(k => PRUEBAS[k] === p)
    const clave = id ? RESPONDIDA_POR[id] : undefined
    if (!clave) return false
    const v = pruebas[clave]
    return v === 'pos' || v === 'neg'
  }
  return {
    pedir: todas.filter(p => !respondida(p)),
    yaReportadas: todas.filter(respondida),
  }
}

/** Recomienda las pruebas CLSI pertinentes según el organismo y los fenotipos inferidos. */
export function pruebasRecomendadas(organismo: string, fenotipos: FenotipoClave[]): PruebaCLSI[] {
  const set = new Set<string>()
  const has = (...cs: FenotipoClave[]) => cs.some(c => fenotipos.includes(c))

  if (has('BLEE')) { set.add('ESBL'); set.add('SINERGIA_ESBL_DDST') }
  if (has('AmpC')) { set.add('AMPC_CONFIRM'); set.add('DOBLE_PRODUCTOR') } // cefoxitina R puede enmascarar BLEE
  if (has('carbapenemasa')) {
    set.add('CARBA_NP'); set.add('mCIM_eCIM'); set.add('SINERGIA_CARBAPENEMASA')
    set.add('INMUNOCROMATOGRAFIA'); set.add('MOLECULAR'); set.add('DOBLE_PRODUCTOR')
  }
  if (has('porina-perdida')) { set.add('mCIM_eCIM'); set.add('MOLECULAR') } // patrón ertapenem-aislado: descartar OXA-48
  if (has('MRSA', 'BORSA')) set.add('CEFOXITINA_MRSA')
  if (has('MLSb-inducible')) set.add('D_ZONE')
  if (has('HLAR')) set.add('HLAR')
  if (has('penicilinasa-estafilococica')) set.add('BETALACTAMASA_NITROCEFIN')
  // Colistina: método VÁLIDO cuando es la línea de rescate (última línea comprometida).
  if (has('carbapenemasa', 'colistin-R', 'MDR', 'XDR')) set.add('COLISTINA')
  return [...set].map(id => PRUEBAS[id]).filter(Boolean)
}
