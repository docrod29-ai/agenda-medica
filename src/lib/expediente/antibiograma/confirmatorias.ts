/**
 * Pruebas confirmatorias/fenotípicas capturadas del reporte (automatizado o manual):
 * tamiz de cefoxitina (MRSA), D-test (clindamicina inducible), BLEE, carbapenemasa,
 * β-lactamasa (nitrocefina), HLAR. Cuando el médico las captura, CONFIRMAN el
 * fenotipo con máxima confianza (mejor que inferirlo del patrón S/I/R) y ajustan la
 * terapia. Se apoyan en el catálogo de pruebas CLSI (clsi-pruebas) y la matriz de
 * inhibidores (betalactamasas).
 */
import { type AporteModulo, aporteVacio, type PruebasConfirmatorias } from './tipos'
import { REF } from './referencias'
import { organismoEs } from './util'
import { CLASES, terapiaPorClase, type ClaseEnzima } from './betalactamasas'
import { AVISO_ACCESO_MEXICO } from './epidemiologia'

const M100 = 'CLSI M100-Ed35 (2025)'

function claseDeReporte(c?: PruebasConfirmatorias['claseCarbapenemasa']): ClaseEnzima {
  if (c === 'KPC') return 'KPC'
  if (c === 'OXA-48') return 'OXA-48'
  if (c === 'NDM' || c === 'VIM' || c === 'IMP' || c === 'MBL') return 'MBL'
  return 'carbapenemasa-indeterminada'
}

