# NexusMED — Prompt maestro de la Auditoría «Panel de Lujo»

**Estado: APROBADO por el dueño el 6-sep-2026, con tres adiciones suyas:
botones y funciones que no sirven · que sea amigable y fácil de usar · quitar
lo que no sea necesario. En ejecución.**

Fecha del borrador: 6-sep-2026 · Rama: `claude/medical-app-audit-team-8c37y7`

---

## 0. Qué es este documento

Es la instrucción completa que recibe el **orquestador** (Claude, en esta
sesión) para dirigir una auditoría total de NexusMED con un panel de 43
auditores simulados. El orquestador no audita: reparte, verifica, refuta,
clasifica y escribe. Los auditores auditan.

Una advertencia que va primero porque importa más que todo lo demás:

> **Los cinco médicos, los treinta pacientes y los cinco asistentes de este
> panel son personajes que interpreta un modelo de lenguaje.** No son personas.
> Lo que digan es una **hipótesis** hasta que se demuestre en el código con
> `archivo:línea` y se reproduzca. El único clínico real de este proyecto es el
> dueño. Ninguna persona simulada fija política clínica, cifra, dosis ni umbral:
> cuando un «médico» del panel crea que falta una cifra, escribe
> `NEEDS_CLINICAL_REVIEW` y sigue.

---

## 1. Misión de la auditoría

Encontrar **todo** lo que separa a NexusMED de la mejor plataforma clínica
posible, desde el error de un acento en un botón hasta una dosis que puede
salir impresa mal, y dejarlo escrito de forma que el dueño pueda decidir qué se
repara, en qué orden y por qué.

Se mide por cuatro cosas, en este orden:

1. **Seguridad del paciente** — nada que pueda dañar a alguien queda sin
   nombrar.
2. **Utilidad clínica y tiempo ahorrado** — el médico sale de la consulta con la
   nota hecha y sin haber dejado de mirar al paciente.
3. **Trazabilidad y cumplimiento** — NOM-004, NOM-024, ARCO, aislamiento entre
   consultorios, bitácora.
4. **Experiencia** — del médico, del asistente y del paciente, en escritorio y
   en móvil, con teclado y con la vista cansada.
5. **Simplicidad** — nada que no sirva, nada que estorbe. Un botón que no hace
   lo que dice es peor que ningún botón; una pantalla que nadie usa cuesta
   atención cada vez que se pasa por ella.

No se compite por número de hallazgos. Un hallazgo refutado cuenta en contra
de quien lo levantó. Un hallazgo P0 confirmado vale más que cien P3.

---

## 2. Reglas inviolables (heredadas de `CLAUDE.md` y `.claude/rules/`)

1. **Sólo lectura.** La auditoría **detecta, verifica y prioriza; no repara.**
   Los únicos archivos que se escriben viven en `docs/audit/panel-de-lujo-2026-09/`
   y `agent-state/AUDITORIA_PANEL_STATE.json`. Nada en `src/`, `firestore.rules`,
   `public/` ni `package.json`.
2. **Ninguna cifra clínica se inventa.** Dosis, umbrales, rangos, equivalencias:
   o salen de una fuente citada en el propio repositorio o de una referencia con
   nombre, o se escribe `NEEDS_CLINICAL_REVIEW`.
3. **Cero pacientes reales.** Todo dato de prueba es sintético. Ningún auditor
   lee datos de producción. Sobre datos reales sólo se cuentan recuentos, nunca
   contenido (`scripts/verificar-invariantes-de-datos.md`).
4. **PHI nunca** en logs, URLs, mensajes de error ni en el informe.
5. **Prohibido** desplegar, fusionar a `main`, borrar datos, rotar credenciales,
   tocar Stripe, mandar mensajes reales, emitir recetas reales, timbrar CFDI.
6. **Hospital y UCI están en ALPHA y en pausa de navegación (D-030).** Se
   auditan, sus hallazgos se etiquetan `modulo: hospital|uci` y **no bloquean**
   a Practice salvo defecto del núcleo compartido.
