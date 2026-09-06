# Decisiones aplicadas por omisión — EXPEDIENTES

Hallazgos que pedían una decisión del dueño y en los que se aplicó el **valor
seguro** del briefing (escalar en vez de contestar, preguntar en vez de asumir,
bloquear en vez de permitir, mostrar en vez de esconder), o la recomendación por
omisión del auditor confirmada por el equipo rojo.

Cada fila dice **dónde cambiarla** para que el dueño pueda revertirla en una línea.

| Hallazgo | Decisión aplicada | Dónde cambiarla | Por qué es la segura |
|---|---|---|---|
| **RT-001** | Un solo homónimo sin teléfono **ya no funde**: se exige una segunda señal (`PUNTAJE_MINIMO_PARA_FUNDIR = 65`). El dueño podía preferir seguir fundiendo por nombre a secas y marcar la cita como «expediente elegido por nombre». | `src/lib/pacientes/duplicados.ts` — bajar la constante a 60 restaura la conducta anterior; la alternativa de RT-001 exigiría además marcar la cita, que no está construida. | Crear un duplicado parte el historial y es recuperable; fundir con quien no es cuelga la nota, la receta y el cobro de otra persona, y no se ve como un error. El propio módulo ya lo tenía escrito: «ante la duda se CREA. Siempre.» |
| **ASE-003** (fecha ambigua) | La fecha `dd/mm` vs `mm/dd` **se pregunta una vez por archivo**, con día/mes/año preseleccionado (es-MX). No se adivina por fila. | `src/lib/csv-pacientes.ts` → `ORDEN_DE_FECHA_POR_OMISION`; la pregunta vive en `migracion/page.tsx`. | clinical-safety §6: ante ambigüedad crítica se pregunta. De esa fecha comen la edad, la dosis pediátrica y el motor de duplicados. |
| **ASE-003** (fecha ilegible) | Lo que no se entiende **no se escribe** y queda como reparo visible. El año de dos cifras se rechaza en vez de elegirle siglo. | `fechaISODesdeTextoDeArchivo` en `src/lib/csv-pacientes.ts`. | Rellenar con lo plausible es el fallo más caro: no falla, no rompe pruebas, y sale impreso. Es el mismo error que ASE-025 tenía vivo en el CURP. |
| **ASE-005** (sexo «M») | Una «M» suelta **no se elige**: en México conviven H/M (Hombre/Mujer) y M/F (Masculino/Femenino), y significan cosas opuestas. Sólo se resuelve si la propia columna del archivo lo aclara. | `normalizarSexoImportado` / `deducirQueSignificaLaM` en `src/lib/csv-pacientes.ts`. | Preguntar en vez de asumir. Leer la pista de la columna es leer un hecho del archivo, no adivinar. |
| **A-013 / ASE-005** (CURP inválido) | El CURP mal formado **no se guarda** y se declara en la vista previa. La alternativa que el auditor dejaba abierta —retirar el campo de la importación— no se aplicó: eso es *esconder*, y el briefing pide *mostrar*. | `construirFilas` en `src/lib/csv-pacientes.ts`. | El CURP es identidad oficial: guardar «INVALIDO123» ensucia el expediente y no funde a nadie (el motor exige 18 caracteres). Descartarlo en silencio sería una corrección invisible (regla 3). |
| **ASE-007** (umbral de duplicado en la importación) | **No se subió el umbral**: se sigue omitiendo con cualquier coincidencia, y lo que se añade es la evidencia («coincide con X — mismo nombre y mismo teléfono») y la salida («Es otra persona — impórtala»). | `clasificarFilas` en `src/lib/csv-pacientes.ts` y la vista previa de `migracion/page.tsx`. | El umbral bajo es deliberado y está razonado en el módulo: evita duplicar el consultorio entero al reimportar. El equipo rojo lo confirmó. Lo que faltaba era enseñar y dejar decidir, no cambiar el criterio. |
| **ASE-008** (.xlsx) | Se **rechaza** el .xlsx diciendo cómo convertirlo, en vez de leerlo. | `cargarArchivo` en `migracion/page.tsx`. Leer .xlsx de verdad exigiría montar SheetJS en el cliente. | Prometer menos y cumplirlo. El texto que prometía Excel era la mitad del defecto. |
| **ASE-009** (fusión) | Sobrevive el expediente con **más notas** (empatados, el más antiguo); el absorbido se **marca, no se borra**; los campos sólo rellenan huecos y los conflictos se declaran. | `planDeFusion` en `src/lib/pacientes/fusion.ts`. | Mover una nota firmada es tocar un documento medicolegal: el criterio que menos documentos mueve es el que menos puede romper. Y fundir a dos personas distintas por error, sin rastro, sería irreparable. |
| **ASE-010** (ligar ARCO) | Ligar exige **una persona con la identificación delante** y anotar cuál fue. **No** hay emparejamiento automático por nombre parecido, ni siquiera como sugerencia. | `LigarExpedienteModal` en `cumplimiento/page.tsx` y `src/lib/compliance/ligar-solicitud-arco.ts`. | Ligar decide a quién se le entrega —o a quién se le suprime— el expediente. Un «probable» aquí es el mismo defecto de RT-001 con consecuencias legales. |
| **ASE-011** (identidad) | La afirmación sale de la **casilla**, y sin ella la acción no corre. | `entregarAcceso` / `ejecutarOposicion` / `confirmarResolucion` en `cumplimiento/page.tsx`. | Bloquear en vez de permitir. El servidor documenta que «el médico afirma que verificó»; que lo afirmara el cliente hacía falsa la firma de la bitácora. |
| **ASE-012** (revocación) | La revocación **apaga el contacto** reutilizando `/api/arco/oponerse`, en vez de escribir una segunda ruta. Marcar además el consentimiento como revocado en el expediente **no se hizo**: necesita un campo nuevo en `Patient` (handoff a SEGURIDAD) y queda dicho en la resolución en vez de fingido. | `confirmarResolucion` en `cumplimiento/page.tsx`; el campo, en `handoff-EXPEDIENTES.md`. | Reutilizar la ruta que ya sabe apagar el contacto evita dos implementaciones que divergen. Y declarar lo que falta es mejor que prometerlo. |
| **ASE-026** (formato de la entrega) | Se entregan **los dos** archivos: el JSON del acuse (intacto, es sobre lo que se calculó el hash) y una **copia legible imprimible** con el mismo hash. No se genera PDF. | `src/lib/compliance/copia-legible-arco.ts`. | Si un HTML imprimible satisface el «formato legible» del Art. 33 LFPDPPP lo decide el abogado del consultorio: queda como `NEEDS_LEGAL_REVIEW` en el módulo. Entregar sólo el JSON era peor y entregar sólo el PDF rompería el acuse. |
| **ASN-007** (IMC) | El IMC se **calcula** con el motor determinista que ya existe (`cardiometabolico/obesidad.imc`) y **no se clasifica**: no sale «Sobrepeso» ni «Obesidad clase I». | `ResumenPaciente.tsx`. | La fórmula es aritmética; la clasificación es un juicio clínico con fuente (consenso AACE 2025) y su sitio es el copiloto con su sello. clinical-safety §2. |
| **ASN-008** (borrador) | El borrador **se marca**, no se filtra. | `fuenteDeSignos` en `ResumenPaciente.tsx`. | Mostrar en vez de esconder: el signo que el médico acaba de tomar es información real, y esconderlo sería el defecto contrario. |
| **MP-017** (edad) | Con fecha de nacimiento, la edad **se deriva al guardar** y el campo se enseña de sólo lectura. Sin fecha, la edad tecleada se conserva (el caso que el dueño pidió mantener el 29-jul-2026). | `construirGuardadoDePaciente` en `src/lib/pacientes/campos-que-se-guardan.ts`. | Una sola fuente de verdad para un dato derivable. La que envejece mal es la que imprime la receta. |
| **PG-012** (motivo) | Invalidar los enlaces **exige un motivo**, con tres motivos escritos y texto libre. | `DatosPaciente` en `expediente/[patientId]/page.tsx`. | El asiento ya existía; lo que faltaba era el único dato que contesta la pregunta que se le va a hacer. Una lista cerrada obligaría a mentir en el cuarto caso, así que hay texto libre. |
| **D-022** (procedencia documental) | Se corrigió lo que el comentario afirmaba de más y se **declaró** que las tres superficies documentales sólo necesitan montar la pieza. **No se montó**: `nota/`, `receta/` y `orden/` son de RECETA-DOCS. | `handoff-EXPEDIENTES.md`. | No editar archivos ajenos: el conflicto de fusión sale más caro que el handoff. |

