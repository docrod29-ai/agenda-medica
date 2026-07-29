# TODAS las preguntas para terminar el programa completo

**Para:** Dr. David Alonso Rodríguez Luna
**Fecha:** 28 de julio de 2026
**Cubre:** las 63 unidades restantes de Nexus OS (E0 → E9)

---

## Cómo contestar RÁPIDO

Cada pregunta trae una **⭐ opción por defecto** ya propuesta. Si te parece bien,
no escribas nada: basta con decir **«default en todo, excepto la 7 y la 19»** y
contestar solo esas.

Las marcadas **🔴 BLOQUEA** detienen una etapa completa si no se contestan.
Las **📦 DATOS** necesitan que aportes una tabla o lista — esas son las que más
tardan, y por eso van señaladas para que las agendes aparte.

---

# BLOQUE A — Terminar E0 (lo que estamos haciendo ahora)

### A1 · Unidades clínicas que el sistema debe entender 📦
Para `ClinicalQuantity` (impide sumar mg con mL o comparar mg/dL con µmol/L).

⭐ **Default:** mg · g · mcg · mL · UI · mg/kg · mg/kg/día · kg · lb · cm · °C ·
mmHg · lpm · rpm · % · mg/dL · mmol/L · µmol/L · g/L · g/dL · mEq/L · ng/mL ·
mL/min/1.73m² · mcg/kg/min.

**¿Falta alguna que uses a diario?**

### A2 · Qué puede ver cada rol 🔴 BLOQUEA E0-06 y E0-07
Hoy «miembro» es casi todo o nada. Necesito tu matriz real.

⭐ **Default propuesto:**

| Rol | Agenda | Datos de contacto | Nota clínica | Recetas | Cobros | Config |
|---|---|---|---|---|---|---|
| Recepción | ver+editar | ver+editar | **NO** | **NO** | crear | no |
| Enfermería | ver | ver | ver + signos | ver | no | no |
| Farmacia | no | no | solo medicación | ver | no | no |
| Laboratorio | no | no | solo estudios | no | no | no |
| Médico | todo | todo | todo | todo | todo | sí |
| Admin | todo | todo | **?** | ver | todo | sí |

**Las dos que de verdad necesito que decidas:** ¿el Admin (no médico) puede leer
notas clínicas? ¿Enfermería puede ver la nota completa o solo signos y órdenes?

### A3 · Eventos que nunca se pueden borrar 🔴 BLOQUEA E0-09

⭐ **Default:** administración de medicamento (MAR) · signos vitales · órdenes
médicas · resultados críticos · ingreso/egreso · transfusión · procedimientos ·
eventos de UCI. Corrección solo por adenda, nunca edición.

**¿Agregas o quitas alguno?**

### A4 · El sello de integridad completo 🔴 BLOQUEA E0-12 · **decisión con costo visible**
Hoy el sello no cubre `preop`, `hospital` ni `infectología`. Taparlo obliga a
subir la versión del hash, y eso pasa **todas tus notas firmadas históricas** de
«verificada» a **«legado»**. No significa alteradas — significa «selladas con el
algoritmo viejo, no re-verificables». Es visible en un registro medicolegal.

- **(a)** ⭐ Sí, hazlo. Prefiero cobertura completa desde hoy y asumo el cambio de etiqueta
- **(b)** Solo para notas NUEVAS; las históricas conservan su etiqueta actual
- **(c)** Espera, quiero verlo antes

### A5 · Webhook de Stripe 🔴 BLOQUEA E0-13
La marca de idempotencia se escribe **antes** de procesar: si algo falla a
mitad, el pago se pierde. Es ruta de dinero y no puedo probarla de punta a punta
sin Stripe.

- **(a)** ⭐ Arréglalo, y me avisas para que yo haga un cobro de prueba real
- **(b)** Déjalo, lo vemos con tu contador
- **(c)** Arréglalo pero en modo prueba de Stripe primero

### A6 · CSP en modo bloqueo (E0-10)
Hoy está en «solo observar». Pasarlo a bloqueo puede romper algo que no vimos.

- **(a)** ⭐ Revisa los reportes primero, y si están limpios lo activas
- **(b)** Actívalo ya, si algo se rompe lo arreglamos

---

# BLOQUE B — E1 · Patient Clinical Graph (el cimiento)

### B1 · Tus sinónimos reales 📦 🔴 BLOQUEA E1-02
Lo que TÚ y tus asistentes dictan de verdad. Ejemplo de lo que necesito:

```
creatinina → Cr · creat · creatinina sérica · SCr
hemoglobina → Hb · hemoglobina · hb
tensión arterial → TA · presión · PA
...
```

⭐ **Default para no frenar:** arranco con ~50 analitos y abreviaturas estándar
(las de `ABREVIATURAS` que ya tiene la app) y tú corriges lo que salga mal en uso
real. **Recomiendo esto** — sale mejor de la práctica que de una lista escrita en frío.

### B2 · Basales que faltan por definir
Ya definiste creatinina, hemoglobina y peso seco. Faltan:

⭐ **Default:** HbA1c → último valor (no mediana; el control cambia) · TA → mediana
de las últimas 3 tomas ambulatorias · peso → último estable · LDL → último
pre-tratamiento · plaquetas → mediana 12 meses · TFG → derivada de la creatinina basal.

**¿Alguno lo definirías distinto?**

### B3 · Cuándo un problema deja de estar activo
- **(a)** ⭐ Cuando tú lo marcas resuelto, explícitamente
- **(b)** Automático si no se menciona en N consultas (dime N)
- **(c)** Automático solo para agudos; los crónicos nunca se cierran solos

### B4 · Hasta dónde mira hacia atrás el grafo
⭐ **Default:** todo lo que exista en el expediente, sin límite. Los cálculos de
tendencia usan ventanas específicas por analito (B2).

---

# BLOQUE C — E4 · Safety Kernel + Medication Intelligence

### C1 · La tabla de ~30 fármacos 📦 🔴 BLOQUEA E4-04 · **la más grande**
Ya diste la estructura y el catálogo inicial de 22. Para cada uno necesito:
`usualMaxPerDose · usualMaxPerDay · hardMaxPerDose · hardMaxPerDay · route ·
renalAdjustment · weightBased · requiresTDM`.

⭐ **Default para no frenar:** implemento primero los que **ya especificaste** en
tu documento (cefalexina, ceftriaxona, cefotaxima, clindamicina, metronidazol,
ondansetrón, difenhidramina, loratadina, nitrofurantoína) y los demás siguen
diciendo «sin referencia», que es honesto.

**¿Te parece, y me pasas el resto cuando puedas?**

### C2 · ¿El kernel aplica también a órdenes hospitalarias?
- **(a)** ⭐ Sí, consulta + hospital + UCI desde el inicio
- **(b)** Consulta primero, hospital después

### C3 · Qué pasa cuando el kernel BLOQUEA
- **(a)** ⭐ No se puede firmar hasta resolver; el médico puede anular con motivo escrito, y queda auditado
- **(b)** Solo avisa, nunca impide firmar
- **(c)** Bloquea sin posibilidad de anular

---

# BLOQUE D — E2 · Evidence (la etapa con dependencia externa)

### D1 · Qué fuentes tienes YA 📦 🔴 BLOQUEA E2 completo
¿A cuáles tienes acceso o suscripción hoy? UpToDate · Access Medicine ·
suscripciones de revistas · acceso institucional del hospital · **CLSI M100** ·
guías IDSA/ESCMID (públicas).

**Esto define qué se puede construir y qué hay que licenciar.**

### D2 · Presupuesto de licencias
⭐ **Default:** empezar solo con lo gratuito y legal (PubMed, Crossref,
ClinicalTrials, guías públicas, EUCAST) y añadir licenciado cuando lo apruebes.

**¿Hay un techo mensual que deba respetar?**

### D3 · Idioma
- **(a)** ⭐ Evidencia en inglés, conclusión y explicación en español
- **(b)** Todo traducido al español
- **(c)** Todo en inglés

---

# BLOQUE E — E3 · Razonamiento

### E1q · Qué especialistas virtuales primero
⭐ **Default:** infectología · medicina interna · UCI · farmacología/PK-PD ·
nefrología. (Lo tuyo, y donde más valor da.)

### E2q · Cuánto estás dispuesto a esperar
⭐ **Default:** Quick <5 s · Consult <30 s · Grand Rounds hasta 3 min.
**¿Te sirve, o Grand Rounds puede tardar más si vale la pena?**

---

# BLOQUE F — E5/E6 · Memoria y aprendizaje

### F1 · Formulario de tu hospital 📦
¿Tienes el cuadro básico de Star Médica en documento? Sin eso, la memoria
institucional (E5-04) no tiene qué recordar.

