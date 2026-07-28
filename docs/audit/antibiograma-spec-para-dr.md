# Spec de reparación — motor de antibiograma (para validación del Dr)

15 hallazgos VERIFICADOS del workflow. Son lógica de decisión clínica en un motor
regulado (NOM-045), así que **no los toco por iniciativa** — aquí está cada uno con
el bug de software, la conducta correcta (fundamento CLSI/EUCAST) y el cambio de
código propuesto. Tú validas la conducta; yo implemento en minutos.

Fundamento del skill PROA cargado: CLSI M100 (S = CMI ≤ sMax; R = CMI ≥ rMin);
EUCAST expert rules; "dato ausente ≠ resistente/sensible".

---

## GRUPO A — Propagación de la edición interpretativa EUCAST S→R (fuente única)
**El motor edita FQ (y otros) de S→R por regla experta, pero el resultado editado NO
llega a la nota, al prompt del LLM, al validador ni al PK/PD.** Cada salida muestra la
"S" cruda que el propio motor ya declaró R → contradicción en la misma hoja.

| # | Archivo | Qué pasa | Fix propuesto (software, tu OK a la conducta) |
|---|---|---|---|
| A1 | `razonar.ts:16` | `resumenDeterminista` (prompt LLM) no lee `edicionesInterpretativas` → LLM ve "Levofloxacino=S" | Aplicar las ediciones al arreglo antes de armar el prompt |
| A2 | `validar-razonamiento.ts:49` | El validador ignora las ediciones → una sugerencia de moxi/levo (editado R) pasa sin marcar contradicción | Validar contra el resultado EDITADO, no el crudo |
| A3 | `seguridad.ts:69` | PK/PD imprime "Fluoroquinolonas: dosis plena" para un fármaco editado a R | Reaplicar las ediciones a `r` antes del PK/PD |
| A4 | `resumen-nota.ts:27,62` | La nota imprime la "S" cruda y **descarta las alertas nivel 'alta'** (solo pasan 'critica') | Renderizar el resultado editado + incluir alertas 'alta' |
| A5 | `antibiograma/page.tsx:174` | La 2ª opinión (GPT-5) se muestra sin la caja roja: `contradiccionesSegundaOpinion` viaja pero el cliente no la lee | Leer y renderizar las contradicciones |

**Raíz común:** el resultado editado no es fuente única. **Conducta a validar:** ¿la
edición S→R de FQ debe reflejarse en TODAS las salidas? (esperado: sí).

---

## GRUPO B — "dato ausente ≠ resistente" (fail-closed correcto)
| # | Archivo | Qué pasa | Fix propuesto |
|---|---|---|---|
| B1 | `enterobacterales.ts:76` | La guarda "ertapenem-R aislado benigno" exige imipenem **S explícito**; con imipenem AUSENTE (panel mero+erta) una E. coli erta-R/mero-S se marca **carbapenemasa MBL + NOM-045 + aislamiento** | Distinguir "no probado" de "no-S"; si falta imipenem → indeterminado, no MBL |
| B2 | `nofermentadores.ts` | P. aeruginosa carbapenem-R con cefalosporinas **ausentes** (no probadas) se degrada a fenotipo benigno → suprime alerta crítica + NOM-045 + aislamiento | Solo degradar a "porina" si las cefalosporinas están **probadas** y conservadas |

**Conducta a validar:** ¿un panel sin imipenem/sin cefalosporinas debe caer a
"indeterminado — confirmar carbapenemasa" en vez de asumir un fenotipo? (esperado: sí).

---

## GRUPO C — CMI censurada (">X" / "<X") — preservar la desigualdad
El modelo **sí** guarda `cmiCensurada: '>' | '<'`, pero `cmiDe` y `interpretarCMI` lo
descartan y usan el número pelado.

| # | Archivo | Qué pasa | Fix propuesto |
|---|---|---|---|
| C1 | `util.ts:89` (`cmiDe`) | Neumococo penicilina ">2" → 2 → "tratable con penicilina" (falso-sensible); igual criterio meníngeo ">0.06" | `cmiDe` devuelve valor + operador; el clasificador nunca llama S a un ">sMax" |
| C2 | `clsi-breakpoints.ts:376` + `motor.ts:90` | `interpretarCMI` descarta `cmiCensurada`; ">8" en CAZ-AVI/mero-vaborbactam/imi-relebactam (β-lactámicos de reserva) → "S" afirmativo falso | Pasar el operador; ">X" con X≥sMax ⇒ nunca S |

**Conducta a validar (CLSI):** ">X" = CMI por encima de X ⇒ si X ≥ sMax, no puede ser
S. "<X" = CMI por debajo ⇒ puede ser S. (esperado: sí, es CLSI estándar).

---

## GRUPO D — Requiere tu decisión clínica (datos/umbrales, NO los invento)
| # | Archivo | Qué pasa | Necesito de ti |
|---|---|---|---|
| D1 | `medical-dictionary.ts:74` | Carbapenémicos marcados como reacción cruzada **'critica'** ante alergia a penicilina → bloquea 1ª línea en sepsis/meningitis. El gemelo `copiloto.ts` los trata como precaución (~1%) | ¿Carbapenémicos = 'critica' o 'precaución'? (la literatura actual apoya ~1% de reactividad cruzada) |
| D2 | `intrinseca.ts:69` | Cobertura intrínseca incompleta en Proteeae/AmpC (Morganella/Providencia/Serratia sin tigeciclina/tetraciclina/cefoxitina) → MDR 'confirmado' falso en cepa salvaje | ¿Confirmas la tabla de resistencias intrínsecas a agregar? |
| D3 | `intrinseca.ts`/`motor.ts:165` | El 2º conteo MDR (`contarClasesResistentes`) no excluye la resistencia intrínseca → P. aeruginosa silvestre etiquetada MDR 'sospecha' → tamiz de colistina innecesario | ¿Excluir intrínsecas del conteo MDR? (esperado: sí) |

---

## GRUPO E — Software correctness que SÍ puedo hacer solo (siguiente lote)
| # | Archivo | Qué pasa | Fix |
|---|---|---|---|
| E1 | `cds.ts:39` + `medical-dictionary.ts:147` | CDS pasa alergia de texto libre crudo a match por subcadena sin limpiar negaciones → alerta 'critica' ante alergia NEGADA | Aplicar el mismo guard de negación (como REG-034) |
| E2 | `seguridad.ts:70` (UCI) | Valores censurados (>500, >15, ≥6.5) → num=null → CERO alertas justo en los extremos críticos | Preservar el operador para las alertas de extremos |
| E3 | `antibiograma-vision/route.ts:132` | `registrarCreditos` solo en el camino feliz → una foto en blanco corre Claude sin cobrar crédito → drena la llave del dueño en prueba | Contabilizar crédito antes/independiente del parseo |

Nota: E1 (parte medical-dictionary) puede quedar YA cubierto por REG-034 si la lista
de alergias viene de `extraerAlergias`; falta la ruta de CDS hospitalario (texto crudo).

---

**Ya cerrado de este cluster:** REG-034 (`extraerAlergias` respeta negación).