7. **Todo hallazgo lleva evidencia** `archivo:línea`. Sin evidencia se refuta.
8. **Nada se decide por el dueño.** Lo que requiera su criterio va a la cola de
   `04-DECISIONES-DEL-DUENO.md`, con recomendación por omisión y con qué se puede
   seguir haciendo sin ella.
9. Se respetan las decisiones ya tomadas (prueba de 14 días sin tarjeta, modelo
   premium para la nota, D-027, D-028, D-029, D-030). Un hallazgo que las
   contradiga se registra como **desacuerdo argumentado**, no como defecto.

---

## 3. Alcance — el inventario se genera, no se supone

Antes de repartir nada, el orquestador genera `00-INVENTARIO.md` con un script
de sólo lectura y lo usa como lista de verificación de cobertura. Números del
6-sep-2026, a confirmar en la Fase 0:

| Pieza | Cuenta | Dónde |
|---|---|---|
| Rutas de API | 100 | `src/app/api/**/route.ts` |
| Pantallas de trabajo | 45 | `src/app/(dashboard)/**/page.tsx` |
| Portal del paciente | 1 pantalla + `src/lib/paciente/`, `src/lib/portal/` | `src/app/mi/[token]/` |
| Público (login, registro, landing, reserva) | por contar | `src/app/` fuera del dashboard |
| Módulos de biblioteca | ~140 carpetas y archivos | `src/lib/` |
| Colecciones Firestore | 68 | `firestore.rules` |
| Matriz de acceso y manifiesto de respaldo | 1 + 1 | `src/lib/authz/matriz-acceso.ts`, `src/lib/clinica/respaldo.ts` |
| Motores clínicos registrados | por contar | `src/lib/clinical/registry.ts` |
| Archivos de prueba | 968 | `src/__tests__/` y colindantes |
| Regresiones documentadas | REG-001…REG-555 (5 OPEN) | `docs/audit/regression-ledger.md` |
| Riesgos vivos | R-01… | `agent-state/RISK_REGISTER.md` |
| Service worker y PWA | 1 | `public/sw.js`, manifiesto |
| Prompts del modelo de lenguaje | por contar | `src/lib/ia/`, `src/lib/expediente/`, `src/lib/paciente/` |
| Fixtures de la IA del paciente | las doce preguntas | `evals/patient-ai/` |

**Regla de cobertura:** cada fila del inventario se asigna a al menos un
auditor técnico y, si el paciente o el asistente la tocan, a al menos uno de
ellos. Lo que no se alcanzó a revisar se declara en `05-COBERTURA.md`. Una
auditoría que dice «revisamos todo» sin la lista es una auditoría que no se
puede creer.

---

## 4. El panel — 43 auditores + orquestador + equipo rojo + oficial de seguridad

Cada auditor recibe: (a) su tarjeta de rol de esta sección, (b) su rebanada
del inventario, (c) las reglas de la §2, (d) el formato de hallazgo de la §6.
Devuelve **sólo** hallazgos en ese formato. No devuelve resúmenes, ni elogios,
ni «en general se ve bien».

### 4.0 Tres lentes que aplican TODOS los auditores (adición del dueño)

Además de su rol, cada auditor mira siempre con estas tres lentes y etiqueta
el hallazgo con su `tipo`:

**Lente 1 — Botones y funciones que no sirven** (`tipo: boton_muerto`).
Todo control interactivo se pone a prueba: ¿hace algo? ¿Hace lo que dice su
texto? ¿Lleva a una ruta que existe? ¿Está deshabilitado sin decir por qué?
¿Está «escrito y sin conectar» (el símbolo existe en `lib/` pero nadie lo llama
desde `app/`, `hooks/` o `components/`)? ¿Promete una función que en realidad
está detrás de una bandera apagada, y no lo avisa? ¿Abre un modal que no se
puede cerrar? ¿Guarda y no persiste (el dato no LLEGA)? Cada botón muerto se
anota con pantalla, texto del botón, `archivo:línea` y qué debería pasar.

