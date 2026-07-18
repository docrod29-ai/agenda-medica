/**
 * ALGORITMO de diagnóstico de resistencia: convierte el caso en un árbol de decisión
 * paso a paso (qué ya sabemos, qué falta confirmar y qué se decide con cada resultado).
 * Es la "hoja de ruta" del PROA: identificar → cribar marcador clave → confirmar
 * mecanismo → determinar clase → dirigir terapia → notificar/aislar.
 */
import type { EntradaAntibiograma, InterpretacionAntibiograma, PasoAlgoritmo, FenotipoClave } from './tipos'
import { norm } from './util'

type Grupo = 'gram-negativo' | 'gram-positivo' | 'fastidioso' | 'desconocido'

function grupoDe(o: string): Grupo {
  const s = norm(o)
  if (/haemophilus|gonorr|meningitidis|moraxella/.test(s)) return 'fastidioso'
  if (/staphylo|aureus|enterococ|faecium|faecalis|streptococ|neumococo|pneumococ/.test(s)) return 'gram-positivo'
  if (/coli|klebsiella|enterobacter|serratia|citrobacter|proteus|morganella|providencia|salmonella|shigella|pseudomonas|aeruginosa|acinetobacter|baumannii|stenotrophomonas|maltophilia|hafnia/.test(s)) return 'gram-negativo'
  return 'desconocido'
}

export function construirAlgoritmo(entrada: EntradaAntibiograma, r: InterpretacionAntibiograma): PasoAlgoritmo[] {
  const pasos: PasoAlgoritmo[] = []
  const claves = r.fenotipos.map(f => f.clave)
  const tiene = (...cs: FenotipoClave[]) => cs.some(c => claves.includes(c))
  const grupo = grupoDe(entrada.organismo)
  const add = (titulo: string, detalle: string, estado: PasoAlgoritmo['estado']) =>
    pasos.push({ n: pasos.length + 1, titulo, detalle, estado })

  // 1) Identificación y encuadre
  add('Identificar organismo y encuadre',
    entrada.organismo
      ? `${entrada.organismo} → ${grupo}. La resistencia intrínseca de la especie ya se aplicó (una «S» imposible se marca como conflicto).`
      : 'Falta el organismo: sin él no se puede aplicar resistencia intrínseca ni puntos de corte por especie.',
    entrada.organismo ? 'hecho' : 'pendiente')

  // 2) Cribado del marcador clave según el grupo
  if (grupo === 'gram-negativo') {
    const cre = tiene('carbapenemasa', 'porina-perdida')
    add('Cribar el marcador clave: CARBAPENÉMICOS',
      cre
        ? 'Carbapenémico no sensible → entra a la vía de carbapenemasa/impermeabilidad (paso 3).'
        : 'Carbapenémicos conservados → la vía es BLEE/AmpC (cefalosporinas) en vez de carbapenemasa.',
      'hecho')
  } else if (grupo === 'gram-positivo') {
    const s = norm(entrada.organismo)
    if (/staphylo|aureus/.test(s)) {
      add('Cribar el marcador clave: CEFOXITINA/OXACILINA (mecA)',
        tiene('MRSA') ? 'Positivo → MRSA: ningún β-lactámico salvo ceftarolina.' : 'Negativo → MSSA: β-lactámico antiestafilocócico de elección (mejor que vancomicina).',
        'hecho')
    } else if (/enterococ|faecium|faecalis/.test(s)) {
      add('Cribar el marcador clave: VANCOMICINA + AMPICILINA',
        tiene('VRE') ? 'Vancomicina R → VRE: linezolid/daptomicina según especie.' : 'Vancomicina conservada; valorar ampicilina (de elección si S) y HLAR para sinergia.',
        'hecho')
    } else {
      add('Cribar el marcador clave del Gram positivo', 'Penicilina/eritromicina-clindamicina según especie (neumococo: CMI de penicilina por sitio).', 'hecho')
    }
  } else if (grupo === 'fastidioso') {
    add('Cribar β-lactamasa del organismo fastidioso', 'Nitrocefina (Haemophilus/gonococo). Si es negativa pero hay R a ampicilina → BLNAR (PBP3), el clavulanato no ayuda.', 'pendiente')
  }

  // 3) Confirmar el MECANISMO
  if (tiene('carbapenemasa')) {
    add('Confirmar producción de carbapenemasa',
      'mCIM (± eCIM con EDTA) o Carba NP. El eCIM distingue SERINA vs METALO. Complementar con doble disco (ác. borónico = KPC; EDTA/DPA = MBL).',
      'pendiente')
    add('Determinar la CLASE (define el fármaco)',
      'Inmunocromatografía Carba-5/RESIST-5 o PCR: KPC / OXA-48 / NDM / VIM / IMP. La clase cambia radicalmente el inhibidor útil.',
      'pendiente')
  } else if (tiene('BLEE')) {
    add('Confirmar BLEE', 'Sinergia con clavulanato (doble disco DDST o disco combinado: ≥5 mm o ≥3 diluciones).', 'pendiente')
  } else if (tiene('AmpC')) {
    add('Confirmar AmpC y descartar BLEE oculta',
      'Inhibición con cloxacilina o ác. borónico. Ojo: la AmpC puede ENMASCARAR una BLEE coproducida (doble productor) — se destapa inhibiendo la AmpC.',
      'pendiente')
  } else if (tiene('MLSb-inducible')) {
    add('Confirmar clindamicina inducible', 'D-test (D-zone). Si es positivo → informar clindamicina RESISTENTE.', 'pendiente')
  } else {
    add('Confirmar mecanismo', r.mecanismos.length ? `Mecanismo(s) inferido(s): ${r.mecanismos.map(m => m.nombre).join('; ')}.` : 'Sin fenotipo de resistencia que obligue a prueba confirmatoria.', r.mecanismos.length ? 'hecho' : 'na')
  }

  // 4) Marcadores acompañantes de alarma
  if (tiene('16S-RMTasa')) {
    add('🚩 Pan-aminoglucósido R → buscar MBL', 'La 16S-metiltransferasa se co-porta con NDM en >50%: confirmar carbapenemasa metalo aunque los carbapenémicos parezcan conservados.', 'pendiente')
  }
  if (tiene('colistin-R')) {
    add('Confirmar colistina por método VÁLIDO', 'Solo microdilución en caldo (BMD) o CBDE. El disco y el gradiente NO son interpretables para colistina.', 'pendiente')
  }

  // 5) Terapia dirigida
  add('Dirigir la terapia por el mecanismo',
    r.terapiaDirigida.length
      ? r.terapiaDirigida.filter(t => t.linea === 'dirigida').map(t => t.agente).join(' · ') || r.terapiaDirigida[0].agente
      : 'Sin fenotipo de resistencia: usar el agente de espectro más estrecho que cubra el foco (desescalar).',
    r.terapiaDirigida.length ? 'hecho' : 'na')

  // 6) Notificación / aislamiento
  add('Notificar y aislar si aplica',
    r.notificacionObligatoria
      ? `Notificación epidemiológica obligatoria (NOM-045). ${r.aislamiento ?? ''}`.trim()
      : 'No cumple criterio de notificación obligatoria por el fenotipo capturado.',
    r.notificacionObligatoria ? 'pendiente' : 'na')

  return pasos
}
