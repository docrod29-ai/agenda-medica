/**
 * LAS FAMILIAS DE DEFECTO — de qué se enferma este sistema.
 *
 * ── DE DÓNDE SALE ────────────────────────────────────────────────────────────
 *
 * `docs/audit/regression-ledger.md` tiene 67 defectos con su causa raíz. Leídos
 * de uno en uno son 67 historias. Contados por familia dicen algo que ninguno
 * dice solo: **cuál es la forma de fallar que se repite**.
 *
 * Esto no es una taxonomía tomada de un libro. Cada familia salió de agrupar
 * los defectos que este sistema realmente tuvo, y se queda o se va según lo que
 * el ledger siga diciendo.
 *
 * ── POR QUÉ ES CÓDIGO Y NO UNA TABLA EN UN MARKDOWN ──────────────────────────
 *
 * Porque una tabla escrita a mano envejece en silencio: el REG-220 aterriza, la
 * tabla sigue diciendo 67 cuando ya son 68, y nadie se entera. Aquí el guardián compara este
 * archivo contra el ledger y **falla si un REG no está clasificado** — lo que
 * obliga a clasificarlo, que es justo el momento en que uno se pregunta «¿y de
 * qué familia es éste?».
 */

export interface FamiliaDeDefecto {
  /** Clave estable; se usa en las pruebas y no debería cambiar. */
  clave: string
  /** Cómo se llama en voz alta, en la lengua en que se habla del problema. */
  nombre: string
  /** Qué tienen en común, dicho de forma que sirva para reconocer el siguiente. */
  patron: string
  /** Los REG del ledger que pertenecen a esta familia. */
  regs: readonly number[]
}

