#!/usr/bin/env node
/**
 * Regenera el sello del censo del programa.
 *
 * El sello es un trinquete: el guardián compara el censo contra él y falla si un
 * requisito **desapareció** o si un estado **bajó**. Regenerarlo es un acto
 * deliberado —como subir el techo del trinquete de lint— y por eso vive en un
 * comando aparte y no en el propio guardián: un sello que se regenera solo no
 * vigila nada.
 *
 *   node scripts/programa/sellar-censo.mjs > src/lib/programa/censo-sellado.json
 */
import { execFileSync } from 'node:child_process'

const salida = execFileSync('npx', ['tsx', '--eval', `
  import { REQUISITOS } from './src/lib/programa/requisitos.ts'
  process.stdout.write(JSON.stringify(REQUISITOS.map(r => ({ id: r.id, estado: r.estado }))))
`], { encoding: 'utf8' })

process.stdout.write(JSON.stringify({
  sellado: new Date().toISOString().slice(0, 10),
  porQue:
    'Sello del censo del programa. Un id que estaba aquí y ya no está en el censo pone ' +
    'el CI en rojo; un estado que baja, también. Para cerrar un requisito se le pone ' +
    'estado y evidencia — borrarlo no es cerrarlo.',
  comoSeRegenera: 'node scripts/programa/sellar-censo.mjs > src/lib/programa/censo-sellado.json',
  requisitos: JSON.parse(salida),
}, null, 2) + '\n')
