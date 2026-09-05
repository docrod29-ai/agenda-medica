// Vuelca el guion a JSON para los consumidores que no son JavaScript (tts.py).
import * as g from './guion.mjs'
process.stdout.write(JSON.stringify({ ESCENAS: g.ESCENAS, DIALOGO: g.DIALOGO, CAPITULOS: g.CAPITULOS, CHAT_BOT: g.CHAT_BOT, CHAT_RECORDATORIO: g.CHAT_RECORDATORIO, CHAT_HUECO: g.CHAT_HUECO, CHAT_ESCALACION: g.CHAT_ESCALACION }, null, 2))