export function analizarConfirmatorias(pruebas: PruebasConfirmatorias | undefined, organismo: string): AporteModulo {
  const out = aporteVacio()
  if (!pruebas) return out

  // ── Cefoxitina screen (MRSA / mecA) ──────────────────────────────────────
  if (pruebas.cefoxitinaScreen === 'pos') {
    out.fenotipos.push({ clave: 'MRSA', nombre: 'Resistencia a meticilina CONFIRMADA (tamiz de cefoxitina positivo)', confianza: 'confirmado', base: `Tamiz de cefoxitina/oxacilina positivo → mecA/PBP2a. ${M100} Tabla 3H.` })
    out.mecanismos.push({ categoria: 'diana', nombre: 'PBP2a (mecA)', confianza: 'confirmado', explicacion: 'Resistencia a TODOS los β-lactámicos salvo cefalosporinas anti-MRSA (ceftarolina/ceftobiprol).', referencia: `${M100} Tabla 3H` })
    out.advertencias.push('MRSA confirmado: NO usar β-lactámicos convencionales (solo ceftarolina). Vancomicina/daptomicina/linezolid según el sitio.')
    out.terapiaDirigida.push({ linea: 'dirigida', agente: 'Vancomicina / daptomicina / linezolid', razon: 'MRSA confirmado por tamiz de cefoxitina.', referencia: `${M100} Tabla 3H` })
    out.notificacion = true
    out.aislamiento = 'Precauciones de contacto (MRSA).'
  } else if (pruebas.cefoxitinaScreen === 'neg') {
    out.didactica.push({ titulo: 'Tamiz de cefoxitina negativo', texto: 'No hay mecA: es sensible a meticilina (MSSA). Los β-lactámicos antiestafilocócicos (oxacilina/cefazolina) son de elección.', referencia: `${M100} Tabla 3H` })
  }

  // ── D-test: clindamicina inducible (MLSb inducible) ───────────────────────
  if (pruebas.dTest === 'pos') {
    out.fenotipos.push({ clave: 'MLSb-inducible', nombre: 'Resistencia INDUCIBLE a clindamicina CONFIRMADA (D-test positivo)', confianza: 'confirmado', base: `D-zone positivo: metilasa erm inducible. ${M100} Tabla 3J.` })
    out.advertencias.push('D-test POSITIVO → informar CLINDAMICINA RESISTENTE aunque el disco la muestre S (puede seleccionar resistencia constitutiva durante el tratamiento).')
    out.mecanismos.push({ categoria: 'diana', nombre: 'Metilasa ribosómica erm (23S rRNA)', confianza: 'confirmado', explicacion: 'Bloquea macrólidos, lincosamidas y estreptograminas B. Inducible → desenmascarada por el D-test.', referencia: `${M100} Tabla 3J` })
  } else if (pruebas.dTest === 'neg') {
    out.didactica.push({ titulo: 'D-test negativo', texto: 'Eritromicina-R con D-test negativo (fenotipo M / bomba msrA): la clindamicina SÍ puede usarse (se reporta S).', referencia: `${M100} Tabla 3J` })
  }

  // ── BLEE confirmada ───────────────────────────────────────────────────────
  if (pruebas.esbl === 'pos') {
    out.fenotipos.push({ clave: 'BLEE', nombre: 'BLEE CONFIRMADA (sinergia con clavulanato positiva)', confianza: 'confirmado', base: `Prueba confirmatoria de BLEE positiva. ${M100} Tabla 3A.` })
    out.mecanismos.push({ categoria: 'β-lactamasa', nombre: CLASES.ESBL.nombre, ambler: 'A', confianza: 'confirmado', explicacion: CLASES.ESBL.didactica, referencia: `${M100} Tabla 3A` })
    out.advertencias.push('BLEE confirmada: en infección seria, carbapenémico dirigido; evitar C3G/aztreonam/cefepime aunque reporten S (efecto inóculo).')
    for (const t of terapiaPorClase('ESBL')) out.terapiaDirigida.push(t)
  }

  // ── Carbapenemasa confirmada (± clase) ────────────────────────────────────
  if (pruebas.carbapenemasa === 'pos') {
    const clase = claseDeReporte(pruebas.claseCarbapenemasa)
    const desc = CLASES[clase]
    out.fenotipos.push({ clave: 'carbapenemasa', nombre: `Carbapenemasa CONFIRMADA${pruebas.claseCarbapenemasa && pruebas.claseCarbapenemasa !== 'indeterminada' ? ` — ${pruebas.claseCarbapenemasa}` : ''}`, confianza: 'confirmado', base: `Prueba de carbapenemasa positiva (mCIM/eCIM/Carba NP/molecular). ${desc.didactica} ${M100} Tablas 3B-3C.` })
    out.mecanismos.push({ categoria: 'β-lactamasa', nombre: desc.nombre, ambler: desc.ambler, confianza: 'confirmado', explicacion: desc.didactica, referencia: REF.BLI })
    out.alertas.push({ nivel: 'critica', mensaje: `Carbapenemasa confirmada (${clase}): infectología OBLIGADA. ${claseAlerta(clase)}` })
    for (const t of terapiaPorClase(clase)) out.terapiaDirigida.push(t)
    if (clase === 'MBL') out.alertas.push({ nivel: 'alta', mensaje: AVISO_ACCESO_MEXICO })
    out.notificacion = true
    out.aislamiento = 'Precauciones de contacto (productor de carbapenemasa).'
  }

  // ── β-lactamasa por nitrocefina ───────────────────────────────────────────
  if (pruebas.betaLactamasa === 'pos') {
    if (organismoEs(organismo, ['staphylo', 'aureus'])) {
      out.fenotipos.push({ clave: 'penicilinasa-estafilococica', nombre: 'β-lactamasa (penicilinasa) CONFIRMADA por nitrocefina', confianza: 'confirmado', base: `Nitrocefina positiva → penicilina/ampicilina R. ${M100} Tabla 3G.` })
      out.advertencias.push('Nitrocefina positiva: reportar PENICILINA R (aunque el halo parezca S). Usar oxacilina/dicloxacilina o cefazolina si es MSSA.')
    } else {
      out.advertencias.push('β-lactamasa (nitrocefina) positiva: penicilina/ampicilina R.')
    }
  }

  // ── HLAR ──────────────────────────────────────────────────────────────────
  if (pruebas.hlar === 'pos') {
    out.fenotipos.push({ clave: 'HLAR', nombre: 'Resistencia de ALTO nivel a aminoglucósidos CONFIRMADA', confianza: 'confirmado', base: `Tamiz HLAR positivo. ${M100} Tabla 3L.` })
    out.advertencias.push('HLAR positivo: se PIERDE la sinergia β-lactámico + aminoglucósido (clave en endocarditis enterocócica). No aporta el aminoglucósido.')
  }

  return out
}

function claseAlerta(clase: ClaseEnzima): string {
  if (clase === 'MBL') return 'MBL: aztreonam-avibactam o cefiderocol; la ceftazidima-avibactam SOLA es inactiva.'
  if (clase === 'KPC') return 'KPC: ceftazidima-avibactam, meropenem-vaborbactam o imipenem-relebactam.'
  if (clase === 'OXA-48') return 'OXA-48: ceftazidima-avibactam o cefiderocol (NO vaborbactam/relebactam).'
  return 'Confirmar la clase para elegir el inhibidor correcto.'
}
