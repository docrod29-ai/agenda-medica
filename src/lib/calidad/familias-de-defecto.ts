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
    regs: [154, 160, 164, 167, 169, 170, 182, 188, 198, 218, 221, 222, 225, 230, 232, 236, 238, 239, 244, 249, 252, 256, 257, 258, 259, 261, 262, 264, 266, 268, 288, 290, 296, 303, 309, 315, 316, 318, 320, 324, 325, 335, 337, 345, 346, 348, 353, 356, 359, 361],
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
     * 336 es esta familia en su forma más cara: la compuerta que deja FIRMAR
     * pide `medicoId` y cédula; la que deja ENTREGAR pide nombre y cédula.
     * Ninguna de las dos está mal por su cuenta. En el hueco cabía una nota
     * firmable e inentregable — y con `nota.firma` inmutable, irreparable.
     */
    regs: [171, 179, 180, 189, 191, 194, 196, 199, 214, 217, 223, 226, 229, 234, 269, 270, 272, 273, 277, 278, 279, 285, 286, 291, 293, 298, 305, 307, 311, 312, 313, 314, 321, 322, 336],
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
     * 355 es la continuación de 342 y enseña su lección más incómoda: la regla
     * correcta EXISTÍA —`VolverALaFuente` se apartaba en cuanto el médico
     * tocaba la pantalla— y vivía dentro de un componente. Los otros escritores
     * de scroll no la tenían y nada los obligaba. La disciplina no era del
     * sistema, era de un archivo; y lo que no está medido en un sitio común se
     * cumple sólo donde alguien se acordó.
     */
    regs: [159, 166, 168, 185, 197, 213, 235, 237, 240, 245, 246, 247, 248, 254, 255, 260, 263, 265, 267, 274, 299, 306, 308, 331, 342, 355],
  },
  {
    clave: 'hueco_como_dato',
    nombre: 'El hueco tratado como dato',
    patron:
      'Lo que nadie dijo se guarda como si alguien lo hubiera dicho. Es el más ' +
      'peligroso de todos porque el resultado se LEE bien: una vía, una dosis, ' +
      'una negativa, indistinguibles de un dato real.',
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
    regs: [165, 172, 176, 177, 228, 332, 333, 344, 347, 358],
  },
  {
    clave: 'aislamiento',
    nombre: 'Fuga entre consultorios y dinero',
    patron:
      'Un dato o un cobro que cruza la frontera de su dueño. Poco frecuente y ' +
      'de consecuencia alta: aquí un solo caso es un incidente, no una molestia.',
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
    regs: [153, 161, 162, 163, 224, 339, 349],
  },
  {
    clave: 'charter_vacio',
    nombre: 'El charter existía sin encarnar',
    patron:
      'Una sección del charter que vivía como carpeta vacía. No rompe nada hoy; ' +
      'es la diferencia entre un sistema que dice tener un control y uno que lo ' +
      'tiene.',
    regs: [201, 202, 203, 204, 205, 206, 207, 208],
  },
  {
    clave: 'estorba',
    nombre: 'Estorba al médico',
    patron:
      'Correcto por dentro, insoportable por fuera: avisos que interrumpen, se ' +
      'repiten o tapan la nota. Un aviso que estorba se aprende a ignorar, y ' +
      'entonces deja de proteger.',
    regs: [178, 181, 184, 231, 233, 301, 319],
  },
  {
    clave: 'perdida',
    nombre: 'Pérdida de datos',
    patron:
      'Trabajo del médico que desaparece o reaparece solo. Es la categoría de ' +
      'la que menos se perdona: quien lo sufre una vez deja de confiar en todo ' +
      'lo demás.',
    regs: [157, 193, 195, 215, 216, 219, 283, 287, 294, 295, 297, 300, 302, 323, 329, 330],
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
    regs: [241, 253, 310, 334, 338, 340, 343, 354],
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
    regs: [341, 350, 351, 352],
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
