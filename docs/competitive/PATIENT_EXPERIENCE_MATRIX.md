# Matriz de experiencia del paciente — NexusMED frente al mercado

> **Unidad**: V9 · `PATIENT-UX-TRUTH-001` · 8-ago-2026
> **Fuentes**: información **pública** de agosto de 2026 (prensa sectorial,
> comparativas de mercado, material de los propios fabricantes). Las URL están
> al pie. **No se ha copiado ninguna interfaz**: lo que se extrae son
> principios de interacción y huecos.
> **Honestidad de la fuente**: casi todo lo publicado sobre estos productos
> describe lo que hacen **para el médico**. La cara del paciente está mucho peor
> documentada, y donde no hay dato público esta matriz dice `sin dato público`
> en vez de suponer. Ver §«Qué NO cubre».

---

## §1 — El hueco, en una frase

**El mercado de escriba ambiental se ha estratificado por integración con el
expediente hospitalario, no por lo que el paciente entiende al salir.** Abridge,
Nabla, Suki y Dragon Copilot compiten en profundidad de Epic, cobertura de
especialidades e idiomas de transcripción. El resumen para el paciente existe —
Abridge lo tiene y es una de sus banderas— pero se sirve **dentro del portal del
hospital**, como un documento, no como un producto con el que el paciente
convive entre visitas.

Eso deja un hueco que NexusMED puede ocupar sin pelear en el terreno donde esos
productos son inalcanzables (contratos de sistema hospitalario): **el médico
independiente y su paciente, con el paquete de la visita como objeto vivo.**

## §2 — Matriz

Leyenda: ✅ público y confirmado · ◐ parcial o limitado · — ausente o sin
evidencia pública · **?** sin dato público.

| Capacidad de cara al paciente | Abridge | Nabla | Suki | Dragon Copilot | **NexusMED hoy** | **NexusMED V9 (objetivo)** |
|---|---|---|---|---|---|---|
| Resumen de la visita en lenguaje llano | ✅ | ◐ | ? | ◐ | ✅ `HojaParaElPaciente` | ✅ + versionado y aprobado |
| Se genera automáticamente del encuentro | ✅ | ? | ? | ? | ✅ | ✅ |
| **Requiere aprobación explícita del médico antes de que el paciente lo vea** | ? | ? | ? | ? | ◐ | ✅ **DRAFT → RELEASED** |
| Destino propio del paciente (app/PWA), no sólo un PDF | ◐ portal del hospital | — | — | ◐ portal | ◐ `/mi/[token]` | ✅ 5 destinos |
| Qué hacer HOY (plan accionable, no narrativa) | ? | ? | ? | ? | — | ✅ TODAY |
| Instrucciones de medicación en llano | ✅ | ? | ? | ? | ◐ | ✅ |
| **Qué CAMBIÓ en su medicación desde la última visita** | ? | ? | ? | ? | — | ✅ `medicationChanges` |
| Receta firmada visible para el paciente | — | — | — | — | — | ✅ |
| Órdenes de estudio visibles y rastreables | ◐ genera órdenes | ? | ? | ? | ◐ | ✅ |
| Cartera de documentos con estado (firmado/liberado/vencido/revocado) | — | — | — | — | — | ✅ DOCUMENTS-001 |
| Descarga y compartición segura de documentos | ? | ? | ? | ? | ◐ enlace por token | ✅ con bitácora |
| Preguntas del paciente acotadas al plan aprobado | — | — | — | — | — | ✅ ASK NEXUS |
| Escalación al médico cuando la pregunta no es respondible | — | — | — | — | — | ✅ 5 clases |
| Multiidioma de cara al paciente | ✅ 28+ idiomas (transcripción) | ✅ 35+ (transcripción) | ? | ✅ | — es-MX fijo | ✅ es-MX → en-US |
| Recordatorios de seguimiento | ? | ? | ? | ? | ◐ recordatorios de cita | ✅ |
| Subida de resultados por el paciente | ? | ? | ? | ? | — | ✅ |
| Acceso de un cuidador autorizado | ? | ? | ? | ? | — | ✅ |
| **Bucle cerrado orden → resultado → revisión → aviso al paciente** | ◐ genera la orden | — | — | — | ◐ REG-252 abre la tarea | ✅ CLOSED-LOOP-PATIENT-001 |
| **Trazabilidad: de dónde salió cada frase** | — | — | — | — | ✅ REG-239/249/250 | ✅ se extiende al paciente |

### Las tres casillas que deciden

1. **La columna de aprobación está vacía en todo el mercado público.** Nadie
   documenta que el resumen del paciente pase por una compuerta de aprobación
   explícita y versionada. Es la casilla más barata de ganar y la que más pesa
   en seguridad: es la diferencia entre «la IA le dijo al paciente» y «el médico
   le dijo al paciente, y la IA lo redactó».

