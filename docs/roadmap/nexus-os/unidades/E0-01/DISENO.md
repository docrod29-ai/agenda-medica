# E0-01 — Receta/QR 100% derivada de datos autoritativos del servidor

> Etapa E0 (Hardening) · riesgo declarado: medio · validación clínica: NO
> Objetivo del backlog: *"Eliminar el residual de REG-025: el certificado debe ligarse a la nota autoritativa, no a campos del body."*
> Aceptación: **un body con cédula/folio arbitrarios no produce certificado válido.**

Este documento es DISEÑO. No se implementó nada.

---

## 1. Estado real del código (lo que YA existe)

| Pieza | Archivo:línea | Situación |
|---|---|---|
| Ruta que acuña el certificado | `src/app/api/receta/verificacion-url/route.ts:10-40` | **Toma `folio`, `doctorNombre`, `cedula` y `contenidoHash` del body** y los firma tal cual (`:29-38`) |
| Gate de autorización | `src/app/api/receta/verificacion-url/route.ts:25` | `verificarMedico(req, body.clinicId)` — ya cierra el vector "recepcionista" (REG-025 parcial) |
| Token HMAC | `src/lib/receta-token.ts:39-51` (crear), `:62-79` (verificar), `:81-83` (link) | Correcto y probado; el problema **no es el token, es lo que se le mete** |
| Página pública del QR | `src/app/verificar/[token]/page.tsx:44-53` | Muestra "Médico emisor" y "Cédula profesional (registrada en NexusMED)" con lo que venga en el token |
| Quien llama | `src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx:247-263` | Envía `config?.nombreMedico` y `config?.cedulaProfesional` (config **de la clínica**, doc `config/main`) |
| Folio | `src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx:97-100` | Ya es **derivado del `notaId`** (`RX-` + últimos 7 alfanuméricos), pero el cálculo vive solo en el cliente |
| Nota autoritativa | `clinics/{clinicId}/patients/{patientId}/notas/{notaId}` (`src/lib/expediente/firestore.ts:11-18`) | Contiene `firma.nombreMedico` / `firma.cedulaProfesional` — **snapshot inmutable al firmar** (`src/app/(dashboard)/consulta/[patientId]/page.tsx:1749-1760`) y `metadata.medicoId` / `metadata.cedulaProfesional` (`:1250-1257`) |
| Huella del contenido | `src/lib/expediente/huella-impreso.ts:43-64` | Puro, determinista, **sin dependencias de navegador** → importable desde una route |
| Tests del token | `src/__tests__/receta-token.test.ts` (11 casos) | Cubren el token; **ningún test cubre la ruta** |
| Ledger | `docs/audit/regression-ledger.md:36` | REG-025 = `CLOSED (parcial)` · "residual: ligar a la nota autoritativa" |

**Precondición verificada del flujo real:** la receta solo se genera desde una nota **FIRMADA**
(`src/app/(dashboard)/expediente/[patientId]/page.tsx:460-467` — los botones "Generar receta"/"Orden médica" solo se pintan si `firmada`;
y `src/app/(dashboard)/consulta/[patientId]/page.tsx:1823` navega a `/receta/...` justo después de firmar).
Por tanto `nota.firma` está presente en el camino legítimo → la identidad del emisor **puede** salir de la nota sin romper nada.

### El hueco, en concreto
Un usuario con rol `medico`/`admin` de la clínica puede hacer un POST a mano con
`{ clinicId: <la suya>, notaId: <cualquiera>, folio: "RX-0000001", doctorNombre: "Dra. X", cedula: "9999999" }`
y obtener una URL `/verificar/<token>` que el servidor firma con su HMAC. La página pública responde
**"Integridad verificada"** y muestra esa cédula como si fuera el emisor. Es decir: NexusMED emite un
certificado de un documento que nunca existió, con la cédula de un tercero. Ni el `notaId` se comprueba
(puede no existir), ni el folio deriva de nada, ni la cédula pertenece a nadie.

También hay un caso **no malicioso** que ya produce el dato incorrecto hoy: `config/main` es de la **clínica**
(un solo `nombreMedico`/`cedulaProfesional`, `src/types/index.ts:301-306`). En un consultorio con dos médicos,
si el médico B imprime la receta de una nota firmada por A, el QR sale con la identidad de **B**. Ese caso no
requiere mala fe y hoy ocurre.

---

## 2. Cambio mínimo propuesto

