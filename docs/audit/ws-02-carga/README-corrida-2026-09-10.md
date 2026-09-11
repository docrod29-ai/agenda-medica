# WS-02 — la corrida del 10-sep-2026, sobre `db66253` (D-057 y D-058 en el árbol)

**Por qué otra corrida.** Este árbol cambia las reglas de todas las
subcolecciones clínicas del paciente (`esMedicoDelPaciente`, D-057) y añade un
`get()` de la ficha del paciente a cada lectura clínica. La evidencia de escala
se vuelve a producir con esas reglas cargadas de verdad, en vez de heredarse.

```bash
npx firebase emulators:start --only auth,firestore,storage --project demo-nexusmed-v10
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 GCLOUD_PROJECT=demo-nexusmed-v10 \
  node scripts/product/run-consultorio-load.mjs --tenants=200 --physicians-per-tenant=2 --concurrent=400 --patients-per-physician=5 --out=carga.json
node scripts/product/validate-consultorio-load-result.mjs carga.json
```

## Lo medido — `cota-local-400-sesiones-db66253.json`

| | |
|---|---|
| Escenario | `consulta-concurrente-emulador` (400 médicos, 400 sesiones concurrentes, 200 consultorios) |
| Árbol | `db66253` |
| Peticiones | **8 000** · éxito 8 000 · **errores 0** |
| Throughput | **449,7 pet/s** |
| Latencia | **p50 745 ms · p95 1 882 ms · p99 2 573 ms** |
| Fuga entre consultorios | **0** — con `firestore.rules` de D-057 cargadas |
| Idempotencia | **0 violaciones** · guardado durable ✅ · recuperación ✅ |
| Operaciones Firestore | 19 981 lecturas · 6 000 escrituras |

## Lo que estos números NO dicen

- **No se comparan con la corrida de `62ad2724`** (400 sesiones, 219,9 pet/s):
  otra máquina, otra carga de fondo — esta corrida se hizo con un `next build`
  recién terminado en la misma máquina— y otro escenario (`--patients-per-physician=5`).
  Poner las dos tablas al lado invitaría a leer una mejora o un empeoramiento que
  este dato no demuestra.
- **No es producción** ni son 100 000 usuarios: es la cota local. El segundo
  objetivo (100 000 activos) está modelado en `README-activos-100k.md` y no cabe
  aquí por concurrencia ni por volumen.
- **El validador lo rechaza**, que es lo correcto: once campos van en `null`
  porque no se midieron (navegador, proveedores, colas, `timeoutRate`, lecturas
  sin cota), cada uno con su razón escrita en el JSON. Escribir `0` fabricaría
  evidencia (REG-378).
- **No hay umbral de aceptación**: sigue `PENDIENTE_DEL_DUENO`.

Lo que sí afirma: con las reglas de D-057 cargadas, ninguna de las 400
sesiones leyó ni escribió fuera de su consultorio, y el `get()` adicional por
lectura clínica no produjo un solo error en 8 000 peticiones.
