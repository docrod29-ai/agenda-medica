# Evidence Integrations — arquitectura (issue #314)

Cómo Ausculta integra evidencia clínica actualizada **sin atarse a un proveedor
propietario, sin scraping y sin afirmar integraciones que no existen**.

Fuente de verdad de los requisitos: [#314](https://github.com/docrod29-ai/agenda-medica/issues/314)
y su comentario de checkpoint. Tablero: [#296](https://github.com/docrod29-ai/agenda-medica/issues/296).

---

## 1. La idea en una frase

> El repo ya sabía representar **evidencia anclada**. Lo que faltaba era
> representar **el acto de recuperarla** — y, sobre todo, **el acto de no haber
> podido**.

`src/types/evidence.ts` (unidad E2-01) ya hace cumplir, por compilador y por
runtime, que «una afirmación sin pasaje de respaldo no puede construirse». Este
carril **no lo reescribe**: lo usa, y le pone delante la capa que faltaba.

---

## 2. El defecto que motiva todo

Hoy, `src/app/api/consultor-evidencia/route.ts` llama a PubMed dentro de un
`try`. Si PubMed falla, el `catch` sigue adelante con menos artículos.

Nadie escribió una mentira. Y sin embargo el médico ve una respuesta más pobre y
**no puede distinguir estas dos frases**:

- «la literatura no dice nada sobre esto»
- «la literatura no se consultó»

Tienen consecuencias clínicas opuestas. La causa raíz es de tipos:
`buscarEvidencia` devuelve `ArticuloPubMed[]`, y **un array vacío es el mismo
valor para las dos cosas**. Ningún llamador puede distinguirlas porque el tipo
no las distingue.

---

## 3. El sobre de recuperación

```ts
type SobreDeRecuperacion = SobreConMaterial | SobreSinMaterial
```

Unión discriminada por `estado`. **`fuentes` sólo existe en el lado con
material**, así que esto no compila:

```ts
const sobre = await adaptador.recuperar(consulta, ctx)
sobre.fuentes            // ✘ Property 'fuentes' does not exist on SobreSinMaterial
```

Hay que estrechar:

```ts
if (tieneMaterial(sobre)) sobre.fuentes   // ✔
```

Ésa es la defensa estructural del punto 9 de #314. El modo de fallo real no es
escribir una mentira: es **leer un array vacío y pintarlo como «no hay
evidencia»**. Aquí no hay array vacío que leer.

### Seis estados, no dos

| Estado | Significa | ¿Se intentó? |
|---|---|---|
| `available` | contestó completo (puede ser con 0 resultados) | sí |
| `partial` | contestó, pero falta material — **y dice cuál** | sí |
| `unavailable` | no contestó (red, 5xx, timeout) | sí |
| `not_authorized` | contestó que **no** (401/403, cuota) | sí |
| `not_configured` | falta credencial, contrato o bandera | **no** |
| `not_permitted` | la política del repo lo impide | **no** |

Colapsarlos en «hubo/no hubo resultados» pierde justo lo que el médico necesita.

---

## 4. Rol: quién puede respaldar y quién sólo orientar

La decisión más importante del catálogo. Vive en `catalogo.ts` —no en cada
adaptador—, porque si cada adaptador declarara su rol, uno nuevo podría
declararse `respaldo` y saltarse la regla.

| Rol | Quién | Qué puede hacer |
|---|---|---|
| `respaldo` | PubMed, PMC, CDC, WHO, FDA… | sostener una afirmación clínica |
| `descubrimiento` | **Perplexity** | proponer términos y artículos candidatos |
| `conocimiento_personal` | **Obsidian** y equivalentes | dar contexto atribuido y fechado |

### Perplexity (#314 punto 7)

Una respuesta de Perplexity es **texto generado**. Aunque traiga enlaces, lo que
respaldaría la afirmación no es un pasaje de la fuente: es la paráfrasis del
modelo. Anclar un claim ahí sería fabricar respaldo con pasos extra.

Uso legítimo: sugerir por dónde buscar, o hacer de retador («¿qué se me
escapa?»). Lo que proponga **se recupera después de una fuente verificable**, y
es esa recuperación la que respalda.

**La regla vive en el servidor, no en un prompt:** `sobreConMaterial()` rechaza
con `ROL_NO_PUEDE_APORTAR_FUENTES` cualquier `Source` que venga por un rol que
no sea `respaldo`.

### Conocimiento personal (#314 punto 8)

Es donde vive lo que el médico sabe y no está en PubMed: sus esquemas, la
resistencia bacteriana de su hospital. A menudo es lo más útil que tiene.

Y es el adaptador más peligroso, por dos razones que se suman:

1. **Una nota vieja no se ve vieja.** Un resumen de PubMed lleva su año encima;
   una nota con una dosis que cambió en 2023 es, en texto plano, idéntica a una
   escrita ayer. Por eso `fechaDeAutoria` es **obligatoria** —una nota sin fecha
   se rechaza, no se importa con la fecha de importación— y su umbral de
   frescura es más estricto: **18 meses frente a 5 años**.
2. **Es el único proveedor que puede contener PHI.** Se asume que **sí** la
   contiene. Por eso el adaptador nunca sale a la red y aísla por consultorio en
   el servidor.

---

## 5. Licencias: el centinela `UNVERIFIABLE`

```ts
UNVERIFIABLE   // no se ha verificado desde este repositorio
```

**No significa «no». No significa «probablemente sí».** Significa que nadie con
acceso al portal del proveedor lo ha confirmado, y por tanto **no se puede
construir nada encima**. Es el equivalente legal de `NEEDS_CLINICAL_REVIEW`
(regla 1 de `.claude/rules/clinical-safety.md`), y por la misma razón: rellenar
un campo plausible no rompe ninguna prueba y acaba justificando una integración
que viola una licencia.

Cada proveedor lleva una matriz de **12 campos**. La tabla completa, generada
desde el código, está en
[`MATRIZ-CALIFICACION-PROVEEDORES.md`](MATRIZ-CALIFICACION-PROVEEDORES.md).

### La compuerta que hace innecesario un guardián

Una entrada de catálogo sin `proveedorCanonico` **no puede producir un
`Source`**. Sin `Source` no hay `Passage`; sin `Passage` no hay `Claim`.

> Un proveedor sin licencia verificada es, **por construcción**, incapaz de
> respaldar una afirmación clínica.

Hoy no lo tienen: `uptodate`, `openevidence`, `cochrane`, `perplexity`,
`conocimiento_personal`.

### Cochrane tiene TRES niveles, y confundirlos es la infracción

1. **Resumen estructurado y PLS** — indexados en MEDLINE, visibles sin
   suscripción.
2. **Revisión completa** — normalmente requiere suscripción.
3. **Reuso comercial o generativo** — permiso **aparte**, que **no** se obtiene
   por tener acceso de lectura.

Tener (1), o incluso (2), **no da (3)**.

Nota operativa: los resúmenes Cochrane **ya llegan hoy por PubMed**, con su cita
y bajo los términos de PubMed. Eso no es «integrar Cochrane»: es citar un
resumen indexado, y el adaptador lo dice con todas las letras para que nadie lo
confunda con una integración que no existe.

### UpToDate y OpenEvidence

- **UpToDate**: existen programas de integración institucional/EHR; lo
  `UNVERIFIABLE` son sus **términos**, no su existencia. Prohibido por #314 y
  ausente de este repo: scraping, credenciales compartidas, automatizar un
  navegador alrededor del control de acceso, copiar el corpus, o usar un
  endpoint no documentado.
- **OpenEvidence**: además de no tener vía verificada, **su salida es
  sintetizada**. Consumirla como «fuente» metería la síntesis de otro modelo
  dentro de la nuestra, y el pasaje que respaldaría un claim sería texto
  **generado**. Si algún día se integra, la recomendación técnica de este carril
  es que su rol sea `descubrimiento`, no `respaldo`.

**Guardián estructural:** `adaptadores/no-configurado.ts` no contiene ninguna
URL ni ningún `fetch`. No hay dónde meter un endpoint «sólo para probar», y una
prueba lo comprueba.

---

## 6. Retrieval no es síntesis

```
recuperar   → hecho verificable   («PubMed contestó a las 10:04 con 6 resúmenes»)
sintetizar  → redacción           («un modelo leyó esos 6 y escribió 3 frases»)
```

El defecto clásico es que la síntesis **arrastre autoridad** del retrieval: tres
frases bajo un encabezado que dice «según la literatura», con seis citas al pie
y sin que nadie haya comprobado qué frase se apoya en qué resumen.

`MapaDeSoporte` conserva las dos listas:

```ts
{ respaldadas: [...], sinRespaldo: [...], sobresSinAporte: [...] }
```

> **Una afirmación no respaldada no se borra: se marca.**
> Borrarla es lo mismo que fingir que nunca se dijo.

Y añade una comprobación que E2-01 no puede hacer: un pasaje puede ser literal y
aun así venir de un proveedor que no podía respaldar. Un `Source` no lleva
escrito de qué sobre salió; `CorpusParaSintesis` conserva esa procedencia.

`esRespuestaRespaldada()` es estricto a propósito: una respuesta con tres
afirmaciones buenas y una inventada **no** es una respuesta respaldada — es una
respuesta con una afirmación inventada dentro.

---

## 7. La evidencia nunca se convierte en acción clínica

Punto 4 de #314, y extensión de la regla del tablero #296 («historia ≠ plan ≠
receta»).

El fallo que esto previene no es que el médico se confunda: es que **un flujo
automático «ayude»**. Un botón de «aplicar sugerencia», un prellenado, un agente
que rellena el plan. Cada uno parece razonable por separado, y el resultado es
una receta que nadie decidió.

Lo máximo que produce la evidencia es una `PropuestaDeEvidencia`. Nótese lo que
**no** tiene: ni código CIE-10, ni dosis, ni vía, ni frecuencia. No es un
olvido — una propuesta con la dosis rellenada es una receta esperando un clic, y
un clic no es una decisión clínica.

Para ejecutarla hace falta `decisionDelMedico()`, que exige identidad y **acto
explícito**, y cuyo resultado lleva marca fantasma: **un flujo automático no
puede escribir el objeto a mano**. La mitad de compilación de esta garantía está
en `src/__tests__/tipos/evidence-integrations.tipos.ts`.

---

## 8. Frescura: las tres fechas que se confunden

| Campo | Qué es | ¿Existe? |
|---|---|---|
| `recuperadoEn` | cuándo lo bajamos | siempre |
| `publicado` | cuándo se publicó | casi siempre |
| `revisadoEn` | cuándo la fuente se revisó | casi nunca |

Un documento de 2016 recuperado hace un minuto es **material fresco de contenido
viejo**, y `recuperadoEn` no dice nada de eso.

**No hay umbral clínico inventado aquí.** No existe una respuesta general a
«¿cuántos años tiene que tener un artículo para estar obsoleto?»: depende del
campo. Los umbrales son **operativos** y están declarados como tales.

Tres decisiones que parecen detalles:

- una **revisión declarada** reciente gana a una publicación vieja (una guía de
  2016 revisada en 2026 es material vigente);
- el año se compara por su **31 de diciembre**, para no envejecer una fuente de
  gratis hasta doce meses;
- `indeterminada` es un veredicto de pleno derecho y **nunca suma a favor de la
  frescura**: un lote sin fechas da 0, no 1 (regla 4 de seguridad clínica —
  ausencia de dato no es dato de ausencia).

---

## 9. Caché

Dos prohibiciones distintas, y las dos importan:

- **legal** — cachear material propietario puede ser redistribución no
  autorizada, aunque la copia esté en nuestro servidor. Sin `derechoDeCache`
  **verificado**, no se cachea;
- **aislamiento** — una caché de resultados clínicos compartida entre
  consultorios es una fuga entre inquilinos con forma de optimización.

Detalle que evita el fallo real: una clave por inquilino a la que le falta
`clinicId` **falla**, no degrada a una clave global. Esa degradación silenciosa
es exactamente la fuga que la regla quería evitar.

---

## 10. Estado real

| Proveedor | Estado | Qué falta |
|---|---|---|
| **PubMed / MEDLINE** | operativo | — |
| Corpus sintético | operativo (pruebas y benchmark) | — |
| PMC, ClinicalTrials, WHO, CDC, FDA | en catálogo, sin adaptador | adaptador (el contrato ya existe) |
| **UpToDate** | `not_configured` | licencia + gasto |
| **Cochrane** | `not_configured` | licencia + gasto |
| **OpenEvidence** | `not_configured` | licencia + decisión de rol |
| **Perplexity** | `not_configured` | gasto (API de pago) |
| **Conocimiento personal** | contrato listo, sin importador | importador de bóveda |

**Ninguno de estos huecos bloquea el lanzamiento de Consultorio:** la evidencia
es opcional (`hayRespaldoOperativo()`), su ausencia se declara y no rompe nada.

Lo que este carril **no** hizo, y a quién le toca:
[`HANDOFF-ARCHIVOS-CENTRALES.md`](HANDOFF-ARCHIVOS-CENTRALES.md).

---

## 11. Cómo se prueba

```bash
npx vitest run src/__tests__/evidence-integrations-      # 88 casos, sin red, sin PHI
npx tsc --noEmit                                         # el gate de tipos
node scripts/evidence/matriz-proveedores.mjs --verificar  # el doc vs el catálogo
node scripts/evidence/benchmark-evidencia.mjs [--caida]   # el visor del benchmark
```

Los guardianes están **probados al revés**
(`.claude/rules/testing-gates.md`). Comprobado, no supuesto:

- desactivando `ROL_NO_PUEDE_APORTAR_FUENTES`, dos casos del golden del contrato
  se ponen rojos;
- desincronizando el documento de la matriz en un carácter, su guardián falla;
- invirtiendo la expectativa del caso adversarial del benchmark, el arnés falla.

El benchmark lleva dentro un caso cuya respuesta correcta es **«esta afirmación
NO está respaldada»**. Sin él, un arnés cuyos casos siempre pasan no distingue
«el sistema funciona» de «el sistema acepta cualquier cosa».

### Lo que NO se prueba, y hay que decirlo

- **calidad clínica** de la síntesis — un pasaje literal puede sostener una
  frase cierta pero inútil, o citada fuera de contexto. Eso lo juzga un médico y
  su sitio es `evals/`;
- **entailment semántico** — se comprueba literalidad, que es lo verificable por
  software;
- **latencia y costo reales** — el arnés mide la tubería, no la red. Para eso el
  sobre lleva `telemetria`;
- **los términos legales del catálogo** — nadie puede verificarlos desde un
  repositorio. Lo que se prueba es que lo no verificado **siga marcado** como no
  verificado.
