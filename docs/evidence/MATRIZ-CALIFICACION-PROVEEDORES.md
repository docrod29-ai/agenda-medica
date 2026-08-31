# Matriz de calificación de proveedores de evidencia (#314)

> **GENERADO. No editar a mano.**
> Fuente de verdad: `src/lib/evidence-integrations/catalogo.ts`.
> Regenerar: `node scripts/evidence/matriz-proveedores.mjs`.

Última revisión del catálogo: **2026-08-22**.

## Qué significa UNVERIFIABLE

**No se ha verificado desde este repositorio.** No significa «no», y no
significa «probablemente sí». Significa que nadie con acceso al portal del
proveedor lo ha confirmado, y por tanto **no se puede construir nada
encima**. Es el equivalente legal de `NEEDS_CLINICAL_REVIEW`.

Esta tabla se llenó **sin acceso a portales de licenciamiento, sin
credenciales y sin contactar a ningún proveedor**. Por eso casi todo lo
comercial de UpToDate, OpenEvidence y Cochrane está sin verificar: es el
estado real del conocimiento, no una tarea a medias.

**Este documento no es asesoría legal.**

## Resumen

| Proveedor | Rol | Licencia | ¿Se consulta hoy? | Campos sin verificar |
|---|---|---|---|---|
| PubMed / MEDLINE (NCBI E-utilities) | `respaldo` | `OPEN` | **sí** | 2/12 |
| PubMed Central (Open Access) | `respaldo` | `OPEN` | sí — **pero fuera del contrato**: no avisa si falla | 7/12 |
| ClinicalTrials.gov | `respaldo` | `OPEN` | no — **sin adaptador** | 7/12 |
| OMS / WHO (guías y publicaciones) | `respaldo` | `OPEN` | no — **sin adaptador** | 8/12 |
| CDC (guías y MMWR) | `respaldo` | `OPEN` | no — **sin adaptador** | 8/12 |
| FDA / DailyMed (fichas de producto) | `respaldo` | `OPEN` | sí — **pero fuera del contrato**: no avisa si falla | 6/12 |
| Cochrane Library | `respaldo` | `REQUIRES_AGREEMENT` | no — sin licencia | 10/12 |
| UpToDate (Wolters Kluwer) | `respaldo` | `REQUIRES_AGREEMENT` | no — sin licencia | 11/12 |
| OpenEvidence | `respaldo` | `LICENSE_UNKNOWN` | no — sin licencia | 12/12 |
| Perplexity (búsqueda generativa) | `descubrimiento` | `LICENSE_UNKNOWN` | no — sin licencia | 9/12 |
| Conocimiento personal del médico (Obsidian y equivalentes) | `conocimiento_personal` | `OPEN` | no — sin licencia | 4/12 |
| Fuente sintética (pruebas y benchmark) | `respaldo` | `OPEN` | **sí** | 8/12 |
| NEJM | `respaldo` | `REQUIRES_AGREEMENT` | no — sin licencia | 12/12 |
| JAMA Network | `respaldo` | `REQUIRES_AGREEMENT` | no — sin licencia | 12/12 |
| The Lancet | `respaldo` | `REQUIRES_AGREEMENT` | no — sin licencia | 12/12 |
| The BMJ | `respaldo` | `REQUIRES_AGREEMENT` | no — sin licencia | 12/12 |
| Clinical Infectious Diseases | `respaldo` | `REQUIRES_AGREEMENT` | no — sin licencia | 12/12 |
| Nature Medicine | `respaldo` | `REQUIRES_AGREEMENT` | no — sin licencia | 12/12 |
| Annals of Internal Medicine | `respaldo` | `REQUIRES_AGREEMENT` | no — sin licencia | 12/12 |
| DynaMed | `respaldo` | `REQUIRES_AGREEMENT` | no — sin licencia | 12/12 |
| Scopus | `respaldo` | `REQUIRES_AGREEMENT` | no — sin licencia | 12/12 |
| Embase | `respaldo` | `REQUIRES_AGREEMENT` | no — sin licencia | 12/12 |
| Crossref | `respaldo` | `LICENSE_UNKNOWN` | no — sin licencia | 12/12 |
| IDSA (Infectious Diseases Society of America) | `respaldo` | `LICENSE_UNKNOWN` | no — sin licencia | 12/12 |
| ESC (European Society of Cardiology) | `respaldo` | `LICENSE_UNKNOWN` | no — sin licencia | 12/12 |
| AHA / ACC | `respaldo` | `LICENSE_UNKNOWN` | no — sin licencia | 12/12 |
| ATS / ERS | `respaldo` | `LICENSE_UNKNOWN` | no — sin licencia | 12/12 |
| EASL | `respaldo` | `LICENSE_UNKNOWN` | no — sin licencia | 12/12 |
| ECIL | `respaldo` | `LICENSE_UNKNOWN` | no — sin licencia | 12/12 |
| NCCN | `respaldo` | `REQUIRES_AGREEMENT` | no — sin licencia | 12/12 |
| Surviving Sepsis Campaign | `respaldo` | `LICENSE_UNKNOWN` | no — sin licencia | 12/12 |
| COFEPRIS | `respaldo` | `LICENSE_UNKNOWN` | no — sin licencia | 12/12 |
| CENETEC (GPC de Mexico) | `respaldo` | `LICENSE_UNKNOWN` | no — sin licencia | 12/12 |

«¿Se consulta hoy?» cruza DOS cosas, y hacen falta las dos:

- **`proveedorCanonico` en el catálogo.** Sin él no se puede construir un
  `Source`, y sin `Source` no hay `Passage` ni `Claim`: la falta de licencia
  bloquea el respaldo por construcción, no por un guardián que alguien pueda
  quitar.
- **Un adaptador instanciado en `recuperacion-consultor.ts`.** Una fila del
  catálogo sin adaptador no se consulta, no aparece en los avisos, y el médico
  **no puede leer «no se consultó»** — para él esa fuente sencillamente no
  existe.

Hay un tercer caso, y se dice aparte porque mezclarlo sería mentir en la otra
dirección: **PMC y openFDA sí se consultan**, pero los llama a mano la ruta
(`textoCompletoPMC`, `dosisFDA`) sin pasar por el contrato. Funcionan — y al
no pasar por `planDeConsulta` **no producen aviso**: si openFDA se cae, el
médico no lee «no se consultó», lee una respuesta más pobre y no puede
distinguirla de una completa.

Antes esta columna sólo miraba lo primero, y por eso decía «sí» de fuentes que
nadie ha construido (REG-345).

## Decisiones que esperan al dueño

### PubMed Central (Open Access)

QUÉ subconjunto se considera reproducible sigue siendo decisión del dueño. Mientras no exista, REG-357 aplica la única postura defendible: sólo CC0 y CC-BY, y ante la duda no se reproduce. Ampliarla (p. ej. admitir CC-BY-SA) es una decisión suya, no un ajuste técnico.

### OMS / WHO (guías y publicaciones)

Confirmar si la cláusula NC de CC BY-NC-SA afecta el uso dentro de un producto de pago. Es una pregunta legal, no técnica.

### FDA / DailyMed (fichas de producto)

