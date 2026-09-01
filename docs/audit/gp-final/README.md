# GP-FINAL — el Golden Path del consultorio, recorrido en un navegador

> **Qué es.** El consultorio recorrido de punta a punta **como médico y como
> paciente**, en un Chromium de verdad, contra un build de producción y los
> emuladores de Firebase. No es una auditoría de módulos sueltos: el objeto de
> estudio es el **recorrido**.

## Cómo se corre

```bash
bash scripts/golden-path/arnes-gp-final.sh
```

Deja tres actas JSON en esta carpeta. **Un P0 en cualquiera de las tres detiene
el release.**

| Acta | Qué recorre |
|---|---|
| `acta-medico.json` | Pasos 1-23: login → agenda → paciente → consulta → grabación → consulta larga → autosave → desconexión → reload → recuperación → corrección → diagnóstico → plan → prescripción → firma → receta → **liberación** → cierre |
| `acta-paciente.json` | Pasos 24-34: enlace → token → sólo lo liberado → receta → citas → teleconsulta → **revocación** → error → límite → reintento |
| `acta-tortura.json` | Escenarios A-Q |

## Por qué no corre en CI

Necesita emuladores de Firebase, un build completo y un Chromium. La suite de
vitest (10 494 casos) sigue siendo la compuerta de cada cambio; esto es la
compuerta del **release**, y se corre a mano antes de proponer uno.

## Un caso que no distinguía — REG-428

GP-33 dispara **cuarenta peticiones en paralelo** contra el freno del portal del
paciente (`action: 'paquetes'`, la acción clínica, tope 15/600s) y contaba sólo
los `429`. Eso no basta: **tres desenlaces distintos dan «cero 429»** y dos son
correctos.

| Respuesta | Qué significa | ¿Defecto? |
|---|---|---|
| `429` | el freno contó y cortó | no |
| `503` | el freno **no pudo contar** y por eso no deja pasar (`limitarEstricto`, fail-closed) | no |
| `200` en las cuarenta | **no hubo freno** | **sí, P1** |

Cuarenta transacciones en paralelo sobre el **mismo** documento de `rate_limits`
es justo donde el contador tiene más razones para no poder contar, así que el
`503` no es un caso raro: es el esperable bajo ráfaga.

Medido el 1-sep con la distribución puesta:

```
30/40 frenados — distribución {"200":10,"429":25,"503":5}
```

El freno funciona. El caso acepta ahora `429` **o** `503` e imprime la
distribución entera, así que un rojo sólo puede querer decir una cosa.

**La lección, que vale para cualquier caso de este arnés**: si la evidencia no
separa el desenlace bueno del malo, el caso falla en la dirección peligrosa — se
pone rojo cuando el producto se porta bien, y un caso que da falsos rojos se
aprende a ignorar.

## Lo que este arnés NO cubre, y hay que decirlo

- **No hay proveedor de ASR ni de IA.** Así que no se dicta de verdad: no se
  puede recorrer la transcripción tardía (escenario F) ni comprobar en navegador
  que la identidad del paciente no se aprende (paso 15, H-19). Los dos casos
  tienen sus goldens sellados; lo que falta es la vuelta por el navegador.
- **No corre contra Firestore real**, sino contra el emulador. Las reglas las
  prueba la suite del emulador (`npm run test:emulador`).
- **No se manda ningún WhatsApp** ni se emite ninguna receta real.
- Los datos son **sintéticos** (`data-privacy.md`: cero pacientes reales).

## Cómo leer un caso

Cada caso lleva `id`, `titulo`, `resultado` (`OK` · `DEFECTO` · `NO_EJECUTADO`),
`evidencia` y, sólo si falla, `severidad`. Un caso OK no lleva severidad, para
que un `grep P0` sobre el acta no devuelva los que pasaron.

`NO_EJECUTADO` **no es verde**: es «esto no se pudo comprobar aquí», con el
motivo escrito. Un verde por vacío es la peor clase de verde — parece cobertura
y no lo es.

## Lo que encontró

`REG-336` — se podía firmar una nota sin nombre de quien firma, y entonces el
paciente no recibía su hoja **nunca**, porque `nota.firma` es inmutable. Estaba
detrás de los 10 480 casos en verde de la suite: ninguna prueba de unidad podía
verlo, porque el hueco estaba **entre** dos compuertas que nadie había comparado.

## Contra los instrumentos, también

Durante esta corrida el arnés se equivocó ocho veces y estuvo a punto de reportar
ocho defectos que no existían: leyó el texto del diálogo de consentimiento y creyó
que grababa; buscó el fármaco en una redacción que se había inventado el fixture;
midió una nota sembrada en vez de la recién firmada; midió la excepción documentada
de `claveEncuentro` en lugar de su regla; llamó cruce de pacientes al tablero
haciendo su trabajo; y declaró rota una pantalla porque la palabra «500» aparece
en «500 mg».

Queda escrito porque es la parte que no se ve: **antes de creerle a una prueba
que dice que el producto está roto, hay que descartar que la rota sea la prueba.**