## Lo que NO fue una decisión, aunque lo pareciera

- **«Las dos pantallas que hacen lo mismo»** (`/pacientes` y `/expedientes`) ya
  estaban fusionadas antes de esta reparación: `/expedientes` es un redirect de
  17 líneas a `/pacientes`, con la razón escrita en el propio archivo. Se
  comprobó y se dejó como está — lo confirma `13-QUITAR-LO-INNECESARIO.md`, que
  lo cita como el ejemplo a seguir para `/corte-caja`. No había nada que
  fusionar ni esconder en esta rebanada.
- **ASE-001 y `similitudNombre`**: NO se bajó `UMBRAL_NOMBRE` para que un
  apellido suelto casara. `similitudNombre('iparraguirre', 'Tadeo Iparraguirre
  Nolasco')` da 0.667, y 0.667 es exactamente lo que da «María» contra «María
  López García» — el nombre de pila de media consulta. Ese umbral lo usa el
  motor de DUPLICADOS para decidir si dos expedientes son la misma persona;
  tocarlo para arreglar la búsqueda habría cambiado esa decisión en todo el
  producto. Buscar y comparar identidades son dos trabajos distintos, y el
  segundo se dejó intacto: la búsqueda por subcadena vive aparte, en
  `pacientes/busqueda-local.ts`. El equipo rojo ya lo había señalado, y el
  golden REP-037 lo fija como control.