**Principio:** la ruta deja de *creer* al body. Del body solo se aceptan **localizadores** (`clinicId`,
`patientId`, `notaId`); todo lo que el certificado *afirma* (folio, nombre, cédula) se **deriva de la nota
leída con el Admin SDK**. `clinicId` ya es autoritativo de facto porque `verificarMiembro` lo contrasta contra
`clinic_members/{uid}.clinicId` (`src/lib/auth-server.ts:70-87`), así que el path leído nunca cruza tenant.

### PARTE 1 — obligatoria (cumple la aceptación)

**1.1 · NUEVO `src/lib/receta-folio.ts`** — el folio deja de vivir solo en el cliente.

```ts
/** Folio estable y derivado de la nota. MISMA función en cliente y servidor:
 *  si divergen, el papel y el QR llevarían folios distintos. */
export function folioDeNota(notaId: string): string
// "abc123def456" -> "RX-3DEF456"   ·  "" -> "" (el llamador decide el respaldo)
```
Módulo puro, sin `node:crypto` (por eso NO va en `receta-token.ts`, que es server-only por `node:crypto`),
para poder importarlo desde el componente cliente.

**1.2 · NUEVO `src/lib/receta-certificado.ts`** — resolutor **puro** (sin Firestore, sin HMAC) = 100% testeable.

```ts
import type { NotaMedica } from '@/types/expediente'

export type OrigenEmisor = 'firma' | 'metadata' | 'ninguno'

export interface EmisorCertificado {
  doctorNombre: string
  cedula: string
  /** De dónde salió la identidad. 'ninguno' = la nota no la trae; NO se inventa. */
  origen: OrigenEmisor
}

/** Identidad del prescriptor SEGÚN LA NOTA. Prioridad:
 *  1) nota.firma (snapshot inmutable del momento de firmar) → 'firma'
 *  2) nota.metadata.cedulaProfesional (notas legadas sin bloque firma) → 'metadata'
 *  3) vacío → 'ninguno'  (se acuña igual, con emisor vacío: nunca se rellena con el body) */
export function emisorDeNota(nota: NotaMedica): EmisorCertificado

export interface DatosCertificado {
  folio: string
  doctorNombre: string
  cedula: string
  origenEmisor: OrigenEmisor
  /** PARTE 2 — huella de los medicamentos que la NOTA tiene guardados. */
  huellaNota?: string
}

/** Todo lo que el certificado afirmará, derivado únicamente de (notaId, nota). */
export function datosCertificado(notaId: string, nota: NotaMedica): DatosCertificado
```

**1.3 · MODIFICAR `src/app/api/receta/verificacion-url/route.ts`** (única ruta afectada):

```
Body aceptado:  { clinicId, patientId, notaId, contenidoHash? }
Body IGNORADO:  folio, doctorNombre, cedula     ← ya ni se declaran en el tipo

1. verificarMedico(req, body.clinicId)                       (sin cambio)
2. exigir patientId y notaId                                  → 400 si faltan
3. snap = adminDb.doc(`clinics/${clinicId}/patients/${patientId}/notas/${notaId}`).get()
   - !snap.exists                                             → 404 {error:'Nota no encontrada'}   ← mata el notaId inventado
   - data.estado !== 'firmada'                                → 409 {error:'La nota no está firmada'} (ver §4, decisión D2)
4. { folio, doctorNombre, cedula } = datosCertificado(notaId, nota)
5. url = linkVerificacionReceta(origin, { clinicId, notaId, folio, doctorNombre, cedula, contenidoHash, huellaNota })
6. return { url, folio, doctorNombre, cedula, origenEmisor }  ← respuesta informativa (el cliente no cambia lo que imprime)
```
`export const runtime = 'nodejs'` (como `diseno-url/route.ts:20`) porque se usa el Admin SDK.

**1.4 · MODIFICAR `src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx`**
- `:97-100` → `const folio = useMemo(() => folioDeNota(notaId) || \`RX-${Date.now()...}\`, [notaId])` (mismo resultado, ahora compartido).
- `:253-262` → el body pasa a `{ clinicId, patientId, notaId, contenidoHash }`. Se dejan de enviar `folio`, `doctorNombre`, `cedula`; salen de las `deps` del `useEffect` (`:264`) → un cambio de cédula en Configuración ya no re-dispara el minteo.

**1.5 · `docs/audit/regression-ledger.md:36`** → REG-025 pasa a `CLOSED` con control permanente
("identidad y folio derivados de la nota; test de forja").

