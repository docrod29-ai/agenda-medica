# Tamizaje preventivo — propuesta de fuente, para revisión del Dr.

**Estado: PROPUESTA. Nada de esto está aplicado al código todavía.**
Este documento existe para que el dueño lo revise y acepte, rechace o corrija
renglón por renglón. Hasta que lo haga, `src/lib/expediente/preventivo.ts` sigue
exactamente como está, con su `ADVERTENCIA_PREVENTIVO` puesta.

Responde a la pregunta que el registro de motores tiene escrita para el motor
`medicina-preventiva`:

> «El módulo declara en su encabezado que sus recomendaciones no vienen de
> fuentes primarias. ¿Qué guía de tamizaje (USPSTF, CENETEC, u otra) adopta como
> fuente para reescribir TAMIZAJES?»

---

## 0. Cómo se verificó esto, y qué NO se pudo hacer

Se verificó **contra la fuente**, no desde la memoria del modelo. Cada renglón
lleva su enlace y su fecha.

**Lo que NO se pudo hacer, dicho para que nadie crea que este documento vale más
de lo que vale:** el entorno donde se preparó bloquea la apertura directa de
`uspreventiveservicestaskforce.org`, `cdc.gov` y `dof.gob.mx`. La verificación se
hizo por búsqueda, que devuelve el contenido de esas páginas con su URL y su
fecha, pero **no equivale a haber leído el documento primario completo**. Es
exactamente la debilidad que el encabezado del módulo ya declaraba, sólo que
ahora está acotada: se sabe qué dice cada fuente en el punto concreto que importa,
y el enlace está a un clic.

Por eso este documento **no autoriza a borrar `ADVERTENCIA_PREVENTIVO`.** Propone
cambiarla por una más honesta y más útil (§4), no quitarla.

**Ninguna cifra de este documento se inventó.** Donde la fuente no dice un
número, aquí no hay número: hay una pregunta.

---

## 1. La decisión de fondo: no es «USPSTF o CENETEC». Son dos capas

La pregunta del registro ofrece elegir una. Investigándolo aparece que elegir una
sola es lo que está mal, y por una razón concreta: **en México hay Normas
Oficiales Mexicanas que fijan edades de tamizaje distintas a las de USPSTF, y una
NOM no es una recomendación — es de observancia obligatoria.**

Las tres divergencias medidas:

| Tamizaje | USPSTF dice | La NOM mexicana dice | ¿Importa? |
|---|---|---|---|
| Mastografía | 40–74 años, bienal | **40–69 años**, bienal (NOM-041-SSA2-2011) | Sí: entre 70 y 74 el sistema recomendaría algo que la NOM no contempla como tamizaje |
| Citología cervical | 21–65 años | **25–64 años** (NOM-014-SSA2-1994) | Sí: cuatro años de diferencia al inicio y uno al final |
| Glucosa / diabetes | 35–70 años **con sobrepeso u obesidad** | **desde los 20 años**, cada 3 años, en población general con factores de riesgo (NOM-015-SSA2-2010) | Sí, y mucho: México tamiza 15 años antes |

La de diabetes no es un tecnicismo. México tiene una prevalencia de diabetes que
no se parece a la de la población en la que se calibró la recomendación
estadounidense, y la NOM lo refleja bajando la edad de inicio.

### Propuesta

**Base: USPSTF.** Es versionada, fechada, citable públicamente y se actualiza; ya
es de donde viene la mayoría del módulo.

**Encima: una capa mexicana** que, donde la NOM difiere, lo diga en pantalla en
vez de elegir en silencio por el médico. El campo `organismo` ya existe en el
tipo `Tamizaje`; haría falta un campo hermano para la variante nacional.

**Por qué así y no eligiendo una:** elegir sólo USPSTF deja al médico fuera de la
norma que le aplica. Elegir sólo la NOM congela el producto en documentos de
1994, 2010 y 2011 y pierde todo lo posterior (el tamizaje de colon a los 45, la
tomografía de pulmón, la hepatitis C). Enseñar las dos es más trabajo de
interfaz, y es lo único que no le miente a nadie.

**Esto es política clínica y por eso no se aplica solo. Necesita tu sí.**

