/**
 * QUÉ CAMPOS VIAJAN CUANDO SE GUARDA UN PACIENTE DESDE `/pacientes`.
 *
 * ── POR QUÉ ESTO ES UN MÓDULO Y NO CUATRO LÍNEAS EN LA PANTALLA ──────────────
 *
 * Porque decidir qué se escribe encima de un expediente es una regla clínica, no
 * un detalle del formulario. El editor de pacientes mandaba SIEMPRE el estado
 * completo del formulario a `updatePatient` → `updateDoc`, que sobrescribe campo
 * por campo. Dos de esos campos la pantalla casi nunca los enseña:
 *
 *   · `alergias` vive tras `{mode === 'medico' && …}`;
 *   · `notas` no tiene input en NINGUNA parte del producto.
 *
 * Así que corregir un teléfono desde modo secretaria escribía `alergias: ''`
 * encima de lo que hubiera — y `sinUndefined` deja pasar la cadena vacía, que es
 * un borrado perfectamente válido para Firestore. De `alergias` cuelgan a la vez
 * el cruce alergia↔fármaco, la compuerta que impide firmar, el sesgo del
 * reconocedor hacia los alérgenos y el recuadro rojo de la receta: los cuatro se
 * apagan sin una sola señal, y el campo vacío se lee después como «no se ha
 * preguntado», no como «alguien lo borró». (REG-323.)
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * **No se escribe lo que no se pudo leer.** Un campo que el formulario no mostró
 * no viaja: su ausencia deja intacto el valor guardado, en vez de pisarlo con el
 * eco de una copia que puede tener 30 segundos de retraso. Es la regla 4 de
 * seguridad clínica —«ausencia de dato no es dato de ausencia»— dicha en
 * lenguaje de escritura.
 *
 * Lo que NO hace: impedir que el médico vacíe las alergias A PROPÓSITO. Con el
 * input delante, vaciarlo es una decisión suya —«no tiene alergias conocidas»— y
 * tiene que llegar. La reparación distingue el borrado deliberado del borrado por
 * omisión, no prohíbe borrar.
 *
 * ── DETERMINISTA ─────────────────────────────────────────────────────────────
 *
 * El instante entra por parámetro y no se lee del reloj aquí dentro — mismo
 * criterio que `claveDeIntento` y `yaDebioTerminar`. Una función que mira el
 * reloj no se puede probar dos veces con el mismo resultado.
 */
import type { Patient } from '@/types'
import { edadEnAnios } from '@/lib/expediente/pediatria'

/** Los dos modos de la interfaz. `AppMode` no se exporta desde su contexto. */
export type ModoDeEdicion = 'medico' | 'secretaria'

/** El estado del formulario del modal, tal cual lo tiene el componente. */
export interface FormularioDePaciente {
  nombre: string
  telefono: string
  whatsapp: string
  email: string
  fechaNacimiento: string
  edad: string
  sexo: string
  curp: string
  seguroMedico: string
  alergias: string
  notas: string
}

/**
 * Lo que se conserva del paciente que ya existía. `null` en el alta.
 * Sólo los campos que el formulario NO edita y que hay que arrastrar para que
 * `updateDoc` no los pise.
 */
export type PacientePrevio = Pick<
  Patient,
  'alergias' | 'noShowCount' | 'cancelacionCount' | 'creadoPor' | 'createdAt'
>

export interface ContextoDeGuardado {
  modo: ModoDeEdicion
  previo: PacientePrevio | null
  /**
   * Correo de quien da de alta. Sólo se usa si el paciente aún no tiene
   * `creadoPor` — editar a alguien NUNCA reescribe quién lo dio de alta.
   * Obligatorio porque `Patient.creadoPor` no admite `undefined`.
   */
  autor: string
  /** Instante ISO. Por parámetro: ver cabecera. */
  ahora: string
}

export function construirGuardadoDePaciente(
  f: FormularioDePaciente,
  { modo, previo, autor, ahora }: ContextoDeGuardado,
): Omit<Patient, 'id'> {
  const tel = f.telefono.replace(/\D/g, '')

  /**
   * MP-017 — UN SOLO DATO PARA UNA SOLA COSA: LA EDAD SALE DE LA FECHA.
   *
   * `edad` y `fechaNacimiento` se guardaban las dos, capturadas por separado.
   * Eso son DOS FUENTES DE VERDAD para el mismo hecho, y la que envejece mal es
   * la que acaba impresa: la receta lee `patient.edad`, así que un niño
   * registrado a los 6 seguía saliendo con 6 dos años después, en un documento
   * medicolegal. Nada avisaba, porque la cifra era plausible.
   *
   * Con fecha de nacimiento, la edad se DERIVA aquí y la tecleada se ignora:
   * no puede quedar guardado «nació en 2019, edad 40». Sin fecha —el paciente
   * que sólo sabe su edad aproximada, que es el caso que el dueño pidió
   * conservar— se guarda la que se escribió, que es el único dato que hay.
   *
   * `?? undefined` y no `|| undefined`: **0 es una edad**. Es la del lactante,
   * o sea justo el paciente cuya edad más pesa en una dosis.
   */
  const derivada = f.fechaNacimiento ? edadEnAnios(f.fechaNacimiento, ahora.slice(0, 10)) : null
  const edad = derivada ?? (f.edad.trim() === '' ? undefined : Number(f.edad))

  const salida: Omit<Patient, 'id'> = {
    nombre: f.nombre.trim(),
    telefono: tel,
    // UN SOLO teléfono en la pantalla (29-jul-2026), dos campos por debajo.
    // El formulario ya no pregunta el WhatsApp por separado —en la práctica es
    // el mismo número—, pero el export FHIR y otras rutas leen `whatsapp`
    // aparte: si se quedara vacío, un paciente nuevo perdería su contacto móvil
    // ahí. Se respeta el que ya estuviera guardado y sólo se rellena si falta.
    whatsapp: (f.whatsapp.replace(/\D/g, '') || tel),
    email: f.email.trim(),
    fechaNacimiento: f.fechaNacimiento,
    edad: Number.isFinite(edad as number) ? edad : undefined,
    sexo: (f.sexo || undefined) as Patient['sexo'],
    curp: f.curp.trim().toUpperCase() || undefined,
    seguroMedico: f.seguroMedico.trim(),
    noShowCount: previo?.noShowCount ?? 0,
    cancelacionCount: previo?.cancelacionCount ?? 0,
    creadoPor: previo?.creadoPor ?? autor,
    updatedAt: ahora,
    createdAt: previo?.createdAt ?? ahora,
  }

  /**
   * ALERGIAS — sólo si la pantalla las enseñó.
   *
   * En modo secretaria el input no se monta, así que `f.alergias` no es lo que
   * alguien escribió: es el eco de la copia con la que se abrió el modal. Ese eco
   * no tiene derecho a escribir sobre el expediente.
   *
   * Cuando el valor no cambió, se devuelve el del paciente previo VERBATIM: si el
   * guardado no es una edición de este campo, tampoco debe ser una normalización
   * silenciosa de su contenido (regla 3 — nada cambia en silencio).
   */
  if (modo === 'medico') {
    const previa = previo?.alergias ?? ''
    salida.alergias = f.alergias === previa ? previa : f.alergias.trim()
  }

  /**
   * NOTAS — nunca. No hay input de `notas` en ninguna pantalla del producto, así
   * que ningún guardado desde aquí puede ser una edición de ese campo. Enviarlo
   * sólo podía borrarlo. Si algún día vuelve el input, vuelve la clave — con su
   * propia condición, no de vuelta al saco de siempre.
   */

  return salida
}