### PARTE 2 — recomendada, separable (es lo que hace literal el "ligarse a la nota")

`contenidoHash` es la huella de **lo que se imprime**, y el médico puede editar medicamentos en la pantalla de
receta sin que eso se guarde en la nota (documentado en `src/lib/expediente/huella-impreso.ts:6-19`). Por eso
**no** se puede exigir que coincida con la nota: se rompería el caso legítimo. Solución aditiva:

- `src/lib/receta-token.ts`: campo **opcional** `hn` = huella de los medicamentos **de la nota**
  (`huellaImpreso(nota.medicamentos).hash`), calculada en el servidor. `FIRMA_VERSION` sube a `2`
  **solo para tokens nuevos**; `verificarTokenReceta` sigue aceptando v=1 (TTL de 2 años, `receta-token.ts:24` —
  hay tokens vivos en la calle: **no** invalidarlos).
- `src/app/verificar/[token]/page.tsx`: mostrar "Huella de la nota firmada" y, cuando `h` y `hn` existan y
  difieran, una línea **neutra**: *"El impreso incluye ajustes hechos al momento de imprimir; la nota firmada
  se conserva sin cambios."* (afirmación de hecho, sin juicio clínico).
- Para `v >= 2` la página puede decir con verdad que el emisor **se leyó de la nota firmada**, no de un formulario.

`contenidoHash` sigue viniendo del cliente (es una huella opaca de 8 hex, no una afirmación de identidad; no
sirve para forjar credencial) y conserva su validación de forma actual (`route.ts:37`).

---

## 3. Tests que lo prueban

**A · `src/__tests__/receta-certificado.test.ts` (nuevo, puro — carga la aceptación):**
1. `emisorDeNota` toma nombre y cédula de `nota.firma` **aunque** `metadata.cedulaProfesional` diga otra cosa → `origen: 'firma'`.
2. Nota legada sin `firma` → cae a `metadata` → `origen: 'metadata'`.
3. Nota sin ninguna de las dos → `{ doctorNombre: '', cedula: '', origen: 'ninguno' }` — **no inventa**.
4. `folioDeNota` es determinista y estable ante reimpresión; `folioDeNota('')` → `''`.
5. `datosCertificado` **no acepta ninguna entrada** fuera de `(notaId, nota)` — el contrato mismo hace imposible la inyección.

**B · `src/__tests__/receta-verificacion-url-route.test.ts` (nuevo, ruta con mocks):**
*Viabilidad comprobada en este repo*: con `vi.mock('@/lib/firebase-admin')` + `vi.mock('@/lib/auth-server')`,
`NextRequest`/`NextResponse` y el import de la route funcionan en el entorno `node` de vitest
(`vitest.config.ts:6-8`) — se ejecutó un test desechable de comprobación y pasó (2/2), y se borró.
6. **Test de forja (criterio de aceptación):** nota fixture firmada por `Dra. Ana / 1111111`; body con
   `cedula: '9999999'`, `doctorNombre: 'Dr. Impostor'`, `folio: 'RX-FALSO'` → el token devuelto verifica con
   `cedula === '1111111'`, `doctorNombre === 'Dra. Ana'`, `folio === folioDeNota(notaId)`. **Nunca** con lo del body.
7. `notaId` inexistente → 404 y **no** hay `url` en la respuesta.
8. Falta `patientId` → 400.
9. Nota en `borrador` → 409 (decisión D2).
10. Camino feliz sin campos de identidad en el body → 200 con certificado correcto (no se rompió el uso normal).

**C · `src/__tests__/receta-token.test.ts` (existente):** el caso `:20-26` afirma las llaves exactas del payload.
Sigue verde porque `hn` es opcional y ausente si no se pasa. Añadir 1 caso: `hn` viaja y vuelve; y un token
**v=1 legado** (payload construido a mano) sigue verificando.

---

## 4. Riesgo de regresión REAL

