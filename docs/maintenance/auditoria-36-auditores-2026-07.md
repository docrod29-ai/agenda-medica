# Auditoría COMPLETA — 36 auditores × 452 agentes (2026-07)

Run wf_9db46697-3a2, 452/452 agentes, 0 errores. Confirmados 2/2: **181** (dedup ≈ 178 únicos).
Severidad: P0:19 P1:78 P2:78 P3:6. Grupos: {'clinico': 64, 'infecto': 56, 'ingenieria': 44, 'diseno': 17}.

Reparado y desplegado: v568→v586 (ver public/sw.js). Muchos infecto/antibiograma ya cerrados.


### 1. [P0] (clinico) El calculador de dosis pediátrico ignora por completo la edad: al recién nacido le ofrece fármacos contraindicados en el neonato con un botón de un clic hacia la nota · **valida-med**
- `src/components/PanelPediatria.tsx:44` · Neonatologia
- Impacto: Un neonato es exactamente el paciente donde estos fármacos causan daño: TMP-SMX desplaza bilirrubina (riesgo de kernícterus), la nitrofurantoína produce hemólisis en el recién nacido, el ibuprofeno no se usa en el lactante pequeño y la ceftriaxona compite con la bilirrubina y precipita con calcio. La herramienta que debería frenar el error lo propo
- Arreglo: Añadir a FarmacoPed un campo obligatorio de edad mínima (p. ej. `edadMinimaMeses` y/o `edadMinimaDias`) y hacer que `calcularDosisPediatrica` reciba la edad y devuelva un estado bloqueado ('contraindicado a esta edad') en lugar de un rango. En el panel, pasar `edadMeses` al useMemo de dosis y renderizar esos fármacos deshabilitados, en rojo y sin botón 'Nota'. Mientras un neonatólogo no valide un 

### 2. [P0] (clinico) La cefazolina NO está en la familia de betalactámicos: la compuerta de firma no bloquea la profilaxis quirúrgica en alérgicos a penicilina
- `src/lib/expediente/medical-dictionary.ts:63` · Cirugia General
- Impacto: El paciente alérgico a penicilina recibe la cefalosporina de primera generación más usada en quirófano sin que ninguna alerta salte ni se bloquee la firma. Riesgo de reacción cruzada / anafilaxia en inducción anestésica. Además el sistema da una falsa sensación de seguridad: el médico ya vio que la app SÍ bloquea con cefalexina, así que asume que l
- Arreglo: Unificar en una sola fuente de verdad: hacer que validarAlergiasVsMedicamentos consuma FAMILIAS_ALERGIA de copiloto.ts (que ya está completo y comentado), o como mínimo añadir a FAMILIA_BETALACTAMICOS 'cefazolina', 'cefoxitina', 'ceftazidima', 'cefadroxilo', 'cefalotina', 'cefixima', 'cloxacilina', 'sulbactam'. Idealmente detectar por prefijo de clase ('cef'/'cefa'/'cefta'…) más lista de excepcion

### 3. [P0] (clinico) Gentamicina y amikacina son los ÚNICOS fármacos del catálogo sin ningún tope: con el peso mal capturado la app imprime miles de miligramos sin advertencia · **valida-med**
- `src/lib/expediente/pediatria.ts:48` · Neonatologia
- Impacto: La única red de seguridad del panel (el tope) no cubre a los aminoglucósidos. Una sobredosis de gentamicina o amikacina en un recién nacido produce sordera irreversible y daño renal. Y como `topeAplicado` es false, el médico no recibe ni siquiera el aviso visual de que algo se salió del rango.
- Arreglo: Declarar `topeDosis`/`topeDia` para gentamicina y amikacina (valores que debe fijar el médico) y, de forma más robusta, añadir una validación estructural en `calcularDosisPediatrica` que rechace o marque como sospechoso cualquier fármaco de FARMACOS_PED que carezca de tope, en lugar de devolver un rango sin recorte silenciosamente. Añadir también un rango de plausibilidad al peso en el panel (un h

### 4. [P0] (clinico) La contraindicación de AINE (y el ajuste de aminoglucósidos) en falla renal NUNCA se dispara: la tabla usa nombres de CLASE sin sinónimos · **valida-med**
- `src/lib/expediente/prescripcion-segura.ts:92` · Nefrologia
- Impacto: Daño directo al paciente: se prescribe un AINE en enfermedad renal crónica avanzada sin ninguna alerta, que es la causa evitable más frecuente de lesión renal aguda en el consultorio, y la nota de la 'triple whammy' —el escenario clásico de AKI ambulatoria— nunca llega al médico. Lo mismo para gentamicina/amikacina (nefro y ototoxicidad). Peor aún:
- Arreglo: Añadir `sinonimos?: string[]` a FarmacoRenal (igual que ya existe en RiesgoGestacional) y poblarlo para las entradas de clase: AINE con los principios activos que ya están enumerados en otras partes del repo (copiloto.ts:106-109 tiene la lista de la familia de alergia: ibuprofeno, naproxeno, diclofenaco, ketorolaco, indometacina, meloxicam, aspirina, celecoxib) y aminoglucósidos con gentamicina/am

### 5. [P0] (clinico) El campo "Alergias a antimicrobianos" del panel de inmunocomprometido no gatilla nada: el motor sigue recomendando e INSERTANDO trimetoprima/sulfametoxazol en un alérgico a sulfas · **valida-med**
- `src/lib/inmuno/recomendaciones.ts:72` · Reumatologia y Alergologia
- Impacto: Se prescribe una sulfonamida a un paciente con alergia a sulfas documentada en la propia herramienta, en la población donde la reacción grave (SJS/NET, DRESS, citopenias) es más frecuente. La alergia queda escrita en la nota mientras el plan de la misma nota indica el fármaco: además del daño, es un registro medicolegal que se contradice a sí mismo
- Arreglo: 1) Pasar v['hc_alergias'] a recomendaciones()/recsFarmacos() y gatear TODA mención de trimetoprima-sulfametoxazol: si hay alergia a sulfas, emitir la recomendación con la alternativa (el propio texto ya nombra atovacuona/dapsona/pentamidina) y marcar la severidad en alto, sin inventar dosis. 2) En nota.ts, no insertar el Medicamento 'Trimetoprima/sulfametoxazol' cuando haya alergia a sulfas. 3) Un

