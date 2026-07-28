# Punto de retomada — 2026-07-28 (tarde)

Todo commiteado. Nada depende del chat: este archivo y `estado.json` bastan.

## Estado del repo

- `git status` limpio · `tsc` 0 errores · **1989 / 1989 tests** · build OK
- Producción: **SW v700** en `agenda-medica-one.vercel.app`
- Último commit: `revert(nexus-os E0-03): retirar el gate parcial…`

## LO MÁS IMPORTANTE DE HOY

**El Dr. contestó las 25 preguntas clínicas.** Está en
`docs/clinical-decisions/DECISIONES-2026-07-28.md` — **documento canónico**: el software
lo implementa, no lo reinterpreta. Cambiar cualquiera de esos criterios exige una nueva
decisión firmada del médico, no una decisión de ingeniería.

Trae además **5 principios transversales** que aplican a todo el sistema y que reencuadran
trabajo ya hecho:

1. Dato original ≠ interpretación derivada (`rawValue` / `effectiveValue`).
2. No existe un `hardMaxDose` universal.
3. **UNKNOWN ≠ NORMAL ≠ SUSCEPTIBLE ≠ SAFE.** Toda regla devuelve
   `PASS | WARN | BLOCK | UNKNOWN | NOT_APPLICABLE`.
4. El LLM no decide hechos deterministas de seguridad.
5. Toda recomendación debe poder reconstruirse.

> **Deuda que esto crea:** el motor de dosis que se cerró hoy (E0-02) devuelve alertas, no
> `PASS|WARN|BLOCK|UNKNOWN|N/A`. Funciona, pero no habla el idioma del principio 3. Hay
> que migrarlo.

## Desplegado hoy

| Versión | Qué |
|---|---|
| v691–v692 | Grupo E + números dictados UCI + PHI homónimos + firma bloqueada |
| v693–v697 | Papel de receta: 25×15, 23×13, 13×23 vertical y personalizado; fix «sale descuadrada» |
| v698–v699 | Guía de configuración de receta en pantalla + guía/bot; firma y hoja de notas movidas a «Recetas, órdenes y notas» |
| **v700** | **E0-02 cerrada:** amoxicilina en 3 niveles + redondeo que no viola topes |

## Nexus OS — 2 / 68

- **E0-01** ✅ receta/QR desde la nota autoritativa
- **E0-02** ✅ invariantes de dosis pediátrica (cerrada con la decisión del Dr.)
- **E0-03** ⬜ **pendiente** — el workflow la dejó a medias y se retiró su gate parcial
- **E0-04**, **E0-09** — tienen `RESULTADO.json`; revisar si su trabajo quedó completo

### Aviso para cuando se rehaga E0-03

El gate de cobertura exigía un ADR por motor y recorría `docs/clinical-decisions/`
completo. Ahí ahora viven también las **decisiones clínicas del Dr.**, que NO son ADRs de
motor. El gate debe excluirlas (`DOCS_NO_ADR`), o volverá a caerse.

## SIGUIENTE PASO: E0-15 (antibiograma)

Es lo que estaba por empezar. Ya tiene las 4 respuestas del Dr.:

| | Qué implementar |
|---|---|
| **a** | `effectiveAST` canónico en TODAS las salidas, conservando `rawAST`. En pantalla: «Laboratorio: S · Interpretación Nexus: R por [regla/versión]». El Dr. lo marcó como **defecto P0** si una pantalla muestra R y el LLM razona con S |
| **b** | `MISSING → UNKNOWN`. Nunca MBL, NOM-045 ni aislamiento por un dato faltante |
| **c** | La CMI deja de ser número y pasa a `{operator, value}` **en el parser**, antes del motor CLSI/EUCAST |
| **d** | Carbapenémico + alergia a penicilina: `CRITICAL` → `WARN`, con excepciones SCAR (SJS/TEN, DRESS, AGEP grave), daño de órgano y alergia al propio carbapenémico |

**Restricción del Dr. que hay que respetar:** NO copiar breakpoints CLSI desde respuestas
de IA al código — por derechos de autor y porque un breakpoint mal copiado es un error de
seguridad silencioso. Se construye la arquitectura (operador de CMI, raw/effective,
UNKNOWN) y los valores entran desde fuente licenciada versionada con `sourceHash`.
Estándares vigentes: **CLSI M100-Ed36** (26-ene-2026) y **EUCAST v16.1** (24-jun-2026).

## Pendientes del Dr. (no código)

1. **WhatsApp** — darse de alta en 360dialog con un número aparte, y pasar `API token` +
   `Phone Number ID`. Es lo único que frena bot, recordatorios y plantillas.
2. **Política de anticipo** — Stripe ya está configurado en producción; falta decidir a
   quién se le cobra anticipo.
3. App Check → Enforce · CSP enforce · Playwright · pentest.
4. Facturación CFDI: sin llaves de Facturama configuradas.