Ojo clínico: la ficha FDA es de ETIQUETADO ESTADOUNIDENSE. Para México manda el registro sanitario COFEPRIS. No son intercambiables.

### Cochrane Library

DECISIÓN DEL DUEÑO (licencia + gasto): pedir a Cochrane los términos de (a) acceso programático y (b) reuso en sistema generativo. Hasta entonces el adaptador queda en not_configured y el material Cochrane que llegue por PubMed se cita como resumen indexado, nunca como revisión completa.

### UpToDate (Wolters Kluwer)

DECISIÓN DEL DUEÑO (licencia + gasto): iniciar contacto comercial con Wolters Kluwer para conocer términos de integración, precio y —crítico— si el reuso en un sistema generativo está permitido. Sin esa respuesta el adaptador NO se habilita.

### OpenEvidence

DECISIÓN DEL DUEÑO (licencia) + DECISIÓN ARQUITECTÓNICA: confirmar si existe una vía oficial de integración y, si existe, si su rol debe ser `descubrimiento` en vez de `respaldo`. La recomendación técnica de este slice es `descubrimiento`.

### Perplexity (búsqueda generativa)

DECISIÓN DEL DUEÑO (gasto): la API es de pago. No se contrata nada en este slice.

### Conocimiento personal del médico (Obsidian y equivalentes)

DECISIÓN DEL DUEÑO (política clínica): confirmar que el conocimiento personal se muestra SIEMPRE atribuido y separado, y que nunca alimenta al motor de razonamiento como si fuera guía. Este slice lo asume así y lo hace cumplir por contrato.

### NEJM

Acuerdo con la editorial o su API institucional. Sin eso se queda en descubrimiento via indice.

### JAMA Network

Acuerdo con la editorial o acceso por su API institucional. Sin eso se queda en descubrimiento via indice.

### The Lancet

Acuerdo con Elsevier o acceso por su API institucional. Sin eso se queda en descubrimiento via indice.

### The BMJ

Acuerdo con la editorial o acceso por su API institucional. Sin eso se queda en descubrimiento via indice.

### Clinical Infectious Diseases

Acuerdo con Oxford University Press o acceso institucional a Clinical Infectious Diseases.

### Nature Medicine

Acuerdo con Springer Nature, o su API institucional. Sin eso se queda en descubrimiento via indice.

### Annals of Internal Medicine

Acuerdo con el American College of Physicians o acceso institucional a Annals.

### DynaMed

Contrato con EBSCO y credenciales de DynaMed para el consultorio.

### Scopus

Contrato con Elsevier y clave de API institucional para el consultorio.

### Embase

Contrato con Elsevier y clave de API institucional para el consultorio.

### Crossref

Ninguna externa: es trabajo interno. Se declara aqui para que no vuelva a caerse del mapa.

### IDSA (Infectious Diseases Society of America)

Revisar los terminos de reuso de la IDSA antes de integrarla como fuente citable.

### ESC (European Society of Cardiology)

Revisar los terminos de reuso de la ESC antes de integrarla como fuente citable.

### AHA / ACC

Revisar los terminos de reuso de AHA/ACC antes de integrarlas como fuente citable.

### ATS / ERS

Revisar los terminos de reuso de la ATS/ERS antes de integrarla como fuente citable.

### EASL

Revisar los terminos de reuso de la EASL antes de integrarla como fuente citable.

### ECIL

Revisar los terminos de reuso de la ECIL antes de integrarla como fuente citable.

### NCCN

Registro institucional en la NCCN y revision de sus terminos de reuso, que son estrictos.

### Surviving Sepsis Campaign

Revisar los terminos de reuso de la Surviving Sepsis Campaign antes de integrarla.

### COFEPRIS

Revisar si COFEPRIS publica un canal consultable; hoy no consta que lo haga.

### CENETEC (GPC de Mexico)

Revisar si CENETEC publica un catalogo consultable de GPC.

## Ficha por proveedor

### PubMed / MEDLINE (NCBI E-utilities)

- **id**: `pubmed`
- **clase**: `literatura_primaria`
- **rol**: `respaldo`
- **licencia**: `OPEN`
- **proveedor canónico**: `pubmed`

API pública del NCBI, ya integrada en src/lib/evidencia/pubmed.ts. Se usan resumen y metadatos públicos; NO se descarga texto completo de revistas de paga.

| Campo | Estado |
|---|---|
| Vía oficial de integración | true — E-utilities (esearch/efetch), documentadas y públicas. |
| Clases de dato permitidas | termino_de_busqueda_sin_phi — Sólo se envían términos de búsqueda. La ruta actual ya minimiza PHI antes de llamar. |
| Admite PHI | false — Decisión de este repo: no se envía PHI a NCBI aunque la API no lo prohíba explícitamente. Ver .claude/rules/data-privacy.md. |
| Modelo de credencial | API key opcional (NCBI_API_KEY) que sólo eleva el límite de tasa — pubmed.ts:15 la lee del entorno; sin ella funciona más lento. |
| Derecho de caché | **UNVERIFIABLE** |
| Derecho de mostrar | **UNVERIFIABLE** |
| Cita profunda al original | true — PMID resuelve a una URL estable de PubMed. |
| Expone versión/frescura | false — Da fecha de PUBLICACIÓN, no de revisión. Un artículo no se "revisa": se sustituye por otro. |
| Límites y SLA | 3 req/s sin clave, 10 req/s con clave; sin SLA contractual — pubmed.ts ya monta una cola de throttle por 429 observados en producción. |
| Precio | sin costo — Servicio público del NIH. |
| Semántica de fallo | 429 y 5xx; puede devolver XML parcial — El throttle existente nació de un fallo real: "a veces no salen citas". |
| Reuso en sistema generativo | resumen y metadatos: sí, con cita — Los resúmenes de MEDLINE son públicos; el texto completo de la revista NO lo es. |

### PubMed Central (Open Access)

- **id**: `pmc`
- **clase**: `literatura_primaria`
- **rol**: `respaldo`
- **licencia**: `OPEN`
- **proveedor canónico**: `pmc`

Sólo el subconjunto Open Access. src/lib/evidencia/pubmed.ts:166 ya trae texto completo de PMC.

| Campo | Estado |
|---|---|
| Vía oficial de integración | true — BioC/OA de PMC. |
| Clases de dato permitidas | **UNVERIFIABLE** |
| Admite PHI | false — Misma política que PubMed. |
| Modelo de credencial | **UNVERIFIABLE** |
| Derecho de caché | **UNVERIFIABLE** |
| Derecho de mostrar | **UNVERIFIABLE** |
| Cita profunda al original | true — PMCID estable. |
| Expone versión/frescura | **UNVERIFIABLE** |
| Límites y SLA | **UNVERIFIABLE** |
| Precio | sin costo — Servicio público del NIH. |
| Semántica de fallo | **UNVERIFIABLE** |
| Reuso en sistema generativo | sólo CC0 y CC-BY; el resto NO se reproduce — REG-357: se lee la licencia POR ARTÍCULO en el XML y se falla cerrado. Sin permiso explícito se usa el resumen, igual que con un artículo de pago. El subconjunto OA mezcla licencias: «acceso abierto» dice que se puede LEER, no que se pueda COPIAR en un producto de pago. |

