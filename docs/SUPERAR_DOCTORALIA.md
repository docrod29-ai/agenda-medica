# NexusMED vs Doctoralia — Estrategia para superarla + Prompt maestro de rediseño

> Documento de estrategia. NO modifica código. Versión 2026.06.14 · Dr. David Rodríguez + Claude.

---

## 0. La verdad honesta primero (léela antes que nada)

"Superar a Doctoralia en TODOS los aspectos" suena bien, pero hay que separar dos cosas
que la gente confunde, porque definen qué SÍ podemos ganar y qué no:

| | **Doctoralia** | **NexusMED** |
|---|---|---|
| Qué ES en el fondo | Un **marketplace** (directorio público de médicos) + practice management como gancho | Un **EHR clínico-operativo** con IA, hecho para el médico, no para captar pacientes |
| De dónde saca su valor | **Efecto de red**: millones de pacientes buscando médico → te encuentran a ti | **Profundidad clínica**: dictado por voz, PROA, ajuste renal, cumplimiento MX |
| Su foso (lo difícil de copiar) | El **tráfico** y el SEO (10+ años de dominio) | La **inteligencia clínica** y el flujo de consulta |

**Conclusión sin rodeos:** no vas a vencer a Doctoralia en *captación de pacientes por marketplace*
— ese es su monopolio de red y replicarlo cuesta años y millones. **Pero SÍ puedes ser
radicalmente superior como HERRAMIENTA del médico**: el producto que usa todos los días para
consultar, recetar, documentar y cobrar. Ahí Doctoralia es mediocre (su EHR es flojo, lento y
genérico) y NexusMED ya tiene piezas que ellos NO tienen.

**La estrategia ganadora no es "ser Doctoralia pero mejor". Es ser la mejor HERRAMIENTA CLÍNICA
del mundo hispano** y, encima, tener tu propio canal de captación (portal + QR + WhatsApp) para
no depender de su marketplace. Si quieres marketplace algún día, se construye aparte; no es el
camino para "superarla" hoy.

---

## 1. Comparativa por dimensión (honesta)

### A) Captación de pacientes
| Aspecto | Doctoralia | NexusMED hoy | Veredicto |
|---|---|---|---|
| Directorio público / SEO | ✅✅✅ dominante | ❌ no aplica | Doctoralia gana (foso de red) |
| Portal propio de auto-agenda | ✅ (dentro de su web) | ✅ link + QR propio | Empate — el nuestro es TUYO, sin comisión |
| Reseñas | ✅ públicas, con peso SEO | ✅ propias, moderables | Ellos por alcance; nosotros por control |
| WhatsApp bot 24/7 | parcial / de pago | ✅ incluido | NexusMED gana |

### B) Práctica clínica (aquí se gana la guerra)
| Aspecto | Doctoralia | NexusMED hoy | Veredicto |
|---|---|---|---|
| Nota clínica por voz + IA | ❌ casi nulo | ✅✅ scribe HIFI + corrector + NER | **NexusMED gana fuerte** |
| Recetas (calidad + Word + multi-hoja) | básico | ✅✅ plantilla + Word + COFEPRIS | **NexusMED gana** |
| Seguridad farmacológica (alergia/interacción/renal) | ❌ | ✅✅ en consulta y receta | **NexusMED gana fuerte** |
| PROA / stewardship | ❌ | ✅ panel de reevaluación | **NexusMED único** |
| Cumplimiento MX (NOM-004/024, COFEPRIS, FHIR) | parcial | ✅✅ integrado | **NexusMED gana** |
| Escalas clínicas (RCRI, ARISCAT, qSOFA…) | ❌ | ✅ | **NexusMED gana** |

### C) Operación / agenda
| Aspecto | Doctoralia | NexusMED hoy | Veredicto |
|---|---|---|---|
| Agenda multi-médico | ✅ | ✅ (recién corregido) | Empate |
| Recordatorios automáticos | ✅ (de pago) | ✅ incluido | NexusMED gana en costo |
| Lista de espera inteligente | parcial | ✅ con matching | NexusMED gana |
| Google Calendar sync | ✅ | ✅ | Empate |
| Cobros / finanzas | básico | ✅ módulo propio | NexusMED gana |

### D) Arquitectura / técnica
| Aspecto | Doctoralia | NexusMED hoy |
|---|---|---|
| Stack | monolito maduro, lento, legacy | Next.js 16 + React 19 + Firestore (moderno, rápido) |
| IA nativa | bolt-on | núcleo del producto |
| Multi-tenant | sí | sí (con auth reforzada esta semana) |
| Offline / PWA | limitado | ✅ PWA + recovery |

