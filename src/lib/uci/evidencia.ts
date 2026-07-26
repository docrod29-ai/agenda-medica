/**
 * MOTOR DE EVIDENCIA CITADA — ICU (iteración nexusmed-icu-018 / base de conocimiento).
 *
 * Cada regla de los motores de UCI se ancla a una GUÍA REAL leída de los PDFs
 * que aportó el médico (no es "mi criterio"). Aquí viven las fuentes y las reglas
 * accionables con su umbral, fuerza de recomendación, calidad de evidencia,
 * población y LIMITACIONES. Nunca se inventan PMIDs ni cifras: donde la guía usó
 * "consenso" o no dio un número, se dice así.
 *
 * `verified` = la cita fue confirmada leyendo el documento fuente (los PDFs en
 * /Users/davidrdz/Desktop/uci/). No sustituye una verificación en PubMed del PMID
 * (por eso `pmid` queda indefinido salvo que la fuente lo diera).
 */

export const EVIDENCIA_UCI_VERSION = '1.0.0'

export interface FuenteEvidencia {
  id: string
  titulo: string
  organizacion?: string
  revista?: string
  anio: number
  doi?: string
  pmid?: string
  verified: boolean
}

export interface ReglaEvidencia {
  ruleId: string
  dominio: 'hemodinamia' | 'ventilacion' | 'gasometria' | 'pocus' | 'nutricion' | 'seguridad' | 'sedacion' | 'glucemia' | 'ckrt' | 'ecmo'
  resumen: string
  umbral: string
  fuenteId: string
  fuerza?: string          // "Fuerte" | "Débil" | "UGPS/consenso" | "condicional"
  calidad?: string         // "alta" | "moderada" | "baja" | "muy baja" | "consenso"
  poblacion?: string[]
  limitaciones: string[]
}

/** Fuentes reales (leídas de los PDFs del Dr). */
export const FUENTES: Record<string, FuenteEvidencia> = {
  esicm2025: { id: 'esicm2025', titulo: 'ESICM guidelines on circulatory shock and hemodynamic monitoring 2025', organizacion: 'ESICM', revista: 'Intensive Care Medicine', anio: 2025, verified: true },
  ahaCicu2020: { id: 'ahaCicu2020', titulo: 'Prevention of Complications in the Cardiac Intensive Care Unit', organizacion: 'AHA', revista: 'Circulation', anio: 2020, verified: true },
  mcclave2016: { id: 'mcclave2016', titulo: 'Guidelines for Nutrition Support Therapy in the Adult Critically Ill Patient', organizacion: 'SCCM/ASPEN', revista: 'JPEN', anio: 2016, verified: true },
  padis2018: { id: 'padis2018', titulo: 'PADIS: Pain, Agitation/Sedation, Delirium, Immobility, Sleep in Adult ICU Patients', organizacion: 'SCCM', revista: 'Critical Care Medicine', anio: 2018, verified: true },
  pocusRowe2026: { id: 'pocusRowe2026', titulo: 'Ultrasound to guide critical decisions: What you need to know', revista: 'J Trauma Acute Care Surg', anio: 2026, doi: '10.1097/TA.0000000000004815', verified: true },
  pocusSoliman2026: { id: 'pocusSoliman2026', titulo: 'Cardiopulmonary point-of-care ultrasound for critical care', revista: 'Clinical Medicine (RCP)', anio: 2026, doi: '10.1016/j.clinme.2026.100624', verified: true },
  ccus2025: { id: 'ccus2025', titulo: 'SCCM Guidelines on Adult Critical Care Ultrasonography (CCUS)', organizacion: 'SCCM', revista: 'Critical Care Medicine', anio: 2025, verified: true },
  vexus2020: { id: 'vexus2020', titulo: 'Quantifying systemic congestion with POCUS: development of the venous excess ultrasound (VExUS) grading system', revista: 'The Ultrasound Journal', anio: 2020, doi: '10.1186/s13089-020-00163-w', verified: true },
  lus2025: { id: 'lus2025', titulo: 'ESICM–ESPNIC international expert consensus on quantitative lung ultrasound in intensive care', organizacion: 'ESICM/ESPNIC', revista: 'Intensive Care Medicine', anio: 2025, doi: '10.1007/s00134-025-07932-y', verified: true },
  plrMonnet2016: { id: 'plrMonnet2016', titulo: 'Passive leg raising for predicting fluid responsiveness: a systematic review and meta-analysis', revista: 'Intensive Care Medicine', anio: 2016, doi: '10.1007/s00134-015-4134-1', verified: true },
  plrVignon2017: { id: 'plrVignon2017', titulo: 'Comparison of Echocardiographic Indices Used to Predict Fluid Responsiveness in Ventilated Patients', revista: 'Am J Respir Crit Care Med', anio: 2017, doi: '10.1164/rccm.201604-0844OC', verified: true },
  // ── CKRT / ECMO (fuentes reales por DOI/organización; verified:false = aún no leídas de un PDF del Dr) ──
  kdigoAki2012: { id: 'kdigoAki2012', titulo: 'KDIGO Clinical Practice Guideline for Acute Kidney Injury', organizacion: 'KDIGO', revista: 'Kidney Int Suppl', anio: 2012, verified: false },
  elsoGeneral2021: { id: 'elsoGeneral2021', titulo: 'ELSO General Guidelines for all ECLS Cases', organizacion: 'ELSO', anio: 2021, verified: false },
  elsoAnticoag2024: { id: 'elsoAnticoag2024', titulo: 'ELSO Anticoagulation Guideline', organizacion: 'ELSO', anio: 2024, verified: false },
  rcaKdigoCitrate: { id: 'rcaKdigoCitrate', titulo: 'Regional citrate anticoagulation for CKRT (KDIGO-suggested first line)', organizacion: 'KDIGO', revista: 'Kidney Int Suppl', anio: 2012, verified: false },
}