### ClinicalTrials.gov

- **id**: `clinicaltrials`
- **clase**: `registro_de_ensayos`
- **rol**: `respaldo`
- **licencia**: `OPEN`
- **proveedor canónico**: `clinicaltrials`

Registro público del NIH con API v2 documentada.

| Campo | Estado |
|---|---|
| Vía oficial de integración | true — API v2 pública. |
| Clases de dato permitidas | **UNVERIFIABLE** |
| Admite PHI | false — Política del repo. |
| Modelo de credencial | **UNVERIFIABLE** |
| Derecho de caché | **UNVERIFIABLE** |
| Derecho de mostrar | **UNVERIFIABLE** |
| Cita profunda al original | true — NCT id estable. |
| Expone versión/frescura | true — lastUpdatePostDate por registro. |
| Límites y SLA | **UNVERIFIABLE** |
| Precio | sin costo — Servicio público. |
| Semántica de fallo | **UNVERIFIABLE** |
| Reuso en sistema generativo | **UNVERIFIABLE** |

### OMS / WHO (guías y publicaciones)

- **id**: `who`
- **clase**: `guia_de_practica`
- **rol**: `respaldo`
- **licencia**: `OPEN`
- **proveedor canónico**: `who`

Publicaciones bajo CC BY-NC-SA en su mayoría. Ya está en PROVEEDORES.

| Campo | Estado |
|---|---|
| Vía oficial de integración | false — No hay API de guías: hay documentos. La recuperación programática es un problema abierto. |
| Clases de dato permitidas | **UNVERIFIABLE** |
| Admite PHI | false — Política del repo. |
| Modelo de credencial | **UNVERIFIABLE** |
| Derecho de caché | **UNVERIFIABLE** |
| Derecho de mostrar | **UNVERIFIABLE** |
| Cita profunda al original | true — URL estable de IRIS. |
| Expone versión/frescura | **UNVERIFIABLE** |
| Límites y SLA | **UNVERIFIABLE** |
| Precio | **UNVERIFIABLE** |
| Semántica de fallo | **UNVERIFIABLE** |
| Reuso en sistema generativo | CC BY-NC-SA en general, con excepciones por documento — NC = no comercial. Ausculta es comercial: hay que revisar caso por caso antes de reproducir texto. |

### CDC (guías y MMWR)

- **id**: `cdc`
- **clase**: `guia_de_practica`
- **rol**: `respaldo`
- **licencia**: `OPEN`
- **proveedor canónico**: `cdc`

Obra del gobierno federal de EE. UU.: dominio público salvo material de terceros incrustado.

| Campo | Estado |
|---|---|
| Vía oficial de integración | false — Hay APIs sueltas (data.cdc.gov) pero no una de guías. |
| Clases de dato permitidas | **UNVERIFIABLE** |
| Admite PHI | false — Política del repo. |
| Modelo de credencial | **UNVERIFIABLE** |
| Derecho de caché | **UNVERIFIABLE** |
| Derecho de mostrar | **UNVERIFIABLE** |
| Cita profunda al original | true — URL estable. |
| Expone versión/frescura | **UNVERIFIABLE** |
| Límites y SLA | **UNVERIFIABLE** |
| Precio | **UNVERIFIABLE** |
| Semántica de fallo | **UNVERIFIABLE** |
| Reuso en sistema generativo | dominio público, salvo figuras/tablas de terceros — La excepción de terceros es real y hay que respetarla al reproducir figuras. |

### FDA / DailyMed (fichas de producto)

- **id**: `fda_dailymed`
- **clase**: `ficha_de_farmaco`
- **rol**: `respaldo`
- **licencia**: `OPEN`
- **proveedor canónico**: `fda_dailymed`

openFDA ya está integrado en src/lib/evidencia/openfda.ts.

| Campo | Estado |
|---|---|
| Vía oficial de integración | true — openFDA + DailyMed SPL. |
| Clases de dato permitidas | **UNVERIFIABLE** |
| Admite PHI | false — Política del repo. |
| Modelo de credencial | **UNVERIFIABLE** |
| Derecho de caché | **UNVERIFIABLE** |
| Derecho de mostrar | **UNVERIFIABLE** |
| Cita profunda al original | true — SetID de SPL estable. |
| Expone versión/frescura | true — effective_time del SPL. |
| Límites y SLA | **UNVERIFIABLE** |
| Precio | sin costo — Servicio público. |
| Semántica de fallo | **UNVERIFIABLE** |
| Reuso en sistema generativo | etiquetado en dominio público — La etiqueta aprobada es documento público. |

### Cochrane Library

- **id**: `cochrane`
- **clase**: `revision_sistematica`
- **rol**: `respaldo`
- **licencia**: `REQUIRES_AGREEMENT`
- **proveedor canónico**: _ninguno — no puede producir un `Source` citable_

Cochrane tiene TRES niveles que #314 exige distinguir y que se confunden constantemente: (1) el RESUMEN estructurado y el resumen en lenguaje sencillo (PLS), indexados en PubMed y visibles sin suscripción; (2) la REVISIÓN COMPLETA, que en la mayoría de países requiere suscripción a la Cochrane Library; (3) el REUSO COMERCIAL o en sistemas generativos, que es un permiso APARTE y NO se obtiene por tener acceso de lectura. Tener (1) o incluso (2) no da (3). Ésa es exactamente la confusión que convierte una integración en una infracción. NOTA OPERATIVA: los resúmenes de revisiones Cochrane SÍ están indexados en MEDLINE, así que hoy ya pueden llegar por el adaptador de PubMed, con su cita y bajo los términos de PubMed. Eso NO es "integrar Cochrane": es citar un resumen indexado.

| Campo | Estado |
|---|---|
| Vía oficial de integración | **UNVERIFIABLE** |
| Clases de dato permitidas | **UNVERIFIABLE** |
| Admite PHI | **UNVERIFIABLE** |
| Modelo de credencial | **UNVERIFIABLE** |
| Derecho de caché | **UNVERIFIABLE** |
| Derecho de mostrar | **UNVERIFIABLE** |
| Cita profunda al original | true — El DOI/CD id de la revisión resuelve a la Cochrane Library. Verificable sin credencial. |
| Expone versión/frescura | true — El versionado .pubN del identificador (p. ej. CD004523.pub5) ES el dato de frescura, y es público. |
| Límites y SLA | **UNVERIFIABLE** |
| Precio | **UNVERIFIABLE** |
| Semántica de fallo | **UNVERIFIABLE** |
| Reuso en sistema generativo | **UNVERIFIABLE** |

### UpToDate (Wolters Kluwer)

- **id**: `uptodate`
- **clase**: `referencia_terciaria`
- **rol**: `respaldo`
- **licencia**: `REQUIRES_AGREEMENT`
- **proveedor canónico**: _ninguno — no puede producir un `Source` citable_

