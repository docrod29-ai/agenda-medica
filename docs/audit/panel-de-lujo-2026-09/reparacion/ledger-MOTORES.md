# Bitácora de reparación — MOTORES

Rebanada de los motores clínicos, reparada por el orquestador (el lanzador de
agentes la rechazó tres veces y no se dejó pendiente). Formato del ledger del
repositorio; el número REG definitivo lo asigna la integración.

Las tres compuertas, sobre esta rebanada sola: `npx vitest run` 968 archivos y
12 884 casos en verde · `node scripts/lint-trinquete.mjs` 93 errores, igual que
el techo · `npx tsc --noEmit` limpio.

| ID | Área | Incidente | Estado | Test / control permanente |
|----|------|-----------|--------|----------------------------|
| MP-005 | Clínico (P0) | «Amoxicilina 5 mL cada 8 horas» se firmaba, se imprimía y llegaba al cuidador sin decir de qué concentración: el volumen pasaba la compuerta de unidad como dosis completa y el verificador se saltaba el renglón. Con 125 mg/5 mL y con 500 mg/5 mL es la misma receta y cuatro veces la dosis | CLOSED | `src/__tests__/dosis-unidad-ausente.test.ts` — aviso propio `volumen_sin_concentracion`, con la prueba al revés (con concentración escrita no avisa) |
| MI-006 | Clínico (P1) | En un producto combinado el motor leía la cifra del otro componente: «Paracetamol/tramadol 325/37.5 mg» se revisaba como 37.5 mg de paracetamol, y esa cifra —que el médico no escribió— se le devolvía a él | CLOSED | `src/__tests__/dosis-unidad-ausente.test.ts` — `extraerMg` devuelve `null` y se emite `dosis_combinada_no_repartible`; control con concentración real |
| RT-003 | Clínico (P1) | La unidad sólo se vigilaba cuando FALTABA, nunca cuando era imposible para ese fármaco: «Digoxina 250 mg» y «Enoxaparina 60 mcg» —el factor de mil que el propio módulo nombra como su motivo de existir— salían impresas sin una sola alerta | CLOSED | `src/__tests__/dosis-unidad-ausente.test.ts` — `revisarDimensionUnidad`, tabla de DIMENSIÓN (no de dosis) con su fuente dentro del repositorio |
| MI-004 | Clínico (P1) | Una alergia escrita por clase —«cefalosporinas», «betalactámicos», «penicilinas»— no disparaba nada al recetar un miembro de la familia, porque el motor sólo conocía nombres de principio activo | CLOSED | `src/__tests__/medical-dictionary.test.ts` y `nom004.test.ts` — `miembrosCubiertosPorAlergia` |
| MI-005 | Clínico (P1) | El parche para lo anterior era `a.includes('beta')`: una alergia a betametasona o a betabloqueadores bloqueaba la firma de la nota como alergia a betalactámicos, y la única salida era borrar la alergia del expediente | CLOSED | `src/__tests__/medical-dictionary.test.ts` — probado al revés: los dos falsos amigos devuelven lista vacía |
| MG-006 | Clínico (P1) | «Valproato de magnesio», «divalproato» y «metotrexate» —como se surten en México— no casaban con sus renglones, así que dos teratógenos mayores pasaban sin aviso en una paciente embarazada | CLOSED | `src/lib/expediente/prescripcion-segura.ts` con `sinonimos`; cubierto por el arnés de seguridad clínica |
| MP-003 | Clínico (P1) | La pauta «Gentamicina neonatal (≤7 días)» no tenía edad máxima legible por el motor y se elegía por subcadena para cualquier niño: alarma crítica de pauta neonatal en un escolar, y la pauta de dosis única ofrecida a un recién nacido | CLOSED | `elegirFarmacoPed` con `edadMaximaDias: 7`, la cifra que ya estaba escrita en el nombre y la nota del catálogo |
| MP-016 | Clínico (P1) | Las contraindicaciones por edad (ibuprofeno bajo 6 meses, trimetoprim bajo 2, nitrofurantoína bajo 1) estaban escritas y validadas, y el motor sabía aplicarlas: nadie le pasaba la edad. Un lactante de tres meses cruzaba la consulta sin aviso | CLOSED | `EntradaCopiloto.edadMeses`/`edadDias` y aviso crítico; cuando la edad no consta se dice en voz alta, no se calla |