export const FAMILIAS: readonly FamiliaDeDefecto[] = [
  {
    clave: 'no_conectado',
    nombre: 'Escrito, probado y sin conectar',
    patron:
      'El módulo existe, tiene pruebas y está bien. Simplemente NO CORRE en el ' +
      'camino que el médico recorre — o corre con una entrada incompleta. Las ' +
      'pruebas del módulo pasan; el sistema falla.',
    /**
     * 335 es esta familia describiendo su propia forma. `PaqueteDeVisita`, su
     * máquina de estados, su compuerta, la acción del portal, las reglas, la
     * matriz, el respaldo y la exportación ARCO: todo escrito, todo probado, y
     * ningún camino del producto escribía jamás un documento en esa colección.
     * No faltaba una pantalla — faltaba el ACTO que la llena.
     */
    /**
     * 337 es la variante que SOBREVIVE a su propia reparación. REG-252 ya había
     * cerrado esta misma fuga —`tareaDeResultado` escrita, probada y sin
     * llamar— conectándola en el escritor hospitalario. El escritor ambulatorio
     * es otro, y se quedó fuera. La función TENÍA llamador, así que ningún
     * guardián de módulos huérfanos podía verla: el defecto no era que no
     * corriera, sino que no corría en TODOS los caminos por los que entra el
     * dato.
     */
    /**
     * 345 es esta familia aplicada a la HONESTIDAD. Los avisos que dicen qué se
     * consultó y qué no —«UpToDate: no se consultó»— se calculaban, se probaban,
     * viajaban por el cable y la pantalla los tipaba… sin pintarlos nunca. No
     * faltaba el dato ni la regla: faltaba el último centímetro. Un consultor
     * que sólo enseña lo que SÍ encontró se lee como si hubiera mirado en todas
     * partes, que es la conclusión contraria a la que el módulo existía para dar.
     */
    /**
     * 346 es esta familia aplicada a una DEFENSA, que es su forma más
     * incómoda. `fetchConTimeout` existe, está probado, tiene presupuestos por
     * destino y limpia el temporizador en `finally` — y se usa en tres
     * archivos. Trece llamadas a proveedor lo esquivaban sin ningún tope
     * propio, entre ellas las de la ruta de 800 segundos. Un módulo de
     * seguridad que no cubre el camino que más lo necesita da la confianza sin
     * dar la protección.
     */
    /**
     * 348 es esta familia en su forma más literal: «el dato tiene que LLEGAR».
     * REG-343 metió tres colecciones en el respaldo y el exportador se las
     * llevaba de verdad — salían en el archivo, con su prueba. El importador
     * las rechazaba TODAS por «ruta con forma inesperada», porque su guarda
     * estaba escrita para el árbol y una ruta de dos segmentos no lo es.
     *
     * Un respaldo tiene dos mitades y sólo se movió una: el manifiesto decía
     * QUÉ llevarse, pero la FORMA de la ruta estaba codificada aparte en cada
     * mitad. El consultorio restaurado seguía quedándose sin miembros —el
     * defecto de REG-343, una casilla más adelante— y el informe se veía sano.
     */
    /**
     * 361 es la única entrada de esta familia que se cerró ANTES de que el
     * defecto ocurriera. REG-360 creó los campos del cierre y declaró en su
     * propio «qué no cubre» que ninguna pantalla los llenaba; la unidad
     * siguiente los conectó, en vez de dejarlo para cuando alguien descubriera
     * que el dato nunca llegó.
     *
     * Vale la pena anotarlo: esta familia se puede cerrar por adelantado si
     * quien abre el hueco lo declara y quien sigue lo lee.
     */
    /**
     * 381 es esta familia en el INSTRUMENTO que la vigila. El ensayo de respaldo
     * leía el NDJSON, lo reenraizaba y cronometraba — todo en memoria, sin
     * escribir en ninguna parte. REG-160 ya había enseñado que ahí es donde este
     * producto falla: el importador validaba la colección declarada y escribía en
     * la ruta, con las pruebas en memoria en verde.
     *
     * Y el ensayo NUEVO cometió el mismo pecado en su primera versión: construía
     * las líneas con un formato que `leerLinea` rechazaba entero, y salía en verde
     * porque comparaba cero contra cero. Un ensayo de restauración que restaura un
     * consultorio vacío y se declara con éxito.
     *
     * Su lección: un instrumento de medición necesita su propia prueba de que
     * midió algo. «Coincidió» no es «coincidió con algo».
     */
    /**
     * 383 es esta familia en su forma más medible: el invariante central de la
     * escala —«para enseñar 20 pacientes no se descargan 50 000»— estaba escrito
     * en el tablero, reparado en el código y **nunca medido**. Las pruebas
     * comprobaban que el código DIJERA `limit()`; ninguna miró qué traía de vuelta
     * una consulta con el consultorio lleno.
     *
     * Su lección es el gemelo de «el dato tiene que LLEGAR»: hay reparaciones cuyo
     * éxito es que el dato NO llegue, y ésas se prueban contando lo que cruza el
     * cable, no leyendo el código que lo pide.
     */
    /**
     * 380 es esta familia aplicada a la EVIDENCIA de una reparación. REG-342 y
     * REG-355 arreglaron el rebote de iPhone de verdad, y lo probaron entero
     * LEYENDO el árbol: ninguna de las dos abrió nunca el producto en un
     * navegador a tamaño de teléfono, que es lo que la regla de diseño exige con
     * todas las letras. El arreglo estaba conectado; la comprobación no.
     *
     * Su lección: «probado» y «probado donde ocurre» no son lo mismo, y la
     * distancia entre las dos es exactamente esta familia. Lo nuevo mide
     * desbordamiento, objetivo táctil, consola y foco — y declara que el rebote
     * sigue sin probarse, porque es de WebKit y ahí no corre.
     */
    /**
     * 359 enseña la variante más cara de esta familia: el módulo estaba escrito
     * y su encabezado AFIRMABA que enchufarlo sería gratis («no exige cambiarle
     * el prompt»). Era falso —el verificador necesita el pasaje literal y el
     * prompt no lo pedía— y esa creencia equivocada es exactamente la razón de
     * que llevara meses sin enchufar: nadie descubría el trabajo real hasta
     * intentarlo.
     *
     * Lección: «listo para conectar» es una afirmación que hay que PROBAR
     * conectándolo, no una nota en un comentario.
     */
    /**
     * 356 es 345 otra vez, en la ruta de al lado. Los avisos de «qué se consultó
     * y qué no» se arreglaron en `/api/consultor-evidencia` y la ruta de
     * evidencia de la CONSULTA —la que se usa con el paciente enfrente— se quedó
     * sin cablear. La lección: un arreglo de esta familia no termina en el
     * módulo que se tocó, termina cuando se revisan TODAS las puertas por las
     * que entra el mismo dato. Es la misma forma de 337 sobre 252.
     */
    /**
     * 353 es la variante temporal de esta familia: la defensa EXISTÍA y cubría
     * el caso equivocado. `fetchConTimeout` acota UNA llamada; el fallo de un
     * proveedor dura una temporada, así que las mil siguientes volvían a pagar
     * el timeout entero. Una protección pensada por llamada no protege de un
     * problema que es por temporada.
     */
    /**
     * 363 es esta familia con el dato ya ESCRITO, SELLADO y probado, y ningún
     * lector. Cada nota firmada guarda una copia de las alergias del paciente;
     * los veintitantos llamadores del cruce alergia↔fármaco, la receta impresa,
     * el FHIR y el sesgo de voz leen todos el MISMO campo mutable de `Patient`,
     * que la última escritura pisa entera. Vaciado ese campo, el producto se
     * comportaba como si dos notas inmutables que dicen «anafilaxia por
     * penicilina» no existieran.
     *
     * Su lección propia: el repositorio ya había construido la CONSTANCIA del
     * borrado (`logAudit({ vaciado: true })`, REG-323) y no la RECUPERACIÓN.
     * Dejar el dato en una bitácora de auditoría no es conectarlo: nadie lee
     * una bitácora con el paciente enfrente.
     */
    /**
     * 366 es la variante TEMPORAL de esta familia, y no la había: el módulo
     * corre, corre en el camino del médico, y su resultado **no sobrevive al
     * acto que lo hace importante**. Los motores de negación, temporalidad,
     * experienciador y certeza producían avisos que el médico confirmaba haber
     * revisado, y la firma los tiraba. «Creo que me dijeron que tenía anemia»
     * quedaba en el expediente como «Anemia», y la duda duraba lo que duraba la
     * sesión del navegador.
     *
     * Su lección: «conectado» no es sólo «se ejecuta». Un dato que se calcula,
     * se enseña y no se guarda está tan desconectado como uno que nunca corrió,
     * sólo que además parece que funciona.
     */
    /**
     * 367 es el par de 366, y sale de haberlo declarado. 366 guardó el aviso y
     * escribió en su «qué no cubre» que ninguna consulta posterior lo leía;
     * 367 es ese lector. Guardar un dato que sólo se ve abriendo el documento
     * donde se guardó es media reparación.
     *
     * Su lección: un «qué no cubre» honesto es una lista de trabajo, no una
     * excusa. Cerrarlo en la unidad siguiente es lo que impide que se convierta
     * en el defecto de dentro de seis meses.
     */
    /**
     * 368 es esta familia en su forma MÁS DIFÍCIL DE VER: el dato estaba en la
     * misma pantalla. Los paneles de laboratorio del paciente se pintan en la
     * pestaña de Laboratorios de la consulta, con la creatinina a la vista, y el
     * motor que produce el ajuste renal no los recibía — recibía sólo lo dictado
     * hoy. Es REG-188 (la medicación) en el eje que aquella reparación no tocó.
     *
     * Su lección: mirando la interfaz este hueco es INVISIBLE. El médico ve el
     * número y ve que no hay aviso, y lo razonable es concluir que no hace
     * falta. Sólo se encuentra preguntando quién LEE el dato, no quién lo pinta.
     */
    /**
     * 369 es el par de 368, y la misma pregunta un paso más allá: el cálculo de
     * la TRAYECTORIA existía (`seriesDesdeHistorial`) y su único lector estaba
     * a una pestaña de distancia del momento en que sirve. Creatinina 0.9 → 1.3
     * → 1.7 no dispara nada por punto y es un deterioro renal.
     *
     * Su lección: «conectado» tampoco es «está en la misma pantalla». Un dato
     * que obliga a salir de donde se decide, con el paciente enfrente, no está
     * llegando.
     */
    /**
     * 370 es esta familia con el productor y el pintor conectados y **ningún
     * destino**: el extractor reconoce procedimientos con fecha y lateralidad,
     * el panel los enseña, y no hay campo en la nota, ni sello, ni proyección.
     * «Le hicieron una colecistectomía en 2019» se veía una vez y desaparecía.
     *
     * Su lección: que un dato se PINTE no prueba que se guarde. Las dos mitades
     * —quién lo enseña y dónde queda— se comprueban por separado, porque una
     * pantalla que lo muestra hace creer que el sistema lo sabe.
     */
    /**
     * 371 es el espejo de 370 y de 368: aquí el dato SÍ se guarda —los
     * dispositivos invasivos viven en el expediente— y su único lector es el
     * texto de la propia valoración que los capturó. Nadie sabía, fuera de esa
     * pestaña, que el paciente lleva una prótesis valvular.
     *
     * Su lección: un módulo que se lee a sí mismo parece conectado. Que un dato
     * tenga lector no basta; hay que preguntar si lo lee alguien MÁS que quien
     * lo escribió.
     */
    /**
     * 375 y 376 son los dos `NEEDS_CLINICAL_REVIEW` que 368 y 369 dejaron
     * abiertos, resueltos por el dueño y CONECTADOS. Pertenecen a esta familia
     * porque hasta que se conectaron, los umbrales que sí existían —el rango de
     * referencia de cada analito, los valores de pánico de `lab-criticos`— no
     * los leía nadie desde la trayectoria; y la vigencia de la creatinina no la
     * miraba nada antes de emitir una recomendación de dosificación renal.
     *
     * Su lección: un `NEEDS_CLINICAL_REVIEW` bien escrito no sólo pide una
     * decisión — deja el enchufe puesto. Cuando la decisión llegó, lo único que
     * hubo que hacer fue conectarla, y las dos unidades cupieron en un módulo
     * puro cada una porque el hueco estaba declarado en su sitio exacto.
     */
    /**
     * 396 es esta familia en la pieza cuyo propósito literal era que alguien se
     * enterara. `incidentes-servidor.ts` nació de «la IA de la plataforma estuvo
     * caída y nadie se enteró hasta que la probé a mano»; anotaba la incidencia
     * en Firestore y ahí se quedaba. Para verla había que abrir el tablero — o
     * sea, sospechar la avería antes de enterarse de ella. El canal de alerta ya
     * existía y el vigilante ya gritaba, pero por otras dos cosas.
     */
    /**
     * 398 es esta familia en su variante más silenciosa: el dato no es que no
     * corra — es que se CALCULA y se tira, en la misma función que lo averiguó.
     * `textoCompletoPMC` resolvía el PMCID y leía la licencia (dos peticiones) y
     * devolvía sólo el texto; `pubmed.ts` leía las dos formas del nombre de la
     * revista y se quedaba con una; y el DOI llegaba a la pantalla pero no al
     * `Source`, así que el modelo y la vista sabían cosas distintas.
     */
    /**
     * 400 repite la forma de 398 dos unidades después, y eso es lo interesante:
     * PubMed ESCRIBE la sección del resumen en el XML
     * (`<AbstractText Label="BACKGROUND">`) y la expresión que lo extraía se
     * comía el atributo. Sin ella, una cita de los antecedentes —lo que se creía
     * ANTES de hacer el estudio, a veces justo lo que vino a refutar— se lee
     * igual que una conclusión, con su número de cita al lado.
     */
    /**
     * 401 es esta familia con la defensa puesta en el borde EQUIVOCADO.
     * `desde-pubmed.ts` sabía que la etiqueta de diseño colapsa —«ECA» también
     * capturaba `clinical trial` a secas, que puede no ser aleatorizado— y se
     * negaba a traducirla al modelo de evidencia, con su caso y todo. Pero la
     * etiqueta se lee en otros dos sitios que no pasan por ese borde: el prompt
     * del consultor y la pantalla del médico. Se había decidido que el dato no
     * era de fiar y se seguía entregando a quien decide con él.
     */
    /**
     * 404 es esta familia en la otra punta del ciclo. REG-501 cerró que el
     * resultado EXISTIERA contara como que alguien lo había leído; aquí, que la
     * CITA exista contaba como que el paciente vino: «Agendar el seguimiento» se
     * cerraba al crear la cita, así que un no-show no reabría nada y nadie lo
     * echaba en falta. El calendario estaba conectado y nadie le preguntaba.
     */
    /**
     * 405 es esta familia con el arreglo anterior a UN PASO de distancia.
     * `listarNotasCompat` borró la puerta que devolvía «un array pelado» porque
     * con un historial clínico el silencio se lee como «no tiene» — y las dos
     * proyecciones que consumen esas notas volvían a ser esa misma puerta. Las
     * pantallas tenían `truncada` en la mano y no tenían dónde ponerlo, así que
     * la medicación vigente se calculaba sobre una ventana y se enseñaba como el
     * expediente entero.
     */
    /**
     * 410 es esta familia sobre una REPARACIÓN ANTERIOR: REG-188 llevó el cuadro
     * completo a cuatro consumidores y no al quinto —la barra de avisos—, que
     * era justo el que enseñaba el aviso. Su propio ejemplo, warfarina de marzo
     * más ketorolaco de hoy, seguía sin disparar donde el médico mira antes de
     * firmar. Y no fallaba: la barra salía en verde.
     */
    /**
     * 407 es esta familia sobre una DISTINCIÓN, no sobre un dato. REG-372 dejó
     * el modelo completo —`tipo` y `tipoOrigen`, con «medico» documentado como
     * «lo único que autoriza a decir confirmado»— y ninguna pantalla dejaba
     * elegirlo. El sistema sabía distinguir un presuntivo elegido de uno de
     * fábrica y no daba forma de ejercer la distinción: la fila del diagnóstico
     * enseñaba descripción, código y borrar.
     */

    /**
     * 425, 426 y 427 son los tres que salieron de ABRIR EL PRODUCTO en un
     * teléfono, y los tres son esta familia en formas distintas:
     *
     *  · **425** — el gancho escrito y la regla no: `<span className=
     *    "nx-fila-porque">` con esa clase inexistente en toda la hoja. El
     *    control se veía perfecto y su toque se lo quedaba el velo de la fila.
     *    Lo caro de esta forma es que en el diff **parece que hay algo**: el
     *    nombre está ahí.
     *  · **426** — el respaldo que no cabe donde está escrito. `100vh` en un
     *    estilo EN LÍNEA no puede llevar su `100dvh` detrás; la hoja lo hace
     *    bien en todas partes y un atributo `style` no puede.
     *  · **427** — la CONDICIÓN PREVIA que falta. 28 usos de
     *    `env(safe-area-inset-*)` corriendo y valiendo cero, porque
     *    `viewport-fit=cover` es una línea en otro archivo que nadie vigilaba.
     *    No es que el módulo no corra: corre y no hace nada.
     *
     * Lo que enseñan juntos: esta familia no se caza leyendo el diff de quien la
     * comete —los tres diffs se ven bien— sino abriendo el producto y
     * preguntándole al navegador. `document.elementFromPoint` en el centro del
     * control es la única pregunta que responde «¿esto recibe el toque?».
     */

    /**
     * 431 es esta familia sobre un archivo que NO es código, y por eso escuece:
     * `firestore.indexes.json` estaba bien escrito y era el archivo MEJOR
     * VIGILADO del repositorio —REG-421 le puso guardián, REG-422 lo endureció—
     * y `firebase.json` nunca declaró dónde estaba. Dos regresiones de trabajo
     * sobre su contenido, y el contenido no lo leía nadie.
     *
     * El despliegue no fallaba: `--only firestore:indexes` sin declarar no
     * publica nada y devuelve `success`. Escrito, probado, y sin conectar — con
     * un acta firmada diciendo que sí.
     *
     * Se descubrió acompañando al dueño a hacerlo a mano, y viendo la consola
     * vacía en su pantalla.
     */
    regs: [154, 160, 164, 167, 169, 170, 182, 188, 198, 218, 221, 222, 225, 230, 232, 236, 238, 239, 244, 249, 252, 256, 257, 258, 259, 261, 262, 264, 266, 268, 288, 290, 296, 303, 309, 315, 316, 318, 320, 324, 325, 335, 339, 345, 346, 348, 353, 356, 359, 361, 363, 366, 367, 368, 369, 370, 371, 375, 376, 380, 381, 383, 384, 387, 388, 396, 398, 400, 401, 404, 405, 407, 410, 501, 425, 426, 427, 431],
  },
  {
    clave: 'se_contradice',
    nombre: 'El sistema se contradice a sí mismo',
    patron:
      'Dos partes afirman cosas incompatibles y ninguna está mal por su cuenta: ' +
      'dos reglas del prompt, dos versiones del mismo dato, un metadato que ya ' +
      'no describe lo que describe. El fallo vive en el HUECO entre las dos.',
    /**
     * 321 y 322 entran aquí y no en `sin_medir` a propósito. Es cierto que
     * los destapó un instrumento nuevo —la matriz de coherencia—, pero el
     * defecto NO era la falta del instrumento: era que dos partes del producto
     * afirmaban cosas incompatibles y ninguna estaba mal por su cuenta. El
     * expediente dice que el sujeto es el paciente; la receta decía que era la
     * herramienta. El rótulo prometía «Ir a Consulta»; el destino era la lista
     * de pacientes. El fallo vivía en el hueco entre las dos, que es
     * exactamente el patrón de esta familia.
     */
    /**
     * 417 entra aquí y no en `perdida`: la nota firmada todavía no se había
     * perdido en ninguna parte. Lo que había eran dos partes del producto
     * afirmando cosas incompatibles — `restaurar.ts` documenta en su cabecera
     * que el SDK admin ignora las reglas de Firestore y deriva la colección de
     * la ruta precisamente por eso, mientras la ruta que lo consume escribía
     * con `merge: true` sin comparar nada. El fallo vivía en el hueco entre las
     * dos, y ninguna estaba mal por su cuenta.
     */
     /**
     * 336 es esta familia en su forma más cara: la compuerta que deja FIRMAR
     * pide `medicoId` y cédula; la que deja ENTREGAR pide nombre y cédula.
     * Ninguna de las dos está mal por su cuenta. En el hueco cabía una nota
     * firmable e inentregable — y con `nota.firma` inmutable, irreparable.
     */
    /**
     * 364 es esta familia con TRES lectores en lo cierto y uno en falso, y el
     * falso es el que más consecuencias tiene. `estaVigente` excluye lo
     * descartado; `ResumenPaciente` lo excluye; la exportación FHIR lo mapea a
     * `provisional`. El cuadro que alimenta al copiloto y al prompt de
     * evidencia lo dejaba pasar y encima tiraba el `tipo`, así que un «embarazo
     * descartado» hacía que el motor escribiera «La paciente cursa embarazo» en
     * un texto que se inserta en la nota firmada.
     *
     * La lección: un criterio exportado y probado no protege a quien no lo
     * llama. El defecto no estaba en la regla — estaba en el lector que se
     * escribió su propia versión implícita («todo lo que tenga descripción»).
     */
    /**
     * 372 es 364 y 365 llevados a su destino final: `tipo` acaba siendo un
     * `verificationStatus` de FHIR que otro sistema lee como un hecho. La
     * pantalla ya había dejado de tratar un `presuntivo` por omisión como un
     * juicio, y la exportación seguía convirtiendo un `definitivo` DEL MODELO en
     * `confirmed`. En el mismo ternario, un descarte salía como «provisional» y
     * una enfermedad crónica como **resuelta**.
     *
     * Su lección: la contradicción no se acaba de arreglar hasta que se recorre
     * el dato hasta donde SALE del producto. Una pantalla honesta y una
     * exportación que afirma lo contrario son el mismo defecto, y la segunda es
     * la que viaja a un sistema que ya no controlamos.
     */
    /**
     * 373 es esta familia con una regla CORRECTA aplicada a una fuente para la
     * que no se escribió. «Ausencia de `estado` = activa» protege el histórico y
     * está bien razonada; el extractor nunca pone `estado`, así que «le dieron
     * warfarina cuando la operaron» entraba a la medicación vigente y disparaba
     * la regla de sangrado sobre un fármaco dejado hace años.
     *
     * Su lección: una regla se contradice a sí misma en cuanto aparece una
     * fuente nueva que no existía cuando se escribió. Al añadir un productor de
     * datos hay que releer los supuestos de quien los consume, no sólo el
     * formato.
     */
    /**
     * 374 es el mismo error UN NIVEL MÁS ARRIBA, y lo cometió el arreglo de 373
     * el mismo día: reutilizar un criterio probado FUERA del dominio para el que
     * se escribió. `esFrasePasada` responde «¿esta frase encuadra lo dicho en el
     * pasado?» y sirve para padecimientos; la pregunta del fármaco es «¿dice que
     * ya no lo toma?». Se parecen y no son la misma, y la diferencia es que
     * avisaba sobre todos los antibióticos recién iniciados.
     *
     * Su lección: un criterio que se reutiliza hay que volver a preguntarle por
     * su caso MÁS FRECUENTE en el dominio nuevo, no por el que motivó el
     * arreglo. El caso que motiva siempre pasa; el frecuente es el que enseña a
     * cerrar el aviso.
     */
    /**
     * 377 cierra lo que 199 dejó abierto, y es esta familia en su forma más
     * documentada: el propio módulo del sello tenía escrito que
     * `transcripcionMotor` **le correspondía ir sellado**, y el sello decía
     * «verificada» de una nota en la que ese campo se podía alterar. Las dos
     * partes eran correctas por su cuenta —la lista declaraba la verdad, el
     * hash calculaba bien lo que se le daba— y el defecto vivía en el hueco.
     *
     * Su lección es sobre las deudas con fecha de caducidad puesta: 199 dejó
     * escrito el qué, el porqué y hasta el CUÁNDO («cuando se suba a
     * hashVersion 4»). Eso la hizo barata de cerrar y, a la vez, la dejó
     * abierta casi doscientos REG, porque nada la ponía en rojo. Una deuda
     * declarada no es una deuda vigilada.
     */
    /**
     * 403 es esta familia con las dos partes en desacuerdo siendo **el censo y
     * la arquitectura**. El censo pedía `revisado`/`revisadoPor`/`revisadoEn` en
     * el panel de laboratorio; el módulo de laboratorio tiene escrito, con ese
     * título, que «revisado» vive en la tarea y en ningún otro sitio porque
     * ponerlo en el panel crearía una segunda fuente de verdad. Construir lo que
     * pedía el censo habría sido construir el defecto que el invariante prohíbe.
     *
     * Un censo que manda duplicar la fuente de verdad es tan caro como uno que
     * olvida un hueco: los dos hacen trabajar en la dirección equivocada. El
     * cuarto campo que pedía —`criticoNotificado`— sí faltaba, y era el único
     * que distinguía «lo vi» de «localicé a alguien».
     */

    /**
     * 412 es esta familia con un BOTÓN dentro del hueco. La proyección
     * longitudinal leía los sellos de las notas crudos; `alergiasDe` leía el
     * campo de hoy filtrando negaciones. Ninguna de las dos lecturas está mal
     * por su cuenta —la primera no debe reescribir lo que una nota firmada
     * selló, la segunda no debe tomar «Negadas» por un alérgeno—, y en el hueco
     * cabía un bucle: el aviso ofrecía añadir «Negadas» a la lista, el botón la
     * concatenaba, y como la otra lectura seguía sin verla, el aviso la volvía a
     * ofrecer. El campo de alergias de un paciente acabó diciendo «Negadas,
     * Negadas, Negadas».
     */
    regs: [171, 179, 180, 189, 191, 194, 196, 199, 214, 217, 223, 226, 229, 234, 269, 270, 272, 273, 277, 278, 279, 285, 286, 291, 293, 298, 305, 307, 311, 312, 313, 314, 321, 322, 336, 338, 364, 372, 373, 374, 377, 403, 412, 417],
  },
  {
    clave: 'habla_real',
    nombre: 'El habla real no cabía en el motor',
    patron:
      'El motor lingüístico cubre el español que uno escribiría, no el que se ' +
      'habla en un consultorio mexicano. Se descubre midiendo contra frases ' +
      'reales, nunca leyendo el código.',
    regs: [158, 186, 187, 192, 200, 209, 210, 211, 212, 220, 271, 275, 276, 280, 281, 282, 284, 289],
  },
  {
    clave: 'sin_medir',
    nombre: 'Nadie lo estaba midiendo',
    patron:
      'No es un defecto del producto: es la ausencia del instrumento que lo ' +
      'habría delatado. Cada uno de éstos destapó otros al encenderse.',
    /**
     * 418 es el caso puro de esta familia: el pie del respaldo decía «completo»
     * y NO EXISTÍA el instrumento que lo habría desmentido — ni recuento por
     * colección, ni huella. Al encenderlo destapó los otros tres de la ronda.
     */
     /**
     * 331 es esta familia en su forma más literal: veintitrés defectos de
     * accesibilidad en las pantallas del paciente con la suite entera en
     * verde. No fallaba nada; es que nadie estaba mirando ese eje.
     */
    /**
     * 342 es esta familia con una vuelta de tuerca: NO faltaba el instrumento,
     * faltaba que midiera algo. Había DIEZ pruebas de scroll y las diez eran
     * `readFileSync` + `toContain` — una compara posiciones de caracteres dentro
     * de un archivo, y otra da por aprobado el mecanismo comprobando que la
     * cadena 'IntersectionObserver' aparece, o sea que certifica la presencia de
     * la causa del defecto. Un instrumento que no puede fallar por la razón
     * correcta cuenta como ausencia de instrumento, y encima da confianza.
     */
    /**
     * 362 es esta familia en su forma más pura: la regla EXIGÍA la compuerta,
     * la compuerta no existía, y por tanto nunca falló. La primera vez que se
     * pudo correr encontró un defecto que llevaba meses vivo con la suite en
     * verde: la ingesta accidental sólo se detectaba en tercera persona, así
     * que «me tomé por accidente la medicina de otra persona» —una de las doce
     * preguntas del §0— no escalaba.
     *
     * Lección: una regla escrita que nadie puede ejecutar no protege nada, y
     * además da la sensación contraria — se pasan «todas las compuertas».
     */
    /**
     * 355 es la continuación de 342 y enseña su lección más incómoda: la regla
     * correcta EXISTÍA —`VolverALaFuente` se apartaba en cuanto el médico
     * tocaba la pantalla— y vivía dentro de un componente. Los otros escritores
     * de scroll no la tenían y nada los obligaba. La disciplina no era del
     * sistema, era de un archivo; y lo que no está medido en un sitio común se
     * cumple sólo donde alguien se acordó.
     */
    /**
     * 365 es esta familia aplicada a un VALOR POR DEFECTO. `presuntivo` es lo
     * que el esquema pone cuando nadie eligió, así que enseñarlo afirmaba una
     * duda que el médico no expresó — y en casi todos los renglones, con lo que
     * la etiqueta se volvía ruido. Lo introdujo REG-364 unas horas antes y lo
     * cazó una sola pregunta al revisar el arreglo: «¿y qué valor trae de
     * fábrica este campo?».
     *
     * La lección: un campo con `default` no distingue «se eligió esto» de «no
     * se eligió nada», y todo lo que se construya encima hereda la ambigüedad.
     */
    /**
     * 397 es esta familia con una vuelta de tuerca: el instrumento faltaba
     * porque una reparación anterior lo hizo falta. REG-391 hizo que una caída
     * del proveedor PAUSE la cola en vez de matarla —correcto— y con eso una
     * cola pausada pasó a verse igual que una tarde tranquila: el cron termina
     * `ok`, `enviados: 0`, y nada parece roto.
     *
     * La lección: una defensa que hace que un problema deje de verse tiene que
     * traer consigo la forma de verlo.
     */
    /**
     * 399 es esta familia en su capa más alta: el instrumento existía
     * (`ia/evaluacion.ts` mide exactitud y alucinación) y lo que faltaba era el
     * CONTRATO — qué conjunto, qué métrica, a partir de qué número está bien y
     * qué hace el producto cuando no lo está. Sin umbral con significado, una
     * métrica es decorativa.
     *
     * Y trae la tentación que define esta familia por contraste: rellenar los
     * umbrales dejaría el requisito con aspecto de cerrado. Quince de diecisiete
     * siguen esperando a que un médico fije el número, y eso está escrito fila
     * por fila en vez de disimulado con un 0,95.
     */
    /**
     * 402 es esta familia sobre un dato que CADUCA. Las guías se citan como
     * texto fijo —«KDIGO 2020»— y una cadena no puede decir si esa edición sigue
     * siendo la vigente: el día que salga la siguiente, el motor la sigue
     * citando igual y la pantalla la enseña con el mismo aspecto de referencia
     * comprobada. Faltaba el instrumento que distinga «la actual» de «una
     * superada», y lo único honesto que puede decir hoy es que no lo sabe.
     */
    /**
     * 406 es esta familia escrita ANTES de que el defecto exista: nada persiste
     * una proyección todavía, y REG-405 acababa de quitar el único obstáculo
     * práctico para hacerlo. El instrumento se pone mientras la propiedad se
     * cumple, no después del primer `setDoc`.
     *
     * Y trae su propia lección al revés: el primer intento fue un módulo de
     * `lib/` con la lógica del caché escrita de antemano, y TRES guardianes del
     * repositorio lo rechazaron por «escrito y sin conectar». Tenían razón —
     * escribir la defensa del problema que todavía no existe se parece mucho a
     * escribir el umbral que nadie ha decidido.
     */
    /**
     * 408 es esta familia sobre una CIFRA que se venía diciendo: «100 000
     * usuarios». El arnés medía de verdad desde REG-378, pero sus entradas eran
     * «cuántos clientes abro», así que ninguna corrida era evidencia DE algo:
     * era evidencia de sí misma. Faltaba la función que traduce un tamaño de
     * producto en un experimento — y al escribirla, medir la cota local en vez
     * de suponerla enseñó que el techo no era un número de sesiones sino una
     * meseta de caudal.
     */
    /**
     * 409 es la vuelta de tuerca de 342, en voz: el instrumento existía, medía,
     * y medía lo que no era. Un WER de 0,188 % sobre una consulta de 532
     * palabras con la levotiroxina multiplicada por mil dentro. Y ponderarlo
     * habría sido peor: un peso es una penalización, y una penalización se
     * compensa con volumen.
     */
    /**
     * 413 es esta familia en su forma más barata de arreglar y más cara de
     * ignorar: la comprobación que impide acuñar la firma de otro médico
     * existía, estaba en el servidor y funcionaba — y `grep -rl diseno-url
     * src/__tests__/` no devolvía nada. No faltaba la defensa: faltaba el
     * instrumento que avisa el día que alguien se la lleva por delante, que en
     * una protección de aislamiento entre consultorios es el día que nadie mira.
     */

    /**
     * 414 es esta familia sobre el propio INSTRUMENTO. La suite caía en archivos
     * distintos cada vuelta y el resumen del runner decía «cae este caso» — así
     * que se buscó contaminación entre pruebas, que no existía. Lo que faltaba
     * medir era el log entero: el error nunca fue una aserción, era «Test timed
     * out in 5000ms» dentro de un `await import`. El resumen de un fallo no es
     * el fallo, y creerle costó un diagnóstico equivocado escrito en un PR.
     */

    /**
     * 415 es esta familia con la prueba más incómoda de todas: el instrumento
     * no faltaba por descuido, faltaba porque NO HABÍA CON QUÉ ENCENDERLO. El
     * arnés no había abierto nunca el visor del documento medicolegal, y al ir
     * a abrirlo resultó que la pantalla ni pintaba — el consultorio de prueba no
     * tenía una sola nota que enseñar, y la que se sembró para tenerla reventaba
     * la pantalla entera. Un instrumento que no se puede encender no es un
     * instrumento flojo: es la misma ausencia, mejor disimulada.
     *
     * Y al encenderse destapó otros dos, como dice el patrón de esta familia:
     * la cabecera de cada nota del expediente y el «ya no» que suspende un
     * medicamento en la consulta, mudos los dos. No aparecían porque no había
     * datos que los hicieran aparecer — un cero sobre una lista vacía no dice
     * «está bien», dice «aquí no hay nada».
     */

    /**
     * 421 es el instrumento MINTIENDO, que es peor que no tenerlo. El guardián
     * de índices existía, corría en verde y llevaba meses tapando dos consultas
     * sin índice: se SALTABA con un `continue` las consultas cuya colección no
     * sabía leer, y comparaba que los campos estuvieran en vez de que estuvieran
     * en el orden que Firestore exige.
     *
     * Un guardián que se salta lo que no entiende no dice «no lo sé»: dice «está
     * bien». Por eso el arreglo no fue sólo enseñarle a leer más formas, sino
     * hacer que lo ilegible FALLE. Y se descubrió porque antes de tocar el código
     * que el guardián protege se le probó al revés — que es la única manera de
     * saber si un instrumento mide.
     */

    /**
     * 422 es el DÍA SIGUIENTE de 421, sobre el mismo guardián y por su otra
     * limitación declarada: «sólo ve el SDK de cliente… está declarado aquí y
     * sigue siendo trabajo pendiente, NO un hueco tapado». Era un hueco tapado.
     * Detrás vivía `platform_cost_ledger(feature, ts)`, la consulta con la que se
     * mide el costo por nota — y como su ruta la envuelve en un `try/catch`, el
     * índice que falta no se ve como un error: se ve como que no hay datos de
     * costo, sobre la pantalla con la que se decide el precio.
     *
     * Lo que enseñan 421 y 422 juntos no es que este guardián estuviera mal
     * escrito. Es que **una limitación declarada tiene fecha de caducidad o se
     * convierte en un hueco**: declarar un punto ciego lo hace honesto, no lo
     * hace inofensivo, y a partir del día siguiente el archivo en verde se lee
     * como «todo bien» sin que nadie vuelva al párrafo que decía dónde no miraba.
     * Es lo mismo que REG-377 dijo de las deudas con fecha puesta, dicho de los
     * instrumentos.
     */
    /**
     * 428 es el instrumento que MIDE y cuya salida no distingue. GP-33 dispara
     * cuarenta peticiones en paralelo contra el freno del portal del paciente y
     * contaba sólo los 429 — pero «cero 429» lo producen TRES desenlaces, y dos
     * son correctos: el freno cortó (429), el freno no pudo contar y por eso no
     * dejó pasar (503, fail-closed), o no hubo freno (cuarenta 200). Medido con
     * la distribución puesta: `{200:10, 429:25, 503:5}` — el freno funciona.
     *
     * Su lección propia, que 421 y 422 rozaban desde el otro lado: un caso cuya
     * EVIDENCIA no separa el desenlace bueno del malo falla en la dirección
     * peligrosa. Se pone rojo cuando el producto se porta bien (todo 503), y un
     * caso que da falsos rojos se aprende a ignorar — así que el día que salgan
     * cuarenta 200, nadie lo va a mirar distinto.
     */

    /**
     * 430 es el instrumento que NO PUDO CORRER, y cuya mitad superviviente se
     * lee como si hubiera corrido. La escotilla que permite usar un Chromium ya
     * instalado estaba sólo en el proyecto del teléfono; el proyecto `chromium`
     * —el de la matriz de cabeceras de seguridad— no la tenía, y sus nueve casos
     * de navegador caían con «Executable doesn't exist». Los de cabeceras pasan
     * por petición cruda, así que el verde parcial tapaba justo la mitad que sólo
     * se puede ver ejecutando.
     */

    regs: [159, 166, 168, 185, 197, 213, 235, 237, 240, 245, 246, 247, 248, 254, 255, 260, 263, 265, 267, 274, 299, 306, 308, 331, 342, 355, 362, 365, 397, 399, 402, 406, 408, 409, 413, 414, 415, 418, 421, 422, 428, 430],
  },
  {
    clave: 'hueco_como_dato',
    nombre: 'El hueco tratado como dato',
    patron:
      'Lo que nadie dijo se guarda como si alguien lo hubiera dicho. Es el más ' +
      'peligroso de todos porque el resultado se LEE bien: una vía, una dosis, ' +
      'una negativa, indistinguibles de un dato real.',
    /**
     * 326: «no hay pacientes» se guardaba como «el consultorio está vacío», y
     * el caso en que la señal falla —una supresión ARCO se los llevó— es
     * exactamente el caso en que el error es más grave. Un consultorio vacío y
     * un consultorio suprimido se LEÍAN igual.
     */
     /**
     * 332 y 333 son la misma familia por dos caras distintas, y por eso van
     * juntas y no repartidas por su consecuencia.
     *
     * 332 es su versión de seguridad: «no pude comprobar si este enlace sigue
     * vigente» se guardaba como «sigue vigente». El hueco —la lectura que no
     * respondió— se leía igual que un permiso real; sólo que aquí lo que sale
     * bien formado no es una dosis, es una autorización.
     *
     * 333 entra aquí y NO en `aislamiento`. La fuga —un apellido en el
     * vocabulario del consultorio— es la CONSECUENCIA; la causa es que una
     * lista de nombres vacía se leyó como «este paciente no tiene identidad»
     * en vez de «no sé quién es». El hueco tratado como dato, otra vez.
     */
    /**
     * 344 es la versión de esta familia que nace de decisiones CORRECTAS. No
     * poner `orderBy` era correcto —evitaba un índice compuesto que ya tumbó la
     * pantalla en producción— y no bloquear la firma también. Cada una dejó un
     * hueco, y ninguna lo declaraba: 200 pendientes arbitrarios de N se leían
     * como «esto es todo», y las tareas que no llegaron a escribirse se leían
     * como escritas. El hueco tratado como dato, sin que nadie hiciera nada mal.
     */
    /**
     * 347 es la lección que deja `crece_mal` al repararse: acotar una lectura no
     * es una operación local, **cambia el contrato de todos sus lectores**. Los
     * que trataban «la lista» como el censo completo pasaron a tratar un RECORTE
     * como el censo completo, sin que cambiara una línea de su código — y la
     * pantalla de buscar empezó a decir «no está» de pacientes que sí están.
     * El hueco tratado como dato, creado por el propio arreglo anterior.
     */
    /**
     * 358 es el hueco que 347 dejó DECLARADO al cerrarse, y enseña para qué
     * sirve declararlo: «un duplicado con el orden de los nombres cambiado y sin
     * teléfono en común no aparece» no era una nota de humildad, era el
     * siguiente defecto con su reproducción escrita. El sistema trataba un
     * NOMBRE como una cadena, y un nombre es un conjunto de palabras cuyo orden
     * de captura no garantiza nadie.
     */
    /**
     * 378 es esta familia fuera de la clínica, en la evidencia de operación, y
     * enseña que **un esquema puede obligar a mentir**. El validador de carga
     * exige que los seis bloqueadores incondicionales sean enteros no negativos,
     * así que un arnés que corre donde no puede observar alguno sólo tiene la
     * salida de escribir `0` — y `0` no dice «no lo miré», dice «lo miré y no
     * había ninguno». Un cero por no haber mirado es el hueco tratado como dato
     * con la firma de un instrumento de medición encima.
     *
     * Su lección: cuando un formulario no tiene casilla para «no lo sé», la
     * respuesta que se recibe no es la verdad, es la casilla más barata. El
     * arreglo no fue ablandar el validador sino escribir `null` y dejar que lo
     * rechace: un informe rechazado es información; un cero, no.
     */
    regs: [165, 172, 176, 177, 228, 332, 333, 344, 347, 358, 378, 420],
  },
  {
    clave: 'aislamiento',
    nombre: 'Fuga entre consultorios y dinero',
    patron:
      'Un dato o un cobro que cruza la frontera de su dueño. Poco frecuente y ' +
      'de consecuencia alta: aquí un solo caso es un incidente, no una molestia.',
    /**
     * 325: re-enraizar la ruta ponía el documento en el consultorio correcto y
     * lo dejaba declarando pertenecer al de origen. Un solo caso es un
     * incidente, y por eso el veredicto se detiene en vez de avisar.
     */
     /**
     * 339: la nota clínica entera se escribía en la consola del navegador. El
     * dato cruza la frontera de su dueño igual que en los otros cuatro, sólo que
     * la salida no es otro consultorio: es el equipo, el soporte y la captura de
     * pantalla. Se anota aquí una lección que los demás no traían — contra un
     * cuerpo clínico LIBRE no existe redactor: `safeLog` caza CURP y correos, y
     * «varón de 62 años con angina inestable» no coincide con ningún patrón. La
     * única defensa es no mandarlo.
     */
    /**
     * 349 es la variante que abre una DEFENSA al ponerse. La comprobación de
     * REG-348 —no pisar un `clinic_members/{uid}` que sea de otro consultorio—
     * era la correcta, pero leía con un `getAll` suelto y escribía después, en
     * un lote que se commiteaba mucho más tarde. En ese hueco cabe un alta
     * normal del consultorio vecino, y la restauración se llevaba esa cuenta.
     *
     * Lo que esta familia aprende aquí: **una comprobación de aislamiento que
     * no es atómica con la escritura no es una comprobación, es una foto**. Y
     * no hace falta un atacante — basta con que dos operaciones legítimas
     * coincidan en el tiempo, que es la clase de fuga que ninguna revisión de
     * permisos encuentra porque los permisos estaban bien.
     */
    regs: [153, 161, 162, 163, 224, 349, 419, 503],
  },
  {
    clave: 'charter_vacio',
    nombre: 'El charter existía sin encarnar',
    patron:
      'Una sección del charter que vivía como carpeta vacía. No rompe nada hoy; ' +
      'es la diferencia entre un sistema que dice tener un control y uno que lo ' +
      'tiene.',
    regs: [201, 202, 203, 204, 205, 206, 207, 208, 385, 386],
  },
  {
    clave: 'estorba',
    nombre: 'Estorba al médico',
    patron:
      'Correcto por dentro, insoportable por fuera: avisos que interrumpen, se ' +
      'repiten o tapan la nota. Un aviso que estorba se aprende a ignorar, y ' +
      'entonces deja de proteger.',

    /**
     * 337 estira la familia más allá del aviso, y a propósito. El riel del
     * expediente hacía bien su trabajo —resaltar dónde va la lectura—; lo que
     * era insoportable es lo que ese trabajo le hacía a la pantalla: botaba
     * hacia arriba en cada tramo mientras el médico bajaba. Nada estaba mal por
     * dentro, y la pantalla no se podía usar. El patrón es el mismo que el del
     * aviso que interrumpe: correcto en su intención, intolerable en su efecto.
     */
    regs: [178, 181, 184, 231, 233, 301, 319, 337, 390],
  },
  {
    clave: 'perdida',
    nombre: 'Pérdida de datos',
    patron:
      'Trabajo del médico que desaparece o reaparece solo. Es la categoría de ' +
      'la que menos se perdona: quien lo sufre una vez deja de confiar en todo ' +
      'lo demás.',
    /**
     * 391 es esta familia con el mensaje **fuera** de la pantalla del médico, y
     * por eso costó tanto verla: el outbox contaba con una sola cifra dos hechos
     * distintos —«este teléfono está mal escrito» y «Meta devuelve 503»— y a los
     * cinco intentos mandaba la entrada al dead-letter. Con el cron cada hora,
     * cinco horas de caída del proveedor mataban toda la cola, y la entrada moría
     * diciendo «agotó reintentos», que manda a mirar el mensaje.
     *
     * Tiene además una lección sobre el orden de las reparaciones: el interruptor
     * que se venía a poner, **solo**, lo habría empeorado —al fallar rápido, las
     * cinco horas se vuelven cinco minutos—. La defensa correcta en el sitio
     * equivocado acelera la pérdida.
     *
     * Su otra mitad (el `fetch` sin timeout de openFDA, que REG-346 no alcanzó
     * porque se aplica por convención) es de `depende_de_recordar`; se cuenta
     * aquí porque la pérdida silenciosa es lo que la hace cara.
     */
    /**
     * 392 es esta familia **reincidiendo sobre su propia reparación**, y por eso
     * vale más que las otras: la regla de «¿hay algo que guardar?» estaba escrita
     * cinco veces, REG-300 unificó tres, y su guardián contaba exactamente esas
     * tres y buscaba su nombre de variable. Las dos que quedaron sueltas —el
     * autoguardado al servidor y el respaldo local, o sea las que deciden si el
     * trabajo del médico se guarda— pasaban en verde.
     *
     * La lección, que vale para toda compuerta: **medir la parte reparada
     * certifica el arreglo, no la propiedad**. El guardián nuevo busca la FORMA
     * de la condición, no cómo se llame quien la guarda.
     *
     * Trae además la variante silenciosa: las dos escrituras a `localStorage`
     * acababan en `catch { }` con el comentario «no es crítico». Sin cuota, el
     * respaldo deja de escribirse y nadie se entera.
     */
    /**
     * 395 es esta familia AL REVÉS —no se pierde un dato, se duplica— y merece
     * estar aquí porque el daño es el mismo: el expediente deja de decir la
     * verdad. Una adenda nacía con `addDoc`, así que su identidad salía de la
     * escritura y no de la intención. El doble clic estaba cubierto; lo que no,
     * el caso que la red provoca sola: el commit sale, la respuesta se pierde,
     * la pantalla PIDE que se reintente, y quedan dos enmiendas idénticas a una
     * nota firmada. Que no se pueden borrar.
     */
    /**
     * 411 es esta familia con la pérdida DOS VECES: el pendiente que no se pudo
     * escribir, y el aviso de que no se pudo. REG-344 arregló el silencio en uno
     * de los cuatro llamadores; los otros tres siguieron con el `catch` vacío, y
     * uno con el comentario «igual que arriba» — que es lo que no era. Donde sí
     * había aviso era un toast, y un toast muere al cambiar de pantalla, que es
     * exactamente lo que se hace después de firmar.
     */
    regs: [157, 193, 195, 215, 216, 219, 283, 287, 294, 295, 297, 300, 302, 323, 329, 330, 391, 392, 395, 411],
  },
  {
    clave: 'tarde',
    nombre: 'Llega tarde para servir',
    patron:
      'El aviso es correcto y aparece DESPUÉS del momento en que habría servido ' +
      '— casi siempre después de firmar. Un aviso tras la firma no es una ' +
      'protección: es un registro de que no la hubo.',
    regs: [173, 190],
  },
  {
    clave: 'mensaje_miente',
    nombre: 'El mensaje mentía sobre la causa',
    patron:
      'Falla algo y el sistema culpa a otra cosa. Cuesta doble: la avería y las ' +
      'horas persiguiendo la avería equivocada.',
    regs: [155, 156, 251, 317, 327, 328],
  },
  {
    clave: 'decision_del_dueno',
    nombre: 'Decisión del médico dueño, no defecto',
    patron:
      'Están en el ledger porque cambiaron el comportamiento, pero no había ' +
      'nada roto: lo decidió el médico responsable. Se cuentan aparte para no ' +
      'inflar la cuenta de defectos con decisiones.',
    /**
     * 357 es la variante de esta familia en la que el sistema NO podía esperar
     * a la decisión. Qué subconjunto de PMC es reproducible es del dueño, y
     * mientras no existiera se estaba reproduciendo TODO — que es la opción más
     * arriesgada de las posibles, tomada por omisión.
     *
     * La lección: cuando falta una política, el código ya está aplicando una.
     * Conviene que sea la que falla cerrado, y que la decisión siga marcada
     * como del dueño en vez de darse por tomada.
     */
    regs: [174, 175, 292, 357],
  },
  {
    /**
     * Familia NUEVA, abierta el 8-ago-2026 con REG-241.
     *
     * Se abre porque ninguna de las trece anteriores la describía. No es que el
     * sistema mienta sobre la causa (`mensaje_miente`) ni que falte el
     * instrumento (`sin_medir`): el dato correcto EXISTE en el repositorio y el
     * registro que lo copia se queda atrás porque copiarlo depende de que
     * alguien se acuerde.
     */
    clave: 'depende_de_recordar',
    nombre: 'Depende de que alguien se acuerde',
    patron:
      'Hay un dato que ya vive en el repositorio y un segundo sitio que lo ' +
      'repite a mano. El segundo se desfasa —siempre—, y como tiene forma de ' +
      'registro oficial se le cree más que a la fuente. La reparación nunca es ' +
      'volver a copiarlo bien: es DERIVARLO, y poner una compuerta que falle ' +
      'cuando se separen.',
    /**
     * 334: la integración se verificaba DESPUÉS de publicar porque alguien
     * tenía que acordarse de construir entre un merge y el siguiente. Nadie se
     * acordó, y el verde se compró revirtiendo la rama entera.
     */
    /**
     * 338: el QR del segundo factor se dibujaba en local en UNA de las dos
     * pantallas de enrolamiento. Aquí lo que se repite a mano no es un dato
     * sino una DECISIÓN de seguridad, y se desfasó igual: la pantalla que no se
     * actualizó siguió mandándole el secreto compartido a un tercero. La
     * reparación es la que dicta la familia — no volver a copiar el arreglo,
     * sino una compuerta que vigile la propiedad en todo el árbol y falle
     * cuando una pantalla nueva se separe.
     */
    /**
     * 340 es la forma más pura de esta familia y enseña su variante peligrosa.
     * Declarar una colección en TRES sitios depende de que alguien se acuerde, y
     * había un guardián por cada sitio — pero los tres se comparaban ENTRE ELLOS:
     * dos parseaban `firestore.rules` y lo tomaban por el censo de lo que existe.
     * Ninguno miraba el código. Un círculo de copias validándose, con nueve
     * colecciones fuera —la bitácora NOM-004 entre ellas— y la suite en verde.
     *
     * La reparación es la que dicta la familia, dicha en su forma exacta: el
     * censo se DERIVA de lo que el código escribe, y la compuerta falla cuando
     * el código y las declaraciones se separan.
     */
    /**
     * 343 sale del guardián de 340, y ésa es su lección: un guardián que se
     * escribe bien no cierra un defecto, enseña el siguiente. Al derivar el
     * censo del código quedaron 21 colecciones de raíz sin clasificar, y entre
     * ellas `clinic_members` —lo que ata una cuenta a un consultorio— sin
     * respaldo. El manifiesto confundía «del consultorio» con «bajo la ruta del
     * consultorio»: la pertenencia también se expresa con un campo, y el
     * recorrido de un árbol no ve nada que no cuelgue de él.
     */
    /**
     * 354 es esta familia en su forma más cara: lo que se repetía a mano no era
     * un dato sino el ESTADO DE UN DESPLIEGUE. `firestore.rules` se revisa en
     * cada PR y `vercel --prod` no lo publica, así que el repositorio decía una
     * verdad —«esta colección está protegida así»— que en producción no regía.
     * La nota viajó de documento en documento durante meses.
     *
     * La reparación es la que dicta la familia: se DERIVA (sha256 de las reglas
     * contra las confirmadas desplegadas) y una compuerta falla cuando se
     * separan, exigiendo que se declare qué se rompe mientras tanto.
     */
    /**
     * 379 es esta familia con el registro oficial **incompleto en vez de
     * desfasado**, y enseña una variante propia: la regla se cumplía hacia
     * adelante y se había incumplido hacia atrás.
     *
     * `docs/ops/INDICES-DE-FIRESTORE.md` existe desde 352 y es explícito —«ninguna
     * consulta nueva puede depender de un índice de este archivo hasta que esté
     * desplegado»—, así que toda consulta NUEVA se escribía en su versión peor
     * pero funcional, con el sacrificio declarado. Lo que nadie hizo nunca fue
     * contar las consultas que **ya existían**: cuatro pedían un índice compuesto
     * y el archivo declaraba cero de las cuatro, una de ellas en la página
     * pública del médico.
     *
     * Su lección: un registro que se abre mirando el trabajo futuro no descubre
     * la deuda que ya estaba puesta. El día que se escribe hay que contar el
     * pasado una vez — y después derivarlo, que es lo que hace su guardián.
     */
    /**
     * 382 es esta familia en el REGISTRO MISMO, y es la más grave de la serie:
     * no un dato desfasado, sino seis dominios del alcance —voz, aprendizaje,
     * automatización, WhatsApp, razonamiento y accesibilidad— sin una sola fila
     * en el tablero. Ninguno diferido, ninguno bloqueado: ausentes.
     *
     * Su lección: ningún documento derivado puede notar la ausencia de algo. Se
     * escriben mirando lo que hay, y cada uno hereda el hueco del anterior con
     * más autoridad que el anterior. Lo único que caza una ausencia es una lista
     * sellada que alguien tenga que romper a propósito.
     */
    /**
     * 394 es esta familia con el dato que se repite a mano siendo **un número**:
     * el censo decía «44 getDocs sin limit; falta recontarlo» y nadie lo
     * recontó. La reparación es la que dicta la familia —derivarlo y poner una
     * compuerta— y su instrumento tuvo que aprender a no exagerar: el primer
     * recuento marcó como deuda una lectura que sí acota, porque resolvía los
     * nombres en todo el archivo y otra función tenía una variable homónima.
     */
    /**
     * 416 es esta familia **sobre la reparación de 340**, un escalón más arriba.
     * 340 le quitó la memoria al ESTADO: el sello guarda el sha256 de las reglas
     * desplegadas y una compuerta falla cuando se separa del archivo. Lo que
     * quedó dependiendo de que alguien se acordara fue el ACTO DE REGISTRARLO —
     * correr `sha256sum` a mano después de desplegar y pegarlo.
     *
     * Y se saltó: las reglas se publicaron el 31-ago con v1177, el sello se
     * quedó vacío, y el repositorio pasó a declarar rotas unas protecciones que
     * ya regían. Su lección: derivar el dato no basta si EMITIRLO sigue siendo un
     * paso manual al final de un despliegue. Ahí lo emite quien publica.
     */
    /**
     * 504 y 505 son el mismo día y la misma familia, en sus dos formas.
     *
     * 504 es un par PARTIDO POR LA MITAD: #413 quitó el SHA duplicado del botón
     * de producción «así no puede repetirse», y dejó la VERSIÓN escrita dos
     * veces al lado. Se separaron y el botón quedó sin poder desplegar, sin
     * forma de enterarse salvo pulsándolo. Cerrar una mitad de un par y dejar la
     * otra es de lo más caro de esta familia: el segundo caso llega con el
     * primero ya olvidado.
     *
     * 505 es la variante más engañosa: el dato SÍ se derivaba —241 lo arregló—
     * pero de la FUENTE equivocada. Y el primer arreglo repitió el defecto el
     * mismo día, porque se buscó otra fuente dentro del repositorio cuando el
     * dato no está en el repositorio.
     *
     * Su lección conjunta: derivar no es la reparación, es la mitad. La otra
     * mitad es DE DÓNDE — y se salta con facilidad porque un dato derivado ya
     * viene con autoridad y nadie vuelve a mirarlo con desconfianza.
     */
    /**
     * 424 es esta familia en el orden entre DOS SISTEMAS que no se hablan. Los
     * índices de Firestore hay que desplegarlos ANTES que el código que los usa
     * —Firestore no degrada una consulta sin índice, la RECHAZA— y la integración
     * de Vercel publica sola con cada merge. Lo único que sostenía ese orden era
     * un párrafo en un documento de operación: alguien tenía que acordarse el día
     * correcto, y entre medias cuatro pantallas se abrían con un error.
     *
     * El arreglo no es un recordatorio mejor: es que romper el orden deje de
     * romper la pantalla (`conRespaldoSinIndice`) y que la degradación se VEA. El
     * orden sigue siendo el correcto; lo que ya no depende de la memoria es el
     * daño.
     */
    regs: [241, 253, 310, 334, 340, 343, 354, 379, 382, 389, 394, 416, 424, 502, 504, 505],
  },
  {
    /**
     * Familia abierta el 8-ago-2026 con REG-242, y va a crecer.
     *
     * No es un defecto: no había nada roto. Es una función que el mercado da
     * por supuesta y que aquí **nunca existió**, y por eso ninguna prueba, ni
     * ninguna auditoría interna, podía delatarla — sólo se ve comparando.
     *
     * Se cuenta aparte a propósito. Mezclarla con los defectos haría creer que
     * el sistema falla más de lo que falla, y haría perder de vista que estos
     * se encuentran con OTRO instrumento: mirar afuera, no mirar el código.
     */
    clave: 'hueco_frente_al_mercado',
    nombre: 'El mercado lo tiene y aquí nunca existió',
    patron:
      'Función que los productos de referencia dan por supuesta y que aquí no ' +
      'estaba. Ninguna prueba interna puede delatarla: no hay nada roto que ' +
      'medir. Se encuentra comparando con casos idénticos, no leyendo el ' +
      'código.',
    regs: [242, 243, 250, 304, 326],
  },
  {
    clave: 'falta_un_eje',
    nombre: 'Al modelo de datos le faltaba un eje',
    patron:
      'El dato se guardaba entero y correcto, pero sin la distinción que lo hace ' +
      'utilizable. No se arregla con una validación: se arregla añadiendo la ' +
      'pregunta que faltaba.',
    /**
     * 360 es esta familia en su forma declarada: al modelo de la tarea le
     * faltaban tres ejes del §9 —qué se decidió, qué se hizo, si se avisó al
     * paciente— y `progreso-resultado.ts` lo había ESCRITO en su encabezado en
     * vez de rellenarlos. Un resultado crítico cerrado sin que nadie llamara al
     * paciente se veía igual que uno donde sí se llamó.
     *
     * Lo que esta familia aprende aquí: un hueco bien declarado no es un hueco
     * cerrado. Se agradece que el módulo se negara a inventar el dato; lo que
     * hacía falta era el eje.
     */
    regs: [183, 227, 360],
  },
  {
    /**
     * Familia abierta el 28-ago-2026 con REG-341, y va a crecer.
     *
     * Se abre porque ninguna de las quince anteriores la describía. No hay nada
     * roto: el código es correcto, las pruebas pasan y el médico no ve un fallo.
     * Lo único que hay es un SUPUESTO —que la colección cabe— que era cierto el
     * día que se escribió y deja de serlo sin que nada avise.
     *
     * Por qué ninguna prueba puede delatarla: los fixtures son pequeños. Un
     * `getDocs` sin `limit` sobre tres pacientes sintéticos se comporta
     * exactamente igual que sobre cincuenta mil. El instrumento no es una
     * prueba: es la pregunta «¿y con 50 000?», hecha a propósito.
     *
     * Y trae una lección propia sobre la reparación. Acotar la lectura ARREGLA
     * la escala y ABRE un defecto de la familia `hueco_como_dato`: quien pedía
     * «la lista» recibe un recorte, y si no se declara, dice «no hay» de lo que
     * sí está. Por eso 341 se cuenta aquí —su causa es el supuesto de tamaño—
     * pero su arreglo no está terminado hasta que el recorte se ve.
     */
    clave: 'crece_mal',
    nombre: 'Se escribió para un consultorio pequeño',
    patron:
      'La lectura, el bucle o el documento suponen que lo que manejan cabe. Es ' +
      'cierto mientras el consultorio es chico y deja de serlo sin aviso: no ' +
      'falla, se degrada. Ninguna prueba lo delata porque los fixtures son ' +
      'pequeños. Se encuentra preguntando «¿y con cincuenta mil?».',
    /**
     * 350 es la misma familia en el OTRO eje. 341 acotó lo que crecía con el
     * CONSULTORIO; el historial de un paciente crece con el PACIENTE, y ahí
     * cada documento lleva dentro el dictado completo de una consulta. La
     * pantalla de retención lo multiplicaba: hasta 500 historiales enteros para
     * calcular una fecha y un conteo.
     *
     * Su lección propia, que 341 no traía: **una salvaguarda no puede depender
     * de un techo**. Al acotar la lectura, el bloqueo NOM-004 de borrado —que
     * filtraba el historial en memoria— habría vuelto borrable a un paciente
     * con las notas firmadas por debajo del techo. Acotar una lectura no es una
     * operación local ni siquiera cuando uno mismo la acota.
     */
    /**
     * 351 es la factura completa de esta familia al repararse a medias. Acotar
     * `getPatients` (341) arregló la escala y conservó la FIRMA, así que el
     * recorte siguió circulando sin etiqueta por nueve pantallas: un typeahead
     * que decía «no está» de quien sí está, un importador que clasificaba como
     * «nuevo» al consultorio entero, un panel NOM-004 que afirmaba «al día»
     * habiendo mirado 500 de N, un libro de controlados sin el nombre de a
     * quién se le dio.
     *
     * La lección: **un arreglo de escala que conserva el tipo de retorno no ha
     * terminado**. Un `T[]` no puede decir que viene recortado, y el silencio
     * se lee como un hecho.
     */
    /**
     * 352 es esta familia cruzándose con «pérdida de datos» y ganando la peor
     * combinación: la lectura sin cota estaba envuelta en un `catch` que la
     * tragaba, así que la baja de un paciente podía borrar el expediente y
     * dejar sus citas —con su nombre y su teléfono dentro— en la base. Por ese
     * camino pasa la cancelación ARCO.
     */
    /**
     * 393 es esta familia con su forma más barata de reconocer: `getDocs` de una
     * colección entera, en el camino que el médico espera, para usar como mucho
     * las mil palabras que caben en el sesgo del reconocedor. Crecía con los años
     * y se compartía por consultorio, así que el precio subía solo.
     *
     * Trae además la variante que este repositorio persigue por todas partes: la
     * lectura fallida devolvía `[]` y la pantalla lo pintaba como «todavía no ha
     * aprendido ninguna palabra» — un fallo de red afirmando que el vocabulario
     * del médico está vacío.
     */
    /**
     * 423 es esta familia enseñando que **acotar bien no es lo mismo que acotar**.
     * Los tres anteriores pusieron el techo; 423 es sobre QUÉ se queda dentro
     * cuando el techo aprieta. El worklist recortaba por antigüedad —una mejora
     * real sobre el recorte arbitrario de antes— y con eso el resultado crítico
     * de esta mañana era el PRIMERO en caerse, en un consultorio grande y sólo en
     * un consultorio grande. Con fixtures pequeños las tres versiones se
     * comportan igual, que es la marca de esta familia.
     *
     * Su lección propia: el criterio del recorte también es un supuesto de
     * tamaño. «Los 200 primeros» sólo es una respuesta aceptable mientras 200
     * sean todos.
     */
    /**
     * 429 es la misma lección que 341→351, aplicada a tiempo por una vez: la
     * lista de espera se leía entera, y acotarla A SECAS la habría dejado peor —
     * un recorte que se presenta como completo es un paciente esperando que
     * nadie ve. Por eso `getWaitlist` dejó de devolver un array pelado: un array
     * no puede decir que viene recortado.
     */

    regs: [341, 350, 351, 352, 393, 423, 429],
  },
] as const

