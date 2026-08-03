/**
 * Pruebas confirmatorias/fenotípicas capturadas del reporte (automatizado o manual):
 * tamiz de cefoxitina (MRSA), D-test (clindamicina inducible), BLEE, carbapenemasa,
 * β-lactamasa (nitrocefina), HLAR. Cuando el médico las captura, CONFIRMAN el
 * fenotipo con máxima confianza (mejor que inferirlo del patrón S/I/R) y ajustan la
 * terapia. Se apoyan en el catálogo de pruebas CLSI (clsi-pruebas) y la matriz de
 * inhibidores (betalactamasas).
 */
import { type AporteModulo, aporteVacio, type PruebasConfirmatorias, type FenotipoClave, type FenotipoDetectado } from './tipos'
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
    if (clase === 'KPC') {
      out.didactica.push({ titulo: 'R emergente a ceftazidima-avibactam en KPC', texto: 'Si una KPC confirmada resulta ceftazidima-avibactam R, sospechar una VARIANTE de blaKPC (p. ej. KPC-3 mutada) seleccionada bajo presión de CAZ-AVI → usar meropenem-vaborbactam o imipenem-relebactam (suelen conservar actividad) y confirmar por secuenciación.', referencia: REF.BLI })
    }
    out.notificacion = true
    out.aislamiento = 'Precauciones de contacto (productor de carbapenemasa).'
  }

  /**
   * ── DECISIÓN 5 DEL DR. (3-ago-2026): mCIM NEGATIVO ────────────────────────
   *
   * La interpretación textual de CLSI para un mCIM negativo es
   * **«Carbapenemase not detected»**. NO equivale a «mecanismo no enzimático
   * demostrado», y por eso el motor no reorienta hacia permeabilidad, eflujo ni
   * porinas: son hipótesis razonables, pero M100 no da en este contexto un orden
   * universal que permita declararlas como mecanismo principal.
   *
   * Además el propio método tiene límites que hay que decir: está estandarizado
   * para Enterobacterales y *P. aeruginosa*, describe falsos negativos para
   * determinados productores, y en *Acinetobacter* CLSI **no lo respalda** por
   * especificidad y reproducibilidad.
   *
   * Ver `docs/maintenance/DECISIONES-CLINICAS-2026-08-03.md`, decisión 5.
   */
  if (pruebas.carbapenemasa === 'neg') {
    const acineto = organismoEs(organismo, ['acinetobacter', 'baumannii'])
    out.didactica.push({
      titulo: 'Carbapenemasa NO DETECTADA por mCIM',
      texto: 'La lectura correcta es exactamente ésa: «carbapenemasa no detectada». '
        + 'NO significa que el mecanismo sea no enzimático — sólo que este método no la detectó. '
        + 'Si el antibiograma muestra resistencia a carbapenémicos, la resistencia está CONFIRMADA por AST '
        + 'y el mecanismo queda INDETERMINADO. '
        + (acineto
          ? 'ATENCIÓN: en Acinetobacter, CLSI NO respalda el mCIM por problemas de especificidad y reproducibilidad — este resultado no es concluyente aquí. '
          : 'El mCIM está estandarizado para Enterobacterales y P. aeruginosa; hay falsos negativos descritos para determinados productores. ')
        + 'Recomendar un método adicional (molecular o inmunocromatográfico) cuando sea clínica o epidemiológicamente necesario.',
      referencia: `${M100} Tablas 3B-3C`,
    })
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

/**
 * LA CONFIRMATORIA NEGATIVA **DEGRADA LA CONFIANZA** — decisión 4 del Dr.
 * (3-ago-2026).
 *
 * ── POR QUÉ DEGRADAR Y NO CANCELAR ───────────────────────────────────────────
 *
 * CLSI señala que el tamizaje sólo puede *indicar* producción de BLEE, y que las
 * pruebas fenotípicas pueden dar **falsos negativos** — por ejemplo por
 * coproducción de AmpC. Una confirmatoria negativa **no excluye** el fenotipo:
 * cancelarlo (la opción C) sería excesivo.
 *
 * Tampoco puede dejarse igual (la opción A): concede demasiado peso al patrón
 * inferido existiendo evidencia contraria.
 *
 *     tamizaje compatible + confirmatoria negativa
 *       → «sospecha» / «no confirmada»
 *       → NI «probable» sin cambios, NI cancelación absoluta
 *
 * ── LO QUE NO SE TOCA ────────────────────────────────────────────────────────
 *
 * El fenotipo NO desaparece, su mecanismo tampoco, y la terapia sigue emitida.
 * El Dr. añadió que la selección terapéutica debe apoyarse principalmente en las
 * categorías actuales del antibiograma, el foco y el paciente — no sólo en la
 * etiqueta. Eso es una separación de capas más grande, y va aparte; aquí se
 * marca la terapia como apoyada en un fenotipo NO confirmado, que es lo que se
 * puede hacer sin reestructurar nada.
 *
 * Ver `docs/maintenance/DECISIONES-CLINICAS-2026-08-03.md`, decisión 4.
 */
export function degradarPorConfirmatoriaNegativa(
  fenotipos: FenotipoDetectado[],
  pruebas: PruebasConfirmatorias | undefined,
): { fenotipos: FenotipoDetectado[]; degradados: string[] } {
  if (!pruebas) return { fenotipos, degradados: [] }
  const degradados: string[] = []
  const salida = fenotipos.map(f => {
    /**
     * MRSA QUEDA FUERA, y no por descuido.
     *
     * La decisión 4 es sobre la BLEE. El caso «cefoxitina S/negativa con
     * oxacilina R» lo resolvió el Dr. por separado en la decisión 6, y dice algo
     * DISTINTO: CLSI manda reportar la resistencia a meticilina si CUALQUIERA de
     * las dos pruebas es resistente, así que el fenotipo se sostiene —baja a
     * `probable` y se nombra la discordancia, no a `sospecha`—.
     *
     * Aplicarle aquí la regla genérica sería extender una decisión clínica más
     * allá de donde el Dr. la tomó, y encima pisando otra suya más específica.
     * La primera versión de esta función lo hacía; lo destapó el golden de v959.
     */
    if (f.clave === 'MRSA') return f
    const par = CONFIRMA.find(c => c.fenotipo === f.clave)
    if (!par || pruebas[par.clave] !== 'neg') return f
    /**
     * Un fenotipo que la PROPIA confirmatoria declaró positivo no se degrada:
     * sería degradar la prueba con la prueba. Sólo baja el inferido del patrón.
     */
    if (f.confianza === 'confirmado' && /CONFIRMAD/i.test(f.nombre)) return f
    degradados.push(f.clave)
    return {
      ...f,
      confianza: 'sospecha' as const,
      nombre: `${f.nombre} — NO CONFIRMADA`,
      base: `${f.base} El ${par.prueba} resultó NEGATIVO: no excluye el fenotipo `
        + '(las pruebas fenotípicas tienen falsos negativos descritos, p. ej. por coproducción de AmpC), '
        + 'pero tampoco lo respalda. Se degrada a SOSPECHA y la terapia asociada se apoya en un fenotipo NO confirmado.',
    }
  })
  return { fenotipos: salida, degradados }
}

/**
 * QUÉ FENOTIPO CONFIRMA CADA PRUEBA.
 *
 * No es una tabla nueva: es literalmente la clave que cada rama `=== 'pos'` de
 * arriba empuja. Aquí se usa al revés — para detectar que la prueba salió
 * NEGATIVA y el fenotipo está declarado igual.
 */
const CONFIRMA: { clave: keyof PruebasConfirmatorias; fenotipo: FenotipoClave; prueba: string }[] = [
  { clave: 'cefoxitinaScreen', fenotipo: 'MRSA', prueba: 'tamiz de cefoxitina/oxacilina' },
  { clave: 'dTest', fenotipo: 'MLSb-inducible', prueba: 'D-test' },
  { clave: 'esbl', fenotipo: 'BLEE', prueba: 'prueba confirmatoria de BLEE' },
  { clave: 'carbapenemasa', fenotipo: 'carbapenemasa', prueba: 'prueba de carbapenemasa (mCIM/Carba NP)' },
  { clave: 'betaLactamasa', fenotipo: 'penicilinasa-estafilococica', prueba: 'β-lactamasa (nitrocefina)' },
  { clave: 'hlar', fenotipo: 'HLAR', prueba: 'tamiz HLAR' },
]

/**
 * EL RESULTADO NEGATIVO CONTRADICE AL FENOTIPO INFERIDO — y hay que decirlo.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * Un *S. aureus* con oxacilina R en el panel y el **tamiz de cefoxitina
 * NEGATIVO** capturado del reporte salía así:
 *
 *     Fenotipo: MRSA [confirmado]
 *     Aislamiento: precauciones de contacto (MRSA)
 *     Notificación epidemiológica OBLIGATORIA
 *     Advertencia: ignore cualquier β-lactámico reportado S
 *
 * El negativo se leía, se tipaba, se transportaba hasta el motor… y se iba a un
 * `didactica` que la nota no imprimía. Las dos afirmaciones convivían en el
 * mismo documento y **la inferida ganaba en silencio** — encima con confianza
 * `confirmado`, que es la palabra que la prueba negativa desmiente.
 *
 * ── LO QUE ESTA FUNCIÓN HACE, Y LO QUE NO ────────────────────────────────────
 *
 * **NO decide quién gana.** Cuál de los dos manda —cefoxitina-neg contra
 * oxacilina-R— es criterio clínico y es una de las preguntas que el Dr. tiene
 * pendientes. NEEDS_CLINICAL_REVIEW: esa resolución no la toma este archivo.
 *
 * Lo que sí puede hacer un programa sin decidir nada es **no dejar que las dos
 * afirmaciones convivan calladas**: nombra las dos, dice de dónde sale cada una
 * y deja la resolución al médico. El fenotipo NO se toca; sólo deja de estar
 * solo en la hoja.
 */
export function conflictosConfirmatorias(
  fenotipos: { clave: FenotipoClave; nombre: string }[],
  pruebas: PruebasConfirmatorias | undefined,
): string[] {
  if (!pruebas) return []
  const avisos: string[] = []
  for (const { clave, fenotipo, prueba } of CONFIRMA) {
    if (pruebas[clave] !== 'neg') continue
    const f = fenotipos.find(x => x.clave === fenotipo)
    if (!f) continue
    avisos.push(
      `⚠ CONFLICTO: el reporte trae el ${prueba} NEGATIVO, y aun así el motor declara «${f.nombre}» a partir del patrón S/I/R. ` +
      'Son dos afirmaciones opuestas sobre el mismo aislamiento y NO se resuelve solo: revisa la identificación de la especie, ' +
      'la lectura de la prueba y el panel antes de tratar por el fenotipo.',
    )
  }
  return avisos
}

function claseAlerta(clase: ClaseEnzima): string {
  if (clase === 'MBL') return 'MBL: aztreonam-avibactam o cefiderocol; la ceftazidima-avibactam SOLA es inactiva.'
  if (clase === 'KPC') return 'KPC: ceftazidima-avibactam, meropenem-vaborbactam o imipenem-relebactam.'
  if (clase === 'OXA-48') return 'OXA-48: ceftazidima-avibactam o cefiderocol (NO vaborbactam/relebactam).'
  return 'Confirmar la clase para elegir el inhibidor correcto.'
}