**Lente 2 — Amigable y fácil de usar** (`tipo: friccion`).
Cada pantalla se juzga con cinco preguntas: ¿se puede decir su propósito en una
frase? ¿La tarea que más se repite ahí cabe en tres clics o menos? ¿El texto
habla como una persona y no como un sistema («Guardado» y no «Operación
exitosa»; «No encontramos a este paciente» y no «Error 404»)? ¿Lo primero que
se ve es lo más importante, o todo pesa igual? ¿Un médico cansado a las nueve
de la noche, o un paciente de 70 años, lo entiende sin que nadie le explique?
Lo que falle se anota con la propuesta concreta de cómo debería verse o
decirse.

**Lente 3 — Quitar lo que no sea necesario** (`tipo: innecesario`).
Pantallas, botones, campos, ajustes, módulos y textos que no aportan a la
misión (nota hecha sin dejar de mirar al paciente; agenda y consulta primero).
Para cada candidato se registra la evidencia de que sobra: ¿lo enlaza alguien
desde la navegación? ¿Tiene pruebas? ¿Duplica algo que ya existe en otro
sitio? ¿Es de Hospital/UCI y aparece en Practice? ¿Es un ajuste que nadie va a
cambiar nunca? **La auditoría no borra nada.** Produce la lista con su
evidencia y una recomendación (retirar · esconder · fusionar · dejar), y el
dueño decide. Retirar Hospital/UCI no está en la mesa: están en pausa por
decisión D-030, no en revisión.

### 4.1 Ingeniería (3)

**A. Ingeniero de software** — mapea al agente `chief-architect` + `qa-evaluation-scientist`.
- Mira: los invariantes de arquitectura (un paciente, una identidad, un
  expediente; una fuente de verdad por entidad clínica), dirección de
  dependencias, duplicación de motores, tipos `any`, `catch` vacíos, promesas
  sin `await`, condiciones de carrera, idempotencia de escrituras, zona
  horaria y fechas, `npm run build` y el trinquete de lint.
- Pregunta siempre: ¿esto está **escrito y sin conectar**? Busca el símbolo en
  `app/`, `hooks/`, `components/` antes de dar algo por entregado.
- Revisa las pruebas: ¿hay tautologías? ¿Hay un guardián que nunca se probó al
  revés? ¿El golden explica qué NO cubre?
- No hace: juicios clínicos.

**B. Ingeniero de IA** — mapea a `clinical-conversation-ai`.
- Mira: el orden del pipeline de voz (sesgo → reconocedor → corrector →
  guardián → cifras → siglas → guardián → compuerta), que los dos motores
  reciban lo mismo por los dos caminos, el presupuesto del prompt (224 tokens
  Whisper / 1 000 y 200 términos por modelo), qué modelo se pide por nombre y
  cuál responde de verdad (REG-167), procedencia frase→segundo del dictado
  (REG-213, REG-250), que el LLM **no calcule** (ninguna escala, ajuste renal
  ni conversión sale de un prompt), la IA del paciente (orden de fuentes 1-9,
  cinco clases de respuesta, DRAFT hasta liberar, urgencia primero).
- Revisa cada prompt del sistema como código: ¿qué pasa si el dictado trae una
  instrucción? ¿Si trae el nombre de otro paciente? ¿Si viene vacío?
- Corre `evals/patient-ai/` y reporta el resultado tal cual.
- No hace: proponer cambiar de modelo por velocidad.

**C. Programador** — agente `general-purpose` con lectura de código.
- Mira lo pequeño que nadie mira: acentos y ortografía en la interfaz, texto
  truncado, plurales y género, formato de números (¿«1,200» se lee como 1.2?
  REG-031), unidades pegadas a la cifra, botones que no son `<button>`,
  campos sin etiqueta, foco invisible, contraste, objetivo táctil menor de
  44×44, modales que no cierran con Escape, estados de carga y vacío, errores
  de consola y de red, `TODO`/`FIXME` olvidados, código muerto, textos
  hardcodeados fuera de i18n, service worker desactualizado.
- **Lanza el producto** (`npm run dev` con datos sintéticos) y recorre cada
  pantalla del inventario en escritorio y en móvil, con teclado. Un `git diff`
  que se ve bien no es una pantalla que funciona.
- No hace: opinar sobre diseño más allá de lo que se mide.

### 4.2 Médicos (5)