Ya está en src/types/evidence.ts como LICENSE_UNKNOWN por la decisión D1 del dueño, que advierte de no convertir una copia personal del estándar en una base comercial redistribuida. UpToDate publica vías de integración institucional/EHR, pero son contratos empresariales: no hay una API de autoservicio. PROHIBIDO EXPLÍCITAMENTE POR #314: scraping, credenciales compartidas, automatizar un navegador alrededor del control de acceso, copiar el corpus o usar un endpoint no documentado. Este repo no contiene ninguna de esas cosas y el adaptador está construido para no poder hacerlas.

| Campo | Estado |
|---|---|
| Vía oficial de integración | true — Existen programas de integración institucional/EHR documentados públicamente. Lo UNVERIFIABLE son sus TÉRMINOS, no su existencia. |
| Clases de dato permitidas | **UNVERIFIABLE** |
| Admite PHI | **UNVERIFIABLE** |
| Modelo de credencial | **UNVERIFIABLE** |
| Derecho de caché | **UNVERIFIABLE** |
| Derecho de mostrar | **UNVERIFIABLE** |
| Cita profunda al original | **UNVERIFIABLE** |
| Expone versión/frescura | **UNVERIFIABLE** |
| Límites y SLA | **UNVERIFIABLE** |
| Precio | **UNVERIFIABLE** |
| Semántica de fallo | **UNVERIFIABLE** |
| Reuso en sistema generativo | **UNVERIFIABLE** |

### OpenEvidence

- **id**: `openevidence`
- **clase**: `asistente_generativo`
- **rol**: `respaldo`
- **licencia**: `LICENSE_UNKNOWN`
- **proveedor canónico**: _ninguno — no puede producir un `Source` citable_

OpenEvidence es un producto de cara al médico, no un proveedor de datos con API pública documentada. AVISO ARQUITECTÓNICO: su salida es SINTETIZADA. Consumirla como "fuente" metería síntesis de otro modelo dentro de la nuestra, y el pasaje que respaldaría un claim sería texto GENERADO, no texto de la literatura. Eso rompe el invariante de src/types/evidence.ts (un Passage es subcadena LITERAL de un documento recuperado). Si algún día se integra, lo correcto es tratar su salida como DESCUBRIMIENTO (igual que Perplexity) y re-groundear en las fuentes primarias que cite, no como respaldo directo.

| Campo | Estado |
|---|---|
| Vía oficial de integración | **UNVERIFIABLE** |
| Clases de dato permitidas | **UNVERIFIABLE** |
| Admite PHI | **UNVERIFIABLE** |
| Modelo de credencial | **UNVERIFIABLE** |
| Derecho de caché | **UNVERIFIABLE** |
| Derecho de mostrar | **UNVERIFIABLE** |
| Cita profunda al original | **UNVERIFIABLE** |
| Expone versión/frescura | **UNVERIFIABLE** |
| Límites y SLA | **UNVERIFIABLE** |
| Precio | **UNVERIFIABLE** |
| Semántica de fallo | **UNVERIFIABLE** |
| Reuso en sistema generativo | **UNVERIFIABLE** |

### Perplexity (búsqueda generativa)

- **id**: `perplexity`
- **clase**: `asistente_generativo`
- **rol**: `descubrimiento`
- **licencia**: `LICENSE_UNKNOWN`
- **proveedor canónico**: _ninguno — no puede producir un `Source` citable_

CLASIFICACIÓN EXPLÍCITA DE #314 (punto 7): sirve para DESCUBRIR, jamás para RESPALDAR. Una respuesta de Perplexity es texto generado. Aunque traiga enlaces, el texto que respaldaría la afirmación no es un pasaje de la fuente: es la paráfrasis del modelo. Anclar un claim ahí sería fabricar respaldo con pasos extra. USO LEGÍTIMO: proponer términos de búsqueda, identificar artículos candidatos o actuar de retador ("¿qué se me escapa?"). Lo que proponga se recupera DESPUÉS de una fuente verificable, y es esa recuperación —no Perplexity— la que respalda. La regla vive en el servidor: el rol `descubrimiento` hace que sobreConMaterial() RECHACE cualquier Source que venga por aquí (contrato.ts, ROL_NO_PUEDE_APORTAR_FUENTES). No depende de que un prompt se porte bien.

| Campo | Estado |
|---|---|
| Vía oficial de integración | true — Tiene API de pago documentada. Lo pendiente es la decisión de gasto, no la existencia. |
| Clases de dato permitidas | **UNVERIFIABLE** |
| Admite PHI | false — Decisión de este repo: no se envía PHI a un buscador generativo de terceros. |
| Modelo de credencial | **UNVERIFIABLE** |
| Derecho de caché | **UNVERIFIABLE** |
| Derecho de mostrar | **UNVERIFIABLE** |
| Cita profunda al original | **UNVERIFIABLE** |
| Expone versión/frescura | **UNVERIFIABLE** |
| Límites y SLA | **UNVERIFIABLE** |
| Precio | **UNVERIFIABLE** |
| Semántica de fallo | **UNVERIFIABLE** |
| Reuso en sistema generativo | irrelevante para respaldo: su salida no puede anclar un claim — No es una limitación de licencia sino del modelo de evidencia. |

### Conocimiento personal del médico (Obsidian y equivalentes)

- **id**: `conocimiento_personal`
- **clase**: `notas_del_medico`
- **rol**: `conocimiento_personal`
- **licencia**: `OPEN`
- **proveedor canónico**: _ninguno — no puede producir un `Source` citable_

CLASIFICACIÓN EXPLÍCITA DE #314 (punto 8): son notas del propio médico, con procedencia de autor/fuente/fecha, y NUNCA ascienden automáticamente a nivel de guía. Valor real: es donde vive el criterio del Dr. —sus esquemas preferidos, su experiencia local, la resistencia bacteriana de SU hospital—. Eso no está en PubMed y a menudo es lo más útil que hay. Riesgo real y simétrico: una nota de hace cuatro años con una dosis que ya cambió es indistinguible, en texto plano, de una nota escrita ayer. Por eso la fecha de autoría es OBLIGATORIA y `frescura.ts` la evalúa con un umbral MÁS ESTRICTO que el de la literatura. El rol `conocimiento_personal` impide, por contrato, que produzca Source anclables. Se muestra como contexto atribuido al médico, separado visualmente de la evidencia externa. PRIVACIDAD: una bóveda personal puede contener PHI de pacientes reales. Cualquier importador futuro tiene que asumir que SÍ la contiene (.claude/rules/data-privacy.md), no que no.

| Campo | Estado |
|---|---|
| Vía oficial de integración | true — Son archivos locales (Markdown). No hay proveedor con el que contratar. |
| Clases de dato permitidas | **UNVERIFIABLE** |
| Admite PHI | true — ES EL ÚNICO PROVEEDOR QUE PUEDE CONTENER PHI, porque es material del propio médico y nunca sale del inquilino. Justo por eso NO puede enviarse a ningún tercero. |
| Modelo de credencial | ninguna: importación explícita del médico — Nada se lee sin que el médico lo suba. |
| Derecho de caché | dentro del inquilino, sí — Es material del propio consultorio. |
| Derecho de mostrar | **UNVERIFIABLE** |
| Cita profunda al original | true — Ruta del archivo + fecha de autoría. |
| Expone versión/frescura | true — Fecha de la nota, que es OBLIGATORIA al importar. |
| Límites y SLA | **UNVERIFIABLE** |
| Precio | sin costo — Archivos del médico. |
| Semántica de fallo | **UNVERIFIABLE** |
| Reuso en sistema generativo | dentro del inquilino y atribuido, sí; como guía, NO — Regla 8 de #314. |