**Resumen:** NexusMED ya es SUPERIOR como herramienta clínica. Lo que falta para que se
*sienta* y se *vea* de clase mundial es **identidad de producto y pulido de experiencia** —
no más features sueltas.

---

## 2. Por qué "parece hecho con Claude / todo se parece" (diagnóstico de diseño)

Tienes razón y es un problema real de percepción. Las señales de que un producto se ve
"genérico/IA" son concretas y se pueden eliminar:

1. **Emojis en encabezados de sección** (🩺 ⚠️ 🔒 📄). Ningún producto premium los usa en
   títulos. Se ven caseros. → Reemplazar por iconografía propia (set consistente, lineal).
2. **Todo en tarjetas grises iguales**, mismo radio, mismo padding, mismo borde. Falta
   jerarquía: lo importante debe pesar más, lo secundario menos.
3. **Estilos inline por todos lados** → inconsistencias sutiles de spacing/color que el ojo
   percibe como "amateur". Falta un sistema de tokens estricto.
4. **Tipografía de sistema sin personalidad.** Geist está bien pero no es identidad. Un
   producto memorable tiene una pareja tipográfica propia y una escala deliberada.
5. **Cero momentos de diseño**: no hay micro-ilustración, no hay un vacío bien resuelto, no hay
   una pantalla que "enamore". Todo es funcional-plano.
6. **Layouts predecibles** (sidebar + grid de cards) idénticos a mil dashboards. Falta una firma
   visual: una densidad, un ritmo, un color de acento usado con intención.
7. **Sin movimiento con significado.** Las transiciones existen pero son genéricas.

**La cura no es "más bonito"** — es **identidad sistemática**: un design system real
(tokens + componentes + voz + motion) aplicado con disciplina. Eso es lo que hace que Linear,
Stripe, Arc o Superhuman se vean inconfundibles aunque usen los mismos ladrillos.

---

## 3. EL PROMPT MAESTRO (esto es lo que pediste ver)

> Este es el prompt para ejecutar el rediseño + superación. Está pensado para dárselo a un
> equipo (humano o IA) y obtener un resultado de clase mundial sin romper lo existente.