/** Reglas accionables ancladas a su fuente. */
export const REGLAS_UCI: ReglaEvidencia[] = [
  // ── Hemodinamia (ESICM 2025) ──────────────────────────────────
  { ruleId: 'map.septico', dominio: 'hemodinamia', resumen: 'Meta inicial de PAM en choque séptico', umbral: 'PAM 65–70 mmHg', fuenteId: 'esicm2025', fuerza: 'UGPS/consenso', calidad: 'consenso', poblacion: ['choque séptico'], limitaciones: ['No hay ventaja de mortalidad con metas más altas (SEPSISPAM/OVATION); individualizar'] },
  { ruleId: 'map.cardiogenico', dominio: 'hemodinamia', resumen: 'Meta inicial de PAM en choque cardiogénico', umbral: 'PAM ≥ 65 mmHg', fuenteId: 'esicm2025', fuerza: 'UGPS/consenso', calidad: 'consenso', poblacion: ['choque cardiogénico'], limitaciones: ['PAM < 70 asociada a mayor mortalidad (DOREMI, observacional)'] },
  { ruleId: 'map.tce', dominio: 'hemodinamia', resumen: 'Meta de PAM en TCE grave', umbral: 'PAM ≥ 80 mmHg (GCS ≤ 8)', fuenteId: 'esicm2025', fuerza: 'UGPS/consenso', calidad: 'consenso', poblacion: ['TCE grave'], limitaciones: ['PAS < 90 en TCE aumenta la mortalidad'] },
  { ruleId: 'map.hemorragico', dominio: 'hemodinamia', resumen: 'Hipotensión permisiva en choque hemorrágico sin TCE', umbral: 'PAS 80–90 mmHg (PAM 50–60) hasta control del sangrado', fuenteId: 'esicm2025', fuerza: 'UGPS/consenso', calidad: 'consenso', poblacion: ['trauma hemorrágico sin TCE'], limitaciones: ['NO aplicar si hay TCE con coma'] },
  { ruleId: 'lactato.shock', dominio: 'hemodinamia', resumen: 'Lactato como marcador de hipoperfusión', umbral: '> 2.0 mmol/L', fuenteId: 'esicm2025', fuerza: 'UGPS/consenso', calidad: 'consenso', limitaciones: ['NO usar la normalización del lactato como meta (cambia lento); valor pronóstico > que la PA'] },
  { ruleId: 'fluidos.dinamico', dominio: 'hemodinamia', resumen: 'Preferir variables dinámicas sobre estáticas para respuesta a líquidos', umbral: 'PLR, PPV, EEOT > marcadores estáticos', fuenteId: 'esicm2025', fuerza: 'Fuerte', calidad: 'alta', limitaciones: [] },
  { ruleId: 'fluidos.ppv', dominio: 'hemodinamia', resumen: 'PPV predice respuesta a líquidos', umbral: 'válido solo en VM sin esfuerzo espontáneo y VT ≥ 8 mL/kg', fuenteId: 'esicm2025', fuerza: 'Fuerte', calidad: 'alta', limitaciones: ['NO usar PPV sola si VT < 8 mL/kg o hay respiración espontánea', 'Umbrales aumentan en hipertensión intraabdominal'] },
  { ruleId: 'fluidos.plr', dominio: 'hemodinamia', resumen: 'PLR predice respuesta a líquidos (equivale a ~300 mL, reversible)', umbral: 'aumento de gasto/VS ~10–15% (% exacto NO en estas fuentes)', fuenteId: 'esicm2025', fuerza: 'Fuerte', calidad: 'alta', limitaciones: ['Falsamente negativo en hipertensión intraabdominal', 'El % de corte del VTI no lo dan estas guías'] },
  { ruleId: 'fluidos.ivc.sola', dominio: 'hemodinamia', resumen: 'No usar el cambio de diámetro de VCI aislado', umbral: 'AUROC 0.63; no clasificar volumen solo con VCI', fuenteId: 'esicm2025', fuerza: 'Débil (en contra)', calidad: 'moderada', limitaciones: [] },
  { ruleId: 'bolo.definicion', dominio: 'hemodinamia', resumen: 'Definición de reto de líquidos', umbral: '200–500 mL en 5–10 min, evaluando efecto en gasto (o presión de pulso si no hay gasto)', fuenteId: 'esicm2025', fuerza: 'UGPS/consenso', calidad: 'baja', limitaciones: [] },
  { ruleId: 'evlw.edema', dominio: 'hemodinamia', resumen: 'Agua extravascular pulmonar (riesgo de fluidos)', umbral: 'normal < 7; edema > 10; DAD VPP 99% si > 15 mL/kg', fuenteId: 'esicm2025', fuerza: 'UGPS/consenso', calidad: 'consenso', limitaciones: ['Requiere termodilución transpulmonar'] },
  { ruleId: 'iap.hta', dominio: 'hemodinamia', resumen: 'Hipertensión intraabdominal / síndrome compartimental', umbral: 'HIA ≥ 12 mmHg; SCA > 20 mmHg + disfunción orgánica; PPA = PAM − PIA', fuenteId: 'esicm2025', fuerza: 'UGPS/consenso', calidad: 'consenso', limitaciones: [] },
  { ruleId: 'cvp.notarget', dominio: 'hemodinamia', resumen: 'No fijar una meta pre-especificada de PVC', umbral: 'buscar la PVC más baja compatible con gasto y perfusión adecuados', fuenteId: 'esicm2025', fuerza: 'UGPS/consenso', calidad: 'consenso', limitaciones: ['PVC estática no predice respuesta a líquidos salvo valores extremos'] },
  { ruleId: 'vasopresor.cardiogenico', dominio: 'hemodinamia', resumen: 'Norepinefrina como vasopresor de elección en muchos casos de choque cardiogénico', umbral: 'evitar dopamina/epinefrina a dosis altas (más arritmias, SOAP II)', fuenteId: 'ahaCicu2020', fuerza: 'consenso', calidad: 'consenso', poblacion: ['choque cardiogénico'], limitaciones: ['Ninguna de estas guías da tabla de equivalentes de vasopresor'] },

  // ── Ventilación / oxigenación (AHA CICU 2020) ─────────────────
  { ruleId: 'vt.protector', dominio: 'ventilacion', resumen: 'Volumen corriente en UCI cardiaca', umbral: '6–10 mL/kg PBW (6–8 si riesgo VALI/SDRA)', fuenteId: 'ahaCicu2020', fuerza: 'consenso', calidad: 'consenso', limitaciones: [] },
  { ruleId: 'pplat.limite', dominio: 'ventilacion', resumen: 'Presión plateau objetivo', umbral: '≤ 30 cmH2O', fuenteId: 'ahaCicu2020', fuerza: 'consenso', calidad: 'consenso', limitaciones: [] },
  { ruleId: 'oxigenacion.meta', dominio: 'ventilacion', resumen: 'Metas de oxigenación y evitar hiperoxia', umbral: 'SpO2 > 90% o PaO2 > 60; evitar PaO2 > 150 (hiperoxia)', fuenteId: 'ahaCicu2020', fuerza: 'consenso', calidad: 'consenso', limitaciones: ['Postparo: evitar PaO2 > 300 en las primeras 6 h'] },
  { ruleId: 'sbt.readiness', dominio: 'ventilacion', resumen: 'Criterios de aptitud para prueba de ventilación espontánea', umbral: 'FiO2 < 0.4 y/o PaO2:FiO2 > 200 con PEEP ≤ 5; RSBI < 105', fuenteId: 'ahaCicu2020', fuerza: 'consenso', calidad: 'consenso', limitaciones: [] },

  // ── POCUS (Soliman 2026 / Rowe 2026) ──────────────────────────
  { ruleId: 'pocus.tapse', dominio: 'pocus', resumen: 'Disfunción sistólica del VD por TAPSE', umbral: 'TAPSE < 16 mm', fuenteId: 'pocusSoliman2026', limitaciones: ['Ángulo-dependiente; alterado tras cirugía cardiaca/pericardiotomía (no especificado en la fuente)'] },
  { ruleId: 'pocus.vdvi', dominio: 'pocus', resumen: 'Dilatación/sobrecarga del VD', umbral: 'relación de diámetros basales VD/VI > 1.0', fuenteId: 'pocusSoliman2026', limitaciones: [] },
  { ruleId: 'pocus.6060', dominio: 'pocus', resumen: 'Hipertensión pulmonar aguda (TEP) vs crónica', umbral: 'PAT < 60 ms + gradiente IT < 60 mmHg → agudo; IT > 60 → crónico', fuenteId: 'pocusSoliman2026', limitaciones: [] },
  { ruleId: 'pocus.vti', dominio: 'pocus', resumen: 'Volumen sistólico/gasto por LVOT-VTI', umbral: 'normal > 18–20 cm; corte operativo 18 cm', fuenteId: 'pocusSoliman2026', limitaciones: ['Invalidado por ventilación con presión positiva, inótropos/vasodilatadores, soporte circulatorio mecánico', 'Efecto de FA/valvulopatía aórtica sobre el VTI no especificado en la fuente'] },
  { ruleId: 'pocus.ee', dominio: 'pocus', resumen: 'Presiones de llenado del VI por E/e′', umbral: 'E/e′ < 8 normal; > 14 elevado; 8–14 indeterminado', fuenteId: 'pocusSoliman2026', limitaciones: ['Invalidantes (valvulopatía mitral, prótesis, marcapasos, FA) NO enumerados por la fuente: validar con guía ASE'] },
  { ruleId: 'pocus.vci.distensibilidad', dominio: 'pocus', resumen: 'Índice de distensibilidad de VCI para respuesta a líquidos', umbral: '> 18% (= (VCImax−VCImin)/VCImin×100)', fuenteId: 'pocusSoliman2026', poblacion: ['ventilación mecánica'], limitaciones: ['SOLO válido en ventilación mecánica (presión positiva), NO en respiración espontánea', 'Afectado por presión intraabdominal y posición; no clasificar volumen solo con VCI'] },
  { ruleId: 'pocus.taponamiento', dominio: 'pocus', resumen: 'Taponamiento cardiaco', umbral: 'VCI dilatada < 50% variación + colapso diastólico VD/AD + IT +>40% / mitral −>25% en inspiración', fuenteId: 'pocusSoliman2026', limitaciones: [] },
  { ruleId: 'pocus.tsvi', dominio: 'pocus', resumen: 'Obstrucción dinámica del TSVI (bandera de seguridad)', umbral: 'gradiente pico > 30 mmHg; EMPEORA con inotrópicos', fuenteId: 'pocusSoliman2026', limitaciones: ['Alerta contra escalar inótropos si se detecta'] },
  { ruleId: 'pocus.neumotorax', dominio: 'pocus', resumen: 'Neumotórax', umbral: 'ausencia de deslizamiento + PUNTO PULMONAR (S~91%/E~98%)', fuenteId: 'pocusRowe2026', limitaciones: ['Sin punto pulmonar, "ausencia de sliding" NO es diagnóstica; ventana degradada por enfisema subcutáneo/obesidad/apósitos'] },
  { ruleId: 'pocus.lineasb', dominio: 'pocus', resumen: 'Síndrome intersticial / edema pulmonar', umbral: '> 3 líneas B por espacio intercostal (edema S~94%/E~92%)', fuenteId: 'pocusRowe2026', limitaciones: [] },
  { ruleId: 'pocus.vexus', dominio: 'pocus', resumen: 'VExUS-C (congestión venosa sistémica)', umbral: '0: VCI<2cm · 1: VCI≥2 sin grave · 2: 1 grave · 3: ≥2 graves. Graves: hepática inversión S, porta pulsatilidad ≥50%, renal solo diastólico', fuenteId: 'vexus2020', limitaciones: ['Desarrollado en cirugía cardiaca (n=145); VCI dilatada = ≥2 cm (no mezclar con >2 cm)'] },
  { ruleId: 'pocus.lus', dominio: 'pocus', resumen: 'Lung Ultrasound Aeration Score (adulto)', umbral: '12 regiones × 0–3 = 0–36. 0 patrón A/<3 B · 1 ≥3 B o ≤50% pleura · 2 >50% pleura · 3 consolidación grande (>2–2.5 cm)', fuenteId: 'lus2025', limitaciones: ['Score 3: consenso da >2–2.5 cm, no un corte universal; se usa >2.5 cm conservador'] },
  { ruleId: 'pocus.plr.co', dominio: 'pocus', resumen: 'PLR por gasto/volumen sistólico', umbral: 'ΔCO/ΔSV ≥ 10% = positivo (S 0.85 · E 0.91 · AUROC 0.95)', fuenteId: 'plrMonnet2016', limitaciones: ['Fiable en FA y respiración espontánea; falso negativo en HIA; NO usar presión de pulso'] },
  { ruleId: 'pocus.plr.vti', dominio: 'pocus', resumen: 'PLR por LVOT-VTI', umbral: 'ΔLVOT-VTI ≥ 10% = positivo', fuenteId: 'plrVignon2017', limitaciones: ['Multicéntrico n=540; especificar SIEMPRE el parámetro medido'] },

  // ── Nutrición (McClave/ASPEN 2016; concuerda AHA CICU 2020) ────
  { ruleId: 'nut.inicioNE', dominio: 'nutricion', resumen: 'Inicio de nutrición enteral', umbral: '24–48 h del ingreso, si tracto GI funcional', fuenteId: 'mcclave2016', fuerza: 'consenso', calidad: 'muy baja', limitaciones: ['Retener si hipotenso (PAM < 50) o vasopresores en escalada'] },
  { ruleId: 'nut.energia', dominio: 'nutricion', resumen: 'Requerimiento energético sin calorimetría', umbral: '25–30 kcal/kg/día', fuenteId: 'mcclave2016', fuerza: 'consenso', calidad: 'consenso', limitaciones: ['Preferir calorimetría indirecta si está disponible'] },
  { ruleId: 'nut.proteina', dominio: 'nutricion', resumen: 'Aporte proteico', umbral: '1.2–2.0 g/kg/día (hasta 2.5 en TRR/quemados)', fuenteId: 'mcclave2016', fuerza: 'consenso', calidad: 'consenso', limitaciones: ['No restringir proteína en falla renal/hepática'] },
  { ruleId: 'nut.grv', dominio: 'nutricion', resumen: 'Residuo gástrico', umbral: 'NO retener NE por GRV < 500 mL sin otros signos de intolerancia', fuenteId: 'mcclave2016', fuerza: 'consenso', calidad: 'baja', limitaciones: ['No usar GRV de rutina'] },
  { ruleId: 'nut.cabecera', dominio: 'nutricion', resumen: 'Prevención de aspiración', umbral: 'cabecera 30–45°', fuenteId: 'mcclave2016', fuerza: 'consenso', calidad: 'consenso', limitaciones: [] },
  { ruleId: 'nut.npsuplementaria', dominio: 'nutricion', resumen: 'Nutrición parenteral suplementaria', umbral: 'solo tras 7–10 días si NE logra < 60% de la meta', fuenteId: 'mcclave2016', fuerza: 'moderada', calidad: 'moderada', limitaciones: ['Iniciarla antes puede ser dañino'] },

  // ── Glucemia (McClave 2016 / AHA CICU 2020) ───────────────────
  { ruleId: 'gluc.meta', dominio: 'glucemia', resumen: 'Control glucémico', umbral: 'iniciar insulina si > 150 mg/dL; meta 140–180 mg/dL', fuenteId: 'mcclave2016', fuerza: 'consenso', calidad: 'moderada', limitaciones: ['Evitar 80–110 (más hipoglucemia y mortalidad)', 'Hipoglucemia < 70 mg/dL'] },

  // ── Sedación / seguridad (PADIS 2018) ─────────────────────────
  { ruleId: 'sed.ligera', dominio: 'sedacion', resumen: 'Objetivo de sedación ligera', umbral: 'RASS −2 a +1 (escalas RASS/SAS)', fuenteId: 'padis2018', fuerza: 'condicional', calidad: 'baja', limitaciones: ['Preferir propofol/dexmedetomidina sobre benzodiacepinas'] },
  { ruleId: 'delirium.icdsc', dominio: 'seguridad', resumen: 'Tamizaje de delirium', umbral: 'CAM-ICU +/−; ICDSC ≥ 4 = delirium (1–3 subsindromático)', fuenteId: 'padis2018', fuerza: 'good practice', calidad: 'consenso', limitaciones: ['No usar antipsicóticos de rutina para prevenir/tratar'] },
  { ruleId: 'movil.iniciar', dominio: 'seguridad', resumen: 'Criterios de seguridad para iniciar movilización', umbral: 'FC 60–130, PAS 90–180, PAM 60–100, FR 5–40, SpO2 ≥ 88%, FiO2 < 0.6, PEEP < 10, RASS ≤ +2, vía aérea asegurada, sin sangrado activo', fuenteId: 'padis2018', fuerza: 'condicional', calidad: 'baja', limitaciones: ['Vasopresores/VM no son barrera per se si estable'] },

  // ── CKRT / PRISMA (KDIGO 2012) ────────────────────────────────
  { ruleId: 'ckrt.dosis', dominio: 'ckrt', resumen: 'Dosis de efluente en CKRT', umbral: 'ENTREGAR 20–25 mL/kg/h; prescribir 25–30 para compensar downtime', fuenteId: 'kdigoAki2012', fuerza: 'consenso', calidad: 'moderada', limitaciones: ['Dosis mayores no mejoran desenlaces (ATN/RENAL); la dosis entregada < prescrita por interrupciones'] },
  { ruleId: 'ckrt.ff', dominio: 'ckrt', resumen: 'Fracción de filtración y coagulación del filtro', umbral: 'mantener FF < 25% (post-dilución); la pre-dilución la reduce', fuenteId: 'kdigoAki2012', fuerza: 'consenso', calidad: 'baja', limitaciones: ['FF alta favorece hemoconcentración y coagulación del filtro'] },
  { ruleId: 'ckrt.citrato', dominio: 'ckrt', resumen: 'Anticoagulación regional con citrato (1ª línea)', umbral: 'iCa sistémico 1.0–1.2; iCa postfiltro 0.25–0.35; ratio Ca total/iónico ≥ 2.5 → sospecha de acumulación', fuenteId: 'rcaKdigoCitrate', fuerza: 'Débil/sugerido', calidad: 'moderada', limitaciones: ['Acumulación más probable en falla hepática/hipoperfusión; el ratio es sospecha, no diagnóstico'] },

  // ── ECMO / ECLS (ELSO) ────────────────────────────────────────
  { ruleId: 'ecmo.oxigenador', dominio: 'ecmo', resumen: 'Vigilancia del oxigenador por ΔP', umbral: 'ΔP = presión pre − post; un ASCENSO vs basal hace sospechar depósito/trombo → inspeccionar', fuenteId: 'elsoGeneral2021', fuerza: 'consenso', calidad: 'baja', limitaciones: ['El ΔP también sube con el flujo; correlacionar con hemólisis (pfHb/LDH). No es diagnóstico de trombosis'] },
  { ruleId: 'ecmo.hemolisis', dominio: 'ecmo', resumen: 'Hemólisis del circuito', umbral: 'plasma-free Hb > 50 mg/dL = significativa; apoya LDH alta + haptoglobina baja', fuenteId: 'elsoGeneral2021', fuerza: 'consenso', calidad: 'baja', limitaciones: ['Buscar fuente: oxigenador, bomba o cánula'] },
  { ruleId: 'ecmo.harlequin', dominio: 'ecmo', resumen: 'Hipoxia diferencial en VA periférico (Harlequin/North-South)', umbral: 'SpO2 mano derecha << miembro inferior → gasometría de radial DERECHA', fuenteId: 'elsoGeneral2021', fuerza: 'consenso', calidad: 'baja', limitaciones: ['Ocurre al recuperar eyección del VI con pulmón enfermo; valorar ventilación nativa o conversión de configuración'] },
  { ruleId: 'ecmo.distension', dominio: 'ecmo', resumen: 'Distensión del VI en VA-ECMO', umbral: 'baja pulsatilidad (pulso < 15 mmHg), válvula aórtica que no abre, edema pulmonar → valorar descarga (venting)', fuenteId: 'elsoGeneral2021', fuerza: 'consenso', calidad: 'baja', limitaciones: ['La conducta de descarga la decide el equipo; el motor solo detecta el patrón'] },
]

/** Devuelve la evidencia (regla + fuente) de un ruleId, o null. */
export function evidenciaDe(ruleId: string): { regla: ReglaEvidencia; fuente: FuenteEvidencia } | null {
  const regla = REGLAS_UCI.find(r => r.ruleId === ruleId)
  if (!regla) return null
  const fuente = FUENTES[regla.fuenteId]
  if (!fuente) return null
  return { regla, fuente }
}

/** Cita corta y legible de una fuente. */
export function citarFuente(f: FuenteEvidencia): string {
  const partes = [f.organizacion, f.revista, String(f.anio)].filter(Boolean).join(' · ')
  return `${f.titulo} (${partes})${f.doi ? ` DOI:${f.doi}` : ''}`
}

/** Todas las reglas de un dominio. */
export function reglasDe(dominio: ReglaEvidencia['dominio']): ReglaEvidencia[] {
  return REGLAS_UCI.filter(r => r.dominio === dominio)
}
