// ════════════════════════════════════════════════════════════════════
// Motor GATILLADO POR FÁRMACO — recomendaciones basadas en las 12 guías cargadas
// (KDIGO 2020, AST IDCOP 2019, AASLD/AST 2025, ASH 2020 [Malpica/Moll],
// Morrison CID 2014, Cuvelier 2023, Tverdek 2023, Portillo/OFID 2023, Consenso
// mantenimiento IS ACCP/AST/ISHLT 2022). Cada fármaco seleccionado (chip
// hc_cb_inmuno_*) dispara su tamizaje/profilaxis/monitoreo con CITA de la fuente.
// Puro y testeable. NO inventa dosis (validación clínica).
// ════════════════════════════════════════════════════════════════════
import type { Rec } from './recomendaciones'

type V = Record<string, string>

/**
 * Reglas por fármaco inmunosupresor. Lee los chips hc_cb_inmuno_<clave> y
 * hc_est_<serología> para condicionar (p. ej. VHB+ → profilaxis antiviral).
 */
export function recsFarmacos(v: V): Rec[] {
  const on = (k: string) => v['hc_cb_inmuno_' + k] === '1'
  const res = (k: string) => (v['hc_res_' + k] || '').toLowerCase()
  const resPos = (k: string) => /positivo/.test(res(k))
  const zonaEndemica = v['hc_cb_expos_micosis'] === '1' || v['hc_cb_expos_viaje'] === '1'
  const out: Rec[] = []
  const rec = (titulo: string, detalle: string, sev: Rec['sev'], fuente: string) => out.push({ titulo, detalle, sev, fuente })

  // ── Corticoides ──
  if (on('est') || on('estalta')) {
    const alta = on('estalta')
    rec('Corticoides — profilaxis de Pneumocystis (según dosis)',
      'Indicar trimetoprima-sulfametoxazol cuando la dosis alcance el umbral de riesgo: prednisona-equivalente ≥30 mg/día ≥4 semanas, o ≥15–<30 mg/día ≥8 semanas, o ≥10 mg/día combinado con otro inmunosupresor (rituximab, anti-TNF, ciclofosfamida) o con ≥2 factores (edad >65, neumopatía). Alternativas: atovacuona, dapsona o pentamidina inhalada. Mantener hasta que la dosis baje a ≤5 mg/día.',
      alta ? 'alta' : 'media', 'ASH 2020 (Malpica/Moll)')
    rec('Corticoides — tamizaje de tuberculosis y hepatitis B antes de intensificar',
      'Con prednisona ≥10 mg/día >4 semanas: tamizar TB latente con IGRA (preferido) o PPD. Con >20 mg/día >4 semanas o uso crónico: solicitar HBsAg + anti-HBc; si es positivo, valorar profilaxis antiviral (entecavir/tenofovir).',
      'media', 'ASH 2020 (Malpica/Moll)')
    rec('Corticoides — herpes zóster y vacunas',
      'Riesgo de zóster aumentado (≈2.4×); aplicar la vacuna recombinante de zóster (Shingrix), idealmente ≥4 semanas antes de intensificar la inmunosupresión. Las vacunas vivas están contraindicadas con prednisona ≥20 mg/día ≥2 semanas (o dosis acumulada >700 mg en 3 meses): diferirlas ≥1 mes tras suspender.',
      'media', 'ASH 2020 / ACIP')
    if (zonaEndemica) rec('Corticoides — Strongyloides en zona endémica',
      'En paciente de zona endémica o con exposición: tamizar con serología IgG anti-Strongyloides (± coproparasitoscópico) o dar ivermectina empírica antes de inmunosuprimir, para prevenir el síndrome de hiperinfección.',
      'media', 'ASH 2020 (Malpica/Moll)')
  }

  // ── Antimetabolitos (azatioprina / micofenolato) ──
  if (on('antimet')) {
    rec('Antimetabolito (AZA/MMF) — vigilancia de LMP',
      'Advertencia de recuadro negro de leucoencefalopatía multifocal progresiva por virus JC. Ante síntomas neurológicos nuevos (hemiparesia, apatía, confusión, ataxia, alteración visual/auditiva): resonancia cerebral e interconsulta neurológica urgente. Riesgo aumentado de VVZ diseminado, CMV, BK, Listeria, Cryptococcus y Pneumocystis en combinación.',
      'media', 'ASH 2020 (Malpica/Moll)')
  }

  // ── Calcineurínicos (tacrolimus / ciclosporina) ──
  if (on('cni')) {
    rec('Calcineurínico — riesgo viral e interacciones',
      'Deterioro de la inmunidad T: riesgo de CMV, HSV y VZV. Vigilar interacciones: los azoles (fluconazol, posaconazol, voriconazol) elevan sus niveles y las rifamicinas los reducen; ajustar dosis y monitorizar niveles. No requiere profilaxis específica por sí solo.',
      'baja', 'ASH 2020; Consenso IS 2022')
  }

  // ── mTOR (sirolimus / everolimus) ──
  if (on('mtor')) {
    rec('mTOR — efecto protector frente a CMV',
      'Los inhibidores de mTOR se asocian a MENOR riesgo de enfermedad por CMV que los regímenes con calcineurínico + antimetabolito, y a menos malignidad de novo. Considerar al estratificar el riesgo de CMV y la necesidad de profilaxis.',
      'baja', 'Consenso IS ACCP/AST/ISHLT 2022')
  }

  // ── Ciclofosfamida ──
  if (on('cicfos')) {
    rec('Ciclofosfamida — Pneumocystis y neutropenia',
      'Con corticoide de dosis media concomitante (≥15–<30 mg/día prednisona-equivalente): indicar TMP-SMX hasta que la dosis baje a ≤5 mg/día. Vigilar biometría hemática seriada; no administrar si neutrófilos ≤1500/µL o plaquetas <50 000/µL. Ante fiebre neutropénica: antibiótico empírico ± G-CSF.',
      'media', 'ASH 2020 (Malpica/Moll)')
  }

  // ── Análogos de purinas (fludarabina/cladribina/pentostatina) ──
  if (on('purinas')) {
    rec('Análogo de purinas — profilaxis anti-Pneumocystis y anti-herpes',
      'Defecto profundo y prolongado de inmunidad celular T (persiste 1–2 años tras suspender). Indicar profilaxis anti-herpes (aciclovir/valaciclovir) y, sobre todo en esquemas con ciclofosfamida (FC/FCR), profilaxis de Pneumocystis con TMP-SMX. Vigilar reactivación de CMV.',
      'alta', 'Morrison CID 2014')
  }

  // ── Anti-CD20 (rituximab / obinutuzumab) ──
  if (on('anticd20')) {
    rec('Anti-CD20 — tamizaje de hepatitis B ANTES de iniciar',
      'Es el agente con mayor riesgo reconocido de reactivación de VHB. Solicitar HBsAg + anti-HBc + anti-HBs antes de la primera dosis.',
      'alta', 'Morrison CID 2014')
    const vhb = resPos('hbsag') || resPos('antihbc')
    rec('Anti-CD20 — profilaxis antiviral de VHB',
      (vhb ? 'VHB positivo en este paciente: ' : 'Si HBsAg+ o anti-HBc+: ') +
      'entecavir o tenofovir (análogo de alta barrera), iniciar 1–2 semanas antes de la primera dosis y continuar ≥6–12 meses tras la última (más prolongado tras rituximab), con vigilancia de HBV-DNA y transaminasas.',
      vhb ? 'alta' : 'media', 'Morrison CID 2014; ASH 2020')
    rec('Anti-CD20 — Pneumocystis, hipogammaglobulinemia y LMP',
      'Considerar profilaxis de Pneumocystis con TMP-SMX bajo inmunosupresión combinada. Vigilar IgG (reponer con inmunoglobulina si hay hipogammaglobulinemia sintomática o infecciones recurrentes). Riesgo raro de LMP por virus JC: ante síntomas neurológicos nuevos, resonancia cerebral y suspender el fármaco.',
      'media', 'Cuvelier 2023; Morrison CID 2014')
  }

  // ── Anti-TNF-α (infliximab/adalimumab/etanercept/golimumab/certolizumab) ──
  if (on('antitnf')) {
    rec('Anti-TNF — descartar y tratar TB latente antes de iniciar',
      'Riesgo de reactivación de TB 4–10× (con frecuencia extrapulmonar/diseminada). Tamizar con IGRA o PPD (positivo ≥5 mm) antes de iniciar; si hay TB latente, tratar (isoniazida ~9 meses u otro esquema) e iniciar el anti-TNF idealmente 1–2 meses después de comenzar el tratamiento.',
      'alta', 'Morrison CID 2014 / BTS')
    rec('Anti-TNF — hepatitis B/C y micosis endémicas',
      'Tamizar VHB (HBsAg, anti-HBc) y VHC antes de iniciar; dar profilaxis antiviral si VHB+. Riesgo de histoplasmosis, coccidioidomicosis, Listeria, Nocardia y Pneumocystis (mayor con infliximab): mantener alta sospecha, sobre todo en los primeros 90 días.',
      'media', 'Morrison CID 2014')
  }

  // ── Inhibidores de JAK (tofacitinib/baricitinib/upadacitinib) ──
  if (on('jak')) {
    rec('Inhibidor JAK — herpes zóster y tuberculosis',
      'Riesgo elevado de herpes zóster: aplicar la vacuna recombinante de zóster (Shingrix) antes de iniciar cuando sea posible. Tamizar TB latente (IGRA/PPD) y VHB antes del tratamiento.',
      'media', 'KDIGO 2020 (mención); etiqueta del fármaco')
  }

  // ── Inhibidores de BTK (ibrutinib/acalabrutinib) ──
  if (on('btk')) {
    rec('Inhibidor BTK — aspergilosis y Pneumocystis',
      'Inmunomodulación de células T y B con riesgo descrito de aspergilosis invasora (incluida la del SNC) y de Pneumocystis. Considerar profilaxis de Pneumocystis (TMP-SMX) y vigilancia/profilaxis antifúngica según el contexto y el riesgo de moho.',
      'media', 'Cuvelier 2023')
  }

  // ── Anti-CD52 (alemtuzumab) ──
  if (on('alemtuzumab')) {
    rec('Alemtuzumab — triple profilaxis y monitoreo de CMV',
      'Linfopenia profunda y prolongada (>9 meses). Indicar profilaxis anti-herpes (aciclovir/valaciclovir), anti-Pneumocystis (TMP-SMX) y antifúngica; monitorizar CMV con PCR cuantitativa periódica y dar tratamiento anticipado (valganciclovir) ante viremia. Riesgo de CMV, HSV, Aspergillus, Listeria y Cryptococcus.',
      'alta', 'Morrison CID 2014; Cuvelier 2023')
  }

  // ── ATG / timoglobulina ──
  if (on('atg')) {
    rec('ATG / timoglobulina — monitoreo viral estrecho',
      'Depleción profunda de linfocitos T con déficit de CD4 naïve durante los primeros 3–6 meses y aumento de reactivaciones virales. Monitoreo semanal de CMV y EBV por PCR; en el contexto de trasplante hematopoyético alogénico, profilaxis de CMV con letermovir.',
      'media', 'Cuvelier 2023')
  }

  // ── Anti-integrina (natalizumab / vedolizumab) ──
  if (on('antiintegrina')) {
    rec('Anti-integrina (natalizumab) — riesgo de LMP',
      'Natalizumab es la principal causa de LMP por virus JC en enfermedad neurológica/reumatológica; estratificar por serología de virus JC. Ante síntomas neurológicos nuevos: resonancia cerebral, interconsulta neurológica y suspensión del fármaco. (Vedolizumab, selectivo intestinal, tiene un riesgo mucho menor.)',
      'media', 'Morrison CID 2014')
  }

  // ── Inhibidor de proteasoma (bortezomib/carfilzomib) ──
  if (on('proteasoma')) {
    rec('Inhibidor de proteasoma — profilaxis de herpes zóster',
      'Incidencia de herpes zóster del 13–22% (aparición temprana, mediana ~39 días). Indicar profilaxis con aciclovir/valaciclovir durante el tratamiento.',
      'media', 'Morrison CID 2014')
  }

  // ── Anti-CD38 (daratumumab) ──
  if (on('anticd38')) {
    rec('Anti-CD38 (daratumumab) — reactivación viral',
      'Asociado a reactivación de VHB y a herpes zóster. Tamizar VHB antes de iniciar (profilaxis antiviral si positivo) e indicar profilaxis de herpes zóster con aciclovir/valaciclovir. (Efecto de clase; no detallado en las 12 guías cargadas.)',
      'media', 'Etiqueta del fármaco (fuera de las guías cargadas)')
  }

  // ── Anti-complemento (eculizumab / ravulizumab) ──
  if (on('eculizumab')) {
    rec('Anti-complemento (eculizumab) — vacunación antimeningocócica obligatoria',
      'Bloqueo del complemento terminal con alto riesgo de enfermedad meningocócica invasora. Vacunar contra meningococo conjugado ACWY + meningococo B (≥2 semanas antes si es posible) y considerar Haemophilus y neumococo; valorar antibiótico profiláctico según el protocolo. Umbral bajo para tratamiento empírico ante fiebre.',
      'alta', 'KDIGO 2020')
  }

  // ── Belatacept ──
  if (on('belatacept')) {
    rec('Belatacept — contraindicado en EBV-seronegativos',
      'De novo solo en receptores EBV-seropositivos: en EBV-seronegativos está contraindicado por el riesgo de síndrome linfoproliferativo postrasplante (PTLD). La conversión desde calcineurínico aumenta el riesgo de infección, particularmente CMV.',
      'media', 'Consenso IS ACCP/AST/ISHLT 2022')
  }

  // ── Quimioterapia (mielosupresora) ──
  if (on('quimio')) {
    rec('Quimioterapia — profilaxis en neutropenia y tamizaje de VHB',
      'En neutropenia profunda prolongada: considerar profilaxis antibacteriana (fluoroquinolona), antifúngica (fluconazol o azol con actividad frente a mohos según el riesgo de aspergilosis) y anti-Pneumocystis (TMP-SMX) según el esquema. Tamizar VHB (HBsAg, anti-HBc) antes de iniciar y dar profilaxis antiviral si es positivo.',
      'media', 'Tverdek 2023; Morrison CID 2014')
  }

  return out
}