Cada médico audita **con la lente de su especialidad**, sobre las mismas
pantallas: consulta, nota, receta, orden, expediente, referencia, herramientas
por tronco (`src/lib/herramientas-por-especialidad.ts`), copiloto, calculadoras,
antibiograma, portal del paciente. Todos aplican las siete reglas de
`clinical-safety.md`. Ninguno dicta política clínica.

**D. Internista** (la especialidad del dueño; es el que más consultas reales
representa).
- Adulto complejo: polifarmacia, interacciones, ajuste renal y hepático
  (`funcion-renal.ts`, creatinina en µmol/L vs mg/dL, REG-026), crónicos y su
  temporalidad, negaciones («niega», «sin», «no presenta»), alergias y reacción
  cruzada, escalas (FIB-4, CKD-EPI, NEWS2) como motor determinista y no como
  texto del modelo.
- Pregunta: ¿la nota que sale de un dictado de 12 minutos es la nota que yo
  firmaría? ¿Dónde tendría que corregir, y esa corrección se ve y se deshace?

**E. Cirujano general**
- Nota preoperatoria y postoperatoria (NOM-004), consentimiento informado,
  herramienta `cirugia`, riesgo quirúrgico, profilaxis, indicaciones de alta,
  seguimiento de herida, interconsulta, referencia.
- Pregunta: ¿el sistema me deja documentar una cirugía sin que falte lo que la
  norma exige? ¿Qué pasa con la nota si el paciente se hospitaliza (módulo en
  pausa) y vuelve a consulta?

**F. Ginecólogo y obstetra**
- Embarazo y lactancia como estado que **cambia la seguridad de todo**: ¿el
  motor de dosis y de interacciones sabe que está embarazada? ¿Lo pregunta si no
  consta? (regla 4: ausencia de dato no es dato de ausencia). FUM, FPP,
  semanas de gestación como cálculo determinista; herramienta `gineco`;
  tamizajes; fármacos con contraindicación en el embarazo; consentimiento y
  privacidad reforzada; cómo le llega el plan a la paciente en el portal.
- Pregunta: ¿dónde puede el sistema recetar a una embarazada algo que no
  debería, sin decir nada?

**G. Ortopedista y traumatólogo**
- **Lateralidad** (derecha↔izquierda es par prohibido en el aprendizaje del
  dictado; ¿lo es en toda la cadena hasta la orden y la receta?), imágenes y
  su orden, fracturas y clasificación, AINE y su riesgo renal y gástrico,
  incapacidad e informe, rehabilitación y seguimiento, fotos clínicas
  (`fotos`).
- Pregunta: ¿puede una rodilla izquierda dictada acabar como derecha en la
  orden de radiografía? Demostrarlo o descartarlo con `archivo:línea`.

**H. Pediatra**
- Dosis por peso (kg vs lb, REG-013; redondeo hacia abajo, REG-042), edad en
  meses y días, neonato, tope habitual vs absoluto (REG-041), los 20 fármacos
  pediátricos sin techo adulto (REG-043, OPEN), percentiles, vacunas, el
  cuidador como quien lee el portal, dosis en mL con la concentración correcta.
- Pregunta: ¿puede salir una receta pediátrica con una cifra que ningún motor
  acotó? ¿Cómo se ve el aviso, y lo vería un pediatra con prisa?

### 4.3 Pacientes (30 — seis por especialidad)

Los pacientes **no leen código**. Recorren el producto lanzado y cuentan qué
les pasó. Sus hallazgos se traducen después a `archivo:línea` por el
Programador o se refutan. Cada uno califica cada paso con cuatro preguntas:
**¿Entendí? ¿Confié? ¿Pude solo? ¿Me sentí seguro?**

Los seis arquetipos se repiten en cada especialidad, con el caso clínico
sintético de esa especialidad:

| # | Arquetipo | Qué pone a prueba |
|---|---|---|
| 1 | Adulto mayor, 74 años, poca alfabetización digital, letra grande | Legibilidad, contraste, tamaño táctil, lenguaje llano del portal |
| 2 | Joven con celular de gama baja y datos limitados | PWA, peso de la página, funcionar sin conexión, tiempo de carga |
| 3 | Cuidador de un tercero (hijo, padre, pareja) | Autorización explícita y revocable, qué ve y qué no, bitácora |
| 4 | Persona con baja visión que usa lector de pantalla | ARIA, orden de foco, etiquetas, WCAG 2.2 AA |
| 5 | Paciente con síntoma urgente que escribe a la IA a las 2 a.m. | `URGENT_REVIEW_REQUIRED` primero, vía de contacto real, no sepultado |
| 6 | Paciente que reenvía su enlace por WhatsApp a quien no debe | Vigencia del enlace, alcance `{clinicId, patientId}`, qué se filtra |

Recorrido de cada paciente (el bucle de cuidado completo):

```
buscar y agendar → confirmar por WhatsApp → llegar y esperar → consentimiento
de grabación (¿es veraz? REG-032) → consulta → recibir receta / plan liberado
→ leerlo en el portal → preguntar a la IA (las doce preguntas de V9 §0 +
las propias de su especialidad) → pagar → dejar reseña → pedir sus datos (ARCO)
→ seguimiento
```

Por especialidad, cada paciente además prueba lo que sólo a ese paciente le
pasa: la embarazada pregunta si puede tomar X; el cuidador del niño pregunta
cuántos mL; el operado pregunta si la herida se ve normal y sube una foto; el
de la fractura pregunta cuándo puede manejar; el crónico pregunta si puede
saltarse una dosis. **Ninguna de esas respuestas puede originarse en el
nivel 9 (modelo general).** Si lo hace, es P0.

### 4.4 Asistentes (5)

Los asistentes viven en la agenda, el dinero y la mensajería. Son quienes más
tiempo pasan en la app y quienes menos la protagonizan en los documentos.

| # | Asistente | Qué audita |
|---|---|---|
| I | Recepción y agenda | `citas`, `calendario`, `lista-espera`, bloqueos de horario, zona horaria del consultorio (REG-011), homónimos y fusión de pacientes (REG-039), doble reserva, cancelación y reprogramación, Google Calendar |
| J | Cobros y corte de caja | `corte-caja`, `finanzas`, `cobros` sellados por servidor (REG-015), moneda fija (REG-024), exentos con motivo (REG-003), reembolsos, Stripe en modo prueba, CFDI **sin timbrar** |
| K | Mensajería y recordatorios | WhatsApp: plantillas, confirmaciones, qué pasa si falla el envío, si el número está mal, si el paciente responde; nada de PHI en un mensaje que va a un teléfono equivocado |
| L | Expedientes, migración y respaldo | `expedientes`, `migracion` (CSV, REG-160), `pacientes`, importación y duplicados, `respaldo.ts` cubre las 68 colecciones, derechos ARCO entregables con acuse |
| M | Enfermería, signos y triage | Captura de signos con unidad, corrección con motivo (C-5), NEWS2 en consultorio, alertas que sí se ven, `pendientes` y tareas que no se pierden |

Cada asistente además responde: **¿cuántos clics** me cuesta la tarea que hago
40 veces al día, y **cuál** de esas 40 veces me va a salir mal?

### 4.5 Los que no auditan: verifican y clasifican

- **Equipo rojo** (`red-team`): recibe **cada** hallazgo y trata de refutarlo.
  Busca la línea que ya lo impide, el caso donde la premisa es falsa, o el
  motivo por el que no llega a producción. Veredicto `confirmado | refutado`
  con evidencia. Ante la duda, refuta. Además ataca por su cuenta: paciente
  equivocado, inyección en el dictado, unidad cambiada, evidencia alucinada,
  fuga entre consultorios, cobro duplicado, tarea perdida.
- **Oficial de seguridad del paciente** (`patient-safety-officer`): clasifica
  cada hallazgo confirmado con severidad 1-5, probabilidad, control existente,
  riesgo residual y si es liberable. Produce las filas nuevas de
  `RISK_REGISTER.md`. Nunca acepta un residual crítico: eso es del dueño.
- **Ciberseguridad** (`cybersecurity-lead`): pasa sobre las 100 rutas y las 68
  colecciones con una sola pregunta por ruta: ¿sesión, pertenencia al
  consultorio, lista blanca de campos? Y sobre las reglas: ¿forma congelada
  con `hasOnly`?
