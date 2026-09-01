# Decisiones que este carril NO puede tomar

> Cada una está aquí porque el código se paró delante de ella y escribió el
> hueco en vez de rellenarlo. Ninguna es un trámite: las seis cambian lo que le
> pasa al expediente de una persona.

---

## D-1 · El plazo mínimo de conservación del expediente

**Estado:** `NEEDS_CLINICAL_REVIEW`
**Dónde vive el hueco:** `src/lib/durability/archivado.ts` →
`DIAS_MINIMOS_DE_CONSERVACION = null`

**Qué falta:** cuántos años se conserva un expediente, por jurisdicción y por
tipo de documento, con la fuente citada.

**Quién puede decidirlo:** el dueño, con asesoría legal. La NOM-004 es la
entrada; la política del consultorio es la decisión.

**Qué pasa mientras tanto:** ningún expediente alcanza
`ELEGIBLE_PARA_BORRADO`. El motor clasifica en `ACTIVO` o `ARCHIVADO` y dice
literalmente qué falta.

**Por qué no se puso un número plausible:** porque es el fallo más caro posible
aquí. Un «cinco años» inventado no falla, no rompe una prueba, y decide sobre el
expediente de alguien.

---

## D-2 · Si alguna vez se borra un expediente clínico, y cómo

**Estado:** no implementado, y la ausencia es el control.

**Qué falta:** la política. `ELEGIBLE_PARA_BORRADO` **no es** «bórralo»: es el
estado donde una persona decide.

**Quién puede decidirlo:** el dueño con asesoría legal.

**Qué exigiría la implementación, si algún día se autoriza:** acto explícito,
auditado, acotado a lo que se pidió, y con ventana de recuperación. Nunca un
cron.

**Estado hoy:** `src/lib/durability/archivado.ts` **no exporta ninguna función
que borre**, y hay una prueba que falla si aparece una. Un módulo de
conservación con función de borrado acaba conectado a un cron.

---

## D-3 · Qué significa restaurar un expediente FIRMADO en otro consultorio

**Estado:** detectado y detenido; sin política.

**El problema, en una frase:** `clinicId` va **dentro del sello v3** de la nota
firmada. Si al restaurar en otro consultorio no se reescribe, hay contaminación
entre consultorios; si se reescribe, se ha alterado un documento inmutable. No
hay tercera opción.

**Quién puede decidirlo:** el dueño con asesoría legal. ¿Es una cesión de
expediente? ¿Una migración de titularidad? ¿Un error que hay que impedir?

**Qué pasa mientras tanto:** el veredicto es `REVISION_HUMANA` y no se escribe
nada. La restauración de desastre —el mismo consultorio volviendo a su propio
`clinicId`, que es el caso real— sale limpia y no toca esta decisión.

---

## D-4 · Si el respaldo debe llevarse los objetos de Cloud Storage

**Estado:** declarado como pérdida conocida; sin decidir.

**Qué falta:** el respaldo NDJSON lleva la ficha de la fotografía clínica —fecha,
región, descripción, a qué nota se ligó— y **ni un byte de la imagen**. Igual
con el membrete y la firma.

**Quién puede decidirlo:** el dueño, porque tiene coste: multiplicaría el tamaño
del archivo y la factura de tráfico.

**Qué pasa mientras tanto:** la cabecera del archivo lo declara
(`fueraDelArchivo`) y la respuesta de la restauración lo repite (`noVuelve`), en
el mismo sitio donde alguien lee cuántos documentos volvieron.

**Relacionado:** R-05 y R-07 del registro de riesgos. La fotografía clínica vive
hoy bajo `receta-diseno/{uid-del-médico}/`, el mismo prefijo que la papelería y
el único que ningún barrido toca.

---

## D-5 · Correr el ensayo de restauración con consola

**Estado:** pendiente desde que existe `docs/SIMULACRO_RESTAURACION.md`.

**Qué falta:** `gcloud firestore databases restore` contra una base
`ensayo-restauracion`, cronometrado.

**Quién puede hacerlo:** el dueño. Exige `gcloud`, credenciales del proyecto y
la decisión de crear (y luego borrar) una base de ensayo.

**Por qué importa más que ninguna otra:** es el tramo más largo del RTO y no
tiene ni un número. Mientras siga así, `rtoPublicable()` devolverá `false` y
este producto no podrá responder a un hospital que pregunte cuánto tarda en
volver.

**Cuánto cuesta:** una hora, según el procedimiento ya escrito.

---

## D-6 · Publicar `firestore.rules` para una colección de puntos de control

**Estado:** no pedido, no hecho.

**Qué habilitaría:** que una restauración interrumpida se **reanude** en vez de
recorrer el archivo entero otra vez, y que una restauración se pueda **deshacer**
sobre lo que se le puede atribuir.

**Qué exige:** una colección nueva bajo `clinics/{id}`, declarada en los tres
sitios de siempre —`firestore.rules`, `matriz-acceso.ts`, el manifiesto del
respaldo— y `npx firebase deploy --only firestore:rules`, que **requiere
autorización del dueño**.

**Qué pasa mientras tanto:** la idempotencia se sostiene en la comparación de
contenido, que no necesita estado: un documento que ya está idéntico no se
reescribe. Los motores de reanudación y reversión están escritos y probados,
esperando dónde guardar sus asientos.

---

## D-7 · Cerrar `/api/receta/diseno?path=` (fuera de este carril, pero urgente)

**Estado:** hallazgo P0 de este carril, en el registro como R-06.

**Qué pasa:** esa rama no comprueba sesión ni pertenencia al consultorio. El
único candado real es un token HMAC que hoy **no es obligatorio**
(`RECETA_DISENO_FIRMA`). El propio archivo describe el despliegue en dos pasos y
el segundo paso sigue pendiente. Como la fotografía clínica se sirve por ahí (ver
R-05), lo que se expone ya no es sólo papelería.

**Quién puede decidirlo:** el dueño, porque activar el candado puede romper la
impresión de las recetas cuyas URLs se guardaron sin firma.

**Por qué no se arregla aquí:** romper la impresión de recetas es peor que el
riesgo que se cierra, si se hace sin plan. El plan existe y está escrito en el
propio archivo; lo que falta es ejecutarlo.
