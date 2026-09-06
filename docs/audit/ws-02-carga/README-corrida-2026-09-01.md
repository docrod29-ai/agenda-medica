# WS-02 — la corrida del 1-sep-2026, sobre este árbol

**Por qué otra corrida.** Las anteriores se midieron sobre `62ad2724`. Este árbol
cambia lo que `tareasVivas` lee (REG-423 añade una segunda consulta mientras la
migración de `pesoUrgencia` esté pendiente) y acota `getWaitlist` (REG-429), así
que la evidencia de escala se vuelve a producir en vez de heredarse.

```bash
npx firebase emulators:exec --only auth,firestore --project demo-nexusmed-test \
  "node scripts/product/run-consultorio-load.mjs --registered=2000 --out=carga.json"
node scripts/product/validate-consultorio-load-result.mjs carga.json
```

## Lo medido — `escenario-2000-registrados-97b2a312.json`

| | |
|---|---|
| Escenario | `WS-02.registrados-2000` (78 médicos, 77 sesiones concurrentes) |
| Árbol | `97b2a312` |
| Peticiones | **3 120** · éxito 3 120 · **errores 0** (`errorRate` 0) |
| Throughput | **317,1 pet/s** |
| Latencia | **p50 222,5 ms · p95 476,0 ms · p99 560,0 ms** |
| Fuga entre consultorios | **0 en 156 sondas** — con `firestore.rules` cargadas de verdad |
| Idempotencia | **0 violaciones** · guardado durable ✅ · recuperación ✅ |
| Operaciones Firestore | 15 576 lecturas · 2 340 escrituras |

## Y el validador lo RECHAZA, que es lo correcto

```
INVALID CONSULTORIO LOAD EVIDENCE: lostDraftCount must be a non-negative integer
```

**Once campos van en `null`** porque no se midieron, cada uno con su razón escrita:
pantalla en blanco y borrador perdido son de navegador; fallo silencioso de
proveedor, salud del proveedor, contrapresión y las cuatro colas necesitan un
proveedor de verdad al otro lado; `timeoutRate` no se puede contar porque el arnés
no impone plazo; y las lecturas sin cota son una propiedad **estática** del árbol,
que vigila su propio guardián.

Escribir `0` en cualquiera de ellos **fabricaría evidencia**: un cero por no haber
mirado se lee como «se midió y no hubo ninguno». El arnés no se ablanda para pasar
su propia puerta y el validador no se toca para dejarlo pasar (REG-378).

## Lo que estos números NO dicen

- **No son producción.** Un emulador no tiene la latencia de red, ni los índices
  desplegados, ni la contención real. Lo que sí es real ahí son `firestore.rules`,
  y por eso la sonda de fuga entre consultorios vale.
- **No son 100 000 usuarios.** Son 2 000 registrados según el modelo de
  concurrencia, y el escenario que no cabe en la cota local **aborta** en vez de
  correrse a escala reducida con la etiqueta puesta.
- **No se comparan con la corrida de `62ad2724`.** Es otra máquina y otra carga de
  fondo; poner las dos tablas al lado invitaría a leer una mejora que este dato no
  demuestra.
- **No hay umbral de aceptación.** `throughput`, `errorRate` y los percentiles
  tienen su casilla y su unidad; el umbral es decisión del dueño y sigue
  `PENDIENTE_DEL_DUENO`.