### 6. [P0] (infecto) Un organismo con el género abreviado («K. pneumoniae») apaga TODO el motor de Enterobacterales: sin carbapenemasa, sin alerta crítica, sin NOM-045 y sin aislamiento
- `src/lib/expediente/antibiograma/enterobacterales.ts:23` · Microbiologo clinico CLSI
- Impacto: Una KPC/NDM —el escenario más grave y más frecuente del módulo— pasa como un simple «MDR aproximado [sospecha]»: se pierde la alerta crítica, la terapia dirigida por clase de carbapenemasa, la notificación epidemiológica obligatoria NOM-045 y las precauciones de contacto. El paciente sigue con un carbapenémico inútil y el brote no se contiene. Bast
- Arreglo: Normalizar el organismo ANTES de aplicar cualquier regla: una función única (p. ej. en util.ts) que expanda las abreviaturas de género a partir del epíteto («k. pneumoniae»→klebsiella pneumoniae, «s. marcescens»→serratia, «p. mirabilis»→proteus mirabilis, «e. cloacae»→enterobacter cloacae, «c. freundii», «k. oxytoca», «m. morganii», «p. aeruginosa», «a. baumannii», «s. maltophilia», «e. faecium/fa

### 7. [P0] (infecto) El alias suelto 'avibactam' sigue casando «Aztreonam-avibactam»: una MBL (NDM) se informa como carbapenemasa de SERINA y se recomienda ceftazidima-avibactam, que es inactiva
- `src/lib/expediente/antibiograma/util.ts:154` · Microbiologo clinico CLSI
- Impacto: El perfil «aztreonam-avibactam S + aztreonam R + carbapenémicos R» es la firma de una metalo-β-lactamasa con serino-β-lactamasa coproducida (NDM, la carbapenemasa dominante en México según el prior que la propia app cita). El motor lo invierte: lo llama serina, pone ceftazidima-avibactam como primera opción dirigida —un fármaco que la propia app de
- Arreglo: Eliminar 'avibactam' de CEFTAZIDIMA_AVIBACTAM (dejar 'ceftazidima-avibactam', 'ceftazidima/avibactam', 'ceftazidima avibactam', 'cef-avi', 'caz-avi'), y corregir el test de util que lo fija como comportamiento esperado. Endurecer además la guarda (b) para que un sinónimo que sea SÓLO el nombre del inhibidor no case combinaciones con otra pareja. Y añadir una constante propia AZTREONAM_AVIBACTAM qu

### 8. [P0] (infecto) Un organismo abreviado («K. pneumoniae», «E. cloacae») apaga TODO el motor de Enterobacterales: carbapenemasa, BLEE, AmpC, MDR, NOM-045 y aislamiento
- `src/lib/expediente/antibiograma/enterobacterales.ts:23` · Infectologo clinico de adultos
- Impacto: Una KPC/NDM productora se muestra al médico como un antibiograma sin hallazgos: sin alerta crítica, sin obligación de notificar (NOM-045), sin precauciones de contacto y sin terapia dirigida. Un Enterobacter pierde la advertencia de desrepresión de AmpC bajo C3G. Es la falla más grave posible en un módulo de PROA y depende solo de cómo el laborator
- Arreglo: Centralizar el reconocimiento de especie en una sola función normalizadora que expanda las abreviaturas de género antes de comparar (p. ej. mapear /^([a-z])\.?\s+(\w+)/ a la lista de géneros compatibles con el epíteto, o simplemente añadir a las claves los epítetos de especie: 'pneumoniae' cuando NO hay contexto de Streptococcus, 'cloacae', 'aerogenes', 'marcescens', 'freundii', 'koseri', 'morgani

### 9. [P0] (infecto) Un nombre de organismo abreviado ('K. pneumoniae') desactiva en silencio todo el modulo de Enterobacterales: la CRE sale sin alerta, sin notificacion y sin aislamiento
- `src/lib/expediente/antibiograma/enterobacterales.ts:23` · Especialista en sepsis
- Impacto: Perdida silenciosa de la alerta critica mas importante del modulo. Una bacteriemia por Klebsiella productora de carbapenemasa reportada como 'K. pneumoniae' no genera fenotipo, ni consulta obligada a infectologia, ni terapia dirigida, ni notificacion NOM-045, ni precauciones de contacto — y la pantalla no muestra ningun aviso de que el organismo no
- Arreglo: (1) Normalizar el organismo en un solo lugar (util.ts) expandiendo la inicial de genero antes de cualquier match: mapa 'k.'->'klebsiella', 'e.'->'escherichia|enterobacter|enterococcus' segun epiteto, 's.'->'staphylococcus|streptococcus|serratia|salmonella|shigella' segun epiteto, etc., resolviendo por el epiteto especifico ('pneumoniae' tras 'k.' = Klebsiella). (2) Como red de seguridad independie

### 10. [P0] (infecto) Ertapenem R (resistencia INTRINSECA) dispara falsa carbapenemasa, notificacion NOM-045 y aislamiento en Acinetobacter y Pseudomonas
- `src/lib/expediente/antibiograma/nofermentadores.ts:104` · Especialista en sepsis
- Impacto: Un Acinetobacter o una Pseudomonas PLENAMENTE SENSIBLES a carbapenemicos se manejan como CRAB/carbapenem-R: se descarta el meropenem que si funciona, se escala a sulbactam a dosis altas o cefiderocol (toxicidad, costo, presion selectiva), se aisla al paciente y se dispara una notificacion epidemiologica obligatoria falsa. En sepsis por Acinetobacte
- Arreglo: Filtrar los agentes intrinsecamente resistentes antes de evaluar el criterio de carbapenem-R, igual que ya hace mdr.ts: const AGENTES_CARBA = CARBAPENEM.filter(a => !esIntrinsecamenteResistente(organismo, a)); const carbaR = algunoR(r, AGENTES_CARBA). Requiere pasar `organismo` a pseudomonas() y acinetobacter() (hoy solo reciben r). Alternativa minima y explicita: usar solo [IMIPENEM, MEROPENEM, '

### 11. [P0] (infecto) El alias suelto 'avibactam' hace que «Aztreonam-avibactam» se lea como ceftazidima-avibactam → una MBL se clasifica como carbapenemasa de SERINA y se recomienda CAZ-AVI (inactiva)
- `src/lib/expediente/antibiograma/util.ts:154` · Infectologo pediatrico
- Impacto: El aislamiento es un productor de metalo-β-lactamasa (NDM), que el propio módulo señala como el prior mexicano dominante (epidemiologia.ts, PRIOR_MEXICO). Ceftazidima-avibactam sola es INACTIVA frente a MBL — el motor lo dice en claseAlerta() y luego la prescribe. Es la recomendación exactamente opuesta a la correcta en una bacteriemia por CRE, y e
- Arreglo: Quitar 'avibactam' de CEFTAZIDIMA_AVIBACTAM (util.ts:154) y de FARMACO_ALIAS['ceftazidima-avibactam'] (clsi-breakpoints.ts:49), tal como ya se hizo con 'tazobactam' en PIP_TAZO (util.ts:119-122, con su comentario). Añadir la entrada propia AZTREONAM_AVIBACTAM y su clave en FARMACO_ALIAS. Endurecer coincideAntibiotico: cuando el sinónimo es SOLO el inhibidor, exigir que el nombre no traiga otro age

### 12. [P0] (infecto) El alias suelto 'avibactam' hace que Aztreonam-avibactam se lea como Ceftazidima-avibactam: una MBL (NDM) se clasifica como carbapenemasa de SERINA y se recomienda CAZ-AVI, que es inactiva
- `src/lib/expediente/antibiograma/util.ts:154` · Farmaceutico clinico PROA PK/PD
- Impacto: El único escenario en que un laboratorio prueba aztreonam-avibactam es la sospecha de metalo-β-lactamasa (NDM domina en México según el propio PRIOR_MEXICO del módulo). En ese caso exacto el motor invierte la clase de enzima y propone como terapia dirigida ceftazidima-avibactam, que el mismo archivo declara INACTIVA frente a MBL (enterobacterales.t
- Arreglo: Quitar 'avibactam' (y por simetría revisar 'cef-avi') de CEFTAZIDIMA_AVIBACTAM en util.ts:154, dejando sólo los sinónimos que nombran ceftazidima. Añadir una constante AZTREONAM_AVIBACTAM propia y consumirla en enterobacterales.ts (una fila aztreonam-avibactam S en un CRE debe REFORZAR la sospecha de MBL, no negarla). Blindar con un test que afirme clase 'MBL' para el caso de zz-az-avi.test.ts, qu

### 13. [P0] (ingenieria) Cualquier usuario autenticado puede LISTAR todas las invitaciones de todas las clínicas y unirse a una ajena
- `firestore.rules:486` · Ingeniero de sistemas (Firestore)
- Impacto: Fuga total de PHI cross-tenant (notas clínicas, diagnósticos, recetas, cobros) de cualquier consultorio que tenga una invitación pendiente, ejecutable por cualquiera que pueda registrarse. Es exactamente el P0 que /api/clinic/unirse decía haber cerrado: el servidor blindó el rol, pero la enumeración de códigos lo reabre por el costado.
- Arreglo: Cerrar el `list` del cliente igual que ya se hizo con clinic_members (línea 517: `allow list: if false;`) y servir el panel de invitaciones del médico por API con Admin SDK filtrando por la clínica del solicitante (mismo patrón que /api/clinic/miembros). El `allow get: if true` por código puede quedarse: es lo que necesita el invitado sin cuenta. Adicionalmente conviene que /api/clinic/unirse regi

### 14. [P0] (ingenieria) Un admin puede reapuntar su propia membresía a OTRA clínica (las reglas no fijan clinicId al actualizar clinic_members)
- `firestore.rules:527` · Ingeniero de sistemas (Firestore)
- Impacto: Escalada cross-tenant completa: lectura y escritura de pacientes, notas clínicas, cobros, farmacia e internamientos de un consultorio ajeno, más la capacidad de invitar y expulsar a su personal. Y es un viaje de ida: el atacante puede volver a su clínica original repitiendo la operación, así que ni siquiera pierde acceso a la suya.
- Arreglo: Fijar el tenant en la propia regla: `allow update: if isAdmin(resource.data.clinicId) && request.resource.data.clinicId == resource.data.clinicId;` — y, dado que ningún cliente escribe esta colección, lo más limpio es `allow update: if false;` y mover el cambio de rol a una ruta con Admin SDK que valide admin + mismo clinicId y deje bitácora. Conviene además revisar en producción si algún clinic_m

### 15. [P0] (ingenieria) Si falla la lectura del paciente, el autoguardado BORRA nombre y alergias de la nota y apaga la compuerta de alergias al firmar
- `src/app/(dashboard)/consulta/[patientId]/page.tsx:602` · Auditor de perdida de datos
- Impacto: Doble daño. (a) Pérdida de datos: el nombre del paciente y las alergias de la nota se sobreescriben en Firestore y, al ser el documento legal impreso, la nota sale sin identificar al paciente. (b) Seguridad del paciente: la única compuerta que impide firmar una prescripción contraindicada por alergia se desactiva sin ninguna señal visible, precisam
- Arreglo: Aplicar al paciente la misma guarda que ya existe para la nota: un estado `errorCargaPaciente` que (1) se muestre en pantalla, (2) haga que `guardarBorrador` salga temprano igual que con `errorCargaNota`, y (3) bloquee `firmar()` con un mensaje explícito ('no se pudo leer el expediente del paciente: no se puede verificar alergias'). Mientras el paciente no se haya leído, `construirNota` no debe em

### 16. [P0] (ingenieria) XSS almacenado en el perfil público /dr/[clinicId]: JSON.stringify dentro de <script> sin escapar, mismo origen que el panel
- `src/app/dr/[clinicId]/page.tsx:135` · Auditor de seguridad y PHI
- Impacto: Ejecución de JavaScript arbitrario en el origen de la aplicación. Un médico o asistente con sesión abierta que abra el enlace queda expuesto a robo del ID-token de Firebase y, con él, a lectura del expediente completo de sus pacientes (notas, diagnósticos, medicamentos, alergias) vía los endpoints Admin SDK, y a escritura en su clínica. Es fuga de 
- Arreglo: Escapar la carga antes de inyectarla: reemplazar `JSON.stringify(jsonLd)` por una versión que neutralice los caracteres peligrosos, p. ej. `JSON.stringify(jsonLd).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026')` (patrón estándar para JSON-LD embebido). Complementariamente: (a) sanitizar/recortar bioPublica, direccion y texto de reseña en el servidor al guardarlos, y (b) eva

### 17. [P0] (ingenieria) Salir de la consulta grabando CORROMPE el audio de recuperación: el último fragmento pisa el chunk 0 (la cabecera WebM)
- `src/hooks/useGrabacionAudio.ts:433` · Auditor de perdida de datos
- Impacto: Pérdida total del audio de una consulta ya grabada, justo en el escenario para el que existe el crash recovery. El médico ve el mensaje 'El audio quedó GUARDADO en este dispositivo — reintenta con Recuperar audio' y el reintento nunca puede funcionar. Se pierde el material de origen que da respaldo medicolegal a la nota (NOM-004).
- Arreglo: No derivar el índice de recuperación de la longitud de un arreglo que se vacía: llevar un contador monótono propio (p. ej. `idxPersistidoRef.current++`) que nunca retroceda, y usarlo en `guardarChunk`. Además, en `liberarRecursos` desconectar el handler antes de parar (`rec.ondataavailable = null`) o esperar `onstop` como hace `detener()` antes de vaciar los refs. En `reset()`, hacer `await` de `b

### 18. [P1] (clinico) Los laboratorios NUNCA llegan al copiloto: FIB-4, TFG, ajuste renal y PREVENT están muertos en la consulta
- `src/app/(dashboard)/consulta/[patientId]/page.tsx:449` · Gastroenterologia y Hepatologia
- Impacto: Toda la capa de cálculo automático del copiloto está inerte: el tamizaje de fibrosis (FIB-4), la TFG estimada y —lo más grave— la red de seguridad de ajuste renal de fármacos ya recetados nunca se disparan, aunque el dictado traiga los laboratorios. El comentario del propio archivo (líneas 436-448) afirma que esto ya quedó conectado; no lo está.
- Arreglo: Alimentar el copiloto desde la fuente que sí tiene estudios: el estado `entidades` del NER (`entidades?.tests`), o bien añadir `tests` al esquema `RespuestaExtraccion.extraction` y pedirlo explícitamente en el prompt de procesar. Añadir un test de integración que verifique que un dictado con "creatinina 1.6" produce la sugerencia calc:tfg en la consulta, no solo en el motor puro.

### 19. [P1] (clinico) La glucemia capilar registrada en signos vitales no pasa por ninguna verificación de valor crítico
- `src/app/(dashboard)/hospitalizacion/[internamientoId]/page.tsx:1044` · Medicina de Urgencias
- Impacto: Una hipoglucemia grave (o una hiperglucemia de cetoacidosis) detectada con glucómetro por enfermería no genera aviso al médico tratante. La hipoglucemia es la urgencia metabólica más reversible y más letal si se retrasa; el canal de alerta existe y está construido, simplemente no está conectado a este campo.
- Arreglo: En el guardado del modal de signos (page.tsx:1044-1047), después de `agregarSignos`, evaluar `evaluarCriticoLab('glucosa', sg.glucosa, 'mg/dL')` y, si resulta crítico, disparar `dispararAlerta` con tipo 'lab_critico' igual que hace la carga de resultados. Marcar además la celda de glucosa en la tabla de signos con el color de crítico. Reutilizar el umbral ya definido en lab-criticos.ts en lugar de

### 20. [P1] (clinico) La insulina agregada a mano en la receta se imprime con «Vía oral»: la corrección de vía parenteral solo corre al cargar la nota
- `src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx:322` · Endocrinologia
- Impacto: Sale a la farmacia y al paciente una receta legal que indica insulina por vía oral: una vía que no existe para el fármaco. En el mejor caso el paciente o el farmacéutico regresan a preguntar; en el peor, el paciente con DM2 recién iniciado en insulina intenta tomarla y queda sin tratamiento hipoglucemiante ese día. Además contamina el catálogo apre
- Arreglo: Aplicar `corregirViaParenteral(m.nombre, m.via)` en el punto de VERDAD y no en el de carga: al construir `dataPreview` (línea 654-669) y en `descargarWord` (línea 268-287), o bien dentro del onChange del campo `nombre` de MedicamentoRow. Complementar marcando visualmente la fila con `esParenteralPuro()` para que el médico vea la corrección antes de imprimir, y no persistir vía 'oral' en registrarR

### 21. [P1] (clinico) La receta no revisa teratógenos: se puede agregar isotretinoína/valproato/losartán a una embarazada sin una sola alerta
- `src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx:103` · Ginecologia y Obstetricia
- Impacto: Un teratógeno mayor (isotretinoína, valproato, metotrexato, IECA/ARA-II, DOAC, GLP-1) puede imprimirse y dispensarse a una embarazada sin que el sistema diga nada, en la pantalla donde el médico toma la decisión final. Es daño fetal potencialmente irreversible en el punto exacto donde el resto de las redes de seguridad sí están puestas.
- Arreglo: Añadir en la pantalla de receta un `useMemo` simétrico a `alertasAlergia` que recorra `medicamentos` contra `EMBARAZO_LACTANCIA` (importando `revisarFarmaco` o exportando la función `riesgoGestacional` del copiloto para reutilizarla), aplicando el mismo gate de sexo/edad fértil que usa el copiloto, y pintarlo con el mismo bloque visual rojo que ya bloquea antes de imprimir (línea 450). Reutilizar 

### 22. [P1] (clinico) Todo paciente pediátrico aparece con vacunas «ATRASADAS»: nunca se le pasan las ya aplicadas
- `src/components/PanelPediatria.tsx:54` · Pediatria
- Impacto: Dos daños. (1) Fatiga de alerta total: como la alarma roja urgente sale en el 100% de los pacientes pediátricos mayores de ~5 meses, deja de significar nada y el niño que SÍ tiene un atraso real se pierde en el ruido. (2) Se asienta en un documento medicolegal (NOM-004) una afirmación falsa sobre el estado de inmunización del paciente, con un plan 
- Arreglo: Añadir persistencia de vacunas aplicadas (subcolección o campo del paciente con claves 'nombre@mes', que es exactamente el formato que vacunasSegunEdad ya espera), una casilla por vacuna en el panel para marcarla, y pasar ese arreglo como segundo argumento en PanelPediatria.tsx:54 y en consulta/page.tsx:371. Mientras eso no exista, degradar la etiqueta de 'ATRASADA' a 'corresponde por edad — verif

### 23. [P1] (clinico) La nota preoperatoria afirma 'CHA₂DS₂-VASc 0 · riesgo bajo, no requiere anticoagulación' en el paciente que acabo de marcar como anticoagulado
- `src/components/PreopAssessment.tsx:148` · Cirugia General
- Impacto: Un documento medicolegal firmado afirma que un paciente anticoagulado tiene riesgo embólico bajo y 'generalmente no requiere anticoagulación crónica', y que su riesgo de sangrado es bajo, sin que nadie lo haya evaluado. Puede inducir a suspender el anticoagulante sin puente en quien sí lo necesitaba, o a relajar la vigilancia de sangrado perioperat
- Arreglo: Aplicar el mismo criterio que a las demás: `if (capturado(chadsvasc) || capturado(hasbled))`. Si se quiere conservar el recordatorio para el paciente anticoagulado, que sea un aviso en pantalla ('Marca los ítems de CHA₂DS₂-VASc y HAS-BLED: el paciente está anticoagulado') y NO una línea escrita en la nota.

### 24. [P1] (clinico) Los AINE (y los aminoglucósidos) nunca casan con el catálogo renal: su contraindicación con TFG<30 es código muerto · **valida-med**
- `src/lib/expediente/copiloto.ts:244` · Medicina Interna
- Impacto: El AINE en ERC avanzada es la causa evitable más frecuente de lesión renal aguda en mi consulta, y es exactamente el escenario que este motor dice cubrir. La red de seguridad calla justo donde el catálogo declara contraindicación absoluta; el médico interpreta el silencio como "revisado y sin problema" (el paso 7 de la traza se lo dice con todas su
- Arreglo: Añadir a FarmacoRenal un campo `sinonimos?: string[]` (igual que RiesgoGestacional ya lo tiene) y poblarlo con los principios activos de cada clase, reutilizando la lista que ya existe y está revisada en EMBARAZO_LACTANCIA ('ibuprofeno','naproxeno','diclofenaco','ketorolaco','indometacina','meloxicam','celecoxib','piroxicam','ketoprofeno' para AINE; 'gentamicina','amikacina','tobramicina' para ami

### 25. [P1] (clinico) El copiloto imprime en la nota una meta de LDL contradictoria con el PREVENT que él mismo acaba de calcular
- `src/lib/expediente/copiloto.ts:465` · Cardiologia
- Impacto: Meta lipídica más laxa que la que corresponde e infratratamiento (estatina moderada en vez de alta intensidad) en el paciente de riesgo alto; y una afirmación falsa sobre la estratificación del paciente dentro del expediente, con las implicaciones medicolegales que eso tiene.
- Arreglo: Calcular PREVENT una sola vez en el orquestador copiloto() y pasar el resultado (preventPct) a metasPorDiagnostico, junto con las banderas que el motor sí puede conocer (erc si TFG<60). Mientras muyAltoRiesgo no se pueda establecer, NO emitir la cadena 'poblacion' como texto de nota: sustituirla por una meta condicional explícita ('si es ASCVD de muy alto riesgo, la meta es <55') para no documenta

### 26. [P1] (clinico) La meta de LDL en diabetes sale SIEMPRE la más laxa (<100) y la nota afirma «Diabetes SIN factores de riesgo» sin haberlos evaluado · **valida-med**
- `src/lib/expediente/copiloto.ts:465` · Endocrinologia
- Impacto: Doble daño. Clínico: se fija una meta lipídica más laxa de la que corresponde y se puede no intensificar la estatina en un diabético de mayor riesgo. Documental: la nota —documento legal bajo NOM-004— afirma una caracterización de riesgo que el sistema nunca evaluó, y esa frase respalda la decisión de no intensificar.
- Arreglo: Derivar `factoresRiesgo` (y `erc`) del mismo texto de diagnósticos que ya se normaliza en la línea 456, reutilizando los patrones de hipertensión/tabaquismo/obesidad/renal crónica que existen en la línea 536, y pasarlos a metaLipidica. Mientras no se evalúen, no incrustar `meta.poblacion` en el textoNota como afirmación cerrada: usar una redacción que no niegue lo no evaluado. Los criterios exacto

### 27. [P1] (clinico) El copiloto calcula la TFG con la fórmula CKD-EPI de adulto en un recién nacido y ofrece pegar el resultado en la nota · **valida-med**
- `src/lib/expediente/copiloto.ts:419` · Neonatologia
- Impacto: Se documenta en el expediente una función renal normal-alta en un paciente cuya filtración glomerular es fisiológicamente baja. Eso da falsa tranquilidad justo antes de prescribir vancomicina, aminoglucósidos o cefalosporinas, y como el motor de ajuste renal está apagado a edad 0, no llega ninguna alerta compensatoria. Es un dato clínicamente falso
- Arreglo: Poner una guarda de edad explícita: no ejecutar `ckdEpi2021` por debajo de la edad para la que la fórmula está validada (CKD-EPI es de adultos) y, en su lugar, emitir una tarjeta que diga que en pediatría la estimación requiere una fórmula pediátrica con talla, no CKD-EPI. Aplicar la misma guarda en funcion-renal.ts:evaluarFuncionRenal y en la pantalla de receta (línea 148-153). Y unificar el crit

### 28. [P1] (clinico) El gate de embarazo solo mira los diagnósticos: la edad gestacional que la propia app calculó nunca llega al motor de teratógenos
- `src/lib/expediente/copiloto.ts:271` · Ginecologia y Obstetricia
- Impacto: Se apagan justo las alertas dependientes de la edad gestacional en la paciente en la que el sistema ya tiene la edad gestacional calculada: AINE a las 32 semanas (oligohidramnios y cierre del conducto arterioso), quinolonas y tetraciclinas en el 3er trimestre. La información existe en el expediente y el motor de seguridad no la ve.
- Arreglo: Agregar a `EntradaCopiloto` un campo explícito de estado gestacional (p. ej. `embarazo?: { semanas?: number }`) que la pantalla de consulta llene desde el resultado del PanelGineco (elevando ese estado) y, de forma complementaria, desde el texto de la sección `gineco` de `secciones`. Que `embarazoConfirmado` sea `diagnósticos || estado gestacional capturado`. Ideal: pasar también las semanas, porq

### 29. [P1] (clinico) La alerta de alergia a AINE no dispara cuando la alergia registrada es un AINE concreto (diclofenaco, ketorolaco, metamizol) · **valida-med**
- `src/lib/expediente/copiloto.ts:106` · Ortopedia y Traumatologia
- Impacto: Es el escenario ortopédico más frecuente de reacción evitable: el paciente que dice 'soy alérgico al diclofenaco' recibe ketorolaco postoperatorio sin que ninguna de las tres capas de seguridad avise. En hipersensibilidad a AINE mediada por COX-1 la reactividad cruzada entre AINEs es la regla, no la excepción, y puede ir de urticaria a anafilaxia o
- Arreglo: Extender la lista `dispara` de la familia 'antiinflamatorios no esteroideos' a los mismos principios activos que ya están en `miembros` (diclofenaco, ketorolaco, metamizol, meloxicam, celecoxib, indometacina, piroxicam, ketoprofeno), como ya se hace en la familia de betalactámicos. Idealmente derivar `dispara` de `miembros` más los sinónimos de clase, para que ambas listas no puedan volver a diver

### 30. [P1] (clinico) La contraindicación renal de los AINEs nunca se dispara: el catálogo la guarda con nombre de CLASE y el motor busca por nombre de fármaco
- `src/lib/expediente/copiloto.ts:244` · Ortopedia y Traumatologia
- Impacto: Se apaga en silencio la alerta más importante de nefrotoxicidad en mi población: el anciano con fractura, deshidratado, muchas veces con IECA/ARA-II y diurético (la 'triple whammy' que el propio código documenta en su nota). Prescribir un AINE ahí precipita lesión renal aguda y el sistema afirma implícitamente que no hay problema. Nada más en la ap
- Arreglo: Agregar a FarmacoRenal un campo `sinonimos?: string[]` —exactamente como ya existe en RiesgoGestacional— poblarlo para 'Antiinflamatorios no esteroideos' (ibuprofeno, naproxeno, diclofenaco, ketorolaco, indometacina, meloxicam, celecoxib, piroxicam, ketoprofeno) y para 'Aminoglucósidos' (gentamicina, amikacina, tobramicina), y hacer que el matcher de copiloto.ts:244, revisarListaRenal y revisarFar

### 31. [P1] (clinico) La app sugiere TMP-SMX al paciente con metotrexato y no existe ninguna regla de interacción para ese par · **valida-med**
- `src/lib/expediente/farmacovigilancia.ts:46` · Oncologia
- Impacto: La combinación metotrexato + trimetoprima-sulfametoxazol es un mecanismo reconocido de pancitopenia grave por bloqueo secuencial del folato, y aquí es el propio sistema el que la propone y la imprime sin decir nada. El paciente oncológico ambulatorio se va a casa con las dos recetas. Lo mismo aplica a capecitabina + warfarina (elevación marcada del
- Arreglo: Dos cambios independientes: (1) que el chip de metotrexato NO genere TMP-SMX automáticamente (ver hallazgo del puente nota.ts); (2) agregar a REGLAS los pares oncológicos de mayor consecuencia — metotrexato ↔ trimetoprima/sulfametoxazol (y AINE, y probenecid), capecitabina/5-FU ↔ warfarina, y revisar si conviene incluir azoles ↔ alcaloides de la vinca. El contenido exacto de cada mensaje (magnitud

### 32. [P1] (clinico) El freno renal de la metformina se evalúa con Cockcroft-Gault y peso total, que sobreestima la función renal en obesidad y puede no disparar la contraindicación · **valida-med**
- `src/lib/expediente/funcion-renal.ts:76` · Endocrinologia
- Impacto: Se silencia el aviso de contraindicación de metformina por riesgo de acidosis láctica justo en el fenotipo donde Cockcroft más sobreestima —el diabético obeso con enfermedad renal crónica—, que es exactamente el paciente de riesgo. Y la conducta del sistema cambia según si el médico llenó o no un campo opcional, que es un comportamiento que nadie p
- Arreglo: Marcar por regla qué estimador corresponde a cada fármaco en lugar de usar uno global: las reglas cuyos umbrales provienen de ficha técnica (antimicrobianos, enoxaparina, DOAC) siguen con Cockcroft; las que en guía están definidas sobre TFG —metformina, y por coherencia las de prescripcion-segura.ts— deben evaluarse contra `egfrCkdEpi`. Mientras tanto, cuando ambas estimaciones caigan en franjas d

### 33. [P1] (clinico) Se aplica la ecuación CKD-EPI de ADULTO a pacientes pediátricos: un niño con ERC real sale con 'TFG normal, G1' · **valida-med**
- `src/lib/expediente/funcion-renal.ts:65` · Nefrologia
- Impacto: Doble daño en pediatría. Primero, falsa tranquilidad: una creatinina de 1.2 en un niño de 8 años es una TFG marcadamente reducida por Schwartz, pero la app la reporta como normal (G1) y la ERC pediátrica pasa desapercibida. Segundo, la depuración usada para dosificar antimicrobianos depende de si el médico llenó o no el campo opcional de peso, y sa
- Arreglo: Poner una reja de edad explícita en `evaluarFuncionRenal` y en `ajusteRenal` de copiloto.ts, igual a la que ya existe en copiloto.ts:188: si edad < 18, no devolver TFG por CKD-EPI ni CrCl por Cockcroft. En su lugar, o bien no calcular y decir en una línea 'en menores de 18 años la TFG se estima con Schwartz, que requiere la talla' (mismo patrón que ya se usa para el IMC pediátrico en copiloto.ts:4

### 34. [P1] (clinico) La TFG en niños se calcula con CKD-EPI/Cockcroft (fórmulas de adultos) y se escribe en la nota · **valida-med**
- `src/lib/expediente/funcion-renal.ts:65` · Pediatria
- Impacto: Se documenta en el expediente un valor de función renal que no es válido para la edad del paciente, y se apaga silenciosamente todo el bloque de ajuste renal de antimicrobianos en el niño. Un escolar con daño renal real puede recibir vancomicina o aminoglucósido sin ajuste y con la app diciendo 'función renal normal'.
- Arreglo: Poner una guarda dura de edad: si edad < 18, evaluarFuncionRenal debe negarse a devolver un valor CKD-EPI/Cockcroft y, en su lugar, devolver un estado explícito ('no aplicable en menores de 18 años') que la UI muestre como aviso y que impida escribir la TFG en la nota. Si se quiere dar un estimador pediátrico, debe usarse una fórmula pediátrica basada en talla y con su coeficiente validado por el 

### 35. [P1] (clinico) Ajuste renal de enoxaparina solo contempla dosis terapéutica: en tromboprofilaxis posoperatoria indica SUBIR la dosis · **valida-med**
- `src/lib/expediente/funcion-renal.ts:125` · Cirugia General
- Impacto: Un paciente recién operado, con riesgo de sangrado del lecho quirúrgico y con acumulación de HBPM por falla renal, puede terminar con el doble de la dosis profiláctica por seguir una alerta que dice 'reducir'. Hemorragia posoperatoria / hematoma de sitio quirúrgico.
- Arreglo: Separar la regla en dos escenarios (profilaxis vs tratamiento) e inferir el escenario de la dosis prescrita (mg fijos ≈ profilaxis; mg/kg ≈ tratamiento), o —si no se puede inferir con seguridad— cambiar el mensaje a uno que NO dé una cifra aplicable al caso equivocado, del tipo: 'Enoxaparina con CrCl <30: se acumula. Si es dosis TERAPÉUTICA, ajustar según ficha técnica; si es dosis PROFILÁCTICA, l

### 36. [P1] (clinico) La HbA1c escrita «hemoglobina glicosilada» se registra y grafica como HEMOGLOBINA (7.2 % leído como 7.2 g/dL)
- `src/lib/expediente/laboratorio/analitos.ts:57` · Endocrinologia
- Impacto: El control glucémico —el dato central del seguimiento de un diabético— desaparece del expediente longitudinal, y en su lugar aparece una gráfica de hemoglobina que dibuja anemia severa persistente en un paciente hematológicamente normal. Con hoja sin unidad se genera además una alerta de valor crítico falsa. Riesgo de estudiar una anemia inexistent
- Arreglo: Añadir la grafía 'glicosilada' (y por simetría 'glucosada'/'glicosilada' con y sin acento) a las tres listas: patrón de hba1c en analitos.ts:42 y labs-desde-texto.ts:47, y a los lookahead/exclusión negativos de hemoglobina en analitos.ts:57, labs-desde-texto.ts:51 y lab-criticos.ts:69. Mejor aún, extraer un único fragmento compartido (p. ej. HBA1C_RE) para que las tres listas no puedan volver a de

### 37. [P1] (clinico) El marcado de valores críticos de plaquetas y leucocitos está apagado: la unidad por defecto del catálogo ('10³/µL') no casa con ningún patrón del motor
- `src/lib/expediente/laboratorio/extraccion.ts:99` · Nefrologia
- Impacto: Se pierde silenciosamente el aviso de valor de pánico justo en los dos analitos donde el motor de críticos aporta más, y el resultado queda persistido en Firestore con critico:false, así que el fallo se propaga a las series y a cualquier vista posterior. Además `evaluable:false` (que el propio archivo documenta como 'no se pudo juzgar, NO es lo mis
- Arreglo: Dos arreglos complementarios: (a) normalizar los superíndices en `normUnidad` de lab-criticos.ts (mapear ³→3, y por consistencia ²→2) junto al reemplazo que ya hace de µ→μ; y (b) en extraccion.ts:99 no inventar unidad — pasar `fila.unidad?.trim() || undefined` a evaluarCriticoLab para que actúe la rama documentada de 'unidad ausente = convencional', y conservar la unidad del catálogo solo para mos

### 38. [P1] (clinico) La alerta de alergia de la RECETA no reconoce cefazolina, ceftazidima ni cefixima como betalactámicos · **valida-med**
- `src/lib/expediente/medical-dictionary.ts:63` · Medicina de Urgencias
- Impacto: Prescripción/dispensación de una cefalosporina a un paciente con alergia documentada a penicilina sin ninguna alerta en el documento que se entrega. En urgencias, cefazolina y ceftazidima se indican con prisa y por vía parenteral, donde la anafilaxia es más grave y más rápida.
- Arreglo: Unificar la fuente de verdad: hacer que `validarAlergiasVsMedicamentos` consuma la misma tabla de familias que `copiloto.ts` (FAMILIAS_ALERGIA) en lugar de mantener una segunda lista, o como mínimo ampliar FAMILIA_BETALACTAMICOS con las cefalosporinas faltantes. Añadir una prueba que recorra ambos motores con el mismo caso y falle si divergen. La lista exacta de principios activos a añadir y el tr

### 39. [P1] (clinico) El validador de alergias de la RECETA no reconoce la alergia escrita como "cefalosporinas" (y sí se dispara con "betabloqueadores")
- `src/lib/expediente/medical-dictionary.ts:139` · Reumatologia y Alergologia
- Impacto: Falso negativo en el punto exacto donde el sistema promete bloquear visualmente antes de imprimir: se dispensa una cefalosporina a un paciente con alergia a cefalosporinas. El falso positivo con 'betabloqueadores' desgasta la alerta y entrena al médico a ignorarla, que es la forma clásica de matar una red de seguridad.
- Arreglo: Separar el vocabulario de ALÉRGENO (nombres de clase: 'betalactamico', 'betalactámicos', 'cefalosporina(s)', 'penicilina(s)', 'carbapenem(ico)s') del vocabulario de MIEMBRO (moléculas), como ya hace copiloto.ts con {dispara, miembros}. Reemplazar el comodín a.includes('beta') por una lista explícita de términos de clase para no atrapar 'betabloqueadores'/'betametasona'. Reutilizar directamente FAM

### 40. [P1] (clinico) El cruce alergia↔medicamento por nombre exacto de NOM-004 es código muerto: la nota nunca lleva alergia.tipo
- `src/lib/expediente/nom004.ts:55` · Cirugia General
- Impacto: Se prescribe en el plan posoperatorio exactamente el fármaco al que el paciente es alérgico, con nombre idéntico al del campo de alergias, y la firma pasa limpia. Es la clase de error más elemental que un expediente debe atrapar, y la app aparenta atraparlo.
- Arreglo: Quitar el requisito `al.tipo === 'medicamento'` (tratar `tipo` ausente como 'no se sabe' → sí verificar), o cambiarlo por `al.tipo !== 'alimento' && al.tipo !== 'ambiental'`. Además, como el campo libre se guarda entero en UN solo alergeno, conviene tokenizar con parsearAlergiasTexto() de seguridad/alergias.ts en lugar de tomar solo la primera palabra. Agregar test: alergia 'Tramadol' + medicament

### 41. [P1] (clinico) Salbutamol nebulizado: el panel muestra un total diario de 180-360 mg/día (40-70× la dosis real) · **valida-med**
- `src/lib/expediente/pediatria.ts:53` · Neumologia
- Impacto: Un número absurdo mostrado con la misma autoridad visual que el resto del panel, en el fármaco y el escenario más urgente de mi especialidad (crisis asmática pediátrica). Si alguien lo toma como techo diario permitido, la sobredosis de beta-2 agonista produce taquicardia, temblor, hipokalemia y acidosis láctica. Además contamina la credibilidad del
- Arreglo: Dos opciones, ambas sin inventar valores clínicos: (a) omitir el total diario cuando el intervalo es de rescate/crisis (marcar el fármaco con una bandera tipo `soloPorToma: true` y no renderizar el '(total …/día)' en PanelPediatria.tsx:127-129), o (b) añadir un `topeDia` validado por el médico. La opción (a) es la conservadora y no requiere decidir una cifra: en una crisis la pauta la fija la resp

### 42. [P1] (clinico) El preoperatorio escribe en la nota «GLP-1 de dosis DIARIA: omitir la dosis del día previo» para semaglutida/dulaglutida/tirzepatida, que son SEMANALES · **valida-med**
- `src/lib/expediente/preop.ts:442` · Endocrinologia
- Impacto: Queda escrito en un documento clínico —y se entrega al anestesiólogo— que basta con omitir una dosis, cuando el fármaco lleva 7 días de acción. El retraso del vaciamiento gástrico persiste y el paciente entra a quirófano con estómago lleno pese al ayuno: riesgo de broncoaspiración durante la inducción. La instrucción errónea es peor que la ausencia
- Arreglo: Dos capas: (1) que parser-clinico.ts derive el intervalo del principio activo detectado (semaglutida/dulaglutida/tirzepatida/exenatida LAR son de administración semanal; liraglutida y lixisenatida, diaria) y escriba glp1Semanal explícitamente; (2) cambiar el tipo de `glp1Semanal?: boolean` a un tri-estado (`'semanal' | 'diaria' | undefined`) para que, cuando no se sepa, la recomendación no afirme 

### 43. [P1] (clinico) El AINE en enfermedad renal nunca dispara: el catálogo renal guarda nombres de CLASE que no casan con ningún principio activo · **valida-med**
- `src/lib/expediente/prescripcion-segura.ts:92` · Geriatria
- Impacto: El AINE en el anciano con función renal disminuida —solo o como parte de la triple whammy con IECA/ARA-II y diurético, que el propio archivo describe en la línea 98— es la causa evitable número uno de lesión renal aguda en geriatría. La regla está escrita, documentada y probada, pero es inalcanzable desde cualquier camino real de la aplicación. Lo 
- Arreglo: Replicar el patrón que ya funciona en EMBARAZO_LACTANCIA: añadir `sinonimos?: string[]` a la interfaz FarmacoRenal y poblarlo en las entradas de clase (los principios activos comercializados en México para cada clase), y luego cambiar el emparejamiento de los tres consumidores (prescripcion-segura.ts:181, :275 y copiloto.ts:244) para que consulte también los sinónimos, tal como hace `coincideGesta

### 44. [P1] (clinico) El gate de teratógenos ignora micofenolato, leflunomida y ciclofosfamida — los inmunosupresores que más se recetan a mujeres en edad fértil · **valida-med**
- `src/lib/expediente/prescripcion-segura.ts:243` · Reumatologia y Alergologia
- Impacto: El médico recibe una señal implícita y falsa de que el fármaco es seguro en una mujer en edad fértil, precisamente porque la herramienta SÍ alerta con otros fármacos y por tanto parece cubrir la categoría. Exposición embrionaria evitable en pacientes reumatológicas jóvenes, que son la mayoría de mi consulta.
- Arreglo: Añadir entradas a EMBARAZO_LACTANCIA para micofenolato (sinonimos: ['micofenolato','micofenolato de mofetilo','mmf','ácido micofenólico','micofenolico']), leflunomida (sinonimos: ['leflunomida','teriflunomida']) y ciclofosfamida, con embarazo:'contraindicado'. El texto de motivo/alternativa y los plazos de suspensión o de procedimiento de eliminación deben redactarlos el médico contra la ficha téc

### 45. [P1] (clinico) La regla KDIGO de lesión renal aguda ignora la ventana de tiempo: una progresión de ERC de años se documenta en la nota como AKI · **valida-med**
- `src/lib/expediente/preventivo.ts:248` · Nefrologia
- Impacto: Diagnóstico incorrecto documentado en el expediente clínico (que es un documento legal bajo NOM-004). Etiquetar como AKI la progresión esperada de una ERC dispara estudios y suspensiones de fármacos innecesarios (típicamente se retira el IECA/ARA-II, que es justo el que frena la progresión), y desgasta la credibilidad de la alerta para cuando sí ha
- Arreglo: Pasar `t.dias` a la condición y separar los dos criterios KDIGO por su ventana temporal: el delta absoluto solo cuando los puntos están dentro de la ventana corta y el porcentual dentro de la ventana de días correspondiente; fuera de ellas, emitir un mensaje distinto de 'progresión de enfermedad renal crónica' en lugar de 'lesión renal aguda'. Los valores exactos de las ventanas (48 h / 7 días) es

### 46. [P1] (clinico) Un valor de pánico reportado en unidad no reconocida (troponina hs en ng/L, lactato en mg/dL) se archiva como NO crítico y nadie se entera · **valida-med**
- `src/lib/hospital/lab-criticos.ts:129` · Medicina de Urgencias
- Impacto: El canal de alerta de valores de pánico —el que existe para que un infarto masivo o un lactato de choque séptico lleguen al médico tratante por WhatsApp en minutos— guarda silencio, y el resultado queda visualmente indistinguible de uno normal. En urgencias eso es tiempo puerta-balón o tiempo puerta-antibiótico perdido.
- Arreglo: Propagar `evaluable` hasta la UI: en los tres puntos de llamada usar `evaluarCriticoLab` en vez de `esCriticoLab` y, cuando `evaluable === false` por unidad discordante, marcar el resultado como «no evaluable — verificar» (badge ámbar) y disparar una alerta de revisión en lugar de tratarlo como normal. Retirar `esCriticoLab` o dejarlo solo para usos donde la pérdida de información sea aceptable. L

### 47. [P1] (clinico) La valoración del inmunocomprometido convierte MENCIONES condicionales de fármacos en medicamentos de la receta
- `src/lib/inmuno/nota.ts:90` · Oncologia
- Impacto: En mi paciente oncológico típico esto pone en la receta entecavir + tenofovir sin indicación (dos análogos de nucleós(t)ido a la vez, ninguno necesario con serología negativa) e isoniazida —hepatotóxica, 9 meses— a alguien a quien solo se le pidió un IGRA. TMP-SMX y atovacuona juntas son alternativas mutuamente excluyentes: duplican la profilaxis, 
- Arreglo: No derivar la prescripción del texto en prosa. Que cada regla de recomendaciones.ts/farmacos.ts declare explícitamente su fármaco indicado en un campo estructurado (p. ej. `farmacos?: {clave, condicion}[]`) y que construirNotaInmuno() lea SOLO ese campo, nunca `titulo + detalle`. Mientras tanto, como mitigación mínima: (a) no emitir entecavir/tenofovir salvo resPos('hbsag') || resPos('antihbc'); (

### 48. [P1] (diseno) El calendario no muestra el estado de la cita: una cita cancelada se ve igual que una confirmada
- `src/app/(dashboard)/calendario/page.tsx:234` · Auditor de coherencia UX
- Impacto: El calendario es la pantalla desde la que se decide si hay hueco y a quién se espera hoy. Muestra como agenda ocupada slots que están libres (canceladas) y presenta como pendientes citas ya atendidas o con no-asistencia. La misma cita se lee 'Cancelada' en /citas y 'ocupada' en /calendario, así que las dos pantallas se contradicen sobre el mismo da
- Arreglo: Diferenciar el estado en las tres vistas sin romper el color-por-médico: (a) para 'cancelada' y 'no-asistio', aplicar `opacity: .45` + `textDecoration: 'line-through'` al bloque; (b) para 'atendida'/'pagada', un punto de color usando `var(--badge-green-t)`; (c) añadir el label de estado al `title` del bloque (el mapa STATUS de StatusBadge.tsx:19-34 ya tiene los textos — exportarlo y reutilizarlo e

### 49. [P1] (diseno) La ficha de hospitalización es la única pantalla clínica SIN banner de alergias
- `src/app/(dashboard)/hospitalizacion/[internamientoId]/page.tsx:342` · Auditor de coherencia UX
- Impacto: El médico que pasa visita e indica un fármaco en el paciente internado no ve el dato que la app considera crítico en las otras dos pantallas. El único filtro es el CDS reactivo del formulario de indicación, que además se apaga silenciosamente si falla la lectura del paciente. Es una inconsistencia de seguridad, no de estilo: el mismo paciente muest
- Arreglo: Extraer el banner de alergias a un componente compartido (p.ej. `src/components/expediente/BannerAlergias.tsx`) tomando como base el de expediente/[patientId]/page.tsx:112-128, y montarlo en las TRES pantallas justo bajo el nombre del paciente. En la ficha hospitalaria insertarlo entre las líneas 341 y 342. Reproducir también el estado de error: si `getPatient` falla, el banner debe decir que no s

### 50. [P1] (diseno) Los titulares de las alertas de alergia y de dosis son casi ilegibles en el tema oscuro (el default)
- `src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx:456` · Director de diseno - app interna
- Impacto: El titular es lo que hace que el médico se detenga antes de imprimir. Si no se lee de un vistazo, el recuadro se percibe como un bloque decorativo más entre los seis avisos que ya compiten en esa columna, y la receta con el fármaco alérgeno o con la dosis fuera de rango se imprime igual. Es un dato clínico de seguridad ilegible, no una preferencia 
- Arreglo: Sustituir los colores literales por tokens ya validados para oscuro: en receta líneas 456 y 474 usar color: 'var(--badge-red-t)'; en consulta línea 1950 lo mismo (esa pantalla ya usa #f87171 en su propio banner de alergias de la línea 1893 — quedó inconsistente consigo misma); en expediente línea 107 usar 'var(--badge-amber-t)'. Si se prefiere conservar el rojo intenso, entonces el fondo debe ser 

### 51. [P1] (diseno) Las variables --panel / --panel2 no existen: /arquitectura y /operacion salen con tarjetas BLANCAS y texto casi blanco en el tema oscuro (el default)
- `src/app/arquitectura/page.tsx:81` · Director de diseno - sitio publico
- Impacto: El 100% de los visitantes en el tema por defecto no puede leer el contenido de dos páginas públicas completas. Son justo las páginas a las que la landing manda al médico escéptico ('Ver los 10 motores', 'Operación') y las que enlazan a /precios: se rompe la ruta de credibilidad → conversión. Además da la impresión de sitio roto, que es lo contrario
- Arreglo: Sustituir en los 3 puntos var(--panel, #fff) → var(--s1) y var(--panel2, #f8fafc) → var(--s2), que ya existen y cambian con el tema (globals.css:17-18 y 894-895). Alternativamente definir --panel/--panel2 en :root y en :root[data-theme="light"] junto a los demás tokens. Como red de seguridad, prohibir en revisión los fallbacks de color hardcodeados en var(): si la variable no existe, el fallback n

### 52. [P1] (infecto) claveFarmaco de la tabla CLSI usa `includes` en vez del matcher endurecido: interpreta CMI de β-lactámicos nuevos con el punto de corte del fármaco equivocado
- `src/lib/expediente/antibiograma/clsi-breakpoints.ts:345` · Microbiologo clinico CLSI
- Impacto: Se emite una categoría S/SDD/R con la referencia «CLSI M100-Ed35 Tabla 2A-1» sobre un fármaco para el que ese punto de corte NO existe. En el caso de aztreonam-avibactam la CMI se juzga con el corte de otra combinación, y en cefepime-taniborbactam/enmetazobactam se juzga la combinación con el corte del componente suelto (siempre más estricto), lo q
- Arreglo: Reemplazar el cuerpo de claveFarmaco por `casaAlguno(antibiotico, FARMACO_ALIAS[clave])` (importándolo de ./util) para heredar la frontera de token y la guarda agente-suelto-vs-combinación; quitar el alias 'avibactam' de la entrada 'ceftazidima-avibactam' (igual que en el hallazgo anterior); y devolver `null` explícitamente para los fármacos sin punto de corte propio en la tabla (aztreonam-avibact

### 53. [P1] (infecto) El gate de nitrofurantoína/fosfomicina («solo IVU») sólo existe si hay CMI numérica: en un panel por disco o sólo S/I/R no advierte nada
- `src/lib/expediente/antibiograma/motor.ts:89` · Microbiologo clinico CLSI
- Impacto: La protección que el dueño pidió explícitamente («la celda NO debe verse S/verde fuera de su indicación validada») se pierde en el escenario más común de México, donde muchos laboratorios reportan sólo S/I/R o difusión en disco. Una E. coli de hemocultivo con «Nitrofurantoína S» se ve idéntica a una opción utilizable; la nitrofurantoína no alcanza 
- Arreglo: Sacar el gate de foco/organismo de interpretarCMI a una función propia (p. ej. `gateSoloUTI(organismo, antibiotico, sitio)`) y llamarla en el motor para TODAS las filas del panel, con CMI o sin ella, emitiendo una advertencia y una marca visible en la celda. interpretarCMI seguiría reusando la misma función para no duplicar criterio. Cubrir en la marca a nitrofurantoína, fosfomicina y cualquier ot

### 54. [P1] (infecto) Al leer una segunda foto, las pruebas confirmatorias del aislamiento anterior se arrastran al nuevo organismo (carbapenemasa «positiva» fantasma)
- `src/app/(dashboard)/antibiograma/page.tsx:202` · Infectologo clinico de adultos
- Impacto: Contaminación de datos entre pacientes dentro de la misma sesión: un aislamiento se interpreta con las pruebas confirmatorias y/o el panel de otro. Produce tanto falsos positivos graves (aislamiento de contacto y escalada a β-lactámicos de reserva innecesarios, notificación epidemiológica errónea) como el riesgo simétrico de dar por sensible un pan
- Arreglo: Al inicio de `onFoto`, resetear el estado derivado de la lectura anterior: setPruebas({}), setFilas([]) y setMeta(null) antes de aplicar el nuevo perfil, y aplicar `setPruebas(pruebasAuto)` (reemplazo, no merge). Si `nuevas.length === 0`, no dejar filas heredadas: vaciar el panel y mostrar el aviso de que no se pudo leer ninguna fila. Considerar además un botón explícito de «Nuevo aislamiento» que

### 55. [P1] (infecto) analizarAminoglucosidos ignora el organismo: un Enterococcus totalmente sensible sale con '16S-metiltransferasa' y alerta de buscar carbapenemasa NDM
- `src/lib/expediente/antibiograma/aminoglucosidos.ts:17` · Farmaceutico clinico PROA PK/PD
- Impacto: En el enterococo más banal (ampicilina S, vancomicina S) el motor fabrica un mecanismo molecular inexistente, contradice su propia advertencia correcta sobre resistencia intrínseca de bajo nivel, y manda al laboratorio a buscar una metalo-carbapenemasa en un Gram positivo. Ruido de alta gravedad aparente que erosiona la confianza en las alertas rea
- Arreglo: Usar el parámetro `organismo`: limitar toda la lógica de 16S-RMTasa y AME a bacilos gramnegativos (Enterobacterales + no fermentadores), con retorno temprano de aporteVacio() para Gram positivos y fastidiosos. En enterococo el único razonamiento válido sobre aminoglucósidos es el tamiz de ALTO nivel que ya vive en grampositivos.ts.

### 56. [P1] (infecto) clsi-breakpoints.ts no usa el matcher blindado: «Aztreonam-avibactam» se interpreta con los puntos de corte de ceftazidima-avibactam · **valida-med**
- `src/lib/expediente/antibiograma/clsi-breakpoints.ts:340` · Infectologo clinico de adultos
- Impacto: Aztreonam-avibactam es EXACTAMENTE el fármaco dirigido de las metalo-β-lactamasas (NDM domina en México según el propio prior INVIFAR del módulo). El motor le asigna una categoría S/I/R que no le corresponde y la firma con una cita CLSI falsa, dándole al infectólogo una falsa sensación de validación en la decisión más crítica de todo el módulo. El 
- Arreglo: Reemplazar `a.includes(norm(s))` por `coincideAntibiotico(antibiotico, s)` de util.ts (que ya bloquea agente-suelto-vs-combinación y exige frontera de token), y ordenar los candidatos por longitud del ALIAS que casó, no por longitud de la clave. Eliminar los alias sueltos de inhibidor ('avibactam', 'relebactam', 'vaborbactam', 'durlobactam') tal como ya se hizo con 'tazobactam' en util.ts:119-122.

### 57. [P1] (infecto) El matcher de puntos de corte casa por subcadena: aztreonam-avibactam se interpreta con los cortes de ceftazidima-avibactam (el bug histórico 'meropenem-vaborbactam', reabierto en clsi-breakpoints.ts) · **valida-med**
- `src/lib/expediente/antibiograma/clsi-breakpoints.ts:345` · Epidemiologo hospitalario IAAS
- Impacto: Atribuye un punto de corte al fármaco equivocado precisamente en los agentes de rescate para metalo-β-lactamasas (aztreonam-avibactam es el fármaco de las MBL/NDM, que es lo que domina en México según el prior INVIFAR que el propio motor cita en enterobacterales.ts:92-96). El médico ve «S» con cita CLSI aparentemente legítima. En la fila confirmato
- Arreglo: Sustituir el cuerpo de claveFarmaco() por el matcher blindado que ya existe: importar casaAlguno/coincideAntibiotico de util.ts y usar `if (casaAlguno(antibiotico, FARMACO_ALIAS[clave])) return clave`, conservando el orden por especificidad. Retirar de FARMACO_ALIAS los alias-inhibidor sueltos ('avibactam' en línea 49, 'relebactam' en 50, 'vaborbactam' en 51, 'durlobactam' en 53), que son los que 

### 58. [P1] (infecto) claveFarmaco de clsi-breakpoints usa `includes` crudo: cefepime-taniborbactam, cefepime-enmetazobactam y aztreonam-avibactam reciben el punto de corte de otro fármaco
- `src/lib/expediente/antibiograma/clsi-breakpoints.ts:345` · Farmaceutico clinico PROA PK/PD
- Impacto: El bloque categoriasCMI del motor (motor.ts:88-105) muestra la categoría CLSI y marca discordancia contra lo que reportó el laboratorio. Una CMI de un β-lactámico nuevo se categoriza con el corte de otra molécula y, peor, si el laboratorio reportó R el motor marca `concuerda:false` y le dice al médico que el laboratorio se equivocó. En cefepime-tan
- Arreglo: Reemplazar el cuerpo de claveFarmaco por casaAlguno/coincideAntibiotico (ya importa norm del mismo util), que aplica frontera de token y la regla agente-suelto-vs-combinación. Y devolver null explícito (sin interpretación) para toda combinación que no tenga fila propia en la tabla, en vez de degradar al componente: es preferible no interpretar que interpretar con el corte equivocado. Los valores d

### 59. [P1] (infecto) La misma colisión 'avibactam' en la tabla CLSI: la CMI de aztreonam-avibactam se interpreta con el punto de corte de ceftazidima-avibactam
- `src/lib/expediente/antibiograma/clsi-breakpoints.ts:49` · Micologo clinico
- Impacto: Categoría S/I/R inventada para un fármaco distinto, con una cita CLSI que la respalda falsamente. Como categoriasCMI también alimenta el campo `concuerda`, puede además marcar como discordante el resultado correcto del laboratorio. La cita textual de la tabla es justo lo que hace que el médico confíe en el número.
- Arreglo: Eliminar el alias 'avibactam' (y valorar igual 'relebactam'/'vaborbactam'/'durlobactam', que hoy no colisionan pero comparten el patrón frágil), y sustituir el `includes` de claveFarmaco por el matcher con frontera de token de util.ts. Si no hay corte propio para aztreonam-avibactam, el resultado correcto es devolver null (sin categoría) en vez de tomar prestado el de otro fármaco.

### 60. [P1] (infecto) El tamiz de cefoxitina no valida el organismo: un cribado de AmpC en Klebsiella declara «MRSA confirmado»
- `src/lib/expediente/antibiograma/confirmatorias.ts:29` · Auditor del motor de IA del antibiograma
- Impacto: Se le presenta al médico un MRSA inexistente en un Gram negativo, con terapia dirigida a Gram positivos (vancomicina/daptomicina/linezolid no cubren Enterobacterales), notificación epidemiológica falsa y aislamiento de contacto innecesario. Y desplaza la lectura correcta, que era justamente la contraria: cefoxitina positiva en Enterobacterales orie
- Arreglo: Encerrar las ramas de cefoxitinaScreen, dTest y hlar en el guard de especie que ya usa la rama de nitrocefina (estafilococo/estreptococo para MRSA y D-test, Enterococcus para HLAR); si el organismo no corresponde, no emitir fenotipo y en su lugar levantar una advertencia de que la prueba capturada no aplica a esa especie. Complementariamente, en vision.ts:195 no mapear a cefoxitinaScreen cuando el

### 61. [P1] (infecto) Salmonella y Shigella: no se aplica la regla CLSI de reporte selectivo — cefalosporinas de 1ª/2ª G, cefamicinas y aminoglucósidos pasan como «S» sin ninguna advertencia · **valida-med**
- `src/lib/expediente/antibiograma/enterobacterales.ts:26` · Epidemiologo hospitalario IAAS
- Impacto: Un hemocultivo de S. Typhi o S. Enteritidis con gentamicina/amikacina/cefalotina «S» se presenta al médico como opción válida por omisión. Son fármacos que fallan clínicamente en salmonelosis invasiva (no alcanzan el compartimento intracelular), y en un cuadro tifoídico o una bacteriemia por Salmonella no tifoidea el desenlace de tratar con el fárm
- Arreglo: Añadir una regla explícita para Salmonella/Shigella. Como no es resistencia intrínseca sino reporte selectivo, encaja en el mecanismo `avisoClinico` que intrinseca.ts ya tiene (líneas 27-37, usado hoy para TMP-SMX en Enterococcus): una entrada con claves ['salmonella','shigella'] y agentes AMINOGLUCOSIDO, CEF1G y CEFOXITINA cuyo avisoClinico diga que la actividad in vitro no predice eficacia clíni

### 62. [P1] (infecto) La rama BLEE exige que el panel traiga un carbapenemico S: sin carbapenemico en la placa, una Klebsiella BLEE de hemocultivo sale con CERO fenotipos, cero advertencias y cero alertas
- `src/lib/expediente/antibiograma/enterobacterales.ts:143` · Especialista en resistencia bacteriana
- Impacto: El sistema calla justo cuando mas importa. El medico ve en el reporte crudo cefepime S y piperacilina-tazobactam S y no recibe la advertencia de que en BLEE esas «S» no son fiables a alto inoculo/bacteriemia; el modulo tampoco recomienda carbapenemico ni pide la confirmatoria de BLEE, ni sugiere el control epidemiologico. En bacteriemia por BLEE la
- Arreglo: Desacoplar «carbapenemico probado y sensible» de «carbapenemico NO resistente». Distinguir tres estados (S / no-S / no probado) y permitir la rama BLEE cuando no haya carbapenemico en el panel, bajando la confianza a 'sospecha' y anadiendo una advertencia explicita del tipo «no se probo carbapenemico: no se puede descartar carbapenemasa; solicitar meropenem/ertapenem». Es decir, sustituir `carbaS`

### 63. [P1] (infecto) H. influenzae se etiqueta BLNAR por omisión cuando amoxicilina-clavulanato no está en el panel, y el resultado de nitrocefina nunca llega al módulo · **valida-med**
- `src/lib/expediente/antibiograma/fastidiosos.ts:25` · Infectologo pediatrico
- Impacto: En otitis media aguda y neumonía del preescolar, H. influenzae no tipificable productor de β-lactamasa es el escenario habitual y su tratamiento correcto es amoxicilina-clavulanato oral. El motor le dice al pediatra que el clavulanato «NO ayuda» y que los orales «pierden fiabilidad», empujando a ceftriaxona parenteral en un niño ambulatorio: sobret
- Arreglo: 1) Pasar `entrada.pruebas` a analizarFastidiosos (motor.ts:54) y, si `pruebas.betaLactamasa === 'pos'`, emitir el fenotipo de productor de β-lactamasa (amox-clav / C3G) y NO el BLNAR; si es 'neg' con ampicilina R, entonces sí BLNAR. 2) Cuando amc === null y no hay nitrocefina, NO afirmar BLNAR: emitir un paso 'pendiente' pidiendo la nitrocefina, que es lo que ya hace el algoritmo (algoritmo.ts:57)

### 64. [P1] (infecto) Los puntos de corte MENÍNGEOS del neumococo solo se aplican si el médico marca «SNC»; el valor por omisión es el criterio no meníngeo (permisivo)
- `src/lib/expediente/antibiograma/grampositivos.ts:171` · Infectologo pediatrico
- Impacto: El neumococo es la primera causa de meningitis bacteriana del lactante y del preescolar fuera del periodo neonatal. Un LCR con CMI de penicilina 1 informado como «tratable con penicilina» y ceftriaxona 2 como «intermedia» sostiene una monoterapia con penicilina o una ceftriaxona sin vancomicina en un niño con meningitis neumocócica. Además, la dosi
- Arreglo: Distinguir «sitio no especificado» de «sitio no meníngeo»: cambiar el valor inicial de la pantalla a un placeholder («Selecciona el sitio») y, cuando el sitio sea indefinido o 'otro' y haya β-lactámico con corte por sitio (penicilina/cefotaxima/ceftriaxona/cefepime en neumococo), emitir las DOS categorías y una advertencia visible («si es LCR, aplica el criterio meníngeo: S ≤0,06»), siguiendo el m

### 65. [P1] (infecto) Daptomicina CMI 1 en S. aureus (valor SENSIBLE) se reporta como 'no-S / mprF-LiaFSR': el umbral usa >= donde debe ser >
- `src/lib/expediente/antibiograma/grampositivos.ts:63` · Farmaceutico clinico PROA PK/PD
- Impacto: CMI de daptomicina 1 mg/L es un valor común y plenamente sensible en S. aureus. En bacteriemia por MRSA —donde daptomicina es una de las dos o tres opciones reales— el motor inventa un mecanismo de resistencia (mprF/LiaFSR), afirma 'no usar daptomicina' y empuja a cambiar de clase. Además dispara el fenotipo excepcional de seguridad. Es pérdida de 
- Arreglo: Usar el operador estricto para el umbral de sensibilidad del estafilococo (o expresar los tres casos como 'no-S = CMI > sMax' con el sMax de la especie) de modo que CMI 1 en estafilococo quede como sensible y CMI 2 sí dispare la alerta. Añadir tests de frontera: staph CMI 1 → sin fenotipo, staph CMI 2 → daptomicina-R, E. faecium CMI 4 → SDD sin alerta, E. faecium CMI 8 → R.

### 66. [P1] (infecto) Daptomicina con CMI 1 en S. aureus se marca como no-sensible: descarta un agente de primera linea en bacteriemia por MRSA · **valida-med**
- `src/lib/expediente/antibiograma/grampositivos.ts:63` · Especialista en sepsis
- Impacto: En bacteriemia/endocarditis por MRSA, la daptomicina es la alternativa principal a la vancomicina y una CMI de 1 es un valor frecuente dentro del rango sensible. El motor la declara comprometida y sugiere cambiar de clase, empujando a vancomicina en pacientes con nefrotoxicidad o falla a vancomicina — justo donde la daptomicina es la salida.
- Arreglo: Cambiar la comparacion a estrictamente mayor para estafilococo, o mejor, separar el umbral por especie de forma explicita y delegar la categoria a interpretarCMI() añadiendo daptomicina a la tabla STAPHYLOCOCCUS de clsi-breakpoints.ts para que exista una unica fuente de verdad. NO propongo aqui el valor numerico del punto de corte: el que use la tabla debe transcribirse de CLSI M100-Ed35 Tabla 2C 

### 67. [P1] (infecto) Falta la regla de reporte selectivo de Salmonella/Shigella: aminoglucósidos y cefalosporinas de 1ª-2ª generación salen «S» sin ninguna alerta, y el motor incluso añade optimización PK/PD del aminoglucósido · **valida-med**
- `src/lib/expediente/antibiograma/intrinseca.ts:41` · Infectologo pediatrico
- Impacto: Fiebre tifoidea y shigelosis invasora son diagnósticos pediátricos frecuentes en México. Tratar una Salmonella bacteriémica con gentamicina o con una cefalosporina de 1ª generación porque el antibiograma las reporta «S» es fracaso terapéutico documentado; el motor no solo calla, sino que refuerza la elección con una recomendación de PK/PD.
- Arreglo: Añadir a REGLAS una entrada con claves ['salmonella','shigella'] y agentes AMINOGLUCOSIDO, CEF1G y CEFOXITINA usando `avisoClinico` (no `nota` de conflicto, porque no es un error de identificación sino un fenómeno conocido), con un texto del tipo «no informar susceptibilidad clínica: activos in vitro, ineficaces in vivo (patógeno intracelular)». Además, condicionar el push de optimizacionPKPD de a

### 68. [P1] (infecto) Cero soporte micológico: el catálogo ofrece 13 antifúngicos, pero el motor no tiene ninguna regla de hongos y aun así afirma que «la resistencia intrínseca de la especie ya se aplicó» · **valida-med**
- `src/lib/expediente/antibiograma/intrinseca.ts:41` · Micologo clinico
- Impacto: Un «Fluconazol S» en C. krusei —error de laboratorio o de identificación, exactamente lo que este módulo existe para atrapar— pasa sin una sola alerta, y la pantalla asegura al médico que la resistencia intrínseca ya se revisó. Peor: el motor sugiere activamente desescalar al espectro más estrecho. En una candidemia por C. krusei o C. auris eso es 
- Arreglo: Dos pasos. (1) Inmediato y sin riesgo clínico: detectar el género fúngico (candida, cryptococc, aspergill, fusarium, scedosporium, mucor/rhizopus, trichosporon) y, mientras no haya tabla, degradar honestamente — no imprimir «la resistencia intrínseca ya se aplicó», no emitir la recomendación de desescalar y mostrar «organismo fúngico: fuera del alcance del motor CLSI M100; interpreta manualmente».

### 69. [P1] (infecto) Pseudomonas aeruginosa pan-sensible se clasifica MDR [confirmado] porque se le aplican las categorías de Magiorakos de Enterobacterales · **valida-med**
- `src/lib/expediente/antibiograma/mdr.ts:65` · Epidemiologo hospitalario IAAS
- Impacto: Etiqueta MDR con confianza 'confirmado' a una Pseudomonas salvaje. En vigilancia IAAS eso infla la tasa institucional de MDR-PA (indicador que se reporta y con el que se comparan hospitales), activa aislamiento de contacto innecesario y empuja a escalar a β-lactámicos nuevos de reserva — presión selectiva y gasto injustificados. Es el mismo modo de
- Arreglo: Dos correcciones complementarias: (1) definir un arreglo CATEGORIAS_PSEUDOMONAS con las categorías que Magiorakos sí especifica para P. aeruginosa (aminoglucósidos, carbapenémicos antipseudomónicos, cefalosporinas antipseudomónicas, fluoroquinolonas antipseudomónicas, penicilinas antipseudomónicas + IBL, monobactámicos, ácidos fosfónicos, polimixinas) y seleccionar el arreglo por especie en la lín

### 70. [P1] (infecto) Las CMI censuradas («>X») se interpretan como iguales a X: un ertapenem «>0.5» sale «S» en verde y el motor acusa al laboratorio de discrepar · **valida-med**
- `src/lib/expediente/antibiograma/motor.ts:90` · Micologo clinico
- Impacto: Convierte un tamiz de carbapenemasa positivo en un «sensible» verde y desacredita al laboratorio que sí acertó. Afecta a cualquier fármaco cuyo rango de dilución tope quede en o por debajo del sMax, que es lo habitual en Vitek/Phoenix/MicroScan y en las tiras de gradiente. En un CRE es la diferencia entre desescalar a un carbapenémico y detectar el
- Arreglo: Propagar `cmiCensurada` a interpretarCMI y decidir explícitamente la política: con '>' la CMI real es mayor que el valor impreso, así que no debe categorizarse como S cuando el valor impreso coincide con sMax (lo prudente es devolver «no interpretable — fuera del rango probado» y suprimir la marca de discordancia). Con '<'/'≤' la lectura actual sí es válida. Añadir tests con «>0.5» y «≤0.25».

### 71. [P1] (infecto) Las reglas transversales del motor no excluyen la resistencia intrínseca: un Morganella/Proteus salvaje sale «colistina-R crítica» y «MDR»
- `src/lib/expediente/antibiograma/motor.ts:147` · Especialista en IVU y piel/tejidos blandos
- Impacto: Un aislamiento sin ninguna resistencia adquirida —frecuentísimo en pie diabético y herida quirúrgica, donde Morganella y Proteus son habituales— se etiqueta como multirresistente y con la última línea comprometida. Dispara aislamiento de contacto, escalada a antibióticos de reserva y ansiedad epidemiológica sobre un bicho que responde a ceftriaxona
- Arreglo: En `transversales()`: (1) no emitir el fenotipo colistin-R ni su alerta crítica cuando `esIntrinsecamenteResistente(organismo, 'colistina')`; en su lugar, nota informativa de R natural. (2) En `contarClasesResistentes`, filtrar los agentes intrínsecos del organismo y sustituir `norm(x.antibiotico).includes(norm(a))` por `casaAlguno(x.antibiotico, agentes)` para no re-abrir la colisión de alias. (3

### 72. [P1] (infecto) El gating solo-IVU de nitrofurantoína/fosfomicina solo funciona si hay CMI numérica: con panel S/I/R pasan sin advertencia en pie diabético, celulitis, sangre y hueso
- `src/lib/expediente/antibiograma/motor.ts:88` · Especialista en IVU y piel/tejidos blandos
- Impacto: En México la mayoría de los antibiogramas se reportan por difusión en disco o como S/I/R sin CMI. Un cultivo de úlcera de pie diabético o de absceso que reporta «Nitrofurantoína S» / «Fosfomicina S» se presenta al médico como sensible sin ninguna marca, y ese mismo panel es el que se manda a la IA de razonamiento y al resumen que se pega en la nota
- Arreglo: Sacar el gating de foco del camino de la CMI: añadir en `transversales()` (o en un módulo propio) una regla que, ante una fila de nitrofurantoína o fosfomicina con interpretación S/I/R y `sitio !== 'orina'` (incluido sitio ausente u 'otro'), emita una advertencia/edición interpretativa equivalente al `motivoNoAplicable` que ya redactó el dueño, y que se refleje también en `resumenParaNota`. Cubrir

### 73. [P1] (infecto) Ertapenem R (intrínseco) declara falso Acinetobacter carbapenem-resistente: notificación NOM-045 + aislamiento de contacto + terapia desviada
- `src/lib/expediente/antibiograma/nofermentadores.ts:104` · Epidemiologo hospitalario IAAS
- Impacto: Genera un CRAB falso: activa notificación epidemiológica obligatoria y precauciones de contacto sobre un aislamiento carbapenem-sensible (consumo de cuarto/insumos, alarma de brote falsa en el comité de IAAS, contaminación del indicador institucional de CRAB) y desvía la terapia del carbapenémico que SÍ funciona hacia agentes de reserva. Es exactam
- Arreglo: En nofermentadores.ts, filtrar los agentes intrínsecos antes de evaluar: const carbaEvaluables = CARBAPENEM.filter(a => !esIntrinsecamenteResistente(organismo, a)); const carbaR = algunoR(r, carbaEvaluables). Aplicarlo tanto en acinetobacter() (línea 104) como en pseudomonas() (línea 35), y pasar el organismo a ambas funciones (hoy solo reciben r y out). Adicionalmente, cuando el ÚNICO carbapenémi

### 74. [P1] (infecto) El ertapenem —resistencia INTRINSECA en Pseudomonas y Acinetobacter, declarada asi en el propio intrinseca.ts— cuenta como carbapenem-R: se fabrica una carbapenemasa inexistente, con notificacion NOM-045 y aislamiento de contacto
- `src/lib/expediente/antibiograma/nofermentadores.ts:104` · Especialista en resistencia bacteriana
- Impacto: CRAB/CRPA falso en un aislamiento carbapenem-sensible. Dispara los tres costos del falso positivo a la vez: escalada a antibioticos de reserva (ceftolozano-tazobactam, ceftazidima-avibactam, cefiderocol) que el paciente no necesita y que abandonan el meropenem que SI funciona; aislamiento de contacto innecesario; y notificacion epidemiologica oblig
- Arreglo: Replicar en nofermentadores.ts el patron ya usado en enterobacterales.ts:51-54: excluir el ertapenem del calculo de carbapenem-R para Pseudomonas y Acinetobacter (cribar solo con meropenem/imipenem/doripenem), y anadir una nota informativa de que el ertapenem R es intrinseco y no interpretable en estas especies. La forma robusta es filtrar los agentes por `esIntrinsecamenteResistente(organismo, ag

### 75. [P1] (infecto) La edición interpretativa EUCAST (levofloxacino S→R por cross-resistencia) nunca llega a la nota clínica: el expediente queda con «Levofloxacino S»
- `src/lib/expediente/antibiograma/resumen-nota.ts:25` · Infectologo clinico de adultos
- Impacto: La nota que queda en el expediente —y que es lo que se lee al prescribir o en el pase de visita, no la pantalla del módulo— afirma que levofloxacino es sensible, y encima añade una recomendación de dosificación de fluoroquinolona. Es el escenario clásico de fallo terapéutico por mutación QRDR de primer paso ya establecida: se trata una IVU/bacterie
- Arreglo: Añadir en resumenParaNota un bloque para `r.edicionesInterpretativas` (por ejemplo, marcar la celda dentro de la línea «Panel:» como «Levofloxacino S → informar R (edición interpretativa EUCAST T13)» y/o una sección propia «Ediciones interpretativas» con razón y referencia). Es la información con mayor impacto prescriptivo del resumen y hoy es la única sección del InterpretacionAntibiograma que se

### 76. [P1] (infecto) «Sensible dosis dependiente» se normaliza a S: se pierde el SDD y se prescribe dosis estándar
- `src/lib/expediente/antibiograma/vision.ts:33` · Auditor del motor de IA del antibiograma
- Impacto: El caso canónico del SDD es cefepime en Enterobacterales (el propio Corte lo documenta en clsi-breakpoints.ts:110: S ≤2, SDD 4-8, R ≥16). Un SDD leído como S lleva a dosificar cefepime 1-2 g c/12 h en vez del esquema de dosis alta que el CLSI exige para esa banda; en bacteriemia es fallo terapéutico. Además apaga el aviso explícito que la pantalla 
- Arreglo: Mover la detección de dosis-dependiente ARRIBA de las ramas de palabra completa, o exigir que ^SENS/^SUSCEP no venga calificado: `if (/DOSIS\s*DEPEND|DOSE[-\s]?DEPEND|\bSDD\b/.test(s)) return 'SDD'` como primera regla tras los tokens exactos. Añadir tests de regresión con las cuatro variantes en español e inglés.

### 77. [P1] (infecto) Panel Carba-5 con varios genes: siempre se asigna KPC, aunque el positivo sea NDM
- `src/lib/expediente/antibiograma/vision.ts:186` · Auditor del motor de IA del antibiograma
- Impacto: claseDeReporte (confirmatorias.ts:17) traduce 'KPC' a la clase KPC y el motor emite la alerta crítica «KPC: ceftazidima-avibactam, meropenem-vaborbactam o imipenem-relebactam» más la terapia dirigida por esa clase. Los tres fármacos son inactivos frente a una metalo-β-lactamasa NDM, y además se pierden el aviso de acceso en México y la recomendació
- Arreglo: Evaluar la polaridad POR GEN en lugar de por presencia de la sigla: segmentar el texto (por comas/;/saltos), aplicar esNeg/esPos a cada segmento y quedarse solo con los genes cuyo segmento sea positivo. Si queda más de uno, o si ninguno resulta positivo, dejar claseCarbapenemasa='indeterminada' en vez de adivinar — el motor ya tiene una rama honesta para la clase no determinada. Añadir además un c

### 78. [P1] (ingenieria) firestore.rules deja crear documentos ARCO sin autenticación en CUALQUIER clínica, y luego no se pueden borrar
- `firestore.rules:317` · Auditor de seguridad y PHI
- Impacto: Primitiva de escritura no autenticada en el almacén de un tercero: inflado de costos de Firestore a cargo del consultorio, y contaminación permanente de un registro que es legal (solicitudes ARCO de LFPDPPP con plazo de 20 días hábiles). El tablero de cumplimiento se llena de solicitudes falsas con fecha límite que la clínica nunca podrá cerrar ni 
- Arreglo: Mover el alta ARCO a un endpoint servidor (Admin SDK) como ya se hizo con /api/public/resena y /api/public/booking: validar tipo dentro de la lista blanca, longitudes de nombre/teléfono/descripción, sellar estado='recibida' y las fechas en el servidor, y aplicar limitarOResponder por IP y por teléfono. Después cerrar la regla a `allow create: if false` (solo Admin SDK). Si se prefiere no mover el 

### 79. [P1] (ingenieria) El calendario completo es inoperable con teclado: las citas y las celdas son `<div onClick>`
- `src/app/(dashboard)/calendario/page.tsx:231` · Auditor de accesibilidad
- Impacto: El flujo central del producto —ver y agendar citas— queda cerrado para usuarios de teclado y de lector de pantalla. Además, como el `<div>` no tiene rol, el lector de pantalla lo lee como texto plano y no anuncia que sea accionable, de modo que ni siquiera se percibe que ahí haya algo que abrir. Incumple WCAG 2.1.1 (Keyboard, nivel A). Por `Table.t
- Arreglo: Convertir cada bloque de cita en `<button type="button">` con reset de estilos (`background:none; border:0; font:inherit; text-align:left; width:100%`), que aporta foco, Enter/Espacio y rol gratis. Para la celda horaria de fondo, en vez de hacerla enfocable (serían ~7×N paradas de tabulación por semana), es preferible exponer la rejilla con `role="grid"` y navegación por flechas con un único punto

### 80. [P1] (ingenieria) descartar() se queda con la respaldoKey y el volverA de ANTES de adoptar el episodio: borra el respaldo de la consulta externa y deja vivo el de hospital
- `src/app/(dashboard)/consulta/[patientId]/page.tsx:1410` · Ingeniero de software senior (React/Next)
- Impacto: Dos daños: (a) se BORRA el respaldo local de la consulta externa de ese mismo paciente — si el médico tenía una consulta dictada sin guardar en esa clave, desaparece; (b) el respaldo de la nota de hospital que se acaba de descartar SIGUE en localStorage y en memoria (PHI que se prometió eliminar), y al reabrir la consulta de ese episodio se auto-re
- Arreglo: Añadir `respaldoKey`, `volverA`, `borradorMem` y `audio` (o al menos `internamientoActivo`) al array de dependencias de `descartar`; alternativamente, mover `respaldoKey`/`volverA` a refs actualizadas en cada render (como ya se hace con `notaIdRef`/`estadoVivoRef`) y leerlas dentro del callback. Vale la pena también borrar AMBAS claves posibles al descartar, por defensa.

### 81. [P1] (ingenieria) El cross-check alergia↔medicamento nunca recibe las alergias del expediente y luego declara «sin conflictos detectados»
- `src/app/(dashboard)/consulta/[patientId]/page.tsx:1176` · Ingeniero de IA
- Impacto: Falso negativo de seguridad afirmado en positivo. La herramienta que el producto vende como la barrera contra recetar un fármaco al que el paciente es alérgico es ciega precisamente al lugar donde esa alergia está registrada (la ficha del paciente), y en vez de callar dice explícitamente «sin conflictos». Un médico que confía en ese mensaje verde p
- Arreglo: Anteponer las alergias del expediente al texto que se manda al NER, usando la fuente única `alergiasDe(patient)` de src/lib/seguridad/alergias.ts (que ya reconcilia `alergias` libre con `alergiasEstructuradas`), p. ej. un bloque `ALERGIAS REGISTRADAS EN EL EXPEDIENTE: …` al inicio de `textoFuente`; y aceptar además un campo `alergias` explícito en el body de la ruta para no depender de que el LLM 

### 82. [P1] (ingenieria) «Agregar análisis de evidencia a la nota» está roto de raíz: el cliente parsea como JSON una respuesta que siempre es un stream NDJSON — y los créditos sí se cobran
- `src/app/(dashboard)/consulta/[patientId]/page.tsx:743` · Ingeniero de IA
- Impacto: Una función anunciada del producto no funciona nunca, y cada clic cobra créditos de IA al consultorio (y quema la llave del dueño en modo prueba) sin entregar absolutamente nada. Reintentar —lo natural cuando algo falla— multiplica el cargo.
- Arreglo: Consumir el NDJSON en `agregarAnalisisANota` igual que en consultor/page.tsx (leer `res.body`, acumular los `delta.text`, tomar `articulos` del evento `meta`), o bien añadir en la ruta un modo no-stream (p. ej. `body.stream === false`) que devuelva `{ ok:true, respuesta, articulos }` y usarlo desde este caller. En cualquier caso, no acreditar consumo en `onDone` cuando el texto acumulado quedó vac

### 83. [P1] (ingenieria) /cumplimiento/retencion descarga TODAS las notas de TODOS los pacientes al abrir
- `src/app/(dashboard)/cumplimiento/retencion/page.tsx:29` · Ingeniero de performance
- Impacto: La pantalla de cumplimiento NOM-004 se vuelve inusable (spinner eterno / pestaña congelada) exactamente en los consultorios con historial grande, que son los que necesitan la política de retención. Además dispara un pico de lecturas de Firestore proporcional a todo el expediente de la clínica cada vez que alguien abre la página.
- Arreglo: No traer notas completas: (a) pedir por paciente solo la última nota con query(notasCol, orderBy('fechaConsulta','desc'), limit(1)) para el 'último acto médico', y (b) obtener el conteo de firmadas con getCountFromServer(query(notasCol, where('estado','==','firmada'))) en vez de descargarlas. Además, procesar los pacientes en lotes (p. ej. 20 en paralelo) y pintar resultados incrementalmente en ve

### 84. [P1] (ingenieria) Los «cinco correctos» del MAR son botones disfrazados de casilla: el lector de pantalla no puede leer si están marcados
- `src/app/(dashboard)/hospitalizacion/[internamientoId]/page.tsx:840` · Auditor de accesibilidad
- Impacto: Personal de enfermería con discapacidad visual no puede verificar cuáles de los cinco correctos confirmó, en la única barrera del sistema contra el error de paciente, de medicamento, de dosis, de vía y de hora. O bien queda bloqueado (pulsa Administrar y solo recibe el toast que tampoco se anuncia), o bien tildando a ciegas firma en el expediente u
- Arreglo: Sustituir el `<button>` por un `<input type="checkbox">` real, visualmente oculto con la técnica de clip (nunca `display:none`, que lo saca del árbol de accesibilidad), con el `<span>` decorativo como indicador visual y el conjunto envuelto en un `<label>`; así el estado marcado lo aporta el navegador. Si se prefiere conservar el `<button>`, añadirle `role="checkbox"` y `aria-checked={on}` — y en 

### 85. [P1] (ingenieria) La segunda opinión de seguridad reporta «sin observaciones» cuando el modelo no devolvió nada usable
- `src/app/api/expediente/verificar-nota/route.ts:93` · Ingeniero de IA
- Impacto: Es una afirmación de seguridad fabricada. El médico ve confirmación explícita de que un segundo modelo revisó dosis, interacciones y alergias, cuando el revisor ni siquiera produjo salida. Un error de dosis o un fármaco contra una alergia pasa con el sello verde puesto. Además es indetectable en logs: el endpoint devuelve 200 y `ok:true`.
- Arreglo: Distinguir «revisado sin hallazgos» de «no se pudo revisar»: devolver un campo explícito (p. ej. `{ ok:true, verificado:false, motivo:'respuesta_no_parseable' }`) cuando no haya JSON, cuando `finish_reason` sea de truncamiento o cuando el array de hallazgos quede vacío tras el filtrado pero el crudo no lo estaba; y en la UI (page.tsx:2455) mostrar un aviso neutro/ámbar «No se pudo completar la seg

### 86. [P1] (ingenieria) El monto del anticipo de Stripe lo manda el paciente: /api/payment/create-checkout confía en montoMXN y currency del cuerpo
- `src/app/api/payment/create-checkout/route.ts:21` · Auditor de seguridad y PHI
- Impacto: Pérdida de ingreso directa y silenciosa: el paciente elige cuánto paga por su anticipo. El registro contable de la cita (pagoMonto/pagoMoneda) queda con el valor que puso el cliente, así que el corte de caja y los reportes de finanzas heredan el importe falso sin señal de alarma.
- Arreglo: Derivar el importe en el servidor: leer clinics/{clinicId}/config/main (anticipoMonto, y el precio del tipo de cita si aplica) usando el clinicId que ya sale del token verificado, y usar ese valor para unit_amount. Fijar currency a 'mxn' en el servidor. Construir la descripción a partir de datos del servidor en vez del cuerpo. Y mover el cambio de estado a 'pendiente-pago' a después de confirmar l

### 87. [P1] (ingenieria) 224 de 226 `<label>` no están asociados a su control; el formulario público de derechos ARCO queda sin etiquetar
- `src/app/privacidad/[clinicId]/page.tsx:239` · Auditor de accesibilidad
- Impacto: Un paciente ciego no puede ejercer sus derechos ARCO por el canal que la clínica publica para ello, obligación de la LFPDPPP; además el riesgo de escribir un dato en el campo equivocado (teléfono en CURP) es alto para cualquier usuario de lector de pantalla. Dentro del panel, el mismo defecto alcanza el alta de insumos de farmacia y toda pantalla q
- Arreglo: En los dos `Field` locales, generar un id con `useId()` y ponerlo en `htmlFor` del label y en `id` del input — o, más simple, envolver el `<input>` dentro del `<label>` para lograr la asociación implícita. En la primitiva `src/components/ui/Field.tsx`, dejar de depender de que el llamador pase `id`: generar uno con `useId()` cuando `id` venga vacío y usarlo en ambos lados; aprovechar para añadir `

### 88. [P1] (ingenieria) Editar una cita de HOY cuya hora ya pasó borra la hora sola y bloquea el guardado (efecto que lee `slots` sin tenerlo en deps)
- `src/components/AppointmentModal.tsx:147` · Ingeniero de software senior (React/Next)
- Impacto: No se puede editar NADA de una cita del día ya atendida —cambiar el estado a «atendida», corregir el teléfono, añadir notas internas— sin reasignarle una hora nueva; y las únicas horas ofrecidas son futuras, así que el intento acaba MOVIENDO la cita de hora y corrompiendo la agenda/corte de caja del día. Es el flujo diario de la asistente al cerrar
- Arreglo: No limpiar `hora` en modo edición: aplicar la limpieza solo cuando `!isEdit`, o exceptuar explícitamente el valor original (`hora !== appointment?.fechaHora.slice(11,16)`). De paso, añadir `slots` y `cfgAgenda` al array de dependencias del efecto para que el cálculo de `conflict` se rehaga cuando la config del médico llega tarde.

### 89. [P1] (ingenieria) El cierre de sesión purga lo local y mata la sesión 1.2 s después de pedir el guardado: la nota en vuelo se pierde en servidor Y en disco
- `src/components/AutoLogout.tsx:46` · Auditor de perdida de datos
- Impacto: Pérdida completa de una consulta ya dictada, en el escenario exacto que este componente dice cubrir, y con un mensaje en pantalla que promete lo contrario. Es el tipo de pérdida silenciosa más costosa: el médico no se entera hasta que el paciente ya se fue.
- Arreglo: Convertir el evento en un handshake en vez de una espera a ciegas: que `EVENTO_GUARDAR_TODO` lleve un arreglo de promesas al que la consulta empuje su `guardarBorrador(true)` (o un evento de respuesta 'nx:guardado-listo'), y que el cierre haga `await Promise.allSettled(...)` con un tope generoso (p. ej. 15 s) mostrando 'Guardando tu nota…'. Si alguna promesa falla o vence el tope, NO purgar el res

### 90. [P1] (ingenieria) El modal de aviso de privacidad (LFPDPPP) no está montado en ninguna pantalla: el consentimiento del paciente NUNCA se puede capturar
- `src/components/AvisoPrivacidadModal.tsx:33` · Cazador de UI muerta
- Impacto: El producto declara cumplimiento LFPDPPP Art. 16 (consentimiento expreso para datos sensibles de salud) y tiene el campo, el generador de texto, el versionado del aviso y el export FHIR listos, pero no existe UI para obtener ni registrar el consentimiento de los pacientes atendidos en consultorio. Ante una auditoría o un ARCO no hay evidencia de co
- Arreglo: Montar el modal donde se crea/edita el paciente (PacienteModal en src/app/(dashboard)/pacientes/page.tsx) y/o como gate al abrir el expediente por primera vez, guardando el objeto que devuelve onAceptar en Patient.avisoPrivacidad con updatePatient. Añadir además un indicador en el expediente ("Aviso aceptado el X, versión Y") y un botón para volver a capturarlo cuando VERSION_AVISO cambie.

### 91. [P1] (ingenieria) El `Modal` compartido no es un diálogo: sin `role`, sin `aria-modal`, sin foco inicial ni trampa de foco
- `src/components/ui/Modal.tsx:47` · Auditor de accesibilidad
- Impacto: Los formularios modales —cobrar, alta de cita, alta de insumo, indicaciones y administración de medicamentos— son inutilizables de forma fiable con lector de pantalla o solo con teclado: el usuario no sabe que se abrió, se pierde fuera del diálogo y puede activar sin querer controles del fondo. Incumple WCAG 4.1.2 (Name, Role, Value) y 2.4.3 (Focus
- Arreglo: Sobre el contenedor `.modal`: `role="dialog"`, `aria-modal="true"` y `aria-labelledby` apuntando a un id generado con `useId()` que se ponga en el div del título (o `aria-label` cuando no hay `title`). Al montar, enfocar el contenedor (`tabIndex={-1}` + `ref.current.focus()`) o el primer control; guardar `document.activeElement` antes de abrir y restaurarlo en el cleanup. Extender el `useEffect` e

### 92. [P1] (ingenieria) Ningún mensaje de la app se anuncia: cero regiones aria-live en todo el código
- `src/context/ToastContext.tsx:82` · Auditor de accesibilidad
- Impacto: Todo usuario de lector de pantalla (médico, enfermería o recepción con baja visión) opera a ciegas: los errores de validación, los fallos de guardado y las confirmaciones son invisibles para él. En el flujo de cobro se traduce en cobros que se creen registrados y no lo están; en el MAR de hospitalización, en una administración que se cree registrad
- Arreglo: Añadir al contenedor `role="status"` y `aria-live="polite"` con `aria-atomic="false"`, y renderizar el contenedor SIEMPRE (aunque `toasts` esté vacío) para que la región live exista en el DOM antes de que llegue el primer mensaje — si la región nace junto con su contenido, muchos lectores no la anuncian. Para `type === 'error'` conviene un segundo contenedor hermano con `role="alert"` / `aria-live

### 93. [P1] (ingenieria) Registrar un cobro suelto desde Finanzas falla SIEMPRE: Firestore rechaza los campos undefined
- `src/lib/cobros.ts:194` · Ingeniero de sistemas (Firestore)
- Impacto: El consultorio no puede registrar ningún cobro que no venga de una cita (productos, membresías cobradas a mano, saldos, reembolsos): ese dinero entra a la caja física pero nunca al sistema, así que el corte de caja y los reportes de ingresos quedan cortos y no cuadran. Y no es un fallo silencioso a medias: es un flujo de dinero que nunca funciona.
- Arreglo: Aplicar el mismo saneo que ya existe para pacientes: pasar el payload por una función que elimine recursivamente las claves undefined antes del `addDoc`/`tx.set` en registrarCobro (o construir el objeto omitiendo las claves ausentes). Lo mismo en crearInvitacion. Alternativa global: inicializar Firestore con `ignoreUndefinedProperties: true` en src/lib/firebase.ts, aunque conviene revisar antes qu

### 94. [P1] (ingenieria) "Descartar consulta" deja para siempre las versiones de la nota (con transcripción cruda) y las reglas impiden borrarlas
- `src/lib/expediente/firestore.ts:112` · Auditor de perdida de datos
- Impacto: Retención indefinida de datos personales sensibles de salud tras un borrado que la aplicación declara definitivo. Rompe la promesa explícita de la interfaz y deja sin salida técnica cualquier solicitud de cancelación ARCO (LFPDPPP): no hay forma de eliminar ese PHI desde la app. También infla el almacenamiento con copias de consultas descartadas.
- Arreglo: Que `deleteNota` borre en cascada las subcolecciones `versions` y `adendas` del borrador antes de borrar el documento (lectura + `writeBatch`), o —mejor, porque el borrado en cascada desde el cliente es frágil— mover el descarte a un endpoint servidor con Admin SDK que use `recursiveDelete`. En cualquier caso hay que relajar la regla para permitir `delete` de `versions` SOLO cuando la nota padre e

### 95. [P2] (clinico) Los factores de riesgo preoperatorios extraídos del dictado nunca llegan al panel, y el toast asegura que sí
- `src/app/(dashboard)/consulta/[patientId]/page.tsx:910` · Cirugia General
- Impacto: El médico confía en el aviso, no revisa las casillas y la nota sale sin RCRI (o con un RCRI calculado sobre casillas en blanco = riesgo bajo) en un paciente que el dictado describía como de riesgo elevado. Además se pierde en silencio la extracción ya guardada en preop.inputs.
- Arreglo: Sincronizar el panel con la prop: o bien montar con `key={JSON.stringify(preop?.inputs ?? {})}` (o una versión/contador que se incremente en cada setPreop desde la IA), o añadir en PreopAssessment un useEffect que fusione initialInputs sobre el estado cuando cambie la identidad del objeto, respetando lo que el médico ya haya palomeado a mano. Y no emitir el toast si no se aplicó nada.

### 96. [P2] (clinico) «Aplicar a la nota clínica» pisa en silencio las cinco secciones ya dictadas, sin deshacer
- `src/app/(dashboard)/consulta/[patientId]/page.tsx:2911` · Oncologia
- Impacto: En oncología la valoración del inmunocomprometido casi siempre se hace DESPUÉS de dictar la historia (esquema de quimioterapia, ciclos, toxicidades, intención del tratamiento). Un solo clic borra esa narrativa y la reemplaza por el volcado de los chips. El Dr. ya reportó ser especialmente sensible a la pérdida de datos.
- Arreglo: Antes de reemplazar, guardar un snapshot y ofrecer «Deshacer» en el toast (el patrón de snapshotUndo ya existe en esta pantalla). Mejor aún: si la sección ya tiene texto, APPEND con un separador («— Valoración infectológica —») en vez de sustituir, o pedir confirmación explícita indicando cuántas secciones con contenido se van a sobrescribir.

### 97. [P2] (clinico) El chat de "corregir la nota con IA" le declara al modelo que el paciente NO tiene alergias, y luego reemplaza la lista completa de medicamentos con lo que el modelo devuelva
- `src/app/(dashboard)/consulta/[patientId]/page.tsx:1834` · Reumatologia y Alergologia
- Impacto: Se induce a la IA a proponer fármacos contraindicados y se le da permiso de reescribir la prescripción completa. No es daño directo porque quedan verificaciones aguas abajo, pero degrada la calidad de la sugerencia justo en el paso de mayor apalancamiento y depende de que las otras redes —que ya demostré que tienen huecos— funcionen.
- Arreglo: Enviar las alergias reales en ese payload (alergias: alergiasArray(patient?.alergias), que ya existe en el mismo archivo, línea 40, y ya se usa en el manifiesto de procedencia de la línea 1274). Si por minimización de PHI se prefiere no mandarlas en 'nota', incluirlas en 'contexto' junto a edad y sexo — un alérgeno no identifica a nadie y es exactamente el dato que el modelo necesita para no equiv

### 98. [P2] (clinico) Todo paciente en aire ambiente arrastra para siempre el aviso «SCORE INCOMPLETO» del NEWS2
- `src/app/(dashboard)/hospitalizacion/[internamientoId]/page.tsx:1044` · Neumologia
- Impacto: Fatiga de alerta sobre el mecanismo antifatiga. La advertencia de score incompleto se diseñó (según el comentario de news2.ts:89-101) para el caso real de enfermería que registra 1 de 7 parámetros; al dispararse en el 100% de los pacientes en aire ambiente —la mayoría del piso— deja de leerse, y con ella se pierde el aviso genuino cuando de verdad 
- Arreglo: Guardar el booleano tal cual: `oxigeno: sg.oxigeno` (o `oxigeno: !!sg.oxigeno`) en la llamada a agregarSignos de la línea 1044. El campo ya es opcional en el tipo, así que persistir false no rompe nada, y hace que 'no recibe oxígeno' sea un dato afirmativo distinto de 'nadie lo registró' — exactamente la misma distinción que el propio código defiende para las alergias en lib/seguridad/alergias.ts:

### 99. [P2] (clinico) Todo NEWS2 guardado se muestra como «SCORE INCOMPLETO» porque el O₂ suplementario en «no» se guarda como undefined
- `src/app/(dashboard)/hospitalizacion/[internamientoId]/page.tsx:1044` · Medicina de Urgencias
- Impacto: Fatiga de alerta sobre el único mecanismo que existe para avisar de un NEWS2 realmente subestimado. Si el aviso «SCORE INCOMPLETO» aparece en prácticamente todos los registros, enfermería y el médico dejan de leerlo, y cuando de verdad falte la FR o la SpO₂ el aviso ya no significa nada. Es la degradación del mismo mecanismo que el archivo news2.ts
- Arreglo: Guardar `oxigeno` siempre como booleano explícito: cambiar `oxigeno: sg.oxigeno || undefined` por `oxigeno: sg.oxigeno` en page.tsx:1044, de modo que `false` (aire ambiente) sea un dato afirmado y no una ausencia. Para los registros ya guardados sin el campo, decidir un criterio explícito (p. ej. tratar la ausencia como «no documentado» solo en registros anteriores a la corrección). Y actualizar l

### 100. [P2] (clinico) La receta suprime el aviso 'sin referencia de dosis', así que un antibiótico neonatal fuera del catálogo pasa con la pantalla en silencio · **valida-med**
- `src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx:138` · Neonatologia
- Impacto: La red de seguridad de la receta es indistinguible del silencio. En un neonato, donde toda la dosificación es de alto riesgo y ningún fármaco relevante está en el catálogo, el médico no tiene forma de saber si la pantalla lo revisó o simplemente no supo.
- Arreglo: No descartar `sin_referencia`: mostrarlo agregado y discreto (una línea del tipo 'N de M medicamentos sin referencia de dosis en el catálogo'), de modo que la pantalla distinga 'verificado' de 'no verificable'. En paralelo, añadir `edadMeses`/`edadDias` a `EntradaDosis` y hacer que el motor devuelva `sin_referencia` de forma obligatoria cuando el paciente esté por debajo de la edad cubierta por el

### 101. [P2] (clinico) La creatinina ya extraída de la nota no llega a la receta: el ajuste renal arranca apagado
- `src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx:146` · Oncologia
- Impacto: En el paciente oncológico con nefrotoxicidad por platinos o con deterioro renal por sepsis, la receta —el documento que de verdad se dispensa— sale sin ninguna advertencia de ajuste. El médico ya vio la TFG en la consulta y razonablemente asume que el sistema la sigue considerando; el silencio se lee como «no hay nada que ajustar».
- Arreglo: En el useEffect que carga la nota (línea ~159-180), pre-llenar `creatinina` y `pesoKg` con lo que ya trae la nota: creatinina desde labsDesdeEstudios(nota.iaAuditoria?.extraction?.tests) y peso desde nota.signosVitales.peso. Marcar visiblemente el origen («de la nota del DD/MM») y dejarlo editable, para que el médico sepa contra qué depuración se están evaluando los fármacos.

### 102. [P2] (clinico) La receta filtra el aviso "sin referencia de dosis", así que el vademécum reumatológico completo pasa sin ninguna red de seguridad y en silencio · **valida-med**
- `src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx:138` · Reumatologia y Alergologia
- Impacto: Silencio interpretable como aprobación en la única pantalla donde el fármaco se convierte en papel dispensable. Para reumatología significa que la clase entera de fármacos que uso a diario queda fuera de toda verificación determinista, incluido el error semanal→diario de metotrexato, que causa pancitopenia y mucositis graves.
- Arreglo: En lugar de filtrar 'sin_referencia', mostrarlo de forma discreta y agregada (un solo renglón: 'N fármacos sin referencia de dosis en el catálogo — verificación manual'), que cumple el objetivo de no saturar sin mentir por omisión. En paralelo, ampliar CATALOGO con los fármacos reumatológicos y añadir una verificación específica de FRECUENCIA para los de dosificación semanal (metotrexato), que es 

### 103. [P2] (clinico) Los momentos de re-dosis intraoperatoria se anclan a la incisión, no a la dosis inicial · **valida-med**
- `src/lib/expediente/cirugia.ts:233` · Cirugia General
- Impacto: Ventana de concentración subterapéutica durante el transoperatorio en cirugías largas — justo la situación en la que la re-dosis existe. Aumenta el riesgo de infección de sitio quirúrgico, y el texto se pega tal cual en la nota como si fuera la indicación correcta.
- Arreglo: Anclar los momentos al inicio de la dosis preoperatoria y decirlo explícitamente en el texto: 'Re-dosis cada N h contadas desde el INICIO de la dosis preoperatoria (no desde la incisión)'. Si se quiere seguir mostrando la referencia a la incisión, restar ab.minutosAntes/60 y etiquetar ambos relojes. El criterio exacto de anclaje y los intervalos por fármaco REQUIEREN validación médica contra la gu

### 104. [P2] (clinico) Una fila de medicamento vacía inventa una contraindicación crítica de metformina (falta el guard de nombre vacío que sí tienen las otras reglas)
- `src/lib/expediente/copiloto.ts:243` · Medicina Interna
- Impacto: Alerta crítica fantasma sobre un fármaco no prescrito, con texto pegable al expediente ("Con TFG estimada de 20 mL/min/1.73 m²: Metformina — CONTRAINDICADA…"), lo que puede acabar documentando una contraindicación falsa en la nota firmada. Degrada la credibilidad del bloque rojo, que es el que nunca debe ignorarse.
- Arreglo: Añadir `if (!nm) continue` en los bucles de ajusteRenal (copiloto.ts:243) y dosisPediatrica (copiloto.ts:203), igual que ya lo hacen alergiaVsReceta y riesgoGestacional; y/o exigir longitud mínima como en revisarListaRenal (`if (q.length < 3) continue`), que además evita el match transitorio mientras se teclea (escribir la primera letra 'l' casa con 'Antiinflamatorios no esteroideos' por la direcc

### 105. [P2] (clinico) El copiloto anuncia 'X requiere ajuste con TFG de N' para fármacos cuya propia regla dice 'Dosis habitual'
- `src/lib/expediente/copiloto.ts:249` · Nefrologia
- Impacto: El título contradice al detalle en la misma tarjeta, en un paciente G3a que es el caso más frecuente. El médico que solo lee los títulos (que es lo que ocurre cuando hay tres o cuatro tarjetas) reduce metformina o apixabán sin necesidad —infradosificar un anticoagulante en fibrilación auricular tiene su propio costo— y, sobre todo, aprende a ignora
- Arreglo: Marcar explícitamente en ReglaRenal las bandas que no requieren acción (por ejemplo un flag `sinCambio?: boolean` en las reglas cuya conducta es 'Dosis habitual'/'Puede usarse') y en copiloto.ts saltarlas con `continue`, o degradarlas a nivel 'info' con un título honesto del tipo 'X: no requiere ajuste con TFG de N (solo vigilancia)'. La clasificación de qué banda es 'sin cambio' se lee directamen

### 106. [P2] (clinico) El copiloto perdió el guardia de longitud mínima: un nombre de fármaco a medio teclear inventa una contraindicación renal
- `src/lib/expediente/copiloto.ts:244` · Ginecologia y Obstetricia
- Impacto: Alerta crítica falsa mientras se teclea, sobre un fármaco que el paciente no toma, en el panel donde viven las alertas críticas verdaderas. Es exactamente el fallo que ya se reparó en la capa pura y que quedó vivo en la capa que el médico realmente ve.
- Arreglo: Añadir `if (nm.length < 3) continue` antes del `find` en `ajusteRenal`, o mejor: hacer que el copiloto llame a `revisarListaRenal` de prescripcion-segura.ts en lugar de reimplementar el match, para que exista un solo camino con un solo guardia.

### 107. [P2] (clinico) Falsa alerta de hiperkalemia: el término 'ara' del detector de interacciones casa por subcadena con "paracetamol"
- `src/lib/expediente/farmacovigilancia.ts:76` · Medicina Interna
- Impacto: Alerta falsa en una de las combinaciones más comunes de mi consulta. El costo real es fatiga de alertas: el médico aprende que este panel se equivoca y empieza a saltarse también las alertas mayores (warfarina+AINE, digoxina+amiodarona) que sí son correctas. Además puede motivar un control de potasio innecesario o la atribución errónea de una hiper
- Arreglo: Cambiar el matching de subcadena cruda a coincidencia por palabra/límite de token sobre el nombre normalizado (por ejemplo probar cada término contra los tokens del nombre, o exigir límite de palabra), y sustituir los términos-abreviatura 'ieca'/'ara'/'aine' por la lista de principios activos (que ya existe curada en EMBARAZO_LACTANCIA.sinonimos). Añadir una prueba de no-regresión con paracetamol 

### 108. [P2] (clinico) El término 'ara' de la regla IECA/ARA-II casa dentro de «paracetamol» y dispara una falsa alerta de hiperkalemia
- `src/lib/expediente/farmacovigilancia.ts:76` · Endocrinologia
- Impacto: Alerta falsa en una combinación cotidiana (espironolactona por SOP/hirsutismo o hiperaldosteronismo, más paracetamol). Erosiona la credibilidad del panel de interacciones justo en la pantalla donde también viven las alertas de alergia y de dosis; el médico que aprende a descartar esta alerta descarta también las verdaderas.
- Arreglo: Quitar los términos de clase de 3-4 letras de las listas de matching por subcadena, o exigir límite de palabra (comparar con un RegExp con \b en vez de includes). El repositorio ya resolvió este mismo problema en otros motores: prescripcion-segura.ts:233-239 introdujo el campo `sinonimos` con principios activos precisamente para no depender del nombre de clase, y revisarListaRenal descarta consult

### 109. [P2] (clinico) Falso positivo de hiperkalemia: paracetamol contiene 'ara' y dispara la alerta de IECA/ARA-II + espironolactona
- `src/lib/expediente/farmacovigilancia.ts:76` · Ginecologia y Obstetricia
- Impacto: Alerta falsa en una de las combinaciones más comunes de la consulta ginecológica. Genera fatiga de alertas justo en el bloque de seguridad de la receta, que es donde sí viven alertas verdaderas (alergia, dosis); el médico aprende a ignorar ese recuadro. También puede llevar a pedir un potasio innecesario.
- Arreglo: Quitar los comodines 'ara' e 'ieca' de la lista `a` (los principios activos ya están enumerados) o exigir coincidencia por límite de palabra en `tiene()` en vez de `includes` crudo. Convendría revisar el resto de las reglas con el mismo criterio (términos cortos genéricos como 'aine' en las listas `b`).

### 110. [P2] (clinico) La interacción 'Anticoagulante + AINE' solo cubre warfarina/acenocumarol: enoxaparina, DOACs y antiagregantes no disparan nada · **valida-med**
- `src/lib/expediente/farmacovigilancia.ts:48` · Ortopedia y Traumatologia
- Impacto: El paciente sale de artroplastia o de fijación de fractura con tromboprofilaxis con HBPM y un AINE, sin gastroprotección y sin ninguna advertencia de riesgo hemorrágico (sangrado digestivo y hematoma de la herida/hemartrosis). Es la interacción que más pesa en el postoperatorio ortopédico y el sistema la muestra como 'sin interacciones detectadas',
- Arreglo: Ampliar el grupo `a` de esa regla —o crear reglas hermanas— para cubrir HBPM (enoxaparina, dalteparina, tinzaparina, nadroparina, bemiparina, fondaparinux), heparina no fraccionada, DOACs (rivaroxaban, apixaban, dabigatran, edoxaban) y antiagregantes (clopidogrel, prasugrel, ticagrelor, ácido acetilsalicílico), ajustando el detalle de cada grupo (con HBPM/DOAC no aplica el monitoreo de INR que hoy

### 111. [P2] (clinico) La receta usa un catálogo renal distinto al de la consulta: rivaroxabán con CrCl 30-49 y digoxina no generan alerta al prescribir · **valida-med**
- `src/lib/expediente/funcion-renal.ts:126` · Cardiologia
- Impacto: Dosis plena de rivaroxabán en un rango de función renal donde la etiqueta obliga a reducir, con mayor exposición y riesgo hemorrágico; y digoxina sin aviso de reducción y de margen terapéutico estrecho. El médico que vio funcionar la alerta en la consulta asume que la receta la repite.
- Arreglo: Unificar: hacer que la receta consuma AJUSTE_RENAL/ajustePorTFG de prescripcion-segura.ts (reglas por tramos) y dejar REGLAS_RENALES únicamente como capa PROA de antimicrobianos, o fusionar ambos catálogos en una sola fuente de verdad. Los tramos concretos de cada ACOD deben ser revisados por el médico contra la ficha técnica antes de fijarlos.

### 112. [P2] (clinico) Sin peso capturado, la TFG por superficie corporal se usa y se rotula como si fuera depuración de creatinina · **valida-med**
- `src/lib/expediente/funcion-renal.ts:76` · Geriatria
- Impacto: El anciano de bajo peso es justo el paciente en quien la TFG indexada a 1.73 m² sobreestima la depuración real, y por tanto el paciente en quien más falla el sub-alertado. La etiqueta 'CrCl' sobre un número que no lo es también induce al médico a comparar contra los umbrales de ficha técnica, que están definidos en CrCl de Cockcroft-Gault.
- Arreglo: Devolver junto al número la fuente usada (por ejemplo `fuenteDepuracion: 'cockcroft' | 'ckd-epi'`) y que `ajusteRenalFarmacos` la propague a la alerta, de modo que el mensaje diga 'TFG estimada (CKD-EPI, sin peso)' en lugar de 'CrCl' cuando no hubo peso, y que la UI pida el peso de forma visible cuando falta. Si la decisión clínica es no alertar con un estimador no indexado, entonces devolver null

### 113. [P2] (clinico) La calculadora gestacional acepta cualquier valor: 133 semanas de embarazo y ciclos absurdos que corren la EG semanas enteras · **valida-med**
- `src/lib/expediente/ginecologia.ts:43` · Ginecologia y Obstetricia
- Impacto: Una edad gestacional errónea contamina TODO lo que cuelga de ella: los hitos de control prenatal (ventana de aspirina, tamiz de diabetes, anti-D a las 28 semanas, cultivo de estreptococo B a las 35-37), la decisión de inducir y la FPP que queda firmada en la nota. Además el error entra al expediente como texto redactado por el sistema, con aparienc
- Arreglo: Acotar `cicloDias` a un rango fisiológico y devolver null (o una bandera de 'fuera de rango') fuera de él; devolver null o marcar el resultado cuando `diasTotales` exceda el máximo posible de una gestación; y en `PanelGineco` poner `min`/`max` al input de ciclo, un `max` de hoy a la FUM, y ocultar el botón 'Agregar a la nota' cuando el resultado esté fuera de rango, igual que ya se hace con Bishop

### 114. [P2] (clinico) Plaquetas y leucocitos nunca se marcan como valor crítico cuando el laboratorio no reporta unidad
- `src/lib/expediente/laboratorio/extraccion.ts:99` · Gastroenterologia y Hepatologia
- Impacto: El motor de valores de pánico —que existe precisamente para no depender del flag del laboratorio— queda ciego justo para los dos analitos hematológicos, incluida la trombocitopenia grave, que en hepatología es el marcador central de hipertensión portal y de riesgo de sangrado. Además el estado 'no evaluable' no se muestra en ningún lado, así que ap
- Arreglo: Aceptar los superíndices en la normalización de unidades (normalizar con NFKD o mapear ³/⁶/⁹ a dígitos en normUnidad) y/o escribir la unidad por defecto del catálogo en ASCII ('10^3/uL') para que coincida con U.miles. Complementariamente, propagar el campo `evaluable` de EvaluacionCritico hasta ResultadoValidado y mostrarlo, para que un resultado no juzgado no se presente como normal. Los umbrales

### 115. [P2] (clinico) El potasio y el sodio se extraen del dictado y se tiran: ninguna alerta de hiperkalemia en el flujo ambulatorio · **valida-med**
- `src/lib/expediente/labs-desde-texto.ts:49` · Nefrologia
- Impacto: La hiperkalemia es la complicación aguda que mata en enfermedad renal crónica, y el dato ya está capturado y estructurado dentro de la app cuando se prescribe el fármaco que la agrava. El sistema tiene el número y no lo usa. El médico ve una alerta 'moderada' idéntica a la que ve siempre y no distingue el caso peligroso del rutinario. Lo mismo apli
- Arreglo: Añadir a copiloto.ts un generador que consuma `e.labs.potasio` y `e.labs.sodio` (los umbrales ya están escritos y auditados en lab-criticos.ts:54-55, reutilizarlos en vez de duplicarlos) y que eleve la severidad de la regla de IECA/ARA-II + ahorrador de potasio cuando el K capturado esté por encima del rango, siguiendo el mismo patrón que ya usa `ajusteRenal` con la creatinina. Incluir trimetoprim

### 116. [P2] (clinico) El peso para la edad se clasifica con los cortes de sobrepeso/obesidad del IMC · **valida-med**
- `src/lib/expediente/pediatria.ts:320` · Pediatria
- Impacto: Se documenta un diagnóstico nutricional en el expediente a partir de un indicador que no lo sostiene. Puede iniciar una intervención dietética o un estudio de desnutrición innecesarios, o al revés, tranquilizar cuando el IMC/edad sí estaba alterado.
- Arreglo: Separar la clasificación de 'peso' en su propia función (como ya se hizo con talla y perímetro), con las categorías que la OMS define para peso-para-la-edad y SIN categorías de sobrepeso/obesidad hacia arriba; dejar clasificarZ solo para el IMC para la edad. Las etiquetas y los puntos de corte exactos que se usen deben ser validados por el médico antes de escribirlas en la nota.

### 117. [P2] (clinico) Salbutamol nebulizado: el panel muestra un total diario de 216 mg (72 nebulizaciones al día) · **valida-med**
- `src/lib/expediente/pediatria.ts:137` · Pediatria
- Impacto: Una cifra de dosis diaria sin sentido clínico impresa junto a una dosis correcta. En una urgencia, un residente o una enfermera que lea el 'total/día' como el techo permitido puede seguir nebulizando muy por encima de lo razonable; y en general erosiona la confianza en el resto de los totales diarios del panel, que sí son correctos.
- Arreglo: Marcar en FarmacoPed los fármacos de rescate/crisis con un indicador (p. ej. `episodico: true` o un campo `dosisMaxEpisodio`) y, cuando esté presente, NO calcular ni mostrar un total diario: sustituirlo por el texto de la pauta de crisis (número de nebulizaciones de la serie inicial y cuándo reevaluar). El número de nebulizaciones de la serie y el techo por episodio los debe fijar el médico; no pr

### 118. [P2] (clinico) La capa de riesgo hepático de fármacos no la consume nadie y, además, sus entradas son nombres de clase sin sinónimos · **valida-med**
- `src/lib/expediente/prescripcion-segura.ts:211` · Gastroenterologia y Hepatologia
- Impacto: El sistema tiene escrita la advertencia correcta para los dos errores de prescripción que más descompensan a un cirrótico —AINE y benzodiacepinas— y jamás la muestra. No hay ninguna otra ruta que lo cubra: farmacovigilancia.ts solo mira pares de fármacos, y funcion-renal.ts solo depuración renal.
- Arreglo: Dos pasos: (1) añadir el campo `sinonimos` a RIESGO_HEPATICO con los principios activos de cada clase, replicando exactamente el patrón ya validado de EMBARAZO_LACTANCIA, y usarlo en el `find` de la línea 276; (2) conectar la revisión en el copiloto y en la pantalla de receta, condicionada a hepatopatía documentada (diagnóstico con cirrosis/hepatopatía/Child-Pugh capturado), igual que ajusteRenal 

### 119. [P2] (clinico) La plantilla de nota postoperatoria omite campos que la NOM-004 pide, y el validador no los exige · **valida-med**
- `src/lib/expediente/templates.ts:79` · Ortopedia y Traumatologia
- Impacto: En traumatología la nota quirúrgica es la pieza medicolegal central: el conteo de textiles es la defensa documental ante un cuerpo extraño retenido, el envío de piezas importa en tumores óseos y en tejido de revisión séptica, y la identificación del equipo es lo primero que se busca en una demanda. La app promete cumplimiento NOM-004 y firma como c
- Arreglo: Agregar a SECCIONES_POR_TIPO.nota_postoperatoria los campos faltantes (conteo de gasas y compresas, envío de piezas/biopsias a patología, integrantes del equipo quirúrgico incluido el anestesiólogo, y pronóstico), marcando como obligatorios los que la norma exija; al estar en la plantilla, validarNOM004 los bloqueará automáticamente. Conviene contrastar la lista exacta de apartados contra el texto

### 120. [P2] (clinico) NEWS2 implementa solo la Escala 1 de SpO₂: el paciente con EPOC hipercápnico sobre-oxigenado puntúa 0 · **valida-med**
- `src/lib/hospital/news2.ts:59` · Neumologia
- Impacto: En el paciente EPOC hipercápnico, la saturación alta bajo oxígeno es precisamente el patrón que precede a la narcosis por CO₂, y el score lo clasifica como riesgo bajo con recomendación de monitoreo de rutina. Es un falso negativo en la población que más vigilo en piso. En el sentido inverso el defecto genera ruido: el mismo paciente respirando air
- Arreglo: Añadir a SignosNews2 un campo explícito (p. ej. `escalaSpo2?: 1 | 2`), exponerlo como casilla en el formulario de signos («objetivo 88-92% — insuficiencia respiratoria hipercápnica»), persistirlo en types/hospital.ts junto con spo2, e implementar la tabla de la Escala 2. Los cortes exactos de la Escala 2 debe transcribirlos el médico desde el documento oficial del Royal College — no los propongo a

### 121. [P2] (clinico) Las indicaciones al paciente nunca se paginan: si son largas, se recortan en silencio al imprimir
- `src/lib/receta-paginacion.ts:223` · Ortopedia y Traumatologia
- Impacto: El paciente se va a casa con el papel que le entregué al que le faltan justamente los signos de alarma del final (fiebre, aumento de dolor, datos de síndrome compartimental, datos de TVP). Es pérdida de información clínica en el documento que se entrega, sin ninguna señal para el médico de que ocurrió. Afecta igual a la orden médica, que comparte e
- Arreglo: Tratar las indicaciones y la nota al paciente como bloques paginables: partir el texto por líneas/párrafos con el mismo estimador `lineasDeTexto` que ya existe, repartirlo en las hojas que haga falta (con un encabezado 'Indicaciones (continúa)') y mantener la firma en la última. Como red de seguridad adicional, cuando el texto estimado no quepa, mostrar en la pantalla de receta un aviso equivalent

### 122. [P2] (clinico) El verificador de dosis ignora la vía: ketorolaco 30 mg VO cada 8 h (90 mg/día oral) pasa sin una sola alerta · **valida-med**
- `src/lib/seguridad/dosis.ts:48` · Ortopedia y Traumatologia
- Impacto: Es el error de prescripción de ketorolaco más común en México y el motor determinista de seguridad —cuyo propósito declarado es cachar justo este tipo de fallo— lo deja pasar en silencio. En el paciente ortopédico típico (adulto mayor postoperado, con frecuencia deshidratado o con TFG limítrofe) el exceso de ketorolaco oral y prolongado se traduce 
- Arreglo: Agregar `via` y `duracionDias` opcionales a EntradaDosis y permitir topes por vía en FarmacoRef (p. ej. un maxDiaMg específico para vía oral), de modo que la nota que ya está escrita en el catálogo se convierta en regla ejecutable; pasar desde la página de receta la vía y la duración que el médico capturó. Los valores concretos (tope oral, tope en ≥65 años, días máximos) deben confirmarse contra l

### 123. [P2] (diseno) La rejilla del dashboard es fija (1fr 300px) y desborda horizontalmente en teléfono
- `src/app/(dashboard)/dashboard/page.tsx:182` · Director de diseno - app interna
- Impacto: Es la pantalla de aterrizaje de la aplicación y la que el médico abre cada mañana desde el teléfono. El scroll horizontal en la primera pantalla es el peor primer contacto posible, y además ahí conviven nombres de pacientes y estados de cita que quedan truncados. La app tiene BottomNav, safe-areas y objetivos táctiles de 44px: móvil es un caso de u
- Arreglo: Darle un className (p. ej. dash-body) y una regla en globals.css: .dash-body { display:grid; grid-template-columns: minmax(0,1fr) 300px; gap:20px } y @media (max-width:900px){ .dash-body{ grid-template-columns:1fr } }. Añadir minmax(0,1fr) también en escritorio evita que la lista de citas fuerce el ancho. Aprovechando el cambio: con una sola tarjeta dentro, la columna de 300px es mucho lienzo para

### 124. [P2] (diseno) Badges de estado con pasteles cableados que desaparecen en modo claro, con el arreglo ya construido y sin usar
- `src/app/(dashboard)/lista-espera/page.tsx:160` · Auditor de coherencia UX
- Impacto: El médico ya reportó antes «no se ven las letras» y se hizo una pasada AA que produjo los tokens --badge-*; estas pantallas quedaron fuera. El caso de /farmacia es el más delicado porque «CONTROLADO» es un marcador regulatorio (estupefacientes/psicotrópicos) que se vuelve ilegible justo en el tema que sale por defecto con luz de consultorio. En /li
- Arreglo: Sustituir cada literal hex por los tokens que ya existen: `color: 'var(--badge-purple-t)'` / `background: 'var(--badge-purple-b)'` para el sello CONTROLADO y el botón «Unirse»; `--badge-blue-*`, `--badge-amber-*`, `--badge-green-*` para los tres estados de /lista-espera. Para /lista-espera lo más limpio es generalizar el patrón de StatusBadge: añadir a StatusBadge.tsx (o a un `Badge` de tono) un m

### 125. [P2] (diseno) En la receta, «Imprimir» y «Word» se ven activos pero no hacen nada cuando falla la configuración; y el bloqueo por receta vacía no se explica
- `src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx:422` · Director de diseno - app interna
- Impacto: En (a) el médico pulsa Imprimir varias veces creyendo que la impresora tardó, y puede acabar imprimiendo desde el navegador un documento sin membrete, sin firma y sin cédula. En (b) la acción principal de la pantalla está apagada sin motivo visible, que es la forma más rápida de que alguien crea que la aplicación está rota.
- Arreglo: Unificar la condición: const bloqueado = recetaVacia || !!configError || descargando, y aplicar disabled={bloqueado} a los tres botones (los guardas internos quedan como red de seguridad, no como sustituto del estado visual). Añadir title/aria-disabled dinámico con la causa concreta («Agrega al menos un medicamento o indicaciones generales» / «No se pudo cargar la configuración de tu consultorio»)

### 126. [P2] (diseno) La landing está clavada al tema oscuro: en modo claro el H1 y el wordmark de la barra quedan negro-sobre-negro
- `src/app/page.tsx:167` · Director de diseno - sitio publico
- Impacto: El primer pantallazo del sitio — el titular y la marca — se pierde para cualquier visitante en tema claro. Es el momento de mayor deserción de una landing: si no se lee la propuesta de valor en los primeros 2 segundos, el visitante se va. Además rompe la coherencia con las demás páginas públicas, que sí son theme-aware.
- Arreglo: Tres cambios acotados en page.tsx: (1) hacer el H1 y el badge del hero independientes del tema, con un color fijo claro (el hero es una pieza oscura por diseño) o condicionar la imagen al tema; (2) reemplazar el velo transparente-en-el-centro por uno que sí cubra la zona del titular (p. ej. una capa plana semiopaca del color del hero bajo el bloque de texto, no un radial que se abre justo donde es

### 127. [P2] (diseno) La banda de cifras del hero incluye un 'dato' que no es un dato: la palabra 'menos' a 36 px como si fuera una métrica
- `src/app/page.tsx:237` · Director de diseno - sitio publico
- Impacto: Una métrica visiblemente vacía en la banda de prueba social contamina las otras tres por asociación — el lector concluye que las cifras son decorativas. Es especialmente costoso aquí porque el resto del sitio (/evidencia, el bloque Trust de page.tsx:529-532) apuesta explícitamente su posicionamiento a 'no inflamos cifras'. Una celda mal construida 
- Arreglo: Quitar la celda 'menos' y dejar tres celdas, o separar la fila en dos registros visuales distintos: una cifra grande con respaldo ('hasta 40%' + su asterisco a /evidencia) y, aparte y con tipografía menor, los hechos de la oferta ('$0 los primeros 14 días', 'listo en 5 min'). No inventar un porcentaje de ahorro de tiempo: hasta que exista una medición propia, la mejora es textual, no numérica.

### 128. [P2] (diseno) /precios está huérfana: la landing nunca la enlaza y la página no tiene barra, logo, footer ni regreso
- `src/app/precios/page.tsx:65` · Director de diseno - sitio publico
- Impacto: 'Precios' es el enlace que más se busca en un sitio SaaS y el segundo de mayor intención después de 'Empezar'. Que no exista en la barra obliga a hacer scroll por toda la landing o a abandonar. Y una /precios sin marca ni navegación, que es donde aterriza el tráfico pagado, no da señal de sitio real: sin logo ni footer no hay enlace a Seguridad, Té
- Arreglo: Extraer Nav y Footer de src/app/page.tsx a componentes compartidos (p. ej. src/components/publico/NavPublica.tsx y FooterPublico.tsx) y montarlos en un layout de grupo de rutas para todas las páginas públicas (/precios, /arquitectura, /paquetes, /operacion, /demo, /seguridad, /evidencia), no en el layout raíz para no meterlos en el dashboard. Añadir 'Precios' a la barra (apuntando a /precios) y al

### 129. [P2] (diseno) Los rótulos de navegación no tienen fuente única: un destino con cuatro nombres y una palabra («Consulta») para dos destinos
- `src/components/Sidebar.tsx:28` · Auditor de coherencia UX
- Impacto: Rompe la regla básica de reconocimiento: el usuario no puede confirmar que llegó a donde quería porque el rótulo del origen nunca coincide con el título del destino. El caso de «Consulta» es el peor: la misma palabra enseña al usuario dos comportamientos contradictorios, y el módulo /pacientes fue explícitamente unificado (ver el comentario en expe
- Arreglo: Crear un único mapa `RUTAS` (p.ej. src/lib/nav-labels.ts) con `{ href, label, titulo }` y consumirlo desde Sidebar, BottomNav, PaletteBusqueda y el PageHeader/h1 de cada página, de modo que el rótulo y el título salgan del mismo sitio. Decisiones concretas mínimas: /pacientes → «Pacientes» en Sidebar (alinear con BottomNav y con el h1, y con la unificación ya documentada); /asistente → un solo nom

### 130. [P2] (diseno) Rutas huérfanas: el núcleo clínico y /corte-caja dejan el menú lateral sin ningún elemento activo
- `src/components/Sidebar.tsx:162` · Auditor de coherencia UX
- Impacto: Se pierde la orientación («¿dónde estoy?») justo en las pantallas de mayor uso, y la paleta —que es el atajo pensado para usuarios expertos— enseña un camino que el propio equipo declaró obsoleto, partiendo el módulo de Finanzas en dos vistas que no se conocen entre sí.
- Arreglo: (a) Añadir a cada entrada de NAV un `coincide?: (p: string) => boolean` opcional, igual que ya hace BottomNav con su campo `active`, y darle a /pacientes `p => p.startsWith('/pacientes') || p.startsWith('/expediente') || p.startsWith('/consulta/') || p.startsWith('/nota/') || p.startsWith('/receta/') || p.startsWith('/orden/') || p.startsWith('/referencia/')`. Ojo con el orden: /consulta/ debe eva

### 131. [P2] (infecto) El gate de fosfomicina sólo cubre Enterobacterales: en Enterococcus faecium urinario informa «S» sin marcarlo como no aplicable · **valida-med**
- `src/lib/expediente/antibiograma/clsi-breakpoints.ts:394` · Microbiologo clinico CLSI
- Impacto: En un urocultivo con E. faecium —donde la fosfomicina oral es una tentación real porque las alternativas son linezolid o daptomicina— la celda se muestra como susceptible utilizable, avalada por una referencia CLSI, sin la advertencia que el mismo motor sí emite para Klebsiella. El comentario del propio código («E. faecalis IVU») indica que el alca
- Arreglo: Extender la condición del gate a la rama de enterococo, replicando el patrón que ya funciona para E. coli: si el grupo es 'enterococcus_faecium' (o el organismo no es E. faecalis) marcar noAplicable con un motivo que cite el alcance de la tabla. Antes de fijar el texto, el dueño debe confirmar contra la Tabla 2D del M100-Ed35 el alcance exacto de la nota de fosfomicina (y de paso el de nitrofurant

### 132. [P2] (infecto) La resistencia intrínseca de Enterococcus a cefalosporinas omite las de 1ª/2ª generación: «Cefalotina S» o «Cefazolina S» no genera conflicto pese a que la propia nota dice «TODAS las cefalosporinas»
- `src/lib/expediente/antibiograma/intrinseca.ts:143` · Microbiologo clinico CLSI
- Impacto: Un E. faecalis de urocultivo con «Cefalotina S» —reporte frecuente y clínicamente falso— se presenta al médico sin ninguna señal, y la cefalotina/cefazolina en enterococo falla in vivo. Se pierde además la doble utilidad que el módulo promete: no alerta al clínico y no señala el posible error de identificación de especie que ese «S» delata.
- Arreglo: Añadir a la regla de Enterococcus las entradas faltantes reusando las constantes existentes (CEF1G y CEFOXITINA de util.ts, más cefuroxima), con la misma nota de resistencia intrínseca de clase. Conviene revisar en el mismo pase la regla de Acinetobacter (intrinseca.ts:131-137), que declara ertapenem, aztreonam y CEF1G pero no ampicilina ni amoxicilina-clavulanato; y notar que AMOXI_CLAV (util.ts:

### 133. [P2] (infecto) Una fila nueva del panel nace preseleccionada en «S»: la ruta manual no tiene la salvaguarda anti-falso-sensible que sí tiene la ruta de foto
- `src/app/(dashboard)/antibiograma/page.tsx:51` · Micologo clinico
- Impacto: Un fármaco añadido y no completado se propaga al motor como sensible: puede apagar una rama de carbapenemasa (carbaS/algunoS), aparecer en la terapia dirigida y quedar escrito en la nota clínica. Es el mismo vector de daño que ya se cerró en la ruta de foto, abierto en la ruta que más se usa.
- Arreglo: Que la fila nueva nazca sin categoría (interpretacion: null / 'sin definir'), que ningún botón se vea activo hasta que el médico elija, y que el motor ignore las filas sin categoría mostrando un contador de «filas sin interpretar». Mantener el mismo criterio en las dos filas de arranque.

### 134. [P2] (infecto) Foto ilegible: no se avisa que no se importó ninguna fila y el panel queda con las filas por defecto marcadas «S»
- `src/app/(dashboard)/antibiograma/page.tsx:223` · Auditor del motor de IA del antibiograma
- Impacto: El motor produce una interpretación con apariencia de resultado real basada en dos sensibilidades inventadas por el estado inicial de la UI: para Enterobacterales, ceftriaxona S + meropenem S apaga las vías de BLEE, AmpC y carbapenemasa y deja el mensaje de desescalar. Es el mismo tipo de falso «sensible» que el código ya combate deliberadamente en
- Arreglo: Cuando `celdas.length === 0` o `legibles.length === 0`, emitir un aviso explícito («No se pudo leer ninguna fila del panel: captúralo a mano») y vaciar las filas sembradas (setFilas([])) en lugar de conservarlas, para que la interpretación no se calcule sobre valores por defecto. Alternativamente, que nuevaFila no fije 'S' por defecto sino un estado sin elegir que bloquee el cálculo.

### 135. [P2] (infecto) Estafilococo coagulasa-negativo: se le aplica el punto de corte de vancomicina de S. aureus · **valida-med**
- `src/lib/expediente/antibiograma/clsi-breakpoints.ts:268` · Infectologo clinico de adultos
- Impacto: En bacteriemia asociada a catéter por CoNS —el escenario que motivó todo el bloque— una CMI de vancomicina en la banda 4-16 se informa como I/R y arrastra a la nota la conclusión de que la vancomicina no sirve, empujando a daptomicina o linezolid sin necesidad. También contamina la comparación `concuerda` que motor.ts:98 hace contra la categoría de
- Arreglo: NO aplicar un número de memoria. Verificar la fila de vancomicina para «Staphylococcus spp. (coagulase-negative)» en la Tabla 2C del CLSI M100-Ed35 impreso y, si difiere de la de S. aureus, sobreescribirla explícitamente en STAPHYLOCOCCUS_CONS igual que ya se hizo con oxacilina, transcribiendo el valor de la tabla y actualizando el comentario de las líneas 250-267 (que hoy afirma que la única dife

### 136. [P2] (infecto) claveFarmaco() usa `includes` crudo: «Cefepime-taniborbactam» y «Cefepime-enmetazobactam» reciben el punto de corte de cefepime solo
- `src/lib/expediente/antibiograma/clsi-breakpoints.ts:345` · Infectologo pediatrico
- Impacto: Se atribuye una categoría y una referencia CLSI a una combinación que no tiene ese punto de corte en la tabla cargada, y el campo `concuerda` puede acusar de discrepante al laboratorio que sí aplicó el corte correcto. El daño es acotado porque son fármacos poco disponibles en México, pero el modo de fallo es silencioso: no hay «no hay punto de cort
- Arreglo: Sustituir `a.includes(norm(s))` por `coincideAntibiotico(antibiotico, s)` en claveFarmaco, y devolver null (con motivo «sin punto de corte cargado para esta combinación») cuando el nombre contenga un inhibidor que no pertenezca a la clave candidata. Añadir tests para Cefepime-taniborbactam, Cefepime-enmetazobactam y Aztreonam-avibactam.

### 137. [P2] (infecto) La tabla de estafilococos coagulasa-negativos hereda el punto de corte de vancomicina de S. aureus (sólo se sobrescribe oxacilina) · **valida-med**
- `src/lib/expediente/antibiograma/clsi-breakpoints.ts:268` · Farmaceutico clinico PROA PK/PD
- Impacto: Si CLSI M100-Ed35 Tabla 2C define para CoNS un corte de vancomicina distinto del de S. aureus, toda CMI de vancomicina en la banda intermedia de S. aureus se está categorizando mal en bacteriemia asociada a catéter por S. epidermidis — el escenario más frecuente de CoNS— y motor.ts marcará `concuerda:false` frente a un laboratorio que sí aplicó el 
- Arreglo: Verificar en la tabla impresa de CLSI M100-Ed35 (Tabla 2C) si vancomicina —y teicoplanina— tienen fila propia para 'Staphylococcus spp. coagulasa-negativos' distinta de la de S. aureus. Si la tienen, añadir la sobrescritura en STAPHYLOCOCCUS_CONS con los valores transcritos literalmente de la tabla y un test de frontera. NO transcribo cifras aquí: deben leerse de la fuente y validarse con el dueño

### 138. [P2] (infecto) claveFarmaco() usa `includes` crudo: los BL/BLI nuevos del propio catalogo reciben el punto de corte CLSI de OTRO farmaco (cefepime-taniborbactam -> cefepime, aztreonam-avibactam -> ceftazidima-avibactam) · **valida-med**
- `src/lib/expediente/antibiograma/clsi-breakpoints.ts:340` · Especialista en resistencia bacteriana
- Impacto: El sistema afirma una categoria S/SDD/R con cita CLSI para un farmaco cuyo punto de corte no leyo, y puede marcar como «discordante» al laboratorio que si uso el corte correcto (motor.ts:98). En un BL/BLI de rescate —los que se usan cuando ya no queda nada— una categoria fabricada empuja la decision terapeutica en la direccion equivocada. Es la cla
- Arreglo: Reemplazar la comparacion `a.includes(norm(s))` de la linea 345 por la misma `coincideAntibiotico` de util.ts (frontera de token + regla del agente suelto vs combinacion), quitar 'avibactam' de la lista de alias de la linea 49, y hacer que un farmaco sin fila en la tabla del grupo devuelva null explicitamente en vez de degradar al componente suelto. Los puntos de corte reales de aztreonam-avibacta

### 139. [P2] (infecto) claveFarmaco() casa por subcadena: aztreonam-avibactam se interpreta con los puntos de corte de ceftazidima-avibactam
- `src/lib/expediente/antibiograma/clsi-breakpoints.ts:345` · Especialista en sepsis
- Impacto: Reporta como sensible/discordante un farmaco con el punto de corte de otro. Aztreonam-avibactam es precisamente el agente de eleccion frente a metalo-beta-lactamasas (NDM), el escenario mexicano dominante que el propio modulo prioriza (epidemiologia.ts / PRIOR_MEXICO): una CMI mal categorizada ahi decide el tratamiento de una CRE en choque septico.
- Arreglo: Sustituir el a.includes(...) por coincideAntibiotico() de util.ts (ya exportada y probada en antibiograma-matcher.test.ts), que aplica frontera de token y la regla de agente-suelto-vs-combinacion. Ordenar por longitud del ALIAS que casa, no de la clave. Y devolver null explicito (sin categorizar) cuando el farmaco sea una combinacion sin fila propia en la tabla, en vez de caer al componente suelto

### 140. [P2] (infecto) Fosfomicina en E. faecium hereda el punto de corte que el propio código anota como «E. faecalis IVU» · **valida-med**
- `src/lib/expediente/antibiograma/clsi-breakpoints.ts:288` · Especialista en IVU y piel/tejidos blandos
- Impacto: En una IVU por E. faecium (típicamente ya ampicilina-R y con opciones muy escasas) el motor puede presentar la fosfomicina como opción sensible respaldada por un punto de corte que, según la anotación del propio archivo, se validó en otra especie. Es el mismo tipo de sobre-extrapolación que el equipo ya bloqueó para Klebsiella.
- Arreglo: Extender la condición de gating para que, cuando `clave === 'fosfomicina'` y el grupo sea enterocócico, exija E. faecalis (marcar noAplicable con el motivo correspondiente en E. faecium), del mismo modo que hoy exige E. coli en Enterobacterales. Antes de fijarlo, confirmar contra el M100-Ed35 Tabla 2D el alcance exacto por especie (y de paso el de nitrofurantoína en enterococo).

### 141. [P2] (infecto) Ertapenem INTERMEDIO aislado no dispara nada: el patrón centinela de OXA-48 / pérdida de porina es inalcanzable porque la compuerta exige R estricta · **valida-med**
- `src/lib/expediente/antibiograma/enterobacterales.ts:54` · Epidemiologo hospitalario IAAS
- Impacto: El ertapenem intermedio con meropenem/imipenem sensibles es justamente el patrón de tamizaje de OXA-48-like y de pérdida de porina + BLEE/AmpC — el fenotipo que más se escapa en vigilancia de CRE porque los demás carbapenémicos se ven bien. Se pierde en silencio la sugerencia de confirmación molecular, la precaución de contacto preventiva y la seña
- Arreglo: Unificar la compuerta usando no-sensibilidad también en la rama no-Proteae: const carbaR = esProteae ? (NO_S(ert) || NO_S(mer)) : CARBAPENEM.some(a => NO_S(estado(r, [a]))). Si se prefiere no elevar la alarma completa con un solo 'I', al menos derivar la rama ertAislado a una advertencia y a pruebasSugeridas (mCIM/eCIM + molecular) sin marcar notificacionObligatoria. Nota: aplicar este cambio DESP

### 142. [P2] (infecto) «K. pneumoniae» entra al módulo de neumococo: el guard anti-Klebsiella solo reconoce el género completo
- `src/lib/expediente/antibiograma/grampositivos.ts:22` · Infectologo clinico de adultos
- Impacto: Razonamiento clínico de la especie equivocada sobre el aislamiento gramnegativo más importante del hospital, y pérdida de la edición interpretativa de fluoroquinolonas que sí le corresponde. Es el mismo mecanismo del hallazgo P0 y confirma que el reconocimiento de organismo está duplicado con criterios distintos en cada módulo.
- Arreglo: Sustituir las tres condiciones por la misma prueba que ya usa clsi-breakpoints.grupoDe (exigir contexto de Streptococcus/neumococo en vez de la clave suelta 'pneumoniae'), idealmente exportando `grupoDe` o una función `esNeumococo(organismo)` única y consumiéndola desde grampositivos.ts y seguridad.ts.

### 143. [P2] (infecto) Estafilococo coagulasa-negativo meticilina-R se reporta como notificación epidemiológica obligatoria + precauciones de contacto «MRSA» · **valida-med**
- `src/lib/expediente/antibiograma/grampositivos.ts:99` · Epidemiologo hospitalario IAAS
- Impacto: Convierte el hallazgo más común y menos accionable del laboratorio en un evento notificable con aislamiento de contacto. En un hospital real eso satura al comité de IAAS con eventos que no lo son, diluye la señal de los MRSA verdaderos, y como el aviso llega junto a una recomendación de vancomicina puede empujar a tratar un hemocultivo contaminado 
- Arreglo: Condicionar las consecuencias epidemiológicas a la especie: emitir out.notificacion = true y out.aislamiento solo cuando esAureus (o S. lugdunensis, que se comporta como aureus según clsi-breakpoints.ts:265-267). Para el resto de coagulasa-negativos, mantener el fenotipo y la advertencia terapéutica pero sustituir la alerta por una nota didáctica que recuerde que la meticilinorresistencia es esper

### 144. [P2] (infecto) La regla intrínseca de Enterococcus dice «TODAS las cefalosporinas» pero solo comprueba 3ª/4ª generación: una cefalexina o cefazolina «S» no genera conflicto
- `src/lib/expediente/antibiograma/intrinseca.ts:143` · Infectologo pediatrico
- Impacto: La cefalexina es la cefalosporina oral más prescrita en pediatría y aparece en los paneles urinarios; un Enterococcus de urocultivo infantil informado «cefalexina S» pasa sin la alerta que el módulo existe para dar, y el niño puede recibir un fármaco al que el germen es naturalmente resistente. También queda subestimada la exclusión de intrínsecas 
- Arreglo: Ampliar el agente de esa regla a [...CEF3G, ...CEF1G, ...CEFEPIME, ...CEFOXITINA] (y añadir 'cefuroxima'/'cefaclor'/'cefprozilo' a un grupo CEF2G en util.ts si se quiere cobertura completa), dejando el texto de la nota tal cual. Añadir un test con «Enterococcus faecalis + Cefalexina S» que exija tipo 'conflicto'.

### 145. [P2] (infecto) Falta la regla CLSI de reporte selectivo de Salmonella/Shigella: cefalosporinas de 1a-2a generacion y aminoglucosidos se muestran «S» sin ningun aviso de que no son clinicamente eficaces · **valida-med**
- `src/lib/expediente/antibiograma/intrinseca.ts:41` · Especialista en resistencia bacteriana
- Impacto: Fiebre entérica o salmonelosis invasiva tratada con un aminoglucosido o una cefalosporina de 1a generacion por confiar en la «S» del panel. Es un fallo terapeutico conocido y documentado (penetracion intracelular nula del aminoglucosido), y es exactamente la clase de trampa que este modulo promete cerrar para otras especies. Riesgo agravado en Mexi
- Arreglo: Anadir a REGLAS (intrinseca.ts) una entrada con claves ['salmonella','shigella'] que use `avisoClinico` —no `conflicto`, porque NO es un error de identificacion— para CEF1G, cefuroxima, cefoxitina y AMINOGLUCOSIDO, con texto del tipo «no informar como sensible: activo in vitro pero sin eficacia clinica demostrada en infeccion por Salmonella/Shigella». Los agentes exactos que cubre la regla y su re

### 146. [P2] (infecto) La regla intrinseca de Enterococcus dice «R a TODAS las cefalosporinas» pero solo cubre 3a y 4a generacion: cefazolina/cefalotina/cefuroxima/cefoxitina «S» no generan conflicto · **valida-med**
- `src/lib/expediente/antibiograma/intrinseca.ts:143` · Especialista en resistencia bacteriana
- Impacto: Doble perjuicio, ambos del lado peligroso. (1) Se pierde la senal de error de identificacion: una «S» a cefazolina en un supuesto enterococo es biologicamente imposible y es justo lo que el modulo promete detectar. (2) Se muestra una cefalosporina de 1a-2a generacion como opcion utilizable en un enterococo, que es un fallo terapeutico seguro — y la
- Arreglo: Ampliar la lista de agentes de la regla de Enterococcus para cubrir toda la clase de cefalosporinas (CEF1G, cefuroxima, CEFOXITINA, ademas de CEF3G y CEFEPIME), de modo que el texto de la nota y el comportamiento coincidan. Revisar en la misma pasada las reglas de Stenotrophomonas y Acinetobacter, cuyos patrones naturales estan incompletos frente a lo que describen los encabezados del archivo. La 

### 147. [P2] (infecto) Enterococcus: la resistencia intrínseca a cefalosporinas omite las de 1ª generación, así que una cefazolina «S» no se marca como conflicto
- `src/lib/expediente/antibiograma/intrinseca.ts:143` · Especialista en IVU y piel/tejidos blandos
- Impacto: En celulitis y herida de pie diabético la cefalosporina de 1ª generación (cefazolina/cefalotina) es el caballo de batalla en México. Si el cultivo aísla E. faecalis y el laboratorio imprime cefalotina «S» —o simplemente el médico la considera— el módulo, que sí grita ante ceftriaxona, se queda callado justo en el fármaco que más probablemente se va
- Arreglo: Añadir CEF1G (y las cefamicinas/C2G) al arreglo de agentes de la regla de Enterococcus en intrinseca.ts, para que la «S» reportada dispare el mismo conflicto que ya dispara la C3G y para que queden excluidas del conteo MDR.

### 148. [P2] (infecto) Alerta critica de 'colistina-R, ultima linea comprometida' en especies intrinsecamente resistentes a colistina (incluido un Gram positivo)
- `src/lib/expediente/antibiograma/motor.ts:147` · Especialista en sepsis
- Impacto: Ruido de alarma critica en el modulo cuyo valor depende de que sus alertas criticas sean creibles: una colistina-R aparece como 'ultima linea comprometida' con mecanismo mcr/pmrAB inventado en organismos donde es fisiologica. Desgasta la confianza en las alertas rojas (fatiga de alarma) justo en la pantalla donde una alerta roja real debe detener a
- Arreglo: Condicionar la regla: if (ES_R(estado(r, COLISTINA)) && !esIntrinsecamenteResistente(organismo, 'colistina')). En el caso intrinseco, degradar a nota didactica ('colistina R esperada: resistencia natural de la especie, no valorable'). Aplicar el mismo filtro a la clase COLISTINA dentro de contarClasesResistentes() (motor.ts:181), que hoy ademas casa por norm(x.antibiotico).includes(norm(a)) crudo 

### 149. [P2] (infecto) El conteo MDR aproximado usa comparación de subcadena y no excluye la resistencia intrínseca
- `src/lib/expediente/antibiograma/motor.ts:187` · Auditor del motor de IA del antibiograma
- Impacto: Etiqueta como multirresistente a un aislamiento que solo muestra su patrón natural. El propio código describe la consecuencia en intrinseca.ts:239: «dispara aislamiento de contacto y escalada a antibióticos de reserva que ese paciente no necesita». La mitigación existente (confianza 'sospecha' y la palabra «aproximado») no evita que el fenotipo se 
- Arreglo: Reemplazar el `includes` por `casaAlguno(x.antibiotico, agentes)` (ya importado en el módulo vía util) y filtrar los agentes con esIntrinsecamenteResistente(organismo, a) antes de contar, exactamente como hace mdr.ts:71-75. Considerar además suprimir el fenotipo aproximado cuando la ruta formal ya evaluó al organismo, para no depender del orden de fusión.

### 150. [P2] (infecto) El panel es S/I/R puro: fluconazol en C. glabrata (categoría SDD, sin categoría S) no se puede capturar, y la ruta de foto descarta esas filas · **valida-med**
- `src/lib/expediente/antibiograma/tipos.ts:28` · Micologo clinico
- Impacto: Se pierde en silencio la categoría antifúngica que decide el tratamiento (SDD obliga a esquema de dosis alta o a cambiar de familia, no equivale a S). El mismo hueco afecta a cefepime SDD en enterobacterales y a daptomicina SDD en E. faecium, categorías que el motor ya sabe calcular a partir de la CMI (clsi-breakpoints.ts:110 y 290) pero que no pue
- Arreglo: Ampliar SIR a 'S'|'SDD'|'I'|'R' (o añadir una bandera `sdd` a la fila), pintar el cuarto botón y hacer que la carga por foto conserve esas filas. En los módulos deterministas, tratar SDD como NO-sensible salvo donde exista una regla explícita, para no relajar ninguna inferencia existente.

### 151. [P2] (infecto) El validador anti-contradicción de la IA nunca dispara la regla 'evitar' (los agentes son frases multi-fármaco) y produce falsos positivos por subcadena
- `src/lib/expediente/antibiograma/validar-razonamiento.ts:34` · Farmaceutico clinico PROA PK/PD
- Impacto: Es la última red de seguridad entre el razonamiento del LLM y el médico. Hoy no atrapa el caso que más importa —que el modelo proponga ceftazidima-avibactam en una MBL, que es exactamente el desenlace del hallazgo P0— y en cambio marca como contradicción recomendaciones correctas de β-lactámicos nuevos, lo que enseña al usuario a ignorar las anotac
- Arreglo: Sustituir t.includes por una comparación con frontera de token reutilizando coincideAntibiotico (que el propio archivo ya reexporta en la línea 105), y hacer que las opciones 'evitar' declaren una lista de agentes atómicos (string[]) en vez de una frase, para que cada uno se valide por separado. Añadir tests: MBL + texto que recomienda CAZ-AVI → una contradicción; panel meropenem R + texto que rec

### 152. [P2] (ingenieria) Escritura anónima e imborrable en arco_requests de cualquier clínica
- `firestore.rules:317` · Ingeniero de sistemas (Firestore)
- Impacto: Inundación permanente del tablero de cumplimiento de cualquier consultorio con solicitudes falsas —cada una con su reloj de 20 días hábiles— más costo de almacenamiento y lecturas que no se puede revertir. También permite fabricar una solicitud ARCO a nombre de un tercero.
- Arreglo: Mover la creación a una ruta pública de servidor (Admin SDK) con rate-limit —ya existe ese mecanismo para los endpoints de IA— y validación de la forma del documento; en las reglas dejar `create: if false`. Si se prefiere conservarlo en el cliente, al menos exigir en la regla la forma exacta (`request.resource.data.keys().hasOnly([...])`, tipo dentro del enum, estado=='recibida', clinicId coincide

### 153. [P2] (ingenieria) El refresh token de Google Calendar es legible por JavaScript del navegador (regla googleTokens abierta al dueño del uid)
- `firestore.rules:536` · Auditor de seguridad y PHI
- Impacto: Un refresh token de Google no caduca con la sesión de NexusMED: sobrevive al logout y al cambio de contraseña de la app, y da acceso de lectura y escritura al calendario completo del médico de forma indefinida hasta que se revoque manualmente en la cuenta de Google. El calendario contiene nombre del paciente y motivo de la cita, o sea PHI. El `writ
- Arreglo: Cerrar la regla a `allow read, write: if false; // Admin SDK only`, igual que /secretos y /platform_payments. Nada del cliente la usa; el estado de conexión y la desconexión ya pasan por /api/calendar/status. Como refuerzo, considerar cifrar el refreshToken en reposo con una clave de entorno antes de guardarlo.

### 154. [P2] (ingenieria) Al hacer clic en una celda de hora del calendario, la hora prellenada se borra sola en /asistente
- `src/app/(dashboard)/asistente/page.tsx:95` · Cazador de UI muerta
- Impacto: El gesto más natural de la agenda —clic en el hueco de las 10:00 para agendar ahí— pierde silenciosamente la hora. La recepcionista tiene que volver a buscar y pulsar el horario, y si no se da cuenta pulsa Agendar y recibe un error confuso. La intención del código (prellenar) está escrita pero no funciona.
- Arreglo: Saltarse el reseteo en el primer render: guardar un `const montado = useRef(false)` y hacer `if (!montado.current) { montado.current = true; return }` al principio del efecto; o excluir doctorId de las dependencias y comparar contra el valor previo de fecha/tipo. Conviene además, si fechaParam cae en un mes futuro, inicializar mesOffset para que el día quede visible en la lista (diasDelMes solo ge

### 155. [P2] (ingenieria) Colores hardcodeados que evaden los tokens: las citas del calendario bajan a 1.94:1 y las alertas clínicas del MAR a 2.92:1 en modo claro
- `src/app/(dashboard)/calendario/page.tsx:242` · Auditor de accesibilidad
- Impacto: En modo claro, el nombre del paciente y la hora en el calendario —la pantalla más usada— son difíciles o imposibles de leer para cualquiera con visión reducida, presbicia o simplemente con reflejo de luz sobre la pantalla; se agrava porque el texto va a 11 px. En hospitalización, el texto de las alertas de alergia e interacción se degrada en el pun
- Arreglo: En las alertas de hospitalización, sustituir los tres hexadecimales por los tokens que ya existen y sí cambian por tema: `var(--red)`, `var(--amber)` y `var(--teal)`; conviene verificar además el ratio de `--red` en oscuro, porque #DC2626 sobre superficie oscura da 3.62:1 y podría necesitar aclararse para ese tema. En el calendario, dejar de usar el color del médico como color de texto: usar el co

### 156. [P2] (ingenieria) La subcolección clinics/{id}/members no existe en las reglas: cambiar tu nombre en el chat interno siempre falla
- `src/app/(dashboard)/chat/page.tsx:56` · Ingeniero de sistemas (Firestore)
- Impacto: Función de personalización rota de forma permanente y sin mensaje de error para el usuario. Efecto colateral clínico menor pero real: todo el personal que comparte `config.nombreMedico` (médicos y admin) aparece firmando los mensajes del chat interno con el mismo nombre, así que en el hilo no se distingue quién dijo qué.
- Arreglo: Decidir el modelo: o se elimina la subcolección `members` y el displayName se guarda donde ya hay regla propia por usuario (p. ej. el patrón de `learning/{uid}`: `allow read, write: if isMember(clinicId) && request.auth.uid == uid`), o se añade ese mismo bloque para `match /members/{uid}` en firestore.rules. En cualquier caso, poner un `.catch` en el getDoc de la línea 47 y avisar por toast si el 

### 157. [P2] (ingenieria) El streaming pisa cada ~20 s lo que el médico corrige a mano en el «Material de origen» mientras graba
- `src/app/(dashboard)/consulta/[patientId]/page.tsx:256` · Ingeniero de software senior (React/Next)
- Impacto: Se pierden en silencio correcciones sobre el material de origen, que es justo lo que alimenta a `procesarIA` (línea 789) y lo que se guarda como `transcripcionCruda` en la nota (línea 1293). Una corrección de fármaco/dosis descartada puede cambiar la nota que la IA estructura después.
- Arreglo: Marcar la edición manual del textarea (poner un ref tipo `transcripcionEditadaRef.current = true` en su onChange, igual que hace `edicionManualRef` en el onChange de las secciones, línea 2935) y saltar el volcado del parcial si está puesto —o fusionar en vez de reemplazar—, restableciéndolo en el flanco de subida de la grabación (efecto de la línea 217).

### 158. [P2] (ingenieria) En notas de hospital abiertas por ?nota=, "Descartar" limpia la llave de respaldo equivocada y la consulta descartada resucita
- `src/app/(dashboard)/consulta/[patientId]/page.tsx:1410` · Auditor de perdida de datos
- Impacto: La consulta que el médico descartó reaparece completa en el episodio y el autoguardado entra en fallo permanente sobre un documento inexistente. Es el patrón de 'datos zombis' al que el dueño es especialmente sensible, y además deja PHI en el disco de un dispositivo que puede ser compartido después de un borrado explícito.
- Arreglo: Añadir `respaldoKey` (y `borradorMem`, `audio`, `volverA`, que también están omitidos y sufren la misma obsolescencia en el `router.push(volverA)`) al arreglo de dependencias de `descartar`. Como cinturón adicional, en el descarte borrar AMBAS variantes de la llave (con y sin sufijo de episodio) y, ya que `clavesABorrar` existe, barrer por prefijo `nx.consulta.bkp.{patientId}`. Conviene revisar el

### 159. [P2] (ingenieria) El dashboard abre un listener de 120 días de citas para pintar 9 días
- `src/app/(dashboard)/dashboard/page.tsx:63` · Ingeniero de performance
- Impacto: Arranque lento y consumo de datos/lecturas ~13× mayor de lo necesario justo en la primera pantalla que ve el médico al entrar, y el sobrecoste crece con el historial de la agenda.
- Arreglo: Pasar la ventana que la pantalla realmente usa: useAppointments(`${sumarDiasISO(today, -7)} 00:00`) — el hook ya acepta el parámetro y solo amplía la ventana, nunca la encoge. Mismo cambio en /asistente pasando la fecha visible.

### 160. [P2] (ingenieria) La ficha de hospitalización re-descarga el expediente completo del paciente en cada acción del MAR
- `src/app/(dashboard)/hospitalizacion/[internamientoId]/page.tsx:121` · Ingeniero de performance
- Impacto: En la ronda de enfermería, cada administración del MAR provoca una descarga completa del expediente del paciente: la ficha tarda en refrescar en redes de hospital y el consumo de lecturas de Firestore se multiplica por el número de acciones del turno.
- Arreglo: Añadir en src/lib/expediente/firestore.ts una consulta acotada, p. ej. getNotasDeInternamiento(clinicId, patientId, internamientoId) = getDocs(query(notasCol(clinicId, patientId), where('internamientoId','==',internamientoId))) y usarla aquí; y separar el refresco: las acciones de indicaciones/MAR/interconsultas ya llegan por el onSnapshot de suscribirInternamiento (línea 147), así que no necesita

### 161. [P2] (ingenieria) "Compartir por WhatsApp" de referidos abre wa.me/52 — un número inválido, no el selector de contacto
- `src/app/(dashboard)/reactivacion/page.tsx:106` · Cazador de UI muerta
- Impacto: La única función de captación por referidos del producto no funciona: el médico intenta compartir su enlace de reserva y recibe un error de WhatsApp. Como el botón contiguo "Copiar enlace" sí funciona, el fallo pasa por "WhatsApp está raro" en vez de reportarse.
- Arreglo: Endurecer openWhatsApp para el caso sin destinatario: si `tel` queda vacío, construir la URL como `https://wa.me/?text=...` (omitiendo el número) en lugar de anteponer '52'. Eso arregla el botón de referidos sin tocar a ninguno de los otros 8 llamadores, que siempre pasan un teléfono real.

### 162. [P2] (ingenieria) Los botones Imprimir y Word de receta/orden/nota/referencia no se deshabilitan cuando falla la config: se ven activos y no hacen absolutamente nada
- `src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx:422` · Cazador de UI muerta
- Impacto: Justo en el peor momento (config no cargada, con el paciente enfrente esperando su receta) el médico pulsa Imprimir varias veces sin obtener nada ni entender por qué, mientras el botón contiguo sí se ve deshabilitado. Un botón que no responde y no explica se lee como "la app se colgó" y erosiona la confianza en el módulo de impresión.
- Arreglo: Añadir configError al `disabled` de esos botones exactamente igual que ya se hace en el de PDF: `disabled={recetaVacia || !!configError}` (receta:422 y :425), `disabled={ordenVacia || !!configError}` (orden:537 y :540), `disabled={!!configError}` (nota:189, referencia:127). Alternativamente, sustituir el `return` mudo por un toast que explique el motivo. Lo importante es que el estado visual del c

### 163. [P2] (ingenieria) El cron de recordatorios lee TODO el histórico de citas pendientes de cada clínica, en serie y sin maxDuration
- `src/app/api/cron/reminders/route.ts:114` · Ingeniero de performance
- Impacto: Coste de lecturas que crece sin techo cada hora, y riesgo de que el cron se corte a la mitad: las últimas clínicas del listado dejan de recibir sus recordatorios de 24 h y de mismo día sin ningún error visible. El recordatorio no enviado se traduce en inasistencias.
- Arreglo: Acotar la consulta por fecha igual que ya se hace más abajo en el mismo handler: añadir .where('fechaHora','>=', `${sumarDiasISO(hoyISO(),-1)} 00:00`) y una cota superior de ~+3 días (las ventanas usadas son 23–26 h y 1–4 h), filtrando el estado en código si el índice compuesto estorba. Declarar export const maxDuration en la ruta y paralelizar los envíos por clínica con un límite de concurrencia.

### 164. [P2] (ingenieria) /api/expediente/corregir no contabiliza ni topa créditos, y usa Opus 4.8 + auditoría GPT en todos los planes
- `src/app/api/expediente/corregir/route.ts:15` · Ingeniero de IA
- Impacto: Fuga de costo sin techo por un camino que el sistema de créditos —descrito en planes-ia.ts como «la única fuente de verdad» del gasto— no ve. Rompe el margen que el modelo de créditos pretende garantizar y hace que el medidor que se le muestra al médico (y al superadmin) subestime el consumo real.
- Arreglo: Aplicar aquí el mismo patrón que en `procesar`: consultar `creditosUsadosDelMes`/`entitlementsDe` antes de llamar (402 con `sinCreditos` o degradación a un modelo barato al agotarse), y registrar el consumo con `registrarCreditos`/`registrarUso` al devolver la corrección. Elegir el modelo de Claude según el motor/nivel (Rápida→Haiku, Estándar→Sonnet, Máxima→Opus) en lugar de arrancar siempre en Op

### 165. [P2] (ingenieria) La caché de modelo de la nota es global al proceso y no por llave: un consultorio puede degradar el motor 💎 Máxima de otro, que igual paga 10 créditos
- `src/app/api/expediente/procesar/route.ts:76` · Ingeniero de IA
- Impacto: Se cobra el nivel más caro y se entrega uno inferior, de forma no determinista y dependiente de qué otro cliente tocó la misma instancia. Rompe la coherencia de niveles que el menú de IA vende explícitamente («💎 Opus 4.8… 10 créditos») y contamina la trazabilidad SaMD: dos notas «Máxima» de la misma clínica pueden haber corrido con modelos distinto
- Arreglo: Indexar la caché por llave además de por perfil (p. ej. `Map<string, string>` con clave `hash(apiKey)+':'+perfil`), y no permitir que el fallo de una llave invalide la entrada de otra. Alternativamente, si el modelo resuelto no pertenece a `CANDIDATOS[perfil]`, no cobrar los créditos de ese motor y degradar `_motor`/`_plan` en la respuesta para que la insignia y el cargo reflejen lo que realmente 

### 166. [P2] (ingenieria) /api/expediente/transcribir-diarizado: el GET no ata el id de transcripción a quien lo pide, y el POST acepta cualquier audioUrl
- `src/app/api/expediente/transcribir-diarizado/route.ts:114` · Auditor de seguridad y PHI
- Impacto: Falta de aislamiento entre inquilinos sobre el dato más sensible que produce la app: la transcripción cruda de la consulta. La explotación exige conocer el id (que es aleatorio), así que no es enumerable a ciegas, pero cualquier filtración del id — un log, un equipo compartido, el historial del navegador — se convierte en fuga de PHI cross-tenant s
- Arreglo: En el POST, registrar el job (uid + clinicId + id devuelto por AssemblyAI) en Firestore, y en el GET rechazar todo id que no pertenezca al uid solicitante. Validar `audioUrl` contra el bucket propio y contra el prefijo consultas-audio/{uid}/ del usuario autenticado (el mismo criterio que ya aplica /api/receta/diseno al parsear la URL y comparar el segmento de bucket exacto). Mover el id del query 

### 167. [P2] (ingenieria) El botón "Empezar" del tour de bienvenida lleva a /agenda, una ruta que NO existe (404 en el primer ingreso del médico)
- `src/components/OnboardingTour.tsx:77` · Cazador de UI muerta
- Impacto: La PRIMERA acción que hace un médico recién registrado termina en una página de error. Es el peor momento posible para un dead-end: da la impresión de producto roto en el onboarding, justo donde se juega la retención del trial.
- Arreglo: Cambiar router.push('/agenda') por router.push('/dashboard') (la pantalla de inicio real, y lo que el propio paso 1 del tour describe: "Es tu pantalla de inicio") o '/calendario' si se quiere aterrizar en la agenda. Además, revisar src/app/robots.ts:19 para quitar '/agenda' del Disallow o dejarlo si se piensa recrear la ruta.

### 168. [P2] (ingenieria) Un segundo confirm() reemplaza al pendiente sin resolver su promesa: el `await` anterior queda colgado para siempre
- `src/context/ToastContext.tsx:60` · Ingeniero de software senior (React/Next)
- Impacto: Un `await confirm(...)` que no vuelve nunca deja el flujo a medias: en callbacks que ya hicieron `setGuardando(true)` antes del confirm, la pantalla se queda con los botones deshabilitados y sin salida salvo recargar. Es un riesgo latente en todas las acciones destructivas (descartar, borrar borrador, cortesía) que dependen de esta promesa.
- Arreglo: En `confirm`, resolver el pendiente anterior con `false` antes de sustituirlo: `setPending(prev => { prev?.resolve(false); return { mensaje, opts, resolve } })` — o, mejor, encolar en vez de reemplazar. Sacar los `resolve` del updater de `setPending` (guardarlos en un ref y llamarlos desde un efecto o directamente en el handler) para que el updater sea puro.

### 169. [P2] (ingenieria) El aviso «Sin señal por +15s — verifica el micrófono» nunca se apaga: el bucle RAF captura `silencioProlongado` congelado en false
- `src/hooks/useGrabacionAudio.ts:556` · Ingeniero de software senior (React/Next)
- Impacto: El médico ve una alerta falsa y persistente de fallo de micrófono durante toda una consulta que se está grabando correctamente. Es exactamente la señal que usaría para abortar y repetir la grabación, o para desconfiar del dictado; degrada la confianza en el único indicador de captura que tiene.
- Arreglo: No leer el estado dentro del bucle RAF: usar un ref espejo (`silencioRef`) actualizado junto al `setSilencioProlongado`, o simplemente llamar siempre `setSilencioProlongado(false)` cuando `rms > NIVEL_SILENCIO` (React descarta el render si el valor no cambia). Quitar `silencioProlongado` de las deps de `iniciar` y replicar la misma detección en el `tick` de `reanudar`.

### 170. [P2] (ingenieria) El fallback local inventa la vía «oral» para todos los medicamentos y la severidad «moderada» para todas las alergias
- `src/lib/expediente/parser-clinico.ts:465` · Ingeniero de IA
- Impacto: Se fabrican dos datos clínicos en el peor momento posible: cuando la IA ya falló y el médico está confiando en un texto de respaldo. Una vía de administración incorrecta impresa en una receta es un error accionable por quien la surta o la administre, y degradar una reacción anafiláctica a «moderada» apaga los realces de alergia grave. Contradice ad
- Arreglo: En parser-clinico.ts dejar `via: ''` y `severidad: 'desconocida'` (y no forzar `tipo: 'medicamento'` para alérgenos que pueden ser alimentos o ambientales), añadiendo esos campos a `safety.fields_requiring_review` para que el médico los complete; y cambiar los esqueletos de prompts.ts:392-393 y :510 a `"via": ""` / `"severidad": "desconocida"` para no sembrarle al modelo un valor plausible por def

### 171. [P2] (ingenieria) Indicadores hospitalarios descarga todos los episodios completos (con MAR, balance y escalas) para calcular 4 KPIs
- `src/lib/hospital/firestore.ts:91` · Ingeniero de performance
- Impacto: La pantalla tarda cada vez más conforme el hospital acumula historia y transfiere megabytes de PHI al navegador que nunca se muestran; el coste crece de forma indefinida porque no hay ninguna cota.
- Arreglo: Acotar por periodo (p. ej. where('fechaIngreso','>=', inicio del rango que se muestre) con un selector de rango en la pantalla) y/o mantener un documento agregado de indicadores que el gateway /api/hospital/mutar actualice al ingresar/egresar, en vez de recalcular leyendo todo el histórico en el cliente.

### 172. [P2] (ingenieria) El rastreo de errores dice "Sin PII" pero manda a una colección global la ruta con el patientId y el correo del médico
- `src/lib/reportar-error.ts:25` · Auditor de seguridad y PHI
- Impacto: Trazas identificables de pacientes salen del inquilino hacia un almacén global del operador de la plataforma, contradiciendo la propia documentación del módulo y sin quedar registradas en la bitácora NOM-024 de la clínica. No es una filtración a un tercero externo, pero sí un flujo de PHI no declarado que rompe el modelo de aislamiento por consulto
- Arreglo: Redactar la ruta antes de enviarla: sustituir los segmentos de identificador por marcadores, p. ej. '/consulta/[id]' (una función pura y testeable que colapse todo segmento tras expediente|consulta|receta|orden|referencia|hospitalizacion). Quitar `email` del documento (el uid ya basta para correlacionar si hace falta) o guardarlo con hash. Recortar y filtrar `stack` para no arrastrar contenido de 

### 173. [P3] (diseno) La consulta muestra las alergias dos veces en la misma pantalla, contradiciendo la regla que el expediente ya aplicó
- `src/app/(dashboard)/consulta/[patientId]/page.tsx:1940` · Director de diseno - app interna
- Impacto: Dos marcas rojas para el mismo dato no duplican la atención, la reparten: el ojo aprende a descartar «lo rojo de arriba» de esta pantalla. Además consumen unos 110px de la primera pantalla en un formulario que ya es larguísimo, y la píldora usa un rojo distinto (#dc2626) al del banner (#f87171), de modo que la misma alerta se ve de dos colores segú
- Arreglo: Conservar únicamente el banner superior, que es el que además permite editar (fue una petición explícita), y eliminar el bloque de la píldora en las líneas 1940-1955. Si se quiere mantener una referencia en el encabezado al hacer scroll, la vía correcta es hacer sticky el banner existente, no clonarlo.

### 174. [P3] (diseno) La barra superior móvil está cableada a «Agenda Médica»: ni la marca, ni el consultorio, ni la pantalla actual
- `src/app/(dashboard)/layout.tsx:388` · Auditor de coherencia UX
- Impacto: Rompe la identidad del producto justo en el dispositivo donde más se le enseña a colegas y pacientes, y elimina el indicador de ubicación en la superficie con menos espacio, que es donde más falta hace. También contradice la personalización que el médico ya configuró (nombreClinica) y que sí se respeta en escritorio.
- Arreglo: Reemplazar el literal por el título de la pantalla actual, resuelto desde el mismo mapa de rótulos propuesto en el hallazgo de nomenclatura (`RUTAS[pathname]?.titulo`), con `config.nombreClinica || 'NexusMED'` como respaldo cuando la ruta no esté en el mapa (p.ej. rutas con parámetros). Concretamente: sacar el `<span>` a un pequeño componente cliente `TituloMovil` que use `usePathname()` + `useCon

### 175. [P3] (diseno) Las seis casillas de cada medicamento no tienen etiqueta: en cuanto se llenan, se pierde qué es cada campo
- `src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx:733` · Director de diseno - app interna
- Impacto: Al revisar o corregir una receta ya capturada, editar la caja equivocada es fácil, y la vista previa está a un lado pero exige comparar. En un documento que se firma y se entrega al paciente, el editor debería dejar cero ambigüedad sobre qué campo se está tocando. También bloquea por completo el uso con lector de pantalla.
- Arreglo: Añadir la etiqueta de campo de 10.5px sobre cada control, siguiendo el mismo labelStyle reducido que ya usa el bloque de función renal (líneas 532 y 537): Medicamento · Dosis · Vía · Frecuencia · Duración · Indicación. Como mínimo indispensable, poner aria-label en los seis inputs. La rejilla actual absorbe la etiqueta sin cambiar de altura si se usa el tamaño reducido.

### 176. [P3] (diseno) /paquetes es un callejón sin salida: sus únicos CTA regresan a otras dos páginas secundarias, sin ruta a inicio, precios ni registro
- `src/app/paquetes/page.tsx:82` · Director de diseno - sitio publico
- Impacto: /paquetes es una de las páginas de mayor intención — el subespecialista comprobando que la herramienta habla su idioma — y termina sin ninguna llamada a la acción comercial. El interés generado se disipa en un bucle entre dos páginas informativas.
- Arreglo: Añadir al bloque de CTA final de paquetes/page.tsx un botón primario a /registro ('Comenzar prueba gratis') y uno secundario a /precios, y renombrar el enlace superior para que no duplique al inferior. Esto queda resuelto de raíz con el layout público compartido (barra + footer) propuesto en el hallazgo de /precios; el CTA de conversión al cierre de la página conviene igual.

### 177. [P3] (diseno) Tres acentos de marca distintos entre páginas públicas, y el verde-azulado de /precios no cumple AA en tema claro
- `src/app/precios/page.tsx:42` · Director de diseno - sitio publico
- Impacto: El precio anual es el argumento de mayor margen de la página (compromiso a 12 meses) y es justo lo que menos se lee. Y el acento cambiante entre portada y precios lee como un sitio ensamblado por partes, exactamente en el paso donde el médico decide si el producto está bien hecho.
- Arreglo: Reemplazar los dos #14b8a6 de precios/page.tsx por var(--nexus) y quitar los fallbacks #0d9488 de arquitectura/page.tsx y operacion/page.tsx (dejando var(--teal), que ya resuelve a cobalto en ambos temas). Si se quiere un segundo color para señales de ahorro/éxito, definirlo como token en globals.css con un valor validado a 4.5:1 sobre --s1 en los dos temas, no en hex suelto dentro de una página.

### 178. [P3] (ingenieria) El Sidebar se monta dos veces siempre → listeners de chat y de config duplicados en todas las pantallas
- `src/app/(dashboard)/layout.tsx:337` · Ingeniero de performance
- Impacto: Duplica de forma permanente el tráfico en vivo del chat y de la configuración por usuario y por pantalla, y duplica el trabajo de render del menú en cada mensaje. Es coste constante que paga el 100% de las sesiones.
- Arreglo: Extraer el badge de no-leídos a un contexto/hook único montado una sola vez en el layout (o a un provider) y que ambas instancias del Sidebar lo consuman; alternativamente, montar el sidebar móvil solo cuando sidebarOpen es true, o unificar en una sola instancia posicionada por CSS.
---

## Estado de reparación — corrida "arregla todo" (2026-07-24, v589–v591)

Lotes de ingeniería/diseño/accesibilidad desplegados tras cerrar la parte
clínica e infecto (v568–v588). Todos con typecheck limpio y 1507 tests.

**v589 — ingeniería 3 (4× P1 seguridad/pérdida de datos):**
- Segunda opinión (verificar-nota) falsamente "sin observaciones" cuando el 2º
  modelo no devolvía JSON parseable → ahora `{ok:false, incompleto:true}` + toast
  de error en el cliente (no pinta el verde de "revisado y limpio").
- Cross-check de alergias no recibía las del EXPEDIENTE (solo las dictadas) →
  el cliente ahora envía `patient.alergias` y `buildNerUserPrompt` las incrusta.
- `descartar()` borraba el respaldo del episodio equivocado (respaldoKey fuera de
  las deps) → declarado arriba (evita TDZ) + deps completas.
- Editar una cita cuya hora ya pasó bloqueaba el guardado (el modal limpiaba la
  hora) → la hora original es siempre seleccionable y no se borra.

**v590 — diseño/accesibilidad (4× P1):**
- Alergias invisibles en la ficha de hospitalización → banner rojo persistente
  con `role="alert"` (ámbar "sin registro" si no hay; no asume "sin alergias").
- Dark mode roto en /arquitectura y /operacion (var(--panel/--panel2) inexistentes
  → fallback claro) → alias temáticos a --s1/--s2 en globals.css.
- Título de alerta de alergia ilegible en modo oscuro (receta) → tokens de badge
  rojo por tema (AA en ambos).
- Toasts sin `aria-live` → región viva `polite` (alert en errores); diálogo de
  confirmación con aria-labelledby/aria-describedby.

**v591 — diseño/accesibilidad 2 (P1 + a11y):**
- Calendario sin estado de cita (semana/día coloreaban solo por médico) → estilo
  por estado: cancelada/no-asistió tenue+tachada, tentativas punteadas; la vista
  Día muestra StatusBadge explícito.
- Modal genérico (ui/Modal) sin role="dialog"/aria-modal/aria-labelledby → agregados.

### Pendientes que requieren DECISIÓN del Dr o son barridos mayores
- Barrido de 224/226 labels de formulario (etiquetas/aria-label) — pasada
  dedicada; hallazgos #175 y afines.
- Navegación por teclado con flechas en la rejilla del calendario (los controles
  ya son <button> accesibles; la nav tipo grid es una mejora mayor).
- `AvisoPrivacidadModal` sin montar — falta que el Dr decida DÓNDE colocarlo.
- Diferidos clínicos/negocio: monto de anticipo Stripe (modelo de precios), CMI
  censurada ">X" en antibiograma (cambio de esquema + decisión clínica), reporte
  selectivo Salmonella/Shigella, breakpoints meníngeos, vanco en estafilococo
  coag-negativo (validación del Dr).