### F2 · Quién firma un cambio clínico 🔴 BLOQUEA E6-04
Dijiste dos aprobaciones independientes. **¿Quiénes, con nombre?** Basta con dos
para arrancar (tú + un colega de confianza).

### F3 · Consentimiento para aprendizaje desidentificado
- **(a)** ⭐ Agregar cláusula al aviso de privacidad, con opción de negarse
- **(b)** Consentimiento explícito y separado
- **(c)** No usar datos de pacientes ni desidentificados por ahora

---

# BLOQUE G — E7 · NexusBench

### G1 · Los 15 casos de la Fase 0 📦 🔴 BLOQUEA E7 completo
Cada caso: historia, labs, medicación, **respuesta correcta**, alternativas
aceptables, **respuestas peligrosas**, **must-not-miss**.

⭐ **Default propuesto para acelerar:** yo redacto los 15 casos con datos
ficticios a partir de tus decisiones ya escritas, y tú **solo corriges** —
mucho más rápido que escribirlos de cero.

**⚠️ Ojo con esto:** los redacto yo, pero **la respuesta correcta y las
peligrosas las validas tú**. Un banco de pruebas con gold answers que yo inventé
no mide nada: mediría si me parezco a mí mismo.

### G2 · El panel ciego 📦
⭐ **Default:** empezar con 3 (tú + 2 colegas) y crecer a 5–7. **¿A quiénes
puedes invitar?**

---

# BLOQUE H — E8 · Experiencias

### H1 · Cuál construyo primero
- **(a)** ⭐ Pre-visit Brief — el que «enamora al médico» según tu §19
- **(b)** Nexus Rounds (hospital/UCI)
- **(c)** Ambient durante consulta
- **(d)** PROA / antibiograma institucional

### H2 · Datos de microbiología del hospital 📦
Para el antibiograma institucional (E8-05) necesito los cultivos con
susceptibilidad, unidad y fecha. **¿Tienes acceso a exportarlos?** ¿En qué
formato salen — Excel, WHONET, PDF?

---

# BLOQUE I — E9 · Regulatorio

### I1 · Abogado / consultor regulatorio 🔴 BLOQUEA E9
**¿Ya tienes a alguien, o hay que buscarlo?**

### I2 · Entidad legal
¿Persona física o moral? ¿Ya constituida?

### I3 · Nivel de ambición regulatoria
- **(a)** ⭐ Diseñar con disciplina SaMD, certificar cuando haga falta
- **(b)** Buscar certificación ISO 42001 desde ahora
- **(c)** Solo cumplir NOM-241 para México

---

# BLOQUE J — Producto y negocio

### J1 · Quién es el siguiente cliente después de ti
⭐ **Default:** 2–3 colegas de confianza en Chihuahua, gratis, a cambio de que
reporten fallas. **¿Ya tienes a alguien en mente?**

### J2 · Si tuvieras que sacrificar algo, ¿qué?
Ordena de **imprescindible** a **sacrificable**: seguridad clínica · evidencia
citada · velocidad de la app · hospital/UCI · WhatsApp/agenda · cobros/facturación
· que se vea bonito.

**Esta me sirve para priorizar cuando dos unidades compitan.**

### J3 · Ritmo de trabajo
- **(a)** ⭐ Sesiones largas cuando puedas + corridas autónomas de noche
- **(b)** Sesiones cortas frecuentes
- **(c)** Todo autónomo, tú solo revisas y decides

---

# BLOQUE K — Accesos que necesito de ti

Marca lo que ya tienes:

- [ ] Licencia CLSI M100 **(la más urgente — puede meter meses muertos)**
- [ ] Cuenta 360dialog + número de WhatsApp aparte
- [ ] Facturama (CFDI) si quieres timbrar desde la app
- [ ] Acceso a microbiología del hospital
- [ ] Formulario/cuadro básico institucional
- [ ] Abogado regulatorio
- [ ] 2 colegas para el panel

---

# Si solo contestas cinco

1. **A2** — matriz de roles → desbloquea 2 unidades de E0
2. **A4** — el sello y sus notas históricas → tiene costo visible, mejor decidirlo tú
3. **D1** — qué fuentes tienes → define si E2 tarda 4 meses o 8
4. **C1** — que apruebe el default de fármacos → arranca el Safety Kernel
5. **J2** — tu orden de prioridad → me deja decidir solo cuando dos cosas compitan

Con esas cinco puedo trabajar semanas sin volver a detenerme.