### Fuente sintética (pruebas y benchmark)

- **id**: `sintetico`
- **clase**: `literatura_primaria`
- **rol**: `respaldo`
- **licencia**: `OPEN`
- **proveedor canónico**: `pubmed`

Adaptador determinista con corpus sintético para que las pruebas y el benchmark de #314 no dependan de la red ni de una credencial. NO se usa en producción; su guardián lo comprueba.

| Campo | Estado |
|---|---|
| Vía oficial de integración | true — Es local. |
| Clases de dato permitidas | **UNVERIFIABLE** |
| Admite PHI | false — El corpus es sintético por regla (.claude/rules/data-privacy.md): cero pacientes reales. |
| Modelo de credencial | **UNVERIFIABLE** |
| Derecho de caché | **UNVERIFIABLE** |
| Derecho de mostrar | **UNVERIFIABLE** |
| Cita profunda al original | **UNVERIFIABLE** |
| Expone versión/frescura | **UNVERIFIABLE** |
| Límites y SLA | **UNVERIFIABLE** |
| Precio | sin costo — Local. |
| Semántica de fallo | inyectable por el test — Puede simular caída, rechazo y recorte a voluntad. |
| Reuso en sistema generativo | **UNVERIFIABLE** |

### NEJM

- **id**: `nejm`
- **clase**: `literatura_primaria`
- **rol**: `respaldo`
- **licencia**: `REQUIRES_AGREEMENT`
- **proveedor canónico**: _ninguno — no puede producir un `Source` citable_

Hoy sus articulos se DESCUBREN via PubMed (resumen y metadatos publicos). Eso no es una integracion editorial y llamarlo asi seria falso: no hay contrato, ni API, ni texto completo.

| Campo | Estado |
|---|---|
| Vía oficial de integración | **UNVERIFIABLE** |
| Clases de dato permitidas | **UNVERIFIABLE** |
| Admite PHI | **UNVERIFIABLE** |
| Modelo de credencial | **UNVERIFIABLE** |
| Derecho de caché | **UNVERIFIABLE** |
| Derecho de mostrar | **UNVERIFIABLE** |
| Cita profunda al original | **UNVERIFIABLE** |
| Expone versión/frescura | **UNVERIFIABLE** |
| Límites y SLA | **UNVERIFIABLE** |
| Precio | **UNVERIFIABLE** |
| Semántica de fallo | **UNVERIFIABLE** |
| Reuso en sistema generativo | **UNVERIFIABLE** |

### JAMA Network

- **id**: `jama`
- **clase**: `literatura_primaria`
- **rol**: `respaldo`
- **licencia**: `REQUIRES_AGREEMENT`
- **proveedor canónico**: _ninguno — no puede producir un `Source` citable_

Igual que NEJM: descubrimiento via PubMed, sin integracion editorial.

| Campo | Estado |
|---|---|
| Vía oficial de integración | **UNVERIFIABLE** |
| Clases de dato permitidas | **UNVERIFIABLE** |
| Admite PHI | **UNVERIFIABLE** |
| Modelo de credencial | **UNVERIFIABLE** |
| Derecho de caché | **UNVERIFIABLE** |
| Derecho de mostrar | **UNVERIFIABLE** |
| Cita profunda al original | **UNVERIFIABLE** |
| Expone versión/frescura | **UNVERIFIABLE** |
| Límites y SLA | **UNVERIFIABLE** |
| Precio | **UNVERIFIABLE** |
| Semántica de fallo | **UNVERIFIABLE** |
| Reuso en sistema generativo | **UNVERIFIABLE** |

### The Lancet

- **id**: `lancet`
- **clase**: `literatura_primaria`
- **rol**: `respaldo`
- **licencia**: `REQUIRES_AGREEMENT`
- **proveedor canónico**: _ninguno — no puede producir un `Source` citable_

Igual que NEJM: descubrimiento via PubMed, sin integracion editorial.

| Campo | Estado |
|---|---|
| Vía oficial de integración | **UNVERIFIABLE** |
| Clases de dato permitidas | **UNVERIFIABLE** |
| Admite PHI | **UNVERIFIABLE** |
| Modelo de credencial | **UNVERIFIABLE** |
| Derecho de caché | **UNVERIFIABLE** |
| Derecho de mostrar | **UNVERIFIABLE** |
| Cita profunda al original | **UNVERIFIABLE** |
| Expone versión/frescura | **UNVERIFIABLE** |
| Límites y SLA | **UNVERIFIABLE** |
| Precio | **UNVERIFIABLE** |
| Semántica de fallo | **UNVERIFIABLE** |
| Reuso en sistema generativo | **UNVERIFIABLE** |

### The BMJ

- **id**: `bmj`
- **clase**: `literatura_primaria`
- **rol**: `respaldo`
- **licencia**: `REQUIRES_AGREEMENT`
- **proveedor canónico**: _ninguno — no puede producir un `Source` citable_

Igual que NEJM: descubrimiento via PubMed, sin integracion editorial.

| Campo | Estado |
|---|---|
| Vía oficial de integración | **UNVERIFIABLE** |
| Clases de dato permitidas | **UNVERIFIABLE** |
| Admite PHI | **UNVERIFIABLE** |
| Modelo de credencial | **UNVERIFIABLE** |
| Derecho de caché | **UNVERIFIABLE** |
| Derecho de mostrar | **UNVERIFIABLE** |
| Cita profunda al original | **UNVERIFIABLE** |
| Expone versión/frescura | **UNVERIFIABLE** |
| Límites y SLA | **UNVERIFIABLE** |
| Precio | **UNVERIFIABLE** |
| Semántica de fallo | **UNVERIFIABLE** |
| Reuso en sistema generativo | **UNVERIFIABLE** |

### Clinical Infectious Diseases

- **id**: `cid`
- **clase**: `literatura_primaria`
- **rol**: `respaldo`
- **licencia**: `REQUIRES_AGREEMENT`
- **proveedor canónico**: _ninguno — no puede producir un `Source` citable_

Revista de referencia de la especialidad del duenio. Hoy, descubrimiento via PubMed y nada mas.

| Campo | Estado |
|---|---|
| Vía oficial de integración | **UNVERIFIABLE** |
| Clases de dato permitidas | **UNVERIFIABLE** |
| Admite PHI | **UNVERIFIABLE** |
| Modelo de credencial | **UNVERIFIABLE** |
| Derecho de caché | **UNVERIFIABLE** |
| Derecho de mostrar | **UNVERIFIABLE** |
| Cita profunda al original | **UNVERIFIABLE** |
| Expone versión/frescura | **UNVERIFIABLE** |
| Límites y SLA | **UNVERIFIABLE** |
| Precio | **UNVERIFIABLE** |
| Semántica de fallo | **UNVERIFIABLE** |
| Reuso en sistema generativo | **UNVERIFIABLE** |

