# Nexus OS — dónde vamos

**Avance: 6 de 68 unidades.** Etapa E0 (Hardening): **6 de 15**.
Última corrida: `2026-07-29T03:00:21Z` — **E0-11 · Clinical Safety CI gate**.

| Unidad | Qué es | Estado |
|---|---|---|
| E0-01 | Certificado de receta firmado con identidad derivada | cerrada |
| E0-02 | Invariantes de dosis pediátrica (property-based) | cerrada |
| E0-03 | Clinical Engine Registry + trinquete de ADRs | cerrada |
| E0-14 | Firma aislada · cobro sellado · nota nace borrador | cerrada (única con reglas desplegadas) |
| E0-15 | Antibiograma: 4 decisiones clínicas suyas implementadas | cerrada |
| **E0-11** | **El CI protege los invariantes clínicos** | **software listo — falta un switch suyo en GitHub** |

---

## Lo último: E0-11 — el candado que faltaba

Las unidades anteriores llenaron el repo de invariantes: 43 valores exactos de fórmulas
(CKD-EPI, MELD, FIB-4, SOFA, APACHE-II…), 37 propiedades de dosis pediátrica, 51
incidentes con su prueba permanente. Todos corrían en el CI.

**El agujero:** el CI corría `vitest`, que mide **los tests que quedan**, no **los que
deben existir**. Hasta ayer el CI seguía en verde si alguien:

- borraba el archivo con los 43 valores exactos de las fórmulas,
- le ponía `describe.skip` al bloque de dosis pediátrica,
- dejaba un `it.only` que excluía al resto del archivo,
- o vaciaba un invariante dejando un solo `it` verde.

Un invariante clínico se podía apagar sin que nada chillara.

### Qué hace ahora

Hay un **metagate** que protege **78 archivos** de invariantes. La lista no está escrita a
mano —se pudriría—: se **deriva** de tres fuentes que ya son la verdad del repo (el golden
que cada motor declara en el registro, el test que cierra cada incidente del ledger, y
tres gates que se vigilan a sí mismos). En cada Pull Request comprueba que cada uno siga
**en disco, encendido y con al menos tantos casos como el día que se selló**.

### Se probó rompiéndolo a propósito

Un gate que nunca se ha visto caer no es un gate. Antes de darlo por bueno:

- Se le puso `describe.skip` al archivo de fórmulas clínicas → **rojo**, señalando archivo
  y línea exacta.
- Se borró el golden de la función renal → **rojo** por dos vías distintas.

Ambos ataques revertidos. Además, el gate incluye un **autotest de sí mismo**: 14 líneas
de ejemplo que debe (y no debe) detectar, para que una regex mal escrita no lo deje verde
para siempre fingiendo que protege.

### El detalle que lo hace difícil de esquivar

Modificar el archivo del CI para saltarse el gate **rompe el propio gate** —comprueba que
su job siga cableado— y esa comprobación corre dentro del job general. No hay forma de
quitarlo en el mismo cambio que rompe el invariante.

### Gates reales

`tsc` PASS · `vitest` PASS (**2083** tests, 178 archivos; eran 2051) · `build` PASS.
**Cero archivos de producción tocados**: nada de impresión, PDF, firma, cobros, PHI ni
reglas de Firestore. Nada desplegado, sin `git push`.
Detalle en `unidades/E0-11/RESULTADO.json` · doc del gate en `docs/ci/clinical-safety-gate.md`.

---

## Esperando decisión del médico

### 1. Cinco minutos en GitHub — es lo único que le falta a E0-11

El gate ya **avisa**, pero todavía no **bloquea**: impedir un merge lo decide GitHub, no
el CI. Hoy un Pull Request con el gate en rojo se puede mergear igual.

En `github.com/docrod29-ai/agenda-medica` → **Settings → Rules → Rulesets → New branch
ruleset**, sobre `main`:

1. Require a pull request before merging.
2. Require status checks to pass → marcar **`clinical-safety`** y **`verificar`**.
3. Require branches to be up to date before merging.
4. Do not allow bypassing the above settings (incluirse usted).

Los pasos con más detalle están en `docs/pendientes-externos.md` §3. **No marqué la unidad
como cerrada** porque el criterio dice «no puede mergearse» y sin ese paso no es cierto.
No bloquea ninguna otra unidad del programa.

*Opcional, mismo sitio:* se creó `.github/CODEOWNERS` para exigir su revisión en todo
cambio clínico. Confirme que `docrod29-ai` es su usuario de GitHub y active «Require
review from Code Owners».

### 2. ¿Ampliamos el catálogo de dosis del adulto? (E0-02, REG-043) — no bloquea

**20 de los 25** fármacos pediátricos no existen en el catálogo adulto: todos los
antibióticos salvo amoxicilina, más prednisona, ondansetrón, difenhidramina, aciclovir,
hierro elemental… Al prescribirlos **a un adulto**, el verificador dice «sin referencia» y
no impone ningún techo. Usted aprobó ampliarlo; falta que aporte el máximo por toma y por
día de cada uno. **No se derivan de las cifras pediátricas y no los voy a inventar.**

### 3. Firma: ¿se construye el renderizado server-side? (E0-14, REG-014) — no bloquea

La firma ya no la puede leer recepción, farmacia ni enfermería. Pero el médico
autenticado sigue recibiendo la imagen en su navegador, porque la impresión es toda del
lado del cliente. Cerrarlo del todo exige generar el documento firmado en el servidor: es
una unidad aparte y toca el camino de impresión.

### 4. Pendientes anteriores (E0-01), sin cambios

- **¿El pie IMPRESO de la receta debe leerse de la firma de la nota en vez de la
  configuración de la clínica?** Con un solo médico no cambia nada; con dos o más, papel y
  QR pueden discrepar. No bloquea.
- **Al desplegar: subir la versión del Service Worker.** Un cliente viejo cacheado deja el
  QR degradado a texto ese día. No rompe la impresión.

---

## Qué sigue

Con E0-11 hecha, **E0 se queda sin unidades de riesgo bajo**. Las dos siguientes,
ambas de riesgo medio y con su diseño ya escrito en disco:

- **E0-04 — ClinicalQuantity: tipo con unidad obligatoria.** Es el desbloqueador de tres
  unidades de tres etapas distintas (E0-05, E1-01, E4-01): abre de golpe la etapa E1
  (Nexus Context) y la E4 (Safety Kernel). Solo el núcleo del tipo; migrar los motores es
  E0-05 y va aparte.
- **E0-09 — Eventos hospitalarios críticos append-only.** MAR, órdenes y eventos de UCI
  dejan de poder editarse o borrarse: solo se anexa corrección. Toca reglas de Firestore,
  así que su despliegue sería decisión suya aparte.

Lo que reste de E0 después (E0-06 PHI, E0-10 CSP, E0-12 sello de integridad, E0-13
webhook de Stripe) es de riesgo medio/alto y varias deben entregarse como **plan** para
que usted decida, no ejecutarse a ciegas.

---

## Cómo se retoma

Relanzar el workflow `nexus-os`. Lee `estado.json`, comprueba en disco qué unidades ya
tienen `RESULTADO.json` y continúa en la siguiente pendiente. Es idempotente: relanzarlo
nunca repite trabajo ni pierde avance.