```
ROL
Actúa como un equipo de producto de élite: (1) Director de Diseño de producto formado en
Linear/Stripe/Arc, (2) Ingeniero frontend senior (Next.js/React/TS), (3) Médico infectólogo
asesor clínico, (4) Arquitecto de sistemas. Tu trabajo es elevar NexusMED para que supere a
Doctoralia COMO HERRAMIENTA CLÍNICA y se vea/sienta como un producto de Silicon Valley —
inconfundible, no genérico, no "hecho con IA".

CONTEXTO
NexusMED es un EHR + agenda con IA para México/LATAM. Stack: Next.js 16, React 19, TS,
Tailwind v4, Firestore multi-tenant, PWA. Ya tiene: dictado por voz con corrector médico,
NER, recetas premium (plantilla/Word/COFEPRIS), seguridad farmacológica (alergia/interacción/
renal), PROA, escalas clínicas, cumplimiento NOM-004/024 + FHIR, portal de auto-agenda,
WhatsApp bot, cobros. 202 tests verdes. NO romper nada de esto.

OBJETIVO
1. Crear un DESIGN SYSTEM propio y memorable (identidad de marca real), no una plantilla.
2. Reescribir la capa visual aplicando ese sistema con disciplina (tokens, no inline).
3. Superar a Doctoralia en profundidad clínica y experiencia operativa.

PRINCIPIOS DE DISEÑO (NO NEGOCIABLES)
- IDENTIDAD ANTES QUE ADORNO. Define una voz visual única: una pareja tipográfica deliberada
  (display editorial + grotesque para UI), una escala tipográfica modular, un color de acento
  usado con intención (no decorativo), densidad y ritmo propios.
- CERO EMOJIS en encabezados/UI. Set de iconos lineal consistente (un solo grosor, una sola
  familia). Los emojis solo pueden existir en mensajes a pacientes.
- JERARQUÍA REAL. Tres niveles claros: lo crítico domina, lo secundario se atenúa, lo terciario
  casi desaparece. Tamaño, peso y color encodean importancia — no todo pesa igual.
- TOKENS, NO INLINE. Todo color/espaciado/radio/sombra/tipo sale de variables CSS. Prohibido
  hex sueltos y px mágicos en JSX. Un solo origen de verdad.
- MOTION CON SIGNIFICADO. Curva única (cubic-bezier 0.16,1,0.3,1). El movimiento comunica
  estado/causalidad, no decora. Respeta prefers-reduced-motion.
- DENSIDAD CLÍNICA. El médico ve mucha info; optimiza para lectura rápida y escaneo, no para
  "aire bonito". Tablas y listas densas pero legibles, números tabulares.
- MOMENTOS DE DISEÑO. Al menos: un empty-state que enamore, un dashboard con jerarquía real,
  una pantalla de consulta que se sienta "viva", una receta que parezca de imprenta.
- ACCESIBILIDAD AA. Contraste, foco visible, navegación por teclado, lectores de pantalla.

ANTI-PATRONES (señales de "hecho con IA" — ELIMINAR)
- Emojis en títulos · tarjetas grises idénticas en grid · estilos inline dispersos ·
  tipografía de sistema sin pareja · gradientes/sombras decorativas · layouts genéricos
  sidebar+grid sin firma · textos "Lorem"/placeholder · spacing inconsistente · 6+ colores
  sin sistema · botones que no comunican jerarquía (primario/secundario/fantasma confusos).

SUPERIORIDAD CLÍNICA vs DOCTORALIA (construir/pulir)
- Consulta como "cabina de mando": voz + IA + alertas (alergia/interacción/renal/PROA) +
  escalas, todo en una pantalla fluida.
- Recetas y órdenes de calidad de imprenta (ya avanzado) + plantilla por médico.
- Línea de tiempo del paciente: una historia clínica visual escaneable (no lista plana).
- Tablero del médico con señales accionables (no vanity metrics).
- Captación propia: portal + QR + WhatsApp pulidos, sin comisión de marketplace.

RESTRICCIONES DURAS
- NO romper funcionalidad existente (202 tests deben seguir verdes).
- NO cambiar contratos de datos sin migración.
- Mantener cumplimiento NOM-004/024, COFEPRIS, LFPDPPP, FHIR.
- Cada cambio: tsc + tests + build limpios antes de desplegar.
- Cambios incrementales y reversibles, una pieza por commit.

ENTREGABLES (en orden)
1. Brand & design system: tokens (color/tipo/espacio/radio/sombra/motion), pareja tipográfica,
   set de iconos, voz visual — documentado en docs/DESIGN_SYSTEM.md + globals.css.
2. Componentes base reescritos con tokens: Botón, Card, Input, Tabla, Badge, Tabs, Modal,
   EmptyState, encabezado de página — en src/components/ui/.
3. Migración pantalla por pantalla aplicando el sistema (dashboard → consulta → expediente →
   pacientes → agenda → receta), sin romper lógica.
4. Momentos de diseño: empty-states, dashboard, timeline del paciente.

CÓMO TRABAJAR
- Primero el sistema (tokens + 8 componentes base), DESPUÉS migrar pantallas que los consumen.
- Nada de "rediseñar todo de un jalón". Incremental, verificable, reversible.
- Justifica cada decisión de diseño en términos de jerarquía/legibilidad/identidad, no de gusto.
```

---

## 4. Recomendaciones priorizadas (mi consejo de ingeniero)

**Fase 1 — Identidad (lo que más cambia la percepción, 1 entregable):**
- Definir el **design system** real: tokens estrictos + pareja tipográfica + set de iconos
  (reemplazar TODOS los emojis de UI) + escala tipográfica. Documentarlo.
- Esto solo ya hace que "no parezca hecho con IA".

**Fase 2 — Componentes base (`src/components/ui/`):**
- Botón, Card, Input, Tabla, Badge, Tabs, Modal, EmptyState, PageHeader.
- Reemplazar los estilos inline dispersos por estos componentes → consistencia instantánea.

**Fase 3 — Migrar pantallas (una por commit):**
- Orden sugerido por impacto: Dashboard → Consulta → Expediente (timeline) → Pacientes → Agenda.

**Fase 4 — Momentos de diseño:**
- Empty-states con personalidad, dashboard con jerarquía real, **timeline visual del paciente**
  (el mayor diferenciador vs la lista plana actual y vs Doctoralia).

**Qué NO hacer:**
- NO intentar el marketplace (foso de Doctoralia, no es el camino).
- NO rediseñar todo de golpe (rompes cosas, pierdes los 202 tests verdes).
- NO agregar más features antes de pulir las que ya hay (la app ya gana en features; pierde en
  pulido).

---

## 5. Decisión que necesito de ti

Antes de tocar una línea, dime:
1. ¿Apruebas la estrategia "ser la mejor herramienta clínica" (no perseguir el marketplace)?
2. ¿Empezamos por la **Fase 1 (design system + matar los emojis de UI + tokens)** que es lo que
   más cambia la percepción de "hecho con IA"?
3. ¿Tienes preferencia de personalidad visual? (ej: clínico-sobrio tipo Stripe · editorial-cálido ·
   técnico-preciso tipo Linear). Eso define la pareja tipográfica y el acento.
```
```
```