### Nature Medicine

- **id**: `nature_medicine`
- **clase**: `literatura_primaria`
- **rol**: `respaldo`
- **licencia**: `REQUIRES_AGREEMENT`
- **proveedor canónico**: _ninguno — no puede producir un `Source` citable_

Descubrimiento via PubMed, sin integracion editorial.

| Campo | Estado |
|---|---|
| Vía oficial de integración | **UNVERIFIABLE** |
| Clases de dato permitidas | **UNVERIFIABLE** |
| Admite PHI | **UNVERIFIABLE** |
| Modelo de credencial | **UNVERIFIABLE** |
| Derecho de caché | **UNVERIFIABLE** |
| Derecho de mostrar | **UNVERIFIABLE** |
| Cita profunda al original | **UNVERIFIABLE** |
| Expone versión/frescura | **UNVERIFIABLE** |
| Límites y SLA | **UNVERIFIABLE** |
| Precio | **UNVERIFIABLE** |
| Semántica de fallo | **UNVERIFIABLE** |
| Reuso en sistema generativo | **UNVERIFIABLE** |

### Annals of Internal Medicine

- **id**: `annals`
- **clase**: `literatura_primaria`
- **rol**: `respaldo`
- **licencia**: `REQUIRES_AGREEMENT`
- **proveedor canónico**: _ninguno — no puede producir un `Source` citable_

Descubrimiento via PubMed, sin integracion editorial.

| Campo | Estado |
|---|---|
| Vía oficial de integración | **UNVERIFIABLE** |
| Clases de dato permitidas | **UNVERIFIABLE** |
| Admite PHI | **UNVERIFIABLE** |
| Modelo de credencial | **UNVERIFIABLE** |
| Derecho de caché | **UNVERIFIABLE** |
| Derecho de mostrar | **UNVERIFIABLE** |
| Cita profunda al original | **UNVERIFIABLE** |
| Expone versión/frescura | **UNVERIFIABLE** |
| Límites y SLA | **UNVERIFIABLE** |
| Precio | **UNVERIFIABLE** |
| Semántica de fallo | **UNVERIFIABLE** |
| Reuso en sistema generativo | **UNVERIFIABLE** |

### DynaMed

- **id**: `dynamed`
- **clase**: `referencia_terciaria`
- **rol**: `respaldo`
- **licencia**: `REQUIRES_AGREEMENT`
- **proveedor canónico**: _ninguno — no puede producir un `Source` citable_

Ni siquiera estaba catalogada, asi que el medico no podia leer «DynaMed: no se consulto». Sin adaptador y sin contrato.

| Campo | Estado |
|---|---|
| Vía oficial de integración | **UNVERIFIABLE** |
| Clases de dato permitidas | **UNVERIFIABLE** |
| Admite PHI | **UNVERIFIABLE** |
| Modelo de credencial | **UNVERIFIABLE** |
| Derecho de caché | **UNVERIFIABLE** |
| Derecho de mostrar | **UNVERIFIABLE** |
| Cita profunda al original | **UNVERIFIABLE** |
| Expone versión/frescura | **UNVERIFIABLE** |
| Límites y SLA | **UNVERIFIABLE** |
| Precio | **UNVERIFIABLE** |
| Semántica de fallo | **UNVERIFIABLE** |
| Reuso en sistema generativo | **UNVERIFIABLE** |

### Scopus

- **id**: `scopus`
- **clase**: `literatura_primaria`
- **rol**: `respaldo`
- **licencia**: `REQUIRES_AGREEMENT`
- **proveedor canónico**: _ninguno — no puede producir un `Source` citable_

Indice de citas de Elsevier. Sin catalogar hasta hoy; sin adaptador y sin contrato.

| Campo | Estado |
|---|---|
| Vía oficial de integración | **UNVERIFIABLE** |
| Clases de dato permitidas | **UNVERIFIABLE** |
| Admite PHI | **UNVERIFIABLE** |
| Modelo de credencial | **UNVERIFIABLE** |
| Derecho de caché | **UNVERIFIABLE** |
| Derecho de mostrar | **UNVERIFIABLE** |
| Cita profunda al original | **UNVERIFIABLE** |
| Expone versión/frescura | **UNVERIFIABLE** |
| Límites y SLA | **UNVERIFIABLE** |
| Precio | **UNVERIFIABLE** |
| Semántica de fallo | **UNVERIFIABLE** |
| Reuso en sistema generativo | **UNVERIFIABLE** |

### Embase

- **id**: `embase`
- **clase**: `literatura_primaria`
- **rol**: `respaldo`
- **licencia**: `REQUIRES_AGREEMENT`
- **proveedor canónico**: _ninguno — no puede producir un `Source` citable_

Indice biomedico de Elsevier, complementario de MEDLINE. Sin catalogar hasta hoy.

| Campo | Estado |
|---|---|
| Vía oficial de integración | **UNVERIFIABLE** |
| Clases de dato permitidas | **UNVERIFIABLE** |
| Admite PHI | **UNVERIFIABLE** |
| Modelo de credencial | **UNVERIFIABLE** |
| Derecho de caché | **UNVERIFIABLE** |
| Derecho de mostrar | **UNVERIFIABLE** |
| Cita profunda al original | **UNVERIFIABLE** |
| Expone versión/frescura | **UNVERIFIABLE** |
| Límites y SLA | **UNVERIFIABLE** |
| Precio | **UNVERIFIABLE** |
| Semántica de fallo | **UNVERIFIABLE** |
| Reuso en sistema generativo | **UNVERIFIABLE** |

### Crossref

- **id**: `crossref`
- **clase**: `literatura_primaria`
- **rol**: `respaldo`
- **licencia**: `LICENSE_UNKNOWN`
- **proveedor canónico**: _ninguno — no puede producir un `Source` citable_

API publica de metadatos y DOI. NO esta integrada, y su ausencia es la razon de que el DOI se pierda por el camino (WS-07).

| Campo | Estado |
|---|---|
| Vía oficial de integración | **UNVERIFIABLE** |
| Clases de dato permitidas | **UNVERIFIABLE** |
| Admite PHI | **UNVERIFIABLE** |
| Modelo de credencial | **UNVERIFIABLE** |
| Derecho de caché | **UNVERIFIABLE** |
| Derecho de mostrar | **UNVERIFIABLE** |
| Cita profunda al original | **UNVERIFIABLE** |
| Expone versión/frescura | **UNVERIFIABLE** |
| Límites y SLA | **UNVERIFIABLE** |
| Precio | **UNVERIFIABLE** |
| Semántica de fallo | **UNVERIFIABLE** |
| Reuso en sistema generativo | **UNVERIFIABLE** |

### IDSA (Infectious Diseases Society of America)

- **id**: `idsa`
- **clase**: `guia_de_practica`
- **rol**: `respaldo`
- **licencia**: `LICENSE_UNKNOWN`
- **proveedor canónico**: _ninguno — no puede producir un `Source` citable_