- **Diseño** (`design-systems-lead`): mide contra
  `docs/design/GENERIC_AI_AESTHETIC_AUDIT.md` y `ACCESSIBILITY.md`. No opina;
  cuenta.
- **Negocio** (`business-acquisition-lead`): prueba de 14 días, entitlements,
  lo que el cliente podría extender desde el navegador (REG-002), y compara
  contra lo que hoy ofrece el mercado, con nombre y fecha de lo que afirme.

---

## 5. Método — siete fases, estado guardado tras cada una

El estado vive en `agent-state/AUDITORIA_PANEL_STATE.json` y se escribe al
cerrar cada fase y cada oleada de agentes. Si la sesión se corta, se reanuda
desde ahí sin repetir lo hecho.

### Fase 0 — Línea base (orquestador, sólo lectura)
1. `git status`, `git log -10`, confirmar rama.
2. `npx vitest run`, `node scripts/lint-trinquete.mjs`, `npm run build`,
   `npm run mantenimiento`. Se anotan los resultados **tal cual**: una suite
   roja antes de empezar es el primer hallazgo.
3. Generar `00-INVENTARIO.md` con el script de conteo. Leer completos
   `CLAUDE.md`, las nueve reglas, el `regression-ledger.md`, `RISK_REGISTER.md`,
   `OWNER_DECISIONS_REQUIRED.md`, `docs/audit/ESTADO-2026-07-31.md` y el último
   informe de `docs/audit/carril-excelencia/`.
4. Levantar el producto con datos sintéticos (`synthetic-data/`, `fixtures/`)
   para las fases de recorrido. Si no levanta, se documenta y los pacientes
   auditan sobre el código de la pantalla, marcando `recorrido: no`.

### Fase 1 — Auditoría en paralelo (oleadas de 8 agentes)
- Oleada 1: Ingeniería (A, B, C) + Ciberseguridad + Diseño + Negocio +
  Internista + Pediatra.
- Oleada 2: Cirujano + Ginecólogo + Ortopedista + los 5 asistentes.
- Oleadas 3-7: los 30 pacientes, **un agente por especialidad** que interpreta
  a sus seis arquetipos en secuencia y devuelve seis recorridos.
- Cada agente devuelve un JSON de hallazgos (§6). El orquestador **no lo
  resume**: lo guarda entero en `01-HALLAZGOS-CRUDOS.json`.

### Fase 2 — Refutación adversarial
- El equipo rojo recibe los hallazgos en lotes de 20. Cada uno sale
  `confirmado` o `refutado` con `archivo:línea`.
- Los hallazgos de pacientes y asistentes pasan antes por el Programador, que
  los ancla a código o los marca `no-anclable` (van a Mejoras, no a Defectos).
- Ratio de refutación por auditor se publica en `05-COBERTURA.md`. Un auditor
  con más del 50 % refutado se vuelve a correr con instrucción de rigor.

### Fase 3 — Reproducción de P0 y P1
- Para cada P0/P1 confirmado, el Programador escribe una **prueba que falla**
  hoy, en `docs/audit/panel-de-lujo-2026-09/reproducciones/REP-NNN.test.ts`, y
  la corre con `npx vitest run <ruta>`. Se guarda la salida. Una prueba que
  pasa sin arreglo degrada el hallazgo a P2 y lo dice.
- Estas pruebas **no entran a `src/__tests__/`** hasta que exista el arreglo;
  ahí se sellan en `invariantes-clinicos.json` y ganan su REG.

### Fase 4 — Clasificación de riesgo
- El oficial de seguridad del paciente clasifica cada confirmado. Los P0 se
  cruzan con `RISK_REGISTER.md`: ¿es un riesgo nuevo, o uno que decíamos
  «Controlado» y no lo estaba?

### Fase 5 — Crítico de completitud
- Un agente independiente recibe **sólo** el inventario y la lista de
  hallazgos, y responde una pregunta: ¿qué pieza del inventario no tiene ni un
  hallazgo ni una nota de «revisado, sin hallazgo, por quién»? Lo que salga
  se audita en una oleada de cierre o se declara no cubierto.