/** Todos los REG clasificados, sin repetir. */
export function regsClasificados(): number[] {
  return FAMILIAS.flatMap(f => f.regs).sort((a, b) => a - b)
}

/** ¿Algún REG está en dos familias? Un defecto tiene UNA causa raíz. */
export function regsDuplicados(): number[] {
  const vistos = new Set<number>()
  const dobles = new Set<number>()
  for (const f of FAMILIAS) {
    for (const r of f.regs) {
      if (vistos.has(r)) dobles.add(r)
      vistos.add(r)
    }
  }
  return [...dobles].sort((a, b) => a - b)
}

/** Las familias ordenadas por tamaño: la primera es de la que más se enferma. */
export function porTamano(): FamiliaDeDefecto[] {
  return [...FAMILIAS].sort((a, b) => b.regs.length - a.regs.length || a.clave.localeCompare(b.clave))
}

/**
 * Lo que el conteo dice y no dice.
 *
 * DICE: cuál es la forma de fallar que más se repite en lo que YA se encontró.
 *
 * NO DICE: cuál es la más frecuente en el sistema. Sólo se cuentan los defectos
 * ENCONTRADOS, y encontrar depende de dónde se miró. Una familia pequeña puede
 * serlo porque es rara o porque nadie la busca — y las dos se ven igual desde
 * aquí. La de «aislamiento» es la sospechosa obvia: cuatro casos, todos hallados
 * al auditar a propósito, ninguno en uso normal.
 */
export const LO_QUE_EL_CONTEO_NO_DICE =
  'Sólo se cuentan los defectos ENCONTRADOS. Una familia pequeña puede serlo ' +
  'porque es rara o porque nadie la busca, y las dos se ven igual desde aquí.'
