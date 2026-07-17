/**
 * Referencias bibliográficas — fuente única de verdad de las citas.
 * Cada regla del motor apunta a una de estas constantes; nada se afirma sin cita.
 */

export const REF = {
  GRAM_POS:
    'Torres C, Cercenado E. Lectura interpretada del antibiograma de cocos gram positivos. Enferm Infecc Microbiol Clin. 2010;28(8):541-553.',
  ENTEROBACT:
    'Navarro F, Miró E, Mirelis B. Lectura interpretada del antibiograma de enterobacterias. Enferm Infecc Microbiol Clin. 2010;28(9):638-645.',
  NO_FERM:
    'Vila J, Marco F. Lectura interpretada del antibiograma de bacilos gramnegativos no fermentadores. Enferm Infecc Microbiol Clin. 2010;28(10):726-736.',
  BLI:
    'Bush K, Bradford PA. Interplay between β-lactamases and new β-lactamase inhibitors. Nat Rev Microbiol. 2019;17:295-306.',
  CLSI:
    'CLSI M100 (edición vigente). Performance Standards for Antimicrobial Susceptibility Testing.',
  NOM045:
    'NOM-045-SSA2-2005. Vigilancia epidemiológica, prevención y control de las infecciones asociadas a la atención de la salud.',
  MAGIORAKOS:
    'Magiorakos AP, et al. Multidrug-resistant, extensively drug-resistant and pandrug-resistant bacteria. Clin Microbiol Infect. 2012;18:268-281.',
} as const

export type RefKey = keyof typeof REF