Sus guias se citan hoy como CADENAS FIJAS dentro de motores clinicos: no hay objeto de guia, ni version, ni fecha, ni forma de saber si la citada sigue vigente (WS-07).

| Campo | Estado |
|---|---|
| Vía oficial de integración | **UNVERIFIABLE** |
| Clases de dato permitidas | **UNVERIFIABLE** |
| Admite PHI | **UNVERIFIABLE** |
| Modelo de credencial | **UNVERIFIABLE** |
| Derecho de caché | **UNVERIFIABLE** |
| Derecho de mostrar | **UNVERIFIABLE** |
| Cita profunda al original | **UNVERIFIABLE** |
| Expone versión/frescura | **UNVERIFIABLE** |
| Límites y SLA | **UNVERIFIABLE** |
| Precio | **UNVERIFIABLE** |
| Semántica de fallo | **UNVERIFIABLE** |
| Reuso en sistema generativo | **UNVERIFIABLE** |

### ESC (European Society of Cardiology)

- **id**: `esc`
- **clase**: `guia_de_practica`
- **rol**: `respaldo`
- **licencia**: `LICENSE_UNKNOWN`
- **proveedor canónico**: _ninguno — no puede producir un `Source` citable_

Cadena de cita fija dentro de motores clinicos. Sin objeto de guia ni control de vigencia.

| Campo | Estado |
|---|---|
| Vía oficial de integración | **UNVERIFIABLE** |
| Clases de dato permitidas | **UNVERIFIABLE** |
| Admite PHI | **UNVERIFIABLE** |
| Modelo de credencial | **UNVERIFIABLE** |
| Derecho de caché | **UNVERIFIABLE** |
| Derecho de mostrar | **UNVERIFIABLE** |
| Cita profunda al original | **UNVERIFIABLE** |
| Expone versión/frescura | **UNVERIFIABLE** |
| Límites y SLA | **UNVERIFIABLE** |
| Precio | **UNVERIFIABLE** |
| Semántica de fallo | **UNVERIFIABLE** |
| Reuso en sistema generativo | **UNVERIFIABLE** |

### AHA / ACC

- **id**: `aha_acc`
- **clase**: `guia_de_practica`
- **rol**: `respaldo`
- **licencia**: `LICENSE_UNKNOWN`
- **proveedor canónico**: _ninguno — no puede producir un `Source` citable_

Cadena de cita fija dentro de motores clinicos. Sin objeto de guia ni control de vigencia.

| Campo | Estado |
|---|---|
| Vía oficial de integración | **UNVERIFIABLE** |
| Clases de dato permitidas | **UNVERIFIABLE** |
| Admite PHI | **UNVERIFIABLE** |
| Modelo de credencial | **UNVERIFIABLE** |
| Derecho de caché | **UNVERIFIABLE** |
| Derecho de mostrar | **UNVERIFIABLE** |
| Cita profunda al original | **UNVERIFIABLE** |
| Expone versión/frescura | **UNVERIFIABLE** |
| Límites y SLA | **UNVERIFIABLE** |
| Precio | **UNVERIFIABLE** |
| Semántica de fallo | **UNVERIFIABLE** |
| Reuso en sistema generativo | **UNVERIFIABLE** |

### ATS / ERS

- **id**: `ats`
- **clase**: `guia_de_practica`
- **rol**: `respaldo`
- **licencia**: `LICENSE_UNKNOWN`
- **proveedor canónico**: _ninguno — no puede producir un `Source` citable_

Ni siquiera estaba catalogada. Sin adaptador y sin objeto de guia.

| Campo | Estado |
|---|---|
| Vía oficial de integración | **UNVERIFIABLE** |
| Clases de dato permitidas | **UNVERIFIABLE** |
| Admite PHI | **UNVERIFIABLE** |
| Modelo de credencial | **UNVERIFIABLE** |
| Derecho de caché | **UNVERIFIABLE** |
| Derecho de mostrar | **UNVERIFIABLE** |
| Cita profunda al original | **UNVERIFIABLE** |
| Expone versión/frescura | **UNVERIFIABLE** |
| Límites y SLA | **UNVERIFIABLE** |
| Precio | **UNVERIFIABLE** |
| Semántica de fallo | **UNVERIFIABLE** |
| Reuso en sistema generativo | **UNVERIFIABLE** |

### EASL

- **id**: `easl`
- **clase**: `guia_de_practica`
- **rol**: `respaldo`
- **licencia**: `LICENSE_UNKNOWN`
- **proveedor canónico**: _ninguno — no puede producir un `Source` citable_

Sin catalogar hasta hoy. Sin adaptador y sin objeto de guia.

| Campo | Estado |
|---|---|
| Vía oficial de integración | **UNVERIFIABLE** |
| Clases de dato permitidas | **UNVERIFIABLE** |
| Admite PHI | **UNVERIFIABLE** |
| Modelo de credencial | **UNVERIFIABLE** |
| Derecho de caché | **UNVERIFIABLE** |
| Derecho de mostrar | **UNVERIFIABLE** |
| Cita profunda al original | **UNVERIFIABLE** |
| Expone versión/frescura | **UNVERIFIABLE** |
| Límites y SLA | **UNVERIFIABLE** |
| Precio | **UNVERIFIABLE** |
| Semántica de fallo | **UNVERIFIABLE** |
| Reuso en sistema generativo | **UNVERIFIABLE** |

### ECIL

- **id**: `ecil`
- **clase**: `guia_de_practica`
- **rol**: `respaldo`
- **licencia**: `LICENSE_UNKNOWN`
- **proveedor canónico**: _ninguno — no puede producir un `Source` citable_

Guias de infeccion en el paciente hematologico. Sin catalogar hasta hoy.

| Campo | Estado |
|---|---|
| Vía oficial de integración | **UNVERIFIABLE** |
| Clases de dato permitidas | **UNVERIFIABLE** |
| Admite PHI | **UNVERIFIABLE** |
| Modelo de credencial | **UNVERIFIABLE** |
| Derecho de caché | **UNVERIFIABLE** |
| Derecho de mostrar | **UNVERIFIABLE** |
| Cita profunda al original | **UNVERIFIABLE** |
| Expone versión/frescura | **UNVERIFIABLE** |
| Límites y SLA | **UNVERIFIABLE** |
| Precio | **UNVERIFIABLE** |
| Semántica de fallo | **UNVERIFIABLE** |
| Reuso en sistema generativo | **UNVERIFIABLE** |

### NCCN

- **id**: `nccn`
- **clase**: `guia_de_practica`
- **rol**: `respaldo`
- **licencia**: `REQUIRES_AGREEMENT`
- **proveedor canónico**: _ninguno — no puede producir un `Source` citable_

Sus guias exigen registro y tienen terminos de reuso estrictos. Sin catalogar hasta hoy.

| Campo | Estado |
|---|---|
| Vía oficial de integración | **UNVERIFIABLE** |
| Clases de dato permitidas | **UNVERIFIABLE** |
| Admite PHI | **UNVERIFIABLE** |
| Modelo de credencial | **UNVERIFIABLE** |
| Derecho de caché | **UNVERIFIABLE** |
| Derecho de mostrar | **UNVERIFIABLE** |
| Cita profunda al original | **UNVERIFIABLE** |
| Expone versión/frescura | **UNVERIFIABLE** |
| Límites y SLA | **UNVERIFIABLE** |
| Precio | **UNVERIFIABLE** |
| Semántica de fallo | **UNVERIFIABLE** |
| Reuso en sistema generativo | **UNVERIFIABLE** |