2. **Nadie tiene «qué cambió en tu medicación».** Todos resumen la visita;
   ninguno declara públicamente el *diff* entre el plan de hoy y el de la visita
   anterior. Es exactamente donde el paciente se equivoca y donde una plataforma
   con expediente longitudinal —invariante nº1 de NexusMED— ya tiene el dato.

3. **NexusMED ya gana en procedencia y nadie compite ahí.** Pulsar una frase y
   oír el segundo exacto del dictado (REG-250) no existe en el material público
   de ninguno. Extendido al paciente —«esto lo dijo tu médico, aquí»— es un
   argumento de confianza que un chatbot no puede imitar.

## §3 — Principios de interacción extraídos (no copiados)

De lo que el mercado ha demostrado que funciona:

1. **Antes / durante / después.** Abridge se movió en junio de 2026 de escriba a
   asistente que cubre las tres fases. La lección no es la función: es que **el
   valor está en el borde de la consulta**, no dentro de ella. V9 lo recoge en la
   condición de éxito: `ANTES → ENCUENTRO → PLAN → COMPRENSIÓN → … → CIERRE`.
2. **Nivel de lectura, no sólo traducción.** El fallo repetido del resumen para
   el paciente no es el idioma: es la jerga. Los productos que lo hacen bien
   reescriben a ~7.º de primaria. Para es-MX eso es una decisión de redacción,
   no de traducción.
3. **El resumen se empuja a donde el paciente ya vive**, no a un sitio nuevo que
   hay que recordar. Para un médico independiente en México eso es un enlace, no
   un portal hospitalario — y de ahí que `/mi/[token]` sea la base correcta.
4. **El médico revisa y despacha, no redacta.** Todo el mercado ha convergido en
   «generado para revisión». V9 lo endurece: sin aprobación no hay liberación.

## §4 — Dónde NexusMED **no** va a competir

Decirlo evita perseguir lo imposible:

- **Integración profunda con Epic / Oracle Health.** Es el foso de Abridge y
  Dragon Copilot y se compra con contratos de sistema. Practice vende a médico
  independiente y consultorio; ahí Epic no es el terreno.
- **Cobertura de 35+ idiomas de transcripción.** V9 arranca en es-MX y
  arquitectura para en-US. Ampliar la lista de idiomas del reconocedor no es
  ventaja para el cliente de Practice.
- **Número de especialidades.** El producto lo firma un internista e
  infectólogo; la profundidad en su especialidad vale más que la anchura.

## §5 — Qué **NO** cubre esta matriz

- **Las columnas de los competidores son información pública de agosto de 2026,
  y la cara del paciente está mal documentada.** Un `?` significa «no encontré
  fuente pública», **no** «no lo tienen». Varias casillas podrían llenarse con
  una demo que no tengo.
- **No se ha probado ningún producto de la competencia.** No hay cuenta ni
  acceso, y no se va a inventar una impresión de uso.
- **No mide calidad, mide presencia.** Que una casilla esté en ✅ no dice si
  está bien hecha.
- **La columna «NexusMED hoy» sí es verificable** y sale del repositorio; su
  evidencia está en `docs/patient/PATIENT_COMPANION_BASELINE.md`.
- **Nada de esto es una decisión comercial.** Precio, posicionamiento y a quién
  se vende son del dueño.

---

## Fuentes

- [Why Abridge is expanding from ambient scribe to active assistant — Fast Company](https://www.fastcompany.com/91502005/abridge-most-innovative-companies-2026)
- [Abridge Goes Beyond Documentation: 4 Updates — MedCity News](https://medcitynews.com/2026/06/abridge-clinical-ai/)
- [Ambient AI Scribe Comparison Guide 2026: DAX, Abridge, Nabla, DeepScribe — MedEquip Directory](https://www.medequipdirectory.com/guides/ambient-ai-scribe-comparison-guide-2026-dax-abridge-nabla-deepscribe/)
- [Ambient Clinical Documentation Companies: The 2026 List — Lime AI](https://getlimeai.com/ambient-clinical-documentation-companies/)
- [Nabla Copilot Review 2026 — Twofold](https://www.trytwofold.com/compare/nabla-copilot-review)
- [Abridge AI Review 2026 — DeepCura](https://www.deepcura.com/resources/abridge-ai-review)
- [Suki vs Nuance DAX vs Abridge vs Freed — IntuitionLabs](https://intuitionlabs.ai/articles/suki-vs-nuance-dax-vs-abridge-vs-freed)
- [After Visit Summary Template — PatientNotes](https://patientnotes.ai/resources/after-visit-summary-template)
- [Best Dragon Copilot Alternatives 2026 — Glass Health](https://glass.health/resources/best-dax-copilot-alternatives)
