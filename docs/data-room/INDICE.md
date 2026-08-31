# Sala de datos — NexusMED

**Formato**: §N3 del charter Master Loop V7.
**Abierto**: 6-ago-2026. **Última verificación**: 6-ago-2026

---

## Para qué existe este documento

Un comprador estratégico, un socio hospitalario o un auditor no piden una demo:
piden **evidencia**. Esta carpeta es el índice de lo que se puede enseñar, con la
diferencia —que aquí importa más que el contenido— entre:

| Marca | Significa |
|---|---|
| ✅ **VERIFICADO** | existe en el repositorio y se comprobó hoy, con el comando que lo comprueba |
| 🟡 **PARCIAL** | existe pero incompleto; se dice qué falta |
| ⬜ **NO EXISTE** | no está. Se dice, en vez de dejar el hueco callado |
| 👤 **DEL DUEÑO** | depende de una acción o un dato del médico dueño, no del código |

**§N5 del charter: nada de tracción falsa.** En este documento no hay
testimonios, ni usuarios, ni hospitales clientes, ni resultados clínicos que no
se puedan sostener. Un dato inflado en una sala de datos no es marketing: es lo
que hunde una operación cuando el comprador lo verifica.

---

## 1 · Corporativo y propiedad intelectual

| Punto | Estado |
|---|---|
| Constitución de la sociedad | 👤 **DEL DUEÑO** |
| Titularidad del código | 👤 **DEL DUEÑO** — el repositorio está bajo la cuenta personal `docrod29-ai`; un comprador exigirá que pertenezca a la sociedad |
| Cesión de derechos de colaboradores | ⬜ **NO EXISTE** |
| Registro de marca (IMPI) | 👤 **DEL DUEÑO** — mencionado en `docs/` de endurecimiento, sin constancia |
| Registro de obra (INDAUTOR) | 👤 **DEL DUEÑO** |

> **Lo más urgente de esta sección** es la titularidad. Un producto médico cuyo
> código está a nombre de una persona física y no de la sociedad que se vende es
> el primer bloqueo en cualquier diligencia debida.

---

## 2 · Licencias de terceros y SBOM

✅ **VERIFICADO** el 6-ago-2026.

```
Dependencias directas: 40 (24 de producción + 16 de desarrollo)

  29  MIT
   9  Apache-2.0
   1  ISC
   1  BSD-2-Clause

  Copyleft fuerte (GPL / AGPL / SSPL / BUSL): NINGUNA
```

**Por qué importa** — Una AGPL o una SSPL en la cadena de un producto SaaS médico
obliga a publicar el código o a renegociar la licencia. No haberla es un requisito
de compra, no una virtud.

**Cómo se vuelve a comprobar** — El comando está en
`scripts/data-room/licencias.mjs`. Un comprador puede correrlo él mismo.

🟡 **Falta**: SBOM formal (CycloneDX o SPDX) del árbol completo, no sólo de las
directas. `package-lock.json` está en el repositorio y lo permite generar.

---

## 3 · Arquitectura

| Documento | Estado |
|---|---|
| `CLAUDE.md` — misión, invariantes, mapa | ✅ existe |
| `docs/architecture/` | ⬜ **VACÍA** |
| Registros de decisión (ADR) | 🟡 **4 escritos** en `docs/decisions/` (una fuente de verdad · el LLM no calcula · sello versionado · tres niveles de aviso). Faltan tres decisiones ya tomadas y sin ADR. |
| Modelo de datos | 🟡 en `src/types/` con comentarios extensos; sin documento |

**Lo que sí se puede enseñar hoy**: el invariante de arquitectura del charter —un
paciente, un expediente longitudinal, un modelo de medicamento, muchas vistas—
está sostenido en el código y probado.

---

## 4 · Seguridad

✅ **VERIFICADO** — `docs/security/` tiene seis documentos:

- `backup-and-restore.md`
- `incident-response-plan.md`
- `matriz-acceso-phi.md`
- `mfa-design.md`
- `patient-magic-link.md`
- `pentest-readiness.md`

✅ **CI con puerta de aislamiento entre consultorios** (`aislamiento-tenant`),
que corre en cada PR.

⬜ **Pentest externo: NO REALIZADO.** El charter (§N5, día 5) prohíbe
explícitamente afirmar lo contrario. Hay preparación documentada; no hay informe.

👤 **DEL DUEÑO**: App Check en modo *enforce*, backups con PITR verificados,
rotación de credenciales.

---

## 5 · Validación clínica

✅ **VERIFICADO**:

| | |
|---|---|
| Registro de peligros (§18) | `docs/clinical-safety/REGISTRO-DE-PELIGROS.md` — **10 peligros**, ninguno hipotético |
| Registro de regresiones | `docs/audit/regression-ledger.md` — **269 REG** con causa raíz |
| Invariantes sellados | **427 archivos, 6156 casos** que no pueden encoger |
| Suite completa | **10 431 pruebas** en verde, en CI |

⬜ **Lo que NO hay**: estudio de validación clínica con pacientes reales,
comité de ética, ni aprobación regulatoria. **Ninguna de las diez casillas de
aprobación del registro de peligros está firmada** — corresponden al médico
responsable.

---

## 6 · Medición de la IA (el activo diferencial)

Esto es lo que un comprador **no puede replicar llamando a otra API**, y por eso
es la sección que más pesa en una valoración.

✅ **VERIFICADO**:

| Métrica | Valor medido | Dónde |
|---|---|---|
| WER en crudo | **25,55 %** | `docs/voice/WER-MEDIDO.md` |
| WER con el pipeline | **22,81 %** | idem |
| Foso de vocabulario | 78,89 % → 80,90 % (catálogo) → **82,91 %** (expediente) | `docs/voice/SESGO-MEDIDO.md` |
| Corpus de temporalidad | **32 frases** de consulta mexicana, 30/30 | `corpus-oro-temporalidad.test.ts` |
| Corpus de negación | **21 casos** de habla real | `como-se-dice-que-no-en-una-consulta.test.ts` |

**Por qué esto es el foso** — Los números no son buenos por sí solos; lo valioso
es que **existen y son reproducibles**. Un competidor con el mismo modelo no
tiene el corpus mexicano, ni la taxonomía de correcciones, ni la traza de qué
falla y por qué.

🟡 **Falta**: el corpus de 6 000 audios (`EVAL-001`) sigue sin transcribirse
entero; está bloqueado por presupuesto de transcripción.

---

## 7 · Métricas de negocio

⬜ **NO EXISTEN en este repositorio.**

El charter §N1 pide médicos activos, activación, conversión, retención, churn,
MRR, ARR, margen de contribución y coste por consulta. Hay infraestructura de
cobro y un libro de costos, pero **no un tablero de métricas de negocio**, y
ninguna cifra se puede afirmar hoy.

👤 **DEL DUEÑO**: los datos de Stripe y el número real de médicos usando el
producto.

---

## 8 · Historial de incidentes

✅ El `regression-ledger` **es** el historial: 269 defectos con su causa raíz, su
reparación y su prueba de regresión permanente.

**Es un activo, no un pasivo.** Un comprador que ve 269 defectos documentados con
su causa raíz aprende más del rigor del equipo que uno que ve una lista vacía —
que sólo significa que nadie los estaba buscando.

---

## Resumen honesto para una diligencia debida

**Fuerte**: seguridad documentada, aislamiento probado en CI, 10 431 pruebas,
métricas de IA reales y reproducibles, historial de defectos con causa raíz,
licencias limpias.

**Débil**: titularidad del código en persona física, sin pentest externo, ADR
incompletos, sin métricas de negocio, sin validación clínica formal.

**El bloqueo número uno** no es técnico: es que **el código pertenezca a la
sociedad y no a una persona**.