| # | Riesgo | Probabilidad | Mitigación |
|---|---|---|---|
| R1 | **Folio del papel ≠ folio del QR.** Si servidor y cliente calculan distinto, el paciente lleva dos identificadores | Baja | **Una sola función** `folioDeNota` importada por ambos (1.1). El respaldo `Date.now()` del cliente solo aplica sin `notaId`, y sin `notaId` el `useEffect` ni siquiera hace la petición (`page.tsx:243`) |
| R2 | **Cliente viejo cacheado por el SW** manda body sin `patientId` → 400 | Media el día del deploy | Degradación ya existente y silenciosa: `!r.ok` → el QR codifica `Folio:<folio>` (`RecetaDocumento.tsx:699`). No rompe la impresión. Subir versión del SW en el deploy |
| R3 | **El pie impreso y el certificado dejan de coincidir** en clínicas con 2+ médicos: el papel sigue imprimiendo `config.nombreMedico`/`cedulaProfesional` (`RecetaDocumento.tsx:722-723`), el QR ya dirá la identidad de la nota | Media | **NO se toca la impresión en esta unidad** (regla 5 de la carta operativa). Es una inconsistencia *que ya existe hoy al revés y peor* — hoy el QR miente; tras el cambio el QR dice la verdad. Ver decisión **D1** |
| R4 | Notas **legadas** firmadas sin cédula → certificado con emisor vacío ("—") | Baja | Se acuña igual (no se rompe el QR de expedientes viejos) y `/verificar` ya pinta `'—'` (`page.tsx:46-47`). Fail-safe, nunca fail-inventado |
| R5 | Una **lectura extra de Firestore** por impresión de receta | — | 1 doc `get()` por receta. Ruido despreciable frente al volumen de la app |
| R6 | Tokens **v=1 en circulación** (TTL 730 días) dejan de verificar si se bump-ea la versión mal | Baja | `verificarTokenReceta` no filtra por `v` (`receta-token.ts:72-78`); el bump es solo de emisión. Test 11 (token legado) lo fija |
| R7 | La `/orden/[patientId]/[notaId]` **no** consume esta ruta (su QR ya cae a `Folio:` en texto) | — | Fuera de alcance; no se rompe. Candidato a unidad posterior |

**No se toca:** impresión/PDF/Word, sello NOM-024, firma, cobros, reglas de Firestore, ni el HMAC existente.

---

## 5. Decisiones que NO son mías (dueño del producto, no clínicas)

- **D1 — ¿El pie impreso debe pasar a leerse de `nota.firma` en vez de `config/main`?**
  Hoy la receta impresa muestra la identidad de la *clínica*, no la del médico que firmó la nota. Corregirlo es
  lo correcto medicolegalmente, pero **toca el camino de impresión**, que es exactamente lo que la carta operativa
  manda no arriesgar a ciegas. Propuesta: unidad aparte, con verificación visual del PDF real.
- **D2 — Nota en borrador: ¿409 o certificado sin emisor?**
  El diseño propone **409** porque hoy la UI solo ofrece "Generar receta" en notas firmadas (verificado en
  `expediente/[patientId]/page.tsx:460-467`), así que el 409 es inalcanzable por el flujo normal y cierra la
  emisión de certificados de borradores. Si algún día se quiere recetar desde un borrador, la alternativa es
  acuñar con emisor `origen:'metadata'`.
- **D3 — ¿Se incluye la PARTE 2 (`hn`) en esta unidad o en una posterior?**
  Es aditiva y de bajo riesgo, pero cambia el payload del token y el texto de una página pública.

**Ningún umbral, dosis, regla clínica ni "gold answer" hace falta para esta unidad:** es autorización y
procedencia de datos, no criterio médico. `necesitaValidacionClinica = false`.

---

## 6. Archivos a tocar (resumen)

| Archivo | Acción |
|---|---|
| `src/lib/receta-folio.ts` | NUEVO — `folioDeNota` puro y compartido |
| `src/lib/receta-certificado.ts` | NUEVO — `emisorDeNota` / `datosCertificado` (puros) |
| `src/app/api/receta/verificacion-url/route.ts` | MODIFICAR — lee la nota; ignora identidad del body; 404/409/400 |
| `src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx` | MODIFICAR — envía `patientId`, deja de enviar folio/nombre/cédula; usa `folioDeNota` |
| `src/lib/receta-token.ts` | MODIFICAR (PARTE 2) — `hn` opcional + `FIRMA_VERSION = 2` retro-compatible |
| `src/app/verificar/[token]/page.tsx` | MODIFICAR (PARTE 2) — huella de la nota + origen del emisor |
| `src/__tests__/receta-certificado.test.ts` | NUEVO — 5 casos puros |
| `src/__tests__/receta-verificacion-url-route.test.ts` | NUEVO — 5 casos de ruta, incluido el **test de forja** |
| `src/__tests__/receta-token.test.ts` | MODIFICAR — 2 casos (`hn`, token v=1 legado) |
| `docs/audit/regression-ledger.md` | MODIFICAR — REG-025 → CLOSED |
