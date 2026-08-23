# Escala — lo medido y lo NO probado (#311)

> **Generar 50 000 fixtures NO es haber probado producción con 50 000
> pacientes.** Este documento existe para que esa frase no se pierda entre los
> números de abajo.

Medido el 23-ago-2026, Node v22.22.2, en el contenedor de la sesión.
Reproducible: `npx tsx scripts/migration/arnes.mjs --filas 10000,50000 --padron 5000`

---

## Estado por tamaño

| tamaño | preparado | local observado | CI observado | requiere staging |
|---:|:---:|:---:|:---:|:---:|
| 100 | sí | sí | sí (suite) | — |
| 1 000 | sí | sí | sí (suite) | — |
| 10 000 | sí | **sí** | **sí** (suite, 2 casos) | escritura real |
| 50 000 | sí | **sí (sólo arnés)** | no | **sí — y hoy no cabe, ver P1-2** |

«CI observado» significa que corre dentro de `npx vitest run`. El caso de 50 000
**no** está en la suite a propósito: tarda y consume demasiada memoria para un
gate compartido. Vive en el arnés, que se lanza a mano.

---

## Lo medido (pipeline puro, en memoria)

Ensayo completo —leer, mapear, normalizar, emparejar, cuarentenar, contar—
contra un padrón sintético existente de 5 000 pacientes.

| filas | archivo | ensayo | µs/fila | Δ montón | lotes a escribir | cuentas |
|---:|---:|---:|---:|---:|---:|:---:|
| 10 000 | 4.1 MB | 1 028 ms | 103 | 162 MB | 12 | cuadran |
| 50 000 | 20.7 MB | 5 143 ms | 103 | **629 MB** | 106 | cuadran |

**Coste por fila plano: ×1.0 entre 10 000 y 50 000.** Ése es el número que
importa — dice que el trabajo es lineal y no ha vuelto a ser cuadrático.

### Lo que costó llegar a ese ×1.0

La primera corrida del arnés dijo esto:

| filas | ensayo | µs/fila | Δ montón |
|---:|---:|---:|---:|
| 10 000 | 5 772 ms | 577 | 162 MB |
| 50 000 | **125 513 ms** | **2 510** | **882 MB** |

Dos defectos reales, los dos en código escrito en este mismo carril, los dos
encontrados por el arnés y no por una revisión:

1. **`IndicePacientes` no tenía tope de bloque.** Un bloque enorme —todos los
   apellidos que empiezan por `HERN`— vuelve a costar tiempo cuadrático dentro
   del bloque. `duplicados.ts` ya había aprendido esto y tenía su
   `MAXIMO_POR_BLOQUE`; el índice nuevo no lo usaba. **24× más rápido** al
   ponerlo.
2. **El ensayo devolvía el detalle de todas las filas.** La procedencia por
   campo guarda el valor original de cada celda. Acotarlo a 1 000 filas bajó de
   882 MB a 629 MB sin tocar las cuentas.

Y un tercer defecto, en el propio arnés: comparaba el coste por fila del tamaño
**más pequeño** contra el más grande. La corrida de 100 filas lleva dentro el
arranque del proceso, así que salía inflada y el crecimiento cuadrático real
aparecía como un tranquilizador «×2.11, se mantiene lineal». Ahora compara los
dos tamaños mayores, que es donde la curva se ve.

---

## Lo que NO está probado

Esto no es una lista de pendientes: es el límite exacto de lo que se puede
afirmar hoy.

- **Nada contra Firestore.** Ni una escritura. No se sabe el ritmo real, ni cómo
  se comporta el lote de 400 bajo contención, ni si la idempotencia aguanta de
  verdad contra la base (la llave es estable — que `set(id)` no duplique es una
  propiedad de Firestore, no de este código).
- **Nada con la red por medio.** Los 5.1 s de 50 000 filas son CPU en un
  proceso; una importación real añade latencia por lote.
- **Ningún arranque en frío.** No hay ruta sin servidor todavía.
- **50 000 no cabe hoy en una función sin servidor.** 629 MB deja muy poco
  margen bajo el tope habitual. **10 000 va holgado.** El arreglo —dos pasadas
  en flujo— está descrito en el registro de riesgos, P1-2.
- **Ninguna concurrencia.** Un solo trabajo a la vez. Dos importaciones
  simultáneas en el mismo consultorio no se han medido.
- **Ningún adjunto real.** El contrato se probó con metadatos sintéticos.
- **Ningún padrón real.** Todo el emparejamiento se midió contra datos
  generados, y eso sesga un número concreto: ver abajo.

---

## El sesgo del fixture que hay que saber leer

En el fixture de 50 000, los emparejamientos dudosos detectados cayeron de 557 a
2 al poner el tope de bloque.

Ese número **no se puede trasladar a un padrón real**. El generador usa 16
nombres y 16 apellidos, así que los bloques por nombre se saturan de una forma
que un consultorio de verdad no reproduce — en un padrón real la variedad de
apellidos es mucho mayor y los bloques se llenan mucho menos.

Pero **no está medido sobre datos reales**, así que queda como riesgo abierto
(P2-2), no como detalle resuelto. Mientras tanto, `senalesSaturadas` sale en el
resultado del ensayo: «no busqué en todos los sitios» tiene que poder decirse, y
no es lo mismo que «no hay duplicados».

---

## Cómo volver a medir

```bash
npx tsx scripts/migration/arnes.mjs --filas 1000,10000,50000 --padron 5000
```

Deja `agent-state/MIGRACION_ESCALA.json` para comparar entre corridas — una
regresión de rendimiento sólo se ve contra la anterior. El arnés **sale con
error** si las cuentas no cuadran o si el coste por fila se duplica entre los dos
tamaños mayores.
