/**
 * GATE DEL COMPILADOR de #314 — NO es un test de vitest.
 *
 * La mitad de compilación de la aceptación del carril de integraciones de
 * evidencia se escribe aquí, con el mismo mecanismo que
 * `src/__tests__/tipos/evidence.tipos.ts` (E2-01): cada caso lleva
 * `@ts-expect-error`, y si alguno DEJARA de fallar, TypeScript emite
 * `TS2578 Unused '@ts-expect-error' directive` y tumba `npx tsc --noEmit` y
 * `npm run build`. Ese es el mecanismo, no un `expect()`.
 *
 * Termina en `.tipos.ts` a propósito: NO empareja con el `include` de vitest
 * (`src/__tests__/**\/*.test.ts`) pero SÍ con el `**\/*.ts` de tsconfig.
 *
 * LO QUE SE AFIRMA AQUÍ, y que ningún test de runtime puede afirmar:
 *
 *   1. NO SE PUEDE LEER `fuentes` DE UN SOBRE QUE NO CONTESTÓ. No es que
 *      devuelva vacío: es que la propiedad no existe en ese lado de la unión.
 *      Ésta es la defensa estructural del punto 9 de #314 — «jamás fingir que
 *      un proveedor fue consultado» —, porque el modo de fallo real no es
 *      escribir una mentira, es leer un array vacío y pintarlo como «no hay
 *      evidencia».
 *
 *   2. NO SE PUEDE FABRICAR UN SOBRE A MANO. La marca fantasma no se exporta,
 *      así que la única puerta son las fábricas, que son las que validan.
 *
 *   3. NO SE PUEDE FABRICAR UNA ACCIÓN CLÍNICA AUTORIZADA. Un flujo automático
 *      no puede escribir el objeto y saltarse `decisionDelMedico`.
 *
 * Su integridad la vigila el guardián de
 * src/__tests__/evidence-integrations-contrato.test.ts.
 */
import {
  sobreConMaterial, sobreSinMaterial,
  type SobreDeRecuperacion, type SobreSinMaterial, type SobreConMaterial,
} from '@/lib/evidence-integrations/contrato'
import {
  decisionDelMedico,
  type AccionAutorizada, type PropuestaDeEvidencia,
} from '@/lib/evidence-integrations/compuertas'

// ── Fixtures SINTÉTICOS (cero PHI, cero red) ────────────────────────────────

const rCaido = sobreSinMaterial({
  proveedor: 'pubmed', estado: 'unavailable',
  intentadoEn: '2026-08-22T10:00:00.000Z', correlacion: 'corr-0001-abcd',
  telemetria: { latenciaMs: 30_000 },
  motivo: 'PubMed no respondió a esta búsqueda.', clase: 'timeout',
})
if (!rCaido.ok) throw new Error('fixture inválido')
const caido: SobreSinMaterial = rCaido.valor

const rVacio = sobreConMaterial({
  proveedor: 'pubmed', estado: 'available',
  intentadoEn: '2026-08-22T10:00:00.000Z', correlacion: 'corr-0001-abcd',
  telemetria: { latenciaMs: 120 }, fuentes: [],
})
if (!rVacio.ok) throw new Error('fixture inválido')
const vacio: SobreConMaterial = rVacio.valor

const cualquiera: SobreDeRecuperacion = Math.random() > 2 ? caido : vacio

// ═══════════════════════════════════════════════════════════════════════════
// CASOS QUE DEBEN FALLAR LA COMPILACIÓN
// ═══════════════════════════════════════════════════════════════════════════

// 1. Un sobre que NO contestó no tiene fuentes que leer. Éste es EL caso: hoy,
//    con `ArticuloPubMed[]`, esta línea compilaría y devolvería `[]`, que se
//    pinta igual que «la literatura no dice nada».
// @ts-expect-error — `fuentes` no existe en un sobre sin material
void caido.fuentes

// 2. Tampoco desde la unión sin estrechar: hay que pasar por `tieneMaterial`.
// @ts-expect-error — `fuentes` no existe en SobreSinMaterial
void cualquiera.fuentes

// 3. Un sobre con material no tiene `motivo` de fallo: no se puede inventar uno
//    para pintar un aviso que no corresponde.
// @ts-expect-error — `motivo` no existe en un sobre con material
void vacio.motivo

// 4. Un sobre escrito a mano NO es un sobre. Sin esto, cualquiera podría
//    construir un `available` con fuentes que nunca se recuperaron.
// @ts-expect-error — falta la marca fantasma, que no se exporta
const inventado: SobreConMaterial = {
  proveedor: 'uptodate', rol: 'respaldo', licencia: 'REQUIRES_AGREEMENT',
  estado: 'available', intentadoEn: '2026-08-22T10:00:00.000Z',
  correlacion: 'corr-0001-abcd', telemetria: { latenciaMs: 1 },
  fuentes: [], frescura: {},
}
void inventado

// 5. Un estado de fallo no admite `fuentes` ni pasando por la fábrica.
//    (La directiva va pegada a la propiedad: `@ts-expect-error` sólo cubre la
//    línea siguiente, y el error de propiedad excedente se reporta AHÍ, no en
//    la llamada.)
void sobreSinMaterial({
  proveedor: 'pubmed', estado: 'unavailable',
  intentadoEn: '2026-08-22T10:00:00.000Z', correlacion: 'corr-0001-abcd',
  telemetria: { latenciaMs: 1 }, motivo: 'x', clase: 'red',
  // @ts-expect-error — `fuentes` no es una propiedad de EntradaSobreSinMaterial
  fuentes: [],
})

// 6. Una acción clínica autorizada NO se escribe a mano. Es la defensa
//    estructural del punto 4 de #314: un flujo automático no puede fabricar
//    el permiso que sólo da el médico.
// @ts-expect-error — falta la marca fantasma de decisión
const recetaSinMedico: AccionAutorizada = {
  accion: 'receta', decidioUid: 'sistema',
  decidioEn: '2026-08-22T10:00:00.000Z', informadaPor: null,
}
void recetaSinMedico

// 7. Una propuesta de evidencia NO es una acción: no se puede pasar por una.
declare const propuesta: PropuestaDeEvidencia
// @ts-expect-error — una propuesta informativa no es una acción autorizada
const comoSiFuera: AccionAutorizada = propuesta
void comoSiFuera

// 8. `decisionDelMedico` exige el acto explícito: omitirlo no compila.
// @ts-expect-error — falta `actoExplicito`, que es obligatorio
void decisionDelMedico({
  accion: 'receta', decidioUid: 'medico-1', decidioEn: '2026-08-22T10:00:00.000Z',
})