---

## 2. Montón A — transcripción. Léelo por encima

Verificado contra la fuente y **coincide** con lo que el código ya dice. No hace
falta que decidas nada; sólo que no te sorprenda.

| Tamizaje | Lo que dice el código hoy | Verificado |
|---|---|---|
| Mastografía | 40–74, bienal, USPSTF 2024 | ✅ USPSTF, grado B, final del 30-abr-2024. «Biennial screening mammography in women aged 40 to 74 years» |
| Colon | 45–75 | ✅ USPSTF 2021 — **con un matiz, ver montón B** |
| Tomografía de pulmón | 50–80, ≥20 paquetes-año, fumador actual o que dejó hace <15 años, anual | ✅ USPSTF 2021, textual |
| Próstata (APE) | 55–69, decisión compartida, recomendación C | ✅ USPSTF, grado C |
| Densitometría | mujer ≥65 | ✅ USPSTF, actualizado el 14-ene-2025 — **con un matiz, ver montón B** |
| Lp(a) | una vez en la vida, ACC/AHA 2026, COR 1 | ✅ Guía ACC/AHA/Multisociedad de dislipidemia, publicada el 13-mar-2026 |
| Perfil de lípidos | ACC/AHA 2026 | ✅ La guía existe y es la vigente: sustituye a la de 2018 |
| VIH | 15–65, al menos una vez | ✅ USPSTF |
| Hepatitis C | 18–79, al menos una vez | ✅ USPSTF |
| Ansiedad | 19–64, GAD-7 | ✅ USPSTF 2023 |
| Depresión | ≥12, instrumento validado | ✅ USPSTF |

---

## 3. Montón B — esto sí necesita tu ojo

Son **seis**. Ninguna es un error grave del código; son sitios donde el código
dice algo más simple de lo que dice la fuente, y esa simplificación cambia lo que
el médico ve.

### B1 · Colon: el código no distingue dos grados que la fuente sí distingue

USPSTF **no** da una sola recomendación de 45 a 75. Da dos:

- **50–75 → grado A** (certeza alta, beneficio neto sustancial)
- **45–49 → grado B** («recomienda *ofrecer*» el tamizaje)

El código los aplana en «45–75». No es falso, pero un paciente de 47 años y uno
de 60 no están en la misma situación, y hoy el sistema los pinta igual.

**Pregunta:** ¿quieres que el módulo distinga los dos grados, o prefieres el
renglón simple?

### B2 · Mastografía: la nota cita un esquema sin decir de quién es

El código dice «cada 2 años (algunos esquemas la hacen anual de los 45 a los 54)».
Ese esquema anual **no es de USPSTF** — es de la American Cancer Society. Tal como
está escrito, cuelga del `organismo: USPSTF` del mismo renglón y parece suyo.

**Propuesta:** atribuirlo explícitamente a ACS, o quitarlo. **Necesita tu sí.**

### B3 · Densitometría: falta un paso que la actualización de 2025 añadió

El código dice «antes de los 65 si hay factores de riesgo». La actualización del
14-ene-2025 es más específica: en posmenopáusicas <65 con ≥1 factor de riesgo,
USPSTF recomienda **usar una herramienta de evaluación de riesgo** (tipo FRAX)
para decidir si tamizar — no el juicio a secas.

**Pregunta:** ¿lo añadimos, y con qué herramienta?

### B4 · Hepatitis B: USPSTF y CDC no dicen lo mismo, y el código sigue al CDC

- **USPSTF**: tamizar sólo a **población de riesgo aumentado** (grado B).
- **CDC**: tamizar **a todo adulto al menos una vez** en la vida.

El código dice «≥18, al menos una vez, organismo: CDC». La atribución es correcta
y la elección es defendible — pero es una elección, y hoy no está declarada como
tal. Si adoptas USPSTF como base (§1), éste es el renglón donde te sales de ella a
propósito.

**Pregunta:** ¿te quedas con el CDC aquí? (Mi lectura: sí — México tiene
prevalencia de hepatitis B mayor que la de EE. UU., y el tamizaje universal es más
defendible aquí que allá. Pero es tu decisión, no mía.)