### Surviving Sepsis Campaign

- **id**: `surviving_sepsis`
- **clase**: `guia_de_practica`
- **rol**: `respaldo`
- **licencia**: `LICENSE_UNKNOWN`
- **proveedor canónico**: _ninguno — no puede producir un `Source` citable_

Cadena de cita fija dentro de motores clinicos. Sin objeto de guia ni control de vigencia.

| Campo | Estado |
|---|---|
| Vía oficial de integración | **UNVERIFIABLE** |
| Clases de dato permitidas | **UNVERIFIABLE** |
| Admite PHI | **UNVERIFIABLE** |
| Modelo de credencial | **UNVERIFIABLE** |
| Derecho de caché | **UNVERIFIABLE** |
| Derecho de mostrar | **UNVERIFIABLE** |
| Cita profunda al original | **UNVERIFIABLE** |
| Expone versión/frescura | **UNVERIFIABLE** |
| Límites y SLA | **UNVERIFIABLE** |
| Precio | **UNVERIFIABLE** |
| Semántica de fallo | **UNVERIFIABLE** |
| Reuso en sistema generativo | **UNVERIFIABLE** |

### COFEPRIS

- **id**: `cofepris`
- **clase**: `ficha_de_farmaco`
- **rol**: `respaldo`
- **licencia**: `LICENSE_UNKNOWN`
- **proveedor canónico**: _ninguno — no puede producir un `Source` citable_

La autoridad sanitaria mexicana. Sin catalogar, pese a que el producto es para Mexico: la ficha oficial de un farmaco en Mexico no la da openFDA.

| Campo | Estado |
|---|---|
| Vía oficial de integración | **UNVERIFIABLE** |
| Clases de dato permitidas | **UNVERIFIABLE** |
| Admite PHI | **UNVERIFIABLE** |
| Modelo de credencial | **UNVERIFIABLE** |
| Derecho de caché | **UNVERIFIABLE** |
| Derecho de mostrar | **UNVERIFIABLE** |
| Cita profunda al original | **UNVERIFIABLE** |
| Expone versión/frescura | **UNVERIFIABLE** |
| Límites y SLA | **UNVERIFIABLE** |
| Precio | **UNVERIFIABLE** |
| Semántica de fallo | **UNVERIFIABLE** |
| Reuso en sistema generativo | **UNVERIFIABLE** |

### CENETEC (GPC de Mexico)

- **id**: `cenetec`
- **clase**: `guia_de_practica`
- **rol**: `respaldo`
- **licencia**: `LICENSE_UNKNOWN`
- **proveedor canónico**: _ninguno — no puede producir un `Source` citable_

Hoy es UN ENLACE A UNA BUSQUEDA DE GOOGLE presentado como boton. No es una fuente integrada y el catalogo no lo decia.

| Campo | Estado |
|---|---|
| Vía oficial de integración | **UNVERIFIABLE** |
| Clases de dato permitidas | **UNVERIFIABLE** |
| Admite PHI | **UNVERIFIABLE** |
| Modelo de credencial | **UNVERIFIABLE** |
| Derecho de caché | **UNVERIFIABLE** |
| Derecho de mostrar | **UNVERIFIABLE** |
| Cita profunda al original | **UNVERIFIABLE** |
| Expone versión/frescura | **UNVERIFIABLE** |
| Límites y SLA | **UNVERIFIABLE** |
| Precio | **UNVERIFIABLE** |
| Semántica de fallo | **UNVERIFIABLE** |
| Reuso en sistema generativo | **UNVERIFIABLE** |

## De dónde se baja evidencia, y de dónde no se baja nada

> Fuente de verdad: `src/lib/evidence-integrations/de-donde-se-baja.ts`.
> Un host que aparezca en el árbol y no esté aquí rompe el CI.

**Enlazar no es recuperar, y es casi lo contrario.** Un enlace manda al médico al
sitio del editor, bajo los términos del editor. Bajar esa misma URL desde el
servidor y quedarse con el HTML es tomar el material sin pasar por donde el editor
pone sus condiciones. La URL es la misma y el acto es el contrario.

| Host | Qué se hace | Qué | Por qué se puede |
|---|---|---|---|
| `eutils.ncbi.nlm.nih.gov` | **se baja** | Resúmenes, metadatos y —cuando el XML declara CC0 o CC-BY por artículo— el texto abierto. | E-utilities es la vía OFICIAL que NCBI publica para consultar PubMed por programa, con su límite de velocidad documentado (~3 req/s sin llave, ~10 con ella) que el cliente respeta. Usar el API en vez de la página es justamente lo contrario de saltarse la licencia. |
| `api.fda.gov` | **se baja** | La dosis de la etiqueta aprobada, para no depender de una cifra que dé el modelo. | openFDA es un API público del gobierno de EE. UU., gratis y sin llave, con su límite documentado. Los datos de etiquetado son de dominio público. |
| `api.anthropic.com` | **se baja** | Redacción y reformulación. Nunca una cita ni un dato de paciente. | Es el proveedor del modelo bajo su contrato de uso, no una fuente de evidencia. Aparece aquí porque vive en las rutas de evidencia y un host sin clasificar rompe el guardián — clasificarlo es decir que NO origina material citable: el modelo redacta y reformula lo que ya trajeron los otros dos. |
| `pubmed.ncbi.nlm.nih.gov` | sólo se enlaza | El registro del artículo, para abrirlo. | Es el enlace canónico al registro. Mandar al médico al sitio de NCBI es que lo lea donde su dueño lo publica y bajo sus términos. |
| `doi.org` | sólo se enlaza | El artículo en el sitio de su editorial, por su identificador estable. | El resolvedor de la DOI Foundation. Abre en el navegador del médico la página que el editor haya designado para ese artículo, bajo los términos de ese editor. No se le pide nada: se construye la URL y se pinta. |
| `www.accessdata.fda.gov` | sólo se enlaza | La ficha del fármaco en Drugs@FDA. | El buscador de la propia FDA. Se enlaza; no se le pide nada. |
| `www.google.com` | sólo se enlaza | Búsqueda de la Guía de Práctica Clínica del CENETEC, que no tiene API. | Una URL de búsqueda que abre el navegador del médico. Es su sesión y su navegador, no el servidor haciendo consultas: buscar por él sería, ahí sí, un raspado. |
| `www.ncbi.nlm.nih.gov` | sólo se enlaza | Nada: es documentación dentro del código. | Aparece en un comentario, explicando dónde se saca la llave de E-utilities. |
| `example.invalid` | no resuelve (pruebas) | Fuentes sintéticas de prueba. | Reservado por RFC 2606 para no resolver NUNCA. Es del adaptador sintético, y ahí está el punto: un host de pruebas que apuntara a algo real sería una llamada de verdad disfrazada de fixture. |

