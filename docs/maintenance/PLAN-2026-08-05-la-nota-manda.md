# La nota manda — plan para dejar de gritarle al médico

**Escrito el 5-ago-2026, con las capturas de su consulta real delante.**

## Lo que pasa hoy

Después de dictar, antes de ver su nota, el médico se encuentra **ocho bloques de
aviso apilados** con unos cuarenta elementos. Tiene que leerlos todos para
descubrir que **sólo uno le impide firmar**.

| Bloque | ¿Impide firmar? | ¿Pide una decisión suya? | Qué es en realidad |
|---|:---:|:---:|---|
| «Datos críticos no documentados» (9 viñetas) | no | no | **La misma información** que los bloques 3, 4 y 7, dicha otra vez |
| 20 tarjetas «Extraído de tu dictado» + botón Quitar | no | no — lo dice él mismo: «no tienes que aprobar nada» | Dos pantallas de scroll para nada |
| **Dosis incompleta (5 medicamentos)** | **sí** | **sí** | Lo único que de verdad bloquea |
| No se dictó la vía (4) | no | un vistazo | Aviso legítimo, mal colocado |
| La nota afirma algo que se negó | no | sí | Aviso legítimo, mal colocado |
| PROA — reevaluar antimicrobiano | no | recomendación | Contenido clínico, no alerta |
| Conflictos detectados (5) | no | sí | Aviso legítimo, mal colocado |
| «5 trabajos automáticos dejaron de correr» | no | **no en consulta** | Operación de la plataforma |

El diagnóstico no es que sobren avisos: es que **están todos al mismo volumen**.
Cuando todo grita, nada se oye — y lo que se acaba ignorando es el que sí
importaba.

---

## Las dos piezas

### A. Lo que la IA no captó se ESCRIBE en la nota, no se reclama

Hoy: nueve viñetas pidiéndole al médico que resuelva huecos.

> · Dosis de dapagliflozina no especificada
> · Nombre exacto del esquema antifímico de 4 fármacos no confirmado
> · Reacción y severidad de las alergias a paracetamol y penicilina no especificadas

Eso es una **lista de tareas para él**. Pero un hueco documentado **ya es
documentación válida**: un internista no deja el renglón en blanco ni abre una
lista aparte, lo escribe donde toca:

> «Refiere esquema antifímico de cuatro fármacos cuyo nombre comercial no fue
> posible precisar durante el interrogatorio. Alergias a paracetamol y penicilina
> referidas por la acompañante, sin poder precisar reacción ni severidad.»

**La IA razona y redacta; el médico lee y firma.** Es exactamente lo que hace un
buen residente al pasar la visita: no entrega una lista de lo que no supo,
entrega la nota con lo que no se pudo precisar, dicho como se dice.

Lo que ya está resuelto y no debe volver a aparecer como reclamo:

- **Lo que el paciente no sabe** deja de ser un hueco en cuanto se escribe que no
  lo sabe. «Antihipertensivo no especificado» es un hallazgo clínico legítimo, no
  un descuido del médico (v1060).
- **Lo que el modelo no captó** entra ya como vacío, no como «No especificada»
  (v1061), así que deja de contarse dos veces.

### B. Una sola barra, tres niveles

En lugar de ocho recuadros, **tres renglones**:

```
┌─ Antes de firmar ────────────── 1 bloquea · 6 por revisar ─┐
│ ● BLOQUEA   Falta la dosis de 5 medicamentos      [Ver]    │
│ ● REVISA    6 avisos                            [Abrir ▾]  │
│ ✓ YA EN LA NOTA   19 datos extraídos             [Ver ▾]   │
└────────────────────────────────────────────────────────────┘
```

Las reglas que la gobiernan:

1. **Rojo sólo lo que impide firmar.** Si no bloquea, no es rojo. Hoy hay tres
   recuadros rojos y dos de ellos no bloquean nada.
2. **Lo que no exige acción nace plegado.** Las 20 tarjetas de «Extraído» y el
   bloque PROA son contenido, no alertas: se cuentan en un renglón y se abren si
   el médico quiere.
3. **Un aviso, un sitio.** Que falte la dosis de dapagliflozina se dice UNA vez,
   no en «Datos críticos» y otra vez en «Dosis incompleta».
4. **Lo de la plataforma no vive en la consulta.** Los trabajos automáticos caídos
   son del tablero del dueño; salirle mientras atiende a un paciente es robarle
   atención por algo que no puede arreglar en ese momento. (El propio componente
   ya aprendió esta lección el 4-ago con los timeouts; el filtro se quedó corto.)
5. **Ningún aviso empuja la nota fuera de la pantalla.** La nota es lo que vino a
   ver.

---

## Orden de ejecución

| # | Qué | Por qué primero |
|---|---|---|
| 1 | Sacar el aviso de operación de la pantalla clínica | Un renglón, cero riesgo, y es el que él señaló |
| 2 | Fundir los avisos en una sola barra de tres niveles | Es donde está el 80 % del ruido |
| 3 | Que los huecos se redacten dentro de la nota | Es la pieza inteligente y la que pidió; toca el prompt y el motor |
| 4 | Plegar «Extraído de tu dictado» y PROA | Dependen de que 2 exista |

---

## Lo que NO se toca

- **Las compuertas de firma que él pidió** (v1058, v1059, v1060) siguen. El
  problema nunca fue que bloqueara: fue que bloqueaba desde el mismo montón donde
  estaba todo lo demás.
- **Ningún aviso desaparece.** Se recolocan y se pliegan. Un aviso escondido y un
  aviso ahogado entre cuarenta fallan igual, y aquí no se está cambiando uno por
  otro: lo que bloquea queda más visible que hoy, no menos.
- **Ninguna cifra clínica se inventa.** Redactar un hueco es decir que no se
  precisó, nunca rellenarlo.
