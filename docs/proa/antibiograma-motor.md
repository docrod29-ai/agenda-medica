# Motor determinista de antibiogramas — para validación del Dr.

**Estado:** construido + con tests (24), en rama `feat/proa-motor`. **NO en producción.**
Requiere tu visto bueno clínico antes de conducir prescripción.

**Validado por el Dr. (ronda 1) e incorporado:**
- MRSA, VRE, carbapenemasa ✓
- **Vanco CMI >2 en S. aureus → alerta de eficacia reducida** (VISA/hVISA/MIC creep)
- **AmpC ahora se marca por cefoxitina R** (capta plasmídicos + desreprimidos, no solo ESCPM); recomienda cefepime si S, carbapenémico si grave
- **BLEE** = 3G R + aztreonam R + cefoxitina S; advertencia de evitar 3G/aztreonam/cefepime
- **Carbapenemasa** infiere clase por ceftazidima-avibactam (S→serina KPC/OXA-48; R→MBL NDM/VIM → cefiderocol/combinación)

## Patrón
"La IA extrae, el motor decide." Un LLM (visión) lee la placa/reporte → pares
`{antibiótico, S/I/R}`. `interpretarAntibiograma()` (100% determinista, versionado,
17 tests) infiere fenotipos y alertas. Sin alucinación posible.

## Reglas encodadas (revísalas contra CLSI M100 / EUCAST de tu preferencia)

| Fenotipo | Disparo | Confianza | Acción |
|---|---|---|---|
| **MRSA** | S. aureus + oxacilina/cefoxitina R | confirmado | ignorar β-lactámicos salvo ceftarolina; notificación NOM-045 + contacto |
| **VRE** | Enterococcus + vancomicina R | confirmado | linezolid/dapto; notificación + contacto |
| **Carbapenemasa** | GN + carbapenémico R | probable | confirmar clase (KPC/NDM/OXA/VIM); notificación + contacto |
| **AmpC** | grupo ESCPM (Enterobacter/Serratia/Citrobacter/Morganella/Providencia) | confirmado (intrínseco) | NO 3G aunque reporte S → cefepime/carbapenémico |
| **BLEE** | Enterobacterales (no ESCPM) + 3G R + carbapenem S | probable | evitar cefalosporinas/aztreonam; carbapenémico dirigido |
| **FQ-R** | fluoroquinolona R | confirmado | informativo |
| **colistin-R** | colistina R | confirmado | última línea comprometida; combinada por CMI |
| **MDR** | ≥3 clases no-S (aprox.) | sospecha | clasificación formal = Magiorakos (CMI 2012) |

## PK/PD (sugerencias por clase presente y sensible)
- β-lactámicos → infusión extendida/continua (%fT>CMI) en grave/CMI alta.
- Vancomicina (MRSA) → AUC/MIC 400-600.
- Aminoglucósidos / fluoroquinolonas → concentración-dependientes, AUC/MIC.

## Qué falta (tu decisión / tu validación)
1. **Validar cada regla** arriba contra la edición CLSI/EUCAST que uses.
2. **Confirmación de mecanismo**: hoy la carbapenemasa es fenotípica (probable); si quieres inferir clase (KPC vs NDM vs OXA) hay que añadir reglas de sinergia (avibactam, ácido borónico, EDTA).
3. **Puntos de corte por CMI**: hoy el motor consume S/I/R ya interpretado; si quieres que el motor convierta CMI→S/I/R hay que cargar la tabla de breakpoints (por organismo × antibiótico) — es contenido clínico que debes validar.
4. **Cableado**: mostrarlo en la nota/consulta como apoyo (con el disclaimer de apoyo decisional).
