#!/usr/bin/env python3
"""
Cama musical ambiental, generada — sin muestras de terceros ni licencias.

Un pad de acordes largos en escala mayor, con armónicos suaves, filtro
pasa-bajos y una respiración lenta de volumen. Va a −16 dB bajo la voz: se
siente, no se escucha. Determinista (semilla fija) para que dos renders suenen
igual.

Uso:  python3 scripts/demo-video/musica.py  → remotion/public/musica/cama.wav
"""
import os
import numpy as np
import soundfile as sf

AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.path.join(AQUI, "remotion", "public", "musica")
os.makedirs(SALIDA, exist_ok=True)

SR = 44100
DUR = 11 * 60  # 11 minutos; Remotion lo repite si hace falta
rng = np.random.default_rng(7)

# Progresión en Re mayor, dos compases por acorde, muy lento.
# Frecuencias base (Hz) de cada acorde en voicing cerrado, una octava grave.
ACORDES = [
    [146.83, 220.00, 293.66, 369.99],   # D  (D A D F#)
    [123.47, 185.00, 246.94, 293.66],   # Bm (B F# B D)
    [196.00, 246.94, 293.66, 369.99],   # G  (G B D F#) maj7
    [110.00, 164.81, 220.00, 277.18],   # A  (A E A C#)
]
SEG_ACORDE = 12.0

t = np.arange(int(SR * DUR)) / SR
mezcla = np.zeros_like(t)

def voz(freq, inicio, dur):
    n0, n1 = int(inicio * SR), int((inicio + dur) * SR)
    tt = t[n0:n1] - inicio
    # envolvente lenta con solape
    env = np.minimum(1, tt / 3.5) * np.minimum(1, (dur - tt) / 3.5)
    env = np.clip(env, 0, 1)
    det = 1 + rng.normal(0, 0.0012)
    s = (np.sin(2 * np.pi * freq * det * tt)
         + 0.35 * np.sin(2 * np.pi * freq * 2 * det * tt + 0.3)
         + 0.12 * np.sin(2 * np.pi * freq * 3 * tt + 0.9))
    vib = 1 + 0.004 * np.sin(2 * np.pi * 0.11 * tt + rng.uniform(0, 6))
    return n0, n1, s * env * vib

i = 0
tiempo = 0.0
while tiempo < DUR - SEG_ACORDE:
    acorde = ACORDES[i % len(ACORDES)]
    for f in acorde:
        n0, n1, s = voz(f, tiempo, SEG_ACORDE + 4.0)
        n1 = min(n1, len(mezcla))
        mezcla[n0:n1] += s[: n1 - n0] * 0.22
    # una nota alta ocasional, muy suave
    if i % 3 == 1:
        n0, n1, s = voz(acorde[2] * 2, tiempo + 5.0, 8.0)
        n1 = min(n1, len(mezcla))
        mezcla[n0:n1] += s[: n1 - n0] * 0.05
    tiempo += SEG_ACORDE
    i += 1

# Filtro pasa-bajos sencillo (media móvil doble) para quitar aspereza.
def suaviza(x, n):
    k = np.ones(n) / n
    return np.convolve(x, k, mode="same")
mezcla = suaviza(suaviza(mezcla, 9), 5)

# Respiración de volumen y normalización.
mezcla *= 0.85 + 0.15 * np.sin(2 * np.pi * t / 37.0)
mezcla /= np.max(np.abs(mezcla)) + 1e-9
mezcla *= 0.6
estereo = np.stack([mezcla, np.roll(mezcla, int(SR * 0.011))], axis=1)  # ancho estéreo leve
sf.write(os.path.join(SALIDA, "cama.wav"), estereo.astype(np.float32), SR)
print("cama.wav", DUR, "s")