### B5 · Las tres divergencias con la NOM (§1)

Mastografía 74 vs 69 · citología 21 vs 25 · diabetes 35 vs 20.
**Es la decisión principal de este documento.**

### B6 · Citología cervical: USPSTF está a media actualización

El borrador de USPSTF (comentario público de dic-2024 a ene-2025) mueve la
estrategia de 30 a 65 años: **prueba de VPH sola cada 5 años** como preferente, y
**la co-prueba deja de recomendarse**. El código de hoy tiene la co-prueba como
opción principal de los 30 a los 65.

No pude confirmar desde aquí si ya salió la versión final. **Es el único renglón
donde el código podría estar quedándose atrás de la fuente.**

**Pregunta:** ¿lo dejamos como está hasta confirmar la versión final, o ya
adoptas VPH sola como preferente?

---

## 4. Lo que propongo hacer con `ADVERTENCIA_PREVENTIVO`

Hoy dice que las recomendaciones «no se derivaron de un documento leído en esta
herramienta». Después de esto, esa frase es medio falsa: once renglones sí se
cotejaron contra su fuente, con fecha.

**No se borra.** Se propone sustituirla por una que diga la verdad nueva: qué se
cotejó, cuándo, contra qué, y que las guías cambian de versión. El valor de la
advertencia era avisar de que esto envejece — y eso sigue siendo cierto.

Redacción propuesta, para que la apruebes o la corrijas:

> Estas recomendaciones se cotejaron contra la fuente que cada una declara, en
> septiembre de 2026, por búsqueda de la página del organismo emisor — no leyendo
> el documento primario completo. Las guías de tamizaje cambian de versión con
> frecuencia. Donde una Norma Oficial Mexicana difiere de la fuente internacional,
> se muestran ambas.

---

## 5. Lo que este documento NO cubre

- **No toca el código.** Ni una línea, a propósito.
- **No cubre los otros 21 renglones del bloque D**: inmunología, farmacovigilancia,
  prescripción segura, esquema de vacunación, profilaxis quirúrgica, ajuste renal,
  PROA, FIB-4, gineco, biomarcadores lipídicos, y los 11 de Hospital/UCI.
- **No verifica la periodicidad** de cada tamizaje con el mismo detalle que la edad
  de inicio y fin. Se verificó lo que decide a quién se le ofrece.
- **No leí ninguna NOM completa.** Las tres divergencias de §1 salen de la ficha
  de cada norma, no de su texto íntegro. Antes de cablear la capa mexicana hay que
  leerlas — y ahí sí tiene que mirar un humano con cédula.

---

## 6. Fuentes

- USPSTF · Mama: <https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/breast-cancer-screening> (final 30-abr-2024, grado B)
- USPSTF · Colon: <https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/colorectal-cancer-screening> (2021; A 50–75, B 45–49)
- USPSTF · Pulmón: <https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/lung-cancer-screening> (2021)
- USPSTF · Osteoporosis: <https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/osteoporosis-screening> (final 14-ene-2025)
- USPSTF · Cérvix (borrador): <https://www.uspreventiveservicestaskforce.org/uspstf/draft-recommendation/cervical-cancer-screening-adults-adolescents>
- USPSTF · Hepatitis B: <https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/hepatitis-b-virus-infection-screening> (grado B, riesgo aumentado)
- ACC/AHA 2026 · Dislipidemia: <https://www.ahajournals.org/doi/10.1161/CIR.0000000000001423> (13-mar-2026)
- NOM-041-SSA2-2011 · Cáncer de mama: <https://dof.gob.mx/nota_detalle.php?codigo=5194157&fecha=09/06/2011>
- NOM-014-SSA2-1994 · Cáncer cervicouterino: <https://www.gob.mx/cms/uploads/attachment/file/10397/NOM-014-SSA2-1994.pdf>
- NOM-015-SSA2-2010 · Diabetes mellitus: <https://dof.gob.mx/normasOficiales/4215/salud/salud.htm>

---

**Fecha:** 2026-09-05 · **Estado:** esperando revisión del dueño.
Mientras este documento no esté aceptado, `preventivo.ts` no se toca.
