# Clinical Safety CI gate

> Unidad Nexus OS **E0-11**. Objetivo del backlog: *«El CI bloquea el merge si cae un
> invariante clínico o de seguridad.»*

## 1. Qué protege, exactamente

Un **invariante protegido** es un archivo de test cuya desaparición o desactivación
debe romper el CI. No es «todos los tests»: son los que respaldan una fórmula clínica
o cierran un incidente del regression-ledger.

La lista **no se escribe a mano** (una lista a mano se pudre). Se **deriva** de tres
fuentes que ya son la verdad del repo:

| Fuente | Dónde | Qué aporta |
|---|---|---|
| Golden de cada motor | `CLINICAL_ENGINE_REGISTRY[].goldenTests` (`src/lib/clinical/registry.ts`) | 65 archivos |
| Test permanente de cada incidente | `docs/audit/regression-ledger.md` | 14 archivos |
| Metagates | `METAGATES` en `src/lib/clinical/safety-gate.ts` | 3 archivos (los gates que se vigilan a sí mismos) |

Unión sellada al 2026-07-29: **78 archivos**.

## 2. Por qué hacía falta si el CI ya corría `vitest`

Porque `npx vitest run` mide **los tests que quedan**, no **los que deben existir**.
Antes de esta unidad el CI seguía verde si alguien:

- borraba `clinical-safety-harness.test.ts` (43 valores exactos de CKD-EPI, MELD, FIB-4, SOFA…),
- le ponía `describe.skip` al bloque de dosis pediátrica,
- o dejaba un `it.only` que excluía al resto del archivo,
- o vaciaba un archivo dejando un `it` verde.

Los cuatro ataques quedan cerrados por las aserciones 1–3 de §4.

## 3. Piezas

| Archivo | Rol |
|---|---|
| `src/lib/clinical/safety-gate.ts` | Núcleo **puro**: deriva el conjunto, regex de desactivación, conteo de casos. No lee disco. |
| `src/lib/clinical/invariantes-clinicos.json` | El **sello congelado**: la lista derivada + `minCasos` por archivo + `totalCasos`. |
| `src/__tests__/clinical-safety-gate.test.ts` | El **metagate**: 6 bloques de aserciones (§4). |
| `scripts/invariantes-clinicos.mjs` | Runner del job de CI: imprime las rutas del sello. Sin dependencias, sin transpilar TS. |
| `.github/workflows/ci.yml` → job `clinical-safety` | El check con **nombre estable** que se exige en la protección de rama. |

## 4. Las 6 aserciones

| # | Aserción | Ataque que cierra |
|---|---|---|
| 1 | Cada archivo del sello **existe** | borrar el golden de un motor |
| 2 | Ningún archivo del sello contiene `.skip` / `.only` / `.todo` / `xit` / `xdescribe` | apagar un invariante sin borrarlo |
| 3 | `contarCasos(archivo) >= minCasos` y `Σ >= totalCasos` | vaciar un archivo dejando un `it` verde |
| 4 | Todo `goldenTests` del registro y todo test citado en el ledger está en el sello — y el sello no protege basura huérfana | registrar un motor nuevo cuyo golden nadie protege |
| 5 | `ci.yml` contiene el job `clinical-safety` y el paso que corre el manifiesto | quitar el gate en el mismo PR que rompe el invariante |
| 6 | **Autotest**: las regex detectan `it.skip(` / `describe.only(` y **no** disparan con `it('no salta pasos', …)` | un gate de cartón que parece proteger y no protege |

La aserción 5 es la que hace el gate **autoprotegido**: el metagate corre dentro del
job `verificar` (suite completa), así que tocar el YAML para saltarse `clinical-safety`
rompe el propio `verificar`.

## 5. El trinquete aquí es MONÓTONO (y en E0-03 es exacto). Por qué

`adr-cobertura.ts:33` usa comparación **exacta** porque vigila **un** número: si la
deuda de ADRs baja, se aprieta la tuerca y ya. Aquí serían **78 números**, y la
comparación exacta cobraría peaje en cada PR clínico que añade un `it`.

Decisión consciente: **falla si baja** (o si el archivo desaparece); **subir es libre**.
La cobertura puede crecer sin tocar el JSON; solo se edita cuando baja, y entonces la
baja tiene que estar justificada.

## 6. Cuando el gate cae

Hay **tres** salidas legítimas. Bajar el número «para pasar el CI» **no es una de ellas**.

1. **Arreglar el código.** Es el caso normal: el invariante cayó porque una fórmula,
   una dosis o una regla cambió de resultado. El hallazgo es el cambio, no el test.
2. **Justificar la baja de cobertura en el ledger.** Si un refactor fusionó casos
   legítimamente (p.ej. 4 `it` se convirtieron en un `it.each`), se baja `minCasos`
   de ese archivo **y** se abre una entrada `REG-xxx` en `docs/audit/regression-ledger.md`
   que diga qué se fusionó y por qué la cobertura real no bajó.
3. **ADR si el invariante era incorrecto.** Si el test fijaba un valor equivocado, se
   corrige el test y se escribe/actualiza el ADR del motor en `docs/clinical-decisions/`,
   citando la fuente publicada. **Nunca** se cambia un valor golden sin ADR.

Casos concretos:

- **Aserción 1 (archivo borrado):** si se **renombró**, actualiza la ruta en el sello
  *y* en la fuente que lo cita (`registry.goldenTests` o el ledger). Si se **eliminó**,
  el motor o el REG-xxx se quedó sin prueba — eso es el hallazgo.
- **Aserción 4 (motor nuevo sin proteger):** añade la ruta al sello con su `minCasos`
  medido y súmalo a `totalCasos`. El mensaje de fallo dice qué motor y qué ruta.

## 7. Lo que este gate NO puede hacer desde el repo

El criterio literal —«no puede **mergearse**»— **lo decide GitHub, no el CI**. Sin
protección de rama, un PR con el gate en rojo se mergea igual: el gate *avisa*, no
*bloquea*. Los cuatro ajustes que faltan (consola de GitHub, los hace el dueño del
repo) están en `docs/pendientes-externos.md` → «Protección de rama».

**Estado honesto:** el código de esta unidad está completo y verificado; el criterio
de aceptación se cierra del todo cuando el Dr. active la protección de rama.

## 8. Límites conocidos (declarados, no descubiertos después)

- Las regex están **ancladas a inicio de línea** y son una **cota, no un parser de
  TypeScript**: un `it` generado en runtime no se cuenta, y una desactivación escrita
  de forma exótica podría escaparse. El objetivo es que apagar un invariante exija un
  acto **visible en el diff**, no ser infalible contra un adversario interno.
- `contarCasos` cuenta `it` / `test` / `it.each` declarados; **no** expande las tablas
  de `.each`. Por eso `minCasos` siempre es menor que el número de tests que reporta
  vitest, y eso es correcto: ambos lados de la comparación usan la misma cota.
