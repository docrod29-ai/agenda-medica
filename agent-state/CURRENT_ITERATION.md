# Iteración actual — REG-192 (cerrada, PR #260)

**Modo**: una iteración por ejecución, PR sí, despliegue no.

## Lo primero que pasó: el estado mentía

`BACKLOG.json` venía del 4-ago y sus dos ítems de mayor score —SAFE-001 (73) y
VOICE-004 (60)— **ya estaban reparados en el árbol**. `MASTER_STATE.json` decía
que producción iba en la v1030 cuando el repositorio va por la v1073.

Verificado archivo por archivo antes de cerrarlos, no por lo que decía el estado:
`alergenosDe` es hoy el único parser y sus tres llamadores lo usan;
`ES_CANTIDAD` ya acepta los cuatro signos. Los dos quedan cerrados con la razón
escrita.

**Por eso esta nota se actualiza al cerrar la iteración, no al empezarla.** Un
puntero atrasado manda a la siguiente ejecución a reparar lo ya reparado.

## Lo que se hizo

`REG-192` — los dos motores que contrastan el dictado contra la nota miraban la
PRIMERA aparición del término y sólo ésa, así que la sección bien escrita le
compraba el silencio a la mal escrita. El criterio sale a
`src/lib/expediente/mencion-en-la-nota.ts`: era la misma línea copiada dos veces.

Reproducido con los motores reales antes de tocar nada; golden comprobado en
rojo revirtiendo la reparación.

## Siguiente

`TEMP-001` (score 56, el más alto de lo pendiente) — la ventana del escudo cruza
el punto y presta la negación de la oración anterior. **No se toca a ojo**:
acotarla a la oración rompe la nota con encabezado de sección, que es igual de
común. Necesita antes un corpus de notas sintéticas con las dos formas — que es
también lo que pedía `EVAL-002`, y ahora tiene un motivo concreto.