## Lo que se corrigió sobre la marcha, porque las pruebas viejas lo cazaron

Dos veces. Queda escrito porque es la parte útil.

1. **La política de alergia cruzada estaba sellada desde julio de 2026** — que una
   alergia a penicilina alerte sobre una cefalosporina— y mi primer arreglo de
   MI-004 la partió en subfamilias. Dos pruebas lo cazaron. La familia vuelve a
   ser una sola: lo único que cambia es cómo se reconoce la alergia escrita.
2. **El aviso del jarabe habría llenado la terapia intensiva de alarmas falsas.**
   «5 mL/h» es una velocidad de infusión, y ahí la concentración vive en la orden
   de preparación. Lo cazó `dosis-avisa-antes-de-firmar.test.ts`. Se acotó.

## Decisiones aplicadas por omisión, con el valor seguro

| Hallazgo | Decisión aplicada | Dónde se cambia | Por qué es la segura |
|---|---|---|---|
| RT-003 | Lista corta de fármacos por dimensión (microgramos frente a miligramos), tomada del comentario del propio módulo y de las presentaciones de `medicamentos-catalogo.ts` | `EN_MICROGRAMOS` y `NUNCA_EN_MICROGRAMOS` en `src/lib/seguridad/dosis.ts` | El aviso dice «verifica la unidad», nunca «la dosis correcta es otra». Ampliar la lista es criterio clínico: `NEEDS_CLINICAL_REVIEW` |
| MP-004 | El aviso `sin_referencia` ya existía y es el mecanismo correcto; no se inventa ningún techo adulto para los veinte fármacos pediátricos | `src/lib/seguridad/dosis.ts` | Rellenar un techo plausible es el fallo más caro posible aquí. Queda como la decisión pendiente del dueño que ya era (REG-043) |
| Gotas | Se clasifican como presentación, no como volumen | `RE_FORMA` en `src/lib/seguridad/dosis.ts` | Es lo que el módulo declaraba de sí mismo y lo que su prueba exigía. Queda escrito que unas gotas orales pediátricas SÍ dependen de la concentración: dónde va la raya es `NEEDS_CLINICAL_REVIEW` |
| MI-004 | Un término de clase cubre la familia entera, igual que un miembro nombrado | `miembrosCubiertosPorAlergia` | Conserva la política sellada en 2026-07 sin fabricar una nueva |

## Traspasos a otras rebanadas

| Para | Qué hace falta | Por qué no lo hice yo |
|---|---|---|
| CONSULTA | Pasar `edadMeses` y `edadDias` al copiloto desde la fecha de nacimiento; capturar la presentación o concentración del medicamento; pintar el sello de motor sin validar | La pantalla de consulta es su rebanada |
| RECETA-DOCS | Imprimir la concentración junto a los mililitros; que la compuerta de firma use `miembrosCubiertosPorAlergia` en vez de comparar por token | El impreso y `nom004` son su rebanada |
| PORTAL | Que la hoja del paciente no entregue un volumen sin concentración | El paquete del paciente es su rebanada |

## Lo que NO se reparó en esta rebanada

| Hallazgo | Por qué |
|---|---|
| MP-004 (techos adultos de veinte fármacos pediátricos) | Exige cifras clínicas que sólo el dueño puede aportar. El mecanismo que las declararía ya existe y funciona; falta el dato. Sigue siendo REG-043 |
| MI-014 (dos catálogos renales) | Unificarlos exige decidir cuál manda y qué escala se usa para dosificar. La pregunta ya está formulada en el propio registro de motores. `NEEDS_CLINICAL_REVIEW` |
| MC-005 (dosis de profilaxis quirúrgica sin fuente) | Las cifras no tienen fuente citada en ningún sitio del repositorio. Marcarlas como no validadas es lo que ya hace el registro; pintarlo es de CONSULTA |