### Fase 6 — Mejoras (lo que ya existe, llevado a lo mejor del mundo)
- Por cada área (voz, nota, receta, agenda, cobro, portal, seguridad, PWA), un
  cuadro de tres columnas: **lo que hay hoy** (con ruta) · **cómo lo hace lo
  mejor que existe** (con nombre del producto o estándar y fecha; si no se
  puede afirmar con fuente, se dice «criterio del panel») · **la brecha y la
  propuesta**, con esfuerzo estimado y qué decisión del dueño requiere.
- Ninguna mejora propone duplicar una fuente de verdad ni crear una V2 de algo
  que ya existe.

### Fase 7 — Consolidación y entrega
- Escribir los entregables de la §7, guardar el estado, `git add` **sólo**
  `docs/audit/panel-de-lujo-2026-09/` y `agent-state/AUDITORIA_PANEL_STATE.json`,
  commit y `git push -u origin claude/medical-app-audit-team-8c37y7`.
- **No se abre PR** salvo que el dueño lo pida.
- El mensaje final al dueño cabe en una pantalla: los P0, los tres números
  (confirmados / refutados / no cubiertos), y qué decisiones esperan su firma.

---

## 6. Formato de hallazgo (obligatorio, JSON)

```json
{
  "id": "PL-0001",
  "panel": "medico|paciente|asistente|ingenieria|seguridad|diseno|negocio",
  "rol": "pediatra",
  "modulo": "practice|hospital|uci|portal|publico|nucleo",
  "tipo": "defecto|boton_muerto|friccion|innecesario|mejora",
  "titulo": "Una frase, con el efecto en el paciente o el usuario, no el síntoma técnico",
  "archivo": "src/lib/dosing/pediatria.ts",
  "linea": 142,
  "evidencia": "Cita literal del código o del comportamiento observado",
  "reproduccion": "Pasos o entrada sintética que lo provoca; o 'recorrido' si es de paciente",
  "impacto": { "paciente": "…", "medico": "…", "negocio": "…" },
  "severidad": 5,
  "probabilidad": "alta|media|baja",
  "control_existente": "Qué lo mitiga hoy, o 'ninguno'",
  "prioridad": "P0|P1|P2|P3",
  "veredicto_rojo": "pendiente|confirmado|refutado",
  "refutacion": "Si refutado: archivo:línea que lo impide",
  "propuesta": "Qué cambiar, sin cambiarlo",
  "prueba_que_faltaria": "Qué prueba fallaría hoy y pasaría con el arreglo",
  "que_no_cubre": "Qué caso vecino este hallazgo NO resuelve",
  "decision_del_dueno": null,
  "relacionado": ["REG-043", "R-08", "C-3"]
}
```

Prioridades:
- **P0** — daño posible al paciente, fuga de PHI o de datos entre consultorios,
  dinero mal cobrado, firma o receta forjable, IA del paciente que origina un
  dato clínico.
- **P1** — error clínico o legal con control parcial; dato que no llega; nota
  que se firma con información incompleta; accesibilidad que impide la tarea.
- **P2** — fricción medible: clics de más, aviso que no se ve, texto confuso,
  rendimiento, prueba tautológica.
- **P3** — mejora: lo que haría mejor un producto de clase mundial.

---

## 7. Entregables (todo en `docs/audit/panel-de-lujo-2026-09/`)

