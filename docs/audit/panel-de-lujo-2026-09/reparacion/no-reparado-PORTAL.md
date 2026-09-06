# Lo que no se reparó — rebanada PORTAL

Cuatro hallazgos de mi lista quedan sin reparar del todo, y ninguno por falta de
tiempo: tres necesitan un dato o un motor que vive en otra rebanada (ver
`handoff-PORTAL.md`) y uno el dueño ya lo decidió en contra.

---

## PC-011 — la foto de la herida · **decidido en contra, no pendiente**

«¿La herida se ve normal?» no se puede acompañar de una foto: el portal no tiene
ningún campo de archivo, así que la imagen acaba en el WhatsApp personal del
cirujano, fuera del expediente y de la bitácora.

**No se construye.** Es la decisión PL-P8 del dueño: la foto del paciente **no
entra en el alcance de V9** porque no está en la especificación. Y queda dicho
cómo tendría que entrar el día que se decida, para que no se construya mal:
la IA **no clasifica la imagen** — sólo se guarda y se escala.

Lo que sí se hizo, y acota el daño: la pregunta que la acompañaría («la herida
está roja y caliente y tengo fiebre») ahora **es urgencia** y no una escalación
ordinaria (PL-C9, fixture `pl-12`).

---

## PI-006 — «Ya no tomas: Tempra» y «Empiezas: Paracetamol»

Necesita un catálogo de sinónimos comercial↔genérico que vive en
`medical-dictionary.ts` (rebanada MOTORES). Comparar por prefijo uniría
«metoprolol» con «metotrexato», así que **no se adivina**: mejor un plan que dice
de más a un plan que fusiona dos fármacos distintos.

Handoff §1. Mientras tanto, el defecto sigue vivo y visible.

---

## PG-014 — la fecha probable de parto no llega al portal

El cálculo (Naegele) es determinista y correcto, pero la nota no lo guarda en un
sitio estable que el compositor del paquete pueda leer, con la fecha de la última
regla y el método. Añadir el campo al paquete **antes** de que alguien lo llene
sería exactamente lo que la regla «escrito y sin conectar» prohíbe.

Handoff §2.

---

## PP-006 — la hoja del cuidador sin peso, sin fecha de fin y sin frasco

«Amoxicilina · 5 mL · por la boca · cada 8 horas · durante 7 días» sin decir con
qué peso se calculó, cuándo termina y de qué frasco.

Se repara **en parte y en otra rebanada**, y lo que falta aquí depende de una
decisión del dueño:

- **El peso y la concentración** son `PL-C1`, que sigue abierta: hoy no existe el
  campo de presentación (mg/mL) y por eso «5 mL» pasa como dosis completa. La
  recomendación por omisión del dueño es que **el renglón no baje al cuidador sin
  concentración**, y eso se decide en la compuerta de la firma, que es de
  RECETA-DOCS y de MOTORES — no del portal.
- **La fecha en que termina** parece aritmética («7 días desde la consulta»), y no
  lo es: el tratamiento no empieza necesariamente el día de la consulta, y una
  fecha de fin impresa bajo una cédula profesional que esté un día corrida es una
  cifra clínica inventada. `NEEDS_CLINICAL_REVIEW`: hace falta decidir si la
  receta captura el día de inicio.

No se toca `comoTomarlo` para añadir nada de eso: componer una línea con datos
que no existen es el fallo más caro posible aquí (`clinical-safety.md` §1).

---

## Lo que se reparó a medias, y qué falta (no es «no reparado», pero conviene leerlo junto)

| Hallazgo | Qué se hizo | Qué falta, y de quién es |
|---|---|---|
| MC-016 · MO-010 | La petición llega al consultorio rotulada `documento_firmado` | El documento con firma protegida — RECETA-DOCS, y PL-L8 en la cola del dueño |
| MP-013 | Etiqueta correcta y el fixture ya tiene un caso de cuidador | Contestar la dosis del menor sigue siendo NO: depende de PL-C1 |
| PO-011 | El texto de la reseña dice la verdad | Publicar de verdad anónimo o preguntar — `reviews.ts`, AGENDA-MENSAJERIA |
| PO-012 | Tamaño táctil y contraste de lo que toqué | El tema oscuro de la pantalla entera — UI-CONFIG (handoff §7) |
| PG-021 | El portal deja de hablar en masculino | «¡Bienvenido!» del bot — AGENDA-MENSAJERIA |
| PP-015 | La respuesta urgente ya no mezcla registros ni pinta asteriscos | Decidir si el portal de un menor le habla al niño o a quien lo lee: es la misma decisión que la edad del adolescente (PL-P1), y no se asume |
| N-023 | «Tu acceso» da algo que gestionar y la receta se lee en pantalla | Que el paciente tenga motivos para VOLVER es producto, no un defecto: queda como lo que es |
