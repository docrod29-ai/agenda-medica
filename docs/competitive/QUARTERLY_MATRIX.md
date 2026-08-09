# Matriz competitiva — Abridge · Nabla · Suki

**Formato**: §24 del charter Master Loop V7.
**Consultado**: 7-ago-2026. **Toda afirmación sobre un tercero lleva su fuente.**

---

## La regla, otra vez

Lo que hace un competidor **necesita fuente y fecha**, o no se escribe
([`EL-FOSO.md`](EL-FOSO.md)). Este documento sale de páginas de producto,
documentación de soporte y notas de prensa **públicas**, consultadas el
7-ago-2026. No hay ninguna prueba de producto hecha por nosotros.

⚠️ **Lo que este documento NO es** — una comparación funcional verificada. El
§24 pide comparar con **casos sintéticos idénticos**, y eso exige acceso a los
tres productos. Hasta entonces, esto compara **lo que declaran**, no lo que hacen.
Es un mapa de dónde mirar, no un veredicto.

---

## En qué son mejores, dicho sin adornos

### Abridge — la trazabilidad

**Linked Evidence**: cada parte de la nota se puede resaltar para ver **el
fragmento exacto del transcript que la produjo** y **volver a oír el audio
original** ([soporte de Abridge](https://support.abridge.com/hc/en-us/articles/30235128433811-Verify-a-Note-With-Linked-Evidence)).

**Esto es lo más importante de todo el documento.** Es exactamente el §B10 de tu
propio charter —*«toda afirmación clínica generada debe enlazar a rango de audio,
hablante y segmento de transcript»*— y en NexusMED **está sin hacer**.

Y no es una función bonita: es la respuesta al único reclamo que un médico no
puede resolver solo — *«¿de dónde sacó la IA esto?»*. Sin eso, revisar una nota
obliga a reescuchar la consulta entera.

También declaran:
- Integración nativa con Epic (Haiku, Canto, Hyperdrive), Oracle Health y
  athenahealth ([producto](https://www.abridge.com/product))
- Motor de razonamiento contextual que alimenta soporte a la decisión con la
  evidencia enlazada ([CDS](https://www.abridge.com/cds))
- Best in KLAS en IA ambiental 2025 y 2026, documentación de enfermería y
  autorización previa ([prensa](https://www.abridge.com/press-release/patient-centered-clinician-intelligence-platform-keynote))

### Nabla — el idioma y la distribución

- **35+ idiomas**, español nativo (herencia francesa, mercado internacional)
- **20+ integraciones de expediente** con exportación a **campos estructurados**,
  no sólo texto: Epic, Oracle Health, athenahealth, NextGen, Greenway, Altera
- Huella pública declarada: 150+ organizaciones, 85 000+ clínicos
  ([reseña 2026](https://www.trytwofold.com/compare/nabla-copilot-review))

**Dónde nos gana de verdad**: no en «hablar español» —eso lo hace cualquier
modelo— sino en **escribir en los campos estructurados del expediente ajeno**. Es
distribución, y la distribución es más difícil de alcanzar que la inteligencia.

### Suki — el comando de voz

Suki no sólo dicta: **obedece**. El médico dice «Order metformin 500mg», «Show me
the patient's last A1c», «Add hypertension to the problem list» y el sistema lo
ejecuta o lo consulta ([reseña 2026](https://www.trytwofold.com/compare/suki-ai-review)).

Además: apoyo de codificación ICD-10/HCC integrado en el mismo asistente, y
responde preguntas leyendo el expediente. Declaran presencia en 400+ sistemas de
salud.

**Dónde nos gana**: la voz como **interfaz de mando**, no sólo de captura. En
NexusMED hay comandos de voz en UCI, pero no en la consulta.

---

## Dónde estamos por delante, con el número que lo sostiene

Esto sí es verificable en este repositorio y **cualquiera puede volver a
correrlo**:

| | NexusMED, medido | Comprobable en |
|---|---|---|
| **Ejes del habla medidos con corpus oro** | 4 — negación (21 formas), temporalidad (32 frases), experienciador (25 casos), certeza (26) | `src/__tests__/corpus-oro-*.test.ts` |
| **El LLM nunca calcula una cifra clínica** | decisión de arquitectura, probada en todos los tipos de nota | [ADR-002](../decisions/ADR-002-el-llm-no-calcula.md) |
| **Historial de defectos con causa raíz** | 60 REG + 13 familias contadas | [`docs/quality/`](../quality/FAMILIAS-DE-DEFECTO.md) |
| **Puerta de liberación** | 9 ceros declarados, 2 marcados DÉBILES | [`docs/evals/`](../evals/PUERTA-DE-LIBERACION.md) |
| **WER medido y publicado** | 25,55 % crudo → 22,81 % con pipeline | `docs/voice/WER-MEDIDO.md` |
| **Alcance** | agenda + cobro + receta + expediente + WhatsApp + hospital/UCI | el producto |

**La diferencia estructural**: los tres son **escribas**. Se conectan al
expediente de otro y escriben en él. NexusMED **es el expediente**: la consulta,
la agenda, el cobro, la receta y el seguimiento viven en el mismo sitio.

Eso es una ventaja **y** una desventaja, y conviene decir las dos:
- A favor: el ciclo se cierra dentro; no dependemos de la API de nadie.
- En contra: ellos entran a un hospital que ya tiene Epic; nosotros pedimos que
  cambien de sistema. **Es una venta mucho más difícil.**

---

## Lo que no se puede afirmar hoy

⬜ **Ninguna comparación de exactitud.** Ellos no publican WER ni tasa de
afirmación sin respaldo sobre un corpus abierto; nosotros sí publicamos el
nuestro. **Eso no significa que seamos mejores**: significa que no hay base común
de comparación. Afirmar lo contrario sería tracción falsa apuntando a un tercero.

⬜ **Precios.** Nabla y Suki no publican tarifas vigentes; lo que circula son
cifras antiguas de terceros.

⬜ **Resultados clínicos.** Sus cifras de ahorro de tiempo y reducción de
desgaste son **autodeclaradas**, igual que lo serían las nuestras.

---

## Cómo se actualiza

Trimestral, con **casos sintéticos idénticos** cuando haya acceso a los tres
productos (§24). Hasta entonces se actualiza la columna de *declarado*, y cada
fila conserva su enlace y su fecha de consulta.
