#!/usr/bin/env python3
"""
Sintetiza la narración y el diálogo del video con Kokoro (ONNX, sin red).

Por qué Kokoro y no un servicio en la nube: la sesión donde nació este video
no tenía salida a proveedores de voz. Kokoro corre local, es abierto (Apache 2)
y trae voces en español. El dueño puede regenerar las pistas con cualquier otro
sintetizador: lo único que consume Remotion son los .wav de `remotion/public/voz`
y el `duraciones.json` que escribe este script.

Uso:
  node scripts/demo-video/exportar-guion.mjs > /tmp/guion.json
  python3 scripts/demo-video/tts.py /tmp/guion.json ruta/al/kokoro-v1.0.onnx ruta/al/voices-v1.0.bin
"""
import json
import os
import sys

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

AQUI = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(AQUI, "remotion", "public")
VOZ = os.path.join(PUB, "voz")
DLG = os.path.join(PUB, "dialogo")
os.makedirs(VOZ, exist_ok=True)
os.makedirs(DLG, exist_ok=True)

guion = json.load(open(sys.argv[1]))
k = Kokoro(sys.argv[2], sys.argv[3])

# Narrador: voz masculina en español. Médica y paciente: dos timbres femeninos
# distintos (la paciente es una mezcla, porque Kokoro sólo trae una voz femenina
# en español y la mezcla con una inglesa la hace sonar mayor y distinta).
NARRADOR = k.get_voice_style("em_alex")
MEDICA = k.get_voice_style("ef_dora")
PACIENTE = k.get_voice_style("ef_dora") * 0.35 + k.get_voice_style("af_bella") * 0.65

SR = 24000


def sintetizar(texto, voz, speed):
    samples, sr = k.create(texto, voice=voz, speed=speed, lang="es")
    assert sr == SR
    return samples.astype(np.float32)


def silencio(seg):
    return np.zeros(int(SR * seg), dtype=np.float32)


duraciones = json.load(open(os.path.join(PUB, 'duraciones.json'))) if os.path.exists(os.path.join(PUB, 'duraciones.json')) else {}
SOLO_DIALOGO = '--solo-dialogo' in sys.argv

# ── Narración por escena ────────────────────────────────────────────────────
for esc in ([] if SOLO_DIALOGO else guion["ESCENAS"]):
    for clave, sufijo in (("narracion", ""), ("narracionDespues", "-despues")):
        texto = esc.get(clave)
        if not texto:
            continue
        # Se sintetiza por oración para que el ritmo respire y no se corte.
        partes = [p.strip() for p in texto.replace("? ", "?|").replace("! ", "!|").replace(". ", ".|").split("|") if p.strip()]
        audio = [silencio(0.25)]
        for p in partes:
            audio.append(sintetizar(p, NARRADOR, 0.93))
            audio.append(silencio(0.32))
        audio.append(silencio(0.5))
        s = np.concatenate(audio)
        nombre = f"{esc['id']}{sufijo}.wav"
        sf.write(os.path.join(VOZ, nombre), s, SR)
        duraciones[f"{esc['id']}{sufijo}"] = round(len(s) / SR, 3)
        print(nombre, duraciones[f"{esc['id']}{sufijo}"], "s")

# ── Diálogo de la consulta: un archivo por turno + uno concatenado ──────────
turnos = []
t = 0.0
piezas = [silencio(1.0)]
t = 1.0
for i, turno in enumerate(guion["DIALOGO"]):
    voz = MEDICA if turno["rol"] == "Médico" else PACIENTE
    s = sintetizar(turno["texto"], voz, 0.95 if turno["rol"] == "Médico" else 0.9)
    sf.write(os.path.join(DLG, f"turno-{i:02d}.wav"), s, SR)
    dur = len(s) / SR
    turnos.append({"i": i, "rol": turno["rol"], "texto": turno["texto"], "inicioMs": int(t * 1000), "finMs": int((t + dur) * 1000)})
    piezas.append(s)
    piezas.append(silencio(0.55))
    t += dur + 0.55
piezas.append(silencio(1.0))
todo = np.concatenate(piezas)
sf.write(os.path.join(DLG, "dialogo.wav"), todo, SR)
json.dump({"duracionMs": int(len(todo) / SR * 1000), "turnos": turnos}, open(os.path.join(DLG, "dialogo.json"), "w"), ensure_ascii=False, indent=2)
duraciones["dialogo"] = round(len(todo) / SR, 3)
print("dialogo.wav", duraciones["dialogo"], "s")

json.dump(duraciones, open(os.path.join(PUB, "duraciones.json"), "w"), indent=2)
print("listo:", os.path.join(PUB, "duraciones.json"))
