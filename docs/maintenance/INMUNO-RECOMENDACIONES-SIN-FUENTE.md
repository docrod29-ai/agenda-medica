# Inmuno — recomendaciones RETENIDAS por no tener fuente

**Generado por `node scripts/inmuno-sin-fuente.mjs`. No editar a mano la parte de
arriba: se regenera.** Las columnas vacías son las que hay que llenar.

Decisión 10 del Dr. (3-ago-2026): estas **39** recomendaciones NO se
muestran en la salida clínica hasta que tengan fuente, población, condiciones de
aplicación, excepciones, fecha, versión y revisor. **No están borradas**: siguen
en el código, retenidas en estado `UNSOURCED / NOT_FOR_CLINICAL_DISPLAY`.

Basta con añadir el cuarto argumento a la llamada `rec(...)` para que vuelva a
salir. Una por una, según se revise.

| # | Archivo:línea | Título | Detalle | Sev | FUENTE | Población | Condición | Excepciones | Fecha | Versión | Evidencia | Revisor |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `recomendaciones.ts:52` | VIH — profilaxis por CD4 (' + cd4 + ' células/µL) | Profilaxis indicada: ' + l.join('; ') + '. Optimizar el tratamiento antirretroviral y suspender la profilaxis tras una reconstitución inmune sostenida. | alta | | | | | | | | |
| 2 | `recomendaciones.ts:53` | VIH — CD4 ' + cd4 + ' células/µL | Sin profilaxis de oportunistas indicada por el recuento (≥200). Mantener el tratamiento antirretroviral. | baja | | | | | | | | |
| 3 | `recomendaciones.ts:54` | VIH — falta el recuento de CD4 | Capturar CD4 y carga viral para definir el escalón de profilaxis (Pneumocystis con CD4 <200, Toxoplasma <100, complejo M. avium <50). | media | | | | | | | | |
| 4 | `recomendaciones.ts:56` | Pre-protocolo (aún sin inmunosupresión) | Completar el tamizaje basal y la vacunación antes de iniciar la inmunosupresión. En esta etapa no está indicada la profilaxis de oportunistas: se inicia al comenzar la inmunosupresión. | media | | | | | | | | |
| 5 | `recomendaciones.ts:57` | Tuberculosis latente | Tamizar con IGRA y radiografía de tórax; si es positivo, tratar antes de inmunosuprimir, vigilando la interacción de las rifamicinas con los inhibidores de calcineurina. | media | | | | | | | | |
| 6 | `recomendaciones.ts:58` | Vacunación | Aplicar las vacunas inactivadas pertinentes (influenza, neumococo conjugada y polisacárida, hepatitis B y SARS-CoV-2). Las vacunas vivas solo pueden aplicarse ahora, al menos cuatro semanas antes de iniciar la inmunosupr | media | | | | | | | | |
| 7 | `recomendaciones.ts:60` | Sin inmunosupresión activa | Menor riesgo de infecciones oportunistas; no se indica profilaxis sistemática. Reevaluar según la enfermedad de base y el plan terapéutico. | baja | | | | | | | | |
| 8 | `recomendaciones.ts:75` | Fase post-trasplante (aproximadamente ' + d + ' días) | Patógenos esperados en esta ventana: ' + faseTxt | media | | | | | | | | |
| 9 | `recomendaciones.ts:78` | Profilaxis para Pneumocystis en curso | Mantenerla mientras persista la inmunosupresión relevante. | baja | | | | | | | | |
| 10 | `recomendaciones.ts:79` | Profilaxis para Pneumocystis indicada | Bajo inmunosupresión relevante (trasplante, corticoides en dosis altas y prolongadas, análogos de purina o regímenes equivalentes). De elección trimetoprima con sulfametoxazol; ' + (g6pdDef ? 'usar atovacuona por el défi | media | | | | | | | | |
| 11 | `recomendaciones.ts:80` | Citomegalovirus | Estratificar por el serostatus donante/receptor; la combinación donante positivo con receptor negativo es la de mayor riesgo. Definir profilaxis (valganciclovir; letermovir en trasplante hematopoyético) o estrategia anti | media | | | | | | | | |
| 12 | `recomendaciones.ts:81` | Profilaxis antifúngica | Trasplante pulmonar: indicar cobertura frente a hongos filamentosos según el protocolo del centro. | media | | | | | | | | |
| 13 | `recomendaciones.ts:82` | Profilaxis antifúngica | Trasplante hematopoyético alogénico: cobertura frente a hongos filamentosos durante la neutropenia y la enfermedad injerto contra huésped, con vigilancia de galactomanano. | media | | | | | | | | |
| 14 | `recomendaciones.ts:83` | Neutropenia | Ante fiebre: tomar hemocultivos e iniciar un betalactámico con actividad antipseudomonas dentro de la primera hora, con estratificación de riesgo. | media | | | | | | | | |
| 15 | `recomendaciones.ts:85` | Define el estado de inmunosupresión | Indica en «¿Inmunosupresión hoy?» si está en curso, va a iniciar (pre-protocolo) o ninguna. El plan de profilaxis depende de ello; sin ese dato no se recomienda profilaxis para no inducir tratamientos innecesarios. | media | | | | | | | | |
| 16 | `recomendaciones.ts:87` | Tamizaje según el biológico | Anti-CD20: tamizar hepatitis B e indicar profilaxis antiviral si hay anti-HBc positivo. Anti-TNF: descartar tuberculosis latente antes de iniciar. Inhibidores de JAK: riesgo de herpes zóster, considerar la vacuna recombi | media | | | | | | | | |
| 17 | `recomendaciones.ts:88` | Vacunación bajo inmunosupresión | Aplicar vacunas inactivadas (influenza, neumococo conjugada y polisacárida, hepatitis B, SARS-CoV-2 y herpes zóster recombinante). Las vacunas vivas están contraindicadas. La respuesta es subóptima; programar refuerzos o | media | | | | | | | | |
| 18 | `recomendaciones.ts:93` | Citomegalovirus detectable | Carga viral positiva: iniciar tratamiento anticipado (valganciclovir oral o ganciclovir IV según gravedad) y seguir la carga viral hasta su negativización; reducir la inmunosupresión si es posible (validación clínica). | alta | | | | | | | | |
| 19 | `recomendaciones.ts:94` | Marcador fúngico positivo | Galactomanano o β-D-glucano positivo: ampliar el estudio (tomografía de tórax, cultivos, antígenos dirigidos) y valorar tratamiento antifúngico de hongos filamentosos según el foco (validación clínica). | alta | | | | | | | | |
| 20 | `recomendaciones.ts:95` | Antígeno criptocócico positivo | Realizar punción lumbar para descartar meningitis; en afección del sistema nervioso central, tratar con anfotericina B liposomal y flucitosina en la inducción (validación clínica). | alta | | | | | | | | |
| 21 | `recomendaciones.ts:96` | Micosis endémica positiva | Confirmar con la prueba específica, estadificar la extensión e iniciar tratamiento antifúngico dirigido; ajustar la inmunosupresión (validación clínica). | media | | | | | | | | |
| 22 | `recomendaciones.ts:97` | Viremia por BK | En trasplante renal sugiere nefropatía por BK: la intervención principal es reducir la inmunosupresión, con seguimiento de la carga viral y de la función del injerto. | media | | | | | | | | |
| 23 | `recomendaciones.ts:98` | Hemocultivo positivo | Tratar la bacteriemia según la identificación y el antibiograma; buscar el foco y retirar los dispositivos intravasculares implicados. | alta | | | | | | | | |
| 24 | `recomendaciones.ts:99` | Urocultivo positivo | Tratar según el antibiograma y la presencia de síntomas; evitar tratar bacteriuria asintomática salvo situaciones específicas. | media | | | | | | | | |
| 25 | `recomendaciones.ts:100` | Clostridioides difficile positivo | Suspender el antimicrobiano no esencial e iniciar tratamiento dirigido (vancomicina oral o fidaxomicina); evitar antiperistálticos. | media | | | | | | | | |
| 26 | `recomendaciones.ts:101` | Tuberculosis latente positiva | IGRA/PPD positivo: tratar la infección latente; si va a iniciar inmunosupresión, hacerlo antes, vigilando las interacciones de las rifamicinas. | media | | | | | | | | |
| 27 | `recomendaciones.ts:107` | Hepatitis B: susceptible | Sin infección ni inmunidad (HBsAg, anti-HBc y anti-HBs negativos): vacunar contra hepatitis B. En candidatos a inmunosupresión, considerar esquema acelerado o de doble dosis y verificar la seroconversión (anti-HBs ≥10 mU | media | | | | | | | | |
| 28 | `recomendaciones.ts:108` | Hepatitis B: inmune por vacuna | Anti-HBs positivo con anti-HBc negativo: inmunidad vacunal; sin medidas adicionales. Vigilar el título si recibe inmunosupresión intensa y reforzar si cae por debajo de 10 mUI/mL. | baja | | | | | | | | |
| 29 | `recomendaciones.ts:111` | CMV IgG positivo (receptor seropositivo) | Riesgo de reactivación bajo inmunosupresión: definir profilaxis o estrategia anticipada guiada por carga viral, según el órgano y el régimen. | media | | | | | | | | |
| 30 | `recomendaciones.ts:112` | CMV IgG negativo (receptor seronegativo) | Con donante positivo (D+/R−) es el escenario de mayor riesgo de enfermedad por CMV: indicar profilaxis y usar hemoderivados leucorreducidos o CMV-negativos. | alta | | | | | | | | |
| 31 | `recomendaciones.ts:113` | EBV IgG positivo | Riesgo bajo de síndrome linfoproliferativo postrasplante; vigilancia clínica. | baja | | | | | | | | |
| 32 | `recomendaciones.ts:114` | EBV IgG negativo (seronegativo) | Con donante positivo, riesgo de primoinfección y de enfermedad linfoproliferativa postrasplante: monitorizar la carga viral de EBV y minimizar la inmunosupresión. | media | | | | | | | | |
| 33 | `recomendaciones.ts:115` | HSV seropositivo | Riesgo de reactivación: profilaxis con aciclovir o valaciclovir durante la inmunosupresión intensa o el postrasplante temprano, salvo que ya reciba un antiviral que lo cubra (dosis con validación clínica). | media | | | | | | | | |
| 34 | `recomendaciones.ts:116` | VZV seropositivo | Inmunidad presente; ante exposición o herpes zóster, tratamiento antiviral oportuno. Considerar la vacuna recombinante de zóster. | baja | | | | | | | | |
| 35 | `recomendaciones.ts:117` | VZV seronegativo | Susceptible a varicela grave: aplicar la vacuna de varicela ANTES de inmunosuprimir (es viva, contraindicada bajo inmunosupresión) y dar profilaxis postexposición ante un contacto. | media | | | | | | | | |
| 36 | `recomendaciones.ts:118` | Toxoplasma seropositivo | Riesgo de reactivación bajo inmunosupresión (mayor en trasplante cardiaco y hematopoyético); la profilaxis con trimetoprima-sulfametoxazol lo cubre. | media | | | | | | | | |
| 37 | `recomendaciones.ts:119` | Toxoplasma seronegativo | En trasplante cardiaco con donante positivo (D+/R−) es el grupo de mayor riesgo: indicar profilaxis dirigida. | media | | | | | | | | |
| 38 | `recomendaciones.ts:120` | Anti-VHC positivo | Confirmar con carga viral (HCV RNA); si hay viremia, tratar con antivirales de acción directa y referir a hepatología; vigilar la función hepática bajo inmunosupresión. | media | | | | | | | | |
| 39 | `recomendaciones.ts:121` | VDRL/RPR positivo | Confirmar con prueba treponémica (FTA-ABS o TP-PA); estadificar y tratar con penicilina según la etapa; ante datos neurológicos o coinfección por VIH, valorar punción lumbar. | media | | | | | | | | |
