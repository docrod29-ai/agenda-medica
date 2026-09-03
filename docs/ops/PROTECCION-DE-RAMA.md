# Protección de la rama `main` — qué se exige y por qué

> **Estado**: configurado y **comprobado en la consola el 2-sep-2026** por el
> dueño. El ruleset se llama `main protegida`, está `Active`, apunta a `main`,
> su lista de excepciones está **vacía**, y exige los tres checks de abajo más
> «Require branches to be up to date before merging».
>
> Qué exige un ruleset **no se puede leer desde este repositorio**: la API dice
> `protected: true` y no dice de qué. Por eso este archivo declara la
> configuración acordada y la fecha en que se miró.

## Por qué existe este archivo

`docs/pendientes-externos.md` §3 daba la instrucción en prosa y **le faltaban
tres de los cinco nombres**, incluido el único que no coincide con el id de su
job. Un nombre mal escrito en un ruleset no falla como se espera: GitHub se queda
esperando un check que nadie va a reportar nunca y **bloquea todos los PRs para
siempre**. Es el mismo tipo de fallo que REG-506 — la configuración parece
correcta leyéndola y no hace lo que dice.

## Los cinco checks que corren en cada PR, con el nombre que REPORTAN

Derivados de `.github/workflows/ci.yml`, no de memoria. El `name:` de un job, si
existe, **sustituye** al id a la hora de exigirlo:

| Job (id) | Nombre que llega a GitHub | Determinista | ¿Se exige? |
|---|---|---|---|
| `clinical-safety` | `clinical-safety` | sí | **sí** |
| `verificar` | `verificar` | sí | **sí** |
| `lint` | **`lint (trinquete)`** | sí | **sí** |
| `aislamiento-tenant` | `aislamiento-tenant` | emulador + Java | no |
| `e2e-publico` | `e2e-publico` | navegador | no |

Ninguno lleva `continue-on-error`, así que los cinco bloquean de verdad si se
exigen. El guardián
`src/__tests__/la-proteccion-de-rama-exige-checks-que-existen.test.ts` falla si
alguien renombra uno de los tres exigidos.

## Por qué los otros dos NO se exigen

No es dejadez: lo dice el propio `ci.yml`, que separó `aislamiento-tenant` a
propósito. Si el emulador falla por Java, por la red o por un puerto ocupado, su
rojo significaría dos cosas distintas —«se rompió un invariante clínico» y «el
emulador tuvo un mal día»— y **un check que se pone rojo por infraestructura
enseña a saltárselo**. Lo mismo con `e2e-publico` y el navegador.

Siguen corriendo en cada PR y siguen siendo información. Lo que no hacen es
bloquear el merge.

**Qué NO cubre esta decisión, declarado**: un PR que rompa el aislamiento entre
consultorios o el camino público **puede fusionarse** con esos dos en rojo si
alguien no los mira. La defensa ahí es la revisión, no la compuerta.

## La configuración, para comprobarla o rehacerla

`github.com/docrod29-ai/agenda-medica` → **Settings → Rules → Rulesets**, sobre
`main`:

1. **Require a pull request before merging** — sin esto, un `push` directo a
   `main` es una puerta trasera que salta todo lo demás.
2. **Require status checks to pass** → añadir **exactamente** estos tres,
   copiados tal cual:
   - `clinical-safety`
   - `verificar`
   - `lint (trinquete)`
3. **Require branches to be up to date before merging** — evita el merge que
   rompe el invariante sólo al combinarse con lo que ya está en `main`.
4. **Require review from Code Owners** — **NO se activa. Cerraría `main` para
   siempre.** Ver «El paso 4 que este archivo mandaba dar» más abajo: es un
   defecto de este propio documento, corregido en REG-510.
5. **Do not allow bypassing the above settings**, incluyendo administradores. Sin
   esto el dueño se salta su propio gate sin querer.

**Se comprobó antes de quitar el bypass**: ni un workflow ni un script empujan
directo a `main`. Todo entra por PR, así que el paso 5 no rompe el bucle
autónomo.

## Cómo se comprueba que quedó bien

Leer el ruleset no basta —un nombre puede estar escrito y no corresponder a nada—.
La comprobación real es de comportamiento, y son dos:

1. Abrir un PR cualquiera y ver que los tres checks aparecen listados como
   **Required**, no sólo como ejecutados.
2. Que el botón de merge esté **gris** hasta que los tres estén verdes.

Si un check exigido se queda en «Expected — Waiting for status to be reported» y
no arranca nunca, el nombre está mal escrito: cotéjelo contra la tabla de arriba.

## El paso 4 que este archivo mandaba dar — REG-510

Hasta el 2-sep-2026 este documento pedía activar **Require review from Code
Owners**, y `docs/pendientes-externos.md` §3 lo repetía diciendo que «ya no es
opcional». Seguirlo habría **bloqueado el repositorio entero**.

**Los tres hechos, medidos ese día contra la API de GitHub:**

| Hecho | Valor |
|---|---|
| Colaboradores del repositorio | **uno**: `docrod29-ai`, admin |
| Dueños que declara `.github/CODEOWNERS` | **uno**: `@docrod29-ai` |
| Autor de los PR (los abre Claude Code con la identidad del dueño) | `docrod29-ai` |

**GitHub no permite que el autor de un PR lo apruebe.** Con esos tres hechos, la
casilla exige una aprobación de `@docrod29-ai` sobre PRs de `@docrod29-ai`: una
condición que **nadie puede satisfacer**. Y como la lista de excepciones está
vacía —correctamente, es el paso 5—, tampoco habría forma de saltársela.

Todo PR que tocara `/src/lib/clinical/`, `/src/lib/expediente/`,
`/src/lib/seguridad/`, `firestore.rules` o `ci.yml` habría quedado inmergeable de
forma permanente. El síntoma —«no puedo fusionar nada»— no se parece en nada a la
causa, que es exactamente la forma de fallo que este archivo nació para evitar
(el nombre `lint` mal escrito). Se repitió el patrón un párrafo más abajo.

**Es la misma familia que REG-506**: una configuración que se lee correcta y no
hace lo que dice. Y la misma lección que el nombre del check: *lo que parece una
casilla de cumplimiento es una condición que alguien tiene que poder cumplir*.

### Qué protege la revisión clínica mientras tanto, dicho como es

**Nada automático.** El CI comprueba que los invariantes sigan encendidos; **no
puede juzgar si un umbral clínico nuevo es correcto**. Eso sólo lo puede hacer el
médico, y hoy lo hace **fuera de GitHub**: nada se fusiona hasta que él lo dice.
Es una garantía de proceso, no de compuerta, y se declara así en vez de fingir
que una casilla la cubre.

**Cuándo se activa la casilla**: el día que exista en el repositorio **una segunda
persona** que sea code owner y pueda aprobar lo que el dueño escribe. Ese día
esta línea cambia y el guardián de abajo deja de exigir su ausencia.