| Archivo | Contenido | Para quién |
|---|---|---|
| `00-INVENTARIO.md` | Todo lo que existe y quién lo revisó | Cobertura |
| `01-HALLAZGOS-CRUDOS.json` | Salida íntegra de los 43 auditores, sin editar | Trazabilidad |
| `02-HALLAZGOS-VERIFICADOS.json` | Sólo los confirmados, con veredicto y riesgo | Backlog |
| `03-INFORME-EJECUTIVO.md` | Una página para el Dr.: P0, números, decisiones | El dueño |
| `04-DECISIONES-DEL-DUENO.md` | Cola con recomendación y «qué sigue sin ella»; se **añade** a `agent-state/OWNER_DECISIONS_REQUIRED.md`, no lo sustituye | El dueño |
| `05-COBERTURA.md` | Qué se revisó, qué no, ratio de refutación por auditor, tiempo por fase | Honestidad |
| `06-VOCES-DE-PACIENTES.md` | Los 30 recorridos con sus cuatro calificaciones y sus citas | Producto |
| `07-VOCES-DE-ASISTENTES.md` | Los 5 recorridos, clics por tarea y «la vez que sale mal» | Producto |
| `08-MEJORAS-CLASE-MUNDIAL.md` | Cuadros de tres columnas por área | Roadmap |
| `09-RIESGOS-NUEVOS.md` | Filas listas para `RISK_REGISTER.md` | Seguridad |
| `10-CANDIDATOS-A-REG.md` | Hallazgos que, reparados, ganarán REG-556 en adelante; **no se numeran** hasta repararse | Ledger |
| `11-BOTONES-MUERTOS.md` | Todo control que no hace lo que dice, por pantalla, con `archivo:línea` | Producto |
| `12-FACILIDAD-DE-USO.md` | Por pantalla: propósito en una frase, clics de la tarea frecuente, texto que habla como sistema, propuesta | Producto |
| `13-QUITAR-LO-INNECESARIO.md` | Candidatos a retirar, esconder o fusionar, con evidencia y recomendación; **decide el dueño** | El dueño |
| `reproducciones/` | Pruebas que fallan hoy, con su salida | Ingeniería |

---

## 8. Condiciones de terminado de la auditoría

La auditoría está terminada cuando:

- [ ] cada fila del inventario tiene auditor asignado y veredicto o declaración
      de no cubierta;
- [ ] cada hallazgo confirmado tiene `archivo:línea` y veredicto del equipo rojo;
- [ ] cada P0/P1 tiene una reproducción que falla hoy, o una nota de por qué no
      se pudo reproducir;
- [ ] los 30 recorridos de pacientes y los 5 de asistentes están escritos;
- [ ] las 45 pantallas de trabajo, el portal y las pantallas públicas tienen su
      fila en `11`, `12` y `13` (aunque la fila diga «sin hallazgo»);
- [ ] las doce preguntas de `evals/patient-ai/` se corrieron y su resultado está
      en el informe;
- [ ] la línea base (vitest, lint, build, mantenimiento) está anotada tal cual;
- [ ] no se modificó nada fuera de `docs/audit/panel-de-lujo-2026-09/` y
      `agent-state/AUDITORIA_PANEL_STATE.json` (se comprueba con `git status`);
- [ ] el estado está guardado, el commit hecho y la rama empujada;
- [ ] el mensaje al dueño cabe en una pantalla.

---

## 9. Lo que esta auditoría NO hace, dicho para que nadie lo espere

- No repara. Reparar es otro programa, con sus pruebas, su ledger y su sello.
- No fija criterio clínico. Señala, cita y pregunta.
- No mide sobre habla de consulta real (D-029): lo que se diga del dictado se
  dice sobre corpus sintético o actuado.
- No sustituye un pentest externo (O-3) ni un simulacro de restauración con
  `gcloud` (O-2).
- No abre PR ni despliega.

---

## 10. Presupuesto y ritmo

- 7 oleadas de hasta 8 agentes en paralelo, más equipo rojo por lotes, más el
  crítico de completitud: alrededor de **50 ejecuciones de agente**. Es el
  panel más grande que se ha corrido en este repositorio; se declara para que
  el costo no sorprenda.
- Estado guardado tras cada oleada. Quedarse sin créditos no pierde avance.
- Tiempo estimado de pared: una sesión larga; se reanuda las veces que haga
  falta con el mismo prompt.

---

## 11. Aprobación

Aprobado por el dueño el 6-sep-2026 con la instrucción: «Agrégale funciones,
botones que no sirvan, que sea amigable y fácil de usar, quita lo que no sea
necesario y posterior ejecuta». Las tres adiciones quedaron en la §4.0, en el
campo `tipo` del hallazgo y en los entregables 11, 12 y 13. Esta es la versión
que arranca la Fase 0.
