# Compuerta de integración — un solo push, y verde

Nace el 27-ago-2026, después de que la integración de cuatro lotes dejara un
Preview de Vercel en rojo sobre un estado que nadie había construido.

## Qué pasó

Cuatro merges remotos consecutivos, con cuatro minutos entre el primero y el
último:

| hora | commit | qué era | Preview |
|---|---|---|---|
| 06:38 | `1d9a55f3` | Patient Experience, WhatsApp y lista de espera | **ROJO** |
| 06:39 | `ffc21823` | H-01 autoridad de prescripción | verde |
| 06:41 | `fa346c4b` | H-03–H-07 recuperación de consulta | verde |
| 06:43 | `47e2a01d` | REG-323–REG-330 renumerados | verde |

Cada push disparó un Preview. `1d9a55f3` no compilaba:

```
src/lib/firestore.ts(246,14): error TS2304: Cannot find name 'idIdempotente'.
src/lib/firestore.ts(246,54): error TS2304: Cannot find name 'claveDeEspera'.
src/lib/firestore.ts(249,9):  error TS2304: Cannot find name 'runTransaction'.
```

El merge se quedó con la **llamada** de una rama y con los **imports** de la
otra. Las líneas no se solapaban, así que `git` fusionó limpio y no dijo nada.

> Un conflicto semántico no lo caza `git`: lo caza el compilador.

## Lo que de verdad duele

Lo que puso el semáforo en verde a las 06:39 **no fue arreglar los tres
imports**. Fue que el merge siguiente **revirtió la rama entera**: se fueron con
ella `createWaitlistEntry` idempotente, `src/lib/whatsapp/lista-espera.ts`,
`src/lib/paciente/urgencia.ts` y cinco archivos de prueba — entre ellos los dos
que sellaban REG-326 («entrar a la lista de espera una sola vez»).

El verde se compró **tirando el trabajo**, y nadie lo vio, porque el semáforo
sólo mira el último commit.

Es la lección de `.claude/rules/el-dato-tiene-que-llegar.md` aplicada a una
integración: que el commit sea ancestro **no** significa que su contenido siga
vivo.

## El procedimiento

La integración de varios PR **no** se hace con merges remotos consecutivos.
Se hace en local y se publica una sola vez.

```bash
# A · rama de integración LOCAL (no se empuja todavía)
git checkout -B integracion/<lote> origin/main

# B · aplicar TODOS los commits/PR previstos
git merge --no-ff origin/<rama-1>
git merge --no-ff origin/<rama-2>
#   … el lote entero, aquí, sin publicar nada

# C · resolver conflictos
# D · regenerar derivados

# E+F · la compuerta entera
node scripts/compuerta-integracion.mjs --manifiesto ops/integracion/<lote>.json

# G · UN push, ya en verde
git push -u origin integracion/<lote>
```

`node scripts/compuerta-integracion.mjs` corre, en este orden y parando en el
primer rojo:

| paso | qué comprueba |
|---|---|
| **A** | rama con nombre, no `main`, árbol limpio; dice cuántos commits quedan por publicar |
| **B** | cada commit del manifiesto es ancestro **y** los símbolos declarados siguen vivos |
| **C** | sin rutas sin fusionar, sin marcadores de conflicto |
| **D** | derivados regenerados (`version-sw`) y árbol limpio después |
| **E** | `npx tsc --noEmit` · `npx vitest run` · `lint-trinquete` · `git diff --check` |
| **F** | `scripts/preview-equivalente.mjs` — el build equivalente al Preview |
| **G** | imprime el único `git push` permitido. **Nunca empuja.** |

### Por qué `tsc --noEmit` va antes que el build

`next build` typechequea lo que entra en el grafo del build; **no mira las
pruebas**. REG-326 ya documentó un `tsc` rojo que el build no veía. Los dos,
siempre — igual que exige `.claude/rules/testing-gates.md`.

### Por qué hay UN solo build, y es el equivalente al Preview

`npm run build` en esta máquina hereda el entorno de quien lo lanza. Si hay un
`.env.local` (gitignoreado) con las `NEXT_PUBLIC_FIREBASE_*`, pasa. El Preview
de Vercel no tiene ese archivo.

Está medido: `47e2a01d` construido **sin** esos seis nombres muere con
`auth/invalid-api-key` recolectando `/dr/[clinicId]`. Es el mismo accidente que
documenta REG-059 — «en Vercel no se notaba porque ahí sí existen: el build
funcionaba **por accidente**».

Por eso `scripts/preview-equivalente.mjs` **friega** el entorno y lo reconstruye
desde `ops/vercel/preview-env.manifest.json`, y por eso la compuerta **no**
tiene además un `npm run build` a secas: tenerlo invitaría a creer que su verde
vale lo mismo. `src/__tests__/la-compuerta-de-integracion-no-se-ablanda.test.ts`
vigila que nadie lo reintroduzca.

## Variables de entorno: sólo NOMBRES

`ops/vercel/preview-env.manifest.json` declara **nombres**, nunca valores.

- **Seis públicas que el build exige** — las `NEXT_PUBLIC_FIREBASE_*`. No son
  secretas por diseño: viajan dentro del bundle a todos los navegadores. Lo que
  protege los datos son las Firestore Rules y App Check. La compuerta les
  inventa un relleno con forma válida, de un proyecto que no existe.
- **Públicas opcionales** — el código las lee y tolera su ausencia.
- **Secretos** — la compuerta **no inyecta ninguno**. Un build que necesita un
  secreto es un build ejecutando código de servidor al compilar: eso es un
  defecto del árbol, y se reporta por el **nombre** de la variable, nunca por su
  valor.

Cambiar una Preview Environment Variable en Vercel es del dueño. Ni la compuerta
ni ningún agente las tocan.

## Lo que esta compuerta NO hace

- **No silencia a Vercel.** No desactiva Previews, no escribe `ignoreCommand`,
  no apaga la integración de GitHub. Un Preview que no se construye no sale
  rojo, y tampoco protege de nada.
- **No sustituye al Preview real.** Cubre compilación, tipos y el desnivel de
  entorno — lo que rompió el 27-ago. Cabeceras, rewrites del edge y runtime
  siguen siendo del Preview, y las cabeceras de **producción** se comprueban
  después de publicar (`.claude/rules/deployment-and-flags.md`).
- **No empuja, no fusiona, no despliega.** Llega hasta el `git push` impreso.
  Fusionar a `main` y desplegar siguen siendo del dueño.
- **No lee Vercel.** No tiene credenciales y no debe tenerlas.
